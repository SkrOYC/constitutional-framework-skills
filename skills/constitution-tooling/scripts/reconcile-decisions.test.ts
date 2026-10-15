import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validate } from "./cli.ts";
import { reconcile } from "./lib/reconcile.ts";
import { loadYamlFile, toBlockYaml } from "./lib/yaml.ts";

const FIXTURE = resolve(import.meta.dir, "../assets/fixtures/valid");
const DATE = "2026-09-03";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a YAML record");
  return Object.fromEntries(Object.entries(value));
}

function readDecisions(root: string): Record<string, unknown>[] {
  const data = record(loadYamlFile(join(root, ".constitution/reports/open-decisions.yaml")));
  if (!Array.isArray(data.decisions)) throw new Error("Expected the decision register");
  return data.decisions.map(record);
}

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

function closeout(root: string, id: string, decisions: unknown[]): void {
  const template = readFileSync(join(FIXTURE, ".constitution/tasks/epics/EPIC-C-checking.yaml"), "utf8")
    .replace(/^id: C$/m, `id: ${id}`).replaceAll("FIX-C", `FIX-${id}`).replaceAll("status: planned", "status: done");
  writeFileSync(join(root, `.constitution/tasks/epics/EPIC-${id}-checking.yaml`), template + "\n" + toBlockYaml({
    decisions,
    closeout: { tickets_completed: [`FIX-${id}001`, `FIX-${id}002`], tickets_deferred: [], points_completed: 5, spec_patches: [], changelog_entries: [], candidate_terms: [], routed_upstream: [], follow_ups: [], code_decisions: [], settled: [] },
  }) + "\n");
}

function withFixture(run: (root: string, decision: Record<string, unknown>) => void): void {
  const root = mkdtempSync(join(tmpdir(), "constitution-reconcile-decisions-"));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    const decision = readDecisions(root).find((entry) => entry.id === "OD-02");
    if (!decision) throw new Error("Fixture lacks OD-02");
    run(root, decision);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function ruled(decision: Record<string, unknown>): Record<string, unknown> {
  return { ...decision, status: "closed", ruler: "Wave lead under delegation", ruling: { ref: "Step-0 approval", date: DATE, summary: "Local targets only.", chosen: "Local only" } };
}

function apply(root: string) {
  git(root, "init", "-q", "-b", "main");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "Closeout decisions");
  const result = reconcile(root, { date: DATE });
  const errors = validate(root).filter((finding) => finding.severity === "error" && (finding.id.startsWith("OD-") || finding.id.startsWith("SCH-")));
  expect(errors).toEqual([]);
  expect(git(root, "status", "--porcelain")).toBe("");
  return result;
}

describe("reconcile decision rulings", () => {
  test("closes a matching open decision in place and preserves its context", () => withFixture((root, decision) => {
    closeout(root, "C", [ruled(decision)]);
    const result = apply(root);
    const after = readDecisions(root);
    expect(after).toHaveLength(3);
    expect(after.find((entry) => entry.id === "OD-02")).toEqual({ ...decision, status: "closed", ruler: "Wave lead under delegation", ruling: ruled(decision).ruling });
    expect(result.proposed).toEqual([]);
    expect(result.routed.some((entry) => entry.item.includes("OD-02 closed in place"))).toBe(true);
  }));

  test("deduplicates the same ruling carried by two epics", () => withFixture((root, decision) => {
    closeout(root, "C", [ruled(decision)]);
    closeout(root, "D", [ruled(decision)]);
    const result = apply(root);
    expect(result.archived).toEqual(["EPIC-C", "EPIC-D"]);
    expect(readDecisions(root).filter((entry) => entry.question === decision.question)).toHaveLength(1);
    expect(result.proposed).toEqual([]);
    expect(result.routed.filter((entry) => entry.item.includes("closed in place"))).toHaveLength(1);
  }));

  test("leaves an identical already closed ruling unchanged regardless of key order", () => withFixture((root, decision) => {
    const closed = ruled(decision);
    writeFileSync(join(root, ".constitution/reports/open-decisions.yaml"), toBlockYaml({ decisions: readDecisions(root).map((entry) => entry.id === decision.id ? closed : entry) }));
    closeout(root, "C", [{ ...closed, ruling: { chosen: "Local only", summary: "Local targets only.", date: DATE, ref: "Step-0 approval" } }]);
    const result = apply(root);
    expect(readDecisions(root)).toHaveLength(3);
    expect(readDecisions(root).find((entry) => entry.id === decision.id)).toEqual(closed);
    expect(result.proposed).toEqual([]);
    expect(result.routed.filter((entry) => /ruling|renumbered/.test(entry.item))).toEqual([]);
  }));

  test("routes a conflicting ruling without overwriting or duplicating the decision", () => withFixture((root, decision) => {
    closeout(root, "C", [ruled(decision)]);
    const conflicting = { ...ruled(decision), ruling: { ref: "Different approval", date: DATE, summary: "Include remote targets.", chosen: "Local plus HTTP HEAD" } };
    closeout(root, "D", [conflicting]);
    const result = apply(root);
    expect(readDecisions(root).filter((entry) => entry.question === decision.question)).toHaveLength(1);
    expect(readDecisions(root).find((entry) => entry.id === decision.id)?.ruling).toEqual(ruled(decision).ruling);
    expect(result.proposed).toEqual([]);
    const conflict = result.routed.find((entry) => entry.item.includes("conflicting ruling"));
    expect(conflict?.from).toBe("D");
    expect(conflict?.item).toContain("Different approval");
    expect(conflict?.item).toContain("Local plus HTTP HEAD");
    if (!result.report) throw new Error("Expected a routing report");
    expect(readFileSync(join(root, result.report), "utf8")).toContain("Different approval");
  }));

  test("reports a new ruled decision as closed rather than proposed", () => withFixture((root, decision) => {
    const fresh = { ...ruled(decision), id: "OD-98", question: "A newly approved question?" };
    closeout(root, "C", [fresh]);
    const result = apply(root);
    expect(readDecisions(root).find((entry) => entry.id === "OD-98")).toMatchObject(fresh);
    expect(result.proposed).toEqual([]);
    expect(result.routed.some((entry) => entry.item.includes("OD-98 added closed"))).toBe(true);
  }));

  test("renumbers a different question with a colliding id and keeps it proposed", () => withFixture((root, decision) => {
    closeout(root, "C", [{ ...decision, question: "A different unresolved question?", status: "proposed" }]);
    const result = apply(root);
    expect(result.proposed).toEqual(["OD-04"]);
    expect(readDecisions(root).find((entry) => entry.id === "OD-02")).toEqual(decision);
    expect(readDecisions(root).find((entry) => entry.id === "OD-04")).toMatchObject({ question: "A different unresolved question?", status: "proposed" });
  }));
});
