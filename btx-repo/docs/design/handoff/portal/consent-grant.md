# Design-to-Code Handoff — Consent Grant Flow

| Field | Value |
|---|---|
| Surface | `portal` |
| Feature | `consent-grant` |
| Date | 2026-05-17 |
| Status | `scaffolded` — structure in place; visual implementation TBD |
| Related | [interaction-spec.md](../docs/design/surfaces/portal/consent-grant/interaction-spec.md) |
| Related | [journey.md](../docs/design/surfaces/portal/consent-grant/journey.md) |

---

## 1. File Map

```
apps/portal/src/
  components/
    Button.tsx          ← primary/secondary/ghost/danger variants
    Input.tsx           ← text + search
    StatusBadge.tsx     ← consent status (active/revoked/expired/pending)
  features/
    consent/
      ConsentCard.tsx   ← consent summary card (used in list + confirm modal)
      GrantFlow/
        NoticeStep.tsx  ← W-01 — Notice review
        DetailStep.tsx  ← W-02 — Data detail
        ConfirmStep.tsx ← W-03 — Explicit consent + submit
        SuccessStep.tsx ← W-04 — Receipt
        GrantFlow.tsx   ← route/step orchestrator
  pages/
    consent/
      grant.tsx         ← SSR page — loads GrantFlow
```

---

## 2. Token-to-Tailwind Mapping

Design tokens in `docs/design/tokens/btx-tokens.json` map to Tailwind config as follows:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary:       '#1A56DB',
          'primary-h':   '#1648C8',
          secondary:     '#0E9F6E',
          'secondary-h': '#057A55',
        },
        consent: {
          active:  '#0E9F6E',
          revoked: '#DC2626',
          expired: '#9CA3AF',
          pending: '#F59E0B',
        },
        neutral: {
          0:   '#FFFFFF',
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          400: '#9CA3AF',
          600: '#4B5563',
          700: '#374151',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ["'Noto Sans'", "'Inter'", 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", "'Fira Code'", 'monospace'],
      },
      boxShadow: {
        'focus-ring': '0 0 0 3px rgba(26,86,219,0.45)',
      },
    },
  },
};
```

---

## 3. Component Specs

### `Button`

| Prop | Values | Notes |
|---|---|---|
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` | Required |
| `size` | `md` \| `sm` | Default `md` |
| `loading` | `boolean` | Shows spinner; sets `aria-busy="true"` |
| `disabled` | `boolean` | Sets `aria-disabled`; prevents click |

```tsx
// apps/portal/src/components/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:   'bg-brand-primary text-white hover:bg-brand-primary-h focus-visible:shadow-focus-ring',
  secondary: 'bg-brand-secondary text-white hover:bg-brand-secondary-h focus-visible:shadow-focus-ring',
  ghost:     'bg-transparent text-neutral-700 border border-neutral-200 hover:bg-neutral-50 focus-visible:shadow-focus-ring',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:shadow-focus-ring',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}) => {
  const sizeClasses = size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs';
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold rounded-md transition-colors
        ${sizeClasses} ${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className="mr-2 animate-spin" aria-hidden="true">⟳</span> : null}
      {children}
    </button>
  );
};
```

### `StatusBadge`

```tsx
// apps/portal/src/components/StatusBadge.tsx
import React from 'react';

type ConsentStatus = 'active' | 'revoked' | 'expired' | 'pending';

const badgeClasses: Record<ConsentStatus, string> = {
  active:  'bg-green-100 text-green-800',
  revoked: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-800',
};

const labels: Record<ConsentStatus, string> = {
  active:  'Active',
  revoked: 'Revoked',
  expired: 'Expired',
  pending: 'Pending',
};

export const StatusBadge: React.FC<{ status: ConsentStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses[status]}`}
    aria-label={`Status: ${labels[status]}`}
  >
    {labels[status]}
  </span>
);
```

### `ConsentCard`

```tsx
// apps/portal/src/features/consent/ConsentCard.tsx
import React from 'react';
import { StatusBadge } from '../../components/StatusBadge';

export interface ConsentCardProps {
  principalName: string;
  purpose: string;
  dataFields: string[];
  expiresAt: Date | null;
  status: 'active' | 'revoked' | 'expired' | 'pending';
  onRevoke?: () => void;
}

export const ConsentCard: React.FC<ConsentCardProps> = ({
  principalName, purpose, dataFields, expiresAt, status, onRevoke,
}) => (
  <article
    className="bg-white border border-neutral-200 rounded-lg shadow-sm p-6"
    aria-label={`Consent to ${principalName}`}
  >
    <div className="flex items-start justify-between mb-3">
      <h2 className="text-base font-semibold text-neutral-900">{principalName}</h2>
      <StatusBadge status={status} />
    </div>
    <p className="text-sm text-neutral-600 mb-3">{purpose}</p>
    <ul className="text-sm text-neutral-700 list-disc list-inside mb-3" role="list" aria-label="Data fields">
      {dataFields.map((f) => <li key={f}>{f}</li>)}
    </ul>
    {expiresAt && (
      <p className="text-xs text-neutral-400">
        Expires <time dateTime={expiresAt.toISOString()}>{expiresAt.toLocaleDateString('en-IN')}</time>
      </p>
    )}
    {status === 'active' && onRevoke && (
      <button
        type="button"
        onClick={onRevoke}
        className="mt-4 text-xs text-red-600 hover:underline focus-visible:shadow-focus-ring"
        aria-label={`Revoke consent to ${principalName}`}
      >
        Revoke
      </button>
    )}
  </article>
);
```

---

## 4. i18n Keys

```json
{
  "consent.grant.notice.title": "Data access request from {{principalName}}",
  "consent.grant.notice.dataRequested": "They are requesting access to:",
  "consent.grant.notice.purpose": "For: {{purpose}}",
  "consent.grant.notice.until": "Until: {{expiresAt}}",
  "consent.grant.notice.revoke": "You can revoke this at any time from your BTX dashboard.",
  "consent.grant.notice.cta.review": "Review details",
  "consent.grant.notice.cta.dismiss": "Not now",
  "consent.grant.confirm.checkbox": "I give my consent freely and knowingly",
  "consent.grant.confirm.cta.grant": "Grant Consent",
  "consent.grant.success.heading": "Consent granted",
  "consent.grant.success.body": "{{principalName}} can now access your data until {{expiresAt}}.",
  "consent.grant.success.id": "Consent ID: {{consentId}}",
  "consent.status.active": "Active",
  "consent.status.revoked": "Revoked",
  "consent.status.expired": "Expired",
  "consent.status.pending": "Pending"
}
```

---

## 5. Open Items

| ID | Item | Owner |
|---|---|---|
| H-01 | Figma frames not yet linked — designer to share Figma link after review | @design-lead |
| H-02 | `GrantFlow.tsx` orchestrator not yet implemented — scaffold present, routing TBD | @fe-lead |
| H-03 | i18n keys for HI and MR translations not yet written | @i18n-team |
| H-04 | Guardian consent step (for minors) not scaffolded | @fe-lead |
