# Review from an offline snapshot

Use this contract when the caller supplies `snapshot: ABSOLUTE_DIRECTORY`, expected base/head SHAs, and a checkout. The producer collects hosted context; the reviewer uses the complete snapshot and matching checkout without `gh`, `curl`, fetching, or another worktree. A snapshot grants no host permissions.

## Producer: publish a complete candidate

Capture these files in an ignored scratch directory inside the worktree:

| File | Contents | Required |
| :--- | :--- | :--- |
| `pr.json` | Repository/PR identity, title, body, author, base/head names and SHAs, complete changed-file inventory, commits, comments, and reviews | Yes |
| `pr.diff` | Complete merge-base-to-head PR diff for the captured base/head | Yes |
| `commits.txt` | Commit log from the captured merge base to head | Yes |
| `issues.json` | Number, URL, title, body, state, and comments for every explicitly referenced issue; `[]` when none is referenced | Yes |
| `checks.json` | Captured `statusCheckRollup` | When available |
| `unavailable.txt` | Optional unavailable metadata and concrete fetch limits | When needed |
| `since.txt` | Exact prior reviewed SHA | Verification rounds |
| `since.diff` | Complete diff from `since.txt` to the captured head | Verification rounds |

Use `gh pr view <number> --json number,url,title,body,author,baseRefName,headRefName,baseRefOid,headRefOid,changedFiles,files,commits,comments,reviews,closingIssuesReferences` for core metadata. Obtain `pr.diff` with `gh pr diff <number>`. Compute the merge base from the captured base/head and collect `git log --format=fuller <merge-base>..<head>`.

Verify inventory and diff completeness against the captured local commits, including renames and deletions. If the hosted diff is truncated or unavailable, use `git diff <merge-base> <head>` and record that source in the existing capture/run record. Fetch missing objects before dispatch. A partial API response is not a complete snapshot even when its request succeeded.

Read explicit issue references and collect each with `gh issue view <number-or-url> --json number,url,title,body,state,comments`. Use issue URLs for references in another repository. Capture checks with `gh pr view <number> --json statusCheckRollup` when available. A required PR, diff, or issue fetch failure blocks publication; optional check metadata failure is disclosed in `unavailable.txt`.

Require `git rev-parse HEAD` in the supplied checkout to equal the captured head and tracked files to be clean. Re-read hosted base/head after collection. If either changed, build the changed candidate again; repeated movement that prevents a stable capture is a blocker. Record source identity, merge base, diff origin, and collection limits with the snapshot in the existing run artifact, deriving these values from commands rather than maintaining a parallel ledger.

Publish only after completeness and revision checks pass. Use a distinct immutable directory for each published capture, including metadata-only refreshes of the same base/head. Do not modify shared capture files while reviewers use them.

## Producer: reuse without stale context

Reuse immutable snapshot material through copies or references to content that remains immutable and readable for the review's lifetime. Do not link to a mutable shared file. The published candidate must resolve every required input; a repair-only diff does not replace the complete PR context.

Apply these invalidation rules:

- *Source changes:* A different head, base, or merge base invalidates the full diff, affected inventory, commit log, and integration assessment. Regenerate those derived views from Git. Reuse unchanged source objects and still-valid observations, not the previous candidate's full diff.
- *Verification scope:* A different `since` invalidates `since.txt` and `since.diff`. Keep the precise prior reviewed SHA; do not substitute the prior repair commit or a convenient ancestor.
- *Requirements and decisions:* Changed PR body, referenced issue set, issue content/comments, reviews, or accepted rulings invalidate the affected requirement and triage judgments. Refresh the changed material before review.
- *Checks and environment:* Changed check status, acceptance observations, relevant runtime configuration, or environment invalidates only the results and claims it affects. Do not present historical check status as a fresh pass.
- *Unknown freshness:* Reuse mutable hosted metadata only after a reliable source validator or content comparison confirms its relevant contents. If freshness cannot be established, fetch that material again or disclose a required-context blocker.

Refresh changed metadata and derived views in a new capture; retain unchanged immutable context. Reconfirm base/head and required-context completeness before publication. Do not recollect or rerun unaffected expensive evidence merely because a new reviewer starts.

## Consumer: confirm inputs and review

Confirm the caller's PR, base/head, and optional `since` match `pr.json` and `since.txt`. Require the supplied checkout's HEAD to match the head and tracked files to be clean. Check that the full diff and inventory cover the captured merge-base-to-head change. Missing required files, inaccessible referenced material, mismatched revisions, or incomplete inventory produces an incomplete-review report; do not substitute another checkout.

In an initial review, use `pr.diff`, the full changed-file inventory, and relevant surrounding code. In a verification round, focus on `since.diff`, each prior accepted repair, and affected dependencies and interactions. Keep complete PR and issue context available. Follow the router's rules for prior dismissals and for coverage invalidated by base or shared-assumption changes.

Use `issues.json` for requirements and `checks.json` as captured check signal. Optional metadata can be unavailable without blocking code review; disclose its limit. If the runtime lacks a tool needed for source-identity checks or required investigation, use an approved capable runtime or return incomplete coverage. Do not assume a review-only tool type can execute commands.

Inspect reusable verification records and run only feasible, read-only, missing or invalidated checks needed for the review. Do not change shared runtime state. Source-based proof can establish a defect even when a runtime check cannot run.

## Return the review

Return reviewed base/head and optional `since`, required coverage completed and gaps, findings or an explicit statement that there are none, and acceptance/verification limits. Name optional metadata that was unavailable. An empty response, wrong revision, access failure, or incomplete review is not clean. Review completeness does not establish acceptance or grant merge authorization.
