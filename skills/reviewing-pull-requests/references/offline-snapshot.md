# Review from an offline snapshot

Read this reference when the caller supplies `snapshot: ABSOLUTE_DIRECTORY` and `head: HEAD_SHA`. These inputs replace the workflow's GitHub fetch steps in every mode. Read the snapshot files and the matching local checkout instead of running `gh`, `curl`, `git fetch`, or creating another worktree. Keep the selected mode's review checks and finding format.

## Required inputs

The snapshot contains these files:

| File | Contents | Required |
| :--- | :--- | :--- |
| `pr.json` | PR number, title, body, author, base and head branch names and SHAs, changed files, commits, comments, and reviews | Yes |
| `pr.diff` | Full PR diff captured at the SHAs in `pr.json` | Yes |
| `commits.txt` | Local commit log from the PR merge base to its head | Yes |
| `issues.json` | Number, URL, title, body, state, and comments of every issue explicitly referenced by the PR; `[]` when none is referenced | Yes |
| `checks.json` | `statusCheckRollup` from GitHub | When available |
| `unavailable.txt` | Failed optional fetches and their reasons | When optional metadata is unavailable |
| `since.txt` | Exact prior reviewed SHA | Verification rounds |
| `since.diff` | Diff from `since.txt` to the head in `pr.json` | Verification rounds |

Before reading the code, confirm the PR number and `headRefOid` in `pr.json` match the caller's PR and `head`. Require `git rev-parse HEAD` in the supplied checkout to match that head too. Tracked files must be clean; the ignored snapshot directory is not a product change. If a required file is missing, the checkout differs, an issue could not be fetched, or `since.txt` differs from the caller's `since`, return an incomplete-review report with the blocker. Do not substitute a nearby checkout or review a partial snapshot as if it were complete.

In round one, use `pr.diff` and the changed-file inventory. In a verification round, use `since.diff` and its affected code or records; retain the full PR metadata for context. Confirm the listed prior findings are resolved and follow the router's rules for dismissed findings. Use `issues.json` for issue requirements and `checks.json` for CI signal. Missing optional CI metadata does not prevent a review; disclose it.

Run feasible read-only verification in the matching checkout. If a check requires writes or unavailable services, record the concrete limitation. Existing permissions still govern execution; a snapshot does not grant write access.

## Return a completed review

Name the reviewed head SHA and, for a verification round, the `since` SHA. State whether the required review coverage is complete, then return findings or an explicit statement that there are no findings. List skipped checks and unavailable optional metadata. An access error, empty response, mismatched revision, or incomplete review is not a clean review.
