# DPIA — `<service or data flow>`

> Data Protection Impact Assessment. Required for any service or version whose response includes personal data or whose request carries citizen context. Aligned with BRD §24 and DPDP Act 2023.

| Field | Value |
|---|---|
| Subject | service / dataset / flow name |
| Version | x.y |
| Owner (provider data steward) | @… |
| Privacy reviewer | @privacy-lead |
| Security reviewer | @security-lead |
| Legal reviewer | @… |
| Status | draft \| in-review \| approved \| superseded |
| Date approved | |
| Review-by date | |

## 1. Service / dataset name

Name, owner, service ID, provider member, requester members, environment.

## 2. Data class

`open` | `operational` | `citizen_portable` | `restricted` | `non_shareable`

## 3. Purpose

- Purpose code: `…`
- Plain-language purpose text (Hindi / English / state language):
  - EN: …
  - HI: …
- Policy owner: @…

## 4. Lawful basis / consent / notice

- Lawful basis reference (statute, rule, scheme):
- Consent required? yes/no — if yes, mechanism and revocation flow
- Notice text shown to citizen (link / inline)
- Exception path (if any) and legal authority

## 5. Data elements

| Field | Sensitivity | Source of truth | Necessary? | Justification |
|---|---|---|---|---|
| | | | | |

## 6. Minimisation

Response shape: `full` | `masked` | `yes_no_assertion` | `signed_claim` | `selective_disclosure`

If masked, list masked fields. If yes/no, list assertion semantics.

## 7. Retention

| Where | Period | Trigger to delete |
|---|---|---|
| Requester cache | | |
| Audit (BTX) | | |
| Source system | | |

## 8. Citizen visibility & rights

- Sharing history surface: yes / no
- Notification mechanism
- Grievance route + SLA
- Correction route
- Erasure semantics

## 9. Risk assessment

| Risk | Likelihood | Impact | Vulnerable groups affected |
|---|---|---|---|
| | | | |

Children / vulnerable groups specific considerations: …

## 10. Mitigations

| Risk | Technical control | Policy control | Operational control |
|---|---|---|---|
| | | | |

## 11. Approvals

| Role | Name | Decision | Date | Signature |
|---|---|---|---|---|
| Data steward | | | | |
| Privacy reviewer | | | | |
| Security reviewer | | | | |
| Legal reviewer | | | | |
| Provider department | | | | |
| Requester department | | | | |

## 12. Evidence

- Threat model: `threat-models/<service>.md`
- Tests: CT-013 (minimisation), CT-017 (BOLA), CT-018 (DPIA gate)
- Notice text artefacts:
- Citizen portal screenshot:

## 13. Review history

| Date | Reviewer | Outcome |
|---|---|---|
| | | |
