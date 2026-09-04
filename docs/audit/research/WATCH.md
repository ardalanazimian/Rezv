# WATCH — Competitive Moves Log
_Maintained by Scout. One line per entry, dated, sourced. Newest first._

Purpose: a running log of competitor moves that change our position — acquisitions, pricing
changes, feature launches, review-sentiment shifts, Iranian app-store policy changes. This is not
analysis (that lives in `profiles/` and `proposals/`); it's the trigger log that tells us *when*
to go re-check something.

---

## 2026

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

---

## Log discipline
- Every entry needs a date observed + source URL. No entry without a source.
- When a watched move changes a MATRIX.md cell, update the matrix in the same pass and note it here
  ("→ updated MATRIX row X").
- Iran-market entries (Cafe Bazaar/Myket policy, Fidilio/SmartX pricing or feature changes) go here
  too, not just global ones — see `profiles/fidilio.md` and `profiles/smartx.md` for the baseline
  this log watches against.
