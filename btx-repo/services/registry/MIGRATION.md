# Portability Migration Report — registry

| Field | Value |
|---|---|
| Module | `services/registry` |
| Prompt | P-14 |
| Date | 2026-05-17 |
| Author | @sre-lead (agent) |
| Status | **Complete — no remediation required** |

---

## Summary

The `registry` service contains zero direct cloud SDK imports. It uses only the internal hexagonal `RegistryRepository` adapter backed by PostgreSQL. The registry is the simplest BTX service with minimal external dependencies.

---

## SDK Leakage Scan

```
Scan target: services/registry/src/**/*.ts
Cloud SDK patterns: @aws-sdk, @google-cloud, @azure, aws-sdk
```

| File | Import | Leakage? | Action |
|---|---|---|---|
| All `.ts` files | (none found) | ✅ Clean | None |

---

## Adapter Usage Map

| Concern | Interface | Adapter Files | Notes |
|---|---|---|---|
| PostgreSQL (trust_nodes) | `RegistryRepository` | `src/adapter/db/repository.ts` | Single adapter; node registration, lookup, list, heartbeat |
| KMS (future: node public key verification) | Not yet wired | `pkg/adapter/kms/` | Backlog: registry should verify node public_key_pem via KMS on registration |
| Object store | Not applicable | — | Registry stores no binary artefacts |

---

## Before / After Diagram

```
BEFORE (hypothetical):
┌──────────────────────────────┐
│  registry domain             │
│  pg.query("SELECT ...")      │  ← raw pg client in domain
└──────────────────────────────┘

AFTER (current state):
┌──────────────────────────────┐     ┌───────────────────────────────┐
│  registry domain             │     │  src/adapter/db/repository.ts │
│  registryRepo.register(node) │────▶│  RegistryRepository           │
│  registryRepo.lookup(id)     │────▶│   wraps pg Pool               │
└──────────────────────────────┘     └───────────────────────────────┘
         Domain has no DB driver knowledge
```

---

## Residual Items

| Item | Status | Owner | Target |
|---|---|---|---|
| Node public key verification via KMS on registration | Backlog | @security-lead | v0.2.0 |
| `api_version` field on trust_nodes (required by ADR-0024) | Backlog | @sre-lead | v0.2.0 |

---

## Conformance

- ADR-0002: ✅ Compliant (no cloud SDK in domain)
- ADR-0008: ✅ KMS adapter available when needed (not yet wired — acceptable for Phase 1)
- ADR-0023: ✅ Runs with stub/postgres only
