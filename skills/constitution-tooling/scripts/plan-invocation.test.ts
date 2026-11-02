import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { toBlockYaml } from "./lib/yaml.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const ROLE = { runtime: "codex", model: "fixture-model", reasoning_effort: "medium" };
const PLAN = {
  kind: "no_constitution", epic: "ISSUE-42", epic_file: "none", planned_by: "wave_lead",
  wave: 1, merge_position: 1, lanes_in_wave: 1, worktree: "/tmp/fixture-lane",
  branch: "feat/fixture", base_branch: "main", planned_at_commit: "fixture", siblings: [],
  models: { epic_lead: ROLE, worker: ROLE, spec_patch_worker: ROLE, milestone_reviewer: ROLE, fix_worker: ROLE },
  review_panel: [{ ...ROLE, mode: "full" }],
  pr_review: { fix_worker: ROLE, review_escalate_at: 4, stop: "Independent verification finds no new Act-on issue" },
  autonomy: { policy: [
    { trigger: "blocker", action: "adopt_recommendation" },
    { trigger: "open_decision", action: "adopt_recommendation" },
    { trigger: "plan_drift", action: "amend_plan" },
    { trigger: "spec_drift", action: "amend_plan" },
    { trigger: "test_failure", action: "retry", max_attempts: 2 },
    { trigger: "review_nonconvergence", action: "escalate_strategy" },
    { trigger: "rebase_conflict", action: "resolve_and_rereview" },
    { trigger: "budget_threshold", action: "switch_to_fallback" },
    { trigger: "stall", action: "retry", max_attempts: 1 },
  ] },
  budget: { usage_ceiling_note: "Fixture", threshold_pct: 70, fallback_models: { worker: ROLE } },
  liveness: { stall_after_minutes: 30, side_effects: ["commit"] },
  verbatim_project_rules: [], open_decisions: [],
};
const INVOCATION = {
  mode: "single_epic_wave", caller: "execute-wave: fixture-parent",
  effective_authority: "Binding envelope", stop_boundary: "Wave closeout",
};

function check(root: string, plan: unknown): { exitCode: number; findings: unknown } {
  const file = join(root, "plan.md");
  writeFileSync(file, `---\n${toBlockYaml(plan)}\n---\n`);
  const result = Bun.spawnSync(["bun", "run", CLI, "check-plan", file, "--root", root, "--json"], { stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, findings: JSON.parse(result.stdout.toString()) };
}

test("check-plan preserves legacy plans and validates direct-wave invocation through the CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "constitution-plan-invocation-"));
  try {
    expect(check(root, PLAN)).toEqual({ exitCode: 0, findings: [] });
    expect(check(root, { ...PLAN, invocation: INVOCATION })).toEqual({ exitCode: 0, findings: [] });
    expect(check(root, { ...PLAN, invocation: { ...INVOCATION, mode: "orchestrated" } })).toEqual({ exitCode: 0, findings: [] });
    expect(check(root, { ...PLAN, planned_by: "self", invocation: { ...INVOCATION, mode: "standalone" } })).toEqual({ exitCode: 0, findings: [] });

    const wrongMode = check(root, { ...PLAN, invocation: { ...INVOCATION, mode: "standalone" } });
    expect(wrongMode.exitCode).toBe(1);
    expect(wrongMode.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "PLAN-008", pointer: "/invocation/mode" })]));

    const extraLane = check(root, { ...PLAN, lanes_in_wave: 2, invocation: INVOCATION });
    expect(extraLane.exitCode).toBe(1);
    expect(extraLane.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "PLAN-008", pointer: "/lanes_in_wave" })]));

    const missingCaller = check(root, { ...PLAN, invocation: { ...INVOCATION, caller: "" } });
    expect(missingCaller.exitCode).toBe(1);
    expect(missingCaller.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "PLAN-001", pointer: "/invocation/caller" })]));

    const absentManager = check(root, {
      ...PLAN, invocation: INVOCATION,
      autonomy: { policy: PLAN.autonomy.policy.map((entry) => entry.trigger === "plan_drift" ? { ...entry, action: "escalate_wave_lead" } : entry) },
    });
    expect(absentManager.exitCode).toBe(1);
    expect(absentManager.findings).toEqual(expect.arrayContaining([expect.objectContaining({ id: "PLAN-005", pointer: "/autonomy/policy/2" })]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
