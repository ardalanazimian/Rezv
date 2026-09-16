# PROPOSAL-F001: "I'm running late", a guest signal that moves the no-show clock

> 2026-09-17 · Feature Verification `rezv-1b [b233f3]` · target **CEO `rezv-87`** ·
> **needs from its reader:** approve / reject / re-scope, plus two product numbers
> (default extension cap, and whether a restaurant may set it to 0).
> Base: `main` @ `cf60b9c` (pinned `refs/snap/fv0916/main`). Measured 2026-09-16 14:10–21:01Z on my own
> containers (pg `55901`, redis `16901`). Nothing of `rezv-75`'s harness was touched.
> Status: **PROPOSED, awaiting CEO approval. No product file changed.**

---

## 0. The gap, as a person lives it

Sara booked 20:00. Traffic, she's 17 minutes out. Here is everything Rezervno lets her do:

| What she wants | What the app offers | Measured result |
|---|---|---|
| Tell the restaurant she's coming | nothing: no button, no route, no restaurant phone | — |
| Keep the table | nothing | the cron marks her `running_late` → `no_show` **in one tick** |
| Avoid a penalty | «لغو» (cancel), which is a *late* cancel | strike + reliability drop, and the app warns her about that one |
| Know what happened | an SMS after the fact | «عدم حضور ثبت شد», then her trip card reads «لغوشده» (see F002) |

Every path open to her carries a penalty, and the one path with *no* warning (doing nothing and
arriving at 20:17) carries the **heaviest** one. The platform warns her before an action *she* takes,
and says nothing before an action *it* takes.

---

## 1. Evidence

### 1.1 Runtime: the production cron functions on a fresh DB

The probe drives `autoMarkRunningLate` and `autoMarkNoShow` from `api/src/lib/lifecycle.ts`, the same two
functions `api/src/app/api/v1/maintenance/lifecycle/route.ts:42-43` calls every 5 minutes
(`cron/crontab:21`, `*/5 * * * * /run.sh lifecycle`; the schedule is committed, and whether it runs anywhere is
UNKNOWN because no deployed environment exists, see `UNKNOWN.md` FU-4). Reservation A is 5 minutes past its slot, B is 17. A cashback row was written with
the same idempotency key the booking path uses. Raw output of **exactly the §7 source** (extracted from
this file, run 2026-09-16 21:04Z; JSON log lines removed, nothing else):

```
exit=0
restaurant.lateGraceMinutes (default) 15
tick1 autoMarkRunningLate count    2
SMS jobs created by running_late   0
tick1 autoMarkNoShow count         1
A (5 min late) status              running_late
A (5 min late) events              ["confirmed->running_late by cron"]
B (17 min late) status             no_show
B (17 min late) events             ["confirmed->running_late by cron","running_late->no_show by cron"]
SMS to this guest                  [{"template":"booking_noshow","tokens":["مهمان","FVBa974f1","عدم حضور ثبت شد"]}]
economy profile after              {"strikeCount":1,"reliabilityScore":0,"reputationTier":"bronze","lastViolationAt":"2026-09-16T21:04:13.415Z"}
points ledger                      [{"delta":40,"reason":"cashback","note":"کش‌بک رزرو FVAa974f1"},{"delta":40,"reason":"cashback","note":"کش‌بک رزرو FVBa974f1"},{"delta":-40,"reason":"cashback","note":"بازگردانیِ کش‌بکِ رزروِ لغو/عدم‌حضور"}]
points balance                     40
canTransition(no_show -> seated)   false
canTransition(no_show -> checked_in) false
```

Environment honesty: this was the **third** probe run on one probe DB. The DB was fresh before the first run
(CI's three schema commands, exit 0, 73 tables). Every read in the source filters on the tenant,
restaurant, user or phone created *in that run*, so earlier runs can't leak into the numbers. The earlier
full run (14:35Z) printed the same values.

What it proves:
1. **No warning exists.** `running_late` produced 0 SMS jobs. `NOTIFY` in `lifecycle.ts:61-71` has no
   `running_late` key. The only message is the after-the-fact `booking_noshow`.
2. **The "two-stage" design collapses to one stage** for anyone past the grace at the first tick: both
   transitions happen in the same cron run, both by `cron`.
3. **The consequence is immediate and permanent.** `no_show` is terminal (`lifecycle.ts:49`, and the probe
   shows `canTransition` false). A guest who walks in at 20:17 can't be seated under her own reservation.
   Cashback is reversed (−40). The strike count goes to 1. A first-time user's reliability score goes
   75 → **0**. That last one is by design (`api/src/lib/economy.ts:218-224`: the first event fully
   determines the score).

Reproduction: the probe source is in §7. Run it from `api/` with the CI test env pointed at a fresh DB.

### 1.2 Absence proofs, each with a positive control

Shell: Git Bash, `LC_ALL=C.UTF-8`, on the worktree at `cf60b9c`.

| Claim | Null result | Positive control (the pattern does hit) |
|---|---|---|
| No customer action to signal lateness | `api/src/app/api/v1/reservations/[code]/route.ts:61` exports GET only. `git grep -iE "reschedul\|modify\|running.?late\|دیر (می‌رسم\|میرسم)"` over `apps/customer/js` → 0 | cancel **is** wired: `apps/customer/js/features/trips.js:198,226` |
| The trip card has no contact action | upcoming-card actions are QR · تقویم · کیف پول · لغو (`apps/customer/js/reservation.js:165`) | same line renders all four |
| The guest can't call the restaurant | `model Restaurant` has **no** phone field. `tel:` in `apps/customer/js` → 0 | `slug` inside the same awk block → 1. `tel:` hits in `apps/business/js/crm.js:756` |
| Chat exists but not from the booking | `openChat(slug, reservationId)` supports a reservation (`apps/customer/js/features/chat.js:70`), but its only caller passes none (`apps/customer/js/data/detail.js:248`) | the chat routes are called: `chat.js:40,123,160` |
| The restaurant can't change the grace | `lateGraceMinutes` (`api/prisma/schema.prisma:162`, default 15) has **0 writers** in `api/src` and `apps`, only the reader at `lifecycle.ts:406` | `free_cancel_hours` **is** writable: `api/src/app/api/v1/restaurant/cancellation-policy/route.ts:15,43` |
| Staff can't honestly "hold" a late guest | `running_late → checked_in \| seated \| no_show \| cancelled` (`lifecycle.ts:44`, mirrored in `apps/business/js/data.js:70`) | — |

The only staff workaround is marking her `checked_in` before she arrives. That writes the arrival points
(`lifecycle.ts:189-208`) and a false event into the ledger the no-show model learns from. The workaround
corrupts data, so it isn't one.

### 1.3 Who sees the mark afterwards

- Restaurants: `strike_count` and the reliability score in the guest profile
  (`api/src/app/api/v1/restaurant/customers/[userId]/route.ts:29,57`).
- CRM: once no-show rate ≥ 40% over ≥ 3 visits, "call before their next booking"
  (`api/src/lib/crm-recommendations.ts:93-96`).
- Decay: one strike removed per 90 violation-free days (`economy.ts:29`, `:51-63`).

### 1.4 A latent escalation, not live today

`computeResolvedPolicy` turns `strikeCount >= 3` into deposit-required plus manual confirm
(`api/src/lib/cancellation-policy.ts:118-122`). Its async wrapper `resolvePolicy` has **0 production
callers** (`git grep "resolvePolicy("` over `api/src` → only its definition). The control:
`computeEventScore(` does have a production caller at `economy.ts:165`. So today the strike is reputational.
The day that engine is wired, or payments switch on, three 16-minute delays inside 90 days become a
money consequence. **For `rezv-75`'s map:** `resolvePolicy` is DEAD. The business panel is already honest
about it: the tab tells owners «درگاهِ پرداخت هنوز وصل نیست» and badges each setting (`apps/business/js/crm.js:941-947`, UI text at `:964`). Only the older comment above it, `crm.js:922-926`, still says
the layers "apply automatically".

### 1.5 A doc claim that isn't true

`docs/KNOWN_LIMITATIONS.md:1229-1230` describes the two-stage late design as the path that carries the
«شما دیر کرده‌اید» notice. No such notice is sent (1.1, point 1). The code is the truth, so this line is a
finding against the doc.

---

## 2. Why this wins, and what I cannot prove

- **Asymmetry in our own product.** Before a late cancel, the app shows a dialog: «یک تخلف در سابقه‌ات ثبت
  می‌شود و نشانِ اعتبارت پایین می‌آید» (`trips.js:178-186`). The automatic no-show scores **worse**
  (score 0 vs 35, `economy.ts:104-113`) and gets no warning at all.
- **This is the pattern users punish most.** `docs/audit/research/ANTI-PATTERNS.md` #1: 4 of 21 (19%)
  recent TheFork 1-star reviews are value taken with no reason given. A reversed cashback plus a
  «لغوشده» label is the same shape at small scale.
- **What I do NOT have:** Rezervno is pre-launch, so there's no user corpus. I have **not** measured how
  often Tehran diners are 15+ minutes late, and I'm not quoting a number. The evidence here is the
  mechanism, measured, not observed churn.

---

## 3. Mechanism

**Customer, one tap, once per reservation.**
- From 30 minutes before the slot until the no-show deadline, the upcoming trip card shows «دیرتر
  می‌رسم».
- Tapping it offers «۱۰ دقیقه» · «۲۰ دقیقه», capped by the restaurant's setting.
- After the tap, the card states the new truth in one line: «به رستوران گفتیم حدودِ ۲۰:۲۰ می‌رسی — میزت
  تا ۲۰:۳۵ نگه داشته می‌شود» (deadline = slot + grace + extension).
- If the restaurant's cap is 0, the button still sends the signal, but says so **before** the tap: «این
  رستوران بیش از ۱۵ دقیقه صبر نمی‌کند». No promise the restaurant hasn't made.
- After the deadline the button disappears. Nothing is retroactive.

**Restaurant.**
- The reservation row shows «مهمان: ۱۰ دقیقه دیرتر» with a time, and the same event appears in the
  existing notification bell (`/restaurant/notifications`, `apps/business/js/data.js:474`).
- Two fields go on the **existing** cancellation-policy tab, where free-cancel hours already live: «مهلتِ
  صبر برای مهمانِ دیرکرده» (writes `lateGraceMinutes`, 0–45) and «حداکثر تمدید با اعلامِ مهمان» (0–30).
  Both carry the «اعمال می‌شود» badge, because both have an effect today.

**Money honesty.** Both numbers appear on the booking confirm screen, next to the existing
`cancelPolicyLabel` (`apps/customer/js/data/booking.js:110`): «تا ۱۵ دقیقه صبر می‌کنیم؛ اگر دیرتر
می‌رسی، از کارتِ رزرو خبر بده».

**Notification restraint.** **Zero new SMS.** SMS is charged to the restaurant's balance (`lifecycle.ts:296`)
and the provider templates are fixed patterns. The surfaces are the card and the confirm screen. Optional,
behind the same flag: **one** push at slot + 5 minutes, only to users already subscribed via
`/me/push-subscribe`, at most once per reservation.

---

## 4. Change set: surfaces, files, blast radius

| Layer | Change | Files |
|---|---|---|
| Schema | `reservations.late_extension_minutes SMALLINT DEFAULT 0` and `restaurants.max_late_extension_minutes SMALLINT DEFAULT 15`, in **both** `schema.prisma` and a new idempotent SQL migration (proposed file, the next `NNN` in `api/prisma/sql`) | `api/prisma/schema.prisma` |
| Cron | `autoMarkNoShow` cutoff per row: `slotStart + grace + late_extension_minutes` | `api/src/lib/lifecycle.ts` |
| New route (proposed) | `POST /api/v1/reservations/[code]/eta` `{minutes: 10\|20}`. **User token only**: reject `kind === 'staff'` explicitly, then `resv.userId === auth.sub` (the cancel route's check at `cancel/route.ts:66`, plus the kind check that `rezv-75`'s `/me/*` principal-confusion work asks for). Allowed from `confirmed`/`auto_confirmed`/`preparing`/`running_late`, before the deadline, once. Writes the column, a `reservation_events` row (actor `customer:<id>`), and `audit(...)`. **No status change and no `slotEnd` change**, so no availability invalidation. The delay eats the guest's own slot | new route file (proposed) |
| Policy route | accept and return `late_grace_minutes` and `max_late_extension_minutes` | `api/src/app/api/v1/restaurant/cancellation-policy/route.ts` |
| Public payload | expose both numbers where `booking_policy.free_cancel_hours` already goes (`apps/customer/js/api.js:285`) | `api/src/app/api/v1/restaurants/[slug]/route.ts` |
| Customer UI | card button + sheet · confirm-screen line · `CACHE_VERSION` bump | `apps/customer/js/reservation.js`, `apps/customer/js/data/booking.js`, `apps/customer/sw.js` |
| Business UI | row badge · two policy fields · rebuild standalone | `apps/business/js/reservations.js`, `apps/business/js/crm.js`, `standalone/business.html` |

**Blast radius, checked:**
- `autoMarkNoShow` has exactly one caller (`maintenance/lifecycle/route.ts:43`).
- `api/src/lib/no-show-model.ts:468` assumes `no_show` lands near `slot_start + lateGraceMinutes`. An
  extension shifts label time for those rows only, so the model's feature window must read the per-row
  deadline. **Owner: Backend.**
- `api/src/lib/economy.ts`, availability and the table-release block are untouched (no status or `slotEnd`
  change).
- The `check-status-label-binding` guard doesn't apply: no new status is added.

---

## 5. Tests that must go RED without it

1. `lifecycle-cron.integration`: a reservation 25 minutes late with `late_extension_minutes = 20` stays
   `running_late` after `autoMarkNoShow`. Control: the same row with 0 becomes `no_show`. **Mutation:**
   drop the extension from the cutoff → red.
2. The route. Staff token → 403. Another user's token → 403. `minutes: 30` → `VALIDATION`. A second call →
   409. A call after the deadline → 409. Plus a subject-absent control: an unknown code → 404, not 200.
3. Policy route: `late_grace_minutes: 46` → `VALIDATION`. A round-trip GET returns what PUT stored.
4. e2e, which mocks the API, so this covers **UI only**: the button is visible inside the window and absent
   outside it.

---

## 6. Risk · size · reversibility · dependencies

- **Abuse:** a guest always taps +20. That's bounded by the restaurant's cap and by once-per-reservation,
  and a guest who never arrives is still marked `no_show` at the new deadline. Fast-turn restaurants set
  the cap to 0.
- **Size: T2.** No CEO T-scale exists in-repo. I'm using the generic scale Scout recorded in
  `docs/audit/research/proposals/001-single-clock-loyalty-guardrails.md`: T2 = 1–3 weeks, cross-file.
- **Reversible: yes.** Both columns default to values that reproduce today's behavior exactly (extension 0,
  grace 15). The UI ships behind a `DEFAULT_OFF` flag (`api/src/lib/feature-flags.ts`).
- **Depends on:** nothing blocking. Pairs with **F002** (what the guest is told afterwards) and Scout's
  `005-no-silent-taking-points-ledger` (where the −40 shows up).
- **Decisions for the CEO / Founder:** the default cap (I propose 15), and whether cap 0 is allowed (I
  propose yes, stated before the tap).

**Product bar:** money consequence on the confirm screen ✅ · no dark pattern (nothing hidden, cap stated
upfront) ✅ · restraint (0 new SMS, ≤ 1 opt-in push) ✅ · honest labels (no «هوشمند») ✅ · explainability:
the card states the new deadline in one line ✅.

---

## 7. Probe source (reproducible; never committed as a test)

Run it from `api/` with the CI env pointed at a **fresh** DB. It writes `[DEMO]` rows.

```ts
import { randomUUID } from 'node:crypto';
import { db } from './src/lib/db.ts';
import { redis } from './src/lib/redis.ts';
import { autoMarkRunningLate, autoMarkNoShow, canTransition } from './src/lib/lifecycle.ts';
const TAG = `fv-${randomUUID().slice(0, 6)}`;
const out = (k: string, v: unknown) => console.log(k.padEnd(34), typeof v === 'string' ? v : JSON.stringify(v));
const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` } });
const r = await db.restaurant.create({ data: { tenantId: t.id, slug: TAG, name: '[DEMO] probe', clubPrefix: 'FV', timezone: 'Asia/Tehran', isOpen: true }, select: { id: true, lateGraceMinutes: true } });
const tb1 = await db.table.create({ data: { restaurantId: r.id, number: 1, capacity: 4, isActive: true } });
const tb2 = await db.table.create({ data: { restaurantId: r.id, number: 2, capacity: 4, isActive: true } });
const phone = `0936${String(Date.now()).slice(-7)}`;
const u = await db.user.create({ data: { phone, firstName: '[DEMO]', lastName: 'late' } });
out('restaurant.lateGraceMinutes (default)', r.lateGraceMinutes);
async function mk(minutesAgo: number, code: string, tableId: string) {
  const id = randomUUID(); const s = new Date(Date.now() - minutesAgo * 60_000); const e = new Date(s.getTime() + 90 * 60_000);
  await db.$executeRaw`INSERT INTO reservations (id, code, restaurant_id, table_id, user_id, guest_phone, guest_name, party_size, slot_start, slot_end, duration_minutes, block_buffer_minutes, status, source, created_at)
    VALUES (${id}::uuid, ${code}, ${r.id}::uuid, ${tableId}::uuid, ${u.id}::uuid, ${phone}, 'مهمان', 2, ${s}, ${e}, 90, 15, 'confirmed', 'app', ${new Date(s.getTime() - 86_400_000)})`;
  await db.pointsLedger.create({ data: { userId: u.id, restaurantId: r.id, delta: 40, reason: 'cashback', note: `کش‌بک رزرو ${code}`, idempotencyKey: `cashback:${id}` } });
  return id;
}
const A = await mk(5, `FVA${TAG.slice(3)}`, tb1.id);
const B = await mk(17, `FVB${TAG.slice(3)}`, tb2.id);
out('tick1 autoMarkRunningLate count', await autoMarkRunningLate(r.id));
out('SMS jobs created by running_late', (await db.job.findMany({ where: { kind: 'sms' }, select: { payload: true } })).filter((j: any) => j.payload?.to === phone).length);
out('tick1 autoMarkNoShow count', await autoMarkNoShow(r.id));
for (const [label, id] of [['A (5 min late)', A], ['B (17 min late)', B]] as const) {
  out(`${label} status`, (await db.reservation.findUniqueOrThrow({ where: { id }, select: { status: true } })).status);
  out(`${label} events`, (await db.reservationEvent.findMany({ where: { reservationId: id }, orderBy: { createdAt: 'asc' } })).map((e: any) => `${e.fromStatus}->${e.toStatus} by ${e.actor}`));
}
out('SMS to this guest', (await db.job.findMany({ where: { kind: 'sms' }, select: { payload: true } })).filter((j: any) => j.payload?.to === phone).map((j: any) => ({ template: j.payload.template, tokens: j.payload.tokens })));
out('economy profile after', await db.customerEconomyProfile.findUnique({ where: { userId: u.id }, select: { strikeCount: true, reliabilityScore: true, reputationTier: true, lastViolationAt: true } }));
const ledger = await db.pointsLedger.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' }, select: { delta: true, reason: true, note: true } });
out('points ledger', ledger); out('points balance', ledger.reduce((s: number, x: any) => s + x.delta, 0));
out('canTransition(no_show -> seated)', canTransition('no_show' as any, 'seated' as any));
out('canTransition(no_show -> checked_in)', canTransition('no_show' as any, 'checked_in' as any));
await redis.quit().catch(() => {}); await db.$disconnect();
```

The first run of an earlier draft failed on `no_table_overlap` (exit 1), because two overlapping
reservations were put on one table. That was the DB's exclusion constraint doing its job, not a finding.
This source uses two tables.
