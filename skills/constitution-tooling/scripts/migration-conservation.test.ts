import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadYamlFile, toBlockYaml } from "./lib/yaml.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const FIXTURE = resolve(import.meta.dir, "../assets/fixtures/markdown");

function runMigration(root: string) {
  return Bun.spawnSync([process.execPath, "run", CLI, "migrate", "--root", root, "--date", "2026-11-02"], { stdout: "pipe", stderr: "pipe" });
}

function withFixture(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "constitution-migration-conservation-"));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function preservedDirectory(root: string): string {
  const directories = readdirSync(root).filter((name) => name.startsWith(".constitution-migration-sources-"));
  expect(directories).toHaveLength(1);
  const directory = directories[0];
  if (!directory) throw new Error("Migration did not preserve its sources");
  return directory;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a record");
  return Object.fromEntries(Object.entries(value));
}

test("CLI migration imports table and bullet constraints while preserving every removed source for manual conservation review", () => withFixture((root) => {
  const constitution = join(root, ".constitution");
  const constraints = `# Constraints

## Performance

| ID | Scale | Meter | Goal | Fail |
| :--- | :--- | :--- | :--- | :--- |
| PERF-01 | Idle frame requests | Frame-request count after settlement | \`0\` | Any request after settlement |
| PERF-02 | Input latency | Percentiles on each reference platform | Measured ceiling before qualification | Missing approved ceiling |

## Security

- **SEC-01 — Network isolation.** Scale: outbound requests. Meter: network trace. Goal: 0. Fail: any request.

## Unquantified obligations

DEFER-17: Preserve tenant data during upgrades; the measurement and budget still need a ruling.
`;
  writeFileSync(join(constitution, "prd/constraints.md"), constraints);
  const capabilityPath = join(constitution, "prd/capabilities.md");
  writeFileSync(capabilityPath, readFileSync(capabilityPath, "utf8") + "\n## Future obligations\n\nUNPARSED-42: Support offline export after an owner ruling.\n");
  const paths = [
    "prd/changelog.md", "architecture/changelog.md", "tech-spec/changelog.md", "tasks/changelog.md",
    "prd/capabilities.md", "prd/constraints.md", "prd/glossary.md", "tech-spec/stack.md",
    "tasks/active/EPIC-B-render.md", "tasks/completed/EPIC-A-tooling.md", "tasks/critical-path.md",
    "reports/2026-08-10-open-decisions.md", "reports/2026-08-13-open-decisions.md",
  ];
  const originals = new Map(paths.map((path) => [path, readFileSync(join(constitution, path))]));
  const result = runMigration(root);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(loadYamlFile(join(constitution, "prd/constraints.yaml"))).toMatchObject({
    constraints: expect.arrayContaining([
      expect.objectContaining({ legacy_id: "PERF-01", class: "performance", scale: "Idle frame requests", goal: "0", fail: "Any request after settlement" }),
      expect.objectContaining({ legacy_id: "PERF-02", meter: "Percentiles on each reference platform", goal: "Measured ceiling before qualification" }),
      expect.objectContaining({ legacy_id: "SEC-01", class: "security", statement: "Network isolation" }),
    ]),
  });
  const directory = preservedDirectory(root);
  const report = readFileSync(join(root, ".constitution-migration-report.md"), "utf8");
  for (const [path, original] of originals) {
    expect(readFileSync(join(root, directory, path))).toEqual(original);
    expect(report.split("\n").some((line) => line.startsWith("- [ ] ") && line.includes(`.constitution/${path}`) && line.includes(`${directory}/${path}`))).toBe(true);
    if (path !== "tasks/critical-path.md") expect(existsSync(join(constitution, path))).toBe(false);
  }
  const constraintsTodo = report.split("\n").find((line) => line.startsWith("- [ ] .constitution/prd/constraints.md:"));
  expect(constraintsTodo).toContain(".constitution/prd/constraints.yaml");
  expect(readFileSync(join(root, directory, "prd/constraints.md"), "utf8")).toContain("DEFER-17");
  expect(readFileSync(join(root, directory, "prd/capabilities.md"), "utf8")).toContain("UNPARSED-42");
}));

test("CLI migration leaves sources intact when it cannot record the conservation obligation", () => withFixture((root) => {
  const path = "prd/changelog.md";
  const original = readFileSync(join(root, ".constitution", path));
  mkdirSync(join(root, ".constitution-migration-report.md"));
  const result = runMigration(root);
  expect(result.exitCode).not.toBe(0);
  expect(readFileSync(join(root, ".constitution", path))).toEqual(original);
  expect(readFileSync(join(root, preservedDirectory(root), path))).toEqual(original);
}));

test("CLI validation excludes preserved root recovery directories while checking similarly named source paths", () => withFixture((root) => {
  const original = readFileSync(join(root, ".constitution/prd/glossary.md"));
  expect(runMigration(root).exitCode).toBe(0);
  const directory = preservedDirectory(root);
  const configPath = join(root, ".constitution/constitution.yaml");
  writeFileSync(configPath, toBlockYaml({ ...record(loadYamlFile(configPath)), surfaces: ["**/*.md"] }) + "\n");
  const nested = "docs/.constitution-migration-sources-production/guide.md";
  const rootFile = ".constitution-migration-sources-guide.md";
  mkdirSync(join(root, "docs/.constitution-migration-sources-production"), { recursive: true });
  for (const path of [nested, rootFile]) writeFileSync(join(root, path), "# Operator guide\n\nOpen a document.\n");
  const result = Bun.spawnSync([process.execPath, "run", CLI, "validate", "--root", root, "--json"], { stdout: "pipe", stderr: "pipe" });
  expect(result.stderr.toString()).toBe("");
  const parsed: unknown = JSON.parse(result.stdout.toString());
  if (!Array.isArray(parsed)) throw new Error("Expected validation findings");
  const findings = parsed.map(record);
  expect(findings.filter((finding) => typeof finding.file === "string" && finding.file.startsWith(`${directory}/`))).toEqual([]);
  for (const path of [nested, rootFile]) expect(findings).toContainEqual(expect.objectContaining({ id: "GLS-001", severity: "error", file: path }));
  expect(readFileSync(join(root, directory, "prd/glossary.md"))).toEqual(original);
  expect(readFileSync(join(root, ".constitution-migration-report.md"), "utf8")).toContain(`${directory}/prd/glossary.md`);
}));

test("CLI migration accepts genuinely empty sources without an unsupported-record obligation", () => {
  const root = mkdtempSync(join(tmpdir(), "constitution-migration-empty-"));
  try {
    const prd = join(root, ".constitution/prd");
    mkdirSync(prd, { recursive: true });
    writeFileSync(join(prd, "constraints.md"), " \n\t\n");
    const result = runMigration(root);
    expect(result.exitCode).toBe(0);
    expect(loadYamlFile(join(prd, "constraints.yaml"))).toEqual({ constraints: [], deferred: [] });
    expect(existsSync(join(prd, "constraints.md"))).toBe(false);
    expect(readdirSync(root).filter((name) => name.startsWith(".constitution-migration-sources-"))).toEqual([]);
    expect(readFileSync(join(root, ".constitution-migration-report.md"), "utf8").split("\n").filter((line) => line.startsWith("- [ ] ") && line.includes("prd/constraints"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
