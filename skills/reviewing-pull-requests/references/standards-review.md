# Standards review

Review the PR's conformance to binding project standards and the practical consequences of its structure, applying the router's candidate, evidence, verification, and completion rules. This mode covers the standards axis; do not imply it establishes full PR correctness.

## Read the governing standards

Read the relevant `.constitution/tech-spec/guidelines.md` rules, architecture boundaries, repository instructions, and nearby code conventions. Inspect the complete candidate, issue context, PR decisions, and authorized deviations through `gh` or the offline snapshot. Cite the actual rule a finding depends on, and do not invent a convention because a familiar pattern seems preferable.

Match investigation to the changed surfaces. Documents need accurate instructions, stage ownership, canonical terms, valid references, and coherent downstream claims; do not apply code smells to prose or run code gates without a relevant claim.

## Investigate structural signals

Fowler smell names describe questions, not defects or prescribed repairs. Skip matters settled by valid automated checks or accepted governing policy. Investigate a signal only when the changed code gives it a concrete consequence:

| Signal | Question to decide |
| :--- | :--- |
| Mysterious name | Does ambiguity conceal a contract, state, or caller mistake? |
| Duplicated code | Must these copies evolve together, and is there evidence they already disagree? |
| Feature envy | Does data access break ownership or invariants, or is this the right orchestration boundary? |
| Data clumps | Do the values form one invariant-bearing concept, or are they independent inputs? |
| Primitive obsession | Can an invalid domain value cross a real boundary that a type would protect? |
| Repeated switches | Can the cases drift, or does explicit branching preserve a useful local contract? |
| Shotgun surgery | Does one behavior require coordinated edits that are likely to be missed? |
| Divergent change | Do unrelated responsibilities interfere or create conflicting dependencies? |
| Speculative generality | Does unused flexibility add concrete complexity, risk, or unsupported behavior? |
| Message chains | Is the caller coupled to internal ownership that is likely to break its contract? |
| Middle man | Does delegation preserve a boundary or obscure behavior and errors? |
| Refused bequest | Does an implementation violate its substitutability or inherited contract? |

Do not recommend extraction, polymorphism, a wrapper type, or composition merely because a smell name fits; explain the failure or maintenance consequence and assess the cost of changing the design.

## Check applicable standards

- *Layout and boundaries:* Are changed files in the required locations? Do dependencies preserve declared boundaries and allowed import directions?
- *Patterns and interfaces:* Do error handling, state ownership, data access, and exported signatures match binding conventions or a justified deviation?
- *Operability:* Do affected critical paths retain required diagnostic signals without leaking sensitive data? Do not demand unrelated logs or telemetry.
- *Tooling:* Do types, generated artifacts, configuration, and checks preserve the project's workflow and supported environment?
- *Comments and contracts:* Intent belongs in names, types, structure, and invariants; ordinary comments are rare, with TSDoc-style contracts and license headers exempt. Do not request reassuring comments.
- *Verification:* Prefer meaningful public-interface checks and reusable evidence. Missing unit tests alone is not a standards violation; do not impose a test quota or repeat valid lint/type results because the reviewer changed.
- *Scope:* Distinguish routine adaptations within the approved envelope from actual scope expansion or shared-contract changes that need owning authority.

For a broad delta, investigate coherent batches, then their interactions. Size alone does not establish a defect or require more reviewers. Record uncovered scope.

## Return findings

Use the smallest supported severity:

- `P0`: A severe standards violation with demonstrated security, data-loss, or production risk.
- `P1`: A meaningful binding-rule or boundary violation with concrete consequences.
- `P2`: A smaller demonstrated structural or maintenance defect.
- `Investigate`: A grounded standards question and the evidence needed to decide it.
- `General feedback`: A non-blocking observation; a smell name alone is at most a prompt to investigate.

Accepted style tradeoffs resolve preference concerns but do not excuse a proven defect.

Return the router's completion fields and findings in this format, omitting empty subsections:

```md
## Standards Findings

### P0
path:line-range
Rule, evidence, and severe consequence.

### P1
path:line-range
Rule, evidence, and consequence.

### P2
path:line-range
Concrete structural defect and consequence.

### Investigate
path:line-range
Question and decisive evidence needed.

### General feedback
path:line-range
Non-blocking observation tied to the change.
```
