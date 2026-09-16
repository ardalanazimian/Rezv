# PROPOSAL-F002: after a no-show, tell the guest what was recorded, and why

> 2026-09-17 · Feature Verification `rezv-1b [b233f3]` · target **CEO `rezv-87`** ·
> **needs from its reader:** approve / reject, and route one open question (§5) to the Founder.
> Base: `main` @ `cf60b9c`. Status: **APPROVED by CEO `rezv-87` (2026-09-17) → Implementation `rezv-85`, P2.**
> Not built by this session. Fixes go to the Implementation Team, not to `rezv-75`'s audit lane (so the overlap
> note below is settled). §5 is recorded as an open product question. If it's ever built, it must be a
> **compensating entry** under `FP-009`, never an edit.
> Overlap note: the label defect in §1 is a *front-end state* defect, which is `rezv-75`'s lane. I found it
> as the last link of F001's chain, so it's filed here with evidence. The CEO decides who fixes it.

---

## 0. The gap

After a no-show, the guest receives **two messages that contradict each other**:

| Channel | What it says | Source |
|---|---|---|
| SMS | «عدم حضور ثبت شد» | `api/src/lib/lifecycle.ts:69` (template `booking_noshow`); the probe in F001 §1.1 shows it enqueued |
| Trip card in the app | **«لغوشده»** | `apps/customer/js/reservation.js:29` maps `no_show → 'cancelled'`; `:159` renders `'cancelled'` as «لغوشده» |

The platform has recorded a violation, reversed the booking's cashback, and set a first-time user's
reliability to 0 (F001 §1.1, measured). The app tells her the booking was *cancelled*, as if nothing
happened to her. There's no «چرا؟», no statement of what changed, and no path to say «من آنجا بودم».

**Class: status collapse.** The trip model keeps 3 buckets (`up` / `done` / `cancelled`) and throws the
cause away (`reservation.js:24-31`). Siblings with the same collapse:
- `rejected` → «لغوشده», while the SMS says «متأسفانه رزرو شما تأیید نشد» (`lifecycle.ts:66`).
- `expired` → «لغوشده». Nobody cancelled anything: the hold ran out.
- `auto_cancelled` → «لغوشده».

The file has fixed this class before. `reservation.js:74-77` records that `pending` used to render as
«پیش‌رو» until `awaitingApproval` was added.

Of the siblings, **only `no_show` carries a penalty**. `rejected` and `expired` produce no strike
(`api/src/lib/economy.ts:83-86`, `:120-122`), but all three reverse cashback
(`api/src/lib/reservation-status.ts:120-128`).

## 1. Evidence

- Mapping and label: `apps/customer/js/reservation.js:24-31`, `:159`. The `'cancelled'` bucket also
  **removes every action** (`:165-167`), including «ثبت نظر» and any contact.
- The data the guest would need is **already on the server**. The reversal row's key is
  `cashback-reversal:<reservationId>` (`api/src/lib/loyalty.ts:516,527`). The strike and its 90-day decay
  are in `economy.ts:29,51-63`. The grace minutes are `restaurants.late_grace_minutes`
  (`api/prisma/schema.prisma:162`).
- `/me/reservations` already joins the restaurant and returns `freeCancelHours`
  (`api/src/app/api/v1/me/reservations/route.ts:17-21,40-43`). Adding grace minutes and the reversed amount
  is the same shape of change.
- A dispute channel exists but isn't reachable from the booking. `openChat(slug, reservationId)`
  (`apps/customer/js/features/chat.js:70-71`) sends `reservation_id`, but no trip card calls it.
- **Test coverage today: none.** `git grep "mapTripStatus|TRIP_STATUS_MAP"` over `api/tests`, `e2e`,
  `tools` and `apps/landing/test` returns no test of this mapping. The only binding guard,
  `tools/check-status-label-binding.mjs:53`, targets `apps/business/js/data.js`, not the customer app.

## 2. Mechanism

**Trip card label, per cause:**

| API status | Label | Tone |
|---|---|---|
| `no_show` | «عدم حضور ثبت شد» + link «چرا؟» | neutral, not red |
| `rejected` | «رستوران تأیید نکرد» | neutral |
| `expired` | «مهلتِ تأیید تمام شد» | neutral |
| `cancelled` / `auto_cancelled` / legacy | «لغوشده» (unchanged) | unchanged |

**«چرا؟» for `no_show`: a sheet in plain Persian, every number read from data, none hardcoded.**
> ساعتِ رزروت ۲۰:۰۰ بود و رستوران تا ۲۰:۱۵ صبر کرد. تا آن ساعت ورودت ثبت نشد، پس «عدم حضور» ثبت شد.
> **چه تغییری کرد:** کش‌بکِ این رزرو (۴۰ امتیاز) برگشت · یک مورد در سابقه‌ی حضورت ثبت شد که ۹۰ روز
> بعد، اگر موردِ تازه‌ای نباشد، خودبه‌خود پاک می‌شود.
> **چه تغییری نکرد:** هیچ مبلغی از تو کسر نشده.
> [پیام به رستوران]

- The cashback line appears **only** if the reversal row exists. The money line is bound to the payment
  flag the same way `depositLabel` already does "unknown → silence" (`apps/customer/js/data/booking.js:67`).
  If payment is ever live, the sentence must come from the charge record, never from a constant.
  `tools/check-diner-cost-disclosure.mjs` is the guard family this line belongs to.
- «پیام به رستوران» calls `openChat(slug, reservationId)` with the code in the thread. **It does not
  promise a reversal**, because no reversal path exists (§5). Promising one would build a new fake.

## 3. Change set and blast radius

| File | Change |
|---|---|
| `api/src/app/api/v1/me/reservations/route.ts` | add `lateGraceMinutes` to the restaurant select, and `cashback_reversed_points` per row (one `points_ledger` lookup by the known key, batched with `IN`) |
| `apps/customer/js/reservation.js` | keep the raw cause next to the bucket; per-cause label; «چرا؟» sheet; the message action on `no_show` rows |
| `apps/customer/sw.js` | `CACHE_VERSION` bump (required by `CLAUDE.md`) |

Blast radius: the bucket value itself stays the same, so the summary counts (`reservation.js:150`) and the
swipe logic (`:163-164`) don't change. `/me/reservations` has **three** consumers in the customer app
(`apps/customer/js/reservation.js`, `apps/customer/js/features/notifications.js`,
`apps/customer/js/features/food-dna.js`). The response change is additive only, so none of them reads a
renamed field. The panels don't call it.

## 4. Tests that must go RED without it

1. **e2e, customer project** (API mocked, so this is **UI only**, not contract): `/me/reservations`
   returns one `no_show` row → the card must **not** contain «لغوشده» and **must** contain «عدم حضور ثبت
   شد». Controls: a `cancelled` row still says «لغوشده», and an `expired` row says «مهلتِ تأیید تمام شد».
   **Mutation:** revert the label to the bucket → red.
2. **api integration:** a `no_show` reservation with a reversal row → `cashback_reversed_points = 40`.
   Subject-absent control: a reservation without cashback → `0`, not `null`-crash, not omitted.
3. «چرا؟» without a reversal row → the sheet has **no** cashback sentence (asserts silence, not a guessed
   number).

## 5. Open question: Founder, not CEO

**Can a restaurant correct a mistaken `no_show`?** Today it can't: `no_show: []` is terminal
(`lifecycle.ts:49`). A guest who *was* there but wasn't checked in has no remedy, and «پیام به رستوران»
can only apologise. A correction path would touch append-only ledgers (`FP-009` in `docs/DECISIONS.md`
forbids deleting or updating `points_ledger`, so it would take **compensating rows only**) and the
reliability EMA. That's a money/ledger decision, so it isn't proposed here. F002 is honest without it
because it promises nothing.

## 6. Size · reversibility · product bar

- **Size: T1** (days, one surface plus one API field; generic scale, see F001 §6).
- **Reversible:** yes. Labels only, plus one additive response field.
- Money honesty ✅ (amount and cause shown, silence when unknown) · no dark pattern ✅ · no new
  notification ✅ · honest labels ✅ (this *is* the honest-label fix) · explainability «چرا؟» ✅.
