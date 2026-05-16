---
id: P-09
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@privacy-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SUBJECT, type: kebab-case, required: true }
  - { name: DATA_CLASS, type: enum, required: true }
  - { name: PII_FIELDS, type: list, required: false }
  - { name: CALLERS, type: list, required: true }
  - { name: BACKENDS, type: list, required: true }
  - { name: CROSS_BORDER, type: bool, required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[security/privacy] threat-model + dpia <SUBJECT>" }
  - { kind: files_created, glob: "threat-models/<SUBJECT>.md" }
  - { kind: files_created, glob: "dpia/<SUBJECT>.md", when: "PII_FIELDS non-empty" }
context_budget:
  read_in_full: ["docs/templates/threat-model-template.md", "docs/templates/dpia-template.md", "BTX_Architecture_Annex_A_Engineering.md"]
  skim: ["BTX_Architecture_Annex_C_Evidence.md"]
executable_acceptance:
  - { name: template-conformance, cmd: "tools/tm-dpia-validate threat-models/<SUBJECT>.md dpia/<SUBJECT>.md", pass_when: "all required sections present" }
  - { name: ct-dpia, cmd: "make certify CT=CT-018", pass_when: "exit 0" }
  - { name: stride-coverage, cmd: "tools/stride-coverage threat-models/<SUBJECT>.md", pass_when: "all applicable T01..T15 addressed" }
halt_conditions:
  - "any residual risk = High without tracked mitigation"
  - "PII present but no consent flow or lawful basis cited"
  - "notice text missing for EN + HI"
escalation: { to: "@privacy-lead, @security-lead", channel: "#btx-privacy" }
graph: { upstream: [], downstream: [P-01, P-02, P-03, P-04, P-05] }
---

# P-09 — Threat model & DPIA for a new service / dataset

> Use before building anything that touches personal data or introduces a new external surface. Produces approved artefacts that gate production (CT-018).

---

You are Claude Code preparing the privacy/security artefacts required by BTX governance. These artefacts are pre-conditions for code, not afterthoughts.

## 0. Read first

- BRD §14 (Security), §24 (DPIA), §31 (Standards)
- Architecture Doc §6 (Security), §8 (Policy), §9 (Audit)
- Annex A §A.12 (STRIDE catalogue T01..T15), §A.6 (policy obligations)
- Annex C §C.9 (FMEA), §C.11 (standards mapping)
- Templates: `docs/templates/threat-model-template.md`, `docs/templates/dpia-template.md`
- DPDP Act 2023; NIST SP 800-207; OWASP API Top 10 2023; LINDDUN (privacy)

## 1. Inputs

| Input | Value |
|---|---|
| Subject | service / dataset / flow |
| Owner | data steward / service owner |
| Data class | open / operational / citizen_portable / restricted / non_shareable |
| Personal data fields | list with sensitivity |
| Callers / consumers | members, purposes |
| Backend systems | source systems touched |
| Cross-border? | data residency posture |

## 2. Execute

1. **Threat model** create `threat-models/<<SUBJECT>>.md` using the template:
   - DFD (mermaid) with trust boundaries numbered
   - Asset list with sensitivity
   - STRIDE table (incl. LINDDUN if personal data) using T01..T15 IDs where applicable
   - Mitigations linked to controls and CT-IDs
   - Residual risk and sign-off rows
2. **DPIA** (only if personal data) create `dpia/<<SUBJECT>>.md` using the template:
   - Purpose code(s) and plain-language purpose (EN + HI + state language)
   - Lawful basis / consent mechanism / notice text
   - Data elements table with "necessary" justification
   - Minimisation rule (which response shape)
   - Retention table
   - Citizen rights and grievance route
   - Risk table with vulnerable groups (children, etc.)
   - Approvals row for each required role
3. **Policy delta** if the design changes PDP decisions/obligations, draft the Rego change as a separate PR (P-04) referenced from the threat model.
4. **Conformance** confirm which CTs assert the mitigations; if missing, propose a new CT via P-08.
5. **Cross-ref** update `services/<<SUBJECT>>/README.md` to link both artefacts.

## 3. Hard rules

- Do not approve your own artefact. Both privacy and security leads must sign.
- Do not list "high" residual risks without a tracked mitigation plan.
- Do not paste real data into the artefact; reference sample shapes only.
- If consent is the lawful basis, design the revocation flow explicitly.

## 4. Acceptance

- [ ] Threat model complete; STRIDE table covers T01..T15 applicability.
- [ ] DPIA complete (if personal data); all 13 sections present.
- [ ] Notice text in EN + HI (+ state language as required).
- [ ] Minimisation rule decided; mapped to a PDP obligation.
- [ ] Retention table consistent with Annex C §C.1.6.
- [ ] Citizen visibility / grievance / correction / erasure described.
- [ ] CT-018 (DPIA gate) green.
- [ ] All required approvals signed.
- [ ] Linked from the service tech spec.

## 5. Worked example

See [`_examples/p09.md`](./_examples/p09.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
