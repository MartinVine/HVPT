# Edge Functions — Batch B (forensic evidence)

Project: `mlllkjnvjowfjysfndhu` (train-hvpt, LIVE). Source read from **deployed** function bundles via Supabase MCP `get_edge_function` on 2026-07-04. Read-only; nothing deployed or mutated.

Batch: create-trial-checkout, generate-recurring-classes, generate-session-plan, invite-member, monthly-credit-reset, purchase-payg-credits, send-diana-welcome, send-free-class-confirmation, send-group-pt-emails, send-push-notification, stripe-reconcile, stripe-webhook.

Deployed-version snapshot:

| Function | Version | verify_jwt | Last updated (approx) | Files in bundle |
|---|---|---|---|---|
| stripe-webhook | v41 | **false** | 2026-06-23 | index.ts (2121 lines) + `_shared/credit-reset.ts` (158) + `_shared/stripe.ts` (58) + `_shared/stripe-guard.ts` (98) |
| create-trial-checkout | v5 | false | 2026-04-22 | single file |
| generate-recurring-classes | v15 | false | 2026-05-22 | single file |
| generate-session-plan | v22 | true | 2026-04-08 | single file |
| invite-member | v40 | true | (bundle) | single file (349 lines) |
| monthly-credit-reset | v16 | false | 2026-05-01 | index.ts + `_shared/credit-reset.ts` |
| purchase-payg-credits | v4 | true | 2026-04-09 | single file |
| send-diana-welcome | v1 | **false** | 2026-05-15 (never redeployed) | single file |
| send-free-class-confirmation | v13 | **false** | 2026-03-08 | single file |
| send-group-pt-emails | v13 | **false** | 2026-03-08 | single file |
| send-push-notification | v8 | true | 2026-04-01 | single file |
| stripe-reconcile | v4 | true | 2026-04-21 | single file |

---

## 1. stripe-webhook (v41, 2121 lines) — billing source of truth

### Envelope
- **verify_jwt: false** (required — Stripe cannot send a Supabase JWT). Auth = **Stripe signature verification only**: `stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)` (~L2062). Missing signature → 400; bad signature → 400 with the verification error message echoed in the body.
- Stripe client comes from shared `getStripe()` (`_shared/stripe.ts`), which enforces a **key-mode guard** (`_shared/stripe-guard.ts`): LIVE project ref `mlllkjnvjowfjysfndhu` hardcoded at stripe-guard.ts L31; live env requires `sk_live_`, everything else requires `sk_test_`, fail-closed. Canonical API version `2024-12-18.acacia`.
- Uses service-role Supabase client throughout.

### Error → HTTP mapping (idempotency philosophy)
`webhookErrorResponse` (~L39-50): only `RetryableWebhookError` (thrown solely by the paid-booking refund path) returns **500** so Stripe re-delivers. **Every other handler error returns 200** ("received: true, error: ...") so Stripe never retries — the code's own comment: "most handlers are not retry-safe — a retry could duplicate processing" (~L34-38, 2107-2113). Consequence: **any transient DB failure in invoice.paid, subscription handlers, trial creation etc. silently drops the event** — the money moved in Stripe but the DB write is lost with only a console.error. There is **no event-id ledger / processed-events table**; idempotency is ad hoc per branch.

### Event types handled (switch at L2071-2106)
`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `payment_intent.succeeded`. Default: logged "Unhandled event type" and 200.

#### checkout.session.completed → handleCheckoutCompleted (L287-439)
Two paths on `session.metadata.intent`:
- `intent === "arrears_activation"` → handleArrearsActivation (below).
- **default path assumes a subscription-mode checkout**: `stripe.subscriptions.retrieve(session.subscription)` → resolve plan by `membership_plans.stripe_price_id` (DB-driven pricing). Mirrors the sub's PM to `customer.invoice_settings.default_payment_method`. Links profile by `stripe_customer_id` or by Stripe customer email (writes `profiles.stripe_customer_id`). Computes pro-rata (`calculateProRata` L238-255 — local-time date math, `Math.ceil` credits / `Math.round` pennies, period end = 1st of next month). Writes: **upsert `member_subscriptions`** (onConflict member_id; billing_day=1, status active, awaiting_activation false), **insert `credit_ledger`** (type `plan_reset`), **insert `payments`** (type `subscription`, amount `session.amount_total ?? plan.price_pennies`), **insert `notifications`** ("Welcome to HVPT!").
- **DEFECT**: payment-mode checkouts (trial via create-trial-checkout, PAYG packs via purchase-payg-credits) also fire this event with no `intent` metadata. `session.subscription` is null → `subscriptions.retrieve(null)` throws → masked as HTTP 200 error. Every trial/PAYG-pack purchase produces a spurious handler error in logs; harmless only by accident.

#### handleArrearsActivation (L471-715) — Phase 2 arrears migration
Setup-mode session from activate-arrears-billing. Reads profile + `member_subscriptions` joined to `membership_plans` including **`stripe_price_id_may`** — a month-named column baked into deployed code (L498, 514, 649): `if (!plan?.stripe_price_id_may) { error; return; }`. Row-level idempotency: skip if `stripe_subscription_id` already set. Stripe calls: setupIntents.retrieve, customers.update (default PM), invoiceItems.create + invoices.create (`pending_invoice_items_behavior: "include"` — C1 fix) + race-tolerant finalize/pay (regex-swallow "already finalized|already paid") + authoritative re-retrieve with a 3-way validation gate (paid, amount_paid ≥ plan price, ≥1 line item), subscriptions.create anchored to 1st of next month, `proration_behavior:'none'`. Idempotency keys `hvpt-arrears-{item|invoice|sub}-${member_id}-${yyyymm}`. Writes: `payments` insert (type subscription, note: "defence-in-depth — invoice.paid early-returns when there's no subscription on the invoice"), `member_subscriptions.stripe_subscription_id`, `resetCreditsForBillingCycle`, member notification. All failure paths before the charge are `console.error` + silent `return` (→ 200).

#### invoice.paid → handleInvoicePaid (L722-827)
Profile by `stripe_customer_id` (throws if absent → 200-masked). Reads subscription id from **both** `invoice.parent.subscription_details.subscription` (API 2025+ shape) and legacy `invoice.subscription`; no sub → "one-time payment" skip. Reads `member_subscriptions` + plan; **billing window taken from the invoice's first line-item period** (fallback: calendar month via local-time `new Date(...)`). Then:
- `resetCreditsForBillingCycle` (shared helper, see monthly-credit-reset below) — **destructive overwrite of credits_remaining from the plan**, minus swept future-month bookings.
- insert `payments` (type subscription, `invoice.amount_paid`), clear `profiles.status='payment_issue'` → active, notify "Credits Refreshed".

#### invoice.payment_failed → handleInvoicePaymentFailed (L834-886)
Writes `profiles.status='payment_issue'`, `member_subscriptions.status='past_due'`, `payments` insert (status failed, amount_due), member notification, then **fan-out bell notification to every `profiles.role='admin'`**.

#### customer.subscription.updated (L893-953)
Plan change: resolve plan by price id; if `plan_id` unchanged → no-op. Else proportional credit carry-over: `newRemaining = max(0, newPlan.credits - usedCredits)`; updates `member_subscriptions` (plan_id, stripe_subscription_id, credits), inserts `credit_ledger` typed **`admin_add`/`admin_remove`** for a Stripe-driven change (misleading audit type), notifies member.

#### customer.subscription.deleted → handleSubscriptionDeleted (L970-1052)
**Feature-flagged guard** `WEBHOOK_DELETE_GUARD === "true"` (env secret, L982): when on — (a) role=admin profiles are never cascaded ("admin protection"); (b) cascade only if the deleted sub id matches `member_subscriptions.stripe_subscription_id` (protects the pro-rata bridge pattern where a superseded sub deletes later). **When the env var is unset the legacy unconditional cascade runs**: `profiles.status='cancelled'` + `member_subscriptions.status='cancelled'` + notification — i.e. the fix ships dark and production behaviour depends on an invisible secret.

#### customer.subscription.paused / resumed (L1059-1164)
paused: freezes `credits_remaining` into `credits_frozen_at`, zeroes credits, `profiles.status='suspended'`, ledger type `suspension_freeze` (negative amount). resumed: restores from `credits_frozen_at`, ledger `suspension_restore`, status active.

#### payment_intent.succeeded → handlePaymentIntentSucceeded (L1171-2026) — the metadata.type router
`paymentType = paymentIntent.metadata.type || "subscription"`. Branch order matters:

1. **`credit_topup` WITH `meta.class_id` — "paid class booking"** (L1190-1310). Requires `paymentIntent.customer`; profile lookup by customer id. Idempotent `payments` insert (type stays `credit_topup` because "payments_type_check has no 'payg_class'"; partial unique index on stripe_payment_intent_id, mig 168; 23505 caught + re-select). Short-circuit if row already `refunded`. Calls RPC **`book_paid_class(p_member_id, p_class_id, p_payment_id, p_stripe_pi)`**: `booked` → notify member; `already_booked` → idempotent replay no-op; anything else (`class_full` / RPC failure) → **refund path**: `stripe.refunds.create` with idempotency key `hvpt-refund-${pi}`; refund failure → admin fan-out (`notifyAdminsRefundFailure`, "stuck" escalation after 15 min of payment-row age) + `RetryableWebhookError` → 500 → Stripe re-delivers. Refund success → update `payments` to `refunded` + notify member; bookkeeping failure here is swallowed (200) with a *distinct* admin alert ("Refund recorded late") and reliance on stripe-reconcile to heal. This is the only genuinely retry-safe, carefully engineered branch.
2. **`group_pt_payment`** (L1313-1495). Requires `meta.payment_token`. RPC **`record_group_pt_payment(p_payment_token, p_stripe_payment_intent_id)`**; RPC error is logged but `payments` row (type `group_pt`, member_id = `meta.supabase_user_id` or null) still inserted. If `all_paid`: reads `group_pt_bookings` + `group_pt_participants`, notifies lead, calls **send-group-pt-emails** (`all_paid` to everyone, `parq_reminder` to `parq_status='unknown'`). If split payment and the lead just paid: emails `payment_link` to unpaid non-lead participants with URL `https://harryvinept.co.uk/pages/group-pt-pay.html?token=${payment_token}`. All email fan-out in try/catch, logged-only.
3. **`payg_booking`** (guest, no profile) (L1498-1527). Inserts `payments` (type `payg`, member_id null, guest_name/guest_email from metadata) + `payg_bookings` row (status confirmed) so guests appear in the schedule. No dedup guard on this branch — a Stripe re-delivery would double-insert (payments has the PI unique index; payg_bookings does not).
4. **`trial_booking`** (L1546-1849, "v40 — 15 May 2026 ATOMIC AUTO-CREATE"). Hardcoded `TRIAL_PLAN_ID = "a1000000-0000-0000-0000-000000000099"`. Steps: idempotency via `trial_bookings.stripe_payment_intent_id` + `member_created`; find/update-or-insert `trial_bookings` (paid, amounts, stripe ids); insert `payments` (type `trial`, member_id null, guest fields); find-or-create auth user via RPC **`get_auth_user_by_email`** then `auth.admin.generateLink(type:'invite')` with re-query race recovery ("Variant A/B"); triple failure → admins notified "⚠️ Auto-creation failed — manual invite-member needed" and return. `setTimeout 500ms` wait for the `handle_new_user` profile trigger; update `profiles` (names, phone, stripe_customer_id, status active); create/repoint `member_subscriptions` to the trial plan — including the explicitly-commented **"Diana scenario: signed up as PAYG"** repoint at L1724-1737 (existing sub with wrong plan gets plan_id overwritten to trial, credits zeroed, stripe_subscription_id nulled); link `trial_bookings.member_created/member_id`; backfill `payments.member_id`; **send welcome email inline via Resend** (full HTML template hardcoded in the webhook, L1784-1815, incl. phone number 07775 731570; Variant A includes set-password button with the raw invite link); admin fan-out `notifyAllAdminsTrialPaid` (bell + push via send-push-notification per admin).
5. **`payg_class` — REMOVED, confirmed dead**. L1851-1856 verbatim:
   > `// NOTE: the legacy 'payg_class' branch was removed (migration 204 / unified paid`
   > `// booking). Authenticated paid class bookings now arrive as 'credit_topup' with a`
   > `// class_id ... 'payg_class' was orphaned (it wrote payments.type='payg_class', which payments_type_check rejects) and is no longer sent by the client.`
   This matches the June 2026 diagnosis ("never executed in production") — v41 has deleted the branch rather than fixed it; the constraint-violation root cause is documented in the comment itself.
6. **Catch-all** (L1858-2026): requires `paymentIntent.customer` (else skip); profile lookup; `paymentType === "subscription"` → skip (handled by invoice.paid). **Dedupe guard**: if a `payments` row for this PI already exists → skip (added after the 3 May 2026 Custom Charge duplicate-audit-row incident — the comment names Migration 171 and "cleaned up via MCP"). This is how **`custom_charge`** style server-side-confirmed PIs are handled: the creating function writes its own payments row; the webhook just deduplicates. There is no explicit `custom_charge` branch. Otherwise insert `payments` with `type = paymentType` (arbitrary metadata string → will hit `payments_type_check` for unknown types → thrown → 200-masked). Then sub-branches:
   - **`credit_topup` (no class_id)**: `ledgerEntry()` helper adds `meta.credits` (default 1) credits — **read-modify-write** of `credits_remaining` (L107-139, non-atomic, racy) + `credit_ledger` type `topup`; notify member.
   - **`pt_session`**: with `slot_date/slot_time` inserts `pt_sessions` (end = start + 60 min, status confirmed, payment_id); else falls back to updating `meta.pt_session_id`. Notify.
   - **`pt_pack`**: adds `meta.sessions` to `profiles.pt_credits_remaining` (read-modify-write again) + `pt_credit_ledger` insert (type purchase). Notify.

### Dead/suspicious code in stripe-webhook
- **`TOPUP_PRICE_MAP` (L67-72) and `TOPUP_PAYG_PENNIES` (L73) are defined and never referenced** — hardcoded per-credit price table (8→£6.13, 12→£5.75, 16→£5.00, 20→£4.80, PAYG £10) left as dead constants. Pricing actually flows from `membership_plans.stripe_price_id` / metadata; if a topup-checkout function elsewhere still uses its own map, prices exist in ≥2 disconnected places.
- `metadata.type === "payg_credit_purchase"` (emitted by purchase-payg-credits, below) **has no branch anywhere in this file** — see cross-function findings.
- Hardcoded: trial plan UUID, Harry's phone number in email HTML, `hvpt-app.netlify.app` asset URLs, `harryvinept.co.uk` payment-page URL.

---

## 2. create-trial-checkout (v5, verify_jwt=false)
- **Purpose**: public endpoint; prospect buys the £59 4-week trial via Stripe Checkout. No JWT by design ("Stripe handles payment security").
- **Contract**: POST `{name, email, phone?}` → `{url, session_id}`; 400 missing name/email; **409 `{already_paid:true}`** if a paid `trial_bookings` row exists for the email (email-enumeration side channel: reveals who has bought a trial); 405 non-POST; 500 with raw `err.message`.
- **Tables**: reads `trial_bookings` (paid check), `admin_settings` key `trial_stripe_price_id` (price is DB-config, "set in migration 123" — not hardcoded, though `TRIAL_AMOUNT_PENNIES = 5900` is declared and, notably, **unused**); writes `trial_bookings` insert (pending, keyed by checkout session id) with 23505 fallback to UPDATE by email.
- **Stripe**: `checkout.sessions.create` mode payment, `customer_creation:'always'`, **metadata `{type:'trial_booking', customer_name, customer_email, customer_phone?}` set on BOTH the session and `payment_intent_data`** — this is why the webhook's payment_intent.succeeded trial branch works. Constructs its own `new Stripe(...)` — **bypasses the shared key-mode guard**.
- Success/cancel URLs derived from request `Origin` (fallback `https://harryvinept.co.uk`) — an attacker-controlled Origin can point success_url at their own page (low-risk open-redirect-ish).
- **Error handling**: DB insert/update failures around the pending row are logged and deliberately non-fatal ("let Stripe handle payment, fix the DB async") — checkout URL still returned.

## 3. generate-recurring-classes (v15, verify_jwt=false)
- **Purpose**: keeps ≥4 weeks of future classes; generates today→8 weeks when the latest class is <4 weeks out. Cron-or-manual; `?force=true` (query or body) skips the check. **Unauthenticated** — anyone can force schedule generation (idempotent, so low harm).
- **Tables**: reads `recurring_schedule` (active=true, joined `class_types`), `classes` (latest date); writes `classes` via per-row `upsert(onConflict "class_type_id,date,start_time", ignoreDuplicates)`.
- **Key semantics**: `slot.day_of_week` uses **0=Monday** convention (non-JS-standard; comment at the loop). `instructor: slot.instructor || "Harry Vine"` hardcoded default. Catches exactly SQLSTATE **23P01** (exclusion violation from the migration-180 non-overlap trigger) → slot recorded in `skipped[]` and generation continues; any other insert error aborts the run. Rich JSON response (generated/attempted/skipped/window).
- No Stripe, no notifications. Errors: thrown → 500 `{error}`; skips logged.

## 4. generate-session-plan (v22, verify_jwt=true)
- **Purpose**: AI session generation (fresh / progression / variation PT modes + legacy class/sport prompts, incl. HIIT+RUN / More Mobility / Peak Performance prompt builders). Calls **Anthropic API** directly (`claude-sonnet-4-20250514`, max_tokens 4096) with `ANTHROPIC_API_KEY`.
- **No DB access at all**: `createClient` is imported and `supabaseUrl`/`supabaseServiceKey` read but a client is **never constructed** — dead code. All member context arrives in the request body.
- **Auth**: verify_jwt only — no role check and no per-user validation; any holder of a valid project JWT (incl. the public anon key, which passes the gateway's verify_jwt) can burn Anthropic tokens.
- **Contract**: POST params incl. `generation_mode`, `previous_session`, `pt_session_focus`, `training_focuses[]`, `member_goals`, `member_context`, `block_number/week_number/member_id` (accepted but `member_id` unused). Response: parsed JSON extracted from the model output by regex `/\{[\s\S]*\}/` — brittle; failure → 500 "No valid JSON found in AI response".
- Hardcoded domain knowledge in prompts: "The gym does NOT have cable machines" (repeated in 2 builders).

## 5. invite-member (v40, verify_jwt=true)
- **Purpose**: admin invites a member: auth user + branded Resend email + profile update + optional subscription/credits.
- **Auth**: proper two-step — user client `auth.getUser()` then service-role read of `profiles.role === 'admin'` (L112-122); 401/403 otherwise.
- **Contract**: POST `{email, firstName, lastName, planId?, migratedCredits?, suppressEmail?, resend?}`.
- **Flow / writes**:
  - Pre-flight RPC **`fix_auth_user_null_tokens(target_email)`** (L147) — patches NULL token columns in `auth.users` because "users created via raw SQL INSERT" crash GoTrue ("converting NULL to string is unsupported") — evidence that members were bulk-inserted into auth.users by raw SQL during migration.
  - `auth.admin.generateLink(type invite → magiclink fallback; resend flag forces magiclink)`; redirect hardcoded to `https://hvpt-app.netlify.app/set-password.html`; returned `inviteLink` wraps the raw action link in `accept-invite.html?url=...`.
  - Resend email (from `noreply@harryvinept.co.uk`) — **but the email embeds `rawInviteLink`, not the wrapped link** (L235 vs L206) — the wrapped version is only returned to the admin UI.
  - **`setTimeout 500ms`** wait for the `handle_new_user` profile trigger (L257) — race by sleep; profile update failure is non-fatal (logged).
  - `profiles` update (names, status active, member_since; `migrated_credits/migrated_from:'glofox'/migrated_at` if migrating).
  - If `planId`: reads `membership_plans`, inserts `member_subscriptions` with `credits_total = plan.credits` but **`credits_remaining = plan.credits + migratedCredits`** (remaining > total by design) and **`current_period_end = now + 30 days`** — not anchored to the 1st, inconsistent with the webhook's calendar-month anchoring; inserts `credit_ledger` (type `admin_add`). Sub/ledger insert errors are logged and swallowed — invite still reports success.
  - No plan + migratedCredits > 0 → standalone `credit_ledger` insert **with no member_subscriptions row** — ledger entry whose balance no subscription reflects.

## 6. monthly-credit-reset (v16, verify_jwt=false)
- **Purpose**: cron **safety net** for the 1st-of-month credit reset; primary mechanism is stripe-webhook invoice.paid. Covers admin-invited members without Stripe subs.
- **Scheduling hack** (header comment, verbatim): "pg_cron on this Supabase instance does not support named timezones. This function is called at 23:01 UTC on days 28–31 (cron: `1 23 28-31 * *`). It checks whether tomorrow in UK time (Europe/London) is the 1st… exits immediately [otherwise]." Timezone guard implemented via `new Date(new Date().toLocaleString("en-GB", {timeZone:"Europe/London"}))` — string-round-trip date parsing (fragile but functional in Deno).
- **How credits are reset**: for every `member_subscriptions` with `status='active'` (joined to `membership_plans`): skip when `credits_remaining === plan.credits` ("likely already reset by Stripe webhook"); otherwise call shared **`resetCreditsForBillingCycle`** with period = 1st→1st of the new month. The helper (in-bundle `_shared/credit-reset.ts`):
  1. sweeps confirmed `bookings` with `future_month_booking=true` whose class date lands in [start,end) → flips `future_month_booking=false, credit_charged=true`;
  2. `adjustedCredits = max(0, plan.credits - futureMonthCount)`;
  3. **UPDATE `member_subscriptions` SET credits_total = plan.credits, credits_remaining = adjustedCredits, current_period_start/end, prorate_amount_pennies=NULL, first_month_credits=NULL, status='active'`** — a **destructive overwrite from the plan**, not a ledger replay;
  4. INSERT `credit_ledger` (type `plan_reset`, balance_after = adjustedCredits, created_by = member_id).
- **Consequences**: (a) any unused **purchased top-up credits are wiped** at reset (ledger records the overwrite but the balance is gone); (b) the "already reset" skip is an equality heuristic — a member who used 0 credits is indistinguishable from an already-reset member, so their `current_period_*` never advances via this path; (c) it force-sets `status='active'` on every sub it touches — a `past_due` member with active status would be revived if their credits differ from plan; (d) unauthenticated — anyone can invoke it, though the tomorrow-is-the-1st guard makes off-schedule calls no-ops except on month-end nights, when an external call merely duplicates the cron (idempotent-ish due to the equality skip).
- Per-sub errors collected into `errors[]` and returned; run continues.

## 7. purchase-payg-credits (v4, verify_jwt=true)
- **Purpose**: member buys a PAYG credit pack via Stripe Checkout. Auth: `auth.getUser` on the bearer token (no role check — member self-service; note it uses the **service-role** client for the lookup, so RLS is not what scopes it — the token subject is).
- **Contract**: POST `{pack_id}` → `{url}`; 400/401/404/500 (raw error message).
- **Tables**: reads `payg_credit_packs` (active), `profiles` (stripe_customer_id, email); writes `profiles.stripe_customer_id` when creating a Stripe customer.
- **Stripe**: `customers.create` if needed; `checkout.sessions.create` mode payment, price = `pack.stripe_price_id` (DB-driven), **metadata `{type:'payg_credit_purchase', member_id, pack_id, credits}` on the SESSION ONLY — not on `payment_intent_data`**. Own `new Stripe(...)` (bypasses key-mode guard). Success URL `${origin}/app.html#book?credits_purchased=true` (fallback origin `https://hvpt-app.netlify.app`).
- **CRITICAL CONTRACT MISMATCH** (see cross-function findings): stripe-webhook has **no `payg_credit_purchase` branch**, and because metadata is not copied to the PaymentIntent, the PI arrives with empty metadata → `paymentType` defaults to `"subscription"` → skipped. checkout.session.completed for this session takes the subscription path and throws on `subscriptions.retrieve(null)`. **On the evidence of this batch, nothing grants the purchased credits.** (Caveat: a handler could exist in a function outside this batch, but the header comment in this very file says "After payment (via webhook), credits are added to member_subscriptions" — and *the* webhook does not do it.)

## 8. send-diana-welcome (v1, verify_jwt=false) — member-specific one-shot
- **Entire function is a hardcoded email to one person.** Verbatim load-bearing lines:
  - `to: ["dianaloganr9@gmail.com"]`
  - `subject: "Welcome to HVPT, Diana — your 4-Week Trial is live"`
  - Body: "Your **4-Week Trial** is now active and runs from **14 May to 11 June 2026**." + phone `07775 731570`.
- No request body is read at all — **any unauthenticated GET/POST to the function URL re-sends the email to Diana**. Only guard is `RESEND_API_KEY` presence.
- Context: the HTML is a verbatim copy of the stripe-webhook trial welcome template (v40, deployed ~2026-05-15, same day) **minus the set-password block** — i.e. a manual re-send for the "Diana scenario" the webhook itself names at L1725 ("Pre-existing sub with wrong plan (Diana scenario: signed up as PAYG)"). Diana's automated trial flow evidently misfired and this function was hand-deployed to send her welcome email.
- **Status: dead by purpose** (trial ended 11 June 2026; today is 4 July 2026) but still deployed, ACTIVE, and publicly invokable. Should be deleted.

## 9. send-free-class-confirmation (v13, verify_jwt=false)
- **Purpose**: branded Resend confirmation for free-class bookings from the public page.
- **Contract**: POST `{name, email, class_name, class_date, class_time}` → `{success, email_id}`; 400 missing fields; 405; 500.
- **No auth of any kind and all content fields are caller-controlled** → open email relay from `Harry <harry@harryvinept.co.uk>` to any address with arbitrary (HTML-interpolated, unescaped) name/class strings — spam/phishing vector on Harry's domain.
- Hardcoded venue: "The Engine Shed, Station Yard, Sharnbrook, MK44 1PD". No DB access. Resend errors logged + 500.

## 10. send-group-pt-emails (v13, verify_jwt=false)
- **Purpose**: Group PT email dispatcher for 6 `type`s: `payment_link`, `parq_reminder`, `payment_reminder_12h`, `payment_warning_22h`, `slot_released`, `all_paid`. "No JWT — called from other edge functions and cron" (header comment).
- Same open-relay problem as above: unauthenticated, recipient/name/amount/payment_url all caller-supplied — a caller can send "Pay £X Now" emails pointing `payment_url` at an arbitrary site, branded as Harry. This is the most abusable of the mailers.
- Per-recipient results array; Resend failures recorded per email, overall 200 `{success:true, results}` even if every send failed. Unknown type → 400. PAR-Q URL hardcoded `https://harryvinept.co.uk/pages/parq.html`. No DB access (all data passed in by the webhook / cron callers).

## 11. send-push-notification (v8, verify_jwt=true)
- **Purpose**: Web Push to all or one subscriber. POST `{title, body, icon?, user_id?}` — **user_id omitted ⇒ broadcast to every row of `push_subscriptions`**.
- **Auth gap**: verify_jwt only. The gateway accepts any valid project JWT — including the public **anon key** — and the function does no role/user check. Effectively anyone can broadcast arbitrary push notifications to every subscriber, or push to a chosen user_id. (Internal callers — stripe-webhook admin alerts — use the service-role key as bearer.)
- **Implementation**: full hand-rolled Web Push stack — VAPID ES256 JWT (12h exp, `sub: mailto:harry@harryvinept.co.uk`) built from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` via WebCrypto JWK import, RFC 8291 aes128gcm payload encryption (ECDH P-256 + double HKDF), TTL 86400. No library.
- **Tables**: reads `push_subscriptions (id, user_id, subscription)`; deletes rows whose push endpoint returned 404/410 (expired cleanup). Response `{sent, failed, expired_removed, total}`. Per-subscription errors logged and counted, never fatal.

## 12. stripe-reconcile (v4, verify_jwt=true)
- **Purpose**: read-only chase list comparing profiles ↔ Stripe card state ↔ `migration_status` matrix. Admin-only (proper check: `auth.getUser` via anon-key client with forwarded JWT, then `profiles.role === 'admin'`; 401/403).
- **Reads**: `profiles` (role=member, status=active), `member_subscriptions`, `migration_status` (member_email, invite_sent, registered, first_payment, glofox_cancelled). **Stripe**: per member `customers.retrieve` + `paymentMethods.list` (serial loop → N×2 Stripe calls; slow for large rosters). Own `new Stripe(...)` (bypasses guard).
- Classifications: `OK`, `NO_STRIPE_CUSTOMER`, `NO_CARD`, `CARD_BUT_NO_DEFAULT_PM`, `MATRIX_SAYS_PAID_NO_CARD` (drift), `CARD_OK_MATRIX_LAGGING`, `STRIPE_ERROR`; `chase=true` for the actionable ones. Returns `{summary, rows}` sorted chase-first. **No writes** — despite the webhook's paid-booking branch saying "stripe-reconcile heals the [stale refunded payments] row", this deployed version only *reports*; it does not update `payments`. The healing claim is aspirational.
- Errors: single catch-all → 500 raw message.

---

## Cross-function findings

### Money-flow invariants (what must stay true)
1. **`payments.stripe_payment_intent_id` is the deduplication spine.** A partial unique index (migration 168) plus the webhook's catch-all dedupe guard is what prevents double audit rows when a server-side function (custom charge, arrears activation) writes its own payments row and the PI webhook arrives later. Any new money path MUST either write its payments row before the webhook can, or add an explicit webhook branch — the `payg_credit_purchase` gap shows what happens otherwise.
2. **`member_subscriptions.credits_remaining` is the authoritative balance; `credit_ledger` is write-behind audit, never replayed.** Every reset is a destructive overwrite from `membership_plans.credits` (via `resetCreditsForBillingCycle`), so: purchased top-ups must be consumed within the billing month or they are silently destroyed at reset; and ledger `balance_after` is only as correct as the racy read-modify-write helpers (`ledgerEntry`, pt_pack balance update) that produce it. Two concurrent PI webhooks for the same member can lose an update.
3. **Credit reset has three writers** — stripe-webhook invoice.paid (invoice-line period), handleArrearsActivation (calendar month), monthly-credit-reset cron (calendar month, equality-skip heuristic) — all funnelled through the shared helper (good), but mutually deconflicted only by the cron's `credits_remaining === plan.credits` equality check. A member who used zero credits is indistinguishable from "already reset".
4. **Stripe events are at-most-once into the DB.** Because every non-refund handler error returns 200, any handler exception (including transient DB failures) permanently drops the event. The compensating controls are console logs and the (report-only) stripe-reconcile. The single deliberate exception — paid-booking refund failure → 500 → Stripe retry — is the only at-least-once path, and it is the best-engineered code in the file.
5. **Pricing source of truth is split**: subscriptions and packs resolve via DB (`membership_plans.stripe_price_id`, `payg_credit_packs.stripe_price_id`, `admin_settings.trial_stripe_price_id`) — good; but the webhook still carries a dead hardcoded `TOPUP_PRICE_MAP`, the trial plan UUID is hardcoded, and `stripe_price_id_may` bakes a specific month's migration into the schema and the deployed code.

### Confirmed dead / member-specific artifacts
- **`payg_class` branch: gone in v41** (removed per migration 204; L1851-1856 comment documents that it was orphaned because it wrote `payments.type='payg_class'`, which `payments_type_check` rejects — consistent with "never executed in production").
- **send-diana-welcome**: single-recipient hardcoded email (dianaloganr9@gmail.com, trial 14 May–11 June 2026), purpose expired, still deployed and unauthenticated.
- Dead code inside live functions: `TOPUP_PRICE_MAP`/`TOPUP_PAYG_PENNIES` (webhook), `TRIAL_AMOUNT_PENNIES` (create-trial-checkout), unused Supabase client env in generate-session-plan.

### Duplicated logic
- **Trial welcome email HTML exists twice** (stripe-webhook L1784-1815 and send-diana-welcome, byte-similar) and the invite email is a third near-variant in invite-member; branded `emailWrapper` duplicated again in send-free-class-confirmation and send-group-pt-emails.
- **Admin fan-out loop** (`select id from profiles where role='admin'` + bell + push fetch) implemented 4 separate times inside stripe-webhook alone (notifyAllAdminsTrialPaid, notifyAdminsRefundFailure, notifyAdminsRefundBookkeepingFailure, inline in invoice.payment_failed).
- **Stripe client construction**: the shared fail-closed `getStripe()` guard is only used by stripe-webhook; create-trial-checkout, purchase-payg-credits and stripe-reconcile each do raw `new Stripe(Deno.env.get('STRIPE_SECRET_KEY'))`, so the sk_test/sk_live environment guard does not actually cover most Stripe entry points in this batch.
- **500ms sleep for the `handle_new_user` trigger** duplicated in invite-member (L257) and the webhook trial branch (L1690).
- Subscription-period arithmetic exists in ≥3 flavours: invoice line period (webhook), calendar-month UTC (arrears/cron), `now + 30 days` (invite-member) — the last one drifts off the 1st-of-month model everything else assumes.

### Security observations
1. **Unauthenticated email senders** (send-free-class-confirmation, send-group-pt-emails, send-diana-welcome): open relay on `harry@harryvinept.co.uk`, caller-controlled recipients/content/payment URLs, unescaped HTML interpolation. send-group-pt-emails is a ready-made phishing kit ("Pay £X Now" button to arbitrary URL).
2. **send-push-notification broadcast with any project JWT** (anon key suffices at the gateway; no role check in code).
3. **generate-session-plan**: anon-key-invokable Anthropic spend.
4. **create-trial-checkout 409** leaks trial-purchase status per email.
5. **WEBHOOK_DELETE_GUARD ships dark**: production cancellation-cascade safety (admin lockout protection, superseded-sub protection) depends on an env secret being exactly `"true"`; default is the legacy unconditional cascade.
6. Positive notes: webhook signature verification is correct and mandatory; stripe-reconcile and invite-member do real admin role checks; the key-mode guard (`stripe-guard.ts`) is well designed — it just isn't wired into most functions.

### Defect shortlist (this batch)
| # | Where | Defect |
|---|---|---|
| D1 | purchase-payg-credits ↔ stripe-webhook | `payg_credit_purchase` metadata never consumed; metadata not on PI; **credits likely never granted after payment** (verify against batch A functions + Stripe dashboard before acting) |
| D2 | stripe-webhook checkout.session.completed | payment-mode sessions (trial, PAYG pack) crash into the subscription path; error masked as 200 |
| D3 | stripe-webhook error policy | 200-on-error drops events permanently; no processed-event ledger; reconcile is report-only despite comments claiming it "heals" rows |
| D4 | credit reset | destructive overwrite wipes unused top-up credits; cron equality-skip heuristic; cron force-sets status='active' |
| D5 | ledgerEntry / pt_pack | non-atomic read-modify-write credit balance updates |
| D6 | invite-member | period_end = now+30d (off-anchor); credits_remaining > credits_total; migrated credits without subscription row; sub/ledger failures swallowed as success |
| D7 | payg_booking branch | no dedupe on `payg_bookings` insert (webhook re-delivery would duplicate the schedule row) |
| D8 | handleSubscriptionUpdated | Stripe-driven plan change writes ledger rows typed `admin_add`/`admin_remove` (audit-trail misattribution) |
| D9 | send-diana-welcome | expired one-shot, unauthenticated, still live |
| D10 | arrears path | `stripe_price_id_may` month-named column dependency hardcoded in deployed code |
