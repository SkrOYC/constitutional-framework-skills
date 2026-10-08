---
job: JOB-02
capabilities: [CAP-003]
boundaries: [BND-01, BND-02]
view: sequence
certainty: assumed
assumption: Link resolution rules are not yet exercised in code.
---
# Check Links

```mermaid
sequenceDiagram
  Operator->>CLI: fix check note.md
  CLI->>Core: checkLinks(text)
  Core-->>CLI: Link report
```

## Failure path
Unreadable target directories are reported as missing Links, not as crashes.
