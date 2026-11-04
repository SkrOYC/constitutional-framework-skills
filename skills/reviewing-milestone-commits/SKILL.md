---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
---

# Reviewing milestone commits

Independently review one committed, coherent milestone during epic execution. The source can be one commit, an explicit base/head range, or an explicit coherent commit set that includes incidental implementation and repair commits. Review the exact combined milestone delta and its interactions. Do not group separate milestones or infer a larger range.

This review assesses local implementation and milestone acceptance. PR review separately assesses cumulative integration, cross-milestone assumptions, and final claims. A clean milestone review does not prove the whole PR or grant merge authority.

{% if harness.id == "codex" %}For a Claude caller, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md). Establish your inbox, send the review through the caller's confirmed address, and keep one blocking receive waiter active alongside sends while the assignment expects continuation. Preserve the review-only scope.

{% endif %}## Inputs and stance

The caller supplies the exact source identity, matching checkout, milestone/ticket ids or lane claim, governing epic or issue, acceptance modes and evidence, relevant plan constraints, and verification references. A spec-patch review also needs its drift report. If source identity is missing or ambiguous, return an incomplete-review report.

Read unfamiliar constitution layout from `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/references/layout.md`. Use the active epic, TechSpec contracts and actual artifacts, architecture boundaries, PRD constraints, and applicable authorized decisions. In Issue mode, use the issue and passed acceptance criteria. If requirements are unavailable, review the source but state the acceptance limit.

Treat implementation notes and earlier checks as evidence to inspect, not proof to accept uncritically. Ground findings in the source, affected code paths, acceptance criteria, contracts, or binding conventions. Cite and quote requirements when a finding depends on them. A concrete source trace can prove a defect without runtime execution; unavailable execution must be disclosed separately.

Use this skill for committed milestone review, including spec patches and spikes. It is not for implementation help, uncommitted diffs, PR review, or a repository-wide audit.

## Establish the exact delta

Confirm the requested commit or base/head and the checkout's head. Keep tracked files clean and the checkout at the supplied revision. Do not create review worktrees, switch branches, alter shared runtime state, or launch competing verification jobs.

For a single commit, inspect its metadata, changed files, and diff:

```sh
git show --stat --summary <commit>
git show --find-renames --find-copies <commit>
```

For an explicit base/head range, the base is excluded and the head included:

```sh
git log --reverse --format=fuller <base>..<head>
git diff --stat <base> <head>
git diff --find-renames --find-copies <base> <head>
```

Inspect each constituent commit as well as the combined delta. For an explicit commit set, retain that exact list and inspect its individual changes and affected final state. Do not silently include intervening milestones. If the set cannot be attributed coherently, report the scope ambiguity before claiming complete coverage.

Capture touched tests, contracts, validation artifacts, and evidence. For a broad delta, investigate coherent batches ordered by risk and finish with their interactions. File and line counts are guides, not reasons to require a separate PR or larger panel. State any unreviewed surfaces.

## Check commit authority and change type

Apply code/spec separation to each commit, not to the aggregate range. A code commit cannot also change `.constitution/prd/`, `.constitution/architecture/`, or `.constitution/tech-spec/`. The epic's own task bookkeeping, `.constitution/spikes/`, and `.constitution/evidence/` are exempt bookkeeping. An actual code/spec mix in one commit is a `P1` with the offending paths.

A coherent milestone range can include separately authorized spec and implementation commits. Inspect their order and ownership. Judge code against the applicable authorized spec state; do not treat an upstream rewrite in the same code commit as permission. A shared range or PR does not transfer stage authority.

Choose the checks suited to the changed surfaces:

- *Spec patch:* Match the drift report, declared `scope.tech_spec_patchable` paths, and authorized physical decision. Logical boundaries, communication style, trust, scope, and priority changes route through their owning stage. Validate affected artifacts. Reconciliation owns the stage changelog entry for an execution patch.
- *Spike:* Check the Stage 4 spike template, concrete question, effort budget, evidence, and what it unblocks. An active-spec recommendation identifies its owning stage; the spike does not silently edit that spec.
- *Other constitution documents:* Check owning-stage authority, canonical terms, contradictions, required versions and references, and explicit downstream repair or staleness. Related stage changes can share a coherent PR through authorized routes.
- *Other documents:* Verify code accuracy, commands, paths, diagrams, and claimed behavior. Run code checks only when they decide an affected claim.
- *Fast lane:* Confirm the lane claim and `Constitution-Lane: fast` trailers. Stay within permitted code paths, with no published sidecar artifact, `pinned` contract, or boundary change. Check `Settles:` names a real record and `Evidence:` exercises it. A change outside the lane is a `P1`.
- *Code:* Inspect the implementation and relevant acceptance. Review ticket status, deviations, decisions, and evidence for accuracy against the actual delta.

## Read contracts and surrounding code

Use `.constitution/tasks/epics/EPIC-*.yaml` for scope, dependencies, acceptance modes, and outcomes. Use TechSpec verification recipes, compatibility ADRs, sidecars, actual `artifact_path` artifacts, and `pinned` shapes. Use architecture and PRD records for boundaries, capability intent, constraints, and domain language.

Compare the changed behavior and paths with the approved envelope and recorded deviations. Routine regrouping, incidental corrections, and implementation adaptations inside that envelope do not need a wave amendment. Distinguish those from a changed outcome, contract, dependency, shared resource, or out-of-authority scope. Flag unexplained material drift at the severity its consequence warrants; do not invent a blocker for every incidental file.

Read relevant surrounding code, callers, callees, interfaces, configuration, tests, migrations, and operational paths. Identify the safety assumptions most likely to fail. Choose the cheapest decisive source trace or focused observation for each material assumption.

Match proof to the change type:

| Change | Evidence to inspect |
| :--- | :--- |
| Behavior or repair | Real public-interface outcomes, the failing case, and relevant error and boundary states. |
| Refactor | Preserved interfaces, state transitions, failure semantics, and existing behavioral coverage. |
| Migration or contract | Actual artifacts, representative prior data/clients, compatibility, rollout, and recovery invariants. |
| Concurrency or lifecycle | Ownership, ordering, retry, cancellation, and cleanup; targeted schedules or traces when needed. |
| Performance | Comparable workload, baseline, environment, and measurements against the stated meter. |
| Documents | Valid records, references, scenario or command accuracy, and downstream meaning. |

Code smells prompt investigation; they are not findings or canned refactor instructions. Explain a concrete consequence before proposing extraction, new types, or a different abstraction. Names, types, structure, and invariants carry intent. Ordinary code comments are rare; TSDoc-style contracts and license headers are exempt. Comments never establish safety or replace acceptance proof.

## Inspect verification and acceptance

Inspect recorded command results by candidate and input identity, environment, exit status, observed outcome, and coverage. Reuse valid evidence. Run focused checks only for missing, invalidated, unreliable, uncovered, or explicitly required proof. Do not repeat the full gate set because the role changed.

Inspect a successful framework `validate` result for the committed validation inputs. If none exists and execution is permitted, run:

```sh
bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts validate --root <checkout>
```

A validation error on the reviewed tree is a `P1` with its check id. Manifest validation establishes declared file existence and digests; inspect the observations that substantiate behavior without manually repeating every hash.

Use the ticket's declared acceptance mode, not a universal Gherkin or unit-test requirement:

| Mode | What to verify |
| :--- | :--- |
| `gherkin` | Observable checks cover the stated Given/When/Then behavior. Scenarios can share meaningful public-interface coverage. |
| `contract_test` | Assertions exercise the actual `artifact_path` contract rather than a copied shape. |
| `benchmark` | Workload, environment, baseline, and threshold support the ticket's performance claim. |
| `stat_threshold` | Named split, evaluation command, metric, and threshold match; the split was not weakened to pass. |
| `invariant` | The checker, property/fuzz run, or proof encodes the stated invariant and covers the declared corpus or budget. |
| `hitl_sil` | Procedure and pass/fail criteria are committed; observations meet them, or an owner-authorized hardware deferral is explicit. |
| `visual_regression` | Baseline, comparison, and threshold support the claimed visual outcome. |
| `runbook_probe` | The stated apply/plan/probe procedure reaches the required end state. |
| `live_probe` | Required behavior checks cover the ticket and the recipe matches TechSpec. Final runtime evidence is captured after the last milestone. Its absence before then, with the ticket kept `in_progress`, is not a finding. |

Prefer useful existing coverage and real public-interface behavior checks. Pure unit tests are rare high-value exceptions. Missing unit tests alone is not a finding, and there is no test-per-ticket or test-per-scenario quota. A proof gap matters when required acceptance or a concrete material regression risk lacks coverage.

Do not accept proof obtained by loosening the required threshold, baseline, corpus, or split. Missing or failed proof due at this milestone is a `P1`; evidence not yet due is not. A `done` ticket with absent or failed required results, a false pass, contradictory observations, or invalid evidence is a `P1`. Historical verified-at SHAs are not pins to update automatically.

## Investigate relevant risks

- *Correctness:* Acceptance fit, affected callers, boundaries, partial failure, retries, and empty or invalid state.
- *Contracts and authority:* Published compatibility, `pinned` shapes, declared boundaries, and authorized amendments. Record a new physical code decision for Stage 3 alignment through closeout; do not demand an upstream edit in the code commit.
- *Assumptions:* Interim decisions name where they apply. If changed behavior depends on an assumed contract or boundary, inspect evidence that can settle it; an unsupported material assumption is a grounded Investigate concern.
- *Security:* Authentication, authorization, ownership, untrusted input, secrets, and sensitive data.
- *Data and lifecycle:* Representative stored data, concurrent ownership, transactions, cleanup, rollout, and recovery.
- *Performance and operability:* Actual workload effects and required diagnostic signals; do not invent a telemetry project.
- *Verification quality:* Assertions observe real outcomes and meaningful interfaces, rather than merely mirroring implementation or using empty mocks.
- *Language:* Canonical glossary terms apply to their intended domain concepts. A banned synonym replacing its canonical term on a binding domain-facing surface is a `P1`; internal naming feedback is non-blocking. A real new concept routes through candidate glossary terms in closeout. Technical vocabulary alone is not glossary material.

Apply the owner's required gates. Private projects verify locally by default; remote tests require an owner need. Open-source projects accepting outside contributions use contribution CI behavior checks by default. Visibility alone does not establish that model. Keep test workflows/actions separate from authentication, signing, publishing, deployment, and release execution. Add a dependency between them only when the owner requires it. Arbitrary CI green is not a milestone-review condition.

## Classify and return the review

Use the smallest supported severity:

- `P0`: Severe correctness, security, data-loss, or production-breakage risk that blocks continuation.
- `P1`: Meaningful incorrect behavior, broken acceptance, contract violation, or serious operational risk.
- `P2`: A smaller concrete correctness, quality, user-facing, or maintenance defect.
- `Investigate`: A grounded unresolved question and the evidence needed to decide it.
- `General feedback`: Useful non-blocking feedback tied to the milestone.

Do not classify speculative concerns or preference-only refactors as bugs. Accepted governing tradeoffs resolve preference concerns; a comment does not dismiss a proven defect. Source-based findings state the trigger, path, and consequence even when execution is unavailable.

Return the exact reviewed commit or base/head and commit set, coverage completed and gaps, findings or an explicit statement that there are none, and verification inspected or run. State acceptance status and limits separately from review completeness. Neither is merge authorization. A missing source, wrong revision, or incomplete review is not a clean result.

Keep findings in this order, omitting empty subsections:

```md
## Potential Bugs

### P0
path:line-range
Trigger, evidence, consequence, and applicable requirement.

### P1
path:line-range
Trigger, evidence, consequence, and applicable requirement.

### P2
path:line-range
Concrete defect, evidence, and consequence.

## Flags

### Investigate
path:line-range
Question and decisive evidence needed.

### General feedback
path:line-range
Useful non-blocking observation tied to the milestone.
```

After repair, independently verify the exact changed scope and its interactions. Every final behavioral edit needs that verification, including behavior outside live-probe coverage. Reuse unaffected evidence. If two related repairs fail under the same premise, state and test that premise before a third patch; follow the caller's approved nonconvergence policy rather than repeating a ritual or claiming unsupported acceptance.
