# Architecture Documentation — Index

> The canonical map of all BTX architecture, requirements and decision documents. Start here.

## Authoritative documents (read in this order)

| # | Document | Purpose |
|---|---|---|
| 1 | [`../../../Bharat_Trust_Exchange_BTX_10_of_10_Review_BRD.docx`](../../../Bharat_Trust_Exchange_BTX_10_of_10_Review_BRD.docx) | Business Requirements Document v2.0 — the contract |
| 2 | [`../../../BTX_Architecture_Document.md`](../../../BTX_Architecture_Document.md) | Implementation architecture v2.0 |
| 3 | [`../../../BTX_Architecture_Annex_A_Engineering.md`](../../../BTX_Architecture_Annex_A_Engineering.md) | Engineering artefacts — sequence diagrams, ERD, OpenAPI, Rego, crypto profile |
| 4 | [`../../../BTX_Architecture_Annex_B_Runbooks.md`](../../../BTX_Architecture_Annex_B_Runbooks.md) | Operations & security runbooks |
| 5 | [`../../../BTX_Architecture_Annex_C_Evidence.md`](../../../BTX_Architecture_Annex_C_Evidence.md) | Quantification, evidence index, control mapping |

## Decision records

- [`../adr/`](../adr/) — Architecture Decision Records. ADR-001..017 cover federation, cloud-neutrality, policy-as-code, OPA, TUF bundles, SPIFFE, Kafka, etc.
- New decisions: use [`../adr/0000-template.md`](../adr/0000-template.md).

## Templates

| Template | Use when |
|---|---|
| [`../templates/tech-spec-template.md`](../templates/tech-spec-template.md) | Designing a new service or major feature |
| [`../templates/adr-template.md`](../templates/adr-template.md) | Recording a significant decision |
| [`../templates/rfc-template.md`](../templates/rfc-template.md) | Proposing a cross-team change |
| [`../templates/dpia-template.md`](../templates/dpia-template.md) | Personal-data flow review |
| [`../templates/threat-model-template.md`](../templates/threat-model-template.md) | STRIDE per service / surface |
| [`../templates/runbook-template.md`](../templates/runbook-template.md) | Operational procedure |

## Working agreements

- [`../../AGENTS.md`](../../AGENTS.md) — rules for AI agents
- [`../../CLAUDE.md`](../../CLAUDE.md) — Claude Code addendum
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — human contributor rules
- [`../../.github/CODEOWNERS`](../../.github/CODEOWNERS) — required reviewers

## Operational

- [`../test-strategy.md`](../test-strategy.md) — testing pyramid + conformance
- [`../security/secure-sdlc.md`](../security/secure-sdlc.md) — secure development lifecycle

## Quick-reference: where things live in the architecture

| Concept | Doc | Section |
|---|---|---|
| Federation principle | Arch Doc | §1, ADR-001 |
| Cloud adapters | Arch Doc | §12 |
| Trust Node internals | Arch Doc | §4 + Annex A §A.1 |
| PKI hierarchy | Arch Doc | §7 + Annex A §A.8 |
| PurposeGuard / Rego | Arch Doc | §8 + Annex A §A.6 |
| AuditLedger hash chain | Arch Doc | §9 + Annex A §A.7 |
| Signed config bundle | Arch Doc | §4.4 + Annex A §A.11 |
| API & integration | Arch Doc | §10 + Annex A §A.4, A.5 |
| HA / DR | Arch Doc | §14 + Annex B §B.9, B.10 |
| Conformance tests CT-001..025 | Arch Doc | §21 + Annex C §C.3, C.12 |
| DPDP rights flows | Annex C | §C.5 |
| Data residency | Annex C | §C.6 |
| Cost model | Annex C | §C.4 |
| Capacity formulas | Annex C | §C.1 |
| Chaos / GameDay | Annex B | §B.15 |
| Drill calendar | Annex B | §B.16 |

## How to keep this index current

- Any new top-level architecture doc → add a row to "Authoritative documents".
- Any new template under `docs/templates/` → add a row.
- Any new ADR → no action here; the ADR index in `docs/adr/README.md` updates separately.
- Any link rot → fix in the same PR.
