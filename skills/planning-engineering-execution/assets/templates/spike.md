# Spike report: OWNER_ID TOPIC_NAME

## Effort budget

- **Budget:** the `Effort` value of the spike ticket, or the budget the interview agreed for a decision-owned spike (at most `3`), in story points (`1`, `2`, `3`, `5`, or `8`); the research stops when the question is answered or the budget is spent, whichever comes first
- **Spent:** fill during execution, in the same units, with one line on what was cut if the budget ran out

## Question

- **Owner:** the `Spike` ticket id, or the register entry id when an open decision owns it
- **Decision this spike must produce:** one concrete question the implementation backlog cannot answer safely yet

## Context and objective

- **Triggering upstream file or section:** for example, `.constitution/tech-spec/data-models/orders.meta.yaml` or `.constitution/tech-spec/adrs/ADR-0003-persistence-engine.md`
- **Target:** the exact technical boundary, integration protocol, invariant, or performance metric under investigation
- **Archetype / surface:** which product surface this affects (so the recommendation stays in-family)

## Codebase baseline

- **State today:** factual findings from direct workspace or codebase inspection
- **Discovered constraints:** real constraints, dependency boundaries, or structural risks identified

## Options and trade-offs

- Option A against option B (add C if needed), with concrete solo-dev parameters, or raw benchmark / measurement results when the spike is measurement-bounded

## Recommendation

- **Chosen option:** the recommended option to proceed with (or "no change" / "needs Stage N Evolution")
- **Why it fits:** reasoning tied to PRD constraints and architecture boundaries; why this choice minimizes downstream debt
- **Rejected options:** one line each on why not

## Downstream impact

- **ADRs to write or update:** paths or "none"
- **Tickets unblocked:** exact implementation ticket ids in the epic file, or "none" for a decision-owned spike
- **Register entry closed:** the open decision id this spike rules and the option chosen, or "none"
- **Tickets to add or split:** if the answer changes scope of work
- **Spec edits required:** name Stage 3 (or earlier) if the active specs must change; the spike never edits them; the epic lead raises a blocker for the owning stage
