# WATCH — Competitive Moves Log
_Maintained by Scout. One line per entry, dated, sourced. Newest first._

Purpose: a running log of competitor moves that change our position — acquisitions, pricing
changes, feature launches, review-sentiment shifts, Iranian app-store policy changes. This is not
analysis (that lives in `profiles/` and `proposals/`); it's the trigger log that tells us *when*
to go re-check something.

---

## 2026

- **2026-09-05** [METHOD — read this before trusting a date below] — **`WebFetch` works in this
  session.** Batches 1 and 2 recorded it as blocked for every domain tested including neutral controls,
  and every quote in `profiles/fidilio.md`, `profiles/smartx.md`, `profiles/foodism.md`,
  `profiles/servme.md`, `profiles/opentable-resy-sevenrooms.md` and `recon-notes-global.md` therefore
  came through `WebSearch`'s server-side synthesis. From batch 3 onward, items marked `[fetched]` were
  read by Scout directly from the named URL. This immediately produced **three corrections to prior
  batches** (SmartX pricing, SmartX `/sorry/`, Foodism's store listing — all below), which is the
  expected yield when a weaker method is replaced by a stronger one, not a sign the earlier work was
  careless. **Second-order lesson, learned the hard way this pass:** `WebFetch` answers your *prompt*
  against the page, so a differently-worded prompt on the same URL surfaces different content — my
  first fetch of `smartx.ir/sorry/` reported "no incident on this page," my second returned its title
  «اختلالات باشگاه مشتریان». **A single negative `WebFetch` result is not evidence of absence.**

- **2026-09-05** — **TheFork/American Express: announced 2026-06-15, NOT closed as of today.** The $700M
  all-cash sale from Tripadvisor is gated on the French Works Council consultation for LaFourchette SAS
  plus regulatory approvals, with completion expected before end-2026. Amex says the combined dining
  ecosystem would reach ~75,000 bookable venues. **Any statement that "Amex owns TheFork" is wrong
  today** — flagged because it would be an easy error to make in a deck. TheFork's own figures in the
  filing: 50,000+ restaurants, $232M revenue for the year to 31 March 2026 (+25% YoY), $28M adj.
  EBITDA. → promoted TheFork from Tier-2 recon to Tier-1: `profiles/thefork.md`; added as a MATRIX
  column. Sources: [Tripadvisor IR](https://ir.tripadvisor.com/news-releases/news-release-details/tripadvisor-enters-agreement-sell-thefork-american-express-700);
  [Qz](https://qz.com/american-express-thefork-tripadvisor-acquisition-700-million-061526) `[search]`.
  **Standing watch item:** if this closes, one card issuer owns Resy, Tock and TheFork; DoorDash owns
  SevenRooms; Quandoo is winding down. Re-check the closing in Q4 2026.

- **2026-09-05** — **TheFork: a cluster of accrued-value confiscations, four in four weeks.** Reading
  the 21 most recent 1-star Trustpilot reviews (corpus: **21,638 reviews, 4.4/5, 12% one-star**),
  **4 of 21 (19%)** report an account suspended and the earned balance lost, with no reason given:
  Yvonne (GB, 2026-07-20) *"My account was suspended suddenly!"* / *"I have earned 20000 Yums in my
  account and it cannot be used now"* (≈£500 at TheFork's published 2000 Yums = £50 rate); Francesco
  Pagliano (IT, 2026-08-02) *"My account was blocked with more than 450 euro in gift cards i paid"*;
  Harry Rose (FR, 2026-07-21); lestamunda (GB, 2026-07-20). Two further reviews report money charged
  without warning — Clive Fathers (GB, 2026-07-21) *"The App did not alert me to the charge, otherwise
  I wouldn't have cancelled"* (£100), AJK (GB, ~2026-08-29) *"Charged £40 even though attended the
  booking."* **Why this changes our model:** TheFork's *expiry* policy is the cleanest in this whole
  programme (one clock, one year, rounded to month-end, one sentence) and it protected none of these
  users, because the loss vector was a platform decision, not a clock. `proposals/001` addresses clocks
  only. → fed the new `proposals/005-no-silent-taking-points-ledger.md` and
  `proposals/006-disclosure-coupled-to-money-capture.md`, and MATRIX's new loyalty-governance row.
  Source: [trustpilot.com/review/www.thefork.com](https://www.trustpilot.com/review/www.thefork.com)
  `[fetched]`.

- **2026-09-05** [Iran] — **NEW COMPETITOR: آرسی / RSEE (`rsee.ir`) — and the diner pays to book.**
  The only live, dedicated, consumer-facing Iranian table-reservation platform found in a full sweep
  (see `profiles/iran-reservation-longtail.md`). Claims **«۲۰۰۰+»** venues. Its currency is the
  **آرسی**, and its own site states **«هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک صندلی
  از یک میز می باشد»** — one ARSEE = one chair, deducted per seat booked, from a package the user buys
  (**«کاربر می تواند اقدام به خرید بسته نماید»** — *can*; whether it is mandatory is UNKNOWN, `/plans`
  `/rules` `/faq` all 404'd). Published cancellation terms `[search]`: 100% back if cancelled >3h
  before, **50% back** between 3h and one slot, **nothing** otherwise. Restaurant-side pricing is
  published with no sales call: free 4 months · **۹۹۰,۰۰۰ تومان**/12mo · **۲,۹۹۰,۰۰۰**/6mo or
  **۳,۹۹۰,۰۰۰**/12mo. **Strategic read:** the Iranian incumbent model already charges the diner for the
  right to reserve, and forfeits it. Rezervno's "free to book" is a differentiator against a live local
  competitor, not just against Western fee models. → new MATRIX column; fed `proposals/006`. Source:
  [rsee.ir](https://rsee.ir/) `[fetched]`.

- **2026-09-05** [Iran] — **CORRECTION to batch 1: SmartX *does* publish restaurant pricing.**
  `MATRIX.md` recorded "ABSENT — several tiers require a sales call" from search synthesis. A direct
  fetch of [smartx.ir/pricing](https://smartx.ir/pricing/) returns a full Toman price list: ارزیابی
  هوشمند ۳۳,۶۵۰,۰۰۰ · باشگاه هوشمند ۵۱,۰۰۰,۰۰۰ · **رزرو هوشمند ۵۲,۸۰۰,۰۰۰** · وای‌فای هوشمند (۱۰ کاربر)
  ۲۱,۰۰۰,۰۰۰, plus bundles to ۱۹۹,۲۵۰,۰۰۰ (مدیریت هوشمند رستوران, ≈۵۴۶,۰۰۰ تومان/روز); all annual. A
  usage-based alternative is also published: activation ۲۹,۵۰۰,۰۰۰ + ۱۰,۰۰۰ تومان per transaction, with
  a **30% discount if 75%+ of invoices carry a customer phone number** — SmartX pays restaurants to
  harvest phone numbers, which sharpens the phone-capture finding already in `profiles/smartx.md`.
  Only intermediate volume bands route to sales (۹۰۰۰-۰۱۱۲۳). **And SmartX contradicts itself:**
  [smartx.ir/services/reserve/restaurant](https://smartx.ir/services/reserve/restaurant/) states
  **۲۱,۴۵۰,۰۰۰ تومان/year** for the same reservation product — a 2.5× gap between two pages of one
  company. Both quoted, neither endorsed. **Landscape effect:** against RSEE's ۳,۹۹۰,۰۰۰/year, SmartX's
  reservation product is **5.4×–13.2×** more expensive; against RSEE's ۹۹۰,۰۰۰ tier, **21.7×–53.3×**.
  The Iranian price of a reservation system spans ~1.7 orders of magnitude with no reliable anchor. →
  MATRIX row "Public, self-serve restaurant pricing" for SmartX: ABSENT → REAL-with-caveat. `[fetched]`

- **2026-09-05** [Iran] — **REFINEMENT to batch 1: the SmartX `smartx.ir/sorry/` apology — confirmed at
  the title, not in the body.** First-hand fetch confirms the page's HTML `<title>` is exactly
  **«اختلالات باشگاه مشتریان | مرداد ماه 1404»** (Mordad 1404 ≈ 2025-07-23 → 2025-08-22), so the
  self-admitted Customer Club disruption stands. **But the body carries no description of the incident
  and no explicit apology for it** — its `h1` is «ما خودمان را مدیون اعتماد شما می دانیم.» and its
  sections are «خبرهای خوبی در راه است» (three new free features "this week"), «درخواست پشتیبانی» and
  «معرفی سرویس های جدید». It is a goodwill/retention page whose *title* names a disruption. → MATRIX
  cell revised from bare `REAL` to `REAL (title-level admission only)`. The prior batch's claim was
  right about the fact and overstated about its form. `[fetched]`

- **2026-09-05** [Iran] — **STATUS CHANGE: Foodism is degrading.** `MATRIX.md` footnote 55 recorded the
  Cafe Bazaar listing as "confirmed live." `cafebazaar.ir/app/app.foodism.tech` now returns **HTTP
  404** on three attempts across two URL forms — and this is not a site outage, since
  `cafebazaar.ir/app/com.fidilio` fetched normally in the same minute. The Myket listing is live but
  shows a build last updated **۱۴۰۱/۰۹/۱۰** (≈ **2022-12-01**, ~3¾ years stale), 4.3/5 over **226**
  reviews, 25,000 installs — and the **first verbatim Foodism user review ever obtained in this
  programme** (batch 2 found none anywhere), معصومه, **۳ خرداد ۱۴۰۵** (≈ **2026-05-24**):
  **«کار نمیکنه»** — *"it doesn't work."* → status **DEGRADED — likely abandoned, not confirmed dead**
  (no install performed). Should not be modelled as a live competitor. Sources:
  [myket.ir/app/app.foodism.tech](https://myket.ir/app/app.foodism.tech) `[fetched]`;
  `cafebazaar.ir/app/app.foodism.tech` `[fetched — HTTP 404]`.

- **2026-09-05** [Iran] — **Fidilio: a login-blocking OTP defect, reported by two different users 28
  days apart, unfixed in between.** First direct read of
  [cafebazaar.ir/app/com.fidilio](https://cafebazaar.ir/app/com.fidilio): **3.7/5 over ۵۸۱ رأی,
  ۱۱۰,۰۰۰ installs** (batch 1 had 3.7/578 via synthesis and could not read the install count — now
  retired). Verbatim: علیرضا, **۱۴۰۴/۰۶/۲۲** (≈2025-09-13) — **«برنامه بسیار ضعیفه پشتیبانی فاجعه س کد
  تایید هم 6 رقمی میفرستن ولی برنامه 4 رقمی میخواد»**; محمد, **۱۴۰۴/۰۷/۱۹** (≈2025-10-11) — **«این دیگه
  چجورشه کد تایید شش رقمی برای وارد کردن 4 رقم!!»**; alireza, **۱۴۰۴/۰۷/۳۰** (≈2025-10-22) — **«واقعا
  افتضاحه تازه که وارد برنامه میشی یه ارور 404میده بعد موقع پرداخت انلاین»**. **The SMS sends 6 digits
  and the input field accepts 4** — a total login failure on the first screen of the funnel, live for at
  least a month across 110,000 installs. Also worth noting: the app's own store name is
  **«فیدیلیو | سفارش غذا»** — *food ordering*, positioning it against SnappFood, not as a reservation
  product. → fed the `profiles/fidilio.md` addendum and a concrete suggestion for `test-integrity`
  (pin OTP code length end-to-end; Rezervno's `lib/sms.ts` fail-closed guard is a *different* defect
  class and does not cover this one). `[fetched]`

- **2026-09-05** [Iran] — **Category finding: nobody has won Iranian table reservation, and two serious
  attempts are in the graveyard.** A full sweep of Cafe Bazaar/Myket/web (see
  `profiles/iran-reservation-longtail.md`) found: **ایتامین/Eatamin** — self-described "first restaurant
  table reservation app in Iran," 3.5/5 over 31 ratings, **520 installs**, last updated **۱۳۹۶/۰۵/۱۸
  (≈2017-08-09)**; **دیدو فود/Dido Food** — 360°/AR discovery *with table reservation*, 3.2/5 over 31
  reviews, **7,000 installs**, last updated **۱۳۹۹/۰۷/۰۳ (≈2020-09-24)**, one reviewer's verdict
  **«متاسفانه طرح شکست خورده»** (*"the project has failed"*). Also newly logged: **علاءالدین تراول**
  (`alaedin.travel`) runs a real restaurant booking desk with **717 venues** nationally (Tehran 189,
  Mashhad 73, Isfahan 53) on a prepay-and-voucher model — so the claim "no Iranian platform has
  restaurant supply at scale" is **false**; and **سپیدز/Sepidz** sells a B2B reservation module bundled
  with POS and a loyalty club, pricing gated behind «درخواست لیست قیمت». Two search-surfaced leads were
  checked and are **not** what they appeared: `mizaa.ir` (described as 3D table reservation) is an image
  gallery, and Myket's «کافه آرسی» is an unrelated classifieds app, not RSEE. **Read:** building the
  operator software is demonstrably not the hard part — Eatamin and Dido both shipped it. Demand-side
  pull is. `[fetched]`

- **2026-09-04** — Servme (2024, reported retrospectively this pass, deep-profiled per the prior
  batch's flag): the clearest example found in this whole recon of a competitor turning
  "region-specific messaging-app-first diner behavior" into an explicit marketing wedge, not an
  afterthought feature. Servme's own comparison pages state it was "built for MENA operators from day
  one" against global platforms that merely "add MENA features" — backed by two concretely dated
  launches: native WhatsApp Business messaging (live 2024-08-16, for confirmations/reminders/
  cancellations/payment links) and a MyFatoorah GCC payment-gateway integration (added 2024, for
  restaurant-collected deposits/prepayments). Directly relevant to Rezervno: Iran's own diner culture
  is also messaging-app-first (different apps, same shape of problem), and this is a live example of a
  MENA-regional competitor treating that as core product surface rather than localization bolt-on —
  worth re-checking if Servme (or a copycat) ever explicitly targets Iran or a Farsi-language market.
  → fed `profiles/servme.md` §"MENA-specific positioning" and MATRIX.md's new Servme column. Sources:
  [servmeco.com/blog/whatsapp-messaging-is-live-on-servme/](https://servmeco.com/blog/whatsapp-messaging-is-live-on-servme/)
  (dated 2024-08-16); [servmeco.com/resources/servme-2024-top-product-launches](https://www.servmeco.com/resources/servme-2024-top-product-launches)
  (MyFatoorah); [servmeco.com/compare-us/tablecheck-vs-servme/](https://servmeco.com/compare-us/tablecheck-vs-servme/)
  (positioning language) — via WebSearch synthesis, `WebFetch` blocked this pass, page text not
  independently re-read.

- **2026-09-04** — Servme funding status is internally contradictory across sources and worth
  monitoring given the broader 2025–2026 wave of reservation-platform consolidation already tracked
  below (Amex/Resy/Tock, DoorDash/SevenRooms, Amex/TheFork, Quandoo's shutdown): Getlatka's revenue
  estimate ($4.6M ARR, $13.9M valuation, 42 employees, 2025) states Servme "grown... without raising
  any venture capital or outside funding," while a separate Crunchbase-sourced search result names
  four investors (Altur Investissement, IM Fndng, Phoenician VC, B&Y Venture Partners) as having
  invested in the company. Neither claim was independently confirmed this pass. If Servme is in fact
  VC-backed, it sits inside the same consolidation-pressure category as the other platforms in this
  log; if genuinely bootstrapped, that's itself a notable outlier in a category where every other
  profiled platform has been acquired or is owned by a larger group. Re-check before citing either
  claim externally. Sources: [getlatka.com/companies/servmeco.com](https://getlatka.com/companies/servmeco.com);
  [crunchbase.com/organization/servme](https://www.crunchbase.com/organization/servme) (via WebSearch
  synthesis only).

- **2026-09-04** — OpenTable's April 16, 2026 client-agreement update requires partner restaurants
  to make OpenTable their "primary system of record" for reservations/tables/guests — drew a formal
  antitrust complaint to Washington State, which responded in writing that it would review whether
  the new terms "may constitute an anticompetitive practice." → fed proposal
  `proposals/003-transparent-restaurant-terms.md` and MATRIX.md row "No exclusivity/lock-in clause."
  Sources: [Restaurant Dive](https://www.restaurantdive.com/news/open-table-client-agreement-updates-primary-table-mangement/815706/);
  [Washington State Standard, 2026-04-15](https://washingtonstatestandard.com/2026/04/15/opentables-new-rules-have-a-seattle-business-leader-calling-foul/).

- **2026-09-04** — Quandoo (global reservation marketplace, commission-per-cover model, same family
  as OpenTable's pricing) announced a full wind-down: stopped new bookings Sept 30, 2026, full
  shutdown Dec 31, 2026, after a "strategic portfolio review." A live case study of a per-cover
  commission model failing in a market that shifted toward flat-fee competitors (Eat App, Zenchef,
  Servme). Source: [search synthesis of 2026 migration-guide posts](https://reserve.skiper.io/en/quandoo-alternative-restaurant-booking)
  (secondary sourcing only — primary Quandoo announcement not independently re-fetched this pass).

- **2026-09-04** [Iran] — Fidilio (2024, reported retrospectively this pass): a controversy broke
  after a user found Snapp Food branding/addresses appearing inside Fidilio's app without clear
  disclosure — addresses saved in Snapp Food stayed in sync with edits inside Fidilio. CEO Mohammad
  Bagheri called it a "technical bug" from API integration; Digiato/Tabnak/Startup360 covered the
  explanation as disputed. → fed proposal `proposals/002-data-provenance-receipt.md` and MATRIX.md
  row "Cross-tenant / cross-brand data isolation." Sources: [Digiato](https://digiato.com/iran-technology-news/is-fidilio-the-same-as-snappfood);
  [Tabnak](https://www.tabnak.ir/fa/news/1283338/); [Startup360](https://startup360.ir/snappfood-fidilio-does-not-have-any-data-from-snappfood/).

- **2026-09-04** [Iran] — SmartX (Aug 2025, reported retrospectively this pass): the company's own
  site carries an apology page, `smartx.ir/sorry/` ("اختلالات باشگاه مشتریان | مرداد ماه ۱۴۰۴"),
  acknowledging Customer Club service disruptions, sandwiched between two consecutive "Stay Strong"
  retention campaigns (`smartx.ir/stay-strong/`, `/stay-strong-2/`, Tir 1404 / June–July 2025) — a
  self-admitted reliability incident serious enough to require back-to-back anti-churn campaigns.
  Source: `smartx.ir/sorry/`, `smartx.ir/stay-strong/`, `smartx.ir/stay-strong-2/` (via WebSearch
  synthesis — WebFetch blocked this pass, page text not independently re-read).

- **2026-09-04** — Starbucks Rewards' March 2026 tier relaunch (Green/Gold/Reserve) triggered
  visible backlash: longtime members logged in and found themselves re-labeled "Green," read it as
  a demotion, and pushed back across Reddit/X/Instagram — because the tier-naming change (Gold was
  discontinued in 2019, reintroduced in 2026 without enough communication) collided with old brand
  memory. Relevant to any Rezervno tier/streak design: a tier *rename* or *reset* needs explicit
  in-product communication of "why," not just a silent relabel. Sources: [Starbucks press
  release, 2026](https://about.starbucks.com/press/2026/reimagined-starbucks-rewards-loyalty-program-launches-with-new-member-benefits/);
  [Newsweek, "Starbucks revamps Rewards program—why it's getting immediate backlash," 2026](https://www.newsweek.com/starbucks-revamps-rewards-program-2026-11659352);
  [CNBC, 2026-01-29](https://www.cnbc.com/2026/01/29/starbucks-to-reintroduce-loyalty-program-tiers.html).
  (Full verbatim complaint quotes not yet fetched — thetakeout.com blocked by egress policy in
  this pass; treat the backlash claim as sourced-but-paraphrased until a quote is captured.)

- **2026-09-04** — Resy and Tock (both owned by American Express) are merging into a single
  platform under the Resy name; Tock's ~25k fine-dining/winery venues fold into Resy, roughly
  doubling its inventory to compete with OpenTable's 60k+. Tock's own app/site will be retired;
  Tock's restaurant-management software continues operating. Amex acquired Resy (2019), Tock
  (2024), and middleware provider Rooam. Watch for: guest-facing UX regressions during the merge
  (imported deposit/cancellation policies, migrated loyalty/points if any), and whether Tock's
  pre-paid "tiered experience" ticketing model survives the merge into Resy's UI. Sources:
  [Restaurant Business Online](https://www.restaurantbusinessonline.com/technology/reservation-services-resy-tock-are-merging);
  [Upgraded Points](https://upgradedpoints.com/news/resy-merges-with-tock-adds-25k-venues/)
  (Amex announcement 2026-02-24, per these reports).

- **2026-09-04** — DoorDash completed its ~$1.2B acquisition of SevenRooms (announced May 2025,
  closed June 13, 2025). SevenRooms' CRM/reservations/marketing stack is being folded into
  DoorDash's "Commerce Platform." Watch for: SevenRooms restaurants getting pushed toward
  DoorDash's delivery/marketing bundle, pricing changes for reservation-only customers, and
  whether independent (non-delivery) restaurants start looking for a reservation platform that
  isn't tied to a delivery marketplace — that's a wedge for Rezervno's positioning. Sources:
  [DoorDash IR, 2025-05-07](https://ir.doordash.com/news/news-details/2025/DoorDash-Announces-Agreement-to-Acquire-SevenRooms-to-Enhance-Commerce-Platform-Offerings/default.aspx);
  [Restaurant Dive](https://www.restaurantdive.com/news/DoorDash-acquires-sevenrooms-1-billion/747226/);
  [DoorDash completion announcement](https://about.doordash.com/en-us/news/doordash-completes-acquisition-of-sevenrooms).

- **2026-09-04** [Iran] — SnappFood (10 Dey 1402 / ≈2023-12-31, reported retrospectively this pass): a
  hacker group calling itself IRLeaks claimed to have breached SnappFood's full database — 20M+ users
  (username, password, email, name, mobile, birthdate), 880M+ product orders, 160M+ courier trips, and
  240k+ vendor records — and put the data up for sale directly rather than negotiating with SnappFood
  first. SnappFood issued a statement confirming a partial breach of user data, stating bank-card details
  are not stored in its database. A second, larger, independent data-incident data point for Rezervno's
  data-provenance positioning (`proposals/002-data-provenance-receipt.md`), alongside Fidilio's 2024
  address-sync controversy — same ~12-month window, different companies, same underlying theme (Iranian
  food-delivery platforms and user data trust). Sources:
  [Digiato](https://digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform);
  [Shahr-e Sakht-Afzar](https://www.shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked);
  [Tasnim, 1402/10/10](https://www.tasnimnews.com/fa/news/1402/10/10/3014883/).

- **2026-09-04** [Iran] — SnappFood (Competition Council decision No. 740, dated 16 Ordibehesht 1404 /
  ≈2025-05-06, reported retrospectively this pass): following complaints from rivals TapsiFood and
  Zoodex, Iran's Competition Council ruled SnappFood's restaurant contracts anticompetitive — SnappFood
  had offered restaurants **commission discounts conditioned on exclusive cooperation**, with exit
  penalties for restaurants that tried to work with competitors. An appeals board later confirmed the
  ruling; SnappFood's request for reconsideration was rejected and exclusivity clauses were ordered
  removed from all contracts (existing and future). Relevant to Rezervno's own commercial-terms design
  (`proposals/003-transparent-restaurant-terms.md`) and to any assumption that SnappFood's consumer-
  facing "discounts" are platform-subsidized rather than commission-lever-driven — see
  `profiles/snappfood-loyalty.md` for the full loyalty-mechanics writeup this fed. Sources:
  [Zoomit](https://www.zoomit.ir/iran-news/456136-snappfood-monopoly-verdict-tapsi-zoodex/);
  [Digiato](https://digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood);
  [National Competition Council decision page](https://www.nicc.gov.ir/council/decisions-council/2184-740-16-1404.html).

---

## Log discipline
- Every entry needs a date observed + source URL. No entry without a source.
- When a watched move changes a MATRIX.md cell, update the matrix in the same pass and note it here
  ("→ updated MATRIX row X").
- Iran-market entries (Cafe Bazaar/Myket policy, Fidilio/SmartX pricing or feature changes) go here
  too, not just global ones — see `profiles/fidilio.md` and `profiles/smartx.md` for the baseline
  this log watches against.
