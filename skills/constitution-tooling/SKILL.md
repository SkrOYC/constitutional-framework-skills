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
bun run ~/.{{ harness.id }}/skills/constitution-tooling/scripts/cli.ts <command> --root <repo> [--json]
```

The structured constitution keeps facts that something reads mechanically in YAML files validated by the schemas under `assets/schemas/`, and prose in markdown with front matter where one fact must be read. `references/layout.md` lists every file, its schema, and who writes it. `references/checks.md` lists every check id the validator can print. Stage skills hand the relevant schema to the agent writing a file; the schema is the output contract.

## Commands

| Command | What it does | Who runs it |
| :--- | :--- | :--- |
| `validate` | Schemas, cross-file invariants, and repository-facing checks. Missing later stages are not errors; coverage checks that need a later stage run once that stage is present. Exit 1 on any error. `--json` for machine output. | Every stage skill before declaring a pass complete; the epic lead before each commit; the reviewer on every milestone; reconciliation before and after |
| `init --acronym ABC --archetype <name>` | Scaffolds Stage 1 files that validate, with `prd/changelog.yaml` at `v0.0.1`. Optional `--secondary a,b`, `--default-branch`. Refuses if `.constitution/` already exists; use `--stage` instead. | Stage 1, once, on a repository with no constitution |
| `init --stage STAGE` | Adds one stage's empty files to an existing constitution. `STAGE` is `prd`, `architecture`, `tech-spec`, or `tasks`. Refuses if the stage already has files, or if an upstream stage is missing. `--stage prd` on an interview-only tree needs `--acronym` and `--archetype` when `constitution.yaml` is missing. P0 coverage checks start applying once `architecture/` exists. | The matching stage skill, at the start of the pass |
| `render` | Regenerates `tasks/critical-path.md` from the epic files: totals, longest chain, waves, out-of-band conflicts, build order, ticket order, concurrency mechanics. `--stdout` prints instead of writing. Refuses to write if Stage 4 has not been executed. | Stage 4 after writing epics; reconcile runs it itself |
| `migrate` | Converts a markdown constitution written with the old templates to the structured layout, then renders. Writes `.constitution-migration-report.md` at the repository root with every item it could not fill. `--date` fixes the migration date. Migrated epics carry `estimate_source: migrated` and no estimate; migrate never copies actuals into an estimate. | Once per existing repository, in a worktree |
| `migrate --repair-estimates` | On an already structured constitution, marks every completed epic whose planned estimate equals its measured diff as `estimate_source: backfilled`, editing that one line in place, and prints the files. It never runs the markdown migration and never commits. | Once, on a repository migrated before estimates carried a source |
| `format` | Re-emits the four stage changelogs (`--all`: every YAML data file outside `completed/`, `archived/`, `evidence/`, `reports/`) in the canonical block style: scalar lists stay inline only when the line is 80 characters or shorter, longer ones get one item per line. Skips files with comments and any file whose parsed value would change. `--check` writes nothing and exits 1 when a file would change. `reconcile` and `derive` prepend changelog entries as text, so they never reformat older entries. | Once per repository to normalize changelogs that earlier tool versions wrote as long flow lists; in CI as `format --check` |
| `derive` | Compares the mechanical facts tech-spec restates with the repository: stack pins against lockfiles (DRV-001) and layout `exists` flags against the tree (DRV-002), plus report-only findings (DRV-003). Exit 1 on unapplied drift. `--write` applies DRV-001 and DRV-002 and adds a patch-level tech-spec changelog entry with `by: derive`; `--date` fixes its date, `--json` for machine output. Rewriting re-emits the YAML of `stack.yaml` and the guidelines front matter, so comments there are lost and long lists change to block style, as with `reconcile`. The tech-spec changelog entry is prepended as text, so older entries stay byte-identical. `reconcile` never makes these edits. | `execute-wave` after `reconcile`, committed as a constitution-only commit; anyone checking tech-spec against the code |
| `check-plan <file>` | Validates an epic plan file's front matter against `assets/schemas/epic-plan.schema.json` and cross-checks it: `epic_file` exists and its id matches `epic`, `open_decisions` are in the register, `siblings` are active epics, a self-planned epic never escalates to a wave lead, and the autonomy policy holds exactly one entry per trigger. A bundle file holds a whole wave: each plan starts at a line `<!-- plan: EPIC-XX -->` immediately followed by its own `---` front matter block and runs to the next marker; each plan is checked alone, with findings prefixed by its id, and the plans are cross-checked (siblings are other plans in the bundle, merge positions are unique). A file with no marker is one plan. The required `kind` is `epic`, `fast_lane`, or `no_constitution`; the last two name `FAST-<slug>` or `ISSUE-<number>` with `epic_file: none`, and `no_constitution` skips the constitution cross-checks so `--root` may lack `.constitution/`. Milestone bodies are not checked. Exit 1 on any error; `--json` for machine output. The file path is resolved from the current directory; `--root` names the repository whose constitution it is checked against. | The epic lead in standalone step 0, and `execute-wave` on every plan file before asking for approval |
| `reconcile` | Applies every active epic's closeout after its pull request merged: actuals from git, settled records, unresolved decisions proposed to the register and already approved rulings applied in place, changelog entries and version bumps, verification commands and live-verification recipes owned by archived tickets, closeout `code_decisions` routed to Stage 3, archive, routing report, render, commit. Also applies fast-lane commits merged since the last run (see below). `--epic C,D` limits the epics (`EPIC-C` works too; a filter that matches no epic with a closeout, when no fast-lane commit is pending either, is an error with exit 2), `--no-commit` leaves the changes staged, `--date` fixes the date. Refuses to run off the default branch or on a dirty tree, and when there is neither a closeout nor a new fast-lane commit. | The epic lead after a single merge, or `execute-wave` once per wave |

## Fast-lane commits

A code-only fix that skips the epic flow marks itself with git trailers in the last paragraph of its commit message, which must survive into the commit on the default branch (with a squash merge, put them at the end of the squash message):

```text
Constitution-Lane: fast
Settles: prd/capabilities.yaml#CAP-002
Evidence: src/core/render.ts
```

`Settles` repeats, one record per line, in the same `path#id` or `path` form a closeout uses. `Evidence` is the repository path that proves the record. It has no default: a commit with `Settles` and no `Evidence`, or whose `Evidence` path does not exist at that commit, settles nothing and is routed. `reconcile` scans commits after the `fast_lane_through` watermark on the newest tasks changelog entry that carries one (all history when none does), oldest first. Each fast-lane commit becomes a `fixed` line in the new tasks changelog entry, `<subject> (<short sha>, fast lane)`, and settles its records with repository evidence at that commit. The lane allows a fix inside one active epic's owned paths: such a commit is applied like any other, and a routed item in the reconciliation report tells that epic's lead about the overlap (the report's `fast_lane` entry names the epic under `overlap`). A commit that names a ticket id, or touches paths owned by more than one active epic, is not applied: it is routed to the reconciliation report, because that work belongs in an epic's flow. A record that does not resolve is routed too, and so is a record path that is absolute, has a `..` segment, or resolves outside `.constitution/`: reconcile never writes outside the constitution. Every run writes the new watermark, the `HEAD` it scanned through.

## Reading findings

Findings print as `SEVERITY ID file#pointer` with one line of explanation. Errors fail validation. Warnings do not, and most of them are decay: evidence whose reference disappeared, a pin that moved. Info is context: certainty distribution per directory, the share of tickets at the ceiling, estimate calibration over planned estimates, active points. Nothing about estimates is ever an error.

A project may downgrade a check to info by listing it under `exceptions` in `constitution.yaml` with a reason. The finding then prints the reason. Use it for named, user-approved exceptions, never to silence a check the project has not thought about.

## Migrating an existing constitution

1. Create a git worktree on a branch so nothing changes in the checked-out tree.
2. Run `migrate`. It converts what the old templates made regular and deletes the markdown it replaced; git history keeps the originals.
3. Read `.constitution-migration-report.md` and work its to-do list top to bottom. The heavy items are jobs per capability, options and a closure path for each open decision, the glossary's banned lists, flows per ticket, and epic headers.
4. Run `validate` until it reports no errors. Warnings about decayed evidence and layout paths are expected on a young repository.
5. Delete the report, commit, and open the pull request.

## Rules the tool enforces that the prose skills only state

- Ticket dependencies stay inside their epic; a cross-epic need is an epic dependency.
- Two active epics with no dependency path between them must be scope-disjoint on paths and on patchable tech-spec files, because the plan may run them in parallel.
- A settled record needs evidence the tool can see; an assumed record needs its assumption; an open record names a decision. Evidence that disappears decays the record.
- Every verification command a ticket quotes exists in guidelines, and every command guidelines marks as existing resolves. The same holds for live-verification recipes: a `live_probe` ticket names a declared recipe, and an existing recipe's commands resolve.
- A sidecar points at its contract or schema in the code through `artifact_path`; the artifact exists, or, while it is still assumed or open, an active ticket that is not done creates it: the sidecar's optional `owner` names the ticket, or the ticket's `scope.in` covers `artifact_path`. A pinned artifact exists, is settled, or has such a creator, so a wave never runs against one nobody will land.
- Banned synonyms are a grep on the surfaces `constitution.yaml` declares, and only there.
- `reports/` holds five kinds of file and nothing else. Acceptance evidence lives in `evidence/` with a digest manifest, research in `research/`, generated inventories outside the constitution.
- Reconciliation records facts and routes judgment. It never edits `prd/`, `architecture/`, or a tech-spec file other than the changelog, the `exists` flags on verification commands and live-verification recipes, and the certainty of records a closeout settled.

## Tests

```bash
bun test ~/.{{ harness.id }}/skills/constitution-tooling/scripts/
```

The fixtures under `assets/fixtures/` are a valid mini-repository, an invalid copy with known violations, and a markdown constitution in the old format for migrate. Tests also cover partial constitutions: Stage 1 only, architecture started but incomplete, tech-spec before tasks, and interview-only. When a check changes, all must still pass.
