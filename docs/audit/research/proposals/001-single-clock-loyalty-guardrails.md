# 001 — Single-clock loyalty ledger + upfront tier-change communication

_Status: proposed 2026-09-04 by Scout. Tiering scale note: no CEO T1/T2/T3 definition was found
anywhere in this repo (checked `docs/`) — the estimate below uses a generic scale (T1 = days, single
surface; T2 = 1–3 weeks, cross-file feature; T3 = architectural, needs sign-off) and should be
re-mapped to whatever scale the CEO actually uses._

## The gap

Two of the loyalty programs studied this batch — Starbucks Rewards and Chipotle Rewards, both
relaunched in 2026 — show the same failure shape from two different causes, and Rezervno's own
`PointsLedger` (`api/prisma/schema.prisma:664`) does not yet have a documented policy against either:

1. **Asymmetric expiry that reads as punishment.** Starbucks' March 2026 relaunch lets Green-tier
   (base) Stars expire in 6 months while Gold/Reserve Stars never expire — a policy that specifically
   penalizes the casual, lower-spend user, who is also the population least likely to complain and
   most likely to just churn quietly. Layered on top, the *rate* change (old: anyone hits 2x via card
   reload; new: 1.7x requires 2,500 Stars/year) was bundled into the same relaunch without being
   separated from the "no expiry" improvement, and got read as bad-faith devaluation. A user complaint
   surfaced this batch: *"the new tiered structure feels like a devaluation, especially for customers
   who previously maximized 2 Stars per dollar through app reloads."*
   (`docs/audit/research/recon-notes-global.md` §Starbucks Rewards, sourced to Newsweek/Fast
   Company/Axios, 2026.)
2. **Stacked expiry clocks that multiply loss.** Chipotle Rewards runs three separate, differently-
   timed clocks at once: points expire on annual inactivity, a *redeemed* reward expires in 60 days,
   and the birthday reward expires in 30 days. Chipotle's *older* 180-day inactivity policy was
   contentious enough to reach federal litigation — a court upheld it in December 2025, meaning it was
   legally allowed to keep expiring points, not that users were happy about it.
   (`docs/audit/research/recon-notes-global.md` §Chipotle Rewards, sourced to ConsumerAffairs, 2025-12-29.)

What a Rezervno user loses if we copy either pattern without a guardrail: silent point loss with no
warning (Starbucks-shape), or a redeemed reward that quietly expires before the user gets back to the
restaurant (Chipotle-shape) — both read as the platform taking back value it already promised, which
is exactly the "does it quietly confiscate value" failure mode the Gen-Z lens flags as a dealbreaker.

## The mechanism

Not "gamification" — concrete ledger behavior and one UI surface:

1. **One expiry clock per point-earning event, full stop.** `PointsLedger` entries carry a single
   `expiresAt` set at the time points are earned (e.g., 12 months from the earning transaction). No
   second clock on redeemed-but-unused rewards, no third clock on any bonus/birthday reward — if a
   reward is issued, it inherits the same expiry as the points that funded it, not a shorter one.
2. **If any tier ever gets a *shorter* or *conditional* expiry than another, the app must say why, in
   the same screen where the balance is shown** — a one-line, plain-Persian explanation
   ("امتیازهای شما ۱۲ ماه بعد از دریافت منقضی می‌شوند — با هر رزروِ جدید، ساعت دوباره شروع می‌شود")
   next to the points balance, not buried in a terms page. If a future tier redesign changes the
   *rate* (points-per-toman) for any segment, that change ships with its own in-app one-screen
   explainer before the user's next reservation, distinguishing "this got better" from "this got
   harder" explicitly — never bundled silently into an unrelated relaunch announcement.
3. **One forgiveness per rolling 12 months**: if a user's points are about to expire, one "grace"
   reservation resets the clock without staff/support intervention — cheap to build on top of the
   existing ledger's append-only design, and it directly defuses the Starbucks "silently punishes the
   casual user" failure mode without giving away real money.

## Why it wins

- The Starbucks and Chipotle backlash quotes above are not hypothetical — they are 2025/2026, dated,
  sourced complaints about exactly this mechanic, from two of the most sophisticated loyalty programs
  in the world with dedicated CRM teams. If they got this wrong at scale, an undocumented policy on
  Rezervno's ledger is more likely to drift the same way by accident, not by malice.
- Competitors cannot easily copy the "forgiveness" mechanic as marketing, because for Starbucks/
  Chipotle it would mean reversing a revenue-protecting breakage assumption baked into their finance
  model; for Rezervno, adopting it *before* any breakage assumption exists costs little and becomes
  the "we don't do that" claim.

## Cost estimate

**T2.** Touches: `api/prisma/schema.prisma` (if `expiresAt` isn't already a single, consistent field
across all `PointsLedger` entry types — needs verification, see below), the ledger-write path in
`api/`, and one UI surface in `apps/customer/js/features/loyalty.js`. Depends on: confirming the
current `PointsLedger` schema doesn't already have divergent expiry fields per entry type (if it
does, this becomes a migration, which needs architect sign-off per `CLAUDE.md`'s reservation/schema
rule). **This needs `data-trust-engineer`** (owns `PointsLedger` per its own scope) to verify current
schema behavior before implementation starts.

## Product-bar check

- **Money honesty:** passes — the mechanism's entire point is not confiscating value silently.
- **No dark patterns:** passes — explicit, no manufactured urgency beyond the true expiry date.
- **Notification restraint:** the expiry-warning notice should be a single, dismissible in-app banner,
  not a push-notification campaign — needs explicit design decision, not assumed.
- **Honest labels:** passes — no "gamification" language; describes what actually happens.

## What I did NOT verify

- Whether `PointsLedger` (`api/prisma/schema.prisma:664`) already has an `expiresAt` field, and if so,
  whether it's already single-clock or already inconsistent across entry types — I only confirmed the
  model exists, not its current column-level policy. **This is the first thing an implementing agent
  must check before writing any code against this proposal.**
- Whether `apps/customer/js/features/loyalty.js` currently surfaces any expiry information to the user
  at all today — confirmed the file exists, did not read its contents or run the app.
- Any existing Rezervno documentation of a loyalty policy this proposal might duplicate or contradict
  — a repo-wide search for "expiry"/"انقضا" in loyalty-adjacent files was not performed this pass.
