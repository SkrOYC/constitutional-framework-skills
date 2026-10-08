# Epic C: Seed and direct-image admission

## Vertical outcome

A finalized seed is admitted into an empty Store.

## In-scope roots

- `crates/skr-store/`
- `Skrpkgs/bootstrap/seed.toml`

## Tickets

#### SKA-C001 Admit the seed manifest
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** none
- **Scope (In-Scope Files):**
  - `crates/skr-store/`
  - `Skrpkgs/bootstrap/seed.toml`
- **Scope (Out-of-Scope Files):**
  - `Skrpkgs/` (no package edits)
  - All production crates — a Spike changes no production code
- **Verification Command:** `cargo test --workspace`
- **STOP Conditions:**
  - "STOP if the seed manifest schema is missing; don't improvise."
- **Description:** Read the seed manifest and admit every entry into the Store.
- **Acceptance Criteria:**
  ```gherkin
  Given an empty Store
  When the seed manifest is admitted
  Then every entry is present
  ```

#### STORE-C002 Verify admitted entries
- **Type:** Feature
- **Effort:** 2
- **Dependencies:** SKA-C001
- **Scope (In-Scope Files):**
  - `crates/skr-store/`
- **Verification Command:** `cargo test --workspace`
- **STOP Conditions:**
  - "STOP if verification needs network access; don't improvise."
- **Description:** Verify every admitted entry against the seed digest.
- **Acceptance Criteria:**
  ```gherkin
  Given an admitted seed
  When verification runs
  Then every digest matches
  ```
