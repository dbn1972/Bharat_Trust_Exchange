# Component Registry — BTX Design System

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Date | 2026-05-17 |
| Tokens source | `docs/design/tokens/btx-tokens.json` |
| Figma library | (link to Figma — TBD) |

## Status key
- `proposed` — designed, not yet reviewed
- `active` — reviewed + shipped in code
- `deprecated` — replaced; do not use in new work

## Components

| Component | Status | Figma Frame | Code Path | Tokens Used |
|---|---|---|---|---|
| Button (primary, secondary, danger, ghost) | active | — | `apps/portal/src/components/Button.tsx` | color.brand.*, borderRadius.md, typography.weight.semibold |
| Input (text, search) | active | — | `apps/portal/src/components/Input.tsx` | component.input.* |
| ConsentCard | active | — | `apps/portal/src/features/consent/ConsentCard.tsx` | component.consent-card.*, color.consent.* |
| StatusBadge | active | — | `apps/portal/src/components/StatusBadge.tsx` | color.consent.*, component.badge.* |
| ConsentGrantModal | proposed | — | — | — |
| ConsentHistoryList | proposed | — | — | — |
| NoticePanel (multi-language) | proposed | — | — | typography.family.sans |
| GrievanceForm | proposed | — | — | — |
