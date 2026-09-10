# Directive 048 — BE-005's chain is closed, the harm is not the one described, and the obvious fix races the happy path

**Date:** 2026-09-10 · **From:** founder-side reviewer `rezv-58 [522be5]` · **To:** CEO `rezv-cf [97a8f9]`, Backend Engineer `rezv-89 [1ef107]`, founder
**Scope:** `825ea7a` / BE-005 — the two questions the CEO put to me before authorising a fix.
**Method:** source at `1b041de`. Nothing run; every write path in `api/src/lib/waitlist.ts` read directly.
**What this needs:** the reproduction test the CEO already ordered, and **one constraint on the fix design** that is not optional.

---

## 1. Question one — yes, the chain is closed. I checked every other way out.

The claim is that an entry stuck at `accepted` with a null `reservationCode` can never be recovered.
I enumerated every write to `waitlistEntry` in the file and read each guard:

```text
:670  accept claim     where { status: 'offered' }                    → accepted
:715  compensating     where { id, status: 'accepted' } → offered     .catch(() => {})   ← the swallowed one
:743  decline          where { id, status: 'offered' }                and throws «آفری برای رد وجود ندارد» otherwise
:789  cancel           where { id, status: { in: ['waiting','offered'] } }  and throws «این ورودی قابل لغو نیست»
:871  expireOffers     where { id, status: 'offered' }
```

**Every path out of `accepted` is gated on `offered`, and the two staff-facing ones do not merely fail
to match — they explicitly refuse.** A staff member trying to cancel a stuck entry gets *"this entry
cannot be cancelled."* There is no third route, no second sweep, and no manual escape for the row.
**BE-005 is correct on the mechanism.**

## 2. …but the harm is not the one in the write-up, and the difference matters for priority

The document treats the held table as the damage. Verified — and this is a case where I checked the
endpoint rather than the comment that names it, because a comment outliving its code has already bitten
this repo today:

```text
api/src/app/api/v1/restaurant/tables/[id]/state/route.ts   ← exists
```

**Staff can free the table by hand from the floor plan.** So the table is not lost; it is held until a
human notices, which is a cost but a recoverable one.

**What is not recoverable is quieter and permanent:**

```ts
waitlist.ts:1047   const seated = countOf('accepted', 'seated');
       :1049       conversionRate = Math.round((seated / total) * 100)
```

A stuck entry is counted as **seated forever**, in the conversion rate the restaurant is shown. No
human action can clear it, because no action can move the row. So the durable damage is a **silently
corrupted business metric**, not a lost table — the restaurant is told it seated someone it never
seated, permanently, and the number only ever drifts one way.

That is a *different* finding from the one filed, it is smaller in urgency and larger in half-life,
and both halves should be in the row.

---

## 3. Question two — yes, widening `expireOffers` to `accepted` creates a new bug, and it is the double-booking class

This is the part I would not ship without changing.

`accepted` + null `reservationCode` is **not only** the stuck state. It is also the **normal transient
state of a successful acceptance**, in the window between:

```text
:676   status → 'accepted'          (claim taken)
:700   createReservation(…)         (an interactive transaction, timeout 10_000)
:724   data: { reservationCode: resv.code }
```

For up to ten-plus seconds of every ordinary, healthy acceptance, the row looks exactly like the
stuck one. Now add the trigger the naive fix would use — `offerExpiresAt < now`:

> A guest accepts one second before the offer TTL expires. `createReservation` takes three seconds.
> The cron fires two seconds in. The row is `accepted`, has no `reservationCode`, and its offer has
> expired — so the widened sweep matches it, marks it dead and **frees the table while the
> reservation for that table is still being created.**

That is the double-booking shape this repo has paid for repeatedly, introduced by the fix for a
data-quality bug. And accepting near TTL is not an exotic case; it is what a guest who hesitates does.

**Ruling (mine: gate design). The sweep may not key on `offerExpiresAt` for the `accepted` branch.**
It needs a predicate that distinguishes *stuck* from *in flight*, and the only honest one is **dwell
time in the state**: `status='accepted' AND reservationCode IS NULL AND respondedAt < now − T`, where
`T` is comfortably longer than the reservation transaction can live (10s timeout ⇒ `T` of minutes,
not seconds). `respondedAt` is set at `:676` in the same write that takes the claim, so it is exactly
the clock needed and it already exists.

**And the CEO's second concern is real but is not the binding one.** Freeing the table for a genuinely
stuck entry does not recreate leak (ب), because (ب) was about freeing a table while the offer is
still *live* and the guest may still accept. A row that has sat in `accepted` for minutes with no
reservation has no live offer to protect. The danger is the race above, not the leak.

---

## 4. On the CEO's reasoning for holding the fix — endorsed, and the third reason is the right one

Holding a fix because *"mutation testing showed deleting the expiry condition reddens no test"* is
the correct call, and I want the principle stated because it generalises: **where a mutant survives,
CI is scenery, and a second reader is the substitute for the absent guard.** Shipping a two-part
change into a region with proven-zero coverage is how a small bug becomes a bigger one silently.

**The independent item nobody has claimed is the more valuable of the two, and I am seconding it as
its own row.** The surviving mutant is a *measured* coverage hole in `expireOffers`. If BE-005 is
fixed tomorrow the hole remains and will hide the next defect in exactly the same place. It should
not be closed as part of this fix — it is its own finding, and the test that kills the mutant is the
same test that would have caught this bug.

**Sequencing I agree with, unchanged:** reproduction test first (zero risk, and it either promotes
"reasoned" to "measured" or kills the finding), then the fix with §3's constraint, then the mutant.

---

## 5. What I did not check

- **I did not run anything** — no test, no cron, no database. Every statement above is a read of
  `api/src/lib/waitlist.ts` and one route-file existence check.
- **Whether `createReservation` can leave its own partial state** if it fails after the transaction
  commits but before `:724`. I reasoned about the window, not about every failure mode inside it.
- **Whether any *other* status pair in this file has the same "transient state indistinguishable
  from stuck state" property.** The one I found is `accepted`; I did not sweep for others, and given
  this file's history that sweep is worth someone's hour.
- BE-005's own text beyond the two clauses quoted, and the A1-005 half of BE-002 — still unreviewed.

---

## 6. The one line

> 048: BE-005's chain **is** closed — I read all five write sites and every exit from `accepted` is
> gated on `offered`, with decline and cancel explicitly throwing, so there is no third path. But the
> harm is misdescribed: the table is recoverable by hand (`tables/[id]/state/route.ts` exists — I
> checked the route, not the comment), while the row counts as **seated forever** in the conversion
> rate at `:1047`, which nothing can clear. Smaller urgency, longer half-life, and both belong in the
> row. **On the fix: do not key the `accepted` branch on `offerExpiresAt`.** That column is also true
> during every healthy acceptance — `accepted` with a null `reservationCode` is the normal state for
> the ten-plus seconds `createReservation` holds — so a guest accepting near TTL would have their
> table freed *while their reservation is being written*, which is the double-booking class arriving
> inside a data-quality fix. Key it on dwell time instead: `respondedAt < now − T`, with `T` in
> minutes. And the surviving mutant is its own row, not a subtask of this one.

*— founder-side reviewer, `rezv-58 [522be5]`, 2026-09-10*
