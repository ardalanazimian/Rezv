# Foodism — Observed Feature Inventory (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_
_Mode: OBSERVED FEATURE INVENTORY (every user-facing and restaurant-facing capability with
evidence: booking flow, table-level selection, waitlist, deposits/prepay, cancellation-policy
display, loyalty [earn/tiers/expiry/redeem/referral/streaks/birthday], notifications + opt-out,
reviews/photos/social, CRM/segmentation/tags, marketing automation, POS/payment integrations,
languages/RTL/Persian digits, accessibility, offline behaviour — plus what a restaurant can
configure)_

## Read-first: what prior research already established

Per task instructions, before writing anything new I read, in full:

- `docs/audit/research/profiles/foodism.md` — base profile (2026-09-05, `WebSearch`-synthesis
  batch 1) plus its own same-day **ADDENDUM** (first-hand `WebFetch`, batch 3): status changed to
  **DEGRADED — likely abandoned, not confirmed dead**.
- `docs/audit/research/corpus/foodism/store-reviews.md` (2026-09-07, earlier same day) — mode
  STORE REVIEWS AT VOLUME. Total tooling failure that session: `WebFetch` `EGRESS_BLOCKED` on
  every domain including the `example.com` control; `WebSearch` reported its session-wide quota
  already at 200/200 before a single query ran. `reviews_read = 0`.
- `docs/audit/research/corpus/foodism/social.md` (2026-09-07, earlier same day) — mode SOCIAL AND
  FORUMS. Identical total tooling failure. `reviews_read = 0`.
- `docs/audit/research/corpus/foodism/business.md` (2026-09-07, earlier same day) — mode BUSINESS
  MODEL/PRICING/TERMS. Identical total tooling failure (with one added nuance: Foodism's own
  domains — `foodism.app`, `mag.foodism.app`, `app.foodism.tech` — returned DNS
  `getaddrinfo ENOTFOUND` rather than an explicit `EGRESS_BLOCKED`, distinct from the proxy-block
  signature seen on well-known domains; that session flagged this as a tooling artifact, not
  evidence the domains are dark). `reviews_read = 0`.
- `docs/audit/research/corpus/foodism/scale.md` (2026-09-07, earlier same day) — mode USERS,
  SALES, SCALE. Identical total tooling failure, independently confirmed a third time.
  `reviews_read = 0`.
- `docs/audit/research/MATRIX.md` — Foodism column/footnotes 47, 49–55, 62; "Coverage status"
  section; the "Foodism's column is real but thin, and now degrading" closing line.
- `docs/audit/research/PARITY-RISK.md`, `docs/audit/research/WATCH.md` (2026-09-05 [Iran] entry),
  `docs/audit/research/ANTI-PATTERNS.md` §7 ("Marketing a capability in the product's own name
  that isn't shipped" — Foodism is the named example), `docs/audit/research/BRIEF-2026-09-05.md`,
  `docs/audit/research/BRIEF-2026-09-05-batch3.md`, `docs/audit/research/profiles/iran-reservation
  -longtail.md` (§"Foodism is degrading, and `MATRIX.md`'s 'REAL but thin' footprint row needs
  revising") — grepped for any Foodism feature-relevant fact not already folded into the base
  profile. **None found beyond what the base profile and its ADDENDUM already carry.**
- `docs/audit/research/corpus/fidilio/features.md` — read for structural precedent only (same
  mode, sibling competitor, same day), not for Foodism content.

**Summary of what already exists** (full citation in `profiles/foodism.md`; reproduced here only
where load-bearing for a feature-inventory row, cited by section, not re-quoted at length):

- **Identity confirmed:** `foodism.app` / Android package `app.foodism.tech`, a Persian
  restaurant/cafe/bakery/juice-shop discovery-and-review social app, ~8,000–9,000 venues claimed
  across ~29 cities. Four unrelated same-name products (Foodism UK, Foodism.xyz/Connect India,
  "Local Foodism App" US, Foodium) were ruled out — not re-checked this session.
- **Status: DEGRADED — likely abandoned, not confirmed dead** (set 2026-09-05 ADDENDUM, held by
  every subsequent session including this one). `cafebazaar.ir/app/app.foodism.tech` returned
  **HTTP 404** on three attempts across two URL forms (`[fetched]`, 2026-09-05) — not a site-wide
  outage, since `cafebazaar.ir/app/com.fidilio` fetched normally in the same minute.
  `myket.ir/app/app.foodism.tech` was live and fetched directly the same day: **4.3/5 over 226
  reviews, 25,000 installs, last updated ۱۴۰۱/۰۹/۱۰** (my conversion, carried forward:
  **≈2022-12-01**) — a ~3¾-year-old binary as of this date. The one verbatim review anywhere in
  this research line: **معصومه, ۳ خرداد ۱۴۰۵** (≈2026-05-24): **«کار نمیکنه»** — "it doesn't work."
- **This status matters for every row below.** Even where a feature is documented as having
  existed in the product (2020–2022 era descriptions, mostly from third-party app-intro blogs), a
  2022 binary and a 404'd primary store listing mean I cannot treat any of it as confirmed still
  live in the shipped 2026 product — I flag this explicitly per row rather than once at the top,
  because it changes the practical meaning of "REAL" here versus for an actively-maintained
  competitor.

This corpus's job was to extend the above with the feature-inventory-specific detail the task
asks for: booking-flow mechanics (steps/screens/taps), table-level selection, waitlist,
deposits/prepay, cancellation-policy display, the *detail* of loyalty (earn/tier/expiry/redeem/
referral/streak/birthday), notifications/opt-out, reviews/photos, restaurant-side CRM/
segmentation/marketing-automation, POS/payment integrations, RTL/Persian-digit handling,
accessibility, offline behaviour, and restaurant-configurable settings. **It could not add
anything new** — see Methodology below — for the same reason all four earlier sessions today
could not: total tool-access failure, independently re-confirmed by this session rather than
assumed from the sibling files.

---

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com`
(neutral control) and immediately after against this mode's primary target — the one page in
this entire research line previously confirmed to render live app-store screenshots and feature
copy (`myket.ir/app/app.foodism.tech`, fetched successfully by the 2026-09-05 ADDENDUM session).

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` — "Access to example.com is blocked by the network egress proxy." |
| 2 | `WebFetch` | `https://myket.ir/app/app.foodism.tech` | Screenshots/description — highest-value target for this mode | `EGRESS_BLOCKED` — "Access to myket.ir is blocked by the network egress proxy." |
| 3 | `WebSearch` | `فودیسم اپلیکیشن نظرات کاربران بازار` | Fallback per protocol | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls)"* |

**`webfetch_worked = false` for this session.** The `example.com` control confirms a blanket
network-egress policy for this session — the identical result all four 2026-09-07 sibling
sessions (`store-reviews.md`, `social.md`, `business.md`, `scale.md`) independently recorded
earlier the same day — in contrast to the **2026-09-05** session that produced the base profile's
ADDENDUM, where `WebFetch` worked and fetched Myket + Cafe Bazaar directly. I did **not** get to
read Cafe Bazaar's or Myket's screenshot carousel, which is the single highest-value target for
this specific mode (screenshots would show the actual discovery/review/social-feed UI, tab
structure, and any reservation/ordering surface directly, rather than through a third party's
paraphrase of it).

**`websearch_worked = false` for this session.** The message is explicit and session-scoped
("200 of 200"), not per-query or per-domain — identical to what all four sibling sessions hit
earlier the same day. I stopped at one query (rather than burning further calls against a
quota already reported at its hard ceiling on the first attempt) — the same discipline the
sibling sessions used once the ceiling message appeared.

**Net result: this session had zero live research capability of any kind**, matching every other
Scout session dated 2026-09-07 found in this repository for this competitor. Everything below
that is not explicitly carried forward and cited as `[fetched, 2026-09-05]` or
`[search-synthesis, 2026-09-05]` from a prior session is either an absence this session confirmed
it cannot fill, or a structural inference clearly labeled as such.

## Reviews read this session: 0

No app-store review, screenshot, feature page, or third-party write-up was read by this session.
`reviews_read = 0`. Across the entire Scout research line to date, exactly **one** verbatim
Foodism review exists at all (see `profiles/foodism.md`'s ADDENDUM and the four sibling corpus
files): **معصومه, ۳ خرداد ۱۴۰۵** (≈2026-05-24): **«کار نمیکنه»** — "it doesn't work." That review
is a general functional complaint (does not name a specific feature), so it contributes no
feature-specific data point to this mode beyond the general signal that the app may not currently
work end-to-end for at least one 2026 user.

---

## Feature inventory (booking/table/loyalty/CRM/accessibility/offline detail)

Every row is carried forward from `profiles/foodism.md` §"Feature inventory" and its supporting
sections, cited to that file, plus `MATRIX.md`'s footnotes where they add detail. **No row below
was independently re-verified this session** — this session could not open a single page. Where
the task asks for detail (steps/screens/taps, earn/tier/expiry/redeem mechanics, opt-out
controls, restaurant-configurable settings) that no prior session ever obtained, I mark it
**UNKNOWN — not verified** explicitly rather than leaving it implied by omission, per the
constitution's rule that absence of the subject must read as a gap, not a silent pass.

| Capability | Status | Evidence |
|---|---|---|
| **Booking/reservation flow of any kind (steps, screens, taps)** | **ABSENT** | `profiles/foodism.md` §"What it is": a targeted search for "فودیسم رزرو میز رستوران" returned zero Foodism-specific results, only unrelated competitor products (Sepidz, Baran Systems, Mupra). No reservation flow exists to describe steps/screens/taps for. `MATRIX.md` footnote 50 confirms: "no fee/deposit/booking flow of any kind for these two rows to evaluate." `ANTI-PATTERNS.md` §7 names Foodism explicitly as marketing "…و سفارش غذا" ("…and food ordering") in its own store listing name while no ordering or reservation mechanism was found. |
| **Table-level selection (choose a specific table/zone)** | **ABSENT — structural** | Follows directly from the row above: with no booking flow of any kind, there is no possible table-selection UI to evaluate. Not independently searched for this session (would be redundant given the booking-flow absence is already established with a targeted, specific search). |
| **Waitlist (join, position, notify-when-ready)** | **UNKNOWN — not verified** | No prior session (base profile or any of the four 2026-09-07 corpus files) targeted a waitlist-specific search. Given the confirmed absence of any booking/reservation surface, a waitlist feature would be structurally surprising, but I have not searched for it directly and will not infer ABSENT from a feature I never looked for — flagging as a genuine open gap, distinct from the booking-flow row above which *was* directly searched. |
| **Deposits / prepayment for a reservation** | **ABSENT — structural** | No payment flow of any kind exists in the product per `profiles/foodism.md` §"What it is": WebSearch's own synthesis states plainly that ordering happens "به صورت حضوری یا تلفنی" (in person or by phone call), not online/in-app, and no reservation feature exists to attach a deposit to. |
| **Cancellation-policy display** | **ABSENT — structural** | Same reasoning: no booking to cancel. Not independently searched this session (redundant given the confirmed absence of the underlying booking flow). |
| **Loyalty — points earn mechanic** | **ABSENT — not found** | `profiles/foodism.md` §"Feature inventory": targeted search found no Foodism-native points/tier system. `MATRIX.md` footnote 52: "no Foodism-native points/tier loyalty program was found despite targeted searching; the only 'discount' mechanic found is generic, individual-restaurant-run offers surfaced inside the app, not a Foodism ledger or points system." |
| **Loyalty — tiers** | **ABSENT — not found** | Same source as above; no tier structure of any kind found. |
| **Loyalty — points/tier expiry** | **ABSENT — structural** | Follows from the absence of any points/tier system to attach an expiry rule to. Not independently searched (would be redundant). |
| **Loyalty — redemption mechanic** | **ABSENT — not found** | Same as points-earn row; only generic restaurant-run discount offers exist, not a Foodism-operated redemption ledger. |
| **Referral program** | **UNKNOWN — not verified** | No prior session targeted a referral-specific search ("معرفی به دوستان," "کد دعوت"). Genuinely unaddressed, not inferred. |
| **Streaks (visit/check-in streaks)** | **ABSENT-leaning, not directly searched** | No streak mechanic was described in any third-party app-intro source read across any session (`webna.ir`, `appetan.ir`, `appreview.ir`, `charkhoneh.com`) — those sources describe the discovery feed, review/rating, follow/like, and the per-city "شکموهای حرفه‌ای" (professional foodies) leaderboard in some detail, and a streak mechanic would plausibly be mentioned alongside the leaderboard if it existed. Not a directly targeted search, so held at UNKNOWN-leaning-absent rather than a flat ABSENT. |
| **Birthday rewards/offers** | **UNKNOWN — not verified** | Never searched for by any session in this research line. |
| **Social layer — follow other users, "like"** | **CLAIMED** | `profiles/foodism.md` §"Feature inventory": sourced only from third-party app-intro blog descriptions (`appreview.ir`, `charkhoneh.com`); not independently tested by any session, mechanism (server-verified vs. client-side) unconfirmed. Given the DEGRADED status (2022 binary, 404'd Cafe Bazaar listing), even this CLAIMED description should be read as "described when last independently written about," not "confirmed present in whatever binary a 2026 user would actually install." |
| **Per-city "professional foodies" leaderboard** ("شکموهای حرفه‌ای") | **CLAIMED** | Same third-party sources as above; `MATRIX.md` footnote 53 notes it is engagement-based (reviews/follows/likes), not purchase-based, and was not independently tested by any session. This was flagged in the base profile as the single most distinctive, Gen-Z-shaped structural design choice found for Foodism — still true as a *description*, unverified as a *currently-shipped* fact given DEGRADED status. |
| **Photo upload per venue** | **CLAIMED** | Same third-party sources (`appreview.ir`, `charkhoneh.com`); not independently tested. |
| **User reviews/ratings per venue** | **REAL** | The one feature in this entire inventory with the strongest evidence tier: live, first-hand-fetched Myket aggregate (4.3/5 over 226 reviews, `[fetched]` 2026-09-05) plus one verbatim review text obtained directly from the same fetch. This is genuinely in active use by at least some users, not merely described in marketing copy — though "active" as of a 2022 binary, not necessarily as of 2026. |
| **Phone-number + SMS-OTP sign-up gate** (required for rate/follow/favorite/upload; browsing is free) | **REAL-leaning, single-sourced** | `profiles/foodism.md` §"Who it's for," `MATRIX.md` footnote 54: independently and consistently described by `appreview.ir` (via WebSearch synthesis, not a direct fetch) as browse-without-account but rate/follow/favorite/upload requires phone+OTP. Single-sourced for the *mechanism* (not cross-confirmed by a second independent source the way the Myket rating is), so held short of a flat REAL. |
| **Notifications (push/SMS) — content, frequency, opt-out controls** | **UNKNOWN — not verified** | No prior session (base profile or any 2026-09-07 corpus file) found or targeted this. `corpus/foodism/social.md` explicitly names this as unaddressed: "No review or article discussed push-notification frequency, SMS marketing volume, or opt-in/opt-out mechanics." Whether the phone number captured at OTP sign-up (row above) is used for marketing SMS beyond authentication is also explicitly flagged as unconfirmed in `MATRIX.md` footnote 54. Zero evidence either way — this is one of the largest genuine gaps in the whole Foodism research line. |
| **In-app online ordering with in-app payment** | **ABSENT** | `profiles/foodism.md` §"What it is," `MATRIX.md` footnote 50, `ANTI-PATTERNS.md` §7: WebSearch's own synthesis states plainly that ordering happens by phone call or in person, despite "سفارش غذا" (food ordering) appearing in the app's own store-listing name («فودیسم | سفارش غذا»). This is the single most load-bearing ABSENT finding in the whole profile — a name/product mismatch flagged explicitly in this repo's own anti-patterns doc as the external-market instance of "claimed success with nothing behind it." |
| **Restaurant-side CRM / guest segmentation / tags** | **UNKNOWN — not found** | `profiles/foodism.md` §"Feature inventory": targeted search for "فودیسم باشگاه مشتریان" surfaced only unrelated competitor content (SmartX, Sepidz, Hami POS), nothing Foodism-specific. No session has found or ruled out a restaurant-facing dashboard of any kind — its existence, let alone any segmentation/tagging capability within it, is entirely unaddressed. |
| **Marketing automation (restaurant-triggered campaigns, drip messages)** | **UNKNOWN — not verified** | Never searched for directly by any session. Given the CRM row above is also unaddressed, and the *only* found restaurant-facing capability is "contact-only advertising packages" (see below), a marketing-automation feature would need its own dashboard to run from — no evidence such a dashboard exists at all. |
| **Restaurant-side paid advertising / visibility packages** | **CLAIMED** | `profiles/foodism.md` §"Business model & pricing": described only in generic terms ("packages with good returns" — "با بازدهی خوب"), contactable via phone/Instagram/website; `MATRIX.md` footnote 49 confirms no price list or feature breakdown was ever found despite targeted searching. |
| **POS integration** | **UNKNOWN — not verified** | Never searched for by any session. No mention in any third-party app-intro source of a POS/till integration of any kind. |
| **Payment-gateway integration (Zarinpal or otherwise)** | **ABSENT — structural** | Follows from the confirmed absence of any in-app payment flow (ordering or reservation) — there is nothing for a payment gateway to attach to. |
| **Persian language / RTL layout** | **REAL** | Every source across every session — the app's own listing name («فودیسم | سفارش غذا»), Instagram (`@foodism.iran`), the magazine (`mag.foodism.app`), and every third-party app-intro article — is entirely in Persian. This is about as strongly evidenced as any claim in this profile gets, though no session has hands-on-confirmed the *rendering* specifics (see next row). |
| **Persian (Eastern Arabic) numeral rendering vs. Western digits** | **UNKNOWN — not verified** | No session has opened the app or a screenshot closely enough to confirm which numeral system the UI itself renders (dates in sources are given in Persian calendar with Eastern Arabic digits — e.g. `۱۴۰۱/۰۹/۱۰`, `۳ خرداد ۱۴۰۵` — but that is store-listing metadata text, not necessarily proof of the in-app UI's own numeral choice). Genuinely unaddressed. |
| **Accessibility** (touch-target sizing, screen-reader/TalkBack support, focus order) | **UNKNOWN — not verified** | Zero prior coverage anywhere in this research line for Foodism — `appetan.ir`'s description of a white-background/red-accent four-tab UI (Discover / Discounts / Content / Profile) is the only design-language signal found for the whole product, and it says nothing about accessibility. No session has installed the app or read an accessibility-specific review/audit. |
| **Offline behaviour** (cached content, graceful degradation without network) | **UNKNOWN — not verified** | Zero prior coverage anywhere in this research line. Never searched for or described by any source. |
| **iOS app existence** | **UNKNOWN — not verified** | `profiles/foodism.md`: no Iran-region Apple App Store listing found in any search across any session; cannot confirm existence or absence with confidence. |
| **Android app (store presence)** | **REAL, but degrading** | `myket.ir/app/app.foodism.tech` `[fetched, 2026-09-05]`: live, 4.3/5 over 226 reviews, 25,000 installs, binary last updated ۱۴۰۱/۰۹/۱۰ (≈2022-12-01). `cafebazaar.ir/app/app.foodism.tech` `[fetched, 2026-09-05]`: **HTTP 404**, confirmed not a site-wide outage. Net: the app exists and has *some* live install base, but one of its two primary Iranian distribution channels has dropped the listing and the binary itself predates this research line by ~3¾ years. |

## What a restaurant can configure

**UNKNOWN — not verified, across every dimension the task asks about** (toggles for booking
rules, table layouts, loyalty parameters, notification templates, CRM tags, ad-package
targeting, or anything else a restaurant-side dashboard might expose). No session in this
research line — base profile or any of the five corpus files now covering this competitor — has
found, described, or even confirmed the existence of a restaurant-facing admin dashboard for
Foodism at all. The only restaurant-side capability documented anywhere is the contact-gated,
undetailed "advertising package" (see table above), which is a sales-contact relationship, not a
self-service configuration surface. This is a materially larger gap than for Fidilio or SmartX,
both of which have at least some restaurant-side dashboard description on record — for Foodism,
even the dashboard's existence is unconfirmed. I am reporting this honestly as a total gap rather
than inferring "probably has basic listing edit" from the fact that free basic listings exist
(that inference is not evidenced and I am not making it).

## Contradiction check against existing profile and corpus

None found. Nothing this session touched (because nothing succeeded) could contradict
`profiles/foodism.md`, its ADDENDUM, or any of the four sibling `corpus/foodism/` files. Every
figure and status (DEGRADED, the Cafe Bazaar 404, the Myket 4.3/5-over-226-reviews/25,000-installs
/۱۴۰۱-binary figures, the single known verbatim review) stands exactly as those sessions left it,
now two days older and unconfirmed as still-current on the feature-inventory axis specifically —
no prior session ever screenshotted or hands-on-tested the actual booking/loyalty/notification UI,
so everything in the table above beyond the Myket store-listing facts and the one review was
always description-of-description, not first-hand product observation, even before today's
tooling failure.

## What this means for the audit line

The FEATURE INVENTORY mode's goal — evidence or UNKNOWN for booking flow, table selection,
waitlist, deposits, cancellation display, the full loyalty mechanic set, notifications/opt-out,
CRM/segmentation, marketing automation, POS/payment integration, RTL/Persian-digit handling,
accessibility, offline behaviour, and restaurant-configurable settings — is **partially met**:
every row got a status (no silent omissions), but the overwhelming majority are **ABSENT
(structural, following from the confirmed absence of any booking/payment flow)** or **UNKNOWN —
not verified (never searched for by any session, this one included)**. This is consistent with,
not contradicted by, the base profile's own framing: Foodism's column in `MATRIX.md` is
"real but thin, and now degrading" precisely because it is a discovery/review social app with no
booking, payment, or restaurant-CRM surface to speak of, and even its confirmed feature set
(reviews, ratings, social follow/like, a leaderboard) rests on a binary that is ~3¾ years stale and
one whose primary Cafe Bazaar listing has been pulled.

**This is a tooling-availability finding for today's session specifically, not a new diligence
failure.** It says nothing new about Foodism's actual feature set beyond what the base profile
already established; it independently reconfirms (a fifth time today) that this session's shared
`WebFetch`/`WebSearch` budget was exhausted before this task began. A future session with working
tools should prioritize, in order: (1) re-opening `myket.ir/app/app.foodism.tech` for its
screenshot carousel — the single highest-value unopened source for this specific mode; (2) a
direct, targeted search for a restaurant-side dashboard/admin panel (never attempted by any
session); (3) targeted searches for waitlist, referral, birthday-reward, notification-opt-out,
accessibility, and offline-behaviour terms specifically, since none of these has ever been
searched for even once across five Foodism research sessions to date.

## Sources (this session)

All access attempted 2026-09-07; every attempt failed as tabulated above, so no source content was
actually read this session:

- `https://example.com` (control) — `EGRESS_BLOCKED`
- `https://myket.ir/app/app.foodism.tech` — `EGRESS_BLOCKED`
- 1 `WebSearch` query (`فودیسم اپلیکیشن نظرات کاربران بازار`) — refused: "this session has used
  its web search budget (200 of 200 WebSearch calls)"

## Sources (prior sessions, cited not re-verified)

- `docs/audit/research/profiles/foodism.md` — full base profile (2026-09-05, `WebSearch`-only
  batch 1) and its same-day ADDENDUM (`[fetched]`: Cafe Bazaar HTTP 404, Myket 4.3/5-over-226-
  reviews, the معصومه review). See that file's own source list for the ~20 `WebSearch`-only
  sources underlying every CLAIMED/UNKNOWN row above (`foodism.app`, `mag.foodism.app`,
  `webna.ir`, `appetan.ir`, `appreview.ir`, `charkhoneh.com`, `tahlilgar.com`,
  `rajanews.com`/`namehnews.com`/`ilna.ir` listicles, `iwmf.ir`).
- `docs/audit/research/corpus/foodism/store-reviews.md`,
  `docs/audit/research/corpus/foodism/social.md`,
  `docs/audit/research/corpus/foodism/business.md`,
  `docs/audit/research/corpus/foodism/scale.md` (all 2026-09-07, earlier same day) — each
  independently hit and documented the identical `WebFetch` `EGRESS_BLOCKED` / `WebSearch`
  "200 of 200" exhaustion this session also hit; their methodology tables and gap lists are the
  direct precedent for this file's format and for the specific per-row UNKNOWN designations above
  (waitlist, referral, notifications, accessibility, offline, restaurant-side dashboard) that no
  session has ever been able to search for.
- `docs/audit/research/MATRIX.md` — footnotes 47, 49–55, 62 and the Foodism column across the
  "Reservation & commercial-terms," "Loyalty & rewards-mechanics," and "Trust, notification &
  platform-hygiene" capability tables.
- `docs/audit/research/ANTI-PATTERNS.md` §7 — Foodism named as the external-market instance of
  "marketing a capability in the product's own name that isn't shipped."
- `docs/audit/research/PARITY-RISK.md`, `docs/audit/research/WATCH.md` (2026-09-05 [Iran] entry),
  `docs/audit/research/profiles/iran-reservation-longtail.md` §"Foodism is degrading" —
  cross-checked, no new feature-relevant fact found beyond what is already folded in above.
