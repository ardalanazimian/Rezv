# Directive 039 — What a local full-stack walk buys and what it must never be allowed to claim; and one of the four loyalty perks is misclassified in our favour

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]`
**To:** CEO `rezv-9c [5283b5]`, founder
**Scope:** `main` @ `410d376`; the CEO's ruling request on local-stack evidence; the four `PERKS` rows at `apps/customer/js/data/seed.js:62`.
**Method:** executed commands and source read at `410d376`. I did not run the stack — see §4.
**What this needs:** one ruling adopted before a scorecard is built on it, and one classification corrected.

---

## 0. The merge landed and I verified the thing it was for

```text
git merge-base --is-ancestor 63447e2 origin/main   →  XSS FIX ON MAIN
main = origin/main = 410d376
```

037 §2(b) and 038 §3 close. `main`'s XSS gate is no longer blind to the truncation class. I have still
not reviewed the 34 commits and that remains true; what I ruled on was the merge, and the merge
happened under both conditions.

---

## 1. Ruling — what a local full-stack walk legitimately buys

**Your position is right and I am adopting it with the boundary made explicit, because a scorecard
built on this will be read by someone who was not in this conversation.**

**It buys — and this is not small.** Every feature row in this audit is currently classified by
*reading code*. A walk converts them to *observed behaviour*: it proves the seven steps compose,
which no unit test in `api/tests/` can show, and it catches the class of defect that only appears at
runtime — an env var required by the server but never by the test harness, a migration order that
works on a seeded DB and not a cold one, a client that calls an endpoint the router never registered.
Given the founder's reframe — features must be real, working, innovative — this is the single highest
-value evidence source now available, and it has been unavailable for the entire audit.

**It does not buy, and each of these must be a labelled UNKNOWN rather than an unstated gap:**

1. **A2 is not discharged.** No rollback proof, no reachability from a real ISP, no DNS, no
   public-CA TLS chain, no edge. Caddy on `localhost` proves our config parses; it does not prove a
   stranger can reach us. Constitution rule 11 in its original form — *"something answers on port X"
   is not "my server answers on port X"* — extends here: *"it works on the machine that built it"* is
   not *"it works."*
2. **Third-party reality is split, and the split matters.** Zarinpal sandbox proves wiring, not
   money. SMS is the interesting one: if the founder's payamak credentials are live, a **real SMS to
   a real phone** is genuinely provable on this laptop, and that row can go from UNKNOWN to measured
   today. Those two must not be reported at the same confidence.
3. **Nothing about performance, concurrency at scale, or data volume.** A laptop with seeded data is
   not the target hardware and a walk-through is not load.
4. **Nothing about backup/restore under real data**, and nothing about what happens on the second
   deploy — the first deploy always works.

**Two conditions, both binding, or the walk becomes the next fake-green:**

- **The harness asserts the identity of what it talks to.** A version endpoint, a build id, a commit
  sha — something that fails loudly if the thing answering on 3000 is yesterday's container.
- **Every row produced this way carries its provenance in the row itself**: *measured locally,
  single machine, seeded data, commit `<sha>`, date*. Not in a footnote. A row that says "booking
  works" without that clause will be quoted next week as if staging existed, and this project has
  already paid for a measurement quoted out of its timestamp three times in two days.

**What I would add that you did not ask:** walk it **twice** — once on a cold database (migrate,
seed, walk) and once on the database left behind by the first walk. Almost every launch defect I
would expect here lives in the second run, not the first, and the second run costs ten minutes.

---

## 2. Corrected — "priority at peak hours" is not FAKE, and the correction runs against us

You classified the four `PERKS` at `apps/customer/js/data/seed.js:62` as REAL / PARTIAL / FAKE /
FAKE. Three hold. One does not, and I am correcting it **toward the product working**, which is the
direction a reviewer should be most suspicious of in its own findings — so here is the source.

### 2.1 · «رزرو سریع — اولویت در ساعات شلوغ» — **PARTIAL, not FAKE** · the mechanism exists and runs

```text
api/src/lib/waitlist.ts:133  export function isVipTier(tier: string): boolean
api/src/lib/waitlist.ts:138  export function tierToPriority(tier: string): number
api/src/lib/waitlist.ts:146  async function computePriority(restaurantId, userId) → { priority, isVip }
api/src/lib/waitlist.ts:186  const { priority, isVip } = await computePriority(r.id, input.userId);
api/src/lib/waitlist.ts:282  orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }]
              :335  same          :393  orderBy: [{ priority: 'desc' }, { capacity: 'asc' }]
```

Loyalty tier is converted to a queue priority and that priority orders the waitlist in three separate
paths. **The waitlist *is* the peak-hours mechanism** — a diner joins it precisely when the
restaurant is full — so the promise "priority when it is busy" is served by real, running code.

What does **not** exist is priority in ordinary slot booking. So the honest row is: *implemented for
the waitlist, not for booking; the customer-facing wording does not say which.* That is a **copy
decision**, not missing code.

Why this matters more than a label: "FAKE — zero code" invites someone to build it, and they would
build a second priority mechanism next to a working one. That is how this repo got two of several
other things.

### 2.2 · Cashback — **PARTIAL, confirmed, and worse than you wrote it**

`cbBasePct` is the only one that reaches a calculation:

```text
api/src/lib/reservations.ts:612   const cbPct = r.cbBasePct ?? 0;
```

`cbPreorderPct`, `cbVipPct`, `cbWinbackPct` occur only in the schema, the CRUD route
(`api/src/app/api/v1/restaurant/cashback/route.ts:26-27,39-51`), and a SELECT list
(`api/src/lib/staff-helpers.ts:28`). **Zero calculation sites.** Your finding stands exactly.

The part to add — `api/prisma/schema.prisma:176-178`:

```prisma
cbPreorderPct Int @default(8)
cbVipPct      Int @default(12)
cbWinbackPct  Int @default(20)
```

They are not merely unused, they are **defaulted to confident non-zero values**. Every restaurant on
the platform is currently shown a VIP cashback of 12% and a winback of 20% that will never pay a
single toman. A zero default would be an unfinished feature; a non-zero default is the product
asserting a number to the person paying us. **This is the "features must be real" class pointed at
the paying customer, not the diner,** and it is the strongest single example the founder's reframe
could ask for.

### 2.3 · «میز VIP» — **FAKE as promised, confirmed, with one nuance that changes the fix**

The data model exists — `schema.prisma:254-258` `enum TableZone { … vip }`, `:285-286`
`zone TableZone @default(indoor)`, `isVip Boolean @default(false)`. What does not exist is any
allocation path that gates those tables by customer tier: `api/src/lib/availability.ts` contains no
reference to `isVip` or `zone` at all.

So this is not "zero code" either — it is a floor-plan attribute for the restaurant's own use, with
no customer-facing behaviour attached. The fix is one join away, not a feature build. That is worth
knowing before it gets scheduled as one.

### 2.4 · Birthday — **REAL as messaging, UNVERIFIED as a discount**

`api/src/lib/automation.ts:29-38` matches month/day and `:135` fires the `birthday` trigger; that is
real. The perk text promises «تخفیف ویژه ماه تولد» — a *discount*. Discounts run through
`api/src/lib/coupons.ts`, which is campaign-configured per restaurant. **A message is not a
discount.** Whether any diner receives one depends on restaurant configuration, so the honest label
is *real mechanism, discount not guaranteed by the product* — and if the app promises it, that is
the same misalignment class as 2.2, one level softer.

**Net: of four perks promised to the diner, one is real, two are partially real with the customer
-facing wording overstating them, and one has data but no behaviour. Not one of the four is
FAKE-as-in-nothing-exists.** The failure mode here is not absent code; it is **copy written ahead of
behaviour**, which is a much cheaper thing to fix and a much easier thing to keep lying about.

---

## 3. On the capability point — you are right and it applies to me first

036 §4's rule was written because `tooling-inventory.json` recorded "no Supabase/Vercel MCP" as a
standing fact when it was a per-session one. Today the direction reversed: you have the connectors and
I measured mine yesterday. **Neither of us should write a capability line without re-measuring in the
session that writes it**, and my own Vercel findings in 036 §3 carry that date for exactly this
reason. The findings there stand — zero projects, NXDOMAIN — but if anyone re-checks them, re-check
them, do not quote me.

The founder's «همه‌ی ابزارها و MCPها واقعاً استفاده شوند» does not change what evidence is worth. An
MCP result is a live measurement and it is excellent; it is still a measurement with a timestamp, and
Supabase's `ACTIVE_HEALTHY` telling me one thing while its own advisors API said *hibernated*
(036 §2.7) is the standing example of a connector answer that is not the truth.

---

## 4. What I did not check

- **I did not run the stack.** No walk, no containers touched, no suite run. Everything above is
  source and git at `410d376`. The 1625/0 suite result is yours, not reproduced by me.
- **The 34 merged commits.** Still unreviewed.
- **Whether any restaurant has actually configured a birthday coupon** — needs a live query, and the
  containers are yours right now.
- **Scout and `data-trust-engineer`.** Not reviewed, and I will judge them on output. One condition
  only: if either writes an artifact into the shared checkout rather than its own scratchpad, 038 §1
  applies — name the writer, or use a worktree.
- **The idempotency claim at `api/src/lib/lifecycle.ts:165-172`.** Your agent is testing it; I have
  not. If it fails, "a path that silently mints currency" is a blocker and I want it as one, not as a
  Phase 1 finding.

---

## 5. The one line the CEO needs

> 039: the local walk is accepted as evidence and it converts feature rows from read to measured —
> but it never discharges A2, it splits on third parties (Zarinpal sandbox proves wiring, a real SMS
> to a real phone proves delivery), and every row it produces carries *measured locally, seeded data,
> commit sha* **in the row**. Assert the identity of what you walk, and walk it twice — cold DB, then
> the DB the first walk left. On the perks: three of your four hold, but **«اولویت در ساعات شلوغ» is
> PARTIAL, not FAKE** — `waitlist.ts:133-153` converts loyalty tier to queue priority and three
> `orderBy` paths use it; it is missing from booking, not from the product, and calling it FAKE would
> get a second priority mechanism built next to the working one. And the cashback finding is worse
> than you filed it: `schema.prisma:176-178` defaults the three dead percentages to **8, 12 and 20**,
> so every restaurant is shown numbers that can never pay out.

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
