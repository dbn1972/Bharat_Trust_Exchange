# 0007 — Provider-side minimisation

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Privacy
- **Tags:** privacy, security

## Context

Consumers naturally request whole records ("send me everything"). DPDP and good practice require purpose-bound minimisation. Relying on consumer self-restraint is unsafe.

## Decision

The **provider** Trust Node enforces minimisation. The Response Shaper applies obligations from PurposeGuard: `full` (rare), `masked`, `yes_no_assertion`, `signed_claim` or `selective_disclosure`. The provider cannot delegate this responsibility to the consumer.

## Consequences

**Positive**
- Over-sharing (T05) structurally prevented.
- Same source service can serve many purposes safely.

**Negative / trade-offs**
- Shaping cost on provider TN (~10 ms budget).
- Selective disclosure requires VC ecosystem maturity (BBS+, SD-JWT) — staged.

**Operational impact**
- CT-013 minimisation tests mandatory.

## Alternatives considered

| Option | Why not |
|---|---|
| Consumer-declared minimisation | Honour-system; defeats purpose |
| Post-hoc audit only | Damage already done |
| Single response shape | Loses purpose specificity |

## References

- BRD §22 (ADR-007), FR-021..025
- Arch Doc §4.2
- Annex A §A.9 (VC), §A.8.2 (signing)
