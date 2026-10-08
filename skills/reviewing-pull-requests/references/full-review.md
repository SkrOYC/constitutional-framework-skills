# Reviewing Pull Requests (full review)

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

Review the PR as a concrete change to a real codebase, not as an isolated patch. The review runs inside a checkout of the repository, so read files and run commands directly. Adapt review emphasis to the repo's primary language, framework, and toolchain — a Go service, a TypeScript monorepo, and a Python ML pipeline have different review surfaces.

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

### Step 2 — Match the review to what changed

Classify the changed files before choosing what to check: application code, tests, configuration and tooling, `.constitution/` documents, other documentation. Review what the PR actually touches.

- **`.constitution/`-only PR.** This is a document review against the framework rules: each directory decides only what its stage owns and never repairs an upstream directory; naming uses the glossary's canonical terms; every touched directory gets a SemVer bump and a changelog entry; versions, counts, ticket IDs, and cross-references agree across files; Mermaid diagrams and links resolve; and any downstream directory the change makes stale is either updated or explicitly flagged. Skip the code categories in Step 8 and skip code verification. Verification here means confirming that referenced paths exist and diagrams parse.
- **Other docs-only PR** (README, guides, comments): check accuracy against the code, stale commands, and dead links or paths. Skip the code categories in Step 8 and skip code verification.
- **Code PR.** Run the full workflow.
- **Mixed PR.** Review each part by its own rules, and check that the code matches the constitution changes shipped with it.

Findings for documents use the same classification and format as code findings, with `path:line-range` pointing into the document.

### Step 3 — Read issue context and success criteria

If the PR references a GitHub issue, read it.

Treat issue closure as a real requirement:
- if the PR claims to close or address an issue, verify that the changes can coherently do so
- if closure only works under an issue-level assumption, require that assumption to be explicit
- if the issue asks for a behavior change, verify the PR actually implements that behavior rather than a nearby approximation

Also treat project checks seriously:
- if tests or lint are configured, failing checks are real review signal
- missing or obviously insufficient coverage for a behavior change is review signal

### Step 4 — Run local verification when feasible

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
- if you skip running checks, name the concrete blocker in the review notes

If a command is likely expensive, start with the targeted version that matches the changed code. If verification is blocked by missing dependencies, credentials, services, fixtures, or time, say exactly what prevented execution and how that limits confidence in the review.

### Step 5 — Check what the PR already acknowledges

Before filing findings, read the PR body carefully for explicitly deferred items, known-gaps sections, migration inventory references, or "intentional non-fix" notes. Also, map the PR's changed files to the corresponding Epic ticket `Scope (In-Scope Files)` in `.constitution/tasks/active/`.

- Do **not** re-file a finding that the PR body already documents as deferred scope (e.g., "follows in Epic Q," "deferred until first publish cycle").
- Do **not** file an `Investigate` flag for a design choice that already has an explanatory inline comment in the code. The comment resolves the concern — note it as acknowledged, not as a gap.
- **Scope Verification:** Check if any changed files fall outside the cumulative `Scope (In-Scope Files)` of the PR's Epic tickets. If they do, verify if there is an accompanying justification entry under `##### [TICKET_ID] Deviations & Justifications` in the active Epic task files or in the PR body. If no justification exists, flag it as an unexplained scope deviation (P2).
- If something is explicitly deferred but you believe the deferral is wrong or the risk is higher than acknowledged, file it as a `P2` with reasoning, not as a flag or fresh finding as if it had never been considered.

### Step 6 — Read more than the diff

Do not review the diff in isolation.

For each materially changed file:
- read the diff
- read surrounding code needed to understand behavior — follow the chain as far as needed to judge correctness
- inspect callers, callees, tests, interfaces, config, and migrations when they matter
- compare the change against nearby repository patterns

The PR is the entry point, not the whole context. Read enough of the codebase to judge whether the change fits, works, and can close the issue it claims to solve. Trust your judgment on how deep to go — a one-line change to a function signature may require reading every call site, while a new utility file may only need its immediate consumers. The goal is confident findings, not exhaustive coverage.

Flag when something falls outside the local pattern radius without clear justification.

### Step 7 — Scope management for large PRs

For a large PR (roughly 30+ files or 1500+ lines of diff), review in batches ordered by risk — core logic and data paths before tests, config, and generated files — and keep track of interactions between batches, since a schema change in one can invalidate assumptions in another, and finish with a short pass over the whole change for gaps between batches. If you cannot finish every batch, say which files you reviewed and which remain, so the user knows what still needs eyes.

### Step 8 — Review categories

Check every category that applies to what changed (Step 2):

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
- When the repo defines a glossary or ubiquitous-language document (e.g. `.constitution/prd/glossary.md`), does new naming use its canonical terms rather than banned synonyms, and are newly introduced domain concepts added to it?

Only raise findings grounded in the PR, the surrounding code, or the referenced issue context.

### Step 9 — Classify findings

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

### Step 10 — Return the review in the required format

Follow this exact section order. Omit empty subsections.

<output_format>

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

</output_format>

Formatting rules:
- include `path:line-range` for every comment when possible
- keep comments concrete and prose-first
- include suggestions or code blocks only when they materially help
- when relevant, mention the verification commands you ran and the blockers for any commands you could not run
- do not add a separate summary, approval, or filler outside the required format
