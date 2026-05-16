# Test Strategy

> The testing pyramid, what each layer guarantees, and how the BTX conformance suite (CT-001..025) sits on top.

## Goals

- Catch regressions early (unit), often (integration), and authoritatively (conformance).
- Make every architecture invariant testable.
- Treat policy, audit and crypto paths as the highest-risk surfaces.
- Reproducible runs (hermetic, deterministic, parallelisable).

## Pyramid

```
                         ▲
                         │   Conformance (CT-001..025)        ←  releases / per-cloud
                         │   Performance & chaos              ←  weekly / per-release
                         │   E2E (synthetic citizen journeys) ←  per-release
                         │   Contract (OpenAPI / AsyncAPI)    ←  every PR
                         │   Integration (testcontainers)     ←  every PR
                         │   Property / fuzz (where applicable)
                         │   Unit + policy tests              ←  every commit
                         ▼
```

## Layer definitions

### Unit
- Pure functions, no IO. Mocks only at external boundaries.
- Coverage target ≥ 80% statements; ≥ 90% on policy-decision, crypto-signing and audit-emit code.
- Go: `go test ./... -race -cover` ; Java: JUnit 5 + AssertJ ; TS: Vitest.

### Policy (Rego)
- `opa test` for every PR touching `policy/`.
- Coverage ≥ 80% rules.
- Required fixtures in `policy/btx/testdata/`.
- Negative tests for every violation; obligation tests for every obligation.

### Contract
- OpenAPI: `spectral lint` + breaking-change diff (`oasdiff`).
- AsyncAPI: `asyncapi validate` + schema diff.
- Contracts in repo are the source of truth — generated docs in developer portal regenerate from them.

### Integration
- Hermetic with `testcontainers` (Postgres, Kafka, Redis, Vault, OPA, SPIRE).
- One test per request/response path; verify metrics, traces, audit events.

### End-to-end (E2E)
- Synthetic citizen / requester / provider scenarios in `tests/e2e/`.
- Run in sandbox cluster on every merge to `main`.
- No real PII; only synthetic fixtures.

### Performance
- k6 scripts in `tests/perf/`. Run weekly + before release.
- Targets per Annex C §C.1 & Arch Doc §13.4.
- Regression budget: ±10% on p95 latency; ±5% on throughput.

### Chaos / GameDay
- `tests/chaos/` scenarios mapped to Annex B §B.15 (GD-01..15).
- Run in staging on the quarterly drill calendar (Annex B §B.16).
- Each scenario produces a signed evidence report.

### Conformance
- `certify/` runs CT-001..025.
- Triggered: per release, per certified cloud, per environment promotion.
- Output: signed evidence pack (Annex C §C.12).

## Test data

- Only synthetic fixtures (`tests/fixtures/`) in non-prod. Never real PII.
- A masked / tokenised sample may be used in staging only with privacy lead approval.
- Generators in `tests/fixtures/gen/` produce consistent IDs and signatures.

## Determinism

- Inject a `Clock`; never call `time.Now()` directly in domain code.
- Inject randomness; seed in tests.
- Pin container images by digest in test environments.

## Flakes

- Quarantine policy: 2 flakes in 7 days → quarantine + open ticket; fix within 5 business days or remove the test.
- No `t.Skip` in `main` without an issue link and expiry.

## CI gating

| Gate | Blocking? |
|---|---|
| Lint | Yes |
| Unit | Yes |
| Policy tests | Yes |
| Contract tests | Yes |
| Integration | Yes |
| E2E (sandbox) | Yes for `main` merges |
| Performance regression | Yes on release branches |
| Security (SAST, deps, SBOM, image) | Yes |
| Conformance | Yes for release tags |

## Reporting

- JUnit XML for all suites
- Coverage uploaded per service
- Evidence packs signed and archived per release

## Ownership

| Layer | Owner |
|---|---|
| Unit / Integration | Service team |
| Policy | @security-lead + @privacy-lead |
| Contract | Service team + @platform-lead |
| E2E | @qa-lead |
| Performance | @platform-lead |
| Chaos | @platform-lead + @security-lead |
| Conformance | @qa-lead |
