# PR Review: Spec Axis

Review the pull request changes to ensure they faithfully implement Gherkin acceptance criteria, TechSpec contracts, correctness safeguards, and quality constraints without scope creep.

---

## 1. Reference Sources

*   **Active Epic Tickets:** Read the ticket definitions (acceptance criteria, description) in `.constitution/tasks/epics/EPIC-*.yaml`.
*   **TechSpec Contracts:** Read the sidecars under `.constitution/tech-spec/contracts/` and `.constitution/tech-spec/data-models/`, then the artifacts they point at in the code through `artifact_path` (legacy repositories may still keep the artifact next to its sidecar), plus any `pinned` shape and the compatibility ADR.
*   **Architecture & Product Requirements:** Read `.constitution/architecture/` (logical boundaries, communication patterns, components) and `.constitution/prd/` (product rules, capabilities).
*   **Ubiquitous Language:** Read `.constitution/prd/glossary.yaml`. Canonical terms are binding across code identifiers, contracts, migrations, UI copy, and docs; the "Do not use" column lists banned synonyms. A banned synonym is banned only as a replacement for its canonical term — the same word may legitimately name a distinct concept.

### Constitutional Grounding Protocol
Every finding must trace to a rule, boundary, contract, or glossary entry under `.constitution/` or to a convention visible in nearby repository code; a finding that rests on a requirement you invented is not a finding. Cite the specific `.constitution/` file path (for example `.constitution/architecture/boundaries.md`) and quote the requirement or contract being violated.

---

## 2. Required Workflow

1.  **Extract Diff:** Use `gh pr view <number>` and `gh pr diff <number>` to get the PR changes.
2.  **Match the Review to What Changed:**

    Classify the changed files before choosing what to check: application code, tests, configuration and tooling, `.constitution/` documents, other documentation. Review what the PR actually touches.

    - **`.constitution/`-only PR.** This is a document review against the framework rules: each directory decides only what its stage owns and never repairs an upstream directory; naming uses the glossary's canonical terms; every touched directory gets a SemVer bump and a changelog entry; versions, counts, ticket IDs, and cross-references agree across files; Mermaid diagrams and links resolve; and any downstream directory the change makes stale is either updated or explicitly flagged. Skip the Section 3 categories and the Verification Command; check Gherkin criteria only when the PR changes tickets. Verification here means confirming that referenced paths exist and diagrams parse.
    - **Other docs-only PR** (README, guides, comments): check accuracy against the code, stale commands, and dead links or paths. Skip the Section 3 categories and the Verification Command; check Gherkin criteria only when the PR changes tickets.
    - **Code PR.** Run the full workflow.
    - **Mixed PR.** Review each part by its own rules, and check that the code matches the constitution changes shipped with it.

    Findings for documents use the same classification and format as code findings, with `path:line-range` pointing into the document.

3.  **Scope Management for Large PRs:** If the PR touches more than roughly 30 files or 1500 lines of diff, do not attempt to review everything in a single pass. Group changed files into logical batches (by module, concern, or database migrations) and review each batch sequentially.
4.  **Ground and Match Specifications:** Verify that every Gherkin acceptance criteria defined for the Epic's active tickets has been implemented, and that the changes strictly align with `.constitution/prd/` capabilities and `.constitution/architecture/` logical boundaries. **For each finding, quote the exact Gherkin criteria line, Architecture rule, or TechSpec contract/PRD capability line.**
5.  **Check Acknowledged Gaps:** Read the PR body and inline comments. Do **not** re-file findings that are explicitly documented as deferred scope (e.g. "follows in Epic Q") or design trade-offs explained by inline comments.
6.  **Check for Scope Creep:** Scan the diff for any behavior, endpoints, files, or state changes that were *not* requested by the active tickets or specifications. Highlight these as scope creep.
7.  **Glossary Conformance Pass:** Check every new or renamed identifier, contract/schema field, migration object, UI string, and doc phrase in the diff against `.constitution/prd/glossary.yaml`. A banned synonym replacing its canonical term on a domain-facing surface (contracts, schemas, migrations, UI copy, public API naming) is a `P1`; in internal locals or comments it is `General feedback`. A new domain concept introduced without a matching glossary entry is `Investigate`: in an epic PR the lead lists it under candidate glossary terms in the closeout so reconcile routes it to Stage 1, since a code PR may not edit `prd/` (the two-commit rule).
8.  **Audit Spec & Logic Categories:** Check the diff against the comprehensive correctness, security, performance, test, and data categories below.
9.  **Verification Command:** Run the active tickets' specific `Verification Commands` (e.g. `bun test --filter "orders"`) and confirm they succeed.
10. **Audit Test Quality:** Read the newly added or modified test files. Verify that the assertions actually validate behaviors and are not dummy checks or empty mocks designed to bypass the gate. Ensure they check actual constitutional capabilities.

---

## 3. Spec & Logic Review Categories

### A. Correctness & Logic
*   **Error Handling:** Check for swallowed exceptions, empty catch blocks, or missing error states in UI elements.
*   **Async Hazards:** Unawaited promises, race conditions on shared state, or missing cancellation/cleanup (stale closures, listeners never removed).
*   **Null/Undefined Flows:** Non-null assertions (`!`) on values that can be null, optional chaining hiding a value that must exist, or unchecked array indexing.
*   **Concurrency:** Check-then-act on shared resources, missing transactions around multi-write operations, or webhook/queue retry idempotency.
*   **Boundary Conditions:** Off-by-one, empty-collection handling, timezone/locale assumptions.

### B. Security & Permissions
*   **Access Control:** Ensure endpoints and server actions enforce authentication and authorization. Check for IDOR (object access by ID without ownership checks).
*   **Input Validation:** Validate or encode untrusted input before crossing interpreter boundaries (SQLi, command injection, XSS, path traversal).
*   **Data Minimization:** Ensure PII or sensitive operational data is not leaked in logs or error stack traces.

### C. Performance & Resource Behavior
*   **N+1 Patterns:** Check for queries or fetches issued inside loops or list-row rendering.
*   **Complexity:** Nested scans over collections where a Map lookup belongs.
*   **Caching & Payload size:** Caching gaps on stable data, missing pagination on unbounded lists, or over-fetching columns (`select *`).

### D. Data, Migrations & Compatibility
*   **Schema Modifications:** If schemas/contracts change, ensure old running clients don't break and migrations have safe rollback logic.
*   **State Invariants:** Ensure state transitions respect database invariants.

---

## 4. Findings & Classifications

Classify and return findings in this exact format:
- `P0`: Severe contract/spec violations, security vulnerabilities, or logic bugs.
- `P1`: Meaningful missing Gherkin specs, API contract deviations, or ubiquitous-language violations on domain-facing surfaces.
- `P2`: Scope creep, minor logic gaps, or performance/verification issues.
- `Investigate`: Potential contract deviations requiring confirmation.
- `General feedback`: General implementation notes on spec alignment.

<output_format>

```markdown
## Spec Findings

### P0
path:line-range
[Description of severe spec violation or logic bug, quoting the spec line]

### P1
path:line-range
[Description of missing Gherkin criteria or contract deviation, quoting the spec line]

### P2
path:line-range
[Description of logic gaps, performance issues, or unauthorized scope edits]

### Investigate
path:line-range
[Description of the potential spec deviation requiring confirmation]

### General feedback
path:line-range
[General notes on spec alignment]
```

</output_format>
