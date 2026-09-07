# MATRIX — Capability Comparison
_Maintained by Scout. Last updated: **2026-09-05 (batch 3)**._

**How to read this.** Cells are `REAL` (verified working, or a recent independent source confirms
it), `CLAIMED` (marketing/self-reported only, not independently confirmed), `ABSENT` (verified not
present, or the platform is structurally incapable of it), or `UNKNOWN — not verified` (we looked and
couldn't confirm either way, or haven't looked yet). **A bare `UNKNOWN` in a Tier-2 column below
means: not yet deep-profiled — see `recon-notes-global.md` for what little was gathered.** Every
`REAL`/`CLAIMED`/`ABSENT` cell carries a footnote pointing to the evidence.

> **⚠️ Method changed in batch 3, and it matters when you read a footnote.** Batches 1–2 were written
> with `WebFetch` blocked for every domain — every cell footnoted to a competitor page in those
> batches rests on `WebSearch`'s server-side synthesis, not on a page Scout read. **In batch 3
> `WebFetch` works**, and cells added or corrected on 2026-09-05 are marked `[fetched]` where Scout
> read the source directly. That upgrade immediately produced **three corrections to previously
> asserted cells** (SmartX pricing, SmartX apology page, Foodism's store footprint) — all marked
> **[CORRECTED 2026-09-05]** below. Treat an un-marked batch-1/2 cell as weaker evidence than a
> `[fetched]` one, and see `WATCH.md`'s 2026-09-05 METHOD entry.

**Coverage status, honestly:**
- **Tier 1 (deep-profiled, footnoted below):** Fidilio, SmartX, OpenTable, Resy, SevenRooms, Servme,
  Foodism, **TheFork (new, batch 3)**, **RSEE (new, batch 3 — Iran)**. Foodism's column is thinner
  than the others — genuinely most cells are `ABSENT`/`UNKNOWN` because the product itself is small
  and review/press coverage was hard to find, not because the research pass was shallow — see
  `profiles/foodism.md`, and note its **status change to DEGRADED** this batch.
- **Tier 2 (light recon only — pricing-page facts, mostly zero complaint data):** Eat App,
  TableCheck, Chope, Catchtable, Quandoo (shutting down — see WATCH), Zenchef, Tabit, Toast
  Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como. See `recon-notes-global.md`.
  *(TheFork left this list for Tier 1 this batch.)*
- **Iran long tail (batch 3, swept but not full columns):** علاءالدین تراول (717 venues, prepay
  voucher), سپیدز/Sepidz (B2B, contact-us pricing), ایتامین/Eatamin (dead, 2017), دیدو فود/Dido
  (dead, 2020), plus two checked false leads. See `profiles/iran-reservation-longtail.md`.
- **Loyalty-mechanics-only (not reservation platforms):** Starbucks Rewards, Chipotle Rewards,
  SnappFood — included only in the loyalty-relevant rows below, marked N/A elsewhere. SnappFood is
  Iran's dominant food-delivery app (not a reservation competitor) profiled specifically because it
  sets Iranian diners' loyalty-app expectations — see `profiles/snappfood-loyalty.md`.
- **Rezervno-today:** cells here are marked `REAL` **only** where I have direct file:line evidence
  from this repository (schema, code, or a shipped asset) — never from a doc's *claim* that a
  feature works. Where the code exists but I did not run it live this pass, I say so in the
  footnote. **All batch-3 Rezervno citations were verified on ref `audit/launch-hardening` @
  `35fff27`**; where the same symbol sits at a different line on `main`, both are given.
  **Rezervno-at-launch:** left `UNKNOWN — not verified` throughout — Scout has no launch
  roadmap document to cite; the CEO should populate this column or point Scout to one.

---

## Reservation & commercial-terms capabilities

| Capability | Fidilio | SmartX | RSEE | OpenTable | Resy | SevenRooms | Servme | TheFork | Foodism | Tier-2 (global) | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Product currently live and maintained** *(new row, batch 3)* | REAL — 110,000 installs, reviews through ۱۴۰۴/۰۷ (≈Oct 2025)⁶¹ | REAL — pricing page current⁵⁸ | REAL — site live, "۲۰۰۰+" venues claimed⁵⁶ | REAL³ | REAL³ | REAL⁴ | REAL³⁴ | REAL — $232M revenue FY to 2026-03-31, +25% YoY⁵⁷ | **ABSENT-leaning — DEGRADED**: Cafe Bazaar listing HTTP 404; Myket build ۱۴۰۱/۰۹/۱۰ (≈2022-12-01); a 2026 review says «کار نمیکنه»⁶² | mixed — Quandoo winding down (see WATCH) | N/A — pre-launch | UNKNOWN |
| Own consumer discovery marketplace (not white-label only) | REAL¹ | ABSENT² | REAL — web app + mobile app, diner browses and books directly⁵⁶ | REAL³ | REAL³ | ABSENT⁴ | ABSENT — structurally identical gap to SevenRooms; only staff/operator apps found in store searches³⁴ | REAL — consumer app + site, 50,000+ restaurants, 11 countries⁵⁷ | REAL — this IS the product; a diner-facing discovery/review social network, not a B2B tool⁴⁷ | mixed — see recon | REAL⁵ | UNKNOWN |
| Public, self-serve restaurant pricing (no "contact us") | UNKNOWN — commission % undisclosed¹ | **[CORRECTED 2026-09-05] REAL with caveat** — full Toman price list published (رزرو هوشمند ۵۲,۸۰۰,۰۰۰/سال); only intermediate volume bands route to a sales line⁵⁸ | REAL — three plans published, no sales call: free 4mo · ۹۹۰,۰۰۰ · ۲,۹۹۰,۰۰۰–۳,۹۹۰,۰۰۰ تومان⁵⁶ | REAL — published tiers, though two conflicting figures found³ | REAL — published flat tiers³ | ABSENT — pricing not publicly posted⁷ | REAL — 3 tiers, $129–$299/mo, published on Servme's own pricing page³⁵ | **ABSENT** — own `/restaurant` and `/restaurants` paths 404; three mutually contradictory third-party figures (£1.70/cover+£25–85mo · €2/cover · €139+€2–4/cover)⁵⁹ | ABSENT — advertising packages exist but are contact-only, no price list found despite searching⁴⁹ | mostly UNKNOWN, see recon | UNKNOWN — not checked this pass | UNKNOWN |
| No exclusivity/lock-in clause forcing single-platform use | UNKNOWN | UNKNOWN | UNKNOWN — ToS not reached (`/rules` 404)⁵⁶ | ABSENT — April 2026 "system of record" clause draws antitrust complaint⁸ | REAL — no such clause found³ | UNKNOWN | UNKNOWN — ToS not reviewed this pass | UNKNOWN — ToS not reviewed; one dated complaint of billing continuing after termination, escalated to debt collectors⁶⁰ | UNKNOWN — ToS not reviewed this pass | UNKNOWN | UNKNOWN — no ToS reviewed this pass | UNKNOWN |
| Upfront fee/deposit/cancellation transparency before commit | UNKNOWN | UNKNOWN — consumer never sees SmartX pricing directly⁶ | **ABSENT — structurally the opposite.** Diner buys chair-denominated credits to book («هر آرسی معادل یک صندلی»); 50–100% forfeited on late cancellation⁵⁶ | ABSENT — no-show fees $25–50/person reported as source of "adversarial" disputes⁹ | ABSENT — no-show fees up to $100/person, called "obscene" by a reviewer¹⁰ | N/A (B2B, no diner fee) | UNKNOWN — no platform-level diner fee (flat SaaS, no per-booking cut), but MyFatoorah integration lets restaurants collect their own deposits/prepayments; whether used adversarially not verified³⁶ | **ABSENT** — two dated 2026 complaints of a charge not shown before commit: *"The App did not alert me to the charge"* (£100) and *"Charged £40 even though attended the booking"*⁶⁰ | N/A — no in-app payment/ordering/reservation flow of any kind was found to exist, so there is no fee to be transparent or opaque about⁵⁰ | mostly UNKNOWN | UNKNOWN — not verified live this pass; see the coupling caveat⁶⁴ | UNKNOWN |
| Anti-bot / anti-scalper fairness on high-demand slots | UNKNOWN | N/A | UNKNOWN | UNKNOWN¹¹ | REAL — backed real legislation (Anti-Piracy Act), reports 90% bot-no-show reduction in NY¹² — but "Resy Notify" itself still reported losing to bots¹³ | N/A | N/A — no consumer-facing demand queue of its own to scalp | UNKNOWN — not investigated this pass | N/A — no booking/reservation system of any kind was found to exist⁵⁰ | UNKNOWN | UNKNOWN — not applicable at current demand levels | UNKNOWN |
| Restaurant CRM / cross-visit guest recognition ("remembered by name") | UNKNOWN | REAL (CLAIMED depth) — core pitch of "Customer Club"¹⁴ | UNKNOWN — not described on any page reached⁵⁶ | UNKNOWN | UNKNOWN | REAL — central pitch, G2-quoted "puts all the data in the hands of the business"¹⁵ | REAL — central pitch, corroborated by a named customer case study (Hyatt Regency Dubai, 88,000 guest profiles, 3 years' use)³⁷ | UNKNOWN — TheFork Manager plausibly has one; not verified this pass⁵⁹ | UNKNOWN — targeted search found no Foodism-specific CRM/loyalty-club feature for restaurant owners⁵¹ | mixed, see recon | UNKNOWN — not verified this pass | UNKNOWN |
| Cross-tenant / cross-brand data isolation enforced architecturally (not just claimed) | ABSENT — 2024 Snapp Food address-leak controversy, CEO called it a "technical bug"¹⁶ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | REAL — `restaurantId`/`tenantId` sourced only from auth context, never body/query, enforced in code¹⁷ | UNKNOWN |
| Self-admitted reliability incident requiring a public apology/retention campaign | UNKNOWN | **[CORRECTED 2026-09-05] REAL (title-level admission only)** — page title is «اختلالات باشگاه مشتریان &#124; مرداد ماه 1404», but the body describes no incident and offers no explicit apology⁵⁸ | UNKNOWN — no review corpus of any kind found⁵⁶ | UNKNOWN | UNKNOWN | UNKNOWN (customer-service complaints exist, not a public apology page)¹⁹ | UNKNOWN — none found, but total findable review volume (27, across G2+Capterra) is too small to treat absence as proof of high reliability³⁸ | UNKNOWN — no public apology found, but with 21,638 Trustpilot reviews and 12% at one star, absence here means "no *formal* apology," not "no incidents"⁶⁰ | UNKNOWN — none found, but zero independent reviews of any kind were findable either, so absence proves little⁴⁸ | UNKNOWN | UNKNOWN — pre-launch, no incident history yet | UNKNOWN |

## Loyalty & rewards-mechanics capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Servme | TheFork | Foodism | SnappFood | Starbucks Rewards | Chipotle Rewards | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Native, in-house diner loyalty (points/tiers), not a 3rd-party card program | CLAIMED — "Fidilio Club," undated marketing only²⁰ | N/A (B2B; loyalty is the *restaurant's*, not SmartX's own) | REAL — "OpenTable Regulars," Oct 2025²¹ | ABSENT — no native points program; only Amex card credits²² | N/A (infrastructure only) | N/A (infrastructure only) — same structural gap as SevenRooms³⁹ | REAL — "YUMS": 100/booking, 200 at "Yums x2" venues, 500 referral; 1000 = £20 off, 2000 = £50 off⁵⁷ | ABSENT — no native points/tier program found despite targeted searching; only generic, restaurant-run discounts surfaced inside the app⁵² | REAL — "Snapp Club," group-wide (not food-specific), 10 pts/1,000 Toman, confirmed for food orders⁴⁴ | REAL | REAL | REAL (schema-level) — `PointsLedger` model exists and is wired into the customer app²³ | UNKNOWN |
| Top tier reachable without premium spend/card | UNKNOWN | N/A | REAL — Gold at just 6 reservations/12mo, free²¹ | ABSENT — best perks require a $325–$895/yr Amex card²² | N/A | N/A | **N/A — no tiers exist at all.** Earn varies by restaurant and referral, never by member spend level⁵⁷ | N/A — no tier system exists at all⁵² | N/A — no tiers exist at all (flat pool), so "reachable" doesn't apply; see next row⁴⁵ | ABSENT — Reserve needs 2,500 Stars/yr²⁴ | UNKNOWN | UNKNOWN — no tier-threshold policy found this pass | UNKNOWN |
| Single, clearly-communicated expiry clock (not stacked) | UNKNOWN | N/A | UNKNOWN | N/A | N/A | N/A | **REAL — best-in-class in this whole programme.** One clock, one sentence: *"Yums are valid for one year. They can be exchanged until the last day of the month in which they expire."* No per-tier divergence; rounds **up**, in the user's favour⁵⁷ | N/A — no points/rewards mechanic exists to have an expiry policy⁵² | REAL — one flat pool, fixed biannual reset (end of spring/fall), no per-tier or per-entry divergence⁴⁵ | ABSENT — Green Stars expire in 6mo, Gold/Reserve never; the asymmetry itself is the finding²⁵ | ABSENT — 3 separate clocks: points (annual purchase), redeemed rewards (60d), birthday reward (30d)²⁶ | **[UPDATED 2026-09-05] REAL by absence** — `PointsLedger` has **no expiry column at all**, so points cannot expire. But this is an undeclared side-effect, not a policy, and nothing prevents a later migration adding one⁶³ | UNKNOWN |
| Redemption-path reliability (reward doesn't vanish at checkout) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | N/A | ABSENT-leaning — 2 of 21 most recent 1★ report Yums/promo codes unusable or bonus points not awarded; redemption is also gated on a £30/£60 minimum bill and you earn nothing while redeeming⁵⁷ ⁶⁰ | N/A — no redemption mechanic of any kind was found to exist⁵² | UNKNOWN — redemption is a manually-pasted coupon code, not an automatic checkout deduction, so the failure shape itself differs from Chipotle's; one dated (2023) discount-authenticity complaint found, not a redemption-mechanics bug⁴⁶ | UNKNOWN | ABSENT — v11.18.1 (Jul 2026) bug: reward showed applied, failed at checkout²⁷ | UNKNOWN — not tested this pass | UNKNOWN |
| **Accrued balance cannot be removed without a stated reason** *(new row, batch 3)* | UNKNOWN | N/A | UNKNOWN | UNKNOWN | N/A | N/A | **ABSENT — the largest single complaint cluster found.** 4 of 21 most recent 1★ (19%, all within 4 weeks) report balance lost on suspension with no reason given, incl. *"I have earned 20000 Yums… and it cannot be used now"* and *"blocked with more than 450 euro in gift cards i paid"*⁶⁰ | N/A | UNKNOWN | UNKNOWN | UNKNOWN | **ABSENT (permitted today)** — `PointsReason.adjustment` exists, `note` is **optional**, so a negative row with a NULL reason is a valid write⁶³ | UNKNOWN |
| **Diner can see the per-entry history behind their balance** *(new row, batch 3)* | UNKNOWN | N/A | UNKNOWN | UNKNOWN | N/A | N/A | UNKNOWN — not tested live | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **ABSENT** — the customer app renders an aggregate only; `points_ledger` is queried by exactly one API route, and it is the *restaurant* side⁶³ | UNKNOWN |
| Badge/status system (verifiably server-backed, not client-side) | UNKNOWN | UNKNOWN | UNKNOWN ("Gold" status exists, mechanism unconfirmed) | ABSENT (no native status tier) | N/A | ABSENT (diner-facing) — CRM auto-tags (VIP/Weekend Regular/etc.) are staff-facing operational segmentation, not a diner-visible badge/status system⁴⁰ | ABSENT — no tiers, no badges, no status of any kind in YUMS⁵⁷ | CLAIMED — a per-city "professional foodies" leaderboard exists, but it's engagement-based (reviews/follows/likes), not purchase-based, sourced only from third-party descriptive blogs, and server- vs. client-side mechanism is unconfirmed⁵³ | ABSENT — no tier/status/badge structure found despite targeted searching; a flat points pool only⁴⁵ | REAL (tier system) | UNKNOWN | REAL (schema-level) — `BadgeDefinition`/`UserBadge` models exist²⁸ | UNKNOWN |

## Trust, notification & platform-hygiene capabilities

| Capability | Fidilio | SmartX | RSEE | OpenTable | Resy | SevenRooms | Servme | TheFork | Foodism | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SMS/OTP fail-closed (no silent fallback, no fabricated success) | UNKNOWN | UNKNOWN | UNKNOWN | N/A | N/A | N/A | N/A — Servme's SMS use is guest notifications, not OTP auth; a real SMS-cost complaint exists but no fail-open/fail-closed evidence either way⁴¹ | N/A | UNKNOWN — not reviewed this pass | REAL — missing `bodyId` is explicitly logged as an error and the send is refused, never silently faked²⁹ | UNKNOWN |
| **OTP/login path proven working end-to-end (code sent matches code accepted)** *(new row, batch 3)* | **ABSENT** — the SMS sends **6 digits**, the app's field accepts **4**. Two different users, ۱۴۰۴/۰۶/۲۲ and ۱۴۰۴/۰۷/۱۹ (**28 days apart**), still unfixed between⁶¹ | UNKNOWN | UNKNOWN | N/A | N/A | N/A | N/A | N/A | UNKNOWN | **UNKNOWN** — the *send* side is fail-closed²⁹, but no test pinning OTP code length across `lib/sms.ts` and the customer input field was found⁶³ | UNKNOWN |
| **A money charge cannot become enforceable before it is displayed to the diner** *(new row, batch 3)* | UNKNOWN | UNKNOWN | **ABSENT** — the charge *is* the booking act; 50–100% forfeited on late cancellation⁵⁶ | ABSENT — no-show fees ⁹ | ABSENT — no-show fees ¹⁰ | N/A | UNKNOWN³⁶ | **ABSENT** — *"The App did not alert me to the charge, otherwise I wouldn't have cancelled"* (£100), 2026-07-21⁶⁰ | N/A⁵⁰ | **REAL today, UNPINNED** — the diner-facing copy is honest and was grep-verified, but its truth depends on a per-restaurant DB boolean and a wiring decision that nothing in CI watches⁶⁴ | UNKNOWN |
| Mandatory phone-capture as price of a "free" service, disclosed clearly | N/A | ABSENT-leaning — WiFi product's core mechanic is SMS-OTP capture "for building a marketing database," no diner complaint found but no visible opt-out described either³⁰; **and SmartX's usage-based plan gives restaurants a 30% discount when 75%+ of invoices carry a customer phone number — it pays for the harvest**⁵⁸ | UNKNOWN | N/A | N/A | N/A | N/A — Servme is a paid B2B SaaS, not a "free" consumer service | UNKNOWN — not reviewed this pass | UNKNOWN — phone+OTP is required only for rating/following/favoriting, not for basic browsing (a visible, standard sign-up gate, not a hidden one); whether the number is used for marketing beyond auth is unconfirmed⁵⁴ | UNKNOWN — not reviewed this pass | UNKNOWN |
| RTL + Persian-first UX with self-hosted fonts (no Google Fonts dependency) | UNKNOWN | UNKNOWN | CLAIMED — Persian-first by construction (an Iranian site); font hosting not inspected⁵⁶ | N/A (not an Iran product) | N/A | N/A | CLAIMED — Arabic interface claimed (Arabic is RTL, but this is not Persian, and not independently tested)⁴² | N/A | UNKNOWN — not reviewed this pass | REAL — `shared/fonts/vazirmatn-variable.woff2` shipped in-repo³¹ | UNKNOWN |
| Independent, third-party-reviewable footprint (App Store/Play/G2/Trustpilot presence) | REAL — **3.7/5 over ۵۸۱ رأی, ۱۱۰,۰۰۰ installs** on Cafe Bazaar, read first-hand⁶¹ | ABSENT — zero independent review-platform presence found anywhere³³ | **ABSENT** — no app-store listing located and no independent review corpus of any kind found for the only live Iranian competitor. The biggest gap in batch 3⁵⁶ | REAL — 4.65/5, ~190K Google Play ratings³ | REAL — 4.9/5, ~15.7K Google Play ratings³ | REAL — 4.7/5, 53 G2 reviews¹⁹ | REAL but thin — G2 4.8/5 (2 reviews), Capterra 4.8/5 (25 reviews); no Trustpilot listing found⁴³ | **REAL — Trustpilot 4.4/5 across 21,638 reviews (5★65% 4★16% 3★5% 2★2% 1★12%). The largest independent corpus in this programme by an order of magnitude**⁶⁰ | **[CORRECTED 2026-09-05] DEGRADED** — Myket live at 4.3/5 over 226 reviews, but the Cafe Bazaar listing now returns HTTP 404⁶² | UNKNOWN — pre-launch | UNKNOWN |

---

## Footnotes

1. `profiles/fidilio.md` §"Business model & pricing" — commission exists, rate undisclosed.
2. `profiles/smartx.md` §"Who it's for" — diners never touch a SmartX-branded surface directly.
3. `profiles/opentable-resy-sevenrooms.md` §OpenTable/§Resy, "What it is" + pricing sections.
4. `profiles/opentable-resy-sevenrooms.md` §SevenRooms, "Feature inventory" row "Consumer-facing discovery app/marketplace — DOES NOT EXIST."
5. `apps/customer/` is Rezervno's own consumer PWA (structural/code fact); live adoption/traffic UNKNOWN.
6. `profiles/smartx.md` §"Business model & pricing" — several line items require "contact us". **Superseded in part by footnote 58** for the pricing row specifically; retained here because the *consumer* never sees SmartX pricing either way.
7. `profiles/opentable-resy-sevenrooms.md` §SevenRooms — "Pricing: not publicly published."
8. `profiles/opentable-resy-sevenrooms.md` §OpenTable, "system of record" section + `WATCH.md`.
9. `profiles/opentable-resy-sevenrooms.md` §OpenTable, review synthesis complaint #2.
10. `profiles/opentable-resy-sevenrooms.md` §Resy, review synthesis complaint #2.
11. Not found this pass; most bot-fighting coverage in this recon centers on Resy specifically.
12. `profiles/opentable-resy-sevenrooms.md` §Resy, "Bot/scalping fight."
13. `profiles/opentable-resy-sevenrooms.md` §Resy, review synthesis complaint #1.
14. `profiles/smartx.md` §"What it is," Customer Club description.
15. `profiles/opentable-resy-sevenrooms.md` §SevenRooms, review synthesis praise.
16. `profiles/fidilio.md` §"What it is" and §"Trust" — Digiato/Tabnak/Startup360, 2024.
17. `api/src/lib/with-restaurant-auth.ts` — `restaurantId`/`tenantId` sourced from auth context, not request body/query; also `CLAUDE.md` project convention. **Batch-3 re-verification on ref `audit/launch-hardening` @ `35fff27`:** `:43` documents the `ctx.restaurant.id` query contract; `:176-182` reads staff `tenantId` from the DB record and throws `Err.forbidden()` when it does not match `auth.tenantId`. Architecture-level evidence only — no live penetration test run in any pass.
18. `profiles/smartx.md` §"Business model & pricing," "Reliability signal." **Refined by footnote 58.**
19. `profiles/opentable-resy-sevenrooms.md` §SevenRooms, review synthesis complaint #3.
20. `profiles/fidilio.md` §"Feature inventory," Fidilio Club row.
21. `profiles/opentable-resy-sevenrooms.md` §OpenTable, "Diner-facing loyalty."
22. `profiles/opentable-resy-sevenrooms.md` §Resy, "Amex Global Dining Access" + Feature inventory row "Native Resy diner loyalty/points program — NOT FOUND."
23. `api/prisma/schema.prisma` `PointsLedger` model — **`main`: line 664; `audit/launch-hardening` @ `35fff27`: line 672** (line numbers drift between refs; cite the ref or the citation is unfalsifiable) — plus `apps/customer/js/features/loyalty.js` (exists, not live-tested in any pass).
24. `recon-notes-global.md` §Starbucks Rewards, tier thresholds.
25. `recon-notes-global.md` §Starbucks Rewards, "Star expiry — the key tier-asymmetry finding."
26. `recon-notes-global.md` §Chipotle Rewards, "A second, separate expiry clock."
27. `recon-notes-global.md` §Chipotle Rewards, "Breakage" — v11.18.1 bug, reported-but-unverified exact rating-drop figures.
28. `api/prisma/schema.prisma` `BadgeDefinition` / `UserBadge` models — **`main`: lines 2087, 2101; `audit/launch-hardening` @ `35fff27`: lines 2095, 2109.**
29. `api/src/lib/sms.ts:278-281` (ref `audit/launch-hardening` @ `35fff27`) — missing `bodyId` is logged as an explicit error ("bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد") and the send is refused, not faked; `:280` states «حدس‌زدن ممنوع».
30. `profiles/smartx.md` §"Gen-Z lens," item 5 (Trust).
31. `shared/fonts/vazirmatn-variable.woff2` + `shared/fonts/README.md` — file present in repo.
32. `profiles/fidilio.md` §"Feature inventory," Android app row. **Superseded by footnote 61** (first-hand read).
33. `profiles/smartx.md` §"Feature inventory," rows on Cafe Bazaar/review-platform absence.
34. `profiles/servme.md` §"What it is" — only staff/operator app-store listings found (Apple id
    `1062818070`, Google Play `com.servmevenue.prod`); no consumer-facing Servme app exists.
35. `profiles/servme.md` §"Business model & pricing" — three tiers, $129–$299/mo range, published on
    `servmeco.com/pricing/` (tier *names* vary across aggregators; the price range itself is
    consistent).
36. `profiles/servme.md` §"Feature inventory," MyFatoorah deposit/prepayment integration row —
    Servme itself takes no per-booking cut; whether individual restaurants use MyFatoorah to charge
    diners adversarially is UNKNOWN, not addressed by any source found.
37. `profiles/servme.md` §"Review synthesis," Hyatt Regency Dubai case study (Servme's own published
    case study, not independently audited — treated as CLAIMED-by-Servme-with-a-named-customer).
38. `profiles/servme.md` §"Gen-Z lens," item 7 — total findable review volume across G2+Capterra is
    27; no incident found, but sample too small to read absence as proof of reliability.
39. `profiles/servme.md` §"What it is" and §"Gen-Z lens," items 4/6 — Servme is B2B infrastructure
    like SevenRooms: CRM guest-tagging (VIP, "Sushi Lover," Ramadan/Iftar tags) is a staff-facing
    operational tool, not a diner-visible loyalty program or badge/status system of Servme's own.
40. `profiles/servme.md` §"Feature inventory" and §"Gen-Z lens," item 6 — same reasoning as
    footnote 39, applied to the badge/status row specifically.
41. `profiles/servme.md` §"Review synthesis," complaint #1 (SMS cost) — Servme's SMS use is guest
    notifications/marketing, not OTP authentication, so the fail-open/fail-closed question this row
    asks doesn't map cleanly onto what was found; the one dated complaint is about per-message cost,
    not a silent-failure or fabricated-success pattern.
42. `profiles/servme.md` §"Feature inventory," Arabic-interface row and §"MENA-specific positioning"
    — CLAIMED by Servme's own marketing, not independently tested; Arabic is RTL but distinct from
    Rezervno's Persian-first requirement.
43. `profiles/servme.md` §"Review synthesis," honesty-check paragraph — G2: 2 reviews (4.8/5),
    Capterra: 25 reviews (4.8/5); a direct `site:trustpilot.com servme` search surfaced no listing.
44. `profiles/snappfood-loyalty.md` §"Loyalty/rewards mechanics" table, "Snapp Club" row — a
    group-wide (not SnappFood-specific) points program spanning the whole Snapp super-app; 10 points
    per 1,000 Toman spent, confirmed to apply to food orders specifically.
45. `profiles/snappfood-loyalty.md` §"Loyalty/rewards mechanics" table, "Formal tiers" and "Points
    expiry" rows — no tier/VIP/status structure found after multiple targeted searches (reported as
    "likely does not exist," not "confirmed does not exist"); one flat points pool expiring twice a
    year (end of spring, end of fall) on a fixed calendar date, not a rolling per-transaction clock.
46. `profiles/snappfood-loyalty.md` §"Coupon-code culture" section — Snapp Club points redeem only as
    a discount code pasted at checkout, not an automatic deduction; the one dated authenticity
    complaint found (2023-03-04, FoodParty) alleges a discount was manufactured by inflating the
    sticker price first, not a technical redemption failure.
47. `profiles/foodism.md` §"Identity check" and §"Who it's for" — Foodism itself is a diner-facing
    discovery/review social network (own consumer product), cross-confirmed across Cafe Bazaar,
    Myket, its own site, and multiple independent Persian app-intro blogs — not a white-label or
    B2B-only tool like SmartX or Servme. **See footnote 62 for its 2026-09-05 status change.**
48. `profiles/foodism.md` §"Review synthesis" — no individual review (positive or negative) was
    findable anywhere despite multiple differently-worded searches; only the Myket 4/5-over-216-
    reviews aggregate was obtainable, so absence of a reliability incident here is a much weaker
    signal than for Fidilio/Servme, where at least some review volume exists. **Partly
    superseded: batch 3 obtained the first verbatim Foodism review — see footnote 62.** **Correction
    (2026-09-07):** SmartX was wrongly included in that comparison in the original wording — the
    deep-batch corpus pass found **zero** independent, verifiable, verbatim reviews for SmartX in
    any session, from any platform (`corpus/smartx/store-reviews.md:24,123`). SmartX belongs in the
    same absence-of-signal category as Foodism itself, not among the competitors where "at least
    some review volume exists."
49. `profiles/foodism.md` §"Business model & pricing" — restaurant-side advertising packages are
    described as existing ("with good returns") but no price list or figures were found despite
    targeted searching, mirroring the "contact us" opacity found in Fidilio's and SmartX's pricing.
50. `profiles/foodism.md` §"What it is" and §"Feature inventory" — WebSearch's own synthesis states
    plainly that Foodism has no in-app online ordering/payment (ordering is by phone call or in
    person only) and no table-reservation feature was found despite a targeted search; there is
    therefore no fee/deposit/booking flow of any kind for these two rows to evaluate.
51. `profiles/foodism.md` §"Feature inventory," restaurant CRM row — a targeted search
    ("فودیسم باشگاه مشتریان تخفیف رستوران") surfaced only unrelated competitor content (SmartX,
    Sepidz, Hami POS), nothing Foodism-specific.
52. `profiles/foodism.md` §"Feature inventory" and §"Gen-Z lens," item 6 — no Foodism-native
    points/tier loyalty program was found despite targeted searching; the only "discount" mechanic
    found is generic, individual-restaurant-run offers surfaced inside the app, not a Foodism ledger
    or points system, so there is no tier/expiry/redemption mechanic for the three related rows to
    evaluate either.
53. `profiles/foodism.md` §"Feature inventory" and §"Gen-Z lens," item 4 — a per-city "شکموهای
    حرفه‌ای" ("professional foodies") leaderboard of the most-active reviewers is described
    consistently across multiple third-party app-intro blogs (`appreview.ir`, `charkhoneh.com`),
    but it is engagement-based (reviews/follows/likes), not a purchase-based loyalty status, and
    was not independently tested by me.
54. `profiles/foodism.md` §"Who it's for" — phone-number + SMS-OTP sign-up is required only to
    rate, follow, favorite, or upload photos; basic browsing/discovery works without an account,
    per `appreview.ir`'s description (via WebSearch synthesis) — a visible, standard sign-up gate,
    not a hidden one, though whether the captured number is used for marketing beyond
    authentication is unconfirmed.
55. `profiles/foodism.md` §"Review synthesis" — Myket listing showed 4/5 stars across 216 reviews
    (via WebSearch synthesis, accessed 2026-09-05); the Cafe Bazaar listing
    (`cafebazaar.ir/app/app.foodism.tech`) was reported live but its rating/review count
    could not be surfaced. **Superseded by footnote 62** — the Cafe Bazaar listing now returns HTTP 404.

### New in batch 3 (2026-09-05) — all `[fetched]`, read directly by Scout

56. **RSEE / آرسی** — `profiles/iran-reservation-longtail.md` §"آرسی / RSEE". Source:
    [rsee.ir](https://rsee.ir/), fetched 2026-09-05. Verbatim: «جهت انجام رزرو میز کافه/رستوران، کاربر
    می تواند اقدام به خرید بسته نماید» and «هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک
    صندلی از یک میز می باشد»; claims «۲۰۰۰+» venues; three published plans (free 4mo · ۹۹۰,۰۰۰ تومان/12mo
    · ۲,۹۹۰,۰۰۰/6mo or ۳,۹۹۰,۰۰۰/12mo). Cancellation refund terms (100% / 50% / 0%) came via `[search]`,
    not a fetch. **Honesty note:** the verbatim says the user *«می تواند»* (**can**) buy a package — I did
    **not** find a statement that it is mandatory, and `/plans`, `/rules`, `/faq` all returned HTTP 404.
57. **TheFork — product and YUMS.** `profiles/thefork.md`. Sources:
    [thefork.co.uk/yums](https://www.thefork.co.uk/yums) (all YUMS mechanics, verbatim, fetched
    2026-09-05) and [Tripadvisor IR](https://ir.tripadvisor.com/news-releases/news-release-details/tripadvisor-enters-agreement-sell-thefork-american-express-700)
    (`[search]` — 50,000+ restaurants, 11 countries, $232M revenue FY to 2026-03-31, the pending $700M
    Amex sale). **The Amex acquisition is NOT closed as of 2026-09-05.**
58. **SmartX pricing + apology page — [CORRECTED].** `profiles/smartx.md` §ADDENDUM and
    `profiles/iran-reservation-longtail.md` §"Two corrections". Sources, all fetched 2026-09-05:
    [smartx.ir/pricing](https://smartx.ir/pricing/) (full Toman price list; usage-based model at
    ۲۹,۵۰۰,۰۰۰ activation + ۱۰,۰۰۰/transaction with a 30% discount for 75%+ phone-number capture; sales
    line ۹۰۰۰-۰۱۱۲۳ for intermediate bands); [smartx.ir/services/reserve/restaurant](https://smartx.ir/services/reserve/restaurant/)
    (**contradicts the pricing page: ۲۱,۴۵۰,۰۰۰ تومان/year vs ۵۲,۸۰۰,۰۰۰** — both quoted, neither
    endorsed); [smartx.ir/sorry](https://smartx.ir/sorry/) (HTML title «اختلالات باشگاه مشتریان | مرداد
    ماه 1404» confirmed; body contains no incident description and no explicit apology).
59. **TheFork restaurant pricing is not published.** `profiles/thefork.md` §"Business model & pricing".
    `thefork.co.uk/restaurant` and `/restaurants` both returned **HTTP 404** to a direct fetch
    2026-09-05 (a negative result, reported as such). The three contradictory third-party figures come
    from [heep.ai](https://www.heep.ai/en/blogs/thefork-manager-honest-review-restaurant-blind-spots-2026),
    [deru.es](https://deru.es/en/blog/software-restaurantes-reservas/) and
    [restoboard.fr](https://www.restoboard.fr/blog/combien-coute-thefork-restaurant-2026) `[search]`.
    The discrepancy is **not** resolved and no figure is endorsed.
60. **TheFork Trustpilot corpus.** `profiles/thefork.md` §"Review synthesis". Source:
    [trustpilot.com/review/www.thefork.com](https://www.trustpilot.com/review/www.thefork.com), fetched
    2026-09-05 — 21,638 reviews, 4.4/5, distribution 65/16/5/2/12%. Scout read the **21 most recent
    1-star** reviews (2026-07-06 → 2026-09-02) and the **5 most recent 5-star**. All percentages quoted
    describe **that window**, not the lifetime corpus. Quotes are **verbatim fragments as printed on the
    listing page** — the fetch layer truncates at ~125 characters; nothing is paraphrased inside
    quotation marks. TheFork's own account of the suspensions was not obtained.
61. **Fidilio, first-hand.** `profiles/fidilio.md` §ADDENDUM. Source:
    [cafebazaar.ir/app/com.fidilio](https://cafebazaar.ir/app/com.fidilio), fetched 2026-09-05 — ۳.۷ از ۵,
    ۵۸۱ رأی, ۱۱۰,۰۰۰ installs, store name «فیدیلیو | سفارش غذا». Three reviews rendered, quoted verbatim
    in Persian with dates; the OTP length mismatch appears in two of them 28 days apart. Persian→Gregorian
    conversions are Scout's own. Only the three reviews the listing page renders were readable — no
    paginated corpus was reached.
62. **Foodism status change — [CORRECTED].** `profiles/foodism.md` §ADDENDUM and
    `profiles/iran-reservation-longtail.md`. `cafebazaar.ir/app/app.foodism.tech` returned **HTTP 404**
    on three attempts across two URL forms, 2026-09-05, while `cafebazaar.ir/app/com.fidilio` fetched
    normally in the same minute (so: not a site outage).
    [myket.ir/app/app.foodism.tech](https://myket.ir/app/app.foodism.tech) is live: 4.3/5 over 226
    reviews, 25,000 installs, last updated ۱۴۰۱/۰۹/۱۰ (Scout's conversion: 2022-12-01). First verbatim
    Foodism review ever obtained: معصومه, ۳ خرداد ۱۴۰۵ (≈2026-05-24) — «کار نمیکنه». Status:
    **DEGRADED — likely abandoned, NOT confirmed dead** (no install performed).
63. **Rezervno loyalty-ledger facts**, ref **`audit/launch-hardening` @ `35fff27`**, 2026-09-05.
    `api/prisma/schema.prisma:672-686` — `PointsLedger`'s complete field list is
    `id, userId, user, restaurantId, delta, reason, note, createdAt`: **no `expiresAt`, no expiry index**
    (a full `expiresAt` grep across the schema hits `Restaurant.planExpiresAt`, `Reservation.holdExpiresAt`,
    an offer timer, `GiftCard:731`, `OtpCode`, `StaffInvite`, `IdempotencyKey` and a second plan field —
    never `PointsLedger`). `:660-670` — `enum PointsReason` includes `adjustment // تنظیم دستی`, and
    `note` is declared `String?` (optional), so a negative row with a NULL reason is a valid write.
    `apps/customer/js/features/loyalty.js:57` destructures only
    `{points, tier, next_tier, points_to_next, progress_pct, badges}` — an aggregate, never the rows. A
    grep for `points_ledger`/`pointsLedger` under `api/src/app/api/v1/` returns exactly one file,
    `restaurant/members/route.ts` (the restaurant side). No OTP-code-length test was found. **This
    retires the largest open question in `proposals/001`.** See `proposals/005`.
64. **Rezervno deposit-disclosure coupling**, ref **`audit/launch-hardening` @ `35fff27`**, 2026-09-05.
    `apps/customer/js/data/booking.js:66-70` — `depositLabel()` returns a **hardcoded** Persian sentence
    stating a deposit is «آنلاین دریافت نمی‌شود» (not collected online), with an explicit
    unknown→silence rule; rendered in the booking sheet at `:261`. Its comment (`:43-65`) records the
    grep that justified it (zero customer-app calls to `/reservations/:code/pay`). The capability it
    denies exists: `api/src/app/api/v1/reservations/[code]/pay/route.ts:35` gates real Zarinpal payment
    on a **per-restaurant DB boolean**, `restaurant.paymentEnabled` — which a repo-wide grep shows is
    read **nowhere else in the product**. Runtime feature flags live in `platform_settings` and are
    flipped by an admin (`api/src/lib/feature-flags.ts:63,74-75`). Separately,
    `docs/audit/CANCELLATION-POLICY.md` §1 documents that `partial_penalty_pct` (default 50,
    `schema.prisma:1989`) is **owner-only, never sent to the diner, and not enforced**. So the current
    state is honest and the risk is forward-looking. See `proposals/006`.

## What's missing from this matrix (be honest about it, don't silently drop it)

- **Every remaining Tier-2 competitor** (Eat App, TableCheck, Chope, Catchtable, Quandoo, Zenchef,
  Tabit, Toast Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como) is still not a full column
  here because `recon-notes-global.md` only has pricing-page-level facts for them, no complaint/praise
  evidence — adding them as columns with mostly-`UNKNOWN` cells would look like coverage that doesn't
  exist yet. **TheFork moved to Tier-1 this batch** (`profiles/thefork.md`).
- **RSEE has no loyalty column** in the second table. No points, tier, badge or rewards mechanic of any
  kind was found on the pages reached — but `/plans`, `/rules` and `/faq` all 404'd, so this is
  "not found," not "confirmed absent," and it would have been dishonest to fill a row of `ABSENT`s.
- **RSEE has no independent review data at all.** The only live dedicated Iranian competitor is the one
  with zero third-party complaint corpus. Finding one (an app-store listing, a Telegram channel, a
  Twitter/X search in Persian) is the highest-value single task for batch 4.
- **The Iran long tail is swept but not columned** — Alaedin Travel (717 venues), Sepidz, Eatamin
  (dead), Dido (dead) live in `profiles/iran-reservation-longtail.md`, not here, because a column of
  mostly-`UNKNOWN` for a dead app is noise.
- **Foodism's column is real but thin, and now degrading** — see footnote 62.
- **Rezervno-at-launch is entirely `UNKNOWN`** — Scout still has no launch roadmap document. CEO:
  either share one or tell Scout where to find it, and this column gets populated next pass. **This
  has now been asked twice.**
- **No live app testing was performed on any competitor** in any pass — no app installed, no account
  created, no checkout flow completed. Batch 3 upgraded the *reading* method (direct fetch of store
  listings, review pages and pricing pages) but not the *using* method. Time-to-first-value remains
  UNKNOWN for every competitor in this matrix, including RSEE, where it is the single number that
  would settle whether its prepay wall actually kills the funnel.
