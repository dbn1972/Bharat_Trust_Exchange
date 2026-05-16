# BTX Design System

> Source of truth: [`tokens/`](./tokens/) (W3C Design Tokens JSON). Figma mirrors via Tokens Studio. Code consumes via Style Dictionary build.

## Layering

```
core.json          (primitive)    →  color.brand.500 = #1F5AA8
semantic.json      (intent)        →  color.action.primary = {color.brand.500}
surface/*.json     (per surface)   →  citizen-wallet.color.consent.grant = {color.action.primary}
```

Code and Figma both read the **same JSON**. Never duplicate values in either.

## Naming

- `kebab-case` everywhere.
- `category.subcategory.role.state` e.g. `color.action.primary.hover`.
- Never reference raw hex / px in components — always a token.

## Versioning

- Tokens follow **semver**.
- Breaking change (rename / remove) → major bump + migration note in [`CHANGELOG-design.md`](./CHANGELOG-design.md).
- New tokens → minor. Value tweaks within tolerance → patch.

## Component contract

Every component published in Figma + code MUST have:

1. **Props** (typed) — name, type, default, required.
2. **States** — default, hover, focus, active, disabled, loading, error, success, empty.
3. **Variants** — size, density, intent.
4. **Slots** — for composition (icon-leading, icon-trailing, helper, error).
5. **A11y** — role, name, keyboard map, focus order, color contrast pass on every state.
6. **Content rules** — max length, allowed/forbidden patterns (e.g. no exclamation marks in operator console).
7. **Telemetry hooks** — `data-testid`, `data-event` attributes.
8. **Do / Don't** — at least 2 each, visual.
9. **Status** — `draft | proposed | active | deprecated` + `since` + `superseded_by`.

Component spec lives at `docs/design/components/<name>.md` and the Figma file. Both reference the same token IDs.

## Density

- **Citizen wallet** — comfortable (44 px minimum tap target, 16 px body min).
- **Operator console / auditor** — compact (32 px row min, 14 px body min, monospace for IDs).
- **Public portal** — comfortable.

## Required tokens (initial set)

```
color.brand.{50,100,...,900}
color.action.{primary,secondary,destructive,neutral}.{default,hover,active,disabled}
color.feedback.{success,warning,danger,info}.{bg,fg,border}
color.surface.{canvas,raised,sunken,overlay,inverse}
color.text.{primary,secondary,tertiary,inverse,link,link-visited}
color.border.{subtle,default,strong,focus}
color.consent.{grant,revoke,history,minimised}

font.family.{sans,mono,devanagari,tamil,bengali,telugu,...}
font.size.{12,14,16,18,20,24,30,36,48}
font.weight.{regular,medium,semibold,bold}
font.lineheight.{tight,normal,relaxed}

space.{0,1,2,3,4,5,6,8,10,12,16,20,24}        # 4-px grid
radius.{none,sm,md,lg,full}
shadow.{none,sm,md,lg,focus}
motion.duration.{instant,fast,normal,slow}    # 0 / 100 / 200 / 400 ms
motion.easing.{standard,decel,accel}
z.{base,sticky,overlay,modal,toast,top}
breakpoint.{xs,sm,md,lg,xl}                    # 360 / 640 / 768 / 1024 / 1440

# Surface overrides may rename for clarity, e.g.
citizen-wallet.font.size.consent-headline = {font.size.24}
operator-console.color.alert.sev1 = {color.feedback.danger.fg}
```

## Contrast & a11y at the token level

- All `color.text.*` / `color.action.*` pairings with their canonical background MUST pass WCAG 2.2 AA (≥ 4.5:1 for body, ≥ 3:1 for large text and non-text).
- `color.border.focus` MUST be ≥ 3:1 against both `color.surface.canvas` and `color.surface.raised`.
- Linter `tools/tokens-a11y-check` (P-21) validates this on every PR.

## Build & distribution

```
make tokens-build
# emits:
#   build/css/tokens.css        (CSS vars)
#   build/tailwind/preset.ts    (Tailwind preset)
#   build/android/tokens.xml
#   build/ios/Tokens.swift
#   build/figma/tokens.json     (Tokens Studio import)
```

Web apps import the Tailwind preset + CSS vars. Mobile imports the platform files. Figma imports via the plugin. **No app ever hand-codes a color or spacing value.**

## Deprecation

- Mark token `"$status": "deprecated"` and add `"$superseded_by": "..."` in JSON.
- Linter emits warning at PR time, error at next major.
- Figma component shows a `⚠ deprecated` badge.

## Forbidden

- Inline styles in code.
- Magic hex / px in code or in Figma styles outside the token system.
- Adding a "one-off" colour for a single screen — propose a semantic token instead.
- Breaking change without a major bump and migration note.
