---
id: P-24
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@design-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SURFACE, type: "enum[citizen-wallet|operator-console|member-portal|public-portal|consent-ui|auditor-dashboard]", required: true }
  - { name: FEATURE, type: kebab-case, required: true }
  - { name: FIGMA_URL, type: url, required: true }
  - { name: FIGMA_VERSION, type: string, required: true }
  - { name: TARGET, type: "enum[react+tailwind|react-native+nativewind|kotlin-compose|swift-ui]", required: true }
forbidden_paths: ["docs/design/tokens/**"]   # tokens come from P-21, not from handoff
expected_outputs:
  - { kind: file_created, path: "docs/design/handoff/<SURFACE>/<FEATURE>.md" }
  - { kind: files_created, glob: "apps/<SURFACE>/src/features/<FEATURE>/**" }
  - { kind: files_created, glob: "apps/<SURFACE>/src/features/<FEATURE>/**.stories.{ts,tsx}" }
  - { kind: files_created, glob: "apps/<SURFACE>/e2e/<FEATURE>.spec.ts" }
context_budget:
  read_in_full: ["docs/design/handoff-spec-template.md", "docs/design/design-system.md", "docs/design/a11y.md"]
  skim: ["docs/design/surfaces/<SURFACE>/<FEATURE>/interaction-spec.md", "apps/<SURFACE>/README.md"]
executable_acceptance:
  - { name: figma-version-pinned, cmd: "grep -q '<FIGMA_VERSION>' docs/design/handoff/<SURFACE>/<FEATURE>.md", pass_when: "handoff pins the exact Figma file version hash" }
  - { name: no-raw-style, cmd: "tools/no-raw-style-check apps/<SURFACE>/src/features/<FEATURE>", pass_when: "0 raw hex / px / inline styles; every value flows from token preset" }
  - { name: storybook-coverage, cmd: "tools/storybook-coverage apps/<SURFACE>/src/features/<FEATURE>", pass_when: "every frame + every state from interaction-spec has a story" }
  - { name: axe-stories, cmd: "yarn workspace <SURFACE> test:axe", pass_when: "0 axe violations across all stories" }
  - { name: lighthouse-budget, cmd: "tools/lighthouse-budget <SURFACE> <FEATURE>", pass_when: "meets surface budget (citizen wallet: TTI <=5s 3G, JS <=120KB)" }
  - { name: pseudo-locale, cmd: "yarn workspace <SURFACE> test:pseudo", pass_when: "no truncation / overflow under xx-AC locale" }
  - { name: rtl, cmd: "yarn workspace <SURFACE> test:rtl", pass_when: "RTL snapshot matches" }
  - { name: e2e, cmd: "yarn workspace <SURFACE> e2e -- <FEATURE>", pass_when: "happy path + 2 error paths green" }
  - { name: telemetry, cmd: "tools/telemetry-check apps/<SURFACE>/src/features/<FEATURE>", pass_when: "every primary control emits data-event; no PII in event payloads" }
halt_conditions:
  - "Figma file changed since handoff (version hash mismatch) without re-running P-23"
  - "any component built from raw values bypassing the token preset"
  - "PII appears in a logged event payload"
  - "any axe violation"
  - "performance budget regression > 10%"
escalation: { to: "@design-lead, @engineering-lead, @a11y-lead", channel: "#btx-design" }
graph: { upstream: [P-21, P-23], downstream: [P-01, P-02, P-19, P-12] }
---

# P-24 — Design-to-code handoff (Figma → React/Tailwind)

> Use to turn a P-23-locked Figma frame set into shipped, accessible, instrumented code. The *Figma version hash* is pinned; tokens flow from P-21; copy from P-23. No pixel-perfect arguments — the contract is the tokens + the interaction spec + the a11y annotations.

---

## 0. Read first

- [docs/design/handoff-spec-template.md](../../design/handoff-spec-template.md)
- [docs/design/design-system.md](../../design/design-system.md)
- [docs/design/a11y.md](../../design/a11y.md)
- The P-23 outputs: interaction spec + a11y JSON + locale files
- `apps/<SURFACE>/README.md` for app conventions

## 1. Inputs

```yaml
SURFACE: <…>
FEATURE: <kebab-case>
FIGMA_URL: <link>
FIGMA_VERSION: <file version hash from P-23>
TARGET: react+tailwind
```

## 2. Plan, then execute

1. **Pin the Figma version** in the handoff spec — any later Figma change requires re-running P-23.
2. **Consume tokens** via the Tailwind preset emitted by P-21 (`build/tailwind/preset.ts`) and CSS vars (`build/css/tokens.css`). No raw values anywhere.
3. **Build components** that compose existing design-system components — never re-implement a Button etc.
4. **Wire interactions** per the interaction spec; honour keyboard, focus trap, live regions from the a11y JSON.
5. **Localise** by importing the en-IN + hi-IN ICU files from P-23.
6. **Storybook stories** — one per frame × state from the interaction spec.
7. **E2E** — Playwright happy path + ≥ 2 error paths.
8. **Telemetry** — wire `data-event` attributes per the design system contract. Validate no PII in payloads.
9. **Budgets** — verify Lighthouse mobile (citizen wallet), bundle size, axe across stories.
10. **Handoff doc** — fill [docs/design/handoff-spec-template.md](../../design/handoff-spec-template.md) including the Figma version hash, frames in scope, components reused vs proposed, acceptance results.

## 3. Hard rules

- **One source of truth for values: tokens.** Never hard-code a hex / px / font.
- **Figma version hash pinned.** No "I updated the design and the code at the same time" — re-run P-23 first.
- **No new design-system components introduced here** — propose via P-21 if needed; build with `proposed` blocked from `active` until graduated.
- **No PII in telemetry payloads** — IDs/hashes only.
- **A11y CI is blocking** — `0` axe violations on every story.
- **Performance budget is blocking** for citizen wallet.

## 4. Acceptance

- [ ] `tools/no-raw-style-check` exit 0.
- [ ] `tools/storybook-coverage` exit 0.
- [ ] `yarn test:axe` 0 violations.
- [ ] `tools/lighthouse-budget` within surface budget.
- [ ] `yarn test:pseudo` and `yarn test:rtl` pass.
- [ ] `yarn e2e -- <FEATURE>` green.
- [ ] `tools/telemetry-check` exit 0.
- [ ] Handoff doc filled with Figma version hash + acceptance evidence links.
- [ ] CODEOWNERS approvals: `@design-lead`, `@engineering-lead`, `@a11y-lead`; `@privacy-lead` if consent surface.

## 5. Worked example

See [`_examples/p24.md`](./_examples/p24.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
