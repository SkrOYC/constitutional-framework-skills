# Spike report: OWNER_ID TOPIC_NAME

## Effort budget

- **Budget:** the `Effort` value of the spike ticket, or the budget the interview agreed for a decision-owned spike (at most `3`), in story points (`1`, `2`, `3`, `5`, or `8`); the research stops when the question is answered or the budget is spent, whichever comes first
- **Spent:** fill during execution, in the same units, with one line on what was cut if the budget ran out

## Question

- **Owner:** the `Spike` ticket id, or the register entry id when an open decision owns it
- **Decision this spike must produce:** one concrete question whose answer can change dependent implementation
- **Enough evidence:** the observation that answers the question; stop when it is obtained or the budget is spent

## Context and objective

- **Triggering upstream file or section:** for example, `.constitution/tech-spec/data-models/orders.meta.yaml` or `.constitution/tech-spec/adrs/ADR-0003-persistence-engine.md`
- **Target:** the exact technical boundary, integration protocol, invariant, or performance metric under investigation
- **Archetype / surface:** which product surface this affects (so the recommendation stays in-family)

## Codebase baseline

- **State today:** factual findings from direct workspace or codebase inspection
- **Discovered constraints:** real constraints, dependency boundaries, or structural risks identified

## Decisive pilot or probe

- **Revision and environment:** the candidate and relevant runtime, service, device, or dataset
- **Public interface and command:** the cheapest executable path that distinguishes the options or tests the assumption; reuse coverage when it already answers the question
- **Expected observation:** success, failure, threshold, or invariant that changes the decision
- **Observed result:** concise evidence and its run or artifact reference; disclose unavailable execution and inconclusive results

## Options and trade-offs

- Compare only the alternatives the decision needs, against observed constraints and measurements. Avoid exhaustive speculative contracts or implementation detail.

## Recommendation

- **Chosen option:** the recommended option to proceed with (or "no change" / "needs Stage N Evolution")
- **Why it fits:** reasoning tied to PRD constraints and architecture boundaries; why this choice minimizes downstream debt
- **Rejected options:** one line each on why not

## Downstream impact

- **ADRs to write or update:** paths or "none"
- **Tickets unblocked:** exact implementation ticket ids in the epic file, or "none" for a decision-owned spike
- **Work still held:** only the dependents the evidence doesn't unblock; unrelated work can continue
- **Register entry closed:** the open decision id this spike rules and the option chosen, or "none"
- **Tickets to add or split:** if the answer changes scope of work
- **Spec edits required:** name Stage 3 (or earlier) if the active specs must change; the spike never edits them; the epic lead raises a blocker for the owning stage
