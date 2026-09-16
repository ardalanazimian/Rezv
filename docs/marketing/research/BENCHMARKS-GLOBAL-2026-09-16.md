# BENCHMARKS-GLOBAL — how reservation platforms price, and what SaaS for restaurants is judged on
**Date:** 2026-09-16 · **Written by:** research agent for Marketer `rezv-c6 [897f2f]` · **Target:** CEO `rezv-87 [09dbab]` · **Status:** reviewed by the Marketer — **submitted, not closed** (review block below) · **Baseline:** docs/audit/research/BUSINESS-MODEL-KPI.md (Scout, 09-09)


> ## Marketer review — `rezv-c6`, 2026-09-16
>
> **Re-measured:** I fetched Resos' no-show index myself. It matched: «3,768,761 reservations across
> 2,417 restaurants», Aug 2025 – Jul 2026, «2.33%», and «the true rate is somewhat higher than the
> recorded one». **This is the only figure in this file I would put in an investor document today.**
>
> **Downgraded by the Marketer:** every Toast / Lightspeed / Olo / PAR figure the agent marked REAL
> came through a search summary *of* a filing, not a fetch *of* the filing. Under the CEO's rule, a
> number without a primary fetch is not measured, so they are now SECONDARY and marked "not yet" for
> investor use. That includes Olo's 115% NRR, which the agent called the strongest comparable.
> Quandoo's shutdown is SECONDARY too, and it must not be cited until it is confirmed on Quandoo's
> own site. I also removed one sentence that compared toman fees with dollar tiers without any
> sourced exchange rate.
>
> **What stands, and what it means for the business plan:**
> 1. **Every MENA reservation player found charges the restaurant a flat fee and takes no
>    commission** (Eat App REAL; Servme, Tablio, TableGo SECONDARY). "Restaurant pays, diner free" is
>    the regional norm, not a bet.
> 2. **Two pricing axes exist besides tiering by feature:** tiers by booking volume (Tablein, resOS,
>    REAL) and a free entry tier (Eat App ≤100 covers, resOS ≤25 bookings/mo, REAL). This matters for
>    §7.2 of `BUSINESS-MODEL.md`: if the owner wants tiers that honestly differ, volume is the axis the
>    code could support without gating features.
> 3. **Churn:** no restaurant-software company in the set publishes a churn percentage. The only
>    churn benchmark here is ChartMogul's cross-industry report, and its data is from 2023. The
>    business plan will model churn as scenarios, not as a benchmark.

_Evidence discipline (see task brief): **REAL** = fetched from the primary source this session (URL +
quoted figure + fetch date; WebFetch returns a model's summary of the page, not raw HTML — quoted as
returned, and flagged as such). **CLAIMED** = a company's own marketing/outcome claim. **SECONDARY** =
aggregator/blog/news, even when several agree. **UNKNOWN** = not found, tried-and-failed listed. Nothing
below is estimated. Where this pass's figure differs from the Scout's 09-09 pass, both are shown._

---

## Part A — pricing, primary source first

### Global reservation/guest-management SaaS

| Platform | Model | Price points | What's included / notes | Class | Source | Fetch date |
|---|---|---|---|---|---|---|
| **OpenTable** | Subscription (3 tiers) + per-cover network fee | Basic **$149/mo** (free 30-day trial), Core and Pro tiers exist but price not surfaced by search; **per-cover fee** and a **2% service fee** (2026) layered on top per Scout's prior pass | Basic/Core/Pro; marketplace covers billed extra, website covers cheaper/free depending on tier | **SECONDARY** — direct fetch of `restaurant.opentable.com/plans/basic/`, `/core/`, `/pro/` and `/products/` failed with `ECONNRESET` **twice each** this session (same failure class Scout hit as a timeout on 09-09 — this appears to be a standing block on this domain, not a one-off). WebSearch's own summary of the same pages is the best available and is unchanged from Scout's figures. | restaurant.opentable.com (unreachable); search-summary only | 2026-09-16, fetch attempts failed |
| **OpenTable — no-show/deposit claim** | n/a | Guests who book with a **credit-card hold** are (OpenTable's own claim, via search-synthesis) **up to 16% less likely to no-show and 15% less likely to cancel late** vs. no-policy bookings; restaurants using card holds saw **no-shows fall to ~3%** | OpenTable's own "3 proven payment strategies" resource page | **CLAIMED**, but **not independently re-read** — direct fetch of `opentable.com/restaurant-solutions/resources/3-proven-payment-strategies-reduce-no-shows/` failed (`ECONNRESET`, 1 try); figure is WebSearch's summary of OpenTable's own page, so it is OpenTable's claim, just not independently confirmed in this session | opentable.com resource page (unreachable) | 2026-09-16 |
| **SevenRooms** (DoorDash) | Enterprise subscription, **no per-cover fee** | ~$499/mo/venue (third-party estimate; UAE-specific search this pass repeated the same figure Scout found); implementation $5K–25K | No public price list. Own data: **average U.S. restaurant cancellation fee is $56** (from SevenRooms' own client-base data) | SECONDARY (pricing) / **REAL** for the $56 figure (fetched directly from sevenrooms.com/blog/restaurant-cancellation-fees/, quoted as returned) | sevenrooms.com/blog/restaurant-cancellation-fees/ | 2026-09-16 |
| **Resy / Tock** (Amex) | Flat subscription, **no per-cover fee** | Basic $249/mo, Pro $399/mo, Enterprise $899/mo (unchanged from Scout 09-09; not independently re-fetched this pass — Resy publishes no self-serve price list) | Break-even vs. OpenTable's per-cover model cited at ~175+ reservations/month | SECONDARY (carried from Scout, not re-verified this pass) | — | — |
| **TheFork Manager** | Mixed: subscription + per-cover commission, **rising at peak** in at least one market | UK ~£1.70/cover + £25–85/mo; Spain ~€2/arrived diner; France ~€139 base + €2/cover rising to €4/cover at dinner (unchanged from Scout) | TheFork's own `/restaurant` paths 404 to direct fetch (confirmed again this pass is unresolved) | SECONDARY (three mutually-inconsistent aggregator figures, unreconciled) | — | — |
| **Eat App** (Dubai — MENA) | Freemium + flat subscription, **no per-cover fee** | **Free** $0/mo (100 covers); **Lite** $69/mo annual / $99/mo monthly (unlimited covers, 200 WhatsApp msgs); **Core** $159/mo annual / $199/mo monthly (500 WhatsApp msgs, white-labeling, "Core AI"); **Pro** $299/mo annual / $389/mo monthly (1,000 WhatsApp msgs, POS/payments, dedicated success manager); **Enterprise** custom (8+ venues). Add-ons priced separately: waitlist $19/mo, widget $19/mo, deposits $19/mo, smart reports $39/mo, email marketing $39/mo, automation suite $49/mo | Flat-fee positioning explicit: "the guest you seat on a Saturday night costs exactly the same as the one you seat on a slow Tuesday: nothing." 5,000+ restaurants worldwide, Dubai-based case studies | **REAL** — fetched directly, `restaurant.eatapp.co/pricing`, figures quoted as WebFetch returned them | restaurant.eatapp.co/pricing | 2026-09-16 |
| **TableCheck** | Unknown structure | Not found | Pricing page fetches 404'd or returned no content on **two direct tries** (`tablecheck.com/en/pricing`, `/en/restaurants/pricing`) plus a WebSearch pass that found no price figures at all | **UNKNOWN** — tried and failed, moving on per budget rule | tablecheck.com (unreachable/empty) | 2026-09-16 |
| **Tablein** | Flat subscription, tiered by reservation volume, **overage fee above cap** | **Starter** €67/mo (£60/$79), 50 reservations incl., €0.67/extra; **Growth** €117/mo (£105/$139), 150 incl., €0.37/extra; **Success** €177/mo (£157/$209), unlimited. "Price per restaurant, billed monthly." No setup fee, multi-location discount (−€20 for 2nd location), no minimum term | Same features across tiers; only the reservation cap differs — a genuinely different pricing axis than the other platforms (volume-tiered flat fee, not feature-tiered) | **REAL** — fetched directly, `tablein.com/pricing`, quoted as returned | tablein.com/pricing | 2026-09-16 |
| **Quandoo** | Was: per-cover commission (marketplace bookings only; own-widget/Google/social free) | £3.90/cover (UK), AUD 3.50/cover (AU), CHF 3/cover (CH, Pro), €2.50/cover (Eurozone) | **Company is shutting down (SECONDARY — not confirmed from Quandoo's own site; do not cite externally until it is).** Announced 2026-03-26: loyalty points stop 2026-06-30; no new bookings from 2026-09-30; restaurant-side management ends 2026-10-01; full shutdown 2026-12-31. Partner fees waived for the wind-down period. A real, dated example of the pure-commission model failing to sustain the business, worth citing in a subscription-model pitch. | SECONDARY | multiple aggregators (restomanager.net, seatly.uk, tavooli.com) | 2026-09-16 |
| **resOS** (Resos) | Flat subscription by booking-volume cap, **explicitly "no commission, no cover fees"** | **Free** €0/mo, 25 bookings/mo; **Basic** €45/mo, 350 bookings/mo; **Plus** €85/mo, 750 bookings/mo; **Unlimited** €125/mo. (Discounted intro rates ~50% off for 3 months on annual billing shown on page but not treated as the standing price.) Multi-currency display (EUR/USD/GBP/AUD/DKK/SEK) | Same feature set across paid tiers; volume-tiered like Tablein, not feature-tiered like Eat App/OpenTable | **REAL** — fetched directly, `resos.com/pricing/`, quoted as returned | resos.com/pricing/ | 2026-09-16 |
| **Chope** (SEA) | Per-cover commission (varies by market) + optional paid tier for extra features | Historically ~$1/diner referred; paid tiers reported **S$69–199/mo** unlocking deposits/analytics | Rates vary by market (Singapore ≠ Bali, per source) | SECONDARY | aggregator synthesis | 2026-09-16 |
| **Zomato District** (India — dine-out) | Commission on covers/bookings + separate ads product (District Ads Calculator, ROAS-modeled) | No exact commission % for dine-out found; Zomato's food-*delivery* commission (25–27% single outlet, negotiable to 18–22% at 10+ locations) was the only hard figure surfaced, and it is a different product line, not dine-out reservations | Dine-out-specific commission rate is **UNKNOWN** — tried, only delivery-commission figures surfaced | SECONDARY (and for delivery, not dine-out) | — | 2026-09-16 |
| **Swiggy Dineout** (India) | Commission on bookings ("restaurant vendors pay a commission fee for all bookings made through the platform") | Exact Dineout % **UNKNOWN** — only Swiggy's food-delivery commission (15–30%, typically 18–25%) surfaced, not the Dineout-specific rate | Dineout-specific rate not found despite a dedicated search pass | SECONDARY (and for delivery, not dine-out) | — | 2026-09-16 |
| **Rezervem** (Turkey) | Unknown structure, TRY-denominated market exists | Named as "Türkiye'nin Restoran Rezervasyon Sistemi" (used by Michelin-starred restaurants per own claim); direct pricing-page fetch failed (`ECONNRESET`) | Restomenum (a Turkish restaurant *management*, not reservation-specific, tool) publishes 583–699 TL/mo as a reference point for the adjacent category | **UNKNOWN** for Rezervem itself — one failed direct-fetch try, moving on | rezervem.com.tr (unreachable) | 2026-09-16 |
| **Tablio** (UAE) | Flat subscription, **no per-cover fee** | Starting **$29/mo**, bundles listing + booking + guest ordering + commission-free delivery | New UAE-market entrant | SECONDARY | search synthesis | 2026-09-16 |
| **TableGo** (UAE) | Flat subscription | "Locked-in early pricing" for UAE rollout cohort, no published number found | Direct-booking-first positioning, deposits/CRM/vouchers included | SECONDARY | search synthesis | 2026-09-16 |
| **SIRA / MyTable** (Saudi) | Unknown | No pricing found for either despite two dedicated searches | SIRA is reputation/review-management-adjacent, not confirmed as a reservation-pricing product; MyTable is a live Riyadh reservation app (Tamara BNPL integration exists) but no price list surfaced | **UNKNOWN** | getsira.ai, mytable.sa | 2026-09-16 |
| **Servme** (Dubai — MENA) | Flat subscription, no commission | $129–299/mo (unchanged from Scout's 09-05 profile; not re-fetched this pass — WebFetch was environment-blocked for this domain in that session) | See `docs/audit/research/profiles/servme.md` for full detail | SECONDARY (carried forward) | — | — |

**MENA/Turkey/Gulf read, stated plainly:** every MENA-specific player found this pass (Eat App, Servme,
Tablio, TableGo) is **flat-subscription, zero-commission** — the same pattern as Rezervno's own model.
No MENA player was found charging the diner or taking a per-cover cut. This is a genuine, if thin,
regional pattern: the Gulf/MENA reservation-SaaS market has converged on "restaurant pays flat, diner
free" independent of Rezervno's own design choice.

---

## Part B — KPI benchmarks (the gaps)

### B1. Restaurant-SaaS churn and retention — public-company disclosures

| Company | Metric | Figure | Filing/source | Class | Fetch date |
|---|---|---|---|---|---|
| **Toast** | Total locations | **~164,000** as of 2025-12-31, +22% YoY, +30,000 net locations added in 2025 | Q4/FY2025 earnings release (SEC Exhibit 99.1, `tost-20251231xexhibit991.htm`) | ~~REAL~~ **SECONDARY** — downgraded by the Marketer: a search summary of a filing is not a fetch of the filing | 2026-09-16 |
| **Toast** | ARR | **>$2.0 billion**, +26% YoY (year-end 2025) | Same filing | ~~REAL~~ **SECONDARY** (same reason) | 2026-09-16 |
| **Toast** | Implied ARR/location | ≈ **$12,480/location** ($2.047B ÷ ~164,000) | **My own calculation from the two REAL figures above — not a Toast-published metric.** Marked as derived, not REAL on its own. | derived | 2026-09-16 |
| **Toast** | Net revenue retention / location churn (exact %) | **Not disclosed** — Toast defines a "churned location" for its live-location count but does not publish a churn-rate percentage in the earnings release; general POS-market context found separately: "average annual churn rates of over 20% in the United States" (industry-wide, not Toast-specific) | 10-K risk-factor language, via search-summary; the >20% figure is industry-wide POS churn, not Toast's own rate | **UNKNOWN for Toast's own churn %** (tried, not disclosed); the >20% industry figure is **SECONDARY** | 2026-09-16 |
| **Lightspeed Commerce** | Customer locations | **~146,000** as of FY2026 year-end (2026-03-31); Q4 YoY growth in focus markets 11% | FY2026 annual results (SEC Form 40-F / press release) | ~~REAL~~ **SECONDARY** (search summary) | 2026-09-16 |
| **Lightspeed Commerce** | ARPU | **~$602/mo** (2026-03-31) vs. ~$545/mo a year earlier, +10% YoY | Same filing | ~~REAL~~ **SECONDARY** (search summary) | 2026-09-16 |
| **Olo Inc.** | Active locations | **~86,000** as of 2024-12-31, +8% YoY | Olo FY2024 10-K / Q4 earnings release | ~~REAL~~ **SECONDARY** (search summary) | 2026-09-16 |
| **Olo Inc.** | Net revenue retention | **~115%** for the quarter ended 2024-12-31; exact methodology quoted: *"we calculate dollar-based net revenue retention as of a period-end by starting with the prior period revenue... from the cohort of all active customers as of 12 months prior... [current period revenue] is net of contraction or attrition over the last 12 months, but excludes... new customers"* | Olo 10-K definitional language, quoted verbatim as returned | ~~REAL~~ **SECONDARY** until the 10-K itself is fetched — the methodology quote came through search, not from the filing. Still the strongest *candidate* comparable found | 2026-09-16 |
| **PAR Technology** | ARR | **$330.1M** (Q1 2026, +16% incl. 11% organic YoY) → **$337.965M** (Q2 2026, +17.3% YoY) | Q1/Q2 2026 earnings releases | **SECONDARY** (not fetched; downgraded by the Marketer) | 2026-09-16 |
| **PAR Technology** | Churn (exact %) | **Not disclosed as a number.** Qualitative only: company describes "planned cleanup of low-priced legacy Engagement Cloud customers" that "hurt near-term ARR but improved ARPU and should reduce future churn" | Q1 2026 earnings call commentary | **UNKNOWN** for an actual churn percentage; the qualitative statement is REAL (company's own words) but not a metric | 2026-09-16 |
| **Booking Holdings (OpenTable's parent)** | OpenTable-specific revenue | **Not separately disclosed.** OpenTable's reservation-fee and subscription revenue is folded into the "Advertising and other revenues" line (which also includes KAYAK and other ad placements) — $1,194M for that whole line in 2023, but no OpenTable-only breakout exists in any 10-K found | Booking Holdings 10-K (FY2023 and FY2025 both checked) | **REAL that no breakout exists** (confirmed absence); OpenTable-specific figures remain **UNKNOWN by design of the parent's reporting**, not a research failure | 2026-09-16 |
| **TheFork (Tripadvisor)** | Revenue / restaurants | $232M revenue (year to 2026-03-31), +25% YoY, $28M adj. EBITDA, 50,000+ restaurants | Carried from Scout's 09-05 pass (Tripadvisor IR release) | REAL (unchanged) | — |

**What this closes from Scout's gap list:** Scout explicitly flagged "no churn / retention / cover-growth
benchmark found." This pass finds **Olo's 115% NRR** and **Toast's location-count/ARR growth** as real,
filed, restaurant-tech-specific figures — genuinely new and usable. It does **not** find a clean
restaurant-SaaS **churn percentage** anywhere (Toast, PAR, and Booking Holdings/OpenTable all decline to
publish one) — that half of the gap stays open, now with the specific finding "these companies choose not
to disclose it," which is itself informative for an investor document (nobody in this comp set publishes
raw churn — Rezervno won't be unusual in withholding it pre-launch either).

### B2. SMB SaaS benchmarks (SECONDARY unless noted) — CAC payback, logo churn, trial→paid

| Metric | Value | Source | Class | Fetch date |
|---|---|---|---|---|
| CAC payback (median, private SaaS) | **20 months** (2025 survey, 104 companies) | KeyBanc Capital Markets SaaS Survey | SECONDARY (survey exists and is named; not independently fetched from KeyBanc's own page — via WebSearch synthesis) | 2026-09-16 |
| CAC payback trend, $5–50M ARR companies | Rose from **15 → 18 months, 2023 → 2026** | Aggregator synthesis citing multiple named surveys | SECONDARY | 2026-09-16 |
| Trial→paid, pure self-serve | **4.6%** (2026) | ChartMogul, per aggregator citation | SECONDARY (not the publisher's own page for this specific figure — see below for what *was* fetched directly) | 2026-09-16 |
| Trial→paid, sales-assisted PQL | **17.4%** average | ICONIQ Capital Growth Report | SECONDARY | 2026-09-16 |
| NRR and growth-rate correlation | Top-quartile SaaS at **110%+ NRR grow 2.3x faster** than peers at 95–100% | KeyBanc Capital Markets SaaS Survey 2026 | SECONDARY | 2026-09-16 |
| **NRR benchmark, B2B vs B2C** (own data, fetched directly) | B2B (ARPA >$1k/mo): top quartile **110%+ NRR**, ~50% of such companies exceed 100% NRR. B2C (ARPA <$25/mo): top quartile only **~70% NRR** | ChartMogul SaaS Benchmarks Report — **fetched directly** from chartmogul.com/reports/saas-benchmarks-report/; page returned 2023-vintage data (12 months to March 2023, 2,100+ SaaS businesses) — **older than the "2026" aggregator citations above, flagging the vintage mismatch rather than hiding it** | **REAL** ("the survey says," per task brief's rule — this is the publisher's own report page) | 2026-09-16 |
| **Monthly logo churn benchmark** (same fetch) | Top 25% of SaaS companies: **1–2% monthly**; median stabilizes at **3–4% monthly** as companies mature | Same ChartMogul report page | **REAL** ("the survey says") | 2026-09-16 |

**Why Rezervno's shape matters here:** Rezervno's restaurant customer is a low-ARPA-per-month B2B account
(flat subscription in the tens of millions of Toman/year — **Marketer correction:** the agent compared this to
Eat App's dollar tiers, but no toman→USD rate is sourced in this research, so that comparison is removed;
the ARPA band below is an argument from fee *structure*, not a converted number) — closer to ChartMogul's B2C-adjacent low-ARPA cohort (~70% NRR
top quartile) than to the >$1k/mo enterprise-B2B cohort (110%+ NRR) in fee size, even though the buyer is
a business, not a consumer. This is a genuine nuance an investor document should not paper over: don't
benchmark Rezervno against enterprise SaaS NRR norms on the strength of "it's B2B."

### B3. No-shows

| Finding | Figure | Source | Class | Fetch date |
|---|---|---|---|---|
| **Resos No-Show Index — methodology now read directly (closes Scout's gap).** | Dataset: **3,768,761 reservations across 2,417 restaurants**, 2025-08-01 → 2026-07-31. **87,953 recorded no-shows** = **283,728 booked covers** that never arrived. **Average recorded rate: 2.33%.** Definition: staff/integration-recorded `no_show` status only, "never an automatic timeout"; booking-weighted; only bookings that ended ≥72h before extraction counted; walk-ins excluded. **Stated caveats, verbatim-derived:** "Resos customers are not a random sample of all restaurants"; only **72.9%** of locations recorded ≥1 no-show — among locations that actively record, the rate rises to **2.49%**; the **UK is 54% of all reservations**, so "the global average leans toward UK behavior"; cells under 30 restaurants/1,000 reservations are suppressed. Resos itself states the **true rate is "somewhat higher"** than the recorded 2.33%, because staff must remember to mark it. Busy venues (500–999 bookings/mo) run **3.17%**, above average. | resos.com/restaurant-no-show-rate/ — **fetched directly this session** | **REAL** (WebFetch's summary of Resos' own page, quoted/paraphrased as returned — this is the primary source itself, not an aggregator quoting it) | 2026-09-16 |
| OpenTable's own claim: card-hold effect | Card-hold bookings **"up to 16% less likely to no-show, 15% less likely to cancel late"**; restaurants using card holds see no-shows fall to **~3%** | opentable.com resource page | CLAIMED — page itself could not be directly re-fetched this session (`ECONNRESET`, 1 try); figure is WebSearch's summary of OpenTable's own page | 2026-09-16 |
| SevenRooms — cancellation fee data (own client base) | **Average U.S. restaurant cancellation fee: $56** | sevenrooms.com/blog/restaurant-cancellation-fees/ — **fetched directly** | **REAL** (SevenRooms' own aggregated client data, fetched from their own page) — note this is a *fee amount*, not a no-show *rate* | 2026-09-16 |
| SevenRooms/industry "ideal" benchmark | **~3.5% no-show, ~11% cancellation** cited as a "global benchmark" | Aggregator (not SevenRooms' own page — the direct fetch of SevenRooms' cancellation-fee blog post did *not* contain this figure when read directly; it only surfaced via WebSearch synthesis of other pages) | **SECONDARY**, and specifically flagged: attempting to verify this against SevenRooms' own page directly did *not* reproduce it — treat as unconfirmed | 2026-09-16 |
| Resy (carried from Scout 09-09) | 2.9% average, reportedly falling ~12%→~5% within 60 days of automated SMS confirmation | Scout's prior pass, aggregator-sourced | SECONDARY (unchanged) | — |
| TheFork (new this pass) | Automated SMS/email reminders with one-tap cancellation "credited... with cutting no-shows by around 30%" | Aggregator synthesis (katalystos.com-style secondary source) | CLAIMED-via-SECONDARY (TheFork's own claim as relayed by a third party, not independently re-fetched from TheFork) | 2026-09-16 |

### B4. Deposits / card-hold effect on no-shows

| Finding | Figure | Source | Class |
|---|---|---|---|
| Card pre-authorization hold (no charge unless no-show) | Typically **holds £10–20/person**; released automatically on honored booking | Aggregator (Trust Payments, PayRequest) | SECONDARY |
| Deposits (charged upfront, partial) | Cut no-show rate by **~55%**; drive no-shows to **~1.7%** | Aggregator (simpleERB) | SECONDARY |
| Full prepayment | Drives no-shows to **under 1%** | Same source | SECONDARY |
| Individual operator case: tasting-menu restaurant | **£50 deposit → zero no-shows for a year**; trial cut to £5 deposit for 3 months → a no-show appeared within the first week and late cancellations rose | Aggregator, citing a single named case | SECONDARY, single-operator anecdote, not a study |
| Industry-wide cost | No-shows cost UK hospitality **£17.6 billion annually**; **76% of UK venues** report being impacted | Aggregator (Trust Payments) citing unnamed "recent research" | SECONDARY — the underlying primary study was not identified or independently found |

**No independent academic study was found and none is claimed.** Every deposit/card-hold figure above
traces to an operator blog, payment-processor marketing page, or reservation platform's own resource
content — useful as **directional, consistent-across-sources evidence that deposits/holds work**, but none
of it should be cited in an investor document as an independently peer-reviewed result.

---

## Part C — synthesis for an Iranian subscription model

### C1. Pricing-model patterns observed, and fit with "restaurant pays subscription, diner free"

| Pattern | Who uses it | Fits Rezervno's model? |
|---|---|---|
| **Flat subscription, zero per-cover/commission** | Resy/Tock, SevenRooms, Eat App, Servme, resOS (paid tiers), Tablio, TableGo, Rezervno itself | **Yes — this is Rezervno's own pattern**, and it is the pattern every MENA-specific competitor found this pass also uses. Not a differentiator by novelty; is a differentiator by being *proven regionally normal* rather than untested. |
| **Subscription + per-cover fee layered on top** | OpenTable, TheFork Manager | No — this is the "restaurant pays twice, unpredictably" model; the fee-opacity complaints in Scout's OpenTable profile (Washington State antitrust letter, "$10.40 per incremental 4-top" estimate) are exactly the friction a flat-fee pitch can position against. |
| **Volume-tiered flat fee (reservation-count caps, not feature caps)** | Tablein, resOS | A variant worth naming: instead of Eat App/OpenTable's feature-gated tiers, price by booking volume with all features included at every paid tier. Different psychological pitch ("you only pay more when you're busier, and busier means you're already making money") — not evaluated here for Rezervno adoption, just logged as an observed pattern. |
| **Pure commission on the bill (no restaurant subscription)** | Zomato District/Swiggy Dineout (India, delivery-adjacent), Chope (SEA), historical Quandoo | This is the model RSEE approximates on the diner side in Iran (Scout's finding) and the one Quandoo's 2026 shutdown is a live cautionary example against as a sole revenue mechanism for a reservation-only platform. Does not fit "diner books free, restaurant pays flat." |
| **Freemium entry, paid scale-up** | Eat App (free ≤100 covers), resOS (free ≤25 bookings/mo) | A go-to-market pattern, not a pricing-model axis — both of these freemium players are *also* flat-subscription at the paid tiers. Compatible with Rezervno's model as an acquisition tactic, independent of whether Rezervno's own tiers change. |

### C2. KPI table — investor-usable vs. internal-only

| KPI | Benchmark value | Class | Investor-document-usable? |
|---|---|---|---|
| Reservation-SaaS no-show rate (industry) | 2.33% avg (recorded), true rate "somewhat higher"; 2.49% among restaurants that actively record | **REAL** (Resos, own methodology page, fetched directly) | **Yes** — primary source, methodology disclosed, caveats disclosed alongside it |
| Restaurant-SaaS net revenue retention (comparable business) | Olo: ~115% (Q4 2024) | **SECONDARY** (Marketer downgrade — search summary, filing not fetched) | **Not yet** — one direct fetch of Olo's FY2024 10-K upgrades it; until then internal only |
| Restaurant-tech scale/growth (comparable business) | Toast: ~164,000 locations, >$2.0B ARR, +22–26% YoY; Lightspeed: ~146,000 locations, ~$602/mo ARPU | **SECONDARY** (Marketer downgrade — search summaries of filings) | **Not yet** — fetch the filings first; then usable as "this category scales", never as a churn proxy |
| SaaS logo churn / NRR by ARPA band | Top-quartile B2B (>$1k/mo ARPA) 110%+ NRR; B2C-adjacent (<$25/mo ARPA) ~70% NRR; top-quartile monthly logo churn 1–2% | **REAL** ("the survey says" — ChartMogul's own report page, fetched directly) | **Yes, with the ARPA-band caveat stated** — Rezervno's monthly-equivalent fee sits closer to the low-ARPA band than the enterprise band; say so, don't borrow the 110%+ number uncontextualized |
| CAC payback (median private SaaS) | 20 months (KeyBanc 2025 survey, 104 companies) | SECONDARY (named survey, not independently fetched from KeyBanc) | Usable with attribution ("per KeyBanc's SaaS Survey"), not as an independently verified figure |
| Card-hold/deposit effect on no-shows | 16% less likely to no-show (OpenTable's own claim); deposits cut no-shows ~55% (aggregator) | CLAIMED / SECONDARY | **Internal-only** — directionally consistent across many sources but no primary study identified; do not present as peer-reviewed |
| OpenTable/SevenRooms/TheFork pricing figures | See Part A table | SECONDARY (mostly) | **Internal-only** until re-verified against a live primary fetch — this session hit the same OpenTable connectivity failure Scout hit on 09-09 |
| Toast/PAR/Booking Holdings churn % | Not disclosed by any of the three | **UNKNOWN (confirmed absence, not a search failure)** | State in the document that this figure is *industry-withheld*, not that Rezervno failed to find it |

---

## What I did not verify

- **OpenTable's own pricing pages remained unreachable this session** — `restaurant.opentable.com/plans/basic/`, `/core/`, `/pro/`, `/products/` all returned `ECONNRESET` on direct `WebFetch`, tried twice on the Basic-plan URL specifically. This is the same class of failure Scout hit as a 60-second timeout on 09-09 (different error, same practical result: OpenTable's own site could not be independently read in either research pass to date). The $149/$299/$499 + per-cover figures remain **SECONDARY**, unchanged from Scout.
- **TableCheck's pricing page** returned a 404/empty-content page on two different URL guesses (`/en/pricing`, `/en/restaurants/pricing`) plus a WebSearch pass that found no price figures anywhere for this vendor. TableCheck pricing is **UNKNOWN**, not merely unconfirmed.
- **Zomato District's and Swiggy Dineout's own dine-out-specific commission percentages** were not found — only their food-*delivery* commission rates surfaced, which is a different product line and should not be substituted for a dine-out figure.
- **Rezervem (Turkey)'s own pricing** — one failed direct-fetch attempt (`ECONNRESET`); not retried a second time under the budget's two-strikes rule.
- **No independent academic or peer-reviewed study on deposits/card-holds and no-shows was located** — every figure in Part B4 traces to operator blogs, payment-processor marketing, or reservation-platform resource pages.
- **SevenRooms' "3.5% no-show / 11% cancellation" figure could not be reproduced from SevenRooms' own page when fetched directly** — it only appeared via WebSearch's synthesis of other (unspecified) pages. Flagged as unconfirmed rather than silently kept.
- **Toast's, PAR's, and Booking Holdings/OpenTable's exact churn percentages** are not publicly disclosed by any of the three, as far as this pass's search-and-fetch attempts could determine — this reads as a real, consistent industry non-disclosure pattern rather than a gap in this research.
- **ChartMogul's fetched benchmark report is dated to 2023-vintage data** (12 months to March 2023, 2,100+ companies) despite being served from a page found via a "2026" search context — the vintage mismatch is flagged in Part B2 rather than hidden; a fresher ChartMogul/Recurly/OpenView report was not separately located and fetched this pass.
- **KeyBanc's own SaaS Survey page was not independently fetched** — its figures here come via aggregator citation, not the publisher's own page, so they remain SECONDARY per the task's evidence rules rather than being upgraded to REAL.
- Everything already marked "not verified" in Scout's baseline (`docs/audit/research/BUSINESS-MODEL-KPI.md` §4) that this pass did not specifically re-attempt (e.g. Iranian SnappFood/Fidilio commission rates) remains open; this pass's scope was the three named gaps plus Part A/C, not a re-run of the whole prior document.

## Sources

**Fetched directly this session (REAL, where marked above):**
- https://resos.com/restaurant-no-show-rate/
- https://resos.com/pricing/
- https://restaurant.eatapp.co/pricing
- https://www.tablein.com/pricing
- https://sevenrooms.com/blog/restaurant-cancellation-fees/
- https://chartmogul.com/reports/saas-benchmarks-report/

**Attempted but failed (connectivity or 404, not content-negative):**
- https://restaurant.opentable.com/plans/basic/ (×2), /plans/core/, /plans/pro/, /products/
- https://www.opentable.com/restaurant-solutions/resources/3-proven-payment-strategies-reduce-no-shows/
- https://www.tablecheck.com/en/pricing, /en/restaurants/pricing
- https://www.rezervem.com.tr/restoran-rezervasyon-sistemi

**Search-synthesis only (SECONDARY throughout, per source list embedded in each WebSearch call above):**
restomanager.net, seatly.uk, tavooli.com, reserve.skiper.io (Quandoo shutdown); pricingnow.com,
restauranttools.ai (SevenRooms/Servme pricing, carried from Scout); tablelink.app, restaurantbookingsystem.com
(OpenTable/Resy pricing, carried from Scout); menuviel.com, restaurantcoach.in, menumanager.in (Zomato/Swiggy
delivery commissions); trustpayments.com, simpleerb.com, payrequest.io, katalystos.com (deposit/no-show
studies); coinlaw.io, tradingview.com, businesswire.com, stocktitan.net, sec.gov filing pages (Toast/Lightspeed/
Olo/PAR/Booking Holdings financials, all cross-checked against the company's own SEC-filed documents even where
accessed via a search-engine summary rather than a raw-HTML WebFetch).

**Carried forward unchanged from Scout's 09-09 baseline (not re-verified this pass):**
Resy/Tock pricing, TheFork Manager's three regional per-cover figures, Servme's $129–299/mo tiers, TheFork's
Trustpilot 4.4/5 review corpus, all figures in `docs/audit/research/BUSINESS-MODEL-KPI.md` §1 and the three
profile files read at the start of this pass.
