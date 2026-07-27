---
name: {{ skill_name }}
description: "{{ skill_description }}"
metadata:
  family: {{ metadata.family }}
  stage: "{{ metadata.stage }}"
  artifact: "{{ metadata.artifact }}"
  upstream: "{{ metadata.upstream }}"
---

# Specifying Technical Implementation

Stage 3 of the **AI Project Development Framework**.

Together, these skills form the **constitutional framework**: a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Immediately load `references/framework-constitution.md` before performing stage work.

## 1. Overview

Convert the logical container boundaries and execution flows under `.constitution/architecture/` into a concrete, build-ready, physical specification distributed across modular files under `.constitution/tech-spec/`.

This skill owns the **physical implementation layer**. It selects the concrete stack, formalizes major technical decisions through Architecture Decision Records (ADRs), maps storage schemas, and specifies public/internal contracts in their raw, native formats.

## 2. When to Use

Use this skill when:
- you want to write or revise a technical specification, implementation blueprint, or physical system design
- you have a completed logical architecture and need concrete stack, language, database, or library choices
- you need data models, database schemas, API contracts, or repository directories defined
- you want to revise implementation details without altering the approved logical architecture boundaries
- you need a precise engineering handoff before task planning begins

Do not use this skill to rewrite product scope, redesign logical container boundaries, or generate task lists.

## 3. Required Inputs & Context Assembly

Gather the best available inputs to assemble your active memory:
1.  **Upstream Context:** Read the entire active Stage 1 and Stage 2 directories (`.constitution/prd/*.md` and `.constitution/architecture/**/*.md`). Treat the logical containers, flow sequence diagrams, and constraints defined there as binding requirements.
2.  **Codebase Reality:** In Brownfield or Evolution mode, inspect the repository directly using available tools. Ensure your specification reflects the actual stack, dependencies, and file layout in the workspace.
3.  **Active Chat History:** Read the active conversation history. If any technical decisions, database choices, or API designs have already been discussed or decided, natively extract and apply them to the drafted files. Do not revert to default assumptions for those items.

## 4. Layer Boundaries

### Allowed Decisions
- Selecting the runtime, language, frameworks, packages, databases, and tooling (Bill of Materials)
- Defining physical database schemas, data types, keys, indexes, and migration strategies
- Defining physical interface contracts (API routes, CLI parameters, SDK/library signatures, proto messages)
- Specifying the concrete directory structure and module layout of the repository
- Authoring Architecture Decision Records (ADRs) for expensive-to-reverse choices
- Establishing coding standards, linting, formatting, and test-coverage rules
- Resolving performance-critical physical decisions within the logical boundaries

### Forbidden Decisions
- Expanding, reducing, or redefining product scope from `.constitution/prd/`
- Altering logical container responsibilities, trust boundaries, or protocol categories from `.constitution/architecture/`
- Naming specific scheduling timelines or dividing work into tasks, tickets, or epics

## 5. Output Contract & Decomposition

Produce or modify the following files inside `.constitution/tech-spec/`. Do not append disconnected fragments; integrate all changes cleanly to preserve reader flow.

### 1. `.constitution/tech-spec/stack.md`
*   **0. Version:** Declares the current Stage 3 SemVer (corresponds to the latest entry in `.constitution/tech-spec/changelog.md`).
*   **Bill of Materials (BOM):** Concrete, version-pinned specifications for the primary language, runtime, frameworks, state/persistence engines, infrastructure/tooling, and testing libraries.
*   **Compatibility Policy:** Explicit policies for dependency pinning, lockfiles, and future upgrade boundaries.

### 2. `.constitution/tech-spec/guidelines.md`
*   **Project Structure:** A monospaced directory layout diagram mapping where the built code, tests, configs, and assets live in the repository.
*   **Coding Standards:** Formatting, linting, testing expectations, observability hooks, and deployment/migration rules.

### 3. `.constitution/tech-spec/changelog.md`
*   **Local Stage 3 Changelog:** Tracks local SemVer changes (`vX.Y.Z`) for Stage 3. This file is allowed to grow chronologically to preserve the full history of Stage 3 iterations.

### 4. `.constitution/tech-spec/adrs/` (Directory)
*   **ADR Isolation:** Each major technical decision (e.g., choice of ORM vs. SQL, connection pooling, transport format) must be written as a standalone file: `.constitution/tech-spec/adrs/ADR-[NNN]-[slug].md`.
*   **Format per ADR:** Status (proposed/accepted/superseded), Context, Decision, and Consequences (the downstream trade-offs).

### 5. `.constitution/tech-spec/data-models/` (Directory)
*   **Durable State Schemas:** Every logical storage boundary identified in `.constitution/architecture/` must have a corresponding schema file in this directory (e.g., `schema.sql`, `prisma.schema`, `schema.json`) written in the **native schema format of the database**. If the raw schema format is not human-readable, a companion `.md` file is required to document invariants, state purpose, primary indexes, and migration notes.
*   *Accompanying Markdown:* You may include an optional `.md` companion file describing the logical purpose, state invariants, primary indexes, and migration notes for that schema, but the raw schema script itself is the contract.

### 6. `.constitution/tech-spec/contracts/` (Directory)
*   **Raw Interface Contracts:** All public and internal interfaces must be written as **raw, native specification files** inside this directory. Do not wrap them in markdown code blocks. This enables native IDE lints and automated compilation checks:
    *   **HTTP APIs:** Written as raw `openapi.yaml` or `openapi.json` files satisfying the OpenAPI 3.1+ specification.
    *   **Event-driven/Message APIs:** Written as raw `asyncapi.yaml` or `asyncapi.json` files.
    *   **JSON payload schemas:** Written as raw `schema.json` files satisfying JSON Schema 2020-12.
    *   **gRPC/RPC systems:** Written as raw `.proto` files defining services and messages.
    *   **Libraries/SDKs/CLIs:** If the contract is in-code or CLI-based, write its public signatures, CLI commands, flags, and exit codes in the native language's interface formalism (e.g., a `.d.ts` for TypeScript, or a documented CLI command tree).

## 6. Validation Checklist

Before declaring Stage 3 complete, verify all of the following:
- [ ] Every physical stack, language, and database choice is concrete, version-pinned, and justified.
- [ ] The decision-record set (ADRs) is complete for all high-risk or expensive-to-reverse choices.
- [ ] Interface contracts use their native specification formats (OpenAPI, AsyncAPI, Proto, JSON Schema) instead of prose code blocks.
- [ ] Every HTTP contract defines an explicit, standardized error model (preferring RFC 9457 Problem Details where applicable).
- [ ] Compatibility and migration policies are defined for any schema or contract change that might break running clients or stored history.
- [ ] No product-scope changes or logical container boundary redesigns have leaked into the files.
- [ ] All upstream architectural flows map cleanly to the physical contracts and data models.
- [ ] The local changelog `.constitution/tech-spec/changelog.md` has been updated with the current SemVer bump.

## 7. Common Failure Modes

Avoid these:
- Naming languages or libraries without explaining why they fit the logical constraints.
- Leaving contract specs at "there will be an API" level of prose vagueness (always write the raw schema/spec).
- Quietly altering logical container boundaries or communications through stack selections.
- Assuming external clients, downstream consumers, or historical databases can absorb a breaking contract change without an explicit migration path.
- Copying the current repository layout even when it is obviously accidental (always analyze and design the target layout).
