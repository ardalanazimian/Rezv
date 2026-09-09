# SmartX — Deep Competitor Profile

_Date: 2026-09-07 · Session: Scout deep batch (Sonnet 5, scoped to 4 competitors per
token-budget instruction) · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_

**Method for this document:** synthesis only — no new `WebFetch`/`WebSearch` calls were made in
this pass (explicit token-budget instruction: work from the corpus already on disk). Inputs were
the 5 mode-specific corpus files under `docs/audit/research/corpus/smartx/` (business, features,
scale, social, store-reviews — all dated 2026-09-07) and the prior lighter profile at
`docs/audit/research/profiles/smartx.md` (2026-09-04 base pass + 2026-09-05 first-hand-fetch
addendum). Every figure/claim below carries the evidence tier and date it originally carried in
the corpus; nothing was re-verified live. Repo-side claims in §9 ("Where Rezervno beats it") are
the one exception — those were independently re-verified against the current repository via
`Grep`/`Read` in this session, per the task's own rule that a doc's claim is not proof.

## Internal-consistency check performed this pass (Step 1 — adversarial self-review)

Read all 5 corpus files end-to-end and cross-checked the load-bearing numeric claims:

- **The 2.5× pricing self-contradiction the task asked me to check for was captured, not
  missed.** `smartx.ir/pricing/` states **۵۲,۸۰۰,۰۰۰ تومان/year** for رزرو هوشمند (Smart
  Reservation); `smartx.ir/services/reserve/restaurant/` states **۲۱,۴۵۰,۰۰۰ تومان/year** for the
  identical named product. ۵۲,۸۰۰,۰۰۰ ÷ ۲۱,۴۵۰,۰۰۰ = 2.46× — the corpus's own repeated "2.5×" framing
  is a reasonable rounding, not an error. Both figures are `[fetched]` directly, same session
  (2026-09-05), from two live SmartX pages — this is the strongest-evidenced contradiction in the
  entire research line, and `business.md`, `features.md`, `scale.md`, and `social.md` all cite it
  identically (no drift found across the four files that mention it). Carried forward unresolved
  below, per instructions — not adjudicated in either direction.
- **A second, separate, less-precise contradiction exists on the Customer Club price and was not
  fully reconciled by the corpus itself.** The 2026-09-04 `[search-synthesis]` pass recorded
  ۳۳,۵۰۰,۰۰۰–۴۳,۰۰۰,۰۰۰ تومان/year (base + add-ons); the 2026-09-05 `[fetched]` pass recorded a
  single ۵۱,۰۰۰,۰۰۰ تومان/year figure from the same page. `business.md` §1 notes this explicitly as
  unreconciled rather than picking one. I did not find any file that resolves it — flagged here
  again for visibility.
- **A third contradiction — Smart WiFi pricing — has three unreconciled figures across sessions**
  (۲۱,۰۰۰,۰۰۰ 10-user tier `[fetched]` 2026-09-05; ۸,۱۴۰,۰۰۰–۲۵,۳۰۰,۰۰۰ range `[search-synthesis]`
  2026-09-04; a tiered ۳۳,۶۰۰,۰۰۰/۴۳,۰۰۰,۰۰۰/۶۷,۱۰۰,۰۰۰ set, also `[search-synthesis]` 2026-09-04).
  All three coexist in `business.md`'s consolidated table without adjudication. Consistent across
  every file that repeats it.
- **Complaint/praise theme counts vs. sample sizes:** trivially consistent — every one of the 5
  corpus files independently reports `reviews_read = 0` for SmartX, and none states a complaint or
  praise theme with a nonzero count. There is nothing to overflow a sample size of zero. This is
  itself worth flagging as unusual: five independently-run sessions, spanning three calendar dates
  and different tool-availability states (2026-09-04 had working `WebSearch` only; 2026-09-05 had
  working `WebFetch` only; three 2026-09-07 sessions had neither), all converged on zero. That
  consistency is corroborating, not a red flag.
- **Quotes dated?** N/A — there are no quotes to date; zero reviews were read across all sessions.
  The one dated first-party text in the corpus (`smartx.ir/sorry/`'s HTML `<title>`) carries its own
  date (Mordad 1404 ≈ 2025-07-23–2025-08-22) and fetch date (2026-09-05), both consistent across
  `business.md`, `features.md`, `social.md`, and the base profile's addendum.
- **One genuine contradiction found *within* the existing research corpus itself** (not something I
  found new — `social.md` already flagged it, and I confirm it holds): `MATRIX.md` footnote 48
  (attached to Foodism's review-volume row) states SmartX is among competitors "where at least some
  review volume exists." This directly contradicts every one of the 5 corpus files and the base
  profile, all of which independently confirm `reviews_read = 0` for SmartX across every session to
  date. This footnote appears to be wrong specifically about SmartX (plausibly drafted before
  SmartX's zero was locked in, or loosely lumping SmartX in with Fidilio/Servme, which do have some
  review volume). Not corrected in `MATRIX.md` by this pass — this document is the only file this
  task authorizes writing to; flagged here for whoever next edits `MATRIX.md`.
- No other internal contradiction was found in the 5 files beyond the three pricing gaps and the
  one `MATRIX.md` footnote issue above. The tool-unavailability narrative (both `WebFetch` and
  `WebSearch` exhausted/blocked across all three 2026-09-07 sessions) is corroborated identically
  across `business.md`, `features.md`, `scale.md`, and `social.md`, including byte-identical `curl`
  proxy-status timestamps in `scale.md` and `social.md` — internally consistent, not contradictory.

---

## 1. What it is / who it's for / business model

**What it is:** a cloud-hosted (SaaS) suite of **four separately-sold product lines** for
restaurant/café operators in Iran, sold as an add-on module through POS resellers rather than
self-discovered by diners:

1. **رزرو هوشمند (Smart Reservation)** — reservation/table-booking management with a diner-facing
   booking portal, POS integration, and prepayment/deposit support (CLAIMED — marketing copy only).
2. **باشگاه مشتریان (Customer Club)** — loyalty/CRM: purchase-history tracking, RFM-style
   segmentation, coupons, a gamified "wheel of fortune," churn-risk flags, multi-branch reporting
   (CLAIMED).
3. **وای‌فای هوشمند (Smart WiFi)** — SMS-OTP captive-portal WiFi login that captures the connecting
   customer's phone number into the restaurant's marketing database, plus bandwidth control
   (CLAIMED, except the cash-incentive-for-capture mechanic below, which is REAL).
4. **ارزیابی هوشمند (Smart Evaluation)** — automated post-visit CSAT survey collection (CLAIMED).

Source for all four: `smartx.ir/services/*`, `[search-synthesis]` 2026-09-04, restated unchanged
across all 5 corpus files.

**Who it's for:** restaurant/café owners and managers — B2B software, not a consumer app.
**Confirmed structurally, not merely claimed:** the one Android listing found
(`myket.ir/app/com.smartx`) requires an existing SmartX account to log in, and no diner-facing
consumer app, marketplace, or discovery surface exists anywhere in the research line
(`features.md` §H — the two `ABSENT` rows for review/photo features both derive from this single
confirmed structural fact). Diners touch SmartX only indirectly: a restaurant's white-labeled
booking widget, a WiFi captive-portal login screen, or an SMS from the restaurant's loyalty
program.

**Business model:** 100% B2B revenue, billed to the restaurant operator, never a % commission on
bookings or bills (no commission structure of any kind was ever found, in any session —
`business.md` §2). Two coexisting pricing models are published side-by-side on the same page: (A)
flat annual subscription per product line, stackable via bundles, and (B) usage-based (activation
+ per-transaction fee, with a 30%-off incentive for phone-number-capture rate — see §3). SmartX is
distributed exclusively through POS resellers **Sepidz**, **Sepidar Sistem**, and **Vendo**
— a genuine, multiply-corroborated relationship (independently confirmed from both `smartx.ir` and
`sepidz.com`, per `features.md` §K), and per one unconfirmed-beyond-one-snippet search result, may
sit inside the **Hamkaran Sistem** group (a large, established Iranian enterprise-software
conglomerate) — labeled UNKNOWN, not confirmed, in every file that mentions it. Legal entity:
شرکت نوآفرینان هوشمند آسیا ("Noafarinan-e-Hooshmand-e-Asia Co."), first market presence 1394
(2015/2016) per its own about-us page — roughly a decade of continuous operation, unverified
beyond the company's own claim.

---

## 2. Pricing — every figure, currency, source, date, label — contradictions listed, not resolved

All figures are stated in **Toman (تومان)** on every SmartX page any session ever reached — no
Rial/Toman ambiguity was found in the pricing copy itself (contrast the Zarinpal 10× risk this
repo's own `lib/zarinpal.ts` guards against — no equivalent SmartX-side confusion was found).

| Item | Value | Label | Source, date |
|---|---|---|---|
| Smart Evaluation (CSAT) | ۳۳,۶۵۰,۰۰۰ تومان/yr | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Customer Club — newer figure | ۵۱,۰۰۰,۰۰۰ تومان/yr | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Customer Club — older, unreconciled figure | ۳۳,۵۰۰,۰۰۰–۴۳,۰۰۰,۰۰۰ تومان/yr (base + add-ons) | CLAIMED, weaker tier | `smartx.ir/pricing/`, `[search-synthesis]` 2026-09-04 |
| **Smart Reservation — pricing-page figure** | **۵۲,۸۰۰,۰۰۰ تومان/yr** | CLAIMED (company-published) — **contradicts row below** | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| **Smart Reservation — product-page figure** | **۲۱,۴۵۰,۰۰۰ تومان/yr** | CLAIMED (company-published) — **contradicts row above, 2.46×/"2.5×" gap, neither endorsed** | `smartx.ir/services/reserve/restaurant/`, `[fetched]` 2026-09-05 |
| Smart WiFi (10-user tier, newest figure) | ۲۱,۰۰۰,۰۰۰ تومان/yr | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Smart WiFi — range (unreconciled with above) | ۸,۱۴۰,۰۰۰–۲۵,۳۰۰,۰۰۰ تومان/yr | CLAIMED, weaker tier | `smartx.ir/pricing/`, `[search-synthesis]` 2026-09-04 |
| Smart WiFi — tiered set (unreconciled with both above) | ۳۳,۶۰۰,۰۰۰ / ۴۳,۰۰۰,۰۰۰ / ۶۷,۱۰۰,۰۰۰ تومان/yr (basic/advanced/"five-service") | CLAIMED, weaker tier | `smartx.ir/pricing/`, `[search-synthesis]` 2026-09-04 |
| 3-service bundle | ۱۰۱,۹۵۰,۰۰۰ تومان/yr | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Full 4-product bundle (مدیریت هوشمند رستوران) | ۱۹۹,۲۵۰,۰۰۰ تومان/yr (≈۵۴۶,۰۰۰/day) | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Usage-based: activation fee | ۲۹,۵۰۰,۰۰۰ تومان | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Usage-based: per-transaction fee | ۱۰,۰۰۰ تومان | CLAIMED (company-published) | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| Usage-based: phone-capture discount | 30% off if ≥75% of invoices carry a customer phone number | **REAL** — the single most concretely-evidenced pricing mechanic in the whole corpus | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| WiFi "coupon" add-on | ۳,۵۰۰,۰۰۰ تومان, billing cadence unclear | CLAIMED, weaker tier | `smartx.ir/other-expenses/`, `[search-synthesis]` 2026-09-04, never fetched |
| Payment-gateway setup/per-transaction fee (deposit flow) | Exists, no Toman figure ever found | CLAIMED (existence only) | `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]` 2026-09-04 |
| RFID cards, MikroTik router hardware cost | Required, no cost ever found | CLAIMED (existence only) | `smartx.ir/other-expenses/`, `[search-synthesis]` 2026-09-04 |
| SMS messaging | Billed separately, pay-as-you-go, in-panel purchase | CLAIMED (no per-SMS figure) | `smartx.ir/pricing/`, `[search-synthesis]` 2026-09-04 |
| Commission % on bookings/bills | None found in any session | ABSENT (as a mechanic; flat-fee model instead) | — |
| Diner deposit amount/%/trigger | Never found | UNKNOWN | — |
| Diner no-show/cancellation fee | Never found for SmartX specifically (do not confuse with RSEE — a different Iranian company with a documented 100/50/0% forfeiture schedule) | UNKNOWN | — |
| Refund window | Never found | UNKNOWN | — |
| Loyalty redemption minimum / points-to-Toman rate | Never found | UNKNOWN | — |
| Contract length | "/year" by every pricing-table label; no ToS ever found confirming a minimum term or auto-renewal clause | Inferred from labels only, not a contract term | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 |
| "Quarterly renewal terms" claim | One hop from primary source — paraphrase of a paraphrase | `[search-synthesis]`, page (`/stay-strong/`) never independently fetched by any session | 2026-09-04 |
| Terms-of-service / privacy / refund-policy page | Never found by any session, ever | UNKNOWN (not confirmed absent — no session ever tried the URL directly) | — |

**Contradictions are listed above, not resolved, per task instructions.** A future session with
working `WebFetch` should re-open `smartx.ir/pricing/` and `smartx.ir/services/reserve/restaurant/`
side by side to see whether either has been corrected since 2026-09-05.

---

## 3. Users / scale — every figure labelled, UNKNOWN where not found

| Metric | Value | Label | Source, date |
|---|---|---|---|
| Headcount | 10–50 employees, "دانش‌بنیان" (knowledge-based-company tax designation) | CLAIMED (company-published, third-party job board) | Karboom company page, `[search-synthesis]` 2026-09-04 |
| Myket listing existence | Confirmed to exist, gated to existing account holders at login | REAL (existence only) | `myket.ir/app/com.smartx`, `[search-synthesis]` 2026-09-04 — page itself never opened by any session |
| Myket install band / rating / review count / last-updated | Never surfaced by any session | **UNKNOWN** | — |
| Google Play / iOS App Store listing | Never found | UNKNOWN (plausible absence given Iranian-app sanctions patterns, not confirmed) | — |
| Cafe Bazaar listing (restaurant product) | Only an unrelated same-named smartwatch app found under "SMARTx" | **ABSENT** (confirmed by search, not merely unreached) | `[search-synthesis]` 2026-09-04 |
| G2 / Capterra / Trustpilot / GetApp / Sitejabber presence | Never found | UNKNOWN, plausible-absent by category (Iran-only B2B SaaS) | — |
| MAU / registered users (company-claimed or independent) | None found by any session | **UNKNOWN** | — |
| Venue/restaurant count, cities served | None found; `smartx.ir/customers/` page confirmed to exist but its brand list "could not be extracted" from search | **UNKNOWN** | — |
| Website traffic estimate (Similarweb/SEMrush/Ahrefs) | Never attempted before 2026-09-07; the one targeted query that session tried was rejected before returning a result | **UNKNOWN** | — |
| Funding rounds / named investors | None found; one unconfirmed-beyond-one-snippet claim of Hamkaran Sistem group affiliation (would functionally substitute for external funding if true) | **UNKNOWN** | — |
| Revenue / GMV | No filing, estimate, or figure found. Note: unit-price × customer-count would require a customer count that does not exist in this research line — this document does not attempt to derive one | **UNKNOWN** | — |
| Acquisition price (as acquirer or target) | No evidence of any M&A event | **UNKNOWN** | — |
| Current job postings (ML/growth/payments signal) | Genuinely unattempted by any prior session until 2026-09-07, and that session's one targeted query was rejected before returning a result | **UNKNOWN** | — |
| Years active | ≈10 years (since 1394/2015-16) | CLAIMED (company's own about-us page) | `smartx.ir/about-us/`, `[search-synthesis]` 2026-09-04 |

**Read honestly:** across five dated research touchpoints (2026-09-04, 2026-09-05, and three
2026-09-07 sessions), the *only* hard USERS/SALES/SCALE-adjacent numbers ever obtained for SmartX
are the 10–50 headcount figure and the pricing table in §2. Every install/rating/MAU/venue/funding/
revenue/job-posting figure the task brief's own checklist asks for remains UNKNOWN — not "low," not
"small," genuinely never found.

---

## 4. Feature inventory (condensed from the corpus's 45-row breakdown in `features.md`)

Evidence-tier key unchanged from the corpus: `[fetched]` = a session opened the page directly
(2026-09-05 only); `[search-synthesis]` = `WebSearch` paraphrase only, never opened directly
(2026-09-04); no tag = evidence tier not meaningfully different from the row's own label.

| Feature | Status | Evidence |
|---|---|---|
| Diner-facing online booking portal (date/party size) | CLAIMED | `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]` 2026-09-04. Exact step/screen/tap count: **never described by any source, any session** — a clean, previously-unflagged gap. |
| Table-level (floor-plan) selection vs. staff-side assignment | UNKNOWN | Ambiguous in every source; the Persian phrase used is consistent with either reading, never resolved with a live widget. |
| Waitlist / "smart list" of incoming requests | CLAIMED | `smartx.ir/services/reserve/`, `[search-synthesis]` 2026-09-04 — weakest-sourced row in this section, exact Persian phrase never captured verbatim. |
| Diner-visible wait-time estimate / queue position | UNKNOWN | No source addresses this at all. |
| Online prepayment/deposit for reservations | CLAIMED (existence) | `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]` 2026-09-04. Amount/%/trigger: UNKNOWN, no figure ever found across 4 dated passes. |
| Diner-facing cancellation/no-show policy shown pre-booking | UNKNOWN | No page reached, any session. `MATRIX.md`'s own row marks SmartX `UNKNOWN`, not `ABSENT`. |
| Loyalty: purchase-history/RFM segmentation, coupons | CLAIMED | `smartx.ir/services/club/`, `[search-synthesis]` 2026-09-04. "RFM-style" is the researcher's own analytical framing, not confirmed SmartX copy. |
| Gamified "wheel of fortune" add-on | CLAIMED | Same source. No odds/prize-structure detail found. |
| Loyalty earn rate / tier structure / expiry / redemption minimum / referral / streaks / birthday reward | **UNKNOWN, all sub-mechanics** | None found by any session, across 4 dated passes — contrast TheFork's YUMS (100 pts/booking, 1000=£20 off, 1-yr validity, all publicly stated) or SnappFood (10 pts/1,000 Toman), per `profiles/thefork.md` / `profiles/snappfood-loyalty.md`. |
| Churn-risk flagging (staff-facing) | CLAIMED | `smartx.ir/services/club/restaurant/`, `[search-synthesis]` 2026-09-04. Trigger mechanism never described. |
| **Cash incentive tied to phone-number-capture rate (30% off if ≥75%)** | **REAL** | `smartx.ir/pricing/`, `[fetched]` 2026-09-05 — see §2. Independently flagged in `ANTI-PATTERNS.md` #14. |
| SMS-based marketing messaging (restaurant-initiated) | CLAIMED | `smartx.ir/pricing/` (billed separately, pay-as-you-go), `[search-synthesis]` 2026-09-04. |
| Diner-controlled notification opt-out | **ABSENT-leaning**, not confirmed ABSENT | No page of either evidence tier describes a diner-facing opt-out; `MATRIX.md` footnote 30 marks this "ABSENT-leaning." |
| SMS-OTP for WiFi captive-portal login | CLAIMED | `smartx.ir/services/wifi/restaurant/`, `[search-synthesis]` 2026-09-04 — explicitly "for building a marketing database." |
| Diner-facing review/rating feature on a SmartX-branded surface | **ABSENT** | Follows structurally from the already-confirmed fact that no diner-facing consumer surface exists at all — the one row in this inventory with genuine ABSENT confidence rather than UNKNOWN. |
| Photo upload | **ABSENT** | Same reasoning. |
| Independent third-party review-platform presence (App Store/Play/G2/Trustpilot) | **ABSENT — zero found**, reconfirmed by 3 independent 2026-09-07 sessions | `[search-synthesis]` 2026-09-04 + 3× `EGRESS_BLOCKED` fetch attempts 2026-09-07. |
| Restaurant CRM / cross-visit guest recognition ("remembered by name") | REAL (existence of the marketed capability) / UNKNOWN (depth) | `MATRIX.md` footnote 14 — core pitch of Customer Club; unlike Servme (independently corroborated via a named customer, 88,000 profiles over 3 years, per `PARITY-RISK.md` §4), SmartX has zero independent depth corroboration. |
| Cross-tenant / cross-brand data isolation (architecture) | UNKNOWN | No SmartX-specific architecture evidence in either direction. |
| Named POS-reseller ecosystem (Sepidz, Sepidar Sistem, Vendo) | **REAL** (business relationship) | Independently corroborated from *two different companies' own sites* — `smartx.ir/key-partners/` and `sepidz.com/software/smart-x/`, both `[search-synthesis]` 2026-09-04. Stronger evidence than most rows in this corpus. This is a distribution relationship, not proof of a technical API integration. |
| Payment gateway used for prepayment (which one) | UNKNOWN | Existence claimed, no gateway name ever found — contrast Rezervno's confirmed Zarinpal usage. |
| Persian-language UI | **REAL by construction** | Every product name and marketing phrase across all sources is Persian. |
| RTL layout correctness (verified, not assumed) | UNKNOWN | No screenshot, live render, or accessibility-tree read ever obtained. |
| Self-hosted fonts (no Google Fonts dependency) | UNKNOWN | Font-loading behavior requires opening live network requests — never done. |
| Accessibility (touch targets, ARIA, keyboard focus) | UNKNOWN | Never evaluated by any session, for any SmartX surface — a clean, previously-unflagged gap. |
| Offline-tolerant client behavior | UNKNOWN | Never addressed; may not even be structurally applicable given no diner-facing PWA exists. |
| Per-product activation (buy just one line, or stack) | **REAL** (business-model level) | Direct consequence of the published per-product pricing structure, `[fetched]` 2026-09-05. |
| Usage-based vs. flat-subscription billing choice | **REAL** | Both models published side-by-side on the same pricing page, `[fetched]` 2026-09-05. |

**Full 45-row breakdown, evidence-tier distribution (from `features.md`):** REAL/REAL-qualified 6
(13%), CLAIMED 19 (42%), UNKNOWN 18 (40%), ABSENT 2 (4%). **Zero of the 45 rows rest on an
independently observed, working demo of the product** — every REAL/CLAIMED split in the source
corpus is "SmartX's own marketing copy says so" vs. "no one has ever checked," not "verified
working" vs. "marketing only" in the stronger sense a live-demo-based audit would produce.

---

## 5. Review synthesis — reviews read: 0 (across every session, every mode, every date)

**Sample size: 0.** Every one of the 5 corpus files independently confirms this:
`store-reviews.md` (target: 50+ reviews; achieved 0, `WebFetch` returned `EGRESS_BLOCKED` on 9
distinct store/review-platform URLs including a neutral control, `WebSearch` budget-exhausted on
4 queries); `social.md` (0 posts/reviews across Instagram, X/Twitter direct and via nitter,
Telegram, Reddit, LinkedIn, Persian tech press — 8 `WebFetch` attempts, 7 `WebSearch` queries, all
failed); `business.md`, `features.md`, `scale.md` all independently confirm the same zero. The
2026-09-04 base-profile pass, run when `WebSearch` was functional, ran its own social/forum-shaped
sweep (Persian queries for "نظرات," "شکایت," "تجربه من," "مشکل," "پشتیبانی") and also found zero.

**No top-5 complaints or top-5 praises can be reported — there is no sample to draw one from.**
This is not "complaints were searched for and none found while some praise was" or vice versa —
literally zero user-authored text of any kind, positive or negative, from a diner or a restaurant
owner/staff member, has ever been read for SmartX across five dated research touchpoints spanning
2026-09-04 through 2026-09-07.

**The one dated, first-party (not user-authored) signal in the whole corpus:** `smartx.ir/sorry/`,
HTML `<title>` = «اختلالات باشگاه مشتریان | مرداد ماه ۱۴۰۴» (Customer Club disruptions, Mordad 1404
≈ 2025-07-23 to 2025-08-22), `h1` = «ما خودمان را مدیون اعتماد شما می‌دانیم.» ("We consider
ourselves indebted to your trust."). **REAL at the title level only** — `[fetched]` twice,
2026-09-05: the first fetch (prompted for "what incident") returned "there is no apology or
incident on this page"; the second fetch (prompted for the literal title/headers) returned the
title above. The page body contains no incident description, no explicit apology sentence, and no
remedy/credit amount — only forward-looking goodwill language ("خبرهای خوبی در راه است",
"سه ویژگی رایگان جدید این هفته"). This is a company-authored page about itself, not a review, and
is not counted toward the review sample.

**Structural inference, not a confirmed fact:** the leading explanation on record for the zero is
that SmartX is distributed exclusively through B2B POS resellers rather than a self-serve
discovery motion that would organically generate app-store or social-media chatter. Plausible and
consistent with everything else known about SmartX's go-to-market — but a review corpus could
still exist behind a listing (Myket in particular) that no session's tools have ever successfully
opened. Nothing here proves the negative.

---

## 6. Gen-Z lens scorecard

SmartX has almost no direct, brand-visible surface toward a young diner — every consumer
touchpoint is white-labeled through the restaurant. Most of this scorecard is genuinely
unanswerable from outside; each item is marked honestly rather than guessed from B2B marketing
copy written for restaurant owners, not diners.

| Dimension | Finding | Evidence |
|---|---|---|
| Time to first value | UNKNOWN | No live SmartX-powered booking flow or WiFi login was ever found/tested to time by any session. |
| Money respect | Mixed, evidenced for the restaurant-owner-as-customer, not the diner | Annual lock-in (multiple product lines, 21M–199M+ Toman/yr, stackable) plus separately-billed SMS/hardware/gateway fees on top — a classic enterprise-SaaS pattern, not transparent pricing. Sharpened, not softened, by the phone-capture-for-discount mechanic (§2/§4, REAL). For the diner's own money respect (deposit/refund clarity): UNKNOWN. |
| Feels like now | UNKNOWN | No screenshot, demo video, or live instance ever reachable to assess UI modernity. |
| Shareability | UNKNOWN | No share/referral/social mechanic found in either direction (restaurant-to-restaurant or diner-to-diner). |
| Trust | Mixed — one REAL data point, rest CLAIMED/inferred | (a) mandatory SMS-OTP phone capture explicitly for marketing-database building, disclosed in the product's own copy, no user complaint found either way; (b) the one dated, verifiable trust signal is negative-then-recovering — a real service disruption (Mordad 1404) followed by a title-level admission and two consecutive "please don't churn" retention campaigns (`stay-strong`/`stay-strong-2`, unreached-page paraphrase) in the same season. A real, narrow wobble, not a rumor. |
| Notification behaviour | CLAIMED only | Restaurant-initiated marketing SMS is a core, billed feature; diner opt-out is ABSENT-leaning (§4); whether diners are actually over-messaged is UNKNOWN. |
| Steal / never-copy | Inference from what's publicly visible, not a working demo | **Steal:** the "reservation-to-exit" automated POS handoff and CSAT survey tied directly to a completed visit (not a generic app-store review ask) both sound genuinely useful, marketing-copy confirmation only. **Never copy:** a public title-level admission followed immediately by two consecutive retention campaigns suggests a reliability incident big enough to threaten renewals; "contact us" pricing opacity on several tiers is the opposite of transparent, no-surprises pricing a price-sensitive younger audience expects. |

---

## 7. Where it beats Rezervno today

Sourced entirely from the corpus (company-claimed unless otherwise noted) — no repo verification
required for this section per the task's own instructions, since these are claims *about SmartX*,
not claims about Rezervno.

- **An established, zero-incremental-CAC distribution channel through existing POS install bases.**
  SmartX rides on Sepidz's, Sepidar Sistem's, and Vendo's existing restaurant/café POS
  relationships rather than needing its own direct-sales or consumer-marketing motion — a
  genuinely corroborated (two independent company sites), REAL business-model advantage a young
  reservation-only entrant has to build from zero. (`smartx.ir/key-partners/`,
  `sepidz.com/software/smart-x/`, `[search-synthesis]` 2026-09-04.)
- **A broader single-vendor B2B product surface.** Reservation + loyalty/CRM + WiFi customer-data
  capture + CSAT survey collection under one vendor relationship, each separately priced and
  stackable — a restaurant that wants "one bill, one login" for all four gets that from SmartX
  today; whether Rezervno offers an equivalent breadth is out of scope for this document (this
  section characterizes SmartX only, per the task's own split between §7 and §9). (§2/§4, `[fetched]`
  2026-09-05 for the pricing structure itself.)
- **A published, mostly self-serve Toman price list with no sales-call gate for most tiers**
  (Correction 1 in the prior lighter profile's addendum — the original "pricing is behind a sales
  call" reading was wrong; only intermediate volume bands route to a sales line). A restaurant
  owner can see most headline numbers today without a call. (`smartx.ir/pricing/`, `[fetched]`
  2026-09-05.)
- **A decade of continuous market presence** (since 1394/2015-16, per the company's own claim) and
  a possible large-conglomerate backing (Hamkaran Sistem — UNKNOWN, not confirmed) that a newer
  entrant cannot claim regardless of confirmation status of the parent-company link.
- **A monetization mechanic that directly rewards the restaurant for the exact data capture
  behavior (phone numbers) both products want** — the 30%-discount-for-75%-capture-rate mechanic
  is ethically flagged elsewhere in this research line (`ANTI-PATTERNS.md` #14) but it is a real,
  working commercial lever SmartX has and this document does not know whether Rezervno has an
  equivalent one.

---

## 8. Where Rezervno beats it — repo-verified only

Every claim below was independently re-checked against the current repository in this session via
`Grep`/`Read` — not assumed from any doc's claim, including this corpus's own citations.

- **Diners see a real, live waitlist position and ETA — SmartX's equivalent is UNKNOWN whether it
  even exists as a diner-visible feature.** `features.md` §C: "Diner-visible wait-time estimate or
  queue position — UNKNOWN — not verified. No source addresses this at all." Rezervno's customer
  app renders exactly this: a position ring and a live estimated-wait-minutes readout.
  **Verified:** `apps/customer/js/waitlist.js:107-113` — `<div class="wl-position-ring">`, ``<div
  class="wl-pos-num" id="wlPosNum">${faNum(WL.position||'—')}</div>``, and
  `` `حدود <b>${faNum(WL.estimated_wait_minutes||'؟')}</b> دقیقه تا نوبتت` ``.
- **SMS sending fails closed with an explicit, logged error — SmartX's fail-closed behaviour is
  UNKNOWN.** `features.md` §G: "Fail-closed SMS behavior... for SmartX specifically — UNKNOWN — not
  verified... No SmartX-side evidence of this either way exists in the corpus." **Verified:**
  `api/src/lib/sms.ts:278-281` — when a template's `bodyId` is unset, the code takes the explicit
  branch `if (!bodyId) { log.error('bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد', ...); ... }` rather
  than silently sending or fabricating success (comment at line 137 names this "fail-closed عمدی,"
  intentional).
- **A self-hosted Persian font with no Google Fonts dependency — SmartX's font-hosting choice is
  UNKNOWN.** `features.md` §L: "Self-hosted fonts (no Google Fonts dependency) — UNKNOWN — not
  verified... font-loading behavior requires opening the live page's network requests or source,
  never done for SmartX." **Verified:** `shared/fonts/vazirmatn-variable.woff2` exists in the repo
  (111,152 bytes) alongside its OFL license file — a real, checked-in, self-hosted variable font,
  not a claim.
- **A diner-facing PWA with a versioned service-worker cache exists at all — SmartX has no
  diner-facing surface for one to apply to.** `features.md` §H marks SmartX's diner-facing surface
  `ABSENT` outright (no consumer app/marketplace of any kind); §N marks offline behaviour UNKNOWN,
  noting a service-worker-style mode "may not even be structurally applicable" to a product with no
  diner PWA. **Verified:** `apps/customer/sw.js:14-16,40` — `const CACHE_VERSION =
  'rezervno-v41'`, with `SHELL_CACHE`/`RUNTIME_CACHE` keyed off it and an activation-time cleanup
  (`keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))`) that purges
  stale caches on every version bump — a live, functioning offline/freshness mechanism, not a
  claim about one.
- **Tenant isolation is enforced structurally from the auth context, never from request body/query
  — SmartX's cross-tenant isolation is UNKNOWN.** `features.md` §I: "Cross-tenant / cross-brand
  data isolation (architectural, not claimed) — UNKNOWN — not verified... No SmartX-specific
  architecture evidence exists in the corpus either way." **Verified:**
  `api/src/lib/with-restaurant-auth.ts:43` (docstring pattern: `ctx.restaurant.id`, never a
  client-supplied ID) and `:180` (`if (staff.tenantId !== auth.tenantId) throw Err.forbidden();`) —
  a concrete, code-level tenant-boundary check, not a marketing claim.
- **A working diner-facing empty state exists in production code, illustrating the four-mandatory-
  states pattern in practice** — SmartX's exact booking-flow screen count and general diner UI
  behaviour is, per `features.md` §A, "not described anywhere in the corpus" at any level of
  granularity. **Verified:** `apps/customer/js/reservation.js:144` renders a real empty state
  (`<div class="empty-state">... هنوز رزروی نداری ... کشف رستوران‌ها</div>`) when a diner has no
  reservations — a shipped instance of the loading/empty/error/success pattern `CLAUDE.md` mandates,
  not an assertion that the pattern exists.

---

## 9. Corrections to the prior (lighter) profile / MATRIX.md

- **`profiles/smartx.md`'s own 2026-09-05 ADDENDUM already self-corrected two claims** from its
  2026-09-04 base pass: (1) "pricing is ABSENT / behind a sales call" → corrected to a published,
  mostly self-serve Toman price list (with the 2.5× self-contradiction discovered in the same
  fetch pass); (2) the `/sorry/` page → narrowed from "public apology" to "title-level admission
  only, no incident detail in the body." Both corrections are carried forward unchanged into this
  deep profile (§2, §5) — no further correction needed to those two items.
- **`MATRIX.md` footnote 48 is inconsistent with SmartX's own confirmed review count.** It groups
  SmartX with Fidilio/Servme as competitors "where at least some review volume exists," which
  contradicts every one of the 5 corpus files (`reviews_read = 0`, unanimously, across 5 sessions)
  and the base profile's own "Review synthesis" section. Flagged for correction by whoever next
  edits `MATRIX.md` — not corrected here, since this task authorizes writing only to this file.
- **The Customer Club price figure moved between 2026-09-04 and 2026-09-05 without explanation**
  (۳۳.۵–۴۳M → ۵۱M تومان/yr) and the corpus does not resolve whether this is a real price change, a
  different tier being quoted, or a search-synthesis inaccuracy in the earlier pass. Not previously
  flagged as its own line item in the base profile — flagged here for the first time as a distinct
  (smaller) contradiction alongside the well-known 2.5× reservation-price gap.
- **No correction is needed to the base profile's "who it's for" / business-model characterization**
  — every subsequent corpus file (business, features, scale, social, store-reviews) reconfirms it
  without contradiction.

---

## 10. Sources

**Corpus files used (all read in full this session):**
- `docs/audit/research/corpus/smartx/business.md` (2026-09-07)
- `docs/audit/research/corpus/smartx/features.md` (2026-09-07)
- `docs/audit/research/corpus/smartx/scale.md` (2026-09-07)
- `docs/audit/research/corpus/smartx/social.md` (2026-09-07)
- `docs/audit/research/corpus/smartx/store-reviews.md` (2026-09-07)
- `docs/audit/research/profiles/smartx.md` (2026-09-04 base pass + 2026-09-05 addendum)

**Repository files independently verified this session (§9 only):**
- `api/src/lib/sms.ts:137,278-281` (fail-closed SMS on missing `bodyId`)
- `api/src/lib/zarinpal.ts:40` (explicit `currency: 'IRT'` — checked, but not used as a "beats it"
  claim since SmartX's own pricing copy shows no equivalent Rial/Toman confusion either)
- `shared/fonts/vazirmatn-variable.woff2` (existence + size confirmed via `ls`)
- `apps/customer/sw.js:12,14-16,40` (`CACHE_VERSION`, cache-key derivation, stale-cache purge)
- `api/src/lib/with-restaurant-auth.ts:43,180` (`ctx.restaurant.id` pattern; `staff.tenantId !==
  auth.tenantId` check)
- `apps/customer/js/waitlist.js:16,107,109,113` (diner-visible waitlist position + ETA)
- `apps/customer/js/reservation.js:144` (empty-state UI)
- `apps/customer/js/auth.js:60-115` (read for context on the offline-OTP demo path; not cited as a
  competitive claim in §9 — it is a demo/testability affordance, not a differentiator)

**Not consulted this session (per the task's own scope):** `docs/audit/research/MATRIX.md`,
`WATCH.md`, `PARITY-RISK.md`, `ANTI-PATTERNS.md`, and the other competitor profile files were not
re-read in full — only cited where the corpus files themselves cite them, and I did not verify
those citations' accuracy beyond noting the one footnote-48 contradiction already flagged by
`social.md`.

---

## 11. What was NOT verified (this session, in addition to what each corpus file already flags)

- **No new `WebFetch`/`WebSearch` call was made at all in this session**, per the task's own
  token-budget instruction to work from the corpus already on disk. Every SmartX-side claim in
  this document is exactly as fresh (or as stale) as its cited corpus file — nothing here is newer
  first-hand evidence than what already existed on 2026-09-07 before this pass started.
  Consequently, none of the three unreconciled pricing contradictions in §2 were adjudicated, the
  Myket listing's install/rating/review numbers remain unopened, and no SmartX social/forum content
  was newly read.
  - the exact booking-flow step/screen/tap count for SmartX (never described by any source, ever)
  - whether SmartX's "table selection" is diner-facing floor-plan choice or staff-side assignment
  - whether the Customer Club waitlist is a true managed queue or a staff-side triage inbox
  - every named loyalty sub-mechanic (earn rate, tiers, expiry, redemption minimum, referral,
    streaks, birthday reward)
  - accessibility and offline behaviour for any SmartX surface
  - RTL layout correctness and font-hosting choice for SmartX (as distinct from Persian-language
    content existing, which is effectively certain)
  - any diner deposit amount/%/trigger, no-show fee, or refund window
  - the "quarterly renewal terms" claim (still one hop from its primary source, page never fetched)
  - whether the unconfirmed Hamkaran Sistem parent-company claim is accurate
  - MAU, venue count, city list, funding, revenue, GMV, acquisition price, LinkedIn headcount, or
    any specific current job-posting title
- **The MATRIX.md footnote 48 contradiction was flagged, not corrected** — this document does not
  edit `MATRIX.md`, per the task's explicit file-scope instruction.
- **Whether any of the corpus's "REAL" repo-adjacent framing (e.g. `MATRIX.md` footnote citations
  the corpus quotes) is itself accurate was not re-checked**, except where I independently verified
  a Rezervno-side repo citation myself in §9 — the SmartX-side citations in §2–§7 are reproduced as
  the corpus recorded them, at their original evidence tier, not re-verified against a live SmartX
  page by me.
