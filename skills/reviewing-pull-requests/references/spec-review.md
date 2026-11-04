# Spec review

Review whether the integrated PR satisfies its declared acceptance criteria, contracts, product constraints, and architectural boundaries, applying the router's candidate, evidence, verification, and completion rules. This mode covers the spec axis; do not imply it proves all implementation correctness.

## Read the applicable requirements

Read the active epic tickets in `.constitution/tasks/epics/EPIC-*.yaml`, their acceptance modes and evidence bodies, and the relevant authorized plan. Read the TechSpec guidelines, verification recipes, compatibility ADR, contract and data-model sidecars, their actual artifacts at `artifact_path`, and any `pinned` shape.

Use `.constitution/architecture/` for boundaries and flows, `.constitution/prd/` for capability intent and constraints, and `glossary.yaml` for canonical domain terms. In a repository without a constitution, use the referenced issues and owner requirements. State missing requirements as a confidence limit; do not invent them. Cite and quote the exact requirement a finding depends on, though a concrete code defect can also be established by its source trace and affected contract.

## Match the review to the delta

Capture the full candidate through `gh` or the offline contract, and review every changed surface relevant to this axis:

- *Constitution documents:* Check stage ownership, required versions and changelogs, contradictions, references, and downstream effects. Related stage changes can share a coherent PR when each stage uses its authorized route.
- *Other documents:* Check accuracy against the actual code, commands, contracts, and claimed behavior.
- *Code:* Compare integrated behavior with declared ticket outcomes, contracts, boundaries, and compatibility rules.
- *Mixed changes:* Inspect the separate code/spec commits and their sequence, judging the code against the applicable authorized spec. A shared PR does not authorize a code commit to rewrite its own upstream requirements.

For a broad delta, investigate coherent risk-based batches and then their interactions. Size thresholds are planning guides, not escalation or separate-PR requirements.

## Verify claims and evidence

Map each claimed completed outcome to its implementation and proof under the ticket's declared acceptance mode. Do not convert every criterion into Gherkin or require one unit test per scenario; public-interface checks, contracts, benchmarks, invariants, visual comparisons, runbooks, hardware procedures, and live probes each need evidence suited to their claims.

Decide the load-bearing assumptions with the router's change-type proof and evidence-reuse rules, inspecting actual artifacts and retained observations rather than a manifest's pass label.

Treat milestone evidence as scoped implementation proof, and independently examine cumulative interactions, integration with the captured base, compatibility, and final PR claims.

Compare requested outcomes with actual changes, flagging unauthorized capability or contract expansion, missing acceptance behavior, and boundary changes. Routine execution regrouping or incidental corrections inside the approved envelope need no wave amendment; review recorded scope deviations in context.

Read accepted decisions, deferred obligations and their owners, and prior dismissals, and do not re-file an accepted preference. If a known gap causes a concrete defect outside the accepted ruling, explain the trigger and violated requirement.

## Check relevant contracts and invariants

- *Correctness:* Required state transitions, error outcomes, edge conditions, partial failures, retries, and issue closure behave as specified.
- *Security:* Authentication, authorization, trust boundaries, input handling, and sensitive-data rules preserve the declared guarantees.
- *Compatibility and data:* Published surfaces, `pinned` shapes, stored data, rollout, and recovery remain consistent with the compatibility ADR and approved amendments.
- *Concurrency and resources:* Ownership, ordering, cancellation, transactions, idempotency, and cleanup preserve the relevant invariants.
- *Performance:* Comparable measurements support stated thresholds; a smell such as a loop or cache miss is not itself proof of a regression.
- *Verification quality:* Assertions check meaningful outcomes through real interfaces. Missing unit tests alone is not a finding; a false pass or materially unsupported acceptance claim is.
- *Domain language:* Canonical terms apply on the intended domain surfaces, and a banned synonym is banned only when replacing its canonical concept. A real new concept routes to the owning stage, not an unauthorized glossary edit in a code commit. Technical words such as pool, worker, or cache do not automatically need glossary entries.

## Return findings

Use the smallest supported severity:

- `P0`: A severe contract or correctness defect with security, data-loss, or production risk.
- `P1`: Meaningful unmet acceptance, a contract/boundary violation, or a domain-facing naming violation with a binding requirement.
- `P2`: A smaller concrete spec, logic, scope, compatibility, or verification defect.
- `Investigate`: A grounded possible deviation with a concrete evidence path.
- `General feedback`: Useful non-blocking spec-alignment feedback.

Historical verified-at SHAs are not pins to keep current. A `done` ticket with failed or absent required proof, a false pass, contradictory evidence, or invalid framework data is an acceptance defect, but under the execution stage's evidence timing, proof not yet due is not missing proof.

Return the router's completion fields and findings in this format, omitting empty subsections:

```md
## Spec Findings

### P0
path:line-range
Trigger, evidence, severe consequence, and applicable requirement.

### P1
path:line-range
Trigger, evidence, consequence, and applicable requirement.

### P2
path:line-range
Concrete deviation, evidence, and consequence.

### Investigate
path:line-range
Question and evidence needed to decide it.

### General feedback
path:line-range
Non-blocking spec-alignment observation.
```
