# SnappFood — Observed Feature Inventory (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SnappFood (اسنپ‌فود), key `snappfood`, tier `iran`_
_Mode: OBSERVED FEATURE INVENTORY (booking/ordering flow, table selection, waitlist, deposits,
cancellation display, loyalty mechanics, notifications, reviews/photos/social, CRM/segmentation,
marketing automation, POS/payment integrations, languages/RTL/Persian digits, accessibility, offline
behaviour, plus what the RESTAURANT can configure)_

## Headline finding — read this before anything else

**Two things are true at once and both must be stated up front, honestly, rather than picked between.**

1. **This session gathered zero new evidence.** Both mandated evidence channels were tested by me,
   independently, as the FIRST ACTION — not inherited on trust from the three sibling same-day sessions
   that already hit the identical wall (`corpus/snappfood/business.md`, `corpus/snappfood/social.md`,
   `corpus/snappfood/store-reviews.md`, all 2026-09-07):
   - `WebFetch` → `EGRESS_BLOCKED` on the neutral control (`https://example.com`) **and** on the primary
     target (`https://snappfood.ir`). Verbatim: *"Access to example.com is blocked by the network
     egress proxy."* / *"Access to snappfood.ir is blocked by the network egress proxy."*
   - `WebSearch` → my one query (`اسنپ فود رزرو میز رستوران` — "SnappFood restaurant table
     reservation", chosen specifically to test this mode's central question: does SnappFood have any
     table-booking surface at all) returned the tool's own budget-exhausted message verbatim: *"this
     session has used its web search budget (200 of 200 WebSearch calls)."* The shared session budget
     that the three sibling passes reported exhausted earlier today is confirmed still exhausted, on my
     own independent call, not assumed.
   - `webfetch_worked = false`, `websearch_worked = false` for this session. `reviews_read = 0`.
2. **This is not, however, a session with nothing to report.** Two prior Scout sessions —
   `profiles/snappfood-loyalty.md` (2026-09-04, working `WebSearch` that day) and the three same-day
   2026-09-07 corpus passes above (working `WebFetch`/`WebSearch` earlier in that shared session, before
   the budget hit ceiling) — already gathered a real, citable evidence base that touches several of this
   mode's specific checklist items (loyalty mechanics in detail; vendor-side tooling fragments;
   commission/exclusivity terms; a data breach). None of it was previously organized under *this* mode's
   exact 15-item checklist (booking flow / table selection / waitlist / deposits / cancellation display /
   loyalty sub-mechanics / notifications+opt-out / reviews+photos+social / CRM+segmentation / marketing
   automation / POS+payment / languages+RTL / accessibility / offline / restaurant-configurable
   settings). That mapping is what this file does — re-organizing and re-labeling prior evidence
   precisely against this mode's lens, per the task's "extend rather than repeat" instruction, with every
   unmapped item stated as UNKNOWN rather than silently dropped or invented.

**The single most important structural finding for this mode, stated plainly:** SnappFood is a
**food-delivery and pickup-ordering marketplace**, not a table-reservation platform. Every source found
across every Scout session to date — SnappFood's own vendor-academy content, third-party
restaurant-advisory coverage, the Competition Council ruling, coupon aggregators, news coverage of
breaches and complaints — describes it exclusively in ordering/delivery/courier terms. **No source in
any session, including this one's own targeted query above, has ever surfaced a table-reservation,
table-level selection, or waitlist feature for SnappFood.** This is the load-bearing fact behind most of
the "ABSENT (structural)" labels below, and it is flagged with its own evidence-quality caveat rather
than asserted as a hard, directly-observed absence (see the label note in the table).

## Methodology — first action taken, per protocol

**Step 1 — WebFetch test (control + primary target), before anything else:**

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` (neutral control) | `EGRESS_BLOCKED` — "Access to example.com is blocked by the network egress proxy." |
| 2 | `https://snappfood.ir` (primary target) | `EGRESS_BLOCKED` — "Access to snappfood.ir is blocked by the network egress proxy." |

The control failing identically to the real target confirms a blanket session-level network-egress
policy, not a per-domain block — the fourth consecutive same-week Scout session to independently
reproduce this exact result (`snappfood-loyalty.md` 2026-09-04; `business.md`, `social.md`,
`store-reviews.md`, all 2026-09-07). I did not spend further `WebFetch` calls on `vendors.snappfood.ir`,
`cafebazaar.ir/app/com.zoodfood.android`, `myket.ir/app/com.zoodfood.android`, or
`play.google.com/store/apps/details?id=com.zoodfood.android` — a 2/2 blanket-block result including a
neutral control is sufficient to extrapolate, consistent with how every sibling session this week
treated the identical finding.

**`webfetch_worked = false` for this session.**

**Step 2 — WebSearch fallback, per the task's own instruction:**

| # | Query | Result |
|---|---|---|
| 1 | `اسنپ فود رزرو میز رستوران` ("SnappFood restaurant table reservation" — chosen deliberately to test this mode's central open question rather than repeat a query a sibling session already ran) | Budget-exhausted message (200/200), verbatim, no search content returned |

I stopped after one query rather than repeating the 8-query and 2-query patterns the `store-reviews.md`
and `social.md` sibling sessions already ran against the same exhausted budget earlier today — a second
or third identical failure against a channel the tool itself reports as closed (200 of 200) would not be
new information. The task's own escalation instruction ("ask the user to raise
`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`") is recorded here again for whoever next has a fresh budget.

**`websearch_worked = false` for this session (0 of 1 query returned any content).**

## Prior research read first, per task instruction — this corpus extends, does not repeat

Read in full before writing anything below, per the task's explicit instruction to read the matching
profile first:
- `docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04) — the deepest existing SnappFood
  material; loyalty-scoped but contains the only restaurant-vendor-tooling fragments, commission/
  exclusivity findings, and review-aggregate figures found to date.
- `docs/audit/research/corpus/snappfood/business.md` (2026-09-07, same day, earlier session) —
  commission/pricing/contract-terms mapping; also zero-new-evidence, prior-evidence-only.
- `docs/audit/research/corpus/snappfood/social.md` (2026-09-07, same day, earlier session) —
  restaurant-owner-side and social-sentiment mapping; also zero-new-evidence, prior-evidence-only.
- `docs/audit/research/corpus/snappfood/store-reviews.md` (2026-09-07, same day, earlier session) —
  confirms zero individually-quoted, handle-attributed SnappFood store reviews exist anywhere in the
  research line to date.
- `docs/audit/research/MATRIX.md` — confirmed SnappFood is **not** a column in the
  "Reservation & commercial-terms capabilities" table at all (only in the "Loyalty & rewards-mechanics"
  table); the matrix's own header note states *"SnappFood — included only in the loyalty-relevant rows
  below, marked N/A elsewhere."* This is independent, prior confirmation — from a different Scout pass,
  on a different day, for a different purpose — of this file's own headline finding that SnappFood is
  not a reservation competitor.
- `docs/audit/research/WATCH.md` — SnappFood's two dated incident entries (data breach; Competition
  Council ruling), both 2026-09-04.
- The task also named `fidilio`, `smartx`, `foodism`, `servme`, `thefork`, `opentable-resy-sevenrooms`,
  and `iran-reservation-longtail` as profiles to check. I grepped
  `profiles/iran-reservation-longtail.md` and `recon-notes-global.md` for any SnappFood mention — **zero
  hits in either.** SnappFood is not discussed in the Iran-reservation-longtail profile at all, which is
  itself informative: that profile covers Iran's actual table-reservation-shaped platforms, and
  SnappFood's absence from it is a second independent corroboration that no Scout session has ever
  classified SnappFood as belonging to that category.

### Contradiction check against existing profiles

**None found.** Every figure carried forward below is cited to its original session and label
(company-claimed / independent / search-synthesis) exactly as that session used it — nothing is
upgraded in confidence by being restated here. One point worth flagging as a **methodological
consistency**, not a contradiction: `MATRIX.md`'s "Reservation & commercial-terms capabilities" table
excludes SnappFood as a column entirely (treating reservation-flow questions as N/A by construction),
while this mode's brief explicitly asks me to inventory booking-flow/table-selection/waitlist/deposit
items for SnappFood anyway. I have done so below, but every such row is labeled **ABSENT (structural)**
with its evidence-quality caveat rather than silently following `MATRIX.md`'s precedent of omitting the
column — the task's own brief takes priority over a prior document's scoping choice, per this
constitution's zero-trust rule that prior documents are claims, not authority.

## Evidence-quality note on "ABSENT (structural)" labels below

Per this task's strict evidence rule, `ABSENT` should mean "looked directly, not there." **No Scout
session, including this one, has ever directly loaded a live SnappFood app screen, website page, or app-
store listing** — `WebFetch` has been `EGRESS_BLOCKED` on `snappfood.ir` in all four sessions that tried
it. Strictly, the evidence behind every reservation-shaped "ABSENT" row below is: (a) a specific,
deliberately-phrased `WebSearch` query this session («اسنپ فود رزرو میز رستوران») returning zero
content because the budget was already exhausted, not because a live search ran and confirmed absence;
and (b) the **consistent, repeated pattern across roughly a dozen independent `WebSearch`-synthesis
passes over two separate days** (2026-09-04 and 2026-09-07) — none of which, across dozens of
differently-phrased queries touching SnappFood's business model, vendor tools, commission structure, or
consumer complaints, ever surfaced a table-booking, table-selection, or waitlist feature, despite several
of those queries being adjacent enough (e.g. commission/contract queries, vendor-tooling queries) that a
table-reservation feature would plausibly have surfaced if prominent. I am labeling these rows **ABSENT
(structural, by consistent search-synthesis pattern — not a directly-loaded live page)** rather than a
bare `ABSENT`, so the label's evidence tier is not overstated, and rather than a bare `UNKNOWN`, so the
real weight of a dozen independent misses across two days is not understated either.

---

## Full feature inventory

### 1. Booking / ordering flow

| Item | Status | Detail | Source & date |
|---|---|---|---|
| Table reservation flow (browse → select table/time → confirm) | **ABSENT (structural)** — see evidence-quality note above | No source in any Scout session (≈2 dozen `WebSearch` queries across 2026-09-04 and 2026-09-07, this session's own targeted query included) has ever described a table-booking flow for SnappFood. Every description of SnappFood's core product is delivery/pickup food-ordering. | This session's own query; `profiles/snappfood-loyalty.md`, `corpus/snappfood/business.md`, `corpus/snappfood/social.md` |
| Food-delivery/pickup ordering flow — specific steps/screens/taps | **UNKNOWN — not verified** | No Scout session has walked through the live app or website to document the actual screen sequence (search/browse → restaurant page → menu → cart → checkout → payment method → tracking). I am explicitly declining to fill this in from general pretrained knowledge of food-delivery-app UX patterns, since the task's evidence rule requires a source URL + date for every claim, and none exists in the corpus for this specific item. | — none found; gap stated honestly rather than inferred |
| Order tracking / live courier tracking | **UNKNOWN — not verified** | Not addressed by any source in the corpus. Plausible given the product category (courier-trip data is referenced in the breach coverage — "160M+ courier trips" — which implies a live-tracking-capable operational model, but that is inferred from a breach's data-category list, not a confirmed UI feature) | Inferred only from `WATCH.md`'s breach entry ("880M+ product orders, 160M+ courier trips" in the leaked dataset), 2026-09-04 sourcing — flagged explicitly as an inference, not a direct feature confirmation |
| Pickup (self-collection) option, distinct from delivery | **UNKNOWN — not verified** | Not addressed by any source in the corpus | — none found |

### 2. Table-level selection

| Item | Status | Detail |
|---|---|---|
| Table-level selection (choosing a specific table/seating area) | **ABSENT (structural)** — see evidence-quality note above | Same basis as row 1: consistent absence across every session's search activity, no live page ever loaded to confirm directly |

### 3. Waitlist

| Item | Status | Detail |
|---|---|---|
| Waitlist / join-a-queue-for-a-table feature | **ABSENT (structural)** — see evidence-quality note above | Same basis as rows 1–2 |
| Order-queue / "restaurant is busy, estimated wait" delivery-side equivalent | **UNKNOWN — not verified** | Not addressed by any source; plausible for a delivery marketplace at peak demand but never confirmed or searched for specifically |

### 4. Deposits / prepay

| Item | Status | Detail |
|---|---|---|
| Reservation deposit / pre-authorization for a table | **ABSENT (structural)** — see evidence-quality note above | No deposit-for-a-table mechanic makes sense absent a reservation feature (row 1); consistent with the absence finding above |
| Pay-at-order (standard delivery-marketplace payment timing) | **UNKNOWN — not verified, but plausible by category** | `corpus/snappfood/business.md` states explicitly: *"No deposit mechanic of any kind found — SnappFood is pay-at-order (or pay-on-delivery, per standard Iranian food-delivery norms)... Marked UNKNOWN — not verified rather than ABSENT, since no session specifically searched SnappFood's payment-flow/deposit mechanics."* Preserving that exact caveat rather than upgrading it. | `corpus/snappfood/business.md` §4, 2026-09-07 |

### 5. Cancellation policy display

| Item | Status | Detail |
|---|---|---|
| Order-cancellation fee/policy shown to diner, and at what point in the flow | **UNKNOWN — not verified** | `corpus/snappfood/business.md` states explicitly this was searched for and not found: *"No prior session searched for or found SnappFood's cancellation-fee policy or refund-window text."* | `corpus/snappfood/business.md` §4, 2026-09-07 |
| Refund windows (timing, conditions) | **UNKNOWN — not verified** | Same source, same gap | `corpus/snappfood/business.md` §4, 2026-09-07 |
| Related complaint pattern (money deducted without order registering; delayed/non-delivered orders, unclear compensation) | **REAL (existence of the complaint pattern) / CLAIMED-severity (no count)** | News coverage (SNN, YJC — both titled "بی‌تفاوتی اسنپ‌فود نسبت به اعتراض کاربران", "SnappFood's indifference to user protests") describes this pattern; it is evidence that *when* a cancellation/non-fulfillment happens, the compensation path is reported as opaque — but it does not state an actual cancellation policy or refund-window figure, and carries no countable `sample_size` (an "انبوه" / "mass of" complaints framing, not individual quotes) | `snn.ir/fa/news/1146095/`, `yjc.ir/fa/news/8734093/`, via `profiles/snappfood-loyalty.md`, accessed 2026-09-04 |
| Table-reservation-style "no-show" fee | **ABSENT (structural)** — see evidence-quality note above | No reservation concept exists to attach a no-show fee to (row 1) |

### 6. Loyalty — full sub-mechanic breakdown (the best-evidenced section of this corpus)

All items below carried forward from `profiles/snappfood-loyalty.md` (2026-09-04, `WebSearch`
synthesis, `WebFetch` blocked that session too), re-labeled precisely against this mode's specific
sub-mechanics ask (earn/tiers/expiry/redeem/referral/streaks/birthday). Nothing below was re-verified
this session — every figure is cited to its original date and label.

| Sub-mechanic | Status | Detail |
|---|---|---|
| **Earn** | **REAL** (existence + rate) | Snapp Club (اسنپ‌کلاب) — a group-wide program spanning the entire Snapp super-app, not SnappFood-specific: **10 Snapp Club points per 1,000 Toman spent**, confirmed applicable to food orders specifically via a follow-up query ("بله، سفارش غذا در اسنپ فود امتیاز اسنپ کلاب می‌دهد" — "Yes, food orders on SnappFood earn Snapp Club points"). Earned across ride-hailing, cargo/pickup, courier, phone credit, internet packages, and food orders alike — not a food-specific earn rate. |
| **Tiers** | **UNKNOWN — not found, likely does not exist** | Multiple targeted Persian and English searches (2026-09-04) for a tier/VIP/level/status system returned nothing — no named tiers, no tier-based earn multiplier, no status badges. The source session frames this as "reads as a genuine absence rather than a search failure" but does not upgrade it to a hard `ABSENT`, and neither do I — carrying the same caveat forward unchanged. |
| **Expiry** | **REAL** | A single, flat expiry clock — **twice a year, end of spring and end of fall** (fixed calendar reset, not a rolling per-transaction clock). A near-expiry banner shows remaining points and days left atop the Snapp Club screen. Notably: **one flat pool with one clock is the incumbent Iranian-market norm** — contrast with Starbucks' asymmetric Green(6mo)/Gold(never) expiry and Chipotle's three separate clocks (points/rewards/birthday), both flagged elsewhere in this research line as user-hostile patterns SnappFood does *not* replicate. |
| **Redeem** | **REAL (mechanism) / CLAIMED (specific menu examples, via 3rd-party aggregators not SnappFood's own screen)** | Points redeem **only as a discount code** pasted at checkout, not an automatic balance deduction or free item. Example price-points found (via `mopon.ir`/`offch.com` coupon aggregators, not SnappFood's own redemption UI): 1,600 pts → 60,000 Toman first-food-order code; 600 pts → 100,000 Toman Snapp Market code; 900 pts → 55,000 Toman express-supermarket code; 1,200 pts → 54,000 Toman pharmacy code. Redemption menus reportedly **vary per user** — whether a single platform-wide minimum balance exists is UNKNOWN. |
| **Referral** | **UNKNOWN — not verified** | No source in any session describes a SnappFood/Snapp-Club-specific referral-bonus or friend-invite structure. |
| **Streaks** | **UNKNOWN — not verified** | No source describes any consecutive-order or streak-based mechanic. |
| **Birthday rewards** | **UNKNOWN — not verified** | No source describes a birthday/anniversary mechanic for SnappFood (contrast: Fidilio's own *claimed*, itself-unverified FidiOffer birthday-message feature, `profiles/fidilio.md`). |
| **Snapp Pro (اسنپ پرو)** — paid subscription, structurally distinct from the free points program | **CLAIMED (benefit-value framing) / REAL (existence)** | ~22,500 Toman/month (3-/6-month options also reported), spanning 5 Snapp verticals. Food-specific: free delivery up to 25,000 Toman/order, 5–20% discounts. Marketing claims up to 5,000,000 Toman/month in value — **explicitly flagged by the source session as unverified marketing copy**, not measured against real usage. |
| **FoodParty (فودپارتی)** — recurring promotional surface | **REAL (existence) / disputed authenticity for specific discounts** | Restaurant-selectable discount campaigns (10–35% cited); restaurants opt in via SnappFood's own vendor tool ("پارتی دخل‌فود" — "Dakhl-e-Food Party"), implying restaurant-funded, not platform-subsidized by default. One dated complaint (Tejaratnews, 2023-03-04, outside 12-month window) alleges a FoodParty "discount" was manufactured by inflating the sticker price first; a paraphrased tweet cited: *"اسنپ فود قیمت غذاها را بالا برد و در فودپارتی گذاشت!"* — flagged as possibly paraphrase, no reviewer handle attached. |

### 7. Notifications and opt-out controls

| Item | Status | Detail |
|---|---|---|
| Promotional push-notification behavior (cadence, content) | **UNKNOWN — not verified, and the gap itself is informative** | The source session ran multiple targeted Persian queries (promo-notification spam, disabling notifications, complaint about frequency) and surfaced only generic Android/iOS how-to content — zero SnappFood-specific finding either way. Explicitly not treated as evidence of absence. Notably, the same gap was independently found for Fidilio too — "across two Iranian platforms now, this specific angle has been hard to substantiate with this tool access." | `profiles/snappfood-loyalty.md` §"Notification behavior around promotions", 2026-09-04 |
| In-app opt-out toggle for promotional notifications | **UNKNOWN — not verified** | No source describes the existence or absence of a specific opt-out control | — none found |
| Order-status transactional notifications (order confirmed, courier assigned, delivered) | **UNKNOWN — not verified** | Plausible for any delivery marketplace, never confirmed or searched for directly | — none found |

### 8. Reviews / photos / social

| Item | Status | Detail |
|---|---|---|
| In-app restaurant reviews (diner-submitted, restaurant-visible) | **CLAIMED (via vendor-tooling mention, not a fetched screen)** | SnappFood's own vendor-academy content references a "comment-management" tool for restaurant partners (`vendors.snappfood.ir` — "comment-management-in-foodpartner" page path cited by title only) — implying diners can leave comments/reviews that restaurants can manage/respond to. Never independently confirmed by loading the page itself (blocked every session), and the page's actual content (star rating? photo attachment? moderation flow?) was never read. | `vendors.snappfood.ir`, cited by `profiles/snappfood-loyalty.md`, 2026-09-04 — page title/path only, not fetched |
| Diner-uploaded photos on reviews | **UNKNOWN — not verified** | Not addressed by any source | — none found |
| Social features (share order, follow a restaurant, social feed) | **UNKNOWN — not verified** | Not addressed by any source. (Contrast: Foodism, a separate Iranian competitor profiled in this same research line, is *itself* built around a social discovery/review feed — SnappFood's equivalent, if any, was never searched for.) | — none found |
| Aggregate app-store rating as a proxy for review volume | **partially REAL** | Myket: **4.3/5 across 19,209 comments**, synthesis-described as "relatively positive... good discounts, diverse restaurants, appropriate packaging and food quality" — but **zero individually-quoted, dated, handle-attributed reviews** exist anywhere in the SnappFood research line to date (`store-reviews.md` confirms this explicitly as a structural gap, re-confirmed again this session by the independent WebFetch/WebSearch test above). Cafe Bazaar aggregate rating/count: **UNKNOWN — not verified** despite repeated targeted queries; the specific source URL behind the Myket figure was also never surfaced, flagged as a weaker-sourced number by its own originating session. | Myket figure: search-synthesis, source URL not surfaced, via `profiles/snappfood-loyalty.md`, 2026-09-04; zero-quotes finding: `corpus/snappfood/store-reviews.md`, 2026-09-07 |

### 9. CRM / segmentation / tags (restaurant-facing)

| Item | Status | Detail |
|---|---|---|
| Restaurant-facing CRM / guest segmentation / tagging tools | **UNKNOWN — not verified** | No source describes a SnappFood-specific restaurant CRM, guest-tagging, or segmentation tool (contrast: Servme's "VIP"/"Sushi Lover"/"Ramadan/Iftar" tags, and SevenRooms/SmartX's guest-profile pitches, all independently confirmed for those competitors elsewhere in `MATRIX.md`). SnappFood's equivalent, if any, was never searched for under this specific angle by any Scout session. | — none found |
| "Vendor scoring" (a quality/performance score shown to the restaurant about itself) | **REAL (existence, by title only)** | SnappFood's vendor-academy content includes a page titled around vendor-scoring — cited by page path only ("vendor-scoring" section of `vendors.snappfood.ir`), never fetched or read in detail. This is restaurant-facing *self*-performance visibility, not diner-segmentation/CRM in the traditional sense. | `vendors.snappfood.ir`, cited by `profiles/snappfood-loyalty.md`, 2026-09-04 — title/path only |

### 10. Marketing automation

| Item | Status | Detail |
|---|---|---|
| Restaurant-triggered promotional campaign tool ("پارتی دخل‌فود" / Dakhl-e-Food Party) | **REAL (existence)** | SnappFood's vendor-academy content describes a tool restaurants themselves opt into and activate to run a FoodParty-style discount campaign — this is the one concrete piece of restaurant-facing marketing-automation-adjacent tooling found in the corpus. Whether it includes audience targeting, scheduling, A/B testing, or is a simple on/off toggle is **UNKNOWN — not verified** (the page itself was never fetched, only its existence and title referenced by a prior search-synthesis session). | `vendors.snappfood.ir` campaign pages, cited by `profiles/snappfood-loyalty.md`, 2026-09-04 — title/path only, not fetched |
| Automated win-back / re-engagement campaigns (diner-facing) | **UNKNOWN — not verified** | Not addressed by any source | — none found |
| SMS/push marketing-automation triggers | **UNKNOWN — not verified** | Not addressed; note this is distinct from the general "notification behavior" gap in section 7, which is about cadence/opt-out, not about whether campaigns are rule-triggered | — none found |

### 11. POS / payment integrations

| Item | Status | Detail |
|---|---|---|
| Named POS integrations for restaurant partners | **UNKNOWN — not verified** | No source names a specific POS system SnappFood integrates with for order injection/menu sync | — none found |
| Snapp Pay (Snapp Group's in-house payment/BNPL arm) used for order payment or restaurant payout | **UNKNOWN — not verified** | Explicitly flagged as an open, never-investigated question by `corpus/snappfood/business.md`: *"Snapp Pay integration terms... never investigated by any prior session; UNKNOWN — not verified, flagged here because the task's hints did not name it but it is plausibly relevant... worth a future session's attention."* Preserving that flag unchanged. | `corpus/snappfood/business.md` §"What this mode's evidence checklist required and could not be attempted", item 7, 2026-09-07 |
| Bank-card payment (in-app) | **partially REAL (by breach-data inference only)** | SnappFood's own public statement after the Dec 2023 breach specifically said **bank-card details are not stored in its database** — implying card payment exists as a flow (tokenized/passed to a payment processor) even though the underlying card data isn't retained. This is an inference from a breach-disclosure statement, not a direct feature confirmation. | SnappFood's own confirming statement, per `WATCH.md`, sourced to Digiato/Shahr-e-Sakht-Afzar/Tasnim coverage, 10 Dey 1402/≈2023-12-31 |
| Cash-on-delivery option | **UNKNOWN — not verified, plausible by Iranian delivery-market norms** | Not directly confirmed by any source; `corpus/snappfood/business.md` describes "pay-at-order (or pay-on-delivery, per standard Iranian food-delivery norms)" as a general-market inference, not a SnappFood-specific confirmed fact | `corpus/snappfood/business.md` §4, 2026-09-07 |

### 12. Languages / RTL / Persian digits

| Item | Status | Detail |
|---|---|---|
| Persian-language UI | **REAL** | Every source touching SnappFood across every Scout session — its own `snapp.ir` blog pages, its own vendor-academy content, the Competition Council's ruling text, all Persian news coverage — is in Persian, and SnappFood is consistently and independently described as Iran's dominant *domestic* food-delivery app. This is a well-evidenced, consistent, multi-source (not single-claim) fact, distinct from an unverified assumption. | Consistent across every cited source in this corpus and its predecessors |
| RTL layout implementation | **UNKNOWN — not verified at the implementation level** | No session has loaded a live SnappFood page or app screen to inspect actual RTL CSS/layout handling (`MATRIX.md`'s RTL-comparison row does not even include a SnappFood column). A Persian-market app being RTL is close to certain by category, but "close to certain by category" is explicitly not the evidence bar this task sets — marked UNKNOWN rather than asserted as REAL on inference alone, unlike the language claim above which has direct multi-source textual confirmation. | — none found; `MATRIX.md`'s RTL row excludes SnappFood as a column entirely |
| Self-hosted fonts vs. Google Fonts dependency | **UNKNOWN — not verified** | No session has inspected SnappFood's actual font-loading implementation | — none found |
| Persian-digit (۰۱۲۳...) vs. Western-digit number formatting in-app | **UNKNOWN — not verified** | No session has inspected this | — none found |

### 13. Accessibility

| Item | Status | Detail |
|---|---|---|
| Touch-target sizing, screen-reader support, keyboard navigation | **UNKNOWN — not verified** | No source in any Scout session addresses SnappFood's accessibility implementation at any level. This is a genuine, complete gap — not one item was found, positive or negative. | — none found |

### 14. Offline behaviour

| Item | Status | Detail |
|---|---|---|
| App behavior when offline/on `file://`-equivalent/no-connectivity | **UNKNOWN — not verified** | No source addresses this. Note SnappFood ships as a native Android/iOS-adjacent app (Cafe Bazaar/Myket/Google Play listings, per the task's own hints), not a browser-loaded PWA — so the specific `file://` framing in Rezervno's own demo/OTP conventions (`CLAUDE.md`) does not map cleanly onto SnappFood's product shape, but no session has tested or found any description of SnappFood's actual offline/poor-connectivity handling (cached menu browsing, queued orders, graceful degradation, or hard failure). | — none found |

---

## What the RESTAURANT can configure — settings/toggles found (vs. gaps)

This section directly answers the task's explicit second question: what can a SnappFood restaurant
partner configure, evidenced or not.

**Found (existence only, never a fetched/read screen — every item below is a page title or tool name
referenced by a prior search-synthesis session, not something any Scout session has directly opened):**

1. **FoodParty campaign activation ("پارتی دخل‌فود")** — restaurants opt in and activate a promotional
   discount campaign themselves; implies restaurant sets the discount depth/duration, though the exact
   configurable parameters (percentage range, date window, menu-item scope) are **UNKNOWN — not
   verified**. [`vendors.snappfood.ir`, via `profiles/snappfood-loyalty.md`, 2026-09-04]
2. **Comment/review management** — a vendor-academy page referencing "comment-management-in-foodpartner"
   implies restaurants can view and likely respond to diner comments/reviews, but the actual
   capabilities (reply, flag, hide, request removal) are **UNKNOWN — not verified**. [same source]
3. **Vendor scoring visibility** — restaurants can apparently see a performance/quality score about
   themselves, referenced by page title only; whether this is configurable (vs. purely informational) is
   **UNKNOWN — not verified**. [same source]

**Not found / UNKNOWN — genuine gaps, not assumed absent:**

4. Menu management (add/remove items, set prices, mark items unavailable/86'd) — **UNKNOWN — not
   verified.** Plausible as a baseline requirement for any delivery marketplace, but no source in the
   corpus confirms or describes it, and per this task's evidence rule I am not filling this in from
   general category knowledge.
5. Operating-hours / open-closed toggle — **UNKNOWN — not verified.**
6. Delivery-radius or delivery-fee configuration — **UNKNOWN — not verified.**
7. Commission-rate negotiation or tier selection by the restaurant — **UNKNOWN — not verified as a
   restaurant-facing self-service control**; what *is* independently confirmed (via the Competition
   Council ruling, `WATCH.md` 2026-09-04) is that commission rates were historically negotiated/adjusted
   in exchange for exclusivity, which is a contract-level lever, not a self-service dashboard toggle —
   these are different things and should not be conflated.
8. Staff/role-based access control on the vendor dashboard — **UNKNOWN — not verified.**

**Contrast with Rezervno's own documented restaurant-facing contract (for calibration, not a claim about
SnappFood):** per `CLAUDE.md`, Rezervno's restaurant routes require `withRestaurantAuth`/`withStaffAuth`
with a `restaurantId`/`tenantId` sourced only from the auth context, and audit logging is mandatory for
sensitive admin/reservation-cycle operations. No source in the SnappFood research line describes an
equivalent architectural guarantee (cross-tenant isolation, audit trail) for SnappFood's vendor
dashboard — this is a genuine **UNKNOWN**, not a claim that SnappFood lacks such controls; it is simply
never addressed by any source found, since no session has ever accessed SnappFood's actual vendor
dashboard.

---

## Sources

**This session's own attempts (all failed/confirmed-blocked), accessed 2026-09-07:**
- https://example.com — `WebFetch`, `EGRESS_BLOCKED`
- https://snappfood.ir — `WebFetch`, `EGRESS_BLOCKED`
- `اسنپ فود رزرو میز رستوران` — `WebSearch`, budget exhausted (200/200), no content returned

**Prior evidence cited, not re-verified this session** (all originally accessed 2026-09-04 unless noted;
full original citation chains live in the source files themselves):
- `docs/audit/research/profiles/snappfood-loyalty.md` — full loyalty-mechanics profile; sources
  `snapp.ir/blog/club/`, `snapp.ir/blog/points-expiry/`, `myclub.snapp.ir/vendors/food/`,
  `blog.mopon.ir/اسنپ-پرو/`, `snapp.ir/pro/`, `dmboard.media/news/snapp-pro/`,
  `express.snapp.market/academy/blog/snapp-pro-account/`, `vendors.snappfood.ir` (vendor-scoring,
  comment-management, "پارتی دخل‌فود" campaign pages), `mopon.ir`/`offch.com` coupon aggregators,
  `tejaratnews.com/startup/تخفیف-سفارش-غذا` (2023-03-04), `ensafnews.com/455226/`,
  `snn.ir/fa/news/1146095/`, `yjc.ir/fa/news/8734093/`, `vananews.com/fa/news/409695/`,
  `dataak.com/blog/بررسی-رضایت-کاربران-توییتر-از-اسنپ-فود/`,
  `restobazar.com/mag/snapp-food-rules-for-restaurants/`, Competition Council ruling coverage
  (Zoomit/Digiato/Ensafnews/`nicc.gov.ir`), breach coverage (Shahr-e-Sakht-Afzar/Digiato/Farnet/Tasnim)
- `docs/audit/research/corpus/snappfood/business.md` (2026-09-07) — pricing/contract/deposit/refund
  mapping, zero new evidence that session either
- `docs/audit/research/corpus/snappfood/social.md` (2026-09-07) — restaurant-owner-side and
  social-sentiment mapping, zero new evidence that session either
- `docs/audit/research/corpus/snappfood/store-reviews.md` (2026-09-07) — confirms zero
  individually-quoted store reviews exist for SnappFood in the research line to date
- `docs/audit/research/MATRIX.md` — SnappFood's scoping note ("included only in the loyalty-relevant
  rows... marked N/A elsewhere") and the Loyalty & rewards-mechanics table rows/footnotes 44–46
- `docs/audit/research/WATCH.md` — two SnappFood entries (data breach, 10 Dey 1402/≈2023-12-31;
  Competition Council decision No. 740, 16 Ordibehesht 1404/≈2025-05-06)
- `docs/audit/research/profiles/iran-reservation-longtail.md` and
  `docs/audit/research/recon-notes-global.md` — grepped for any SnappFood mention; zero hits in either,
  reported as a finding (see "Prior research read first" above)

## What this session did NOT verify — the full gap list, stated plainly

1. **No new page, screen, or search result was read this session** — the master gap behind every item
   below. `WebFetch` blocked on control + primary target; `WebSearch` budget already at 200/200 before
   the first query returned.
2. Whether SnappFood has any table-reservation, table-selection, or waitlist feature anywhere in the
   Snapp super-app (not just the SnappFood-branded surface) — the closest this corpus gets is a
   consistent, repeated *absence* of any mention across ~2 dozen queries over 2 separate days, which is
   evidence but not a directly-loaded confirmation (see "Evidence-quality note" above).
3. The actual booking/ordering flow's screen-by-screen sequence, taps, and UI states — never walked
   through by any session.
4. Notification opt-out controls, cadence, and content — a stated, repeated gap across two Iranian
   platforms researched to date (SnappFood and Fidilio both).
5. Diner-facing review/photo submission mechanics — only a restaurant-facing "comment-management" tool
   *name* is known; the diner-facing submission flow itself was never seen.
6. Restaurant-facing CRM/segmentation tooling — never searched for under this specific angle by any
   session.
7. Named POS integrations and Snapp Pay's actual role in payment/payout — both explicitly flagged as
   open, unaddressed questions by a prior session.
8. RTL implementation details, font-hosting choice, and digit-formatting convention — only the
   higher-level "Persian-language UI" fact is well-evidenced; the implementation-level questions this
   mode asks about are all UNKNOWN.
9. Accessibility — a complete, total gap; zero sources of any kind.
10. Offline/poor-connectivity behavior — a complete, total gap; zero sources of any kind.
11. Restaurant-configurable settings beyond the three named tool-existence fragments (FoodParty
    activation, comment management, vendor scoring) — menu management, hours, delivery radius, and
    access control are all genuinely unknown, not assumed to not exist.

## Structured-output note

`reviews_read = 0`. `webfetch_worked = false`. The `features` array in the structured summary reflects
the status labels assigned in the tables above, each carrying its evidence source. The
`complaints`/`praises` arrays carry forward only the items that meet this mode's own bar (a stated
`sample_size`, even if that size is small or the theme is old) — the FoodParty discount-authenticity
complaint (2023-03-04, sample_size = 1, search-synthesis, outside the 12-month recency window and
flagged as such) and the general delivery/payment-failure pattern (SNN/YJC, "انبوه" framing with no
countable sample, therefore **excluded** from the structured `complaints` array per the rule that "a
complaint theme count without a sample size is invalid" — it remains in this file's prose only). No
`praises` quote in the entire SnappFood research line meets the verbatim-or-labeled-paraphrase bar with a
handle and date; the `praises` array is correspondingly thin, carrying only the Myket aggregate-rating
descriptor, explicitly labeled as an aggregate synthesis, not an individually attributed quote.
