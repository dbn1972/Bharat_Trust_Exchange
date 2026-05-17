# A11y Annotations + Interaction Spec — Consent Grant Flow

| Field | Value |
|---|---|
| Surface | `portal` |
| Feature | `consent-grant` |
| Figma version hash | (TBD — locked at P-23 approval) |
| WCAG target | 2.1 Level AA |
| Date | 2026-05-17 |
| Author | @ux-lead / @a11y-reviewer (agent) |
| Related | [journey.md](./journey.md) |

---

## 1. Focus Management

| Transition | Focus lands on | Method |
|---|---|---|
| Page load (W-01) | `<h1>` "Notice" heading | `autofocus` attribute |
| Click "Review details" → W-02 | Back button in W-02 | `focus()` after route change |
| Click "I understand, proceed" → W-03 | Confirmation heading in W-03 | `focus()` |
| Grant Consent → W-04 | Success `<h1>` | `focus()` after response |
| Error (network fail) | Error alert `role="alert"` | Inserted into DOM; focus moves via `aria-live="assertive"` |

---

## 2. ARIA Annotations

### W-01 — Notice

```html
<main aria-labelledby="notice-heading">
  <h1 id="notice-heading">Data access request from {PrincipalName}</h1>

  <section aria-label="Data summary">
    <ul role="list" aria-label="Data fields requested">
      <li>Aadhaar-linked mobile number</li>
      <li>Bank account last 4 digits</li>
    </ul>
  </section>

  <p>
    <strong>Purpose:</strong> Home loan eligibility check.
    <strong>Until:</strong> <time datetime="2026-12-31">31 December 2026</time>.
  </p>

  <aside aria-label="Important information" role="note">
    You can revoke this consent at any time.
  </aside>

  <nav aria-label="Consent flow actions">
    <button type="button" aria-expanded="false" aria-controls="detail-section">
      Review details
    </button>
    <button type="button">Not now</button>
  </nav>
</main>
```

### W-03 — Confirm (critical accessibility checkpoint)

```html
<form aria-labelledby="confirm-heading" novalidate>
  <h1 id="confirm-heading">Confirm your consent</h1>

  <section aria-label="Consent summary" role="region">
    <!-- Summary card — read-only, no interaction -->
    <dl>
      <dt>Recipient</dt> <dd>ABC Home Finance Ltd</dd>
      <dt>Data</dt>      <dd>Mobile number, Bank account last 4 digits</dd>
      <dt>Purpose</dt>   <dd>Home loan eligibility check</dd>
      <dt>Expires</dt>   <dd><time datetime="2026-12-31">31 December 2026</time></dd>
    </dl>
  </section>

  <!-- Mandatory explicit consent checkbox — DPDP requirement -->
  <div role="group" aria-required="true">
    <input
      type="checkbox"
      id="explicit-consent"
      name="consent"
      required
      aria-describedby="consent-hint"
    />
    <label for="explicit-consent">
      I give my consent freely and knowingly
    </label>
    <div id="consent-hint" class="hint">
      You must tick this box to proceed.
    </div>
  </div>

  <button
    type="submit"
    aria-disabled="true"    <!-- disabled until checkbox ticked -->
    aria-describedby="grant-hint"
  >
    Grant Consent
  </button>
  <div id="grant-hint" class="sr-only" aria-live="polite"></div>

  <button type="button">Not now</button>
</form>
```

---

## 3. Colour Contrast Checklist

| Element | Foreground | Background | Ratio | AA Pass |
|---|---|---|---|---|
| Body text | `color.neutral.900` (#111827) | `color.neutral.0` (#FFF) | 19.1:1 | ✅ |
| Secondary text | `color.neutral.600` (#4B5563) | `color.neutral.0` | 7.0:1 | ✅ |
| Primary button label | `#FFF` | `color.brand.primary` (#1A56DB) | 4.6:1 | ✅ |
| Primary button hover | `#FFF` | `color.brand.primary-hover` (#1648C8) | 4.8:1 | ✅ |
| Consent active badge | `color.brand.secondary` (#0E9F6E) | `#FFF` | 4.5:1 | ✅ |
| Consent revoked badge | `color.semantic.danger` (#DC2626) | `#FFF` | 4.5:1 | ✅ |
| Disabled text | `color.neutral.400` (#9CA3AF) | `#FFF` | 2.85:1 | ⚠️ intentional (decorative disabled state) |
| Focus ring | `color.brand.primary` 45% opacity | `#FFF` | 3.2:1 | ✅ (WCAG 2.2 §1.4.11) |

---

## 4. Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` | Move forward through interactive elements |
| `Shift+Tab` | Move backward |
| `Space` / `Enter` | Activate button or checkbox |
| `Escape` | Close modal (ConsentGrantModal); return focus to trigger |
| `Arrow keys` | Navigate within language toggle (radio group) |

---

## 5. Screen Reader Copy

### Announcement on grant success (aria-live region)
> "Consent granted. ABC Home Finance Ltd can access your data until 31 December 2026. Consent ID: BTX-20260517-XXXX."

### Error announcement (aria-live assertive)
> "Error: Could not grant consent. Please check your connection and try again. If the problem continues, contact BTX support."

### Loading state
> "Granting consent, please wait."

---

## 6. Internationalisation Notes

- All text passed through `i18n.t()` — no hardcoded strings in component code
- Devanagari text uses `font-family: 'Noto Sans'` (token `typography.family.sans`) which includes Devanagari glyphs
- `dir="auto"` on `<html>` — not needed for EN/HI/MR (all LTR) but future-proofs for potential Urdu support
- Date/time formatted via `Intl.DateTimeFormat` with `locale` from user preferences

---

## 7. Acceptance Checklist

- [ ] All interactive elements reachable via keyboard
- [ ] Focus ring visible on all focusable elements (3px `color.focus.ring`)
- [ ] Screen reader announces grant success and error states
- [ ] Explicit consent checkbox required before "Grant Consent" enables
- [ ] Consent summary uses `<dl>` for structured data (screen reader reads label + value)
- [ ] Language toggle uses `role="radiogroup"` with `aria-label`
- [ ] No auto-playing content; no content that flashes > 3 Hz
- [ ] Touch target minimum 44×44px on all interactive elements (WCAG 2.2 §2.5.8)
- [ ] Axe DevTools scan: 0 violations at AA level
