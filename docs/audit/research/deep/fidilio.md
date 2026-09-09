# Fidilio — Deep Competitor Profile

_Date: 2026-09-07 · Session: Scout deep batch (Sonnet 5, scoped to 4 competitors per
token-budget instruction) · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_

This file synthesizes all 5 corpus files
(`docs/audit/research/corpus/fidilio/{business,features,scale,social,store-reviews}.md`)
plus the prior lighter profile (`docs/audit/research/profiles/fidilio.md` + its 2026-09-05
ADDENDUM). It does not re-fetch the web — it works entirely from what is already on disk. No
file other than this one was written or edited.

## Internal-consistency check performed before writing (Step 1, adversarial, light)

I re-derived or cross-checked the handful of most load-bearing numbers rather than taking them
on faith:

- **WhichApp.ir category average → overall score:** the five category scores in `social.md`
  (Quality 6.9, Service speed 6.2, Price/value 6.9, Support 5.7, Reliability 6.8) average to
  **6.5** — matches the stated "Overall 6.5" exactly. **Passes.**
- **Persian→Gregorian date conversions** on the three verbatim Cafe Bazaar reviews: ۱۴۰۴/۰۶/۲۲
  → 2025-09-13, ۱۴۰۴/۰۷/۱۹ → 2025-10-11, ۱۴۰۴/۰۷/۳۰ → 2025-10-22 (Nowruz 1404 = 2025-03-21, Farvardin–Shahrivar = 6×31 days, Mehr = 31 days). All three check out against the corpus's own stated Gregorian equivalents. **Passes.**
- **Review-theme counts vs. sample size:** theme counts in `store-reviews.md` sum to slightly
  more than the stated sample size of 6 (2+2+1–2+1 ≈ 6–7), but the file itself explains this as
  one review (Alireza's) double-counted into two buckets (OTP-mismatch and generic-bugs). That
  caveat is present in the source, so this is not silent padding. **Passes, with the caveat
  carried forward below.**
- **Reviews-read as % of rated population:** 6 of 581 Cafe Bazaar ratings = 1.03%, under the
  corpus's own stated "under 1.1%." **Passes.**
- **Currency:** every figure in the corpus (min order, coupon cap, loyalty point-value
  inference) is denominated in Toman; no Rial-labeled figure anywhere. **No currency-confusion
  trap found**, unlike the Zarinpal IRT/Rial hazard this repo's own CLAUDE.md warns about.
- **Contradictions the corpus itself already flagged, carried forward unresolved (not
  re-litigated here):** (a) funding — prior profile's "1 investor" (Tracxn, 2026-09-04) vs.
  `scale.md`'s "2 investors, Rubika + Shenasa, $837K total" (2026-09-07, three converging
  queries); (b) Fidilio Club Bronze→Silver tier threshold — one query says 5,000 points, a
  second is silent on it (not contradicting, just missing).
- **Two additional items I am flagging myself, not previously called out in the corpus:**
  1. **Google Play metrics (4.4/5, 1,375 ratings, "50,000+" installs) deserve elevated
     skepticism**, beyond the corpus's own "search-synthesis, unconfirmed" hedge. Every
     `WebFetch` attempt against `play.google.com` failed across all four 2026-09-07 sessions —
     these numbers were never read from a live page, only summarized by a search engine. That
     matters because `store-reviews.md` independently notes "Iranian apps are frequently absent
     from Google Play due to sanctions" as a live, UNKNOWN-either-way hypothesis. A search
     engine producing precise-looking numbers for a listing whose very existence runs against a
     documented sanctions pattern is exactly the shape of a fabrication risk — precise digits
     with no fetch behind them. I am not asserting the numbers are wrong; I am asserting they
     should be weighted **below** the Cafe Bazaar figures (which were fetched first-hand,
     2026-09-05) in any downstream use, and are not corroborated by anything else in the corpus.
  2. **Scale tension, unreconciled anywhere in the corpus:** the company's own marketing claim
     of "12,500+ restaurants, 10,000+ cafes, 5,000+ bakeries" (27,500+ combined venues) sits
     against `scale.md`'s finding that no source claims Fidilio operates outside Tehran, and
     `business.md`'s finding of a 4km delivery radius from the customer. 27,500+ venues fitting
     inside one city's directory is not impossible for a 2008-founded discovery site (listing
     ≠ deliverable-within-4km), but nothing in the corpus reconciles whether the marketing count
     is Tehran-only, nationwide-but-undocumented, or simply stale/inflated. Flagging rather than
     resolving.

No other internal contradictions were found. Everything else cross-checks cleanly across the 5
files (order-economics figures, loyalty earn-rate examples, headcount figures, review dates).

---

## What it is

Fidilio (فیدیلیو) is one of Iran's oldest restaurant/cafe/bakery discovery platforms, founded in
**1387 (2008)** by **Meysam Mashayekhi** — for roughly 16 years (2008–2024) its core product was
a directory/review site, not delivery or reservation. In **June 2024 (Khordad 1403)** it entered
online food ordering/delivery, followed a month later by a distribution partnership with
**Rubika** (an Iranian messenger/super-app). Delivery has historically run through **ZoodFood**
(rebranded **Snapp Food** in 1396/2017). [`profiles/fidilio.md` §"What it is", search-synthesis
of Digiato/Zoomit/Tabnak/Startup360/Shanbe Magazine, 2026-09-04 — **not re-verified this
session**, carried forward]

**Legal entity (new, `scale.md` Finding 9):** «شرکت فن آوری تجارت هوشمند لاوین» ("Lavin Smart
Commerce Technology Co."), per Shenasa's own portfolio page — **company-claimed via the
investor**, not independently filed-registry-verified. [`scale.md` Finding 9, search-synthesis,
2026-09-07]

**A late-2024 controversy is the single most consequential trust event in the whole corpus:** a
bug (or, per some reporting, more than a bug) caused addresses saved in Snapp Food to appear
automatically, and stay in sync, inside Fidilio's own address list. CEO Mohammad Bagheri called
it a "technical bug" from API integration and denied data was "handed over"; Digiato, Tabnak,
and Startup360 all reported this while noting the resemblance went beyond an isolated glitch.
`social.md` Finding 3 (new) independently corroborates the underlying dynamic from a different
angle: a restaurant owner told Zoomit that after signing with Fidilio, SnappFood deactivated
their SnappFood panel for about a week, telling them it would stay off "until Fidilio removes
the restaurant from its site" — real evidence Fidilio is treated as a threat worth enforcing
against, not evidence of wrongdoing by Fidilio itself. [`profiles/fidilio.md` §"What it is";
`social.md` Finding 3, search-synthesis, both cross-referenced, 2026-09-04/07]

## Who it's for

- **Consumers**, Tehran-concentrated (no session found evidence of coverage outside Tehran),
  discovering/reviewing venues and, since June 2024, ordering delivery. Minimum order **100,000
  Toman**; delivery is diner-free, restaurant-funded; **4km service radius**; **under-30-minute**
  delivery SLA claim. [`business.md` §4, search-synthesis, unverified against primary source,
  2026-09-07]
- **Restaurant/cafe owners** who list on the directory and, for delivery, pay a
  percentage-of-sales commission "per contract" — **rate never disclosed anywhere in the open
  web across 4 sessions and 15+ differently-phrased queries.** [`business.md` §1]

## Business model & pricing

| Figure | Value | Currency | Label | Source / date |
|---|---|---|---|---|
| Restaurant signup/listing fee | 0 (none) | — | search-synthesis | `business.md` §1, query #13, 2026-09-07 |
| Restaurant commission rate | **UNKNOWN — not verified** | — | — | `business.md` §1; 4 sessions, 15+ queries, never surfaced |
| Minimum order value | 100,000 | Toman | search-synthesis, unverified | `business.md` §4, query #29 |
| Delivery fee to diner | 0 (restaurant absorbs it) | Toman | search-synthesis, unverified | `business.md` §4, query #29 |
| Service radius | 4 | km | search-synthesis, unverified | `business.md` §4, query #29 |
| Delivery SLA claim | under 30 | minutes | search-synthesis, unverified | `business.md` §4, query #29 |
| Fidilio Club earn rate | 1–5 points per 2,000 | Toman | search-synthesis, unverified | `business.md` §5, query #17 |
| Café Restaurant Saran offer | 15% off + 2 pts/2,000 | Toman | search-synthesis, unverified | `business.md` §5, query #17/18 |
| Larisa Vank offer | 10% off + 2 pts/2,000 | Toman | search-synthesis, unverified | `business.md` §5, query #17/18 |
| Silver→Gold tier threshold | 12,000 | points | search-synthesis, 2 sources agree | `business.md` §5, queries #6, #17 |
| Bronze→Silver tier threshold | **5,000 (query #17) vs. not stated (query #6) — contradiction, not resolved** | points | search-synthesis | `business.md` §5 |
| Silver maintenance | ≥2,500/year to avoid demotion | points | search-synthesis | `business.md` §5, query #6 |
| Gold maintenance | ≥6,000/year to avoid demotion | points | search-synthesis | `business.md` §5, query #6 |
| Point value (**not a disclosed redemption rate** — search-engine's own inverse arithmetic on the earn rate, flagged as synthesis inference, do not cite as company disclosure) | ≈400–2,000 | Toman/point | inference, explicitly not a company figure | `business.md` §5, query #18 |
| Ramadan coupon cap | up to 10% off, capped at 100,000 | Toman | search-synthesis, Mopon-sourced | prior profile, carried forward |
| Total funding raised | $837,000 | USD | independent aggregator estimate (PitchBook/Tracxn/Crunchbase) | `scale.md` §2, queries #7/#12/#16, 2026-09-07 — **contradicts prior session's "1 investor" framing (below)** |
| Fidilio's own marketing rating claim | "4.9 stars" | — | company-claimed | prior profile — **still unreconciled against the independently-observed 3.7/5 (Cafe Bazaar) or even the higher 4.4/5 (Google Play, itself unconfirmed)** |
| Fidilio's own venue-count claim | "12,500+ restaurants, 10,000+ cafes, 5,000+ bakeries" | — | company-claimed, undated | prior profile — see scale-tension flag above |

**Contradictions listed, not resolved, per task instruction:**
1. **Investor count / funding total.** `profiles/fidilio.md` (2026-09-04): Tracxn says "1
   investor." `scale.md` (2026-09-07, three independently-phrased queries converging): Rubika
   (Iran) and Shenasa, **two** named investors, **$837K** total — a number that appears nowhere
   before this session. Both are recorded with their session dates; neither is asserted as more
   accurate.
2. **Fidilio Club Bronze→Silver threshold**, as above.
3. **Rating claim vs. independent aggregates.** Company: "4.9 stars." Cafe Bazaar (fetched
   first-hand, 2026-09-05): 3.7/5, 581 ratings. Google Play (search-synthesis only,
   2026-09-07, elevated-skepticism flag above): 4.4/5, 1,375 ratings. None of these three
   reconcile with each other, and only the Cafe Bazaar figure was ever read from a live page.

**No signup fee, restaurant-owner-side commission complaints, contract exclusivity/auto-renewal
terms, refund windows, or Fidilio Club membership cost were found by any session** —
`fidilio.com/rules` and `business.fidilio.com/رستوران/` are now named as the two highest-value
unread targets (`business.md` §2–3). All: **UNKNOWN — not verified.**

## Users / scale

| Metric | Value | Label | Source / date |
|---|---|---|---|
| Cafe Bazaar installs | 110,000 | independent (store aggregate, **fetched first-hand**) | 2026-09-05 |
| Cafe Bazaar rating / count | 3.7/5, 581 ratings | independent, **fetched first-hand** | 2026-09-05 |
| Google Play installs | "50,000+" | independent-labeled, but **search-synthesis only, never fetched — see elevated-skepticism flag above** | `scale.md` §1, query #18, 2026-09-07 |
| Google Play rating / count | 4.4/5, 1,375 ratings | search-synthesis only, same caveat | `scale.md` §1, query #18, 2026-09-07 |
| Myket listing | exists; installs/rating **not obtained** | existence only, search-synthesis | `scale.md` §1, queries #17/#19 |
| MAU / registered users | **UNKNOWN — not verified** | — | `scale.md` §3, 2 queries, zero results |
| Website traffic (Similarweb/SEMrush/Ahrefs) | **UNKNOWN — not verified** | — | `scale.md` §3, 2 queries, zero results |
| Revenue / GMV | **UNKNOWN — not verified** | — | `scale.md` §5, zero results |
| City coverage | Tehran only, per available evidence — **not confirmed exhaustively** | mixed | `scale.md` §4, query #4 |
| Restaurant/cafe/bakery count, independent | **UNKNOWN — not verified** (only the company-claimed 12,500+/10,000+/5,000+ figure exists, unreconciled — see scale-tension flag) | company-claimed only | prior profile |
| Total funding | $837,000 (contradicts prior "1 investor" framing) | independent aggregator estimate | `scale.md` §2, 2026-09-07 |
| Headcount (LinkedIn) | 11–50 employees | company-claimed (self-reported field) | `scale.md` §7, query #8 |
| Headcount (Tracxn) | 14, "as of May 31, 2026" | third-party estimate, sits inside the LinkedIn band, no contradiction | `scale.md` §7, query #7 |
| Current job postings confirmed | 1 (graphic designer, Tehran, urgent, Jobvision) | search-synthesis | `scale.md` §8 |
| WhichApp.ir aggregate | 6.5/10 overall (5 categories, verified to average correctly — see Step-1 check above); **support 5.7/10, the lowest category** | independent, aggregate-only, sample size 11 submitters, zero individual quotes recoverable | `social.md` Finding 4 |

**Retired items from prior gap lists:** Google Play's *existence* is now confirmed (previously
fully UNKNOWN) — but only as existence; its metrics carry the elevated-skepticism flag above.
Myket's existence is confirmed; its metrics remain unobtained. iOS/Apple App Store presence
remains **UNKNOWN — not verified** across every session to date.

## Feature inventory

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Restaurant/cafe directory & search | **REAL** | 2008–2026 independently-documented operating history; live `fidilio.com/restaurants/<slug>` venue pages confirmed by search this session (`features.md` #1) |
| 2 | User reviews per venue (store-listing level) | **REAL**-leaning | Cafe Bazaar's own listing shows 581 ratings with visible text, fetched first-hand 2026-09-05; in-app venue-level review display specifically is CLAIMED only, not operated (`features.md` #2) |
| 3 | Photo upload/gallery per venue | **UNKNOWN — not verified** | Targeted query did not execute (budget exhausted) (`features.md` #3) |
| 4 | Online table reservation ("رزرو میز") | **CLAIMED** | Only sourced from Fidilio's own magazine headlines. Soft negative signal against it: the app's Cafe Bazaar store name is «سفارش غذا» (food ordering, not reservation), and **zero of the 6 known reviews mention booking/table selection at all** (`features.md` #4) |
| 5 | Booking-flow steps/screens | **UNKNOWN — not verified** | No source describes this; one dedicated query this session hit only an unrelated hotel-PMS name collision ("Fidelio") (`features.md` #5) |
| 6 | Table-level/floor-plan selection | **UNKNOWN — not verified** | No source anywhere in the corpus (`features.md` #6) |
| 7 | Waitlist (in-app digital queue) | **UNKNOWN — not verified** | The only "queue" evidence found is a *physical* walk-in line at one restaurant (Shandiz), not an in-app feature (`features.md` #7) |
| 8 | Deposits/prepayment for reservation | **UNKNOWN — not verified** | Targeted query returned zero Fidilio-specific results (`features.md` #8) |
| 9 | Cancellation-policy display | **UNKNOWN — not verified** | Same null result (`features.md` #9) |
| 10 | Online food ordering / delivery checkout | **REAL** | Independently confirmed live since June 2024 (Zoomit, Digiato, Tabnak); a real online-payment step was observed (failing with a 404) in a fetched review (`features.md` #10) |
| 11 | Push notifications (existence/opt-out) | **UNKNOWN — not verified** | Zero evidence across the entire research line (`features.md` #11) |
| 12 | Loyalty earn mechanic (Fidilio Club) | **CLAIMED** | Per-merchant range, 1–5 pts/2,000 Toman, two named current examples; search-synthesis only, never operated (`features.md` #12) |
| 13 | Loyalty tier structure (bronze/silver/gold) | **CLAIMED, unresolved internal contradiction** | See pricing table above (`features.md` #13) |
| 14 | Loyalty points expiry | **UNKNOWN — not verified** | Zero Fidilio-specific results (`features.md` #14) |
| 15 | Loyalty redemption mechanic/rate | **UNKNOWN — not verified** | The "≈400–2,000 Toman/point" figure is inference, not disclosure (`features.md` #15) |
| 16 | Loyalty referral mechanic | **UNKNOWN — not verified** | No source describes one, in contrast to TheFork's documented 500-point YUMS referral (`features.md` #16) |
| 17 | Loyalty streaks | **UNKNOWN — not verified** | Never targeted or found (`features.md` #17) |
| 18 | Loyalty birthday/anniversary reward (diner-facing) | **UNKNOWN — not verified** | Only "birthday" evidence found is FidiOffer's **restaurant-facing** CRM tool, not a diner perk — explicitly distinguished (`features.md` #18) |
| 19 | Coupon/discount codes | **REAL (existence)**, funding source **UNKNOWN** | Mopon-listed Ramadan code; funding-source query returned an explicit non-answer (`features.md` #19) |
| 20 | RTL Persian interface | **REAL** at the language level; self-hosted-fonts sub-claim **UNKNOWN** | Whole product surface is Persian; font-hosting method never confirmed (`features.md` #20) |
| 21 | Accessibility | **UNKNOWN — not verified** | Zero evidence across 4 sessions, 100+ queries (`features.md` #21) |
| 22 | Offline behaviour | **UNKNOWN — not verified** | Zero evidence (`features.md` #22) |
| 23 | iOS app | **UNKNOWN — not verified** | Only a third-party mirror ever referenced it (`features.md` #23) |
| 24 | Restaurant/business partner portal (`business.fidilio.com`) | **REAL (existence)**, content **UNKNOWN** | Confirmed via 4 independently-phrased queries; unreadable (`EGRESS_BLOCKED` every attempt) (`features.md` #24) |
| 25 | FidiOffer (merchant CRM, gamified offers, birthday/anniversary automation) | **CLAIMED** | Fidilio's own magazine only, no independent confirmation (`features.md` #25) |
| 26 | Restaurant CRM segmentation/tagging | **UNKNOWN — not verified** | No comparable evidence to SevenRooms'/Servme's documented tag systems (`features.md` #26) |
| 27 | Marketing automation beyond birthday messages | **CLAIMED (limited)** | Only the named capability, nothing else found or ruled out (`features.md` #27) |
| 28 | Restaurant self-serve pricing transparency | **UNKNOWN — not verified** | Commission rate never disclosed anywhere (`features.md` #28) |
| 29 | POS integration | **UNKNOWN — not verified** | Zero evidence; contrast with Delino's named "Sepid POS" integration in the same source article (`features.md` #29) |
| 30 | Payment gateway identity | **UNKNOWN (identity)**, **REAL (some gateway exists)** | A 404 payment failure was observed; which Iranian gateway is used was never named (`features.md` #30) |
| 31 | Restaurant-side notification opt-out control | **UNKNOWN — not verified** | Not addressed by any session (`features.md` #31) |
| 32 | Table capacity/hours/blackout-date management | **UNKNOWN — not verified** | No source describes this (`features.md` #32) |

## Review synthesis

**Total reviews with any text content found across the entire Scout research line: 6** consumer
app reviews (3 fetched verbatim from Cafe Bazaar, 2026-09-05; 3 search-synthesized, unnamed/thin,
2026-09-04) — against a background of **581 rated users** on Cafe Bazaar alone, i.e. **~1.0%**
coverage. This is an honest, repeatedly-confirmed ceiling: three additional 2026-09-07 sessions
(store-reviews.md's own 28–35 queries, features.md's 5-of-30-planned queries) ran extensive
further search passes and **surfaced zero new verbatim quotes**. WhichApp.ir adds an
**aggregate-only** 11-submitter sample with no individual text recoverable. One Glassdoor
employee review (not a consumer review) is quoted separately below.

**Per the task's rule against padding, this is not a "top 5" list — it is the full honest list.**
Fabricating a fifth complaint or any praise theme to fill the template would violate the
evidence rules both this task and the repo's constitution require.

### Top complaints (all with sample sizes, none fabricated)

1. **OTP/SMS code length mismatch (6-digit code sent, 4-digit field accepted)** — count: 2 of 6,
   sample_size: 6. Reported **twice, 28 days apart, by different users, never confirmed fixed**.
   - **علیرضا — ۱۴۰۴/۰۶/۲۲ (≈2025-09-13), Cafe Bazaar:** «برنامه بسیار ضعیفه پشتیبانی فاجعه س
     کد تایید هم 6 رقمی میفرستن ولی برنامه 4 رقمی میخواد» — "The app is very weak, support is a
     disaster, and they send a 6-digit verification code but the app asks for 4 digits."
   - **محمد — ۱۴۰۴/۰۷/۱۹ (≈2025-10-11), Cafe Bazaar:** «این دیگه چجورشه کد تایید شش رقمی برای
     وارد کردن 4 رقم!!» — "What kind of thing is this — a six-digit verification code to enter
     into 4 digits!!"
2. **Payment/checkout failure (404 error)** — count: 1 of 6 (fetched, verbatim), plus 1 more
   possibly-related search-synthesized report ("Ali", not confirmed same bug class),
   sample_size: 6.
   - **alireza — ۱۴۰۴/۰۷/۳۰ (≈2025-10-22), Cafe Bazaar:** «واقعا افتضاحه تازه که وارد برنامه
     میشی یه ارور 404میده بعد موقع پرداخت انلاین» — "Truly awful — the moment you enter the app
     it gives a 404 error, then during online payment…" (text cuts off as printed on the source
     page).
   - **"Ali" — ~2025-09-03, search-synthesized, paraphrase not verbatim:** app has "many bugs...
     particularly with payment functionality showing a 'user does not exist' error even after
     re-logging in."
3. **Generic instability/bugginess** — count: 2 of 6, sample_size: 6 (overlaps with #1 above —
   علیرضا's review double-counts here, flagged explicitly).
   - Same علیرضا quote as above.
   - **"arash" — ~2025-09-05, search-synthesized, paraphrase:** «کماکان مشکل دارد» — "still has
     problems."
4. **Support/responsiveness is the weakest measured dimension** — independent aggregate signal,
   sample_size: 11 (WhichApp.ir submitters; no individual quotes recoverable). Score: 5.7/10, the
   lowest of five categories, **independently consistent with** (different population, no known
   overlap) the Cafe Bazaar phrase «پشتیبانی فاجعه س» ("support is a disaster") in complaint #1.
5. **Restaurant-side risk from association, not a Fidilio-caused defect** — count: 1 (Zoomit-
   reported restaurant-owner account), sample_size: 1. A restaurant that signed with Fidilio had
   its SnappFood panel deactivated for ~1 week by SnappFood, told it would stay off "until
   Fidilio removes the restaurant from its site" (paraphrase, `social.md` Finding 3). Included
   because it is a real, dated, sourced account — not because it is a defect in Fidilio's own
   product.

### Top praises

**None found. Zero.** Every session across the whole research line — 100+ combined search
queries — has found **no five-star or positive-leaning verbatim/paraphrased consumer review
text**. The only positive-adjacent signals in the whole corpus are (a) one "acceptable" (قابل
قبول) neutral comment, unnamed, ~2025-09-16, search-synthesized, not really praise; and (b)
WhichApp's Quality/Price categories scoring respectably (6.8–6.9/10, aggregate-only, no
individual text). **I am not fabricating praise quotes to fill five slots** — the same
discipline the prior profile and the 2026-09-07 corpus sessions already applied.

### Adjacent: one employee-side review (not a consumer review, kept separate)

**Glassdoor, Front End Developer, tenure <1 year, ~September 2021** (outside the task's
preferred 12-month window — included as the only employee-side account found in any session):
Overall rating 4.0/5. Con, verbatim per search result's own quotation marks: *"This company
won't have any code review that we will not understand where we can better."* [sic, ungrammatical
in original] Sample size: 1.

## Gen-Z lens scorecard

1. **Time to first value** — **UNKNOWN — not verified.** No session operated the app; no source
   discusses onboarding speed.
2. **Money respect** — **Partial evidence, mixed.** A Mopon-listed coupon exists (capped Ramadan
   discount), and delivery is diner-free (restaurant-funded) with a low 100,000 Toman order
   minimum — all search-synthesis, unverified. But the restaurant-side commission that ultimately
   funds these is entirely undisclosed, so whether restaurant margins (and therefore prices) are
   actually respected cannot be assessed.
3. **Does it feel like now** — **Mixed.** The 2024 delivery pivot and Rubika distribution deal are
   REAL, press-confirmed modernization moves. Against that: the only recent user-facing signal
   (all 6 known reviews, Sept–Oct 2025) describes bugs, a broken OTP flow, and a payment failure
   — and **zero of those 6 reviews mention the marketed table-reservation feature at all**, a
   soft signal it may not be a live, used surface.
4. **Shareability** — **Thin, mixed signal.** X: 1,273 followers after 14 years (joined 2012) —
   strikingly low for a brand calling itself "Iran's first digital platform for the food
   industry." Threads (younger product): ~21.6K followers, ~17x the X count on the same brand.
   Facebook: ~97,869 likes. No in-app referral/sharing mechanic found anywhere in the corpus.
5. **Trust** — **The most concrete finding in the whole profile, and it is negative.** The
   SnappFood address-data-sync controversy (three independent outlets, CEO's own "technical bug"
   statement, disputed by the outlets' own framing) plus this session's new corroboration
   (`social.md` Finding 3: a restaurant's SnappFood panel deactivated over its Fidilio
   relationship) together show Fidilio operating inside a contested, undisclosed-until-discovered
   data/market relationship with its largest rival. REAL, multi-sourced.
6. **Notification behaviour** — **UNKNOWN — not verified.** Zero evidence across every session.
7. **Steal / never-copy:**
   - *Steal:* 16+ years of accumulated venue-listing density (2008–2026) across restaurant,
     cafe, bakery, juice/ice-cream categories — a genuine, slow-to-replicate content moat. REAL.
   - *Never copy:* an ambiguous, undisclosed data-sharing/competitive relationship with a
     dominant partner that becomes a public controversy when users discover it themselves,
     rather than being disclosed upfront. Directly relevant to why this repo's own
     `ctx.restaurant.id`/`auth.tenantId`-only tenant-isolation rule exists (see §9 below).

## Where it beats Rezervno today

- **16+ years of accumulated restaurant/cafe/bakery discovery content and brand recognition**
  in the Tehran market (2008-founded, independently covered by Digiato/Zoomit/Tabnak/Startup360/
  GSM.ir across nearly two decades) — a content and trust moat that cannot be replicated by
  engineering alone. [`profiles/fidilio.md` §"What it is"]
- **A live, operating food-delivery business with real order volume implied by 110,000–581-rated
  installs on Cafe Bazaar alone** (fetched first-hand, 2026-09-05), plus a distribution
  partnership with Rubika (an Iranian super-app) that gives it a second acquisition channel
  Rezervno does not currently have evidence of matching. [`profiles/fidilio.md`, `scale.md`]
- **A structured, tiered diner loyalty program (Fidilio Club: bronze/silver/gold, per-merchant
  earn rates, named live merchant examples)** — even though several mechanics (expiry,
  redemption minimum, membership cost) are unverified, the tier *structure itself* is more
  elaborated than anything documented for Rezervno in this research line. **UNKNOWN whether
  Rezervno has an equivalent** — out of scope for this file to verify (no repo grep was run for
  this claim, per the task's instruction that only §9 requires repo verification).

## Where Rezervno beats it — repo-verified, file:line citations

Every item below was independently confirmed by me on the current repo (`git log -1`:
`9c434d0` on branch `claude/scout-competitive-research-4jtmcv`, 2026-09-07) via Grep/Read this
session — not assumed from any doc's claim, including the prior profile's own addendum, which I
re-checked rather than trusted.

1. **Fail-closed OTP/SMS discipline with explicit, non-silent logging, vs. Fidilio's confirmed,
   unfixed 6-digit-sent/4-digit-accepted OTP defect.** `api/src/lib/sms.ts:278-284`: when a
   template's `bodyId` is missing, the code refuses to guess and logs
   `'bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد'` rather than sending a malformed/guessed
   template. This is architecturally the class of contract-drift bug (sender/receiver
   disagreement on what's expected) that Fidilio shipped to 110,000 installs and left
   unresolved for at least 28 days across two independent user reports (`profiles/fidilio.md`
   ADDENDUM, ~2025-09-13 to ~2025-10-11). I confirmed the guard is still live in the current
   source, not merely claimed in the prior addendum.
2. **Structured, named domain errors vs. Fidilio's unexplained generic 404 at checkout.**
   `api/src/lib/errors.ts:21,35,46` — `Err.tableConflict()` ("این میز در این بازه رزرو شده
   است", 409), `Err.slotFull(time)` ("ساعت … پر است…", 409), `Err.concurrencyRetry()` ("به دلیل
   ترافیک بالا رزرو ثبت نشد…", 409) — every domain conflict returns a specific, Persian,
   user-actionable message and status code. Fidilio's only observed payment-path failure in the
   whole corpus is an unexplained, bare "404" with no further detail (alireza review,
   ≈2025-10-22).
3. **Retry-capable error UI wired into the booking/waitlist flow itself**, vs. no evidence of any
   retry affordance in Fidilio's reviewed failure. `apps/customer/js/waitlist.js:58-66`
   (`wlError(msg, retryCall)`, rendering a "تلاش دوباره" / "Try again" button) and
   `apps/customer/js/data/booking.js:349` (same retry button on a failed booking confirm) are
   live in the current source — a direct implementation of this project's own four-state
   (loading/empty/error+retry/success) UI rule from CLAUDE.md, in the exact flow class
   (reservation/checkout) where Fidilio's own reviewed failure occurred.
4. **A real, implemented in-app digital waitlist**, vs. Fidilio's feature status of
   **UNKNOWN — not verified, no evidence found anywhere in the corpus** (`features.md` #7:
   "No source anywhere in the corpus describes an in-app waitlist/queue-join mechanic").
   `apps/customer/js/waitlist.js` (219 lines, header comment «رزرونو — لیستِ انتظار (مدلِ
   OpenTable)» — "Rezervno — Waitlist (OpenTable model)") is live code implementing
   `offerWaitlist()` and a full join/position/cancel flow. This is a code-existence citation, not
   a claim of confirmed production usage volume.
5. **Tenant isolation enforced only from the authenticated context, never from body/query** —
   the direct architectural counter to the ambiguous, undisclosed-until-discovered Fidilio/
   SnappFood address-data relationship that became a public trust controversy.
   `api/src/lib/with-restaurant-auth.ts:176,182`: staff auth explicitly checks
   `if (staff.tenantId !== auth.tenantId) throw Err.forbidden();` before returning a context
   whose `tenantId` downstream code must use — the same file's own doc-comment (line 43) shows
   the intended pattern, `where: { restaurantId: ctx.restaurant.id }`, never from a client-
   supplied field.
6. **Self-hosted Persian font, vs. Fidilio's self-hosted-fonts sub-claim remaining fully
   UNKNOWN.** `shared/fonts/vazirmatn-variable.woff2` (plus `Vazirmatn-OFL.txt`, `README.md`)
   exists in the current repo — confirmed via directory listing this session. `features.md` #20
   explicitly leaves Fidilio's font-hosting method (self-hosted vs. remote/Google Fonts, which
   is unreachable from Iran) as UNKNOWN, "a specific concern given this project's own CLAUDE.md
   rule."
7. **Explicit currency handling for the Zarinpal gateway**, vs. Fidilio's payment-gateway
   identity being entirely unknown. `api/src/lib/zarinpal.ts:40` sets `currency: 'IRT'`
   explicitly with an inline comment warning that omitting it defaults to Rial (10x error).
   Fidilio's own gateway choice (Zarinpal, Zibal, IDPay, Behpardakht, or other) was never named
   by any session (`features.md` #30) — so I cannot claim Fidilio *has* this specific bug, only
   that Rezervno has repo-verified protection against the class of error that a 404-producing,
   unexplained payment failure (Fidilio's own observed defect) is at minimum adjacent to.

**What I did not attempt to verify for §9** (explicitly, so this isn't read as exhaustive):
whether Rezervno has floor-plan/table-level selection (grepped, found none — so I am not
claiming this as a win), whether Rezervno's loyalty program has a comparably elaborated tier
structure to Fidilio Club's bronze/silver/gold (out of scope — would require its own repo pass),
and whether any of the cited code paths are actually exercised in production today (file
existence and logic were confirmed; live production behavior was not re-tested this session).

## Corrections to the prior (lighter) profile / MATRIX.md

1. **Funding.** The prior profile's "1 investor" (Tracxn, 2026-09-04) should not be treated as
   settled — `scale.md` (2026-09-07) found a materially different, more specific figure ($837K,
   2 named investors) from three independently-phrased queries against Crunchbase/Tracxn/
   PitchBook. Present both, dated, per the contradiction rule above; do not silently prefer
   either.
2. **Install/rating picture is now three stores, not one.** The prior profile (and its
   2026-09-05 addendum) only had Cafe Bazaar. `scale.md` adds Google Play (existence +
   unconfirmed metrics, elevated-skepticism flag above) and Myket (existence only). Any
   downstream document (including `MATRIX.md`, per `scale.md`'s own note) citing "Cafe Bazaar:
   3.7/5, 581 ratings, 110,000 installs" as Fidilio's full footprint should be updated to note
   these additional, less-verified data points exist — **not** to replace the Cafe Bazaar figure,
   which remains the only one actually fetched.
3. **Fidilio Club is materially better-documented than the prior profile's single undated
   Facebook post suggested.** `business.md` §5 adds a per-merchant earn-rate range, two named
   current merchant examples, and a (contradictory-in-one-detail) tier-threshold structure. The
   prior profile's loyalty section should be treated as superseded in *detail*, though not in
   its underlying UNKNOWNs (membership cost, expiry, redemption minimum all remain open).
4. **New named URLs that should be the top research priority for any future WebFetch-capable
   session on this competitor:** `fidilio.com/rules` (ToS), `business.fidilio.com/رستوران/`
   (B2B portal), `club.fidilio.com/membership` (loyalty terms — note this one failed DNS, not
   `EGRESS_BLOCKED`, a possibly-transient distinct failure mode worth retrying first). None of
   these were known to the prior (2026-09-04/05) profile.
5. **`MATRIX.md` was not edited by this file**, per the task's single-output-file instruction —
   but its Fidilio row/footnotes should be revisited by whoever next touches that file to
   incorporate points 1–4 above.

## Sources

Every corpus file used in full: `docs/audit/research/corpus/fidilio/business.md`,
`docs/audit/research/corpus/fidilio/features.md`, `docs/audit/research/corpus/fidilio/scale.md`,
`docs/audit/research/corpus/fidilio/social.md`,
`docs/audit/research/corpus/fidilio/store-reviews.md`. Prior profile:
`docs/audit/research/profiles/fidilio.md` (main body + 2026-09-05 ADDENDUM). Each corpus file
carries its own full source list (WebFetch attempts, WebSearch queries, and every URL cited by
search-synthesis) — not reproduced verbatim here; see each file's own "Sources" section for the
underlying citation chain.

Repo facts in §9 verified this session directly against the working tree at commit `9c434d0`
(branch `claude/scout-competitive-research-4jtmcv`): `api/src/lib/sms.ts`,
`api/src/lib/errors.ts`, `apps/customer/js/waitlist.js`, `apps/customer/js/data/booking.js`,
`api/src/lib/with-restaurant-auth.ts`, `shared/fonts/` (directory listing), `api/src/lib/zarinpal.ts`.

## What was NOT verified

This deep profile inherits every UNKNOWN already logged in the 5 corpus files' own "What this
session did NOT verify" sections (not reproduced exhaustively here — see each file). The
highest-value, still-open items, consolidated:

1. **Restaurant commission rate** — never found, across 4 sessions and 15+ queries.
2. **`fidilio.com/rules` and `business.fidilio.com/رستوران/` full content** — both located,
   neither ever read (`EGRESS_BLOCKED` every attempt).
3. **MAU, registered users, website traffic, revenue/GMV** — all UNKNOWN, zero results despite
   direct targeting.
4. **Google Play and Myket metrics** — existence confirmed; actual numbers either unconfirmed
   (Google Play, elevated-skepticism flag) or unobtained (Myket).
5. **iOS app existence** — UNKNOWN across every session to date.
6. **Fidilio Club membership cost, points expiry, redemption minimum, referral mechanic** — all
   UNKNOWN.
7. **Notification behaviour, accessibility, offline behaviour, POS integration, payment-gateway
   identity** — zero evidence anywhere in the corpus for any of these.
8. **No app was installed and no account was created by any Scout session to date.** Every
   REAL/CLAIMED distinction in the feature inventory rests on that limit — nothing in this
   profile should be read as first-hand operation of Fidilio's UI.
9. **This deep-profile pass itself did not re-run any WebFetch or WebSearch** — per the task's
   token-budget instruction, everything above is synthesis of the existing corpus plus
   repo-side verification for §9 only. Any figure the corpus itself marked UNKNOWN remains
   UNKNOWN here; I did not attempt to close any gap with a fresh web query.
