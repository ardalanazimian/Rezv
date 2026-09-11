# ORDER-BE-001 — Cashback and the referral reward are paid at check-in, not at booking

**Date:** 2026-09-11 · **From:** founder proxy `rezv-bc [6175ca]` (see the Founder proxy row in `docs/audit/prompts/ROUTING.md`)
**To:** Backend Engineer. No session holds the role tonight; this file is for whoever takes it next.
**Authority:** founder decision, 2026-09-11T19:25:24Z, transcript `49c66907-a4b0-4b1b-bbf6-a4b61c97dd81.jsonl`, selected option «کش‌بک هنگامِ حضور». Recorded in `audit/ESCALATIONS.md` §E-002. The referral half is the founder's 2026-09-10 option «الف», same section.
**Change class:** reservation lifecycle and points ledger. **PR only** (CLAUDE.md: «تغییرِ auth/رزرو/اسکیما فقط با PR»).

---

## 1. What is true on `main` today

Measured at `923a20a` with `git grep` / `git show`, not assumed.

| Fact | Evidence |
|---|---|
| Cashback is written when the reservation is **created**, inside the booking transaction | `api/src/lib/reservations.ts:647-660`: `tx.pointsLedger.create` with `reason: 'cashback'` and idempotency key `cashback:{reservationId}` |
| It is taken back when the reservation reaches any of seven statuses, two of them the restaurant's action | `api/src/lib/reservation-status.ts:120-128`: `no_show`, `rejected`, `expired`, `cancelled`, `auto_cancelled`, `cancelled_by_user`, `cancelled_by_restaurant`. Call site `api/src/lib/lifecycle.ts:231` |
| Check-in already has a guarded, idempotent grant block | `api/src/lib/lifecycle.ts:192`: `if (to === 'checked_in' && result.resv.userId)`, which calls `addClubPoints` with key `arrival:{reservationId}`, under the compare-and-set `result.changed` |
| The referral payer exists and has **zero callers** | `api/src/lib/loyalty.ts:610` `completeReferral`. `git grep completeReferral origin/main -- api/src` returns only the definition |
| A self-retiring guard hides the referral promise while that is true | `api/tests/referral-promise-honesty.test.mts` goes red the moment `completeReferral` gains a caller, and names what to restore |

## 2. The decision, as behaviour

- A reservation that never reaches `checked_in` earns **no cashback**. A fake, rejected, expired or no-show booking has nothing to reverse, by structure rather than by detection.
- Cashback is granted **once**, on the transition to `checked_in`, in the same block and with the same two layers as arrival points: the compare-and-set (`result.changed`) and a database idempotency key. Keep the key `cashback:{reservationId}` so ledger history stays comparable.
- The referral reward is triggered in the same block: the invitee's first check-in calls `completeReferral`.
- Reversal **after** check-in (for example `checked_in → cancelled`) stays as it is. The founder was not asked to change it, and `reservation-status.ts` records it as an open owner choice. This order does not touch it.

## 3. Establish before building, and report back

1. **The cashback basis at check-in.** Today it is `final`, computed in the booking checkout (`reservations.ts:635-647`). Find out whether that post-discount amount is **persisted** on the reservation. If it is, read it at check-in. If it is not, persisting it is a schema change: an idempotent SQL migration **and** `schema.prisma`, per CLAUDE.md. State that in the PR before writing the code.
2. **Existing booking-time cashback rows.** The only database found so far was CI-shaped test data (`audit/ESCALATIONS.md` §E-002, the 09-10 block). If you find a production database holding `cashback:` rows for reservations that never checked in, **stop and report**. Reversing, keeping or migrating them spends money, so it is the founder's call.
3. **Tests that pin booking-time cashback.** `git grep` finds cashback idempotency references in `api/tests/points-ledger-idempotency-key.integration.test.mts` and `api/tests/points-redemption.integration.test.mts`. Read them. A test that encodes the old behaviour is changed in the same PR with the reason written down. It is never deleted to get green.

## 4. The two halves land together, or neither does

When `completeReferral` gains a caller, `referral-promise-honesty.test.mts` goes red. It then requires three things: restore the promise copy in `apps/customer/js/features/rewards.js` and `loyalty.js`, restore the binding in `tools/check-loyalty-constant-binding.mjs`, and delete the guard.

That copy is not the Backend Engineer's to change:
- `apps/customer` belongs to the Launch Engineer.
- `standalone/*.html` is generated.
- `CACHE_VERSION` in `apps/customer/sw.js` must be bumped.

**The backend wiring and the restored copy reach `main` in the same merge.** There are two wrong states to avoid. A reward that is paid while the copy stays hidden is one. Copy that is restored before any payer exists is the other.

## 5. Acceptance: each claim, with the mutation that must turn it red

| Claim | Mutation that must go red |
|---|---|
| A reservation created and then `rejected`, `no_show` or `expired` leaves **no** `cashback` row and an unchanged balance | Put the booking-time `pointsLedger.create` back |
| `checked_in` writes exactly one `cashback` row, even under two concurrent check-ins | Remove the idempotency key; separately, bypass `result.changed` |
| `checked_in → cancelled` still reverses | Drop `cancelled` from `CASHBACK_REVERSING_STATUSES` |
| The invitee's first check-in completes the referral once, and a second check-in pays nothing | Call `completeReferral` on every check-in, ignoring its pending match |

For every row, record the exit code at baseline, with the mutation injected, and after restoring, with an md5 of the file at all three steps. Report the full suite count before and after. Import every new test file in `api/tests/_all.runner.mts`.

## 6. Out of scope

- Rates and reward values (E-002 open questions 2 and 3). Parked by the founder.
- The §1 claim in `docs/marketing/POSITIONING.md`. The Marketer owns it, and it stays INTERNAL ONLY until this order is on `main`.
- Disclosure of the no-show strike (the Marketer's R1). Red Team `rezv-6f` is verifying it.

Deliver as **submitted**, on a session branch with a PR. The founder proxy merges it on green.
