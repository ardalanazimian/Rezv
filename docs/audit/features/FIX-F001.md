# FIX-F001: no auto no-show without an accepted warning; «دیرتر می‌رسم» for the guest; a deadline gate for staff

> 2026-09-17 · Feature Verification `rezv-1b` · target **CEO `rezv-87`** ·
> **needs from its reader:** (1) close or reopen STATE M-13 and M-17 on the evidence below; (2) a ruling on residual
> **R1** (§6); (3) Red Team attack before merge, which you ordered and which has **not** happened yet. The fix is one
> commit on `fix/rezv-1b-features` after F003 `cddf476`, status SUBMITTED. Rulings implemented: D-18 and D-20.
> Design: PROPOSAL-F001 on branch `audit/features-2026-09-16`. Migration number: 092 (after main's 090 and F003's 091).

## 1. What was wrong (measured 2026-09-16 on `c234479`)

- A guest 17 minutes late became `running_late` **and** `no_show` in **one** cron tick, with zero SMS before it,
  cashback reversed and a strike recorded. `running_late` was not in `NOTIFY`, and `autoMarkNoShow` saw only `slotStart < now − grace`.
- The guest had no way to tell the restaurant they were on the way: no route, no button, no restaurant phone.
- `PATCH /restaurant/reservations/:code/status` had no time check. Staff could mark no-show **before** the slot, and
  the panel offered «نیومد» on every upcoming row.
- `lateGraceMinutes` had no writer in the panel and no range in the DB (120 was stored silently).

## 2. What changed

| Ruling | Where | What |
|---|---|---|
| single definition | `api/src/lib/late-arrival.ts` | `guestDeadline` (staff and guest), `autoNoShowDueAt` (cron), `grantedExtension`, named `LATE_WARNING_MIN_WINDOW_MINUTES = 10` with its own unit test |
| D-18 | `api/prisma/sql/092-late-arrival-warning-and-extension.sql`, `api/prisma/schema.prisma` | `late_warned_at`, `late_eta_signaled_at`, `late_extension_minutes`, `max_late_extension_minutes`; CHECK 10..60 / 0..30 / 0..30 |
| D-20a | `api/src/lib/sms.ts` (`sendSmsCharged` → `markLateWarningAccepted`), `api/src/lib/lifecycle.ts` | `booking_late` SMS on `running_late`; `late_warned_at` is set **only after provider acceptance** or on /eta. `autoMarkNoShow` needs it; blocked rows are counted: `rezervno_no_show_blocked_unwarned_total` + alert `NoShowBlockedUnwarned` (`observability/alerts.yml`) |
| D-20b | `api/src/lib/lifecycle.ts` | the warning is charged to the restaurant, like `booking_noshow` |
| D-20c | `api/src/app/api/v1/restaurant/reservations/[code]/status/route.ts`, `apps/business/js/data.js`, `apps/business/js/reservations.js` | staff no-show only at `now ≥ guestDeadline`, else 409 `NO_SHOW_BEFORE_DEADLINE` with `no_show_allowed_at`; the panel button and status menu are disabled and show the time |
| D-20 §4 | `api/src/app/api/v1/reservations/[code]/eta/route.ts` | `kind === 'customer'` exactly; owner only; rate-limited; once (atomic UPDATE); before the deadline; `audit(reservation.late_signal)`, not `reservation_events` |
| D-18 | `api/src/app/api/v1/restaurant/cancellation-policy/route.ts`, `apps/business/js/crm.js` | panel fields for grace (10..60) and extension cap (0..30, 0 allowed) with the «اعمال می‌شود» badge |
| guest UI | `apps/customer/js/reservation.js`, `apps/customer/js/features/trips.js`, `apps/customer/js/data/booking.js` | «دیرکرده · تا HH:MM»; «دیرتر می‌رسم» from 30 min before the slot until the deadline, with choices capped by the restaurant; the grace line on the confirm sheet only when the server declares it; sw v52 |
| payloads | `/me/reservations`, `/restaurant/reservations`, `/restaurants/:slug`, bell feed (`api/src/lib/notifications.ts`) | `late{…}`, `no_show_allowed_at`, `late_eta_*`, `booking_policy.late_grace_minutes`, «مهمان دیرتر می‌رسد» |

**Owner consequence (D-20a, must be seen):** `MELIPAYAMAK_BODYID_LATE` needs a pattern registered with Melipayamak,
which only the owner can do. Until it is registered, no warning is sent, so **auto no-show is effectively off**.
Restaurants mark no-shows by hand after the deadline, and `NoShowBlockedUnwarned` shows the state.

## 3. Changed assertions in an existing test (`api/tests/lifecycle-cron.integration.test.mts`)

Each is listed in the commit message with its reason:
1. two-stage: 0 before the warning (was 1), then 1 once `lateWarnedAt` is set 11 min ago. **D-20 contract.**
2–3, 5. grace and isolation tests get `warnedMinutesAgo: 30`, so they measure only what they claim. **D-20 contract.**
4. custom grace 120 → 60 (delay 60 → 45, warned 40). 120 is now rejected. **D-18**; the claim is unchanged.
6. new test: the DB CHECK rejects 9, 61 and 120, and leaves the previous value untouched.

## 4. Proof chain

- **Red before the fix** (pre-F001 code on `cddf476`, before `late-arrival.ts` existed): staff gate 2 fail with its
  positive control (20 min after the slot → 200 and no_show) passing; cron M-13 2/2 fail (the one-tick collapse; the
  unsent warning). The positive control first failed too, because the fixture code was not a valid `zReservationCode`
  (422); `genReservationCode()` fixed it, which the control exists to catch. e2e on the pre-UI tree: `late-arrival.spec.ts`
  6 fail (the 2 that pass assert silence when the server sends no data), `business-no-show-gate.spec.ts` 4/4 fail.
  The /eta tests have no meaningful red (the route did not exist); they are proven by SM3–SM6.
- **Server mutations** (`late-arrival-*`, `lifecycle-cron`, `no-show-writers-guard`; unmutated 48/48, restored 48/48):

| Mutation | Result |
|---|---|
| SM1 cron penalizes an unwarned row | exit=1, 6 fail |
| SM2 staff deadline gate removed | exit=1, 3 fail |
| SM3 /eta kind check removed (staff token with `sub` = the guest's userId, the V5 lesson) | exit=1, 1 fail |
| SM4 /eta "once" pre-check removed | **survives, correctly**: the atomic `WHERE late_eta_signaled_at IS NULL` still enforces it. SM4b (both layers removed) exit=1, 2 fail; SM4c (SQL guard only removed) exit=1, the concurrency test fails. Each layer is proven. |
| SM5 /eta deadline check removed | exit=1 |
| SM6 restaurant cap ignored | exit=1, 2 fail |
| SM7 `late_warned_at` set before provider acceptance | exit=1, 2 fail |

- **UI mutations** (desktop): UL1 button never opens (4 fail) · UL2 choices ignore the cap (2) · UL3 running-late label
  reverted (1) · UL4 confirm-sheet grace line dropped (1) · UB1 panel gate off (2 targeted + 1 flake, below) · UB2 policy PUT omits the late fields (1). All exit=1.
- **Migration 092 on hostile data** (re-measured 2026-09-17, log kept): with the three CHECKs dropped, restaurants
  planted at grace 5/120/90/30 and cap 45/15/-3/31, plus a reservation at extension 45. One run of 092 in a single
  transaction gives exit=0 → 10/60/60/30 and 30/15/0/30, and the reservation → 30. **Exactly 6** `migration.092.clamp_*`
  audit rows are written (one per changed column, none for unchanged ones); all 3 constraints end `convalidated = t`;
  a second run gives exit=0 and still 6 audit rows; new writes of 120 and 31 are rejected. The first version of this migration used
  two separate UPDATEs and rolled back entirely on a row with both columns bad (a NOT VALID CHECK still checks
  the new version of an updated row). That was caught on hostile data, not on a fresh DB, and fixed with one combined UPDATE.
- **Alert:** `promtool check rules` and `promtool test rules` exit=0 (fire and silence scenarios at the real 5-minute
  cron cadence). Mutations `for: 5m` and a wrong metric name are caught.
- **Full api suite**, fresh DB (CI path: db push + apply-sql + fixups; the 3 late constraints validated): **1925 pass,
  0 fail, exit=0** (251 s, machine otherwise idle).
- **Guards:** 22 CI guards exit=0 on the working tree, and the artifact guards exit=0 again on a **clean LF checkout**
  of the exact tree (standalone, sync, both XSS gates, doc refs, runner completeness, control bytes, classic scripts,
  app-js syntax, alert-metric binding, status-label binding). 342 imports in changed files resolve case-exactly
  against `git ls-tree` (positive control: a wrong-case path does not resolve). `tsc --noEmit` 0, eslint 0.
- **XSS audit:** the cancellation-policy template gained two rows, so its sink hash changed (`crm.js#40c0adb2faf6` →
  `#5afc1eb68257`). I re-read the sink: the new rows interpolate only the constant `okBadge` and `esc()` of the server
  numbers. The override was re-keyed with that note. Review count stays at 18, unsafe at 41.

## 5. e2e

- **New specs** on desktop (my tree served on 1848x, identity by sha256 of the served files): `late-arrival.spec.ts`
  8/8, `business-no-show-gate.spec.ts` 4/4 (one login-step failure in 1 of 4 earlier runs; see the flake below).
- **Full suite, all 46 specs × three projects**, CI=1 on 8080–8082 (Playwright's own servers from this tree), workers=2,
  retries=0, machine otherwise idle: **654 passed, 4 failed, 2 skipped, exit=1 (25.0 min)**. None of the 4 is attributed to F001:

| Failure | Evidence it is not F001 |
|---|---|
| desktop-chrome `business-dashboard-waitlist-honesty.spec.ts:140`: login overlay never hid | **reproduces on base `cddf476` (no F001)** with the identical error: 1 fail in 32 (`--repeat-each=8`); my tree 32/32. The login path (`staffPasswordLogin` → `enterPanel`) contains no F001 code. Same symptom as the earlier login-step failure in `business-no-show-gate`. |
| mobile-safari `cancel-window-disclosure.spec.ts:84`: the tap opened «جزئیات رزرو» instead of the late-cancel dialog | isolated, `--repeat-each=4`: the whole spec 32/32 on my tree and 32/32 on base; `:84` itself 4/4 on both. The row in that test has no `late` block, so F001 renders nothing new on it. This spec's WebKit flakiness is already recorded under FIX-F002 (:98, :118). |
| mobile-safari `card-slots.spec.ts:37`, `:48`: discover feed tile "not visible" | isolated, `--repeat-each=4`: the spec 16/16 on both trees (`:37` and `:48` 8/8); both passed in an earlier full run on the same tree. The discover feed isn't touched by F001. |

These are recorded as **flaky, not green**. Four repeats cannot rule out a small rate difference.

## 6. Residuals: not fixed, stated

- **R1 — catch-up tick, past clock.** `running_late` is set on the first tick after `slotStart`. If the cron was down
  for at least the grace period, the transition happens after `guestDeadline`: the SMS clock (= the earliest moment
  any path may mark no-show) is already in the past, and /eta is closed ("before the deadline"). Cron still waits the
  10-minute floor after acceptance, but staff may mark immediately (D-20c). This matches the rulings; the guest just
  gets a past time and no way to reply. Options: (a) accept, since it only occurs during a cron outage; (b) when
  `guestDeadline ≤ now` at the transition, skip the SMS, so there is no auto no-show for that row and staff mark by hand;
  (c) token = `max(guestDeadline, now + floor)` **and** move the staff gate to `max(guestDeadline, warnedAt + floor)`,
  which changes D-20c. **Needs a ruling; not changed.**
- **R2 — the blocked metric also counts a warning still in the queue.** In the one-tick case the row is past the deadline
  with `late_warned_at` NULL for the seconds until the worker sends. The alert (`increase[15m] > 0 for 20m`) never
  fires on one tick (silence scenario); a restaurant whose warnings are never accepted increments every tick and does fire.

## 7. Found while proving this, outside F001 (reported, not fixed)

`api/tests/waitlist-promotion-observability.test.mts` «expire: …» failed **once**: 19 attempts vs 1 failure. Mechanism,
measured in the DB: `expireOffers()` is global, while the injection targets only its own restaurant. Earlier waitlist
tests leave offers with a 5-minute TTL (`OFFER_TTL_MINUTES = 5`, created 04:12:27, expiring 04:17:27). Under a
concurrent e2e load the suite took 891 s instead of 487 s, and the test ran at 04:18:55, after those 18 foreign offers
had expired. The same tree on a fresh DB with no load: 1925/1925. Suite speed decides the outcome, so CI can flake the same way. Another session had already seen the same line (:337) fail on main `8b63e61` while two suites ran in parallel (833 s vs 369 s solo), without recording a mechanism. This is distinct from m-21 (the phone-fixture collision).
Suggested fix, test-only: expire or neutralize other restaurants' offers before calling `expireOffers()`, or assert
per-restaurant counts.

## 8. What this does not cover

- **Red Team:** not yet attacked (the CEO ordered it before merge).
- **`tools/check-schema-drift.sh`: RAN**, exit=0 (832 columns, 77 FKs, 211 indexes, 17 CHECKs), through a `psql` shim
  that forwards to the pg17 client inside my Postgres container (this host has no `psql`). Positive control: with the
  `late_warned_at` ADD COLUMN removed from 092 → exit=1, naming exactly `reservations.late_warned_at`; restored (`cmp` identical).
- **CI:** `fix/rezv-1b-features` has had no CI run (ci.yml runs only on push to `main`/`develop` or on a PR to them).
- **Real SMS:** the provider is stubbed (`fetch`), per CLAUDE.md rule 6. Acceptance semantics come from `sendSmsNow`'s
  contract, not from a live Melipayamak call; the `booking_late` pattern text is owner-registered and not in the repo.
- e2e mocks the API → UI only. The real 409 and the D-18 ranges are pinned in the api tests.
