# 04 — LIVE Behavioural Evidence (train-hvpt, `mlllkjnvjowfjysfndhu`)

Forensic read-only audit of the LIVE production database, executed 2026-07-04.
All figures are actual query results (single read-only SELECTs). Member identities
reduced to profile ids; no full names/emails included.

Context notes:
- Data history effectively starts **late Feb 2026** (Glofox migration era: `payment_type='glofox_migration'` bookings, `migration_status` table, `migrated_*` columns on profiles). "Last 8 months" therefore collapses to Feb–Jul 2026.
- `pg_cron`, `pg_net`, `supabase_vault` extensions installed.

---

## 1. Population

`profiles` by role × status (71 total):

| role | status | count |
|---|---|---|
| admin | active | 2 |
| member | active | **67** |
| member | cancelled | 1 |
| member | deleted | 1 |

- PRD's "~68–69 active members" ≈ confirmed: **67 active members + 2 admins = 69 active profiles**.
- `auth.users`: 71 total; 56 were invited; **7 invited-but-never-confirmed**; 12 unconfirmed / 12 never signed in overall.
- **Test accounts: none.** Zero profiles match `%test%`/`%demo%`/`%example%` in name or email. Counts are clean. (One broadcast row is titled "Testing Broadcast" but that's content, not an account.)

## 2. Billing reality

`payments`: 255 rows, first 2026-03-30, latest 2026-07-01. Two rows lack any Stripe reference (payment_intent and invoice both NULL).

Payments by type × status × month (sums in pennies):

| mon | type | status | n | sum |
|---|---|---|---|---|
| 2026-03 | subscription | succeeded | 1 | 4,000 |
| 2026-04 | credit_topup | succeeded | 5 | 5,215 |
| 2026-04 | group_pt | succeeded | 2 | 11,000 |
| 2026-04 | payg | succeeded | 2 | 2,000 |
| 2026-04 | pt_pack | succeeded | 12 | 82,000 |
| 2026-04 | subscription | failed | 3 | 18,000 |
| 2026-04 | subscription | succeeded | 1 | 6,000 |
| 2026-05 | credit_topup | succeeded | 9 | 4,914 |
| 2026-05 | custom_charge | succeeded | 11 | 20,000 |
| 2026-05 | group_pt | succeeded | 4 | 22,000 |
| 2026-05 | payg | succeeded | 3 | 3,000 |
| 2026-05 | pt_pack | succeeded | 15 | 94,600 |
| 2026-05 | subscription | failed | 1 | 6,300 |
| 2026-05 | subscription | succeeded | 36 | 252,177 |
| 2026-05 | subscription | **voided** | **31** | 224,700 |
| 2026-05 | trial | succeeded | 2 | 11,800 |
| 2026-06 | credit_topup | succeeded | 15 | 9,883 |
| 2026-06 | custom_charge | succeeded | 1 | 500 |
| 2026-06 | group_pt | succeeded | 13 | 46,000 |
| 2026-06 | payg | succeeded | 1 | 1,000 |
| 2026-06 | pt_pack | succeeded | 9 | 53,600 |
| 2026-06 | subscription | succeeded | 39 | 267,238 |
| 2026-07 (to the 4th) | group_pt | succeeded | 1 | 5,500 |
| 2026-07 | subscription | succeeded | 38 | 265,700 |

- Real Stripe subscription billing only began **May 2026** (36 successful sub payments; March/April show 1 each). The 31 voided rows are all "\<Plan\> — May 2026 first month [voided …]" dated 2026-05-01 — a bulk void during the Stripe cutover.
- Failed payments: 4 ("Subscription payment failed"), Apr 8 – May 7.
- Monthly subscription run-rate now ≈ **£2,660/mo** (38–39 payments), plus PT packs ≈ £500–950/mo.

`member_subscriptions` (61 rows) by status × plan (joined to `membership_plans`):

| status | plan | price | credits | unlimited | n | of which no stripe_subscription_id |
|---|---|---|---|---|---|---|
| active | 8 Classes / Month | £63.00 | 8 | no | 15 | **2** |
| active | 12 Classes / Month | £72.00 | 12 | no | 14 | 0 |
| active | 16 Classes / Month | £84.00 | 16 | no | 6 | 0 |
| active | 20 Classes / Month | £100.00 | 20 | no | 2 | 0 |
| active | Family Plan | £42.00 | 999 | yes | 3 | 0 |
| active | PAYG | £0 | 0 | no | 4 | 4 (expected) |
| active | PT Only | £0 | 0 | no | 13 | 13 (expected) |
| cancelled | 12 Classes | — | — | — | 1 | 1 |
| cancelled | 4-Week Trial | £59.00 | 0 | yes | 2 | 2 |
| cancelled | 8 Classes | — | — | — | 1 | 1 |

- **2 active paid "8 Classes / Month" subscriptions have NO stripe_subscription_id** (created 2026-06-15 and 2026-06-17, `awaiting_activation=false`, `current_period_end=2026-07-01`, both now expired-period). These members are potentially receiving service unbilled — no July payment can be collected for them via Stripe.
- 10 of 67 active members have **no active subscription row at all**; 14 of 67 have **no stripe_customer_id** on profile.
- Paying class-plan members: 37 (+3 family unlimited). 57 active sub rows total incl. PAYG/PT-Only shells.

## 3. Credits

Where credits live: **`member_subscriptions.credits_total` / `credits_remaining`** (class credits) and **`profiles.pt_credits_remaining`** (PT credits). `membership_plans.credits` is the allowance. Ledgers are append-only audit tables.

`credit_ledger` (2,336 rows) by type:

| type | n | first | last |
|---|---|---|---|
| booking | 1,758 | 2026-02-27 | 2026-07-04 |
| cancellation | 341 | 2026-04-04 | 2026-07-03 |
| plan_reset | 117 | 2026-04-08 | 2026-07-01 |
| admin_add | 62 | 2026-02-27 | 2026-07-02 |
| topup | 29 | 2026-04-12 | 2026-06-26 |
| admin_remove | 29 | 2026-03-06 | 2026-06-29 |

`pt_credit_ledger` (174 rows): session_used 108, purchase 43, admin_add 11, cancellation 11, admin_remove 1 — active through 2026-07-01. **Both ledgers are live and current.**

Reconciliation with bookings: of 1,589 confirmed `payment_type='credit'` bookings, **42 have credit_charged=false** and **196 have no matching `credit_ledger` booking-debit row**. By booked month: Mar 8, **Apr 176** (migration/pre-hardening era), May 8, Jun 3, Jul 1. Recent months mostly reconcile; the residual recent gaps are the uncharged waitlist promotions (§5).

Zero-credit cohort (pay-per-class exposure):
- Today (2026-07-04, i.e. AFTER the July 1 credit reset): **19 of 57 active subscriptions sit at exactly 0 credits_remaining** (none negative), 38 above zero. Plus 10 active members with no subscription row → up to 29/67 currently unable to book without topup.
- Reconstructed end-of-June from ledger (`balance_after` of last entry before 2026-07-01): **14 of 47 members with ledger history were at ≤0**; the other ~20 active members had no ledger at all (PT-only/PAYG → effectively 0 class credits). That is consistent in spirit with the PRD's "41 of 69 at ≤0 in June" if PT-only/PAYG/no-sub members are counted as zero.
- PT credits: 66 of 67 active members have 0–3 `pt_credits_remaining`; one member has 7.

## 4. Bookings & attendance

`bookings`: 3,210 rows. By month × payment_type × status (booked_at):

| mon | payment_type | confirmed | cancelled | waitlisted |
|---|---|---|---|---|
| 2026-02 | credit | 14 | – | – |
| 2026-03 | credit | 30 | 2 | – |
| 2026-03 | glofox_migration | 43 | 1 | – |
| 2026-04 | credit | 589 | 176 | 7 |
| 2026-04 | glofox_migration | 1,070 | 1 | – |
| 2026-04 | payg | 3 | – | – |
| 2026-04 | subscription | 61 | – | – |
| 2026-05 | credit | 417 | 147 | 5 |
| 2026-06 | credit | 468 | 90 | 7 |
| 2026-07 (4 days) | credit | 71 | 4 | 4 |

Steady state ≈ 420–470 confirmed credit bookings/month, ~20–25% cancellation rate.

Attendance: **the separate `attendance` table has 0 rows (dead)**. Attendance is recorded on `bookings.attended`: of 2,766 confirmed bookings — attended=true 2,386, false 27, **NULL 353** (~13% unmarked). A cron push nags Harry to mark attendance 10–20 min after each class (job `harry-attendance-reminder`). So attendance IS actively recorded, on bookings, not in `attendance`.

Satellite booking tables — live vs dead:

| table | rows | latest | verdict |
|---|---|---|---|
| pt_bookings | 104 (88 confirmed/16 cancelled) | 2026-07-01 | **live** |
| pt_booking_requests | 100 (93 confirmed/7 declined) | 2026-07-01 | **live** |
| group_pt_bookings | 16 (confirmed/pending/cancelled) | 2026-07-01 | live, low volume |
| payg_bookings | 6 | 2026-06-26 | live, trickle |
| free_class_bookings | 4 (all status='pending' — the 'confirmed' state is unreachable; noted as dead-branch in admin_cancel_class source) | 2026-06-26 | live, trickle |
| trial_bookings | 9 (all status='booked') | 2026-05-15 | stale ~7 weeks |
| academy_waitlist | 3, none actioned | 2026-05-31 | barely used |

## 5. Waitlists

Structure: waitlist state lives in `bookings` (`status='waitlisted'`, `waitlist_position`, `promoted_from_waitlist`) plus an offer table `waitlist_offers(booking_id, class_id, member_id, status, offered_at, expires_at, resolved_at)` with a 30-minute expiry, advisory-locked reconcile RPC (`reconcile_waitlist_offers`), a 5-minute cron sweep (`waitlist-offer-sweep`), and member RPCs `join_waitlist` / `confirm_waitlist_booking` / `decline_waitlist_offer` and admin RPCs `admin_join_waitlist`/`admin_leave_waitlist`/`admin_promote_waitlisted`.

- `waitlist_offers`: 33 rows — lapsed 16, missed 10, accepted 7. **Earliest offer 2026-06-19** — the offer system is only ~2 weeks old on live; before that promotions were manual. Latest activity 2026-07-01.
- Current forward state is consistent: 23 waitlisted bookings all-time; the 5 future classes carrying a waitlist are all exactly at capacity (8/8, 12/12).

**Defect (a) — zero/no-charge waitlist promotions: CORROBORATED.**
22 promoted-from-waitlist confirmed bookings all-time; **8 promoted bookings have `credit_charged=false`** (7 still confirmed, 1 later cancelled). Detail (booking_id, booked date, disposition):

| booking | booked | status | plan unlimited? | future_month? | payment_status | payment row? |
|---|---|---|---|---|---|---|
| 1115c46f… | 2026-04-11 | cancelled | no | no | pending | none |
| 220095c6… | 2026-04-17 | confirmed | no | no | pending | none |
| 70dcd5ce… | 2026-05-06 | confirmed | no | no | pending | none |
| cc0ee0c9… | 2026-05-08 | confirmed | yes (unlimited) | no | not_required | n/a (legit) |
| 37988f65… | 2026-05-16 | confirmed | no | no | pending | none |
| 07a6ce3f… | 2026-05-22 | confirmed | no | no | pending | none |
| 5a9336aa… | 2026-06-19 | confirmed | yes (unlimited) | no | not_required | n/a (legit) |
| 87058f12… | 2026-07-01 | confirmed | no | no | pending | none |

→ **6 revenue-leaking promotions** (excluding the 2 unlimited-plan ones): confirmed with `payment_status='pending'`, `payment_required=false`, **no credit_ledger debit and no payments row ever created** — and the mechanism is visible in source: `admin_promote_waitlisted` sets `v_credit_charged := v_has_credits AND NOT v_unlimited AND NOT v_is_future_month` — i.e. **a zero-credit member is still promoted and confirmed, merely flagged payment_status='pending', and nothing downstream ever collects it**. The most recent instance is 2026-07-01 (member b176870f…, 0 credits) — the defect is still live. The member self-service path (`confirm_waitlist_booking`) does gate on credits (`needs_topup`), so the leak is the **admin promotion path**.

**Defect (b) — waitlist join failures: PLAUSIBLE, structurally.** Failures leave no rows, so direct evidence is absent, but `join_waitlist` returns errors for: already-booked, already-waitlisted, class not full ("Class is not full — book directly instead"), cancelled class. Capacity is computed by `get_total_class_booked` = confirmed bookings + PAYG (matched by *text* class_name+date+time) + free-class rows — the PAYG **text-matching** join means a renamed class type or time change silently changes "fullness", flipping join_waitlist between "not full" errors and accepting joins. `bookings` has UNIQUE(member_id, class_id); join_waitlist reuses cancelled rows so the constraint itself shouldn't 500. Offer flow itself is only live since 2026-06-19; 16 lapsed + 10 missed vs 7 accepted suggests most offers expire unanswered.

## 6. Leaderboard

- **`leaderboard_winners`: 0 rows — dead table.** Prize confirmation actually lives in `prize_draw_entries` (53 rows): May 2026 = 28 entries/1 winner (top 25 sessions), June 2026 = 25 entries/1 winner (top 23). RPCs `populate_prize_draw`, `pick_prize_draw_winner`, `get_prize_draw_entries/history/status` exist; cron `monthly-prize-draw-reminder` pushes Harry on the 1st of each month.
- Leaderboard is computed **server-side** via SECURITY DEFINER RPC `get_public_leaderboard(p_period)` (anon-executable) over two SQL views, `leaderboard_monthly` and `leaderboard_annual`: active members, not opted out, `bookings.status='confirmed' AND attended=true` joined to classes in period, UNION ALL `pt_bookings` (confirmed/completed, date < today), summed and ranked, top 10. Full RPC source captured in §16 archive; view definitions verified. So leaderboard correctness depends directly on the 13% unmarked-attendance gap.

## 7. Referrals

- `referrals` table (referrer_id, referred_id, referral_code, status, created_at): **0 rows. Empty. Ever.**
- 70 of 71 profiles have a generated `referral_code`; **0 profiles have `referred_by` set**.
- `get_referral_leaderboard()` RPC exists.
→ **Corroborates "broken end-to-end"**: codes are minted and displayed, but no referral has ever been recorded through the whole life of the system.

## 8. Session plans / Plan tool

- `session_plans` (old): 4 rows, latest 2026-03-10 — **dead** since March.
- `pt_session_plans`: 87 rows but latest 2026-03-11 — **dead** since March (superseded).
- `plans` (V2 Plan tool): 36 rows, 34 created by Harry (id 12b4633c…), 2 creators total. By month: Mar 13 (10 class/2 pt/1 sports), Apr 7, May 8 (all class), Jun 8 (6 class/2 pt), **Jul 0 so far**. Classes can carry `assigned_plan_id`/`assigned_week`.
→ Harry uses the Plan tool **consistently but modestly** (~7–13 plans/month, class-type templates), with plan_type='class' dominating.

## 9. Vouchers

`merch_vouchers` is a **balance table, not an issuance log**: (member_id, balance, total_earned, last_updated). 2 rows only: both balance=1000 (=£10), total_earned=1000, last_updated 2026-06-02 and 2026-07-01. **Nothing redeemed** (balance==total_earned; `redeem_voucher` RPC exists but unused). No redemption-date column exists at all.

## 10. Notifications infra

- `push_subscriptions`: 36 rows — 2 admins (**Harry included: yes**, user 12b4633c…) and **34 of 67 members (51%)**.
- `notifications`: 924 rows, 174 unread. By type (n / read / latest): pt_booking 266/241/07-01, payment 132/124/06-30, billing 128/88/07-01, booking 111/83/07-03, waitlist_update 101/73/06-29, waitlist 54/37/07-01, cancellation 33/20/06-26, broadcast 32/25/06-12, credit 29/26/06-26, waitlist_promoted 24/22/07-01, free_class_booking 10/10, waitlist_missed 2/0, leaderboard 2/1.
- `broadcasts`: 7 rows (Feb 18 "Testing Broadcast" → Jun 12), audiences 'today'/'custom', recipient counts 1–8. Note two pairs of duplicate sends minutes apart (May 26 ×2, Jun 12 ×2 with same text) — suggests double-send UX issue.
- `conversations` 62 / `messages` 373 (Apr 136, May 123, Jun 95, Jul 8) — messaging is genuinely used.
- Push delivery is server-driven: DB functions and 15 cron jobs POST to the `send-push-notification` edge function with a vault-stored service JWT.

## 11. Social media tool

`social_media_posts(caption, hashtags, platforms[], photo_url, class_id, class_type, class_time, posted_at, created_by)`: **4 rows total** — 2× 2026-02-21, 2× 2026-04-13 (instagram / instagram+facebook). Latest post ~12 weeks old → tool effectively **abandoned**, even though the `social-media-post-reminder` cron pushes Harry after every class (every 5 min sweep).

## 12. Expenses

`expenses` table exists (description, amount_pennies, category, receipt_url, date, created_by) with RLS policies and an (unused) index — **0 rows, never used**.

## 13. Nutrition

Usage is near-zero: member_nutrition_profiles 3, nutrition_log_entries 2, nutrition_water_log 2, nutrition_activities 1, nutrition_goals 1, nutrition_saved_meals 0, nutrition_active_calories 0. Yet **three daily nutrition cron pushes** (surplus-warning 13:30, deficit-prompt 17:00, protein-nudge 18:00) run against these tables, and ~17 nutrition RPCs exist. Heavy build, no adoption.

## 14. Training / workouts

- `workout_logs`: **0 rows (dead)**; `workout_summaries` also present.
- `exercise_sets` (member self-logging via save_workout_set): 392 rows — Mar 119, Apr 109, May 69, Jun 95 — modest but steady.
- `weights_log`: 601 rows, latest 2026-07-03 (partly synced from PT logs by trigger `sync_pt_log_to_weights_log`).
- `personal_training_logs`: 189, latest 2026-07-03 (live); `personal_training_sessions` 29 (latest 06-30); `personal_training_plans` 3; `personal_training_exercises` 92; `pt_sessions` 100; `sessions` 107 (latest 06-19); `pt_session_plans` dead since March.
- **`session_access_log`: 0 rows**, and **no function in `pg_proc` references it** — whatever "10-minute rule" it was meant to enforce, nothing writes to or reads from it. Dead scaffolding; the only 10-minute-ish behaviour on live is the attendance-reminder cron window (10–20 min after class end).

## 15. Cron (pg_cron on LIVE — 15 jobs, all active)

| job | schedule | what it does |
|---|---|---|
| generate-recurring-classes | 0 3 * * * | edge fn: creates classes from recurring_schedule |
| cleanup-deleted-accounts | 0 4 * * * | edge fn |
| check-split-payment-deadlines | */15 * * * * | edge fn — **auth header built from `current_setting('app.settings.service_role_key', true)` which is not set → likely sends "Bearer " (broken), unlike every other job which uses vault** |
| monthly-credit-reset | 1 23 28-31 * * | edge fn: plan_reset credits (ledger confirms runs, last 2026-07-01) |
| push-class-reminder | */5 | push 30 min before class |
| push-pt-session-reminder | */5 | push to member + Harry |
| monthly-prize-draw-reminder | 0 8 1 * * | push Harry |
| harry-early-session-wakeup | */5 | push Harry for ≤07:30 sessions |
| harry-attendance-reminder | */5 | push Harry 10–20 min after class w/ unmarked members |
| nutrition-surplus-warning | 30 13 * * * | member push |
| nutrition-deficit-prompt | 0 17 * * * | member push |
| nutrition-protein-nudge | 0 18 * * * | member push |
| social-media-post-reminder | */5 | push Harry 15–20 min after class end |
| trial-expiry-sweep | 0 8 * * * | runs expire_stale_trials(), pushes Harry |
| waitlist-offer-sweep | */5 | reconcile_waitlist_offers for expired offers |

Hard-coded Harry UUID (12b4633c-365e-42fa-939c-f1c744aa9de1) appears in 5+ jobs and in `admin_promote_waitlisted`.

## 16. RPC surface on LIVE

~135 functions in `public`; **essentially the whole API is SECURITY DEFINER plpgsql** (only 5 non-definer: enforce_slot_non_overlap, normalize_phone, pt_sessions_set_funding_source, update_trial_bookings_updated_at, update_updated_at). All definer functions checked carry `SET search_path TO 'public'`.

Hardening status vs the May-2026 "Phase 0 hardened anon-executable definer RPCs" claim: **partially visible**. Most admin/member RPCs are not anon-executable, but **12 SECURITY DEFINER functions remain EXECUTE-granted to `anon`** (confirmed via `has_function_privilege` and independently by Supabase security advisors):

admin_cancel_class, book_free_class, check_guest_phone, get_class_booking_counts, get_group_pt_participant, get_public_leaderboard, has_nutrition_access, is_admin, notify_guest_booking, reconcile_waitlist_offers, record_group_pt_payment, reorder_waitlist_positions.

Risk triage of the anon set:
- `admin_cancel_class` — **guards internally with `is_admin()`** so anon calls no-op, but the grant itself violates the hardening claim (full source captured below).
- `reconcile_waitlist_offers(p_class_id)` / `reorder_waitlist_positions(p_class_id)` — **NO auth check at all**: anon can force offer generation, waitlist reordering, notification inserts and push sends for any class id (spam/griefing vector).
- `notify_guest_booking` — no auth check: anon can inject arbitrary "Guest Booking" notifications to all admins.
- `book_free_class` — intentionally public but unthrottled: anon can insert unlimited rows + admin notifications.
- `record_group_pt_payment` — flips participants to paid given a (hard-to-guess) uuid token with any client-supplied stripe intent string; no Stripe verification server-side.
- `check_guest_phone` — phone-number oracle (enumeration).
- Full sources of all six risk-relevant functions were captured verbatim during audit (admin_cancel_class, book_free_class, notify_guest_booking, reconcile_waitlist_offers, record_group_pt_payment, reorder_waitlist_positions) — see appendix note below; key excerpts:

```sql
-- reconcile_waitlist_offers: first lines — note the ABSENCE of any is_admin()/auth.uid() gate
CREATE OR REPLACE FUNCTION public.reconcile_waitlist_offers(p_class_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ...
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('hvpt_waitlist_' || p_class_id::text));
  SELECT * INTO v_class FROM classes WHERE id = p_class_id;  -- no auth check
  ...creates offers, inserts notifications, net.http_post(...push...) using vault service JWT...
```

```sql
-- reorder_waitlist_positions: entire body — no auth gate, mutates bookings
CREATE OR REPLACE FUNCTION public.reorder_waitlist_positions(p_class_id uuid)
 RETURNS TABLE(member_id uuid, waitlist_position integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT b.id, b.member_id,
           ROW_NUMBER() OVER (ORDER BY b.waitlist_position ASC, b.id ASC) AS new_pos
    FROM bookings b
    WHERE b.class_id = p_class_id AND b.status = 'waitlisted'
  ),
  upd AS (
    UPDATE bookings b SET waitlist_position = ranked.new_pos
      FROM ranked
     WHERE b.id = ranked.id AND b.waitlist_position IS DISTINCT FROM ranked.new_pos
    RETURNING b.member_id, b.waitlist_position
  )
  SELECT upd.member_id, upd.waitlist_position FROM upd;
END; $function$
```

```sql
-- notify_guest_booking: entire body — anon-callable admin-notification injector
CREATE OR REPLACE FUNCTION public.notify_guest_booking(p_guest_name text, p_class_name text, p_class_date text, p_class_time text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin_id UUID;
BEGIN
  FOR v_admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (v_admin_id, 'guest_booking', 'Guest Booking',
      p_guest_name || ' has booked ' || p_class_name || ' on ' || p_class_date || ' at ' || p_class_time || ' via guest pass.');
  END LOOP;
END; $function$
```

(admin_cancel_class ~300 lines, book_free_class, record_group_pt_payment sources also captured verbatim in audit transcript; admin_cancel_class opens with `IF NOT is_admin() THEN RETURN jsonb_build_object('error','Not authorized'); END IF;` — internally gated.)

Also: `fix_auth_user_null_tokens(target_email)` and `get_auth_user_by_email(p_email)` exist as definer functions (authenticated-executable) — auth-schema touching utilities left in the public API surface.

## 17. Advisors (LIVE)

**Security: 139 findings, all WARN, all one of two lint types:**
- `anon_security_definer_function_executable` × **12** — exactly the 12 functions listed in §16 (advisor details name each: admin_cancel_class, book_free_class, check_guest_phone, get_class_booking_counts, get_group_pt_participant, get_public_leaderboard, has_nutrition_access, is_admin, notify_guest_booking, reconcile_waitlist_offers, record_group_pt_payment, reorder_waitlist_positions — each callable via `/rest/v1/rpc/<name>`).
- `authenticated_security_definer_function_executable` × **127** — effectively every RPC is definer + executable by any logged-in member; per-function authorization exists only where hand-written inside each body.
- Notably ZERO "RLS disabled" or "policy missing" errors — RLS is enabled across public tables.

**Performance: 751 findings:**
- `multiple_permissive_policies` WARN × **545** across 58 tables (bookings, credit_ledger, profiles, notifications, etc.) — duplicate permissive RLS policies evaluated per query.
- `auth_rls_initplan` WARN × **157** across 68 tables — `auth.uid()` re-evaluated per row in policies (unwrapped).
- `unindexed_foreign_keys` INFO × 20 (15 tables incl. waitlist_offers, plans, pt_booking_requests, sessions).
- `unused_index` INFO × 28 (21 tables — incl. expenses, session_access_log, social_media_posts — consistent with dead features).
- `auth_db_connections_absolute` INFO × 1 (Auth server capped at 10 connections).

## 18. Booking window rule (≤1 month ahead)

- **No table constraint and no trigger** enforces a booking horizon: `bookings` constraints are PK/FKs, UNIQUE(member_id,class_id), status CHECK (confirmed/cancelled/waitlisted), effort_rating CHECK. The only bookings trigger is a notification trigger; classes have a slot-overlap trigger and UNIQUE(class_type_id,date,start_time).
- Enforcement is **inside the `book_class` RPC only**: `v_month_after_next := date_trunc('month', CURRENT_DATE) + 2 months; IF v_class_date >= v_month_after_next THEN error 'You can book up to one month ahead…'`. Plus a per-plan future-month quota (future bookings in month M capped at plan credits, deducted "on billing day" by monthly-credit-reset).
- Bypass surfaces: `admin_book_class` and waitlist paths don't hit the cap logic; however live data shows no violation — **furthest confirmed class date is 2026-08-01** (within cap), 304 future confirmed bookings.
- Note: `join_waitlist`/`admin_promote_waitlisted` future-month handling relies on the 0-amount ledger marker "credit deducts on billing day", making the monthly-credit-reset edge function the real financial enforcement point — invisible to SQL audit.

---

## Behavioural findings ranked (what a repair-vs-rebuild decision should know)

1. **The core loop works and is busy.** 67 active members, ~420–470 confirmed bookings/month, live dual credit ledgers that reconcile in recent months, working waitlist offers, PT bookings, messaging, push, 15 active cron jobs, £2.6k+/mo subscription collection since May. This is a functioning production system, not a wreck.
2. **The waitlist zero-credit leak is real, current, and located**: `admin_promote_waitlisted` confirms zero-credit members with `payment_status='pending'` that nothing ever collects — 6 uncollected promotions to date, most recent 2026-07-01. One-function fix.
3. **Two paying members are invisibly unbilled**: active "8 Classes/Month" subs created mid-June with no stripe_subscription_id and period ended 2026-07-01 — revenue silently leaking now.
4. **Phase-0 hardening is incomplete on live**: 12 SECURITY DEFINER RPCs still anon-executable (advisor-confirmed), including three with no auth gate at all (reconcile_waitlist_offers, reorder_waitlist_positions, notify_guest_booking) and admin_cancel_class (gated internally but still granted). 127 more definer RPCs rely purely on hand-rolled per-body auth.
5. **Referrals are provably dead end-to-end**: 70 members hold referral codes; the referrals table has never contained a row; no profile has referred_by. Data fully corroborates the "broken" belief.
6. **Feature graveyard is large and identifiable**: attendance table (0), workout_logs (0), expenses (0), session_access_log (0, referenced by no function — the 10-minute rule is enforced nowhere), leaderboard_winners (0, superseded by prize_draw_entries), session_plans/pt_session_plans (dead since March), nutrition (3 users despite 17 RPCs + 3 daily crons), social_media_posts (4 rows, dead since April despite a 5-minute reminder cron).
7. **Attendance drives the leaderboard/prize draw and has a 13% hole**: 353 of 2,766 confirmed bookings unmarked; leaderboard = SQL views over bookings.attended + pt_bookings, so prize fairness inherits the gap. Prize draw itself is operating (May & June winners picked).
8. **Zero-credit exposure cohort confirmed**: 19/57 active subs at exactly 0 credits right after the July reset; end-of-June ledger shows 14/47 with-history members at ≤0, plus ~20 members with no class-credit facility at all — consistent with the PRD's 41/69 framing.
9. **Booking horizon is RPC-enforced only** (book_class current+next month); no constraint/trigger backstop, but live data shows no breach (max confirmed class 2026-08-01).
10. **Billing history is only ~2 months deep on Stripe** (real sub collection since May 2026; 31 bulk-voided "first month" rows on May 1 from the cutover; 4 failed sub payments) — any rebuild migration surface is small.
11. **Operational fragility concentrated in cron + hardcoded IDs**: Harry's UUID hardcoded in 5+ cron jobs and an RPC; one cron (check-split-payment-deadlines) builds its auth header from an unset `app.settings.service_role_key` and has likely been calling its edge function with an empty bearer token every 15 minutes.
12. **Performance advisor load is heavy but mechanical**: 545 multiple-permissive-policy + 157 RLS-initplan warnings across ~60 tables — a rewrite-scale policy cleanup either way (repair or rebuild).

Data quality for decision-making: no test-account pollution; counts trustworthy; migration artifacts (glofox rows, April ledger gaps) clearly fenced to Feb–Apr 2026.
