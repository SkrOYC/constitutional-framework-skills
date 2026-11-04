---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  stage: {{ metadata.stage | yaml_str }}
  artifact: {{ metadata.artifact | yaml_str }}
---

# Constitution tooling

One CLI, run from the skills directory against any repository, so it never enters the project's dependency graph:

```bash
bun run ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/cli.ts <command> --root <repo> [--json]
```

The structured constitution keeps facts that something reads mechanically in YAML files validated by the schemas under `assets/schemas/`, and prose in markdown with front matter where one fact must be read. `references/layout.md` lists every file, its schema, and who writes it. `references/checks.md` lists every check id the validator can print. Stage skills hand the relevant schema to the agent writing a file; the schema is the output contract.

{% if harness.id == "codex" %}For communication with Claude at any role, read [Coordinate Codex and Claude](references/codex-claude-bridge.md). Use the bundled `scripts/ccbridge.ts` for the persistent inbox, explicit-address sends, one-hour blocking waits, and read acknowledgments. Keep sending and receiving active together throughout an exchange. Never poll the outer wrapper; keep both tool layers blocked for the pending receive window.

{% endif %}## Commands

| Command | What it does | Who runs it |
| :--- | :--- | :--- |
| `validate` | Schemas, cross-file invariants, and repository-facing checks. Missing later stages are not errors; coverage checks that need a later stage run once that stage is present. Exit 1 on any error. `--json` for machine output. | One execution owner for the current validation inputs; stages, leads, and reviewers inspect that result and rerun when inputs change; reconciliation before and after |
| `init --acronym ABC --archetype <name>` | Scaffolds Stage 1 files that validate, with `prd/changelog.yaml` at `v0.0.1`. Optional `--secondary a,b`, `--default-branch`. Refuses if `.constitution/` already exists; use `--stage` instead. | Stage 1, once, on a repository with no constitution |
| `init --stage STAGE` | Adds one stage's empty files to an existing constitution. `STAGE` is `prd`, `architecture`, `tech-spec`, or `tasks`. Refuses if the stage already has files, or if an upstream stage is missing. `--stage prd` on an interview-only tree needs `--acronym` and `--archetype` when `constitution.yaml` is missing. P0 coverage checks start applying once `architecture/` exists. | The matching stage skill, at the start of the pass |
| `render` | Regenerates `tasks/critical-path.md` from active and archived epic records: totals, longest chain, eligible waves, blocked prerequisites, out-of-band conflicts, outstanding obligations, build order, ticket order, and concurrency mechanics. `--stdout` prints instead of writing. Refuses to write if Stage 4 has not been executed. | Stage 4 after writing epics; reconcile runs it itself |
| `migrate` | Converts a markdown constitution to the structured layout, then renders. Before removing a nonempty source, preserves its exact bytes under the repository-root `.constitution-migration-sources-<unique>/` directory and records source, destination, and conservation work in `.constitution-migration-report.md`. Unsupported and partially recognized content requires manual review. `--date` fixes the date. Migrated epics carry `estimate_source: migrated` and no estimate; actuals never become estimates. | Once per repository, in a worktree |
| `migrate --repair-estimates` | On an already structured constitution, marks every completed epic whose planned estimate equals its measured diff as `estimate_source: backfilled`, editing that one line in place, and prints the files. It never runs the markdown migration and never commits. | Once, on a repository migrated before estimates carried a source |
| `format` | Re-emits the four stage changelogs (`--all`: every YAML data file outside `completed/`, `archived/`, `evidence/`, `reports/`) in the canonical block style: scalar lists stay inline only when the line is 80 characters or shorter, longer ones get one item per line. Skips files with comments and any file whose parsed value would change. `--check` writes nothing and exits 1 when a file would change. `reconcile` and `derive` prepend changelog entries as text, so they never reformat older entries. | Once per repository to normalize changelogs; local verification or an owner-required contribution CI check as `format --check` |
| `derive` | Compares the mechanical facts tech-spec restates with the repository: stack pins against lockfiles (DRV-001) and layout `exists` flags against the tree (DRV-002), plus report-only findings (DRV-003). Exit 1 on unapplied drift. `--write` applies DRV-001 and DRV-002 and adds a patch-level tech-spec changelog entry with `by: derive`; `--date` fixes its date, `--json` for machine output. Rewriting re-emits the YAML of `stack.yaml` and the guidelines front matter, so comments there are lost and long lists change to block style, as with `reconcile`. The tech-spec changelog entry is prepended as text, so older entries stay byte-identical. `reconcile` never makes these edits. | `execute-wave` after `reconcile`, committed as a constitution-only commit; anyone checking tech-spec against the code |
| `check-plan <file>` | Validates front matter against `epic-plan.schema.json` and cross-checks epic identity, registered decisions, active siblings, explicit invocation mode, and one autonomy entry per trigger. A standalone or direct single-epic wave cannot escalate to a separate wave lead. A bundle starts each plan at `<!-- plan: EPIC-XX -->` immediately followed by its own `---` front matter; plans are checked separately and together for sibling and merge-order consistency. Without markers, the file holds one plan. `kind` is `epic`, `fast_lane`, or `no_constitution`; the latter two use `FAST-<slug>` or `ISSUE-<number>` and `epic_file: none`. `no_constitution` skips constitution cross-checks. Milestone bodies stay unchecked. Exit 1 on errors; `--json` for machine output. The file resolves from the current directory; `--root` names its repository. | The epic lead in standalone step 0, and `execute-wave` on every plan before approval |
| `reconcile` | Applies merged closeouts: git actuals, settled records, proposed decisions and approved rulings, changelogs, verification flags, Stage 3 routing, archive, render, and commit. Also applies fast-lane commits since the last run. Validates the proposed constitution before writing or committing; validation failure leaves original files, index, and commits unchanged. `--epic C,D` limits epics (`EPIC-C` also works); no matching closeout and no pending fast-lane commit is exit 2. `--no-commit` leaves successful changes uncommitted; `--date` fixes the date. Refuses off the default branch, on a dirty tree, or without applicable work. | The epic lead after a single merge, or `execute-wave` once per wave |

Reconciliation applies active closeout checks to epics it is closing; previously archived history retains its warning and exemption rules. An unresolved verification command or live recipe owned by a ticket being archived blocks reconciliation without writes. Create the missing prerequisite, or have Stage 3 reassign or remove the declaration, then retry.

## Plan authority

The optional top-level `invocation` records `mode`, `caller`, `effective_authority`, and `stop_boundary`. Its modes are `standalone`, `orchestrated`, and `single_epic_wave`. Standalone plans use `planned_by: self`; the other modes use `planned_by: wave_lead`, and `single_epic_wave` requires `lanes_in_wave: 1`. The direct single-epic lead performs wave planning and required integration responsibilities without a separate wave lead. Task authority never grants host permissions.

Approved `reasoning_effort` can accompany runtime/model selections in `models`, `review_panel`, `pr_review.fix_worker`, and `budget.fallback_models`. Verify the runtime exposes that control. Both additions are optional so legacy plans remain valid. `verbatim_project_rules` remains required but can be empty; quote only essential rules and use focused pointers in milestone bodies.

## Fast-lane commits

A code-only fix that skips the epic flow marks itself with git trailers in the last paragraph of its commit message, which must survive into the commit on the default branch (with a squash merge, put them at the end of the squash message):

```text
Constitution-Lane: fast
Settles: prd/capabilities.yaml#CAP-002
Evidence: src/core/render.ts
```

`Settles` repeats, one record per line, in the same `path#id` or `path` form a closeout uses. `Evidence` is the repository path that proves the record. It has no default: a commit with `Settles` and no `Evidence`, or whose `Evidence` path does not exist at that commit, settles nothing and is routed. `reconcile` scans commits after the `fast_lane_through` watermark on the newest tasks changelog entry that carries one (all history when none does), oldest first. Each fast-lane commit becomes a `fixed` line in the new tasks changelog entry, `<subject> (<short sha>, fast lane)`, and settles its records with repository evidence at that commit. The lane allows a fix inside one active epic's owned paths: such a commit is applied like any other, and a routed item in the reconciliation report tells that epic's lead about the overlap (the report's `fast_lane` entry names the epic under `overlap`). A commit that names a ticket id, or touches paths owned by more than one active epic, is not applied: it is routed to the reconciliation report, because that work belongs in an epic's flow. A record that does not resolve is routed too, and so is a record path that is absolute, has a `..` segment, or resolves outside `.constitution/`: reconcile never writes outside the constitution. Every run writes the new watermark, the `HEAD` it scanned through.

## Deferred obligations

`render` derives `Outstanding obligations` in `tasks/critical-path.md` from deferred tickets, closeout deferrals, and follow-ups in active and archived epics. Its delivery and retirement records label unverified historical claims explicitly. Archival, a `done` status, or a plausible replacement never establishes delivery.

Use the source reference printed by `render`: the original deferred ticket id, or `EPIC-A#follow-up:<hash>` for a legacy follow-up. The hash is the first 12 lowercase hexadecimal characters of SHA-256 over its exact UTF-8 text. Identical follow-up text in the same epic deduplicates; conflicting source records are errors.

An optional ticket `replaces` array links the source obligations or linked replacement tickets it takes over. Ownership follows that chain without closing the source. A closeout's optional `obligation_resolutions` array records `source`, `outcome` (`delivered` or `retired`), and structured `evidence`. Retirement also requires `reason`, naming why the obligation no longer applies and the supporting authority or ruling. Cite actual delivery evidence rather than relying on ticket status.

Unknown references and unresolved ownership forks produce TSK-020 errors. An explicit source resolution can close a fork and takes precedence over later replacement outcomes or status. Reachable cycles, conflicting source records, duplicate ticket records, and conflicting resolutions for the same reference remain errors and keep the obligation outstanding. An unavailable repository, spike, or measurement reference in an active or newly closing epic also keeps the obligation outstanding, even alongside another valid resolution. For repository evidence, an artifact available at the recorded full immutable git SHA in `evidence.version` instead preserves the resolution with a historical-availability warning. That check establishes artifact availability, not semantic proof of delivery or retirement.

A previously archived resolution with unavailable proof and no verified historical artifact remains labeled as an unverified historical claim, with a warning. Review the claim and its limits without silently treating it as verified delivery. These views use epic records, not a separate obligation ledger.

## Reading findings

Findings print as `SEVERITY ID file#pointer` with one line of explanation. Errors fail validation. Warnings do not, and most of them are decay: evidence whose reference disappeared, a pin that moved. Info is context: certainty distribution per directory, the share of tickets at the ceiling, estimate calibration over planned estimates, active points. Nothing about estimates is ever an error.

A project may downgrade a check to info by listing it under `exceptions` in `constitution.yaml` with a reason. The finding then prints the reason. Use it for named, user-approved exceptions, never to silence a check the project has not thought about.

## Migrating an existing constitution

Automatic repository text scans skip reserved `.constitution-migration-sources-*` directories at the repository root; manual conservation review remains required.

1. Create a git worktree on a branch so nothing changes in the checked-out tree.
2. Run `migrate`. It converts recognized structures and preserves each removed nonempty original under `.constitution-migration-sources-<unique>/`, with its relative path intact.
3. Read `.constitution-migration-report.md`. Compare every preserved source record and field with its destination, including partially recognized records. Resolve unsupported content before removing that source. Also complete capability-to-job mappings, decision options and closure paths, banned lists, flows per ticket, and epic headers.
4. Run `validate` until it reports no errors. Warnings about decayed evidence and layout paths are expected on a young repository.
5. After conservation review and every report item is resolved, remove the preserved sources and report. Commit the migration and open its pull request; small related stage repairs can share it with separate ownership and commit boundaries.

## Rules the tool enforces that the prose skills only state

- Ticket dependencies stay inside their epic; a cross-epic need is an epic dependency.
- An active out-of-band prerequisite blocks dependent in-band epics and their transitive dependents from scheduled waves. The rendered blocked section retains that work until the prerequisite is satisfied.
- Missing, cyclic, or conflicting prerequisites also keep affected work out of runnable waves. Active out-of-band prerequisites remain in valid longest-chain analysis; invalid dependency chains are excluded and reported.
- Two active epics with no dependency path between them must be scope-disjoint on paths and on patchable tech-spec files, because the plan may run them in parallel.
- A settled record needs evidence the tool can see; an assumed record needs its assumption; an open record names a decision. Evidence that disappears decays the record.
- Every verification command a ticket quotes exists in guidelines, and every command guidelines marks as existing resolves. The same holds for live-verification recipes: a `live_probe` ticket names a declared recipe, and an existing recipe's commands resolve.
- A sidecar points at its contract or schema in the code through `artifact_path`; the artifact exists, or, while it is still assumed or open, an active ticket that is not done creates it: the sidecar's optional `owner` names the ticket, or the ticket's `scope.in` covers `artifact_path`. A pinned artifact exists, is settled, or has such a creator, so a wave never runs against one nobody will land.
- Banned synonyms are a grep on the surfaces `constitution.yaml` declares, and only there.
- `reports/` holds five kinds of file and nothing else. Acceptance evidence lives in `evidence/` with a manifest, research in `research/`, generated inventories outside the constitution.
- Reconciliation records facts and routes judgment. It changes upstream certainty only for records the closeout settled; its other tech-spec writes are changelog entries and verification-command or live-recipe `exists` flags. It validates all proposed changes before replacing the original constitution.

## Tests

```bash
bun test ~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/scripts/
```

The fixtures under `assets/fixtures/` cover valid, invalid, legacy, and partial constitutions. Preserve these meaningful checks. For tooling defects, prefer a focused regression through the CLI or public operation that demonstrates the failed behavior. Avoid wording tests and isolated test proliferation. Reuse valid results when the tested inputs and environment remain unchanged.
