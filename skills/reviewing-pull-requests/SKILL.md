---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
---

# Reviewing Pull Requests (Router)

This skill routes the subagent to the correct reference workflow based on the `mode` parameter passed in your prompt:

*   **mode: "standards"** -> Immediately load and follow [references/standards-review.md](references/standards-review.md).
*   **mode: "spec"** -> Immediately load and follow [references/spec-review.md](references/spec-review.md).
*   **mode: "documents"** -> Immediately load and follow [references/documents-review.md](references/documents-review.md). For a PR that changes only `.constitution/`.
*   **mode: "full"** (or default) -> Immediately load and follow [references/full-review.md](references/full-review.md).

## Offline input

When the caller supplies `snapshot: ABSOLUTE_DIRECTORY`, expected `head: HEAD_SHA`, and a checkout path, first read [references/offline-snapshot.md](references/offline-snapshot.md). Its input and revision checks take precedence over every mode's `gh`, fetch, and worktree-creation instructions. Use the snapshot for GitHub context and the matching checkout for surrounding code; then run the selected mode's checks. Return an incomplete-review report if required inputs cannot be verified.

## Directive for the Subagent:
Find the `mode` parameter in your prompt context, open the corresponding workflow file under the `references/` subdirectory by its relative path, and execute only that workflow's checks. Do not mix checks from different modes.

## Verification rounds

When the prompt names a `since` commit and lists prior findings, this is a verification round of a review loop. In any mode: review only the diff from `since` to the PR head, plus the code or records that diff touches and depends on; confirm each listed prior finding is resolved, and report any that isn't at its original severity; report new findings in the diff as usual. Don't re-review unchanged code, and don't re-file a prior finding the loop dismissed with a reason unless the new diff changes the grounds for dismissing it.

## Review completion

When the caller supplies an expected head, confirm the fetched metadata and local checkout match it before reviewing. In a review loop, return the reviewed head and any `since` SHA, whether required coverage is complete, findings or an explicit statement that there are none, and concrete verification limits. Missing required context produces an incomplete-review report. These completion and blocker fields take precedence over a workflow's restrictions on text outside finding sections; retain its format for the findings themselves.
