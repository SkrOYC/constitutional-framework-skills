---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
---

# Reviewing Milestone Commits

Review a committed milestone as a concrete change to a real codebase, with the same seriousness as a PR review but a narrower target: the milestone commit.

## Trigger Boundary

Use this skill when the epic lead asks for review of a committed milestone during epic execution.

The primary input is a commit SHA. The prompt may also include the epic file path, ticket ids, the acceptance mode and evidence body, the validation command to run, and for a spec-patch milestone the drift report it answers. The constitution is structured YAML; read `~/.{{ harness.id }}/skills/constitution-tooling/references/layout.md` once if the layout is unfamiliar, and run `bun run ~/.{{ harness.id }}/skills/constitution-tooling/scripts/cli.ts validate --root .` as part of every review: an error it reports on the committed tree is a `P1` finding with the check id.

Do not use it for:
- code generation
- implementation help
- pull request reviews
- repo-wide audits
- review of loose snippets or uncommitted diffs
- generalized architecture feedback unrelated to the committed milestone

## Operating Stance

Review the milestone commit independently. Do not rely on the epic lead's confidence, plan, or implementation notes as proof that the change is correct. The lead did not write the code; a fresh worker did, and the lead verified and committed it. Treat both as untrusted for the purpose of this review.

Every finding must trace to a rule, boundary, contract, or glossary entry under `.constitution/`, to the acceptance criteria passed in, or to a convention visible in nearby repository code; cite the file and quote the requirement when a finding rests on one. A finding that rests on a requirement you invented is not a finding.

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

### Step 2 - Match The Review To What Changed

Classify the changed files before choosing what to check: application code, tests, configuration and tooling, `.constitution/` documents, other documentation. Review what the milestone actually touches.

**Write-authority check first.** The framework's two-commit rule says a commit that changes code never changes `.constitution/prd/`, `.constitution/architecture/`, or `.constitution/tech-spec/`, and a commit that changes those never changes code. The epic's own file under `.constitution/tasks/epics/`, a spike file under `.constitution/spikes/`, and evidence under `.constitution/evidence/` are exempt bookkeeping. A commit that breaks this rule gets a `P1` finding naming the offending paths, regardless of the content's quality, because the mix defeats this review: the code would be judged against a spec rewritten in the same commit.

- **Spec-patch milestone.** The commit touches only `.constitution/tech-spec/` files, and the prompt carries the drift report it answers. Check that the patch changes exactly what the drift report needed and nothing more; that the touched files are ones the epic declared it may patch (the epic file's `scope.tech_spec_patchable` list); that the change is physical, not logical: no boundary, communication style, trust boundary, scope, or priority moved, since those must route upstream instead; that contracts and schemas still validate with their tooling; and that no changelog entry was added, since reconciliation writes it. Skip the code categories in Step 7.
- **Spike milestone.** The commit adds or edits only `.constitution/spikes/SPK-*.md`. Check it follows the Stage 4 spike template, answers one concrete question, states its effort budget, names what it unblocks (tickets, a register entry, or both), and edits no active spec. A recommendation that requires a spec change must say which stage owns it. Skip the code categories in Step 7.
- **Other `.constitution/`-only milestone** (a reconciliation commit, or a stage skill's output): this is a document review against the framework rules: each directory decides only what its stage owns and never repairs an upstream directory; naming uses the glossary's canonical terms; versions, counts, ticket IDs, and cross-references agree across files; Mermaid diagrams and links resolve; and any downstream directory the change makes stale is either updated or explicitly flagged. Skip the code categories in Step 7 and skip code verification. Verification here means confirming that referenced paths exist and diagrams parse.
- **Other docs-only milestone** (README, guides, comments): check accuracy against the code, stale commands, and dead links or paths. Skip the code categories in Step 7 and skip code verification.
- **Fast-lane milestone.** The prompt carries a lane claim instead of ticket ids, and the commits carry `Constitution-Lane: fast` trailers. Check the claim before anything else: the change stays in code, touches no artifact a sidecar points at with a published surface kind, no `pinned` contract, no boundary, and sits inside one active epic's owned paths or paths no active epic owns. A change that reaches past the lane is a `P1`. Check that any `Settles:` trailer names a real record and that its `Evidence:` path is a test that exercises it. Then review it as a code milestone.
- **Code milestone.** Run the full workflow. Edits to the epic's own file (ticket status, deviations, decisions, closeout) are reviewed for accuracy against the diff, not as spec changes. An `evidence/<ticket>/manifest.yaml` must pass `validate`.
- **Mixed milestone.** Only code plus the epic's own file or a spike file is a legitimate mix. Any other mix is the `P1` above.

Findings for documents use the same classification and format as code findings, with `path:line-range` pointing into the document.

### Step 3 - Read The Milestone Contract

Use the repo's `.constitution/` directories as the source of truth:
- `.constitution/tasks/epics/EPIC-*.yaml` for ticket ids, dependency order, scope, acceptance mode and evidence, flows, and certainty
- `.constitution/tech-spec/` for the stack, guidelines, verification commands and live-verification recipes, ADRs, and the sidecars that point at contract and data-model artifacts in the code (`artifact_path`, `pinned`)
- `.constitution/architecture/` for logical boundaries and critical flows
- `.constitution/prd/` for scope, capability intent, glossary, and non-functional constraints

If the repo has no `.constitution/` (GitHub Issue mode without a constitution), use the issue and the acceptance criteria the epic lead passed in. If neither can be found, proceed with commit and code review but report the confidence limit.

Verify that the milestone change satisfies the relevant ticket acceptance criteria.

**Scope Verification Protocol (Epic mode):**
- Identify the ticket's `scope.in` and `scope.out` from the epic file.
- Cross-reference the files modified in the commit diff against these scope boundaries.
- If any file outside the `Scope (In-Scope Files)` (or explicitly listed under `Scope (Out-of-Scope Files)`) was touched, check the ticket's `deviations` list.
- If a justification is present, review it. If it is reasonable and correct, accept it and list it under `General feedback`.
- If no justification is documented for the extra touched files, raise a `P1` finding requiring the epic lead to document the deviation inside the ticket before proceeding. It is `P1`, not `P2`, because the lead only blocks on `P0` and `P1`, and an undocumented scope drift compounds with every later milestone.

In Issue mode there is no ticket scope list: compare the touched files against the files the issue implies and note unexplained additions as `General feedback`.

### Step 4 - Read More Than The Diff

For each materially changed file:
- read the diff
- read surrounding code needed to understand behavior
- inspect callers, callees, tests, interfaces, config, migrations, and docs when they matter
- compare the change against nearby repository patterns

The commit is the entry point, not the whole context. Read enough of the codebase to judge whether the milestone works and fits.

### Step 5 - Scope Management For Large Commits

For a large milestone (roughly 30+ files or 1500+ lines of diff), review in batches ordered by risk — core logic and data paths before tests, config, and generated files — and keep track of interactions between batches, since a schema change in one can invalidate assumptions in another, and finish with a short pass over the whole change for gaps between batches. If you cannot finish every batch, say which files you reviewed and which remain, so the epic lead knows what still needs eyes.

### Step 6 - Run Local Verification When Feasible

Before finalizing the review:
- inspect the repo for canonical verification entry points such as `README`, `package.json`, `bunfig.toml`, `Makefile`, `justfile`, language-specific task runners, and CI workflow files
- prefer the repo's documented commands; in JavaScript or TypeScript repos, prefer `bun` commands over `npm`, `yarn`, or `pnpm` unless the repo clearly uses something else
- run the narrowest meaningful checks first, then broaden if needed
- record the exact commands you ran and the result, including concrete blockers when a command cannot run

Behavior-bearing milestone commits should usually trigger at least one executed verification command unless the environment or project setup makes that impossible.

**Verify by acceptance mode.** Each ticket carries one primary mode from Stage 4. The mode decides what proof you look for; Gherkin is one mode among nine, not the default.

| Mode | What you verify |
| :--- | :--- |
| `gherkin` | A test exists per scenario, each maps to its `Given` / `When` / `Then` steps, and the tests pass when you run them |
| `contract_test` | Assertions run against the artifact at the sidecar's `artifact_path`, not against a copy, and pass |
| `benchmark` | The harness exists, the threshold matches the evidence body and the PRD meter it cites, and a run you execute (or the run recorded in the commit body, when the environment cannot reproduce it) meets it |
| `stat_threshold` | The evaluation command, the named split, and the threshold match the evidence; the recorded metric meets it; the split was not changed to make it pass |
| `invariant` | The checker, property test, fuzz target, or proof encodes the stated invariant rather than a weaker one, and runs clean for the stated corpus or budget |
| `hitl_sil` | The procedure and pass/fail criteria are committed; the log meets them, or the hardware step is explicitly deferred to the user rather than silently skipped |
| `visual_regression` | The baseline is committed, the threshold matches the evidence, and the diff run is under it |
| `runbook_probe` | The apply, plan, and probe commands match the evidence, and the recorded end state matches the expected one |
| `live_probe` | The tests the mode requires pass, and the recipe named in `recipe` is the one `guidelines.md` declares. The evidence is captured once, at the review-clean head, so its absence at a milestone is not a finding; when it is present, it shows the state the ticket's scenario expects, not just a process that started |

A ticket whose proof is missing, or whose proof was produced by loosening the threshold, corpus, split, or baseline, fails acceptance and is a `P1`.

### Step 7 - Review Categories

Check every category that applies to what changed (Step 2):

#### Acceptance Criteria And Correctness
- Does the committed behavior satisfy the milestone tickets?
- Are edge cases, partial failures, retries, and null or empty states handled?
- Are affected call sites and interfaces updated coherently?

#### Upstream Fit
- When the milestone changed an artifact a sidecar points at: does the change still fit the sidecar and any `pinned` shape? When the sidecar's surface is published (an HTTP API, events, a CLI, a library, an SDK), is the change compatible under the compatibility ADR? A breaking change the ADR doesn't allow is a `P1`, and a change to a `pinned` contract is a `P1` unless the plan's amendments record it. The lead passes the plan file path so you can check.
- Did the milestone introduce a dependency, pattern, convention, or contract shape that no Stage 3 record names? If the epic file's closeout draft doesn't list it under `code_decisions`, file `Investigate` naming it, so the lead records it for the Stage 3 alignment pass.
- When the milestone adopted an interim assumption, is it written in the epic's `decisions` list with the places it was applied, and does the code match what the entry says?
- When the milestone touched a contract, schema, boundary, or capability whose certainty is `assumed`, did its tests exercise it so the closeout can list it under `settled`? If the tests could have settled it and the lead did not note it, file `General feedback`; if the milestone builds on an assumed record without exercising it at all, file `Investigate`.
- Does the milestone stay within `.constitution/prd/`, `.constitution/architecture/`, `.constitution/tech-spec/`, and the active epic under `.constitution/tasks/`?
- Does it invent missing contracts or change boundaries that should have been routed upstream?
- Does it preserve ticket IDs, capability mappings, and Brownfield continuity when present?
- When the repo defines a glossary (`.constitution/prd/glossary.yaml`), does new naming use its canonical terms rather than banned synonyms? Grep the diff for every banned synonym. A banned synonym replacing its canonical term on a domain-facing surface (contracts, schemas, migrations, UI copy, public API naming) is a `P1`; in internal locals or comments it is `General feedback`. A new domain concept introduced without a glossary entry is `Investigate`, with a note that the epic lead must list it under candidate glossary terms in the closeout delta so reconciliation routes it to Stage 1. Technical vocabulary (pool, worker, cache, handler) is not glossary material. Never require the commit to edit the glossary or `prd/changelog.md`; that would break the two-commit rule.

#### Tests, Lint, And CI
- Are relevant tests present for behavior changes?
- Do tests assert behavior independently, rather than mirroring the implementation? Audit test assertions to make sure they are checking actual behavior and outcomes—verify they are not "gaming the verification" with dummy checks or empty mocks.
- Were relevant tests, lint, typechecks, or builds run locally? Run the ticket's `Verification Command` (Epic mode) or the validation command the epic lead named (Issue mode) and confirm it succeeds, then apply the mode table in Step 6.
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

### Step 8 - Classify Findings

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
- evidence bookkeeping is `General feedback`: manifest wording, a verified-at commit older than HEAD, a SHA a rebase rewrote, or evidence not captured yet. Evidence that claims a pass that didn't happen, contradicts the code's behavior, or backs a `done` ticket whose `result` is `not_met` is a `P1`

### Step 9 - Return The Review

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
- mention verification commands you ran and blockers for any commands you could not run when relevant to the finding
- do not add a separate summary, approval, or filler outside the required format
