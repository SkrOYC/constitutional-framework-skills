# Epic A — tooling

#### LEG-A001 Wire the test runner
- **Type:** Chore
- **Effort:** 2
- **Dependencies:** None
- **Scope (In-Scope Files):**
  - `package.json`
- **Verification Command:** `bun run test`
- **Expected Success Output:** `exit 0`
- **Description:** Wire bun test.
- **Acceptance:**
  - **Mode:** contract_test
  - **Evidence:**

```text
bun run test exits 0.
```
