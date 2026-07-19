---
name: pr-review-fix-loop
description: Run an autonomous post-PR review loop by repeatedly spawning an isolated subagent with the reviewing-pull-requests skill, waiting for the review, fixing valid findings locally, committing and pushing the fixes, and repeating until two consecutive review rounds find no high-priority bugs. Use after a PR already exists and the user wants ongoing self-review rounds without supervising each pass. Requires the Agent tool plus `git` and `gh` CLI access. Do not use before a PR exists, for one-off PR reviews with no code changes, or for manual review workflows where the user wants to inspect every round before fixes are pushed.
---

# PR Review Fix Loop

## Overview

Use this skill only after the PR already exists. The loop is meant to keep pressure on correctness until the review skill produces two consecutive rounds without high-priority bugs.

## Loop Contract

1. Confirm the PR target.
   - Identify the PR number from the user, or resolve it from the current branch with `gh pr view`.
   - Stop if no PR exists yet.
   - **Prompt for Review Depth:** Ask the user to choose the review mode for the PR review rounds: either **dual-axis parallel subagents review** (separating Standards and Spec checks) or **standard single-pass review**. Save this preference.
2. Spawn the reviewer subagent(s) based on the chosen review mode. Default to `model: "opus"` for all reviewer subagents unless the user has explicitly specified a different model preference. Do not add your own diagnosis, file hints, or extra context beyond the skill path, the PR number, and the required mode/prompt:
   - **If Standard Single-Pass Review was chosen:**
     * Use the `Agent` tool to spawn one subagent.
     * Tell the subagent to load and execute `/reviewing-pull-requests` with this prompt structure (replacing the PR number only):
       ```
       Run /reviewing-pull-requests and follow it exactly in mode: "full".

       PR#<number>. Aim for comprehensive feedback of 5+ aspects or none.
       ```
     * Wait for the subagent to finish and return its report.
   - **If Dual-Axis Parallel Review was chosen:**
     * Spawn **two parallel subagents** using the `Agent` tool.
     * Instruct Subagent 1 (Standards) with this prompt structure:
       ```
       Run /reviewing-pull-requests and follow it exactly in mode: "standards".

       PR#<number>. Aim for comprehensive feedback of 5+ aspects or none.
       ```
     * Instruct Subagent 2 (Spec) with this prompt structure:
       ```
       Run /reviewing-pull-requests and follow it exactly in mode: "spec".

       PR#<number>. Aim for comprehensive feedback of 5+ aspects or none.
       ```
     * Wait for both subagents to return their results.
     * Merge the reports side-by-side or sequentially under `## Standards` and `## Spec` headers. Do not merge or rerank their findings.
3. Wait for the review result before doing anything else in the loop.
4. Triage the review output.
   - Treat `Potential Bugs` (`P0`/`P1`) as hard loop-driving findings; always fix these when they hold up.
   - Reset the consecutive clean-high-priority-round counter to zero whenever a valid `P0` or `P1` finding appears.
   - Treat `Potential Bugs` (`P2`) as judgment calls: fix them in early rounds (1-4) when the cost is low; in later rounds, only fix P2s that represent real correctness or user-facing issues, not style or minor polish.
   - Treat `Flags -> Investigate` as loop-driving only when investigation reveals a real defect. Flags that reduce to an acceptable tradeoff or deferred Epic item should be documented, if useful, and should not drive another round.
   - Treat `General feedback` as optional unless it clearly reveals a real bug worth fixing now.
   - When a round has no `P0`/`P1` findings, increment the consecutive clean-high-priority-round counter. If the counter is still below two, run one more isolated review round even if the remaining findings are only `P2` or `General feedback`.
   - Stop the loop only after two consecutive rounds with no `P0`/`P1` findings. Do not continue beyond that just to chase `P2` or `General feedback`.
   - Diminishing returns signal: once two consecutive rounds produce only `P2`/`General feedback` findings with no new `P0`/`P1` content, stop and summarize what remains as known deferred items.
5. Address valid findings locally.
   - Re-read the cited code and surrounding context before patching.
   - Fix only findings that hold up after local inspection and verification.
   - Add short inline comments when logic is intentional and non-obvious, especially when that intent could be misread as a bug in a later round.
6. Verify the fixes.
   - Run the narrowest relevant tests, lint, or typechecks first.
   - Broaden validation when the risk justifies it.
7. Commit and push each valid round.
   - If you made code changes, commit them with a descriptive message and push the branch.
   - If a round produced no valid code changes, do not create an empty commit.
   - After pushing, check whether the PR body is now stale relative to the branch. If it is, update the PR body so the description matches the latest cumulative patch set before the next review round.
8. Repeat from step 2.

## Safeguards

- Do not pass parent conversation context into the subagent prompt beyond the skill and PR number. The point is an independent pass.
- Do not silently stop after one round just because some feedback was fixed.
- Do not stop after the first no-`P0`/`P1` round; always run a confirming clean-high-priority round unless a hard safeguard below applies.
- Do not implement every comment mechanically. Review findings still need judgment.
- Do not let the PR body drift after follow-up patches; once it becomes stale, refresh it before continuing the loop.
- If the same invalid finding repeats after the code and comments already make the intent explicit, stop and report the recurring false positive instead of looping forever.
- If the fixes materially change behavior, expect another full review round rather than assuming the previous review still applies.
- Do not run more than about 4-5 rounds on a small or medium PR unless the second consecutive clean-high-priority confirmation is still pending after a valid `P0`/`P1` fix. Beyond that, marginal value drops sharply and cost climbs linearly. Use the two-round `P0`/`P1` stop condition, not zero findings of any kind.
