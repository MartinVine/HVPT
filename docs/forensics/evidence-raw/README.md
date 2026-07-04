# Forensic evidence — raw backend working notes

**These are raw evidence files, not the finished deliverables.** They are the read-only
backend inputs gathered during Phase 1 of the HVPT forensic pass (2026-07-04), preserved
here so the work survives if the ephemeral session container is reclaimed before the pass
resumes. The polished deliverables (01-current-architecture.md, 02-feature-inventory.md,
03-defect-and-refactor-register.md, lld-current/, migration/, 06/07) will be written from
these plus the client-app source once repo access is unblocked.

| File | What it holds | Source |
|---|---|---|
| 00-prd-verify-checklist.md | PRD v2.0 ⚠ VERIFY markers + §11 open questions, tracked | PRD read |
| 01-staging-schema-rls-rpc.md | 75-table schema, RLS policies, RPC grants, triggers, cron, advisors | staging `gkdhbeoxreyzjwjitykq`, read-only |
| 02-edge-functions-A.md | 13 edge functions (A–L) deployed-source audit + live/staging drift | live `mlllkjnvjowfjysfndhu`, deployed source |
| 03-edge-functions-B.md | 12 edge functions (M–Z incl. 2121-line stripe-webhook) | live, deployed source |
| 04-live-behavioural.md | 18 areas of live SQL behavioural evidence (population, billing, credits, bookings, waitlists, leaderboard, referrals, notifications, RPC surface, advisors) | live, read-only SELECT |

All gathered read-only. No production write, deploy, or Stripe/Netlify mutation was performed.
`URGENT.md` (one level up) cites these files by their `scratchpad/evidence/…` working paths;
they are the same files, now version-controlled here at `docs/forensics/evidence-raw/…`.
