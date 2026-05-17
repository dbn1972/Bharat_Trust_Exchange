# Citizen Journey — Consent Grant Flow

| Field | Value |
|---|---|
| Surface | `portal` (citizen-facing web) |
| Feature | `consent-grant` |
| Job to be done | "As a citizen, I want to grant a data principal access to my data for a specific purpose, so they can provide me a service." |
| Date | 2026-05-17 |
| Author | @ux-lead (agent) |
| Related prompts | P-22 → P-23 → P-24 |

---

## 1. Research Summary

**Primary finding**: Citizens trust data sharing most when they see exactly what data will be shared, for how long, and by whom. The most common abandonment point is "unclear purpose" or "too long a consent form."

**Key jobs-to-be-done**:
1. Understand what they are agreeing to (plain language, no jargon)
2. Confirm the recipient is legitimate
3. Know they can undo it easily

**Vulnerable groups**: Rural users with limited literacy; elderly users unfamiliar with digital consent; users in low-connectivity environments (consent flow must work offline-first for form fill, online for submit).

---

## 2. Journey Map

```
BEFORE (awareness)
  Citizen visits Data Principal portal (bank, insurer, UIDAI service)
  Portal redirects to BTX consent flow with pre-filled parameters
         │
         ▼
STEP 1 — Notice Review   [trust boundary: PUBLIC → BTX portal]
  Citizen sees:
  ✦ Who is requesting access (principal name + logo)
  ✦ What data will be shared (plain-language list)
  ✦ Why (purpose in ≤ 2 sentences, EN/HI/MR toggle)
  ✦ Until when (expiry date prominently displayed)
  ✦ "You can revoke this at any time" — always visible
         │
         ▼ [citizen clicks "Review details"]
STEP 2 — Detail Inspection
  Citizen expands:
  ✦ Full data elements list with sensitivity indicator
  ✦ Principal registration number + grievance contact
  ✦ Retention period (how long after expiry data can be used)
  ✦ Link to BTX privacy policy
         │
         ▼ [citizen clicks "I understand, proceed"]
STEP 3 — Consent Confirmation
  ✦ Summary card (who, what, why, until when)
  ✦ Explicit checkbox: "I give my consent freely and knowingly"
  ✦ Primary CTA: "Grant Consent" (green)
  ✦ Secondary: "Not now" (ghost button)
         │
         ▼ [citizen submits]
STEP 4 — Confirmation & Receipt
  ✦ Success state: consent ID, timestamp
  ✦ "Your consent is now active"
  ✦ CTA: "View in My Consents" | "Done"
  ✦ SMS/email confirmation dispatched (async)
         │
         ▼
AFTER
  Citizen returns to Data Principal portal with consent token
  Portal completes data access transaction
```

---

## 3. Information Architecture

```
/consent/grant
  ├── /notice          (STEP 1 — purpose + data summary)
  ├── /details         (STEP 2 — expanded data list)
  ├── /confirm         (STEP 3 — final confirmation)
  └── /success         (STEP 4 — receipt)

/my-consents           (consent management dashboard)
  ├── /active          (list of active consents)
  ├── /history         (all consents including revoked/expired)
  └── /:id             (individual consent detail + audit trail)
```

---

## 4. Wireframes

### Screen W-01 — Notice (STEP 1)

```
┌────────────────────────────────────────────────────┐
│  BTX [logo]                          [EN | हिं | मर] │
├────────────────────────────────────────────────────┤
│                                                    │
│  [Principal Logo]  [Principal Name]                │
│  Government-verified partner ✓                     │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  They are requesting access to:              │  │
│  │  • Aadhaar linked mobile number              │  │
│  │  • Bank account last 4 digits                │  │
│  │                                              │  │
│  │  For: Home loan eligibility check            │  │
│  │  Until: 31 Dec 2026                          │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ℹ  You can revoke this at any time from your      │
│     BTX dashboard.                                 │
│                                                    │
│  [Review details ↓]        [Not now]               │
└────────────────────────────────────────────────────┘
```

### Screen W-02 — Detail (STEP 2)

```
┌────────────────────────────────────────────────────┐
│  ← Back          Data access details               │
├────────────────────────────────────────────────────┤
│  Data fields                                       │
│  ┌──────────────────────────┬──────────────────┐   │
│  │ Field                    │ Sensitivity      │   │
│  │ Mobile number (Aadhaar)  │ 🟡 Moderate      │   │
│  │ Bank a/c last 4 digits   │ 🟡 Moderate      │   │
│  └──────────────────────────┴──────────────────┘   │
│                                                    │
│  Principal details                                 │
│  Name: ABC Home Finance Ltd                        │
│  Reg no: NBFC-2024-001234                          │
│  Grievance: 1800-XXX-XXXX                          │
│                                                    │
│  Retention: Data deleted 30 days after expiry      │
│                                                    │
│  [Privacy policy ↗]                                │
│                                                    │
│  [I understand, proceed →]                         │
└────────────────────────────────────────────────────┘
```

### Screen W-03 — Confirm (STEP 3)

```
┌────────────────────────────────────────────────────┐
│  Confirm your consent                              │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │  ABC Home Finance Ltd                        │  │
│  │  Mobile + bank a/c last 4                    │  │
│  │  Home loan eligibility  │  Until 31 Dec 2026 │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ☐  I give my consent freely and knowingly        │
│                                                    │
│  [Grant Consent]           [Not now]               │
│                                                    │
│  Questions? Contact the BTX Grievance Officer      │
└────────────────────────────────────────────────────┘
```

### Screen W-04 — Success (STEP 4)

```
┌────────────────────────────────────────────────────┐
│  ✅  Consent granted                                │
├────────────────────────────────────────────────────┤
│  ABC Home Finance Ltd can now access your data     │
│  until 31 Dec 2026.                                │
│                                                    │
│  Consent ID: BTX-20260517-XXXX                     │
│  Granted at: 17 May 2026, 10:32 IST                │
│                                                    │
│  [View in My Consents]     [Done]                  │
└────────────────────────────────────────────────────┘
```

---

## 5. Edge Cases

| Case | Handling |
|---|---|
| User is a minor (age < 18) | Guardian consent step inserted between W-01 and W-02; guardian phone number required |
| User language not EN/HI/MR | Fallback to EN; language toggle prominent |
| Low connectivity | Form filled offline; submit requires connectivity; queued locally with retry |
| Principal not registered in BTX registry | Error screen: "This partner is not verified by BTX. Do not share your data." |
| Consent already active for same principal + purpose | Informational modal: "You have an active consent. Granting again will create a new consent." |
| User clicks back mid-flow | State preserved; resume from last step |
