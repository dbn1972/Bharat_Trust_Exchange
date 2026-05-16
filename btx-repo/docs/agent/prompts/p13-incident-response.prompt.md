---
id: P-13
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@incident-commander"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: INC_ID, type: "pattern[INC-\\d+]", required: true }
  - { name: SEVERITY, type: "enum[SEV-1|SEV-2|SEV-3]", required: true }
  - { name: TRIGGER, type: text, required: true }
  - { name: SURFACES, type: list, required: true }
  - { name: IC, type: handle, required: true }
forbidden_paths: ["audit/**", "evidence/**"]   # destructive ops on these prohibited
expected_outputs:
  - { kind: timeline, file: "incidents/<INC_ID>/timeline.md" }
  - { kind: pir, file: "incidents/<INC_ID>/pir.md" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_B_Runbooks.md", "docs/security/secure-sdlc.md"]
executable_acceptance:
  - { name: containment-sla, cmd: "tools/inc-sla-check <INC_ID>", pass_when: "containment within SEV SLA" }
  - { name: audit-integrity, cmd: "tools/audit-chain-verify --from <INC_ID_start>", pass_when: "chain intact" }
  - { name: pir-opened, cmd: "test -f incidents/<INC_ID>/pir.md", pass_when: "PIR exists within 5/10 BD per SEV" }
  - { name: preventive-control, cmd: "tools/inc-prevention-check <INC_ID>", pass_when: ">=1 runbook|detection|chaos|ADR added" }
halt_conditions:
  - "any destructive action without IC approval"
  - "silent fix (action not logged with operator + timestamp)"
  - "sharing raw logs containing un-redacted PII"
escalation: { to: "@incident-commander", channel: "#btx-incident-<INC_ID>" }
graph: { upstream: [P-11], downstream: [P-10, P-11] }
---

# P-13 — Drive an active incident

> Use when an incident is declared. The goal: contain, communicate, recover, learn. Audit and chain-of-custody preserved throughout.

---

You are Claude Code assisting on an active incident. **Do not take destructive actions without explicit human authorisation.** Follow the relevant runbook; do not improvise unless the runbook is silent — then document what you did.

## 0. Read first (skim only)

- Annex B §B.1 (incident command), §B.6 (revocation), §B.12 (audit anomaly), §B.13 (key compromise)
- [`docs/security/secure-sdlc.md`](../../security/secure-sdlc.md) §9
- BRD §27 (incident response)

## 1. Inputs (declared at incident open)

| Input | Value |
|---|---|
| Incident ID | `<<INC_ID>>` |
| Severity | SEV-1 / SEV-2 / SEV-3 |
| Trigger | alert id / report |
| Suspected surfaces | services / members |
| Incident commander | `<<IC>>` |
| Comms lead | `<<COMMS>>` |
| Forensics lead | `<<FORENSICS>>` |

## 2. Execute (in this order)

1. **Confirm** the incident: reproduce the symptom, capture timestamps and `txn_id`s. Snapshot dashboards.
2. **Contain** apply the smallest mitigation that stops harm. Common levers:
   - Revoke a member / cert (Annex B §B.6) — requires 4-eye.
   - Block a service id in PurposeGuard via emergency bundle.
   - Drain a Trust Node; shift traffic.
   - Rotate a key (Annex B §B.13) — requires 4-eye.
3. **Preserve evidence**: do NOT delete logs/audit; snapshot WORM offsets; capture k8s state and bundle/SVID metadata.
4. **Communicate** internal status update every 30 min for SEV-1, 60 min for SEV-2. Use templates in Annex B §B.1.3. External comms only via comms lead.
5. **Mitigate further** apply runbook(s); for novel paths, document each command in the incident channel.
6. **Recover** verify SLOs restored; verify audit chain integrity; verify policy bundle is the intended one.
7. **Close** declare resolved; open the post-incident review (PIR) ticket.
8. **PIR** within 5 business days for SEV-1, 10 for SEV-2: timeline, root cause(s), what worked, what didn't, action items with owners and dates.
9. **Update artefacts**:
   - Runbook updates from lessons.
   - New detection rule(s).
   - New chaos scenario if reproducible.
   - ADR if architectural change required.

## 3. Hard rules

- No silent fixes. Every action recorded with timestamps and operator.
- No data exfil — never share raw logs containing PII; redact.
- No deletion of audit/log artefacts during or after the incident.
- No production changes without IC approval.
- Notifications under DPDP / sectoral regulators handled by `@privacy-lead` + Legal.

## 4. Acceptance

- [ ] Containment within the SEV-driven SLA.
- [ ] Audit chain integrity verified.
- [ ] Evidence preserved with chain-of-custody.
- [ ] Comms templates used; cadence met.
- [ ] PIR opened within SLA; action items tracked to closure.
- [ ] At least one preventive control (runbook / detection / chaos / ADR) added.

## 5. Worked example

See [`_examples/p13.md`](./_examples/p13.md).

## 6. Self-score

Before opening the PR (or closing the incident), emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the PIR. **Do not close the incident if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
