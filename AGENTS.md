# AGENTS.md

Working notes for this repository. Read this before editing.

## What this is

A **skillprism v0.6.0** project. `skills/<name>/{skill.yaml,SKILL.md}` is the source of truth; `skillprism build` compiles each skill per harness into `dist/`, and `skillprism add` installs it where an agent reads it. It targets `claude` (Claude Code), `codex` (Codex CLI), `grok` (Grok CLI), `antigravity` (Antigravity CLI), `devin-cloud` (Devin Cloud sessions), and `devin-cli` (the local Devin CLI). The 14 skills are the constitutional framework.

## Status

- ✅ `validate` passes for all 14 skills × 6 harnesses; `build` renders 14 × 6.
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
| `devin-cloud` (Devin Cloud) | custom, `harnesses/devin-cloud.yaml`; ships as a plugin with `platforms: ["cloud"]` | plugin cache | `/skill-name` |
| `devin-cli` (Devin CLI) | custom, `harnesses/devin-cli.yaml` | `~/.config/devin/skills/` | `/skill-name` |

Grok, Antigravity, and both Devin harnesses use custom harness definitions under `harnesses/` for their ids, capability flags, and directories. `devin-cloud` ships only as the packaged plugin and is never passed to `skillprism add`, because it shares `.devin/skills` and `.config/devin/skills` paths with `devin-cli`.

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
  devin-cloud.yaml      # custom harness for Devin Cloud (plugin only)
  devin-cli.yaml        # custom harness for the local Devin CLI
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## Rules

- **One short description for every harness, comfortably under Codex's 500-byte cap.** Codex rejects a description over 500 (Claude Code allows more, Grok none documented) and caps its initial skills list, so keep descriptions short and clear rather than rich; check the length yourself, because `validate` does not. `validate` reads the *source* `skill.yaml` description, not the rendered frontmatter, so a per-harness description branch cannot work.
- **Harness conditionals in `SKILL.md` live only in the nine skills that genuinely differ**: `constitution-tooling`, `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `reviewing-milestone-commits`, `reviewing-pull-requests`, `specifying-technical-implementation`, `upgrading-constitution-repos`. Constitution tooling and the review entrypoints add Codex-only bridge references. Use explicit `devin-cloud` and `devin-cli` branches for session delegation and planning, with Grok as the final `else`; Codex-only bridge files are omitted for both Devin harnesses. A skill without delegation branches stays neutral except for tooling paths and the Devin path definition.
- **Tooling paths** keep existing harness roots unchanged. For the Devin harnesses, render `<skills-root>/...`, where `<skills-root>` is the parent directory of the invoked skill’s `Base directory: <dir>`; define it in each Devin `SKILL.md` that uses it.
- **References can be harness-specific via `.j2`.** A reference that names a path, tool, or model per harness is a `.md.j2` template, not a neutral `.md`. Name a file `foo.md.j2`; `build` writes `foo.md`.
- **The bridge is Codex-only content.** `constitution-tooling/references/codex-claude-bridge.md.j2` and `scripts/ccbridge*.ts.j2` wrap their entire contents in a Codex conditional. skillprism 0.6.0 omits a template that renders empty for a harness, so the bridge produces no file outside Codex — the earlier zero-byte placeholder workaround is gone. Don't add bridge instructions or code for the other harnesses, or introduce per-harness asset filtering that this version doesn't support.
- **Never poll the outer wrapper during a bridge receive.** Keep `functions.exec` and its pending `write_stdin` blocked for the receive window. If the wrapper already yielded a cell ID, use one blocking `functions.wait` for the remaining window. Short repeated waits, periodic status checks, and "still waiting" commentary are prohibited during a quiet receive. Preserve this hard rule in the Codex-only bridge reference and its callers.
- **`references/devin-cli-headless.md.j2` is claude/codex/grok-only.** Its whole contents sit inside one conditional, so it renders empty (and is omitted) for antigravity, devin-cloud, and devin-cli. Headless Devin CLI fills leaf roles only (workers, reviewers, fixers, spec-patch workers, designers, spikes, research, upgrade code-group workers), never epic or wave leads. Callers link it from `framework-overview.md.j2`, `execute-wave`, `execute-epic-end-to-end` (including `epic-plan.md.j2`), `pr-review-fix-loop`, `interview`, `specifying-technical-implementation`, `upgrading-constitution-repos`, and `constitution-tooling`.
- **`references/framework-overview.md.j2` is duplicated into seven skills and must stay byte-identical.** Edit one, copy to the others, verify with `cmp`.
- Quote every interpolated frontmatter value with the `yaml_str` filter; `yaml_str` and `tojson` work in `.j2` files too.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `devin`, `devin-cloud`, `devin-cli`, `pi`, `pig`), so a plan written under one harness validates under the others.

## skillprism v0.6.0 facts (verified against the binary)

- Pin `SKILLPRISM_VERSION=0.6.0` on every invocation, even when also pinning `bunx skillprism@0.6.0`. Without it the launcher fetches release metadata from GitHub each run and 403s after a few calls.
- Built-in harnesses are `claude`, `codex`, `opencode`, `factory`, `pi`. A file under `harnesses/` with a built-in id would *replace* that built-in, so don't do that by accident.
- **Every `*.j2` file under a skill directory (root and nested) renders once per harness with the suffix stripped.** `.j2` files are templates, so they are no longer copied unchanged (this is the v0.5.0 breaking change). Non-`.j2` files in a copied directory stay byte-for-byte; a root-level non-`.j2` file is not copied. `validate` checks `.j2` syntax, variables, and macros. This is [tuvren/skillprism#46](https://github.com/Tuvren/skillprism/issues/46), fixed in v0.5.0.
- **A template or harness sidecar that renders empty for a harness produces no file for that harness** (the v0.6.0 change), and a `SKILL.md` that renders empty emits nothing at all; builds print `[render] skipped` warnings, and `add` and `update` behave the same. This is how the Codex-only bridge files stay Codex-only.
- `skillprism.yaml` must have no top-level `name`. Every `skill.yaml` starts with `skillprism: '1'`. `metadata:` is string-to-string — quote every value.
- Harness macros (`harness.<key>`) can only be added by replacing a built-in harness with a full `harnesses/<id>.yaml`; the built-ins' manifest templates and macros are not exposed. This repo keeps the built-ins and uses inline `{% if harness.id == ... %}` branches.
- `dist/` is compile-only and never touches live agent dirs. Installing is `skillprism add`.
- The `tuvren/skillprism` docs and `--help` text are sometimes wrong; verify against the binary.

## Devin CLI headless facts (verified on 3000.14.30821)

- In `-p` mode a tool call that needs confirmation is rejected, stderr gets `warning: rejected a tool call that requires confirmation...`, and the run still exits 0 — check stderr after every run; a rejection means incomplete work, never a clean result.
- Read the top-level `session_id` from the `--export` file once it exists; don't use `devin list` for it.
- `devin -r <session_id> -p` resumes a headless session with its full history; reuse the same `--export` path to keep one export.
- A startup error such as an unknown model exits 1 with the error on stderr.

## Templates and neutralization

Use `.j2` whenever a reference, asset, or script needs harness-specific text; that is the whole point of v0.5.0. Do not hand-neutralize a `.md` file that should differ per harness.

The one intentional neutralization left is a code comment in `constitution-tooling/scripts/lib/plan.ts` ("convenient where a step-0 session can write only one"), which is a `.ts` file kept harness-neutral on purpose. It is fine as is.

## Permanent portability fixes (not workarounds)

- `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` (its own install location) and scans `.claude`, `.codex`, `.grok`, `.agents`, and `.devin` plan dirs. This is correct regardless of templating and should stay.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `devin`, `devin-cloud`, `devin-cli`, `pi`, `pig`). Correctness fix; keep.
- Codex’s 500-byte description cap, the existing harness skill roots, and the Devin harnesses’ Base-directory-relative `<skills-root>` convention are permanent.

## Before calling a change done

```bash
export SKILLPRISM_VERSION=0.6.0
bunx skillprism@0.6.0 validate .          # all 14 skills × 6 harnesses
bunx skillprism@0.6.0 build --force       # dist/<harness>/ (gitignored)
```

Then confirm:

- No unrendered Jinja in `dist/`: `grep -rn '{{' dist` is empty.
- No `.j2` files in `dist/`: every template was rendered and renamed.
- `dist/claude`, `dist/codex`, `dist/grok`, `dist/antigravity`, `dist/devin-cloud`, and `dist/devin-cli` each contain 14 skills.
- Skills differ per harness only in the expected regions: tooling paths, harness-conditional `SKILL.md` or reference text, and frontmatter quoting. A skill with none of those stays byte-identical across harnesses.
- The seven rendered `references/framework-overview.md` copies are identical within a harness.
- `references/devin-cli-headless.md` exists only in `dist/claude`, `dist/codex`, and `dist/grok`; it is absent from `dist/antigravity`, `dist/devin-cloud`, and `dist/devin-cli`.
- `bun test skills/constitution-tooling/scripts/` passes.
- After changing the bridge, `bun test dist/codex/constitution-tooling/scripts/ccbridge.test.ts` passes. Its source is a template, so the source-directory test command doesn't execute it.
- Delete `dist/` when done unless packaging for installation; leave `dist/devin-cloud-plugin/` in place when it is the requested deliverable.
- Existing harness rendering stays byte-identical except intentional shared runtime-schema and survey portability changes.

## Adding a skill or a templated reference

`bunx skillprism@0.6.0 init skill <name>`, or write `skills/<name>/skill.yaml` and `SKILL.md`. Keep the description short and comfortably under Codex's 500-byte cap, and use `{{ skill_name | yaml_str }}` and `{{ skill_description | yaml_str }}` in the frontmatter. For a reference that varies per harness, author `references/foo.md.j2` and use `harness.id`, the same skill variables, and the `yaml_str`/`tojson` filters.

## Install into Devin Cloud

From this checkout, run:

```bash
./scripts/package-devin-cloud-plugin.sh
```

The script pins `SKILLPRISM_VERSION=0.6.0`, builds all 14 skills for all six harnesses, and assembles `dist/devin-cloud-plugin/` with `.devin-plugin/plugin.json` and `skills/`. Install or upload that directory as a Devin plugin; the script does not modify live user skills. Plugin version starts at `0.2.0`. Keep the packaged directory for installation. Re-upload the plugin when moving to this version: `plugin.json` carries `platforms: ["cloud"]`, which prevents it loading in the Devin CLI.

Devin Cloud children run on their own VMs: pass the repository, pushed branch, plan path and contents, and skill to invoke. Choose the child’s batch-level `devin_mode`, request `notify_on_response=true`, and wait for settle notifications rather than polling. Use session ids for messages. A lane’s `worktree` records a verification checkout on the lead VM; fetch the remote branch before verifying child work. Transport-only child commits carry patches to the lead, which owns final milestone commits.

Under the Devin CLI the interactive session is the epic lead and dispatches leaf roles directly with `run_subagent` — `subagent_general` for roles that edit or run commands, `subagent_explore` for read-only research — sharing one worktree, with subagents never committing. Multi-epic waves run one headless lead per lane (`devin -p --prompt-file ... --export`, resumed with `devin -r <session id>`), reporting through report files rather than cross-session messaging.

## Install from GitHub

When the user asks to install this repository from GitHub into the five harnesses, run the commands in this section. Don't look up flags, docs, or the skillprism source.

The source `SkrOYC/constitutional-framework-skills` is GitHub shorthand. skillprism clones the default branch, `master`, and renders all 14 skills. Grok, Antigravity, and Devin CLI come from `harnesses/` in that clone, so name them on `--harnesses`. `devin-cloud` is never passed to `add`: it ships only as the packaged plugin (see [Install into Devin Cloud](#install-into-devin-cloud)) and shares `.devin/skills` and `.config/devin/skills` paths with `devin-cli`.

Don't install `.` for this request. The README `add .` example installs the local checkout, not GitHub. `add .` records source `.` and ref `-`. `update` skips a local source, a missing ref, and a pinned commit, so that install can't be refreshed from GitHub.

To install or replace the 14 framework skills in the user skill roots:

```bash
export SKILLPRISM_VERSION=0.6.0
bunx skillprism@0.6.0 add SkrOYC/constitutional-framework-skills \
  --target user \
  --harnesses claude,codex,grok,antigravity,devin-cli \
  --all \
  --force
```

`--all` installs every skill in the source and skips prompts. `--force` overwrites files that already exist. `--yes` alone doesn't overwrite, and a non-interactive overwrite without `--force` exits 1.

Leave every other skill in those directories alone. `add` writes only the skills from this source.

To confirm, run:

```bash
export SKILLPRISM_VERSION=0.6.0
bunx skillprism@0.6.0 list -g -H claude,codex,grok,antigravity,devin-cli
```

Each of the 14 skills must show source `SkrOYC/constitutional-framework-skills`, ref `master`, scope `user`, and harnesses `claude, codex, grok, antigravity, devin-cli`.

When that record is already in place, refresh with `update` instead of `add`:

```bash
export SKILLPRISM_VERSION=0.6.0
bunx skillprism@0.6.0 update -g -H claude,codex,grok,antigravity,devin-cli --force
```

If `list` shows source `.` or ref `-`, `update` skips those rows. Run the `add` command above.

Devin CLI `read_config_from` imports (from Claude or Codex) can load duplicate copies of these skills from `~/.claude/skills` and `~/.codex/skills`; disable those imports when the `devin-cli` harness is installed.

## Do not touch user-level skills

Unless explicitly asked, **never** run `skillprism add --target user`, edit anything under `~/.claude/skills`, `~/.codex/skills`, `~/.grok/skills`, `~/.gemini/antigravity-cli/skills`, or `~/.config/devin/skills`, or run `git` commands that write there. When the user does ask to install this repository from GitHub into the five harnesses, follow [Install from GitHub](#install-from-github). Don't rediscover the command. `add --target project` is fine. This repo’s `.claude/`, `.codex/`, `.grok/`, `.agents/`, `.devin/`, and `dist/` are gitignored.
