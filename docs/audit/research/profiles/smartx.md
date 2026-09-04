# SmartX — Competitor Profile
_Last updated: 2026-09-04 by Scout_

> **Research-method caveat (read first):** In this research pass, the WebFetch tool was
> completely non-functional for the entire session — it returned `EGRESS_BLOCKED` for
> *every* domain tested, not just `smartx.ir`/`myket.ir`/`cafebazaar.ir` but also
> unrelated control domains (`example.com`, `www.google.com`, `en.wikipedia.org`,
> `www.anthropic.com`). This was confirmed as a session-wide tool failure, not a
> site-specific block, before I stopped retrying it. As a result, **I was never able to
> load a single SmartX page directly and read its raw HTML/text myself.** Everything
> below sourced to `smartx.ir/...` was obtained through the WebSearch tool's own
> synthesized summaries of that page (built from its indexed snippets), not from a
> direct fetch. That is weaker evidence than "I opened the page and read it": treat
> every `smartx.ir` citation below as **search-engine-mediated, not independently
> confirmed verbatim** — I have paraphrases with high confidence in the *facts* (prices,
> product names, dates) because they were repeated consistently across multiple
> independent queries, but I could not pull true verbatim quotes from first-party pages,
> and I flag every place this matters.

## Identity check

**Confirmed target:** `smartx.ir` — "اسمارت ایکس" (SmartX), a cloud-based B2B software
suite for restaurants/cafés in Iran, covering table reservation, a customer loyalty
club, "smart WiFi" customer-data capture, and CSAT/evaluation surveys. Legal entity
name found via search: **شرکت نوآفرینان هوشمند آسیا** ("Noafarinan-e-Hooshmand-e-Asia
Co.") trading as SmartX. First market presence dated to 1394 (2015/2016) per its own
"about us" page (9+ years active as of 2026); it describes itself as a business partner
of **Sepidz** (سپیدز, a 20+‑year‑old Iranian restaurant/fast-food POS vendor) since
1399 (2020), and — per one search snippet — "از زیرمجموعه‌های شرکت همکاران سیستم"
(a subsidiary/affiliate of the Hamkaran Sistem group, one of Iran's oldest enterprise
software conglomerates), alongside partners "Sepidar Sistem" and "Vendo." Sepidz's own
site resells the product directly at `sepidz.com/software/smart-x/`, describing it as
the loyalty/reservation module it offers its own restaurant/fast-food/coffee-shop POS
clients. Company size on the Iranian job board Karboom: 10–50 employees, classified
"دانش‌بنیان" (a formal Iranian knowledge-based-company tax designation).
Sources: `smartx.ir/about-us/`, `smartx.ir/key-partners/`, `sepidz.com/software/smart-x/`,
karboom.io company page, jobvision.ir/jobinja.ir listings — all via WebSearch, 2026-09-04.

**Naming collisions ruled out** (this name is heavily overloaded — six distinct
unrelated "SmartX" products/companies surfaced in search before I could confirm the
right one):

1. **SmartX (Milagro Corp, USA)** — `milagrocorp.com`. Milagro is a US multi-location
   restaurant operating system (POS, online ordering, reservations, loyalty). Inside
   that suite, "SmartX" is specifically their *customer-feedback/review-aggregation*
   module ("gathers all the customer feedback, analyzes it and provides actionable
   insights to rake in more 5-star reviews online... integrated to other POS systems
   such as Aloha, Micros, Posi, Toast"). This is the closest false-positive — same
   industry (restaurant tech), same product name — but a sub-feature of a different,
   US-based company, unrelated to Iran. **Ruled out.**
2. **SMArtX Advisory Solutions** — `smartxadvisory.com` / `smartxadvisory.com`, a US
   fintech "managed accounts" marketplace for financial advisors/RIAs/broker-dealers
   (2,700+ strategies, 375+ asset managers). Completely different industry. **Ruled
   out.**
3. **SmartX Global / SmartX Traders / smartx.io** — multiple unrelated crypto/forex/
   prediction-market automated-trading platforms. **Ruled out.**
4. **SmartX Technology Inc.** — a US/China RFID + warehouse robotics/asset-tracking
   vendor (industrial, oil & gas, logistics). **Ruled out.**
5. **"SMARTx" on Cafe Bazaar** (the Bluetooth smartwatch/fitness-tracker companion app,
   `com.smalife`-type package) — Iranian, but a wearables/health-tracker app, unrelated
   to restaurants. **Ruled out.**
6. **A possible second, unresolved Iranian collision:** a LinkedIn page
   `ir.linkedin.com/company/smartxacc` (handle suggests "SmartX Accelerator," 1,122
   followers) and matching Jobinja/Jobvision listings describe "Smartx" as **"a
   specialized startup accelerator in the field of smart automation... for university
   students and graduates."** This reads like a *different* initiative from the
   restaurant-SaaS company, but other Jobinja listings under the same "smartx" company
   page also advertise food-and-beverage-focused roles ("این شرکت... تمرکز فعلی این
   شرکت در صنعت غذا و نوشیدنی است" — "this company's current focus is the food &
   beverage industry"). **I could not fully resolve whether this is (a) the same
   corporate entity running an internal R&D/"acceleration" function under the same
   brand, or (b) a genuinely separate accelerator program sharing the SmartX brand
   inside the same Hamkaran Sistem-linked corporate family.** Flagging this explicitly
   rather than guessing — it did not change which product I profiled (the food &
   beverage focus and the smartx.ir domain match on every other signal), but it is a
   loose end. UNKNOWN — not verified.

Given the consistent, repeated match across smartx.ir, sepidz.com, karboom.io, and
Iranian job boards — all independently describing a restaurant/café CRM-reservation-
loyalty-WiFi SaaS product — I'm confident `smartx.ir` is the correct subject.

## What it is

A cloud-hosted (SaaS, no on-prem infrastructure required) suite of four sold-separately
products for restaurant/café owners in Iran:
1. **رزرو هوشمند (Smart Reservation)** — web-based reservation/table-booking &
   appointment management, with an online booking portal for diners, POS integration,
   and prepayment/deposit support.
2. **باشگاه مشتریان (Customer Club)** — a loyalty/CRM platform: customer purchase-
   history tracking, RFM-style segmentation, coupons, a gamified "wheel of fortune"
   add-on, churn-risk flags, multi-branch quality control.
3. **وای‌فای هوشمند (Smart WiFi)** — a captive-portal WiFi login (SMS-OTP
   authentication) that captures every connecting customer's phone number into the
   restaurant's marketing database, plus bandwidth/usage control.
4. **ارزیابی هوشمند (Smart Evaluation)** — automated post-visit customer-satisfaction
   (CSAT) survey collection, positioned as faster/cheaper than manual outreach.

All four are described as integrating with the restaurant's existing POS/checkout
("صندوق"), automating the customer journey "from reservation to exit." SmartX is sold
as an add-on/module through POS partners (Sepidz, and per its partners page, Sepidar
Sistem and Vendo), not as a stand-alone consumer product people discover on their own.
Sources: `smartx.ir/services/`, `smartx.ir/services/reserve/restaurant/`,
`smartx.ir/services/club/`, `smartx.ir/services/wifi/restaurant/`,
`smartx.ir/services/evaluation/restaurant/` — all via WebSearch, 2026-09-04.

## Who it's for

**Restaurant/café owners and managers — this is B2B software, not a consumer app.**
Every product description is addressed to "مدیران رستوران" (restaurant managers) /
"صاحبان کسب‌وکار" (business owners). The one Android app found (`myket.ir/app/com.smartx`)
explicitly requires an existing SmartX account to log in ("ورود به این برنامه تنها
برای کاربران دارای حساب کاربری در اسمارت ایکس امکان‌پذیر است") — i.e., it's a
staff/management companion app, not something a diner would install to find or book a
restaurant. Diners only ever touch SmartX indirectly: through a restaurant's own
booking widget, a WiFi captive-portal login page, or an SMS from the restaurant's
loyalty program — never through a SmartX-branded consumer app or marketplace. This
matches the task brief's expectation that SmartX may be "more of a B2B restaurant
POS/reservation-management tool than a consumer-facing app" — confirmed.
Sources: `myket.ir/app/com.smartx` and `smartx.ir/app/` via WebSearch, 2026-09-04.

## Business model & pricing

Annual subscription, one price per product line (no usage-based consumer pricing
visible; SMS credits and some hardware are billed separately). All figures below come
from `smartx.ir/pricing/` and `smartx.ir/other-expenses/` as rendered through
WebSearch's summary — I could not open the page myself, so treat exact digit accuracy
as CLAIMED-but-consistent rather than independently double-checked against the raw
page:

| Product | Price found | Source |
|---|---|---|
| Smart Reservation (رزرو هوشمند) | **21,450,000 Toman/year** | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 |
| Customer Club, base tier (باشگاه مشتریان) | **33,500,000 Toman/year** | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 |
| Customer Club + add-ons (wheel-of-fortune + credit-card/RFID connect) | **up to ~43,000,000 Toman/year** | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 |
| Smart WiFi — tiered packages | **33,600,000 / 43,000,000 / 67,100,000 Toman/year** (basic / advanced / "five-service" tiers; ~93k/118k/184k Toman *per day* equivalent as quoted) | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 |
| Smart WiFi — a second, lower figure also surfaced | **8,140,000–25,300,000 Toman/year** range | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 — **I cannot reconcile this with the tiered figures above from search snippets alone; flagging the inconsistency rather than picking one.** UNKNOWN which is current/correct. |
| WiFi "coupon" add-on | **3,500,000 Toman** (one-time or annual — unclear) | `smartx.ir/other-expenses/`, via WebSearch, 2026-09-04 |
| Payment-gateway setup for reservation prepayment | Setup fee + per-transaction fee, **amount not disclosed in snippets** | `smartx.ir/services/reserve/restaurant/`, via WebSearch, 2026-09-04 — UNKNOWN exact figure |
| Hardware (RFID cards for Customer Club, MikroTik router for WiFi) | Required, cost not disclosed in snippets | `smartx.ir/other-expenses/`, via WebSearch, 2026-09-04 — UNKNOWN exact figure |
| SMS messaging | Billed separately/pay-as-you-go, purchased in-panel | `smartx.ir/pricing/`, via WebSearch, 2026-09-04 |
| Setup/onboarding timeline | 7–14 days for install, 1–4 weeks for full service delivery (as paraphrased by search) | `smartx.ir/faq/`, via WebSearch, 2026-09-04 |

**Who pays:** the restaurant/café operator, not the diner — this is 100% B2B SaaS
revenue, sold per-product (a restaurant could buy just Reservation, just the Club, or
stack multiple lines), consistent with an upsell motion riding on top of Sepidz's/
Vendo's/Sepidar's existing POS install base.

**Reliability signal (first-party, not a review):** the site itself carries an apology
page, `smartx.ir/sorry/`, titled **"اختلالات باشگاه مشتریان | مرداد ماه 1404"**
("Customer Club disruptions — Mordad 1404," i.e., roughly late July–August 2025),
paraphrased by search as acknowledging the Customer Club product had outages and
promising "three new free features this week" as compensation. This sits alongside two
retention-campaign pages, `smartx.ir/stay-strong/` and `smartx.ir/stay-strong-2/`
("کمپین قوی بمان" / "کمپین قوی بمان 2," Tir 1404 = June/July 2025), one of which search
paraphrased as covering "no service interruptions" for a mid-June–end-of-July 2025
window and introducing a move to quarterly renewal terms. Read together, this looks
like: a reliability incident in mid-2025 → an explicit customer-facing apology →
back-to-back retention campaigns to fight churn. This is the single most concrete,
dated, first-party signal of a real operational weak point I found — but it is
**SmartX's own words about itself**, not an independent user review, and I never read
the raw page text (WebFetch blocked), so treat the specific wording above as a
paraphrase, not a quote. REAL (self-admitted), evidenced by page *existence and title*
being independently returned across three separate search queries.
Sources: `smartx.ir/sorry/`, `smartx.ir/stay-strong/`, `smartx.ir/stay-strong-2/` —
all via WebSearch, 2026-09-04.

## Feature inventory

| Feature | Status (REAL/CLAIMED/UNKNOWN) | Evidence |
|---|---|---|
| Cloud-based reservation/table-booking management for staff | CLAIMED | `smartx.ir/services/reserve/restaurant/`, WebSearch 2026-09-04 |
| Online booking portal for diners (date/party size/table/dish selection) | CLAIMED | `smartx.ir/services/reserve/restaurant/`, WebSearch 2026-09-04 |
| POS/checkout integration, automated "reservation to exit" flow | CLAIMED | `smartx.ir/services/reserve/`, `smartx.ir/services/club/`, WebSearch 2026-09-04 |
| Online prepayment/deposit for reservations | CLAIMED | `smartx.ir/services/reserve/restaurant/`, `smartx.ir/pricing/`, WebSearch 2026-09-04 |
| Waitlist / filtered "smart list" of incoming requests | CLAIMED | `smartx.ir/services/reserve/`, WebSearch 2026-09-04 |
| Loyalty club: RFM-style customer segmentation, coupons, gamified "wheel of fortune" | CLAIMED | `smartx.ir/services/club/`, `smartx.ir/services/club/restaurant/`, WebSearch 2026-09-04 |
| Multi-branch quality-control reporting | CLAIMED | `smartx.ir/services/club/restaurant/`, WebSearch 2026-09-04 |
| Smart WiFi: SMS-OTP captive-portal login capturing phone numbers for marketing | CLAIMED | `smartx.ir/services/wifi/restaurant/`, `smartx.ir/faq/`, WebSearch 2026-09-04 |
| Automated CSAT/evaluation surveys post-visit | CLAIMED | `smartx.ir/services/evaluation/restaurant/`, WebSearch 2026-09-04 |
| Staff/manager companion mobile app (Android, Myket) | REAL — listing exists and is gated to existing account holders | `myket.ir/app/com.smartx`, WebSearch 2026-09-04 |
| Public consumer-facing app on Cafe Bazaar | UNKNOWN — not found in any search; only a same-named, unrelated smartwatch app ("SMARTx") appears on Cafe Bazaar | search queries, 2026-09-04 |
| Independent third-party review-platform presence (G2/Capterra/Trustpilot-equivalent) | REAL (absence) — no listing found anywhere | search queries, 2026-09-04 |
| Independent Persian tech-press coverage (Zoomit/Digiato) | REAL (near-total absence) — the only "media" hit found (`zoomg.ir/pr/363521-smartx-advertisment/`) has "advertisment" literally in its URL slug, i.e., it is a **paid placement**, not editorial coverage | WebSearch, 2026-09-04 |
| Official social presence (Instagram `@smartx_acc`) | REAL (account exists) — content/engagement level UNKNOWN, not fetchable | WebSearch, 2026-09-04 |
| Reliability track record | see "Reliability signal" above — REAL (self-admitted mid-2025 disruption) | `smartx.ir/sorry/` etc., WebSearch 2026-09-04 |

## Review synthesis

**Honest result: I found zero independent, verifiable, verbatim reviews — from diners
or from restaurant owners/staff — anywhere.** Specifically, I looked for and did not
find:
- A SmartX listing on Cafe Bazaar (only an unrelated same-named smartwatch app exists
  there).
- Any readable review text under the Myket listing (`myket.ir/app/com.smartx`) — the
  listing exists, but WebFetch could not open it and WebSearch's snippets did not
  surface individual review text or a rating/install count.
- Any forum threads, Telegram channel discussions, Twitter/X posts, Quera/Pursaan-style
  Q&A posts, or restaurant-owner community commentary mentioning SmartX by name (tried
  multiple phrasings in Persian: "نظرات," "شکایت," "تجربه من," "مشکل," "پشتیبانی").
- Any B2B software review site listing (G2, Capterra) — expected, since Iran-only SaaS
  is generally absent from those due to payment/sanctions isolation, but confirmed
  absent rather than assumed.

Per the task's ground rule to never fabricate quotes, **I am not filling in the
"top 5 complaints / top 5 praises" template with invented content.** The closest thing
to real, dated, sourced signal I found is the self-reported Customer Club service
disruption (`smartx.ir/sorry/`, Mordad 1404 / Aug 2025) and the two "Stay Strong"
retention campaigns that bracket it (`smartx.ir/stay-strong/`, `smartx.ir/stay-strong-2/`,
Tir 1404 / June–July 2025) — documented above under "Business model & pricing" rather
than force-fit into a complaints table, because it is first-party, not a review.

### Top 5 complaints
UNKNOWN — not verified. No independent reviews found (see above). The only concrete,
dated negative signal is SmartX's own admitted service disruption, documented in the
"Business model & pricing" section above rather than listed here as a "complaint,"
since it is not user-generated content and I have no verbatim user-authored quote to
attach to it.

### Top 5 praises
UNKNOWN — not verified. No independent reviews found. SmartX's site names Sepidz as a
long-standing reseller/partner and implies an install base large enough to justify four
separate annual-subscription product lines and a dedicated 10–50-person team, which is
circumstantial evidence the product has *some* satisfied, paying, renewing customers —
but that is an inference from business survival, not a verified praise quote, and I'm
labeling it as such rather than dressing it up as a review finding.

## Gen-Z lens scorecard

SmartX has almost no direct, brand-visible surface toward a young diner — its consumer
touchpoints are all white-labeled through the restaurant (a booking widget, a WiFi
login screen, an SMS). That makes most of this scorecard genuinely unanswerable from
outside; I'm marking each item honestly rather than guessing from the B2B marketing
copy, which is written for restaurant owners, not diners.

1. **Time to first value** — UNKNOWN — not verified. No live SmartX-powered booking
   flow or WiFi login was found/tested to time.
2. **Money respect** — Partially evidenced, but for the *restaurant owner* as customer,
   not the diner: pricing is opaque up front (no self-serve price list without contact/
   consultation for several line items — "برای کسب اطلاعات بیشتر... اطلاعات تماس خود را
   وارد کنید"), annual lock-in contracts (21.4M–67M+ Toman/year per product line,
   stackable across 4 products), plus separately billed SMS, hardware, and payment-
   gateway fees layered on top of the headline price. That's a classic enterprise-SaaS
   pattern (annual contract + hidden line items) rather than a transparent, Gen-Z-style
   "see the price before you commit" model — CLAIMED/inferred from the pricing page
   structure itself, not from a complaint. For the diner's money respect (e.g., is a
   reservation deposit refund policy clear?) — UNKNOWN, not verified.
3. **Does it feel like now** — UNKNOWN — not verified. No screenshots, demo video, or
   live instance were reachable to assess UI modernity.
4. **Shareability** — UNKNOWN — not verified. No evidence of any share/referral/social
   mechanic in either direction (restaurant-to-restaurant or diner-to-diner).
5. **Trust** — Mixed signal, CLAIMED + one REAL data point: (a) the WiFi product's core
   mechanic is mandatory SMS-OTP phone-number capture at login, explicitly for building
   a marketing database — a bargain (free WiFi for phone number + future marketing
   messages) that a privacy-conscious younger user might resent, though I found no
   actual user complaint about this, only the product's own description of the
   mechanic; (b) the one dated, verifiable trust signal is negative-then-recovering:
   a real service disruption (Mordad 1404) followed by a public apology and retention
   campaign — a company that had to run two consecutive "please don't churn" campaigns
   in the same season it apologized for downtime is a real (if narrow) trust wobble,
   not a rumor.
6. **Notification behavior** — CLAIMED only: the product explicitly markets SMS-based
   "marketing" messaging as a core loyalty-club feature (billed to the restaurant per
   message) — this is push-style, restaurant-initiated marketing SMS, not
   diner-controlled notification preferences as far as any snippet showed. Whether
   diners can opt out, or how often restaurants actually blast them, is UNKNOWN — not
   verified.
7. **What to steal / what to never copy** — Based only on what's verified above:
   **steal** — the "reservation-to-exit" automated POS handoff idea (reduces staff
   double-entry) and the bundled CSAT/evaluation survey tied directly to a completed
   visit (not a generic app-store review ask) both sound like genuinely useful
   mechanics, though I only have marketing-copy confirmation, not a working demo.
   **Never copy** — the pattern of a public apology page followed immediately by two
   consecutive "please don't churn" retention campaigns suggests reliability
   incidents big enough to threaten renewals; and the "contact us for pricing" opacity
   on several product tiers is the opposite of the transparent, no-surprises pricing a
   younger, price-sensitive audience expects. Both are inferences from what is publicly
   visible, not from an internal SmartX post-mortem I have access to.

## Where it beats Rezervno today
UNKNOWN — not verified (out of scope for this research pass; requires repo-side
verification by the CEO).

## Where Rezervno beats it
UNKNOWN — not verified (out of scope for this research pass; requires repo-side
verification by the CEO).

## Sources
All accessed 2026-09-04, via the WebSearch tool only (WebFetch was non-functional for
the entire session — see caveat at top of document). Listed URLs are the pages
WebSearch's synthesis was built from, not pages I opened directly:

- https://smartx.ir/ (homepage)
- https://smartx.ir/services/ (product overview)
- https://smartx.ir/services/reserve/ and https://smartx.ir/services/reserve/restaurant/ (reservation product)
- https://smartx.ir/services/club/ and https://smartx.ir/services/club/restaurant/ (loyalty club)
- https://smartx.ir/services/wifi/ and https://smartx.ir/services/wifi/restaurant/ (smart WiFi)
- https://smartx.ir/services/evaluation/ and https://smartx.ir/services/evaluation/restaurant/ (CSAT/evaluation)
- https://smartx.ir/pricing/ (pricing)
- https://smartx.ir/other-expenses/ (extra/hardware fees)
- https://smartx.ir/faq/ (FAQ / onboarding timelines)
- https://smartx.ir/customers/ (customers page — could not extract actual brand list)
- https://smartx.ir/about-us/ (company history)
- https://smartx.ir/our-philosophy/ (mission/philosophy)
- https://smartx.ir/key-partners/ (Sepidz, Sepidar Sistem, Vendo, Hamkaran Sistem ties)
- https://smartx.ir/app/ and https://myket.ir/app/com.smartx (companion app listing)
- https://smartx.ir/customer-services/ and https://smartx.ir/contact/ (support channels)
- https://smartx.ir/sorry/ ("Customer Club disruptions, Mordad 1404" apology page)
- https://smartx.ir/stay-strong/ and https://smartx.ir/stay-strong-2/ (retention campaigns, Tir 1404)
- https://sepidz.com/software/smart-x/ and https://sepidz.com/ (reseller/partner corroboration)
- https://karboom.io/companies/اسمارت-ایکس-wjxxjx/overview (company size: 10–50 employees, "دانش‌بنیان")
- https://jobvision.ir/companies/35460/استخدام-اسمارت-ایکس and https://jobinja.ir/companies/smartx/jobs (hiring pages, corporate description)
- https://www.instagram.com/smartx_acc/ (official Instagram — existence only, content unread)
- https://ir.linkedin.com/company/smartxacc (LinkedIn — possible second "SmartX Accelerator" entity, unresolved; see Identity check)
- https://www.zoomg.ir/pr/363521-smartx-advertisment/ (only "media" hit — confirmed paid placement by its own URL slug)
- Collision-disambiguation sources: https://www.milagrocorp.com/ (Milagro/SmartX feedback module, USA), https://smartxadvisory.com/ (SMArtX Advisory Solutions, US fintech), https://www.smartxglobal.com/, https://www.smartxtraders.com/, https://smartx.io/ (crypto/trading platforms), https://www.linkedin.com/company/smartx-technology-inc (RFID/robotics)

## What I did NOT verify

- **No page was ever opened directly.** WebFetch failed for every domain, including
  non-Iranian control domains, for this entire session. Everything sourced to
  `smartx.ir` is a WebSearch-tool synthesis of indexed snippets, not a first-hand read.
  Exact wording of any claim, pricing figure, or the apology-page text should be
  treated as "very likely accurate given repeated independent corroboration across
  queries" rather than "confirmed verbatim."
- **No diner or restaurant-owner review was found or read**, on Cafe Bazaar, Myket,
  social media, forums, or anywhere else — the entire "Review synthesis" section is
  built on absence-of-evidence, honestly reported rather than papered over.
- **Rating/install counts for the Myket app listing** were not obtainable — the listing
  exists but its numbers were not surfaced by search.
- **Actual current WiFi pricing** could not be reconciled — two different figures/tiers
  surfaced from the same claimed source page and I could not resolve which is current.
- **The "SmartX Accelerator" LinkedIn/Jobinja thread** (see Identity check, collision
  #6) was not resolved — I cannot say with certainty whether it's the same corporate
  entity or a separate but brand-adjacent initiative.
- **Whether SmartX has ever been covered by Zoomit, Digiato, or any other independent
  Persian tech outlet** — none found; the single "media" hit found is a confirmed paid
  placement (zoomg.ir), not editorial coverage, but absence of coverage is not proof
  none exists — only that none surfaced in the queries tried.
- **The exact list of restaurant/café brand names using SmartX** (its own `/customers/`
  page) was not extractable from search snippets.
- **Hardware costs** (RFID cards, MikroTik router) and **payment-gateway setup/
  per-transaction fees** were referenced as existing but no Toman figures were found.
- **"Where it beats Rezervno" / "Where Rezervno beats it"** — explicitly out of scope
  for this pass per the task brief; needs repo-side verification.
