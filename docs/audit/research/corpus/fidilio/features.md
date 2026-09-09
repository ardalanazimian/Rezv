# Fidilio — Observed Feature Inventory (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_
_Mode: OBSERVED FEATURE INVENTORY (user-facing + restaurant-facing capabilities, and what a
restaurant can configure)_

## Read-first: what prior research already established

Per task instructions, before writing anything new I read, in full:

- `docs/audit/research/profiles/fidilio.md` (main profile, 2026-09-04, plus its 2026-09-05
  ADDENDUM — the only session in this research line where `WebFetch` worked)
- `docs/audit/research/corpus/fidilio/store-reviews.md` (2026-09-07, mode STORE REVIEWS AT
  VOLUME)
- `docs/audit/research/corpus/fidilio/business.md` (2026-09-07, mode BUSINESS MODEL/PRICING/TERMS)
- `docs/audit/research/corpus/fidilio/social.md` (2026-09-07, mode SOCIAL AND FORUMS)
- The Fidilio rows/footnotes in `docs/audit/research/MATRIX.md`

**This corpus does not re-quote what those already established.** It cites them by file+section
where a fact from prior work is load-bearing for a feature-inventory row, and it adds only what
is new to the feature-inventory question specifically: booking-flow mechanics, table-level
selection, waitlist, deposits/prepay, cancellation-policy display, the *detail* of
loyalty(earn/tier/expiry/redeem/referral/streak/birthday), notifications/opt-out,
reviews/photos, restaurant-side CRM/segmentation/marketing-automation, POS/payment
integrations, RTL/Persian-digit handling, accessibility, offline behaviour, and
restaurant-configurable settings. Several of these (accessibility, offline behaviour, POS
integration, waitlist, table-level selection) have **zero prior Fidilio coverage anywhere in
this research line or in `MATRIX.md`** — they are genuinely open before this pass, not merely
under-cited.

**Contradiction check against prior work:** none found. Nothing below conflicts with the
2008-founding narrative, the June 2024 food-ordering pivot, the SnappFood/Rubika relationships,
the Cafe Bazaar store facts (3.7/5, 581 ratings, 110,000 installs, store name «فیدیلیو | سفارش
غذا», all fetched 2026-09-05), the 6 known reviews, or the Fidilio Club tier-threshold
contradiction already flagged in `business.md` §5 (which I did not attempt to re-resolve).

---

## Methodology header

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com`
(neutral control) and immediately after against the primary target for this mode
(`https://cafebazaar.ir/app/com.fidilio`, the app-store listing most likely to show screenshots
of the actual booking/table/loyalty/notification UI).

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` | `EGRESS_BLOCKED` |
| 2 | `https://cafebazaar.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| 3 | `https://fidilio.com/rules` | `EGRESS_BLOCKED` |
| 4 | `https://business.fidilio.com/رستوران/` | `EGRESS_BLOCKED` |
| 5 | `https://apkpure.net/fidilio-cafes-restaurants/com.fidilio` | `EGRESS_BLOCKED` |
| 6 | `https://myket.ir/app/com.fidilio` | `EGRESS_BLOCKED` |

**`webfetch_worked = false` for this session.** The `example.com` control confirms this is a
blanket network-egress policy for this session, not a per-domain block. This matches all three
other 2026-09-07 corpus sessions on this competitor (`store-reviews.md`, `business.md`,
`social.md`, each ran its own `example.com` control and got the same result) and contrasts with
the single 2026-09-05 session where `WebFetch` worked (`profiles/fidilio.md` ADDENDUM). I did
**not** get to read Cafe Bazaar's screenshot carousel, which is the single highest-value target
for this specific mode (screenshots would show the actual reservation/table/loyalty/notification
screens directly) — this is the corpus's single biggest gap, flagged again in "What this session
did NOT verify" below.

### WebSearch budget — a hard constraint this session, disclosed explicitly

Per the task's fallback rule, I moved to `WebSearch` with multiple differently-phrased Persian
queries targeting each feature area in this mode's checklist. **After 5 queries, the tool
returned: "this session has used its web search budget (200 of 200 WebSearch calls)."** This is
a session-wide budget (shared with the concurrent/prior work that produced `store-reviews.md`
[35 queries], `business.md` [37 queries], and `social.md` [41 queries] earlier the same day, plus
whatever the orchestrating session itself ran) — it was exhausted mid-way through this pass, not
by anything I could control or work around. I did not fabricate additional search results to
compensate. The 5 queries I did get, and their results, are reported in full below — none of them
surfaced Fidilio-specific evidence for the features they targeted (see per-query notes).

**Queries actually run this session (5 of a planned ~30):**

1. `فیدیلیو رزرو میز مراحل نحوه انتخاب صندلی` (Fidilio table reservation — steps, seat selection)
   → **No Fidilio-specific result.** The search engine's own synthesis explicitly stated it found
   nothing for "فیدیلیو" in this context and instead offered to search **Fidelio** — an unrelated,
   globally-known **hotel-PMS (property management system)** brand — plus generic airline-seat-
   selection guides. This is a **new instance of the same name-collision hazard** the
   `social.md` and original profile sessions already flagged for Fidibo/Fidelity/Flightio: the
   Latin transliteration "Fidilio" collides with "Fidelio" (Oracle Hospitality's hotel PMS,
   completely unrelated to this Iranian restaurant app). **None of that content is used as a
   Fidilio finding.**
2. `فیدیلیو لیست انتظار waitlist رستوران شلوغ` (Fidilio waitlist — busy restaurant) → Returned
   generic listicle content (kojaro.com "Top 30 Tehran restaurants") and two genuine
   `fidilio.com/restaurants/...` venue pages (Polo/Zanjan, Shandiz/Jordan) confirming those venue
   pages exist, plus a paraphrase that Shandiz specifically has "at least a 30-minute queue on
   weekends due to high quality" (کیفیت بالا, صف انتظار حداقل نیم‌ساعت). **This describes a
   physical walk-in queue at one restaurant, sourced from general web content about that
   restaurant — it is not evidence of an in-app digital waitlist feature inside Fidilio.** I am
   not treating "a popular restaurant has a line" as evidence of a waitlist *product feature*.
3. `فیدیلیو رزرو میز پیش پرداخت بیعانه لغو جریمه` (Fidilio table reservation — prepayment,
   deposit, cancellation penalty) → **Zero Fidilio-specific results.** Every result was about an
   unrelated Iranian short-term-rental platform (Mihmanshow) or traffic-fine payment — both
   false matches excluded from findings.
4. `فیدیلیو اسکرین‌شات اپلیکیشن معرفی صفحات` (Fidilio app screenshots — screen introduction) →
   **Zero Fidilio-specific results.** Every result was a generic "best screenshot apps" listicle
   unrelated to Fidilio as a subject.
5. `فیدیلیو اعلان نوتیفیکیشن پوش تنظیمات غیرفعال کردن` (Fidilio push notification settings —
   how to disable) → **Zero Fidilio-specific results.** Every result was generic Android/iOS/
   Instagram notification-management how-to content, not naming Fidilio at all.
6. `فیدیلیو آپلود عکس نظر کاربران گالری رستوران` (Fidilio photo upload — user reviews — venue
   gallery) → **Did not execute.** The budget was exhausted before this query returned; the tool
   reported 200/200 calls used and did not perform the search. I am recording the query as
   attempted-but-not-run rather than silently dropping it or guessing at a result.

**Net effect: this pass surfaced no new Fidilio-specific feature evidence via WebSearch**, beyond
confirming (negatively) that booking-flow steps, seat/table selection, prepayment/cancellation
terms, screenshots, and notification settings are **not discoverable through search synthesis**
with the query budget available — which is different from confirming those things don't exist in
the app. Given both `WebFetch` and (after 5 queries) `WebSearch` were unavailable for the bulk of
this pass, this corpus leans heavily on citing prior sessions' evidence precisely, and on marking
everything genuinely unaddressed as `UNKNOWN — not verified` rather than padding.

---

## Feature inventory — user-facing

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Restaurant/cafe/bakery directory & search | **REAL** | Long, independently-documented 2008–2026 operating history (Digiato, Zoomit, Tabnak, Startup360, GSM.ir — full citation chain in `profiles/fidilio.md` §"What it is"); this session's own query #2 independently confirmed live `fidilio.com/restaurants/<slug>` venue pages exist (Polo/Zanjan, Shandiz/Jordan), a small but genuine first-hand-search corroboration. |
| 2 | User reviews shown per venue (text) | **REAL**-leaning | The directory's entire 2008–2024 business model *was* a review/rating site before the 2024 delivery pivot (`profiles/fidilio.md` §"What it is"); Cafe Bazaar itself shows a 3.7/5 aggregate over 581 ratings with visible review text (fetched first-hand 2026-09-05). This is evidence the *review-display* mechanism works for the *app's own* store listing; whether venue-level review display inside the app itself still functions as described in help copy was not independently operated by any session — so I stop short of full REAL and flag the one part (in-app venue review display, as opposed to store-listing review display) that remains CLAIMED only. |
| 3 | Photo upload/gallery per venue | **UNKNOWN — not verified** | Query #6 (this session) targeting this specifically did not execute (budget exhausted). No prior session addressed photo upload. Fidilio's own help copy (cited in `profiles/fidilio.md` §"Feature inventory") only says "مشاهده نقدها و نظرات کاربران" (viewing reviews/comments), which does not itself confirm a user-facing photo-upload capability exists, only that review *viewing* is marketed. |
| 4 | Online table reservation ("رزرو میز") — feature exists at all | **CLAIMED** | Sourced only from Fidilio's own magazine (mag.fidilio.com) headlines — "رزرو میز در شب یلدا با فیدیلیو," "سیستم رزرو رستوران چه تاثیری روی فروش شما می‌گذارد؟" (`profiles/fidilio.md` §"Feature inventory"). No independent, dated review or article in the entire corpus (across 4 sessions, 100+ search queries) confirms this feature is live and operable in the app today. **Working against it, not for it:** the app's own Cafe Bazaar store name is «فیدیلیو | سفارش غذا» — "food ordering," not reservation (fetched first-hand, 2026-09-05) — and of the 6 known reviews in the whole corpus (all Sept–Oct 2025, fetched or search-synthesized), **zero mention table reservation, booking, or a table-selection screen at all**; every one is about login/OTP, payment, or generic bugs. That is a real, if soft, negative signal — not proof of ABSENT (no session has operated the app to confirm the feature is truly missing from the current build), but enough that I am not upgrading this row to REAL. |
| 5 | Booking-flow steps/screens/taps (if reservation exists) | **UNKNOWN — not verified** | No screenshot, review, article, or search result in any session (including this one's dedicated query #1, which returned zero Fidilio-specific content and instead surfaced an unrelated hotel-PMS product also named "Fidelio") describes how many taps, screens, or steps the reservation flow takes, what fields it asks for, or what confirmation screen (if any) it shows. |
| 6 | Table-level selection (floor plan / pick-your-table UI) | **UNKNOWN — not verified** | No source in any session mentions a floor plan, table map, or seat/table picker of any kind for Fidilio. This is a genuinely open question, not one this session's tooling could resolve either way — I am explicitly not marking it ABSENT because no session has operated the app or read a page that would show (or fail to show) this UI. |
| 7 | Waitlist (in-app digital queue for full restaurants) | **UNKNOWN — not verified** | Query #2 this session returned only a description of a *physical* walk-in queue at one restaurant (Shandiz, ~30min on weekends), sourced from general restaurant-listicle content, not from any Fidilio product description. No source anywhere in the corpus describes an in-app waitlist/queue-join mechanic. |
| 8 | Deposits / prepayment for table reservation | **UNKNOWN — not verified** | `business.md` §"What this session did NOT verify," item 5, already establishes: "no evidence found that Fidilio's رزرو میز feature carries any consumer-side fee at all... UNKNOWN, not ABSENT — I did not operate the app to confirm reservation is fee-free versus simply undocumented online." This session's query #3, aimed squarely at prepayment/deposit/cancellation-penalty terms, returned zero Fidilio-specific results (only an unrelated short-term-rental platform, Mihmanshow, and traffic-fine content — both excluded as false matches). The gap stands, now with one more failed targeted attempt behind it. |
| 9 | Cancellation-policy display before booking commit | **UNKNOWN — not verified** | Same query #3 as above, same null result. `business.md` §3 recovered fragments of `fidilio.com/rules` (unreadable directly) describing a general liability disclaimer for *food-order* quality/delivery and a price-finality clause for checkout — neither fragment is about table-reservation cancellation specifically. No evidence either way. |
| 10 | Online food ordering / delivery checkout | **REAL** | Independently confirmed live since June 2024 by Zoomit, Digiato, Tabnak (`profiles/fidilio.md` §"What it is"); one of the 6 known reviews (alireza, ۱۴۰۴/۰۷/۳۰ ≈2025-10-22, fetched verbatim 2026-09-05) directly references "موقع پرداخت انلاین" (during online payment) failing with a 404 — i.e. an *online payment step exists and was observed*, even though the observation is of it failing, not succeeding. |
| 11 | Push notifications (existence, content, opt-out control) | **UNKNOWN — not verified** | Query #5 this session, aimed directly at this, returned zero Fidilio-specific results — only generic OS-level notification-management how-tos not naming the app. No prior session addressed notification behavior at all (flagged as an open gap in `profiles/fidilio.md` item 8 and repeated, unresolved, in every subsequent corpus file). Genuinely untouched across the entire research line. |
| 12 | Loyalty — earn mechanic ("Fidilio Club") | **CLAIMED** | Two data points, neither independently confirmed operating in the live app: (a) an old, undated Facebook post, "3 points per 2,000 Toman at Morano restaurant, +25% discount" (`profiles/fidilio.md` §"Business model & pricing"); (b) `business.md` §5's newer, broader search-synthesis finding of a **per-merchant range, 1–5 points per 2,000 Toman**, with two named current examples (Café Restaurant Saran: 15% off + 2pts/2,000T; Larisa Vank: 10% off + 2pts/2,000T). Both are search-synthesis, unconfirmed by direct page read. |
| 13 | Loyalty — tier structure (bronze/silver/gold) | **CLAIMED, with an unresolved internal contradiction** | `business.md` §5: two independently-phrased search-synthesis queries agree Silver→Gold = 12,000 points; only one of the two supplies a Bronze→Silver figure (5,000 points), the other is silent on it (not contradicting, just missing). Maintenance thresholds claimed: Silver requires ≥2,500 pts/year to avoid demotion to Bronze; Gold requires ≥6,000 pts/year to avoid demotion to Silver. **No session has operated a real account to verify any of this end-to-end**, so it stays CLAIMED, not REAL, per the task's own labeling rule. |
| 14 | Loyalty — points expiry | **UNKNOWN — not verified** | `business.md` §5: a directly-targeted query (their #16) returned zero Fidilio-specific results — only unrelated Digikala/Snapp Club content. No session has found any Fidilio Club expiry policy, positive or negative. |
| 15 | Loyalty — redemption mechanic/rate | **UNKNOWN — not verified**, with one number explicitly flagged as NOT a disclosure | `business.md` §5 records a search-synthesis figure ("≈400–2,000 Toman per point") but explicitly labels it as the search engine's own inverse arithmetic on the *earn* rate, **not a redemption rate Fidilio itself discloses anywhere found**. I am repeating that caveat here rather than letting the number migrate into this table as if it were a company disclosure — it is not. The actual redemption minimum (how many points are needed to redeem anything) is UNKNOWN. |
| 16 | Loyalty — referral mechanic | **UNKNOWN — not verified** | No source in any session (this one included — no query this session was able to reach this specific question before the budget ran out) describes a referral bonus, invite mechanic, or referral link for Fidilio Club, in contrast to e.g. TheFork's YUMS (500-point referral bonus, documented in `MATRIX.md`'s loyalty table). Absence of evidence, not evidence of absence. |
| 17 | Loyalty — streaks (consecutive-visit or consecutive-order bonuses) | **UNKNOWN — not verified** | No mention anywhere in the corpus. Not specifically targeted by any session's queries either — a genuinely open, unexamined question. |
| 18 | Loyalty — birthday/anniversary reward (diner-facing) | **UNKNOWN — not verified**, distinct from a similarly-named restaurant-facing tool (see row 21) | The only "birthday" mention anywhere in the corpus is **FidiOffer**'s marketing copy describing "automated birthday/anniversary messages" as a *restaurant-configurable CRM feature* (`profiles/fidilio.md` §"Feature inventory," FidiOffer row) — i.e., a tool a restaurant uses to message *its own* customers, not a diner-facing Fidilio Club perk analogous to Chipotle's or Starbucks' birthday reward. Whether Fidilio Club itself (the diner-facing points program) has a separate birthday bonus is UNKNOWN — not addressed by any source. I am flagging this distinction explicitly so the two are not conflated in `MATRIX.md`. |
| 19 | Coupon/discount codes (platform-level) | **REAL (existence)**, funding source **UNKNOWN** | A live example exists: Mopon (third-party coupon aggregator) lists a Fidilio Ramadan-period code, "up to 10% off, capped at 100,000 Toman" (`profiles/fidilio.md` §"Business model & pricing"). `business.md` §6 attempted to determine whether Fidilio or the restaurant funds such codes and got an explicit non-answer from search-synthesis — "the search results do not provide clear information about which party pays" — correctly declined by that session as not a fact. Unresolved. |
| 20 | RTL Persian-language interface | **REAL** (at the language/direction level) | The entire product surface — app, magazine, store listing, and every user review found across the corpus (6 of 6, all in Persian) — operates in Persian, which is RTL by construction. This is well-evidenced at the "the product is a Persian-language product" level. **What is NOT verified**: Persian-digit rendering *inside the app's own UI* specifically (the Persian-digit dates seen in reviews — e.g. «۱۴۰۴/۰۶/۲۲» — are Cafe Bazaar's own review-timestamp formatting, not confirmed to originate from Fidilio's app code), and whether fonts are self-hosted vs. remotely loaded (a specific concern given this project's own CLAUDE.md rule that Google Fonts is unreachable from Iran). `MATRIX.md`'s existing "RTL + Persian-first UX with self-hosted fonts" row for Fidilio is **UNKNOWN** and this session found nothing to change that — it remains UNKNOWN specifically for the self-hosted-fonts sub-claim, separate from the base language claim. |
| 21 | Accessibility (touch targets, screen-reader support, focus handling) | **UNKNOWN — not verified** | Zero evidence anywhere in the corpus, across all 4 sessions and well over 100 search queries combined. No `MATRIX.md` row exists for Fidilio on this axis either — genuinely untouched ground, not merely under-cited. Would require hands-on device testing, which no session's tooling has permitted. |
| 22 | Offline behaviour | **UNKNOWN — not verified** | Zero evidence anywhere in the corpus. Fidilio ships as a native Android APK distributed via Cafe Bazaar/Myket (not a PWA, as far as any session has determined) — native-app distribution via domestic Iranian stores is itself a sanctions-adaptation data point (Google Play's own presence is UNKNOWN per `profiles/fidilio.md` item 4), but that is a distribution-channel fact, not evidence of how the app behaves with no network connection. No session has tested this. |
| 23 | iOS app | **UNKNOWN — not verified** | Unchanged from prior sessions: only a third-party mirror (appstor.io / sibirani.com/appleapps.ir per `store-reviews.md` item 5) references an iOS build; Apple's own App Store page has never been reached by any session. |

## Feature inventory — restaurant-facing (what a restaurant owner/operator can configure)

| # | Feature | Status | Evidence |
|---|---|---|---|
| 24 | Dedicated restaurant/business partner portal | **REAL (existence)**, content **UNKNOWN** | `business.md` §2: `business.fidilio.com/رستوران/` is a real, distinct subdomain, confirmed to exist across four independently-phrased search queries in that session; `WebFetch` against it returned `EGRESS_BLOCKED` in that session and again in this one (this session's WebFetch attempt #4, above). No session has read its actual content — what a restaurant can configure through it (menu editing, hours, table capacity, blackout dates, staff accounts, etc.) is entirely UNKNOWN. |
| 25 | FidiOffer — merchant CRM / gamified offers | **CLAIMED** | Sourced only from Fidilio's own magazine ("فیدی‌آفر تحولی در ارتباط با مشتریان" — "FidiOffer: a transformation in customer relations") per `profiles/fidilio.md` §"Feature inventory." Described as offering "gamified offers" and "automated birthday/anniversary messages" — no independent confirmation of either sub-feature actually functioning, no screenshot, no dated third-party review of a restaurant using it. |
| 26 | CRM segmentation/tagging (VIP, repeat-customer tags, etc.) | **UNKNOWN — not verified** | No source in the entire corpus describes Fidilio offering restaurant-side customer segmentation or tagging comparable to SevenRooms' or Servme's documented tag systems (`MATRIX.md` rows 57, and footnotes 39–40 citing `profiles/servme.md`). FidiOffer's marketing copy (row 25) implies *some* customer-relationship tooling exists but does not itself describe segmentation/tagging as a named capability — I am not inferring it from the CRM label alone. |
| 27 | Marketing automation (beyond birthday/anniversary messages) | **CLAIMED (limited to what's named)** | The only concretely-named marketing-automation capability anywhere in the corpus is FidiOffer's "automated birthday/anniversary messages" (row 25/18). No evidence of automated win-back campaigns, abandoned-order nudges, or scheduled promotional blasts — not found, not specifically ruled out either. |
| 28 | Restaurant commission rate (self-serve pricing transparency) | **UNKNOWN — not verified** | This is a business-model question rather than a UX feature per se, but it bears directly on "what a restaurant can configure" (a restaurant cannot self-serve-configure a rate it cannot see). `business.md` §1 establishes, after three sessions and 15+ differently-phrased queries: no signup fee, commission "per contract," **rate never disclosed anywhere in the open web**. Repeated here because it is the single most consequential UNKNOWN for any restaurant evaluating Fidilio against Rezervno's own pricing. |
| 29 | POS integration | **UNKNOWN — not verified** | Zero evidence in the entire corpus. `business.md`'s query #21 surfaced an article (virgool.io) explicitly naming a *different* competitor's (Delino's) integration with "Sepid POS software" while discussing commission rates — the same article did **not** surface any POS-integration detail for Fidilio specifically. No session has found a Fidilio POS partner named anywhere (contrast with `profiles/foodism.md` footnote 176's finding of "Sepidz, Hami POS" mentions for a different competitor, per this repo's own MATRIX footnote 63 area — Fidilio has no equivalent finding). |
| 30 | Payment gateway used for in-app checkout | **UNKNOWN (gateway identity)**, **REAL (that some gateway exists)** | The alireza review (fetched verbatim, 2026-09-05) confirms an online-payment step exists at checkout and that it can fail with a 404. No source in any session names which Iranian payment gateway (Zarinpal, Zibal, IDPay, Behpardakht, etc.) Fidilio uses. Given this project's own CLAUDE.md flags Zarinpal's Rial-vs-Toman default as a known 10× trap, this is a directly relevant open question for a future session with working `WebFetch` to resolve against `fidilio.com` or the app's own payment-selection screen. |
| 31 | Restaurant-configurable notification/marketing opt-out for *its own* customers | **UNKNOWN — not verified** | Not addressed by any session. Distinct from row 11 (diner's own opt-out of Fidilio's platform-level notifications) — this row is about whether a restaurant using FidiOffer can control frequency/opt-out for its own automated messages. No evidence either way. |
| 32 | Table capacity / hours / blackout-date management | **UNKNOWN — not verified** | No source describes this at all. Given row 4–9's findings (reservation feature itself only CLAIMED, no booking-flow detail found), this is downstream of an already-thin evidentiary base — flagged as open rather than inferred. |

---

## What this corpus adds that is genuinely new to the Fidilio research line

- The **Fidelio (hotel PMS) name-collision hazard** (row 1 of the query list) — a fourth
  distinct false-match pattern for this competitor's name, after Fidibo, Fidelity, and Flightio
  already flagged in `profiles/fidilio.md` and `social.md`. Worth carrying forward as a standing
  caution for any future session running English-adjacent or transliteration-heavy queries.
- The explicit **zero-of-6 reviews mention reservation/booking/table-selection** observation
  (row 4) — a modest, honestly-caveated negative signal that no prior session stated this way,
  even though the underlying 6 reviews were already fully catalogued by `store-reviews.md`.
- The **FidiOffer birthday-messaging / diner-facing-birthday-reward distinction** (row 18) —
  flagging that the only "birthday" evidence in the whole corpus is a restaurant-side marketing
  tool, not a diner-side loyalty perk, which prior documents did not separate out.
- Explicit **UNKNOWN status, now on the record for the first time**, for: table-level selection,
  waitlist, accessibility, offline behaviour, POS integration, payment-gateway identity, and
  restaurant-configurable notification opt-out. None of these had a row anywhere in this research
  line or `MATRIX.md` before this pass — they were silent gaps, not stated unknowns. Making them
  explicit is this corpus's main contribution given how little fresh evidence the tooling allowed.

## What this session could NOT do (explicit gap list)

1. **Could not read Cafe Bazaar's screenshot carousel** — the single highest-value target for
   this mode. All 6 `WebFetch` attempts this session (example.com control plus 5 mode-specific
   targets) returned `EGRESS_BLOCKED`.
2. **`WebSearch` budget was exhausted after 5 queries** (session-wide, shared with earlier
   same-day corpus work) — a hard tooling ceiling, not a diligence shortfall. A planned ~25
   further queries (photo upload, table/floor-plan UI, restaurant-side settings screens,
   FidiOffer screenshots, POS partner names, payment-gateway identity, accessibility) were never
   run.
3. **No app was installed, no account created, by this or any prior session** — every REAL/CLAIMED
   distinction above rests on that limit; nothing in this corpus should be read as first-hand
   operation of the app's UI.
4. Rows 6, 7, 8, 9, 11, 14, 16, 17, 21, 22, 23, 24 (content), 26, 27, 29, 31, 32 are all
   **UNKNOWN — not verified**, most of them untouched by any session to date. This is the honest
   state of the evidence, not a placeholder to be filled by invention.

## Sources

All accessed 2026-09-07.

**WebFetch attempts (all `EGRESS_BLOCKED`, this session):** `example.com`,
`cafebazaar.ir/app/com.fidilio`, `fidilio.com/rules`, `business.fidilio.com/رستوران/`,
`apkpure.net/fidilio-cafes-restaurants/com.fidilio`, `myket.ir/app/com.fidilio`.

**WebSearch queries run this session (5 of a planned ~30; budget exhausted; results detailed in
the Methodology section above; none surfaced new Fidilio-specific feature evidence):**
`فیدیلیو رزرو میز مراحل نحوه انتخاب صندلی`, `فیدیلیو لیست انتظار waitlist رستوران شلوغ`,
`فیدیلیو رزرو میز پیش پرداخت بیعانه لغو جریمه`, `فیدیلیو اسکرین‌شات اپلیکیشن معرفی صفحات`,
`فیدیلیو اعلان نوتیفیکیشن پوش تنظیمات غیرفعال کردن` (6th query,
`فیدیلیو آپلود عکس نظر کاربران گالری رستوران`, did not execute — budget exhausted).

**Cited from prior sessions (not re-verified this session — see each file's own full source
list):**
- `docs/audit/research/profiles/fidilio.md` (main profile + 2026-09-05 ADDENDUM) — Cafe Bazaar
  first-hand fetch (3.7/5, 581 ratings, 110,000 installs, store name «فیدیلیو | سفارش غذا»),
  3 verbatim reviews (علیرضا ۱۴۰۴/۰۶/۲۲, محمد ۱۴۰۴/۰۷/۱۹, alireza ۱۴۰۴/۰۷/۳۰), FidiOffer and
  Fidilio Club marketing-copy citations, mag.fidilio.com article titles.
- `docs/audit/research/corpus/fidilio/store-reviews.md` — full 6-review catalogue and sample-size
  accounting; confirms no Myket/Google Play/G2/Capterra/Trustpilot content ever surfaced.
- `docs/audit/research/corpus/fidilio/business.md` — `business.fidilio.com/رستوران/` and
  `fidilio.com/rules` discovery, order-economics figures (min order 100,000 Toman, 4km radius,
  <30min SLA, restaurant-funded free delivery), Fidilio Club tier/earn-rate detail and its
  Bronze→Silver contradiction, commission-rate UNKNOWN status.
- `docs/audit/research/corpus/fidilio/social.md` — WhichApp.ir aggregate scores (support 5.7/10,
  lowest of 5 categories), Glassdoor employee review, SnappFood-exclusivity restaurant-owner
  account, official social-handle inventory.
- `docs/audit/research/MATRIX.md` — cross-competitor rows for RTL/fonts, native diner loyalty,
  and cross-tenant isolation, confirmed to carry no accessibility/offline/POS row for Fidilio
  (or any competitor) before this pass.

## Contradiction check — final

None found between this corpus and any prior document. This corpus's own internal
contradiction-in-waiting (row 13's Bronze→Silver tier-threshold discrepancy) is `business.md`'s,
carried forward and not re-litigated here.
