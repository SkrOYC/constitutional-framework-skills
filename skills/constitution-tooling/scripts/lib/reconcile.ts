// Applies closeout deltas after the pull requests merged. Deterministic: it records facts and routes judgment.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { globToRegExp, overlaps } from "./glob.ts";
import { commandResolves } from "./repo.ts";
import { RECORD_LIST_KEYS, certaintyRecord, loadModel, recordPath, recordProblem, type Model } from "./model.ts";
import { renderCriticalPath } from "./render.ts";
import { loadFrontMatter, loadYamlFile, prependChangelogEntry, toBlockYaml } from "./yaml.ts";

export type FastLaneOutcome = { commit: string; subject: string; status: "applied" | "routed"; settled: string[]; reason?: string; overlap?: string };
export type RefusedSettle = { file: string; epic: string; settles: string; reason: string };
export type ReconcileResult = { archived: string[]; applied: string[]; settled: string[]; refusedSettles: RefusedSettle[]; proposed: string[]; routed: { stage: string; item: string; from: string }[]; versions: Record<string, string>; staleOwners: string[]; fastLane: FastLaneOutcome[]; commit: string | null; report: string | null };

interface DecisionRecord {
  id: string;
  question: string;
  status: "proposed" | "open" | "closed";
  ruler?: string;
  ruling?: { ref: string; date: string; summary: string; chosen?: string };
  asked?: { date: string; in: string };
  proposed_by?: string;
}

function git(root: string, args: string[]): string {
  const r = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString().trim()}`);
  return r.stdout.toString();
}

function bump(version: string, level: "patch" | "minor" = "patch"): string {
  const [maj, min, pat] = version.slice(1).split(".").map(Number);
  return level === "minor" ? `v${maj}.${min + 1}.0` : `v${maj}.${min}.${pat + 1}`;
}

/** Adds a changelog entry without re-emitting older ones; a missing file is created from the seeded log. */
function prependEntry(path: string, entry: unknown, seeded: { entries: unknown[] }): void {
  if (!existsSync(path)) { seeded.entries.unshift(entry); writeYaml(path, seeded); return; }
  writeFileSync(path, prependChangelogEntry(readFileSync(path, "utf8"), entry));
}

function writeYaml(path: string, data: unknown): void {
  writeFileSync(path, toBlockYaml(data) + "\n");
}

function excluded(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path) || basename(path) === g.replace(/^\*\*\//, ""));
}

/** Diff lines and files for the commits whose subject names any of the ticket ids, on the current branch. */
function actualsFor(root: string, ticketIds: string[], exclusions: string[]) {
  const perTicket: { id: string; diff_lines: number; review_rounds: number }[] = [];
  const allFiles = new Set<string>();
  let diff = 0, milestones = 0, reviews = 0;
  const seen = new Set<string>();
  for (const id of ticketIds) {
    const shas = git(root, ["log", "--format=%H", `--grep=${id}`]).split("\n").filter(Boolean);
    let tDiff = 0, tReviews = 0;
    for (const sha of shas) {
      if (seen.has(sha)) continue;
      seen.add(sha);
      const subject = git(root, ["log", "-1", "--format=%s", sha]);
      const isReview = /review/i.test(subject);
      if (isReview) { reviews++; tReviews++; } else milestones++;
      for (const line of git(root, ["show", "--numstat", "--format=", sha]).split("\n")) {
        const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
        if (!m || excluded(m[3], exclusions)) continue;
        const n = (m[1] === "-" ? 0 : Number(m[1])) + (m[2] === "-" ? 0 : Number(m[2]));
        diff += n; tDiff += n; allFiles.add(m[3]);
      }
    }
    perTicket.push({ id, diff_lines: tDiff, review_rounds: tReviews });
  }
  return { diff_lines: diff, files_touched: allFiles.size, milestones, review_rounds: reviews, per_ticket: perTicket };
}

/**
 * Sets certainty: settled with evidence on the record `path#id` or on a front-matter file `path`. Returns null when
 * it settled, or why it did not; a path outside .constitution/ is refused before anything is read or written.
 */
function settle(cdir: string, record: string, evidence: any): string | null {
  const why = recordProblem(cdir, record);
  if (why) return why;
  const target = recordPath(cdir, record);
  if ("problem" in target) return target.problem;
  const { rel, path } = target;
  const id = record.split("#")[1];
  const key = RECORD_LIST_KEYS[rel];
  const apply = (r: any) => { r.certainty = "settled"; r.evidence = evidence; delete r.assumption; delete r.decision; delete r.settles_when; };
  if (key) {
    const data: any = loadYamlFile(path);
    const rec = (data?.[key] ?? []).find((r: any) => r.id === id || r.name === id);
    if (!rec) return `${rel} has no record ${id}`;
    apply(rec);
    writeYaml(path, data);
    return null;
  }
  if (path.endsWith(".yaml")) { const data: any = loadYamlFile(path); apply(data); writeYaml(path, data); return null; }
  const { data, body } = loadFrontMatter(path);
  const rec = data && certaintyRecord(data, id);
  if (!rec) return `${rel} has no certainty-bearing record${id ? " " + id : ""}`;
  apply(rec);
  writeFileSync(path, `---\n${toBlockYaml(data)}\n---\n${body}`);
  return null;
}

// Reconciliation reports are <date>-reconciliation.yaml, then <date>-reconciliation-2.yaml, -3, and so on for later
// runs the same day. Plain name order puts "-2" before the unsuffixed report and "-10" before "-2", so order by date
// and then by run number.
const REPORT_RE = /^(\d{4}-\d{2}-\d{2})-reconciliation(?:-([1-9][0-9]*))?\.yaml$/;

/** Reconciliation report file names under reports/, oldest first: by date, then by run number within a day. */
export function reconciliationReports(cdir: string): string[] {
  const dir = join(cdir, "reports");
  if (!existsSync(dir)) return [];
  const runs = readdirSync(dir).flatMap((name) => { const r = REPORT_RE.exec(name); return r ? [{ name, date: r[1], run: r[2] ? Number(r[2]) : 1 }] : []; });
  return runs.sort((a, b) => a.date.localeCompare(b.date) || a.run - b.run).map((r) => r.name);
}

/** The newest reconciliation report's file name, or null when there is none. */
export function newestReconciliationReport(cdir: string): string | null {
  return reconciliationReports(cdir).at(-1) ?? null;
}

/** The file name the next reconciliation report of `date` gets, so a second run the same day never overwrites the first. */
export function nextReconciliationReport(cdir: string, date: string): string {
  const runs = reconciliationReports(cdir).filter((n) => n.startsWith(`${date}-`)).map((n) => { const r = REPORT_RE.exec(n)!; return r[2] ? Number(r[2]) : 1; });
  return runs.length ? `${date}-reconciliation-${Math.max(...runs) + 1}.yaml` : `${date}-reconciliation.yaml`;
}

export type FastLaneCommit ={ sha: string; short: string; subject: string; body: string; settles: string[]; evidence: string | null; files: string[] };

/** The newest tasks changelog entry that carries a fast-lane watermark; null means scan all history. */
function fastLaneWatermark(tasksLog: any): string | null {
  for (const e of tasksLog?.entries ?? []) if (typeof e?.fast_lane_through === "string") return e.fast_lane_through;
  return null;
}

/** Commits after the watermark, oldest first, whose Constitution-Lane trailer says fast. */
export function fastLaneCommits(root: string, watermark: string | null): FastLaneCommit[] {
  if (watermark && Bun.spawnSync(["git", "cat-file", "-e", `${watermark}^{commit}`], { cwd: root }).exitCode !== 0) throw new Error(`fast_lane_through ${watermark} in tasks/changelog.yaml is not a commit in this repository; correct the watermark`);
  const fmt = "--format=%H%x1f%h%x1f%s%x1f%b%x1f%(trailers:key=Constitution-Lane,valueonly,separator=%x1d)%x1f%(trailers:key=Settles,valueonly,separator=%x1d)%x1f%(trailers:key=Evidence,valueonly,separator=%x1d)%x1e";
  const out: FastLaneCommit[] = [];
  for (const rec of git(root, ["log", "--reverse", fmt, watermark ? `${watermark}..HEAD` : "HEAD"]).split("\x1e")) {
    const [sha, short, subject, body, lane, settles, evidence] = rec.replace(/^\n/, "").split("\x1f");
    if (!sha || !lane?.split("\x1d").some((v) => v.trim().toLowerCase() === "fast")) continue;
    const files = git(root, ["show", "--name-only", "--format=", sha]).split("\n").map((s) => s.trim()).filter(Boolean);
    // Evidence is explicit: being the first changed file proves nothing about a record.
    const ev = (evidence ?? "").split("\x1d").map((s) => s.trim().replace(/^\.\//, "")).filter(Boolean)[0] ?? null;
    out.push({ sha, short, subject, body: body ?? "", settles: (settles ?? "").split("\x1d").map((s) => s.trim()).filter(Boolean), evidence: ev, files });
  }
  return out;
}

/** Why a fast-lane commit's Settles cannot apply: no Evidence trailer, or an Evidence path absent at that commit. */
function evidenceProblem(root: string, c: FastLaneCommit): string | null {
  if (!c.settles.length) return null;
  if (!c.evidence) return "has Settles without Evidence; name the repository path that proves the record in an Evidence trailer";
  if (Bun.spawnSync(["git", "cat-file", "-e", `${c.sha}:${c.evidence}`], { cwd: root, stdout: "pipe", stderr: "pipe" }).exitCode !== 0) return `names Evidence ${c.evidence}, which does not exist at that commit`;
  return null;
}

export function reconcile(root: string, opts: { date?: string; commit?: boolean; epics?: string[] } = {}): ReconcileResult {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const cdir = join(root, ".constitution");
  const m: Model = loadModel(root);
  const cfg = m.constitution?.data ?? {};
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const wanted = cfg.default_branch ?? "main";
  if (branch !== wanted) throw new Error(`reconcile runs on ${wanted}; current branch is ${branch}`);
  if (git(root, ["status", "--porcelain"]).trim()) throw new Error("working tree is not clean");
  const head = git(root, ["rev-parse", "--short", "HEAD"]).trim();
  const exclusions: string[] = cfg.diff_exclusions ?? [];
  const result: ReconcileResult = { archived: [], applied: [], settled: [], refusedSettles: [], proposed: [], routed: [], versions: {}, staleOwners: [], fastLane: [], commit: null, report: null };

  // --epic accepts C and EPIC-C alike.
  const wantedEpics = opts.epics?.map((id) => id.trim().replace(/^EPIC-/, "")).filter(Boolean);
  const candidates = m.epics.filter((e) => e.active && e.data?.closeout && (!wantedEpics || wantedEpics.includes(e.data.id)));
  const fastCommits = fastLaneCommits(root, fastLaneWatermark(m.changelogs.tasks?.data));
  if (!candidates.length && !fastCommits.length) {
    if (wantedEpics) {
      const ready = m.epics.filter((e) => e.active && e.data?.closeout).map((e) => `EPIC-${e.data.id}`);
      throw new Error(`--epic ${wantedEpics.map((id) => `EPIC-${id}`).join(",")} matches no active epic that carries a closeout (${ready.length ? `ready: ${ready.join(", ")}` : "none is ready"}), and no fast-lane commit landed since the last reconcile; nothing to reconcile`);
    }
    throw new Error("no active epic carries a closeout and no fast-lane commit landed since the last reconcile; nothing to reconcile");
  }

  const register: { decisions: DecisionRecord[] } = m.openDecisions?.data ?? { decisions: [] };
  const usedIds = new Set(register.decisions.map((d) => d.id));
  const nextId = () => { let n = 1; while (usedIds.has(`OD-${String(n).padStart(2, "0")}`)) n++; const id = `OD-${String(n).padStart(2, "0")}`; usedIds.add(id); return id; };
  const tasksEntry: any = { version: "", date, changed: [], added: [], by: "reconcile" };
  const techEntry: any = { version: "", date, by: "reconcile" };
  let techTouched = false;
  const candidateTerms: string[] = [];

  for (const e of candidates) {
    const d = e.data; const co = d.closeout; const id = d.id;
    const tickets: any[] = d.tickets ?? [];
    // 1. actuals from git
    co.actuals = { ...actualsFor(root, tickets.map((t) => t.id), exclusions), merged_commit: head, measured_at: date };
    result.applied.push(`EPIC-${id}`);
    // 2. settled records
    for (const s of co.settled ?? []) {
      const why = settle(cdir, s.record, s.evidence);
      if (!why) { result.settled.push(s.record); continue; }
      result.routed.push({ stage: "tech-spec", item: `could not settle ${s.record}: ${why}`, from: id });
      result.refusedSettles.push({ file: e.path, epic: `EPIC-${id}`, settles: String(s.record), reason: why });
    }
    // 3. proposed decisions and rulings already approved during execution
    const decisions: DecisionRecord[] = d.decisions ?? [];
    for (const dec of decisions) {
      const existing = register.decisions.find((entry) => entry.id === dec.id);
      if (existing && dec.ruling && existing.question === dec.question) {
        if (existing.status === "closed") {
          // Several epics can carry the same Step-0 ruling. A conflicting ruling needs judgment, not a new id.
          if (!isDeepStrictEqual(existing.ruling, dec.ruling) || (dec.ruler && existing.ruler !== dec.ruler)) {
            result.routed.push({ stage: "tasks", item: `conflicting ruling for decision ${dec.id}; register kept unchanged; EPIC-${id} carried ${JSON.stringify({ ruling: dec.ruling, ...(dec.ruler ? { ruler: dec.ruler } : {}) })}`, from: id });
          }
          continue;
        }
        existing.status = "closed";
        existing.ruling = dec.ruling;
        if (dec.ruler) existing.ruler = dec.ruler;
        result.routed.push({ stage: "tasks", item: `decision ${dec.id} closed in place with the ruling EPIC-${id} carried`, from: id });
        continue;
      }
      const entry: DecisionRecord = { ...dec, status: dec.ruling ? "closed" : "proposed", proposed_by: `EPIC-${id} @ ${head}`, asked: dec.asked ?? { date, in: `EPIC-${id}` } };
      if (usedIds.has(entry.id)) { const fresh = nextId(); result.routed.push({ stage: "tasks", item: `decision ${entry.id} renumbered to ${fresh}`, from: id }); entry.id = fresh; } else usedIds.add(entry.id);
      register.decisions.push(entry);
      if (entry.status === "closed") result.routed.push({ stage: "tasks", item: `decision ${entry.id} added closed with the ruling EPIC-${id} carried`, from: id });
      else result.proposed.push(entry.id);
    }
    delete d.decisions;
    // 4. changelog entries and routing
    for (const ce of co.changelog_entries ?? []) {
      if (ce.directory === "tech-spec") { (techEntry[ce.type] ??= []).push(ce.text); techTouched = true; }
      else if (ce.directory === "tasks") (tasksEntry[ce.type] ??= []).push(ce.text);
      else result.routed.push({ stage: ce.directory, item: ce.text, from: id });
    }
    for (const sp of co.spec_patches ?? []) { (techEntry.changed ??= []).push(`${sp.path}: ${sp.summary} (${sp.commit}, EPIC-${id})`); techTouched = true; }
    for (const r of co.routed_upstream ?? []) result.routed.push({ stage: r.stage, item: r.item, from: id });
    // Code decisions are Stage 3's to rule on: adopt into guidelines or an ADR, or file a defect.
    for (const cd of co.code_decisions ?? []) result.routed.push({ stage: "tech-spec", item: `code decision (${cd.kind}): ${cd.summary} [${(cd.paths ?? []).join(", ")}] at ${cd.commit}`, from: id });
    for (const t of co.candidate_terms ?? []) candidateTerms.push(`${t.term} (${t.where}, EPIC-${id})`);
    for (const fu of co.follow_ups ?? []) tasksEntry.added.push(`Follow-up from EPIC-${id}: ${fu}`);
    for (const df of co.tickets_deferred ?? []) tasksEntry.changed.push(`${df.id} deferred to ${df.route}: ${df.reason}`);
    // 5. archive when nothing is left open
    const open = tickets.filter((t) => !["done", "deferred"].includes(t.status));
    const src = join(root, e.path);
    writeYaml(src, d);
    if (!open.length) {
      const dst = join(cdir, "tasks/completed", basename(e.path));
      mkdirSync(join(cdir, "tasks/completed"), { recursive: true });
      renameSync(src, dst);
      result.archived.push(`EPIC-${id}`);
      tasksEntry.changed.push(`EPIC-${id} ${d.name} archived: ${co.tickets_completed.length} tickets, ${co.points_completed} points, ${co.actuals.diff_lines} diff lines, ${co.actuals.review_rounds} review rounds`);
    } else {
      tasksEntry.changed.push(`EPIC-${id} closeout applied with ${open.length} ticket(s) still open; epic stays active`);
    }
  }

  // 6a. fast-lane commits: code-only fixes that skipped the epic flow. Each becomes a fixed line and settles its
  // records with repository evidence. The lane allows a fix inside one active epic's owned paths, so that is applied
  // with a routed note for the epic; a commit that names a ticket, or spans several active epics' paths, is routed.
  const activeEpics = m.epics.filter((e) => e.active && e.data?.id);
  const ticketRe = new RegExp(`\\b${cfg.acronym ?? "[A-Z]{2,6}"}-[A-Z]{1,2}[0-9]{3}\\b`);
  for (const c of fastCommits) {
    const owners = activeEpics.filter((e) => c.files.some((file) => (e.data.scope?.paths ?? []).some((p: string) => overlaps(file, p))));
    const ticket = ticketRe.exec(`${c.subject}\n${c.body}`)?.[0];
    const reason = ticket ? `names ticket ${ticket}; it belongs in that ticket's epic flow` : owners.length > 1 ? `touches paths owned by ${owners.map((e) => `EPIC-${e.data.id}`).join(" and ")}; the fast lane stays inside one active epic's paths` : evidenceProblem(root, c);
    if (reason) {
      result.routed.push({ stage: "tasks", item: `fast-lane commit ${c.short} "${c.subject}" ${reason}, and was not applied`, from: "fast-lane" });
      result.fastLane.push({ commit: c.short, subject: c.subject, status: "routed", settled: [], reason });
      continue;
    }
    const overlap = owners[0] ? `EPIC-${owners[0].data.id}` : undefined;
    if (overlap) result.routed.push({ stage: "tasks", item: `fast-lane commit ${c.short} "${c.subject}" was applied but touches paths ${overlap} owns; ${overlap}'s lead should rebase onto it and check that the epic's plan still holds`, from: "fast-lane" });
    (tasksEntry.fixed ??= []).push(`${c.subject} (${c.short}, fast lane)`);
    const settledHere: string[] = [];
    for (const record of c.settles) {
      const why = settle(cdir, record, { kind: "repository", ref: c.evidence, version: c.short, date });
      if (!why) { settledHere.push(record); result.settled.push(record); }
      else {
        result.routed.push({ stage: "tech-spec", item: `fast-lane commit ${c.short} could not settle ${record}: ${why}`, from: "fast-lane" });
        result.refusedSettles.push({ file: `commit ${c.short}`, epic: "fast-lane", settles: record, reason: why });
      }
    }
    result.fastLane.push({ commit: c.short, subject: c.subject, status: "applied", settled: settledHere, ...(overlap ? { overlap } : {}) });
  }
  tasksEntry.fast_lane_through = git(root, ["rev-parse", "HEAD"]).trim();

  // 7. stale owner cross-check on archived ticket ids, and verification commands those tickets owned
  const archivedIds = new Set<string>();
  for (const e of candidates) if (result.archived.includes(`EPIC-${e.data.id}`)) for (const t of e.data.tickets ?? []) archivedIds.add(t.id);
  const gpath = join(cdir, "tech-spec/guidelines.md");
  if (archivedIds.size && existsSync(gpath)) {
    const { data: gd, body: gbody } = loadFrontMatter(gpath);
    let changed = false;
    for (const vc of (gd as any)?.verification_commands ?? []) {
      if (vc.exists === false && vc.owner && archivedIds.has(vc.owner)) {
        if (commandResolves(m, vc.command)) { const owner = vc.owner; vc.exists = true; delete vc.owner; changed = true; (techEntry.added ??= []).push(`Verification command ${vc.command} now exists (${owner})`); techTouched = true; }
        else result.routed.push({ stage: "tech-spec", item: `verification command "${vc.command}" is owned by archived ticket ${vc.owner} and still does not resolve`, from: candidates.find((e) => (e.data.tickets ?? []).some((t: any) => t.id === vc.owner))?.data.id ?? vc.owner });
      }
    }
    // Live-verification recipes follow the same flag rule; only a command drive is resolved.
    for (const r of (gd as any)?.live_verification ?? []) {
      if (r.exists !== false || !r.owner || !archivedIds.has(r.owner)) continue;
      const commands = [r.launch, r.doctor, ...(r.drive_kind === "command" ? [r.drive] : []), ...(r.cleanup ? [r.cleanup] : [])];
      const unresolved = commands.filter((c) => !commandResolves(m, c));
      if (!unresolved.length) { r.exists = true; delete r.owner; changed = true; (techEntry.added ??= []).push(`Live-verification recipe ${r.name} now runs`); techTouched = true; }
      else result.routed.push({ stage: "tech-spec", item: `live-verification recipe ${r.name} is owned by archived ticket ${r.owner} and still does not resolve: ${unresolved.join("; ")}`, from: candidates.find((e) => (e.data.tickets ?? []).some((t: any) => t.id === r.owner))?.data.id ?? r.owner });
    }
    if (changed) writeFileSync(gpath, `---\n${toBlockYaml(gd)}\n---\n${gbody}`);
  }
  const walk = (dir: string) => { for (const n of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, n.name); if (n.isDirectory()) { if (n.name !== "completed") walk(p); } else if (/\.(md|yaml)$/.test(n.name)) { const text = readFileSync(p, "utf8"); for (const id of archivedIds) if (new RegExp(`owner[^\\n]{0,40}\\b${id}\\b`, "i").test(text)) result.staleOwners.push(`${p.slice(root.length + 1)}: ${id}`); } } };
  walk(cdir);

  // 6. changelogs
  const tasksLog: any = m.changelogs.tasks?.data ?? { entries: [{ version: "v0.0.1", date, added: ["Initial"], by: "init" }] };
  tasksEntry.version = bump(tasksLog.entries[0].version);
  if (!tasksEntry.added.length) delete tasksEntry.added;
  if (!tasksEntry.changed.length) delete tasksEntry.changed;
  tasksEntry.upstream = { prd: m.changelogs.prd?.data?.entries?.[0]?.version, architecture: m.changelogs.architecture?.data?.entries?.[0]?.version, "tech-spec": m.changelogs["tech-spec"]?.data?.entries?.[0]?.version };
  for (const k of Object.keys(tasksEntry.upstream)) if (!tasksEntry.upstream[k]) delete tasksEntry.upstream[k];
  if (techTouched) {
    const techLog: any = m.changelogs["tech-spec"]?.data ?? { entries: [{ version: "v0.0.1", date, added: ["Initial"], by: "init" }] };
    techEntry.version = bump(techLog.entries[0].version);
    prependEntry(join(cdir, "tech-spec/changelog.yaml"), techEntry, techLog);
    result.versions["tech-spec"] = techEntry.version;
    tasksEntry.upstream["tech-spec"] = techEntry.version;
  }
  prependEntry(join(cdir, "tasks/changelog.yaml"), tasksEntry, tasksLog);
  result.versions.tasks = tasksEntry.version;
  writeYaml(join(cdir, "reports/open-decisions.yaml"), register);

  // 8. routing report when anything needs a decision
  if (result.routed.length || result.refusedSettles.length || result.proposed.length || candidateTerms.length || result.staleOwners.length) {
    const reportPath = join(cdir, "reports", nextReconciliationReport(cdir, date));
    writeYaml(reportPath, { date, commit: head, epics: candidates.map((e) => e.data.id), routed: result.routed, ...(result.refusedSettles.length ? { refused_settles: result.refusedSettles } : {}), proposed_decisions: result.proposed, candidate_terms: candidateTerms, ...(result.staleOwners.length ? { stale_owners: result.staleOwners } : {}), ...(result.fastLane.length ? { fast_lane: result.fastLane } : {}) });
    result.report = reportPath.slice(root.length + 1);
  }

  // 9. render and commit
  writeFileSync(join(cdir, "tasks/critical-path.md"), renderCriticalPath(loadModel(root)));
  if (opts.commit !== false) {
    git(root, ["add", ".constitution"]);
    const after = [...candidates.map((e) => `EPIC-${e.data.id}`), ...(fastCommits.length ? [`${fastCommits.length} fast-lane commit(s)`] : [])];
    const subject = `Reconcile constitution after ${after.join(", ")}`;
    const body = [`tasks ${result.versions.tasks}` + (result.versions["tech-spec"] ? `, tech-spec ${result.versions["tech-spec"]}` : ""), result.archived.length ? `Archived: ${result.archived.join(", ")}` : "", result.settled.length ? `Settled: ${result.settled.join(", ")}` : "", result.proposed.length ? `Proposed decisions: ${result.proposed.join(", ")}` : "", result.fastLane.length ? `Fast lane: ${result.fastLane.map((c) => `${c.commit} ${c.status}`).join(", ")}` : "", result.routed.length ? `Routed: ${result.routed.map((r) => `${r.stage}: ${r.item}`).join("; ")}` : ""].filter(Boolean).join("\n");
    git(root, ["commit", "-q", "-m", subject, "-m", body]);
    result.commit = git(root, ["rev-parse", "--short", "HEAD"]).trim();
  }
  return result;
}
