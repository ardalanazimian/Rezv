# ANTI-PATTERNS — what competitors do that users hate, and we must never copy

_Maintained by Scout. Last updated: 2026-09-07. Synthesized from the nine profiles and `MATRIX.md`
on file as of this date. Purpose, per the brief: so nobody proposes one of these later in good faith,
having forgotten why it's on the list. Every entry below is evidence with a source, not a hunch — see
`rezervno-audit-constitution` §2 for what counts._

> **§0 note.** Same as `PARITY-RISK.md`: reporting target `rezervnofullsource-d9 [8dde6c]` resolved
> to `UNKNOWN — not verified` (no reachable session by that name via `ListAgents`, 2026-09-07);
> routed to this folder regardless.

---

## Money

### 1. Confiscating accrued value on account action, with no reason given
**Who:** TheFork. **Evidence:** of the 21 most recent 1-star Trustpilot reviews (2026-07-06 →
2026-09-02), **4 (19%)** are this exact complaint, all within a 4-week window. *"My account was
suspended suddenly! … I have earned 20000 Yums in my account and it cannot be used now"* (Yvonne, GB,
2026-07-20 — £500 at TheFork's own rate). *"My account was blocked with more than 450 euro in gift
cards i paid"* (Francesco Pagliano, IT, 2026-08-02 — cash he paid, not promotional credit). Two more:
Harry Rose and lestamunda, same pattern, same window. (`profiles/thefork.md`.)
**Why it's on this list, not just a complaint:** TheFork's *expiry clock* is the cleanest in this
whole research programme — one sentence, one year, no tiers. It didn't matter. The loss vector was a
platform decision, not a clock, and no amount of clock-design protects against it.
**Where Rezervno is exposed today, verified:** `PointsLedger`'s `enum PointsReason` includes
`adjustment`, and `note String?` is optional — `delta = -20000, reason = adjustment, note = NULL` is a
valid write today, and the diner has no ledger-history screen to discover it happened at all
(`api/prisma/schema.prisma:660-670`; `apps/customer/js/features/loyalty.js:57` renders only an
aggregate). **`proposals/005` exists specifically to close this.**

### 2. Charging money the app never showed before the charge
**Who:** TheFork. **Evidence:** *"The App did not alert me to the charge, otherwise I wouldn't have
cancelled"* — Clive Fathers, GB, 2026-07-21, £100. *"Charged £40 even though attended the booking"* —
AJK, GB, ~2026-08-29. 2 of the same 21-review sample (10%). **Global pattern:** OpenTable no-show fees
$25–50/person, described as a source of "adversarial" disputes; Resy up to $100/person, called
"obscene" by a reviewer (`profiles/opentable-resy-sevenrooms.md`).
**Where Rezervno is exposed today, verified:** the exposure is not that we do this — we don't, and by
design: `depositLabel()`/`cancelPolicyLabel()` implement an explicit "unknown → silence, never a
guess" rule (`apps/customer/js/data/booking.js:66-83`), and the payment route is gated by a
per-restaurant boolean nothing else in the product reads
(`api/src/app/api/v1/reservations/[code]/pay/route.ts:35`). **The exposure is that this correctness
is currently a human's one-time grep, not a CI gate — `proposals/006` turns it into one before deposits
are ever switched on.**

### 3. Making the diner pay for the *right* to reserve, forfeited on cancellation
**Who:** RSEE (رزرو رستوران‌های ایران) — the only live, dedicated, consumer-facing Iranian
table-reservation platform. **Evidence, verbatim:** *"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی
معادل یک صندلی از یک میز می باشد"* — the diner buys a chair-denominated credit package before any
food, before any restaurant confirmation. Cancel inside 3 hours of the slot: **nothing returned**.
Between 3 hours and the slot: 50%. (`profiles/iran-reservation-longtail.md`.)
**Why it's the worst money-respect finding in this entire programme, worse than OpenTable's or
Resy's:** those fees at least attach to a no-show — an event where the restaurant lost real capacity.
RSEE's currency is consumed by the act of *booking itself*. A funnel with a payment wall before the
first reservation is a structurally different, harder floor than anything else studied.
**Rezervno:** no platform-level diner fee exists (pre-launch); this is the model to never build toward,
named explicitly so nobody proposes "credits to book" as a demand-smoothing mechanic without reading
this entry first.

### 4. Tying commission discounts to restaurant exclusivity
**Who:** SnappFood — Iran's Competition Council (decision No. 740, 16 Ordibehesht 1404 ≈ 2025-05-06)
ruled its restaurant contracts anticompetitive: commission discounts conditioned on exclusive
cooperation, with exit penalties for restaurants who tried to leave. Exclusivity clauses were ordered
removed from all contracts, existing and future. (`profiles/snappfood-loyalty.md`, `WATCH.md`.)
**Also:** OpenTable's April 2026 "system of record" client-agreement update, requiring restaurants to
make OpenTable primary for reservations/tables/guests — drew a formal antitrust complaint to
Washington State. (`profiles/opentable-resy-sevenrooms.md`, `WATCH.md`.)
**Why two unrelated companies, two continents, same anti-pattern:** it means this is a structural
temptation of the business model (a platform with market share can always extract more by locking
restaurants in), not an isolated bad actor. `proposals/003` already commits Rezervno to the opposite,
in writing, before the temptation exists.

## Trust and honesty

### 5. Manufacturing a "discount" by inflating the price first
**Who:** SnappFood's FoodParty. **Evidence:** a user reported food priced at 120,000 Toman
"discounted" via FoodParty to 80,000 Toman — but the restaurant's own delivery invoice showed 80,000
Toman as the *undiscounted* price. Dated 2026-03-04 (Tejaratnews), not independently confirmed as a
recurring 2025/2026 pattern rather than a one-time incident. (`profiles/snappfood-loyalty.md`.)
**The rule this violates:** any Rezervno discount must be verifiably "listed price minus X," with the
pre-discount price visible and stable. The failure mode to design against is precisely "the discount
looks real until you see the underlying invoice."

### 6. A self-admitted incident that's honest at the page title and silent in the body
**Who:** SmartX. **Evidence, corrected this batch:** `smartx.ir/sorry/`'s HTML `<title>` genuinely
reads *«اختلالات باشگاه مشتریان | مرداد ماه 1404»* ("Customer Club disruptions — Mordad 1404") — so
the earlier finding that an incident occurred stands — but a first-hand fetch of the page body this
batch found **no description of the incident and no explicit apology text**, only two consecutive
"Stay Strong" retention campaigns around it. (`MATRIX.md` footnote 58, `[CORRECTED 2026-09-05]`.)
**Why this is its own, subtler anti-pattern, distinct from #4/#5:** it is not a lie — the title is
true — but it is disclosure calibrated to satisfy whoever only reads a headline (a journalist, a
search-result snippet) while giving the actual affected user nothing to act on. Any Rezervno incident
page must describe the incident in the body a user actually reads, not just in metadata.

### 7. Marketing a capability in the product's own name that isn't shipped
**Who:** Foodism — its own Cafe Bazaar listing name is *"فودیسم | سفارش غذا"* ("Foodism — food
ordering"). **Evidence:** targeted, repeated searching found no in-app online ordering or in-app
payment anywhere; ordering happens by phone call or in person only. No table-reservation feature
exists either, despite the product being profiled specifically as an Iranian reservation-adjacent
competitor. (`profiles/foodism.md`.)
**Why this is named explicitly rather than assumed obvious:** it is the exact external-market instance
of the class this repository's own constitution names as the worst internal failure — a claimed
success with nothing behind it (`rezervno-audit-constitution` §1, §7: never claim done without showing
verification). It didn't stay hidden either — a first-hand Foodism review obtained this batch,
2026-05-24, reads simply *«کار نمیکنه»* ("it doesn't work").

### 8. Rejecting or over-moderating negative reviews on a platform whose product *is* trust
**Who:** TheFork. **Evidence:** 3 of the 21-review 1-star sample (14%) report negative reviews
rejected by the platform or photo submissions over-restrictively moderated — paloma irving, Ken (GB,
2026-07-28), Alexander Smith (GB, 2026-07-12). (`profiles/thefork.md`.)
**Why it's structurally self-defeating, not just unpopular:** TheFork's own five-star praise cluster
names "trust when it works" as a core value proposition. Suppressing the negative half of that same
mechanic is not a neutral moderation choice — it directly undercuts the thing being sold. Applies
equally to Rezervno's own badge/review surfaces if they ever ship: moderation exists to remove abuse,
never to remove inconvenient truth.

### 9. Continuing to bill after contract termination
**Who:** TheFork, restaurant side. **Evidence:** *"Avoid TheFork at all costs … they've sent debt
collectors threatening High Court liquidation"* — Fuji Fusionuk, GB, 2026-08-26, describing billing
that continued after the restaurant had ended its contract. (`profiles/thefork.md`.)
**The rule:** a cancelled B2B relationship must stop billing on cancellation, provably, not
eventually — this is a governance failure of the same shape as #1 (accrued value confiscated with no
recourse), just aimed at the restaurant instead of the diner.

## Loyalty mechanics

### 10. Stacking multiple, differently-timed expiry clocks on the same value
**Who:** Chipotle Rewards. **Evidence:** points expire on annual-inactivity, a *redeemed* reward
expires in 60 days, the selectable birthday reward expires in 30 days — three separate clocks on one
balance. (`recon-notes-global.md` §Chipotle Rewards.) Chipotle's older 180-day inactivity policy was
contentious enough to reach federal litigation (upheld December 2025 — legally allowed, not the same
as users being satisfied).
**The rule, already load-bearing in `proposals/001` and reinforced by TheFork's and SnappFood's flat
pools this batch:** one clock per earned value, full stop. More than one distinct expiry timer on the
same reward is a design smell to justify, never a default.

### 11. Asymmetric expiry that reads as punishing the casual user
**Who:** Starbucks Rewards' March 2026 relaunch. **Evidence:** Green-tier (base) Stars expire in 6
months; Gold/Reserve Stars never expire — the asymmetry applies specifically to the segment least
likely to complain and most likely to simply churn. Bundled in the same relaunch: the top earn
multiplier moved from "anyone via card reload" to "2,500 Stars/year, Reserve only" — a real cut
layered inside a real improvement, not distinguished for users. Documented backlash: *"the new tiered
structure feels like a devaluation, especially for customers who previously maximized 2 Stars per
dollar."* (`recon-notes-global.md`, `WATCH.md`.)
**The rule:** never ship an expiry or rate change that helps one segment and costs another inside the
same unexplained announcement. If a change is genuinely mixed, say which parts are better and which
are worse, separately, in the copy — don't let users discover the cut themselves.

### 12. Redemption that fails at the moment of use, not the moment of earning
**Who:** Chipotle Rewards, app version v11.18.1 (~2026-07-08). **Evidence:** a reward showed as
applied to the cart in-app, then failed to redeem at checkout — reported-but-unverified secondary
source claims the app's average rating dropped sharply following the update; the underlying
redemption-failure *pattern* is corroborated across multiple independent search results even where the
exact before/after numbers aren't. (`recon-notes-global.md`.)
**Why redemption-path bugs are worse than accrual-path bugs:** the user has already mentally "spent"
the reward and hits the failure publicly, at a register, in front of a cashier — not privately, as a
quiet balance discrepancy discovered later. Redemption-path reliability deserves disproportionate
testing attention relative to accrual-path reliability, and per `rezervno-audit-constitution` §3, that
means proving the redemption gate goes red on a real regression before trusting it green.

## Data and disclosure

### 13. Undisclosed data flow between structurally related platforms
**Who:** Fidilio, 2024. **Evidence:** addresses saved in Snapp Food began appearing, and staying in
sync with edits, inside Fidilio's own address list, via a legacy ZoodFood-era integration, without a
clear, disclosed consent mechanism. CEO Mohammad Bagheri called it a "technical bug" from API
integration; three independent outlets (Digiato, Tabnak, Startup360) covered the explanation as
disputed rather than accepted. (`profiles/fidilio.md`, `WATCH.md`.)
**Also, structurally adjacent:** SnappFood's own confirmed Dec 2023/Jan 2024 data breach (20M+ users,
claimed by a group calling itself IRLeaks) — a second, larger, independent Iranian data-trust incident
in roughly the same 12–18 month window. (`profiles/snappfood-loyalty.md`, `WATCH.md`.)
**The rule:** `proposals/002` (data-provenance receipt) exists because this failure mode has now
happened twice, independently, in the exact market Rezervno is entering — not as a hypothetical
"privacy is good" gesture.

### 14. Monetizing mandatory data capture behind a "free" service, with the incentive stated openly
**Who:** SmartX. **Evidence:** its usage-based pricing plan gives restaurants a **30% discount** when
75%+ of invoices carry a customer phone number — the platform pays restaurants, in cash terms, to
harvest phone numbers at the point of sale. (`MATRIX.md` footnote 58, `profiles/smartx.md`.) Separately,
its Smart WiFi product's core mechanic is SMS-OTP capture explicitly "for building a marketing
database," with no visible opt-out described.
**Why it's on the list even though it's disclosed, not hidden:** disclosure of the mechanic is not the
same as the mechanic being acceptable. A diner who scans a WiFi QR code or hands over a phone number at
checkout has not consented to a restaurant being financially rewarded for maximizing capture rate.

---

## What I did NOT verify

- Every entry above cites a competitor source already on file; none required new research to write.
  No new competitor pages were fetched or searched for this file.
- Whether Rezervno's own codebase contains any early, unshipped version of patterns #1, #2, #10, #11,
  or #14 was checked only where a prior proposal (001, 005, 006) already did the grep — this file does
  not independently re-verify those citations, it reuses them with their original sourcing intact.
- Item #6 (title-vs-body disclosure) and item #12 (redemption-path failure) are judgment calls about
  *why* a pattern is bad, not just *that* it happened — the underlying facts are sourced, the framing
  is Scout's synthesis and should be read as such.
- This file is a snapshot as of 2026-09-07. If a competitor's practice changes (SmartX fixes its
  apology page, TheFork changes its suspension-appeal process), update this file and note the
  correction inline the way `MATRIX.md` does — do not silently delete a stale entry.
