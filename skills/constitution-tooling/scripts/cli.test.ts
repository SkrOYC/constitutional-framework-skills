import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validate } from "./cli.ts";

const FIX = resolve(import.meta.dir, "../assets/fixtures");

describe("validate", () => {
  test("the valid fixture has no errors and no warnings", () => {
    const findings = validate(`${FIX}/valid`);
    const bad = findings.filter((x) => x.severity !== "info");
    expect(bad.map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
    expect(findings.some((x) => x.id === "INFO-CERT")).toBe(true);
  });

  test("the invalid fixture reports every injected violation", () => {
    const ids = new Set(validate(`${FIX}/invalid`).map((x) => x.id));
    const expected = ["SCH-001", "STR-002", "STR-003", "STR-004", "VER-001", "CERT-001", "CERT-002", "PRD-001", "TS-001", "TS-004", "TSK-002", "TSK-004", "TSK-009", "TSK-010", "GLS-001", "STR-006", "STR-007", "TSK-006", "TS-010", "TS-011", "TSK-016", "VER-004", "XR-001", "TS-007", "TS-008", "TS-009", "TSK-017", "TS-012", "TSK-014", "TSK-015"];
    const missing = expected.filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });
});

describe("init", () => {
  test("scaffolds a Stage 1 constitution that validates with no errors", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-`);
    try {
      const written = initConstitution(dir, { acronym: "NEW", archetype: "Library/SDK", date: "2026-09-03" });
      expect(written).toContain(".constitution/constitution.yaml");
      expect(written.some((p) => p.startsWith(".constitution/architecture"))).toBe(false);
      expect(written.some((p) => p.startsWith(".constitution/tech-spec"))).toBe(false);
      expect(written.some((p) => p.startsWith(".constitution/tasks"))).toBe(false);
      const findings = validate(dir);
      expect(findings.filter((x) => x.severity === "error").map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
      expect(findings.some((x) => x.id === "INFO-SHAPE" && x.message === "stages present: prd")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("init --stage adds later stages in pipeline order", async () => {
    const { initConstitution, initStage } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-stage-`);
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      const arch = initStage(dir, "architecture", { date: "2026-09-03" });
      expect(arch).toContain(".constitution/architecture/boundaries.yaml");
      expect(validate(dir).filter((x) => x.severity === "error").map((x) => `${x.id} ${x.file}`)).toEqual([]);
      const spec = initStage(dir, "tech-spec", { date: "2026-09-03" });
      expect(spec).toContain(".constitution/tech-spec/stack.yaml");
      const tasks = initStage(dir, "tasks", { date: "2026-09-03" });
      expect(tasks).toContain(".constitution/tasks/changelog.yaml");
      const findings = validate(dir);
      expect(findings.filter((x) => x.severity === "error").map((x) => `${x.id} ${x.file}`)).toEqual([]);
      expect(findings.some((x) => x.id === "INFO-SHAPE" && x.message === "stages present: prd, architecture, tech-spec, tasks")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("init --stage refuses a duplicate or a missing upstream", async () => {
    const { initConstitution, initStage } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-refuse-`);
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      expect(() => initStage(dir, "prd")).toThrow(/prd\/ already has files/);
      expect(() => initStage(dir, "tech-spec")).toThrow(/tech-spec needs architecture/);
      expect(() => initStage(dir, "architecture")).not.toThrow();
      expect(() => initStage(dir, "architecture")).toThrow(/architecture\/ already has files/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CLI init --stage architecture does not need --acronym", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-cli-`);
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      const r = Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "init", "--root", dir, "--stage", "architecture", "--date", "2026-09-03"], { stdout: "pipe", stderr: "pipe" });
      expect(r.exitCode).toBe(0);
      expect(r.stdout.toString()).toContain(".constitution/architecture/boundaries.yaml");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("init --stage prd rejects an invalid acronym before writing", async () => {
    const { initStage } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-acronym-`);
    try {
      mkdirSync(`${dir}/.constitution/reports`, { recursive: true });
      writeFileSync(`${dir}/.constitution/reports/open-decisions.yaml`, "decisions: []\n");
      expect(() => initStage(dir, "prd", { date: "2026-09-03", acronym: "x", archetype: "CLI/Tooling" })).toThrow(/2 to 6 capitals/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("init --stage prd fills an interview-only constitution", async () => {
    const { initStage } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-init-prd-`);
    try {
      mkdirSync(`${dir}/.constitution/reports`, { recursive: true });
      writeFileSync(`${dir}/.constitution/reports/open-decisions.yaml`, "decisions: []\n");
      const written = initStage(dir, "prd", { date: "2026-09-03", acronym: "NEW", archetype: "CLI/Tooling" });
      expect(written).toContain(".constitution/constitution.yaml");
      expect(written).toContain(".constitution/prd/jobs.yaml");
      expect(written.some((p) => p.endsWith("open-decisions.yaml"))).toBe(false);
      expect(validate(dir).filter((x) => x.severity === "error").map((x) => `${x.id} ${x.file}`)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("render", () => {
  test("critical-path.md for the valid fixture matches the committed golden file", async () => {
    const { readFileSync } = await import("node:fs");
    const { loadModel } = await import("./lib/model.ts");
    const { renderCriticalPath } = await import("./lib/render.ts");
    const golden = readFileSync(`${FIX}/valid/.constitution/tasks/critical-path.md`, "utf8");
    expect(renderCriticalPath(loadModel(`${FIX}/valid`))).toBe(golden);
  });

  test("build order arrows point from active prerequisites to dependent epics", async () => {
    const { loadModel } = await import("./lib/model.ts");
    const { renderCriticalPath } = await import("./lib/render.ts");
    const model = loadModel(`${FIX}/valid`);
    const dependent = model.epics.find((epic) => epic.active && epic.data.id === "D");
    if (!dependent) throw new Error("Fixture is missing active epic D");
    dependent.data.depends_on = ["C"];

    const rendered = renderCriticalPath(model);
    expect(rendered).toContain("  C --> D\n");
    expect(rendered).not.toContain("  D --> C\n");
  });

  test("ticket listings preserve independent roots, multiple prerequisites, and status", async () => {
    const { loadModel } = await import("./lib/model.ts");
    const { renderCriticalPath } = await import("./lib/render.ts");
    const model = loadModel(`${FIX}/valid`);
    const epic = model.epics.find((entry) => entry.active && entry.data.id === "C");
    if (!epic) throw new Error("Fixture is missing active epic C");
    epic.data.tickets = [
      { id: "FIX-C003", depends_on: ["FIX-C001", "FIX-C002"], status: "in_progress", effort: 1 },
      { id: "FIX-C001", depends_on: [], status: "planned", effort: 1 },
      { id: "FIX-C002", depends_on: [], status: "planned", effort: 1 },
    ];

    expect(renderCriticalPath(model)).toContain(
      "- **EPIC-C:** FIX-C001, FIX-C002, FIX-C003 (in_progress; needs FIX-C001, FIX-C002)\n",
    );
  });
});

describe("YAML serialization", () => {
  test("preserves numeric-looking strings in mappings and sequences", async () => {
    const { parseYaml, toBlockYaml } = await import("./lib/yaml.ts");
    const strings = [
      "1e3", "1e+3", "1e-3", "1.2e3", "1.2E+3", "1.2E-3", "1.e3",
      ".5e3", "-1e3", "+1e3", "123e456", "0xabc", "0XABC", "0o17", "0b101",
      "123", "1.2", "true", "null", "release-1e3", "1example",
    ];
    for (const value of strings) {
      const input = { value, values: [value], entries: [{ value }] };
      expect(parseYaml(toBlockYaml(input), "round-trip")).toEqual(input);
    }
  });

  test("preserves native numbers, booleans, and null", async () => {
    const { parseYaml, toBlockYaml } = await import("./lib/yaml.ts");
    const input = { values: [1000, 0.001, -1200, true, false, null] };
    expect(parseYaml(toBlockYaml(input), "round-trip")).toEqual(input);
  });
});

describe("YAML changelog formatting", () => {
  const long = "A long changelog line that describes a change in prose and would make a single-line flow list unreadable in review.";

  test("keeps short scalar lists inline and puts long ones one item per line", async () => {
    const { parseYaml, toBlockYaml } = await import("./lib/yaml.ts");
    const input = { short: ["a", "b"], prose: [long, "second"] };
    const out = toBlockYaml(input);
    expect(out).toContain("short: [a, b]");
    expect(out).toContain("prose:\n  - ");
    expect(parseYaml(out, "round-trip")).toEqual(input);
  });

  test("prepends an entry without touching older entries", async () => {
    const { parseYaml, prependChangelogEntry } = await import("./lib/yaml.ts");
    const old = `entries:\n  - version: v0.1.0\n    date: 2026-01-01\n    added: ["kept verbatim, even in flow style"]\n`;
    const next = prependChangelogEntry(old, { version: "v0.1.1", date: "2026-01-02", changed: [long] });
    expect(next.endsWith(old.slice("entries:\n".length))).toBe(true);
    expect((parseYaml(next, "x") as any).entries.map((e: any) => e.version)).toEqual(["v0.1.1", "v0.1.0"]);
  });

  test("format rewrites flow lists, is idempotent, and skips files with comments", async () => {
    const { formatYamlFile } = await import("./lib/yaml.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-format-`);
    try {
      const flow = join(dir, "changelog.yaml");
      writeFileSync(flow, `entries:\n  - version: v0.1.0\n    date: 2026-01-01\n    changed: [${JSON.stringify(long)}, "x"]\n`);
      expect(formatYamlFile(flow, false).status).toBe("formatted");
      expect(readFileSync(flow, "utf8")).toContain("changed: [");
      expect(formatYamlFile(flow, true).status).toBe("formatted");
      expect(formatYamlFile(flow, true).status).toBe("unchanged");
      const commented = join(dir, "c.yaml");
      writeFileSync(commented, "# keep me\nentries: []\n");
      expect(formatYamlFile(commented, true).status).toBe("skipped");
      expect(readFileSync(commented, "utf8")).toContain("# keep me");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("migrate", () => {
  test("converts the markdown fixture into a structured constitution", async () => {
    const { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { migrate } = await import("./lib/migrate.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-migrate-`);
    try {
      cpSync(`${FIX}/markdown`, dir, { recursive: true });
      const r = migrate(dir, { date: "2026-09-03" });
      for (const p of ["constitution.yaml", "prd/jobs.yaml", "prd/capabilities.yaml", "prd/constraints.yaml", "prd/glossary.yaml", "prd/changelog.yaml", "architecture/boundaries.yaml", "tech-spec/stack.yaml", "tech-spec/contracts/cli-fix.meta.yaml", "tech-spec/data-models/page.schema.meta.yaml", "tasks/epics/EPIC-B-render.yaml", "tasks/completed/EPIC-A-tooling.yaml", "spikes/SPK-LEG-B001.md", "reports/open-decisions.yaml", "reports/2026-08-13-constitution-review-boundary.md"]) {
        expect(existsSync(`${dir}/.constitution/${p}`)).toBe(true);
      }
      for (const gone of ["prd/glossary.md", "prd/capabilities.md", "tech-spec/stack.md", "tasks/active", "reports/2026-08-13-open-decisions.md"]) expect(existsSync(`${dir}/.constitution/${gone}`)).toBe(false);
      const caps = readFileSync(`${dir}/.constitution/prd/capabilities.yaml`, "utf8");
      expect(caps).toContain("legacy_id: E1.1");
      expect(caps).toContain("jobs: [JOB-01]");
      const epic = readFileSync(`${dir}/.constitution/tasks/epics/EPIC-B-render.yaml`, "utf8");
      expect(epic).toContain("depends_on: [A]");
      expect(epic).toContain("spike: SPK-LEG-B001");
      expect(epic).toContain("justification: Error type needed by both commands");
      expect(epic).toContain("estimate_source: migrated");
      expect(epic).not.toContain("estimated_diff_lines");
      expect(readFileSync(`${dir}/.constitution/tasks/completed/EPIC-A-tooling.yaml`, "utf8")).not.toContain("estimated_diff_lines");
      expect(r.todo.length).toBeGreaterThan(3);
      const findings = validate(dir);
      expect(findings.filter((x) => ["SCH-000", "STR-001", "STR-003", "STR-004"].includes(x.id)).map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
      expect(findings.some((x) => x.id === "STR-002" && x.file.endsWith("inventory.json"))).toBe(true);
      expect(r.todo.some((t) => t.includes("inventory.json"))).toBe(true);
      expect(findings.some((x) => x.id === "TSK-010" && x.file.includes("SPK-LEG-B001"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("reconcile", () => {
  test("applies a closeout: actuals, settling, proposed decision, changelog, archive, render, commit", async () => {
    const { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { reconcile } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-reconcile-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      writeFileSync(`${dir}/src/core/links.ts`, "export const links = () => [];\n"); writeFileSync(`${dir}/docs/check-report.schema.json`, "{}\n");
      for (const s of ["doctor", "drive-check", "clean"]) writeFileSync(`${dir}/scripts/${s}.sh`, "#!/usr/bin/env bash\nexit 0\n");
      writeFileSync(`${dir}/package.json`, readFileSync(`${dir}/package.json`, "utf8").replace('"test": "bun test",', '"test": "bun test",\n    "build": "bun build src/cli/parse.ts --outdir dist",'));
      g("add", "."); g("commit", "-q", "-m", "FIX-C001 contract tests");
      writeFileSync(`${dir}/src/core/links.ts`, "export const links = (s: string) => s.split('\\n');\n"); g("add", "."); g("commit", "-q", "-m", "fix: address FIX-C001 milestone review");
      writeFileSync(`${dir}/scripts/bench.sh`, "#!/usr/bin/env bash\nexit 0\n"); writeFileSync(`${dir}/package.json`, readFileSync(`${dir}/package.json`, "utf8").replace('"typecheck": "tsc --noEmit"', '"typecheck": "tsc --noEmit",\n    "bench": "./scripts/bench.sh"')); g("add", "."); g("commit", "-q", "-m", "FIX-C002 bench command");
      const epicPath = `${dir}/.constitution/tasks/epics/EPIC-C-checking.yaml`;
      let epic = readFileSync(epicPath, "utf8").replace(/status: planned/g, "status: done");
      epic += `decisions:
  - id: OD-03
    question: Should check follow symlinked targets?
    blocks: [FIX-C001]
    options:
      - { name: Follow, pros: [complete], cons: [loops] }
      - { name: Ignore, pros: [simple], cons: [misses targets] }
    recommendation: Ignore
    closure: ruling
    ruler: Operator
    status: proposed
    asked: { date: "2026-09-03", in: EPIC-C }
closeout:
  tickets_completed: [FIX-C001, FIX-C002]
  tickets_deferred: []
  points_completed: 5
  spec_patches: []
  changelog_entries:
    - { directory: tech-spec, type: changed, text: cli-fix.md gained the check exit codes }
  candidate_terms:
    - { term: Target, where: src/core/links.ts }
  routed_upstream: []
  follow_ups: [Symlink handling]
  code_decisions:
    - { summary: Links are split on newlines rather than parsed, kind: pattern, paths: [src/core/links.ts], commit: abc1234 }
  settled:
    - record: prd/capabilities.yaml#CAP-003
      evidence: { kind: repository, ref: tests/render.test.ts, version: "0000000", date: "2026-09-03" }
`;
      writeFileSync(epicPath, epic); g("add", "."); g("commit", "-q", "-m", "Closeout EPIC-C");
      const r = reconcile(dir, { date: "2026-09-03" });
      expect(r.archived).toEqual(["EPIC-C"]);
      expect(r.settled).toEqual(["prd/capabilities.yaml#CAP-003"]);
      expect(r.proposed).toEqual(["OD-04"]);
      expect(r.versions).toEqual({ "tech-spec": "v0.0.3", tasks: "v0.0.3" });
      expect(readFileSync(`${dir}/.constitution/tech-spec/guidelines.md`, "utf8")).toMatch(/bun run bench[\s\S]*?exists: true/);
      expect(readFileSync(`${dir}/.constitution/tech-spec/guidelines.md`, "utf8")).toMatch(/name: cli-check[\s\S]*?exists: true/);
      expect(r.commit).toBeTruthy();
      expect(existsSync(`${dir}/.constitution/tasks/completed/EPIC-C-checking.yaml`)).toBe(true);
      expect(existsSync(epicPath)).toBe(false);
      const done = readFileSync(`${dir}/.constitution/tasks/completed/EPIC-C-checking.yaml`, "utf8");
      expect(done).toContain("milestones: 2");
      expect(done).toContain("review_rounds: 1");
      expect(done).not.toMatch(/^decisions:/m);
      expect(readFileSync(`${dir}/.constitution/prd/capabilities.yaml`, "utf8")).toMatch(/id: CAP-003[\s\S]*?certainty: settled/);
      expect(readFileSync(`${dir}/.constitution/reports/open-decisions.yaml`, "utf8")).toContain("proposed_by: EPIC-C @");
      expect(readFileSync(`${dir}/.constitution/tasks/critical-path.md`, "utf8")).toContain("EPIC-D");
      expect(r.report).toBe(".constitution/reports/2026-09-03-reconciliation.yaml");
      expect(r.routed).toContainEqual({ stage: "tech-spec", item: "code decision (pattern): Links are split on newlines rather than parsed [src/core/links.ts] at abc1234", from: "C" });
      expect(readFileSync(`${dir}/.constitution/reports/2026-09-03-reconciliation.yaml`, "utf8")).toContain("code decision (pattern)");
      expect(g("status", "--porcelain").trim()).toBe("");
      const bad = validate(dir).filter((x) => x.severity === "error");
      expect(bad.map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("check-plan", () => {
  const CLI = resolve(import.meta.dir, "cli.ts");
  const GOOD = `---
kind: epic
epic: EPIC-C
epic_file: .constitution/tasks/epics/EPIC-C-checking.yaml
planned_by: wave_lead
wave: 1
merge_position: 1
lanes_in_wave: 2
worktree: /tmp/fixture-cli-epic-C
branch: feat/epic-c-link-checking
base_branch: main
planned_at_commit: 0b37d5f
siblings:
  - { epic: EPIC-D, lead: epic-lead-d, branch: feat/epic-d-toc, merge_position: 2 }
models:
  epic_lead: { runtime: claude, model: opus }
  worker: { runtime: claude, model: opus }
  spec_patch_worker: { runtime: claude, model: sonnet }
  milestone_reviewer: { runtime: codex, model: gpt-5-codex }
  fix_worker: { runtime: claude, model: opus }
review_panel:
  - { runtime: claude, model: opus, mode: full }
  - { runtime: codex, model: gpt-5-codex, mode: full }
pr_review:
  fix_worker: { runtime: claude, model: opus }
  review_escalate_at: 4
  stop: one verification round with no new Act-on P0 or P1
autonomy:
  policy:
    - { trigger: blocker, action: adopt_recommendation }
    - { trigger: open_decision, action: adopt_recommendation }
    - { trigger: rebase_conflict, action: resolve_and_rereview }
    - { trigger: review_nonconvergence, action: escalate_strategy }
    - { trigger: test_failure, action: retry, max_attempts: 2 }
    - { trigger: plan_drift, action: escalate_wave_lead }
    - { trigger: spec_drift, action: amend_plan }
    - { trigger: budget_threshold, action: stop_lane }
    - { trigger: stall, action: retry, max_attempts: 1 }
budget:
  usage_ceiling_note: Weekly Opus usage is the constraint.
  threshold_pct: 70
  fallback_models:
    worker: { runtime: claude, model: sonnet }
liveness:
  stall_after_minutes: 30
  side_effects: [commit, push, pr_update, plan_amendment]
verbatim_project_rules:
  - Run the tests through bun run test.
open_decisions:
  - { id: OD-02, effect: FIX-C001 checks local Links only, interim: Local only }
---
# Plan for EPIC-C

## Milestones

M1 is free prose and is not checked.
`;
  const run = (file: string) => Bun.spawnSync(["bun", "run", CLI, "check-plan", file, "--root", `${FIX}/valid`, "--json"], { stdout: "pipe", stderr: "pipe" });

  test("accepts a plan in the documented shape", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-`);
    try {
      writeFileSync(`${dir}/EPIC-C.md`, GOOD);
      const r = run(`${dir}/EPIC-C.md`);
      expect(JSON.parse(r.stdout.toString())).toEqual([]);
      expect(r.exitCode).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("rejects a broken plan with one finding per rule", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-bad-`);
    try {
      const bad = GOOD
        .replace("epic_file: .constitution/tasks/epics/EPIC-C-checking.yaml", "epic_file: .constitution/tasks/epics/EPIC-D-toc.yaml")
        .replace("planned_by: wave_lead", "planned_by: self")
        .replace("  - { epic: EPIC-D,", "  - { epic: EPIC-B,")
        .replace("id: OD-02", "id: OD-99")
        .replace("  review_escalate_at: 4", "  review_escalate_at: 4\n  rounds: []")
        .replace("  threshold_pct: 70", "  threshold_pct: 170");
      writeFileSync(`${dir}/EPIC-C.md`, bad);
      const r = run(`${dir}/EPIC-C.md`);
      expect(r.exitCode).toBe(1);
      const found: any[] = JSON.parse(r.stdout.toString());
      expect([...new Set(found.map((x) => x.id))].sort()).toEqual(["PLAN-001", "PLAN-002", "PLAN-003", "PLAN-004", "PLAN-005"]);
      expect(found.filter((x) => x.id === "PLAN-001").map((x) => x.pointer).sort()).toEqual(["/budget/threshold_pct", "/pr_review/rounds"]);
      writeFileSync(`${dir}/none.md`, "# No front matter\n");
      expect(JSON.parse(run(`${dir}/none.md`).stdout.toString()).map((x: any) => x.id)).toEqual(["PLAN-000"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("accepts switch_to_fallback as the budget action", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-budget-`);
    try {
      writeFileSync(`${dir}/p.md`, GOOD.replace("    - { trigger: budget_threshold, action: stop_lane }", "    - { trigger: budget_threshold, action: switch_to_fallback }"));
      const r = run(`${dir}/p.md`);
      expect(JSON.parse(r.stdout.toString())).toEqual([]);
      expect(r.exitCode).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("accepts worktree_change as a liveness side effect", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-liveness-`);
    try {
      writeFileSync(`${dir}/p.md`, GOOD.replace("side_effects: [commit, push, pr_update, plan_amendment]", "side_effects: [commit, push, pr_update, plan_amendment, worktree_change]"));
      const r = run(`${dir}/p.md`);
      expect(JSON.parse(r.stdout.toString())).toEqual([]);
      expect(r.exitCode).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("PLAN-006 names every trigger the autonomy policy misses or repeats", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-policy-`);
    try {
      writeFileSync(`${dir}/p.md`, GOOD.replace("    - { trigger: spec_drift, action: amend_plan }\n", "").replace("    - { trigger: stall, action: retry, max_attempts: 1 }\n", ""));
      let found: any[] = JSON.parse(run(`${dir}/p.md`).stdout.toString());
      expect(found.map((x) => [x.id, x.pointer, x.message])).toEqual([["PLAN-006", "/autonomy/policy", "autonomy policy has no entry for spec_drift, stall; every trigger needs exactly one action"]]);
      writeFileSync(`${dir}/p.md`, GOOD.replace("    - { trigger: stall, action: retry, max_attempts: 1 }\n", "    - { trigger: stall, action: retry, max_attempts: 1 }\n    - { trigger: stall, action: stop_lane }\n    - { trigger: blocker, action: defer_tickets }\n"));
      const r = run(`${dir}/p.md`);
      expect(r.exitCode).toBe(1);
      found = JSON.parse(r.stdout.toString());
      expect(found.map((x) => [x.id, x.message])).toEqual([["PLAN-006", "autonomy policy has more than one entry for blocker, stall; every trigger needs exactly one action"]]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  // A wave bundle: the wave lead drafts every plan of the wave into one file.
  const PLAN_D = GOOD
    .replace("epic: EPIC-C", "epic: EPIC-D")
    .replace("epic_file: .constitution/tasks/epics/EPIC-C-checking.yaml", "epic_file: .constitution/tasks/epics/EPIC-D-toc.yaml")
    .replace("merge_position: 1\n", "merge_position: 2\n")
    .replace("  - { epic: EPIC-D, lead: epic-lead-d, branch: feat/epic-d-toc, merge_position: 2 }", "  - { epic: EPIC-C, lead: epic-lead-c, branch: feat/epic-c-link-checking, merge_position: 1 }")
    .replace("# Plan for EPIC-C", "# Plan for EPIC-D");

  test("check-plan validates each plan of a bundle and cross-checks siblings and merge positions", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-bundle-`);
    try {
      writeFileSync(`${dir}/wave-1.md`, `# Wave 1\n\nShared notes are not a plan.\n\n<!-- plan: EPIC-C -->\n${GOOD}\n<!-- plan: EPIC-D -->\n${PLAN_D}`);
      const good = run(`${dir}/wave-1.md`);
      expect(JSON.parse(good.stdout.toString())).toEqual([]);
      expect(good.exitCode).toBe(0);

      const badD = PLAN_D
        .replace("merge_position: 2\n", "merge_position: 1\n")
        .replace("  - { epic: EPIC-C, lead: epic-lead-c, branch: feat/epic-c-link-checking, merge_position: 1 }", "  - { epic: EPIC-B, lead: epic-lead-b, branch: feat/epic-b, merge_position: 3 }")
        .replace("id: OD-02", "id: OD-99");
      writeFileSync(`${dir}/wave-1.md`, `<!-- plan: EPIC-C -->\n${GOOD}\n<!-- plan: EPIC-D -->\n${badD}\n<!-- plan: EPIC-E -->\n\n# No front matter follows the marker\n`);
      const bad = run(`${dir}/wave-1.md`);
      expect(bad.exitCode).toBe(1);
      const found: any[] = JSON.parse(bad.stdout.toString());
      expect(found.map((x) => [x.id, x.message, x.pointer ?? null])).toEqual([
        ["PLAN-003", "EPIC-D: open decision OD-99 is not in reports/open-decisions.yaml", "/open_decisions/0"],
        ["PLAN-004", "EPIC-D: sibling EPIC-B is not an active epic", "/siblings/0"],
        ["PLAN-000", "EPIC-E: the marker for EPIC-E is not immediately followed by a --- front matter block", null],
        ["PLAN-007", "EPIC-C: sibling EPIC-D is listed at merge_position 2, but its plan says 1", "/siblings/0/merge_position"],
        ["PLAN-007", "EPIC-D: sibling EPIC-B has no plan in this bundle", "/siblings/0"],
        ["PLAN-007", "EPIC-C, EPIC-D all take merge_position 1; merge positions in a wave are unique", "/merge_position"],
      ]);
      // A marker that disagrees with the plan's epic, and a repeated marker.
      writeFileSync(`${dir}/wave-1.md`, `<!-- plan: EPIC-C -->\n${GOOD}\n<!-- plan: EPIC-C -->\n${PLAN_D}`);
      expect(JSON.parse(run(`${dir}/wave-1.md`).stdout.toString()).filter((x: any) => x.id === "PLAN-007").map((x: any) => x.message)).toEqual(expect.arrayContaining([
        "EPIC-C: the bundle has more than one plan marked EPIC-C",
        "EPIC-C: the marker says EPIC-C but the front matter's epic is EPIC-D",
      ]));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  // A standalone lane plan: no siblings, and no escalation to a wave lead.
  const lane = (kind: string, epic: string, epicFile = "none") => GOOD
    .replace("kind: epic", `kind: ${kind}`)
    .replace("epic: EPIC-C", `epic: ${epic}`)
    .replace("epic_file: .constitution/tasks/epics/EPIC-C-checking.yaml", `epic_file: ${epicFile}`)
    .replace("planned_by: wave_lead", "planned_by: self")
    .replace("  - { epic: EPIC-D, lead: epic-lead-d, branch: feat/epic-d-toc, merge_position: 2 }\n", "")
    .replace("siblings:\n", "siblings: []\n")
    .replace("    - { trigger: plan_drift, action: escalate_wave_lead }\n", "    - { trigger: plan_drift, action: amend_plan }\n");
  const runAt = (root: string, file: string) => Bun.spawnSync(["bun", "run", CLI, "check-plan", file, "--root", root, "--json"], { stdout: "pipe", stderr: "pipe" });

  test("requires kind, and a kind: epic plan keeps its epic file rules", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-kind-`);
    try {
      writeFileSync(`${dir}/p.md`, GOOD.replace("kind: epic\n", ""));
      expect(JSON.parse(run(`${dir}/p.md`).stdout.toString()).map((x: any) => [x.id, x.message])).toEqual([["PLAN-001", 'missing required "kind"']]);
      writeFileSync(`${dir}/p.md`, GOOD.replace("epic: EPIC-C", "epic: FAST-trim-output"));
      expect(JSON.parse(run(`${dir}/p.md`).stdout.toString()).map((x: any) => [x.id, x.pointer])).toEqual([["PLAN-001", "/epic"], ["PLAN-002", "/epic_file"]]);
      writeFileSync(`${dir}/p.md`, GOOD.replace("epic_file: .constitution/tasks/epics/EPIC-C-checking.yaml", "epic_file: none"));
      expect(JSON.parse(run(`${dir}/p.md`).stdout.toString()).map((x: any) => [x.id, x.pointer])).toEqual([["PLAN-001", "/epic_file"]]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a fast_lane plan names FAST-<slug> or ISSUE-<number>, has epic_file none, and is still cross-checked", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-fast-`);
    try {
      for (const id of ["FAST-trim-output", "ISSUE-42"]) {
        writeFileSync(`${dir}/p.md`, lane("fast_lane", id));
        const r = run(`${dir}/p.md`);
        expect(JSON.parse(r.stdout.toString())).toEqual([]);
        expect(r.exitCode).toBe(0);
      }
      writeFileSync(`${dir}/p.md`, lane("fast_lane", "EPIC-C", ".constitution/tasks/epics/EPIC-C-checking.yaml").replace("id: OD-02", "id: OD-99"));
      const bad: any[] = JSON.parse(run(`${dir}/p.md`).stdout.toString());
      expect(bad.map((x) => [x.id, x.pointer])).toEqual([["PLAN-001", "/epic"], ["PLAN-001", "/epic_file"], ["PLAN-003", "/open_decisions/0"]]);
      // A fast-lane plan needs a constitution to check against.
      const empty = mkdtempSync(`${tmpdir()}/constitution-plan-noconst-`);
      try {
        writeFileSync(`${dir}/p.md`, lane("fast_lane", "ISSUE-42"));
        expect(JSON.parse(runAt(empty, `${dir}/p.md`).stdout.toString()).map((x: any) => x.id)).toContain("PLAN-002");
      } finally { rmSync(empty, { recursive: true, force: true }); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a no_constitution plan skips the constitution cross-checks and accepts a root without .constitution", () => {
    const dir = mkdtempSync(`${tmpdir()}/constitution-plan-none-`);
    const empty = mkdtempSync(`${tmpdir()}/constitution-plan-bare-`);
    try {
      writeFileSync(`${dir}/p.md`, lane("no_constitution", "ISSUE-7").replace("id: OD-02", "id: OD-99"));
      const r = runAt(empty, `${dir}/p.md`);
      expect(JSON.parse(r.stdout.toString())).toEqual([]);
      expect(r.exitCode).toBe(0);
      writeFileSync(`${dir}/p.md`, lane("no_constitution", "ISSUE-7", ".constitution/tasks/epics/EPIC-C-checking.yaml").replace("    - { trigger: blocker, action: adopt_recommendation }", "    - { trigger: blocker, action: escalate_wave_lead }"));
      expect(JSON.parse(runAt(empty, `${dir}/p.md`).stdout.toString()).map((x: any) => [x.id, x.pointer])).toEqual([["PLAN-001", "/epic_file"], ["PLAN-005", "/autonomy/policy/0"]]);
    } finally { rmSync(dir, { recursive: true, force: true }); rmSync(empty, { recursive: true, force: true }); }
  });
});

describe("reconcile fast lane", () => {
  test("applies a settling fast-lane commit, routes one that strays into an epic, and advances the watermark", async () => {
    const { cpSync, readFileSync, writeFileSync } = await import("node:fs");
    const { reconcile } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-fastlane-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      expect(() => reconcile(dir, { date: "2026-09-05" })).toThrow(/no fast-lane commit/);
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s.trimEnd();\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: trim trailing whitespace from rendered Pages", "-m", "Constitution-Lane: fast\nSettles: prd/capabilities.yaml#CAP-002\nEvidence: src/core/render.ts");
      writeFileSync(`${dir}/src/core/toc.ts`, "export const toc = () => [];\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: empty table of contents", "-m", "Constitution-Lane: fast");
      writeFileSync(`${dir}/README.md`, "# Fixture\n"); g("add", "."); g("commit", "-q", "-m", "docs: readme without a lane");
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s.trim();\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: trim leading whitespace for FIX-C001", "-m", "Constitution-Lane: fast");
      writeFileSync(`${dir}/src/core/toc.ts`, "export const toc = () => [] as string[];\n"); writeFileSync(`${dir}/src/core/links.ts`, "export const links = () => [];\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: shared helper for toc and links", "-m", "Constitution-Lane: fast");

      const r = reconcile(dir, { date: "2026-09-05" });
      expect(r.applied).toEqual([]);
      expect(r.fastLane.map((c) => [c.subject, c.status])).toEqual([
        ["fix: trim trailing whitespace from rendered Pages", "applied"],
        ["fix: empty table of contents", "applied"],
        ["fix: trim leading whitespace for FIX-C001", "routed"],
        ["fix: shared helper for toc and links", "routed"],
      ]);
      // Inside one active epic's paths: applied, with a routed warning naming the epic.
      expect(r.fastLane[1].overlap).toBe("EPIC-D");
      expect(r.routed.some((x) => x.from === "fast-lane" && x.item.includes("was applied but touches paths EPIC-D owns"))).toBe(true);
      expect(r.fastLane[2].reason).toMatch(/^names ticket FIX-C001/);
      expect(r.fastLane[3].reason).toMatch(/touches paths owned by EPIC-C and EPIC-D/);
      expect(r.settled).toEqual(["prd/capabilities.yaml#CAP-002"]);
      expect(readFileSync(`${dir}/.constitution/prd/capabilities.yaml`, "utf8")).toMatch(/id: CAP-002[\s\S]*?certainty: settled[\s\S]*?ref: src\/core\/render\.ts/);
      const log = readFileSync(`${dir}/.constitution/tasks/changelog.yaml`, "utf8");
      expect(log).toContain("fixed:");
      expect(log).toMatch(/fix: trim trailing whitespace from rendered Pages \([0-9a-f]{7,}, fast lane\)/);
      expect(log).toMatch(/fix: empty table of contents \([0-9a-f]{7,}, fast lane\)/);
      expect(log).not.toContain("fix: trim leading whitespace for FIX-C001 (");
      expect(log).toMatch(/fast_lane_through: "?[0-9a-f]{40}/);
      expect(readFileSync(`${dir}/.constitution/reports/2026-09-05-reconciliation.yaml`, "utf8")).toContain("fast_lane:");
      expect(r.commit).toBeTruthy();
      expect(validate(dir).filter((x) => x.severity === "error").map((x) => `${x.id} ${x.message}`)).toEqual([]);
      expect(() => reconcile(dir, { date: "2026-09-06" })).toThrow(/nothing to reconcile/);

      // A second run the same day writes -2 instead of overwriting the first report.
      const first = readFileSync(`${dir}/.constitution/reports/2026-09-05-reconciliation.yaml`, "utf8");
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s;\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: undo trim for FIX-C002", "-m", "Constitution-Lane: fast");
      const again = reconcile(dir, { date: "2026-09-05" });
      expect(again.report).toBe(".constitution/reports/2026-09-05-reconciliation-2.yaml");
      expect(readFileSync(`${dir}/.constitution/reports/2026-09-05-reconciliation.yaml`, "utf8")).toBe(first);
      expect(readFileSync(`${dir}/.constitution/reports/2026-09-05-reconciliation-2.yaml`, "utf8")).toContain("names ticket FIX-C002");
      expect(validate(dir).filter((x) => x.severity === "error").map((x) => `${x.id} ${x.message}`)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("Settles needs an explicit Evidence path that exists at that commit", async () => {
    const { cpSync, readFileSync } = await import("node:fs");
    const { reconcile } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-fastlane-evidence-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s.trimEnd();\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: trim with no evidence", "-m", "Constitution-Lane: fast\nSettles: prd/capabilities.yaml#CAP-002");
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s.trim();\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: trim with a missing evidence path", "-m", "Constitution-Lane: fast\nSettles: prd/capabilities.yaml#CAP-003\nEvidence: tests/links.test.ts");
      const r = reconcile(dir, { date: "2026-09-05" });
      expect(r.fastLane.map((c) => [c.subject, c.status, c.reason])).toEqual([
        ["fix: trim with no evidence", "routed", "has Settles without Evidence; name the repository path that proves the record in an Evidence trailer"],
        ["fix: trim with a missing evidence path", "routed", "names Evidence tests/links.test.ts, which does not exist at that commit"],
      ]);
      expect(r.settled).toEqual([]);
      const caps = readFileSync(`${dir}/.constitution/prd/capabilities.yaml`, "utf8");
      expect(caps).toMatch(/id: CAP-002[\s\S]*?certainty: assumed/);
      expect(caps).toMatch(/id: CAP-003[\s\S]*?certainty: assumed/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("reconciliation reports order by date, then by run number within a day", async () => {
    const { newestReconciliationReport, nextReconciliationReport, reconciliationReports } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-reports-`);
    try {
      mkdirSync(`${dir}/reports`);
      for (const n of ["2026-09-05-reconciliation-10.yaml", "2026-09-05-reconciliation-2.yaml", "2026-09-05-reconciliation.yaml", "2026-09-04-reconciliation-3.yaml", "open-decisions.yaml"]) writeFileSync(`${dir}/reports/${n}`, "x\n");
      expect(reconciliationReports(dir)).toEqual(["2026-09-04-reconciliation-3.yaml", "2026-09-05-reconciliation.yaml", "2026-09-05-reconciliation-2.yaml", "2026-09-05-reconciliation-10.yaml"]);
      expect(newestReconciliationReport(dir)).toBe("2026-09-05-reconciliation-10.yaml");
      expect(nextReconciliationReport(dir, "2026-09-05")).toBe("2026-09-05-reconciliation-11.yaml");
      expect(nextReconciliationReport(dir, "2026-09-06")).toBe("2026-09-06-reconciliation.yaml");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("settled record paths stay inside .constitution", () => {
  const ESCAPES = ["../config.yaml", ".constitution/../config.yaml", "prd/../../config.yaml", "/etc/hostname", "prd/link.yaml"];

  test("recordPath refuses absolute paths, .. segments, and symlinks that leave .constitution", async () => {
    const { symlinkSync } = await import("node:fs");
    const { recordPath, recordProblem } = await import("./lib/model.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-recordpath-`);
    try {
      mkdirSync(`${dir}/.constitution/prd`, { recursive: true });
      writeFileSync(`${dir}/config.yaml`, "secret: 1\n");
      writeFileSync(`${dir}/.constitution/prd/capabilities.yaml`, "capabilities: []\n");
      symlinkSync("../../config.yaml", `${dir}/.constitution/prd/link.yaml`);
      const cdir = `${dir}/.constitution`;
      for (const record of ESCAPES) expect("problem" in recordPath(cdir, record)).toBe(true);
      for (const record of ESCAPES) expect(recordProblem(cdir, record)).toMatch(/absolute path|\.\. segment|resolves outside/);
      expect(recordPath(cdir, ".constitution/prd/./capabilities.yaml#CAP-001")).toEqual({ rel: "prd/capabilities.yaml", path: `${cdir}/prd/capabilities.yaml` });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("validate reports an escaping closeout record as TSK-016", async () => {
    const found = await checksWith((m) => {
      m.epics.find((e: any) => e.active && e.data.id === "C").data.closeout = { tickets_completed: [], tickets_deferred: [], points_completed: 0, spec_patches: [], changelog_entries: [], routed_upstream: [], follow_ups: [], settled: [{ record: "../config.yaml", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: "2026-09-03" } }, { record: "/etc/hostname", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: "2026-09-03" } }] };
    });
    expect(found.filter((x) => x.id === "TSK-016").map((x) => x.pointer)).toEqual(["/closeout/settled/0", "/closeout/settled/1"]);
  });

  test("reconcile routes an escaping closeout record or Settles trailer and writes nothing outside .constitution", async () => {
    const { cpSync, readFileSync } = await import("node:fs");
    const { reconcile } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-traversal-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      writeFileSync(`${dir}/config.yaml`, "certainty: assumed\n");
      const epicPath = `${dir}/.constitution/tasks/epics/EPIC-C-checking.yaml`;
      writeFileSync(epicPath, readFileSync(epicPath, "utf8") + "closeout:\n  tickets_completed: []\n  tickets_deferred: []\n  points_completed: 0\n  spec_patches: []\n  changelog_entries: []\n  routed_upstream: []\n  follow_ups: []\n  settled:\n    - record: ../config.yaml\n      evidence: { kind: repository, ref: src/core/render.ts, version: \"0000000\", date: \"2026-09-03\" }\n");
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      writeFileSync(`${dir}/src/core/render.ts`, "export const render = (s: string) => s.trimEnd();\n"); g("add", ".");
      g("commit", "-q", "-m", "fix: trim trailing whitespace", "-m", "Constitution-Lane: fast\nSettles: .constitution/../config.yaml\nEvidence: src/core/render.ts");
      const r = reconcile(dir, { date: "2026-09-05" });
      expect(r.settled).toEqual([]);
      expect(r.routed.filter((x) => x.item.includes("config.yaml")).map((x) => x.item)).toEqual([
        "could not settle ../config.yaml: ../config.yaml has a .. segment; name a path inside .constitution/",
        expect.stringMatching(/^fast-lane commit [0-9a-f]+ could not settle \.constitution\/\.\.\/config\.yaml: \.constitution\/\.\.\/config\.yaml has a \.\. segment/),
      ]);
      expect(readFileSync(`${dir}/config.yaml`, "utf8")).toBe("certainty: assumed\n");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("reconcile --epic", () => {
  test("accepts C and EPIC-C, and a filter that matches nothing is a clean error", async () => {
    const { cpSync, readFileSync, writeFileSync } = await import("node:fs");
    const dir = mkdtempSync(`${tmpdir()}/constitution-reconcile-epic-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    const cli = (...args: string[]) => Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "reconcile", "--root", dir, "--date", "2026-09-07", ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      const epicPath = `${dir}/.constitution/tasks/epics/EPIC-C-checking.yaml`;
      writeFileSync(epicPath, readFileSync(epicPath, "utf8") + "closeout:\n  tickets_completed: []\n  tickets_deferred: []\n  points_completed: 0\n  spec_patches: []\n  changelog_entries: []\n  routed_upstream: []\n  follow_ups: []\n  settled: []\n");
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      // History has no fast-lane commit, so only the filter decides.
      const noMatch = cli("--epic", "EPIC-Z");
      expect(noMatch.exitCode).toBe(2);
      expect(noMatch.stderr.toString()).toContain("--epic EPIC-Z matches no active epic that carries a closeout (ready: EPIC-C)");
      expect(noMatch.stderr.toString()).not.toContain("    at ");
      expect(cli("--epic").exitCode).toBe(2);
      for (const form of ["C", "EPIC-C"]) {
        const r = cli("--epic", form, "--no-commit", "--json");
        expect(r.exitCode).toBe(0);
        expect(JSON.parse(r.stdout.toString()).applied).toEqual(["EPIC-C"]);
        g("reset", "-q", "--hard"); g("clean", "-qfd");
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

test("migrates the field-list markdown format without dropping records", async () => {
  const { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { migrate } = await import("./lib/migrate.ts");
  const dir = mkdtempSync(`${tmpdir()}/constitution-migrate-alt-`);
  try {
    cpSync(`${FIX}/markdown-alt`, dir, { recursive: true });
    const r = migrate(dir, { date: "2026-09-03" });
    const y = (p: string) => readFileSync(`${dir}/.constitution/${p}`, "utf8");
    expect(y("constitution.yaml")).toContain("CLI/Tooling");
    expect(y("constitution.yaml")).toContain("Web/Cloud");
    expect(y("prd/jobs.yaml")).toContain("Provision reproducible environments");
    expect(y("prd/capabilities.yaml")).toContain("legacy_id: SURF-01");
    expect(y("prd/capabilities.yaml")).toContain("legacy_id: SURF-02");
    expect(y("prd/capabilities.yaml")).toContain("jobs: [JOB-02]");
    expect(y("prd/constraints.yaml")).toContain("legacy_id: Con-001");
    expect(y("prd/constraints.yaml")).toContain("binary");
    expect(y("prd/constraints.yaml")).toContain('goal: "≤ 3 seconds"');
    expect(y("prd/constraints.yaml")).toContain('stretch: "≤ 1 second"');
    expect(y("architecture/boundaries.yaml")).toContain("name: Skr Client");
    expect(y("architecture/boundaries.yaml")).toContain("name: Core Daemon");
    const bnd = y("architecture/boundaries.yaml");
    const daemonId = /id: (BND-\d+)\n\s+legacy_id: Core Daemon/.exec(bnd)?.[1];
    expect(daemonId).toBeDefined();
    expect(bnd.split("name: Skr Client")[1]).toContain(`depends_on: [${daemonId}]`);
    expect(y("tech-spec/stack.yaml")).toContain("name: clap");
    expect(y("tech-spec/stack.yaml")).toContain("4.6");
    expect(y("tech-spec/stack.yaml")).toContain("justification: Command-line parsing with derive macros");
    expect(y("tech-spec/stack.yaml")).toContain("1.98.0");
    expect(y("tech-spec/guidelines.md")).toContain("## Migrated from stack.md");
    expect(y("tech-spec/guidelines.md")).toContain("### Starlark dialect");
    expect(existsSync(`${dir}/.constitution/tech-spec/stack.md`)).toBe(false);
    const epic = y("tasks/epics/EPIC-C-seed-and-direct-image.yaml");
    expect(epic).toContain("name: Seed and direct-image admission");
    expect(epic).toContain("Skrpkgs/bootstrap/seed.toml");
    expect(epic.split("out:")[1].slice(0, 200)).toContain("Skrpkgs");
    expect(y("prd/capabilities.yaml")).toContain("legacy_id: CAP-ACCESS-001");
    expect(y("prd/constraints.yaml")).toContain("statement: Tenant scale");
    expect(y("prd/constraints.yaml")).toContain("meter: Count of production Tenants");
    expect(y("architecture/boundaries.yaml")).toContain("name: Cargo module");
    expect(y("architecture/boundaries.yaml")).not.toContain("name: Domain module boundaries");
    expect(y("prd/capabilities.yaml")).toContain("legacy_id: CAP-GOV-001");
    expect(y("prd/constraints.yaml")).toContain("statement: Search Latency");
    expect(y("prd/constraints.yaml")).toContain("legacy_id: search-latency");
    expect(y("architecture/boundaries.yaml")).toContain("name: Experience Shell");
    expect(y("architecture/boundaries.yaml")).toContain("kind: container");
    expect(y("tech-spec/stack.yaml")).not.toContain("Canonical AST");
    expect(y("tech-spec/stack.yaml")).not.toContain("pulldown-cmark");
    expect(epic).toContain("All production crates");
    expect(epic).toContain("Given an empty Store");
    expect(epic).not.toContain("paths: [crates/skr-store, Skrpkgs/bootstrap/seed.toml, All");
    expect(y("tech-spec/guidelines.md")).toContain("command: cargo bench -p skr-core");
    expect(y("prd/constraints.yaml")).toContain("Flags: spike-gated");
    expect(y("prd/constraints.yaml")).toContain("No public benchmark validates the 1 ms figure");
    expect(bnd.split("name: Core Daemon")[1].split("name:")[0]).toContain("trust_boundary: true");
    expect(epic).toContain("depends_on: [SKA-C001]");
    expect(y("reports/open-decisions.yaml")).toContain("id: OD-01");
    expect(y("reports/open-decisions.yaml")).toContain("What measured rule lets the audit accept");
    expect(existsSync(`${dir}/.constitution/tasks/active/EPIC-B1-kernel.md`)).toBe(true);
    expect(r.todo.some((t) => t.includes("EPIC-B1-kernel.md"))).toBe(true);
    const findings = validate(dir);
    expect(findings.filter((x) => ["SCH-000", "STR-001", "STR-003", "STR-004"].includes(x.id)).map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("commandResolves checks every segment and script path", async () => {
  const { loadModel } = await import("./lib/model.ts");
  const { commandResolves } = await import("./lib/repo.ts");
  const m = loadModel(`${FIX}/valid`);
  expect(commandResolves(m, "bun test")).toBe(true);
  expect(commandResolves(m, "bun test && ./scripts/does-not-exist.sh --strict")).toBe(false);
  expect(commandResolves(m, "bash scripts/does-not-exist.sh")).toBe(false);
  expect(commandResolves(m, "bun test; definitely-not-a-binary-xyz")).toBe(false);
});

describe("partial constitutions", () => {
  function tempRoot(): { dir: string; cleanup: () => void } {
    const dir = mkdtempSync(`${tmpdir()}/constitution-shape-`);
    return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  }

  function put(root: string, rel: string, content: string): void {
    const p = join(root, ".constitution", rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content.endsWith("\n") ? content : content + "\n");
  }

  function p0Prd(root: string): void {
    put(root, "prd/jobs.yaml", `jobs:
  - id: JOB-01
    actor: Operator
    statement: Check a note for broken links
    priority: P0
    certainty: assumed
    assumption: Greenfield; not yet observed.
`);
    put(root, "prd/capabilities.yaml", `capabilities:
  - id: CAP-001
    group: Checking
    priority: P0
    statement: The product shall report broken links in a note
    rationale: The primary job.
    jobs: [JOB-01]
    certainty: assumed
    assumption: Greenfield; not yet observed.
`);
  }

  function architectureStub(root: string): void {
    put(root, "architecture/boundaries.yaml", "boundaries: []\nedges: []\n");
    put(root, "architecture/changelog.yaml", `entries:
  - version: v0.0.1
    date: "2026-09-03"
    added: [Started]
    by: stage
    upstream: { prd: v0.0.1 }
`);
    put(root, "architecture/strategy.md", "# Strategy\n\nNot written yet.\n");
    put(root, "architecture/containers.md", "# Containers\n\nNot written yet.\n");
    put(root, "architecture/resilience.md", "# Resilience\n\nNot written yet.\n");
    put(root, "architecture/risks.md", "# Risks\n\nNot written yet.\n");
  }

  function techSpecStub(root: string, commands: string): void {
    put(root, "tech-spec/stack.yaml", `bill_of_materials: []
compatibility_policy:
  pinning: Not written yet.
  lockfiles: []
  upgrade_boundaries: Not written yet.
`);
    put(root, "tech-spec/changelog.yaml", `entries:
  - version: v0.0.1
    date: "2026-09-03"
    added: [Started]
    by: stage
    upstream: { prd: v0.0.1, architecture: v0.0.1 }
`);
    put(root, "tech-spec/guidelines.md", `---
verification_commands:
${commands}
layout: []
commit_convention: Not written yet.
---
# Guidelines
`);
  }

  test("a Stage 1 constitution with P0 jobs does not require flows", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      p0Prd(dir);
      const findings = validate(dir);
      const errors = findings.filter((x) => x.severity === "error");
      expect(errors.map((x) => `${x.id} ${x.file}`)).toEqual([]);
      expect(findings.some((x) => x.id === "PRD-001")).toBe(false);
      expect(findings.some((x) => x.id === "PRD-002")).toBe(false);
      expect(findings.some((x) => x.id === "STR-001")).toBe(false);
    } finally { cleanup(); }
  });

  test("P0 coverage errors once architecture is present without flows", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      p0Prd(dir);
      architectureStub(dir);
      const ids = new Set(validate(dir).filter((x) => x.severity === "error").map((x) => x.id));
      expect(ids.has("PRD-001")).toBe(true);
      expect(ids.has("PRD-002")).toBe(true);
    } finally { cleanup(); }
  });

  test("an incomplete architecture stage still requires its files", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      put(dir, "architecture/strategy.md", "# Strategy\n\nDraft.\n");
      const errors = validate(dir).filter((x) => x.id === "STR-001");
      expect(errors.some((x) => x.file.endsWith("architecture/boundaries.yaml"))).toBe(true);
      expect(errors.some((x) => x.file.endsWith("architecture/changelog.yaml"))).toBe(true);
    } finally { cleanup(); }
  });

  test("exists:false commands are not TS-002 until tasks exist", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = await tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      architectureStub(dir);
      techSpecStub(dir, `  - name: test
    command: bun test
    exists: false
`);
      expect(validate(dir).some((x) => x.id === "TS-002")).toBe(false);
      put(dir, "tasks/changelog.yaml", `entries:
  - version: v0.0.1
    date: "2026-09-03"
    added: [Started]
    by: stage
`);
      mkdirSync(`${dir}/.constitution/tasks/epics`, { recursive: true });
      expect(validate(dir).some((x) => x.id === "TS-002")).toBe(true);
    } finally { cleanup(); }
  });

  test("a later stage without its upstream requires the upstream files", async () => {
    const { dir, cleanup } = tempRoot();
    try {
      mkdirSync(`${dir}/.constitution/tasks/epics`, { recursive: true });
      writeFileSync(`${dir}/.constitution/constitution.yaml`, `schema_version: 1
acronym: NEW
archetype:
  primary: CLI/Tooling
  confidence: low
  rationale: Test.
surfaces: []
`);
      writeFileSync(`${dir}/.constitution/tasks/changelog.yaml`, `entries:
  - version: v0.0.1
    date: "2026-09-03"
    added: [Started]
    by: stage
`);
      const errors = validate(dir).filter((x) => x.id === "STR-001");
      expect(errors.some((x) => x.file.endsWith("prd/jobs.yaml"))).toBe(true);
      expect(errors.some((x) => x.file.endsWith("architecture/boundaries.yaml"))).toBe(true);
      expect(errors.some((x) => x.file.endsWith("tech-spec/stack.yaml"))).toBe(true);
    } finally { cleanup(); }
  });

  test("a Stage 1 constitution requires the open-decisions register", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      unlinkSync(`${dir}/.constitution/reports/open-decisions.yaml`);
      const errors = validate(dir).filter((x) => x.id === "STR-001");
      expect(errors.some((x) => x.file.endsWith("reports/open-decisions.yaml"))).toBe(true);
    } finally { cleanup(); }
  });

  test("an interview-only constitution with no stages validates", async () => {
    const { dir, cleanup } = tempRoot();
    try {
      mkdirSync(`${dir}/.constitution/reports`, { recursive: true });
      writeFileSync(`${dir}/.constitution/reports/open-decisions.yaml`, "decisions: []\n");
      const errors = validate(dir).filter((x) => x.severity === "error");
      expect(errors.map((x) => `${x.id} ${x.file} ${x.message}`)).toEqual([]);
      expect(validate(dir).some((x) => x.id === "INFO-SHAPE" && x.message === "no stage directories yet")).toBe(true);
    } finally { cleanup(); }
  });

  test("render refuses when tasks has not been executed", async () => {
    const { initConstitution } = await import("./lib/init.ts");
    const { dir, cleanup } = tempRoot();
    try {
      initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
      const r = Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "render", "--root", dir], { stdout: "pipe", stderr: "pipe" });
      expect(r.exitCode).toBe(2);
      expect(r.stderr.toString()).toContain("Stage 4 has not been executed");
    } finally { cleanup(); }
  });
});

/** Runs every check on the valid fixture after an in-memory change, so one test seeds one violation. */
async function checksWith(mutate: (m: any) => void) {
  const { loadModel } = await import("./lib/model.ts");
  const { runChecks } = await import("./lib/checks.ts");
  const { SchemaSet } = await import("./lib/schema.ts");
  const m = loadModel(`${FIX}/valid`);
  mutate(m);
  return runChecks(m, { schemas: new SchemaSet(resolve(import.meta.dir, "../assets/schemas")) });
}

describe("derive", () => {
  const CLI = resolve(import.meta.dir, "cli.ts");
  test("is clean on the valid fixture", () => {
    const r = Bun.spawnSync(["bun", "run", CLI, "derive", "--root", `${FIX}/valid`, "--json"], { stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout.toString()).findings).toEqual([]);
  });

  test("reports drift with exit 1, then --write applies DRV-001 and DRV-002 with a derive changelog entry", async () => {
    const { cpSync, readFileSync, writeFileSync } = await import("node:fs");
    const dir = mkdtempSync(`${tmpdir()}/constitution-derive-`);
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      const edit = (p: string, from: string, to: string) => writeFileSync(`${dir}/${p}`, readFileSync(`${dir}/${p}`, "utf8").replace(from, to));
      edit("package-lock.json", '"node_modules/typescript": { "version": "5.9.2" }', '"node_modules/typescript": { "version": "5.9.3" }');
      edit(".constitution/tech-spec/guidelines.md", "  - { path: src/core, purpose: Core library (BND-02) }", "  - { path: src/core, purpose: Core library (BND-02), exists: false }\n  - { path: src/web, purpose: Web preview }");
      edit(".constitution/tech-spec/stack.yaml", "compatibility_policy:", "  - { name: left-pad, role: library, version: 1.3.0, ecosystem: npm, certainty: assumed, assumption: Planned. }\ncompatibility_policy:");
      edit("package.json", '"test": "bun test",', '"test": "bun test",\n    "bench": "bun test",');
      const run = (...extra: string[]) => Bun.spawnSync(["bun", "run", CLI, "derive", "--root", dir, "--date", "2026-09-04", "--json", ...extra], { stdout: "pipe", stderr: "pipe" });
      const before = run();
      expect(before.exitCode).toBe(1);
      const ids = JSON.parse(before.stdout.toString()).findings.map((x: any) => x.id).sort();
      expect(ids).toEqual(["DRV-001", "DRV-002", "DRV-002", "DRV-003", "DRV-003"]);
      expect(readFileSync(`${dir}/.constitution/tech-spec/stack.yaml`, "utf8")).toContain("version: 5.9.2");

      const applied = run("--write");
      expect(applied.exitCode).toBe(0);
      const r = JSON.parse(applied.stdout.toString());
      expect(r.version).toBe("v0.0.3");
      expect(r.written).toEqual([".constitution/tech-spec/stack.yaml", ".constitution/tech-spec/guidelines.md", ".constitution/tech-spec/changelog.yaml"]);
      const stack = readFileSync(`${dir}/.constitution/tech-spec/stack.yaml`, "utf8");
      expect(stack).toMatch(/name: typescript[\s\S]*?version: "5\.9\.3"[\s\S]*?evidence:[\s\S]*?version: "5\.9\.3"[\s\S]*?date: "?2026-09-04/);
      const guidelines = readFileSync(`${dir}/.constitution/tech-spec/guidelines.md`, "utf8");
      expect(guidelines).toMatch(/path: src\/web[\s\S]*?exists: false/);
      expect(guidelines).not.toMatch(/path: src\/core[^\n]*\n[^\n]*\n\s+exists: false/);
      expect(guidelines).toContain("# Guidelines");
      const log = readFileSync(`${dir}/.constitution/tech-spec/changelog.yaml`, "utf8");
      expect(log).toMatch(/version: v0\.0\.3[\s\S]*?by: derive/);
      expect(validate(dir).filter((x) => x.severity === "error").map((x) => `${x.id} ${x.message}`)).toEqual([]);
      expect(run().exitCode).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("lockfiles that lock several versions of one package", () => {
  const CARGO_LOCK = `version = 4

[[package]]
name = "hashbrown"
version = "0.12.3"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "hashbrown"
version = "0.16.0"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "serde"
version = "1.0.228"
source = "registry+https://github.com/rust-lang/crates.io-index"
`;

  test("TS-004 and derive accept a pin equal to any locked version and report, never rewrite, an ambiguous one", async () => {
    const { cpSync, readFileSync } = await import("node:fs");
    const { derive } = await import("./lib/derive.ts");
    const { loadModel } = await import("./lib/model.ts");
    const { lockfileVersions } = await import("./lib/repo.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-cargo-`);
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      writeFileSync(`${dir}/Cargo.lock`, CARGO_LOCK);
      const stackPath = `${dir}/.constitution/tech-spec/stack.yaml`;
      const original = readFileSync(stackPath, "utf8");
      const pin = (hashbrown: string, serde = "1.0.228") => writeFileSync(stackPath, original.replace("compatibility_policy:", `  - { name: hashbrown, role: library, version: ${hashbrown}, ecosystem: cargo, certainty: assumed, assumption: Transitive. }\n  - { name: serde, role: library, version: ${serde}, ecosystem: cargo, certainty: assumed, assumption: Direct. }\ncompatibility_policy:`));
      expect(lockfileVersions(loadModel(dir), "hashbrown", "cargo")).toEqual(["0.12.3", "0.16.0"]);
      expect(lockfileVersions(loadModel(dir), "tokio", "cargo")).toEqual([]);

      for (const v of ["0.12.3", "0.16.0"]) {
        pin(v);
        expect(validate(dir).filter((x) => x.id === "TS-004")).toEqual([]);
        expect(derive(dir, { date: "2026-09-04" }).findings).toEqual([]);
      }

      pin("0.15.0", "1.0.200");
      expect(validate(dir).filter((x) => x.id === "TS-004").map((x) => [x.severity, x.message])).toEqual([
        ["error", "hashbrown pinned 0.15.0 but lockfile has 0.12.3, 0.16.0"],
        ["error", "serde pinned 1.0.200 but lockfile has 1.0.228"],
      ]);
      const r = derive(dir, { write: true, date: "2026-09-04" });
      expect(r.findings.map((x) => [x.id, x.applied, x.message])).toEqual([
        ["DRV-003", false, "hashbrown is pinned at 0.15.0 but the cargo lockfile locks 0.12.3, 0.16.0; set the pin to the version the project depends on directly"],
        ["DRV-001", true, "serde pinned 1.0.200 but the lockfile has 1.0.228"],
      ]);
      const stack = readFileSync(stackPath, "utf8");
      expect(stack).toMatch(/name: hashbrown[\s\S]*?version: "?0\.15\.0/);
      expect(stack).toMatch(/name: serde[\s\S]*?version: "?1\.0\.228/);
      // Only the ambiguous pin is left, and it is report-only: no drift.
      expect(derive(dir, { date: "2026-09-04" }).drift).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("estimate hygiene", () => {
  test("INFO-CAL reports calibration over planned estimates only", async () => {
    const found = await checksWith(() => {});
    expect(found.find((x) => x.id === "INFO-CAL")?.message).toBe("calibration: actual/estimate = 0.91 over 2 completed epics; 0 excluded");
    const migrated = await checksWith((m) => { m.epics.find((e: any) => e.data.id === "A").data.estimate_source = "migrated"; });
    expect(migrated.find((x) => x.id === "INFO-CAL")?.message).toBe("calibration: actual/estimate = 0.95 over 1 completed epics; 1 excluded");
  });

  test("TSK-015 warns on a missing active estimate and a planned estimate equal to actuals", async () => {
    const found = await checksWith((m) => { delete m.epics.find((e: any) => e.data.id === "D").data.estimated_diff_lines; m.epics.find((e: any) => e.data.id === "A").data.estimated_diff_lines = 310; });
    const tsk = found.filter((x) => x.id === "TSK-015");
    expect(tsk.map((x) => x.severity)).toEqual(["warning", "warning"]);
    expect(tsk.some((x) => x.file.endsWith("EPIC-D-toc.yaml"))).toBe(true);
    expect(tsk.some((x) => x.file.endsWith("EPIC-A-tooling.yaml"))).toBe(true);
  });

  test("migrate --repair-estimates marks equal-to-actuals epics backfilled, prints them, and commits nothing", async () => {
    const { cpSync, readFileSync, writeFileSync } = await import("node:fs");
    const dir = mkdtempSync(`${tmpdir()}/constitution-repair-`);
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      const epicA = `${dir}/.constitution/tasks/completed/EPIC-A-tooling.yaml`;
      writeFileSync(epicA, readFileSync(epicA, "utf8").replace("estimated_diff_lines: 400", "estimated_diff_lines: 310"));
      expect(validate(dir).some((x) => x.id === "TSK-015")).toBe(true);
      const r = Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "migrate", "--repair-estimates", "--root", dir], { stdout: "pipe", stderr: "pipe" });
      expect(r.exitCode).toBe(0);
      expect(r.stdout.toString()).toContain(".constitution/tasks/completed/EPIC-A-tooling.yaml");
      const text = readFileSync(epicA, "utf8");
      expect(text).toContain("estimated_diff_lines: 310\nestimate_source: backfilled\n");
      expect(text).toContain("  - id: FIX-A001\n    title: Test runner, lint, and typecheck wired");
      const after = validate(dir);
      expect(after.some((x) => x.id === "TSK-015")).toBe(false);
      expect(after.find((x) => x.id === "INFO-CAL")?.message).toBe("calibration: actual/estimate = 0.95 over 1 completed epics; 1 excluded");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("live verification recipes", () => {
  const ticket = (m: any) => m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0];
  const recipe = (m: any) => m.guidelines.data.live_verification[0];

  test("a recipe without live_probe, or an undeclared recipe, is TSK-014", async () => {
    let found = await checksWith((m) => { ticket(m).acceptance.supplementary = []; });
    expect(found.some((x) => x.id === "TSK-014" && x.message.includes("live_probe is not among"))).toBe(true);
    found = await checksWith((m) => { ticket(m).acceptance.recipe = "web-smoke"; });
    expect(found.some((x) => x.id === "TSK-014" && x.message.includes("does not declare"))).toBe(true);
  });

  test("recipe commands and owners reuse TS-001 and TS-002; a manual drive is not resolved", async () => {
    let found = await checksWith((m) => { recipe(m).exists = true; delete recipe(m).owner; });
    expect(found.filter((x) => x.id === "TS-001").map((x) => x.message.match(/its (\w+) command/)?.[1])).toEqual(["launch", "doctor", "drive", "cleanup"]);
    found = await checksWith((m) => { Object.assign(recipe(m), { exists: true, drive_kind: "manual" }); delete recipe(m).owner; });
    expect(found.some((x) => x.id === "TS-001" && x.message.includes("drive command"))).toBe(false);
    found = await checksWith((m) => { recipe(m).owner = "FIX-B002"; });
    expect(found.some((x) => x.id === "TS-002" && x.message.includes("recipe cli-check"))).toBe(true);
  });
});

describe("evidence manifests", () => {
  const file = (m: any) => m.evidence[0].manifest.data.files[0];
  const evidenceFindings = (found: any[]) => found.filter((x) => x.id === "STR-005" || (x.id === "SCH-001" && x.file.includes("evidence/")));

  test("digests are optional on a log, and a result is accepted", async () => {
    const found = await checksWith((m) => { delete file(m).sha256; delete file(m).bytes; m.evidence[0].manifest.data.result = "not_met"; });
    expect(evidenceFindings(found)).toEqual([]);
  });

  test("a baseline or measurement file without a sha256 is STR-005, whatever its case or suffix", async () => {
    for (const role of ["baseline", "measurement", "Baseline", "measurements"]) {
      const found = await checksWith((m) => { delete file(m).sha256; file(m).role = role; });
      expect(found.some((x) => x.id === "STR-005" && x.message.includes(`a ${role} file needs a sha256`))).toBe(true);
    }
  });

  test("every file of a measured mode needs a sha256, even with bytes and no role", async () => {
    for (const mode of ["benchmark", "stat_threshold", "visual_regression"]) {
      const found = await checksWith((m) => { m.evidence[0].manifest.data.mode = mode; delete file(m).sha256; delete file(m).role; });
      expect(found.some((x) => x.id === "STR-005" && x.message.includes(`a ${mode} file needs a sha256`))).toBe(true);
    }
  });

  test("an unknown result is rejected by the schema", async () => {
    const found = await checksWith((m) => { m.evidence[0].manifest.data.result = "passed"; });
    expect(found.some((x) => x.id === "SCH-001" && x.file.includes("evidence/") && x.pointer === "/result")).toBe(true);
  });

  test("a done ticket whose evidence records fail or not_met is TSK-018", async () => {
    const ticket = (m: any) => m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0];
    for (const result of ["fail", "not_met"]) {
      const found = await checksWith((m) => { ticket(m).status = "done"; m.evidence[0].manifest.data.result = result; });
      expect(found.some((x) => x.id === "TSK-018" && x.severity === "error" && x.message.includes(`records result ${result}`))).toBe(true);
    }
    for (const result of ["pass", "owed"]) {
      const found = await checksWith((m) => { ticket(m).status = "done"; m.evidence[0].manifest.data.result = result; });
      expect(found.some((x) => x.id === "TSK-018")).toBe(false);
    }
  });

  const epicC = (m: any) => m.epics.find((e: any) => e.active && e.data.id === "C");
  const closeout = (followUps: string[]) => ({ tickets_completed: [], tickets_deferred: [], points_completed: 0, spec_patches: [], changelog_entries: [], candidate_terms: [], routed_upstream: [], follow_ups: followUps, code_decisions: [], settled: [] });

  test("owed evidence on a done ticket needs a closeout follow-up naming the ticket", async () => {
    let found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; m.evidence[0].manifest.data.result = "owed"; epicC(m).data.closeout = closeout([]); });
    expect(found.some((x) => x.id === "TSK-018" && x.message.includes("no closeout follow_ups entry names FIX-C001"))).toBe(true);
    found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; m.evidence[0].manifest.data.result = "owed"; epicC(m).data.closeout = closeout(["FIX-C001: the cli-check probe is owed; doctor failed twice"]); });
    expect(found.some((x) => x.id === "TSK-018")).toBe(false);
  });

  test("a follow-up or covers in the wrong shape is a schema error, not a crash", async () => {
    const found = await checksWith((m) => {
      epicC(m).data.tickets[0].status = "done";
      Object.assign(m.evidence[0].manifest.data, { result: "owed", covers: "FIX-C002" });
      epicC(m).data.closeout = { ...closeout([]), follow_ups: [{ "FIX-C001": "probe owed; doctor failed twice" }] };
    });
    expect(found.some((x) => x.id === "SCH-001" && x.pointer?.startsWith("/closeout/follow_ups"))).toBe(true);
    expect(found.some((x) => x.id === "SCH-001" && x.pointer === "/covers")).toBe(true);
  });

  test("TSK-018 also reads a manifest in the ticket's directory whose owner is mistyped", async () => {
    const found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; Object.assign(m.evidence[0].manifest.data, { owner: "FIX-C0001", result: "fail" }); });
    expect(found.some((x) => x.id === "TSK-018" && x.message.includes("records result fail"))).toBe(true);
  });

  test("after the closeout, a done live_probe ticket without live_probe evidence is TSK-019", async () => {
    let found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; epicC(m).data.closeout = closeout([]); });
    expect(found.some((x) => x.id === "TSK-019" && x.severity === "error" && x.message.includes("owns no live_probe evidence manifest"))).toBe(true);
    found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; m.evidence[0].manifest.data.mode = "live_probe"; epicC(m).data.closeout = closeout([]); });
    expect(found.some((x) => x.id === "TSK-019" && x.severity === "error" && x.message.includes("records no result"))).toBe(true);
    found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; Object.assign(m.evidence[0].manifest.data, { mode: "live_probe", result: "pass" }); epicC(m).data.closeout = closeout([]); });
    expect(found.some((x) => x.id === "TSK-019")).toBe(false);
    found = await checksWith((m) => { epicC(m).data.tickets[0].status = "done"; });
    expect(found.some((x) => x.id === "TSK-019")).toBe(false);
  });

  test("a shared probe manifest proves every ticket its covers lists", async () => {
    const shared = (m: any, result: string) => {
      epicC(m).data.tickets[0].status = "done";
      Object.assign(m.evidence[0].manifest.data, { owner: "FIX-X999", mode: "live_probe", result, covers: ["FIX-C001"] });
      m.evidence[0].dir = ".constitution/evidence/FIX-X999";
      epicC(m).data.closeout = closeout([]);
    };
    let found = await checksWith((m) => shared(m, "pass"));
    expect(found.some((x) => x.id === "TSK-019")).toBe(false);
    found = await checksWith((m) => shared(m, "fail"));
    expect(found.some((x) => x.id === "TSK-018" && x.message.includes("FIX-C001 is done"))).toBe(true);
  });

  test("a listed digest or byte count that differs is still STR-005", async () => {
    let found = await checksWith((m) => { file(m).sha256 = "0".repeat(64); });
    expect(found.some((x) => x.id === "STR-005" && x.message.includes("sha256 differs"))).toBe(true);
    found = await checksWith((m) => { file(m).bytes = 999; });
    expect(found.some((x) => x.id === "STR-005" && x.message.includes("manifest says 999"))).toBe(true);
  });
});

describe("sidecars that point into the code", () => {
  const planned = (m: any) => m.metas.find((x: any) => x.path.endsWith("check-report.meta.yaml"));

  const creatorScope = (m: any, paths: string[]) => { m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].scope.in = paths; };

  test("a planned artifact needs an active creator by owner or scope, and a settled one must exist", async () => {
    let found = await checksWith((m) => { planned(m).data.owner = "FIX-B002"; creatorScope(m, ["tests"]); });
    expect(found.some((x) => x.id === "TS-007" && x.message.includes("not an active ticket"))).toBe(true);
    found = await checksWith((m) => { delete planned(m).data.owner; creatorScope(m, ["tests"]); });
    expect(found.some((x) => x.id === "TS-007" && x.message.includes("no owner is set"))).toBe(true);
    // No owner, but an open ticket's scope covers the path (directly or through its directory): the ticket is the creator.
    for (const paths of [["tests", "docs/check-report.schema.json"], ["docs"]]) {
      found = await checksWith((m) => { delete planned(m).data.owner; creatorScope(m, paths); });
      expect(found.filter((x) => x.id === "TS-007" || x.id === "TS-009").map((x) => x.message)).toEqual([]);
    }
    // A stale owner does not matter while a scope creator exists; a done scope creator does not count.
    found = await checksWith((m) => { planned(m).data.owner = "FIX-B002"; });
    expect(found.some((x) => x.id === "TS-007")).toBe(false);
    found = await checksWith((m) => { delete planned(m).data.owner; m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].status = "done"; });
    expect(found.some((x) => x.id === "TS-007")).toBe(true);
    found = await checksWith((m) => { Object.assign(planned(m).data, { certainty: "settled", evidence: { kind: "repository", ref: "docs", date: "2026-09-03" } }); });
    expect(found.some((x) => x.id === "TS-007" && x.message.includes("does not exist"))).toBe(true);
  });

  test("both fields, neither field, and a path inside .constitution are TS-007", async () => {
    for (const change of [(d: any) => { d.artifact = "x.md"; }, (d: any) => { delete d.artifact_path; }, (d: any) => { d.artifact_path = ".constitution/tech-spec/contracts/x.json"; }]) {
      const found = await checksWith((m) => change(planned(m).data));
      expect(found.some((x) => x.id === "TS-007")).toBe(true);
    }
  });

  test("a deferred ticket is not a creator, by owner or by scope", async () => {
    const found = await checksWith((m) => { planned(m).data.pinned = true; m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].status = "deferred"; });
    expect(found.some((x) => x.id === "TS-007" && x.file.endsWith("check-report.meta.yaml"))).toBe(true);
    expect(found.some((x) => x.id === "TS-009" && x.file.endsWith("check-report.meta.yaml"))).toBe(true);
    // Blocked is still to be worked, so it stays a creator.
    const blocked = await checksWith((m) => { planned(m).data.pinned = true; m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].status = "blocked"; });
    expect(blocked.filter((x) => x.id === "TS-007" || x.id === "TS-009")).toEqual([]);
  });

  test("a pinned planned artifact is clean while an active unfinished ticket creates it", async () => {
    const found = await checksWith((m) => { planned(m).data.pinned = true; });
    expect(found.filter((x) => x.id === "TS-009")).toEqual([]);
  });

  test("a pinned planned artifact is TS-009 when no active unfinished ticket creates it", async () => {
    const creatorDone = await checksWith((m) => { planned(m).data.pinned = true; m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].status = "done"; });
    expect(creatorDone.some((x) => x.id === "TS-009")).toBe(true);
    const noCreator = await checksWith((m) => { planned(m).data.pinned = true; delete planned(m).data.owner; m.epics.find((e: any) => e.active && e.data.id === "C").data.tickets[0].scope.in = ["tests"]; });
    expect(noCreator.some((x) => x.id === "TS-009")).toBe(true);
  });

  test("a markdown file is a sidecar's companion only when the sidecar names it", async () => {
    const C = ".constitution/tech-spec/contracts";
    const withRaw = (names: string[]) => (m: any) => {
      m.rawArtifacts.push(...names.map((n) => `${C}/${n}`));
      m.epics.find((e: any) => e.active && e.data.id === "C").data.scope.tech_spec_patchable.push(...names.map((n) => `tech-spec/contracts/${n}`));
    };
    const cliFix = (m: any) => m.metas.find((x: any) => x.path.endsWith("cli-fix.meta.yaml"));
    // Named in `companion`: not a raw artifact.
    let found = await checksWith((m) => { planned(m).data.companion = "check-report.md"; cliFix(m).data.companion = "cli-fix.md"; withRaw(["check-report.md", "cli-fix.md"])(m); });
    expect(found.filter((x) => x.id === "TS-005" || x.id === "TSK-017").map((x) => `${x.id} ${x.file}`)).toEqual([]);
    // Named like a sidecar but not named by it: may be an undeleted legacy copy, so TS-005 says which fix applies.
    found = await checksWith(withRaw(["check-report.md", "cli-fix.md"]));
    const ts005 = found.filter((x) => x.id === "TS-005");
    expect(ts005.map((x) => x.file)).toEqual([`${C}/check-report.md`, `${C}/cli-fix.md`]);
    for (const x of ts005) expect(x.message).toContain("if this is the sidecar's companion, name it in `companion`; if it is a legacy copy of the artifact, delete it");
    expect(found.filter((x) => x.id === "TSK-017").length).toBe(2);
    // A legacy sidecar's stem is not enough either; naming the companion is.
    found = await checksWith((m) => { const s = planned(m); delete s.data.artifact_path; s.data.artifact = "check-report.json"; withRaw(["check-report.json", "check-report.md"])(m); });
    expect(found.filter((x) => x.id === "TS-005" && x.file.endsWith(".md")).map((x) => x.file)).toEqual([`${C}/check-report.md`]);
    found = await checksWith((m) => { const s = planned(m); delete s.data.artifact_path; s.data.artifact = "check-report.json"; s.data.companion = "check-report.md"; withRaw(["check-report.json", "check-report.md"])(m); });
    expect(found.filter((x) => x.id === "TS-005" && x.file.endsWith(".md")).map((x) => x.file)).toEqual([]);
    // No sidecar with that stem: still a raw artifact.
    found = await checksWith(withRaw(["orders.md"]));
    expect(found.filter((x) => x.id === "TS-005").map((x) => x.file)).toEqual([`${C}/orders.md`]);
    expect(found.some((x) => x.id === "TSK-017" && x.message.includes("orders.md"))).toBe(true);
  });

  test("patchable entries overlap with or without the .constitution prefix", async () => {
    const found = await checksWith((m) => { m.epics.find((e: any) => e.active && e.data.id === "D").data.scope.tech_spec_patchable = [".constitution/tech-spec/contracts/cli-fix.meta.yaml"]; });
    expect(found.some((x) => x.id === "TSK-009" && x.message.includes("may patch"))).toBe(true);
  });
});

describe("Stage 1 review checks", () => {
  /** A fresh Stage 1 constitution from init, with extra files written relative to the repository root. */
  async function stage1(files: Record<string, string> = {}): Promise<{ dir: string; cleanup: () => void }> {
    const { initConstitution } = await import("./lib/init.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-review-`);
    initConstitution(dir, { acronym: "NEW", archetype: "CLI/Tooling", date: "2026-09-03" });
    for (const [rel, content] of Object.entries(files)) { mkdirSync(join(dir, rel, ".."), { recursive: true }); writeFileSync(join(dir, rel), content); }
    return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  }
  const setSurfaces = (dir: string, globs: string[]) => {
    const p = `${dir}/.constitution/constitution.yaml`;
    writeFileSync(p, readFileSync(p, "utf8").replace(/^surfaces:(?:[ \t]+[^\n]*)?(?:\n[ \t]+-[^\n]*)*$/m, `surfaces: ${JSON.stringify(globs)}`));
  };

  test("STR-002 accepts each interview target in any case and names the targets for an unknown one", async () => {
    const accepted = ["prd", "PRD", "architecture", "Architecture", "techspec", "TechSpec", "tech-spec", "Tech-Spec", "tasks", "Tasks", "realign", "Realign"];
    const { dir, cleanup } = await stage1(Object.fromEntries([...accepted, "design", "PRD-notes"].map((t) => [`.constitution/reports/2026-09-25-interview-${t}.md`, "# Interview\n"])));
    try {
      const str = validate(dir).filter((x) => x.id === "STR-002");
      expect(str.map((x) => x.file).sort()).toEqual([".constitution/reports/2026-09-25-interview-PRD-notes.md", ".constitution/reports/2026-09-25-interview-design.md"]);
      for (const x of str) expect(x.message).toContain("is not one of prd, architecture, techspec, tech-spec, tasks, realign (any case)");
    } finally { cleanup(); }
  });

  test("migrate leaves an interview record in reports/ by the same rule STR-002 uses", async () => {
    const { cpSync, existsSync } = await import("node:fs");
    const { migrate } = await import("./lib/migrate.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-migrate-interview-`);
    try {
      cpSync(`${FIX}/markdown`, dir, { recursive: true });
      writeFileSync(`${dir}/.constitution/reports/2026-08-11-interview-TechSpec.md`, "# Interview\n");
      migrate(dir, { date: "2026-09-03" });
      expect(existsSync(`${dir}/.constitution/reports/2026-08-11-interview-TechSpec.md`)).toBe(true);
      expect(validate(dir).some((x) => x.id === "STR-002" && x.file.includes("interview"))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("init writes a research README that says it is exempt, and STR-006 exempts it", async () => {
    const { dir, cleanup } = await stage1();
    try {
      expect(readFileSync(`${dir}/.constitution/research/README.md`, "utf8")).toContain("this README is exempt");
      expect(validate(dir).some((x) => x.id === "STR-006")).toBe(false);
    } finally { cleanup(); }
  });

  test("GLS-003 warns on a surface glob that matches no file, and waits for an absent stage", async () => {
    const { initStage } = await import("./lib/init.ts");
    const { dir, cleanup } = await stage1({ "src/cli/main.ts": "export {};\n", "node_modules/pkg/index.js": "\n" });
    try {
      // init's tech-spec globs wait for tech-spec/, and so does a glob under architecture/.
      expect(validate(dir).some((x) => x.id === "GLS-003")).toBe(false);
      setSurfaces(dir, ["src/cli/**", "docs/**", "node_modules/**", ".constitution/architecture/flows/**", ".constitution/tech-spec/contracts/**"]);
      const gls = validate(dir).filter((x) => x.id === "GLS-003");
      expect(gls.map((x) => `${x.severity} ${x.pointer}`)).toEqual(["warning /surfaces/1", "warning /surfaces/2"]);
      expect(gls[0].message).toContain("surface docs/** matches no file");
      // Once the stage directory exists, its globs must match something.
      initStage(dir, "architecture", { date: "2026-09-03" });
      expect(validate(dir).filter((x) => x.id === "GLS-003").map((x) => x.pointer)).toEqual(["/surfaces/1", "/surfaces/2", "/surfaces/3"]);
      writeFileSync(`${dir}/.constitution/architecture/flows/check.md`, "---\n---\n");
      expect(validate(dir).filter((x) => x.id === "GLS-003").map((x) => x.pointer)).toEqual(["/surfaces/1", "/surfaces/2"]);
    } finally { cleanup(); }
  });

  test("PRD-005 resolves erDiagram entities to glossary terms and ignores other diagrams", async () => {
    const glossary = `terms:
  - { term: Note, definition: A source file., do_not_use: [] }
  - { term: Harness definition, definition: A harness description., do_not_use: [] }
  - { term: Jail root, definition: A confining directory., do_not_use: [] }
  - { term: Links, definition: References between notes., do_not_use: [] }
  - { term: Page, definition: Rendered output., do_not_use: [] }
`;
    const model = `# Domain model

\`\`\`mermaid
erDiagram
    NOTES ||--o{ LINK : "contains, in order"
    HARNESS_DEFINITION }o..|| "jail-root" : "confined to"
    NOTE ||--|| RENDERING : renders-to
    PAGE {
        string SECRET_FIELD PK "not an entity"
    }
    BUNDLE { string id }
    PERSON["Page"] ||--o{ NOTE : writes
\`\`\`

\`\`\`mermaid
stateDiagram-v2
    [*] --> DRAFTING
    DRAFTING --> PUBLISHED : publish
\`\`\`

\`\`\`mermaid
flowchart LR
    UNKNOWN_NODE --> OTHER_NODE
\`\`\`
`;
    const { dir, cleanup } = await stage1({ ".constitution/prd/glossary.yaml": glossary, ".constitution/prd/domain-model.md": model });
    try {
      const prd = validate(dir).filter((x) => x.id === "PRD-005");
      expect(prd.map((x) => x.severity)).toEqual(["warning", "warning"]);
      expect(prd.map((x) => x.message.split(" ")[2])).toEqual(["RENDERING", "BUNDLE"]);
      expect(prd[0].file).toBe(".constitution/prd/domain-model.md");
      // No glossary file: the check has nothing to resolve against and stays silent.
      unlinkSync(`${dir}/.constitution/prd/glossary.yaml`);
      expect(validate(dir).some((x) => x.id === "PRD-005")).toBe(false);
    } finally { cleanup(); }
  });

  test("PRD-005 is silent when the domain model is absent", async () => {
    const { dir, cleanup } = await stage1();
    try {
      unlinkSync(`${dir}/.constitution/prd/domain-model.md`);
      expect(validate(dir).some((x) => x.id === "PRD-005")).toBe(false);
    } finally { cleanup(); }
  });

  test("PRD-006 warns on a time constraint whose scale and meter name no statistic", async () => {
    const nfc = (m: any) => m.constraints.data.constraints[0];
    const prd006 = async (scale: string, meter: string) => (await checksWith((m) => Object.assign(nfc(m), { scale, meter }))).filter((x) => x.id === "PRD-006");
    // The fixture meter names a median.
    expect((await checksWith(() => {})).some((x) => x.id === "PRD-006")).toBe(false);
    const found = await prd006("Wall-clock milliseconds from start to exit", "bun run bench on the reference corpus");
    expect(found.map((x) => `${x.severity} ${x.pointer}`)).toEqual(["warning /constraints/0"]);
    expect(found[0].message).toContain("NFC-01 measures time");
    for (const [scale, meter] of [["Seconds to first byte", "Load test"], ["Latency of a status call", "Benchmark"], ["Response time of list", "Benchmark"], ["Duration of a spawn", "Benchmark"], ["Budget of 200ms per call", "Benchmark"], ["Time in ms", "Benchmark"], ["Time to render", "Stopwatch, 3 seconds or less"], ["Time to render", "Under 1 second on a laptop"]]) {
      expect((await prd006(scale, meter)).length).toBe(1);
    }
    for (const [scale, meter] of [["Milliseconds of added latency", "p95 over repeated calls"], ["Milliseconds of added latency", "95th percentile over repeated calls"], ["Seconds to settle", "Worst case over 50 runs"], ["Latency", "Mean and max over a day"], ["Duration", "p99.9 of spawns"]]) {
      expect((await prd006(scale, meter)).length).toBe(0);
    }
    // Not time: a rate, a size, a count, an ordinal, or "ms" that is not a unit.
    for (const [scale, meter] of [["Requests per second the server sustains", "Load test"], ["Megabytes of resident memory", "Peak over a turn"], ["Count of escapes", "Run the suite"], ["Breaking changes in the second release", "Diff the outputs"], ["Items listed in MS Word exports", "Count the forms"]]) {
      expect((await prd006(scale, meter)).length).toBe(0);
    }
  });
});

test("parseArgs collects positionals and never lets a boolean flag swallow one", async () => {
  const { parseArgs } = await import("./cli.ts");
  const a = parseArgs(["check-plan", "--json", "plan.md", "--root", "/tmp/x"]);
  expect(a.command).toBe("check-plan");
  expect(a.positionals).toEqual(["plan.md"]);
  expect(a.json).toBe(true);
  expect(a.root).toBe("/tmp/x");
  expect(parseArgs(["reconcile", "--epic", "C,D"]).flags.epic).toBe("C,D");
});

describe("duplicate YAML keys", () => {
  test("validate reports a repeated top-level key as YAML-001 and passes without it", async () => {
    const { cpSync } = await import("node:fs");
    const dir = mkdtempSync(`${tmpdir()}/constitution-dupkey-`);
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      const epicPath = `${dir}/.constitution/tasks/epics/EPIC-C-checking.yaml`;
      const original = readFileSync(epicPath, "utf8");
      const priority = /^estimated_diff_lines: .*$/m.exec(original)?.[0];
      expect(priority).toBeDefined();
      expect(validate(dir).filter((x) => x.severity === "error")).toEqual([]);
      writeFileSync(epicPath, original.replace(priority!, `${priority}\n${priority}`));
      const dup = validate(dir).filter((x) => x.id === "YAML-001");
      expect(dup.map((x) => `${x.severity} ${x.file}`)).toEqual(["error .constitution/tasks/epics/EPIC-C-checking.yaml"]);
      expect(dup[0].message).toContain('"estimated_diff_lines"');
      writeFileSync(epicPath, original);
      expect(validate(dir).some((x) => x.id === "YAML-001")).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("findDuplicateKey ignores the same key in sibling items, nested scopes, block scalars, and quoted text", async () => {
    const { findDuplicateKey } = await import("./lib/yaml.ts");
    const ok = "a: 1\nitems:\n  - id: 1\n    n: x\n  - id: 2\n    n: y\nb:\n  a: 2\ntext: |\n  a: 3\n  a: 4\nq: \"x\n  a: 5\n  a: 6\"\nflow: { a: 1, b: [1,\n  2] }\n";
    expect(findDuplicateKey(ok, "f.yaml")).toBeNull();
    expect(findDuplicateKey("items:\n  - id: 1\n    id: 2\n", "f.yaml")?.key).toBe("id");
    expect(findDuplicateKey("a:\n  b: 1\n  c: 2\n  b: 3\n", "f.yaml")?.line).toBe(4);
  });
});

describe("settles targets must be certainty-bearing records", () => {
  const EVIDENCE = '{ kind: repository, ref: src/core/render.ts, version: "0000000", date: "2026-09-03" }';

  test("validate reports TSK-016 for a closeout settles of guidelines.md", async () => {
    const found = await checksWith((m) => {
      m.epics.find((e: any) => e.active && e.data.id === "C").data.closeout = { tickets_completed: [], tickets_deferred: [], points_completed: 0, spec_patches: [], changelog_entries: [], routed_upstream: [], follow_ups: [], settled: [{ record: "tech-spec/guidelines.md", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: "2026-09-03" } }] };
    });
    expect(found.filter((x) => x.id === "TSK-016").map((x) => x.pointer)).toEqual(["/closeout/settled/0"]);
  });

  test("reconcile refuses a guidelines.md settles, leaves the file unchanged, and reports the refusal", async () => {
    const { cpSync } = await import("node:fs");
    const { reconcile } = await import("./lib/reconcile.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-settles-`);
    const g = (...args: string[]) => { const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error(r.stderr.toString()); return r.stdout.toString(); };
    try {
      cpSync(`${FIX}/valid`, dir, { recursive: true });
      const epicPath = `${dir}/.constitution/tasks/epics/EPIC-C-checking.yaml`;
      writeFileSync(epicPath, readFileSync(epicPath, "utf8") + `closeout:\n  tickets_completed: []\n  tickets_deferred: []\n  points_completed: 0\n  spec_patches: []\n  changelog_entries: []\n  routed_upstream: []\n  follow_ups: []\n  settled:\n    - record: tech-spec/guidelines.md\n      evidence: ${EVIDENCE}\n    - record: prd/capabilities.yaml#CAP-003\n      evidence: ${EVIDENCE}\n`);
      g("init", "-q", "-b", "main"); g("add", "."); g("commit", "-q", "-m", "Plan");
      const guidelines = `${dir}/.constitution/tech-spec/guidelines.md`;
      const before = readFileSync(guidelines, "utf8");
      const r = reconcile(dir, { date: "2026-09-05" });
      expect(readFileSync(guidelines, "utf8")).toBe(before);
      expect(r.settled).toEqual(["prd/capabilities.yaml#CAP-003"]);
      expect(r.refusedSettles).toEqual([{ file: ".constitution/tasks/epics/EPIC-C-checking.yaml", epic: "EPIC-C", settles: "tech-spec/guidelines.md", reason: expect.stringContaining("not a certainty-bearing record") }]);
      const report = readFileSync(`${dir}/${r.report}`, "utf8");
      expect(report).toContain("refused_settles:");
      expect(validate(dir).filter((x) => x.file.includes("reports/")).map((x) => `${x.id} ${x.message}`)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("recordProblem accepts sidecars and front-matter records that carry certainty, and refuses the rest", async () => {
    const { recordProblem } = await import("./lib/model.ts");
    const dir = mkdtempSync(`${tmpdir()}/constitution-recordkinds-`);
    try {
      const cdir = `${dir}/.constitution`;
      mkdirSync(`${cdir}/tech-spec/contracts`, { recursive: true });
      writeFileSync(`${cdir}/tech-spec/contracts/api.meta.yaml`, "surface: http\ncertainty: assumed\n");
      writeFileSync(`${cdir}/tech-spec/adr.md`, "---\nid: ADR-001\ncertainty: assumed\nchecks:\n  - { name: lint, certainty: assumed }\n  - { name: test }\n---\nbody\n");
      writeFileSync(`${cdir}/tech-spec/guidelines.md`, "---\nverification_commands: []\n---\n");
      expect(recordProblem(cdir, "tech-spec/contracts/api.meta.yaml")).toBeNull();
      expect(recordProblem(cdir, "tech-spec/adr.md")).toBeNull();
      expect(recordProblem(cdir, "tech-spec/adr.md#lint")).toBeNull();
      expect(recordProblem(cdir, "tech-spec/adr.md#test")).toMatch(/not a certainty-bearing record/);
      expect(recordProblem(cdir, "tech-spec/guidelines.md")).toMatch(/not a certainty-bearing record/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("YAML writer plain scalars", () => {
  test("quotes a scalar Bun's emitter quotes, such as a commit hash ending in e", async () => {
    const { toBlockYaml, parseYaml } = await import("./lib/yaml.ts");
    const out = toBlockYaml({ commit: "756874e", other: "6c0b74d" }, 0);
    expect(out).toContain('commit: "756874e"');
    expect(out).toContain("other: 6c0b74d");
    expect(parseYaml(out, "probe.yaml")).toEqual({ commit: "756874e", other: "6c0b74d" });
  });
});
