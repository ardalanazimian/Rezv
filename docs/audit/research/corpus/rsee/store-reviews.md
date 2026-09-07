# RSEE (آرسی) — Store Reviews at Volume (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: RSEE / آرسی (`rsee.ir`), key `rsee`, tier `iran`_
_Mode: STORE REVIEWS AT VOLUME (target: 50+ recent real user reviews)_

## Prior art read first (per task instructions)

`docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` pass) was read in full
before starting this session. It already establishes, and this session did not contradict —
because this session obtained no new data of any kind (see Methodology below):

- RSEE is the **only live, dedicated, consumer-facing** table-reservation product found anywhere
  in the Iranian long-tail sweep (Eatamin and Dido Food are dead; Alaedin Travel and Sepidz are
  adjacent, not head-on; mizaa.ir and "کافه آرسی" are false leads).
- Diner-side mechanic: prepaid, chair-denominated credit ("آرسی" = 1 chair) spent to book a
  table, with 50–100% forfeited on late cancellation. Verbatim: *"جهت انجام رزرو میز کافه/رستوران،
  کاربر می تواند اقدام به خرید بسته نماید"*; *"هر بسته رزروی شامل تعدادی آرسی می شود و هر آرسی
  معادل یک صندلی از یک میز می باشد"* — both `[fetched]` from `rsee.ir` on 2026-09-05.
- Restaurant-side pricing is published with no sales call: پلن ۱ رایگان (۴ ماه)، پلن ۲
  ۹۹۰,۰۰۰ تومان/۱۲ماهه، پلن ۳ ۲,۹۹۰,۰۰۰ تومان/۶ماهه یا ۳,۹۹۰,۰۰۰ تومان/۱۲ماهه — `[fetched]`.
  Claims "۲۰۰۰+" partner venues — company-claimed, unaudited.
- **Explicitly flagged as the single biggest gap in that file:** *"No review data for RSEE...
  No app-store listing for RSEE was located (the one the search surfaced,
  `myket.ir/app/caferc.asemansystem.com.caferc` / "کافه آرسی", was checked and is a different,
  unrelated classifieds app, <100 installs) — so there is no independent complaint corpus for the
  only live competitor in the category."* `/plans`, `/rules`, `/faq` on `rsee.ir` all returned
  HTTP 404 in that pass.
- This session's assignment was precisely to close that gap via a dedicated high-volume review
  pull. It did not succeed — see Methodology — so nothing above is contradicted, only reconfirmed
  as still-unresolved, for a second dated session in a row.

## Methodology — both primary tools were unavailable this session

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (a
neutral control) and then against `https://rsee.ir` (the primary target for this competitor).

| # | URL tested | Purpose | Result |
|---|---|---|---|
| 1 | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `https://rsee.ir` | Primary target (RSEE's own site) | `EGRESS_BLOCKED` |

Both calls returned `EGRESS_BLOCKED` from the tool itself. To confirm this was a genuine
network-policy block and not a tool-side fluke, the proxy status endpoint named in this
environment's own instructions was queried directly:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"
```
Exit code: `0`. Relevant excerpt from the JSON response, `recentRelayFailures` (all timestamped
`2026-09-07T05:57:17–18Z`, all `kind: "connect_rejected"`, all `detail: "gateway answered 403 to
CONNECT (policy denial or upstream failure)"`):
`cafebazaar.ir:443`, `myket.ir:443`, `play.google.com:443`, `example.com:443`.

**Conclusion: `webfetch_worked = false` for this session**, and this is a blanket session-level
egress-policy block (the neutral `example.com` control failing rules out a per-domain block, and
the proxy log independently confirms 403-at-CONNECT for exactly the store domains this mode
targets). This matches the pattern recorded the same day by concurrent Scout sessions on other
competitors (`docs/audit/research/corpus/smartx/store-reviews.md`,
`docs/audit/research/corpus/fidilio/store-reviews.md`) — this is a shared, session-wide
condition, not specific to RSEE.

No further `WebFetch` calls were made against Cafe Bazaar, Myket, Google Play, apps.apple.com,
Trustpilot, G2, Capterra, GetApp, Sitejabber, apkpure/apkcombo/uptodown/aptoide, appreview.ir, or
charkhoneh — each would return the identical `EGRESS_BLOCKED` result the control already
demonstrated, and burning calls to re-confirm a proven blanket block would not be "real effort,"
it would be noise.

**Fallback attempted, per protocol:** the task instructs falling back to `WebSearch` with many
differently-phrased Persian and English queries when `WebFetch` is blocked. Two queries were
issued before either could return a result:

1. `آرسی rsee.ir نظرات کاربران`
2. `اپلیکیشن آرسی رزرو میز رستوران دانلود`

Both returned the identical tool response: *"Web search was not performed: this session has used
its web search budget (200 of 200 WebSearch calls). Continue with the information already
gathered instead of issuing more searches."* This is a **session-level** budget, not per-call or
per-competitor — per the task brief, other Scout sessions write to this same repository
concurrently, and the shared `WebSearch` allotment was already fully consumed before this
session's first query could execute. The remaining planned queries (all left unrun, listed here
so a future session with budget does not have to re-derive them) were:

- `آرسی رستوران بسته رزرو` / `آرسی لغو رزرو` (task-brief hints, verbatim)
- `rsee.ir myket` / `rsee.ir cafebazaar`
- `"آرسی" رزرو میز شکایت` / `"آرسی" رزرو میز مشکل`
- `RSEE Iran restaurant reservation app review`
- `site:cafebazaar.ir آرسی رزرو`
- `site:myket.ir rsee` / `site:myket.ir آرسی`
- `آرسی اپلیکیشن رزرو کافه اندروید`
- `"rsee.ir" trustpilot OR sitejabber`

Retrying immediately was not attempted a third time after the identical exhaustion message
returned twice — the message is explicit and deterministic ("200 of 200"), and a third identical
call would return the same result while consuming the researcher's and reviewer's time for zero
information gain.

**Net result: this session had zero working channel to the open web**, for RSEE specifically and
for every other domain tested. Per the audit constitution's rule that "we don't know" must never
be reported as "zero found in the world," this is reported as a **tooling-availability gap for
this session**, not as confirmation that no RSEE reviews exist anywhere, and not as a change to
the prior finding that no RSEE app-store listing had been *located* as of 2026-09-05 (a different,
independent gap — that one is about the listing's existence being unfound, this one is about the
tools being unreachable regardless).

## Reviews read this session: 0

Per the task's own rule ("Never invent... 0 is a valid answer" / "Never pad to hit a target"),
this is reported plainly. No review from any of the sources named in the task brief — Cafe
Bazaar, Myket, Google Play, apps.apple.com, apkpure/apkcombo/uptodown/aptoide, appreview.ir,
charkhoneh, Trustpilot, G2, Capterra, GetApp, Sitejabber, or any hotel/restaurant-tech review
site — was opened or read this session. No verbatim quote, no reviewer handle, no star rating,
and no review date was obtained. This is consistent with, and does not improve on, the prior
session's explicit finding that **no RSEE app-store listing has ever been located** by any Scout
session to date — even had `WebFetch`/`WebSearch` worked this session, the starting point (a
confirmed listing URL to read) was itself an open question the prior pass could not resolve.

## Store facts — status this session

No field below could be independently confirmed or refreshed this session (every source is
unreachable, as documented above). Restated from `profiles/iran-reservation-longtail.md`, with
its own original dating kept explicit, so this file does not silently imply fresher data exists:

| Field | Value | As of | Status |
|---|---|---|---|
| Cafe Bazaar listing for RSEE | Never found in any session — no package name identified | 2026-09-05 (search, prior session) | UNKNOWN — not verified |
| Myket listing for RSEE | The one candidate found (`caferc.asemansystem.com.caferc`, "کافه آرسی") is a **different, unrelated** classifieds/marketplace app, <100 installs, last updated ۱۳۹۸/۰۱/۰۷ (≈2019-03-27) | 2026-09-05 `[fetched]` (prior session) | Confirmed **not RSEE** — a ruled-out false lead, not an open question |
| Google Play listing | Never found in any session | — | UNKNOWN — not verified |
| iOS App Store listing | Never found in any session | — | UNKNOWN — not verified |
| Trustpilot page for `rsee.ir` | Never found in any session | — | UNKNOWN — not verified |
| G2 / Capterra / GetApp / Sitejabber listing | Never found in any session | — | UNKNOWN — not verified (plausible-absent: Iran-only consumer product with no international payment/support relationship, but not confirmed) |
| Aggregate rating (any platform) | Never obtained | — | UNKNOWN — not verified |
| Review count (any platform) | Never obtained | — | UNKNOWN — not verified |
| Install band (any platform) | Never obtained | — | UNKNOWN — not verified |
| App last-updated date (any platform) | Never obtained | — | UNKNOWN — not verified |
| `rsee.ir/plans`, `/rules`, `/faq` | HTTP 404 on all three | 2026-09-05 `[fetched]` (prior session) | Confirmed absent/unreachable, not merely un-tried |

## Complaint themes — honest sample sizes

**None can be reported with a sample size greater than zero.** No theme in this file is backed by
a single review read this session or by any prior session for RSEE. Unlike the Fidilio research
line (a 2026-09-05 session with working `WebFetch` read 3 verbatim Cafe Bazaar reviews against a
known population of 581 ratings), **the RSEE line has never had a session where a single
user-authored review was read, quoted, or counted.**

### Top complaints
UNKNOWN — not verified. `reviews_read = 0` this session; no prior session ever read a user review
of RSEE either. There is no sample to draw a theme or a count from. A prior session's *inferred*
diner-hostility finding — the prepaid chair-credit + 50–100% cancellation forfeiture mechanic
being "the single most diner-hostile money mechanic found anywhere in this research programme" —
is a structural/textual reading of RSEE's own published terms, **not** a review-derived
complaint, and is not re-presented here as one. See `profiles/iran-reservation-longtail.md`
§"Gen-Z lens on RSEE" for that distinct, already-labelled finding.

### Top praises
UNKNOWN — not verified. Same reason as above.

## Feature verification status (this mode's contribution only)

Per the task's REAL/CLAIMED/UNKNOWN/ABSENT taxonomy, restricted to what a review pass specifically
could have added (independent, review-confirmed feature use) versus what remains marketing-only
from the prior fetch:

| Feature | Status | Evidence |
|---|---|---|
| Table-level (not just time-slot) booking | CLAIMED | Marketing copy only, `rsee.ir` `[fetched]` 2026-09-05, prior session — no independent review confirms diners actually experience table-level selection |
| Chair-credit ("آرسی") prepay-to-book mechanic | REAL | Verbatim site copy quoted above, `[fetched]` 2026-09-05 — this is a structural/pricing-page fact, not a review-derived one, so REAL here means "confirmed present on the site," not "confirmed working for a diner" |
| Cancellation refund tiers (100%/50%/0%) | CLAIMED | Sourced via `[search]` in the prior session, not `[fetched]` directly from a rules page (`/rules` 404'd) — downgraded from the prior file's own caution |
| Mobile app (as distinct from the web app) | UNKNOWN | RSEE's site claims "web app plus mobile app"; no app-store listing has been located by any session to confirm this independently |
| Independent third-party review presence (any platform) | ABSENT-leaning, not confirmed ABSENT | Actively searched across three dated sessions (2026-09-05 base pass, 2026-09-05 batch-3 sweep, this 2026-09-07 session) with zero positive result each time; the honest label per the constitution is that "not found after real effort" on the third attempt strengthens but does not prove non-existence, since this session's "real effort" was blocked before it could search at all |

## Interpretation — is "zero reviews found, twice" itself a finding?

Flagged as an honest inference, clearly separated from confirmed fact: two independent dated
sessions (2026-09-05 with working `WebFetch`, and this 2026-09-07 session with no working
channel at all) have now failed to locate any app-store listing or independent review corpus for
RSEE — the *only* live, consumer-facing, dedicated Iranian table-reservation product found in
this entire research programme. That is a striking gap for a product claiming "۲۰۰۰+" partner
venues, but this session adds **no new evidence** toward it — the 2026-09-05 session already
searched directly and came up empty; this session could not search at all, so it cannot
distinguish "still empty" from "would have found something had the tools worked." The gap
remains exactly as open as `profiles/iran-reservation-longtail.md` already recorded it.

## Contradiction check against the existing profile

None found. This session surfaced no new data of any kind — nothing to confirm or contradict
`profiles/iran-reservation-longtail.md`'s RSEE section. The one thing this session adds is
procedural: a second, independent, differently-blocked attempt (proxy-level `EGRESS_BLOCKED` +
exhausted search budget, versus the prior session's successful direct fetch of `rsee.ir` itself
but inability to find a store listing) that also failed to surface any RSEE review — a different
failure mode reaching the same open gap, which is weak corroborating evidence the gap is real
rather than an artifact of one session's particular tooling limits, but is not proof.

## What this means for the audit line

The task's 50-review volume target was **not met** — 0 reviews were read this session, and 0 have
ever been read for RSEE across all Scout sessions to date, despite RSEE being the single most
important Iran-tier competitor in this research programme (the only live dedicated head-on
competitor). The single highest-value unresolved action for a future session is unchanged from
the base profile plus one addition: (1) get `WebFetch` or `WebSearch` actually working, (2) run
the full query list left un-run above (package-name guesses, `site:` operators on Cafe Bazaar and
Myket specifically, Persian complaint-phrase exact-match searches), and (3) if a listing is truly
never found, treat "no discoverable independent review corpus for Iran's only live reservation
competitor" as a first-class finding in its own right, worth surfacing to the founder directly,
rather than as a residual gap in a footnote.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (both `EGRESS_BLOCKED`):** `https://example.com` (control), `https://rsee.ir`
(primary target).

**Proxy diagnostic (per this environment's own instructions):**
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` — exit code `0` — confirmed `connect_rejected` /
"gateway answered 403 to CONNECT" for `cafebazaar.ir:443`, `myket.ir:443`,
`play.google.com:443`, `example.com:443`, all timestamped `2026-09-07T05:57:17–18Z`.

**WebSearch (both rejected — session budget exhausted at 200/200 before either query returned a
result):** `آرسی rsee.ir نظرات کاربران`; `اپلیکیشن آرسی رزرو میز رستوران دانلود`.

## Sources (prior sessions, cited not re-verified this session)

`docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
dedicated competitor, and its model is the story" and §"What I did NOT verify (whole file)"
(2026-09-05, `[fetched]` pass against `rsee.ir` directly) — full source for every RSEE fact
restated above. `docs/audit/research/MATRIX.md` footnote 56, which points back to the same
profile section. See that profile for its complete list of URLs reached (`rsee.ir` root
`[fetched]`; `rsee.ir/plans`, `/rules`, `/faq` `[fetched — negative result, HTTP 404]`) and its
own explicit list of unverified items.
