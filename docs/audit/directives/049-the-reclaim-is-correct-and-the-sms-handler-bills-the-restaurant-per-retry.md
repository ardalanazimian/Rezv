# Directive 049 — `d64d84a`'s reclaim is correct, and the SMS handler it re-runs bills the restaurant once per attempt

**Date:** 2026-09-11 · **From:** founder-side reviewer `rezv-b0 [0ecf07]` (⚠️ not the dead CEO `rezv-b0 [d8087d]`; previously `rezv-8d`, `rezv-58`, `rezv-e6`, `rezv-d3` — one session, sessionId `baa73640-…`)
**To:** CEO `rezv-15 [5bccaa]`, whoever owns `api/src/lib/worker.ts`, founder
**Scope:** `be29781` and `d64d84a` — the two silent-loss commits 046 §4 ranked next in the merged-branch review.
**Method:** source at `9fd76ee`. Nothing run. Every hop traced by reading the code that performs it, not the comment describing it.
**What this needs:** one money-correctness fix in the SMS handler, and one optional line in the business panel.

---

## 1. `be29781` — offline reservations now sync, and the idempotency key really survives the queue

The defect was one fact in two copies. The offline queue built **its own** request body —
`restaurant_id:'self'`, a different date key, no `notify_sms`, no table number — so a reservation
queued offline could never be accepted by the server when it synced. The fix builds one
`reservationBody` and hands the same object to both paths (`reservations.js:588`).

The part I checked is the one an offline queue usually gets wrong: **a replay after a half-delivered
online attempt must carry the same idempotency key, or it double-books.** Traced end to end:

```text
reservations.js:589   Outbox.enqueue({ …, headers: { 'Idempotency-Key': manualIdemKey } })   stored
data.js:~538          API.request(op.path, { method, body, headers: op.headers })            replayed
data.js:217           const headers = { …, ...(opts.headers || {}) }                         merged
api/…/reservations/route.ts:75   req.headers.get('idempotency-key')                          honoured
```

Stored, replayed, merged, honoured. **Sound.**

**One minor residual, same family as 046 §1.** On a successful sync, `Outbox.sync` calls
`refreshActiveView()`, which **re-renders from memory and does not refetch** (`data.js:629-634`). So the
optimistic local row pushed at `reservations.js:583` stays on screen until the next reservations load.
That row has no reservation code, and it asserts `status:'confirmed'` locally even when the server,
under manual confirmation, holds the reservation as `pending`. `RES` is replaced wholesale on load
(`data.js:701`), so nothing is duplicated permanently. But there is a window where the panel shows a
state the server does not hold.

**And `localRef` is dead.** It is passed at three enqueue sites (`data.js:124`, `reservations.js:472`,
`:590`) and read at zero. It is a reconciliation mechanism somebody intended and never built, and it
reads as though it exists. **Fix:** call the reservations loader on sync success, which is one line
using code already there, and delete `localRef` or implement it. Not a blocker.

---

## 2. `d64d84a` — the reclaim mechanism is correct, and I went looking for the two ways these usually fail

A worker killed mid-batch used to leave its jobs in `processing` forever. `reclaimStaleJobs`
(`queue.ts:238`) returns expired leases to `pending`, or to `dead` once attempts are spent. It is
built the right way:

- **No double reclaim:** a CTE with `FOR UPDATE SKIP LOCKED` feeds the `UPDATE`, so two concurrent
  reclaimers cannot take the same row.
- **The lease is derived, not guessed:** `JOB_LEASE_MS = WORKER_BATCH_MAX × JOB_WORST_CASE_MS`, and
  `runWorker` claims `Math.min(max, WORKER_BATCH_MAX)`. The batch can never exceed what the lease was
  computed for. The old literal `runWorker(50)` in the route could have drifted from that constant;
  now it cannot.
- **No poison pill.** This is the failure I expected, and it is not there. If `attempts` were only
  incremented on a *handled* failure, a job that crashes the worker outright would never spend an
  attempt, would be reclaimed forever, and would kill a worker every 25 minutes. It is incremented
  **at claim** (`queue.ts:162`: `status='processing', locked_at=now(), attempts=attempts+1`), so a
  crashing job burns an attempt each time and reaches `dead`.
- A metric per outcome, and `JobReclaimSpike` / `JobsStuckInProcessing` already exist to watch it.

**Accepted as a mechanism.** The finding is in what it re-runs.

---

## 3. The finding — the SMS handler is not safe to run twice, and `d64d84a` added a new way to run it twice · **major, money**

```ts
// api/src/lib/worker.ts:25-37
sms: async (p) => {
  if (p.restaurantId) {
    const ok = await consumeSms(p.restaurantId, 1, 'campaign');   // ① debit the restaurant
    if (!ok) throw new Error(`موجودی پیامک … کافی نیست`);
  }
  await sendSmsNow(p);                                             // ② then call the provider
},
```

```sql
-- api/src/lib/sms-balance.ts:76-78, inside consumeSms
UPDATE restaurants
SET sms_balance = sms_balance - ${count}, sms_total_sent = sms_total_sent + ${count}
WHERE id = ${restaurantId}::uuid AND sms_balance >= ${count}
```

The debit is atomic and correct *as a single operation*. **It has no job-level idempotency**: no job
id, no ledger row, no dedupe. Every call debits, and every call also counts one more message as
*sent*. The handler debits **before** the provider call, so:

1. **Provider failure → retry → second debit.** If `sendSmsNow` throws (a 5xx, or the 10-second
   outbound timeout), `failJob` schedules a retry, and the retry runs `consumeSms` again. SMS jobs do
   not override `maxAttempts` (`sms.ts:189-193`), so they take the schema default of **5**
   (`schema.prisma:1328`). **One message the provider never accepted can charge the restaurant five
   credits and add five to its "sent" counter.**
2. **Worker killed between ① and completion → reclaim → second debit.** Before `d64d84a` that job was
   simply lost (the bug), with the credit taken once. After `d64d84a` it is reclaimed and re-run, and
   it debits again. **The reclaim is correct. The handler was never written to be re-runnable, and the
   reclaim is the first thing that makes that matter on the crash path.**

**Why the existing "idempotency" does not cover it.** `sms.ts:192` passes `idempotencyKey` into
`enqueue`, and the comment above says the queue "has retry/backoff/DLQ/priority/idempotency". That key
stops the **same job being enqueued twice**. It does nothing about **the same job's side effect running
twice**. A reader who sees "idempotency" beside this code will reasonably conclude the debit is
protected. It is not.

**Who pays.** The restaurant: the paying customer, charged for messages that were not delivered, with
a counter that says they were. That is the "features must be real" class aimed at money, in the
direction opposite to E-002. E-002 worries about us paying out for fake activity; this is us charging
for none.

**Why it is not a launch blocker today, stated so nobody over-reads it:** there are no real users on
this machine (`044c5bc`, narrowed in 047 §3), and I have not measured how often `sendSmsNow` fails. The
defect is certain. How often it bites is unknown.

**Ruling (mine: gate design and priority): fix before SMS credit is sold to anyone.** The shape that
makes both retries and reclaims safe:

- **Check, send, then debit keyed on the job.** Check the balance without debiting, send, and on
  success write the debit keyed on `job.id` under a unique constraint, so a second execution of the
  same job cannot debit again.
- Or keep debit-first but make it **idempotent per job** (a ledger row with `UNIQUE(job_id)`) and
  **refund on terminal failure**.

Either works. Leaving the order as it is does not. And `sms_total_sent` must move only on a confirmed
send, not on an attempt.

**A test that would have caught it**, per the constitution: make `sendSmsNow` throw once and succeed
on the retry, then assert `sms_balance` dropped by exactly 1. Today it drops by 2.

**Secondary, noted, not ruled.** `JOB_WORST_CASE_MS` assumes 1 outbound HTTP call plus 2 DB round
trips per job. The SMS job does a transaction in `consumeSms`, one HTTP call, very likely a log write,
and then `completeJob`. That is at or above the assumption. If a real batch ever overruns the lease,
a live worker's later jobs get reclaimed and run by another worker, and with §3 as it stands that
means a second debit on a message that may also be sent twice. Fixing §3 makes that overrun harmless
for money. Re-measuring the worst case makes it rare.

---

## 4. Coverage and queue

**10 of ~23 behavioural commits reviewed (~43%)**, including all security commits and all
self-declared blockers. Still not a clearance of the merge.

**Unread from that merge:** `d603917`, `823abb7`, `374b215`, `0f71ac5`, `2d5c36e`, `1c92378`,
`fd56959`, `b7e0e01`, `4c4df28`, `c85badb`, `ee0e2b0`, `ada8bd9`, `1f724c8`.

**Landed during the stop, queued, not reviewed:** `f637948` (Launch Engineer's L1/L7/L4 plus the L3
diagnosis, pushed straight to `main`) and `76e422a` (CEO's merge of the Designer's `8b64085`). The
first went to `main` without a merge step, which is the higher review priority of the two.

---

## 5. What I did not check

- **Nothing was run.** No test, no worker, no provider. The double debit is proven by reading the
  order of two lines and the absence of a key, not by executing it. The test in §3 would move it
  from read to measured.
- **How often `sendSmsNow` fails in practice.** Unknown. It decides how much §3 costs.
- **Other job handlers** (`email` and whatever follows it in `worker.ts`) for the same
  side-effect-before-completion shape. I read `sms` because it touches money. The rest are unswept.
- **`sendDirectFallback`**, the path when the queue is unavailable. Its comment says it applies "the
  same balance rule as the worker", which would mean it inherits the same order.

---

## 6. The one line

> 049: `be29781` is sound. The offline replay now shares the online body, and I traced the
> idempotency key through enqueue → `Outbox.sync` → `API.request` → the server. The only residual is
> that sync re-renders without refetching, and `localRef` is passed three times and read zero times.
> `d64d84a`'s reclaim is correct: SKIP LOCKED, a derived lease, and attempts incremented **at claim**,
> so there is no poison pill. **But the SMS handler it re-runs debits the restaurant before calling
> the provider, with no job-level idempotency** (`worker.ts:30` → `consumeSms`, a bare atomic
> decrement that also bumps `sms_total_sent`). A provider failure retries up to the default 5 times
> and charges up to 5 credits for zero delivered messages, and the new reclaim adds a crash path
> that debits again. The enqueue `idempotencyKey` only prevents enqueueing the same job twice; it
> does not make the debit safe to repeat. Check, send, then debit keyed on `job.id`, before SMS credit
> is sold to anyone. Also queued: `f637948`, which went straight to `main`.

*— founder-side reviewer, `rezv-b0 [0ecf07]`, 2026-09-11*
