# Constitutional Framework Skills

One [skillprism](https://tuvren.github.io/skillprism/) source for the AI Project Development Framework skills, compiled to Claude Code, Codex CLI, Grok CLI, Antigravity CLI, Devin Cloud (Cognition’s cloud agent), and the local Devin CLI.

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
| `devin-cloud` (Devin Cloud) | plugin, `platforms: ["cloud"]` | plugin cache | `/skill-name` |
| `devin-cli` (Devin CLI) | custom, `harnesses/devin-cli.yaml` | `~/.config/devin/skills/` | `/skill-name` |

Grok, Antigravity, and both Devin harnesses use custom definitions in `harnesses/` for their ids, capability flags, and directories. Devin Cloud ships only as a packaged plugin (`harnesses/devin-cloud.yaml` is never passed to `skillprism add`), and it loads the packaged skills from an unpredictable plugin-cache path.

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
export SKILLPRISM_VERSION=0.6.0

bunx skillprism@0.6.0 validate .    # check every skill for every harness
bunx skillprism@0.6.0 build         # compile to dist/<harness>/, never touches live dirs
bunx skillprism@0.6.0 build --force # overwrite existing dist/ files non-interactively

# Install where an agent actually reads skills. `add` is separate from `build`.
bunx skillprism@0.6.0 add . --target project
bunx skillprism@0.6.0 add . --target user --harnesses claude,codex,grok,antigravity,devin-cli
```

## Install into Devin Cloud

From this checkout, run:

```bash
./scripts/package-devin-cloud-plugin.sh
```

The script pins `SKILLPRISM_VERSION=0.6.0`, builds all 14 skills for all six harnesses, and assembles `dist/devin-cloud-plugin/` with `.devin-plugin/plugin.json` and `skills/`. Install or upload that directory as a Devin plugin; the script does not modify live user skills. Plugin version starts at `0.2.0`. Keep the packaged directory for installation. Re-upload the plugin when moving to this version: its `plugin.json` carries `platforms: ["cloud"]`, which prevents it loading in the Devin CLI.

Devin Cloud children run on their own VMs: pass the repository, pushed branch, plan path and contents, and skill to invoke. Choose the child’s batch-level `devin_mode`, request `notify_on_response=true`, and wait for settle notifications rather than polling. Use session ids for messages. A lane’s `worktree` records a verification checkout on the lead VM; fetch the remote branch before verifying child work. Transport-only child commits carry patches to the lead, which owns final milestone commits.

Under the Devin CLI the interactive session is the epic lead and dispatches leaf roles directly with `run_subagent` — `subagent_general` for roles that edit or run commands, `subagent_explore` for read-only research — sharing one worktree, with subagents never committing. Multi-epic waves run one headless lead per lane (`devin -p --prompt-file ... --export`, resumed with `devin -r <session id>`), reporting through report files rather than cross-session messaging.

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
harnesses/devin-cloud.yaml # custom harness for Devin Cloud (plugin only)
harnesses/devin-cli.yaml  # custom harness for the local Devin CLI
scripts/package-devin-cloud-plugin.sh # build and package the Devin Cloud plugin
skillprism.yaml         # harnesses + skills_dir
dist/<harness>/         # build output (gitignored)
```

## How harness differences are handled

- **Tooling paths** resolve to each existing harness’s user skill root. The Devin harnesses render `<skills-root>/...`, defined as the parent directory of the invoked skill’s `Base directory: <dir>`, so plugin cache locations need not be predictable.
- **`SKILL.md` conditionals**: delegation, planning, and messaging have explicit `devin-cloud` and `devin-cli` branches alongside existing harness behavior. Devin Cloud uses fresh child sessions on separate VMs, approved batch-level `devin_mode`, session-id messaging, and settle notifications without polling. The Devin CLI uses `run_subagent` leaf roles in a shared worktree, headless lane leads launched with `devin -p` and resumed with `devin -r`, and one-time approval through `ask_user_question`. Both write plans at the project path or `.devin/plans/`. Codex-only bridge templates render empty for the other harnesses, so skillprism 0.6.0 omits those files entirely outside Codex.
- **Templated references**: any file named `*.j2` anywhere in a skill directory renders once per harness with the suffix stripped ([skillprism#46](https://github.com/Tuvren/skillprism/issues/46), fixed in v0.5.0). The harness-sensitive references are `.md.j2` templates and use the same `harness.*` context as `SKILL.md`. Everything else is copied verbatim, so non-templated references, assets, and scripts must stay harness-neutral.
- **Descriptions are one short string for all harnesses.** Codex rejects a description over 500 bytes (Claude Code allows more, Grok none documented) and caps its initial skills list, so each description stays comfortably under 500 and prioritizes clarity over richness.
- **Location-independent scripts.** `upgrading-constitution-repos/scripts/survey.ts` derives the `constitution-tooling` CLI from `import.meta.dir` and scans `.claude`, `.codex`, `.grok`, `.agents`, and `.devin` plan directories.

## Notes

- The hand-synced copies this replaces had drifted; the unified source uses the newest canonical content (from the `~/.claude/skills` repository) for every harness, so Codex and Grok pick up checks and wording their copies lacked.
- `constitution-tooling`'s `epic-plan.schema.json` accepts every runtime (`claude`, `codex`, `grok`, `antigravity`, `devin`, `devin-cloud`, `devin-cli`, `pi`, `pig`) so a plan written under one harness validates under the others.
- Devin CLI `read_config_from` imports (from Claude or Codex) can load duplicate copies of these skills from `~/.claude/skills` and `~/.codex/skills`; disable those imports when the `devin-cli` harness is installed.
- v0.5.0 is a breaking change for projects that shipped `*.j2` files expecting them to be copied unchanged: those files are now templates.
