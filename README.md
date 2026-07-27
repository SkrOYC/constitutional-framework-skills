# Constitutional Framework Skills

Agent skills for the **AI Project Development Framework** — a governed, modular, directory-isolated artifact chain under the hidden `.constitution/` root.

Managed with [skillprism](https://tuvren.github.io/skillprism/).

## Skills

| Skill | Stage | Artifact |
|-------|-------|----------|
| `defining-product-requirements` | 1 — Product Definer | `.constitution/prd/` |
| `designing-solution-architecture` | 2 — Solution Architect | `.constitution/architecture/` |
| `specifying-technical-implementation` | 3 — Tech Lead | `.constitution/tech-spec/` |
| `planning-engineering-execution` | 4 — Engineering Planner | `.constitution/tasks/` |
| `audit-improvements` | Audit | `.constitution/reports/` |
| `execute-epic-end-to-end` | Execution | — |
| `interview` | Companion | — |

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
harnesses/                # Custom harness definitions (skillprism init harness <name>)
skillprism.yaml            # Project configuration (harnesses, skills_dir)
dist/                      # skillprism build output, per harness (gitignored)
```
