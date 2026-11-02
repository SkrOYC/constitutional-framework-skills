import { overlaps } from "./glob.ts";
import type { EpicDoc, Model } from "./model.ts";
import { deriveObligations, type ObligationView } from "./obligations.ts";

interface TicketView {
  id: string;
  status: string;
  points: number;
  deps: string[];
}

interface EpicView {
  id: string;
  name: string;
  kind: string;
  source: string;
  priority: number;
  points: number;
  paths: string[];
  patchable: string[];
  deps: string[];
  tickets: TicketView[];
  doc: EpicDoc;
}

interface DependencyBlocker {
  kind: "out_of_band" | "missing" | "cycle" | "duplicate";
  message: string;
}

interface ActivePlan {
  waves: EpicView[][];
  outOfBand: EpicView[];
  blocked: { epic: EpicView; reasons: string[] }[];
  chain: string[];
  chainPoints: number;
  incompleteChain: boolean;
  views: EpicView[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Patchable entries may include the leading .constitution/; compare them as TSK-009 does. */
function patchOverlap(a: string, b: string): boolean {
  return overlaps(a.replace(/^\.constitution\//, ""), b.replace(/^\.constitution\//, ""));
}

function epicView(doc: EpicDoc, index: number, completed: Set<string>): EpicView | null {
  const data: unknown = doc.data;
  if (!isRecord(data) || typeof data.id !== "string") return null;
  const scope = isRecord(data.scope) ? data.scope : {};
  const rawTickets: unknown[] = Array.isArray(data.tickets) ? data.tickets : [];
  const tickets: TicketView[] = [];
  for (const raw of rawTickets) {
    if (!isRecord(raw) || typeof raw.id !== "string") continue;
    tickets.push({ id: raw.id, status: typeof raw.status === "string" ? raw.status : "planned", points: typeof raw.effort === "number" ? raw.effort : 0, deps: strings(raw.depends_on) });
  }
  return {
    id: data.id, name: typeof data.name === "string" ? data.name : data.id, kind: typeof data.kind === "string" ? data.kind : "product", source: typeof data.source === "string" ? data.source : "—",
    priority: typeof data.priority === "number" ? data.priority : index + 1,
    points: tickets.filter((ticket) => ticket.status !== "done" && ticket.status !== "deferred").reduce((total, ticket) => total + ticket.points, 0),
    paths: strings(scope.paths), patchable: strings(scope.tech_spec_patchable), deps: strings(data.depends_on).filter((id) => !completed.has(id)), tickets, doc,
  };
}

function dependencyBlockers(epic: EpicView, byId: Map<string, EpicView>, duplicates: Set<string>): DependencyBlocker[] {
  const reasons = new Map<string, DependencyBlocker>();
  const seen = new Set<string>();
  const path: string[] = [];
  const visit = (id: string): void => {
    if (path.includes(id)) {
      const cycle = [...path.slice(path.indexOf(id)), id].map((node) => `EPIC-${node}`).join(" → ");
      reasons.set(cycle, { kind: "cycle", message: `dependency cycle ${cycle}` });
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    if (duplicates.has(id)) reasons.set(`duplicate:${id}`, { kind: "duplicate", message: `EPIC-${id} has conflicting active or completed records` });
    const dependency = byId.get(id);
    if (!dependency) { reasons.set(`missing:${id}`, { kind: "missing", message: `unknown prerequisite EPIC-${id}` }); return; }
    if (id !== epic.id && dependency.kind === "out_of_band") reasons.set(`out_of_band:${id}`, { kind: "out_of_band", message: `active out-of-band prerequisite EPIC-${id}` });
    path.push(id);
    for (const next of dependency.deps) visit(next);
    path.pop();
  };
  visit(epic.id);
  return [...reasons.values()];
}

export function planActive(m: Model): ActivePlan {
  const completed = new Set<string>();
  const duplicates = new Set<string>();
  const allIds = new Set<string>();
  for (const doc of m.epics) {
    const data: unknown = doc.data;
    if (!isRecord(data) || typeof data.id !== "string") continue;
    if (allIds.has(data.id)) duplicates.add(data.id);
    allIds.add(data.id);
    if (!doc.active) completed.add(data.id);
  }
  for (const id of duplicates) completed.delete(id);
  const views: EpicView[] = [];
  for (const [index, doc] of m.epics.entries()) {
    if (!doc.active) continue;
    const view = epicView(doc, index, completed);
    if (view) views.push(view);
  }
  views.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const inBand = views.filter((view) => view.kind !== "out_of_band");
  const outOfBand = views.filter((view) => view.kind === "out_of_band");
  const byId = new Map(views.map((view) => [view.id, view]));
  const blockers = new Map(views.map((view) => [view.id, dependencyBlockers(view, byId, duplicates)]));
  const blocked = views.flatMap((epic) => {
    const reasons = (blockers.get(epic.id) ?? []).map((reason) => reason.message);
    return reasons.length ? [{ epic, reasons }] : [];
  });
  const schedulable = inBand.filter((view) => !(blockers.get(view.id) ?? []).length);
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const value = Math.max(0, ...(byId.get(id)?.deps ?? []).map((dependency) => depthOf(dependency) + 1));
    depth.set(id, value);
    return value;
  };
  for (const view of schedulable) depthOf(view.id);
  const disjoint = (a: EpicView, b: EpicView) => !a.paths.some((path) => b.paths.some((other) => overlaps(path, other))) && !a.patchable.some((path) => b.patchable.some((other) => patchOverlap(path, other)));
  const waves: EpicView[][] = [];
  for (let level = 0; level <= Math.max(-1, ...depth.values()); level++) {
    const pending = schedulable.filter((view) => depth.get(view.id) === level);
    while (pending.length) {
      const wave: EpicView[] = [];
      for (const view of [...pending]) {
        if (wave.every((other) => disjoint(other, view))) { wave.push(view); pending.splice(pending.indexOf(view), 1); }
      }
      waves.push(wave);
    }
  }
  const analyzable = inBand.filter((view) => (blockers.get(view.id) ?? []).every((reason) => reason.kind === "out_of_band"));
  const best = new Map<string, { points: number; path: string[] }>();
  const chainOf = (id: string): { points: number; path: string[] } => {
    const cached = best.get(id);
    if (cached) return cached;
    const view = byId.get(id);
    if (!view) return { points: 0, path: [] };
    const prior = view.deps.map(chainOf).sort((a, b) => b.points - a.points)[0];
    const result = { points: view.points + (prior?.points ?? 0), path: [...(prior?.path ?? []), id] };
    best.set(id, result);
    return result;
  };
  const top = analyzable.map((view) => chainOf(view.id)).sort((a, b) => b.points - a.points)[0];
  return { waves, outOfBand, blocked, chain: top?.path ?? [], chainPoints: top?.points ?? 0, incompleteChain: analyzable.length !== inBand.length, views };
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function obligationOrigin(view: ObligationView): string {
  return `[${view.path.split("/").pop() ?? view.path}](${view.path.replace(/^\.constitution\/tasks\//, "")})`;
}

function obligationOwner(view: ObligationView): string {
  const owners = view.owners.filter((owner) => owner.id !== view.source).map((owner) => `[${owner.id}](${owner.path.replace(/^\.constitution\/tasks\//, "")}) (${owner.status}; ${owner.active ? "active" : "archived"})`);
  return owners.join(", ") || cell(view.route.join("; ")) || "No explicit replacement or route";
}

function renderObligations(m: Model): string[] {
  const { outstanding, resolved, findings } = deriveObligations(m);
  const lines = ["## Outstanding obligations", "", "Derived from deferred tickets and closeout deferrals and follow-ups in active and completed epics. `replaces` links current ownership; only explicit `obligation_resolutions` records deliver or retire work. Ticket status and archival do not close an obligation.", ""];
  if (!outstanding.length) lines.push("None.", "");
  else {
    lines.push("| Source | Obligation | Origin | Current owner or replacement | Unresolved evidence or conflict |", "| :--- | :--- | :--- | :--- | :--- |");
    for (const view of outstanding) lines.push(`| \`${view.source}\` | ${cell(view.summary)} | ${obligationOrigin(view)} | ${obligationOwner(view)} | ${cell(view.issues.join("; ")) || "Delivery or retirement evidence not recorded"} |`);
    lines.push("");
  }
  if (resolved.length) {
    lines.push("### Delivery and retirement evidence", "", "Explicit resolutions remain recorded when source tickets are archived or replacement status changes. A missing historical reference is labeled as unverified unless its artifact is available at the recorded immutable git revision.", "", "| Source | Obligation | Origin | Current owner or replacement | Outcome | Evidence |", "| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const view of resolved) {
      const proof = view.resolutions.map((resolution) => {
        const evidence = resolution.evidence;
        const reference = evidence.kind === "repository" ? `[${cell(evidence.ref)}](../../${evidence.ref})` : cell(evidence.ref);
        const state = resolution.proofState === "historical" ? "; historical artifact available" : resolution.proofState === "unverified_historical" ? "; past existence unverified" : "";
        return `${evidence.kind}: ${reference} (${evidence.date}${evidence.version ? `; ${cell(evidence.version)}` : ""}${state})${resolution.reason ? `; ${cell(resolution.reason)}` : ""}; [resolution](${resolution.path.replace(/^\.constitution\/tasks\//, "")})`;
      }).join("; ");
      const unverified = view.resolutions.every((resolution) => resolution.proofState === "unverified_historical");
      lines.push(`| \`${view.source}\` | ${cell(view.summary)} | ${obligationOrigin(view)} | ${obligationOwner(view)} | ${view.outcome}${unverified ? " (unverified historical claim)" : ""} | ${proof} |`);
    }
    lines.push("");
  }
  if (findings.length) {
    lines.push("### Obligation record issues", "");
    for (const finding of findings) lines.push(`- **${finding.severity}:** ${cell(finding.message)} ([record](${finding.file.replace(/^\.constitution\/tasks\//, "")}), \`${finding.pointer ?? "/"}\`).`);
    lines.push("");
  }
  return lines;
}

export function renderCriticalPath(m: Model): string {
  const { waves, outOfBand, blocked, chain, chainPoints, incompleteChain, views } = planActive(m);
  const constitution: unknown = m.constitution?.data;
  const conc = isRecord(constitution) && isRecord(constitution.concurrency) ? constitution.concurrency : {};
  const inBandPoints = views.filter((view) => view.kind !== "out_of_band").reduce((total, view) => total + view.points, 0);
  const oobPoints = outOfBand.reduce((total, view) => total + view.points, 0);
  const width = Math.max(0, ...waves.map((wave) => wave.length));
  const lines: string[] = [];
  lines.push("# Critical path", "", "Generated by `constitution-tooling render` from `tasks/epics/` and `tasks/completed/`. Do not edit by hand; change the epic files and render again.", "");
  lines.push("## Totals", "", "| Active epics | Open points | Out-of-band epics | Out-of-band points | Waves | Widest wave | Longest chain (points) |", "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |", `| ${views.length - outOfBand.length} | ${inBandPoints} | ${outOfBand.length} | ${oobPoints} | ${waves.length} | ${width} | ${chainPoints} |`, "");
  lines.push("## Longest chain", "");
  lines.push(chain.length ? chain.map((id) => `EPIC-${id}`).join(" → ") + ` (${chainPoints} points). Points describe dependency-weighted work, not elapsed time; actual concurrency also depends on resource readiness.` : views.some((view) => view.kind !== "out_of_band") ? "No valid dependency chain can be calculated for the blocked epics." : "No active in-band epics.", "");
  if (chain.some((id) => outOfBand.some((view) => view.id === id))) lines.push("The chain includes active out-of-band prerequisites for dependency analysis. Their dependents remain blocked from waves until those prerequisites complete.", "");
  if (incompleteChain) lines.push("Epics with missing, cyclic, or conflicting prerequisites are excluded from the chain calculation; see blocked work.", "");
  lines.push("## Waves", "", "An epic joins a wave when every dependency is completed or sits in an earlier wave and it is scope-disjoint from every other epic in the wave. Active out-of-band prerequisites, missing dependencies, and cycles block it and its dependents. A wave of one is a serial segment.", "", "| Wave | Epic | Kind | Open points | Owns | May patch | Depends on |", "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const [index, wave] of waves.entries()) for (const view of wave) lines.push(`| ${index + 1} | EPIC-${view.id} ${view.name} | ${view.kind} | ${view.points} | ${view.paths.map((path) => `\`${path}\``).join(", ") || "—"} | ${view.patchable.map((path) => `\`${path}\``).join(", ") || "—"} | ${view.deps.map((dependency) => `EPIC-${dependency}`).join(", ") || "—"} |`);
  if (!waves.length) lines.push("| — | — | — | — | — | — | — |");
  lines.push("");
  if (blocked.length) {
    lines.push("## Blocked work", "", "Dependencies remain in build-order and longest-chain analysis. These epics cannot join a runnable wave while the listed blockers remain.", "", "| Epic | Kind | Blocked by |", "| :--- | :--- | :--- |");
    for (const item of blocked) lines.push(`| EPIC-${item.epic.id} ${cell(item.epic.name)} | ${item.epic.kind} | ${cell(item.reasons.join("; "))} |`);
    lines.push("");
  }
  if (outOfBand.length) {
    lines.push("## Out of band", "", "Epics planned from issues. They run when the user chooses, outside wave scheduling, after their prerequisites complete, and must stay scope-disjoint from whatever wave is running. Their active dependents remain blocked until they complete.", "", "| Epic | Source | Open points | Owns | Depends on | Conflicts with |", "| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const view of outOfBand) {
      const conflicts = views.filter((other) => other.id !== view.id && other.kind !== "out_of_band" && (other.paths.some((path) => view.paths.some((owned) => overlaps(path, owned))) || other.patchable.some((path) => view.patchable.some((owned) => patchOverlap(path, owned))))).map((other) => `EPIC-${other.id}`);
      lines.push(`| EPIC-${view.id} ${view.name} | ${view.source} | ${view.points} | ${view.paths.map((path) => `\`${path}\``).join(", ") || "—"} | ${view.deps.map((dependency) => `EPIC-${dependency}`).join(", ") || "—"} | ${conflicts.join(", ") || "none"} |`);
    }
    lines.push("");
  }
  lines.push("## Build order", "", "```mermaid", "flowchart LR");
  for (const view of views) lines.push(`  ${view.id}["EPIC-${view.id} ${view.name} (${view.points})"]`);
  for (const view of views) for (const dependency of view.deps) lines.push(`  ${dependency} --> ${view.id}`);
  lines.push("```", "", "An arrow points from a prerequisite to the epic that depends on it, so it reads in the order work flows, the same direction as the longest chain above.", "", "## Ticket order inside each epic", "", "A dependency-respecting listing, not a chain: `needs` names a ticket's own `depends_on` inside its epic, and a ticket without one has no in-epic dependency. Readiness is epic-level: a ticket finished on an unmerged branch satisfies no other epic's dependency until the containing PR merges.", "");
  for (const view of views) {
    const byTicket = new Map(view.tickets.map((ticket) => [ticket.id, ticket]));
    const order: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string): void => { if (seen.has(id)) return; seen.add(id); for (const dependency of byTicket.get(id)?.deps ?? []) visit(dependency); order.push(id); };
    for (const ticket of view.tickets) visit(ticket.id);
    lines.push(`- **EPIC-${view.id}:** ${order.map((id) => { const ticket = byTicket.get(id); const notes = [ticket?.status && ticket.status !== "planned" ? ticket.status : "", ticket?.deps.length ? `needs ${ticket.deps.join(", ")}` : ""].filter(Boolean); return `${id}${notes.length ? ` (${notes.join("; ")})` : ""}`; }).join(", ")}`);
  }
  if (!views.length) lines.push("- none");
  lines.push("", ...renderObligations(m), "## Concurrency mechanics", "", `- **Worktree:** ${conc.worktree ?? "one worktree per epic, not recorded yet in constitution.yaml"}`, `- **Branch naming:** ${conc.branch ?? "type/description, not recorded yet in constitution.yaml"}`, `- **Merge strategy:** ${conc.merge ?? "not recorded yet in constitution.yaml"}`, "");
  return lines.join("\n");
}
