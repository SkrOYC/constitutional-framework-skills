---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# Commit, push, and open a PR

## Overview

Turn an in-progress local worktree into a reviewable PR on the current branch without inventing missing details. Prefer explicit inputs and repository evidence over assumptions.

## Workflow

1. Inspect the local state before changing anything.
   - Run `git status --short`, `git branch --show-current`, and a remote check such as `git remote -v`.
   - Detect the likely base branch from the current branch config, remote default branch, or existing repo conventions.
   - Check for an existing tracking relationship with `git rev-parse --abbrev-ref @{u}` to know whether this is the first push.
2. Resolve the required values explicitly: commit message, PR title, PR body, base branch, and whether the PR is a draft.
   - If the user or an authorized caller already provided a value or settled a preference, use it and preserve its source; don't ask again because this skill was invoked or the session resumed.
   - If repo conventions and the current task make a value obvious, state the assumption and proceed.
   - If a value is still ambiguous, ask a focused question rather than guessing or silently inventing metadata that would make the PR misleading.
   - When an execution skill passes the values explicitly (an epic lead opening its PR during an autonomous run), or in any autonomous run where nobody can answer, never ask: use the passed values, derive anything left out from the caller's inputs and repo conventions, and state each such assumption in the report. Carry the caller's role, mode, effective authority, communication channel, continuation, and stop boundary; a task amendment doesn't grant host permissions.
3. Confirm required validation, then stage intentionally.
   - Inspect existing results for the candidate and relevant environment, run the project-required checks that are missing or invalidated, and don't repeat checks solely because this skill was invoked.
   - Verify behavior through applicable public-interface checks and existing coverage, without adding isolated unit tests to satisfy a quota. Private projects verify locally by default, with remote tests opt-in; open-source projects accepting outside contributions normally use contribution CI checks, and visibility alone doesn't establish that model. Keep test workflows or actions separate from release execution, and honor the owner's actual required gates.
   - Default to `git add -A` only when the task is to ship all current work. If the worktree contains unrelated changes, stop and clarify scope rather than sweeping everything into one PR.
4. Commit with a descriptive message.
   - Use one commit for a small coherent change unless project rules or the approved plan require separate commits. Preserve stage ownership and separate code/spec commits; related commits and stage patches can share one PR.
   - If there is nothing to commit, say so and don't fabricate a commit step.
5. Push the current branch.
   - Prefer `git push -u origin <current-branch>` on the first push; after that, `git push` is sufficient.
   - If `origin` is not the right remote, detect the writable remote instead of assuming.
6. Open the PR with explicit fields.
   - Write the exact multiline description to a temporary file and use `gh pr create --base <base> --title <title> --body-file <path>`.
   - Add `--draft` only when the user asked for a draft PR.
   - Avoid `--fill` unless the user explicitly wants commit-derived PR text.
   - Capture the returned PR URL and number.
7. Report the exact result: branch name, commit hash, push target, PR number, PR URL, and any assumptions made for base branch or PR wording.
   - Return the next gate and stop boundary to the caller. On resume, reuse native task handles and rerun only invalidated checks. Where the harness exposes the state, distinguish a queued, delivered, or applied handoff.

## Guardrails

- Don't rewrite or clean unrelated user changes to make the commit easier to ship.
- Don't create, switch, or rename branches; the current branch is always used as-is.
- Don't use browser-based `gh pr create --web` unless the user asked for a browser flow.
- Don't open a PR before confirming the branch was pushed successfully.
- Opening a PR doesn't authorize merge or release. Continue only within the user's existing authority.
