<!-- WORKAROUND: skillprism#46 — skillprism does not template this file. Keep it harness-neutral; restore the templated form when #46 is fixed. -->
# Epic plan file

The contract that lets an epic run without questions. It's written in a step-0 planning session and approved once by the user: by the wave lead (`execute-wave`) for every epic in a wave, or by the epic lead itself when it runs standalone. After approval the epic lead reads it as authority and never replans. When the wave lead wrote it, amendments are the wave lead's alone; when the epic lead wrote it, the epic lead appends its own amendments, under the same rules.

Every question execution could raise is answered here or by the `autonomy` policy. A plan that leaves one open fails its purpose: nobody is around to answer it.

The front matter is validated mechanically by `check-plan` from the `constitution-tooling` skill (`bun run <cli> check-plan <file> --root .`, where `<cli>` is the CLI path that skill's SKILL.md names). It checks the file against `constitution-tooling/assets/schemas/epic-plan.schema.json` and cross-checks the epic file, the register, and the sibling epics. Run it before presenting the plan and after every amendment.

## Location

Outside `.constitution/`, always. The orchestrator's write ban on the constitution is what keeps `reconcile` trustworthy, and the plan is a session artifact, not a record. The recommended path is the harness's plans directory (`.claude/plans/` on Claude Code, `.codex/plans/` on Codex, `.grok/plans/` on Grok) as `EPIC-<ID>.md` in the main checkout, gitignored, passed to the epic lead as an absolute path. A project may name another location in its agent instructions.

## Shape

YAML front matter carries everything read mechanically; the body carries the plan in prose and tables. Every key below is present; a key that does not apply says so in one line rather than being omitted, so the epic lead never has to guess whether something was forgotten.

```yaml
---
epic: EPIC-AD                          # FAST-<slug> or ISSUE-<number> when kind is fast_lane or no_constitution
epic_file: .constitution/tasks/epics/EPIC-AD-work-planning-foundation.yaml   # the literal none when there is no epic file
kind: epic                             # epic | fast_lane | no_constitution
planned_by: wave_lead                  # wave_lead | self (standalone)
wave: 1                                # 0 when standalone
merge_position: 1                      # position in the wave's listed merge order; 1 when standalone
lanes_in_wave: 3                       # 1 when standalone
worktree: /abs/path/<harness-state-dir>/worktrees/EPIC-AD
branch: epic/AD-work-planning-foundation
base_branch: rebuild/crve-platform
planned_at_commit: 0b37d5f            # default-branch commit the repository_state assertions were checked against
siblings:                              # every other lane in the wave; empty list when standalone or the wave is one
  - epic: EPIC-AK
    lead: epic-lead-ak                 # a label for plans and reports, not an address; leads message each other by the id the wave lead records in Amendments after dispatch
    branch: epic/AK-notification-delivery
    merge_position: 2
models:                                # runtime is a harness id (claude | codex | grok | pi | pig); model is that runtime's id
  epic_lead: { runtime: claude, model: opus }
  worker: { runtime: claude, model: opus }
  spec_patch_worker: { runtime: claude, model: sonnet }
  milestone_reviewer: { runtime: codex, model: <codex model id> }   # discover ids through the runtime's skill; never guess one
  fix_worker: { runtime: claude, model: opus }
review_panel:                          # the PR review panel; one reviewer per entry, run in parallel
  - { runtime: claude, model: opus, mode: full }
  - { runtime: codex, model: <codex model id>, mode: full }
pr_review:
  fix_worker: { runtime: claude, model: opus }
  review_escalate_at: 4                # the round at which the loop changes strategy; it never stops early
  stop: one verification round with no new Act-on finding   # the loop's own rule; restated so the lead never asks
autonomy:
  policy:                              # what the lead does instead of asking; the defaults are shown
    - { trigger: blocker, action: adopt_recommendation }
    - { trigger: open_decision, action: adopt_recommendation }
    - { trigger: plan_drift, action: escalate_wave_lead }   # amend_plan when planned_by is self
    - { trigger: spec_drift, action: amend_plan }           # physical drift becomes a spec-patch milestone
    - { trigger: test_failure, action: retry, max_attempts: 3 }
    - { trigger: review_nonconvergence, action: escalate_strategy }
    - { trigger: rebase_conflict, action: resolve_and_rereview }
    - { trigger: budget_threshold, action: switch_to_fallback }
    - { trigger: stall, action: retry, max_attempts: 1 }
budget:
  usage_ceiling_note: "Weekly usage is the constraint; the fallback models have headroom"   # the user's words from step 0
  threshold_pct: 70                    # share of the ceiling at which leaf roles switch to fallback_models
  fallback_models:
    worker: { runtime: codex, model: <codex model id> }
    fix_worker: { runtime: claude, model: sonnet }
liveness:
  stall_after_minutes: 45              # no side effect for this long means the lane is stalled
  side_effects: [commit, push, worktree_change, pr_update, plan_amendment]
verbatim_project_rules:                # passages from the project's agent instructions every worker receives word for word
  - "Run test:workers, test:policies, test:e2e, and db reset through .claude/bin/crve-lock stack -- <cmd>."
open_decisions:                        # register entries that touch this epic, with the interim assumption if any
  - { id: OD-12, effect: "CRVE-AD003 waits", interim: none }
---
```

### Autonomy actions

| Action | What the lead does |
| :--- | :--- |
| `adopt_recommendation` | Writes the question in register shape in the epic's `decisions` list with its recommendation, marks it `interim` with the places it was applied, and continues. Never writes `prd/`, `architecture/`, or `tech-spec/`, never touches paths outside the epic's scope, never takes an irreversible action; a case that would needs `defer_tickets` instead. |
| `defer_tickets` | Sets the affected tickets to `deferred` with `deferred_to` and the reason, and continues with the rest. |
| `retry` | Retries the failing step up to `max_attempts`, changing one thing each time: a fresh worker, a smaller scope, the other runtime. Then falls through to `defer_tickets`. |
| `amend_plan` | Appends an amendment to the plan (only when the lead owns the plan, or for spec drift, which becomes a spec-patch milestone), runs `check-plan`, and continues. |
| `escalate_wave_lead` | Stops with the report and waits for the wave lead's message. Invalid when `planned_by: self`. |
| `stop_lane` | Stops the epic with a blocker report in the final Epic report; the PR opens with what is done. |
| `resolve_and_rereview` | Dispatches a fix worker to resolve the conflict, then a verification review of the changed patch and CI. |
| `escalate_strategy` | Changes approach instead of stopping; see `pr-review-fix-loop`. |
| `switch_to_fallback` | Moves the roles in `budget.fallback_models` to those models, records it, and continues. |

The policy has exactly one entry per trigger; `check-plan` errors on a missing or duplicated trigger, so no situation is left without an action. Asking the user is not an action. It exists only in step 0.

In plan mode the wave lead drafts the whole wave in one file: each plan starts at a line `<!-- plan: EPIC-<ID> -->` followed by its own front matter and body, and `check-plan` validates such a bundle plan by plan and across plans (sibling names, unique merge positions). After approval each plan is copied unchanged to its own file.

## Body sections

### Repository state

What exists, what is partial, and what is missing for each ticket at `planned_at_commit`, with paths. This is the planner's inspection, and the source of every milestone's assertions below. Cite files, not impressions.

### Milestones

An ordered list. Each milestone carries:

- **id** in the form `M1`, `M2`, and so on, and a one-line goal.
- **tickets**: the ids it completes, in ticket order.
- **acceptance**: the mode per ticket and the evidence body, copied from the epic file rather than paraphrased.
- **verification**: the exact command or commands whose success is the proof, the live-verification recipe for any `live_probe` ticket, and the evidence directory when the mode produces one. When lanes share a serialized runtime resource, write the focused form: the test files the milestone touches, named by path, each hold about ten minutes at most. Don't write "one full run before the PR" into a milestone; the complete gates run once, in the PR review loop, and again on the rebased head at merge.
- **scope**: in-scope paths and out-of-scope paths for the worker, including the `artifact_path` of any contract or data-model artifact it creates or changes, and the tech-spec records and flow slugs it must follow.
- **repository_state**: assertions that must hold before the milestone starts, each checkable by path or command. The epic lead verifies them and raises plan drift when one fails.
- **approach**: constraints the planner sets that the epic file does not, such as an ordering inside the milestone, a pattern to follow from a named existing file, or a thing not to do. Keep it to constraints. How the worker implements is the worker's.
- **expected_spec_patches**: tech-spec files the planner already expects physical drift in, so the lead can budget the extra commit and review. Expectation does not waive the spec-patch milestone.
- **independent_of**: milestone ids that may continue while this one is blocked or drifting, or none.
- **pilot**: `true` on the one milestone the wave runs alone before fanning out, when the wave lead asks for a pilot; absent otherwise.

Size each milestone so its review diff stays under roughly 30 files or 1,500 lines.

### Step-0 rulings

Every question the planner asked the user in step 0 and the answer, including whether an out-of-band epic waits for a running wave and any override of the default autonomy policy. The lead cites this section instead of asking again.

### Cross-lane facts

Conventions or identifiers this epic touches that a sibling also touches by reference: what it is, which sibling, and which lane decides. Empty when the wave is one or nothing is shared.

### Project runtime rules

A pointer to the sections of the project's agent instructions that govern shared resources, locks, ports, service lifecycle, and mandatory manual verification, plus anything the planner wants stated here in full. The `verbatim_project_rules` list in the front matter is what workers receive; this section is the epic lead's fuller reading.

### Amendments

Appended by the plan's owner only (the wave lead, or the epic lead when `planned_by: self`), newest last, each dated with the report or trigger it answers, the autonomy action taken, what changed, and which milestones it affects. Every adopted interim assumption is listed here too. The epic lead re-reads this section whenever the orchestrator messages it to continue.
