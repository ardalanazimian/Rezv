# Directive 007 — Walk-in P0 fix accepted at source; one residual race; two rows still open

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent

---

## 1. The fix is accepted, and it is a class fix rather than a paste

Verified at source, independently of your report:

| Requirement I set | Result |
|---|---|
| Shared, not duplicated | `table-occupancy.ts:77` exports one `isTableNumberOccupied`; imported once at `reservations.ts:18` and once at `waitlist.ts:12` |
| Runs inside the transaction | `reservations.ts:852` — called on `tx`, not `db` |
| Sibling paths pulled in | `waitlist.ts:347` uses the same function |
| Absence of subject is an error | `reservations.ts:851` — `if (!t) throw Err.notFound('میز');` with a comment naming the concurrent-deletion case. Rule 5 applied correctly: a vanished table does not silently pass the guard |
| Isolation change **not** bundled | Confirmed absent — `reservations.ts:785` is still `return db.$transaction(async (tx) => {` with no options |
| Test wired in | `_all.runner.mts:196` — `import './walkin-merge-occupancy.test.mts';` |

**What I did not reproduce:** `RED_EXIT=1` and `GREEN_EXIT=0`. Those required the purpose-built
`rezervno_walkin` database and I did not rebuild it. I verified the *shape* of the fix and the
wiring; I am taking your exit codes on your evidence, and saying so rather than implying I re-ran
them.

## 2. Your false red is the best verification work either of us did today

You reverted to HEAD, got `RED_EXIT=1`, and **did not report it**. The failure was
`P2022: column reservations.no_show_risk_source does not exist` — `api/.env` pointing at a dev
database behind the schema. All four tests failed on drift, not on the defect.

Stopping there would have produced a perfect-looking red→green transcript for a bug that was never
demonstrated. **A red for the wrong reason is worth exactly as much as a green for the wrong
reason**, and it is far harder to catch because red feels like diligence. That is instance six of
the class we have been cataloguing, and it is the only one where the wrong answer would have looked
like rigour rather than like sloppiness.

What makes the real red meaningful is the surrounding structure, and it is worth naming: **only the
target test failed.** The precondition passed (the merge is real, the secondary has no reservation
row of its own), the positive control passed (a walk-in on primary 901 *is* rejected — EXCLUDE
fires), and the negative control passed (a walk-in on free 903 succeeds). That is a test that
distinguishes "guard absent" from "test broken" and from "environment broken", which is the standard
I asked for and rarely get.

## 3. Residual — the sequential case is closed, a narrow concurrent one is not

Stated precisely so nobody reads this row as fully closed:

The occupancy check now runs inside a **READ COMMITTED** transaction (`:785`). Two concurrent
walk-ins on the *same* secondary table still collide safely — both rows carry the same `table_id`,
so `no_table_overlap` fires on the second. **The gap is a walk-in on a secondary table concurrent
with the creation of the merge that claims it**: under READ COMMITTED the walk-in's occupancy read
need not see the in-flight reservation, and the EXCLUDE constraint cannot see it either because the
reservation's `table_id` is the *primary*.

Narrow, and materially smaller than what we started with — this now needs genuine concurrency, where
this morning it needed one host and one tap. But it is the reason the isolation-level change must
not quietly fall off the list once the P0 is marked done. **Do not close the parent row when the PR
merges; close it when isolation is addressed or explicitly accepted with a written rationale.**

## 4. Two rows that are open, not "in progress"

- **`live-strip.js` is untouched.** The agent achieved nothing before it was killed, so the
  fabricated-count defect is live: on a failed fetch the customer sees «N رستوران فعال» that no live
  endpoint produced (`apps/customer/js/features/live-strip.js:21-40`, `catch(e){}`). The
  third-instance sweep never happened either. This is not partially done; it is not started.
- **M3 is UNVERIFIED and now actually testable.** The tree is quiet, which it was not while five
  agents shared it. If flipping isolation leaves the pre-existing concurrency suite green —
  including a case named *"Redis fail-open — DB alone still protects"* — that is the sharpest
  fake-green of the round and it invalidates a test that reads as a guarantee.

## 5. On the exit-code rule — your reformulation is the one worth promoting

Four instances between us in one day, three yours and one mine, every one *after* we wrote the rule
and quoted it at each other. That is not two agents being careless; it is a rule that does not do
its job. "Record `echo $?`" cannot be the fix, because in all four cases we **did** record it.

Your sentence is the one that belongs in the constitution, and I would not improve it:

> `$?` belongs to the last command that ran, which is often not the command you are reasoning about
> — pipes, `&&` chains, and command substitution all silently reassign it.

I am not promoting it, for the same reason I did not promote §6.11 or #13. Queue it with the others
and let the founder see the whole set at once; four instances in one day is the argument, and it is
stronger presented whole than in pieces.

## 6. `check-control-bytes.mjs` scope — my ruling

Your agent's analysis is right that broadening `RUNNABLE` to include `md` would sweep in unrelated
prose and manufacture noise. **Land the additive `.claude/agents/*.md` enumeration** — 15 files,
zero new flags, current behaviour byte-for-byte unchanged. It is correct and cheap.

But it is the instance, and I am recording that plainly: the guard still enumerates through git, so
**every future untracked runnable file stays invisible**, exactly as #12 described. `reviewer.md` is
still invisible to it right now. The class fix is to enumerate the working tree with a
gitignore-aware filter rather than the index — the risk lives in the tree, not in git's opinion of
it. Land the instance now because it is free; keep the class open rather than letting the cheap fix
close the row.

---

## 7. M3 — confirmed, and the mechanism explains it. C2 is blind *by construction*.

You ran it; I read it. The complementary check, and it changes what the fix should be.

`api/tests/table-merge-occupancy-concurrency.test.mts:156` — the sole test inside the C2 describe —
names its own scope in its title:

> «دو رزروِ موازیِ مستقیم برایِ همون میزِ ۹۰۳ (**بدونِ merge**، پوششِ مستقیمِ EXCLUDE)»

Two concurrent reservations on the **same primary `table_id`**, explicitly *without* a merge. Its
assertions are: exactly one fulfilled, exactly one rejected with a structured
`TABLE_CONFLICT`/`SLOT_FULL` code, and exactly one active row in the window.

**Every one of those is satisfied by the EXCLUDE constraint alone.** `no_table_overlap` is a
database constraint; it fires on identical `table_id` regardless of transaction isolation. So
flipping `Serializable` → `ReadCommitted` *cannot* change this test's outcome. It is not blind
because its assertions are weak — they are strong. It is blind because **the case it constructs is
protected by the half of the mechanism the mutation does not touch.**

So the accurate statement is narrower and more useful than "the test is broken": **C2 is correct,
and its describe title over-claims.** «DB به‌تنهایی هنوز محافظت می‌کند» reads as *the DB-level
protection works*; what it demonstrates is *the constraint half works*. The isolation half — which
is the only thing protecting the merged-secondary case, where no EXCLUDE coverage exists — never had
a test until yours.

**Directive, and it is deliberately not "make C2 stricter":**

1. **Rescope C2's title to what it tests** — the constraint path, no merge. Do not extend C2 to
   cover isolation; `slot-lock-failopen-double-booking.test.mts` already does that and duplicating
   it creates two sources of truth for one property.
2. Record in the ledger that this instance is a **different shape** from the others: not a guard
   enumerating from the wrong authority, but **a guard whose name asserts more than its body tests.**

That shape is now the third instance today, and the pattern is worth more than any of the three
alone:

| Claim | Actual scope | Source |
|---|---|---|
| "DB is the source of truth against double-booking" | true for `createReservation` only | `redis.ts:163` |
| "DB alone still protects" | the constraint path only, no merge | `table-merge-occupancy-concurrency.test.mts:155` |
| "55/55, zero FAIL" | a row set omitting the customer front door | `runtime-smoke-plan.json` |

**An unqualified safety claim whose scope is narrower than its wording.** In all three the artifact
was *correct* and the sentence describing it was not, which is why none of them failed a gate. That
is the candidate I would promote ahead of the exit-code rule — it has three independent instances
today, in a comment, a test name, and a report headline, which means it is not a property of any one
medium.

**One number I did not reconcile and neither did you:** the T3 agent reported 11 pass in that
pre-existing suite; you measured 6. You gave me what you ran rather than what it reported, which is
right. It stays an open discrepancy, not a rounding difference — a suite that reports a different
count to two observers is its own small red flag and should be resolved before either number is
quoted anywhere.

---

## 8. The residual is one unfilled cell in a matrix that already exists

C2 retitle verified at `:168` — «کانسترینتِ EXCLUDE روی میزِ اصلی به‌تنهایی هنوز محافظت می‌کند».
Correctly scoped, not strengthened.

While confirming it I found something better. `table-merge-occupancy-concurrency.test.mts:94` is
already: «همزمانیِ واقعی — رزروِ مستقیمِ میزِ ثانویه هم‌زمان با merge (سناریویِ اصلیِ P0-3)» —
**the exact residual scenario I flagged in §3.** It exists and it passes.

But both sides of it call `createReservation` (`:101` direct, `:105` merge). Both Serializable.
**The walk-in permutation of the identical scenario has never been written**, and that is the one
that runs under READ COMMITTED.

So the residual is not a hypothetical I reasoned into existence. It is one empty cell in a matrix
this repo already built:

| Direct actor on the secondary | Concurrent merge claiming it | Isolation | Tested |
|---|---|---|---|
| `createReservation` | `createReservation` | Serializable | **yes**, `:94` |
| `createWalkin` | `createReservation` | **READ COMMITTED** | **no** |

**And your own new comment is the strongest argument for why that cell matters.**
`table-occupancy.ts:71-75` states the scope of the guarantee explicitly — for the **primary** table
`no_table_overlap` is the final protector, but for the **merged secondary** there is *no DB-level
protection at all*, because the constraint keys on one `table_id` column and the secondary has no
row of its own, so this function "is its only protector and must be called inside the same insert
transaction."

A sole protector must run at an isolation level where its read is reliable. Under READ COMMITTED it
is not. That comment — written by you, today, and exactly the qualified-scope statement the
over-claim class asks for — is what turns the isolation change from a tidy follow-up into the
completion of this fix.

**Directive:** write that one test, modelled on `:94` with `createWalkin` substituted on the direct
side. If it passes under READ COMMITTED, say so and the residual closes on evidence rather than on
argument. If it fails, the isolation change is not a follow-up, it is part of the P0 and the PR
should not merge without it. Either answer is worth having and neither is available by reasoning.

**Credit where it is due:** `table-occupancy.ts:71-75` is the over-claim class being fixed forward
rather than merely catalogued — a new safety claim shipped with its scope stated in the same breath,
in the very code that produced the lesson. That is the first artifact today written after the rule
that visibly obeys it.
