# Fidilio — Social & Forums (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_
_Mode: SOCIAL AND FORUMS (Persian X/Twitter, Telegram, Instagram comments, Reddit, forums, news-comment
sections, LinkedIn, and the restaurant-owner side: fees/payouts/support/exclusivity)_

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested on `https://example.com` (neutral control),
then immediately on `https://www.instagram.com/fidilio.official/` (primary target for this mode), then on
two more mode-specific targets before falling back.

| URL | Result |
|---|---|
| `https://example.com` | `EGRESS_BLOCKED` |
| `https://www.instagram.com/fidilio.official/` | `EGRESS_BLOCKED` |
| `https://twitter.com/search?q=...` | `EGRESS_BLOCKED` |
| `https://t.me/s/fidilio` | `EGRESS_BLOCKED` |

**`webfetch_worked = false` for this session.** The `example.com` control confirms a blanket
network-egress policy, not a per-domain block — consistent with the **2026-09-07** `store-reviews.md`
session earlier the same day (see that file's own control test) and in contrast to the
**2026-09-05** session (`profiles/fidilio.md` ADDENDUM), where `WebFetch` worked. No nitter mirror was
reachable either (nitter instances resolve through the same blocked egress). Every finding below is
therefore `search-synthesis`: `WebSearch`'s own summarization of pages it read server-side, not a page
I opened and read myself. Per the task's evidence rule, only text that appeared inside quotation marks
in a search result is presented as a quote; everything else is paraphrase and labeled as such.

**Queries run this session: 41**, spanning Persian and English, `site:` operators (`twitter.com`,
`x.com`, `t.me`, `reddit.com`, `facebook.com`), exact-phrase hunts for the target sentence
(«دیگه استفاده نمیکنم چون…» / "stopped using it because…"), restaurant-owner-side terms (commission,
exclusivity, panel, settlement/payout), employer-review sites (Glassdoor, IranTalent, Karboom), and
app-comparison/forum sites (WhichApp, Nazarkade, P30World). Full list in "Sources" below.

## Prior research read first (per task instruction) — extends, does not repeat

Read before starting: `docs/audit/research/profiles/fidilio.md` (main profile + 2026-09-05 ADDENDUM)
and `docs/audit/research/corpus/fidilio/store-reviews.md` (2026-09-07, earlier same-day session, mode
STORE REVIEWS AT VOLUME). Both already cover: the 2008 founding, the June 2024 delivery pivot, the
Rubika partnership, the SnappFood address-sync controversy and CEO "technical bug" explanation, the
Cafe Bazaar aggregate (3.7/5, 581 ratings, 110,000 installs, fetched 2026-09-05), and 6 total known
reviews (3 fetched verbatim + 3 search-synthesized, all Sept–Oct 2025, including the OTP 6-digit-sent/
4-digit-accepted bug reported twice 28 days apart). **This corpus does not re-quote those** — see the
two files above for that evidence. Everything below is **new** to the Fidilio research line: social
presence inventory, the restaurant-owner/exclusivity angle, an employer-review data point, and an
independent app-rating-aggregator data point.

**Contradiction check:** none found. Every fact this session's searches touched that overlaps prior
work (2008 founding, SnappFood/ZoodFood lineage, the address-sync dispute, CEO Mohammad Bagheri's
"technical bug" line) is consistent with what `profiles/fidilio.md` already states.

---

## Finding 1 — Official social-account inventory (existence + platform-reported metadata)

No complaint or praise content was reachable on any of these (WebFetch blocked), but their existence
and platform-reported follower/like counts are themselves data points for a "social footprint" line,
labeled **independent (platform metadata, not company-claimed)** since these are the platforms' own
counters, not Fidilio's marketing copy:

| Platform | Handle/page | Metadata reported by search | Evidence type |
|---|---|---|---|
| X (Twitter) | `@fidilio` (x.com/fidilio) | Bio: «فیدیلیو ‍اولین پلتفرم دیجیتال صنعت غذای ایران»; joined **February 2012**; **1,273 followers** | search-synthesis |
| Threads | `@fidilio` (threads.com/@fidilio) | **21.6K followers**, 13 threads posted | search-synthesis |
| Facebook | `mr.fidilio` (facebook.com/mr.fidilio) | **~97,869 likes**; also a separate `fidilio.official` page and a `FidilioClub` page exist | search-synthesis |
| Instagram | `fidilio.official` | Confirmed to exist; follower count **not obtained** this session (search returned only metadata-free hits; the 2026-09-04 session's ~77K figure could not be reconfirmed — see gap list) | search-synthesis (unconfirmed count) |

**Read on this:** an X account with **1,273 followers after 14 years** (joined 2012) is a strikingly
thin following for what markets itself as "Iran's first digital platform for the food industry" —
Threads, a much younger product, already has ~17x that account's follower count on the same brand.
This is a genuine, if soft, signal about which channel Fidilio's actual audience uses — **not** a
claim about total social reach, since Instagram (plausibly the largest channel per the 2026-09-04
session, not reconfirmed here) was not measurable this session.

## Finding 2 — Employer/employee side: one Glassdoor review, quoted

Search surfaced a real Glassdoor listing (`glassdoor.com/Reviews/Employee-Review-Fidilio-RVW53040090.htm`,
company page `glassdoor.com/Overview/Working-at-Fidilio-EI_IE2968909...`) for a **Front End Developer**,
tenure "less than 1 year," dated **~September 2021** (outside the task's preferred 12-month recency
window — flagged as such, included because it is the only employee-side account found in this or any
prior Scout session on Fidilio):

- **Overall rating: 4.0/5.**
- **Pro** (paraphrase, not in quotation marks in the search result): "one of the popular food review
  applications in Iran."
- **Con** (this text **was** rendered inside quotation marks by the search result, so treated as a
  verbatim quote): *"This company won't have any code review that we will not understand where we can
  better."* [sic — ungrammatical in the original, not a translation artifact]

**Sample size: 1 review.** No aggregate Glassdoor rating for the whole company (count of reviews,
CEO-approval %, recommend-to-a-friend %) could be retrieved — repeated queries returned only this one
review's content, plus noise from unrelated similarly-named companies (Facilio, Fidelio, Fiditalia,
Fidelio Partners). IranTalent.com also carries a `Fidilio` company review page
(`irantalent.com/en/company/fidilio/b78e2a1b.../review`) that search confirmed exists but whose content
could not be extracted beyond re-surfacing the same Glassdoor review text — **UNKNOWN — not verified**
what IranTalent's own reviews (if different from Glassdoor's) say.

**Explicit false-match warning:** one query ("فیدیلیو کارمند سابق تجربه کاری") returned a
search-engine answer describing a *different* former employee's very negative account (taste-based
management, unqualified department heads, the CEO "changing daily") attached to the name **"Flayteio"**
— almost certainly a garbled transliteration of **Flightio** (پرواز۲۴/فلایتیو), an unrelated flight-
booking startup, not Fidilio. **This is excluded from the findings above** and is recorded here only
so the query is not silently dropped and so a future session does not accidentally re-attribute it to
Fidilio.

## Finding 3 — Restaurant-owner side: an exclusivity dispute naming Fidilio specifically

This is the most significant new finding of this pass. `zoomit.ir` («زیر فشار انحصار اسنپ‌فود؛ از
بستن پنل تا تعیین خسارت مالی برای رستوران‌ها», 2024) — already cited in `MATRIX.md`'s SnappFood
exclusivity row via the general story — contains a restaurant-owner account that **specifically names
Fidilio** as the platform whose relationship triggered SnappFood's enforcement action. Two independently
phrased search queries returned materially the same account, which increases confidence this is a real
paraphrase of one consistent underlying passage rather than search-engine invention:

> (paraphrase, not verbatim — no quotation marks were rendered by either search result) One restaurant
> owner told Zoomit that **about 6.5 months before**, they had signed a contract with **Fidilio**.
> SnappFood then called them and said the restaurant had a "special contract" and was required to work
> **exclusively** with SnappFood. SnappFood **deactivated the restaurant's SnappFood panel for about a
> week**, telling the owner the panel would not be reactivated **"until Fidilio removes the restaurant
> from its site."**

A separate restaurant in the same article estimated its own daily loss from a panel deactivation at
**30–40 million Toman/day** (100–150 SnappFood orders/day lost) — **this figure is not confirmed to be
the same restaurant as the Fidilio case**; the article appears to describe multiple restaurants'
experiences (one resolved by canceling a Tapsi contract, over ~4 days; the Fidilio one over ~1 week),
and the two search syntheses did not disambiguate which restaurant the loss estimate belongs to. I am
flagging this ambiguity explicitly rather than merging the two into one stronger claim.

**Why this matters for Rezervno:** this is a real, reported instance of the same anti-multi-homing
mechanism the project's own `MATRIX.md` already documents for SnappFood generally (exclusive contracts
ruled anti-competitive by Iran's Competition Council in May 2025, later upheld on appeal) — but this is
the first evidence in the Fidilio-specific research line that **Fidilio itself was the named rival**
whose presence triggered a real financial-pressure event against a restaurant. It is evidence of
Fidilio's market position (a rival SnappFood treats as worth enforcing against) more than it is
evidence of a Fidilio-caused problem — the harm described was inflicted by SnappFood, not by Fidilio.
Restaurant owner's name, exact date, and restaurant identity were **not** obtainable from search
synthesis alone — **UNKNOWN — not verified** beyond what is quoted/paraphrased above.

A related, previously-uncited follow-up article was also found: `digiato.com/iran-technology-news/
snappfood-reaction-to-digiato-report` — "بیانیه اسنپ‌فود در پاسخ به گزارش دیجیاتو: فیدیلیو پلتفرمی
مستقل است و هیچ داده‌ای در اختیار آن قرار نداده‌ایم" ("SnappFood's statement in response to Digiato's
report: Fidilio is an independent platform and we have not given it any data") — SnappFood's own
on-record denial, additional to (not contradicting) the CEO Mohammad Bagheri statement already in
`profiles/fidilio.md`. This is company-claimed (SnappFood's own statement about Fidilio), not
independent.

No restaurant-owner complaint specifically **about Fidilio's own fees, payouts, onboarding, or
support** (as opposed to SnappFood's retaliation against a Fidilio relationship) was found despite
targeted queries — this gap, already flagged in the main profile, remains open.

## Finding 4 — Independent app-rating aggregator: WhichApp.ir (new to this research line)

`whichapp.ir/فیدیلیو` (سامانه مقایسه و رتبه‌بندی خدمات اپلیکیشن‌ها — an Iranian app-comparison/rating
site, structurally similar in purpose to G2/Capterra but for consumer apps) carries a Fidilio page with
an aggregate score across five weighted categories. This is a **new, independent data point** not
previously in the Fidilio corpus (which until now only had Cafe Bazaar's aggregate):

| Category | Score (out of 10) |
|---|---|
| **Overall** | **6.5** |
| Quality (کیفیت) | 6.9 |
| Service speed (سرعت خدمات) | 6.2 |
| Price/value (ارزش قیمت) | 6.9 |
| **Support & responsiveness (پشتیبانی و پاسخگویی)** | **5.7 (lowest of the five)** |
| Reliability (قابلیت اعتماد) | 6.8 |

**Sample size: 11 reviews** (platform-reported submission count). Individual review text/dates were
**not retrievable this session** — repeated targeted queries for the underlying comments returned only
the aggregate scores and generic platform-description boilerplate, never a quoted comment. This is
labeled **search-synthesis, aggregate-only** — evidence_type applies to the numbers, not to any
individual quote (none exists in this corpus for WhichApp).

**Why this is worth keeping despite the thin sample:** Support/responsiveness scoring the clear
lowest of five categories (5.7 vs. 6.2–6.9 elsewhere) is **independently consistent** with the Cafe
Bazaar review already fetched by the 2026-09-05 session — «پشتیبانی فاجعه س» ("support is a disaster")
— from a completely different review population (11 WhichApp submitters vs. Cafe Bazaar's 581 raters,
no known overlap). Two independent, differently-sourced signals pointing the same direction on the
same specific dimension (support) is stronger than either alone, even though both individual samples
are small.

## Absence findings — genuine gaps, not un-searched gaps

- **Reddit:** zero results on r/iran, r/restaurateur, r/KitchenConfidential, or any city subreddit for
  Fidilio in any phrasing tried (Persian or English, with and without `site:reddit.com`). Search
  consistently substituted unrelated Wikipedia/Crunchbase/Tracxn results instead. **ABSENT** as far as
  this tooling can determine — not the same as "confirmed zero Reddit posts exist."
  – Search: `site:reddit.com fidilio Iran`, `reddit.com/r/iran fidilio OR فیدیلیو`.
- **Telegram:** no Fidilio-specific channel or group found via `site:t.me` or general search; no
  restaurant-owner Telegram group (e.g., «رستورانداران مشهد») mentioned Fidilio in any surfaced
  snippet. **UNKNOWN whether an official Fidilio Telegram channel exists** — not confirmed either way.
- **Nazarkade.com** (a Persian consumer-review aggregator — the same kind of site that has dedicated
  pages for `fidibo.com`, `filimo.com`, `jobinja.ir`, `karlancer.com`, `karboom.io`, `excoino.com`,
  `cafebazaar.ir`, and dozens of others) **has no page for `fidilio.com` or the Fidilio app** — checked
  directly by search and by browsing the site's own review-index pattern. This is a genuine **ABSENT**
  for this specific channel: the site's coverage pattern shows it indexes online-business review pages
  broadly, and Fidilio is not among them.
- **Twitter/X complaint threads:** despite `site:twitter.com`, `site:x.com`, hashtag search
  (`#فیدیلیو`), and direct "@fidilio complaint" queries, no individual tweet complaining about or
  praising Fidilio was surfaced — only the account's own existence/metadata (Finding 1) and unrelated
  accounts sharing similar names (`@haj_komeil`, `@_callie23`, `@SebFidilio`).
- **LinkedIn:** no restaurant-owner post about Fidilio (partnership, complaint, or otherwise) found on
  `linkedin.com` despite several phrasings; only Fidilio's own company page existence was confirmed.
- **YouTube/podcast:** no video or podcast episode reviewing or discussing Fidilio surfaced.
- **P30World forums:** no Fidilio-specific thread found on `forum.p30world.com`.

## False-match hazard (repeat warning, two new instances this session)

Beyond the "Flayteio"/Flightio employee-review mismatch in Finding 2, this session's "stopped using it
because" hunt (`"stopped using Fidilio because" OR "دیگه فیدیلیو نصب نمیکنم"`) returned a search-engine
answer that **explicitly conflated Fidilio (the restaurant app) with Fidibo/فیدیبو (an unrelated
e-book/audiobook platform)** in the same paragraph — attributing complaints about forced re-downloads,
update-breakage, and "company only cares about its own business interests" to an ambiguous "Fidilio,"
when the cited URLs (`fidibo.com`, `nazarkade.com/review/fidibo.com`, `ensafnews.com` "گلایه‌های یک
کاربر فیدیبو") are all about **Fidibo**, not Fidilio. **None of that content is used as a Fidilio
finding in this corpus.** This is the third time across Scout's Fidilio research line (after Fidibo and
Fidelity mismatches noted in the 2026-09-04 profile) that Persian name-similarity has produced a
search-engine answer that silently merges two different companies — a structural hazard for this
specific competitor's name, not a one-off.

## Complaint/praise theme counts — honest, with sample sizes

Per the task's rule against padding, only themes with an actual sample size are listed. None of this
session's own findings are individual verbatim consumer complaints (that evidence lives in
`store-reviews.md` and the main profile, sample size 6, not repeated here) — this session's
contribution is aggregate/structural, not new individual quotes:

| Theme | Basis | Sample size | Evidence type |
|---|---|---|---|
| Support/responsiveness is the weakest dimension | WhichApp.ir category breakdown (5.7/10, lowest of 5 categories) | 11 (WhichApp submitters) | search-synthesis, aggregate |
| Lack of code-review discipline (engineering-culture complaint, not consumer-facing) | 1 Glassdoor review, quoted | 1 | search-synthesis, quoted |
| Being on Fidilio can trigger a rival's exclusivity enforcement (restaurant-owner risk, not a Fidilio-caused defect) | 1 Zoomit-reported restaurant-owner account | 1 | search-synthesis, paraphrase |

**No praise theme with any sample size was found this session** — same conclusion as
`store-reviews.md`'s finding for the consumer-review corpus; this session adds a partial counter-signal
only in the sense that WhichApp's Quality/Price categories score respectably (6.8–6.9/10), but no
individual positive quote exists anywhere in the Fidilio corpus to date, across any Scout session.

## What this session could NOT do (explicit gap list)

1. Could not open any social-platform page directly (Instagram, X/Twitter, Threads, Facebook,
   Telegram) — all metadata in Finding 1 is search-engine-reported, not independently confirmed by a
   direct visit.
2. Could not retrieve individual comment/review text from WhichApp.ir beyond the aggregate scores —
   Finding 4's category breakdown is real but has zero attached verbatim quotes.
3. Could not confirm the exact restaurant name or date in the Zoomit exclusivity story (Finding 3);
   could not disambiguate whether the 30–40 million Toman/day loss estimate belongs to the same
   restaurant as the Fidilio-specific account or a different one described in the same article.
4. Could not reconfirm Instagram's follower count (the 2026-09-04 session's ~77K figure stands
   unverified by this session either way).
5. Could not find any restaurant-owner complaint about Fidilio's **own** commission rate, payout
   timing, or onboarding friction — only about a rival's retaliation for being associated with
   Fidilio. The commission-rate gap flagged in the main profile (item 2 of "What I did NOT verify")
   remains fully open.
6. Reddit, Telegram groups, LinkedIn posts, and YouTube/podcast content: zero results across the whole
   session despite broad query coverage — recorded as genuine absence-as-far-as-tooling-can-tell, not
   fabricated as zero-with-confidence.

## Sources

All accessed 2026-09-07, all via `WebSearch` (`webfetch_worked = false`, confirmed by the
`example.com` control plus three mode-specific control attempts listed in the methodology table).

**Reached (search-synthesis):**
- `x.com/fidilio` — official X account, metadata only (Finding 1)
- `threads.com/@fidilio` — official Threads account, metadata only (Finding 1)
- `facebook.com/mr.fidilio`, `facebook.com/fidilio.official` (`p/fidilioofficial-100067605903472`),
  `facebook.com/FidilioClub` — Facebook presence, metadata only (Finding 1)
- `glassdoor.com/Reviews/Employee-Review-Fidilio-RVW53040090.htm` and
  `glassdoor.com/Overview/Working-at-Fidilio-EI_IE2968909...` — Finding 2
- `irantalent.com/en/company/fidilio/b78e2a1b-8d29-4f7b-8589-a1b366f4a48f/review` — confirmed to exist,
  content not distinguishable from the Glassdoor text in search results
- `whichapp.ir/فیدیلیو` — Finding 4
- `zoomit.ir/tech-iran/429599-snapfood-monopolistic-behavior-with-restaurants/` — Finding 3
- `digiato.com/iran-technology-news/snappfood-reaction-to-digiato-report` — Finding 3 (new URL, not
  previously cited in `profiles/fidilio.md`)
- `sharghdaily.com/.../949723-...` ("از امتیازهای ویژه تا تهدید به دریافت خسارت‌های سنگین",
  2024-11-23-dated per search) — same underlying story as the Zoomit article, corroborating
- `club.fidilio.com/membership` — company's own loyalty-tier page (off-mode, company-claimed only,
  mentioned briefly as context, not as a social/forum finding)
- `nazarkade.com/` (index pattern) — used to establish the absence finding (no Fidilio page exists
  among its many indexed review pages)

**Checked, returned nothing Fidilio-specific (recorded so the query is not silently dropped):**
`reddit.com` (multiple subs and phrasings), `t.me` (`site:` and general), `linkedin.com` (posts, not
just the company page), `youtube.com`, `forum.p30world.com`, `quora.com`, direct Twitter/X hashtag and
complaint-reply searches, `karboom.io`, `jobinja.ir`/`karlancer.com` (returned only as noise, not
Fidilio-relevant).

**False matches explicitly excluded** (see "False-match hazard" section): `fidibo.com` and
`nazarkade.com/review/fidibo.com` (an unrelated e-book platform), and an unattributed "Flayteio"
former-employee narrative (almost certainly Flightio, an unrelated flight-booking startup).

## Cited but not opened — carried from prior sessions, not re-verified here

`docs/audit/research/profiles/fidilio.md` and `docs/audit/research/corpus/fidilio/store-reviews.md` —
see those files for their own full source lists (Cafe Bazaar fetch, Digiato/Tabnak/Startup360 coverage
of the SnappFood address-sync story, etc.), not reproduced here.
