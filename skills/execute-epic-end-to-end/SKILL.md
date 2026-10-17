---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
  upstream: {{ metadata.upstream | yaml_str }}
---

# Execute epic end to end

Read `references/framework-overview.md` before you start. It defines the write-authority table, the two-commit rule, certainty, autonomous execution, and the epic graph this skill enforces. The CLI is `bun run ~/.{{ harness.id }}/skills/constitution-tooling/scripts/cli.ts <command> --root .`.

Resolve implementation decisions during planning, then execute the approved plan through its `autonomy` policy without routine approval pauses. Keep the user informed with concise progress updates. Apply the shared overview's efficient-execution rules throughout.

## 1. Invocation modes

Identify who invoked you before reading anything else. It decides who plans, who you report to, and who merges and reconciles.

| | Standalone | Orchestrated |
| :--- | :--- | :--- |
| Invoked by | The user, in a session | `execute-wave`, as a {% if harness.id == "claude" %}background session started in your worktree{% else %}subagent{% endif %}, with a plan file path |
| Plan file | {% if harness.id == "claude" %}You write it in Step 0, in plan mode, with `planned_by: self`; the user approves it once{% elif harness.id == "codex" %}You write it in Step 0 at the project path or `.codex/plans/`, with `planned_by: self`; the user approves it once{% else %}You design it in Step 0, in plan mode, with `planned_by: self`; the user approves it once; you write the repo file after exit{% endif %} | The wave lead wrote it; it is authority and you never replan |
| Worktree and branch | You create them per the concurrency block, after approval | Given in the plan file |
| Models, review panel, budget | The plan file's blocks, which you proposed and the user approved | The plan file's blocks, exactly |
| Blockers, open decisions, drift | The plan's `autonomy` policy; you own the plan's amendments | The plan's `autonomy` policy; `escalate_wave_lead` stops you until the wave lead's message |
| PR review loop | `pr-review-fix-loop` with the plan's `review_panel` and `pr_review` | The same |
| Merge and reconcile | You merge once review-clean and green, then run `reconcile --epic` and `derive --write` on the default branch (two commits), unless the step-0 rulings leave the merge to the user | Never; the wave lead merges and reconciles once per wave |
| Sibling lanes | None | Named in the plan file; §8 applies |

A dispatch that names a plan file is orchestrated mode. Anything else is standalone. The plan file's contract is `references/epic-plan.md`; read it before the epic file.

In orchestrated mode, send the wave lead a blocked report when the policy requires escalation and an Epic report when finished. Use the confirmed recipient or agent handle from dispatch. Use completion notifications and owned command handles while work runs; do not start duplicate workers or runtime jobs to obtain status.

{% if harness.id == "claude" %}Background-session replies do not report to the wave lead; use `SendMessage` to its latest confirmed identity from dispatch or an identity amendment. If delivery fails, refresh the identity and retry once. If it still fails, write the report to `<worktree>/.claude/scratch/undelivered-wave-report.md` and remain blocked until delivery is confirmed; remove that scratch report only after confirmation. Use background completion events or `Monitor` on the owned command's exit marker when waiting.{% elif harness.id == "grok" %}Use `get_command_or_subagent_output` on the recorded command or subagent handle. A completion notification resumes pending work; an interim turn is not an Epic report.{% endif %}

## 2. Roles

The agent running this skill is the **epic lead**. The lead plans or adopts the plan, dispatches, verifies, commits, and records. The lead does not write product code.

| Role | Runs as | Writes | Never writes |
| :--- | :--- | :--- | :--- |
| Epic lead | The session, or a {% if harness.id == "claude" %}background session{% else %}subagent{% endif %} dispatched by `execute-wave` | The plan file and its amendments when standalone; milestone commits; its own epic file (ticket status, deviations, decisions, closeout); `evidence/` manifests | Any other file under `.constitution/`; product code; a plan file the wave lead wrote |
| Worker | A fresh subagent per milestone | Code, tests, configuration, fixtures, contract and data-model artifacts at their `artifact_path`, non-constitution docs | Anything under `.constitution/` except a spike file for a Spike ticket |
| Spec-patch worker | A fresh subagent per coherent spec-patch milestone | Only the `tech-spec/` files named in its drift report | Code; any other constitution directory |
| Planning worker | A fresh subagent running `planning-engineering-execution` in issue mode | One out-of-band epic file and the tasks changelog entry | Anything else |
| Reviewer | A fresh subagent per committed milestone running `reviewing-milestone-commits` | Nothing | Everything |
| Fix worker | A fresh subagent per coherent batch of accepted findings, in the milestone gate and PR review loop | Code, tests, configuration | Anything under `.constitution/` except the epic's own file when a finding is about it |

### Command hygiene

Pass these rules to every worker and reviewer: remove only owned scratch or runtime paths after checking their location; use a literal path or a quoted, nonempty variable such as `rm -f -- "${SCRATCH:?}"/*`; keep removal commands inspectable at the top level instead of hiding them inside a shell wrapper; and do not dump stack credentials into files or logs. A nonempty variable alone does not establish that a path is safe to remove.

{% if harness.id == "claude" %}In background sessions under auto permission mode, an unattended prompt can time out as a denial. Keep cleanup commands directly inspectable by the permission checker and avoid credential dumps that can make later directory reads require approval. These rules apply to the leaf roles you dispatch too.

{% endif %}### Models, runtimes, and budget

Every dispatched role runs on a named runtime and model from the plan file. {% if harness.id == "claude" %}The runtime is Claude through the Agent tool, or Codex or pi through the `codex-subagent` or `pi-subagent` skill's one-off subagent form.{% elif harness.id == "codex" %}Codex roles use `collaboration.spawn_agent` with `fork_turns: "none"`, an explicit available model, and reasoning effort; pi roles use the `pi-subagent` skill's one-off form.{% else %}Runtime `grok` is a `spawn_subagent`: do not pass a subagent type (an omitted type is general-purpose), pass `model` from the plan, and put read-only versus edit permission in the child prompt. Runtime `codex` or `pi` goes through the `codex-subagent` or `pi-subagent` skill's one-off form.{% endif %} Runtimes are chosen for the leaf roles only: workers, spec-patch workers, reviewers, and fix workers. The epic lead runs on whatever spawned it and never changes runtime mid-epic. {% if harness.id == "codex" %}Never let a dispatch fall through to a harness default.{% else %}Always pass the model explicitly on every dispatch; never let a dispatch fall through to a harness default.{% endif %}{% if harness.id == "grok" %} Under `execute-wave`, `[subagents].max_depth` must be at least 2 so this lead can spawn workers. The default allows that nesting. If a spawn reports depth exceeded, stop and say so.{% endif %}

Track usage from the subagent completion reports as you go. When it reaches the plan's `budget.threshold_pct` of the ceiling the user described, switch the leaf roles named in `budget.fallback_models` to those models, record it as an amendment (standalone) or in your report (orchestrated), and continue. Use an approved role fallback for an unavailable model as well as budget pressure; record the reason. Do not repeatedly dispatch a model that cannot start. If no authorized fallback can run, report the service blocker and continue independent work without weakening review or acceptance requirements.

### The two-commit rule

A commit that changes code never changes `prd/`, `architecture/`, or `tech-spec/`. A commit that changes those never changes code. The epic's own file, a spike file, and evidence files are bookkeeping and may ride in a code commit. Everything else under `.constitution/` waits for reconcile. Contract and data-model artifacts live in the code at their sidecar's `artifact_path`, so changing one is a code commit.

### Drift reports

A worker that cannot satisfy its milestone without deviating from a `tech-spec/` record, a pinned contract, or an architecture record finishes what it can and returns:

```markdown
## Drift
- **Ticket:** TICKET_ID
- **Spec file:** the exact .constitution/ path and record the code cannot follow
- **Written:** what the spec says
- **Needed:** what the implementation needs instead, and why
- **Tier (worker's guess):** physical | logical | unknown
```

Changing an artifact in the code inside the milestone's scope is not drift; it is the work. The lead classifies every drift report and acts per Step 6.

## 3. Work source and inputs

**Epic mode (default).** The source of truth is an active epic file `tasks/epics/EPIC-<ID>-<slug>.yaml`. When several are active and the user named none, take the first epic of the lowest rendered wave.

**Issue mode.** When the user references a GitHub issue by number or URL, do this inside Step 0: confirm `gh auth status`, fetch the issue with `gh issue view <n> --comments`, and classify it.

- **Fast lane.** The fix stays in code; touches no published surface a sidecar points at, no `pinned` contract, and no boundary; and sits inside one active epic's owned paths or in paths no active epic owns. Plan it as a single milestone in a plan file with `kind: fast_lane`, `epic: ISSUE-<n>`, and `epic_file: none`, with the commit trailers from §6a. No epic file, no planning worker.
- **Out-of-band epic.** Anything else. Dispatch a planning worker that runs `planning-engineering-execution` in issue mode to produce one `out_of_band` epic with `source: github#<n>`, and run `render`. If it reports a conflict with the running wave, ask the user in Step 0 whether the epic waits, and record the answer under the plan's Step-0 rulings.{% if harness.id != "codex" %} The planning worker and `render` write files, so run them in Step 0's preparation, before entering plan mode.{% endif %}
- **No constitution.** When no `.constitution/` exists, there is nothing to plan against: plan the issue's milestones in a plan file with `kind: no_constitution`, run them with milestone reviews, keep notes in the PR, and skip every constitution step.

Always gather:

- the plan file first: milestones, models, review panel, autonomy policy, budget, liveness, Step-0 rulings, sibling lanes, and the repository state it was planned against
- the epic file: header, tickets with their modes, evidence, recipes, flows, certainty, and scope; the patchable tech-spec files
- `tasks/critical-path.md` for the ticket order inside the epic and the concurrency mechanics from `constitution.yaml`
- `tech-spec/` for guidelines, verification commands, live-verification recipes, ADRs, and the sidecars with their `artifact_path` and `pinned` flags
- `architecture/flows/` for the flows the tickets name, and `prd/glossary.yaml`
- `reports/open-decisions.yaml`; a ticket whose `certainty` is `open` goes through the `open_decision` policy, and no worker may answer an open entry on its own
- the project's own agent instructions in the worktree, for runtime rules the constitution does not carry: shared services, locks, ports, mandatory manual verification. Pass the relevant ones verbatim to every worker.

## 4. Blockers and the autonomy policy

When the work cannot proceed as written (the spec is missing something, a decision is open, an upstream record contradicts the code), don't stop to ask. Look up the trigger in the plan's `autonomy.policy` and take its action; `references/epic-plan.md` defines each action.

The default for `blocker` and `open_decision` is `adopt_recommendation`:

1. Write the question into the epic file's `decisions` list in the register's shape: question, what it blocks, at least two options with pros and cons, your recommendation, a closure path, status `proposed`. Set `interim` to the recommendation and list every place it was applied (paths, ticket ids).
2. Continue as if the recommendation were ruled. Later milestones in this epic read the entry there.
3. Reconcile appends an unresolved entry to the register as `proposed`, and the user rules after the merge. An already approved ruling is carried with its reference, date, summary, and ruler; reconciliation closes the matching id and question in place. It deduplicates identical closed rulings and routes conflicts without changing the register's ruling.

An interim assumption has hard limits. It never writes `prd/`, `architecture/`, or `tech-spec/`; it never touches paths outside the epic's scope or a sibling's; it never takes an irreversible action (force-pushing a shared branch, deleting data, messaging anyone outside the run). A blocker that needs any of those takes `defer_tickets`: defer the affected tickets with `deferred_to` and the reason, and continue with the rest. Record which upstream stage owns the fix:

| Symptom | Owning stage for the routed item |
| --- | --- |
| Acceptance evidence not implementation-ready for its mode, or ticket order wrong | `planning-engineering-execution` |
| Ticket requires an undefined contract family, a missing sidecar, a missing verification command or recipe | `specifying-technical-implementation` |
| Required change would alter a boundary, communication style, or trust boundary | `designing-solution-architecture` |
| Requested outcome changes product scope, priority, or business intent | `defining-product-requirements` |

When the action is `escalate_wave_lead` (orchestrated only), {% if harness.id == "claude" %}send this report to the wave lead with `SendMessage` and end your turn; its message resumes you.{% else %}stop with this report as your reply, and wait for the wave lead's message.{% endif %} Re-read the plan file's Amendments section before continuing.

```markdown
## Blocked
- **Trigger:** [blocker | open_decision | plan_drift | spec_drift | test_failure | review_nonconvergence | rebase_conflict | stall]
- **Blocked by:** [missing information, stale spec, open decision, or contradictory requirements]
- **Owning stage:** [tasks | tech-spec | architecture | prd | open decision OD-NN]
- **Missing or flawed source:** [file, record id, or issue field]
- **Recommendation:** [the option you'd adopt, and why]
- **Milestones still executable meanwhile:** [ids, or none]
```

## 5. Acceptance modes

The ticket's mode decides what the worker produces first and what counts as proof. Gherkin is one mode among nine.

| Mode | Worker produces first | Proof the lead requires before committing |
| :--- | :--- | :--- |
| `gherkin` | Failing tests, one per scenario | The tests pass and the verification command exits successfully |
| `contract_test` | Failing assertions against the artifact the sidecar's `artifact_path` names | The assertions pass against that artifact |
| `benchmark` | The harness and the threshold from the cited meter, run once for a baseline | A run meeting the threshold, recorded in `evidence/<ticket>/` with its manifest |
| `stat_threshold` | The evaluation command over the named split | A run meeting the threshold, recorded in `evidence/<ticket>/` |
| `invariant` | The invariant as a checker, property test, fuzz target, or proof | The checker runs clean for the stated corpus or budget |
| `hitl_sil` | The procedure document and pass/fail log criteria | A procedure log meeting the criteria in `evidence/<ticket>/`, or `result: owed` with the hardware step named in a closeout follow-up for the user after the run |
| `visual_regression` | The baseline reference and the diff threshold | A diff run under the threshold, baseline in `evidence/<ticket>/` |
| `runbook_probe` | The apply, plan, and probe commands and the expected end state | Probe output matching the end state, recorded in `evidence/<ticket>/` |
| `live_probe` | The behavior, then nothing extra: the recipe already exists in guidelines | The tests pass at the milestone. Once per epic, after the last milestone and before the closeout (Step 7, item 1), the lead runs the recipe named in `recipe` (launch, doctor, drive the ticket's scenario, capture the evidence, cleanup), and the evidence shows the expected state, recorded in `evidence/<ticket>/` |

Rules:

- Automated tests are required deliverables for every behavior-bearing ticket in any mode. `live_probe` adds proof on top of them; it never replaces them.
- Use test-first development whenever the mode's first deliverable is a failing test, checker, or harness.
- Test public interfaces, not private implementation details.
- Evidence exists to show what the tests can't, so capture it once and keep it small. It goes under `evidence/<ticket>/` with a `manifest.yaml` (schema `evidence-manifest.schema.json`) the lead writes: owner, mode, producing command, the commit it was verified at, `result`, pass criteria, and the files that show the expected state. A probe's manifest has `mode: live_probe`, whichever mode is primary. When `live_probe` is supplementary to a mode that writes its own evidence, the probe's evidence goes under `evidence/<ticket>-live/` with the same owner, so neither capture overwrites the other. When one probe session drives several tickets, write one manifest: `owner` is the first ticket and `covers` lists the others. That manifest has one `result`. When one covered ticket fails or can't be met, split its evidence into its own manifest, so only that ticket is affected. Every file of a `benchmark`, `stat_threshold`, or `visual_regression` manifest, and any `baseline` or `measurement` file, carries a sha256, because a later run compares against it; other files need no digest. The verified-at commit is a historical fact: later commits and rebases don't make it stale, and nobody re-pins it.
- Retain only what shows the expected state: the response, screenshot, log line, or file the recipe's `evidence` names, plus a short summary. Don't retain whole build or server logs or every intermediate screenshot, and strip ANSI escapes from retained text.
- Record the result as it is, never as the convenient one:
  - `pass`: the run showed the expected state.
  - `fail`: the run happened and showed the wrong state. That is a defect: fix it under the `test_failure` policy, never relabel it.
  - `not_met`: the scenario can't reach the state the evidence body names, as specified, on this system. Defer the ticket and route the gap.
  - `owed`: the run couldn't happen for an environment reason only. Either the recipe's `doctor` failed after one retry, or a step needs hardware the plan file names as unavailable. The tests are then the only proof, never a pass.
- A ticket whose evidence is `fail` or `not_met` is not `done`. A ticket whose evidence is `owed` stays `done` only when a closeout `follow_ups` entry names its id and the owed check. `validate` reports all three as TSK-018.
- **Spike tickets** produce no code. The worker writes `spikes/SPK-<ACRONYM>-<EPIC><NNN>.md` from the Stage 4 template, budgeted by the ticket's points. Review it as a document-only milestone. When the spike closes a register entry, the lead records the recommendation in the epic's `decisions` list for reconcile to carry to the register; when it requires a spec change, it goes through the `blocker` policy.
- **Temporary log check:** every temporary print or debugging helper carries `[DEBUG-<Ticket>]`. The milestone cannot be committed while any line containing `[DEBUG-` remains in the staged diff.

## 6. Workflow

{% if harness.id == "claude" %}### Step 0: Plan in plan mode (standalone)

This is the approval point for execution decisions; progress updates remain allowed. Plan mode lets you write only the one plan file the harness names, so Step 0 has three parts: prepare before plan mode (anything that writes files), decide in plan mode, and materialise after approval.

**Before plan mode.** In issue mode, classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Nothing here asks the user anything.

**In plan mode.**

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository at the default branch's current commit to separate completed, partial, and missing work. Delegate substantial independent exploration when it saves work; bounded inspection can stay with the planner.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, a review-sizing guide rather than a reason to fragment one coherent repair.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`, as the content of the harness's plan-mode file. Propose models per role, the risk-appropriate review panel on available approved models, the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`, and run `check-plan` on the plan-mode file itself; both must be clean before you present, so the user approves a plan that already passes.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings and amend the plan, then exit plan mode for approval.

**After approval.**

7. Write the approved plan to its plan-file path (`.claude/plans/<epic>.md` by default) unchanged, and run `check-plan` on it once more to confirm the copy.
8. Create the worktree and branch per the concurrency block in `constitution.yaml`. From here on, ask nothing.
{% elif harness.id == "codex" %}### Step 0: Plan (standalone)

This is the point where the user approves the execution plan. In issue mode, first classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Write the plan file at the project path or `.codex/plans/<epic>.md`; Codex does not require a special plan-mode file or a mode switch for this step.

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository at the default branch's current commit. Delegate substantial independent exploration when it saves work; keep bounded reads with the planner.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, a review-sizing guide rather than a reason to fragment one coherent repair.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`. Propose models per role, the risk-appropriate review panel on available approved models, the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`, and run `check-plan` on the plan file itself; both must be clean before you present, so the user approves a plan that already passes.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings, amend the plan, and run `check-plan` again.
7. After approval, create the worktree and branch per the concurrency block in `constitution.yaml`.
{% else %}### Step 0: Plan in plan mode (standalone)

This is the approval point for execution decisions; progress updates remain allowed. If the plan is already approved, skip plan mode and materialise. Otherwise call `enter_plan_mode`. While it is active the only writable file is the session `plan.md` under `~/.grok/sessions/...`. It cannot hold the repo plan file, and `check-plan` does not run against it. Step 0 has three parts: prepare before plan mode (anything that writes repository files), decide in plan mode, and materialise after exit.

**Before plan mode.** In issue mode, classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Nothing here asks the user anything.

**In plan mode.**

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository at the default branch's current commit. Delegate substantial independent exploration when it saves work, with read-only permissions; keep bounded reads with the planner.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, a review-sizing guide rather than a reason to fragment one coherent repair.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`, into the session plan file. Propose models per role, the risk-appropriate review panel on available approved models, the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`. `check-plan` waits until the repo plan file exists, which is after exit.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings and amend the session plan, then call `exit_plan_mode` for approval.

**After approval.**

7. Write the approved plan to its plan-file path (`.grok/plans/<epic>.md` by default) unchanged, and run `check-plan` on it. Fix mechanical errors in that file without a new question. If a fix would change an approved ruling, stop and say so.
8. Create the worktree and branch per the concurrency block in `constitution.yaml`. From here on, ask nothing.
{% endif %}

In orchestrated mode there is no Step 0 for you: the wave lead did it.

Use one isolated PR reviewer for bounded low-risk changes and two for broad or high-risk changes, unless the user specifies otherwise. Name approved fallbacks for reviewer availability as well as implementation roles. Resolve operational readiness and verification ownership in the plan before dispatch.

### Step 1: Adopt the plan

1. Read the plan file. Its milestones, their order, their ticket grouping, and their verification are authority. Do not regroup, reorder, merge, or split them outside an amendment.
2. Verify the plan's `repository_state` assertions for the first milestone against the worktree at its current commit, and run `validate`. Repeat this check for each later milestone before dispatching its worker, since earlier milestones change the tree.
3. When an assertion fails, or a milestone cannot be executed as written, that is the `plan_drift` trigger. Standalone, the default is `amend_plan`: append the smallest amendment that lets execution continue, run `check-plan`, and continue. Orchestrated, the default is `escalate_wave_lead`: return this report and wait. Milestones the drift does not touch may continue if the plan marks them independent.

```markdown
## Plan drift
- **Milestone:** the plan's milestone id
- **Plan says:** the assertion or instruction that does not hold
- **Repository shows:** what is actually there, with paths and the commit inspected
- **Effect:** which milestones cannot proceed as written
- **Proposed amendment:** the smallest change to the plan that would let execution continue
- **Milestones still executable meanwhile:** ids, or none
```

### Step 2: Dispatch a worker per milestone

Spawn one fresh worker {% if harness.id == "grok" %}with `spawn_subagent` when the runtime is `grok` (otherwise the named runtime's one-off form), with no parent context, on the model named for workers. The prompt says whether the worker may edit files. Give it exactly:{% else %}with no parent context, on the runtime and model named for workers, and give it exactly:{% endif %} the ticket records verbatim, the in-scope and out-of-scope paths, the tech-spec records, sidecars, and flow it must follow, the verification command, the mode rules above, the debug tag, the project runtime rules the plan or the project instructions mark as verbatim, any approach constraints the plan file states for the milestone, and these instructions verbatim: "Do not create, edit, or delete any file under `.constitution/`. Do not commit. Do not launch subagents of your own. If the spec cannot be followed, finish what you can and return a drift report. In your summary, list every new dependency, pattern, convention, or contract shape you introduced that the spec did not already name."

The worker implements the complete milestone, resolves routine formatting and type findings in that assignment, and runs its focused verification. It returns the command, source identity, exit status, relevant environment, outcome, files touched, code decisions, and drift reports. Do not dispatch separate agents to run each check or make individual mechanical corrections. A worker with no commit-worthy change and no report for `liveness.stall_after_minutes` goes through the `stall` policy: one fresh worker on the same milestone, then `defer_tickets`.

### Step 3: Verify and commit

1. **Verification.** Inspect the worker's recorded result and require the mode's proof. Reuse it when the candidate, relevant environment, and coverage match. Run only missing or invalidated checks; execute the planned final gate set once after implementation freezes. Honor any stricter project commit gate. Use project-defined scheduling and chunking for shared runtime resources; do not impose harness-specific time limits.
2. **Live probe.** Don't capture `live_probe` evidence here; it is captured once, after the last milestone (Step 7, item 1). You may run a recipe as a development check when the milestone's risk is in the running system; write no evidence and no manifest for it.
3. **Temporary log check.** `git diff | grep '\[DEBUG-'` returns nothing.
4. **Write-authority check.** `git status` shows no path under `.constitution/` other than the epic file, a spike file, or `evidence/`. Revert any other constitution change and treat its content as a drift report.
5. **Scope deviation.** For any touched file outside the ticket's in-scope paths, add a `deviations` entry to the ticket with files and justification.
6. **Published surfaces.** A change to an artifact a sidecar points at with a published surface kind (an HTTP API, events, a CLI, a library, an SDK) must fit the compatibility ADR. A breaking change it doesn't allow goes through the `blocker` policy.
7. **Enforcement check.** A change to any contract, schema, lock, golden file, fixture corpus, or generated artifact names the existing check that pins the old value and includes the change to that check.
8. **Cross-record reconciliation.** Grep for any restated value you changed (counts, digests, versions, conventions) across the epic's outputs and reconcile every copy.
9. **Freeze last.** Digest-bound content is finalized only after review.
10. **Evidence.** For `benchmark`, `stat_threshold`, `hitl_sil`, `visual_regression`, and `runbook_probe`, whose proof is the run itself, write the `evidence/<ticket>/manifest.yaml` once, at the milestone that completes the ticket. Re-run it only when a later change alters the measured behavior. Apply `references/evidence-preservation.md` when the milestone cites external sources.
11. **Code decisions.** Add each dependency, pattern, convention, or contract shape the worker introduced without a Stage 3 record to the closeout draft's `code_decisions`, with its paths and the commit.
12. **Status and settling.** Set the ticket's `status` to `done`, except a ticket with `live_probe`, which stays `in_progress` until its probe runs (Step 7, item 1). When the tests exercised a sidecar, boundary, or capability that was assumed, note the record and the test path; it goes into the closeout's `settled` list.
13. Require a successful `validate` for the current validation inputs; rerun when constitution or repository inputs it checks changed. Commit only when it reports no errors. Name the ticket ids in the subject and the mode's proof in the body. Note the SHA.

### Step 4: Review gate

After every commit and before the next milestone, spawn one isolated reviewer {% if harness.id == "grok" %}with `spawn_subagent` when the runtime is `grok` (otherwise the named runtime's one-off form), with no parent context, on the model named for milestone reviewers. The prompt says the reviewer must not create, edit, or delete files. It runs `/reviewing-milestone-commits`, and you pass only:{% else %}with no parent context, on the runtime and model named for milestone reviewers, running `/reviewing-milestone-commits`, passing only:{% endif %} the commit SHA, the plan file path, the epic file path and ticket ids, the acceptance mode, evidence, and recipe, the verification command, and for a spec-patch milestone the drift report; for a fast-lane milestone, the lane claim. Tell it not to launch subagents of its own. Use an isolated reviewer context. Prefer a different approved model or runtime when available; using the same runtime does not require another provider.

Treat valid `P0` and `P1` findings as blockers: group accepted findings by shared cause and owned scope, dispatch one fresh fix worker per coherent batch, verify per Step 3, commit, and review the changed diff and its interactions. `P2` and lower are fixed when cheap, otherwise recorded in the closeout's follow-ups. A finding that keeps coming back after two fixes goes through the `review_nonconvergence` policy.

### Step 5: Discovered decisions

When a milestone surfaces a question nobody may answer silently, it is the `open_decision` trigger: apply the policy per §4. A ruling the wave lead sends within its delegated authority replaces the interim; record it in the entry with `status: closed`, the ruler, and the ruling's reference, date, summary, and chosen option when applicable. Revisit the places the interim was applied and proceed. Carry a ruling already approved in Step 0 the same way. Reconciliation applies this recorded approval; it never invents a ruling.

### Step 6: Handle drift

| Tier | Meaning | Action |
| :--- | :--- | :--- |
| Physical | A Stage 3 detail in a file the epic declared patchable: a guideline, a verification command, a stack pin, an ADR detail, a sidecar field | The `spec_drift` policy; by default group related physical drift reports into one spec-patch milestone and dispatch a fresh spec-patch worker with that batch. It edits only those files and touches nothing else. Commit it as its own milestone, run `validate`, review it as a spec-patch milestone. Record it in the closeout's `spec_patches`. |
| Logical | A boundary, communication style, trust boundary, scope, priority, a `pinned` contract, or a file the epic did not declare | The `blocker` policy per §4. |
| Unknown | The lead cannot tell | Treat as logical. |

Two commits, two reviews, whichever order the drift is discovered in. A plan file that anticipated a physical patch does not exempt it from its own commit and review.

### Step 6a: The fast lane

A fast-lane milestone is one worker, one commit or a few, and the review gate, like any milestone, with no epic file to update. Every commit carries these trailers, which `reconcile` reads:

```
Constitution-Lane: fast
Settles: <path relative to .constitution/>[#<record id>]   (e.g. prd/capabilities.yaml#CAP-002 or tech-spec/contracts/orders.meta.yaml; repeat per record, only when the change settles one)
Evidence: <repository path of the test that settles it>
```

When the worker or the reviewer finds that the change reaches past the lane (a published surface, a pinned contract, a boundary, another epic's paths), stop widening the change. Keep what fits the lane, open the PR with it, and record the rest in your report as an item for an out-of-band epic, planned in the next step-0 session.

The trailers must reach the default branch. A `Settles:` trailer without an `Evidence:` trailer that names a test settles nothing; reconcile routes it. Merge a fast-lane PR with `merge-pr-rebase-delete` when the concurrency block allows rebase merges; otherwise pass `merge-pr-squash-delete` a squash commit body that ends with the trailer block.

### Step 7: Close out

1. **Final verification, live probes, then status.** Freeze the implementation and complete the planned final gates not already proven for the same inputs. On the head after the last milestone, run every `live_probe` ticket's recipe once, sharing one session when several tickets drive the same surface. Capture the evidence per §5, run `validate`, and commit it. The evidence commit skips the Step 4 gate; the PR review loop reviews it with the code. A probe that ends `fail` goes through the plan's `test_failure` entry. Each fix worker follows Step 3, its commit passes the Step 4 gate, and the probe re-runs after it, with its evidence committed the same way as the first capture. This is not a new milestone and needs no amendment. When the entry falls through to `defer_tickets`, defer the ticket. Set each probed ticket's status from its result per §5: `pass` or a recorded `owed` makes it `done`, and `not_met` or an unfixed `fail` makes it `deferred` with `deferred_to` and the route. Then every ticket is `done`, or `deferred` with `deferred_to` set.
2. Write the `closeout` block, schema in `epic.schema.json`: tickets completed and deferred, points completed, spec patches with commits, changelog entries by directory, candidate glossary terms, items routed upstream, follow-ups, `code_decisions`, and the `settled` list with repository evidence. Leave `actuals` absent; reconcile computes it from git. A fast-lane run has no closeout; its trailers carry the same facts.
3. Run `validate`, then commit the epic file alone.
4. Open the pull request with `commit-push-open-pr` against the base branch the plan file or the concurrency block names, passing the title, body, base, and ready status explicitly. The body is comprehensive: what changed and why, the milestones and their review outcomes, deviations, spec patches, interim assumptions adopted and where, code decisions, live-probe results, and validation performed.
5. Run the PR review loop with `pr-review-fix-loop`, passing the plan's `review_panel` and `pr_review` blocks so the loop never asks. Its stop condition is one verification round with no new Act-on finding; it has no cap, and at `review_escalate_at` it changes strategy instead of stopping. Fix workers follow Step 3 for every commit the loop pushes. Reuse final-gate results from item 1 for unchanged inputs; a review fix reruns the affected checks, not the entire gate set by default. Live-probe evidence was captured in item 1. A loop fix that changes behavior a probe's scenario asserts re-runs that probe:
   - Commit the fix's code first, then re-run the probe.
   - `pass`: commit the new evidence with no code, so the next verification round sees it.
   - `fail`: go through the plan's `test_failure` entry as in item 1 before committing any evidence, and keep the failing manifest out of every fix commit; commit the evidence once the probe passes.
   - `owed`: commit the evidence together with a closeout `follow_ups` entry naming the ticket and the owed check, with no code.
   - `not_met`, or a `fail` the entry leaves unfixed: commit the evidence, the ticket's deferral with `deferred_to` and the route as in item 1, and the matching closeout update together, with no code.
   - This keeps every commit valid: `validate` never sees a `done` ticket with failing evidence, or a closeout that disagrees with ticket status.
   - Any other fix leaves the evidence at its verified-at commit, which is not a defect. A fix that changes probed behavior never goes in the loop's final `P2` batch; it lands in a normal round, so a verification round sees its evidence.
6. Do not archive, render, or touch any changelog.
   - Standalone: once the loop is clean and CI passes on the head, retain the verification evidence and finish any lane teardown the project's instructions require before merging. Stop owned services, confirm their recorded child processes have exited, and remove only the scratch and local state those instructions authorize. Run teardown after the last required verification, so a later gate does not inherit a destroyed runtime. Branch deletion can remove a linked worktree. Complete every operation that needs the lane's files before invoking it. Then merge with the merge skill the concurrency block names, unless the Step-0 rulings leave the merge to the user. Then, on the default branch, run `reconcile --epic <id>`, which commits its own result, and after it `derive --write`, committing what derive changed as a second constitution-only commit. Run them in that order: reconcile refuses to run on a dirty tree.
   - Orchestrated: never merge and never run `reconcile`; the wave lead does both once for the wave.
7. Report. In standalone mode, report to the user in prose: the PR, the merge, the interim assumptions that now need a ruling, the code decisions routed to Stage 3, deferred tickets, and follow-ups. In orchestrated mode, {% if harness.id == "claude" %}send exactly this to the wave lead with `SendMessage`, as your final report; remove any saved scratch copy only after confirmed delivery:{% else %}return exactly this as your final reply:{% endif %}

```markdown
## Epic report
- **Epic:** EPIC-<ID>
- **PR:** number, URL, final head SHA at the end of the review loop, including any evidence commits; the wave lead computes the patch id from it
- **Review loop:** rounds run, strategy changes, Act-on findings fixed, findings dismissed with their reasons
- **Tickets:** done ids; deferred ids with `deferred_to` and reason
- **Spec patches:** commits, files
- **Interim assumptions:** each `decisions` entry adopted, and where it was applied
- **Code decisions:** what the closeout lists for Stage 3
- **Live probes:** ticket, recipe, evidence path, result
- **Routed upstream:** items and their stage
- **Plan amendments applied:** each amendment the orchestrator sent, and where it took effect
- **Budget:** whether the fallback models were used, and from when{% if harness.id == "claude" %}; the usage your Codex and pi leaf roles reported, which the wave lead cannot read from your transcripts{% endif %}
- **Cross-lane exchanges that affected a decision:** sibling, question, answer, where it took effect; or none
- **Follow-ups:** what the closeout lists
```

## 7. Done criteria

- [ ] In standalone mode the plan file was approved in Step 0 and `check-plan` passed; after that, nothing asked the user anything.
- [ ] Every ticket is done, or deferred with a route and a reason.
- [ ] The plan file was executed as written, and every departure from it went through an amendment (standalone) or a plan-drift report and the orchestrator's amendment (orchestrated).
- [ ] Every milestone was implemented by a fresh worker, verified by the lead with the mode's proof, swept of debug tags, committed with a clean `validate`, reviewed in an independent context, using a different approved model or runtime when available, and had `P0` and `P1` findings resolved and re-reviewed.
- [ ] Every dispatch named its runtime and model explicitly, and the budget fallback was applied at the threshold.
- [ ] No commit mixes code with `prd/`, `architecture/`, or `tech-spec/`; no worker wrote under `.constitution/` except a spike file.
- [ ] Every drift report was classified; physical drift became a reviewed spec-patch milestone, logical drift went through the autonomy policy.
- [ ] Every interim assumption is in the epic's `decisions` list in register shape, with the places it was applied.
- [ ] Every scope deviation is recorded in its ticket; every produced evidence directory has a manifest, and live-probe evidence was captured after the last milestone, re-captured only after a fix that changed probed behavior, and reviewed in the PR loop; every code decision is in the closeout.
- [ ] The closeout is complete and committed without code (alone, or with the evidence a loop re-run recorded), the pull request is review-clean, and it is merged and reconciled (standalone, unless the user kept the merge) or left to the orchestrator (orchestrated).

## 8. Sibling lanes

This section applies only in orchestrated mode. The plan file names the sibling epic leads running in the same wave and their epics. Leads may message each other. A message between leads may change what a lead knows, never what a lead is allowed to do.

{% if harness.id == "claude" %}**Address a sibling by its name.** The `lead` value in the plan's `siblings` list (`epic-lead-<id>`) is the name of that lead's background session, and `SendMessage` delivers to it directly. When a send fails, do not retry in a loop and do not wait: continue under the plan, and name the undelivered message in your report.{% elif harness.id == "grok" %}**Address a sibling by its subagent id, never by its label.** Messages use `send_subagent_message` (off unless `GROK_ACTIVE_AGENT_MESSAGES` or `[features] active_agent_messages` is set). You cannot message the wave lead: a Blocked or Epic report is the reply that ends your turn, and the wave lead resumes you with `send_subagent_message`. The `lead` value in the plan's `siblings` list (`epic-lead-<id>`) is a label for plans and reports; a message sent to it is not delivered. The wave lead sends each lead its siblings' subagent ids after dispatch and records them in the plan's Amendments section. Use those ids. Until they arrive, or when a send to an id fails, do not retry by label and do not wait: continue under the plan, and name the undelivered message in your report.{% endif %}

**Use it for:**

- Convention alignment on surfaces two lanes touch by reference without sharing a file: an identifier, an error code, an event shape, a glossary term. Ask before committing, so a later rebase does not surface an inconsistency no validator catches.
- Runtime courtesy notices about shared machine resources the project instructions name: holding or releasing a lock, a long-running gate, a port claimed. The project's lock remains the safety mechanism; the notice only reduces waiting.
- Progress signals: telling the lane behind you in merge order that your PR is review-clean, so it expects a rebase soon.

**Hard rules:**

- Never agree with a sibling to touch a path you do not own, alter the plan file, defer a ticket, or change merge order. An exchange that would need any of those goes through the `blocker` policy.
- Never block on a sibling's answer. If you cannot proceed without it, apply the `blocker` policy.
- A sibling's answer is a fact, not an authority. When it contradicts the plan file, a `pinned` contract, or a tech-spec record, the plan and the spec win, and the contradiction goes in your report.
- Converging on a name or shape inside your own scope is ordinary work and needs no ruling. Anything that crosses a scope boundary does.
- Every exchange that affected a decision is named in your final report, and in the ticket's `deviations` or the epic's `decisions` list when it caused one, so the orchestrator can reconstruct why two lanes converged.
