# RSEE (آرسی) — Business Model, Pricing, Terms (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: RSEE / آرسی (`rsee.ir`), key `rsee`, tier `iran`_
_Mode: BUSINESS MODEL, PRICING, TERMS_

## Prior art read first (per task instructions)

Read in full before writing anything below:
- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
  dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` pass against `rsee.ir`
  directly) — the sole first-hand source for every RSEE pricing/terms fact that exists anywhere in
  this research programme.
- `docs/audit/research/corpus/rsee/store-reviews.md` (2026-09-07, written earlier the same day by a
  concurrent Scout session) — confirms `reviews_read = 0` for RSEE across every session to date, and
  that both `WebFetch` and `WebSearch` were unavailable to that session.
- `docs/audit/research/WATCH.md` (2026-09-05 entry), `docs/audit/research/MATRIX.md` (footnote 56 +
  the capability-table cells it feeds), `docs/audit/research/PARITY-RISK.md` (§1, ranked #1),
  `docs/audit/research/ANTI-PATTERNS.md` (§3), `docs/audit/research/proposals/006-disclosure-coupled-to-money-capture.md`,
  `docs/audit/research/STATUS-2026-09-07.md` (Persian status digest, written 05:41 today, before this
  session) — all contain RSEE pricing/terms material scattered across files; this corpus consolidates
  it under the pricing/terms mode specifically and adds nothing that contradicts any of them.

**This file extends, not repeats, that prior art.** No contradiction with prior research was found —
there is only one primary source (`rsee.ir`, fetched once, 2026-09-05) for every RSEE business-model
fact on record, so there is nothing yet to cross-check it against except itself. **No contradiction
was found within RSEE's own pages either** — unlike SmartX (whose reservation-product price differs
2.5× between two of its own pages), RSEE's pricing table appears exactly once in the corpus, so there
is no second RSEE-authored figure to disagree with it. This absence-of-contradiction is itself weak:
it reflects a single fetch, not cross-verification.

## Methodology — this session's own tool tests (do this before trusting anything below)

**First action, per protocol:** `WebFetch` tested against a neutral control and then the primary
target for this mode.

| # | Tool | Target | Purpose | Result |
|---|---|---|---|---|
| 1 | `WebFetch` | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `WebFetch` | `https://rsee.ir` | Primary target for this mode (pricing/nav/ToS surface) | `EGRESS_BLOCKED` |
| 3 | `WebSearch` | `rsee.ir آرسی رزرو میز نظرات` | Fallback (also served as ToS/terms probe) | Rejected: *"this session has used its web search budget (200 of 200 WebSearch calls)"* |

To rule out a domain-specific block versus a session-wide policy condition, the environment's own
documented diagnostic was run next:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status" -o proxy-status.json ; echo "EXIT:$?"
EXIT:0
```

Relevant excerpt, `recentRelayFailures` (all timestamped `2026-09-07T05:57:17–18Z`, all
`kind: "connect_rejected"`, all `detail: "gateway answered 403 to CONNECT (policy denial or upstream
failure)"`): `cafebazaar.ir:443`, `myket.ir:443`, `play.google.com:443`, `example.com:443`.
`rsee.ir` itself is not among the four most-recent entries in that capped log, but the `WebFetch`
tool's own direct response for `https://rsee.ir` was the identical `EGRESS_BLOCKED` error, so the
practical result is the same regardless of which log entry is shown.

**Conclusion: `webfetch_worked = false` for this session.** This matches the pattern independently
recorded the same day by the concurrent `corpus/rsee/store-reviews.md` session (which additionally
logged the same 403-at-CONNECT proxy state) and by `corpus/smartx/business.md` (also written today):
a shared, session-wide egress condition, not specific to RSEE or to this particular task.

**What this means for this file, honestly:** every pricing figure and quote below labeled `[fetched]`
was read directly from `rsee.ir` by a **prior** Scout session, dated 2026-09-05 — not by this
session. I am citing that session's first-hand evidence accurately, with its own date, not
re-presenting it as something I verified today. Everything labeled `[search]` was obtained by
`WebSearch` synthesis in that same 2026-09-05 pass (not by a direct fetch of a rules/terms page,
which 404'd) and remains at that weaker evidence tier. This session's own contribution is: (a)
confirming the tooling gap persists on 2026-09-07 for RSEE specifically, (b) consolidating every
pricing/terms fact already on file into one mode-specific corpus organized against the task's own
checklist, and (c) naming precisely what a future session with working tools still needs to close —
above all, the diner-side package price list, which **no session has ever found**, and the mandatory-
vs-optional question, which `STATUS-2026-09-07.md` (written before this session, same day) still
lists as the #2 open priority action for this competitor.

## Reviews read this session: 0

No user review discussing RSEE's pricing, packages, refunds, or cancellation fees was read this
session — none has ever been read for RSEE in any Scout session to date
(`corpus/rsee/store-reviews.md` confirms 0/0, and no app-store listing for RSEE has ever been located
by any session — see that file's §"Store facts"). This corpus therefore contains **zero**
diner-authored or restaurant-owner-authored complaint/praise quotes about money. Every figure below
is company-published (a single fetch of `rsee.ir`'s own pages), not user-reported.

---

## 1. Plans / tiers / add-ons — exact figures, currency explicit

### Restaurant-side (B2B) plans — the only RSEE prices ever actually seen

Source: [rsee.ir](https://rsee.ir/), fetched directly 2026-09-05 `[fetched]`.

| Plan | Price | Term |
|---|---|---|
| پلن ۱ — پایه (Basic) | **رایگان** (free) | ۴ ماه (4 months) |
| پلن ۲ — حرفه‌ای (Professional) | **۹۹۰,۰۰۰ تومان** | ۱۲ ماهه (12 months) — RSEE's own on-page math states this as ≈۸۲,۵۰۰ تومان/month |
| پلن ۳ — کامل (Complete) | **۲,۹۹۰,۰۰۰ تومان** *or* **۳,۹۹۰,۰۰۰ تومان** | ۶ ماه *or* ۱۲ ماه respectively (two duration options at two prices, both published on the same plan) |

Currency is **Toman (تومان)** throughout — no Rial figure and no currency ambiguity found anywhere in
the RSEE material gathered to date.

**What add-ons, if any, exist per tier is UNKNOWN — not verified.** No feature-comparison matrix
across the three plans (e.g., what Plan 3 unlocks over Plan 2 beyond price/duration) was captured by
the 2026-09-05 fetch or by any session since; the pricing table as recorded is prices and durations
only, not a feature breakdown.

### Diner-side (B2C) package prices — the single largest gap in this file

**No Toman price for a diner "آرسی" (chair-credit) package has ever been found by any Scout session.**
The mechanic is confirmed to exist — the diner buys a package priced in chair-units before booking —
but **what that package costs in Toman, whether there are multiple package sizes, and whether price
scales with number of chairs/seats or venue tier, is UNKNOWN — not verified.** This is a direct,
unresolved gap in the pricing-mode checklist this task was assigned to close, and it was not closed
this session because both fetch and search tools were unavailable. It should be the top target for
the next session with working tools (try `rsee.ir` pages beyond the root — the 2026-09-05 pass never
located a `/packages`-style page; `/plans` itself 404'd, which is confusing given that "plans" is also
the English gloss for the restaurant-side پلن table above — these may be different pages under
different paths, or the restaurant "پلن" table may be the only "plans" page that exists and a
separate diner-package price list may sit elsewhere entirely unfound).

---

## 2. Commission % and who pays it

**No per-booking or per-transaction commission percentage has ever been found for RSEE, and — more
importantly for this mode — it remains UNKNOWN whether the diner's chair-credit purchase is even
RSEE's revenue at all, versus a prepayment RSEE collects and remits to the restaurant (functioning
more like a deposit-holding/escrow layer than a commission).** No page found by any session states who
receives the money from a package purchase: RSEE itself, the restaurant directly, or some split
between them. This is a materially different open question from "what % commission does RSEE take" —
it is "does RSEE even take a cut of the diner-side flow, structurally, or is its entire monetization
the three restaurant subscription tiers in §1 with the chair-credit system serving only as a
no-show-deterrent mechanic that benefits the restaurant." **Both readings are consistent with every
verbatim quote on file; neither is confirmed.** Flagged as the second-most-important open question in
this corpus, after the diner package price itself.

## 3. Per-cover / per-booking fees

**The chair-credit ("آرسی") mechanic is structurally a per-seat fee, denominated in a proprietary unit
rather than currency.** Verbatim, `[fetched]` 2026-09-05:

> **"جهت انجام رزرو میز کافه/رستوران، کاربر می تواند اقدام به خرید بسته نماید"**
> ("To make a cafe/restaurant table reservation, the user can proceed to buy a package")

> **"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی معادل یک صندلی از یک میز می باشد"**
> ("Each reservation package contains a number of ARSEEs, and each ARSEE equals one chair from a
> table")

Booking a four-top deducts four ARSEE from the diner's purchased balance. **This is, functionally, a
per-cover fee paid by the diner at time of booking — but its Toman-per-chair conversion rate is
exactly the unresolved gap named in §1.** Without that rate, it is impossible to state whether this is
a token nominal charge or a substantial one relative to a typical bill.

**No fee of any kind charged to the restaurant per cover or per booking (as distinct from the flat
annual subscription in §1) has been found.** UNKNOWN whether one exists — not found, not ruled out.

## 4. Contract length, auto-renewal, exclusivity

- **Contract length (restaurant side):** Plan 1 is a **4-month** free period; Plan 2 is **12 months**;
  Plan 3 offers **6 months or 12 months** at two different prices. All three durations came from the
  same `[fetched]` pass. **What happens at the end of Plan 1's 4 free months — auto-conversion to a
  paid plan, a renewal prompt, or service cutoff — is UNKNOWN — not verified.** No page describing
  this transition was found.
- **Auto-renewal clause:** **never found.** No `rsee.ir` page reached by any session states whether
  Plan 2 or Plan 3 auto-renews at term end or requires active repurchase. This is a genuine gap, not
  an absence-confirmed-by-search — the pages most likely to state it (`/rules`, `/faq`, `/plans`) all
  returned **HTTP 404** on direct fetch, 2026-09-05 `[fetched — negative result]`.
- **Exclusivity clause:** **never found in either direction.** No statement that a restaurant using
  RSEE must be RSEE-exclusive, and no statement that it explicitly may multi-home, has ever surfaced.
  `MATRIX.md`'s "No exclusivity/lock-in clause" row records RSEE's cell as `UNKNOWN — ToS not reached
  (/rules 404)`, which this session found no basis to update.
- **Diner-side "contract":** there is no subscription concept on the diner side documented anywhere —
  the diner relationship is purchase-a-package / spend-the-credit, with no term, renewal, or lock-in
  language found at all. UNKNOWN whether unused chair-credit balances expire (see §6).

## 5. Diner-side money: deposits, no-show/cancellation fees, when shown

**This is RSEE's single most important, and most concerning, documented business-model fact — already
flagged in three other files (`WATCH.md`, `ANTI-PATTERNS.md` §3, `proposals/006`) as the worst
money-respect finding in this entire research programme, worse than OpenTable's $25–50/person or
Resy's up-to-$100/person no-show fees.** Those fees attach to a no-show — an event where the
restaurant lost real capacity. RSEE's chair-credit is spent, and partially forfeitable, on the act of
*booking itself*, before any food is ordered and before (as far as any page found states) the
restaurant has necessarily confirmed the reservation.

- **The charge is shown before the booking is made** (a package must be purchased/held before a table
  can be reserved) — in that narrow sense the charge is *not* hidden at the point of booking, which
  distinguishes it from TheFork's or Fidilio's "surprise charge at cancellation" complaint pattern
  documented elsewhere in this research programme. But the charge is a **precondition of using the
  product at all**, not a fee disclosed and accepted for one specific reservation's terms — a
  structurally different and, per the Gen-Z lens already applied in
  `profiles/iran-reservation-longtail.md`, arguably worse pattern: "free to look, pay to book" rather
  than "free to book, fee only if you no-show."
- **No explicit deposit-vs-no-show-fee distinction exists in RSEE's model** — there is one mechanic
  (chair-credit spend + partial forfeiture on late cancellation), not two separate diner charges.
- **Whether purchasing a package is mandatory for every booking remains UNKNOWN.** The verbatim uses
  *«می تواند»* — **can**, not **must**. No sentence stating package purchase is mandatory for every
  booking was ever found, and none stating a free/no-package booking path exists either. This is
  listed as **open priority #2** in `docs/audit/research/STATUS-2026-09-07.md` (written earlier the
  same day as this session, before it started) and remains unresolved after this session because
  neither `WebFetch` nor `WebSearch` was available to pursue it.

## 6. Refund windows

**Sourced via `[search]` only — never independently fetched from a rules/terms page. This is the
single most important evidence-tier flag in this file for the pricing/terms mode specifically**, since
exact refund-window wording is exactly the kind of claim that should not be trusted at search-synthesis
tier without a verbatim source check:

| Cancellation timing | Refund | Evidence tier |
|---|---|---|
| More than 3 hours before the reserved slot | **100%** returned to the user's account | `[search]`, 2026-09-05 — not fetched |
| Between 3 hours and the start of the slot | **50%** returned | `[search]`, 2026-09-05 — not fetched |
| At or after the slot (no cancellation, or too late) | **0%** — nothing returned | `[search]`, 2026-09-05 — not fetched |

`rsee.ir/rules` — the page that would be expected to state this authoritatively — returned **HTTP
404** on direct fetch, 2026-09-05 `[fetched — negative result]`. So the specific percentages (100/50/0)
and the specific time boundaries (3 hours) rest entirely on `WebSearch`'s indexed-snippet synthesis of
some other RSEE page or a third-party description, not on primary-source text this research programme
has read with its own eyes. **The existence of forfeiture on late cancellation is corroborated by the
chair-credit mechanic itself being real** (§3, `[fetched]`), but **the exact percentages and exact time
boundaries carry only search-tier confidence** and should be re-verified before being cited as precise
figures in any external-facing document (e.g. a pitch deck comparison table).

**Refund destination:** "returned to the user's account" implies credit-back into the same chair-credit
balance (an in-platform currency refund), not necessarily a cash/bank refund. This distinction was
never explicitly confirmed either way — UNKNOWN whether a diner can ever cash out unused or refunded
ARSEE credit, or whether it is permanently locked into future RSEE bookings only.

## 7. Loyalty redemption minimums

**No loyalty/points/rewards program of any kind has ever been found for RSEE**, in any session. This
contrasts directly with SmartX (whose Customer Club is a sold product, even though its own redemption
mechanics are also undocumented — see `corpus/smartx/business.md` §7) and with TheFork (whose YUMS
program has fully published, precise redemption thresholds — `profiles/thefork.md`). RSEE's only
documented value-exchange mechanic is the chair-credit purchase-and-spend system itself (§3), which is
a payment/access mechanic, not a loyalty/rewards mechanic — there is no evidence diners earn anything
back for repeat use. **UNKNOWN — not verified**, leaning toward **ABSENT** (a targeted loyalty search
would be needed to confirm this is a genuine absence rather than an unfound page; not yet performed).

## 8. Coupon / discount funding — platform vs. restaurant

**Never found. UNKNOWN.** No page describing a coupon, promo-code, or discount mechanic of any kind —
whether funded by RSEE or by the individual restaurant — has been located for RSEE by any session.
This is a clean, unqualified gap: there is not even a structural inference to make here (contrast
§8 of `corpus/smartx/business.md`, where the B2B product category itself supports an inference about
who funds Customer Club coupons). RSEE's marketing surface as fetched (2026-09-05) covers what the
product is, the three restaurant plans, and the chair-credit mechanic — nothing about promotional
pricing was captured or, apparently, present on the pages reached.

## 9. Changelogs / release notes

**Never found. UNKNOWN.** No `rsee.ir/changelog`, `/news`, `/blog`, `/updates`, or equivalent path has
ever appeared in any fetch or search result for RSEE. Unlike SmartX (which at least has a
retention/incident page, `/sorry/`, functioning as an informal changelog-adjacent signal — see
`corpus/smartx/business.md` §9), **RSEE has no dated, first-party page of any kind documenting product
changes, incidents, or updates that any session has located.** This means there is also no dated
signal — positive or negative — about RSEE's operational reliability track record, in contrast to
SmartX's self-admitted Mordad 1404 (≈ Jul–Aug 2025) Customer Club disruption. Whether this reflects a
genuinely clean reliability record, a product too young/small to have generated one, or simply an
unfound page, is UNKNOWN.

## 10. Terms-of-service pages

**Confirmed unreachable, not merely unfound.** Three specific paths were tried by direct fetch on
2026-09-05 and **all three returned HTTP 404** `[fetched — negative result]`:

| Path tried | Result |
|---|---|
| `rsee.ir/plans` | HTTP 404 |
| `rsee.ir/rules` | HTTP 404 |
| `rsee.ir/faq` | HTTP 404 |

No `/terms`, `/privacy`, `/agreement`, or equivalently-named path has ever been tried or found. This
is the most actionable concrete gap in this corpus for a future session: the three paths above are
now *known-404*, so they do not need re-trying, but the obvious next guesses (`/terms-of-service`,
`/privacy-policy`, `/about`, `/contact`, `/refund-policy`, Persian-slug variants like
`/قوانین` or `/شرایط-استفاده`) have never been attempted with a working fetch tool.

**Practical consequence:** every diner-facing money term in this file (§5, §6) rests on the homepage
copy and one `[search]`-tier paraphrase, not on an actual terms/rules document — because that document,
if it exists at all under a URL RSEE actually serves, has never been located.

---

## Consolidated pricing/terms table (all evidence tiers shown together)

| Item | Value | Evidence tier | Source, date |
|---|---|---|---|
| Currency | Toman (تومان) throughout, no Rial figure found | `[fetched]` | rsee.ir, 2026-09-05 |
| Restaurant Plan 1 (Basic) | رایگان (free), 4 months | `[fetched]` | rsee.ir, 2026-09-05 |
| Restaurant Plan 2 (Professional) | ۹۹۰,۰۰۰ تومان / 12 months | `[fetched]` | rsee.ir, 2026-09-05 |
| Restaurant Plan 3 (Complete) | ۲,۹۹۰,۰۰۰ تومان/6mo **or** ۳,۹۹۰,۰۰۰ تومان/12mo | `[fetched]` | rsee.ir, 2026-09-05 |
| Diner chair-credit ("آرسی") package price | **Never found by any session** | absence, all sessions | — |
| Commission % | Never found; unclear whether diner package $ even flows to RSEE vs. the restaurant | UNKNOWN (structural ambiguity, not just an unfound number) | — |
| Per-cover fee (diner) | Chair-credit spend is structurally per-seat, but rate in Toman/chair is unknown | `[fetched]` mechanic / unknown rate | rsee.ir, 2026-09-05 |
| Per-cover fee (restaurant) | None found beyond the flat plan price | absence, all sessions | — |
| Contract length | 4mo (free) / 12mo / 6mo-or-12mo across the three plans | `[fetched]` | rsee.ir, 2026-09-05 |
| Auto-renewal clause | Never found | UNKNOWN | — |
| Exclusivity clause | Never found in either direction | UNKNOWN | — |
| Package purchase mandatory for every booking? | Verbatim says *«می تواند»* (can); no mandatory or optional-alternative statement ever found | `[fetched]` (the ambiguous verbatim itself) | rsee.ir, 2026-09-05 |
| Cancellation refund: >3h before | 100% returned | `[search]`, never fetched | 2026-09-05 |
| Cancellation refund: 3h-to-slot | 50% returned | `[search]`, never fetched | 2026-09-05 |
| Cancellation refund: at/after slot | 0% | `[search]`, never fetched | 2026-09-05 |
| Refund destination (cash vs. in-platform credit) | Never clarified | UNKNOWN | — |
| Loyalty redemption minimum | No loyalty program found at all | absence, all sessions (ABSENT-leaning) | — |
| Coupon/discount funding | Never found | UNKNOWN | — |
| Changelog/release-notes page | Never found | UNKNOWN | — |
| `/plans`, `/rules`, `/faq` | All HTTP 404 | `[fetched — negative result]` | rsee.ir, 2026-09-05 |
| Any other ToS/privacy/refund-policy page | Never located under any path tried | UNKNOWN | — |
| Claimed venue count | «۲۰۰۰+» | `[fetched]`, company-claimed, unaudited | rsee.ir, 2026-09-05 |

---

## Complaints / praises about money — status

### Top complaints (business-model/pricing specific)
`UNKNOWN — not verified.` `reviews_read = 0` for this session and for every prior RSEE session
(`corpus/rsee/store-reviews.md` confirms 0/0, and confirms no app-store listing for RSEE has ever been
located by any session, ruling out even the starting point for a review pull). No user-authored
complaint about RSEE's chair-credit pricing, cancellation forfeiture, refunds, or restaurant-side
billing exists anywhere in this research line — not "none found after searching," but "no review of
any kind has ever been read for this competitor." Sample size: 0.

**Distinct from a review-derived complaint, and not presented as one:** the structural/textual finding
already recorded in `profiles/iran-reservation-longtail.md` §"Gen-Z lens on RSEE" and repeated in
`ANTI-PATTERNS.md` §3 — that RSEE's diner-pays-to-book-then-forfeits-on-cancel model is, on the text of
RSEE's own site, the single most diner-hostile money mechanic found in this entire research programme.
That is an analysis of RSEE's own published terms, not a user complaint, and this file does not
relabel it as one.

### Top praises (business-model/pricing specific)
`UNKNOWN — not verified.` Same reason. Sample size: 0. The one positive, verified fact in this
corpus — that RSEE's restaurant-side pricing is published with no sales-call gate (§1, `[fetched]`) —
is a structural observation from the pricing page itself, not a user-authored praise, and is not
presented as a review finding.

---

## What I did NOT verify (this session)

- **No RSEE page was opened or searched this session.** `WebFetch` returned `EGRESS_BLOCKED` for both
  the neutral control and `https://rsee.ir`; `WebSearch` returned a session-wide 200/200
  budget-exhaustion notice on the one query attempted. Everything in this file is therefore a prior
  session's evidence, accurately re-dated and re-cited at its original tier, not something re-verified
  today.
- **The diner-side chair-credit package price, in Toman, was not found** — by this session or any
  prior one. This is the single largest unresolved gap in RSEE's business model and the top target for
  the next session with working tools.
- **Whether package purchase is mandatory for every diner booking was not resolved** — remains at
  `«می تواند»` (can), open priority #2 per `STATUS-2026-09-07.md`, unchanged by this session.
- **The 100%/50%/0% cancellation-refund figures remain at `[search]` tier**, never independently
  fetched from a rules/terms page (which 404's under the one path tried). Treat as directionally
  correct, not verbatim-confirmed.
- **Who receives the diner's package payment — RSEE or the restaurant — was not found.** This affects
  whether RSEE has any commission-style revenue at all versus being purely a B2B SaaS-plus-escrow
  layer; genuinely unresolved, not merely unsearched this session.
- **No terms-of-service, privacy-policy, or refund-policy page was located** under any path — `/plans`,
  `/rules`, `/faq` are confirmed-404, but no broader path sweep (`/terms`, `/privacy`,
  `/refund-policy`, Persian-slug variants) has ever been attempted with a working fetch tool.
- **No loyalty/coupon/discount-funding mechanic was found** — flagged as likely absent, not confirmed
  absent.
- **No changelog, release-notes, or incident/apology page (RSEE's equivalent of SmartX's `/sorry/`)
  was found** — genuinely unknown whether one exists.
- **What Plan 3's two duration options (6mo vs 12mo) buy differently, and what happens after Plan 1's
  free 4 months end**, were not found.
- **No review, of any kind, from a diner or restaurant owner, discussing money**, has ever been read
  for RSEE — `reviews_read = 0`, consistent with `corpus/rsee/store-reviews.md`'s independent
  confirmation the same day.

## Sources

**Tested this session (2026-09-07), all unavailable:**
- `WebFetch`: `https://example.com` (control, `EGRESS_BLOCKED`); `https://rsee.ir` (primary target,
  `EGRESS_BLOCKED`).
- `WebSearch`: `rsee.ir آرسی رزرو میز نظرات` (rejected — session-wide budget exhausted, 200/200).
- Proxy diagnostic: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code `0` — confirmed
  `connect_rejected` / "gateway answered 403 to CONNECT" for `cafebazaar.ir:443`, `myket.ir:443`,
  `play.google.com:443`, `example.com:443`, all timestamped `2026-09-07T05:57:17–18Z`.

**Cited from prior sessions, not re-verified this session (full original citation trail lives in
these files):**
- [rsee.ir](https://rsee.ir/) — root page, `[fetched]` 2026-09-05 by a prior Scout session. Source for
  every restaurant-plan price, the chair-credit verbatim quotes, and the «۲۰۰۰+» venue claim.
- `rsee.ir/plans`, `rsee.ir/rules`, `rsee.ir/faq` — all `[fetched — negative result, HTTP 404]`,
  2026-09-05.
- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE" — full first-hand write-up,
  including the cancellation-refund percentages sourced via `[search]`.
- `docs/audit/research/WATCH.md` (2026-09-05 entry) — corroborating restatement, same source trail.
- `docs/audit/research/MATRIX.md` footnote 56 and its associated capability-table cells.
- `docs/audit/research/ANTI-PATTERNS.md` §3 — the diner-pays-to-book anti-pattern write-up.
- `docs/audit/research/proposals/006-disclosure-coupled-to-money-capture.md` — cites RSEE as the
  closest-to-home comparator for a Rezervno proposal on money-disclosure sequencing.
- `docs/audit/research/PARITY-RISK.md` §1 — RSEE's published pricing ranked as a market-norm finding.
- `docs/audit/research/STATUS-2026-09-07.md` — same-day status digest (written before this session)
  listing "resolve whether RSEE's package purchase is mandatory" as open priority #2.
- `docs/audit/research/corpus/rsee/store-reviews.md` — same-day sibling corpus file, confirming
  `reviews_read = 0` and independently confirming the same tooling blockage this session also hit.
