# Constraints

## Binary compliance constraints

- **Con-001—Hermetic builds:** The Sandbox must block all network access. *Meter: continuous integration tests that attempt network access must fail.*

## Scalar constraints

- **Con-004—Frame budget. [spike-gated]** Scale: milliseconds per frame. Meter: bench. Goal: ≤ 1 ms. Fail: > 4 ms. *No public benchmark validates the 1 ms figure.*

- **Con-005—No-op evaluation latency**
  - **Scale:** Wall-clock seconds to evaluate a System State delta with nothing to download.
  - **Meter:** Automated benchmark on the reference machine profile, run in CI per release.
  - **Goal:** ≤ 3 seconds.
  - **Stretch:** ≤ 1 second.
  - **Fail:** > 5 seconds.

## Operating scale

### Tenant scale

- **Scale:** Active customer accounts.
- **Meter:** Count of production Tenants.
- **Goal:** 1–20 Tenants in the focused envelope.
- **Fail:** The product requires mass-market assumptions to operate safely.

## Performance

- **Search Latency**
  - **Scale:** Milliseconds from query submission to first result.
  - **Meter:** Benchmark over the reference workspace.
  - **Goal:** ≤ 100 ms.
  - **Fail:** > 400 ms.
