---
name: {{ skill_name }}
description: "{{ skill_description }}"
metadata:
  family: "{{ metadata.family }}"
  role: "{{ metadata.role }}"
  artifact: "{{ metadata.artifact }}"
  upstream: "{{ metadata.upstream }}"
---

# Reviewing Pull Requests (Router)

This skill routes the subagent to the correct reference workflow based on the `mode` parameter passed in your prompt:

*   **mode: "standards"** -> Immediately load and follow [references/standards-review.md](references/standards-review.md).
*   **mode: "spec"** -> Immediately load and follow [references/spec-review.md](references/spec-review.md).
*   **mode: "full"** (or default) -> Immediately load and follow [references/full-review.md](references/full-review.md).

## Directive for the Subagent:
Find the `mode` parameter in your prompt context, open the corresponding workflow file under the `references/` subdirectory by its relative path, and execute only that workflow's checks. Do not mix checks from different modes.
