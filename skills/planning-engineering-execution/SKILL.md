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

Schemas live in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`; `epic.schema.json` is the output contract. Run `render` after writing epics and `validate` before declaring the pass complete.

## Inputs

1. **Upstream directories.** All of `prd/`, `architecture/`, and `tech-spec/`. Archetype, schemas, contracts, sidecars, and guidelines are binding.
2. **Codebase reality.** In Brownfield or Evolution mode, inspect the repository and match the conventions in use.
3. **Conversation history.** Planning decisions, epic boundaries, and sequencing already settled in the session.
4. **Open decisions.** Read `reports/open-decisions.yaml`. A ticket that depends on an open entry isn't implementation-ready: plan the entry's spike ahead of it, or mark the ticket `open` with the decision and let it wait for the ruling. An entry the interview already closed with its own spike needs neither: treat it as settled and cite the spike.
5. **Certainty upstream.** The assumed records in `tech-spec/` sidecars, `architecture/boundaries.yaml`, and `prd/capabilities.yaml` decide sequencing and estimates, below.
6. **Actuals.** The `actuals` blocks of epics under `tasks/completed/`, and the `INFO-CAL` and `INFO-EST` lines from `validate`. `INFO-CAL` computes the actual-to-estimate ratio over epics whose estimate was planned independently; epics marked `estimate_source: migrated` or `backfilled` carry no forecast and don't count. State the project's observed diff lines per point and review rounds per point before estimating.
7. **Audit findings.** When planning from an audit, read the newest `reports/audit-*.md`; each ticket planned from a finding carries the finding's category and cites its evidence.
8. **Deferred obligations.** Read the generated `Outstanding obligations` view in `tasks/critical-path.md` and its source records in active and archived epics. Check the newest `tasks/changelog.yaml` and the owners' rulings before carrying work forward. An obligation remains outstanding until explicit delivery or retirement evidence closes it.

## Layer boundaries

Stage 4 doesn't write schemas, define contracts, choose patterns, or redefine requirements.

### Quote the stack, don't choose it

Verification commands, live-verification recipes, and in-scope paths come from `tech-spec/guidelines.md` front matter. The validator errors on an undeclared command or recipe. Follow the sourced owner policy in its body for local verification, remote tests, contribution CI, and release execution. Contract and data-model artifacts live in the code at their sidecar's `artifact_path`; a creating or changing ticket includes that path in its scope. This links a planned artifact to its creating ticket without Stage 4 editing the sidecar. When a required command, recipe, layout, or sidecar is missing, route the repair to Stage 3 through the authorized stage pass. Hold only work that depends on the repair.

### Allowed decisions

- Epic boundaries, dependencies, owned paths (including the code paths of the artifacts the epic creates or changes), and patchable tech-spec files: sidecars, ADRs, `guidelines.md`, and `stack.yaml` only, never a raw artifact
- Ticket granularity: one ticket is one reviewable outcome, forecast on the supported effort scale; split a larger forecast along meaningful outcomes
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

Every product epic delivers one or more capabilities end to end, through every boundary its flows cross, with meaningful behavior verification. The boundary list makes the slice fit the archetype. Don't create horizontal layer epics such as "all repositories", "all drivers", or "all routes".

### Plan for execution

Identify prerequisites, public contracts, implementation seams, and operational readiness before scheduling dependent implementation. Use the cheapest executable pilot or probe early when an uncertain prerequisite could change the plan. It holds only dependent work; unrelated lanes can proceed.

Every ticket is a coherent outcome with focused verification. Prefer real public-interface behavior and meaningful coverage; a ticket doesn't require a new test. Isolated unit tests are rare high-value exceptions. Don't introduce test-per-ticket quotas, blanket test-driven development, coverage targets, or reassuring comments. Follow the guidelines' comment and owner verification policy, including required project gates.

Group routine formatting, types, and focused checks with the owning worker assignment. Record exclusions so incidental cleanup cannot widen an epic. The execution plan names check ownership and final gates, and reuses results while their inputs, environment, and coverage remain valid. Independent milestone review and PR integration review remain distinct obligations.

Use the smallest lead structure that fits: one epic can run directly under its epic lead, including the required merge and reconciliation duties. Within the approved outcomes, acceptance, scope, contracts, dependencies, resources, and authority, the lead can regroup or split milestones and reorder independent steps. A guide overrun doesn't require a wave amendment; escalate shared decisions or changes outside that envelope.

### Size and split

Use 10,000 to 15,000 authored diff lines as an epic review guide. Before execution, aggregate the proposed work, apply `diff_exclusions` consistently, and account for worker context and actual resource constraints. Generated output and retained logs don't justify artificial source milestones. Disclose calibration measured with different exclusions.

Split when scope-disjoint parts improve review or feasible concurrency, or shorten the longest chain; check `render` after changing the graph. Path-disjoint work still competes for slots, memory, devices, services, and budget. A numerical overrun alone doesn't justify late reslicing, another approval, or extra closeouts; preserve coherent outcomes and independent review.

### Establish missing prerequisites first

Plan missing repository tooling before work that needs it: workspace, package manager, lint and format, verification drivers, reproducible environment, and the scaffold checks Stage 3 identified. A tooling epic contains no product behavior. CI/CD work follows the recorded development model and owner policy; don't add remote tests or release gates by habit.

When product epics share missing substrate, establish it in a serial foundation with one thin path through the primary interface. Every missing `pinned` contract lands at its `artifact_path` with decisive interface verification before concurrent consumers. Reuse substrate and evidence that already exist. The foundation fits the archetype:

| Primary archetype | Foundation epic typically contains |
| :--- | :--- |
| Web/Cloud | The physical schema and migrations, identity context, generated clients, the shared UI kit, a security boundary probe |
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

A ticket is `settled` when every contract, schema, and boundary it touches is settled, and `assumed` otherwise. Put the cheapest decisive exercise of a risky assumed contract before its consumers. Adjust estimates using the uncertainty and observed actuals; don't inflate every assumed ticket mechanically. State any calibration used in the changelog entry.

### Spike instead of silent choice

When an unanswered choice could change implementation, use the cheapest decisive evidence. Plan a bounded `Spike` ticket before its dependents when execution is needed, or when an open decision specifies spike closure. Don't create a spike for a question existing evidence answers. Its `spike` field names `SPK-<ACRONYM>-<EPIC><NNN>`; `closes_decision` names a register entry it closes. An interview-owned spike already closed needs no ticket. The validator rejects a ticket with an `OD` spike id or an active epic with id `OD`.

A spike may recommend a contract change. The owning stage makes that repair through the authorized route; Stage 4 and the implementing worker don't rewrite it. The template is `assets/templates/spike.md`, and the budget is the ticket's effort in points. Stop investigation when the decision has enough evidence.

## Output files

If `tasks/` doesn't exist, run `init --stage tasks` for empty stubs, or create the files in this pass. If `changelog.yaml` doesn't exist yet, the first entry is `v0.0.1`. Run `render` after the epic files exist; it refuses to write if `tasks/` is absent.

### `tasks/epics/EPIC-<ID>-<slug>.yaml`, schema `epic.schema.json`

Header: id, name, kind (`tooling`, `foundation`, `product`, or `out_of_band` with its source), the capabilities it delivers, `depends_on`, `scope` with owned paths and patchable tech-spec files, `estimated_diff_lines`, optional priority. Then tickets:

- **id** as `<ACRONYM>-<EPIC><NNN>`, matching `constitution.yaml`
- **type**, **effort**, **depends_on** within the epic
- **scope** with in-scope paths under the epic's owned paths and optional out-of-scope paths; a ticket that creates a contract or data-model artifact includes its `artifact_path`
- **verification** quoting a guidelines command and the expected success signal
- **stop_conditions** with concrete conditions outside the approved envelope, the affected work to hold, and its repair or escalation route
- **description** at the behavioral level, no code
- **acceptance** with one primary mode, an evidence body fit to it, supplementary modes when they add proof, the constraint meters a benchmark or stat_threshold cites, and `recipe` naming the live-verification recipe when `live_probe` is among the modes
- **flows** the ticket implements, so flows have consumers
- **certainty** and **status** `planned`
- **category** only when planned from an audit finding
- **replaces**, optionally, with the exact source references of deferred obligations this ticket takes over

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

Acceptance modes specify proof, not a requirement to add a test. Match evidence to the claim and risk. Existing interface coverage can satisfy several tickets; source-based proof can establish a structural invariant when the mode permits it. Disclose unavailable execution and any remaining acceptance gap.

Add `live_probe` only for a gap existing verification cannot establish faithfully: a served or built artifact, device, runtime, external system, or interactive UI state. Coverage that drives the real router, CLI invocation, or library public surface needs no duplicate probe. Tickets of one epic on the same surface can share one scenario and one manifest whose `covers` lists them. Plan the smallest observations that prove the scenario. The manifest uses `mode: live_probe` even when that mode is supplementary; measurement modes retain their comparison artifacts. The scenario must reach its named state from the recipe's seed state on a fresh stack.

Gherkin fits discrete, deterministic behavior. Prefer benchmark, visual_regression, stat_threshold, or invariant for continuous properties. Defaults by archetype: Web/Cloud and Mobile gherkin with contract_test on public contracts; CLI/Tooling gherkin or contract_test with benchmark for performance constraints; Library/SDK contract_test; System/Native gherkin for discrete behavior and benchmark or visual_regression for loops and frames; ML/Data stat_threshold; Embedded/IoT hitl_sil or timing benchmark; Web3 invariant on-chain and gherkin off-chain; Game/Sim benchmark or visual_regression with gherkin for discrete flows; IaC/Platform runbook_probe.

### `constitution.yaml`, concurrency block

Record the mechanics the user chose: worktree layout, branch naming, merge strategy. `execute-wave` and the epic lead read them from there and don't improvise.

### `tasks/critical-path.md`

Generated. Run `render` after every change to the epic files and commit the result.

### `tasks/changelog.yaml`, schema `changelog.schema.json`

Add this pass's entry with the SemVer bump, the upstream versions, and the observed calibration ratio you planned against.

### Deferred obligations

The generated view follows deferred tickets, `closeout.tickets_deferred`, and `closeout.follow_ups` through active and archived epics. To take over work, set a replacement ticket's `replaces` to the exact source references from that view: an original ticket id, or `EPIC-A#follow-up:<digest>`, where `<digest>` is the first 12 lowercase hexadecimal characters of the exact follow-up text's UTF-8 SHA-256 hash. Copy the generated reference; reordering or archiving doesn't change it.

Replacement ownership doesn't prove delivery. Execution records terminal closure in `closeout.obligation_resolutions`: `source`, `outcome: delivered` or `retired`, and common-schema `evidence`; retirement also requires `reason`. Don't infer closure from a done status, similar work, or an unsupported claim. Preserve existing owners and rulings, and route upstream policy changes to their owning stage. Don't create a separate manual obligation ledger.

## Out-of-band epics from issues

When `execute-epic-end-to-end` dispatches a planning pass for a GitHub issue, plan one epic with `kind: out_of_band` and `source: github#<n>`. Derive tickets from the issue, assign modes and certainty, declare scope, and estimate. It stays outside automatic waves but honors every actual prerequisite, including in-band epics. An unfinished out-of-band prerequisite holds its in-band dependents and their transitive dependents; unrelated work can proceed. `render` also reports path conflicts. Apply the epic lead's approved policy to those conflicts without another routine approval.

## Brownfield maintenance audit

Before reshaping active work in a Brownfield repository: completed epics sit in `completed/` with actuals, `validate` is clean, and `guidelines.md` still matches implementation reality. When the previous epic drifted from guidelines, report the mismatch and name Stage 3 as its owner.

## Close the pass

Put this pass in an identifiable constitution commit. Small related stage passes or patches can share one coherent pull request. Preserve stage ownership and upstream ordering, and keep code and specification changes in separate commits. Run `pr-review-fix-loop` in `documents` mode for a constitution-only PR, or full review when it includes implementation. Split unrelated or unwieldy work when that improves review.

## Validation checklist

- [ ] `validate` reports no errors and `render` has been run; warnings and the `INFO-EST` line are in your closing report.
- [ ] Every ticket is one reviewable outcome, uses the supported effort scale, and reasonably satisfies INVEST.
- [ ] Ticket dependencies stay inside their epic; both ticket and epic dependencies are explicit and acyclic.
- [ ] Every ticket has a primary mode with mode-valid evidence, and benchmark or statistical modes cite PRD meters.
- [ ] Every ticket names the flows it implements, and every flow has at least one consumer.
- [ ] Every ticket-owned spike is a `Spike` ticket with a spike id, and every open decision with spike closure has its spike planned ahead of what it blocks unless the interview already wrote and closed it.
- [ ] No ticket invents an upstream contract, schema, or API; every command and path traces to guidelines.
- [ ] No ticket reintroduces an out-of-scope decision.
- [ ] Every product epic is a vertical slice with declared scope; authored diff estimates, exclusions, and resource constraints support coherent execution.
- [ ] Tooling contains no product behavior; missing tooling and shared foundation precede only the work that needs them.
- [ ] Every missing `pinned` contract has a creating ticket and decisive interface verification before its consumers; planned artifacts appear in their creating tickets' scope.
- [ ] No `tech_spec_patchable` entry names a raw artifact.
- [ ] Acceptance uses meaningful interface coverage or focused proof, with `live_probe` and its `recipe` only for a real gap; no test-per-ticket quota was introduced.
- [ ] Estimates cite the `INFO-CAL` ratio, or say there isn't one yet.
- [ ] Concurrent epics are scope-disjoint; the rendered waves and longest chain were checked after any split.
- [ ] Assumed tickets are sequenced after the tickets that settle what they depend on, and estimated accordingly.
- [ ] Deferred obligations have explicit ownership or remain visibly outstanding; delivery and retirement claims have evidence.
- [ ] Out-of-band prerequisites hold only their dependent work, including transitive dependents.
- [ ] No ticket, epic, or spike carries a date, hour, day, or calendar commitment.
- [ ] `tasks/changelog.yaml` has this pass's entry.
