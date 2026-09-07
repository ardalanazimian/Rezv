# SmartX — Users, Sales & Scale (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_
_Mode: USERS, SALES, SCALE (install bands per store, rating+review counts, MAU/registered users,
website traffic estimates, venue/restaurant counts, cities, funding rounds and investors, revenue or
GMV, acquisition prices, headcount, current job postings)_

## Prior art read first (per task instructions) — this file extends, does not repeat

Read in full before starting:

- `docs/audit/research/profiles/smartx.md` — base profile (2026-09-04, `WebSearch`-only pass) plus its
  2026-09-05 ADDENDUM (first-hand `WebFetch` reads of `smartx.ir/pricing/` and `smartx.ir/sorry/`).
- `docs/audit/research/corpus/smartx/store-reviews.md` — same-day (2026-09-07) sibling session, mode
  STORE REVIEWS AT VOLUME. Found both `WebFetch` and `WebSearch` completely unavailable; read 0 reviews.
- `docs/audit/research/corpus/smartx/social.md` — same-day (2026-09-07) sibling session, mode SOCIAL AND
  FORUMS. Also found both tools unavailable, corroborated with a direct `curl` to the egress-proxy status
  endpoint; read 0 posts/reviews.
- `docs/audit/research/WATCH.md` — SmartX entries (2026-09-04, 2026-09-05).
- `docs/audit/research/MATRIX.md` — SmartX cells and footnotes 6, 14, 18, 30, 33, 58.
- `docs/audit/research/STATUS-2026-09-07.md` — programme status; SmartX summarized there as "زنده، B2B
  ... به رستوران‌ها پول می‌دهد تا شماره‌تلفنِ مشتری جمع کنند" (live, B2B, pays restaurants to collect
  customer phone numbers) — consistent with, not new relative to, the profile.

**What those already establish, relevant to *this* mode (USERS/SALES/SCALE) specifically:**

- SmartX is B2B SaaS sold to restaurant/café owners exclusively through POS resellers (Sepidz, Sepidar
  Sistem, Vendo), described as a partner/subsidiary of the **Hamkaran Sistem** group per one search
  snippet the base profile explicitly flagged as unconfirmed beyond that single passage. Legal entity:
  شرکت نوآفرینان هوشمند آسیا ("Noafarinan-e-Hooshmand-e-Asia Co."). First market presence: 1394
  (2015/2016) per the company's own "about us" page.
- **Headcount (only figure ever found, any session):** Karboom company page — **10–50 employees**,
  classified **"دانش‌بنیان"** (a formal Iranian knowledge-based-company tax designation) — sourced via
  `WebSearch` synthesis, 2026-09-04. No LinkedIn employee count, no Jobinja/Jobvision-derived headcount,
  and no specific open-role titles were ever extracted by any prior session — those job-board URLs were
  cited only as general corporate-description sources, not mined for individual postings.
- **Pricing (the SALES-relevant core of this mode) is the single most solid, first-hand data point in
  the entire SmartX research line**, from the 2026-09-05 ADDENDUM's direct `WebFetch` of
  `smartx.ir/pricing/`: a full published Toman price list (ارزیابی هوشمند ۳۳,۶۵۰,۰۰۰ · باشگاه هوشمند
  ۵۱,۰۰۰,۰۰۰ · رزرو هوشمند ۵۲,۸۰۰,۰۰۰ · وای‌فای هوشمند ۲۱,۰۰۰,۰۰۰, all annual, plus bundles up to
  ۱۹۹,۲۵۰,۰۰۰), a parallel usage-based model (۲۹,۵۰۰,۰۰۰ activation + ۱۰,۰۰۰/transaction, with a **30%
  discount when 75%+ of invoices carry a customer phone number**), and a **self-contradiction**: the
  reservation product's own product page states ۲۱,۴۵۰,۰۰۰ تومان/year for the identical line the pricing
  page prices at ۵۲,۸۰۰,۰۰۰ — a 2.5× gap, both quoted, neither endorsed, in the source.
- **No MAU/registered-user figure, no venue/restaurant count, no city list, no funding round, no
  investor name, no revenue/GMV figure, no acquisition price, and no install/rating/review count for the
  Myket listing has ever been found by any session** (2026-09-04, 2026-09-05, or either 2026-09-07
  sibling pass) — all explicitly logged as open gaps in `profiles/smartx.md`'s "What I did NOT verify"
  and reconfirmed unresolved by `store-reviews.md`.
- **Contradiction check against prior research (required by task instructions):** none found. This
  session's own tool-availability findings (below) are consistent with, and extend by one more data
  point, the identical pattern both same-day sibling sessions already recorded.

---

## Methodology — both primary tools were unavailable this session (read before the findings)

**First action taken, per protocol:** `WebFetch` tested against `https://example.com` (neutral control),
then against the primary mode-specific target — the one confirmed SmartX app listing,
`https://myket.ir/app/com.smartx` — since install bands, rating, and review counts (this mode's USERS
metrics) live there.

| # | Call | Purpose | Result |
|---|---|---|---|
| 1 | `WebFetch https://example.com` | Neutral control | `EGRESS_BLOCKED` — `{"error_type":"EGRESS_BLOCKED","domain":"example.com","message":"Access to example.com is blocked by the network egress proxy."}` |
| 2 | `WebFetch https://myket.ir/app/com.smartx` | Primary USERS-mode target (install band, rating, review count, last-updated) | `EGRESS_BLOCKED` — `{"error_type":"EGRESS_BLOCKED","domain":"myket.ir","message":"Access to myket.ir is blocked by the network egress proxy."}` |
| 3 | `WebSearch` "اسمارت ایکس رستوران کارمند استخدام" (job-postings query) | SCALE-mode target (current openings) | Rejected: *"Web search was not performed: this session has used its web search budget (200 of 200 WebSearch calls)."* |
| 4 | `WebSearch` "smartx.ir similarweb traffic" (traffic-estimate query) | SCALE-mode target (independent traffic estimate) | Rejected: identical "200 of 200" budget-exhaustion message |

**Conclusion: `webfetch_worked = false` for this session.** The `example.com` control (row 1) confirms
this is a blanket network-egress policy affecting this session, not a `myket.ir`-specific or
Iran-domain-specific block. `WebSearch` was rejected on its very first call this session, before a
single result was ever returned, on the identical "200 of 200" ceiling both same-day sibling sessions
(`store-reviews.md`, `social.md`) already hit.

**Corroborating evidence — direct `curl` to the egress-proxy status endpoint** (not a `WebFetch` call;
run via Bash, per the environment's own troubleshooting instructions in `/root/.ccr/README.md`):

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"
```

```json
"recentRelayFailures": [
  {"ts": "2026-09-07T05:57:17.380Z", "kind": "connect_rejected",
   "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
   "host": "cafebazaar.ir:443"},
  {"ts": "2026-09-07T05:57:17.612Z", "kind": "connect_rejected",
   "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
   "host": "myket.ir:443"},
  {"ts": "2026-09-07T05:57:17.886Z", "kind": "connect_rejected",
   "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
   "host": "play.google.com:443"},
  {"ts": "2026-09-07T05:57:18.157Z", "kind": "connect_rejected",
   "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
   "host": "example.com:443"}
]
```

**This is worth flagging precisely, not glossing over:** these four failure entries — same hosts, same
millisecond-level timestamps (`05:57:17.380Z` through `05:57:18.157Z`) — are byte-for-byte identical to
the ones `corpus/smartx/social.md` recorded earlier the same day. That means this status endpoint is
returning a **shared/cached failure log from the underlying proxy infrastructure**, not a fresh
per-session probe, and this session did not independently generate new relay-failure timestamps of its
own (my own `WebFetch` calls above returned `EGRESS_BLOCKED` directly from the tool layer without adding
a new logged entry visible at this endpoint). The practical conclusion is the same either way: the block
is enforced at the network gateway (HTTP 403 to `CONNECT`), it predates and is independent of this
session's own actions, and it was already in effect before this task's first tool call.

**Net result: this session had zero working channel to the open web**, for both of the two primary
tools, tested against both a neutral control and mode-specific targets (an app-store listing for
USERS-mode metrics, a traffic-estimate query and a job-postings query for SCALE-mode metrics). Per the
audit constitution's rule that "we don't know" must never be reported as "confirmed zero in the world,"
this is reported as a **tooling-availability gap for this session** — the third consecutive dated
2026-09-07 SmartX session to report it — not as proof that no such data exists anywhere.

---

## Reviews / data points read this session: 0

Per the task's own rule ("0 is a valid answer" / "Never pad to hit a target"), this is reported plainly.
No Myket page, no job board, no Crunchbase/Tracxn page, no Similarweb/SEMrush/Ahrefs page, no LinkedIn
company page, and no press article was opened or read by this session. No install count, no rating, no
review count, no MAU figure, no venue count, no funding figure, no revenue figure, no headcount beyond
the already-on-record Karboom figure, and no job-posting title was obtained. `reviews_read = 0`.

## Findings by category

Each subsection states what is already on record (restated, with its own original date and source kept
explicit so this file does not silently imply fresher data than exists) versus what remains an open gap
this session could not close.

### Install bands per store (exact string as printed)

**UNKNOWN — not verified**, across all four SmartX research sessions to date (2026-09-04, 2026-09-05,
and both 2026-09-07 sibling passes). The Myket listing (`myket.ir/app/com.smartx`) is confirmed to
*exist* (2026-09-04, via `WebSearch` synthesis — never opened directly by any session), but its install
band was never surfaced by search and the page itself has never been fetched. No Cafe Bazaar listing
exists for the restaurant product (confirmed absent, 2026-09-04 — only an unrelated same-named
smartwatch app under "SMARTx"). No Google Play or iOS App Store listing has ever been found.

### Rating + review counts per store

**UNKNOWN — not verified.** Same reasoning as above — the one confirmed listing (Myket) has never been
opened by any session; no rating value or review count for it has ever surfaced in search results.

### MAU / registered users (company-claimed vs. independent)

**UNKNOWN — not verified.** No figure — company-claimed or independent — has been found by any session.
SmartX's own site does not appear to publish a user/customer count in any snippet any session has
surfaced (the closest adjacent claim, "customers" page existence at `smartx.ir/customers/`, was noted in
the base profile as a page whose actual brand list "could not be extracted" from search).

### Website traffic estimates (Similarweb / SEMrush / Ahrefs)

**UNKNOWN — not verified.** This session's `WebSearch` query aimed directly at this
("smartx.ir similarweb traffic") was rejected by the budget ceiling before any result could return (see
Methodology, row 4). No prior session attempted or recorded a traffic-estimate query at all — this is a
genuinely new gap this session tried and failed to close, not a repeat of an old one.

### Venue/restaurant counts, cities

**UNKNOWN — not verified.** The base profile notes `smartx.ir/customers/` exists as a page but its
brand-name list "was not extractable from search snippets" (2026-09-04). No count of restaurants/cafés
running SmartX, and no city list, has ever been obtained. The only structural inference on record (not a
count): SmartX is layered onto the existing POS install bases of Sepidz, Sepidar Sistem, and Vendo, so
its own footprint is bounded by — but not quantified against — those partners' client bases, none of
which has a published count in this research line either.

### Funding rounds and investors

**UNKNOWN — not verified.** No Crunchbase, Tracxn, or press mention of a SmartX funding round or named
investor has been found by any session. The only corporate-structure signal on record is the
**"دانش‌بنیان"** (knowledge-based-company) tax classification from Karboom (2026-09-04) and the
profile's own hedged note that one search snippet described SmartX as "از زیرمجموعه‌های شرکت همکاران
سیستم" (a subsidiary/affiliate of the Hamkaران Sistem group) — a claim the base profile explicitly did
**not** treat as independently confirmed beyond that single passage, and this session could not
re-verify or extend it (both tools unavailable). If Hamkaran Sistem — a large, established Iranian
enterprise-software conglomerate — is genuinely SmartX's parent, that would functionally substitute for
a "funding round" (internally financed by a larger group rather than externally raised), but this
remains **UNKNOWN, not confirmed**.

### Revenue or GMV

**UNKNOWN — not verified.** No filing, press estimate, or third-party figure exists in this research
line. The only quantitative proxy available is the published per-product annual pricing (SALES section
below), which bounds *unit price*, not volume — with no customer count to multiply against, no revenue
or GMV estimate can be derived, and this file does not attempt to fabricate one.

### Acquisition prices

**UNKNOWN — not verified.** No evidence surfaced, in this or any prior session, of SmartX itself having
been acquired, or of SmartX acquiring another company. It is consistently described as a reseller/
partner-distributed product (via Sepidz and, per the partners page, Sepidar Sistem and Vendo) rather
than a party to any disclosed M&A transaction.

### Headcount

**Restated from the base profile, not re-verified this session:** Karboom's SmartX company page records
**10–50 employees**, with the "دانش‌بنیان" designation — via `WebSearch` synthesis, 2026-09-04. No
session has ever obtained a LinkedIn employee count (this session's sibling, `social.md`, logged its own
`WebFetch` attempt against `ir.linkedin.com/company/smartxacc` earlier the same day as `EGRESS_BLOCKED`;
this session did not re-attempt it, since the tool-availability state had already been re-confirmed
identical by this session's own control test). 10–50 employees is consistent with, and does not
contradict, a small B2B SaaS vendor distributing through larger POS-reseller partners rather than
running its own direct sales/marketing org at scale.

### Current job postings (roles open — ML, growth, payments, as roadmap signal)

**UNKNOWN — not verified.** This is the one item in this mode's brief that no prior session attempted to
answer at all — the base profile cited `jobvision.ir/companies/35460/استخدام-اسمارت-ایکس` and
`jobinja.ir/companies/smartx/jobs` only as general corporate-description sources ("Company size...
10–50 employees"), never as a place individual open-role titles were extracted from. This session's
targeted attempt (`WebSearch` "اسمارت ایکس رستوران کارمند استخدام", Methodology row 3) was rejected by
the budget ceiling before any result returned. **No open role — ML, growth, payments, or otherwise —
has ever been identified for SmartX by any session.** This remains the single most actionable unresolved
item for a future session with working tools, since it is genuinely unattempted rather than merely
re-blocked.

### SALES — pricing (the one solid, first-hand data point; restated, not re-verified this session)

Carried forward from `profiles/smartx.md`'s 2026-09-05 ADDENDUM, itself a direct `WebFetch` read of
`smartx.ir/pricing/` (this session could not re-fetch it — both tools unavailable — so it is presented
here as **restated with its original 2026-09-05 date, not refreshed**):

| Line item | Amount (Toman/year unless noted) | Source | Date fetched |
|---|---|---|---|
| ارزیابی هوشمند (Smart Evaluation) | ۳۳,۶۵۰,۰۰۰ | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| باشگاه هوشمند (Customer Club) | ۵۱,۰۰۰,۰۰۰ | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| رزرو هوشمند (Smart Reservation), pricing-page figure | **۵۲,۸۰۰,۰۰۰** | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| وای‌فای هوشمند (Smart WiFi, 10 users) | ۲۱,۰۰۰,۰۰۰ | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| Top bundle — مدیریت هوشمند رستوران | ۱۹۹,۲۵۰,۰۰۰ (≈۵۴۶,۰۰۰ تومان/day equivalent) | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| Usage-based alternative | ۲۹,۵۰۰,۰۰۰ activation + ۱۰,۰۰۰/transaction, **30% off if ≥75% of invoices carry a customer phone number** | `smartx.ir/pricing/` | 2026-09-05 [fetched] |
| رزرو هوشمند (Smart Reservation), product-page figure — **contradicts the row above** | **۲۱,۴۵۰,۰۰۰** | `smartx.ir/services/reserve/restaurant/` | 2026-09-05 [fetched] |

Both reservation-price figures are directly quoted from first-hand-fetched SmartX pages, for the
identical named product, a 2.5× gap; neither is endorsed as "the" correct current price. This table adds
no new data this session — it is reproduced here because it is the mode's clearest SALES evidence and a
reader of this file should not have to cross-reference the base profile to find it.

## Complaint / praise themes — not applicable to this mode's own findings

**None can be reported with a sample size greater than zero for this mode.** USERS/SALES/SCALE is a
metrics-gathering mode, not a review-reading mode, and this session read zero reviews of any kind (see
above). The existing review-corpus finding — zero verbatim reviews across all SmartX sessions to date —
is documented in full in `corpus/smartx/store-reviews.md` and `corpus/smartx/social.md` and is not
reproduced here beyond this note, to avoid duplicating those files' own methodology sections.

### Top complaints
UNKNOWN — not verified. `reviews_read = 0` this session; not this mode's target artifact in any case.

### Top praises
UNKNOWN — not verified. Same reason as above.

## Contradiction check against existing research

None found. This session added no new data of any kind to confirm or contradict `profiles/smartx.md`,
`corpus/smartx/store-reviews.md`, or `corpus/smartx/social.md`. The one thing this session adds is
procedural: a third, independently-run confirmation that both primary tools remain unavailable for
SmartX research as of 2026-09-07, now tested specifically against USERS/SALES/SCALE-mode targets
(an app-store listing, a traffic-estimate query, a job-postings query) that neither sibling session had
targeted.

## Interpretation — five independent sessions, and this mode's numbers remain almost entirely open

Flagged as an honest inference, clearly separated from confirmed fact. Across five dated SmartX research
touchpoints now on record (2026-09-04 profile pass, 2026-09-05 first-hand-fetch addendum, and three
2026-09-07 passes — store-reviews, social, and this one), the **only** hard USERS/SALES/SCALE-adjacent
numbers ever obtained are: (a) 10–50 employees via Karboom (2026-09-04, search-synthesis, not
independently fetched), and (b) the first-hand-fetched pricing table above (2026-09-05). Every other
figure this mode's brief asks for — install bands, ratings, review counts, MAU, traffic estimates, venue
counts, cities, funding, investors, revenue, GMV, acquisition prices, and current job postings — remains
**UNKNOWN — not verified** across the entire research line to date, not merely unverified this session.
This is a materially thinner evidentiary base than the SALES (pricing) angle alone would suggest, and a
reader should not infer from the detailed pricing table above that the rest of this mode's brief was
similarly well-covered — it was not.

## What this means for the audit line

This mode's brief could not be executed beyond restating prior-session findings — both required tools
were unavailable, confirmed by 2 `WebFetch` attempts (1 control + 1 mode-specific target) and 2 rejected
`WebSearch` queries, plus a direct-`curl` corroboration outside the tool layer showing the block predates
this session. The single highest-value unresolved action for a future session, not attempted by any
prior pass, is a targeted job-postings sweep of `jobinja.ir/companies/smartx/jobs` and
`jobvision.ir/companies/35460/استخدام-اسمارت-ایکس` for individual open-role titles (ML/growth/payments
signal) — genuinely virgin territory in this research line, distinct from the "get `WebFetch` working
against Myket" priority already flagged by both sibling 2026-09-07 sessions for the USERS-mode install/
rating numbers.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (2 attempts, results in the Methodology table above):** example.com (control, `EGRESS_BLOCKED`),
myket.ir/app/com.smartx (`EGRESS_BLOCKED`).

**Direct curl (Bash, not WebFetch):** `curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code 0, raw
JSON output showing pre-existing `connect_rejected` / HTTP 403 failures for cafebazaar.ir, myket.ir,
play.google.com, and example.com — byte-identical to the entries `corpus/smartx/social.md` recorded
earlier the same day, indicating a shared/cached proxy failure log rather than a fresh per-session probe.

**WebSearch (2 queries, both rejected — session budget exhausted at 200/200 before any query returned a
result):** `اسمارت ایکس رستوران کارمند استخدام` (job-postings); `smartx.ir similarweb traffic`
(traffic-estimate).

## Sources (prior sessions, cited not re-verified this session)

- `docs/audit/research/profiles/smartx.md` — full base profile (2026-09-04, `WebSearch`-only) and its
  2026-09-05 ADDENDUM (first-hand `WebFetch` reads of `smartx.ir/pricing/` and
  `smartx.ir/services/reserve/restaurant/` and `smartx.ir/sorry/`). Original sources therein include:
  karboom.io company page (headcount/classification), jobvision.ir and jobinja.ir company listing pages
  (cited but not mined for individual postings), `smartx.ir/about-us/`, `smartx.ir/key-partners/`,
  `sepidz.com/software/smart-x/`.
- `docs/audit/research/corpus/smartx/store-reviews.md` — same-day (2026-09-07) sibling session, mode
  STORE REVIEWS AT VOLUME, also found both tools unavailable, 0 reviews read.
- `docs/audit/research/corpus/smartx/social.md` — same-day (2026-09-07) sibling session, mode SOCIAL AND
  FORUMS, also found both tools unavailable (plus the same egress-proxy `curl` corroboration reused
  above), 0 posts/reviews read.
- `docs/audit/research/WATCH.md` — SmartX entries (2026-09-04, 2026-09-05).
- `docs/audit/research/MATRIX.md` — SmartX cells and footnotes 6, 14, 18, 30, 33, 58.
- `docs/audit/research/STATUS-2026-09-07.md` — programme status summary, SmartX row.

## What I did NOT verify

- **Install band, rating, and review count for the Myket listing** (`myket.ir/app/com.smartx`) — the
  listing's existence is confirmed (2026-09-04) but its contents have never been read by any session
  across five dated touchpoints.
- **Any MAU, registered-user, venue count, or city list** — company-claimed or independent — no figure
  of any kind exists in this research line.
- **Website traffic estimates** (Similarweb/SEMrush/Ahrefs) — never attempted before this session; this
  session's one targeted query was rejected before returning a result.
- **Funding rounds, named investors, revenue, GMV, or acquisition prices** — none found; the only
  adjacent signal is the unconfirmed-beyond-one-snippet Hamkaran Sistem affiliation claim already
  flagged as unresolved in the base profile.
- **LinkedIn-derived headcount** — never obtained; only the Karboom-sourced 10–50 employee figure exists,
  itself search-synthesis, not independently fetched.
- **Any specific current job posting / open role title** — genuinely unattempted by any prior session;
  this session's one targeted attempt was rejected before returning a result. This is the clearest,
  most specific open action item this file adds to the research line.
- **Whether the Hamkaran Sistem parent-company claim is accurate** — carried forward as unresolved from
  the base profile; this session had no tool access to investigate it further.
