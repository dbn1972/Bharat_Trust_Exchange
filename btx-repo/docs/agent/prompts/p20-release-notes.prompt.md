---
id: P-20
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@release-manager"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: TAG, type: "semver[vX.Y.Z]", required: true }
  - { name: BASE, type: "semver[vX.Y.Z]", required: true }
  - { name: EVIDENCE_PATH, type: filepath, required: true }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "release-notes/<TAG>.md" }
  - { kind: file_created, path: "release-notes/<TAG>-public.md" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_C_Evidence.md"]
  skim: ["docs/adr/README.md"]
executable_acceptance:
  - { name: sections-present, cmd: "tools/release-notes-validate release-notes/<TAG>.md", pass_when: "all 15 sections present" }
  - { name: public-sanitised, cmd: "tools/pii-internal-scan release-notes/<TAG>-public.md", pass_when: "0 internal hostnames/IPs/secret paths" }
  - { name: traceability, cmd: "tools/release-trace release-notes/<TAG>.md", pass_when: "every claim links to PR/ADR/CT/ticket" }
  - { name: evidence-verifiable, cmd: "cosign verify-blob --signature <EVIDENCE_PATH>/pack.sig <EVIDENCE_PATH>/pack.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "marketing language in either variant"
  - "missing standards traceability table"
  - "public variant leaks internal detail"
escalation: { to: "@release-manager, @comms", channel: "#btx-releases" }
graph: { upstream: [P-12], downstream: [] }
---

# P-20 — Generate release notes & evidence pack summary

> Use to produce auditor-grade release notes from merged PRs, ADRs and the signed evidence pack.

---

You are Claude Code producing release notes. The audience is operators, security reviewers, privacy reviewers and the public. Be precise, sectioned, and reference evidence.

## 0. Read first

- Annex C §C.12 (evidence pack format)
- The release tag scope (merged PRs, new ADRs, conformance reports)
- BRD §31 (standards mapping for traceability)

## 1. Inputs

| Input | Value |
|---|---|
| Release tag | `vX.Y.Z` |
| Compare base | `vX.Y.(Z-1)` or chosen base |
| Evidence pack path | `evidence/vX.Y.Z/` |

## 2. Execute

Produce `release-notes/vX.Y.Z.md` with the following sections:

1. **Summary** — one paragraph: what changed and why.
2. **Highlights** — 3–7 bullets, plain language.
3. **Architectural changes** — list ADRs accepted or superseded in this release with links.
4. **Service changes** — per-service bullets (link to PRs and CHANGELOG entries).
5. **Policy changes** — Rego changes with rule-level summary; impact on decisions/obligations.
6. **API changes** — OpenAPI/AsyncAPI diffs; mark breaking vs additive; migration notes.
7. **Security** — fixed CVEs, new controls, new detection rules; link advisories.
8. **Privacy** — new/changed DPIAs; notice text changes; retention or minimisation changes.
9. **Operability** — new runbooks, new alerts, new drills; deprecated procedures.
10. **Performance & capacity** — SLO impacts; sizing changes (link Annex C §C.1).
11. **Cloud matrix** — clouds tested; per-cloud conformance status.
12. **Evidence** — link the signed evidence pack; one-line "how to verify" with `cosign verify-blob` example.
13. **Standards traceability** — table mapping notable changes to standards (NIST, OWASP, ISO, W3C, DPDP).
14. **Known issues & deferred** — items not delivered; their tickets and target release.
15. **Upgrade & rollback** — concrete operator steps; references to runbooks.

Also produce `release-notes/vX.Y.Z-public.md` — a citizen-friendly variant (no internal jargon, no internal links).

## 3. Hard rules

- Every statement traceable to a PR, ADR, ticket or CT report. No hand-wavy claims.
- No marketing language. Plain, precise, dated.
- No sensitive operational detail (host names, internal IPs, secrets paths) in the public variant.
- Internal and public variants both signed and archived.

## 4. Acceptance

- [ ] All sections filled.
- [ ] Public variant produced and sanitised.
- [ ] Standards traceability table present.
- [ ] Evidence pack linked with verification instructions.
- [ ] Upgrade and rollback steps reference runbooks.
- [ ] CODEOWNERS approvals: `@release-manager`, `@security-lead`, `@privacy-lead`, `@comms`.

## 5. Worked example

See [`_examples/p20.md`](./_examples/p20.md).

## 6. Self-score

Before publishing the notes, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the release record. **Do not publish if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
