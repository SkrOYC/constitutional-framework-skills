# Epic B — render

#### LEG-B001 Choose the renderer
- **Type:** Spike
- **Effort:** 2
- **Dependencies:** LEG-A001
- **Scope (In-Scope Files):**
  - `.constitution/spikes/`
- **Verification Command:** `bun run test`
- **Expected Success Output:** `exit 0`
- **Description:** Compare renderers for E1.1.
- **Acceptance:**
  - **Mode:** benchmark
  - **Evidence:**

```text
Median under 80 ms.
```

#### LEG-B002 Render command
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** LEG-B001
- **Scope (In-Scope Files):**
  - `src/cli/render.ts`
  - `src/core/render.ts` (new)
- **Scope (Out-of-Scope Files):**
  - `src/core/links.ts` (don't touch)
- **Verification Command:** `bun run test`
- **Expected Success Output:** `exit 0`
- **STOP Conditions:**
  - "STOP if the contract lacks an exit code."
- **Description:** Implements E1.1 and E1.2.
- **Acceptance:**
  - **Mode:** gherkin
  - **Evidence:**

```text
Given a Note
When the Operator runs fix render
Then a Page is written
```

##### [LEG-B002] Deviations & Justifications
- **Touched Files:** `src/core/errors.ts`
- **Justification:** Error type needed by both commands.
