# Stack

## Forward reconciliation status

| Decision area | Delivered baseline | Candidates to measure | Adoption state |
| :--- | :--- | :--- | :--- |
| Canonical AST | `pulldown-cmark =0.12.2` events | `markdown` 1.0.0 mdast | Spike |

## Bill of materials

### Toolchain

| Component | Choice | Pin | Ring | Reason |
| :--- | :--- | :--- | :--- | :--- |
| Language | Rust stable | 1.98.0 in `rust-toolchain.toml` | Adopt | Memory safety for privileged code. |

### Crates

| Component | Crate or tool | Pin | Ring | Reason |
| :--- | :--- | :--- | :--- | :--- |
| CLI parsing | `clap` | 4.6 | Adopt | Command-line parsing with derive macros. |
| Async runtime | `tokio` | 1.53 | Adopt | Required by the daemon transport. |

## Starlark dialect

The evaluator runs a nonrecursive dialect: no `while`, no recursion, no set literals.

## Compatibility

Every crate is pinned to a minor version in `Cargo.toml`; upgrades that cross a major need an ADR.
