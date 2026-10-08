# Vision

## Executive summary

SkrAlt is a tiny declarative operating system used to exercise the field-list document format.

## Archetype

- **Primary:** System/Native—the product is an operating system with sandboxed native builds.
- **Secondary:**
  - CLI/Tooling—separate command-line clients for package work and operating system management.
  - Web/Cloud—project-operated hosted services with availability obligations.
- **Confidence:** high
- **Rationale:** The shipped surfaces are a bootable distribution, two command-line clients, and hosted services.

## Jobs to be done (JTBD)

- **Provision reproducible environments:** Let developers declare isolated project dependencies that evaluate identically on any machine.
- **Manage the operating system declaratively:** Let operators apply, roll back, and inspect system state from one configuration.
