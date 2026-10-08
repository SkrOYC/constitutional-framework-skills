---
verification_commands:
  - { name: test, command: bun run test, exists: true }
  - { name: lint, command: bun run lint, exists: true }
  - { name: typecheck, command: bun run typecheck, exists: true }
  - { name: other, label: generated-bindings, command: ./scripts/check-generated.sh, exists: true }
  - { name: bench, command: bun run bench, exists: false, owner: FIX-C002 }
  - { name: docs, command: ./scripts/docs.sh, exists: true }
live_verification:
  - { name: cli-check, launch: bun run test, doctor: ./scripts/check-generated.sh, drive: open the terminal, drive_kind: manual, evidence: { kind: screenshot, ref: terminal }, exists: true }
  - { name: cli-check, launch: bun run test, doctor: ./scripts/doctor-missing.sh, drive: ./scripts/check-generated.sh, drive_kind: command, evidence: { kind: log_line, ref: ok }, exists: true }
layout:
  - { path: src/cli, purpose: Command surface (BND-01) }
  - { path: src/core, purpose: Core library (BND-02) }
  - { path: tests, purpose: Behavior tests }
  - { path: scripts, purpose: Repository gates }
commit_convention: Conventional Commits
---
# Guidelines

## Coding standards
Biome for format and lint. Tests assert behavior through the public functions in `src/core`.
