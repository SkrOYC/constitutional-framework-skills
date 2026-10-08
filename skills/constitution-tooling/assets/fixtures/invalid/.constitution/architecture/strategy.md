# Strategy

**Pattern:** a thin command module over a pure core library. **Why it fits:** the CLI/Tooling archetype and NFC-01 reward a small process with no runtime services. **Trade-offs accepted:** no daemon, so watch mode is out of scope. ADR-0042 records the plugin model, and OD-77 decides its loader.
