# BTX Content & Style Guide

## Voice (per audience)

| Audience | Voice | Examples |
|---|---|---|
| **Citizen** | Calm, plain, respectful, never marketing | "We will share your income certificate with the Scholarship Portal so they can confirm you qualify. Nothing else is shared." |
| **Operator / SRE** | Terse, factual, action-first | "Drain broker 2. Verify leadership re-elect within 30 s." |
| **Member admin** | Professional, instructive | "This service version is awaiting conformance on 2 clouds. Action: trigger `make certify`." |
| **Auditor** | Neutral, evidentiary, no opinion | "Decision 7a2f… returned `allow` under policy version 2026.05.02 at 09:12:14.071 IST." |
| **Public** | Honest, modest, link to proof | "We had a partial outage on 17 May. Read the post-incident review." |

## Hard rules

1. **No dark patterns.** Symmetrical affordance for grant vs revoke. No pre-checked consent. No "are you sure?" guilt-trip copy.
2. **No legal jargon in citizen UI.** Replace with plain language; legal text behind a "Read the formal terms" link.
3. **No marketing language anywhere operational.** Never "blazing fast", "world-class", "robust".
4. **Active voice, present tense** in citizen and operator copy.
5. **Numbers first** in operator copy ("p95 980 ms, target ≤ 800 ms"), not "high latency".
6. **Always show** who's asking, what's shared, why, for how long, with a revoke path.
7. **Errors**: state what happened, what we did, what the user can do. Never blame the user.
8. **No emoji** in operator / auditor / consent UIs. Public portal: minimal, semantic only.
9. **No idioms / regional metaphors** in citizen UI — they don't translate.

## Terminology

| Use | Don't |
|---|---|
| Share | Disclose, divulge |
| Grant / Revoke consent | Allow / Deny |
| Service | Endpoint, API, microservice (in citizen UI) |
| Purpose | Use-case, reason |
| Audit record | Log entry |
| Evidence pack | Bundle, archive |
| Citizen | User, customer, subject |
| Member | Tenant, org |

## Microcopy patterns

### Consent moment (citizen)
```
Share <DATA> with <REQUESTER>?

Why: <PURPOSE_PLAIN_LANGUAGE>
What is shared: <MINIMISED_FIELDS>     ← exact, not "details"
How long: <RETENTION_PLAIN>             ← e.g. "kept for 90 days, then deleted"
You can revoke this any time.

[ Share for <PURPOSE> ]   [ Do not share ]
                          ↑ default safe choice on Enter
```

### Operator alert
```
SEV-2  PDP latency p95 > 300 ms — aws-mum — 09:12 IST
Runbook: docs/runbooks/policy/pdp-latency.md
On-call: @oncall-sre
[ Acknowledge ]  [ Open runbook ]  [ Escalate ]
```

### Empty state (auditor)
```
No events match these filters.
Try: widening the time range, removing the kid filter.
```

### Error (citizen)
```
We couldn't share this right now.
What happened: the Scholarship Portal is not reachable.
What you can do: try again in a few minutes. Nothing was shared.
[ Try again ]  [ Cancel ]
```

## Multilingual rules

- Author in `en-IN` AND `hi-IN` from day 0. English-only strings are not allowed in citizen UI.
- ICU MessageFormat for plurals, gender, dates, currencies.
- Never concatenate strings — use one ICU string per sentence.
- Translators receive a screenshot + glossary + max-length budget for every string.
- Pseudo-localisation (`xx-AC`) catches truncation and concatenation in CI.

## Date / time / number

| Audience | Format |
|---|---|
| Citizen | `16 मई 2026` / `16 May 2026`; relative for < 24 h ("2 hours ago") |
| Operator / auditor | ISO 8601 with offset: `2026-05-16T09:12:14+05:30` |
| Member | Locale long, plus ISO in tooltip |

Money: `₹` with Indian grouping (1,23,45,678).

## Linting

- `tools/content-lint` runs on every PR touching `**/*.{json,po,ftl,md}` in `docs/design/**`, `apps/**/locales/**`, `apps/**/i18n/**`:
  - reading-level gate per audience,
  - banned-words list (jargon, marketing),
  - missing `hi-IN` for any `en-IN` string in citizen surfaces (and vice versa),
  - max-length budget violations.
