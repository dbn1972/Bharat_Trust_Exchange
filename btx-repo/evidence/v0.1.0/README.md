# Evidence Pack — v0.1.0

> Assembled per BTX Release Engineering (P-12) for production promotion gate.
> Artefacts must be verified with Cosign before production deployment.

## Release Metadata

| Field | Value |
|---|---|
| Version | v0.1.0 |
| Date | 2026-05-17 |
| Branch | `agent/autonomous-phase-1` |
| SHA | (filled by CI) |
| Release Engineer | @sre-lead |
| Status | **draft** — pending cloud conformance sign-off |

---

## Artefact Checklist

### Images (ghcr.io)

| Service | Image | Digest | Signed |
|---|---|---|---|
| control-plane | `ghcr.io/btx/btx-control-plane:v0.1.0` | (CI-filled) | ☐ |
| registry | `ghcr.io/btx/btx-registry:v0.1.0` | (CI-filled) | ☐ |
| trust-node | `ghcr.io/btx/btx-trust-node:v0.1.0` | (CI-filled) | ☐ |

Verify image signatures:
```bash
cosign verify ghcr.io/btx/btx-control-plane:v0.1.0 \
  --certificate-identity-regexp="https://github.com/btx/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

---

### SBOMs

| File | Format | Tool |
|---|---|---|
| `sbom-control-plane-spdx.json` | SPDX JSON | Syft |
| `sbom-control-plane-cyclonedx.json` | CycloneDX JSON | Syft |
| `sbom-registry-spdx.json` | SPDX JSON | Syft |
| `sbom-registry-cyclonedx.json` | CycloneDX JSON | Syft |
| `sbom-trust-node-spdx.json` | SPDX JSON | Syft |
| `sbom-trust-node-cyclonedx.json` | CycloneDX JSON | Syft |

---

### Conformance Reports

| File | Cloud | Tests | Pass | Fail |
|---|---|---|---|---|
| `stub-conformance-report.json` | Stub | 25 | (CI-filled) | (CI-filled) |
| `aws-conformance-report.json` | AWS | 9 | (cloud cert run) | — |
| `gcp-conformance-report.json` | GCP | 8 | (cloud cert run) | — |
| `azure-conformance-report.json` | Azure | 8 | (cloud cert run) | — |

---

### Policy Bundle

| File | Description |
|---|---|
| `bundle.tar.gz` | OPA policy bundle (all .rego files) |
| `bundle.tar.gz.sig` | Cosign signature (keyless) |

Verify policy bundle:
```bash
cosign verify-blob bundle.tar.gz \
  --bundle bundle.tar.gz.sig \
  --certificate-identity-regexp="https://github.com/btx/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

---

### Security & Privacy Artefacts

| File | Status | Approved By |
|---|---|---|
| `consent-service.md` (threat model) | draft | _pending_ |
| `consent-service.md` (DPIA) | draft | _pending_ |

---

### Change Log

| Module | Version | Changes |
|---|---|---|
| control-plane | v0.1.0 | Initial release: consent grant/revoke/query, outbox publisher |
| registry | v0.1.0 | Initial release: trust node registration, heartbeat, list |
| trust-node | v0.1.0 | Initial release: federation sync, Merkle root verification |

---

### MANIFEST.txt

```
bundle.tar.gz
bundle.tar.gz.sig
consent-service.md (dpia)
consent-service.md (threat-model)
image-digests.txt
MANIFEST.txt
MANIFEST.txt.sig
sbom-control-plane-cyclonedx.json
sbom-control-plane-spdx.json
sbom-registry-cyclonedx.json
sbom-registry-spdx.json
sbom-trust-node-cyclonedx.json
sbom-trust-node-spdx.json
stub-conformance-report.json
```

---

## Promotion Gates

Before production promotion (per ADR-0010):

- [ ] CT-001..025 all green (stub cloud minimum; AWS/GCP/Azure for prod)
- [ ] All image signatures verified via Cosign
- [ ] SBOM reviewed for known HIGH/CRITICAL CVEs
- [ ] Policy bundle signature verified
- [ ] DPIA CT-018 green (DPIA approved)
- [ ] Threat model approved (dual sign-off)
- [ ] MANIFEST.txt signature verified
- [ ] SRE sign-off on deployment runbook
- [ ] Incident response playbooks current
