# MATRIX — Capability Comparison
_Maintained by Scout. Last updated: 2026-09-04._

**How to read this.** Cells are `REAL` (verified working, or a recent independent source confirms
it), `CLAIMED` (marketing/self-reported only, not independently confirmed), `ABSENT` (verified not
present, or the platform is structurally incapable of it), or `UNKNOWN — not verified` (we looked and
couldn't confirm either way, or haven't looked yet). **A bare `UNKNOWN` in a Tier-2 column below
means: not yet deep-profiled — see `recon-notes-global.md` for what little was gathered.** Every
`REAL`/`CLAIMED`/`ABSENT` cell carries a footnote pointing to the evidence.

**Coverage status, honestly:**
- **Tier 1 (deep-profiled, footnoted below):** Fidilio, SmartX, OpenTable, Resy, SevenRooms, Servme.
- **Tier 2 (light recon only — pricing-page facts, mostly zero complaint data):** TheFork, Eat App,
  TableCheck, Chope, Catchtable, Quandoo (shutting down — see WATCH), Zenchef, Tabit, Toast
  Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como. See `recon-notes-global.md`.
- **Loyalty-mechanics-only (not reservation platforms):** Starbucks Rewards, Chipotle Rewards,
  SnappFood — included only in the loyalty-relevant rows below, marked N/A elsewhere. SnappFood is
  Iran's dominant food-delivery app (not a reservation competitor) profiled specifically because it
  sets Iranian diners' loyalty-app expectations — see `profiles/snappfood-loyalty.md`.
- **Rezervno-today:** cells here are marked `REAL` **only** where I have direct file:line evidence
  from this repository (schema, code, or a shipped asset) — never from a doc's *claim* that a
  feature works. Where the code exists but I did not run it live this pass, I say so in the
  footnote. **Rezervno-at-launch:** left `UNKNOWN — not verified` throughout — Scout has no launch
  roadmap document to cite; the CEO should populate this column or point Scout to one.

---

## Reservation & commercial-terms capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Servme | Tier-2 (global) | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|
| Own consumer discovery marketplace (not white-label only) | REAL¹ | ABSENT² | REAL³ | REAL³ | ABSENT⁴ | ABSENT — structurally identical gap to SevenRooms; only staff/operator apps found in store searches³⁴ | mixed — see recon | REAL⁵ | UNKNOWN |
| Public, self-serve restaurant pricing (no "contact us") | UNKNOWN — commission % undisclosed¹ | ABSENT — several tiers require a sales call⁶ | REAL — published tiers, though two conflicting figures found³ | REAL — published flat tiers³ | ABSENT — pricing not publicly posted⁷ | REAL — 3 tiers, $129–$299/mo, published on Servme's own pricing page³⁵ | mostly UNKNOWN, see recon | UNKNOWN — not checked this pass | UNKNOWN |
| No exclusivity/lock-in clause forcing single-platform use | UNKNOWN | UNKNOWN | ABSENT — April 2026 "system of record" clause draws antitrust complaint⁸ | REAL — no such clause found³ | UNKNOWN | UNKNOWN — ToS not reviewed this pass | UNKNOWN | UNKNOWN — no ToS reviewed this pass | UNKNOWN |
| Upfront fee/deposit/cancellation transparency before commit | UNKNOWN | UNKNOWN — consumer never sees SmartX pricing directly⁶ | ABSENT — no-show fees $25–50/person reported as source of "adversarial" disputes⁹ | ABSENT — no-show fees up to $100/person, called "obscene" by a reviewer¹⁰ | N/A (B2B, no diner fee) | UNKNOWN — no platform-level diner fee (flat SaaS, no per-booking cut), but MyFatoorah integration lets restaurants collect their own deposits/prepayments; whether used adversarially not verified³⁶ | mostly UNKNOWN | UNKNOWN — not verified live this pass | UNKNOWN |
| Anti-bot / anti-scalper fairness on high-demand slots | UNKNOWN | N/A | UNKNOWN¹¹ | REAL — backed real legislation (Anti-Piracy Act), reports 90% bot-no-show reduction in NY¹² — but "Resy Notify" itself still reported losing to bots¹³ | N/A | N/A — no consumer-facing demand queue of its own to scalp | UNKNOWN | UNKNOWN — not applicable at current demand levels | UNKNOWN |
| Restaurant CRM / cross-visit guest recognition ("remembered by name") | UNKNOWN | REAL (CLAIMED depth) — core pitch of "Customer Club"¹⁴ | UNKNOWN | UNKNOWN | REAL — central pitch, G2-quoted "puts all the data in the hands of the business"¹⁵ | REAL — central pitch, corroborated by a named customer case study (Hyatt Regency Dubai, 88,000 guest profiles, 3 years' use)³⁷ | mixed, see recon | UNKNOWN — not verified this pass | UNKNOWN |
| Cross-tenant / cross-brand data isolation enforced architecturally (not just claimed) | ABSENT — 2024 Snapp Food address-leak controversy, CEO called it a "technical bug"¹⁶ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | REAL — `restaurantId`/`tenantId` sourced only from auth context, never body/query, enforced in code¹⁷ | UNKNOWN |
| Self-admitted reliability incident requiring a public apology/retention campaign | UNKNOWN | REAL — "اختلالات باشگاه مشتریان، مرداد ۱۴۰۴" apology page bracketed by two "Stay Strong" retention campaigns¹⁸ | UNKNOWN | UNKNOWN | UNKNOWN (customer-service complaints exist, not a public apology page)¹⁹ | UNKNOWN — none found, but total findable review volume (27, across G2+Capterra) is too small to treat absence as proof of high reliability³⁸ | UNKNOWN | UNKNOWN — pre-launch, no incident history yet | UNKNOWN |

## Loyalty & rewards-mechanics capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Servme | SnappFood | Starbucks Rewards | Chipotle Rewards | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Native, in-house diner loyalty (points/tiers), not a 3rd-party card program | CLAIMED — "Fidilio Club," undated marketing only²⁰ | N/A (B2B; loyalty is the *restaurant's*, not SmartX's own) | REAL — "OpenTable Regulars," Oct 2025²¹ | ABSENT — no native points program; only Amex card credits²² | N/A (infrastructure only) | N/A (infrastructure only) — same structural gap as SevenRooms³⁹ | REAL — "Snapp Club," group-wide (not food-specific), 10 pts/1,000 Toman, confirmed for food orders⁴⁴ | REAL | REAL | REAL (schema-level) — `PointsLedger` model exists and is wired into the customer app²³ | UNKNOWN |
| Top tier reachable without premium spend/card | UNKNOWN | N/A | REAL — Gold at just 6 reservations/12mo, free²¹ | ABSENT — best perks require a $325–$895/yr Amex card²² | N/A | N/A | N/A — no tiers exist at all (flat pool), so "reachable" doesn't apply; see next row⁴⁵ | ABSENT — Reserve needs 2,500 Stars/yr²⁴ | UNKNOWN | UNKNOWN — no tier-threshold policy found this pass | UNKNOWN |
| Single, clearly-communicated expiry clock (not stacked) | UNKNOWN | N/A | UNKNOWN | N/A | N/A | N/A | REAL — one flat pool, fixed biannual reset (end of spring/fall), no per-tier or per-entry divergence⁴⁵ | ABSENT — Green Stars expire in 6mo, Gold/Reserve never; the asymmetry itself is the finding²⁵ | ABSENT — 3 separate clocks: points (annual purchase), redeemed rewards (60d), birthday reward (30d)²⁶ | UNKNOWN — ledger schema doesn't reveal policy; needs product decision | UNKNOWN |
| Redemption-path reliability (reward doesn't vanish at checkout) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | N/A | UNKNOWN — redemption is a manually-pasted coupon code, not an automatic checkout deduction, so the failure shape itself differs from Chipotle's; one dated (2023) discount-authenticity complaint found, not a redemption-mechanics bug⁴⁶ | UNKNOWN | ABSENT — v11.18.1 (Jul 2026) bug: reward showed applied, failed at checkout²⁷ | UNKNOWN — not tested this pass | UNKNOWN |
| Badge/status system (verifiably server-backed, not client-side) | UNKNOWN | UNKNOWN | UNKNOWN ("Gold" status exists, mechanism unconfirmed) | ABSENT (no native status tier) | N/A | ABSENT (diner-facing) — CRM auto-tags (VIP/Weekend Regular/etc.) are staff-facing operational segmentation, not a diner-visible badge/status system⁴⁰ | ABSENT — no tier/status/badge structure found despite targeted searching; a flat points pool only⁴⁵ | REAL (tier system) | UNKNOWN | REAL (schema-level) — `BadgeDefinition`/`UserBadge` models exist²⁸ | UNKNOWN |

## Trust, notification & platform-hygiene capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Servme | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|
| SMS/OTP fail-closed (no silent fallback, no fabricated success) | UNKNOWN | UNKNOWN | N/A | N/A | N/A | N/A — Servme's SMS use is guest notifications, not OTP auth; a real SMS-cost complaint exists but no fail-open/fail-closed evidence either way⁴¹ | REAL — missing `bodyId` is explicitly logged as an error and the send is refused, never silently faked²⁹ | UNKNOWN |
| Mandatory phone-capture as price of a "free" service, disclosed clearly | N/A | ABSENT-leaning — WiFi product's core mechanic is SMS-OTP capture "for building a marketing database," no diner complaint found but no visible opt-out described either³⁰ | N/A | N/A | N/A | N/A — Servme is a paid B2B SaaS, not a "free" consumer service | UNKNOWN — not reviewed this pass | UNKNOWN |
| RTL + Persian-first UX with self-hosted fonts (no Google Fonts dependency) | UNKNOWN | UNKNOWN | N/A (not an Iran product) | N/A | N/A | CLAIMED — Arabic interface claimed (Arabic is RTL, but this is not Persian, and not independently tested)⁴² | REAL — `shared/fonts/vazirmatn-variable.woff2` shipped in-repo³¹ | UNKNOWN |
| Independent, third-party-reviewable footprint (App Store/Play/G2/Trustpilot presence) | REAL — 3.7/5, 578 ratings on Cafe Bazaar³² | ABSENT — zero independent review-platform presence found anywhere³³ | REAL — 4.65/5, ~190K Google Play ratings³ | REAL — 4.9/5, ~15.7K Google Play ratings³ | REAL — 4.7/5, 53 G2 reviews¹⁹ | REAL but thin — G2 4.8/5 (2 reviews), Capterra 4.8/5 (25 reviews); no Trustpilot listing found⁴³ | UNKNOWN — pre-launch | UNKNOWN |

---

## Footnotes

1. `profiles/fidilio.md` §"Business model & pricing" — commission exists, rate undisclosed.
2. `profiles/smartx.md` §"Who it's for" — diners never touch a SmartX-branded surface directly.
3. `profiles/opentable-resy-sevenrooms.md` §OpenTable/§Resy, "What it is" + pricing sections.
4. `profiles/opentable-resy-sevenrooms.md` §SevenRooms, "Feature inventory" row "Consumer-facing discovery app/marketplace — DOES NOT EXIST."
5. `apps/customer/` is Rezervno's own consumer PWA (structural/code fact); live adoption/traffic UNKNOWN.
6. `profiles/smartx.md` §"Business model & pricing" — several line items require "contact us."
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
17. `api/src/lib/with-restaurant-auth.ts:43,180` — `ctx.restaurant.id` / `auth.tenantId` sourced from auth context, not request body/query; also `CLAUDE.md` project convention. Architecture-level evidence only — no live penetration test run this pass.
18. `profiles/smartx.md` §"Business model & pricing," "Reliability signal."
19. `profiles/opentable-resy-sevenrooms.md` §SevenRooms, review synthesis complaint #3.
20. `profiles/fidilio.md` §"Feature inventory," Fidilio Club row.
21. `profiles/opentable-resy-sevenrooms.md` §OpenTable, "Diner-facing loyalty."
22. `profiles/opentable-resy-sevenrooms.md` §Resy, "Amex Global Dining Access" + Feature inventory row "Native Resy diner loyalty/points program — NOT FOUND."
23. `api/prisma/schema.prisma:664` (`PointsLedger` model) + `apps/customer/js/features/loyalty.js` (exists, not live-tested this pass).
24. `recon-notes-global.md` §Starbucks Rewards, tier thresholds.
25. `recon-notes-global.md` §Starbucks Rewards, "Star expiry — the key tier-asymmetry finding."
26. `recon-notes-global.md` §Chipotle Rewards, "A second, separate expiry clock."
27. `recon-notes-global.md` §Chipotle Rewards, "Breakage" — v11.18.1 bug, reported-but-unverified exact rating-drop figures.
28. `api/prisma/schema.prisma:2087,2101` (`BadgeDefinition`, `UserBadge` models).
29. `api/src/lib/sms.ts:278-281` — missing `bodyId` is logged as an explicit error ("bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد") and the send is refused, not faked.
30. `recon-notes-global.md` — actually `profiles/smartx.md` §"Gen-Z lens," item 5 (Trust).
31. `shared/fonts/vazirmatn-variable.woff2` + `shared/fonts/README.md` — file present in repo.
32. `profiles/fidilio.md` §"Feature inventory," Android app row.
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

## What's missing from this matrix (be honest about it, don't silently drop it)

- **Every remaining Tier-2 competitor** (TheFork, Eat App, TableCheck, Chope, Catchtable, Quandoo,
  Zenchef, Tabit, Toast Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como) is not yet a full
  column here because `recon-notes-global.md` only has pricing-page-level facts for them, no
  complaint/praise evidence — adding them as columns with mostly-`UNKNOWN` cells would look like
  coverage that doesn't exist yet. Servme was deep-profiled this pass (see `profiles/servme.md`) and
  has moved to Tier-1 above.
- **Rezervno-at-launch is entirely `UNKNOWN`** — Scout has no launch roadmap document. CEO: either
  share one or tell Scout where to find it, and this column gets populated next pass.
- **No live app testing was performed on any competitor** this pass (Time-to-first-value, actual
  screenshots, actual checkout flows) — everything above is web/app-store/press-sourced. A follow-up
  pass with a real phone and real accounts on Fidilio's and SmartX's apps would upgrade several
  `UNKNOWN`s to `REAL`/`ABSENT` with first-hand evidence instead of secondhand search synthesis.
