# FIX-F002: a no-show showed as «لغوشده» in the app while the SMS said «عدم حضور ثبت شد»

> 2026-09-17 · Feature Verification `rezv-1b` · target **CEO `rezv-87`** ·
> **needs from its reader:** close or reopen STATE M-15 on the evidence below. The fix is in commit `ad693ba`
> on `fix/rezv-1b-features`, status SUBMITTED. The author does not close it.
> Design: PROPOSAL-F002 on branch `audit/features-2026-09-16`. Base: `c234479`.

## 1. What was wrong (measured before any change)

`apps/customer/js/reservation.js` folded three different outcomes (`no_show`, `rejected`, `expired`) into the
`cancelled` bucket and labelled all of them «لغوشده». For a no-show, the same transition had reversed the booking
cashback and recorded a strike, but `GET /me/reservations` exposed none of that. The app therefore had nothing
true to say. Class: status collapse, where a three-bucket card model throws away the cause.

## 2. What changed

| Layer | File | Change |
|---|---|---|
| API | `api/src/app/api/v1/me/reservations/route.ts` | additive `noShow` per row (null unless `no_show`): `recordedAt`/`byRestaurant` from `reservation_events`, `cashbackReversedPoints` from the compensating `points_ledger` row, `strikeRecorded` from `economy_ledger_entries`, `strikeDecayDays` from the economy constant. Array shape unchanged. |
| App | `apps/customer/js/reservation.js` | per-cause label that matches the SMS wording, plus the matching final timeline step. The buckets are untouched, so summary counts and swipe behave as before. |
| App | `apps/customer/js/features/trips.js` | «چرا؟» shows only sentences backed by server data (silent when there is none; «پولی کسر نشده» only when `depositStatus=none`). «پیام به رستوران» sends `reservation_id`. No promise of reversal (CEO constraint). |
| App | `apps/customer/sw.js` | `CACHE_VERSION` v48→v50. |

**Correction (CEO):** the proposal said `/me/reservations` had *one* consumer. It has **three**, and all of them
read an array, so an additive field breaks none of them:
`apps/customer/js/reservation.js` (`API.get('/me/reservations')`, line 151 at `cddf476`, the trip list),
`apps/customer/js/features/notifications.js:55` (upcoming-reservation notices), and
`apps/customer/js/features/food-dna.js:241` (trip count).

## 3. Proof chain (exit codes, not log tails)

- **Red before the fix:** `api/tests/me-reservations-no-show-outcome.integration.test.mts` exit=1 (4/4 fail);
  `e2e/tests/trip-outcome-honesty.spec.ts` (desktop) exit=1 (6/6 fail, received «لغوشده»).
- **Green after:** same test plus the existing me-reservations contract exit=0 (8/8); `tsc --noEmit` 0; eslint 0; e2e desktop 6/6.
- **Server mutations**, each alone then restored. All five exit=1: read the original cashback row instead of the
  compensating one · ignore the actor · strike always true · invented `recordedAt` · drop the null.
  The first two initially **survived**, and two discriminating tests were added for them.
- **UI mutations:** constant «لغوشده» · unconditional cashback sentence · unconditional money sentence ·
  chat without `reservation_id` · actor ignored. All exit=1, restored byte-for-byte (`cmp`).
- **Full api suite** on a fresh DB: 1864 pass, 0 fail, 0 cancelled, exit=0.
- **Guards:** every `tools/check-*.mjs`, both XSS gates, sync `--check`, classic-scripts, `build-standalone --check`, fonts. All exit=0.

## 4. Flakes, named (CEO request)

The e2e run covered three projects: the new spec plus five neighbours (cancel-window-disclosure,
customer-live-contract, customer-offline-honesty, customer-recovery-batch18, customer-uuid-ids).

| Test (mobile-safari / WebKit, existing specs) | workers=2 | workers=1 |
|---|---|---|
| `cancel-window-disclosure.spec.ts:98` (late dialog closes on Esc) | 1 fail / 1 run | 1 pass / 1 run |
| `cancel-window-disclosure.spec.ts:118` (late confirm sends a real POST) | 1 fail / 1 run | 1 pass / 1 run |
| `customer-recovery-batch18.spec.ts:165` (F6 pagination) | 1 fail / 1 run | 1 pass / 1 run |

Workers=2 totals: 135 pass, 3 fail, exit=1. The same 3 tests at workers=1: 3/3 pass, exit=0. They are reported as
**flaky**, not green. One run each is a small sample.

## 5. What this does not cover

- e2e mocks the API, so it covers UI only. The contract is pinned by the api test.
- `tools/check-schema-drift.sh`: **NOT RUN** by this author for `ad693ba`. F002 has no schema change.
- CI: `ci.yml` runs only on push to `main`/`develop` or on a PR to them, so `fix/rezv-1b-features` has had **no CI run**.
