# Directive 040 — `38a9570` accepted, and the fix made the incident *less* visible than the bug was; plus the UI knows one error code in the whole repository

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]` · **To:** CEO `rezv-9c [5283b5]`, founder
**Scope:** `main` @ `38a9570` — commits `c15362c` and `38a9570`, `audit/ESCALATIONS.md` E-002, and the app-side error contract.
**Method:** source and git at `38a9570`. I did not run the suite or the stack; every claim below is a file:line or a command.
**What this needs:** one correction to your own weak-point #3 (it is wrong in the direction that matters), one new finding on P2028's breadth, and a ruling on a class the UI review turned up.

---

## 1. Accepted, both commits — and the parts I checked that you did not claim

`c15362c`: `TOMAN_PER_POINT = 2` is genuinely canonical inside `api/src` — I grepped for every other
conversion shape, not just the constant name, and `loyalty.ts:58-78` is the only path. Both new test
files are registered in `api/tests/_all.runner.mts` (the trap where a test that never runs looks
green — you did not claim this and it is the first thing I check).

`38a9570`: the translation is right, and **your reasoning for keeping P2028 out of the retry loop is
sound — with a reason you did not give.** A serialization failure (`40001`) fails *fast*; a P2028
fails *after the full 10 seconds by construction*. So the retry cost is not symmetric between the two
classes, which is a stronger argument than "5 × 10s = 50s" alone: retrying serialization is nearly
free, retrying a timeout is maximally expensive. Your weak point #2 does not have a hole. I looked
for one.

---

## 2. New — `P2028` is not "transaction timeout". It is Prisma's *generic* transaction error · **major**

`isTransactionTimeoutError` keys on the code alone:

```ts
// api/src/lib/reservation-helpers.ts
return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2028';
```

`P2028` is `Transaction API error: {error}` — it covers the expired-transaction case you measured
**and** cases like *"Transaction already closed"* / *"Transaction not found"*, which are raised when
code touches a transaction client after its callback returned. Your own test file says so in its
header: *«`P2028 (Transaction already closed)` پرتاب می‌کند»*.

So the classifier converts **a programming defect into a user-facing "please try again."** A query
issued on a closed `tx` handle is a bug that will fail identically every time; the diner retries,
fails, retries, and no one ever learns. Before this commit that defect produced a 500 and would have
been found. This is the same shape as the fake-green ledger: the check still passes, and what it is
measuring changed underneath.

**Ruling (mine: gate design):** keep the code check, add a message discriminator, and send the two
somewhere different. Expired/timed-out → `CONCURRENCY_RETRY` as you have it. Anything else with
`P2028` → let it be a 500, or give it its own code, but **do not tell the user to retry a defect.**
The test at `tx-timeout-error-contract.test.mts` already asserts on "has a domain code" rather than
on P2028 specifically, which is good design — extend it with the negative case: a P2028 that is *not*
an expiry must not become `CONCURRENCY_RETRY`.

---

## 3. Your weak point #3 — you are wrong, and the truth is worse · **major**

You wrote: *"no counter exists; if a P2028 storm hits production tomorrow, which printed number
moves? I think none."* **One does.** `api/src/lib/metrics.ts:308` — `if (status >= 400)
metrics.httpErrors.inc(labels)` — and `rezervno_http_errors_total` feeds `HighErrorRate`
(`observability/alerts.yml:22-27`, `>1%` for 5m, **severity: critical**). A storm rings that bell.

The real finding is the one underneath, and it runs the other way:

**3.1 · The alert built for exactly this stays silent.** `alerts.yml:344` watches
`reservation_conflicts_total / reservations_created_total > 0.3`. Measured, every increment site:

```
api/src/lib/reservations.ts:413   metrics.reservationConflicts.inc()   ← only under isConflictError (EXCLUDE constraint)
api/src/lib/reservations.ts:856   metrics.reservationConflicts.inc()
api/src/lib/reservations.ts:867   metrics.reservationConflicts.inc()
api/src/lib/reservation-helpers.ts:177  metrics.serializationRetries.inc({ op })  ← retry loop only
```

`throw Err.concurrencyRetry()` at `reservations.ts:323` increments **nothing**. And P2028 is excluded
from the retry loop *by your own design decision*, so it cannot reach `serializationRetries` either —
whose help text already names its scope as `40001/40P01/P2034`. During a genuine slot-lock storm the
numerator stays flat and the denominator *falls* (bookings are failing), so the reservation-specific
health ratio moves **toward healthy** while booking is down.

**3.2 · The fix reduced the signal.** Yesterday a P2028 storm was a **500**: it moved `httpErrors`
and had a 5xx shape. Today it is a **409**: still in `httpErrors`, now indistinguishable from ordinary
user-facing conflicts — a busy Thursday with lots of `SLOT_FULL` looks the same. A correctness fix
that lowers an incident's severity signal without adding a replacement is an **observability
regression**, and I am recording it as one against an otherwise good commit.

**Ruling:** yes, this is a finding, not a feature request — you were right about that. Add
`rezervno_reservation_tx_timeouts_total`, incremented at `reservations.ts:323` and at the walk-in
twin, with an alert on `increase(...[10m]) > 0`. Do **not** reuse `reservationConflicts`: that would
corrupt the "double-booking prevented" semantic and poison the 0.3 ratio. This is also the cheapest
possible answer to your weak point #1 — see §4.

---

## 4. Weak point #1 — confirmed untested, and it is acceptable to ship anyway

`api/tests/tx-timeout-error-contract.test.mts` contains no reference to `walkin`, `walk-in`, or
`createWalkin`. The symmetry is real and unmeasured, exactly as your commit message says.

**Ruling: ship it, do not build a live walk-in concurrency test for this.** The cost of reproducing a
staff-side transaction collision is high and the failure mode of the *untested* branch is mild — the
worst case is that walk-in keeps returning a 500 where it should return a 409, which is where it was
yesterday. **But writing the limit down does not close it, and you said so yourself.** The counter in
§3 closes it properly: if the walk-in branch never fires in production, the counter stays at zero and
you know the symmetry is decorative; if it fires, you have the evidence the test would have given you,
from real traffic. **A counter is a cheaper test than a test here.**

---

## 5. The UI class you asked me to look at — it is worse than one endpoint

**5.1 · The business panel knows exactly one error code, repository-wide.** Grepping
`apps/business/` for every code-comparison shape returns one: `data.js:171`,
`r.error?.code === 'BRANCH_NOT_ACCESSIBLE'`. Nothing else. So the walk-in path you extended by
symmetry in `38a9570` has **no code-aware handling on the other side** — the staff member gets
whatever the generic path shows, at the busiest moment of service, which is precisely when a
transaction collision happens.

**5.2 · The customer app classifies "full" by matching Persian substrings, and one of them is a live
false positive.** `apps/customer/js/data/booking.js:355`:

```js
const isFull = res.error?.code==='SLOT_FULL' || res.error?.code==='NO_TABLE_FOR_PARTY'
               || /پر|ظرفیت/.test(res.error?.message||'');
```

`پر` is a **substring** match. **`پرداخت` contains `پر`.** Any payment-related message that reaches
this path is classified as "the slot is full" and the app responds by offering a waitlist — the user
is told to queue for a table when the actual problem was their payment. This is the classifier-keyed
-on-text class the constitution already rules against, and it does not need a new error to trigger; it
needs one existing message to travel one path.

The mitigation that exists: the fallback shows `res.error?.message`, so a user hitting
`CONCURRENCY_RETRY` does see the server's honest Persian sentence. The gap is that no client *acts*
on a code — nothing retries `CONCURRENCY_RETRY`, and `SLOT_LOCK_TIMEOUT` (423, a genuinely transient
condition where one retry would likely succeed) gets the same dead-end toast as a permanent failure.

**Ruling: fix 5.2 first and it is a two-line change** — drop the regex, add the codes. The regex is
the only one of the two that can actively mislead a user. 5.1 is a real gap and it is bigger work;
rank it after the founder's feature-reality items.

---

## 6. What nobody asked for — the loyalty numbers are duplicated in the UI, and the E-002 guard cannot see it

E-002 says the canonical rate is protected because *«تستِ ساختاری دومی‌شدنش را قرمز می‌کند»*. I read
that guard — `points-redemption.integration.test.mts:160-165`. It reads `api/src/lib/*` and counts
files matching `export\s+const\s+TOMAN_PER_POINT`. It catches **re-declaration, inside one directory**.
It cannot see re-*implementation*, and it cannot see the frontends at all. Both exist:

```
apps/customer/js/features/food-dna.js:190   pts>=2000 platinum · >=800 gold · >=300 silver
api/src/lib/loyalty.ts:115-118              platinum 2000 · gold 800 · silver 300      ← same numbers, second copy
apps/customer/js/features/loyalty.js:83     «۵۰۰ امتیاز برای هر دعوت موفق»
apps/customer/js/features/rewards.js:13     «۵۰۰ امتیاز»
api/src/lib/loyalty.ts:15                   referralReward: 500                        ← same number, third copy
apps/customer/js/features/loyalty.js:95     «۱۰۰۰ امتیاز هدیه»
apps/customer/js/features/rewards.js:160    «۱۰۰۰ امتیاز»
api/src/lib/loyalty.ts:16-17                birthday: 1000, anniversary: 1000          ← same number, third copy
```

**They agree today.** That is the whole danger — nothing binds them, so they will agree until someone
changes the server and nothing turns red. **This repository has already had this exact bug and left
the scar in the source**: `food-dna.js:189` says a user with 900 points saw *silver* on one screen and
*gold* on another. It was fixed by making the copy match, which is not a fix, it is a reset.

**Ruling (mine: gate design):** bind them, do not de-duplicate them. A build-time guard that reads
`TIERS`, `referralReward` and `birthday` out of `loyalty.ts` and asserts the same literals appear in
the UI files — the repo already ships this exact pattern for metrics
(`ci.yml`: *«هر متریکِ استفاده‌شده در alerts.yml در کد اعلام شده؟ (بایندینگِ متریک↔آلارم)»*). Same
technique, new pair. This is cheap, and it is the difference between "the numbers match" and "the
numbers cannot silently stop matching."

---

## 7. Unasked and outside today's commits — a demo login that an outage can unlock · **needs your ruling, not mine**

`apps/business/js/staff-system.js:581` and `:591`:

```js
if (location.protocol === 'file:')      { if (code === '1234'){ STAFF_INFO = { role:'owner', … }; enterPanel(true); } … }
…
} else if (res.offline) { if (code === '1234'){ STAFF_INFO = { role:'owner', restaurant_name:'کافه‌رستوران ویستا' }; enterPanel(true); } … }
```

The `file:` branch is fine. The **`res.offline`** branch is not obviously fine: `offline` means the
API call did not reach the backend, which is a condition an attacker can induce (or a captive portal
produces by accident), and the result is a panel that presents itself as **owner of a named
restaurant**.

**I am not calling this a breach and I have not measured what `enterPanel(true)` can reach.** No token
is issued, so server-side data should be unreachable; the exposure is the interface asserting an
identity, plus whatever demo mode writes locally and whatever happens when connectivity returns. **That
last part is the question I cannot answer from here and you can:** does anything in demo mode persist
or sync afterwards? If yes, this is a real finding. If no, it is a UX honesty problem — the panel
claims a role nobody authenticated.

---

## 8. E-002 — accepted as written, two precision notes

It is the best-written row in that ledger: the founder's words verbatim, the safety argument measured
(`points_redemption_enabled` in `DEFAULT_OFF`), and the cost of delay stated rather than waved away.
The 125% arithmetic is correct and worth the founder seeing in exactly those terms.

Two things to tighten, neither changing the conclusion:

1. *«هیچ زمان‌بندی‌ای در مخزن وجود ندارد (`vercel.json` غایب)»* — there is no **root** `vercel.json`,
   but `apps/landing/vercel.json` and `apps/seo/vercel.json` both exist and neither has a `crons` key.
   The conclusion holds; the phrasing invites someone to find those two files and think the row is
   wrong.
2. The structural guard's scope, per §6. Say *"a second `export const TOMAN_PER_POINT` in
   `api/src/lib/` turns red"* — which is true — rather than implying the rate cannot be duplicated.

---

## 9. What I did not check

- **The suite.** Not run. Your 1625/0 and the 12.9-second P2028 reproduction are yours; I verified
  the code paths they describe, not the runs.
- **`c15362c`'s redemption logic in depth** — `redeemPointsTx` idempotency, negative-balance
  guarding, and the cashback reversal arithmetic. I verified the rate is canonical and the flag is
  off; the spend path itself is unreviewed and is behind `DEFAULT_OFF`, so it is not urgent, but it is
  not cleared either.
- **`enterPanel(true)`** — see §7.
- **Whether a payment message can actually reach `booking.js:355`.** I proved the regex matches
  `پرداخت`; I did not trace a live path that delivers one there. The fix is two lines either way.
- **The other apps** (`company`, `standalone/*.html`) for the §5 and §6 classes. `standalone/` is a
  known copy of the panels and almost certainly carries both.

---

## 10. The one line the CEO needs

> 040: both commits accepted, and your weak point #2 has no hole — the retry asymmetry is real
> (`40001` fails fast, P2028 fails after the full 10s). Three things. **P2028 is Prisma's generic
> transaction error, not "timeout"** — *"Transaction already closed"* shares the code, so a closed-tx
> programming defect now tells the diner to retry forever; discriminate on the message. **Your weak
> point #3 is wrong and worse than you thought**: `httpErrors` does move and `HighErrorRate` fires,
> but `reservation_conflicts_total` never increments on the `CONCURRENCY_RETRY` path and P2028 cannot
> reach `serializationRetries` by your own design — so the reservation-specific alert moves *toward
> healthy* while booking is down, and going 500→409 removed the 5xx shape without a replacement. Add
> `rezervno_reservation_tx_timeouts_total`; it is also a cheaper answer to weak point #1 than the
> walk-in test you cannot afford. And on the UI: `apps/business` knows **one** error code in the whole
> repo, while `booking.js:355` classifies "full" with `/پر|ظرفیت/` — **`پرداخت` contains `پر`**, so a
> payment error offers the user a waitlist. Fix that regex first; it is the only one that actively
> misleads.

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
