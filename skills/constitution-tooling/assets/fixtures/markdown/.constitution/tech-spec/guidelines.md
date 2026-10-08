# Guidelines

## Project structure

```
legacy/
├── src/                    # source
│   └── cli/                # command surface
└── tests/                  # behavior tests
```

## Coding standards

Conventional Commits.

## Verification hooks

| Command | Verifies |
| :--- | :--- |
| `bun run test` | Behavior |
| `bun run lint` | Lint |
