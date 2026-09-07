# SmartX — Observed Feature Inventory (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_
_Mode: OBSERVED FEATURE INVENTORY (booking flow, table selection, waitlist, deposits, cancellation
display, loyalty mechanics, notifications, reviews/social, CRM/segmentation, marketing automation,
POS/payment integrations, languages/RTL, accessibility, offline behaviour, restaurant-side
configuration)_

## Prior art read first (per task instructions) — this file extends, does not repeat

Read in full before writing anything below:
- `docs/audit/research/profiles/smartx.md` — base profile (2026-09-04, `WebSearch`-only pass) plus
  its 2026-09-05 ADDENDUM (first-hand `WebFetch` corrections to pricing and the `/sorry/` page).
- `docs/audit/research/corpus/smartx/business.md` (2026-09-07, earlier same-day session) — mode
  BUSINESS MODEL/PRICING/TERMS. Both `WebFetch` and `WebSearch` were unavailable to that session.
- `docs/audit/research/corpus/smartx/social.md` (2026-09-07, earlier same-day session) — mode
  SOCIAL AND FORUMS. Same tooling gap; `reviews_read = 0`.
- `docs/audit/research/corpus/smartx/store-reviews.md` (2026-09-07, earlier same-day session) —
  mode STORE REVIEWS AT VOLUME. Same tooling gap; `reviews_read = 0` there too.
- `docs/audit/research/MATRIX.md` — SmartX cells across all three capability tables (Reservation &
  commercial-terms; Loyalty & rewards-mechanics; Trust, notification & platform-hygiene) and
  footnotes 2, 6, 14, 17, 18, 30, 33, 58.
- `docs/audit/research/WATCH.md`, `docs/audit/research/PARITY-RISK.md`,
  `docs/audit/research/ANTI-PATTERNS.md`, `docs/audit/research/recon-notes-global.md`,
  `docs/audit/research/STATUS-2026-09-07.md` — all contain SmartX material; cross-checked below.

**This file's contribution:** the prior four SmartX documents are organized by *research mode*
(business/social/reviews) or as a general profile; none of them is laid out as a feature-by-feature
inventory against the specific checklist this task asks for (booking-flow steps, table-level
selection, waitlist, deposits, cancellation display, loyalty sub-mechanics, notification opt-out,
reviews/photos, CRM/segmentation, marketing automation, POS/payment integrations, RTL/Persian
digits, accessibility, offline behaviour, and — new to this file — what the *restaurant* can
configure). This file reorganizes every fact already on record into that shape, adds nothing
fabricated, and is explicit about which rows have zero evidence rather than omitting them.

**Contradiction check against prior research (required by task instructions):** none found. This
session's tool tests (below) reproduce exactly the same failure modes the three same-day sibling
corpus files already recorded, which is corroboration, not new information.

---

## Methodology — this session's own tool tests (do this before trusting anything below)

**First action, per protocol:** `WebFetch` tested against a neutral control, then against a
feature-relevant primary target (the reservation product page, since booking-flow/table-selection
detail is this mode's highest-priority target).

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `WebFetch` | `https://smartx.ir/services/reserve/restaurant/` | Primary target for this mode (booking-flow/table-selection detail) | `EGRESS_BLOCKED` |
| 3 | `WebSearch` | `smartx.ir رزرو هوشمند رستوران مراحل رزرو انتخاب میز` | Booking-flow-steps fallback (Persian) | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls). Continue with the information already gathered instead of issuing more searches."* |
| 4 | `WebSearch` | `smartx.ir services reserve restaurant booking table features` | Booking-flow-steps fallback (English) | Rejected: identical budget-exhaustion message |

**`webfetch_worked = false`.** `WebSearch` returned the identical session-wide "200 of 200" budget
exhaustion the three same-day sibling corpus files (`business.md`, `social.md`, `store-reviews.md`)
all independently reported — confirming this is a shared, account-level quota already spent by
concurrent sessions before this task's first query executed, not a per-competitor or per-mode
limit. Retrying further was not attempted beyond these two queries, since the rejection message is
identical and deterministic (no partial results, no rate-limit-with-backoff shape) — the same
conclusion the three sibling sessions reached independently.

**What this means for this file, honestly:** this session added **zero new primary-source bytes**
of feature evidence. Every feature claim below is either (a) a prior session's first-hand
`[fetched]` evidence (2026-09-05, `WebFetch` was functional then), re-cited accurately with its own
original date, or (b) a prior session's `[search-synthesis]` paraphrase (2026-09-04, `WebSearch`
was functional then, `WebFetch` was not), kept at that same weaker evidence tier, or (c) explicitly
marked `UNKNOWN — not verified` where no session has ever found anything. This file's actual
contribution is reorganizing that existing evidence against a feature-inventory checklist it has
never been laid out against before, and naming every row this checklist asks for that genuinely has
zero evidence — rather than silently omitting the rows that would otherwise make the corpus look
thinner than it is.

## Reviews read this session: 0

Consistent with all three same-day sibling sessions (`business.md`, `social.md`,
`store-reviews.md`), each of which independently confirmed `reviews_read = 0` for SmartX across
*every* Scout session to date (2026-09-04, 2026-09-05, 2026-09-07 × 3). This session adds a fourth
same-day confirmation. **No review, of any kind, from any diner or restaurant owner, has ever been
read for SmartX.** Every feature status below that depends on "does this actually work as
described" therefore rests on company-published marketing copy (mostly `[search-synthesis]`,
one page-set `[fetched]` directly) — never on independent confirmation that a shipped feature
behaves as claimed in practice.

---

## Observed feature inventory

Evidence-tier key: **`[fetched]`** = a Scout session opened the page directly with a working
`WebFetch` (2026-09-05 only, to date); **`[search-synthesis]`** = never opened directly, sourced
only from `WebSearch`'s indexed-snippet paraphrase (2026-09-04); **`—`** = no source of either tier
exists for this row in any session.

### A. Booking flow (diner-facing)

| Feature | Status | Evidence |
|---|---|---|
| Online booking portal for diners (date/party size selection) | CLAIMED | `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]`, 2026-09-04. No screenshot, demo video, or live instance was ever reached by any session — the specific screen sequence, number of taps, or step count is **not described anywhere in the corpus**; the base profile's "What it is" section names the capability at the sentence level only ("web-based reservation/table-booking & appointment management, with an online booking portal for diners... POS integration, and prepayment/deposit support"), not as a walked-through flow. |
| Exact number of steps/screens/taps to complete a booking | UNKNOWN — not verified | No source, of either evidence tier, in any session, ever described the booking flow at screen-by-screen granularity. This is flagged explicitly because the task brief asks for it by name and no prior SmartX document addresses it at all — a genuine, previously-unflagged gap. |
| Dish/menu selection as part of the reservation flow | CLAIMED | `profiles/smartx.md` §"What it is" mentions "table selection, and dish selection" language paraphrased from `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]`, 2026-09-04. Never independently confirmed; no menu-integration mechanism (does the restaurant upload a menu? is it linked to POS items?) is described anywhere. |
| POS/checkout integration, automated "reservation to exit" flow | CLAIMED | `smartx.ir/services/reserve/`, `smartx.ir/services/club/`, `[search-synthesis]`, 2026-09-04. Marketing-level description only ("از رزرو تا خروج" — "from reservation to exit"); no screenshot or technical integration detail (which POS systems, what data crosses, real-time vs. batch) was ever found. |

### B. Table-level selection

| Feature | Status | Evidence |
|---|---|---|
| Table-level (as opposed to time-slot-only) selection for the diner | UNKNOWN — not verified | Neither `[fetched]` nor `[search-synthesis]` evidence distinguishes whether SmartX's "table selection" (see row above) means the diner picks a *specific numbered table* (floor-plan-style, the way some Western competitors like Resy/OpenTable's table-management modules work) versus the *restaurant staff* assigning a table internally after a diner submits a generic slot request. The Persian phrase paraphrased in the base profile — "میز" (table) appearing alongside "رزرو" (reservation) in marketing copy — is consistent with either reading and was never resolved by opening a live booking widget. |
| Floor-plan / visual table-map management tool (staff-facing) | UNKNOWN — not verified | No source describes a visual floor-plan UI for staff, in contrast to how `profiles/opentable-resy-sevenrooms.md` documents SevenRooms' and OpenTable's table-management tooling explicitly. Not confirmed absent — simply never reached. |

### C. Waitlist

| Feature | Status | Evidence |
|---|---|---|
| Waitlist / "smart list" of incoming requests | CLAIMED | `smartx.ir/services/reserve/`, `[search-synthesis]`, 2026-09-04, per `profiles/smartx.md` §"Feature inventory" ("Waitlist / filtered 'smart list' of incoming requests"). This is the weakest-sourced row in this section — the exact Persian phrase behind "filtered smart list" was never captured verbatim, only WebSearch's own English paraphrase of it. Whether this is a true FIFO/managed waitlist with diner-visible position/wait-time (the way OpenTable/Resy waitlists work) or simply a staff-side request-triage inbox is UNKNOWN — not verified, and the two are materially different products. |
| Diner-visible wait-time estimate or queue position | UNKNOWN — not verified | No source addresses this at all. |

### D. Deposits / prepay

| Feature | Status | Evidence |
|---|---|---|
| Online prepayment/deposit for reservations | CLAIMED | `smartx.ir/services/reserve/restaurant/`, `smartx.ir/pricing/`, `[search-synthesis]`, 2026-09-04 — carried forward unchanged from `profiles/smartx.md` and reconfirmed as still-unresolved in `corpus/smartx/business.md` §5 ("Diner-side money"). |
| Deposit amount, percentage, or trigger condition (e.g., party size ≥ N, high-demand date) | UNKNOWN — not verified | No figure, percentage, or trigger rule has ever been found by any session, across four dated passes (2026-09-04, 2026-09-05, and two same-day 2026-09-07 sessions). `MATRIX.md`'s "Upfront fee/deposit/cancellation transparency before commit" row marks SmartX `UNKNOWN — consumer never sees SmartX pricing directly` (footnote 6). |
| Payment-gateway integration for prepayment | CLAIMED (existence) / UNKNOWN (which gateway, fees) | Described as existing (setup fee + per-transaction fee) at `smartx.ir/services/reserve/restaurant/`, `[search-synthesis]`, 2026-09-04; no gateway name (Zarinpal, IDPay, etc.), no Toman figure for the setup or per-transaction fee has ever been found. `corpus/smartx/business.md` §1 "Add-ons and hardware" confirms this remains unresolved as of 2026-09-07. |

### E. Cancellation policy display

| Feature | Status | Evidence |
|---|---|---|
| Diner-facing cancellation/no-show policy shown before booking is confirmed | UNKNOWN — not verified | **No page describing a diner-facing cancellation or no-show fee has ever been reached for SmartX by any session**, per `corpus/smartx/business.md` §5. `MATRIX.md`'s dedicated row "A money charge cannot become enforceable before it is displayed to the diner" marks SmartX cell `UNKNOWN` (not `ABSENT`, not `REAL`) for exactly this reason. **This must not be confused with RSEE** (a structurally different, chair-credit-denominated Iranian competitor covered in `profiles/iran-reservation-longtail.md`), whose own site explicitly states a 100%/50%/0% cancellation-forfeiture schedule — that policy belongs to RSEE, not SmartX, and conflating the two would be a fabrication per the constitution's own rules. |
| Refund window (hours/days before a refund is honored) | UNKNOWN — not verified | Never found, restated from `corpus/smartx/business.md` §6. |

### F. Loyalty mechanics (earn / tiers / expiry / redeem / referral / streaks / birthday)

The Customer Club (باشگاه مشتریان) product is SmartX's loyalty/CRM offering, sold to the
*restaurant* to run its *own* branded program — SmartX itself has no cross-restaurant loyalty
currency the way TheFork's YUMS or SnappFood's Snapp Club do. `MATRIX.md`'s loyalty table marks
SmartX `N/A (B2B; loyalty is the *restaurant's*, not SmartX's own)` for the "native, in-house diner
loyalty" row — this frames every sub-row below.

| Mechanic | Status | Evidence |
|---|---|---|
| Purchase-history tracking / RFM-style customer segmentation | CLAIMED | `smartx.ir/services/club/`, `[search-synthesis]`, 2026-09-04, per `profiles/smartx.md` §"What it is." "RFM-style" is the base profile's own analytical framing of the marketing description, not a term SmartX's own copy was confirmed to use verbatim — flagged so this distinction is not lost in re-citation. |
| Coupons | CLAIMED | Same source. No coupon-value range, funding source confirmation beyond inference (see `corpus/smartx/business.md` §8 — restaurant funds its own coupons, SmartX supplies the mechanic only, itself an *inference* not a direct statement), or redemption-mechanics detail (single-use? stackable? expiring?) has ever been found. |
| Gamified "wheel of fortune" add-on | CLAIMED | `smartx.ir/services/club/`, `smartx.ir/pricing/` (as an add-on line item), `[search-synthesis]`, 2026-09-04. No screenshot, odds/probability disclosure, or prize-structure detail was ever found. |
| Points earn rate / conversion (points per Toman spent, or equivalent) | UNKNOWN — not verified | No numeric earn rate has ever been found for SmartX, in contrast to the specificity available for TheFork (100 pts/booking) or SnappFood (10 pts/1,000 Toman) per `profiles/thefork.md` and `profiles/snappfood-loyalty.md`. Per `corpus/smartx/business.md` §7: "No points-to-Toman conversion rate... has ever been found or fetched." |
| Tier structure (bronze/silver/gold-equivalent) | UNKNOWN — not verified | No tier names, thresholds, or tier-specific perks were ever found. Whether Customer Club even implements tiers (vs. a flat segmentation-only model) is itself unconfirmed. |
| Expiry clock on accrued points/coupons | UNKNOWN — not verified | Per `corpus/smartx/business.md` §7, no expiry clock has ever been found or fetched for Customer Club. |
| Redemption minimum balance | UNKNOWN — not verified | Same source, same section — never found. |
| Referral mechanic | UNKNOWN — not verified | No source, of either evidence tier, describes a referral program (diner-refers-diner) for SmartX's Customer Club, in contrast to TheFork's confirmed 500-point referral bonus. Not confirmed absent — never addressed by any source found. |
| Streaks (consecutive-visit mechanics) | UNKNOWN — not verified | No source addresses this. |
| Birthday reward | UNKNOWN — not verified | No source addresses this, despite the base profile noting SmartX's own copy describes "customer purchase-history tracking" broadly — a birthday-specific mechanic was never itemized. |
| Churn-risk flagging (staff-facing) | CLAIMED | `smartx.ir/services/club/restaurant/`, `[search-synthesis]`, 2026-09-04, per `profiles/smartx.md` §"What it is" ("churn-risk flags"). Mechanism (what triggers a flag, what action a restaurant is prompted to take) never described. |
| Multi-branch quality-control reporting | CLAIMED | Same source. No screenshot or detail on what "quality control" reporting actually surfaces. |
| Cash incentive tied to phone-number capture rate | **REAL** — `[fetched]`, 2026-09-05 | This is the single most concretely-evidenced mechanic in this entire section, and it sits on the *pricing* side, not the loyalty-feature-description side: SmartX's usage-based pricing model gives restaurants a **30% discount when 75%+ of a restaurant's invoices carry a captured customer phone number** — confirmed directly from `smartx.ir/pricing/`, `[fetched]` 2026-09-05, per `corpus/smartx/business.md` §1 and flagged independently in `ANTI-PATTERNS.md` item #14 ("Monetizing mandatory data capture behind a 'free' service, with the incentive stated openly") and `MATRIX.md` footnote 58. This is REAL because the pricing-page mechanic itself was read directly, not because any downstream effect on diners was observed. |

### G. Notifications and opt-out controls

| Feature | Status | Evidence |
|---|---|---|
| SMS-based marketing messaging as a core Customer Club feature | CLAIMED | `smartx.ir/pricing/` (SMS billed separately, pay-as-you-go, purchased in-panel), `[search-synthesis]`, 2026-09-04, per `profiles/smartx.md` §"Gen-Z lens" item 6. This is restaurant-initiated, push-style marketing SMS, billed to the restaurant per message. |
| Diner-controlled notification preferences / opt-out mechanism | ABSENT-leaning, not confirmed ABSENT | No page, of either evidence tier, describes a diner-facing opt-out control for these SMS messages. `MATRIX.md`'s "Mandatory phone-capture as price of a 'free' service, disclosed clearly" row marks SmartX cell **"ABSENT-leaning"** specifically: "no diner complaint found but no visible opt-out described either" (footnote 30). This is downgraded from a bare ABSENT to "leaning" because the constitution's own rule (§2, "we don't know is never zero") applies — no session ever reached a page that would show an opt-out control if one existed, so its absence from marketing copy is suggestive, not conclusive. |
| SMS-OTP for Smart WiFi captive-portal login | CLAIMED | `smartx.ir/services/wifi/restaurant/`, `smartx.ir/faq/`, `[search-synthesis]`, 2026-09-04. Explicitly described as "for building a marketing database" per the same source. No opt-out from *this specific* capture mechanism (a diner who wants WiFi but not to be added to the marketing list) was ever described. |
| Fail-closed SMS behavior (no silent fallback / fabricated success) for SmartX specifically | UNKNOWN — not verified | `MATRIX.md`'s dedicated fail-closed row marks SmartX `UNKNOWN` (contrast Rezervno-today, marked `REAL` at `api/src/lib/sms.ts:278-281`, footnote 29 — an internal Rezervno fact, not a SmartX one). No SmartX-side evidence of this either way exists in the corpus. |

### H. Reviews / photos / social

| Feature | Status | Evidence |
|---|---|---|
| Diner-facing review/rating feature within a SmartX-branded surface | ABSENT | SmartX has no diner-facing consumer app or marketplace at all (`profiles/smartx.md` §"Who it's for" — confirmed via the Myket listing being gated to existing account holders only, and via `MATRIX.md`'s "Own consumer discovery marketplace" row marking SmartX `ABSENT`, footnote 2). A review/rating feature requires a diner-facing surface to live on; none exists. This is the one row in this section with genuine `ABSENT` confidence rather than `UNKNOWN`, because it follows structurally from an already-confirmed fact (no consumer surface exists) rather than from a search that came up empty. |
| Photo upload (diner or restaurant) | ABSENT | Same reasoning — no diner-facing surface exists to upload to. |
| Social sharing / referral mechanic | UNKNOWN — not verified | See "Referral mechanic" row in section F above — never addressed by any source. |
| Independent third-party review-platform presence (App Store/Play/G2/Trustpilot/Capterra) | **ABSENT — zero found**, `[search-synthesis]`, 2026-09-04, reconfirmed by three independent same-day 2026-09-07 sessions finding nothing new | `profiles/smartx.md` §"Feature inventory" row; `MATRIX.md`'s "Independent, third-party-reviewable footprint" row marks SmartX `ABSENT — zero independent review-platform presence found anywhere` (footnote 33). `corpus/smartx/store-reviews.md` independently tried Myket, Cafe Bazaar, Google Play, Trustpilot, G2, APKPure, and the iOS App Store directly via `WebFetch` on 2026-09-07 and found every one `EGRESS_BLOCKED` — so this session's zero is reconfirmed absence-in-search (2026-09-04) plus a tooling gap on the fetch side (2026-09-07), not a fresh independent finding. |

### I. CRM / segmentation / tags

| Feature | Status | Evidence |
|---|---|---|
| Customer segmentation (RFM-style, described above) | CLAIMED | See section F. This is Customer Club's core described pitch. |
| Restaurant CRM / cross-visit guest recognition ("remembered by name") | **REAL (CLAIMED depth)** | `MATRIX.md`'s dedicated row marks SmartX "REAL (CLAIMED depth) — core pitch of 'Customer Club'" (footnote 14). Read literally: the *existence* of this as a marketed capability is REAL (the product category and marketing claim genuinely exist); the *depth/accuracy* of the recognition (does it actually remember allergy notes, past orders, visit frequency, the way SevenRooms and Servme are independently corroborated to do — Servme via a named checkable customer, Hyatt Regency Dubai, 88,000 guest profiles over 3 years, per `PARITY-RISK.md` §4) is undisclosed and unverified for SmartX. `PARITY-RISK.md` §4 groups SmartX alongside SevenRooms and Servme as three structurally different companies converging on the same "remembered by name" pitch — itself signal that restaurant owners want this regardless of geography — while being explicit that SmartX is the one member of that trio with no independent depth corroboration. |
| Staff-facing tags/labels on customer profiles (e.g., VIP, regular, allergy notes) | UNKNOWN — not verified | Not itemized by any source; inferred plausible given the RFM/segmentation framing, but never directly confirmed. |
| Cross-tenant / cross-brand data isolation (architectural, not claimed) | UNKNOWN — not verified | `MATRIX.md`'s dedicated row marks SmartX `UNKNOWN` (contrast Fidilio, marked `ABSENT` following a 2024 Snapp Food address-leak controversy the CEO called a "technical bug," footnote 16 — a different Iranian competitor's confirmed failure, not SmartX's). No SmartX-specific architecture evidence exists in the corpus either way. |

### J. Marketing automation

| Feature | Status | Evidence |
|---|---|---|
| Automated CSAT/evaluation survey collection post-visit | CLAIMED | `smartx.ir/services/evaluation/restaurant/`, `[search-synthesis]`, 2026-09-04 — this is SmartX's fourth product line (ارزیابی هوشمند / Smart Evaluation), positioned as faster/cheaper than manual outreach. Mechanism (SMS-triggered survey link? in-app? timing after checkout?) never described. |
| Automated marketing SMS campaigns triggered by segmentation/churn signals | CLAIMED (existence) / UNKNOWN (automation logic) | Inferred from the combination of "churn-risk flags" (section F) and "SMS billed separately, purchased in-panel" (section G) — but no source directly confirms an automated trigger (e.g., "SMS sent automatically when a customer is flagged at-risk") versus a manual campaign tool the restaurant operates by hand. Flagged as an inference, not a confirmed mechanic. |

### K. POS / payment integrations

| Feature | Status | Evidence |
|---|---|---|
| POS/checkout integration (general) | CLAIMED | See section A — "reservation to exit" automated handoff, `[search-synthesis]`, 2026-09-04. No named POS system, API surface, or integration mechanism (webhook? file export? direct DB link?) was ever found. |
| Named POS partner ecosystem | **REAL (business relationship, not a technical integration detail)** | The base profile's "Identity check" and "What it is" sections, corroborated across `sepidz.com/software/smart-x/`, confirm SmartX is sold as an add-on module through POS resellers **Sepidz** (سپیدز), **Sepidar Sistem**, and **Vendo** — this is a genuine, multiply-corroborated business-relationship fact (`smartx.ir/key-partners/`, `sepidz.com/software/smart-x/`, `[search-synthesis]`, 2026-09-04), stronger evidence than most rows in this corpus because it was independently confirmed from *two different companies' own sites* (smartx.ir and sepidz.com) describing the same relationship. This is a distribution/reseller relationship, not itself proof of a technical API integration between the two products, though the "reservation to exit" marketing language implies one exists. |
| Payment gateway (which one) for prepayment | UNKNOWN — not verified | See section D — a payment-gateway integration is claimed to exist but no gateway name has ever been found. Contrast the Rezervno codebase's own confirmed use of Zarinpal (`CLAUDE.md`, `lib/zarinpal.ts:40`) — no equivalent SmartX-side confirmation exists. |
| RFID card integration (Customer Club hardware add-on) | CLAIMED (existence) / UNKNOWN (mechanism, cost) | `smartx.ir/other-expenses/`, `[search-synthesis]`, 2026-09-04, per `corpus/smartx/business.md` §1 "Add-ons and hardware" — required hardware named, no cost or integration-mechanism detail found. |
| MikroTik router requirement (Smart WiFi) | CLAIMED (existence) / UNKNOWN (cost) | Same source and section. |

### L. Languages / RTL / Persian digits

| Feature | Status | Evidence |
|---|---|---|
| Persian-language UI | **REAL by construction** — not independently screenshot-verified, but not meaningfully in doubt | Every page, product name, and marketing phrase found across all sessions is in Persian (اسمارت ایکس, رزرو هوشمند, باشگاه مشتریان, وای‌فای هوشمند, ارزیابی هوشمند) — an Iranian company selling to Iranian restaurant owners. `MATRIX.md`'s "RTL + Persian-first UX with self-hosted fonts" row marks SmartX `UNKNOWN` rather than `REAL`, however — because that row specifically asks about **RTL layout correctness and font-hosting** (no Google Fonts dependency, per the Rezervno constitution's own hard rule), neither of which was ever screenshot-checked for SmartX. Recorded as two separate claims here rather than conflated: Persian-language content = effectively certain; RTL layout correctness and font-hosting choice = genuinely unverified. |
| RTL layout correctness (verified, not assumed) | UNKNOWN — not verified | No screenshot, live page render, or accessibility-tree read was ever obtained for any SmartX page, by any session, for either tool-availability reason (blocked) or scope reason (2026-09-04's `WebSearch`-only pass could not render layout at all). |
| Self-hosted fonts (no Google Fonts dependency) | UNKNOWN — not verified | Same reasoning — font-loading behavior requires opening the live page's network requests or source, never done for SmartX. Contrast Rezervno's own confirmed self-hosted Vazirmatn font (`shared/fonts/vazirmatn-variable.woff2`, `MATRIX.md` footnote 31) — no equivalent SmartX-side check exists. |
| Persian (Eastern Arabic) numeral rendering vs. Western digits | UNKNOWN — not verified | Every price figure quoted in this corpus and its predecessors is transcribed in Persian numerals as found in search snippets (e.g., ۵۲,۸۰۰,۰۰۰) — this reflects how the *source text* rendered when captured, not an independently confirmed statement that SmartX's live UI consistently uses Persian digits throughout (vs. mixing Western digits in some contexts, a common real-world inconsistency in Iranian web products). Flagged as unverified rather than assumed. |

### M. Accessibility

| Feature | Status | Evidence |
|---|---|---|
| Touch-target sizing, ARIA labeling, keyboard focus handling | UNKNOWN — not verified | No source, of any evidence tier, addresses accessibility for SmartX at all — not in the base profile, not in any of the three same-day corpus files, not in `MATRIX.md`. This is a genuine, previously-unflagged gap: the task brief's own a11y checklist item (touch target ≥24px/44px, ARIA, keyboard focus — the same bar `CLAUDE.md` sets for Rezervno itself) has never been evaluated against SmartX by any Scout session. Because SmartX has no diner-facing consumer surface (section H), the only accessibility-relevant surface would be its staff/manager companion app and any embedded booking widget — neither has ever been opened. |

### N. Offline behaviour

| Feature | Status | Evidence |
|---|---|---|
| Offline-tolerant client behavior (e.g., `file://` fallback, cached OTP acceptance, service-worker caching) | UNKNOWN — not verified | No source addresses this. Contrast Rezervno's own documented dual OTP path (`OTP_DEV_MODE` server-side; client-side fixed-code `1234` fallback when fully offline, per `CLAUDE.md`'s own "دمو / OTP" section) and its `apps/customer/sw.js` service worker with a versioned cache — no equivalent SmartX-side mechanism was ever searched for or found. Given SmartX has no diner-facing PWA (section H), a service-worker-style offline mode may not even be structurally applicable to it — but this is an inference from the product's shape, not a confirmed finding. |

### O. What the restaurant can configure (settings/toggles) — this competitor's B2B management surface

This is the one area where SmartX's *product category itself* (B2B management software, not a
diner app) means the restaurant-configurable surface is arguably the more central feature set than
the diner-facing one — yet it is also the least-documented, because every source found is
marketing-page-level ("what SmartX does for you"), never a screenshot or walkthrough of an actual
settings panel.

| Configurable item | Status | Evidence |
|---|---|---|
| Per-product activation (buy just Reservation, just the Club, or stack multiple lines) | **REAL (business-model level)** | Confirmed structurally by the pricing model itself — four separately-priced product lines plus bundle discounts (2-service, 3-service, full 4-product bundle), per `corpus/smartx/business.md` §1, `[fetched]` 2026-09-05. A restaurant genuinely can and does choose which subset to buy — this is not a marketing claim but a direct consequence of the published per-product pricing structure. |
| Usage-based vs. flat-subscription billing model choice | **REAL** | Same source — both Model A (flat annual per product) and Model B (activation + per-transaction fee, with the 30% phone-capture discount) are published side-by-side on the same pricing page, `[fetched]` 2026-09-05, implying the restaurant chooses between them. |
| Coupon/discount configuration within Customer Club | CLAIMED | See section F — coupons exist as a mechanic; no evidence of what the restaurant can actually configure (value, expiry, eligibility rules) was ever found. |
| Multi-branch reporting/rollup configuration | CLAIMED | See section F, "multi-branch quality-control reporting" — named as a capability, never shown as a configurable panel. |
| WiFi bandwidth/usage control settings | CLAIMED | `smartx.ir/services/wifi/restaurant/`, `[search-synthesis]`, 2026-09-04, per `profiles/smartx.md` §"What it is" ("bandwidth/usage control"). No specifics on what a restaurant can actually set (speed caps, session length, blocked sites) were ever found. |
| Notification/SMS opt-out control the restaurant can set for its diners | UNKNOWN — not verified | See section G — never described in either direction, for the restaurant's ability to configure it or the diner's ability to invoke it. |
| Staff/manager companion app account provisioning | REAL (existence) | `myket.ir/app/com.smartx`, `[search-synthesis]`, 2026-09-04 — the app explicitly requires an existing SmartX account to log in, implying some restaurant-side account/staff-provisioning system exists, though its actual settings screens were never observed (the listing itself was never opened by any session, per `corpus/smartx/store-reviews.md`). |

---

## Summary table — evidence-tier distribution across this inventory

Counting every row in sections A–O above (45 total feature/configuration rows):

| Status | Count | Share |
|---|---|---|
| REAL / REAL (with qualifier) | 6 | 13% |
| CLAIMED | 19 | 42% |
| UNKNOWN — not verified | 18 | 40% |
| ABSENT | 2 | 4% |

**Read honestly:** the two `ABSENT` rows (diner-facing review/rating, photo upload) both derive from
one already-confirmed structural fact — SmartX has no diner-facing consumer surface at all — not
from two independent negative findings. The six `REAL` rows split between (a) the single strongest
piece of first-hand evidence in the whole corpus, the phone-capture pricing discount (`[fetched]`
2026-09-05), (b) the POS-reseller business relationship (corroborated from two companies' own
sites), and (c) three business-model-structural facts that follow necessarily from the published
pricing table rather than from a feature demo. **Zero of the 45 rows rest on an independently
observed, working demo of the product in action** — every `REAL`/`CLAIMED` distinction in this file
is a distinction between "SmartX's own marketing copy says so" (CLAIMED, or REAL when the copy
itself is what's being verified, e.g. a pricing figure) and "no one has ever checked" (UNKNOWN), not
between "verified working" and "marketing only" in the stronger sense the task brief's own
REAL/CLAIMED distinction implies for products where a live account/demo was reachable.

---

## What I did NOT verify

- **No SmartX page was opened or searched this session.** `WebFetch` returned `EGRESS_BLOCKED` for
  both the neutral control and the primary target (`smartx.ir/services/reserve/restaurant/`);
  `WebSearch` returned the identical session-wide budget-exhaustion message the three same-day
  sibling sessions already reported. This file adds zero new primary-source bytes.
- **The exact booking-flow step/screen/tap count** — never described by any source, in any session,
  at any evidence tier. This is the single most concrete unfilled request in the task brief's own
  checklist.
- **Whether SmartX's "table selection" is diner-facing floor-plan selection or staff-side
  assignment** — genuinely ambiguous in every source found; never resolved.
- **Whether the Customer Club waitlist is a true managed queue (diner-visible wait time/position) or
  a staff-side triage inbox** — the underlying Persian phrase was never captured verbatim by any
  session, only an English paraphrase of it.
- **Every loyalty sub-mechanic this task's checklist names by name** (earn rate, tier thresholds,
  expiry clock, redemption minimum, referral, streaks, birthday reward) — all UNKNOWN, none found by
  any session across four dated passes.
- **Accessibility** — not evaluated by any session, for any SmartX surface, ever. Flagged here as a
  clean, previously-unflagged gap rather than folded silently into a generic UNKNOWN.
- **Offline behaviour** — same: never evaluated by any session.
- **RTL layout correctness and font-hosting choice, as distinct from Persian-language content
  existing** — the former genuinely unverified; the latter effectively certain from the sheer volume
  of Persian product names and marketing copy across every source.
- **Whether any of the 19 `CLAIMED` rows above actually work as described in a live, functioning
  product** — no session has ever operated a live SmartX account, booking widget, WiFi captive
  portal, or Customer Club dashboard. Every `CLAIMED` status in this file means "SmartX's own
  marketing copy asserts this," not "marketing copy plus some independent corroboration that stops
  short of a full demo."

## Sources

**Tested this session (2026-09-07), both unavailable — full detail in Methodology above:**
- `WebFetch`: `https://example.com` (control, `EGRESS_BLOCKED`); `https://smartx.ir/services/reserve/restaurant/` (primary target, `EGRESS_BLOCKED`).
- `WebSearch`: `smartx.ir رزرو هوشمند رستوران مراحل رزرو انتخاب میز` (budget exhausted, 200/200);
  `smartx.ir services reserve restaurant booking table features` (same).

**Prior-session primary sources cited in this file** (not re-verified today; date and evidence tier
as originally recorded — see each linked corpus/profile file for full original citation detail):
- https://smartx.ir/pricing/ — `[fetched]` 2026-09-05
- https://smartx.ir/services/reserve/restaurant/ — `[search-synthesis]` 2026-09-04 (never independently `[fetched]` for its feature-description content, though its pricing figure was `[fetched]` 2026-09-05 per `corpus/smartx/business.md`'s Contradiction #1)
- https://smartx.ir/services/club/ and /services/club/restaurant/ — `[search-synthesis]` 2026-09-04
- https://smartx.ir/services/wifi/restaurant/ — `[search-synthesis]` 2026-09-04
- https://smartx.ir/services/evaluation/restaurant/ — `[search-synthesis]` 2026-09-04
- https://smartx.ir/other-expenses/ — `[search-synthesis]` 2026-09-04, never fetched by any session
- https://smartx.ir/faq/ — `[search-synthesis]` 2026-09-04, never fetched by any session
- https://smartx.ir/key-partners/ and https://sepidz.com/software/smart-x/ — `[search-synthesis]` 2026-09-04, cross-corroborated between two independent company sites
- https://myket.ir/app/com.smartx — `[search-synthesis]` 2026-09-04 (existence only), never opened directly by any session per `corpus/smartx/store-reviews.md`

**Internal repo documents read as prior art (not primary sources, listed for traceability):**
- `docs/audit/research/profiles/smartx.md`
- `docs/audit/research/corpus/smartx/business.md`
- `docs/audit/research/corpus/smartx/social.md`
- `docs/audit/research/corpus/smartx/store-reviews.md`
- `docs/audit/research/MATRIX.md` (all three capability tables + footnotes 2, 6, 14, 17, 18, 30, 33, 58)
- `docs/audit/research/WATCH.md`
- `docs/audit/research/PARITY-RISK.md`
- `docs/audit/research/ANTI-PATTERNS.md`
- `docs/audit/research/recon-notes-global.md`
- `docs/audit/research/STATUS-2026-09-07.md`
- `docs/audit/research/profiles/iran-reservation-longtail.md` (consulted only to confirm the RSEE
  cancellation-policy figures belong to a different company, not SmartX — see section E)
