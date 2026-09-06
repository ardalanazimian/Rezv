# Directive 023 — Semantic sweep of the tracked tree: 12 defects verified at source, 2 partitions unswept, and the cost

**Date:** 2026-09-06 · **From:** founder-side reviewer · **Ref audited:** `main @ 96322a0`
**Origin:** founder instruction — check every tracked file for anything wrong; spawn agents as needed; mind usage.

---

## 0. Cost, stated first because the founder asked me to mind it and I did not mind it enough

66 agents · 45 completed · **21 killed by the session limit** · 3.82M subagent tokens · 18 min.
Two of eight finders never ran (`docs-drift`, `panels-claims`) — those partitions have **zero coverage** from this run.
12 of 29 raised findings received no refuter vote. **I verified the ones that matter by reading the source myself,
which is free and is my job; the confirmed list below rests on my reads, not on the agents.**

What I would do differently: four finders not eight, cap three not five, and skip the refuter layer entirely — every
defect below was settled by me reading the cited lines, which cost nothing. The refuters returned 0 refutations in 39
votes; that turned out to reflect finder precision, but I could not have known that without reading anyway.

## 1. Mechanical checks — all clean, no agent needed

Six repo gates `exit=0` · 0 tracked secrets/.env/.log · 0 secret-shaped strings in source · 0 `TODO`/`FIXME`/`console.log`
in delivered code. **Nothing obviously wrong exists.** What follows is the class grep cannot see.

## 2. Verified by me at source — ranked by consequence

| # | Where | What | Sev |
|---|---|---|---|
| 1 | `api/src/lib/queue.ts:86-92` | `locked_at` is written on claim and nulled on complete/fail but **never read**: `claimJobs` selects only `status='pending'`. My grep over `api/src` finds no other reader (`:104`, `:130`, both writes); the finder also found none in `prisma/sql`, `cron`, `tools`. A worker that dies mid-handler strands the job in `processing` forever — never retried, never dead-lettered, and **invisible**: metrics count pending/dead only, system-health inspects the oldest *pending*. Header `:17-19` promises retry + DLQ. **CORRECTION (2026-09-06, after the CEO challenged it and I verified):** I wrote "OTP and booking-confirm SMS ride this queue". The OTP half is **false** — `sms.ts:187` is `if (job.template === 'otp') { await sendSmsNow(job); return; }`, so OTP short-circuits *before* `enqueue` and never enters the `jobs` table. Booking-confirm stands: `lifecycle.ts`, `loyalty.ts` (×3), `automation.ts`, `provisioning.ts` and `restaurant/sms/route.ts` all enqueue. So a stranded job silently drops a guest's **confirmation**, not their **login code** — materially lower severity than I stated, and it also means the lease is not constrained by anyone waiting on a screen. | **major → launch-relevant** |
| 2 | `api/src/lib/admin-totp.ts:127` | `PERIOD=30`, `WINDOW_STEPS=1`, replay TTL `= 30·(1+1) = 60s`. A code with drift `+1` is accepted while the current step ∈ {S, S+1, S+2} — up to **90s** — but its replay key expires at 60s. **~30s replay window on admin login.** The comment says TTL "= until the end of the acceptance window". | **major, security** |
| 3 | `api/tests/tenant-isolation.integration.test.mts:80-84` | The test runs `findMany({ where: { restaurantId: A } })` **directly on Prisma** and asserts 0 rows of B. The WHERE clause guarantees that; **it cannot fail unless Prisma is broken** and proves nothing about application-layer isolation — which per `CLAUDE.md` is the **sole** tenant boundary (RLS inert). A route that forgot to scope would still pass. | **major** |
| 4 | `restaurant/customers/[userId]/route.ts:78-92` → `lib/fraud.ts:321-327` | The comment names the bug — "restaurant A could clear a flag restaurant B's scan set" — and claims it fixed. The guard at `:85-89` only proves A has *a* `customerInsight` row for the user. `clearAbuseFlag` runs `updateMany({ where: { userId } })` — **no restaurant scope**. The named bug is unchanged. **CORRECTION (2026-09-06, after the CEO challenged it and I verified):** I also wrote that the audit row is lost because the call is `.catch(() => {})`. That half was wrong. `audit()` at `ebb58ca:audit.ts:89` returns `Promise<void>` and catches its own DB failure at `:126`, downgrading to `log.warn` at `:128` — **it never throws, so those catches caught nothing.** Removing them would have fixed nothing. The real hole was the return type: no caller could learn the trail was lost. So `ok:true` still did not imply an audit row, but for a different reason than I gave. | **major, cross-tenant write** |
| 5a | `restaurant/hours/route.ts:99-103` + `:168-177` + `crm.js:798,913` | The closures read is `.catch(() => [])`. The panel loads `closures: d.closures\|\|[]`, save **always** sends it, and the PUT does `DELETE … ; INSERT` on any present array (`[]` is truthy). **One transient DB error on GET followed by a normal save deletes every future closure**, including emergency ones customer availability depends on. Returns `ok:true`. | **major, data loss** |
| 5b | `api/src/lib/reservations.ts:147-151` | **The same swallowed closures query, on the booking path.** Failure → empty `closureSet` → `isTimeWithinHours` sees no closure → **an online booking is accepted on a day the restaurant declared closed.** Two instances, one class: "we don't know" rendered as "none", once destroying data and once ignoring it. | **major** |
| 6 | `auth/staff/verify/route.ts:43-44` | `'این شماره دسترسی پنل رستوران ندارد'` vs `'این حساب غیرفعال شده است'`, both **before** `verifyOtp`. Distinguishes no-such-staff / exists-inactive / exists-active. **Enumeration oracle** for staff phones and status. | **major** |
| 7 | `api/src/lib/waitlist.ts:706` | **An implementation gap in my own directive 020.** For a logged-in entry `guest: undefined`, so `createReservation` gets **no `tableNumber` pin** and auto-assigns from a different candidate set and ordering than `promoteNextTx` used. When placement diverges, the offered table keeps `state='reserved'` with **no reservation row**; the only freer is `lifecycle.ts:299-302`, keyed on the *actual* table. That table is then suppressed by `holdsFromTables` on every recompute and excluded from every promotion — **the permanent unsold capacity the horizon design exists to prevent.** The test at `availability-held-table-horizon:350` asserts against `e.offeredTableNumber` (echoed at `:729`) rather than the real assignment (`:699` keeps only `code`) — a tautology. | **major — mine** |
| 8 | `restaurant/automations/route.ts:18,68` → `lib/automation.ts:208` | `coupon_id` is validated as a UUID only and stored; **no ownership check against `ctx.restaurant.id`**. `automation.ts:208` loads `isActive:true` automations across **all tenants** and has 3 `couponId` refs — so the cross-tenant reference is **dereferenced when automations fire**. Read: `runAutomation` at `automation.ts:153-154` does `db.coupon.findUnique({ where: { id: automation.couponId }, select: { code: true } })` — **no `restaurantId` in the where** — and that `code` goes into the message template sent to A's guests. **Confirmed active leak: restaurant A can deliver restaurant B's coupon code to A's customers through A's own marketing automation.** Reachable today by any staff with `canManageCampaigns` who knows (or guesses) a coupon UUID. | **major, confirmed cross-tenant leak** |
| 9 | `api/tests/lifecycle-exclusivity.test.mts:45,84` | `FILES = walk(SRC)`, **no non-emptiness assertion**, final `deepEqual(offenders, [])`. If the walk returns nothing, the loop runs zero times and the state-machine-exclusivity guard passes green. Constitution rule 5 exactly. | **major** |
| 10 | `admin/site/orders/[id]/route.ts:29` → `lib/site-orders.ts:542` | Comment: `tenant_id` is "only for activate when not yet linked". Code: `opts.tenantId ?? order.tenantId` — **the admin's value wins even when already linked**; a linked order can be re-pointed to another tenant. Admin-only, so a footgun and a lying comment, not an attacker path. | minor–major |
| 11 | `docs/BACKEND.md:51` (also `:15`, `ARCHITECTURE.md:118`) | Lists `adminAuthFromRequest(req)` as the live platform-admin guard. `CLAUDE.md` itself declares that name dead; the export is `requireAdmin`, 52 call sites. | minor |

## 3. Confirmed by two refuters, not independently read by me

`admin/abuse-flags/[userId]:32` (unknown→absent) · `admin/staff-credentials:69` (unaudited privilege re-grant) ·
`lib/reminders.ts:141` (unreachable compensation + overcount) · `lib/events.ts:49` (idempotency asserted, not implemented) ·
`lib/no-show-model.ts:684` (cache invalidation swallowed) · `restaurant/coupons:41` (fake-success) ·
`maintenance/customer-insights:120` (failure→zero) · `maintenance/retention:98` (ok:true while sub-steps failed).
Plausible, same classes as §2, cited with path:line by the finders. **Not certified by me.**

## 4. Raised, unverified, not read by me — listed so they are not lost

`lib/lifecycle.ts:19` · `restaurant/pricing:39` · `tests/ml-platform-model:151` · `tests/waitlist-accept-clock:58` ·
`tests/economy-ledger:218` · `lib/waitlist.ts:697` · `lib/availability.ts:313`. Seven items. No claim made.

## 5. Not swept at all

`docs/*.md`, `CLAUDE.md`, `SESSION-HANDOFF.md` (the `docs-drift` finder died) and all three panels + `shared/js`
(the `panels-claims` finder died). §2 #11 surfaced incidentally via the admin finder. **These partitions have no
coverage from this run and I am not implying otherwise.**

## 6. Two class observations that outlive the list

- **The closures read is one defect with two consequences** (#5a destroys, #5b ignores). Fix the query's failure
  mode once — surface the error instead of returning `[]` — and both close. Fixing each site separately is the
  instance-not-class error this round has documented four times.
- **Three of the twelve are guards that cannot fail** (#3, #9, and the tautological half of #7). The repo's own rule 2
  says a gate is meaningless until proven red. None of these three has ever been proven red.

## 7. Routing

The CEO session is closed. This is a founder-facing list; nothing here is committed or changed by me. Items #1–#4 are
the ones I would want a builder on before any launch claim. #7 is mine to own and I am naming it as such.
