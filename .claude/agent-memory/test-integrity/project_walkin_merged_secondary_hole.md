---
name: walkin-merged-secondary-hole
description: CONFIRMED under real concurrency (2026-09-04) — createWalkin + concurrent createReservation(merge) physically double-book a shared secondary table; isolation-level fix is P0 scope, not follow-up
metadata:
  type: project
---

`createWalkin` (`api/src/lib/reservations.ts`, `createWalkinTx` ~line 785) runs
`db.$transaction(async (tx) => {...})` with **no `isolationLevel` option** —
READ COMMITTED. A same-day P0 fix (2026-09-04) added an in-transaction
application check (`isTableNumberOccupied`, reservations.ts:852, from
`table-occupancy.ts:77`), which closed the **sequential** hole (walk-in tried
*after* an already-committed merge). That sequential-only proof is what this
memory used to describe — it undersold the risk.

**The concurrent case was tested live on 2026-09-04 and reproduces.** Test:
`api/tests/walkin-merge-occupancy-concurrency.test.mts` (imported in
`_all.runner.mts`). Method: exactly the `:94` pattern in
`table-merge-occupancy-concurrency.test.mts` — real `createWalkin` and real
`createReservation` fired together via `Promise.allSettled`, **no DI, no
mocking, real Redis** (`withSlotLock` unmodified). 6 iterations against a
fresh restaurant/tenant each time.

Result, full-suite run, exit code 1: **6/6 iterations produced a physical
double-booking** — both calls returned success, `merge.merged_tables =
[901,902]`, `walkin.reservation.tableId = table_902`, and a direct SQL query
against `reservations` showed 2 overlapping physical occupants of table 902 in
the same time window. Standalone reruns: 14/15 and 4/6 (never 0/N once real
Redis timing was used — see the methodology note below).

**Why it reproduces:** merge runs SERIALIZABLE and takes its occupancy
snapshot at transaction BEGIN; Postgres SSI only tracks (SIREAD-locks) reads
made by SERIALIZABLE transactions. `createWalkin`'s READ COMMITTED read is
invisible to that tracking, so the two-edge rw-antidependency cycle SSI needs
to abort a transaction never forms. Each side, in isolation, is internally
consistent — it's the isolation *mismatch* between the two writers of the same
physical table that breaks the guarantee documented in table-occupancy.ts:71-75.

**Methodology trap found and avoided:** an early version of this test bypassed
`withSlotLock` (custom DI, zero Redis latency) to control timing precisely.
That version reproduced 0/8 and 0/15 — a false "safe" reading. The zero-latency
merge path is a synthetic advantage no production merge has (real Redis
round-trip, more tables to scan in `tryMergeTables`, real preorder inserts).
Re-running with **real** Redis (`withSlotLock` untouched) flipped the result
to 14/15. **Lesson: a concurrency test that "wins" only because one side was
made artificially fast is not a safety proof — it's a stopwatch artifact.**
Always race the real, unmodified production code paths; only use DI to
control *when* something starts, never to remove real latency one side would
have in production.

**How to apply:** do not implement the isolation fix without architect
sign-off (touches reservation lifecycle) — but per the audit mandate, this is
explicitly **P0 scope, not a follow-up**: `createWalkinTx` needs
`{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }` to match
`placeReservation` (reservations.ts:396). The regression test above is
intentionally left **red** in the suite (1547 tests, 1546 pass, 1 fail) until
that ships — its failure IS the P0 evidence; do not skip/todo it to go green.
Related: [[slot-lock-failopen-verdict]].
