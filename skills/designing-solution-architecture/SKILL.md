---
name: {{ skill_name }}
description: "{{ skill_description }}"
metadata:
  family: ai-project-constitutional-framework
  stage: "2"
  artifact: ".constitution/architecture/"
  upstream: ".constitution/prd/"
---

# Designing Solution Architecture

Stage 2 of the **AI Project Development Framework**.

Together, these skills form the **constitutional framework**: a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Immediately load `references/framework-constitution.md` before performing stage work.

## 1. Overview

Convert the technology-agnostic product requirements under `.constitution/prd/` into a robust, logical system architecture distributed across modular files under `.constitution/architecture/`.

This skill owns the **logical system layer**. It decides the structural pattern, logical containers, container boundaries, communication styles, critical request/execution flows, and resilience posture needed to satisfy the PRD. It does not commit to concrete products, vendors, or libraries.

## 2. When to Use

Use this skill when:
- you want to write or revise a solution architecture or system design document
- you have a completed PRD and need a logical design before implementation choices begin
- you want to revise the logical structure of an existing system
- you need container boundaries, execution flows, or resilience concerns documented
- you want to analyze architectural trade-offs and structural debt without prematurely committing to a technical stack

Do not use this skill for choosing specific frameworks, versions, managed services, data schemas, or task breakdowns. Those belong to later stages.

## 3. Required Inputs & Context Assembly

Gather the best available inputs to assemble your active memory:
1.  **Upstream Context:** Read the entire active Stage 1 directory (`.constitution/prd/*.md`). Treat the glossary, vision, capabilities, and constraints defined there as binding requirements.
2.  **Codebase Reality:** In Brownfield or Evolution mode, inspect the repository and current system shape directly using available tools. Ensure your architecture reflects reality rather than speculative designs.
3.  **Active Chat History:** Read the active conversation history. If any architectural decisions, container boundaries, or design trade-offs have already been discussed or decided, natively extract and apply them to the drafted files. Do not revert to default assumptions for those items.

## 4. Layer Boundaries

### Allowed Decisions
- Architectural style and high-level topology
- Logical containers, responsibilities, and container boundaries
- Bounded contexts, domain separation, and trust boundaries
- Communication patterns (synchronous request, asynchronous event, shared storage, file handoff, in-process call)
- Critical request, execution, or transaction flows
- Resilience requirements (retries, timeouts, fallback strategies, idempotency) at the logical level
- Observability and telemetry requirements (span scopes, trace correlation) at the logical level
- Logical risks and structural debt analysis

### Forbidden Decisions
- Selecting exact vendors, cloud products, frameworks, or languages
- Naming concrete database engines, cache engines, or message queue products
- Naming specific managed services (AWS Lambda, GCP Pub/Sub, Postgres, Redis, etc.)
- Writing code-level interface contracts, APIs, or physical table schemas
- Modifying or expanding product scope that belongs in `.constitution/prd/`
- Decomposing work into task lists or tickets

## 5. Output Contract & Decomposition

Produce or modify the following files inside `.constitution/architecture/`. Do not append disconnected fragments; integrate all changes cleanly to preserve reader flow.

### 1. `.constitution/architecture/strategy.md`
*   **0. Version:** Declares the current Stage 2 SemVer (corresponds to the latest entry in `.constitution/architecture/changelog.md`).
*   **Architectural Pattern:** High-level topology choice (e.g., modular monolith, event-driven pipeline, local-first app).
*   **Why this pattern fits:** Concrete trade-off analysis justifying why the pattern satisfies the PRD vision and constraints.
*   **Trade-offs Accepted:** Explicit statement of what was sacrificed (complexity, operational burden, performance limits) to adopt this design.

### 2. `.constitution/architecture/containers.md`
*   **Logical Containers:** Decomposes the system into distinct containers.
*   **Format per container:**
    *   **Logical Type:** API, worker, local client, scheduler, library boundary, storage boundary, etc.
    *   **Responsibility:** The single, primary purpose of the container.
    *   **Inputs / Outputs:** What data flows in and out at the logical level.
    *   **Depends on:** Other logical containers or external boundaries.
*   **Container Diagram:** A C4Container Mermaid diagram illustrating container boundaries and their communication relationships.

### 3. `.constitution/architecture/resilience.md`
*   **Resilience & Cross-Cutting Concerns:** Logical designs for security, identity, failure handling (timeouts, retries, fallbacks), telemetry, configuration, and data integrity.

### 4. `.constitution/architecture/risks.md`
*   **Logical Risks & Technical Debt:** Factual analysis of structural risks and logical technical debt, including specific mitigations or follow-up items.

### 5. `.constitution/architecture/changelog.md`
*   **Local Stage 2 Changelog:** Tracks local SemVer changes (`vX.Y.Z`) for Stage 2. This file is allowed to grow chronologically to preserve the full history of Stage 2 iterations.

### 6. `.constitution/architecture/flows/` (Directory)
*   **Isolated Execution Flows:** Each critical execution flow must be written as a standalone file: `.constitution/architecture/flows/flow-[flow-slug].md`. The minimum is three flows covering primary capabilities. If the system has more than three P0 capabilities, each must have its own flow file.
*   **Format per flow file:**
    *   **Mapping:** References the exact PRD capability it satisfies.
    *   **Sequence Diagram:** A Mermaid sequenceDiagram illustrating the end-to-end execution path through the logical containers.

## 6. Validation Checklist

Before declaring Stage 2 complete, verify all of the following:
- [ ] Every major design decision traces back to a requirement in `.constitution/prd/` or codebase evidence.
- [ ] The architecture remains vendor-agnostic and technology-neutral (no product names or database engines).
- [ ] Every P0 capability from `.constitution/prd/` is mapped to an explicit execution flow in `.constitution/architecture/flows/`.
- [ ] Every logical container has a distinct, non-overlapping responsibility.
- [ ] Logical containers satisfy the Depth Standard: they present a small interface that hides significant internal complexity.
- [ ] The Deletion Test has been mentally applied to every container: deleting it must disperse its complexity across other containers, not just remove pass-through code.
- [ ] Communication relationships (arrows in your C4 diagram) are explicitly labeled with their logical protocol category.
- [ ] Cross-cutting concerns are addressed logically and placed at the correct boundary.
- [ ] No physical schema, code-level contract, or technical framework has leaked into the files.
- [ ] The local changelog `.constitution/architecture/changelog.md` has been updated with the current SemVer bump.

## 7. Common Failure Modes

Avoid these:
- Drawing container boxes without defining distinct responsibilities.
- Sneaking product-scope changes into the architecture layer (if scope shifts, update the PRD first).
- Specifying SQLite, PostgreSQL, Kafka, Redis, or similar concrete products instead of logical categories.
- Omitting the unhappy path and pretending logical communication never fails.
- Generating a diagram-heavy document with no clear strategy or trade-off narrative.
