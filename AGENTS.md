# AGENTS.md

Working notes for this repository. Read this before editing.

## What this is

A **skillprism v0.5.0** project. `skills/<name>/{skill.yaml,SKILL.md}` is the source of truth; `skillprism build` compiles each skill per harness into `dist/`, and `skillprism add` installs it where an agent reads it. It targets `claude` (Claude Code), `codex` (Codex CLI), `grok` (Grok CLI), and `antigravity` (Antigravity CLI). The 14 skills are the constitutional framework.

## Status

- ✅ `validate` passes for all 14 skills × 4 harnesses; `build` renders 14 × 4.
- ✅ **References are templated now.** v0.5.0 renders any `*.j2` file anywhere in a skill directory, stripping the suffix. The harness-sensitive references (`framework-overview.md`, `epic-plan.md`, `documents-review.md`, `move-map.md`, `checks.md`) are `.md.j2` templates.
- ✅ `bun test skills/constitution-tooling/scripts/` passes.
- ⚠️ **The intentional canonicalization needs one review pass.** The unified source adopts the newest content for each harness, so Codex and Grok gain checks and wording they were missing (Codex `constitution-tooling` gains `format` and newer checks; `commit-push-open-pr` gains autonomous-run handling).

## Harnesses

| Harness | Kind | User skill root | Invocation |
| :--- | :--- | :--- | :--- |
| `claude` (Claude Code) | skillprism built-in | `~/.claude/skills/` | `/skill-name` |
| `codex` (Codex CLI) | skillprism built-in | `~/.codex/skills/` | `/skill-name` |
| `grok` (Grok CLI) | custom, `harnesses/grok.yaml` | `~/.grok/skills/` | `/skill-name` |
| `antigravity` (Antigravity CLI) | custom, `harnesses/antigravity.yaml` | `~/.gemini/antigravity-cli/skills/` | `/skill-name` |

Grok and Antigravity are not skillprism built-ins, so `harnesses/grok.yaml` and `harnesses/antigravity.yaml` define their ids, capability flags, and directories.

## Layout

```
skills/<name>/
  skill.yaml            # name, description, metadata, variables, overrides
  SKILL.md              # the skill template (Jinja)
  references/           # *.j2 files are templates; other files are copied verbatim
  assets/               # same: *.j2 rendered, the rest copied
  scripts/              # same: *.j2 rendered, the rest copied
harnesses/
  grok.yaml             # custom harness for Grok CLI
  antigravity.yaml      # custom harness for Antigravity CLI
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## Rules

- **One short description for every harness, comfortably under Codex's 500-byte cap.** Codex rejects a description over 500 (Claude Code allows more, Grok none documented) and caps its initial skills list, so keep descriptions short and clear rather than rich; check the length yourself, because `validate` does not. `validate` reads the *source* `skill.yaml` description, not the rendered frontmatter, so a per-harness description branch cannot work.
- **Harness conditionals in `SKILL.md` live only in the nine skills that genuinely differ**: `constitution-tooling`, `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `reviewing-milestone-commits`, `reviewing-pull-requests`, `specifying-technical-implementation`, `upgrading-constitution-repos`. Constitution tooling and the review entrypoints add Codex-only bridge references. The convention is `{% if harness.id == "claude" %}...{% elif harness.id == "codex" %}...{% elif harness.id == "antigravity" %}...{% else %}...{% endif %}` (Grok is `else`). A skill without such a branch is harness-neutral in `SKILL.md`; keep it that way unless a real difference exists.
- **Tooling paths** use `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/...`, which resolves to `~/.claude/skills`, `~/.codex/skills`, `~/.grok/skills`, or `~/.gemini/antigravity-cli/skills`.
- **References can be harness-specific via `.j2`.** A reference that names a path, tool, or model per harness is a `.md.j2` template, not a neutral `.md`. Name a file `foo.md.j2`; `build` writes `foo.md`.
- **The bridge is Codex-only content.** `constitution-tooling/references/codex-claude-bridge.md.j2` and `scripts/ccbridge*.ts.j2` wrap their entire contents in a Codex conditional. skillprism 0.5.0 writes every template, so the user approved zero-byte placeholders for the other harnesses. Don't add bridge instructions or code to those outputs, or introduce per-harness asset filtering that this version doesn't support.
- **Never poll the outer wrapper during a bridge receive.** Keep `functions.exec` and its pending `write_stdin` blocked for the receive window. If the wrapper already yielded a cell ID, use one blocking `functions.wait` for the remaining window. Short repeated waits, periodic status checks, and "still waiting" commentary are prohibited during a quiet receive. Preserve this hard rule in the Codex-only bridge reference and its callers.
- **`references/framework-overview.md.j2` is duplicated into seven skills and must stay byte-identical.** Edit one, copy to the others, verify with `cmp`.
- Quote every interpolated frontmatter value with the `yaml_str` filter; `yaml_str` and `tojson` work in `.j2` files too.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `pi`, `pig`), so a plan written under one harness validates under the others.

## skillprism v0.5.0 facts (verified against the binary)

- Pin `SKILLPRISM_VERSION=0.5.0` on every invocation, even when also pinning `bunx skillprism@0.5.0`. Without it the launcher fetches release metadata from GitHub each run and 403s after a few calls.
- Built-in harnesses are `claude`, `codex`, `opencode`, `factory`, `pi`. A file under `harnesses/` with a built-in id would *replace* that built-in, so don't do that by accident.
- **Every `*.j2` file under a skill directory (root and nested) renders once per harness with the suffix stripped.** `.j2` files are templates, so they are no longer copied unchanged (this is the v0.5.0 breaking change). Non-`.j2` files in a copied directory stay byte-for-byte; a root-level non-`.j2` file is not copied. `validate` checks `.j2` syntax, variables, and macros. This is [tuvren/skillprism#46](https://github.com/Tuvren/skillprism/issues/46), fixed in v0.5.0.
- `skillprism.yaml` must have no top-level `name`. Every `skill.yaml` starts with `skillprism: '1'`. `metadata:` is string-to-string — quote every value.
- Harness macros (`harness.<key>`) can only be added by replacing a built-in harness with a full `harnesses/<id>.yaml`; the built-ins' manifest templates and macros are not exposed. This repo keeps the built-ins and uses inline `{% if harness.id == ... %}` branches.
- `dist/` is compile-only and never touches live agent dirs. Installing is `skillprism add`.
- The `tuvren/skillprism` docs and `--help` text are sometimes wrong; verify against the binary.

## Templates and neutralization

Use `.j2` whenever a reference, asset, or script needs harness-specific text; that is the whole point of v0.5.0. Do not hand-neutralize a `.md` file that should differ per harness.

The one intentional neutralization left is a code comment in `constitution-tooling/scripts/lib/plan.ts` ("convenient where a step-0 session can write only one"), which is a `.ts` file kept harness-neutral on purpose. It is fine as is.

## Permanent portability fixes (not workarounds)

- `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` (its own install location) and scans `.claude`, `.codex`, `.grok`, and `.agents` plan dirs. This is correct regardless of templating and should stay.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `pi`, `pig`). Correctness fix; keep.
- Codex's 500-byte description cap and the `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills` tooling-path convention are permanent.

## Before calling a change done

```bash
export SKILLPRISM_VERSION=0.5.0
bunx skillprism@0.5.0 validate .          # all 14 skills × 4 harnesses
bunx skillprism@0.5.0 build --force       # dist/<harness>/ (gitignored)
```

Then confirm:

- No unrendered Jinja in `dist/`: `grep -rn '{{' dist` is empty.
- No `.j2` files in `dist/`: every template was rendered and renamed.
- `dist/claude`, `dist/codex`, `dist/grok`, and `dist/antigravity` each contain 14 skills.
- Skills differ per harness only in the expected regions: tooling paths, harness-conditional `SKILL.md` or reference text, and frontmatter quoting. A skill with none of those stays byte-identical across harnesses.
- The seven rendered `references/framework-overview.md` copies are identical within a harness.
- `bun test skills/constitution-tooling/scripts/` passes.
- After changing the bridge, `bun test dist/codex/constitution-tooling/scripts/ccbridge.test.ts` passes. Its source is a template, so the source-directory test command doesn't execute it.
- Delete `dist/` when done — it is gitignored but should not be left around.

## Adding a skill or a templated reference

`bunx skillprism@0.5.0 init skill <name>`, or write `skills/<name>/skill.yaml` and `SKILL.md`. Keep the description short and comfortably under Codex's 500-byte cap, and use `{{ skill_name | yaml_str }}` and `{{ skill_description | yaml_str }}` in the frontmatter. For a reference that varies per harness, author `references/foo.md.j2` and use `harness.id`, the same skill variables, and the `yaml_str`/`tojson` filters.

## Install from GitHub

When the user asks to install this repository from GitHub into the four harnesses, run the commands in this section. Don't look up flags, docs, or the skillprism source.

The source `SkrOYC/constitutional-framework-skills` is GitHub shorthand. skillprism clones the default branch, `master`, and renders all 14 skills. Grok and Antigravity come from `harnesses/` in that clone, so name them on `--harnesses`.

Don't install `.` for this request. The README `add .` example installs the local checkout, not GitHub. `add .` records source `.` and ref `-`. `update` skips a local source, a missing ref, and a pinned commit, so that install can't be refreshed from GitHub.

To install or replace the 14 framework skills in the user skill roots:

```bash
export SKILLPRISM_VERSION=0.5.0
bunx skillprism@0.5.0 add SkrOYC/constitutional-framework-skills \
  --target user \
  --harnesses claude,codex,grok,antigravity \
  --all \
  --force
```

`--all` installs every skill in the source and skips prompts. `--force` overwrites files that already exist. `--yes` alone doesn't overwrite, and a non-interactive overwrite without `--force` exits 1.

Leave every other skill in those directories alone. `add` writes only the skills from this source.

To confirm, run:

```bash
export SKILLPRISM_VERSION=0.5.0
bunx skillprism@0.5.0 list -g -H claude,codex,grok,antigravity
```

Each of the 14 skills must show source `SkrOYC/constitutional-framework-skills`, ref `master`, scope `user`, and harnesses `claude, codex, grok, antigravity`.

When that record is already in place, refresh with `update` instead of `add`:

```bash
export SKILLPRISM_VERSION=0.5.0
bunx skillprism@0.5.0 update -g -H claude,codex,grok,antigravity --force
```

If `list` shows source `.` or ref `-`, `update` skips those rows. Run the `add` command above.

## Do not touch user-level skills

Unless explicitly asked, **never** run `skillprism add --target user`, edit anything under `~/.claude/skills`, `~/.codex/skills`, `~/.grok/skills`, or `~/.gemini/antigravity-cli/skills`, or run `git` commands that write there. When the user does ask to install this repository from GitHub into the four harnesses, follow [Install from GitHub](#install-from-github). Don't rediscover the command. `add --target project` is fine. This repo's `.claude/`, `.codex/`, `.grok/`, `.agents/`, and `dist/` are gitignored.
