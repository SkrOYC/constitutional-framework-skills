// Converts a markdown constitution (the old skill templates) into the structured layout.
// Deterministic where the old templates were regular; everything it cannot fill is listed in the report.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { toBlockYaml } from "./yaml.ts";
import { estimateLooksBackfilled, findCycle, isInterviewRecord } from "./checks.ts";
import { RESEARCH_README } from "./init.ts";
import { loadModel } from "./model.ts";

type Report = { moved: string[]; written: string[]; deleted: string[]; todo: string[]; notes: string[] };

const read = (p: string) => readFileSync(p, "utf8");
const has = (p: string) => existsSync(p);
const list = (dir: string, ext = ".md") => (has(dir) ? readdirSync(dir).filter((n) => n.endsWith(ext) && statSync(join(dir, n)).isFile()).sort() : []);
const strip = (s: string) => s.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
const sentence = (s: string) => strip(s).replace(/\.$/, "");

function sections(md: string, level = 2): { title: string; body: string }[] {
  const re = new RegExp(`^#{${level}} (.+)$`, "gm");
  const out: { title: string; body: string }[] = [];
  const idx: { title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) idx.push({ title: m[1].trim(), start: m.index, end: m.index + m[0].length });
  idx.forEach((s, i) => out.push({ title: s.title, body: md.slice(s.end, idx[i + 1]?.start ?? md.length).trim() }));
  return out;
}
function bulletField(block: string, name: string): string | null {
  const m = new RegExp(`^- \\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:?\\*\\*:?\\s*([\\s\\S]*?)(?=^- \\*\\*|^#|\\n\\n|$(?![\\r\\n]))`, "m").exec(block);
  return m ? m[1].trim() : null;
}
function labelField(block: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\n)\\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:?\\*\\*:?\\s*([^\\n]+)`).exec(block);
  return m ? m[1].trim() : null;
}
function headerCols(row: string[], spec: Record<string, RegExp>): Record<string, number> | null {
  if (row.some((x) => /\d{2,}/.test(x))) return null;
  const hdr = row.map((x) => x.toLowerCase());
  const out: Record<string, number> = {};
  for (const [k, re] of Object.entries(spec)) out[k] = hdr.findIndex((h) => re.test(h));
  return Object.values(out).filter((i) => i >= 0).length >= 2 ? out : null;
}
function tableRows(md: string): string[][] {
  return md.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*:?-+/.test(l)).map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
}
function backticked(s: string): string[] { return [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]); }
// A path item is the first backticked span or the text before a parenthetical; prose (anything with whitespace) is not a path.
function pathsOf(items: string[]): string[] { return items.map((s) => backticked(s)[0] ?? s.replace(/\s*\(.*$/, "")).map((s) => s.replace(/\/$/, "")).filter((s) => s && !/\s/.test(s) && s !== "TODO"); }
function gitOut(root: string, args: string[]): string { try { const r = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" }); return r.exitCode === 0 ? new TextDecoder().decode(r.stdout).trim() : ""; } catch { return ""; } }
function today(): string { return new Date().toISOString().slice(0, 10); }

export function migrate(root: string, opts: { date?: string } = {}): Report {
  const c = join(root, ".constitution");
  if (!has(c)) throw new Error(`${c} does not exist`);
  if (has(join(c, "constitution.yaml"))) throw new Error("constitution.yaml already exists; this constitution looks migrated");
  const date = opts.date ?? today();
  const R: Report = { moved: [], written: [], deleted: [], todo: [], notes: [] };
  const rel = (p: string) => relative(root, p);
  const writeYaml = (p: string, data: unknown) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, toBlockYaml(data) + "\n"); R.written.push(rel(p)); };
  const writeText = (p: string, text: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text.endsWith("\n") ? text : text + "\n"); R.written.push(rel(p)); };
  const del = (p: string) => { if (has(p)) { rmSync(p, { recursive: true }); R.deleted.push(rel(p)); } };
  const move = (from: string, to: string) => { mkdirSync(dirname(to), { recursive: true }); renameSync(from, to); R.moved.push(`${rel(from)} -> ${rel(to)}`); };
  const todo = (s: string) => R.todo.push(s);

  // ---------- acronym, archetype, constitution.yaml ----------
  const epicFiles = [...list(join(c, "tasks/active")).map((n) => join(c, "tasks/active", n)), ...list(join(c, "tasks/completed")).map((n) => join(c, "tasks/completed", n))];
  const acrCounts = new Map<string, number>();
  for (const p of epicFiles) for (const m of read(p).matchAll(/^#### ([A-Z]{2,6})-[A-Z]{1,2}[0-9]{3}\b/gm)) acrCounts.set(m[1], (acrCounts.get(m[1]) ?? 0) + 1);
  const acronym = [...acrCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "TODO";
  if (acronym === "TODO") todo("constitution.yaml: no ticket ids found; set acronym by hand");
  const vision = has(join(c, "prd/vision.md")) ? read(join(c, "prd/vision.md")) : "";
  const archSec = sections(vision).find((s) => /archetype/i.test(s.title))?.body ?? "";
  const pick = (name: string) => { const m = new RegExp(`\\*\\*${name}:\\*\\*\\s*\`?([^\`\\n—-]+)`).exec(archSec); return m ? m[1].trim() : null; };
  const ARCH = ["Web/Cloud", "CLI/Tooling", "Library/SDK", "System/Native", "ML/Data", "Embedded/IoT", "Mobile", "Web3", "Game/Sim", "IaC/Platform", "Other"];
  const norm = (s: string | null) => ARCH.find((a) => s && s.toLowerCase().replace(/\s/g, "").includes(a.toLowerCase().replace(/\s/g, ""))) ?? null;
  const primary = norm(pick("Primary")) ?? "Other";
  if (primary === "Other" && !pick("Primary")) todo("constitution.yaml: archetype.primary not found in vision.md; set it");
  const secondaryRaw = /\*\*Secondary:\*\*([\s\S]*?)(?=\*\*Confidence|\*\*Rationale|$)/.exec(archSec)?.[1] ?? "";
  const secondary = ARCH.filter((a) => a !== "Other" && a !== primary && secondaryRaw.toLowerCase().replace(/\s/g, "").includes(a.toLowerCase().replace(/\s/g, "")));
  const confidence = (/\*\*Confidence:\*\*\s*(high|medium|low)/i.exec(archSec)?.[1] ?? "low").toLowerCase();
  const rationale = sentence(/\*\*Rationale:\*\*\s*([^\n]+)/.exec(archSec)?.[1] ?? "Migrated; rationale not found in vision.md.");
  let defaultBranch = gitOut(root, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "");
  if (!defaultBranch) for (const b of ["main", "master"]) if (gitOut(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`])) { defaultBranch = b; break; }
  if (!defaultBranch) { defaultBranch = "main"; todo("constitution.yaml: default_branch could not be read from git and defaulted to main; confirm it"); }
  const lockfiles = ["Cargo.lock", "bun.lock", "package-lock.json", "pubspec.lock", "flake.lock"].filter((l) => has(join(root, l)));
  writeYaml(join(c, "constitution.yaml"), {
    schema_version: 1, acronym,
    archetype: { primary, secondary, confidence, rationale, ...(primary === "Other" ? { other_justification: "Set during migration; revise." } : {}) },
    surfaces: [".constitution/tech-spec/contracts/**", ".constitution/tech-spec/data-models/**"],
    diff_exclusions: [...lockfiles.map((l) => `**/${l}`), "**/*.snap"],
    default_branch: defaultBranch,
  });
  todo("constitution.yaml: review surfaces (add source paths that are domain-facing: public API, schemas, migrations, UI copy)");

  // ---------- changelogs ----------
  const changelog = (dir: string, upstreamOf: string[]) => {
    const p = join(c, dir, "changelog.md");
    const entries: any[] = [];
    if (has(p)) {
      const md = read(p);
      for (const s of sections(md)) {
        const vm = /^\[?v?(\d+\.\d+\.\d+)\]?/.exec(s.title);
        if (!vm) continue;
        const dm = /(\d{4}-\d{2}-\d{2})/.exec(s.title) ?? /(\d{4}-\d{2}-\d{2})/.exec(s.body);
        const entry: any = { version: `v${vm[1]}`, date: dm?.[1] ?? date };
        const groups = sections(s.body, 3);
        const preamble = s.body.slice(0, groups.length ? s.body.indexOf("### ") : undefined).trim();
        if (preamble) entry.changed = [sentence(preamble.split("\n\n")[0])];
        for (const g of groups) {
          const key = g.title.toLowerCase();
          if (!["added", "changed", "deprecated", "removed", "fixed", "security"].includes(key)) continue;
          const items = g.body.split("\n").filter((l) => /^- /.test(l)).map((l) => sentence(l.replace(/^- /, "")));
          if (items.length) entry[key] = [...(entry[key] ?? []), ...items];
        }
        entries.push(entry);
      }
      if (!entries.length) {
        const bulletBlocks = md.split(/\n(?=- \[?v?\d+\.\d+\.\d+)/).filter((b) => /^- \[?v?\d+\.\d+\.\d+\]?/.test(b.trim()));
        for (const b of bulletBlocks) {
          const vm = /^- \[?v?(\d+\.\d+\.\d+)\]?/.exec(b.trim());
          if (!vm) continue;
          const dm = /(\d{4}-\d{2}-\d{2})/.exec(b);
          const body = b.trim().replace(/^- \[?v?\d+\.\d+\.\d+\]?\s*(?:\([^)]*\))?\s*[-–—:]*\s*/, "").trim();
          if (body) {
            entries.push({
              version: `v${vm[1]}`,
              date: dm?.[1] ?? date,
              changed: [sentence(body.split("\n\n")[0])],
            });
          }
        }
      }
    }
    entries.sort((a, b) => cmpVer(b.version, a.version));
    if (!entries.length || entries[entries.length - 1].version !== "v0.0.1") {
      entries.push({ version: "v0.0.1", date: entries[entries.length - 1]?.date ?? date, added: ["History before migration; the markdown changelog is in git"], by: "migrate" });
    }
    entries[0].by = entries[0].by ?? "migrate";
    if (upstreamOf.length) entries[0].upstream = Object.fromEntries(upstreamOf.map((u) => [u, currentVersion(u)]));
    writeYaml(join(c, dir, "changelog.yaml"), { entries });
    del(p);
    versions.set(dir, entries[0].version);
  };
  const versions = new Map<string, string>();
  const currentVersion = (dir: string) => versions.get(dir) ?? "v0.0.1";
  const cmpVer = (a: string, b: string) => { const x = a.slice(1).split(".").map(Number), y = b.slice(1).split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  changelog("prd", []);
  changelog("architecture", ["prd"]);
  changelog("tech-spec", ["prd", "architecture"]);
  changelog("tasks", ["prd", "architecture", "tech-spec"]);

  // ---------- PRD: jobs, capabilities, constraints, glossary, out-of-scope ----------
  const jobs: any[] = [];
  const jtbd = sections(vision).find((s) => /jobs to be done|jtbd/i.test(s.title))?.body ?? "";
  const actorsMd = has(join(c, "prd/actors.md")) ? read(join(c, "prd/actors.md")) : "";
  const primaryActor = (sections(actorsMd)[0]?.title ?? "").replace(/\(.*\)/, "").replace(/^.*?:\s*(the\s+)?/i, "").trim() || "Primary actor";
  jtbd.split("\n").filter((l) => /^\d+\.\s/.test(l)).forEach((l, i) => jobs.push({ id: `JOB-${String(i + 1).padStart(2, "0")}`, legacy_id: `JTBD ${i + 1}`, actor: primaryActor, statement: sentence(l.replace(/^\d+\.\s*/, "")), priority: "P0", certainty: "assumed", assumption: "Migrated from vision.md; priority defaulted to P0 and actor to the first actor listed. Confirm both." }));
  if (!jobs.length) jtbd.split("\n").filter((l) => /^- \*\*[^*]+:\*\*\s*\S/.test(l)).forEach((l, i) => jobs.push({ id: `JOB-${String(i + 1).padStart(2, "0")}`, legacy_id: `JTBD ${i + 1}`, actor: primaryActor, statement: sentence(l.replace(/^- /, "")), priority: "P0", certainty: "assumed", assumption: "Migrated from vision.md; priority and actor defaulted." }));
  if (!jobs.length) jtbd.split("\n").filter((l) => /^- \S/.test(l)).forEach((l, i) => jobs.push({ id: `JOB-${String(i + 1).padStart(2, "0")}`, legacy_id: `JTBD ${i + 1}`, actor: primaryActor, statement: sentence(l.replace(/^- /, "")), priority: "P0", certainty: "assumed", assumption: "Migrated from vision.md; priority and actor defaulted." }));
  if (!jobs.length) todo("prd/jobs.yaml: no numbered jobs-to-be-done list found in vision.md; write the jobs");
  else todo(`prd/jobs.yaml: ${jobs.length} jobs migrated with priority P0 and actor "${primaryActor}"; confirm each`);
  writeYaml(join(c, "prd/jobs.yaml"), { jobs });

  const caps: any[] = [];
  const capMap = new Map<string, string>();
  const capsMd = has(join(c, "prd/capabilities.md")) ? read(join(c, "prd/capabilities.md")) : "";
  for (const sec of sections(capsMd)) {
    const group = sentence(sec.title.replace(/^Epic\s+\w+\s+[—-]\s*/i, ""));
    for (const line of sec.body.split("\n")) {
      const m = /^- \*\*(P[012])\s*[·•]\s*([A-Za-z0-9.]+)\s*[—-]\s*(.+?)\.?\*\*\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, priority, legacy, title, rest] = m;
      const rat = /\*Rationale:\s*([\s\S]*?)\*\s*$/.exec(rest);
      const statement = sentence(rat ? rest.slice(0, rat.index) : rest) || title;
      const rationale = rat ? sentence(rat[1]) : "Migrated; rationale not stated";
      const jobRefs = [...(rat?.[1] ?? "").matchAll(/JTBD\s*(\d+)/g)].map((x) => `JOB-${x[1].padStart(2, "0")}`).filter((j) => jobs.some((jj) => jj.id === j));
      const id = `CAP-${String(caps.length + 1).padStart(3, "0")}`;
      capMap.set(legacy, id);
      caps.push({ id, legacy_id: legacy, group, priority, statement, rationale, jobs: [...new Set(jobRefs)], certainty: "assumed", assumption: "Migrated from capabilities.md; not yet confirmed against code or a ruling." });
    }
  }
  const pushCap = (legacy: string, group: string, priority: string, stmt: string, rationale: string) => {
    if (!legacy || !stmt || capMap.has(legacy)) return;
    const jobRefs = [...rationale.matchAll(/JTBD\s*(\d+)/g)].map((x) => `JOB-${x[1].padStart(2, "0")}`).filter((j) => jobs.some((jj) => jj.id === j));
    const id = `CAP-${String(caps.length + 1).padStart(3, "0")}`;
    capMap.set(legacy, id);
    caps.push({ id, legacy_id: legacy, group, priority, statement: sentence(stmt), rationale: sentence(rationale) || "Migrated; rationale not stated", jobs: [...new Set(jobRefs)], certainty: "assumed", assumption: "Migrated from capabilities.md; not yet confirmed against code or a ruling." });
  };
  for (const sec of sections(capsMd)) {
    let cols: Record<string, number> | null = null;
    for (const row of tableRows(sec.body)) {
      const h = headerCols(row, { id: /^(capability id|id)$/, priority: /^priority$/, stmt: /^(capability|statement|requirement|delivered outcome|outcome|description)$/, rat: /^(rationale|why|reason)$/ });
      if (h) { cols = h; continue; }
      if (!cols || cols.id < 0 || cols.stmt < 0) continue;
      pushCap(strip(row[cols.id] ?? ""), sentence(sec.title), /P[012]/.exec(row[cols.priority] ?? "")?.[0] ?? "P1", row[cols.stmt] ?? "", cols.rat >= 0 ? row[cols.rat] ?? "" : "");
    }
  }
  for (const grp of sections(capsMd)) for (const sec of sections(`## x\n${grp.body}`, 3)) {
    const tm = /^([A-Z][A-Z0-9-]*\d)\s*[:—-]\s*(.+)$/.exec(sec.title);
    const stmt = bulletField(sec.body, "Capability") ?? bulletField(sec.body, "Statement");
    if (!tm || !stmt) continue;
    pushCap(tm[1], sentence(grp.title.replace(/^Epic\s*(?:[A-Z0-9.]+\s*)?[:—-]\s*/i, "")), /P[012]/.exec(bulletField(sec.body, "Priority") ?? "")?.[0] ?? "P1", stmt, bulletField(sec.body, "Rationale") ?? "");
  }
  for (const sec of sections(capsMd)) {
    const group = sentence(sec.title.replace(/^Epic\s*(?:[A-Z0-9.]+\s*)?[:—-]\s*/i, ""));
    for (const chunk of sec.body.split(/\n\s*\n/)) {
      const legacy = strip(bulletField(chunk, "Capability ID") ?? bulletField(chunk, "ID") ?? "");
      const stmt = bulletField(chunk, "Capability") ?? bulletField(chunk, "Statement");
      if (!legacy || !stmt) continue;
      pushCap(legacy, group, /P[012]/.exec(bulletField(chunk, "Priority") ?? "")?.[0] ?? "P1", stmt, bulletField(chunk, "Rationale") ?? "");
    }
  }
  const noJob = caps.filter((x) => !x.jobs.length).length;
  if (!caps.length) todo("prd/capabilities.yaml: no capability bullets recognized; write them");
  if (noJob) todo(`prd/capabilities.yaml: ${noJob} capabilities cite no job; every capability needs at least one JOB id`);
  writeYaml(join(c, "prd/capabilities.yaml"), { capabilities: caps });
  del(join(c, "prd/capabilities.md"));

  const cons: any[] = [];
  const consMd = has(join(c, "prd/constraints.md")) ? read(join(c, "prd/constraints.md")) : "";
  const classOf = (t: string) => { const k = t.toLowerCase(); for (const [key, cls] of [["perf", "performance"], ["latency", "performance"], ["reliab", "reliability"], ["secur", "security"], ["privacy", "privacy"], ["operab", "operability"], ["support", "operability"], ["compat", "compatibility"], ["stabil", "compatibility"], ["cost", "cost"]] as const) if (k.includes(key)) return cls; return "archetype"; };
  for (const sec of sections(consMd)) for (const raw of sec.body.split(/\n(?=- \*\*)/)) {
    const block = raw.replace(/\n\s+- \*\*/g, " **");
    const m = /^- \*\*(?:([A-Za-z]+-\d+)\s*[\u2014:-]\s*)?(.+?):?\.?(?:\s*\[[^\]]+\])*\*\*:?\s*([\s\S]*)$/.exec(block);
    if (!m) continue;
    const title = m[2]; const rest = m[3];
    const legacy = m[1] ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tags = [...(block.split("**")[1] ?? "").matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
    const noteM = /\*([^*\n]+)\*\s*$/.exec(rest); const note = noteM && !/^(?:Scale|Meter|Goal|Stretch|Fail|Note):/.test(noteM[1].trim()) ? sentence(noteM[1]) : "";
    const assumption = ["Migrated target; not yet measured.", tags.length ? `Flags: ${tags.join(", ")}.` : "", note ? `${note}.` : ""].filter(Boolean).join(" ");
    if (!m[1] && !/\b(?:Scale|Meter|Goal|Fail):/.test(rest)) continue;
    const field = (n: string) => { const x = new RegExp("\\b" + n + ":\\**\\s*([\\s\\S]*?)(?=\\s*\\**\\s*\\b(?:Scale|Meter|Goal|Stretch|Fail|Note):|\\**\\s*$)").exec(rest); return x ? sentence(x[1]) : null; };
    const id = `NFC-${String(cons.length + 1).padStart(2, "0")}`;
    const meterOnly = !field("Scale") && !field("Goal") && field("Meter");
    const lead = sentence(rest.replace(/\**\s*\b(?:Scale|Meter|Goal|Stretch|Fail|Note):[\s\S]*$/, ""));
    cons.push({ id, legacy_id: legacy, class: classOf(sec.title), statement: lead ? `${sentence(title)}: ${lead}` : sentence(title), scale: field("Scale") ?? (meterOnly ? "binary: the duty holds or it does not" : "TODO"), meter: field("Meter") ?? "TODO", goal: field("Goal") ?? (meterOnly ? "holds" : "TODO"), ...(field("Stretch") ? { stretch: field("Stretch") } : {}), fail: field("Fail") ?? (meterOnly ? "any violation" : "TODO"), certainty: "assumed", assumption });
  }
  for (const grp of sections(consMd)) for (const sec of sections(`## x\n${grp.body}`, 3)) {
    const field = (n: string) => { const v = bulletField(sec.body, n); return v ? sentence(v) : null; };
    if (!field("Meter") && !field("Scale")) continue;
    if (cons.some((x) => x.statement === sentence(sec.title))) continue;
    const id = `NFC-${String(cons.length + 1).padStart(2, "0")}`;
    cons.push({ id, legacy_id: sec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), class: classOf(`${grp.title} ${sec.title}`), statement: sentence(sec.title), scale: field("Scale") ?? "TODO", meter: field("Meter") ?? "TODO", goal: field("Goal") ?? "TODO", ...(field("Stretch") ? { stretch: field("Stretch") } : {}), fail: field("Fail") ?? "TODO", certainty: "assumed", assumption: "Migrated target; not yet measured." });
  }
  if (cons.some((x) => [x.scale, x.meter, x.goal, x.fail].includes("TODO"))) todo("prd/constraints.yaml: some constraints have TODO in scale, meter, goal, or fail; fill them from the original prose");
  writeYaml(join(c, "prd/constraints.yaml"), { constraints: cons, deferred: [] });
  del(join(c, "prd/constraints.md"));

  const terms: any[] = [];
  const glossMd = has(join(c, "prd/glossary.md")) ? read(join(c, "prd/glossary.md")) : "";
  for (const row of tableRows(glossMd)) {
    if (row.length < 2 || /^term$/i.test(row[0])) continue;
    const dnu = (row[2] ?? "").split(/,\s*/).map((s) => strip(s)).filter((s) => s && !/^[—-]$/.test(s) && !/^none$/i.test(s));
    terms.push({ term: strip(row[0]), definition: sentence(row[1]) || "TODO", do_not_use: dnu });
  }
  if (!terms.length) todo("prd/glossary.yaml: no glossary table found; write the terms");
  writeYaml(join(c, "prd/glossary.yaml"), { terms });
  del(join(c, "prd/glossary.md"));
  todo("prd/glossary.yaml: review do_not_use lists; remove generic English and technical words (the checker greps these on surfaces)");

  for (const n of list(join(c, "prd/out-of-scope"))) {
    const p = join(c, "prd/out-of-scope", n); const md = read(p);
    if (md.startsWith("---\n")) continue;
    const status = /\*\*(?:Status|Decision):\*\*\s*(rejected|deferred)/i.exec(md)?.[1]?.toLowerCase() ?? (/^# Rejected|\*\*Rejected\b/im.test(md) ? "rejected" : "deferred");
    const d = /(\d{4}-\d{2}-\d{2})/.exec(md)?.[1] ?? date;
    const origin = /\*\*Origin:\*\*\s*([^\n]+)/.exec(md)?.[1];
    writeText(p, `---\ndecision: ${status}\ndate: "${d}"\n${origin ? `ruling: ${JSON.stringify(sentence(origin))}\n` : ""}---\n${md}`);
  }

  // ---------- architecture: boundaries, flows ----------
  const bnds: any[] = [];
  const bndByName = new Map<string, string>();
  const contMd = has(join(c, "architecture/containers.md")) ? read(join(c, "architecture/containers.md")) : "";
  const kindOf = (t: string | null) => { const k = (t ?? "").toLowerCase(); if (k.includes("process") && !k.includes("in-process")) return "process"; if (k.includes("container")) return "container"; if (k.includes("pipeline") || k.includes("stage")) return "pipeline-stage"; if (k.includes("hardware") || k.includes("partition")) return "hardware-partition"; if (k.includes("module") || k.includes("library") || k.includes("crate") || k.includes("in-proc")) return "module"; return "other"; };
  const addBoundary = (title: string, body: string) => {
    const resp = bulletField(body, "Responsibility");
    if (!resp || bndByName.has(title.toLowerCase())) return;
    const id = `BND-${String(bnds.length + 1).padStart(2, "0")}`;
    const io = bulletField(body, "Inputs and outputs") ?? "";
    const inM = /In:\s*([\s\S]*?)(?:\s*Out:|$)/.exec(io); const outM = /Out:\s*([\s\S]*)$/.exec(io);
    const deps = (bulletField(body, "Depends on") ?? "").split(/[,;.]/).map((s) => sentence(s.replace(/\(.*?\)/g, "").replace(/\b(?:through|via|over|inside)\b[\s\S]*$/i, ""))).filter((s) => s && !/^nothing|^none|^every other|^and\b/i.test(s));
    bndByName.set(title.toLowerCase(), id);
    bnds.push({ id, legacy_id: title, name: title, kind: kindOf(bulletField(body, "Boundary kind") ?? bulletField(body, "Kind")), type: sentence(bulletField(body, "Logical type") ?? bulletField(body, "Type") ?? "unspecified"), responsibility: sentence(resp.split("\n")[0]), inputs: inM ? [sentence(inM[1])] : io && !inM ? [sentence(io)] : [], outputs: outM ? [sentence(outM[1])] : [], depends_on: deps, ...(/^(?:yes|true|outer|inner)/i.test(bulletField(body, "Trust boundary") ?? "") ? { trust_boundary: true } : {}), certainty: "assumed", assumption: "Migrated from containers.md; not yet mapped to a code path." });
  };
  for (const sec of sections(contMd)) if (!/^### /m.test(sec.body)) addBoundary(sec.title, sec.body);
  for (const sec of sections(contMd, 3)) addBoundary(sec.title, sec.body);
  for (const raw of contMd.split(/\n(?=- \*\*[^*\n]+\*\*\s*\n)/)) {
    const nm = /^- \*\*([^*\n]+)\*\*\s*\n/.exec(raw); if (!nm) continue;
    addBoundary(nm[1].trim(), raw.slice(nm[0].length).replace(/^\s+- /gm, "- "));
  }
  for (const b of bnds) b.depends_on = b.depends_on.map((d: string) => { const hit = [...bndByName.entries()].find(([n]) => d.toLowerCase().startsWith(n) || n.startsWith(d.toLowerCase())); return hit ? hit[1] : d; });
  if (!bnds.length) todo("architecture/boundaries.yaml: no boundary sections with a Responsibility bullet found; write them");
  todo("architecture/boundaries.yaml: edges are empty; add one edge per communication with its protocol category");
  writeYaml(join(c, "architecture/boundaries.yaml"), { boundaries: bnds, edges: [] });

  let flowsNoJob = 0;
  for (const n of list(join(c, "architecture/flows"))) {
    const p = join(c, "architecture/flows", n); const md = read(p);
    if (md.startsWith("---\n")) continue;
    const mapping = /\*\*Mapping:\*\*\s*([^\n]+)/.exec(md)?.[1] ?? "";
    const legacyIds = [...mapping.matchAll(/\b([A-Z]\d+\.\d+|CAP-\d{3})\b/g)].map((x) => x[1]);
    const capIds = [...new Set(legacyIds.map((l) => capMap.get(l) ?? (caps.some((cc) => cc.id === l) ? l : null)).filter(Boolean))] as string[];
    const jobIds = [...new Set(capIds.flatMap((id) => caps.find((cc) => cc.id === id)?.jobs ?? []))];
    const job = jobIds[0] ?? jobs[0]?.id ?? "JOB-01";
    if (!jobIds.length) flowsNoJob++;
    const view = /stateDiagram/.test(md) ? "state" : /flowchart|graph\s+(LR|TD|TB)/.test(md) ? "dag" : /gantt|timeline/.test(md) ? "timing" : "sequence";
    const participants = [...md.matchAll(/participant\s+\w+\s+as\s+([^\n]+)/g)].map((x) => x[1].trim().toLowerCase());
    const bIds = [...new Set(participants.map((pn) => bndByName.get(pn)).filter(Boolean))] as string[];
    const fm = { job, capabilities: capIds.length ? capIds : ["CAP-000"], boundaries: bIds, view, certainty: "assumed", assumption: "Migrated from markdown; not yet exercised by an integration test." };
    if (!capIds.length) todo(`architecture/flows/${n}: no capability mapping recognized; set capabilities`);
    writeText(p, `---\n${toBlockYaml(fm)}\n---\n${md}`);
  }
  if (flowsNoJob) todo(`architecture/flows: ${flowsNoJob} flows had no job derivable from their capabilities and defaulted to the first job; confirm each`);
  todo("architecture/flows: flows now map to jobs; merge flows that tell the same job's story (the old rule was one per capability)");

  // ---------- tech-spec: stack, guidelines, adrs, sidecars ----------
  const stackMd = has(join(c, "tech-spec/stack.md")) ? read(join(c, "tech-spec/stack.md")) : "";
  const eco = has(join(root, "Cargo.lock")) ? "cargo" : has(join(root, "bun.lock")) ? "bun" : has(join(root, "package-lock.json")) ? "npm" : has(join(root, "pubspec.lock")) ? "pub" : "other";
  const bom: any[] = [];
  for (const sec of sections(stackMd, 3).length ? sections(stackMd, 3) : sections(stackMd)) {
    let cols: { name: number; pin: number; just: number; ring: number } | null = null;
    for (const row of tableRows(sec.body)) {
      const hdr = row.map((x) => x.toLowerCase());
      const find = (re: RegExp) => hdr.findIndex((h) => re.test(h));
      if (!row.some((x) => /\d/.test(x)) && find(/^(pin|version|choice|crate|package|component|item|name|tool|reason|why|ring|policy)/) < 0) { cols = null; continue; }
      if (find(/^(pin|version|choice|crate|package|component|item|name|tool|reason|why|ring|policy)/) >= 0 && !row.some((x) => /\d/.test(x))) {
        const nameIdx = find(/^(choice|crate|package|tool|name|item|library|dependency)/); const compIdx = find(/^component/);
        cols = { name: nameIdx >= 0 ? nameIdx : compIdx >= 0 ? compIdx : 0, pin: find(/^(pin|version)/), just: find(/^(reason|why|justification|rationale|purpose|role|policy)/), ring: find(/^(ring|radar)/) };
        if (cols.pin < 0 && cols.name === 0 && row.length > 1 && !/needed|absent|purpose/.test(hdr[1])) cols.pin = 1;
        continue;
      }
      if (row.length < 2 || !cols) continue;
      const name = strip((row[cols.name] ?? "").split(/\s*\/\s*|\s*\(/)[0]);
      if (!name) continue;
      const pinCell = cols.pin >= 0 ? row[cols.pin] ?? "" : "";
      const pin = /(\d+\.\d+(?:\.\d+)?)/.exec(pinCell)?.[1] ?? (strip(pinCell) || "unpinned");
      const isTool = /toolchain|runtime|language|prerequisite|host/i.test(sec.title);
      const role = /^(rust|typescript|dart|python|go|c\+\+|c)$/i.test(name) || /^language$/i.test(row[0]) ? "language" : /^(bun|node|deno|flutter|cargo)$/i.test(name) ? "runtime" : isTool ? "tooling" : "library";
      const just = cols.just >= 0 ? row[cols.just] : undefined;
      const radar = (/adopt|trial|assess|hold/i.exec(cols.ring >= 0 ? row[cols.ring] ?? "" : "")?.[0] ?? "").toLowerCase();
      bom.push({ name, role, version: pin, ecosystem: role === "language" || role === "runtime" ? "system" : eco, ...(just ? { justification: sentence(just) } : {}), ...(radar ? { radar } : {}), certainty: "assumed", assumption: "Migrated pin; not yet checked against the lockfile." });
    }
  }
  if (bom.some((b) => b.version === "unpinned")) todo("tech-spec/stack.yaml: some entries had no pin column and are marked unpinned; pin them or move them to prose");
  const compat = sections(stackMd).find((s) => /compat/i.test(s.title))?.body ?? "";
  writeYaml(join(c, "tech-spec/stack.yaml"), { bill_of_materials: bom, compatibility_policy: { pinning: sentence(compat.split("\n\n")[0] || "TODO: state the pinning rule"), lockfiles, upgrade_boundaries: "TODO: state when an upgrade needs an ADR" } });
  if (!bom.length) todo("tech-spec/stack.yaml: no bill-of-materials table recognized; write the pins");
  todo("tech-spec/stack.yaml: review roles and ecosystems, and replace the TODO fields in compatibility_policy");
  const stackProse = sections(stackMd).filter((s) => !/compat|bill of materials/i.test(s.title) && !tableRows(s.body).length && s.body.trim()).map((s) => `### ${s.title}\n\n${s.body.trim()}`).join("\n\n");
  if (stackProse) {
    const gp0 = join(c, "tech-spec/guidelines.md");
    if (has(gp0)) { writeText(gp0, read(gp0).trimEnd() + "\n\n## Migrated from stack.md\n\n" + stackProse + "\n"); todo("tech-spec/guidelines.md: prose sections of stack.md were appended under 'Migrated from stack.md'; move each to its owner or delete it"); }
    else todo("tech-spec/stack.md had prose sections with no home and guidelines.md does not exist; recover them from git history");
  }
  del(join(c, "tech-spec/stack.md"));

  const gp = join(c, "tech-spec/guidelines.md");
  if (has(gp) && !read(gp).startsWith("---\n")) {
    const md = read(gp);
    const vsec = sections(md).find((s) => /verification/i.test(s.title))?.body ?? "";
    const cmds: any[] = [];
    for (const row of tableRows(vsec)) for (const cmd of backticked(row[0]).filter((x) => /^[a-z./]/.test(x) && !cmds.some((k) => k.command === x))) { const label = sentence(row[1] ?? ""); const name = /fmt|format/.test(cmd) ? "format" : /clippy|lint|biome check|eslint/.test(cmd) ? "lint" : /test/.test(cmd) ? "test" : /tsc|typecheck|check\b/.test(cmd) ? "typecheck" : /build/.test(cmd) ? "build" : /bench/.test(cmd) ? "bench" : "other"; cmds.push({ name, ...(label ? { label: label } : {}), command: cmd, exists: true }); }
    for (const cmd of backticked(vsec).filter((x) => /^[a-z./]/.test(x) && x.includes(" ") && !cmds.some((k) => k.command === x))) if (cmds.length === 0) cmds.push({ name: "other", command: cmd, exists: true });
    const tree = /```[^\n]*\n([\s\S]*?)```/.exec(sections(md).find((s) => /structure|layout/i.test(s.title))?.body ?? "")?.[1] ?? "";
    const layout: any[] = []; const stack: string[] = [];
    for (const line of tree.split("\n")) {
      const m = /^([│ ]*)(?:├──|└──)\s*([^\s#]+)\s*(?:#\s*(.*))?$/.exec(line); if (!m) continue;
      const depth = Math.round(m[1].replace(/│/g, " ").length / 4); const name = m[2].replace(/\/$/, "");
      stack.length = depth; stack.push(name);
      layout.push({ path: stack.join("/"), purpose: sentence(m[3] ?? "") || "migrated from the layout tree" });
    }
    const commit = /conventional commits/i.test(md) ? "Conventional Commits" : "TODO: name the commit convention";
    writeText(gp, `---\n${toBlockYaml({ verification_commands: cmds, layout, commit_convention: commit })}\n---\n${md}`);
    todo("tech-spec/guidelines.md: front matter marks every verification command as exists: true; validate reports which do not resolve, set exists: false with an owner ticket for those");
    if (!cmds.length) todo("tech-spec/guidelines.md: no verification command table recognized; fill verification_commands");
  }

  for (const n of list(join(c, "tech-spec/adrs"))) {
    const p = join(c, "tech-spec/adrs", n); const md = read(p);
    if (md.startsWith("---\n")) continue;
    const id = /ADR-(\d{4})/.exec(n)?.[0] ?? `ADR-${n.slice(0, 4)}`;
    const statusLine = /\*\*Status:\*\*\s*([^\n]+)/i.exec(md)?.[1] ?? "accepted";
    const status = (/proposed|accepted|rejected|superseded|deprecated/i.exec(statusLine)?.[0] ?? "accepted").toLowerCase();
    const d = /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(md)?.[1] ?? date;
    const ruling = /\(([^)]*ruling[^)]*)\)/i.exec(statusLine)?.[1];
    const sup = /supersede[sd]? (?:by )?(ADR-\d{4})/i.exec(md)?.[1];
    const fm: any = { id, status, date: d, ...(status === "superseded" && sup ? { superseded_by: sup } : {}), ...(ruling ? { certainty: "settled", evidence: { kind: "ruling", ref: ruling, date: d } } : { certainty: "assumed", assumption: "Migrated; the decision's ruling reference was not found in the status line." }) };
    writeText(p, `---\n${toBlockYaml(fm)}\n---\n${md}`);
  }

  const surfaceOf = (n: string, dir: string) => /openapi/.test(n) ? "http" : /asyncapi/.test(n) ? "async" : /\.proto$/.test(n) ? "rpc" : /\.wit$|sdk|abi|\.d\.ts$|\.h$/.test(n) ? "library" : /\.sql$|\.kdl$|schema|data-model|\.prisma$/.test(n) || dir.includes("data-models") ? "data-model" : /ctl|cli|command/.test(n) ? "cli" : /dbus|wayland|xml/.test(n) ? "native" : "other";
  const walkRaw = (dir: string) => {
    if (!has(dir)) return;
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { walkRaw(p); continue; }
      if (n.endsWith(".meta.yaml")) continue;
      const stem = n.replace(/\.[^.]+$/, "");
      const base = n.split(".")[0];
      const isCompanion = n.endsWith(".md") && readdirSync(dir).some((o) => o !== n && o.split(".")[0] === base && !o.endsWith(".md") && !o.endsWith(".meta.yaml"));
      if (isCompanion) continue;
      const companion = readdirSync(dir).find((o) => o !== n && o.endsWith(".md") && o.split(".")[0] === base);
      writeYaml(join(dir, `${stem}.meta.yaml`), { artifact: n, surface: surfaceOf(n.toLowerCase(), dir), flows: [], ...(companion ? { companion } : {}), certainty: "assumed", assumption: "Migrated; not yet exercised by a contract test." });
    }
  };
  walkRaw(join(c, "tech-spec/contracts")); walkRaw(join(c, "tech-spec/data-models"));
  todo("tech-spec sidecars: every *.meta.yaml has flows: [] and a guessed surface; set the flows each artifact serves and correct the surface");
  // Sidecars stay beside their raw artifacts here: where each artifact belongs in the code is a judgment call migrate cannot make.
  todo("tech-spec sidecars: each raw artifact still sits beside its sidecar (TS-008). Move it into the code, replace artifact with artifact_path, point surfaces in constitution.yaml at the new location, and name the sidecar rather than the raw file in tech_spec_patchable");

  // ---------- tasks: epics ----------
  const epicOut = join(c, "tasks/epics");
  mkdirSync(epicOut, { recursive: true });
  const epicDeps = new Map<string, Set<string>>();
  const epicCaps = new Map<string, Set<string>>();
  const parsed: { file: string; active: boolean; data: any }[] = [];
  for (const p of epicFiles) {
    const md = read(p); const n = basename(p);
    const active = p.includes("/tasks/active/");
    const idm = /^EPIC-([A-Z]{1,2})-(.+)\.md$/.exec(n);
    if (!idm) { todo(`tasks: ${rel(p)} does not follow EPIC-<ID>-<slug>.md (the id is one or two capital letters) and was left in place; rename the epic and its ticket ids`); continue; }
    const [, id, slug] = idm;
    const h1 = /^# (.+)$/m.exec(md)?.[1] ?? "";
    const name = sentence(h1.replace(/^Epic\s+[A-Z]{1,2}\s*[:—-]\s*/i, "")) || sentence(slug.replace(/-/g, " "));
    const roots = pathsOf((sections(md).find((s) => /in-scope roots|owned paths|scope roots/i.test(s.title))?.body ?? "").split("\n").filter((l) => /^- /.test(l)).map((l) => l.replace(/^- /, "")));
    const tickets: any[] = [];
    const blocks = md.split(/^(?=#### )/m).slice(1);
    for (const block of blocks) {
      const head = /^#### ([A-Z]{2,6}-[A-Z]{1,2}[0-9]{3})\s+(.+)$/m.exec(block);
      if (!head) continue;
      const [, tid, title] = head;
      const field = (nm: string) => bulletField(block, nm);
      const bullets = (nm: string) => { const sec = new RegExp(`- \\*\\*${nm.replace(/[()]/g, "\\$&")}:\\*\\*\\s*\\n((?:\\s+- .*\\n?)*)`).exec(block); return sec ? sec[1].split("\n").map((l) => l.replace(/^\s+- /, "").trim()).filter(Boolean) : []; };
      const bulletListOrInline = (nm: string) => {
        const b = bullets(nm);
        if (b.length) return b;
        const inline = field(nm);
        if (!inline) return [];
        const bt = backticked(inline);
        if (bt.length) return bt;
        if (inline.includes(",")) return inline.split(/,\s*/).map((s) => strip(s)).filter(Boolean);
        return [strip(inline)].filter(Boolean);
      };
      const paths = pathsOf;
      const deps = (field("Dependencies") ?? "").split(/,\s*/).map((s) => strip(s)).filter((s) => /^[A-Z]{2,6}-[A-Z]{1,2}[0-9]{3}$/.test(s));
      const mode = (/\*\*Mode:\*\*\s*(\w+)/.exec(block)?.[1] ?? "gherkin").toLowerCase();
      const evidence = /```[a-z]*\n([\s\S]*?)```/.exec(block)?.[1]?.trim() ?? (/\*\*Evidence:\*\*\s*([\s\S]*?)(?=\n####|$)/.exec(block)?.[1]?.trim() ?? "TODO");
      const type = (/Feature|Chore|Spike|Security/.exec(field("Type") ?? "")?.[0] ?? "Feature");
      const effortRaw = parseInt(field("Effort") ?? "3", 10); const effort = [1, 2, 3, 5, 8].includes(effortRaw) ? effortRaw : 8;
      const scopeItems = (items: string[]) => [...new Set(items.map((s) => pathsOf([s])[0] ?? sentence(s)).filter(Boolean))];
      const inScope = scopeItems(bulletListOrInline("Scope (In-Scope Files)")); const outScope = scopeItems(bulletListOrInline("Scope (Out-of-Scope Files)"));
      const stop = bulletListOrInline("STOP Conditions").map((s) => s.replace(/^"|"$/g, ""));
      const devs = [...block.matchAll(/##### \[?[A-Z-0-9]+\]? Deviations & Justifications\s*\n- \*\*Touched Files:\*\*\s*([^\n]+)\n- \*\*Justification:\*\*\s*([\s\S]*?)(?=\n- \*\*|\n#####|\n####|$)/g)].map((x) => ({ files: x[1].split(/,\s*/).map((s) => strip(s)).filter(Boolean), justification: sentence(x[2].trim()) }));
      const cat = /Correctness|Security|Perf|Tech-Debt|Dependency-Upgrade|DX|Docs|Feature-Evolution/.exec(field("Category") ?? "")?.[0];
      const desc = sentence(field("Description") ?? title);
      for (const cid of [...desc.matchAll(/\b([A-Z]\d+\.\d+)\b/g)].map((x) => capMap.get(x[1])).filter(Boolean)) (epicCaps.get(id) ?? epicCaps.set(id, new Set()).get(id)!).add(cid as string);
      const sameEpic = deps.filter((d) => /^[A-Z]{2,6}-([A-Z]{1,2})[0-9]{3}$/.exec(d)?.[1] === id);
      for (const d of deps.filter((d) => !sameEpic.includes(d))) { const em = /^[A-Z]{2,6}-([A-Z]{1,2})[0-9]{3}$/.exec(d); if (em) (epicDeps.get(id) ?? epicDeps.set(id, new Set()).get(id)!).add(em[1]); }
      const t: any = { id: tid, title: sentence(title), type, effort, depends_on: sameEpic, ...(cat ? { category: cat } : {}), scope: { in: inScope.length ? inScope : ["TODO"], ...(outScope.length ? { out: outScope } : {}) }, verification: { command: backticked(field("Verification Command") ?? "")[0] ?? strip(field("Verification Command") ?? "TODO"), expected: strip(field("Expected Success Output") ?? "exit 0") }, ...(stop.length ? { stop_conditions: stop } : {}), description: desc, acceptance: { mode, evidence }, flows: [], certainty: "assumed", status: active ? (/\*\*Status:\*\*\s*(done|completed)/i.test(block) ? "done" : "planned") : "done", ...(devs.length ? { deviations: devs } : {}) };
      if (type === "Spike") t.spike = `SPK-${acronym}-${id}${tid.slice(-3)}`;
      tickets.push(t);
    }
    if (!tickets.length) { todo(`tasks: ${rel(p)} has no #### ticket blocks; left in place`); continue; }
    const scopePaths = [...new Set(tickets.flatMap((t) => t.scope.in).filter((s: string) => s !== "TODO" && !/\s/.test(s)))];
    const kind = !active && id === "A" ? "tooling" : id === "A" ? "tooling" : id === "B" ? "foundation" : "product";
    const data: any = { id, name, kind, capabilities: [...(epicCaps.get(id) ?? [])].sort(), depends_on: [...(epicDeps.get(id) ?? [])].filter((d) => d !== id).sort(), scope: { paths: roots.length ? roots : scopePaths.length ? scopePaths : ["TODO"], tech_spec_patchable: [] }, estimate_source: "migrated", tickets };
    if (!active) data.closeout = { tickets_completed: tickets.map((t) => t.id), tickets_deferred: [], points_completed: tickets.reduce((a, t) => a + t.effort, 0), spec_patches: [], changelog_entries: [], candidate_terms: [], routed_upstream: [], follow_ups: [], settled: [] };
    parsed.push({ file: p, active, data });
  }
  for (const e of parsed) {
    const target = join(c, e.active ? "tasks/epics" : "tasks/completed", `EPIC-${e.data.id}-${basename(e.file).replace(/^EPIC-[A-Z]{1,2}-/, "").replace(/\.md$/, "")}.yaml`);
    writeYaml(target, e.data); del(e.file);
  }
  const g = new Map(parsed.map((e) => [e.data.id as string, e.data.depends_on as string[]]));
  const cyc = findCycle(g);
  if (cyc) todo(`tasks/epics: lifting cross-epic ticket dependencies produced an epic cycle (${cyc.join(" -> ")}); the plan had tickets depending on each other across these epics, so split or reorder them`);
  if (parsed.length) {
    todo(`tasks/epics: ${parsed.length} epics migrated. For each: confirm kind (defaulted A tooling, B foundation, others product), give each active epic a planned estimated_diff_lines and set estimate_source: planned (never copy a completed epic's actuals into its estimate; calibration only counts planned estimates), set scope.paths (derived from ticket scopes) and tech_spec_patchable, and set flows on tickets`);
    todo("tasks/epics: cross-epic ticket dependencies were lifted to epic depends_on and removed from the tickets; confirm the epic graph");
  }
  if (has(join(c, "tasks/active"))) { if (readdirSync(join(c, "tasks/active")).length) todo("tasks/active: files that could not be converted were left there; rename or convert them, then delete the directory"); else del(join(c, "tasks/active")); }
  del(join(c, "tasks/critical-path.md"));
  writeText(join(c, "tasks/critical-path.md"), "# Critical path\n\nRun `render` to generate this file.\n");

  // ---------- spikes ----------
  for (const n of list(join(c, "spikes"))) {
    const m = /^SPK-([A-Z]{1,2}[0-9]{3})\.md$/.exec(n);
    if (m) move(join(c, "spikes", n), join(c, "spikes", `SPK-${acronym}-${m[1]}.md`));
  }
  if (list(join(c, "spikes")).length) todo("spikes: replace day or hour time boxes with an effort budget in points (validate reports each one)");

  // ---------- reports: open decisions, other files ----------
  const reportsDir = join(c, "reports");
  const registers = list(reportsDir).filter((n) => /open-decisions\.md$/.test(n)).sort();
  const decisions: any[] = [];
  const seen = new Set<string>();
  for (const n of [...registers].reverse()) {
    const md = read(join(reportsDir, n));
    const regDate = /(\d{4}-\d{2}-\d{2})/.exec(n)?.[1] ?? date;
    for (const sec of sections(md)) {
      const idm = /^(OD-\d{2,3})/.exec(sec.title) ?? /\b(OD-\d{2,3})\b/.exec(labelField(sec.body, "Decision ID") ?? (/^Decision ID:\s*`?(OD-\d{2,3})/m.exec(sec.body)?.[1] ?? "")); if (!idm || seen.has(idm[1])) continue;
      seen.add(idm[1]);
      const closed = (/resolved|closed|settled/i.test(sec.title) && !/open/i.test(sec.title)) || /^(closed|resolved|settled)/i.test(labelField(sec.body, "Status") ?? "");
      const q = sentence(bulletField(sec.body, "Question") ?? labelField(sec.body, "Question") ?? (/^OD-/.test(sec.title) ? sec.title.replace(/^OD-\d+\s*[—-]\s*/, "").replace(/\s*[—-]\s*\*\*.*$/, "") : sec.title));
      const blocksRaw = bulletField(sec.body, "Blocks") ?? labelField(sec.body, "Blocks") ?? labelField(sec.body, "Delegated to") ?? "";
      const blocks = [...blocksRaw.matchAll(/\b([A-Z]{2,6}-[A-Z]{1,2}[0-9]{3}|epic [A-Z]{1,2}|[a-z-]+\/[a-z0-9./-]+\.(?:md|yaml|json|toml|sql|proto|wit))\b/gi)].map((x) => x[1].replace(/^epic ([A-Z]{1,2})$/i, "EPIC-$1"));
      decisions.push({ id: idm[1], question: q, blocks: blocks.length ? [...new Set(blocks)] : [sentence(blocksRaw).slice(0, 120) || "TODO"], options: [], recommendation: "TODO", closure: "ruling", ruler: primaryActor, status: closed ? "closed" : "open", asked: { date: regDate, in: `reports/${n}` }, ...(closed ? { ruling: { ref: `reports/${n}`, date: regDate, summary: "Resolved before migration; see the record." } } : {}) });
    }
  }
  decisions.sort((a, b) => a.id.localeCompare(b.id));
  writeYaml(join(reportsDir, "open-decisions.yaml"), { decisions });
  for (const n of registers) del(join(reportsDir, n));
  if (decisions.some((d) => d.status !== "closed")) todo(`reports/open-decisions.yaml: ${decisions.filter((d) => d.status !== "closed").length} open entries need options (at least two, with pros and cons), a recommendation, and a closure path (spike with a spike id, or ruling with a ruler)`);
  for (const n of list(reportsDir, "")) {
    if (n === "open-decisions.yaml" || isInterviewRecord(n) || /^audit-\d{4}-\d{2}-\d{2}-\d{6}-[a-z0-9-]+\.md$/.test(n)) continue;
    const p = join(reportsDir, n); if (statSync(p).isDirectory()) continue;
    const dm = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(n);
    if (dm && /review/.test(dm[2])) { move(p, join(reportsDir, `${dm[1]}-constitution-review-${dm[2].replace(/-?review-?/, "").replace(/^-|-$/g, "") || "migrated"}.md`)); continue; }
    if (n.endsWith(".md")) { const md = read(p); move(p, join(c, "research", n)); writeText(join(c, "research", n), md.startsWith("---\n") ? md : `---\nowner: migrate\ndate: "${dm?.[1] ?? date}"\n---\n${md}`); continue; }
    todo(`reports/${n}: not a defined report kind and not markdown; move it outside .constitution/ or delete it`);
  }
  mkdirSync(join(c, "research"), { recursive: true }); mkdirSync(join(c, "evidence"), { recursive: true });
  if (!has(join(c, "research/README.md"))) writeText(join(c, "research/README.md"), RESEARCH_README);

  // ---------- report ----------
  const reportPath = join(root, ".constitution-migration-report.md");
  const lines = [`# Constitution migration report`, ``, `Generated ${date}. Delete this file when every item below is done.`, ``, `## To do (${R.todo.length})`, ``, ...R.todo.map((t) => `- [ ] ${t}`), ``, `## Written (${R.written.length})`, ``, ...R.written.map((w) => `- ${w}`), ``, `## Moved (${R.moved.length})`, ``, ...R.moved.map((w) => `- ${w}`), ``, `## Deleted (${R.deleted.length})`, ``, ...R.deleted.map((w) => `- ${w}`), ``];
  writeFileSync(reportPath, lines.join("\n"));
  R.notes.push(`report: ${rel(reportPath)}`);
  return R;
}

/**
 * Marks completed epics whose planned estimate equals their measured diff as backfilled, so calibration
 * stops counting them. Edits one line per file in place, keeping the rest of the YAML as written; never commits.
 */
export function repairEstimates(root: string): string[] {
  const m = loadModel(root);
  const repaired: string[] = [];
  for (const e of m.epics) {
    if (e.active || !estimateLooksBackfilled(e.data)) continue;
    const path = join(root, e.path);
    const text = read(path);
    const next = /^estimate_source:.*$/m.test(text)
      ? text.replace(/^estimate_source:.*$/m, "estimate_source: backfilled")
      : text.replace(/^(estimated_diff_lines:.*)$/m, "$1\nestimate_source: backfilled");
    if (next === text) continue;
    writeFileSync(path, next);
    repaired.push(e.path);
  }
  return repaired;
}
