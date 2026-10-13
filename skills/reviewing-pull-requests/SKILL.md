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

## Directive for the Subagent:
Find the `mode` parameter in your prompt context, open the corresponding workflow file under the `references/` subdirectory by its relative path, and execute only that workflow's checks. Do not mix checks from different modes.

## Verification rounds

When the prompt names a `since` commit and lists prior findings, this is a verification round of a review loop. In any mode: review only the diff from `since` to the PR head, plus the code or records that diff touches and depends on; confirm each listed prior finding is resolved, and report any that isn't at its original severity; report new findings in the diff as usual. Don't re-review unchanged code, and don't re-file a prior finding the loop dismissed with a reason unless the new diff changes the grounds for dismissing it.
