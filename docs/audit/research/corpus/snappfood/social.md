# SnappFood — Social & Forums (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: SnappFood (اسنپ‌فود), key `snappfood`, tier `iran`_
_Mode: SOCIAL AND FORUMS (Persian X/Twitter, Telegram, Instagram comments, Reddit, forums,
news-comment sections, LinkedIn, and the restaurant-owner side: fees/payouts/support/exclusivity)_

## Headline finding — read this before anything else

**This session gathered zero new evidence.** Both mandated evidence channels were tested myself,
independently, before trusting the prior same-day session's claim that they were unavailable — and
both confirmed dead on my own tool calls, not just inherited as an assumption:

- `WebFetch` → `EGRESS_BLOCKED` on the neutral control (`example.com`) **and** on the primary target
  (`snappfood.ir`).
- `WebSearch` → both of my queries (one Persian, targeting Cafe Bazaar/Twitter complaint language; one
  hunting the exact task-specified sentence «دیگه استفاده نمیکنم چون…») returned the tool's own
  budget-exhausted message: *"this session has used its web search budget (200 of 200 WebSearch
  calls)."* This matches `corpus/snappfood/store-reviews.md`'s finding (written earlier the same day,
  2026-09-07) that the budget was already fully consumed by the Fidilio/SmartX/Foodism/RSEE corpus
  passes that ran before it in this same shared session. My own two calls confirm the wall is still
  there, not merely reported as there.

Per the task's own rule ("0 is a valid answer" / "never pad to hit a target"), `reviews_read = 0` for
this session. No X/Twitter post, Telegram message, Instagram comment, Reddit post, forum thread, or
news-comment was read by me this session — with named handle, date, and verbatim text — for SnappFood.

## Methodology — first action taken, per protocol

**Step 1 — WebFetch test (control + primary target):**

| # | URL | Result |
|---|---|---|
| 1 | `https://example.com` (neutral control) | `EGRESS_BLOCKED` — "Access to example.com is blocked by the network egress proxy." |
| 2 | `https://snappfood.ir` (primary target) | `EGRESS_BLOCKED` — "Access to snappfood.ir is blocked by the network egress proxy." |

The control failing identically to the real target confirms a blanket session-level network-egress
policy, not a per-domain block — consistent with every prior Scout session on this repo
(`profiles/snappfood-loyalty.md`, 2026-09-04; `corpus/snappfood/store-reviews.md`, 2026-09-07;
`corpus/fidilio/social.md`, 2026-09-07). `webfetch_worked = false` for this session. I did not spend
further WebFetch calls on mode-specific targets (t.me mirrors, nitter instances, twitter.com/x.com,
instagram.com) once the blanket block was confirmed on 2/2 — nitter mirrors resolve through the same
blocked egress per `corpus/fidilio/social.md`'s own finding the same day, and burning calls against an
already-proven blanket block would not produce new evidence.

**Step 2 — WebSearch fallback:**

| # | Query | Result |
|---|---|---|
| 1 | `"اسنپ فود" نظرات کاربران توییتر شکایت` | Budget-exhausted message (200/200) |
| 2 | `اسنپ فود "دیگه استفاده نمیکنم" چون` | Budget-exhausted message (200/200) |

I stopped after 2 queries rather than repeating the 8-query pattern `store-reviews.md` already ran
against the same exhausted budget — a third identical failure would not be new information, and the
task's own escalation instruction (raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`) cannot be
actioned by me inside this task; it is recorded here again for whoever next has a fresh budget.
`websearch_worked = false` for this session (0 of 2 queries returned any content).

## Prior research read first, per task instruction — this corpus extends, does not repeat

Read before writing anything below:
- `docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04 session; loyalty/rewards-scoped, but
  contains the only restaurant-owner-side and social-sentiment material on SnappFood found to date).
- `docs/audit/research/corpus/snappfood/store-reviews.md` (2026-09-07, same-day, earlier session;
  confirms the identical WebFetch/WebSearch wall and that zero individually-quoted, handle-attributed
  SnappFood store reviews exist in the research line to date).
- `docs/audit/research/profiles/fidilio.md` (2026-09-04) and `docs/audit/research/corpus/fidilio/social.md`
  (2026-09-07) — both cite SnappFood-adjacent material relevant to this mode (below).

**Nothing below is new evidence I gathered.** It is prior evidence, re-organized under this mode's
specific lens (restaurant-owner side; social-sentiment; forum/news-comment complaints) and clearly
re-cited to its original source and date, per the task's "extend rather than repeat" instruction. Where
a claim is carried forward, I say so explicitly rather than presenting it as freshly verified.

### Contradiction check against existing profiles

**None found.** No fact in `snappfood-loyalty.md`, `store-reviews.md`, or the SnappFood-adjacent
material in the Fidilio corpus contradicts any other. All are consistent on: SnappFood's 2017 founding
via ZoodFood/Snapp Group merger, the Competition Council's 1404 anticompetitive ruling, the Dec
2023/Jan 2024 data breach, and the absence (across every session to date) of any individually-quoted,
handle-and-date-attributed SnappFood social/forum post. I did not carry forward any figure with a
different label or precision than its source used.

---

## Finding 1 — Restaurant-owner side: fees, exclusivity, payout leverage (carried forward)

This is the mode's specific ask ("the RESTAURANT-OWNER side: fees, payouts, support, exclusivity") and
the strongest-sourced material available for it, all from `profiles/snappfood-loyalty.md`
(2026-09-04 session, not re-verified by me this session):

- **Competition Council ruling No. 740** (شورای رقابت), dated **16 Ordibehesht 1404 (≈2025-05-06)**:
  ruled SnappFood's restaurant contracts anticompetitive — specifically that SnappFood offered
  **commission discounts conditioned on exclusive cooperation**, with exit penalties for restaurants
  who tried to leave. An appeals board later confirmed the ruling; SnappFood's request for
  reconsideration was rejected; exclusive contract clauses were ordered removed. **Label: independent**
  — a government regulatory body's own ruling, independently reported by multiple outlets (Zoomit,
  Digiato, Ensafnews), not a company statement. [WebSearch synthesis, 2026-09-04, per
  `profiles/snappfood-loyalty.md` — `zoomit.ir/iran-news/456136-...`,
  `digiato.com/iran-technology-news/competition-council-votes-favor-tapsi-zoodex-snappfood`,
  `ensafnews.com/591739/...`, `nicc.gov.ir/council/decisions-council/2184-740-16-1404.html`]
  This ruling was triggered by complaints from rival platforms **TapsiFood and Zoodex** — i.e., the
  exclusivity complaint originated from competing platforms, not directly from an individual
  restaurant owner's public testimonial, a distinction worth keeping precise.
- **Commission rate: 15–20% of restaurant sales, plus 9% VAT on that commission, deducted before
  payout** — sourced to a single third-party restaurant-advisory magazine (`restobazar.com/mag/
  snapp-food-rules-for-restaurants/`), **not** SnappFood's own disclosed rate. **Label: search-synthesis
  of a third party**, not company-claimed and not independently corroborated by a second source.
  SnappFood's own public commission disclosure was searched for and not found (2026-09-04 session).
- **Who funds a FoodParty/coupon discount — restaurant or platform:** a secondary,
  marketing-adjacent source states *"رستوران‌ها خود کد تخفیف را برای جذب مشتری‌های بیشتر پیشنهاد
  می‌دهند و هزینه این تخفیف‌ها بر عهده رستوران است"* (restaurants themselves offer the discount code
  to attract more customers, and the cost of these discounts is borne by the restaurant) —
  restaurants accept a lower per-order margin for higher order volume/visibility. **Label:
  search-synthesis**, not a first-person restaurant-owner quote. Consistent with SnappFood's own
  vendor-academy tooling describing a **"پارتی دخل‌فود"** ("Dakhl-e-Food Party") feature restaurants
  themselves activate — implying opt-in, restaurant-funded promotions by default, not platform
  subsidy.
- **No first-person, named restaurant-owner testimonial** about fees, payouts, exclusivity, or support
  quality has been found by any Scout session to date, including this one. This remains **UNKNOWN —
  not found**, not assumed negative or positive.
- **Cross-reference from the Fidilio research line** (`profiles/fidilio.md`, 2026-09-04): a separate
  controversy exists over whether Fidilio's address data is shared/synced with SnappFood, covered by
  three independent outlets — Digiato (`digiato.com/iran-technology-news/is-fidilio-the-same-as-
  snappfood`, "آیا فیدیلیو همان اسنپ‌فود است؟" — "Is Fidilio the same as SnappFood?"), Tabnak, and
  Startup360 — with an on-record response from Fidilio's CEO calling it a "technical bug." The same
  Fidilio profile also cites a **Zoodex press conference alleging SnappFood monopolistic behavior**
  (`digiato.com/iran-technology-news/zoodex-press-conference-snappfood-monopolistic-behaviors`). Both
  are **about** SnappFood's market conduct/reputation from an adjacent competitor's research line, not
  independently re-verified by any SnappFood-focused session, and neither is a restaurant-owner
  testimonial — flagged here only because this mode's brief asks specifically about exclusivity and
  the adjacent research line surfaced two more data points touching it. **I did not open either source
  myself; this is a citation of what a sibling profile already found**, carried forward per the task's
  "extend, don't repeat" instruction, not fresh evidence.

## Finding 2 — Consumer-side social/sentiment signal (carried forward, all search-synthesis)

- **Dataak.com published a year-long Twitter/X sentiment analysis of SnappFood**
  (`dataak.com/blog/بررسی-رضایت-کاربران-توییتر-از-اسنپ-فود/`), concluding user sentiment was
  **predominantly negative**, framed around SnappFood having "eliminated its competitors" after 11
  years of operation and consolidated market control. **No specific tweet counts, no verbatim tweet
  text, no theme-by-theme breakdown (loyalty vs. delivery vs. price vs. support) was ever obtained** —
  the 2026-09-04 session that found this explicitly flagged that gap, and I could not close it this
  session (WebSearch/WebFetch both unavailable). This is a social-listening firm's own published
  analysis, not SnappFood's or a news outlet's — **label: search-synthesis, third-party analytics
  firm**, dated by publication context to sometime before 2026-09-04 but no more precise date is known.
- **One dated, paraphrased tweet exists in the entire SnappFood research line**: *"اسنپ فود قیمت
  غذاها را بالا برد و در فودپارتی گذاشت!"* (SnappFood raised food prices and put them in FoodParty!),
  attached to a Tejaratnews article published **2023-03-04** (`tejaratnews.com/startup/
  تخفیف-سفارش-غذا`, outside the task's preferred 12-month recency window) describing a user reporting
  a food item "discounted" via FoodParty from a sticker price that the delivery invoice showed was
  actually the *undiscounted* price. The 2026-09-04 session that surfaced this flagged explicitly that
  it could not confirm this is verbatim tweet text rather than the news outlet's own paraphrase, and no
  handle/username is attached to it anywhere in the sourcing chain. **Per this task's evidence rule
  ("only text that appeared inside quotation marks in a search result may be presented as a quote"),
  this is presented as a quote because it appeared in quotation marks in the original search result —
  but with the handle-attribution gap stated plainly: no reviewer/poster handle was ever obtained.**
- **A separate, undated complaint pattern** (2026-09-04 session, via a query touching `vananews.com`
  coverage): a user bought a discounted pastry item, then received an SMS from SnappFood demanding
  payment of the price difference — a coupon honored at checkout, partially clawed back after the
  fact. **UNKNOWN — not verified** whether isolated or repeated; one description found, no count, no
  handle, no exact date.
- **General fulfillment/trust complaints** (not loyalty/social-specific, but the dominant complaint
  signal found in this research line): SNN and YJC news coverage, both titled variants of
  "بی‌تفاوتی اسنپ‌فود نسبت به اعتراض کاربران" ("SnappFood's indifference to user protests")
  (`snn.ir/fa/news/1146095/...`, `yjc.ir/fa/news/8734093/...`), and Vananews's
  "انبوه شکایات کاربران از اسنپ فود/ بی تفاوتی مدیران اسنپ" (`vananews.com/fa/news/409695/...`) —
  describing money deducted from a user's account without the order registering, and delayed/
  non-delivered orders with unclear compensation. These are **news-article syntheses of an unspecified
  volume of user complaints**, not individual quoted posts with handles — the articles themselves
  describe an aggregate pattern ("انبوه" = "a mass/pile of"), without a countable sample I can attach a
  `sample_size` to.
- **No search or forum result in any session to date has produced the exact task-specified sentence**
  «دیگه استفاده نمیکنم چون…» ("I stopped using it because…") attributed to a named poster with a date,
  for SnappFood. **UNKNOWN — not found**, despite this session's own attempt (query #2 above) and the
  prior session's broader search activity before its budget was exhausted.

## Finding 3 — Trust/security backdrop relevant to social sentiment (carried forward, independent)

- **SnappFood data breach, Dec 2023 (10 Dey 1402 / ≈2023-12-31–2024-01):** IRLeaks hacker group;
  reportedly affecting **20M+ users**; SnappFood issued its own confirming public statement. **Label:
  independent** — covered by four separate outlets (Shahr-e-Sakht-Afzar, Digiato, Farnet, Tasnim News),
  not merely a company claim, though SnappFood's own confirming statement is also part of the record.
  [`shahrsakhtafzar.com/fa/news/security/48933-snapfood-hacked`,
  `digiato.com/iran-technology-news/snapfood-issued-statement-hacking-platform`,
  `farnet.io/1402/10/351276/snappfood-hacked/`, `tasnimnews.com/fa/news/1402/10/10/3014883/...`,
  all per `profiles/snappfood-loyalty.md`, 2026-09-04]. This is a real, dated, large-scale trust
  incident that plausibly underlies some share of the negative sentiment Dataak's analysis found, but
  **no source anywhere in this research line explicitly connects the breach to the sentiment-analysis
  findings** — that link is my own inference across two separate prior findings, not a claim either
  original source made, and is flagged as such rather than presented as confirmed causation.

## Channels attempted by this mode's brief and their status

| Channel | Status this session | Note |
|---|---|---|
| Persian X/Twitter (direct search or nitter mirror) | Blocked/exhausted | WebFetch blocked on the domain-block level (per `corpus/fidilio/social.md`'s same-day finding that nitter mirrors route through the same blocked egress); WebSearch budget exhausted before any query could target it directly this session |
| Telegram channels/groups (t.me, telegram web previews) | Not attempted | WebFetch confirmed blocked at the blanket level before this channel-specific URL was tried; would not have produced a different result |
| Instagram comments/posts | Not attempted | Same reasoning |
| Reddit (r/iran, r/restaurateur, r/KitchenConfidential, city subs) | Not attempted | Same reasoning — also, no prior session has found any Reddit thread mentioning SnappFood by name |
| Persian forums / news-comment sections (Digiato, Zoomit, Tejaratnews comments) | Partially covered via carried-forward article-level (not comment-level) coverage only — see Finding 2 | No individual comment-section post was ever read by any session |
| LinkedIn posts by restaurant owners | Not attempted | No prior session found any LinkedIn post on SnappFood either |

## What this means for the audit line

The 50+/volume expectation implicit in "count themes with sample sizes" cannot be met honestly this
session: **zero individual social/forum posts were read, by me, this session.** The one quoted tweet
fragment in the entire SnappFood research line (FoodParty price-inflation, 2023-03-04) has no
attributed handle and is 3.5 years old; the Dataak sentiment analysis has a topline verdict but no
theme breakdown or countable sample; the SNN/YJC/Vananews complaint coverage describes an aggregate
pattern from unspecified numbers of users, not individually quotable posts. Per the audit rule ("a
complaint theme count without a sample size is invalid — never pad to hit a target"), the structured
`complaints`/`praises` output for this task is left **empty** rather than assigning a fabricated or
inflated `sample_size` to any of the above. All of the above qualitative material is preserved here in
full, with its original source and date, so it is not lost — it is excluded from the structured counts
only because none of it meets this mode's own evidence bar (verbatim text + handle + date, individually
read).

## Sources

**This session's own attempts (all failed), accessed 2026-09-07:**
- https://example.com — WebFetch, `EGRESS_BLOCKED`
- https://snappfood.ir — WebFetch, `EGRESS_BLOCKED`
- WebSearch query `"اسنپ فود" نظرات کاربران توییتر شکایت` — budget exhausted (200/200)
- WebSearch query `اسنپ فود "دیگه استفاده نمیکنم" چون` — budget exhausted (200/200)

**Prior evidence cited, not re-verified this session:**
- `docs/audit/research/profiles/snappfood-loyalty.md` (2026-09-04 session) — restaurant-owner/
  exclusivity, Dataak sentiment analysis, FoodParty complaint, SMS-clawback complaint, SNN/YJC/Vananews
  coverage, data-breach coverage. See that file's own "Sources" section for every original URL.
- `docs/audit/research/corpus/snappfood/store-reviews.md` (2026-09-07, same-day, earlier session) —
  confirms the identical tooling wall and zero individually-quoted store reviews.
- `docs/audit/research/profiles/fidilio.md` (2026-09-04) — the Digiato/Tabnak/Startup360
  "Is Fidilio the same as SnappFood" address-sync controversy and the Zoodex-press-conference citation.
- `docs/audit/research/corpus/fidilio/social.md` (2026-09-07, same-day) — confirms nitter mirrors are
  also blocked by the same egress policy.

## Structured-output note

`reviews_read = 0`. `webfetch_worked = false`. The `complaints`/`praises` arrays in the structured
summary are intentionally empty, for the reason given under "What this means for the audit line" above
— every qualitative theme this corpus documents is preserved in prose with its real source and date,
but none of it carries a genuine, individually-counted `sample_size` this session (or any prior
session) actually produced. `features` and `key_claims` in the structured summary carry forward only
what prior sessions already established, each labeled with its original evidence status, since this
session verified nothing new on either front.
