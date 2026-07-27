---
name: {{ skill_name }}
description: "{{ skill_description }}"
---

# Execute Epic End To End

## 1. Overview

Treat this skill as the active execution operator of the four-stage framework. It executes one **work item** end to end, milestone by milestone. Two work sources are supported:

- **Epic mode (default):** the source of truth is the active epic file under `.constitution/tasks/active/EPIC-[EPIC_LETTER]-[epic-name].md`. Trace every implementation decision back through `.constitution/tech-spec/`, `.constitution/architecture/`, and `.constitution/prd/`.
- **GitHub Issue mode:** the source of truth is a tracked GitHub issue fetched with `gh`. When a `.constitution/` exists, the issue is treated as an out-of-band work item that must be reconciled with the constitution at closeout; when it does not, the issue body and its linked context are the sole source of truth.

Whichever source is active, plan the work once up front, create a branch, then implement it milestone by milestone. Each milestone must be validated, committed, and independently reviewed before the next milestone begins. Stop only when the work item is complete, or a real blocker exists.

## 2. Work Source Detection, Required Inputs & Blocker Detection

### Work Source Detection
Default to **Epic mode**. Switch to **GitHub Issue mode** when either signal is present:
- the user references a GitHub issue by number (e.g. `#42`), by URL, or by asking to execute an issue, or
- no executable epic exists under `.constitution/tasks/active/` (empty or missing) while the request clearly points at tracked issue work.

If both an active epic and an issue reference are present and it is unclear which to run, ask the user which work item to execute. Before relying on Issue mode, confirm `gh` is authenticated (`gh auth status`).

### Required Inputs
Always gather repo reality, open worktree state, and any existing partial implementation. Then, per mode:

**Epic mode:**
- the target active epic filename from `.constitution/tasks/active/`
- `.constitution/tasks/active/EPIC-[EPIC_LETTER]-[epic-name].md` as the required execution source of truth
- `.constitution/tech-spec/` for physical schemas, contracts, ADRs, and guidelines
- `.constitution/architecture/` for container boundaries, execution flows, and sequence diagrams
- `.constitution/prd/` for scope, glossary, capabilities, and non-functional constraints

**GitHub Issue mode:**
- the full issue via `gh issue view <number> --comments` (title, body, labels, task-list checkboxes, and discussion)
- any issue-referenced design docs, linked issues, or PRs needed to make the work implementation-ready
- if a `.constitution/` exists in the repo, load `prd/`, `architecture/`, and `tech-spec/` as governing context and `prd/glossary.md` for vocabulary alignment — the issue is an out-of-band work item that still owes traceability to those layers
- the acceptance criteria, derived from the issue: prefer explicit checklists or stated criteria; if the issue lacks testable criteria, synthesize deterministic criteria from the body and confirm them with the user before implementing

### Blocker Routing
If the work item cannot proceed without inventing requirements, logic, or contracts, immediately halt execution and output a blocker report using the shared format.

- **Epic mode, or Issue mode with a `.constitution/` present:** route the user to the correct upstream stage using the table below. In Issue mode this means the issue is asking for something the constitution has not yet defined — surface that gap rather than inventing it downstream.
- **Issue mode with no `.constitution/`:** there is no upstream stage to route to. Halt, post the blocker as a comment on the issue (or report it to the user), and request the missing decision, contract, or clarification before resuming.

| Symptom | Correct Upstream Action |
| --- | --- |
| Epic missing, task sequence wrong, or Gherkin criteria not implementation-ready | Invoke `/planning-engineering-execution` to revise active epic under `.constitution/tasks/` |
| Ticket requires an undefined API, database schema, migration rule, or interface contract | Revise `.constitution/tech-spec/` using `/specifying-technical-implementation` |
| Required change would alter logical container boundaries, communication styles, or trust boundaries | Revise `.constitution/architecture/` using `/designing-solution-architecture` |
| Requested outcome changes product scope, priority, or business intent | Revise `.constitution/prd/` using `/defining-product-requirements` |

```markdown
## Blocked
- **Blocked by:** [missing information, stale spec, or contradictory requirements]
- **Route to:** [.constitution/tasks/ | .constitution/tech-spec/ | .constitution/architecture/ | .constitution/prd/ | GitHub issue thread / user decision]
- **Missing or flawed source:** [specific filename, subdirectory, or issue field]
- **Why execution cannot continue:** [plain-language explanation]
- **Required revision:** [exact change needed before implementation can resume]
```

## 3. Testing & Validation Rules

- Treat automated tests as required deliverables for all behavior-bearing tickets.
- Prefer Test-Driven Development (TDD) when a ticket's Gherkin acceptance criteria can be expressed as deterministic failing tests before implementation.
- Focus testing efforts on public interfaces (behavior) rather than private implementation details. A good test would still fail if the internal code were subtly broken, but survives intact during a prior-path refactor.
- **Temporary Log Check:** All temporary prints, logs, or debugging helpers added during development must be prefixed with a ticket-specific tag: `[DEBUG-<Ticket>]` (e.g., `[DEBUG-AUTH-A001]`). Before committing any milestone, search the working tree; the milestone cannot be committed if any line containing `[DEBUG-` remains in the staged diff.

## 4. Execution Workflow

### Step 1: Upfront Milestone Planning
1.  Read the work item to identify its unit list, dependencies, and acceptance criteria: in Epic mode, the active epic file's tickets, dependencies, Gherkin criteria, and critical path; in Issue mode, the issue body's task-list items, stated dependencies, and the acceptance criteria derived in Section 2.
2.  Inspect the repository (codebase, test suites, and configurations) to separate completed, partial, or missing work for this work item.
3.  List the units of work in dependency order. Group them into distinct **milestones** representing the smallest reviewable, dependency-valid units of value (default is one ticket, or one issue task-list item, per milestone).
4.  Identify the validation command needed for each milestone (e.g., tests, linting, compile checks).
5.  **Prompt for Review Mode:** Explicitly ask the user to select the review depth for the milestone review gates: either **dual-axis parallel subagents review** (splitting Standards and Spec checks) or **standard single-pass review**. Save this preference in your execution plan notes.
6.  Determine the branch name using `type/description` format (e.g., `feat/epic-a-user-validation`). Do not create or switch branches if the current branch is already correct and has a clean worktree.

### Step 2: Implement Milestone by Milestone
For each planned milestone in sequence:
1.  Restate the acceptance criteria (Epic mode: Gherkin; Issue mode: the criteria derived in Section 2) and contract boundaries in your working notes.
2.  If TDD is appropriate, write the failing tests first and watch them fail.
3.  Write the minimum code and configuration changes necessary to satisfy the acceptance criteria, respecting the declared scope (Epic mode: the ticket's `Scope (In-Scope Files)` list; Issue mode: the files the issue implies).
4.  Run local validation. Run the *Temporary Log Check* (such as `git diff | grep '\[DEBUG-'`) to guarantee zero temporary `[DEBUG-<Ticket>]` logs remain in the diff.
5.  **Scope Deviation Check:** Compare files modified in this milestone (using `git status` or diffs) against the declared scope. In Epic mode the scope is the ticket's declared `Scope (In-Scope Files)`; in Issue mode it is the files the issue implies. If any file outside that scope is touched, document the deviation and its justification:
    - **Epic mode:** append a justification section directly within the ticket block in the active Epic file:
      ```markdown
      ##### [TICKET_ID] Deviations & Justifications
      - **Touched Files:** [list files here]
      - **Justification:** [Short explanation explaining why this deviation was necessary]
      ```
    - **Issue mode:** record the touched files and justification in your working notes and carry them into the milestone commit message and the eventual PR summary (and, if useful, an issue comment).
6.  Commit the milestone once local validation and scope checks pass, naming the committed Ticket IDs in the commit message. Note the commit SHA.

### Step 3: Run the Milestone Review Gate
After committing each milestone and **before** starting the next one, execute the review based on the mode chosen in Step 1:

*   **If Standard Single-Pass Review was chosen:**
    1. Spawn an isolated subagent with no parent conversation context, {% if harness.id == "opencode" %}using the `task` tool (`subagent_type: "reviewer"`).{% else %}using the `Agent` tool. Default to `model: "opus"` unless the user has explicitly specified a different model preference.{% endif %}
    2. Instruct the subagent to {% if harness.id == "opencode" %}call `skill({ name: "reviewing-milestone-commits" })` and then follow it{% else %}load and execute the `/reviewing-milestone-commits` skill{% endif %}, passing `mode: "full"`, the target committed milestone SHA, and the work item context — in Epic mode the target epic file and its Gherkin criteria; in Issue mode the issue number/URL and the derived acceptance criteria.
    3. Wait for the subagent's review results.
    4. Format the output directly.
*   **If Dual-Axis Parallel Review was chosen:**
    1. Spawn **two parallel subagents** with no parent conversation context, {% if harness.id == "opencode" %}using the `task` tool (`subagent_type: "reviewer"`) — one `task` call per subagent in the same message.{% else %}using the `Agent` tool. Default to `model: "opus"` for both subagents unless the user has explicitly specified a different model preference.{% endif %}
    2. Instruct Subagent 1 (Standards) to {% if harness.id == "opencode" %}call `skill({ name: "reviewing-milestone-commits" })` and then follow it{% else %}load and execute `/reviewing-milestone-commits`{% endif %} passing `mode: "standards"` and the target committed milestone SHA.
    3. Instruct Subagent 2 (Spec) to {% if harness.id == "opencode" %}call `skill({ name: "reviewing-milestone-commits" })` and then follow it{% else %}load and execute `/reviewing-milestone-commits`{% endif %}, passing `mode: "spec"`, the target committed milestone SHA, and the work item context (Epic mode: the epic file and Gherkin criteria; Issue mode: the issue number/URL and derived acceptance criteria).
    4. Wait for both subagents to complete their runs.
    5. Aggregate both reports side-by-side or sequentially under `## Standards` and `## Spec` headers. Maintain their separation and do not merge their findings.

Triage the review output: treat valid high-priority (`P0`/`P1`) and structural correctness findings (from either axis) as mandatory blockers. Re-read the cited code, write the fix, validate, and commit the fix before starting the next milestone.

### Step 4: Keep the Spec Folders Honest
When a `.constitution/` is present (always in Epic mode; in Issue mode only when the repo uses the constitution), keep the spec folders honest as physical implementation decisions are finalized during execution:
*   If a physical database schema, API contract, or directory layout deviates from what is written, update the corresponding file under `.constitution/tech-spec/data-models/`, `contracts/`, or `guidelines.md` immediately.
*   If physical implementation decisions deviate from the logical container boundaries, communication styles, or trust boundaries described in `.constitution/architecture/`, update the corresponding files and record in `.constitution/architecture/changelog.md`.
*   Record the changes in `.constitution/tech-spec/changelog.md` and `.constitution/tasks/changelog.md` with appropriate SemVer bumps. Never allow codebase reality and the `.constitution/` specs to drift.

If no `.constitution/` exists (lightweight Issue mode), skip this step — keep implementation notes in the issue/PR instead.

### Step 5: The Constitution Freshness & Reconciliation Pass
Applies whenever a `.constitution/` is present (always in Epic mode; in Issue mode only when the repo uses the constitution). Once all units of the work item are implemented and validated:
1.  Reread the active files under `.constitution/prd/`, `architecture/`, `tech-spec/`, and `tasks/` in order.
2.  Verify that every document is updated to accurately describe the post-change codebase, including new schemas, active endpoints, and deferred items. In Issue mode, treat this as the reconciliation that folds the out-of-band issue work back into the constitution.
3.  Do not patch downstream files to hide an upstream mismatch. If execution revealed a scope or logical boundary delta, route the change back to the correct folder (`prd/` or `architecture/`) before finishing.

### Step 6: Close Out the Work Item
Close out based on the active mode.

**Epic mode — close the epic deliberately:**
1.  Verify every ticket in the active epic file is completed or explicitly deferred upstream.
2.  Archive the completed epic file by running the physical git command:
    ```bash
    git mv .constitution/tasks/active/EPIC-[EPIC_LETTER]-[epic-name].md .constitution/tasks/completed/
    ```
3.  Update `.constitution/tasks/critical-path.md` to recompute active story points (excluding the archived epic), update the critical path list, and revise the Build Order flowchart.
4.  Record the completion and the local SemVer bump in `.constitution/tasks/changelog.md`.
5.  Report the completed tickets, validation performed, and any remaining risks or deferred follow-ups.

**Issue mode — constitutional reconciliation closeout:**
There is no epic file to archive; the closeout *is* a **constitutional review** that keeps `.constitution/` aligned with the changes made while addressing the issue.
1.  Verify every task-list item / acceptance criterion for the issue is satisfied or explicitly deferred.
2.  If a `.constitution/` exists, run the Constitution Freshness & Reconciliation Pass (Step 5) as the primary closeout: walk `prd/`, `architecture/`, and `tech-spec/` and update every document the issue's changes made stale — new schemas, endpoints, contracts, boundaries, or scope. Record the reconciliation in the appropriate local `changelog.md` files with SemVer bumps, and if the issue's outcome altered upstream scope or logical boundaries, route that delta to the correct upstream stage rather than patching it downstream. If no `.constitution/` exists, skip this reconciliation.
3.  Reference and close the issue: link the fix to the issue (e.g. `Closes #<number>` in the commit/PR), post a brief results summary, and close the issue if the merge event will not close it automatically.
4.  Report the resolved issue, validation performed, constitution documents reconciled, and any remaining risks or deferred follow-ups.

## 5. Done Criteria

The work item is not complete until:
- [ ] Every unit of the work item (Epic mode: active epic tickets; Issue mode: issue task-list items / acceptance criteria) is fully implemented, deferred upstream, or blocked.
- [ ] Every implemented milestone was committed, swept of `[DEBUG-<Ticket>]` logs, reviewed by an independent subagent, and had blocking findings resolved.
- [ ] Any file scope deviations are documented and justified — inside their corresponding tickets in the Epic file (Epic mode), or in the milestone commits / PR summary (Issue mode).
- [ ] Required automated tests exist and independently prove the acceptance criteria are satisfied.
- [ ] When a `.constitution/` is present, the live files under `.constitution/prd/`, `architecture/`, and `tech-spec/` are fully updated and accurate via the Constitution Freshness & Reconciliation Pass.
- [ ] **Epic mode:** the completed epic file has been archived to `.constitution/tasks/completed/` via `git mv`; `.constitution/tasks/critical-path.md` has been recomputed; local changelogs (`tasks/changelog.md`, `tech-spec/changelog.md`) reflect the current SemVer bumps.
- [ ] **Issue mode:** the constitutional reconciliation is complete (when a constitution exists), and the issue is linked/closed with a results summary.
