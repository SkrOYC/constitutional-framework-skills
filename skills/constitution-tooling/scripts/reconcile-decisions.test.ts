import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
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
  const result = Bun.spawnSync(["git", "--no-optional-locks", "-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

function closeout(root: string, id: string, decisions: unknown[], settled: unknown[] = []): void {
  const template = readFileSync(join(FIXTURE, ".constitution/tasks/epics/EPIC-C-checking.yaml"), "utf8")
    .replace(/^id: C$/m, `id: ${id}`).replaceAll("FIX-C", `FIX-${id}`).replaceAll("status: planned", "status: done");
  writeFileSync(join(root, `.constitution/tasks/epics/EPIC-${id}-checking.yaml`), template + "\n" + toBlockYaml({
    decisions,
    closeout: { tickets_completed: [`FIX-${id}001`, `FIX-${id}002`], tickets_deferred: [], points_completed: 5, spec_patches: [], changelog_entries: [], candidate_terms: [], routed_upstream: [], follow_ups: [], code_decisions: [], settled },
  }) + "\n");
  if (id !== "C") {
    const evidence = join(root, `.constitution/evidence/FIX-${id}001`);
    cpSync(join(root, ".constitution/evidence/FIX-C001"), evidence, { recursive: true });
    const manifest = join(evidence, "manifest.yaml");
    writeFileSync(manifest, toBlockYaml({ ...record(loadYamlFile(manifest)), owner: `FIX-${id}001` }) + "\n");
  }
}

function withFixture(run: (root: string, decision: Record<string, unknown>) => void): void {
  const root = mkdtempSync(join(tmpdir(), "constitution-reconcile-decisions-"));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    const packagePath = join(root, "package.json");
    const pkg = record(JSON.parse(readFileSync(packagePath, "utf8")));
    writeFileSync(packagePath, JSON.stringify({ ...pkg, scripts: { ...record(pkg.scripts), build: "bun build ./src/cli/parse.ts", bench: "./scripts/bench.sh" } }, null, 2) + "\n");
    for (const script of ["bench", "doctor", "drive-check", "clean"]) writeFileSync(join(root, `scripts/${script}.sh`), "#!/bin/sh\nexit 0\n");
    writeFileSync(join(root, "docs/check-report.schema.json"), "{}\n");
    const manifestPath = join(root, ".constitution/evidence/FIX-C001/manifest.yaml");
    writeFileSync(manifestPath, toBlockYaml({ ...record(loadYamlFile(manifestPath)), mode: "live_probe", result: "pass" }) + "\n");
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
  const result = reconcile(relative(process.cwd(), root), { date: DATE });
  const errors = validate(root).filter((finding) => finding.severity === "error");
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

function snapshot(root: string) {
  const files: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const path = join(dir, entry.name);
      const rel = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(path, `${rel}/`);
      else files[rel] = entry.isSymbolicLink() ? `link:${readlinkSync(path)}` : readFileSync(path).toString("base64");
    }
  };
  walk(root, "");
  return { files, index: readFileSync(join(root, git(root, "rev-parse", "--git-path", "index"))).toString("base64"), history: git(root, "log", "--format=%H"), status: git(root, "status", "--porcelain=v1") };
}

function initialize(root: string): void {
  git(root, "init", "-q", "-b", "main");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "Closeout ready for reconciliation");
}

function cli(root: string, ...args: string[]) {
  return Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "reconcile", "--root", root, "--date", DATE, "--json", ...args], {
    stdout: "pipe", stderr: "pipe",
    env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.invalid" },
  });
}

describe("reconcile proposed-result validation", () => {
  test("refuses incomplete closeout evidence and references before archival without changing the repository", () => {
    const evidencePath = ".constitution/evidence/FIX-C001/manifest.yaml";
    const epicPath = ".constitution/tasks/epics/EPIC-C-checking.yaml";
    const rewrite = (root: string, path: string, edit: (data: Record<string, unknown>) => void): void => {
      const target = join(root, path);
      const data = record(loadYamlFile(target));
      edit(data);
      writeFileSync(target, toBlockYaml(data) + "\n");
    };
    const defects = [
      { rule: "TSK-018", prepare: (root: string) => rewrite(root, evidencePath, (data) => { data.result = "fail"; }) },
      { rule: "TSK-018", prepare: (root: string) => rewrite(root, evidencePath, (data) => { data.result = "owed"; }) },
      { rule: "TSK-019", prepare: (root: string) => rmSync(join(root, ".constitution/evidence/FIX-C001"), { recursive: true }) },
      { rule: "TSK-019", prepare: (root: string) => rewrite(root, evidencePath, (data) => { delete data.result; }) },
      { rule: "TSK-006", prepare: (root: string) => rewrite(root, epicPath, (data) => {
        if (!Array.isArray(data.tickets)) throw new Error("Expected fixture tickets");
        data.tickets = data.tickets.map((ticket) => {
          const entry = record(ticket);
          return entry.id === "FIX-C002" ? { ...entry, type: "Spike", spike: "SPK-FIX-C002" } : entry;
        });
      }) },
      { rule: "TSK-016", prepare: (root: string) => rewrite(root, epicPath, (data) => {
        data.closeout = { ...record(data.closeout), spec_patches: [{ path: "tech-spec/contracts/missing.meta.yaml", summary: "A patch that has not landed", commit: "0000000" }] };
      }) },
    ];
    for (const defect of defects) withFixture((root) => {
      closeout(root, "C", []);
      defect.prepare(root);
      initialize(root);
      expect([...new Set(validate(root).filter((finding) => finding.severity === "error").map((finding) => finding.id))]).toEqual([defect.rule]);
      const before = snapshot(root);
      for (const args of [[], ["--no-commit"]]) {
        const result = cli(root, ...args);
        expect(result.exitCode).toBe(2);
        expect(result.stderr.toString()).toContain(defect.rule);
        expect(snapshot(root)).toEqual(before);
      }
    });
  });

  test("refuses to archive unresolved verification owners and succeeds after prerequisite repair", () => {
    for (const prerequisite of ["command", "recipe"]) withFixture((root) => {
      closeout(root, "C", []);
      const path = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
      const epic = record(loadYamlFile(path));
      if (!Array.isArray(epic.tickets)) throw new Error("Expected fixture tickets");
      const owner = prerequisite === "command" ? "FIX-C002" : "FIX-C001";
      const tickets = epic.tickets.map(record);
      epic.tickets = tickets.map((ticket) => ticket.id === owner ? { ...ticket, status: "deferred", deferred_to: "Future release" } : ticket);
      epic.closeout = { ...record(epic.closeout), tickets_completed: tickets.filter((ticket) => ticket.id !== owner).map((ticket) => ticket.id), tickets_deferred: [{ id: owner, route: "tasks", reason: "Prerequisite postponed" }], points_completed: prerequisite === "command" ? 3 : 2 };
      writeFileSync(path, toBlockYaml(epic) + "\n");
      const packagePath = join(root, "package.json");
      const pkg = record(JSON.parse(readFileSync(packagePath, "utf8")));
      if (prerequisite === "command") {
        const scripts = record(pkg.scripts);
        delete scripts.bench;
        writeFileSync(packagePath, JSON.stringify({ ...pkg, scripts }, null, 2) + "\n");
      } else rmSync(join(root, "scripts/doctor.sh"));
      initialize(root);
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
      const before = snapshot(root);
      for (const args of [[], ["--no-commit"]]) {
        const result = cli(root, ...args);
        expect(result.exitCode).toBe(2);
        expect(result.stderr.toString()).toContain(owner);
        expect(result.stderr.toString()).toContain("Stage 3");
        expect(snapshot(root)).toEqual(before);
      }
      if (prerequisite === "command") writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
      else writeFileSync(join(root, "scripts/doctor.sh"), "#!/bin/sh\nexit 0\n");
      git(root, "add", ".");
      git(root, "commit", "-q", "-m", "Create the deferred verification prerequisite");
      const accepted = cli(root);
      expect(accepted.exitCode).toBe(0);
      expect(record(JSON.parse(accepted.stdout.toString())).archived).toEqual(["EPIC-C"]);
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
      expect(git(root, "status", "--porcelain")).toBe("");
    });
  });

  test("closes a valid epic without revalidating historical evidence and missing references as active work", () => withFixture((root) => {
    closeout(root, "C", []);
    closeout(root, "D", []);
    const path = join(root, ".constitution/tasks/epics/EPIC-D-checking.yaml");
    const epic = record(loadYamlFile(path));
    if (!Array.isArray(epic.tickets)) throw new Error("Expected fixture tickets");
    epic.tickets = epic.tickets.map((ticket) => {
      const entry = record(ticket);
      return entry.id === "FIX-D002" ? { ...entry, type: "Spike", spike: "SPK-FIX-D002" } : entry;
    });
    epic.closeout = { ...record(epic.closeout), spec_patches: [{ path: "tech-spec/contracts/historical.meta.yaml", summary: "Historical contract", commit: "0000000" }] };
    const archivedPath = join(root, ".constitution/tasks/completed/EPIC-D-checking.yaml");
    writeFileSync(path, toBlockYaml(epic) + "\n");
    renameSync(path, archivedPath);
    const manifestPath = join(root, ".constitution/evidence/FIX-D001/manifest.yaml");
    writeFileSync(manifestPath, toBlockYaml({ ...record(loadYamlFile(manifestPath)), result: "fail" }) + "\n");
    initialize(root);
    const historical = readFileSync(archivedPath, "utf8");
    expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    const result = cli(root);
    expect(result.exitCode).toBe(0);
    expect(record(JSON.parse(result.stdout.toString())).archived).toEqual(["EPIC-C"]);
    expect(readFileSync(archivedPath, "utf8")).toBe(historical);
    expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    expect(git(root, "status", "--porcelain")).toBe("");
  }));

  test("rejects a rulerless proposed register entry before changing files, index, or commits", () => withFixture((root, decision) => {
    const invalid: Record<string, unknown> = { ...decision, id: "OD-98", question: "Who approves external checks?", status: "proposed" };
    delete invalid.ruler;
    closeout(root, "C", [invalid]);
    initialize(root);
    expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    const before = snapshot(root);
    for (const args of [[], ["--no-commit"]]) {
      const result = cli(root, ...args);
      expect(result.exitCode).toBe(2);
      expect(result.stdout.toString()).toBe("");
      expect(snapshot(root)).toEqual(before);
    }
  }));

  test("rejects schema-invalid generated dates and missing repository artifacts before publication", () => withFixture((root) => {
    closeout(root, "C", []);
    initialize(root);
    const before = snapshot(root);
    expect(() => reconcile(root, { date: "invalid", commit: false })).toThrow();
    expect(snapshot(root)).toEqual(before);
    git(root, "reset", "--hard", "HEAD");
    const path = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
    const epic = record(loadYamlFile(path));
    if (!Array.isArray(epic.tickets)) throw new Error("Expected fixture tickets");
    epic.tickets = epic.tickets.map((ticket) => ({ ...record(ticket), status: "planned" }));
    epic.closeout = { ...record(epic.closeout), tickets_completed: [], points_completed: 0, settled: [{ record: "tech-spec/contracts/check-report.meta.yaml", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: DATE } }] };
    writeFileSync(path, toBlockYaml(epic) + "\n");
    rmSync(join(root, "docs/check-report.schema.json"));
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "Propose settling an artifact that has not landed");
    expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    const repositoryBefore = snapshot(root);
    expect(() => reconcile(root, { date: DATE })).toThrow();
    expect(snapshot(root)).toEqual(repositoryBefore);
  }));

  test("rejects unsupported new obligation claims until proof or an explicit owner exception is supplied", () => {
    for (const remedy of ["proof", "owner exception"]) withFixture((root) => {
      closeout(root, "C", []);
      const path = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
      const epic = record(loadYamlFile(path));
      if (!Array.isArray(epic.tickets)) throw new Error("Expected fixture tickets");
      epic.tickets = epic.tickets.map((ticket) => {
        const entry = record(ticket);
        return entry.id === "FIX-C002" ? { ...entry, status: "deferred", deferred_to: "Future release" } : entry;
      });
      epic.closeout = { ...record(epic.closeout), tickets_completed: ["FIX-C001"], points_completed: 3, tickets_deferred: [{ id: "FIX-C002", route: "Future release", reason: "Benchmark postponed" }], obligation_resolutions: [{ source: "FIX-C002", outcome: "delivered", evidence: { kind: "repository", ref: "docs/missing-proof.md", date: DATE } }] };
      writeFileSync(path, toBlockYaml(epic) + "\n");
      initialize(root);
      const errors = validate(root).filter((finding) => finding.severity === "error");
      expect([...new Set(errors.map((finding) => finding.id))]).toEqual(["TSK-020"]);
      const before = snapshot(root);
      for (const args of [[], ["--no-commit"]]) {
        expect(cli(root, ...args).exitCode).toBe(2);
        expect(snapshot(root)).toEqual(before);
      }
      if (remedy === "proof") {
        epic.closeout = { ...record(epic.closeout), obligation_resolutions: [{ source: "FIX-C002", outcome: "delivered", evidence: { kind: "repository", ref: "src/core/render.ts", date: DATE } }] };
        writeFileSync(path, toBlockYaml(epic) + "\n");
      } else {
        const configPath = join(root, ".constitution/constitution.yaml");
        writeFileSync(configPath, toBlockYaml({ ...record(loadYamlFile(configPath)), exceptions: [{ rule: "TSK-020", reason: "Project owner explicitly accepts this unavailable delivery proof" }] }) + "\n");
        const findings = validate(root);
        expect(findings.filter((finding) => finding.severity === "error")).toEqual([]);
        expect(findings).toContainEqual(expect.objectContaining({ id: "TSK-020", severity: "info" }));
      }
      git(root, "add", ".");
      git(root, "commit", "-q", "-m", `Supply ${remedy} for deferred obligation delivery`);
      const accepted = cli(root, "--no-commit");
      expect(accepted.exitCode).toBe(0);
      expect(record(JSON.parse(accepted.stdout.toString())).archived).toEqual(["EPIC-C"]);
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    });
  });

  test("publishes a valid proposal with original repository evidence and leaves no-commit index and history unchanged", () => withFixture((root, decision) => {
    closeout(root, "C", [ruled(decision)], [{ record: "prd/capabilities.yaml#CAP-003", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: DATE } }]);
    const epicPath = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
    initialize(root);
    const before = snapshot(root);
    const applied = cli(root, "--no-commit");
    expect(applied.exitCode).toBe(0);
    const result = record(JSON.parse(applied.stdout.toString()));
    expect(result.archived).toEqual(["EPIC-C"]);
    expect(result.settled).toEqual(["prd/capabilities.yaml#CAP-003"]);
    expect(result.commit).toBeNull();
    expect(existsSync(epicPath)).toBe(false);
    expect(existsSync(join(root, ".constitution/tasks/completed/EPIC-C-checking.yaml"))).toBe(true);
    const after = snapshot(root);
    expect(after.history).toBe(before.history);
    expect(after.index).toBe(before.index);
    expect(after.files).not.toEqual(before.files);
    expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    expect(validate(root).filter((finding) => finding.id === "CERT-002")).toEqual([]);
  }));

  test("preserves internal settlement symlinks and routes escaping ones without changing their targets", () => {
    for (const internal of [true, false]) withFixture((root, decision) => {
      const path = join(root, ".constitution/prd/capabilities.yaml");
      const target = internal ? join(root, ".constitution/prd/capabilities-source.yaml") : join(root, "capabilities-source.yaml");
      renameSync(path, target);
      symlinkSync(target, path);
      const before = readFileSync(target, "utf8");
      closeout(root, "C", [ruled(decision)], [{ record: "prd/capabilities.yaml#CAP-003", evidence: { kind: "repository", ref: "src/core/render.ts", version: "0000000", date: DATE } }]);
      initialize(root);
      const result = reconcile(root, { date: DATE, commit: false });
      expect(readlinkSync(path)).toBe(target);
      expect(result.settled).toEqual(internal ? ["prd/capabilities.yaml#CAP-003"] : []);
      expect(result.refusedSettles).toHaveLength(internal ? 0 : 1);
      if (internal) expect(readFileSync(target, "utf8")).not.toBe(before);
      else {
        expect(readFileSync(target, "utf8")).toBe(before);
        const archived = record(loadYamlFile(join(root, ".constitution/tasks/completed/EPIC-C-checking.yaml")));
        expect(record(archived.closeout).settled).toEqual([]);
        if (!result.report) throw new Error("Expected refused settlement report");
        const report = record(loadYamlFile(join(root, result.report)));
        expect(report.refused_settles).toEqual(result.refusedSettles);
        expect(report.commit).toBe(git(root, "rev-parse", "--short", "HEAD"));
      }
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    });
  });

  test("archives relative and absolute epic symlinks without changing their targets or duplicate aliases", () => {
    for (const absolute of [false, true]) withFixture((root, decision) => {
      closeout(root, "C", [ruled(decision)]);
      const source = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
      const target = join(root, ".constitution/tasks/epics/epic-source.txt");
      const duplicate = join(root, ".constitution/prd/duplicate-epic.txt");
      const duplicateTarget = "../tasks/epics/epic-source.txt";
      renameSync(source, target);
      symlinkSync(absolute ? target : "epic-source.txt", source);
      symlinkSync(duplicateTarget, duplicate);
      initialize(root);
      const validateCli = () => Bun.spawnSync(["bun", "run", resolve(import.meta.dir, "cli.ts"), "validate", "--root", root, "--json"], { stdout: "pipe", stderr: "pipe" });
      expect(validateCli().exitCode).toBe(0);
      const applied = cli(root);
      expect(applied.exitCode).toBe(0);
      expect(record(JSON.parse(applied.stdout.toString())).archived).toEqual(["EPIC-C"]);
      const archived = join(root, ".constitution/tasks/completed/EPIC-C-checking.yaml");
      expect(readlinkSync(archived)).toBe(absolute ? target : "../epics/epic-source.txt");
      expect(realpathSync(archived)).toBe(target);
      expect(readFileSync(archived, "utf8")).toBe(readFileSync(target, "utf8"));
      expect(record(loadYamlFile(archived)).id).toBe("C");
      expect(readlinkSync(duplicate)).toBe(duplicateTarget);
      expect(realpathSync(duplicate)).toBe(target);
      expect(validateCli().exitCode).toBe(0);
      expect(git(root, "status", "--porcelain")).toBe("");
    });
  });

  test("rejects newly dangling relative and absolute aliases before publishing an archive", () => {
    for (const absolute of [false, true]) withFixture((root) => {
      closeout(root, "C", []);
      const source = join(root, ".constitution/tasks/epics/EPIC-C-checking.yaml");
      const alias = join(root, ".constitution/prd/epic-alias.txt");
      symlinkSync(absolute ? source : "../tasks/epics/EPIC-C-checking.yaml", alias);
      initialize(root);
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
      const before = snapshot(root);
      expect(cli(root).exitCode).toBe(2);
      expect(snapshot(root)).toEqual(before);
      expect(realpathSync(alias)).toBe(source);
      expect(validate(root).filter((finding) => finding.severity === "error")).toEqual([]);
    });
  });
});
