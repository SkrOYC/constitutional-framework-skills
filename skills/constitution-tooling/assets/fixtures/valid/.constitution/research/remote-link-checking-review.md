---
owner: interview
decision: OD-02
date: "2026-09-02"
question: Should the first phase check remote Link targets?
---

# Design review: remote link checking in the first phase

## Options

- **Local only.** Prior art: static-site link checkers default to local resolution and treat remote checks as a separate, rate-limited pass.
- **Local plus HTTP HEAD.** Prior art: crawler-style checkers, which carry retry and timeout policy the first phase would have to design.

## Recommendation

Local only for the first phase, because the failure modes of remote checks belong to a phase that has a network policy.

## Where the interviewer's view was shallow

It held. The recommendation matched, and the review adds the rate-limit precedent the record lacked.
