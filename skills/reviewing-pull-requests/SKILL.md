---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# Reviewing pull requests

Review a complete, revision-bound PR candidate in the requested mode. Use the matching workflow:

- `mode: "standards"`: [Standards review](references/standards-review.md).
- `mode: "spec"`: [Spec review](references/spec-review.md).
- `mode: "documents"`: [Documents review](references/documents-review.md), for constitution-only PRs.
- `mode: "full"` or no mode: [Full review](references/full-review.md).

Run that workflow's checks with the shared rules below. An axis review establishes coverage of that axis; it does not claim a full review.

## Evidence and review judgment

Identify what must remain true for the change to be safe. State the important safety assumptions, then seek the cheapest evidence that can decide them. Follow affected callers, data paths, failure states, and governing contracts. Match proof to the change:

| Change | Useful decisive evidence |
| :--- | :--- |
| Behavior or bug repair | Observable results through the real public interface, including the failing case and relevant failure paths. |
| Refactor | Preserved interfaces, state transitions, and failure semantics; unchanged public behavior and existing regression coverage. |
| Contract, migration, or stored data | Compatibility against the actual artifact, representative prior data or clients, and rollout/recovery invariants. |
| Concurrency or lifecycle | Ordering, ownership, cancellation, retry, and cleanup traces; a targeted schedule or reproducible race when needed. |
| Performance | Comparable workload, environment, baseline, and measurements against the stated threshold. |
| Documents or tooling instructions | Referenced sources, resolvable paths and records, valid structure, and meaningful command or scenario checks when needed. |

Prefer useful existing coverage and real behavior checks. Pure unit tests are rare high-value exceptions; missing unit tests alone is not a finding. Do not impose a test-per-ticket quota or request implementation-mirroring assertions. Missing evidence matters when a concrete acceptance claim or material regression risk lacks proof.

Ground findings in the candidate, surrounding code, referenced requirements, or established project conventions. Cite and quote a requirement when the finding depends on it. A decisive source trace can prove a defect even when runtime execution is unavailable. Disclose execution limits without downgrading an established bug to speculation. An uncertain claim needs a concrete question and evidence path.

Code smells prompt investigation; they do not prescribe a refactor. Explain the actual consequence before recommending structural change. Prefer names, types, structure, and invariants over ordinary code comments. TSDoc-style contracts and license headers are exempt. Comments explain intent; they do not prove safety or override code, contracts, or acceptance.

## Candidate inputs

When the caller supplies `snapshot: ABSOLUTE_DIRECTORY`, expected `head: HEAD_SHA`, and a checkout, read [Offline snapshot](references/offline-snapshot.md) first. Its completeness and revision checks replace GitHub fetch steps. Use the snapshot for hosted context and the matching checkout for surrounding code. Required missing inputs produce an incomplete-review report.

Without a snapshot, capture and confirm the base and head SHAs, merge base, full diff and changed-file inventory, PR context, and referenced issues. Confirm the supplied checkout matches the head and is free of tracked edits. Keep the review read-only; do not switch branches, create worktrees, or compete for shared runtime state. Do not review a partial diff as if it were the whole candidate.

## Milestone evidence and verification rounds

A milestone review establishes its scoped implementation and acceptance assessment. A PR review must account for the full cumulative delta, cross-milestone interactions, integration with the captured base, and final PR claims. Reuse valid milestone evidence without assuming it proves the integrated PR.

When the prompt names `since` and prior findings, review the delta from that exact commit to the head plus its affected dependencies and interactions. Confirm each prior Act-on finding is resolved; report unresolved findings at their original severity. Do not reopen a reasoned dismissal unless the delta or other changed evidence invalidates its grounds. Retain complete candidate context. Expand coverage when a base change, repaired shared assumption, changed contract, or missing prior coverage requires it.

Inspect recorded results by source and input identity, command, environment, outcome, and coverage. Rerun only invalidated, unreliable, missing, risk-driven, or required checks. A role change alone does not invalidate evidence. Historical verified-at evidence remains historical; assess whether its inputs cover the candidate rather than demanding a fresh SHA label.

Every final behavioral repair requires scoped independent review, whether or not a live probe covers that behavior. Runtime checks and review answer different questions.

## Completion and authority

Return the reviewed base/head and any `since` SHA, coverage completed and gaps, findings or an explicit statement that there are none, and verification results inspected or run. State acceptance evidence limits separately. An access error, wrong revision, empty response, or incomplete coverage is not a clean review. These fields take precedence over a mode's restrictions on text outside findings; keep its findings format.

Review completeness, acceptance status, and merge authorization are distinct. Do not infer merge permission from clean review or passing checks. Apply required owner gates without inventing a universal CI requirement. Private projects verify locally by default; remote tests require an owner need. Open-source projects accepting outside contributions use contribution CI behavior checks by default. Visibility alone does not establish contribution policy. Keep test workflows/actions separate from authentication, signing, publishing, deployment, and release execution. Add a dependency between them only when the owner requires it.
