---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# PR review fix loop

Use this skill after a PR exists: independently review the complete candidate, triage findings, repair coherent causes, and verify the changed scope. A completed milestone review covers that milestone's implementation and acceptance; PR review covers integration, cross-milestone assumptions, and the final claims, so earlier reviews do not prove the whole PR.

## Configuration and dispatch

Use the caller's approved `review_panel`, `fix_worker`, `review_escalate_at`, fallback, and resource policy; an execution caller supplies these from its plan. A direct invocation without configuration uses one available independent reviewer and a suitable available fixer. Ask only when a needed choice exceeds the existing authority or resource envelope.

| Setting | Meaning | Default |
| :--- | :--- | :--- |
| `review_panel` | Independent reviewers, each `{runtime, model, mode}` | One verifier for bounded risk. Add reviewers for distinct security, migration, concurrency, or integration risks; line count alone does not require a panel. Use `documents` when every changed path is under `.constitution/`. |
| `fix_worker` | Runtime and model for coherent repairs | The caller's approved choice, or an available model suited to the repair. |
| `review_escalate_at` | A strategy checkpoint if unresolved findings remain | 4; repeated failure can require a premise check earlier. |

Establish the runtime's schema, capabilities, and approved model/fallback choice once per session, rechecking only after a runtime change or a failed capability assumption.

{% if harness.id == "claude" %}Pass the approved model on every dispatch. A Claude reviewer or fixer uses the Agent tool with an available non-fork type, such as `subagent_type: "general-purpose"`; a `fork` type inherits parent history and is unsuitable for independent review. Check the child type's actual tools, since background Agent children can have a reduced tool pool. A Codex or pi reviewer uses the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls, with external model ids discovered through that skill's `models` command. Tell it to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md`, because it cannot invoke a Claude skill by name. Supply a snapshot when effective permissions do not allow GitHub access.{% elif harness.id == "codex" %}Dispatch Codex reviewers through `collaboration.spawn_agent` with `fork_turns: "none"` and the approved available model and reasoning effort; full-history forks inherit model and effort and accept no overrides. A native child inherits the parent's host permissions, so a review-only prompt is a role constraint, not a separate sandbox. For a Claude reviewer or fixer, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md) and launch a fresh Claude background session with the approved model, effort, permissions, checkout, and stop boundary. Require native SendMessage results to the caller bridge, keeping one blocking receive waiter active alongside sends. Dispatch pi reviewers through `pi-subagent` with its supported read-only controls. Append the bridge reporting contract to external briefs, including a Codex reviewer's brief when its caller is Claude. Use a snapshot when effective permissions do not allow GitHub access.{% elif harness.id == "antigravity" %}An Antigravity reviewer uses `invoke_subagent` with a fresh context and the approved schema-supported model choice. Select a review-only type and controls from the exposed tool schema, without inventing tier names or argument casing. Native children inherit host permissions, and disabling write tools can also remove command execution, so a review-only type might be unable to check source identity or run required investigation. Supply a complete snapshot, use an approved capable runtime when needed, and report incomplete coverage when required checks remain unavailable. A fixer receives only its batch's authority and no delegation authority. For an external model id, use the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls, discovering ids through that skill's `models` command. Every reviewer reads `~/.gemini/antigravity-cli/skills/reviewing-pull-requests/SKILL.md`.{% else %}A Grok reviewer uses `spawn_subagent` without a subagent type, following the exposed schema and the approved model or inheritance policy; do not invent a `model` argument the runtime does not accept. The prompt prohibits file changes and further delegation. A Codex or pi reviewer uses the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls, with external model ids discovered through that skill's `models` command. Tell it to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md`, because it cannot invoke a Grok skill by name. Supply a snapshot when effective permissions do not allow GitHub access.{% endif %}

## Establish the candidate

Resolve the PR from the caller or `gh pr view`; if no PR exists, return that blocker. Capture the repository, PR number, base and head SHAs, merge base, complete changed-file inventory and diff, issue requirements, comments, reviews, and available check status.

Confirm the supplied checkout matches the candidate head with no tracked changes. Reviewers stay in that checkout without switching branches, creating worktrees, or changing shared runtime state. Establish effective network access for each runtime; a filesystem read-only policy does not by itself establish it.

For offline review, publish a complete immutable snapshot under an ignored worktree scratch directory, following both the producer and consumer requirements, including reuse and invalidation, in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/reviewing-pull-requests/references/offline-snapshot.md`. Never edit a snapshot while reviewers use it.

## Review independently

Dispatch the configured reviewers with fresh contexts, supplying only the skill, mode, PR, expected base and head, checkout, optional snapshot, relevant governing policy, and existing verification references. Independent reviewers inspect the assumptions and observations behind that evidence; independence does not require repeating every expensive check.

Use this prompt, replacing the placeholders:{% if harness.id == "codex" %} Each reviewer loads its own runtime's rendered skill from `~/.codex/skills/` or `~/.claude/skills/`, so for Claude recipients replace the skill path with `~/.claude/skills/reviewing-pull-requests/SKILL.md` and append the bridge reporting contract. A Codex reviewer with a Claude caller also receives the bridge reference and caller identity.{% endif %}

<reviewer_prompt>

```text
Read ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/reviewing-pull-requests/SKILL.md and follow mode: "<mode>".

PR: <number>. Expected base: <base-SHA>. Expected head: <head-SHA>.
Checkout: <absolute worktree path>. Snapshot, when supplied: <absolute directory>.
Verification references and governing policy: <paths or none>.

Review the full candidate in this mode. Identify load-bearing safety assumptions and use the cheapest decisive evidence for the changed behavior. Return the reviewed base/head, coverage completed and any gaps, findings or an explicit statement that there are none, acceptance evidence limits, and checks inspected or run. Report grounded low-severity findings and Investigate concerns without padding to a count.

Do not create, edit, or delete files, alter shared runtime state, or spawn further subagents. Work directly within the granted host permissions.
```

</reviewer_prompt>

When multiple reviewers are justified, dispatch them in parallel and wait for each required result before triage. Use approved fallbacks for unavailable runtimes. An empty response, access failure, wrong revision, or incomplete review is not clean: repair the concrete input or runtime problem and retry once when useful, and report a blocker if no approved route completes.

Before accepting a result, confirm the candidate base/head and relevant hosted requirements remain current. Refresh changed context and invalidate only affected judgments or coverage; a base change can alter integration risk even when the head is unchanged.

## Triage findings

{% if harness.id == "codex" %}Judge the consequence as well as the evidence; a provable discrepancy is not automatically a useful change. Interpret ambiguous wording against the governing intent, actual behavior, and compatible established practice, and give an equivalent expression no abstraction or repair. Honor required gates and acceptance, repairing their failures minimally or reporting the blocker. Do not dismiss a demonstrated correctness defect as a preference.

{% endif %}Read each finding against the code and governing requirements. Deduplicate shared defects while keeping reviewer attribution; agreement is supporting signal, not proof. Put each finding in one bucket with a short reason:

- *Act on:* {% if harness.id == "codex" %}A confirmed `P0` or `P1`, failed required acceptance or gates, or a concrete `P2` whose effect and proportionate repair justify changing this candidate. A binding contract violation or broken documented command remains actionable; explain the actual failure rather than treating wording alone as one.{% else %}A confirmed `P0` or `P1`, or a real `P2` correctness, user-facing, contract, or acceptance defect. Broken documented commands and handoffs count.{% endif %}
- *Consider:* A valid improvement whose cost or scope exceeds its value for this candidate. Fix it only when authorized and worthwhile; otherwise name its follow-up owner.
- *Noted:* Valid context or historical evidence bookkeeping. An older verified-at SHA is not itself a defect. Missing required proof, a false pass, contradictory observations, failed validation, or a `done` ticket with failed or absent required results belongs in Act on.
- *Dismissed:* Unsupported, incorrect, preference-only, or already resolved by governing policy. Cite the evidence or accepted ruling. A comment can explain intent; it cannot prove safety or dismiss a concrete defect.

Preserve triage, dismissals, candidate identities, and strategy decisions in the existing local run artifact or execution record, not a separate manually synchronized ledger. Publish one cumulative PR update at completion or a material blocker, unless the owner requires per-round comments.

If the complete initial review has no Act-on findings, proceed to completion; there is no repair delta to verify.

## Repair coherent causes

{% if harness.id == "codex" %}Group accepted findings by cause, scope, and proof into coherent repair batches. Dispatch a fresh fix worker with `fork_turns: "none"` for each native Codex batch, or an isolated worker on the approved external runtime; do not resume the completed implementation worker to repair reviewed work. The fixer owns the whole batch, including formatting, typing, and focused verification, and may continue while that assignment remains unfinished. Leads handle only mechanical bookkeeping within their own write authority. Do not create a worker or commit for each minor finding, or insert a new implementation milestone for a repair.
{% else %}Group accepted findings by shared root cause, owned scope, and validation needs into one bounded fix assignment per substantive batch; the lead can handle a mechanical correction within its authority. The same worker stays responsible for routine formatting, typing, and focused verification within that assignment. Do not create workers or commits for each minor nit.{% endif %}

Give the fixer the candidate, accepted findings, relevant paths and constraints, prior failed attempts, and the required evidence. Require these outcomes:

- Re-read the affected code and determine why the defect occurs. Fix the cause within authority; do not hide an impossible state with a guard or retry.
- Express meaning in names, types, structure, and invariants, not reassuring comments added to satisfy review. Ordinary code comments are rare; TSDoc-style API contracts and license headers are exempt.
- Reconcile affected contracts, fixtures, generated artifacts, repeated values, and final PR claims. Update a check that pins a changed contract when needed.
- Prefer public-interface behavior checks and useful existing coverage. Add isolated unit tests only for a rare high-value case; there is no test-per-finding quota.
- Complete routine formatting and type fixes, and run the narrowest meaningful checks. Record candidate/input identity, command, exit status, environment, observed outcome, and coverage so results can be reused.
- Do not delegate further or exceed the batch's file, resource, or host-permission authority.

When the caller owns commit discipline, return the repaired changes for that process; otherwise use the authorized commit and push workflow with descriptive commits. Never make an empty commit. Keep the PR description accurate for the cumulative change.

## Verify the changed scope

After repairs, obtain independent verification of the changed candidate, supplying the prior reviewed SHA as `since`, the exact repair delta, prior Act-on and Dismissed findings, relevant interactions, and reusable evidence, with the complete candidate context still available. Refresh only invalidated snapshot material and metadata, following the snapshot contract.

{% if harness.id == "codex" %}Continue the same author-independent reviewer with `followup_task` when appropriate, or give a fresh verifier the prior report and dispositions; either way, brief it explicitly as repair verification from `since`, not another initial full review. Reuse unaffected coverage, and broaden only for a changed interaction, invalidated assumption, or missing prior coverage, naming that reason. The verifier remains read-only and never becomes a fixer.

{% endif %}As with `review_panel`, one independent verifier is the default for bounded repairs; add expertise or expand coverage when the repair introduces distinct security, migration, concurrency, compatibility, or integration risk. Changed-file count alone does not require a full panel. The verifier confirms every accepted repair, examines its interactions, and reviews any uncovered effects. Unchanged findings are not reopened unless new evidence changes their grounds.

Triage new findings and repair further Act-on defects. Stop when required coverage is complete, every prior Act-on finding is resolved, and the independent review finds no new Act-on finding. A second confirming clean round is unnecessary.

Every final behavioral edit requires this scoped independent verification, including edits outside live-probe coverage; passing runtime checks alone do not replace review. A mechanical correction can reuse applicable checks and be confirmed directly without a new panel, but one that changes behavior, safety assumptions, or acceptance claims is a repair delta.

## Change strategy when repairs fail

After two related failed repairs based on the same premise, state and test that premise before a third patch: name the expected invariant, the contrary observation, and the cheapest decisive probe or source trace. Change the root-cause approach using that evidence instead of repeating the same patch elsewhere.

At `review_escalate_at`, reassess unresolved causes, coverage, resources, and authority, and choose a useful change: a bounded diagnostic, a different repair approach, an approved fixer or specialist, or broader independent review. Do not cycle through a fixed escalation sequence or add agents without a concrete risk to investigate.

Continue while a supported repair path fits the approved authority and resources; when none does, use the caller's approved fallback or nonconvergence policy. Return the unresolved defect, evidence, attempts, and next decision as a blocker; never manufacture review-clean status.

## Documents mode

Constitution-only PRs use the same triage and scoped verification principles. Keep repairs focused on actionable contradictions, stage authority, broken references, and downstream effects. Small related stage changes can share a coherent PR while each stage owns its decisions and code/spec commits remain separate.

If verification reveals another substantive defect, repair and independently verify the affected records, or report it unresolved; a round limit never makes a document PR clean. Report mechanically detectable findings as tooling follow-ups without replacing the current repair with a tooling project.

## Complete the loop

Report the final base/head, review scope and completeness, reviewers used, accepted repairs, deferred items and owners, dismissals with reasons, strategy changes, and verification limits. Cite existing results concisely; retain full logs in the run artifacts.

Keep three conclusions separate:

- *Review completeness:* Required independent coverage completed and no unresolved Act-on finding remains.
- *Acceptance status:* The candidate satisfies required acceptance and project gates, or the named proof remains unavailable or failed.
- *Merge authorization:* The owner or approved execution policy authorizes merge. This skill does not grant it.

Apply the owner's verification policy; required project gates remain binding. Private projects verify locally by default, and remote tests require an owner need. Open-source projects accepting outside contributions use contribution CI behavior checks by default; repository visibility alone does not establish that model. Keep test workflows separate from secure authentication, signing, publishing, deployment, and release execution, without inventing a dependency between them. Arbitrary CI green is not a completion condition.
