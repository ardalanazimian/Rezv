# SnappFood — Store Reviews at Volume (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SnappFood (اسنپ‌فود), key `snappfood`, tier `iran`_
_Mode: STORE REVIEWS AT VOLUME (target: 50+ recent real user reviews)_

## Headline finding — read this before anything else

**This session could gather zero new evidence.** Both mandated evidence channels were unavailable
before a single item of content could be read:

- `WebFetch` → `EGRESS_BLOCKED` on every URL tried, including the neutral control (`example.com`).
- `WebSearch` → the session's search budget was **already at 200 of 200 calls before my first query
  ran** (consumed by other research work earlier in this same session — the Fidilio, Foodism, SmartX
  and RSEE corpus passes visible in this same `docs/audit/research/corpus/` tree). Every one of my 8
  attempted queries returned the tool's own budget-exhausted message, not a search result.

This is a stricter failure than any prior Scout pass on this repo: the 2026-09-05 Fidilio addendum had
working `WebFetch`; the 2026-09-07 Fidilio/Foodism/SmartX/RSEE `store-reviews.md` passes had `WebFetch`
blocked but a working `WebSearch` fallback. Here, **neither** channel produced a single byte of new
content. Per the task's own rule ("0 is a valid answer" / "never pad to hit a target"), I am reporting
`reviews_read = 0` for this session rather than re-presenting prior-session material as if I read it.

## Methodology — first action taken, per protocol

**Step 1 — WebFetch test (control + primary target), before anything else:**

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` (neutral control) | `EGRESS_BLOCKED` — `"Access to example.com is blocked by the network egress proxy."` |
| 2 | `https://cafebazaar.ir/app/com.zoodfood.android` (primary target, per task hints) | `EGRESS_BLOCKED` — `"Access to cafebazaar.ir is blocked by the network egress proxy."` |
| 3 | `https://myket.ir/app/com.zoodfood.android` | `EGRESS_BLOCKED` — `"Access to myket.ir is blocked by the network egress proxy."` |
| 4 | `https://play.google.com/store/apps/details?id=com.zoodfood.android&hl=fa` | `EGRESS_BLOCKED` — `"Access to play.google.com is blocked by the network egress proxy."` |

The `example.com` control failing identically to all three real targets confirms this is a blanket
session-level network-egress policy, not a per-domain or per-target block — consistent with every
prior Scout session's finding recorded in `profiles/snappfood-loyalty.md` (2026-09-04, also
`EGRESS_BLOCKED` on both `example.com` and `snappfood.ir`) and `corpus/fidilio/store-reviews.md`
(2026-09-07, same pattern across 6 URLs). I did not burn further WebFetch calls on the remaining
task-listed sources (apkpure/apkcombo/uptodown/aptoide, apps.apple.com, trustpilot.com, appreview.ir,
charkhoneh) once the pattern was confirmed on 4/4 attempts — extrapolating from a 4/4 blanket-block
result to the rest is reasonable and matches how the Fidilio session (6/6 blocked) treated the same
situation.

**`webfetch_worked = false` for this session.**

**Step 2 — WebSearch fallback, per the task's own instruction ("if EGRESS_BLOCKED, fall back to
WebSearch with MANY differently-phrased queries"):**

I attempted 8 queries, covering Persian and English, `site:` operators, and star-rating-targeted
phrasing, before the tool reported the budget was exhausted. All 8 are listed for the record — none
returned any search result, quote, or synthesis text:

1. `اسنپ فود نظرات کافه بازار امتیاز`
2. `site:cafebazaar.ir com.zoodfood.android`
3. `اسنپ فود شکایت کاربران ۱۴۰۴`
4. `اسنپ فود کد تخفیف کار نمیکنه نظر`
5. `اسنپ فود فودپارتی تقلبی شکایت`
6. `SnappFood app reviews complaints one star`
7. `اسنپ فود ۱ ستاره کافه بازار نظر`
8. `اسنپ کلاب امتیاز شکایت نظر کاربران`

Each returned, verbatim: *"Web search was not performed: this session has used its web search budget
(200 of 200 WebSearch calls). Continue with the information already gathered instead of issuing more
searches. If more searches are genuinely needed, ask the user to raise
CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION."*

I could not raise that limit myself (no interactive user available inside this task), and re-running
queries against an already-reported 200/200 budget would not have produced a different result, so I
stopped after confirming the ceiling on the first batch rather than spending further tool calls
against a channel that had already announced it was closed.

**`websearch_worked = false` for this session (0 of 8 queries returned any content).**

## Prior evidence carried forward (NOT re-verified this session — full citation to source)

The only prior Scout material that touches SnappFood's store presence at all is
`docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04 session). That profile is scoped to
loyalty/rewards, not general store reviews, and it is transparent about its own limits — worth
restating exactly, because it is the closest thing this corpus has to a starting point:

> "I could not open Cafe Bazaar's or Myket's review pages directly (WebFetch blocked)... I still could
> not extract multiple full, quoted, dated Cafe-Bazaar-specific reviews naming coupons/loyalty by
> name."

What that session *did* surface via `WebSearch` synthesis (its own channel worked that day; mine did
not), reproduced here as prior evidence, each item exactly as labeled in the source profile:

| Field | Value | Source label | As of |
|---|---|---|---|
| Myket aggregate rating | **4.3 / 5 across 19,209 comments**, synthesis described as "relatively positive... good discounts, diverse restaurants, appropriate packaging and food quality" | search-synthesis; **specific source URL not surfaced**, flagged by that session as a weaker-sourced figure | 2026-09-04 |
| Cafe Bazaar aggregate rating/count | **UNKNOWN — not verified.** Multiple targeted queries that day failed to surface a specific star rating or review count for `cafebazaar.ir/app/com.zoodfood.android` | — | 2026-09-04 |
| Individually quoted, dated, named-reviewer store reviews (Cafe Bazaar or Myket) | **Zero.** That session states this explicitly as a structural gap, same as the Fidilio profile's finding | — | 2026-09-04 |

That session's complaint-theme findings were sourced from **news coverage and a social-listening
blog, not from individual store reviews** — important to flag clearly, since this mode specifically
asks for store reviews with handle + date, which none of these are:

1. **Delivery/payment failures** — money deducted without the order registering; delayed/non-delivered
   orders with unclear compensation. Sourced to SNN and YJC news articles ("بی‌تفاوتی اسنپ‌فود نسبت به
   اعتراض کاربران" — "SnappFood's indifference to user protests"), not to store reviews. No individual
   quote, handle, or star rating attached.
2. **FoodParty discount-authenticity complaint** — a Tejaratnews article (published **2023-03-04**,
   outside the preferred 12-month window) describing a user reporting a food item "discounted" via
   FoodParty from a sticker price that the delivery invoice showed was actually the undiscounted price.
   A paraphrased tweet was cited: *"اسنپ فود قیمت غذاها را بالا برد و در فودپارتی گذاشت!"* — flagged by
   the source session itself as possibly a paraphrase, not confirmed verbatim tweet text, and with no
   reviewer handle attached.
3. **Dataak.com Twitter/X sentiment analysis** — a year-long social-listening study concluding
   predominantly negative sentiment, framed around market-consolidation resentment. No theme breakdown,
   no tweet counts, no verbatim quotes obtained by that session.
4. **Generic coupon-failure complaints** (expired/mistyped/ineligible codes) — described as a
   market-wide pattern, not attributed to any individual reviewer.

**None of the above qualifies as a "store review" under this mode's evidence bar** (verbatim text +
reviewer handle + date, from an app-store or review-site listing). They are reproduced here only so
this corpus does not silently omit the one prior document that touches SnappFood's user sentiment, and
so a future session does not re-run the same searches expecting a different outcome — the source
session already tried and hit the same wall for Cafe Bazaar specifically.

## Contradiction check against existing profiles

None found. This session produced no new claims to contradict `profiles/snappfood-loyalty.md`, and I
did not carry forward any figure inconsistently with how that profile labeled it (Myket 4.3/5 kept as
search-synthesis/unsourced-URL; Cafe Bazaar kept as UNKNOWN, not silently upgraded to a number).

## What the task's evidence checklist would have required, and could not be attempted

Per the mode's source list, none of the following were reachable this session (blocked or
budget-exhausted before any query could target them):

1. `cafebazaar.ir/app/com.zoodfood.android` bare and `?l=en` — blocked (Step 1, row 2).
2. `myket.ir/app/com.zoodfood.android` — blocked (Step 1, row 3).
3. `play.google.com/store/apps/details?id=com.zoodfood.android&hl=fa` and `hl=en` — blocked (Step 1,
   row 4; `hl=en` not separately attempted once the domain-level block was confirmed).
4. apkpure / apkcombo / uptodown / aptoide comment pages — not attempted (WebFetch confirmed blocked
   at the domain-block level; WebSearch budget exhausted before any could be queried).
5. `appreview.ir`, `charkhoneh` — same, not attempted.
6. `apps.apple.com/.../id...?see-all=reviews` — SnappFood's iOS App Store ID was never established by
   any prior session either; **UNKNOWN whether SnappFood has an Apple App Store listing at all** (Iran
   sanctions make an absence plausible but this is not confirmed either way).
7. `trustpilot.com/review/snappfood.ir` (with `?page=2,3,4…` and `?stars=1,2` pagination) — not
   attempted.
8. G2, Capterra, GetApp, Sitejabber — not attempted; these are B2B software-review sites and SnappFood
   is a consumer marketplace app, so a genuine absence would be the expected outcome even with working
   tools (per the same reasoning already recorded for Fidilio and Foodism in their respective
   `store-reviews.md` files), but this remains unconfirmed, not assumed.
9. One-/two-star-first triage, then five-star — could not be performed at all; no reviews of any star
   rating were read.
10. App last-updated date — **UNKNOWN — not verified**, no store listing page was reached.

## Complaint themes — honest sample sizes

**No complaint theme can be assigned a `sample_size` drawn from reviews read this session, because
zero reviews were read this session.** The four themes carried forward from `snappfood-loyalty.md`
above are themes from **news articles and a social-listening blog**, not from a counted sample of
store reviews, so presenting them with a `sample_size` here would misrepresent what they are. They are
reported in the qualitative section above instead of the structured `complaints`/`praises` output, to
avoid manufacturing a false count.

**Praise themes: none found.** No positive-leaning store review, verbatim or paraphrased, with a
handle and date, exists anywhere in the Scout research line for SnappFood to date. The Myket
4.3/5-over-19,209 aggregate (above) implies a mostly-positive rated population, but that is an
aggregate number, not individual praise text I can quote or attribute.

## What this means for the audit line

The 50-review volume target was **not met — 0 reviews were read this session**, and the total known
verbatim-or-attributed-review corpus for SnappFood across every Scout session to date remains **0**
(unlike Fidilio, which has 3 fetched + 3 search-synthesized = 6 total from an earlier, luckier
session). This is a tooling-availability finding for this specific session, not a diligence failure:
both mandated fallback paths were tested first, confirmed unavailable with concrete error messages,
and the task's own escalation instruction ("ask the user to raise
CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION") is recorded here for whoever picks this up next. A future
session needs **either** a fresh WebSearch budget **or** working WebFetch to make first contact with
SnappFood's actual store review text — this session could do neither.

## Sources

**Attempted, not reached (WebFetch, all `EGRESS_BLOCKED`), accessed 2026-09-07:**
- https://example.com (control)
- https://cafebazaar.ir/app/com.zoodfood.android
- https://myket.ir/app/com.zoodfood.android
- https://play.google.com/store/apps/details?id=com.zoodfood.android&hl=fa

**Attempted, not reached (WebSearch, budget exhausted at 200/200 before any query ran), accessed
2026-09-07:** the 8 queries listed in the Methodology section above.

**Prior evidence cited, not re-verified this session:**
- `docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04 session) — full profile; see that
  file's own "Sources" and "What I did NOT verify" sections for its original citations (snapp.ir blog
  pages, coupon aggregators, SNN/YJC/Vananews/Tejaratnews news coverage, dataak.com social-listening
  blog, the Competition Council ruling page). None of those original sources were independently
  re-opened by this session.

## Structured-output note

`reviews_read = 0`. `webfetch_worked = false`. The `complaints`/`praises` arrays in the structured
summary are intentionally empty — per the mode's own rule, a complaint theme without a `sample_size`
drawn from reviews actually read is invalid, and this session read none. The four qualitative
news-sourced themes above are preserved in this file's prose (not the structured arrays) so the
information is not lost, but they are correctly excluded from a "store reviews at volume" count.
