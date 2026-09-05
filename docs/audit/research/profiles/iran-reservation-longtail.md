# Iran — the reservation long tail (RSEE, Alaedin, Sepidz, and a graveyard)

_Written 2026-09-05 by Scout (batch 3). This closes the open item carried by both prior BRIEFs:
**"any other Iranian reservation/loyalty app on Cafe Bazaar/Myket/Sibapp not yet found."** It is not a
single-company profile; it is a sweep of everything else in the Iranian table-reservation category
after Fidilio, SmartX and Foodism, including the things that turned out not to exist._

> **Methodology.** Unlike batches 1–2, `WebFetch` works this session. Every store listing and pricing
> figure below marked `[fetched]` was read directly from the named URL by me on **2026-09-05**.
> Persian dates are given verbatim as printed, followed by *my own* Gregorian conversion — in two cases
> the fetch layer's own conversion was wrong and I say so explicitly rather than silently correcting it.

---

## The headline finding

**Nobody has won Iranian restaurant table reservation. Every dedicated attempt found is dead, tiny, or
charges the diner for the privilege of booking.**

| Player | What it is | Status 2026-09-05 | Evidence |
|---|---|---|---|
| **آرسی / RSEE** (`rsee.ir`) | Dedicated web/app cafe+restaurant reservation platform | **LIVE.** Claims "۲۰۰۰+" venues. Diner buys credit packages to book | `[fetched]` |
| **علاءالدین تراول** (`alaedin.travel`) | Travel agency's restaurant/cafe booking desk | **LIVE.** 717 venues listed nationally; prepay-and-voucher | `[fetched]` |
| **سپیدز / Sepidz** | B2B reservation module bundled with a POS + loyalty club | **LIVE.** Pricing gated behind "درخواست لیست قیمت" | `[fetched]` |
| **ایتامین / Eatamin** | "First restaurant table reservation app in Iran" (its own claim) | **DEAD.** Last update ۱۳۹۶/۰۵/۱۸ ≈ 2017-08-09; 520 installs | `[fetched]` |
| **دیدو فود / Dido Food** | 360°/AR restaurant discovery **with table reservation** | **DEAD.** Last update ۱۳۹۹/۰۷/۰۳ ≈ 2020-09-24; 7,000 installs | `[fetched]` |
| **فودیسم / Foodism** | Discovery/review social network (profiled batch 2) | **DEGRADED — see below** | `[fetched]` |
| **میزا / mizaa.ir** | Search results describe it as "3D cafe/restaurant table reservation" | **NOT A RESERVATION SERVICE.** Checked — it is an image-gallery site | `[fetched]` |
| **کافه آرسی** (Myket) | Surfaced by a search for RSEE's app | **NOT RSEE.** Unrelated classifieds/marketplace app, <100 installs | `[fetched]` |

That table is the competitive landscape. Two of the eight are dead, two are false leads, one is
degrading, one is a travel agency's side desk, one is B2B-only, and exactly **one** — RSEE — is a live,
dedicated, consumer-facing table-reservation product. That is the whole field.

---

## آرسی / RSEE — the only live dedicated competitor, and its model is the story

**Source:** [rsee.ir](https://rsee.ir/) `[fetched]` 2026-09-05. Verbatim Persian quoted below.

### What it is
A reservation *facilitator*, explicit about not being a venue itself. Web app plus mobile app. Diner
searches by location, sees the venue's menu/amenities/reviews/hours, **picks a specific table and time
slot**, books up to one week ahead. Claims **"۲۰۰۰+"** partner cafes and restaurants.

### The mechanic that matters: the diner pays to hold a table

> **"جهت انجام رزرو میز کافه/رستوران، کاربر می تواند اقدام به خرید بسته نماید"**
>
> **"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک صندلی از یک میز می باشد"**

The unit of account is the **آرسی** — one ARSEE = one chair. Book a four-top, four ARSEE are deducted
from the package you bought. Combined with the published cancellation terms `[search]`:

- Cancel **more than 3 hours** before the slot → **100%** of the prepaid amount returned to the user's
  account.
- Cancel **between 3 hours and one slot** before → **50%** returned.
- Otherwise → **nothing** returned.

**Precision matters here and I am not going to overstate it.** The verbatim Persian says the user
*«می تواند»* — *can* — buy a package, not *must*. I did **not** find a sentence stating that package
purchase is mandatory for every booking, and I could not reach `rsee.ir/plans`, `/rules` or `/faq`
(all HTTP 404 `[fetched — negative result]`). What is verified: **a paid, chair-denominated credit
currency exists, it is spent on booking, and 50–100% of it is forfeited on a late cancellation.**
Whether a free booking path exists alongside it is **UNKNOWN — not verified.**

### Restaurant-side pricing — published, and cheap

| Plan | Price `[fetched]` |
|---|---|
| پلن ۱ (پایه) | **رایگان** — ۴ ماه بدون هزینه |
| پلن ۲ (حرفه‌ای) | **۹۹۰,۰۰۰ تومان** / ۱۲ ماهه (RSEE's own math: ≈ ۸۲,۵۰۰ تومان per month) |
| پلن ۳ (کامل) | **۲,۹۹۰,۰۰۰ تومان** / ۶ ماه — or — **۳,۹۹۰,۰۰۰ تومان** / ۱۲ ماه |

RSEE publishes real numbers on a public page with no sales call. That is more pricing transparency
than Fidilio (commission undisclosed), Foodism (contact-only ad packages), Sepidz (price list on
request), **or TheFork** (`profiles/thefork.md` — own restaurant pages 404, three contradictory
third-party figures). Credit where due.

### Gen-Z lens on RSEE
- **Money respect: fails, and it is the defining fact about this product.** Prepaying for the *right
  to reserve* — before any food, before any confirmation from the restaurant — and then forfeiting
  50–100% of it for cancelling inside three hours, is the single most diner-hostile money mechanic
  found anywhere in this research programme, including OpenTable's $25–50 no-show fees and Resy's
  $100. Those at least attach to a no-show. RSEE's currency is consumed by *booking*.
- **Time to first value: structurally bad.** The funnel is: discover → **buy a credit package** →
  book. A payment step sits between a first-time user and their first reservation. Every other
  consumer reservation product in this research set — OpenTable, Resy, TheFork, Fidilio, Catchtable
  (deposit set by the restaurant, not the platform) — puts the first booking before the first payment.
- **Trust:** it does explain its rules, in plain Persian, on a public page. That is genuinely better
  than SmartX's or Fidilio's opacity. The rules are just bad rules, clearly stated.
- **What to steal:** the public, no-sales-call price list, and *table-level* selection (pick the actual
  table, not just a time). **What never to copy:** charging the diner to book.

---

## علاءالدین تراول — the incumbent nobody counted

**Source:** [alaedin.travel/restaurants-cafes](https://www.alaedin.travel/restaurants-cafes)
`[fetched]` 2026-09-05.

A travel agency running a restaurant/cafe booking desk inside its wider travel product. **717
restaurants and cafes across Iran** — Tehran 189, Mashhad 73, Isfahan 53 — filterable by city,
capacity and cuisine, with VIP rooms and hotel in-room dining. Booking generates a **voucher** the
diner presents on arrival; the page describes paying *«علی‌الحساب»* (on account) for
fixed-price buffet meals.

**Why this belongs in the file.** 717 listed venues is not a toy. It is roughly a third of RSEE's
claimed 2,000 and it has real distribution attached to an established travel brand and tour groups.
It is aimed at travellers and groups rather than a Tehran twenty-something choosing where to eat
tonight — so it is not a head-on competitor — but any claim that "no Iranian platform has restaurant
supply at scale" is false, and I would have made that claim before fetching this page.

**UNKNOWN:** whether the diner pays a booking fee distinct from the buffet prepayment; restaurant-side
commercial terms; review data (none gathered).

---

## سپیدز / Sepidz — the B2B pattern repeating

**Source:** [sepidz.com/software/restaurant-reservations](https://sepidz.com/software/restaurant-reservations/)
`[fetched]` 2026-09-05.

Web-based reservation/queue management for restaurants, cafes and fast food, sold as a module
alongside a POS. Features stated: smart table assignment by location and capacity; in-person, phone
and online booking; SMS confirmations; **online prepayment collection**; capacity caps; POS
integration; one year support plus a month of free coaching. Add-ons include an **online reservation
module**, **prepayment**, a **«باشگاه مشتریان رستورانی هوشمند»** (smart restaurant loyalty club) whose
existing credit a diner can spend during a reservation, and a survey/feedback tool.

**Pricing: not published.** The page routes to *«درخواست لیست قیمت»* — request a price list. This is the
same "contact us" opacity already documented for SmartX (partially — see the correction below),
Fidilio and Foodism. **No consumer-facing Sepidz app was found**; the diner-facing surface described is
a *«صفحه تعاملی»* (interactive status page). Structurally this is SmartX's shape: operator software with
no demand-side product of its own.

**UNKNOWN:** customer count (not disclosed), any review data, whether the loyalty club is
server-authoritative.

---

## The graveyard — and why it is evidence, not filler

**ایتامین / Eatamin** — [cafebazaar.ir/app/com.eatamin.arvinrokni.amingholami](https://cafebazaar.ir/app/com.eatamin.arvinrokni.amingholami) `[fetched]`.
Rating 3.5/5 from **31** ratings, **520 installs**, version 1.1, last updated **۱۳۹۶/۰۵/۱۸** (my
conversion: **2017-08-09**). Self-described as *"the first restaurant table reservation application in
Iran,"* bundled with florals, balloon decor, candles, a dedicated car and a photographer. Reviews, both
**۱۳۹۶/۰۱/۰۸–۰۹** (2017-03-28/29): *morteza* — "Completely useless. One star only because I know what
this software is"; *s0^^!* — "Won't open on my phone, gives an error and closes." Nine years without an
update.

**دیدو فود / Dido Food** — [myket.ir/app/co.silverpath.dido](https://myket.ir/app/co.silverpath.dido) `[fetched]`.
Rating 3.2/5 from **31** reviews, **7,000 installs**, last updated **۱۳۹۹/۰۷/۰۳**. *My conversion:
**2020-09-24**; the fetch layer reported "July 24, 2020" — that conversion is wrong and I am flagging it
rather than passing it on.* 360° venue tours, AR food previews, ordering **and table reservation for a
chosen date**, Tehran only. One reviewer's verdict: **«متاسفانه طرح شکست خورده»** — "unfortunately the
project has failed."

**Two false leads, documented so nobody re-walks them.** `mizaa.ir` is described in Persian search
results as a 3D cafe/restaurant table-reservation service; fetching it returns an **image and wallpaper
gallery** (space photos, celebrities, profile pictures), footer *«تمامی حقوق این سایت محفوظ است © ۱۴۰۲»*,
with no reservation, pricing or restaurant content whatsoever. `myket.ir/app/caferc.asemansystem.com.caferc`
("کافه آرسی") surfaced on an RSEE search and is **not RSEE** — it is an unrelated buy/sell classifieds app,
fewer than 100 installs, last updated **۱۳۹۸/۰۱/۰۷** (my conversion: **2019-03-27**; the fetch layer said
"January 7, 2019" — also wrong).

**Why the graveyard is the most useful part of this file.** Two funded-looking, feature-rich attempts at
Iranian table reservation — one in 2017, one in 2020 — both shipped, both stalled, both left <10k
installs and a handful of reviews. That is not proof the category is unwinnable. It *is* evidence that
building the operator software is not the hard part (Eatamin and Dido both built it), and it makes
demand-side pull, not feature count, the thing to be paranoid about.

---

## Two corrections to prior batches (first-hand fetch beats search synthesis)

### 1. SmartX **does** publish restaurant pricing — `MATRIX.md` said ABSENT

`profiles/smartx.md` and `MATRIX.md` recorded SmartX's public pricing as **ABSENT — several tiers
require a sales call**, sourced to `WebSearch` synthesis. A direct fetch of
[smartx.ir/pricing](https://smartx.ir/pricing/) on 2026-09-05 `[fetched]` returns a full published
price list in Toman:

| Item | Published annual price |
|---|---|
| ارزیابی هوشمند (Smart Evaluation) | ۳۳,۶۵۰,۰۰۰ تومان |
| باشگاه هوشمند (Smart Club) | ۵۱,۰۰۰,۰۰۰ تومان |
| **رزرو هوشمند (Smart Booking)** | **۵۲,۸۰۰,۰۰۰ تومان** |
| وای‌فای هوشمند، ۱۰ کاربر | ۲۱,۰۰۰,۰۰۰ تومان |
| بسته ارزیابی پیشرفته | ۵۰,۹۵۰,۰۰۰ (≈۱۳۹,۰۰۰/روز) |
| بسته باشگاه پیشرفته | ۶۶,۰۰۰,۰۰۰ (≈۱۸۱,۰۰۰/روز) |
| بسته سه‌سرویسه | ۱۰۱,۹۵۰,۰۰۰ (≈۲۷۹,۰۰۰/روز) |
| مدیریت هوشمند رستوران | ۱۹۹,۲۵۰,۰۰۰ (≈۵۴۶,۰۰۰/روز) |

A second model is also published: activation **۲۹,۵۰۰,۰۰۰ تومان** + **۱۰,۰۰۰ تومان per transaction**,
with an initial wallet of ۴,۵۰۰,۰۰۰ تومان (~500 transactions) and a 30% discount if 75%+ of invoices
carry a customer phone number — *i.e. SmartX pays restaurants to harvest phone numbers*, which
sharpens rather than contradicts the phone-capture finding already in `profiles/smartx.md`.

**Corrected verdict:** SmartX publishes a real price list; only **intermediate volume bands** are routed
to a sales line (۹۰۰۰-۰۱۱۲۳). The MATRIX cell moves ABSENT → REAL-with-caveat.

**And a contradiction inside SmartX's own site, which I am not resolving.**
[smartx.ir/services/reserve/restaurant](https://smartx.ir/services/reserve/restaurant/) `[fetched]`
states an annual cost of **۲۱,۴۵۰,۰۰۰ تومان** for the reservation product, against **۵۲,۸۰۰,۰۰۰ تومان**
for "رزرو هوشمند" on the pricing page. Two pages, one company, one product, a 2.5× gap. Consistent with
the lesson `BRIEF-2026-09-05.md` drew from Servme: single-sourcing a competitor "fact" is a yellow flag
even when the source is the company itself.

**What this does to the Iranian pricing landscape.** Against RSEE's published **۳,۹۹۰,۰۰۰ تومان/year**
(Complete) and **۹۹۰,۰۰۰ تومان/year** (Professional), SmartX's reservation product is **5.4×** more
expensive on its own lower figure and **13.2×** on its higher one; against RSEE Professional, **21.7×**
and **53.3×**. Rezervno is entering a market where the price of a restaurant reservation system ranges
across roughly **1.7 orders of magnitude** with no reliable published anchor. That is a positioning
opportunity and a pricing hazard at the same time, and the founder should see the actual numbers before
setting ours.

### 2. Foodism is degrading, and `MATRIX.md`'s "REAL but thin" footprint row needs revising

`MATRIX.md` footnote 55 records the Cafe Bazaar listing (`cafebazaar.ir/app/app.foodism.tech`) as
"confirmed live." On 2026-09-05 that URL returns **HTTP 404**, on three attempts across two URL forms
(`?l=en` and bare) `[fetched — negative result]` — while `cafebazaar.ir/app/com.fidilio` fetched fine in
the same minute, so this is not a site-wide outage or a rendering artifact.

Meanwhile [myket.ir/app/app.foodism.tech](https://myket.ir/app/app.foodism.tech) `[fetched]` is live and
shows: **4.3/5 from 226 reviews, 25,000 installs, last updated ۱۴۰۱/۰۹/۱۰** (my conversion:
**2022-12-01**) — a build that has not shipped in **~3¾ years** — with a review from **۳ خرداد ۱۴۰۵**
(my conversion: **2026-05-24**) reading simply **«کار نمیکنه»** — *"it doesn't work."*

**Honest reading:** the Myket rating (4.3 vs the 4/5 recorded in batch 2) and count (226 vs 216) both
drifted upward slightly, so the listing is not frozen. But an app whose binary is from December 2022,
whose Cafe Bazaar listing 404s, and whose most recent surfaced review says it doesn't work, is **not a
live competitor**. It is not confirmed dead either — I did not install it. Recorded as
**DEGRADED — likely abandoned, not confirmed.**

---

## What I did NOT verify (whole file)

- **No app was installed and no account was created on any of these.** Everything is store-listing,
  marketing-page and search evidence. Time-to-first-value for RSEE — the number that would settle
  whether its prepay wall actually kills the funnel — is **UNKNOWN**.
- **RSEE: whether buying a package is mandatory.** The verbatim says *«می تواند»* (can). `/plans`,
  `/rules` and `/faq` all 404'd. The cancellation-refund language came via `[search]`, not a fetch.
- **RSEE: the "۲۰۰۰+" venue claim is RSEE's own,** unaudited, and I found no independent corroboration.
  Same for Alaedin's 717, which is at least a countable on-page listing rather than a marketing round
  number.
- **No review data for RSEE, Alaedin or Sepidz.** No app-store listing for RSEE was located (the one
  the search surfaced was a different app), so there is no independent complaint corpus for the only
  live competitor in the category. That is the biggest single gap in this file.
- **I did not check Sibapp**, named in the founder's brief alongside Cafe Bazaar and Myket.
- **SmartX's two contradictory prices are both quoted, neither is endorsed.**
- **Persian→Gregorian conversions are mine.** Where the fetch layer's own conversion disagreed with
  mine (Dido, CafeRC) I have said so and shown both. If the CEO needs these dates load-bearing,
  re-derive them.
