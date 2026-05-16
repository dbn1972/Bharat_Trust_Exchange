# 0006 — API Setu / DigiLocker as complementary rails

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Product
- **Tags:** integration

## Context

API Setu provides API publication, discovery and subscription for government APIs. DigiLocker (and the wider wallet/VC ecosystem) provides citizen-held verifiable records. Duplicating either would fragment the public stack.

## Decision

BTX complements rather than replaces existing rails:

- BTX Catalogue synchronises service entries with API Setu for discovery.
- Citizen-portable flows route through DigiLocker / wallet via Trust Node with citizen-directed consent.
- BTX adds what these rails do not: federated trust identity, policy decisions, minimisation, tamper-evident audit and cross-member governance.

## Consequences

**Positive**
- Reuses public investment; preserves "lane discipline" (BRD §6).
- Avoids parallel competing registries.

**Negative / trade-offs**
- Coupling with two external roadmaps; mitigated by adapter pattern and version pinning.
- Some duplication in metadata; mitigated by clear ownership rules in SchemaHub.

**Operational impact**
- Connectors and adapters for API Setu and DigiLocker maintained in `connectors/`.

## Alternatives considered

| Option | Why not |
|---|---|
| Replace API Setu | Wasteful; politically unviable; not BTX's job |
| Ignore both | Fragmentation; poor citizen experience |

## References

- BRD §22 (ADR-006), §15
- Arch Doc §10.2
