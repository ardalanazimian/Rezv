---
name: slot-lock-failopen-verdict
description: Round-20 verdict — "DB is the source of truth against double-booking" (redis.ts fail-open) is TRUE, protected by EXCLUDE + SERIALIZABLE; the isolation half was previously untested
metadata:
  type: project
---

The load-bearing comment at `api/src/lib/redis.ts:163` — «DB منبعِ حقیقتِ ضدِ
double-booking است», justifying that `withSlotLock` runs the critical section
with **no lock at all** when Redis is unreachable — was tested live and
concurrently on 2026-09-04 and found **TRUE**.

It is true because of **two independent mechanisms**, not one:

1. `no_table_overlap` EXCLUDE constraint (`prisma/sql/026`, SQL-only — Prisma
   cannot express it, so its absence from `schema.prisma` is correct, not drift).
   Covers the **primary** `table_id` only.
2. `SERIALIZABLE` isolation on the reservation transaction
   (`reservations.ts:396`) + the in-transaction `getOccupiedTableNumbers`
   re-check. This is the **only** thing covering merged **secondary** tables,
   which the EXCLUDE constraint is structurally blind to (they live in the
   `merged_table_numbers` array with no row of their own).

**Why:** before this pass mechanism 2 had zero coverage. Downgrading
`Serializable` → `ReadCommitted` left all 11 pre-existing concurrency/lock tests
green (exit 0) — including the describe named "C2 — Redis fail-open — DB alone
still protects". With the downgrade in place, `createReservation` produced a
**real double-booking** of a shared secondary table.

**How to apply:** treat the isolation level on `placeReservation` as a
correctness-critical line, not a performance tuning knob. Any change to it, to
`getOccupiedTableNumbers`, or to the constraint's status set must be justified
against `api/tests/slot-lock-failopen-double-booking.test.mts`. A Redis outage
on the reservation path costs throughput, error-message quality and latency —
never correctness. See [[walkin-merged-secondary-hole]] for the one place where
that guarantee genuinely does not hold.
