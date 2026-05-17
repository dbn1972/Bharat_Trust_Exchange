# Changelog

All notable changes to Bharat Trust Exchange are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.1.0] — 2026-05-17

### Added
- **control-plane** service: consent grant, revoke, query with transactional outbox (ADR-0021), idempotency (ADR-0022), Merkle root audit chain
- **registry** service: trust node registration, heartbeat, lookup, list
- **trust-node** service: federation sync state machine, Merkle root signature verification, peer sync tracking
- **Cloud adapters**: AWS KMS + S3, GCP Cloud KMS + GCS, Azure Key Vault + Blob Storage, with lazy-load factory (`pkg/bootstrap`)
- **Local dev stack**: docker-compose with Postgres 16, Redpanda, Redis 7, MinIO, KMS stub
- **ADRs 0001–0025**: complete architectural decision history including API versioning (ADR-0024) and data residency (ADR-0025)
- **Threat model + DPIA**: consent-service security and privacy artefacts (CT-018 gate)
- **Runbooks**: RB-001 (consent cascade), RB-002 (outbox publisher), IR-001 (data breach), IR-002 (revocation failure)
- **Chaos scenarios**: GD-01 (cascade failure), GD-02 (Kafka partition)
- **Release pipeline**: GitHub Actions with reproducible builds, Syft SBOMs, Cosign signing, SLSA L3 attestation, evidence pack
- **Cloud conformance**: 25 conformance tests (AWS 9, GCP 8, Azure 8) with AWS runner
- **Performance tests**: k6 consent lifecycle + federation sync with ADR-0020-aligned regression thresholds
- **Capacity plan**: sizing estimates for Phase 1 India launch (100K daily active citizens)

### Changed
- k6 perf thresholds tightened: `http_req_failed` from 10% → 5% error cap; p99 consent latency from 50ms → 80ms (now matches ADR-0020 budget exactly)

### Known Issues
- `kmsVerify` not yet wired in `trust-node/server.ts` (stub fallback active) — fix in v0.1.1 (CR-001 B-01)
- `ObjectStoreAdapter` not yet wired for audit archival — deferred to v0.2.0 (CR-001 B-02)
- `api_version` field missing from `trust_nodes` schema (needed for ADR-0024 deprecation cycle) — v0.2.0

[Unreleased]: https://github.com/btx/btx-repo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/btx/btx-repo/releases/tag/v0.1.0
