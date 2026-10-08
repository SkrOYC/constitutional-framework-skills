// Loads a structured constitution into memory. Load-time problems become findings; nothing throws past here.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, lstatSync } from "node:fs";
import { isAbsolute, join, posix, relative, resolve } from "node:path";
import { DuplicateKeyError, loadFrontMatter, loadYamlFile } from "./yaml.ts";

export type Severity = "error" | "warning" | "info";
export type Finding = { id: string; severity: Severity; file: string; pointer?: string; message: string };

export type Doc<T = any> = { path: string; data: T; body?: string };
export type EpicDoc = Doc & { active: boolean; fileId: string | null };
export type FlowDoc = Doc & { slug: string };
export type MetaDoc = Doc & { dir: string };

export const STAGE_DIRS = ["prd", "architecture", "tech-spec", "tasks"] as const;
export type StageId = (typeof STAGE_DIRS)[number];

export function isStageId(v: string): v is StageId {
  for (const s of STAGE_DIRS) if (s === v) return true;
  return false;
}

export interface Model {
  root: string;
  cdir: string;
  findings: Finding[];
  present: Record<StageId, boolean>;
  constitution: Doc | null;
  jobs: Doc | null;
  capabilities: Doc | null;
  constraints: Doc | null;
  glossary: Doc | null;
  outOfScope: Doc[];
  boundaries: Doc | null;
  flows: FlowDoc[];
  stack: Doc | null;
  guidelines: Doc | null;
  adrs: Doc[];
  metas: MetaDoc[];
  rawArtifacts: string[];
  epics: EpicDoc[];
  changelogs: Record<string, Doc | null>;
  openDecisions: Doc | null;
  evidence: { dir: string; manifest: Doc | null }[];
  spikes: string[];
  reports: string[];
  research: string[];
  prose: string[];
}

/** Files and directories a stage must have once that stage, or a later one, is present. */
export const STAGE_LAYOUT: Record<StageId, { yaml: string[]; prose: string[]; fm: string[]; dirs: string[] }> = {
  prd: {
    yaml: ["prd/jobs.yaml", "prd/capabilities.yaml", "prd/constraints.yaml", "prd/glossary.yaml", "prd/changelog.yaml"],
    prose: ["prd/vision.md", "prd/actors.md", "prd/domain-model.md"],
    fm: [],
    dirs: [],
  },
  architecture: {
    yaml: ["architecture/boundaries.yaml", "architecture/changelog.yaml"],
    prose: ["architecture/strategy.md", "architecture/containers.md", "architecture/resilience.md", "architecture/risks.md"],
    fm: [],
    dirs: [],
  },
  "tech-spec": {
    yaml: ["tech-spec/stack.yaml", "tech-spec/changelog.yaml"],
    prose: [],
    fm: ["tech-spec/guidelines.md"],
    dirs: [],
  },
  tasks: {
    yaml: ["tasks/changelog.yaml"],
    prose: [],
    fm: [],
    dirs: ["tasks/epics"],
  },
};

function treeHasFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isFile()) return true;
    if (st.isDirectory() && treeHasFiles(p)) return true;
  }
  return false;
}

export function detectStages(cdir: string): Record<StageId, boolean> {
  return {
    prd: treeHasFiles(join(cdir, "prd")),
    architecture: treeHasFiles(join(cdir, "architecture")),
    "tech-spec": treeHasFiles(join(cdir, "tech-spec")),
    tasks: treeHasFiles(join(cdir, "tasks")),
  };
}

/** A present stage requires its own files and every upstream stage's files. */
export function requiredStages(present: Record<StageId, boolean>): Record<StageId, boolean> {
  const req = { ...present };
  if (req.tasks) {
    req["tech-spec"] = true;
    req.architecture = true;
    req.prd = true;
  }
  if (req["tech-spec"]) {
    req.architecture = true;
    req.prd = true;
  }
  if (req.architecture) req.prd = true;
  return req;
}

export function rel(m: Model, abs: string): string {
  return relative(m.root, abs).split("\\").join("/");
}

function listFiles(dir: string, filter: (name: string) => boolean = () => true): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => filter(n) && statSync(join(dir, n)).isFile()).sort();
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort();
}

/** A duplicated mapping key is YAML-001; any other load failure is SCH-000. */
function loadFailure(e: unknown, file: string): Finding {
  const dup = e instanceof DuplicateKeyError;
  return { id: dup ? "YAML-001" : "SCH-000", severity: "error", file, message: dup ? `duplicate mapping key "${e.key}" at line ${e.line} (first at line ${e.firstLine})` : (e as Error).message };
}

export function loadModel(root: string): Model {
  const cdir = join(root, ".constitution");
  const none: Record<StageId, boolean> = { prd: false, architecture: false, "tech-spec": false, tasks: false };
  const m: Model = {
    root, cdir, findings: [], present: none,
    constitution: null, jobs: null, capabilities: null, constraints: null, glossary: null, outOfScope: [],
    boundaries: null, flows: [], stack: null, guidelines: null, adrs: [], metas: [], rawArtifacts: [],
    epics: [], changelogs: {}, openDecisions: null, evidence: [], spikes: [], reports: [], research: [], prose: [],
  };
  const missing = (p: string) => m.findings.push({ id: "STR-001", severity: "error", file: rel(m, p), message: "required file is missing" });
  const yaml = (p: string, required = true): Doc | null => {
    if (!existsSync(p)) { if (required) missing(p); return null; }
    try { return { path: rel(m, p), data: loadYamlFile(p) }; }
    catch (e) { m.findings.push(loadFailure(e, rel(m, p))); return null; }
  };
  const fm = (p: string, required = true): Doc | null => {
    if (!existsSync(p)) { if (required) missing(p); return null; }
    try {
      const { data, body } = loadFrontMatter(p);
      if (data === null) { m.findings.push({ id: "SCH-000", severity: "error", file: rel(m, p), message: "front matter is missing" }); return null; }
      return { path: rel(m, p), data, body };
    } catch (e) { m.findings.push(loadFailure(e, rel(m, p))); return null; }
  };

  if (!existsSync(cdir)) { missing(cdir); return m; }
  m.present = detectStages(cdir);
  const req = requiredStages(m.present);
  const anyStage = STAGE_DIRS.some((s) => m.present[s]);

  m.constitution = yaml(join(cdir, "constitution.yaml"), anyStage);
  m.jobs = yaml(join(cdir, "prd/jobs.yaml"), false);
  m.capabilities = yaml(join(cdir, "prd/capabilities.yaml"), false);
  m.constraints = yaml(join(cdir, "prd/constraints.yaml"), false);
  m.glossary = yaml(join(cdir, "prd/glossary.yaml"), false);
  for (const s of STAGE_DIRS) {
    if (!req[s]) continue;
    for (const f of [...STAGE_LAYOUT[s].yaml, ...STAGE_LAYOUT[s].prose, ...STAGE_LAYOUT[s].fm]) {
      const p = join(cdir, f);
      if (existsSync(p)) { if (STAGE_LAYOUT[s].prose.includes(f)) m.prose.push(rel(m, p)); }
      else missing(p);
    }
    for (const f of STAGE_LAYOUT[s].dirs) {
      const p = join(cdir, f);
      if (!existsSync(p)) missing(p);
    }
  }
  for (const n of listFiles(join(cdir, "prd/out-of-scope"), (n) => n.endsWith(".md"))) { const d = fm(join(cdir, "prd/out-of-scope", n), false); if (d) m.outOfScope.push(d); }
  m.boundaries = yaml(join(cdir, "architecture/boundaries.yaml"), false);
  for (const n of listFiles(join(cdir, "architecture/flows"), (n) => n.endsWith(".md"))) { const d = fm(join(cdir, "architecture/flows", n), false); if (d) m.flows.push({ ...d, slug: n.replace(/\.md$/, "") }); }
  m.stack = yaml(join(cdir, "tech-spec/stack.yaml"), false);
  m.guidelines = fm(join(cdir, "tech-spec/guidelines.md"), false);
  for (const n of listFiles(join(cdir, "tech-spec/adrs"), (n) => n.endsWith(".md"))) { const d = fm(join(cdir, "tech-spec/adrs", n), false); if (d) m.adrs.push(d); }
  for (const sub of ["tech-spec/contracts", "tech-spec/data-models"]) {
    const walk = (dir: string) => {
      for (const n of listFiles(dir)) {
        const p = join(dir, n);
        if (n.endsWith(".meta.yaml")) { const d = yaml(p, false); if (d) m.metas.push({ ...d, dir: rel(m, dir) }); }
        else m.rawArtifacts.push(rel(m, p));
      }
      for (const d of listDirs(dir)) walk(join(dir, d));
    };
    walk(join(cdir, sub));
  }
  const epicDir = join(cdir, "tasks/epics");
  const doneDir = join(cdir, "tasks/completed");
  for (const [dir, active] of [[epicDir, true], [doneDir, false]] as const) {
    for (const n of listFiles(dir, (n) => n.endsWith(".yaml"))) {
      const d = yaml(join(dir, n), false);
      const mm = /^EPIC-([A-Z]{1,2})-[a-z0-9-]+\.yaml$/.exec(n);
      if (!mm) m.findings.push({ id: "STR-004", severity: "error", file: rel(m, join(dir, n)), message: "epic file name must be EPIC-<ID>-<slug>.yaml" });
      if (d) m.epics.push({ ...d, active, fileId: mm ? mm[1] : null });
    }
  }
  for (const s of STAGE_DIRS) m.changelogs[s] = yaml(join(cdir, s, "changelog.yaml"), false);
  m.openDecisions = yaml(join(cdir, "reports/open-decisions.yaml"), anyStage);
  for (const d of listDirs(join(cdir, "evidence"))) {
    const mp = join(cdir, "evidence", d, "manifest.yaml");
    m.evidence.push({ dir: rel(m, join(cdir, "evidence", d)), manifest: existsSync(mp) ? yaml(mp, false) : null });
  }
  m.spikes = listFiles(join(cdir, "spikes"));
  m.reports = listFiles(join(cdir, "reports"));
  m.research = listFiles(join(cdir, "research"));
  return m;
}

export function readText(m: Model, relPath: string): string {
  return readFileSync(join(m.root, relPath), "utf8");
}

export function exists(m: Model, relPath: string): boolean {
  return existsSync(join(m.root, relPath));
}

/** Walk the repository for text files, skipping VCS, dependency, and build directories. */
export function walkRepo(m: Model, opts: { includeConstitution: boolean }): string[] {
  const skip = new Set([".git", "node_modules", "target", "dist", "build", ".devenv", ".direnv", "result", ".dart_tool", "vendor"]);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (skip.has(n)) continue;
      const p = join(dir, n);
      let st; try { st = lstatSync(p); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (n === ".constitution" && !opts.includeConstitution) continue; walk(p); }
      else if (st.isFile() && st.size < 2_000_000) out.push(rel(m, p));
    }
  };
  walk(m.root);
  return out;
}

/** Repository-relative path of the artifact a sidecar describes: artifact_path, or the legacy sibling file. */
export function sidecarTarget(mt: MetaDoc): string {
  return mt.data?.artifact_path ?? `${mt.dir}/${mt.data?.artifact}`;
}

/** List files whose records a closeout may settle by id, keyed by path relative to .constitution/. */
export const RECORD_LIST_KEYS: Record<string, string> = { "prd/jobs.yaml": "jobs", "prd/capabilities.yaml": "capabilities", "prd/constraints.yaml": "constraints", "architecture/boundaries.yaml": "boundaries", "tech-spec/stack.yaml": "bill_of_materials" };

/**
 * The file a closeout or `Settles:` record `path#id` or `path` names, relative to .constitution/ and absolute, or the
 * reason it is refused. reconcile rewrites that file, so a path that is absolute, has a `..` segment, or resolves
 * (through a symlink too) outside .constitution/ is refused before anything reads or writes it.
 */
export function recordPath(cdir: string, record: string): { rel: string; path: string } | { problem: string } {
  const raw = String(record).split("#")[0].replace(/\\/g, "/");
  if (!raw.trim()) return { problem: "names no file" };
  if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw)) return { problem: `${raw} is an absolute path; name a path relative to .constitution/` };
  const bare = raw.replace(/^\.constitution\//, "");
  if (bare.split("/").includes("..")) return { problem: `${raw} has a .. segment; name a path inside .constitution/` };
  const rel = posix.normalize(bare);
  const path = resolve(cdir, rel);
  const inside = (root: string, p: string) => { const r = relative(root, p); return r !== "" && r !== ".." && !r.startsWith("../") && !isAbsolute(r); };
  if (!inside(resolve(cdir), path)) return { problem: `${raw} resolves outside .constitution/` };
  if (existsSync(path)) {
    let real: string;
    try { real = realpathSync(path); } catch { return { problem: `${raw} cannot be resolved` }; }
    if (!inside(realpathSync(cdir), real)) return { problem: `${raw} resolves outside .constitution/` };
  }
  return { rel, path };
}

/** Why a closeout record `path#id` or `path` would not resolve, or null when reconcile can settle it. */
export function recordProblem(cdir: string, record: string): string | null {
  const id = String(record).split("#")[1];
  const target = recordPath(cdir, record);
  if ("problem" in target) return target.problem;
  const { rel: relPath, path } = target;
  if (!existsSync(path)) return `${relPath} does not exist under .constitution/`;
  const key = RECORD_LIST_KEYS[relPath];
  if (key && !id) return `${relPath} holds a list; name the record as ${relPath}#<id>`;
  const isYaml = relPath.endsWith(".yaml");
  let data: any;
  try { data = isYaml ? loadYamlFile(path) : loadFrontMatter(path).data; } catch { return `${relPath} does not parse`; }
  if (key) return (data?.[key] ?? []).some((r: any) => r?.id === id || r?.name === id) ? null : `${relPath} has no record ${id}`;
  if (!data || typeof data !== "object") return `${relPath} has no front matter`;
  if (isYaml && relPath.endsWith(".meta.yaml") && !id) return null;
  return certaintyRecord(data, id) ? null : `${relPath}${id ? "#" + id : ""} is not a certainty-bearing record; settle a sidecar .meta.yaml, a record in a list file by id, or a front-matter record that carries its own certainty`;
}

/** The object a closeout settles inside a parsed non-list file: the file's own top level, or the front-matter record `id`; it must already carry `certainty`. */
export function certaintyRecord(data: any, id: string | undefined): any {
  if (!id) return Object.hasOwn(data, "certainty") ? data : null;
  for (const value of Object.values(data)) {
    const hit = Array.isArray(value) ? value.find((r: any) => r && typeof r === "object" && (r.id === id || r.name === id) && Object.hasOwn(r, "certainty")) : null;
    if (hit) return hit;
  }
  return null;
}
