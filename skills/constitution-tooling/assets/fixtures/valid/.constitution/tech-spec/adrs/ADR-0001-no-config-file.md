---
id: ADR-0001
status: accepted
date: "2026-09-01"
certainty: settled
evidence: { kind: ruling, ref: reports/2026-09-01-interview-techspec.md, date: "2026-09-01" }
---
# ADR-0001 No configuration file

## Context
Static site generators fail the Operator's friction test.

## Decision
All behavior is flags; no configuration file is read.

## Consequences
Per-project defaults are impossible; revisit if Operators ask twice.
