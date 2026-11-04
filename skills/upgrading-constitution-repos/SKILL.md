---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  companion: {{ metadata.companion | yaml_str }}
---

# Upgrading constitution repos

Bring one repository's `.constitution/` up to the current framework. A repository that never upgrades still works, with warnings for the legacy layout. Upgrading removes the duplicate contract and schema copies that turn ordinary code changes into spec patches, gives autonomous runs a way to prove behavior on the running system, and fixes the calibration data.

Read `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/specifying-technical-implementation/references/framework-overview.md` first, then the sidecar and live-verification sections of `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/specifying-technical-implementation/SKILL.md`. The CLI is `bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts <command> --root <repo>`.

## Hard rules

- **One repository per run, named by the user.** Resolve and state its absolute path before touching anything; ask only when the target is ambiguous. If the user has said a repository is off limits, don't run anything there, including read-only commands.
- **Never during a wave.** The survey's gates must pass: default branch checked out and clean, no open pull requests, no ticket in progress. Inspect each extra git worktree it lists; one with unmerged work means an epic is in flight. When a gate fails or a worktree shows an epic in flight, report it and stop; don't work around it.
- **The two-commit rule holds throughout.** A commit that changes code never changes `prd/`, `architecture/`, or `tech-spec/`, and the reverse. `references/move-map.md` gives the commit order.
{% if harness.id == "codex" or harness.id == "antigravity" %}- **The user decides once, during planning.** Put unsettled judgments in the plan, reusing sourced preferences and existing rulings. After approval, run the phases without further questions unless a material change exceeds that authority; Phase 3 asks only for stage decisions the approved plan leaves unresolved.{% else %}- **The user decides once, in plan mode.** Put unsettled judgments in the plan, reusing sourced preferences and existing rulings. After approval, run the phases without further questions unless a material change exceeds that authority; Phase 3 asks only for stage decisions the approved plan leaves unresolved.{% endif %}
- **Merge within the user's authority.** Finish with review-clean PRs. The user merges, or authorizes you to; reuse an authorization already given. Review completeness, acceptance status, required project gates, and merge permission stay distinct.
- **Group related work.** Small related phases, stage changes, and patches share one branch and coherent PR by default, with separate commits preserving stage ownership and the code/spec boundary. Split PRs for a meaningful scope, risk, dependency, or owner boundary, not because a phase or stage ended.
- **Commits and PRs.** Branches follow `type/description` (`chore/constitution-upgrade-estimates`, `chore/constitution-upgrade-artifacts`, `docs/constitution-live-verification`). Commit messages and PR bodies are human-written and complete, with body paragraphs on one line each and no AI attribution.

## Step 1: Survey

Run the survey from this skill's directory:

```bash
bun ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/upgrading-constitution-repos/scripts/survey.ts --root <repo>
```

The survey is read-only. It runs `validate` and `derive`, checks the gates, and lists every legacy artifact with a classification, the patchable entries that name raw artifacts, back-filled estimates, declared recipes, sidecars by surface, and surface globs still pointing into `tech-spec/`. Keep its output for the final comparison; add `--json` for the data in machine-readable form.

If the verdict is BLOCKED, report the failing gates and stop. `validate` errors predate the upgrade and are the owning stage's to fix: report them and stop.

If a prerequisite conversion reports conservation TODOs, inspect each source, destination, and recovery reference. Unsupported substantive records stay unresolved until their owning stage reviews them, so preserve the byte-exact originals in `.constitution-migration-sources-<unique>/` outside `.constitution/` until that review completes, even though conversion succeeded.

{% if harness.id == "claude" %}## Step 2: Plan in plan mode

Plan mode lets you write only its one plan file, so do all of this read-only and put the result there.
{% elif harness.id == "codex" %}## Step 2: Plan

Write one plan file under the project's plan path or `.codex/plans/` before asking for approval; Codex needs no plan-mode switch or special plan file. For approved Claude roles during stage alignment or review, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md); record each role's runtime and reporting identity, and keep one blocking receive waiter active alongside sends.
{% elif harness.id == "antigravity" %}## Step 2: Plan

Write one plan file under the project's plan path or `.agents/plans/` before asking for approval.
{% else %}## Step 2: Plan in plan mode

Call `enter_plan_mode`; while it is active, the only writable file is the session `plan.md` under `~/.grok/sessions/...`. Do the repository reads first and put the plan there. Skip plan mode if the upgrade plan is already approved.{% endif %}

1. **Build the move map.** For every legacy artifact, apply `references/move-map.md` and record: the artifact, its survey kind, the target `artifact_path`, the readers to repoint, the companion decision, and whether it needs the user's ruling, grouping entries by directory. For `same-name-differs` entries, inspect bounded diffs directly or batch substantial independent comparisons into read-only exploration assignments on available approved models; each assignment distinguishes a code copy that is ahead from planned shape the code lacks. Check their summaries against the files for any entry you'll ask about. Also grep the repository, `guidelines.md` commands and recipes, CI, and scripts for tech-spec paths the survey couldn't see, such as placeholders.
2. **Find pinned-contract candidates.** Shapes two or more active epics depend on: the same sidecar in several epics' flows, identifiers or events named across epics. List them for phase 3; don't mark anything yet.
3. **Find recipe candidates.** Each surface a user or client touches (from the sidecars' surface kinds and the archetype), how it launches locally today, and what could drive it: an existing e2e harness, a CLI, HTTP, a browser controller. List them for phase 3.
4. **Write the phases** (below) with concrete scope, stage ownership, commit order, PR grouping, verification, and the authorized stop boundary. Skip, and say so, any phase with nothing to do. Preserve project verification policy: private work verifies locally by default with remote tests opt-in, outside contributions can justify contribution CI, and repository visibility doesn't establish that model. Test workflows or actions stay separate from release execution; existing owner gates remain binding.
5. **Settle the remaining choices in one exchange.** Cover unresolved move-map rulings (prose contracts, derived tables, planned shape), pinned and recipe candidates, which phases to run, available models, role fallbacks, and a risk-appropriate independent review panel. Cite already settled choices rather than reasking them. Use the harness's approval flow, record the answers and their sources in the plan, and execute from it. Don't introduce a model vendor as a prerequisite.

Carry a compact handoff between stage passes and resumes: role and mode, effective authority and its source, repository and revision, approved delta, preference and ruling pointers, communication channel, current group, next gate, stop boundary, artifact paths, and native task handles. On resume, restore that state and rerun only invalidated readiness checks. Distinguish queued, delivered, and applied instructions where the harness exposes those states. A task amendment doesn't grant host permissions.

## Step 3: Run the phases

Create the branch or branches chosen in the plan from the default branch. Review each PR with `pr-review-fix-loop`, choosing the mode from its complete diff: `documents` for a constitution-only PR, `full` otherwise. Require a successful `validate` for each commit's validation inputs, reusing an unchanged result, and reuse other verification by revision, relevant inputs, environment, and coverage, running only missing or invalidated checks. If a commit would introduce an unexpected new error, stop the affected work and report; owning stages repair upstream decisions through the authorized route.

### Phase 1: Estimates (only when the survey lists back-filled estimates)

Run `migrate --repair-estimates --root <repo>`. It marks the listed epics `estimate_source: backfilled` in place and prints them. Add a patch entry to `tasks/changelog.yaml` saying the estimates were marked so calibration excludes them. Commit, and confirm `validate` shows no TSK-015 and that the `INFO-CAL` line counts only planned estimates.

### Phase 2: Artifacts into the code

Work group by group, following `references/move-map.md`: a code commit, a Stage 3 tech-spec constitution commit, and a Stage 4 patch commit. The owning stage performs its approved bounded delta without repeating settled design.

Handle tiny mechanical groups directly. For a substantial independent code group, assign a worker on the plan's available model through native delegation or a chosen adapter, giving it the revision, move-map entries, exact readers, constraints, expected outcome, focused checks, and the instruction not to touch `.constitution/` or delegate further; the worker completes routine formatting, types, and focused behavior checks. Prefer public-interface behavior evidence and existing coverage over isolated unit tests or a test quota. Express meaning in names, types, structure, and invariants; ordinary comments are rare, with TSDoc-style API contracts and licenses exempt.

After the last group:

- Run `render` and check that the waves didn't change in a way the plan didn't expect; new `scope.paths` can make two epics overlap.
- Run `derive`. If it reports DRV-001 or DRV-002 drift, run `derive --write` and commit that as its own constitution commit.
- Confirm that `validate` shows no TS-008 or TSK-017 for the groups you moved, and no new errors.

At the planned PR boundary, the PR body lists the executed move map, every ruling applied, and before and after warning counts.

### Phase 3: Live verification and pinned contracts (Stage 3 Evolution pass)

Run `specifying-technical-implementation` in Evolution mode, decisions pass, with the recipe and pinned candidates from the plan as its delta. Stage 3 owns these decisions; pass it the approved rulings and continuation authority.

- A recipe that runs today is `exists: true`. One the project can't run yet is `exists: false` and needs an owning ticket: check existing owners and outstanding obligations first, then run `planning-engineering-execution` for any needed Stage 4 patch in its own commit.
- Declare recipes only. Don't add `live_probe` to existing tickets: a ticket gains a probe when Stage 4 next plans it, and only when its tests can't exercise the surface faithfully.
- Mark the confirmed shared shapes `pinned: true`, with their entities and fields in the companion markdown.

## Step 4: Report

Re-run the read-only survey for comparison, identifying the upgrade's own branch and PR as expected execution state rather than claiming the initial readiness gates still pass while that work is open. Report to the user:

- the pull requests, phases grouped in each, and their review outcome
- the before and after counts for TS-008, TSK-017, and TSK-015
- recipes declared and their `exists` state
- contracts pinned
- every ruling applied
- unresolved conservation TODOs and the retained recovery-source location, when conversion required them
- anything skipped, with the reason
- the next authorized action and stop boundary: merge any split PRs in dependency order, then Stage 4 can cite the recipes when it next plans tickets whose tests can't exercise a surface, and the next wave's step 0 can rely on the pinned contracts

When merging is already authorized, use the agreed merge skill in dependency order; otherwise stop with the reviewable result and the permission still needed.

## Resources

- `scripts/survey.ts`: the read-only survey; run before planning and again at the end.
- `references/move-map.md`: where each kind of legacy artifact goes, what to sweep with it, and the commit order.
