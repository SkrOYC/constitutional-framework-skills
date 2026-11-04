---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# PR review fix loop

Use this skill after a PR exists. Independently review the complete candidate, triage findings, repair coherent causes, and verify the changed scope. A completed milestone review covers that milestone's implementation and acceptance. PR review covers integration, cross-milestone assumptions, and the final claims; earlier reviews do not prove the whole PR.

## Configuration and dispatch

Use the caller's approved `review_panel`, `fix_worker`, `review_escalate_at`, fallback, and resource policy. An execution caller supplies these from its plan. For a direct invocation without configuration, use one available independent reviewer and a suitable available fixer. Ask only when a needed choice exceeds the existing authority or resource envelope.

The configuration controls these decisions:

| Setting | Meaning | Default |
| :--- | :--- | :--- |
| `review_panel` | Independent reviewers, each `{runtime, model, mode}` | One verifier for bounded risk. Add reviewers for distinct security, migration, concurrency, or integration risks; line count alone does not require a panel. Use `documents` for constitution-only PRs. |
| `fix_worker` | Runtime and model for coherent repairs | The caller's approved choice, or an available model suited to the repair. |
| `review_escalate_at` | A strategy checkpoint if unresolved findings remain | 4; repeated failure can require a premise check earlier. |

Establish the runtime's schema, capabilities, and approved model/fallback choice once per session. Recheck only after a runtime change or a failed capability assumption.

{% if harness.id == "claude" %}Pass the approved model on every dispatch. A Claude reviewer or fixer uses the Agent tool with an available non-fork type, such as `subagent_type: "general-purpose"`. A `fork` type inherits parent history and is unsuitable for independent review. Check the child type's actual tools; background Agent children can have a reduced tool pool. A Codex or pi reviewer uses the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls. Tell it to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md`; it cannot invoke a Claude skill by name. Discover external model ids through that skill's `models` command. Supply a snapshot when effective permissions do not allow GitHub access.{% elif harness.id == "codex" %}Dispatch Codex reviewers through `collaboration.spawn_agent` with `fork_turns: "none"` and the approved available model and reasoning effort. Full-history forks inherit model and effort and do not accept overrides. A native child inherits the parent's host permissions; a review-only prompt is a role constraint, not a separate sandbox. For a Claude reviewer or fixer, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md); launch a fresh Claude background session with the approved model, effort, permissions, checkout, and stop boundary. Require native SendMessage results to the caller bridge, keeping one blocking receive waiter active alongside sends. Dispatch pi reviewers through `pi-subagent` with its supported read-only controls. Reviewers load their own runtime's rendered reviewing-pull-requests skill: `~/.codex/skills/` for Codex or `~/.claude/skills/` for Claude. Append the bridge reporting contract to external briefs, including a Codex reviewer's brief when its caller is Claude. Use a snapshot when effective permissions do not allow GitHub access.{% elif harness.id == "antigravity" %}An Antigravity reviewer uses `invoke_subagent` with a fresh context and the approved schema-supported model choice. Select a review-only type and controls using the exposed tool schema; do not invent tier names or argument casing. Native children inherit host permissions. Disabling write tools can also remove command execution, so a review-only type might be unable to check source identity or run required investigation. Supply a complete snapshot, use an approved capable runtime when needed, and report incomplete coverage when required checks remain unavailable. A fixer receives only its batch's authority and no delegation authority. For an external model id, use the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls; discover ids through that skill's `models` command. Every reviewer reads `~/.gemini/antigravity-cli/skills/reviewing-pull-requests/SKILL.md`.{% else %}A Grok reviewer uses `spawn_subagent`; do not pass a subagent type. Use the exposed schema and approved model or inheritance policy; do not invent a `model` argument when the runtime does not accept it. The prompt prohibits file changes and further delegation. A Codex or pi reviewer uses the `codex-subagent` or `pi-subagent` skill's one-off form and supported read-only controls. Tell it to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md`; it cannot invoke a Grok skill by name. Discover external model ids through that skill's `models` command. Supply a snapshot when effective permissions do not allow GitHub access.{% endif %}

## Establish the candidate

Resolve the PR from the caller or `gh pr view`. If no PR exists, return that blocker. Capture the repository, PR number, base and head SHAs, merge base, complete changed-file inventory and diff, issue requirements, comments, reviews, and available check status. Use `documents` when every changed path is under `.constitution/`.

Confirm the supplied checkout matches the candidate head and has no tracked changes. Reviewers stay in that checkout; they do not switch branches, create worktrees, or change shared runtime state. Establish effective network access for each runtime. A filesystem read-only policy does not by itself establish network availability.

For offline review, publish a complete immutable snapshot under an ignored worktree scratch directory. Follow both producer and consumer requirements in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/reviewing-pull-requests/references/offline-snapshot.md`. Reuse immutable material only when its source and inputs remain valid; refresh changed metadata and affected diffs. Never edit a snapshot while reviewers use it. Snapshot reuse does not excuse a partial candidate or stale issue requirements.

## Review independently

Dispatch the configured reviewer or reviewers with fresh contexts. Supply only the skill, mode, PR, expected base and head, checkout, optional snapshot, relevant governing policy, and existing verification references. Independent reviewers inspect the assumptions and observations behind that evidence; independence does not require repeating every expensive check.

Use this prompt, replacing the placeholders:{% if harness.id == "codex" %} For Claude recipients, replace the skill path with `~/.claude/skills/reviewing-pull-requests/SKILL.md` and append the bridge reporting contract. A Codex reviewer with a Claude caller receives the bridge reference and caller identity too.{% endif %}

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

When multiple reviewers are justified, dispatch independent reviews in parallel and wait for each required result before triage. Use approved fallbacks for unavailable runtimes. An empty response, access failure, wrong revision, or incomplete review is not clean. Repair the concrete input or runtime problem and retry once when useful. If no approved route completes, report a blocker.

Before accepting a result, confirm the candidate base/head and relevant hosted requirements remain current. Refresh changed context and invalidate only affected judgments or coverage. A base change can alter integration risk even when the head is unchanged.

## Triage findings

Read each finding against the code and governing requirements. Deduplicate shared defects and retain reviewer attribution. Agreement is supporting signal, not proof. Choose one bucket and record a short reason:

- *Act on:* A confirmed `P0` or `P1`, or a real `P2` correctness, user-facing, contract, or acceptance defect. Broken documented commands and handoffs count.
- *Consider:* A valid improvement whose cost or scope exceeds its value for this candidate. Fix it only when authorized and worthwhile; otherwise name its follow-up owner.
- *Noted:* Valid context or historical evidence bookkeeping. An older verified-at SHA is not itself a defect. Missing required proof, a false pass, contradictory observations, failed validation, or a `done` ticket with failed or absent required results belongs in Act on.
- *Dismissed:* Unsupported, incorrect, preference-only, or already resolved by governing policy. Cite the evidence or accepted ruling. A comment can explain intent; it cannot prove safety or dismiss a concrete defect.

Preserve triage, dismissals, candidate identities, and strategy decisions in the existing local run artifact or execution record. Do not create a separate manually synchronized ledger. Publish one cumulative PR update at completion or a material blocker, unless the owner requires per-round comments.

If the initial review is complete and has no Act-on findings, proceed to completion. There is no repair delta to verify.

## Repair coherent causes

Group accepted findings by shared root cause, owned scope, and validation needs. Use one bounded fix assignment per substantive batch; the lead can handle a mechanical correction within its authority. Keep the same worker responsible for routine formatting, typing, and focused verification within that assignment. Do not create workers or commits for each minor nit.

Give the fixer the candidate, accepted findings, relevant paths and constraints, prior failed attempts, and the required evidence. Require these outcomes:

- Re-read the affected code and determine why the defect occurs. Fix the cause within authority; do not hide an impossible state with a guard or retry.
- Express meaning in names, types, structure, and invariants. Ordinary code comments are rare; TSDoc-style API contracts and license headers are exempt. Do not add reassuring comments to satisfy review.
- Reconcile affected contracts, fixtures, generated artifacts, repeated values, and final PR claims. Update a check that pins a changed contract when needed.
- Prefer public-interface behavior checks and useful existing coverage. Add isolated unit tests only for a rare high-value case; there is no test-per-finding quota.
- Complete routine formatting and type fixes, and run the narrowest meaningful checks. Record candidate/input identity, command, exit status, environment, observed outcome, and coverage so results can be reused.
- Do not delegate further or exceed the batch's file, resource, or host-permission authority.

When the caller owns commit discipline, return the repaired changes for that process. Otherwise use the authorized commit and push workflow with descriptive commits. Never make an empty commit. Keep the PR description accurate for the cumulative change.

## Verify the changed scope

After repairs, obtain independent verification of the changed candidate. Supply the prior reviewed SHA as `since`, the exact repair delta, prior Act-on and Dismissed findings, relevant interactions, and reusable evidence. Keep the complete candidate context available. Refresh only invalidated snapshot material and metadata, following the snapshot contract.

One independent verifier is the default for bounded repairs. Add expertise or expand coverage when the repair introduces distinct security, migration, concurrency, compatibility, or integration risk. Changed-file count alone does not require a full panel. The verifier confirms every accepted repair, examines its interactions, and reviews any uncovered effects. Unchanged findings are not reopened unless the new evidence changes their grounds.

Triage new findings and repair further Act-on defects. Stop when required coverage is complete, every prior Act-on finding is resolved, and the independent review finds no new Act-on finding. A second confirming clean round is unnecessary.

Every final behavioral edit requires this scoped independent verification, including edits outside live-probe coverage. Passing runtime checks alone does not replace review. A mechanical correction can reuse applicable checks and be confirmed directly without a new panel. If it changes behavior, safety assumptions, or acceptance claims, treat it as a repair delta.

## Change strategy when repairs fail

After two related failed repairs based on the same premise, state and test that premise before a third patch. Name the expected invariant, the contrary observation, and the cheapest decisive probe or source trace. Change the root-cause approach using that evidence; do not repeat the same patch elsewhere.

At `review_escalate_at`, reassess unresolved causes, coverage, resources, and authority. Choose a useful change: a bounded diagnostic, a different repair approach, an approved fixer or specialist, or broader independent review. Do not cycle through a fixed escalation sequence or add agents without a concrete risk to investigate.

Continue while a supported repair path fits the approved authority and resources. Use the caller's approved fallback or nonconvergence policy when it does not. Return the unresolved defect, evidence, attempts, and next decision as a blocker; never manufacture review-clean status.

## Documents mode

Use the same triage and scoped verification principles for constitution-only PRs. Keep repairs focused on actionable contradictions, stage authority, broken references, and downstream effects. Small related stage changes can share a coherent PR while each stage owns its decisions and code/spec commits remain separate.

If verification reveals another substantive defect, repair and independently verify the affected records, or report it unresolved. Do not declare a document PR clean merely because a round limit was reached. Report mechanically detectable findings as tooling follow-ups without replacing the current repair with a tooling project.

## Complete the loop

Report the final base/head, review scope and completeness, reviewers used, accepted repairs, deferred items and owners, dismissals with reasons, strategy changes, and verification limits. Cite existing results concisely; retain full logs in the run artifacts.

Keep three conclusions separate:

- *Review completeness:* Required independent coverage completed and no unresolved Act-on finding remains.
- *Acceptance status:* The candidate satisfies required acceptance and project gates, or the named proof remains unavailable or failed.
- *Merge authorization:* The owner or approved execution policy authorizes merge. This skill does not grant it.

Apply the owner's verification policy. Private projects verify locally by default; remote tests require an owner need. Open-source projects accepting outside contributions use contribution CI behavior checks by default. Repository visibility alone does not establish that model. Required project gates remain binding. Keep test workflows separate from secure authentication, signing, publishing, deployment, and release execution; do not invent a dependency between them. Arbitrary CI green is not a completion condition.
