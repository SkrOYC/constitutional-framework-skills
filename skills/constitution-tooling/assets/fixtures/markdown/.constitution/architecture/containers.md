# Logical boundaries

## Command surface

- **Boundary number:** 1.
- **Boundary kind:** in-process module.
- **Logical type:** CLI entry.
- **Responsibility:** Parse arguments and call the core.
- **Inputs and outputs:** In: argv. Out: exit code.
- **Depends on:** Core.

## Core

- **Boundary number:** 2.
- **Boundary kind:** in-process module (pure library).
- **Logical type:** library surface.
- **Responsibility:** Render Notes and check Links.
- **Inputs and outputs:** In: Note text. Out: Page text.
- **Depends on:** nothing.
