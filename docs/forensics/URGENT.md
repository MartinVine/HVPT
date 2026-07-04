# ⛔ URGENT — Live production exposures found during the HVPT forensic pass

**Status:** Diagnosis only. **No fix attempted, no production write, no deploy, no Stripe/Netlify mutation.** Per the forensic-pass STOP rule, work halted on discovery and these findings are flagged for Martin to action.
**Date:** 2026-07-04
**Author:** Fable (Claude Code), read-only forensic pass
**Scope of evidence:** LIVE Supabase project `mlllkjnvjowfjysfndhu` (train-hvpt) — deployed edge-function source read via the Supabase Management API, and read-only `SELECT` queries. Client app source (hvpt-app / hvpt-admin) was **not** accessible this session, so every item below is server-side; client-side exposures are not yet assessed.

> **Why this file exists.** The kickoff says: *"if you discover an active production risk (e.g. a live security exposure, money-flow defect currently harming members), STOP and write `/docs/forensics/URGENT.md` with the finding. Do not attempt a fix."* These items are **new** — they are not among the four known defects the PRD names. They are reported here so Martin can decide remediation urgently and separately from the forensic pass.

---

## Severity summary

| # | Finding | Type | Live-reachable now? | Severity |
|---|---|---|---|---|
| U1 | `ai-member-assessment` IDOR — any member reads any member's medical data | Data exposure (PII/medical) | Yes — any authenticated member JWT | **Critical** |
| U2 | Three edge functions deployed `verify_jwt=false` (unauthenticated) | Auth bypass / phishing / cost | Yes — anyone on the internet | **High** |
| U3 | SECURITY DEFINER RPCs still anon-executable (Phase-0 hardening incomplete) | Auth bypass / enumeration / griefing | Yes — anonymous (no login) | **High** |
| U4 | Two `auth`-schema RPCs granted to `authenticated` | Privilege / account takeover surface | Yes — any authenticated member | **High** |
| U5 | Zero-credit waitlist promotions never charged (money leak) | Money-flow (revenue leak) | Yes — ongoing, latest 2026-07-01 | **Medium** (known defect, confirmed live) |
| U6 | Two active paid subscriptions with no `stripe_subscription_id` | Money-flow (unbillable members) | Yes — period ended 2026-07-01 | **Medium** |
| U7 | `purchase-payg-credits` → webhook metadata never consumed | Money-flow (latent) | **No live occurrences** — verify before acting | **Medium-latent** |

None of these should be "fixed" from this forensic pass. U1–U4 are security exposures that warrant action **before** the forensic pass resumes; U5–U7 are money-flow items for the defect register and Harry/accountant follow-up.

---

## U1 — `ai-member-assessment`: any member can read any other member's medical data (IDOR) — **CRITICAL**

**Function:** `ai-member-assessment`, LIVE v14 (deployed 2026-04-07), `verify_jwt=true`.
**Evidence:** `scratchpad/evidence/02-edge-functions-A.md §6` (deployed source).

The function takes `member_id` **straight from the request body** and performs **no in-code authorisation** — no `auth.getUser()`, no ownership check, no `is_admin()` gate. `verify_jwt=true` only proves the caller holds *some* valid member token. It then reads, with the service-role client (RLS bypassed):

- `profiles.select('*')` **including `parq_data`** (PAR-Q health-screening / medical answers)
- `weights_log`, `body_measurements`
- `session_notes`, `member_session_comments` (Harry's private notes about the member)
- `bookings`/`classes`/`class_types`, `pt_bookings`, `plans`

…feeds them to the Anthropic API, and returns the generated assessment to the caller.

**Impact:** any logged-in member (67 active) can retrieve a coaching assessment built from **any other member's medical and personal data** by passing that member's id. This is a live confidentiality breach of health data. By contrast the sibling function `coach-assistant` *does* have an admin gate — so the correct pattern exists in the codebase and was simply not applied here.

**Secondary:** the Anthropic error body is relayed verbatim to the caller (`detail: errText`) — can leak upstream account detail; `profiles.select('*')` overfetches medical fields to a third-party API even in normal use.

---

## U2 — Three edge functions deployed unauthenticated (`verify_jwt=false`) — **HIGH**

**Evidence:** `scratchpad/evidence/02-edge-functions-A.md`, `03-edge-functions-B.md` (deployed source + version table).

| Function | Live version | What an unauthenticated caller can do |
|---|---|---|
| `send-group-pt-emails` | v13 | Send branded emails from HVPT's domain to arbitrary recipients, **including arbitrary payment URLs** → open-relay / phishing vector on `harryvinept.co.uk` reputation. |
| `send-free-class-confirmation` | v13 | Trigger branded confirmation emails to arbitrary addresses. |
| `send-diana-welcome` | v1 | One-shot hardcoded email to a single real person (`dianaloganr9@gmail.com`) about a trial that ran 14 May–11 Jun 2026 — a manual patch, now dead, still publicly invocable. Should be deleted. |

`check-split-payment-deadlines` (v14) is also `verify_jwt=false`, but is idempotent by design (status-gated) — abuse is limited to forcing sweeps early and burning Stripe quota; noted, lower urgency. `stripe-webhook` is correctly `verify_jwt=false` **and** signature-verified — that one is fine.

**Impact:** the three mailers are a spam/phishing surface on Harry's sending domain and can damage email deliverability/reputation. No authentication is required to abuse them.

---

## U3 — SECURITY DEFINER RPCs still anon-executable — Phase-0 hardening incomplete — **HIGH**

**Evidence:** `scratchpad/evidence/04-live-behavioural.md §16` (live `pg_proc` + advisor lints; full verbatim sources captured); corroborated on staging in `01-staging-schema-rls-rpc.md`.

The May-2026 audit's "anon-executable SECURITY DEFINER RPCs (since hardened in Phase 0)" is **only partially true on live.** 12 SECURITY DEFINER functions retain EXECUTE grants to `anon`/PUBLIC. Advisor lints confirm it. The genuinely dangerous ones (no internal auth gate, write/notify/probe side effects, no rate limiting):

- `reconcile_waitlist_offers(p_class_id)` — **no auth gate**; anon can force offer generation, waitlist reordering, notification inserts and push sends for any class id.
- `reorder_waitlist_positions(p_class_id)` — **no auth gate**; anon mutates `bookings` waitlist positions for any class.
- `notify_guest_booking(...)` — **no auth gate**; anon injects arbitrary "Guest Booking" notifications to all admins.
- `check_guest_phone(...)` — membership-status **enumeration oracle** by phone number.
- `book_free_class(...)` — intentionally public but **unthrottled**; anon can insert unlimited booking rows + admin notifications.
- `record_group_pt_payment(...)` — flips participants to paid given a uuid token, accepting a **client-supplied Stripe intent string with no server-side Stripe verification**.

`admin_cancel_class` is also anon-granted but self-gates on `is_admin()`, so anon calls no-op — the grant is wrong but not exploitable. Note the broader pattern: ~127 further definer RPCs are executable by any `authenticated` member protected only by hand-rolled in-body auth — one missing guard is an escalation.

---

## U4 — Two `auth`-schema RPCs exposed to `authenticated` — **HIGH**

**Evidence:** `scratchpad/evidence/01-staging-schema-rls-rpc.md` (RPC grant audit).

- `fix_auth_user_null_tokens` — **`UPDATE`s `auth.users`** — a data-plane role should never be able to write the auth schema.
- `get_auth_user_by_email` — returns **any user's `uuid` by email address** — an account-enumeration / targeting primitive.

Both are granted to the plain `authenticated` role. Neither belongs in the app role's grant set. (Flagged on staging; grant parity on live should be confirmed as part of remediation — same schema lineage.)

---

## U5 — Zero-credit waitlist promotions are never charged (money leak) — **MEDIUM (known defect, now confirmed live)**

**Evidence:** `scratchpad/evidence/04-live-behavioural.md §4–5.` This is the PRD's known **"waitlist zero-credit acceptance gap"** — reported here because it is confirmed *actively occurring on live*, not because it is new.

`admin_promote_waitlisted` promotes a waitlisted member to a confirmed booking with `credit_charged=false` and `payment_status='pending'` — and **nothing ever collects that pending payment.** 8 promoted bookings all-time carry `credit_charged=false` (7 still confirmed), the member self-confirm path gates correctly but the **admin promote path is the leak**; latest 2026-07-01. Low absolute money value, but every admin promotion of a zero-credit member is an uncollected class. Goes to the defect register; no fix here.

---

## U6 — Two unbillable active subscriptions — **MEDIUM**

**Evidence:** `scratchpad/evidence/04-live-behavioural.md §2.` Two active paid "8 Classes / Month" subscriptions (created 2026-06-15 and 2026-06-17) have **no `stripe_subscription_id`**; `current_period_end=2026-07-01` (now elapsed). These members are receiving service with **no Stripe subscription to bill** — no July payment can be collected via Stripe for them. Also: 10 of 67 active members have no active subscription row, 14 of 67 have no `stripe_customer_id`. Flag for Harry/reconciliation; no fix here.

---

## U7 — `purchase-payg-credits` metadata never consumed — **MEDIUM, LATENT (verify before acting)**

**Evidence:** `scratchpad/evidence/03-edge-functions-B.md §7 + cross-function D1.` `purchase-payg-credits` sets `metadata.type='payg_credit_purchase'` on the **checkout session only** (not on `payment_intent_data`), and `stripe-webhook` has **no branch that consumes it** — so a completed PAYG-pack purchase would take payment and **never grant credits**, and would additionally crash into the subscription path (masked as HTTP 200).

**Why latent, not active:** live `payments` shows **zero `payg_credit_purchase` rows ever** — members are not currently using this path (the working in-app paid route is `credit_topup`, healthy, 15 payments in June). So this is a live *trap* waiting for the first user, not a defect currently harming members. **Verify against the Stripe dashboard before any action.** Register item.

---

## What was NOT done (and why)

- **No remediation.** Not one of these was fixed. Fixing live is explicitly out of scope for the forensic pass and several fixes (revoking grants, flipping `verify_jwt`, adding auth checks) are live changes that need their own change-controlled step with Martin.
- **No client-side assessment.** hvpt-app / hvpt-admin source was inaccessible this session (repo-access blocker) — client-side exposures are not yet covered. The forensic pass is paused pending that access.

## Suggested triage order (for Martin — not executed)

1. **U1** first (medical-data IDOR) — add an ownership/admin gate to `ai-member-assessment` mirroring `coach-assistant`.
2. **U2** — set the three mailers to `verify_jwt=true` (or internal-only), delete `send-diana-welcome`.
3. **U3/U4** — revoke `anon`/`authenticated` EXECUTE on the listed RPCs; add auth gates to the waitlist/guest functions.
4. **U5/U6/U7** — money-flow follow-up with Harry + accountant; U7 verify in Stripe before touching.

*End of URGENT report. No fix implemented, per task constraints.*
