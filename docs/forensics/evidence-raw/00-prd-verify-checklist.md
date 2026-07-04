# PRD v2.0 — ⚠ VERIFY markers & §11 open questions (working checklist)

Source: docs/prd/HVPT-Platform-PRD-v2.md (commit 8eb7b1e). Each item must be resolved in 02-feature-inventory.md and carried into 06-prd-corrections.md.

## ⚠ VERIFY markers

| # | PRD ref | Item | Evidence needed | Status |
|---|---|---|---|---|
| V1 | §3.3 | PT session plans & achievements transfer to client's member app — current data flow | pt_session_plans / session_plans schema + both apps' read/write paths | pending |
| V2 | §3.6 | Plan usage history — is Harry using it properly and consistently? | live session_plans/plans rows over time, authorship, gaps | pending |
| V3 | §3.7 | Training "working well" — no hidden coupling before touching anything near it | code paths around training/workout tables; shared modules | pending (needs app code) |
| V4 | §3.8 | Tools genuinely unused → replace with Social Media tool | live usage evidence (social_media_posts, tool tables), admin code | pending |
| V5 | §3.11 | Accountant-ready report — exact format/fields required | NOT answerable from code — external input (accountant) | external |
| V6 | §4.1 | Home consistency across all member accounts (account-specific rendering / legacy email-allowlist gating) | app code gates + live profiles variance | pending (needs app code) |
| V7 | §4.3 | Session "effort" derivation — what data exists per session today | attendance, classes, class_types, workout_logs schema/rows | pending |
| V8 | §6 | Notification channels current state | push_subscriptions, notifications, send-push-notification function, app SW code | pending |
| — | §1.0 header | "Items marked ⚠ VERIFY require confirmation against the live codebase" | — | — |

(§3.3 booked-member display, §3.9 referral tool "believed broken", §4.2 leaderboard defect are stated as defects, not VERIFY — they go to the defect register with evidence.)

## §11 open questions

| # | Question | Answerable from code/data? | Status |
|---|---|---|---|
| Q1 | All ⚠ VERIFY items | see above | pending |
| Q2 | Harry's verbatim defect list | NO — missing input, flag in D1 | flagged |
| Q3 | Push notification infra: exists today vs needs building | YES (backend + app SW) | pending |
| Q4 | Social Media tool: current capability, where leaderboard automation plugs in | YES | pending |
| Q5 | Which surfaces D1 splits across | = the D1 deliverable itself | pending |
| Q6 | PT session plans/achievements: data model; transfer = wiring fix or new build? | YES | pending |
| Q7 | Finance report format — confirm with accountant | NO — external (one email) | external |

## Known-defect list (PRD §10 / kickoff)

1. Member leaderboard "Your Position" logic (§4.2)
2. Referral tool end-to-end (§3.9)
3. Waitlist zero-credit acceptance gap
4. Waitlist join UX failure
5. (June 2026 diagnosis) member pay-per-class 0% success — payg_class half-shipped; direction: credit_topup route (decision recorded)

## Session blocker log

- 2026-07-04: `add_repo` for hvpt-app/hvpt-admin/hvpt-website requires an interactive MCP approval this session cannot obtain; GitHub MCP hard-scoped to martinvine/hvpt; git proxy denies out-of-scope clones; netlify.app + WebFetch egress policy-denied. Client-code evidence blocked pending Martin. Backend evidence gathering proceeding (staging + live read-only, both approved).
