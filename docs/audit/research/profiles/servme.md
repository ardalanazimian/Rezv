# Servme — Competitor Profile
_Last updated: 2026-09-04 by Scout_

> **Methodology note (read first):** `WebFetch` was tested this pass against a neutral control
> domain (`example.com`) and three real target domains (`servme.io`, `www.trustpilot.com`,
> `apps.apple.com`) — all four returned `EGRESS_BLOCKED`. This confirms the same environment-wide
> egress restriction found in the prior research batch (see `profiles/fidilio.md` and
> `profiles/opentable-resy-sevenrooms.md`'s methodology notes), not a site-specific block, and not
> something that changed in this session. Everything below is `WebSearch`'s own synthesis of what it
> read at the cited URLs, not an independent re-fetch by me. Quotation marks are used only where
> `WebSearch`'s output itself returned text in quotation marks; everything else is paraphrase.

## What it is

Servme (styled "serVme" in some of its own materials) is a Dubai-based guest-experience/CRM +
reservations platform for restaurants, hotel F&B outlets, and hospitality/entertainment venues,
founded in **2017** by **Sarah Hawilo** (Founder/CEO, previously a Senior Research Consultant at
Booz & Company) and **Karl Atiyeh** (Co-founder/COO, previously an investment-banking associate at
The National Investor, INSEAD-educated). [WebSearch synthesis of crunchbase.com/organization/servme,
crunchbase.com/person/sarah-hawilo, crunchbase.com/person/karl-atiyeh, getlatka.com/companies/servmeco.com,
accessed 2026-09-04]

**Domain correction from the task brief:** the brief named `servme.io` as a domain to verify. I could
not find `servme.io` cited anywhere across dozens of search results this pass. Every single source —
Capterra, G2, Software Advice, GetApp, SourceForge, Crunchbase, PitchBook, Getlatka, the company's own
blog and pricing/comparison pages — consistently cites **`servmeco.com`** as Servme's real domain.
Treat `servmeco.com` as the verified domain and `servme.io` as most likely a stale or mistaken
reference in the brief, not a real Servme property (I did not find it registered to anyone in
particular — it simply never appeared in results). [WebSearch synthesis across all cited sources
below, accessed 2026-09-04]

**Founding-year discrepancy (unresolved, flagging not reconciling):** Getlatka states 2017 and this
matches the task brief; a separate WebSearch synthesis pass surfaced "2015" from an unspecified
source in the same result set. 2017 is the better-supported figure (Getlatka, Crunchbase-adjacent
sources, and the brief all converge on it) but I did not find the 2015 claim's origin to rule it out.

**Structural fact worth stating up front, and returned to below:** like SevenRooms (see
`profiles/opentable-resy-sevenrooms.md` §SevenRooms), Servme is **B2B infrastructure, not a consumer
discovery marketplace**. There is no Servme-branded app for diners to browse restaurants in. The only
consumer-facing app store listings found ("Servme," Apple App Store id `1062818070`; "serVme Manager,"
Google Play `com.servmevenue.prod`) are **staff/operator-facing** tools (iPad-first floor/table
management), not diner apps. Guests interact with Servme only indirectly — through a restaurant's own
booking widget, WhatsApp, phone, or third-party discovery channels (TripAdvisor, Zomato, Facebook,
Instagram, the Michelin Guide, or — in the Hyatt Regency Dubai case study below — the hotel's own
`Hyattrestaurants.com` site). [WebSearch synthesis of play.google.com/store/apps/details?id=com.servmevenue.prod,
apps.apple.com/us/app/servme/id1062818070, servmeco.com/resources/restaurant-ecosystem, accessed 2026-09-04]

## Who it's for

- **Restaurant, hotel F&B, and hospitality/entertainment-venue operators** in MENA (and, per the
  company's own claim, "beyond" — named non-MENA reference points include New York, India, and the
  UK) who need reservations + table/floor management + guest CRM + marketing automation in one
  subscription, without a consumer-marketplace fee model attached.
- Not aimed at solo/very small operators as a low-cost entry point — one third-party pricing-analysis
  source ("PricingNow," see below) characterizes the total cost of ownership as comparatively high for
  what it calls "very small businesses" that don't need the full CRM/marketing feature set, even
  though Servme's own marketing targets small hospitality businesses (HotelTechReport-style reviewer
  demographics cited "64% of reviewers from small companies").

## Business model & pricing

- **Three subscription tiers**, published on Servme's own pricing page — **flat monthly SaaS
  pricing, no commission on bookings, no per-cover fee, no setup cost claimed.** Two independent
  aggregator sources gave slightly different tier names/prices: one cited **Starter/Essentials/Advanced
  at $129/$199/$299 per month**; another (the pricing page's own headline, echoed by multiple
  aggregators) simply says pricing "starts as low as $129/mo" and "can reach $300/mo." These are
  consistent with each other (same $129–$299/$300 range) even where exact tier *names* differ across
  sources — treat $129–$299/mo as the reliable range, tier-naming as lower-confidence.
  [WebSearch synthesis of servmeco.com/pricing/, pricingnow.com/question/servme-pricing/,
  softwarefinder.com/crm/servme, accessed 2026-09-04]
- **One aggregator (subscribed.fyi, via G2 syndication) stated "$129.00 per year"** rather than per
  month for the Starter tier — this conflicts with every other source (including Servme's own pricing
  page headline, "Starting as low as USD 129 Per Month") and reads like an aggregator error, not a
  real annual-only SKU. **Flagging, not resolving** — do not cite the per-year figure externally
  without checking `servmeco.com/pricing/` directly.
- **No hidden setup/migration fee, per Servme's own claim** — a third-party TCO analysis
  (PricingNow) corroborates this for the mid/upper tiers ("setup and data migration are included in
  the Essentials plan") while flagging that the *Starter* tier might not include free setup for
  "custom integrations or specialized training" — a nuance Servme's own headline claim ("no hidden
  fees or setup charges") does not surface. **CLAIMED (Servme's own marketing) with a partial,
  lower-confidence independent caveat (PricingNow's TCO analysis).**
- **Scale claims — a discrepancy pattern, same shape as Fidilio's 4.9-vs-3.7 rating discrepancy in
  that profile:** Servme's own pricing/marketing pages say **"3,000+"** restaurants/hotels/hospitality
  groups; a separate search of Servme's LinkedIn company description returned **"2,500+ operators."**
  Both are Servme's own claims (CLAIMED, not independently audited), just from two different
  Servme-controlled surfaces that disagree with each other. UNKNOWN which is current.
- **Revenue/valuation (third-party estimate, not Servme's own disclosure):** Getlatka estimates
  Servme's 2025 revenue at **$4.6M ARR**, a **$13.9M valuation**, and **42 employees**, and
  characterizes the company as having "grown to $4.6M in revenue without raising any venture capital
  or outside funding." **This directly conflicts** with a separate WebSearch result citing Crunchbase
  as listing four named investors — **Altur Investissement, IM Fndng, Phoenician VC, and B&Y Venture
  Partners** — as having invested in Servme. I could not reconcile these two claims (one says
  bootstrapped/no VC, the other names four VC-style investors) and am flagging the direct
  contradiction rather than picking a side. **UNKNOWN — not verified** which is accurate; both
  Getlatka's revenue/employee figures and Crunchbase's investor list are third-party
  estimates/aggregations, not a Servme press release or filing.
  [WebSearch synthesis of getlatka.com/companies/servmeco.com, crunchbase.com/organization/servme,
  accessed 2026-09-04]
- **Region-specific payment integrations, named:** MyFatoorah (added 2024, per Servme's own "2024 Year
  in Review" blog post — lets GCC F&B operators collect online reservation deposits/prepayments,
  auto-logged into the CRM); the company's broader payment-gateway messaging also references
  "regional payment gateways" generically without always naming which ones. Related (not Servme's own
  product, but the regional payment-rail context the brief asked about): commonly cited GCC payment
  gateways in this space include Moyasar (Saudi, SAMA-licensed, flat 2.5%/transaction), PayTabs
  (Gulf-built, SAMA-licensed, mada/e-wallet/BNPL support), and Tap Payments (UAE-card + Apple/Google
  Pay, AED settlement) — **these are not confirmed as Servme's specific integration partners**, only
  as the kind of GCC-specific rail this product category commonly relies on; MyFatoorah is the one
  integration Servme's own blog explicitly names.

## Feature inventory (REAL / CLAIMED / UNKNOWN)

| Feature | Status | Note |
|---|---|---|
| Reservation, waitlist, table/floor management | REAL | Core product; consistent across all sourcing |
| Guest CRM with auto-tagging (VIP, Weekend Regular, "Sushi Lover," Ramadan/Iftar tags) | REAL | Confirmed via Servme's own product pages + independently corroborated by the Hyatt Regency Dubai case study (below) |
| Marketing automation (targeted email/SMS/WhatsApp campaigns) | REAL | Confirmed; SMS specifically drew a real cost complaint (see Review synthesis) |
| WhatsApp Business messaging (confirmations, reminders, cancellations, payment links, review requests) | REAL | Feature confirmed live via Servme's own blog, dated **2024-08-16** ("WhatsApp Messaging Is Live on Servme!") — not a brand-new 2026 feature, in production for ~2 years as of this pass |
| "Built for MENA from day one" positioning (native WhatsApp, Arabic interface, regional payment gateways, local-holiday operations) vs. "global platforms add MENA features" | CLAIMED (marketing) | Servme's own explicit competitive-positioning language, used across its `compare-us/` pages (TableCheck, Eat App, SevenRooms, OpenTable, Resy/Tock comparisons) |
| POS/PMS integrations (20+: Foodics, Oracle/Micros, Infrasys, Syrve, Revel, Omega, Aloha/NCR Aloha, Dinerware, LINGA, Lavu, Maitre'D, PAR, Simphony) | REAL | Independently corroborated by Foodics' own help-center docs describing the two-way reservation/table-move sync, not just Servme's own claim |
| Direct hotel-website booking integration (e.g. Hyattrestaurants.com) | REAL | Corroborated by the Hyatt Regency Dubai case study |
| Booking-channel integrations (TripAdvisor, Zomato, Facebook, Instagram, Michelin Guide, Webook, The Chefz — the latter two added 2024) | REAL | Named specifically in Servme's own "2024 Year in Review" post |
| Consumer-facing discovery app/marketplace of Servme's own | **DOES NOT EXIST** | Same structural gap as SevenRooms — confirmed by the absence of any diner-facing Servme app in Apple/Google Play search results (only staff/operator apps found) |
| Public, self-serve restaurant pricing (no "contact us" wall) | REAL | Genuine differentiator vs. SevenRooms, which does not publish pricing at all (`profiles/opentable-resy-sevenrooms.md` §SevenRooms) |
| No commission/per-cover fee (flat SaaS) | REAL | Consistent across every pricing source found; same family as Eat App/Zenchef/SevenRooms/Resy, opposite of OpenTable/Quandoo/TheFork/Chope |
| Deposit/prepayment collection to reduce no-shows (MyFatoorah integration) | REAL | Confirmed via Servme's own 2024 product-release post |
| Offline mode (for internet-instability resilience) | UNKNOWN — CLAIMED intent only | Surfaced only as the company's stated response to a reviewer's glitch complaint (see Review synthesis); no independent confirmation it shipped |
| "Best of" Gartner Digital Markets badges (Capterra/GetApp/Software Advice) | REAL | These badges are awarded based on aggregated verified-review data on Gartner's own Digital Markets properties, so the badge itself is a real (if self-reported-adjacent) recognition — not independently audited beyond that |

## Review synthesis — what I could actually find

**Honesty check up front, same discipline as `profiles/fidilio.md`:** the *total* independently
findable review volume for Servme across all platforms this pass was **G2: 2 reviews (4.8/5)** and
**Capterra: 25 reviews (4.8/5)** — a small combined sample (27) for a company claiming 2,500–3,000+
customers. I searched specifically and repeatedly for 1-star/2-star and App Store reviews and could
**not** surface any negative-leaning quoted text beyond the items below — this is a genuine gap in
what I could find, not evidence the reviews don't exist. I also searched `site:trustpilot.com servme`
directly and found **no Servme listing on Trustpilot at all** — only unrelated companies with similar
names ("ServMask," "Servmedia"). Whether Servme simply has no Trustpilot presence, or has one my
search didn't surface, is **UNKNOWN — not verified**.

### Complaints found (paraphrased unless quoted)
1. **SMS cost.** At least one reviewer complained the SMS cost was high (paraphrase: "the cost
   especially the SMS prices needs to be considered"). Servme's own response, surfaced in the same
   search: *"the contributing factor is the surging prices of SMS providers and regulators"* and that
   Servme "simply integrate[s] our platform with SMS providers and the rates are provided from their
   side" — the company suggested WhatsApp integration as a cheaper channel and noted email
   notifications are unlimited/free. This is a genuinely relevant data point for Rezervno, whose own
   SMS provider is Melipayamak under a similar pass-through cost model (`CLAUDE.md` §پیامک و پول) —
   the complaint pattern ("SMS costs money, WhatsApp/email don't") is one Rezervno should expect too
   if it ever exposes per-message SMS cost to restaurant customers directly.
2. **Occasional app glitching**, attributed by at least one reviewer to unstable internet connection
   rather than the software itself; Servme's team reportedly responded that they would work on an
   offline mode (unconfirmed whether shipped).
3. **A specific, since-resolved bug:** at least one multi-level restaurant had to pause online
   reservations because guests couldn't specify which floor/area they wanted to book — reported as
   fixed in a later update.
4. **Learning curve on specific modules:** the marketing tool and shift-editing feature were described
   by at least one reviewer as "a little complicated," needing guidance to learn.

### Praise found (quoted where marked)
1. *"Servme is easy to use, reliable, and extremely effective in helping us stay organized. It allows
   us to better understand our guests, optimize our operations, and improve the overall service we
   provide."* (Software Advice/Capterra, via WebSearch synthesis)
2. *"One of the aspects we value most is the excellent customer support — always fast,
   professional..."* (same source)
3. *"Its a good software to keep all data and also we can check all the revenue reports from here
   only"* (GetApp, via WebSearch synthesis)
4. Support response speed reported (via G2 synthesis) as replying to queries in 1–2 minutes.
5. New team members reportedly "adapt to it quickly"; ease of floorplan/capacity management praised
   as a distinct theme across multiple reviewer snippets.

### Case study (the deepest single piece of independently-corroborated evidence found)
**Hyatt Regency Dubai** has used Servme for **three years** across its restaurants (named:
**Al Dawaar Revolving Restaurant** and **Miyako**); Al Dawaar gets **1,500–2,000 reservations/month**;
the hotel's team uses Servme's email marketing to reach loyal guests, corporate clients, and groups
(up to 10 people); Servme integrates directly with `Hyattrestaurants.com` for guest-facing booking; and
the case study's headline claim is **88,000 guest profiles** accumulated for retention purposes.
[WebSearch synthesis of servmeco.com/blog/hyatt-regency-dubai-venues-boost-retention-with-88000-guest-profiles-using-servme/,
accessed 2026-09-04 — this is Servme's own published case study, not an independently-verified
third-party account, so treat the "88,000 profiles" and reservation-volume figures as **CLAIMED by
Servme with a named, checkable customer** rather than independently audited]

## Gen-Z lens — the 7 questions, evidenced

_Same 7-question framework defined in `profiles/opentable-resy-sevenrooms.md`'s methodology note
(reused verbatim per the task's instruction, not reinvented). Same framing caveat as that document's
SevenRooms section applies here: Servme is B2B infrastructure — the Gen-Z lens applies one remove, via
whatever guest experience the **restaurant** builds on top of Servme, not a Servme-branded touchpoint._

1. **Zero-friction entry** — Arguably the most frictionless of any platform profiled in this recon so
   far, structurally identical to SevenRooms: a guest never needs to know "Servme" exists, and can book
   via the restaurant's own site, WhatsApp, phone, Instagram/Facebook, TripAdvisor/Zomato, or (per the
   Hyatt case study) the hotel's own branded site. REAL structural fact.
2. **Mobile-native & fast** — **N/A as a distinct consumer app** (none exists — see "What it is").
   For the *staff*-facing app, reviewer sentiment is positive but the sample is tiny (2 G2 + 25
   Capterra reviews total) — not enough to responsibly call this REAL at scale, more like
   **CLAIMED-leaning-positive on thin evidence.**
3. **Transparent, surprise-free pricing** — **REAL and a genuine differentiator.** Unlike
   SevenRooms (pricing not published at all) or OpenTable (published but layered with per-cover +
   2% service fees), Servme publishes a simple 3-tier, flat, no-commission price list on its own
   site. On the *diner* side, because Servme takes no per-booking cut, there's no Servme-driven
   no-show-fee culture of the kind found at OpenTable ($25–50/person) or Resy (up to $100/person,
   called "obscene" by a reviewer) — though whether individual restaurants running on Servme choose to
   charge their *own* no-show/deposit fees via the MyFatoorah integration is **UNKNOWN — not
   verified**, and would be the more relevant diner-facing question.
4. **Social currency / shareability** — **Weak/N/A**, same gap as SevenRooms: no consumer-facing
   Servme brand to "flex," and no evidence found of a distinct social/shareability mechanic beyond
   generic Instagram/Facebook booking-button integrations (a feature category, not a differentiator).
5. **Personalization that feels earned, not creepy** — **This is Servme's central pitch, and the
   best-evidenced claim in this profile.** REAL: guest-profile auto-tagging (VIP, Weekend Regular,
   "Sushi Lover," Ramadan/Iftar-specific tags for targeted email campaigns), corroborated
   independently by the Hyatt Regency Dubai case study's 88,000-profile figure. Whether this
   personalization is experienced by the *diner* as "earned" rather than "creepy" was not addressed by
   any source found — UNKNOWN from the diner's own vantage point, only confirmed from the operator's.
6. **Fast, fair rewards loop** — **N/A at the platform level**, same gap as SevenRooms: Servme sells
   no diner-facing loyalty/points product of its own. Whatever loyalty a diner experiences depends
   entirely on what the individual restaurant chooses to build using Servme's CRM/marketing tags —
   there is no Servme-native equivalent to OpenTable Regulars or Starbucks/Chipotle-style tiers.
7. **What happens when it breaks** — Thin but directionally positive evidence for the *operator*
   (Servme's actual customer): reported fast support (1–2 minute response time per G2), and a pattern
   of the company visibly responding to specific bug reports (multi-level booking fix, stated intent
   to build an offline mode after glitch complaints). No evidence found of a large-scale, publicly
   acknowledged reliability incident of the kind found for SmartX (`smartx.ir/sorry/`, see
   `profiles/smartx.md`) — but the review sample (27 total across G2+Capterra) is too small to treat
   "no incident found" as strong evidence of genuinely high reliability rather than simply low review
   volume/visibility.

## MENA-specific positioning (the part most relevant to Rezervno's Iran context)

Servme's own marketing language draws an explicit contrast: **"We built Servme for MENA operators
from day one"** versus global platforms that merely **"add MENA features."** The concrete features
cited as evidence for this claim, per Servme's own comparison pages (`servmeco.com/compare-us/*`
against TableCheck, Eat App, SevenRooms, OpenTable, and Resy/Tock) and product pages:
- **Native WhatsApp Business messaging** (confirmations, reminders, cancellations, payment links,
  review requests) — live since **2024-08-16**, positioned as reaching guests "where they're most
  active" with higher open/response rates than SMS/email, explicitly to cut no-shows.
- **Arabic interface** (claimed; not independently tested by me this pass).
- **Regional payment gateways** — MyFatoorah confirmed by name (2024 addition, for GCC deposit/
  prepayment collection); other GCC-common gateways (Moyasar, PayTabs, Tap Payments) referenced in
  the broader regional-payment-rail context but not confirmed as Servme's specific partners.
- **Local holiday operations built in** — most concretely evidenced by Ramadan-specific CRM tagging
  (restaurants use Servme to tag Arab/Muslim guests specifically for Iftar-period email campaigns,
  per Servme's own blog) and an annual "Ramadan marketing ideas" blog series (8 ideas cited for 2026,
  covering Iftar and Sohoor).

**This is the single most transferable structural idea for Rezervno's own Iran positioning**: Servme's
pitch isn't "we have more features," it's "the region-specific communication channel (WhatsApp) and
the region-specific calendar event (Ramadan) are core product surfaces, not afterthought
localization." Iran's diner culture is also messaging-app-first (though the dominant apps differ —
WhatsApp is not reliably available/dominant inside Iran the way it is in the Gulf; Rezervno's own
CLAUDE.md conventions already center Persian-first, RTL, self-hosted-font UX as non-negotiable) and
shares Ramadan as a real seasonal demand pattern. The lesson is the *shape* of the positioning
(build the regional constraint into the core product, market it as a first-class differentiator
against "global platforms that bolt it on"), not the specific channel choice.

## Iran-market presence or explicit absence

**UNKNOWN — not verified, and I want to be precise about what that means here.** I found **no source,
positive or negative, in which Servme makes any explicit statement about serving or excluding Iran.**
Its own case studies, comparison pages, and named payment integrations are consistently UAE/GCC-
centric (Dubai HQ; Hyatt Regency **Dubai** case study; MyFatoorah and the Moyasar/PayTabs/Tap-Payments
family of gateways referenced above are all Gulf-specific rails). I did not find Iran named as either
a served market or an excluded one in any Servme marketing material, case study, or FAQ.

**A factual, non-speculative structural point, stated as the task asked (factually, not
speculatively):** the named regional payment gateways that appear in this research pass in connection
with Servme's product category (MyFatoorah, Moyasar, PayTabs, Tap Payments) are GCC-specific payment
rails; none of them are known to operate inside Iran. This reflects the broader, independently
well-documented reality that Iran sits largely outside SWIFT and most major international card-
processor networks due to US and international sanctions on Iran's banking sector — a structural fact
about payment-rail architecture in the region generally, independent of any choice Servme itself has
made or stated. I am **not** inferring that Servme has deliberately excluded Iran; I simply found no
statement either way, and the payment-rail context is a real, citable structural constraint that would
apply to Servme (or any GCC-payment-rail-dependent platform) whether or not it ever considered
entering that market.

## Where it beats Rezervno-today
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by the CEO)

## Where Rezervno beats it
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by the CEO)

## Sources
All accessed 2026-09-04, all via `WebSearch` synthesis — direct `WebFetch` was tested against
`servme.io`, `www.trustpilot.com`, and `apps.apple.com` (plus the neutral control `example.com`) and
returned `EGRESS_BLOCKED` for all four, confirming the same environment-wide restriction found in the
prior research batch. URLs are listed because they are what `WebSearch` cited as its source, not
because I opened them myself.

- https://servmeco.com/ — main site
- https://servmeco.com/pricing/ — pricing page
- https://servmeco.com/faq/
- https://servmeco.com/company/ — "About Us"
- https://www.servmeco.com/resources — blog/resources hub
- https://servmeco.com/blog/whatsapp-messaging-is-live-on-servme/ (dated 2024-08-16)
- https://www.servmeco.com/platform/whatsapp-for-restaurants
- https://www.servmeco.com/resources/servme-2024-top-product-launches — "2024 Year in Review"
- https://servmeco.com/blog/hyatt-regency-dubai-venues-boost-retention-with-88000-guest-profiles-using-servme/
- https://servmeco.com/blog/compared-sevenrooms-vs-opentable-vs-servme/ and
  https://www.servmeco.com/resources/sevenrooms-vs-opentable-vs-servme (same content, two URLs)
- https://www.servmeco.com/eatapp-vs-servme
- https://servmeco.com/compare-us/tablecheck-vs-servme/
- https://servmeco.com/blog/top-9-sevenrooms-competitors-alternatives/
- https://servmeco.com/resources/servme-best-of-badges-capterra
- https://www.servmeco.com/resources/restaurant-ecosystem
- https://help.foodics.com/hc/en-us/articles/7487571150364-serVme and
  https://www.foodics.com/portfolio/servme/
- https://www.g2.com/products/servme/reviews
- https://www.capterra.com/p/200777/serVme/ and https://www.capterra.com/p/200777/serVme/reviews/
- https://www.softwareadvice.com/retail/servme-profile/ and
  https://www.softwareadvice.com/retail/servme-profile/reviews/
- https://www.getapp.com/retail-consumer-services-software/a/servme/
- https://sourceforge.net/software/product/Servme/
- https://slashdot.org/software/p/Servme/
- https://subscribed.fyi/servme/reviews/
- https://pricingnow.com/question/servme-pricing/
- https://softwarefinder.com/crm/servme
- https://www.crunchbase.com/organization/servme,
  https://www.crunchbase.com/person/sarah-hawilo, https://www.crunchbase.com/person/karl-atiyeh
- https://getlatka.com/companies/servmeco.com
- https://pitchbook.com/profiles/company/171130-24
- https://apps.apple.com/us/app/servme/id1062818070 (and the `/ae/` regional mirror)
- https://play.google.com/store/apps/details?id=com.servmevenue.prod

## What I did NOT verify

1. **No direct page access this session.** `WebFetch` returned `EGRESS_BLOCKED` for the control
   domain and every real target domain tried. Every fact above came through `WebSearch`'s own
   summarization; I could not personally read raw HTML, review text, or app-store pages.
2. **Exact current restaurant/venue count** — Servme's own materials disagree with themselves
   ("3,000+" on the pricing page vs. "2,500+" on LinkedIn); UNKNOWN which is current.
3. **Founding/funding contradiction** — Getlatka says bootstrapped/no VC with $4.6M ARR; a separate
   Crunchbase-sourced result names four specific investors. Not reconciled.
4. **Founding year** — 2017 (best-supported, matches the task brief) vs. an unexplained "2015" that
   surfaced once without a traceable primary source.
5. **App Store (iOS) and Google Play star ratings/review counts specifically** — despite repeated,
   targeted searches, I could not surface a specific star rating or review count for either the
   "Servme" iOS app or the "serVme Manager" Android app. This is a real gap, not a finding of "no
   reviews exist."
6. **Any Trustpilot listing** — searched directly (`site:trustpilot.com servme`) and found none;
   UNKNOWN whether this means no listing exists or my search simply didn't surface it.
7. **Any 1-star/2-star review text** — despite multiple targeted searches for negative Servme
   reviews specifically, none surfaced. The complaint list above (SMS cost, glitching, a since-fixed
   multi-level-booking bug, learning curve on two modules) is genuinely everything I could find, not
   a filtered "top complaints" list — the total review sample (27 across G2+Capterra) is small.
8. **Hospitality trade press (Caterer Middle East, Hospitality News Middle East)** — searched
   directly; found the publications themselves but zero Servme-specific coverage in either. UNKNOWN
   whether Servme has ever been covered by MENA F&B trade press, or simply wasn't surfaced by search.
9. **Whether an offline mode (promised in response to a glitch complaint) actually shipped.**
10. **Whether Arabic-interface quality, VAT-compliance specifics, or the exact list of regional
    payment-gateway partners (beyond MyFatoorah, which is named) are accurate/current** — sourced only
    from Servme's own marketing language, not independently tested.
11. **Any Iran-specific statement from Servme** — none found, positive or negative; treated as
    UNKNOWN, not inferred either way (see "Iran-market presence" section above for the full reasoning).
12. **LinkedIn posts/forum commentary specifically from restaurant owners about Servme** — searched
    directly; found only Servme's own LinkedIn company posts and the same review-platform quotes
    already captured above, no independent owner commentary on LinkedIn or Reddit.
