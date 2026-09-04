---
name: gate-falsifiability-practice
description: Concrete lessons from running mutation rounds and concurrency races in this repo — what kinds of test mechanisms turn out flaky or hollow here, and how they were fixed
metadata:
  type: feedback
---

Every new gate in this repo gets a mutation round before it is trusted, and
three mechanism-level traps have now bitten in practice. Prefer the fixed forms.

**1. Never assert a timing artifact as if it were a safety property.**
`assert.equal(lockCallCount, N)` for N concurrent reservation attempts looks
like "every request went through the fail-open branch" but is really a race:
the pre-lock occupancy check at `reservations.ts:191` rejects late arrivals
before they reach the lock, so the count is legitimately < N. The exact
invariant (`counterDelta === lockCallDelta && lockCallDelta >= 1`) is both
harder to satisfy accidentally and stable.

**2. Never use a fixed sleep as an observation window.** A 2.5s window passed
when the file ran alone and failed inside the full 1542-test `npm test` run,
because under load the product had not reached its INSERT yet. Poll for the
*event* (with a deadline shorter than the product's own transaction timeout)
and fail loudly if the event never occurs.

**3. `pg_locks.database` is NULL for `transactionid` locks.** Waiting behind an
EXCLUDE constraint takes exactly that lock type, so
`WHERE NOT granted AND database = (current db oid)` silently matches nothing —
a detector that measured zero forever. Use `pg_stat_activity` with
`datname = current_database() AND wait_event_type = 'Lock'` instead.

**4. A DI hook used to bypass a real dependency for "determinism" can silently
hand one side of a race an unrealistic speed advantage.** Racing `createWalkin`
against `createReservation`(merge) with a custom `acquireSlotLock` that skipped
real Redis gave merge a zero-latency path it never has in production; the test
came back 0/8 and 0/15 "safe". Re-running with the *real*, unmodified
`withSlotLock` against real Redis (same `Promise.allSettled` pattern, no DI at
all) flipped it to 14/15 double-bookings — the DI-bypassed version was a
stopwatch artifact, not a safety proof. See [[walkin-merged-secondary-hole]].

**Why:** all four were found by injecting mutations or by racing real
dependencies, not by reading code; several produced a *green* test that
measured nothing, which is the repo's most expensive recurring defect class.

**How to apply:** when a new gate goes green, immediately ask which mutation it
is supposed to kill, inject it, and record the exit code. Also run the gate
inside the full suite at least once — single-file green is not the same as
suite green. In concurrency tests specifically: only use DI to control *when*
a call starts, never to strip real latency (Redis, network, extra queries) one
side would have in production — that latency is often exactly what determines
who wins the race. Related: [[slot-lock-failopen-verdict]].
