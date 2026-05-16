# Design → Development Prompts

> A curated, versioned library of prompts that turn the BTX design corpus (BRD + Architecture Document + Annexes A/B/C + ADRs + templates) into executable build tasks for Claude Code (or any capable coding agent).
>
> **How to use**
> 1. Pick the prompt that matches your task.
> 2. Fill the `<<…>>` placeholders.
> 3. Paste into Claude Code with the repo open. The system prompt in [`../../CLAUDE.md`](../../CLAUDE.md) and [`../../AGENTS.md`](../../AGENTS.md) is already loaded by the workspace.
> 4. Review the produced PR against the **Acceptance** block of the prompt.
>
> **Conventions**
> - `<<UPPER_SNAKE>>` = required value
> - `[[optional]]` = optional value
> - Every prompt ends with an explicit **Acceptance** block — the agent must satisfy each item.
> - Every prompt forces the agent to read the relevant design sources first (no guessing).
> - Every prompt forbids inventing architecture; deviations require an ADR.

## Index

| # | Prompt | When to use |
|---|---|---|
| P-01 | [Bootstrap service skeleton](p01-bootstrap-service.prompt.md) | New service in `services/` |
| P-02 | [Add control-plane API](p02-add-control-plane-api.prompt.md) | New endpoint on an existing control-plane service |
| P-03 | [Implement Trust Node feature](p03-trust-node-feature.prompt.md) | New behaviour in the data-plane Trust Node |
| P-04 | [Author Rego policy + tests](p04-rego-policy.prompt.md) | PurposeGuard policy change |
| P-05 | [Build connector / source adapter](p05-build-connector.prompt.md) | New department source-system integration |
| P-06 | [Wire audit emission](p06-audit-emission.prompt.md) | Add an audit event to a code path |
| P-07 | [Add cloud adapter](p07-cloud-adapter.prompt.md) | New certified cloud or new adapter capability |
| P-08 | [Add conformance test (CT-NNN)](p08-conformance-test.prompt.md) | Implement / extend a CT-001..025 test |
| P-09 | [Threat model + DPIA](p09-threat-model-dpia.prompt.md) | Pre-build privacy/security review |
| P-10 | [Author ADR](p10-author-adr.prompt.md) | Architectural decision change |
| P-11 | [Write runbook + drill](p11-runbook-drill.prompt.md) | New operational procedure / chaos scenario |
| P-12 | [Release engineering (signed, attested)](p12-release-engineering.prompt.md) | Cut a release |
| P-13 | [Incident response](p13-incident-response.prompt.md) | Drive an active incident |
| P-14 | [Refactor for portability (de-lock-in)](p14-portability-refactor.prompt.md) | Remove cloud lock-in |
| P-15 | [Performance & capacity tuning](p15-perf-capacity.prompt.md) | Hit SLO targets |
| P-16 | [Code review (architecture-conformant)](p16-code-review.prompt.md) | Review a PR end-to-end |
| P-17 | [Spec → code (from a tech spec)](p17-spec-to-code.prompt.md) | Turn an approved tech spec into a PR series |
| P-18 | [Migrate algorithm / crypto (incl. PQC)](p18-crypto-migration.prompt.md) | Algorithm agility change |
| P-19 | [Backfill missing tests for a service](p19-test-backfill.prompt.md) | Coverage / mutation gaps |
| P-20 | [Generate release notes & evidence pack](p20-release-notes.prompt.md) | Post-build paperwork |

## Authoring rules for new prompts

A good BTX prompt:

1. **States the role and constraints first** ("You are working in the BTX repo. Read `AGENTS.md` and `CLAUDE.md` before doing anything.").
2. **Names the design sources** the agent must read before writing code (with section anchors).
3. **Lists inputs** explicitly.
4. **Forbids invention** — deviation triggers ADR/RFC, not silent change.
5. **Specifies outputs**: files touched, tests added, evidence emitted.
6. **Ends with an Acceptance block** the agent must self-check.
7. **Is short enough to paste** (target ≤ 200 lines).
