# LOYALTY-ECONOMY-DESIGN — the three cashback rates, and the gamification that can honestly stand on them

_Loyalty-economy designer · 2026-09-09 · on `opus` by explicit CEO exception (a loyalty economy is
expensive to reverse once real balances exist)._

**Binding on this document:** `.claude/skills/genz-agent-charter/SKILL.md`,
`.claude/skills/rezervno-audit-constitution/SKILL.md`, and
`docs/prompts/PROMPT-customer-club-ml-fa.md` — whose «قواعدِ غیرقابلِ مذاکره» are law here, in
particular rule 9 (**no lottery, no spin-wheel** — nothing below is one) and rule 10's vocabulary
(اعتبار = restaurant-funded · سکه = platform-funded · سطح · مأموریت · کیف · نشان).

**Scope discipline:** this round produced **no production code and no schema change**. Every claim
below is `file:line` against the working tree at `main` @ `936829f`, or an external source with a URL
and a date observed. Where I could not verify, the row says UNKNOWN.

**Built on, not repeating:** `ANTI-PATTERNS.md`, `INNOVATION-FRONTIER.md`, `BUSINESS-MODEL-KPI.md`,
`PARITY-RISK.md`, `LOYALTY-PERK-AUDIT.md`, `recon-notes-global.md` (all Scout, on file) and
`docs/audit/redteam/RETEST-2026-09-09.md` (Red Team, today). Where I contradict one of them, the
contradiction is stated with evidence rather than implied.

---

## 0. The finding that reframes the CEO's question

The brief asks what `cbPreorderPct`, `cbVipPct` and `cbWinbackPct` should mean. Before answering:
**there is no way to spend امتیاز.** Not at a reduced rate, not badly, not at all.

| Fact | Evidence |
|---|---|
| `points_ledger` has exactly **three** writers in all of `api/src` | `loyalty.ts:77` (`addPoints`), `loyalty.ts:120` (`addClubPoints`), `reservations.ts:620` (cashback) |
| **Every one writes a positive `delta`.** A repo-wide grep for a negative points delta returns one hit, in an unrelated table | `grep -rn "delta: -" api/src/` → `sms-balance.ts:86` only (`SmsLedger`, not `PointsLedger`) |
| `PointsReason.redemption` exists in the enum and is **never written** | `schema.prisma:667`; `grep -rn "'redemption'" api/src/` → 0 hits |
| No points→toman conversion rate exists anywhere | `grep -rniE "pointValue\|point_value\|POINTS_PER\|perPoint" api/src/lib/*.ts` → 0 hits |
| The reward marketplace is priced in **سکه**, not امتیاز | `rewards.ts:158-163` debits `customer_economy_profiles.wallet_balance`; `costCoins` throughout |

So `points_ledger` is a strictly monotonic counter. The customer screen renders it
(`apps/customer/js/features/loyalty.js:57-70`) next to the copy **«تا ۱۵٪ برگشت پول»**
(`apps/customer/js/data/seed.js:62`). Nothing comes back. Not 15%, not 5%, not one toman.

**Consequence for the CEO's question.** Implementing `cbVipPct` at 12% today would multiply a number
that redeems for nothing by 2.4×. It would not pay a single toman either — it would just be a larger
unspendable number. The Red Team's RT-01 verdict («سه‌چهارمش هرگز یک تومان پرداخت نمی‌کند») is
correct and, on this axis, still too kind: **four of four rows never pay a toman**, because the
currency they pay in has no exit.

This does not make the three-definition question moot. It makes it **second**. The definitions below
are written so that they are correct on the day a redemption path exists, and §8 sequences them so
that none of them ships before it.

---

## 1. The second finding: cashback only exists inside a preorder

`api/src/lib/reservations.ts:574` opens the entire checkout block with:

```ts
if (input.preorder?.length) {
```

`subtotal` (`:585`) is the sum of preorder item prices from the DB. `discount` is a coupon or gift
card. `final = Math.max(0, subtotal - discount)` (`:607`). Cashback (`:610-616`) is computed only
inside that block.

**A reservation without a preorder produces no `checkout` object and no cashback row at all.** Not a
smaller cashback — none.

Corroborated independently in the schema's own comment: `CustomerInsight.totalSpendToman` is
documented as *«جمعِ پیش‌سفارش‌ها. NULL = اندازه‌گیری‌ناپذیر (رستوران منویِ قیمت‌دار ندارد)»*
(`api/prisma/schema.prisma:1043`). The platform's **only** knowledge of money spent is the preorder
sum. There is no POS integration and no payment gateway — `reservations.ts:341` notes
`deposit_required` is unimplemented *«بدونِ درگاهِ پرداخت»*.

That single fact decides definition A below, and it is why the business panel's preview row
«رزرو معمولی → ۵٪» (`apps/business/js/staff-system.js:299`) is itself false.

---

## 2. The three definitions

Format per rule: **trigger · computed from · why this and not the alternatives · who pays.**

Restaurant-facing semantics are already committed in shipped UI at
`apps/business/js/staff-system.js:291`, and I treat them as the product's stated intent:

```js
[['base','کش‌بک پایه','برای تمام رزروها',20],
 ['pre','پیش‌سفارش','رزرو همراه با منو',25],
 ['vip','مشتری VIP','اعضای سطح طلایی و بالاتر',30],
 ['wb','بازگشت (Winback)','مشتری ناراضی یا در خطر ریزش',40]]
```

---

### A. پیش‌سفارش — **DELETE `cbPreorderPct`.** It is a duplicate of a rate that is already the preorder rate.

**The case for deletion.** `cbBasePct` is applied at `reservations.ts:612`, inside the
`if (input.preorder?.length)` block opened at `:574`. It therefore *already* only ever pays on a
preorder. `cbPreorderPct` cannot be given a distinct meaning, because there is no second money event
to attach it to: a reservation without a preorder has no bill for a percentage to multiply.

Two columns describing one condition is how the next engineer ships the next false promise. A
deleted promise is honest; two names for one behaviour is worse than one wrong name.

**What must be deleted with it, or the fix is cosmetic:**

1. The panel preview row `<span>رزرو معمولی</span>` (`staff-system.js:299`) — it tells the owner that
   an ordinary reservation returns `base_pct`. It returns zero.
2. The slider card `['base','کش‌بک پایه','برای تمام رزروها',20]` (`:291`) — «برای تمام رزروها» is
   false for the same reason. Honest text: **«کش‌بکِ پیش‌سفارش — فقط روی رزروهایی که سفارش از منو
   دارند»**.
3. The slider card `['pre','پیش‌سفارش','رزرو همراه با منو',25]` — removed entirely.

**Alternatives considered and rejected.**

- *Make `cbBasePct` a flat toman reward on every reservation, and `cbPreorderPct` the percentage.*
  Rejected: a flat per-visit reward already exists and is already honest — `ARRIVAL_POINTS = 50`
  granted at check-in (`loyalty.ts:20`, granted in `lifecycle.ts:174-187` with
  `idempotencyKey: arrival:${id}`). Adding a second per-visit reward under a second name, shown on a
  different screen, is precisely how `PERKS` happened.
- *Give preorders a higher rate than "normal" reservations.* Rejected as already true, structurally:
  a preorder earns `50 + (cbBasePct% × final)`; a bare visit earns `50`. The differential exists
  without a second column, and it exists in a currency the user can already see.
- *Keep the column, set it to 0, document it as reserved.* Rejected under the CEO's own framing: a
  writable, zod-validated (`api/src/app/api/v1/restaurant/cashback/route.ts:40-42`), slider-backed,
  success-toasted setting is a shipped product surface, not a reserved field. A zero that the panel
  still renders and still accepts a write to is the same lie at a different value.

**Who pays:** nobody, after deletion. Today: nobody either.

**Cost of the change:** one schema column, one route field, two panel cards, one preview row. This is
the cheapest of the three answers and the only one that is a net *reduction* in surface area.

---

### B. مشتری VIP — **IMPLEMENT `cbVipPct`, as a per-restaurant tier multiplier — but only after the two-tier collision in §3 is closed.**

**Trigger.** At reservation creation, inside the same `if (input.preorder?.length)` block, when
`ClubMember.tier` for **this exact `(restaurantId, userId)` pair** is `gold` or `platinum`. The rate
**replaces** `cbBasePct`; it never stacks. One reservation, one rate.

**Computed from.** `club_members.tier`, via the same lookup `waitlist.ts:146-153` already performs:

```ts
const member = await db.clubMember.findUnique({
  where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
});
```

That column is genuinely maintained: `addClubPoints` writes it in the same transaction as the ledger
row, derived from the per-restaurant ledger balance through the same `tierFromPoints()` the customer
screen uses (`loyalty.ts:151-156`). This is rule 7 compliance — no parallel system, no new source of
truth.

**Why this and not the alternatives.**

- *Not `GuestProfile.isVipAnywhere`* (`loyalty-status.ts:71,83,166`): it is a cross-restaurant
  analytics rollup. Restaurant B would fund a discount earned entirely at restaurant A.
- *Not `CustomerInsight.isVip`* (`customer-insights.ts:319,339-348`): that flag is set from
  `predictedClvToman`, a churn computation. Paying money out of a churn model's output, with no
  `reason` shown to the owner or the diner, violates rule 1 directly. It is also a naming collision
  the `LOYALTY-PERK-AUDIT.md` §4 already flagged as a footgun; using it here would ratify the footgun.
- *Not `Table.isVip`* (`schema.prisma:286`): a staff table-zone label, unrelated.
- *Not silver+.* The panel already commits «اعضای سطح طلایی و بالاتر». Moving a threshold users were
  shown is the Starbucks-2026 failure: *"the new tiered structure feels like a devaluation"*
  (`recon-notes-global.md` §Starbucks, sourced there; primary `about.starbucks.com` returned **HTTP
  403** on re-fetch 2026-09-09, so this is cited as Scout's secondary, not upgraded).

**Precedent that this shape works in this exact category.** OpenTable's relaunched loyalty program,
**"OpenTable Regulars"** — press release dated **Oct. 27, 2025**, fetched 2026-09-09
([prnewswire.com](https://www.prnewswire.com/news-releases/opentable-unveils-revamped-loyalty-program--opentable-regulars--featuring-new-savings-and-better-benefits-for-diners-302594012.html)):

> "Diners to earn points for every completed reservation made directly on the platform, enabling
> them to collect 100 points per booking, with select reservations offering up to 1,000 points."

and Gold status is earned by *"completing six reservations on the OpenTable platform within 12
months"*, whose headline benefit is **"Priority Notify Me"** — waitlist priority. That is the same
benefit Rezervno already ships in `waitlist.ts:133-153`, consumed by three real `orderBy` paths
(`:282,335,393`). A reservation platform's tier is earned in **completed reservations over a rolling
window**, and its flagship perk is queue priority. Rezervno is one honest label away from that.

**Who pays.** The restaurant. `cbVipPct` is a per-restaurant column
(`schema.prisma:177`), applied to that restaurant's own preorder bill, for a member who reached gold
**at that restaurant** (800 points ≈ 16 arrival visits at 50 each, plus that restaurant's own
cashback grants — `loyalty.ts:41-45`, `:20`). The restaurant cannot go into debt on this rate
because the payout is a proportion of a bill it is collecting in the same transaction — **on the
condition that the currency is redeemable only against that restaurant.** Today it is redeemable
against nothing, and `points_ledger` has no payer column at all (`schema.prisma:676`,
`restaurantId String?`, used as a *scope* marker, not a funding attribution — confirmed by
`grep -rniE "budget|platformFunded|funded_by|subsid" api/src/` → **0 hits**). See §8-M0.

**Blocker, not a caveat.** See §3. Shipping `cbVipPct` before §3 is closed means paying 12% to the
wrong people and 5% to the people the UI told they were gold.

---

### C. بازگشت (Winback) — **IMPLEMENT `cbWinbackPct`, but redefine it from "at risk of leaving" to "the visit that ends a lapse."**

**What the product means today, and why it is the wrong trigger.** The panel says «مشتری ناراضی یا
در خطر ریزش», and the only code that carries the name agrees: `automation.ts:138-140`,
`case 'winback': targets = await targetsForSegment(automation.restaurantId, 'at_risk');`.

`at_risk` is `churnRisk` in `[40, 75)` (`customer-insights.ts:240-241`), and
`churnRisk = (daysSince / (expectedGap × 2)) × 100` (`:235`). So `at_risk` begins at
`daysSince ≥ 0.8 × expectedGap` — **before the customer is even late.** A weekly regular becomes
"at risk" on day 6 of a 45-day default gap being irrelevant to them. Paying the system's highest
rate (panel max **40%**) to a population that has not left, on a trigger that fires before lateness,
is unbounded spend with no attributable effect.

**Proposed trigger.** The **first** reservation at a restaurant whose `slotStart` is at least
`max(90 days, 2 × visitFrequencyDays)` after that customer's `lastVisitAt` at the same restaurant —
i.e. exactly the point where `customer-insights.ts:235` reaches `churnRisk = 100` and `:240` sets
`segment = 'churned'`. At most **once per (user, restaurant) per rolling 12 months.**

**Computed from.** `customer_insights.last_visit_at` and `customer_insights.visit_frequency_days`,
both already persisted per `(restaurantId, userId)` at `customer-insights.ts:244-258`. No new
computation; a comparison against two columns that exist.

**Why this and not the alternatives.**

- *Why not a fixed 90 days?* Paytronix's published research names **"80 to 90 days as the key average
  window for winning back lapsed guests"** and — the part that matters — recommends escalating to
  *"more valuable offers as guest absences stretch 2-to-3 times their average visit frequency"*, with
  *"Keep a control group to measure the true impact of the campaign."*
  ([globenewswire.com, 2018-07-30](https://www.globenewswire.com/en/news-release/2018/07/30/1543925/0/en/Paytronix-Research-Reveals-One-to-One-Win-Back-Campaigns-Drive-the-Most-Traffic.html),
  fetched 2026-09-09.) The recommendation is *relative to the guest's own cadence*, and
  `customer-insights.ts:235` already computes exactly that ratio. A global 90 days would over-pay a
  weekly regular by 13× their gap and under-serve a quarterly diner. The 90-day floor is kept only
  so a first lapse cannot fire absurdly early for a very-high-frequency guest.
- *Why not `rfm.ts`'s `hibernating`/`cant_lose`?* Because they are percentile labels, not day counts:
  `ntile(5)` over the current cohort (`rfm.ts:40-50,77-85`). The same customer behaviour gets a
  different label depending on who else visited that month. You cannot answer «چرا من ۲۰٪ گرفتم و
  دوستم نگرفت؟» from a percentile — which makes it unusable under rule 1 (`reason` +
  `computed_from`). It is also overwritten in place with no historical snapshot (the founder's own
  phase-9 note, `rfm.ts:40-51,86`), so it cannot even prove why it fired yesterday.
- *Why not `crm-recommendations.ts:76-80`'s `segment === 'churned'` branch?* That is the right
  population, and it is the closest existing rule — but it emits a **recommendation object** and
  grants nothing (`:64-100`). Reusing its predicate is correct; reusing its output is not, because it
  is gated on `intelligenceTier === 'high' || predictedClvToman >= 500_000`, i.e. it only recommends
  contacting *valuable* lapsed guests. A cashback rate that silently pays more to guests a model
  scored as valuable, without telling either party, is exactly the AI-washing rule 1 forbids.

**Who pays.** The restaurant, one-shot, bounded. Maximum annual exposure per user per restaurant is
`cbWinbackPct × (one preorder bill)`. **Recommendation the owner must rule on:** at panel max 40%,
this is by far the most expensive rate in the system and it has **no toman ceiling** — no rate in
this product does (`grep -rniE "budget" api/src/` → 0 hits). A percentage with no cap on a bill the
diner chooses the size of is an unbounded liability. Ship it with `min(pct × final, capToman)` or do
not ship it.

**Abuse case and its check:** waiting-to-farm — a regular deliberately skips 90 days to claim 40%.
Guards, both cheap SQL on data that exists: (a) require `totalVisits >= 2` at that restaurant so
`visitFrequencyDays` is measurable at all (it is `null` for a first-timer — `customer-insights.ts:200-203`
is explicit that NULL ≠ 0); (b) the once-per-12-months limit above, enforced by an
`idempotency_key` of shape `winback:{userId}:{restaurantId}:{year}` on the ledger row — the column
and its unique index exist (`schema.prisma:710`, commit `e876957`).

---

## 3. The blocker: two different things are both called «سطح طلایی»

This was not in the brief and it invalidates definition B until it is closed.

| Surface | Tier source | Scope |
|---|---|---|
| Customer loyalty screen | `GET /api/v1/me/loyalty` → `getLoyaltyStatus(auth.sub)` → `getPointsBalance(userId)` → `tierFromPoints` | **Global.** `loyalty.ts:89-91`: `aggregate({ where: { userId } })` — no `restaurantId` filter |
| Waitlist priority (real, load-bearing) | `computePriority` → `club_members.tier` | **Per-restaurant.** `waitlist.ts:146-153` |
| `cbVipPct`, if built as designed | `club_members.tier` | **Per-restaurant** |

Both render as «سطح طلایی» with the same emoji from the same `LOYALTY_TIERS` array
(`loyalty.ts:41-46`).

**The concrete failure, arithmetic from constants in the repo.** Platform grants are written with
`restaurantId = null` (`loyalty.ts:235-239` referral, `:434-435` birthday, `:464-465` anniversary;
signup likewise): `signup 200 + birthday 1000 = 1200` (`loyalty.ts:12,15`). A user who has signed up
and had one birthday, and has **never eaten anywhere**, crosses `gold.min = 800` and is shown
**«سطح طلایی»** on the loyalty screen — while `club_members.tier` is `bronze` at every restaurant, so
`tierToPriority` returns **0** (`waitlist.ts:142`) and `cbVipPct` would never fire.

The perk card promising «⚡ اولویت در ساعات شلوغ» renders unconditionally beside that gold badge
(`loyalty.js:100`, `seed.js:62`).

**This must be decided before B ships.** Two options, both real:

1. **Scope the tier.** The loyalty screen shows the per-restaurant tier when a restaurant is in
   context, and platform grants stop counting toward any tier that carries a benefit. Cost: some
   users' visible tier goes *down* the day it ships — a demotion, which is the exact
   `ANTI-PATTERNS.md` #11 shape and needs its own announcement.
2. **Rename the global one.** Keep the global number, stop calling it سطح, and give it the
   `INNOVATION-FRONTIER.md` §2 "dining passport" identity — «گذرنامهٔ رزروینو: ۱۲ رستوران، ۴۷ بازدید»
   — explicitly carrying **no** benefits, with سطح reserved for the per-restaurant thing that pays.
   Cost: nothing is taken away; one screen is rebuilt.

**My recommendation: option 2.** Nothing is confiscated, the shareable artifact Scout already argued
for gets built out of a number that already exists, and سطح becomes one word for one thing. But this
is a product decision with a user-visible consequence either way, so it is escalated, not assumed.

---

## 4. The gamification system

Every mechanic below states: what the user does · what they get · when it expires · what happens at
the edges. Mechanics whose data does not exist are marked and sequenced into §8, not hidden.

**Excluded on purpose:** any lottery or wheel (rule 9). Any paid status tier (the Snapp Pro shape,
`profiles/snappfood-loyalty.md`) — this is a free club. Any "هوشمند" mechanic: nothing below is
produced by a model, and nothing below is labelled as if it were.

### 4.1 کارتِ مهر — the stamp card we already run and never show

**Exists already, invisibly.** `ARRIVAL_POINTS = 50` is a fixed per-visit grant at check-in
(`loyalty.ts:20`, `lifecycle.ts:174-187`). That is a stamp card with the stamps hidden.

- **User does:** completes a reservation at a restaurant (status reaches `checked_in`; the grant is
  already idempotent on `arrival:{reservationId}`).
- **Gets:** stamp N of 6, with a **mid-card reward at 3**. Six-with-a-midpoint is the shape the
  founder's own research file recommends («عددِ توصیه‌شده: ۶ تا ۱۰ خرید … به‌علاوه‌ی یک پاداشِ میانی»,
  `docs/research/RESEARCH-customer-club-fa.md:59-60`).
- **Expires:** owner decision, tied to §7. If امتیاز expires, a partial card expires with it; if not,
  it does not. One clock, never two (`ANTI-PATTERNS.md` #10 — Chipotle stacks three).
- **Edge — restaurant leaves the platform:** the diner must not be punished for a B2B event. The
  observed industry default is the anti-pattern: *"If a loyalty program or specific campaign is
  deactivated or ended by the restaurant, all associated unredeemed points are immediately purged
  from customer accounts"* (WebSearch synthesis, 2026-09-09 — **secondary, not fetched to a primary
  page**, flagged as such). Rezervno's rule should be the opposite: a partial card at a departed
  restaurant converts to **سکه** at a published rate, paid by the platform, because the platform is
  the party that lost the restaurant.
- **Data needed:** none new. Visit count per `(user, restaurant)` from `Reservation` +
  `visitedStatusList()` (`reservation-status.ts:57-66`).

### 4.2 رشتهٔ هفتگی — a streak that currently measures the wrong thing

**Exists, and is honest about being a record rather than a streak — but the UI is not.**
`longestWeekStreak` (`loyalty-status.ts:115-129`) returns the **longest** run of consecutive weeks
ever, over `fetchVisitTimestamps` (`:134-140`) which filters by `userId` only — **all restaurants,
all time, no date bound**. The `streak5` نشان (`:56`, threshold `STREAK_BADGE_WEEKS = 5`, `:66`) is
therefore permanent once earned, which is fine; but a UI that calls this number "your streak" is
wrong, because it can never go down.

- **User does:** has at least one completed reservation in a Tehran-timezone week (`weekIndex`,
  `:105-108`).
- **Gets:** a visible current run, and the نشان at 5.
- **Edge — missed week:** a **جبران** (forgiveness), one per quarter, applied automatically. Precedent:
  Duolingo stores at most two streak freezes, they cannot be bought retroactively after the day is
  missed, and a free repair is granted once a month
  ([lingoly.io](https://lingoly.io/repair-duolingo-streak/) / [Medium duoinsider](https://medium.com/duofluency/duolingo-streak-freeze-maintaining-your-language-learning-streak-with-confidence-16516b7e04bc),
  both WebSearch-synthesized 2026-09-09, **secondary — not fetched to Duolingo's own docs**).
  **Explicitly not proposed for v1:** buying forgiveness with سکه. That turns a streak into a paywall
  and creates a second reason to hold coins that has nothing to do with dining.
- **What must change first:** decide whether the displayed number is the current run (can fall) or
  the record (cannot). Both are defensible; showing the record and calling it the current run is not.
  If it becomes the current run, that is a visible number going down — a demotion, announce it.

### 4.3 مأموریت — the missions table is empty, and it can currently express exactly one mission

- `Mission` exists (`schema.prisma:2034-2052`) with `kind`, `targetCount`, `xpReward`,
  `walletReward`, `strikeRelief`.
- **Zero rows are seeded.** `api/prisma/sql/038-unified-economy.sql:109-125` creates the table and
  inserts nothing; `grep -rn "INSERT INTO missions\|mission.create" api/prisma/` → 0 hits.
- The **only** automatic progress signal is a positive reservation outcome:
  `updateMissionProgressTx(tx, { isPositiveEvent, isViolation })` (`missions.ts:26-75`), called from
  `economy.ts:267-269` with `isPositiveEvent: event.score >= 80`. The module's own header says so:
  `Mission.kind` is display-only, not an automatic criterion (`missions.ts:8-16`).

**Design consequence, stated plainly:** every mission that can ship today is the same mission —
"complete N reservations without a violation" — differing only in N and in reward. A mission whose
copy says anything else («سه آشپزی متفاوت را امتحان کن») is a promise with no code path and must not
be written. **Missions beyond that one signal are blocked on the event substrate (§8-M2).**

- **Edge — `kind === 'recovery'`:** progress resets to 0 on a violation (`missions.ts:47-54`). This
  is the only kind with distinct behaviour and it is real. If it ships, the reset must be *announced
  in advance in the mission's own copy*, or it is an unannounced loss.
- **Claim path is sound:** atomic `claimed_at IS NULL` update (`missions.ts:117-122`) before the
  grant (`:127-130`).

### 4.4 سطح — one word, one thing (see §3)

- **Thresholds:** `0 / 300 / 800 / 2000` (`loyalty.ts:41-45`). **Do not move them.** A moved threshold
  is `ANTI-PATTERNS.md` #11.
- **Benefits that are real today:** waitlist priority (`tierToPriority`, silver 20 / gold 50 /
  platinum 100 — `waitlist.ts:137-143`, genuinely consumed at `:282,335,393`). That is one real perk,
  and it is worth **zero to bronze**, which is where every new member starts.
- **Recommendation on bronze:** give bronze a small non-zero priority (e.g. 5) so that joining the
  club is never worth literally nothing on the axis the perk card advertises — or state the threshold
  in the copy. `LOYALTY-PERK-AUDIT.md` §2 reached the same two options independently; I concur, and
  prefer the non-zero priority because it needs no copy caveat.
- **Demotion:** **not in v1**, and this is a real cost, not a free choice — a tier that never demotes
  is a lifetime liability, which is the same balance-sheet problem as no-expiry (§7). Present them to
  the owner as **one** decision, not two. Note that both category leaders demote: OpenTable Gold is
  *"six reservations … within 12 months"* (rolling), Starbucks Gold is a rolling 12-month Star window.
- **Dead branch to clean:** `isVipTier` and `tierToPriority` both test for `tier === 'vip'`
  (`waitlist.ts:134,139`), a value `tierFromPoints` can never produce — `LOYALTY_TIERS` has no `vip`
  key (`loyalty.ts:41-46`). Harmless today; a trap for the next reader.

### 4.5 نشان — the one part of this system that is already fully honest

Six badges, all server-computed from real queries, all with real thresholds
(`loyalty-status.ts:54-85`): `first_visit`, `streak5`, `gourmet` (≥3 restaurants), `night_owl`
(≥3 late visits), `vip`, `explorer` (≥7 restaurants). They never expire and never revoke. **Keep
that, and say it in the copy** — it is a genuine differentiator against every expiry complaint in
§7.

**One deletion:** `apps/customer/js/data/seed.js:63` `BADGES` is a dead client-side duplicate with
**hardcoded earned flags** (`['👑','VIP',0]`). `loyalty.js:102` correctly renders the server array
instead, so this is currently unused — but it is a loaded gun of exactly the `PERKS` class. Delete it.

### 4.6 کیف — no new coin sink until `wallet_spend` is written

`EconomyLedgerKind.wallet_spend` exists (`schema.prisma:1968`) and
`grep -rn "wallet_spend" api/src/` → **0 hits**. Coins are spent by a raw balance decrement that
writes no ledger row (`rewards.ts:158-163`). The earn side does write one (`economy.ts:346-352`, with
`ON CONFLICT (reservation_id, kind) DO NOTHING` as the idempotency guard).

So `economy_ledger_entries` is an **earn-only** log and a user's spending is unreconstructable from
it. The only trace is `RewardRedemption.coinsSpent` (`rewards.ts:178-183`).

**Design rule adopted here: no mechanic in this document may create a new way to spend سکه until the
spend writes a ledger row.** A coin that vanishes from a user's own history is the mechanic
`ANTI-PATTERNS.md` #1 is about, aimed at ourselves.

### 4.7 What I deliberately did not design

- **Any personalized/"surprise" reward.** Needs behavioural history; `platform_events` receives
  **zero** reservation or loyalty events from the backend (§8-M2). Proposing it now would be rule-1
  AI-washing with no data underneath.
- **Any holdout-measured mechanic.** Same reason. Rule 3 is currently unexecutable and the founder's
  plan says so.
- **A referral leaderboard, or any competitive ranking.** It converts a referral bounty into a
  farming target, next to a 500-point reward with zero guards (§6).

---

## 5. Honesty audit of this design — every promise, and the code path that keeps it

Rule: *any promise without a code path is deleted from the design before submission.* The deletions
are listed, not omitted.

### 5.1 Promises this design keeps, with their path

| Persian copy the UI would show | Code path that keeps it | Status |
|---|---|---|
| «هر بار که بیای، یک مهر» | `lifecycle.ts:174-187` → `addClubPoints(ARRIVAL_POINTS)`, idempotent on `arrival:{id}` | **Exists today** |
| «هدیهٔ تولد» | `loyalty.ts:392-447` `grantBirthdayRewards`, daily cron, `idempotencyKey: annual:{u}:birthday:{year}` + DB partial index `uniq_annual_reward` | **Exists today** |
| «در ساعات شلوغ زودتر به تو میز پیشنهاد می‌شود» — **only if the tier is stated** | `waitlist.ts:146-153` → `:282,335,393` `orderBy: [{priority:'desc'},{joinedAt:'asc'}]` | **Exists; copy must state the tier or bronze must become non-zero** |
| «۵ هفتهٔ پیاپی» نشان | `loyalty-status.ts:115-129` + `:78-85` | **Exists today** |
| «با پیش‌سفارش، درصدی از صورت‌حساب برمی‌گردد» | `reservations.ts:574,610-616,620` | **Exists — but see 5.2, the return has no exit** |
| «عضو طلایی این رستوران کش‌بک بیشتری می‌گیرد» | **To build**, §2-B; blocked on §3 | Design, not shipped |
| «بعد از مدتی نیامدن، بازگشتت جایزه دارد» | **To build**, §2-C; needs the toman cap | Design, not shipped |

### 5.2 Promises deleted from the design because no path exists

| Promise | Where it lives now | Why deleted |
|---|---|---|
| **«تا ۱۵٪ برگشت پول»** | `seed.js:62`, rendered `loyalty.js:100` | Three ways false: (a) امتیاز has **no spend path at all** (§0); (b) the only live rate defaults to **5**, not 15 (`schema.prisma:175`); (c) it pays on preorders only (§1). Delete the string. Replace only once §8-M1 sets a redemption rate. |
| **«میز VIP — دسترسی به میزهای ویژه»** | `seed.js:62` | `Table.isVip` (`schema.prisma:286`) is read by two staff-admin routes only; **zero** reservation-assignment code connects it to a club tier (`LOYALTY-PERK-AUDIT.md` §4, independently re-confirmed here by the same grep). Delete. |
| **«اولویت در ساعات شلوغ»** *shown flat to everyone* | `loyalty.js:100`, no tier filter | The mechanism is real; the **flat presentation** is the false part — bronze gets 0 (`waitlist.ts:142`). Keep the perk, delete the flat framing. |
| **«رزرو معمولی → X٪»** (owner-facing) | `staff-system.js:299` | Pays zero (§1). Delete the row. |
| Any mission copy other than "complete N reservations" | not yet written | Only one automatic signal exists (`missions.ts:26-75`). Do not write it. |
| **«امتیازهات هیچ‌وقت منقضی نمی‌شن»** | `loyalty.js:78` | **True today** — but see §7. This is not deleted; it is escalated, because it is a promise already shipped that constrains a decision that has not been made. |

---

## 6. Anti-abuse — every earn mechanic ships with its abuse case and its check

### 6.1 Live today, unguarded

**A. Self-referral. Zero guards, next to the largest reward in the system.**
`POINTS.referralReward = 500` (`loyalty.ts:14`). `createReferral` (`:186-213`) rejects only a
duplicate `(referrerId, inviteePhone)` pair; `completeReferral` (`:216-241`) matches on
`inviteePhone` + `status:'pending'`. Greps for a self-check
(`referrerId !== `, `selfRef`, `self_ref`) → **0 hits**.
*Check:* normalize `inviteePhone` to E.164 and compare against the referrer's own `User.phone`;
reject. Then the multi-party loop (A→B→A) — **depth is the owner's call**, per the founder's plan
phase 2. External context: *"self-referral fraud occurs when a customer refers themselves using a
different email address to collect both sides of a two-sided reward, often being the first thing
programs encounter at scale"* (WebSearch synthesis of referral-fraud vendor literature, 2026-09-09 —
**secondary**, cited as corroboration of the pattern, not as a statistic).

**B. Cashback is written at reservation *creation* and is never reversed.**
`reservations.ts:620` writes the ledger row inside the booking transaction. The lifecycle module
awards club points on `checked_in` and XP/coins on completion (`lifecycle.ts:174-207`) but **never
touches cashback**; `grep -rn "reason: 'cashback'" api/src/` returns the single write site.
Terminal statuses `no_show` and `cancelled` (`lifecycle.ts:45-46`) trigger no clawback.
*So today:* book with a 5,000,000-toman preorder, receive cashback, cancel. This costs nothing only
because the currency is worthless (§0). **The day a redemption path ships, this is free money.**
*Check:* move the cashback write from creation to a completion transition, or write a compensating
negative ledger row on `no_show`/`cancelled` keyed
`cashback-reversal:{reservationId}`. Moving it is cleaner and matches TheFork's own published rule —
Yums are credited *"Three days after your meal, if you honour your booking"*
(`recon-notes-global.md`, quoting `thefork.co.uk/yums`, fetched by Scout 2026-09-05).

**C. No budget cap of any kind.** `grep -rniE "budget|platformFunded|funded_by|subsid" api/src/` →
**0 hits**. Rule 6 (fail-closed on a full budget) has nothing to be closed against.
*Check:* a per-restaurant monthly ceiling checked inside the same transaction as the grant, and
fail-closed to zero-cost rewards when full.

### 6.2 Introduced by this design, with their checks

| Mechanic | Abuse | Check |
|---|---|---|
| `cbVipPct` | Reach gold cheaply, then extract a high rate indefinitely | Tier is per-restaurant and earned at that restaurant (§2-B); the rate replaces rather than stacks; panel cap 30 |
| `cbWinbackPct` | Wait-to-farm the highest rate | `totalVisits >= 2` at that restaurant; once per 12 months via `idempotency_key = winback:{u}:{r}:{year}`; a **toman cap** (§2-C) |
| کارتِ مهر | Many small reservations to farm stamps | Stamps ride on `arrival:{reservationId}`, already idempotent; a stamp requires a real `checked_in` transition, which is staff-driven |
| رشتهٔ هفتگی | Trivial weekly bookings to hold a streak | Accept it — the mechanic's purpose *is* a weekly visit. But `fetchVisitTimestamps` has **no date bound and no restaurant filter** (`loyalty-status.ts:134-140`); a bounded window is needed before the number is shown as "current" |
| Any new coin sink | Coins vanish from history | Blocked until `wallet_spend` writes a row (§4.6) |

### 6.3 The structural gap under all of it

`points_ledger` has **no payer column**. `restaurantId` is nullable and used as a *scope* marker —
platform grants (signup, referral, birthday, anniversary) pass `null`
(`loyalty.ts:235-239,434-435,464-465`); restaurant grants pass an id. Nothing records **who funds**.
Rule 5 («پاداشِ پلتفرمی را پلتفرم می‌پردازد؛ رستوران هرگز بدهکار نمی‌شود») is therefore not
enforceable and the liability query the founder's phase 8 requires cannot be split by payer.

**Nothing in §2 can be honestly labelled "restaurant-funded" until this column exists.** That is
§8-M0, ahead of all three definitions.

---

## 7. Expiry — the owner's decision, presented, not decided

**First, two corrections to the framing I was given.** Both matter to the decision.

**Correction 1 — the 36% figure is misattributed.** `docs/research/RESEARCH-customer-club-fa.md:84`
states *«۳۶٪ اعضا انقضا را آزاردهنده‌ترین ویژگی می‌دانند»*. Traced today
([cordial.com, fetched 2026-09-09](https://cordial.com/resources/customer-loyalty-rewards-program-stats/)),
36% is a different statistic from the same survey:

> "More than a third (36%) of consumers say they would leave a loyalty program if they did not earn
> rewards fast enough." — Cordial's 2023 Survey on Customer Loyalty and Rewards Programs

The expiry figure in that same survey is **47%**:

> "While 47% of consumers say rewards points that expire is a top frustration, only 39% of B2C
> marketers think expiring points are a top frustration among consumers."

An independent, more recent and better-specified figure
([eMarketer, published 2026-05-08, fetched 2026-09-09](https://www.emarketer.com/content/expiring-points-qsr-loyalty-s-biggest-sore-spot)):

> "35% of US QSR loyalty members say points expiring too quickly is their top frustration with
> loyalty programs"

— Alchemer's March 2026 *"2026 Quick-Service Restaurant Study"*, n=800 US adults 18+, current QSR
loyalty members who purchased in the past month, fielded **October 8–9, 2025**; expiry ranked first,
eight points ahead of second.

The conclusion the founder drew survives; the number does not. **Use 35% (QSR-specific, dated,
sample stated) or 47% (broader, 2023). Not 36%.**

**Correction 2 — "12-month rolling is the industry norm" is a US/EU read, and Iranian expectation is
set differently.** The two largest Iranian consumer clubs both use **calendar-boundary** expiry:

- **Snapp Club** — points expire **twice a year, end of spring and end of autumn**; a near-expiry
  banner shows remaining points and days left (`profiles/snappfood-loyalty.md`, Scout, WebSearch
  synthesis of `snapp.ir/blog/points-expiry/`, 2026-09-04 — **secondary**).
- **DigiClub (Digikala)** — [digikala.com/mag/digiclub-introduction, fetched 2026-09-09]:
  «کلیه امتیازهای کسب‌شده در هر سال تا پایان سال بعد معتبر هستند» — points earned in a year are valid
  until the end of the *following* year. Earn rate: «به ازای هر ۱۰ هزار تومان خرید … یک امتیاز».

A rolling per-point 12-month clock would therefore read to an Iranian user as **stricter** than what
they know, not more generous — the opposite of how it reads in a US comparison. *(Noted for rule 9:
DigiClub's own redemption menu includes «شرکت در قرعه‌کشی‌های مختلف». We do not copy that.)*

**Correction 3 — the decision is not neutral, because we have already promised.**
`apps/customer/js/features/loyalty.js:78` ships the string
**«امتیازهات هیچ‌وقت منقضی نمی‌شن»**. Introducing expiry later is not adding a rule; it is
withdrawing a stated promise — the TheFork shape that produced 4 of 21 recent 1-star reviews in a
four-week window (`ANTI-PATTERNS.md` #1). **Every day that string ships, the cost of choosing
expiry rises.** This makes the decision more urgent than the founder's plan implies, where it sits in
phase 5.

### The three options

| Option | Balance-sheet consequence | User consequence | Precedent |
|---|---|---|---|
| **No expiry** (status quo, already promised in copy) | Liability grows forever; breakage is undefined; the founder's phase 8 (liability/breakage report) becomes unbuildable — his own hard dependency ۵→۸ | Zero anger. The `loyalty.js:78` promise stands. A real differentiator against 35–47% of the market's top complaint | TheFork has one year; Starbucks Gold/Reserve Stars **never** expire |
| **Rolling 12 months per grant** | Breakage computable; liability bounded | Withdraws a shipped promise. Reads *stricter* than Snapp/Digikala | The US/EU norm |
| **Calendar boundary** (e.g. all points valid to the end of the next Persian year) | Breakage computable; liability bounded; batch expiry is simpler to compute and to warn about | Also withdraws the promise, but matches what Iranian users already expect from Snapp and Digikala | **DigiClub, verbatim, fetched today** |

**Non-negotiables whichever is chosen, and they are mine to state, not the owner's:** exactly **one**
clock per earned value (`ANTI-PATTERNS.md` #10 — Chipotle stacks three: annual inactivity, 60-day
redeemed reward, 30-day birthday reward). No asymmetric expiry by tier — Starbucks expires
Green-tier Stars in 6 months while Gold/Reserve never expire, which penalises exactly the segment
least likely to complain and most likely to quietly churn (`ANTI-PATTERNS.md` #11). An in-app
near-expiry warning before any point dies, with the amount and the date. And the balance and its
expiry visible **in تومان-denominated worth**, which requires §8-M1's redemption rate to exist first.

---

## 8. Sequencing — what can be built today, what needs the substrate, what needs a decision

### M0 — buildable on today's data, no new decisions, no new events

Ordered by cost of *not* doing it.

1. **Delete `cbPreorderPct`** and re-label the two panel cards and the preview row (§2-A). Delete
   `PERKS`' cashback and VIP-table strings and the dead `BADGES` array (§5.2).
2. **Add a payer/funding column to `points_ledger`** (§6.3). Without it, rule 5 is unenforceable and
   §2-B/§2-C cannot be described honestly to a restaurant owner. Per the constitution §6, the column
   goes in **both** `schema.prisma` and the next `api/prisma/sql/NNN-*.sql`.
3. **Self-referral guard** (§6.1-A). Largest reward, zero guards.
4. **Cashback clawback or deferral** (§6.1-B). Harmless today, an open till the day redemption ships.
5. **Write `wallet_spend`** on the coin debit path (§4.6). One insert next to `rewards.ts:158-163`.
6. **A ledger-history screen.** `getPointsHistory` exists (`loyalty.ts:96`) and is exposed at
   `api/src/app/api/v1/me/points/route.ts:14`; `grep -rn "/me/points" apps/customer/js/` → **0 hits**.
   A user can see a total and cannot see one line of how it got there — the precondition for anyone
   ever noticing a wrong balance.
7. **Bronze non-zero waitlist priority**, or the tier stated in the perk copy (§4.4).
8. **کارتِ مهر made visible** (§4.1) — the only genuinely *new* user-facing mechanic in M0, and it
   ships a mechanic that already runs.

### M1 — blocked on an owner decision, not on engineering

| Blocked item | Decision needed |
|---|---|
| Anything that says «برگشت پول» | **What is one امتیاز worth in تومان, and how is it spent?** Until this exists, cashback at any rate is a number, not money |
| `cbVipPct` (§2-B) | §3: scope the tier or rename the global one |
| `cbWinbackPct` (§2-C) | The toman cap, and the default rate (panel max is 40) |
| Expiry, and tier demotion | §7 — **one decision, not two** |
| Streak: current run or record (§4.2) | Whether a visible number may go down |
| Referral loop depth (§6.1-A) | Founder's plan phase 2 already assigns this to the owner |

### M2 — blocked on the event substrate

> **⚠️ Self-correction, filed before anyone found it (charter behaviour #1).** My first draft of this
> section asserted that *no* mechanic needing behavioural history can ship. That is too strong, and I
> reached it by following `emit()`/`platform_events` and stopping there. **Reservation lifecycle
> history does exist today**, in a different table I did not check before writing:
> `model ReservationEvent` (`schema.prisma:584-597`, `@@map("reservation_events")`) is written by
> `lifecycle.ts:124-133` **inside the same transaction as the status change and behind the
> compare-and-set at `:114-121`** — so there is exactly one append-only row per real transition, with
> `fromStatus`, `toStatus`, `actor`, `isAutomatic`, `createdAt`. Read path: `lifecycle.ts:399-401`.
>
> What it lacks is `userId`/`restaurantId` (reachable only by joining the mutable `Reservation` row),
> any point-in-time feature snapshot, and any rule version or holdout assignment.
>
> **Corrected statement:** the mechanics in §4 that depend on *visit history* — کارتِ مهر, رشتهٔ
> هفتگی, and the winback lapse trigger in §2-C — read `Reservation` directly and are **not** blocked
> on any substrate work. What is blocked is anything needing (a) **loyalty-side** events (a points
> grant, a redemption, a tier change, an expiry — none of which is emitted anywhere) or (b) an
> unbiased control group and point-in-time features.
>
> **Also noted, and it changes this section's urgency:** another session is building exactly this
> right now. As of this writing the working tree carries untracked
> `api/src/lib/ml-substrate.ts` and `api/prisma/sql/082-reservation-events-ml-substrate.sql`, both
> headed *«M0 — زیرساختِ رویداد برای ML … تأیید: CEO `rezv-9c [5283b5]`، ۲۰۲۶-۰۹-۰۹»*, enriching
> `reservation_events` with `restaurant_id`, `rule_version`, `holdout_bucket` and `decision_inputs`
> rather than building a second emitter. **Whoever scopes this design's build should read
> `docs/audit/fixes/M0-EVENT-SUBSTRATE-DESIGN.md` first and coordinate — I did not, because the work
> landed in the tree while I was writing.** The loyalty-side event gap below is still real and is not
> covered by that migration.

The loyalty-side gap, unchanged:

- `events.ts:21-24` declares 8 `DomainEvent` values. **Exactly one is ever emitted** —
  `reservation.created` at `reservations.ts:413-417`. The other seven, including
  `reservation.completed`, `reservation.no_show`, `waitlist.seated` and `coupon.redeemed`, have
  **0 call sites**.
- `emit()` is a **webhook dispatcher**, not a recorder: it reads `db.webhook.findMany` and enqueues
  deliveries (`events.ts:36-68`). Its own doc comment at `:16` claims it records the event in the DB.
  It does not. **If a restaurant has no webhook, the event vanishes entirely.** That mismatch between
  comment and code is itself worth a fix.
- `platform_events` exists (`schema.prisma:1639-1674`) and its four server-side writers are all
  billing/marketing-site events (`site-orders.ts:206-212,485-488,597-599,641-643`). The only other
  writer is the client telemetry endpoint (`telemetry/route.ts:279`), whose rows default to
  `trustLevel = ANONYMOUS_CLIENT`. **Zero reservation, loyalty, points, cashback or wallet event is
  written by the backend.**

Blocked until that changes: holdout and attribution (founder's rule 3 and phase 4), missions beyond
the single `event.score >= 80` signal (§4.3), any measured claim about whether a winback offer
worked, and every "surprise"/personalized mechanic. Also blocked: training anything on `rfm.ts`
labels, which are recomputed in place with no historical snapshot.

---

## 9. What I did NOT verify

- **Mobbin was unavailable.** The CEO named it as directly relevant; both `search_screens` and
  `search_flows` returned `Mobbin MCP requires a paid plan. Upgrade at https://mobbin.com/pricing`.
  No UI-pattern evidence in this document comes from Mobbin. This is a blocked capability, not an
  absent one.
- **Starbucks' 2026 tier and expiry rules were not re-fetched to a primary source this pass.**
  `about.starbucks.com` and `fastcompany.com` both returned **HTTP 403** on 2026-09-09. The
  Green/Gold/Reserve thresholds, the 1x/1.2x/1.7x multipliers and the 6-month Green-Star expiry are
  cited from `recon-notes-global.md` (Scout, 2026-09-04, itself WebSearch-synthesized) and are
  **secondary**.
- **OpenTable's own Bonus Points and Booking Streak Challenge pages timed out** (60s, both), matching
  Scout's earlier finding in `BUSINESS-MODEL-KPI.md` §4. The 10× off-peak multiplier and the streak
  challenge are therefore WebSearch synthesis, **not fetched** — I have not used either as a
  load-bearing claim. The OpenTable Regulars facts I do rely on (100 points/booking, Gold = six
  reservations in 12 months, Priority Notify Me) come from the **fetched** PR Newswire release dated
  2025-10-27.
- **No live database query, no test run, no `tsc`, no build.** Everything above is a static read of
  the working tree at `936829f`. I did not execute the suite and I claim no exit code.
- **Whether any live restaurant has actually configured `cbVipPct`/`cbWinbackPct` above default** —
  requires production DB access. If any has, the gap between what they were told they saved and what
  their guests received is a support liability beyond the code finding. Carried forward unresolved
  from `LOYALTY-PERK-AUDIT.md` §7.
- **Whether Iranian diners would value a stamp card, a streak, or a passport** — no user research
  exists for a pre-launch product. The case rests on the Gen-Z charter's heuristics and on
  competitor structure, not on measured demand. UNKNOWN, not "yes".
- **The "points purged when a restaurant deactivates a program" claim (§4.1)** is WebSearch synthesis
  of vendor documentation, never fetched to a primary page. Used to motivate a rule, not as a
  citation of anyone's specific terms.
- **Tapsi's club** was not researched at all this pass; the Iranian anchors here are Snapp Club and
  DigiClub only.
- **I did not re-derive** `waitlist.ts`'s three `orderBy` sites, the `uniq_annual_reward` partial
  index in migration 013, or Scout's TheFork/Trustpilot counts — those are reused with their original
  sourcing intact.

---

## 10. چه دیدم که کسی نخواست

1. **امتیاز has no spend path whatsoever.** Three ledger writers, all positive
   (`loyalty.ts:77,120`, `reservations.ts:620`); `PointsReason.redemption` never written; no
   points→toman rate anywhere. Every cashback debate — 5%, 12%, 20%, 40% — is a debate about the
   multiplier on a currency with no exit. **«تا ۱۵٪ برگشت پول» (`seed.js:62`) is false at every rate
   for every restaurant, and it is false in a way that no cashback fix touches.**

2. **Two different things are both called «سطح طلایی».** The customer screen's tier comes from a
   **global** balance (`getPointsBalance`, `loyalty.ts:89-91`, no `restaurantId` filter); waitlist
   priority and any future `cbVipPct` come from the **per-restaurant** `club_members.tier`
   (`waitlist.ts:146-153`). Because platform grants carry `restaurantId = null`, a user who signs up
   (200) and has one birthday (1000) is shown **«سطح طلایی»** without ever having eaten anywhere —
   while `tierToPriority` returns **0** for them at every restaurant on the platform.

3. **Cashback is written at booking and is never reversed on no-show or cancellation.** The single
   write site is inside the creation transaction (`reservations.ts:620`); `lifecycle.ts` grants
   arrival points and completion XP but never touches cashback, and no compensating negative row
   exists anywhere. It is harmless today only because of finding #1. **The day a redemption path
   ships, "book a huge preorder, take the cashback, cancel" is free money** — and the redemption path
   is exactly what M1 is for.

4. **The Red Team's "three of four rows never pay" is understated: for most reservations it is four
   of four.** The panel's «رزرو معمولی» row (`staff-system.js:299`) promises `base_pct` on an
   ordinary reservation. `reservations.ts:574` gates all cashback behind `if (input.preorder?.length)`.
   A reservation without a preorder — which is every reservation at a restaurant with no priced menu,
   per the schema's own comment at `schema.prisma:1043` — earns **zero**.

5. **The expiry decision has already been half-made, against the owner.**
   `apps/customer/js/features/loyalty.js:78` ships «امتیازهات هیچ‌وقت منقضی نمی‌شن» today. That is
   not a neutral default awaiting phase 5 — it is a promise accruing users, and every one of them
   makes choosing expiry a *withdrawal* rather than a rule. The founder's plan schedules this
   decision at phase 5; the copy has already voted at phase 0.

6. **`emit()`'s own doc comment is wrong about `emit()`.** `events.ts:16` says the function records
   the event in the DB; `:36-68` reads webhook subscriptions and enqueues deliveries, and writes
   nothing. A restaurant with no webhook loses the event silently. Anyone reading the comment while
   planning the event substrate would conclude that half the work is already done.
