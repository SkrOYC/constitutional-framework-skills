#!/usr/bin/env bun
// Read-only survey of one repository's constitution before (and after) the
// upgrade to code-owned artifacts, live verification, and estimate hygiene.
// Usage: bun survey.ts --root <repo> [--json]
// Never writes anything: it runs `validate --json` and `derive --json`, reads
// git and gh state, and hashes files.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const CLI = join(import.meta.dir, "..", "..", "constitution-tooling", "scripts", "cli.ts");

type Finding = { id: string; severity?: string; file?: string; pointer?: string; message: string };

const args = process.argv.slice(2);
const rootArg = args[args.indexOf("--root") + 1];
if (!args.includes("--root") || !rootArg) {
  console.error("usage: bun survey.ts --root <repo> [--json]");
  process.exit(2);
}
const root = rootArg;
const asJson = args.includes("--json");
const C = join(root, ".constitution");
if (!existsSync(C)) {
  console.error(`no .constitution/ under ${root}`);
  process.exit(2);
}

function run(cmd: string[], cwd = root): { code: number; out: string } {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: p.stdout.toString() };
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function yaml(path: string): any {
  return Bun.YAML.parse(readFileSync(path, "utf8"));
}

function frontMatter(path: string): any {
  const m = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return m ? Bun.YAML.parse(m[1]) : {};
}

// Tooling must be new enough to know the checks this upgrade relies on.
const cliSource = readFileSync(CLI, "utf8");
const toolingOk = cliSource.includes("derive") && cliSource.includes("check-plan");

// Gates: the upgrade runs only between waves, on a clean default branch.
const constitution = yaml(join(C, "constitution.yaml"));
const defaultBranch: string = constitution.default_branch ?? "main";
const branch = run(["git", "branch", "--show-current"]).out.trim();
const dirty = run(["git", "status", "--porcelain"]).out.trim().split("\n").filter(Boolean);
const worktreeList = run(["git", "worktree", "list"]).out.trim().split("\n").filter(Boolean).slice(1);
const prs = run(["gh", "pr", "list", "--state", "open", "--json", "number,headRefName,title"]);
const openPrs: { number: number; headRefName: string; title: string }[] = prs.code === 0 ? JSON.parse(prs.out || "[]") : [];

const epicsDir = join(C, "tasks", "epics");
const activeEpics = existsSync(epicsDir) ? readdirSync(epicsDir).filter((f) => f.endsWith(".yaml")) : [];
const inProgress: string[] = [];
const epicData: Record<string, any> = {};
for (const f of activeEpics) {
  const e = yaml(join(epicsDir, f));
  epicData[f] = e;
  for (const t of e.tickets ?? []) if (t.status && !["planned", "done", "deferred"].includes(t.status)) inProgress.push(`${t.id} (${t.status})`);
}
const plansDirs = [".claude", ".codex", ".grok"].map((h) => join(root, h, "plans"));
const plans = plansDirs.flatMap((dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : []));

// Validator and derive findings.
const v = run(["bun", "run", CLI, "validate", "--root", root, "--json"]);
const findings: Finding[] = JSON.parse(v.out || "[]");
const d = run(["bun", "run", CLI, "derive", "--root", root, "--json"]);
const drift: Finding[] = d.out.trim() ? (JSON.parse(d.out).findings ?? []) : [];
const byId = (id: string) => findings.filter((f) => f.id === id);
const counts: Record<string, number> = {};
for (const f of findings) if (f.severity !== "info") counts[`${f.severity} ${f.id}`] = (counts[`${f.severity} ${f.id}`] ?? 0) + 1;

// Legacy artifacts: find where the code already carries each one.
const tracked = run(["git", "ls-files"]).out.split("\n").filter((p) => p && !p.startsWith(".constitution/"));
const legacy = byId("TS-008").map((f) => {
  const sidecar = f.file!;
  const dir = sidecar.slice(0, sidecar.lastIndexOf("/"));
  const artifact = f.message.split(" is a legacy artifact")[0];
  const rel = `${dir}/${artifact}`;
  const abs = join(root, rel);
  const hash = existsSync(abs) ? sha(abs) : "";
  const sameName = tracked.filter((p) => basename(p) === artifact);
  const identical = sameName.filter((p) => existsSync(join(root, p)) && sha(join(root, p)) === hash);
  const inTechSpec = rel.replace(/^\.constitution\//, "");
  const refs = run(["git", "grep", "-l", "-F", inTechSpec, "--", ".", ":!.constitution"]).out.split("\n").filter(Boolean);
  const kind = identical.length ? "identical-copy-in-code" : sameName.length ? "same-name-differs" : refs.length ? "code-reads-tech-spec" : "only-in-tech-spec";
  return { sidecar, artifact: rel, kind, identical, sameName: sameName.filter((p) => !identical.includes(p)), referencedBy: refs };
});

// Patchable entries that name raw artifacts, per active epic.
const patchable = byId("TSK-017").map((f) => ({ file: f.file, message: f.message }));

// Estimates, recipes, pinned, surfaces.
const backfilled = byId("TSK-015").map((f) => f.file);
const guidelinesPath = join(C, "tech-spec", "guidelines.md");
const guidelines = existsSync(guidelinesPath) ? frontMatter(guidelinesPath) : {};
const recipes: string[] = (guidelines.live_verification ?? []).map((r: any) => r.name);
const sidecars: string[] = [];
for (const sub of ["contracts", "data-models"]) {
  const base = join(C, "tech-spec", sub);
  if (!existsSync(base)) continue;
  for (const f of readdirSync(base, { recursive: true }) as string[]) if (f.endsWith(".meta.yaml")) sidecars.push(join(base, f));
}
const sidecarInfo = sidecars.map((p) => {
  const m = yaml(p);
  return { path: p.slice(root.length + 1), surface: m.surface, pinned: !!m.pinned, artifact_path: m.artifact_path ?? null, certainty: m.certainty };
});
const surfaceGlobs: string[] = constitution.surfaces ?? [];
const staleSurfaces = surfaceGlobs.filter((g) => g.startsWith(".constitution/tech-spec/"));

const report = {
  root,
  tooling_ok: toolingOk,
  gates: {
    default_branch: defaultBranch,
    on_default_branch: branch === defaultBranch,
    current_branch: branch,
    dirty_paths: dirty.length,
    extra_worktrees: worktreeList,
    open_prs: openPrs,
    gh_available: prs.code === 0,
    tickets_in_progress: inProgress,
    plan_files: plans,
  },
  validate: { errors: findings.filter((f) => f.severity === "error").length, counts },
  derive: { drift: drift.filter((x) => x.id !== "DRV-003").length, report_only: drift.filter((x) => x.id === "DRV-003").length },
  legacy_artifacts: legacy,
  patchable_raw_entries: patchable,
  backfilled_estimates: backfilled,
  live_verification_recipes: recipes,
  sidecars: sidecarInfo,
  stale_surface_globs: staleSurfaces,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const g = report.gates;
// Hard gates block the upgrade; extra worktrees only need a look, since a merged or abandoned one is harmless.
const blocked = !toolingOk || !g.on_default_branch || g.dirty_paths > 0 || g.open_prs.length > 0 || g.tickets_in_progress.length > 0 || report.validate.errors > 0;
const lines: string[] = [];
lines.push(`# Constitution upgrade survey: ${root}`, "");
lines.push("## Gates", "");
lines.push(`- Tooling has derive and check-plan: ${toolingOk ? "yes" : "NO"}`);
lines.push(`- On default branch \`${defaultBranch}\`: ${g.on_default_branch ? "yes" : `NO (on \`${g.current_branch}\`)`}`);
lines.push(`- Uncommitted paths: ${g.dirty_paths}`);
lines.push(`- Extra git worktrees (inspect; one with unmerged work means an epic is in flight): ${g.extra_worktrees.length}${g.extra_worktrees.length ? `\n${g.extra_worktrees.map((w) => `  - ${w.replace(/\s+/g, " ")}`).join("\n")}` : ""}`);
lines.push(`- Open pull requests: ${g.gh_available ? g.open_prs.length : "unknown (gh failed)"}${g.open_prs.length ? ` (${g.open_prs.map((p) => `#${p.number} ${p.headRefName}`).join(", ")})` : ""}`);
lines.push(`- Tickets in progress: ${g.tickets_in_progress.length}${g.tickets_in_progress.length ? ` (${g.tickets_in_progress.slice(0, 10).join(", ")})` : ""}`);
lines.push(`- Plan files under the harness plans directory: ${g.plan_files.length}`);
lines.push(`- validate errors: ${report.validate.errors}`);
lines.push("", `**Verdict:** ${blocked ? "BLOCKED. Resolve the gates above first; do not upgrade while a wave or epic is in flight." : "clear to plan the upgrade."}`, "");
lines.push("## Warnings the upgrade addresses", "");
for (const [k, n] of Object.entries(counts).sort()) lines.push(`- ${k}: ${n}`);
lines.push("", `derive: ${report.derive.drift} drift finding(s), ${report.derive.report_only} report-only`, "");
lines.push(`## Legacy artifacts in tech-spec (${legacy.length})`, "");
const kinds: Record<string, typeof legacy> = {};
for (const l of legacy) (kinds[l.kind] ??= []).push(l);
for (const [kind, items] of Object.entries(kinds)) {
  lines.push(`### ${kind} (${items.length})`, "");
  for (const l of items) {
    const where = l.identical.length ? ` -> ${l.identical.join(", ")}` : l.sameName.length ? ` ~ ${l.sameName.join(", ")}` : "";
    const refs = l.referencedBy.length ? ` (read by ${l.referencedBy.join(", ")})` : "";
    lines.push(`- \`${l.artifact}\`${where}${refs}`);
  }
  lines.push("");
}
lines.push(`## Patchable entries naming raw artifacts (${patchable.length})`, "");
const perEpic: Record<string, number> = {};
for (const p of patchable) perEpic[p.file ?? "?"] = (perEpic[p.file ?? "?"] ?? 0) + 1;
for (const [f, n] of Object.entries(perEpic)) lines.push(`- ${f}: ${n}`);
lines.push("", `## Back-filled estimates (${backfilled.length})`, "");
for (const b of backfilled) lines.push(`- ${b}`);
lines.push("", "## Live verification", "", recipes.length ? `Recipes declared: ${recipes.join(", ")}` : "No live_verification recipes declared in guidelines.md.", "");
lines.push("## Sidecars", "");
lines.push(`- Total: ${sidecarInfo.length}; pointing into code: ${sidecarInfo.filter((s) => s.artifact_path).length}; pinned: ${sidecarInfo.filter((s) => s.pinned).length}`);
const bySurface: Record<string, number> = {};
for (const s of sidecarInfo) bySurface[s.surface ?? "?"] = (bySurface[s.surface ?? "?"] ?? 0) + 1;
lines.push(`- By surface: ${Object.entries(bySurface).map(([k, n]) => `${k} ${n}`).join(", ")}`);
lines.push("", "## Surface globs still pointing into tech-spec", "", staleSurfaces.length ? staleSurfaces.map((s) => `- \`${s}\``).join("\n") : "None.");
console.log(lines.join("\n"));
