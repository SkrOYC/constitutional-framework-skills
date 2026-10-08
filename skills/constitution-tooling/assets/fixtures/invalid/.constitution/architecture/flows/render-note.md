---
job: JOB-01
capabilities: [CAP-001, CAP-002]
boundaries: [BND-01, BND-02]
view: sequence
certainty: assumed
assumption: No integration test walks this flow yet.
---
# Render a Note

```mermaid
sequenceDiagram
  Operator->>CLI: fix render note.md
  CLI->>Core: render(text)
  Core-->>CLI: Page | ParseError(line)
  CLI-->>Operator: exit 0 | stderr line, exit 1
```

## Failure path
A parse error reports the line and exits 1; nothing is written.
