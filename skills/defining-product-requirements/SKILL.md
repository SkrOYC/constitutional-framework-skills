---
name: {{ skill_name }}
description: "{{ skill_description }}"
metadata:
  family: ai-project-constitutional-framework
  stage: "1"
  artifact: ".constitution/prd/"
  upstream: "user-intent | existing-codebase"
---

# Defining Product Requirements

Stage 1 of the **AI Project Development Framework**.

Together, these skills form the **constitutional framework**: a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Immediately load `references/framework-constitution.md` before performing stage work.

## 1. Overview

Convert raw product intent or an existing codebase into a rigorous, technology-agnostic product spec distributed across modular files under `.constitution/prd/`.

This skill owns the **conceptual product layer**. It defines what should be built, why it matters, who it serves, what capabilities are required, and what is explicitly out of scope. It creates the source directory that subsequent architecture, tech spec, and planning stages must follow.

## 2. When to Use

Use this skill when:
- you want to write or revise a product requirements document (PRD), product brief, or scope document
- you have an idea, but the problem, target user, or functional scope is still undefined
- you want to reverse-engineer an existing codebase into explicit product requirements (Brownfield)
- you want to revise product scope before beginning architecture or implementation work
- you need capabilities prioritized into a critical path versus deferred phases

Do not use this skill for choosing frameworks, runtimes, databases, cloud vendors, protocol schemas, or task breakdowns. Those belong to later stages.

## 3. Required Inputs & Context Assembly

Gather the best available inputs to assemble your active memory:
1.  **Codebase Reality:** In Brownfield or Evolution mode, inspect the repository directly. Treat the existing codebase as the source of truth for current implementation reality, and note where it drifts from any existing docs.
2.  **Upstream Intent:** Read the user's raw request, prompt context, and any existing product notes.
3.  **Active Chat History:** Read the active conversation history. If any design decisions, product requirements, or scope boundaries have already been discussed or decided, natively extract and apply them to the drafted files. Do not revert to default assumptions for those items.
4.  **Operator Preferences:** If the user specifies technical stack preferences at this stage, record them strictly inside `vision.md` under *Appendix: Operator Preferences* without allowing them to contaminate the requirements sections.

## 4. Layer Boundaries

### Allowed Decisions
- Product vision, jobs to be done (JTBD), and problem framing
- Target archetype selection (web app, CLI, library, mobile, data pipeline, etc.)
- Actor personas, motivations, constraints, and operating contexts
- Ubiquitous language definitions (the glossary)
- Functional capabilities, grouped by epic and prioritized (`P0`, `P1`, `P2`)
- Non-functional constraints stated in business or quality-attribute terms
- Scope boundaries, anti-scope, and concept-level rejections

### Forbidden Decisions
- Naming specific frameworks, languages, databases, or cloud vendors
- Defining transport protocols, API endpoints, or database schemas
- Specifying directory structures or file layouts for the codebase
- Decomposing work into task lists, tickets, or code-level commits

## 5. Output Contract & Decomposition

Produce or modify the following files inside `.constitution/prd/`. Do not append disconnected fragments; integrate all changes cleanly to preserve reader flow.

### 1. `.constitution/prd/vision.md`
*   **0. Version:** Declares the current Stage 1 SemVer (corresponds to the latest entry in `.constitution/prd/changelog.md`).
*   **Executive Summary:** Short, high-density statement of the vision, problem, and target archetype.
*   **Jobs to Be Done (JTBD):** The exact real-world jobs the user is hiring the product to perform.
*   **Appendix: Operator Preferences:** Captures user-supplied technical stack preferences as non-binding implementation hints.

### 2. `.constitution/prd/glossary.md`
*   **Ubiquitous Language:** A strict three-column table defining canonical domain terms:
    ```markdown
    | Term | Definition | Do Not Use |
    | :--- | :--- | :--- |
    | [term] | [definition (max 2 sentences)] | [synonyms to avoid] |
    ```
    Every term must be singular and canonical.

### 3. `.constitution/prd/actors.md`
*   **Personas:** Section-by-section breakdown of primary and secondary actors.
*   **Format per actor:** Role name, operating context, concrete goals, and user frictions. No demographic filler allowed.

### 4. `.constitution/prd/capabilities.md`
*   **Functional Capabilities:** Grouped by Epic.
*   **Format per capability:**
    *   **Priority:** `P0` (critical path) | `P1` (next phase) | `P2` (optional/nice-to-have)
    *   **Capability ID:** Optional, but recommended when tracking long-term traceability.
    *   **Capability:** Technology-agnostic statement of what the system must enable.
    *   **Rationale:** Why this capability is required.

### 5. `.constitution/prd/constraints.md`
*   **Non-Functional Constraints:** Stated in concrete, measurable quality attributes: performance (latency limits), reliability, security, privacy, and operability constraints.

### 6. `.constitution/prd/domain-model.md`
*   **Conceptual Diagrams:** Mermaid diagrams clarifying the domain and context boundaries (e.g., C4Context, domain classDiagram) without leaking implementation choices.

### 7. `.constitution/prd/changelog.md`
*   **Local Stage 1 Changelog:** Tracks local SemVer changes (`vX.Y.Z`) for Stage 1. This file is allowed to grow chronologically to preserve the full history of Stage 1 iterations.

### 8. `.constitution/prd/out-of-scope/` (Directory)
*   **Anti-Scope Database:** When a feature is explicitly rejected or deferred, create a dedicated file: `.constitution/prd/out-of-scope/[concept-slug].md` explaining the context and the exact product or structural reasoning behind the rejection.

## 6. Validation Checklist

Before declaring Stage 1 complete, verify all of the following:
- [ ] Every file under `.constitution/prd/` is understandable without implementation details.
- [ ] Every glossary term is consistent, singular, and carries an explicit list of avoided synonyms.
- [ ] Every capability is phrased as a business outcome, never as a solution or code implementation.
- [ ] Priorities are explicit across all epics.
- [ ] Non-functional constraints are concrete and measurable (no vague "fast" or "secure" prose).
- [ ] Major rejected or deferred items are documented as standalone files in `.constitution/prd/out-of-scope/`.
- [ ] Technical preferences appear only in `vision.md` under the *Appendix: Operator Preferences*.
- [ ] The local changelog `.constitution/prd/changelog.md` has been updated with the current SemVer bump.

## 7. Common Failure Modes

Avoid these:
- Sneaking database engines, libraries, or API designs into the PRD.
- Writing broad, un-decomposed capability statements (e.g., "Users can manage accounts").
- Leaving completed or rejected work inside active capability lists.
- Overwriting user edits to the files between turns (always re-read the directory before writing).
