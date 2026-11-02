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

- **One repository per run, named by the user.** Resolve and state its absolute path before touching anything; ask only when the target is ambiguous. If the user has said a repository is off limits, don't run anything there, including read-only commands.
- **Never during a wave.** The survey's gates must pass: default branch checked out and clean, no open pull requests, no ticket in progress. Look at each extra git worktree it lists; one with unmerged work means an epic is in flight, so stop. When a gate fails, report it and stop; don't work around it.
- **The two-commit rule holds throughout.** A commit that changes code never changes `prd/`, `architecture/`, or `tech-spec/`, and the reverse. `references/move-map.md` gives the commit order.
{% if harness.id == "codex" or harness.id == "antigravity" %}- **The user decides once, during planning.** Put unsettled judgments in the plan; reuse sourced preferences and existing rulings. After approval, run the phases without further questions unless a material change exceeds that authority. Phase 3 asks only for stage decisions the approved plan leaves unresolved.{% else %}- **The user decides once, in plan mode.** Put unsettled judgments in the plan; reuse sourced preferences and existing rulings. After approval, run the phases without further questions unless a material change exceeds that authority. Phase 3 asks only for stage decisions the approved plan leaves unresolved.{% endif %}
- **Merge within the user's authority.** Finish with review-clean PRs. The user merges, or authorizes you to; reuse that authorization if already given. Keep review completeness, acceptance status, required project gates, and merge permission distinct.
- **Group related work.** Small related phases, stage changes, and patches share one coherent PR by default. Separate commits preserve stage ownership and the code/spec boundary. Split PRs for a meaningful scope, risk, dependency, or owner boundary, not because a phase or stage ended.
- **Commits and PRs.** Branches follow `type/description` (`chore/constitution-upgrade-estimates`, `chore/constitution-upgrade-artifacts`, `docs/constitution-live-verification`). Commit messages and PR bodies are human-written and complete, with body paragraphs on one line each and no AI attribution.

## Step 1: Survey

Run the survey from this skill's directory:

```bash
bun ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/upgrading-constitution-repos/scripts/survey.ts --root <repo>
```

It's read-only. It runs `validate` and `derive`, checks the gates, and lists every legacy artifact with a classification, the patchable entries that name raw artifacts, back-filled estimates, declared recipes, sidecars by surface, and surface globs that still point into `tech-spec/`. Keep its output; you'll compare against it at the end. Add `--json` when you need the data programmatically.

If the verdict is BLOCKED, report the failing gates and stop. If `validate` reports errors, they predate the upgrade: report them and stop, since fixing them is the owning stage's job.

If a prerequisite conversion reports conservation TODOs, inspect each source, destination, and recovery reference. Unsupported substantive records remain unresolved until their owning stage reviews them. Preserve the byte-exact originals in `.constitution-migration-sources-<unique>/` outside `.constitution/` until that review is complete; don't remove recovery sources just because conversion succeeded.

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
4. **Write the phases** (below) with concrete scope, stage ownership, commit order, PR grouping, verification, and the authorized stop boundary. Skip a phase that has nothing to do, and say so. Preserve project verification policy: private work verifies locally by default; remote tests are opt-in, while outside contributions can justify contribution CI. Don't infer that model from repository visibility. Test workflows or actions stay separate from release execution; existing owner gates remain binding.
5. **Settle the remaining choices in one exchange.** Cover unresolved move-map rulings (prose contracts, derived tables, planned shape), pinned and recipe candidates, which phases to run, available models, role fallbacks, and a risk-appropriate independent review panel. Cite already settled choices rather than reasking them. Use the harness's approval flow, record the answers and their sources in the plan, and execute from it. Do not introduce a model vendor as a prerequisite.

Carry a compact handoff between stage passes and resumes: role and mode, effective authority and its source, repository and revision, approved delta, preference and ruling pointers, communication channel, current group, next gate, stop boundary, artifact paths, and native task handles. Restore that state and rerun only invalidated readiness checks. Distinguish queued, delivered, and applied instructions where the harness exposes those states. A task amendment doesn't grant host permissions.

## Step 3: Run the phases

Create the branch or branches chosen in the plan from the default branch. Run related phases on the same branch and open their coherent PR together. Review each PR with `pr-review-fix-loop`, in `documents` mode for a constitution-only PR and `full` mode otherwise. Require a successful `validate` for each commit's validation inputs; reuse an unchanged result. Reuse other verification by revision, relevant inputs, environment, and coverage. Stop the affected work and report if a commit would introduce an unexpected new error; owning stages repair upstream decisions through the authorized route.

### Phase 1: Estimates (only when the survey lists back-filled estimates)

Run `migrate --repair-estimates --root <repo>`. It marks the listed epics `estimate_source: backfilled` in place and prints them. Add a patch entry to `tasks/changelog.yaml` saying the estimates were marked so calibration excludes them. Commit, and confirm `validate` shows no TSK-015 and that the `INFO-CAL` line now counts only planned estimates.

### Phase 2: Artifacts into the code

Work group by group, following `references/move-map.md`: a code commit, a Stage 3 tech-spec constitution commit, and a Stage 4 patch commit. The owning stage performs its approved bounded delta without repeating settled design. Keep its commit separate while using the same PR.

For a substantial independent code group, assign a worker on the plan's available model through native delegation or a chosen adapter. Give it the revision, move-map entries, exact readers, constraints, expected outcome, focused checks, and the instruction not to touch `.constitution/` or delegate further. The assigned worker completes routine formatting, types, and focused behavior checks. Handle tiny mechanical groups directly. Prefer public-interface behavior evidence and existing coverage over isolated unit tests or a test quota. Express meaning in names, types, structure, and invariants; ordinary comments are rare, with TSDoc-style API contracts and licenses exempt. Inspect recorded verification and run only missing or invalidated checks.

After the last group:

- Run `render`, and check that the waves didn't change in a way the plan didn't expect. New `scope.paths` can make two epics overlap.
- Run `derive`. If it reports DRV-001 or DRV-002 drift, run `derive --write` and commit that as its own constitution commit.
- Confirm that `validate` shows no TS-008 or TSK-017 for the groups you moved, and no new errors.

At the planned PR boundary, the body lists the executed move map, every ruling applied, and before and after warning counts. Don't open another PR merely because this phase ended.

### Phase 3: Live verification and pinned contracts (Stage 3 Evolution pass)

Run `specifying-technical-implementation` in Evolution mode, decisions pass, with the recipe and pinned candidates from the plan as its delta. Stage 3 owns these decisions. Pass through the approved rulings and continuation authority; ask only for unresolved stage decisions. Use the planned branch and PR grouping.

- Each recipe that runs today is `exists: true`. A recipe the project can't run yet is `exists: false` and needs an owning ticket. Check existing owners and outstanding obligations first. Run `planning-engineering-execution` for any needed Stage 4 patch in its own commit, normally in the same coherent PR.
- Declare recipes only. Don't add `live_probe` to existing tickets: a ticket gains a probe when Stage 4 next plans it, and only when its tests can't exercise the surface faithfully.
- Mark the confirmed shared shapes `pinned: true`, with their entities and fields in the companion markdown.
- Keep the Stage 3 and Stage 4 commits distinct; the complete PR receives the review mode appropriate to its full diff.

## Step 4: Report

Re-run the read-only survey for comparison and report to the user. Identify the upgrade's own branch and PR as expected execution state; don't claim the initial readiness gates still pass while that work is open.

- the pull requests, phases grouped in each, and their review outcome
- the before and after counts for TS-008, TSK-017, and TSK-015
- recipes declared and their `exists` state
- contracts pinned
- every ruling applied
- unresolved conservation TODOs and the retained recovery-source location, when conversion required them
- anything skipped, with the reason
- the next authorized action and stop boundary: merge any split PRs in dependency order, then Stage 4 can cite the recipes when it next plans tickets whose tests can't exercise a surface, and the next wave's step 0 can rely on the pinned contracts

Merge only within existing user authorization, using the agreed merge skill and dependency order. Otherwise stop with the reviewable result and the permission still needed.

## Resources

- `scripts/survey.ts`: the read-only survey; run before planning and again at the end.
- `references/move-map.md`: where each kind of legacy artifact goes, what to sweep with it, and the commit order.
