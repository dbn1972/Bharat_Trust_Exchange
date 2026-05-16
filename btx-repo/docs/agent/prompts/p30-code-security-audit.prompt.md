---
id: P-30
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@security-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: AUDIT_ID, type: "pattern[SEC-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,    type: "enum[control-plane|trust-node|connector|cloud-adapter|crypto|policy-bundle|all]", required: true }
  - { name: REF,      type: "pattern[v\\d+\\.\\d+\\.\\d+(-\\w+)?|main@[0-9a-f]{7,40}]", required: true }
forbidden_paths: ["evidence/secrets/**"]
expected_outputs:
  - { kind: file_created, path: "audits/<AUDIT_ID>/security-report.md" }
  - { kind: file_created, path: "audits/<AUDIT_ID>/findings.yaml" }
  - { kind: file_created, path: "audits/<AUDIT_ID>/sbom.json" }
  - { kind: file_created, path: "evidence/audits/<AUDIT_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/security/threat-model.md", "docs/security/secure-coding.md", "docs/agent/prompts/p09-threat-model-dpia.prompt.md"]
  skim: ["services/**", "policy/**", "infra/**", ".github/workflows/**"]
executable_acceptance:
  - { name: sast,            cmd: "tools/sast-scan --ref <REF> --scope <SCOPE>", pass_when: "no Critical; High count recorded; results in audits/<AUDIT_ID>/sast.json" }
  - { name: secret-scan,     cmd: "tools/secret-scan --ref <REF>", pass_when: "exit 0; any match → masked in report" }
  - { name: dep-scan,        cmd: "tools/dep-scan --ref <REF>", pass_when: "no Critical vuln; SBOM written" }
  - { name: iac-scan,        cmd: "tools/iac-scan infra/", pass_when: "no Critical misconfig (open ports, root containers, public buckets)" }
  - { name: policy-deny-tests, cmd: "opa test policy/", pass_when: "every Rego rule has a deny-test; all pass" }
  - { name: findings-shape,  cmd: "tools/findings-yaml-check audits/<AUDIT_ID>/findings.yaml", pass_when: "each finding: id, owasp/cwe, severity, confidence, file, fix, verify" }
  - { name: ai-code-review,  cmd: "tools/ai-code-risk-scan --ref <REF>", pass_when: "no hallucinated security helper; no fake-check pattern" }
  - { name: evidence-pack,   cmd: "cosign verify-blob --signature evidence/audits/<AUDIT_ID>.tar.gz.sig evidence/audits/<AUDIT_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any Critical SAST finding"
  - "any leaked secret detected"
  - "any Critical IaC misconfig (privileged container, public bucket, open mgmt port)"
  - "any policy rule more permissive than BRD (silent permission expansion)"
  - "any hardcoded crypto key or weak algorithm (MD5/SHA1/3DES/RSA<2048)"
escalation: { to: "@security-lead, @ciso, @architect", channel: "#btx-security" }
graph: { upstream: [P-27], downstream: [P-28, P-12] }
---

# P-30 — Code-level security audit (OWASP / API / ASVS / CWE)

> Repo-level deep security review. Complements P-09 (design-time STRIDE/DPIA). Output is a severity-ranked findings register + signed SBOM + remediation roadmap.

## 0. Read first

- [docs/security/threat-model.md](../../security/threat-model.md)
- [docs/security/secure-coding.md](../../security/secure-coding.md)
- [P-09 threat model + DPIA](./p09-threat-model-dpia.prompt.md)
- P-27 drift register (upstream)

## 1. Inputs

```yaml
AUDIT_ID: SEC-2026-05-16
SCOPE: control-plane
REF: v0.7.0-beta.3
```

## 2. Plan, then execute

1. **Stack discovery.** Identify languages, frameworks, DBs, auth model, deployment shape, dependency ecosystem, secrets store.
2. **Static analysis** — run SAST against `REF`; capture JSON results.
3. **Secret scan** — repo + git history + CI artefacts; **mask any values** found.
4. **Dependency + supply-chain** — produce `sbom.json` (CycloneDX); flag known CVEs, unpinned deps, suspicious postinstall scripts.
5. **IaC + container** — Dockerfiles, Helm, Terraform — privileged containers, root users, open ports, public storage, weak IAM.
6. **Policy bundle** — every Rego rule has a deny-test; check for silent permission expansion vs BRD.
7. **AI-generated-code risks** — hallucinated security helpers, fake checks, "looks-right" auth/permission logic, copy-pasted unsafe patterns.
8. **Code-flow review** for every vulnerability class below (citing file + line for each finding).
9. **API route security matrix** — every endpoint: auth-required, role-check, input-validation, rate-limit, risk.
10. **Remediation roadmap** — 0-7d / 7-30d / 30-60d / 60-90d.
11. **Verdict** — Ready / Ready with conditions / Not ready. Sign evidence pack.

### Vulnerability classes to review (every class, every time)

Authentication · Authorization · Injection (SQL/NoSQL/cmd/LDAP/template) · XSS · CSRF / cookie / headers · API security · File upload · Secrets · Cryptography · Dependencies · Logging / monitoring · Business logic · Infra / deploy · AI-generated patterns.

## 3. Hard rules

- **No exploit payloads.** PoCs must be safe and minimal.
- **Mask all secrets** in the report; never inline secret values.
- **Do not modify code** unless explicitly authorised; provide secure-code examples separately in the report.
- **Every finding cites real code** (file path + line range + function/route). No generic advice rows.
- **No "needs verification" without naming the missing evidence.**
- **Silent permission expansion = Critical** (policy more permissive than BRD).

## 4. Acceptance

- [ ] All `tools/*-scan`, `opa test`, `tools/findings-yaml-check`, `tools/ai-code-risk-scan` exit 0.
- [ ] SBOM produced and signed.
- [ ] No Critical open (or risk-acceptance signed by CISO).
- [ ] API route security matrix complete.
- [ ] Remediation roadmap recorded.
- [ ] Verdict + evidence pack signed.
- [ ] CODEOWNERS: `@security-lead`, `@ciso`, `@architect`.

## 5. Worked example

See [`_examples/p30.md`](./_examples/p30.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the audit if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
