# HVPT Backend Forensic Evidence — Staging (`gkdhbeoxreyzjwjitykq`, train-hvpt-staging)

Read-only architecture audit. Collected 2026-07-04 via Supabase MCP (`execute_sql` SELECT-only, `get_advisors`, `list_extensions`, `list_migrations`). Staging schema mirrors live.

**Top-line counts:** 75 base tables (all RLS-enabled, none FORCE RLS, 0 tables with RLS-but-no-policy), 5 views (all `security_invoker=true`), 190 RLS policies, ~140 public functions (mostly `SECURITY DEFINER`), 16 triggers, 1 cron job, 6 migrations, 143 security lints + 677 performance lints.

---

## 1. Schema Map (by domain)

Every base table has RLS enabled and RLS **not** forced. PK is `id uuid DEFAULT gen_random_uuid()` unless noted. Only non-obvious columns/FKs highlighted; full column lists condensed.

### 1a. Membership / Billing
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `profiles` | id (=auth.users.id), email UNIQUE, first/last_name, role DEFAULT 'member', status, parq_completed/parq_data jsonb, referral_code UNIQUE, referred_by, stripe_customer_id UNIQUE, pt_credits_remaining, migrated_credits/migrated_from/migrated_at, cancellation_* , scheduled_deletion_at, notification_prefs jsonb | id | id→auth.users(CASCADE); referred_by→profiles(SET NULL) |
| `membership_plans` | name, credits, price_pennies, interval, stripe_price_id, stripe_price_id_may, unlimited_classes, visible/active | id | — |
| `member_subscriptions` | member_id UNIQUE, plan_id, stripe_subscription_id, credits_total/remaining, billing_day, current_period_start/end, status, paused_at, awaiting_activation | id | member_id→profiles(CASCADE); plan_id→membership_plans |
| `credit_ledger` | member_id, amount, balance_after, type, description, related_id, created_by | id | member_id→profiles(CASCADE); created_by→profiles(SET NULL) |
| `payments` | member_id, type, amount_pennies, currency, status, stripe_payment_intent_id, stripe_invoice_id, refund_amount_pennies, refunded_by, guest_name/email | id | member_id→profiles(CASCADE); refunded_by→profiles(SET NULL) |
| `payg_credit_packs` | name, credits, price_pennies, stripe_price_id, active | id | — |
| `merch_vouchers` | member_id UNIQUE, balance, total_earned | id | member_id→profiles |
| `migration_status` | member_email (PK), invite_sent, registered, first_payment, glofox_cancelled | member_email | — (Glofox migration tracking) |

### 1b. Bookings / Classes / Waitlists
| Table | Key columns | PK | FKs / uniques |
|---|---|---|---|
| `class_types` | slug UNIQUE, name, duration_mins, max_capacity, colour, payg_rate, met_value, active | id | — |
| `classes` | class_type_id, date, start_time/end_time, capacity, instructor, cancelled, cancel_reason, assigned_plan_id, assigned_week | id | class_type_id→class_types; assigned_plan_id→plans; UNIQUE(class_type_id,date,start_time) |
| `recurring_schedule` | class_type_id, day_of_week, start_time/end_time, capacity, active | id | class_type_id→class_types; UNIQUE(class_type_id,day_of_week,start_time) |
| `bookings` | member_id, class_id, status DEFAULT 'confirmed', waitlist_position, credit_charged/refunded, payment_type, payment_status, promoted_from_waitlist, attended, effort_rating, payment_id | id | member_id→profiles(CASCADE); class_id→classes(CASCADE); payment_id→payments(SET NULL); UNIQUE(member_id,class_id) |
| `waitlist_offers` | booking_id, class_id, member_id, status DEFAULT 'offered', offered_at, expires_at, resolved_at | id | booking_id→bookings(CASCADE); class_id→classes; member_id→profiles |
| `attendance` | class_id, member_id, status, marked_by, marked_at | id | class_id→classes(CASCADE); member_id→profiles(CASCADE); marked_by→profiles(SET NULL); UNIQUE(class_id,member_id) |
| `blocked_slots` | date, start_time/end_time, reason, created_by | id | created_by→profiles |
| `admin_appointments` | type, title, member_name, date, time, end_time, notes | id | — (no FK; member_name is free text) |
| `free_class_bookings` | name/email/phone, class_id, class_name/date/time, status, follow_up_sent, confirmed_by | id | class_id→classes(SET NULL) |
| `trial_bookings` | full_name/email/phone, class_name/date/time, status, payment_status, stripe_*, converted_member_id, member_id, member_created | id | converted_member_id→profiles; member_id→profiles(SET NULL) |
| `payg_bookings` | guest_name/email, class_name/date/time, payment_id, stripe_pi, class_id, member_id | id | class_id→classes(SET NULL); payment_id→payments; member_id→profiles(SET NULL) |
| `guest_passes` | member_id, guest_name/email, class_id, parq_status, converted, converted_member_id | id | member_id→profiles(SET NULL); class_id→classes(SET NULL); converted_member_id→profiles(SET NULL) |
| `guest_pass_links` | guest_pass_id, member_id, token UNIQUE, used, guest_*, parq_data jsonb, expires_at DEFAULT now()+30d | id | guest_pass_id→guest_passes; member_id→profiles |

### 1c. PT / Group PT (heavily duplicated domain — see §8)
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `pt_bookings` | member_id, date, start/end_time, status, credit_charged/refunded, post_session_note | id | member_id→profiles |
| `pt_booking_requests` | member_id, preferred_date/time, notes, status | id | member_id→profiles(CASCADE) |
| `pt_sessions` | member_id, date, start/end_time, price_pennies DEFAULT 4000, payment_id, status, focus, voice_note_url, funding_source | id | member_id→profiles(CASCADE); payment_id→payments(SET NULL) |
| `pt_credit_ledger` | member_id, amount, balance_after, type, description, related_id | id | member_id→profiles |
| `pt_packages` | name, sessions, price_pennies, per_session_pennies, stripe_price_id, active | id | — |
| `pt_session_plans` | client_name, client_goals[], fitness_level, session_data jsonb, created_by, pt_session_id | id | created_by→profiles; pt_session_id→pt_sessions(SET NULL) |
| `personal_training_plans` | created_by, name, goal, weeks, status | id | created_by→profiles |
| `personal_training_sessions` | plan_id, week_number, day_label, session_order | id | plan_id→personal_training_plans(CASCADE) |
| `personal_training_exercises` | session_id, exercise_name, sets_target, reps_target, weight_target_kg | id | session_id→personal_training_sessions(CASCADE) |
| `personal_training_logs` | exercise_id, logged_by, log_date, sets_actual, reps_actual, sets_data jsonb, weights_log_id | id | exercise_id→personal_training_exercises(CASCADE); logged_by→profiles; weights_log_id→weights_log(SET NULL) |
| `group_pt_bookings` | session_type, lead_member_id, date, start/end_time, total_amount, status, payment_deadline, payment_type DEFAULT 'split' | id | lead_member_id→profiles |
| `group_pt_participants` | booking_id, name/email/phone, share_amount, payment_token uuid DEFAULT gen_random_uuid(), stripe_pi, paid, is_lead, payment_status, parq_status, checkout_session_id | id | booking_id→group_pt_bookings(CASCADE) |

### 1d. Training / Workouts / Plans (duplicated: plans vs session_plans vs sessions vs blocks — see §8)
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `plans` | plan_type, class_type_id, sport, member_id, is_template, template_source_id, source_template_id, title, status, group_member_ids[], pt_booking_id, day_of_week | id | created_by→auth.users; template_source_id/source_template_id→plans; pt_booking_id→pt_bookings; member_id→profiles; class_type_id→class_types |
| `blocks` | plan_id, block_number, duration_weeks, start/end_date, status | id | plan_id→plans(CASCADE); UNIQUE(plan_id,block_number) |
| `sessions` | block_id, week_number, day_of_week, warmup/cooldown jsonb, class_id, session_date, linked_class_id, access_until | id | block_id→blocks(CASCADE); class_id→classes; linked_class_id→classes |
| `session_plans` | class_type, block_number, week_number, day_of_week, goal, session_data jsonb, class_id | id | class_id→classes(SET NULL); created_by→profiles |
| `session_notes` | session_id, plan_id, member_id, note_text, note_type, created_by | id | session_id→sessions(SET NULL); plan_id→plans(CASCADE); member_id→profiles; created_by→auth.users |
| `member_session_comments` | session_id, plan_id, member_id, comment_text, comment_type, editable_until | id | plan_id→plans(CASCADE); session_id→sessions(SET NULL); member_id→profiles |
| `exercise_sets` | session_id, exercise_id, exercise_name, sets/reps/duration, tempo_code, weight_kg, equipment, sport_rationale | id | session_id→sessions(CASCADE); exercise_id→exercises |
| `exercises` | name UNIQUE, slug UNIQUE, category, muscle_group, equipment[], track_* flags, active | id | — |
| `custom_exercises` | name, class_types[], notes | id | — |
| `progression_rules` | exercise_set_id, target_week, progression_type/value, weight_increment_kg | id | exercise_set_id→exercise_sets(CASCADE); UNIQUE(exercise_set_id,target_week,progression_type) |
| `member_exercise_overrides` | member_id, exercise_set_id, session_id, weight_kg/reps/sets/rest, scope | id | member_id→profiles(CASCADE); exercise_set_id→exercise_sets(CASCADE); session_id→sessions(CASCADE); UNIQUE(member_id,exercise_set_id,session_id) |
| `member_block_plans` | member_id, duration_weeks, sessions jsonb, status, created_by | id | member_id→**auth.users**(CASCADE); created_by→**auth.users** (⚠ inconsistent: most tables FK to profiles) |
| `workout_templates` | name, start/end_date, exercises jsonb, is_active, block_name, week_data jsonb, class_type, config jsonb | id | created_by→profiles |
| `workout_logs` | member_id, class_id, session_id, exercise_name, set_number, weight_kg, reps_completed, class_date/type, completed | id | member_id→profiles(CASCADE); class_id→classes(SET NULL); session_id→sessions(SET NULL) |
| `workout_summaries` | member_id, class_id, class_date/type, exercises_completed, total_sets, total_volume_kg | id | member_id→profiles(CASCADE); class_id→classes(SET NULL); UNIQUE(member_id,class_id) |
| `weights_log` | member_id, class_id, pt_session_id, date, exercise_name, sets/reps/weight_kg, volume, is_pb, pb_type, sets_data jsonb | id | member_id→profiles(CASCADE); class_id→classes(SET NULL); pt_session_id→pt_sessions(SET NULL) |
| `body_measurements` | member_id, date, weight_kg, body_fat_pct, chest/waist/hips/etc_cm, logged_by | id | member_id→profiles(CASCADE); logged_by→profiles(SET NULL) |
| `equipment` | name, slug UNIQUE, category, quantity, condition, value_pennies | id | — |

### 1e. Nutrition
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `member_nutrition_profiles` | member_id UNIQUE, gender, dob, height/weight, goal, training_frequency, bmr/tdee/base_tdee, calorie/protein/carb/fat targets, water_target_ml, activity_level | id | member_id→profiles(CASCADE) |
| `nutrition_goals` | member_id, goal_type, target_kg/date, daily_calorie_adjustment, status | id | member_id→profiles(CASCADE) |
| `nutrition_log_entries` | member_id, log_date, meal_type, food_name, brand, off_product_id, portion_g, calories/protein/carbs/fat, saved_meal_id | id | member_id→profiles(CASCADE) |
| `nutrition_saved_meals` | member_id, meal_name, items jsonb, totals | id | member_id→profiles(CASCADE) |
| `nutrition_water_log` | member_id, log_date, amount_ml | id | member_id→profiles(CASCADE) |
| `nutrition_activities` | member_id, activity_name, met_value, duration_minutes, calories_burned, activity_date | id | member_id→profiles(CASCADE) |
| `nutrition_active_calories` | member_id, log_date, source, class_booking_id, calories_estimated/override | id | member_id→profiles(CASCADE); class_booking_id→bookings(SET NULL); UNIQUE(member_id,log_date) |
| `cycle_tracking` | member_id UNIQUE, last_period_start, cycle_length, tracking_enabled | id | member_id→profiles(CASCADE) |

### 1f. Notifications / Messaging
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `notifications` | user_id, type, title, body, read, related_id | id | user_id→profiles(CASCADE) |
| `conversations` | member_id UNIQUE, last_message_at, unread_member/admin | id | member_id→profiles(CASCADE) |
| `messages` | conversation_id, sender_id, content, content_type, attachment_url, read_at | id | conversation_id→conversations(CASCADE); sender_id→profiles(CASCADE) |
| `broadcasts` | sender_id, audience, audience_label, recipient_count, recipient_ids uuid[], message | id | sender_id→profiles(CASCADE) |
| `push_subscriptions` | user_id, subscription jsonb | id | user_id→profiles(CASCADE) |

### 1g. Leaderboard / Referrals / Vouchers / Prize draw
| Table | Key columns | PK | FKs |
|---|---|---|---|
| `leaderboard_winners` | member_id, month, prize_description, eligible | id | member_id→profiles; UNIQUE(member_id,month) |
| `referrals` | referrer_id, referred_id, referral_code, status | id | referrer_id→profiles(CASCADE); referred_id→profiles(CASCADE) |
| `prize_draw_entries` | member_id, month, year, sessions_attended, won | id | member_id→profiles; UNIQUE(member_id,month,year) |
| `academy_waitlist` | name/email/phone, child_age, actioned | id | — (lead capture) |
| `sport_interest` | name/email/phone, sport, actioned | id | — (lead capture) |

**Views (5, all `security_invoker=true`):** `leaderboard_annual`, `leaderboard_monthly` (aggregate confirmed bookings per member, rank), `personal_bests` (UNION of the two below), `personal_bests_1rm` (weights_log where pt_session_id NOT NULL AND reps=1), `personal_bests_volume` (weights_log where pt_session_id NULL AND reps>=5).

### 1h. Admin / Ops / Misc
| Table | Key columns | PK |
|---|---|---|
| `admin_settings` | key (PK), value jsonb, updated_at | key |
| `expenses` | description, amount_pennies, category, receipt_url, date, created_by→profiles(CASCADE) | id |
| `social_media_posts` | caption, hashtags, platforms[], photo_url, class_id→classes, created_by→profiles | id |
| `coach_assistant_log` | admin_id→profiles(CASCADE), member_id→profiles(SET NULL), question, context, response, referred_to_professional | id |
| `parq_audit` | member_id→profiles, version, parq_data jsonb, action | id |
| `session_access_log` | member_id→profiles(CASCADE), session_id→sessions(CASCADE), class_id→classes | id |

### Dead / legacy / duplicated-concept tables (flagged)
- **Class/session naming collision:** `classes` (scheduled group classes, live) vs `sessions` (training-block sessions under `blocks`) vs `pt_sessions` (1:1 PT) vs `personal_training_sessions` (template rows under `personal_training_plans`). Four different "session" concepts.
- **Plan triplication:** `plans` (+`blocks`+`sessions`+`exercise_sets` = the live programming engine) vs `session_plans` (older jsonb `session_data` blob keyed by class_type/block/week) vs `personal_training_plans` (+sessions+exercises+logs, a **parallel** PT programming stack) vs `pt_session_plans` (standalone jsonb PT plans by client_name, not FK-linked to a member) vs `member_block_plans` (jsonb `sessions`, FKs to auth.users not profiles) vs `workout_templates` (jsonb). At least **6 overlapping plan/template models** — strong legacy/duplication smell.
- **Credit ledger duplication:** `credit_ledger` (class credits) vs `pt_credit_ledger` (PT credits) — parallel structures; PT credits also mirrored as scalar `profiles.pt_credits_remaining`.
- **Booking sprawl:** `bookings`, `pt_bookings`, `pt_booking_requests`, `group_pt_bookings`, `payg_bookings`, `free_class_bookings`, `trial_bookings` — 7 booking tables with divergent schemas.
- **Workout logging duplication:** `workout_logs` (per-set, class context) vs `weights_log` (per-exercise, PB tracking) vs `personal_training_logs` (mirrored INTO weights_log by a trigger, see §4). Three overlapping logging tables kept in sync by trigger glue.
- `migration_status` + `profiles.migrated_*` columns: Glofox migration scaffolding, likely dead post-migration.

---

## 2. RPC Surface

~140 functions in `public`. Almost all are `SECURITY DEFINER`, `owner=postgres`, with `SET search_path=public` (a few also `pg_temp`). The handful of `SECURITY INVOKER` functions are trigger helpers: `enforce_slot_non_overlap`, `pt_sessions_set_funding_source`, `update_updated_at`, `update_trial_bookings_updated_at`, `normalize_phone` (immutable helper).

### 2a. SECURITY DEFINER functions executable by `anon` (12) — HARDENING CHECK

The May-2026 finding was "anon-executable SECURITY DEFINER RPCs (since hardened in Phase 0)." **Assessment: PARTIALLY hardened.** These 12 SECDEF functions still carry `EXECUTE` to `anon`/PUBLIC (grants **not** revoked), but the intentionally-public ones do their own auth/token gating in-body, and the one truly sensitive admin RPC re-checks `is_admin()`. So the residual exposure is the un-revoked grants themselves, not (in the sampled cases) an actual privilege bypass. Detail per function:

| Function | anon-safe? | Why |
|---|---|---|
| `admin_cancel_class(uuid,text)` | ✅ gated | **First line `IF NOT is_admin() THEN RETURN error`** (verified in source). Anon `auth.uid()`=NULL ⇒ is_admin() false ⇒ rejected. Grant to anon is superfluous but not a bypass. |
| `is_admin()` | ✅ | Returns EXISTS(profiles WHERE id=auth.uid() AND role='admin'); for anon returns false. Public-safe boolean. |
| `book_free_class(...)` | ⚠ intentional public | Public lead-capture: inserts into `free_class_bookings` + notifies admins. No auth needed by design, but **unauthenticated write path** — spammable (no rate limit / captcha visible). |
| `check_guest_phone(text)` | ⚠ intentional public | Normalizes phone, returns is_known boolean across profiles/guest/trial. **Data-probe surface**: lets anon test whether a phone number is a known member/trial (enumeration/PII-leak of membership status). |
| `notify_guest_booking(...)` | ⚠ intentional public | Inserts admin notifications from anon-supplied strings. Notification-spam / content-injection vector into admin bell feed. |
| `get_group_pt_participant(uuid token)` | ✅ token-gated | Returns participant+booking by unguessable `payment_token` uuid. Standard capability-URL pattern. |
| `record_group_pt_payment(uuid token,text pi)` | ✅ token-gated | Guarded state machine (only `accepted`→confirm), advisory-locked, honest refund reporting. Token-gated. |
| `get_public_leaderboard(text)` | ✅ by design | Top-10 from leaderboard views. Public feature. Exposes member first/last name + session counts. |
| `get_class_booking_counts(uuid[])` | ✅ by design | Aggregate counts only (bookings+payg+free) for schedule display. No PII. |
| `has_nutrition_access(uuid)` | ✅ | Boolean subscription check; used inside RLS. Harmless to anon. |
| `reconcile_waitlist_offers(uuid)` | ⚠ over-granted | Heavy waitlist state mutation + push-notification sender (reads `vault.decrypted_secrets`). Called by cron; **should not be anon-executable**. No internal caller auth check — relies on advisory lock + class-state guards, but any anon can trigger waitlist churn/push sends for an arbitrary class_id. |
| `reorder_waitlist_positions(uuid)` | ⚠ over-granted | Renumbers waitlist positions for any class_id. No auth check in body; anon can invoke. Low-impact but unnecessary exposure. |

**Verdict:** The dangerous *admin* RPC (`admin_cancel_class`) is correctly self-gated, and token/aggregate functions are fine. But `reconcile_waitlist_offers`, `reorder_waitlist_positions`, `book_free_class`, `check_guest_phone`, `notify_guest_booking` remain anon-reachable with side effects and no rate limiting. Full grant-revocation hardening is **incomplete** on staging.

### 2b. SECURITY DEFINER executable by `authenticated` (129 flagged by advisor)
Nearly the entire application RPC layer is SECDEF granted to `authenticated`. This is the app's intended pattern (thin RLS + fat SECDEF RPCs). Two functions grant only `service_role`/`postgres` (correct restriction): `book_paid_class` (Stripe webhook path). Purpose summary of the notable ones:

- **Booking:** `book_class`, `book_class_payg`, `cancel_booking`, `confirm_waitlist_booking`, `join_waitlist`/`leave_waitlist`, `decline_waitlist_offer`, `book_pt_session`, `cancel_pt_booking`, `book_trial`, `confirm_cash_payment`.
- **Admin ops (self-gated via is_admin()):** `admin_adjust_credits`, `admin_book_class`, `admin_cancel_booking`, `admin_cancel_pt_booking`, `admin_change_plan`, `admin_promote_waitlisted`, `admin_join/leave_waitlist`, `admin_update_class_capacity/time`, `admin_send_message`, `admin_accept/decline_group_pt_booking`, `admin_delete_pt_log`, `admin_update_pt_log`, `send_broadcast`, `mark_attendance`, `mark_all_present`. ⚠ These are granted to plain `authenticated` and rely on an **in-body `is_admin()` check** for authorization rather than a grant boundary — correctness depends on every one of them actually performing the check (only spot-verified `admin_cancel_class`).
- **Member self-service reads/writes:** `get_my_bookings`, `get_my_attendance`, `get_member_upcoming_bookings`, `get_notifications`, `mark_notification_read`, `mark_all_notifications_read`, `send_message`, `get_conversation_messages`, `mark_messages_read`, nutrition suite (`save_/get_/delete_nutrition_*`, `add_water_entry`, `save_/delete_meal_template`, `toggle_favourite`, `save_/complete_nutrition_goal`, `save_cycle_tracking`, `get_cycle_tracking`), workout suite (`save_workout_set`, `save_workout_summary`, `get_workout_history`, `get_member_exercise_history`, `save_member_override`, `get_session_with_overrides`).
- **Account:** `delete_own_account` (auth.uid gated; sets scheduled_deletion), `activate_payg_plan`, `redeem_voucher`, `redeem_guest_pass_link`.
- **Auth/schema-touching (search_path spans `auth`):** `fix_auth_user_null_tokens(text)` — **UPDATEs `auth.users` token columns**, granted to `authenticated` (⚠ maintenance/hack function that mutates the auth schema; should not be in the authenticated grant set). `get_auth_user_by_email(text)` — returns auth.users.id by email, granted to authenticated (**email→uuid enumeration of the auth table**).
- **Prize draw / referrals / migration:** `pick_prize_draw_winner`, `populate_prize_draw`, `get_prize_draw_*`, `get_referral_leaderboard`, `get_all_vouchers`, `upsert_migration_status`, `get_migration_status_full`, `get_admin_members`, `get_admin_inbox`, `get_broadcast_history`, `get_expiring_trials`, `expire_stale_trials`.

Full source captured for the risky anon-set in §2a. `fix_auth_user_null_tokens` and `get_auth_user_by_email` are the two most concerning authenticated-grantable definers (auth-schema reach).

---

## 3. RLS Policies (190 policies across all 75 tables)

Every table has RLS enabled and at least one policy — **0 tables with RLS-enabled-but-no-policy** (verified). Policies are almost all declared for the `public` grantee role (not restricted to `authenticated`), relying on `auth.uid()` returning NULL for anon. Standard shape: `<table>_admin_all` (ALL, `is_admin()` or `EXISTS(profiles WHERE id=auth.uid() AND role='admin')`) + member self-scope (`auth.uid() = member_id`). Condensed full table at `scratchpad/policies_table.md`.

### 3a. Known Supabase perf issue — un-wrapped `auth.uid()` (NOT hardened)
**151 of 190 policies call `auth.uid()` / `is_admin()` un-wrapped** (i.e. not `(SELECT auth.uid())`), forcing per-row re-evaluation. The advisor confirms this as **`auth_rls_initplan` on 157 policies across 68 tables** (§7). Sample (verbatim):
- `bookings_member_select_own` USING `(auth.uid() = member_id)` — naked.
- `nutrition_log_entries / Members read own` USING `(member_id = auth.uid())` — naked.
- `profiles / Users read own` USING `(auth.uid() = id)` — naked.
Only a few policies use the wrapped `(SELECT ...)` form. **This is unhardened across virtually the whole schema** and is the single largest performance debt item.

### 3b. Policies calling functions per-row (performance + correctness debt)
- **18 policies embed `is_admin()`** (itself a SECDEF query on profiles) in USING/CHECK — evaluated per row. Combined with un-wrapping, admin reads scan profiles once per result row.
- Admin policies that inline `EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin')` (e.g. `bookings_admin_all`, `payments_admin_all`) do the same subquery per row.
- `nutrition_log_entries` INSERT CHECK calls `has_nutrition_access(auth.uid())` (a SECDEF join over member_subscriptions+membership_plans) **per inserted row**.

### 3c. Overly-broad `USING true` policies (11) — review for sensitivity
| Table | Policy | Cmd | Role | Note |
|---|---|---|---|---|
| `admin_settings` | Anon can read settings | SELECT | anon | ⚠ **anon reads all admin_settings jsonb** — verify no secrets/keys stored here |
| `admin_settings` | Authenticated can read settings | SELECT | authenticated | any member reads all settings |
| `academy_waitlist` | Admins can read all waitlist entries | SELECT | authenticated | ⚠ named "Admins" but USING `true` for **all authenticated** — any member reads every lead's name/email/phone/child_age (PII leak) |
| `sport_interest` | admin_read_sport_interest | SELECT | authenticated | ⚠ same pattern — any authenticated user reads all sport-interest leads (PII) |
| `blocked_slots` | Anyone can read | SELECT | public | schedule availability, low risk |
| `class_types` / `classes` / `recurring_schedule` | Public read | SELECT | public | public schedule, by design |
| `equipment` | equipment_member_select | SELECT | public | gym equipment list, low risk |
| `exercises` | exercises_select_all | SELECT | public | exercise library, by design |
| `pt_packages` | Anyone can read | SELECT | public | pricing, by design |

The two PII leaks (`academy_waitlist`, `sport_interest`) and `admin_settings` anon-read are the flags here.

---

## 4. Triggers (16 on public tables)

| Table | Trigger | Timing/Event | Function | What it does |
|---|---|---|---|---|
| `bookings` | trg_notify_booking_status | AFTER INS/UPD | `notify_booking_confirmed` (SECDEF) | On confirm insert, sends push via `net.http_post` to edge fn using `vault` service_role_jwt; skips `glofox_migration` type |
| `classes` | trg_slot_non_overlap | BEFORE INS/UPD | `enforce_slot_non_overlap` (INVOKER) | Rejects overlapping slots per kind (class/pt_booking/group); skips cancelled/non-confirmed |
| `group_pt_bookings` | trg_slot_non_overlap | BEFORE INS/UPD | `enforce_slot_non_overlap` | same |
| `pt_bookings` | trg_slot_non_overlap | BEFORE INS/UPD | `enforce_slot_non_overlap` | same |
| `free_class_bookings` | trg_notify_new_free_class_booking | AFTER INS | `notify_new_free_class_booking` (SECDEF) | Push to ALL admins via `net.http_post` |
| `group_pt_bookings` | trg_notify_new_group_pt_booking | AFTER INS | `notify_new_group_pt_booking` (SECDEF) | Bell notification to all admins |
| `messages` | trg_notify_new_message | AFTER INS | `notify_new_message` (SECDEF) | Routes push: admin→member or member→admin; **hardcoded admin uuid `12b4633c-365e-42fa-939c-f1c744aa9de1`**; handles broadcast fan-out |
| `pt_booking_requests` | trg_notify_new_pt_booking_request | AFTER INS | `notify_new_pt_booking_request` (SECDEF) | Bell + notify admins |
| `pt_booking_requests` | trg_notify_pt_booking_confirmed | AFTER UPD | `notify_pt_booking_confirmed` (SECDEF) | On status→confirmed, notify member |
| `pt_sessions` | trg_pt_sessions_set_funding_source | BEFORE INS/UPD | `pt_sessions_set_funding_source` (INVOKER) | Derives funding_source from payment_id/status |
| `personal_training_logs` | trg_sync_pt_log_ins/upd/del | AFTER INS/UPD, BEFORE DEL | `sync_pt_log_to_weights_log` (SECDEF) | **Mirrors PT logs into `weights_log`** (insert/update/delete), writing weights_log_id back — the glue keeping the two duplicate log tables in sync |
| `member_subscriptions` | member_subscriptions_updated_at | BEFORE UPD | `update_updated_at` | touch updated_at |
| `profiles` | profiles_updated_at | BEFORE UPD | `update_updated_at` | touch updated_at |
| `trial_bookings` | trial_bookings_updated_at | BEFORE UPD | `update_trial_bookings_updated_at` | touch updated_at |

Note: several notify triggers and `reconcile_waitlist_offers` read `vault.decrypted_secrets` (`service_role_jwt`) and call outbound `net.http_post` — outbound HTTP is embedded in DB triggers (coupling DB writes to network calls).

---

## 5. Extensions & Cron

**Installed extensions (non-default):** `pg_cron 1.6.4` (pg_catalog), `pg_net 0.20.3` (**in `public` schema** — flagged by advisor), `pgcrypto 1.3`, `uuid-ossp 1.1`, `pg_stat_statements 1.11`, `supabase_vault 0.3.1`, `pgjwt`?(not installed), `plpgsql`. Vault is used to store `service_role_jwt` consumed by triggers/RPCs. The vast catalog of available-but-not-installed extensions (postgis, pgmq, vector, etc.) are default Supabase availability, `installed_version=null`.

**Cron jobs (`cron.job`):** 1 active job.
| jobid | name | schedule | command |
|---|---|---|---|
| 3 | `waitlist-offer-sweep` | `*/5 * * * *` (every 5 min) | `SELECT reconcile_waitlist_offers(s.class_id) FROM (SELECT DISTINCT wo.class_id FROM waitlist_offers wo JOIN classes c ON c.id=wo.class_id WHERE wo.status='offered' AND wo.expires_at<now() AND (c.date+c.start_time)>now() AND (SELECT count(*) FROM bookings b WHERE b.class_id=wo.class_id AND b.status='waitlisted')>=2 ORDER BY wo.class_id) s;` |

Only expires/reconciles offers where ≥2 people wait (deterministic lock order). No cron for prize-draw, trial-expiry, or recurring-class generation on staging (those referenced in code — `expire_stale_trials`, `generate-recurring-classes` — are presumably invoked via edge functions/external scheduler, not pg_cron here).

---

## 6. Migrations

`list_migrations` returns **only 6 rows**, all dated June 2026:
| version | name |
|---|---|
| 20260605140233 | cancel_then_rebook_reactivation |
| 20260605162442 | admin_cancel_class |
| 20260612152802 | 198_admin_cancel_booking_honest_refund |
| 20260613101342 | 199_admin_cancel_class_notifs_free_cancel_lock_fold |
| 20260622075432 | 205_group_pt_released_status |
| 20260622075443 | 206_expire_stale_trials_cancelled |

**Observations:** Naming shows a numbered sequence (`198`, `199`, `205`, `206`) but only 6 migrations are recorded in the tracking table while the numbers imply 200+ historical migrations. This means **the migration history is truncated/not fully tracked in `supabase_migrations`** — earlier schema was applied out-of-band (dashboard/direct SQL) or squashed. Migration discipline is inconsistent: partial numbering, gaps (199→205), and the bulk of the 75-table schema has no corresponding tracked migration. Recent activity clusters around booking/cancellation refund correctness and group-PT status handling.

---

## 7. Advisor Lints

### Security (143 total)
| Lint | Level | Count | Detail |
|---|---|---|---|
| `authenticated_security_definer_function_executable` | WARN | 129 | Each public SECDEF RPC executable by `authenticated` via `/rest/v1/rpc/*` |
| `anon_security_definer_function_executable` | WARN | 12 | The 12 functions listed in §2a |
| `extension_in_public` | WARN | 1 | `pg_net` installed in `public` schema — move it |
| `auth_leaked_password_protection` | WARN | 1 | HaveIBeenPwned compromised-password check is **disabled** in Auth |

### Performance (677 total)
| Lint | Level | Count | Detail |
|---|---|---|---|
| `multiple_permissive_policies` | WARN | 457 | Multiple permissive policies for same role+action across 58 tables — each must be evaluated for every query (e.g. member-scope + admin-scope both PERMISSIVE on same cmd). Should consolidate/restrict roles |
| `auth_rls_initplan` | WARN | 157 | Un-wrapped `auth.uid()`/`is_admin()` re-evaluated per row across 68 tables (see §3a) |
| `unused_index` | INFO | 42 | 42 indexes never scanned (low usage on staging, but candidates) |
| `unindexed_foreign_keys` | INFO | 20 | FKs without covering index (below) |
| `auth_db_connections_absolute` | INFO | 1 | Connection-count advisory |

**Unindexed FKs (20):** `classes.assigned_plan_id`, `coach_assistant_log.member_id`, `member_block_plans.created_by`, `member_exercise_overrides.exercise_set_id`, `member_session_comments.session_id`, `nutrition_active_calories.class_booking_id`, `personal_training_plans.created_by`, `plans.created_by`, `plans.source_template_id`, `plans.template_source_id`, `pt_booking_requests.member_id`, `session_access_log.class_id`, `session_notes.created_by`, `session_notes.session_id`, `sessions.linked_class_id`, `waitlist_offers.booking_id`, `waitlist_offers.member_id`, `workout_logs.class_id`, `workout_logs.session_id`, `workout_summaries.class_id`.

Remediation refs: https://supabase.com/docs/guides/database/database-linter (lints 0003 initplan, 0006 multiple_permissive, 0001 unindexed_fk, 0014 extension_in_public).

---

## 8. Backend Debt & Risk Observations (ranked)

1. **RLS performance not hardened — 157 policies re-evaluate `auth.uid()`/`is_admin()` per row (§3a, §7).** The single largest, schema-wide debt. Every member/admin query pays per-row function calls. Fix: wrap as `(SELECT auth.uid())` and consolidate the 457 multiple-permissive-policy cases. Evidence: `auth_rls_initplan` ×157, `multiple_permissive_policies` ×457.

2. **Anon-executable SECDEF hardening is incomplete (§2a).** Grants to `anon`/PUBLIC were **not revoked**. `admin_cancel_class` is safe (self-gates on `is_admin()`), but `reconcile_waitlist_offers`, `reorder_waitlist_positions`, `book_free_class`, `check_guest_phone`, `notify_guest_booking` remain anon-reachable with write/notification/probe side effects and no rate limiting. `check_guest_phone` enables membership-status enumeration by phone; `book_free_class`/`notify_guest_booking` are unauthenticated write/spam vectors.

3. **Two auth-schema-reaching RPCs granted to `authenticated` (§2b).** `fix_auth_user_null_tokens(text)` **UPDATEs `auth.users`** and `get_auth_user_by_email(text)` returns any user's uuid by email (enumeration). Neither should be in the authenticated grant set — maintenance/internal functions leaked to the app role.

4. **PII exposure via mis-named `USING true` policies (§3b).** `academy_waitlist` and `sport_interest` policies are labelled "Admins can read" but grant SELECT to **all authenticated users** with `USING true` — any logged-in member can read every lead's name/email/phone (and child_age). `admin_settings` is anon-readable; audit its jsonb contents for secrets.

5. **Massive domain duplication / legacy sprawl (§1 dead-tables).** 6 overlapping plan/template models (`plans`+`blocks`+`sessions`, `session_plans`, `personal_training_plans` stack, `pt_session_plans`, `member_block_plans`, `workout_templates`); 3 workout-log tables kept in sync by trigger glue (`sync_pt_log_to_weights_log`); 4 "session" concepts; 7 booking tables; 2 credit ledgers + a scalar mirror. High maintenance surface and correctness risk.

6. **DB triggers perform outbound HTTP + read Vault secrets (§4, §5).** Booking/message/free-class triggers call `net.http_post` to edge functions using `service_role_jwt` from `vault.decrypted_secrets`. Network calls inside triggers couple DB commit latency/failure to push delivery, and `pg_net` sits in `public` (advisor WARN). A hardcoded admin uuid (`12b4633c-…`) is embedded in `notify_new_message`.

7. **Migration history is truncated / undisciplined (§6).** Only 6 migrations tracked despite numbering implying 200+; gaps (199→205); most of the 75-table schema has no tracked migration. Reproducing staging from migrations alone is not possible — schema drift risk between environments.

8. **FK inconsistency: `member_block_plans` FKs to `auth.users` while ~all sibling tables FK to `profiles` (§1d).** Plus 20 unindexed FKs (§7) — mostly low-traffic but includes hot paths (`waitlist_offers.booking_id/member_id`, `workout_logs.class_id/session_id`).

9. **Auth setting: leaked-password protection disabled (§7 security).** Enable HaveIBeenPwned check.

10. **Admin authorization depends entirely on in-body `is_admin()` checks, not grant boundaries (§2b).** ~20 `admin_*` SECDEF RPCs are granted to plain `authenticated`; a single missing `is_admin()` guard in any one = privilege escalation. Only `admin_cancel_class` was source-verified as gated in this pass; the rest should be audited line-by-line.
