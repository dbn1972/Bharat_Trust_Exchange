# Secure SDLC

> Security-engineering practices applied through the BTX software development lifecycle. Pairs with the Security Architecture (Arch Doc §6), Crypto Profile (Annex A §A.8) and Runbooks (Annex B).

## 1. Principles

- **Shift left:** find issues at design and PR time, not in production.
- **Fail closed:** insecure default is to refuse, not to allow.
- **Defence in depth:** no single control is solely responsible for any property.
- **Provable, not promised:** every control has an automated test or recorded drill.

## 2. Lifecycle stages

| Stage | Activity | Output |
|---|---|---|
| Design | Threat model (LINDDUN if privacy-sensitive) | `threat-models/<svc>.md` |
| Design | DPIA when personal data flows | `dpia/<svc>.md` |
| Design | ADR for any control change | `docs/adr/NNNN-…` |
| Code | Pre-commit hooks (lint, secret-scan, license-check) | local gate |
| Code | Signed commits, signed tags | enforced in CI |
| PR | SAST (semgrep), dep-scan (Trivy/Grype), SBOM (Syft) | CI artefact |
| PR | Policy tests (`opa test`) and contract tests | CI gate |
| PR | CODEOWNERS approvals (security/privacy for sensitive paths) | merge block |
| Build | Reproducible builds, pinned base images | artefact |
| Build | Cosign image signing, in-toto attestations (SLSA L3 target) | provenance |
| Deploy | Admission control: only signed images, pinned digests | OPA Gatekeeper |
| Deploy | Network policies default-deny | manifests |
| Deploy | Secrets via Vault / External Secrets only | runtime |
| Run | mTLS, JWS signing, replay protection, PDP, audit | per-request |
| Run | OpenTelemetry + SIEM export | continuous |
| Run | Vulnerability monitoring (image, dep, OS) | dashboards |
| Respond | Incident playbooks (Annex B §B.1, B.13) | runbooks |
| Improve | Quarterly drills (B.16), pen-tests, red team | evidence pack |

## 3. CI security gates (blocking)

| Gate | Tool | Pass condition |
|---|---|---|
| Secret scan | gitleaks / trufflehog | 0 findings |
| SAST | semgrep | 0 critical, 0 high |
| Dep scan | Trivy / Grype | 0 critical, 0 high w/o approved exception |
| SBOM | Syft | generated, signed |
| Image scan | Trivy | 0 critical |
| License scan | scancode / FOSSology | only approved licenses |
| Policy tests | `opa test` | 100% pass, coverage ≥ 80% |
| Contract tests | spectral / oasdiff | no unintentional breaking change |
| IaC scan | tfsec / checkov | 0 high |
| Container hardening | dockle | acceptable score |

## 4. Identity & access

- Workload identity: SPIFFE/SPIRE (ADR-014). No long-lived service tokens.
- Human access: OIDC federated to department IdPs; MFA required.
- Privileged actions: 4-eye approval; reason codes; auditable.
- Joiner-Mover-Leaver: monthly access review; offboarding within 24 h.

## 5. Cryptography

- All keys: per-member, HSM/KMS-backed in production.
- Defaults: Ed25519 for signing (ADR-017); TLS 1.3; AES-256-GCM at rest.
- No new algorithm without an entry in the crypto profile and an ADR.
- PQC migration plan: Annex A §A.10.

## 6. Supply chain

- Pinned base images by digest.
- Approved dependency list maintained in `docs/security/dependency-policy.md`.
- SLSA L3 attestations on built images; verified at admission.
- Source escrow clauses in vendor agreements (per BRD §21).

## 7. Vulnerability management

| Severity | SLA to fix |
|---|---|
| Critical | 7 days |
| High | 30 days |
| Medium | 90 days |
| Low | next release |

- Exceptions registered in `docs/security/exceptions.md` with expiry.
- Auto-PR for dependency updates (Renovate / Dependabot).

## 8. Logging & monitoring

- Structured JSON logs with `trace_id`, `txn_id`, `member_id`.
- No PII or secrets in logs / metrics / trace attributes.
- SIEM export from `btx.audit.v1`, security events and anomaly signals.
- Detection rules: failed mTLS, expired cert use, replay attempts, bulk anomalies, BOLA attempts, policy bypass attempts.

## 9. Incident response

- Severity matrix (Annex B §B.1.2).
- Runbooks: emergency revocation (B.6), key compromise (B.13), audit anomaly (B.12).
- Forensics: immutable audit + WORM; chain-of-custody preserved.
- Customer / regulator notification per DPDP requirements.

## 10. Privacy by design

- Default minimisation (provider-side, ADR-007).
- DPIA gate for personal data services (CT-018).
- Citizen visibility and grievance (Annex C §C.5).
- Data class drives storage, retention, access path (Arch Doc §5.3).

## 11. Third-party / vendor

- Mandatory questionnaire: SOC 2 / ISO 27001, vuln SLA, sub-processors.
- Open-source preference + source escrow (BRD §21).
- Vendor exit plan documented and tested.

## 12. Training

- Annual secure-coding training for engineers.
- Annual privacy training (DPDP) for engineers and stewards.
- Quarterly tabletop exercise for on-call.

## 13. Metrics

| Metric | Target |
|---|---|
| Mean time to patch (critical) | ≤ 7 d |
| % images signed with SLSA L3 provenance | 100% |
| % services with current threat model | 100% |
| % personal-data services with current DPIA | 100% |
| Policy test coverage | ≥ 80% |
| Audit-chain integrity rate | 100% |
| Cert hygiene (cert expired in prod) | 0 |

## 14. References

- BRD §14 Security Architecture, §21 Procurement guardrails, §31 Standards
- Architecture Doc §6, §7, §16
- Annex A §A.6 (Rego), §A.8 (crypto), §A.10 (PQC)
- Annex B §B.1, §B.3, §B.6, §B.13, §B.16
- Annex C §C.3, §C.9 FMEA, §C.11 standards mapping
- NIST SP 800-207 (Zero Trust)
- OWASP API Security Top 10 (2023)
- ISO/IEC 27001 / 27701
- SLSA framework
