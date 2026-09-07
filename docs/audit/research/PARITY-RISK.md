# PARITY-RISK — what competitors have that users value, and we don't yet

_Maintained by Scout. Last updated: 2026-09-07 (rewritten this pass — see §0.1). Synthesized from the
nine profiles and the matrix on file — `profiles/fidilio.md`, `profiles/smartx.md`,
`profiles/foodism.md`, `profiles/opentable-resy-sevenrooms.md`, `profiles/servme.md`,
`profiles/snappfood-loyalty.md`, `profiles/thefork.md`, `profiles/iran-reservation-longtail.md`,
`recon-notes-global.md`, and `MATRIX.md`._

> **§0 — reporting target.** This batch's brief named `rezervnofullsource-d9 [8dde6c]` as the
> reporting target. `ListAgents` shows no reachable session by that name in this environment as of
> 2026-09-07 — **UNKNOWN — not verified**, per this file's own instruction not to guess. Routed to
> `docs/audit/research/` regardless, as instructed.

> **§0.1 — this file's first version was wrong on four of six items, and this rewrite says so
> plainly.** The original version (same date, earlier commit) never checked live Rezervno code for
> the "Rezervno" column of most rows — it wrote `UNKNOWN — not verified` for gaps that a repo check
> resolves in minutes. A peer review session (self-described "CEO+reviewer" on this repo) ran that
> check independently and reported four of the six ranked items already exist in code — items #1, #3,
> #4 (partially), and #5 below. **Their claims were not accepted on their word.** Every one was
> re-verified independently in this session via fresh `Grep`/`Read` against the current `main`
> branch (citations inline). Three were confirmed exactly as reported; one (#4, cross-visit CRM) was
> confirmed **only partially** — the peer's framing overclaimed it, and this version corrects that
> too. This is the exact failure this programme's own constitution names: ranking a "gap" without
> checking whether the codebase already closes it, guessing UNKNOWN, and then treating UNKNOWN as if
> it meant "absent." It didn't. Read `§ What I did NOT verify` at the bottom before acting on any row.

> **Methodology and its limit.** "Ranked by how often users mention it" is only honest where an
> actual count exists behind the ranking. Where a gap is grounded in counted mentions (a review
> corpus, a complaint frequency), that count is given and the rank reflects it. Where a gap is
> grounded in a competitor's own stated mechanic or a Gen-Z-lens judgment call rather than a counted
> volume of user praise, it is marked **[structural]**. Every Rezervno-side cell is now a direct
> code/schema citation, checked this pass — none is `UNKNOWN` by laziness; where `UNKNOWN` still
> appears, it's because no route/UI reference was found by targeted grep, not because grep wasn't
> tried.

---

## Verified summary table

| # | Capability | Competitor has it (evidence) | Rezervno has it? (file:line) | Real gap: missing or unannounced? |
|---|---|---|---|---|
| 1 | Public self-serve restaurant price list | OpenTable/Resy/Servme/RSEE/SmartX — see detail below | **YES** — `apps/landing/app/pricing/page.tsx` (live, real Toman figures: ۱۸/۳۴/۶۵ میلیون for 3/6/12mo plans) fed by `GET /api/v1/site/[collection]?collection=plans` (`api/src/app/api/v1/site/[collection]/route.ts:29-35`, public, no auth) | **Neither** — closed. Remove from gap list. |
| 2 | Published, generous, single-sentence loyalty-expiry policy | TheFork YUMS, SnappFood Snapp Club | **Mechanism yes, statement no** — `PointsLedger` has no `expiresAt` column at all (`api/prisma/schema.prisma:672-686`), so points functionally never expire — but this is never stated to a user anywhere found | **Unannounced.** The generosity exists by omission, not by promise. |
| 3 | Free, low-barrier top loyalty tier | OpenTable Regulars (Gold at 6 bookings/yr, free) | **YES, and narrated in-UI** — 4-tier ladder bronze/silver/gold/platinum at 0/300/800/2000 points (`api/src/lib/loyalty.ts:41-45`), with live progress bar and "X points to next tier" copy in the customer app (`apps/customer/js/features/loyalty.js:57-65`) | **Neither** — closed, and better-built than most of the profiled competitors (they don't narrate progress; we do). |
| 4 | Cross-visit / cross-restaurant CRM personalization for **restaurant staff** ("remembered by name") | SevenRooms (core pitch), Servme (Hyatt Regency Dubai case study), SmartX (Customer Club, claimed) | **Partial — data layer only.** `GuestProfile` model is real and does track cross-restaurant history (`globalVisits`, `restaurantsVisited`, `isVipAnywhere`, `dietaryTags` — `api/prisma/schema.prisma:1300-1319`). But it is wired **only** into customer-facing code (`api/src/app/api/v1/me/profile/route.ts`, `api/src/lib/dna-summary.ts`) — a targeted grep across every restaurant-facing API route (`api/src/app/api/v1/restaurant*`) and both staff panels (`apps/business`, `apps/company`) found **zero** references to `GuestProfile`, `globalVisits`, `restaurantsVisited`, or `isVipAnywhere`. | **Real, narrower gap than either version claimed.** The data foundation exists; the actual competitive feature — a staff screen that says "this guest has visited 3x, prefers X" — does not. Don't build a new data model (it exists); build the staff-facing surface. |
| 5 | Quantified referral mechanic | TheFork ("500 Yums for a friend's first booking") | **YES, backend and UI both** — `model Referral` with `rewardPoints Int @default(500)` (`api/prisma/schema.prisma:696-709`), `POINTS.referralReward = 500` and the full invite/reward flow (`api/src/lib/loyalty.ts:14,163-199`), surfaced in the customer app: *"۵۰۰ امتیاز برای هر دعوت موفق"* (`apps/customer/js/features/loyalty.js:70`) | **Neither** — closed. |
| 6 | Independent, third-party-reviewable footprint at scale | TheFork (21,638 Trustpilot), OpenTable (~190K Play), Fidilio (581/110K installs) | Pre-launch — **UNKNOWN by construction**, not by gap | **Real, structural, not closeable pre-launch.** Unchanged from the original version. |

**What actually changed the thesis of this file:** four of six "gaps" were never gaps in the code.
The real, recurring pattern across items #2, #3 (partially — the mechanism was built, the narration
happened to already exist too, so #3 is fully closed) and #5 is: **Rezervno keeps building the
generous/competitive version of a mechanic and then not telling anyone it exists.** That is a
narrower, more actionable finding than "build six things" — it's closer to "audit what's already
shipped but unmarketed, and either surface it in-product or in the pitch to restaurant owners."

---

## Detail on the two rows that remain real gaps

### #4 — restaurant-staff-facing cross-visit CRM (partial gap, corrected this pass)

The data foundation is not the missing piece; the competitive feature is. SevenRooms and Servme's
pitch is specifically to the *restaurant owner/staff*, not the diner — a host or manager pulling up
a reservation and seeing "3rd visit, prefers window seating, allergic to shellfish" **before the
guest arrives**. `GuestProfile` computes exactly that shape of data (`isVipAnywhere`,
`dietaryTags`, `restaurantsVisited`) but nothing in `apps/business` or `apps/company` — the two
restaurant-staff panels — reads it. Confirmed by direct grep, zero hits, both panels, 2026-09-07.

**This is buildable, not a new data model.** The read path from `GuestProfile` to a staff-facing
reservation-detail panel is the actual missing piece, not new schema or new backend logic.

### #6 — independent review footprint (unchanged, structural)

Pre-launch, so by construction there is no independent review corpus for Rezervno yet. Listed for
completeness, not as a near-term action item — see the original framing, unchanged: this becomes a
real parity risk the day a competitor with a review corpus launches in the same city before we do,
not before.

---

## What did NOT make this list, on purpose

- **WhatsApp-native messaging (Servme).** `profiles/servme.md` names this as Servme's core MENA
  differentiator, but its own text is explicit that WhatsApp is not reliably available inside Iran the
  way it is in the Gulf. Copying the *channel* would be the wrong lesson; `proposals/004` already
  extracts the right one (build the regional constraint into the product, not the specific app).
- **RSEE's table-level selection and public pricing.** Its pricing gap is already closed on our side
  (#1). Its table-level slot picker is real (`profiles/iran-reservation-longtail.md` "What to steal")
  but is a UX mechanic, not something users are on record valuing by name — no complaint or praise
  corpus exists for RSEE at all. Listing it here would rank a feature nobody has actually said they
  want.

## What I did NOT verify

- Whether the `GuestProfile` data is *populated correctly* at runtime (the model and its read paths
  exist; whether `rebuildGuestProfiles()` actually runs on a schedule and produces accurate numbers
  in production was not checked this pass — that's an operational/cron question, not a code-existence
  one).
- Whether the free-tier progress-bar UI (`loyalty.js:57-65`) is reachable from the main customer nav
  in fewer taps than a Gen-Z user tolerates — narration existing is not the same as narration being
  *found* by a real user; a taps-to-discover count was not run this pass.
- Whether `apps/landing/app/pricing/page.tsx`'s numbers match what the sales/business side actually
  charges today, or are stale copy — the page and API wiring are real; the *accuracy* of the Toman
  figures against current commercial terms was not cross-checked against a non-code source.
- Any row beyond these six — this file still only covers what the original six-item scope named, not
  a full fresh census of every competitor capability against every Rezervno feature. A full census is
  exactly what `census` (the read-only feature-reality agent) exists for and has not been run against
  this specific competitor list yet.
