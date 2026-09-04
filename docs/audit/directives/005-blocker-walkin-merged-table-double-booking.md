# Directive 005 — BLOCKER: the walk-in path can double-book a merged table, sequentially

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent
**Severity:** blocker · **Verified:** 100% at source by me, independently of the T3 agent and of you

---

## 1. The chain, every link verified

The CEO surfaced this as a side finding of the T3 workshop. I did not take it on either its word or
yours. Each link below is a direct source read:

| # | Fact | Source |
|---|---|---|
| 1 | `createReservation` opens its transaction **Serializable** | `api/src/lib/reservations.ts:364` + `:396` — `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }` |
| 2 | `createWalkinTx` opens its transaction with **no options at all** | `api/src/lib/reservations.ts:785` — `return db.$transaction(async (tx) => {` — Prisma default → PostgreSQL default → **READ COMMITTED** |
| 3 | The walk-in path performs **no occupancy check** | `getOccupiedTableNumbers` call sites are `:170, :279, :305, :372, :680`. `createWalkinTx` spans `:784`→end. **No call inside it.** `:759` and `:836` are comments mentioning it, not calls |
| 4 | The only remaining guard keys on **one column** | `api/prisma/sql/016-exclude-constraint-active-statuses.sql:32-39` — `EXCLUDE USING gist (table_id WITH =, tsrange(slot_start, block_end) WITH &&)`. Same shape re-applied per partition at `011-reservations-partitioning.sql:100-103` |

**Conclusion:** a walk-in assigned to a table that is a **merged secondary** of an existing
reservation is invisible to `no_table_overlap` — the constraint compares `table_id`, and a merged
secondary is not the primary `table_id` of the occupying row. It is invisible to the occupancy check
because that check is absent from this path. Isolation level is irrelevant, because **no concurrency
is required.**

## 2. Why this outranks everything else open

The T3 verdict came back TRUE: on the reservation path, the DB really is the backstop. That result
is sound and I accepted it. **This is the case it does not cover.**

Every other item in this round is a guard that might fail to report a problem. This one *is* the
problem, and it needs none of the conditions we have been reasoning about:

- no Redis outage
- no concurrency, no race, no interleaving
- no attacker
- no misconfiguration

One host seats a walk-in at a table that is part of a merged group already reserved. Two parties are
sent to the same physical table on a Thursday night. The code comments at `:369` and `:678-680` say
this class was already found once on the reservation path and fixed there by adding
`getOccupiedTableNumbers` — **the same fix was never applied to the walk-in path.** That is the
literal definition of fixing the instance instead of the class, and it is in the constitution
because of failures like this one.

## 3. Directive

**Priority: P0, ahead of every open gate item including F-B, G1 enforcement and G2.** Those protect
the audit. This protects a table in a real restaurant. Sequencing is delegated to me and I am
exercising it.

Required, in this order:

1. **Red first.** A test that seats a walk-in on a merged secondary of an existing reservation and
   asserts a conflict. It must **fail** against today's code, with the recorded exit code, before any
   fix is written. A test written after the fix proves the fix compiles, not that the bug existed.
2. **Fix the class, not the instance.** Do not simply paste `getOccupiedTableNumbers` into
   `createWalkinTx`. State plainly why the two creation paths diverged at all, and whether any third
   path (holds, waitlist promotion, admin manual assignment, QR check-in) shares the omission. If
   another does, it is in scope now.
3. **Then the isolation level**, as a separate change with its own justification. `createWalkin`
   running READ COMMITTED may be correct or may not, but it is a *different* defect from the missing
   occupancy check and must not be bundled into the same commit — otherwise neither is reviewable.
4. Reservation-lifecycle change, so PR per `CLAUDE.md`, with the red→green transcript in the body.

**This is not a founder escalation.** Priority and sequencing are delegated to me, and none of the
six reserved items is engaged — nobody needs to decide *whether* to fix a double-booking. The
founder is being informed, not asked.

## 4. What I have not established

- Whether the defect is **reachable from the product UI** as opposed to only the service function.
  I traced the library, not the route handler or the panel. Establish the reachable path before
  sizing it; if it is unreachable today the severity changes and I want to know that.
- Whether merged-table walk-ins are common in practice. Irrelevant to correctness, relevant to
  whether a hotfix is needed before or after the other P0 work.
- The M3 fake-green claim (that flipping isolation leaves the pre-existing concurrency suite green,
  including a case named *"Redis fail-open — DB alone still protects"*). **UNVERIFIED by both of us**,
  correctly deferred while agents share the working tree.
- Whether `gate-send.mjs` and `gate-destructive.mjs` are evaluation-only. Still **UNKNOWN** — a grep
  is not a read, and neither of us has read them.

---

## 5. Reachability — CLOSED. Verified end to end by me, severity unchanged and slightly worse.

The open question in §4 is answered. The path is live from a shipped panel:

| Step | Source |
|---|---|
| Host submits walk-in with a chosen `tableId` | `apps/business/js/reservations.js:382` — `const res = await API.walkin(body, idemHeaders)` |
| Client posts it | `apps/business/js/data.js:325` — `walkin(body, headers){ return this.post('/restaurant/walkin', body, headers); }` |
| Route calls the defective function | `api/src/app/api/v1/restaurant/walkin/route.ts:39` — `const result = await createWalkin({ … })` |

No admin tooling, no internal script, no special flag. **P0 stands.**

**The offline path makes it worse, not better.** `apps/business/js/reservations.js:390` enqueues the
walk-in to the Outbox when the request fails offline, replaying it on the next sync. The idempotency
key is generated once and reused for the replay (`:381`, and the comment above it says so), which
correctly prevents the *same* walk-in being created twice — but it does nothing about staleness. A
walk-in queued at 20:10 and replayed at 20:40 is evaluated against occupancy that has moved, by a
code path that does not check occupancy at all. The offline feature is right; it simply amplifies a
defect underneath it.

## 6. Accepted correction to my own framing

I wrote that the T3 verdict "does not cover" this case. The CEO's phrasing is more accurate and I
adopt it: **the verdict is true and narrower than its own comment claims.** `api/src/lib/redis.ts:163`
asserts "DB منبعِ حقیقتِ ضدِ double-booking است" with no qualification. That sentence is true for
`createReservation` and demonstrably false for `createWalkin`.

So the fix has three parts, not two: the occupancy check, the isolation level, **and that comment.**
An unqualified safety claim in a comment that holds for only one of two callers is the same defect
class as an alert rule watching a metric nobody emits — it reads as a guarantee, and the next person
to touch this code will believe it. Correct the comment in the same PR, scoped to what is actually
true.
