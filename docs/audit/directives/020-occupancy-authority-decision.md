# Directive 020 — Occupancy authority: do NOT unify it. Decision taken under delegated authority.

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent
**Authority:** the founder delegated this decision to me explicitly on 2026-09-05, with the
instruction to test from several angles before deciding. What follows is what I tested.

---

## 1. What is actually broken — established, not assumed

| Fact | Source |
|---|---|
| A waitlist offer marks the table `state='reserved'` and creates **no** reservation row | `waitlist.ts:360-362` |
| The hold lasts **5 minutes** | `waitlist.ts:32` — `OFFER_TTL_MINUTES = 5` |
| `getOccupiedTableNumbers` reads **only** `reservations` | `table-occupancy.ts`, confirmed by its consumers |
| `availability.ts` admits any table whose state is merely `!== 'maintenance'` | `availability.ts:71` |
| Accepting an offer goes through `createReservation` | `waitlist.ts:592` → `:651` |

**Consequence, stated precisely:** for up to 5 minutes, a table held for a queue guest is displayed
as available to everyone else. If another customer books it, the queue guest's `acceptOffer` then
fails inside `createReservation` — Serializable plus the `no_table_overlap` EXCLUDE catch it.

**So this is NOT a double-booking. It is a broken promise.** The queue tells a guest "this table is
yours for 5 minutes" and does not defend that claim against the booking path. That is materially less
severe than the walk-in defect and it is still a real product failure, because the queue's entire
value proposition is the hold.

**A third sibling.** `availability.ts:71` uses `state !== 'maintenance'` — the exact predicate that
`tryMergeTables` used at `:198/:219` until today's fix changed it to `state: 'free'` at `:681`.
`promoteNext` has always used `state: 'free'`. So three allocators, one concept, and today's fix
aligned one of the two that disagreed. **The class is still open and this is its next instance.**

## 2. What I checked and found NOT broken

Reported as negative results so they can be re-run rather than re-suspected.

- **`getOccupiedTableNumbers(...).catch(() => null)` at `reservations.ts:272` and `:298` is not a
  fail-open.** Both sit inside error handlers — a lock timeout and a serialization error. The re-read
  only enriches the error message; on `null` it falls through and throws the original error anyway
  (`:306`). No reservation is created. **Fails closed.** I suspected a swallowed guard and was wrong.
- **Stale `reserved` is well covered.** Four release paths write `state='free'`
  (`waitlist.ts:444, 698, 744, 826`) plus the 2-minute `expireOffers` sweep.

## 3. DECISION — do not unify the authority. Unifying is a category error.

The obvious fix is "make `getOccupiedTableNumbers` also read `tables.state`, one authority, done."
**I am rejecting that, and the reason is the whole decision:**

> `getOccupiedTableNumbers(restaurantId, start, blockEnd)` answers **"is this table taken during this
> time window?"** — it is inherently *windowed*. `tables.state` answers **"what is this table doing
> right now?"** — it is a *point-in-time* flag with no time dimension at all.

Merge them naively and a table held for the next 5 minutes becomes "occupied" for **every future
window** — hiding it from a booking three days out. That converts a 5-minute broken promise into
permanent, silent lost inventory. **The obvious fix is worse than the defect**, and it would have
passed review because "one source of truth" sounds like the right answer.

This is the same shape as everything else this round: two artifacts that look like they answer the
same question and do not.

**Therefore: keep two representations, name what each one answers, and fix the display.**

### Change 1 — fix the user-visible defect (do this now)

`availability.ts:71` must stop admitting held tables **for slots the hold actually covers**. The hold
is for an imminent seating — a waitlist guest is physically present — so it must suppress the table
only for slots within the hold horizon, never for future dates.

Do **not** simply add `state === 'free'` there. That is the naive fix and it would hide a table
currently `occupied` by a walk-in from a booking next Tuesday, which is the same category error one
level down.

### Change 2 — make the split explicit (do this in the same PR)

`table-occupancy.ts` must state in its own header that it answers "occupied by a **reservation** in
this window" and **explicitly does not know about `tables.state` holds** — with the reason. That is
the scoped-guarantee standard applied to a function whose silence has now produced two defects.

Add a separately named helper for "held right now" so a future consumer picks deliberately rather
than reaching for the only function that exists and inheriting its blind spot.

**Do not** rename or widen `getOccupiedTableNumbers`. Its contract is correct; what was missing was
anyone saying out loud what it does not cover.

## 4. Falsifiability — required, and the third case is the one that matters

1. A queue-held table is **not** offered as available for a slot inside the hold window — red before,
   green after, recorded exit codes.
2. `acceptOffer` still succeeds for the held guest inside the 5 minutes.
3. **A table held or occupied right now is still bookable for a future date.** This is the case that
   catches the category error, and without it a naive fix passes review looking correct.
4. Existing walk-in and merge concurrency tests stay green — this must not disturb the fix that
   landed today.

## 5. What I did not establish

Whether a restaurant would ever *want* a held table shown as available — for example, a policy of
"offer it to the queue but keep taking bookings, first accept wins." I found no such setting in the
schema and no evidence anyone asked for it, so I have decided against it. **If the founder tells me
restaurants want that, this decision changes** and the answer becomes a per-restaurant flag rather
than a fix. Stated so it can be reversed on evidence rather than rediscovered.
