# Foodism — Deep Competitor Profile

_Date: 2026-09-07 · Session: Scout deep batch (Sonnet 5, scoped to 4 competitors per token-budget
instruction) · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_

## Internal-consistency check performed (Step 1, before writing this profile)

All 5 corpus files were read in full: `docs/audit/research/corpus/foodism/{business,features,
scale,social,store-reviews}.md`, plus the prior lighter profile `docs/audit/research/profiles/
foodism.md` (+ its 2026-09-05 ADDENDUM). Findings:

- **The single most consequential calibration fact for this whole file: the "deep" 5-mode corpus
  batch (all 5 files dated 2026-09-07) added ZERO new primary evidence.** Every one of the five
  sessions independently hit total tool failure — `WebFetch` returned `EGRESS_BLOCKED` (well-known
  domains) or `getaddrinfo ENOTFOUND` (Foodism's own domains) on every attempt, including the
  neutral `example.com` control, and `WebSearch` reported a session-wide "200 of 200" quota already
  exhausted before a single query of theirs ran. All five files record `reviews_read = 0` for
  their own session. Every figure and quote in this deep profile therefore ultimately traces back
  to **one** earlier session: `profiles/foodism.md` batch 1 (2026-09-05, `WebSearch`-synthesis
  only) and its same-day ADDENDUM/batch 3 (2026-09-05, the one session where `WebFetch` actually
  worked and read Myket + Cafe Bazaar directly). This is a real limitation of the evidence base,
  not a defect introduced by this synthesis pass — flagged prominently rather than allowed to read
  as "5 independent modes of research" when it is closer to "1 working session, redescribed 5
  ways plus 5 honest failure reports."
- **No hidden internal contradiction found.** Every numeric inconsistency present in the corpus is
  already surfaced explicitly by the files that carry it, not silently picked-one-and-buried:
  - Myket rating/review count moved **4/5 over 216 reviews** (batch 1, `search-synthesis`,
    2026-09-05) → **4.3/5 over 226 reviews** (ADDENDUM, `fetched`, same day) — both figures are
    kept, dated to the correct sub-session, and flagged as "the listing is not frozen" rather than
    one replacing the other silently.
  - Venue count: **"8,000+"** (webna.ir, appetan.ir, charkhoneh.com) vs. **"9,000+"** (a separately
    worded synthesis) — flagged as an open discrepancy in every file that mentions it, never
    resolved by picking one.
  - Scale/reach claims disagree with each other by an order of magnitude and are all
    company-sourced: **"70,000+"** registered members (1399/2020-dated syndicated article) vs.
    **"100,000+ users"** (undated) vs. **"500,000+ monthly website visits"** (same undated source
    as the 100,000 figure) — and all three sit oddly against the one *independent*, store-side
    figure that exists, **25,000 installs on Myket** (`fetched`, 2026-09-05), which is roughly two
    to twenty times smaller than the claimed figures. `scale.md` states this plainly rather than
    reconciling it.
- **Complaint/praise theme counts never exceed the sample size** — trivially true here because the
  sample size itself is **1** (total verbatim reviews obtained across the entire research line,
  every session, every mode) and every file marks top-complaints/top-praises **UNKNOWN — not
  verified** rather than inventing counted themes from that single non-financial, non-feature-
  specific review. No file pads a "top 5" list to look more complete than the evidence supports.
- **Quotes are dated.** The one verbatim review in this entire research line — **معصومه, ۳ خرداد
  ۱۴۰۵** (Persian calendar; Gregorian conversion carried consistently across every file:
  **≈2026-05-24**) — carries a handle and a date everywhere it is cited. No undated quote was found
  anywhere in the corpus.
- **Cafe Bazaar 404 + "food ordering" name-mismatch: corroborated, not updated.** The prior finding
  (Cafe Bazaar listing `cafebazaar.ir/app/app.foodism.tech` returns HTTP 404 on three attempts/two
  URL forms, `[fetched]` 2026-09-05, controlled against `cafebazaar.ir/app/com.fidilio` fetching
  normally in the same minute; while the app's own store name/subtitle promises "…و سفارش غذا"
  — "…and food ordering" — a capability WebSearch's synthesis says does not exist, ordering being
  by phone/in-person only) is repeated consistently, with citation, in `business.md` §9,
  `features.md`'s booking-flow row (citing `ANTI-PATTERNS.md` §7 by name), `scale.md`, and
  `store-reviews.md`. **No 2026-09-07 session could re-check either fact** — every attempt to
  refetch `cafebazaar.ir` this batch returned `EGRESS_BLOCKED` before reaching a status code — so
  this remains a **2026-09-05, not-yet-re-verified** finding, correctly labeled as such everywhere
  it appears. It is not contradicted anywhere in the corpus.

**Net verdict of Step 1: the corpus is internally honest and consistent with itself** — its
inconsistencies are the product's own (contradictory company marketing figures), correctly
surfaced rather than resolved, and its central limitation (five files, one real evidence-gathering
session behind all of them) is stated by every file rather than hidden. Nothing here required a
correction to prior evidence; it required stating plainly, once, in this synthesis, how thin the
underlying evidence base actually is.

---

## What it is

A Persian-language restaurant/cafe/bakery/juice-shop **discovery-and-review social app** —
`foodism.app` on the web, Android package `app.foodism.tech`. Per its own Play/store copy
(rendered through `WebSearch`, never independently fetched): **"the largest social network for
restaurant-going and food ordering across Iran"** (بزرگترین شبکه اجتماعی رستوران‌گردی و سفارش غذا
در ایران). Covers restaurants, cafes, fast food, bakeries, juice/ice-cream shops, protein shops,
and food courts, claimed across **~29 Iranian cities/provinces**.
`[search-synthesis, 2026-09-05]` — `profiles/foodism.md` §"What it is", carried forward unchanged
by every 2026-09-07 corpus file.

**Load-bearing gap between name and product:** despite "…و سفارش غذا" ("…and food ordering") in
its own name, the product has **no in-app ordering and no in-app payment** — WebSearch's synthesis
states ordering happens "به صورت حضوری یا تلفنی" (in person or by phone, via a call button).
**ABSENT**, `[search-synthesis, 2026-09-05]`, cross-cited by `ANTI-PATTERNS.md` §7 as the
external-market example of "marketing a capability in the product's own name that isn't shipped."
There is also **no table-reservation feature of any kind** — a targeted search
("فودیسم رزرو میز رستوران") returned zero Foodism-specific results. **ABSENT — not found** (a
stronger classification than the default UNKNOWN, per the base profile's own reasoning).

**Status: DEGRADED — likely abandoned, not confirmed dead.** Set 2026-09-05 (ADDENDUM/batch 3,
the one session with working `WebFetch`), held unchanged by every subsequent session including
this synthesis:
- `cafebazaar.ir/app/app.foodism.tech` → **HTTP 404** — `[fetched]`, three attempts, two URL
  forms, controlled against `cafebazaar.ir/app/com.fidilio` (fetched normally, same minute).
- `myket.ir/app/app.foodism.tech` → live: **4.3/5 over 226 reviews, 25,000 installs, last updated
  ۱۴۰۱/۰۹/۱۰** (≈**2022-12-01**) — `[fetched]`. The binary has not shipped a new build in roughly
  **3¾ years** as of this file's date.
- One verbatim review exists anywhere in the whole research line, dated **2026-05-24**: **«کار
  نمیکنه»** — "it doesn't work." (See Review synthesis, below.)

**Business-model implication (inference, not a company statement):** a ~3.75-year-stale binary, a
404'd listing on one of Iran's two major Android stores, and a single 2026-dated "it doesn't work"
review together suggest the advertising-package revenue model — to whatever extent it ever ran at
real scale — is unlikely to be actively sold today. **This is explicitly reasoning from converging
circumstantial signals, not a confirmed shutdown** — no direct statement of Foodism ceasing sales
or discontinuing has ever been found. Labeled as inference in `business.md` §9 and carried forward
identically here.

## Who it's for

- **Consumers (diners), primarily.** The entire visible surface — discovery feed, reviews/ratings,
  follow/like/photo-upload, a per-city **"شکموهای حرفه‌ای"** ("professional foodies") leaderboard
  of the most-active local reviewers — is diner-facing. Browsing is free without an account;
  rating, favoriting, following, or uploading requires phone-number + SMS-OTP sign-up.
  `[search-synthesis, 2026-09-05]`, held **REAL-leaning, single-sourced** (`appreview.ir`, never
  independently cross-confirmed).
- **Restaurant/cafe/business owners**, as the paying side: free basic directory listing
  ("ثبت‌نام… رایگان است"); paid "advertising packages" (پکیج‌های تبلیغاتی, "با بازدهی خوب" — "with
  good returns") for more visibility, contact-only (phone/Instagram/website), **no published price
  list ever found by any session**.
- **No restaurant-owner-side complaint or commentary** (fees, onboarding friction, ad-package
  value) has ever been found by any session in this research line, despite repeated targeted
  searches across five 2026-09-07 sessions plus the base profile. Absence of evidence, not
  evidence of absence — flagged as the single largest standing gap in `social.md`.

## Business model & pricing

**Two structural absences make Foodism's pricing picture unusually thin compared to Fidilio
(commission-based) or SmartX (a full, self-contradictory Toman price table):** no diner-facing
money flow exists at all (no ordering, no reservation, no checkout), and the one paid product line
that does exist — restaurant advertising packages — has **never had a single figure published or
found**, by any session, in any format, across the entire research line.

| Item | Value | Label | Source, date |
|---|---|---|---|
| Currency | Never stated for any priced item — no priced item was ever found to attach a currency to | **UNKNOWN** | — |
| Diner-side pricing | N/A — no in-app ordering, reservation, or payment flow exists | structural absence | `profiles/foodism.md` §"What it is", `[search-synthesis]` 2026-09-05 |
| Restaurant "advertising packages" | Exist, "with good returns" (با بازدهی خوب) — **zero figures found**: no Toman amount, no cadence, no tier names | `[search-synthesis]`, thin | `profiles/foodism.md` §"Business model & pricing", 2026-09-05 |
| Basic directory listing | Free ("ثبت‌نام… رایگان است") | `[search-synthesis]` | same |
| Commission % | None — structurally absent (no transaction flow to take a cut of) | structural absence | `profiles/foodism.md` Feature inventory |
| Per-cover / per-booking fee | None — structurally absent | structural absence | same |
| Contract length / auto-renewal / exclusivity | Never found by any session | **UNKNOWN** | — |
| Diner deposit / no-show / cancellation fee | N/A — no payment/reservation flow exists | structural absence | same |
| Refund window | N/A on diner side; **UNKNOWN** on advertiser side (no ToS ever reached) | mixed | — |
| Loyalty redemption minimum | No native points/tier ledger found — **ABSENT** | **ABSENT** | `profiles/foodism.md` Feature inventory |
| Coupon/discount funding | No Foodism presence on Mopon (Iran's coupon aggregator; checked, negative). The only in-app discount mechanic described is restaurant-run, not Foodism-funded | inferred + one direct negative check | `profiles/foodism.md`, 2026-09-05 |
| Terms-of-service page | Never found by any session (`/terms`, `/privacy`, `/rules`, advertiser-agreement — none) | **UNKNOWN** | — |

**Registered-users / traffic scale claims (all company-claimed, mutually inconsistent, no
independent figure exists for any of them):**

| Figure | Label | Source / date |
|---|---|---|
| "70,000+" registered members (site+app) | company-claimed, `search-synthesis` | one 1399/2020-dated syndicated article |
| "100,000+ users" | company-claimed, `search-synthesis`, no date attached | separate search synthesis |
| "500,000+ monthly website visits" | company self-report, not a third-party tool estimate | same undated source as the 100,000 figure |

The only *independent*, store-side figure that exists anywhere — **25,000 installs on Myket**
(`[fetched]`, 2026-09-05) — sits one to two orders of magnitude below the "70,000+"/"100,000+"
claims; not strictly contradictory (Cafe Bazaar/Play/iOS installs are all unknown and could close
the gap) but worth holding as an open inconsistency, not resolved by any session.

## Users / scale

| Metric | Value | Label | Source, date |
|---|---|---|---|
| Installs — Myket | **25,000** | REAL, `[fetched]` | myket.ir/app/app.foodism.tech, 2026-09-05 (ADDENDUM) |
| Installs — Cafe Bazaar | N/A — listing returns HTTP 404 | REAL (the 404 itself), `[fetched]` | cafebazaar.ir/app/app.foodism.tech, 2026-09-05, 3 attempts |
| Installs — Google Play | UNKNOWN — no session has ever opened this listing | **UNKNOWN** | — |
| Installs — Apple App Store | UNKNOWN — no Iran-region iOS listing found or ruled out | **UNKNOWN** | — |
| Rating — Myket | **4.3 / 5** (over 226 reviews) — moved from 4.0/5 over 216 same-day earlier | REAL, `[fetched]` | 2026-09-05 |
| Rating — Cafe Bazaar | N/A — 404 | — | 2026-09-05 |
| Registered users | "70,000+" / "100,000+" — conflicting | company-claimed | 2020 / undated |
| Monthly website visits | "500,000+" | company-claimed, self-report | undated |
| Venues listed | "8,000+" / "9,000+" — conflicting | company-claimed | multiple app-intro blogs |
| Cities covered | ~29 (claimed) | company-claimed | multiple sources |
| Revenue / GMV | No figure of any kind — claimed, estimated, or filed | **UNKNOWN** | — |
| Funding rounds / investors | None found by any session | **UNKNOWN** (not "no funding" — absence of evidence ≠ evidence of absence) | — |
| Acquisition history | None found or claimed | N/A | — |
| Headcount | Never targeted-searched (LinkedIn, job boards) by any session | **UNKNOWN** | — |
| Current job postings | Never checked (Jobinja, e-Estekhdam, own site/Instagram) by any session | **UNKNOWN** — the single most consequential untested "is this company alive" signal per `scale.md` | — |
| Website traffic (Similarweb/SEMrush/Ahrefs) | Never queried by any session | **UNKNOWN** | — |
| Last binary update (Myket) | ۱۴۰۱/۰۹/۱۰ (≈**2022-12-01**) | REAL, `[fetched]` | 2026-09-05 |

## Feature inventory

Every row below is carried forward from `profiles/foodism.md` and its ADDENDUM, extended by
`corpus/foodism/features.md`'s per-row detail pass; **no row was independently re-verified by any
2026-09-07 session** (total tool failure — see Step 1 above). Given the DEGRADED status, even a
CLAIMED row should be read as "described when a third party last wrote about it (2020–2022 era)",
not "confirmed present in whatever binary a 2026 user could actually install."

| Capability | Status | Evidence |
|---|---|---|
| Restaurant/cafe discovery directory & search | **REAL** | Live, cross-confirmed Cafe Bazaar + Myket listings (name/package match), own site, multiple independent app-intro blogs — all describing the same 8,000–9,000-venue product. |
| User reviews/ratings per venue | **REAL** | Myket aggregate 4.3/5 over 226 reviews, `[fetched]` 2026-09-05 — the single strongest-evidenced row in the whole inventory, though "active" as of a 2022 binary, not confirmed as of 2026. |
| Booking/reservation flow (any kind) | **ABSENT** | Targeted search "فودیسم رزرو میز رستوران" returned zero Foodism-specific results. `ANTI-PATTERNS.md` §7 names Foodism explicitly for marketing "…و سفارش غذا" in its own listing name with no such mechanism found. |
| Table-level selection | **ABSENT — structural** | Follows directly from no booking flow existing at all. |
| Waitlist (join/position/notify) | **UNKNOWN — not verified** | Never directly searched for by any session; not inferred from the booking-flow absence. |
| Deposits / prepayment | **ABSENT — structural** | No payment flow of any kind exists to attach a deposit to. |
| Cancellation-policy display | **ABSENT — structural** | No booking to cancel. |
| In-app online ordering + in-app payment | **ABSENT** | WebSearch's synthesis states ordering is by phone/in-person, despite "سفارش غذا" in the app's own store name — the single most load-bearing ABSENT finding in this profile. |
| Payment-gateway integration | **ABSENT — structural** | Follows from no in-app payment flow existing. |
| Loyalty — points earn / tiers / expiry / redeem | **ABSENT — not found** | Targeted search found no Foodism-native points/tier system; the only "discount" mechanic found is generic, restaurant-run offers surfaced inside the app, not a Foodism ledger. |
| Referral program | **UNKNOWN — not verified** | Never targeted-searched by any session. |
| Streaks | **ABSENT-leaning, not directly searched** | No streak mechanic described in any third-party source (`webna.ir`, `appetan.ir`, `appreview.ir`, `charkhoneh.com`) that does describe the leaderboard in detail — plausible it would be mentioned alongside if it existed, but not a direct search. |
| Birthday rewards | **UNKNOWN — not verified** | Never searched for. |
| Social layer — follow/like | **CLAIMED** | Third-party app-intro blogs only (`appreview.ir`, `charkhoneh.com`); mechanism (server-verified vs. client-side) never independently tested. |
| Per-city "professional foodies" leaderboard | **CLAIMED** | Same third-party sources; the single most distinctive Gen-Z-shaped design choice found for Foodism, still unverified as currently shipped. |
| Photo upload per venue | **CLAIMED** | Same third-party sources, not independently tested. |
| Phone + SMS-OTP sign-up gate (browsing free; rate/follow/favorite/upload gated) | **REAL-leaning, single-sourced** | `appreview.ir`, via WebSearch synthesis; not cross-confirmed by a second independent source. |
| Notifications (push/SMS) — content/frequency/opt-out | **UNKNOWN — not verified** | Zero evidence either way in this entire research line — explicitly named as one of the largest genuine gaps. |
| Restaurant-side CRM / guest segmentation / tags | **UNKNOWN — not found** | Targeted search surfaced only unrelated competitor content (SmartX, Sepidz, Hami POS). |
| Marketing automation (restaurant-triggered campaigns) | **UNKNOWN — not verified** | Never searched for; no dashboard confirmed to exist that such a feature could run from. |
| Restaurant-side paid advertising / visibility packages | **CLAIMED** | Described only in generic terms ("packages with good returns"); no price list or feature breakdown ever found. |
| POS integration | **UNKNOWN — not verified** | Never searched for. |
| Persian language / RTL layout | **REAL** | Every source across every session — store listing name, Instagram, magazine, every third-party article — is entirely Persian. |
| Persian (Eastern Arabic) numeral rendering in-app | **UNKNOWN — not verified** | Source dates use Eastern Arabic digits in store-listing metadata text, not proof of in-app UI numeral choice; never confirmed hands-on. |
| Accessibility (touch targets, screen reader, focus order) | **UNKNOWN — not verified** | Zero coverage anywhere in this research line. |
| Offline behaviour | **UNKNOWN — not verified** | Zero coverage anywhere in this research line. |
| iOS app existence | **UNKNOWN — not verified** | No Iran-region App Store listing found or ruled out in any search. |
| Android app (store presence) | **REAL, but degrading** | Myket live (4.3/5, 226 reviews, 25,000 installs, 2022 binary); Cafe Bazaar returns HTTP 404. |
| Independent tech-press coverage (Zoomit/Digiato editorial) | **ABSENT — none found** | Site-restricted searches on both domains returned nothing Foodism-specific beyond syndicated best-of listicles. |
| IWMF "best food app" award (1399/2020–21) | **CLAIMED** | Sourced only to Foodism's own store copy and near-identical syndicated listicles; not found on `iwmf.ir` itself or in independent editorial coverage — same pattern flagged as likely رپورتاژ (paid placement) for SmartX's "media hit" claim. |
| Data breach / security-incident history | **UNKNOWN — none found** | Searched specifically; found nothing either way — could mean it hasn't happened, hasn't been reported, or the product is too small to be a disclosed target. |
| Restaurant-side admin dashboard (any configuration surface) | **UNKNOWN — existence itself unconfirmed** | No session has found, described, or ruled out a restaurant-facing dashboard at all — a materially larger gap than for Fidilio or SmartX, both of which have at least some dashboard description on record. |

## Review synthesis

**Sample size across the entire Scout research line, every mode, every session, to date: 1
verbatim review**, against a background of 226 Myket star-ratings (2026-09-05) — under 0.5% of the
rated population has any quoted text attached to it. `reviews_read = 0` for every one of the five
2026-09-07 corpus sessions; the one review that exists was obtained by the 2026-09-05 ADDENDUM
session, the only one with working `WebFetch`.

Given `sample_size = 1`, **no "top 5 complaints" or "top 5 praises" list can be honestly
populated** — every file in the corpus marks both **UNKNOWN — not verified** rather than padding a
template, and this synthesis does the same rather than inventing themes from a single data point.

**The one verbatim review, quoted in full, everywhere it appears in the corpus:**

> «کار نمیکنه»
> — **معصومه**, ۳ خرداد ۱۴۰۵ (Gregorian conversion, carried consistently: **≈2026-05-24**),
> via `myket.ir/app/app.foodism.tech`, `[fetched]` 2026-09-05

Translation: "It doesn't work." A general functional complaint — does not name a specific feature,
does not discuss money, pricing, or billing. Contributes zero data points to the pricing mode and
one general "may not currently work end-to-end for at least one 2026 user" signal to the feature
mode.

**Aggregate-only data (not attributable quotes):**
- Myket: 226 reviews, 4.3/5 aggregate, `[fetched]` 2026-09-05.
- Myket (earlier same-day reading, superseded in part): 216 reviews, 4.0/5, `[search-synthesis]`.
- Cafe Bazaar: listing confirmed to exist as of 2026-09-05 pre-ADDENDUM search-synthesis, but by
  ADDENDUM time (`[fetched]`, same day) returns HTTP 404 — rating/count never obtainable at any
  point.

### Top complaints
**UNKNOWN — not verified.** `sample_size = 1`, and the one review is functional, not thematic —
"it doesn't work" cannot honestly be expanded into 5 distinct complaint themes with counts.

### Top praises
**UNKNOWN — not verified.** Same reason; no five-star or positive verbatim text was ever obtained
by any session despite repeated, differently-worded, complaint-and-praise-targeted Persian
searches in the base profile.

## Gen-Z lens scorecard

Reusing the 7-question framework already established in `profiles/opentable-resy-sevenrooms.md`,
as `profiles/foodism.md` did — not inventing a new one.

1. **Time to first value** — REAL/partial: browsing the directory and reading reviews works
   without an account per consistent third-party description; only rating/following/favoriting/
   uploading requires phone+OTP sign-up. Genuinely low-friction on paper; never tested hands-on
   (no session has installed the app), and given the DEGRADED status the app may not currently
   load a first screen successfully at all — the one 2026 review says it doesn't work. **UNKNOWN
   whether the described low-friction entry is still true in practice.**
2. **Money respect** — N/A in the strict diner-facing sense (no payment flow of any kind exists to
   evaluate). On the restaurant-owner side (the actual paying customer), pricing is fully opaque
   ("contact us for advertising packages," zero published figures ever found) — the same weakness
   flagged for Fidilio and SmartX, with Foodism's version being even more total (literally zero
   figures vs. their partial disclosure).
3. **Does it feel like now** — **UNKNOWN — not verified.** No screenshot, demo video, or hands-on
   session has ever been reached by any session (`WebFetch` blocked/failed every time it was
   tried). `appetan.ir`'s description of a white-background, red-accent, four-tab UI (Discover /
   Discounts / Content / Profile) is the only design-language signal found, and it reads as
   marketing-adjacent content, not an independent design review.
4. **Shareability** — the **single strongest, most distinctive finding for Foodism across this
   whole research line.** Follow/like mechanics, per-venue photo uploads, and an explicit per-city
   "professional foodies" leaderboard are a genuinely more social, Instagram/Yelp-shaped design
   than either Fidilio or SmartX's documented feature sets. **CLAIMED** (third-party descriptive
   sources only, never independently tested) — but a real structural design choice, not just
   marketing copy.
5. **Trust** — **UNKNOWN, genuinely.** Unlike Fidilio (a real, multi-outlet-reported data-sharing
   controversy) or SmartX (a self-admitted reliability incident), zero dated trust signal of any
   kind — positive or negative — was ever found for Foodism. Could mean "nothing bad has happened,"
   "too small to attract scrutiny," or "search simply missed it" — cannot distinguish from here.
6. **Notification behaviour** — **UNKNOWN — not verified.** No review or article discussed
   push-notification frequency, SMS marketing volume, or opt-in/opt-out mechanics, across every
   session in this entire research line.
7. **Steal / never-copy** —
   - **Steal:** the explicit social/reputation layer (follow, like, per-city top-reviewer
     leaderboard) as a distinct design primitive layered on top of a ratings/directory feature —
     it gives users a reason to keep contributing beyond a one-off review, something neither
     Fidilio's nor SmartX's documented feature sets clearly offer.
   - **Never copy:** marketing a product's own name/subtitle ("…و سفارش غذا" / "…and food
     ordering") around a capability (in-app ordering with payment) that, per every session's
     research, does not actually exist — the exact "successful-sounding but nothing shipped"
     pattern `ANTI-PATTERNS.md` §7 names Foodism as the external example of, and the same failure
     mode `CLAUDE.md`'s "no fake success" rule exists internally to prevent.

## Where it beats Rezervno today

- **A native social/reputation layer** (follow other users, "like," per-venue photo upload, and a
  per-city "professional foodies" leaderboard of top reviewers) — **CLAIMED**, third-party sourced,
  never independently tested, and unconfirmed as still-shipped given the DEGRADED status. If real
  and still live, this is a genuinely more Instagram/Yelp-shaped social primitive than anything
  found in this research line for Fidilio or SmartX. I could not find an equivalent social/
  follow/leaderboard layer in Rezervno's own codebase during this pass (not exhaustively searched —
  flagged as **UNKNOWN** on the Rezervno side rather than asserted absent without a citation, per
  the evidence rules governing this section).
- **Zero-account browsing/discovery** — per consistent third-party description, a user can browse
  the full restaurant directory and read reviews with no sign-up at all; Foodism gates only the
  write actions (rate/follow/favorite/upload) behind phone+OTP. **CLAIMED**, never independently
  tested by any session, so held with the same caveat as above.
- Beyond these two CLAIMED-tier, unverified-in-2026 items, **no other area was found where Foodism
  outperforms Rezervno** — its core transactional surface (booking, payment, loyalty, CRM) is
  ABSENT or UNKNOWN across the board, and the product itself is DEGRADED (2022 binary, 404'd
  primary-store listing).

## Where Rezervno beats it

Every claim below is a repo file:line citation verified directly by this session via Grep/Read on
the current repo — not assumed from any doc's claim.

- **Rezervno has a real, DB-modeled reservation lifecycle with table-level assignment, holds, and
  merges; Foodism has no booking flow of any kind (ABSENT, confirmed by targeted search).**
  `api/prisma/schema.prisma:497-538` (`model Reservation`) — `tableId` (table-level selection,
  `:502-503`), `mergedTableNumbers` for combined-table bookings (`:522`), `holdExpiresAt` for
  timed pending holds (`:520`), and an 18-state `ReservationStatus` enum including `waitlisted`
  (`api/prisma/schema.prisma:454-476`).
- **Rezervno has a dedicated `WaitlistEntry` model; Foodism's waitlist status is UNKNOWN — never
  searched for by any session.** `api/prisma/schema.prisma:611` (`model WaitlistEntry`).
- **Rezervno has a configurable per-restaurant cancellation policy with a free-cancellation window
  and a partial-penalty percentage; Foodism has no cancellation-policy display of any kind (ABSENT
  — structural, no booking to cancel).** `api/prisma/schema.prisma:1984-1992` (`model
  CancellationPolicy`: `freeCancelHours` default 24, `partialPenaltyHours` default 2,
  `partialPenaltyPct` default 50, `depositRequired`, `autoConfirm`).
- **Rezervno has real deposit collection tied to reservations with an explicit status machine;
  Foodism has no deposit/prepayment mechanism (ABSENT — structural, no payment flow exists at
  all).** `api/prisma/schema.prisma:533-536` (`depositRequested`, `depositAmountToman`,
  `depositStatus`) and the `DepositStatus` enum at `api/prisma/schema.prisma:479-486`
  (`none`/`pending`/`paid`/`refunded`/`failed`).
- **Rezervno integrates a real payment gateway (Zarinpal) with the Toman/Rial currency bug
  explicitly guarded against; Foodism has no payment-gateway integration of any kind (ABSENT —
  structural).** `api/src/lib/zarinpal.ts:40` (`currency: 'IRT', // صریحاً تومان — بدون این، API
  پیش‌فرض را ریال در نظر می‌گیرد (۱۰ برابر تفاوت!)`) and again at `api/src/lib/zarinpal.ts:66`.
- **Rezervno has a native points/rewards economy (missions with XP, a reward marketplace with
  tier-gated items, and a referral program with a fixed point payout) — all things Foodism was
  searched for and found ABSENT ("no Foodism-native points/tier system... only generic,
  individual-restaurant-run offers").** `api/prisma/schema.prisma:2003-2021` (`model Mission`:
  `kind`, `targetCount`, `xpReward`), `api/prisma/schema.prisma:2046-2054+` (`model
  RewardMarketplaceItem`: `costCoins`, `minTier` defaulting to `"bronze"` — i.e. a real tier
  system), and `api/prisma/schema.prisma:696-704` (`model Referral`: `rewardPoints` default 500,
  `ReferralStatus` lifecycle).
- **Rezervno enforces an explicit fail-closed SMS contract (no silent fallback if a template's
  `bodyId` is unconfigured) via a dedicated, auditable module; no SMS/notification opt-out or
  fail-closed behaviour of any kind has ever been found or searched for on Foodism's side
  (UNKNOWN).** `api/src/lib/sms.ts:39-50` (`bodyIdFor` — comment: "نبودشان **صریح** گزارش می‌شود، نه
  fallbackِ بی‌صدا" — "their absence is reported **explicitly**, not a silent fallback") and
  `api/src/lib/sms.ts:179` (`export async function enqueueSms`).
- **Rezervno self-hosts its Persian font (Vazirmatn) rather than depending on Google Fonts, which
  is unreachable from Iran; Foodism's in-app Persian numeral/font rendering has never been
  confirmed by any session (UNKNOWN).** `shared/fonts/vazirmatn-variable.woff2` (confirmed present
  on disk this session) and `CLAUDE.md`'s explicit "no Google Fonts, ever" rule.

## Corrections to the prior (lighter) profile / MATRIX.md

**None found.** `profiles/foodism.md`, its ADDENDUM, and `MATRIX.md`'s Foodism footnotes
(47, 49–55, 62) were cross-checked against every 2026-09-07 corpus file and against this session's
own read of `MATRIX.md`. No figure, date, status, or quote in the prior profile or `MATRIX.md` is
contradicted by anything in the deep corpus — every 2026-09-07 file explicitly ran its own
"contradiction check against existing profile and corpus" and found none, and this synthesis pass
independently reaches the same conclusion. The deep corpus's actual contribution is **not new
facts** but (a) organizing the existing facts more explicitly under this task's required mode
headings (pricing/terms, feature inventory, scale, social, reviews), (b) sharpening the
"company-claimed vs. independent" framing for the scale figures (explicitly stated as a
sharpening, not a new finding, in `scale.md`), and (c) documenting, five times independently, that
this batch's tooling had zero live capability — itself a fact worth recording precisely because a
future session should know not to assume the 2026-09-07 batch re-verified anything.

## Sources

**Deep corpus files (this profile's primary inputs, all dated 2026-09-07, Scout):**
- `docs/audit/research/corpus/foodism/business.md`
- `docs/audit/research/corpus/foodism/features.md`
- `docs/audit/research/corpus/foodism/scale.md`
- `docs/audit/research/corpus/foodism/social.md`
- `docs/audit/research/corpus/foodism/store-reviews.md`

**Prior lighter profile (read for corrections purposes, per task instructions):**
- `docs/audit/research/profiles/foodism.md` (base profile 2026-09-05, batch 1, `WebSearch`-only)
  plus its same-day ADDENDUM/batch 3 (`WebFetch`, first-hand) — the ultimate source of every
  `[fetched]`-tier fact in this entire profile: the Myket 4.3/5-over-226-reviews/25,000-installs/
  ۱۴۰۱-binary figures, the Cafe Bazaar HTTP 404, and the one verbatim review.

**Repo documents cross-checked for corrections (no contradiction found in any):**
- `docs/audit/research/MATRIX.md` (footnotes 47, 49–55, 62)
- `docs/audit/research/ANTI-PATTERNS.md` §7
- `docs/audit/research/WATCH.md` (2026-09-05 [Iran] entry)
- `docs/audit/research/PARITY-RISK.md`
- `docs/audit/research/profiles/iran-reservation-longtail.md`

**Current-repo files read/grepped directly by this session to verify "Where Rezervno beats it"
(file:line citations above):**
- `api/prisma/schema.prisma` (Reservation, WaitlistEntry, CancellationPolicy, DepositStatus,
  Mission, RewardMarketplaceItem, Referral models/enums)
- `api/src/lib/zarinpal.ts` (explicit `currency: 'IRT'`)
- `api/src/lib/sms.ts` (`bodyIdFor`, `enqueueSms`, fail-closed comment)
- `shared/fonts/` (confirmed `vazirmatn-variable.woff2` present)

## What was NOT verified

- **No live web research of any kind was performed in this synthesis pass or in any of the five
  2026-09-07 corpus sessions feeding it.** Every fact traces back to the single 2026-09-05
  ADDENDUM/batch-3 session (the only one with working `WebFetch`) or to 2026-09-05 batch-1
  `WebSearch` synthesis. This profile did not re-fetch or re-search anything — per the task's
  explicit instruction to work from the corpus already on disk, not re-fetch the web.
- **Whether the Cafe Bazaar 404 still holds as of 2026-09-07 or later** — every attempt to
  re-check it (five separate sessions) failed before reaching a status code.
- **Whether the Myket 25,000-installs/4.3-over-226-reviews figures have moved** since 2026-09-05 —
  not re-checked by any session since.
- **Whether Foodism is still hiring or operating as a company at all** — no job-board (Jobinja,
  e-Estekhdam), LinkedIn, or funding-press (Crunchbase, Tracxn, Digiato/Peyvast funding tags)
  search has ever been attempted by any session. `scale.md` names this the single most
  consequential open question for the whole competitor and it remains completely untested.
- **Website traffic** (Similarweb/SEMrush/Ahrefs) for `foodism.app`/`mag.foodism.app` — zero
  attempts across the entire research line.
- **Whether the app can currently be installed and used end-to-end** — no session has installed
  the app on a device or emulator; the sole evidence toward function is one 2026-dated review
  saying it does not work.
- **Restaurant-owner-side commentary of any kind** (fees, payouts, support responsiveness,
  exclusivity clauses) — zero evidence obtained by any session despite repeated targeted attempts.
- **Foodism's own notification/opt-out behaviour, accessibility, offline handling, and in-app
  Persian-numeral rendering** — zero coverage anywhere in this research line, explicitly flagged
  UNKNOWN rather than inferred.
- **Whether Rezervno itself has a social/follow/leaderboard layer or an account-free browsing
  mode equivalent to what Foodism claims** — not exhaustively searched this pass; the "Where it
  beats Rezervno" section above holds these UNKNOWN on the Rezervno side rather than asserting
  their absence without a citation.
- **This profile's own "Where Rezervno beats it" section is scoped to what this session actually
  found via Grep/Read in the time available** — it is not an exhaustive audit of every Rezervno
  capability Foodism lacks (e.g., staff-side tooling, admin dashboards, audit logging were not
  cross-checked against Foodism's confirmed-UNKNOWN dashboard existence).
