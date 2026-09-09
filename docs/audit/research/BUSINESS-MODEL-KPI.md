# BUSINESS-MODEL-KPI — how comparable platforms actually make money, and what they're judged on

_Scout · 2026-09-09 · target `rezv-9c [5283b5]` (re-resolve via ROUTING.md). Written because the
founder asked explicitly for "بازار، رقبا، مارکتینگ، مدل کسب‌وکار، بیزینس‌پلن و KPI" — this file
covers the business-model and KPI half; market/competitor product findings are in `PARITY-RISK.md`,
`ANTI-PATTERNS.md`, `MATRIX.md` and the profiles. Every figure below is marked REAL (fetched from a
primary source), CLAIMED (a competitor's own marketing statement), or SECONDARY (an aggregator/blog's
number, not independently confirmed against the primary source) — never invented, per the audit
constitution. Where a number could not be traced to any of these, it is UNKNOWN._

---

## 1. Monetization mechanisms actually observed, by market

### Iran — nobody charges the diner a commission; the fight is over the restaurant's wallet, and one
competitor charges the diner for the *right to book at all*

| Competitor | Mechanism | Evidence tier | Figures |
|---|---|---|---|
| **SmartX** | B2B SaaS subscription, per product module, annual, paid by the restaurant | REAL (fetched, smartx.ir/pricing/, 2026-09-05) | Smart Reservation ۵۲,۸۰۰,۰۰۰ تومان/yr *or* ۲۱,۴۵۰,۰۰۰ تومان/yr on a different page — **an unreconciled 2.5× internal contradiction, both cited, neither endorsed**. Customer Club ۵۱,۰۰۰,۰۰۰ تومان/yr. Full 4-product bundle ۱۹۹,۲۵۰,۰۰۰ تومان/yr. A second product line uses a **per-transaction fee model**: ۲۹,۵۰۰,۰۰۰ تومان activation + ۱۰,۰۰۰ تومان/transaction. No per-cover or commission-percentage fee found anywhere — restaurant pays flat/per-transaction, never a cut of revenue. |
| **RSEE** (رزرو رستوران‌های ایران) | B2B subscription (restaurant) **plus** a B2C prepaid-credit model (diner) — the diner buys "آرسی" chair-credits before booking | REAL (fetched, rsee.ir, 2026-09-05) for restaurant side; mechanism confirmed but Toman rate never found for diner side | Restaurant: free tier exists; Professional ۹۹۰,۰۰۰ تومان/yr; Complete ۲,۹۹۰,۰۰۰–۳,۹۹۰,۰۰۰ تومان (6 or 12mo, both prices published for the same tier — unreconciled). Diner: pays for chair-credits up front; **50–100% forfeited on late/no-show cancellation** — the single worst money-respect mechanic in this entire research programme (`ANTI-PATTERNS.md` #3). |
| **Fidilio** | Delivery commission (restaurant-paid, rate never disclosed) on its food-ordering line; directory/discovery is free to list | SECONDARY (search-synthesis, 2026-09-04/07, never a fetched rate-card) | No percentage found in 15+ differently-phrased queries across 4 sessions. Reservation/table-booking monetization, if any, was never located — Fidilio's own Cafe Bazaar listing name is "food ordering," not reservations. |
| **SnappFood** | Delivery commission (restaurant) + advertising/promotion placement (FoodParty-style campaigns) | CLAIMED/SECONDARY | Exact commission % not independently sourced this pass; Iran's Competition Council ruling (`WATCH.md`) confirms commission-discount-for-exclusivity was a real, sanctioned practice — evidence of the mechanism's existence, not its rate. |

**The pattern worth naming:** every live Iranian competitor charges the **restaurant**, not a
per-booking commission on the **diner** — except RSEE, which does the opposite and is punished for it
in its own terms of service (forfeiture language), if not yet in a visible review corpus (none found —
`corpus/rsee/store-reviews.md`, zero reviews located by any session to date). **"Free for the diner to
book, and we say so before commit" is not a bold claim in Iran — RSEE has already proven the downside
of the alternative model exists and is live.**

### Global — the fee sits on the restaurant, split between subscription and per-cover, and the market
is consolidating around card issuers and delivery platforms

| Competitor | Mechanism | Evidence tier | Figures |
|---|---|---|---|
| **OpenTable** | Monthly subscription tier **plus** per-cover network fee | SECONDARY (aggregator blogs — restaurant.eatapp.co, tablelink.app, restaurantbookingsystem.com, 2026 — not independently fetched from opentable.com, which returned a timeout this session) | $149/$299/$499 monthly (Basic/Core/Pro); **$1.50 per "network" cover** (a booking sourced from OpenTable's own diner-facing app/site, as opposed to a restaurant's own website widget); $0.25/website cover or a $49/mo flat unlimited-website-cover option. Aggregator's worked example: a restaurant doing 1,500 network covers/month pays $1,500–$2,250 in cover fees alone — 5-10x the subscription itself on the Core plan. **Flagged: not independently verified against OpenTable's own current pricing page — treat the exact dollar figures as SECONDARY until re-confirmed against a primary source.** |
| **SevenRooms** (DoorDash) | Enterprise subscription, **zero per-cover fee**, custom quote | SECONDARY (aggregator, restaurantbookingsystem.com, 2026) | $300–$500+/location/month (lower tier) to $500–$1,000+/location/month (full enterprise); $5K–$25K implementation fee; annual contracts standard. SevenRooms' own stated differentiator vs. OpenTable: no per-cover fee, restaurant owns guest data. |
| **TheFork** (pending Amex) | Restaurant subscription **plus** a "Yums" loyalty-funded acquisition mechanic (diner-facing, restaurant-funded) | REAL (TheFork's own IR filing figures, already on file via `profiles/thefork.md`) | $232M revenue (year to 31 March 2026, +25% YoY), $28M adj. EBITDA, 50,000+ restaurants. Confirms the subscription model is real revenue at scale, not just a pricing page. |
| **Resy** (Amex) | Restaurant subscription; VIP-tier diner status by invitation, criteria undisclosed | REAL (mechanism) / criteria itself CLAIMED-opaque | No public restaurant pricing tier list found this pass — Resy does not appear to publish a self-serve price list the way OpenTable does (unlike SmartX/RSEE's Iranian norm of publishing openly — `PARITY-RISK.md` #1 already flags Rezervno as matching that Iranian norm, ahead of Resy specifically on this axis). |

**Market structure, already tracked in `WATCH.md`, restated for the business-model lens:** DoorDash
owns SevenRooms (closed 2025-06-13, ~$1.2B) — reservation platform now inside a delivery marketplace's
commerce stack. Amex owns Resy+Tock and is acquiring TheFork ($700M, announced 2026-06-15, **not
closed as of 2026-09-09** — re-confirmed this session, still gated on French labor consultation and
regulatory approval). **If it closes, one card network's loyalty economics sit behind three of the
five reservation platforms named in Scout's own mandate.** Rezervno's position — a reservation platform
that is neither a card network's loyalty vehicle nor a delivery marketplace's retention tool — becomes
rarer, not more competitive, as this consolidation proceeds. This is the same read already filed in
`STATUS-2026-09-07.md`; repeated here because it is directly a business-model fact, not just a
"watch" item.

## 2. What Rezervno itself currently charges — REAL, from the live pricing page

`apps/landing/app/pricing/page.tsx`, fed by `GET /api/v1/site/[collection]?collection=plans`
(`api/src/app/api/v1/site/[collection]/route.ts:29-35`, public, no auth) — already verified in
`PARITY-RISK.md` #1, cited here for completeness: **۱۸ / ۳۴ / ۶۵ میلیون تومان** for 3/6/12-month
restaurant plans. This is a flat subscription, matching the SmartX/RSEE Iranian norm of restaurant-paid
subscription rather than diner-paid commission. **Not independently cross-checked against current
commercial terms this pass** (per `PARITY-RISK.md`'s own "what I did not verify" — the page and API
wiring are real, whether the Toman figures reflect what sales actually charges today was not
re-confirmed).

## 3. KPIs a reservation marketplace is actually judged on

This section answers "what would investors/operators actually measure us against" with sourced
external benchmarks, each marked by evidence tier. **None of these are Rezervno's own numbers** — the
product is pre-launch, so every Rezervno-side cell is UNKNOWN by construction, not by omission.

| KPI | External benchmark found | Evidence tier / source |
|---|---|---|
| **No-show rate** | Industry-wide average **2.33%** across 3,768,761 reservations / 2,417 restaurants (Resos' own published index). Independent restaurants *without* automated confirmation/reminder sequences run **15–20%**; automated reminder sequences cut that to **5–8%**. A separately-cited Resy-restaurant average: **2.9%**, reportedly falling from ~12% to ~5% within 60 days of adopting automated SMS confirmation. | SECONDARY — WebSearch-summarized aggregator content citing Resos' own index; the Resos page itself returned HTTP 403 on direct fetch this session, so the index's methodology was not independently read. Treat the exact percentages as directional, not certified. |
| **Seat/table utilization** | **60–75%** occupied-seat-hours ÷ available-seat-hours is described as "strong" for a full-service restaurant in 2026 benchmarking content. | SECONDARY — aggregator (slang.ai), not a primary operator-reported figure. |
| **Take rate / commission** | No universal number — Iran's live competitors charge restaurant-side subscription/per-transaction, not a diner-side %; global per-cover fees (OpenTable $1.50/network cover) function as a de facto take rate on volume rather than a stated percentage. | See §1 tables above for sourcing per competitor. |
| **Cover growth** | Not independently found as a published external benchmark this pass — flagging as **UNKNOWN — not verified**, an explicit gap rather than an invented range. | — |
| **Retention cohorts / repeat-visit rate** | Not independently found as a published external benchmark this pass. TheFork's own filing (`profiles/thefork.md`) reports revenue growth (+25% YoY) but not a cohort-retention figure. **UNKNOWN — not verified.** | — |
| **Review/NPS-adjacent proxy** | TheFork: 21,638 Trustpilot reviews, 4.4/5, 12% one-star (already on file, `profiles/thefork.md`) — the largest independent-review corpus in this whole programme, usable as a rough proxy for satisfaction-at-scale even though it is not a formal NPS figure. | REAL (fetched, Trustpilot, 2026-09-05). |

**What this means for a Rezervno business plan, stated plainly:** the two KPIs with the most credible
external benchmarks (no-show rate, seat utilization) are also the two most directly improvable by
product mechanics Rezervno already has some of — deposit/cancellation-policy disclosure
(`booking.js:66-83`, already correct per `ANTI-PATTERNS.md` #2) and the waitlist priority mechanism
just audited in `LOYALTY-PERK-AUDIT.md` (which, done honestly, directly reduces effective no-show/
churn friction by filling cancelled slots faster). **Cover growth and retention-cohort benchmarks are a
genuine research gap** — the next research pass should search operator-side sources (Toast, Lightspeed,
restaurant-industry trade press) specifically for these two, rather than assume the silence found here
is a complete answer.

## 4. What did NOT get verified, named explicitly

- **OpenTable's own pricing page was not successfully fetched this session** (60-second timeout) — the
  $149/$299/$499 + $1.50/cover figures rest on three converging aggregator sources, not a primary
  fetch. Flagged as SECONDARY throughout, not silently upgraded to REAL.
- **Resos' no-show index methodology was not read** (403 on direct fetch) — the 2.33%/2.9%/5-8%/
  15-20% figures are WebSearch-summarized, not independently confirmed against Resos' own page.
- **No Iranian restaurant-side commission percentage was found for SnappFood or Fidilio** despite
  multiple sessions' worth of searching (documented in the underlying corpus files) — this is a
  standing gap in the whole research programme, not something this pass closed.
- **Cover-growth and retention-cohort external benchmarks** — not found, marked UNKNOWN rather than
  invented; see §3.
- **Rezervno's own commercial terms were not cross-checked against the live pricing page's Toman
  figures** — carried forward unchanged from `PARITY-RISK.md`'s own caveat, not re-verified here.
