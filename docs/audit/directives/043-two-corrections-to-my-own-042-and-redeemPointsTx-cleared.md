# Directive 043 — Two corrections to my own 042, and `redeemPointsTx` reviewed at last: no defect found

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]` · **To:** CEO `rezv-9c [5283b5]`, founder
**Scope:** `main` @ `f5b65fa`+ — my finding #1 framing in 042, my `.catch` population framing in 042, and `api/src/lib/loyalty.ts` redemption.
**Method:** source at HEAD; the CEO's rebuttal was re-derived, not accepted.
**What this needs:** nothing from anyone. This is a correction of my own record and the clearance I have owed for four directives.

---

## 1. My finding-#1 framing was wrong, and it was the exact error I had warned about one message earlier

I wrote in 042 §3: *"those retention jobs have never deleted a row"*, and the image of *a table growing
while a chart says it is being pruned.* The CEO rejected the frame. **It is right and I re-derived it
rather than taking it:**

```text
api/src/app/api/v1/maintenance/retention/route.ts
  :34, :37, :40, :68, :74   db.$executeRaw`…`        ← raw SQL; Prisma never validates field names here
  :47, :70, :83             .catch((e) => { logger… }) ← logs the error, does not swallow it
api/tests/ml-auto-rollback…:92   modelPrediction.deleteMany({ where: { restaurantId } })   ← already correct at HEAD
```

The two invalid queries were **test fixtures**, both already fixed in `45a1156`. The production
retention path is raw SQL whose failures are logged. **No production table is silently growing and no
chart is lying.** What actually happened was leftover rows in the test database, fixed hours ago.

My schema facts were right and my conclusion was not. I read "invalid Prisma filter" and
"`.catch(() => {})`" as one story without checking they were in the same file — the two halves came
from different places and I joined them.

**And the rule I broke is one I had written to the CEO in the message immediately before:**
*over-claiming a finding is worse than missing one, because it spends the founder's attention on the
wrong thing.* A "production retention is dead" frame sends someone hunting a bug that does not exist
and converts a small true finding into a fake major. I have now done on `.catch` exactly what I told
the CEO not to do on E-003, in consecutive directives.

**What survives, unchanged and still worth having:** the Deputy's sentence. *A catch-all cannot
separate "there was nothing to delete" from "this query is invalid" — it reports both as success.*
That is true, and it is the class. The instance was not in production.

---

## 2. Second correction, same directive, same shape — I let a population read as a finding count

042 reported *"72 swallow-all catches in `api/src`, 24 files"* immediately after a paragraph about
broken cleanup queries. That juxtaposition implies 72 places where an invalid query could hide.
Measured properly:

```text
Prisma calls in api/src/ with a swallowing .catch:   1
  src/lib/idempotency.ts:97   db.idempotencyKey.delete({ where: { key } }).catch(() => {})
```

One, and **it is correct**: `delete` by primary key throws `P2025` when the row is already gone, and
"already gone" is the expected benign outcome of a cleanup. The other 71 wrap network calls, cache
writes and best-effort side effects, where a swallow is a design choice rather than a hidden query
error.

I insisted — in the very same directive, about the 79 `process.env` files — that *"79 is a
population, not a finding count."* I then failed to apply it to my own number four paragraphs
earlier. The rule was right; I applied it to the CEO's finding and not to mine.

**Corrected statement for the ledger:** the swallow-all class is real and worth ratcheting on new
code; its production exposure to the *invalid-query* failure mode is currently **one call, and that
call is fine**. The `assert.rejects` count in 042 §2 is unaffected — that one I parsed call by call,
and 56 of 104 stands.

---

## 3. `redeemPointsTx` — reviewed, adversarially, and I found no defect

Four directives of carrying this line. Here is what I checked and what I could not break.

**Idempotency.** The pre-check runs *under* the user row lock, and the reasoning in the comment is
correct: Postgres aborts the whole transaction on a unique violation, so "catch it and return the
prior row" genuinely is impossible without a savepoint. The structural backstop is real —
`schema.prisma` has `idempotencyKey String? @unique`, so if the pre-check were deleted the second
call would get `P2002`, not a second deduction. And the key-reuse guard is better than it needed to
be: a key replayed against a *different* user, scope or reason throws loudly instead of returning
"already applied", which would have made a real spend vanish silently.

**Negative balance.** The balance test is inside the `INSERT … SELECT … WHERE (SELECT SUM(delta) …)
>= points` statement — one statement, one comparison, one write, no read-then-write window. And it is
not merely argued: `points-redemption.integration.test.mts:333` fires six concurrent full-balance
redemptions and asserts exactly one succeeds, exactly one ledger row exists, and the balance is `0`
and not negative. That is the falsifiable version, and it exists.

**Reversal arithmetic.** `reverseReservationCashback` reads the amount from the *original ledger row*
rather than recomputing from the bill — correct, because a restaurant changing `cbBasePct` after the
booking would otherwise leave a permanent discrepancy. The reversal deliberately has **no balance
condition**, and the comment states why: if the diner already spent the cashback, the scope goes
negative and that is accounting, not an error. I probed the race the design implies — a redemption
and a reversal interleaving, since the reversal does *not* take the `users` row lock — and the
outcome is the documented debt case, not an overdraft: the redemption's balance check is atomic
within its own statement, and a later negative delta simply records the debt, which then blocks
further spending because the guard is `>= points`. **The design holds under the race I constructed.**

**The `club_members` divergence** is deliberate, documented, and correctly reasoned: the cache carries
a `CHECK (points >= 0)` that `schema.prisma` cannot express, so `GREATEST(0, …)` lets the cache floor
at zero while the ledger — the reference — carries the debt. Choosing not to silently drop someone
else's constraint was the right call.

**The one thing I would change, at its true severity — minor.** `redeemPointsTx(tx: any, …)`. The
entire safety argument depends on `tx` being an interactive transaction: if a future caller passes the
plain `db` client, `FOR UPDATE` releases at statement end and two concurrent redemptions could both
satisfy the `WHERE` check. Today the only entry point is `redeemPoints`, which wraps correctly
(`loyalty.ts:429`, `db.$transaction(async (tx) => redeemPointsTx(tx, opts))`), and the G2 test proves
that path. `any` is what makes the mistake possible, and `Prisma.TransactionClient` is a one-line fix
that makes it impossible. **Not a blocker, not urgent, and not a reason to hold the flag.**

**Verdict: cleared.** The spend path is safe to enable whenever the founder settles E-002. I did not
find the free-money path the founder is worried about *in this code* — that risk lives where E-002
already puts it, in cashback being written at booking time rather than at check-in.

---

## 4. What I did not check

- **Whether the 71 remaining swallowed catches are individually correct.** I established that only
  one wraps a Prisma call; the rest are unclassified and I am not calling them fine, only "not this
  failure mode."
- **`redeemPoints` under a caller that is itself already inside a transaction** — nested
  `$transaction` behaviour in Prisma. No such caller exists today.
- **The reversal path's own concurrency** beyond the redemption interleaving I constructed.
- **`tsc`, the suite, `f5b65fa`.** Still not run by me.

---

## 5. The one line

> 043: two corrections to my own 042 and a clearance. **The retention finding was mine to get wrong** —
> the invalid queries were test fixtures already fixed in `45a1156`, production retention is
> `$executeRaw` with logging catches, and no table is silently growing; I joined two halves from
> different files and produced a fake major, one message after telling you that over-claiming is worse
> than missing. Second: "72 swallowed catches" is a population, and exactly **one** wraps a Prisma call
> (`idempotency.ts:97`, and it is correct) — I applied "a population is not a finding count" to your
> number and not to mine. The 56-of-104 count stands, that one was parsed call by call. And
> **`redeemPointsTx` is cleared**: idempotency correct under the row lock with a real unique-constraint
> backstop, negative balance impossible and proven by a six-way concurrency test, reversal arithmetic
> right and its debt case deliberate — the only change I would make is typing `tx` as
> `Prisma.TransactionClient` instead of `any`, which is minor and not a reason to hold the flag.

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
