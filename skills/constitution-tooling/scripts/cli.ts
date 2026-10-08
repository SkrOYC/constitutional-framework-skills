#!/usr/bin/env bun
// constitution-tooling CLI. Run from any repository: bun run <skill>/scripts/cli.ts <command> [--root DIR] [--json]
import { resolve } from "node:path";
import { runChecks } from "./lib/checks.ts";
import { loadModel, type Finding } from "./lib/model.ts";
import { SchemaSet } from "./lib/schema.ts";
import { initConstitution, initStage, requireInitIdentity } from "./lib/init.ts";
import { isStageId } from "./lib/model.ts";
import { renderCriticalPath } from "./lib/render.ts";
import { migrate, repairEstimates } from "./lib/migrate.ts";
import { reconcile } from "./lib/reconcile.ts";
import { derive, formatDerive } from "./lib/derive.ts";
import { checkPlan } from "./lib/plan.ts";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { formatYamlFile } from "./lib/yaml.ts";

const SCHEMA_DIR = resolve(import.meta.dir, "../assets/schemas");
const USAGE = `usage: cli.ts <validate|init|render|migrate|reconcile|derive|format|check-plan> [--root DIR] [--json] [options]

  validate   check the constitution under DIR/.constitution against the schemas, the invariants, and the repository; missing later stages are not errors
  init       scaffold Stage 1 files, or add one stage with --stage prd|architecture|tech-spec|tasks
  render     regenerate derived files (critical-path.md) from the data files; needs tasks/
  migrate    convert a markdown constitution to the structured layout; --repair-estimates instead marks back-filled estimates on a structured one
  reconcile  apply closeout deltas after merge, on the default branch
  derive     compare stack pins and layout flags with the repository; exit 1 on drift, --write to apply
  format     re-emit the four stage changelogs (or --all: every YAML data file) in the canonical block style; --check reports without writing and exits 1 when a file would change
  check-plan <file>  validate an epic plan file's front matter, or every plan in a <!-- plan: EPIC-XX --> bundle, and cross-check it against the constitution
`;

// Flags that never take a value, so a positional after them is not swallowed as their value.
const BOOLEAN_FLAGS = new Set(["json", "stdout", "no-commit", "write", "repair-estimates", "check", "all"]);

export function parseArgs(argv: string[]): { command: string; root: string; json: boolean; flags: Record<string, string | boolean>; positionals: string[] } {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (!BOOLEAN_FLAGS.has(key) && next && !next.startsWith("--")) { flags[key] = next; i++; } else flags[key] = true;
    } else positionals.push(a);
  }
  return { command, root: resolve(String(flags.root ?? process.cwd())), json: flags.json === true, flags, positionals };
}

export function validate(root: string): Finding[] {
  const schemas = new SchemaSet(SCHEMA_DIR);
  const model = loadModel(root);
  const order = { error: 0, warning: 1, info: 2 };
  return runChecks(model, { schemas }).sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id) || a.file.localeCompare(b.file));
}

export function format(findings: Finding[]): string {
  const lines = findings.map((x) => `${x.severity.toUpperCase().padEnd(7)} ${x.id.padEnd(9)} ${x.file}${x.pointer && x.pointer !== "/" ? `#${x.pointer}` : ""}\n        ${x.message}`);
  const n = (s: string) => findings.filter((x) => x.severity === s).length;
  lines.push(`\n${n("error")} error(s), ${n("warning")} warning(s), ${n("info")} info`);
  return lines.join("\n");
}

if (import.meta.main) {
  const { command, root, json, flags, positionals } = parseArgs(process.argv.slice(2));
  switch (command) {
    case "validate": {
      const findings = validate(root);
      console.log(json ? JSON.stringify(findings, null, 2) : format(findings));
      process.exit(findings.some((x) => x.severity === "error") ? 1 : 0);
    }
    case "init": {
      try {
        if (flags.stage !== undefined) {
          const stage = String(flags.stage);
          if (!isStageId(stage)) { console.error("init --stage must be prd, architecture, tech-spec, or tasks"); process.exit(2); }
          const written = initStage(root, stage, {
            date: flags.date ? String(flags.date) : undefined,
            acronym: flags.acronym ? String(flags.acronym) : undefined,
            archetype: flags.archetype ? String(flags.archetype) : undefined,
            secondary: flags.secondary ? String(flags.secondary).split(",") : undefined,
            defaultBranch: flags["default-branch"] ? String(flags["default-branch"]) : undefined,
          });
          console.log(written.join("\n"));
          process.exit(0);
        }
        const acronym = String(flags.acronym ?? "");
        const archetype = String(flags.archetype ?? "");
        requireInitIdentity(acronym, archetype);
        const written = initConstitution(root, { acronym, archetype, secondary: flags.secondary ? String(flags.secondary).split(",") : [], defaultBranch: flags["default-branch"] ? String(flags["default-branch"]) : undefined });
        console.log(written.join("\n"));
        process.exit(0);
      } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
      }
    }
    case "render": {
      const model = loadModel(root);
      const out = renderCriticalPath(model);
      if (flags.stdout === true) { console.log(out); process.exit(0); }
      if (!model.present.tasks) {
        console.error("render needs .constitution/tasks/; Stage 4 has not been executed");
        process.exit(2);
      }
      const target = resolve(root, ".constitution/tasks/critical-path.md");
      writeFileSync(target, out);
      console.log(`wrote ${target}`);
      process.exit(0);
    }
    case "migrate": {
      if (flags["repair-estimates"] === true) {
        // A repair on an already structured constitution; never runs the markdown migration.
        const repaired = repairEstimates(root);
        console.log(json ? JSON.stringify({ repaired }, null, 2) : repaired.length ? `marked estimate_source: backfilled on ${repaired.length} epic(s); review and commit:\n${repaired.join("\n")}` : "no completed epic has a planned estimate equal to its actuals");
        process.exit(0);
      }
      const r = migrate(root, { date: flags.date ? String(flags.date) : undefined });
      const target = resolve(root, ".constitution/tasks/critical-path.md");
      writeFileSync(target, renderCriticalPath(loadModel(root)));
      console.log(`written ${r.written.length}, moved ${r.moved.length}, deleted ${r.deleted.length}, to do ${r.todo.length}`);
      console.log(r.notes.join("\n"));
      process.exit(0);
    }
    case "format": {
      const cdir = resolve(root, ".constitution");
      const targets: string[] = [];
      if (flags.all === true) {
        const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolve(d, e.name); if (e.isDirectory()) { if (!["completed", "archived", "evidence", "reports"].includes(e.name)) walk(p); } else if (e.name.endsWith(".yaml")) targets.push(p); } };
        if (existsSync(cdir)) walk(cdir);
      } else {
        for (const s of ["prd", "architecture", "tech-spec", "tasks"]) { const p = resolve(cdir, s, "changelog.yaml"); if (existsSync(p)) targets.push(p); }
      }
      const outcomes = targets.map((t) => formatYamlFile(t, flags.check !== true));
      console.log(json ? JSON.stringify(outcomes, null, 2) : outcomes.filter((o) => o.status !== "unchanged").map((o) => `${o.status.padEnd(9)} ${o.path.slice(root.length + 1)}${o.reason ? ` (${o.reason})` : ""}`).join("\n") || "already canonical");
      process.exit(flags.check === true && outcomes.some((o) => o.status === "formatted") ? 1 : 0);
    }
    case "check-plan": {
      if (positionals.length !== 1) { console.error("usage: cli.ts check-plan <plan file> [--root DIR] [--json]"); process.exit(2); }
      const findings = checkPlan(root, resolve(process.cwd(), positionals[0]), new SchemaSet(SCHEMA_DIR));
      console.log(json ? JSON.stringify(findings, null, 2) : format(findings));
      process.exit(findings.some((x) => x.severity === "error") ? 1 : 0);
    }
    case "derive": {
      try {
        const r = derive(root, { write: flags.write === true, date: flags.date ? String(flags.date) : undefined });
        console.log(json ? JSON.stringify(r, null, 2) : formatDerive(r));
        process.exit(r.drift ? 1 : 0);
      } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
      }
    }
    case "reconcile": {
      if (flags.epic === true) { console.error("reconcile: --epic needs a value, such as --epic C,D or --epic EPIC-C"); process.exit(2); }
      let r: ReturnType<typeof reconcile>;
      try {
        r = reconcile(root, { date: flags.date ? String(flags.date) : undefined, commit: flags["no-commit"] !== true, epics: typeof flags.epic === "string" ? flags.epic.split(",") : undefined });
      } catch (error: unknown) {
        console.error(`reconcile: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
      }
      console.log(json ? JSON.stringify(r, null, 2) : [`applied: ${r.applied.join(", ") || "none"}`, `fast lane: ${r.fastLane.map((c) => `${c.commit} ${c.status}`).join(", ") || "none"}`,`archived: ${r.archived.join(", ") || "none"}`, `settled: ${r.settled.join(", ") || "none"}`, ...(r.refusedSettles.length ? [`refused settles: ${r.refusedSettles.length}`, ...r.refusedSettles.map((x) => `  ${x.epic} ${x.file}: ${x.settles} (${x.reason})`)] : []), `proposed decisions: ${r.proposed.join(", ") || "none"}`, `routed: ${r.routed.length}`, `versions: ${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(", ")}`, r.report ? `report: ${r.report}` : "", r.commit ? `commit: ${r.commit}` : "not committed"].filter(Boolean).join("\n"));
      process.exit(0);
    }
    default:
      console.error(USAGE);
      process.exit(2);
  }
}
