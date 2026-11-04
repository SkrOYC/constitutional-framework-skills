---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
  upstream: {{ metadata.upstream | yaml_str }}
---

# Specifying technical implementation

Stage 3 of the four-stage documentation pipeline. Read `references/framework-overview.md` before you start. Turn the logical boundaries and flows under `architecture/` into technical decisions under `tech-spec/`: a chosen stack, ADRs for expensive-to-reverse decisions, the verification and layout Stage 4 quotes, and for every durable shape and shipped surface a sidecar naming the code artifact that carries it.

`tech-spec/` records decisions and points at the code without copying it. Raw artifacts (SQL, migrations, OpenAPI, AsyncAPI, JSON Schema, `.proto`, public headers) live where the code builds from them, because a copy in `tech-spec/` doubles every change and turns ordinary code edits into spec-patch cycles.

Read the archetype in `constitution.yaml` and the operator preferences in `prd/vision.md`; don't default to HTTP/OpenAPI unless an HTTP API surface exists. Schemas live in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`; run `validate` before declaring the pass complete.

## Passes

| Pass | When | Writes |
| :--- | :--- | :--- |
| Decisions | Before Stage 4, and in Evolution when a decision changes | Stack pins, ADRs, guidelines, sidecars with planned artifact paths, pinned cross-epic contracts |
| Alignment | After a wave merges and `reconcile` runs, in Brownfield mode | Guidelines and ADR updates for the code decisions the user adopts, sidecars pointed at real artifacts, records settled by repository evidence |
| Execution patch | An epic lead invokes `pass: execution-patch` for authorized physical drift | Only the exact tech-spec files the caller authorizes within the epic's patchable scope |

Identify the pass first. The alignment pass reopens a decision the decisions pass settled by ruling only when the user asks.

## Bounded execution patch

For `pass: execution-patch`, skip the full-pass survey, artifact creation, and designer and research delegation; follow these steps and return to the epic lead. Layer boundaries, applicable schemas, certainty, and evidence requirements still bind the patch.

1. Read the caller identity, source revision, drift report, exact authorized files, constraints, and scoped checks, then their schemas and only the upstream records or repository evidence needed to assess the drift. Confirm the repair is physical and authorized; return a logical change, a pinned-contract change, a new unresolved decision, or a file outside the caller's authority as a blocker.
2. Patch only the named files, within any narrower caller constraints. Don't write code, changelogs, task files, or the decision register, and don't commit, open a PR, bump versions, or dispatch nested agents. Reuse supplied evidence and verify directly within bounds when needed; return a need for broader research or a ruling to the lead.
3. Check the diff against the allowed paths and run applicable schema validation and focused checks. Report unavailable verification and unrelated baseline failures precisely; don't expand the repair to clear unrelated findings.
4. Return the changed paths, the repair and its evidence, check results, and unresolved issues. The epic lead owns the separate specification commit, the independent milestone review, and the `spec_patches` record; reconciliation records the patch in the shared changelog and version bookkeeping.

## Inputs

1. **Upstream files.** All of `prd/` and `architecture/`; archetype, constraints, boundaries, and flows are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, the existing stack, dependencies, layout, and artifacts are `repository` evidence; cite the lockfile and paths. `derive` reports where `stack.yaml` pins and the `guidelines.md` layout disagree with the tree and the lockfile.
3. **Conversation history and the interview record.** Session decisions are `ruling` evidence; pinned sources a preceding interview recorded are `external` evidence, cited with their `version` and date rather than fetched again.
4. **Open decisions.** Read `reports/open-decisions.yaml`; a pin, sidecar, or ADR that depends on an open entry is `open`.
5. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number): drift that could not be patched, commands that never came to exist, records that could not be settled, and the `code_decisions` execution recorded. They are the alignment pass's agenda.

## Layer boundaries

### Allowed decisions

- The bill of materials: runtime, language, frameworks, packages, databases, tooling, all version-pinned
- Which artifact carries each durable shape and each shipped surface, its format, and where it lives in the repository
- The shape of contracts that cross epic boundaries, at the level of entities and fields, when concurrent epics depend on them
- Migration and compatibility policies
- The repository's concrete directory structure
- ADRs for expensive-to-reverse choices
- Coding standards, linting, formatting, commit conventions, the owner's verification and delivery policy, the commands Stage 4 will quote, and recipes that prove behavior through real interfaces
- Vendor-specific guidance only after that vendor is chosen

### Forbidden decisions

- Expanding, reducing, or redefining product scope
- Altering boundary responsibilities, trust boundaries, or protocol categories
- Dividing work into tasks, tickets, or epics
- Writing raw contract or data-model artifacts inside `.constitution/`

## Output contract

If `tech-spec/` doesn't exist, run `init --stage tech-spec` for empty stubs or create the files in this pass.

### `tech-spec/stack.yaml`, schema `stack.schema.json`

One record per bill-of-materials entry with role, exact pin, ecosystem, justification, optional radar ring, and certainty. The validator compares pins against the npm, bun, cargo, and pub lockfiles: a pin the lockfile contradicts is an error, and one absent from it is a warning. A compatibility policy names the pinning rule, the lockfiles, and the upgrade boundaries. When the system owns nothing durable, say so in `no_durable_state` rather than inventing a database. Once a lockfile exists, `derive --write` keeps the pins in step with it; the justification and the choice stay yours.

### `tech-spec/guidelines.md`, front matter schema `guidelines.schema.json`

Front matter carries the facts Stage 4 and execution read:

- the verification commands with `exists` and, for each that does not exist yet, the ticket that will create it
- the layout as path and purpose records, including where each artifact kind lives
- the commit convention
- the live-verification recipes, below

The body holds coding standards, observability hooks, deployment and migration rules, and any safety standard such as MISRA for regulated C/C++. Commands are bare, with the environment already active; only the tooling epic's tickets carry a bootstrap prefix.

The validator errors on a command marked existing that doesn't resolve and, once `tasks/` exists, on a missing command with no owning ticket. Stage 4 may quote only commands listed here.

#### Development and verification policy

Record the actual development and contribution model, the owner's policy, and its source in the guidelines body; repository visibility alone doesn't establish whether outside contributions are accepted. Carry forward explicit owner requirements and required project gates.

The policy follows the overview's rules on ordinary code comments, isolated unit tests, local verification, the CI/CD focus, remote tests, and contribution CI. Don't impose a test per ticket, blanket test-driven development, or coverage quotas; required acceptance evidence remains binding. Keep test workflows or actions separate from release execution, and record only the test-to-release coupling or gates the owner actually requires.

#### Live-verification recipes

Declare a recipe when verification leaves a gap on a shipped surface a user or client touches; coverage that faithfully drives that interface needs no duplicate recipe. Each recipe has `name`, `surface`, `launch` (start the system locally), `doctor` (a readiness probe that fails fast), `drive` with `drive_kind` (a command, named tool, or manual procedure), `evidence` (a screenshot, log line, HTTP response, or file), `cleanup`, and `exists`, with an owning ticket while it doesn't exist yet. State the gap each recipe covers and the minimal observations needed; reuse interface drivers, and keep startup, readiness, seed state, and owned-resource cleanup explicit.

Stage 4 cites a recipe from `live_probe` acceptance, and the epic lead runs it after the last relevant milestone and before closeout, reusing valid results. Retain a concise result and selected proof; full successful logs and intermediate captures remain run artifacts. When a surface can't be driven locally, state the reason and the remaining acceptance gap in the guidelines body.

### `tech-spec/adrs/ADR-<NNNN>-<slug>.md`, front matter schema `adr.schema.json`

One file per expensive-to-reverse choice: contract family, persistence engine, compatibility break policy, cloud vendor, platform IPC model. Front matter: id, status, date, supersession links, and certainty for the decision itself, settled by the ruling that made it. Body in a consistent MADR or Nygard shape: context, decision, alternatives considered, consequences. Consequences stay assumed until observed; say so in the body rather than in the front matter.

#### Design it twice

For every ADR-level choice the user hasn't already ruled on in the session, get two independent designs before you recommend one, reusing any the interview already obtained for the same decision. Dispatch two designers on available approved models, preferably different models or runtimes, through the harness's native delegation tool or an available runtime adapter; don't make another provider a prerequisite. Give both the same brief (the question, binding architecture boundaries and flows, PRD constraint meters, and operator preferences), and withhold your own view and each other's output.

{% if harness.id == "claude" %}Use the Agent tool for native workers; use a runtime adapter only when available and chosen.{% elif harness.id == "codex" %}Use `collaboration.spawn_agent` with `fork_turns: "none"` for native Codex roles. For approved Claude designers, research workers, or a Claude caller, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md); preserve fresh contexts, the reporting contract, and concurrent sends with one blocking receive waiter. Use an available adapter for another chosen runtime.{% elif harness.id == "antigravity" %}Use `invoke_subagent` with `TypeName: "research"`, the approved `Model` tier (`"pro"`, `"flash"`, `"flash_lite"`, or `"inherit"`), and a self-contained brief; use an available adapter (`codex-subagent` or `pi-subagent`) for another chosen runtime or external model ID.{% else %}Use `spawn_subagent` with the approved model and a self-contained brief; use an available adapter for another chosen runtime.{% endif %}

Screen both candidates against the Depth Standard, the Deletion Test, and the risks in `architecture/risks.md`. Then synthesise: pick a base, graft what the other did better, and record both candidates and the reason for the pick under "Alternatives considered". Say so when the two converge independently, which is strong signal; state a divergence you can't settle in register shape for the user. Skip the second design only for a choice that is cheap to reverse, and say so in one line.

### Contract and data-model sidecars, `tech-spec/contracts/<name>.meta.yaml` and `tech-spec/data-models/<name>.meta.yaml`

Every durable shape the system owns and every shipped or integration surface gets a sidecar, schema `meta.schema.json`, naming the surface kind, the flows it serves, the boundaries it belongs to, an optional validation command, and certainty. Its `artifact_path` is the repository-relative path of the artifact in the code: the migrations directory, the OpenAPI file the server or client generator reads, the `.proto` package, the public header.

- **Planned artifacts.** In greenfield the artifact doesn't exist yet, so the sidecar is `assumed` and states `settles_when`. Leave `owner` empty because no tickets exist yet; Stage 4 links the artifact to its creating ticket by putting the `artifact_path` in that ticket's scope. Once `tasks/` exists, the validator accepts a missing path only when an active ticket creates it that way.
- **Pinned contracts.** When two epics that can run in the same wave depend on one shape (an identifier, an event, an error model, a table both write), mark its sidecar `pinned: true` and write in companion markdown only the entities, fields, meanings, and allowed values the dependent work needs; leave speculative fields and operations to their owner when needed. Stage 4 plans the artifact and its cheapest decisive interface verification before those epics; a missing artifact needs an active creating ticket.
- **Companion markdown.** Purpose and invariants a reader needs and the artifact can't state, in `tech-spec/contracts/` or `tech-spec/data-models/` next to the sidecar, with the same stem (`orders.md` next to `orders.meta.yaml`), and named in the sidecar's `companion` field.

A contract settles when behavior verification exercises its artifact through the public interface, which execution reports and reconcile applies. Write `settles_when` with the decisive observation; meaningful coverage or a focused executable probe can supply it.

Selection algorithm: list surfaces from the boundaries and the P0 flows, pick the ecosystem-native artifact kind, place it in the layout, and emit sidecars only for surfaces that exist.

| Surface | Default contract artifact |
| :--- | :--- |
| HTTP API | OpenAPI 3.1+, RFC 9457 Problem Details for errors |
| Async / events | AsyncAPI 3.x |
| JSON payloads | JSON Schema 2020-12 or the stack's native equivalent |
| gRPC / RPC | `.proto` or equivalent IDL |
| CLI | Command tree, flags, operands, streams, and exit codes per POSIX utility conventions; a parseable artifact when tooling exists |
| Library / SDK | Language-native public surface (`.d.ts`, headers, exported crate API) plus an explicit SemVer policy |
| System/Native OS integration | Platform-native IDL for the declared target OS; never assume Linux |
| Mobile navigation / OS entry | Deep link, universal link, app link schemas; extension or share contracts |
| ML model / dataset | Model Cards for shipped models, Datasheets for owned datasets, ONNX, Parquet, or Arrow schemas for interchange |
| Embedded / IoT | Bus and message maps, register maps (CMSIS-SVD or generic), IP-XACT when the tool flow uses it |
| Web3 | NatSpec on public interfaces, ABI JSON, evidence for any EIP/ERC compliance claim |
| Game / real-time | Tick, determinism, and netcode contracts; glTF or OpenUSD when an asset pipeline is in scope |
| IaC / Platform | Kubernetes CRD schemas, Terraform module I/O schemas, or the manifests the platform applies |
| Third-party standard protocol | A manifest naming the protocol versions adopted and the extensions used, with the upstream spec pinned as external evidence |
| Durable data | The migrations directory the stack's migration tool applies, or the schema file it generates them from |

Human UX guidelines are not wire contracts; they belong in the guidelines body or product docs.

The validator warns when raw artifacts sit next to their sidecars. Move them in two commits, as the two-commit rule requires: first a code commit that puts the artifact where the code builds from it (usually it is already there and the tech-spec copy is the duplicate), then a patch-lane constitution commit that sets `artifact_path`, deletes the copy, and updates the `surfaces` globs in `constitution.yaml` so the glossary check follows the artifact.

### `tech-spec/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump and the `upstream` field naming the `prd/` and `architecture/` versions.

## The alignment pass

Run it after a wave's pull requests merge and `reconcile` has run, or when a reconciliation report routes items here. The code is the truth about the physical layer.

1. Run `derive` and `validate`; fix mechanical drift (pins, layout flags) with `derive --write`, not by hand.
2. For each of the reconciliation report's `code_decisions` (dependencies, patterns, conventions, and contract shapes execution introduced without a Stage 3 record), present what the code did, where, and your recommendation: adopt it into the guidelines or an ADR, or treat it as a defect and route it to Stage 4 as a follow-up. The user rules; an adopted decision is `settled` by `ruling` plus `repository` evidence.
3. Point every sidecar whose artifact now exists at its real path, and settle it with the behavior evidence the closeouts cite.
4. Leave ADR decisions alone; update their consequences with what was observed.
5. Add the changelog entry and run `validate`.

## Early executable grounding

For a contract, dependency, runtime, or operational assumption that could change the plan, identify the cheapest executable pilot or probe before dependent implementation, naming the question, public interface, expected observation, and the work it holds. Reuse evidence that already answers it. Hold only dependent work.

When no code exists, distinguish setup checks from behavior evidence: a scaffold can verify pins, layout, compilation, launch, and readiness, a thin path through the primary interface verifies the risky integration, and commands passing on an empty suite don't settle behavior. Stage 3 records the decision and verification need without writing code or exhaustive speculative contracts; Stage 4 schedules the missing setup and decisive pilot before their dependents.

## Certainty in Stage 3

A stack pin settles by `repository` evidence when the lockfile agrees, and an ADR's decision by `ruling`; a contract or data model settles only when behavior verification exercises its artifact, as described under sidecars. Version-pinned external evidence may settle claims about the world, such as a library's capability or a protocol's field, never a claim about this system; delegate that grounding to subagents with web tools in one parallel batch, naming the model on each dispatch, and have each return the source URL, the version it checked, and the date. On a stack pin, `version` is the package version and the document revision or fetch date goes in `note`, because the validator compares `version` to the pin. Check any claim you rely on before you pin it.

## Close the pass

Put this pass in an identifiable constitution commit, with code and specification changes in separate commits. Small related stage passes or patches can share one coherent pull request; preserve stage ownership and upstream ordering, and split unrelated or unwieldy work when that improves review. Run `pr-review-fix-loop` in `documents` mode for a constitution-only PR, or full review when it includes implementation.

## Validation checklist

- [ ] `validate` reports no errors; warnings are listed in your closing report.
- [ ] Every stack choice is concrete, version-pinned, and justified against the constraints it satisfies.
- [ ] ADRs cover every expensive-to-reverse choice; each the user didn't rule on in the session records two independent designs under "Alternatives considered".
- [ ] Every external pin names its source, the version checked, and the date.
- [ ] Every shipped surface has a sidecar whose artifact family matches the surface and whose `artifact_path` points into the code; no default OpenAPI on non-HTTP systems.
- [ ] No raw contract or data-model artifact was written under `.constitution/`.
- [ ] Every planned artifact's sidecar is `assumed` with `settles_when`.
- [ ] Every shape two concurrent epics depend on is `pinned`, with the needed entities and fields and decisive verification identified.
- [ ] An HTTP API, when present, defines an explicit error model.
- [ ] Native, mobile, and OS integration contracts match the declared platform targets.
- [ ] Durable shapes have sidecars; ephemeral-only systems declare `no_durable_state`.
- [ ] Compatibility and migration policies cover any schema or contract change that could break running clients or stored history.
- [ ] Every verification command and live-verification recipe is listed with `exists` and an owner when it does not exist yet.
- [ ] Every shipped surface has meaningful interface coverage, a gap-focused recipe, or an explicit local-verification limitation.
- [ ] Guidelines record the sourced development model and owner policy for comments, verification, remote tests, contribution CI, and release execution.
- [ ] Decision-changing assumptions have early executable grounding planned before dependent work, without speculative contract expansion.
- [ ] No product-scope change or boundary redesign leaked in, including one implied by a stack choice.
- [ ] Every flow maps to a contract and, when relevant, a data model, through the sidecars' `flows` fields.
- [ ] The layout is a designed target, with `exists: false` on paths not yet created.
- [ ] In the alignment pass, every routed code decision has a ruling or a follow-up.
- [ ] `tech-spec/changelog.yaml` has this pass's entry with its upstream versions.
