# Foodism — Business Model, Pricing, Terms (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_
_Mode: BUSINESS MODEL, PRICING, TERMS_

## Prior art read first (per task instructions)

Read in full before writing anything below:
- `docs/audit/research/profiles/foodism.md` — base profile (2026-09-05, `WebSearch`-only batch 1)
  plus its own same-day **ADDENDUM** (first-hand `WebFetch` corrections, also 2026-09-05, batch 3):
  status changed to **DEGRADED — likely abandoned, not confirmed dead**.
- `docs/audit/research/corpus/foodism/store-reviews.md` (2026-09-07, written earlier the same day
  by a concurrent Scout session) — confirms `reviews_read = 0` for that session, and that **both**
  `WebFetch` (`EGRESS_BLOCKED` on every domain incl. the `example.com` control) and `WebSearch`
  (session-wide "200 of 200" budget exhaustion) were unavailable to it.
- `docs/audit/research/MATRIX.md` (footnotes 47, 49–55, 62), `docs/audit/research/WATCH.md`
  (2026-09-05 [Iran] entry), `docs/audit/research/PARITY-RISK.md`,
  `docs/audit/research/ANTI-PATTERNS.md` §7, `docs/audit/research/recon-notes-global.md`,
  `docs/audit/research/profiles/iran-reservation-longtail.md` (§"Two corrections to prior
  batches" and its own Foodism row), `docs/audit/research/STATUS-2026-09-07.md` — all contain
  Foodism business/pricing material scattered across files; this corpus consolidates it under the
  pricing/terms mode specifically.

**This file extends, not repeats, that prior art.** No contradiction with prior research was
found. No *internal* contradiction on Foodism's own pages was found either — a genuinely different
situation from `corpus/smartx/business.md`'s 2.5× self-contradictory reservation-product price,
because Foodism has essentially **no published pricing at all** to contradict itself with (see §1).

## Methodology — this session's own tool tests (do this before trusting anything below)

**First action, per protocol:** `WebFetch` tested against a neutral control, then against the
primary targets for this mode (the marketing site and its magazine, where a pricing/ad-package
page would most plausibly live).

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `WebFetch` | `https://foodism.app/` | Primary target — main site, restaurant-owner pricing/ad packages | `getaddrinfo ENOTFOUND foodism.app` |
| 3 | `WebFetch` | `https://myket.ir/app/app.foodism.tech` | Store listing (ratings, install/update trend — relevant to viability of the ad-revenue model) | `EGRESS_BLOCKED` |
| 4 | `WebFetch` | `https://cafebazaar.ir/app/app.foodism.tech` | Store listing, re-checking the 2026-09-05 HTTP 404 finding | `EGRESS_BLOCKED` |
| 5 | `WebFetch` | `https://mag.foodism.app/` | Magazine/blog — possible advertising-rate or business content | `getaddrinfo ENOTFOUND mag.foodism.app` |
| 6 | `WebFetch` | `https://www.google.com` | Second control (to characterize the failure-mode split below) | `EGRESS_BLOCKED` |
| 7 | `WebFetch` | `https://app.foodism.tech` | Android package's own domain | `getaddrinfo ENOTFOUND app.foodism.tech` |
| 8 | `WebFetch` | `https://www.instagram.com/foodism.iran/` | Official Instagram — bio/pricing mentions | `EGRESS_BLOCKED` |
| 9 | `WebSearch` | `فودیسم اپلیکیشن هزینه اشتراک تعرفه رستوران` | Pricing fallback (Persian) | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| 10 | `WebSearch` | `foodism.app pricing terms of service restaurant` | Pricing/ToS fallback (English) | Rejected: same budget-exhaustion message |

**`webfetch_worked = false`.** Two distinct failure signatures were observed, and I want to flag
the split precisely rather than collapse it: well-known, high-traffic domains
(`example.com`, `www.google.com`, `myket.ir`, `cafebazaar.ir`, `www.instagram.com`) returned an
explicit `EGRESS_BLOCKED` proxy message; the three Foodism-specific domains
(`foodism.app`, `mag.foodism.app`, `app.foodism.tech`) instead returned `getaddrinfo ENOTFOUND` —
a DNS-resolution failure, not an explicit block message. **I am not treating this as evidence that
Foodism's own domains have gone dark in the real world.** The much more likely explanation is a
tooling artifact of how this session's network egress is scoped (e.g., a smaller/niche domain
never resolving at the proxy's resolver, vs. a well-known domain hitting an explicit denylist
entry) — both signatures ultimately mean the same thing for this session: **zero bytes of any
Foodism page were read.** I flag the distinction only so a future session with different tooling
knows this specific split was observed and isn't itself proof of anything about the product.

**`websearch_worked = false`.** Session-wide "200 of 200" budget exhaustion on both queries
attempted, before either could run — the identical message `corpus/foodism/store-reviews.md` and
`corpus/smartx/business.md` both recorded earlier the same calendar day (2026-09-07). Per the
brief, other Scout sessions write to this repo concurrently; this is consistent with a
session-wide quota shared across sibling sessions running today, not a Foodism-specific or
mode-specific restriction.

**Net result: this session had zero live research capability of any kind**, matching every other
Scout session dated 2026-09-07 found in this repo so far. Everything below that is not explicitly
carried forward and cited as `[fetched, 2026-09-05]` or `[search-synthesis, 2026-09-04/05]` from a
prior session is either an absence this session confirmed cannot be filled, or a structural
inference clearly labeled as such.

## Reviews read this session: 0

No user review discussing Foodism's pricing, ad-package value, billing, or refunds was read this
session. Across the entire Scout research line to date, exactly **one** verbatim Foodism review
exists at all (see `profiles/foodism.md`'s ADDENDUM and `corpus/foodism/store-reviews.md`):
**معصومه, ۳ خرداد ۱۴۰۵** (my conversion, carried forward: ≈2026-05-24): **«کار نمیکنه»** — "it
doesn't work." That review does not discuss money, pricing, or billing at all — it is a functional
complaint, not a financial one — so it contributes **zero** data points to this specific mode.
`reviews_read = 0` for this session, and 0 of the 1 review ever obtained anywhere in this research
line is about money.

---

## 1. Plans / tiers / add-ons — exact figures, currency explicit

**No price list, tier structure, or add-on catalog has ever been found for Foodism, by any
session, in any format.** This is a stronger absence than SmartX (which has a full, if partly
self-contradictory, published Toman price table) or even RSEE (a public per-period price table)
or Sepidz ("request a price list" gated form, but at least a named gate). For Foodism specifically:

- **Consumer/diner side: structurally has no pricing to report.** Per `profiles/foodism.md`
  §"What it is" and §"Business model & pricing" (`[search-synthesis]`, 2026-09-05): the app is
  free to browse and use, has no in-app ordering, no in-app payment, and no table-reservation
  feature at all. There is no diner-facing plan/tier/fee of any kind because there is no
  diner-facing money flow of any kind. This is a **structural absence, not a research gap** — the
  same distinction `corpus/smartx/business.md` draws for SmartX's commission-% row.
- **Restaurant/business side: "advertising packages" (پکیج‌های تبلیغاتی) are described as
  existing, "با بازدهی خوب" ("with good returns")** — `[search-synthesis]`, 2026-09-05, no source
  page more specific than that phrase was ever obtained. **Zero figures — no Toman amount, no
  monthly/annual cadence, no tier name, no feature-per-tier breakdown — have ever been found for
  these packages, despite multiple differently-worded targeted searches** in the 2026-09-05
  session (per the base profile: "no published price figures were found anywhere"). This session
  could not add to that; `foodism.app` (the one page most likely to carry this) returned
  `getaddrinfo ENOTFOUND`, and `WebSearch` was unavailable entirely.
- **Basic directory listing is free** — `[search-synthesis]`: "ثبت‌نام در اپلیکیشن‌های
  رستوران‌یاب رایگان است" ("registration in restaurant-finder apps is free"). This is the one
  concrete, if minimal, pricing fact that exists: the free tier is real, the paid tier's price is
  not documented anywhere in this research line.
- **Currency:** never stated anywhere, for the simple reason that no priced item was ever found to
  state a currency for. Cannot confirm Toman vs. Rial for Foodism specifically — genuinely
  **UNKNOWN**, not inferred from the Iran-tier default the way the base profile inferred other
  facts.

**Verdict: UNKNOWN — not verified**, at the deepest level found by any session to date. This is
the single largest and most consequential gap in this file, unchanged from the base profile.

## 2. Commission % and who pays

**Structurally absent, not merely unfound.** Foodism has no in-app ordering and no
reservation/booking flow (per `profiles/foodism.md`, cross-confirmed multiple ways — see
"Feature inventory" ABSENT rows for both). A commission percentage requires a transaction to take
a cut of; none exists on this platform per any evidence gathered to date. **No commission structure
of any kind has ever been found or is structurally possible given the product's own described
shape.** This differs from SmartX (100% B2B subscription/usage fees, explicitly no commission
either, but for a *different* reason — SmartX sells software, not a marketplace) and from RSEE
(a per-seat "right to reserve" fee paid by the diner, also not a % commission) —
`corpus/smartx/business.md` §2 draws the same distinction for SmartX; Foodism's absence is even
more total, since it also lacks the reservation product SmartX and RSEE both have.

## 3. Per-cover / per-booking fees

**N/A — structurally absent**, same reasoning as §2: no booking or cover-counting flow exists in
the product at all, per every session's research to date. Not a single source, at any evidence
tier, has ever described a per-cover or per-booking charge for Foodism.

## 4. Contract length, auto-renewal, exclusivity

**UNKNOWN — not verified, by any session.** No terms-of-service, advertiser agreement, or
contract page has ever been found or fetched for Foodism (see §10). Whether the "advertising
packages" are billed monthly, annually, one-time, whether they auto-renew, or whether any
exclusivity clause exists (e.g., a restaurant listed exclusively/preferentially for paying more)
— none of this has ever been found in any session. This session could not close the gap:
`foodism.app` returned a DNS-resolution failure and `WebSearch` was unavailable.

## 5. Diner-side money: deposits, no-show/cancellation fees, when shown

**N/A — structurally absent, with high confidence.** Per `profiles/foodism.md` §"What it is" and
its "Feature inventory" table: the app explicitly does not support in-app ordering or payment
(ordering happens "به صورت حضوری یا تلفنی" — in person or by phone) and has **no table-reservation
feature at all** (a targeted search, "فودیسم رزرو میز رستوران," returned zero Foodism-specific
results — marked `ABSENT — not found` in the base profile, a stronger classification than the
default `UNKNOWN`). With neither ordering nor reservation, there is no mechanism through which a
deposit, no-show fee, or cancellation fee could be charged to a diner. This is the cleanest
structural-absence finding in this entire corpus — **no deposit, no-show fee, or cancellation fee
row applies to Foodism at all**, and I am not marking it `UNKNOWN` because the product shape
itself rules it out, not because research failed to find it. This session found nothing to
contradict that structural read (no page was reachable either way).

## 6. Refund windows

**N/A, same reasoning as §5.** No payment flow exists on the diner side to have a refund policy
for. On the restaurant/advertiser side, whether a paid ad package is refundable if cancelled early
is **UNKNOWN — not verified** — no ToS or advertiser-terms page has ever been reached.

## 7. Loyalty redemption minimums

**ABSENT — not found**, per `profiles/foodism.md`'s Feature inventory: "targeted search found no
Foodism-native points/tier system; the only 'discount' mechanic found is generic, restaurant-run
offers surfaced inside the app, not a Foodism ledger/points system." With no points/tier ledger,
there is no redemption-minimum figure to report — this mirrors SmartX's Customer Club gap
(`corpus/smartx/business.md` §7: "no points-to-Toman conversion rate... has ever been found") but
for a structurally different reason: SmartX's loyalty product exists but is undocumented in
public; Foodism's own native loyalty ledger does not appear to exist at all, per every session's
research. Contrast TheFork's YUMS (100 pts/booking, 1000 = £20 off, one-year validity — fully
public), the sharpest opposite end of this spectrum documented anywhere in this research line.

## 8. Coupon / discount funding — platform vs. restaurant

Two data points, both carried forward, neither improved this session:

- **`profiles/foodism.md` records a targeted, deliberate check of Mopon** (ایران's coupon-code
  aggregator, which the base profile notes does list Fidilio and SnappFood codes) **and found no
  Foodism presence there at all.** The base profile calls this "a genuine, if soft, negative
  finding: either Foodism doesn't run discount codes the way Fidilio does, or my search simply
  missed it" — I am carrying that exact hedge forward rather than upgrading it, since this session
  could not re-check Mopon (`WebSearch` unavailable, and no Mopon URL was ever attempted with
  `WebFetch` by any session).
- **The only discount-adjacent mechanic described anywhere for Foodism** is "generic,
  restaurant-run offers surfaced inside the app" (per the base profile's loyalty-row finding,
  §7 above) — i.e., if a restaurant-side discount appears inside Foodism at all, the *restaurant*
  appears to be the one setting and funding it, with Foodism as a passive display surface, not a
  platform-funded currency the way TheFork's YUMS is. **This is an inference from the product's
  described shape (a discovery/review directory with no payment rail), not a direct company
  statement** — labeled accordingly, same evidence-tier discipline `corpus/smartx/business.md` §8
  applies to its structurally-similar inference about Customer Club.

**Verdict: UNKNOWN whether Foodism funds anything — the one directly-checked negative (Mopon) and
the structural read both point toward "restaurant funds its own offers, if any exist at all," but
neither is a direct company statement.**

## 9. Changelogs / release notes

**No dedicated changelog or release-notes page has ever been found for Foodism.** But this mode's
own checklist item is answered more concretely by a fact from a *different* section of the prior
research than a documents page: the **ADDENDUM to `profiles/foodism.md`** (2026-09-05,
`[fetched]`) found the Myket Android listing's **last-updated date is ۱۴۰۱/۰۹/۱۰** (my conversion,
carried forward: **2022-12-01**) — meaning **the binary itself has not shipped a new build in
roughly 3 years and 9 months** as of this file's date (2026-09-07). I am treating this as the de
facto answer to "does this company publish release notes / ship updates" for business-model
purposes: **the evidence says no, functionally, regardless of whether a changelog page exists** —
a company is not iterating on (or presumably actively monetizing/supporting) a product it has not
rebuilt in nearly four years. This reading is corroborated by, not separate from, the Cafe Bazaar
listing returning **HTTP 404** (also `[fetched]`, 2026-09-05, three attempts across two URL forms,
controlled against `cafebazaar.ir/app/com.fidilio` fetching normally in the same minute — so a
listing-specific removal, not a site outage) and the single verbatim review obtained, **«کار
نمیکنه»** ("it doesn't work"), dated **۳ خرداد ۱۴۰۵** (≈2026-05-24). **This session did not
re-verify any of these three facts directly** (`WebFetch` failed on both `myket.ir` and
`cafebazaar.ir` this session — see methodology table) — I am citing them accurately as
prior-session, `[fetched]`-tier evidence, not re-confirming them today.

**Business-model implication, stated as inference, not fact:** a ~3.75-year-stale binary, a 404'd
listing on Iran's larger of the two major Android stores, and one 2026-dated review reporting
non-function together suggest the "advertising packages with good returns" revenue model — to the
extent it was ever operating at any real scale — is **very unlikely to be an actively maintained,
actively sold product today**, materially undercutting the base profile's own hedge that Foodism
"reads consistent with a small, likely bootstrapped operation." A small bootstrapped *operating*
business and a **degrading/abandoned** one are different things, and the newer evidence (all from
the same 2026-09-05 session, none re-verified since) points toward the latter. This is my own
synthesis across sections already in the file, not a new finding — flagged as inference, to be
weighed accordingly.

## 10. Terms-of-service pages

**Never found, never fetched, by any session to date.** No `foodism.app/terms`, `/privacy`,
`/rules`, `/agreement`, advertiser-terms, or equivalent path has appeared in any search result or
fetch across any dated session (2026-09-05, 2026-09-07). This session could not add to that —
`foodism.app` returned `getaddrinfo ENOTFOUND` for `WebFetch`, and no path-guessing was possible
without a resolvable base domain or a working `WebSearch`. This is the same class of gap
`corpus/smartx/business.md` §10 documents for SmartX, and for the same reason (a future session
with working tools should try named paths directly rather than relying on search, the way
`profiles/iran-reservation-longtail.md` tried `rsee.ir/rules` and got a useful 404).

---

## Consolidated pricing/terms table (all evidence tiers shown together)

| Item | Value | Evidence tier | Source, date |
|---|---|---|---|
| Currency | Never stated for any priced item — no priced item was ever found | UNKNOWN | — |
| Diner-side pricing/plans | N/A — no in-app ordering, no reservation, no payment flow exists | structural absence | `profiles/foodism.md` §"What it is", `[search-synthesis]` 2026-09-05 |
| Restaurant "advertising packages" | Exist, "with good returns" — **zero figures found** (no Toman amount, no cadence, no tier names) | `[search-synthesis]`, thin | `profiles/foodism.md` §"Business model & pricing", 2026-09-05 |
| Basic directory listing | Free ("ثبت‌نام... رایگان است") | `[search-synthesis]` | `profiles/foodism.md`, 2026-09-05 |
| Commission % | None — structurally absent (no transaction flow to take a cut of) | structural absence | `profiles/foodism.md` Feature inventory |
| Per-cover / per-booking fee | None — structurally absent | structural absence | same |
| Contract length / auto-renewal / exclusivity | Never found | UNKNOWN | — |
| Diner deposit / no-show / cancellation fee | N/A — no payment/reservation flow exists | structural absence | `profiles/foodism.md` "ABSENT — not found" (table reservation), "ABSENT" (in-app ordering/payment) |
| Refund window | N/A on diner side (no payment flow); UNKNOWN on advertiser side | structural absence + UNKNOWN | — |
| Loyalty redemption minimum | ABSENT — no native points/tier ledger found at all | ABSENT | `profiles/foodism.md` Feature inventory |
| Coupon/discount funding | No presence on Mopon (checked, negative); the only in-app discount mechanic described is restaurant-run, not Foodism-funded | inferred + one direct negative check | `profiles/foodism.md`, 2026-09-05 |
| Changelog/release-notes page | None found; **de facto answer: no new build in ~3.75 years** (Myket last-updated ۱۴۰۱/۰۹/۱۰ ≈ 2022-12-01) | `[fetched]` (the date), inference (the implication) | ADDENDUM to `profiles/foodism.md`, 2026-09-05 |
| Cafe Bazaar listing status | HTTP 404, listing-specific (not site outage) | `[fetched]`, 3 attempts, 2 URL forms | ADDENDUM to `profiles/foodism.md`, 2026-09-05 |
| Most recent verbatim review (functional, not financial) | معصومه, ۳ خرداد ۱۴۰۵ (≈2026-05-24): «کار نمیکنه» ("it doesn't work") | `[fetched]` | ADDENDUM to `profiles/foodism.md`, 2026-09-05 |
| Terms-of-service page | Never found by any session | UNKNOWN | — |

---

## Complaints / praises about money — status

### Top complaints (business-model/pricing specific)
`UNKNOWN — not verified.` `reviews_read = 0` for this session. Across the entire research line,
exactly **one** Foodism review has ever been obtained (`sample_size = 1`), and it is a functional
complaint ("it doesn't work"), not a pricing/billing complaint — **zero of one** reviews discuss
money. No restaurant-owner-side complaint about ad-package pricing, value, or billing has ever been
found either, despite the base profile's own targeted search for exactly that (see
`profiles/foodism.md` §"Who it's for": "I found no restaurant-owner-side complaint or commentary
(fees, onboarding friction, ad-package value) despite targeted searches").

### Top praises (business-model/pricing specific)
`UNKNOWN — not verified.` Same reason. Sample size: 0 (of the one review ever obtained, none
addresses money in either direction).

---

## What I did NOT verify (this session)

- **No Foodism page was opened or searched this session.** `WebFetch` returned `EGRESS_BLOCKED`
  for the neutral controls and for the two Android-store domains, and `getaddrinfo ENOTFOUND` for
  all three Foodism-owned domains attempted (`foodism.app`, `mag.foodism.app`, `app.foodism.tech`);
  `WebSearch` returned a session-wide 200/200 budget-exhaustion notice on both queries attempted.
  Everything in this file is therefore either (a) a prior session's `[fetched]` or
  `[search-synthesis]` evidence, accurately re-dated and re-cited, or (b) my own structural
  inference from the product's already-documented shape, clearly labeled as inference.
- **Exact advertising-package figures** — no Toman amount, tier name, or cadence has ever been
  found by any session; this session could not add to that gap.
- **Any contract-length, auto-renewal, or exclusivity term** — never found by any session.
- **Any terms-of-service, privacy, refund, or advertiser-agreement page** — never located by any
  session; `foodism.app`'s failure to resolve this session means even blind path-guessing
  (`/terms`, `/privacy`) could not be attempted.
- **Whether the Cafe Bazaar 404 (observed 2026-09-05) still holds two days later** — this session's
  `WebFetch` call to `cafebazaar.ir/app/app.foodism.tech` failed with `EGRESS_BLOCKED` before it
  could even reach the point of checking status code, so I cannot say whether the listing is still
  gone, was reinstated, or something else changed.
- **Whether the Myket listing's rating/review count/install count have moved** since the
  2026-09-05 fetch (4.3/5, 226 reviews, 25,000 installs) — not re-checked this session.
  `corpus/foodism/store-reviews.md` (also 2026-09-07) independently found the same tooling gap and
  also could not re-check this.
- **Mopon (coupon aggregator) was not re-checked** for a Foodism listing — the base profile's
  single negative check (2026-09-05) stands, unconfirmed a second time.
- **Instagram (`@foodism.iran`) bio/posts for any pricing or advertiser-rate mention** — attempted
  this session (`www.instagram.com/foodism.iran/`), returned `EGRESS_BLOCKED`, never reached by any
  session.
- **My own inference in §9** (that the 3.75-year-stale binary + 404'd Cafe Bazaar listing +
  "it doesn't work" review together suggest the ad-package revenue model is not actively
  operating today) **is explicitly an inference, not a confirmed fact** — no direct statement of
  Foodism ceasing sales, shutting down, or discontinuing advertiser packages has ever been found by
  any session. Flag this if it is ever cited elsewhere: it is reasoning from converging circumstantial
  signals, not a company statement or a direct observation of a "closed" state.

## Sources

**Tested this session (2026-09-07), all failed as tabulated in the methodology section:**
- `WebFetch`: `https://example.com` (control, `EGRESS_BLOCKED`); `https://www.google.com`
  (second control, `EGRESS_BLOCKED`); `https://foodism.app/` (`getaddrinfo ENOTFOUND`);
  `https://mag.foodism.app/` (`getaddrinfo ENOTFOUND`); `https://app.foodism.tech`
  (`getaddrinfo ENOTFOUND`); `https://myket.ir/app/app.foodism.tech` (`EGRESS_BLOCKED`);
  `https://cafebazaar.ir/app/app.foodism.tech` (`EGRESS_BLOCKED`);
  `https://www.instagram.com/foodism.iran/` (`EGRESS_BLOCKED`).
- `WebSearch`: `فودیسم اپلیکیشن هزینه اشتراک تعرفه رستوران` (budget exhausted, 200/200);
  `foodism.app pricing terms of service restaurant` (same).

**Prior-session primary sources cited in this file** (not re-verified today; date and method as
originally recorded in `profiles/foodism.md` and its ADDENDUM):
- https://foodism.app/ — `[search-synthesis]` 2026-09-05 (never `[fetched]` by any session)
- https://mag.foodism.app/ — `[search-synthesis]` 2026-09-05
- https://myket.ir/app/app.foodism.tech — `[fetched]` 2026-09-05 (ADDENDUM): 4.3/5, 226 reviews,
  25,000 installs, last updated ۱۴۰۱/۰۹/۱۰ (≈2022-12-01); one verbatim review, معصومه ۳ خرداد ۱۴۰۵
  (≈2026-05-24), «کار نمیکنه»
- https://cafebazaar.ir/app/app.foodism.tech — `[fetched — HTTP 404]` 2026-09-05, ADDENDUM, 3
  attempts, 2 URL forms, controlled against `cafebazaar.ir/app/com.fidilio` (fetched normally)
- https://appreview.ir/فودیسم-شبکه-اجتماعی-شکموهای-ایران — `[search-synthesis]` 2026-09-05
  (sign-up gate, social-feature description; no pricing content)
- Mopon (Iranian coupon aggregator; exact URL not recorded in the base profile) — checked,
  negative result, `[search-synthesis]` 2026-09-05

**Internal repo documents read as prior art (not primary sources, listed for traceability):**
- `docs/audit/research/profiles/foodism.md` (base profile + ADDENDUM)
- `docs/audit/research/corpus/foodism/store-reviews.md`
- `docs/audit/research/corpus/smartx/business.md` (format/rigor reference)
- `docs/audit/research/MATRIX.md` (footnotes 47, 49–55, 62)
- `docs/audit/research/WATCH.md`
- `docs/audit/research/PARITY-RISK.md`
- `docs/audit/research/ANTI-PATTERNS.md` (§7)
- `docs/audit/research/recon-notes-global.md`
- `docs/audit/research/profiles/iran-reservation-longtail.md`
- `docs/audit/research/STATUS-2026-09-07.md`
