# Usability Test Plan — US-001: Consent Grant Flow

| Field | Value |
|---|---|
| Study ID | US-001 |
| Feature | Consent grant flow (W-01 to W-04) |
| Date | 2026-05-17 |
| Facilitator | @ux-researcher (TBD) |
| Observers allowed | Yes (silent) |
| Platform | Web (Chrome/mobile + desktop) |
| Sessions | 8 participants (moderated, remote) |
| Recruiting | General public; 50% rural; 50% 18–40; 50% 40+; 2 with screen-reader use |
| Ethics | Participant consent form required; recordings deleted after analysis; anonymised notes only |

---

## 1. Objectives

1. Validate that citizens understand what they are consenting to **before** submitting
2. Identify comprehension barriers in the Notice screen (W-01) for low-literacy users
3. Measure task completion time and error rate on the Confirm step (W-03)
4. Validate accessibility of the flow for screen-reader users

---

## 2. Research Questions

| ID | Question | Priority |
|---|---|---|
| RQ-01 | Can participants describe (in their own words) what they agreed to after completing the flow? | Critical |
| RQ-02 | Do participants understand they can revoke consent at any time? | Critical |
| RQ-03 | What confusion points arise at the Detail step (W-02)? | High |
| RQ-04 | Is the explicit consent checkbox understood as a meaningful action, not a EULA click-through? | High |
| RQ-05 | Do screen-reader users complete the full flow without assistive technology errors? | High |
| RQ-06 | Do participants trust the "Government-verified partner ✓" indicator? | Medium |

---

## 3. Participant Profile

| Segment | Count | Criteria |
|---|---|---|
| Urban, digital-native | 2 | 18–35, smartphone primary, used at least one fintech app |
| Urban, mid-digital | 2 | 36–55, smartphone user, limited fintech usage |
| Rural, low connectivity | 2 | Any age; mobile internet via 4G; may use Hindi or Marathi |
| Screen reader users | 2 | JAWS/NVDA on desktop; TalkBack on Android |

---

## 4. Task Script

### Pre-task
> "Thank you for joining. We are testing a government data consent portal. We are testing the design, not you — there are no wrong answers. Please think out loud as you go. Do you have any questions?"

### Task T-01 — Grant Consent
> "Imagine you are applying for a home loan at ABC Home Finance. They need to verify your mobile number and bank account. A screen appears asking for your consent. Please go ahead and complete the process."

**Success criteria**: Reaches W-04 (Success screen) and correctly states principal name and data fields when asked.  
**Abandonment criteria**: Participant clicks "Not now" or is stuck for > 3 minutes.

### Task T-02 — Revoke Consent (follow-up)
> "Now imagine you changed your mind. You want to take back the consent you just gave. Can you show me how you would do that?"

**Success criteria**: Navigates to My Consents and finds the Revoke button.

### Post-task questions
1. "In your own words, what did you agree to?" (comprehension — RQ-01)
2. "Can you change your mind about this consent? How?" (revocability — RQ-02)
3. "Was there anything confusing or unclear?" (friction)
4. "How confident did you feel that your data would be protected? (1–5)" (trust)

---

## 5. Metrics

| Metric | Measurement | Target |
|---|---|---|
| Task T-01 completion rate | % participants reaching W-04 | ≥ 87.5% (7/8) |
| T-01 completion time | median seconds from W-01 to W-04 | ≤ 120s |
| Comprehension accuracy (RQ-01) | % correct description without prompting | ≥ 75% |
| Revocability awareness (RQ-02) | % who correctly answer | ≥ 75% |
| Error rate | # misclicks / dead ends per session | ≤ 2 |
| SUS score | System Usability Scale (0–100) | ≥ 70 |
| Screen-reader completion | Both SR users complete T-01 unaided | 100% |

---

## 6. Environment & Stimuli

- Prototype: High-fidelity Figma prototype (or deployed staging environment — TBD)
- Devices: Desktop (Chrome 125+) and Android (Chrome mobile)
- Assistive tech: JAWS 2024 (desktop), TalkBack (Android)
- Locale: EN (sessions 1–6), HI (session 7), MR (session 8)
- Network: Throttled to 4G for rural segment sessions

---

## 7. Session Protocol

| Time | Activity |
|---|---|
| 0–5 min | Welcome, consent form, recording start |
| 5–10 min | Warm-up questions (digital habits, data sharing familiarity) |
| 10–25 min | Task T-01 (think-aloud) |
| 25–35 min | Task T-02 (think-aloud) |
| 35–45 min | Post-task questions + SUS questionnaire |
| 45–50 min | Debrief + any questions |

---

## 8. Analysis Plan

1. Affinity map: cluster think-aloud verbatims by confusion point
2. Severity rating per finding: Critical / High / Medium / Low
3. RQ answers: tabulate per participant; calculate % scores
4. Metrics table vs targets: pass/fail
5. Recommendations report (US-001 findings.md) mapped to component IDs from handoff doc

---

## 9. Deliverables

| Artefact | Path | Due |
|---|---|---|
| This plan | `usability/US-001/plan.md` | Before recruitment |
| Facilitator script | `usability/US-001/script.md` | Before sessions |
| Raw notes template | `usability/US-001/session-notes-template.md` | Before sessions |
| Findings report | `usability/US-001/findings.md` | After analysis |
| Prioritised fix list | `usability/US-001/fix-list.md` | With findings |

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Recruiting rural participants remotely | Medium | Partner with field NGO; phone-in fallback |
| Figma prototype not ready | Low | Use staging environment instead |
| Screen-reader flow not ready | Medium | Block SR sessions until axe scan passes; see interaction-spec acceptance checklist |
| Comprehension scores below target | Medium | Iterate copy before go-live; simplify W-01 body text |
