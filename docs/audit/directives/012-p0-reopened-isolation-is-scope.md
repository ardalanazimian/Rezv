# Directive 012 — Walk-in P0 REOPENED: isolation is scope, not follow-up. My "narrow" was wrong.

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent
**Severity:** blocker · **Supersedes:** directive 007 §3

---

## 1. My error first — I called it narrow and it reproduces 4 times in 6

Directive 007 §3 said the residual was "narrow, and materially smaller than what we started with —
this now needs genuine concurrency, where this morning it needed one host and one tap."

**Reproduced: 4/6 iterations, `occupants: 2`, exit 1.** Two overlapping active reservations claiming
table 902 — one with `table_id = 902`, one with `table_id = 901, merged_table_numbers = [901,902]`.
Both API calls return success. Neither caller ever sees an error.

A defect that reproduces in two-thirds of attempts under ordinary contention is not narrow. I
reasoned about the shape of the race correctly and then editorialised about its likelihood without
measuring it — which is the same move I reject from everyone else. **The correct statement was:
"unquantified until someone runs it."** I wrote a probability I had not earned.

## 2. Ruling — the isolation change is P0 scope, in the same PR

Directive 007 said the parent row closes when isolation is "addressed or explicitly accepted with a
written rationale." **The acceptance option is withdrawn.** You cannot accept a defect that
reproduces 4-in-6 and silently seats two parties at one table.

Verified at source: `reservations.ts:785` is still `return db.$transaction(async (tx) => {` with no
options. The mechanism you confirmed is sound and matches the code — Postgres SSI tracks only reads
made by SERIALIZABLE transactions, so a READ COMMITTED occupancy read is invisible to conflict
tracking, the rw-antidependency cycle never forms, and both commit.

**So the same-day fix added a sole protector and left it running where its read cannot be seen.**
That is the whole defect in one sentence and it belongs in the PR body.

**The isolation change ships in the same PR as the occupancy check.** My earlier instruction to keep
them separate was right when they were independent; they are not independent — the second is what
makes the first work. Keep them as separate *commits* for reviewability, one PR.

## 3. Instance eight — in the artifact we both praised, and I was one of the two who praised it

`table-occupancy.ts:71-75` states the secondary table has no DB-level protection and that this
function "is its only protector and must be called inside the same insert transaction." I called it
the over-claim class being fixed forward. You agreed and passed the credit to its author. **We were
both wrong, in the specific way the class predicts.**

It names the **scope** of the guarantee and omits its **precondition**: a sole protector is only a
protector at an isolation level where its read is reliable. Every clause is true. A reader finishes
it confident about a case that reproduces 4 times in 6.

That it survived two reviewers who were *actively hunting this exact class*, on the day we named it,
is the most useful fact about it. **Requirement:** the wording that ships with the isolation fix must
state the precondition, not only the scope — otherwise we will have written the same defect twice, in
the same file, about the same function.

## 4. The methodology trap outranks the finding — put it in the ledger first

The agent's first harness used a DI hook to bypass real Redis for timing control and returned **0/8
and 0/15 — a clean, confident "safe" reading.** The identical race against the real unmodified
`withSlotLock` and real Redis returned **14/15.**

The instrument was *better* than production: zero-latency merge is a speed advantage no real call
has. So the harness measured a system that does not exist, the test **ran**, it **passed**, and the
green was false.

This is our class at a distance neither of us had catalogued: **not two code paths disagreeing, but
the harness and production disagreeing about what the code is.** Every previous instance was a
description outrunning an artifact. This one is an artifact outrunning reality. It deserves its own
ledger line, and the countermeasure is different from all the others: **a harness that substitutes a
dependency for control must prove the substitution does not change the answer, by running the
faithful version at least once.** The agent did exactly that, unprompted, and discarded the
convenient result. That is the behaviour to hold up.

## 5. Runner guard — accepted, proven, and verified in CI by me

All three cases red with exit codes, each restored, runner `cmp` byte-exact. **The nested case is the
one that mattered:** the pre-fix flat scan would have printed green on it and the guard would have
shipped looking proven. Verified independently: `ci.yml:464` runs it, and it is green on the current
tree.

**On the `CLAUDE.md` mandatory list — I agree with you and I am not pushing back.** By my own test in
directive 003 §4: *does the edit change what is required of anyone?* Adding a step to the pre-push
list changes what every contributor must do locally. That is an obligation change and it is the
founder's, exactly as you held it. CI enforcement is yours and it is already live, so the property is
protected either way.

**But the list is now incomplete relative to CI, and that is in scope for both of us.** `CLAUDE.md`
presents its gate list as *the* gates. It no longer is. An incomplete list that reads as exhaustive is
this round's own class in a sixth medium — a document whose scope is narrower than its framing. Fix
the framing, not the obligation: say the list is the required local subset and that CI enforces more.
That changes nothing about what anyone must do.

## 6. Operational consequence you should plan for

The new test is deliberately red in the suite, which is right — a red test pins the defect until it is
fixed. But `_all.runner.mts` imports everything into one process, so **`npm test` is now red for
every other purpose too**, and "red can mean nothing ran" is harder to distinguish while a known
failure sits in the run. That is tolerable only because the isolation fix ships in the same PR (§2).
If that slips, the deliberate red stops being a pin and becomes noise that trains people to ignore a
red suite.

## 7. Housekeeping, recorded so it is not rediscovered

- Stale `tsx --test` processes from earlier today still hold Postgres/Redis connections, including one
  for `_probe-slotlock.mts` — a file that no longer exists on disk.
- `rezervno_walkin` is no longer pristine: `staff=1` plus five orphaned `[DEMO]` husks. **The next
  session must rebuild it rather than trust the 72/61/0 shape** — a DB believed clean and measured
  once is precisely the instrument-drift class from #13.

---

## 8. The retry requirement — a gap in my own ruling, and it is worse than "a different defect"

I ruled "isolation ships in the same PR." That was correct and **incomplete**, and the CEO closed it.
Verified at source:

```text
reservations.ts:60    const TX_MAX_RETRIES = 5;   // تلاش مجدد روی تداخل serialization
reservations.ts:~246  for (let attempt = 0; attempt < TX_MAX_RETRIES; attempt++) { … }
                      isSerializationError(e) && attempt < TX_MAX_RETRIES - 1 → backoff + continue
                      throw lastErr ?? Err.concurrencyRetry();
createWalkin (784-870) occurrences of TX_MAX_RETRIES or concurrencyRetry:  0
```

So raising isolation on the walk-in path without the retry converts a silent double-booking into a
serialization error shown to the host.

**And that is not merely "a different defect" — under this product's actual usage it may produce
worse data than the bug.** A host trying to seat a walk-in on a busy night who receives an error does
not stop seating the party. They seat them anyway and the record never gets created. The double
booking still happens physically, and now it is **invisible to the system entirely** rather than
recorded as two rows someone could later detect.

That makes the retry the load-bearing half, exactly as the CEO scoped it: without it the fix moves
the failure off-system, which is strictly harder to detect than the defect it replaces. **Reusing the
existing mechanism rather than pasting a second retry loop is right** — a duplicated retry loop would
be "fix the instance, not the class" committed inside the correction to that very error.

## 9. `CLAUDE.md` framing — verified, and it changes no obligation

`CLAUDE.md:11` now reads «این فهرست **زیرمجموعه‌ی اجباریِ محلی** است، نه کلِ گیت‌ها» and `:17` names
`.github/workflows/ci.yml` as the complete source of truth. Nobody's local obligation moved by a
single command, and the document stopped presenting a partial list as exhaustive. Ruled and closed.

## 10. The class now has a taxonomy, and my own error supplied the missing branch

The CEO's reading of my withdrawn probability is right and it is the sharpest extension yet: "narrow,
and materially smaller" was an over-claim about **likelihood**, not scope, sitting on top of a
mechanism analysis that was entirely correct. Correct analysis, unearned quantifier.

So the class has three branches, each with a different countermeasure:

| Branch | Example | Countermeasure |
|---|---|---|
| **Scope** — claim wider than what holds | `redis.ts:163`, C2's title, "55/55", the UI state label, `table-occupancy.ts:71-75` | State the boundary in the same sentence as the claim |
| **Likelihood** — quantifier without measurement | my "narrow, materially smaller" | Measure it, or write **unquantified** |
| **Fidelity** — artifact outrunning reality | the DI-hook harness: 0/15 safe vs 14/15 real | A substituted dependency must prove the substitution does not change the answer |

Eight instances, seven media, three distinct countermeasures. That is no longer a list of anecdotes —
it is a taxonomy, and it is the strongest candidate in the constitution queue precisely because the
remedies differ by branch. A single rule saying "check your claims" would fix none of them.

**The instance that proves it is not a discipline problem:** branch two is mine, written while I was
being careful, in a directive whose analysis was correct, on the day I was hunting this class.
