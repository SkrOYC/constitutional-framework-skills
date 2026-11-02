import { createHash } from "node:crypto";
import { exists, type EpicDoc, type Finding, type Model } from "./model.ts";

interface ObligationEvidence {
  kind: "repository" | "external" | "spike" | "ruling" | "measurement";
  ref: string;
  date: string;
  version?: string;
  note?: string;
}

interface TicketOwner {
  id: string;
  title: string;
  status: string;
  replaces: string[];
  doc: EpicDoc;
  pointer: string;
}

interface ObligationSource {
  id: string;
  summary: string;
  route: string[];
  doc: EpicDoc;
  pointer: string;
}

interface Resolution {
  source: string;
  outcome: "delivered" | "retired";
  evidence: ObligationEvidence;
  reason: string;
  doc: EpicDoc;
  pointer: string;
  proofState: "available" | "historical" | "unverified_historical" | "missing";
}

interface ObligationLeaf {
  id: string;
  owners: TicketOwner[];
  resolutions: Resolution[];
  issues: string[];
}

export interface ObligationView {
  source: string;
  summary: string;
  path: string;
  pointer: string;
  route: string[];
  owners: { id: string; title: string; status: string; active: boolean; path: string }[];
  outcome: "delivered" | "retired" | null;
  resolutions: { outcome: "delivered" | "retired"; evidence: ObligationEvidence; reason: string; path: string; proofState: Resolution["proofState"] }[];
  issues: string[];
}

interface ObligationResult {
  outstanding: ObligationView[];
  resolved: ObligationView[];
  findings: Finding[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_KEYS = new Set(["kind", "ref", "date", "version", "note"]);
const COMMIT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function evidence(value: unknown): ObligationEvidence | null {
  const data = record(value);
  const kind = data.kind;
  if (kind !== "repository" && kind !== "external" && kind !== "spike" && kind !== "ruling" && kind !== "measurement") return null;
  if (typeof data.ref !== "string" || !data.ref.trim() || typeof data.date !== "string" || !DATE.test(data.date)) return null;
  if (data.version !== undefined && typeof data.version !== "string") return null;
  if (data.note !== undefined && typeof data.note !== "string") return null;
  if (Object.keys(data).some((key) => !EVIDENCE_KEYS.has(key))) return null;
  return { kind, ref: data.ref, date: data.date, ...(typeof data.version === "string" ? { version: data.version } : {}), ...(typeof data.note === "string" ? { note: data.note } : {}) };
}

function followUpSource(epic: string, text: string): string {
  return `EPIC-${epic}#follow-up:${createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12)}`;
}

function historicalRepositoryProof(m: Model, proof: ObligationEvidence, cache: Map<string, boolean>): boolean {
  if (proof.kind !== "repository" || !proof.version || !COMMIT_ID.test(proof.version)) return false;
  const key = `${proof.version}\u0000${proof.ref}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let available = false;
  try {
    available = Bun.spawnSync(["git", "cat-file", "-e", `${proof.version}:${proof.ref}`], { cwd: m.root, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0" } }).exitCode === 0;
  } catch {
    available = false;
  }
  cache.set(key, available);
  return available;
}

/** Derives ownership and terminal evidence without treating ticket status or archival as delivery. */
export function deriveObligations(m: Model): ObligationResult {
  const findings: Finding[] = [];
  const sources = new Map<string, ObligationSource>();
  const tickets = new Map<string, TicketOwner[]>();
  const replacements = new Map<string, TicketOwner[]>();
  const resolutions = new Map<string, Resolution[]>();
  const invalidSources = new Set<string>();
  const historicalArtifacts = new Map<string, boolean>();
  const report = (doc: EpicDoc, pointer: string, message: string, severity: "error" | "warning" = "error") => {
    if (!findings.some((item) => item.file === doc.path && item.pointer === pointer && item.message === message)) findings.push({ id: "TSK-020", severity, file: doc.path, pointer, message });
  };
  const addSource = (source: ObligationSource) => {
    const prior = sources.get(source.id);
    if (!prior) { sources.set(source.id, source); return; }
    if (prior.doc.path !== source.doc.path || (source.id.includes("#follow-up:") && prior.summary !== source.summary)) {
      invalidSources.add(source.id);
      report(source.doc, source.pointer, `${source.id} identifies conflicting obligation sources; no resolution can be applied`);
      return;
    }
    for (const route of source.route) if (!prior.route.includes(route)) prior.route.push(route);
  };

  for (const doc of m.epics) {
    const data = record(doc.data);
    const epicId = typeof data.id === "string" ? data.id : "";
    const rawTickets: unknown[] = Array.isArray(data.tickets) ? data.tickets : [];
    for (const [index, raw] of rawTickets.entries()) {
      const ticket = record(raw);
      if (typeof ticket.id !== "string") continue;
      const owner: TicketOwner = { id: ticket.id, title: typeof ticket.title === "string" ? ticket.title : ticket.id, status: typeof ticket.status === "string" ? ticket.status : "unknown", replaces: strings(ticket.replaces), doc, pointer: `/tickets/${index}` };
      const matches = tickets.get(owner.id) ?? [];
      matches.push(owner);
      tickets.set(owner.id, matches);
      for (const source of owner.replaces) {
        const claims = replacements.get(source) ?? [];
        claims.push(owner);
        replacements.set(source, claims);
      }
      if (owner.status === "deferred") addSource({ id: owner.id, summary: owner.title, route: typeof ticket.deferred_to === "string" ? [ticket.deferred_to] : [], doc, pointer: owner.pointer });
    }
    const closeout = record(data.closeout);
    const deferred: unknown[] = Array.isArray(closeout.tickets_deferred) ? closeout.tickets_deferred : [];
    for (const [index, raw] of deferred.entries()) {
      const item = record(raw);
      if (typeof item.id !== "string") continue;
      const pointer = `/closeout/tickets_deferred/${index}`;
      const ticket = (tickets.get(item.id) ?? []).find((candidate) => candidate.doc.path === doc.path);
      addSource({ id: item.id, summary: ticket?.title ?? (typeof item.reason === "string" ? item.reason : item.id), route: typeof item.route === "string" ? [item.route] : [], doc, pointer });
    }
    const followUps: unknown[] = Array.isArray(closeout.follow_ups) ? closeout.follow_ups : [];
    for (const [index, text] of followUps.entries()) {
      if (epicId && typeof text === "string") addSource({ id: followUpSource(epicId, text), summary: text, route: [], doc, pointer: `/closeout/follow_ups/${index}` });
    }
    const rawResolutions: unknown[] = Array.isArray(closeout.obligation_resolutions) ? closeout.obligation_resolutions : [];
    for (const [index, raw] of rawResolutions.entries()) {
      const item = record(raw);
      const pointer = `/closeout/obligation_resolutions/${index}`;
      if (typeof item.source !== "string") continue;
      const proof = evidence(item.evidence);
      const reason = typeof item.reason === "string" ? item.reason : "";
      if ((item.outcome !== "delivered" && item.outcome !== "retired") || !proof || (item.outcome === "retired" && !reason.trim())) {
        report(doc, pointer, `${item.source} needs delivered or retired with explicit evidence; retirement also needs a reason`);
        continue;
      }
      let missing = false;
      if (proof.kind === "repository") missing = !exists(m, proof.ref);
      else if (proof.kind === "spike") missing = !m.spikes.includes(`${proof.ref}.md`);
      else if (proof.kind === "measurement") missing = !m.evidence.some((entry) => entry.dir === proof.ref || entry.dir.endsWith(`/${proof.ref}`));
      const proofState = !missing ? "available" : historicalRepositoryProof(m, proof, historicalArtifacts) ? "historical" : doc.active ? "missing" : "unverified_historical";
      const claims = resolutions.get(item.source) ?? [];
      claims.push({ source: item.source, outcome: item.outcome, evidence: proof, reason, doc, pointer, proofState });
      resolutions.set(item.source, claims);
      if (proofState === "missing") report(doc, pointer, `${item.source}: new ${item.outcome} claim has unavailable evidence ${proof.ref} and no verified historical proof; the obligation remains outstanding`);
      else if (proofState === "historical") report(doc, pointer, `${item.source}: ${item.outcome} reference ${proof.ref} is unavailable in the current tree; historical artifact is available at ${proof.version} and the recorded resolution is retained`, "warning");
      else if (proofState === "unverified_historical") report(doc, pointer, `${item.source}: historical ${item.outcome} evidence ${proof.ref} is unavailable and its past existence is unverified; the recorded resolution is retained as an unverified historical claim`, "warning");
    }
  }

  const reachable = new Set<string>();
  const pending = [...sources.keys()];
  while (pending.length) {
    const id = pending.pop();
    if (id === undefined || reachable.has(id)) continue;
    reachable.add(id);
    for (const owner of replacements.get(id) ?? []) pending.push(owner.id);
  }
  for (const [source, owners] of replacements) if (!reachable.has(source)) for (const owner of owners) report(owner.doc, `${owner.pointer}/replaces`, `${source} is not an existing deferred obligation or its linked replacement`);
  for (const [source, claims] of resolutions) if (!reachable.has(source)) for (const claim of claims) report(claim.doc, claim.pointer, `${source} is not an existing deferred obligation or its linked replacement`);
  for (const [id, owners] of tickets) if (reachable.has(id) && owners.length > 1) {
    invalidSources.add(id);
    for (const owner of owners) report(owner.doc, owner.pointer, `${id} has multiple ticket records; obligation ownership is ambiguous`);
  }

  const leavesById = new Map<string, ObligationLeaf[]>();
  const walk = (id: string, path: string[]): ObligationLeaf[] => {
    if (invalidSources.has(id)) return [{ id, owners: tickets.get(id) ?? [], resolutions: [], issues: [`${id} has conflicting source records`] }];
    if (path.includes(id)) return [{ id, owners: [], resolutions: [], issues: [`replacement cycle: ${[...path.slice(path.indexOf(id)), id].join(" → ")}`] }];
    const cached = leavesById.get(id);
    if (cached) return cached;
    const records = resolutions.get(id) ?? [];
    const claims = records.filter((claim) => claim.proofState !== "missing");
    if (claims.length) {
      if (new Set(claims.map((claim) => claim.outcome)).size > 1) return [{ id, owners: tickets.get(id) ?? [], resolutions: [], issues: [`${id} has conflicting delivery and retirement records`] }];
      return [{ id, owners: tickets.get(id) ?? [], resolutions: claims, issues: [] }];
    }
    const owners = replacements.get(id) ?? [];
    if (!owners.length) return [{ id, owners: tickets.get(id) ?? [], resolutions: [], issues: records.length ? [`${id} has an unverified resolution claim without available or verified historical evidence`] : [] }];
    const leaves = new Map<string, ObligationLeaf>();
    for (const owner of owners) for (const leaf of walk(owner.id, [...path, id])) leaves.set(leaf.id, leaf);
    const result = [...leaves.values()];
    if (result.every((leaf) => !leaf.issues.length)) leavesById.set(id, result);
    return result;
  };

  const result: ObligationResult = { outstanding: [], resolved: [], findings };
  for (const source of sources.values()) {
    const leaves = walk(source.id, []);
    const issues = [...new Set(leaves.flatMap((leaf) => leaf.issues))];
    if (leaves.length > 1) issues.push(`multiple replacement owners: ${leaves.map((leaf) => leaf.id).join(", ")}; link the replacement chain or resolve the source explicitly`);
    for (const issue of issues) report(source.doc, source.pointer, `${source.id}: ${issue}`);
    const claims = leaves.flatMap((leaf) => leaf.resolutions);
    const first = claims[0];
    const outcome = issues.length === 0 && leaves.length === 1 && first ? first.outcome : null;
    const owners = leaves.flatMap((leaf) => leaf.owners);
    const view: ObligationView = {
      source: source.id, summary: source.summary, path: source.doc.path, pointer: source.pointer, route: source.route,
      owners: owners.map((owner) => ({ id: owner.id, title: owner.title, status: owner.status, active: owner.doc.active, path: owner.doc.path })),
      outcome, resolutions: claims.map((claim) => ({ outcome: claim.outcome, evidence: claim.evidence, reason: claim.reason, path: claim.doc.path, proofState: claim.proofState })), issues,
    };
    if (outcome) result.resolved.push(view);
    else result.outstanding.push(view);
  }
  return result;
}
