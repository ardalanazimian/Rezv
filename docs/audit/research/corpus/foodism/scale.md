# Foodism — Users, Sales & Scale (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_
_Mode: USERS, SALES, SCALE (install bands per store, rating+review counts per store,
MAU/registered users company-claimed-vs-independent, website traffic estimates, venue/restaurant
counts, cities, funding rounds and investors, revenue/GMV, acquisition prices, headcount, and
CURRENT job postings as roadmap signal)_

## Read-first: what prior research already established

Per task instructions I read, in full, before starting:
- `docs/audit/research/profiles/foodism.md` — base profile (2026-09-05) + same-day ADDENDUM
  (status change to DEGRADED).
- `docs/audit/research/corpus/foodism/store-reviews.md` (2026-09-07, earlier same-day session,
  mode STORE REVIEWS AT VOLUME) — total tooling failure that session (`WebFetch` blocked on every
  domain including the `example.com` control; `WebSearch` reported quota exhausted, "200 of 200,"
  before its first query ran; `reviews_read = 0`).
- `docs/audit/research/corpus/foodism/social.md` (2026-09-07, also earlier same-day) — identical
  total tooling failure for the SOCIAL AND FORUMS mode; `reviews_read = 0` there too.
- `docs/audit/research/MATRIX.md` (footnotes 47–55, 62; "Coverage status" section;
  "Foodism's column is real but thin, and now degrading" closing line).
- Also grepped `ANTI-PATTERNS.md`, `BRIEF-2026-09-05.md`, `BRIEF-2026-09-05-batch3.md`,
  `PARITY-RISK.md`, `STATUS-2026-09-07.md`, `WATCH.md`, `recon-notes-global.md`, and
  `corpus/_discovery-round1.md` for any Foodism scale-specific figure not already in the base
  profile — **none found beyond what the base profile and its ADDENDUM already carry.**

Summary of what already exists, so this corpus does not re-litigate it (full detail and sourcing
in `profiles/foodism.md`, reproduced with citation under "Prior evidence carried forward" below,
not re-verified this session):

- **Identity confirmed:** `foodism.app` / Android package `app.foodism.tech`, Persian
  restaurant/cafe discovery-and-review social app. Four unrelated same-name products ruled out.
- **Status: DEGRADED — likely abandoned, not confirmed dead** (set 2026-09-05 ADDENDUM).
  `cafebazaar.ir/app/app.foodism.tech` returned HTTP 404 (three attempts, two URL forms, fetched
  directly); `myket.ir/app/app.foodism.tech` was live and fetched directly: 4.3/5 over 226 reviews,
  25,000 installs, last updated ۱۴۰۱/۰۹/۱۰ (≈2022-12-01) — a ~3¾-year-old binary as of this date.
- **Two prior sessions today (2026-09-07)** — `store-reviews.md` and `social.md` — independently
  hit and documented the exact same total tooling failure this session also hits (see below):
  `WebFetch` returns `EGRESS_BLOCKED` on every domain including the neutral control, and
  `WebSearch` reports its shared session-wide quota already at 200/200 before any query of theirs
  ran. Both predicted a third session (this one) would likely hit the same wall and recommended
  confirming budget before starting — this session did that check first, per protocol, and the
  prediction held.

This corpus's job was to extend the above with SCALE-specific evidence: install bands, MAU,
website traffic, venue/city counts, funding/investors, revenue/GMV, acquisition prices, headcount,
and current job postings. **It could not add anything new** — see Methodology below — for the same
reason the two earlier sessions today could not: total tool-access failure, confirmed
independently by this session rather than assumed from the sibling files.

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (neutral
control) and immediately after against this mode's primary target, the one page in this entire
research line previously confirmed to carry live numeric install/rating data
(`myket.ir/app/app.foodism.tech`, fetched successfully by the 2026-09-05 ADDENDUM session).

| Tool call | Result |
|---|---|
| `WebFetch https://example.com` | `EGRESS_BLOCKED` — "Access to example.com is blocked by the network egress proxy." |
| `WebFetch https://myket.ir/app/app.foodism.tech` | `EGRESS_BLOCKED` — "Access to myket.ir is blocked by the network egress proxy." |

**`webfetch_worked = false` for this session.** The `example.com` control result confirms a
blanket network-egress policy for this session — the identical result the two earlier 2026-09-07
sibling sessions (`store-reviews.md`, `social.md`) each independently recorded — in contrast to
the **2026-09-05** session that produced the base profile's ADDENDUM, where `WebFetch` worked and
fetched Myket + Cafe Bazaar directly (the 25,000-installs / 4.3-over-226 / HTTP-404 figures below
all trace back to that one working session, not this one).

Per the task's fallback rule, the next step is many differently-phrased `WebSearch` queries
(Persian and English, `site:` operators, exact-phrase hunts), targeting this mode's specific asks:
MAU, funding/investors, revenue/GMV, headcount, job postings.

| Query attempted | Result |
|---|---|
| `فودیسم اپلیکیشن کاربران فعال` (active users) | *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| `Foodism Iran app users MAU installs` | same — budget exhausted |
| `Foodism Iran funding investors Crunchbase` | same — budget exhausted |

I stopped at three (rather than continuing to burn calls against a session-wide quota already
reported at its hard ceiling on the first attempt) because the message is explicit, identical
across all three differently-worded/differently-languaged queries, and session-scoped rather than
per-query or per-domain — the same signature the two earlier sessions today independently
diagnosed as a shared quota exhausted by concurrent sibling Scout research batches (`fidilio`,
`smartx`, and now `foodism` all running full multi-mode passes through 2026-09-07). A fourth or
fifth query would not have told me anything the first three didn't already establish.

**`websearch_worked = false` for this session — 0 of 3 attempted queries returned results.**

**Net result: this session had zero live research capability of any kind for the SCALE mode** —
neither a direct fetch nor a search-engine query succeeded even once. I am not aware of any other
tool available to me that reaches the open web (no LinkedIn, job-board, Crunchbase, Similarweb, or
Trustpilot MCP/API tool is present in this session's toolset — see the full deferred-tool list
surfaced this session, none of which resolves to a company-data or web-search provider beyond the
two already tested).

## Findings this session: none new — full honesty check

**`reviews_read = 0` for this session.** I did not personally read a single app-store page,
company page, LinkedIn profile, job posting, Crunchbase/Tracxn entry, or traffic-estimate report.
Both external-network tool calls (`WebFetch`) and all three `WebSearch` calls failed before
returning any content. I am reporting every SCALE metric below as either "prior evidence, carried
forward with citation, not re-verified this session" or "UNKNOWN — not verified" — never as newly
obtained, and never padded to fill the mode's target categories.

## Prior evidence carried forward (NOT re-verified this session — full citation to source)

Organized by this mode's own categories. Every figure below is reproduced from
`profiles/foodism.md` (2026-09-05 + same-day ADDENDUM) exactly as that session recorded it, with
its own evidence label kept intact. **None of it was re-fetched or re-searched by this session** —
where I have nothing to add, I say so explicitly rather than silently repeating the number as if
newly confirmed.

### Install bands per store

| Store | Install band | Evidence label | Source session/date |
|---|---|---|---|
| Myket (`myket.ir/app/app.foodism.tech`) | **25,000 installs** (exact figure as printed on the listing, not a Play-Store-style band) | `fetched` directly | 2026-09-05 ADDENDUM |
| Cafe Bazaar (`cafebazaar.ir/app/app.foodism.tech`) | **N/A — listing returns HTTP 404**, no install figure obtainable | `fetched` directly (three attempts, two URL forms) | 2026-09-05 ADDENDUM |
| Google Play (`play.google.com/store/apps/details?id=app.foodism.tech`) | **UNKNOWN — not verified.** No session in this research line has successfully opened this listing. | — | never attempted successfully |
| Apple App Store | **UNKNOWN — not verified.** No Iran-region iOS listing found or confirmed absent in any prior session. | — | never resolved |

This session could not attempt to refresh the 25,000-installs figure (two days old as of this
write-up) or re-check whether the Cafe Bazaar 404 persists — both would require `WebFetch`, which
failed on its very first test this session.

### Rating + review counts per store

| Store | Rating | Review count | Evidence label | Date |
|---|---|---|---|---|
| Myket | **4.3 / 5** | **226** | `fetched` directly | 2026-09-05 (ADDENDUM) |
| Myket (earlier same-day reading) | 4 / 5 | 216 | `search-synthesis` (WebSearch, pre-ADDENDUM) | 2026-09-05 (batch 1) |
| Cafe Bazaar | **N/A — 404** | **N/A — 404** | `fetched` directly | 2026-09-05 (ADDENDUM) |
| Google Play | UNKNOWN | UNKNOWN | — | never obtained |

Note (carried forward from `store-reviews.md`, not re-derived this session): the rating moved
4.0→4.3 and the review count moved 216→226 **within the same day** (2026-09-05, between the
WebSearch-synthesis batch and the fetch-capable ADDENDUM batch) — the listing itself is not frozen
even though the underlying **binary is dated ۱۴۰۱/۰۹/۱۰ (≈2022-12-01)**, a ~3¾-year-old build.

**Only one verbatim review exists in this entire research line** (all modes, all sessions):
**معصومه — ۳ خرداد ۱۴۰۵** (my Gregorian conversion, carried forward unchanged: **≈2026-05-24**):
> «کار نمیکنه»
"It doesn't work." — `fetched` directly, 2026-09-05 ADDENDUM, via `myket.ir/app/app.foodism.tech`.

### MAU / registered users (company-claimed vs. independent)

All three figures below are **company-claimed or search-synthesis-sourced**, not independent
counts, and they **conflict with each other** — this internal inconsistency was already flagged in
the base profile and I am not attempting to reconcile it, only re-stating it under this mode's
explicit "company-claimed vs. independent" framing:

| Figure | Label | Source / date |
|---|---|---|
| **"70,000+"** registered members (site + app combined) | company-claimed, `search-synthesis` | one syndicated article dated 1399/2020 |
| **"100,000+ users"** | company-claimed, `search-synthesis` | separate search synthesis, **no date attached** |
| **"500,000+ monthly website visits"** | company-claimed (traffic self-report, not a third-party traffic-estimate tool), `search-synthesis` | same undated source as the 100,000-users figure |

**No independent MAU/registered-user figure exists anywhere in this research line** — every number
above is either the company's own marketing copy or a syndicated article restating it, never a
store-side "X million downloads" band (Myket's 25,000 raw install count is the closest thing to an
independent, store-side figure, and it is two orders of magnitude below the "70,000+" claim, which
is itself an inconsistency worth flagging: 25,000 installs on the one Android store confirmed
still live cannot alone substantiate "70,000+ registered members," though the two figures aren't
strictly contradictory either since Cafe Bazaar/Play/iOS install counts, if any, are all unknown
and could close the gap).

### Website traffic estimates (Similarweb/SEMrush/Ahrefs)

**UNKNOWN — not verified, in every prior session and this one.** No session in this research
line — including this one — has queried Similarweb, SEMrush, Ahrefs, or any other third-party
traffic-estimation source for `foodism.app` or `mag.foodism.app`. The only traffic-adjacent figure
that exists anywhere is the company's own "500,000+ monthly website visits" claim above, which is
self-reported, not a third-party tool estimate, and cannot substitute for one. This is a clean gap,
not a searched-and-absent finding.

### Venue/restaurant counts and cities

| Figure | Label | Source |
|---|---|---|
| **"8,000+" venues** (restaurants, cafes, fast food, bakeries, juice/ice-cream shops, protein shops, food courts) | company-claimed, `search-synthesis` | `webna.ir`, `appetan.ir`, `charkhoneh.com` |
| **"9,000+" venues** | company-claimed, `search-synthesis`, conflicting with the above | a separate, differently-worded search synthesis |
| **~29 cities/provinces** claimed covered | company-claimed, `search-synthesis` | Tehran, Karaj, Kish, Mashhad, Shiraz, Isfahan, Ahvaz, Tabriz, Urmia, Zanjan, Qazvin, Ardabil, Sarein, Kashan, Qom, Yazd, Arak, Qeshm, Bushehr, Bojnord, Bandar Abbas, Yasuj, Shahrekord, Kermanshah, Abadan, Kerman, Hamadan, Gorgan, plus Lorestan/Kurdistan/Gilan(Rasht)/Mazandaran — see base profile for full list |

The base profile already flags the 8,000-vs-9,000 discrepancy explicitly; I am re-stating it here
under this mode's own remit rather than treating it as newly discovered. **No independent
(non-company-sourced) venue count exists anywhere in this research line** — every figure is
company marketing copy or a syndicated restatement of it.

### Funding rounds and investors (Crunchbase/Tracxn/press)

**UNKNOWN — not verified.** No session, including this one, found any funding round, investor
name, valuation, or press release naming an investment in Foodism. The base profile's inference —
"a small, likely bootstrapped operation" — rests entirely on **absence of evidence** (a single
founder with an Instagram-page-turned-app origin story, no company-registration name found, no
funding article found despite searching) and is explicitly labeled there as an inference, not a
confirmed fact. This session could not query Crunchbase or Tracxn directly (no MCP/API access to
either in this session's toolset, and `WebSearch`/`WebFetch` were both unavailable for a manual
site check). **Restating: UNKNOWN — not verified**, not "no funding" — absence of evidence is not
evidence of absence, per the task's own rule.

### Revenue or GMV (filings, press, estimates)

**UNKNOWN — not verified.** The base profile already establishes the revenue *model* (free basic
directory listing; paid "advertising packages... with good returns" for restaurants, contact-only,
no published price list found anywhere) but **no revenue or GMV figure of any kind** — claimed,
estimated, or filed — exists in this research line. Given the product has no in-app payment/
ordering/reservation flow at all (confirmed ABSENT in the base profile's feature inventory), GMV in
the conventional sense (transaction volume through the platform) may not even be a meaningful
metric for Foodism as currently shipped — advertising-package revenue would be the only plausible
revenue line, and its size is entirely unknown.

### Acquisition prices

**N/A — not applicable.** No acquisition of or by Foodism was found or claimed anywhere in this
research line; nothing to report as UNKNOWN versus N/A here specifically because no search or
context (including Iranian tech-press coverage searched in the base profile) ever surfaced an M&A
angle to investigate in either direction.

### Headcount (LinkedIn / job boards)

**UNKNOWN — not verified.** No prior session attempted a LinkedIn company-page or job-board search
for Foodism specifically (the base profile's "What I did NOT verify" list names "employee count...
none found" as a gap already, but that reflects general search, not a targeted LinkedIn attempt).
This session could not attempt one either — `WebFetch` failed on `linkedin.com` was not even
individually tested this session (the `example.com` control failure made it clear no domain would
resolve, so I did not spend a call confirming the predictable outcome on a specific domain not
previously tried), and `WebSearch` was exhausted before a LinkedIn-specific query could run.

### Current job postings (roadmap signal: ML, growth, payments roles)

**UNKNOWN — not verified.** No prior session has checked any Iranian job board (Jobinja, e-Estekhdam)
or Foodism's own site/Instagram for open roles. This session could not either, for the same reason
as headcount above. Given the DEGRADED status already established (2022 binary, 404'd Cafe Bazaar
listing, single dated 2026 review reading "it doesn't work"), a genuinely useful signal here would
be **whether Foodism is hiring at all** — active engineering/growth job postings would meaningfully
complicate the "likely abandoned" read, while confirmed zero postings across the standard Iranian
job boards would reinforce it. **This is the single most consequential open question for this
specific mode** and remains completely untested.

## What this session could NOT do (explicit gap list, mode-specific)

1. Could not re-fetch Myket to confirm whether the 25,000-installs / 4.3-over-226 figures have
   moved in the two-plus days since 2026-09-05.
2. Could not re-check whether the Cafe Bazaar 404 persists or was a transient pull.
3. Could not attempt Google Play or Apple App Store listings for install/rating data (attempted
   and failed by no session yet — remains genuinely unresolved, not merely unconfirmed).
4. Could not query Similarweb, SEMrush, Ahrefs, or any other traffic-estimation tool/site for
   `foodism.app` or `mag.foodism.app` — zero attempts across the entire research line, this
   session included.
5. Could not query Crunchbase, Tracxn, or Iranian startup-funding press (e.g., Peyvast, Digiato
   funding-tag pages) for any Foodism funding/investor mention.
6. Could not query LinkedIn (company page, employee list, or individual profiles) for headcount.
7. Could not query Jobinja, e-Estekhdam, or any Iranian job board for current Foodism postings —
   the mode's explicit "roadmap signal" ask is entirely unaddressed.
8. Could not attempt any revenue/GMV estimate source (no filings exist for a private Iranian
   startup of this size in any public register I have access-tool support for; press-estimate
   search was blocked along with everything else).
9. Could not reconcile the 8,000-vs-9,000 venue count or the 70,000-vs-100,000-vs-500,000 user/
   traffic figures — both remain flagged inconsistencies, not resolved ones.
10. Could not test whether the app is still installable/functional today (2026-09-07) beyond the
    store-listing metadata already on record — no hands-on device/emulator tool is available to
    this session.

## Contradiction check against existing profile and corpus

**None found.** Nothing this session touched (because nothing succeeded) could contradict
`profiles/foodism.md`, its ADDENDUM, `corpus/foodism/store-reviews.md`, or `corpus/foodism/
social.md`. Every figure restated above — the 25,000 installs, 4.3/5-over-226-reviews, HTTP 404 on
Cafe Bazaar, the single «کار نمیکنه» review, the 8,000-vs-9,000 venue discrepancy, and the
70,000/100,000/500,000 conflicting scale claims — stands exactly as those prior sessions left it,
now two-plus days older and unconfirmed as still-current on every axis this mode was asked to
cover.

One clarification worth flagging (not a contradiction, a precision note): the base profile's
"Business model & pricing" section already listed the three conflicting scale figures
(70,000/100,000/500,000) in passing; this corpus is the first document in the research line to
organize them explicitly under the "company-claimed vs. independent" framing this mode's task brief
requires, and to state plainly that **zero independent figures exist for any of the three.** That
is a sharpening of an existing finding, not a new one and not a contradiction of it.

## What this means for the audit line

The SCALE mode's goals — install bands, MAU (company-claimed vs. independent), website traffic
estimates, venue/city counts, funding/investors, revenue/GMV, acquisition prices, headcount, and
current job postings — were **not met by new research this session**. This is the **third
consecutive 2026-09-07 Foodism corpus session** (after `store-reviews.md` and `social.md`) to hit
total tool failure: `WebFetch` returns `EGRESS_BLOCKED` on every domain tested including the
neutral `example.com` control, and `WebSearch` reports its shared session-wide quota already at
200/200 before any query belonging to this session could run. This is a **tooling-availability
finding, not a diligence failure or a product finding** — it says nothing new about Foodism's
actual scale, only that three sessions running through the same shared budget on the same day had
no path to the open web for their assigned modes.

Of this mode's nine target categories, prior sessions (specifically the fetch-capable 2026-09-05
ADDENDUM session) had already substantively covered exactly two — **install bands** (Myket only)
and **rating+review counts** (Myket only) — plus partial, conflicting, company-claimed-only
coverage of **MAU/registered-users** and **venue/city counts**. The remaining five categories —
**website traffic estimates, funding/investors, revenue/GMV, acquisition prices, headcount, and
job postings** — have **zero evidence of any kind, from any session, in this entire research
line.** Job postings in particular (this mode's explicit "roadmap signal") is a complete blank
that a future session with working `WebSearch` should prioritize first, since — combined with the
already-established DEGRADED status — it is the single fastest way to test whether Foodism is
still an operating company at all.

**Recommendation for a future session on this exact task:** confirm remaining `WebSearch` budget
before starting (now independently confirmed exhausted by three separate 2026-09-07 sessions on
three different modes); if budget exists, prioritize, in order: (a) an Iranian job-board search
(Jobinja, e-Estekhdam) for any current Foodism posting — the single fastest live/dead signal
available; (b) a LinkedIn company-page search for headcount; (c) a funding/investor search
(Crunchbase, Tracxn, Persian startup-funding press); (d) a Similarweb/SEMrush/Ahrefs traffic
estimate for `foodism.app`; (e) re-fetching Myket to see if the 25,000-installs figure has moved
at all in the intervening days, which would itself be a live/dead signal independent of a job
search.

## Sources (this session)

All access attempted 2026-09-07; every attempt failed as tabulated above, so no source content was
actually read this session:

- `https://example.com` (control) — `EGRESS_BLOCKED`
- `https://myket.ir/app/app.foodism.tech` — `EGRESS_BLOCKED`
- 3 `WebSearch` queries (`فودیسم اپلیکیشن کاربران فعال`; `Foodism Iran app users MAU installs`;
  `Foodism Iran funding investors Crunchbase`) — all refused with "web search budget (200 of 200)
  used," zero results returned

## Sources (prior sessions, cited not re-verified)

- `docs/audit/research/profiles/foodism.md` — full base profile (2026-09-05) and its same-day
  ADDENDUM. Original source list there includes `foodism.app`, `mag.foodism.app`,
  `cafebazaar.ir/app/app.foodism.tech`, `myket.ir/app/app.foodism.tech`,
  `play.google.com/store/apps/details?id=app.foodism.tech`, `instagram.com/foodism.iran/`,
  `facebook.com/Foodism.iran/`, `webna.ir/35889/foodism-app-intro`, `appetan.ir` (Foodism review
  article), `appreview.ir` (Foodism social-network article), `charkhoneh.com/content/930727370`,
  `tahlilgar.com` (B2B profile aggregator, no headcount/founding data extractable),
  `rajanews.com`/`namehnews.com`/`ilna.ir` (IWMF award listicles, flagged as likely syndicated),
  `iwmf.ir` (searched for independent award confirmation, none found).
- `docs/audit/research/corpus/foodism/store-reviews.md` (2026-09-07, earlier same-day) — same
  total tooling-failure pattern this session independently reproduced.
- `docs/audit/research/corpus/foodism/social.md` (2026-09-07, earlier same-day) — same pattern.
- `docs/audit/research/MATRIX.md` footnotes 47–55, 62 — no new scale-specific figures beyond what
  the base profile already carries; grepped and cross-checked, no contradiction found.
- Also grepped for any Foodism mention (scale-relevant or otherwise) in `ANTI-PATTERNS.md`,
  `BRIEF-2026-09-05.md`, `BRIEF-2026-09-05-batch3.md`, `PARITY-RISK.md`, `STATUS-2026-09-07.md`,
  `WATCH.md`, `recon-notes-global.md`, `corpus/_discovery-round1.md` — nothing SCALE-specific
  beyond what is already reproduced above.
