# Fidilio — Users, Sales, Scale (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_
_Mode: USERS, SALES, SCALE (installs, ratings/reviews, MAU, traffic, venues/cities, funding/investors,
revenue/GMV, acquisitions, headcount, current job postings)_

## Read-first: what prior research already established

Per task instructions, before starting I read (in full): `docs/audit/research/profiles/fidilio.md`
(main profile + its 2026-09-05 ADDENDUM), `docs/audit/research/MATRIX.md` (Fidilio's cells and
footnotes 1, 16, 17, 32, 61), and this competitor's three same-day (2026-09-07) prior corpus files —
`business.md`, `social.md`, `store-reviews.md`. Those already establish, and are **not** repeated here
except where this session found something materially new or contradictory:

- **Cafe Bazaar (fetched first-hand 2026-09-05):** app name «فیدیلیو | سفارش غذا», rating **۳.۷ از ۵**,
  **۵۸۱ رأی** (581 ratings), **۱۱۰,۰۰۰ installs**, category «آشپزی و رستوران». 6 reviews total known
  across all sessions (3 fetched verbatim + 3 search-synthesized), all dated Sept–Oct 2025.
- **Funding (2026-09-04, search-synthesis):** a Shenasa-led round around Fidilio's "10th year"
  (Digiato, dated 2019-01-14); Tracxn's own summary (as surfaced then) said Fidilio "has raised funding
  from **1 investor**"; amount UNKNOWN.
- **Headcount, MAU, website traffic, venue/city counts, revenue/GMV, job postings:** none of this was
  in any prior Fidilio document. This corpus is the **first** pass targeting these specifically.
- **Company's own marketing claims (search-synthesis, undated landing copy):** "12,500+ restaurants,
  10,000+ cafes, 5,000+ bakeries" and a "4.9-star" rating — flagged in the prior profile as
  inconsistent with the independently-observed Cafe Bazaar aggregate (3.7/5) and never reconciled.

## Methodology header

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (control)
and immediately after against the primary target `https://cafebazaar.ir/app/com.fidilio`.

| URL | Result |
|---|---|
| `https://example.com` | `EGRESS_BLOCKED` |
| `https://cafebazaar.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://fidilio.com.cutestat.com/` | `EGRESS_BLOCKED` |
| `https://tracxn.com/d/companies/fidilio/...` | `EGRESS_BLOCKED` |
| `https://pitchbook.com/profiles/company/498038-41` | `EGRESS_BLOCKED` |
| `https://jobinja.ir/companies/fidilio/jobs` | `EGRESS_BLOCKED` |
| `https://www.irantalent.com/en/company/fidilio/.../overview` | `EGRESS_BLOCKED` |
| `https://jobvision.ir/companies/19393/...` | `EGRESS_BLOCKED` |
| `https://play.google.com/store/apps/details?hl=en_CA&id=com.fidilio` | `EGRESS_BLOCKED` |
| `https://myket.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://www.zoominfo.com/c/fidilio/460494450` | `EGRESS_BLOCKED` |
| `https://www.crunchbase.com/organization/fidilio` | `EGRESS_BLOCKED` |

**`webfetch_worked = false` for this session** (12 of 12 attempts blocked, including the neutral
`example.com` control — a blanket network-egress policy, not a per-domain block). This matches the
other three 2026-09-07 corpus sessions for this competitor and contrasts with the 2026-09-05 session
that produced the profile's ADDENDUM, where `WebFetch` worked. Per the task's fallback rule, everything
below came from `WebSearch`, and every finding is marked **search-synthesis** unless noted otherwise.
Only text that appeared inside quotation marks in a search result is treated as a verbatim quote;
everything else is paraphrase and is labeled as such.

**⚠️ Session-wide WebSearch budget was exhausted mid-pass.** After 19 queries this session (listed
below), the 20th call returned: *"this session has used its web search budget (200 of 200 WebSearch
calls)."* That cap is evidently shared across this whole Claude Code session (which, per the volume of
same-day 2026-09-07 corpus files already on disk from other Scout passes, includes prior research in
this same session/environment), not reset per research pass. Four planned queries — independent venue
count, city-coverage expansion, Series-A round date/amount detail, and additional job-board sweep
(Quera/Karboom) — could **not** be run. This is reported honestly as a tooling-availability limit, not
silently worked around and not disguised as "not found."

### Queries run this session (19, all WebSearch, before the budget cap)

1. فیدیلیو کاربر فعال ماهانه تعداد کاربران
2. Fidilio Iran monthly active users MAU registered users
3. fidilio.com similarweb traffic estimate
4. فیدیلیو تعداد رستوران کافه شهرها پوشش شهر
5. fidilio.com traffic rank visitors per month semrush ahrefs
6. "Fidilio" crunchbase funding round investors
7. "Fidilio" tracxn revenue employees headcount
8. linkedin.com/company/fidilio employees
9. فیدیلیو استخدام نیرو برنامه نویس فرصت شغلی
10. فیدیلیو استخدام jobvision karboom quera
11. "Fidilio" GMV revenue Iran million toman rial درآمد
12. Fidilio pitchbook "$837" OR "837K" OR "837,000" funding raised
13. "فن آوری تجارت هوشمند لاوین" فیدیلیو
14. جاب ویژن فیدیلیو "طراح گرافیک" یا "کارشناس فروش" استخدام تهران
15. jobvision.ir فیدیلیو "لاوین" استخدام گرافیست تاریخ آگهی
16. Fidilio Rubika investment شناسا روبیکا سرمایه گذاری فیدیلیو
17. فیدیلیو myket.ir نصب رأی امتیاز
18. Fidilio Google Play com.fidilio installs rating
19. myket.ir/app/com.fidilio "نصب" تعداد رأی امتیاز آخرین بروزرسانی

Queries 20–23 (not run, budget exhausted): independent restaurant/venue count; city expansion
(Karaj/Mashhad/Isfahan/Shiraz); Series A round date/amount; Quera/Karboom job-board sweep.

---

## Findings

### 1. Install bands and ratings — now THREE stores, not one (Google Play confirmed to exist for the first time)

This is the single largest advance this session makes on the prior corpus. Every earlier Fidilio
session (2026-09-04, -05, and the three 2026-09-07 passes read above) explicitly logged Google Play
and Myket as **UNKNOWN — not verified** for existence, let alone metrics. This session's query #18
surfaced and confirmed a **live Google Play listing**:

| Store | App name (as printed) | Rating | Rating count | Installs (exact string) | Evidence type |
|---|---|---|---|---|---|
| **Cafe Bazaar** (`cafebazaar.ir/app/com.fidilio`) | «فیدیلیو \| سفارش غذا» | ۳.۷ از ۵ (3.7/5) | ۵۸۱ رأی (581) | **۱۱۰,۰۰۰** | fetched, 2026-09-05 (carried forward, not re-verified this session) |
| **Google Play** (`play.google.com/store/apps/details?hl=en_CA&id=com.fidilio`) | **"Fidilio: Cafes & Restaurants"** | **4.4 out of 5 stars** | **1,375 total ratings** | **"50,000+"** | search-synthesis, this session, query #18 |
| **Myket** (`myket.ir/app/com.fidilio`) | «فیدیلیو» (per page title «دانلود برنامه فیدیلیو برای اندروید \| مایکت») | not obtained | not obtained | not obtained | existence confirmed, search-synthesis, queries #17/#19 — metrics not surfaced by any query phrasing tried |

**Reading this triangulation honestly:** the two stores with numbers disagree materially — Google Play
shows a **higher star rating** (4.4 vs 3.7) on a **larger rating sample** (1,375 vs 581) but a
**smaller install band** (50,000+ vs 110,000). This is plausible (different user populations —
Cafe Bazaar and Google Play serve different device/OS configurations in Iran, given US sanctions
complicate direct Play Store access for many Iranian Android users) but it is a genuine, unreconciled
discrepancy, not a typo — recording both rather than picking one. **Neither figure should be read as
"the" install count** — Fidilio's real cross-store install base is the (unknown, likely-overlapping)
union of at least three populations, none of which is total registered users or MAU (see §3).

The app's Google Play display name, **"Fidilio: Cafes & Restaurants,"** and its listed feature set per
this session's synthesis ("check-ins, venue discovery, user reviews") reads closer to the pre-2024
discovery-directory identity than the Cafe Bazaar listing's food-ordering-forward name «سفارش غذا» —
worth flagging as a **positioning inconsistency across stores**, not resolved by this session (I did
not read either store page directly, so I cannot confirm which is more current or whether Google Play's
listing has been updated post-pivot).

This retires part of prior-profile gap #4 ("iOS app existence/quality — only a third-party mirror
referenced it") **only for Android/Google Play**, not iOS — no Apple App Store evidence was found this
session either (see §7).

### 2. Funding — a second investor surfaces, and a prior-session figure is contradicted

**Contradiction found and flagged, per task instruction, not silently merged:**

- The existing profile (`profiles/fidilio.md`, 2026-09-04) states: *"Tracxn's own summary (surfaced via
  WebSearch, not fetched) states Fidilio 'has raised funding from 1 investor.'"*
- This session's query #6 (Crunchbase-sourced synthesis) and query #7/#12/#16 (Tracxn- and
  PitchBook-sourced synthesis, converging across three independently-phrased queries) all report:
  **"Fidilio has raised $837K. Rubika (Iran) and Shenasa have invested in Fidilio."** — **two named
  investors**, not one, and for the first time in the whole Scout research line, **a specific total
  funding figure: $837K.**

I am **not** resolving this contradiction — the 2026-09-04 session read "1 investor" from the same
kind of aggregator synthesis this session used, and I have no way to know whether Tracxn's own dataset
changed between sessions, whether the 2026-09-04 query undercounted, or whether this session's
Crunchbase/PitchBook-sourced answer is itself imprecise. **Both are recorded**, dated, and sourced.

**Read on Rubika as an investor, not just a distribution partner:** the existing profile already
documents that Rubika became a **distribution partner** for Fidilio's food-ordering launch in July 2024
(one month after the June 2024 pivot). This session's finding — that Rubika also appears as a **named
investor** in the same PitchBook/Tracxn-sourced funding summary — is consistent with (not
contradicting) that prior finding, and plausibly explains it: an equity relationship alongside the
distribution deal would be a normal structure for a super-app partnership. **This is inference on my
part, explicitly flagged as such** — no source states directly that the investment and the distribution
deal are the same transaction or event.

**What remains unresolved:**
- Round type/name — a separate query in this same research line (business.md, prior 2026-09-07
  session) did not surface "Series A" language; this session's search-synthesis for query #7 used the
  phrase "Series A" when summarizing Tracxn's profile, but **I did not see this inside quotation marks**
  — it is search-synthesis paraphrase of Tracxn's own round-naming convention, not a confirmed verbatim
  label. Treat as **CLAIMED/search-synthesis, unconfirmed**.
- Round date, and whether $837K is one round or the cumulative total across the (previously known)
  2019 Shenasa round plus a separate, undated Rubika round — **UNKNOWN — not verified**. The planned
  follow-up query for this was one of the four cut off by the budget exhaustion.
- Valuation — not found in any query this session.

### 3. MAU, registered users, website traffic — genuinely UNKNOWN, not merely unsearched

Three differently-phrased queries targeted this directly (#1 Persian, #2 English, both MAU/registered
users; #3 and #5, Similarweb/SEMrush/Ahrefs traffic estimates specifically). **All four returned zero
Fidilio-specific results** — the search tool's own synthesis explicitly stated it found no MAU,
registered-user, or traffic-estimate data for Fidilio and suggested checking the company's own site or
investor materials directly (paraphrase of its own admission, both queries #1 and #2). This is
consistent with the fact that Fidilio is a private, unlisted Iranian company outside the SEMrush/Ahrefs/
Similarweb coverage that typically requires either a paid analytics-tool query (not available to this
session's tooling) or a much larger/more internationally-indexed site than Fidilio's likely traffic
tier.

**MAU / registered users: UNKNOWN — not verified** (company-claimed or independent — neither found).
**Website traffic estimate (Similarweb/SEMrush/Ahrefs): UNKNOWN — not verified.**

This is a genuine, load-bearing gap for the SCALE mode's core ask and is reported as such rather than
padded with an inferred number.

### 4. Venue/restaurant counts and city coverage — no new figure this session

Query #4 targeted this directly and returned **no new figure** beyond what the prior profile already
carries (the company's own undated "12,500+ restaurants, 10,000+ cafes, 5,000+ bakeries" landing-page
claim). The search tool's own response explicitly stated: *"اطلاعاتی درباره تعداد دقیق رستوران‌ها و
کافه‌های فیدیلیو و پوشش شهرها در دسترس نیست"* (no information about the exact number of Fidilio's
restaurants/cafes or city coverage is available) — i.e., the search engine itself could not surface an
independent count or a city list. Query #4 did surface that Fidilio "برای کشف رستوران‌ها، کافه‌ها،
شیرینی‌فروشی‌ها و سفارش آنلاین **در تهران** فعالیت می‌کند" (operates **in Tehran** for discovery and
ordering) — this single-city framing is consistent with the prior profile's finding that the app's
listed service radius is 4km from the customer (per `business.md`, same competitor, same date) and
with the Cafe Bazaar description's "operating in Tehran" line already noted in the main profile's
ADDENDUM. **No source found by any Scout session to date claims Fidilio operates outside Tehran** —
this reads as a genuine single-city (or Tehran-dominant) footprint, though the possibility of
unadvertised secondary-city coverage is **UNKNOWN, not ruled out**.

**A planned follow-up query targeting Karaj/Mashhad/Isfahan/Shiraz coverage specifically could not be
run** (budget exhausted) — recorded as a real gap, not a "confirmed Tehran-only" finding.

### 5. Revenue / GMV — not found

Query #11, phrased to catch revenue or GMV in either Toman or Rial, returned **no Fidilio-specific
financial figure of any kind**. **UNKNOWN — not verified.** No prior Scout session found this either;
this is a stable, repeated gap across at least three independently-phrased attempts (2026-09-04's
profile did not attempt this query type at all; this is the first session to try it directly for
revenue/GMV specifically, and it also came back empty).

### 6. Acquisition prices — not applicable

No evidence of Fidilio itself being acquired, or of Fidilio acquiring another company, was found or
searched-for as a distinct question this session (no "Fidilio acquisition" query was run — this fell
into the four cut-off queries' territory conceptually, though it was not one of the four explicitly
planned). **UNKNOWN — not verified**, most likely **N/A** given nothing in any prior or current session
suggests M&A activity involving Fidilio, but I am not asserting N/A without having searched it directly
this session.

### 7. Headcount — two figures, two different bands, both recorded

| Source | Figure | As of | Label |
|---|---|---|---|
| LinkedIn company page (per search-synthesis, query #8) | **"11-50 employees"** | not dated (LinkedIn's own self-reported size band, a standard LinkedIn field companies set themselves) | **company-claimed** |
| Tracxn (per search-synthesis, queries #7 and the earlier profile's own 2026-09-04 Tracxn mention) | **14 employees** | **"as of May 31, 2026"** (explicit date given by the synthesis) | **independent-ish** — Tracxn aggregates from public signals (commonly LinkedIn scraping), not itself an audited or company-disclosed figure; labeled here as third-party estimate, not full company-claimed and not fully independent either |

**Reading these together:** 14 sits comfortably inside the "11-50" LinkedIn band, so there is **no
contradiction** between the two — Tracxn's more granular number is simply a tighter estimate within the
range LinkedIn's own self-reported bucket already allows. Both are recorded because they come from
different methodologies and the task instructs labeling company-claimed vs. independent explicitly per
figure.

**No iOS-side team size, no engineering-specific headcount breakdown, and no historical headcount trend
(growing/shrinking) was found or searched for this session.**

### 8. CURRENT job postings — one confirmed role, more likely exist but unreachable

This is a genuine SCALE-mode "roadmap signal" finding, though thin. Query #9 and its follow-ups (#10,
#14, #15) converged on:

- **A currently-open, urgently-flagged position: "گرافیست" (graphic designer)** at **«فن آوری تجارت
  هوشمند لاوین (فیدیلیو)»** (Fidilio's legal entity name — see §9), location **Tehran**, posted via
  **Jobvision** (`jobvision.ir`). The listing's exact posting date was **not obtainable** — search
  synthesis explicitly stated it could not surface a specific timestamp, only that this urgent listing
  is part of Jobvision's current active postings as of this session (2026-09-07). Labeled
  **search-synthesis**, no quotation marks around a dated snippet, so treated as paraphrase.
- A **`jobinja.ir/companies/fidilio/jobs`** page exists (its URL and title, «فرصت‌های شغلی فعال در
  فیدیلیو | Fidilio | جابینجا» — "Active job opportunities at Fidilio," surfaced by query #10) —
  confirming Fidilio maintains an active employer profile with open roles on a second major Iranian job
  board, but `WebFetch` against it was blocked, so **the actual list of open roles on Jobinja could not
  be read**, only that the page exists and its title asserts "active" openings.
- **Query #10's own synthesis** additionally described Fidilio's employer-branding copy (from what
  appears to be the Jobinja company profile, paraphrase, not verbatim/quoted): the company positions
  itself as focused on "creating a complete database of players in this [food/beverage] space" and
  using "UGC to shape a social platform around it," with "a team of specialists in a professional,
  friendly, and dynamic environment."

**Roadmap read:** the one confirmed open role (graphic designer, urgent) is a **design/creative/growth**
signal, not an ML, payments, or backend-engineering signal — consistent with a company investing in
content/marketing surface area (its own magazine `mag.fidilio.com`, the Fidilio Club merchant-offer
pages) rather than a company visibly hiring for new technical capability. **This is a thin, single-data-
point signal** — one confirmed listing is not enough to characterize a hiring roadmap, and the
Jobinja page (which explicitly claims to have "active" postings, plural) could not be read to see what
else is open. **I am not extrapolating a broader hiring pattern from one graphic-designer listing.**

The earlier, unrelated Finding 2 in `social.md` (a 2021-dated Glassdoor review from a former Front End
Developer) is **not** a current job posting and is not re-used here as one.

### 9. Legal entity name and registered address — new to the corpus

Query #13 located Fidilio's registered legal entity name for the first time in any Scout session:
**«شرکت فن آوری تجارت هوشمند لاوین»** ("Lavin Smart Commerce Technology Co."), doing business as
Fidilio. Source: `shenasa.ir/portfolio-item/فناوری-تجارت-هوشمند-لاوین/` — **Shenasa's own portfolio
page** (Shenasa being Fidilio's known investor per the existing profile), so this is **company-claimed
via the investor**, not independently verified. Search-synthesis (query #13, paraphrase, not verbatim)
additionally surfaced a Tehran office address (Kavosieh, Africa Street, 19th Turkman Lane, Building 23,
Unit 1), a support phone number (021-74052000), and a contact email (Info@fidilio.com) — these read as
routine public-facing contact details rather than sensitive data, and are recorded because a registered
legal-entity name is directly useful for future Scout sessions querying company registries (e.g.
`rasmio.com`, which surfaced in the same query as an Iranian company-lookup aggregator, though it was
not itself queried this session).

## Numbers table — every figure found this session, with label and date

| Figure | Value | Currency/unit | Label | Source | Date observed |
|---|---|---|---|---|---|
| Cafe Bazaar installs | 110,000 | installs | independent (store aggregate) | cafebazaar.ir, fetched 2026-09-05, carried forward | 2026-09-05 |
| Cafe Bazaar rating / count | 3.7/5, 581 ratings | — | independent (store aggregate) | cafebazaar.ir, fetched 2026-09-05, carried forward | 2026-09-05 |
| **Google Play installs (NEW)** | **50,000+** | installs | independent (store aggregate) | search-synthesis, query #18 | 2026-09-07 |
| **Google Play rating / count (NEW)** | **4.4/5, 1,375 ratings** | — | independent (store aggregate) | search-synthesis, query #18 | 2026-09-07 |
| Myket listing | exists, metrics unknown | — | independent (existence only) | search-synthesis, queries #17/#19 | 2026-09-07 |
| **Total funding raised (NEW)** | **$837,000** | USD | independent (aggregator estimate — PitchBook/Tracxn) | search-synthesis, queries #7, #12, #16 | 2026-09-07 |
| **Investor count (CONTRADICTS prior session)** | 2 named: Rubika (Iran), Shenasa | — | independent (aggregator estimate) | search-synthesis, queries #6, #7, #12, #16 | 2026-09-07 — vs. prior session's "1 investor" (2026-09-04) |
| LinkedIn headcount band | 11–50 | employees | company-claimed (self-reported LinkedIn field) | search-synthesis, query #8 | 2026-09-07 |
| **Tracxn headcount estimate (NEW)** | **14** | employees | independent-ish (third-party aggregator estimate) | search-synthesis, query #7 | "as of May 31, 2026" per synthesis |
| MAU / registered users | UNKNOWN — not verified | — | — | queries #1, #2 found nothing | 2026-09-07 |
| Website traffic (Similarweb/SEMrush/Ahrefs) | UNKNOWN — not verified | — | — | queries #3, #5 found nothing | 2026-09-07 |
| Restaurant/cafe/bakery count, independent | UNKNOWN — not verified (only company-claimed 12,500+/10,000+/5,000+ carried forward) | — | company-claimed only | prior profile, unchanged | — |
| City coverage | Tehran only, per available evidence (not confirmed exhaustively) | — | mixed | search-synthesis, query #4 | 2026-09-07 |
| Revenue / GMV | UNKNOWN — not verified | — | — | query #11 found nothing | 2026-09-07 |
| Current job postings confirmed | 1 (graphic designer, Tehran, urgent) | — | search-synthesis | queries #9, #14, #15 | 2026-09-07 |
| Legal entity name | شرکت فن آوری تجارت هوشمند لاوین (Lavin Smart Commerce Technology Co.) | — | company-claimed (via investor Shenasa's own portfolio page) | search-synthesis, query #13 | 2026-09-07 |

## Contradiction check against existing profile and MATRIX.md

**One contradiction found and recorded, not resolved (per task instruction):**
`profiles/fidilio.md` (2026-09-04) states Tracxn reported Fidilio "has raised funding from 1
investor." This session's search-synthesis of Crunchbase/PitchBook/Tracxn (three independently-phrased
queries, #6/#7/#12/#16, all converging) instead reports **two** named investors (Rubika, Shenasa) and a
specific total ($837K) that no prior session had. Both figures are presented in §2 above with their
respective session dates; I am not asserting which is more accurate.

**No other contradictions found.** This session's other new facts (Google Play's existence and metrics,
Myket's existence, the Jobvision job posting, the legal entity name, the Tracxn headcount figure) are
all **additions to previously-blank/UNKNOWN cells**, not corrections to anything `profiles/fidilio.md`
or `MATRIX.md` already asserts. `MATRIX.md`'s Fidilio row "Independent, third-party-reviewable
footprint" cell (footnote 61) currently reads only Cafe Bazaar's figures — **this session's Google Play
finding is new evidence that cell's owner should incorporate on the next MATRIX pass**, though editing
`MATRIX.md` itself is out of scope for this file per the task's single-output-file instruction.

## What this session did NOT verify (explicit gap list)

1. **MAU / registered users** — zero results, two differently-phrased attempts (Persian, English).
2. **Website traffic (Similarweb/SEMrush/Ahrefs)** — zero results, two attempts.
3. **Independent (non-company-claimed) restaurant/venue count** — not found; only the same undated
   "12,500+/10,000+/5,000+" company marketing claim from the prior profile stands.
4. **City coverage beyond Tehran** — not confirmed either way; the planned Karaj/Mashhad/Isfahan/Shiraz
   query could not be run (budget exhausted).
5. **Revenue / GMV** — zero results.
6. **Acquisition activity** — not directly searched this session; presumed N/A but not confirmed.
7. **Series A (or any named) round's date and individual amount** — only a cumulative $837K figure and
   an unconfirmed "Series A" label (not seen in quotation marks) were found; the planned follow-up query
   could not be run.
8. **Myket's install count, rating, and review count** — existence confirmed, no metrics obtained
   despite two query attempts.
9. **iOS / Apple App Store presence** — not found this session (consistent with every prior session);
   still UNKNOWN.
10. **Exact date of the Jobvision graphic-designer posting**, and **the full list of roles on
    `jobinja.ir/companies/fidilio/jobs`** (page confirmed to exist and titled "active job opportunities,"
    plural, but unreadable — `WebFetch` blocked).
11. **Quera and Karboom job-board sweep** — planned, not run (budget exhausted).
12. **Valuation** — not found in any query.

## Sources

All accessed 2026-09-07.

**WebFetch attempts (all blocked, `EGRESS_BLOCKED`, listed with the methodology table above):**
`example.com`, `cafebazaar.ir/app/com.fidilio`, `fidilio.com.cutestat.com`,
`tracxn.com/d/companies/fidilio/__BbXWCMmWzLVusepl2aKEg-dtvKQ5bV4xOrP0XbBFopE`,
`pitchbook.com/profiles/company/498038-41`, `jobinja.ir/companies/fidilio/jobs`,
`irantalent.com/en/company/fidilio/b78e2a1b-8d29-4f7b-8589-a1b366f4a48f/overview`,
`jobvision.ir/companies/19393/استخدام-گروه-لاوین`,
`play.google.com/store/apps/details?hl=en_CA&id=com.fidilio`, `myket.ir/app/com.fidilio`,
`zoominfo.com/c/fidilio/460494450`, `crunchbase.com/organization/fidilio`.

**WebSearch reached only search-engine synthesis of (URLs cited by the synthesis, not opened
directly):**
- `play.google.com/store/apps/details?hl=en_CA&id=com.fidilio` — Google Play metrics (Finding 1)
- `myket.ir/app/com.fidilio` — existence only (Finding 1)
- `pitchbook.com/profiles/company/498038-41` — funding total, investors (Finding 2)
- `tracxn.com/d/companies/fidilio/__BbXWCMmWzLVusepl2aKEg-dtvKQ5bV4xOrP0XbBFopE` — funding, headcount
  (Findings 2, 7)
- `crunchbase.com/organization/fidilio` — funding, investors (Finding 2)
- `linkedin.com/company/fidilio` — headcount band (Finding 7)
- `jobvision.ir` (`/jobs`, `/companies/19393/...`) — job posting (Finding 8)
- `jobinja.ir/companies/fidilio/jobs` — existence of active postings page (Finding 8)
- `shenasa.ir/portfolio-item/فناوری-تجارت-هوشمند-لاوین/` — legal entity name, address (Finding 9)
- `gsm.ir/mag/news/33938/...`, `fidilio.com`, `fidilio.com/?page=listrestaurants`,
  `mag.fidilio.com`, `whichapp.ir/فیدیلیو`, `behtarin.site/fidilio-com`,
  `fidilio.com.cutestat.com` — city-coverage query, no new figures (Finding 4)

**Checked, returned nothing Fidilio-specific:** `similarweb.com` (own site only, no fidilio.com data),
`semrush.com`/`ahrefs.com` (generic tool pages, no fidilio.com data), general MAU-definition sites
(Pendo, Count, MetricHQ — no Fidilio content), `zoominfo.com` (search returned it as a URL but no
extractable metric beyond what's in Findings 2/7), `slintel.com` (surfaced as a result title, no content
extracted).

## What remains for the next Scout session on this competitor

In priority order: (1) a `WebFetch`-capable session should open `jobinja.ir/companies/fidilio/jobs` and
`play.google.com/store/apps/details?id=com.fidilio` directly — both are now **named, high-value
targets** confirmed to exist but unread; (2) resolve the 1-investor vs. 2-investor / $837K funding
contradiction by finding the original PitchBook or Tracxn page's full round history; (3) the four
cut-off queries (independent venue count, city expansion, Series-A date/amount, Quera/Karboom sweep)
should be run first, before spending budget on anything already answered here.
