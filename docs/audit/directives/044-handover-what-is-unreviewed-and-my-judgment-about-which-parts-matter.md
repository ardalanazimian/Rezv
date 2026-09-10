# Directive 044 — Handover: what is unreviewed, ranked by consequence, and what I deliberately did not measure

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]` (was `rezv-d3 [c8fb22]`)
**To:** whoever holds the Reviewer role next, CEO, founder
**Why this file exists:** four directives today carry my findings and two carry my corrections. **My judgment about what is still unreviewed exists only in that session.** This is that judgment, written down before the machine goes off.

---

## 1. The 71 swallowed catches — which ones I would actually open

043 §2 established that only **one** of them wraps a Prisma call, so the invalid-query failure mode is
closed. The remaining 71 across 35 files are a different question: *what silently did not happen?*
Ranked by consequence, not by count — this is the ranking, not a finding list:

**Open these:**

1. `app/api/v1/payments/callback/route.ts` — the highest-stakes swallow in the repo. A payment
   callback that fails silently means money moved and the system does not know.
2. `lib/economy.ts` and `lib/loyalty.ts` — points, strikes, the ledger. A swallowed write here is the
   founder's own "free money" concern arriving from the opposite direction: value that should have
   been recorded and was not.
3. `lib/audit.ts` — a swallowed audit write is a hole in the record of who did what. Note there *is*
   an `AuditWriteFailing` alert (`alerts.yml:184`), so check whether the swallow happens before or
   after the counter; if before, the alert cannot fire.

**Probably fine, verify cheaply:**

4. `lib/sms.ts`, `lib/notify.ts`, `lib/reminders.ts` — a swallow means a person was promised a
   message and did not get one. The repo already has `smsFailed`/`smsSuppressed` counters, so the
   question is only whether every swallow is counted before it is discarded.

**Do not spend time on these** — best-effort by design, and a swallow is the correct behaviour:
`lib/cache.ts`, `lib/availability-cache.ts`, `lib/metrics.ts`, `lib/no-show-model.ts`, `lib/fraud.ts`,
`lib/tables.ts`, `middleware.ts`.

**The rule to apply, which is cheaper than reading all 71:** a swallow is acceptable when the failure
has *no consequence a person would notice*, and unacceptable when it hides *something that was
supposed to happen to money, to a record, or to a message*. Sort by that question, not by file size.

---

## 2. `redeemPointsTx` — what my clearance does **not** cover

043 §3 cleared it. Precisely what that clearance is worth:

- **It is a code review plus one pre-existing test.** I did not run the suite, did not enable the
  flag, and did not exercise the path against a live database. `points-redemption.integration.test.mts:333`
  (six concurrent redemptions) is the strongest evidence and **it is the CEO's, not mine**.
- **Deliberately not measured, with the reason:**
  - *Nested `$transaction`* — if a future caller wraps `redeemPoints` inside its own transaction,
    Prisma's nesting behaviour applies and I did not test it. **No such caller exists today**, which
    is why I skipped it; the day one appears, this needs re-checking.
  - *Two reversals racing each other* — bounded by the `cashback-reversal:{id}` unique key, so I
    reasoned rather than tested. Lower risk than the redemption race, which is why I built that one
    and not this one.
  - *A stale feature-flag read inside the transaction* — irrelevant to correctness; the worst case is
    one redemption slipping through a flag being turned off mid-call.
- **The one change I would still make** is typing `tx` as `Prisma.TransactionClient` instead of
  `any`. Today's only entry point wraps correctly; `any` is what makes tomorrow's mistake possible.

**If E-002 opens tomorrow and the flag moves, the honest sentence is:** *the spend path was reviewed
at `901e222` and no defect was found; it has never been executed with the flag on outside its own
test.*

---

## 3. Lines of the same kind still in the queue

The `redeemPointsTx` row was carried across four directives before it closed. These are the ones with
that same shape — real, unreviewed, and quietly aging:

1. **The 34 commits merged from `audit/round-21-xss-truncation`.** I approved the *merge* and its
   conditions in 037/038 and said each time that I had not reviewed the commits. They are on `main`
   now and nobody has reviewed them. **This is the largest unreviewed surface in the repo.**
2. **`apps/company` and `standalone/*.html`** for the two classes in 040 — one error code known
   repo-wide, and duplicated loyalty constants. `standalone/` is a known generated copy of the panels
   and almost certainly carries both. 040 §6's binding guard covers `apps/customer` only.
3. **032 F-6 and F-9** — three apps shipping a `robots.txt`, and the schema-drift gate blocked by a
   binary that has been on PATH since `5d5de09`. Both flagged as unclaimed on 2026-09-08 and still
   unclaimed. F-9 is cheap now.
4. **`reviewer.md` has no independent reviewer**, per 041 §4. I have ruled under it for two days.
   The honest checker is the founder, not the next session holding this role — a session reviewing
   the mandate it works under is the closed loop we spent today removing everywhere else.
5. **The `.mts` unused-vars gap in `apps/landing` and `apps/seo`** — I ruled it closed in 035 as a
   named limit, and it stays closed only while those apps have no real `.mts` source. Revisit if they
   grow any.

---

## 4. What I would tell the next Reviewer in one paragraph

Verify the CEO by re-deriving from source, never by reading its summary — it is a good builder and it
has been wrong four times today in ways only a second derivation caught, and **I have been wrong twice
today in exactly the same way**, both times by over-claiming rather than by missing something. The two
corrections in 043 are the most useful thing in my record: check your own findings against the rule
you just quoted at someone else, because that is where I broke it both times. Count things before
describing them — the 56-of-104 in 042 was the single most valuable output of the day and it took one
script. And when you write a number, say whether it is a population or a finding count, out loud, in
the same sentence.

---

## 5. State at handover

`main` at this commit. **Not mine and left untouched, deliberately:** an uncommitted edit to
`docs/audit/design/DS-002-customer-booking-flow-tapcount.md` and commit `4e9deef`, both the designer
session's. Per 038 §1 I stage only my own path; pushing carries `4e9deef` because it is already
committed, which is normal git and worth saying rather than leaving to be discovered.

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
