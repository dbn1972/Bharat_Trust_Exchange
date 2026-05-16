# BTX Figma → Code Handoff Spec (Template)

> Copy this file to `docs/design/handoff/<surface>/<feature>.md` for each Figma → code handoff. Filled by P-24.

## 1. Identity

- **Surface**: <citizen-wallet | operator-console | member-portal | public-portal | consent-ui | auditor-dashboard>
- **Feature**: <e.g. "Grant consent for income certificate">
- **Figma URL**: <link to frame / page>
- **Figma file version / commit hash**: <…>
- **Design owner**: @<designer>
- **Engineering owner**: @<engineer>
- **Linked tech spec**: docs/specs/<…>.md
- **Linked DPIA / threat model** (if PII): dpia/<…>.md, threat-models/<…>.md

## 2. Frames in scope

| Frame name | Purpose | Token-only? | A11y annotation file |
|---|---|---|---|
| consent-grant--default | Initial state | ✅ | a11y/consent-grant--default.json |
| consent-grant--loading | Submitting | ✅ | a11y/consent-grant--loading.json |
| consent-grant--error    | Submit failed | ✅ | a11y/consent-grant--error.json |
| consent-grant--success  | Confirmation | ✅ | a11y/consent-grant--success.json |

"Token-only" means no raw colours / spacings — every value resolves to a token.

## 3. Tokens

- **Token set version**: tokens@<X.Y.Z>
- **New / changed tokens introduced for this handoff**:
  - none / `consent-ui.color.minimised.bg` (new)
- **Components reused** (active in design system): `Button`, `FieldGroup`, `Disclosure`, `EvidenceLink`
- **Components newly proposed** (require P-21 to graduate to `active`): `ConsentSummary`

## 4. Behaviour

| Interaction | Trigger | Result | Side effect |
|---|---|---|---|
| Press "Share for scholarship verification" | click / Enter on focused | Optimistic UI shows success; POST `/v1/consents`; on error → roll back | audit event `consent.granted` |
| Press "Do not share" | click / Enter / Esc | Closes flow; returns to caller with `decision=deny` | audit event `consent.denied` |
| Tap "Read the formal terms" | click / Enter | Opens disclosure inline | none |
| Reduced motion | `prefers-reduced-motion` | No transitions | none |
| Offline | network detection | Disable submit, show "Connect to share" | none |

## 5. Content

- All strings in `apps/<surface>/locales/{en-IN,hi-IN}/<feature>.json` (ICU).
- Reading level ≤ 7 (citizen-facing) / ≤ 10 (member-facing).
- Max-length budget per string in `apps/<surface>/i18n/budgets/<feature>.json`.

## 6. Acceptance

- [ ] Every frame's `data-testid` matches the Figma node name.
- [ ] No raw hex / px in code (`tools/no-raw-style-check apps/<surface>`).
- [ ] axe-core passes (0 violations) on every state.
- [ ] Storybook stories for each frame + state.
- [ ] Playwright E2E covers the happy path + 2 error paths.
- [ ] Lighthouse (mobile, throttled 3G) within surface budget.
- [ ] Pseudo-locale render does not truncate or overflow.
- [ ] RTL render snapshot matches.
- [ ] Hindi + English content present; both reviewed by `@privacy-lead` for consent surfaces.
- [ ] Telemetry: `data-event` attributes on every primary control; events fire on interaction.
- [ ] No PII in any logged event payload.

## 7. Out of scope

- e.g. Tamil translation, motion polish, illustration variants.

## 8. Risk & rollback

- Feature flag: `consent.grant.v2` (default off).
- Rollback: revert PR; tokens are additive so no token rollback needed.
- Monitoring: success rate of grant flow, time-on-screen, revoke-within-1-hour rate.
