# 005 — No silent taking: every point removed must carry a reason the diner can read

_Status: proposed 2026-09-05 by Scout (batch 3). Tiering caveat unchanged from 001–004: no CEO
T1/T2/T3 definition exists in-repo, so the generic scale is used (T1 = days, single surface;
T2 = 1–3 weeks, cross-file; T3 = architectural, needs sign-off)._

> **This is not proposal 001 again.** 001 is about **clocks** — when points expire. This is about
> **authority** — who can remove points that have already been earned, and whether the person they
> were taken from is told. Batch 3 found that the second failure is the one that actually happens at
> scale, and that 001's guardrails do nothing to stop it.

## The gap

### Competitor evidence — the largest complaint corpus in this programme says confiscation, not expiry

TheFork's Trustpilot profile is **21,638 reviews at 4.4/5, 12% one-star** — by a wide margin the
biggest independently-reviewable corpus of any platform studied
([trustpilot.com/review/www.thefork.com](https://www.trustpilot.com/review/www.thefork.com), fetched
directly 2026-09-05). Of the **21 most recent 1-star reviews** (2026-07-06 → 2026-09-02), **four —
19%, all inside four weeks — are the same complaint: an account was suspended and the balance the user
had earned went with it, with no reason given.**

- **Yvonne (GB, 2026-07-20):** *"My account was suspended suddenly!"* … *"I have earned 20000 Yums in
  my account and it cannot be used now."* At TheFork's own published rate (2000 Yums = £50), that is
  **£500 of accrued value**.
- **Francesco Pagliano (IT, 2026-08-02):** *"My account was blocked with more than 450 euro in gift
  cards i paid."* — note: **gift cards he paid cash for**, not promotional credit.
- **Harry Rose (FR, 2026-07-21):** suspended after using promo codes the platform itself had sent him.
- **lestamunda (GB, 2026-07-20):** long-time user, sudden suspension, no explanation.

(Quotes are verbatim fragments as printed on the Trustpilot listing page; the fetch layer truncates at
~125 characters. Full sourcing and the rest of the complaint taxonomy: `profiles/thefork.md`.)

**The thing to notice:** TheFork's expiry policy is *good*. One clock, one year, rounded up to the end
of the month, stated in a single plain sentence — cleaner than Starbucks' or Chipotle's, and exactly
what `proposals/001` argues for. **And it did not help these four people at all.** Every guardrail in
001 was already in place at TheFork and the value still vanished, because the removal path was not a
clock. It was a decision.

### Rezervno evidence — the ledger permits exactly this today

All citations verified on ref **`audit/launch-hardening` @ `35fff27`**, 2026-09-05. Where `main`
differs, both are given.

1. **`PointsLedger` has no expiry mechanism at all.** `api/prisma/schema.prisma:672-686`
   (`main`: `:664`). The complete field list is `id, userId, user, restaurantId, delta, reason, note,
   createdAt`. No `expiresAt`, no expiry index. **This retires the single largest open question in
   `proposals/001`**, which said: *"Whether `PointsLedger` already has an `expiresAt` field … is the
   first thing an implementing agent must check."* Answer: it does not. Rezervno's points currently
   never expire.

   That is *better* than what 001 asks for — but it is an **absence, not a decision**. Nobody chose
   it, nothing records it, and nothing stops a future migration from adding an expiry column to a
   balance users have already accrued. Which is precisely the Starbucks failure shape: value taken
   back after the fact.

2. **A negative adjustment with no stated reason is representable right now.**
   `api/prisma/schema.prisma:660-670` — `enum PointsReason` includes **`adjustment // تنظیم دستی`**
   ("manual adjustment"). And in the model, **`note String?` is optional**. So a row of
   `delta = -20000, reason = adjustment, note = NULL` is a perfectly valid ledger write today. That is
   Yvonne's complaint, expressible in one INSERT.

3. **The diner cannot see the ledger.** `apps/customer/js/features/loyalty.js:57` destructures only
   `{points, tier, next_tier, points_to_next, progress_pct, badges}` — an **aggregate balance**, never
   the rows behind it. A repo-wide grep for `points_ledger`/`pointsLedger` under
   `api/src/app/api/v1/` returns **exactly one file**, `restaurant/members/route.ts` — the
   *restaurant* side. There is no diner-facing points-history endpoint and no diner-facing history
   screen. **A diner watching their balance drop today has no surface on which to find out why.**

   (Worth noting what that same file already got right: its header comment, `:1-4`, records that the loyalty
   screen once showed a hardcoded "سطحِ طلایی / ۱۶۰ امتیاز تا پلاتینیوم / ۶۸٪" independent of the
   user's real points, and that this was removed. The honesty instinct is already in this file. It
   just stops at the aggregate.)

4. **Rezervno already holds real money in a value surface with a clock on it.**
   `api/prisma/schema.prisma:719-737` — `GiftCard` has `amountToman`, `balanceToman`, a `status`, and
   **`expiresAt DateTime?`** at `:731`. Francesco Pagliano's complaint was about *gift cards he paid
   for*, not points. So the confiscation surface in Rezervno is not hypothetical or points-only.

## The mechanism

Three concrete changes. No new subsystem, no label, no "AI," no gamification.

**1. A database-level CHECK: a negative manual adjustment must carry a reason.**
Add a constraint so that `reason = 'adjustment' AND delta < 0` requires `note` to be non-empty. It goes
at the **DB layer, not the service layer**, so no future code path — admin script, console session,
migration, worker — can bypass it. `CLAUDE.md` requires the migration be idempotent
(`IF NOT EXISTS` / `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`) and present in **both**
`api/prisma/sql/NNN-*.sql` **and** `schema.prisma`, or `schema-drift.integration.test.mts` catches it.

> ⚠️ **Migration numbering — read the directory, do not trust any document, including this one.**
> `api/prisma/sql/` currently ends at **`080-no-show-risk-source.sql`** (verified 2026-09-05).
> At the start of this batch `CLAUDE.md` §دیتابیس stated the latest was **۰۷۵**, which would have sent
> an implementing agent into a collision with five existing files; a concurrent session removed that
> parenthetical mid-batch, and as of this writing the fix is **uncommitted in the working tree**. If it
> is reverted or its branch dropped, the stale claim returns. Either way: **`ls api/prisma/sql/`.**

**Precedent already in-repo — this is not a new pattern, it is migration 080's pattern applied to a
second table.** `schema.prisma:529-532` documents `noShowRiskSource` with a `///` comment stating that
NULL means *genuinely unknown*, that a consumer **"حق ندارد NULL را «مدل گفته» بخواند"** (has no right
to read NULL as "the model said so"), and that **"CHECK سطحِ DB در ۰۸۰ است"** — the guarantee is
enforced by a DB-level CHECK, not by convention. Proposal 005 asks for the same discipline on the
question "why did this user's points go down."

**2. A diner-visible points history.** One endpoint returning the user's own `PointsLedger` rows
(`createdAt`, `delta`, `reason`, `note`), scoped by authenticated user id — never by a body/query
parameter, per `CLAUDE.md`'s tenant rule — and one screen in `apps/customer` rendering them, including
**every negative row with its reason text**. Four states required (loading · empty · error+retry ·
success) per `CLAUDE.md`; an empty history must read "هنوز امتیازی ثبت نشده", never a silent zero.
`shared/js` should be searched for an existing list component before a new one is written.

**3. A falsifiable CI gate on the expiry question.** A test that fails if `PointsLedger` acquires any
expiry-shaped column (`expiresAt` / `expires_at` / `validUntil`) **unless** a named policy file
declaring the expiry rule and the user-comms plan exists alongside it. Expiry stays *addable* — this is
not a veto — but it cannot be added *silently*.

**Proving the gate is real is part of the work, not optional.** Per `CLAUDE.md` rule 2 and
`docs/audit/GATE-FALSIFIABILITY.md`: add the column, run the gate, **record the non-zero exit code**,
then revert. Per rule 5: if the gate cannot find `PointsLedger` at all (renamed model, moved file), it
must **error**, not pass. A gate whose subject has vanished and that stays green is not a gate.

## Why it wins

- **It is the failure that actually happens.** 19% of TheFork's most recent one-star reviews, inside a
  four-week window, on a 21,638-review corpus. Not a hypothetical, not a think-piece — dated, named,
  public complaints against the largest European reservation loyalty program.
- **No competitor in this programme can copy it cheaply, and the reason is structural.** Confiscation
  on suspension is an *anti-fraud lever*. A platform that has already built its abuse response around
  silently zeroing balances cannot publish "every removal carries a reason you can read" without
  either rebuilding that response or admitting how it currently works. Rezervno has no such legacy —
  the cost of committing now is one CHECK constraint and one screen. **The cost of committing later,
  after an abuse team has grown used to the silent path, is the same rebuild TheFork now faces.**
- **It makes an honest claim available that is currently unsayable.** Today Rezervno's points never
  expire, but nothing says so and nothing keeps it true. After this, "we never remove points without
  telling you why, and here is the list" is a claim backed by a DB constraint and a screen — which is
  the kind of claim `proposals/002` (data-provenance receipt) is built to carry.
- **It composes with 001 rather than replacing it.** If a clock is ever introduced, 001 governs its
  shape; 005 governs whether the user finds out.

## Cost estimate

**T2.** Touches: one `NNN-*.sql` migration + the matching `schema.prisma` change (a `note` constraint
is a **schema change**, so per `CLAUDE.md` it needs **architect sign-off before implementation**); one
new read-only API route; one screen in `apps/customer` (which then requires a `CACHE_VERSION` bump at
`apps/customer/sw.js:14`); one test file plus a recorded falsification run.

**Owner:** `data-trust-engineer` owns `PointsLedger` as the single server-authoritative loyalty source
(protocol §13) and should own items 1 and 3. Item 2's customer-app screen is `panels-ui-engineer`'s
layer only if it lands in a panel — it does not, it lands in `apps/customer`, so ownership needs the
CEO to assign it. `test-integrity` should own the falsification proof for item 3, since proving a gate
red is its explicit mandate.

## Product-bar check

- **Money honesty:** this is the entire point — passes.
- **No dark patterns:** passes. Nothing is hidden, nothing is made urgent, no consent is manufactured.
- **Notification restraint:** passes **by construction** — nothing here sends a message. The history is
  a screen the user opens, not a push. Explicitly **do not** add "your points changed!" notifications
  on the back of this; that would convert a trust feature into a re-engagement mechanic and fail the
  bar.
- **Honest labels:** passes. No "AI," no "smart," no "transparency" branding. It is a constraint, an
  endpoint and a list.
- **One risk to weigh, not hide:** publishing every negative-adjustment reason to the user could leak
  anti-abuse reasoning to an abuser ("removed: duplicate-account detection"). The mitigation is a
  short controlled vocabulary of reason strings rather than free-text operational detail — **but that
  is a real design decision with a real trade-off, and the CEO should make it, not have it assumed
  away.** What must not happen is the trade-off being used to justify NULL.

## What I did NOT verify

- **Whether any code path writes `reason = 'adjustment'` today.** I confirmed the enum value exists and
  that `note` is optional; I did **not** trace whether an admin route, worker or script currently
  creates negative adjustments, nor whether an admin UI exposes it. If nothing writes them yet, this
  proposal is even cheaper — and even more clearly a "decide before it matters" move.
- **Whether a diner-facing points history exists outside `apps/customer/js`.** I grepped
  `apps/customer/js` and `api/src/app/api/v1`. I did **not** check `standalone/`, `apps/business`, or
  `apps/company` — though a *diner*-facing history would not live there.
- **Whether `audit(...)` already logs points adjustments.** `CLAUDE.md` requires sensitive admin
  operations to write an audit row. If they already do, item 1 gets cheaper (the reason may already
  exist somewhere) — but an audit row is **staff-visible**, and this proposal's whole claim is that the
  **diner** can read it. Those are different surfaces and one does not substitute for the other.
- **The four TheFork complaints are one side of a story.** They are verified as *published complaints
  with dates*; I did not obtain TheFork's account of why those accounts were suspended. It is entirely
  possible some were fraud. That does not weaken the proposal — the mechanism is about telling the
  user, not about never suspending anyone.
- **No live test of Rezervno's loyalty flow was run.** Everything above is schema-, code- and
  grep-level evidence on one named ref.
