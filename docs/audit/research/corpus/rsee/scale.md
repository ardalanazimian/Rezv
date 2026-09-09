# RSEE (آرسی) — Users, Sales & Scale (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: RSEE / آرسی (`rsee.ir`), key `rsee`, tier `iran`_
_Mode: USERS, SALES, SCALE (install bands per store, rating+review counts, MAU/registered users
company-claimed vs independent, website traffic estimates — Similarweb/SEMrush/Ahrefs, venue/
restaurant counts, cities, funding rounds and investors — Crunchbase/Tracxn/press, revenue or
GMV, acquisition prices, headcount — LinkedIn/job boards, and CURRENT job postings as a roadmap
signal)_

## Prior art read first (per task instruction) — this file extends, does not repeat

Read in full before starting:

- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
  dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` pass against
  `rsee.ir` directly — the only session in this programme that ever reached RSEE's own site).
  Establishes: RSEE is the only live, dedicated, consumer-facing table-reservation product found
  in the Iranian long-tail sweep; the diner-side chair-credit ("آرسی" = 1 seat) prepay-to-book
  mechanic with 50–100% forfeiture on late cancellation (cancellation terms sourced `[search]`,
  not fetched — `/rules` 404'd); restaurant-side pricing published with no sales call (پلن ۱
  رایگان ۴ماهه، پلن ۲ ۹۹۰,۰۰۰ تومان/۱۲ماهه، پلن ۳ ۲,۹۹۰,۰۰۰ تومان/۶ماهه یا ۳,۹۹۰,۰۰۰ تومان/۱۲ماهه);
  claims **"۲۰۰۰+"** partner venues — company-claimed, unaudited, no independent corroboration
  found; `/plans`, `/rules`, `/faq` all HTTP 404 `[fetched — negative result]` on 2026-09-05.
- `docs/audit/research/MATRIX.md` footnote 56 and rows "Product currently live and maintained"
  (RSEE: *"REAL — site live, '۲۰۰۰+' venues claimed"*) and "Independent, third-party-reviewable
  footprint" (RSEE: **ABSENT** — *"no app-store listing located and no independent review corpus
  of any kind found for the only live Iranian competitor. The biggest gap in batch 3."*). The
  loyalty row also records **RSEE has no loyalty column at all** — no points/tier/badge mechanic
  found.
- `docs/audit/research/corpus/rsee/store-reviews.md` (2026-09-07, earlier the same day). That
  session tested `WebFetch` on `https://example.com` (control) and `https://rsee.ir` (primary
  target) — **both `EGRESS_BLOCKED`** — then hit an exhausted `WebSearch` budget ("200 of 200")
  on its first two queries. **Reviews read: 0.** It names RSEE's empty independent-review corpus
  as the single biggest gap in the whole research programme for this competitor.
- `docs/audit/research/corpus/rsee/social.md` (2026-09-07, same day, later than store-reviews.md).
  Same dual-tool outage pattern, confirmed via four separate `WebFetch` targets (control +
  `rsee.ir` + two guessed handles) all `EGRESS_BLOCKED`, and `WebSearch` again exhausted on two
  queries. **Posts read: 0.** Concludes that RSEE — the single most important Iran-tier
  competitor in this programme — now has "a completely empty independent-evidence corpus across
  every mode attempted so far," and flags this as a first-class finding for the founder, not a
  footnote.
- `docs/audit/research/WATCH.md` 2026-09-05 RSEE entry — same pricing/mechanic facts, no
  users/sales/scale data logged there either.

**This session's assignment (USERS, SALES, SCALE) targets an entirely different evidence class
than the two prior 2026-09-07 sessions** — install bands, MAU, traffic estimates, funding,
revenue, headcount, and job postings, none of which store-reviews.md or social.md attempted to
reach (they targeted app stores and social/forum platforms respectively). This session tested the
SCALE-specific sources directly rather than assuming the prior sessions' outage would generalize.
It did not succeed either, for the same root cause — see Methodology.

## Methodology — WebFetch and WebSearch both tested and confirmed unavailable, on SCALE-specific targets this time

**First action taken, per protocol:** `WebFetch` against the neutral control, then against the
primary target (`rsee.ir` itself), then against four SCALE-mode-specific targets not tested by
either prior 2026-09-07 session (Crunchbase, LinkedIn, SimilarWeb).

| # | URL tested | Purpose (this mode) | Result |
|---|---|---|---|
| 1 | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `https://rsee.ir` | Primary target (RSEE's own site — venues/plans/claims) | `EGRESS_BLOCKED` |
| 3 | `https://www.crunchbase.com/organization/rsee` | Funding rounds, investors | `EGRESS_BLOCKED` |
| 4 | `https://www.linkedin.com/company/rsee` | Headcount, current job postings | `EGRESS_BLOCKED` |
| 5 | `https://www.similarweb.com/website/rsee.ir/` | Website traffic estimate | `EGRESS_BLOCKED` |

All five calls returned the structured `error_type: "EGRESS_BLOCKED"` directly from the tool
("Access to `<domain>` is blocked by the network egress proxy"). The `example.com` control
failing identically to `rsee.ir` and to three completely different SCALE-specific domains
(Crunchbase, LinkedIn, SimilarWeb — none of which overlap with store-reviews.md's or social.md's
tested domains) rules out both a per-domain block and a per-mode block: this is a session-wide (at
minimum), tool-wide network-egress policy that also does not discriminate by target category.

**Independent confirmation via two channels beyond the tool's own error, per protocol:**

1. `curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code `0`. `recentRelayFailures` included
   the four entries already logged by the earlier store-reviews.md session at
   `2026-09-07T05:57:17–18Z` (`cafebazaar.ir`, `myket.ir`, `play.google.com`, `example.com`, all
   `connect_rejected` / "gateway answered 403 to CONNECT"), **plus a fifth, new entry from this
   session**: `rsee.ir:443` at `2026-09-07T06:48:00.928Z`, same `connect_rejected` /
   403-at-CONNECT signature — see item 2 below.
2. A raw `curl` to `https://rsee.ir` **bypassing the `WebFetch` tool entirely**, run directly
   against the proxy:
   ```
   $ curl -sS -m 10 -o /dev/null -w "HTTP:%{http_code} EXIT:%{exitcode}\n" https://rsee.ir
   curl: (56) CONNECT tunnel failed, response 403
   HTTP:000 EXIT:56
   ```
   Exit code `56` (`CURLE_RECV_ERROR`, reported by curl for the failed CONNECT), HTTP status
   never obtained (`000`) because the TLS tunnel itself was refused at the proxy with a 403 before
   any request reached `rsee.ir`. This is the entry that produced the new
   `rsee.ir:443` / `06:48:00.928Z` line in the proxy log above — **the block is enforced at the
   proxy's CONNECT stage, not inside the `WebFetch` tool**, so no client-side workaround (raw curl,
   a different tool) can route around it.

**`webfetch_worked = false` for this session**, confirmed by the tool's own structured error, an
independent proxy-log query, and a raw-curl bypass attempt — three corroborating signals, the
strongest confirmation any RSEE session has recorded to date.

**Fallback attempted, per protocol:** `WebSearch` with SCALE-mode-specific queries (funding,
installs, revenue — distinct from store-reviews.md's and social.md's review/social-hunt queries).

| # | Query | Result |
|---|---|---|
| 1 | `آرسی rsee.ir رزرو میز نظرات کاربران` | Budget exhausted (200/200) |
| 2 | `RSEE Iran restaurant reservation app installs revenue funding` | Budget exhausted (200/200) |

Both calls returned the identical deterministic response: *"Web search was not performed: this
session has used its web search budget (200 of 200 WebSearch calls). Continue with the
information already gathered instead of issuing more searches. If more searches are genuinely
needed, ask the user to raise CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION."* This is the same
deterministic "200 of 200" ceiling both prior 2026-09-07 sessions hit on their first two queries
each — a third independent session, with entirely different query text, hitting the identical
exhaustion message on its first two calls is strong evidence this is a genuinely shared,
account/programme-level budget rather than a per-session counter that happened to run out three
times coincidentally. No further `WebSearch` calls were issued — per the same reasoning both prior
sessions recorded, a third identical call burns turns for zero information gain against a
deterministic message.

**Planned queries left unrun**, listed for a future session with budget so this list does not need
to be reconstructed:

- `آرسی رستوران استخدام` / `RSEE Iran hiring careers` (headcount/job-posting signal)
- `site:crunchbase.com rsee.ir` / `site:tracxn.com rsee`
- `آرسی رزرو میز سرمایه‌گذار` / `RSEE Iran seed funding investor`
- `rsee.ir similarweb OR semrush OR ahrefs traffic`
- `آرسی رزرو میز کاربر فعال ماهانه` (MAU, Persian phrasing)
- `آرسی رستوران ۲۰۰۰ رستوران` (independent corroboration hunt for the "2000+" venue claim)
- `"rsee.ir" acquisition OR acquired OR merger`
- `site:jobinja.ir آرسی` / `site:jobvision.ir rsee` (Iranian job boards)
- `آرسی رزرو گزارش سالانه درآمد` (revenue/annual-report hunt)

## Reviews/pages read this session: 0

Per the task's own rule ("Never invent... 0 is a valid answer" / "Never pad to hit a target"),
reported plainly. No Crunchbase page, LinkedIn page, SimilarWeb page, job posting, press release,
filing, or any other SCALE-relevant source was opened or read this session. No install band,
rating, review count, MAU figure, traffic estimate, venue count, city list, funding figure,
revenue figure, headcount number, or job posting was obtained.

## USERS — install bands, ratings, MAU

| Field | Value | As of | Status |
|---|---|---|---|
| Cafe Bazaar install band | Never located — no RSEE package name identified on Cafe Bazaar in any session | 2026-09-05 search, prior session | UNKNOWN — not verified |
| Myket install band | The one candidate found (`caferc.asemansystem.com.caferc`, "کافه آرسی") is a **confirmed different, unrelated** classifieds app, <100 installs, last updated ۱۳۹۸/۰۱/۰۷ (≈2019-03-27) — ruled out, not RSEE | 2026-09-05 `[fetched]`, prior session | Confirmed **not RSEE** (a closed false lead, not an open question) |
| Google Play install band | Never located in any session | — | UNKNOWN — not verified |
| iOS App Store rating/reviews | Never located in any session | — | UNKNOWN — not verified |
| Aggregate rating (any platform) | Never obtained in any session | — | UNKNOWN — not verified |
| Review count (any platform) | Never obtained in any session (**0** reviews read across all three 2026-09-07 sessions plus the 2026-09-05 base pass) | — | UNKNOWN — not verified |
| MAU / registered-user count — company-claimed | Not stated anywhere on `rsee.ir` per the 2026-09-05 fetch (the only figure the site publishes about scale is **"۲۰۰۰+"** partner *venues*, not a user/diner count) | 2026-09-05 `[fetched]` | UNKNOWN — not verified (RSEE does not appear to publish a user-count claim at all, distinct from "not found") |
| MAU / registered-user count — independent | Never obtained | — | UNKNOWN — not verified |

**Note on the venue claim, restated for this mode's purposes:** "۲۰۰۰+" partner cafes/restaurants
is the one scale figure RSEE does publish, and it is explicitly **company-claimed** — sourced to
`rsee.ir` `[fetched]` 2026-09-05, no independent corroboration located in any session to date. For
context, the only comparable independently-countable figure in the whole Iranian long-tail sweep
is Alaedin Travel's **717** listed venues (a page-countable figure, not a marketing round number,
per `profiles/iran-reservation-longtail.md`) — roughly a third of RSEE's claim, from an adjacent
(travel-agency) rather than head-on product. This is restated context, not new evidence gathered
this session.

## SALES — venues, cities, revenue/GMV

| Field | Value | As of | Status |
|---|---|---|---|
| Venue count — company-claimed | **"۲۰۰۰+"** (rendered on `rsee.ir` marketing copy) | 2026-09-05 `[fetched]`, prior session | CLAIMED, restated — not re-verified this session |
| Venue count — independent | Never obtained | — | UNKNOWN — not verified |
| City coverage | Not stated in any session's evidence — the 2026-09-05 fetch describes the funnel as location-based search but did not record a published city list or count | — | UNKNOWN — not verified |
| Revenue / GMV | Never obtained | — | UNKNOWN — not verified |
| Restaurant-side plan pricing (published) | پلن ۱ رایگان (۴ ماه) · پلن ۲ ۹۹۰,۰۰۰ تومان/۱۲ماهه · پلن ۳ ۲,۹۹۰,۰۰۰ تومان/۶ماهه یا ۳,۹۹۰,۰۰۰ تومان/۱۲ماهه | 2026-09-05 `[fetched]`, prior session | REAL (site content), restated — not re-verified this session |
| Diner-side average transaction / package price | The pricing page for diner packages (`/plans`) returned HTTP 404 in the 2026-09-05 pass; no diner-facing price list has ever been read by any session | 2026-09-05 `[fetched — negative result]` | UNKNOWN — not verified |
| Acquisition price (if any) | Never searched successfully; no indication RSEE has been acquired or has acquired anything | — | UNKNOWN — not verified |

## SCALE — website traffic, funding/investors, headcount, job postings

| Field | Value | As of | Status |
|---|---|---|---|
| Website traffic estimate (Similarweb/SEMrush/Ahrefs) | Never obtained — `similarweb.com/website/rsee.ir/` tested this session, `EGRESS_BLOCKED` | 2026-09-07 (this session, attempt only) | UNKNOWN — not verified |
| Funding rounds | Never obtained — `crunchbase.com/organization/rsee` tested this session, `EGRESS_BLOCKED` | 2026-09-07 (this session, attempt only) | UNKNOWN — not verified |
| Investors | Never obtained | — | UNKNOWN — not verified |
| Headcount | Never obtained — `linkedin.com/company/rsee` tested this session, `EGRESS_BLOCKED` | 2026-09-07 (this session, attempt only) | UNKNOWN — not verified |
| Current job postings (roles open — ML, growth, payments, etc.) | Never obtained | — | UNKNOWN — not verified |
| Tracxn profile | Never tested (search-only source; `WebSearch` budget exhausted before this could be queried) | — | UNKNOWN — not verified |

**Every SCALE-mode field above is UNKNOWN — not verified.** This is not "RSEE has no funding" or
"RSEE has no LinkedIn page" — it is "this session, like the two before it today, had no working
channel to check." The distinction matters and is stated explicitly per the constitution's rule
that a failed fetch must never be reported as a zero/empty finding.

## Feature verification status (this mode's intended contribution)

Per the task's REAL/CLAIMED/UNKNOWN/ABSENT taxonomy, restricted to what a USERS/SALES/SCALE pass
specifically could have added versus what the 2026-09-05 site fetch already established:

| Feature/claim | Status | Evidence |
|---|---|---|
| "۲۰۰۰+" partner venues | CLAIMED — unchanged from prior pass | Company-claimed, `rsee.ir` `[fetched]` 2026-09-05, prior session; no independent traffic/store/press corroboration found this session (all attempts `EGRESS_BLOCKED`) |
| Funding raised | UNKNOWN | Crunchbase attempt blocked this session; no prior session ever attempted this either |
| Any registered-user or MAU figure published by RSEE itself | ABSENT-leaning, not confirmed ABSENT | The 2026-09-05 fetch of `rsee.ir` root recorded venue counts and pricing but no user-count claim; no session has done a targeted re-read of every page for a hidden MAU stat, so this is not a confirmed ABSENT |
| Current hiring / open roles (roadmap signal) | UNKNOWN | LinkedIn/job-board attempts blocked this session; never attempted by any prior session |
| Independent traffic estimate exists for `rsee.ir` | UNKNOWN | SimilarWeb attempt blocked this session |

## Contradiction check against existing profile and prior corpus

**None found.** This session obtained no new data of any kind for any USERS/SALES/SCALE field —
there is nothing here that could confirm or contradict `profiles/iran-reservation-longtail.md`'s
RSEE section, `corpus/rsee/store-reviews.md`, `corpus/rsee/social.md`, or `MATRIX.md`'s RSEE
cells. What this session adds beyond simple corroboration: **it is the first RSEE session to test
SCALE-specific sources at all** (Crunchbase, LinkedIn, SimilarWeb — none tested by either prior
2026-09-07 session, which targeted app stores and social platforms respectively), and it is the
first to attempt a proxy-bypass raw-`curl` confirmation, which independently reproduced the block
at the TLS-CONNECT layer (exit 56, HTTP 403 on the CONNECT tunnel) rather than relying solely on
the `WebFetch` tool's own error report. That strengthens, rather than merely repeats, the
"tooling-wide outage" finding already on record — three sessions, three different sets of target
domains, three identical outcomes.

## What this means for the audit line

The task's USERS/SALES/SCALE goals — install bands, MAU, traffic estimates, funding, revenue,
venue/city counts, headcount, and current job postings — were **not met**. Zero sources were read
this session. Combined with `store-reviews.md` (0 reviews) and `social.md` (0 posts/threads),
**RSEE now has a confirmed-empty independent-evidence corpus across every mode attempted in this
research programme to date: no app-store review, no social-media post, no forum thread, no
funding record, no traffic estimate, no headcount figure, no job posting.** Every fact this
programme holds about RSEE's scale traces to exactly one source — RSEE's own marketing copy on
`rsee.ir` (the 2026-09-05 fetch), which by definition is company-claimed, and the single figure it
offers (**"۲۰۰۰+" venues**) has no independent corroboration of any kind.

This is the **third consecutive same-day session** (store-reviews.md, social.md, this file) to
hit an identical dual-tool outage on RSEE specifically, now proven at three levels: the `WebFetch`
tool's own structured `EGRESS_BLOCKED` error, an independent proxy-status query showing
`connect_rejected`/403-at-CONNECT for every tested host (five distinct hosts across the three
sessions, zero exceptions), and — new this session — a raw-`curl` bypass that reproduces the same
403-at-CONNECT outside the tool entirely. Per the audit constitution, this is reported as a
**tooling-availability finding**, not as evidence that RSEE lacks funding, traffic, headcount, or
users — those remain genuinely unknown, not zero.

**Recommended for the founder directly, escalated in severity from the prior two sessions' framing:**
this is no longer "one session had no tools" — it is a reproducible, three-times-independently-
confirmed inability to gather *any* independent evidence about Iran's only live head-on
reservation competitor, across three different evidence classes (reviews, social, scale/funding),
using three different toolsets (`WebFetch` targets, `WebSearch` queries, and now a raw-curl
bypass). Either (a) a future session needs working egress specifically restored for this research
line before any of these gaps can close, or (b) if a working session later finds RSEE genuinely
has no Crunchbase/LinkedIn/SimilarWeb footprint either, that absence — for a company claiming
"2,000+" partner venues — becomes a first-class strategic finding in its own right (a company at
that claimed scale with zero discoverable third-party footprint is itself unusual and worth
flagging), not merely a research gap.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (all five `EGRESS_BLOCKED`):** `https://example.com` (control, 06:4x UTC),
`https://rsee.ir` (primary target), `https://www.crunchbase.com/organization/rsee`,
`https://www.linkedin.com/company/rsee`, `https://www.similarweb.com/website/rsee.ir/`.

**Proxy diagnostic (`curl -sS "$HTTPS_PROXY/__agentproxy/status"`, exit `0`):** confirmed
`recentRelayFailures` carrying the four entries from the earlier same-day store-reviews.md session
(`cafebazaar.ir:443`, `myket.ir:443`, `play.google.com:443`, `example.com:443`, all
`2026-09-07T05:57:17–18Z`) **plus a new fifth entry produced by this session**:
`rsee.ir:443` at `2026-09-07T06:48:00.928Z`, same `connect_rejected` / "gateway answered 403 to
CONNECT" signature.

**Raw curl bypass (outside the WebFetch tool):**
`curl -sS -m 10 -o /dev/null -w "HTTP:%{http_code} EXIT:%{exitcode}\n" https://rsee.ir` →
`curl: (56) CONNECT tunnel failed, response 403` / `HTTP:000 EXIT:56`.

**WebSearch (both rejected — session-wide budget at 200/200 before either query returned a
result):** `آرسی rsee.ir رزرو میز نظرات کاربران`; `RSEE Iran restaurant reservation app installs
revenue funding`.

## Sources (prior sessions, cited not re-verified this session)

`docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` against `rsee.ir`
directly — root page, chair-credit copy, restaurant pricing table; `/plans`, `/rules`, `/faq`
`[fetched — negative result, HTTP 404]`). `docs/audit/research/corpus/rsee/store-reviews.md`
(2026-09-07, mode STORE REVIEWS AT VOLUME — 0 reviews read, `WebFetch`/`WebSearch` both
unavailable). `docs/audit/research/corpus/rsee/social.md` (2026-09-07, mode SOCIAL AND FORUMS —
0 posts read, same dual-tool outage). `docs/audit/research/MATRIX.md` footnote 56 and the
"Independent, third-party-reviewable footprint" row (RSEE marked ABSENT). `docs/audit/research/
WATCH.md` 2026-09-05 RSEE entry (pricing/mechanic facts only, no users/sales/scale data).
