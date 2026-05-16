---
id: P-23
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@design-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SURFACE, type: "enum[citizen-wallet|operator-console|member-portal|public-portal|consent-ui|auditor-dashboard]", required: true }
  - { name: FEATURE, type: kebab-case, required: true }
  - { name: FIGMA_URL, type: url, required: true }
  - { name: FRAMES, type: list, required: true }
  - { name: STATES, type: list, required: true }
forbidden_paths: ["build/**"]
expected_outputs:
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<FEATURE>/a11y/*.json" }
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<FEATURE>/interaction-spec.md" }
  - { kind: file_created, path: "apps/<SURFACE>/locales/en-IN/<FEATURE>.json" }
  - { kind: file_created, path: "apps/<SURFACE>/locales/hi-IN/<FEATURE>.json" }
context_budget:
  read_in_full: ["docs/design/a11y.md", "docs/design/content-style-guide.md", "docs/design/design-system.md"]
executable_acceptance:
  - { name: a11y-annotations, cmd: "tools/a11y-annotations-validate docs/design/surfaces/<SURFACE>/<FEATURE>/", pass_when: "every Figma frame has matching JSON; every interactive node mapped; landmarks/headings/focus order present" }
  - { name: figma-token-only, cmd: "tools/figma-token-only-check <FIGMA_URL>", pass_when: "0 raw fills/strokes/typography in scope frames; all values resolve to a token" }
  - { name: contrast-states, cmd: "tools/contrast-states-check docs/design/surfaces/<SURFACE>/<FEATURE>/", pass_when: "every interactive state (default/hover/focus/active/disabled/error) passes AA" }
  - { name: i18n-parity, cmd: "tools/i18n-parity apps/<SURFACE>/locales/", pass_when: "en-IN and hi-IN have identical keys for the feature; ICU validated" }
  - { name: reading-level, cmd: "tools/reading-level-check apps/<SURFACE>/locales/", pass_when: "<= surface budget (citizen 7, member 10)" }
  - { name: motion-rules, cmd: "tools/motion-rules-check docs/design/surfaces/<SURFACE>/<FEATURE>/", pass_when: "no animation on consent moments; reduced-motion respected; durations within token bounds" }
halt_conditions:
  - "raw hex / px in a scope frame"
  - "any state missing focus / disabled annotations"
  - "consent moment has animation or asymmetric affordance"
  - "Hindi or English copy missing for any citizen-facing string"
escalation: { to: "@design-lead, @a11y-lead, @privacy-lead", channel: "#btx-design" }
graph: { upstream: [P-21, P-22], downstream: [P-24, P-25] }
---

# P-23 — High-fidelity screens + accessibility annotations

> Use to lock the hi-fi look + behaviour + accessibility for a feature. Pixels live in Figma; this prompt produces the *contract* code consumes (interaction spec, a11y annotations, copy) — and *certifies* the Figma frames are token-only and AA-clean.

---

## 0. Read first

- [docs/design/a11y.md](../../design/a11y.md)
- [docs/design/content-style-guide.md](../../design/content-style-guide.md)
- [docs/design/design-system.md](../../design/design-system.md)
- The journey + wireframes produced by P-22

## 1. Inputs

```yaml
SURFACE: <…>
FEATURE: <kebab-case>
FIGMA_URL: <link to the page or frames>
FRAMES: [consent-grant--default, consent-grant--loading, consent-grant--error, consent-grant--success]
STATES: [default, hover, focus, active, disabled, loading, error, success, empty]
```

## 2. Plan, then execute

1. **Interaction spec** — for each frame, document trigger / result / side effect / keyboard / focus-trap / live-region behaviour.
2. **A11y annotation JSON** — per frame, emit the JSON contract from [docs/design/a11y.md](../../design/a11y.md) §"Annotation contract".
3. **Copy** — author `en-IN` and `hi-IN` ICU JSON for every string visible in the frames; include max-length budget JSON.
4. **Token-only audit** — run `tools/figma-token-only-check` against the Figma file; fix any raw values *in Figma*; commit the Figma "version" hash to the spec.
5. **Contrast across states** — verify every interactive state (default → error) passes AA on the canonical background.
6. **Motion rules** — durations within `motion.duration.*` tokens; reduced-motion media query respected; consent moments are static.

## 3. Hard rules

- **No new tokens here.** If you need one, open P-21 and link.
- **No string concatenation** in copy — ICU messages only.
- **Consent moments**: no animation, no auto-advance, no asymmetric affordance, no marketing words.
- **Operator / auditor**: dense, monospace IDs, keyboard-complete.
- **Recordings / raw research data** never enter this PR.

## 4. Acceptance

- [ ] `tools/a11y-annotations-validate` exit 0.
- [ ] `tools/figma-token-only-check` exit 0.
- [ ] `tools/contrast-states-check` exit 0.
- [ ] `tools/i18n-parity` and `tools/reading-level-check` exit 0.
- [ ] `tools/motion-rules-check` exit 0.
- [ ] Figma file version hash recorded in interaction-spec.md.
- [ ] CODEOWNERS approvals: `@design-lead`, `@a11y-lead`; `@privacy-lead` if consent/PII.

## 5. Worked example

See [`_examples/p23.md`](./_examples/p23.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
