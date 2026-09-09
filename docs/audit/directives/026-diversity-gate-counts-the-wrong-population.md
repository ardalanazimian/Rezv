# Directive 026 — The platform-model diversity gate counts a different population than it guards; a test that has never run; and a staging constraint

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** CEO agent, founder
**Origin:** overnight autonomous work. Items 1 and 3 raised by the CEO's test-integrity agent; I
verified both at source. Item 2 is an operational constraint that binds before anyone stages.

---

## 1. The diversity gate is satisfiable while training on one restaurant — verified

`no-show-model.ts` guards the platform-wide no-show model with a restaurant-diversity check whose own
failure message states the intent: «مدلِ «سراسری» با دادهٔ یک‌دو رستوران، سراسری نیست».

**The gate and the training set read different populations:**

```text
:843-847  restaurantCount = db.reservation.findMany({
            where: { status: { in: [...] } },        ← NO source filter
            distinct: ['restaurantId'], take: 200 })

:800-813  fetchPlatformTrainingRows() SQL:
            WHERE r.status IN (...)
              AND r.source <> 'walkin'               ← walk-ins EXCLUDED
              LIMIT ${PLATFORM_MAX_ROWS}             ← and truncated
```

**Two restaurants whose reservations are all walk-ins, plus one ordinary restaurant, gives
`restaurantCount = 3`.** The gate passes at `3 >= PLATFORM_MIN_RESTAURANTS`, and the model then trains
on rows from **one** restaurant — exactly the outcome the gate exists to prevent. The `LIMIT` is a
second, independent divergence: a restaurant can contribute to the count and be truncated out of the
training rows.

This is the neighbouring-question failure in a gate. It answers *"how many restaurants have completed
reservations?"* when the question it is asked is *"how many restaurants contributed training rows?"*
No exit code or green distinguishes those, because the gate is doing its job correctly — on the wrong
set.

**Blast radius:** the comment at `:773` records that this model is served to **every restaurant
without its own model**. A platform model silently trained on one venue is served to all of them.

**Directive.** Derive the count from `rows` — the actual training set already in hand at `:839` —
rather than from a second query. One population, one question. Prove it red first: a fixture with two
walk-in-only restaurants and one ordinary one must fail the gate before the fix and pass after when a
third ordinary restaurant is added. The current test cannot catch this: it survived
`PLATFORM_MIN_RESTAURANTS 3→2` **and** deletion of the gate entirely, exit 0 both times.

**Ownership:** the file is held by another agent tonight, so this is recorded rather than done.

## 2. Staging constraint — do not stage `_all.runner.mts` alone

Measured by the CEO's agent in a throwaway `GIT_INDEX_FILE` with the shared index untouched: staging
`_all.runner.mts` by itself makes `check-runner-completeness.mjs` **exit 1**, naming the *other*
agent's five untracked test files, because the runner's imports reference files the index does not yet
contain.

**Whoever stages must stage both agents' new test files together.** This is directive 018's
index-versus-working-tree gap arriving as a live operational constraint rather than a hypothesis — the
guard validates the index once something is staged, and a half-staged index is a state neither the
working tree nor the commit ever shows.

## 3. `waitlist-accept-clock.test.mts` has never executed its assertion here — verified

```js
const probe = new Date(Date.UTC(2026, 7, 23, 18, 0, 0));
const isUtcProcess = probe.toTimeString().slice(0, 5) === '18:00';
if (!isUtcProcess) { assert.ok(true, '…'); return; }
```

`new Date().getTimezoneOffset()` on this host → **`-210`** (Tehran). `toTimeString()` therefore never
yields `'18:00'`, the branch **always returns early**, and `assert.ok(true)` passes unconditionally.
The file is named for clock coverage and has never tested a clock on this machine.

**What makes it worse than an ordinary hollow guard is that the comment is honest** — «صادقانه: روی
این ماشین قابلِ اثبات نیست». The author knew and said so. But a reader sees a green suite and a file
named `waitlist-accept-clock`, not the comment; honesty in a comment does not make a green mean
anything. `CLAUDE.md` rule 5, verbatim.

**The reassuring half, established by mutation:** reinstating the original P0 in source left this file
at exit 0 in both timezones, while `waitlist-flow.integration.test.mts` caught it at exit 1. **Real
coverage exists — just not in the file named for it.** So the defect is a misleading name and a dead
assertion, not an unguarded behaviour.

## 4. A third instance of the class directive 023 §6 named

`restaurant/pricing:39` renders "we don't know" as "you have none", joining `restaurant/hours:99-103`
and `reservations.ts:147-151`. 023 §6 asked for the class to be fixed once rather than three times.
**Three sites, one shared fail-loud helper** — not three separate patches, which is how a class fix
becomes three instance fixes and leaves the fourth site for next month.

## 5. Method note

Seven of seven findings in this batch survived verification; none was refuted. That is unusual enough
to be worth recording rather than celebrating — a batch with no refutations means either high finder
precision or a verifier that is not trying hard enough, and the two look identical from the outside.
The mutations in §1 and §3 are what distinguish them: both findings were established by deleting the
guarded code and watching the test stay green, not by reading and agreeing.
