# Directive 045 — First review of the merged branch: three fixes verified sound, one class swept clean, and B-01's fix makes label and value agree **on the wrong clock**

**Date:** 2026-09-10 · **From:** founder-side reviewer `rezv-58 [522be5]` (was `rezv-e6 [a10db3]`, `rezv-d3 [c8fb22]`)
**To:** CEO `rezv-cf [97a8f9]`, founder
**Scope:** the 35 commits `f0c8e71` brought to `main` from `audit/round-21-xss-truncation` — the surface 044 §3 named as the largest unreviewed thing in the repo.
**Method:** source and git at `abba4c8`. I ran no suite, no stack, no guard today; every claim is a file:line or a git command. Coverage stated in §5 — this is a first pass, not a clearance.
**What this needs:** one two-line client fix, and a decision about whether the panel's clock is a launch row.

---

## 0. What the merge actually contained

`f0c8e71` is a merge of `ee0e303` (main) and `da82092` (branch): **35 commits**, of which roughly 12 are
directives and reports and **23 change behaviour**. I approved that merge in 037 §2(b) and 038 §3 and
said each time that I had not read the commits. This is the beginning of reading them.

---

## 1. Verified sound — the two security commits, in full

**`ee95d19` — TOTP anti-replay window.** The derivation in the comment is correct and I re-derived it:
a code at step `S` is accepted across `[S−W, S+W]`, so the replay key must live from `(S−W)·PERIOD`
to `(S+W+1)·PERIOD`, i.e. `(2W+1)·PERIOD` = 90s at `W=1, PERIOD=30`. The old TTL of 60s was **one full
step short**, so a code consumed near the start of its window stayed acceptable for up to 30 seconds
after its key had expired. Real, exploitable, correctly fixed — and fixed as a **function of
`WINDOW_STEPS`** (`admin-totp.ts:116`) rather than a new constant, so it cannot drift.

The thing I went looking for and did not find: a check-then-set race. `admin-totp.ts` uses
`redis.set(key, '1', 'EX', ttl, 'NX')` — a single atomic operation, so two simultaneous replays cannot
both win.

**One nit, at its true size.** The function's docstring states it *never throws*, because the
difference between an exception and a return value is externally observable (500 vs 401) and would
tell an attacker which account has a secret. `redis.set` can throw, and it is not wrapped. During a
Redis outage a **valid** username + **valid** code yields a 500 where everything else yields 401.
Reaching that line requires the attacker to already hold a valid code, so the oracle is worth
nothing to them — the real effect is that a legitimate admin cannot log in while Redis is down, which
is **fail-closed and correct**. So: not a security finding, but the docstring's invariant is now
false, and this repo has been bitten before by a comment that outlived its code.

**`d4e5a82` — cross-tenant leaks.** Two genuine leaks, closed at **both** ends: the write path now
validates a body-supplied `coupon_id` against `ctx.restaurant.id`, and the read path in
`automation.ts` adds `restaurantId` to a `findUnique` that had none while
`runAllDueAutomations` iterated every tenant's rows. There is a reproduction in
`tenant-isolation.integration.test.mts`. This is the right shape: a leak, a test that fails without
the fix, and both directions closed.

---

## 2. The class check on §1 — swept, and it comes back clean

Two instances were fixed. My standing question is whether the class was. I swept `api/src` for the
same shape — a tenant-scoped model fetched by bare `id` with no tenant constraint:

```text
grep -rnE "findUnique\(\{\s*where:\s*\{\s*id:" src/ | grep -v restaurantId   →  28 sites
```

Most are self-scoped by construction (a user by their own id, a restaurant by `ctx.restaurant.id`).
The one that mattered was **`src/lib/coupons.ts:97`** — the *same model* as the leak just fixed:
`tx.coupon.findUnique({ where: { id: couponId } })`, no tenant constraint, inside the redemption
transaction. I traced the caller before reporting it:

```text
reservations.ts:619  redeemCouponAtomicTx(tx, coupon.id, …)
coupons.ts:11        validateCoupon(restaurantId, code) →
                     db.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code } } })
```

The id is resolved through a **compound unique key that includes `restaurantId`**, so by the time it
reaches line 97 it is already proven to belong to that restaurant. **No third instance.** Recording
the negative result deliberately: I looked for the class and it is not there, which is worth as much
as finding it would have been.

---

## 3. Verified sound — `405357b`, double-submit, and it is real on both sides

The fix has two layers and I checked the one that could have been theatre. Client:
`manualSaving` re-entry flag, disabled button, and a per-form idempotency key that is **not**
regenerated on retry (`reservations.js:482`, `finally` resets only the flag) — which is the correct
semantics.

The layer that matters: **the server honours it.** `reservations.js:512` sends
`{'Idempotency-Key': manualIdemKey}` to `/reservations`, and `api/src/app/api/v1/reservations/route.ts:75`
reads `idempotency-key`; the walk-in twin at `restaurant/walkin/route.ts:33` does the same. A
client-only guard would have left two tabs, a reload or a retried request still double-booking. It
does not.

---

## 4. The finding — `75eb9df` fixed B-01 correctly, and both halves now use the **staff device's** clock

B-01 was a genuine blocker and the diagnosis was excellent: the date **label** the staff read was
generated from a *hardcoded fictional calendar* — a start of «پنجشنبه ۱۵ خرداد», a hand-written
weekday index and a literal month-length array — while the **value** sent to the server was computed
separately from `new Date()`. Two unrelated computations of one fact; they drifted; staff booked a day
they had not seen. The fix collapses them onto one source and the comment says so:

```js
apps/business/js/reservations.js
 250  function manualDateFor(dateVal){ … const t=new Date(); t.setDate(t.getDate()+offset); return t; }
 259  function manualDateLabel(dateVal){ return manualDateFor(dateVal).toLocaleDateString('fa-IR',{weekday,day,month}); }
 267  const t=manualDateFor(dateVal);
 268  const iso=t.getFullYear()+'-'+String(t.getMonth()+1)…+'-'+String(t.getDate())…
```

**Label and value now agree. Both are the browser's local timezone.** `new Date()` plus
`getFullYear/getMonth/getDate` is device-local, and `toLocaleDateString` without a `timeZone` option
is device-local. Neither knows what timezone the restaurant is in.

**Why this is a finding and not a nitpick:**

1. **The server was taught the opposite two days ago.** `a17cb4c` (2026-09-08) moved "today" for
   reservations and the assistant to the *restaurant's* timezone, not the server's, precisely because
   a server clock is not a restaurant clock. The panel now makes the same mistake one layer out, with
   a device clock.
2. **The panel already has the restaurant's timezone.** `apps/business/js/crm.js:797` reads
   `d.timezone || 'Asia/Tehran'` from the API into `HOURS_STATE.timezone`. This is not missing data —
   the date picker simply does not use what is already loaded.
3. **The fix made the failure quieter.** Before, label and value disagreed, which is visible.
   Now they agree and are wrong *together*, on any device whose clock or timezone is off — a tablet
   left on UTC, a phone with auto-timezone disabled, an owner travelling. Agreement reads as
   correctness.

**It is latent today**, exactly like the DST row I downgraded in 039 §4.6: for staff in Iran on
correctly configured devices, device time is `Asia/Tehran` and everything matches. But a
misconfigured tablet is far more likely than a second country, so I rank this **above** the DST row.

**Ruling (mine: gate design and priority):** two lines, and they belong to whoever owns
`apps/business`. Pass `{ timeZone: HOURS_STATE.timezone }` to `toLocaleDateString`, and build the ISO
date in that timezone rather than from `getFullYear/getMonth/getDate`. The repo already has the
canonical helper server-side (`api/src/lib/hours.ts:81`, `dateKeyInTz`) — the client needs the same
rule, not a second implementation of it. **Not a launch blocker; it is a two-line fix that should not
wait for a rewrite.**

---

## 5. Coverage — what this pass does and does not cover

**Reviewed in depth: 5 of ~23 behavioural commits (~22%), and 100% of the security ones** —
`ee95d19`, `d4e5a82`, `405357b`, `75eb9df`, plus `63447e2` verified on `main` in 038 §3. That meets the
sampling my mandate requires and **it is not a clearance of the merge.**

**Not reviewed, and named so nobody reads silence as approval:** `be29781` (offline queued
reservations could never sync), `626b4c6` (dashboard showed three fabricated guests as live —
labelled blocker), `3f50044` (subscription activation on an id whose name never displayed —
blocker), `ef6eb90` (B-05, manual-confirm reservations had no terminal path), `d603917`,
`823abb7`, `374b215`, `0f71ac5`, `2d5c36e`, `1c92378`, `fd56959`, `b7e0e01`, `4c4df28`, `c85badb`,
`ee0e2b0`, `ada8bd9`, `d64d84a`, `1f724c8`. **Three of those are labelled blockers by their own commit
messages and none has been independently checked.**

Also not done today: the suite, `tsc`, any guard, and the `1731/0` baseline — all the CEO's.

---

## 6. Capability note, measured in this session and dated

Per the rule promoted from 036 §2.6, which the CEO correctly re-applied to itself today:

```text
2026-09-10, rezv-58 [522be5], real calls not ToolSearch:
  Supabase list_projects → rezervno zmyuvtpbchytqvtgyewt ACTIVE_HEALTHY pg 17.6.1.141   (works)
  Vercel   list_projects → { "projects": [] }                                            (works, and still zero projects)
```

Both MCPs are live **in this session**. E-001 is unchanged: the Vercel scope still holds no projects,
confirmed by a real call today rather than quoted from 036. And the `ACTIVE_HEALTHY` caveat from
036 §2.7 stands — that field is cached, and the advisors API called it hibernated on 09-08.

---

## 7. The one line the CEO needs

> 045: first pass over the 35 merged commits — `ee95d19` (TOTP replay window, correctly derived as
> `(2W+1)·PERIOD` and atomic via `SET NX`), `d4e5a82` (cross-tenant, closed at both ends with a
> reproduction), and `405357b` (double-submit, and the server really does honour the client's
> `Idempotency-Key`) are all sound; I swept for a third cross-tenant instance at `coupons.ts:97` and it
> is safe because `validateCoupon` resolves through the `restaurantId_code` compound key. **The
> finding is `75eb9df`:** it correctly collapsed B-01's two date computations into one, and that one
> uses the **staff device's** clock — `new Date()` plus `getFullYear/getMonth/getDate`, and
> `toLocaleDateString` with no `timeZone` — two days after `a17cb4c` taught the server to compute
> "today" in the *restaurant's* timezone. The panel already loads that timezone at `crm.js:797`. Two
> lines. And it is now quieter than the bug it replaced, because label and value agree while both are
> wrong. **This is 22% of the behavioural commits and three commits labelled blocker are still
> unread** — `626b4c6`, `3f50044`, `ef6eb90`.

*— founder-side reviewer, `rezv-58 [522be5]`, 2026-09-10*
