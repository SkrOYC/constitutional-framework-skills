---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
  upstream: {{ metadata.upstream | yaml_str }}
---

# Planning engineering execution

Stage 4 of the four-stage documentation pipeline. Read `references/framework-overview.md` before doing stage work. Decompose the contracts, schemas, and guidelines under `tech-spec/` into an epic graph under `tasks/epics/`. Every ticket carries an effort estimate, its place inside its epic, mode-tagged acceptance evidence, the flows it implements, and a certainty tag. Gherkin is one mode, not the only mode.

Schemas live in `~/.{{ harness.id }}/skills/constitution-tooling/assets/schemas/`; `epic.schema.json` is the output contract. Run `render` after writing epics and `validate` before declaring the pass complete.

## Inputs

1. **Upstream directories.** All of `prd/`, `architecture/`, and `tech-spec/`. Archetype, schemas, contracts, sidecars, and guidelines are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository and match the conventions in use.
3. **Conversation history.** Planning decisions, epic boundaries, and sequencing already settled in the session.
4. **Open decisions.** Read `reports/open-decisions.yaml`. A ticket that depends on an open entry isn't implementation-ready: plan the entry's spike ahead of it, or mark the ticket `open` with the decision and let it wait for the ruling. An entry the interview already closed with its own spike needs neither: treat it as settled and cite the spike.
5. **Certainty upstream.** The assumed records in `tech-spec/` sidecars, `architecture/boundaries.yaml`, and `prd/capabilities.yaml` decide sequencing and estimates, below.
6. **Actuals.** The `actuals` blocks of epics under `tasks/completed/`, and the `INFO-CAL` and `INFO-EST` lines from `validate`. `INFO-CAL` computes the actual-to-estimate ratio over epics whose estimate was planned independently; epics marked `estimate_source: migrated` or `backfilled` carry no forecast and don't count. State the project's observed diff lines per point and review rounds per point before estimating.
7. **Audit findings.** When planning from an audit, read the newest `reports/audit-*.md`; each ticket planned from a finding carries the finding's category and cites its evidence.
8. **Reconciliation follow-ups.** The newest `tasks/changelog.yaml` entry lists follow-ups and deferred tickets reconcile carried forward.

## Layer boundaries

Stage 4 doesn't write schemas, define contracts, choose patterns, or redefine requirements.

### Quote the stack, don't choose it

Verification commands, live-verification recipes, and in-scope paths name real commands, declared recipes, and real paths, copied from `tech-spec/guidelines.md` front matter. The validator errors on a ticket whose command or recipe is not listed there. Contract and data-model artifacts live in the code at the `artifact_path` their sidecar names; a ticket that creates or changes one lists that path in its scope. Listing a planned artifact's `artifact_path` in a ticket's scope is what links the sidecar to the ticket that creates it; Stage 4 never edits the sidecar. When guidelines lack the command, the recipe, or the layout a ticket needs, or a surface has no sidecar, stop and trigger a Stage 3 pass.

### Allowed decisions

- Epic boundaries, dependencies, owned paths (including the code paths of the artifacts the epic creates or changes), and patchable tech-spec files: sidecars, ADRs, `guidelines.md`, and `stack.yaml` only, never a raw artifact
- Ticket granularity: one ticket is one reviewable change; `8` is the ceiling and a ticket that needs more is two tickets
- Effort on the Fibonacci scale `1, 2, 3, 5, 8`, measuring relative effort and uncertainty, never time
- Where a `Spike` ticket must precede implementation
- Mode-tagged acceptance evidence
- The split between active scope and deferred scope
- The concurrency mechanics in `constitution.yaml`: worktree layout, branch naming, merge strategy

### Forbidden decisions

- Selecting or changing the technical stack
- Redefining endpoints, payloads, schemas, or contracts; a missing contract triggers a Stage 3 pass
- Scheduling work that reintroduces an `out-of-scope/` decision without a Stage 1 Evolution pass
- Writing `critical-path.md` by hand; `render` generates it

## The epic graph

Epics are the dependency nodes. Tickets depend only on tickets in the same epic; a cross-epic need is an epic dependency, and the validator rejects anything else. Waves are not written: `render` derives them as the layers of the epic graph, split wherever two epics in a layer overlap in owned paths or patchable files. A wave of one is a serial segment.

### Cut vertical slices

Every product epic delivers one or more capabilities end to end, through every boundary in `architecture/boundaries.yaml` that the capability's flow crosses, with tests. The boundary list makes the slice correct for the archetype by construction. Don't create horizontal layer epics such as "all repositories", "all drivers", or "all routes".

### Plan for execution

Resolve prerequisites, public contracts, implementation seams, and operational readiness before scheduling dependent implementation. Every ticket is a coherent outcome with focused verification and only the supplementary proof its tests cannot provide. Group routine corrections with their owning work; do not create tickets or agent assignments for individual formatter, type, or assertion edits. Record exclusions so incidental cleanup cannot silently widen an epic. The execution plan assigns check ownership and final gates rather than repeating full suites at every handoff.

### Size and split

Keep the merged diff of an epic near 10,000 to 15,000 lines; the reason is review cost, since a change in one area can expose a bug in another. Split an epic when the parts are scope-disjoint and the split either widens the wave the parts join or shortens the longest chain; `render` prints both numbers, so check them after splitting. A split that does neither is just more closeouts. Apply size guidance to the authored implementation reviewers must understand; retained logs and generated output do not justify artificial source milestones. Use declared `diff_exclusions` consistently for estimates and actuals, and disclose historical calibration that includes those artifacts rather than silently comparing unlike measures.

### Tooling first, then a serial foundation

The first epic contains repository tooling only: workspace, package manager, lint and format, test runners, CI, the reproducible environment, and the scaffold spike Stage 3 recommended. It contains no product behavior. The second epic is the substrate every product epic would otherwise race on, plus one end-to-end path through the primary surface. Every `pinned` contract lands here as a real artifact at its `artifact_path`, with a test that settles it, because concurrent product epics build against it. What that substrate is follows the archetype; the table is examples, and the rule is the substrate:

| Primary archetype | Foundation epic typically contains |
| :--- | :--- |
| Web/Cloud | The physical schema and migrations, identity context, generated clients, the shared UI kit, security test scaffolds |
| CLI/Tooling | The command tree skeleton, argument parsing, output conventions, one working command |
| Library/SDK | The public API skeleton, build and publish pipeline, one exported function with its contract test |
| System/Native | Process and IPC scaffolding, platform entry points, one round trip; or a pure core when everything else depends on it |
| ML/Data | Data loading and validation, the experiment harness, one end-to-end run on a small split |
| Embedded/IoT | Board bring-up, the hardware abstraction layer, one signal path |
| Mobile | App shell, navigation, persistence and sync scaffolding, one screen wired end to end |
| Web3 | Base contracts, deployment scripts, the test chain harness, one value-moving transaction under invariant test |
| Game/Sim | The engine loop, scene scaffolding, asset pipeline entry, one observable tick |
| IaC/Platform | Control plane skeleton, tenancy and policy scaffolding, state backend, one resource applied with a probe |

### Priority order

Record the user's ordering rules from the interview and apply them. When the user gives none: work that runs without a paid service first; core deterministic capability before optional or nondeterministic capability; what lets the primary actor do their main job before what serves secondary actors or the product's own operation.

### Sequence and estimate against certainty

A ticket is `settled` when every contract, schema, and boundary it touches is settled, and `assumed` otherwise. The tickets that first exercise an assumed contract come before the ones that build on it, so the thin slice falls out of the graph. An assumed ticket takes the next Fibonacci step up, or a preceding spike. When the observed ratio from actuals says assumed work costs more than settled work, say so in the changelog entry and estimate accordingly.

### Spike instead of silent choice

When the tech spec hasn't analysed a choice a ticket would otherwise make implicitly, or an open decision closes by spike, plan a `Spike` ticket ahead of the tickets it unblocks. Its `spike` field names `SPK-<ACRONYM>-<EPIC><NNN>` and, when it closes a register entry, `closes_decision` names it. An entry whose spike the interview already wrote and closed needs no ticket, and the validator rejects a ticket that carries an `OD` spike id or an active epic that takes `OD` as its id. A spike may recommend a contract change; the change goes through a Stage 3 pass and an ADR, never through the implementing ticket. The Spike template is at `assets/templates/spike.md`; the budget is the ticket's effort in points.

## Output files

If `tasks/` doesn't exist, run `init --stage tasks` for empty stubs, or create the files in this pass. If `changelog.yaml` doesn't exist yet, the first entry is `v0.0.1`. Run `render` after the epic files exist; it refuses to write if `tasks/` is absent.

### `tasks/epics/EPIC-<ID>-<slug>.yaml`, schema `epic.schema.json`

Header: id, name, kind (`tooling`, `foundation`, `product`, or `out_of_band` with its source), the capabilities it delivers, `depends_on`, `scope` with owned paths and patchable tech-spec files, `estimated_diff_lines`, optional priority. Then tickets:

- **id** as `<ACRONYM>-<EPIC><NNN>`, matching `constitution.yaml`
- **type**, **effort**, **depends_on** within the epic
- **scope** with in-scope paths under the epic's owned paths and optional out-of-scope paths; a ticket that creates a contract or data-model artifact includes its `artifact_path`
- **verification** quoting a guidelines command and the expected success signal
- **stop_conditions**: "STOP if CONDITION occurs; don't improvise."
- **description** at the behavioral level, no code
- **acceptance** with one primary mode, an evidence body fit to it, supplementary modes when they add proof, the constraint meters a benchmark or stat_threshold cites, and `recipe` naming the live-verification recipe when `live_probe` is among the modes
- **flows** the ticket implements, so flows have consumers
- **certainty** and **status** `planned`
- **category** only when planned from an audit finding

The epic file is also execution bookkeeping: the lead writes statuses, deviations, discovered decisions, and the closeout there. Leave those fields absent.

#### Acceptance modes

| Mode | Evidence body |
| :--- | :--- |
| `gherkin` | Given / When / Then scenarios for discrete, deterministic behavior |
| `benchmark` | Metric, threshold citing a PRD meter, and command |
| `stat_threshold` | Metric, dataset or split, threshold, and command |
| `invariant` | Invariant statement, checker or proof or fuzz command, corpus notes |
| `hitl_sil` | Hardware or software-in-the-loop procedure and pass/fail log criteria |
| `visual_regression` | Baseline reference produced independently of the run under test, never by that run: a pre-change capture for regions the ticket must not change, a reviewed reference for regions it changes on purpose. Plus diff threshold and command |
| `contract_test` | Exact assertions against the public surface or schema artifact |
| `runbook_probe` | Apply, plan, probe commands and the expected end state |
| `live_probe` | The recipe named in `recipe`, the scenario it drives from the recipe's seed state, and the evidence that proves it: the screen state, log line, response, or file the user or client would see |

Tests alone do not prove every shipped surface works. Add a live probe only for an acceptance gap the automated checks cannot establish. A ticket carries `live_probe`, as the primary mode or as a supplementary one next to the test-based mode, when its behavior depends on something its automated tests can't exercise faithfully: a served or built artifact, a device or runtime, a real external system, or interactive UI state. A ticket whose tests already drive the surface the user or client touches skips it: HTTP handler tests against the real router, CLI invocation tests, library contract tests. Tickets of one epic on the same surface share one probe scenario, and one manifest whose `covers` lists them. Plan the smallest observations that prove the scenario, not a transcript of every command. A probe manifest uses `mode: live_probe` even when the ticket's primary mode is test-based; measurement modes retain their own required comparison artifacts. The scenario must reach the state it names from the recipe's seed state on a fresh stack; a probe that can only pass on a prepared environment proves nothing. Gherkin is a poor fit for continuous-time properties; prefer benchmark, visual_regression, stat_threshold, or invariant there. Default primary mode by archetype: Web/Cloud and Mobile gherkin with contract_test on public contracts; CLI/Tooling gherkin or contract_test with benchmark when perf-constrained; Library/SDK contract_test; System/Native gherkin for discrete behavior and benchmark or visual_regression for loops and frames; ML/Data stat_threshold; Embedded/IoT hitl_sil or timing benchmark; Web3 invariant on-chain and gherkin off-chain; Game/Sim benchmark or visual_regression with gherkin for discrete flows; IaC/Platform runbook_probe.

### `constitution.yaml`, concurrency block

Record the mechanics the user chose: worktree layout, branch naming, merge strategy. `execute-wave` and the epic lead read them from there and don't improvise.

### `tasks/critical-path.md`

Generated. Run `render` after every change to the epic files and commit the result.

### `tasks/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump, the upstream versions, and the observed calibration ratio you planned against.

## Out-of-band epics from issues

When `execute-epic-end-to-end` dispatches a planning pass for a GitHub issue, plan one epic with `kind: out_of_band` and `source: github#<n>`: derive tickets from the issue body and comments, assign modes and certainty, declare owned paths and patchable files, estimate. No wave placement and no dependencies on the critical path. `render` reports its conflicts with the running wave; whether it waits was decided in the epic lead's step-0 plan, so the pass records the conflict and doesn't ask.

## Brownfield maintenance audit

Before reshaping active work in a Brownfield repository: completed epics sit in `completed/` with actuals, `validate` is clean, and `guidelines.md` still matches implementation reality. When the previous epic drifted from guidelines, report the mismatch and name Stage 3 as its owner.

## Close the pass

Open one pull request for this stage's constitution commit, separate from any other stage, and have it reviewed with `pr-review-fix-loop` in `documents` mode. A single-stage PR converges; a PR carrying the whole pipeline does not.

## Validation checklist

- [ ] `validate` reports no errors and `render` has been run; warnings and the `INFO-EST` line are in your closing report.
- [ ] Every ticket is one reviewable change, estimated at 8 or less, and reasonably satisfies INVEST.
- [ ] Every dependency is explicit, inside its epic, and acyclic; the epic graph is acyclic.
- [ ] Every ticket has a primary mode with mode-valid evidence, and benchmark or statistical modes cite PRD meters.
- [ ] Every ticket names the flows it implements, and every flow has at least one consumer.
- [ ] Every ticket-owned spike is a `Spike` ticket with a spike id, and every open decision with spike closure has its spike planned ahead of what it blocks unless the interview already wrote and closed it.
- [ ] No ticket invents an upstream contract, schema, or API; every command and path traces to guidelines.
- [ ] No ticket reintroduces an out-of-scope decision.
- [ ] Every product epic is a vertical slice through the boundaries its capabilities cross, with owned paths and patchable files declared, and its estimated diff lines near the range.
- [ ] The tooling epic contains no product behavior and the foundation epic precedes every product epic.
- [ ] Every `pinned` contract is created and settled in the foundation epic, and every planned artifact's `artifact_path` is in the scope of the ticket that creates it.
- [ ] No `tech_spec_patchable` entry names a raw artifact.
- [ ] Every ticket whose behavior its tests can't exercise faithfully on a surface with a live-verification recipe carries `live_probe` with its `recipe`, and no ticket carries a probe that repeats its tests.
- [ ] Estimates cite the `INFO-CAL` ratio, or say there isn't one yet.
- [ ] Concurrent epics are scope-disjoint; the rendered waves and longest chain were checked after any split.
- [ ] Assumed tickets are sequenced after the tickets that settle what they depend on, and estimated accordingly.
- [ ] No ticket, epic, or spike carries a date, hour, day, or calendar commitment.
- [ ] `tasks/changelog.yaml` has this pass's entry.
