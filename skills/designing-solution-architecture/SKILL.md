---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
  upstream: {{ metadata.upstream | yaml_str }}
---

# Designing solution architecture

Stage 2 of the four-stage documentation pipeline. It reads the product requirements under `.constitution/prd/` and writes the logical system design under `.constitution/architecture/`, which Stage 3 and Stage 4 treat as binding.

Read `references/framework-overview.md` before you start. Read the archetype block in `constitution.yaml` and the meters in `prd/constraints.yaml` before choosing diagram types or resilience tactics; do not assume a web container topology. Schemas live in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`; run `validate` before declaring the pass complete.

## Inputs

1. **Upstream requirements.** Every file in `prd/`, plus the archetype. Jobs, capabilities, constraints, and the glossary are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository and describe what exists, citing paths as `repository` evidence on the boundaries they settle. Delegate the survey of a large repository to read-only subagents with the model named on each dispatch, and verify any path you cite yourself; a boundary settles by `repository` evidence only, never by an external source.
3. **Conversation history.** Apply decisions already settled in the session as `ruling` evidence.
4. **Open decisions.** Read `reports/open-decisions.yaml`; a boundary or flow that depends on an open entry is `certainty: open`.
5. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number) for boundary or flow questions execution routed here.

## Layer boundaries

Stage 2 decides the logical shape of the system. It doesn't choose frameworks, versions, managed services, data schemas, or task breakdowns.

### Allowed decisions

- Architectural style and high-level topology
- Logical boundaries and their responsibilities: containers, modules, processes, pipeline stages, or hardware partitions, whichever fits the archetype
- Bounded contexts, domain separation, and trust boundaries
- Communication patterns as logical categories: request-response, event, shared storage, file handoff, in-process, IPC, bus
- Critical flows, one per P0 job
- Resilience and observability requirements at the logical level
- Logical risks, sensitivity points, and structural debt

### Forbidden decisions

- Selecting exact vendors, cloud products, frameworks, or languages
- Naming concrete database, cache, or message queue products
- Requiring vendor review frameworks
- Writing code-level interface contracts, APIs, or physical table schemas
- Changing or expanding the product scope that `prd/` owns
- Breaking work into task lists or tickets

## Output contract

If `architecture/` doesn't exist, run `init --stage architecture` for empty stubs, or create the files in this pass. If `changelog.yaml` doesn't exist yet, the first entry is `v0.0.1`.

### `architecture/boundaries.yaml`, schema `boundaries.schema.json`

One record per logical boundary: kind, a role label that fits the system, the single primary responsibility, inputs, outputs, what it depends on, whether it is a trust boundary, and certainty. Plus one edge per communication, labeled with its protocol category. Every boundary must pass two gates from the overview's design terms: the Depth Standard and the Deletion Test. A box with a name but no responsibility isn't a boundary.

### `architecture/containers.md`

Prose holding the structure diagram. The file name stays for pipeline stability; the content is logical boundaries, not necessarily C4 containers. Choose the diagram to fit: C4-style boxes for Web/Cloud and distributed shapes, package or module diagrams for Library/SDK and CLI/Tooling, module plus process boundaries for System/Native, pipeline stage graphs for ML/Data, block or partition diagrams for Embedded/IoT, contract and trust edges for Web3, scene or tick partitions for Game/Sim, control plane versus data plane for IaC/Platform. When C4 vocabulary doesn't fit, use `flowchart` with explicit labels. Every edge in the diagram appears in `boundaries.yaml` with the same protocol category.

### `architecture/flows/<slug>.md`, front matter schema `flow.schema.json`

One flow per P0 job in `prd/jobs.yaml`, named for the job. The front matter names the job, the capabilities the flow realizes, the boundaries it crosses, the view, and certainty. The validator requires every P0 capability to appear in at least one flow. It warns on a flow nothing references once `tech-spec/` or `tasks/` is present. A flow is a story with consumers, not a diagram per capability. When a P1 job's flow carries a real failure path worth designing, write it too.

The body holds the behavior view, fit to what must be reasoned about: `sequence` for request, message, or user-operation paths; `state` for lifecycle, protocol, or mode-rich behavior; `dag` for ML and ETL lineage; `timing` for deadline-bound embedded paths; `value-flow` for Web3 value movement. Every flow ends with a failure path: what happens when communication, hardware, or an invariant fails.

### `architecture/strategy.md`

A short solution-strategy narrative: the pattern, why it fits the vision, archetype, and quantified constraints, and the trade-offs accepted. Decisions and reasons, not a diagram dump.

In greenfield, the pattern, the topology, and the protocol categories are the choices most likely to rest on habit rather than grounds. When you can't name the method, prior art, or source behind one, say so in place. State the question in register shape, then ask the user to rule now or to run `/interview for Architecture` for a design review. Stage 2 plans no spikes; a question that measurement would answer routes to the interview, which can run it, or to Stage 3.

### `architecture/resilience.md`

Cross-cutting logical design for security and identity, failure handling, telemetry, configuration, and state integrity. Default tactics by surface, adapted to the PRD meters:

| Surfaces | Logical defaults |
| :--- | :--- |
| Web/Cloud, Mobile, IaC/Platform | Timeouts, bounded retries, fallbacks, isolation, degradation, idempotency; offline sync when local-first |
| CLI/Tooling, Library/SDK | Clear error surfaces, partial-fail behavior, compatibility expectations under failure |
| System/Native, Embedded/IoT | Watchdogs or safe mode, memory-exhaustion behavior, last-known-good |
| ML/Data | Checkpoint and restart, poison-message handling, replay and backfill, model or data fallback |
| Web3 | Oracle failure behavior, pause or upgrade posture, invariant-preserving failure |
| Game/Sim | Frame or tick overrun policy, desync recovery, determinism boundaries |

### `architecture/risks.md`

Structural risks and logical debt, each with a mitigation or follow-up. Call out sensitivity points where a small design change would swing a PRD meter. Add STRIDE threat notes when trust boundaries, multi-tenant data, money movement, or safety impact exist; depth scales with risk.

### `architecture/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump and the `upstream` field naming the `prd/` version it was written against.

## Certainty in Stage 2

Greenfield boundaries and flows are `assumed`. A boundary settles by `repository` evidence when the module, process, or partition exists in code. A flow settles when an integration test walks it, which execution reports in its closeout and reconcile applies; don't claim it here. A boundary waiting on an open decision is `open`.

## Close the pass

Open one pull request for this stage's constitution commit, separate from any other stage, and have it reviewed with `pr-review-fix-loop` in `documents` mode. A single-stage PR converges; a PR carrying the whole pipeline does not.

## Validation checklist

- [ ] `validate` reports no errors; warnings are listed in your closing report.
- [ ] Every major design decision traces to a PRD record or to repository evidence.
- [ ] Archetype and constraint meters visibly shaped topology, views, and resilience choices.
- [ ] Nothing from Forbidden decisions leaked in: no vendor or engine names, no code-level contracts, no physical schemas.
- [ ] Every P0 job has a flow and every P0 capability appears in one; no flow is written for a capability alone.
- [ ] Boundary vocabulary fits the system rather than forcing web-only language.
- [ ] Every boundary has a distinct responsibility, meets the Depth Standard, and passes the Deletion Test.
- [ ] Every edge carries a protocol category, in the diagram and in `boundaries.yaml`.
- [ ] Every flow documents its failure path.
- [ ] `strategy.md` carries a readable trade-off narrative.
- [ ] Every pattern-level choice names its grounds, or says plainly that it has none and routes the question.
- [ ] Product scope is unchanged; if it shifted, stop and route to Stage 1.
- [ ] Every settled record has validator-accepted evidence; every assumed record states its assumption.
- [ ] `architecture/changelog.yaml` has this pass's entry with its upstream version.
