---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  companion: {{ metadata.companion | yaml_str }}
---

# Upgrading constitution repos

Bring one repository's `.constitution/` up to the current framework. Nothing breaks if a repository never upgrades: the old layout only produces warnings. The upgrade is worth doing because it removes the duplicate copies of contracts and schemas that turn ordinary code changes into spec patches, gives autonomous runs a way to prove behavior on the running system, and fixes the calibration data.

Read `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/specifying-technical-implementation/references/framework-overview.md` first, then the sidecar and live-verification sections of `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/specifying-technical-implementation/SKILL.md`. The CLI is `bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts <command> --root <repo>`.

## Hard rules

- **One repository per run, named by the user.** Confirm the absolute path before touching anything. If the user has said a repository is off limits, don't run anything there, including read-only commands.
- **Never during a wave.** The survey's gates must pass: default branch checked out and clean, no open pull requests, no ticket in progress. Look at each extra git worktree it lists; one with unmerged work means an epic is in flight, so stop. When a gate fails, report it and stop; don't work around it.
- **The two-commit rule holds throughout.** A commit that changes code never changes `prd/`, `architecture/`, or `tech-spec/`, and the reverse. `references/move-map.md` gives the commit order.
{% if harness.id == "codex" or harness.id == "antigravity" %}- **The user decides once, during planning.** Everything that needs their judgment goes into the plan; after approval, run the phases without further questions, except in phase 3, which is an interactive stage pass by design.{% else %}- **The user decides once, in plan mode.** Everything that needs their judgment goes into the plan; after approval, run the phases without further questions, except in phase 3, which is an interactive stage pass by design.{% endif %}
- **Nothing is merged without the user.** Each phase ends at a review-clean pull request. The user merges, or tells you to.
- **Commits and PRs.** Branches follow `type/description` (`chore/constitution-upgrade-estimates`, `chore/constitution-upgrade-artifacts`, `docs/constitution-live-verification`). Commit messages and PR bodies are human-written and complete, with body paragraphs on one line each and no AI attribution.

## Step 1: Survey

Run the survey from this skill's directory:

```bash
bun ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/upgrading-constitution-repos/scripts/survey.ts --root <repo>
```

It's read-only. It runs `validate` and `derive`, checks the gates, and lists every legacy artifact with a classification, the patchable entries that name raw artifacts, back-filled estimates, declared recipes, sidecars by surface, and surface globs that still point into `tech-spec/`. Keep its output; you'll compare against it at the end. Add `--json` when you need the data programmatically.

If the verdict is BLOCKED, report the failing gates and stop. If `validate` reports errors, they predate the upgrade: report them and stop, since fixing them is the owning stage's job.

{% if harness.id == "claude" %}## Step 2: Plan in plan mode

Plan mode lets you write only its one plan file, so do all of this read-only and put the result there.
{% elif harness.id == "codex" %}## Step 2: Plan

Write one plan file under the project's plan path or `.codex/plans/` before asking for approval. Codex does not require a special plan-mode file or mode switch.
{% elif harness.id == "antigravity" %}## Step 2: Plan

Write one plan file under the project's plan path or `.agents/plans/` before asking for approval.
{% else %}## Step 2: Plan in plan mode

Call `enter_plan_mode`. While it is active the only writable file is the session `plan.md` under `~/.grok/sessions/...`. Do the repository reads first, and put the plan there. If the upgrade plan is already approved, skip plan mode.{% endif %}

1. **Build the move map.** For every legacy artifact, apply `references/move-map.md` and record: the artifact, its survey kind, the target `artifact_path`, the readers to repoint, the companion decision, and whether it needs the user's ruling. Group entries by directory. For `same-name-differs` entries, inspect bounded diffs directly or batch substantial independent comparisons into read-only exploration assignments on available approved models. Each assignment distinguishes an ahead code copy from planned shape the code lacks. Check their summaries against the files for any entry you'll ask about. Also grep the repository, `guidelines.md` commands and recipes, CI, and scripts for tech-spec paths the survey couldn't see, such as placeholders.
2. **Find pinned-contract candidates.** Shapes two or more active epics depend on: the same sidecar in several epics' flows, identifiers or events named across epics. List them for phase 3; don't mark anything yet.
3. **Find recipe candidates.** Each surface a user or client touches (from the sidecars' surface kinds and the archetype), how it launches locally today, and what could drive it: an existing e2e harness, a CLI, HTTP, a browser controller. List them for phase 3.
4. **Write the phases** (below) with the concrete scope of each for this repository. Skip a phase that has nothing to do, and say so.
5. **Ask everything in one exchange.** The move-map rulings (prose contracts, derived tables, planned shape), the pinned and recipe candidates you want the user to confirm or add to, which phases to run now, and the available models, role fallbacks, and risk-appropriate independent review panel. Use the harness's approval flow, record the answers in the approved plan, and execute from it. Do not introduce a particular model vendor as a prerequisite.

## Step 3: Run the phases

Each phase runs on its own branch from the default branch, ends in its own pull request, and is reviewed with `pr-review-fix-loop`, in `documents` mode for a constitution-only PR and `full` mode otherwise. Require a successful `validate` for each commit's validation inputs; reuse an unchanged result. Stop the phase and report if a commit would introduce a new error that isn't one the plan expected.

### Phase 1: Estimates (only when the survey lists back-filled estimates)

Branch `chore/constitution-upgrade-estimates`. Run `migrate --repair-estimates --root <repo>`. It marks the listed epics `estimate_source: backfilled` in place and prints them. Add a patch entry to `tasks/changelog.yaml` saying the estimates were marked so calibration excludes them. Commit, and confirm `validate` shows no TSK-015 and that the `INFO-CAL` line now counts only planned estimates.

### Phase 2: Artifacts into the code

Branch `chore/constitution-upgrade-artifacts`. Work group by group, following the commit order in `references/move-map.md`: a code commit, a tech-spec constitution commit, and a Stage 4 patch commit. Assign one complete group to a worker on the plan's available model, using the harness's native delegation tool or a chosen adapter. Give it the move-map entries, readers to repoint, focused checks, and the instruction not to touch `.constitution/`. Inspect its recorded build, test, or generator results; run only missing or invalidated checks. Write the two constitution commits yourself.

After the last group:

- Run `render`, and check that the waves didn't change in a way the plan didn't expect. New `scope.paths` can make two epics overlap.
- Run `derive`. If it reports DRV-001 or DRV-002 drift, run `derive --write` and commit that as its own constitution commit.
- Confirm that `validate` shows no TS-008 or TSK-017 for the groups you moved, and no new errors.

Open the PR. The body lists the move map as executed, every ruling it applied, and the before and after warning counts.

### Phase 3: Live verification and pinned contracts (Stage 3 Evolution pass)

This phase is a stage pass, so it is interactive: run the `specifying-technical-implementation` skill in Evolution mode, decisions pass, on branch `docs/constitution-live-verification`, with the recipe and pinned candidates from the plan as the delta.

- Each recipe that runs today is `exists: true`. A recipe the project can't run yet is `exists: false` and needs an owning ticket, which Stage 4 adds as a patch (for example a ticket in the next tooling or foundation epic). Run `planning-engineering-execution` for that patch in its own commit and PR, reviewed in documents mode.
- Declare recipes only. Don't add `live_probe` to existing tickets: a ticket gains a probe when Stage 4 next plans it, and only when its tests can't exercise the surface faithfully.
- Mark the confirmed shared shapes `pinned: true`, with their entities and fields in the companion markdown.
- Stage 3 ends with its own PR, reviewed in `documents` mode.

## Step 4: Report

Re-run the survey and report to the user:

- the pull requests per phase and their review outcome
- the before and after counts for TS-008, TSK-017, and TSK-015
- recipes declared and their `exists` state
- contracts pinned
- every ruling applied
- anything skipped, with the reason
- what the user needs to do next: merge the PRs in phase order, then Stage 4 can cite the recipes when it next plans tickets whose tests can't exercise a surface, and the next wave's step 0 can rely on the pinned contracts

Don't merge unless the user says to; when they do, merge in phase order with the merge skill the concurrency block names.

## Resources

- `scripts/survey.ts`: the read-only survey; run before planning and again at the end.
- `references/move-map.md`: where each kind of legacy artifact goes, what to sweep with it, and the commit order.
