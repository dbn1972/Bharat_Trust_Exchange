# BTX UX Principles

## 1. Consent literacy first

The citizen wallet and the consent UI are *the* product, even though the bulk of the system is backend. Every decision in design optimises for: *did the citizen understand what was about to be shared, with whom, why, for how long, and how to take it back?*

- The grant and revoke actions are equally prominent. Revoke is one tap from the home screen.
- The minimised, exact list of fields shared is *always* visible — never "details" or "more info".
- No pre-checked consent. The safe default is "do not share".
- Confirm dialogs summarise the consequence in plain language, not jargon.

## 2. Transparency by default

- Every derived datum links to its proof: audit event id, policy version, kid of the signer.
- "Why did this happen?" must be answerable from any operator or auditor screen in ≤ 2 clicks.
- Public release notes link to the signed evidence pack and the cosign verify command.

## 3. Calm, slow, deliberate UX on consent moments

- No animation on consent screens (motion implies "this is normal, click through").
- No upsell, no cross-sell, no "related services" on consent screens.
- Time-zone, date, signer identity, and policy version are visible at the moment of decision.

## 4. Operational density, not "delight"

- Operator console: 32 px rows, monospaced IDs, keyboard-complete, no animations longer than 200 ms.
- Auditor dashboard: filter-first, deterministic, exportable evidence at every screen.

## 5. Low-end-device first for citizens

- 2 GB Android, 3G, Devanagari rendering — that's the baseline.
- Skeleton screens, not spinners. Optimistic UI on revoke (with rollback if write fails).
- Offline-readable consent history (last 30 d). 

## 6. Trust signals are earned, shown, and proven

- Show only signals we can substantiate. No "Verified" badge that isn't a real verification.
- Every trust mark links to the policy that defines it.

## 7. Error prevention > error recovery on consent flows

- Confirm before share with consequence summary.
- "Do not share" is the default keyboard action (focus on cancel).
- No timeouts on consent screens.

## 8. Per-surface principles

### Citizen wallet
- One primary action per screen.
- The home screen answers, in order: "What is shared right now?", "Who asked recently?", "What can I revoke?", "Where do I see the proof?"

### Operator console
- The first screen on login: SLO summary + active alerts + pending changes.
- Every destructive action has a 4-eye flow with reason capture.
- Long-running operations have a stable URL for sharing in incidents.

### Member portal
- Conformance status per cloud, per CT-NNN, at a glance.
- One action per row ("Re-certify on AWS"), no batch destructive ops without confirmation.

### Public portal
- ADR index, releases, evidence packs, status page, contact for grievance.
- No login. No tracking beyond aggregate.

### Consent UI (embedded)
- Renders in ≤ 50 KB. Works without JS as a graceful fallback.
- Identical look and language regardless of which member embeds it.

### Auditor dashboard
- Filter by time, kid, policy version, service, citizen-ref hash.
- Replay decisions: input + policy version + outputs.
- Export an evidence pack for any query (signed).

## 9. Anti-patterns (forbidden)

- Consent fatigue: bundling multiple purposes into one consent.
- Asymmetric affordance: "Share" big and green, "Don't share" tiny and grey.
- Inferred consent from inactivity.
- Hiding the revoke flow.
- "By using this app you agree…".
- Pre-filled fields in consent.
- Modal stacking on operational screens.
- Marketing chrome on operator / auditor surfaces.

## 10. Decision rights

- **Architecture-affecting design changes** require an ADR (P-10).
- **Consent / revoke flow changes** require sign-off from `@privacy-lead` and a fresh usability test (P-25).
- **Token-set breaking changes** require a `CHANGELOG-design.md` entry and a major bump.
