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

Stage 3 of the four-stage documentation pipeline. Read `references/framework-overview.md` before you start. Convert the logical boundaries and flows under `architecture/` into the technical decisions under `tech-spec/`: the stack gets chosen, expensive-to-reverse decisions become ADRs, the verification and layout Stage 4 quotes get declared, and every durable shape and shipped surface gets a sidecar that says which artifact in the code carries it.

`tech-spec/` records decisions and points at the code; it doesn't hold a second copy of it. Raw artifacts (SQL, migrations, OpenAPI, AsyncAPI, JSON Schema, `.proto`, public headers) live in the repository where the code builds from them. Keeping them inside `tech-spec/` doubles every change and turns ordinary code edits into spec-patch cycles.

Read the archetype in `constitution.yaml` and the operator preferences in `prd/vision.md`. Do not default to HTTP/OpenAPI unless an HTTP API surface exists. Schemas live in `~/.{{ harness.id }}/skills/constitution-tooling/assets/schemas/`; run `validate` before declaring the pass complete.

## Passes

| Pass | When | Writes |
| :--- | :--- | :--- |
| Decisions | Before Stage 4, and in Evolution when a decision changes | Stack pins, ADRs, guidelines, sidecars with planned artifact paths, pinned cross-epic contracts |
| Alignment | After a wave merges and `reconcile` runs, in Brownfield mode | Guidelines and ADR updates for the code decisions the user adopts, sidecars pointed at real artifacts, records settled by repository evidence |

Identify the pass before you start. The alignment pass never reopens a decision the decisions pass settled by ruling unless the user asks.

## Inputs

1. **Upstream files.** All of `prd/` and `architecture/`. Archetype, constraints, boundaries, and flows are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, the stack, dependencies, layout, and artifacts that exist are `repository` evidence; cite the lockfile and paths. `derive` reports where `stack.yaml` pins and the `guidelines.md` layout disagree with the tree and the lockfile.
3. **Conversation history and the interview record.** Decisions settled in the session are `ruling` evidence. Pinned sources a preceding interview recorded are `external` evidence; cite them with their `version` and date rather than fetching them again.
4. **Open decisions.** Read `reports/open-decisions.yaml`; a pin, sidecar, or ADR that depends on an open entry is `open`.
5. **Reconciliation routing.** Read every reconciliation report written since this directory's last changelog entry (`reports/<date>-reconciliation[-<n>].yaml`, ordered by date, then run number): drift that could not be patched, commands that never came to exist, records that could not be settled, and the `code_decisions` execution recorded. In the alignment pass these are the agenda.

## Layer boundaries

Don't rewrite product scope, redesign logical boundaries, or generate task lists.

### Allowed decisions

- The bill of materials: runtime, language, frameworks, packages, databases, tooling, all version-pinned
- Which artifact carries each durable shape and each shipped surface, its format, and where it lives in the repository
- The shape of contracts that cross epic boundaries, at the level of entities and fields, when concurrent epics depend on them
- Migration and compatibility policies
- The concrete directory structure of the repository
- ADRs for expensive-to-reverse choices
- Coding standards, linting, formatting, commit conventions, test-coverage rules, the verification commands Stage 4 will quote, and the live-verification recipes that prove behavior on the running system
- Vendor-specific guidance only after that vendor is chosen

### Forbidden decisions

- Expanding, reducing, or redefining product scope
- Altering boundary responsibilities, trust boundaries, or protocol categories
- Dividing work into tasks, tickets, or epics
- Writing raw contract or data-model artifacts inside `.constitution/`

## Output contract

If `tech-spec/` doesn't exist, run `init --stage tech-spec` for empty stubs, or create the files in this pass. If `changelog.yaml` doesn't exist yet, the first entry is `v0.0.1`.

### `tech-spec/stack.yaml`, schema `stack.schema.json`

One record per bill-of-materials entry with role, exact pin, ecosystem, justification, optional radar ring, and certainty. The validator compares pins against the lockfile for npm, bun, cargo, and pub, so a pin the lockfile contradicts is an error and a pin absent from it is a warning. A compatibility policy names the pinning rule, the lockfiles, and the upgrade boundaries. When the system owns nothing durable, say so in `no_durable_state` instead of inventing a database. Once a lockfile exists, `derive --write` keeps the pins in step with it; the justification and the choice stay yours.

### `tech-spec/guidelines.md`, front matter schema `guidelines.schema.json`

Front matter carries the facts Stage 4 and execution read:

- the verification commands with `exists` and, for each that does not exist yet, the ticket that will create it
- the layout as path and purpose records, including where each artifact kind lives
- the commit convention
- the live-verification recipes, below

The body holds coding standards, observability hooks, deployment and migration rules, and any safety standard such as MISRA for regulated C/C++. Commands are bare, with the environment already active; only the tooling epic's tickets carry a bootstrap prefix.

The validator resolves every command marked as existing and errors on one that does not. Once `tasks/` is present, it also errors on a missing command with no owning ticket. Stage 4 may quote only commands listed here.

#### Live-verification recipes

Tests prove the code; a recipe proves the running system. Declare one recipe per shipped surface a user or client touches: `name`, `surface`, `launch` (start the system locally), `doctor` (a readiness probe that fails fast), `drive` with `drive_kind` (a command, a named tool such as a browser or terminal controller, or a manual procedure), `evidence` (the kind and where it lands: a screenshot, a log line, an HTTP response, a file), `cleanup`, and `exists` with an owning ticket while it doesn't exist yet. Stage 4 cites a recipe from a ticket's `live_probe` acceptance when the ticket's tests can't exercise that surface faithfully, and the epic lead runs it once per epic, after the last milestone and before the closeout. A surface nobody can drive locally says so in the guidelines body with the reason, instead of declaring a recipe that can't run.

### `tech-spec/adrs/ADR-<NNNN>-<slug>.md`, front matter schema `adr.schema.json`

One file per expensive-to-reverse choice: contract family, persistence engine, compatibility break policy, cloud vendor, platform IPC model. Front matter: id, status, date, supersession links, and certainty for the decision itself, settled by the ruling that made it. Body in a consistent MADR or Nygard shape: context, decision, alternatives considered, consequences. Consequences stay assumed until observed; say so in the body rather than in the front matter.

#### Design it twice

For every ADR-level choice the user hasn't already ruled on in the session, get two independent designs before you recommend one. Dispatch {% if harness.id == "claude" %}two designers in one parallel batch, on different runtimes: one Claude subagent on Opus through the Agent tool, and one Codex subagent on its strongest available model through the `codex-subagent` skill's one-off form. Name the model on each dispatch.{% elif harness.id == "codex" %}one Codex designer through `collaboration.spawn_agent` and, when an independent runtime is available, one pi designer through `pi-subagent`. Otherwise use a second Codex model. Name the model and reasoning effort on each Codex dispatch, with `fork_turns: "none"`.{% else %}two designers in one parallel batch, on different runtimes: one `spawn_subagent` (do not pass a subagent type; pass `model` when the user named one, otherwise omit it), and one Codex subagent on its strongest available model through the `codex-subagent` skill's one-off form. Name the model on each dispatch that takes one.{% endif %} Give both the same brief: the question, the binding architecture boundaries and flows, the PRD constraint meters it must satisfy, and the operator preferences. Withhold your own view and each other's output.

Screen both candidates against the Depth Standard and the Deletion Test, and against the risks in `architecture/risks.md`. Then synthesise: pick a base, graft what the other did better, and record both candidates and the reason for the pick under "Alternatives considered". When the two converge independently, say so; that is strong signal. When they diverge on a point you can't settle, state the question in register shape for the user. Skip the second design only for a choice that is cheap to reverse, and say so in one line.

### Contract and data-model sidecars, `tech-spec/contracts/<name>.meta.yaml` and `tech-spec/data-models/<name>.meta.yaml`

Every durable shape the system owns and every shipped or integration surface gets a sidecar, schema `meta.schema.json`. The sidecar names the surface kind, the flows it serves, the boundaries it belongs to, an optional validation command, and certainty, and it sets `artifact_path` to the repository-relative path of the artifact in the code: the migrations directory, the OpenAPI file the server or client generator reads, the `.proto` package, the public header. The artifact itself is never under `.constitution/`.

- **Planned artifacts.** In greenfield the artifact doesn't exist yet. The sidecar is `assumed` and states `settles_when`. Leave `owner` empty: tickets don't exist yet, and Stage 4 links the artifact to its creating ticket by putting the `artifact_path` in that ticket's scope. Once `tasks/` exists, the validator accepts a missing path only when an active ticket creates it that way.
- **Pinned contracts.** When two epics that can run in the same wave depend on one shape (an identifier, an event, an error model, a table both write), mark its sidecar `pinned: true` and write the shape at the level of entities and fields in the companion markdown: what each field means and which values are allowed, not the full artifact. Stage 4 plans the artifact into the foundation epic, and the validator errors when a pinned contract is neither settled nor present while epics are active. Everything else is left to the epic that owns it.
- **Companion markdown.** Purpose and invariants a reader needs and the artifact can't state, in `tech-spec/contracts/` or `tech-spec/data-models/` next to the sidecar, with the same stem (`orders.md` next to `orders.meta.yaml`), and named in the sidecar's `companion` field.

A contract settles when tests exercise it, which execution reports and reconcile applies; write `settles_when` so the lead knows what counts.

Selection algorithm: list surfaces from the boundaries and the P0 flows, pick the ecosystem-native artifact kind, decide where it lives in the layout, and emit sidecars only for surfaces that exist.

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

A repository that still keeps raw artifacts next to their sidecars gets a warning from the validator. Move them in two commits, because the two-commit rule applies: first a code commit that puts the artifact where the code builds from it (usually it is already there, and the tech-spec copy is the duplicate); then a patch-lane constitution commit that sets `artifact_path`, deletes the copy, and updates the `surfaces` globs in `constitution.yaml` so the glossary check follows the artifact.

### `tech-spec/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump and the `upstream` field naming the `prd/` and `architecture/` versions.

## The alignment pass

Run it after a wave's pull requests merge and `reconcile` has run, or when the reconciliation report routes items here. The code is the truth about the physical layer; your job is to record what it settled and put the decisions it made in front of the user.

1. Run `derive` and `validate`. Mechanical drift (pins, layout flags) is fixed with `derive --write`; don't hand-edit it.
2. Read the reconciliation report's `code_decisions`: dependencies, patterns, conventions, and contract shapes execution introduced without a Stage 3 record. For each, present what the code did, where, and your recommendation: adopt it into the guidelines or an ADR, or treat it as a defect and route it to Stage 4 as a follow-up. The user rules; an adopted decision is `settled` by `ruling` plus `repository` evidence.
3. Point every sidecar whose artifact now exists at its real path, and settle it with the test evidence the closeouts cite.
4. Leave the ADRs' decisions alone; update their consequences with what was observed.
5. Add the changelog entry and run `validate`.

## Closing with a scaffold spike

When no code exists yet, close the decisions pass by recommending a scaffold spike: create the empty layout from guidelines, including the locations sidecars point at, compile it, wire the verification commands so they pass on nothing, check that each live-verification recipe's `launch` and `doctor` run, and report every contradiction. That is the cheapest way to turn unknown knowns into settled facts before Stage 4 plans against them. Stage 4 plans it as the tooling epic's first ticket; Stage 3 does not write code.

## Certainty in Stage 3

A stack pin settles by `repository` evidence when the lockfile agrees. An ADR's decision settles by `ruling`. A contract or data model settles only when tests exercise its artifact, so in greenfield every sidecar is `assumed` with `settles_when` stated. External evidence, pinned to a version, may settle claims about the world such as a library's capability or a protocol's field, never a claim about this system. Delegate that grounding to subagents with web tools, in one parallel batch, naming the model on each dispatch. Each returns the source URL, the version it checked, and the date. On a stack pin, `version` is the package version and the document revision or fetch date goes in `note`, because the validator compares `version` to the pin. Check any claim you rely on before you pin it.

## Close the pass

Open one pull request for this stage's constitution commit, separate from any other stage, and have it reviewed with `pr-review-fix-loop` in `documents` mode. A single-stage PR converges; a PR carrying the whole pipeline does not.

## Validation checklist

- [ ] `validate` reports no errors; warnings are listed in your closing report.
- [ ] Every stack choice is concrete, version-pinned, and justified against the constraints it satisfies.
- [ ] The ADR set covers every expensive-to-reverse choice, and each one the user didn't rule on in the session records two independent designs under "Alternatives considered".
- [ ] Every external pin names its source, the version checked, and the date.
- [ ] Every shipped surface has a sidecar whose artifact family matches the surface and whose `artifact_path` points into the code; no default OpenAPI on non-HTTP systems.
- [ ] No raw contract or data-model artifact was written under `.constitution/`.
- [ ] Every planned artifact's sidecar is `assumed` with `settles_when`.
- [ ] Every shape two concurrent epics depend on is a `pinned` sidecar with its entities and fields written down.
- [ ] When an HTTP API exists, it defines an explicit error model.
- [ ] Native, mobile, and OS integration contracts match the declared platform targets.
- [ ] Durable shapes have sidecars; ephemeral-only systems declare `no_durable_state`.
- [ ] Compatibility and migration policies cover any schema or contract change that could break running clients or stored history.
- [ ] Every verification command and live-verification recipe is listed with `exists` and an owner when it does not exist yet.
- [ ] Every shipped surface a user or client touches has a live-verification recipe, or the guidelines say why it can't be driven locally.
- [ ] No product-scope change or boundary redesign leaked in, including one implied by a stack choice.
- [ ] Every flow maps to a contract and, when relevant, a data model, through the sidecars' `flows` fields.
- [ ] The layout is a designed target, with `exists: false` on paths not yet created.
- [ ] In the alignment pass, every routed code decision has a ruling or a follow-up.
- [ ] `tech-spec/changelog.yaml` has this pass's entry with its upstream versions.
