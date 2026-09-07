# RSEE (آرسی) — Observed Feature Inventory (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: RSEE / آرسی (`rsee.ir`), key `rsee`, tier `iran`_
_Mode: OBSERVED FEATURE INVENTORY (booking flow, table selection, waitlist, deposits/prepay,
cancellation display, loyalty, notifications, reviews/photos/social, CRM/segmentation, marketing
automation, POS/payment integrations, languages/RTL/Persian digits, accessibility, offline —
plus what the RESTAURANT can configure)_

## Prior art read first (per task instruction) — this file extends, does not repeat

Read in full before writing anything below:

- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
  dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` pass against `rsee.ir`
  directly). This is the **sole first-hand source** for every RSEE feature/UX fact that exists
  anywhere in this research programme — no other session has ever successfully reached `rsee.ir` or
  any other RSEE-adjacent page. Establishes: RSEE is a reservation *facilitator* (explicit about not
  being a venue itself), web app plus mobile app, diner searches by location, sees the venue's
  "menu/amenities/reviews/hours," picks a specific table and time slot, books up to one week ahead;
  claims **"۲۰۰۰+"** partner cafes/restaurants; the chair-credit ("آرسی") prepay-to-book mechanic
  with 50–100% forfeiture on late cancellation; three published restaurant-side plans; `/plans`,
  `/rules`, `/faq` all HTTP 404 `[fetched — negative result]`.
- `docs/audit/research/corpus/rsee/business.md` (2026-09-07, earlier same day) — pricing/terms mode.
  Confirms the diner-side package price in Toman has **never** been found by any session, that
  package purchase being mandatory vs. optional remains unresolved (verbatim uses *«می تواند»* —
  *can*, not *must*), and that the 100%/50%/0% cancellation-refund tiers are `[search]`-tier only,
  never independently fetched from a rules page.
- `docs/audit/research/corpus/rsee/store-reviews.md` (2026-09-07) — confirms `reviews_read = 0` for
  RSEE across every session to date, no app-store listing ever located, and already contributes a
  first feature-verification table (table-level booking = CLAIMED; chair-credit mechanic = REAL as a
  site-content fact; cancellation tiers = CLAIMED; mobile app = UNKNOWN; independent review presence
  = ABSENT-leaning). **This file adopts and extends that table rather than re-deriving it from
  scratch**, and does not contradict any row in it.
- `docs/audit/research/corpus/rsee/social.md` (2026-09-07) — confirms zero social/forum presence
  ever found (Twitter/X, Telegram, Instagram, Reddit, Persian forums, LinkedIn all UNKNOWN — neither
  confirmed present nor confirmed absent), and that restaurant-owner-side commentary on fees,
  payouts, support, or exclusivity has never been located.
- `docs/audit/research/corpus/rsee/scale.md` (2026-09-07) — confirms install bands, MAU, traffic,
  funding, headcount, and job postings are all UNKNOWN, and independently reproduced the network
  block at the raw-TLS-CONNECT layer (`curl` exit 56, HTTP 403 on CONNECT) — the block is enforced
  at the proxy, not inside any one tool.
- `docs/audit/research/MATRIX.md` footnote 56 and every RSEE cell in the three capability tables
  ("Reservation & commercial-terms," "Loyalty & rewards-mechanics," "Trust, notification &
  platform-hygiene") — cross-checked below, row by row, against this file's own findings.
- `docs/audit/research/ANTI-PATTERNS.md` §"RSEE" and `PARITY-RISK.md` §1/§"What NOT to copy" —
  RSEE's diner-pays-to-book mechanic already flagged there as the worst money-respect finding in the
  whole research programme; restated here only where it bears directly on a specific feature row
  (deposits/prepay, cancellation display), not re-litigated in full.
- `docs/audit/research/STATUS-2026-09-07.md` (Persian status digest, written before this session) —
  lists "resolve whether RSEE's package purchase is mandatory" as open priority #2 and "find an
  independent review corpus for RSEE" as open priority #1. Both remain open after this session.

**No contradiction with any prior file was found.** Every RSEE fact in this research programme traces
to exactly one fetch event (`rsee.ir` root, 2026-09-05, by a prior Scout session) plus one
`[search]`-tier pass the same day for the cancellation percentages. This file's job is to reorganize
that single evidence base against the feature-inventory checklist this task was assigned, mark each
row's evidence tier honestly, and name every gap precisely rather than paper over it with inferred
detail.

## Methodology — this session's own tool tests (done before trusting anything below)

**First action, per protocol:** `WebFetch` tested against a neutral control, then against the primary
target for this mode (`rsee.ir` itself, since the feature inventory needs the product's own UI copy).

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `WebFetch` | `https://rsee.ir` | Primary target — full feature/UI copy sweep | `EGRESS_BLOCKED` |
| 3 | `WebSearch` | `rsee.ir آرسی رزرو میز نظرات` | Fallback #1 | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| 4 | `WebSearch` | `آرسی رزرو رستوران اپلیکیشن دانلود کافه بازار` | Fallback #2 (app-store discovery angle) | Rejected: identical "200 of 200" message |

To independently confirm this was a real network condition and not a tool-side artifact, the
environment's own documented diagnostic was run:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status" -o proxy-status.json ; echo "EXIT:$?"
EXIT:0
```

`recentRelayFailures` in that response (5 entries, all `kind: "connect_rejected"`, all
`detail: "gateway answered 403 to CONNECT (policy denial or upstream failure)"`):
`cafebazaar.ir:443` and `myket.ir:443` and `play.google.com:443` and `example.com:443` (all
`2026-09-07T05:57:17–18Z`, from an earlier same-day session's diagnostic run) plus
`rsee.ir:443` (`2026-09-07T06:48:00.928Z`, from the `scale.md` session's raw-curl bypass). This
session's own `WebFetch` calls above did not add a new timestamped entry to the capped log, but
returned the identical structured `EGRESS_BLOCKED` error type directly, which is the authoritative
signal per the tool's own contract — the log is a corroborating, capped diagnostic, not the primary
evidence.

**Conclusion: `webfetch_worked = false` for this session.** The `WebSearch` "200 of 200" exhaustion
message is identical, character-for-character, to the message every one of the four prior same-day
RSEE sessions received — strong evidence this is a shared, account/programme-wide budget (the task
brief states many Scout sessions write to this repo concurrently) rather than a per-session counter
that has now independently hit zero five times in one day by coincidence.

**What this means for this file, honestly:** every feature fact below labeled `[fetched]` was read
directly from `rsee.ir` by a **prior** Scout session, dated 2026-09-05 — not by this session. I cite
that session's evidence accurately, at its original date and tier, not as something re-verified
today. This session's own contribution is: (a) confirming the tooling gap persists for RSEE on
2026-09-07 for a fifth consecutive attempt, (b) reorganizing every scattered feature-relevant fact
across `iran-reservation-longtail.md` and the four same-day `corpus/rsee/*.md` files into the single
checklist this task's mode requires, with each row's evidence tier stated explicitly and separately
from every other row (per-row honesty, not one blanket "mostly unknown" verdict), and (c) naming
exactly which screens, taps, and settings no session has ever actually seen — which is most of them.

## Reviews read this session: 0

No review, screenshot, screen-recording, or first-hand account of using RSEE's product (diner or
restaurant side) has ever been read by any Scout session. Every feature claim in this file rests on
either (a) RSEE's own marketing/product-description copy on its root page, fetched once, or (b) a
`[search]`-tier synthesis of some other page's snippet. **Zero** entries in this file come from
watching the product actually work.

---

## 1. Feature inventory — user-facing (diner side)

Per the task's taxonomy: **REAL** (seen working, or a recent dated independent source confirms it) /
**CLAIMED** (marketing copy only, not independently confirmed) / **UNKNOWN** (looked, couldn't
confirm either way) / **ABSENT** (looked directly, confirmed not there).

### 1.1 Booking flow — steps, screens, taps

**CLAIMED.** No screenshot, screen-recording, or step-by-step UI trace of RSEE's booking flow has
ever been captured by any session — everything below is a paraphrase of `rsee.ir`'s own product
description, not a verbatim quote of on-screen copy, and not an observed sequence of taps.

Per `profiles/iran-reservation-longtail.md` §"What it is" (paraphrase of `[fetched]` 2026-09-05
content, RSEE's own words not directly quoted for this specific sentence): diner searches by
location → sees the venue's menu/amenities/reviews/hours → picks a specific table and a time slot →
books up to one week ahead. Where in this sequence the chair-credit package purchase happens
(before browsing, at table-selection, or at final confirmation) is **never stated** in any source —
this is a real gap, not an oversight: the two mechanics (browse-and-pick vs. buy-a-package) are each
independently `[fetched]`-confirmed to exist, but their **relative order in the actual flow** has
never been described by any page any session has read.

- **Step count:** UNKNOWN — not verified. No source enumerates discrete screens or steps.
- **Maximum advance-booking window:** CLAIMED — "up to one week ahead," `rsee.ir` `[fetched]`
  2026-09-05 (paraphrase; exact Persian wording for this specific claim was not captured verbatim by
  the fetching session).

### 1.2 Table-level selection (vs. time-slot-only)

**CLAIMED.** Per `store-reviews.md`'s own feature table (2026-09-07): "Marketing copy only, `rsee.ir`
`[fetched]` 2026-09-05, prior session — no independent review confirms diners actually experience
table-level selection." This file adopts that exact status unchanged. The claim itself — that RSEE
lets a diner pick a *specific table*, not merely a time slot — is structurally plausible given the
chair-credit unit ("هر آرسی معادل یک صندلی از یک میز" — each ARSEE equals one chair *of one table*),
which only makes sense as a pricing unit if a specific table (and its chair count) is being selected.
That internal consistency is evidence of coherence, not independent confirmation.

### 1.3 Waitlist

**UNKNOWN — not verified.** No page reached by any session (root, or the confirmed-404 `/plans`,
`/rules`, `/faq`) has ever described a waitlist, standby queue, or "notify me when a table opens"
mechanic for RSEE, in either direction. Not searched with a dedicated query in any session to date —
genuinely unattempted, not attempted-and-failed.

### 1.4 Deposits / prepay

**REAL** — the single most solidly evidenced feature in this entire corpus, and the one every other
Iran-tier document in this research programme (`WATCH.md`, `ANTI-PATTERNS.md`, `PARITY-RISK.md`,
`business.md`) already treats as settled fact. Verbatim, `[fetched]` `rsee.ir` 2026-09-05:

> **"جهت انجام رزرو میز کافه/رستوران، کاربر می تواند اقدام به خرید بسته نماید"**
> ("To make a cafe/restaurant table reservation, the user can proceed to buy a package")

> **"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک صندلی از یک میز می باشد"**
> ("Each reservation package contains a number of ARSEEs, and each ARSEE equals one chair from a
> table")

This is a prepay mechanic, not a refundable-hold deposit in the OpenTable/Resy sense — the credit is
purchased before booking and spent (partially forfeitable) on the act of booking itself. **What
remains unresolved:** whether purchase is *mandatory* for every booking (verbatim says *«می تواند»* —
**can**, not **must**) and the Toman price of a package (never found — see `business.md` §1).

### 1.5 Cancellation policy — display to the diner

**Two separate claims here, deliberately not merged, because their evidence tiers differ sharply:**

- **That a forfeiture policy exists at all:** REAL by strong inference from the chair-credit mechanic
  itself (`[fetched]`, §1.4) — a "package" that is "spent" per seat necessarily has *some* rule for
  what happens on cancellation.
- **The exact percentages (100%/50%/0% at >3h / 3h-to-slot / at-or-after):** `[search]`-tier only,
  2026-09-05, **never independently fetched from a rules/terms page** — `rsee.ir/rules` returned HTTP
  404 on the one direct-fetch attempt made. Downgrade this to CLAIMED, not REAL, when citing the
  specific numbers externally.
- **Whether/where this policy is displayed to the diner *before* they commit to booking (in-app, at
  what screen):** UNKNOWN — not verified. No source describes the actual disclosure UX — only that a
  package must be bought before a table can be held, which places the money commitment structurally
  *before* any explicit per-reservation terms screen might appear. `MATRIX.md`'s dedicated row for
  this exact question across all competitors marks RSEE **ABSENT** — "the charge *is* the booking
  act; 50–100% forfeited on late cancellation" — treating the structural fact (charge precedes
  confirmed use) as the answer to "is a charge enforceable before being displayed," which is a
  different question from "is a cancellation-policy screen shown." This file flags that distinction
  explicitly: MATRIX answers the money-transparency question; this file's narrower UX question (is
  there a discrete policy-display screen) remains genuinely UNKNOWN.

### 1.6 Loyalty — earn / tiers / expiry / redeem / referral / streaks / birthday

**ABSENT-leaning, not confirmed ABSENT.** No loyalty, points, tier, badge, referral, streak, or
birthday-reward mechanic of any kind has been found on any page reached by any session, across five
independent same-day and cross-day passes. `business.md` §7 already reaches this same conclusion
("UNKNOWN — not verified, leaning toward ABSENT... not yet performed" for a targeted search).
`MATRIX.md`'s loyalty-mechanics table omits RSEE as a column entirely with the explicit footnote:
*"RSEE has no loyalty column... not found, not confirmed absent."* This file does not upgrade that
to a hard ABSENT — the pages most likely to disclose a loyalty program (`/rules`, `/faq`) are
confirmed-404, and no dedicated loyalty-keyword search (`آرسی امتیاز`, `آرسی باشگاه مشتریان`,
`آرسی معرفی دوستان`) has ever been run with working tools. Sub-mechanics, all UNKNOWN individually
for the same reason: earn rate, tier thresholds, expiry clock, redemption minimum, referral bonus,
streak mechanic, birthday reward.

### 1.7 Notifications and opt-out controls

**UNKNOWN — not verified.** No source describes SMS, push, or email notification behavior for RSEE
in either direction (booking confirmations, reminders, cancellation notices, marketing messages) —
nor any opt-out/preference control. `MATRIX.md`'s "SMS/OTP fail-closed" row for RSEE is itself
UNKNOWN. Genuinely un-investigated: no session has ever attempted a signup flow (impossible without
working `WebFetch`) that would surface this.

### 1.8 Reviews / photos / social (in-product, for diner discovery)

**CLAIMED.** Per the same paraphrase source as §1.1: the diner-facing venue page shows
"menu/amenities/reviews/hours" before booking — implying RSEE hosts or aggregates restaurant reviews
as part of its own discovery surface, structurally comparable to Foodism's discovery-first model
(`profiles/foodism.md`) rather than SmartX's B2B-only posture. **Not independently confirmed**: no
session has read an actual RSEE-hosted restaurant review, so whether these are RSEE-native
user-generated reviews, imported third-party ratings, or restaurant-self-reported content is
UNKNOWN. Photos are not explicitly mentioned in any source — UNKNOWN whether the venue page shows
photo galleries. No evidence either way on whether *diners* can leave reviews of restaurants through
RSEE, or whether reviews are read-only.

### 1.9 Languages / RTL / Persian digits

**CLAIMED.** Persian-first by construction — every verbatim quote captured from `rsee.ir` across all
five sessions is in Persian, and it is an Iranian domestic product. `MATRIX.md`'s dedicated row:
*"CLAIMED — Persian-first by construction (an Iranian site); font hosting not inspected."* This file
adds nothing beyond that — whether digits render as Persian (۰-۹) vs. Latin (0-9) numerals
consistently, and what font is served (self-hosted vs. a CDN dependency — material given this
programme's own constitution bars Google Fonts for exactly this reason, since it is unreachable from
Iran), has **never been inspected** for RSEE by any session. Genuinely unattempted, not
attempted-and-inconclusive.

### 1.10 Accessibility

**UNKNOWN — not verified.** No session has ever assessed touch-target sizing, screen-reader
compatibility, keyboard focus behavior, or color contrast for any RSEE surface. Not searched, not
fetched, not inferred from any indirect source.

### 1.11 Offline behaviour

**UNKNOWN — not verified.** No session has ever tested or found any description of how RSEE's web
app or mobile app behaves without connectivity (e.g., a cached-view fallback, an offline error
state, or a PWA-style service-worker cache). Not investigated in any prior pass.

---

## 2. Feature inventory — restaurant-facing

### 2.1 CRM / segmentation / tags

**UNKNOWN — not described on any page reached.** `MATRIX.md`'s dedicated row for "Restaurant CRM /
cross-visit guest recognition" records RSEE as exactly this: UNKNOWN, distinct from Fidilio,
SmartX, SevenRooms and TheFork's rows (all of which have at least a CLAIMED or REAL entry from a
pitch page or case study). No RSEE page describing guest history, tagging, notes, or repeat-visit
recognition for restaurant staff has ever been found.

### 2.2 Marketing automation

**UNKNOWN — not verified.** Never found, never searched with a dedicated query in any session.

### 2.3 POS / payment integrations

**UNKNOWN — not verified**, with one internal-consistency note: the diner-side chair-credit purchase
(§1.4) necessarily runs through *some* payment processor to convert Toman into ARSEE credit, but
**no session has ever identified which one** — no page names Zarinpal, a bank gateway, or any other
processor for RSEE, in contrast to this repository's own documented Zarinpal integration
(`api/lib/zarinpal.ts`) or Sepidz's explicit POS-bundling (`profiles/iran-reservation-longtail.md`
§"سپیدز / Sepidz"). Whether RSEE integrates with any restaurant POS system for order/table-status
sync is likewise never mentioned in any source.

### 2.4 Restaurant-side settings / toggles — what the RESTAURANT can configure

**This entire sub-section is UNKNOWN — not verified, and the gap is total, not partial.** No session
has ever reached an RSEE restaurant dashboard, admin panel, or settings screen of any kind — the only
restaurant-facing surface any session has ever seen is the three-tier **pricing** page (§3 below),
which describes cost and duration, not product capability. Specifically UNKNOWN, all of them:

- Whether a restaurant can toggle table-level layout/floor-plan configuration itself, or whether RSEE
  configures it on the restaurant's behalf.
- Whether a restaurant can set its own cancellation-window/forfeiture percentages, or whether the
  100%/50%/0% tiers (themselves only `[search]`-tier confirmed, §1.5) are platform-wide and
  non-configurable per venue.
- Whether a restaurant can require, waive, or adjust the chair-credit price per venue, per table size,
  or per time slot (e.g., a premium Friday-night rate) — no page ever describes diner-side pricing
  varying by anything.
- Whether a restaurant can configure notification templates, opening hours, blackout dates, or
  party-size limits.
- Whether Plan 1/2/3 (§3) unlock *different product capability*, or only differ in price/duration —
  `business.md` §1 already flags this exact gap: *"No feature-comparison matrix across the three
  plans... was captured by the 2026-09-05 fetch or by any session since."*

**Contrast, stated plainly for the audit line:** Rezervno's own `withRestaurantAuth`/`withStaffAuth`
architecture (`CLAUDE.md`, `lib/with-restaurant-auth.ts`) and permission-scoped settings model is a
known, code-verifiable REAL capability on Rezervno's side. Whether RSEE offers anything comparably
granular for restaurant self-configuration cannot be stated in either direction — it is not that RSEE
is confirmed to lack these controls, it is that **no session has ever seen an RSEE restaurant
dashboard at all**, so there is nothing to compare against except silence.

---

## 3. Restaurant-side pricing (context for §2.4, not re-derived — see `business.md` for the full
mode-specific treatment)

| Plan | Price `[fetched]` 2026-09-05 | Term |
|---|---|---|
| پلن ۱ (پایه / Basic) | **رایگان** (free) | ۴ ماه (4 months) |
| پلن ۲ (حرفه‌ای / Professional) | **۹۹۰,۰۰۰ تومان** | ۱۲ ماهه (12 months) |
| پلن ۳ (کامل / Complete) | **۲,۹۹۰,۰۰۰ تومان** or **۳,۹۹۰,۰۰۰ تومان** | ۶ ماه or ۱۲ ماه respectively |

Currency: Toman throughout, no Rial figure or ambiguity found. No feature-differentiation across the
three tiers has ever been captured — this table describes cost, not capability.

---

## 4. Consolidated feature-status table

| Feature | Status | Evidence |
|---|---|---|
| Booking flow (browse → select → book) | CLAIMED | Paraphrase of `rsee.ir` `[fetched]` 2026-09-05; no screen-by-screen trace, no step count |
| Table-level selection (not just time-slot) | CLAIMED | `rsee.ir` `[fetched]` 2026-09-05; internally consistent with the per-chair pricing unit, but not independently confirmed |
| Waitlist | UNKNOWN | Never described in any source; never searched |
| Deposits / prepay (chair-credit) | **REAL** | Verbatim quoted, `[fetched]` `rsee.ir` 2026-09-05 — the best-evidenced row in this file |
| Package purchase mandatory for every booking | UNKNOWN | Verbatim says *«می تواند»* (can), not *«باید»* (must); no resolving statement found |
| Diner package price (Toman) | UNKNOWN | Never found by any session — largest pricing gap, see `business.md` §1 |
| Cancellation forfeiture policy exists | REAL (inferred) | Structural consequence of the chair-credit mechanic itself, `[fetched]` |
| Cancellation exact percentages (100/50/0) | CLAIMED | `[search]` only, 2026-09-05, never fetched from a rules page (`/rules` 404) |
| Cancellation-policy display UX (where/when shown) | UNKNOWN | Never described in any source |
| Loyalty (earn/tiers/expiry/redeem/referral/streak/birthday) | ABSENT-leaning | Not found across 5 sessions; pages most likely to state it are 404 |
| Notifications + opt-out controls | UNKNOWN | Never described in any source |
| In-product restaurant reviews/photos for diner discovery | CLAIMED | Paraphrase ("menu/amenities/reviews/hours"), `rsee.ir` `[fetched]` 2026-09-05; photos never explicitly mentioned |
| RTL / Persian-first UX | CLAIMED | All captured copy is Persian; an Iranian domestic product by construction |
| Self-hosted fonts / Persian digit rendering | UNKNOWN | Never inspected |
| Accessibility (touch targets, screen reader, focus) | UNKNOWN | Never assessed |
| Offline behaviour | UNKNOWN | Never assessed |
| Restaurant CRM / guest recognition | UNKNOWN | Not described on any page reached |
| Marketing automation | UNKNOWN | Never found, never searched |
| POS / payment-gateway integration | UNKNOWN | No processor ever named; existence of *some* processor inferred, identity unknown |
| Restaurant-side configurable settings (any) | UNKNOWN — total gap | No dashboard/admin screen of any kind has ever been reached by any session |
| Restaurant plan price differentiation by capability | UNKNOWN | Three plans priced and dated; no feature matrix across them ever found |
| Mobile app (distinct from web app) | UNKNOWN | Site claims "web app plus mobile app"; no app-store listing ever located to confirm independently |
| Independent third-party review/social footprint | ABSENT-leaning | Zero found across app stores, social media, forums, in 5 dedicated sessions — `MATRIX.md` marks this row **ABSENT** outright |

---

## What I did NOT verify (this session)

- **No RSEE page was opened or searched this session.** `WebFetch` returned `EGRESS_BLOCKED` for
  both the neutral control and `https://rsee.ir`; `WebSearch` returned the same "200 of 200"
  budget-exhaustion notice on both queries attempted. Everything in this file is a prior session's
  evidence (2026-09-05), accurately re-dated and re-cited at its original tier — nothing here was
  re-verified today.
- **The exact sequence of RSEE's booking flow** (does package purchase happen before or after table
  selection; how many discrete screens; what a "step" looks like) was never captured by any session,
  because no session has ever seen the product's actual UI, only its own marketing description.
- **The diner package price in Toman** — still the single largest unresolved gap in the whole RSEE
  research line, unchanged by this session (see `business.md` §1 for the full treatment).
- **Whether package purchase is mandatory** — unresolved, verbatim remains *«می تواند»*.
- **Every restaurant-side settings/toggle question in §2.4** — a total gap, not a partial one; no
  session has ever reached an RSEE restaurant dashboard of any kind.
- **Loyalty, notifications, CRM, marketing automation, POS integration, accessibility, and offline
  behaviour** — none has ever been confirmed present or absent by direct observation; all rest on
  either a structural inference or an honest "never investigated."
- **Whether RSEE has a mobile app** distinct from its web app remains unconfirmed — no app-store
  listing has ever been located (see `store-reviews.md`, `scale.md`).

## Sources

**Tested this session (2026-09-07), all unavailable:**
- `WebFetch`: `https://example.com` (control, `EGRESS_BLOCKED`); `https://rsee.ir` (primary target
  for this mode, `EGRESS_BLOCKED`).
- `WebSearch`: `rsee.ir آرسی رزرو میز نظرات` (rejected — 200/200 budget exhausted);
  `آرسی رزرو رستوران اپلیکیشن دانلود کافه بازار` (rejected — identical message).
- Proxy diagnostic: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code `0` — confirmed
  `connect_rejected` / "gateway answered 403 to CONNECT" for `cafebazaar.ir:443`, `myket.ir:443`,
  `play.google.com:443`, `example.com:443` (05:57:17–18Z, prior same-day session) and `rsee.ir:443`
  (06:48:00.928Z, prior same-day session's raw-curl bypass).

**Cited from prior sessions, not re-verified this session:**
- [rsee.ir](https://rsee.ir/) — root page, `[fetched]` 2026-09-05 by a prior Scout session. Sole
  source for every feature/UI fact in this file: the chair-credit verbatim quotes, the
  browse→select→book paraphrase, the "menu/amenities/reviews/hours" venue-page description, the
  "web app plus mobile app" claim, and the "۲۰۰۰+" venue claim.
- `rsee.ir/plans`, `rsee.ir/rules`, `rsee.ir/faq` — all `[fetched — negative result, HTTP 404]`,
  2026-09-05.
- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE" — full first-hand
  write-up this file is built from.
- `docs/audit/research/corpus/rsee/business.md` (2026-09-07) — pricing/terms mode, same-day.
- `docs/audit/research/corpus/rsee/store-reviews.md` (2026-09-07) — store-reviews mode, same-day;
  contributed the first feature-verification table this file extends.
- `docs/audit/research/corpus/rsee/social.md` (2026-09-07) — social/forums mode, same-day.
- `docs/audit/research/corpus/rsee/scale.md` (2026-09-07) — users/sales/scale mode, same-day;
  independently reproduced the network block at the raw-TLS-CONNECT layer.
- `docs/audit/research/MATRIX.md` footnote 56 and every RSEE cell across the three capability
  tables — cross-checked row by row above.
- `docs/audit/research/ANTI-PATTERNS.md` §"RSEE" and `PARITY-RISK.md` §1 / "What NOT to copy."
- `docs/audit/research/WATCH.md` 2026-09-05 entry.
- `docs/audit/research/STATUS-2026-09-07.md` — same-day status digest, open priorities #1 and #2.
