# DESIGN M-21: subscription lifecycle (D-27), design before code

> 2026-09-17 · Feature Verification `rezv-1b` · target **CEO `rezv-87`** · **needs from its reader:** approve, or
> override the 5 marked choices (**Q1–Q5**), before any code. Measured statically on `main` @ `69654a0`. No runtime claims.

## 1. One rule, one function, one place per side

- **State:** the subscription belongs to the **tenant**, not the restaurant (`api/prisma/schema.prisma:13-15`), so every branch of a tenant
  locks and unlocks together. The source of truth is the existing `computeSubscriptionStatus` (`api/src/lib/subscription.ts:43`). The gate is
  **`status ∈ {expired, trial_expired}`**. No new status column, and **no migration**.
- **15 days:** `EXPIRING_SOON_DAYS` goes 14 → **15** (`api/src/lib/subscription.ts:12`). Side effect: the company panel's "expiring" list
  grows by one day. `daysLeft` stays the existing ceil (14.2 days reads as 15).
- **"No expiry" keeps meaning "no limit"** (`api/src/lib/subscription.ts:69-70`). Measured: 131 `tenant.create` calls in 102 test files and
  the seed (`api/prisma/seed.ts:15,19`) have no expiry. Treating null as expired would red most of the suite and every demo. The paid launch is instead enforced
  **where accounts are made**: `POST /v1/admin/restaurants` (`api/src/app/api/v1/admin/restaurants/route.ts:67,107`, today only an
  optional `trial_days`) must require an expiry (paid months, or complimentary-until). **Q1:** is an *unlimited* complimentary account
  allowed at all? Default: no, complimentary also carries an expiry, per D-27's "plan plus expiry".

## 2. Staff side (business panel)

- **Gate:** a new option on the single wrapper, `withRestaurantAuth({ subscription: 'active', … })` (`api/src/lib/with-restaurant-auth.ts:34-39,50`),
  checked after `resolveStaffRestaurant`. It costs one tenant read and applies only to opted-in routes. Response: **403 `SUBSCRIPTION_EXPIRED`** with
  `{expired_at, renew_url}`.
- **Locked when expired** (profile · menu · campaigns, per D-27): `restaurant/profile` PUT, `hours` PUT, `pricing` PUT, `photos` POST/DELETE,
  `branches` POST, `cancellation-policy` PUT; all 11 `restaurant/menu/**` mutating route files; `automations` POST, `coupons` POST, `cashback` PATCH,
  `events` POST/PATCH/DELETE, and **`sms` POST** (campaign sends, which also spend credit).
- **Stay open** (no diner stranded, and account safety): `reservations/[code]/status` PATCH (check-in, cancel, no-show), `tables/[id]/state`,
  `waitlist` POST/DELETE (staff queue management), `chats/[id]` POST, `notes`, `customers/[userId]` PATCH, `staff` POST/PATCH, `staff/password`,
  `heartbeat`, `assistant`. **Q2:** `walkin` POST and staff manual reservations (they share diner POST `reservations/route.ts:47`, `auth.kind === 'staff'`).
  They create NEW records, so leaving them open means an expired tenant runs its floor for free. Default: **locked**; only existing reservations stay
  manageable. **Q3:** `tables` POST/PATCH/DELETE, `reviews` PATCH (replies), `members` POST. Default: tables locked (setup), reviews and members open.
- **Guard:** a static test lists every mutating export under `api/src/app/api/v1/restaurant/**` (54 exports in 40 route files today) and fails on any route that is
  **not classified** locked or open. A new route can't silently skip the decision (same pattern as `no-show-writers-guard`).
- **What staff see:** `GET /restaurant/subscription` (new, `withRestaurantAuth` **without** a permission; the bell requires `canViewAnalytics`,
  `api/src/app/api/v1/restaurant/notifications/route.ts:12`, so plain staff would never see it there) returns `{status, days_left, expires_at, renew_url}`.
  Called from `enterPanel` (`apps/business/js/staff-system.js:624`), it renders a persistent banner under the topbar (`apps/business/index.html:115`):
  - **≤15 days:** «اشتراکِ شما N روزِ دیگر تمام می‌شود — تمدید»
  - **expired:** «اشتراک تمام شده — ویرایشِ پروفایل، منو و کمپین قفل است؛ رزروهای موجود را همچنان مدیریت کنید — تمدید»
  - locked forms show a lock notice and a disabled save. The server's 403 is the real gate.
  - **One-time notice at 15 days:** a bell item with the stable id `sub-expiring:<tenantId>:<expires_at>`, which reappears only if the expiry changes.
  - `renew_url` = the landing purchase flow (`apps/landing/app/pricing/page.tsx` → site order). Activation already extends from max(expiry, now)
    (`api/src/lib/site-orders.ts:573-580`), so renewing early never loses paid days.

## 3. Diner side

- **Gate:** diner-only, next to the existing feature-flag gate (`api/src/app/api/v1/reservations/route.ts:64-69`, `auth.kind === 'customer'`),
  and in `POST /v1/waitlist` before `joinWaitlist` (`api/src/app/api/v1/waitlist/route.ts:73`). Response: **409 `RESTAURANT_NOT_BOOKABLE`**, with no
  subscription wording, because a diner is not told a restaurant's billing state. **Q4:** waitlist-offer → reservation for an expired tenant
  (`api/src/lib/waitlist.ts:783`). Default: offers are not sent; existing entries are handled by staff.
- **What the diner sees:** availability already has an honest non-bookable state (`api/src/app/api/v1/restaurants/[slug]/availability/route.ts:51`,
  rendered at `apps/customer/js/data/booking.js:190`). Expired maps to `closed` with «این رستوران فعلاً رزروِ آنلاین نمی‌پذیرد». To avoid a
  **dead button**, the detail payload gains `booking_open` (next to `booking_policy`, `api/src/app/api/v1/restaurants/[slug]/route.ts:137`) and the
  bookbar (`apps/customer/js/data/detail.js:239`) renders that sentence instead of «رزرو میز». Existing reservations: unchanged (view, cancel, chat).
  **Q5:** the discovery list today *hides* closed/offline places (`api/src/app/api/v1/restaurants/route.ts:41`). D-27 says "shows the listing as not
  bookable". Default: keep them **listed** with a «رزروِ آنلاین غیرفعال» badge and no book CTA (literal D-27). The alternative is to hide them like closed ones.

## 4. Conflict to surface, not decide

The site's self-serve **30-day trial** (`api/src/lib/site-orders.ts:36,301-306`) creates a real tenant and panel login without a purchase. That
contradicts owner decision (2), "our team creates the account after purchase". Under this design trial tenants lock at day 30
(`trial_expired`). Whether the landing trial CTA stays is the owner's call, out of this scope.

## 5. Proof plan

For every locked route: red (expired tenant writes 200) → green 403, and a mutation that drops the option goes red. The guard rejects an unclassified route. Diner POST
and waitlist give 409 and a staff check-in still gives 200. Positive control: a tenant 1 ms before expiry still writes. Boundary tests at 15 and 16 days. e2e: banner states
and the no-dead-button detail page on three projects. Red Team: every locked route with an expired token, branch switching (`x-restaurant-id`),
staff token on the diner POST, clock-edge renewal.
