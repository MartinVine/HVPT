# HVPT Platform — Product Requirements Document

**Version:** 2.0 (DRAFT — for Martin's review, then forensic validation)
**Date:** 3 July 2026
**Owner:** Martin Vine
**Supersedes:** PRD v1.0 (hvpt-app only)

**Status:** Draft. Scope now covers the full ecosystem: hvpt-admin, hvpt-app (member), hvpt-website, and the shared train-hvpt Supabase backend. This PRD is deliberately **solution-neutral**: it defines what the platform must do, not whether we get there by repairing the existing apps or rebuilding. That decision is made at Gate D1 (Section 9) on the evidence of the forensic pass. Items marked ⚠ VERIFY require confirmation against the live codebase.

---

## 1. Purpose & Context

### 1.1 The problem
The three HVPT apps were built ad hoc — features added as ideas arrived, without a governing design. The result is wiring problems within each app and across the ecosystem, recurring defects, and significant ongoing repair time for Martin. Harry reports continuing issues across the member app, admin app, and website.

### 1.2 The goal
A stable, scalable, adaptable platform that Harry and ~68 members can trust, that Martin does not have to constantly repair, and that can later carry an intelligence layer (Section 7). Reached via: comprehensive PRD → forensic pass → repair-vs-rebuild decision → LLDs → TDD implementation with Boris oversight, all in planning mode.

### 1.3 What is fixed regardless of the repair/rebuild decision
- The Supabase backend (train-hvpt) remains the system of record; Stripe webhook remains the source of billing truth
- The Phase 1 ADR stack (Next.js 15 App Router, Supabase SSR, TypeScript, Tailwind, @hvpt/shared, Netlify) applies to any rebuilt or newly written surface
- Delivery rules in Section 9 (TDD, LLD-first, Boris gates, staging-only development, Martin controls merges/deploys)

---

## 2. Users & Roles

| Role | Description | Primary surface |
|---|---|---|
| **Harry (operator)** | Runs the business day to day. Must be able to navigate everything without Martin | hvpt-admin |
| **Martin (oversight)** | Ensures the business runs as intended; receives diagnostics and reports | hvpt-admin + agent reports |
| **Member** | Active paying member | hvpt-app |
| **Trial member** | Prospective member on trial | hvpt-app |
| **PAYG** | Non-member paying per class | hvpt-app |
| **Stand-in trainer** | e.g. Charlotte covering classes; future hires | hvpt-admin (limited) |
| **Prospect** | Public visitor arriving from social media | hvpt-website |
| **Test member** | A permanent test account whose status and membership type can be switched at will (member / trial / PAYG, any plan) — purely for testing | hvpt-app + hvpt-admin |

**Test member rule:** the test account must be excluded from anything real — member counts, leaderboards, revenue and finance reports, the review-request rotation, and any member-facing communications. Exclusion enforced server-side so no surface can accidentally include it.

---

## 3. Admin App (hvpt-admin) — Requirements

The admin app is the centre of the ecosystem — it runs the business. It must be user-friendly for Harry, seamlessly connected to the member app and website, easily configurable, and give insight across the whole business.

### 3.1 Navigation (global)
- Persistent bottom menu on every page
- Scrollable top menu on the dashboard for key items not shown on the dashboard itself
- Every page has a Back option that returns the user to the **previous screen at the previous position** (scroll point and state preserved — e.g. back from a class detail lands on the schedule where they left it, not at the top)

### 3.2 Dashboard
- **Mobile-first:** optimised and tested for perfect alignment on a phone screen — Harry runs the business from his phone. Layout verified on real devices, not just browser resizing, with a test covering it
- Shows current day and date, and **which week of which training block** we are in
- Compact layout — no oversized blocks forcing scrolling. Classes Today, Active Members, Messages, and Revenue all present but significantly smaller
- Quick Actions retained, resized smaller
- Today's Classes retained in current format; PT Sessions Today retained as is
- "Log our Training" must not dominate the screen

### 3.3 Schedule
- Day / Week / Month views retained; day-and-scroll retained
- Reduce wasted space (pill sizing); Add Appointment / New Event / Block Time sized to fit on one row
- Trainer name displayed **by exception only** (default trainer Harry unshown; show name when Charlotte or a future trainer covers)
- Class detail view: header retained; Add Member retained; Detail and Remove retained
- Booked member display: first name + surname initial; show **used/plan sessions (e.g. 5/16)** instead of the word "booked"; show **PAYG** if no plan; show **Trial** for trial members. Identical display treatment for member / PAYG / trial
- Cancelled and Waitlist sections displayed; waitlist includes a **Promote** action for Harry
- PT sessions retained; **session plans and session achievements must transfer to that client's member app** (⚠ VERIFY current data flow)
- Remove the PT Bookings (credits) section
- Harry can **Add One-off Class** or **Add New Recurring Class** from the schedule, choosing class type, plan, and class size in the usual way
- **Booking window rule (system-wide):** members can book up to one month ahead of the current date — their current paid month plus the following month (covered commercially by the one-month notice period). Never more than that.

### 3.4 Members
- Default view excludes invited-but-not-accepted people; they get their own view/filter
- Total member count excludes invited-not-accepted
- Member detail view retained as is

### 3.5 Messages
- Every message triggers a **push notification to Harry** — never just a badge on the bell icon. No exceptions.

### 3.6 Plan
- ⚠ VERIFY: forensic pass to review usage history — is Harry using it properly and consistently?
- **10-minute rule:** the session plan becomes visible in each booked member's app exactly 10 minutes before session start — never earlier.

### 3.7 Training
- Working well; preserve as is. (⚠ VERIFY no hidden coupling before touching anything near it.)

### 3.8 Tools → Social Media
- ⚠ VERIFY: confirm the existing Tools are genuinely unused, then remove Tools from the toolbar and replace with the **Social Media** tool.

### 3.9 Leaderboard (admin side)
- **Month-end automation:** leaderboard result automatically sends a formatted post to the Social Media tool for Harry to paste
- **Prize log:** Harry confirms prize provided; timestamp recorded on confirmation
- **History:** previous winners viewable
- **Referral tool:** believed broken — end-to-end check and repair required

### 3.10 Merch Vouchers
- Voucher issued from admin appears in the member's app
- When Harry clicks Redeem in admin, the voucher **greys out in the member app with redemption date shown**

### 3.11 Finance Report (was Revenue Report)
- Clicking a previous month shows **revenue by category** from a selectable menu — materially better detail than today
- **Accountant-ready monthly report:** each month the app produces a report of company finances in the format the accountant needs, ready to send — the goal is to reduce accountancy costs (⚠ VERIFY the exact format/fields the accountant requires before LLD)
- **Receipt scanning:** Harry can scan a receipt immediately (photo from phone); it is read and categorised automatically and feeds the monthly report. This extends the report from revenue-only to income **and expenses** — requires an expenses data model that doesn't exist today

### 3.12 Request Review
- Once a month, the system randomly selects a member to receive a review request
- **No repeat selection until every member has been asked once** (rotation without replacement)

### 3.13 AI Progress Assessment
- Harry prompted at each month-end to produce the assessment report
- An agent drafts the reports and sends them **from Harry's email, on HVPT-branded templates** (part of the Intelligence Layer, Section 7 — the prompt/workflow ships with core scope, the agent authoring ships in Tier 2)

---

## 4. Member App (hvpt-app) — Requirements

Gateway to all things HVPT: book, pay, cancel, track progress, nutrition, Women's Health. All PRD v1.0 parity requirements carry forward (auth, membership & billing, class booking, credits, waitlists incl. the two known waitlist defects, trials, notifications, PWA behaviour) — plus the following.

### 4.1 Home
- Generally healthy for Martin's account — ⚠ VERIFY consistency across all member accounts (forensic pass to check for account-specific rendering/feature-gate differences, e.g. legacy email-allowlist gating)
- **Top-up credit purchase must be as easy as buying a PT credit**

### 4.2 Leaderboard (member side)
- **Defect:** "Your Position" logic wrong — shows a member as 1st with 1 session attended while correctly absent from the podium. Position logic needs a proper fix, not a patch
- Consistent with admin-side leaderboard data (single source of truth)

### 4.3 Nutrition
- Existing feature is good; the target is integrating Martin's **body composition Claude Project** intelligence into it. Approach unknown — requires its own discovery + LLD before any build. Captured as post-stability roadmap (Section 8), not core scope
- **Session effort feed:** as part of the body composition integration, the app recognises the effort from a member's booked/attended sessions on a given day and feeds it into the tracking — training load informs the nutrition picture automatically rather than being logged by hand. The discovery/LLD must define how "effort" is derived (class type, session duration, PT vs class — ⚠ VERIFY what data exists per session today)
- **Trainer visibility:** Harry can see each member's nutrition tracking from the admin app, so his advice takes it into account. This is core scope (a wiring/visibility requirement on the existing feature, not dependent on the Claude Project integration). Members should be told their nutrition data is visible to their trainer — a line in the app at the point of entry is enough

### 4.4 Session plans & achievements
- PT session plans and achievements recorded in admin transfer to the client's member app (mirror of 3.3)
- Class session plans visible 10 minutes before start per the 10-minute rule (mirror of 3.6)
- **In-session tracking:** at session start time, a Tracking button appears in the member's app. Two candidate flows — the LLD decides which: (a) open the history for that class type, showing previous achievements (e.g. weights per exercise), with an option to start tracking the current session; or (b) go straight to tracking for the current session. Either way, the new session **pre-fills from the member's previous session of that class type**, and the member overtypes with what they actually did, then saves
- **All member tracking is visible to Harry in the admin app** (per-member, per-session)

### 4.5 Merch Vouchers
- Vouchers visible in member account; redeemed vouchers greyed with redemption date (mirror of 3.10)

---

## 5. Website (hvpt-website) — Separate Workstream

The website is **descoped from this PRD into its own piece of work**, run after (or alongside) the app work with its own lifecycle:
- **Its own PRD**, derived from the existing site (content, CTAs, journeys, what converts today)
- **Its own LLD** that explicitly takes the apps into consideration — the integration points below must not break
- **Built with Claude Design**, to the standard of the Clear & Clean site
- **Harry gets Studio access** to edit the site himself, removing the content-maintenance burden from Martin

What this PRD still governs (the contract the website must honour, whoever builds it):
- Trial class booking (Stripe checkout) into the shared backend
- Academy waitlist signup and lead capture into the shared backend
- The one-month booking window and any other server-side business rules

The forensic pass still documents hvpt-website's current wiring into the backend — that becomes an input to the website PRD. Gate D1 for the website is superseded by this workstream decision: it's a Claude Design rebuild by default.

---

## 6. Cross-Cutting Requirements

- **Ecosystem wiring:** admin, member app, and website are seamlessly connected. Every cross-app flow (vouchers, session plans, leaderboard, bookings, waitlist promotion) has a single source of truth in the backend — no duplicated client-side logic
- **Display consistency:** member/PAYG/trial treated consistently everywhere
- **Booking window:** one-month-ahead rule enforced server-side, reflected in all clients
- **Notifications:** push infrastructure that reliably reaches Harry (3.5) and members (waitlist offers, plan visibility, vouchers) — ⚠ VERIFY current channels
- All NFRs from PRD v1.0 Section 5 apply ecosystem-wide (security, TDD, performance, reliability, maintainability, accessibility)

---

## 7. Intelligence Layer (tiered, honest scoping)

The goal: Martin stops being the manual repair crew. Achieved in three tiers, in order. Tier 1 is not optional and is not AI — it is what actually delivers "self-healing" in practice.

### Tier 1 — Foundations (ships with core scope)
- Automated test suite (TDD) so defects are caught before deploy
- Health checks and monitoring: scheduled smoke tests of critical flows (login, schedule load, booking, payment webhook processing) with alerts to Martin
- **Invariant monitors on money flows:** automated checks that credits ledger, bookings, and Stripe events reconcile; anomalies alert, they do not block
- **Versioned deploys with one-click rollback to last known good** (Netlify deploy history for the front-ends; migration discipline + staging for the backend). This is the realistic "fall-back to last known good"
- Structured logging so an agent (Tier 2) has something useful to read

### Tier 2 — Harry feedback loop + diagnosis agent
- In-app "Report a problem" for Harry: plain-English description of what the app is or isn't doing well
- A coordinator agent (Claude API) receives the report, gathers relevant logs/context, and produces a structured diagnosis for Martin: what's wrong, likely cause, proposed fix, blast radius
- The month-end AI Progress Assessment authoring/sending agent (3.13) lands here
- Martin's SUSE agent-team pattern (specialist agents + central coordinator) is the reference architecture, adapted for this account

### Tier 3 — Moderator agent
- An **asynchronous** reviewer of transactions and interactions: samples/reviews activity against expected paths, flags deviations and emerging breakage to Martin
- Explicitly **never inline** in live money flows — it observes and reports; it does not approve or gate live transactions. Inline gating would add latency, cost, and a new failure mode to the flows that must never break
- Findings feed the same diagnosis pipeline as Tier 2

Each tier gets its own LLD and Boris review before build. Tiers 2–3 start only after core scope is stable in production.

---

## 8. Post-Stability Roadmap (not in core scope)

1. Nutrition × body composition Claude Project integration (4.3) — discovery first
2. Online coaching module
3. Exercise library, progress photos & measurements
4. Community features
5. Anything the forensic pass classifies as absent/aspirational

---

## 9. Delivery Rules & Decision Gate

1. **Sequence:** PRD locked → forensic pass (all three apps + backend wiring) → **Gate D1: repair vs rebuild decision** → LLDs → build
2. **Gate D1:** the forensic pass ends with an evidenced recommendation per app: (a) existing app is 100% repairable to this PRD, with effort estimate and residual-risk statement, or (b) rebuild + migration is the right path. Boris reviews the recommendation. **Martin decides.** The answer may differ per app
3. **Isolation:** all work against staging Supabase + Stripe test mode. No writes to live (ref `mlllkjnvjowfjysfndhu`) during forensics or build. Live apps keep serving members until any planned cutover
4. **LLD-first:** every new or reworked code surface has an approved LLD before implementation
5. **TDD:** tests first, seen to fail, then code. No merge without passing tests
6. **Boris at every gate**, findings to `/decisions/GATE-[N]-boris-review.md`. Boris flags; Martin decides
7. **Martin controls all merges, pushes, deploys.** Claude Code runs in planning mode with native permissions

---

## 10. Success Criteria

- Every requirement in Sections 3–6 demonstrably met, each verified by a test
- The named defects fixed: member leaderboard position logic, referral tool, waitlist zero-credit gap, waitlist join UX
- Martin's repair time drops to near zero; issues surface via monitoring/agents before Harry or members report them
- Rollback to last known good demonstrated in anger (test exercise) in under 5 minutes
- Harry navigates the admin app without Martin's help
- Website conversion criterion moves to the separate website workstream (Section 5)

---

## 11. Open Questions

1. All ⚠ VERIFY items above
2. Full defect list from Harry — his "plenty of issues" should be captured verbatim as an input to the forensic pass (worth 30 minutes with him before CC runs)
3. Push notification infrastructure: what exists today vs needs building
4. Social Media tool: current capability and where the leaderboard automation plugs in
5. Which surfaces the D1 decision splits across (repair some, rebuild others?)
6. PT session plans/achievements: current data model and whether transfer is a wiring fix or new build
7. Finance report: confirm with the accountant the exact monthly format and categories they need (one email — saves designing the wrong report)
