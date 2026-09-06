# BRIEF — 2026-09-05 (batch 3)
_Scout → CEO. Third batch: TheFork (deep) + the full Iranian reservation sweep + three corrections to
prior batches._

_Filename note: `BRIEF-2026-09-05.md` already exists — it was batch 2's brief, filed one day late by
its own admission. Rather than overwrite it or backdate this one, this file carries the `-batch3`
suffix. Two briefs share a date because the calendar did, not because anything is duplicated._

---

## Recommendation, first

**Ship `proposals/006` (disclosure coupled to money capture) first.** It is the cheapest thing on the
whole board: no schema change, no architect sign-off, no product debate to win — the honest copy is
**already written and already correct**, and 006 only stops it from silently rotting when someone
flips a database boolean. One payload field, one two-line branch change, two tests, one recorded
falsification run.

**Then `proposals/005` (no silent taking).** More expensive (schema change → architect sign-off) but
it closes the failure mode that batch 3 found is the one that *actually happens* at scale, and it
answers the open question `proposals/001` could not.

**And re-scope `proposals/001`, don't just re-rank it.** Its central unknown is now answered: `PointsLedger`
has **no expiry column at all** (`api/prisma/schema.prisma:672-686` on `audit/launch-hardening` @
`35fff27`; `:664` on `main`). Rezervno's points cannot expire. Half of 001 is therefore already true
by accident — which is not the same as being safe, and 005 explains why.

---

## What changed in the market this batch

**1. The tooling changed, and that is the headline.** `WebFetch` — blocked for every domain in
batches 1 and 2, including neutral controls — **works in this session.** Everything before this batch
came through a search engine's summary of a page; batch 3 read pages. The immediate yield was **three
corrections to previously asserted MATRIX cells**, all now marked `[CORRECTED 2026-09-05]`:

- **SmartX *does* publish restaurant pricing.** The matrix said ABSENT. `smartx.ir/pricing` publishes a
  full Toman list: **رزرو هوشمند ۵۲,۸۰۰,۰۰۰ تومان/سال**, باشگاه هوشمند ۵۱,۰۰۰,۰۰۰, up to a
  ۱۹۹,۲۵۰,۰۰۰ bundle. Only intermediate volume bands route to sales. *And SmartX contradicts itself* —
  its own reservation product page states ۲۱,۴۵۰,۰۰۰/year for the same thing. Both quoted, neither
  endorsed.
- **The SmartX apology page is real at the title, not in the body.** Its HTML title genuinely is
  «اختلالات باشگاه مشتریان | مرداد ماه 1404» — so the self-admitted Customer Club disruption stands —
  but the body describes no incident and offers no apology. Cell revised from `REAL` to
  `REAL (title-level admission only)`.
- **Foodism is degrading.** Its Cafe Bazaar listing now returns HTTP 404 (three attempts, controlled
  against a Fidilio fetch that worked in the same minute); its Myket build is from **۱۴۰۱/۰۹/۱۰
  (≈2022-12-01)**; and the first verbatim Foodism review ever obtained in this programme, from
  **۳ خرداد ۱۴۰۵ (≈2026-05-24)**, reads simply **«کار نمیکنه»** — *"it doesn't work."*

**2. TheFork is deep-profiled, and its complaint corpus rewrites one of our assumptions.** 21,638
Trustpilot reviews at 4.4/5, 12% one-star — an order of magnitude larger than any other independent
corpus in this programme. Reading the 21 most recent one-star reviews: the biggest single cluster,
**4 of 21 (19%), all inside four weeks, is accrued value confiscated on account suspension with no
reason given** — *"I have earned 20000 Yums in my account and it cannot be used now"* (Yvonne, GB,
2026-07-20; ≈£500 at TheFork's own published rate), *"My account was blocked with more than 450 euro in
gift cards i paid"* (Francesco Pagliano, IT, 2026-08-02).

**Why that matters more than it looks:** TheFork's *expiry* policy is the **best in this entire
programme** — one clock, one year, rounded up to month-end, stated in a single plain sentence, no
tiers. Cleaner than Starbucks. Cleaner than Chipotle. **And it protected none of those four people,
because the loss vector was not a clock. It was a decision nobody explained.** `proposals/001` governs
clocks and would not have helped. That gap is what `proposals/005` exists to close.

**3. Amex has NOT yet bought TheFork.** Announced 2026-06-15 at $700M; **not closed as of 2026-09-05**,
gated on the French Works Council consultation for LaFourchette SAS plus regulatory approvals,
expected before end-2026. Flagged loudly because "Amex owns TheFork" is an easy and wrong thing to put
in a deck. If it closes: one card issuer owns Resy, Tock **and** TheFork (~75,000 venues), DoorDash
owns SevenRooms, and Quandoo is winding down.

**4. Iran: the open item is closed, and the answer is better news than expected.** A full sweep of Cafe
Bazaar, Myket and the Persian web found the category has **no winner**:

- **آرسی / RSEE** (`rsee.ir`) — the only live, dedicated, consumer-facing Iranian table-reservation
  platform. Claims «۲۰۰۰+» venues. **And the diner buys credits to book:** «هر آرسی معادل یک صندلی از
  یک میز می باشد» — one ARSEE = one chair, deducted per seat, from a purchased package; **50–100%
  forfeited on a late cancellation.** Restaurant pricing published openly (free 4 months · ۹۹۰,۰۰۰
  تومان/year · ۳,۹۹۰,۰۰۰/year).
- **علاءالدین تراول** — a travel agency's booking desk with **717 venues** nationally on a prepay-voucher
  model. I would have said "no Iranian platform has supply at scale" before fetching this page. That
  would have been wrong.
- **سپیدز / Sepidz** — B2B reservation module bundled with POS and a loyalty club; pricing behind
  «درخواست لیست قیمت».
- **The graveyard:** **ایتامین/Eatamin**, self-described "first restaurant table reservation app in
  Iran," last build **2017**, 520 installs. **دیدو فود/Dido**, 360°/AR discovery *with reservations*,
  last build **2020**, 7,000 installs, one reviewer's epitaph: **«متاسفانه طرح شکست خورده»**.
- Two search-surfaced leads were checked and are **not** reservation products at all — documented so
  nobody re-walks them.

**The strategic read:** two serious, feature-complete attempts at Iranian table reservation shipped and
died. Building the operator software is demonstrably not the hard part. And the one live competitor
monetises by **charging the diner for the right to reserve** — so "free to book, and we say so before
you commit" is a differentiator against a *live local incumbent*, not just against Western fee models.

**5. Fidilio has a login-blocking bug it left live for at least a month.** First direct read of its Cafe
Bazaar listing: 3.7/5 over ۵۸۱ رأی, **۱۱۰,۰۰۰ installs** (batch 1 could not read the install count).
Two different users, **28 days apart** — علیرضا ۱۴۰۴/۰۶/۲۲ and محمد ۱۴۰۴/۰۷/۱۹ — report the identical
defect: **«کد تایید هم 6 رقمی میفرستن ولی برنامه 4 رقمی میخواد»** — the SMS sends six digits, the input
field accepts four. Total login failure, first screen of the funnel, 110,000 installs, unfixed across a
month. Also worth knowing: Fidilio's own store name is **«فیدیلیو | سفارش غذا»** — *food ordering*. On
the shelf where Iranians actually choose apps, Fidilio presents as a SnappFood competitor, not a
reservation product.

---

## Top 3 proposals, ranked

1. **`proposals/006-disclosure-coupled-to-money-capture.md`** *(new)* — **T2, the cheapest on the
   board.** `apps/customer/js/data/booking.js:66-70` tells diners a deposit is «آنلاین دریافت نمی‌شود».
   That is true today and the team proved it with a grep. It becomes false the moment
   `restaurant.paymentEnabled` is set true — a **per-restaurant database boolean** that a repo-wide grep
   shows is read **nowhere in the product except the payment route's own guard**
   (`reservations/[code]/pay/route.ts:35`). No CI gate can see that flip. The fix: derive the sentence
   from the server instead of hardcoding it, then pin the claim to the capability with two falsifiable
   gates. Evidence it matters: *"The App did not alert me to the charge, otherwise I wouldn't have
   cancelled"* — TheFork, £100, 2026-07-21. **Needs `backend-integrity-engineer` (payload field) +
   `contracts-consolidation-engineer` (booking.js) + `test-integrity` (falsification). No architect
   sign-off — no schema, no lifecycle change.**

2. **`proposals/005-no-silent-taking-points-ledger.md`** *(new)* — **T2, needs architect sign-off.**
   `PointsReason.adjustment` exists and `note` is `String?` — **optional** — so
   `delta = -20000, reason = adjustment, note = NULL` is a valid ledger write today. And the diner
   cannot see the ledger at all: `loyalty.js:57` renders an aggregate, and `points_ledger` is queried
   by exactly one API route, which is the *restaurant* side. So Yvonne's complaint is expressible in
   one INSERT and invisible to its victim. Mechanism: a **DB-level CHECK** requiring a reason on any
   negative manual adjustment (the exact pattern migration 080 already uses for `no_show_risk_source`),
   a diner-facing points history, and a falsifiable gate so expiry can never be added silently.
   **Needs `data-trust-engineer`** (owns `PointsLedger`, protocol §13) **+ architect sign-off** (schema).

3. **`proposals/001-single-clock-loyalty-guardrails.md`** *(existing, re-scoped not re-ranked)* — its
   blocking unknown is answered: there is **no expiry column on `PointsLedger`**. So the "one clock"
   half is already true. What remains live from 001 is the *communication* half — the rule that any
   future rate or tier change ships with its own in-app explainer. Batch 3 adds a second incumbent to
   the flat-loyalty side of that argument: **TheFork has no tiers at all**, joining SnappFood's flat
   pool against Starbucks' and Chipotle's tiered messes. **Recommend: keep 001 open, drop its schema
   investigation task (done), and treat 005 as its successor for the ledger work.**

*(002 and 003 unchanged. 003 gains fresh ammunition — SmartX now publishes prices, RSEE publishes
prices, and TheFork's own restaurant pages 404 — so "publish real numbers" is now the Iranian norm we
would be **matching**, not a bold move. 004 unchanged.)*

---

## The one thing you don't know yet

**Nothing, on the item I had queued for this slot — and the reason is worth more than the item was.**

I had this slot filled with: *"`CLAUDE.md` §دیتابیس says the latest SQL migration is ۰۷۵; it is actually
`080-no-show-risk-source.sql`, and an agent following the doc literally will collide with five existing
files."* That was true of the `CLAUDE.md` I was given at the start of this session.

**It is no longer true. A concurrent session fixed it while I was writing.** The working tree now shows
an uncommitted one-line change removing the parenthetical entirely rather than updating the number:

```diff
-  ⚠️ … مهاجرت‌ها فقط در `api/prisma/sql/` (آخرین: ۰۷۵).
+  ⚠️ … مهاجرت‌ها فقط در `api/prisma/sql/`.
```

I am reporting this instead of quietly deleting the finding, for three reasons. **First**, the finding
was real and the fix is uncommitted — if that session reverts or its branch is dropped, the staleness
returns, so the warning box in `proposals/005` stays. **Second**, deleting a claim that briefly held
and never mentioning it is the same class of dishonesty as asserting one that never did. **Third, and
this is the actually useful part:** five sessions are writing to this repository simultaneously, and I
watched a documented fact change underneath a finding I had already written down. **Any claim any agent
makes about repo state is a claim about a *moment*, not a *fact*** — which is exactly why the reviewer's
instruction to name the ref (`audit/launch-hardening` @ `35fff27`) matters, and why every Rezervno
citation in this batch carries it. **The `CLAUDE.md` claim above is the one thing in this batch I could
not pin to a ref, and it is the one thing that moved.**

**The one thing you genuinely don't know yet, then:** whether anything *else* Scout verified this batch
has already drifted. My repo citations are all pinned to `35fff27` and re-verified line-by-line at the
end of the batch; my competitor citations are pinned to URLs fetched on 2026-09-05. Neither is pinned to
whatever `main` looks like when you read this.

**A smaller thing worth saying out loud:** `docs/audit/CANCELLATION-POLICY.md` contains a model
self-correction — an author writing *«تصحیحِ یک ادعایِ قبلیِ خودم … **غلط بود** — با grep تأیید شد»* and
then showing the grep. I copied that discipline for this batch's three corrections. The repo's own
honesty conventions are good enough to borrow.

---

## Agent-capability gap — flagged as instructed

**No agent in the current roster can use a competitor's product.** Every "time to first value" cell in
`MATRIX.md` is `UNKNOWN` across all three batches, for every competitor, including RSEE — where it is
the single number that would settle whether a prepay wall actually kills the funnel. The blocker is not
tooling any more; batch 3 proved the reading problem is solved. The blocker is that **installing an
Iranian app, receiving an SMS on an Iranian number, and completing a real booking** is not something
Scout, or any agent listed, can do.

Two thin, honest options, and one non-option:
- **Thin option A:** the founder or a trusted person runs one 20-minute session on RSEE and Fidilio with
  a real number, screen-records it, and hands Scout the recording to write up. That converts perhaps
  eight `UNKNOWN` cells to `REAL`/`ABSENT` with first-hand evidence.
- **Thin option B:** accept that time-to-first-value stays UNKNOWN and stop implying it is
  gatherable. Also acceptable — but then the matrix should say so permanently rather than carrying it
  as a perpetual to-do.
- **Non-option:** Scout inferring the flow from screenshots and marketing copy and writing it up as if
  observed. That is the exact failure this whole research programme is built to avoid, and I will not
  do it.

**The CEO decides whether that warrants a new agent.** My honest read: it does not warrant an *agent*,
it warrants **twenty minutes of a human's time**, once.

---

## What Scout looked at, and what's next

**This batch:** TheFork (full Tier-1 profile, first-hand Trustpilot corpus); the complete Iranian
reservation long tail (RSEE, Alaedin Travel, Sepidz, Eatamin, Dido, two verified false leads);
first-hand re-reads of Fidilio, SmartX and Foodism producing three corrections; two new proposals; the
`PointsLedger` and deposit-disclosure repo verifications behind them.

**Next batch, in priority order:**
1. **Find any independent review corpus for RSEE.** The only live Iranian competitor is the one with
   zero third-party complaint data — no app-store listing was located. Persian Twitter/X, Telegram
   channels, and a targeted Sibapp search (**Sibapp was never checked in any batch** — my omission,
   flagged).
2. **Resolve whether RSEE's package purchase is mandatory.** Its own wording is *«می تواند»* — *can*.
   `/plans`, `/rules` and `/faq` all 404'd. If a free booking path exists, the sharpest competitive
   claim in this batch softens considerably, and I would rather find that out than be quietly wrong.
3. **Eat App and Catchtable** among the remaining Tier-2 set — Catchtable specifically, because its
   restaurant-set deposit model is the closest structural analogue to what Rezervno's own
   `depositRequired` / `depositAmountToman` schema is built for.
4. Retry Google Play and the Apple App Store with different approaches; both failed this pass.

---

**Copy-paste line for the founder to give the CEO:**

> Scout's third batch: the research tooling that was blind for two batches now works, and reading pages
> directly instead of search summaries immediately corrected three things we had asserted about SmartX
> and Foodism. Two real findings. First: TheFork has the cleanest points-expiry policy of anyone we've
> studied and it still has four public complaints in four weeks from people whose balances vanished
> when their accounts were suspended — the risk isn't the clock, it's unexplained authority, and our
> own ledger permits exactly that today (a negative adjustment with a NULL reason is a valid write, and
> diners can't see the ledger at all). Second: Iran's table-reservation category has no winner — two
> serious attempts died in 2017 and 2020, and the one live competitor, RSEE, makes the *diner* buy
> chair-credits to book and forfeits half of them on a late cancellation. Top recommendation is the
> cheapest item on the board: our booking screen honestly tells diners deposits aren't collected
> online, but that sentence is hardcoded and one database boolean away from being false — pin it with a
> test before we ever turn payments on. One process note: I flagged a stale migration number in
> CLAUDE.md and another session fixed it while I was writing — a live reminder that with five sessions
> running, every repo claim is about a moment, not a fact. Full brief: `docs/audit/research/BRIEF-2026-09-05-batch3.md`.
