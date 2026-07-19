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
skillprism build        # compile skills to all configured harnesses
skillprism validate     # check templates without writing output
skillprism build --diff # preview changes without writing files
```

## Project Structure

```
skills/                  # Skill templates (source of truth)
  <name>/
    skill.yaml           # Metadata and variables
    SKILL.md             # MiniJinja template
    references/          # Supporting reference files
    assets/              # Templates and other static files
.claude/skills/          # Compiled output for Claude Code
.opencode/skills/        # Compiled output for Opencode
skillprism.yaml          # Project configuration
```
