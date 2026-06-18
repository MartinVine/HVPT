# Diagnosis — Paid-booking edge function failure (no-credit member)

**Status:** Diagnosis only — no code changed, no LIVE writes, no deploys. Read-only.
**Date:** 2026-06-18
**Author:** Claude Code (Opus 4.8), read-only investigation
**Reported symptom:** A member with **no class credit** tried to book + pay for `HIIT+RUN`, 29 Jun, 09:15 from the member app at ~17:11–17:12 BST. Booking failed with the recurring "edge function" error.

> Scope note: the LIVE Supabase project (`mlllkjnvjowfjysfndhu`, `train-hvpt`) was inspected read-only via MCP — edge-function source (from the deployed bundles), edge logs, and `SELECT`-only SQL. **No** migrations, deploys, function redeploys, or Stripe mutations were performed. The member-app client repo (`hvpt-app`) was **not readable** in this session (see §8) — this is the one gap in the trace and is flagged throughout.

---

## 1. Summary

A member with zero credits who taps "book + pay" for a standard class triggers the member-app's **pay‑per‑class** flow, which calls the **`create-checkout-session`** edge function. That function returns **HTTP 400** before any Stripe call, so no Checkout session is created, no payment is taken, and no booking is made. The member sees the generic supabase‑js "Edge Function returned a non‑2xx status code" message.

**Root cause (confirmed at the server boundary):** the pay‑per‑class feature is **half‑shipped**. The `stripe-webhook` function has a fully‑built handler for `metadata.type === "payg_class"` ("PAYG class bookings — authenticated members paying per class") that writes the `payments` and `bookings` rows. **But no checkout‑creation function emits `type = "payg_class"`.** `create-checkout-session` only handles `subscription / credit_topup / pt_session / pt_pack`; anything else falls through to its `else` branch → `Unknown type` → **400**. The receiver half of the feature was deployed; the sender half (the matching branch in `create-checkout-session`) never was. The database confirms it: **there has never been a single `payg_class` payment** — the webhook handler has never once fired.

**Member‑specific or systemic?** **Systemic.** This is a missing server branch on a whole path, not a corrupted account. **41 of 69 active members (59%)** currently sit in the exact precondition (non‑unlimited, ≤0 credits) that routes to this broken path, and members cycle in and out of "0 credits" every billing period. The generic in‑app "buy credits" path (`credit_topup`) is healthy and unaffected (used successfully as recently as today 06:01) — so the failure is specific to *paying for a single class*, not to billing in general.

---

## 2. Path traced

Client action → edge function, with the one client‑side hop labelled as inference:

1. **Member app, no‑credit member books a class** → app presents "pay to book". *(Client routing in `hvpt-app` `booking.js`/`stripe.js` could not be read — see §8 — so the exact `type` string and payload the client sends is **inferred** from the matching server contract, not directly observed.)*
2. **Client calls `create-checkout-session`** (Supabase edge function, `verify_jwt: true`). **Confirmed from logs** (§3): a single `POST` to `create-checkout-session` returned **400** at exactly the reported time, preceded by a `204` CORS preflight.
3. **`create-checkout-session` rejects the payload with 400** and never reaches Stripe.

### Why a 400 is decisive
The deployed source of `create-checkout-session` (retrieved from the live deployment bundle — **source is present, this is not a no‑source function**) has exactly these exit points:

- `401` missing/invalid auth
- `404` profile not found
- **`400`** — three request‑shape validations:
  - `if (!type || !success_url || !cancel_url)` → `"Missing type, success_url, or cancel_url"`
  - `pt_pack` with no/invalid `package_id` → `"Invalid package…"`
  - **`else` → `` `Unknown type: ${type}` ``** (the catch‑all for any `type` the function doesn't implement)
- `503` — `type === "subscription"` is short‑circuited (a separate "Phase 2" stopgap; unrelated to class booking)
- **`500`** — the **only** path through the Stripe `try/catch`: `catch (err) { … return jsonResponse({ error: err.message }, 500) }`

Every Stripe/account‑state failure returns **500**. A **400 means the function rejected the request shape before touching Stripe** — i.e. this is **not** the member's Stripe/account state. The handled `type` values are `subscription`, `credit_topup`, `pt_session`, `pt_pack`. **There is no branch for a single paid class booking.**

### The matching server contract that proves the intended `type`
`stripe-webhook/index.ts` (lines 1624–1685) contains:

```ts
// PAYG class bookings — authenticated members paying per class
if (paymentType === "payg_class") {
  const customerId = paymentIntent.customer as string;
  ...
  const classId = meta.class_id;
  // Insert payment record  (type: "payg_class")
  // Create the booking via direct insert (payment_type: "payg", credit_charged: false)
  // notify(... "PAYG Class Booked!" ...)
}
```

This handler expects a **customer‑attached** PaymentIntent (an authenticated member, not a guest) carrying `metadata.type = "payg_class"`, `class_id`, `class_name`, `class_date`. **No deployed function produces that:**

- `create-checkout-session` → no `payg_class` branch (returns `Unknown type`).
- `create-payg-checkout` → emits `metadata.type = "payg_booking"` and is the **website/guest** flow (unauthenticated, requires `name`+`email`, redirects to `harryvinept.co.uk/pages/payg.html`). Its output is consumed by a *different* webhook branch (`payg_booking`, line 1269) which writes `payg_bookings` for guests.

So the member‑app pay‑per‑class path targets the `payg_class` contract, but the checkout‑creation side of that contract does not exist → `create-checkout-session` answers `Unknown type` / 400.

---

## 3. Evidence (quoted, with timestamps)

### 3a. The failing request (edge-function logs, project `mlllkjnvjowfjysfndhu`)
The member reported ~17:11–17:12. Exactly one `create-checkout-session` invocation exists in the window, and it failed:

```
OPTIONS | 204 | …/functions/v1/create-checkout-session   ts=1781799021966000  (2026-06-18 17:10:21 BST)  id=20c3d634-0d1b-4514-926a-0e0b7caa93fb
POST    | 400 | …/functions/v1/create-checkout-session   ts=1781799022531000  (2026-06-18 17:10:22 BST)  exec=436ms  version=24  id=dd7206ed-51e7-422f-9bff-989f31f29f8c
```

- `2026-06-18 16:10:22 UTC` = **17:10:22 BST** — matches the reported time.
- It was the **only** `create-checkout-session` call in the last 24h (this path is rarely exercised), consistent with "recurring but low‑volume / a minority of members".
- The only other 500s in the window were `generate-session-plan` (an unrelated AI feature) ~13 min later — not part of booking.
- **Limitation:** Supabase request‑edge logs expose only method/status/timing. The function does **not** `console.error` on any 400 branch (only the 500 `catch` logs), so the literal response body for this request is **not recoverable from logs**. The 400 branch is identified from source + the webhook contract, not from a logged error string.

### 3b. Deployed `create-checkout-session` (the four handled types + catch‑all)
```ts
if (type === "subscription") { return 503 stopgap }
else if (type === "credit_topup") { … Stripe … }     // never returns 400
else if (type === "pt_session")  { … Stripe … }
else if (type === "pt_pack")     { … 400 if no package … }
else { return jsonResponse({ error: `Unknown type: ${type}` }, 400); }   // ← class booking lands here
```

### 3c. Database — the feature has never completed once
Payment `type`s that actually exist (`SELECT type, count(*) FROM payments GROUP BY type`):
```
subscription 112 | pt_pack 33 | credit_topup 25 | custom_charge 12 | group_pt 12 | payg 5 | trial 2
```
- **No `payg_class` rows exist at all** → the webhook's `payg_class` handler has never fired → no member has ever completed an in‑app pay‑per‑class booking.
- The 5 `payg` payments and 5 `payg_bookings` are **all guests** (`member_id IS NULL`, `guest_email` set, latest 2026‑05‑29) — i.e. the *website* PAYG flow, never an in‑app member.
- `credit_topup`: **25 payments, all by members, all `succeeded`**, 11 in June 2026, **latest 2026‑06‑18 06:01:20 UTC (today)** → the in‑app "buy credits" path works and is in daily use. This rules out a broad billing/auth/Stripe‑key outage and isolates the defect to the pay‑per‑class path.

### 3d. The class is real
`classes` row `6de3352a‑dfec‑4200‑8e92‑3709f3d45e1c`: `HIIT+RUN`, `2026‑06‑29 09:15`, capacity 8, `class_types.payg_rate = 1000` (£10). So a per‑class price exists for this class — the feature is "meant to work", it just has no working checkout creator.

---

## 4. Root cause

**Confirmed:**
- The member's failure is `create-checkout-session` returning **400**, at 17:10:22 BST (§3a).
- A 400 is a **pre‑Stripe request‑shape rejection**; all Stripe/account‑state failures return 500. → **Not** caused by the member's Stripe customer, subscription row, profile, env vars, or secrets.
- `create-checkout-session` implements **no branch for a single paid class booking**; unknown types hit `else → "Unknown type" → 400` (§3b).
- `stripe-webhook` has a complete, **never‑triggered** `payg_class` handler (§2, §3c) — the matching receiver for an in‑app per‑class payment.
- The `credit_topup` path is healthy and used today (§3c) → the defect is specific to paying for a class, not billing generally.

**Inferred (clearly labelled, pending client source §8):**
- The member‑app pay‑per‑class flow posts `type: "payg_class"` (plus `class_id`/`class_name`/`class_date`, `success_url`, `cancel_url`) to `create-checkout-session`, matching the webhook's `payg_class` contract. Given the webhook is the only server artifact describing "authenticated member pays per class", `payg_class` is by far the most likely `type` string the client sends, producing `"Unknown type: payg_class"`.
- It is *possible* (less likely) the client sends a correct `credit_topup` shape but omits `success_url`/`cancel_url`, producing the `"Missing …"` 400 instead. **Either way the defect class is identical** (§6): a client↔function contract that `create-checkout-session` does not satisfy for paid class booking. The webhook `payg_class` handler makes the `Unknown type` interpretation the strongly‑favoured one.

**Ruled out by evidence:**
- Member‑state precondition (no `stripe_customer_id`, missing profile, no subscription) — those return 401/404/500, not 400; and `credit_topup` (which also needs a customer) works.
- Missing/invalid Stripe price for the class — the credit‑topup and PT prices resolve fine; a bad price would 500 from the Stripe `catch`, not 400.
- Missing env var/secret — would 500 (or fail boot); `credit_topup` ran today on the same secrets.
- Webhook/idempotency interaction — the webhook is never reached because no session/payment is ever created.

---

## 5. Blast radius

Computed over `profiles.status = 'active'` joined to `member_subscriptions`/`membership_plans`:

| Cohort | Count |
|---|---|
| Active members | **69** |
| Non‑unlimited **and** ≤0 credits (the exact trigger state) | **41** (59%) |
| — of which: active subscription, exactly 0 credits | 31 |
| — of which: no subscription row at all | 10 |
| Unlimited‑class members (never hit this path) | 5 |

**~41 active members are, right now, one tap away from this 400** whenever they try to pay to book a class. This is not a stuck minority: members routinely reach 0 credits at month‑end and want to book extra sessions, so the exposed population continuously refreshes. The low log volume (one hit/24h) reflects how few members *attempt* the paid‑per‑class action, **not** a small affected population — for those who do attempt it, the success rate is **0%** and always has been (§3c).

---

## 6. Defect class

**Path‑level weakness, not an isolated bug.** The in‑app pay‑per‑class booking path is only half‑implemented on the backend: the `stripe-webhook` receiver (`payg_class`) exists, but the `create-checkout-session` sender branch was never added (or was removed). A durable, non‑patch fix must cover the **whole path**, end to end:

1. **Checkout creation:** `create-checkout-session` must accept the class‑booking request (a `payg_class` branch) and create a Stripe Checkout session with `mode: "payment"`, the class's `payg_rate`, attached to the member's `customer`, carrying `metadata: { type: "payg_class", class_id, class_name, class_date, supabase_user_id }`.
2. **Webhook fulfilment:** verify the existing `payg_class` handler matches the metadata the new branch emits (field names `class_id`/`class_name`/`class_date`, customer‑attached PaymentIntent). It currently reads exactly those — so it should line up, but it has **never executed in production** and must be validated once a session can actually be created.
3. **Booking integrity:** confirm the `bookings` insert (`payment_type: "payg"`, `credit_charged: false`) respects class capacity (the class is capacity 8) and the duplicate‑booking guard — the webhook checks for an existing confirmed booking but does **not** check capacity.
4. **Error surfacing:** the function's 400 branches return machine messages ("Unknown type: …") that the app shows as the opaque "edge function" error. A robust fix should also ensure unhandled/unsupported types fail loudly in logs (none of the 400 branches currently log), so the next contract drift is observable instead of silent.

Silencing this member's error (e.g. making the app fall back to `credit_topup`) would **not** address the defect class — the per‑class payment product would still be unbuyable in‑app.

---

## 7. Recommended fix options (ranked — DO NOT IMPLEMENT here)

> All require **at least an edge‑function change**; none require a migration unless noted. A new task should be scoped after this diagnosis is reviewed.

1. **Add the `payg_class` branch to `create-checkout-session`** *(recommended; edge‑function change only)* — Implement the sender half to match the existing webhook receiver: look up the class + `payg_rate`, create a customer‑attached one‑time Checkout session with `metadata.type = "payg_class"` and `class_id/class_name/class_date`. **Risk: low–medium.** Self‑contained, additive, no schema change, reuses the already‑deployed (but unproven) webhook path. Must be tested end‑to‑end in Stripe **test mode** first, because the `payg_class` webhook branch has literally never run. *Before coding, read `hvpt-app` `booking.js`/`stripe.js` to confirm the exact `type` string and payload field names the client actually sends (§8) and match them precisely.*

2. **Point the member‑app pay‑per‑class flow at a corrected/auth‑aware checkout** *(client + edge change)* — If product intent is for the app to reuse PAYG infrastructure, adapt `create-payg-checkout` (or a new function) to accept an authenticated member and emit `payg_class`, and update the client call site. **Risk: medium.** Touches two repos and the website‑shaped success/cancel URLs; larger blast radius than option 1.

3. **Route no‑credit booking through the working `credit_topup` path instead** *(client change; possible product shift)* — Make "no credit → book" offer "buy 1 credit, then book" (a proven, working path) rather than per‑class payment. **Risk: low technically, but it's a product decision** (changes pricing/UX from "£10 this class" to "buy a credit"), and it abandons the `payg_class` feature the webhook was built for. Needs Harry's sign‑off, not just engineering.

4. **(Stopgap, not a fix) Friendly client‑side error** — If a real fix can't land immediately, have the app detect this path and show "online booking for paid classes isn't available yet — contact Harry" instead of the raw edge error. **Risk: low.** Does **not** restore the ability to pay; explicitly a holding measure.

---

## 8. Open questions / blockers

- **Client source not readable in this session (primary gap).** The GitHub MCP scope is restricted to `martinvine/hvpt` (essentially empty — README only); `hvpt-app`, `hvpt-platform`, `hvpt-admin`, `hvpt-website` returned *"Access denied: repository … is not configured for this session"*, `search_code` over `hvpt-app` returned 0, and no `add_repo`/`list_repos` tool is available. So `booking.js`/`stripe.js` could not be read. **Consequence:** the exact client `type` string and payload are **inferred** from the webhook's `payg_class` contract, not directly confirmed. To close this, read `hvpt-app/.../booking.js` and `stripe.js` (the `supabase.functions.invoke('create-checkout-session', …)` call site).
- **Exact 400 sub‑branch not in logs.** The function doesn't log on 400 paths, and request‑edge logs carry no body, so `"Unknown type: payg_class"` vs `"Missing … url"` can't be distinguished from logs alone. Both point to the same defect class (§6). Definitive confirmation needs the client source above, or capturing the actual request payload, or a reproduction in a non‑LIVE environment. **No reproduction was attempted** — it would require an authenticated call that creates a Stripe Checkout session (a write/external mutation), outside the read‑only constraint.
- **Member identity not provided.** No email/profile ID was given, and the failed attempt created no DB row (it 400s before any write), so the specific member could not be pinned. The diagnosis does not depend on it — the failure is reproducible by contract for any of the 41 exposed members. If her email is supplied, confirming she is non‑unlimited with 0 credits and has a `stripe_customer_id` would be a quick corroboration.
- **Webhook `payg_class` path is unproven in production.** It has never executed (0 `payg_class` payments). A fix that enables checkout creation must validate it end‑to‑end (metadata field‑name match, capacity handling) before relying on it.
- **Log retention.** Supabase MCP edge logs cover ~24h; this diagnosis was done same‑day so the failing line was captured. Earlier recurrences of the same error are no longer in the log window (but are implied by the 0% historical success rate).

---

*End of diagnosis. No fix implemented, per task constraints.*
