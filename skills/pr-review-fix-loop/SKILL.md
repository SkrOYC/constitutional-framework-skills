---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# PR Review Fix Loop

## Overview

Use this skill only after the PR already exists. The loop keeps pressure on correctness and ends when a verification round finds nothing new worth acting on. Two things make it converge: findings are triaged by judgment before anything is fixed, and every round after the first reviews only what changed since the last one.

## Configuration

The caller passes the configuration; an execution skill passes the plan file's `review_panel` and `pr_review` blocks. Use what is passed and never ask. Only when a user invokes the loop directly and names nothing, ask once for all of it in one question, and save the answer as the preference for the session.

| Setting | Meaning | Default |
| :--- | :--- | :--- |
{% if harness.id == "claude" %}| `review_panel` | One reviewer per entry, each `{runtime, model, mode}`, run in parallel in round one | One Claude reviewer on Opus and one Codex reviewer on its strongest available model, both `mode: "full"`; `mode: "documents"` for a constitution-only PR |
| `fix_worker` | Runtime and model of the fix worker dispatched each round | Opus on the runner's runtime |
{% elif harness.id == "codex" %}| `review_panel` | One reviewer per entry, each `{runtime, model, mode}`, run in parallel in round one | Two Codex reviewers on different models, or one Codex and one pi reviewer when pi is available, both `mode: "full"`; `mode: "documents"` for a constitution-only PR |
| `fix_worker` | Runtime and model of the fix worker dispatched each round | `gpt-5.6-terra` through Codex collaboration |
{% else %}| `review_panel` | One reviewer per entry, each `{runtime, model, mode}`, run in parallel in round one | One Grok reviewer (`spawn_subagent`, runtime `grok`) and one Codex reviewer on its strongest available model, both `mode: "full"`; `mode: "documents"` for a constitution-only PR |
| `fix_worker` | Runtime and model of the fix worker dispatched each round | The runner's model on runtime `grok` |
{% endif %}
| `review_escalate_at` | The round at which the loop changes strategy if it hasn't converged | 4 |

{% if harness.id == "claude" %}Always pass the model explicitly on every dispatch. A Claude panelist runs through the Agent tool. A Codex or pi panelist runs through the `codex-subagent` or `pi-subagent` skill's one-off form with read-only access, using the offline snapshot below when its effective permissions do not allow `gh` network access, told to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md` and follow it, since it can't invoke a Claude skill by name. Discover model ids through that skill's `models` command; never guess one.{% elif harness.id == "codex" %}Dispatch Codex panelists through `collaboration.spawn_agent` with `fork_turns: "none"`, an explicit available model, and reasoning effort. Dispatch pi panelists through `pi-subagent` with read-only access and the offline snapshot below when `gh` network access is unavailable. Every panelist reads `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md` and follows the requested mode. Use only models actually available in the current harness.{% else %}Always pass the model explicitly on every dispatch. A Grok panelist is a `spawn_subagent`. Do not pass a subagent type. The prompt says the reviewer must not create, edit, or delete files, and must not spawn further subagents. A Codex or pi panelist runs through the `codex-subagent` or `pi-subagent` skill's one-off form with read-only access, using the offline snapshot below when its effective permissions do not allow `gh` network access, told to read `~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md` and follow it, since it can't invoke a Grok skill by name. Discover model ids through that skill's `models` command; never guess one. The Grok panelist's model is the one the caller named.{% endif %}

## Loop contract

### 1. Confirm the PR

Identify the PR number from the caller, or resolve it from the current branch with `gh pr view`. Stop if no PR exists yet. If every changed path is under `.constitution/`, run the documents flow in §7 instead of this one.

### 2. Round one: the panel

Before dispatch, establish whether each runtime can fetch the PR with its effective permissions. A filesystem read-only policy does not universally imply no network. The `codex-subagent` wrapper's `network` option configures `workspace-write`; turning it on does not grant network to that wrapper's read-only sandbox. Keep the review read-only and supply a snapshot when network is unavailable.

For an offline panelist, collect a fresh snapshot under `<worktree>/.{{ harness.id }}/scratch/pr-<number>/<head-SHA>/`. Ensure the scratch path is ignored and stays inside the worktree. Follow the producer contract below before dispatching; tell the reviewer its absolute `snapshot` path, expected `head` SHA, and checkout path.

Spawn every panelist in parallel, with no parent context. Give each only the skill, the PR number, the mode, the expected head and checkout, the snapshot path when needed, and this prompt:

<reviewer_prompt>

```
{% if harness.id == "codex" %}Read ~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md and follow it exactly in mode: "<mode>".{% else %}Run /reviewing-pull-requests and follow it exactly in mode: "<mode>".{% endif %}

PR#<number>. Expected head: <head-SHA>. Checkout: <absolute worktree path>. When supplied, read snapshot: <absolute snapshot directory> under the reviewing-pull-requests offline contract. Return the reviewed head SHA, whether required coverage is complete, and findings or an explicit statement that there are none; name verification limits. Report every issue you find, including low-severity ones and uncertain ones filed as Investigate, each with a severity label. Do not pad to a count and do not filter for importance; the loop filters afterwards.

{% if harness.id == "claude" %}Do NOT launch any subagents (no Agent tool use) — do all reading and work directly yourself.{% elif harness.id == "codex" %}Do not spawn or delegate to subagents; do all reading and work directly yourself.{% else %}Do NOT launch any subagents (no spawn_subagent, and no codex or pi workers) — do all reading and work directly yourself.{% endif %}
```

</reviewer_prompt>

{% if harness.id != "codex" %}For a Codex or pi panelist, replace the first line with `Read ~/.{{ harness.id }}/skills/reviewing-pull-requests/SKILL.md and follow it exactly in mode: "<mode>".`

{% endif %}Wait for every panelist before triage. A completed review names the expected head, confirms coverage, and returns findings or explicitly states there are none. An empty response, access failure, mismatched revision, or incomplete review is re-dispatched once after repairing its inputs or runtime. If that attempt also fails, report the review blocker to the caller; do not declare the PR review-clean. This rule applies to every runtime, round, and documents-mode panel. Confirm the PR's head and base SHAs still match the reviewed inputs before accepting the round; if either changed, refresh the inputs and review the changed candidate.

#### Offline snapshot producer contract

Collect `pr.json` with `gh pr view <number> --json number,title,body,author,baseRefName,headRefName,baseRefOid,headRefOid,files,commits,comments,reviews`, then `pr.diff` with `gh pr diff <number>`. Capture `commits.txt` with `git log --format=fuller <merge-base>..<head-SHA>`, where the merge base is computed from the captured base and head SHAs. Fetch missing objects before dispatch; never ask an offline reviewer to fetch them.

Read the PR's explicit issue references and collect their number, URL, title, body, state, and comments with `gh issue view <issue> --json number,url,title,body,state,comments`; write the records as an array in `issues.json`, or `[]` when none is referenced. Collect `checks.json` with `gh pr view <number> --json statusCheckRollup` when available. An optional checks fetch failure goes in `unavailable.txt`; a required PR or issue fetch failure blocks dispatch. In a verification round, write the exact prior reviewed SHA to `since.txt` and capture `since.diff` with `git diff <since-SHA> <head-SHA>`.

Require the checkout's `git rev-parse HEAD` to match `headRefOid` and its tracked files to be clean. Re-read `headRefOid` and `baseRefOid` from GitHub after collection. If either changed, discard the candidate snapshot and capture again; if it changes again during that retry, report an unstable-candidate blocker. Publish a complete snapshot only after these checks, and keep it unchanged while its panelists run. The consumer contract is `~/.{{ harness.id }}/skills/reviewing-pull-requests/references/offline-snapshot.md`.

### 3. Triage: you are the lead, not an aggregator

Read every finding, deduplicate the ones that describe the same defect in different words, and note which panelists raised each. A finding two model families raised independently is the strongest signal the loop gets; a lone finding still gets read. Then check each finding against the code yourself: re-read the cited lines and their surroundings, and run a check when one settles it. Sort every finding into one bucket, with a one-line reason:

- **Act on.** A `P0` or `P1` that holds up locally, or a `P2` that is a real correctness or user-facing defect, including anything that would make a documented command, instruction, or handoff fail when followed literally. These get fixed this round.
- **Consider.** Legitimate, but the fix costs more than it's worth now. Fixed only if cheap; otherwise reported as a follow-up.
- **Noted.** Valid and not actionable: context-dependent, premature, or low impact at this stage. Evidence bookkeeping lands here, whatever severity the reviewer gave it: manifest wording, a stale verified-at commit, a SHA a rebase rewrote. Evidence that claims a pass that didn't happen, contradicts the code's behavior, backs a `done` ticket whose `result` is `fail` or `not_met`, or fails `validate` is a defect, and goes to Act on.
- **Dismissed.** Wrong, a nitpick, or missing context that the code or a nearby comment already supplies. The reason says which.

Post one PR comment per round with the triage table: finding, panelists, bucket, reason. Dismissals with reasons on the record are what stop the next round from re-filing them.

If round one's triage has no Act-on finding, the loop is done: skip §4 and §5 and go to §8. A round with nothing to fix has nothing to verify.

### 4. Fix the Act-on findings

Dispatch one fresh fix worker with no parent context, on the configured `fix_worker` runtime and model, with the Act-on list (and any cheap Consider items), the PR branch, and these instructions, the last one verbatim:

- Re-read the cited code and surrounding context before patching. Fix only what the finding describes.
- Add short inline comments where logic is intentional and non-obvious, especially where that intent could be misread as a bug.
- Reconcile restated values: when a fix changes a count, status, digest, version, inventory, or convention repeated elsewhere in the PR (sibling files, summaries, changelogs, the PR body), grep for the old value and update every copy.
- When a fix changes a contract, schema, lock, golden, fixture, or generated artifact, change the check that pins the old value too.
- Run the narrowest relevant tests, lint, or typechecks, then broaden when the risk justifies it.
- {% if harness.id == "claude" %}"Do NOT launch any subagents (no Agent tool use) — do all reading and work directly yourself."{% elif harness.id == "codex" %}"Do not spawn or delegate to subagents; do all reading and work directly yourself."{% else %}"Do NOT launch any subagents (no spawn_subagent, and no codex or pi workers) — do all reading and work directly yourself."{% endif %}

A caller that runs its own commit discipline (an epic lead verifying and committing per its Step 3) receives the worker's changes and commits them itself; otherwise commit with a descriptive message and push. Never create an empty commit. After pushing, refresh the PR body if it no longer matches the cumulative change.

### 5. Verification rounds

Run a verification round against the new head. Refresh all offline snapshot inputs, including the PR metadata, issue context, CI status when available, and `since.diff`, before dispatch. Its reviewers get the same prompt plus the `since` SHA (the head the previous round reviewed) and the previous round's Act-on and Dismissed lists; `reviewing-pull-requests` then reviews only the changed diff and what it touches, and confirms each prior Act-on finding is resolved.

- Use at least one panelist on a different model family from the fix worker, so the fix is judged by a model that didn't write it. One verification reviewer is enough for a small fix; use the full panel when the fix changed behavior materially or touched many files.
- Triage its findings as in §3. New Act-on findings go back to §4, and the round after that is another verification round.
- **Stop** when a verification round has no new Act-on finding of any severity and every prior Act-on finding is resolved. That single clean round is the stop condition; a second confirming round is not needed, because triage has already filtered the noise that used to require it.

### 6. When the loop doesn't converge

On a code PR the loop has no round cap: it keeps going until it stops cleanly. At `review_escalate_at`, and at every round after it that still isn't clean, change strategy instead of repeating the same move, one change per round, in this order:

1. **Attack the premise.** When the recurring findings share a cause (the same kind of defect coming back one file over, fixes that keep breaking something adjacent), name the shared premise and brief the next fix worker to fix that premise, not the latest instance.
2. **A stronger or different fixer.** Move the fix worker to a higher model tier, or to the other runtime.
3. **A fresh full panel.** Run a full-PR panel round with the models swapped, to separate real defects from one reviewer's persistent blind spot.

When all three have been used and the loop still isn't clean, start the sequence again from step 1 with what the last rounds showed; each pass through it should narrow the premise. A finding that recurs after the code and comments already make the intent explicit is Dismissed with that reason, not fixed again. Record every strategy change in the round's PR comment and in the final report.

### 7. Documents mode

For a PR that changes only `.constitution/`, the loop is bounded by design, because a code-review loop doesn't converge on cross-referencing documents.

1. Run the panel once with `mode: "documents"`.
2. Triage as in §3, and have one fix worker address the Act-on findings.
3. Run one verification round, scoped as in §5.
4. Fix any Act-on `P0` or `P1` it finds, confirm with `validate`, and stop. Don't review again.
5. Every finding a reviewer tagged with a validator check that would have caught it goes in the report as a tooling follow-up for `constitution-tooling`.

### 8. Finish

After the loop stops, remaining `P2`s may land as one final batch without another round only if each is small, verified by the same checks the loop used, and pushed with CI green; everything else is reported as a known deferred item. Don't reopen the loop for that batch.

Report: rounds run, the panel and the models used, strategy changes and when, Act-on findings fixed, Consider and Noted items left, Dismissed findings with their reasons, tooling follow-ups, and the final head SHA.

## Safeguards

- Do not pass parent conversation context into a reviewer or fix worker beyond what §2 and §4 list. The point is an independent pass.
- Do not let spawned subagents launch subagents of their own. Every reviewer and fix-worker prompt carries the no-further-subagents instruction; a reviewer that fans out into its own agent tree wastes tokens, escapes the loop's model policy, and can be orphaned mid-flight by session limits.
- Do not fix findings you haven't triaged, and do not fix Dismissed findings.
- Do not stop after a round just because some feedback was fixed; stop only on the §5 condition.
- If a fix in round N introduces a `P1` in round N+1 (a stale copy, a contradiction with a sibling file), treat it as a reconciliation failure of the fix step, not as new review noise: brief the next fix worker on the reconciliation it missed.
