---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
  upstream: {{ metadata.upstream | yaml_str }}
---

# Defining product requirements

Stage 1 of the four-stage documentation pipeline. Read `references/framework-overview.md` before any stage work; it covers the shared rules for modes, precedence, certainty, versioning, and vocabulary.

Stage 1 settles what to build, why it matters, whom it serves, which capabilities are required, and what is out of scope, as technology-agnostic files under `.constitution/prd/` plus the product archetype in `.constitution/constitution.yaml`.

The data files are the upstream contract Stages 2 through 4 read. Read each file's schema in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/` before writing it, and run `validate` before declaring the pass complete.

## Inputs

1. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository directly, delegating the survey of a large one to read-only subagents (naming the model on each dispatch) and verifying the `repository` evidence they return. Cite the code as `repository` evidence on the records it settles, and infer the archetype from shipped surfaces, not from a stack you wish the repo used.
2. **Upstream intent.** The user's raw request, the prompt context, and existing product notes.
3. **Conversation history.** Carry a decision, requirement, or scope boundary the conversation already settled into the files as `ruling` evidence rather than falling back to a default.
4. **Operator preferences.** Technical stack preferences go only in `vision.md` under *Appendix: Operator preferences*, so they don't leak into requirements.
5. **Open decisions.** Read `.constitution/reports/open-decisions.yaml` and don't silently answer an `open` entry; a record that depends on one is `certainty: open` with the decision id.
6. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`.constitution/reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number) for candidate glossary terms and scope questions execution routed here; in an Evolution pass they are part of the delta.

## Layer boundaries

### Allowed decisions

- Product vision, jobs to be done, and problem framing
- Primary and secondary archetypes
- Actor personas, motivations, constraints, and operating contexts, including real non-human actors
- The canonical domain vocabulary
- Functional capabilities, grouped, prioritized `P0`, `P1`, or `P2`, and mapped to the jobs they serve
- Non-functional constraints as quantified meters
- Scope boundaries, anti-scope, and concept-level rejections

### Forbidden decisions

- Naming specific frameworks, languages, runtimes, databases, or cloud vendors
- Defining transport protocols, protocol schemas, API endpoints, or database schemas
- Specifying codebase directory structures or file layouts
- Breaking work into task lists, tickets, or code-level commits

## Output contract

On a repository with no constitution, run `init` first; it writes the Stage 1 files, and later stages add theirs in their own passes or with `init --stage architecture` and the later stage names. On an interview-only tree, run `init --stage prd` instead.

```bash
bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts init --root . --acronym ABC --archetype "CLI/Tooling"
```

Then produce or revise the files below. Re-read each file before writing so user edits made between turns survive, and integrate each change rather than appending disconnected fragments.

### `constitution.yaml`, archetype block only

Stage 1 owns only this block: the primary archetype from the allowed list, secondary archetypes when the product is hybrid (the rationale names the surfaces each covers), confidence, and a short problem-tied rationale. Also set `surfaces`, the globs where a banned synonym is a defect; for a product with a public API or UI they include source paths, not only the contracts directory.

### `prd/jobs.yaml`, schema `jobs.schema.json`

One record per job to be done: an actor, an outcome-oriented statement, a priority, and certainty. Jobs are the unit Stage 2 writes flows for, so a job is a story an actor can finish, not a feature. Three to twelve jobs is typical; if you have thirty, they are capabilities.

### `prd/capabilities.yaml`, schema `capabilities.schema.json`

One record per capability: a group, a priority, a technology-agnostic statement, a rationale, the jobs it serves (at least one), certainty, and an optional `legacy_id` that keeps an old identifier for traceability. Prefer EARS patterns (ubiquitous, event-driven, state-driven, unwanted, optional) for normative statements, and split compound capabilities into atomic ones.

This file describes the product, not the backlog: a shipped capability stays listed with its priority unchanged, and delivery status, derivable from `tasks/completed/`, is never recorded here. Only rejected or deferred concepts leave, into `out-of-scope/`.

### `prd/constraints.yaml`, schema `constraints.schema.json`

One record per measurable quality attribute with Planguage fields: scale, meter, goal, optional stretch, fail. Classes: performance, reliability, security, privacy, operability, compatibility, cost, or archetype-specific. Meter focus follows the primary archetype:

| Primary archetype | Prefer measuring |
| :--- | :--- |
| Web/Cloud, IaC/Platform | Latency, availability, RTO/RPO, cost ceilings |
| CLI/Tooling | Startup time, peak memory, exit-code and output stability |
| Library/SDK | API stability expectations, size/alloc ceilings, time-to-first-success |
| System/Native, Game/Sim | Frame or tick budget, memory ceilings, input-to-effect latency |
| ML/Data | Quality thresholds, data freshness, pipeline latency |
| Embedded/IoT | Size, weight, power, cost, deadlines, flash/RAM caps |
| Mobile | Cold/warm start, jank, battery, offline freshness, binary size |
| Web3 | Gas/compute ceilings, finality assumptions, upgrade policy |

A greenfield meter is `assumed`, with the assumption that it has not been measured. A constraint class you deliberately don't quantify yet goes in `deferred` with its risk named; don't invent a number to look complete.

### `prd/glossary.yaml`, schema `glossary.schema.json`

Canonical domain terms, each with a definition of at most two sentences and the synonyms writers must not use. Ban only domain synonyms, never generic English or technical words: "command", "process", "window", "blob", and "cache" are not glossary material even when the product has an Action, a Session, or a Client. The validator greps every banned word on the declared surfaces, so a generic ban produces false positives that hide real ones.

### `prd/vision.md`, `prd/actors.md`, `prd/domain-model.md`

Prose. Vision holds the executive summary, optional positioning, and the operator-preferences appendix, but not the archetype, which lives in `constitution.yaml`. Actors are goal-directed personas, primary first, with archetype-appropriate emphasis: developers and integrators for Library/SDK, the OS or runtime as an actor for Mobile and System/Native when lifecycle or permissions change outcomes, adversarial actors for Web3, tenants and policy engines for IaC/Platform, data producers and reviewers for ML/Data. The domain model is a Mermaid concept or entity-relationship sketch in the problem space, with no containers, processes, or deployables.

### `prd/out-of-scope/<slug>.md`, front matter schema `out-of-scope.schema.json`

One file per rejected or deferred concept. Front matter: decision, date, ruling reference, optional revisit condition. Body: context, reason, consequences that must not reappear downstream without an Evolution pass.

### `prd/changelog.yaml`, schema `changelog.schema.json`

Newest first. Add this pass's entry with the SemVer bump and the changes grouped as added, changed, deprecated, removed, fixed, security.

## Certainty in Stage 1

Greenfield records are `assumed` with the assumption written. A capability or job settles by `ruling` (an interview record or the user's words in this session) or, in Brownfield, by `repository` evidence pointing at the code that delivers it. A meter settles only by `measurement` evidence in `evidence/`.

## Close the pass

Put this pass in an identifiable constitution commit with no code in it. It can share one coherent pull request with small related stage passes or patches; preserve stage ownership and upstream ordering, and split unrelated or unwieldy work when that improves review. Run `pr-review-fix-loop` in `documents` mode for a constitution-only PR, or full review when it includes implementation.

## Validation checklist

- [ ] `validate` reports no errors; warnings are listed in your closing report.
- [ ] Every file reads clearly without implementation detail; no database engine, library, or API design is named.
- [ ] The `constitution.yaml` archetype block is complete, and `surfaces` covers every domain-facing path.
- [ ] Every job is a story an actor can finish; every capability serves at least one job.
- [ ] Every glossary term is singular and canonical; no banned list contains a generic or technical word.
- [ ] Every capability is a decomposed outcome, not a solution or a broad statement such as "Users can manage accounts."
- [ ] Every constraint is measurable or explicitly deferred with its risk; no vague "fast" or "secure" prose.
- [ ] `domain-model.md` stays in the problem space.
- [ ] Rejected and deferred concepts are in `out-of-scope/`; delivered capabilities remain listed.
- [ ] Every settled record has validator-accepted evidence; every assumed record states its assumption.
- [ ] Technical preferences appear only in the vision appendix.
- [ ] `prd/changelog.yaml` has this pass's entry.
