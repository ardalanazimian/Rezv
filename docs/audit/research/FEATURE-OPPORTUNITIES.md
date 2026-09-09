# FEATURE-OPPORTUNITIES — synthesis, not another profile

_Maintained by Scout. Written: 2026-09-07. This is the first synthesis-phase document the original
Scout mandate called for and the founder approved starting this pass, over further competitor
expansion — see `REPORT-2026-09-07-deep-batch.md` for why expansion was paused (token cost) and
`PARITY-RISK.md` §0.1 for why this file trusts almost nothing from the prior pass without a fresh
repo check._

> **What this file is not.** Not a 25th competitor profile. Not a build plan — cost figures below are
> Scout's rough, non-engineering ballpark (small/medium/large), not a committed estimate; an
> architect/engineer sizes the real work. Every "we have/don't" cell is a fresh `Grep`/`Read` citation
> against `main` as of 2026-09-07, not carried over from an earlier file without re-checking — the
> exact discipline `PARITY-RISK.md` failed on its first pass and corrected on its second.

## The Gen-Z lens, made concrete (not a vibe)

Per the founder's own framing this batch ("با نگاهِ نسل زد") and `.claude/skills/genz-agent-charter`,
four specific constraints shaped what's ranked below, not a general "make it feel modern":

1. **The comparison set is wrong if it's only reservation apps.** A Gen-Z user doesn't benchmark
   Rezervno's booking flow against SmartX or Fidilio — they benchmark it against whatever app last
   completed something in three taps (Snapp, Tapsi, Digikala, Instagram checkout). None of the nine
   competitor profiles on file measured Rezervno or any competitor against that bar directly (no
   session had working devices/live apps to tap through — see "What I did NOT verify" below); this
   file names the gap instead of pretending to have closed it.
2. **"Slow/annoying" is a finding only with a number.** Rezervno's own booking sheet is a verified
   **3-step** flow end to end — `apps/customer/js/data/booking.js:216,233-234` render a 3-segment
   `step-bar` (done/now/pending) and the confirmation screen's own copy says *"یه قدم تا رزرو"* ("one
   step to reservation"). No competitor's tap/step count was measured this pass (none of Scout's
   sessions had a working device to click through a competitor's actual flow — every WebFetch attempt
   failed, per every corpus file). **This is a real research-method gap, not a finding**: the next
   research pass that has working tools should count steps on Fidilio/SmartX/RSEE's actual apps, not
   describe their UX in adjectives.
3. **Points-only loyalty reads as dated to this cohort; tiers/streaks/missions/birthday-recognition
   read as current.** Checked against that bar, not just "does a loyalty program exist": Rezervno's
   tier ladder is real and narrated (`api/src/lib/loyalty.ts:41-45`,
   `apps/customer/js/features/loyalty.js:57-65`) — see the table below, row 2. Separately, and
   structurally in our favor regardless of loyalty design: signup is phone-number/OTP-only, no email
   field anywhere in `apps/customer/js/auth.js` — a lower-friction entry than any competitor profiled
   that requires an app-store account or email.
4. **Never call a heuristic "AI."** This rule caught something in our own product, not a competitor's,
   while checking row 2 below — flagged as its own item (see "Self-audit finding," not a competitor
   row) rather than folded quietly into a table cell.

---

## Ranked opportunities

| # | Opportunity | Competitor evidence | Rezervno today (file:line) | Gen-Z impact if closed | Rough cost |
|---|---|---|---|---|---|
| 1 | **Staff-facing cross-visit guest recognition** | SevenRooms' core pitch; Servme's named Hyatt Regency Dubai case study (88K profiles/3yr); SmartX's Customer Club (claimed) — `PARITY-RISK.md` #4 | **Data layer exists, staff surface doesn't.** `GuestProfile` (`api/prisma/schema.prisma:1300-1319`) already computes `globalVisits`, `restaurantsVisited`, `isVipAnywhere`, `dietaryTags` — but zero references in `apps/business`, `apps/company`, or any `restaurant`-facing API route (verified by grep, 2026-09-07). | A host who already knows a regular's name/preference on arrival is the single most-repeated pitch across three unrelated competitor categories in this research set — restaurants pay for this specifically. Doesn't change the diner-facing app at all. | **Medium** — no new schema, no new backend computation; the work is a read endpoint + a staff-panel UI card. |
| 2 | **Say out loud what's already generous** — points don't expire, referral pays 500 points, tiers exist and are narrated | TheFork's one-sentence YUMS policy; TheFork's quantified referral (500 Yums/friend) named as the strongest share incentive in this research set | **All three already built**, none marketed: `PointsLedger` has no `expiresAt` column at all (`api/prisma/schema.prisma:672-686`) — functionally never expires, never stated to a user; `Referral`/`referralReward:500` is live end-to-end including UI copy (`api/prisma/schema.prisma:696-709`, `api/src/lib/loyalty.ts:14,163-199`, `apps/customer/js/features/loyalty.js:70`); 4-tier ladder with live progress bar (`loyalty.ts:41-45`, `loyalty.js:57-65`). | Zero engineering risk, all upside: a Gen-Z user who has to *discover* a good policy by using the app long enough doesn't credit the app for it — TheFork gets credit for its expiry policy because it's stated in one sentence, not because the mechanic is unusually generous. Same mechanic, stated once, changes what it's worth in a comparison. | **Small** — copy/positioning work (an FAQ line, an onboarding card, a landing-page bullet), not code. |
| 3 | **Turn the money-safety guardrails that already exist from "one grep" into a CI gate** | TheFork: 4/21 (19%) of recent 1-star reviews are accrued-value confiscated with no reason given, in a single 4-week window; 2/21 (10%) are undisclosed charges — `ANTI-PATTERNS.md` #1–#2 | **Exposed by omission, not by design.** `depositLabel()`/`cancelPolicyLabel()` already implement "unknown → silence, never a guess" (`apps/customer/js/data/booking.js:66-83`), and payment is gated by a per-restaurant flag nothing else reads (`api/src/app/api/v1/reservations/[code]/pay/route.ts:35`) — correct today, but a human's one-time grep, not an enforced invariant. Separately, `PointsLedger`'s `reason=adjustment` with `note String?` optional means a silent negative balance write is a valid call today, with no ledger-history screen for a diner to discover it happened (`schema.prisma:660-670`; aggregate-only render at `loyalty.js:57`). `proposals/005` and `proposals/006` already scope exactly this. | This is defense, not a feature — the impact is what TheFork's own 19%/10% 1-star clusters show happens when this class of guardrail regresses silently. A Gen-Z user who gets silently charged or silently docked doesn't file a considered complaint; they screenshot it and post it. | **Medium** — mostly test/CI work (proposal 006's CI gate) plus a ledger-history screen surfacing `note`/`reason` per entry (proposal 005). |
| 4 | Independent, third-party-reviewable footprint | TheFork (21,638 Trustpilot), OpenTable (~190K Play), Fidilio (581/110K installs, read first-hand) | Pre-launch — **UNKNOWN by construction**, not a gap to close now (`PARITY-RISK.md` #6, unchanged) | Not actionable pre-launch; the honest framing stays "this becomes a real risk the day a competitor with a review corpus launches in the same city before we do." | **N/A pre-launch.** |

---

## Self-audit finding (not competitor-sourced — caught while checking row 2's evidence)

While verifying the tier/loyalty citations for row 2, one live UI element failed constraint #4
above. `apps/customer/js/features/notifications.js:85-87` builds a notification literally titled
**"پیشنهادِ هوشمند"** ("smart suggestion") with category `ai` and a sparkle icon — but the
underlying logic is `[...pool].sort((a,b)=>(b.rt||0)-(a.rt||0))[0]`: the single highest-rated
restaurant in the current pool, plain descending sort, no model, no personalization signal beyond
one field. Likewise, `apps/customer/js/data/detail.js:225-226` renders a review section titled
**"خلاصه‌ی هوشمند نظرها"** with an explicit `AI` tag. **This second one is currently inert for real
restaurants and appears to be handled correctly** — `apps/customer/js/api.js:296-299` documents an
earlier 2026-08-25 fix that hardcodes `ai: false` and empty `good`/`bad` arrays for any live
(non-demo) restaurant, specifically because this exact leak (sample-restaurant "AI" copy attached to
real restaurants) was found and closed before. The notification (`notifications.js`) does run against
real server data (`pool.filter(x=>x&&x.slug)`) and is not similarly gated — it is a live "smart"
label on a plain sort, shipping today. **Not fixed by Scout — out of mandate (competitor research,
not code changes) and this file's own methodology note above says exactly why: a full REAL/PARTIAL/
FAKE trace is the `census` agent's job, not a grep-and-flag from a research pass.** Flagged here with
file:line so it isn't lost, not classified beyond what a plain read of the code already shows.

---

## What did NOT make this list, on purpose

Everything in `ANTI-PATTERNS.md` items #4–#14 that Rezervno has no live equivalent of yet (exclusive
commission contracts, price-inflate-then-discount, stacked expiry clocks, asymmetric tier expiry,
undisclosed cross-platform data flows, pay-to-harvest-phone-numbers pricing) — these are already
correctly filed as "never build this," not as opportunities, and repeating them here as if they were
a fresh finding would be exactly the padding this file's methodology note argues against.

## What I did NOT verify

- **No competitor's actual tap/step count.** Named explicitly above (lens constraint #2) as a method
  gap, not filled in with an estimate.
- **Whether `GuestProfile` (row 1) is populated correctly in production** — `rebuildGuestProfiles()`
  exists in `api/src/lib/guest-profile.ts` but whether it runs on a working schedule and produces
  accurate numbers was not checked; that's operational, not code-existence.
- **Whether row 2's mechanics (expiry, referral, tiers) are discoverable in the number of taps a real
  new user tolerates** — code-reachable and UI-narrated is confirmed; *findable without being told
  where to look* was not tested.
- **The `notifications.js` "AI" labeling's user-facing impact** — flagged as a live finding, not
  measured for how often it fires or whether any user has ever noticed/complained; no complaint
  corpus exists for a pre-launch product.
- This file draws only on the nine profiles, four deep profiles, `MATRIX.md`, `PARITY-RISK.md`, and
  `ANTI-PATTERNS.md` already on file, plus fresh code checks — no new competitor research (`WebFetch`/
  `WebSearch`) was attempted this pass; per `REPORT-2026-09-07-deep-batch.md`, `WebSearch` quota was
  already exhausted ("200 of 200") before this batch began and has not been re-checked.
