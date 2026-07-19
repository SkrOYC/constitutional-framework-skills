---
name: planning-engineering-execution
description: "Stage 4 of the four-document constitutional framework. Converts .constitution/tech-spec/ files into an ordered .constitution/tasks/ execution constitution: atomic tickets, effort, dependencies, risk spikes, and Gherkin acceptance criteria. Use when breaking approved implementation work into an execution plan or revising the build plan for a new delta."
metadata:
  family: ai-project-constitutional-framework
  stage: "4"
  artifact: ".constitution/tasks/"
  upstream: ".constitution/tech-spec/ | .constitution/architecture/"
---

# Planning Engineering Execution

Stage 4 of the **AI Project Development Framework**.

Together, these skills form the **constitutional framework**: a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Immediately load `references/framework-constitution.md` before performing stage work.

## 1. Overview

Convert the physical contract schemas, data models, and guidelines under `.constitution/tech-spec/` into an executable, dependency-ordered engineering backlog distributed across modular files under `.constitution/tasks/`.

This skill owns the **task planning layer**. It decomposes the approved technical specification into atomic implementation tickets, assigns effort estimates, maps the build dependency graph, identifies the critical path, and writes testable Gherkin acceptance criteria for each ticket.

## 2. When to Use

Use this skill when:
- you want to write or revise a task plan, implementation plan, or engineering backlog
- you have a completed technical specification and need the engineering backlog sequenced
- you need implementation work divided into atomic tickets with explicit dependencies and estimates
- you want to write strict, testable acceptance criteria in Gherkin form
- you need to revise the build plan to accommodate a new scope delta or next iteration phase

Do not use this skill to write physical database schemas, define API contracts, choose architectural patterns, or redefine product requirements.

## 3. Required Inputs & Context Assembly

Gather the best available inputs to assemble your active memory:
1.  **Upstream Context:** Read the entire active Stage 1, 2, and 3 directories (`.constitution/prd/*.md`, `.constitution/architecture/**/*.md`, and `.constitution/tech-spec/**/*.md`). Treat the physical schemas, API contracts, and implementation guidelines defined there as binding requirements.
2.  **Codebase Reality:** In Brownfield or Evolution mode, inspect the repository and issue tracker directly. Ensure your ticket numbering, active epic scopes, and branch choices match existing patterns.
3.  **Active Chat History:** Read the active conversation history. If any planning decisions, epic boundaries, or task sequence dependencies have already been discussed or decided, natively extract and apply them to the drafted files. Do not revert to default assumptions for those items.

## 4. Layer Boundaries

### Allowed Decisions
- Ticket granularity (sized for 1-3 days of focused solo-dev execution)
- Epic grouping and alphabetical letter assignments
- Backlog sequence, dependency order, and the critical path
- Effort estimation using the allowed Fibonacci scale (`1, 2, 3, 5, 8`)
- Identifying where a `Spike` ticket is required before implementation begins
- Writing concise descriptions and strict Gherkin acceptance criteria for each ticket
- Separating active scope from future/deferred scope

### Forbidden Decisions
- Naming physical frameworks, languages, databases, or cloud vendors
- Redefining API endpoints, JSON structures, or code-level contracts (if a contract is missing, halt and trigger a Stage 3 TechSpec pass)
- Selecting or modifying the technical stack

## 5. Output Contract & Decomposition

Produce or modify the following files inside `.constitution/tasks/`. Do not append disconnected fragments; integrate all changes cleanly to preserve reader flow.

### 1. `.constitution/tasks/critical-path.md`
*   **0. Version:** Declares the current Stage 4 SemVer (corresponds to the latest entry in `.constitution/tasks/changelog.md`).
*   **Active Backlog Summary:**
    *   **Total Active Story Points:** Cumulative sum of active ticket estimates. Do not count completed or deferred epics.
    *   **Critical Path:** Numbered list of ticket IDs in their required execution order.
*   **Build Order Diagram:** A `flowchart LR` Mermaid graph showing dependency edges across active epics. Each node is a ticket ID; arrows express "depends on". Only active tickets participate; completed and deferred tickets are excluded.
*   **Phasing Strategy:** Defines what outcomes are actively covered in the current phase, and what is deferred to future scope.

### 2. `.constitution/tasks/changelog.md`
*   **Local Stage 4 Changelog:** Tracks local SemVer changes (`vX.Y.Z`) for Stage 4. This file is allowed to grow chronologically to preserve the full history of Stage 4 iterations.

### 3. `.constitution/tasks/active/` (Directory)
*   **Active Epics:** Write exactly one markdown file per active Epic: `.constitution/tasks/active/EPIC-[EPIC_LETTER]-[epic-name].md` (e.g., `EPIC-A-auth-foundation.md`).
*   **Format per ticket within an Epic file:**
    ```markdown
    #### [ACRONYM]-[EPIC_LETTER][TICKET_NUMBER] Ticket Title
    - **Type:** Feature | Chore | Spike | Security
    - **Effort:** 1 | 2 | 3 | 5 | 8
    - **Dependencies:** [IDs or None]
    - **Category:** [Correctness | Security | Perf | Tech-Debt | Dependency-Upgrade | DX | Docs | Feature-Evolution]
    - **Scope (In-Scope Files):**
      - `path/to/file.ts`
    - **Scope (Out-of-Scope Files):**
      - `path/to/unrelated-file.ts` (do not touch)
    - **Verification Command:** `bun test --filter "module-name"` (exact verification command from this repo)
    - **Expected Success Output:** `exit 0`
    - **STOP Conditions:**
      - "STOP if [X condition] occurs; do not improvise."
    - **Description:** [Concise summary of what to build at the behavioral level; no code snippets]
    - **Acceptance Criteria (Gherkin):**
    ```gherkin
    Given [state]
    When [action]
    Then [outcome]
    ```
    ```
*Ticket ID Example:* `AUTH-A001` (Acronym is `AUTH`, Epic is `A`, Ticket is `001`).

### 4. `.constitution/tasks/completed/` (Directory)
*   **Archived Epics:** This directory contains completed Epic files. The active critical path and active build graph are computed from active work only; completed epics do not contribute to active story point totals.

## 6. The Spike Protocol

When a backlog item requires a feasibility spike or performance report:
1.  Add a ticket of type `Spike` to the active epic list.
2.  Copy the master Spike template from `assets/templates/spike.md` (relative to this skill's root directory) to create the placeholder file: `.constitution/spikes/SPK-[TICKET_ID].md` (e.g., `SPK-A001.md`).
3.  The planning phase is satisfied by establishing this path; the actual research documentation belongs to the execution phase. No production code changes are allowed inside a Spike ticket.

## 7. Brownfield Constitution Maintenance

Before adding or reshaping active work in a Brownfield repository, you must audit the `.constitution/` directory tree for planning debt. Reconcile these items before drafting new tickets:
- Active story point totals, critical paths, and Mermaid build order graphs must exclude completed or deferred work.
- Completed epics must reside in the `completed/` folder rather than the `active/` folder before planning new work.
- Technical specs (`guidelines.md` or `stack.md`) must be reviewed for alignment if implementation reality drifted from the written specs during the previous epic.

## 8. Validation Checklist

Before declaring Stage 4 complete, verify all of the following:
- [ ] Every ticket is atomic enough for focused, independent, solo-dev execution.
- [ ] Every dependency is explicit, directionally correct, and contains no circular relationships.
- [ ] The Build Order Mermaid graph matches the dependencies declared in the active ticket list.
- [ ] Ticket effort values use ONLY `1, 2, 3, 5, 8`. No un-estimated tickets are allowed in active scope.
- [ ] Every ticket has explicit, testable acceptance criteria in valid Gherkin syntax.
- [ ] Spikes are planned as separate tickets and point to their designated `.constitution/spikes/` placeholder files.
- [ ] Completed epics are situated under the `completed/` folder.
- [ ] Active story points and critical paths are calculated strictly from the active ticket directory.
- [ ] No implementation ticket requires the agent to invent missing upstream contracts, schemas, or APIs.
- [ ] The local changelog `.constitution/tasks/changelog.md` has been updated with the current SemVer bump.
