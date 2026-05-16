# BTX Design

> The user-facing face of a federated trust fabric. Every screen is a *trust artefact*. Every word is a *promise* a citizen, operator, member or auditor can hold us to.

## Surfaces

| Surface | Primary users | Critical jobs |
|---|---|---|
| **Citizen wallet** (mobile, low-end first) | Citizens of India | Grant / revoke consent; see *exactly* what was shared, with whom, for what purpose, when; receive verifiable assertions |
| **Operator console** (web, desktop) | Trust Node operators, SRE, IC | Drive incidents, run runbooks, view alerts, certify a cloud, manage policy bundle rollouts |
| **Member portal** (web) | Member (ministry / department / regulated entity) admins | Manage service catalogue entries, view conformance status, manage API credentials |
| **Public transparency portal** (web) | Citizens, press, civil society | Read ADRs, governance, releases, signed evidence packs, data-flow diagrams |
| **Consent UI** (embedded web/SDK) | Citizens, at point of use | Single-purpose, minimised, plain-language consent moment with revoke link |
| **Auditor / regulator dashboard** (web) | DPB / CAG / external auditors | Verify chain-of-custody, replay decisions, inspect evidence packs |

Each surface has its own design file in Figma under `BTX / <surface>` and its own folder under [`docs/design/surfaces/`](./surfaces/).

## Principles (non-negotiable)

1. **Consent literacy first.** No dark patterns. The default is *less sharing*. The revoke action is at least as prominent as grant.
2. **Transparency by default.** Every screen that shows derived information must link to its proof (audit event id, policy version, kid).
3. **Plain language, multilingual.** Hindi + English baseline; 12 scheduled languages target. Reading level ≤ class 8.
4. **Accessible by design.** WCAG 2.2 AA minimum; AAA on consent/revoke and incident surfaces.
5. **Low-end first.** Citizen wallet must work on 2 GB RAM Android, 2G fallback, 50 KB hero screen.
6. **No marketing chrome on operational surfaces.** Operator and auditor screens are dense, keyboard-driven, deterministic.
7. **Time, identity, and authority are always shown** on operational surfaces.

## Documents

| File | Purpose |
|---|---|
| [design-system.md](./design-system.md) | Tokens, components, naming, versioning |
| [a11y.md](./a11y.md) | WCAG 2.2 AA targets, India localisation, low-end-device budget |
| [content-style-guide.md](./content-style-guide.md) | Voice, tone, terminology, multilingual rules |
| [ux-principles.md](./ux-principles.md) | Detailed UX rules per surface |
| [handoff-spec-template.md](./handoff-spec-template.md) | Figma → code handoff contract |
| [usability-test-template.md](./usability-test-template.md) | Test plan + citizen-safeguard checklist |
| [surfaces/](./surfaces/) | One folder per surface (information architecture, journeys) |

## Tooling

- **Figma** for canvas, prototypes, components, variables.
- **Tokens Studio for Figma** for design tokens; exported as W3C Design Tokens JSON, transformed via **Style Dictionary** into CSS variables, Tailwind config, Android XML, iOS Swift.
- **Figma MCP server** for Claude to read frames and emit code (P-24).
- **Storybook** (web) + **Lokalise / Crowdin** (i18n) + **axe-core** (a11y CI).

## Repo layout

```
docs/design/
  README.md                       # this file
  design-system.md
  a11y.md
  content-style-guide.md
  ux-principles.md
  handoff-spec-template.md
  usability-test-template.md
  surfaces/
    citizen-wallet.md
    operator-console.md
    member-portal.md
    public-portal.md
    consent-ui.md
    auditor-dashboard.md
  tokens/                         # W3C Design Tokens JSON, single source of truth
    core.json
    semantic.json
    surface/
      citizen-wallet.json
      operator-console.json
      ...
research/                          # discovery notes, interview transcripts (redacted)
usability/                         # test plans, scripts, evidence
```

## Who designs what

| Activity | Claude (agent) | Designer (Figma) |
|---|---|---|
| Tokens (JSON, semver, transforms) | ✅ author / extend | review |
| Component spec (props, states, a11y, content) | ✅ author | implement in Figma |
| Wireframe IA + journey map | ✅ draft | refine, validate |
| Pixel layout, illustration, motion | ❌ (no canvas) | ✅ author |
| A11y annotation JSON | ✅ author | annotate Figma |
| Copy / microcopy / multilingual | ✅ author | review |
| Code from Figma (React/Tailwind) | ✅ via Figma MCP + tokens | provide source frame |
| Usability test script | ✅ author | observe / facilitate |

Claude does not draw pixels. Claude makes the *system* designers compose pixels from, the *contract* code consumes those pixels through, and the *evidence* that the result is accessible, performant and humane.
