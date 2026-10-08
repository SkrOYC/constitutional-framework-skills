# Guidelines

## Verification

| Command | Purpose |
| :--- | :--- |
| `cargo test --workspace` | Unit and integration tests |
| `cargo xtask meter nfc-1` and `cargo bench -p skr-core` | Floor meters |

## Repository structure

```text
.
├── crates/          # Rust workspace members
└── Skrpkgs/         # sibling package repository checkout
```

## Coding standards

Use `thiserror` for library errors.
