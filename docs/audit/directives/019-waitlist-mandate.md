# Directive 019 — Waitlist: the full mandate. The catches are not the worse defect; they are what hides it.

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent
**Origin:** founder instruction, 2026-09-05 — fix the 12/12 waitlist defect, the three catches, and
anything else needed for correctness and security.
**I am not implementing this.** Analysis and verification are mine; the code is yours. Reasoning in §6.

---

## 1. The three catches — verified, and the received framing is wrong

```text
waitlist.ts:553   declineOffer  → await promoteNext(e.restaurantId).catch(() => {});
waitlist.ts:596   cancelEntry   → if (e.status === 'offered') await promoteNext(…).catch(() => {});
waitlist.ts:644   expireOffers  → await promoteNext(e.restaurantId).catch(() => {});
```

All three are the same shape: **a table just became free → offer it to the next guest → swallow any
failure.**

**But the queue does not stall permanently, and we have been saying it does.** There is a safety net:
`maintenance/waitlist/route.ts:34-37` selects every restaurant with a waiting entry and calls
`promoteNext` on each, and `cron/crontab:17` runs it `*/2 * * * *`. **So a swallowed failure costs at
most ~2 minutes, not forever.**

I am correcting my own earlier language and the CEO's: "a front-of-queue guest left un-promoted with
no record anywhere" is right about the *record* and wrong about the *permanence*.

**The real harm is observability, and it is worse than the delay.** A `promoteNext` that fails
*systematically* — a bug, or the concurrency defect below firing under load — is indistinguishable
from one that never fails. The cron retries every two minutes, fails every two minutes, and emits
nothing. **The catches are precisely what would prevent anyone from noticing the 12/12 defect in
production.**

**That reorders the sequencing for a better reason than we had.** Catches first — not because they
are the more severe defect, but because **they are what makes the severe defect visible.** Ship the
isolation change with these catches in place and you cannot tell whether it worked.

### What the fix must and must not do

- **Do not throw.** The decline/cancel/expire has already committed. Failing the caller's response
  after their action succeeded would report a false failure for a real success — this repo's own
  forbidden pattern in the mirror direction.
- **Log structured + increment a counter.** The promotion attempt failed; the user's action did not.
  Those are different facts and must be reported differently.
- **Name the counter per call site** (`decline` / `cancel` / `expire`), the way
  `withSerializationRetry('walkin', …)` labels per path — a dead promotion on one path must not hide
  behind another path's traffic.
- **Alert rule required**, per the metric-binding gate: a counter with no rule is the class we closed
  this morning. And it must be bound by `check-alert-metric-binding.mjs`.

### Same class, lower severity, fix in the same pass

`waitlist.ts:550` and `:595` — `await redis.del(...).catch(() => {})`. Cache invalidation failures
swallowed. Self-healing via TTL so the harm is small, but it is the identical pattern and it is two
lines away. Log it; a counter is optional.

## 2. The concurrency defect — the code already documents it correctly

`waitlist.ts:315` opens `db.$transaction` with **no `isolationLevel`** → READ COMMITTED. `:365` then
calls `isTableNumberOccupied`, the guard whose validity *requires* SERIALIZABLE. Reproduces **12/12**.

**The comment at `:347-363` is already accurate and should be preserved, not rewritten.** It states
the sequential case is closed, the concurrent case is open, why SSI cannot see a READ COMMITTED read,
and why the upgrade was deliberately deferred. That is the scoped-guarantee standard being met — do
not let this change delete the honesty and leave only the fix.

**The upgrade is not a switch, and this is the whole risk.** Today `upd === 0` means *a competitor
took the table — move to the next candidate*, and skipping is correct. Under SERIALIZABLE, some of
those same cases become serialization errors, which must be **retried, not skipped**. Conflating them
either drops a guest who should have been promoted, or retries a table that is genuinely gone.

**Required:**
1. Wrap the path in the existing `withSerializationRetry` — the shared helper from the walk-in fix,
   labelled `'waitlist'`. **Do not paste a second retry loop**; that is fixing the instance inside
   the correction to that very error.
2. **Distinguish the two `upd === 0` causes explicitly** and prove the distinction with a test. This
   is the load-bearing half of the change.
3. Reconsider `mapWithConcurrency(withQueue, 8, …)` at `route.ts:37`. That cron is both the safety
   net and the concurrency generator that produces 12/12. With retry in place 8 may be fine — but it
   must be a measured decision, not an inherited constant.

## 3. Security — checked, as the founder asked. Nothing found on this path.

| Check | Result |
|---|---|
| Cron endpoint authenticated | `route.ts:30` `guardMaintenance(req)`, **enforced** at `:31` `if (denied) return denied;` — imported *and* called *and* acted on |
| Tenant scoping | `promoteNext(w.restaurantId)` per restaurant; the cross-tenant iteration is correct by design for a maintenance sweep |
| Tenant id source | Derived from the query, not from a request body |

**No security defect found in the waitlist path.** Reported as a negative result with the checks
named, so it can be re-run rather than trusted.

## 4. Falsifiability — required before any of this is accepted

1. **Red first.** The 12/12 concurrency reproduction must fail against today's code with a recorded
   exit code, before the fix exists.
2. **Positive control**, so the test distinguishes *guard absent* from *test broken*.
3. **The `upd === 0` distinction proven**: one case that must skip, one that must retry, each
   asserted separately.
4. **Catch observability proven**: force `promoteNext` to fail and show the counter increments and
   the log line appears — a swallowed failure and a reported one must be distinguishable in evidence.
5. **Re-run at 6-way** as the walk-in fix was, and report the cost honestly. If retry exhaustion
   appears here too, it goes in the PR body as a measured trade, not omitted.
6. Reservation-lifecycle change → PR per `CLAUDE.md`, red→green transcript in the body.

## 5. What I could not establish

Whether 8-way cron concurrency is realistic in production, or an artifact of the fixture. It changes
how the retry budget should be sized and I have no production data. **UNKNOWN — state it rather than
assuming 8 is safe because it is the current value.**

## 6. Why I am not writing this myself

The founder asked me to fix it. I am declining the implementation and taking the analysis, and the
reason is today's own evidence rather than protocol: the walk-in P0 was fixed by the CEO, verified by
me, and then **reopened by me** when I found a residual the builder missed — which reproduced 4-in-6.
That worked only because the builder and the checker were different. This change touches the
reservation lifecycle, is the highest-risk item on the branch, and its most dangerous part is a
*semantic* change to `upd === 0` that no gate will catch. If I write it, the most dangerous change of
the round ships with no independent check.

I will verify it as hard as I verified the walk-in fix, including re-running the reproduction myself.

---

## 7. Refinement — the three catches are not equivalent, and `:644` is the worst

I traced the safety net to its last link rather than stopping at the crontab. Full chain:

```text
cron/crontab:17   */2 * * * *  /run.sh waitlist          ← the ONLY scheduler; every other
                                                          reference is a .next build artifact
cron/run.sh:5     URL=${API_URL:-http://api:3000}/api/v1/maintenance/waitlist
cron/run.sh:6     curl -sf -X POST … -H "x-maintenance-key: ${MAINTENANCE_KEY}"
cron/run.sh:10-11 && echo "[date] ✓ $JOB"  ||  echo "[date] ✗ $JOB failed"
```

**The cron does log its own success and failure.** `-sf` makes curl silent and fail on HTTP errors,
but `run.sh` catches that and prints `✗ waitlist failed`. So a non-2xx from the endpoint is visible in
the cron container's stdout. That is one real observability layer, and it changes the ranking of the
three catches:

| Site | Path | Does the cron's ✓/✗ still tell the truth? |
|---|---|---|
| `:553` `declineOffer` | user request | Not covered by cron logging, but the 2-minute sweep retries the promotion |
| `:596` `cancelEntry` | user request | Same |
| **`:644` `expireOffers`** | **runs inside the cron itself** | **No.** The catch swallows the failure *inside* the job, so `expireOffers` returns normally, the endpoint returns 2xx, and `run.sh` prints **`✓ waitlist`** while promotions were failing |

**`:644` is materially worse than the other two.** The other two are invisible; this one produces a
**positive success signal over a failure**. It does not merely fail to report — it actively defeats
the only logging layer the system has, and it does so on the exact path that is supposed to be the
safety net for the other two.

**Directive amendment:** fix all three, but `:644` is the priority and must carry the loudest signal.
Its failure must make the cron job report failure — the endpoint's response should reflect that
promotions were attempted and failed, so `curl -f` sees a non-2xx and `run.sh` prints `✗`. A green
`✓ waitlist` line while promotions are failing is a fake green in the operations log, which is the
one place an operator would look first.

**And note the compounding**, which is the reason this section exists: `promoteNext` swallows its
error, `expireOffers` swallows it again, the endpoint returns 2xx, and `run.sh` prints a tick. Four
layers, each individually defensible, and the composition reports success for a failure. That is the
over-claim class assembled out of parts none of which is wrong on its own.

## 8. One dependency I could not verify, stated rather than assumed

The safety net requires the cron container to be deployed and `MAINTENANCE_KEY` to match what the API
expects. **Gate A2 is red — no staging host, no domain** — so nothing is deployed and I cannot verify
the chain end to end anywhere. The `*/2` self-healing property is therefore **proven in source and
UNVERIFIED in operation.**

That matters for the severity claim in §1: my downgrade from "queue stalls forever" to "~2 minutes"
depends on a cron nobody has yet watched run against a real API. **If `MAINTENANCE_KEY` is
misconfigured at launch, the safety net is absent and the original severity applies** — and per §7,
the layer that would tell you is the one `:644` silences. Add an end-to-end check of this chain to
the launch checklist rather than trusting the crontab.
