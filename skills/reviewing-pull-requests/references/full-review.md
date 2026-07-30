# Reviewing Pull Requests

Review an actual GitHub pull request with a balanced posture that can still block when warranted.

## Trigger boundary

Use this skill when the user asks to review, check, look at, or give feedback on a pull request.

Do not use it for:
- code generation
- implementation help
- repo-wide audits
- review of a loose snippet or diff that is not being treated as a PR
- generalized architecture feedback unrelated to a PR

## Operating stance

Review the PR as a concrete change to a real codebase, not as an isolated patch. Adapt review emphasis to the repo's primary language, framework, and toolchain — a Go service, a TypeScript monorepo, and a Python ML pipeline have different review surfaces.

Priorities:
1. correctness and risk first
2. then security, compatibility, observability, tests, and maintainability
3. then non-blocking feedback that is still grounded in the changed code

Be balanced, but block when warranted.

Do not:
- rely on the diff alone when surrounding code is needed
- comment on untouched code unless there is concrete interaction risk
- comment on lockfiles unless the lockfile itself is central to the PR
- invent repo conventions; infer them from nearby code
- escalate weak guesses into bugs
- file speculative concerns as bugs

## Required workflow

Do not skip steps because the diff looks obvious. That is how bad reviews cosplay as efficiency.

### Step 1 — Load the PR through `gh`

Use `gh` CLI as the source of truth for the review.

Collect, at minimum:
- PR number, title, and body
- base and head branches
- changed files
- raw diff
- checks / CI status when available
- referenced issues when present

Typical command sequence:

1. Identify and inspect the PR. Start with the core fields, then enrich if available.
   ```bash
   # core — should always work
   gh pr view <number> --json number,title,body,author,baseRefName,headRefName,files,commits

   # enrichment — may fail on older gh versions or repos without checks; ignore errors
   gh pr view <number> --json statusCheckRollup 2>/dev/null
   ```
2. Inspect the raw diff.
   - `gh pr diff <number>`
3. Read explicitly referenced issues.
   - `gh issue view <number>` for each issue the PR body references
4. Read surrounding code in the checkout or working tree.

If the PR cannot be identified or accessed, stop and say so. If an enrichment call fails, continue with what you have — do not halt the review over optional metadata.

### Step 2 — Read issue context and success criteria

If the PR references a GitHub issue, read it.

Treat issue closure as a real requirement:
- if the PR claims to close or address an issue, verify that the changes can coherently do so
- if closure only works under an issue-level assumption, require that assumption to be explicit
- if the issue asks for a behavior change, verify the PR actually implements that behavior rather than a nearby approximation

Also treat project checks seriously:
- if tests or lint are configured, failing checks are real review signal
- missing or obviously insufficient coverage for a behavior change is review signal

### Step 3 — Run local verification when feasible

Do not outsource verification to CI when you are inside an environment that can run commands.

Before finalizing the review:
- inspect the repo for the canonical verification entry points such as `README`, `package.json`, `bunfig.toml`, `Makefile`, `justfile`, language-specific task runners, and CI workflow files
- prefer the repo's documented commands; in JavaScript or TypeScript repos, prefer `bun` commands over `npm`, `yarn`, or `pnpm` unless the repo clearly uses something else
- run the narrowest meaningful checks first, then broaden if needed: targeted tests for touched modules, lint for affected packages, typechecks, and full test suites when the risk justifies it
- treat build or compile failures as review signal when the PR plausibly affects build output or type shape
- record the exact commands you ran and the result, even when the result is "could not run"

Minimum expectation:
- behavior changes should usually trigger at least one executed verification command unless the environment or project setup makes that impossible
- pure refactors still need validation when a cheap relevant check exists
- if you skip running checks, explain why in the review notes with a concrete blocker, not a vague excuse

Use the available environment aggressively but responsibly. If a command is likely expensive, start with the targeted version that matches the changed code. If verification is blocked by missing dependencies, credentials, services, fixtures, or time, say exactly what prevented execution and how that limits confidence in the review.

### Step 3.5 — Check what the PR already acknowledges

Before filing findings, read the PR body carefully for explicitly deferred items, known-gaps sections, migration inventory references, or "intentional non-fix" notes. Also, map the PR's changed files to the corresponding Epic ticket `Scope (In-Scope Files)` in `.constitution/tasks/active/`.

- Do **not** re-file a finding that the PR body already documents as deferred scope (e.g., "follows in Epic Q," "deferred until first publish cycle").
- Do **not** file an `Investigate` flag for a design choice that already has an explanatory inline comment in the code. The comment resolves the concern — note it as acknowledged, not as a gap.
- **Scope Verification:** Check if any changed files fall outside the cumulative `Scope (In-Scope Files)` of the PR's Epic tickets. If they do, verify if there is an accompanying justification entry under `##### [TICKET_ID] Deviations & Justifications` in the active Epic task files or in the PR body. If no justification exists, flag it as an unexplained scope deviation (P2).
- If something is explicitly deferred but you believe the deferral is wrong or the risk is higher than acknowledged, file it as a `P2` with reasoning, not as a flag or fresh finding as if it had never been considered.

Do not review the diff in isolation.

For each materially changed file:
- read the diff
- read surrounding code needed to understand behavior — follow the chain as far as needed to judge correctness
- inspect callers, callees, tests, interfaces, config, and migrations when they matter
- compare the change against nearby repository patterns

The PR is the entry point, not the whole context. Read enough of the codebase to judge whether the change fits, works, and can close the issue it claims to solve. Trust your judgment on how deep to go — a one-line change to a function signature may require reading every call site, while a new utility file may only need its immediate consumers. The goal is confident findings, not exhaustive coverage.

PS: Assume that you are working withing the repo and interact with it directly in your environment.

Flag when something falls outside the local pattern radius without clear justification.

### Step 5 — Scope management for large PRs

If the PR touches more than roughly 30 files or 1500 lines of diff, do not attempt to review everything in a single pass.

Instead:
1. Group changed files into logical batches by module, package, or concern (e.g., "API handlers," "database migrations," "test updates," "config changes").
2. Review each batch sequentially, completing findings for one batch before moving to the next.
3. Prioritize batches by risk: core logic and data-path changes first, then tests and config, then generated or mechanical changes last.
4. Track cross-batch interactions — a schema change in batch 1 may invalidate assumptions in batch 3.
5. After all batches, do a brief cross-cutting pass for coherence: do the pieces fit together? Are there gaps between batches where integration bugs could hide?

If context limits force you to stop before finishing all batches, say which batches you reviewed and which remain, so the user knows what still needs eyes.

### Step 6 — Review categories

Check all of these categories:

#### Correctness and logic
- Does the changed behavior do what the PR and issue claim?
- Are edge cases, partial failures, retries, and null or empty states handled?
- Are affected call sites and interfaces updated coherently?

#### Issue closure coherence
- If an issue is referenced, do the changes really resolve it?
- Does closure depend on a hidden assumption?
- If so, is that assumption explicit?

#### Tests, lint, and CI
- Are relevant tests present for behavior changes?
- Do tests assert behavior independently, rather than mirroring the implementation? Audit test assertions to make sure they check actual outcomes—verify they are not "gaming the verification" with empty mocks or dummy checks.
- Were relevant tests, lint, typechecks, or builds actually run locally? Run the specific ticket `Verification Command` if possible.
- If not, is the blocker explicit and does it reduce confidence in the review?
- If project checks exist, are failures meaningful here?
- Is missing coverage likely to hide regressions?

#### Security and permissions
- Are authn and authz expectations preserved?
- Is untrusted input validated or encoded correctly?
- Are secrets, private data, or risky logs exposed?

#### Data, migrations, and compatibility
- Does the change alter schemas, contracts, messages, or stored data?
- Could migrations, rollouts, or old clients break?
- Are rollback assumptions sane?

#### Performance and resource behavior
- Does this add expensive loops, queries, allocations, or network chatter?
- Is there N+1 risk, retry amplification, lock contention, or cache churn?

#### Observability and operability
- Will operators have enough signal to debug failures?
- Are metrics, logs, traces, or alerts materially affected?

#### Maintainability and local consistency
- Does the change fit nearby code patterns unless deviation is justified?
- Is the code understandable and locally coherent?
- Is the complexity justified?

Only raise findings grounded in the PR, the surrounding code, or the referenced issue context.

### Step 7 — Classify findings

Use the smallest label that honestly matches the issue.

- `P0`: severe correctness, security, data-loss, or production-breakage risk that should block merge
- `P1`: meaningful bug or gap likely to cause incorrect behavior, broken issue closure, or serious operational pain
- `P2`: smaller but real bug, quality gap, or maintainability risk worth fixing
- `Investigate`: grounded concern that needs confirmation
- `General feedback`: non-blocking useful feedback tied to changed code

Severity discipline:
- do not use `P0`, `P1`, or `P2` for style nitpicks
- do not file speculative concerns as bugs
- do not expand scope to untouched code unless the change materially depends on it
- `P2` means a real correctness, quality, or user-visible gap — not "could be cleaner." Import ordering, assertion coverage breadth for already-passing tests, whitespace edge cases, and "slightly friendlier UX" improvements are `General feedback`, not `P2`.
- `Investigate` means you have a grounded concern that needs confirmation — not a design tradeoff already explained by a nearby comment. If the code already has an inline comment explaining the intent of a choice, the concern is resolved; do not re-file it as a flag.

### Step 8 — Return the review in the required format

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
- when relevant, mention the verification commands you ran and the blockers for any commands you could not run
- do not add a separate summary, approval, or filler outside the required format
