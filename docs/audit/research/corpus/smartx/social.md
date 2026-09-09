# SmartX — Social & Forums (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_
_Mode: SOCIAL AND FORUMS (Persian X/Twitter, Telegram, Instagram comments, Reddit, Persian forums and
news-comment sections, LinkedIn, and the restaurant-owner side: fees, payouts, support, exclusivity)_

## Prior research read first (per task instruction) — this file extends, does not repeat

Read in full before starting:

- `docs/audit/research/profiles/smartx.md` — base profile (2026-09-04, `WebSearch`-only pass) plus its
  2026-09-05 ADDENDUM (first-hand `WebFetch` reads of `smartx.ir/pricing/` and `smartx.ir/sorry/`).
- `docs/audit/research/corpus/smartx/store-reviews.md` — **same day, earlier session**, mode STORE
  REVIEWS AT VOLUME. That session also found both `WebFetch` and `WebSearch` completely unavailable
  and read zero reviews.
- `docs/audit/research/WATCH.md` — SmartX entries (2026-09-04, 2026-09-05 corrections).
- `docs/audit/research/MATRIX.md` — SmartX cells and footnotes 6, 14, 18, 30, 33, 58.

What those already establish, relevant to *this* mode specifically:

- SmartX is B2B software sold to restaurant/café owners exclusively through POS resellers (Sepidz,
  Sepidar Sistem, Vendo) — diners never touch a SmartX-branded surface directly (no consumer app, no
  Cafe Bazaar listing for the real product). This matters for social-mode research because it predicts
  *where* organic complaint/praise content would even be possible to find: restaurant-owner channels
  (LinkedIn, Telegram business groups, POS-reseller communities), not diner-facing review sites.
- The 2026-09-04 base pass **already ran a social/forum-shaped search sweep** (its own words: "tried
  multiple phrasings in Persian: `نظرات`, `شکایت`, `تجربه من`, `مشکل`, `پشتیبانی`" across "forum threads,
  Telegram channel discussions, Twitter/X posts, Quera/Pursaan-style Q&A posts, or restaurant-owner
  community commentary") and found **zero** hits, using a `WebSearch` tool that was functional at the
  time (unlike WebFetch, which was blocked that session too).
- The only dated, first-party negative signal in the entire SmartX research line is still
  `smartx.ir/sorry/` (HTML `<title>` = «اختلالات باشگاه مشتریان | مرداد ماه ۱۴۰۴», Customer Club
  disruptions, ≈2025-07-23 to 2025-08-22), first-hand-fetched 2026-09-05, narrowed to "title-level
  admission only" — the page body has no incident description. This is a **company-authored page**, not
  a review or social post, and is not re-listed below as a complaint theme.
- Pricing self-contradiction already on record: `smartx.ir/pricing/` states ۵۲,۸۰۰,۰۰۰ تومان/year for
  رزرو هوشمند; `smartx.ir/services/reserve/restaurant/` states ۲۱,۴۵۰,۰۰۰ تومان/year for the same
  product — a 2.5× gap, both first-hand-fetched 2026-09-05.

**Contradiction check against prior research (required by task instructions):** one genuine
inconsistency found, flagged here rather than silently resolved. `MATRIX.md` footnote 48 (attached to
the Foodism review-volume row) states Foodism's total review-absence is "a much weaker signal than for
Fidilio/SmartX/Servme, **where at least some review volume exists**." This directly contradicts
`profiles/smartx.md`'s own "Review synthesis" section ("I found **zero** independent, verifiable,
verbatim reviews — from diners or from restaurant owners/staff — anywhere") and is also contradicted by
the same-day `corpus/smartx/store-reviews.md` ("across all three dated Scout sessions to date... the
count of independently read, verbatim, user-authored reviews remains **exactly zero**"). Footnote 48
appears to be wrong about SmartX specifically (it may have been written loosely, lumping SmartX in with
Fidilio/Servme, which *do* have some review volume, without re-checking SmartX's own zero). Recorded
here for whoever next edits `MATRIX.md`; not corrected in that file by this session, since this task's
mandate is to write only to `docs/audit/research/corpus/smartx/social.md`.

---

## Methodology — both primary tools were unavailable this session (read before the findings)

**First action taken, per protocol:** `WebFetch` tested against `https://example.com` (neutral control),
then against primary mode-specific targets across every platform named in the task brief.

| # | URL tested | Purpose | Result |
|---|---|---|---|
| 1 | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `https://smartx.ir/` | Primary target homepage (sanity check vs. 2026-09-05 session where this worked) | `EGRESS_BLOCKED` |
| 3 | `https://www.instagram.com/smartx_acc/` | Instagram — SmartX's confirmed official account (per profile) | `EGRESS_BLOCKED` |
| 4 | `https://nitter.net/search?q=...` | Twitter/X via nitter mirror (task brief explicitly suggests trying this) | `EGRESS_BLOCKED` |
| 5 | `https://t.me/s/smartx_ir` | Telegram web preview (channel handle guessed; unconfirmed to exist) | `EGRESS_BLOCKED` |
| 6 | `https://www.reddit.com/r/iran/search/?q=smartx` | Reddit r/iran | Distinct error: *"Claude Code is unable to fetch from www.reddit.com"* — not the same `EGRESS_BLOCKED` shape as the others, but equally non-functional (reddit.com appears to be blocked at a different layer, e.g. protocol-level, not just the egress proxy) |
| 7 | `https://ir.linkedin.com/company/smartxacc` | LinkedIn — the "possible second SmartX entity" flagged unresolved in the base profile | `EGRESS_BLOCKED` |
| 8 | `https://www.digiato.com/?s=...` | Digiato search (Persian tech press, named in task brief for news-comment sections) | `EGRESS_BLOCKED` |

**Conclusion: `webfetch_worked = false` for this session, across every platform this mode names** —
Instagram, X/Twitter (direct and via nitter mirror), Telegram, Reddit, LinkedIn, and Persian tech press
(Digiato). Row 1 (`example.com`) confirms this is a blanket network-egress policy for the session, not a
per-domain block, and it is the identical pattern the same-day `smartx/store-reviews.md` and
`fidilio/social.md` sessions recorded independently.

**Corroborating evidence — direct `curl` to the egress-proxy status endpoint** (not a WebFetch call;
run via Bash, per the environment's own troubleshooting instructions):

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"
```

Relevant excerpt of the raw JSON response (`recentRelayFailures`, most recent entries):

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

This confirms the block is enforced at the network gateway itself (HTTP 403 to `CONNECT`), independent
of the `WebFetch` tool layer, and that it predates this session's own attempts (these four hosts were
already recorded as failures before I ran anything) — i.e., this is a pre-existing, session-wide
condition, not something this session's own actions caused or could work around by trying a different
tool.

**Fallback attempted, per protocol: `WebSearch` with many differently-phrased Persian and English
queries.** Every query issued returned the identical rejection before any search result was ever seen:

> *"Web search was not performed: this session has used its web search budget (200 of 200 WebSearch
> calls). Continue with the information already gathered instead of issuing more searches."*

Queries attempted (all rejected identically):

1. `اسمارت ایکس رستوران نظرات`
2. `باشگاه مشتریان اسمارت ایکس تجربه`
3. `رزرو هوشمند اسمارت ایکس قیمت شکایت`
4. `"اسمارت ایکس" site:twitter.com`
5. `"smartx.ir" site:x.com`
6. `"اسمارت ایکس" site:t.me`
7. `اسمارت ایکس رستوران دیگه استفاده نمیکنم`

This is a **session-level** budget, not a per-call one — confirmed by the same-day `store-reviews.md`
session hitting the identical "200 of 200" ceiling on its *first* query, and by `fidilio/social.md`
(also 2026-09-07) reporting 41 *successful* queries before presumably contributing to the same shared
ceiling. Per the task brief, multiple Scout sessions research different competitors/modes concurrently
against what is evidently one shared account-level `WebSearch` quota; this session's slice of that quota
was already fully consumed by sibling sessions before this task's first query could execute. Retrying
was not productive — every attempt returned the identical exhaustion message.

**Net result: this session had zero working channel to the open web**, across both tools, tested
against every platform this specific mode names (Persian X/Twitter — including a nitter fallback per
the brief's own suggestion — Telegram, Instagram, Reddit, LinkedIN, Persian forums/news-comments) plus
a direct-`curl` corroboration outside the tool layer entirely. Per the audit constitution's rule that
"we don't know" must never be reported as "confirmed zero in the world," this is reported as a
**tooling-availability gap for this session**, not as proof that no SmartX social/forum content exists
anywhere. The 2026-09-04 session's own social-shaped search sweep (cited under "Prior research" above),
run when `WebSearch` was functional, remains the best — though not definitive, and now over three days
old — existing evidence that such content is genuinely scarce or absent, not merely unfetched.

---

## Reviews / posts read this session: 0

Per the task's own rule ("0 is a valid answer" / "Never pad to hit a target"), this is reported
plainly. No tweet, Telegram post, Instagram comment, Reddit post, forum thread, news-comment, or
LinkedIn post — about SmartX in either the diner-facing or restaurant-owner-facing direction — was
opened or read by this session. No verbatim quote, no handle, and no date was obtained. `reviews_read =
0`.

## The hunted sentence: «دیگه استفاده نمیکنم چون…» / "I stopped using it because..."

**Not found.** The one `WebSearch` query aimed directly at this exact phrase (`اسمارت ایکس رستوران دیگه
استفاده نمیکنم`) was rejected by the budget ceiling before any result could return (see methodology
above, query 7). No prior session (2026-09-04, 2026-09-05, or the same-day `store-reviews.md` session)
reports finding this sentence either. UNKNOWN — not verified, distinct from "confirmed absent."

## Restaurant-owner side: fees, payouts, support, exclusivity

No new evidence this session (both tools unavailable). Restating what the existing profile already
establishes, so this file does not silently omit the angle the task brief asks for, while being explicit
that none of it is social/forum-sourced and none of it is new:

- **Fees:** `profiles/smartx.md` already documents the pricing self-contradiction (۵۲,۸۰۰,۰۰۰ تومان/year
  vs ۲۱,۴۵۰,۰۰۰ تومان/year for the same "رزرو هوشمند" product line, both first-hand-fetched 2026-09-05)
  and a usage-based alternative (۲۹,۵۰۰,۰۰۰ تومان activation + ۱۰,۰۰۰ تومان/transaction, with a 30%
  discount when 75%+ of invoices carry a captured customer phone number). No restaurant-owner
  first-person account of *actually paying* these fees, disputing them, or comparing quoted-vs-billed
  amounts was found by this or any prior session.
- **Payouts:** SmartX is a flat-fee/subscription B2B SaaS product (restaurant pays SmartX; there is no
  marketplace commission or diner-to-restaurant payout flow for it to run), so a "payout complaint" in
  the SnappFood/delivery-platform sense is structurally not applicable to this product — UNKNOWN whether
  any adjacent payment-processing complaint exists (e.g., the reservation-prepayment gateway mentioned
  in the profile), not verified by any session.
- **Support:** `smartx.ir/customer-services/` and `smartx.ir/contact/` are listed as existing support
  channels in the base profile (via `WebSearch` synthesis, never independently fetched); no
  restaurant-owner account of actual support quality, response time, or a support dispute was found by
  this or any prior session. UNKNOWN — not verified.
- **Exclusivity:** the base profile and `MATRIX.md` document SmartX being positioned as an *add-on
  module* layered onto a restaurant's existing POS relationship (Sepidz, Sepidar Sistem, Vendo), which
  is structurally the *opposite* pattern from the exclusivity dispute the concurrent `fidilio/social.md`
  session found for Fidilio (a delivery platform allegedly punishing restaurants for a competing
  reservation-platform contract). No equivalent SmartX exclusivity dispute — SmartX enforcing exclusivity
  against a restaurant, or a POS partner enforcing exclusivity *for* SmartX — was found by this or any
  prior session. UNKNOWN — not verified, and structurally less likely to exist given the add-on
  (not gatekeeper) business model, but that is an inference, not a confirmed absence.

## Complaint themes — honest sample sizes

**None can be reported with a sample size greater than zero.** No social-media post, forum thread, or
news-comment about SmartX — from a diner or a restaurant owner/staff member, complaint or praise — was
read by this session. This is consistent with, not contradicted by, all three prior SmartX research
sessions (2026-09-04, 2026-09-05, and the same-day `store-reviews.md`), none of which read a single
user-authored review or social post either.

### Top complaints
UNKNOWN — not verified. `reviews_read = 0` this session across every platform this mode names; no prior
session (store reviews, general profile, or the 2026-09-04 social-shaped search sweep) ever surfaced one
either. There is no sample of any size to draw a theme or a count from.

### Top praises
UNKNOWN — not verified. Same reason as above.

## Contradiction check — result

None found against `profiles/smartx.md` or `corpus/smartx/store-reviews.md` (this session added no new
data of any kind to contradict or confirm). One contradiction **was** found *within the existing
research corpus itself* — between `MATRIX.md` footnote 48 and `profiles/smartx.md`'s own "Review
synthesis" section — and is documented above under "Prior research read first."

## Interpretation — four independent sessions, zero social/forum content, for a B2B add-on product

Flagged as an honest inference, clearly separated from confirmed fact. Four independent Scout sessions
now span this SmartX research line (2026-09-04 profile pass, 2026-09-05 first-hand-fetch addendum,
2026-09-07 store-reviews pass, and this 2026-09-07 social-and-forums pass) and **none has ever
surfaced a single user-authored review, social post, or forum comment about SmartX**, positive or
negative, from either a diner or a restaurant owner. Two of those four sessions had at least one working
tool (2026-09-04 had `WebSearch`; 2026-09-05 had `WebFetch`); this session and `store-reviews.md` had
neither. The structural explanation already on record — SmartX is distributed exclusively through B2B
POS resellers rather than a self-serve discovery motion that would organically generate app-store or
social-media chatter — remains plausible and is now reinforced by one more failed-to-find attempt, but
it is still an **inference**, not a confirmed fact: a genuine SmartX-specific Telegram business-owner
group, a LinkedIn post by a disgruntled restaurant manager, or an Instagram comment thread could exist
behind a platform this session's tools simply could not reach. Nothing here proves the negative.

## What this means for the audit line

The task's brief (hunt the exact "stopped using it because" sentence; count owner-side fee/payout/
support/exclusivity themes with sample sizes) could not be executed this session — both required tools
were unavailable across every platform named, confirmed by 8 distinct WebFetch attempts (7 platform
targets + 1 control) and by a direct-curl corroboration outside the tool layer, plus 7 rejected
WebSearch queries. The single highest-value unresolved action for a future session remains unchanged
from `store-reviews.md`: get either tool working against SmartX's confirmed official Instagram
(`instagram.com/smartx_acc`) or a live Telegram/LinkedIn search — that would be the first first-hand
social/forum data point in this entire research line, positive or negative.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (8 attempts, results in the methodology table above):** example.com (control),
smartx.ir, instagram.com/smartx_acc, nitter.net/search (Twitter/X mirror), t.me/s/smartx_ir,
reddit.com/r/iran/search (distinct "unable to fetch" error, not `EGRESS_BLOCKED`),
ir.linkedin.com/company/smartxacc, digiato.com (search page). 7 of 8 returned `EGRESS_BLOCKED`; 1
(Reddit) returned a differently-worded but equally non-functional error.

**Direct curl (Bash, not WebFetch):** `curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code 0,
raw JSON output showing pre-existing `connect_rejected` / HTTP 403 failures for cafebazaar.ir,
myket.ir, play.google.com, and example.com, confirming the block is enforced at the network gateway,
independent of and prior to this session's own tool calls.

**WebSearch (7 queries, all rejected — session budget exhausted at 200/200 before any query returned a
result):** `اسمارت ایکس رستوران نظرات`; `باشگاه مشتریان اسمارت ایکس تجربه`; `رزرو هوشمند اسمارت ایکس
قیمت شکایت`; `"اسمارت ایکس" site:twitter.com`; `"smartx.ir" site:x.com`; `"اسمارت ایکس" site:t.me`;
`اسمارت ایکس رستوران دیگه استفاده نمیکنم`.

## Sources (prior sessions, cited not re-verified this session)

- `docs/audit/research/profiles/smartx.md` — full base profile (2026-09-04, `WebSearch`-only) and its
  2026-09-05 ADDENDUM (first-hand `WebFetch` reads of `smartx.ir/pricing/` and `smartx.ir/sorry/`).
- `docs/audit/research/corpus/smartx/store-reviews.md` — same-day (2026-09-07) sibling session, mode
  STORE REVIEWS AT VOLUME, also found both tools unavailable.
- `docs/audit/research/WATCH.md` — SmartX entries (2026-09-04, 2026-09-05).
- `docs/audit/research/MATRIX.md` — SmartX cells and footnotes 6, 14, 18, 30, 33, 58; footnote 48
  (Foodism row) flagged above as internally inconsistent regarding SmartX specifically.
- `docs/audit/research/corpus/fidilio/social.md` — same-day, same-mode sibling session for a different
  competitor; consulted only to confirm the shared-budget/shared-egress-block pattern, not for SmartX
  content (Fidilio-specific findings are out of scope for this file and not reproduced here).

## What I did NOT verify

- **Whether SmartX has any Telegram channel or group at all** — no handle was confirmed to exist in any
  prior session; the `t.me/s/smartx_ir` URL tested above was a guess, unconfirmed, and unreachable
  either way.
- **The content of the confirmed-to-exist `instagram.com/smartx_acc` account** — existence only, per the
  2026-09-04 session; no post, comment, or engagement metric from any session.
- **Any restaurant-owner-side account of fees, payouts, support quality, or exclusivity terms** —
  structurally reasoned about above from the existing pricing/business-model evidence, but no
  first-person owner quote of any kind exists in this research line.
- **The exact hunted sentence** («دیگه استفاده نمیکنم چون…») — one targeted query was queued but never
  executed (budget exhaustion). Not found, not confirmed absent.
- **Whether the MATRIX.md footnote 48 inconsistency flagged above reflects a data error or a scope
  mismatch** (e.g., footnote 48 may have been drafted before SmartX's "zero reviews" finding was fully
  locked in, or may be conflating "review volume" with "any first-party content volume" including the
  `/sorry/` page) — not resolved by this session; recorded for a future session with `MATRIX.md` write
  access to investigate and correct if warranted.
