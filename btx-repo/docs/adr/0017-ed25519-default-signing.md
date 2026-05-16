# 0017 — Ed25519 default for signing; ECDSA-P256 fallback

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security
- **Tags:** cryptography, security

## Context

Request/response signing, audit anchors and bundle signing all need a default signing algorithm. The choice affects performance, library availability and HSM/KMS support.

## Decision

- Default: **Ed25519** (EdDSA) for request/response and audit anchor signatures where libraries and HSM/KMS support exist.
- Fallback: **ECDSA P-256** (`ES256`) where Ed25519 is unavailable.
- All keys carry an algorithm identifier (`kid` includes alg-suite) to allow agile migration.
- TLS continues with ECDSA P-256 or RSA-3072 per Annex A §A.8.1.
- PQC migration path documented in Annex A §A.10.

## Consequences

**Positive**
- Ed25519 is fast and small; well-suited to high-RPS signing.
- Algorithm agility built-in for PQC migration.

**Negative / trade-offs**
- Some HSMs/KMSes lag in Ed25519 support; fallback covers this.
- Operational discipline for `kid`/alg metadata propagation.

## Alternatives considered

| Option | Why not |
|---|---|
| RSA-2048 | Slower, larger signatures |
| ECDSA P-384 | Marginal benefit over P-256; less ubiquitous |
| BBS+ | Reserved for selective disclosure (VCs); not a general signing default |

## References

- Arch Doc §6.4
- Annex A §A.8, §A.10
