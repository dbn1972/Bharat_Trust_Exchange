---
id: P-21
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@design-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SCOPE, type: "enum[core|semantic|surface]", required: true }
  - { name: SURFACE, type: "enum[citizen-wallet|operator-console|member-portal|public-portal|consent-ui|auditor-dashboard|all]", required: true }
  - { name: CHANGE, type: "enum[add|update|deprecate]", required: true }
  - { name: TOKEN_IDS, type: list, required: true }
  - { name: RATIONALE, type: sentence, required: true }
forbidden_paths: ["docs/design/CHANGELOG-design.md@archived-rows"]
expected_outputs:
  - { kind: pr, title_pattern: "[design-system] <SCOPE>/<SURFACE> <CHANGE> <TOKEN_IDS[0]>..." }
  - { kind: files_modified, glob: "docs/design/tokens/**" }
  - { kind: files_modified, glob: "docs/design/components/**" }
  - { kind: files_modified, glob: "docs/design/CHANGELOG-design.md" }
  - { kind: files_modified, glob: "build/**" }
context_budget:
  read_in_full: ["docs/design/README.md", "docs/design/design-system.md", "docs/design/a11y.md"]
  skim: ["docs/design/ux-principles.md", "docs/design/content-style-guide.md"]
executable_acceptance:
  - { name: tokens-schema, cmd: "tools/tokens-validate docs/design/tokens/", pass_when: "W3C Design Tokens schema OK; no orphan references; no cycles" }
  - { name: tokens-a11y, cmd: "tools/tokens-a11y-check docs/design/tokens/", pass_when: "all canonical fg/bg pairings >= 4.5:1 body / 3:1 large + non-text; focus border >= 3:1" }
  - { name: tokens-build, cmd: "make tokens-build", pass_when: "css/tailwind/android/ios/figma artefacts emitted; no diffs after re-run (deterministic)" }
  - { name: figma-export, cmd: "tools/figma-tokens-export --check", pass_when: "tokens.json identical to Tokens Studio import; semver bump correct" }
  - { name: components-spec, cmd: "tools/component-spec-validate docs/design/components/", pass_when: "every component has props/states/variants/slots/a11y/content/telemetry/do-dont/status" }
  - { name: changelog, cmd: "tools/design-changelog-check", pass_when: "every non-patch change has a CHANGELOG-design.md entry with migration notes" }
halt_conditions:
  - "breaking change without major bump + migration note"
  - "any contrast pairing fails AA"
  - "raw hex / px introduced in a component spec or surface file"
  - "deprecation without `superseded_by`"
escalation: { to: "@design-lead, @a11y-lead", channel: "#btx-design" }
graph: { upstream: [P-10], downstream: [P-22, P-23, P-24] }
---

# P-21 — Design system & tokens (Figma + code)

> Use to add, change or deprecate design tokens, or to graduate a component from `proposed` to `active`. This is the *only* place values enter the system; Figma and code both consume the result.

---

## 0. Read first

- [docs/design/README.md](../../design/README.md)
- [docs/design/design-system.md](../../design/design-system.md) — naming, layering, versioning, contract
- [docs/design/a11y.md](../../design/a11y.md) — contrast targets, focus rules
- [docs/design/ux-principles.md](../../design/ux-principles.md) — when to coin a new semantic vs reuse

## 1. Inputs

```yaml
SCOPE: <core | semantic | surface>
SURFACE: <citizen-wallet | operator-console | member-portal | public-portal | consent-ui | auditor-dashboard | all>
CHANGE: <add | update | deprecate>
TOKEN_IDS:
  - <e.g. color.consent.minimised.bg>
RATIONALE: <one sentence, links to UX principle / DPIA / a11y requirement>
```

## 2. Plan, then execute

1. **Resolve up the layers.** If the new value belongs in `semantic`, do not add it directly to a surface. If in `core`, do not add it to `semantic`.
2. **Reference, don't duplicate.** New surface tokens reference semantic; new semantic reference core. Cycles are forbidden.
3. **Coin a clear name.** `category.subcategory.role.state` — verb-free, intent-led.
4. **Add Figma + code at once.** Update `tokens/*.json` (single source). Run `make tokens-build` to emit Figma, CSS, Tailwind, Android, iOS artefacts.
5. **Update or add a component spec** if any component now needs the new token.
6. **Add a `CHANGELOG-design.md` row.** Note semver bump (`patch | minor | major`), migration if applicable.
7. **Deprecation** — set `"$status": "deprecated"`, `"$superseded_by": "..."`, leave value intact until next major.

## 3. Hard rules

- **No raw values** ever — even in surface tokens. Surface tokens reference semantic.
- **AA contrast or refuse.** Use `tools/tokens-a11y-check`. Focus border ≥ 3:1 on both canvas and raised surfaces.
- **No tokens for one-off screens.** If you cannot justify ≥ 2 reuses, you are coining a component prop, not a token.
- **Major bump** for any rename or removal. Minor for additions. Patch only for in-tolerance value tweaks.
- **Figma and code must agree.** The `tokens.json` artefact emitted by build is what Figma's Tokens Studio imports. Drift is a CI failure.

## 4. Acceptance (self-check before opening the PR)

- [ ] `tools/tokens-validate docs/design/tokens/` exit 0.
- [ ] `tools/tokens-a11y-check docs/design/tokens/` exit 0.
- [ ] `make tokens-build` deterministic (re-run produces no diff).
- [ ] `tools/figma-tokens-export --check` exit 0 (Figma will see the same JSON).
- [ ] `tools/component-spec-validate docs/design/components/` exit 0.
- [ ] `CHANGELOG-design.md` updated with semver bump + migration if applicable.
- [ ] Components or surfaces using the new/changed token updated in the same PR.
- [ ] No anti-pattern from [`docs/design/ux-principles.md`](../../design/ux-principles.md) §9.
- [ ] CODEOWNERS approvals: `@design-lead`, `@a11y-lead` (and `@privacy-lead` if any consent/revoke token changes).

## 5. Worked example

See [`_examples/p21.md`](./_examples/p21.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
