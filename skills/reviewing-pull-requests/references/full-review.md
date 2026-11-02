# Full PR review

Review the complete GitHub PR as a change to a real codebase. Apply the router's evidence, revision, verification, and authority rules. This workflow is for a PR review, not implementation, loose snippets, or a repository-wide audit.

## Capture the candidate

Use `gh` unless the caller supplied a verified offline snapshot. Collect the core metadata and diff:

```sh
gh pr view <number> --json number,url,title,body,author,baseRefName,headRefName,baseRefOid,headRefOid,changedFiles,files,commits,comments,reviews,closingIssuesReferences
gh pr diff <number>
gh pr view <number> --json statusCheckRollup
```

Read every explicitly referenced issue, including its comments, using `gh issue view <number-or-url> --json number,url,title,body,state,comments`. An unavailable required issue or incomplete diff blocks full coverage. Optional check metadata can be unavailable; disclose that limit.

Confirm the checkout's HEAD equals the captured head and tracked files are clean. Compute the merge base from the captured base/head. Verify the inventory against the complete local delta. If the hosting API truncates the diff, use `git diff <merge-base> <head>` when the captured objects are available and record the source. The caller must supply missing objects before review; do not substitute a nearby revision.

Recheck base/head after collection and before accepting the review. Changed revisions invalidate affected evidence. Retain source and metadata capture identities so the reviewed candidate is clear.

## Match the review to the change

Classify the changed surfaces and choose applicable checks:

- *Constitution only:* Follow the documents workflow. Related stage changes can share a coherent PR. Each stage retains decision ownership, and upstream repairs use the authorized owning-stage route.
- *Other documents:* Verify accuracy against code, command signatures, paths, diagrams, and claimed behavior. Code execution is needed only when it settles an affected claim.
- *Code:* Follow this workflow with relevant acceptance and operational evidence.
- *Mixed:* Review each surface by its rules and check their combined behavior. Code and spec changes can share a PR in separate commits. Inspect the sequence so code is judged against the applicable authorized spec, rather than excused by a rewritten requirement in the same commit.

Inspect commit and milestone evidence as useful inputs. Still account for the full cumulative delta, integration with the captured base, cross-milestone interactions, and the final PR description. No changed surface is exempt merely because a milestone reviewer saw it earlier.

## Establish claims and risk

Read the PR, issues, active tickets, relevant contracts, and governing decisions. If the PR claims issue closure, verify the complete requested behavior and any assumption required for closure.

Identify the safety assumptions most likely to fail. Trace surrounding code, callers, callees, interfaces, configuration, migrations, and retained observations far enough to decide them. A one-line interface change can require more investigation than a larger isolated utility. Follow lockfile or generated changes when they affect the claim; do not produce nits about generated formatting.

For a broad delta, investigate coherent batches ordered by risk and finish with an integration pass over their interactions. File counts and line counts are planning guides, not escalation triggers. If coverage is incomplete, name the unreviewed surfaces and the resulting limit.

## Assess evidence and acknowledged decisions

Inspect recorded verification by candidate and input identity, command, environment, outcome, and coverage. Use the change-type proof guidance in the router. Run the narrowest meaningful check for absent, invalidated, unreliable, uncovered, or required proof. Do not rerun every check because the reviewer changed. Coordinate runtime use with its owner and keep the supplied checkout read-only.

For ticket acceptance, read its declared mode and evidence body. Gherkin is one mode, not a universal test requirement. Inspect observations that substantiate the claim; manifest validation establishes declared file existence and digests, not behavior. A false pass, contradictory result, or required failed/missing proof remains an acceptance defect. Older verified-at evidence is historical; evaluate whether its inputs cover this candidate.

Read deferred scope, accepted tradeoffs, existing obligation owners, and reasoned dismissals before filing findings. Do not re-file an accepted preference as a defect. If a deferral leaves a concrete correctness or acceptance defect, explain the affected behavior and why the accepted ruling does not cover it. A nearby comment can identify intent, but cannot prove the safety assumption.

Compare the cumulative change with ticket scope, owned paths, contracts, and authorized deviations. Routine implementation adaptations within the approved envelope do not require a new wave amendment. Flag real scope expansion or out-of-authority changes with their consequence, rather than treating every incidental file as a blocker.

## Investigate applicable categories

Use these questions to direct investigation, not as a quota or automatic refactor list:

- *Correctness and closure:* Does the integrated behavior satisfy the PR, issue, and acceptance claims? Check relevant boundaries, empty states, partial failures, retries, and call-site compatibility.
- *Security and permissions:* Are authentication, authorization, trust boundaries, and ownership preserved? Can untrusted input cross an interpreter boundary or expose sensitive data?
- *Data and compatibility:* Does the actual contract artifact remain compatible? Can representative stored data, clients, rollouts, and recovery paths preserve required invariants?
- *Concurrency and lifecycle:* What owns shared state and resources? Check ordering, transactions, cancellation, idempotency, cleanup, and competing execution.
- *Performance:* Is there a demonstrated workload, complexity, query, allocation, payload, or contention regression? A pattern such as nested loops or missing caching needs an actual consequence.
- *Verification:* Do assertions observe meaningful public behavior? Does existing coverage address the important regression risk? Missing isolated unit tests alone is not a finding.
- *Operability:* Can required failure states be diagnosed with the project's logs, metrics, traces, or runbooks? Do not invent a telemetry project.
- *Maintainability and standards:* Is the changed code locally coherent and compliant with project rules? Investigate smells before recommending abstraction or comments.
- *Domain language:* Use canonical glossary terms where applicable. Route a real new domain concept to its owning stage through the closeout; do not demand an unauthorized code-commit edit to `prd/`.

Apply the owner's required gates and contribution policy. Treat failing checks as evidence to investigate, not a substitute for code analysis. Do not invent remote tests or arbitrary CI green as universal review conditions.

## Classify and return findings

Use the smallest supported severity:

- `P0`: Severe correctness, security, data-loss, or production-breakage risk.
- `P1`: A meaningful bug, broken acceptance or issue closure, or serious operational risk.
- `P2`: A smaller concrete correctness, quality, user-facing, or maintenance defect.
- `Investigate`: A grounded unresolved question with a concrete evidence path.
- `General feedback`: Useful non-blocking feedback tied to the change.

Do not classify preference-only refactors or style nits as bugs. Source-based proof can establish a bug without executing it; state the trigger, path, and consequence. Missing runtime access limits acceptance evidence, not the validity of a decisive source trace.

A stale evidence label is bookkeeping. A `done` ticket with failed or absent required proof, a `live_probe` acceptance claim without its required manifest/result, a false pass, contradictory observations, or invalid framework data is a `P1`. Evidence not yet required by the execution stage is not missing acceptance proof.

Return findings in this order, omitting empty subsections:

```md
## Potential Bugs

### P0
path:line-range
Trigger, evidence, consequence, and relevant requirement.

### P1
path:line-range
Trigger, evidence, consequence, and relevant requirement.

### P2
path:line-range
Trigger, evidence, and consequence.

## Flags

### Investigate
path:line-range
Concrete question, evidence available, and the check that can decide it.

### General feedback
path:line-range
Useful non-blocking observation tied to the change.
```

Include the router's completion fields: reviewed base/head and optional `since`, coverage and gaps, acceptance limits, and verification inspected or run. State explicitly when no findings remain. A review response is not merge authorization.
