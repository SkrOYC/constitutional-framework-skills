# Epic B1: Kernel

## Vertical outcome

A finalized seed is admitted into an empty Store.

## In-scope roots

- `crates/skr-store/`
- `Skrpkgs/bootstrap/seed.toml`

## Tickets

#### SKA-B1001 Admit the seed manifest
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** none
- **Scope (In-Scope Files):**
  - `crates/skr-store/`
  - `Skrpkgs/bootstrap/seed.toml`
- **Scope (Out-of-Scope Files):**
  - `Skrpkgs/` (no package edits)
- **Verification Command:** `cargo test --workspace`
- **STOP Conditions:**
  - "STOP if the seed manifest schema is missing; don't improvise."
- **Description:** Read the seed manifest and admit every entry into the Store.
- **Acceptance Criteria:**
  ```text
  Given an empty Store
  When the seed manifest is admitted
  Then every entry is present
  ```
