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

Stage 1 of the four-stage documentation pipeline. Read `references/framework-overview.md` before you do any stage work; it covers the modes, precedence, certainty, versioning, and vocabulary rules that all four stages share.

Stage 1 settles what to build, why it matters, whom it serves, which capabilities are required, and what is out of scope. It records those decisions as technology-agnostic files under `.constitution/prd/`, and the product archetype in `.constitution/constitution.yaml`. Stages 2 through 4 read these as their upstream contract.

The data files are the contract. Their schemas live in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`; read the schema for each file you write, and run `validate` before you declare the pass complete.

## Inputs

1. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository directly. Delegate the survey of a large repository to read-only subagents, naming the model on each dispatch, and verify the `repository` evidence they return. Treat the code as the truth about what exists today, cite it as `repository` evidence on the records it settles, and note every place it diverges from the written files. Infer archetype from shipped surfaces, not from a stack you wish the repo used.
2. **Upstream intent.** The user's raw request, the prompt context, and any product notes that already exist.
3. **Conversation history.** When the active conversation already settles a decision, a requirement, or a scope boundary, carry it into the files as `ruling` evidence instead of falling back to a default.
4. **Operator preferences.** Technical stack preferences go only in `vision.md` under *Appendix: Operator preferences*, so they don't leak into requirements.
5. **Open decisions.** Read `.constitution/reports/open-decisions.yaml`. Its `open` entries are questions the user chose to leave open; don't answer one silently. A record that depends on one is `certainty: open` with the decision id.
6. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`.constitution/reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number) for candidate glossary terms and scope questions execution routed here. In an Evolution pass, those are part of the delta.

## Layer boundaries

Stage 1 doesn't choose frameworks, runtimes, databases, cloud vendors, or protocol schemas, and it doesn't break work into tasks.

### Allowed decisions

- Product vision, jobs to be done, and problem framing
- Primary and secondary archetypes
- Actor personas, motivations, constraints, and operating contexts, including non-human actors when they are real
- The canonical domain vocabulary
- Functional capabilities, grouped and prioritized `P0`, `P1`, or `P2`, each mapped to the jobs it serves
- Non-functional constraints as quantified meters
- Scope boundaries, anti-scope, and concept-level rejections

### Forbidden decisions

- Naming specific frameworks, languages, databases, or cloud vendors
- Defining transport protocols, API endpoints, or database schemas
- Specifying directory structures or file layouts for the codebase
- Breaking work into task lists, tickets, or code-level commits

## Output contract

On a repository with no constitution, run `init` first. Init writes Stage 1 files. Later stages are added with `init --stage architecture` (and the later stage names) or by writing the files in those passes. `validate` doesn't require `architecture/`, `tech-spec/`, or `tasks/` yet. On an interview-only tree, run `init --stage prd` instead.

```bash
bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts init --root . --acronym ABC --archetype "CLI/Tooling"
```

Then produce or revise the files below. Re-read every file before you write, so user edits made between turns survive. Integrate each change; don't append disconnected fragments.

### `constitution.yaml`, archetype block only

Primary archetype from the allowed list, secondary archetypes when the product is hybrid with the surfaces each covers named in the rationale, confidence, and a short problem-tied rationale. This block is the only part of the file Stage 1 owns. Also set `surfaces`: the globs where a banned synonym is a defect, which for a product with a public API or UI includes source paths, not only the contracts directory.

### `prd/jobs.yaml`, schema `jobs.schema.json`

One record per job to be done: an actor, an outcome-oriented statement, a priority, and certainty. Jobs are the unit Stage 2 writes flows for, so a job is a story an actor can finish, not a feature. Three to twelve jobs is typical; if you have thirty, they are capabilities.

### `prd/capabilities.yaml`, schema `capabilities.schema.json`

One record per capability: a group, a priority, a technology-agnostic statement, a rationale, the jobs it serves (at least one), and certainty. Prefer EARS patterns (ubiquitous, event-driven, state-driven, unwanted, optional) for normative statements. Keep each capability atomic; split compounds. Optional `legacy_id` keeps an old identifier for traceability.

This file describes the product, not the backlog. A capability stays listed after it ships, with its priority unchanged; delivery status is derivable from `tasks/completed/` and never recorded here. Only rejected or deferred concepts leave, into `out-of-scope/`.

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

A greenfield meter is `assumed` with the assumption that it has not been measured. It settles by `measurement` evidence in `evidence/`. Constraint classes you deliberately don't quantify yet go in `deferred` with the risk named. Never invent a number to look complete.

### `prd/glossary.yaml`, schema `glossary.schema.json`

Canonical domain terms, each with a definition of at most two sentences and the synonyms writers must not use. The banned list is domain synonyms only. Never ban generic English words or technical vocabulary: "command", "process", "window", "blob", "cache" are not glossary material even when the product has an Action, a Session, or a Client. The validator greps every banned word on the declared surfaces, so a generic ban produces false positives and hides real ones.

### `prd/vision.md`, `prd/actors.md`, `prd/domain-model.md`

Prose. Vision holds the executive summary, optional positioning, and the operator-preferences appendix; the archetype lives in `constitution.yaml`, don't restate it. Actors are goal-directed personas, primary first, with archetype-appropriate emphasis: developers and integrators for Library/SDK, the OS or runtime as an actor for Mobile and System/Native when lifecycle or permissions change outcomes, adversarial actors for Web3, tenants and policy engines for IaC/Platform, data producers and reviewers for ML/Data. The domain model is a Mermaid concept or entity-relationship sketch in the problem space; no containers, processes, or deployables.

### `prd/out-of-scope/<slug>.md`, front matter schema `out-of-scope.schema.json`

One file per rejected or deferred concept. Front matter: decision, date, ruling reference, optional revisit condition. Body: context, reason, consequences that must not reappear downstream without an Evolution pass.

### `prd/changelog.yaml`, schema `changelog.schema.json`

Newest first. Add an entry for this pass with the SemVer bump and the changes grouped as added, changed, deprecated, removed, fixed, security. The newest entry's version is the directory's version.

## Certainty in Stage 1

Greenfield records are `assumed` with the assumption written. A capability or job settles by `ruling` (an interview record or the user's words in this session) or, in Brownfield, by `repository` evidence pointing at the code that delivers it. A meter settles only by measurement. When a record waits on an open decision, mark it `open` with the id.

## Close the pass

Open one pull request for this stage's constitution commit, separate from any other stage, and have it reviewed with `pr-review-fix-loop` in `documents` mode. A single-stage PR converges; a PR carrying the whole pipeline does not.

## Validation checklist

- [ ] `validate` reports no errors. Warnings are listed in your closing report.
- [ ] Every file reads clearly without implementation detail; no database engine, library, or API design is named.
- [ ] The archetype block in `constitution.yaml` is complete, and `surfaces` covers every domain-facing path.
- [ ] Every job is a story an actor can finish; every capability serves at least one job.
- [ ] Every glossary term is singular and canonical, and no banned list contains a generic or technical word.
- [ ] Every capability is a decomposed outcome, not a solution and not a broad statement such as "Users can manage accounts."
- [ ] Every constraint is measurable or explicitly deferred with its risk; no vague "fast" or "secure" prose.
- [ ] `domain-model.md` stays in the problem space.
- [ ] Rejected and deferred concepts have moved to `out-of-scope/`; delivered capabilities remain listed.
- [ ] Every settled record has evidence the validator accepts; every assumed record states its assumption.
- [ ] Technical preferences appear only in the vision appendix.
- [ ] `prd/changelog.yaml` has this pass's entry.
