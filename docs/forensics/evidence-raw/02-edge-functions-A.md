# Edge Functions Forensic Evidence — Batch A (13 functions)

Source: **deployed** source read from LIVE project `mlllkjnvjowfjysfndhu` (train-hvpt) via Supabase Management API, 2026-07-04. All timestamps UTC. Read-only audit; no functions were deployed or modified.

Batch: activate-arrears-billing, activate-billing, admin-change-plan, admin-custom-charge, ai-member-assessment, check-split-payment-deadlines, cleanup-deleted-accounts, coach-assistant, create-checkout-session, create-group-pt-checkout, create-payg-checkout, create-portal-session, admin-cancel-class.

---

## 0. Version-drift table — live `mlllkjnvjowfjysfndhu` vs staging `gkdhbeoxreyzjwjitykq`

Version counters are per-project (staging was bulk-seeded ~2026-05-27/29), so the **updated_at and bundle sha are the meaningful drift signal**, not the version number.

| Function | LIVE version (updated_at) | STAGING version (updated_at) | Drift note |
|---|---|---|---|
| activate-arrears-billing | v8 (2026-05-13 16:18) | v3 (2026-05-29 15:24) | different sha — staging deployed later than live's last change |
| activate-billing | v9 (2026-05-27 11:46) | v4 (2026-05-29 15:24) | different sha |
| admin-cancel-class | v2 (2026-06-13 19:30) | v6 (2026-06-13 12:49) | **sha IDENTICAL** (`c876e76b…`) — in sync |
| admin-change-plan | v29 (2026-04-15 14:41) | v3 (2026-05-29 15:24) | different sha |
| admin-custom-charge | v4 (2026-05-03 10:54) | v3 (2026-05-29 15:24) | different sha |
| ai-member-assessment | v14 (2026-04-07 07:35) | v2 (2026-05-27 09:52) | different sha |
| check-split-payment-deadlines | v14 (2026-06-23 09:07) | v7 (2026-06-22 15:22) | **sha IDENTICAL** (`45039320…`) — in sync |
| cleanup-deleted-accounts | v13 (2026-03-10 07:46) | v2 (2026-05-27 09:52) | different sha |
| coach-assistant | v4 (2026-04-12 10:58) | v2 (2026-05-27 09:52) | different sha |
| create-checkout-session | v26 (2026-06-26 14:23) | v6 (2026-06-22 10:47) | different sha — **live updated 4 days AFTER staging**; staging behind |
| create-group-pt-checkout | v19 (2026-03-06 07:32) | v5 (2026-06-16 20:18) | different sha — staging deployed 3 months after live's frozen code |
| create-payg-checkout | v21 (2026-04-07 16:47) | v3 (2026-05-29 15:24) | different sha |
| create-portal-session | v24 (2026-05-04 14:47) | v3 (2026-05-29 15:24) | different sha |
| create-trial-checkout | v5 (2026-04-23 13:36) | v3 (2026-05-29 15:24) | different sha |
| generate-recurring-classes | v15 (2026-05-22 14:25) | v2 (2026-05-27 09:52) | different sha |
| generate-session-plan | v22 (2026-04-07 07:47) | v2 (2026-05-27 09:52) | different sha |
| invite-member | v40 (2026-04-04 16:12) | v2 (2026-05-27 09:52) | different sha |
| monthly-credit-reset | v16 (2026-05-01 16:05) | v2 (2026-05-27 09:52) | different sha |
| purchase-payg-credits | v4 (2026-04-09 08:51) | v3 (2026-05-29 15:24) | different sha |
| send-diana-welcome | v1 (2026-05-15 11:26) | v2 (2026-05-27 09:52) | different sha; **member-specific function exists in BOTH projects** |
| send-free-class-confirmation | v13 (2026-03-10 11:36) | v2 (2026-05-27 09:53) | different sha |
| send-group-pt-emails | v13 (2026-03-10 13:32) | v2 (2026-05-27 09:53) | different sha |
| send-push-notification | v8 (2026-03-31 08:44) | v2 (2026-05-27 09:53) | different sha |
| stripe-reconcile | v4 (2026-04-21 10:43) | v3 (2026-05-29 15:24) | different sha |
| stripe-webhook | v41 (2026-06-23 15:48) | v6 (2026-06-22 12:10) | different sha — live redeployed after staging |

verify_jwt drift: on LIVE, `stripe-webhook`, `create-portal-session`, `create-group-pt-checkout`, `generate-recurring-classes`, `cleanup-deleted-accounts`, `send-free-class-confirmation`, `send-group-pt-emails`, `check-split-payment-deadlines`, `monthly-credit-reset`, `create-trial-checkout`, `send-diana-welcome` all have `verify_jwt=false`. On STAGING only `check-split-payment-deadlines` and `stripe-webhook` are `verify_jwt=false` — every other function is `verify_jwt=true`. So several endpoints that are open on live (e.g. `cleanup-deleted-accounts`, `create-portal-session`, `create-group-pt-checkout`) are gated on staging: **staging does not faithfully reproduce live's auth surface**.

---

## 1. create-checkout-session — LIVE v26 (2026-06-26), verify_jwt=true

**Purpose.** Member-app entry point to Stripe Checkout. Handles `subscription` (disabled), `credit_topup` (doubles as the paid class-booking path), `pt_session`, `pt_pack`.

**Auth.** Platform `verify_jwt=true` plus in-code JWT check: anon-key client with forwarded `Authorization` header → `auth.getUser()`; 401 on missing/invalid. No role check (member-facing). All DB work then via service-role client.

**Request contract.**
- Body: `type` (required), `success_url`/`cancel_url` (required unless `quote===true`), plus per-type: `plan_id` (subscription), `credits` | `class_id`+`class_name`/`class_date`/`class_time` (credit_topup), `slot_date`/`slot_time` (pt_session), `package_id` (pt_pack), `quote` (bool).
- Responses: 204 OPTIONS; 405 non-POST; 401 missing/invalid auth; 404 profile not found; 400 missing type/urls, missing plan_id/package_id, invalid plan/package; **503 `type==="subscription"` (stopgap)**; 409 `no_active_subscription` / `unlimited_not_applicable`; 403 `parq_incomplete`; 200 `{status:"class_full"}`; 200 `{amount_pennies}` (quote); 200 `{url}`; 500 catch-all with raw error message.

**State vs June diagnosis (v24, 18 June).** Live is now **v26 (26 June 2026)** — it HAS changed since v24:
- The four types + `else → 400 "Unknown type: ${type}"` structure is unchanged; the subscription 503 stopgap is still in place, with the original implementation kept in a comment block ("STOPGAP … Phase 2 pro-rata + 1st-of-month anchor logic … See Notion task 'Migrate Amanda + Chris May Stripe billing anchors to 1st-of-month'").
- There is **still no `payg_class` type**. However, the `credit_topup` branch now explicitly carries the in-app paid-booking flow: header comment says "Doubles as the single in-app PAID BOOKING path: when a class_id is present, this books that class via the webhook + the book_paid_class RPC (no credit retained)". So the June "member pay-per-class is broken" gap appears to have been rerouted through `credit_topup + class_id` rather than a new `payg_class` branch.
- **Remaining gap:** the branch requires `member_subscriptions.status='active'` (`409 no_active_subscription` otherwise). A member with **no active subscription row** (true PAYG member in-app) still cannot pay for a class through this function; the unauthenticated `create-payg-checkout` (£10 flat) is the only fallback and it doesn't book a specific class row.
- Hardcoded `TOPUP_PRICE_MAP` is gone; price is derived from `membership_plans.price_pennies / credits` (comment: "The old hardcoded TOPUP_PRICE_MAP is deleted: the plan rate is now read live from membership_plans (single source of truth)"). `FLAT_PAYG_PENNIES = 1000` (£10) remains hardcoded for 0-credit plans.
- New quote mode (`quote:true` → `{amount_pennies}` without a Stripe session).
- v26 bundles the new `_shared/stripe.ts` + `_shared/stripe-guard.ts` key-mode guard (see cross-function section) and uses `getStripe()`.

**Tables.** Read: `profiles` (id,email,names,stripe_customer_id,parq_completed), `member_subscriptions`+joined `membership_plans` (credits, price_pennies, unlimited_classes), `classes` (capacity,cancelled), `pt_packages`. Write: `profiles.stripe_customer_id` (+updated_at). RPC: `get_total_class_booked(p_class_id)`. No other function invoked directly (booking completion delegated to stripe-webhook → `book_paid_class` RPC per comments).

**Stripe.** `customers.create` (GB address, `supabase_user_id` metadata); `checkout.sessions.create` mode=payment with `price_data` built server-side (credit_topup) or fixed price IDs: `PT_PRICE_ID = "price_1T2WoOPU8I6te6lMMxPyja3Q"` (hardcoded £40 PT session) and `pt_packages.stripe_price_id` (DB-driven). Metadata written on both session and payment_intent: `type`, `credits`, `class_id`, `class_name/date/time`, `package_id`, `sessions`, `supabase_user_id`, `description`. **No idempotency keys on any call.**

**Notifications.** None sent here.

**Error handling.** Single try/catch around all branches; logs `console.error("[create-checkout-session] Error:", message)` and returns the **raw Stripe/DB error message to the client** (500). Profile/sub/class reads ignore their `error` objects (`const { data: profile } = ...`) — a transient DB error is indistinguishable from "not found"/"no subscription", so a DB blip on the sub lookup would 409 `no_active_subscription` (masking cause). Availability pre-check TOCTOU is acknowledged in a comment ("covered by the webhook refund path").

**Verbatim (load-bearing).**
- ~L120: `if (type === "subscription") { return jsonResponse({ error: "Online membership signup is temporarily unavailable. Please contact Harry directly to get set up." }, 503);` followed by ~40 lines of commented-out original implementation ("--- ORIGINAL IMPLEMENTATION — restored by Phase 2 Team B fix ---") — a **dead branch kept live in the deployed bundle**.
- ~L30: `const FLAT_PAYG_PENNIES = 1000; // £10`; ~L32: `const PT_PRICE_ID = "price_1T2WoOPU8I6te6lMMxPyja3Q"; // £40` — hardcoded live price ID.
- credit_topup pure top-up clamps `credits = Math.max(1, Math.min(20, parseInt(body.credits, 10) || 1))`.

**Defects/fragilities.** (a) No idempotency keys → duplicate checkout sessions possible on client retry (low harm, but inconsistent with the arrears/activation functions). (b) `class_full` and quote return 200 while other domain failures use 4xx — inconsistent signalling clients must special-case. (c) The 503 stopgap means the public site's plan-signup flow is dead until Phase 2 lands; the error copy hardcodes "contact Harry directly". (d) DB read errors silently coerced into domain errors (above).

---

## 2. activate-arrears-billing — LIVE v8 (2026-05-13), verify_jwt=true

**Purpose.** Admin-triggered Step 1 of the first-card flow for the four in-arrears Glofox-migration members; creates a setup-mode Stripe Checkout link for card capture. Step 2 lives in stripe-webhook (`metadata.intent === 'arrears_activation'`).

**Auth.** JWT required; then service-role read of `profiles.role`; `role !== 'admin'` → 403. Solid two-layer admin gate.

**Request contract.** POST `{ member_id (required), success_url?, cancel_url? }` (defaults `https://hvpt-app.netlify.app/?arrears=success|cancelled`). Responses: 401/403 auth; 400 invalid JSON, missing member_id, member not found, no subscription, `status!=='active'`, already activated (`stripe_subscription_id` set), `awaiting_activation !== true` ("Shape I" gate), no plan, plan has no `stripe_price_id_may`; 200 `{checkout_url, customer_id, has_saved_payment_method, member{...}, plan_name, monthly_price_gbp}`; 500 catch-all in the Deno.serve wrapper.

**Tables.** Read: `profiles`, `member_subscriptions` (+`membership_plans!plan_id` join incl. `stripe_price_id_may`). Write: `profiles.stripe_customer_id`. No RPCs, no function calls.

**Stripe.** `customers.create` (idempotency key `hvpt-arrears-customer-${KEY_VERSION}-${memberId}`); `paymentMethods.list` (non-fatal probe for admin UI wording); `checkout.sessions.create` mode=setup, `payment_method_types: ["card","link"]`, metadata `{intent:'arrears_activation', member_id, plan_id}`, idempotency key `hvpt-arrears-setup-${KEY_VERSION}-${memberId}-${yyyymm}`. Price source: `membership_plans.stripe_price_id_may` (DB-driven; "May price" column name is itself a migration artefact).

**Notifications.** None (URL is returned for Harry to send via WhatsApp manually).

**Error handling.** Good: per-write persistence ordering documented ("Persist before creating the Checkout session — … a re-click sees the saved customer_id"). paymentMethods probe failure only `console.warn`s. Outer catch returns raw error message 500.

**Verbatim (suspicious/load-bearing).**
- Header comment names members: "the four in-arrears Glofox-migration members who never had a Stripe customer created (**Will Spencer, Jennie May, Julia Parry, Taylor Vine**)" — member-specific cohort function.
- ~L70: `const KEY_VERSION = "v2";` with comment "v2 (12 May 2026 evening): busts the v5 W1.5-broken-deploy cache. v5 submitted Checkout-session-create calls without payment_method_types, Stripe bound those (broken) params … v6's corrected-params retries got rejected." — evidence of a broken deploy poisoning Stripe idempotency cache in production.
- "Invariant 10: never hard-restrict to [\"card\"] alone … Stripe REQUIRES either payment_method_types or automatic_payment_methods … omitting both causes a 500."
- Uses dependency-injected `HandlerDeps` and raw `new Stripe(..., {apiVersion:'2024-12-18.acacia'})` in the wrapper — **does NOT use the shared `getStripe()` key-mode guard**.

**Defects/fragilities.** `.single()` on `member_subscriptions` by member_id assumes exactly one row per member — a member with two subscription rows errors out as "Member has no subscription" (PostgREST multiple-rows error is swallowed into `subErr`). Default success/cancel URLs hardcode the Netlify app origin.

---

## 3. activate-billing — LIVE v9 (2026-05-27), verify_jwt=true

**Purpose.** One-shot batch activation for the migrated cohort: for each active subscription row without a `stripe_subscription_id`, CALL 1 invoices the full current month immediately; CALL 2 creates a subscription anchored to the 1st of next month with `proration_behavior:'none'`.

**Auth.** JWT + admin role check via service-role `profiles.role` read (comment: "Phase 0 Batch 0. Reject non-admin callers BEFORE any Stripe initialisation… Pattern mirrors admin-change-plan"). 401/403.

**Request contract.** POST `{ dry_run?: boolean (default TRUE), email?: string }`. Response always 200 with `{dry_run, summary:{total,created,skipped,errors}, results:[…]}` (per-member status: WOULD_CREATE / SKIPPED / CREATED / CREATED_WITH_WARNINGS / ERROR); 500 catch-all. **Note: per-member ERRORs still return HTTP 200** — callers must inspect the body.

**Tables.** Read: `member_subscriptions` (+ `profiles!member_id`, `membership_plans!plan_id` joins) where `status='active'` and `stripe_subscription_id IS NULL`. Write: `payments` insert (type='subscription', amount from `plan.price_pennies` — deliberately NOT invoice.amount_paid, see verbatim), `member_subscriptions.stripe_subscription_id`; via shared helper `resetCreditsForBillingCycle`: `bookings` (future_month_booking flip), `member_subscriptions` credit/period columns, `credit_ledger` insert (type='plan_reset'). No RPCs, no function invocations.

**Stripe.** `invoiceItems.create`, `invoices.create` (`auto_advance:true`, `pending_invoice_items_behavior:'include'`), `finalizeInvoice`, `pay`, `retrieve`, `subscriptions.create` — all with idempotency keys `hvpt-activation-(item|invoice|sub)-${member_id}-${yyyymm}`. Race with Stripe's auto-advance worker handled by regex-matching "already finalized|already paid" error messages (fragile string matching, but documented). Price source: DB (`membership_plans.stripe_price_id_may`, `price_pennies`). Metadata: `hvpt_member_id`, `hvpt_plan`, `hvpt_invoice_type:'activation_first_month'`.

**Notifications.** None.

**Error handling.** The best in the batch: strengthened invoice validation (must be `paid` AND `amount_paid >= plan.price_pennies` AND `lines.total_count > 0` — "Catches the C1 empty-finalize failure mode"), CALL 1 failure skips CALL 2, CALL 2 failure after CALL 1 reports "failed after invoice paid" with invoice id for manual recovery. Side-effect errors captured into `side_effect_errors` + status `CREATED_WITH_WARNINGS` (no Stripe rollback, documented). But: `raw new Stripe(...)` (no getStripe guard), and internal results are only in the response body, not logged.

**Verbatim (load-bearing incident evidence).**
- "C1 fix: Stripe API 2022-11-15+ defaults pending_invoice_items_behavior to 'exclude'. Explicit 'include' ensures the pending invoice item … is swept onto this invoice rather than orphaned, which was the **1 May 2026 cohort failure mode (£0 paid invoices, £2,247 intent never collected)**. See HVPT-Billing-Remediation-Plan Phase 1 root cause analysis."
- "That left the 1 May 2026 cohort with £2,247 of paid invoices and zero payments rows (**Migration 168 backfilled the gap**)."
- "Use plan.price_pennies (the canonical contracted amount), NOT invoiceAmountPaid — Stripe's invoice.amount_paid is subject to a read-after-finalize race where it can briefly come back as 0."
- Skip rule: "Skip PT Only (0 credits, £0)" — `row.credits_total === 0 && (plan?.price_pennies || 0) === 0`.

**Defects/fragilities.** (a) Bundles `_shared/credit-reset.ts` — that helper's booking sweep does N+1 per-booking UPDATEs and unchecked write results (its own `{error}`s ignored). (b) Regex-based race handling breaks if Stripe changes error copy. (c) HTTP 200 despite per-member errors.

---

## 4. admin-change-plan — LIVE v29 (2026-04-15), verify_jwt=true

*(Analysed via delegated read of the full 160 KB deployed bundle — single file `admin-change-plan/index.ts`, 636 lines; the bulk is a base64 PNG logo embedded TWICE in email templates. No `_shared` files bundled.)*

**Purpose.** Changes (or first-assigns) a member's membership plan: updates the Stripe subscription with upgrade/downgrade-aware proration, updates DB subscription/credits, writes credit_ledger, inserts an in-app notification, and emails the member via Resend. Header: "Called from the admin portal when Harry changes a member's subscription plan."

**Auth — NOT admin-only despite the name.** JWT via anon-client `auth.getUser()`, then role read via service-role. Lines ~231–236:
```ts
// Allow admins to change any member's plan, OR members to change their own
const isAdmin = callerProfile?.role === "admin";
const isSelfService = member_id === user.id;
if (!isAdmin && !isSelfService) {
  return jsonResponse({ error: "You can only change your own plan" });
}
```
**Any authenticated member can call this with their own member_id and ANY `plan_name`.** If they lack a `stripe_customer_id` (or the plan lacks `stripe_price_id`), the DB is updated anyway with only a `warning` string — i.e. a member can self-assign the top plan and full credits with zero billing. In the no-existing-subscription path they can omit `createStripeBilling` and get a sanctioned free DB-only subscription. **Privilege-escalation / free-plan hole — the headline security finding of this batch alongside ai-member-assessment.**

**Request contract.** POST `{ member_id (uuid), plan_name (string — plans looked up BY NAME, not id), createStripeBilling? (bool, only consulted when no existing subscription) }`. Success 200 `{success, change_type: upgrade|downgrade|new_subscription, effective_date, credits_added, plan_name, credits, credits_remaining, price_pennies, stripe_updated, email_sent, warning}`. **Nearly every error ALSO returns HTTP 200** with `{error}` — missing auth, invalid token, plan/member not found, already-on-plan, DB failure, Stripe errors, and the catch-all all use a `jsonResponse()` whose status defaults to 200. Only the new-sub INSERT failure returns 500; 405 for non-POST. Status-code-based clients read every failure as success. Ordering bug: required-field checks run AFTER the ownership check, so a call without `member_id` gets "You can only change your own plan" instead of "member_id is required".

**Tables.** Read: `profiles` (caller role; member incl. stripe_customer_id), `membership_plans` (by `name`; incl. stripe_price_id, unlimited_classes), `member_subscriptions` (+joined plan). Write: `member_subscriptions` (INSERT new-sub path; UPDATE plan_id/credits_total[/credits_remaining]), `credit_ledger` (types `admin_add` / `admin_remove`), `notifications` (type 'billing'). **No RPCs; no other edge functions.** All via service-role (RLS bypassed).

**Stripe.** `subscriptions.create({customer, items:[{price: newPlan.stripe_price_id}]})` (new-sub path, only when `createStripeBilling===true`); `subscriptions.list({customer, status:'active', limit:1})` — takes `data[0]` blindly (multi-sub customer → arbitrary sub updated); `subscriptions.update(id, {items:[…], proration_behavior: isUpgrade ? "always_invoice" : "none"})`. Prices fully DB-driven — no hardcoded map. **No metadata written; no idempotency keys** — a retried upgrade re-issues `always_invoice` proration. Upgrade test `newPlan.price_pennies >= oldPricePennies` — an equal-price lateral move counts as an upgrade (invoice + "Great news!" email). Raw `new Stripe(stripe@17, '2024-12-18.acacia')` — no shared guard.

**Notifications/emails.** In-app `notifications` insert: upgrade → "Plan Upgraded"; downgrade → "Plan Updated" (+effective date). Email via **Resend** from `Harry Vine Personal Training <noreply@harryvinept.co.uk>` to the member (upgrade/downgrade subjects; inline base64 logo — the 2×65 KB lines). **The new_subscription path sends NO email, NO notification, NO ledger entry** — inconsistent with the other two paths. Price rendered `(price_pennies/100).toFixed(0)` — pence rounded away (£42.50 emails as "£43/month").

**Error handling.** Every branch logs with `[admin-change-plan]` prefix, including `"CRITICAL: Stripe updated but DB failed for ${member_id}"` — but there is **no compensating Stripe rollback**, state is left split, and the response is still HTTP 200. `credit_ledger` and `notifications` insert errors are never checked (silent). Header claim "If Stripe update fails, the database is NOT updated (rollback)" is true only in the Stripe-first ordering sense; the inverse failure is a log line.

**Verbatim (dated business logic, ~L283–289):**
```
// GUARD: Only create a Stripe subscription if the caller explicitly passes
// createStripeBilling=true. The admin portal "Assign Plan" button does NOT
// pass this flag, so no Stripe billing is triggered during plan assignment.
// This keeps migration-period members (pre-1-May) on database-only records.
// Post-1-May, when billing goes live, the admin UI can opt in by sending
// createStripeBilling=true for new paying members.
```
It is now 2026-07-04 — the "pre-1-May" migration guard is past its expiry and the default path still creates unbilled DB-only records. Also ~L309–320: `periodEnd = new Date(now.getFullYear(), now.getMonth()+1, 1)` + `billing_day: 1` hardcoded, while the Stripe subscription (when created) has **no `billing_cycle_anchor`** — Stripe bills on creation date while the DB claims a 1st-of-month cycle: guaranteed period drift.

No member-specific hacks found (grepped for diana/amanda/chris/taylor/jennie/julia/will, TODO/STOPGAP/HACK/FIXME, hardcoded price_/cus_/sub_ IDs — only false positives).

**Defects/fragilities (ranked).** (1) Self-service free-plan escalation (above). (2) Errors masked as HTTP 200 throughout. (3) `.single()` error on `member_subscriptions` conflated with "no subscription" → the code INSERTS another subscription row on a transient/multi-row error — duplicate-sub amplification that then breaks every future `.single()`. (4) Stripe-then-DB with no idempotency/rollback. (5) Downgrade updates plan_id/credits in DB immediately while telling the member it "will take effect from ${effectiveDate}"; downgrade ledger row is `type:'admin_remove', amount: 0` (semantically wrong). (6) Plan lookup by mutable name. (7) `list(limit:1)` wrong-sub risk. (8) `unlimited_classes` used in copy only; `credits` used arithmetically regardless (NaN/null risk if unlimited plans store null credits).

---

## 5. admin-custom-charge — LIVE v4 (2026-05-03), verify_jwt=true

**Purpose.** Admin-only direct off-session charge of a member's saved default card (ad-hoc charges, PT booked in person, etc.), from the admin portal "Custom Charge" modal.

**Auth.** JWT + service-role `profiles.role === 'admin'` check (same two-layer pattern as activate-arrears-billing). 401/403.

**Request contract.** POST `{ member_id, amount_pennies (int, 0 < x ≤ 50000), description (1–200 chars) }`; optional `Idempotency-Key` header. Responses: 400 validation failures / no stripe customer (`code:"no_stripe_customer"`) / no card on file (`code:"no_default_payment_method"`); 404 member not found; **402** for card-decline family (18-code hardcoded set incl. `card_declined`, `authentication_required`, `lost_card`, `stolen_card`…) and for `requires_action` (3DS); 500 other Stripe failures / unexpected PI status / customer lookup failure; 200 `{success:true, payment_intent_id, amount_pennies, last4, audit_warning?}`.

**Tables.** Read: `profiles` (caller role; member lookup). Write: `payments` insert (`type:'custom_charge'`, 7-column "canonical" shape, `stripe_payment_intent_id`). No RPCs; no function invocations.

**Stripe.** `customers.retrieve` (to get `invoice_settings.default_payment_method`), `paymentIntents.create` (`off_session:true, confirm:true`, metadata `{type:'custom_charge', member_id, charged_by_admin_id}`), `paymentMethods.retrieve` (last4 fallback, non-fatal). Idempotency key: client header or **`custom-charge-${memberId}-${Date.now()}`** — the auto-generated fallback is unique per attempt so it provides no retry protection at all (only client-supplied keys do).

**Notifications.** None (no receipt/notification to the member — money can leave their card silently apart from Stripe's own emails, if enabled).

**Error handling.** Careful and explicit: audit-row failure after a successful charge returns `success:true` + `audit_warning` and `console.error`s ("Charge succeeded (PI …) but audit row insert failed … Reconcile manually."). £500 sanity ceiling (`MAX_AMOUNT_PENNIES = 50000`).

**Verbatim.** "Audit trail: payments row inserted on Stripe success only. If the row insert fails AFTER Stripe has charged the customer, we still return success=true (the money moved) plus an audit_warning so the admin can reconcile manually."

**Defects/fragilities.** (a) The `Date.now()` idempotency fallback is decorative. (b) Doesn't use the shared `getStripe()` guard (raw client, apiVersion literal). (c) `last4` extraction path `paymentIntent.charges.data[0]` is stale for newer Stripe API versions (`latest_charge` replaced the `charges` list on PI) — fallback covers it, but the "cheap path" is likely dead code. (d) No member notification for an off-session charge.

---

## 6. ai-member-assessment — LIVE v14 (2026-04-07), verify_jwt=true

**Purpose.** Generates an AI (Claude) coaching assessment for a member from attendance, PT bookings, weights, measurements, notes; written in Harry's voice.

**Auth.** **Platform verify_jwt only — NO in-code auth at all.** No `auth.getUser()`, no role check, and `member_id` comes straight from the body. **Any authenticated member can request an AI assessment of ANY other member's data** (attendance, weight logs, body measurements, PAR-Q data, Harry's private session notes are all fed to the prompt and the response is returned to the caller). This is a cross-member data-exposure hole gated only by "has any valid JWT".

**Request contract.** POST `{ member_id (required), months? (number; default 1; 0 = all time) }`. Responses: 400 no member_id; 500 missing ANTHROPIC_API_KEY; 502 Anthropic API error (with upstream body in `detail`); 200 `{assessment, member_name, generated_at, attendance_rate, period, data_points{…}}`; 500 catch-all raw message.

**Tables (all reads, service-role, RLS bypassed).** `bookings` (+`classes!inner` +`class_types`), `pt_bookings`, `profiles` (full `select('*')` incl. `parq_data`), `weights_log`, `body_measurements`, `session_notes`, `member_session_comments`, `plans`. No writes. No RPCs. External call: `api.anthropic.com/v1/messages`, model hardcoded `claude-sonnet-4-20250514`, max_tokens 1500.

**Stripe.** None.

**Notifications.** None.

**Error handling.** Catch-all 500 with raw message; Anthropic error body relayed verbatim (`detail: errText`) — could leak upstream account info. `aiResult.content[0].text` unguarded — an unexpected response shape throws into the catch-all.

**Verbatim.** System prompt hardcodes the persona: "You are Harry Vine, a 22-year-old personal trainer who runs HVPT … from The Engine Shed in Sharnbrook, Bedfordshire." Query quirk: `.or(\`member_id.eq.${member_id}\`)` on `plans` — a `.or()` with a single condition (leftover from a broader filter), and a string-interpolated filter (injection-shaped, though PostgREST syntax limits practical impact).

**Defects/fragilities.** Missing authorisation is the headline. Also `profiles.select('*')` overfetches (PAR-Q medical answers sent to a third-party API); no admin gate unlike coach-assistant which DOES have one — inconsistent security posture between the two AI functions.

---

## 7. check-split-payment-deadlines — LIVE v14 (2026-06-23), verify_jwt=false

**Purpose.** pg_cron sweep (every 15 min) over pending split-payment Group PT bookings: 12h reminder → 2h final warning → at deadline release slot, refund paid participants, notify everyone.

**Auth.** **None — verify_jwt=false and no in-code check.** Anyone on the internet can POST/GET it. It is designed idempotently (flags/status gates), so the abuse surface is limited to forcing the sweep early, but an attacker can trigger deadline releases/refunds the instant a deadline passes, and hammering it costs Stripe API quota. Comment: "No JWT required — called by pg_cron via HTTP."

**Request contract.** Any method (OPTIONS handled; GET/POST both accepted). No body. Response 200 `{checked, actions[], failures[]}` or **500 if ANY write failed** ("FAIL-LOUD CONTRACT (migration 205 + this rewrite)"), 500 on query error.

**Tables.** Read: `group_pt_bookings` (+`group_pt_participants`, `profiles!lead_member_id`) where status='pending', payment_type='split', deadline not null. Write: `group_pt_bookings.status` ('confirmed' when all paid; 'released' at deadline), `group_pt_bookings.notes` (idempotency flags `12h_reminded`, `22h_warned`), `group_pt_participants.payment_status` ('refunded'), `notifications` insert. Invokes edge function **send-group-pt-emails** via HTTP with `Bearer ${SERVICE_ROLE_KEY}` (types: `slot_released`, `payment_warning_22h`, `payment_reminder_12h`).

**Stripe.** `refunds.create({payment_intent})` per paid participant. Uses shared **`getStripe()` key-mode guard** (one of only two functions in this batch that do). Refund guard: selects on `payment_status === 'paid'` "NOT the separate `paid` boolean — so a refund is attempted at most once".

**Error handling.** The strongest fail-loud design in the batch — every DB write's `{error}` is checked; status flip FIRST gates refunds/emails; flag write FIRST gates warning emails; failures array → HTTP 500 so pg_cron's `cron.job_run_details` records it. The header documents the prior incident verbatim: "The booking stayed 'pending', re-matched the query every 15 minutes, and the branch re-fired — **~20 h of participant email spam + repeated refund attempts** (see decisions/constraint-mismatch-sweep-and-deadline-fix.md)."

**Verbatim (quirks).**
- Threshold windows use 2.25/12.25-hour boundaries (15-min cron slack): `if (hoursRemaining <= 2.25 && hoursRemaining > 0)` labelled "2 HOURS LEFT" but flag string is `22h_warned` — the flag name says 22h, the comment/email type says 2h (`payment_warning_22h`). Naming confusion baked into data (`notes` CSV strings as idempotency store).
- Idempotency flags stored by string-appending to a free-text `notes` column: `notes: (notes ? notes + "," : "") + "22h_warned"`.

**Defects/fragilities.** (a) Unauthenticated trigger endpoint. (b) `notes`-as-flag-store collides with any human use of the notes field. (c) The 22h/2h naming mismatch invites a future dev to "fix" the wrong constant.

---

## 8. cleanup-deleted-accounts — LIVE v13 (2026-03-10), verify_jwt=false

**Purpose.** Daily pg_cron job: anonymises `profiles` where `status='cancelled'` and `scheduled_deletion_at` has passed (GDPR-style 30-day grace).

**Auth.** **None** (verify_jwt=false, no in-code check). Anyone can invoke; effect is idempotent and only fires on rows already past their deletion date, so risk is limited to premature-by-minutes anonymisation — but it's still an open service-role write endpoint.

**Request contract.** Any method; no body. 200 `{processed: n}`; 500 on fetch error (message leaked) or catch-all (`"Internal server error"` — the one function that does NOT leak the raw message).

**Tables.** Read: `profiles` (status='cancelled', scheduled_deletion_at <= now). Write: `profiles` per-row update setting `first_name:'Deleted'`, `last_name:'User'`, `email: deleted_${id}@hvpt.deleted`, nulling phone/dob/avatar/emergency/fitness/parq/notification_prefs/referral_code/**stripe_customer_id**, `status:'deleted'`. No RPCs/functions/Stripe/notifications.

**Error handling.** Per-row errors logged and skipped (`continue`), run continues; count returned. Reasonable for a cron job.

**Verbatim.** Header doubles as an ops runbook: "ACCOUNT RECOVERY (within 30-day grace period) … Go to Supabase Dashboard -> Table Editor -> profiles …" — manual-dashboard recovery procedure encoded in a code comment.

**Defects/fragilities.** (a) Anonymises `profiles` only — bookings, payments, weights_log, session_notes, pt_bookings etc. keep the member_id and their content; "the data has been permanently removed" claim in the comment is only true for profile fields. (b) Nulls `stripe_customer_id` without cancelling any Stripe subscription or noting the customer id anywhere — if a subscription were still live in Stripe it would become unlinked and keep charging. (c) Open endpoint (see Auth).

---

## 9. coach-assistant — LIVE v4 (2026-04-12), verify_jwt=true

**Purpose.** Admin Q&A assistant ("coaching knowledge assistant for Harry") — sends member questions plus optional member profile/nutrition context to Claude; logs every exchange.

**Auth.** JWT + **admin role check** (service-role read of `profiles.role`, 403 otherwise). Correct pattern — highlights ai-member-assessment's missing gate.

**Request contract.** POST `{ question (required), member_name?, member_id?, context? }`. Responses: 401/403; 400 no question; 500 missing ANTHROPIC_API_KEY / Claude API failure (upstream text only logged, generic message returned) / catch-all `'Internal error: ' + message`; 200 `{answer, referred_to_professional, model}`.

**Tables.** Read: `profiles` (role; member context incl. `injuries`), `nutrition_goals` (active, `.single()`). Write: `coach_assistant_log` insert (admin_id, member_id, question, context, response, referred_to_professional). External: `api.anthropic.com`, model hardcoded `claude-sonnet-4-20250514`, max_tokens 1024. REFER-detection: `answer.includes('REFER:')`.

**Stripe/notifications.** None.

**Error handling.** OK. Two silent-ish spots: `coach_assistant_log` insert result unchecked (audit log can fail silently), and `nutrition_goals .single()` errors ignored (fine — treated as "no goal").

**Verbatim.** System prompt embeds business rules in prose: clinical-referral rule 3 ("respond ONLY with: 'REFER: …'"), women's-health rule 4, supplements rule 5, and marketing rule 8 ("reference how HVPT's classes or features can help (e.g. 'More Mobility classes are great for this' …)").

**Defects/fragilities.** Unchecked audit insert; hardcoded model string duplicated across both AI functions.

---

## 10. create-group-pt-checkout — LIVE v19 (2026-03-06), verify_jwt=false

**Purpose.** Stripe Checkout for Group PT: lead booker (authenticated, `type:"group_pt_lead"`) pays their share; participants (unauthenticated, `type:"group_pt_participant"`) pay via emailed `payment_token`.

**Auth.** verify_jwt=false because participants have no account. Lead branch enforces JWT in code (401s); participant branch's only credential is possession of the `payment_token` (single `.single()` lookup in `group_pt_participants`). Token entropy/generation is outside this function; a guessable token would let a stranger *pay* someone's share (low-harm direction) and enumerate participant name/email existence via 404-vs-200.

**Request contract.**
- Lead: `{type:"group_pt_lead", booking_id, lead_token, share_amount, session_type?, date?, start_time?, success_url?, cancel_url?}` → 400 missing trio, 401, 404 profile, 200 `{url}`.
- Participant: `{type:"group_pt_participant", payment_token}` → 400 missing/`"Already paid"`, 404 invalid token, 200 `{url}`.
- else → 400 `Unknown type: ${type}`; 405 non-POST; 500 catch-all raw message.

**Tables.** Read: `profiles`, `group_pt_participants` (by payment_token), `group_pt_bookings`. Write: `profiles.stripe_customer_id`. No RPCs/functions.

**Stripe.** `customers.create` (lead); `checkout.sessions.create` mode=payment with `price_data.unit_amount` = **`share_amount` taken from the client request body in the lead branch** — the lead booker's price is client-controlled (a tampered client could pay 1p for their share; participant branch correctly reads `share_amount` from DB). Metadata `type:"group_pt_payment"`, booking_id, payment_token, supabase_user_id / participant_name. No idempotency keys. Raw `new Stripe(...)` — no shared guard (function predates it; last deployed 2026-03-06).

**Notifications.** None (webhook handles post-payment).

**Error handling.** Catch-all 500 with raw message; `booking` lookup in participant branch ignores its error (falls back to empty labels).

**Verbatim.** `const FALLBACK_SITE_URL = "https://harryvinept.co.uk";` — success/cancel URLs derived from the request `origin` header (attacker-controllable redirect target for checkout return, minor). Lead-branch check: `if (!booking_id || !lead_token || !share_amount)`.

**Defects/fragilities.** (a) **Client-supplied `share_amount` = client-controlled price** (headline defect). (b) No validation that `booking_id`/`lead_token` correspond to a real booking owned by the caller — metadata is written unverified and trusted downstream by the webhook. (c) Oldest deployed billing code still live (Mar 2026); predates the key-mode guard.

---

## 11. create-payg-checkout — LIVE v21 (2026-04-07), verify_jwt=true (metadata) — but see note

**Purpose.** £10 one-time PAYG class purchase for website visitors, optionally tagged with a specific class.

**Auth note (contract mismatch).** The header comment says "Unauthenticated endpoint for website visitors … No Supabase JWT required", and the code contains **no auth logic**, but the platform setting on LIVE is **verify_jwt=true** — so the Supabase gateway rejects tokenless calls. Either the public website sends the anon key as a Bearer (works: anon JWT passes verify_jwt) or this endpoint is currently unreachable from the public site as documented. On staging it is also verify_jwt=true. This doc/config mismatch is worth flagging to whoever owns the website flow.

**Request contract.** POST `{ name, email (both required), class_name?, class_date?, class_time? }` (class fields all-or-nothing via `hasClassDetails`). 400 missing name/email; 405; 200 `{url}`; 500 catch-all raw message.

**Tables.** **None** — no Supabase client at all. The Stripe webhook must reconcile the payment to a member/class purely from metadata (`type:"payg_booking"`, customer_name, customer_email, class_name/date/time — note: **class matched by name/date/time strings, not class_id**).

**Stripe.** `checkout.sessions.create` mode=payment, `customer_email`, `price_data` with hardcoded `PAYG_AMOUNT_PENNIES = 1000; // £10`. No customer object created/linked. No idempotency key. Raw client, apiVersion literal.

**Notifications.** None.

**Error handling.** Minimal; raw error to client.

**Defects/fragilities.** (a) verify_jwt/doc mismatch above. (b) Class identified by display strings in metadata — renaming a class or a time change strands the payment's linkage; also no availability check at purchase time (unlike create-checkout-session's pre-check). (c) £10 duplicated as a magic number here and in create-checkout-session (`FLAT_PAYG_PENNIES`).

---

## 12. create-portal-session — LIVE v24 (2026-05-04), verify_jwt=false

**Purpose.** Creates a Stripe Billing Portal session (payment-method update, invoice history, cancel-at-period-end; plan changes deliberately disabled).

**Auth.** verify_jwt=false at platform, but **in-code JWT enforcement** (401 without valid token) — effective auth is fine; the platform flag is just inconsistent with sibling functions.

**Request contract.** POST `{ return_url (required) }`. 401; 400 no email on profile / missing return_url; 500 customer-create failure (generic message) or portal failure (raw message); 200 `{url}`. Note: `req.json()` is called AFTER the customer-creation block and is un-try/caught — malformed JSON yields an unhandled rejection (Supabase turns it into a 500) rather than a clean 400.

**Tables.** Read: `profiles` (stripe_customer_id, email, names). Write: `profiles.stripe_customer_id` (on-the-fly customer creation for founding members "invited without going through Stripe checkout"). No RPCs/functions.

**Stripe.** `billingPortal.configurations.create` — created **once per warm function instance** and cached in module global `_portalConfigId`; every cold start creates a NEW portal configuration object in the Stripe account (config-object litter, and any dashboard-side config tweaks are bypassed because the function pins its own config). `billingPortal.sessions.create` with that config. `customers.create` as needed. Raw client; no guard; no idempotency keys.

**Verbatim (load-bearing rationale).** "Plan changes are intentionally disabled here: the in-app plan selector (js/stripe.js openPlanChange → admin-change-plan) is the canonical plan-change path … Allowing the portal to also change plans would require a parallel Stripe-price-ID array kept in sync with membership_plans — **exactly the dual-source drift that caused the May 1 price miscarriage**."

Also: header NOTE still points at the **test-mode** dashboard URL: "https://dashboard.stripe.com/test/settings/billing/portal".

**Defects/fragilities.** (a) Per-cold-start portal-config creation (should be a fixed config ID or dashboard default). (b) Unparsed-JSON 500. (c) `subscription_cancel` enabled `at_period_end` — members can self-cancel in Stripe; DB-side subscription rows rely on the webhook to notice.

---

## 13. admin-cancel-class — LIVE v2 (2026-06-13), verify_jwt=true

**Purpose.** Admin cancels a single class occurrence: calls the atomic `admin_cancel_class` RPC (soft-cancel + credit refunds + waitlist clear), then manually dispatches push notifications for cohorts the DB trigger doesn't cover.

**Auth.** JWT; then reads own role **via the user's own client under RLS** (not service-role) — deliberate: "works without SUPABASE_SERVICE_ROLE_KEY — which can be absent on some Supabase deployments (the same gap that 401'd every manual push on the **7 June 2026 staging smoke**)". RPC re-checks `is_admin()` server-side ("the RPC is the real authority; this is the cheap pre-check"). RPC invoked as the admin user, not service-role, so `auth.uid()` is correct.

**Request contract.** POST `{ class_id (required), cancel_reason (required, non-empty) }`. 401/403; 400 invalid JSON / missing fields / RPC domain error (`result.error`); 500 RPC transport error (raw message, logged); 200 = RPC result spread + `pushes:{credit_bookings_triggered, manual_sent, manual_failed, total_attempted}`.

**Tables.** Direct: `profiles` read (own row, RLS). Everything else inside RPC `admin_cancel_class(p_class_id, p_cancel_reason)` — per header comment it touches `classes` (cancelled, cancel_reason), `bookings`, `member_subscriptions` (credit +1), `credit_ledger` (type='cancellation'), and returns `push_targets` + `cash_refund_list`. Invokes edge function **send-push-notification** per de-duped target, forwarding the caller's own JWT (`Authorization: authHeader`).

**Stripe.** None — "Automatic Stripe refunds for cash bookings (manual on purpose)"; the RPC returns `cash_refund_list` "which Harry must refund manually in Stripe — out of scope to automate in v1".

**Notifications.** Push only ("Email notifications … out of scope"): credit-booking members via DB trigger `trg_notify_booking_status`; waitlisted / PAYG-member / trial-member cohorts via manual `Promise.allSettled` dispatch, de-duped by userId, "First occurrence wins (cohort order waitlisted → PAYG → trial)". Copy hardcodes: "…has been cancelled by Harry. We'll be in touch about your refund."

**Error handling.** Good: push failures counted (not fatal), `dispatchPush` swallows fetch exceptions to `false`, idempotent re-call path (`already_cancelled` skips pushes). Soft-cancel rationale documented: "NEVER hard-deletes — the nightly generate-recurring-classes cron would silently resurrect a deleted row."

**Verbatim (security-relevant).** In `dispatchPush`: "send-push-notification has verify_jwt=true; **any valid JWT (admin, anon, service-role) passes the gate**. Forwarding the caller's token removes the dependency on SUPABASE_SERVICE_ROLE_KEY…" — an explicit acknowledgement that send-push-notification is effectively open to any authenticated caller (relevant to whoever audits that function in another batch).

**Defects/fragilities.** Minor: push count accuracy depends on RPC's `push_targets.credit_bookings` tally; `result.error` → 400 regardless of cause (e.g. class-not-found vs already-cancelled distinctions live in the RPC).

---

## Cross-function findings

### Duplicated logic
1. **CORS block** — identical/near-identical `corsHeaders` object copy-pasted into all 13 functions (only variations: method lists `POST, OPTIONS` vs `POST, GET, OPTIONS`, and admin-custom-charge adds `idempotency-key`). One shared constant would do.
2. **`jsonResponse` helper** — re-declared verbatim in at least 8 of the functions.
3. **Stripe client setup** — three generations coexist on live: (i) raw `new Stripe(key, {apiVersion:'2024-12-18.acacia'})` (activate-arrears-billing, activate-billing, admin-custom-charge, create-group-pt-checkout, create-payg-checkout, create-portal-session); (ii) shared guarded `getStripe()` from `_shared/stripe.ts` (create-checkout-session v26, check-split-payment-deadlines v14 — the two most recently deployed); (iii) none (AI functions, cleanup, admin-cancel-class). The guard module's own comment says the API-version literal was "previously duplicated as a literal in 13 fns" — six still carry it. **The key-mode guard only protects functions redeployed since it landed; the older billing functions (portal, group-pt, payg, custom-charge, arrears, activate-billing) would happily run a mis-pasted wrong-mode key.**
4. **Auth boilerplate** — the JWT-verify + admin-role-check block is re-implemented five times with three variants (service-role role read vs RLS self-read vs none).
5. **"Get or create Stripe customer"** — implemented three times (create-checkout-session, create-group-pt-checkout, create-portal-session) with slightly different name-fallback handling; only activate-arrears-billing adds an idempotency key to `customers.create`.
6. **£10 PAYG price** — hardcoded twice (`FLAT_PAYG_PENNIES` in create-checkout-session, `PAYG_AMOUNT_PENNIES` in create-payg-checkout); PT session price is a hardcoded live Stripe price ID (`price_1T2WoOPU8I6te6lMMxPyja3Q`) while plans/packages are DB-driven — three different pricing sources across one checkout function.

### Inconsistent patterns
- **verify_jwt is incoherent**: create-portal-session (needs auth, has in-code auth) is `verify_jwt=false`; create-payg-checkout (documented as public, no in-code auth) is `verify_jwt=true`. Cron functions and webhook are open (expected), but cleanup-deleted-accounts and check-split-payment-deadlines have no shared-secret check at all.
- **Idempotency**: rigorous keyed idempotency in activate-billing / activate-arrears-billing (incl. the KEY_VERSION cache-bust scar) vs none in any checkout-session function vs a decorative `Date.now()` fallback in admin-custom-charge.
- **Error responses**: most functions return raw Stripe/DB error messages to clients (info leak, e.g. create-checkout-session, create-group-pt-checkout, create-portal-session); cleanup-deleted-accounts alone masks with "Internal server error". Domain failures ride on mixed codes (200 `class_full`, 409s, 400s, per-row errors inside HTTP 200 in activate-billing).
- **DB error discipline**: check-split-payment-deadlines checks every write and fails loud (post-incident rewrite); the credit-reset shared helper and most checkout functions ignore `{error}` on reads/writes entirely.
- **AI endpoints**: coach-assistant has a proper admin gate; ai-member-assessment has none — same data sensitivity class, opposite postures.

### Security observations (ranked)
1. **admin-change-plan: self-service privilege escalation** — despite the name and `verify_jwt` gate, the code allows `member_id === user.id` self-service; a member can self-assign any plan by name and, absent a Stripe customer/price (or by omitting `createStripeBilling`), receive full credits with zero billing (only a `warning` string records it).
2. **ai-member-assessment: missing authorisation** — any valid member JWT can pull an AI summary of any other member's PAR-Q/medical, weight, measurements and Harry's private notes by posting an arbitrary `member_id`.
3. **create-group-pt-checkout lead branch: client-controlled `share_amount`** — price for the lead's Stripe session comes from the request body, unvalidated against the booking row.
4. **Unauthenticated mutation endpoints** on live: check-split-payment-deadlines (triggers refunds/releases) and cleanup-deleted-accounts (anonymises profiles) accept anonymous calls; both are idempotent-by-design but have no shared secret, rate limit, or cron-source check.
5. **send-push-notification effectively open** (documented inside admin-cancel-class): verify_jwt=true passes ANY valid JWT, so any member can push arbitrary title/body to any user_id — needs confirming in the batch that owns that function.
6. **Raw error passthrough** to clients across most functions (Stripe error strings, PostgREST messages, Anthropic error bodies in ai-member-assessment's 502 `detail`).
7. **Stripe key-mode guard coverage gap** — only the 2 most recently redeployed functions are protected (see Duplicated logic #3).

### Additional inconsistencies surfaced by admin-change-plan
- **HTTP-200 error masking**: admin-change-plan returns `{error}` with status 200 for nearly every failure (its `jsonResponse` defaults to 200 and call sites omit the status), while its siblings use 4xx/5xx — the worst instance of the batch-wide inconsistent response-code discipline.
- **Expired migration-period logic still live**: the "pre-1-May" `createStripeBilling` guard (admin-change-plan) and the subscription 503 stopgap (create-checkout-session) are both time-boxed stopgaps whose deadlines have passed with the code still deployed.
- **Email duplication**: admin-change-plan embeds full Resend HTML templates (incl. a 65 KB base64 logo, twice) inline, while other flows delegate to dedicated send-* functions — two divergent email architectures.

### Member-specific / incident archaeology
- `send-diana-welcome` exists as a deployed function on BOTH projects (v1 live 2026-05-15) — a per-member ("Diana") welcome-email function left deployed (source not in this batch; flagged for the owning batch).
- activate-arrears-billing names four members in code comments (Will Spencer, Jennie May, Julia Parry, Taylor Vine — note "Taylor Vine" shares the owner's surname).
- create-checkout-session's 503 stopgap comment names "Amanda + Chris" (May Stripe billing anchor migration).
- Incident trail embedded in comments: 1 May 2026 £2,247 uncollected-cohort failure (activate-billing "C1 fix" + Migration 168 backfill); 12 May 2026 idempotency-cache poisoning (KEY_VERSION v2); "May 1 price miscarriage" from dual-source price drift (create-portal-session); ~20h email-spam/refund loop from an unchecked constraint-violating write (check-split-payment-deadlines, migration 205); 7 June 2026 staging smoke 401s from missing SERVICE_ROLE_KEY (admin-cancel-class).
- `membership_plans.stripe_price_id_may` — a month-named price column ("May price ID") is the canonical recurring-price source in both activation flows; a schema smell that will age badly.

### Known-context confirmation
- create-checkout-session: **live has moved to v26 (2026-06-26) since the June-18 v24 diagnosis.** The subscription 503 stopgap, four-type structure and `else → 400 "Unknown type"` are all still present. There is still **no `payg_class` type**; instead v26's `credit_topup` branch explicitly serves as "the single in-app PAID BOOKING path" when `class_id` is supplied (with PAR-Q gate, capacity pre-check, quote mode, plan-formula pricing). Members **without an active subscription row still have no in-app paid-class path** (409 `no_active_subscription`), so whether the June breakage is "fixed" depends on whether affected members hold active subscription rows.
