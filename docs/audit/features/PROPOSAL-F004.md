# PROPOSAL-F004: change a booking's party size or time without cancelling it

> 2026-09-17 · Feature Verification `rezv-1b [b233f3]` · target **CEO `rezv-87`** ·
> **needs from its reader:** approve / reject, and three rule numbers (§3). **Low priority by CEO order
> (2026-09-17): a real gap, but after the blockers.**
> Base: `main` @ `cf60b9c`. Status: **APPROVED by CEO `rezv-87` (2026-09-17), low priority. Queued after the
> blockers; nobody builds it yet.** Numbers approved as proposed in §3: cut-off slot − 2 h · max 2 changes · no
> self-service when `auto_confirm` is off (chat with the reservation attached) · deposit-bearing reservations
> refused, not recalculated. No product file changed.
> Evidence level: source-traced with positive controls. Nothing in this file was run.

---

## 0. The gap

Four friends booked as two. Or the table is at 20:00 and they'd rather come at 20:30. Rezervno has **no way
to change a reservation**: not for the guest, not for the restaurant. The only route open is cancel and
book again. Measured from the code, that costs:

| Step | What happens | Source |
|---|---|---|
| Cancel inside the free window (default **24 h**) | the late-cancel dialog warns, then a **strike** is recorded (score 35) and the booking's **cashback is reversed** | `api/src/lib/cancellation-policy.ts:36`; `api/src/lib/economy.ts:108-113`; `api/src/lib/reservation-status.ts:120-128` |
| The cancel commits 5 s later (undo snack) | the slot goes back into availability, and anyone can take it | `apps/customer/js/features/trips.js:215-226` |
| Book again | a new code and a new confirmation. The restaurant sees one cancellation and one unrelated new booking | `api/src/lib/reservations.ts:94` |

So on the day of the meal, the honest action ("we're four now") is **penalised as if the guest had broken
the booking**. And the guest can't ask the restaurant to do it, because the restaurant has no edit
function either (below).

## 1. Absence, each with a positive control

Shell: Git Bash, `LC_ALL=C.UTF-8`, worktree at `cf60b9c`.

| Claim | Null | Positive control |
|---|---|---|
| No customer route changes a reservation | `api/src/app/api/v1/reservations/[code]/route.ts:61` exports **GET only**. Siblings are `cancel`, `pay`, `qr`, `arrive` | the same enumeration finds `POST` on `cancel` |
| No server code writes `partySize` / `slotStart` / `slotEnd` / `tableId` on an **existing** reservation | every `reservation.update(` / `updateMany(` in `api/src` writes `depositStatus`, `cancelReason`, `status` or `reminderSentAt` only (`payments/callback/route.ts:73,138,172`, `cancel/route.ts:72`, `pay/route.ts:65`, `api/src/lib/lifecycle.ts:119`, `api/src/lib/reminders.ts:115,142`) | `partySize: b.party_size` **is** written on creation in `api/src/app/api/v1/restaurant/walkin/route.ts:43` |
| No customer UI to change | `git grep -iE "reschedul\|modify\|تغییر.{0,6}(زمان\|ساعت\|تعداد)\|ویرایش.{0,6}رزرو"` over `apps/customer/js` → 0. The upcoming card offers QR · تقویم · کیف پول · لغو (`apps/customer/js/reservation.js:165-166`) | `cancelTrip` hits on the same line |
| No restaurant UI to change | the same pattern over `apps/business/js` → 1 hit, and it's about **opening hours** (`apps/business/js/crm.js:819`), not a booking | `walkin` is wired at `apps/business/js/data.js:361` |

## 2. Why it's worth building (and what I can't prove)

- The penalty in §0 hits guests for **telling the truth early**. That's the opposite of what the reliability
  score is meant to reward (`economy.ts:83-86`: only customer-controlled behaviour should move it).
- The restaurant loses information too: a cancel plus a new booking erases "same party, now four". CRM,
  the no-show model and the guest profile all learn a cancellation that didn't happen.
- **UNKNOWN:** how often guests want to change. Pre-launch, there's no data, and I quote no competitor
  figure. This is priced as a quality gap, not a proven churn driver. The CEO has ranked it post-blocker
  accordingly.

## 3. Mechanism

**Guest.**
- The upcoming card gets «تغییر» beside «لغو».
- It opens the same date / party / time picker, **prefilled**. Availability is computed **as if this
  reservation didn't exist**, so "same time, two more people" works when the table still fits.
- The result line states what changed and what didn't: «۲ ← ۴ نفر · ساعت بدونِ تغییر · کدِ رزرو همان
  است». The QR, calendar and wallet entries keep the same code.
- Cut-off and count are shown **before** the tap («تا ۲ ساعت قبل از رزرو، حداکثر ۲ بار»). No hidden rule.

**Rules. Three numbers for the CEO:**

| Rule | My proposal | Why |
|---|---|---|
| Latest change | slot − 2 h | the kitchen and the floor plan need notice. Closer than that, the late-cancel path still exists |
| Changes per reservation | 2 | stops slot-hopping without punishing a real correction |
| Restaurants with `auto_confirm` off | no self-service change. The card says «این رستوران تغییر را دستی تأیید می‌کند» and opens chat **with the reservation attached** (`openChat(slug, reservationId)`, `apps/customer/js/features/chat.js:70`) | a change there is a request, and building a request queue is out of scope for v1 |

**Economy.** A change is **not** a cancel: no strike, no reliability event, no cashback reversal. Cashback
comes from the preorder `final` (`api/src/lib/reservations.ts:635-657`), which a party/time change doesn't
touch. **If payments are ever switched on**, a party-size change touches a per-person deposit, and that
path needs its own decision. It's excluded here, and the route must refuse a change on a reservation whose
`depositStatus` isn't `none` (the enum default, `api/prisma/schema.prisma:536`).

**Restaurant.**
- The change shows up in the reservation's history view (which today reads status transitions only, see §4)
  and in the notification bell: «تغییر توسطِ مهمان: ۲ ← ۴ نفر، ۲۰:۰۰ ← ۲۰:۳۰». The bell's source
  (`getRecentActivity`, `api/src/lib/notifications.ts`) reads reservations, reviews and insights today and
  must be extended.
- **Part B, same library function:** staff can make the change for a guest who calls or chats, with actor
  `staff:<id>` and permission `canManageReservations`. It's the same RBAC check the cancel route already
  applies at `cancel/route.ts:60`.

**Notification restraint.** **No SMS** for a change the guest made themselves: the screen confirms it, and
SMS is charged to the restaurant. For a **staff-made** change, one SMS through the existing
`booking_confirm` pattern, whose third token is already a free label («رزرو شما تغییر کرد»,
`api/src/lib/lifecycle.ts:292-296`). 0 new templates.

## 4. Change set and blast radius

| Layer | Change |
|---|---|
| Library | extract the slot and table selection out of `createReservation` (`api/src/lib/reservations.ts:94-336`) into a function both paths call. **Don't copy it**: a second copy of availability logic is the class of defect this repo has paid for repeatedly |
| New route (proposed) | `POST /api/v1/reservations/[code]/change` with `{party_size?, date?, time?}`. **User token only** (reject `kind === 'staff'` explicitly, then owner check). Allowed from `confirmed`/`auto_confirmed` only. One transaction: re-select a table, update `slotStart`/`slotEnd`/`partySize`/`tableId`. The `no_table_overlap` exclusion constraint is the final guard. Record before→after with `audit(...)`. **Not** a `reservation_events` row: that table is a status-transition ledger (`fromStatus`/`toStatus`) and the ML substrate since migration 082, so a same-status row would pollute it. Whether the restaurant's event-history view should also read audit is Backend's call |
| Staff route (proposed, Part B) | the same function under `withRestaurantAuth({ permission: 'canManageReservations' })` |
| Side effects | `invalidateAvailability` for **both** the old and new date keys. Reset `reminderSentAt` when the time moves, so the 3-hour reminder (`reminders.ts:115`) follows the new time. `tryPromoteNext` (`api/src/lib/waitlist.ts:611`) when a table was freed. F001's `late_extension_minutes` is reset on a time change |
| Customer UI | «تغییر» button + prefilled picker (`apps/customer/js/reservation.js`, `apps/customer/js/data/booking.js`), `CACHE_VERSION` bump |
| Business UI (Part B) | «تغییر» in the reservation detail, then rebuild standalone |

**Blast radius:**
- Availability cache (two keys, not one)
- `no_table_overlap`
- Waitlist promotion
- Reminders
- Table state: the old table may be `reserved` (`api/src/lib/lifecycle.ts:350-353` frees only on terminal statuses, so the change must free it itself)
- `demand-forecast` and the no-show model read `slotStart` and `partySize` at decision time, so a snapshot taken before a change is stale by design. The audit row is where a model could learn about a change; `reservation_events` stays status-only
- Check-in QR (the code is unchanged, so it stays valid)

## 5. Tests that must go RED without it

1. **Atomicity:** the only fitting table at the new time is taken → `slotFull`/`tableConflict`, and the
   original row is **byte-identical** afterwards (slot, party, table, status).
2. **Invalidation:** a time change across dates → **both** cache keys are absent. **Mutation:** drop the
   old-date invalidation → red. (The lifecycle suite found exactly this single-site gap before; see
   `docs/KNOWN_LIMITATIONS.md` §2j.)
3. **Economy:** after a change, `economy_ledger_entries` has no new row for the reservation and
   `points_ledger` is unchanged. **Mutation:** route the change through `transitionReservation(…'cancelled')`
   → red.
4. **Auth:** staff token on the customer route → 403 · another user → 403 · after the cut-off → 409 ·
   third change → 409 · `depositStatus` other than `none` → 409 · unknown code → 404 (subject-absent control).
5. **Reminder:** `reminderSentAt` is null after a time change, and a same-time party change leaves it
   untouched.
6. **e2e, customer** (API mocked, **UI only**): the button shows the rule text before the tap, and it is
   absent for an `auto_confirm = false` restaurant.

## 6. Size · reversibility · dependencies · product bar

- **Size: T2.** Most of it is the extraction from `createReservation`, which must happen without changing
  booking behaviour; the full api suite is the guard. Part B adds days, not weeks. Generic scale as in F001
  §6.
- **Reversible:** yes. The UI sits behind a `DEFAULT_OFF` flag; the route is additive and has no schema
  change.
- **Depends on:** nothing blocking. It must land **after** F001 if both touch `late_extension_minutes`.
- Money honesty ✅ (money-bearing reservations are refused, not silently recalculated) · no dark pattern ✅
  (rules shown before the tap) · restraint ✅ (0 SMS for self-service, 1 existing template for staff
  changes) · honest labels ✅ · explainability ✅ (the result line says what changed and what didn't).
