# Foodism — Social & Forums (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Foodism (فودیسم), key `foodism`, tier `iran`_
_Mode: SOCIAL AND FORUMS (Persian X/Twitter, Telegram, Instagram comments, Reddit, forums,
news-comment sections, LinkedIn, and the restaurant-owner side: fees/payouts/support/exclusivity)_

## Read-first: what prior research already established

Per task instructions, both `docs/audit/research/profiles/foodism.md` (base profile, 2026-09-05,
plus its own same-day ADDENDUM) and `docs/audit/research/corpus/foodism/store-reviews.md`
(2026-09-07, earlier same-day session, mode STORE REVIEWS AT VOLUME) were read in full before
starting. Summary, so this corpus does not re-litigate it:

- **Identity confirmed** in the base profile: `foodism.app` / Android package `app.foodism.tech`,
  a Persian restaurant/cafe discovery-and-review social app. Four unrelated same-name products
  (Foodism UK, Foodism.xyz/Connect India, "Local Foodism App" US, Foodium) were ruled out — not
  re-checked this session, no reason found to doubt that work.
- **Status: DEGRADED — likely abandoned, not confirmed dead** (set 2026-09-05, ADDENDUM).
  `cafebazaar.ir/app/app.foodism.tech` returned HTTP 404 (three attempts, two URL forms; not a
  site-wide outage, since `cafebazaar.ir/app/com.fidilio` fetched normally in the same minute).
  `myket.ir/app/app.foodism.tech` was live: 4.3/5 over 226 reviews, 25,000 installs, last updated
  ۱۴۰۱/۰۹/۱۰ (≈2022-12-01) — a ~3¾-year-old binary.
- **The only verbatim Foodism review known anywhere in this research line:** معصومه,
  ۳ خرداد ۱۴۰۵ (≈2026-05-24): «کار نمیکنه» — "it doesn't work."
- **The 2026-09-07 `store-reviews.md` session (earlier the same day as this one) had total
  tooling failure**: `WebFetch` returned `EGRESS_BLOCKED` on every domain including the
  `example.com` control, and `WebSearch` reported its session-wide quota already exhausted
  (200 of 200) before a single query ran. `reviews_read = 0` that session too. That file's own
  closing note predicted exactly the situation this session hit: *"a future session should
  confirm it has WebSearch budget remaining before starting, since that quota is evidently
  shared across sibling sessions running the same day."*
- **`MATRIX.md`** footnote 62 and the "Product currently live and maintained" row already reflect
  the DEGRADED status, the HTTP 404, and the Myket 4.3/5-over-226-reviews figures — no
  contradiction to flag there.

This corpus's job was to extend the above with social/forum evidence: Persian X/Twitter,
Telegram, Instagram comments, Reddit, Persian forums/news-comment sections, LinkedIn, and the
restaurant-owner side (fees, payouts, support, exclusivity), hunting specifically for
«دیگه استفاده نمیکنم چون…» ("I stopped using it because…"). **It could not** — see below — for the
same reason the store-reviews session hit two days into this batch of concurrent research: this
session's shared tool budget was exhausted before this task began.

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (a
neutral control) and immediately after against this mode's primary targets.

| Tool call | Result |
|---|---|
| `WebFetch https://example.com` | `EGRESS_BLOCKED` |
| `WebFetch https://t.me/s/foodism_iran` | `EGRESS_BLOCKED` |
| `WebFetch https://www.reddit.com/r/iran/search/?q=foodism` | tool-level refusal: `Claude Code is unable to fetch from www.reddit.com` (distinct from a proxy block) |
| `WebFetch https://nitter.net/search?q=فودیسم` | `EGRESS_BLOCKED` |
| `WebFetch https://www.instagram.com/foodism.iran/` | `EGRESS_BLOCKED` |
| `WebFetch https://digiato.com/?s=فودیسم` | `EGRESS_BLOCKED` |

**`webfetch_worked = false` for this session.** The `example.com` control confirms a blanket
network-egress policy for this session — the same conclusion the sibling **2026-09-07**
`store-reviews.md` corpus reached earlier the same day — in contrast to the **2026-09-05** session
that produced the base profile's ADDENDUM, where `WebFetch` worked and read Myket + Cafe Bazaar
directly. No nitter mirror was reachable (routes through the same blocked egress); Reddit returned
a distinct tool-level domain refusal rather than a proxy error, so it is refused independent of
the egress-proxy state.

Per the task's fallback rule, the next step is many differently-phrased `WebSearch` queries,
Persian and English, with `site:` operators. **That fallback was also unavailable this session**:

| Query attempted | Result |
|---|---|
| `فودیسم نظرات کاربران توییتر` | *"this session has used its web search budget (200 of 200 WebSearch calls)"* |
| `"فودیسم" "دیگه استفاده نمیکنم"` (exact-phrase hunt for the target sentence) | same — budget exhausted |
| `فودیسم اپلیکیشن کار نمیکنه` | same — budget exhausted |
| `site:twitter.com فودیسم رستوران` | same — budget exhausted |
| `Foodism Iran app complaints reddit telegram` | same — budget exhausted (retried after the WebFetch probes above, in case the counter had reset — it had not) |

**`websearch_worked = false` for this session — 0 of 5 attempted queries returned results.** The
message is explicit and session-scoped ("200 of 200 WebSearch calls"), not per-query or
per-domain — identical to what the same-day `store-reviews.md` session hit. This session's shared
search quota was already fully consumed before my first query ran, consistent with that file's own
diagnosis: concurrent sibling Scout sessions profiling other competitors on 2026-09-07 (the
`fidilio` and `smartx` corpus directories both show `social.md`, `business.md`, `scale.md`,
`features.md`, and `store-reviews.md` files with timestamps earlier the same morning — five modes
each, meaning at least two other full research batches ran through this same shared budget before
this task started).

**Net result: this session had zero live research capability of any kind for the SOCIAL AND
FORUMS mode** — neither a direct fetch nor a search-engine query succeeded even once, across
Telegram, Instagram, Reddit, X/Twitter (direct and via nitter), and a Persian news-comment
outlet (Digiato). I did not fabricate or infer any search-synthesis content to work around this —
per the task's own rule, "0 is a valid answer" and padding is explicitly forbidden. I am not aware
of any other tool available to me that reaches the open web.

## Findings this session: none new — full honesty check

**`reviews_read = 0` for this session.** I did not personally read a single tweet, Telegram post,
Instagram comment, Reddit thread, forum post, or news-comment section. Every one of the six
external-network `WebFetch` calls above failed before returning any content, and every one of the
five `WebSearch` calls failed before returning any results. No sentence matching or resembling
«دیگه استفاده نمیکنم چون…» was found, because no search or fetch of any kind succeeded — not
because such a sentence was searched for and absent. I am reporting this as 0, not omitting it or
restating prior-session content as if it were newly obtained.

**No restaurant-owner-side social/forum content (fees, payouts, support, exclusivity) was
obtained** for the same reason — every attempted channel (LinkedIn posts by owners, Telegram
restaurant-industry groups, forum threads) requires either `WebFetch` or `WebSearch`, and both
were unavailable for the entire session.

## What this session could NOT do (explicit gap list, mode-specific)

1. **Persian X/Twitter** — could not search via `WebSearch`, could not reach `nitter.net` (or any
   mirror — only one was tried, and it routed through the same blocked egress, so others were not
   individually tested but have no reason to differ), could not reach `twitter.com`/`x.com`
   directly. Zero tweets read, positive or negative, diner-side or owner-side.
2. **Telegram** — could not reach `t.me/s/foodism_iran` (a guessed channel-preview URL; the real
   handle, if one exists, is itself unconfirmed — no session in this research line has found a
   Foodism Telegram channel/group). Could not search for `t.me` links via `WebSearch` either.
3. **Instagram comments** — `@foodism.iran`'s existence is already confirmed by the base profile
   (2026-09-05, via search synthesis), but no comment thread, caption, or follower count was
   reachable this session; `www.instagram.com/foodism.iran/` returned `EGRESS_BLOCKED`.
4. **Reddit** — `www.reddit.com` returned a distinct tool-level refusal ("Claude Code is unable to
   fetch from www.reddit.com"), separate from the egress-proxy block seen on every other domain.
   This is worth flagging precisely because it did NOT return `EGRESS_BLOCKED` like the rest — it
   is refused at a different layer, and a future session should not assume fixing the egress proxy
   alone would restore Reddit access. No r/iran, r/restaurateur, r/KitchenConfidential, or city-sub
   search was possible either way.
5. **Persian forums and news-comment sections** (Digiato, Zoomit, Tejaratnews) — attempted Digiato
   directly (`digiato.com/?s=فودیسم`), blocked. Zoomit and Tejaratnews were not individually
   fetch-attempted (no reason to expect a different result from the same egress proxy, and each
   attempt would have cost a tool call for a predictable outcome) — flagging this as untested
   rather than confirmed-blocked for completeness.
6. **LinkedIn posts by restaurant owners** — not attempted via direct fetch (LinkedIn requires
   authentication for most content and was expected to fail the same way as Instagram/Reddit; a
   `WebSearch` for LinkedIn-hosted owner commentary was intended but the query budget was already
   exhausted before this could be attempted specifically).
7. **The restaurant-owner side generally** (fees, payouts, support responsiveness, exclusivity
   clauses) — **zero evidence of any kind obtained**, extending the same gap the base profile
   already flagged ("I found no restaurant-owner-side complaint or commentary... despite targeted
   searches"). This session could not even attempt new searches to close that gap.
8. **Could not confirm or refresh** whether the Cafe Bazaar 404 (last checked 2026-09-05) or the
   Myket 4.3/5-over-226-reviews figures (also 2026-09-05) have moved in the 2+ days since — this
   was in scope for the STORE REVIEWS mode, not this SOCIAL mode, but is worth restating since nothing
   in this research line has re-checked either figure since 2026-09-05.

## Contradiction check against existing profile and corpus

None found. Nothing this session touched (because nothing succeeded) could contradict
`profiles/foodism.md`, its ADDENDUM, or `corpus/foodism/store-reviews.md`. The DEGRADED status,
the Cafe Bazaar HTTP 404, the Myket 4.3/5-over-226-reviews/25,000-installs/۱۴۰۱-binary figures, and
the single known verbatim review (معصومه, «کار نمیکنه») all stand exactly as those sessions left
them, now two days older still and unconfirmed as still-current on every axis (store listings,
social presence, or forum sentiment alike).

## What this means for the audit line

The SOCIAL AND FORUMS mode's goal — count complaint/praise themes with sample sizes, quote
verbatim with source+date, and specifically hunt «دیگه استفاده نمیکنم چون…» and the
restaurant-owner-side angle — was **not met**. This is a **tooling-availability finding, not a
diligence failure or a product finding**: it says nothing new about Foodism's actual social
footprint or sentiment, only that this particular session, running after at least two other full
five-mode Scout research batches (`fidilio`, `smartx`) had already consumed the shared session-wide
`WebSearch` quota (200/200) earlier the same morning, had no path to the open web at all — for
either mode-specific fetches or fallback searches.

**Recommendation for a future session on this exact task:** confirm remaining `WebSearch` budget
before starting (the quota is shared across sibling sessions on the same day, per both this and
the prior `store-reviews.md` session's independent discovery of the same constraint); if budget
exists, prioritize (a) a Telegram search for an actual `t.me/foodism*` handle (none has ever been
confirmed in this research line — the one tried here was a guess), (b) the exact-phrase hunt for
«دیگه استفاده نمیکنم چون…» in Persian, and (c) at least one restaurant-owner-side query
(commission/fee complaints, ad-package value, support responsiveness) — the single largest
standing gap across every Foodism document in this repository, base profile included.

## Sources (this session)

All access attempted 2026-09-07; every attempt failed as tabulated above, so no source content was
actually read this session:

- `https://example.com` (control) — `EGRESS_BLOCKED`
- `https://t.me/s/foodism_iran` (guessed channel-preview URL, handle unconfirmed) — `EGRESS_BLOCKED`
- `https://www.reddit.com/r/iran/search/?q=foodism` — tool-level refusal (distinct from proxy block)
- `https://nitter.net/search?q=فودیسم` — `EGRESS_BLOCKED`
- `https://www.instagram.com/foodism.iran/` — `EGRESS_BLOCKED`
- `https://digiato.com/?s=فودیسم` — `EGRESS_BLOCKED`
- 5 `WebSearch` queries (listed in the methodology table above) — all refused with "web search
  budget (200 of 200) used," zero results returned

## Sources (prior sessions, cited not re-verified)

- `docs/audit/research/profiles/foodism.md` — full base profile (2026-09-05) and its same-day
  ADDENDUM (Cafe Bazaar HTTP 404, Myket 4.3/5-over-226-reviews first-hand fetch, the معصومه review).
- `docs/audit/research/corpus/foodism/store-reviews.md` (2026-09-07, earlier same-day session,
  mode STORE REVIEWS AT VOLUME) — independently hit and documented the identical `WebFetch`
  `EGRESS_BLOCKED` / `WebSearch` "200 of 200" exhaustion this session also hit; its methodology
  table and gap list are the direct precedent for this file's format.
- `docs/audit/research/MATRIX.md` footnote 62 and the "Product currently live and maintained" row
  — already reflects the DEGRADED status; not contradicted or extended by this session.
