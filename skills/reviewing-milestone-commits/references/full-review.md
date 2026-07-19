---
name: reviewing-milestone-commits
description: Review a committed epic milestone during execute-epic-end-to-end execution. Use when an implementation milestone has been committed and must receive an isolated correctness review before the executor continues to the next milestone. Requires git access to inspect the commit diff, surrounding code, relevant tests, and framework artifacts. Do not use for PR reviews, code generation, loose snippets, or generalized architecture feedback unrelated to the committed milestone.
---

# Reviewing Milestone Commits

Review a committed milestone as a concrete change to a real codebase, with the same seriousness as a PR review but a narrower target: the milestone commit.

## Trigger Boundary

Use this skill when the executor asks for review of a committed milestone during epic execution.

The primary input is a commit SHA. The prompt may also include repo-derived context such as the epic identifier, milestone name, ticket IDs, acceptance criteria source, upstream artifact paths, and validation already run.

Do not use it for:
- code generation
- implementation help
- pull request reviews
- repo-wide audits
- review of loose snippets or uncommitted diffs
- generalized architecture feedback unrelated to the committed milestone

## Operating Stance

Review the milestone commit independently. Do not rely on the executor's confidence, plan, or implementation notes as proof that the change is correct.

Priorities:
1. correctness and acceptance-criteria fit
2. contract, schema, migration, and architecture drift
3. tests, validation quality, compatibility, security, observability, and maintainability
4. non-blocking feedback that is still grounded in the committed change

Be balanced, but block when warranted. The purpose is to prevent errors from compounding before the next milestone begins.

Do not:
- rely on the diff alone when surrounding code is needed
- comment on untouched code unless there is concrete interaction risk
- invent repo conventions; infer them from nearby code
- escalate weak guesses into bugs
- file speculative concerns as bugs
- review the whole epic unless broader context is needed to judge this milestone

## Required Workflow

Do not skip steps because the commit looks obvious.

### Step 1 - Identify The Commit

Confirm the commit SHA from the prompt. If no commit SHA is provided, stop and say so.

Collect, at minimum:
- commit subject and body
- changed files
- raw diff
- touched tests or validation artifacts

Typical command sequence:

```bash
git show --stat --summary <commit>
git show --find-renames --find-copies <commit>
```

If the prompt gives a commit range instead of a single commit, inspect the range with:

```bash
git diff --stat <range>
git diff --find-renames --find-copies <range>
```

### Step 2 - Read The Milestone Contract

Use repo-local artifacts as the source of truth:
- `Tasks.md` for ticket IDs, dependency order, and acceptance criteria
- `TechSpec.md` for concrete contracts, schemas, stack, and project structure
- `Architecture.md` for logical boundaries and critical flows
- `PRD.md` for scope, capability intent, and non-functional constraints

If artifact names or paths differ, locate the equivalent project documents. If they cannot be found, proceed with commit and code review but report the confidence limit.

Verify that the milestone change satisfies the relevant ticket acceptance criteria. 

**Scope Verification Protocol:**
- Identify the ticket's declared `Scope (In-Scope Files)` and `Scope (Out-of-Scope Files)` from the active Epic file under `.constitution/tasks/active/`.
- Cross-reference the files modified in the commit diff against these scope boundaries.
- If any file outside the `Scope (In-Scope Files)` (or explicitly listed under `Scope (Out-of-Scope Files)`) was touched, check the active Epic file for a `##### [TICKET_ID] Deviations & Justifications` section under the ticket.
- If a justification is present, review it. If it is reasonable and correct, accept it and list it under `General feedback`.
- If no justification is documented for the extra touched files, raise a blocking `P2` finding requiring the developer/executor to document the deviation inside the ticket before proceeding.

### Step 3 - Read More Than The Diff

For each materially changed file:
- read the diff
- read surrounding code needed to understand behavior
- inspect callers, callees, tests, interfaces, config, migrations, and docs when they matter
- compare the change against nearby repository patterns

The commit is the entry point, not the whole context. Read enough of the codebase to judge whether the milestone works and fits.

### Step 3.5 — Scope management for large commits

If the milestone commit (or commit range) touches more than roughly 30 files or 1500 lines of diff, do not attempt to review everything in a single pass. 

Instead:
1. Group changed files into logical batches by module, package, or concern (e.g., "API handlers," "database migrations," "test updates").
2. Review each batch sequentially, completing findings for one batch before moving to the next.
3. Prioritize batches by risk: core logic and data-path changes first, then tests and config, then generated or mechanical changes last.
4. Track cross-batch interactions — a schema change in batch 1 may invalidate assumptions in batch 3.
5. After all batches, do a brief cross-cutting pass for coherence: do the pieces fit together? Are there gaps between batches where integration bugs could hide?

If context limits force you to stop before finishing all batches, say which batches you reviewed and which remain, so the user knows what still needs eyes.

### Step 4 - Run Local Verification When Feasible

Before finalizing the review:
- inspect the repo for canonical verification entry points such as `README`, `package.json`, `bunfig.toml`, `Makefile`, `justfile`, language-specific task runners, and CI workflow files
- prefer the repo's documented commands; in JavaScript or TypeScript repos, prefer `bun` commands over `npm`, `yarn`, or `pnpm` unless the repo clearly uses something else
- run the narrowest meaningful checks first, then broaden if needed
- record the exact commands you ran and the result, including concrete blockers when a command cannot run

Behavior-bearing milestone commits should usually trigger at least one executed verification command unless the environment or project setup makes that impossible.

### Step 5 - Review Categories

Check all of these categories:

#### Acceptance Criteria And Correctness
- Does the committed behavior satisfy the milestone tickets?
- Are edge cases, partial failures, retries, and null or empty states handled?
- Are affected call sites and interfaces updated coherently?

#### Upstream Fit
- Does the milestone stay within `PRD.md`, `Architecture.md`, `TechSpec.md`, and `Tasks.md`?
- Does it invent missing contracts or change boundaries that should have been routed upstream?
- Does it preserve ticket IDs, capability mappings, and Brownfield continuity when present?

#### Tests, Lint, And CI
- Are relevant tests present for behavior changes?
- Do tests assert behavior independently, rather than mirroring the implementation? Audit test assertions to make sure they are checking actual behavior and outcomes—verify they are not "gaming the verification" with dummy checks or empty mocks.
- Were relevant tests, lint, typechecks, or builds run locally? Make sure you run the ticket's specific `Verification Command` and confirm it succeeds.
- Is missing coverage likely to hide regressions?

#### Security And Permissions
- Are authn and authz expectations preserved?
- Is untrusted input validated or encoded correctly?
- Are secrets, private data, or risky logs exposed?

#### Data, Migrations, And Compatibility
- Does the change alter schemas, contracts, messages, or stored data?
- Could migrations, rollouts, or old clients break?
- Are rollback assumptions sane?

#### Performance And Resource Behavior
- Does this add expensive loops, queries, allocations, or network chatter?
- Is there N+1 risk, retry amplification, lock contention, or cache churn?

#### Observability And Operability
- Will operators have enough signal to debug failures?
- Are metrics, logs, traces, or alerts materially affected?

#### Maintainability And Local Consistency
- Does the change fit nearby code patterns unless deviation is justified?
- Is the code understandable and locally coherent?
- Is the complexity justified by the milestone?

Only raise findings grounded in the commit, surrounding code, validation output, or framework artifacts.

### Step 6 - Classify Findings

Use the smallest label that honestly matches the issue.

- `P0`: severe correctness, security, data-loss, or production-breakage risk that must block continuation
- `P1`: meaningful bug or gap likely to cause incorrect behavior, broken acceptance criteria, or serious operational pain
- `P2`: smaller but real bug, quality gap, missing validation, or maintainability risk worth fixing before the epic compounds around it
- `Investigate`: grounded concern that needs confirmation
- `General feedback`: non-blocking useful feedback tied to the committed change

Severity discipline:
- do not use `P0`, `P1`, or `P2` for style nitpicks
- do not file speculative concerns as bugs
- do not expand scope to untouched code unless the milestone materially depends on it
- `P2` means a real correctness, quality, user-visible, or future-maintenance gap, not "could be cleaner"
- `Investigate` means a grounded concern that needs confirmation, not a design tradeoff already explained by code or artifacts

### Step 7 - Return The Review

Follow this exact section order. Omit empty subsections.

```md
## Potential Bugs

### P0
path:line-range
Review comment in prose, optional suggestions/code block.

### P1
path:line-range
Review comment in prose, optional suggestions/code block.

### P2
path:line-range
Review comment in prose, optional suggestions/code block.

## Flags

### Investigate
path:line-range
Review comment in prose, optional suggestions/code block.

### General feedback
path:line-range
Review comment in prose, optional suggestions/code block.
```

Formatting rules:
- include `path:line-range` for every comment when possible
- keep comments concrete and prose-first
- include suggestions or code blocks only when they materially help
- mention verification commands you ran and blockers for any commands you could not run when relevant to the finding
- do not add a separate summary, approval, or filler outside the required format
