# Foodism — Store Reviews at Volume (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_
_Mode: STORE REVIEWS AT VOLUME (target: 50+ recent real user reviews)_

## Read-first: what prior research already established

Per task instructions I read `docs/audit/research/profiles/foodism.md` in full (base profile,
2026-09-05, plus its own same-day ADDENDUM) before starting. No matching `corpus/foodism/` file
existed yet (this is the first one — the directory did not exist until this session created it).
Summary of what the profile already carries, so this corpus does not re-litigate it:

- **Identity confirmed:** `foodism.app` / Android package `app.foodism.tech`, Persian
  restaurant/cafe discovery-and-review social app. Four unrelated same-name products (Foodism UK,
  Foodism.xyz/Connect India, "Local Foodism App" US, Foodium) were ruled out in the base profile —
  not re-checked this session, no reason found to doubt that identity work.
- **Base profile (batch 1, 2026-09-05, `WebFetch` blocked that pass):** Myket reported via
  `WebSearch` synthesis at **4/5 stars, 216 reviews**. Zero verbatim individual reviews found by
  that session despite differently-worded searching. Cafe Bazaar listing's existence confirmed,
  its rating/count not obtainable.
- **ADDENDUM (batch 3, same date 2026-09-05, `WebFetch` worked that session):**
  `cafebazaar.ir/app/app.foodism.tech` now returns **HTTP 404** (three attempts, two URL forms;
  not a site-wide outage — `cafebazaar.ir/app/com.fidilio` fetched fine in the same minute).
  `myket.ir/app/app.foodism.tech` fetched live: **4.3/5 over 226 reviews, 25,000 installs, last
  updated ۱۴۰۱/۰۹/۱۰** (≈2022-12-01). **First and only verbatim Foodism review ever obtained** in
  this research line: **معصومه, ۳ خرداد ۱۴۰۵** (≈2026-05-24): **«کار نمیکنه»** — "it doesn't
  work." Status was set to **DEGRADED — likely abandoned, not confirmed dead**.
- **`MATRIX.md`** (footnote 62, "Product currently live and maintained" row) already reflects this
  DEGRADED status and the 404/226-review/2022-binary facts — consistent with the profile, no
  contradiction to flag there either.

This corpus's job was to extend that to 50+ reviews. It could not — see below — and the reason is
a tooling failure specific to this session, documented in full so a future session knows exactly
what was and wasn't tried.

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (a
neutral control) and immediately after against the primary target
`https://myket.ir/app/app.foodism.tech` (the one source the 2026-09-05 ADDENDUM had successfully
fetched two days earlier).

| Tool call | Result |
|---|---|
| `WebFetch https://example.com` | `EGRESS_BLOCKED` |
| `WebFetch https://myket.ir/app/app.foodism.tech` | `EGRESS_BLOCKED` |
| `WebFetch https://cafebazaar.ir/app/app.foodism.tech` | `EGRESS_BLOCKED` |
| `WebFetch https://play.google.com/store/apps/details?id=app.foodism.tech&hl=fa` | `EGRESS_BLOCKED` |
| `WebFetch https://apps.apple.com/ir/app/foodism/id0?see-all=reviews` | `EGRESS_BLOCKED` |
| `WebFetch https://web.archive.org/web/2026/https://cafebazaar.ir/app/app.foodism.tech` | distinct error: `Claude Code is unable to fetch from web.archive.org` (tool-level domain refusal, not a proxy block) |

**`webfetch_worked = false` for this session.** The `example.com` control confirms a blanket
network-egress policy for this session (same conclusion the sibling **2026-09-07** `fidilio`
`store-reviews.md` corpus reached the same day), in contrast to the **2026-09-05** session that
produced this profile's ADDENDUM, where `WebFetch` worked and read Myket + Cafe Bazaar directly.

Per the task's fallback rule, the next step should have been many differently-phrased `WebSearch`
queries. **That fallback was also unavailable this session**, which is the one material
difference from the sibling `fidilio` session run the same day:

| Query attempted | Result |
|---|---|
| `فودیسم نظرات کافه بازار` | *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| `فودیسم کار نمیکنه` | same — budget exhausted |
| `myket.ir/app/app.foodism.tech نظرات کاربران` | same — budget exhausted |
| `فودیسم اپلیکیشن باگ مشکل شکایت` | same — budget exhausted |
| `"Foodism" Iran app reviews complaints restaurant` | same — budget exhausted |
| `foodism.tech reviews` | same — budget exhausted (tried again after the archive.org probe, in case the count display was stale — it was not) |

**`websearch_worked = false` for this session too — 0 of 6 attempted queries returned results.**
The message is explicit and session-scoped ("200 of 200 WebSearch calls"), not per-query or
per-domain: this session's shared search quota was already fully consumed before my first query
ran, almost certainly by other work in the same broader Scout batch (parallel sibling sessions
profiling other competitors on 2026-09-07 — the git log for this session shows `fidilio` and
`smartx` corpus work landing minutes before this task started). I did not fabricate or infer any
search-synthesis content to work around this — per the task's own rule, "0 is a valid answer" and
padding is explicitly forbidden.

**Net result: this session had zero live research capability of any kind** — neither a direct
fetch nor a search-engine query succeeded even once. This is a strictly worse tooling position
than the sibling `fidilio` `store-reviews.md` corpus from the same day, which had `WebFetch`
blocked but `WebSearch` working (35 queries ran, though they too surfaced no *new* verbatim
review text). I am not aware of any other tool available to me that reaches the open web.

## Findings this session: none new — full honesty check

**`reviews_read = 0` for this session.** I did not personally read a single review, page, or
search result. Every one of the six external-network tool calls above failed before returning any
content. I am reporting this as 0, not omitting it or padding it with restated prior-session
content presented as if newly obtained.

## Prior evidence carried forward (NOT re-verified this session — full citation to source)

The only Foodism review evidence that exists anywhere in the Scout research line comes from the
**2026-09-05** session that produced `profiles/foodism.md`'s ADDENDUM, where `WebFetch` worked.
Reproduced here for continuity, exactly as that session recorded it, with its own evidence label
kept intact (fetched = it, not me, read the page):

**Source (fetched directly by the 2026-09-05 session):**
[myket.ir/app/app.foodism.tech](https://myket.ir/app/app.foodism.tech)

| Field | Value as printed, 2026-09-05 (fetched) |
|---|---|
| Rating | 4.3 / 5 |
| Review count | 226 |
| Installs | 25,000 |
| Last updated | ۱۴۰۱/۰۹/۱۰ (my Gregorian conversion, carried from the source session: ≈2022-12-01) |

**Source (attempted directly by the 2026-09-05 session, three times, two URL forms):**
[cafebazaar.ir/app/app.foodism.tech](https://cafebazaar.ir/app/app.foodism.tech) — **HTTP 404**.
Not a site-wide outage: the same session fetched `cafebazaar.ir/app/com.fidilio` successfully in
the same minute, so this is specific to Foodism's Cafe Bazaar listing.

**The single verbatim review known in this entire research line:**

1. **معصومه — ۳ خرداد ۱۴۰۵** (my conversion, carried from the source session: ≈2026-05-24)
   > «کار نمیکنه»
   "It doesn't work."

**Earlier (batch 1, 2026-09-05, before the fetch-capable session ran that same day) `WebSearch`
synthesis figure, superseded in part by the fetch above but recorded for the trend line:** Myket
reported at **4/5 stars, 216 reviews** — i.e., the rating moved 4.0→4.3 and the review count moved
216→226 between the two 2026-09-05 sub-sessions, meaning the listing is not frozen even though the
underlying **binary is a 2022 build**. No individual review text was obtained in that earlier
sub-session.

**Total known-and-cited Foodism reviews across all Scout sessions to date: 1** (against a
background of 226 Myket ratings as of 2026-09-05) — under 0.5% of the rated population has any
quoted text attached to it. **This session adds zero to that total.**

## What this session could NOT do (explicit gap list)

1. Could not re-open Myket to check whether the rating/count/install figures have moved since
   2026-09-05, could not paginate past whatever the listing's default review view shows, and could
   not confirm whether "معصومه"'s review is still the most recent or has been superseded.
2. Could not re-check Cafe Bazaar to see if the HTTP 404 persists (two days later) or was a
   transient listing removal/re-submission — this is a meaningfully open question given Iranian
   app-store listings can be pulled and reinstated.
3. Could not attempt Google Play (`hl=fa` / `hl=en`) — no session in this entire research line has
   confirmed or ruled out a Play Store listing for `app.foodism.tech`.
4. Could not attempt apkpure, apkcombo, uptodown, or aptoide comment pages — never attempted
   successfully by any session for Foodism.
5. Could not attempt `apps.apple.com` (`?see-all=reviews`) — iOS presence remains
   **UNKNOWN — not verified**, same as the base profile already states.
6. Could not attempt Trustpilot, G2, Capterra, GetApp, or Sitejabber for `foodism.app` — no
   session has checked these directly for Foodism (the base profile's Trustpilot/G2 gap was noted
   for *Fidilio*, not searched for Foodism specifically at all, in any session).
7. Could not attempt Instagram (`@foodism.iran`) or Facebook comment threads.
8. Could not attempt `appreview.ir` or `charkhoneh.com` directly (the base profile only has these
   as `WebSearch`-synthesized app-intro content, never a direct fetch, in any session).
9. **No restaurant-owner-side review or complaint attempted this session** — this gap is
   unchanged from the base profile.
10. **No 2026 (1405)-dated review beyond the single known one was sought or found** — the single
    known review (۳ خرداد ۱۴۰۵ / 2026-05-24) remains the most recent dated evidence of any kind in
    the whole Foodism research line.

## Contradiction check against the existing profile

None found. Nothing this session touched (because nothing succeeded) could contradict
`profiles/foodism.md` or its ADDENDUM. The DEGRADED status, the 404 Cafe Bazaar finding, and the
Myket 4.3/5-over-226-reviews/25,000-installs/۱۴۰۱-binary figures all stand exactly as that session
left them, now simply two days older and unconfirmed as still-current.

## What this means for the audit line

The task's 50-review volume target was **not met** — 1 review total is documented across the whole
Scout research line for Foodism, and this session could not advance that number by even one,
because **both** of the two evidence-gathering tools available to it failed completely: `WebFetch`
returned `EGRESS_BLOCKED` on every domain tried (including the neutral `example.com` control, and
including `web.archive.org`, which failed with a distinct tool-level refusal rather than a proxy
block), and `WebSearch` reported its session-wide quota already exhausted (200 of 200) before a
single query of mine could run. This is a **tooling-availability finding, not a diligence
failure or a product finding** — it says nothing new about Foodism itself, only that this
particular session had no path to the open web. A future session should: (a) confirm it has
`WebSearch` budget remaining before starting, since that quota is evidently shared across
sibling sessions running the same day; (b) if `WebFetch` works, prioritize re-opening
`myket.ir/app/app.foodism.tech` and re-testing whether `cafebazaar.ir/app/app.foodism.tech` is
still HTTP 404 two-plus days on, since that 404 is the single most consequential fact in this
whole profile (a primary Iranian app store dropping the listing) and has not been re-checked
since it was first observed.

## Sources (this session)

All access attempted 2026-09-07; every attempt failed as tabulated above, so no source content was
actually read this session:

- `https://example.com` (control) — `EGRESS_BLOCKED`
- `https://myket.ir/app/app.foodism.tech` — `EGRESS_BLOCKED`
- `https://cafebazaar.ir/app/app.foodism.tech` — `EGRESS_BLOCKED`
- `https://play.google.com/store/apps/details?id=app.foodism.tech&hl=fa` — `EGRESS_BLOCKED`
- `https://apps.apple.com/ir/app/foodism/id0?see-all=reviews` — `EGRESS_BLOCKED`
- `https://web.archive.org/web/2026/https://cafebazaar.ir/app/app.foodism.tech` — tool-level
  refusal (`Claude Code is unable to fetch from web.archive.org`)
- 6 `WebSearch` queries (listed in the methodology table above) — all refused with "web search
  budget (200 of 200) used," zero results returned

## Sources (prior session, cited not re-verified)

`docs/audit/research/profiles/foodism.md` — full base profile (2026-09-05) and its same-day
ADDENDUM, which fetched `https://myket.ir/app/app.foodism.tech` and attempted
`https://cafebazaar.ir/app/app.foodism.tech` directly (three times, two URL forms, HTTP 404). See
that file for its own full source list, including the base profile's ~20 `WebSearch`-only sources
(`foodism.app`, `mag.foodism.app`, `webna.ir`, `appetan.ir`, `appreview.ir`, `charkhoneh.com`,
`tahlilgar.com`, `rajanews.com`/`namehnews.com`/`ilna.ir` listicles, `iwmf.ir`) and
`docs/audit/research/MATRIX.md` footnote 62, which already reflects the same DEGRADED status.
