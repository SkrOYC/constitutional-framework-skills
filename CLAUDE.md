# Working in this repo

This is a **skillprism v0.4.0** project: `skills/<name>/{skill.yaml,SKILL.md}` is the source of truth, compiled per harness by `skillprism build` into `dist/`, and installed into live agent directories by `skillprism add`. It targets `claude`, `codex`, and `grok`. The 14 skills are the constitutional framework.

The former canonical copies live in `~/.claude/skills` (a git repo), mirrored by hand into `~/.codex/skills` and `~/.grok/skills`. Read them as reference, but this repo is the source now.

## Do not touch user-level skills

Unless the user explicitly asks, **never** run `skillprism add --target user`, edit anything under `~/.claude/skills`, `~/.codex/skills`, or `~/.grok/skills`, or run `git` commands that write there. `add --target project` is fine. This repo's `.claude/`, `.codex/`, `.grok/`, `.agents/`, and `dist/` are gitignored.

## skillprism v0.4.0 facts (verified against the binary)

- Pin `SKILLPRISM_VERSION=0.4.0` on every invocation, even when also pinning `bunx skillprism@0.4.0`. Without it the launcher fetches release metadata from GitHub each run and 403s after a few calls.
- Built-in harnesses are `claude`, `codex`, `opencode`, `factory`, `pi`. **Grok is not built-in**; it is defined in `harnesses/grok.yaml`. A file under `harnesses/` with a built-in id would *replace* that built-in, so don't do that by accident.
- **Only `SKILL.md` (or `SKILL.md.j2`) is templated.** `references/`, `assets/`, and `scripts/` are copied verbatim — even files named `*.j2`. Anything harness-specific in them must be rewritten neutral.
- `validate` checks the **source** `skill.yaml` `description`, not the rendered frontmatter. A `{% if harness.id == "codex" %}` branch cannot supply a shorter Codex description. That is why there is exactly one ≤500-character description.
- **Codex caps descriptions at 500 characters** (Claude Code 1536, Grok none documented). All descriptions must be ≤500.
- `skillprism.yaml` must have no top-level `name`. Every `skill.yaml` starts with `skillprism: '1'`. `metadata:` is string-to-string — quote every value.
- `name` must match the skill directory and be `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Harness macros (`harness.<key>`) can only be added by replacing a built-in harness with a full `harnesses/<id>.yaml`; the built-ins' manifest templates and macros are not exposed. This repo keeps the built-ins and uses inline `{% if harness.id == ... %}` branches instead.
- `dist/` is compile-only and never touches live agent dirs. Installing is `skillprism add`.
- The `tuvren/skillprism` docs and `--help` text are sometimes wrong; verify against the binary.

## Invariants

- **One description for every harness, ≤500 characters.** No `description_verbose` / per-harness description machinery — the validator cannot see it.
- **Conditionals live only in the six skills that genuinely differ**: `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `specifying-technical-implementation`, `upgrading-constitution-repos`. The convention is `{% if harness.id == "claude" %}...{% elif harness.id == "codex" %}...{% else %}...{% endif %}` (Grok is `else`). The other eight render identically for all harnesses.
- **References, assets, and scripts must be harness-neutral.** Do not write `~/.claude/skills`, `Agent tool`, `spawn_agent`, `Sonnet`, `gpt-5.6`, etc. in them. Name the CLI path only in `SKILL.md` (via `~/.{{ harness.id }}/skills`).
- **`references/framework-overview.md` is duplicated into seven skills and must stay byte-identical.** After editing one, copy it to the others and verify with `cmp`.
- **The frontmatter is the only place `yaml_str` is mandatory.** Quote every interpolated frontmatter value with the `yaml_str` filter.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` must accept every runtime (`claude`, `codex`, `grok`, `pi`, `pig`).

## Before calling a change done

```bash
export SKILLPRISM_VERSION=0.4.0
bunx skillprism@0.4.0 validate .          # all 14 skills × 3 harnesses
bunx skillprism@0.4.0 build --force       # dist/<harness>/ (gitignored)
```

Then confirm:

- No unrendered Jinja in `dist/`: `grep -rn '{{' dist` is empty.
- `dist/claude`, `dist/codex`, and `dist/grok` each contain 14 skills.
- The bodies of the intentionally-diverged skills differ per harness in the expected regions, and the eight identical skills are byte-identical across harnesses.
- The `references/framework-overview.md` copies are identical.
- `bun test skills/constitution-tooling/scripts/` passes except the known, pre-existing failure `GLS-003 warns on a surface glob that matches no file, and waits for an absent stage` (72 pass / 1 fail as of the last canonical source). Do not "fix" it as part of an unrelated change.
- Delete `dist/` when done — it is gitignored but should not be left around.

## Adding a skill

`bunx skillprism@0.4.0 init skill <name>`, or write `skills/<name>/skill.yaml` and `SKILL.md`. Keep the description ≤500 characters, use `{{ skill_name | yaml_str }}` and `{{ skill_description | yaml_str }}` in the frontmatter, and leave references harness-neutral.
