# Constitutional Framework Skills

Agent skills for the **AI Project Development Framework** — a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Managed with [skillprism](https://tuvren.github.io/skillprism/).

## Skills

Every skill carries a `metadata` block in its `skill.yaml` declaring `family`, `role`, `artifact`, and `upstream` — plus `stage` for the four numbered stages. This table is hand-maintained and must be kept in step with those values; `skill.yaml` is the source of truth.

### The four canonical stages

| Skill | Stage | Artifact | Upstream |
|-------|-------|----------|----------|
| `defining-product-requirements` | 1 — Product Definer | `.constitution/prd/` | user intent, existing codebase |
| `designing-solution-architecture` | 2 — Solution Architect | `.constitution/architecture/` | `.constitution/prd/` |
| `specifying-technical-implementation` | 3 — Tech Lead | `.constitution/tech-spec/` | `.constitution/architecture/`, `.constitution/prd/` |
| `planning-engineering-execution` | 4 — Engineering Planner | `.constitution/tasks/` | `.constitution/tech-spec/`, `.constitution/architecture/` |

### Supporting skills

| Skill | Role | Artifact | Upstream |
|-------|------|----------|----------|
| `interview` | Companion | session context — writes no files | user intent, `.constitution/` |
| `audit-improvements` | Audit | `.constitution/reports/audit-[TIMESTAMP]-[slug].md` | existing codebase, `.constitution/` |
| `execute-epic-end-to-end` | Execution | source code, git history | `.constitution/tasks/active/`, GitHub issue |
| `pr-review-fix-loop` | Execution | source code, git history | GitHub pull request |
| `commit-push-open-pr` | Git workflow | git history, GitHub PR | working tree |
| `reviewing-pull-requests` | Review (router) | review report | GitHub pull request |
| `reviewing-milestone-commits` | Review (router) | review report | milestone commit |

The two review skills are routers: they dispatch to a `standards`, `spec`, or `full` workflow under their `references/` based on the `mode` passed in the prompt, defaulting to `full` when no mode is given. `pr-review-fix-loop` spawns subagents into `reviewing-pull-requests`; `execute-epic-end-to-end` spawns them into `reviewing-milestone-commits`. `reviewing-pull-requests` also answers direct user requests to review a PR, in which case it runs the `full` workflow.

## Usage

```bash
skillprism validate             # check templates without writing output
skillprism build                # compile skills into dist/<harness>/ (compile-only, never touches live agent dirs)
skillprism build --diff         # preview compiled changes without writing files

skillprism add .                # install these skills into this project's live harness directories
skillprism add . --target user  # install into your user-level config instead
skillprism list                 # list installed skills in live harness directories
skillprism update                # update installed skills to their latest source versions
skillprism remove <skill> ...    # remove installed skills
```

`build` is compile-only: it always renders into `dist/<harness>/` for inspection and never writes into live agent directories. To install a skill where an agent harness (Claude Code, opencode, etc.) will actually load it from — `.claude/skills/`, `.opencode/skills/` — use `skillprism add`.

## Project Structure

```
skills/                  # Skill templates (source of truth)
  <name>/
    skill.yaml           # Metadata (skillprism: '1' header, name, description, variables)
    SKILL.md             # MiniJinja template
    references/          # Supporting reference files
    assets/              # Templates and other static files
skillprism.yaml          # Project configuration (harnesses, skills_dir)
dist/                    # skillprism build output, per harness (gitignored)
```

A `harnesses/` directory holds custom harness definitions and is created on demand by
`skillprism init harness <name>`. This project defines none — it targets the built-in
`claude` and `opencode` harnesses only.

## Harness portability

Skills are authored once and compiled per harness. Anything that names a harness-specific
mechanism — how a subagent is spawned, how a skill is invoked — must be branched with a
`{% if harness.id == "..." %}` conditional scoped to the differing phrase only, never to a
whole paragraph. Harness-specific vocabulary must also stay out of `skill.yaml`'s
`description`, which is shared across every harness.

Today only `execute-epic-end-to-end`, `pr-review-fix-loop`, `interview`, and
`audit-improvements` contain such conditionals; every other skill renders byte-identical
across harnesses, and that is worth preserving.
