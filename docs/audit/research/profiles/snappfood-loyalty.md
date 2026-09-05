# SnappFood — Loyalty & Rewards Benchmark
_Last updated: 2026-09-04 by Scout. Scope note: SnappFood is not a reservation competitor — profiled
here specifically because it owns Iranian diners' loyalty-app habits and daily rewards-mechanic
expectations (per the original research brief)._

> **Methodology note (read first):** `WebFetch` was tested against a neutral control domain
> (`example.com`) and against a real target (`snappfood.ir`) at the start of this pass. Both returned
> `EGRESS_BLOCKED` — identical to the prior batch's finding, confirmed again rather than assumed.
> Every fact below comes from `WebSearch`'s own server-side synthesis of pages it read (Persian coupon
> aggregators, Snapp's own blog/vendor-academy content, Iranian tech press, one social-listening blog),
> not from a page I opened and read myself. I could not independently confirm exact wording of any
> quoted text below the level WebSearch itself paraphrased it, and I could not open Cafe Bazaar's or
> Myket's actual review pages to hand-read star-by-star reviews — the one figure I do have (Myket's
> aggregate) came through WebSearch synthesis of a secondary source, not a page I read directly. This
> is disclosed per-claim below, not just here.

## What it is / business model (brief — not the focus)
SnappFood (اسنپ‌فود) is Iran's dominant online food/grocery-ordering platform, founded in 1396 (2017)
via a merger of ZoodFood into the Snapp Group (the "Uber of Iran" super-app ecosystem, alongside
ride-hailing Snapp, Snapp Market, Snapp Pay, Snapp Express, etc.). [WebSearch synthesis of
cafebazaar.ir listing text and Fidilio-profile-adjacent sourcing, accessed 2026-09-04] It lists
restaurants, cafes, bakeries, supermarkets, pharmacies, and many other retail categories, and takes a
**REAL, independently-reported** commission of roughly **15–20% of restaurant sales**, plus 9% VAT on
that commission deducted before payout — exact rate set per-contract, with both flat-percentage and
tiered (revenue-based) commission structures reported. [WebSearch synthesis of
`restobazar.com/mag/snapp-food-rules-for-restaurants/`, accessed 2026-09-04 — a third-party
restaurant-advisory magazine, not SnappFood's own published pricing] I could not find SnappFood's own
public commission-rate disclosure; this range is CLAIMED-by-a-third-party, not REAL-confirmed-by-primary-source.

SnappFood's market dominance is itself independently documented: Iran's Competition Council (شورای
رقابت), acting on complaints from rivals TapsiFood and Zoodex, ruled in **decision No. 740, dated 16
Ordibehesht 1404 (≈2025-05-06)** that SnappFood's restaurant contracts were anticompetitive — specifically,
that SnappFood offered **commission discounts conditioned on restaurants agreeing to exclusive
cooperation**, with exit penalties for restaurants who tried to leave. An appeals board later confirmed
the ruling and SnappFood's request for reconsideration was rejected; exclusive contract clauses were
ordered removed. [WebSearch synthesis of `zoomit.ir/iran-news/456136-...`, `digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood`,
`ensafnews.com/591739/...`, and the National Competition Council's own decision page
`nicc.gov.ir/council/decisions-council/2184-740-16-1404.html`, accessed 2026-09-04] This is **REAL**
(a government body's own ruling, independently reported by multiple outlets) and directly relevant to
loyalty/rewards economics — see "Restaurant-side commentary," below.

## Loyalty/rewards mechanics — REAL/CLAIMED/UNKNOWN table

| Mechanic | Status | Detail |
|---|---|---|
| **Snapp Club (اسنپ‌کلاب)** — group-wide points program | REAL (existence, structure) | A single loyalty program spanning the *entire* Snapp super-app, not a SnappFood-specific club: users earn **10 Snapp Club points per 1,000 Toman spent** across ride-hailing, cargo/pickup ("وانت"), motorcycle courier, phone credit, internet packages, **and confirmed for food orders too** — one search explicitly confirmed "بله، سفارش غذا در اسنپ فود امتیاز اسنپ کلاب می‌دهد." Points are redeemed as **discount codes**, usable across the group's verticals including SnappFood, not as cash or free items. [WebSearch synthesis of `snapp.ir/blog/club/`, `snapp.ir/blog/points-expiry/`, and a follow-up confirming query, accessed 2026-09-04] |
| Points expiry | REAL | Snapp Club points expire **twice a year — end of spring and end of fall** (a fixed biannual reset, not a rolling per-transaction clock). A near-expiry banner appears atop the Snapp Club screen showing remaining points and days left. [WebSearch synthesis of `snapp.ir/blog/points-expiry/`, accessed 2026-09-04] |
| Formal tiers (e.g., silver/gold/VIP) | **UNKNOWN — not found, likely does not exist** | Multiple targeted searches (Persian and English) for a SnappFood or Snapp Club tier/VIP/level system returned nothing — no named tiers, no tier-based earn-rate multiplier, no status badges. This reads as a genuine absence rather than a search failure: the program is consistently described everywhere as a single flat points pool, unlike Starbucks' Green/Gold/Reserve or Chipotle's stacked-tier design (see `WATCH.md`). |
| Redemption menu | CLAIMED (via coupon-aggregator listings, not SnappFood's own screen) | Example redemptions cited: a 60,000-Toman first-food-order discount code for 1,600 points, a 100,000-Toman Snapp Market discount for 600 points, a 55,000-Toman express-supermarket discount for 900 points, a 54,000-Toman Snapp pharmacy discount for 1,200 points. Redemption menus reportedly vary per user. [WebSearch synthesis of a query combining `myclub.snapp.ir`, `offch.com`, `mopon.ir`, and related coupon aggregators, accessed 2026-09-04] |
| **Snapp Pro (اسنپ پرو)** — paid subscription tier | CLAIMED (financial-benefit framing) / REAL (existence) | A **paid** monthly (and 3-/6-month) subscription (~22,500 Toman/month reported) spanning 5 Snapp verticals: ride-hailing, food, express-supermarket, shop, doctor/consultant. For food specifically: free delivery up to 25,000 Toman per order and 5–20% discounts. Marketing claims subscribers can net up to 5,000,000 Toman/month in value — this specific number is CLAIMED marketing copy, not independently verified against real usage data. This is a *paid* loyalty mechanic, structurally different from the free, points-based Snapp Club. [WebSearch synthesis of `blog.mopon.ir/اسنپ-پرو/`, `snapp.ir/pro/`, `dmboard.media/news/snapp-pro/`, `express.snapp.market/academy/blog/snapp-pro-account/`, accessed 2026-09-04] |
| **FoodParty (فودپارتی)** — daily/campaign discount surface | REAL (existence) / **disputed authenticity for specific claimed discounts** | A recurring in-app promotional surface offering restaurant-selected discounts (10–35% cited). Restaurants themselves can opt in and activate a promotional "party" via SnappFood's own vendor-academy tooling ("پارتی دخل‌فود"), implying restaurant-side, not platform-side, funding in at least some cases (see coupon-culture and restaurant-commentary sections below). |
| Referral/sharing mechanics | UNKNOWN — not verified | No source surfaced describing a specific SnappFood referral-bonus or friend-invite reward structure (distinct from the group-wide Snapp Club). |
| Birthday/anniversary or streak rewards | UNKNOWN — not verified | No source found describing either mechanic for SnappFood specifically (contrast with Fidilio's *claimed* FidiOffer birthday-message feature, itself unverified — see `profiles/fidilio.md`). |

## Coupon-code culture — how central is it to the actual UX vs. any formal points system
**Coupon/discount-code culture is unambiguously the dominant, front-and-center loyalty mechanic in
practice — far more visible in the actual UX than the underlying points system.** Every single search
run for this profile — in Persian, regardless of the specific angle (club, points, reviews, complaints)
— surfaced coupon-aggregator sites (Mopon, Offch, Takhfifhot, Offerjo, Cotakhfif, and SnappFood's own
`myclub.snapp.ir/vendors/food/` coupon hub) as top or near-top results. This mirrors the Fidilio profile's
finding that a third-party aggregator (Mopon) is the visible face of that platform's discounts too — it
appears to be a market-wide pattern in Iranian food-delivery, not SnappFood-specific.

Concretely:
- SnappFood runs **first-order coupons tied to a phone number** (one-time, non-transferable), plus
  category-specific codes (e.g., a 35,000-Toman first pastry-order code, an 80,000-Toman code requiring
  a 170,000-Toman minimum spend on honey/dates/lentils). [WebSearch synthesis of `mopon.ir` listings,
  accessed 2026-09-04 — third-party aggregator, dates/current-validity not independently confirmed]
- Snapp Club's own points system is explicitly *coupon-code-shaped* — you don't redeem points for a
  free item or a discount applied automatically; you redeem points **for a discount code**, which you
  then have to separately find, copy, and paste into the checkout coupon field. This collapses the
  "points program" and "coupon culture" into effectively the same UX surface rather than two competing
  mechanics — a structural observation, not a claim any single source stated outright.
- A real, dated user complaint (Tejaratnews, published **2023-03-04** — older than the preferred
  12-month window, flagged for recency) describes a FoodParty discount as **not genuine**: a user
  reported food priced at 120,000 Toman being "discounted" via FoodParty to 80,000 Toman, but the
  restaurant's own invoice at delivery showed 80,000 Toman as the *undiscounted* price — i.e., the
  "discount" was allegedly manufactured by inflating the sticker price first. Users protested this on
  Twitter/X with statements paraphrased by WebSearch as: *"اسنپ فود قیمت غذاها را بالا برد و در فودپارتی
  گذاشت!"* (SnappFood raised food prices and put them in FoodParty!). [WebSearch synthesis of
  `tejaratnews.com/startup/تخفیف-سفارش-غذا`, accessed 2026-09-04 — I could not independently confirm this
  is verbatim tweet text rather than a paraphrase, and could not confirm whether this pattern recurred
  in 2024–2026 or was a one-time, resolved complaint]
- A separate, undated complaint pattern (WebSearch synthesis of a query touching `vananews.com` coverage)
  describes a case where a user bought a pastry item at a discounted price, then received an SMS from
  SnappFood demanding the user pay the price difference — i.e., a coupon that was honored at checkout
  being partially clawed back after the fact. **UNKNOWN — not verified** whether this was an isolated
  incident or a repeated pattern; I found one description, not a count.

**Net assessment:** coupon codes are the primary, day-to-day loyalty currency Iranian SnappFood users
interact with — an entire third-party economy of coupon-aggregator sites exists purely to surface them
— while the "formal" Snapp Club points system functions more as a slow-accruing background mechanic
that ultimately *cashes out as* another coupon code. There is no evidence of a points-driven status/tier
experience (free-item unlocks, badges, "you've reached Gold") comparable to Western loyalty programs.

## Review synthesis — complaints/praise specifically about rewards/coupons/loyalty (with counts+quotes)
**Honesty check up front, matching the Fidilio profile's precedent:** I could not open Cafe Bazaar's or
Myket's review pages directly (WebFetch blocked), so nothing below is a verbatim, hand-read review I
can personally vouch for — it is what WebSearch's synthesis reported finding at those pages. Aggregate
numbers below are more solid than the two prior profiles' totals (SnappFood is a much bigger, more
widely-covered app than Fidilio or SmartX), but I still could not extract multiple full, quoted,
dated Cafe-Bazaar-specific reviews naming coupons/loyalty by name.

**Aggregate ratings found:**
- **Myket: 4.3/5 across 19,209 comments**, described by the synthesis as "relatively positive... good
  discounts, diverse restaurants, appropriate packaging and food quality." [WebSearch synthesis of a
  Myket-app-store-oriented query, accessed 2026-09-04] This is a real, large sample — but I have zero
  individually-quoted reviews behind this aggregate; it's a summary WebSearch produced, not something I
  can attribute to named reviewers with dates.
- **Cafe Bazaar aggregate rating/count: UNKNOWN — not verified.** Despite several targeted queries
  (including reusing the exact query pattern that successfully surfaced Fidilio's 3.7/5-over-578-ratings
  figure in the prior batch), I could not get WebSearch to surface a specific star rating or review
  count for SnappFood's Cafe Bazaar listing (`cafebazaar.ir/app/com.zoodfood.android`) — a real gap,
  not an assumption of good or bad standing.

**Complaint themes actually found (not padded to five):**
1. **Delivery/payment failures dominate, and loyalty-specific complaints are comparatively hard to
   isolate — this is itself the finding the task asked me to flag if true, and it is true here.**
   Multiple outlets (SNN, YJC, Vananews, Tejaratnews, Click.ir) cover a recurring complaint pattern:
   money deducted from a user's bank account without the order registering in the app, and separately,
   delayed or non-delivered orders with unclear compensation when a restaurant/courier fails to fulfill.
   [WebSearch synthesis of `snn.ir/fa/news/1146095/...` and `yjc.ir/fa/news/8734093/...`, both titled
   "بی‌تفاوتی اسنپ‌فود نسبت به اعتراض کاربران" ("SnappFood's indifference to user protests"), accessed
   2026-09-04] These are general fulfillment/trust complaints, not loyalty-mechanic complaints per se —
   consistent with the task brief's expectation that delivery complaints may crowd out loyalty-specific
   signal.
2. **FoodParty discount-authenticity complaints** (detailed above under coupon culture) — the one
   complaint theme I found that is specifically about the *rewards/discount mechanic itself* rather than
   delivery. Dated 2023, not independently confirmed as an ongoing 2025/2026 pattern.
3. **A social-listening blog (Dataak.com) published a year-long Twitter/X sentiment analysis of
   SnappFood** and concluded user sentiment was **predominantly negative**, framed around SnappFood
   having "eliminated its competitors" after 11 years of operation and consolidated market control.
   [WebSearch synthesis of `dataak.com/blog/بررسی-رضایت-کاربران-توییتر-از-اسنپ-فود/`, accessed
   2026-09-04] I could not get specific tweet counts, verbatim tweet text, or a breakdown of *which*
   themes (loyalty vs. delivery vs. price vs. support) drove the negative sentiment — the synthesis
   described only the overall negative verdict, not a theme-by-theme breakdown. **UNKNOWN — not
   verified** whether loyalty/coupons specifically were a driver of this negativity or whether it was
   entirely delivery/price-driven.
4. Coupon codes reported as failing outright for mundane reasons — expired, mistyped, restaurant/order
   ineligible — a generic, expected pattern rather than a SnappFood-specific defect. [WebSearch synthesis,
   accessed 2026-09-04]

**No verified praise quotes specific to loyalty/coupons were found** beyond the generic "good discounts"
phrase embedded in the Myket aggregate summary above — I am not fabricating additional praise text to
fill out a fuller section, per the task's explicit instruction.

## Notification behavior around promotions
**UNKNOWN — not verified, and the gap itself is informative.** I ran multiple targeted Persian queries
(promotional-notification spam, disabling push notifications specifically for SnappFood, user complaints
about promo-notification frequency) and surfaced only generic Android/iOS notification-management
how-to content with no SnappFood-specific complaint, no SnappFood-specific in-app opt-out toggle
description, and no user complaint naming SnappFood's promotional cadence as a nuisance. This is a real
gap in what I could find — it does **not** mean SnappFood has no promotional-notification behavior or
that users have no complaints; it means neither surfaced through this session's search tooling. Contrast
with Fidilio's profile, where this same gap was also reported — so across two Iranian platforms now,
this specific angle has been hard to substantiate with this tool access.

## Restaurant-side commentary on discount-funding
This is the section with the clearest, most load-bearing finding in this profile:

- **The Competition Council ruling (above) is direct, REAL, third-party (regulatory) evidence that
  SnappFood used commission *discounts* as a lever tied to restaurant exclusivity** — i.e., the
  commission rate a restaurant pays is not a fixed, transparent number but something SnappFood could
  favorably adjust in exchange for exclusive cooperation, which the Competition Council ruled
  anticompetitive and ordered removed. This is adjacent to, but distinct from, consumer-facing coupon
  funding — it's evidence that SnappFood's restaurant-facing commercial terms are opaque and were
  actively used as a competitive weapon, not merely undisclosed (echoing the "opacity" pattern already
  flagged for Fidilio and SmartX in `BRIEF-2026-09-04.md`).
- **On the specific consumer-facing question — who funds a FoodParty/coupon discount, SnappFood or the
  restaurant** — I found a clear directional answer, but only from a secondary, marketing-adjacent
  source, not a first-person restaurant-owner quote or an investigative report: *"رستوران‌ها خود کد
  تخفیف را برای جذب مشتری‌های بیشتر پیشنهاد می‌دهند و هزینه این تخفیف‌ها بر عهده رستوران است"*
  (restaurants themselves offer the discount code to attract more customers, and the cost of these
  discounts is borne by the restaurant) — restaurants are described as accepting a lower per-order
  margin in exchange for higher order volume from increased visibility. [WebSearch synthesis of a query
  combining coupon-culture and restaurant-commission phrasing, accessed 2026-09-04] This is consistent
  with — and reinforced by — SnappFood's own vendor-academy content describing a **"پارتی دخل‌فود"
  ("Dakhl-e-Food Party") tool that restaurants themselves activate**, implying opt-in, restaurant-initiated
  promotions rather than platform-subsidized ones by default.
- Put together with the FoodParty fake-discount complaint (above), the picture that emerges — **CLAIMED/
  circumstantial, not a confirmed financial audit** — matches exactly the global pattern the task asked
  me to check for: platform-presented discounts that read as "SnappFood being generous" are, at least in
  a meaningful share of cases, actually funded out of the restaurant's own margin, with SnappFood's
  commission untouched. I did **not** find a direct, named restaurant-owner testimonial saying "SnappFood
  discounts cut into my margin" — that specific first-person complaint remains **UNKNOWN — not found**
  despite searching for it explicitly. The regulatory ruling and the FoodParty complaint are real; the
  precise mechanics of who's paying for any *given* discount are inferred, not confirmed line-item.

## What Iranian users already expect from a "loyalty" experience, based on this — the habit Rezervno's own loyalty design either has to match or deliberately break from
1. **"Loyalty" in Iran's dominant food app means a coupon-code box at checkout, not a points balance or
   a tier badge.** Every mechanic that touches consumers — first-order codes, FoodParty, Snapp Club
   redemptions — ultimately resolves to the same UI moment: paste a code, watch a price drop. If
   Rezervno builds a points/tier system with no equivalent "there's a code waiting for you" surface,
   it will feel *less* generous to an Iranian user than SnappFood, even if the underlying value is
   identical — the coupon-code interaction itself is the expected reward format, not an implementation
   detail.
2. **Users have learned to distrust "discount" framing specifically because of incidents like the
   FoodParty price-inflation complaint.** A Rezervno discount/reward needs to be *verifiably* the same
   listed price minus X, ideally with the pre-discount price visible and stable — the exact failure mode
   to design against is "the discount looks real until you see the underlying invoice."
3. **A flat, no-tier points pool that expires twice a year on a fixed calendar date (not per-transaction)
   is the incumbent norm**, not the asymmetric/per-tier expiry patterns that caused 2026 backlash for
   Starbucks and Chipotle (see `WATCH.md`). This is one point in favor of Rezervno's own
   `proposals/001-single-clock-loyalty-guardrails.md` direction — a single, predictable, group-wide
   clock is what Iranian users are already used to from the market leader, so a per-tier or per-entry
   divergent clock would be a *regression* from local expectations, not just a global best practice.
4. **A paid subscription tier (Snapp Pro) coexisting with a free points program is normal and accepted**
   in this market — Iranian users do not treat "you have to pay to get better rewards" as inherently
   predatory the way some Western loyalty backlash narratives frame it. This widens Rezervno's design
   space (a paid tier is not automatically a trust risk here) but doesn't by itself argue for building one.
5. **Discount codes are widely understood by Iranian consumers to often be restaurant-funded, not
   platform-funded** — the "who's actually paying for this" question is live in this market's own tech
   press (the FoodParty complaint, the Competition Council's commission-discount findings). If Rezervno
   ever frames a promotion as "on us," it should be prepared for a more skeptical Iranian user than a
   first-time Western SaaS customer would be — transparency about funding source is a differentiator
   available cheaply, given the incumbent's opacity here.
6. **Data-handling trust is a live, dated, twice-repeated failure mode for this market's biggest player**
   (see below) — a genuine data breach (SnappFood, Dec 2023/Jan 2024, 20M+ users) *and* an unrelated
   address-data-sync controversy at a smaller neighboring platform (Fidilio, 2024) in the same ~12-month
   window. This reinforces — with a second, larger, independent data point — the case already made in
   `proposals/002-data-provenance-receipt.md`: visible, auditable data-provenance is a differentiator
   Iranian users have concrete, recent reasons to want, not a hypothetical nice-to-have.

## Sources
All accessed 2026-09-04, all via `WebSearch` synthesis (direct `WebFetch` blocked — see methodology
note at top; tested against both `example.com` and `snappfood.ir`, both `EGRESS_BLOCKED`).

- https://snapp.ir/blog/club/ — "اسنپ‌کلاب؛ باشگاه مشتریان اسنپ با جوایز متنوع در خدمت شماست!"
- https://snapp.ir/blog/points-expiry/ — "دانستنی‌هایی درباره‌ی امتیازهای اسنپ‌کلاب" (points-expiry rules)
- https://myclub.snapp.ir/vendors/food/ — Snapp Club's own SnappFood coupon hub
- https://blog.mopon.ir/اسنپ-پرو/ — Snapp Pro subscription explainer
- https://snapp.ir/pro/ — Snapp Pro landing page
- https://dmboard.media/news/snapp-pro/ — Snapp Pro launch coverage
- https://express.snapp.market/academy/blog/snapp-pro-account/ — Snapp Pro merchant-side benefits
- https://vendors.snappfood.ir/ (multiple pages: vendor-scoring, comment-management-in-foodpartner,
  کمپین‌های اسنپ فود/"پارتی دخل‌فود") — SnappFood's own restaurant/vendor academy content
- https://www.mopon.ir/کد-تخفیف-اسنپ-فود/... and https://www.offch.com/shops/snappfood — coupon
  aggregators (third-party, not SnappFood's own pricing pages)
- https://tejaratnews.com/startup/تخفیف-سفارش-غذا — "شیوه عجیب تخفیف اسنپ فود در فودپارتی!" (2023-03-04)
- https://ensafnews.com/455226/... — "تخفیف دو سر سود؛ مزایای کد تخفیف اسنپ فود برای کاربران و
  رستوران دارها"
- https://snn.ir/fa/news/1146095/... and https://www.yjc.ir/fa/news/8734093/... — "بی‌تفاوتی اسنپ‌فود
  نسبت به اعتراض کاربران/ پول از دسته رفته مشتریان چه می‌شود؟"
- https://vananews.com/fa/news/409695/... — "انبوه شکایات کاربران از اسنپ فود/ بی تفاوتی مدیران اسنپ"
- https://dataak.com/blog/بررسی-رضایت-کاربران-توییتر-از-اسنپ-فود/ — year-long Twitter/X sentiment
  analysis of SnappFood (social-listening firm, not SnappFood or a news outlet)
- https://restobazar.com/mag/snapp-food-rules-for-restaurants/ — restaurant-advisory magazine's summary
  of SnappFood's commission/contract rules
- https://www.zoomit.ir/iran-news/456136-snappfood-monopoly-verdict-tapsi-zoodex/ and
  https://digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood and
  https://ensafnews.com/591739/... — Competition Council ruling coverage (decision No. 740)
- https://www.nicc.gov.ir/council/decisions-council/2184-740-16-1404.html — the National Competition
  Council's own decision page
- https://www.shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked and
  https://digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform and
  https://farnet.io/1402/10/351276/snappfood-hacked/ and
  https://www.tasnimnews.com/fa/news/1402/10/10/3014883/... — SnappFood data-breach coverage
  (10 Dey 1402 / ≈2023-12-31, IRLeaks hacker group, SnappFood's own confirming statement)
- Myket aggregate-rating query result (4.3/5, 19,209 comments) — specific source URL not surfaced by
  the synthesis; flagged as a weaker-sourced figure in "What I did NOT verify"
- https://cafebazaar.ir/app/com.zoodfood.android — SnappFood's Cafe Bazaar listing (attempted; could
  not get aggregate rating/count through synthesis)

## What I did NOT verify
1. **No direct page access this session either** — `WebFetch` blocked for both `example.com` (control)
   and `snappfood.ir` (real target), confirming the prior batch's finding was not a one-off. Everything
   above is WebSearch's own synthesis; I could not cross-check any "quote" against raw page HTML.
2. **Exact SnappFood restaurant commission percentage** — only a third-party range (15–20%) from a
   restaurant-advisory magazine, not SnappFood's own disclosed rate. Exact number per restaurant tier:
   **UNKNOWN**.
3. **Cafe Bazaar aggregate rating/review count for SnappFood** — could not surface despite repeated
   targeted queries, unlike the successful Fidilio equivalent (3.7/5, 578 ratings) in the prior batch.
4. **The Myket 4.3/5-over-19,209-comments figure's exact source URL** — the synthesis stated the number
   confidently but did not cite a specific page; I could not independently verify it's current or attach
   a date.
5. **Individually quoted, dated, named-reviewer complaints about loyalty/coupons specifically** — I have
   zero of these for SnappFood, same structural gap as the Fidilio profile. What I have instead are
   synthesis-paraphrased complaint *patterns* (FoodParty price inflation, SMS clawback of a discount)
   without a reviewer name, exact star rating, or verbatim text I can vouch for.
6. **Whether the FoodParty fake-discount complaint (dated 2023-03-04) recurred or was resolved in
   2024–2026** — only the original 2023 report was found; no follow-up coverage surfaced.
7. **A first-person restaurant-owner quote on discount-funded margins** — I found a directional,
   secondary-source claim that restaurants fund their own FoodParty discounts, but no named
   restaurant-owner testimonial, interview, or complaint thread making this point in their own words.
8. **Notification/promotional-spam behavior specific to SnappFood** — no SnappFood-specific complaint or
   in-app control description surfaced at all (see "Notification behavior" section) — this is a gap in
   what I could find, not evidence the behavior doesn't exist or isn't controllable.
9. **Whether Snapp Club truly has zero tiers**, or whether a tier structure exists but simply isn't
   documented anywhere search-indexed — I am reporting an absence-of-evidence, and flagged it as
   "likely does not exist" rather than "confirmed does not exist," per the honesty rule.
10. **The Dataak.com Twitter-sentiment analysis's underlying theme breakdown** — I know the topline
    verdict (predominantly negative) but not which specific themes (loyalty vs. delivery vs. price vs.
    support) drove it, nor tweet counts or verbatim examples.
11. **Whether the SnappFood data breach (Dec 2023/Jan 2024) had any downstream connection to the later
    Fidilio address-sync controversy (2024)** — both are real, dated, and involve the same corporate
    family's data practices, but I found no source connecting the two incidents causally; treating them
    as separate findings, not implying a link I cannot support.