// Scaffolds constitution files that already validate.
// Greenfield init writes Stage 1 only. init --stage adds one later stage to an existing tree.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectStages, isStageId, type StageId } from "./model.ts";
import { loadYamlFile, toBlockYaml } from "./yaml.ts";

export interface InitOptions {
  acronym: string;
  archetype: string;
  secondary?: string[];
  confidence?: string;
  rationale?: string;
  date?: string;
  defaultBranch?: string;
}

export interface InitStageOptions {
  date?: string;
  acronym?: string;
  archetype?: string;
  secondary?: string[];
  confidence?: string;
  rationale?: string;
  defaultBranch?: string;
}

export function requireInitIdentity(acronym: string, archetype: string): void {
  if (!/^[A-Z]{2,6}$/.test(acronym) || archetype === "") {
    throw new Error("init needs --acronym ABC (2 to 6 capitals) and --archetype <name>");
  }
}

/** research/README.md as init and migrate write it. STR-006 exempts the README itself from the owner rule. */
export const RESEARCH_README = "# Research\n\nNon-spike deliverables, one markdown file each with a front matter `owner`; this README is exempt and needs none. Design reviews the interview commissions live here too.\n";

const UPSTREAM: Record<StageId, StageId[]> = {
  prd: [],
  architecture: ["prd"],
  "tech-spec": ["prd", "architecture"],
  tasks: ["prd", "architecture", "tech-spec"],
};

function writer(cdir: string): { written: string[]; put: (rel: string, content: string) => void; yaml: (rel: string, data: unknown) => void } {
  const written: string[] = [];
  const put = (rel: string, content: string) => {
    const p = join(cdir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content.endsWith("\n") ? content : content + "\n");
    written.push(`.constitution/${rel}`);
  };
  return { written, put, yaml: (rel, data) => put(rel, toBlockYaml(data)) };
}

function changelog(date: string, added: string[], upstream?: Record<string, string>): { entries: Record<string, unknown>[] } {
  const entry: Record<string, unknown> = { version: "v0.0.1", date, added, by: "init" };
  if (upstream && Object.keys(upstream).length > 0) entry.upstream = upstream;
  return { entries: [entry] };
}

function isChangelog(v: unknown): v is { entries: { version: string }[] } {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  if (!("entries" in v) || !Array.isArray(v.entries) || v.entries.length === 0) return false;
  const first: unknown = v.entries[0];
  return first != null && typeof first === "object" && !Array.isArray(first) && "version" in first && typeof first.version === "string";
}

function currentVersion(cdir: string, stage: StageId): string | undefined {
  const p = join(cdir, stage, "changelog.yaml");
  if (!existsSync(p)) return undefined;
  const data: unknown = loadYamlFile(p);
  return isChangelog(data) ? data.entries[0].version : undefined;
}

function upstreamOf(cdir: string, stage: StageId): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of UPSTREAM[stage]) {
    const v = currentVersion(cdir, s);
    if (v !== undefined) out[s] = v;
  }
  return out;
}

function writeConstitution(yaml: (rel: string, data: unknown) => void, o: InitOptions): void {
  yaml("constitution.yaml", {
    schema_version: 1,
    acronym: o.acronym,
    archetype: {
      primary: o.archetype,
      secondary: o.secondary ?? [],
      confidence: o.confidence ?? "low",
      rationale: o.rationale ?? "Declared at init; revise in the Stage 1 pass.",
    },
    surfaces: [".constitution/tech-spec/contracts/**", ".constitution/tech-spec/data-models/**"],
    diff_exclusions: ["**/*.lock", "**/package-lock.json", "**/*.snap"],
    default_branch: o.defaultBranch ?? "main",
  });
}

function writePrd(w: { put: (rel: string, content: string) => void; yaml: (rel: string, data: unknown) => void }, date: string): void {
  w.yaml("prd/jobs.yaml", { jobs: [] });
  w.yaml("prd/capabilities.yaml", { capabilities: [] });
  w.yaml("prd/constraints.yaml", { constraints: [], deferred: [] });
  w.yaml("prd/glossary.yaml", { terms: [] });
  w.yaml("prd/changelog.yaml", changelog(date, ["Scaffolded by init"]));
  w.put("prd/vision.md", "# Vision\n\n## Executive summary\n\nNot written yet. Stage 1 fills this in; the archetype lives in constitution.yaml.\n\n## Appendix: Operator preferences\n\nNone recorded.\n");
  w.put("prd/actors.md", "# Actors\n\nNot written yet.\n");
  w.put("prd/domain-model.md", "# Domain model\n\nNot written yet.\n");
}

function writeArchitecture(w: { put: (rel: string, content: string) => void; yaml: (rel: string, data: unknown) => void }, date: string, cdir: string): void {
  w.yaml("architecture/boundaries.yaml", { boundaries: [], edges: [] });
  w.yaml("architecture/changelog.yaml", changelog(date, ["Scaffolded by init"], upstreamOf(cdir, "architecture")));
  w.put("architecture/strategy.md", "# Strategy\n\nNot written yet.\n");
  w.put("architecture/containers.md", "# Containers\n\nNot written yet.\n");
  w.put("architecture/resilience.md", "# Resilience\n\nNot written yet.\n");
  w.put("architecture/risks.md", "# Risks\n\nNot written yet.\n");
}

function writeTechSpec(w: { put: (rel: string, content: string) => void; yaml: (rel: string, data: unknown) => void }, date: string, cdir: string): void {
  w.yaml("tech-spec/stack.yaml", {
    bill_of_materials: [],
    compatibility_policy: { pinning: "Not written yet.", lockfiles: [], upgrade_boundaries: "Not written yet." },
  });
  w.yaml("tech-spec/changelog.yaml", changelog(date, ["Scaffolded by init"], upstreamOf(cdir, "tech-spec")));
  w.put("tech-spec/guidelines.md", `---\n${toBlockYaml({ verification_commands: [], layout: [], commit_convention: "Not written yet." })}\n---\n# Guidelines\n`);
}

function writeTasks(w: { yaml: (rel: string, data: unknown) => void }, date: string, cdir: string): void {
  w.yaml("tasks/changelog.yaml", changelog(date, ["Scaffolded by init"], upstreamOf(cdir, "tasks")));
}

export function initConstitution(root: string, o: InitOptions): string[] {
  requireInitIdentity(o.acronym, o.archetype);
  const cdir = join(root, ".constitution");
  if (existsSync(cdir)) throw new Error(`${cdir} already exists; pass --stage prd|architecture|tech-spec|tasks to add a stage`);
  const date = o.date ?? new Date().toISOString().slice(0, 10);
  const w = writer(cdir);
  for (const d of ["prd/out-of-scope", "spikes", "evidence", "research", "reports"]) mkdirSync(join(cdir, d), { recursive: true });
  writeConstitution(w.yaml, o);
  writePrd(w, date);
  w.yaml("reports/open-decisions.yaml", { decisions: [] });
  w.put("research/README.md", RESEARCH_README);
  return w.written;
}

export function initStage(root: string, stage: StageId, o: InitStageOptions = {}): string[] {
  const cdir = join(root, ".constitution");
  if (!existsSync(cdir)) throw new Error(`no .constitution under ${root}; run init --acronym ABC --archetype <name> first`);
  if (!isStageId(stage)) throw new Error(`unknown stage ${stage}; use prd, architecture, tech-spec, or tasks`);
  const present = detectStages(cdir);
  if (present[stage]) throw new Error(`${stage}/ already has files`);
  const missing = UPSTREAM[stage].filter((s) => !present[s]);
  if (missing.length > 0) throw new Error(`${stage} needs ${missing.join(", ")}; run init --stage ${missing[0]} first`);
  const date = o.date ?? new Date().toISOString().slice(0, 10);
  const w = writer(cdir);
  switch (stage) {
    case "prd": {
      if (!existsSync(join(cdir, "constitution.yaml"))) {
        if (o.acronym == null || o.archetype == null) {
          throw new Error("init --stage prd needs --acronym ABC and --archetype <name> when constitution.yaml is missing");
        }
        requireInitIdentity(o.acronym, o.archetype);
        writeConstitution(w.yaml, {
          acronym: o.acronym,
          archetype: o.archetype,
          secondary: o.secondary,
          confidence: o.confidence,
          rationale: o.rationale,
          defaultBranch: o.defaultBranch,
        });
      }
      for (const d of ["prd/out-of-scope", "spikes", "evidence", "research", "reports"]) mkdirSync(join(cdir, d), { recursive: true });
      writePrd(w, date);
      if (!existsSync(join(cdir, "reports/open-decisions.yaml"))) w.yaml("reports/open-decisions.yaml", { decisions: [] });
      if (!existsSync(join(cdir, "research/README.md"))) {
        w.put("research/README.md", RESEARCH_README);
      }
      break;
    }
    case "architecture": {
      mkdirSync(join(cdir, "architecture/flows"), { recursive: true });
      writeArchitecture(w, date, cdir);
      break;
    }
    case "tech-spec": {
      for (const d of ["tech-spec/adrs", "tech-spec/contracts", "tech-spec/data-models"]) mkdirSync(join(cdir, d), { recursive: true });
      writeTechSpec(w, date, cdir);
      break;
    }
    case "tasks": {
      for (const d of ["tasks/epics", "tasks/completed"]) mkdirSync(join(cdir, d), { recursive: true });
      writeTasks(w, date, cdir);
      break;
    }
    default: {
      const _never: never = stage;
      throw new Error(`unknown stage ${_never}`);
    }
  }
  return w.written;
}
