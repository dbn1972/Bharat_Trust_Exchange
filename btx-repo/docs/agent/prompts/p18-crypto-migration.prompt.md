---
id: P-18
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@security-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SURFACES, type: "list[request|response|bundle|audit-anchor|tls]", required: true }
  - { name: FROM, type: alg-suite, required: true }
  - { name: TO, type: alg-suite, required: true }
  - { name: DRIVER, type: text, required: true }
  - { name: WINDOW, type: date-range, required: true }
  - { name: MEMBERS, type: "enum[all|class]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[crypto] <FROM> -> <TO>" }
  - { kind: adr, glob: "docs/adr/00*.md" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_A_Engineering.md", "docs/adr/0017-ed25519-default-signing.md"]
executable_acceptance:
  - { name: verifier-first, cmd: "tools/crypto-rollout-state", pass_when: "100% of verifiers accept TO before any producer enabled" }
  - { name: kid-discipline, cmd: "tools/kid-presence-check", pass_when: "every signed artefact carries kid + alg-suite" }
  - { name: ct-crypto, cmd: "make certify CT=CT-002,CT-016,CT-024", pass_when: "exit 0 on both suites" }
  - { name: hsm-ceremony, cmd: "test -f evidence/hsm-ceremony/<TAG>.md", pass_when: "ceremony evidence stored with 4-eye approvals" }
halt_conditions:
  - "new-suite producers enabled before universal new-suite verification"
  - "old keys deleted before retention boundary"
  - "no ADR for the migration"
escalation: { to: "@security-lead, @platform-lead, @audit-lead", channel: "#btx-crypto" }
graph: { upstream: [P-10], downstream: [P-08, P-12] }
---

# P-18 — Crypto / algorithm migration (incl. PQC)

> Use to change a signing/encryption algorithm under the platform's algorithm-agility regime (ADR-017, Annex A §A.10).

---

You are Claude Code performing a cryptographic migration. Crypto changes touch identity, integrity and audit — proceed deliberately.

## 0. Read first

- Annex A §A.8 (crypto profile), §A.10 (PQC plan)
- ADR-017 (Ed25519 default), and any superseding ADR
- BRD §14, §31 (standards)

## 1. Inputs

| Input | Value |
|---|---|
| Surfaces | request signing / response signing / bundle signing / audit anchor / TLS |
| From → To | e.g. `ECDSA-P256` → `Ed25519`, or hybrid PQC suite |
| Driver | policy, performance, mandate, vulnerability |
| Rollout window | `<<DATES>>` |
| Members in scope | all / by class |

## 2. Execute

1. **ADR** open or update an ADR (P-10) for the migration; capture the date, suites involved, rollback plan.
2. **`kid` & alg metadata** ensure every signed artefact (request, response, bundle, anchor) carries `kid` and an algorithm suite identifier. If not, add it first (separate PR).
3. **Verifier-first** roll out verification of the new suite to all consumers **before** issuing any artefact in the new suite. Verifiers continue to accept the old suite throughout.
4. **Producers** introduce signing with the new suite behind a feature flag and a member-allow-list. Canary: 1 member, then 10%, then 100%.
5. **Audit anchors** when ready, switch the audit anchor signer; previous anchors remain verifiable with the prior key (the audit chain spans both).
6. **Bundle signing** TUF role rotation (ADR-012) with HSM ceremony (Annex B §B.3).
7. **Tests**
   - Unit on the signer/verifier libraries.
   - Conformance: CT-002 (request integrity), CT-016 (anchor verifiability), CT-024 (KMS rotation) green on both suites.
   - Negative: artefacts signed with retired suite are rejected once retirement date passes.
8. **Sunset** publish retirement date for the old suite; remove producers; keep verifiers until the audit retention window guarantees no old-suite artefacts remain queryable.

## 3. Hard rules

- Never enable new-suite signing before universal new-suite verification.
- Never delete old keys before the retention boundary.
- Never roll out without an HSM ceremony script and 4-eye approvals (Annex B §B.3).
- Never skip the `kid` discipline — every artefact carries the key identifier.

## 4. Acceptance

- [ ] ADR present and approved.
- [ ] Verifier rollout complete before any producer enabled.
- [ ] Canary plan executed in stages.
- [ ] Tests cover happy + retired-suite-rejection paths.
- [ ] HSM ceremony evidence stored.
- [ ] Sunset date published; producers removed at sunset.
- [ ] CODEOWNERS approvals: `@security-lead`, `@platform-lead`, `@audit-lead`.

## 5. Worked example

See [`_examples/p18.md`](./_examples/p18.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
