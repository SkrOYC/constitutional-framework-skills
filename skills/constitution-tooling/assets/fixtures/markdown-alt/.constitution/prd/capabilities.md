# Capabilities

## Epic: Product command-line surfaces

- **Priority:** P0
- **Capability ID:** SURF-01
- **Capability:** From the first release, the product shall provide separate `skr` and `skros` command-line surfaces.
- **Rationale:** A distinct product boundary prevents package work from coupling to operating system management (JTBD 1).

- **Priority:** P1
- **Capability ID:** SURF-02
- **Capability:** When a command fails, the surface shall print a machine-readable error code.
- **Rationale:** Scripts need stable failure signals (JTBD 2).

## Tenant and access

| Capability ID | Priority | Capability | Rationale |
| :--- | :--- | :--- | :--- |
| CAP-ACCESS-001 | P0 | The system must isolate every Tenant's data from every other Tenant. | Tenant separation is the primary trust boundary (JTBD 1). |

## Epic: Organization governance

### CAP-GOV-001: Organization data isolation

- **Priority:** P0
- **Capability:** Isolate every Organization's users and information from every other Organization.
- **Rationale:** The managed service requires strong data isolation (JTBD 2).
