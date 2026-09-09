# RSEE (آرسی) — Social & Forums (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: RSEE / آرسی (`rsee.ir`), key `rsee`, tier `iran`_
_Mode: SOCIAL AND FORUMS (Persian X/Twitter, Telegram channels/groups, Instagram comments/posts,
Reddit — r/iran, r/restaurateur, r/KitchenConfidential, city subs — Persian forums and news-comment
sections (Digiato/Zoomit/TejaratNews), LinkedIn posts by restaurant owners; target sentence
«دیگه استفاده نمیکنم چون…» / "I stopped using it because…"; also the restaurant-owner side: fees,
payouts, support, exclusivity)_

## Prior art read first (per task instruction) — this file extends, does not repeat

Read in full before starting:

- `docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
  dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` pass against `rsee.ir`
  directly). Establishes: RSEE is the only live, dedicated, consumer-facing Iranian
  table-reservation product found in this research programme; the chair-credit ("آرسی" = 1 seat)
  prepay-to-book mechanic with 50–100% forfeiture on late cancellation; restaurant-side pricing
  (پلن ۱ رایگان ۴ماهه، پلن ۲ ۹۹۰,۰۰۰ تومان/۱۲ماهه، پلن ۳ ۲,۹۹۰,۰۰۰–۳,۹۹۰,۰۰۰ تومان)؛ claims "۲۰۰۰+"
  partner venues (company-claimed, unaudited); `/plans`, `/rules`, `/faq` all HTTP 404 `[fetched —
  negative result]`.
- `docs/audit/research/corpus/rsee/social-adjacent` — none exists; the only prior corpus file for
  this competitor is `docs/audit/research/corpus/rsee/store-reviews.md` (2026-09-07, earlier the
  same day, mode STORE REVIEWS AT VOLUME). That session found **both** `WebFetch` (`EGRESS_BLOCKED`
  on every domain tested, including the `example.com` control) **and** `WebSearch` (session-wide
  budget already exhausted at 200/200 before either of its two queries could run) unavailable, and
  read **zero** reviews. It explicitly flags "no discoverable independent review corpus for RSEE"
  as the single biggest evidentiary gap in the whole RSEE research line and names the exact
  follow-up queries a session with working tools should run.
- `docs/audit/research/MATRIX.md` footnote 56 and the "Independent, third-party-reviewable
  footprint" row — RSEE is marked **ABSENT**, "no app-store listing located and no independent
  review corpus of any kind found for the only live Iranian competitor. The biggest gap in batch
  3."
- `docs/audit/research/WATCH.md` 2026-09-05 entry — same chair-credit mechanic, same pricing, no
  social/forum data of any kind logged there either.

No prior session — profile pass, store-reviews pass, or discovery sweep — has ever surfaced an
Instagram handle, Telegram channel, X/Twitter account, Reddit thread, forum post, or news-comment
mention of RSEE specifically. This session's assignment was to close exactly that gap for the
social/forum axis. It did not succeed, for the reasons below — which is itself consistent with,
not contradictory to, the store-reviews.md session's finding of a shared-tooling outage.

## Methodology — both primary tools tested and confirmed unavailable this session

**First action taken, per protocol:** `WebFetch` tested against a neutral control, then against
mode-specific primary targets (RSEE's own site, a plausible Instagram handle, a plausible Telegram
channel).

| # | URL tested | Purpose | Result |
|---|---|---|---|
| 1 | `https://example.com` | Neutral control | `EGRESS_BLOCKED` |
| 2 | `https://rsee.ir` | Primary target (RSEE's own site) | `EGRESS_BLOCKED` |
| 3 | `https://t.me/s/rsee` | Telegram channel preview (guessed handle) | `EGRESS_BLOCKED` |
| 4 | `https://www.instagram.com/rsee.ir/` | Instagram profile (guessed handle) | `EGRESS_BLOCKED` |

All four calls returned `error_type: "EGRESS_BLOCKED"` directly from the tool, with the message
"Access to `<domain>` is blocked by the network egress proxy." The `example.com` control failing
identically to the three mode-specific targets rules out a per-domain block and confirms a
session-wide network-egress policy, not something specific to RSEE, Telegram, or Instagram.

A diagnostic `curl -sS "$HTTPS_PROXY/__agentproxy/status"` (the check named in this environment's
own instructions for exactly this situation) was attempted for a raw confirmation, matching the
store-reviews.md session's methodology. That command was **blocked by this session's own
Bash-permission classifier** ("Permission for this action was denied by the Claude Code auto mode
classifier") before it could run, so no proxy-log excerpt could be captured this session — this is
a different, narrower failure than the store-reviews.md session hit, and is noted rather than
worked around. It does not weaken the WebFetch finding above: `EGRESS_BLOCKED` is returned as a
structured `error_type` directly by the tool itself on every call, not inferred from a log tail.

**`webfetch_worked = false` for this session.**

**Fallback attempted, per protocol:** `WebSearch` with differently-phrased Persian and English
queries, per the task's mode-specific hints.

| # | Query | Result |
|---|---|---|
| 1 | `آرسی rsee.ir «دیگه استفاده نمیکنم» رزرو میز` | Budget exhausted (200/200) |
| 2 | `آرسی رزرو میز t.me telegram` | Budget exhausted (200/200) |

Both calls returned the identical, deterministic tool response: *"Web search was not performed:
this session has used its web search budget (200 of 200 WebSearch calls). Continue with the
information already gathered instead of issuing more searches."* This is the same shared,
session-wide (not per-competitor, not per-mode) budget the store-reviews.md session documented
being exhausted before either of its own two queries returned a result. Per this repo's own guard
philosophy — a deterministic, numeric exhaustion message ("200 of 200") does not become less true
on a third or fourth identical call — no further `WebSearch` calls were issued after the second.
Burning additional calls to re-confirm a proven, deterministic block would not be "real effort"
under the task's evidence rule; it would be noise, and every planned query below was left unrun
specifically so a future session with budget does not have to re-derive the list.

**Planned queries left unrun** (Persian phrasing per the task's own hints, English variants, and
`site:` operators), listed so no future session has to reconstruct this list from scratch:

- `«دیگه استفاده نمیکنم چون» آرسی` / `«دیگه استفاده نمیکنم چون» rsee`
- `آرسی رستوران بسته رزرو` / `آرسی لغو رزرو` (verbatim task-brief hints)
- `site:twitter.com OR site:x.com آرسی رزرو` / `site:t.me آرسی رزرو`
- `site:instagram.com rsee.ir` / `"rsee.ir" اینستاگرام`
- `آرسی رزرو میز شکایت` / `آرسی رزرو میز مشکل` / `آرسی کنسل رزرو پول`
- `آرسی صاحب رستوران کارمزد` / `آرسی رستوران تسویه حساب` (restaurant-owner-side: fees, payouts)
- `آرسی رستوران انحصار قرارداد` (exclusivity clause hunt)
- `site:reddit.com/r/iran rsee OR آرسی`
- `RSEE Iran restaurant reservation complaint Twitter`
- `آرسی اپلیکیشن دیجیاتو OR زومیت OR تجارت‌نیوز`
- `linkedin.com آرسی رزرو رستوران`

## Reviews/posts read this session: 0

Per the task's own rule ("Never invent... 0 is a valid answer" / "Never pad to hit a target"), this
is reported plainly and matches the store-reviews.md session's finding exactly. No tweet, Telegram
message, Instagram comment, Reddit post, forum thread, news-comment, or LinkedIn post about RSEE —
from either the diner side or the restaurant-owner side — was opened, read, or search-synthesized
this session. No handle, no date, no verbatim quote, no follower/member count, no theme, and no
sample size was obtained for any platform in this mode's scope.

## Findings — an honest gap table, not a filled-in matrix

No field below could be independently confirmed or refreshed this session. Every row is
`UNKNOWN — not verified`, restated explicitly per-platform (rather than one blanket line) because
the task requires each claim to carry its own evidence, and "no evidence obtained" is itself a
distinct claim per platform:

| Platform | Presence found? | Follower/member count | Complaint/praise content | Evidence type |
|---|---|---|---|---|
| X / Twitter (Persian) | UNKNOWN — not verified | UNKNOWN — not verified | UNKNOWN — not verified | none obtained |
| Telegram channel/group | UNKNOWN — not verified (`t.me/s/rsee` untested beyond the blocked fetch above; existence neither confirmed nor ruled out) | UNKNOWN — not verified | UNKNOWN — not verified | none obtained |
| Instagram | UNKNOWN — not verified (`instagram.com/rsee.ir` untested beyond the blocked fetch above; existence neither confirmed nor ruled out) | UNKNOWN — not verified | UNKNOWN — not verified | none obtained |
| Reddit (r/iran, r/restaurateur, r/KitchenConfidential, city subs) | UNKNOWN — not verified | N/A | UNKNOWN — not verified | none obtained |
| Persian forums / news-comment sections (Digiato, Zoomit, TejaratNews) | UNKNOWN — not verified | N/A | UNKNOWN — not verified | none obtained |
| LinkedIn (restaurant-owner posts) | UNKNOWN — not verified | N/A | UNKNOWN — not verified | none obtained |
| Nitter mirrors (X fallback) | Not reachable — nitter instances resolve through the same blocked egress as every other tested domain | N/A | N/A | none obtained |

### The target sentence («دیگه استفاده نمیکنم چون…» / "I stopped using it because…")

UNKNOWN — not verified. Never searched successfully this session (query #1 above, which included
this exact phrase, hit the exhausted budget before returning a result). No prior Scout session for
RSEE — profile pass, store-reviews pass, or discovery sweep — has ever run this specific hunt
either, so this remains a fully open action for a future session, not narrowed at all by this one.

### Restaurant-owner side (fees, payouts, support, exclusivity)

UNKNOWN — not verified, for every sub-claim (fee structure beyond the already-published plan
prices, payout/settlement timing, support responsiveness, any exclusivity clause). The one
adjacent, already-documented fact — RSEE's `/rules` page returns HTTP 404 (per
`profiles/iran-reservation-longtail.md`, `[fetched]` 2026-09-05) — means even RSEE's *own* terms
are not independently reachable, let alone third-party commentary on them. `MATRIX.md`'s
"No exclusivity/lock-in clause forcing single-platform use" row already carries this exact
UNKNOWN for RSEE with the same 404 citation; this session adds no new information to it.

### Complaint themes / praise themes — counts and sample sizes

**No theme in this file carries a sample size greater than zero**, per the task's own rule that "a
complaint theme count without a sample size is invalid" and the instruction to never pad to hit a
target. There is no social-media or forum-derived complaint or praise corpus for RSEE from this
session, and — per the prior art read above — none from any earlier Scout session either. This is
the third distinct research pass (2026-09-05 profile fetch, 2026-09-07 store-reviews pull, this
2026-09-07 social/forums pull) to come up with zero independent user-authored content of any kind
for the only live dedicated Iranian table-reservation competitor.

## Feature verification status (this mode's intended contribution)

Per the task's REAL/CLAIMED/UNKNOWN/ABSENT taxonomy, restricted to what a social/forum pass
specifically could have added (independent social-proof of feature use, or an owner-side complaint
confirming/denying a claimed feature) versus what is already established from the site fetch:

| Feature/claim | Status | Evidence |
|---|---|---|
| "۲۰۰۰+" partner venues | CLAIMED — unchanged from prior pass | Company-claimed, `rsee.ir` `[fetched]` 2026-09-05, prior session; no social/forum corroboration or refutation found this session |
| Diners actually experience the chair-credit mechanic as described (vs. marketing copy) | UNKNOWN — not verified | No diner social-media account of using RSEE was found this session |
| Restaurant owners report on fees/payouts/support | UNKNOWN — not verified | No owner-side post, forum thread, or LinkedIn content found this session |
| Any social-media presence at all (existence, not sentiment) | UNKNOWN — not verified | Neither confirmed nor ruled out; two guessed handles (`t.me/s/rsee`, `instagram.com/rsee.ir`) could not be tested because `WebFetch` itself was blocked before the handle could be checked, so a negative fetch result here would not even mean "handle doesn't exist" — it means "never reached" |

## Contradiction check against existing profile and prior corpus

None found. This session obtained no new data of any kind — there is nothing in this file that
could confirm or contradict `profiles/iran-reservation-longtail.md`'s RSEE section,
`corpus/rsee/store-reviews.md`, or `MATRIX.md`'s RSEE cells. The one thing this session adds is
procedural corroboration: a **third**, independently-timed (later the same day) attempt, hitting
the identical dual failure mode (`WebFetch` blanket-blocked confirmed via a neutral control, and
`WebSearch` at the identical "200 of 200" exhaustion message) that `store-reviews.md` already
documented for its own, earlier session. That two same-day sessions on the same competitor hit the
same shared-budget wall is weak evidence the outage is a real, session-programme-wide condition
(consistent with `_discovery-round1.md`'s and other competitors' `social.md`/`store-reviews.md`
files logging the same blockage pattern around the same timestamps) — not proof RSEE specifically
has no social presence, and not proof the outage is anything other than tooling exhaustion shared
across the many concurrent Scout sessions this task brief says are writing to this repo right now.

## What this means for the audit line

The task's implicit goal — theme counts with sample sizes, verbatim quotes with source+date, the
«دیگه استفاده نمیکنم چون…» hunt, and the restaurant-owner-side fee/payout/exclusivity angle — was
**not met**. Zero posts were read this session, and (per the prior-art check above) zero have ever
been read for RSEE across any Scout session's social/forum axis specifically. Combined with
`store-reviews.md`'s zero app-store reviews, **RSEE — the single most important Iran-tier
competitor in this research programme, being the only live dedicated head-on competitor — now has
a completely empty independent-evidence corpus across every mode attempted so far**: no app-store
review, no social-media post, no forum thread, no news-comment, no LinkedIn post. Every fact this
programme holds about RSEE traces to one source: RSEE's own site (`rsee.ir` root, `[fetched]`
2026-09-05), which is company-claimed by definition. That is a first-class finding in its own
right — not a footnote — and it should be surfaced to the founder directly rather than left as an
accumulating series of "session had no tools" notes: **either RSEE genuinely has no discoverable
independent footprint of any kind (itself notable for a product claiming 2,000+ venues), or three
consecutive Scout sessions have all been tooling-starved before they could find out, and nobody yet
knows which.**

The single highest-value unresolved action, unchanged in kind from `store-reviews.md` and now
sharpened: (1) get either `WebFetch` or a **non-exhausted** `WebSearch` budget working in the same
session, (2) run the full unrun query list above — the exact-phrase hunt, the `site:` operators on
Twitter/X, Telegram, Instagram, Reddit and LinkedIn, and the restaurant-owner-side fee/payout/
exclusivity terms — and (3) if that pass also comes back empty, treat "RSEE has no discoverable
independent footprint anywhere" as a confirmed, not merely suspected, finding.

## Sources (this session)

All access attempts dated 2026-09-07.

**WebFetch (all four `EGRESS_BLOCKED`):** `https://example.com` (control), `https://rsee.ir`
(primary target), `https://t.me/s/rsee` (guessed Telegram handle, untested for existence),
`https://www.instagram.com/rsee.ir/` (guessed Instagram handle, untested for existence).

**Proxy diagnostic attempted, blocked before running:** `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
— denied by this session's own Bash-permission classifier before execution; no output captured.
This is a narrower, different failure than the store-reviews.md session's successful (`exit 0`)
diagnostic call the same morning, and is reported as such rather than silently omitted.

**WebSearch (both rejected — session-wide budget already at 200/200 before either query could
return a result):** `آرسی rsee.ir «دیگه استفاده نمیکنم» رزرو میز`; `آرسی رزرو میز t.me telegram`.

## Sources (prior sessions, cited not re-verified this session)

`docs/audit/research/profiles/iran-reservation-longtail.md` §"آرسی / RSEE — the only live
dedicated competitor, and its model is the story" (2026-09-05, `[fetched]` against `rsee.ir`
directly — root page and the chair-credit copy quoted there; `/plans`, `/rules`, `/faq` all
`[fetched — negative result, HTTP 404]`). `docs/audit/research/corpus/rsee/store-reviews.md`
(2026-09-07, earlier same-day session, mode STORE REVIEWS AT VOLUME — zero reviews read, identical
dual-tool-outage pattern, its own proxy-diagnostic excerpt showing `connect_rejected` /
"gateway answered 403 to CONNECT" for `cafebazaar.ir:443`, `myket.ir:443`, `play.google.com:443`,
`example.com:443`). `docs/audit/research/MATRIX.md` footnote 56 and the "Independent,
third-party-reviewable footprint" row (RSEE marked ABSENT — "the biggest gap in batch 3").
`docs/audit/research/WATCH.md` 2026-09-05 RSEE entry (pricing/mechanic facts only, no social data).
