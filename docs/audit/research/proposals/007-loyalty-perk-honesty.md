# 007 — Loyalty-perk honesty: label what's tiered, kill what's dead, name the collision

_Scout · 2026-09-09 · depends on `../LOYALTY-PERK-AUDIT.md` for full evidence — this file is the
actionable mechanism, that file is the proof._

## The gap

`apps/customer/js/data/seed.js:62`'s four-item `PERKS` list is shown identically to every user
regardless of club tier. Independently verified against current `main` (see audit file for full
citations):

1. **Cashback** — only `cbBasePct` (default 5%) ever pays; three sibling settings
   (`cbPreorderPct`/`cbVipPct`/`cbWinbackPct`) are writable in the restaurant admin panel, echoed back
   as saved, and never read by any code path that pays a customer. A restaurant owner can be actively
   misled by their own dashboard, not just the diner.
2. **"Priority at busy hours"** — real and load-bearing (`waitlist.ts` orderBy priority desc), but pays
   **zero** to bronze tier, which is every new member's starting point and the tier the flat perk card
   implies applies to everyone.
3. **VIP table access** — does not exist as connected functionality. Two same-named `isVip` fields
   (`Table.isVip`, a staff label; `GuestProfile`/`Customer.isVip`, a churn-analytics flag) are never
   read together anywhere in the reservation-assignment path.
4. **Birthday reward** — fully real, no changes needed; used here as the calibration example of what
   "this perk is not a promise problem" looks like.

**What a user loses:** money (thinks up to 15% cashback is reachable when only 5% ever is, by
default), and trust (joins expecting priority and a VIP table, gets neither at the tier most members
actually hold). Per the founder's own framing today, this is exactly the category of defect that
"cannot be cheaply changed after launch" if it ships as-is and a user's expectation is set before day
one.

## The mechanism — three independent, small fixes, not one big rebuild

**7a. Cashback: either wire the three dead rates in, or remove them from the admin UI until they are.**
Cheapest, most honest first step: `api/src/app/api/v1/restaurant/cashback/route.ts` should either (a)
stop accepting/returning `preorder_pct`/`vip_pct`/`winback_pct` until `reservations.ts` actually reads
them (removes the "confirmed save, no effect" trap for restaurant owners), or (b) if the product intent
is real — preorder gets a higher cashback, VIP-tier customers get a higher cashback, a lapsed customer
gets a winback rate — extend the single `cbPct` selection in `reservations.ts:610-616` to branch on
context (`input.isPreorder`, the customer's club tier, a `lastVisitAt` staleness check) the same way
`tierToPriority` already branches on tier for waitlist. Recommend (b) if there is real product intent,
because the schema and admin UI already assume it exists — this is closer to "finish the wiring" than
"build a new feature."

**7b. Priority: state the threshold, or give bronze a floor.** Two independent, non-exclusive options:
- Change the perk card copy from a flat "اولویت در ساعات شلوغ" to state the tier gate explicitly (e.g.
  "از سطح نقره‌ای به بعد" appended, or a small tier badge on the perk card itself, consistent with how
  the loyalty screen already narrates tier progress elsewhere — `loyalty.js:57-65`). Zero backend
  change.
- Optionally also give bronze a small non-zero `tierToPriority` (e.g. 5, below silver's 20) so that
  "join the club" is never worth literally the same as not joining on this specific axis. This is a
  one-line change in `waitlist.ts:139-142` but is a product decision (does bronze deserve any queue
  advantage at all?), not purely a documentation fix — flagging it as optional, not required, for that
  reason.

**7c. VIP table: pick one meaning for "VIP" or wire the two together.** Cheapest option: stop promising
"VIP table access" as a club perk until `Table.isVip` is actually read anywhere in reservation
assignment against a customer's club tier. If the product intent is real (a platinum/VIP-tier member
should get preferential seating at VIP-zone tables), the mechanism to add is a table-assignment-time
check: when auto-assigning or suggesting a table for a reservation, if the requesting customer's
`ClubMember.tier` is `platinum`/`vip` (reuse `isVipTier`, already exported and tested from
`waitlist.ts:133`), prefer a table where `isVip = true` if capacity allows, falling back to any
available table if not (never bump an existing confirmed reservation). This reuses an existing pure
function rather than inventing new tier logic. Whichever path is chosen, also rename one of the two
colliding `isVip` fields (schema-level, needs architect sign-off) so a future engineer cannot assume a
connection that was never built — this is the naming-collision fix named in the audit file §4.

## Why it wins

Per the audit's own market check (`LOYALTY-PERK-AUDIT.md` §6): no Iranian competitor has shipped a
comparable four-perk claim to be caught failing at, which means Rezervno would be *first* to make this
exact promise in this market — first-mover on a broken promise sets the worst possible precedent for a
launch, worse than being a slow honest follower. Globally, the sharpest analogue on file
(`ANTI-PATTERNS.md` #1, TheFork) shows a *stated* promise that turns out false or partial draws direct,
counted, quoted backlash (19% of recent 1-star reviews, one cluster, four weeks) — Resy's alternative of
staying silent about its VIP mechanism draws no comparable complaint volume specifically because it
never states a checkable promise. Rezervno's PERKS card is the stated-promise shape, which the evidence
says is the more dangerous one to get wrong.

## Cost estimate

- **7a (cashback):** T1 if removing the three dead fields from the admin route; T2 if wiring them to
  real branches in `reservations.ts`. No schema change either way (columns already exist).
- **7b (priority labeling):** T1 — copy-only change in `loyalty.js`/`seed.js`. The optional bronze-floor
  change is T1 but is a product decision, escalate rather than assume.
- **7c (VIP table):** T1 for "stop promising it until wired." T2 for the table-assignment-time
  preference logic (touches booking/assignment path, needs a falsifiable test per the constitution's
  §3 — inject a case where a platinum member books when a VIP table is free vs. not free, confirm the
  assignment differs correctly). The field rename is a schema change and needs architect sign-off
  separately from the logic fix.

## Product-bar check

- **Money honesty:** direct hit — this proposal exists because money-honesty is currently violated
  (cashback ceiling overstated by default). Fixing 7a is the money-honesty item specifically.
- **No dark patterns:** the current state (identical flat perk card regardless of tier, no disclosure
  of the bronze=0 priority floor) is itself borderline — not a deliberate dark pattern, but the
  *effect* on a bronze user is indistinguishable from one. 7b closes that.
- **Notification restraint:** not touched by this proposal.
- **Honest labels:** directly the subject of 7c — "VIP table access" is currently a label with nothing
  behind it. Either remove the label or build the mechanism; do not leave both as-is.
- **Passes the check** on all four axes once 7a/7b/7c ship in the "stop overpromising" (cheap) form;
  passes even more strongly if the "wire it up" (T2) form ships, since it converts an
  honesty-fix into a genuine feature.

## What I did NOT verify

Same list as `LOYALTY-PERK-AUDIT.md` §7 — production configuration state, actual wait-time impact,
and whether any restaurant has already configured the dead cashback rates in good faith. Add: whether
`isVipTier`'s reuse in 7c would create any unintended interaction with existing table-assignment
logic — a `data-trust-engineer` or the relevant backend owner should size this before committing to
the T2 path, not Scout.

## If this needs a capability the roster lacks

It does not need a new agent. This is squarely inside `backend-integrity-engineer` /
`contracts-consolidation-engineer` territory (API route + reservations.ts + loyalty.js), the same
pairing `BRIEF-2026-09-05-batch3.md` already recommended for proposal 006. The schema rename in 7c is
the only piece needing architect sign-off.
