import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Finding } from "./lib/model.ts";
import { toBlockYaml } from "./lib/yaml.ts";

interface FixtureTicket {
  id: string;
  title: string;
  type: "Chore";
  effort: number;
  depends_on: string[];
  scope: { in: string[] };
  verification: { command: string; expected: string };
  description: string;
  acceptance: { mode: "invariant"; evidence: string };
  flows: string[];
  certainty: "assumed";
  status: "planned" | "done" | "deferred";
  deferred_to?: string;
  replaces?: string[];
}

interface FixtureResolution {
  source: string;
  outcome: "delivered" | "retired";
  evidence: { kind: "repository" | "ruling"; ref: string; date?: string; version?: string };
  reason?: string;
}

interface FixtureCloseout {
  tickets_completed: string[];
  tickets_deferred: { id: string; route: string; reason: string }[];
  points_completed: number;
  spec_patches: [];
  changelog_entries: [];
  candidate_terms: [];
  routed_upstream: [];
  follow_ups: string[];
  settled: [];
  obligation_resolutions?: FixtureResolution[];
}

interface FixtureEpic {
  id: string;
  name: string;
  kind: "product" | "out_of_band";
  source?: string;
  capabilities: string[];
  depends_on: string[];
  scope: { paths: string[]; tech_spec_patchable: string[] };
  estimated_diff_lines: number;
  tickets: FixtureTicket[];
  closeout?: FixtureCloseout;
}

const CLI = resolve(import.meta.dir, "cli.ts");
const FIXTURE = resolve(import.meta.dir, "../assets/fixtures/valid");
const DATE = "2026-11-02";

function withFixture(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "constitution-scheduling-obligations-"));
  try { cpSync(FIXTURE, root, { recursive: true }); run(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

function epic(id: string, dependsOn: string[] = [], kind: FixtureEpic["kind"] = "product"): FixtureEpic {
  const path = `src/regression-${id.toLowerCase()}.ts`;
  return {
    id, name: `Regression ${id}`, kind, ...(kind === "out_of_band" ? { source: "github#42" } : {}), capabilities: [], depends_on: dependsOn,
    scope: { paths: [path], tech_spec_patchable: [] }, estimated_diff_lines: 40,
    tickets: [{ id: `FIX-${id}001`, title: `Deliver ${id}`, type: "Chore", effort: 1, depends_on: [], scope: { in: [path] }, verification: { command: "bun run test", expected: "exit 0" }, description: `Deliver the scoped ${id} behavior.`, acceptance: { mode: "invariant", evidence: "The public operation preserves its declared invariant." }, flows: [], certainty: "assumed", status: "planned" }],
  };
}

function ticket(work: FixtureEpic): FixtureTicket {
  const first = work.tickets[0];
  if (!first) throw new Error(`Missing ticket in fixture epic ${work.id}`);
  return first;
}

function closeout(work: FixtureEpic, followUps: string[] = []): FixtureCloseout {
  return {
    tickets_completed: work.tickets.filter((item) => item.status === "done").map((item) => item.id),
    tickets_deferred: work.tickets.filter((item) => item.status === "deferred").map((item) => ({ id: item.id, route: item.deferred_to ?? "tasks", reason: "Prerequisite evidence remains owed." })),
    points_completed: work.tickets.filter((item) => item.status === "done").reduce((sum, item) => sum + item.effort, 0),
    spec_patches: [], changelog_entries: [], candidate_terms: [], routed_upstream: [], follow_ups: followUps, settled: [],
  };
}

function epicPath(root: string, work: FixtureEpic, active = true): string {
  return join(root, `.constitution/tasks/${active ? "epics" : "completed"}/EPIC-${work.id}-regression.yaml`);
}

function writeEpic(root: string, work: FixtureEpic, active = true): void {
  writeFileSync(epicPath(root, work, active), toBlockYaml(work));
}

function archive(root: string, work: FixtureEpic): void {
  renameSync(epicPath(root, work), epicPath(root, work, false));
  writeEpic(root, work, false);
}

function command(root: string, name: "render" | "validate", args: string[] = []) {
  return Bun.spawnSync([process.execPath, "run", CLI, name, "--root", root, ...args], { stdout: "pipe", stderr: "pipe" });
}

function fixtureGit(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`Fixture git ${args.join(" ")}: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

function render(root: string): string {
  const result = command(root, "render");
  expect(result.exitCode).toBe(0);
  return readFileSync(join(root, ".constitution/tasks/critical-path.md"), "utf8");
}

function section(output: string, heading: string): string {
  const start = output.indexOf(`## ${heading}\n`);
  if (start < 0) return "";
  const end = output.indexOf("\n## ", start + 1);
  return output.slice(start, end < 0 ? undefined : end);
}

function isFinding(value: unknown): value is Finding {
  if (value === null || typeof value !== "object" || !("id" in value) || !("severity" in value) || !("file" in value) || !("message" in value)) return false;
  return typeof value.id === "string" && typeof value.file === "string" && typeof value.message === "string" && (value.severity === "error" || value.severity === "warning" || value.severity === "info") && (!("pointer" in value) || value.pointer === undefined || typeof value.pointer === "string");
}

function validation(root: string): { exitCode: number; findings: Finding[] } {
  const result = command(root, "validate", ["--json"]);
  const value: unknown = JSON.parse(result.stdout.toString());
  if (!Array.isArray(value) || !value.every(isFinding)) throw new Error(`Unexpected validation output: ${result.stderr.toString()}`);
  return { exitCode: result.exitCode, findings: value };
}

function followUpRef(output: string): string {
  const match = /EPIC-E#follow-up:[0-9a-f]{12}/.exec(section(output, "Outstanding obligations"));
  if (!match) throw new Error("Expected the rendered exact follow-up source reference");
  return match[0];
}

test("CLI scheduling keeps active out-of-band prerequisites and transitive dependents out of waves until completion", () => withFixture((root) => {
  const prerequisite = epic("E", ["C"], "out_of_band");
  const dependent = epic("F", ["E"]);
  const transitive = epic("G", ["F"]);
  const independent = epic("H");
  for (const work of [prerequisite, dependent, transitive, independent]) writeEpic(root, work);

  const blocked = render(root);
  const waves = section(blocked, "Waves");
  expect(waves).toContain("EPIC-C Link checking");
  expect(waves).toContain("EPIC-H Regression H");
  expect(waves).not.toContain("EPIC-F Regression F");
  expect(waves).not.toContain("EPIC-G Regression G");
  expect(section(blocked, "Blocked work")).toContain("EPIC-F Regression F | product | active out-of-band prerequisite EPIC-E");
  expect(section(blocked, "Blocked work")).toContain("EPIC-G Regression G | product | active out-of-band prerequisite EPIC-E");
  expect(section(blocked, "Longest chain")).toContain("EPIC-C → EPIC-E → EPIC-F → EPIC-G (8 points)");
  expect(section(blocked, "Build order")).toContain("  C --> E\n  E --> F\n  F --> G\n");

  ticket(prerequisite).status = "done";
  prerequisite.closeout = closeout(prerequisite);
  archive(root, prerequisite);
  const unblocked = render(root);
  expect(section(unblocked, "Waves")).toContain("| 1 | EPIC-F Regression F");
  expect(section(unblocked, "Waves")).toContain("| 2 | EPIC-G Regression G");
  expect(section(unblocked, "Blocked work")).toBe("");
  expect(validation(root).exitCode).toBe(0);
}));

test("CLI scheduling exposes missing prerequisites and mixed-kind cycles without withholding unrelated work", () => withFixture((root) => {
  for (const work of [epic("E", ["F"], "out_of_band"), epic("F", ["E"]), epic("G", ["F"]), epic("H", ["Z"]), epic("I", ["H"]), epic("J")]) writeEpic(root, work);
  const output = render(root);
  const waves = section(output, "Waves");
  expect(waves).toContain("EPIC-J Regression J");
  for (const id of ["E", "F", "G", "H", "I"]) expect(waves).not.toContain(`EPIC-${id} Regression ${id}`);
  expect(section(output, "Blocked work")).toContain("dependency cycle");
  expect(section(output, "Blocked work")).toContain("unknown prerequisite EPIC-Z");
  const result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.some((finding) => finding.id === "TSK-003" && finding.message.includes("dependency cycle"))).toBe(true);
  expect(result.findings.some((finding) => finding.id === "TSK-003" && finding.message.includes("unknown epic Z"))).toBe(true);
}));

test("CLI obligation lifecycle preserves archived deferrals, exact follow-up identity, replacement ownership, and terminal proof", () => withFixture((root) => {
  const source = epic("E");
  ticket(source).status = "deferred";
  ticket(source).deferred_to = "tech-spec";
  const deliveryText = "Run remote deployment proof";
  const retirementText = "Review the abandoned target";
  source.closeout = closeout(source, [deliveryText]);
  writeEpic(root, source, false);
  const deliveryRef = followUpRef(render(root));
  source.closeout.follow_ups.push(retirementText);
  writeEpic(root, source, false);
  const initialRefs = [...section(render(root), "Outstanding obligations").matchAll(/EPIC-E#follow-up:[0-9a-f]{12}/g)].map((match) => match[0]);
  const retirementRef = initialRefs.find((ref) => ref !== deliveryRef);
  if (!retirementRef) throw new Error("Expected a distinct source for the second follow-up");

  const firstOwner = epic("F");
  ticket(firstOwner).replaces = ["FIX-E001", deliveryRef];
  writeEpic(root, firstOwner);
  expect(section(render(root), "Outstanding obligations")).toContain("[FIX-F001](epics/EPIC-F-regression.yaml) (planned; active)");
  ticket(firstOwner).status = "done";
  firstOwner.closeout = closeout(firstOwner);
  archive(root, firstOwner);
  const archived = section(render(root), "Outstanding obligations");
  expect(archived).toContain("[FIX-F001](completed/EPIC-F-regression.yaml) (done; archived)");
  expect(archived).toContain("Delivery or retirement evidence not recorded");

  const currentOwner = epic("G");
  ticket(currentOwner).replaces = ["FIX-F001"];
  writeEpic(root, currentOwner);
  expect(section(render(root), "Outstanding obligations")).toContain("[FIX-G001](epics/EPIC-G-regression.yaml) (planned; active)");
  writeFileSync(join(root, "docs/delivery-proof.md"), "Verified deployed operation at revision abc1234.\n");
  ticket(currentOwner).status = "done";
  currentOwner.closeout = closeout(currentOwner);
  currentOwner.closeout.obligation_resolutions = [
    { source: "FIX-G001", outcome: "delivered", evidence: { kind: "repository", ref: "docs/delivery-proof.md", date: DATE, version: "abc1234" } },
    { source: retirementRef, outcome: "retired", evidence: { kind: "ruling", ref: "Owner approval to remove the target", date: DATE }, reason: "The owner removed the target from the supported scope." },
  ];
  archive(root, currentOwner);
  const delivered = section(render(root), "Outstanding obligations");
  expect(delivered).toContain("\nNone.\n");
  expect(delivered).toContain(`| \`${deliveryRef}\` | ${deliveryText}`);
  expect(delivered).toContain("| delivered | repository: [docs/delivery-proof.md](../../docs/delivery-proof.md)");
  expect(delivered).toContain("| retired | ruling: Owner approval to remove the target");
  expect(validation(root).findings.filter((finding) => finding.severity !== "info")).toEqual([]);

  source.closeout.follow_ups = [retirementText, deliveryText, deliveryText];
  writeEpic(root, source, false);
  const unrelated = epic("H");
  ticket(unrelated).title = deliveryText;
  ticket(unrelated).status = "deferred";
  writeEpic(root, unrelated);
  const reordered = section(render(root), "Outstanding obligations");
  expect(reordered).toContain("`FIX-H001`");
  expect(reordered.split(`| \`${deliveryRef}\` |`)).toHaveLength(2);
  expect(reordered).toContain("| delivered | repository: [docs/delivery-proof.md](../../docs/delivery-proof.md)");

  const lateOwner = epic("I");
  ticket(lateOwner).replaces = ["FIX-G001"];
  writeEpic(root, lateOwner);
  unlinkSync(join(root, "docs/delivery-proof.md"));
  const historical = section(render(root), "Outstanding obligations");
  expect(historical).toContain(`| \`${deliveryRef}\` | ${deliveryText}`);
  expect(historical).toContain("| delivered (unverified historical claim) | repository: [docs/delivery-proof.md](../../docs/delivery-proof.md)");
  const warnings = validation(root).findings.filter((finding) => finding.id === "TSK-020");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.severity).toBe("warning");
  expect(warnings[0]?.message).toContain("recorded resolution is retained as an unverified historical claim");

  const legacy = epic("J");
  ticket(legacy).status = "done";
  legacy.closeout = closeout(legacy);
  legacy.closeout.tickets_deferred = [{ id: "FIX-J099", route: "architecture", reason: "A legacy closeout retained this obligation without its original ticket." }];
  writeEpic(root, legacy, false);
  const legacyView = section(render(root), "Outstanding obligations");
  expect(legacyView).toContain("`FIX-J099`");
  expect(legacyView).toContain("A legacy closeout retained this obligation without its original ticket.");
  expect(validation(root).findings.filter((finding) => finding.severity === "error")).toEqual([]);
}));

test("CLI validation rejects ambiguous ownership, replacement cycles, unknown references, and unsupported closure claims", () => withFixture((root) => {
  const source = epic("E");
  ticket(source).status = "deferred";
  source.closeout = closeout(source);
  writeEpic(root, source, false);
  const first = epic("F");
  ticket(first).replaces = ["FIX-E001"];
  const second = epic("G");
  ticket(second).replaces = ["FIX-E001"];
  for (const work of [first, second]) writeEpic(root, work);
  let result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("multiple replacement owners"))).toBe(true);
  expect(section(render(root), "Outstanding obligations")).toContain("multiple replacement owners");

  second.closeout = closeout(second);
  second.closeout.obligation_resolutions = [
    { source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } },
    { source: "FIX-E001", outcome: "retired", evidence: { kind: "ruling", ref: "Owner review", date: DATE }, reason: "The target was removed." },
  ];
  writeEpic(root, second);
  expect(validation(root).findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("conflicting delivery and retirement"))).toBe(true);
  expect(section(render(root), "Outstanding obligations")).not.toContain("### Delivery and retirement evidence");

  ticket(first).replaces = ["FIX-E001", "FIX-G001"];
  ticket(second).replaces = ["FIX-F001", "FIX-Z001"];
  ticket(second).status = "done";
  second.closeout = closeout(second);
  second.closeout.obligation_resolutions = [
    { source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts" } },
    { source: "FIX-E001", outcome: "retired", evidence: { kind: "ruling", ref: "Owner review", date: DATE } },
    { source: "EPIC-Z#follow-up:000000000000", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } },
  ];
  writeEpic(root, first);
  writeEpic(root, second);
  result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.some((finding) => finding.id === "SCH-001" && finding.pointer?.includes("/obligation_resolutions/0/evidence"))).toBe(true);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("replacement cycle"))).toBe(true);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("FIX-Z001 is not an existing"))).toBe(true);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("EPIC-Z#follow-up:000000000000 is not an existing"))).toBe(true);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("retirement also needs a reason"))).toBe(true);
  const output = section(render(root), "Outstanding obligations");
  expect(output).toContain("`FIX-E001`");
  expect(output).not.toContain("### Delivery and retirement evidence");
}));

test("CLI refuses new missing-proof delivery and distinguishes an available historical artifact from an unverified archived claim", () => withFixture((root) => {
  const source = epic("E");
  ticket(source).status = "deferred";
  source.closeout = closeout(source);
  writeEpic(root, source, false);
  const owner = epic("F");
  ticket(owner).status = "done";
  ticket(owner).replaces = ["FIX-E001"];
  owner.closeout = closeout(owner);
  const resolution: FixtureResolution = { source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "docs/historical-delivery.md", date: DATE } };
  owner.closeout.obligation_resolutions = [resolution];
  writeEpic(root, owner);
  let result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.severity === "error" && finding.message.includes("new delivered claim has unavailable evidence"))).toBe(true);
  let output = section(render(root), "Outstanding obligations");
  expect(output).toContain("`FIX-E001`");
  expect(output).not.toContain("### Delivery and retirement evidence");

  writeFileSync(join(root, "docs/historical-delivery.md"), "Acceptance record at a fixed revision.\n");
  fixtureGit(root, "init", "-q", "-b", "main");
  fixtureGit(root, "add", "docs/historical-delivery.md");
  fixtureGit(root, "commit", "-q", "-m", "Record fixture delivery evidence");
  resolution.evidence.version = fixtureGit(root, "rev-parse", "HEAD");
  unlinkSync(join(root, "docs/historical-delivery.md"));
  writeEpic(root, owner);
  result = validation(root);
  expect(result.exitCode).toBe(0);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.severity === "warning" && finding.message.includes("historical artifact is available"))).toBe(true);
  output = section(render(root), "Outstanding obligations");
  expect(output).toContain("\nNone.\n");
  expect(output).toContain("| delivered | repository: [docs/historical-delivery.md]");
  expect(output).toContain("historical artifact available");
  expect(output).not.toContain("unverified historical claim");

  archive(root, owner);
  resolution.evidence.version = "0".repeat(40);
  writeEpic(root, owner, false);
  result = validation(root);
  expect(result.exitCode).toBe(0);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.severity === "warning" && finding.message.includes("past existence is unverified"))).toBe(true);
  output = section(render(root), "Outstanding obligations");
  expect(output).toContain("| delivered (unverified historical claim) |");
  expect(output).toContain("past existence unverified");
}));

test("CLI preserves explicit source closure while keeping reachable replacement defects outstanding", () => withFixture((root) => {
  const source = epic("E");
  ticket(source).status = "deferred";
  source.closeout = closeout(source);
  source.closeout.obligation_resolutions = [{ source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } }];
  writeEpic(root, source, false);
  const first = epic("F");
  ticket(first).status = "done";
  ticket(first).replaces = ["FIX-E001"];
  first.closeout = closeout(first);
  first.closeout.obligation_resolutions = [{ source: "FIX-F001", outcome: "retired", evidence: { kind: "ruling", ref: "Owner scope ruling", date: DATE }, reason: "The replacement scope was removed after the original obligation was delivered." }];
  writeEpic(root, first, false);
  const second = epic("G");
  ticket(second).replaces = ["FIX-E001"];
  writeEpic(root, second);
  expect(validation(root).exitCode).toBe(0);
  expect(section(render(root), "Outstanding obligations")).toContain("| delivered |");

  ticket(first).replaces = ["FIX-E001", "FIX-G001"];
  ticket(second).replaces = ["FIX-F001"];
  writeEpic(root, first, false);
  writeEpic(root, second);
  let result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.filter((finding) => finding.id === "SCH-001")).toEqual([]);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("replacement cycle"))).toBe(true);
  let output = section(render(root), "Outstanding obligations");
  expect(output).toContain("`FIX-E001`");
  expect(output).not.toContain("### Delivery and retirement evidence");

  ticket(first).replaces = ["FIX-E001"];
  writeEpic(root, first, false);
  const duplicate = join(root, ".constitution/tasks/completed/EPIC-F-duplicate.yaml");
  writeFileSync(duplicate, toBlockYaml(first));
  result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.filter((finding) => finding.id === "SCH-001")).toEqual([]);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("multiple ticket records"))).toBe(true);
  output = section(render(root), "Outstanding obligations");
  expect(output).toContain("`FIX-E001`");
  expect(output).not.toContain("### Delivery and retirement evidence");
  unlinkSync(duplicate);

  first.closeout.obligation_resolutions.push({ source: "FIX-F001", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } });
  writeEpic(root, first, false);
  result = validation(root);
  expect(result.exitCode).toBe(1);
  expect(result.findings.filter((finding) => finding.id === "SCH-001")).toEqual([]);
  expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.message.includes("conflicting delivery and retirement"))).toBe(true);
  expect(section(render(root), "Outstanding obligations")).not.toContain("### Delivery and retirement evidence");
  first.closeout.obligation_resolutions.pop();
  writeEpic(root, first, false);
  expect(validation(root).exitCode).toBe(0);
  expect(section(render(root), "Outstanding obligations")).toContain("| delivered |");
}));

test("CLI keeps active missing-proof claims outstanding despite valid source or replacement resolutions", () => withFixture((root) => {
  const source = epic("E");
  ticket(source).status = "deferred";
  source.closeout = closeout(source);
  writeEpic(root, source, false);
  const first = epic("F");
  ticket(first).status = "done";
  ticket(first).replaces = ["FIX-E001"];
  first.closeout = closeout(first);
  const valid: FixtureResolution = { source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } };
  first.closeout.obligation_resolutions = [valid];
  writeEpic(root, first);
  const second = epic("G");
  ticket(second).status = "done";
  ticket(second).replaces = ["FIX-F001"];
  second.closeout = closeout(second);
  const missing: FixtureResolution = { source: "FIX-E001", outcome: "delivered", evidence: { kind: "repository", ref: "docs/late-proof.md", date: DATE } };
  second.closeout.obligation_resolutions = [missing];
  writeEpic(root, second);
  const expectOutstanding = () => {
    const result = validation(root);
    expect(result.exitCode).toBe(1);
    expect(result.findings.filter((finding) => finding.id === "SCH-001")).toEqual([]);
    expect(result.findings.some((finding) => finding.id === "TSK-020" && finding.severity === "error" && finding.message.includes("unavailable evidence"))).toBe(true);
    const output = section(render(root), "Outstanding obligations");
    expect(output).toContain("`FIX-E001`");
    expect(output).not.toContain("### Delivery and retirement evidence");
  };
  expectOutstanding();

  valid.source = "FIX-F001";
  writeEpic(root, first);
  expectOutstanding();

  source.closeout.obligation_resolutions = [{ ...valid, source: "FIX-E001" }];
  writeEpic(root, source, false);
  missing.source = "FIX-G001";
  missing.outcome = "retired";
  missing.reason = "The later replacement scope was removed by the owner.";
  writeEpic(root, second);
  expectOutstanding();

  writeFileSync(join(root, "docs/late-proof.md"), "The owner approved retirement of the replacement scope.\n");
  expect(validation(root).exitCode).toBe(0);
  const output = section(render(root), "Outstanding obligations");
  expect(output).toContain("\nNone.\n");
  expect(output).toContain("| delivered |");
}));
