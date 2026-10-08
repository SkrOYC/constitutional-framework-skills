// Derives the mechanical facts tech-spec restates from the repository: stack pins from lockfiles and layout
// exists flags from the tree. Report-only by default; with write it applies DRV-001 and DRV-002 and records a
// patch-level tech-spec changelog entry. Rewriting a file re-emits its YAML, so comments and flow style in the
// rewritten block are lost, as with reconcile.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { exists, loadModel, type Model } from "./model.ts";
import { commandResolves, lockfileVersions } from "./repo.ts";
import { prependChangelogEntry, toBlockYaml } from "./yaml.ts";

export type DeriveFinding = { id: "DRV-001" | "DRV-002" | "DRV-003"; file: string; pointer: string; message: string; applied: boolean };
export type DeriveResult = { findings: DeriveFinding[]; written: string[]; version: string | null; drift: boolean };

const LOCKFILES = new Set(["package-lock.json", "bun.lock", "Cargo.lock", "pubspec.lock"]);

function bumpPatch(version: string): string {
  const [maj, min, pat] = version.slice(1).split(".").map(Number);
  return `v${maj}.${min}.${pat + 1}`;
}

export function derive(root: string, opts: { write?: boolean; date?: string } = {}): DeriveResult {
  const m: Model = loadModel(root);
  if (!m.present["tech-spec"]) throw new Error("derive needs .constitution/tech-spec/; Stage 3 has not been executed");
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const write = opts.write === true;
  const findings: DeriveFinding[] = [];
  const written: string[] = [];
  const changes: string[] = [];

  // DRV-001 and the pin half of DRV-003: stack pins against the lockfile.
  const stack = m.stack;
  let stackChanged = false;
  const lockfiles = new Set<string>([...LOCKFILES, ...((stack?.data?.compatibility_policy?.lockfiles ?? []) as string[])]);
  (stack?.data?.bill_of_materials ?? []).forEach((b: any, i: number) => {
    const pointer = `/bill_of_materials/${i}`;
    const locked = lockfileVersions(m, b.name, b.ecosystem);
    if (locked === undefined) return;
    if (!locked.length) { findings.push({ id: "DRV-003", file: stack!.path, pointer, message: `${b.name} is pinned at ${b.version} but absent from the ${b.ecosystem} lockfile; remove the pin or add the dependency`, applied: false }); return; }
    if (locked.includes(String(b.version))) return;
    // With several locked versions and none pinned, which one the pin means is a judgment; report it, never rewrite.
    if (locked.length > 1) { findings.push({ id: "DRV-003", file: stack!.path, pointer, message: `${b.name} is pinned at ${b.version} but the ${b.ecosystem} lockfile locks ${locked.join(", ")}; set the pin to the version the project depends on directly`, applied: false }); return; }
    const v = locked[0];
    findings.push({ id: "DRV-001", file: stack!.path, pointer, message: `${b.name} pinned ${b.version} but the lockfile has ${v}`, applied: write });
    if (!write) return;
    changes.push(`stack.yaml: ${b.name} ${b.version} -> ${v} (from the lockfile)`);
    b.version = v;
    const ev = b.evidence;
    if (ev?.kind === "repository" && (lockfiles.has(ev.ref) || lockfiles.has(basename(String(ev.ref))))) { ev.version = v; ev.date = date; }
    stackChanged = true;
  });

  // DRV-002 and the command half of DRV-003: guidelines flags against the tree.
  const g = m.guidelines;
  let guidelinesChanged = false;
  (g?.data?.layout ?? []).forEach((l: any, i: number) => {
    const pointer = `/layout/${i}`;
    const there = exists(m, l.path);
    if (there && l.exists === false) {
      findings.push({ id: "DRV-002", file: g!.path, pointer, message: `layout path ${l.path} exists but is marked exists: false`, applied: write });
      if (write) { delete l.exists; changes.push(`guidelines.md: layout ${l.path} now exists`); guidelinesChanged = true; }
    } else if (!there && l.exists !== false) {
      findings.push({ id: "DRV-002", file: g!.path, pointer, message: `layout path ${l.path} does not exist but is not marked exists: false`, applied: write });
      if (write) { l.exists = false; changes.push(`guidelines.md: layout ${l.path} marked exists: false`); guidelinesChanged = true; }
    }
  });
  (g?.data?.verification_commands ?? []).forEach((vc: any, i: number) => {
    if (vc.exists === false && commandResolves(m, vc.command)) findings.push({ id: "DRV-003", file: g!.path, pointer: `/verification_commands/${i}`, message: `command "${vc.command}" is marked exists: false but now resolves${vc.owner ? `; reconcile flips it when ${vc.owner} archives` : ""}`, applied: false });
  });

  let version: string | null = null;
  if (write && (stackChanged || guidelinesChanged)) {
    if (stackChanged) { writeFileSync(join(root, stack!.path), toBlockYaml(stack!.data) + "\n"); written.push(stack!.path); }
    if (guidelinesChanged) { writeFileSync(join(root, g!.path), `---\n${toBlockYaml(g!.data)}\n---\n${g!.body ?? ""}`); written.push(g!.path); }
    const logPath = join(m.cdir, "tech-spec/changelog.yaml");
    const log: any = m.changelogs["tech-spec"]?.data ?? { entries: [{ version: "v0.0.1", date, added: ["Initial"], by: "init" }] };
    const prev = log.entries[0];
    version = bumpPatch(prev.version);
    const entry = { version, date, changed: changes, ...(prev.upstream ? { upstream: prev.upstream } : {}), by: "derive" };
    if (existsSync(logPath)) writeFileSync(logPath, prependChangelogEntry(readFileSync(logPath, "utf8"), entry));
    else { log.entries.unshift(entry); writeFileSync(logPath, toBlockYaml(log) + "\n"); }
    written.push(".constitution/tech-spec/changelog.yaml");
  }
  const drift = findings.some((x) => x.id !== "DRV-003" && !x.applied);
  return { findings, written, version, drift };
}

export function formatDerive(r: DeriveResult): string {
  const lines = r.findings.map((x) => `${x.id.padEnd(8)} ${x.applied ? "applied " : x.id === "DRV-003" ? "report  " : "drift   "} ${x.file}#${x.pointer}\n        ${x.message}`);
  if (r.written.length) lines.push(`\nwrote ${r.written.join(", ")}; tech-spec ${r.version}`);
  lines.push(`\n${r.findings.filter((x) => x.id !== "DRV-003").length} drift finding(s), ${r.findings.filter((x) => x.id === "DRV-003").length} report-only`);
  return lines.join("\n");
}
