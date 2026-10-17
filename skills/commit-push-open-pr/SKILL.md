---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# Commit Push Open PR

## Overview

Use this skill to turn an in-progress local worktree into a reviewable PR without inventing missing details. The skill operates on the current branch — it never creates or switches branches. Prefer explicit inputs and repository evidence over assumptions.

## Workflow

1. Inspect the local state before changing anything.
   - Run `git status --short`, `git branch --show-current`, and a remote check such as `git remote -v`.
   - Detect the likely base branch from the current branch config, remote default branch, or existing repo conventions.
   - Note any existing tracking relationship via `git rev-parse --abbrev-ref @{u}` to know whether this is the first push.
2. Resolve the required decisions explicitly.
   - Required outputs are: commit message, PR title, PR body, base branch, and whether the PR should be draft.
   - If the user already provided a value, use it.
   - If repo conventions and the current task make a value obvious, state the assumption and proceed.
   - If a value is still ambiguous, ask a focused question instead of guessing.
   - When an execution skill invokes this one with the values passed explicitly (an epic lead opening its PR during an autonomous run), use them and never ask. Anything it left out comes from repo conventions, stated as an assumption in the report.
3. Confirm required validation, then stage intentionally.
   - Inspect the existing results for the candidate and relevant environment; run missing or invalidated checks required by the project. Do not repeat checks solely because this skill was invoked.
   - Default to `git add -A` only when the task is to ship all current work.
   - If the worktree contains unrelated changes, stop and clarify scope instead of sweeping everything into one PR.
4. Commit with a descriptive message.
   - Use one commit unless the user asked for a different history shape.
   - If there is nothing to commit, say so clearly and do not fabricate a commit step.
5. Push the current branch.
   - Prefer `git push -u origin <current-branch>` on the first push.
   - On subsequent pushes, `git push` is sufficient.
   - If `origin` is not the right remote, detect the writable remote instead of assuming.
6. Open the PR with explicit fields.
   - Prefer `gh pr create --base <base> --title <title> --body <body>`.
   - Add `--draft` only when the user asked for a draft PR.
   - Avoid `--fill` unless the user explicitly wants commit-derived PR text.
   - Capture the returned PR URL and number.
7. Report the exact result.
   - Include the branch name, commit hash, push target, PR number, and PR URL.
   - Call out any assumptions you made for base branch or PR wording.

## Guardrails

- Do not silently invent PR metadata when a short clarifying question would prevent a misleading PR. In an autonomous run, where nobody can answer, derive it from the caller's inputs and repo conventions and state the assumption instead.
- Do not rewrite or clean unrelated user changes just to make the commit easier to ship.
- Do not create, switch, or rename branches — the current branch is always used as-is.
- Do not use browser-based `gh pr create --web` unless the user asked for a browser flow.
- Do not open a PR before confirming the branch was pushed successfully.
