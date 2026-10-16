// The check catalog. Each check has a stable id documented in references/checks.md.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { matchesAny, overlaps } from "./glob.ts";
import { STAGE_DIRS, exists, isStageId, readText, recordProblem, sidecarTarget, walkRepo, type Finding, type Model, type Severity } from "./model.ts";
import { commandResolves, lockfileVersions } from "./repo.ts";
import type { SchemaSet } from "./schema.ts";

type Ctx = { schemas: SchemaSet };
type Check = (m: Model, ctx: Ctx) => Finding[];

const f = (id: string, severity: Severity, file: string, message: string, pointer?: string): Finding => ({ id, severity, file, message, pointer });

// ---------- schema ----------
const schemaCheck: Check = (m, { schemas }) => {
  const out: Finding[] = [];
  const run = (schema: string, doc: { path: string; data: unknown } | null) => {
    if (!doc) return;
    for (const e of schemas.validate(schema, doc.data)) out.push(f("SCH-001", "error", doc.path, e.message, e.pointer || "/"));
  };
  run("constitution.schema.json", m.constitution);
  run("jobs.schema.json", m.jobs);
  run("capabilities.schema.json", m.capabilities);
  run("constraints.schema.json", m.constraints);
  run("glossary.schema.json", m.glossary);
  m.outOfScope.forEach((d) => run("out-of-scope.schema.json", d));
  run("boundaries.schema.json", m.boundaries);
  m.flows.forEach((d) => run("flow.schema.json", d));
  run("stack.schema.json", m.stack);
  run("guidelines.schema.json", m.guidelines);
  m.adrs.forEach((d) => run("adr.schema.json", d));
  m.metas.forEach((d) => run("meta.schema.json", d));
  m.epics.forEach((d) => run("epic.schema.json", d));
  for (const s of STAGE_DIRS) run("changelog.schema.json", m.changelogs[s]);
  run("open-decisions.schema.json", m.openDecisions);
  m.evidence.forEach((e) => run("evidence-manifest.schema.json", e.manifest));
  return out;
};

// ---------- structure ----------
// The interview skill names its record after the target (PRD, Architecture, TechSpec, Tasks, Realign), so the
// target matches in any case. migrate shares this test to leave interview records in reports/.
export const INTERVIEW_TARGETS = ["prd", "architecture", "techspec", "tech-spec", "tasks", "realign"];
const INTERVIEW_NAME = /^\d{4}-\d{2}-\d{2}-interview-(.+)\.md$/;
export const isInterviewRecord = (name: string): boolean => INTERVIEW_TARGETS.includes(INTERVIEW_NAME.exec(name)?.[1].toLowerCase() ?? "");
const REPORT_PATTERNS = [
  /^open-decisions\.yaml$/,
  /^audit-\d{4}-\d{2}-\d{2}-\d{6}-[a-z0-9-]+\.md$/,
  /^\d{4}-\d{2}-\d{2}-constitution-review(-[a-z0-9-]+)?\.md$/,
  /^\d{4}-\d{2}-\d{2}-reconciliation(-[1-9][0-9]*)?\.yaml$/,
];
const structureCheck: Check = (m) => {
  const out: Finding[] = [];
  const acr = m.constitution?.data?.acronym;
  for (const r of m.reports) {
    if (isInterviewRecord(r) || REPORT_PATTERNS.some((p) => p.test(r))) continue;
    const target = INTERVIEW_NAME.exec(r)?.[1];
    if (target) out.push(f("STR-002", "error", `.constitution/reports/${r}`, `interview record target "${target}" is not one of ${INTERVIEW_TARGETS.join(", ")} (any case)`));
    else out.push(f("STR-002", "error", `.constitution/reports/${r}`, "not a defined report kind; generated inventories and deliverables live outside .constitution/, research goes in research/"));
  }
  for (const s of m.spikes) {
    const ok = acr ? new RegExp(`^SPK-${acr}-[A-Z]{1,2}[0-9]{3}\\.md$`).test(s) : /^SPK-[A-Z]{2,6}-[A-Z]{1,2}[0-9]{3}\.md$/.test(s);
    if (!ok) out.push(f("STR-003", "error", `.constitution/spikes/${s}`, `spike file must be SPK-${acr ?? "ACRONYM"}-<EPIC><NNN>.md, from a ticket id or from OD plus the register entry number`));
  }
  for (const e of m.epics) if (e.fileId && e.data?.id && e.fileId !== e.data.id) out.push(f("STR-004", "error", e.path, `file name says epic ${e.fileId} but id is ${e.data.id}`));
  for (const e of m.epics) if (e.active && e.data?.id === "OD") out.push(f("STR-007", "error", e.path, "epic id OD is reserved for spikes owned by a register entry"));
  for (const ev of m.evidence) {
    if (!ev.manifest) { out.push(f("STR-005", "error", ev.dir, "evidence directory has no manifest.yaml")); continue; }
    // Digests are optional, except where a later diff or meter compares against the file: every
    // file of a measured mode, and any file whose role starts with baseline or measurement.
    const measured = ["benchmark", "stat_threshold", "visual_regression"].includes(ev.manifest.data?.mode);
    for (const file of ev.manifest.data?.files ?? []) {
      const p = join(m.root, ev.dir, file.path);
      if (!existsSync(p)) { out.push(f("STR-005", "error", ev.manifest.path, `listed file ${file.path} is missing`)); continue; }
      const compared = /^(baseline|measurement)/i.test(String(file.role ?? ""));
      if ((measured || compared) && file.sha256 === undefined) out.push(f("STR-005", "error", ev.manifest.path, `${file.path}: ${measured ? `a ${ev.manifest.data.mode} file` : `a ${file.role} file`} needs a sha256, because a later run compares against it`));
      const bytes = statSync(p).size;
      if (file.bytes !== undefined && bytes !== file.bytes) out.push(f("STR-005", "error", ev.manifest.path, `${file.path}: ${bytes} bytes on disk, manifest says ${file.bytes}`));
      if (file.sha256 !== undefined && createHash("sha256").update(readFileSync(p)).digest("hex") !== file.sha256) out.push(f("STR-005", "error", ev.manifest.path, `${file.path}: sha256 differs from manifest`));
    }
  }
  for (const r of m.research) {
    if (r === "README.md") continue;
    if (!r.endsWith(".md")) { out.push(f("STR-006", "error", `.constitution/research/${r}`, "research deliverables are markdown; binaries and generated files live outside .constitution/")); continue; }
    const text = readText(m, `.constitution/research/${r}`);
    if (!/^---\n[\s\S]*?\bowner:/.test(text)) out.push(f("STR-006", "warning", `.constitution/research/${r}`, "research file has no front matter owner"));
  }
  return out;
};

// ---------- versions ----------
const semverKey = (v: string) => v.slice(1).split(".").map(Number);
const cmp = (a: string, b: string) => { const x = semverKey(a), y = semverKey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const versionCheck: Check = (m) => {
  const out: Finding[] = [];
  for (const s of STAGE_DIRS) {
    const cl = m.changelogs[s];
    const entries: any[] = cl?.data?.entries ?? [];
    if (!cl || entries.length === 0) continue;
    const oldest = entries[entries.length - 1]?.version;
    if (oldest !== "v0.0.1") out.push(f("VER-001", "error", cl.path, `oldest entry is ${oldest}; a directory starts at v0.0.1`, `/entries/${entries.length - 1}/version`));
    for (let i = 0; i + 1 < entries.length; i++) if (typeof entries[i].version === "string" && typeof entries[i + 1].version === "string" && cmp(entries[i].version, entries[i + 1].version) <= 0) out.push(f("VER-002", "error", cl.path, `${entries[i].version} is not newer than ${entries[i + 1].version}; entries are newest first and strictly increasing`, `/entries/${i}/version`));
    for (const [up, ver] of Object.entries(entries[0]?.upstream ?? {})) {
      const upEntries: any[] = (m.changelogs as any)[up]?.data?.entries ?? [];
      if (!upEntries.some((e) => e.version === ver)) { out.push(f("VER-003", "warning", cl.path, `upstream ${up} ${ver} does not exist in ${up}/changelog.yaml`, "/entries/0/upstream")); continue; }
      const current = upEntries[0]?.version;
      if (typeof ver !== "string" || typeof current !== "string") continue;
      const [a, b] = [semverKey(ver), semverKey(current)];
      if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) out.push(f("VER-004", "warning", cl.path, `written against ${up} ${ver}, but ${up} is now at ${current}; re-read the upstream change and record a new entry`, "/entries/0/upstream"));
    }
  }
  return out;
};

// ---------- certainty ----------
type Rec = { file: string; pointer: string; id: string; rec: any; internal: boolean; tag?: boolean };
export function collectRecords(m: Model): Rec[] {
  const recs: Rec[] = [];
  const push = (doc: { path: string; data: any } | null, key: string, idKey: string, internal: boolean) => {
    if (!doc) return;
    (doc.data?.[key] ?? []).forEach((r: any, i: number) => recs.push({ file: doc.path, pointer: `/${key}/${i}`, id: r?.[idKey] ?? `${key}[${i}]`, rec: r, internal }));
  };
  push(m.jobs, "jobs", "id", false);
  push(m.capabilities, "capabilities", "id", true);
  push(m.constraints, "constraints", "id", false);
  push(m.boundaries, "boundaries", "id", true);
  push(m.stack, "bill_of_materials", "name", false);
  m.flows.forEach((d) => recs.push({ file: d.path, pointer: "/", id: d.slug, rec: d.data, internal: true }));
  m.adrs.forEach((d) => recs.push({ file: d.path, pointer: "/", id: d.data?.id ?? d.path, rec: d.data, internal: false }));
  m.metas.forEach((d) => recs.push({ file: d.path, pointer: "/", id: d.data?.artifact_path || d.data?.artifact ? sidecarTarget(d) : d.path, rec: d.data, internal: true }));
  m.epics.forEach((e) => (e.data?.tickets ?? []).forEach((t: any, i: number) => recs.push({ file: e.path, pointer: `/tickets/${i}`, id: t?.id ?? `ticket[${i}]`, rec: t, internal: true, tag: true })));
  return recs;
}
const certaintyCheck: Check = (m) => {
  const out: Finding[] = [];
  const ods: any[] = m.openDecisions?.data?.decisions ?? [];
  const capCert = new Map<string, string>();
  (m.capabilities?.data?.capabilities ?? []).forEach((c: any) => capCert.set(c.id, c.certainty));
  const flowCaps = new Map<string, string[]>();
  m.flows.forEach((fl) => flowCaps.set(fl.slug, fl.data?.capabilities ?? []));
  for (const r of collectRecords(m)) {
    const c = r.rec?.certainty;
    if (!c || r.tag) continue;
    if (c === "settled" && !r.rec.evidence) out.push(f("CERT-001", "error", r.file, `${r.id} is settled without evidence`, r.pointer));
    if (c === "assumed" && !r.rec.assumption) out.push(f("CERT-001", "error", r.file, `${r.id} is assumed without an assumption stated`, r.pointer));
    if (c === "open" && !r.rec.decision) out.push(f("CERT-001", "error", r.file, `${r.id} is open without a decision id`, r.pointer));
    const ev = r.rec.evidence;
    if (ev?.kind === "repository" && !exists(m, ev.ref)) out.push(f("CERT-002", "warning", r.file, `${r.id}: evidence path ${ev.ref} no longer exists; certainty has decayed to assumed until re-verified`, r.pointer));
    if (ev?.kind === "spike" && !m.spikes.includes(`${ev.ref}.md`)) out.push(f("CERT-002", "warning", r.file, `${r.id}: spike ${ev.ref} not found under spikes/`, r.pointer));
    if (ev?.kind === "measurement" && !m.evidence.some((e) => e.dir === ev.ref || e.dir.endsWith(`/${ev.ref}`))) out.push(f("CERT-002", "warning", r.file, `${r.id}: measurement evidence ${ev.ref} not found under evidence/`, r.pointer));
    if (ev?.kind === "external" && r.internal) out.push(f("CERT-003", "error", r.file, `${r.id}: external evidence cannot settle a claim about this system`, r.pointer));
    if (r.rec.decision) {
      const od = ods.find((d) => d.id === r.rec.decision);
      if (!od) out.push(f("CERT-004", "error", r.file, `${r.id} references ${r.rec.decision}, which is not in the register`, r.pointer));
      else if (od.status === "closed") out.push(f("CERT-004", "warning", r.file, `${r.id} references ${r.rec.decision}, which is closed; apply the ruling and update certainty`, r.pointer));
    }
    if (r.file.startsWith(".constitution/tech-spec/stack.yaml") && ev?.version && r.rec.version && String(ev.version) !== String(r.rec.version)) out.push(f("CERT-006", "warning", r.file, `${r.id}: pinned ${r.rec.version} but evidence was checked at ${ev.version}; decayed`, r.pointer));
  }
  for (const meta of m.metas) {
    if (meta.data?.certainty !== "settled") continue;
    for (const slug of meta.data?.flows ?? []) for (const cap of flowCaps.get(slug) ?? []) if (capCert.get(cap) === "assumed") out.push(f("CERT-005", "info", meta.path, `${sidecarTarget(meta)} is settled while ${cap} (via flow ${slug}) is still assumed: downstream is more certain than upstream`));
  }
  return out;
};

// ---------- prd and architecture ----------
const prdCheck: Check = (m) => {
  const out: Finding[] = [];
  const jobs: any[] = m.jobs?.data?.jobs ?? [];
  const caps: any[] = m.capabilities?.data?.capabilities ?? [];
  const jobIds = new Set(jobs.map((j) => j.id));
  const coveredCaps = new Set<string>();
  const coveredJobs = new Set<string>();
  m.flows.forEach((fl) => { (fl.data?.capabilities ?? []).forEach((c: string) => coveredCaps.add(c)); if (fl.data?.job) coveredJobs.add(fl.data.job); });
  caps.forEach((c, i) => {
    if (m.present.architecture && c.priority === "P0" && !coveredCaps.has(c.id)) out.push(f("PRD-001", "error", m.capabilities!.path, `${c.id} is P0 and appears in no flow`, `/capabilities/${i}`));
    (c.jobs ?? []).forEach((j: string) => { if (!jobIds.has(j)) out.push(f("PRD-003", "error", m.capabilities!.path, `${c.id} cites unknown job ${j}`, `/capabilities/${i}/jobs`)); });
  });
  jobs.forEach((j, i) => { if (m.present.architecture && j.priority === "P0" && !coveredJobs.has(j.id)) out.push(f("PRD-002", "error", m.jobs!.path, `${j.id} is P0 and has no flow`, `/jobs/${i}`)); });
  const terms: any[] = m.glossary?.data?.terms ?? [];
  const canon = new Set(terms.map((t) => String(t.term).toLowerCase()));
  terms.forEach((t, i) => (t.do_not_use ?? []).forEach((s: string) => { if (canon.has(String(s).toLowerCase())) out.push(f("PRD-004", "error", m.glossary!.path, `"${s}" is banned under ${t.term} but is also a canonical term`, `/terms/${i}/do_not_use`)); }));
  return out;
};

// An entity is `NAME`, `"quoted name"`, or either with an `[alias]`. Relationship lines use Mermaid's symbolic
// cardinalities (`||--o{`, `}o..|{`); a line in another form is not parsed, so it can hide an entity but never
// invent one.
const ER_ENTITY = String.raw`("[^"]+"|[A-Za-z_][\w-]*)(?:\s*\[\s*"?([^\]"]*)"?\s*\])?`;
const ER_RELATION = new RegExp(`^${ER_ENTITY}\\s*[|}][|o](?:--|\\.\\.)[|o][|{]\\s*${ER_ENTITY}\\s*:`);
const ER_BLOCK = new RegExp(`^${ER_ENTITY}\\s*\\{`);
/** Entity names (with their aliases) of every erDiagram block in a markdown text; other Mermaid diagrams are skipped. */
export function erEntities(md: string): { name: string; alias?: string }[] {
  const out: { name: string; alias?: string }[] = [];
  for (const [, block] of md.matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```/gm)) {
    // The diagram kind is the first line that is not blank, a %% comment, or part of a --- config block.
    const lines = block.split("\n").map((l) => l.trim());
    let i = 0;
    const skip = () => { while (i < lines.length && (lines[i] === "" || lines[i].startsWith("%%"))) i++; };
    skip();
    if (lines[i] === "---") { i++; while (i < lines.length && lines[i] !== "---") i++; i++; skip(); }
    if (!/^erDiagram\b/.test(lines[i] ?? "")) continue;
    let inBlock = false;
    for (const line of lines.slice(i + 1)) {
      if (inBlock) { if (line.includes("}")) inBlock = false; continue; }
      const rel = ER_RELATION.exec(line);
      if (rel) { out.push({ name: rel[1], alias: rel[2] }, { name: rel[3], alias: rel[4] }); continue; }
      const blk = ER_BLOCK.exec(line);
      if (blk) { out.push({ name: blk[1], alias: blk[2] }); inBlock = !line.includes("}"); }
    }
  }
  return out;
}
const termKey = (s: string) => s.replace(/^"|"$/g, "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
const domainModelCheck: Check = (m) => {
  const out: Finding[] = [];
  const path = ".constitution/prd/domain-model.md";
  if (!m.glossary || !exists(m, path)) return out;
  const keys = new Set((m.glossary.data?.terms ?? []).map((t: any) => termKey(String(t?.term ?? ""))));
  // A plural entity resolves to its singular term and the other way round.
  const resolves = (s: string) => { const k = termKey(s); return !!k && (keys.has(k) || keys.has(`${k}s`) || (k.endsWith("s") && keys.has(k.slice(0, -1)))); };
  const seen = new Set<string>();
  for (const e of erEntities(readText(m, path))) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    if (!resolves(e.name) && !(e.alias && resolves(e.alias))) out.push(f("PRD-005", "warning", path, `erDiagram entity ${e.name} has no term in prd/glossary.yaml; add the term or rename the entity`));
  }
  return out;
};

// Conservative on purpose: whole words only, "ms" only lowercase after a number or on its own, singular "second"
// only after a number (so "the second release" is not a time), and a rate ("requests per second") is not a time.
const TIME_MEASURE = [/\b(?:milliseconds?|seconds|latency|duration|response time)\b|\d\s*second\b/i, /(?:\d\s*|\b)ms\b/];
const TIME_RATE = /\bper\s+(?:milli)?seconds?\b/gi;
const STATISTIC = /\bp\d{1,3}(?:\.\d+)?\b|\bpercentiles?\b|\bmedian\b|\bmean\b|\baverage\b|\bmax(?:imum)?\b|\bmin(?:imum)?\b|\bworst[- ]case\b/i;
const constraintStatCheck: Check = (m) => {
  const out: Finding[] = [];
  (m.constraints?.data?.constraints ?? []).forEach((c: any, i: number) => {
    const text = `${c?.scale ?? ""}\n${c?.meter ?? ""}`;
    const bare = text.replace(TIME_RATE, "");
    if (TIME_MEASURE.some((re) => re.test(bare)) && !STATISTIC.test(text)) out.push(f("PRD-006", "warning", m.constraints!.path, `${c.id} measures time but its scale and meter name no statistic (a percentile such as p95, median, mean, average, max, min, or worst case), so a goal on it cannot be checked`, `/constraints/${i}`));
  });
  return out;
};
const archCheck: Check = (m) => {
  const out: Finding[] = [];
  const capIds = new Set((m.capabilities?.data?.capabilities ?? []).map((c: any) => c.id));
  const jobIds = new Set((m.jobs?.data?.jobs ?? []).map((j: any) => j.id));
  const bnds: any[] = m.boundaries?.data?.boundaries ?? [];
  const bndIds = new Set(bnds.map((b) => b.id));
  for (const fl of m.flows) {
    if (fl.data?.job && !jobIds.has(fl.data.job)) out.push(f("ARC-001", "error", fl.path, `flow cites unknown job ${fl.data.job}`));
    for (const c of fl.data?.capabilities ?? []) if (!capIds.has(c)) out.push(f("ARC-001", "error", fl.path, `flow cites unknown capability ${c}`));
    for (const b of fl.data?.boundaries ?? []) if (!bndIds.has(b)) out.push(f("ARC-001", "error", fl.path, `flow cites unknown boundary ${b}`));
  }
  bnds.forEach((b, i) => (b.depends_on ?? []).forEach((d: string) => { if (/^BND-/.test(d) && !bndIds.has(d)) out.push(f("ARC-002", "error", m.boundaries!.path, `${b.id} depends on unknown boundary ${d}`, `/boundaries/${i}/depends_on`)); }));
  (m.boundaries?.data?.edges ?? []).forEach((e: any, i: number) => { for (const end of [e.from, e.to]) if (/^BND-/.test(end) && !bndIds.has(end)) out.push(f("ARC-002", "error", m.boundaries!.path, `edge cites unknown boundary ${end}`, `/edges/${i}`)); });
  const referenced = new Set<string>();
  m.metas.forEach((mt) => (mt.data?.flows ?? []).forEach((s: string) => referenced.add(s)));
  m.epics.forEach((e) => (e.data?.tickets ?? []).forEach((t: any) => (t.flows ?? []).forEach((s: string) => referenced.add(s))));
  if (m.present["tech-spec"] || m.present.tasks) {
    for (const fl of m.flows) if (!referenced.has(fl.slug)) out.push(f("ARC-003", "warning", fl.path, "no ticket or contract references this flow; a flow with no consumer is unread"));
  }
  return out;
};

// ---------- tech-spec ----------
/**
 * A markdown companion documents a sidecar's artifact (purpose, invariants, migration notes) and is not a raw artifact
 * itself, but only when a sidecar in the same directory names it in `companion`. A matching stem alone is not enough:
 * an undeleted legacy copy of an artifact that moved into the code looks exactly like a companion.
 */
function isCompanion(m: Model, raw: string): boolean {
  const dir = raw.slice(0, raw.lastIndexOf("/")); const name = raw.slice(raw.lastIndexOf("/") + 1);
  const metas = m.metas.filter((mt) => mt.dir === dir);
  // A legacy sidecar's own artifact is the raw artifact, even when a sidecar also names it as a companion.
  if (metas.some((mt) => mt.data?.artifact === name)) return false;
  return metas.some((mt) => mt.data?.companion === name);
}

/** A markdown file named like a sidecar in its directory (orders.md beside orders.meta.yaml, or a legacy artifact's stem). */
function sharesSidecarStem(m: Model, raw: string): boolean {
  const dir = raw.slice(0, raw.lastIndexOf("/")); const name = raw.slice(raw.lastIndexOf("/") + 1);
  if (!name.endsWith(".md")) return false;
  const stem = name.slice(0, -".md".length);
  return m.metas.some((mt) => mt.dir === dir && (mt.path.slice(mt.path.lastIndexOf("/") + 1).replace(/\.meta\.yaml$/, "") === stem || (typeof mt.data?.artifact === "string" && name.split(".")[0] === mt.data.artifact.split(".")[0])));
}
const techSpecCheck: Check = (m) => {
  const out: Finding[] = [];
  const g = m.guidelines;
  const activeTickets = new Set<string>();
  m.epics.filter((e) => e.active).forEach((e) => (e.data?.tickets ?? []).forEach((t: any) => activeTickets.add(t.id)));
  (g?.data?.verification_commands ?? []).forEach((vc: any, i: number) => {
    if (vc.exists === true && !commandResolves(m, vc.command)) out.push(f("TS-001", "error", g!.path, `verification command "${vc.command}" is marked as existing but does not resolve`, `/verification_commands/${i}`));
    if (m.present.tasks && vc.exists === false && vc.owner && !activeTickets.has(vc.owner)) out.push(f("TS-002", "error", g!.path, `command "${vc.command}" is owned by ${vc.owner}, which is not an active ticket`, `/verification_commands/${i}`));
    if (m.present.tasks && vc.exists === false && !vc.owner) out.push(f("TS-002", "error", g!.path, `command "${vc.command}" does not exist and has no owning ticket`, `/verification_commands/${i}`));
  });
  // Live-verification recipes follow the verification-command rules: commands of an existing recipe resolve,
  // and a recipe that does not exist yet has an active owner. A tool or manual drive is not a command.
  const recipeNames = new Set<string>();
  (g?.data?.live_verification ?? []).forEach((r: any, i: number) => {
    const p = `/live_verification/${i}`;
    if (recipeNames.has(r.name)) out.push(f("TS-012", "error", g!.path, `live-verification recipe name ${r.name} is declared twice`, p));
    recipeNames.add(r.name);
    const commands = [["launch", r.launch], ["doctor", r.doctor], ...(r.drive_kind === "command" ? [["drive", r.drive]] : []), ...(r.cleanup ? [["cleanup", r.cleanup]] : [])].filter(([, c]) => typeof c === "string");
    if (r.exists === true) for (const [step, c] of commands) if (!commandResolves(m, c)) out.push(f("TS-001", "error", g!.path, `recipe ${r.name} is marked as existing but its ${step} command "${c}" does not resolve`, p));
    if (m.present.tasks && r.exists === false && r.owner && !activeTickets.has(r.owner)) out.push(f("TS-002", "error", g!.path, `recipe ${r.name} is owned by ${r.owner}, which is not an active ticket`, p));
    if (m.present.tasks && r.exists === false && !r.owner) out.push(f("TS-002", "error", g!.path, `recipe ${r.name} does not exist yet and has no owning ticket`, p));
  });
  (g?.data?.layout ?? []).forEach((l: any, i: number) => { const there = exists(m, l.path); if (l.exists !== false && !there) out.push(f("TS-003", "warning", g!.path, `layout path ${l.path} does not exist yet; mark exists: false or create it`, `/layout/${i}`)); });
  (m.stack?.data?.bill_of_materials ?? []).forEach((b: any, i: number) => {
    // A lockfile may hold several versions of one package; a pin equal to any of them is locked.
    const locked = lockfileVersions(m, b.name, b.ecosystem);
    if (locked === undefined) return;
    if (!locked.length) out.push(f("TS-004", "warning", m.stack!.path, `${b.name} is not in the ${b.ecosystem} lockfile`, `/bill_of_materials/${i}`));
    else if (!locked.includes(String(b.version))) out.push(f("TS-004", "error", m.stack!.path, `${b.name} pinned ${b.version} but lockfile has ${locked.join(", ")}`, `/bill_of_materials/${i}`));
  });
  // A missing artifact is waiting on its creator: an active ticket still to be worked (planned, in_progress, or
  // blocked; not done and not deferred) that the sidecar names as owner or whose in-scope paths cover the artifact.
  // A deferred ticket has left the plan, so it creates nothing. Stage 3 writes sidecars before tickets exist and
  // Stage 4 cannot write tech-spec/, so scope coverage is how a plan claims an artifact without an owner field.
  const unfinished = new Map<string, string[]>();
  m.epics.filter((e) => e.active).forEach((e) => (e.data?.tickets ?? []).forEach((t: any) => { if (t?.id && t.status !== "done" && t.status !== "deferred") unfinished.set(t.id, Array.isArray(t.scope?.in) ? t.scope.in : []); }));
  const hasActiveCreator = (mt: Parameters<typeof sidecarTarget>[0]) => {
    if (typeof mt.data?.owner === "string" && unfinished.has(mt.data.owner)) return true;
    const target = String(sidecarTarget(mt)).replace(/^\.\//, "");
    return [...unfinished.values()].some((inScope) => inScope.some((s) => typeof s === "string" && overlaps(target, s.replace(/^\.\//, ""))));
  };
  const metaByDir = new Map<string, any[]>();
  m.metas.forEach((mt) => { const a = metaByDir.get(mt.dir) ?? []; a.push(mt); metaByDir.set(mt.dir, a); });
  for (const mt of m.metas) {
    const d = mt.data ?? {};
    const hasPath = typeof d.artifact_path === "string", hasLegacy = typeof d.artifact === "string";
    if (hasPath === hasLegacy) { out.push(f("TS-007", "error", mt.path, hasPath ? "sidecar sets both artifact_path and the legacy artifact; keep artifact_path only" : "sidecar names no artifact; set artifact_path to the artifact's place in the code")); continue; }
    if (hasLegacy) {
      if (!exists(m, sidecarTarget(mt))) out.push(f("TS-005", "error", mt.path, `sidecar names artifact ${d.artifact}, which is missing`));
      out.push(f("TS-008", "warning", mt.path, `${d.artifact} is a legacy artifact beside its sidecar: move it into the code and set artifact_path; update \`surfaces\` in constitution.yaml to cover the new path`));
      continue;
    }
    const target = String(d.artifact_path).replace(/^\.\//, "");
    if (target.startsWith("/") || target.split("/").includes("..")) { out.push(f("TS-007", "error", mt.path, `artifact_path ${d.artifact_path} must be relative to the repository root`, "/artifact_path")); continue; }
    if (target === ".constitution" || target.startsWith(".constitution/")) { out.push(f("TS-007", "error", mt.path, `artifact_path ${d.artifact_path} is inside .constitution/; the artifact lives in the code and the sidecar points at it`, "/artifact_path")); continue; }
    if (exists(m, target)) continue;
    // A planned artifact may be missing while its certainty admits it and, once tasks exist, an active ticket will create it.
    const planned = d.certainty === "assumed" || d.certainty === "open";
    if (!planned) out.push(f("TS-007", "error", mt.path, `artifact_path ${target} does not exist, and a ${d.certainty} sidecar describes an artifact that is there`, "/artifact_path"));
    else if (m.present.tasks && !hasActiveCreator(mt)) {
      if (d.owner) out.push(f("TS-007", "error", mt.path, `artifact_path ${target} does not exist, its owner ${d.owner} is not an active ticket that is still open, and no open ticket's scope.in covers the path`, "/owner"));
      else out.push(f("TS-007", "error", mt.path, `artifact_path ${target} does not exist and no active ticket will create it: no owner is set and no open ticket's scope.in covers the path`, "/artifact_path"));
    }
  }
  // Pinned artifacts cross epic boundaries inside a wave, so they must exist or be settled before tasks run against them.
  // An active, unfinished ticket creating it is the prescribed flow (the foundation epic lands it), so only a pinned
  // artifact nobody will create is an error.
  if (m.present.tasks) for (const mt of m.metas) if (mt.data?.pinned === true && mt.data?.certainty !== "settled" && !exists(m, sidecarTarget(mt)) && !hasActiveCreator(mt)) out.push(f("TS-009", "error", mt.path, `pinned artifact ${sidecarTarget(mt)} does not exist, the sidecar is not settled, and no active unfinished ticket creates it; plan it in the foundation epic before the wave that shares it`));
  for (const raw of m.rawArtifacts) {
    const dir = raw.slice(0, raw.lastIndexOf("/")); const name = raw.slice(raw.lastIndexOf("/") + 1);
    if ((metaByDir.get(dir) ?? []).some((mt) => mt.data?.artifact === name) || isCompanion(m, raw)) continue;
    if (sharesSidecarStem(m, raw)) out.push(f("TS-005", "warning", raw, "markdown named like a sidecar here, but no sidecar names it in `companion`: if this is the sidecar's companion, name it in `companion`; if it is a legacy copy of the artifact, delete it"));
    else out.push(f("TS-005", "warning", raw, "raw artifact has no .meta.yaml sidecar carrying its surface, flows, and certainty"));
  }
  const adrIds = new Set(m.adrs.map((a) => a.data?.id));
  for (const a of m.adrs) { if (a.data?.superseded_by && !adrIds.has(a.data.superseded_by)) out.push(f("TS-006", "error", a.path, `superseded_by ${a.data.superseded_by} does not exist`)); if (a.data?.status === "superseded" && !a.data?.superseded_by) out.push(f("TS-006", "error", a.path, "superseded without superseded_by")); }
  // Supersession links run both ways: A supersedes B exactly when B is superseded_by A.
  const adrById = new Map(m.adrs.map((a) => [a.data?.id, a]));
  for (const a of m.adrs) {
    for (const old of a.data?.supersedes ?? []) {
      const target = adrById.get(old);
      if (!target) out.push(f("TS-011", "error", a.path, `supersedes ${old}, which does not exist`, "/supersedes"));
      else if (target.data?.superseded_by !== a.data?.id) out.push(f("TS-011", "warning", target.path, `${a.data?.id} supersedes ${old}, but ${old} does not name it in superseded_by`));
    }
    const by = a.data?.superseded_by ? adrById.get(a.data.superseded_by) : undefined;
    if (by && !(by.data?.supersedes ?? []).includes(a.data?.id)) out.push(f("TS-011", "warning", by.path, `${a.data?.id} is superseded_by ${by.data?.id}, but ${by.data?.id} does not list it in supersedes`));
  }
  const flowSlugs = new Set(m.flows.map((fl) => fl.slug));
  const bndIds = new Set((m.boundaries?.data?.boundaries ?? []).map((b: any) => b.id));
  for (const mt of m.metas) {
    for (const s of mt.data?.flows ?? []) if (!flowSlugs.has(s)) out.push(f("TS-010", "error", mt.path, `sidecar cites unknown flow ${s}`, "/flows"));
    for (const b of mt.data?.boundaries ?? []) if (!bndIds.has(b)) out.push(f("TS-010", "error", mt.path, `sidecar cites unknown boundary ${b}`, "/boundaries"));
  }
  return out;
};

// ---------- tasks ----------
const TIME_RE = /\b\d+(?:\.\d+)?\s*(?:day|days|hour|hours|hr|hrs|week|weeks|month|months|sprint|sprints)\b|\b(?:due date|by end of|calendar week)\b/i;
function reach(graph: Map<string, string[]>, from: string, to: string): boolean {
  const seen = new Set<string>(); const stack = [from];
  while (stack.length) { const n = stack.pop()!; if (n === to) return true; if (seen.has(n)) continue; seen.add(n); for (const d of graph.get(n) ?? []) stack.push(d); }
  return false;
}
export function findCycle(graph: Map<string, string[]>): string[] | null {
  const state = new Map<string, number>(); const path: string[] = [];
  const visit = (n: string): string[] | null => {
    if (state.get(n) === 1) return [...path.slice(path.indexOf(n)), n];
    if (state.get(n) === 2) return null;
    state.set(n, 1); path.push(n);
    for (const d of graph.get(n) ?? []) { const c = visit(d); if (c) return c; }
    path.pop(); state.set(n, 2); return null;
  };
  for (const n of graph.keys()) { const c = visit(n); if (c) return c; }
  return null;
}
/** A completed epic whose planned estimate equals its measured diff exactly was almost certainly filled in from actuals. */
export function estimateLooksBackfilled(d: any): boolean {
  const source = d?.estimate_source ?? "planned";
  const actual = d?.closeout?.actuals?.diff_lines;
  return source === "planned" && typeof d?.estimated_diff_lines === "number" && typeof actual === "number" && d.estimated_diff_lines === actual;
}
const tasksCheck: Check = (m) => {
  const out: Finding[] = [];
  const acr = m.constitution?.data?.acronym;
  const guidelinesCmds = new Set((m.guidelines?.data?.verification_commands ?? []).map((v: any) => v.command));
  const recipes = new Set((m.guidelines?.data?.live_verification ?? []).map((r: any) => r.name));
  const flowSlugs = new Set(m.flows.map((fl) => fl.slug));
  const nfcIds = new Set((m.constraints?.data?.constraints ?? []).map((c: any) => c.id));
  const capIds = new Set((m.capabilities?.data?.capabilities ?? []).map((c: any) => c.id));
  const allEpicIds = new Set(m.epics.map((e) => e.data?.id));
  const ods: any[] = m.openDecisions?.data?.decisions ?? [];
  const epicGraph = new Map<string, string[]>();
  m.epics.forEach((e) => epicGraph.set(e.data?.id, e.data?.depends_on ?? []));
  const cyc = findCycle(epicGraph);
  if (cyc) out.push(f("TSK-003", "error", ".constitution/tasks/epics", `epic dependency cycle: ${cyc.join(" -> ")}`));
  let total8 = 0, totalTickets = 0;
  for (const e of m.epics) {
    const d = e.data ?? {}; const tickets: any[] = d.tickets ?? [];
    (d.depends_on ?? []).forEach((dep: string) => { if (!allEpicIds.has(dep)) out.push(f("TSK-003", "error", e.path, `depends on unknown epic ${dep}`, "/depends_on")); });
    (d.capabilities ?? []).forEach((c: string) => { if (!capIds.has(c)) out.push(f("TSK-003", "error", e.path, `cites unknown capability ${c}`, "/capabilities")); });
    if (d.kind === "out_of_band" && !d.source) out.push(f("TSK-013", "error", e.path, "out_of_band epic needs a source (issue or report)"));
    const ids = new Set(tickets.map((t) => t.id));
    const tgraph = new Map<string, string[]>();
    tickets.forEach((t, i) => {
      const p = `/tickets/${i}`;
      if (acr && d.id && !new RegExp(`^${acr}-${d.id}[0-9]{3}$`).test(String(t.id))) out.push(f("TSK-001", "error", e.path, `${t.id} must be ${acr}-${d.id}NNN`, p));
      tgraph.set(t.id, t.depends_on ?? []);
      (t.depends_on ?? []).forEach((dep: string) => { if (!ids.has(dep)) out.push(f("TSK-002", "error", e.path, `${t.id} depends on ${dep}, which is not in this epic; cross-epic needs are epic dependencies`, `${p}/depends_on`)); });
      const inScope: string[] = t.scope?.in ?? [];
      for (const s of inScope) {
        const okPath = (d.scope?.paths ?? []).some((root: string) => overlaps(s, root)) || (t.type === "Spike" && s.startsWith(".constitution/spikes"));
        if (!okPath) out.push(f("TSK-004", "error", e.path, `${t.id} scope ${s} is outside the epic's declared paths`, `${p}/scope/in`));
      }
      if (t.verification?.command && guidelinesCmds.size && !guidelinesCmds.has(t.verification.command)) out.push(f("TSK-005", "error", e.path, `${t.id} verification command "${t.verification.command}" is not quoted from guidelines`, `${p}/verification`));
      if (t.type === "Spike") {
        if (!t.spike) out.push(f("TSK-006", "error", e.path, `${t.id} is a Spike without a spike id`, p));
        else if (!m.spikes.includes(`${t.spike}.md`)) out.push(f("TSK-006", e.active ? "error" : "warning", e.path, `${t.id} points at ${t.spike}.md, which is missing under spikes/`, p));
        if (t.closes_decision && !ods.some((o) => o.id === t.closes_decision)) out.push(f("TSK-006", "error", e.path, `${t.id} closes ${t.closes_decision}, which is not in the register`, p));
      } else if (t.spike) out.push(f("TSK-006", "error", e.path, `${t.id} is not a Spike but carries a spike id`, p));
      if (t.spike && /^SPK-[A-Z]{2,6}-OD[0-9]{3}$/.test(t.spike)) out.push(f("TSK-006", "error", e.path, `${t.id} carries ${t.spike}, a decision-owned spike id that no ticket may own`, p));
      (t.flows ?? []).forEach((s: string) => { if (!flowSlugs.has(s)) out.push(f("TSK-007", "error", e.path, `${t.id} cites unknown flow ${s}`, `${p}/flows`)); });
      (t.acceptance?.constraints ?? []).forEach((c: string) => { if (!nfcIds.has(c)) out.push(f("TSK-008", "error", e.path, `${t.id} cites unknown constraint ${c}`, `${p}/acceptance`)); });
      if (["benchmark", "stat_threshold"].includes(t.acceptance?.mode) && !(t.acceptance?.constraints ?? []).length && nfcIds.size) out.push(f("TSK-008", "warning", e.path, `${t.id} is ${t.acceptance.mode} and cites no PRD constraint meter`, `${p}/acceptance`));
      const probes = t.acceptance?.mode === "live_probe" || (t.acceptance?.supplementary ?? []).includes("live_probe");
      const recipe = t.acceptance?.recipe;
      if (probes && !recipe) out.push(f("TSK-014", "error", e.path, `${t.id} is accepted by live_probe but names no recipe`, `${p}/acceptance`));
      else if (!probes && recipe) out.push(f("TSK-014", "error", e.path, `${t.id} names recipe ${recipe} but live_probe is not among its acceptance modes`, `${p}/acceptance`));
      else if (recipe && !recipes.has(recipe)) out.push(f("TSK-014", "error", e.path, `${t.id} runs recipe ${recipe}, which guidelines live_verification does not declare`, `${p}/acceptance/recipe`));
      if (t.status === "done") for (const ev of m.evidence) {
        const r = ev.manifest?.data;
        if (r?.owner === t.id && ["fail", "not_met"].includes(r.result)) out.push(f("TSK-018", e.active ? "error" : "warning", e.path, `${t.id} is done, but its evidence at ${ev.dir} records result ${r.result}; defer the ticket or produce passing evidence`, `${p}/status`));
      }
      const text = JSON.stringify([t.title, t.description, t.acceptance?.evidence, t.stop_conditions]);
      const tm = TIME_RE.exec(text); if (tm) out.push(f("TSK-010", "error", e.path, `${t.id} carries a time unit ("${tm[0]}"); estimates are points, never time`, p));
      if (e.active && t.status !== "done" && t.status !== "deferred") { totalTickets++; if (t.effort === 8) total8++; }
    });
    const tc = findCycle(tgraph); if (tc) out.push(f("TSK-002", "error", e.path, `ticket dependency cycle: ${tc.join(" -> ")}`));
    if (!e.active && !d.closeout) out.push(f("TSK-012", "error", e.path, "completed epic has no closeout"));
    if (d.closeout) {
      const done = new Set(tickets.filter((t) => t.status === "done").map((t) => t.id));
      (d.closeout.tickets_completed ?? []).forEach((id: string) => { if (!done.has(id)) out.push(f("TSK-012", "error", e.path, `closeout lists ${id} as completed but its status is not done`, "/closeout/tickets_completed")); });
      const sum = tickets.filter((t) => (d.closeout.tickets_completed ?? []).includes(t.id)).reduce((a, t) => a + (t.effort ?? 0), 0);
      if (sum !== d.closeout.points_completed) out.push(f("TSK-012", "error", e.path, `closeout says ${d.closeout.points_completed} points but completed tickets sum to ${sum}`, "/closeout/points_completed"));
      // Catch what reconcile would route after the merge while the branch can still fix it.
      if (e.active) {
        (d.closeout.settled ?? []).forEach((s: any, i: number) => { const why = s?.record ? recordProblem(m.cdir, s.record) : null; if (why) out.push(f("TSK-016", "error", e.path, `closeout settles ${s.record}, which reconcile cannot resolve: ${why}`, `/closeout/settled/${i}`)); });
        (d.closeout.spec_patches ?? []).forEach((sp: any, i: number) => { if (sp?.path && !exists(m, `.constitution/${String(sp.path).replace(/^\.constitution\//, "")}`) && !exists(m, sp.path)) out.push(f("TSK-016", "error", e.path, `closeout spec patch names ${sp.path}, which does not exist`, `/closeout/spec_patches/${i}`)); });
      }
    }
  }
  // Patchable entries name decision records (sidecars, ADRs, guidelines, stack); a raw artifact is code the epic owns by scope.
  const rawArtifacts = new Set(m.rawArtifacts.filter((raw) => !isCompanion(m, raw)));
  for (const e of m.epics.filter((x) => x.active)) (e.data?.scope?.tech_spec_patchable ?? []).forEach((p: string) => { if (rawArtifacts.has(`.constitution/${p.replace(/^\.constitution\//, "")}`)) out.push(f("TSK-017", "warning", e.path, `tech_spec_patchable names the raw artifact ${p}; patch its sidecar instead, and once the artifact moves into the code put its path in scope.paths`, "/scope/tech_spec_patchable")); });
  // Disjointness between active epics that can run concurrently (no dependency path either way).
  const active = m.epics.filter((e) => e.active && e.data?.id);
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i].data, b = active[j].data;
    if (reach(epicGraph, a.id, b.id) || reach(epicGraph, b.id, a.id)) continue;
    for (const pa of a.scope?.paths ?? []) for (const pb of b.scope?.paths ?? []) if (overlaps(pa, pb)) out.push(f("TSK-009", "error", active[i].path, `epics ${a.id} and ${b.id} can run concurrently but both own ${pa === pb ? pa : `${pa} / ${pb}`}`));
    const bare = (p: string) => p.replace(/^\.constitution\//, "");
    for (const pa of a.scope?.tech_spec_patchable ?? []) for (const pb of b.scope?.tech_spec_patchable ?? []) if (overlaps(bare(pa), bare(pb))) out.push(f("TSK-009", "error", active[i].path, `epics ${a.id} and ${b.id} can run concurrently but both may patch ${pa}`));
  }
  for (const s of m.spikes) { const tm = TIME_RE.exec(readText(m, `.constitution/spikes/${s}`)); if (tm) out.push(f("TSK-010", "error", `.constitution/spikes/${s}`, `spike carries a time unit ("${tm[0]}"); budgets are points`)); }
  if (totalTickets) { const share = Math.round((100 * total8) / totalTickets); out.push(f("INFO-EST", "info", ".constitution/tasks", `${share}% of open tickets are estimated at the ceiling of 8${share > 50 ? "; estimation has stopped discriminating" : ""}`)); }
  // Estimate hygiene: warnings at most, never errors. Calibration counts planned estimates only.
  for (const e of m.epics) {
    const d = e.data ?? {};
    if (e.active && d.estimated_diff_lines === undefined) out.push(f("TSK-015", "warning", e.path, "active epic has no estimated_diff_lines; estimate it before execution so calibration has something to compare"));
    if (!e.active && estimateLooksBackfilled(d)) out.push(f("TSK-015", "warning", e.path, `estimate ${d.estimated_diff_lines} equals the measured diff exactly, which suggests it was filled from actuals; if so, set estimate_source: backfilled (migrate --repair-estimates does this)`, "/estimated_diff_lines"));
  }
  const completed = m.epics.filter((e) => !e.active);
  if (m.present.tasks && completed.length) {
    const usable = completed.filter((e) => (e.data?.estimate_source ?? "planned") === "planned" && e.data?.estimated_diff_lines > 0 && typeof e.data?.closeout?.actuals?.diff_lines === "number" && !estimateLooksBackfilled(e.data));
    const est = usable.reduce((a, e) => a + e.data.estimated_diff_lines, 0);
    const act = usable.reduce((a, e) => a + e.data.closeout.actuals.diff_lines, 0);
    const excluded = completed.length - usable.length;
    out.push(f("INFO-CAL", "info", ".constitution/tasks", usable.length ? `calibration: actual/estimate = ${(act / est).toFixed(2)} over ${usable.length} completed epics; ${excluded} excluded` : `calibration: no completed epic has a planned estimate and actuals; ${excluded} excluded`));
  }
  return out;
};

// ---------- open decisions ----------
const odCheck: Check = (m) => {
  const out: Finding[] = [];
  const doc = m.openDecisions; if (!doc) return out;
  const ticketIds = new Set<string>(); m.epics.forEach((e) => (e.data?.tickets ?? []).forEach((t: any) => ticketIds.add(t.id)));
  (doc.data?.decisions ?? []).forEach((d: any, i: number) => {
    const p = `/decisions/${i}`;
    if (d.closure === "spike") { if (!d.spike) out.push(f("OD-001", "error", doc.path, `${d.id} closes by spike but names none`, p)); else if (d.status !== "closed" && !m.spikes.includes(`${d.spike}.md`) && !m.epics.some((e) => (e.data?.tickets ?? []).some((t: any) => t.spike === d.spike))) out.push(f("OD-001", "warning", doc.path, `${d.id}: spike ${d.spike} is neither planned as a ticket nor written`, p)); }
    if (d.closure === "ruling" && !d.ruler) out.push(f("OD-001", "error", doc.path, `${d.id} closes by ruling but names no ruler`, p));
    if (d.status === "closed" && !d.ruling) out.push(f("OD-002", "error", doc.path, `${d.id} is closed without a ruling reference`, p));
    if (d.status !== "closed" && d.ruling) out.push(f("OD-002", "error", doc.path, `${d.id} has a ruling but is not closed`, p));
    if (!(d.options ?? []).some((o: any) => o.name === d.recommendation)) out.push(f("OD-003", "error", doc.path, `${d.id}: recommendation "${d.recommendation}" is not one of the options`, p));
    for (const b of d.blocks ?? []) {
      if (/^[A-Z]{2,6}-[A-Z]{1,2}[0-9]{3}$/.test(b)) { if (!ticketIds.has(b)) out.push(f("OD-004", "warning", doc.path, `${d.id} blocks ${b}, which is not a known ticket`, p)); }
      else if (b.includes("#")) { if (!exists(m, `.constitution/${b.split("#")[0]}`) && !exists(m, b.split("#")[0])) out.push(f("OD-004", "warning", doc.path, `${d.id} blocks ${b}, whose file does not exist`, p)); }
      else if (/^EPIC-[A-Z]{1,2}$/.test(b)) { if (!m.epics.some((e) => `EPIC-${e.data?.id}` === b)) out.push(f("OD-004", "warning", doc.path, `${d.id} blocks ${b}, which is not a planned epic yet`, p)); }
      else if (!exists(m, b) && !exists(m, `.constitution/${b}`) && !/^[A-Z]{3}-[0-9]+$/.test(b)) out.push(f("OD-004", "warning", doc.path, `${d.id} blocks ${b}, which does not exist`, p));
    }
  });
  return out;
};

// ---------- glossary on surfaces ----------
const glossaryCheck: Check = (m) => {
  const out: Finding[] = [];
  const terms: any[] = m.glossary?.data?.terms ?? [];
  const surfaces: string[] = m.constitution?.data?.surfaces ?? [];
  if (!terms.length) return out;
  const banned = terms.flatMap((t) => (t.do_not_use ?? []).map((s: string) => ({ syn: s, term: t.term, re: new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "gi") })));
  const files = walkRepo(m, { includeConstitution: true }).filter((p) => !p.startsWith(".constitution/prd/glossary.yaml") && !p.startsWith(".constitution/reports/") && !p.startsWith(".constitution/research/") && !p.startsWith(".constitution/spikes/") && !p.startsWith(".constitution/tasks/completed/") && !p.endsWith(".meta.yaml") && !(p.startsWith(".constitution/") && p.endsWith(".yaml")));
  const tally = new Map<string, number>();
  for (const p of files) {
    let text: string; try { text = readText(m, p); } catch { continue; }
    if (text.slice(0, 512).includes(" ")) continue;
    const onSurface = matchesAny(p, surfaces);
    for (const b of banned) {
      const n = (text.match(b.re) ?? []).length; if (!n) continue;
      if (onSurface) out.push(f("GLS-001", "error", p, `"${b.syn}" appears ${n} time(s) on a domain-facing surface; the canonical term is ${b.term}`));
      else tally.set(b.term, (tally.get(b.term) ?? 0) + n);
    }
  }
  for (const [term, n] of tally) out.push(f("GLS-002", "info", ".constitution/prd/glossary.yaml", `banned synonyms for ${term} appear ${n} time(s) off-surface; general feedback only`));
  return out;
};

// A surface glob that matches nothing makes GLS-001 look like it covers something it does not. init scaffolds
// globs for later stages, so one under a stage directory that does not exist yet waits for that stage.
const surfacesCheck: Check = (m) => {
  const out: Finding[] = [];
  const surfaces: unknown[] = m.constitution?.data?.surfaces ?? [];
  if (!Array.isArray(surfaces) || !surfaces.length) return out;
  const files = walkRepo(m, { includeConstitution: true });
  surfaces.forEach((g, i) => {
    if (typeof g !== "string") return;
    const stage = /^\.constitution\/([^/]+)\//.exec(g)?.[1];
    if (stage && isStageId(stage) && !exists(m, `.constitution/${stage}`)) return;
    // Matched exactly as GLS-001 matches it, so a glob GLS-001 can never hit is reported here.
    if (!files.some((p) => matchesAny(p, [g]))) out.push(f("GLS-003", "warning", m.constitution!.path, `surface ${g} matches no file in the repository, so no banned synonym is checked there; fix the glob or remove it`, `/surfaces/${i}`));
  });
  return out;
};

// ---------- cross-references in prose ----------
// Stage prose may name ADRs and register entries by id; a dangling id is a broken promise a reviewer
// would otherwise have to catch by hand.
const xrefCheck: Check = (m) => {
  const out: Finding[] = [];
  const adrIds = new Set(m.adrs.map((a) => a.data?.id));
  const odIds = new Set((m.openDecisions?.data?.decisions ?? []).map((d: any) => d.id));
  const files = walkRepo(m, { includeConstitution: true }).filter((p) => /^\.constitution\/(prd|architecture|tech-spec)\/.+\.md$/.test(p));
  for (const p of files) {
    let text: string; try { text = readText(m, p); } catch { continue; }
    // Front matter ids are schema fields with their own checks (TS-006, TS-011, CERT-004); only the prose counts here.
    if (text.startsWith("---\n")) { const end = text.indexOf("\n---", 4); if (end !== -1) text = text.slice(end + 4); }
    const missing = new Set<string>();
    for (const [id] of text.matchAll(/\bADR-[0-9]{4}\b/g)) if (!adrIds.has(id)) missing.add(id);
    for (const [id] of text.matchAll(/\bOD-[0-9]{2,3}\b/g)) if (!odIds.has(id)) missing.add(id);
    for (const id of missing) out.push(f("XR-001", "error", p, `names ${id}, which does not exist${id.startsWith("OD-") ? " in the register" : " under tech-spec/adrs/"}`));
  }
  return out;
};

// ---------- summary info ----------
const summaryCheck: Check = (m) => {
  const out: Finding[] = [];
  const byDir = new Map<string, Record<string, number>>();
  for (const r of collectRecords(m)) {
    const dir = r.file.split("/")[1] ?? "?"; const c = r.rec?.certainty; if (!c) continue;
    const t = byDir.get(dir) ?? { settled: 0, assumed: 0, open: 0 }; t[c] = (t[c] ?? 0) + 1; byDir.set(dir, t);
  }
  const stages = STAGE_DIRS.filter((s) => m.present[s]);
  out.push(f("INFO-SHAPE", "info", ".constitution", stages.length ? `stages present: ${stages.join(", ")}` : "no stage directories yet"));
  for (const [dir, t] of byDir) out.push(f("INFO-CERT", "info", `.constitution/${dir}`, `certainty: ${t.settled} settled, ${t.assumed} assumed, ${t.open} open`));
  if (m.present.tasks) {
    const active = m.epics.filter((e) => e.active);
    const points = active.reduce((a, e) => a + (e.data?.tickets ?? []).filter((t: any) => t.status !== "done" && t.status !== "deferred").reduce((b: number, t: any) => b + (t.effort ?? 0), 0), 0);
    const oob = active.filter((e) => e.data?.kind === "out_of_band").length;
    out.push(f("INFO-PLAN", "info", ".constitution/tasks", `${active.length} active epic(s) (${oob} out of band), ${points} open points`));
  }
  return out;
};

export const CHECKS: Check[] = [schemaCheck, structureCheck, versionCheck, certaintyCheck, prdCheck, domainModelCheck, constraintStatCheck, archCheck, techSpecCheck, tasksCheck, odCheck, glossaryCheck, surfacesCheck, xrefCheck, summaryCheck];

export function runChecks(m: Model, ctx: Ctx): Finding[] {
  const findings = [...m.findings];
  for (const c of CHECKS) findings.push(...c(m, ctx));
  const exceptions: any[] = m.constitution?.data?.exceptions ?? [];
  return findings.map((x) => {
    const ex = exceptions.find((e) => e.rule === x.id);
    return ex && x.severity !== "info" ? { ...x, severity: "info" as Severity, message: `${x.message} (excepted: ${ex.reason})` } : x;
  });
}
