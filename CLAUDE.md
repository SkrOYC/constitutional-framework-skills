# Working in this repo

This repo is a skillprism project: `skills/<name>/{skill.yaml,SKILL.md}` are the source of truth, compiled per-harness into `dist/` (or installed live via `skillprism add`). Configured harnesses today: `claude`, `opencode`. `pi` and `agy` (antigravity-cli, not a skillprism built-in) are future work — don't add them without the user's go-ahead.

## skillprism CLI gotchas (v0.2.0, verified against the real binary — its docs and `--help` text are sometimes wrong)

- Always pin `SKILLPRISM_VERSION=0.2.0` (or whatever version you're targeting) as an env var, even when also pinning `bunx skillprism@0.2.0`. Without it, the launcher fetches "latest release" metadata from GitHub's API on every invocation and 403s after a handful of calls.
- `skillprism.yaml` must NOT have a top-level `name` field. Every `skill.yaml` MUST start with `skillprism: '1'`. Violating either fails `validate`/`build` with a misleading `Invalid YAML in ...:1` error that is actually a schema error, not a syntax error.
- `skill.yaml`'s `metadata:` map is string-to-string only — quote every value, including booleans (`companion: "true"`, not `companion: true`).
- Template interpolation (`{{ skill_description }}`, `{{ metadata.x }}`, etc.) is **not** YAML-escaped or requoted automatically. If the source value needs quotes in YAML, add them explicitly in the template (`description: "{{ skill_description }}"`), or a value containing a colon can break the rendered frontmatter.
- `skillprism build` is compile-only and always writes to `dist/<harness>/`; it never touches live agent directories. Installing where a harness actually loads skills from (`.claude/skills/`, `.opencode/skills/`) is `skillprism add`.
- `{{ harness.id }}` conditionals work and are the right tool for harness-specific content — but scope the `{% if %}` to the single differing phrase, not whole paragraphs, to keep the diff between harnesses minimal and reviewable.
- Don't trust `harness.skill_ref_pattern` or a `skill_ref()` helper for cross-skill references — the former is wrong for opencode (opencode invokes skills via a `skill({ name: "..." })` tool call, not `/name`), and the latter doesn't exist in the binary despite being documented. Hand-verify a harness's actual conventions from that harness's own docs before writing harness-specific instructions — don't guess.
- Known upstream bugs already filed against `tuvren/skillprism`: issues #31–#35 (misleading validation errors, missing JSON Schema, `init project` non-interactive harness default, unescaped template YAML output, missing `skill_ref()`). Check there before re-diagnosing the same thing.

## Before calling a change done

Run `SKILLPRISM_VERSION=0.2.0 bunx skillprism@0.2.0 validate .` and `build`, then diff the rendered `dist/` output against the pre-change version to confirm intended-identical skills stayed byte-identical and only intentionally-diverged skills changed. Clean up `dist/` afterward (it's gitignored, but don't leave it lying around mid-session).
