# Layout of a structured constitution

Everything lives under `.constitution/` at the repository root. Data files are YAML validated by the schema named beside them. Prose files are markdown; the ones marked "front matter" carry a YAML block at the top validated by a schema. "Writer" is the only role that may change the file; reconciliation is the tool's `reconcile` command.

A stage directory appears when that stage runs. `init` writes Stage 1 files. `init --stage architecture` (and the later stage names) adds that stage's empty files when you're ready. `validate` requires a stage's files once the stage is present, or once a later stage is present and needs it as upstream. Missing later stages are not an error. Once any stage is present, `constitution.yaml` and `reports/open-decisions.yaml` are required too.

| Path | Form | Schema | Writer |
| :--- | :--- | :--- | :--- |
| `constitution.yaml` | Data: acronym, archetype, surfaces, diff exclusions, default branch, concurrency mechanics, exceptions | `constitution.schema.json` | Stage 1 (archetype), Stage 4 (concurrency), user (exceptions) |
| `prd/jobs.yaml` | Jobs to be done, with priority and certainty | `jobs.schema.json` | Stage 1 |
| `prd/capabilities.yaml` | Capabilities grouped, prioritized, mapped to jobs, with certainty | `capabilities.schema.json` | Stage 1 |
| `prd/constraints.yaml` | Planguage meters plus deferred classes with named risk | `constraints.schema.json` | Stage 1 |
| `prd/glossary.yaml` | Canonical domain terms and banned synonyms | `glossary.schema.json` | Stage 1 |
| `prd/vision.md`, `actors.md`, `domain-model.md` | Prose | none | Stage 1 |
| `prd/out-of-scope/*.md` | Prose with front matter: decision, date, ruling | `out-of-scope.schema.json` | Stage 1 |
| `prd/changelog.yaml` | Entries newest first, oldest `v0.0.1` | `changelog.schema.json` | Stage 1 |
| `architecture/boundaries.yaml` | Logical boundaries and protocol-labeled edges, with certainty | `boundaries.schema.json` | Stage 2 |
| `architecture/flows/*.md` | Prose with front matter: job, capabilities, boundaries, view, certainty | `flow.schema.json` | Stage 2 |
| `architecture/strategy.md`, `containers.md`, `resilience.md`, `risks.md` | Prose (containers holds the diagram) | none | Stage 2 |
| `architecture/changelog.yaml` | As above | `changelog.schema.json` | Stage 2 |
| `tech-spec/stack.yaml` | Bill of materials with pins and certainty, compatibility policy | `stack.schema.json` | Stage 3; `derive --write` for pin versions and their lockfile evidence |
| `tech-spec/guidelines.md` | Prose with front matter: verification commands, live-verification recipes (launch, doctor, drive, evidence, cleanup), layout, commit convention | `guidelines.schema.json` | Stage 3; reconciliation flips `exists` on commands and recipes owned by archived tickets; `derive --write` sets layout `exists` flags |
| `tech-spec/adrs/*.md` | Prose with front matter: id, status, date, certainty | `adr.schema.json` | Stage 3 |
| `tech-spec/contracts/**/*.meta.yaml`, `tech-spec/data-models/**/*.meta.yaml` | Sidecars: surface, flows, boundaries, certainty, and `artifact_path`, the repository-relative path of the contract or schema in the code (never under `.constitution/`). A planned artifact is `assumed` or `open`; once tasks exist, an active ticket that is not done creates it, named by the optional `owner` or covering `artifact_path` in its `scope.in` (Stage 3 writes sidecars before tickets exist and Stage 4 does not write `tech-spec/`, so scope coverage is the usual claim); `pinned: true` marks one that crosses epic boundaries in a wave. Legacy sidecars name a raw artifact beside them with `artifact` instead (TS-008). | `meta.schema.json` | Stage 3; a spec-patch worker for sidecars the epic declared |
| The artifact at `artifact_path` | The contract or data model in its native format, in the code | none | The owning ticket's worker, as ordinary milestone work inside the epic's `scope.paths` |
| `tech-spec/changelog.yaml` | As above | `changelog.schema.json` | Stage 3; reconciliation appends; `derive --write` appends a patch entry with `by: derive` |
| `tasks/epics/EPIC-<ID>-<slug>.yaml` | Epic header, tickets, decisions discovered in execution, closeout (including `code_decisions`, which reconcile routes to Stage 3) | `epic.schema.json` | Stage 4; the epic lead for its own file |
| `tasks/completed/` | Archived epic files with actuals | `epic.schema.json` | Reconciliation; `migrate --repair-estimates` may set `estimate_source: backfilled`, one line per file |
| `tasks/critical-path.md` | Generated | none | `render` only |
| `tasks/changelog.yaml` | As above; reconcile's entries also carry `fast_lane_through`, the commit it scanned fast-lane trailers through, and a `fixed` line per applied fast-lane commit | `changelog.schema.json` | Stage 4; reconciliation appends |
| `spikes/SPK-<ACRONYM>-<EPIC><NNN>.md` | Prose from the spike template, budget in points; a decision-owned spike puts `OD` and the register entry's number in place of the epic segment | none | The worker of a Spike ticket, or the interview when the spike closes a register entry |
| `evidence/<owner>/manifest.yaml` plus files (`evidence/<ticket>-live/` for a supplementary live probe) | Acceptance evidence the project produced, with a short manifest: command, verified-at commit, result, and the files, with sha256 where a later run compares against them | `evidence-manifest.schema.json` | The epic lead: run-mode evidence at the milestone that completes the ticket, `live_probe` evidence once per epic before the closeout |
| `research/*.md` | Non-spike deliverables with a front matter `owner`, including design reviews; `README.md` is exempt | none | The interview for a design review, else whoever the owner names |
| `reports/open-decisions.yaml` | The single live register | `open-decisions.schema.json` | Interview; reconciliation appends proposed entries |
| `reports/<date>-interview-<target>.md` | Interview record, a log. The target is `prd`, `architecture`, `techspec`, `tech-spec`, `tasks`, or `realign`, in any case | none | Interview |
| `reports/audit-<timestamp>-<slug>.md` | Audit report | none | `audit-improvements` |
| `reports/<date>-constitution-review.md` | Review of a stage output for layer violations and contradictions | none | An isolated reviewer after a stage pass |
| `reports/<date>-reconciliation.yaml` | Routed items, proposed decisions, candidate terms, and the fast-lane commits it scanned. A later run the same day writes `<date>-reconciliation-2.yaml`, then `-3`, and so on, never overwriting an earlier report. The newest report is the one with the latest date and, within that date, the highest run number (the unsuffixed file is run 1); plain name order gets this wrong, so do not sort by file name | `reconciliation.schema.json` | Reconciliation, only when something was routed |

Not in the constitution: epic plan files, which are session artifacts validated by `check-plan` against `epic-plan.schema.json`; generated inventories, client deliverables, HTML renderings, and anything a program writes on every run. Point at them from a research file if they matter.
