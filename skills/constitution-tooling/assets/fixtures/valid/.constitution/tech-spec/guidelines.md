---
verification_commands:
  - { name: test, command: bun run test, exists: true }
  - { name: lint, command: bun run lint, exists: true }
  - { name: typecheck, command: bun run typecheck, exists: true }
  - { name: other, label: generated-bindings, command: ./scripts/check-generated.sh, exists: true }
  - { name: bench, command: bun run bench, exists: false, owner: FIX-C002 }
layout:
  - { path: src/cli, purpose: Command surface (BND-01) }
  - { path: src/core, purpose: Core library (BND-02) }
  - { path: tests, purpose: Behavior tests }
  - { path: scripts, purpose: Repository gates }
  - { path: docs, purpose: Published contracts and schemas that tech-spec sidecars point at }
live_verification:
  - name: cli-check
    surface: cli
    launch: bun run build
    doctor: ./scripts/doctor.sh
    drive: ./scripts/drive-check.sh tests/notes/broken.md
    drive_kind: command
    evidence: { kind: log_line, ref: "missing: " }
    cleanup: ./scripts/clean.sh
    exists: false
    owner: FIX-C001
commit_convention: Conventional Commits
---
# Guidelines

## Coding standards
Biome for format and lint. Tests assert behavior through the public functions in `src/core`.
