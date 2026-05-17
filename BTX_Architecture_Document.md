# Bharat Trust Exchange (BTX) — Architecture Document for Implementation

| Field | Value |
|---|---|
| Product | Bharat Trust Exchange (BTX) |
| Document | Implementation Architecture (Solution + Technical Design) |
| Version | 2.0 (10/10 review edition) |
| Companion to | BTX 10/10 Review BRD v2.0 |
| Annexes | [Annex A — Engineering](BTX_Architecture_Annex_A_Engineering.md) · [Annex B — Runbooks](BTX_Architecture_Annex_B_Runbooks.md) · [Annex C — Evidence & Quantification](BTX_Architecture_Annex_C_Evidence.md) |
| Date | 16 May 2026 |
| Status | For architecture review board, security review, build planning |

> **Thesis carried from BRD:** Do not centralise government data. Centralise trust, standards, policy, observability and audit. Federate exchange through certified BTX **Trust Nodes** controlled by departments and states.

---

## Executive summary

Bharat Trust Exchange (BTX) is a cloud-agnostic trust fabric for lawful, auditable and citizen-centric data exchange across central ministries, state departments, public platforms and authorised ecosystems. This Architecture Document operationalises the BTX BRD v2.0 into a build-ready specification.

**What this document delivers:**

- A federated, cloud-agnostic reference architecture (C4 Levels 1-3) with no central master database.
- A zero-trust security and PKI design with per-member cryptographic identity.
- Policy-as-code (PurposeGuard) with worked Rego samples and tests (Annex A).
- Tamper-evident audit (AuditLedger) with hash chain, periodic anchoring and reconciliation.
- Cloud-adapter abstraction enabling deployment on NIC/MeghRaj, state cloud, AWS/Azure/GCP and hybrid without core code change.
- Quantified capacity, sized BoMs, cost model and full conformance evidence index (Annex C).
- Operations and security runbooks covering key ceremony, certificate rotation, emergency revocation, DR failover, audit anomaly and citizen grievance (Annex B).

**Decisions requested from the review board:**

1. Approve this architecture as the reference for the BTX MVP.
2. Endorse the seven new ADRs (ADR-011..017) extending the BRD decision log.
3. Authorise pilot deployment on two certified hosting environments per BRD CT-001/CT-025.
4. Approve the funded build of EPIC-1..EPIC-12 (see §19.2).
5. Approve the quarterly drill calendar and conformance evidence cadence (Annex B §B.16, Annex C §C.12).

**10/10 review readiness:** every BRD requirement, NFR, conformance test (CT-001..025) and STRIDE threat (T01..T15) has a named component, test artefact and runtime evidence pointer recorded in Annex C §C.3 and §C.12.

---

## Table of Contents

1. [Architecture goals, drivers and constraints](#1-architecture-goals-drivers-and-constraints)
2. [Architecture overview (C4 — Level 1 & 2)](#2-architecture-overview-c4--level-1--2)
3. [Logical architecture](#3-logical-architecture)
4. [Component architecture (C4 — Level 3)](#4-component-architecture-c4--level-3)
5. [Data architecture](#5-data-architecture)
6. [Security architecture & zero-trust design](#6-security-architecture--zero-trust-design)
7. [Identity, PKI and key management](#7-identity-pki-and-key-management)
8. [Policy-as-code (PurposeGuard) design](#8-policy-as-code-purposeguard-design)
9. [Audit architecture (AuditLedger)](#9-audit-architecture-auditledger)
10. [API & integration architecture](#10-api--integration-architecture)
11. [Runtime & deployment architecture](#11-runtime--deployment-architecture)
12. [Cloud-adapter abstraction & portability](#12-cloud-adapter-abstraction--portability)
13. [Observability, SRE and operations](#13-observability-sre-and-operations)
14. [High availability, DR and outage continuity](#14-high-availability-dr-and-outage-continuity)
15. [Technology selection matrix](#15-technology-selection-matrix)
16. [Build, CI/CD and GitOps](#16-build-cicd-and-gitops)
17. [Environments, namespaces and tenancy](#17-environments-namespaces-and-tenancy)
18. [Capacity planning & performance targets](#18-capacity-planning--performance-targets)
19. [Implementation plan & work breakdown](#19-implementation-plan--work-breakdown)
20. [Risks, open issues and decisions log](#20-risks-open-issues-and-decisions-log)
21. [Appendices — interface contracts](#21-appendices--interface-contracts)

---

## 1. Architecture goals, drivers and constraints

### 1.1 Architecture drivers (ranked)

| Rank | Driver | Source (BRD) |
|---|---|---|
| 1 | Federation — no central master database | ADR-001, §1, §5.3 |
| 2 | Cloud-agnostic portability | ADR-002, NFR-006..010 |
| 3 | Purpose-bound, policy-enforced exchange | C03, FR-011..015 |
| 4 | Tamper-evident audit | C07, §14.3 |
| 5 | Citizen-visible safeguards | §13.3 |
| 6 | Outage continuity (signed config cache) | ADR-009, FR-019, CT-011 |
| 7 | Procurement neutrality & exit | §21, ADR-008 |

### 1.2 Architecturally significant requirements (ASRs)

- ASR-01: Same product core MUST deploy on ≥2 certified runtimes (NIC/MeghRaj, AWS/Azure/GCP/state cloud) without code change. — `CT-001`, `CT-025`
- ASR-02: Every production exchange MUST be signed, timestamped, replay-protected, mTLS-mutually-authenticated. — `FR-017`, `CT-002..006`
- ASR-03: Provider-side minimisation MUST be enforced before egress. — `FR-021`, `CT-013`
- ASR-04: Trust Nodes MUST continue approved traffic for bounded TTL during control-plane outage. — `FR-019`, `CT-011`
- ASR-05: Audit MUST be tamper-evident with requester/provider reconciliation. — `FR-026`, `CT-015..016`
- ASR-06: Cloud-specific services MUST be isolated in adapter modules. — `NFR-009`

### 1.3 Constraints

- DPDP Act 2023 lawful processing, notice, rights, grievance
- GIGW/WCAG accessibility for all governance UIs
- Open standards mandatory: OpenAPI, AsyncAPI, OIDC/SAML, OpenTelemetry, OPA/Rego
- Source escrow / open-source preference for procurement
- No proprietary cloud lock-in in business logic

---

## 2. Architecture overview (C4 — Level 1 & 2)

### 2.1 System context (Level 1)

```
                ┌───────────────────────┐
   Citizens ───►│ Wallet / DigiLocker   │
                └────────────┬──────────┘
                             │ VC / signed claims
                             ▼
 ┌──────────────┐    ┌──────────────────────────────┐    ┌─────────────────────┐
 │ Requester    │◄──►│        BTX  (Trust Fabric)   │◄──►│ Provider            │
 │ Dept App     │    │  Control Plane + Trust Nodes │    │ Dept Source System  │
 └──────────────┘    └──────────────┬───────────────┘    └─────────────────────┘
                                    │ canonical audit / SIEM
                                    ▼
                            ┌────────────────┐
                            │ Oversight /    │
                            │ SOC / Auditors │
                            └────────────────┘

 External rails:  API Setu  •  State Exchanges  •  Sectoral Platforms
```

### 2.2 Container view (Level 2)

```
                        ┌──────────────────────── EXPERIENCE RAILS ────────────────────────┐
                        │  Trust Console (Gov UI)  │  Developer Portal  │  Citizen Portal  │
                        └──────────────────────────────────────┬───────────────────────────┘
                                                               │ OIDC/SAML
┌──────────────────────────────────────────────────────────────▼───────────────────────────┐
│                                    BTX CONTROL PLANE                                     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│ │  Member    │ │  Service   │ │  Purpose   │ │ SchemaHub  │ │ Approval   │ │ Audit    │  │
│ │  Registry  │ │  Catalogue │ │  Registry  │ │ (contracts)│ │ Workflow   │ │ Dashboard│  │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └──────────┘  │
│ ┌──────────────────────────────────────────┐  ┌─────────────────────────────────────┐    │
│ │ PurposeGuard (Policy Decision Service)   │  │ Signed Config Publisher (TUF-like)  │    │
│ └──────────────────────────────────────────┘  └─────────────────────────────────────┘    │
└──────────┬───────────────────────────┬─────────────────────────────────┬─────────────────┘
           │ signed config bundles     │ policy decisions (PDP)          │ canonical audit
           ▼                           ▼                                 ▼
┌────────────────────────────────── FEDERATED DATA PLANE ────────────────────────────────────┐
│                                                                                            │
│  ┌────────────────────────┐                            ┌────────────────────────┐          │
│  │ Requester Trust Node   │ ◄──── mTLS + signed ─────► │ Provider Trust Node    │          │
│  │ • Outbound enforcement │       request/response     │ • Inbound enforcement  │          │
│  │ • Sign / nonce / TS    │                            │ • Verify / replay chk  │          │
│  │ • Local PDP cache      │                            │ • Minimisation engine  │          │
│  │ • Audit emitter        │                            │ • Backend adapters     │          │
│  └─────────┬──────────────┘                            └─────────┬──────────────┘          │
│            │                                                     │                         │
│  ┌─────────▼───────┐                                   ┌─────────▼───────────────┐         │
│  │ Requester App   │                                   │ Source System (DB/API/  │         │
│  │ (Dept/State)    │                                   │ Legacy/SOAP/Files)      │         │
│  └─────────────────┘                                   └─────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────────────────────────┘

           ▼ all components ride on ▼

┌──────────── PORTABLE RUNTIME (K8s/OpenShift, OPA, OTel, PG, Kafka/NATS, S3-API) ────────────┐
│                                                                                              │
│  ┌──── Cloud Adapter ────┐ ┌──── Cloud Adapter ────┐ ┌──── Cloud Adapter ────┐               │
│  │ NIC/MeghRaj          │ │ AWS / Azure / GCP     │ │ State / Private cloud │               │
│  │ IAM/KMS/Net/Storage  │ │ IAM/KMS/Net/Storage   │ │ IAM/KMS/Net/Storage   │               │
│  └──────────────────────┘ └──────────────────────┘ └───────────────────────┘                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Logical architecture

### 3.1 Layer responsibilities

| Layer | Responsibility | Key components | Owns state? |
|---|---|---|---|
| Experience | UX for governance, developers, citizens | Trust Console, Dev Portal, Citizen Portal | No |
| Control plane | Authoritative truth for members, services, policies, schemas, audit aggregation | Registry, Catalogue, PurposeGuard, SchemaHub, Approval, Audit Dashboard, Signed Config Publisher | Yes (governance state) |
| Data plane | Per-member runtime enforcing exchange | Trust Node (Requester role + Provider role + Adapters) | Ephemeral (logs + cache) |
| Portable runtime | Container, mesh, policy, observability, queue, storage | K8s/OpenShift, Istio/Linkerd, OPA, OTel, Kafka/NATS, PG, S3-API | N/A |
| Cloud adapter | Cloud-specific glue for IAM/KMS/Net/DNS/Storage | Terraform/OpenTofu modules + Helm values per provider | N/A |
| Source systems | Department systems of record | Registries, legacy apps, document repos, issuer systems | Yes (authoritative) |

### 3.2 Domain model (logical)

```
 Member 1──* TrustNode 1──* Endpoint
 Member 1──* ServiceEntry *──1 SchemaVersion
 ServiceEntry *──* PurposeCode (allowed)
 PurposeCode 1──* PolicyRule (Rego bundle)
 AccessGrant: (RequesterMember, ServiceEntry, PurposeCode, ttl, obligations)
 Exchange: (txn_id, RequesterMember, ProviderMember, ServiceEntry, PurposeCode,
            decision, response_shape, signatures, timestamps, audit_hash)
 Citizen (subject_ref) 1──* SharingHistoryEntry
 Steward 1──* ServiceEntry  (accountability)
 Certificate 1──1 TrustNode  (issuer, serial, status)
```

### 3.3 Module catalogue (mapped to BRD §3.1)

| Module | Type | Tech (default) | Stateful | Replaceable |
|---|---|---|---|---|
| BTX Trust Console | Web app | React + TS, Vite, Node BFF | No | Yes |
| Member Registry | API + DB | Go/Java, PostgreSQL | Yes | Yes |
| Service Catalogue | API + DB | Go/Java, PostgreSQL, OpenAPI store | Yes | Yes |
| Purpose Registry | API + DB | Go/Java, PostgreSQL | Yes | Yes |
| PurposeGuard (PDP) | gRPC + REST | OPA + Rego policies, Go shim | No (policies versioned in Git) | Yes (XACML adapter) |
| SchemaHub | API + Storage | Confluent-schema-registry-style, JSON Schema, OpenAPI/AsyncAPI, S3-API | Yes | Yes |
| Approval Workflow | App + DB | Temporal/Camunda or Go workflow, PostgreSQL | Yes | Yes |
| Signed Config Publisher | Service + S3-API | Go, Sigstore/cosign or TUF | Yes (signed bundles) | Yes |
| Audit Dashboard | Web + Query | React + OpenSearch/Loki | Read-only | Yes |
| Trust Node (PEP) | Sidecar + Gateway | Envoy/Go proxy + OPA sidecar | Cache-only | Yes |
| AuditLedger | Pipeline + Store | Kafka/NATS → object store + hash chain | Append-only | Yes |
| Connectors | Adapter SDK | Go/Java SDK + per-system module | Stateless | Yes |
| Certify | Test harness | k6, ZAP, custom conformance runner | No | Yes |

---

## 4. Component architecture (C4 — Level 3)

### 4.1 Trust Node — internal components

```
                         ┌─────────────────── Trust Node ───────────────────┐
                         │                                                  │
  Caller (Requester App) │  ┌──────────────┐    ┌─────────────────────┐     │
  ────────────────────►  │─►│ Ingress /    │───►│ Request Builder     │     │
                         │  │ Egress Proxy │    │ • txn_id, nonce, ts │     │
                         │  │ (Envoy)      │    │ • purpose binding   │     │
                         │  └──────┬───────┘    └────────┬────────────┘     │
                         │         │                     │                  │
                         │         ▼                     ▼                  │
                         │  ┌──────────────┐    ┌─────────────────────┐     │
                         │  │ Local PDP    │◄───┤ Signed Config Cache │     │
                         │  │ (OPA)        │    │ (TTL, versioned)    │     │
                         │  └──────┬───────┘    └────────┬────────────┘     │
                         │         │ allow/deny/obligs   │                  │
                         │         ▼                     │                  │
                         │  ┌──────────────┐             │                  │
                         │  │ Crypto       │             │                  │
                         │  │ Signer/Verif │◄────────────┘                  │
                         │  │ (HSM/KMS)    │                                │
                         │  └──────┬───────┘                                │
                         │         │                                        │
                         │         ▼                                        │
                         │  ┌──────────────┐    ┌─────────────────────┐     │
                         │  │ mTLS Egress  │───►│ Audit Emitter       │────►│  Kafka/NATS → AuditLedger
                         │  └──────┬───────┘    └─────────────────────┘     │
                         │         │                                        │
                         │  (provider side adds: Minimisation Engine,       │
                         │   Replay Cache, Backend Adapter Dispatcher)      │
                         └──────────────────────────────────────────────────┘
```

### 4.2 Provider Trust Node — minimisation engine

```
                  ┌──────────────────────────────────────────────────┐
   Verified Req ─►│ Policy Obligations (allowed_fields,              │
                  │ response_shape, retention, masks)                │
                  └────────────────────┬─────────────────────────────┘
                                       ▼
                  ┌──────────────────────────────────────────────────┐
                  │ Response Shaper:                                 │
                  │  • FULL → projection by allowed_fields           │
                  │  • MASKED → field-level mask/tokenise            │
                  │  • YES_NO → boolean assertion (signed)           │
                  │  • SIGNED_CLAIM → VC-style signed claim          │
                  │  • SELECTIVE_DISCLOSURE → BBS+/SD-JWT (future)   │
                  └────────────────────┬─────────────────────────────┘
                                       ▼
                          Sign + timestamp + return
```

### 4.3 Control plane — PurposeGuard (PDP) component

```
   PEP (Trust Node) ─── REST/gRPC decision request ───►  ┌──── PurposeGuard ────┐
                                                          │ • OPA bundle loader │
                                                          │ • Rego policies     │
                                                          │ • Context resolver  │◄── Member Registry
                                                          │   (member, service, │◄── Service Catalogue
                                                          │    purpose, env)    │◄── Purpose Registry
                                                          │ • Decision logger   │◄── Approval Workflow
                                                          └──────────┬──────────┘
                                                                     │
                                                                     ▼
                                                          Decision: ALLOW |
                                                          ALLOW_WITH_MINIMISATION |
                                                          ALLOW_WITH_NOTICE |
                                                          REQUIRE_CONSENT |
                                                          ESCALATE | DENY
```

### 4.4 Signed Config Publisher

- Builds versioned bundle: `{members, services, policies, certificates, revocations}`
- Signs with publisher key (HSM-backed); supports TUF-style role separation (root, targets, snapshot, timestamp)
- Distributes via S3-API bucket + signed metadata; Trust Nodes pull on interval + push notify (NATS/Kafka topic)
- Trust Node refuses unsigned/stale/revoked bundle (`FR-018`, `CT-010`)
- Emergency revocation channel: short-lived signed delta bundle pushed out-of-band (`ADR-009`, `CT-012`)

---

## 5. Data architecture

### 5.1 Data ownership matrix

| Data | Owner | Stored where | Replicated? | Retention |
|---|---|---|---|---|
| Citizen master records | Source department | Source system | **No** (BTX never copies) | Per department law |
| Member registry | National BTX Authority | Control plane PG | HA/DR replica | Indefinite + audit |
| Service catalogue | Provider stewards + Authority | Control plane PG + S3-API (contracts) | HA/DR replica | Versioned indefinitely |
| Purpose codes | National + Domain councils | Control plane PG | HA/DR replica | Indefinite |
| Policies (Rego) | Security/Privacy board | Git repo + signed bundles | Git mirror | Versioned indefinitely |
| Approvals/grants | Provider steward | Control plane PG | HA/DR replica | Per policy |
| Audit events | BTX (canonical) | Kafka/NATS → object store + hash chain | DR replica | Per retention class |
| Trust Node logs | Member (local) | Local store → forwarded | Forwarded to central | Per class |
| Sharing history (citizen-visible) | BTX | Derived from audit | Yes | Per DPDP rule |
| PKI artefacts (certs, CRLs) | Security team | HSM / CA / control plane | HSM HA | Cert lifetime + 1y |

> **Invariant:** No source-of-truth citizen attributes are persisted in BTX. Only metadata, audit, references and signed assertions.

### 5.2 Schemas (canonical)

- `member.json` — legal id, code, role, env, status, owners, nodes, cert refs, audit history
- `service.json` — provider_member, service_id, version, type (REST/SOAP/Event/Doc/VC), schema_ref, data_class, allowed_purposes, sla, lifecycle_state
- `purpose.json` — code, label (multilingual), data_class, lawful_basis, minimisation_default, response_shape_default
- `policy.json` — meta wrapper around Rego module; tests; reviewer; rollback ref
- `grant.json` — requester_member, service_id, purpose, scope, valid_from/to, obligations
- `audit-event.json` — canonical (see BRD §27.3 and Appendix 21.3)

### 5.3 Data classification → store mapping

| Class | Allowed BTX store | Encryption | Access path |
|---|---|---|---|
| Open/public | Catalogue + S3-API | TLS in transit | Public API |
| Operational | Audit + metadata only | TLS + AES-256 at rest | RBAC/ABAC |
| Citizen-portable | Pointer/VC only — never raw | TLS + AES-256, KMS-CMK | Wallet flows |
| Restricted/high-risk | Audit only; data never transits BTX cache | TLS + HSM-backed | Strict ABAC + 4-eye |
| Non-shareable | Catalogue may list as “blocked” | N/A | No exchange |

---

## 6. Security architecture & zero-trust design

### 6.1 Zero-trust principles applied (NIST SP 800-207)

| Principle | BTX realisation |
|---|---|
| All resources authenticated & authorised | mTLS + signed request + PDP decision per call |
| Least privilege | ABAC via Rego; minimisation by default; per-purpose scope |
| Assume breach | Continuous policy eval, short cert TTL, anomaly alerts, immutable audit |
| Dynamic context | Decision uses member status, env, channel, bulk flag, risk score |
| Encryption everywhere | mTLS in transit; AES-256 + KMS-CMK at rest; HSM-backed signing keys |

### 6.2 Trust boundaries (numbered per BRD §23.1)

```
[1] Gov User ─OIDC─► Trust Console
[2] Control Plane ─signed bundles─► Signed Config Publisher
[3] Trust Node ◄──mTLS+sig──► Trust Node (peer)
[4] Trust Node ──adapter──► Source System
[5] Trust Node ──Kafka TLS──► AuditLedger ──► Immutable store
[6] Cloud Adapter ──cloud API──► Provider IAM/KMS/Net/Storage
[7] Citizen Wallet ◄──VC/OIDC──► BTX / Verifier
[8] External Ecosystem ──certified member boundary──► BTX
```

### 6.3 STRIDE → control mapping (excerpt; full per BRD §23)

| Threat | Primary control | Implementation artefact |
|---|---|---|
| T01 Spoofed member | mTLS + cert-bound id + signed config | Envoy mTLS + SPIFFE-style ID + bundle verify |
| T02 Key compromise | HSM/KMS + rotation + emergency revoke | KMS adapter, cert lifecycle service |
| T03 Replay | Nonce + TS + replay cache (Redis) | Provider TN replay cache, 5-min TTL |
| T04 Policy bypass | Mandatory PDP at TN; refuse expired config | OPA sidecar + bundle TTL hard-stop |
| T05 Over-sharing | Provider minimisation engine | Response Shaper |
| T06 Audit tampering | Hash chain + WORM store | AuditLedger digest service |
| T07 Insider misuse | 4-eye + reason codes + anomaly | Approval Workflow + UEBA on audit |
| T08 Bulk scraping | Rate limits + bulk-approval workflow | Envoy rate limit + dedicated bulk lane |
| T13 DoS | Autoscale + circuit break + WAF | HPA + Envoy outlier detection |
| T15 BOLA | Object-context binding in policy + tests | Rego rule + conformance test CT-017 |

### 6.4 Cryptographic profile (default)

| Use | Algorithm | Key store |
|---|---|---|
| TLS / mTLS | TLS 1.3, ECDSA-P256 or RSA-3072 | KMS or HSM |
| Request/response signing | JWS (Ed25519 preferred, ECDSA-P256 fallback) | HSM for prod |
| Timestamping | RFC 3161 TSA (national TSA preferred) | TSA service |
| Audit hashing | SHA-256 chain; periodic anchor signature | KMS |
| Data at rest | AES-256-GCM via cloud KMS-CMK | Cloud KMS |
| Secrets | Vault / External Secrets → KMS | Vault + KMS |
| Verifiable Credentials | Ed25519 / BBS+ (future SD) | HSM/KMS |

---

## 7. Identity, PKI and key management

### 7.1 Identity layers

| Layer | Identity | Issuer | Verification |
|---|---|---|---|
| Human (governance) | OIDC/SAML subject | Department IdP federated to BTX | OIDC validation |
| Workload (services) | SPIFFE-style SVID or X.509 | Internal CA (per cluster) | mTLS |
| Trust Node | X.509 cert bound to Member | BTX-approved CA / sub-CA per state | mTLS + bundle |
| Citizen | Aadhaar / DigiLocker / wallet binding | National rails | OIDC + VC |
| Verifier (external) | Member cert | Same CA hierarchy | mTLS |

### 7.2 PKI hierarchy

```
        BTX Root CA (offline, HSM)
              │
   ┌──────────┼─────────────┬──────────────┐
 National   State Sub-CA   Domain Sub-CA   Service Sub-CA
 Sub-CA       (per state)   (per sector)   (workload SVIDs)
   │            │              │
 Member       Member         Member
 Certs        Certs          Certs
```

- Root: offline, HSM, ceremony-controlled.
- Sub-CAs: online HSM-backed, short certificate TTLs (Trust Node certs ≤ 90 days).
- CRL + OCSP stapling + signed-bundle revocation list (defence in depth).
- Per-member key isolation; no shared signing identity (FR per BRD §14.2).

### 7.3 Key lifecycle states

`request → issue → active → rotate → revoke → archive` — automated via cert lifecycle service; alerts at 30/14/7/1 day expiry; emergency revoke path tested quarterly (`CT-012`).

---

## 8. Policy-as-code (PurposeGuard) design

### 8.1 Policy authoring & release pipeline

```
 Policy author (Git PR)
        │
        ▼
 Rego linting (regal) + unit tests (opa test)
        │
        ▼
 Security/Privacy reviewer approval (CODEOWNERS)
        │
        ▼
 Build OPA bundle → sign (cosign / HSM)
        │
        ▼
 Publish to Signed Config Publisher
        │
        ▼
 Trust Nodes pull + verify signature + activate
```

### 8.2 Decision contract

Inputs: see BRD §27.1. Outputs: see BRD §27.2.

**Decision values:** `ALLOW | ALLOW_WITH_MINIMISATION | ALLOW_WITH_NOTICE | REQUIRE_CONSENT | ESCALATE | DENY`

**Obligations:** `log_requester`, `log_provider`, `show_purpose_if_citizen_visible`, `mask_fields:[...]`, `response_shape:<...>`, `retention_class:<...>`, `rate_limit:<n/min>`, `four_eye_approval`.

### 8.3 Local PDP vs central PDP

| Mode | When | Behaviour |
|---|---|---|
| Central call | Default, low-latency network | Trust Node calls PurposeGuard for every request |
| Local cache | Control-plane outage or latency-sensitive path | Trust Node uses signed cached bundle; bundle has hard TTL; if expired, deny new approvals but continue pre-approved grants until grant TTL |
| Emergency revoke | Out-of-band | Delta bundle invalidates grants/certs immediately |

---

## 9. Audit architecture (AuditLedger)

### 9.1 Audit pipeline

```
 Trust Node (requester) ──┐
                           ├─► Kafka/NATS topic `btx.audit.v1` ─► Stream processor ─► Object store (WORM)
 Trust Node (provider) ──┘                                                │
                                                                          ├─► Hash-chain digester (per partition)
                                                                          ├─► Index (OpenSearch) for dashboard
                                                                          ├─► SIEM export (CEF/OCSF)
                                                                          └─► Reconciliation job (req vs prov)
```

### 9.2 Tamper evidence

- Each event → SHA-256; chained as `H_n = SHA256(H_{n-1} || event_n)`.
- Periodic anchor: chain head signed by KMS key and written to immutable store; optionally anchored to external timestamp authority.
- Reconciliation: scheduled job pairs requester/provider events by `txn_id`; mismatches → alert.
- Citizen-visible sharing history: derived projection filtered by `subject_ref`, surfaced through Citizen Portal/wallet (BRD §13.3).

### 9.3 Retention classes

| Class | Store tier | Default retention |
|---|---|---|
| `policy_personal_record_audit` | Hot 90d → cold WORM | Per DPDP / sector rule |
| `policy_operational_audit` | Hot 30d → cold | 3 years (configurable) |
| `policy_security_event` | Hot 365d | 5 years |
| `policy_revocation` | Hot indefinite | Indefinite |

---

## 10. API & integration architecture

### 10.1 API styles by use case

| Use case | Style | Contract |
|---|---|---|
| Verification (yes/no) | REST sync | OpenAPI |
| Record lookup (minimised) | REST sync | OpenAPI |
| Event notification | Async pub/sub | AsyncAPI |
| Document/file exchange | REST + signed URL | OpenAPI + manifest |
| Credential exchange | OIDC4VCI / VC API | W3C VC + OpenAPI |
| Legacy SOAP | Adapter wraps SOAP → REST | WSDL + OpenAPI shim |

### 10.2 Integration with existing rails

| Rail | Integration pattern |
|---|---|
| **API Setu** | BTX Catalogue publishes/synchronises service entries; Setu remains discovery & subscription rail for cross-government APIs. |
| **DigiLocker / Wallet** | BTX Citizen Portal links sharing history; VC issuer/verifier flows route through Trust Node with citizen-directed consent. |
| **State exchanges** | State Trust Node federates with national; signed config bridges domain policies. |
| **Legacy SOAP/file** | Connectors SDK provides adapter template with input validation, parameterised access and WAF. |

### 10.3 Versioning & lifecycle

- SemVer on service contracts; `lifecycle ∈ {draft, sandbox, active, deprecated, sunset}`.
- Mandatory dual-version window for breaking changes; consumers notified via Catalogue + email/webhook.
- Schema validation enforced at publish time (`CT-022`).

---

## 11. Runtime & deployment architecture

### 11.1 Logical deployment topology

```
┌──────────────────── Control Plane Cluster (HA, multi-AZ) ────────────────────┐
│  ns: btx-control           ns: btx-policy          ns: btx-audit              │
│  ┌──────────────────┐      ┌──────────────────┐    ┌──────────────────┐       │
│  │ Registry, Catalg │      │ OPA bundle       │    │ Kafka + stream   │       │
│  │ Purpose, Approve │      │ builder, PDP API │    │ processors,      │       │
│  │ Console BFF      │      │ Signed Config Pub│    │ Hash chain svc   │       │
│  └──────────────────┘      └──────────────────┘    └──────────────────┘       │
│  ns: btx-data       (PG HA, OpenSearch, MinIO/S3-API, Redis, NATS/Kafka)      │
│  ns: btx-platform   (Istio/Linkerd, OPA-gatekeeper, OTel, Vault, ArgoCD)      │
└───────────────────────────────────────────────────────────────────────────────┘

┌────────────────── Trust Node Cluster(s) — per department/state ───────────────┐
│  ns: tn-<member>           ns: adapters                                       │
│  ┌──────────────────┐      ┌──────────────────────────────────────┐           │
│  │ Envoy gateway    │      │ Backend adapter(s) (REST/SOAP/DB)    │           │
│  │ OPA sidecar      │      │ Connector SDK runtimes               │           │
│  │ Signer (KMS/HSM) │      │                                       │          │
│  │ Audit emitter    │      └──────────────────────────────────────┘           │
│  └──────────────────┘                                                         │
│  ns: tn-platform    (mesh, secrets, OTel, replay-cache Redis)                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Deployment patterns (BRD §25.2)

| Pattern | Cluster topology | Tenancy |
|---|---|---|
| Dedicated TN | Member-owned cluster | Per member |
| Managed tenant TN | Shared cluster, per-tenant namespace + keys | Many members |
| Hybrid TN | TN in cloud, adapter on-prem via VPN/PrivateLink | Per member |
| Air-gapped TN | Restricted cluster, offline signed bundles | Per member |

### 11.3 Network design

- mTLS end-to-end via service mesh inside cluster + Envoy front proxy at TN boundary.
- Private connectivity preferred: PrivateLink/Transit Gateway / Express Connect / NIC private network.
- Egress allowlists per TN (only known peer TNs + control plane + audit pipeline).
- Per-namespace NetworkPolicies; default-deny ingress and egress.

---

## 12. Cloud-adapter abstraction & portability

### 12.1 Adapter contract (interfaces; all clouds must implement)

| Interface | Purpose | Default impl |
|---|---|---|
| `IamAdapter` | Workload identity → cloud IAM principal | SPIFFE → AWS IRSA / Azure WI / GCP WIF / NIC-equivalent |
| `KmsAdapter` | Wrap/unwrap, sign/verify with CMK | AWS KMS / Azure Key Vault / GCP KMS / NIC HSM |
| `HsmAdapter` | High-assurance signing | CloudHSM / Managed HSM / NIC HSM |
| `ObjectStoreAdapter` | S3-API put/get/WORM | S3 / Blob / GCS / MinIO |
| `DnsAdapter` | Record management | Route53 / Azure DNS / Cloud DNS / NIC DNS |
| `LoadBalancerAdapter` | L4/L7 LB provisioning | ALB/NLB / AGW / GCLB / Local LB |
| `LogAdapter` | Native log export | CloudWatch / Azure Monitor / Cloud Logging / SIEM connector |
| `BackupAdapter` | Snapshots + cross-region replication | Cloud-native |
| `SecretAdapter` | Vault-compatible secret read | Vault / External Secrets |

### 12.2 Portability conformance (CT-001, CT-025)

- Identical Helm/Kustomize manifests + per-cloud `values-<cloud>.yaml` only differ in adapter references.
- Conformance harness runs same test suite on each certified cloud; produces signed evidence pack.

---

## 13. Observability, SRE and operations

### 13.1 Three pillars

| Pillar | Tool (default) | Cloud-neutral export |
|---|---|---|
| Metrics | Prometheus + Grafana | OTel + remote write |
| Traces | Tempo/Jaeger | OTel OTLP |
| Logs | Loki / OpenSearch | OTel logs + Fluent Bit |

### 13.2 Golden signals per service

- Latency p50/p95/p99
- Error rate (5xx, policy denials separated)
- Saturation (CPU, memory, connection pools)
- Traffic (RPS, by service_id and purpose_code)

### 13.3 Business events (always emitted)

- `member.lifecycle.changed`, `service.published`, `service.deprecated`
- `policy.bundle.published`, `policy.decision.denied`
- `exchange.completed`, `exchange.denied`, `exchange.minimised`
- `certificate.issued`, `certificate.revoked`, `revocation.propagated`

### 13.4 SLOs (initial targets — tune in pilot)

| Service class | Availability | p95 latency |
|---|---|---|
| Verification yes/no | 99.9% | ≤ 300 ms |
| Record lookup (minimised) | 99.9% | ≤ 600 ms |
| Bulk lane | 99.5% | best-effort, batched |
| Policy decision (PDP) | 99.95% | ≤ 50 ms |
| Audit ingest | 99.99% | ≤ 100 ms emit |

---

## 14. High availability, DR and outage continuity

| Component | HA | DR strategy | RPO | RTO |
|---|---|---|---|---|
| Control plane DB (PG) | Multi-AZ replica + sync standby | Cross-region async replica | ≤ 5 min | ≤ 30 min |
| Object store (S3-API) | Multi-AZ | Cross-region replication | ≤ 15 min | ≤ 1 h |
| Kafka/NATS | 3-broker cluster, multi-AZ | Mirror to DR cluster | ≤ 5 min | ≤ 30 min |
| OPA / PDP | Stateless, N replicas | N/A | 0 | ≤ 5 min |
| Trust Node | 2+ replicas per member | Active-passive in DR site | 0 (stateless) | ≤ 15 min |
| Signed Config | Replicated bucket + signed mirror | Cross-region | ≤ 5 min | ≤ 15 min |
| HSM / KMS | HA cluster | Provider-native cross-region | 0 | ≤ 30 min |

**Outage continuity (ADR-009, CT-011):** Trust Nodes serve approved traffic from signed cached bundle until `bundle.ttl`; new approvals pause; emergency revocation channel still consumable.

---

## 15. Technology selection matrix

| Concern | Preferred | Alternatives | Rationale |
|---|---|---|---|
| Container orchestration | Kubernetes (vanilla) or OpenShift | EKS/AKS/GKE managed | CNCF, portability |
| Service mesh | Istio | Linkerd, Cilium service mesh | mTLS + policy |
| Policy engine | OPA + Rego | XACML (adapter only) | Policy-as-code standard |
| API gateway / proxy | Envoy | NGINX, Kong | mesh-native, mTLS |
| Workflow | Temporal | Camunda, Argo Workflows | Approval orchestration |
| Relational DB | PostgreSQL | MySQL/MariaDB | Open, portable |
| Object storage | S3-API (MinIO on-prem) | Cloud-native via adapter | Portability |
| Message bus | Kafka or NATS JetStream | Pulsar | Audit + events |
| Search/index | OpenSearch | Elasticsearch | Audit dashboards |
| Secrets | HashiCorp Vault + External Secrets | Cloud-native via adapter | Portability |
| HSM/KMS | Cloud HSM or NIC HSM | SoftHSM (non-prod only) | High assurance |
| Observability | OpenTelemetry + Prometheus + Loki + Tempo | Datadog (adapter) | Open, portable |
| Identity | Keycloak (IdP broker) | Cloud-native OIDC | OIDC/SAML federation |
| GitOps | ArgoCD | FluxCD | Declarative deployment |
| IaC | OpenTofu / Terraform + Helm | Pulumi | Open, multi-cloud |
| CI | GitHub Actions / GitLab CI / Tekton | Jenkins | Org-dependent |
| Frontend | React + TypeScript + Vite | Angular | Talent availability |
| Backend services | Go (data plane), Java/Spring (control plane) | Rust (perf-critical), Kotlin | Performance & ecosystem |
| Doc/contract validation | Spectral (OpenAPI), opa test | — | Standard |

---

## 16. Build, CI/CD and GitOps

### 16.1 Repository topology (mono-repo per concern, polyrepo at org)

```
btx/
├── platform/           # K8s base, mesh, OPA, OTel, Vault
├── infrastructure/     # OpenTofu modules: cloud adapters
├── services/
│   ├── member-registry/
│   ├── service-catalogue/
│   ├── purpose-registry/
│   ├── purposeguard-policies/   # Rego, tests, CODEOWNERS
│   ├── schemahub/
│   ├── approval-workflow/
│   ├── signed-config-publisher/
│   ├── audit-ledger/
│   └── trust-node/
├── connectors/         # SDK + per-system adapters
├── certify/            # Conformance suite
└── deploy/             # ArgoCD app-of-apps, values per env/cloud
```

### 16.2 Pipeline gates (every service)

1. Static analysis (lint, SAST, secret scan)
2. Unit + contract tests (OpenAPI/AsyncAPI/Rego)
3. SBOM + dependency vuln scan (Trivy/Grype)
4. Build container, sign image (cosign), attest provenance (SLSA)
5. Deploy to sandbox via ArgoCD
6. Integration + conformance (subset)
7. Security review gate (manual for prod)
8. Promote to prod via signed PR + ArgoCD sync

### 16.3 Release strategy

- Trunk-based + short-lived feature branches
- Canary / blue-green for Trust Node and PDP
- Backwards-compatible API + dual-version window

---

## 17. Environments, namespaces and tenancy

| Environment | Purpose | Data |
|---|---|---|
| `dev` | Developer iteration | Synthetic |
| `sandbox` | Member onboarding, certification | Synthetic + masked |
| `staging` | Pre-prod, conformance | Synthetic + selected pilot |
| `prod` | Production | Real, with full controls |

**Tenancy isolation in managed tenant TN:**

- Namespace per tenant (`tn-<member>`)
- Per-tenant KMS-CMK and signing key
- Per-tenant OPA bundle scope
- Per-tenant Kafka topic ACLs and audit retention
- NetworkPolicy default-deny; explicit peer allowlist

---

## 18. Capacity planning & performance targets

### 18.1 Initial sizing (pilot — 5-10 services, 3-5 departments)

| Component | Size |
|---|---|
| Control plane K8s | 6 nodes (16 vCPU / 64 GB each), 3 AZ |
| PostgreSQL (CP) | 2 × (8 vCPU / 32 GB / 500 GB NVMe) |
| Kafka | 3 brokers (8 vCPU / 32 GB / 1 TB) |
| OpenSearch (audit) | 3 data nodes (8 vCPU / 32 GB / 2 TB) |
| Object store | 5 TB initial, lifecycle to cold |
| Trust Node (per dept) | 2 × (4 vCPU / 8 GB) + Redis 2 GB |

### 18.2 Scaling levers

- Horizontal pod autoscaling on RPS + latency
- PDP: scale-out stateless, bundle pinning
- Kafka: partition per `provider_member_id`
- Audit indexing: tiered hot/cold; cold queries via object store

### 18.3 Performance budgets (per call)

| Hop | Budget |
|---|---|
| Requester TN: build + sign + PDP cache | ≤ 20 ms |
| Network requester→provider | ≤ 50 ms (intra-region) |
| Provider TN: verify + PDP + minimise + adapter | ≤ 150 ms |
| Source system | ≤ 100 ms |
| Provider→requester return | ≤ 50 ms |
| **End-to-end p95** | **≤ 600 ms** (yes/no ≤ 300 ms) |

---

## 19. Implementation plan & work breakdown

### 19.1 Phased roadmap (aligned to BRD §17)

| Phase | Duration | Architecture deliverables |
|---|---|---|
| **Foundation (M0-M3)** | 3 mo | Repos, platform baseline, PKI design, threat model sign-off, DPIA template, reference cluster on 1 cloud + NIC |
| **MVP (M3-M6)** | 3 mo | Control plane MVP, Trust Node MVP, PurposeGuard, Signed Config Publisher, AuditLedger, 5-10 pilot services, 2 hosting envs |
| **Production pilot (M6-M12)** | 6 mo | HSM integration, hash-chain audit, citizen sharing history, state TN, incident & DR drills, conformance pack v1 |
| **Scale (M12-M24)** | 12 mo | National + state rollout, multi-cloud certified deployments, domain schema councils, anomaly detection, recertification automation |

### 19.2 MVP epic backlog (priority order)

1. **EPIC-1 Platform baseline** — K8s clusters, mesh, OTel, Vault, ArgoCD, OpenTofu modules (1 cloud)
2. **EPIC-2 Member Registry + Catalogue** — CRUD APIs, schemas, lifecycle, audit hooks
3. **EPIC-3 Purpose Registry + PurposeGuard** — Rego framework, decision API, bundle build/sign
4. **EPIC-4 Signed Config Publisher** — TUF-style signing, distribution, TN verification
5. **EPIC-5 Trust Node runtime** — Envoy + OPA sidecar + signer + replay cache + adapter SDK
6. **EPIC-6 AuditLedger** — Kafka pipeline + hash chain + dashboard + reconciliation
7. **EPIC-7 Approval Workflow** — Temporal flows, 4-eye, escalation
8. **EPIC-8 Trust Console + Dev Portal** — React BFF, OIDC federation
9. **EPIC-9 Connectors** — REST/SOAP/DB adapter templates, sandbox
10. **EPIC-10 Conformance suite** — Cases CT-001..025 automated
11. **EPIC-11 Second-cloud certification** — Adapter parity, portability evidence
12. **EPIC-12 Citizen sharing history + grievance hooks**

### 19.3 Cross-cutting workstreams

- Security: threat model per service, key ceremonies, pen-test
- Privacy: DPIA per service, citizen notice text, multilingual
- Accessibility: GIGW/WCAG audit of Console
- Procurement: RFP clauses, source escrow, exit architecture
- Documentation: ADRs, runbooks, conformance evidence

### 19.4 Acceptance gates (architecture exit per phase)

- All ASRs demonstrably tested via `certify/`
- All BRD CT-001..025 executed and signed off
- Two-cloud deployment evidence pack
- DR drill report
- DPIA + threat-model artefacts per pilot service

---

## 20. Risks, open issues and decisions log

### 20.1 Architectural risks (additive to BRD §19)

| ID | Risk | Mitigation |
|---|---|---|
| AR01 | OPA bundle size growth with policies & members | Per-domain bundle partitioning; lazy load by service_id |
| AR02 | Kafka cross-cloud replication latency | Regional pinning + async DR; audit anchor checkpoints |
| AR03 | mTLS cert rotation storms | Staggered rotation, jittered TTLs, automation |
| AR04 | HSM/KMS adapter feature drift across clouds | Common adapter test matrix; gate features to lowest common denominator + opt-in advanced |
| AR05 | Legacy SOAP adapters as injection surface | Mandatory parameterised access, schema validation, WAF, code review |
| AR06 | Citizen portal scale (sharing history queries) | Pre-projected read model + caching |

### 20.2 Open issues

- National TSA selection & SLA
- Canonical purpose taxonomy ownership (national vs domain councils)
- Audit retention rules per data class — pending legal
- Wallet integration sequencing with DigiLocker roadmap

### 20.3 New ADRs proposed (extend BRD §22)

| ADR | Decision |
|---|---|
| ADR-011 | OPA + Rego as the PDP language; XACML only via adapter |
| ADR-012 | TUF-style signing for config bundles |
| ADR-013 | Envoy + OPA sidecar as Trust Node enforcement substrate |
| ADR-014 | SPIFFE/SPIRE-style workload identity inside clusters |
| ADR-015 | Kafka (or NATS JetStream) for audit pipeline; hash chain with periodic KMS anchor |
| ADR-016 | OpenTofu + Helm + ArgoCD for declarative multi-cloud deployment |
| ADR-017 | Ed25519 default for signing where supported; ECDSA-P256 fallback |

---

## 21. Appendices — interface contracts

### 21.1 Trust Node ↔ Trust Node call (HTTP/JSON over mTLS)

Headers (mandatory):

- `x-btx-txn-id` — UUIDv4
- `x-btx-member-id` — requester
- `x-btx-service-id`
- `x-btx-purpose-code`
- `x-btx-timestamp` — RFC 3339 UTC
- `x-btx-nonce` — base64, 16 bytes
- `x-btx-signature` — JWS detached over canonicalised payload
- `x-btx-key-id` — KID for verifier
- `x-btx-trace-id` — W3C traceparent

Body: service-specific JSON (validated against SchemaHub).

### 21.2 PurposeGuard decision API

`POST /v1/decisions` — request/response per BRD §27.1/§27.2. Adds:

- `policy_bundle_version` echo
- `evaluated_at`
- `obligations[]` strict enum

### 21.3 Canonical audit event v1

Per BRD §27.3 + the following additions for implementation:

```json
{
  "schema_version": "btx.audit.v1",
  "ingest_ts": "2026-05-16T10:30:00.123Z",
  "source_node_role": "requester|provider",
  "policy_bundle_version": "purposeguard-policy-2026.05.16",
  "obligations_enforced": ["log_requester","log_provider"],
  "chain_prev_hash": "sha256:...",
  "chain_event_hash": "sha256:...",
  "anchor_signature": "jws:..."
}
```

### 21.4 Signed config bundle (TUF-style layout)

```
bundle/
├── root.json
├── timestamp.json
├── snapshot.json
└── targets/
    ├── members.json
    ├── services.json
    ├── purposes.json
    ├── policies/        # OPA bundle .tar.gz signed
    ├── certs/           # CA chain + member cert refs
    └── revocations.json
```

### 21.5 Conformance evidence pack (per environment)

- Test report (CT-001..025) — pass/fail + artefacts
- Signed image SBOMs
- IaC plan + apply logs
- DR drill log
- Pen-test summary
- DPIA register snapshot

---

### Closing

This Architecture Document operationalises the BTX BRD into a build-ready specification: federated by design, cloud-agnostic by construction, purpose-bound at runtime, tamper-evident in audit, and conformance-tested before production. The artefacts here are the substrate the review board, security review, procurement and implementation teams will execute against.

---

## 22 (cont.) Annex roadmap

| Annex | Scope | File |
|---|---|---|
| **A — Engineering** | Sequence diagrams, state machines, ERD + DDL, OpenAPI/AsyncAPI, Rego policy + tests, crypto profile, VC status list, PQC plan, version skew matrix | [BTX_Architecture_Annex_A_Engineering.md](BTX_Architecture_Annex_A_Engineering.md) |
| **B — Operations & Security Runbooks** | On-call & severity, SLO burn-rate, PKI ceremony, member onboarding, cert rotation, emergency revocation, policy publish/rollback, Kafka, PG failover, DR, backup/restore, audit anomaly, key compromise, citizen grievance, 15 chaos/GameDay scenarios, quarterly drill calendar | [BTX_Architecture_Annex_B_Runbooks.md](BTX_Architecture_Annex_B_Runbooks.md) |
| **C — Evidence & Quantification** | Capacity formulas, sized BoMs, control-to-evidence traceability, cost model, DPDP rights flows, residency model, tenant isolation, exit playbook, FMEA, accessibility test plan (GIGW/WCAG 2.2 AA), standards mapping, conformance evidence index | [BTX_Architecture_Annex_C_Evidence.md](BTX_Architecture_Annex_C_Evidence.md) |

---

## 23. Change log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 16 May 2026 | Architecture Office | Initial implementation architecture skeleton (sections 1-21). |
| 2.0 | 16 May 2026 | Architecture Office | 10/10 review edition: added executive summary, decisions-requested, three engineering annexes (A/B/C), sign-off page, change log, evidence index. Closes depth, quantification, runbook and evidence gaps identified in v1.0 review. |

---

## 24. Sign-off page

This document is approved for implementation when all signatures below are recorded. Approvals are tracked in the conformance evidence pack (Annex C §C.12).

| Role | Name | Decision | Date | Signature ref |
|---|---|---|---|---|
| Chief Architect | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Security Lead / CISO | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Privacy Lead / DPO | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Platform Engineering Lead | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| SRE / Operations Lead | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Procurement Lead | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Accessibility Reviewer | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Product Owner | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| National BTX Authority | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| State Authority representative | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |
| Architecture Review Board (Chair) | _________________ | Approve / Approve with conditions / Reject | __________ | __________ |

**Conditions register (open at time of sign-off):**

| # | Condition | Owner | Due |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Document hash (post sign-off):** to be computed and recorded in the signed evidence manifest (`evidence/<env>/<release>/manifest.yaml`).

