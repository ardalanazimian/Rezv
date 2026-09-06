---
name: gate-falsifiability-practice
description: Concrete lessons from running mutation rounds and concurrency races in this repo — what kinds of test mechanisms turn out flaky or hollow here, and how they were fixed
metadata:
  type: feedback
---

Every new gate in this repo gets a mutation round before it is trusted, and
seven mechanism-level traps have now bitten in practice. Prefer the fixed forms.

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

**5. Diagnose a stalled run from its raw output, never from a plausible story.**
A probe stopped producing output and the obvious explanation — a cross-transaction
gate that never resolves when one side aborts — was written into an audit report
and a source comment as if established. The real cause, visible only when the
process finally reported, was `No space left on device` on the log pipe; it never
printed its own exit marker. Stalls from a full disk, a blocked stdout pipe,
pool starvation and a real deadlock all look identical from outside. Wait for the
exit code, or say UNKNOWN.

**6. Check `df -h /c` before believing a flaky result on this machine.** It has
reached 0 bytes free, at which point the agent harness cannot write its own task
output (`ENOSPC ... open '.../tasks/*.output'`) and a trivial `psql -c "SELECT
count(*)"` exceeds a 120s timeout. Disk pressure is indistinguishable from test
flakiness until you look, and it silently contaminates timing-sensitive
concurrency work.

**7. Three measurement traps that make your own diagnostics lie, all hit in one
session.** (a) A background task's wrapper prints `[exited with code 0]` while the
command inside it printed `EXIT=1` — read the inner exit line, never the wrapper's
status. (b) `$?` after a pipeline is the **last stage**: `psql ... | cut | grep`
reported `LIST_EXIT=0` while psql had died with `FATAL: role does not exist`.
Put the command being judged last, or use `PIPESTATUS`. (c) Docker Desktop's
port-proxy holds a duplicate set of ESTABLISHED sockets, so `netstat` shows the
same 10 DB connections under two PIDs — one of them `com.docker.backend.exe`,
which is not a leak. Confirm against `pg_stat_activity` before calling anything
stray. Corollary: two samples are not a trend — a disk reading that fell 3.2G→2.5G
looked like a runaway leak and was flat across the next three samples.

**Why:** the first four were found by injecting mutations or by racing real
dependencies, not by reading code; several produced a *green* test that
measured nothing, which is the repo's most expensive recurring defect class.
The last three are the mirror failure — confidently explaining a *red* with a
cause that was never measured.

**How to apply:** when a new gate goes green, immediately ask which mutation it
is supposed to kill, inject it, and record the exit code. Also run the gate
inside the full suite at least once — single-file green is not the same as
suite green. In concurrency tests specifically: only use DI to control *when*
a call starts, never to strip real latency (Redis, network, extra queries) one
side would have in production — that latency is often exactly what determines
who wins the race. Related: [[slot-lock-failopen-verdict]].
