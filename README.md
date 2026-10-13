# Constitutional Framework Skills

One [skillprism](https://tuvren.github.io/skillprism/) source for the **AI Project Development Framework** skills, compiled to **Claude Code**, **Codex CLI**, and **Grok CLI**.

`skills/` is the only source of truth. Each harness gets its own rendered `SKILL.md` carrying that harness's subagent dispatch, model names, plan-mode behavior, and default review panel, and its own rendered references where those differ. Editors and agents still read the same framework: a governed, directory-isolated artifact chain under `.constitution/`.

## Harnesses

| Harness | Kind | User skill root | Invocation |
| :--- | :--- | :--- | :--- |
| `claude` (Claude Code) | skillprism built-in | `~/.claude/skills/` | `/skill-name` |
| `codex` (Codex CLI) | skillprism built-in | `~/.codex/skills/` | `/skill-name` |
| `grok` (Grok CLI) | custom, `harnesses/grok.yaml` | `~/.grok/skills/` | `/skill-name` |

Grok is not one of skillprism's built-in harnesses, so `harnesses/grok.yaml` defines its id, capability flags, and directories. See [`harnesses/grok.yaml`](harnesses/grok.yaml).

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

`reviewing-pull-requests` and `reviewing-milestone-commits` are routers that load `standards`, `spec`, `full`, or `documents` workflows from their `references/`.

## Usage

Pin `SKILLPRISM_VERSION` — without it the launcher hits GitHub's API on every invocation and eventually 403s.

```bash
export SKILLPRISM_VERSION=0.5.0

bunx skillprism@0.5.0 validate .    # check every skill for every harness
bunx skillprism@0.5.0 build         # compile to dist/<harness>/, never touches live dirs
bunx skillprism@0.5.0 build --force # overwrite existing dist/ files non-interactively

# Install where an agent actually reads skills. `add` is separate from `build`.
bunx skillprism@0.5.0 add . --target project
bunx skillprism@0.5.0 add . --target user --harnesses claude,codex,grok
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
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## How harness differences are handled

- **Tooling paths** use `~/.{{ harness.id }}/skills/...`, which resolves to `~/.claude`, `~/.codex`, or `~/.grok` because the harness ids match the directory names.
- **`SKILL.md` conditionals**: subagent dispatch, model names, plan mode, review-panel defaults, and messaging are branched with `{% if harness.id == "claude" %} / {% elif harness.id == "codex" %} / {% else %}` (Grok). Only `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `specifying-technical-implementation`, and `upgrading-constitution-repos` diverge; the other eight render the same body for every harness.
- **Templated references**: any file named `*.j2` anywhere in a skill directory renders once per harness with the suffix stripped ([skillprism#46](https://github.com/Tuvren/skillprism/issues/46), fixed in v0.5.0). The harness-sensitive references are `.md.j2` templates and use the same `harness.*` context as `SKILL.md`. Everything else is copied verbatim, so non-templated references, assets, and scripts must stay harness-neutral.
- **Descriptions are one ≤500-character string for all harnesses.** Codex caps descriptions at 500 characters (Claude Code 1536, Grok no documented cap), so the single portable description fits the lowest limit.
- **Location-independent scripts.** `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` and scans all three plan directories, so it works from any harness install.

## Notes

- The three manual copies this replaces had drifted. The unified source uses the newest canonical content (from the `~/.claude/skills` repository) for every harness, so Codex now gets checks and wording it was missing.
- `constitution-tooling`'s `epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `pi`, `pig`) so a plan written under one harness validates under the others.
- v0.5.0 is a breaking change for projects that shipped `*.j2` files expecting them to be copied unchanged: those files are now templates.
