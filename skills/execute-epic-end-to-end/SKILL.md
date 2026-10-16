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

Execution runs dark. The user makes every decision in step 0 and isn't around again until the pull request is merged. After step 0, nothing in this skill asks the user anything: a question either has an answer in the plan file, or the plan's `autonomy` policy says what to do instead.

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

{% if harness.id == "claude" %}**Orchestrated, you own the epic end to end.** You run as a background session whose working directory is your worktree, so the workers and reviewers you spawn start there too. Nobody reads your replies: you reach the wave lead only with `SendMessage`, addressed to the wave lead's name in your dispatch prompt, and you send it exactly two kinds of message: a `## Blocked` report when the policy's action is `escalate_wave_lead` or a hard blocker no policy entry can route, and the final `## Epic report`. Before sending either report, resolve the wave lead's current name through `ListAgents` and `claude agents --json --all`, matching the wave-lead session id in your dispatch or its latest identity amendment. Use only a unique match; never infer the recipient from a similar name or working directory. If a send fails, refresh the mapping and retry once. If the identity cannot be resolved or delivery still fails, save the report at `<worktree>/.claude/scratch/undelivered-wave-report.md` and remain blocked until the wave lead supplies a confirmed identity. Remove a saved scratch report only after its message is confirmed delivered. Never send progress, interim status, or "waiting for the worker". The wave lead reads your liveness from commits, pushes, the worktree, and your session state, never from your prose. Ending a turn reports nothing, so wait for workers, reviewers, and gates however is cheapest: a background subagent finishing, a background command exiting, and an incoming message each start your next turn. To wait inside a turn, use the `Monitor` tool with an until-loop on an exit marker the job writes itself (`until grep -q '^exit=' <log>`), such as its output file appearing or `crve-lock status` releasing, never on `pgrep -f <pattern>`: the watcher's own command line contains the pattern, so the loop never ends. Foreground `sleep` is blocked.{% elif harness.id == "grok" %}**Orchestrated, you own the epic end to end.** Every reply you end a turn with reaches the wave lead as a report, so you have exactly two kinds of reply: a `## Blocked` report when the policy's action is `escalate_wave_lead` or a hard blocker no policy entry can route, and the final `## Epic report`. Never end a turn with progress, interim status, or "waiting for the worker". The wave lead reads your liveness from commits, pushes, and the worktree, never from your prose. While a worker, reviewer, or gate runs, stay in this turn. Dispatch it with `spawn_subagent` and `background: true`, then wait with `get_command_or_subagent_output` (`timeout_ms` waits, clamped to 1 hour). A shell job starts with `run_terminal_command` and `background: true`. For a streaming exit marker, use the `monitor` tool. Wait on an exit marker the job writes itself, never on `pgrep -f <pattern>`: the watcher's own command line contains the pattern, so the loop never ends. Do not use `setsid`, `nohup`, `disown`, or a sleep poll as the wait. Don't end the turn to wait. A turn you end is a report upward. If a wait returns while the child is still running, end the turn with no summary; completion wakes you, and the wave lead treats that as interim, not as a Blocked or Epic report.{% endif %}

## 2. Roles

The agent running this skill is the **epic lead**. The lead plans or adopts the plan, dispatches, verifies, commits, and records. The lead does not write product code.

| Role | Runs as | Writes | Never writes |
| :--- | :--- | :--- | :--- |
| Epic lead | The session, or a {% if harness.id == "claude" %}background session{% else %}subagent{% endif %} dispatched by `execute-wave` | The plan file and its amendments when standalone; milestone commits; its own epic file (ticket status, deviations, decisions, closeout); `evidence/` manifests | Any other file under `.constitution/`; product code; a plan file the wave lead wrote |
| Worker | A fresh subagent per milestone | Code, tests, configuration, fixtures, contract and data-model artifacts at their `artifact_path`, non-constitution docs | Anything under `.constitution/` except a spike file for a Spike ticket |
| Spec-patch worker | A fresh subagent per drift report | Only the `tech-spec/` files named in its drift report | Code; any other constitution directory |
| Planning worker | A fresh subagent running `planning-engineering-execution` in issue mode | One out-of-band epic file and the tasks changelog entry | Anything else |
| Reviewer | A fresh subagent per committed milestone running `reviewing-milestone-commits` | Nothing | Everything |
| Fix worker | A fresh subagent per accepted review finding, in the milestone gate and in the PR review loop | Code, tests, configuration | Anything under `.constitution/` except the epic's own file when a finding is about it |

### Command hygiene

Pass these rules to every worker and reviewer: remove only owned scratch or runtime paths after checking their location; use a literal path or a quoted, nonempty variable such as `rm -f -- "${SCRATCH:?}"/*`; keep removal commands inspectable at the top level instead of hiding them inside a shell wrapper; and do not dump stack credentials into files or logs. A nonempty variable alone does not establish that a path is safe to remove.

{% if harness.id == "claude" %}In background sessions under auto permission mode, an unattended prompt can time out as a denial. Keep cleanup commands directly inspectable by the permission checker and avoid credential dumps that can make later directory reads require approval. These rules apply to the leaf roles you dispatch too.

{% endif %}### Models, runtimes, and budget

Every dispatched role runs on a named runtime and model from the plan file. {% if harness.id == "claude" %}The runtime is Claude through the Agent tool, or Codex or pi through the `codex-subagent` or `pi-subagent` skill's one-off subagent form.{% elif harness.id == "codex" %}Codex roles use `collaboration.spawn_agent` with `fork_turns: "none"`, an explicit available model, and reasoning effort; pi roles use the `pi-subagent` skill's one-off form.{% else %}Runtime `grok` is a `spawn_subagent`: do not pass a subagent type (an omitted type is general-purpose), pass `model` from the plan, and put read-only versus edit permission in the child prompt. Runtime `codex` or `pi` goes through the `codex-subagent` or `pi-subagent` skill's one-off form.{% endif %} Runtimes are chosen for the leaf roles only: workers, spec-patch workers, reviewers, and fix workers. The epic lead runs on whatever spawned it and never changes runtime mid-epic. {% if harness.id == "codex" %}Never let a dispatch fall through to a harness default.{% else %}Always pass the model explicitly on every dispatch; never let a dispatch fall through to a harness default.{% endif %}{% if harness.id == "grok" %} Under `execute-wave`, `[subagents].max_depth` must be at least 2 so this lead can spawn workers. The default allows that nesting. If a spawn reports depth exceeded, stop and say so.{% endif %}

Track usage from the subagent completion reports as you go. When it reaches the plan's `budget.threshold_pct` of the ceiling the user described, switch the leaf roles named in `budget.fallback_models` to those models, record it as an amendment (standalone) or in your report (orchestrated), and continue. Running low on budget changes models; it never stops the epic.

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
| `hitl_sil` | The procedure document and pass/fail log criteria | A procedure log meeting the criteria in `evidence/<ticket>/`, or a deferral recorded in the closeout for the user after the run |
| `visual_regression` | The baseline reference and the diff threshold | A diff run under the threshold, baseline in `evidence/<ticket>/` |
| `runbook_probe` | The apply, plan, and probe commands and the expected end state | Probe output matching the end state, recorded in `evidence/<ticket>/` |
| `live_probe` | The behavior, then nothing extra: the recipe already exists in guidelines | The tests pass at the milestone. Once per epic, at the review-clean head (Step 7), the lead runs the recipe named in `recipe` (launch, doctor, drive the ticket's scenario, capture the evidence, cleanup), and the evidence shows the expected state, recorded in `evidence/<ticket>/` |

Rules:

- Automated tests are required deliverables for every behavior-bearing ticket in any mode. `live_probe` adds proof on top of them; it never replaces them.
- Use test-first development whenever the mode's first deliverable is a failing test, checker, or harness.
- Test public interfaces, not private implementation details.
- Evidence exists to show what the tests can't, so capture it once and keep it small. It goes under `evidence/<ticket>/` with a `manifest.yaml` (schema `evidence-manifest.schema.json`) the lead writes: owner, mode, producing command, the commit it was verified at, `result`, pass criteria, and the files that show the expected state. A `baseline` or `measurement` file carries a sha256, because a later run compares against it; other files need no digest. The verified-at commit is a historical fact: later commits and rebases don't make it stale, and nobody re-pins it.
- Retain only what shows the expected state: the response, screenshot, log line, or file the recipe's `evidence` names, plus a short summary. Don't retain whole build or server logs or every intermediate screenshot, and strip ANSI escapes from retained text.
- A check that can't be shown is recorded as it is: `result: not_met` or `owed`, with the reason and where it was routed. A ticket whose evidence is `not_met` is not `done`.
- A live probe that fails is a failed verification, handled by the `test_failure` policy. A probe that can't run because the recipe's `doctor` fails is an environment problem: retry once, then record it in the closeout and continue with the tests as the only proof, never as a pass.
- **Spike tickets** produce no code. The worker writes `spikes/SPK-<ACRONYM>-<EPIC><NNN>.md` from the Stage 4 template, budgeted by the ticket's points. Review it as a document-only milestone. When the spike closes a register entry, the lead records the recommendation in the epic's `decisions` list for reconcile to carry to the register; when it requires a spec change, it goes through the `blocker` policy.
- **Temporary log check:** every temporary print or debugging helper carries `[DEBUG-<Ticket>]`. The milestone cannot be committed while any line containing `[DEBUG-` remains in the staged diff.

## 6. Workflow

{% if harness.id == "claude" %}### Step 0: Plan in plan mode (standalone)

This is the only point where the user is in the loop. Plan mode lets you write only the one plan file the harness names, so Step 0 has three parts: prepare before plan mode (anything that writes files), decide in plan mode, and materialise after approval.

**Before plan mode.** In issue mode, classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Nothing here asks the user anything.

**In plan mode.**

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository through exploration subagents to separate completed, partial, and missing work, at the default branch's current commit.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, the threshold above which the reviewer batches and quality drops.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`, as the content of the harness's plan-mode file. Propose models per role, the review panel (by default one Claude and one Codex reviewer), the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`, and run `check-plan` on the plan-mode file itself; both must be clean before you present, so the user approves a plan that already passes.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings and amend the plan, then exit plan mode for approval.

**After approval.**

7. Write the approved plan to its plan-file path (`.claude/plans/<epic>.md` by default) unchanged, and run `check-plan` on it once more to confirm the copy.
8. Create the worktree and branch per the concurrency block in `constitution.yaml`. From here on, ask nothing.
{% elif harness.id == "codex" %}### Step 0: Plan (standalone)

This is the point where the user approves the execution plan. In issue mode, first classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Write the plan file at the project path or `.codex/plans/<epic>.md`; Codex does not require a special plan-mode file or a mode switch for this step.

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository through exploration subagents to separate completed, partial, and missing work, at the default branch's current commit.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, the threshold above which the reviewer batches and quality drops.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`. Propose models per role, the review panel (by default two different Codex models, or Codex and pi when pi is available), the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`, and run `check-plan` on the plan file itself; both must be clean before you present, so the user approves a plan that already passes.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings, amend the plan, and run `check-plan` again.
7. After approval, create the worktree and branch per the concurrency block in `constitution.yaml`.
{% else %}### Step 0: Plan in plan mode (standalone)

This is the only point where the user is in the loop. If the plan is already approved, skip plan mode and materialise. Otherwise call `enter_plan_mode`. While it is active the only writable file is the session `plan.md` under `~/.grok/sessions/...`. It cannot hold the repo plan file, and `check-plan` does not run against it. Step 0 has three parts: prepare before plan mode (anything that writes repository files), decide in plan mode, and materialise after exit.

**Before plan mode.** In issue mode, classify the issue and, for an out-of-band epic, dispatch the planning worker and run `render` (§3). Nothing here asks the user anything.

**In plan mode.**

1. Read the epic's ticket order from `critical-path.md` and the tickets' modes, recipes, flows, certainty, and scope.
2. Inspect the repository through `spawn_subagent` explorers whose prompts say they are read-only and must not create, edit, or delete files. Do not pass a subagent type. Separate completed, partial, and missing work, at the default branch's current commit.
3. Group tickets into **milestones**: the smallest reviewable, dependency-valid unit of value. Merge two tiny tickets or split a large one so each review diff stays under roughly 30 files or 1,500 diff lines, the threshold above which the reviewer batches and quality drops.
4. Write the plan per `references/epic-plan.md` with `planned_by: self`, into the session plan file. Propose models per role, the review panel (by default one Grok reviewer via `spawn_subagent` and one Codex reviewer), the budget threshold and fallbacks, and liveness, from what the user has said about their usage and the difficulty of each milestone. Start from the default autonomy policy.
5. Run `validate`. `check-plan` waits until the repo plan file exists, which is after exit.
6. Present the plan once and ask everything you need to in the same exchange: models and budget, the review panel, any override of the autonomy policy, the open decisions that touch the epic, whether an out-of-band epic waits for a running wave, and whether you merge or leave the merge to the user. Record the answers under Step-0 rulings and amend the session plan, then call `exit_plan_mode` for approval.

**After approval.**

7. Write the approved plan to its plan-file path (`.grok/plans/<epic>.md` by default) unchanged, and run `check-plan` on it. Fix mechanical errors in that file without a new question. If a fix would change an approved ruling, stop and say so.
8. Create the worktree and branch per the concurrency block in `constitution.yaml`. From here on, ask nothing.
{% endif %}

In orchestrated mode there is no Step 0 for you: the wave lead did it.

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

The worker implements, runs the verification command, and returns a summary, the files it touched, the code decisions it made, and any drift reports. A worker with no commit-worthy change and no report for `liveness.stall_after_minutes` goes through the `stall` policy: one fresh worker on the same milestone, then `defer_tickets`.

### Step 3: Verify and commit

1. **Verification command.** Run it and require the mode's proof.{% if harness.id != "codex" %} When the project's instructions name a runtime resource that lanes share and serialize (a database behind a lock, a port), keep each hold short: run only the test files the change touches plus their direct dependents, named by path, and split a run that needs more than about ten minutes into several separate holds so other lanes interleave. Whole-pool runs wait for the PR review loop (Step 7, item 5). A ticket whose proof is a whole-pool run by definition runs it once, chunked the same way, never as one hold.{% endif %}
2. **Live probe.** Don't capture `live_probe` evidence here; it is captured once, at the review-clean head (Step 7, item 5). You may run a ticket's recipe as a development check when the milestone's risk is in the running system, but write no evidence and no manifest for it.
3. **Temporary log check.** `git diff | grep '\[DEBUG-'` returns nothing.
4. **Write-authority check.** `git status` shows no path under `.constitution/` other than the epic file, a spike file, or `evidence/`. Revert any other constitution change and treat its content as a drift report.
5. **Scope deviation.** For any touched file outside the ticket's in-scope paths, add a `deviations` entry to the ticket with files and justification.
6. **Published surfaces.** A change to an artifact a sidecar points at with a published surface kind (an HTTP API, events, a CLI, a library, an SDK) must fit the compatibility ADR. A breaking change it doesn't allow goes through the `blocker` policy.
7. **Enforcement check.** A change to any contract, schema, lock, golden file, fixture corpus, or generated artifact names the existing check that pins the old value and includes the change to that check.
8. **Cross-record reconciliation.** Grep for any restated value you changed (counts, digests, versions, conventions) across the epic's outputs and reconcile every copy.
9. **Freeze last.** Digest-bound content is finalized only after review.
10. **Evidence.** For `benchmark`, `stat_threshold`, `hitl_sil`, `visual_regression`, and `runbook_probe`, whose proof is the run itself, write the `evidence/<ticket>/manifest.yaml` once, at the milestone that completes the ticket. Re-run it only when a later change alters the measured behavior. Apply `references/evidence-preservation.md` when the milestone cites external sources.
11. **Code decisions.** Add each dependency, pattern, convention, or contract shape the worker introduced without a Stage 3 record to the closeout draft's `code_decisions`, with its paths and the commit.
12. **Status and settling.** Set the ticket's `status` to `done`. When the tests exercised a sidecar, boundary, or capability that was assumed, note the record and the test path; it goes into the closeout's `settled` list.
13. Run `validate`; commit only when it reports no errors. Name the ticket ids in the subject and the mode's proof in the body. Note the SHA.

### Step 4: Review gate

After every commit and before the next milestone, spawn one isolated reviewer {% if harness.id == "grok" %}with `spawn_subagent` when the runtime is `grok` (otherwise the named runtime's one-off form), with no parent context, on the model named for milestone reviewers. The prompt says the reviewer must not create, edit, or delete files. It runs `/reviewing-milestone-commits`, and you pass only:{% else %}with no parent context, on the runtime and model named for milestone reviewers, running `/reviewing-milestone-commits`, passing only:{% endif %} the commit SHA, the plan file path, the epic file path and ticket ids, the acceptance mode, evidence, and recipe, the verification command, and for a spec-patch milestone the drift report; for a fast-lane milestone, the lane claim. Tell it not to launch subagents of its own. When the milestone's code was written on the reviewer's runtime, use the other runtime from the plan's `review_panel` instead, so the milestone is judged by a different model family from the one that wrote it.

Treat valid `P0` and `P1` findings as blockers: dispatch a fresh fix worker with the finding, verify per Step 3, commit, and re-review the fix. `P2` and lower are fixed when cheap, otherwise recorded in the closeout's follow-ups. A finding that keeps coming back after two fixes goes through the `review_nonconvergence` policy.

### Step 5: Discovered decisions

When a milestone surfaces a question nobody may answer silently, it is the `open_decision` trigger: apply the policy per §4. A ruling the wave lead sends within its delegated authority replaces the interim; record it in the entry with `status: closed`, the ruler, and the ruling's reference, date, summary, and chosen option when applicable. Revisit the places the interim was applied and proceed. Carry a ruling already approved in Step 0 the same way. Reconciliation applies this recorded approval; it never invents a ruling.

### Step 6: Handle drift

| Tier | Meaning | Action |
| :--- | :--- | :--- |
| Physical | A Stage 3 detail in a file the epic declared patchable: a guideline, a verification command, a stack pin, an ADR detail, a sidecar field | The `spec_drift` policy; by default dispatch a fresh spec-patch worker with the drift report. It edits only those files and touches nothing else. Commit it as its own milestone, run `validate`, review it as a spec-patch milestone. Record it in the closeout's `spec_patches`. |
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

1. Every ticket is `done`, or `deferred` with `deferred_to` set.
2. Write the `closeout` block, schema in `epic.schema.json`: tickets completed and deferred, points completed, spec patches with commits, changelog entries by directory, candidate glossary terms, items routed upstream, follow-ups, `code_decisions`, and the `settled` list with repository evidence. Leave `actuals` absent; reconcile computes it from git. A fast-lane run has no closeout; its trailers carry the same facts.
3. Run `validate`, then commit the epic file alone.
4. Open the pull request with `commit-push-open-pr` against the base branch the plan file or the concurrency block names, passing the title, body, base, and ready status explicitly. The body is comprehensive: what changed and why, the milestones and their review outcomes, deviations, spec patches, interim assumptions adopted and where, code decisions, live-probe evidence, and validation performed.
5. Run the PR review loop with `pr-review-fix-loop`, passing the plan's `review_panel` and `pr_review` blocks so the loop never asks. Its stop condition is one verification round with no new Act-on finding; it has no cap, and at `review_escalate_at` it changes strategy instead of stopping. Fix workers follow Step 3 for every commit the loop pushes.{% if harness.id != "codex" %} The complete gates the epic's tickets name run once per epic, here: on the head the loop is about to declare review-clean, chunked into short holds when the runtime is shared, with the output recorded in the PR body. A fix round after that complete run re-runs only the suites its diff touches.{% endif %} Live probes run once per epic, on the head the loop is about to declare review-clean: run every `live_probe` ticket's recipe, sharing one session when several tickets drive the same surface, capture the evidence per §5, and commit it in one evidence commit. A fix after that capture re-runs a probe only when its diff changes behavior that probe's scenario asserts; otherwise the evidence stands at its verified-at commit, which is not a defect.
6. Do not archive, render, or touch any changelog.
   - Standalone: once the loop is clean and CI passes on the head, retain the verification evidence and finish any lane teardown the project's instructions require before merging. Stop owned services and remove only the local state those instructions authorize. Run teardown after the last required verification, so a later gate does not inherit a destroyed runtime. With GitHub CLI 2.102.0, `--delete-branch` can remove another linked worktree; when run inside that worktree it skips local deletion. Complete every operation that depends on the lane's files before invoking branch deletion from another checkout. Then merge with the merge skill the concurrency block names, unless the Step-0 rulings leave the merge to the user. Then, on the default branch, run `reconcile --epic <id>`, which commits its own result, and after it `derive --write`, committing what derive changed as a second constitution-only commit. Run them in that order: reconcile refuses to run on a dirty tree.
   - Orchestrated: never merge and never run `reconcile`; the wave lead does both once for the wave.
7. Report. In standalone mode, report to the user in prose: the PR, the merge, the interim assumptions that now need a ruling, the code decisions routed to Stage 3, deferred tickets, and follow-ups. In orchestrated mode, {% if harness.id == "claude" %}send exactly this to the wave lead with `SendMessage`, as your final report; remove any saved scratch copy only after confirmed delivery:{% else %}return exactly this as your final reply:{% endif %}

```markdown
## Epic report
- **Epic:** EPIC-<ID>
- **PR:** number, URL, head SHA at the end of the review loop
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
- [ ] Every milestone was implemented by a fresh worker, verified by the lead with the mode's proof, swept of debug tags, committed with a clean `validate`, reviewed by a different model family from the one that wrote it, and had `P0` and `P1` findings resolved and re-reviewed.
- [ ] Every dispatch named its runtime and model explicitly, and the budget fallback was applied at the threshold.
- [ ] No commit mixes code with `prd/`, `architecture/`, or `tech-spec/`; no worker wrote under `.constitution/` except a spike file.
- [ ] Every drift report was classified; physical drift became a reviewed spec-patch milestone, logical drift went through the autonomy policy.
- [ ] Every interim assumption is in the epic's `decisions` list in register shape, with the places it was applied.
- [ ] Every scope deviation is recorded in its ticket; every produced evidence directory has a manifest, and live-probe evidence was captured once, at the review-clean head; every code decision is in the closeout.
- [ ] The closeout is complete and committed alone, the pull request is review-clean, and it is merged and reconciled (standalone, unless the user kept the merge) or left to the orchestrator (orchestrated).

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
