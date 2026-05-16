# BTX Usability Test Plan (Template)

> Copy to `usability/<study-id>-<surface>-<topic>.md`. Filled by P-25.

## 1. Identity

- **Study ID**: U-2026-05-<NN>
- **Surface**: <citizen-wallet | consent-ui | …>
- **Feature / flow**: <…>
- **Owner (researcher)**: @<…>
- **Privacy review**: @privacy-lead — *required* before recruitment
- **Date window**: <YYYY-MM-DD .. YYYY-MM-DD>

## 2. Hypothesis & questions

> *Hypothesis must be falsifiable.*

- H1: ≥ 80% of citizens correctly identify *what data is being shared* before pressing "Share".
- H2: ≥ 80% of citizens find the revoke action within 30 s on the home screen.
- H3: 0 citizens unintentionally share more than the minimised field set.

Open questions:
- Do citizens understand "purpose" without translation gloss?
- Does the "Read formal terms" disclosure help or distract?

## 3. Participants

| Segment | n | Recruit criteria |
|---|---|---|
| Citizens, urban, Hindi-first | 6 | 18–65, mixed gender, owns a smartphone, has used Aadhaar e-KYC ≥ once |
| Citizens, rural, Hindi-first | 6 | 18–65, mixed gender, 2 GB Android, weak signal area |
| Citizens with disabilities | 3 | low vision, motor, hearing — one each |
| Citizens, Tamil-first | 3 | (pilot for L10n robustness) |

Total: 18. Compensation: ₹<amount>, paid regardless of completion.

## 4. Citizen safeguards (mandatory)

- **Informed consent in plain language**, signed before session; participant gets a copy.
- **No real PII** in the test environment — synthetic but realistic data only.
- **Recordings**: only with explicit opt-in; face-blurred; stored in `usability/recordings/<study>/` encrypted; retention 90 d max.
- **Right to stop** at any time without losing compensation.
- **Right to be forgotten**: participant can request deletion of their session evidence at any time.
- **No deceptive tasks** ("see if they fall for…"). All tasks are honest.
- **DPIA check**: if the study itself processes any personal data (recordings, identifiers), update [`dpia/usability-research.md`](../../dpia/usability-research.md) and link.

## 5. Method

- **Type**: moderated, remote (or in-person where bandwidth limits remote).
- **Device**: participant's own where possible; backup Moto G4-class Android with 3G throttling.
- **Tools**: Lookback / built-in screen share; observer note-taking template.
- **Duration**: 45 min max. Breaks allowed.
- **Pilot**: 2 sessions with internal participants first; refine script.

## 6. Script (excerpt)

```
00:00  Welcome, consent, recording opt-in.
03:00  Warm-up: "Tell me about a time you shared a document with the government."
08:00  Task 1: "You want a scholarship. The portal needs your income certificate.
        Use this app to share it."
        Observe: do they pause? do they read the minimised list? do they look for purpose?
15:00  Task 2: "Now imagine you changed your mind. Take back what you just shared."
        Observe: where do they look? how long?
25:00  Task 3 (a11y panel): "Read me what your screen reader / magnifier just said."
35:00  Open questions, debrief.
45:00  Close, thanks, payment confirmation.
```

## 7. Metrics

| Metric | Target | How measured |
|---|---|---|
| Task 1 completion | ≥ 90% | observer scoring |
| Task 1 understanding (recall of fields shared) | ≥ 80% | post-task probe |
| Task 2 time-to-revoke | median ≤ 30 s | timestamped |
| Task 2 completion | ≥ 90% | observer scoring |
| SUS score | ≥ 75 | post-test |
| Net consent comprehension | ≥ 80% correct on 5-item probe | post-test |
| Errors (mis-share) | 0 | observer scoring |
| Critical incidents (distress, confusion > 60 s) | 0 | observer note |

## 8. Analysis & evidence

- Affinity-mapped findings in `usability/<study>/findings.md`.
- Severity-ranked (Critical / Major / Minor) with linked frames and code locations.
- Tagged to surface, principle, and (if a design system change) token / component.
- Evidence pack: redacted recordings (if opt-in) + transcripts + notes, signed and stored at `evidence/usability/<study>.tar.gz` with cosign signature.

## 9. Acceptance (study itself)

- [ ] Privacy review signed before recruitment.
- [ ] Pilot done; script refined.
- [ ] Consent forms signed and stored (encrypted).
- [ ] No real PII used.
- [ ] All planned sessions run OR documented reason for shortfall.
- [ ] Findings published with severity and owners.
- [ ] Critical / Major findings have remediation PRs opened within 5 BD.
- [ ] Participant data deletion requests honoured.

## 10. Output

- `usability/<study>/findings.md`
- `usability/<study>/raw/` (encrypted, retention 90 d)
- `evidence/usability/<study>.tar.gz` (signed)
- For citizen-wallet / consent-ui studies: a public summary (sanitised) on the public portal.
