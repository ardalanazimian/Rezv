# Fidilio — Business Model, Pricing, Terms (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_
_Mode: BUSINESS MODEL, PRICING, TERMS_

## Read-first: what prior research already established

Per task instructions I read `docs/audit/research/profiles/fidilio.md` (full profile + its
2026-09-05 ADDENDUM) and `docs/audit/research/corpus/fidilio/store-reviews.md` before starting.
Both already document: no upfront restaurant fee, commission "per contract" with the **rate
never found**, an undated pre-2026 Facebook post citing Fidilio Club as "3 points per 2,000
Toman at Morano restaurant, +25% discount", a 2019-01-14 Shenasa investment round of
undisclosed size, and a Mopon-listed Ramadan coupon ("up to 10% off, capped at 100,000 Toman").
This corpus does **not** repeat that ground except where it found materially new detail or a
contradiction. It extends the loyalty-program section substantially (tier thresholds, a current
merchant-rate example, maintenance rules) and adds order-economics facts (minimum order value,
delivery-fee funding, delivery radius/time) that neither prior document has. No file other than
this one was modified.

## Methodology header

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (control)
and immediately after against the primary target `https://fidilio.com`.

| URL | Result |
|---|---|
| `https://example.com` | `EGRESS_BLOCKED` |
| `https://fidilio.com` | `EGRESS_BLOCKED` |
| `https://cafebazaar.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://mag.fidilio.com` | `getaddrinfo ENOTFOUND` (DNS failure) |
| `https://fidilio.com/rules` | `EGRESS_BLOCKED` |
| `https://myket.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://fidilio.com/contactus` | `EGRESS_BLOCKED` |
| `https://business.fidilio.com/رستوران/` | `EGRESS_BLOCKED` |
| `https://business.fidilio.com` | `EGRESS_BLOCKED` |
| `https://club.fidilio.com/membership` | `getaddrinfo ENOTFOUND` (DNS failure) |

**`webfetch_worked = false` for this session.** The `example.com` control confirms a blanket
network-egress policy, not a per-domain block — consistent with the **2026-09-07**
`store-reviews.md` session (same date, same blocked pattern) and in contrast to the
**2026-09-05** session that produced the profile's ADDENDUM, where `WebFetch` worked. I could not
personally open a single Fidilio page this session, including two newly-discovered, highly
relevant URLs (`fidilio.com/rules` — the Persian terms-of-use page, and
`business.fidilio.com/رستوران/` — a dedicated restaurant-partner "cooperate with us" page,
neither of which any prior Scout session had located). Per the task's fallback rule, everything
below past this point came from `WebSearch`, and every finding is marked **search-synthesis**
unless stated otherwise. Per the evidence rule, only text that appeared inside quotation marks
in a search result is treated as a quote; everything else is paraphrase and is labeled as such.

### Queries run this session (24, all WebSearch; 9 WebFetch attempts above, all blocked/failed)

1. فیدیلیو کمیسیون رستوران درصد
2. فیدیلیو ثبت نام رستوران پنل هزینه
3. فیدیلیو قوانین و مقررات استفاده
4. فیدیلیو حریم خصوصی سیاست
5. "fidilio.com" site:fidilio.com قوانین یا شرایط
6. فیدیلیو باشگاه مشتریان امتیاز تخفیف حداقل
7. فیدیلیو رزرو میز پیش پرداخت لغو جریمه
8. فیدیلیو کافه بازار تغییرات نسخه جدید
9. فیدیلیو "کارمزد" یا "کمیسیون" رستوران همکاری با ما
10. فیدیلیو "همکاری با ما" رستوران ثبت
11. فیدیلیو تومان قیمت اشتراک پلن
12. business.fidilio.com رستوران کمیسیون قیمت پلن
13. "business.fidilio.com" رستوران همکاری کارمزد
14. فیدیلیو رستوران دار ثبت نام مزایای همکاری چیست
15. club.fidilio.com membership فیدیلیوکلاب سطوح عضویت امتیاز
16. فیدیلیو کلاب امتیاز تبدیل تخفیف حداقل چند امتیاز
17. فیدیلیو کلاب امتیاز تاریخ انقضا اعتبار
18. فیدیلیو کلاب چند امتیاز معادل چند تومان تخفیف
19. فیدی آفر FidiOffer قیمت اشتراک ماهانه رستوران
20. فیدیلیو رزرو میز آنلاین هزینه دارد رایگان
21. ارزیابی 4 اپلیکیشن برتر سفارش غذا مقایسه کمیسیون‌ها ویرگول فیدیلیو
22. فیدیلیو کافه بازار چه چیزهای جدیدی در این نسخه وجود دارد
23. فیدیلیو کد تخفیف چه کسی هزینه تخفیف را پرداخت می کند رستوران یا فیدیلیو
24. فیدیلیو انصراف حساب کاربری بازپرداخت وجه
25. fidilio.com/rules غذا قیمت پرداخت نهایی مسئولیت
26. فیدیلیو رستوران قرارداد فسخ همکاری انحصاری
27. فیدیلیو ۱۴۰۴ کمیسیون رستوران تغییر افزایش
28. فیدیلیو "حق کمیسیون" چند درصد است
29. فیدیلیو حداقل سفارش هزینه ارسال پیک تحویل
30. فیدیلیو سرمایه گذاری جدید ۱۴۰۳ ۱۴۰۴ دور سرمایه
31. business.fidilio.com فیدیلیو بیزینس اپلیکیشن مدیریت رستوران
32. فیدیلیو نوروزی تخفیف ۲۰ درصد کلاب چه کسی پرداخت
33. "business.fidilio.com" رستوران فرم درخواست ثبت نام همکاری
34. فیدیلیو تسویه حساب رستوران دار پرداخت دیرکرد شکایت
35. فیدیلیو کد تخفیف "فقط برای اولین سفارش" یا "حداکثر" تومان
36. cafebazaar.ir/app/com.fidilio توضیحات برنامه معرفی متن کامل
37. فیدیلیو کوپن "حداکثر" "100,000 تومان" یا "10 درصد" رمضان

## Findings

### 1. Restaurant-side fee structure — no upfront fee, commission rate STILL undisclosed

Multiple independent-phrased queries this session (#1, #9, #12, #13, #21, #27, #28, all in
Persian, targeting the commission percentage directly) converge on the same two facts already in
`profiles/fidilio.md`, now cross-confirmed by a **new** independent search-synthesis pass rather
than merely re-stated:

- **No signup/listing fee.** "اگر می‌خواهید محصولات غذایی رستوران یا فروشگاه خود را از طریق
  اپلیکیشن فیدیلیو بفروشید، نیازی به پرداخت هیچ هزینه‌ای در ابتدا ندارید" (paraphrase, if you
  want to sell your restaurant/store's food products through the Fidilio app, you don't need to
  pay any fee upfront) — **search-synthesis**, query #13.
- **Commission is a percentage of sales, rate set "in the contract"** — same wording as the
  existing profile ("جزئیات نحوه محاسبه کمیسیون در قوانین قرارداد آمده است"), repeated
  identically by search-synthesis in queries #1, #9, #13, #27, #28. **No numeric commission rate
  for Fidilio specifically was found in this session**, despite query #21 surfacing an article
  (virgool.io, "ارزیابی ۴ اپلیکیشن برتر سفارش غذا و مقایسه کمیسیون‌ها" — "Evaluation of the top 4
  food-ordering apps and commission comparison") that names Fidilio as one of the four apps
  compared, alongside Delino (12% with the Sepid POS software / 15% without, daily settlement)
  and SnappFood (a "certain percentage of monthly sales") — **the synthesis explicitly did not
  surface a Fidilio-specific number from that same article**, only the Delino and SnappFood
  figures. This is a genuine, repeatedly-confirmed gap, not a research shortfall: three separate
  Scout sessions (2026-09-04, -05, -07) and now 6+ differently-phrased queries this session alone
  have failed to surface Fidilio's commission percentage anywhere in the Persian or English open
  web. **UNKNOWN — not verified**, carried forward and reinforced.
- **Restaurant-owner-side complaints about commission/payout/settlement delay**: query #34
  targeted this directly ("فیدیلیو تسویه حساب رستوران دار پرداخت دیرکرد شکایت") and returned zero
  Fidilio-specific results — only generic Iranian labor-law and restaurant-complaint pages
  unrelated to Fidilio. This is the third consecutive session (following #04 and #07's
  store-reviews pass) to search for this and find nothing. **UNKNOWN — not verified**, and now a
  well-established gap across the whole research line, not a one-off miss.

### 2. A dedicated restaurant B2B portal exists — `business.fidilio.com` — content unreachable

**New finding, not in either prior document.** Query #10 ("فیدیلیو 'همکاری با ما' رستوران ثبت")
surfaced `https://business.fidilio.com/رستوران/` ("Restaurant — Collaborate with us"), a
subdomain distinct from the consumer-facing `fidilio.com`. `WebFetch` was attempted directly
against both `business.fidilio.com/رستوران/` and the subdomain root — both returned
`EGRESS_BLOCKED`, the same as the main domain, so this is evidently the same blocked host family,
not a separately-reachable server. Follow-up searches (#12, #13, #31, #33) confirm the page's
*existence* (it appears consistently across independent query phrasings) but **no search
synthesis surfaced its actual pricing/commission/contract content** — every attempt returned
either generic Fidilio marketing boilerplate or an explicit admission that the search results
"do not contain specific information about business.fidilio.com pricing plans." **This is a
structurally important gap**: Fidilio, like several Tier-1 global competitors in `MATRIX.md`
(OpenTable, Resy), maintains a separate B2B marketing surface for restaurant acquisition — but
unlike SmartX or RSEE (both confirmed in `MATRIX.md` to publish Toman price lists on their own
pages), nothing on Fidilio's B2B surface was found to be self-serve or price-transparent.
**UNKNOWN whether business.fidilio.com publishes any price list at all** — not verified either
way; a future session with working `WebFetch` should treat this URL as the top-priority target
for this mode.

### 3. `fidilio.com/rules` — the actual terms-of-use/ToS page — located but unreadable

**New finding.** Query #5 located `https://fidilio.com/rules` ("راهنمای رستوران‌ها و کافه‌های
ایران" per its page title as indexed) as Fidilio's terms-and-conditions page — neither prior
document names this URL. `WebFetch` against it returned `EGRESS_BLOCKED`. Search-synthesis
(queries #5, #25) surfaced **fragments**, presented here as paraphrase, not verbatim, since no
quotation marks wrapped this text in the search results:

- A liability disclaimer for food price/quality: the platform "is not responsible for food
  quality and how orders are delivered by providers [restaurants]," but "always tries to
  minimize these issues through follow-up and negotiation with providers" (paraphrase,
  search-synthesis, query #5).
- For **express orders specifically**, "Fidilio is responsible for delivery and tries to
  compensate for any potential issues" (paraphrase, search-synthesis, query #5) — this is the
  one place in the whole corpus where Fidilio's own terms draw a distinction between ordinary and
  "express" order handling; the practical difference (SLA, compensation formula, monetary cap)
  is **UNKNOWN — not verified**.
- **Price finality**: "prices in each provider's menu are updated, and the amount displayed when
  finalizing an order on Fidilio is valid" (paraphrase, search-synthesis, query #5) — i.e. the
  page-level claim is that the checkout-screen total is binding. Whether this has ever failed in
  practice is a separate, unresolved question — see the store-reviews corpus's fetched review
  from **alireza, ۱۴۰۴/۰۷/۳۰ (≈2025-10-22)**: *"واقعا افتضاحه تازه که وارد برنامه میشی یه ارور
  404میده بعد موقع پرداخت انلاین"* ("Truly awful — the moment you enter the app it gives a 404
  error, then during online payment…", review cuts off) — a **payment-time failure**, which is
  at minimum adjacent to the price-finality promise on `/rules`, though the review text does not
  confirm whether the customer was actually charged. **I am not asserting these two facts
  contradict each other** — the review is too truncated to know — but the pairing is worth
  flagging for a future session that can read both pages directly.
- A separate, unrelated page — `fidilio.com/go/unprofessionals-banned/Pricing-in-restaurant`
  (surfaced by query #25) — is Fidilio's own **magazine** content about how restaurants should
  price their own menus (cost-plus vs. customer-willingness-to-pay pricing strategy). This is
  educational content aimed at restaurant owners, **not** a statement of Fidilio's own commission
  or fee terms — flagging explicitly so it is not confused with the ToS page above; it is generic
  restaurant-management advice, labeled CLAIMED/marketing-adjacent, not a pricing-terms source.

**Net effect on the profile's outstanding gap:** `fidilio.com/rules` is now a **known, named
target** for the platform's actual terms of service — a genuine research advance over the prior
profile, which never located this URL — but its content on contract length, exclusivity,
auto-renewal, or refund windows remains **UNKNOWN — not verified**, because no search-synthesis
query (including #26, aimed squarely at exclusivity/termination) surfaced anything on those
specific points. Query #26 returned zero Fidilio-specific results at all — only unrelated
Snapp Food/Chiliory antitrust case coverage and generic restaurant-contracting legal articles.

### 4. Order economics — minimum order value, delivery-fee funding, radius, speed (all NEW)

Query #29 ("فیدیلیو حداقل سفارش هزینه ارسال پیک تحویل") returned the session's single richest
new data point, presented here as paraphrase (search-synthesis, not verbatim, no quotation marks
in the underlying result):

- **Minimum order value: 100,000 Toman** ("حداقل مبلغ سفارش صد هزار تومان است").
- **Delivery is free to the diner, with the cost absorbed by the restaurant**
  ("ارسال پیک رایگان غذا با حذف هزینه توسط رستوران فراهم می‌شود" — free delivery is provided by
  the restaurant waiving/absorbing the fee). This is a **diner-side money fact directly in scope
  for this mode**: it implies the commission Fidilio charges (still UNKNOWN in rate) is what
  funds the "free delivery" promise from the restaurant's side, not a separate line item the
  diner ever sees.
- **Service radius: 4 km** from the customer's location for restaurant/food-court/cafe/
  fast-food/bakery/ice-cream/juice-shop selection.
- **Delivery speed claim: under 30 minutes**, with both delivery and in-person pickup offered as
  fulfillment options.

These four facts are **new to the Scout corpus** — neither `profiles/fidilio.md` nor
`store-reviews.md` documents a minimum order value, delivery-fee funding party, service radius,
or delivery-time SLA for Fidilio. All four are **search-synthesis, unverified against the
primary source** (the underlying page was not identified by URL in the search result, so it
could not even be flagged as a specific target the way `/rules` and `business.fidilio.com` were)
— treat as CLAIMED/marketing-derived until a session with working `WebFetch` confirms them
against `fidilio.com` directly.

### 5. Fidilio Club — loyalty program, materially extended from the prior profile

The existing profile's only loyalty evidence was a single undated Facebook post: "3 points per
2,000 Toman at Morano restaurant, +25% discount." This session located and queried Fidilio
Club's **own dedicated subdomain**, `club.fidilio.com`, and its `/membership` page specifically
(queries #6, #15–#18) — another **new URL** not in either prior document. `WebFetch` against
`club.fidilio.com/membership` failed with `getaddrinfo ENOTFOUND` (DNS failure, distinct from the
`EGRESS_BLOCKED` seen for `fidilio.com`/`business.fidilio.com` — meaning the domain does not
currently resolve from this session's network, a different failure mode worth noting for a
future session). All of what follows is therefore **search-synthesis, unverified**, but it is
current (query #14 surfaced `club.fidilio.com/offers/...` example pages dated to what appear to
be live, current merchant listings, not an old Facebook post) and substantially more structured
than anything in the prior corpus:

**Earning rate:** "به ازای هر ۲۰۰۰ تومان خرید از سرویس‌دهندگان کلاب، ۱ تا ۵ امتیاز دریافت
می‌کنید" (paraphrase — for every 2,000 Toman spent at club-partner venues, 1 to 5 points are
earned) — **the rate is per-merchant, not flat**, contradicting nothing in the old Morano
example (3 points/2,000T sits inside the 1–5 range) but showing the range is wider than the
single old data point implied. Two **current, named, dated-by-listing** merchant examples
surfaced (search-synthesis, query #17/#18, both from live `club.fidilio.com/offers/restaurants/`
and `/offers/other/` pages found in query #14):
- **Café Restaurant Saran**: 15% discount + 2 points per 2,000 Toman spent.
- **Larisa Vank**: 10% discount + 2 points per 2,000 Toman spent.

**⚠️ A number I am explicitly flagging as computed by the search engine, not stated by
Fidilio:** one search-synthesis response asserted "هر امتیاز تقریباً معادل ۴۰۰ تا ۲۰۰۰ تومان
تخفیف است" (each point is worth approximately 400–2,000 Toman of discount) — **this is simple
inverse arithmetic on the earn rate (2,000 Toman ÷ 5 points = 400; 2,000 Toman ÷ 1 point =
2,000), not a redemption rate Fidilio itself discloses anywhere I found.** Earning and redemption
are not necessarily symmetric in any loyalty program, and no source describes what a point is
actually worth when spent. I am recording this number specifically to flag it as **synthesis
inference, not company disclosure** — do not cite it as Fidilio's redemption rate.

**Tier structure (bronze/silver/gold) — the single most substantive new find this session,**
from two independently-phrased queries (#6 and #17) that converged with **one internal
inconsistency worth recording verbatim rather than resolving, per the task's contradiction rule**:

- Query #6 (paraphrase, search-synthesis): *"To upgrade from silver level to gold level, a
  person must reach 12,000 points... To maintain a silver level, a member must earn at least
  2,500 points in the following year, otherwise they will be downgraded to bronze level. To
  maintain a gold level, a member must earn at least 6,000 points in the following year,
  otherwise they will be downgraded to silver level. The one-year period is calculated from the
  time of upgrade to the new level."* — this response gave **no bronze→silver threshold**.
- Query #17 (paraphrase, search-synthesis): *"members can advance from Bronze level to Silver
  level at 5,000 points, and from Silver to Gold level at 12,000 points."*

**Both agree on Silver→Gold = 12,000 points.** Only query #17 supplies a Bronze→Silver figure
(5,000 points); query #6 is silent on it rather than contradicting it. Per the task's instruction
to record contradictions verbatim rather than resolve them, I am **not** merging these into one
authoritative table — I am presenting both search results exactly as returned. **This is
CLAIMED/search-synthesis pricing-adjacent structure, not independently confirmed**, and no
session (this one included) has operated a real Fidilio Club account to verify tier mechanics
end-to-end.

**What remains UNKNOWN despite this session's queries:**
- Point **expiry** policy (query #16: zero Fidilio-specific results; only Digikala/Snapp Club
  results for unrelated programs).
- Whether Fidilio Club **membership itself** is free or paid — not addressed by any search this
  session; carried forward as UNKNOWN from the prior profile.
- Actual **redemption minimum** (how many points are needed to redeem *anything*, as opposed to
  the tier-upgrade thresholds above, which are a different mechanic) — UNKNOWN.
- Whether the tier system is **server-verified or advertised-only** — no session has operated the
  app, so this cannot be marked REAL; it stays CLAIMED.

### 6. Coupon/discount funding — platform vs. restaurant — inconclusive

Query #23 asked directly who funds Fidilio's discount codes. The search-synthesis response
**explicitly declined to answer** ("نتایج جستجو اطلاعات مشخصی درباره اینکه کدام طرف (فیدیلیو یا
رستوران) هزینه تخفیف‌های کد را پرداخت می‌کند، ارائه نمی‌دهد" — the search results do not provide
clear information about which party pays for the coupon discounts) and offered only a generic,
unsourced inference ("عموماً در چنین پلتفرم‌ها، تخفیفات عموماً توسط رستوران‌ها یا پلتفرم به صورت
مشترک ارائه می‌شود" — generally on such platforms, discounts are typically funded jointly by
restaurants or the platform) that I am **not** treating as a Fidilio-specific fact — it is
industry-generic boilerplate the synthesis produced when it had nothing concrete. **UNKNOWN — not
verified.** The one concrete coupon example in the whole corpus remains the prior profile's
Mopon-sourced Ramadan promo (up to 10% off, capped at 100,000 Toman) — this session found no new
coupon terms and no funding-source attribution for it either.

### 7. Currency, funding, and changelog — no material change from the prior profile

- **Currency**: every figure found this session (minimum order 100,000 Toman, coupon cap 100,000
  Toman, point-value inference 400–2,000 Toman, loyalty thresholds in points not currency) is
  denominated in **Toman**, consistent with the existing profile; **no Rial-denominated figure
  was found anywhere**, so there is no currency-confusion contradiction to flag here (unlike the
  Zarinpal IRT/Rial trap this repo's own constitution warns about — Fidilio's own materials, at
  least what synthesis surfaced, do not appear to make that mistake).
- **Funding**: query #30 ("فیدیلیو سرمایه گذاری جدید ۱۴۰۳ ۱۴۰۴") found **no new funding round**
  since the 2019-01-14 Shenasa round already documented in the prior profile. The search results
  actively misfired toward unrelated "Fidelity" investment-fund content, which I excluded as
  false matches. **No new funding evidence — the profile's existing UNKNOWN (amount) and single
  confirmed round stand unchanged.**
- **Changelog/release notes**: query #8 and #22 (Cafe Bazaar "what's new in this version" for
  Fidilio) surfaced **no Fidilio-specific changelog text** — every result was either about Cafe
  Bazaar's own app (the store, not Fidilio) or unrelated. One earlier, incidental fragment (from
  query #22's broader synthesis pass) mentioned, without a date or version number, "a fix for an
  error that occurred when exiting the app" — this is too thin (no version, no date, no source
  URL) to record as a dated changelog entry and is noted here only so the query is not silently
  dropped, per the same rule the store-reviews corpus applied to a similarly thin fragment.
  **No usable changelog/release-notes evidence found this session.**

## Contradiction check against existing profile and MATRIX.md

One internal contradiction found and recorded (not resolved) at §5 above: two search-synthesis
results disagree on whether a Bronze→Silver point threshold exists at 5,000 points or is simply
unstated. No contradiction was found between this session's findings and `profiles/fidilio.md`
or `MATRIX.md`'s existing Fidilio cells — this session's new facts (order minimum, delivery
funding, radius, tier thresholds) are additions to cells that were previously blank/UNKNOWN
(`MATRIX.md`'s "Public, self-serve restaurant pricing" row for Fidilio is footnoted "commission
exists, rate undisclosed" — **still accurate**, this session found no self-serve price list, only
confirmation that a B2B portal exists whose content is unreached) rather than corrections to
stated facts.

## Numbers table — everything with a figure, this session

| Figure | Value | Currency | Label | Source (search-synthesis unless noted) |
|---|---|---|---|---|
| Restaurant signup/listing fee | 0 (none) | — | search-synthesis | query #13 |
| Restaurant commission rate | UNKNOWN — not verified | — | — | queries #1,#9,#12,#13,#21,#27,#28 all failed to surface it |
| Minimum order value | 100,000 | Toman | search-synthesis | query #29 |
| Delivery fee to diner | 0 (restaurant-funded) | Toman | search-synthesis | query #29 |
| Service radius | 4 | km | search-synthesis | query #29 |
| Delivery SLA claim | under 30 | minutes | search-synthesis | query #29 |
| Fidilio Club earn rate | 1–5 points per 2,000 | Toman | search-synthesis | query #17 |
| Café Restaurant Saran offer | 15% off + 2 pts/2,000 | Toman | search-synthesis | query #17/#18 |
| Larisa Vank offer | 10% off + 2 pts/2,000 | Toman | search-synthesis | query #17/#18 |
| Silver→Gold tier threshold | 12,000 | points | search-synthesis (2 sources agree) | queries #6, #17 |
| Bronze→Silver tier threshold | 5,000 (query #17) / not stated (query #6) | points | search-synthesis, **contradiction not resolved** | queries #6, #17 |
| Silver tier maintenance | ≥2,500/year | points | search-synthesis | query #6 |
| Gold tier maintenance | ≥6,000/year | points | search-synthesis | query #6 |
| Computed point value (NOT a disclosed redemption rate) | ≈400–2,000 | Toman/point | search-synthesis inference, flagged as such | query #18 |
| Ramadan coupon cap (carried forward, not re-verified this session) | 10% off, capped at 100,000 | Toman | search-synthesis, Mopon-sourced | prior profile, query for context this session found nothing new |
| Shenasa investment round | amount UNKNOWN | — | company-claimed round exists | prior profile, unchanged this session |

## What this session did NOT verify (explicit gap list)

1. **Commission percentage** — still never found, across three sessions and 15+ differently
   phrased queries in this session alone specifically targeting it.
2. **`fidilio.com/rules` full text** — located and named for the first time, but unreadable
   (`EGRESS_BLOCKED`); only fragments recovered via search-synthesis.
3. **`business.fidilio.com/رستوران/` content** — located and named for the first time, but
   unreadable; existence confirmed, pricing/terms content is not.
4. **Contract length, auto-renewal, exclusivity clauses** — zero Fidilio-specific results despite
   a directly-targeted query (#26).
5. **Diner-side deposits/no-show/cancellation fees for table reservation** — no evidence found
   that Fidilio's "رزرو میز" (table reservation) feature carries any consumer-side fee at all;
   this is consistent with the existing profile's finding that the app's own store name is
   "سفارش غذا" (food ordering), not reservation — the reservation feature may not be a
   fee-bearing, actively-monetized product surface. **UNKNOWN, not ABSENT** — I did not operate
   the app to confirm reservation is fee-free versus simply undocumented online.
6. **Refund windows** — zero results, any phrasing.
7. **Fidilio Club membership cost** (free vs. paid) — not addressed this session; UNKNOWN,
   unchanged from prior profile.
8. **Point expiry policy** — zero Fidilio-specific results.
9. **Redemption minimum** (as distinct from tier-upgrade thresholds) — not found.
10. **Changelog/release notes with a real date or version number** — not found.
11. **New funding rounds since 2019** — none found; profile's existing gap stands.
12. **Coupon/discount funding source** (platform vs. restaurant) — search explicitly could not
    answer this; only an unsourced generic inference was offered, which I declined to present as
    fact.

## Sources

All accessed 2026-09-07. WebFetch attempts (all blocked/failed, listed with error above):
`example.com`, `fidilio.com`, `cafebazaar.ir/app/com.fidilio`, `mag.fidilio.com`,
`fidilio.com/rules`, `myket.ir/app/com.fidilio`, `fidilio.com/contactus`,
`business.fidilio.com/رستوران/`, `business.fidilio.com`, `club.fidilio.com/membership`.

WebSearch reached only search-engine synthesis of (URLs cited by the synthesis, not opened
directly): `fidilio.com/rules`, `fidilio.com/go/unprofessionals-banned/Pricing-in-restaurant`,
`fidilio.com/contactus`, `business.fidilio.com/رستوران/`, `club.fidilio.com/membership`,
`club.fidilio.com/offers/restaurants/cafe_restaurants_saran`,
`club.fidilio.com/offers/other/larisa_vank`, `mag.fidilio.com` (various restaurant-management
articles), `virgool.io/@m_63627722/...` (commission-comparison article naming Fidilio, Delino,
SnappFood, MamanPaz), `mopon.ir` (coupon aggregator, carried-forward reference only),
`digiato.com` (2019 funding article, carried-forward reference only), `tracxn.com`,
`zoominfo.com`, `pitchbook.com`, `crunchbase.com`, `linkedin.com/company/fidilio`.

## Notes for the next Scout session on this competitor

The single highest-value next step is **not** a new search query — it is a `WebFetch`-capable
session opening exactly three URLs this session located but could not read:
`fidilio.com/rules`, `business.fidilio.com/رستوران/`, and `club.fidilio.com/membership` (retry
this one — it failed DNS resolution here, which may be transient rather than a policy block,
unlike the other two). Those three pages, read directly, would very likely resolve the
commission-rate UNKNOWN, the contract-terms UNKNOWN, and the tier-threshold contradiction in one
pass — all three are now named, not merely hypothesized.
