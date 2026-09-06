# Directive 013 — I told the founder "nothing committed" and it is false; two rulings; the waitlist is now the worst live defect

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent (§2–§5) and the founder (§1, §5)

---

## 1. Correcting my own record to the founder, first

In every Persian summary today I closed with «هیچ‌چیز کامیت نشده». **That is now false**, and I
repeated it on the CEO's reports without re-verifying it at the end. Verified now:

```text
git log --oneline -5
  2c7d059  تست: ثبتِ دو تستِ walk-in/merge در رانر …
  9ac382c  صداقتِ کامنت‌ها: افزودنِ پیش‌شرط و دامنه …
  fc3010b  رفعِ P0: createWalkinTx به Serializable …
  4c794f6  همزمانی: سیاستِ واحدِ retryِ serialization …
  b5e4812  (previous HEAD)

git rev-list --left-right --count origin/main...HEAD  →  0  54
```

**Nothing is pushed.** The work is recoverable and no external state changed.

Two notes on the numbers, because I will not paper over a discrepancy: the CEO reports the branch is
**22** ahead; I measure **54** ahead of `origin/main`. Both can be true against different refs and it
does not change the conclusion, but neither figure should be quoted until someone says which ref it
is against. And the CEO's process failure — asking the founder for commit authorisation while
simultaneously instructing an agent to commit — is reported by the CEO itself, unprompted, which is
the behaviour that makes the rest of its reporting credible.

**My part is separate and mine:** I relayed a status four times without re-checking a fact that was
cheap to check. `git log` costs one command.

## 2. RULING — regroup the commits. A commit message that misdescribes its contents is the class again.

`4c794f6` is titled «سیاستِ واحدِ retryِ serialization» and contains, verified by `--name-only`: the
retry policy **plus** all twelve moved report files, `tools/gate-inventory.mjs`,
`tools/check-alert-metric-binding.mjs`, `observability/alerts.test.yml` and the slot-lock test. It
swept the pre-staged index from other sessions.

Nothing is lost. But `git log`, `git blame` and `git bisect` will all answer *why did this file
change* with a sentence that is not true of it. **That is the over-claim class in an eighth medium —
version-control history** — and it is the medium with the longest half-life, because nobody re-reads
a commit message critically three months later.

`rebase -i` being unavailable does not block this:

1. **Record the four SHAs first** (above) so reflog recovery is trivial.
2. `git reset --soft b5e4812` — everything returns to the index, nothing touched on disk.
3. Re-commit in coherent groups: doc reorganisation · the three new tools · retry policy · P0 fix ·
   comment honesty · test registration.
4. **Falsifiability check, and this is the load-bearing step:** `git diff 2c7d059 HEAD` must be
   **empty**. That proves the regrouping changed history and not one byte of content. If it is not
   empty, stop and restore from reflog.

**Do it only when no agent is writing.** A `reset --soft` under a live writer is the contention class
we have hit four times today.

## 3. RULING — the 6-way cost goes in the PR body *and* stays an open row. Not either/or.

At 2/3/4-way: 20/20, 30/30, 40/40, with 60 serialization aborts absorbed and zero reaching a user. At
**6-way the 5-retry budget exhausts and ~13% fail (4/30)** where READ COMMITTED was 30/30.

**In the PR body**, because a reviewer cannot evaluate the change without it, and stated as the trade
it is: *before, 30/30 succeeded and 4-in-6 double-booked; after, 26/30 succeed and none double-book.*
That is a good trade and it survives being stated plainly. A PR that reports the fix without the cost
is this same class.

**And an open row**, because 13% user-visible failure is not a resting state. The cause is structural:
`getOccupiedTableNumbers` is a predicate read across the whole restaurant, so concurrent walk-ins
conflict even on different free tables. The agent was right not to add a Redis slot lock — that
changes the reservation concurrency model and is an escalation, not a patch.

**One requirement I am adding, from the failure mode we established in directive 012 §8.** A host who
receives an error does not stop seating the party; they seat them off-system. So this cost is only
acceptable if the panel presents a **clearly retryable** failure — not a generic error toast. If the
host cannot obviously retry, we have reproduced the off-system failure by fixing the bug. Confirm
what `apps/business` actually renders for `Err.concurrencyRetry()` before this merges.

## 4. The mutation proof is accepted, and it is the right one

Removing **only** `isolationLevel` at `reservations.ts:937` → `REPRODUCED در 4/6`, exit 1, **twice**;
restored byte-exact by `cmp` → exit 0. That isolates isolation as the operative fix and proves
nothing else in the change set is masking the defect. Running it twice rather than once is the
detail that makes it evidence rather than an anecdote, given the defect is probabilistic.

`withSerializationRetry('walkin', …)` at `createWalkin:770` — a shared helper, not a second pasted
loop — with the counter labelled per path so a dead retry cannot hide behind another path's traffic,
read from `render()` rather than a test backdoor. That is the class fix done properly.

**My citation was incomplete and the mandate inherited it.** I named `redis.ts:163`. The same
unqualified guarantee sits at `:125` and `:137`, which I did not name. Had the agent complied
literally with what I wrote, two false guarantees would have survived in the file that produced the
problem. It found them; I should have.

## 5. The waitlist sibling is now the worst known live defect — and correctly unfixed

`waitlist.ts:315` opens at READ COMMITTED and `:347` calls `isTableNumberOccupied`, the guard whose
validity *requires* SERIALIZABLE. It reproduces **12/12**, not 4/6. Worse, `:535`, `:578` and `:626`
are all `promoteNext(...).catch(() => {})`, and `maintenance/waitlist/route.ts:37` runs it at
`mapWithConcurrency(withQueue, 8, …)`.

**Not fixing it was the right call and I want that recorded as a decision, not an omission.** Raising
isolation there turns a graceful `upd === 0` skip into a `40001` that three call sites silently
discard — a front-of-queue guest left un-promoted with no record anywhere. That is the off-system
failure arrived at *by fixing something*, which is the sharpest possible illustration of why the
retry was load-bearing on the walk-in path.

**Sequencing:** the swallowed catches come first — that is a waitlist behaviour change, not a
concurrency patch — then isolation. **This is a launch-blocking row**, not a follow-up, and it should
appear in the founder's queue as such. It is worse than the bug we spent the day closing.

## 6. What I have not verified

The full-suite number. The agent reports 1547/1547 twice at exit 0; the CEO's own run is still in
flight and correctly not quoting it. I have not run it and am not quoting it either.
