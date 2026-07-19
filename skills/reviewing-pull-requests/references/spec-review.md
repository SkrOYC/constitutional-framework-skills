# PR Review: Spec Axis

Review the pull request changes to ensure they faithfully implement Gherkin acceptance criteria, TechSpec contracts, correctness safeguards, and quality constraints without scope creep.

---

## 1. Reference Sources

*   **Active Epic Tickets:** Read the ticket definitions (acceptance criteria, description) in `.constitution/tasks/active/EPIC-*.md`.
*   **TechSpec Contracts:** Read the relevant interface contracts, schemas, and API rules under `.constitution/tech-spec/contracts/` or `.constitution/prd/capabilities.md`.
*   **Architecture & Product Requirements:** Read `.constitution/architecture/` (logical boundaries, communication patterns, components) and `.constitution/prd/` (product rules, capabilities).

### Constitutional Grounding Protocol
Every finding raised MUST be directly traceable to a rule, boundary, contract, or glossary entry defined under the `.constitution/` directory. You are strictly forbidden from inventing design requirements, conventions, or styling patterns not explicitly documented in the constitution or nearby repository patterns. When filing a finding, always cite the specific `.constitution/` file path (e.g. `.constitution/architecture/boundaries.md`) and quote the requirement or contract being violated.

---

## 2. Required Workflow

1.  **Extract Diff:** Use `gh pr view <number>` and `gh pr diff <number>` to get the PR changes.
2.  **Scope Management for Large PRs:** If the PR touches more than roughly 30 files or 1500 lines of diff, do not attempt to review everything in a single pass. Group changed files into logical batches (by module, concern, or database migrations) and review each batch sequentially.
3.  **Ground and Match Specifications:** Verify that every Gherkin acceptance criteria defined for the Epic's active tickets has been implemented, and that the changes strictly align with `.constitution/prd/` capabilities and `.constitution/architecture/` logical boundaries. **For each finding, quote the exact Gherkin criteria line, Architecture rule, or TechSpec contract/PRD capability line.**
4.  **Check Acknowledged Gaps:** Read the PR body and inline comments. Do **not** re-file findings that are explicitly documented as deferred scope (e.g. "follows in Epic Q") or design trade-offs explained by inline comments.
5.  **Check for Scope Creep:** Scan the diff for any behavior, endpoints, files, or state changes that were *not* requested by the active tickets or specifications. Highlight these as scope creep.
6.  **Audit Spec & Logic Categories:** Check the diff against the comprehensive correctness, security, performance, test, and data categories below.
7.  **Verification Command:** Run the active tickets' specific `Verification Commands` (e.g. `bun test --filter "orders"`) and confirm they succeed.
8.  **Audit Test Quality:** Read the newly added or modified test files. Verify that the assertions actually validate behaviors and are not dummy checks or empty mocks designed to bypass the gate. Ensure they check actual constitutional capabilities.

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
- `P1`: Meaningful missing Gherkin specs or API contract deviations.
- `P2`: Scope creep, minor logic gaps, or performance/verification issues.
- `Investigate`: Potential contract deviations requiring confirmation.
- `General feedback`: General implementation notes on spec alignment.

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
