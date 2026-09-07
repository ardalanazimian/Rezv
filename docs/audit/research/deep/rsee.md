# RSEE / آرسی — Deep Competitive Profile

**Date:** 2026-09-07
**Session:** Scout deep batch (Sonnet 5, scoped to 4 competitors per token-budget instruction)
**Competitor:** RSEE / آرسی (`rsee.ir`) — the only live, dedicated, consumer-facing Iranian
table-reservation platform found anywhere in this research programme.

**Internal-consistency check performed this session (STEP 1, before writing anything below):** all
five mode-specific corpus files (`business.md`, `features.md`, `scale.md`, `social.md`,
`store-reviews.md`) were read in full and cross-checked against each other and against the prior
lighter profile (`profiles/iran-reservation-longtail.md` §"آرسی / RSEE") for: pricing-figure
consistency, venue-count consistency, mandatory-vs-optional package-purchase phrasing, whether
complaint/praise theme counts exceed their stated sample sizes, and whether quotes carry a
handle+date. **No internal contradiction was found on any load-bearing claim.** One labeling
tension was found and is documented in full at §10 (not a factual contradiction — a rigor
difference between `MATRIX.md`'s flat "ABSENT" and the corpus files' more cautious
"ABSENT-leaning, not confirmed ABSENT" for the independent-review-footprint question). Full detail
below in the relevant sections; nothing was silently resolved.

This is also, as far as this research programme can establish, **the thinnest independent-evidence
base of any competitor profiled in this programme.** Every one of the five corpus files ran its own
`WebFetch`/`WebSearch` tool tests this session (2026-09-07) and every one failed
(`EGRESS_BLOCKED` / session-wide `WebSearch` budget exhausted at 200/200), independently confirmed
by a proxy-status diagnostic and, in one file, a raw-curl bypass outside the tool entirely (`curl`
exit `56`, "CONNECT tunnel failed, response 403"). **Every fact in this profile therefore traces to
exactly one first-hand source: a single fetch of `rsee.ir`'s root page by a prior Scout session on
2026-09-05**, plus one `WebSearch`-tier synthesis pass the same day for the cancellation-refund
percentages. Nothing in this profile was independently re-verified against the live site by this
session — that is stated plainly wherever a `[fetched]` or `[search]` tag appears below, and this
profile does not present 2026-09-05 evidence as though it were gathered today.

---

## 1. What it is / who it's for / business model

**REAL** (site content, `[fetched]` `rsee.ir`, 2026-09-05 — a prior Scout session, not this one).

RSEE is a reservation *facilitator* — explicitly not a venue operator itself — offering a web app
plus a claimed mobile app. A diner searches by location, sees a venue's menu/amenities/reviews/hours,
picks a **specific table** and time slot (not merely a time slot with no table assignment), and can
book up to one week ahead. It targets Iranian cafe/restaurant diners directly (B2C discovery +
booking) while separately selling three tiered subscription plans to restaurants (B2B SaaS).

**The defining business-model mechanic:** the diner buys a prepaid, chair-denominated credit
("آرسی" / ARSEE — one ARSEE = one chair) before booking. Verbatim, `[fetched]` 2026-09-05:

> **"جهت انجام رزرو میز کافه/رستوران، کاربر می تواند اقدام به خرید بسته نماید"**
> ("To make a cafe/restaurant table reservation, the user can proceed to buy a package")

> **"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک صندلی از یک میز می باشد"**
> ("Each reservation package contains a number of ARSEEs, and each ARSEE equals one chair from a
> table")

Booking a four-top deducts four ARSEE. This is structurally a **pay-to-book** model, not a
pay-on-no-show model: the money commitment sits *before* the reservation is made, not after a
no-show event. **Whether purchasing a package is mandatory for every single booking, or whether a
free/no-package booking path also exists, is UNKNOWN — not verified.** The verbatim uses *«می
تواند»* ("can"), never *«باید»* ("must"), and no sentence resolving this either way has ever been
found by any session (`business.md` §5, `features.md` §1.4, both 2026-09-07, consistent with each
other and with the prior profile). This is open priority #2 in `STATUS-2026-09-07.md` and remains
open after this session — no tools were available to pursue it further.

**Revenue structure — genuinely unresolved, flagged as a distinct open question in its own right:**
it is UNKNOWN whether the diner's chair-credit payment is RSEE's own revenue, a pass-through/escrow
RSEE holds and remits to the restaurant, or purely a no-show-deterrent mechanic that benefits the
restaurant with RSEE's actual monetization being only the three restaurant subscription tiers
(§2). No page found by any session states who receives the diner's money. (`business.md` §2,
2026-09-07.)

Confirmed **money-flow-adjacent facts**, all UNKNOWN: no commission percentage found anywhere for
either side of the transaction; no per-cover fee charged to the restaurant beyond the flat
subscription; no payment processor named for the diner-side chair-credit purchase (Zarinpal or
otherwise).

---

## 2. Pricing

**Currency: Toman (تومان) throughout, no Rial figure or ambiguity found anywhere in the RSEE
material gathered to date** — `[fetched]`, `rsee.ir`, 2026-09-05.

### Restaurant-side (B2B) subscription plans — REAL, the only RSEE prices ever independently seen

| Plan | Price | Term | Evidence |
|---|---|---|---|
| پلن ۱ — پایه (Basic) | **رایگان** (free) | ۴ ماه (4 months) | `[fetched]` rsee.ir, 2026-09-05 |
| پلن ۲ — حرفه‌ای (Professional) | **۹۹۰,۰۰۰ تومان** | ۱۲ ماهه (12 months) — RSEE's own on-page math states ≈۸۲,۵۰۰ تومان/month | `[fetched]` rsee.ir, 2026-09-05 |
| پلن ۳ — کامل (Complete) | **۲,۹۹۰,۰۰۰ تومان** *or* **۳,۹۹۰,۰۰۰ تومان** | ۶ ماه *or* ۱۲ ماه respectively (two duration options published on the same plan) | `[fetched]` rsee.ir, 2026-09-05 |

These figures are **identical, character-for-character, across all three mode-specific corpus
files** (`business.md` §1, `features.md` §3, `scale.md` §"SALES") and the prior lighter profile
(`iran-reservation-longtail.md` line 71-73). No contradiction found. Note also (context, not an
RSEE fact): `MATRIX.md` line 212-213 computes SmartX's reservation product as 5.4×–53.3× more
expensive than these RSEE figures depending on which SmartX/RSEE tier pair is compared — cited here
only to show the figures are load-bearing elsewhere in this research programme, not re-derived.

**What each plan tier unlocks in product capability (beyond price/duration) is UNKNOWN — not
verified.** No feature-comparison matrix across the three plans has ever been captured
(`business.md` §1, `features.md` §2.4).

### Diner-side (B2C) chair-credit ("آرسی") package price — **NEVER FOUND, largest gap in this file**

**UNKNOWN — not verified, by any session to date.** The mechanic (prepay chair-credit, spend on
booking) is REAL/`[fetched]`; its Toman price is not. `/plans` — the page most likely to carry it —
returned HTTP 404 on the one direct-fetch attempt (2026-09-05). Whether price varies by chair count,
venue tier, or time slot (e.g. a premium Friday-night rate) is likewise never described anywhere.
Without this figure, it is impossible to state whether the per-cover diner charge is a token nominal
fee or a substantial one relative to a typical bill (`business.md` §3).

### Cancellation refund tiers — `[search]`-tier only, never independently fetched

| Cancellation timing | Refund | Evidence tier |
|---|---|---|
| More than 3 hours before the slot | **100%** returned to the user's account | `[search]`, 2026-09-05 |
| Between 3 hours and the start of the slot | **50%** returned | `[search]`, 2026-09-05 |
| At or after the slot | **0%** | `[search]`, 2026-09-05 |

These three figures are consistent, word-for-word, across `business.md` §6, `features.md` §1.5, and
the prior profile (lines 55-58). **No contradiction found between files** — but the evidence tier
itself is the flag: `rsee.ir/rules` returned HTTP 404 on the one direct-fetch attempt made, so the
exact 100/50/0 percentages and the 3-hour boundary rest on `WebSearch` synthesis of some
indexed snippet, not on primary-source text any session has read with its own eyes. Treat as
directionally correct (corroborated by the chair-credit mechanic itself being `[fetched]`-real), not
verbatim-confirmed. **Refund destination** (cash vs. in-platform credit) is UNKNOWN — "returned to
the user's account" is ambiguous between the two.

### Everything else pricing-related — UNKNOWN or absent, consistently across all 5 files

| Item | Status | Notes |
|---|---|---|
| Commission % (either side) | UNKNOWN | Never found; structurally ambiguous whether RSEE even takes a cut |
| Per-cover fee to the restaurant | Absence, all sessions | None found beyond the flat subscription |
| Auto-renewal clause | UNKNOWN | Never found; `/plans`,`/rules`,`/faq` all 404 |
| Exclusivity/lock-in clause | UNKNOWN, either direction | Never found; `MATRIX.md` row also UNKNOWN |
| What happens after Plan 1's free 4 months end | UNKNOWN | Not described anywhere |
| Loyalty redemption minimum | Absence, all sessions (ABSENT-leaning) | No loyalty program of any kind found — see §7 |
| Coupon/discount funding | UNKNOWN | Never found; not even a structural inference possible |
| Changelog/release-notes/incident page | UNKNOWN | No `/changelog`, `/news`, `/blog`, or `/sorry`-equivalent ever found |
| `/plans`, `/rules`, `/faq` | Confirmed HTTP 404, all three | `[fetched — negative result]`, 2026-09-05 |
| Any `/terms`, `/privacy`, `/refund-policy` page | Never attempted with working tools | Genuine unexplored gap, not a negative result |

---

## 3. Users / scale

**Every field in this section is UNKNOWN — not verified**, except the one company-claimed venue
figure. This is not "RSEE has zero users" — it is "no session, across three independently-timed
2026-09-07 passes plus the 2026-09-05 base pass, has ever reached a source that would answer this."

| Field | Value | Label | Source/date |
|---|---|---|---|
| Venue count (claimed) | **"۲۰۰۰+"** partner cafes/restaurants | **CLAIMED** — company-published, unaudited | `[fetched]` rsee.ir, 2026-09-05 |
| Venue count (independent) | Never obtained | UNKNOWN | — |
| City coverage | Never stated in any source | UNKNOWN | — |
| Registered users / MAU (company-claimed) | Not published anywhere on `rsee.ir` per the 2026-09-05 fetch | ABSENT-leaning, not confirmed ABSENT | `scale.md`, 2026-09-07 |
| Registered users / MAU (independent) | Never obtained | UNKNOWN | — |
| Cafe Bazaar install band | Never located (no package name identified) | UNKNOWN | — |
| Myket listing | One candidate found and **ruled out** as an unrelated classifieds app ("کافه آرسی", <100 installs, last updated ≈2019-03-27) | Confirmed **not RSEE** (closed false lead) | `[fetched]`, 2026-09-05 |
| Google Play / iOS App Store listing | Never located | UNKNOWN | — |
| Aggregate rating (any platform) | Never obtained | UNKNOWN | — |
| Review count (any platform) | Never obtained; **0** reviews read across every session to date | UNKNOWN | — |
| Revenue / GMV | Never obtained | UNKNOWN | — |
| Funding rounds / investors | Never obtained — Crunchbase attempt this session `EGRESS_BLOCKED` | UNKNOWN | `scale.md`, 2026-09-07 |
| Headcount | Never obtained — LinkedIn attempt this session `EGRESS_BLOCKED` | UNKNOWN | `scale.md`, 2026-09-07 |
| Website traffic estimate | Never obtained — SimilarWeb attempt this session `EGRESS_BLOCKED` | UNKNOWN | `scale.md`, 2026-09-07 |
| Current job postings | Never obtained, never attempted | UNKNOWN | — |
| Acquisition history | Never found, no indication either way | UNKNOWN | — |

**Context for the venue claim (restated, not new):** the only independently-*countable* (as opposed
to marketing-round-number) venue figure anywhere in the Iranian long-tail sweep is Alaedin Travel's
**717** listed venues — roughly a third of RSEE's claimed 2,000, from an adjacent travel-agency
product, not a head-on competitor. RSEE's "2,000+" has zero independent corroboration of any kind
(`scale.md` §"USERS", 2026-09-07).

**A finding the `scale.md` session itself elevated for the founder:** three independently-timed
2026-09-07 sessions, targeting three different evidence classes (app-store reviews, social/forums,
scale/funding sources), using three different toolsets (`WebFetch`, `WebSearch`, and a raw-curl
proxy bypass), all hit the identical outcome. That is either (a) a tooling-availability problem
specific to this research window, or (b) if a future working session also finds nothing, itself a
notable strategic fact — a company claiming 2,000+ partner venues with zero discoverable
third-party footprint anywhere (Crunchbase, LinkedIn, SimilarWeb, app stores, social media) would be
unusual. Which of the two is true is **not yet known**.

---

## 4. Feature inventory

Per the REAL / CLAIMED / UNKNOWN / ABSENT taxonomy. Consolidated from `features.md` §4 (2026-09-07),
cross-checked against `store-reviews.md` and `business.md`'s own per-feature rows — no disagreement
found between files on any row.

| Feature | Status | Evidence |
|---|---|---|
| Booking flow (browse → select table → book) | **CLAIMED** | Paraphrase of `rsee.ir` `[fetched]` 2026-09-05; no screen-by-screen trace or step count ever captured |
| Table-level selection (not just time-slot) | **CLAIMED** | `[fetched]` 2026-09-05; internally consistent with the per-chair pricing unit, but never independently confirmed by an observed booking |
| Waitlist | **UNKNOWN** | Never described in any source; never searched with a dedicated query |
| Deposit / prepay (chair-credit "آرسی") | **REAL** | Verbatim quoted, `[fetched]` `rsee.ir` 2026-09-05 — the single best-evidenced row in the whole RSEE corpus |
| Package purchase mandatory for every booking | **UNKNOWN** | Verbatim *«می تواند»* (can), never *«باید»* (must); no resolving statement found by any session |
| Diner package price (Toman) | **UNKNOWN** | Never found by any session — largest pricing gap (§2) |
| Cancellation forfeiture policy exists | **REAL (inferred)** | Structural necessity of a "spent, per-seat" credit; `[fetched]` mechanic itself |
| Cancellation exact percentages (100/50/0) | **CLAIMED** | `[search]` only, 2026-09-05, never fetched from a rules page |
| Cancellation-policy display UX (where/when shown to diner) | **UNKNOWN** | Never described in any source — distinct from whether the mechanic exists; see §10 |
| Loyalty (earn/tiers/expiry/redeem/referral/streak/birthday) | **ABSENT-leaning, not confirmed ABSENT** | Not found across 5 independent sessions; pages most likely to disclose it (`/rules`,`/faq`) are 404; no dedicated loyalty-keyword search ever run with working tools |
| Notifications (SMS/push/email) + opt-out controls | **UNKNOWN** | Never described in any direction; no signup flow ever observed |
| In-product restaurant reviews/photos for diner discovery | **CLAIMED** | Paraphrase ("menu/amenities/reviews/hours"), `[fetched]` 2026-09-05; whether reviews are RSEE-native, imported, or restaurant-self-reported is UNKNOWN; photos never explicitly mentioned |
| RTL / Persian-first UX | **CLAIMED** | All captured copy is Persian, Iranian domestic product by construction; not independently observed in a running UI |
| Self-hosted fonts / Persian digit rendering | **UNKNOWN** | Never inspected by any session |
| Accessibility (touch targets, screen reader, focus) | **UNKNOWN** | Never assessed |
| Offline behaviour | **UNKNOWN** | Never assessed or described |
| Restaurant CRM / cross-visit guest recognition | **UNKNOWN** | Not described on any page reached |
| Marketing automation | **UNKNOWN** | Never found, never searched |
| POS / payment-gateway integration | **UNKNOWN** | No processor named anywhere; *some* processor must exist for the chair-credit purchase, but its identity is unknown |
| Restaurant-side configurable settings (any) | **UNKNOWN — total gap** | No RSEE restaurant dashboard/admin screen of any kind has ever been reached by any session; the only restaurant-facing surface ever seen is the pricing page |
| Mobile app (distinct from web app) | **UNKNOWN** | Site claims "web app plus mobile app"; no app-store listing ever located to confirm |
| Independent third-party review/social footprint | **ABSENT-leaning, not confirmed ABSENT** (see §10 for the MATRIX.md labeling tension) | Zero found across app stores, social media (X/Twitter, Telegram, Instagram, Reddit, LinkedIn), and Persian forums/news-comment sections, across 5 dedicated sessions |

**Where in the booking sequence the chair-credit purchase actually happens** (before browsing, at
table selection, or at final confirmation) is never stated by any source — a real, named gap, not an
oversight (`features.md` §1.1).

---

## 5. Restaurant-side settings/toggles — a total, unexplored gap

Worth stating on its own, per the task brief's structure and because it is unusually total compared
to every other competitor in this research programme: **no session has ever reached an RSEE
restaurant dashboard, admin panel, or settings screen of any kind.** Every one of the following is
UNKNOWN, not merely under-documented:

- Whether a restaurant can configure its own floor-plan/table layout, or whether RSEE does it on the
  restaurant's behalf.
- Whether a restaurant can set its own cancellation-window/forfeiture percentages, or whether the
  100/50/0 tiers (themselves only `[search]`-tier) are platform-wide and non-configurable per venue.
- Whether a restaurant can adjust chair-credit price per venue, table size, or time slot.
- Notification templates, opening hours, blackout dates, party-size limits — all unexplored.
- Whether Plan 1/2/3 differ in product capability or only in price/duration.

(`features.md` §2.4, 2026-09-07.)

---

## 6. Review synthesis

**Reviews read this session: 0. Reviews read by any Scout session, ever, for RSEE: 0.**

This is not a partial or thin sample — it is a confirmed, repeatedly re-tested zero. Five
independent passes have now attempted to reach an RSEE review corpus and all five failed for the
same underlying reason (tooling egress blocked):

1. 2026-09-05 base profile pass (`iran-reservation-longtail.md`) — had **working** `WebFetch` and
   still could not locate any app-store listing for RSEE (the one candidate found, a Myket listing
   for "کافه آرسی", was checked and confirmed to be a different, unrelated classifieds app).
2. 2026-09-07 `store-reviews.md` — `WebFetch` `EGRESS_BLOCKED` on both the neutral control
   (`example.com`) and `rsee.ir`; `WebSearch` exhausted (200/200) before either of 2 queries
   returned.
3. 2026-09-07 `social.md` — same dual-tool outage across 4 `WebFetch` targets and 2 `WebSearch`
   queries; proxy diagnostic itself blocked by this session's Bash-permission classifier.
4. 2026-09-07 `scale.md` — same outage across 5 `WebFetch` targets (including Crunchbase, LinkedIn,
   SimilarWeb) and 2 `WebSearch` queries; additionally reproduced the block via a raw-curl bypass
   outside the `WebFetch` tool entirely (`curl` exit `56`, "CONNECT tunnel failed, response 403").
5. 2026-09-07 `business.md` — same outage, 2 `WebFetch` targets, 1 `WebSearch` query.

**No verbatim quote, reviewer handle, star rating, review date, or theme count exists for RSEE
anywhere in this research programme.** Per the task's own rule and the audit constitution: **this
profile does not pad or fabricate reviews to fill this section.** Both "top complaints" and "top
praises" are reported honestly as:

### Top complaints
**UNKNOWN — sample size 0.** No user-authored complaint about RSEE's chair-credit pricing,
cancellation forfeiture, refunds, restaurant-side billing, support, or product quality exists
anywhere in this research line.

**Distinct from a review-derived complaint, and not mislabeled as one:** the structural finding,
already on record in the prior profile and `ANTI-PATTERNS.md` §3, that RSEE's pay-to-book-then-
forfeit-on-cancel model is — on the text of RSEE's own published terms, read directly — the single
most diner-hostile money mechanic found anywhere in this research programme, including OpenTable's
$25–50/person and Resy's up-to-$100/person no-show fees. Those fees at least attach to a no-show, an
event where the restaurant actually lost capacity. RSEE's credit is spent (and partially
forfeitable) on the act of booking itself. This is a textual/structural analysis of RSEE's own site
copy, not a user complaint, and it is not re-presented here as a review finding.

### Top praises
**UNKNOWN — sample size 0.** Same reason. The one positive, verified fact on file — that RSEE
publishes real restaurant-side pricing on a public page with no sales-call gate — is a structural
observation from the pricing page itself, `[fetched]` 2026-09-05, not a user-authored praise, and is
not presented as one.

**This absence is itself the single biggest finding in the whole RSEE research line**, flagged
independently by three of the five corpus files as a first-class strategic finding worth surfacing
to the founder directly: the *only* live dedicated Iranian reservation competitor, claiming 2,000+
partner venues, has **zero** discoverable independent user-generated content of any kind — no
app-store review, no social-media post, no forum thread, no news-comment. Whether that reflects a
genuinely thin independent footprint or five consecutive tooling-starved research passes is **not
yet resolved** — see §12.

---

## 7. Gen-Z lens scorecard

Sourced primarily from the prior profile's Gen-Z analysis (`iran-reservation-longtail.md` §"Gen-Z
lens on RSEE", 2026-09-05), restated with each item's evidence tier made explicit, since this
session did not independently re-observe the product.

- **Time to first value: structurally bad, CLAIMED-tier (not observed).** The funnel as described is
  discover → **buy a credit package** → book — a payment step sits between a first-time user and
  their first reservation. Every other consumer reservation product in this research programme
  (OpenTable, Resy, TheFork, Fidilio, Catchtable) puts the first booking before the first payment.
  No step count or screenshot exists to state exactly how many taps this costs a diner — the "bad"
  verdict is directional, from the described sequence, not measured.
- **Money respect: fails, and it is the defining fact about this product — the worst money-respect
  finding in the entire research programme.** Be specific: this is not a no-show fee (OpenTable
  $25–50/person, Resy up to $100/person — both attach to an event where the restaurant actually lost
  capacity). RSEE's chair-credit is purchased and partially forfeitable **on the act of booking
  itself**, before food is ordered and before any stated restaurant confirmation. The charge *is*
  shown before the booking commits (a package must be held before a table can be reserved), which is
  structurally better than TheFork's or Fidilio's "surprise charge at cancellation" pattern
  documented elsewhere in this programme — but it is a precondition of using the product at all, not
  a fee accepted for one specific reservation's terms. Per the prior profile's own framing: "free to
  look, pay to book" rather than "free to book, fee only if you no-show." **REAL** as a structural
  fact (`[fetched]` chair-credit mechanic); the *severity* judgment (worst in programme) is an
  analytical comparison against other profiled competitors' figures, not a measured user-harm
  statistic.
- **Feels like now:** UNKNOWN — not verified. No screenshot or UI trace exists to assess visual
  polish, animation, or modern interaction patterns.
- **Shareability:** UNKNOWN — not verified. No evidence of a share sheet, referral link, or social
  posting hook of any kind.
- **Trust:** mixed, CLAIMED-tier. RSEE does explain its pricing and its chair-credit rules in plain
  Persian on a public page with no sales-call gate — genuinely better disclosure posture than
  SmartX's or Fidilio's opacity (`business.md` §1, `MATRIX.md` row 53). But the rules it discloses
  are, per the money-respect finding above, bad rules clearly stated, not good rules. Whether the
  cancellation-forfeiture policy is actually *displayed to the diner before they commit* inside the
  product (as opposed to being findable on a marketing page) is separately UNKNOWN — see §10.
- **Notification behaviour:** UNKNOWN — not verified in any direction. No source describes SMS,
  push, or email behavior, confirmation flows, or opt-out controls.
- **What to steal:** the public, no-sales-call restaurant price list (§2), and table-level selection
  (pick the actual table, not just a time slot) if genuinely delivered as described.
- **What never to copy:** charging the diner to book, full stop. This is the clearest "never do this"
  signal in the whole competitive set — worse than any no-show fee found anywhere else in this
  research programme, because it attaches to booking itself rather than to a broken commitment.

---

## 8. Where it beats Rezervno today

- **Published, no-sales-call restaurant pricing.** RSEE's three plans (§2) are visible on a public
  page with real Toman figures and no "contact us" gate. Whether Rezervno's own restaurant-facing
  pricing is public in the same way was **not checked this session** (out of scope for this
  RSEE-focused pass) — flagged as UNKNOWN for Rezervno's side, not claimed as a Rezervno weakness.
- **Table-level selection claimed as a core mechanic**, not merely a time-slot booking — if
  genuinely delivered (CLAIMED, unconfirmed by any independent observation), this is a concrete
  product capability claim that would need a corresponding Rezervno capability check to compare
  against; not verified either way this session.
- **A live product with a real, if unaudited, claimed venue base ("2,000+").** Rezervno is
  pre-launch (per `MATRIX.md`'s own "Rezervno-today: N/A — pre-launch" cells across every row in
  this competitive set). RSEE, whatever its other gaps, is shipping and has been live long enough to
  publish two tiers of restaurant contract length (§2). This is a real, if unglamorous, "already
  exists" advantage.

No further items are asserted here — every other RSEE capability in §4 is CLAIMED or UNKNOWN, which
is not a basis for claiming it beats Rezervno on anything not independently observed.

---

## 9. Where Rezervno beats it today

**Evidence rule applied strictly per task instruction: every claim below was verified this session
via `Grep`/`Read` directly against the current repository — not assumed from a prior doc's citation
(several of which carry stale line numbers; each was re-checked).**

- **Deposit/prepayment is per-restaurant configurable and defaults to OFF**, not a platform-wide
  precondition of booking. `api/prisma/schema.prisma:1984-1994` — the `CancellationPolicy` model —
  carries `depositRequired Boolean @default(false)` alongside `freeCancelHours Int @default(24)`,
  `partialPenaltyHours Int @default(2)`, and `partialPenaltyPct Int @default(50)`, all set per
  `restaurantId`. This directly contrasts with RSEE's model, where the chair-credit purchase is
  structurally central to booking at all (§1, §7) with no confirmed free-to-book path ever found by
  any session. Rezervno's default posture is the opposite of RSEE's: book first, pay only if the
  restaurant has explicitly opted into requiring it.
- **Cross-tenant data isolation is enforced in code, not merely claimed.** RSEE's restaurant-side
  architecture is a total, unexplored UNKNOWN (§5) — no session has ever seen an RSEE dashboard.
  Rezervno's `withRestaurantAuth` wrapper sources `restaurant.id` only from the authenticated
  request context, never from body/query: `api/src/lib/with-restaurant-auth.ts:26-29` (the
  `RestaurantHandlerContext` type binds `restaurant: { id: string; ... }` to the auth-derived
  context) and `:43` (the wrapper's own doc-comment usage example queries
  `restaurantId: ctx.restaurant.id`, never a request parameter); staff-side tenant matching is
  enforced explicitly at `:176-182` (`if (staff.tenantId !== auth.tenantId) throw Err.forbidden();`).
  This is architecture-level evidence, not a live penetration test, but it is a verifiable code fact
  against RSEE's total silence on the same question.
- **SMS sending fails closed, with an explicit logged error, never a silent fallback.**
  `api/src/lib/sms.ts:278-283` — a missing `bodyId` (the per-template Melipayamak identifier) is
  caught explicitly: `log.error('bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد', { template:
  job.template })` followed by `return;` — the send is refused and logged, never silently guessed or
  faked. RSEE's notification behavior (SMS, push, or email; confirmations, reminders, opt-outs) is
  entirely UNKNOWN — no source describes it in either direction (§4).
- **Self-hosted Persian font, verified in the served asset tree, with no Google Fonts runtime
  dependency.** `apps/customer/css/fonts.css:29-36` declares `@font-face { font-family: 'Vazirmatn';
  ... src: url('../fonts/vazirmatn-variable.woff2') format('woff2'); }`, and the font file itself is
  present at `shared/fonts/vazirmatn-variable.woff2` (confirmed via directory listing this session).
  `apps/customer/index.html:49` carries an explicit in-repo comment noting the removal of any
  runtime dependency on `fonts.googleapis.com`. RSEE's font hosting (self-hosted vs. a Google Fonts
  CDN dependency, which is unreachable from Iran) has **never been inspected** by any session
  (§4) — this is a real, unverified gap on RSEE's side, not a confirmed Rezervno advantage over a
  confirmed RSEE weakness, but Rezervno's own posture here is independently verified.
- **A schema-level loyalty foundation exists, however early.** `api/prisma/schema.prisma:672`
  (`model PointsLedger`), `:2095` (`model BadgeDefinition`), `:2109` (`model UserBadge`) — all
  present in the current schema. RSEE has no loyalty mechanic of any kind found across 5 independent
  sessions (§4, ABSENT-leaning). This is stated carefully: these are schema-level models, not a
  claim that a live, wired, user-facing loyalty UI ships today — `MATRIX.md` footnote 23 itself
  flags `apps/customer/js/features/loyalty.js` as "exists, not live-tested in any pass." The
  comparison is schema-existence-vs-total-absence, not feature-parity-vs-total-absence.

**Explicitly not claimed here:** Rezervno's own restaurant-side settings/dashboard completeness,
public pricing transparency, or table-level selection capability were **not verified this session**
(out of scope for an RSEE-focused pass) — where §8 above notes an RSEE capability with no
corresponding Rezervno check, that is left as UNKNOWN on Rezervno's side, not resolved by omission.

---

## 10. Corrections to the prior (lighter) profile / MATRIX.md

**No factual correction was found.** Every pricing figure, quote, and mechanic description in the
five 2026-09-07 corpus files matches the prior profile (`iran-reservation-longtail.md`,
2026-09-05) exactly — expected, since the corpus files all trace back to that same single fetch
event and explicitly say so.

**One labeling-rigor tension is worth surfacing, not as an error but as an example of the corpus
being more cautious than `MATRIX.md`'s summary table, consistent with this constitution's rule that
absence must be demonstrated, not assumed from an unresearched gap:**

- `MATRIX.md` line 82 ("Independent, third-party-reviewable footprint" row) states flatly:
  **"ABSENT** — no app-store listing located and no independent review corpus of any kind found for
  the only live Iranian competitor. The biggest gap in batch 3."
- The 2026-09-07 corpus files (`features.md` §4, `store-reviews.md` §"Feature verification status")
  independently downgrade this to **"ABSENT-leaning, not confirmed ABSENT"** — reasoning explicitly
  that three-to-five sessions failing to *find* a listing under tooling-starved conditions is not the
  same claim as having *confirmed no listing exists*, and that a hard ABSENT requires the kind of
  targeted, successful search that no session has yet been able to run.

Both readings rest on the same underlying evidence (zero reviews found, five times). The difference
is purely how confidently that zero should be reported given the confirmed tooling outages
documented across all five corpus files. This profile follows the corpus files' more cautious
**ABSENT-leaning, not confirmed ABSENT** framing throughout (§4, §6), and flags `MATRIX.md`'s flat
ABSENT as the looser of the two labels — not necessarily wrong, but not yet independently earned
under this constitution's own evidentiary bar. No other `MATRIX.md` RSEE row was found to disagree
with the corpus.

**A second, narrower distinction (not a contradiction) worth naming:** `MATRIX.md` line 79 marks "A
money charge cannot become enforceable before it is displayed to the diner" as **ABSENT** for RSEE
("the charge *is* the booking act; 50–100% forfeited on late cancellation"). `features.md` §1.5
explicitly separates this from a narrower question it leaves **UNKNOWN**: whether/where an
in-product cancellation-policy screen is actually shown to the diner before they commit. MATRIX
answers the money-transparency structural question; the corpus's UNKNOWN answers a different,
narrower UX-disclosure question. Both are correct simultaneously — flagged here so this profile does
not silently collapse two different claims into one.

---

## 11. Sources

**Corpus files used (all dated 2026-09-07, all read in full this session):**
- `docs/audit/research/corpus/rsee/business.md`
- `docs/audit/research/corpus/rsee/features.md`
- `docs/audit/research/corpus/rsee/scale.md`
- `docs/audit/research/corpus/rsee/social.md`
- `docs/audit/research/corpus/rsee/store-reviews.md`

**Prior lighter profile, read for consistency-checking and correction purposes:**
- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
  dedicated competitor, and its model is the story" (2026-09-05)

**Other research-programme documents cited by the corpus files and cross-checked this session:**
- `docs/audit/research/MATRIX.md` — footnote 56 and every RSEE cell across all three capability
  tables (rows checked directly this session: 51, 52, 53, 54, 55, 56, 57, 58, 59, 79, 81, 82)
- `docs/audit/research/WATCH.md` (2026-09-05 RSEE entry)
- `docs/audit/research/ANTI-PATTERNS.md` §"RSEE"
- `docs/audit/research/PARITY-RISK.md` §1
- `docs/audit/research/proposals/006-disclosure-coupled-to-money-capture.md`
- `docs/audit/research/STATUS-2026-09-07.md`

**Repository source verified directly this session (for §9 only, via `Grep`/`Read` on the current
working tree, not assumed from any doc's citation):**
- `api/prisma/schema.prisma:1984-1994` (`CancellationPolicy` model, `depositRequired` default),
  `:672` (`PointsLedger`), `:2095` (`BadgeDefinition`), `:2109` (`UserBadge`)
- `api/src/lib/with-restaurant-auth.ts:26-29, 43, 176-182`
- `api/src/lib/sms.ts:278-283`
- `apps/customer/css/fonts.css:29-36`, `apps/customer/index.html:49`
- `shared/fonts/vazirmatn-variable.woff2` (confirmed present via directory listing)

---

## 12. What was NOT verified

- **No RSEE page was opened or searched by this session.** All evidence tagged `[fetched]` or
  `[search]` in this profile originates from a prior Scout session dated 2026-09-05, or from the
  five 2026-09-07 corpus-file sessions' own (uniformly failed) tool attempts — this session's own
  contribution was synthesis, internal-consistency checking, and the §9 repo verification, not new
  primary-source RSEE research.
- **The diner-side chair-credit package price in Toman** — never found by any session; the single
  largest unresolved gap in RSEE's business model.
- **Whether package purchase is mandatory for every diner booking** — remains at *«می تواند»*
  (can), unresolved.
- **The 100%/50%/0% cancellation-refund figures** — `[search]`-tier only, never independently
  fetched from a rules/terms page.
- **Who receives the diner's package payment** (RSEE vs. the restaurant) — not found.
- **Any RSEE terms-of-service, privacy-policy, or refund-policy page** — `/plans`, `/rules`, `/faq`
  are confirmed-404; no broader path sweep (`/terms`, `/privacy`, Persian-slug variants) has ever
  been attempted with working tools.
- **Any RSEE restaurant dashboard, admin panel, or settings screen** — a total gap; no session has
  ever reached one.
- **Loyalty, notifications, CRM, marketing automation, POS integration, accessibility, offline
  behaviour, waitlist** — none confirmed present or absent by direct observation.
- **Whether RSEE has a mobile app distinct from its web app** — unconfirmed; no app-store listing
  ever located.
- **Install bands, MAU, ratings, review counts, revenue/GMV, funding, investors, headcount, current
  job postings, website-traffic estimates** — all UNKNOWN; every dedicated attempt in this
  programme (5 independent sessions) hit a tooling-egress failure before reaching any source.
- **Rezervno's own public pricing transparency and table-level selection capability** — not checked
  this session (§8/§9 note this explicitly); left UNKNOWN on Rezervno's side rather than assumed.
- **Whether RSEE genuinely has zero independent footprint, or five consecutive sessions were simply
  tooling-starved** — the single highest-value open question carried forward from every corpus
  file; not resolved by this synthesis pass, which performed no new fetch or search of its own.
