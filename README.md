# Constitutional Framework Skills

One [skillprism](https://tuvren.github.io/skillprism/) source for the AI Project Development Framework skills, compiled to Claude Code, Codex CLI, Grok CLI, and Antigravity CLI.

`skills/` is the only source of truth. Each harness gets its own rendered `SKILL.md` carrying that harness's delegation and plan-file mechanics, and its own rendered references where those differ. Editors and agents still read the same framework: a governed, directory-isolated artifact chain under `.constitution/`.

## Execution principles

- Resolve scope, prerequisites, verification ownership, evidence needs, and available model fallbacks during planning.
- Give each milestone a fresh worker and independent review. Keep routine corrections and focused verification in that worker's assignment.
- Let epic leads adapt execution within approved outcomes and authority; wave leads own cross-epic decisions. A single epic needs no extra lead layer.
- Reuse valid verification for unchanged inputs; rerun for changed inputs, uncovered risk, or a required project gate.
- Review independently, with a panel sized to risk and capabilities available in the current harness.
- Capture minimal acceptance evidence once after implementation freezes. Keep bulk run output outside the constitution.
- Keep small related stage changes and patches in a coherent pull request, preserving stage ownership and separate code/spec commits.

Write almost no ordinary code comments or isolated unit tests. Prefer clear names and types, public-interface behavior checks, and useful coverage. TSDoc-style contracts, licenses, and rare essential constraints remain appropriate.

Private projects verify locally by default, with CI/CD focused on secure publishing, deployment, and release. Open-source projects accepting outside contributions use contribution CI behavior checks by default. Test workflows stay separate from release execution. Owner requirements and required project gates govern; repository visibility alone does not establish the contribution model.

Harness adapters change tool usage, not these policies. Project instructions supply runtime limits, commands, and stronger requirements. No particular model vendor, application architecture, or deployment environment is required.

## Harnesses

| Harness | Kind | User skill root | Invocation |
| :--- | :--- | :--- | :--- |
| `claude` (Claude Code) | skillprism built-in | `~/.claude/skills/` | `/skill-name` |
| `codex` (Codex CLI) | skillprism built-in | `~/.codex/skills/` | `/skill-name` |
| `grok` (Grok CLI) | custom, `harnesses/grok.yaml` | `~/.grok/skills/` | `/skill-name` |
| `antigravity` (Antigravity CLI) | custom, `harnesses/antigravity.yaml` | `~/.gemini/antigravity-cli/skills/` | `/skill-name` |

Grok and Antigravity use custom harness definitions for their ids, capability flags, and directories. See [`harnesses/grok.yaml`](harnesses/grok.yaml) and [`harnesses/antigravity.yaml`](harnesses/antigravity.yaml).

## Skills

Fourteen framework skills. `stage`/role comes from each `skill.yaml`'s `metadata`; `skill.yaml` is the source of truth and this table is maintained by hand.

| Skill | Role | Artifact |
| :--- | :--- | :--- |
| `defining-product-requirements` | Stage 1 — Product Definer | `.constitution/prd/`, `constitution.yaml` archetype |
| `designing-solution-architecture` | Stage 2 — Solution Architect | `.constitution/architecture/` |
| `specifying-technical-implementation` | Stage 3 — Tech Lead | `.constitution/tech-spec/` |
| `planning-engineering-execution` | Stage 4 — Engineering Planner | `.constitution/tasks/` |
| `interview` | Companion | interview record, open-decisions register |
| `audit-improvements` | Audit | `.constitution/reports/audit-*.md` |
| `constitution-tooling` | Tooling | validation findings, rendered `critical-path.md`, migrated/reconciled `.constitution/` |
| `execute-epic-end-to-end` | Execution — epic lead | epic plan file, milestone commits, review-clean PR |
| `execute-wave` | Execution — wave lead | epic plan files, epic PRs, reconciliation commit |
| `pr-review-fix-loop` | Execution — review loop | review findings, fix commits |
| `reviewing-milestone-commits` | Review | review findings returned to the epic lead |
| `reviewing-pull-requests` | Review (router) | review findings |
| `upgrading-constitution-repos` | Companion | migrated `.constitution/` across reviewable phases |
| `commit-push-open-pr` | Git workflow | git history, GitHub PR |

`reviewing-pull-requests` routes to `standards`, `spec`, `full`, or `documents` workflows in its `references/`. `reviewing-milestone-commits` is self-contained.

## Usage

Pin `SKILLPRISM_VERSION` — without it the launcher hits GitHub's API on every invocation and eventually 403s.

```bash
export SKILLPRISM_VERSION=0.5.0

bunx skillprism@0.5.0 validate .    # check every skill for every harness
bunx skillprism@0.5.0 build         # compile to dist/<harness>/, never touches live dirs
bunx skillprism@0.5.0 build --force # overwrite existing dist/ files non-interactively

# Install where an agent actually reads skills. `add` is separate from `build`.
bunx skillprism@0.5.0 add . --target project
bunx skillprism@0.5.0 add . --target user --harnesses claude,codex,grok,antigravity
```

## Project structure

```
skills/<name>/
  skill.yaml            # name, description, metadata, variables, overrides
  SKILL.md              # templated per harness
  references/           # *.j2 files are templates; other files are copied verbatim
  assets/               # same: *.j2 rendered, the rest copied
  scripts/              # same: *.j2 rendered, the rest copied
harnesses/grok.yaml     # custom harness for Grok CLI
harnesses/antigravity.yaml # custom harness for Antigravity CLI
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## How harness differences are handled

- **Tooling paths** use `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/...`, resolving to each harness's user skill root.
- **`SKILL.md` conditionals**: native delegation, plan-mode constraints, and messaging use branches for Claude, Codex, and Antigravity, with Grok as `else`. Only `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `specifying-technical-implementation`, and `upgrading-constitution-repos` diverge. A skill without such a branch stays harness-neutral in `SKILL.md`, though tooling paths and references can differ per harness.
- **Templated references**: any file named `*.j2` anywhere in a skill directory renders once per harness with the suffix stripped ([skillprism#46](https://github.com/Tuvren/skillprism/issues/46), fixed in v0.5.0). The harness-sensitive references are `.md.j2` templates and use the same `harness.*` context as `SKILL.md`. Everything else is copied verbatim, so non-templated references, assets, and scripts must stay harness-neutral.
- **Descriptions are one short string for all harnesses.** Codex rejects a description over 500 bytes (Claude Code allows more, Grok none documented) and caps its initial skills list, so each description stays comfortably under 500 and prioritizes clarity over richness.
- **Location-independent scripts.** `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` and scans `.claude`, `.codex`, `.grok`, and `.agents` plan directories.

## Notes

- The hand-synced copies this replaces had drifted; the unified source uses the newest canonical content (from the `~/.claude/skills` repository) for every harness, so Codex and Grok pick up checks and wording their copies lacked.
- `constitution-tooling`'s `epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `pi`, `pig`) so a plan written under one harness validates under the others.
- v0.5.0 is a breaking change for projects that shipped `*.j2` files expecting them to be copied unchanged: those files are now templates.
