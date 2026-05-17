# Data Protection Impact Assessment — consent-service

| Field | Value |
|---|---|
| Subject | `consent-service` (BTX control-plane) |
| Reference | DPIA-001 |
| Version | 1.0.0 |
| Date | 2026-05-17 |
| Author | @privacy-lead (agent-generated draft) |
| Status | draft — pending dual approval |
| Related Threat Model | [threat-models/consent-service.md](../threat-models/consent-service.md) |
| Linked ADRs | ADR-0004, ADR-0005, ADR-0007, ADR-0021, ADR-0022 |

> **Applicable law**: Digital Personal Data Protection Act 2023 (DPDP); IT Rules 2011 (residual); RBI data localisation guidelines; NIST SP 800-207 Zero Trust; LINDDUN privacy framework.

---

## 1. Purpose and Lawful Basis

### 1.1 Purpose Codes

| Code | Description |
|---|---|
| `P-CONSENT-GRANT` | Record a citizen's affirmative consent to share specified data fields with a named data principal for a named purpose and duration. |
| `P-CONSENT-REVOKE` | Record a citizen's withdrawal of previously granted consent, triggering cascade revocation across trust nodes. |
| `P-CONSENT-AUDIT` | Provide the citizen (or a delegated auditor) with a tamper-evident log of all consent lifecycle events. |

### 1.2 Plain Language Purpose

**English**: The BTX consent-service records your decisions about who can access your personal data, for what purpose, and for how long. You can revoke consent at any time. Every action is logged so you can see your full history.

**हिन्दी**: BTX कन्सेंट-सर्विस आपके इस निर्णय को रिकॉर्ड करती है कि आपके व्यक्तिगत डेटा तक किसका, किस उद्देश्य के लिए, और कितने समय तक पहुँच हो सकती है। आप किसी भी समय सहमति वापस ले सकते हैं। हर कार्रवाई लॉग की जाती है ताकि आप अपना पूरा इतिहास देख सकें।

**Marathi** (state language example): BTX संमती-सेवा आपल्या वैयक्तिक डेटावर कोणाला, कोणत्या उद्देशाने आणि किती काळासाठी प्रवेश असेल हे आपले निर्णय नोंदवते. आपण कधीही संमती मागे घेऊ शकता. प्रत्येक क्रिया लॉग केली जाते जेणेकरून आपण आपला संपूर्ण इतिहास पाहू शकता.

### 1.3 Lawful Basis

| Processing Activity | Lawful Basis (DPDP 2023) | Notes |
|---|---|---|
| Storing consent grant | **Consent** — §7(a): explicit, specific, informed | Citizen initiates grant via portal; notice presented before grant |
| Storing consent revoke | **Compliance with law** — §7(f) + citizen right to withdraw | Revocation is mandatory on request |
| Audit trail retention | **Legal obligation** — §7(d): archival for regulatory compliance | Audit log mandatory per RBI data localisation and financial sector obligations |
| Cross-node federation sync | **Consent** + **Legitimate interest** — §7(b): necessary to give effect to the original consent | Federation is only triggered after consent grant |

---

## 2. Data Elements Register

| Field | Category | Sensitivity | Necessary Justification | Minimisation Rule |
|---|---|---|---|---|
| `citizen_id` | Personal identifier | `citizen_portable` | Required to uniquely associate consent with a citizen | Hashed with per-deployment salt before storage (PDP obligation ADR-0007) |
| `principal_id` | Organisational identifier | `operational` | Required to identify the data-receiving party | Full ID stored; no further minimisation needed |
| `purpose_codes` | Metadata | `operational` | Required to enforce PDP decisions by purpose | Stored as codes; plain text purpose stored in separate purpose registry, not in consent record |
| `data_class` | Classification metadata | `operational` | Required for PDP and audit | Enum value only; no PII |
| `status` | Processing state | `operational` | Required to track consent lifecycle | Enum: active/revoked/expired |
| `granted_at`, `expires_at`, `revoked_at` | Timestamps | `operational` | Required for TTL enforcement and audit | ISO-8601 UTC only; no timezone inferencing |
| `granted_by`, `revoked_by` | Actor identity | `restricted` | Required for accountability (audit and dispute resolution) | SPIFFE SVID principal; no human name stored at this level |
| Audit event `actor_id` | Actor identity | `restricted` | Required for non-repudiation | SVID principal only |
| Audit event `request_fingerprint` | Request metadata | `operational` | Required for idempotency and replay detection | SHA-256 of request headers; no body stored |

**Personal data categories present**: citizen_id (pseudonymous), granted_by/revoked_by (service principal, not human), timestamps.

No special category data (health, financial, biometric) is stored in this service. Special category data MAY flow through consent grants but is handled by downstream data providers, not by the consent-service.

---

## 3. Minimisation Rule

The PDP (OPA/Rego) enforces the following minimisation obligations at response time:

| Response Shape | When Applied | Obligation ID |
|---|---|---|
| Full consent record | Caller is the granting node or delegated auditor | `OBL-CONSENT-FULL` |
| Status + expiry only | Caller is an authorised data provider (not owner) | `OBL-CONSENT-STATUS-ONLY` |
| Denied (403) | Caller not in ACL for this consent | `OBL-CONSENT-DENY` |

Reference: ADR-0007 (provider-side minimisation), ADR-0004 (policy-as-code).

---

## 4. Retention Schedule

| Data | Retention Period | Basis | Deletion Mechanism |
|---|---|---|---|
| Active consent records | Duration of consent + 7 years | Financial sector regulatory requirement | Automated `consent_expiration_job` (backlog item) |
| Revoked consent records | 7 years from revocation | DPDP §12 (right to access historical data) | Scheduled soft-delete then hard-delete after 7-year period |
| Audit events (`audit_events` table) | 10 years | RBI audit trail requirement | Partition-level archival to cold storage; delete active partition after 10 years |
| Outbox records | Until Kafka acknowledgment + 24h | Operational necessity | `outbox_cleanup_job` (automated) |
| Idempotency cache (Redis) | 24 hours | Operational necessity (ADR-0022) | Redis TTL |
| KMS DEKs | Linked to consent record lifetime | Derived from consent retention | Key rotation policy: DEK rotated every 90 days; old DEK kept for decryption until consent deleted |

---

## 5. Citizen Rights and Grievance Route

| Right | Mechanism | SLA | Handler |
|---|---|---|---|
| **Right to access** (§11) | Citizen portal → "View my consents" → calls `GET /v1/consents/:id` or `/audit` | 3 business days | `@data-steward` |
| **Right to correction** | Consent cannot be "corrected" (immutable); citizen must revoke and re-grant with correct data | Immediate (self-service) | Citizen portal |
| **Right to erasure** (§12) | Revoke consent → data in consent record pseudonymised; full erasure after 7-year retention window | 30 days for initial revoke; 7-year for hard delete | `@privacy-lead` |
| **Right to grievance** (§13) | Grievance form at portal → ticket to `#btx-privacy`; DPO response within 21 days per DPDP §13 | 21 days | DPO handle |
| **Right to data portability** | Citizen can download all their consent records as JSON from portal | On-demand | Portal API |
| **Right to nominate** | Citizen can nominate a guardian for incapacity (DPDP §14) | On registration | Identity service (out of scope) |

---

## 6. Risk Assessment

| Risk | Vulnerable Group | Severity | Likelihood | Risk | Mitigation |
|---|---|---|---|---|---|
| Citizen data exposed due to authorisation bypass | All citizens | High | Low | **Medium** | Principal ID cross-check; mTLS; T08 in threat model |
| Consent revocation not propagated (cascade failure) | Minors, rural citizens with limited portal access | High | Low | **Medium** | Federation sync SLA; alert on cascade timeout; manual override runbook |
| Consent record linkability enables profiling | Citizens from marginalised communities | High | Medium | **High** | Citizen_id hashing; PDP cross-purpose linking prohibition; T15 in threat model |
| Audit trail tampered, removing evidence of consent abuse | Vulnerable populations (minors, elderly) | High | Very Low | **Low** | Merkle root chain; WORM Kafka topic |
| Children's data processed without guardian consent | Minors (< 18 years) | High | Low | **High** | Age verification enforced by Identity service (upstream); PDP obligation `OBL-MINOR-GUARDIAN` requires guardian consent flag; consent-service validates flag presence | 
| Data processed beyond consent expiry | All citizens | Medium | Low | **Low** | Consent TTL enforced by PDP at decision time; `expires_at` checked on every grant response |
| Cross-border data transfer without data localisation | Citizens in restricted residency states | High | Medium | **High** | ADR-0025 (data residency) gates cross-border federation; PDP obligation `OBL-RESIDENCY-CHECK` | 

---

## 7. Cross-Border Data Transfer Assessment

| Transfer | Destination | Mechanism | Safeguard | Status |
|---|---|---|---|---|
| Consent sync to peer trust nodes | Within India (Phase 1) | Federation sync API (mTLS) | Residency check in PDP; no transfer if destination node is cross-border | Compliant |
| KMS operations (AWS/GCP/Azure) | India regions preferred (`ap-south-1`, `asia-south1`, `centralindia`) | Cloud SDK | `CLOUD_REGION` config enforces India-resident keys; audit events for KMS calls | Compliant with config |
| Audit logs (Loki/S3/GCS) | India regions | Object store adapter | Storage bucket restricted to India region in bootstrap factory | Compliant with config |

Cross-border transfer is **not enabled** in Phase 1 (BTX India-only deployment). ADR-0025 governs future cross-border expansion.

---

## 8. Consultation Record

| Stakeholder | Consulted | Date | Outcome |
|---|---|---|---|
| DPO / Privacy Lead | _pending_ | — | — |
| Security Lead | _pending_ | — | — |
| Data Steward | _pending_ | — | — |
| Citizen Advisory Panel | _pending_ | — | — |

---

## 9. Notice Text

The following notice must be shown to citizens before consent is requested.

**English**: "You are granting Bharat Trust Exchange permission to share [data fields] with [data principal] for [purpose] until [expiry date]. You may revoke this consent at any time from your portal. Your consent decision will be logged and protected. For queries, contact the BTX Grievance Officer."

**हिन्दी**: "आप भारत ट्रस्ट एक्सचेंज को अनुमति दे रहे हैं कि [डेटा फ़ील्ड] को [डेटा प्रिंसिपल] के साथ [उद्देश्य] के लिए [समाप्ति तिथि] तक साझा किया जाए। आप अपने पोर्टल से कभी भी यह सहमति वापस ले सकते हैं। आपके सहमति निर्णय को लॉग किया जाएगा और सुरक्षित रखा जाएगा। प्रश्नों के लिए, BTX शिकायत अधिकारी से संपर्क करें।"

---

## 10. Approval Requirements

| Role | Required | Signed | Date |
|---|---|---|---|
| Privacy Lead / DPO | Yes | _pending_ | — |
| Security Lead | Yes | _pending_ | — |
| Data Steward | Yes | _pending_ | — |
| Chief Architect | Optional (if policy change) | — | — |

---

## 11. Conformance Gate

This DPIA satisfies the pre-conditions for **CT-018** (DPIA gate). The consent-service **must not be promoted to production** until:
- [ ] All 10 sections are approved
- [ ] CT-018 exits green in the conformance runner
- [ ] Notice text reviewed by legal team
- [ ] Children's data safeguard (`OBL-MINOR-GUARDIAN`) verified end-to-end

---

## 12. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-05-17 | @privacy-lead (agent) | Initial draft |

---

## 13. Links

- Threat model: [threat-models/consent-service.md](../threat-models/consent-service.md)
- Service README: [services/control-plane/README.md](../services/control-plane/README.md)
- Policy obligations: `policy/consent/obligations.rego`
- ADR-0004: Policy-as-code
- ADR-0005: Audit-as-trust-product
- ADR-0007: Provider-side minimisation
- ADR-0021: Outbox pattern
- ADR-0025: Data residency (cross-border controls)
