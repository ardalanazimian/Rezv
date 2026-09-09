# SnappFood — Business Model, Pricing & Terms (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SnappFood (اسنپ‌فود), key `snappfood`, tier `iran`_
_Mode: BUSINESS MODEL, PRICING, TERMS_

## Headline finding — read this before anything else

**This session could gather zero new evidence.** Both mandated evidence channels were tested first,
per protocol, and both were unavailable before a single new page or search result could be read:

- `WebFetch` → `EGRESS_BLOCKED` on the neutral control (`example.com`) **and** on the primary target
  (`snappfood.ir`).
- `WebSearch` → the session's search budget was already at **200 of 200 calls** before my first query
  ran. The tool returned its budget-exhausted message verbatim, not a search result.

This exactly reproduces what the same-day `corpus/snappfood/store-reviews.md` pass (also 2026-09-07)
found and reported, and is consistent with the 2026-09-04 `profiles/snappfood-loyalty.md` pass, which
also hit `EGRESS_BLOCKED` on both `example.com` and `snappfood.ir` via `WebFetch` (that session's
`WebSearch` did work that day — this session's does not, because the shared budget is already spent).

Per the task's own rule ("Evidence or UNKNOWN" / "0 is a valid answer" / "never pad to hit a target"),
`reviews_read = 0` for this session, and no pricing page, ToS page, or changelog was newly fetched or
newly searched. Everything below is **prior evidence carried forward from earlier Scout sessions**,
re-labeled precisely against this mode's specific asks (exact figures, currency, contract terms,
diner-side money, refund windows, loyalty redemption minimums, coupon-funding source), with every gap
the mode asks about stated as UNKNOWN rather than silently omitted.

## Methodology — first action taken, per protocol

**Step 1 — WebFetch test (control + primary target):**

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` (neutral control) | `EGRESS_BLOCKED` — `"Access to example.com is blocked by the network egress proxy."` |
| 2 | `https://snappfood.ir` (primary target) | `EGRESS_BLOCKED` — `"Access to snappfood.ir is blocked by the network egress proxy."` |

The control failing identically to the real target confirms a blanket session-level egress block, not
a per-domain one. I did not spend further `WebFetch` calls on `vendors.snappfood.ir` (restaurant
partner/pricing pages), `snapp.ir/blog/club/`, `snapp.ir/pro/`, or any ToS/terms URL — the 2/2 result
on a control + primary target is sufficient per this repo's own established pattern (see the identical
call made by `store-reviews.md`, 2026-09-07, and `snappfood-loyalty.md`, 2026-09-04).

**`webfetch_worked = false` for this session.**

**Step 2 — WebSearch fallback, per the task's own instruction ("if EGRESS_BLOCKED, fall back to
WebSearch with MANY differently-phrased queries"):**

I attempted one query, phrased specifically for this mode's commission/contract focus, before
confirming the budget ceiling already reported by the sibling `store-reviews.md` session earlier
today:

1. `اسنپ فود کمیسیون رستوران قرارداد درصد`

Result, verbatim: *"Web search was not performed: this session has used its web search budget (200 of
200 WebSearch calls). Continue with the information already gathered instead of issuing more searches.
If more searches are genuinely needed, ask the user to raise
CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION."*

I did not burn further calls repeating a request the tool had already announced was closed session-
wide (the budget is evidently shared across concurrent research passes in this same underlying
session/conversation, since the `store-reviews.md` pass reported the identical 200/200 ceiling earlier
the same day, from different query text). Re-running would not produce a different result.

**`websearch_worked = false` for this session (0 of 1 queries returned any content; stopped after
confirming the same ceiling the sibling session already hit, rather than spending further calls against
a channel already reported closed).**

## Prior evidence carried forward — mapped against THIS mode's exact checklist

The only prior Scout material touching SnappFood's commercial terms at all is
`profiles/snappfood-loyalty.md` (2026-09-04 session, loyalty-scoped, not this mode) plus two `WATCH.md`
entries (2026-09-04). None of it was gathered under this mode's specific brief (pricing pages, plan/
tier/add-on figures, contract length, diner-side deposits/no-show/refund, redemption minimums), so it
is re-presented here mapped explicitly onto this mode's checklist, with every unmapped item marked
UNKNOWN rather than left silently absent. **Nothing below was re-verified this session — it is cited,
not re-fetched.**

### 1. Pricing pages and plan/tier/add-on figures (exact figures, Toman vs Rial)

| Item | Status | Detail | Currency | Source & date |
|---|---|---|---|---|
| Restaurant commission rate | CLAIMED (third-party, not SnappFood's own page) | Roughly **15–20% of restaurant sales**, exact rate set per-contract; both flat-percentage and tiered/revenue-based structures reported | Not stated (commission is a %, not a flat Toman/Rial figure in this source) | `restobazar.com/mag/snapp-food-rules-for-restaurants/` (third-party restaurant-advisory magazine), via `snappfood-loyalty.md`, accessed 2026-09-04 |
| VAT on commission | CLAIMED (same source) | **9% VAT** deducted on the commission amount before restaurant payout | — | same source, 2026-09-04 |
| SnappFood's own public commission-rate disclosure | **UNKNOWN — not verified.** No prior session found SnappFood's own published pricing/commission page (e.g. a `vendors.snappfood.ir` pricing tab); this mode's own attempt to fetch `vendors.snappfood.ir` directly was blocked before it could try | — | — |
| Snapp Pro (اسنپ پرو) — paid subscription | CLAIMED (existence: REAL; benefit-value framing: CLAIMED) | **~22,500 Toman/month** reported, with 3-month and 6-month options also reported; spans 5 Snapp verticals (ride-hailing, food, express-supermarket, shop, doctor/consultant). Food-specific benefit: free delivery up to 25,000 Toman/order, plus 5–20% discounts. Marketing claims up to 5,000,000 Toman/month in value — **this specific ROI figure is unverified marketing copy**, not measured against real usage | **Toman**, explicit | `blog.mopon.ir/اسنپ-پرو/`, `snapp.ir/pro/`, `dmboard.media/news/snapp-pro/`, `express.snapp.market/academy/blog/snapp-pro-account/`, via `snappfood-loyalty.md`, accessed 2026-09-04 |
| Any other named plan/tier/add-on (e.g. restaurant-facing "featured placement," ad packages, delivery-radius tiers) | **UNKNOWN — not verified.** No prior session searched for or found a restaurant-facing ad/placement pricing menu (contrast: SmartX and RSEE profiles both found and priced these; SnappFood's equivalent was never searched for under this specific angle) | — | — |

### 2. Commission % and who pays

- **REAL structurally, CLAIMED numerically.** The **restaurant** pays SnappFood's commission (not the
  diner) — this is the standard food-delivery-marketplace structure and is consistent across every
  source found, though no source states it in those exact words; it is inferred from the commission
  being charged against "restaurant sales" and deducted before restaurant payout.
- The **existence** of commission-rate leverage tied to exclusivity is **REAL and independently
  confirmed** — not by a pricing page, but by a government ruling: Iran's Competition Council, decision
  **No. 740, dated ۱۶ اردیبهشت ۱۴۰۴ (≈2025-05-06)**, on complaints from rivals TapsiFood and Zoodex,
  found SnappFood offered **restaurants a lower commission rate in exchange for exclusive cooperation**,
  with exit penalties for restaurants that tried to work with competing platforms. An appeals board
  later confirmed the ruling; SnappFood's request for reconsideration was rejected; exclusivity clauses
  were **ordered removed from all contracts, existing and future**. [`WATCH.md` 2026-09-04 entry, citing
  Zoomit (`zoomit.ir/iran-news/456136-snappfood-monopoly-verdict-tapsi-zoodex/`), Digiato
  (`digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood`),
  ensafnews (`ensafnews.com/591739/`), and the Council's own decision page
  (`nicc.gov.ir/council/decisions-council/2184-740-16-1404.html`)] — this is the single strongest,
  most independently-sourced fact in this whole corpus, because it comes from a regulator's own ruling,
  not a marketing page or a review.

### 3. Contract length, auto-renewal, exclusivity

- **Exclusivity clause: REAL (regulatory finding), and REAL that it has since been ordered removed.**
  Per decision No. 740 above — this is the single item in this mode's checklist with the strongest
  evidence in the whole corpus, precisely because it is a **regulator's ruling**, not a company claim.
  It directly means: as of ≈2025-05-06 (the ruling date; SnappFood's actual compliance/removal timeline
  not independently verified), SnappFood's restaurant contracts are **not supposed to** contain a clause
  forcing single-platform use or penalizing exit for working with a competitor — but whether this was
  actually implemented in every live contract, and whether new contract language re-introduces a softer
  version of the same lever, is **UNKNOWN — not verified** (no prior session read an actual, current
  SnappFood restaurant contract).
- **Contract length (fixed term? month-to-month?), auto-renewal clause, notice period to exit:**
  **UNKNOWN — not verified.** No prior session found or read SnappFood's actual restaurant-facing
  contract text or ToS. This is a genuine, stated gap, not an assumption of "none exists."

### 4. Diner-side money: deposits, no-show/cancellation fees, refund windows

- **Structurally different from a table-reservation platform, and this matters for how to read the
  gap.** SnappFood is a food-**delivery** marketplace, not a table-booking platform — there is no
  "no-show" concept in the reservation sense. The closest analogues are: order-cancellation policy,
  and whether/when a diner is charged if a restaurant or courier fails to fulfill.
- **Order-cancellation fee/policy, and at what point in the flow it is shown to the diner:**
  **UNKNOWN — not verified.** No prior session searched for or found SnappFood's cancellation-fee
  policy or refund-window text.
- **Refund windows (how long a refund takes, and under what conditions):** **UNKNOWN — not verified.**
- **A related, dated complaint pattern exists but does not answer this cleanly** — from
  `snappfood-loyalty.md`, sourced to SNN and YJC news coverage (not SnappFood's own ToS): a recurring
  complaint pattern of **money deducted from a user's bank account without the order registering in the
  app**, and **delayed or non-delivered orders with unclear compensation** when a restaurant/courier
  fails to fulfill. [SNN `snn.ir/fa/news/1146095/`, YJC `yjc.ir/fa/news/8734093/`, both titled
  "بی‌تفاوتی اسنپ‌فود نسبت به اعتراض کاربران" ("SnappFood's indifference to user protests"), via
  `snappfood-loyalty.md`, accessed 2026-09-04] This is evidence that **when** money is at risk, the
  path to resolution/refund is reported as opaque and slow by users — but it is a news-article synthesis
  of a complaint pattern, not a quoted refund-policy clause, and it predates this mode's specific ask.
  It does **not** establish an actual stated refund window.
- **No deposit mechanic of any kind found** — SnappFood is pay-at-order (or pay-on-delivery, per
  standard Iranian food-delivery norms), not a reservation-style pre-authorized deposit; no prior
  session found or contradicted this. Marked **UNKNOWN — not verified** rather than ABSENT, since no
  session specifically searched SnappFood's payment-flow/deposit mechanics.

### 5. Loyalty redemption minimums

Carried forward from `snappfood-loyalty.md` (search-synthesis, via `mopon.ir`/`offch.com` coupon
aggregators, accessed 2026-09-04 — **not** SnappFood's own redemption screen, so labeled
search-synthesis, not REAL-confirmed-by-primary-source):

| Snapp Club points required | Reward | Notes |
|---|---|---|
| 1,600 points | 60,000 Toman discount code, first food order | |
| 600 points | 100,000 Toman Snapp Market discount | cross-vertical, not food-specific |
| 900 points | 55,000 Toman express-supermarket discount | cross-vertical |
| 1,200 points | 54,000 Toman Snapp pharmacy discount | cross-vertical |

Earn rate: **10 Snapp Club points per 1,000 Toman spent**, confirmed applicable to food orders
specifically (per a follow-up query in the source session). Redemption is **not automatic** — points
convert to a discount **code** the user must separately find and paste at checkout, not a direct
balance deduction. Redemption menus reportedly **vary per user**, meaning there may be no single fixed
"minimum" — this is stated as a caveat by the source, not resolved. Points expire on a **fixed
biannual clock (end of spring, end of fall)**, not per-transaction. [`snapp.ir/blog/club/`,
`snapp.ir/blog/points-expiry/`, via `snappfood-loyalty.md`]

**This mode's specific ask — "loyalty redemption minimums" — is therefore only partially answered:**
the four price-points above are real examples with real point-costs, but whether there is a single
platform-wide *minimum* balance required before any redemption is possible is **UNKNOWN — not
verified**.

### 6. Coupon/discount funding: platform vs. restaurant

**This is the best-evidenced item in this mode's whole checklist**, carried forward verbatim from
`snappfood-loyalty.md`:

- Directional answer found (search-synthesis, secondary/marketing-adjacent source, not a first-person
  restaurant-owner quote): *"رستوران‌ها خود کد تخفیف را برای جذب مشتری‌های بیشتر پیشنهاد می‌دهند و
  هزینه این تخفیف‌ها بر عهده رستوران است"* (restaurants themselves offer the discount code to attract
  more customers, and the cost of these discounts is borne by the restaurant). [search-synthesis of a
  query combining coupon-culture and restaurant-commission phrasing, accessed 2026-09-04, source URL
  not individually pinned by that session]
- Reinforced by SnappFood's own vendor-academy content describing a **"پارتی دخل‌فود" ("Dakhl-e-Food
  Party") tool that restaurants themselves opt into and activate** — implying restaurant-initiated, not
  platform-subsidized-by-default, promotions. [`vendors.snappfood.ir` campaign pages, via
  `snappfood-loyalty.md`, accessed 2026-09-04 — not independently re-fetched this session, blocked]
- **A dated, specific complaint about discount authenticity** (Tejaratnews, published **2023-03-04** —
  outside this mode's preferred 12-month recency window, flagged as such): a user reported a food item
  priced at 120,000 Toman being "discounted" via FoodParty to 80,000 Toman, but the restaurant's own
  delivery invoice showed 80,000 Toman as the **undiscounted** price — i.e. the discount was allegedly
  manufactured by inflating the sticker price first. A paraphrased tweet was cited by the source
  session as: *"اسنپ فود قیمت غذاها را بالا برد و در فودپارتی گذاشت!"* — that source session itself
  flagged this as **possibly a paraphrase, not confirmed verbatim tweet text**, and it carries no
  reviewer handle. I am preserving that same caveat here rather than upgrading its evidence status.
  [`tejaratnews.com/startup/تخفیف-سفارش-غذا`, via `snappfood-loyalty.md`]
- **Net finding for this mode:** consumer-facing SnappFood discounts (FoodParty, first-order coupons)
  are, per the best evidence available, predominantly **restaurant-funded**, not platform-subsidized —
  restaurants trade margin for order volume/visibility. SnappFood's own commission on the
  (discounted-or-not) order total is not shown to be reduced by these promotions in any source found.
  This is **CLAIMED/circumstantial** (secondary source + one dated authenticity complaint + the vendor
  tool's opt-in framing), **not a confirmed line-item financial audit** — no session has a named
  restaurant-owner testimonial saying "SnappFood discounts cut into my margin."

### 7. Changelogs / release notes

**UNKNOWN — not verified. No prior session found or read a SnappFood changelog/release-notes page**
(contrast: the `snappfood-loyalty.md`/`store-reviews.md` lineage never targeted Cafe Bazaar's "What's
new" section or a Google Play release-notes history for `com.zoodfood.android`). This mode's own
attempt to reach any such page was blocked at the `WebFetch`/`WebSearch` stage before a URL could be
chosen.

### 8. Terms-of-service pages

**UNKNOWN — not verified.** No prior Scout session has read SnappFood's actual ToS document. What
exists instead is **indirect, regulatory evidence about one specific ToS provision** (the exclusivity
clause, via the Competition Council ruling above) — which is real and strong, but is not the same as
having read the ToS page itself. No findings exist on: data-retention terms, dispute-resolution
process, liability limitations, or the diner-facing terms diners agree to at signup.

## Contradictions between the company's own pages, recorded verbatim, not resolved

**None found this session**, because no company page was reached this session (or, per the record
above, in either prior SnappFood-touching session — `snappfood-loyalty.md` and `store-reviews.md` both
report `WebFetch` blocked throughout their own passes too). This mode's specific instruction — "record
contradictions between the company's own pages verbatim" — could not be attempted at all, since zero
SnappFood-owned pages have ever been directly read by any Scout session to date. This is stated
explicitly rather than left as a silent omission.

One **inter-source tension worth flagging**, not a same-company contradiction: the Competition
Council's ruling frames SnappFood's commission "discounts" as an anticompetitive **lever tied to
exclusivity** (i.e., a restaurant-facing pricing weapon), while the restobazar.com commission-range
source (15–20% + 9% VAT) describes commission as if it were closer to a flat, contract-set number. Both
can be true simultaneously (a baseline range that is then adjusted downward as an exclusivity
incentive), but no single source ties the two together with an exact before/after percentage — that
specific number (what commission rate applied before vs. after an exclusivity deal) is **UNKNOWN — not
verified**.

## What this mode's evidence checklist required and could not be attempted this session

1. SnappFood's own pricing/commission page (if one exists) — not reached, `WebFetch` blocked.
2. `vendors.snappfood.ir` restaurant-partner terms/plans pages — not reached.
3. SnappFood ToS / terms-of-service page — not reached.
4. Cafe Bazaar / Google Play / App Store changelog or "What's new" sections — not reached.
5. Any SnappFood press release or blog post specifically about pricing changes — not reached; the one
   `WebSearch` query attempted (commission/contract-focused) returned the budget-exhausted message
   before any result could load.
6. A first-person restaurant-owner account of commission economics, exclusivity pressure, or
   discount-funding — not found in any prior session either; remains **UNKNOWN**.
7. Snapp Pay integration terms (SnappFood's in-house payment/BNPL arm, if used for order payment or
   restaurant payout) — never investigated by any prior session; **UNKNOWN — not verified**, flagged
   here because the task's hints did not name it but it is plausibly relevant to "diner-side money" and
   is worth a future session's attention.

## Sources

**Attempted, not reached (WebFetch, both `EGRESS_BLOCKED`), accessed 2026-09-07:**
- https://example.com (control)
- https://snappfood.ir (primary target)

**Attempted, not reached (WebSearch, budget exhausted at 200/200), accessed 2026-09-07:**
- `اسنپ فود کمیسیون رستوران قرارداد درصد`

**Prior evidence cited, not re-verified this session** (all originally accessed 2026-09-04 by the
`profiles/snappfood-loyalty.md` session, via `WebSearch` synthesis — that session's own `WebFetch` was
also `EGRESS_BLOCKED` on both `example.com` and `snappfood.ir`, so none of the following were directly
read by a human-equivalent page-fetch by any Scout session to date):
- https://snapp.ir/blog/club/ — "اسنپ‌کلاب؛ باشگاه مشتریان اسنپ با جوایز متنوع در خدمت شماست!"
- https://snapp.ir/blog/points-expiry/ — Snapp Club points-expiry rules
- https://myclub.snapp.ir/vendors/food/ — Snapp Club's SnappFood coupon hub
- https://blog.mopon.ir/اسنپ-پرو/ — Snapp Pro subscription explainer (third-party)
- https://snapp.ir/pro/ — Snapp Pro landing page
- https://dmboard.media/news/snapp-pro/ — Snapp Pro launch coverage
- https://express.snapp.market/academy/blog/snapp-pro-account/ — Snapp Pro merchant-side benefits
- https://vendors.snappfood.ir/ (vendor-scoring, comment-management, "پارتی دخل‌فود" campaign pages) —
  SnappFood's own restaurant/vendor academy content
- https://www.mopon.ir/کد-تخفیف-اسنپ-فود/... and https://www.offch.com/shops/snappfood — coupon
  aggregators (third-party)
- https://tejaratnews.com/startup/تخفیف-سفارش-غذا — "شیوه عجیب تخفیف اسنپ فود در فودپارتی!" (2023-03-04)
- https://ensafnews.com/455226/... — "تخفیف دو سر سود؛ مزایای کد تخفیف اسنپ فود برای کاربران و
  رستوران دارها"
- https://snn.ir/fa/news/1146095/... and https://www.yjc.ir/fa/news/8734093/... — "بی‌تفاوتی اسنپ‌فود
  نسبت به اعتراض کاربران"
- https://restobazar.com/mag/snapp-food-rules-for-restaurants/ — restaurant-advisory magazine's
  commission/contract-rules summary
- https://www.zoomit.ir/iran-news/456136-snappfood-monopoly-verdict-tapsi-zoodex/ ;
  https://digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood ;
  https://ensafnews.com/591739/... — Competition Council decision No. 740 coverage
- https://www.nicc.gov.ir/council/decisions-council/2184-740-16-1404.html — the National Competition
  Council's own decision page
- https://www.shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked ;
  https://digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform ;
  https://www.tasnimnews.com/fa/news/1402/10/10/3014883/... — SnappFood data-breach coverage
  (10 Dey 1402 / ≈2023-12-31)
- `docs/audit/research/profiles/snappfood-loyalty.md` — full source profile (2026-09-04)
- `docs/audit/research/WATCH.md` — two SnappFood entries (breach; Competition Council ruling),
  2026-09-04
- `docs/audit/research/corpus/snappfood/store-reviews.md` — sibling same-day (2026-09-07) session,
  confirms identical tool-availability wall

## What I did NOT verify

1. **No new page or search result this session** — `WebFetch` blocked on control + primary target;
   `WebSearch` budget already at 200/200 before the first query. This is the master gap behind every
   item below.
2. SnappFood's own published commission rate (only a third-party range: 15–20% + 9% VAT).
3. Exact contract length, auto-renewal terms, and notice-to-exit period for restaurant contracts.
4. Whether the Competition-Council-ordered removal of exclusivity clauses was actually implemented in
   live contracts, and by when.
5. Diner-side order-cancellation fee policy and refund-window timing — no source found at all.
6. Whether a deposit or pre-authorization mechanic exists on the diner side.
7. A single, platform-wide minimum point balance for loyalty redemption (only specific point-cost
   examples were found, and redemption menus reportedly vary per user).
8. Any SnappFood changelog, release notes, or dated pricing-change announcement.
9. SnappFood's actual ToS document — only one indirect, regulatory-sourced data point about a single
   clause (exclusivity) exists across all Scout sessions to date.
10. Snapp Pay's role, if any, in order payment or restaurant payout terms — never investigated.
11. Whether the exact commission-rate delta before/after an exclusivity arrangement is known anywhere
    — it is not, in any source found.

## Structured-output note

`reviews_read = 0`. `webfetch_worked = false`. The `complaints`/`praises` arrays in the structured
summary are populated only from the one dated, sourced item that fits this mode (the FoodParty
discount-authenticity complaint, 2023-03-04, sample_size = 1, search-synthesis, outside the 12-month
recency window and flagged as such) — no other complaint/praise text meeting this mode's
verbatim-quote-or-labeled-paraphrase bar was found. `key_claims` and `numbers` draw only from the
prior-evidence table above, each labeled by its original evidence type (company-claimed / independent /
search-synthesis) exactly as the source session labeled it — nothing has been silently upgraded in
confidence by being restated here.
