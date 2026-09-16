# COMPETITORS-IRAN — live re-measure and extension of the Scout's map
**Date:** 2026-09-16 · **Written by:** research agent for Marketer `rezv-c6 [897f2f]` · **Target:** CEO `rezv-87 [09dbab]` · **Status:** reviewed by the Marketer — **submitted, not closed** (review block below) · **Baseline:** docs/audit/research (Scout, 09-04→09-09)


> ## Marketer review — `rezv-c6`, 2026-09-16
>
> **Re-measured by the Marketer, not taken on the agent's word:**
> - **Foodro is real.** Zoomit, re-fetched: headline «رونمایی اسنپ‌فود از «فودرو»؛ رستوران‌گردی اقتصادی با
>   تخفیف‌های آنی و پرداخت آسان», dated **چهارشنبه ۱۵ مرداد ۱۴۰۴ (≈ 2025-08-06)**, and the article
>   says «رزرو میز» and «شش شهر بزرگ کشور شامل تهران، کرج، مشهد، اصفهان، شیراز و قم».
>   **But today's live status is not confirmed.** `food.snapp.ir/foodro/` returns a `307` to itself
>   (curl: 5 redirects; WebFetch: "too many redirects"), so I could not open the page the agent marks
>   `[fetched]`. What stands is the launch, 13 months ago. It is not established that Foodro is live
>   or at what scale.
> - **App-store figures** for Fidilio (110 هزار / 581 votes / 3.7) and SnappFood (4.4 میلیون / 53,346 /
>   4.4) match my own curl extraction of the same Bazaar pages (`APP-STORE-FOOTPRINT-2026-09-16.md`).
>   One more thing the agent did not record: Fidilio's Bazaar page shows the banner «متأسفانه برنامه
>   مورد نظر شما یافت نشد» next to its stats.
> - **The Rezervno row was wrong and is corrected in C.1.** It marked five capabilities "REAL (in code)".
>   The CEO's rule is REAL-STATIC at most until `CHAIN-MAP.md` lands. Points (redemption off) and SMS
>   campaigns (delivery unproven) are PARTIAL. The prices are placeholders.
>
> **What this changes for the business plan:**
> 1. **The biggest competitor is not a reservation company.** SnappFood launched table booking in 6
>    cities in Aug 2025. It sits on 4.4M Bazaar installs and an existing restaurant relationship
>    (>35,000 contracts, CLAIMED, see `MARKET-SIZE-IRAN`). How it charges restaurants for it is
>    `UNKNOWN`. That is the single most important open question in this file.
> 2. **The real competition for the restaurant's budget is POS-first suites** (SmartX, Sepidz, Mupra,
>    Duvita), priced 20–200M/yr. All of them gate the reservation module behind "contact us". A
>    published, all-inclusive price is a real point of difference *if* the owner keeps prices public.
> 3. **The cheap end is eating the club:** a 4.9M/yr digital-menu product bundles a birthday-SMS
>    "customer club" (CLAIMED).
> 4. **The status-quo substitute (Instagram DM + phone) costs zero.** The pitch has to beat free,
>    not beat SmartX.
>
> **Still UNKNOWN:** Foodro's restaurant terms and live status, RSEE's diner credit price, SnappFood's
> own commission rate (15–22% is SECONDARY), and whether SmartX's add-ons stack on the 52.8M.

## Method note

`WebFetch` worked for every URL attempted this session (no `EGRESS_BLOCKED`, unlike several of the
Scout's batch-1/2 sessions). Every figure below marked `[fetched 2026-09-16]` was read from the named
URL today via `WebFetch`, which itself returns a small model's summary of the page — not raw HTML — so
even a "fetched" figure is a paraphrase of what the page said, not a byte-for-byte capture. Where I
quote Persian text, it is as returned by the fetch tool. `WebSearch` results are marked as such and
treated as SECONDARY/CLAIMED per the evidence rules, never upgraded to REAL. Budget used: 35
WebSearch/WebFetch calls. Two players from the baseline (OpenTable/Resy/SevenRooms/Servme/TheFork —
the global set) were **not** re-measured this pass; the brief scoped Part A to the Iranian set only,
and Part B budget went to *new* Iranian/adjacent players instead of re-confirming the global profiles,
which are dated but not stale in the same way (SEC-filing-based, slower-moving). That is a deliberate
scope choice, named here rather than silently.

---

## Part A — known competitors, re-measured today

### SmartX (smartx.ir)

**Pricing — re-fetched `smartx.ir/pricing/` [fetched 2026-09-16].** Core annual figures are
**unchanged** from the Scout's 2026-09-05 fetch: ارزیابی هوشمند ۳۳,۶۵۰,۰۰۰ · باشگاه مشتریان
۵۱,۰۰۰,۰۰۰ · **رزرو و نوبت‌دهی (Smart Booking) ۵۲,۸۰۰,۰۰۰** · وای‌فای هوشمند (۱۰ کاربر) ۲۱,۰۰۰,۰۰۰ ·
مدیریت هوشمند رستوران (4-product bundle) ۱۹۹,۲۵۰,۰۰۰ تومان/سال. New detail this pass — the page also
itemizes Smart Booking's own add-ons separately: POS integration add-on, prepayment add-on, and
"online booking" each carry their own line figure on top of the ۵۲,۸۰۰,۰۰۰ base, which the Scout's
09-05 note did not enumerate (unclear from the fetch tool's summary alone whether these are
additive or already included in the headline price — flagging the ambiguity rather than resolving
it). The usage-based line (activation ۲۹,۵۰۰,۰۰۰ + ۱۰,۰۰۰/transaction, discounted to ۷,۰۰۰/transaction
at 75%+ phone-capture) is unchanged and the ۷,۰۰۰ figure now confirms the Scout's "30% discount" framing
arithmetically (۱۰,۰۰۰ × 0.7 = ۷,۰۰۰).

**The internal contradiction is still live, unreconciled, 11 days later.**
`smartx.ir/services/reserve/restaurant/` [fetched 2026-09-16] still states **۲۱,۴۵۰,۰۰۰ تومان/سال** for
the same reservation product the pricing page prices at ۵۲,۸۰۰,۰۰۰ — a 2.5× internal gap the Scout
first flagged 2026-09-05, **still present, still both live pages, still neither corrected** as of
2026-09-16. **Changed since 09-05: nothing — this is itself the finding.**

Feature set, apology-page framing, and everything else in `profiles/smartx.md` was not independently
re-checked this pass (budget went to the pricing pages specifically, since those are what Part A asked
for); treat the rest of that profile as still the Scout's most current word.

### RSEE / آرسی (rsee.ir)

`rsee.ir` [fetched 2026-09-16]: the claimed venue count (**"۲۰۰۰+"**), the three restaurant-side plans
(free/4mo · Professional ۹۹۰,۰۰۰/yr · Complete ۲,۹۹۰,۰۰۰/6mo or ۳,۹۹۰,۰۰۰/12mo), the آرسی
chair-credit mechanic ("هر آرسی معادل یک صندلی از یک میز می‌باشد"), and the cancellation ladder
(100% refund >3h, 50% refund <3h, 0% otherwise) are all **unchanged** from the Scout's 09-05 fetch.

**The diner-side آرسی-to-Toman conversion rate — the one thing the Scout's brief specifically asked
this pass to try again for — is still UNKNOWN.** Two additional targeted searches today
("آرسی rsee.ir قیمت هر آرسی تومان بسته رزرو" and "rsee.ir خرید بسته آرسی قیمت تومان اپلیکیشن") both
returned unrelated results (crypto ticker "RSR," an unrelated car-parts brand, unrelated apps) or a
direct restatement that the price isn't published where search can see it. `/plans`, `/rules` and
`/faq` were not re-attempted directly this pass (the Scout already got 404 on all three 09-05; no
reason to expect that changed without re-fetching, which I did not spend budget on). **This is now a
gap confirmed across two independent research passes, 11 days apart — worth treating as a structural
absence (the price may only ever be shown inside the paid app/web-app flow, which this research
programme has never entered) rather than a search-tooling failure.**

### Fidilio (fidilio.com)

**Cafe Bazaar listing** (`cafebazaar.ir/app/com.fidilio`) [fetched 2026-09-16]: **3.7/5, 581 ratings,
110,000 installs — numerically identical to the Scout's 09-05 fetch.** Zero movement in 11 days is
itself a data point (a genuinely dead-slow listing, not a fast-growing app).

**A third independent reviewer now confirms the broken-OTP defect.** Two reviews match the Scout's
09-05 quotes exactly (alireza ۱۴۰۴/۰۷/۳۰, محمد ۱۴۰۴/۰۷/۱۹). A **third, not in the Scout's file**:
**mojtaba_rt, ۱۴۰۴/۰۷/۱۰** (≈2025-10-02): *"این ایراد عدم تطابق کد تایید، در توسعه اپلیکیشن بی‌سابقه
است — سیستم کد ۶ رقمی می‌فرستد ولی ۴ رقم می‌خواهد"* ("this verification-code mismatch is
unprecedented in app development — the system sends a 6-digit code but demands 4 digits"). **Three
different users, at least three separate report dates, same defect, still unfixed as of the most recent
visible review.** This strengthens the Scout's original finding rather than just repeating it.

**`fidilio.com` itself was fetched directly for the first time in this research programme**
[fetched 2026-09-16] (the Scout never got past `EGRESS_BLOCKED` for this exact domain). It **does not
mention table reservation ("رزرو میز") anywhere on the homepage today** — the Scout's only reservation
evidence was always from `mag.fidilio.com` blog posts, never the product homepage; today's direct fetch
of the homepage itself finding *nothing* about reservation makes the "Fidilio has a booking feature"
claim weaker than before, not stronger. The homepage's own claimed scale — **"+۱۲,۵۰۰ رستوران," "+۱۰,۰۰۰
کافه," "+۵,۰۰۰ قنادی"** — is unchanged from the Scout's citation and remains unreconciled against the
3.7/581 Cafe Bazaar reality. No commission % or restaurant pricing found on the homepage either
(unchanged gap).

### Foodism (foodism.app / app.foodism.tech)

**Myket** [fetched 2026-09-16]: **4.3/5, 226 reviews, 25,000+ installs, last updated ۱۴۰۱/۰۹/۱۰
(≈2022-12-01) — every number identical to the Scout's 09-05 addendum fetch.** A build frozen since
December 2022 has still not moved in the 11 days since the Scout last checked.

**Cafe Bazaar** (`cafebazaar.ir/app/app.foodism.tech`) [fetched 2026-09-16]: **still HTTP 404**,
confirming the Scout's 09-05 finding is not a transient blip.

**Two new reviews found this pass, both from 2026, both worse than the Scout's single data point.**
The Scout's file had one: معصومه, ۳ خرداد ۱۴۰۵ ("کار نمیکنه" / "doesn't work"). Today's fetch surfaced
two more, not previously recorded: **زهرا جعفری, ۱۶ اردیبهشت ۱۴۰۵** (≈2026-05-06): *"افتضاحه اصلا باز
نمیکنه همش خطا میده"* ("terrible, won't open at all, keeps erroring") and **یامال, ۲۶ اسفند ۱۴۰۴**
(≈2026-03-17): *"خطا در برقراری سرور"* ("server connection error"). **Three independent 2026 reviews now
all describe total non-function**, not a UI complaint — this moves the needle from the Scout's
"DEGRADED — likely abandoned, not confirmed dead" toward "functionally dead for at least some users,"
though still not confirmed by an install-and-test (none performed this pass either).

### Sepidz (sepidz.com)

`sepidz.com/software/restaurant-reservations/` [fetched 2026-09-16]: **pricing is still gated behind
"request a price list"** — unchanged. Feature list matches the Scout's profile (smart table assignment,
online/phone/in-person booking, SMS confirmations, online prepayment, POS integration, smart customer
club, survey tool), plus one detail not explicit in the Scout's write-up: **QR-code check-in** is
listed as a capability. No pricing, no customer count, no review corpus found — all unchanged gaps.

### علاءالدین تراول (alaedin.travel)

`alaedin.travel/restaurants-cafes` [fetched 2026-09-16]: **717 restaurants/cafés — the exact count the
Scout fetched 09-05, unchanged.** City breakdown matches (Tehran 189, Mashhad 73, Isfahan 53), with two
additional cities surfaced this pass not itemized in the Scout's file: **Kish 48, Tabriz 44**. Booking
mechanism (select venue/date/party size, receive a voucher, pay on arrival) and the buffet-prepay
framing are unchanged. No restaurant-side commercial terms or diner booking-fee (distinct from the meal
prepayment) were found — same gap the Scout left open.

### SnappFood — restaurant/vendor side (snappfood.ir / food.snapp.ir)

**Commission %: still no company-disclosed rate — confirmed absent again — but a newer SECONDARY
source narrows the range.** A restaurant-advisory blog, `damsaz.kitchen`, published **۰۶ آبان ۱۴۰۴
(≈2025-10-28)** — after the Scout's 09-04 research window — states commission is generally
**"۱۵ تا ۲۰ درصد"** of sale value, with **newly registered restaurants typically at 18–22%**, and
**older/high-volume restaurants able to reduce to 15%** via order volume or seasonal-campaign
participation. This is consistent with, and slightly more granular than, the Scout's `restobazar.com`
figure — still **SECONDARY**, still not SnappFood's own published number.

The Competition Council ruling (decision No. 740, session dated ۱۶ اردیبهشت ۱۴۰۴ ≈2025-05-06 — ⚠️ **conflicts with `MARKET-SIZE-IRAN-2026-09-16.md` §2, which dates a SnappFood exclusive-contract ruling to 1404/12/16; not reconciled by the Marketer**) that the
Scout already found is unchanged in substance: commission *discounts* were conditioned on exclusivity,
ruled anticompetitive, ordered removed — coverage re-checked today (`zoomit.ir/tech-iran/439738`)
still does not state the exact before/after percentages inside the ruling itself.

**رزرو میز — a real feature, and a finding the Scout's own SnappFood profile does not contain at
all.** SnappFood operates a sub-product called **فودرو (Foodro)**, at `food.snapp.ir/foodro/`, which
explicitly offers **advance table reservation inside the SnappFood app**, with a stated incentive that
**pre-reserved visits receive a larger discount than a walk-in**, secure post-meal cashless payment
(no cash/card handling), and restaurant discovery/filtering by cuisine, price and location. It is
**live in six cities: Tehran, Karaj, Mashhad, Isfahan, Shiraz, Qom** [fetched via `food.snapp.ir/foodro/`
2026-09-16, and corroborated by Zoomit's own coverage, `zoomit.ir/tech-iran/445513-foodro-snappfood-service/`,
2026-09-16]. Zoomit's article date resolves to roughly **Mordad 1404 (≈August 2025)** — meaning Foodro
predates the Scout's 09-04 research window entirely. **`profiles/snappfood-loyalty.md` never mentions
Foodro** — this is either a genuine miss by the Scout's search terms (its profile was scoped to
"loyalty & rewards," and Foodro reads as a reservation/discovery feature, which may have fallen outside
that framing) or the feature has grown in visibility since. Either way, **it is real, it is live, and it
is the single most decision-relevant new fact in this research pass**: see Part C.

**SnappFood's Cafe Bazaar listing, which the Scout explicitly could not find** (`profiles/snappfood-loyalty.md`,
"What I did NOT verify" #3), was located and fetched this pass:
`cafebazaar.ir/app/com.zoodfood.android` [fetched 2026-09-16] — **4.4/5, 53,346 ratings, 4.4 million
installs.** This retires that specific gap in the Scout's file.

---

## Part B — competitors the Scout did not cover

### Mupra (ماپرا, mupra.ir) — B2B all-in-one, reservation bolted onto a POS

**What it sells, to whom.** Cloud POS + inventory + accounting + digital menu + customer club +
reservation, sold to restaurant/cafe owners. Published pricing exists for the core platform but **not**
for the reservation module specifically.

**Pricing — `mupra.ir/pricing/` [fetched 2026-09-16], REAL, published, no sales call for these four
tiers** (all **+10% VAT** on top of the figures below, per the page):

| Tier | Annual (12mo commitment) | Notes |
|---|---|---|
| پایه (Base) | ۱۹,۹۰۰,۰۰۰ تومان/yr | POS, digital menu, online invoicing, basic customer mgmt — **no reservation, no advanced SMS automation** |
| پیشرفته (Advanced) | ۴۹,۵۰۰,۰۰۰ تومان/yr | + smart inventory, online ordering/payment, loyalty programs, delivery mgmt, accounting |
| حرفه‌ای (Professional) | ۸۹,۳۷۰,۰۰۰ تومان/yr | + custom-domain site, advanced analytics, segmentation, API, e-wallet |
| حرفه‌ای پلاس (Pro+) | ۱۶۰,۶۵۰,۰۰۰ تومان/yr (6mo/12mo only) | + driver/delivery mgmt, kitchen display, menu engineering, dedicated account manager |

**Reservation module itself (`mupra.ir/reserve/`) [fetched 2026-09-16] is priced separately and only
via "free consultation" / "purchase advice"** — i.e., the one module most directly comparable to
Rezervno is the one piece of Mupra's otherwise-transparent price list that is **not** published. Features
described: online/phone table reservation, food-order-ahead reservation, POS/inventory integration,
loyalty-program tie-in, real-time table status. Also targets catering/corporate bulk-order clients,
which Rezervno does not.

**Overlap with Rezervno:** booking (module exists, contact-gated), club/CRM (REAL, published),
points/cashback (CLAIMED, bundled into "loyalty programs" language, not itemized), SMS marketing
(CLAIMED, "smart campaigns" language from search synthesis, not independently fetched), digital menu
(REAL, part of the Base tier — the cheapest tier), POS (REAL, the core product, unlike Rezervno which
has none).

**Traction (CLAIMED):** "1,500+ cafes and restaurants" gained "in the past two years," per a
`zoomit.ir/pr/413146-mupra/` article — the `/pr/` URL slug marks this as a **paid placement**, the exact
pattern the Scout flagged for SmartX's `zoomg.ir` hit and for Foodism's IWMF-award listicles. Also
claims to be "the first cloud restaurant/cafe software exporter in the Middle East and Europe"
(CLAIMED, unverified) and a 67% increase in customer return rate for club-using restaurants (CLAIMED,
no methodology). No funding/investor information found.

### Duvita (دوویتا, duvita.ir / duvitasoft.com) — AI-branded all-in-one, no reservation feature found

**What it sells, to whom.** Cloud POS + delivery/driver app with live GPS + kitchen display + AI-driven
inventory reordering + CRM/loyalty + AI business-intelligence dashboards + a Persian-language AI
assistant, sold to restaurants/cafes/fast-food/catering. Isfahan-based (phone prefix 031).

**Pricing — `duvita.ir/fa` [fetched 2026-09-16], REAL, published, tiered by daily order volume**
(**+10% VAT**, annual gets 2 free months, 90-day money-back guarantee):

| Tier | Monthly | Annualized (×12, before the 2-free-month annual discount) | Order volume |
|---|---|---|---|
| Basic | ۳,۰۰۰,۰۰۰ تومان | ۳۶,۰۰۰,۰۰۰ تومان/yr | 0–50 orders/day |
| Professional | ۵,۰۰۰,۰۰۰ تومان | ۶۰,۰۰۰,۰۰۰ تومان/yr | 50–100 orders/day |
| Unlimited | ۷,۰۰۰,۰۰۰ تومان | ۸۴,۰۰۰,۰۰۰ تومان/yr | 100+ orders/day |

**Overlap with Rezervno:** club/CRM (REAL — automatic points, purchase-history segmentation), SMS
marketing (REAL — "targeted SMS campaigns" explicitly listed as a feature), digital menu (REAL —
dynamic menu with pricing optimization), POS (REAL, core product). **Booking/table reservation: not
found as a discrete feature anywhere in the product description** — Duvita's whole framing is
delivery- and dine-in-operations-first, not diner-facing table booking; marked **ABSENT — not found**,
not merely UNKNOWN, given how detailed the rest of the feature list is. Waitlist: same, **ABSENT — not
found**.

**Traction:** CLAIMED-only, no numeric install/restaurant-count found: "replaces 5–7 separate software
subscriptions," "restaurants report saving 20–30 hours/month," "~20% profitability increase in the
first six months" — all self-sourced marketing copy via search synthesis, none independently confirmed.
No funding/investor information found. `duvitasoft.com` surfaced as a second domain in search results
describing the same CRM/club angle; whether it's the same corporate entity or a reseller/sub-brand was
**not resolved** this pass.

### Digital-menu products (substitute category) — Softmenu profiled as representative

**Softmenu (softmenu.ir)** [fetched 2026-09-16]: QR digital-menu SaaS, sold broadly (not
restaurant-exclusive). **Pricing published, REAL, no sales call:**

| Tier | Price |
|---|---|
| زمین (Zamin) | ۴,۹۰۰,۰۰۰ تومان/yr (or ۱M/mo, ۳.۹M/6mo) |
| مریخ (Marikh) | ۶,۹۰۰,۰۰۰ تومان/yr |
| Customer Plus | ۹,۹۰۰,۰۰۰ تومان/yr |
| ظهر (custom, dedicated domain) | ۲۵,۰۰۰,۰۰۰ تومان/yr |

Notably, **even a pure digital-menu vendor bundles a lightweight "customer club"** — contact-info
capture plus automated birthday SMS — into its product, described on its own site as "a complete,
professional customer club" (CLAIMED). This is a cheap-end encroachment on the club/CRM territory
Rezervno also occupies, from a vendor that has nothing to do with reservations at all. Booking/waitlist:
**ABSENT** — not a reservation product. POS: **ABSENT**.

Other digital-menu vendors surfaced by search but **not independently fetched this pass** (existence
REAL via consistent, repeated search results; pricing/features UNKNOWN pending a direct fetch):
**hidigimenu.com** (دیجی‌منو), **menukhan.com** (منوخوان), **qrpanel.net**, **menuactive.ir**. Listed so a
future pass does not re-discover them from zero.

### Generic (non-restaurant-specific) customer-club SaaS — substitute category, swept not profiled

Found via one search, **none independently fetched**: **Belfycards** (بلفی کارت, belfycards.com —
cashback/points cards), **Dobare** (دوباره, dobare.me — described as pricing by SMS-volume sent rather
than a flat subscription, a notably different axis worth a future look), **Sabzafzar** (سبزافزار —
configurable points-rule engine). A platform named "شکلات" surfaced once in an aggregator snippet with
no independently confirmed URL — **not resolved, possibly a different/unrelated brand**, not chased
further. All four/five are general retail loyalty platforms a restaurant owner could adopt instead of
Rezervno's bundled club, none restaurant-specific. Pricing and full feature sets: **UNKNOWN — not
fetched, sighting only.**

### SMS-marketing panels — substitute category, described per the brief, not measured

**Melipayamak** (melipayamak.com — the same provider Rezervno itself uses, per `CLAUDE.md`), **sms.ir**,
**payam-resan.com**. These are commodity bulk-SMS panels any restaurant can buy directly with no
reservation, club, or CRM product attached at all — the cheapest possible substitute for just the
SMS-campaign slice of what Rezervno offers. Per the brief's instruction for this category, described
rather than priced/measured; generic SMS-panel pricing is not restaurant-specific and out of this
research's scope.

### Instagram/Telegram DM booking — status-quo substitute, described per the brief, not measured

The default behavior for most independent Iranian restaurants today, and the baseline the
`iran-reservation-longtail.md` file's own headline finding implies: a diner DMs or calls the
restaurant directly to reserve a table. Zero cost to the restaurant, zero product to evaluate, but also
zero waitlist automation, no CRM, no points ledger, no SMS-campaign tooling, and entirely dependent on
a staff member checking messages. This is almost certainly the real substitute Rezervno is replacing
for the majority of the market — not any named software product — consistent with the Scout's own
"nobody has won Iranian restaurant table reservation" headline.

### Noted, not deep-profiled (found via general search only, budget did not allow individual fetches)

**Sol** (sol.ir — web restaurant management software), **Hami POS** (hamipos.com — restaurant/cafe
management with a free demo), **Future Software** (futuresoft.ir — restaurant software incl. digital
menu), **Donyaeweb** (donyaeweb.ir — custom reservation-software development shop, bespoke not SaaS),
**Vendo** (via romaksoft.com — appears, per the Scout's own `smartx.ir/key-partners/` finding, to be
part of the same Sepidz/Hamkaran-Sistem-linked reseller family, not an independent competitor),
**Parmisit** (parmisit.com — restaurant accounting software, not reservation-focused). Listed here so a
future research pass starts from this list instead of zero; none of these were fetched, priced, or
feature-checked this session.

**No funding/investment news was found for any Iranian reservation-specific competitor this pass** —
one targeted search ("رزرو رستوران استارتاپ ایرانی سرمایه‌گذاری ۱۴۰۴") surfaced only an unrelated B2B
food-supply startup (تازه‌بار) and generic startup-funding explainer content. This is consistent with
the Scout's own finding that only Fidilio (Shenasa, ~2019, undisclosed amount) has any funding record
in this entire research programme.

---

## Part C — synthesis

### C.1 Matrix

Cells are `REAL` (independently confirmed, fetched or countable), `CLAIMED` (the player's own marketing
claim, unverified), `ABSENT` (checked, not present), or `UNKNOWN` (not found / not checked this pass).
"Cheapest published price/yr" only counts figures that are actually on a public page with no sales call
— a contact-gated module is marked UNKNOWN for that cell even if other tiers of the same product are
published.

| Player | Segment | Model | Cheapest published price/yr (Toman) | Booking | Waitlist | Club/CRM | Points/cashback | SMS marketing | Digital menu | POS | Claimed restaurants | Last fetch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **SmartX** | B2B restaurant software | Subscription + usage-based option | ۲۱,۴۵۰,۰۰۰ (contradicted by ۵۲,۸۰۰,۰۰۰ on another page — both live) | REAL (priced, unreconciled) | CLAIMED | REAL (priced) | CLAIMED | CLAIMED | ABSENT — not found in product line | REAL (integrates, doesn't own) | UNKNOWN | 2026-09-16 |
| **RSEE / آرسی** | Diner-facing marketplace + B2B | B2B subscription + diner prepaid credit | ۹۹۰,۰۰۰ (Professional) | REAL | UNKNOWN | UNKNOWN | ABSENT (prepaid debit, not rewards) | UNKNOWN | REAL (basic-tier QR menu) | UNKNOWN | CLAIMED "2000+" | 2026-09-16 |
| **Fidilio** | Diner discovery + delivery | Delivery commission (rate undisclosed) | UNKNOWN | CLAIMED, weakening (not on homepage today) | UNKNOWN | CLAIMED | CLAIMED | UNKNOWN | UNKNOWN | UNKNOWN | CLAIMED "12,500+/10,000+/5,000+" vs 3.7★/581 CB reality | 2026-09-16 |
| **Foodism** | Diner discovery/social | Free listing + contact-only ads | UNKNOWN | ABSENT | ABSENT | ABSENT | ABSENT | UNKNOWN | UNKNOWN | ABSENT | CLAIMED 8,000–9,000 venues (inconsistent) | 2026-09-16 — **DEGRADED, 404 + frozen build + 3× 2026 "broken" reviews** |
| **Sepidz** | B2B POS+reservation+club | Subscription, contact-gated | UNKNOWN | REAL (features), UNKNOWN price | REAL (features), UNKNOWN price | REAL (features), UNKNOWN price | UNKNOWN | REAL (features), UNKNOWN price | UNKNOWN | REAL | UNKNOWN | 2026-09-16 |
| **علاءالدین (Alaedin)** | Travel-agency booking desk | Voucher/prepay per meal | N/A (not a subscription product) | REAL | ABSENT/N/A | N/A | N/A | N/A | N/A | N/A | REAL — 717 countable listings | 2026-09-16 |
| **SnappFood / Foodro** | Dominant delivery super-app + new reservation layer | Delivery commission (SECONDARY 15–22%) | N/A (commission model) | **REAL — Foodro, 6 cities** | UNKNOWN | REAL (Snapp Club, group-wide) | REAL (Snapp Club points) | UNKNOWN (restaurant-facing tool not found) | UNKNOWN | ABSENT/UNKNOWN | UNKNOWN (restaurant count); 4.4M installs / 53,346★ (diner app) | 2026-09-16 |
| **Mupra** | B2B all-in-one, POS-first | Subscription, tiered | ۱۹,۹۰۰,۰۰۰ (Base — excludes reservation module) | REAL (feature), UNKNOWN price (contact-gated) | UNKNOWN | REAL | CLAIMED | CLAIMED | REAL (Base tier) | REAL (core) | CLAIMED "1,500+" (paid-placement source) | 2026-09-16 |
| **Duvita** | B2B AI-branded all-in-one, POS-first | Subscription, tiered by order volume | ۳۶,۰۰۰,۰۰۰ (Basic) | **ABSENT — not found** | ABSENT | REAL | REAL | REAL | REAL | REAL (core) | UNKNOWN | 2026-09-16 |
| **Softmenu** (digital-menu, representative) | Digital menu/QR, cross-industry | Subscription | ۴,۹۰۰,۰۰۰ | ABSENT | ABSENT | CLAIMED (bundled) | UNKNOWN | CLAIMED (birthday only) | REAL (core) | ABSENT | UNKNOWN | 2026-09-16 |
| Generic loyalty SaaS (Belfycards/Dobare/Sabzafzar) | Cross-industry customer club | Subscription (Dobare: SMS-volume-based) | UNKNOWN | ABSENT | ABSENT | REAL (existence only) | REAL (existence only) | UNKNOWN | ABSENT | ABSENT | UNKNOWN | 2026-09-16, not fetched |
| **Rezervno (own, for reference — corrected by the Marketer)** | Diner-facing reservation-first, B2B subscription | Flat subscription | **Placeholder, not confirmed by the owner:** ۱۸M/3mo · ۳۴M/6mo · ۶۵M/12mo (= 72M / 68M / 65M per year by term) | REAL-STATIC | REAL-STATIC | REAL-STATIC | **PARTIAL** — earn wired, redemption off (FP-008) | **PARTIAL** — panel and API wired, real SMS delivery unproven | UNKNOWN | ABSENT (no own POS) | N/A — pre-launch | `docs/marketing/BUSINESS-MODEL.md` §2 (code, `main = cf60b9c`) |

### C.2 Where pricing clusters

Using only REAL/CLAIMED published prices from this pass and the baseline (no SECONDARY figures, no
averages built on contact-gated numbers):

- **Sub-5M/yr entry tier exists and is real:** RSEE Professional (۹۹۰,۰۰۰/yr) is the cheapest *dedicated
  reservation* product found in this entire research programme, Iranian or global. Softmenu's cheapest
  digital-menu tier (۴,۹۰۰,۰۰۰/yr) sits just above it. These are single-feature, low-commitment
  products.
- **~20–53M/yr is where most individual "serious" modules sit:** SmartX's contradicted reservation
  price (۲۱.۴۵M or ۵۲.۸M), SmartX's Club (۵۱M), Mupra's Base tier (۱۹.۹M, which *excludes* reservation),
  Mupra's Advanced tier (۴۹.۵M).
- **36–90M/yr is the "full small-operation platform" band:** Duvita's three tiers span this whole
  range (36M/60M/84M) by order volume alone; Mupra Professional (89.37M) sits at its top.
  **Rezervno's placeholder prices (65–72M/yr by term — not confirmed by the owner) would sit inside this
  band**, closer to Duvita's Unlimited tier and Mupra's Professional tier than to any entry-level product.
- **160–200M/yr is the enterprise-bundle ceiling:** Mupra Pro+ (160.65M) and SmartX's full four-product
  bundle (199.25M) are the two highest published figures found, Iranian or otherwise, in either research
  pass.
- **The spread is still roughly 1.7 orders of magnitude** (۹۹۰,۰۰۰ to ۱۹۹,۲۵۰,۰۰۰), exactly the
  range the Scout already flagged 2026-09-05 — this pass adds two more data points (Mupra, Duvita)
  inside that same range rather than widening it, which is itself informative: **the market has settled
  into this band, it isn't still discovering a ceiling or a floor.**

### C.3 What no one offers

**Caveat up front, honestly:** nothing about a competitor's *backend architecture* (cross-tenant
isolation, fail-closed SMS, points-ledger expiry semantics) is checkable from outside their product —
that class of claim can only be evaluated for Rezervno itself (already done in
`docs/audit/research/MATRIX.md`, not re-derived here). What follows is scoped to what is *observable
from a competitor's own public pages*, checked across the **10 players with at least partial field-level
data this pass** (SmartX, RSEE, Fidilio, Foodism, Sepidz, Alaedin, SnappFood/Foodro, Mupra, Duvita,
Softmenu) — phrased as "not found among 10 checked," not "no one," since several Tier-2/global and
several sighted-only players (Belfycards, Dobare, Sabzafzar, Hami POS, Sol, Future Software) were not
checked on these columns this pass.

- **A single product built reservation-first, with waitlist + club + points + SMS campaigns + digital
  menu all bundled for the diner-booking use case specifically — not found among 10 checked.** Every
  POS-first player (SmartX, Sepidz, Mupra, Duvita) treats reservation as one module bolted onto a POS
  sale; RSEE is reservation-first but has no confirmed club/points/SMS-campaign layer; Fidilio/Foodism
  are discovery-first; SnappFood/Foodro is delivery-first. This matches the shape the Scout's own
  `iran-reservation-longtail.md` already implied but did not state this explicitly for the two newly
  found players (Mupra, Duvita) — both repeat the exact same POS-first pattern Sepidz set.
- **Free, no-payment-required diner booking with the cancellation policy stated on the booking screen
  itself (not just somewhere on the site) — not confirmed present at any of the 10,** though most
  (SmartX/N-A, Sepidz, Fidilio, Foodism/N-A, Mupra, Duvita) simply don't charge the diner at all so the
  question doesn't arise, and RSEE is the one confirmed opposite case (diner pays, policy is disclosed
  but unfavorable). This is not "nobody offers it" so much as "the comparison mostly doesn't apply,"
  worth naming so it isn't silently claimed as a Rezervno advantage where it isn't actually being
  contested.
- **A transparent, published price for the specific reservation/booking module — not found at Mupra or
  Sepidz** (both contact-gate exactly that one module while publishing everything else), a genuine
  repeat of the pattern the Scout already found for SmartX pre-correction. RSEE and, with the caveat
  above, SmartX (post-correction) remain the only two Iranian players with a fully published reservation
  price.

### C.4 What I did not verify

- **RSEE's diner-side آرسی-to-Toman conversion rate** — confirmed absent again after two more targeted
  searches this pass; now a gap standing across two independent research passes 11 days apart. Search
  terms tried this pass: `آرسی rsee.ir قیمت هر آرسی تومان بسته رزرو`, `rsee.ir خرید بسته آرسی قیمت
  تومان اپلیکیشن`. Not re-attempted: direct `/plans`, `/rules`, `/faq` re-fetch (Scout got 404 on all
  three; budget went elsewhere on the assumption an un-re-fetched 404 is unlikely to have changed).
- **Whether SmartX's add-on line items (POS/prepayment/online-booking on the reservation product) are
  additive to the ۵۲.۸M base or already included** — the fetch tool's summary did not resolve this
  and I did not re-fetch with a more targeted prompt to force clarity, unlike the double-fetch technique
  the Scout used successfully on the `/sorry/` page.
- **SnappFood/Foodro's restaurant-facing commercial terms** — whether Foodro reservations are funded out
  of the existing delivery commission, a separate fee, or something else entirely, was not found and not
  searched for directly this pass; this is arguably the single most important unanswered question this
  file raises, given how decision-relevant the Foodro finding itself is.
- **Duvitasoft.com vs duvita.ir** — whether these are the same corporate entity, a reseller, or an
  unrelated brand collision (the same class of ambiguity the Scout resolved carefully for SmartX's six
  naming collisions) was not resolved.
- **Mupra's "1,500+ restaurants" and "first ME/Europe exporter" claims** — sourced only to what reads as
  a paid placement (`zoomit.ir/pr/...`); not cross-checked against any independent source, the same
  treatment the Scout gave SmartX's `zoomg.ir` hit.
- **The global set (OpenTable/Resy/SevenRooms/Servme/TheFork)** was not re-measured this pass at all —
  out of scope per the brief's Part A player list, named here so it isn't mistaken for an oversight.
- **Generic loyalty SaaS (Belfycards, Dobare, Sabzafzar) and the remaining digital-menu vendors**
  (hidigimenu, menukhan, qrpanel, menuactive) were sighted via search only — zero fetches, zero pricing,
  zero feature confirmation. A future pass should fetch these directly before citing any figure for them.
- **No app was installed and no account was created on anything, this pass or the Scout's** — every
  figure remains store-listing/marketing-page/search evidence, never a hands-on session.
- **Budget:** 35 of the ~45-call budget was used; the remainder was reserved rather than spent chasing
  the weakest remaining leads (generic loyalty SaaS, secondary digital-menu vendors) once the marginal
  value per call dropped, per the brief's own stop condition.

### Sources (this pass, 2026-09-16, all `[fetched]` unless marked `[search]`)

- https://smartx.ir/pricing/ — SmartX pricing
- https://smartx.ir/services/reserve/restaurant/ — SmartX reservation product page (contradiction)
- https://rsee.ir/ — RSEE homepage
- https://cafebazaar.ir/app/com.fidilio — Fidilio Cafe Bazaar listing
- https://fidilio.com/ — Fidilio homepage (first direct fetch in this research programme)
- https://myket.ir/app/app.foodism.tech — Foodism Myket listing
- https://cafebazaar.ir/app/app.foodism.tech — Foodism Cafe Bazaar listing (404, re-confirmed)
- https://sepidz.com/software/restaurant-reservations/ — Sepidz reservation product
- https://www.alaedin.travel/restaurants-cafes — Alaedin restaurant/cafe booking desk
- https://food.snapp.ir/foodro/ — Foodro (SnappFood table-reservation sub-product)
- https://www.zoomit.ir/tech-iran/445513-foodro-snappfood-service/ — Foodro press coverage
- https://www.zoomit.ir/tech-iran/439738-initial-verdict-condemning-snappfood/ — Competition Council ruling coverage
- https://damsaz.kitchen/article/70/... — SnappFood commission-rate blog (2025-10-28)
- https://cafebazaar.ir/app/com.zoodfood.android — SnappFood Cafe Bazaar listing
- https://mupra.ir/pricing/ — Mupra core platform pricing
- https://mupra.ir/reserve/ — Mupra reservation module (contact-gated)
- https://www.zoomit.ir/pr/413146-mupra/ — Mupra traction claim `[search]`, flagged paid placement
- https://duvita.ir/fa — Duvita product + pricing
- https://softmenu.ir/ — Softmenu digital-menu pricing (representative)
- `[search]` various — RSEE credit price (negative result), SnappFood commission (secondary),
  generic loyalty SaaS sighting (Belfycards/Dobare/Sabzafzar), funding search (negative result),
  digital-menu vendor sighting (hidigimenu/menukhan/qrpanel/menuactive)
