# MATRIX — Capability Comparison
_Maintained by Scout. Last updated: 2026-09-04._

**How to read this.** Cells are `REAL` (verified working, or a recent independent source confirms
it), `CLAIMED` (marketing/self-reported only, not independently confirmed), `ABSENT` (verified not
present, or the platform is structurally incapable of it), or `UNKNOWN — not verified` (we looked and
couldn't confirm either way, or haven't looked yet). **A bare `UNKNOWN` in a Tier-2 column below
means: not yet deep-profiled — see `recon-notes-global.md` for what little was gathered.** Every
`REAL`/`CLAIMED`/`ABSENT` cell carries a footnote pointing to the evidence.

**Coverage status, honestly:**
- **Tier 1 (deep-profiled, footnoted below):** Fidilio, SmartX, OpenTable, Resy, SevenRooms.
- **Tier 2 (light recon only — pricing-page facts, mostly zero complaint data):** TheFork, Eat App,
  Servme, TableCheck, Chope, Catchtable, Quandoo (shutting down — see WATCH), Zenchef, Tabit, Toast
  Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como. See `recon-notes-global.md`.
- **Loyalty-mechanics-only (not reservation platforms):** Starbucks Rewards, Chipotle Rewards —
  included only in the loyalty-relevant rows below, marked N/A elsewhere.
- **Rezervno-today:** cells here are marked `REAL` **only** where I have direct file:line evidence
  from this repository (schema, code, or a shipped asset) — never from a doc's *claim* that a
  feature works. Where the code exists but I did not run it live this pass, I say so in the
  footnote. **Rezervno-at-launch:** left `UNKNOWN — not verified` throughout — Scout has no launch
  roadmap document to cite; the CEO should populate this column or point Scout to one.

---

## Reservation & commercial-terms capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Tier-2 (global) | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|
| Own consumer discovery marketplace (not white-label only) | REAL¹ | ABSENT² | REAL³ | REAL³ | ABSENT⁴ | mixed — see recon | REAL⁵ | UNKNOWN |
| Public, self-serve restaurant pricing (no "contact us") | UNKNOWN — commission % undisclosed¹ | ABSENT — several tiers require a sales call⁶ | REAL — published tiers, though two conflicting figures found³ | REAL — published flat tiers³ | ABSENT — pricing not publicly posted⁷ | mostly UNKNOWN, see recon | UNKNOWN — not checked this pass | UNKNOWN |
| No exclusivity/lock-in clause forcing single-platform use | UNKNOWN | UNKNOWN | ABSENT — April 2026 "system of record" clause draws antitrust complaint⁸ | REAL — no such clause found³ | UNKNOWN | UNKNOWN | UNKNOWN — no ToS reviewed this pass | UNKNOWN |
| Upfront fee/deposit/cancellation transparency before commit | UNKNOWN | UNKNOWN — consumer never sees SmartX pricing directly⁶ | ABSENT — no-show fees $25–50/person reported as source of "adversarial" disputes⁹ | ABSENT — no-show fees up to $100/person, called "obscene" by a reviewer¹⁰ | N/A (B2B, no diner fee) | mostly UNKNOWN | UNKNOWN — not verified live this pass | UNKNOWN |
| Anti-bot / anti-scalper fairness on high-demand slots | UNKNOWN | N/A | UNKNOWN¹¹ | REAL — backed real legislation (Anti-Piracy Act), reports 90% bot-no-show reduction in NY¹² — but "Resy Notify" itself still reported losing to bots¹³ | N/A | UNKNOWN | UNKNOWN — not applicable at current demand levels | UNKNOWN |
| Restaurant CRM / cross-visit guest recognition ("remembered by name") | UNKNOWN | REAL (CLAIMED depth) — core pitch of "Customer Club"¹⁴ | UNKNOWN | UNKNOWN | REAL — central pitch, G2-quoted "puts all the data in the hands of the business"¹⁵ | mixed, see recon | UNKNOWN — not verified this pass | UNKNOWN |
| Cross-tenant / cross-brand data isolation enforced architecturally (not just claimed) | ABSENT — 2024 Snapp Food address-leak controversy, CEO called it a "technical bug"¹⁶ | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | REAL — `restaurantId`/`tenantId` sourced only from auth context, never body/query, enforced in code¹⁷ | UNKNOWN |
| Self-admitted reliability incident requiring a public apology/retention campaign | UNKNOWN | REAL — "اختلالات باشگاه مشتریان، مرداد ۱۴۰۴" apology page bracketed by two "Stay Strong" retention campaigns¹⁸ | UNKNOWN | UNKNOWN | UNKNOWN (customer-service complaints exist, not a public apology page)¹⁹ | UNKNOWN | UNKNOWN — pre-launch, no incident history yet | UNKNOWN |

## Loyalty & rewards-mechanics capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Starbucks Rewards | Chipotle Rewards | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|---|---|
| Native, in-house diner loyalty (points/tiers), not a 3rd-party card program | CLAIMED — "Fidilio Club," undated marketing only²⁰ | N/A (B2B; loyalty is the *restaurant's*, not SmartX's own) | REAL — "OpenTable Regulars," Oct 2025²¹ | ABSENT — no native points program; only Amex card credits²² | N/A (infrastructure only) | REAL | REAL | REAL (schema-level) — `PointsLedger` model exists and is wired into the customer app²³ | UNKNOWN |
| Top tier reachable without premium spend/card | UNKNOWN | N/A | REAL — Gold at just 6 reservations/12mo, free²¹ | ABSENT — best perks require a $325–$895/yr Amex card²² | N/A | ABSENT — Reserve needs 2,500 Stars/yr²⁴ | UNKNOWN | UNKNOWN — no tier-threshold policy found this pass | UNKNOWN |
| Single, clearly-communicated expiry clock (not stacked) | UNKNOWN | N/A | UNKNOWN | N/A | N/A | ABSENT — Green Stars expire in 6mo, Gold/Reserve never; the asymmetry itself is the finding²⁵ | ABSENT — 3 separate clocks: points (annual purchase), redeemed rewards (60d), birthday reward (30d)²⁶ | UNKNOWN — ledger schema doesn't reveal policy; needs product decision | UNKNOWN |
| Redemption-path reliability (reward doesn't vanish at checkout) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | ABSENT — v11.18.1 (Jul 2026) bug: reward showed applied, failed at checkout²⁷ | UNKNOWN — not tested this pass | UNKNOWN |
| Badge/status system (verifiably server-backed, not client-side) | UNKNOWN | UNKNOWN | UNKNOWN ("Gold" status exists, mechanism unconfirmed) | ABSENT (no native status tier) | N/A | REAL (tier system) | UNKNOWN | REAL (schema-level) — `BadgeDefinition`/`UserBadge` models exist²⁸ | UNKNOWN |

## Trust, notification & platform-hygiene capabilities

| Capability | Fidilio | SmartX | OpenTable | Resy | SevenRooms | Rezervno-today | Rezervno-at-launch |
|---|---|---|---|---|---|---|---|
| SMS/OTP fail-closed (no silent fallback, no fabricated success) | UNKNOWN | UNKNOWN | N/A | N/A | N/A | REAL — missing `bodyId` is explicitly logged as an error and the send is refused, never silently faked²⁹ | UNKNOWN |
| Mandatory phone-capture as price of a "free" service, disclosed clearly | N/A | ABSENT-leaning — WiFi product's core mechanic is SMS-OTP capture "for building a marketing database," no diner complaint found but no visible opt-out described either³⁰ | N/A | N/A | N/A | UNKNOWN — not reviewed this pass | UNKNOWN |
| RTL + Persian-first UX with self-hosted fonts (no Google Fonts dependency) | UNKNOWN | UNKNOWN | N/A (not an Iran product) | N/A | N/A | REAL — `shared/fonts/vazirmatn-variable.woff2` shipped in-repo³¹ | UNKNOWN |
| Independent, third-party-reviewable footprint (App Store/Play/G2/Trustpilot presence) | REAL — 3.7/5, 578 ratings on Cafe Bazaar³² | ABSENT — zero independent review-platform presence found anywhere³³ | REAL — 4.65/5, ~190K Google Play ratings³ | REAL — 4.9/5, ~15.7K Google Play ratings³ | REAL — 4.7/5, 53 G2 reviews¹⁹ | UNKNOWN — pre-launch | UNKNOWN |

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

## What's missing from this matrix (be honest about it, don't silently drop it)

- **Every Tier-2 competitor** (TheFork, Eat App, Servme, TableCheck, Chope, Catchtable, Quandoo,
  Zenchef, Tabit, Toast Tables, Yelp Guest Manager, Punchh, Thanx, Paytronix, Como) is not yet a full
  column here because `recon-notes-global.md` only has pricing-page-level facts for them, no
  complaint/praise evidence — adding them as columns with mostly-`UNKNOWN` cells would look like
  coverage that doesn't exist yet. Next research batch should deep-profile at least **Servme**
  (flagged in recon notes as the closest MENA-regional comparable to Rezervno's own market context)
  before the rest.
- **Rezervno-at-launch is entirely `UNKNOWN`** — Scout has no launch roadmap document. CEO: either
  share one or tell Scout where to find it, and this column gets populated next pass.
- **No live app testing was performed on any competitor** this pass (Time-to-first-value, actual
  screenshots, actual checkout flows) — everything above is web/app-store/press-sourced. A follow-up
  pass with a real phone and real accounts on Fidilio's and SmartX's apps would upgrade several
  `UNKNOWN`s to `REAL`/`ABSENT` with first-hand evidence instead of secondhand search synthesis.
