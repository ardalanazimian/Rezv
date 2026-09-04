# M0 — Event Substrate Audit

**Date:** 2026-09-04 · **Branch:** audit/launch-hardening · **Auditor:** read-only, source + live DB + live single-file test execution. No `api/src` edits made, no commit, no full suite / build / migration run.

Target claim, verbatim, from `docs/audit/SESSION-HANDOFF.md:95-97`:

> M0 event substrate — `lib/events.ts` `emit()` is a WEBHOOK dispatcher, not a log; of its 7 declared domain events exactly one is called; `recordEvent()` (the real `platform_events` writer) is called only from `site-orders.ts`. Zero reservation-lifecycle events are logged.

---

## Handoff verdict, clause by clause

| Clause | Verdict | Evidence |
|---|---|---|
| `emit()` is a WEBHOOK dispatcher, not a log | **CONFIRMED** | `api/src/lib/events.ts:35-67` — queries `db.webhook.findMany()`, enqueues one delivery job per active hook. Zero DB writes to any event-log table. |
| of its 7 declared domain events exactly one is called | **REVISED** | `api/src/lib/events.ts:20-23` declares **8** members, not 7 (`reservation.created/cancelled/completed/no_show`, `waitlist.joined/seated`, `customer.vip_reached`, `coupon.redeemed`). Exactly one call site exists in the whole of `api/src`: `reservations.ts:420` (`reservation.created`). The "1 of N" ratio is right; N is 8. |
| `recordEvent()` is called only from `site-orders.ts` | **REVISED** | True for the literal `recordEvent()` (4 call sites, all in `site-orders.ts:206,485,597,641`, all about the marketing/subscription funnel, none about reservations). But `platform_events` has a **second** writer, `recordEventsDetailed()` (`platform-events.ts:134-146`), called from `api/src/app/api/v1/telemetry/route.ts:276` — the actual client-facing analytics path used by all three apps. The handoff's writer inventory omits this entirely. |
| Zero reservation-lifecycle events are logged | **REFUTED** | True only for `platform_events`. False for the load-bearing sense of "logged": every reservation status transition is durably logged, append-only, actor+reason+timestamp, in `reservation_events`, via the single writer `transitionReservation()` (`lifecycle.ts:79-136`). This table is not decorative — it is the real feature source the working no-show ML model reads (`no-show-model.ts:432-509`, `:776-806`), and it also feeds `fraud.ts:127-132` and `waitlist.ts:79-84`. |

**Why this matters:** SESSION-HANDOFF.md is explicitly the file every fresh session pastes and treats as ground truth ("this file IS the state, do not re-derive it"). As written, item 2 will cause every future session to believe there is no reservation-lifecycle log at all, and potentially to recommend building one — when a correct, point-in-time-safe one already exists and already powers the only working ML model in the codebase. A more accurate, already-written analysis of this exact area sits **uncommitted** at `docs/ml/P0-audit.md` (dated 2026-09-02) and independently reaches the same corrected conclusions (it even states the count as 8, not 7) — but it never propagated back into the file that matters for onboarding. This is precisely the failure mode the task brief warned about.

---

## The real inventory of event-emitting mechanisms

| Mechanism | What it actually does | Called from | Failure handling |
|---|---|---|---|
| `emit()` — `api/src/lib/events.ts:35` | Looks up active webhooks for a restaurant + event type, enqueues a delivery job (`kind:'webhook'`). No DB event row. | `reservations.ts:420` only (`reservation.created`) | try/catch, `log.warn`, never throws — fully swallowed |
| `deliverWebhook()` — `events.ts:122` | Actual HTTP POST to the subscriber's URL, HMAC-signed, SSRF-guarded (`assertSafeWebhookUrl` + `assertPublicHttpUrl`, `redirect:'manual'`). | `worker.ts:41`, as the job handler for `kind:'webhook'` | Throws on non-2xx / SSRF violation — by design, so the job queue's retry/DLQ handles it |
| `recordEvent()` — `platform-events.ts:104` | Single insert into `platform_events`. | `site-orders.ts:206,485,597,641` (site-order/trial funnel only, not reservations) | try/catch, `log.warn`, never throws — swallowed |
| `recordEventsDetailed()` — `platform-events.ts:134` | Batch insert (`createMany`, `skipDuplicates`) into `platform_events`; distinguishes "all duplicates" from "insert failed" in its return value. | `telemetry/route.ts:276` (client analytics ingestion) | Does **not** swallow: returns `{failed:true}` on a real DB error, and the route turns that into an honest `503` (not a fake `202`) — a genuinely good anti-pattern fix already in place. |
| `audit()` — `api/src/lib/audit.ts:89` | Structured log (always) + best-effort insert into `audit_logs`. Governance/security trail, explicitly documented as distinct from `ReservationEvent`. | ~20+ call sites across admin/auth/staff/photo/coupon flows (not reservation-lifecycle transitions — `reservation.cancel` is declared but never called, see M0-005) | DB write wrapped in try/catch + `log.warn`; the structured log survives even if the DB write fails |
| `transitionReservation()` — `api/src/lib/lifecycle.ts:79` | **The single writer of reservation status.** Validates the transition against a state machine, compare-and-sets the status, and inside the same transaction inserts one row into `reservation_events` (`tx.reservationEvent.create`, line 125). After commit: club points, SMS, economy-ledger event, ML outcome recording (for terminal states), table release — all fail-open/logged, never re-throwing. | 9 call sites: `reservations.ts:876` (arrival), `cancel/route.ts:74`, `restaurant/.../status/route.ts:41`, `tables.ts:247,250` (seating/QR), `lifecycle.ts:343,365,385` (cron: running_late/no_show/completed), `reservation-lifecycle-ops.ts:47` (hold expiry) | Everything after the transaction commit is fail-open with `.catch()` + `log.error/warn` — the status change itself is never rolled back by a downstream side-effect failure |
| `prunePlatformEvents()` — `platform-events.ts:201` | Batched, trust-level-scoped retention delete on `platform_events`. Genuinely wired to a daily cron, not orphaned. | `maintenance/retention/route.ts:47`, itself hit by Vercel Cron (`GET`) | try/catch at the call site; a pruning failure does not block the rest of the daily cleanup job |

**Verified working, positively:** `recordEventsDetailed()`'s honest 503-on-real-failure (vs. fake-202) is exactly the "absence of evidence ≠ zero" discipline the ML contract demands, already applied outside the ML code proper. Worth pointing to as a pattern to replicate wherever else a batch write silently returns `0`.

---

## Lifecycle coverage matrix

| Transition | Durable event? | Where | Table | Webhook (`emit`) | `platform_events`? |
|---|---|---|---|---|---|
| Creation (pending/confirmed, incl. holds) | **No** | `reservations.ts:502` (direct `tx.reservation.create`, bypasses `transitionReservation`) | only `reservations.createdAt` column | yes — `reservation.created` (unconditional, incl. holds), `reservations.ts:420` | no |
| Hold expiry → `expired` | Yes | `reservation-lifecycle-ops.ts:47` → `lifecycle.ts:125` | `reservation_events` | no (`expired` isn't even in `DomainEvent`) | no |
| Staff confirmation → `confirmed` | Yes | `restaurant/.../status/route.ts:41` → `lifecycle.ts:125` | `reservation_events` | no | no |
| Arrival / check-in → `checked_in` | Yes | `tables.ts:247`, `reservations.ts:876` (`markArrival`) → `lifecycle.ts:125` | `reservation_events` | no | no |
| Seating → `seated` (incl. QR check-in) | Yes | `tables.ts:250` → `lifecycle.ts:125` | `reservation_events` | no | no |
| No-show (cron) → `no_show` | Yes + ML outcome | `lifecycle.ts:365` (`autoMarkNoShow`) → `lifecycle.ts:125,224` | `reservation_events` + `model_outcomes` | declared, **0 calls** | no |
| Completion (cron) → `completed` | Yes + ML outcome | `lifecycle.ts:385` (`autoComplete`) → `lifecycle.ts:125,224` | `reservation_events` + `model_outcomes` | declared, **0 calls** | no |
| Cancellation (customer/staff) → `cancelled` | Yes | `cancel/route.ts:74` → `lifecycle.ts:125` | `reservation_events` | declared, **0 calls**; `audit()`'s `reservation.cancel` also declared, **0 calls** | no |
| Waitlist joined | **No** | `waitlist.ts:201` (mutable create, no history table) | `waitlist_entries` only | declared, **0 calls** | no |
| Waitlist offered/accepted/declined/expired/cancelled | **No** | `waitlist.ts:340,433,478,485,506,551,598` (in-place update/updateMany) | `waitlist_entries` (overwritten) | declared (`waitlist.seated`), **0 calls**; no type exists for offered/declined/expired | no |
| Coupon redemption | NOT VERIFIED | out of primary scope | unknown | declared (`coupon.redeemed`), **0 calls** | no |
| Customer VIP reached | NOT VERIFIED | out of primary scope | unknown | declared (`customer.vip_reached`), **0 calls** | no |

**Reservation-lifecycle transitions with zero durable event anywhere (not `reservation_events`, not `platform_events`, not a webhook that actually fires): 1 of 8** (creation itself — see M0-006, low severity because `reservations.createdAt` already covers it and nothing currently depends on a `reservation_events` row for creation).

**Waitlist-lifecycle transitions with zero durable event anywhere: 7 of 7** (every one of them) — this is the real, unmitigated hole; see M0-009.

**Coupon/VIP: unresolved**, flagged NOT VERIFIED rather than asserted either way.

---

## Live verification performed

Two integration tests were run in isolation (single-file, `npx tsx --test --test-force-exit`, per audit constitution — not the full suite) against a fresh, migrated, 72-table scratch database (`rezervno_test2` on the `rezv-test-pg` container), with `DATABASE_URL`/`REDIS_URL` overridden via environment variables (per SESSION-HANDOFF's note not to edit `api/.env`):

- `tests/temporal-leakage.integration.test.mts` — **3/3 pass, exit 0.** Verifies the no-show training query's point-in-time guard (`h.slot_start < r.created_at`) with a real "registered early, occurred late" adversarial fixture, plus a mandatory positive control (a genuinely-prior resolved reservation IS counted).
- `tests/feature-parity.integration.test.mts` — **4/4 pass, exit 0.** Verifies train/serve parity for the `reservation_events`-backed "prior history" feature, including a cross-tenant negative control (restaurant B's history must not leak into restaurant A's feature vector).

Both tests are wired into `api/tests/_all.runner.mts` (confirmed via grep — not orphaned files that `npm test` silently skips).

Live schema inspection (`psql` against `rezervno_verify`, a 72-table migrated reference DB) found **zero drift** between `schema.prisma` and the live table definitions for both `platform_events` and `reservation_events` — every column, index and constraint matches.

The local dev DB (`rezervno`, on `rezervno-postgres`) is effectively empty (1 reservation, 0 rows in either event table) — consistent with, and independently corroborating, `docs/ml/P0-audit.md`'s 2026-09-02 finding of an empty working database. This is **context, not proof** — the source-level and live-test verification above stand on their own regardless of what's in the (unrepresentative) local dev DB.

---

## Findings (ranked)

### M0-001 [major] — SESSION-HANDOFF.md materially understates the real event substrate
**NOT VERIFIED → VERIFIED, REFUTED as a standalone claim.** See handoff-verification table above. The fix is documentation, not code: SESSION-HANDOFF.md item 2 needs to be replaced with the corrected, two-system framing (webhooks are near-dead; `platform_events` is a well-built dead pipe; `reservation_events` is the real, working substrate) before the next fresh session reads it.

### M0-004 [major] — `platform_events` is architecturally sound but functionally a dead end
Schema is genuinely good: append-only, `occurredAt` vs `ingestedAt` separated, trust levels, per-trust-level retention, idempotency via a partial unique index on `event_id`. But: zero reservation-domain writes ever reach it; of 12 allowlisted type prefixes only 2 constant strings (`app.opened`, `page.viewed`) are ever sent by any client, anywhere (verified by grep across all three app trees + shared); and until 2026-08-26 it had **zero readers in the entire codebase** (per the admin/telemetry route's own header comment, independently confirmed by grep). Today it costs storage, retention-job CPU, and privacy surface for data nobody consumes. `file:line`: `api/src/app/api/v1/telemetry/route.ts:119-141`; `apps/customer/js/analytics.js:88`; `apps/customer/js/data/discover.js:16`; `apps/business/js/analytics.js:82`; `apps/business/js/routing.js:71`; `apps/company/js/analytics.js:82`; `apps/company/js/data.js:31`; `shared/js/analytics.panel.js:82`; `api/src/app/api/v1/admin/telemetry/route.ts:11-15`.

### M0-007 [major, explicitly not blocker] — Telemetry `restaurantId` is body-sourced, not auth-sourced
`api/src/app/api/v1/telemetry/route.ts:188-192,251-252` accepts `restaurantId` per-event from the client body and only checks the id refers to *some* real restaurant — not that the caller has any relationship to it. Any client (anonymous or authenticated) can currently tag any real restaurant's id. Not a blocker today because (a) no private data of another tenant is read or mutated — this is a write-only analytics tag, and (b) there is no downstream ML/feature consumer to poison (M0-004). It is nonetheless exactly the body-sourced-id pattern CLAUDE.md prohibits, and must be closed **before** `platform_events` gains any real consumer, or it becomes a live data-poisoning vector (fake `restaurant.*`/`reservation.*` telemetry attributed to a competitor).

### M0-009 [major] — Waitlist lifecycle has no durable event log at all
Every waitlist transition (`waitlist.ts:201,340,433,478,485,506,551,598`) mutates the single `WaitlistEntry` row in place. There is no `WaitlistEvent`/`waitlist_events` table (confirmed absent from `schema.prisma`). Once an entry cycles through offered→declined→re-offered, earlier states and timestamps are gone. This is the one lifecycle family named in the audit mandate (waitlist promotion) with a genuine, complete hole — worse than the reservation lifecycle's single creation-event gap (M0-006).

### M0-002 / M0-003 [minor] — Handoff's numbers and writer inventory are slightly off
8 declared domain events, not 7; two `platform_events` writer functions (`recordEvent` and `recordEventsDetailed`), not one. Both easy, mechanical corrections to the same handoff paragraph.

### M0-005 [minor] — A second, independent "declared but dead" event vocabulary
`audit.ts`'s `AuditAction` has its own zero-call-site member (`reservation.cancel`), and its `coupon.redeem` doesn't even match `events.ts`'s spelling (`coupon.redeemed`). Two unrelated event-naming systems, both partially dead, not mutually consistent.

### M0-006 [minor] — Reservation *creation* itself is never in `reservation_events`
Only status *changes* are logged (`transitionReservation` requires an existing row and `from != to`). Currently harmless (see fallback analysis in the JSON), but means the append-only log alone cannot answer "when/by whom was this reservation created."

### M0-008 [P3/minor] — Stale migration numbers in comments
`schema.prisma:1638,1640` and `platform-events.ts:165` say "migration 046"/"migration 047"; the real migrations are `059b-telemetry-trust-boundary.sql` and `060-platform-events-retention.sql`. No functional impact, pure trace-ability defect.

---

## Decision package - what to do about the event substrate

### (a) Verbatim source of the conflict
docs/audit/SESSION-HANDOFF.md:95-97 (quoted at the top of this document) versus the actual source (api/src/lib/lifecycle.ts:79-136, api/src/lib/no-show-model.ts:432-509) and the actual, more accurate, uncommitted docs/ml/P0-audit.md (2026-09-02), which already reached the corrected conclusion but was never folded back into the handoff.

### (b) What depends on this today, with file:line
- The one working ML model (no-show) depends on reservation_events for its strongest feature (no-show-model.ts:432-509,776-806), verified live (temporal-leakage, feature-parity tests, both exit 0).
- fraud.ts:127-132 and waitlist.ts:79-84 also read reservation_events as their source of truth for the reservation lifecycle.
- Nothing in api/src currently depends on platform_events for anything beyond the admin health-check aggregate (admin/telemetry/route.ts) - so nothing breaks if its write path is fixed or paused.
- Nothing depends on a waitlist history table, because none exists (M0-009) - building one is additive, not a migration of existing readers.

### (c) The precise problem
Three independent problems, each needing a different owner and different urgency:
1. A documentation-accuracy problem (M0-001, M0-002, M0-003, M0-008): the onboarding file that every fresh session trusts verbatim contains a materially misleading summary sentence and two off-by-a-detail facts. Zero code risk, but it actively misdirects future audit and dev sessions today.
2. A product/architecture problem (M0-004): a fully-built, well-designed event bus (platform_events) has no producers worth the name and no consumers. Continuing to run it as-is is paying cost (storage, retention CPU, privacy surface) for nothing. Either feed it or shrink it.
3. A data-integrity/tenant-safety problem (M0-007) and a coverage gap (M0-009), both real defects in the write path itself, independent of the documentation question.

### (d) Options, with real cost and blast radius

For (1), the documentation problem:
- Option 1 - Replace SESSION-HANDOFF.md item 2 with the corrected 4-line summary from this report's handoff-verification table. Cost: 10 minutes, zero code risk, zero architect sign-off needed (it's a doc, not api/src, schema or auth or reservation logic). Recommended.
- Option 2 - Commit docs/ml/P0-audit.md as-is and point SESSION-HANDOFF item 2 at it instead of restating it inline. Cost: 15 minutes; keeps the long analysis out of the terse handoff file (consistent with the handoff's own stated role as index, not source of truth); the file is already written and already independently correct. Also recommended, do both.
- Reversibility: trivial either way (docs only).

For (2), the platform_events dead-pipe problem:
- Option 1 - Do nothing yet, revisit when a real ML feature needs behavioral, non-reservation data. Cost: zero now; ongoing small cost (storage/retention job) continues to be paid for near-zero signal. Risk: the gap silently persists and nobody notices because the admin health-check dashboard shows it's alive (2 events per session) without showing it's useless for ML (0 domain coverage).
- Option 2 - Wire the 7 dead emit() domain events (reservation.cancelled/completed/no_show, waitlist.joined/seated, customer.vip_reached, coupon.redeemed) to also write to platform_events via recordEvent with source=backend and trustLevel=SERVER_VERIFIED, from the same call sites transitionReservation() already has fail-open side-effect blocks for. Cost: small, additive, no schema change since the table already exists; each call site needs a catch matching the existing pattern (the economy/loyalty/prediction-ledger writes right above it in lifecycle.ts:142-234 are the template). Blast radius: low, these are new writes, not changes to existing behavior, and they're fail-open by construction. Needs architect sign-off because it touches lifecycle.ts, the reservation lifecycle's single writer.
- Option 3 - Formally deprecate or shrink platform_events (stop client ingestion, keep only the recordEvent backend calls that already exist) if the product decision is that behavioral analytics is not a near-term priority. Cost: removes the telemetry route and its allowlist machinery; frees the M0-007 tenant-safety gap by removing its only current exposure surface. Risk: throws away the currently unused but correctly built infrastructure for exactly the day it's needed. Not recommended - the infrastructure is already paid for and correctly built; better to either use it (Option 2) or leave it dormant (Option 1) than to tear it down.
- Recommendation: Option 1 now (no rush, no consumer waiting), Option 2 as the concrete next M-phase once there is an actual behavioral-ML use case (search relevance, funnel analysis, etc.) that needs data reservation_events cannot provide.

For (3a), M0-007 tenant-safety gap:
- Option 1 - Restrict client-settable restaurantId on telemetry events to restaurants the caller has an actual relationship with (for authenticated customers: restaurants they have reserved at or viewed via a server-issued token; for anonymous callers: drop restaurant attribution entirely, keep only source and sessionId). Cost: small, contained to telemetry/route.ts. Needs architect sign-off (it's a tenant-boundary rule change, per CLAUDE.md's own bar for auth-adjacent changes) even though it currently gates zero real functionality.
- Option 2 - Leave as-is until platform_events gains a real consumer (Option 2 above), then fix as part of that same PR, since the two changes are naturally reviewed together and the risk is currently theoretical (M0-004 confirms zero consumer exists).
- Recommendation: Option 2 - fix the gap in the same change that gives platform_events its first real ML/analytics consumer, not before. Flagging it now so it is not forgotten (this document is the record).

For (3b), M0-009 waitlist history gap:
- Option 1 - Add a WaitlistEvent table mirroring reservation_events (entryId, fromStatus, toStatus, actor, reason, createdAt), written from the same 7 call sites in waitlist.ts that currently do bare update/updateMany. Cost: one migration (additive, new table, api/prisma/sql/NNN-waitlist-events.sql plus a matching schema.prisma model, per CLAUDE.md's schema-drift rule) plus 7 small call-site additions, each fail-open like transitionReservation's pattern. Blast radius: low (new table, no existing reads change). Needs architect sign-off (schema change).
- Option 2 - Do nothing until a waitlist-specific ML/analytics need exists (e.g. predicting offer-decline probability). Cost: zero now; the gap simply continues, and any future waitlist model starts with the exact same undercounting problem the no-show model had before reservation_events existed.
- Recommendation: Option 1, but not urgently - this is real technical debt for the data foundation, lower priority than M0-007 (a live tenant-safety pattern) and M0-001 (which actively misleads every future session today).

### (e) Reversibility
All documentation fixes (M0-001/002/003/008): fully reversible, zero risk. platform_events Option 2 (wiring the dead emit() events plus a matching recordEvent): additive, reversible by simply removing the new call sites. M0-007 fix: reversible (revert the route change), but should not ship without architect sign-off since it changes what a request body is trusted for. M0-009's WaitlistEvent table: additive migration, reversible by dropping the unused-by-existing-code table; no existing behavior depends on it, so there is no rollback risk to existing functionality.

---

## What my mandate did not ask for, but matters

1. docs/ml/P0-audit.md exists, is uncommitted, and is already more accurate than the committed handoff on this exact topic. It independently reaches the corrected 8-vs-7 count and the two-system framing this audit reaches, dated two days before this audit. The fact that a correct analysis sat uncommitted while a shorter, subtly-wrong summary made it into the file every fresh session trusts is itself a process finding, not just a documentation nit - it is a live instance of the exact risk SESSION-HANDOFF.md's own header warns about (a corrected fact never propagating, exactly how the wrong repo address came back after it had already been corrected in round 15). Recommend committing it, or folding it into SESSION-HANDOFF, as part of closing M0-001.

2. platform_events had zero readers anywhere in the codebase until 2026-08-26 (per admin/telemetry/route.ts's own header comment, independently confirmed by grep for every Prisma read method against platformEvent). For an unknown but non-trivial period, the application was writing, retaining, and paying the privacy/governance cost of behavioral event data that literally no code path could ever query. This is a cost/governance finding beyond is the data covered - it's was the data ever usable by anyone, even to check it existed - and it is now fixed only to the extent of one aggregate-count admin endpoint.

3. There is a second, cross-tenant no-show model (fetchPlatformTrainingRows, api/src/lib/no-show-model.ts:761-810) that trains on reservation history across the whole platform as a fallback for restaurants without enough of their own data (serving order: per-restaurant model, then platform-wide model, then heuristic). Its point-in-time guards correctly mirror the per-restaurant query, so it is not a leakage bug - but it is a documented exception to docs/ML_CONTRACT.md's Principle 1 (per-tenant training, not global) that the contract document itself does not mention as an exception. Worth a one-line addition to ML_CONTRACT.md so a future reader does not flag it as a contract violation.

---

## Files created by this audit

- audit/round-20/M0-EVENT-SUBSTRATE.json
- audit/round-20/M0-EVENT-SUBSTRATE.md (this file)

No files under api/src were read-modified-written; no commits were made; no full test suite, build, or migration was run. The two live test executions used a disposable scratch database (rezervno_test2) and left rezervno_verify untouched (read-only schema inspection only).
