<!-- WORKAROUND: skillprism#46 — skillprism does not template this file. Keep it harness-neutral; restore the templated form when #46 is fixed. -->
# Check catalog

Every finding `validate` prints carries one of these ids. Severity is fixed per check: an error fails validation, a warning does not, and info is context. A project may downgrade a check to info by listing it under `exceptions` in `constitution.yaml` with a reason; the finding then prints the reason. Nothing about estimates is ever an error.

## Load and schema

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| STR-001 | error | A required file or directory is missing. A stage's files are required once that stage is present, or once a later stage is present and needs it as upstream. Missing later stages are not an error. Once any stage is present, `constitution.yaml` and `reports/open-decisions.yaml` are required too. |
| SCH-000 | error | A YAML file or front matter block failed to parse, or a markdown file that needs front matter has none |
| YAML-001 | error | A YAML file or front matter block repeats a mapping key (the parser would silently keep the last value); the message names the key and both line numbers |
| SCH-001 | error | A data file violates its schema; the pointer names the field |

## Structure

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| STR-002 | error | A file in `reports/` is not one of the defined kinds: interview record (`<date>-interview-<target>.md`, where the target is `prd`, `architecture`, `techspec`, `tech-spec`, `tasks`, or `realign` in any case, so `interview-PRD.md` and `interview-TechSpec.md` are records; a record with another target gets a message naming these), `open-decisions.yaml`, audit report, constitution review, reconciliation report (`<date>-reconciliation.yaml`, or `<date>-reconciliation-<N>.yaml` for a later run the same day) |
| STR-003 | error | A spike file is not named `SPK-<ACRONYM>-<EPIC><NNN>.md`. The `OD` segment is reserved for decision-owned spikes and carries the register entry's number |
| STR-004 | error | An epic file name does not match `EPIC-<ID>-<slug>.yaml` or its id field |
| STR-005 | error | An evidence directory has no manifest, or a listed file is missing or its bytes or sha256 differ |
| STR-006 | error / warning | A research file is not markdown (error) or has no front matter owner (warning). `research/README.md` is exempt from both |
| STR-007 | error | An active epic uses the reserved id `OD`, which names spikes owned by a register entry |

## Versions

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| VER-001 | error | The oldest changelog entry is not `v0.0.1` |
| VER-002 | error | Changelog entries are not newest first with strictly increasing versions |
| VER-003 | warning | The newest entry names an upstream version that does not exist in that directory's changelog |
| VER-004 | warning | The newest entry was written against an upstream version that now lags that directory's current version at the minor or major level. Patch-level lag is not reported. |

## Certainty

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| CERT-001 | error | `settled` without evidence, `assumed` without an assumption, or `open` without a decision id. Ticket certainty is a derived tag and is exempt |
| CERT-002 | warning | Evidence has decayed: the repository path, spike, or evidence directory it cites no longer exists |
| CERT-003 | error | External evidence on a record that makes a claim about this system (capability, boundary, flow, contract, schema) |
| CERT-004 | error / warning | A record cites a decision that is not in the register (error) or is already closed (warning) |
| CERT-005 | info | A contract is settled while a capability its flows realize is still assumed |
| CERT-006 | warning | A stack pin changed since its evidence was checked |
| INFO-CERT | info | Settled, assumed, and open counts per directory |

## PRD and architecture

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| PRD-001 | error | A P0 capability appears in no flow. Runs once `architecture/` is present. |
| PRD-002 | error | A P0 job has no flow. Runs once `architecture/` is present. |
| PRD-003 | error | A capability cites an unknown job |
| PRD-004 | error | A banned synonym is also a canonical term |
| PRD-005 | warning | An entity in a Mermaid `erDiagram` block in `prd/domain-model.md` has no term in `prd/glossary.yaml`. Entities come from relationship lines (`A \|\|--o{ B : "label"`) and entity blocks (`A { ... }`); a quoted name or an `[alias]` counts. Both sides compare case-insensitively with `_` and `-` read as spaces and whitespace collapsed, and an entity matches a term that differs from it by a trailing `s` either way. Other diagram kinds (`stateDiagram-v2`, `flowchart`) are ignored. Skipped when either file is absent. |
| PRD-006 | warning | A constraint whose `scale` or `meter` measures time names no statistic in either. Time is the whole word millisecond(s), seconds, latency, duration, or response time, singular second after a number, or lowercase `ms` after a number or on its own; a rate such as "per second" is not time. A statistic is a percentile (`p95`, `p99.9`, "95th percentile", percentile), median, mean, average, max, maximum, min, minimum, or worst case. |
| ARC-001 | error | A flow cites an unknown job, capability, or boundary |
| ARC-002 | error | A boundary or edge cites an unknown boundary |
| ARC-003 | warning | No ticket or contract references the flow. Runs once `tech-spec/` or `tasks/` is present. |

## Tech spec

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| TS-001 | error | A verification command, or a command step of a live-verification recipe, marked `exists: true` does not resolve: script missing, package script absent, or binary not on PATH. A recipe's `launch`, `doctor`, and `cleanup` are resolved, and its `drive` only when `drive_kind` is `command`. |
| TS-002 | error | A verification command or live-verification recipe marked `exists: false` has no owning active ticket. Runs once `tasks/` is present. |
| TS-003 | warning | A layout path does not exist and is not marked `exists: false` |
| TS-004 | error / warning | A stack pin matches no version the lockfile locks for that package (error), or the package is absent from it (warning). A lockfile may lock several versions of one package (Cargo does, as with `hashbrown` 0.12.3 and 0.16.0); a pin equal to any of them is fine. Ecosystems checked: npm, bun, cargo, pub |
| TS-005 | error / warning | A legacy sidecar's sibling `artifact` is missing (error), or a raw artifact under `tech-spec/contracts/` or `tech-spec/data-models/` has no sidecar (warning). A markdown companion is not a raw artifact, but only when a sidecar in the same directory names it in `companion`. A markdown file whose stem merely matches a sidecar's there (`orders.md` beside `orders.meta.yaml`, or a legacy sidecar's artifact stem) still gets the warning, worded for both cases: if it is the companion, name it in `companion`; if it is a legacy copy of an artifact that moved into the code, delete it. A legacy sidecar's own `artifact` is never a companion. |
| TS-007 | error | A sidecar sets both `artifact_path` and the legacy `artifact`, or neither; `artifact_path` is not repository-relative or lies inside `.constitution/`; or `artifact_path` does not exist. A missing artifact is allowed while the sidecar is `assumed` or `open` and, once `tasks/` is present, it has an active creator: an active ticket that is neither `done` nor `deferred` (a deferred ticket has left the plan) and that either the sidecar's optional `owner` names or whose `scope.in` paths cover `artifact_path` (one is the other or lies inside it). Before `tasks/` exists the creator is not checked. |
| TS-008 | warning | A sidecar uses the legacy `artifact` field, so the raw artifact lives beside it in `tech-spec/`. Move the artifact into the code, set `artifact_path`, and update `surfaces` in `constitution.yaml`. |
| TS-009 | error | A `pinned` sidecar is not settled, its artifact does not exist, and it has no active creator (as in TS-007: an active ticket that is neither `done` nor `deferred`, named by `owner` or covering the path in its `scope.in`). Runs once `tasks/` is present. Pinned artifacts cross epic boundaries inside a wave, so they land first: planning the artifact in an active ticket (typically the foundation epic) is the prescribed flow and is not an error. |
| TS-006 | error | An ADR's `superseded_by` does not exist, or it is superseded without one |
| TS-012 | error | Two live-verification recipes in guidelines share a name |
| TS-010 | error | A sidecar cites a flow slug or boundary id that does not exist |
| TS-011 | error / warning | An ADR's `supersedes` names an ADR that does not exist (error), or a supersession link is one-sided: A supersedes B while B's `superseded_by` is not A, or B names A in `superseded_by` while A does not list B in `supersedes` (warning) |

## Tasks

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| TSK-001 | error | A ticket id is not `<ACRONYM>-<EPIC><NNN>` for its epic |
| TSK-002 | error | A ticket depends on a ticket outside its epic, or ticket dependencies form a cycle |
| TSK-003 | error | An epic depends on an unknown epic, cites an unknown capability, or epic dependencies form a cycle |
| TSK-004 | error | A ticket's in-scope path is outside its epic's declared paths |
| TSK-005 | error | A ticket's verification command is not quoted from guidelines |
| TSK-006 | error / warning | Spike ticket without a spike id or with a missing spike file, a non-spike with a spike id, a ticket carrying a decision-owned (`OD`) spike id, or an unknown closed decision |
| TSK-007 | error | A ticket cites an unknown flow |
| TSK-008 | error / warning | A ticket cites an unknown constraint (error), or a benchmark or stat_threshold ticket cites none (warning) |
| TSK-009 | error | Two active epics with no dependency path between them share a scope path or a patchable tech-spec file. Patchable entries are compared by path prefix after dropping a leading `.constitution/`. |
| TSK-010 | error | A ticket, epic, or spike carries a time unit |
| TSK-012 | error | A completed epic has no closeout, or the closeout disagrees with ticket statuses or point sums |
| TSK-013 | error | An out-of-band epic has no source |
| TSK-014 | error | A ticket's acceptance includes `live_probe` (as the mode or a supplementary mode) but names no `recipe`, names a `recipe` without `live_probe`, or names a recipe guidelines does not declare under `live_verification` |
| TSK-015 | warning | An active epic has no `estimated_diff_lines`, or a completed epic whose `estimate_source` is `planned` (or absent) has an estimate equal to its measured diff exactly, which suggests it was filled from actuals. `migrate --repair-estimates` marks those `backfilled`. |
| TSK-016 | error | An active epic's closeout names a `settled[].record` that reconcile could not resolve (missing file, a list file without that record id, a non-list file that is not a certainty-bearing record such as `tech-spec/guidelines.md`, or a path that is absolute, has a `..` segment, or resolves outside `.constitution/`, which reconcile refuses to write), or a `spec_patches[].path` that does not exist. Caught on the branch instead of routed after the merge. |
| TSK-017 | warning | An active epic's `tech_spec_patchable` names a raw artifact under `tech-spec/` (a markdown companion, as TS-005 defines it, is not one). Name its sidecar instead; once the artifact lives in the code, its path belongs in `scope.paths`. |
| INFO-EST | info | Share of open tickets estimated at the ceiling |
| INFO-CAL | info | `calibration: actual/estimate = R over N completed epics; M excluded`. R is total measured diff lines over total estimated diff lines, counting only completed epics with a planned estimate above zero and actuals; migrated and backfilled estimates, and planned ones that equal actuals exactly, are excluded. Runs once `tasks/` has a completed epic. |
| INFO-PLAN | info | Active epic count, out-of-band count, and open points. Runs once `tasks/` is present. |
| INFO-SHAPE | info | Which stage directories are present |

## Open decisions

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| OD-001 | error / warning | Spike closure without a spike id or ruling closure without a ruler (error); a spike neither planned nor written (warning) |
| OD-002 | error | Closed without a ruling, or a ruling on an entry that is not closed |
| OD-003 | error | The recommendation is not one of the options |
| OD-004 | warning | A blocked item does not exist |

## Cross-references

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| XR-001 | error | Prose in `prd/`, `architecture/`, or `tech-spec/` names an `ADR-NNNN` that has no file under `tech-spec/adrs/`, or an `OD-NN` that is not in the register. Front matter is skipped; its ids have their own checks. |

## Derive

`derive` prints its own findings rather than validation findings. Each is either drift (DRV-001, DRV-002), which `derive --write` applies, or report-only (DRV-003), which needs a person or `reconcile`. `derive` exits 1 while unapplied drift remains, 0 otherwise, and 2 when `tech-spec/` is absent.

| Id | Kind | Meaning |
| :--- | :--- | :--- |
| DRV-001 | drift | A stack pin differs from the one version the lockfile locks for that package. `--write` sets the pin to the lockfile version, and when the pin's evidence is `repository` evidence citing a lockfile, refreshes the evidence version and date. |
| DRV-002 | drift | A guidelines layout path's `exists` flag disagrees with the tree. `--write` sets `exists: false` on a missing path and removes `exists: false` from a present one. |
| DRV-003 | report | A stack pin is absent from its ecosystem's lockfile, or matches none of several versions the lockfile locks for that package (which one the pin means is a judgment, so it is never rewritten), or a verification command marked `exists: false` now resolves (reconcile flips it when its owner archives). |

## Plan checks

`check-plan <file>` prints these for an epic plan file, which lives outside `.constitution/`. It validates the front matter against `epic-plan.schema.json` and cross-checks it against the constitution under `--root`; milestone bodies are prose and stay unchecked. Every finding is an error, and any error exits 1.

The required `kind` decides what the plan executes. `epic` plans name `EPIC-<ID>` and an `epic_file` that exists and matches. `fast_lane` plans (a code-only fix) and `no_constitution` plans (an issue in a repository with no `.constitution/`) name their work `FAST-<slug>` or `ISSUE-<number>` and set `epic_file: none`. A `fast_lane` plan is still cross-checked against the register and the active epics, so `--root` must have a `.constitution/`. A `no_constitution` plan skips PLAN-002, PLAN-003, and PLAN-004, and `--root` may lack `.constitution/`.

A bundle is optional: one file may hold a whole wave's plans. Each plan starts at a line `<!-- plan: EPIC-XX -->`, immediately followed by its own `---` front matter block, and runs to its body's end at the next marker; text before the first marker is not checked. When the file has one or more markers, each plan is checked on its own and every finding it produces is prefixed with its id (`EPIC-C: ...`); a marker not immediately followed by front matter is PLAN-000 for that plan. The plans are then checked against each other (PLAN-007). A file with no marker is a single plan, checked as before.

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| PLAN-000 | error | The plan file is missing, its front matter does not parse, or it has none |
| PLAN-001 | error | The front matter violates `epic-plan.schema.json`: a key is missing, unknown (including the retired `pr_review.rounds` and `pr_review.reviewer`), or out of range; or `epic` and `epic_file` do not fit `kind` (`EPIC-<ID>` and a path for `epic`; `FAST-<slug>` or `ISSUE-<number>` and `none` otherwise). The pointer names the field |
| PLAN-002 | error | For a `kind: epic` plan, `epic_file` does not exist or does not parse, or its id does not match `epic`. For a `fast_lane` plan, `--root` has no `.constitution/` |
| PLAN-003 | error | An `open_decisions` id is not in the register |
| PLAN-004 | error | A `siblings` entry is not an active epic |
| PLAN-005 | error | `planned_by` is `self` but an autonomy policy entry escalates to a wave lead, which a standalone lead does not have |
| PLAN-006 | error | `autonomy.policy` does not hold exactly one entry per trigger in the schema's trigger enum (`blocker`, `open_decision`, `plan_drift`, `spec_drift`, `test_failure`, `review_nonconvergence`, `rebase_conflict`, `budget_threshold`, `stall`). One finding names the missing triggers and one names the repeated ones. Runs for every `kind` |
| PLAN-007 | error | Bundle only. Two markers name the same plan; a marker's id differs from its plan's `epic`; a `siblings[].epic` names the plan itself or no plan in the bundle, or its `merge_position` differs from that plan's; or two plans take the same `merge_position` |

## Glossary

| Id | Severity | Meaning |
| :--- | :--- | :--- |
| GLS-001 | error | A banned synonym appears on a domain-facing surface, as declared by `surfaces` in `constitution.yaml` |
| GLS-002 | info | Banned synonyms appear off-surface; general feedback only |
| GLS-003 | warning | A `surfaces` glob in `constitution.yaml` matches no file the scan sees, so GLS-001 checks nothing there. The glob is matched exactly as GLS-001 matches it, over the same repository walk, which skips `.git`, dependency, and build directories. A glob under `.constitution/<stage>/` is skipped while that stage directory does not exist, because `init` writes surfaces for later stages. |

The GLS-001 and GLS-002 scan skips the glossary itself, reports, research, spikes, completed epics, sidecars, and structured data files, so field names and history never count.
