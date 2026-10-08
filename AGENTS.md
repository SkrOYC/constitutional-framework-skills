# AGENTS.md

Working notes for this repository. Read this before editing.

## What this is

A **skillprism v0.4.0** project. `skills/<name>/{skill.yaml,SKILL.md}` is the source of truth; `skillprism build` compiles each skill per harness into `dist/`, and `skillprism add` installs it where an agent reads it. It targets `claude` (Claude Code), `codex` (Codex CLI), and `grok` (Grok CLI). The 14 skills are the constitutional framework.

The former canonical copies live in `~/.claude/skills` (a git repo), mirrored by hand into `~/.codex/skills` and `~/.grok/skills`. Read them as reference. This repo is intended to replace that hand-sync.

## Status: candidate source of truth

- ✅ `validate` passes for all 14 skills × 3 harnesses; `build` renders 14 × 3.
- ✅ The rendered output was diffed, file by file, against the live `~/.<harness>/skills` copies: the file sets match exactly, and every difference is intended (frontmatter, harness conditionals, reference neutralization, or canonicalizing stale Codex/Grok copies).
- ✅ `bun test skills/constitution-tooling/scripts/` passes 72 with 1 **pre-existing** failure (`GLS-003 warns on a surface glob that matches no file, and waits for an absent stage`). Do not treat it as this repo's regression.
- ❌ **Not yet installed or smoke-tested live.** No `skillprism add` has run, so there is no proof the three harnesses actually load the rendered skills (Codex's 500-character description cap and Grok's custom-harness directory are the risky spots).
- ❌ **The write loop is not retired.** Until edits land here and the live directories are installs of this repo, `~/.claude/skills` and this repo will drift.
- ⚠️ **The intentional divergences need one review pass**, because unifying to the newest canonical content changes Codex/Grok behavior (Codex `constitution-tooling` gains `format` and newer checks; `commit-push-open-pr` gains autonomous-run handling; Grok interview gains a clarification).
- ⚠️ Neutralized references are unproven outside Claude; there is no CI or versioning.

Graduation path: (1) review the intentional diffs, (2) `skillprism add . --target user` for the three harnesses, (3) smoke-test one skill per harness, (4) make this repo the place edits land and stop hand-copying.

## Harnesses

| Harness | Kind | User skill root | Invocation |
| :--- | :--- | :--- | :--- |
| `claude` (Claude Code) | skillprism built-in | `~/.claude/skills/` | `/skill-name` |
| `codex` (Codex CLI) | skillprism built-in | `~/.codex/skills/` | `/skill-name` |
| `grok` (Grok CLI) | custom, `harnesses/grok.yaml` | `~/.grok/skills/` | `/skill-name` |

Grok is not a skillprism built-in, so `harnesses/grok.yaml` defines its id, capability flags, and directories.

## Layout

```
skills/<name>/
  skill.yaml            # name, description, metadata, variables, overrides
  SKILL.md              # the only templated file (Jinja)
  references/           # copied verbatim by skillprism
  assets/               # copied verbatim
  scripts/              # copied verbatim
harnesses/grok.yaml     # custom harness for Grok CLI
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## Rules

- **One description for every harness, ≤500 characters.** Codex caps at 500 (Claude Code 1536, Grok none documented). `validate` checks the *source* `skill.yaml` description, not the rendered frontmatter, so a per-harness description branch cannot work.
- **Harness conditionals live only in the six skills that genuinely differ**: `execute-epic-end-to-end`, `execute-wave`, `interview`, `pr-review-fix-loop`, `specifying-technical-implementation`, `upgrading-constitution-repos`. The convention is `{% if harness.id == "claude" %}...{% elif harness.id == "codex" %}...{% else %}...{% endif %}` (Grok is `else`). The other eight render identically for every harness.
- **Tooling paths** use `~/.{{ harness.id }}/skills/...`, which resolves to `~/.claude`, `~/.codex`, or `~/.grok` because the harness ids match the directory names.
- **References, assets, and scripts are copied verbatim**, so they must be harness-neutral. Name the harness-specific CLI path only in `SKILL.md`.
- **`references/framework-overview.md` is duplicated into seven skills and must stay byte-identical.** Edit one, copy to the others, verify with `cmp`.
- Quote every interpolated frontmatter value with the `yaml_str` filter.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` must accept every runtime (`claude`, `codex`, `grok`, `pi`, `pig`).

## skillprism v0.4.0 facts (verified against the binary)

- Pin `SKILLPRISM_VERSION=0.4.0` on every invocation, even when also pinning `bunx skillprism@0.4.0`. Without it the launcher fetches release metadata from GitHub each run and 403s after a few calls.
- Built-in harnesses are `claude`, `codex`, `opencode`, `factory`, `pi`. A file under `harnesses/` with a built-in id would *replace* that built-in, so don't do that by accident.
- **Only `SKILL.md` (or `SKILL.md.j2`) is templated.** `references/`, `assets/`, and `scripts/` are copied verbatim — even files named `*.j2`. This is upstream issue [tuvren/skillprism#46](https://github.com/Tuvren/skillprism/issues/46).
- `skillprism.yaml` must have no top-level `name`. Every `skill.yaml` starts with `skillprism: '1'`. `metadata:` is string-to-string — quote every value.
- Harness macros (`harness.<key>`) can only be added by replacing a built-in harness with a full `harnesses/<id>.yaml`; the built-ins' manifest templates and macros are not exposed. This repo keeps the built-ins and uses inline `{% if harness.id == ... %}` branches.
- `dist/` is compile-only and never touches live agent dirs. Installing is `skillprism add`.
- The `tuvren/skillprism` docs and `--help` text are sometimes wrong; verify against the binary.

## Workarounds to retire when skillprism#46 lands

Issue #46 asks skillprism to render files outside `SKILL.md` (intent: `.md` under `references/`) using the existing `*.j2` suffix. Until then, the harness-specific parts of those files are hand-neutralized. Each is marked with a `WORKAROUND: skillprism#46` comment, so `grep -rn 'skillprism#46' skills` lists them.

| File(s) | Current workaround | Restore when #46 lands |
| :--- | :--- | :--- |
| `*/references/framework-overview.md` (7 identical copies) | "plan mode" and "plan-mode session" rewritten to "planning session" / "step 0" | Restore per-harness wording with `{% if harness.id %}` (Codex says "step 0", Claude/Grok say "plan mode") |
| `execute-epic-end-to-end/references/epic-plan.md` | CLI path deferred to `SKILL.md`; plan dirs listed for all three; `worktree`, `models`, `siblings`, and `usage_ceiling_note` examples neutralized | Put the templated CLI path and harness-specific examples back in the reference |
| `reviewing-pull-requests/references/documents-review.md` | `validate` command points at the CLI path in `SKILL.md` | Put the templated CLI path directly in the reference |
| `upgrading-constitution-repos/references/move-map.md` | "Sonnet explorer" genericized to "read-only explorer subagent" | Restore harness-specific explorer wording |
| `constitution-tooling/references/checks.md` | Bundle/"plan mode" wording neutralized | Restore per-harness wording |
| `constitution-tooling/scripts/lib/plan.ts` | Code comment neutralized | Trivial; restore or keep |

The `reviewing-pull-requests/SKILL.md` `## Tooling` section exists only to give `documents-review.md` a templated path to point at; remove it once the reference can hold the path itself.

## Permanent portability fixes (not workarounds)

- `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` (its own install location) and scans `.claude`, `.codex`, and `.grok` plan dirs. This is correct regardless of #46 and should stay.
- `constitution-tooling/assets/schemas/epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `pi`, `pig`). Correctness fix; keep.
- The ≤500-character description cap and the `~/.{{ harness.id }}` tooling-path convention are permanent.

## Before calling a change done

```bash
export SKILLPRISM_VERSION=0.4.0
bunx skillprism@0.4.0 validate .          # all 14 skills × 3 harnesses
bunx skillprism@0.4.0 build --force       # dist/<harness>/ (gitignored)
```

Then confirm:

- No unrendered Jinja in `dist/`: `grep -rn '{{' dist` is empty.
- `dist/claude`, `dist/codex`, and `dist/grok` each contain 14 skills.
- The intentionally-diverged skills differ per harness in the expected regions and the eight identical skills are byte-identical across harnesses.
- The seven `references/framework-overview.md` copies are identical.
- `bun test skills/constitution-tooling/scripts/` is 72 pass / 1 known `GLS-003` failure.
- Delete `dist/` when done — it is gitignored but should not be left around.

## Handoff: when skillprism renders references

1. Bump `SKILLPRISM_VERSION` and the `bunx skillprism@<version>` pins here and in `README.md`.
2. `grep -rn 'skillprism#46' skills` and, for each file, either restore the templated form or keep the neutral form (the neutral wording is often fine; the point is the choice becomes explicit).
3. Adopt the new mechanism (for example rename `references/epic-plan.md` to `references/epic-plan.md.j2` and use `~/.{{ harness.id }}/skills/...` directly).
4. Re-run `validate` and `build`, redo the recursive diff against the live copies, then install and smoke-test per harness.
5. Delete the workaround table above and the inline `WORKAROUND` markers.

## Do not touch user-level skills

Unless explicitly asked, **never** run `skillprism add --target user`, edit anything under `~/.claude/skills`, `~/.codex/skills`, or `~/.grok/skills`, or run `git` commands that write there. `add --target project` is fine. This repo's `.claude/`, `.codex/`, `.grok/`, `.agents/`, and `dist/` are gitignored.
