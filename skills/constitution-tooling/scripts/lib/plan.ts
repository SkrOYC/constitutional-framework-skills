// Checks an epic plan file's front matter against epic-plan.schema.json and the constitution it plans against.
// The plan lives outside .constitution/; its milestone bodies are prose and stay unchecked.
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadModel, type Finding } from "./model.ts";
import type { SchemaSet } from "./schema.ts";
import { loadYamlFile, splitFrontMatter } from "./yaml.ts";

// The schema engine has no if/then, so the per-kind rules for `epic` and `epic_file` live here.
const EPIC_ID = /^EPIC-[A-Z]{1,2}$/;
const LANE_ID = /^(FAST-[a-z0-9]+(-[a-z0-9]+)*|ISSUE-[0-9]+)$/;

// A bundle holds a whole wave's plans in one file, which is convenient where a step-0 session can write only one: each plan
// starts at a marker line immediately followed by its own front matter, and runs to the next marker.
const BUNDLE_MARKER = /^<!--\s*plan:\s*(\S+)\s*-->[ \t]*$/;

type Err = (id: string, message: string, pointer?: string) => void;

export function checkPlan(root: string, planPath: string, schemas: SchemaSet): Finding[] {
  const out: Finding[] = [];
  const file = relative(root, planPath).startsWith("..") ? planPath : relative(root, planPath);
  const errFor = (prefix: string): Err => (id, message, pointer) => out.push({ id, severity: "error", file, message: `${prefix}${message}`, pointer });
  const err = errFor("");
  if (!existsSync(planPath)) { err("PLAN-000", "plan file does not exist"); return out; }
  const text = readFileSync(planPath, "utf8");
  const sections = bundleSections(text);
  if (!sections.length) { checkOnePlan(root, planPath, text, schemas, err); return out; }

  // Each plan is checked alone, its findings prefixed with the plan id; then the plans are checked against each other.
  const plans: { id: string; data: any }[] = [];
  for (const s of sections) {
    const data = checkOnePlan(root, planPath, s.text, schemas, errFor(`${s.id}: `), s.startsWithFrontMatter ? null : `the marker for ${s.id} is not immediately followed by a --- front matter block`);
    if (data) plans.push({ id: s.id, data });
  }
  bundleChecks(sections.map((s) => s.id), plans, err);
  return out;
}

/** The plans of a bundle, in file order; empty when the file has no marker, so it is a single plan. */
function bundleSections(text: string): { id: string; text: string; startsWithFrontMatter: boolean }[] {
  const lines = text.split("\n");
  const starts: { id: string; line: number }[] = [];
  lines.forEach((l, i) => { const mm = BUNDLE_MARKER.exec(l); if (mm) starts.push({ id: mm[1], line: i }); });
  return starts.map((s, k) => {
    const body = lines.slice(s.line + 1, k + 1 < starts.length ? starts[k + 1].line : lines.length).join("\n");
    return { id: s.id, text: body, startsWithFrontMatter: body.startsWith("---\n") };
  });
}

/** Cross-checks between the plans of one bundle, which together describe one wave. */
function bundleChecks(ids: string[], plans: { id: string; data: any }[], err: Err): void {
  const seen = new Set<string>();
  for (const id of ids) { if (seen.has(id)) err("PLAN-007", `${id}: the bundle has more than one plan marked ${id}`); seen.add(id); }
  const byId = new Map(plans.map((p) => [p.id, p.data]));
  for (const p of plans) {
    if (typeof p.data.epic === "string" && p.data.epic !== p.id) err("PLAN-007", `${p.id}: the marker says ${p.id} but the front matter's epic is ${p.data.epic}`, "/epic");
    (Array.isArray(p.data.siblings) ? p.data.siblings : []).forEach((s: any, i: number) => {
      if (typeof s?.epic !== "string") return;
      if (s.epic === p.id) err("PLAN-007", `${p.id}: sibling ${s.epic} is this plan itself; siblings are the other lanes`, `/siblings/${i}`);
      else if (!byId.has(s.epic)) err("PLAN-007", `${p.id}: sibling ${s.epic} has no plan in this bundle`, `/siblings/${i}`);
      else if (typeof s.merge_position === "number" && typeof byId.get(s.epic)?.merge_position === "number" && s.merge_position !== byId.get(s.epic).merge_position) err("PLAN-007", `${p.id}: sibling ${s.epic} is listed at merge_position ${s.merge_position}, but its plan says ${byId.get(s.epic).merge_position}`, `/siblings/${i}/merge_position`);
    });
  }
  const byPosition = new Map<number, string[]>();
  for (const p of plans) if (typeof p.data.merge_position === "number") byPosition.set(p.data.merge_position, [...(byPosition.get(p.data.merge_position) ?? []), p.id]);
  for (const [pos, owners] of byPosition) if (owners.length > 1) err("PLAN-007", `${owners.join(", ")} all take merge_position ${pos}; merge positions in a wave are unique`, "/merge_position");
}

/** Checks one plan's front matter and returns it, or null when there is none to check. */
function checkOnePlan(root: string, planPath: string, text: string, schemas: SchemaSet, err: Err, structural: string | null = null): any {
  if (structural) { err("PLAN-000", structural); return null; }
  let data: any;
  try { data = splitFrontMatter(text, planPath).data; }
  catch (e) { err("PLAN-000", (e as Error).message); return null; }
  if (!data || typeof data !== "object") { err("PLAN-000", "plan file has no YAML front matter"); return null; }
  for (const e of schemas.validate("epic-plan.schema.json", data)) err("PLAN-001", e.message, e.pointer || "/");

  // An epic plan executes an epic file; a fast-lane or no-constitution plan executes an issue or a named fix and has none.
  const kind = data.kind === "fast_lane" || data.kind === "no_constitution" ? data.kind : "epic";
  // A value neither pattern accepts is already a schema finding; only the pairing with kind is checked here.
  if (typeof data.epic === "string" && (EPIC_ID.test(data.epic) || LANE_ID.test(data.epic))) {
    if (kind === "epic" && !EPIC_ID.test(data.epic)) err("PLAN-001", `a kind: epic plan names an epic as EPIC-<ID>, not ${data.epic}`, "/epic");
    if (kind !== "epic" && !LANE_ID.test(data.epic)) err("PLAN-001", `a kind: ${kind} plan names its work FAST-<slug> or ISSUE-<number>, not ${data.epic}`, "/epic");
  }
  if (kind !== "epic" && data.epic_file !== undefined && data.epic_file !== "none") err("PLAN-001", `a kind: ${kind} plan has no epic file; set epic_file: none`, "/epic_file");
  if (kind === "epic" && data.epic_file === "none") err("PLAN-001", "a kind: epic plan names its epic file; epic_file: none is for fast_lane and no_constitution plans", "/epic_file");

  policyCoverage(data, schemas, err);
  if (kind === "no_constitution") { selfPlannedChecks(data, err); return data; }
  if (kind === "fast_lane" && !existsSync(join(root, ".constitution"))) err("PLAN-002", `${root} has no .constitution/; a plan with no constitution to check against is kind: no_constitution`, "/kind");

  const m = loadModel(root);
  // The plan executes one epic file; a mismatch means a lead would work from the wrong tickets.
  if (kind === "epic" && typeof data.epic_file === "string" && data.epic_file !== "none") {
    const epicPath = join(root, data.epic_file);
    if (!existsSync(epicPath)) err("PLAN-002", `epic_file ${data.epic_file} does not exist`, "/epic_file");
    else {
      let epic: any = null;
      try { epic = loadYamlFile(epicPath); } catch (e) { err("PLAN-002", `epic_file ${data.epic_file} does not parse: ${(e as Error).message}`, "/epic_file"); }
      if (epic && typeof data.epic === "string" && `EPIC-${epic.id}` !== data.epic) err("PLAN-002", `epic_file ${data.epic_file} has id ${epic.id}, but the plan is for ${data.epic}`, "/epic_file");
    }
  }
  const odIds = new Set((m.openDecisions?.data?.decisions ?? []).map((d: any) => d.id));
  (Array.isArray(data.open_decisions) ? data.open_decisions : []).forEach((o: any, i: number) => { if (o?.id && !odIds.has(o.id)) err("PLAN-003", `open decision ${o.id} is not in reports/open-decisions.yaml`, `/open_decisions/${i}`); });
  const active = new Set(m.epics.filter((e) => e.active).map((e) => `EPIC-${e.data?.id}`));
  (Array.isArray(data.siblings) ? data.siblings : []).forEach((s: any, i: number) => { if (s?.epic && !active.has(s.epic)) err("PLAN-004", `sibling ${s.epic} is not an active epic`, `/siblings/${i}`); });
  selfPlannedChecks(data, err);
  return data;
}

// The lead never asks after step 0, so every trigger needs exactly one decided action: a missing trigger leaves the
// lead without an answer, and a duplicate gives it two. The trigger list is the schema's enum, read, not restated.
function policyCoverage(data: any, schemas: SchemaSet, err: Err): void {
  const policy = data.autonomy?.policy;
  if (!Array.isArray(policy)) return;
  const triggers: string[] = schemas.get("epic-plan.schema.json")?.properties?.autonomy?.properties?.policy?.items?.properties?.trigger?.enum ?? [];
  const counts = new Map<string, number>();
  for (const p of policy) if (typeof p?.trigger === "string") counts.set(p.trigger, (counts.get(p.trigger) ?? 0) + 1);
  const missing = triggers.filter((t) => !counts.has(t));
  const duplicated = triggers.filter((t) => (counts.get(t) ?? 0) > 1);
  if (missing.length) err("PLAN-006", `autonomy policy has no entry for ${missing.join(", ")}; every trigger needs exactly one action`, "/autonomy/policy");
  if (duplicated.length) err("PLAN-006", `autonomy policy has more than one entry for ${duplicated.join(", ")}; every trigger needs exactly one action`, "/autonomy/policy");
}

// A standalone lead has no wave lead above it; its policy must resolve everything itself.
function selfPlannedChecks(data: any, err: Err): void {
  if (data.planned_by === "self") (Array.isArray(data.autonomy?.policy) ? data.autonomy.policy : []).forEach((p: any, i: number) => { if (p?.action === "escalate_wave_lead") err("PLAN-005", `trigger ${p.trigger} escalates to a wave lead, but a self-planned epic has none; pick an action the lead can take alone`, `/autonomy/policy/${i}`); });
}
