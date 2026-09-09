# SnappFood — Users, Sales & Scale (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SnappFood (اسنپ‌فود), key `snappfood`, tier `iran`_
_Mode: USERS, SALES, SCALE (installs, ratings/reviews, MAU, traffic, venues/cities, funding, revenue/GMV,
acquisitions, headcount, current job postings)_

## Headline finding — read this before anything else

**This session gathered zero new evidence.** Both mandated evidence channels were tested myself,
independently, at the start of this pass, per protocol — not inherited as an assumption from the
sibling same-day sessions below, though the result matches theirs exactly:

- `WebFetch` → `EGRESS_BLOCKED` on the neutral control (`https://example.com`) **and** on the primary
  target for this mode (`https://cafebazaar.ir/app/com.zoodfood.android`, SnappFood's Cafe Bazaar
  listing — the install-band/rating source the task hints name first).
- `WebSearch` → **4 of 4** queries this session, spanning Persian and English and covering distinct
  SCALE sub-asks (install counts, MAU, job postings, funding), returned the tool's own verbatim
  budget-exhausted message: *"this session has used its web search budget (200 of 200 WebSearch
  calls). Continue with the information already gathered instead of issuing more searches. If more
  searches are genuinely needed, ask the user to raise CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION."*

This is the same shared-session budget wall already reported by three same-day (2026-09-07) sibling
corpus passes — `corpus/snappfood/business.md`, `corpus/snappfood/store-reviews.md`, and
`corpus/snappfood/social.md` — each of which independently confirmed `WebFetch` `EGRESS_BLOCKED` and
`WebSearch` at 200/200 before their own first query ran. My own four calls (two `WebFetch`, four
`WebSearch`, see table below) reproduce the wall on fresh queries targeted specifically at this mode's
checklist, not by assumption. Per the task's own rule ("0 is a valid answer" / "never pad to hit a
target"), **`reviews_read = 0`** for this session, and no install-count band, rating, MAU figure,
traffic estimate, funding round, revenue figure, headcount number, or job posting was newly fetched or
newly searched this session.

**`webfetch_worked = false`. `websearch_worked = false`.**

## Methodology — first action taken, per protocol

**Step 1 — WebFetch test (control + this mode's primary target):**

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` (neutral control) | `EGRESS_BLOCKED` — "Access to example.com is blocked by the network egress proxy." |
| 2 | `https://cafebazaar.ir/app/com.zoodfood.android` (primary target — Cafe Bazaar listing, the task's own first-named hint for install bands + ratings) | `EGRESS_BLOCKED` — "Access to cafebazaar.ir is blocked by the network egress proxy." |

The control failing identically to the real target confirms a blanket session-level network-egress
block, not a per-domain one — the same finding every prior SnappFood-touching session has recorded
(`profiles/snappfood-loyalty.md`, 2026-09-04; `corpus/snappfood/business.md`,
`corpus/snappfood/store-reviews.md`, `corpus/snappfood/social.md`, all 2026-09-07). I did not spend
further `WebFetch` calls on this mode's other named targets (Myket, Google Play, Snapp Group corporate
pages, Crunchbase/Tracxn/LinkedIn/SimilarWeb) once the 2/2 blanket-block pattern was confirmed —
extrapolating from a confirmed control+target block to the rest matches how every sibling session in
this corpus tree has treated the identical situation.

**Step 2 — WebSearch fallback, per the task's own instruction ("if EGRESS_BLOCKED, fall back to
WebSearch with MANY differently-phrased queries"):**

I ran 4 queries, deliberately spanning this mode's distinct sub-asks (install counts, MAU/registered
users, job postings/roadmap signal, funding/investment) rather than repeating a sibling session's exact
query text, to test whether the budget wall was truly universal or query-sensitive:

| # | Query | Angle | Result |
|---|---|---|---|
| 1 | `اسنپ فود نصب کافه بازار تعداد نصب` | Cafe Bazaar install-count band | Budget-exhausted (200/200) |
| 2 | `SnappFood MAU registered users 2026 million` | Company-claimed/independent user base | Budget-exhausted (200/200) |
| 3 | `"Snapp Food" OR "SnappFood" jobs careers hiring machine learning growth` | Current job postings (roadmap signal) | Budget-exhausted (200/200) |
| 4 | `اسنپ فود سرمایه‌گذاری تامین مالی جذب سرمایه` | Funding/investment rounds | Budget-exhausted (200/200) |

All four returned the identical canned message, confirming this is a hard session-wide call-count cap,
not a per-query or per-topic restriction. I stopped after 4 (rather than running the full battery of
differently-phrased queries the task otherwise mandates) because a 5th, 6th, or 20th call against an
already-confirmed hard numeric cap (200/200, not "temporarily rate-limited") would not produce different
evidence — it would only re-confirm what is already conclusively established, at the cost of a tool
call. This mirrors the judgment call every sibling session in this same corpus tree already made (2–8
queries each, all stopping once the ceiling was confirmed rather than exhausting further batches against
a channel already reported closed).

**`websearch_worked = false` for this session (0 of 4 queries returned any content).**

## Prior evidence carried forward — mapped against THIS mode's exact checklist

No prior Scout session was ever scoped to SCALE specifically for SnappFood. The only prior material
touching any scale-adjacent fact is `profiles/snappfood-loyalty.md` (2026-09-04, loyalty-scoped) and the
two SnappFood entries in `WATCH.md` (2026-09-04). Everything below is re-presented mapped explicitly
onto this mode's checklist, each item labeled exactly as its source session labeled it — nothing is
upgraded in confidence by being restated here. Every checklist item with no prior material is marked
UNKNOWN rather than silently omitted.

### 1. Install bands per store (exact string as printed)

**UNKNOWN — not verified, for every store.** No prior Scout session ever surfaced a Cafe Bazaar, Myket,
or Google Play install-count band (e.g. Cafe Bazaar's own "+۱۰,۰۰۰,۰۰۰" style string) for
`com.zoodfood.android`. This mode's own attempt to reach Cafe Bazaar directly was blocked before any
string could be read (Step 1, row 2). No exact install-band string exists anywhere in this research
line for SnappFood on any store.

### 2. Rating + review counts per store

| Store | Rating | Review/comment count | Label | Source & date |
|---|---|---|---|---|
| Myket | **4.3 / 5** | **19,209 comments** | search-synthesis — the synthesis described sentiment as "relatively positive... good discounts, diverse restaurants, appropriate packaging and food quality," but **the specific source URL was never surfaced or pinned** by the originating session, which itself flagged this as a weaker-sourced figure | via `profiles/snappfood-loyalty.md`, accessed 2026-09-04; re-confirmed as still the only figure available by `corpus/snappfood/store-reviews.md`, 2026-09-07 |
| Cafe Bazaar | **UNKNOWN — not verified** | **UNKNOWN — not verified** | — | Multiple targeted queries across two prior sessions (2026-09-04 and 2026-09-07) failed to surface a specific star rating or review count for `cafebazaar.ir/app/com.zoodfood.android`, despite the same query pattern successfully surfacing Fidilio's Cafe Bazaar figure (3.7/5, 578 ratings) in an earlier batch. This is a real, repeated gap, not an assumption of good or bad standing. |
| Google Play | **UNKNOWN — not verified** | **UNKNOWN — not verified** | — | Never reached by any session; Iran-sanctions context makes Google Play availability itself unconfirmed (per `corpus/snappfood/store-reviews.md`'s note that even an Apple App Store listing's existence is unconfirmed) |
| App Store (iOS) | **UNKNOWN — whether a listing exists at all** | **UNKNOWN** | — | Never established by any session; `corpus/snappfood/store-reviews.md` flags this explicitly as unconfirmed either way |

**Zero individually-quoted, dated, named-reviewer reviews exist anywhere in the SnappFood research line
to date** — confirmed explicitly by both `corpus/snappfood/store-reviews.md` and `corpus/snappfood/social.md`
(both 2026-09-07). The Myket 4.3/19,209 figure above is the single most concrete rating datum this
entire research line has ever produced for SnappFood, and it is search-synthesis, not a page anyone
read.

### 3. MAU / registered users (company-claimed vs. independent)

**No company-claimed MAU or registered-user figure has ever been found** by any Scout session — no
SnappFood press release, annual-report-style disclosure, or app-store "About" text naming a user count
has surfaced.

**The single strongest available proxy is independent, but traces to a criminal claim, not an audited
count — this distinction matters and is stated precisely:**

- Following a **December 2023 data breach** (10 Dey 1402 / ≈2023-12-31–2024-01), a hacker group calling
  itself **IRLeaks** claimed to have exfiltrated SnappFood's full database, reportedly comprising
  **20M+ users** (username, password, email, name, mobile, birthdate), **880M+ product orders**,
  **160M+ courier trips**, and **240k+ vendor records**. [Per `WATCH.md`, 2026-09-04 entry, citing
  Shahr-e Sakht-Afzar (`shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked`), Digiato
  (`digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform`), Farnet
  (`farnet.io/1402/10/351276/snappfood-hacked/`), and Tasnim News
  (`tasnimnews.com/fa/news/1402/10/10/3014883/`)]
- **What is REAL/independent vs. what is an unverified criminal claim, precisely:** SnappFood itself
  issued a public statement **confirming a partial breach of user data**, and separately stated
  bank-card details are not stored in its database — that confirmation is company-claimed but
  corroborated by four independent news outlets reporting on the same incident, so the **occurrence of
  a breach** is REAL/independent. The **exact counts** (20M+ users, 880M+ orders, 160M+ courier trips,
  240k+ vendors) are **the attacker's own claim**, reported by press covering the hacker's sale listing
  — SnappFood's own statement did not itself confirm those specific numbers, per the sourcing available
  in this research line. **Label these counts: independent (multi-outlet-reported), but sourced to an
  unaudited attacker claim, not a company-disclosed or regulator-verified figure.** Treat as a scale
  *proxy* — plausible order-of-magnitude evidence that SnappFood's registered-user base was at least in
  the tens-of-millions range as of late 2023 — not a precise, verified MAU number.
- **This is nonetheless the best available scale signal in the entire SnappFood research line** for
  three of this mode's specific asks at once: registered users (20M+), order volume (880M+, an
  order-count proxy for GMV/sales activity), and vendor/restaurant count (240k+ — see venue-count
  section below). No fresher (2024–2026) figure of any kind, company-claimed or independent, has
  surfaced to update or contradict this Dec-2023 snapshot.
- **UNKNOWN — not verified:** any MAU figure distinct from total registered accounts (a registered-user
  count and a monthly-active count are different things, and only the former has any source at all);
  any 2024–2026 trend (growth, decline, or stagnation) since the breach snapshot.

### 4. Website traffic estimates (Similarweb/SEMrush/Ahrefs)

**UNKNOWN — not verified, and never attempted by any prior session.** No prior Scout pass ever searched
for a Similarweb, SEMrush, or Ahrefs traffic estimate for `snappfood.ir`. This mode's own attempt could
not reach the search stage (budget exhausted before query #1 on this specific angle could be tried —
queries 1–4 above covered installs/MAU/jobs/funding, not traffic-estimator tools specifically, so this
sub-item has literally zero attempts logged against it across the whole research line).

### 5. Venue/restaurant counts, cities

- **The strongest available proxy, again from the Dec-2023 breach disclosure (independent-but-
  attacker-claimed, per the precision caveat in section 3 above): 240k+ vendor records** — read as a
  vendor/restaurant-and-retailer count across SnappFood's full multi-category listing (restaurants,
  cafes, bakeries, supermarkets, pharmacies, etc., per `profiles/snappfood-loyalty.md`'s description of
  SnappFood's category breadth), not restaurants alone. **This is not a restaurant-only count** — no
  source anywhere in this research line breaks the 240k+ figure down by category, so treating it as
  "240k+ restaurants" would overstate what is actually known. Correctly stated: **240k+ total vendor
  records across all categories SnappFood lists**, as of the Dec-2023 breach snapshot.
- **City/coverage-area count: UNKNOWN — not verified.** No prior session searched for or found how many
  Iranian cities SnappFood operates in. General references describe it as nationally dominant, but no
  session has a sourced city count or list.

### 6. Funding rounds and investors (Crunchbase/Tracxn/press)

**UNKNOWN — not verified. No prior Scout session ever searched Crunchbase, Tracxn, or press for a
SnappFood funding round or investor list**, and this session's own attempt (query 4 above,
`اسنپ فود سرمایه‌گذاری تامین مالی جذب سرمایه`) could not run — budget-exhausted before any result
loaded. Contrast: the sibling `profiles/fidilio.md` and `profiles/servme.md` corpora both cite specific
Crunchbase/Tracxn URLs for their respective competitors (`crunchbase.com/organization/fidilio`,
`tracxn.com/d/companies/fidilio/`, `crunchbase.com/organization/servme`); no equivalent SnappFood URL
has ever been found or attempted successfully. What is known only *structurally*, not as a sourced
funding fact: SnappFood was formed via ZoodFood's 1396 (2017) merger into the Snapp Group
super-app ecosystem (ride-hailing Snapp, Snapp Market, Snapp Pay, Snapp Express, etc.) — per
`profiles/snappfood-loyalty.md`'s business-model summary — which means SnappFood's own funding history,
if any exists as a standalone entity distinct from Snapp Group's, is not a question any source in this
research line has addressed at all.

### 7. Revenue or GMV (filings, press, estimates)

**UNKNOWN — no direct revenue or GMV figure exists anywhere in this research line.** The closest proxy
is the breach-disclosed **880M+ product orders** figure (section 3 above) — an order-count, not a Toman
revenue or GMV figure, and itself an unaudited attacker claim as of a single Dec-2023 snapshot, with no
average-order-value figure available to convert it into an estimated GMV. The only revenue-*adjacent*
fact in this research line is the **15–20% restaurant commission rate + 9% VAT on that commission**,
itself only a third-party estimate (`restobazar.com/mag/snapp-food-rules-for-restaurants/`, via
`profiles/snappfood-loyalty.md`), not SnappFood's own disclosed rate — and even combined with the order
count, no source computes or estimates an actual revenue/GMV number from these two pieces. Doing so
myself would be fabricating a figure no source stated; **left as UNKNOWN** rather than computed.

### 8. Acquisition prices

**Not applicable in the standard sense, and UNKNOWN where it might apply.** SnappFood itself was formed
via a **merger** (ZoodFood into the Snapp Group, 1396/2017), not documented anywhere in this research
line as a priced acquisition — no merger/acquisition price has ever been found or searched for. No
source describes SnappFood acquiring any other company, nor any outside party acquiring or attempting to
acquire SnappFood or Snapp Group. **UNKNOWN — not verified**, distinct from "no such event occurred,"
which this research line cannot confirm either way.

### 9. Headcount (LinkedIn/job boards)

**UNKNOWN — not verified. No prior session has ever opened, or attempted to open, a SnappFood or Snapp
Group LinkedIn company page**, unlike the SmartX research line, which did attempt (and hit
`EGRESS_BLOCKED` on) `ir.linkedin.com/company/smartxacc` (`corpus/smartx/social.md`, 2026-09-07). No
SnappFood-equivalent LinkedIn URL has ever been identified or attempted by any session, this one
included — this mode's own `WebFetch` calls were spent on the control + Cafe Bazaar (this mode's
higher-priority ask), and `WebSearch` budget was exhausted before a LinkedIn-specific query could run.

### 10. Current job postings (roles open — ML, growth, payments — as roadmap signal)

**UNKNOWN — not verified. Zero job postings of any kind have ever been found for SnappFood** by any
Scout session. This session's query 3 (`"Snapp Food" OR "SnappFood" jobs careers hiring machine
learning growth`) was written specifically for this sub-ask and returned the budget-exhausted message
before any result could load — the one query in this entire research line explicitly aimed at this
checklist item, and it produced zero content. No roadmap signal of any kind (ML, growth, payments, or
otherwise) can be drawn from job postings for SnappFood based on anything gathered to date.

## Contradiction check against existing profiles

**None found.** This session produced no new claims to contradict `profiles/snappfood-loyalty.md`,
`corpus/snappfood/business.md`, `corpus/snappfood/store-reviews.md`, or `corpus/snappfood/social.md`.
The Myket 4.3/19,209 figure is carried forward with the identical "search-synthesis, unsourced URL"
label its originating session used — not silently upgraded to a firmer status. The breach-derived
20M+/880M+/160M+/240k+ figures are carried forward from `WATCH.md` with a **new, more precise caveat
added by this session** (distinguishing "breach occurred" as company-confirmed/independent from "exact
counts" as an unaudited attacker claim) — this is a refinement of precision, not a contradiction of the
prior framing, which did not draw that distinction as sharply. No prior session mischaracterized the
counts as company-verified, so nothing here corrects an error — it sharpens a label that was previously
merely "independent" into "independent-but-attacker-sourced," which is a stricter, not looser, standard.

## What this mode's evidence checklist required and could not be attempted this session

1. Cafe Bazaar's actual install-band string and rating/review count for `com.zoodfood.android` — not
   reached, `WebFetch` blocked.
2. Myket's and Google Play's install-band strings — not attempted (extrapolated from the confirmed
   blanket block after the Cafe Bazaar + control test).
3. Any SimilarWeb/SEMrush/Ahrefs traffic-estimate page or search result — never attempted by any
   session to date, including this one.
4. Crunchbase, Tracxn, or press coverage of a SnappFood-specific (as opposed to Snapp-Group-wide)
   funding round — budget-exhausted before query 4 could return a result.
5. Snapp Group or SnappFood LinkedIn company page — never attempted by any session.
6. Any job board, careers page, or LinkedIn Jobs listing for SnappFood/Snapp Group roles — budget-
   exhausted before query 3 could return a result; this is the one sub-ask this session wrote a
   query specifically for, and it is the one that produced literally zero content.
7. Any revenue, GMV, or valuation figure from filings, press, or analyst estimates — never found or
   directly searched for by any session to date.
8. A 2024–2026 update to the Dec-2023 breach-snapshot user/order/vendor counts — never found; the
   Dec-2023 figures remain the most recent scale data of any kind in this research line.

## Sources

**Attempted, not reached (WebFetch, both `EGRESS_BLOCKED`), accessed 2026-09-07:**
- https://example.com (control)
- https://cafebazaar.ir/app/com.zoodfood.android (primary target for this mode)

**Attempted, not reached (WebSearch, budget exhausted at 200/200 on all 4), accessed 2026-09-07:**
- `اسنپ فود نصب کافه بازار تعداد نصب`
- `SnappFood MAU registered users 2026 million`
- `"Snapp Food" OR "SnappFood" jobs careers hiring machine learning growth`
- `اسنپ فود سرمایه‌گذاری تامین مالی جذب سرمایه`

**Prior evidence cited, not re-verified this session:**
- `docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04) — Myket 4.3/19,209 figure; business-
  model/merger-into-Snapp-Group summary; 15–20%+9%VAT commission-range claim.
- `docs/audit/research/WATCH.md` (2026-09-04 entries) — the Dec-2023/Jan-2024 IRLeaks breach disclosure
  (20M+ users, 880M+ orders, 160M+ courier trips, 240k+ vendor records) and the Competition Council
  ruling No. 740; original sources: Shahr-e Sakht-Afzar
  (`shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked`), Digiato
  (`digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform`), Farnet
  (`farnet.io/1402/10/351276/snappfood-hacked/`), Tasnim News
  (`tasnimnews.com/fa/news/1402/10/10/3014883/`).
- `docs/audit/research/corpus/snappfood/business.md` (2026-09-07, same-day) — confirms identical
  tool-availability wall for commission/pricing/contract-terms mode.
- `docs/audit/research/corpus/snappfood/store-reviews.md` (2026-09-07, same-day) — confirms identical
  wall for store-reviews mode; zero individually-quoted reviews exist in the research line.
- `docs/audit/research/corpus/snappfood/social.md` (2026-09-07, same-day) — confirms identical wall for
  social/forums mode; zero individually-quoted social posts exist in the research line.
- `docs/audit/research/profiles/fidilio.md`, `docs/audit/research/profiles/servme.md` — cited only for
  contrast (both have Crunchbase/Tracxn URLs; SnappFood has none in this research line).
- `docs/audit/research/corpus/smartx/social.md` — cited only for contrast (attempted a LinkedIn URL for
  SmartX; no SnappFood-equivalent URL has ever been attempted).

## What I did NOT verify

1. **No new page or search result this session** — `WebFetch` blocked on control + primary target (2/2);
   `WebSearch` budget exhausted on all 4 attempts spanning this mode's distinct sub-asks. This is the
   master gap behind every numbered item below.
2. Any store install-count band (Cafe Bazaar, Myket, Google Play, App Store) — zero found across the
   entire SnappFood research line, this session included.
3. Cafe Bazaar's rating and review count specifically — unresolved across three separate sessions now
   (2026-09-04, 2026-09-07 ×2, this session ×1) despite repeated targeted attempts.
4. The Myket 4.3/19,209 figure's exact source URL and current-as-of date — still unpinned.
5. Any MAU figure distinct from total registered accounts, and any 2024–2026 trend since the Dec-2023
   breach snapshot (growth, decline, or stagnation) — no fresher figure of any kind exists.
6. Any website-traffic estimate (Similarweb/SEMrush/Ahrefs) — never attempted by any session to date.
7. Any SnappFood-specific (vs. Snapp-Group-wide) funding round, investor, or valuation — never found.
8. City/coverage-area count — never found; only a qualitative "nationally dominant" characterization
   exists, unsourced to a specific number.
9. Any revenue or GMV figure or estimate — never found or computed (deliberately not estimated from the
   order-count + commission-rate proxies, since no source performs that calculation).
10. Any acquisition made by or of SnappFood/Snapp Group, and any price — never found; genuinely unknown
    whether such an event exists, not assumed absent.
11. Headcount from any source — never found or attempted.
12. Current job postings of any kind — the one query in this whole research line built specifically for
    this ask returned zero content.
13. Whether the 240k+ vendor-records figure breaks down by category (restaurants specifically vs. the
    full multi-category listing) — no source provides this breakdown; presented here as a total, not a
    restaurant-only count.
14. Whether SnappFood's own statement on the Dec-2023 breach corroborated the attacker's specific counts
    (20M+/880M+/160M+/240k+) or only confirmed that a breach occurred — no source in this research line
    quotes SnappFood's statement verbatim on this point, so the counts remain labeled as attacker-claimed
    rather than company-confirmed.

## Structured-output note

`reviews_read = 0`. `webfetch_worked = false`. The `numbers` field in the structured summary carries only
what is actually sourced above: `users_claimed` = the Dec-2023 breach-disclosed "20M+ users" (labeled
independent-but-attacker-claimed, not company-claimed, not a proper MAU), with every other `numbers`
sub-field (`revenue`, `funding`, `installs`, `rating`, `review_count`, `venues`, `last_updated`,
`pricing`) either UNKNOWN or populated only with the caveats stated in the relevant section above. The
`complaints`/`praises` arrays are empty — this mode is about scale metrics, not sentiment, and no new
review or complaint was read this session (see the sibling `store-reviews.md`/`social.md` corpora for
the sentiment-mode findings, already logged there with their own honest zero). `key_claims` draws only
from the prior-evidence table above, each labeled by its evidence type exactly as derived in this file —
nothing has been silently upgraded in confidence by being restated here.
