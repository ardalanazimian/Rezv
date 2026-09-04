# WATCH — Competitive Moves Log
_Maintained by Scout. One line per entry, dated, sourced. Newest first._

Purpose: a running log of competitor moves that change our position — acquisitions, pricing
changes, feature launches, review-sentiment shifts, Iranian app-store policy changes. This is not
analysis (that lives in `profiles/` and `proposals/`); it's the trigger log that tells us *when*
to go re-check something.

---

## 2026

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
