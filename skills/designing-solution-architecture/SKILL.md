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

Stage 2 of the four-stage documentation pipeline. It reads the product requirements under `.constitution/prd/` and writes the logical system design under `.constitution/architecture/`, which binds Stages 3 and 4.

Read `references/framework-overview.md` before you start, and read the archetype block in `constitution.yaml` and the meters in `prd/constraints.yaml` before choosing diagram types or resilience tactics; don't assume a web container topology. Schemas live in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`; run `validate` before declaring the pass complete.

## Inputs

1. **Upstream requirements.** Every file in `prd/`, plus the archetype. Jobs, capabilities, constraints, and the glossary are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository and describe what exists, citing paths as `repository` evidence on the boundaries they settle. Delegate the survey of a large repository to read-only subagents, naming the model on each dispatch, and verify every path you cite yourself.
3. **Conversation history.** Apply decisions already settled in the session as `ruling` evidence.
4. **Open decisions.** Read `reports/open-decisions.yaml`; a boundary or flow that depends on an open entry is `certainty: open`.
5. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number) for boundary or flow questions execution routed here.

## Layer boundaries

### Allowed decisions

- Architectural style and high-level topology
- Logical boundaries and their responsibilities: containers, modules, processes, pipeline stages, or hardware partitions, whichever fits the archetype
- Bounded contexts, domain separation, and trust boundaries
- Communication patterns as logical categories: request-response, event, shared storage, file handoff, in-process, IPC, bus
- Critical flows, one per P0 job
- Resilience and observability requirements at the logical level
- Logical risks, sensitivity points, and structural debt

### Forbidden decisions

- Selecting exact vendors, cloud products, managed services, frameworks, languages, or versions
- Naming concrete database, cache, or message queue products
- Requiring vendor review frameworks
- Writing code-level interface contracts, APIs, data schemas, or physical table schemas
- Changing or expanding the product scope that `prd/` owns
- Breaking work into task lists or tickets

## Output contract

If `architecture/` doesn't exist, run `init --stage architecture` for empty stubs or create the files in this pass.

### `architecture/boundaries.yaml`, schema `boundaries.schema.json`

One record per logical boundary: kind, a role label that fits the system, its single primary responsibility, inputs, outputs, dependencies, whether it is a trust boundary, and certainty; plus one edge per communication, labeled with its protocol category. Every boundary must pass the overview's two design-term gates, the Depth Standard and the Deletion Test; a named box with no responsibility isn't a boundary.

### `architecture/containers.md`

Prose holding the structure diagram of logical boundaries, not necessarily C4 containers; the file name stays for pipeline stability. Fit the diagram to the system: C4-style boxes for Web/Cloud and distributed shapes, package or module diagrams for Library/SDK and CLI/Tooling, module plus process boundaries for System/Native, pipeline stage graphs for ML/Data, block or partition diagrams for Embedded/IoT, contract and trust edges for Web3, scene or tick partitions for Game/Sim, control plane versus data plane for IaC/Platform. When C4 vocabulary doesn't fit, use `flowchart` with explicit labels. Every diagram edge appears in `boundaries.yaml` with the same protocol category.

### `architecture/flows/<slug>.md`, front matter schema `flow.schema.json`

One flow per P0 job in `prd/jobs.yaml`, named for the job, with front matter naming the job, the capabilities the flow realizes, the boundaries it crosses, the view, and certainty. A flow is a story with consumers, not a diagram per capability; also write a P1 job's flow when it carries a real failure path worth designing. The validator requires every P0 capability in at least one flow and, once `tech-spec/` or `tasks/` is present, warns on a flow nothing references.

The body holds the behavior view that fits what must be reasoned about: `sequence` for request, message, or user-operation paths; `state` for lifecycle, protocol, or mode-rich behavior; `dag` for ML and ETL lineage; `timing` for deadline-bound embedded paths; `value-flow` for Web3 value movement. Every flow ends with a failure path: what happens when communication, hardware, or an invariant fails.

### `architecture/strategy.md`

A short solution-strategy narrative: the pattern, why it fits the vision, archetype, and quantified constraints, and the trade-offs accepted. Decisions and reasons, not a diagram dump.

In greenfield, the pattern, the topology, and the protocol categories are the choices most likely to rest on habit rather than grounds. When you can't name the method, prior art, or source behind one, say so in place, state the question in register shape, and ask the user to rule now or to run `/interview for Architecture` for a design review. Stage 2 plans no spikes; route a question that measurement would answer to the interview, which can run it, or to Stage 3.

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

Structural risks and logical debt, each with a mitigation or follow-up, calling out assumptions whose failure would change a boundary, flow, or PRD meter. For a decision-changing uncertainty, name the cheapest executable pilot or probe and the dependent work it holds, and route its execution to the interview or Stage 3 rather than expanding speculative design to hide the uncertainty. Add STRIDE threat notes, with depth scaled to risk, when trust boundaries, multi-tenant data, money movement, or safety impact exist.

### `architecture/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump and the `upstream` field naming the `prd/` version it was written against.

## Certainty in Stage 2

Greenfield boundaries and flows are `assumed`. A boundary settles only by `repository` evidence, never an external source, once the module, process, or partition exists in code. A flow settles when behavior verification exercises it through real interfaces, which execution reports in its closeout and reconcile applies; meaningful existing coverage or a focused probe suffices, without a new test per flow.

## Close the pass

Put this pass in an identifiable constitution commit with no code in it. It can share one coherent pull request with small related stage passes or patches; preserve stage ownership and upstream ordering, and split unrelated or unwieldy work when that improves review. Run `pr-review-fix-loop` in `documents` mode for a constitution-only PR, or full review when it includes implementation.

## Validation checklist

- [ ] `validate` reports no errors; warnings are listed in your closing report.
- [ ] Every major design decision traces to a PRD record or repository evidence.
- [ ] Archetype and constraint meters visibly shaped topology, views, and resilience choices.
- [ ] Nothing from Forbidden decisions leaked in: no vendor or engine names, code-level contracts, or physical schemas.
- [ ] Every P0 job has a flow and every P0 capability appears in one; no flow exists for a capability alone.
- [ ] Boundary vocabulary fits the system rather than forcing web-only language.
- [ ] Every boundary has a distinct responsibility, meets the Depth Standard, and passes the Deletion Test.
- [ ] Every edge carries a protocol category in the diagram and in `boundaries.yaml`.
- [ ] Every flow documents its failure path.
- [ ] `strategy.md` carries a readable trade-off narrative.
- [ ] Every pattern-level choice names its grounds or says plainly that it has none and routes the question.
- [ ] Product scope is unchanged; if it shifted, stop and route to Stage 1.
- [ ] Every settled record has validator-accepted evidence; every assumed record states its assumption.
- [ ] `architecture/changelog.yaml` has this pass's entry with its upstream version.
