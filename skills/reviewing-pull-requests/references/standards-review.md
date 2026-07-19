# PR Review: Standards Axis

Review the pull request changes against the project's coding standards, Fowler code smells, and cross-cutting structural guidelines.

---

## 1. Reference Sources

*   **Project Guidelines & Architecture:** Read the project's `.constitution/tech-spec/guidelines.md` (coding standards, project structure, module layout) and structural rules in `.constitution/architecture/` (logical boundaries, modular seams). These are the primary standards.
*   **Smell Baseline:** Scans for Fowler code smells (each smell is a labeled heuristic / judgement call, never a hard violation, and you must skip anything automatic tooling already enforces):
    *   **Mysterious Name** — A function, variable, or type whose name doesn't reveal what it does or holds. -> *Fix: Rename it; if no honest name comes, the design is murky.*
    *   **Duplicated Code** — The same logic shape appears in more than one hunk or file in the change. -> *Fix: Extract the shared shape, call it from both.*
    *   **Feature Envy** — A method that reaches into another object's data more than its own. -> *Fix: Move the method onto the data it envies.*
    *   **Data Clumps** — The same few fields or parameters keep travelling together (a type wanting to be born). -> *Fix: Bundle them into one type, pass that.*
    *   **Primitive Obsession** — A primitive or string standing in for a domain concept that deserves its own type. -> *Fix: Give the concept its own small type.*
    *   **Repeated Switches** — The same `switch` or `if`-cascade on the same type recurs across the change. -> *Fix: Replace with polymorphism, or a shared map.*
    *   **Shotgun Surgery** — One logical change forces scattered edits across many files in the diff. -> *Fix: Gather what changes together into one module.*
    *   **Divergent Change** — One file or module is edited for several unrelated reasons. -> *Fix: Split so each module changes for one reason.*
    *   **Speculative Generality** — Abstraction, parameters, or hooks added for future needs the spec doesn't have. -> *Fix: Delete it; inline back until a real need shows.*
    *   **Message Chains** — Long `a.b().c().d()` navigation the caller shouldn't depend on. -> *Fix: Hide the walk behind one method on the first object.*
    *   **Middle Man** — A class or function that mostly just delegates onward. -> *Fix: Cut it, call the real target direct.*
    *   **Refused Bequest** — A subclass or implementer that ignores or overrides most of what it inherits. -> *Fix: Drop the inheritance, use composition.*

*Note: In-project guidelines in `guidelines.md` always override these baseline smells; where they endorse something the baseline would flag, suppress the smell. Always treat baseline smells as judgement calls.*

### Constitutional Grounding Protocol & Decision Acknowledgment
Every finding raised MUST be directly traceable to a rule, boundary, or guideline defined under the `.constitution/` directory. You are strictly forbidden from inventing design requirements, styling patterns, or conventions not explicitly documented in the constitution or nearby repository patterns. 

Furthermore, read the PR body and surrounding code comments carefully. Do NOT file findings (P2s or Investigate flags) for design choices or styling deviations that are already explicitly explained by nearby inline comments or the PR body. The comment/PR body description resolves the concern.

---

## 2. Required Workflow

1.  **Extract Diff:** Use `gh pr view <number>` and `gh pr diff <number>` to get the changes.
2.  **Scope Management for Large PRs:** If the PR touches more than roughly 30 files or 1500 lines of diff, do not attempt to review everything in a single pass. Group changed files into logical batches (by module, concern, etc.) and review each batch sequentially.
3.  **Scope Verification:** Check if any changed files fall outside the cumulative `Scope (In-Scope Files)` of the PR's Epic tickets in `.constitution/tasks/active/`. If they do, verify if there is an accompanying justification entry under `##### [TICKET_ID] Deviations & Justifications` in the active Epic task files or in the PR body. If no justification exists, flag it as an unexplained scope deviation (P2).
4.  **Audit Standards Categories:** Audit the diff against the comprehensive categories defined below.
5.  **Run Verification:** Run the project's linting/typecheck commands (e.g. `bun run lint` or `tsc --noEmit`) to verify correctness.

---

## 3. Standards Review Categories

### A. Project Guidelines & Layout Consistency
*   Verify that the code conforms to the exact monospaced project structure in `guidelines.md`.
*   Ensure files and assets are written to their designated locations (no ad-hoc/out-of-place file additions).

### B. Maintainability, Layering & Seams
*   **Layering Violations:** Ensure UI layers do not import database/data layer internals directly. Check for circular dependencies.
*   **Module Size & Focus:** Identify "God modules" or files that are exceptionally large. Ensure modules present a small interface that hides internal complexity.
*   **Pattern Consistency:** Ensure the patterns used for error handling, data fetching, or state management match the conventions established recently in nearby code.

### C. Observability, Operability & Logging
*   **Log Structure:** Ensure logs are structured and do not leak PII or private metadata.
*   **Context Tracing:** Check that critical execution paths pass correlation IDs or request contexts.
*   **Signal Sufficiency:** Verify that operators will have enough log/metric signals to diagnose failure states on critical paths.

### D. DX & Tooling
*   Ensure type definitions and exported signatures are clean, documented, and do not introduce compiler/IDE latency.

---

## 4. Findings & Classifications

Classify and return findings in this exact format:
- `P0`: Severe guideline violations, security risks, or production blockers.
- `P1`: Meaningful guidelines or layering violations.
- `P2`: Valid design/smell issues (Fowler code smells) or missing scope justifications.
- `Investigate`: Potential guidelines deviations requiring confirmation.
- `General feedback`: Style nitpicks or noted deviations.

```markdown
## Standards Findings

### P0
path:line-range
[Description of the severe guidelines or security blocker]

### P1
path:line-range
[Description of the guidelines or layering violation]

### P2
path:line-range
[Description of the Fowler code smell or design gap, with a suggested fix]

### Investigate
path:line-range
[Description of the potential standards deviation requiring confirmation]

### General feedback
path:line-range
[Nitpicks or noted deviations]
```
