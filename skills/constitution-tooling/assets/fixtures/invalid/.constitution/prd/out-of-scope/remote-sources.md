---
decision: deferred
date: "2026-09-01"
ruling: reports/2026-09-01-interview-prd.md
revisit_when: An Operator asks for a URL as a Note source.
---
# Remote sources

## Context
Rendering Notes fetched from URLs was considered.

## Reason
It introduces network failure modes and a security class the first phase should not carry.

## Consequences
No downstream stage may add a fetch step without an Evolution pass.
