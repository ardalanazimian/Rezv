# SmartX — Business Model, Pricing, Terms (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_
_Mode: BUSINESS MODEL, PRICING, TERMS_

## Prior art read first (per task instructions)

Read in full before writing anything below:
- `docs/audit/research/profiles/smartx.md` — base profile (2026-09-04, `WebSearch`-only) +
  2026-09-05 ADDENDUM (first-hand `WebFetch` corrections to pricing and the `/sorry/` page).
- `docs/audit/research/corpus/smartx/store-reviews.md` (2026-09-07, written earlier the same day by
  a concurrent Scout session) — confirms `reviews_read = 0` for SmartX across all sessions to date,
  and that both `WebFetch` and `WebSearch` were unavailable to that session.
- `docs/audit/research/WATCH.md`, `docs/audit/research/MATRIX.md`,
  `docs/audit/research/PARITY-RISK.md`, `docs/audit/research/ANTI-PATTERNS.md`,
  `docs/audit/research/proposals/003-transparent-restaurant-terms.md`,
  `docs/audit/research/profiles/iran-reservation-longtail.md`,
  `docs/audit/research/recon-notes-global.md` — all contain SmartX pricing/terms material scattered
  across files; this corpus consolidates it under the pricing/terms mode specifically and adds
  nothing that contradicts any of them.

**This file extends, not repeats, that prior art.** No contradiction with prior research was found.
One internal contradiction *within SmartX's own site* (documented below, already flagged by the
2026-09-05 session) is preserved verbatim rather than resolved, per task instructions.

## Methodology — this session's own tool tests (do this before trusting anything below)

**First action, per protocol:** `WebFetch` tested against a neutral control and then the primary
target for this mode.

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `WebFetch` | `https://smartx.ir/pricing/` | Primary target for this mode (pricing) | `EGRESS_BLOCKED` |
| 3 | `WebSearch` | `smartx.ir pricing قیمت رزرو هوشمند تومان` | Pricing fallback | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| 4 | `WebSearch` | `"smartx.ir" terms of service قوانین` | Terms/ToS fallback | Rejected: same budget-exhaustion message |

**`webfetch_worked = false`.** `WebSearch` was also unavailable — not `EGRESS_BLOCKED` like
`WebFetch`, but a **session-wide budget already at 200/200 before this task's first query executed**.
Per the brief, other Scout sessions write to this repository concurrently, and (per
`corpus/smartx/store-reviews.md`, written earlier the same calendar day) at least one other
concurrent session hit the identical exhaustion message. This is consistent, not contradictory,
across both sessions dated 2026-09-07: **neither tool produced a single new byte of primary-source
data today.**

**What this means for this file, honestly:** every pricing figure, quote, and term below that is
labeled `[fetched]` was read directly from `smartx.ir` by a **prior** Scout session, dated
2026-09-05, not by this session — I am citing that session's first-hand evidence accurately, with
its own date, not re-presenting it as something I verified today. Everything labeled
`[search-synthesis]` was never fetched by any session — it is `WebSearch`'s indexed-snippet
paraphrase from the 2026-09-04 session, and remains at that weaker evidence tier. This session's
contribution is: (a) confirming the tooling gap persists on 2026-09-07, (b) consolidating every
pricing/terms fact already on file into one mode-specific corpus, organized against the task's own
checklist (plans/tiers, commission, per-cover fees, contract length/auto-renewal/exclusivity,
diner-side money, refund windows, loyalty redemption minimums, coupon funding, changelogs, ToS), and
(c) explicitly naming what remains unfound so a future session with working tools has a precise
target list rather than starting over.

## Reviews read this session: 0

No user review discussing SmartX's pricing, billing, refunds, or fees was read this session — none
has ever been read for SmartX in any Scout session to date (`corpus/smartx/store-reviews.md`
confirms 0/0 across three independent dated sessions: 2026-09-04, 2026-09-05, 2026-09-07). This
corpus therefore contains **zero** diner- or restaurant-owner-authored complaint/praise quotes about
money. Every figure below is company-published (pricing pages, self-description), not user-reported.

---

## 1. Plans / tiers / add-ons — exact figures, currency explicit

All figures are **Toman (تومان)**, never Rial, on every SmartX page found by any session — no
currency ambiguity found (contrast the constitution's Zarinpal/IRT-vs-Rial warning: SmartX states
its own prices in Toman directly, so no 10× conversion risk was found in the pricing copy itself).

### Model A — flat annual subscription per product line
Source: [smartx.ir/pricing/](https://smartx.ir/pricing/), fetched directly 2026-09-05 `[fetched]`.

| Product | Published annual price |
|---|---|
| ارزیابی هوشمند (Smart Evaluation / CSAT surveys) | ۳۳,۶۵۰,۰۰۰ تومان |
| باشگاه هوشمند (Customer Club) | ۵۱,۰۰۰,۰۰۰ تومان |
| **رزرو هوشمند (Smart Reservation)** | **۵۲,۸۰۰,۰۰۰ تومان** — see Contradiction #1 below |
| وای‌فای هوشمند, ۱۰ کاربر (Smart WiFi, 10-user tier) | ۲۱,۰۰۰,۰۰۰ تومان |
| بسته دو‌سرویسه (2-service bundle) | not individually re-extracted this session — see `profiles/iran-reservation-longtail.md` for the full bundle table |
| بسته سه‌سرویسه (3-service bundle) | ۱۰۱,۹۵۰,۰۰۰ تومان (≈۲۷۹,۰۰۰ تومان/day equivalent, as published) |
| مدیریت هوشمند رستوران (full 4-product bundle) | ۱۹۹,۲۵۰,۰۰۰ تومان/year (≈۵۴۶,۰۰۰ تومان/day equivalent, as published) |

### Model B — usage-based, published on the same page
Source: same, `[fetched]` 2026-09-05.

- Activation fee: **۲۹,۵۰۰,۰۰۰ تومان**
- Per-transaction fee: **۱۰,۰۰۰ تومان**
- Initial wallet/credit: **۴,۵۰۰,۰۰۰ تومان** (≈500 transactions at the per-transaction rate)
- **A 30% discount applies when 75%+ of a restaurant's invoices carry a captured customer phone
  number.** This is a cash incentive paid *to the restaurant* for maximizing phone-number capture
  rate — not a hidden mechanic, but a disclosed one; see "Diner-side money" and the constitution's
  Gen-Z-lens framing in the base profile for why disclosure ≠ acceptability.
- **Only intermediate volume bands route to a sales line** (۹۰۰۰-۰۱۱۲۳) — the pricing page is not
  100% self-serve, but the majority of the published structure is.

### Add-ons and hardware
- WiFi "coupon" add-on: **۳,۵۰۰,۰۰۰ تومان** — billing cadence (one-time vs. annual) was not resolved
  by the 2026-09-04 session and was not re-checked this session (`smartx.ir/other-expenses/`,
  `[search-synthesis]`, never fetched by any session). **UNKNOWN — not verified.**
- Payment-gateway setup for reservation prepayment: described as existing (setup fee + per-transaction
  fee) but **no Toman figure has ever been found by any session.** UNKNOWN — not verified.
- Hardware — RFID cards for Customer Club, MikroTik router for WiFi: described as required, **no cost
  figure has ever been found by any session.** UNKNOWN — not verified.
- SMS messaging: billed separately, pay-as-you-go, purchased inside the panel — **no per-SMS or
  per-package Toman figure has ever been found.** UNKNOWN — not verified.

### An unreconciled figure from the earliest (2026-09-04) pass
The original `WebSearch`-only session surfaced a second, lower WiFi-pricing range —
**۸,۱۴۰,۰۰۰–۲۵,۳۰۰,۰۰۰ تومان/year** — attributed to the same `smartx.ir/pricing/` URL, alongside a
tiered basic/advanced/"five-service" structure at **۳۳,۶۰۰,۰۰۰ / ۴۳,۰۰۰,۰۰۰ / ۶۷,۱۰۰,۰۰۰ تومان/year**
(`[search-synthesis]`, 2026-09-04). Neither of these two figures was reconfirmed, nor contradicted,
by the 2026-09-05 `[fetched]` pass, which recorded a *different* WiFi figure (۲۱,۰۰۰,۰۰۰ تومان for a
10-user tier) without addressing the earlier ones. **Three different WiFi-tier figures now exist
across sessions and none has been reconciled against the other two.** This is reported, not
resolved, per task instructions.

### Contradiction #1 — SmartX's own site disagrees with itself on the reservation product's price
Both fetched directly, 2026-09-05, `[fetched]`, neither endorsed over the other:

- [smartx.ir/pricing/](https://smartx.ir/pricing/): **رزرو هوشمند — ۵۲,۸۰۰,۰۰۰ تومان/year**
- [smartx.ir/services/reserve/restaurant/](https://smartx.ir/services/reserve/restaurant/):
  **۲۱,۴۵۰,۰۰۰ تومان/year** for the same product (Smart Reservation)

A **2.5× gap**, same company, same product, two live pages. Verbatim as recorded by the
2026-09-05 session; this session re-verified neither page (both `WebFetch` and `WebSearch` were
unavailable) and simply carries the contradiction forward unresolved.

---

## 2. Commission % and who pays it

**No per-booking or per-cover commission percentage has ever been found for SmartX**, in any
session. The entire published pricing structure (Model A and Model B above) is flat
subscription/activation/per-transaction-fee, billed to the **restaurant operator**, never to the
diner directly and never expressed as a % of a bill or reservation value. This differs structurally
from OpenTable/Resy-style per-cover fees and from RSEE's per-seat diner-paid credit model
(`profiles/iran-reservation-longtail.md`) — SmartX's revenue is 100% B2B subscription/usage fees, not
commission on transactions. **Who pays: the restaurant/café operator in every documented case.**

## 3. Per-cover / per-booking fees

The only per-unit fee found is Model B's **۱۰,۰۰۰ تومان per transaction** (see above) — this is
billed to the restaurant, drawn from its pre-purchased wallet, not itemized as a diner-facing
per-booking charge. **No per-cover fee (a fee scaled to party size / number of diners seated) was
found anywhere.** UNKNOWN whether one exists — not found, not ruled out.

## 4. Contract length, auto-renewal, exclusivity

- **Contract length:** the pricing tables above are denominated "/year" (annual), consistent across
  every session and every page. **No explicit auto-renewal clause, no explicit contract-length
  minimum (e.g., "12-month minimum term"), and no early-termination fee has ever been found or
  fetched.** This is a genuine gap, not an absence-confirmed-by-search: no session has reached a
  SmartX terms-of-service or contract page at all (see §8 below).
- **A specific, dated claim about a change in renewal terms exists but was never fetched — flag
  this clearly.** The 2026-09-04 `[search-synthesis]` pass paraphrased one of two retention-campaign
  pages, `smartx.ir/stay-strong/` or `smartx.ir/stay-strong-2/` (اردیبهشت/تیر ۱۴۰۴ ≈ June–July 2025,
  titled «کمپین قوی بمان» / «کمپین قوی بمان ۲»), as *"introducing a move to quarterly renewal
  terms"* alongside a "no service interruptions" promise for a stated window. **This was never
  independently fetched by the 2026-09-05 session** — that session's `[fetched]` pass covered only
  `/pricing/`, `/sorry/`, and `/services/reserve/restaurant/`, not either `/stay-strong/` page. So the
  "quarterly renewal terms" claim sits at the weakest evidence tier in this entire corpus:
  paraphrase-of-a-paraphrase, one hop removed from the primary source, never verified verbatim.
  **UNKNOWN whether this quote is accurate — flagged for a future session to fetch `smartx.ir/stay-strong/`
  and `smartx.ir/stay-strong-2/` directly before citing this claim anywhere load-bearing.**
- **Exclusivity clause:** no exclusivity/"primary system of record" language (of the kind OpenTable
  adopted in April 2026, per `profiles/opentable-resy-sevenrooms.md`) has ever been found for SmartX,
  in either direction — not confirmed absent, simply never reached. `proposals/003` already treats
  this as an open comparison point. **UNKNOWN — not verified**, not ABSENT.

## 5. Diner-side money: deposits, no-show/cancellation fees, when shown

**This is the single largest gap in SmartX's documented business model, and it was not closed this
session.** Specifically:

- The Smart Reservation product is described (marketing copy only, `[search-synthesis]`,
  2026-09-04) as supporting "online prepayment/deposit for reservations" — status: **CLAIMED**, never
  demonstrated live, no deposit amount, percentage, or trigger condition ever found.
- **No no-show fee has ever been found for SmartX specifically.** This must not be confused with
  RSEE (`profiles/iran-reservation-longtail.md`) — a *different* Iranian company — whose own site
  states diner cancellation forfeiture in plain terms (100% refund >3h before, 50% between 3h and the
  slot, 0% after) and whose currency unit is the seat-denominated "آرسی." **That policy belongs to
  RSEE, not SmartX; conflating the two would be a fabrication.** For SmartX itself: UNKNOWN — not
  verified, no page describing a diner-facing cancellation or no-show fee has ever been reached.
- **Whether a charge is shown to the diner before it becomes enforceable is UNKNOWN for SmartX.**
  This is exactly the MATRIX row "A money charge cannot become enforceable before it is displayed to
  the diner," and SmartX's cell there reads `UNKNOWN` for the same reason — no live prepayment flow
  has ever been observed by any session.

## 6. Refund windows

**UNKNOWN — not verified.** No refund-policy page, refund percentage, or refund-window duration
(hours/days) has ever been found for SmartX, for either the restaurant-side subscription or any
diner-side prepayment. Not found ≠ confirmed absent — no ToS/refund page was ever reached to check.

## 7. Loyalty redemption minimums

**UNKNOWN — not verified.** The Customer Club (باشگاه مشتریان) product is described only at the
mechanic level: RFM-style segmentation, coupons, a gamified "wheel of fortune" add-on, churn-risk
flags, multi-branch reporting (`smartx.ir/services/club/`, `[search-synthesis]`, 2026-09-04). No
points-to-Toman conversion rate, no minimum-balance-to-redeem threshold, and no expiry clock has ever
been found or fetched — contrast TheFork's YUMS, which has all three publicly and precisely stated
(`profiles/thefork.md`; 100 pts/booking, 1000 = £20 off, "valid for one year, exchangeable until
month-end"). SmartX publishes no equivalent mechanics page that any session has located.

## 8. Coupon / discount funding — platform vs. restaurant

**Inferred, not directly confirmed: the restaurant funds its own coupons/discounts; SmartX supplies
only the platform/mechanic.** Basis for this inference: `MATRIX.md`'s loyalty-capabilities row marks
SmartX `N/A (B2B; loyalty is the *restaurant's*, not SmartX's own)` for "native, in-house diner
loyalty" — i.e., SmartX is infrastructure a restaurant uses to run *its own* branded loyalty program,
the same structural position as SevenRooms/Servme in the global set, as distinct from TheFork (whose
YUMS is TheFork's own platform-funded currency, redeemable as a discount TheFork itself absorbs). No
page states in explicit words "the restaurant funds every coupon issued through Customer Club" — this
is a structural inference from the product's category (CRM/marketing infrastructure sold to
operators) plus the absence of any SmartX-branded, cross-restaurant redemption currency anywhere in
the research to date. **Labeled CLAIMED/inferred, not REAL**, because no page was ever found stating
this in so many words.

## 9. Changelogs / release notes

**No dedicated changelog or release-notes page has ever been found for SmartX.** The closest
analogue is the `/sorry/` page's retention-style promise of **"سه ویژگی رایگان جدید این هفته"**
("three new free features this week") — but this line comes from the 2026-09-04
`[search-synthesis]` pass and was **not** among the content the 2026-09-05 `[fetched]` session
confirmed verbatim in the page body; that session confirmed only the `<title>`
(«اختلالات باشگاه مشتریان | مرداد ماه ۱۴۰۴»), the `h1` («ما خودمان را مدیون اعتماد شما می دانیم.»),
and three section headers («خبرهای خوبی در راه است», «درخواست پشتیبانی», «معرفی سرویس های جدید») —
see next section for the exact wording each fetch pass returned. The "three new features" specific
text is plausible (it would sit under the «خبرهای خوبی در راه است» heading) but **was never quoted
verbatim by the fetch session**, so it is downgraded here to `[search-synthesis]`, unconfirmed at
first-hand, rather than presented as settled.

## 10. Terms-of-service pages

**Never found, never fetched, by any session to date.** No `smartx.ir/terms/`, `/privacy/`,
`/rules/`, `/agreement/`, or equivalent path has ever appeared in any search result or fetch across
three dated sessions (2026-09-04, 2026-09-05, 2026-09-07). This is the most actionable concrete gap
in this corpus: a future session with working `WebFetch` should try those paths directly (the way
`profiles/iran-reservation-longtail.md` tried `rsee.ir/rules` and got a 404, which is itself useful
evidence) rather than relying on search.

---

## The `/sorry/` page — full detail, both fetch attempts reported (task's own falsifiability rule)

Reproduced here in full because it is this corpus's single strongest reliability/trust signal
touching the business relationship (a company's own account of a service disruption during an active
annual-subscription relationship), and because the constitution's rule #3 ("a single negative
WebFetch result is not evidence of absence") applies directly to it.

- **First fetch (2026-09-05), prompt asking "what incident is being apologised for":** returned *"there
  is no apology or incident on this page."*
- **Second fetch (2026-09-05), same URL, prompt asking for the `<title>` and every heading verbatim:**
  returned **`<title>` = «اختلالات باشگاه مشتریان | مرداد ماه 1404»** (Customer Club disruptions,
  Mordad 1404 ≈ 2025-07-23 to 2025-08-22); **`h1` = «ما خودمان را مدیون اعتماد شما می دانیم.»**
  ("We consider ourselves indebted to your trust."); section headers **«خبرهای خوبی در راه است»**
  ("Good news is on the way"), **«درخواست پشتیبانی»** ("Support request"), **«معرفی سرویس های جدید»**
  ("Introducing new services").
- **Verdict, carried forward unchanged from `profiles/smartx.md`'s addendum:** the *title* is a
  genuine self-admission that a named disruption occurred in a named month; the *body*, as fetched,
  contains no description of what happened, no explicit apology sentence, and no remedy/credit
  amount — only forward-looking goodwill language. Status: **REAL (title-level admission only)**, not
  a full incident postmortem.
- Source: [smartx.ir/sorry/](https://smartx.ir/sorry/), both fetches `[fetched]` 2026-09-05, not
  re-fetched this session (tooling unavailable).

---

## Consolidated pricing/terms table (all evidence tiers shown together)

| Item | Value | Evidence tier | Source, date |
|---|---|---|---|
| Currency | Toman (تومان) throughout, never Rial | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Smart Reservation | ۵۲,۸۰۰,۰۰۰ تومان/yr (pricing page) **vs.** ۲۱,۴۵۰,۰۰۰ تومان/yr (product page) — unresolved 2.5× contradiction | `[fetched]` (both figures) | smartx.ir/pricing/ + smartx.ir/services/reserve/restaurant/, 2026-09-05 |
| Customer Club (base) | ۵۱,۰۰۰,۰۰۰ تومان/yr (2026-09-05 figure) — earlier session recorded ۳۳,۵۰۰,۰۰۰–۴۳,۰۰۰,۰۰۰ تومان/yr for "base tier + add-ons" | `[fetched]` (newer) / `[search-synthesis]` (older, unreconciled) | smartx.ir/pricing/, 2026-09-05 vs. 2026-09-04 |
| Smart Evaluation (CSAT) | ۳۳,۶۵۰,۰۰۰ تومان/yr | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Smart WiFi | ۲۱,۰۰۰,۰۰۰ تومان/yr (10-user, 2026-09-05) — vs. THREE other unreconciled figures from 2026-09-04 (۸.14M–25.3M range; and a 33.6M/43M/67.1M tiered set) | `[fetched]` (newest) / `[search-synthesis]` (older, three-way unreconciled) | smartx.ir/pricing/, both dates |
| 3-service bundle | ۱۰۱,۹۵۰,۰۰۰ تومان/yr | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Full 4-product bundle | ۱۹۹,۲۵۰,۰۰۰ تومان/yr | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Usage-based: activation | ۲۹,۵۰۰,۰۰۰ تومان | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Usage-based: per-transaction | ۱۰,۰۰۰ تومان | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| Usage-based: phone-capture discount | 30% off if ≥75% of invoices carry a customer phone number | `[fetched]` | smartx.ir/pricing/, 2026-09-05 |
| WiFi coupon add-on | ۳,۵۰۰,۰۰۰ تومان, cadence unclear | `[search-synthesis]`, never fetched | smartx.ir/other-expenses/, 2026-09-04 |
| Commission % | None found — flat subscription/usage-fee model only | absence, all sessions | — |
| Per-cover fee | None found beyond the flat per-transaction fee above | absence, all sessions | — |
| Contract length | Annual, by pricing-table denomination only; no ToS confirms a minimum term | inferred from pricing labels | smartx.ir/pricing/, 2026-09-05 |
| Auto-renewal clause | Never found | UNKNOWN | — |
| "Quarterly renewal terms" claim | Unverified, one hop from primary source | `[search-synthesis]`, never fetched, page itself never re-fetched | smartx.ir/stay-strong/ or /stay-strong-2/, 2026-09-04 paraphrase only |
| Exclusivity clause | Never found in either direction | UNKNOWN | — |
| Diner deposit/prepayment | Described as supported, no amount/%/trigger ever found | CLAIMED only | smartx.ir/services/reserve/restaurant/, 2026-09-04 |
| Diner no-show/cancellation fee | Never found for SmartX (do not confuse with RSEE's documented seat-forfeiture policy — different company) | UNKNOWN | — |
| Refund window | Never found | UNKNOWN | — |
| Loyalty redemption minimum | Never found | UNKNOWN | — |
| Coupon funding (platform vs. restaurant) | Inferred: restaurant funds its own coupons; SmartX is infrastructure only | inferred (CLAIMED-tier), not a direct statement | MATRIX.md loyalty row, cross-session synthesis |
| Changelog/release notes page | None found; closest analogue is `/sorry/`'s forward-looking "new features" language, itself not fetched verbatim | `[search-synthesis]` for the specific "three features" line | smartx.ir/sorry/, 2026-09-04 paraphrase; title/headers `[fetched]` 2026-09-05 |
| Terms-of-service page | Never found by any session | UNKNOWN | — |
| `/sorry/` incident page | Title confirms a named disruption (Mordad 1404); body confirms no incident detail or explicit apology | `[fetched]`, both prompts shown above | smartx.ir/sorry/, 2026-09-05 |

---

## Complaints / praises about money — status

### Top complaints (business-model/pricing specific)
`UNKNOWN — not verified.` `reviews_read = 0` for this session and for every prior SmartX session
(`corpus/smartx/store-reviews.md` confirms 0/0 across three dated sessions). No user-authored
complaint about price, billing, deposits, refunds, or fees exists anywhere in this research line —
not "none found after searching," but "no review of any kind has ever been read for this competitor."
Sample size: 0.

### Top praises (business-model/pricing specific)
`UNKNOWN — not verified.` Same reason. Sample size: 0.

---

## What I did NOT verify (this session)

- **No SmartX page was opened or searched this session.** `WebFetch` returned `EGRESS_BLOCKED` for
  both the neutral control and the primary pricing URL; `WebSearch` returned a session-wide
  200/200 budget-exhaustion notice on both queries attempted. Everything in this file is therefore
  either (a) a prior session's first-hand `[fetched]` evidence, accurately re-dated and re-cited, or
  (b) a prior session's `[search-synthesis]` paraphrase, kept at that same weaker tier.
- **The three-way unreconciled Smart WiFi pricing figures** (2026-09-04 range + tiered set vs.
  2026-09-05 single ten-user figure) were not resolved — flagged, not fixed.
- **The "quarterly renewal terms" claim was not upgraded past `[search-synthesis]`** — the page it
  is attributed to (`/stay-strong/` or `/stay-strong-2/`) has never been fetched by any session; only
  `/sorry/`, `/pricing/`, and `/services/reserve/restaurant/` have `[fetched]` status.
- **No terms-of-service, privacy, or refund-policy page was located** by this or any prior session —
  a genuine, unresolved gap, not a confirmed absence (the paths were never tried directly with a
  working fetch tool).
- **No diner-side deposit amount, no-show fee, or refund window was found for SmartX specifically** —
  do not substitute RSEE's documented policy (a different company) for SmartX's, which remains
  unknown.
- **The "three new free features this week" line from `/sorry/`** was not independently confirmed in
  the page body by the one session that did fetch that page verbatim-for-headers; it remains at
  `[search-synthesis]` tier specifically for that sub-claim, even though the page's existence and
  title are `[fetched]`-confirmed.
- **Whether Customer Club coupons are restaurant-funded** is an inference from category/structure,
  not a direct company statement — flagged as such, not upgraded to REAL.

## Sources

**Tested this session (2026-09-07), both unavailable:**
- `WebFetch`: https://example.com (control, `EGRESS_BLOCKED`); https://smartx.ir/pricing/ (primary
  target, `EGRESS_BLOCKED`).
- `WebSearch`: `smartx.ir pricing قیمت رزرو هوشمند تومان` (budget exhausted, 200/200);
  `"smartx.ir" terms of service قوانین` (same).

**Prior-session primary sources cited in this file** (not re-verified today; date and method as
originally recorded):
- https://smartx.ir/pricing/ — `[fetched]` 2026-09-05
- https://smartx.ir/services/reserve/restaurant/ — `[fetched]` 2026-09-05
- https://smartx.ir/sorry/ — `[fetched]` 2026-09-05 (two separate prompts, both reported above)
- https://smartx.ir/services/club/ and /services/club/restaurant/ — `[search-synthesis]` 2026-09-04
- https://smartx.ir/services/wifi/restaurant/ — `[search-synthesis]` 2026-09-04
- https://smartx.ir/other-expenses/ — `[search-synthesis]` 2026-09-04, never fetched
- https://smartx.ir/faq/ — `[search-synthesis]` 2026-09-04, never fetched
- https://smartx.ir/stay-strong/ and https://smartx.ir/stay-strong-2/ — `[search-synthesis]` only,
  2026-09-04, **never fetched by any session** — highest-priority target for a future pass with
  working tools, specifically to verify or retract the "quarterly renewal terms" claim.

**Internal repo documents read as prior art (not primary sources, listed for traceability):**
- `docs/audit/research/profiles/smartx.md`
- `docs/audit/research/corpus/smartx/store-reviews.md`
- `docs/audit/research/WATCH.md`
- `docs/audit/research/MATRIX.md`
- `docs/audit/research/PARITY-RISK.md`
- `docs/audit/research/ANTI-PATTERNS.md`
- `docs/audit/research/proposals/003-transparent-restaurant-terms.md`
- `docs/audit/research/profiles/iran-reservation-longtail.md`
- `docs/audit/research/recon-notes-global.md`
