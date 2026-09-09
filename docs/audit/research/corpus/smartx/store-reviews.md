# SmartX — Store Reviews at Volume (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SmartX (اسمارت ایکس), key `smartx`, tier `iran`_
_Mode: STORE REVIEWS AT VOLUME (target: 50+ recent real user reviews)_

## Prior art read first (per task instructions)

`docs/audit/research/profiles/smartx.md` (2026-09-04 base pass + 2026-09-05 first-hand-fetch
addendum) was read in full before starting this pass. Relevant to *this* mode specifically, that
profile already states, and this session did not contradict:

- SmartX is B2B software sold to restaurant/café owners through POS resellers (Sepidz, Sepidar
  Sistem, Vendo) — diners never touch a SmartX-branded surface; there is no self-serve consumer
  app-store discovery motion for it.
- The only mobile listing found anywhere, in any session, is a staff/manager companion app on
  Myket: `myket.ir/app/com.smartx`, gated to existing SmartX account holders at login. That
  listing's existence was itself only established via `WebSearch` synthesis in the 2026-09-04
  session — no session to date has opened the page directly.
- **No Cafe Bazaar listing was found** for the restaurant product — the only Cafe Bazaar hit for
  the string "SmartX" is an unrelated Bluetooth smartwatch/fitness-tracker companion app, ruled
  out as a naming collision in the Identity-check section of the profile.
- **No G2, Capterra, Trustpilot, GetApp, or Sitejabber presence was found** — expected for an
  Iran-only B2B SaaS product with no international payment/support relationship, and confirmed
  absent by search rather than assumed.
- **Zero independent, verifiable, verbatim reviews — from diners or from restaurant
  owners/staff — have been found by any prior session.** The profile's "Review synthesis"
  section explicitly declines to fill in complaint/praise templates for this reason and instead
  documents the one first-party, dated signal found: SmartX's own `/sorry/` apology-titled page
  (Customer Club disruptions, Mordad 1404 / ≈ Jul–Aug 2025), whose 2026-09-05 first-hand fetch
  narrowed the finding to "title-level admission only" — the page body contains no description
  of the incident.
- Rating, review count, and install count for the Myket listing were **never obtained** by any
  prior session — flagged explicitly as an open gap in the profile's "What I did NOT verify"
  section.

This session's job was to extend that with a dedicated, high-volume review pass. It did not
succeed in adding a single new review — see methodology below — so nothing above is
contradicted, only reconfirmed as still-unresolved.

## Methodology — read this before the findings below (both primary tools were unavailable)

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (a
neutral control) and then against the primary target URL for this mode,
`https://myket.ir/app/com.smartx` (the only confirmed SmartX app listing from prior research).

| # | URL tested | Purpose | Result |
|---|---|---|---|
| 1 | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `https://myket.ir/app/com.smartx` | Primary target (confirmed listing) | `EGRESS_BLOCKED` |
| 3 | `https://cafebazaar.ir/app/com.smartx` | Check Cafe Bazaar under the plain package guess | `EGRESS_BLOCKED` |
| 4 | `https://play.google.com/store/apps/details?id=com.smartx&hl=fa` | Google Play | `EGRESS_BLOCKED` |
| 5 | `https://www.trustpilot.com/review/smartx.ir` | Trustpilot | `EGRESS_BLOCKED` |
| 6 | `https://myket.ir/app/com.smartx?l=en` | Myket, English locale variant | `EGRESS_BLOCKED` |
| 7 | `https://www.g2.com/search?query=smartx+restaurant` | G2 | `EGRESS_BLOCKED` |
| 8 | `https://apkpure.com/smartx/com.smartx` | APKPure mirror | `EGRESS_BLOCKED` |
| 9 | `https://apps.apple.com/ir/app/smartx/id0` | iOS App Store | `EGRESS_BLOCKED` |

**Conclusion: `webfetch_worked = false` for this session.** The `example.com` control (row 1)
confirms this is a blanket network-egress policy for this session, not a per-domain or
per-site block — identical to the pattern the concurrent Fidilio pass recorded the same day
(`docs/audit/research/corpus/fidilio/store-reviews.md`). No direct page read was possible for
any source.

**Fallback attempted, per protocol, and found equally unavailable:** the task instructs falling
back to `WebSearch` with many differently-phrased queries when `WebFetch` is blocked. Four
queries were issued before any could return a result:

1. `myket.ir/app/com.smartx نظرات`
2. `اسمارت ایکس رستوران نظرات کاربران`
3. `"اسمارت ایکس" باشگاه مشتریان شکایت مشکل`
4. `site:cafebazaar.ir smartx رستوران`

All four returned the identical tool response: *"Web search was not performed: this session has
used its web search budget (200 of 200 WebSearch calls). Continue with the information already
gathered instead of issuing more searches."* This is a **session-level** budget (not a per-call
or per-competitor one) — per the task brief, other Scout sessions write to this same repository
concurrently, and this session's `WebSearch` allotment was already fully consumed before this
task's first query could execute. Retrying was not productive: the same exhaustion message
returned on the first attempt and would return identically on any further attempt within this
session.

**Net result: this session had zero working channel to the open web.** `WebFetch` returned
`EGRESS_BLOCKED` on every domain tested including the neutral control; `WebSearch` returned a
budget-exhaustion notice on every query attempted, before a single search result was ever seen.
Per the audit constitution's rule that "we don't know" must never be reported as "zero found in
the world" — this is reported as a **tooling-availability gap for this session**, not as
confirmation that no SmartX reviews exist anywhere.

## Reviews read this session: 0

Per the task's own rule ("Never invent... 0 is a valid answer" / "Never pad to hit a target"),
this is reported plainly. No review — Myket, Cafe Bazaar, Google Play, Trustpilot, G2, Capterra,
GetApp, Sitejabber, apkpure/apkcombo/uptodown/aptoide, appreview.ir, charkhoneh, or any other
source named in the task brief — was opened or read by this session. No verbatim quote, no
reviewer handle, no star rating, and no review date was obtained.

## Store facts — status this session

**No field in this table could be independently confirmed or refreshed this session** (every
source is unreachable, as documented above). Restated from `profiles/smartx.md`, with its own
original dating kept explicit, so this file does not silently imply fresher data than exists:

| Field | Value | As of | Status |
|---|---|---|---|
| Myket listing (`myket.ir/app/com.smartx`) existence | Confirmed to exist, gated to existing account holders at login | 2026-09-04 (WebSearch synthesis, never opened directly by any session) | REAL (listing exists) — but never fetched first-hand |
| Myket aggregate rating | **UNKNOWN — not verified.** Never surfaced by any session's search or fetch. | — | Open gap, unchanged this session |
| Myket rating/review count | **UNKNOWN — not verified.** | — | Open gap, unchanged this session |
| Myket install band | **UNKNOWN — not verified.** | — | Open gap, unchanged this session |
| Myket app last-updated date | **UNKNOWN — not verified.** | — | Open gap, unchanged this session |
| Cafe Bazaar listing for the restaurant product | **ABSENT** — only an unrelated same-named smartwatch app found under "SMARTx" | 2026-09-04 (WebSearch) | Confirmed absent, not merely unreached — this session could not re-test the query directly but found nothing to contradict it |
| Google Play listing | Never found in any session | — | UNKNOWN — not verified (plausible absence, given Iranian-app sanctions patterns, but not confirmed) |
| iOS App Store listing | Never found in any session | — | UNKNOWN — not verified |
| Trustpilot page for `smartx.ir` | Never found in any session | — | UNKNOWN — not verified whether page genuinely doesn't exist (as was confirmed for Fidilio's domain) or was simply never reached |
| G2 / Capterra / GetApp / Sitejabber listing | Never found in any session | — | UNKNOWN — not verified, though plausible-absent by category (Iran-only B2B SaaS, no international presence) |

## Complaint themes — honest sample sizes

**None can be reported with a sample size greater than zero.** No theme in this file is backed
by a single review this session or any prior session actually read for SmartX. This is
different from, and weaker than, the Fidilio line of research, where a 2026-09-05 session with
working `WebFetch` did read 3 verbatim Cafe Bazaar reviews (6 total across all sessions,
against a known population of 581 ratings). **For SmartX, across all three dated Scout
sessions to date (2026-09-04, 2026-09-05, 2026-09-07/this one), the count of independently
read, verbatim, user-authored reviews remains exactly zero.**

The only dated, first-party (not third-party/user) negative signal in the entire SmartX
research line remains the one already documented in `profiles/smartx.md`: the `smartx.ir/sorry/`
page, HTML `<title>` = «اختلالات باشگاه مشتریان | مرداد ماه ۱۴۰۴» (Customer Club disruptions,
Mordad 1404 ≈ 2025-07-23 to 2025-08-22), first-hand-fetched 2026-09-05, with the correction that
its *body* contains no description of the incident and no explicit apology text — only a
goodwill/retention message ("سه ویژگی رایگان جدید این هفته"). This is **not** a user review and
is not re-listed here as a complaint theme; it is a company-authored page about itself, cited
above under "Prior art" for continuity only.

### Top complaints
UNKNOWN — not verified. `reviews_read = 0` this session; no prior session ever read a user
review of SmartX either (contrast with Fidilio, which has 6). There is no sample to draw a
theme or a count from.

### Top praises
UNKNOWN — not verified. Same reason as above.

## Interpretation — is "zero reviews found" itself a finding?

Flagging this as an honest inference, clearly separated from confirmed fact: three independent
Scout research sessions, spanning three different dates and (for this session) genuinely
different tooling states (session 1 had `WebSearch` only; session 2 had working `WebFetch`;
session 3/this one had neither), have now converged on the same result for SmartX specifically —
**no user-authored review text has ever surfaced**, for a product whose own profile establishes
it is distributed exclusively through B2B reseller channels (POS partners Sepidz, Sepidar
Sistem, Vendo) rather than through a self-serve "search the store, read reviews, install" motion
that would organically generate an app-store review corpus. That structural explanation is
plausible and consistent with everything else known about SmartX's go-to-market, but it remains
an **inference**, not a confirmed fact — a review corpus could exist behind a listing this
session's tools simply could not reach (Myket in particular, whose listing is confirmed to exist
but whose contents no session has ever opened). This session did not resolve that ambiguity and
is not claiming to.

## Contradiction check against the existing profile

None found. This session surfaced no new data of any kind — nothing to confirm or contradict
`profiles/smartx.md`'s existing claims. The one thing this session adds is procedural: a third,
independent confirmation attempt that also failed to surface any SmartX review, strengthening
(without proving) the "no discoverable public review corpus" reading above.

## What this means for the audit line

The task's 50-review volume target was **not met** — 0 reviews were read this session, and 0
have ever been read for SmartX across all Scout sessions to date. Unlike the Fidilio line
(where a 2026-09-05 session with working `WebFetch` reached 3 first-hand reviews before this
session's tooling regressed), the SmartX line has **never once** had a session where both (a)
`WebFetch` worked and (b) a review-bearing page was actually opened. The single highest-value
unresolved action for a future session remains unchanged from the base profile: get `WebFetch`
working against `myket.ir/app/com.smartx` specifically (the one confirmed listing) and read
whatever review content, rating, and install count actually render there — that would be the
first first-hand data point in this entire research line, positive or negative.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (all `EGRESS_BLOCKED`, listed with target and purpose in the methodology table
above):** example.com (control), myket.ir/app/com.smartx, cafebazaar.ir/app/com.smartx,
play.google.com/store/apps/details?id=com.smartx&hl=fa, trustpilot.com/review/smartx.ir,
myket.ir/app/com.smartx?l=en, g2.com/search?query=smartx+restaurant, apkpure.com/smartx/com.smartx,
apps.apple.com/ir/app/smartx/id0.

**WebSearch (all rejected — session budget exhausted at 200/200 before any query returned a
result):** `myket.ir/app/com.smartx نظرات`; `اسمارت ایکس رستوران نظرات کاربران`; `"اسمارت ایکس"
باشگاه مشتریان شکایت مشکل`; `site:cafebazaar.ir smartx رستوران`.

## Sources (prior sessions, cited not re-verified this session)

`docs/audit/research/profiles/smartx.md` — full profile (2026-09-04 base pass, `WebSearch`-only)
and its 2026-09-05 ADDENDUM (first-hand `WebFetch` reads of `smartx.ir/pricing/` and
`smartx.ir/sorry/`, neither of which is a user review page). See that file for its own complete
source list, including the six ruled-out "SmartX" naming collisions and the Sepidz/Hamkaran
Sistem partner-channel evidence that underpins the "no self-serve review motion" inference above.
`docs/audit/research/WATCH.md` (lines referencing SmartX, 2026-09-05 entries) — read and
confirmed to add no review-specific content beyond what `profiles/smartx.md` already states.
