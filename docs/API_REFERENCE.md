# API_REFERENCE.md — RezervoNo

> Base path: `/api/v1` (health/metrics are at `/api`). All responses are JSON.
> Auth is **`Authorization: Bearer <access_token>`** unless noted. Mutating
> requests should also send an allowed `Origin` (CSRF check) and may send
> `Idempotency-Key`. Every response carries an `x-trace-id`.

## Conventions

- **Auth types**:
  - `public` — no token.
  - `customer` — customer JWT (`kind='customer'`).
  - `restaurant(RBAC)` — staff JWT via `withRestaurantAuth`, tenant-scoped, may
    require a `StaffPermission` key.
  - `staff` — staff JWT via `withStaffAuth` (tenant-level).
  - `platform-admin` — staff `owner` of `PLATFORM_ADMIN_TENANT_ID`.
  - `cron` — `guardMaintenance`: header `x-maintenance-key: <MAINTENANCE_KEY>`
    **or** `Authorization: Bearer <CRON_SECRET>`.
- **Error envelope**: `{ "error": { "code": string, "message": string, "details": object } }`.
- **Success envelope**: varies per route (no forced wrapper); examples below.

### Standard error codes (`lib/errors.ts`)

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION` | 422 | Body/query/param failed validation. |
| `UNAUTHORIZED` | 401 | Missing/invalid token. |
| `OTP_INVALID` | 401 | Wrong/expired OTP. |
| `FORBIDDEN_TENANT` | 403 | Cross-tenant / missing permission. |
| `BLOCKED` | 403/429 | IP ban / bad origin / global rate-limit (middleware). |
| `NOT_FOUND` | 404 | Resource missing. |
| `TABLE_CONFLICT` / `SLOT_FULL` | 409 | Slot/table already taken. |
| `CONCURRENCY_RETRY` | 409 | Serialization retry exhausted; retry request. |
| `RESERVATION_EXPIRED` | 410 | Hold expired. |
| `SLOT_LOCK_TIMEOUT` | 423 | Slot genuinely contended — another request holds the lock and the slot is **not** provably full, so retrying can still succeed. Since 2026-08-19 the engine re-checks real occupancy before returning this: if every candidate table has meanwhile been taken it returns `SLOT_FULL`/`TABLE_CONFLICT` (409) instead, so a 423 is never a dead-end "try again". |
| `RESTAURANT_CLOSED` / `RESTAURANT_OFFLINE` / `OUTSIDE_HOURS` / `PAST_TIME` / `TOO_FAR_AHEAD` / `PARTY_TOO_LARGE` / `NO_TABLE_FOR_PARTY` / `TABLE_TOO_SMALL` / `INVALID_STATUS_TRANSITION` | 422/404/409 | Reservation-engine domain errors. |
| `RATE_LIMITED` | 429 | Per-route rate limit; `details.retryAfterSec`. |
| `INTERNAL` | 500 | Unexpected error (details never leaked). |

---

## Auth

### `POST /v1/auth/otp/request` — `public`
Request customer OTP. Body: `{ phone }`. Rate-limited per phone (3/10m) and per
IP (15/10m). Response `{ ok: true }` (or `{ ok, dev_code }` when
`OTP_DEV_MODE=true`). SMS enqueued via Kavenegar in production.

### `POST /v1/auth/otp/verify` — `public`
Body: `{ phone, code }` (validated: `phone` 8–20 chars, `code` `^\d{4,6}$`).
Rate-limited per IP (`otpVerify`: 8/10m). On success creates/loads the user and
returns tokens:
```json
{
  "access": "<jwt 15m>",
  "refresh": "<jwt 30d>",
  "user": { "id","phone","firstName","lastName","avatarUrl" },
  "is_new": true
}
```
Errors: `OTP_INVALID` (401), `VALIDATION` (422), `RATE_LIMITED` (429).
Example:
```bash
curl -X POST $API/api/v1/auth/otp/verify -H 'Content-Type: application/json' \
  -d '{"phone":"09123456789","code":"123456"}'
```

### `POST /v1/auth/refresh` — `public`
Body: `{ refresh }`.
Verifies the refresh token and issues a new access token **of the same
principal** (kind/tenant/role preserved). Returns a new access (+ rotated
refresh).

### `POST /v1/auth/staff/request` · `POST /v1/auth/staff/verify` — `public`
Staff OTP login (same shape as customer OTP). `verify` returns tokens with
`kind='staff'`, `tenantId`, `role`.

### `POST /v1/auth/admin/request` · `POST /v1/auth/admin/verify` — `public`
Platform-admin OTP login for the company panel. Both routes require an active
`owner` staff account belonging to `PLATFORM_ADMIN_TENANT_ID`; a normal
restaurant staff account cannot use these routes. `verify` returns the same
staff JWT shape with the platform tenant and `role='owner'`.

### `POST /v1/auth/logout` — `public`
Body: `{ refresh? }`. The refresh token is revoked server-side through its `jti`
denylist; omitting it is allowed and remains idempotent.

---

## Customer — `me`, reservations, waitlist (all `customer` unless noted)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/me` | GET, PATCH | customer | Profile read / update (name, birthdate, etc.). |
| `/v1/me/reservations` | GET | customer | List the user's reservations. |
| `/v1/me/points` | GET | customer | Loyalty points balance + ledger. |
| `/v1/me/referral` | GET, POST | customer | Referral code + invites. |
| `/v1/me/profile` | GET | customer | Extended profile. |
| `/v1/me/push-subscribe` | GET, POST | customer | Web-push subscription. |
| `/v1/me/chats` | GET | customer | List chat threads. |
| `/v1/me/chats/[id]` | GET, POST | customer | Read / send messages in a thread. |
| `/v1/gift-cards` | GET, POST | customer | List / purchase gift cards. |
| `/v1/reservations` | POST | customer/staff | **Create reservation** (see below). |
| `/v1/reservations/[code]` | GET | customer | Reservation detail by code. |
| `/v1/reservations/[code]/cancel` | POST | customer | Cancel (state-guarded). |
| `/v1/reservations/[code]/arrive` | POST | customer | Self check-in. |
| `/v1/reservations/[code]/pay` | POST | customer | Start deposit payment (Zarinpal). |
| `/v1/restaurant/reservations/[code]/events` | GET | customer | Reservation status timeline. |
| `/v1/waitlist` | POST | customer/staff | Join a waitlist. |
| `/v1/waitlist/[id]` | GET, DELETE | customer | Status / leave. |
| `/v1/waitlist/[id]/accept` · `/decline` | POST | customer | Respond to an offer. |
| `/v1/restaurant/waitlist/analytics` | GET | customer | **(uncertain auth: uses customer JWT)**. |

### `POST /v1/reservations` — create reservation
Auth: customer or staff (staff can create manual/guest reservations within their
tenant). Optional `Idempotency-Key` header (dedup double-submit).

Request body (validated):
```jsonc
{
  "restaurant_id": "uuid",         // required
  "date": "YYYY-MM-DD",            // required
  "time": "HH:mm",                 // required
  "party_size": 2,                 // 1..30
  "preferences": ["window"],       // optional string[]
  "preorder": [{ "menu_item_id":"uuid", "qty":1 }],  // optional
  "guest": { "name","phone","table_number","note" }, // staff manual booking
  "notify_sms": true,
  "duration_minutes": 90,          // 15..600
  "hold": false,                   // create as pending hold
  "coupon_code": "WELCOME20",
  "gift_card_code": "GC...",
  "gift_card_amount": 50000
}
```
Response `201`:
```json
{
  "code": "RZ8K2M...", "status": "confirmed",
  "table_number": "T1", "merged_tables": [],
  "slot_start": "2026-07-10T19:00:00", "slot_end": "2026-07-10T20:30:00",
  "hold_expires_at": null, "club": null, "checkout": null
}
```
Validation: full-schema (all errors at once) + body size cap. Errors:
`VALIDATION`, `FORBIDDEN_TENANT` (staff cross-tenant), `RESTAURANT_CLOSED`,
`RESTAURANT_OFFLINE`, `OUTSIDE_HOURS`, `PAST_TIME`, `TOO_FAR_AHEAD`,
`PARTY_TOO_LARGE`, `NO_TABLE_FOR_PARTY`, `SLOT_FULL`/`TABLE_CONFLICT`,
`SLOT_LOCK_TIMEOUT`, `CONCURRENCY_RETRY`. Related services: `reservations`,
`coupons`, `loyalty` (gift cards), `customer-insights` (no-show risk), `sms`,
`availability-cache`, `idempotency`.

### `POST /v1/waitlist` — join
Body: `{ restaurant_id, party_size, guest?{name,phone,email}, notify_sms?,
notify_push?, notify_email?, note? }`. Response includes
`{ id, position, estimated_wait_minutes, is_vip, status }`. Related: `waitlist`.

---

## Public discovery

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/restaurants` | GET | public | Restaurant feed (list, cursor). |
| `/v1/restaurants/[slug]/availability` | GET | public | Slots for a date/party. |
| `/v1/restaurants/[slug]/chat` | POST | customer | Start/append a general chat. |
| `/v1/events` | GET | public | Public special-events feed. |
| `/v1/checkin` | POST | public | QR check-in at table. |

### `GET /v1/restaurants/{slug}/availability?date=YYYY-MM-DD&party=N`
Query: `date` (required), `party` (1..30, default 2). Response (mocked shape used
by tests):
```json
{ "date":"2026-07-10", "party":2,
  "slots":[ {"time":"19:00","free_tables":["T1","T2"],"status":"open"},
            {"time":"21:00","free_tables":[],"status":"full"} ] }
```
Errors: `NOT_FOUND` (restaurant), `VALIDATION`. Service: `reservations.getAvailability`.

---

## Restaurant panel — `/v1/restaurant/*` (auth: `restaurant(RBAC)` unless noted)

Each route runs through `withRestaurantAuth`; the RBAC **permission** required is
shown where relevant. Owners/managers bypass permission checks.

| Route | Method(s) | Permission | Purpose |
|---|---|---|---|
| `/reservations` | GET | — | List reservations (dashboard). |
| `/reservations/[code]/status` | PATCH | canManageReservations | Change reservation status (lifecycle). |
| `/reservations/[code]/events` | GET | — | Reservation event timeline. |
| `/walkin` | POST | canManageReservations | Seat a walk-in. |
| `/tables` | GET, POST | canManageTables | List / create tables. |
| `/tables/[id]` | PATCH, DELETE | canManageTables | Update / delete table. |
| `/tables/[id]/state` | PATCH | canManageTables | Real-time table state. |
| `/waitlist` | GET, POST | canManageWaitlist | Manage waitlist. |
| `/waitlist/analytics` | GET | canViewAnalytics | Waitlist stats. |
| `/hours` | GET, PUT | canManageSettings | Opening hours + closures (approval flow). |
| `/profile` | GET, PUT | canManageSettings | Restaurant profile. |
| `/pricing` | GET, PUT | canManageSettings | AI min-spend pricing rules. GET returns `suggestions[]` derived from the last 90 days of the restaurant's own reservations; it is **empty** below `MIN_OBSERVATIONS` (20) rather than guessing. `occupancy_pct` is relative busyness (window average ÷ busiest hour), **not** capacity occupancy — see `KNOWN_LIMITATIONS.md` §2h. |
| `/cashback` | GET, PATCH | canManageSettings | Cashback percentages. |
| `/cancellation-policy` | GET, PUT | canManageSettings | Cancellation/no-show policy. |
| `/heartbeat` | POST | — | Online presence (`lastSeenAt`). |
| `/analytics` · `/ai` | GET | canViewAnalytics | Analytics / rule-based AI insight cards. |
| `/manager-insights` | GET | canViewAnalytics | Daily performance digest (no LLM). |
| `/notifications` | GET | canViewAnalytics | Panel notifications. |
| `/reports` · `/fraud-signals` | GET | canViewRevenue | Revenue reports / fraud signals. |
| `/rfm` · `/customers` | GET | canViewAnalytics | CRM / RFM. |
| `/customers/[userId]` | GET, PATCH | canViewAnalytics | Customer 360 + edit. |
| `/crm/recommendations` | GET | canViewAnalytics | Who to contact, why, on which channel — plus **measured effectiveness** and a recontact cooldown. |
| `/crm/recommendations/contacted` | POST | canViewAnalytics | Record that a recommended customer was called. Body `{user_id}`. Writes to `outreach_log`; suppresses that customer for `cooldown_days`. |
| `/campaigns` | GET | canManageCampaigns | Campaign history. |
| `/sms` | POST | canManageCampaigns | Send SMS campaign (records recipients in `outreach_log`). |
| `/automations` | GET, POST | canManageCampaigns | Marketing automations. GET returns `conversion_rate_pct` (**nullable**) + `conversion_status`. |
| `/coupons` | GET, POST | canManageCoupons | Coupons. |
| `/members` | GET | canViewAnalytics | Club members. |
| `/reviews` | GET, PATCH | canManageSettings | Reviews + replies. |
| `/menu` | GET, POST | canManageSettings | Menu items. |
| `/menu/[id]` | PATCH, DELETE | canManageSettings | Update / delete item. |
| `/menu/[id]/photo` | POST, DELETE | canManageSettings | Item photo (`multipart/form-data`). |
| `/menu/branding` · `/menu/qr` | GET, PATCH / GET | canManageSettings | Public-menu branding + QR. |
| `/photos` | GET, POST, DELETE | canManageSettings | Photo gallery. **POST is `multipart/form-data`** (field `file`), not JSON. Uploads land as `pending` and are invisible publicly until the company panel approves them. See below. |
| `/notes` | GET, POST, PATCH, DELETE | — | Internal staff notes. |
| `/events` | GET, POST, PATCH, DELETE | canManageSettings | Special events. |
| `/branches` | GET, POST | canManageSettings | Multi-branch management. |
| `/chats` | GET | — | Chat threads. |
| `/chats/[id]` | GET, POST | canManageReservations | Restaurant-side chat. |
| `/assistant` | GET, POST | canViewAnalytics | Offline free-text assistant (rule/NLU based, no LLM). |
| `/assistant/feedback` | POST | canViewAnalytics | Assistant answer feedback. |
| `/staff` | GET, POST, PATCH | `withStaffAuth` (owner/manager) | Staff management (tenant-level). See below. |

> ⚠️ **Rewritten 2026-08-20 from the routes themselves, not from memory.** The previous
> table was ~13 routes short (`crm/*`, `menu/*`, `assistant/*`, `manager-insights`,
> `profile`, `cancellation-policy`, `notifications`, `waitlist/analytics`,
> `reservations/[code]/events`) and carried a `*` disclaimer that several permission
> mappings were **guesses**. Every row above was read out of the corresponding
> `route.ts` (`permission:` argument to `withRestaurantAuth`), so the guesses are gone.
> A `—` means the route has no `permission:` key — it relies on restaurant auth alone.
>
> Regenerate this table after adding routes:
> ```bash
> cd api/src/app/api/v1/restaurant && find . -name route.ts | sed 's|^\./||; s|/route.ts||' | sort
> ```

### `/v1/restaurant/staff` — staff management (auth: `withStaffAuth`, owner/manager only)

Tenant-level (not scoped to one restaurant). Only `owner`/`manager` may call it;
`owner` records are immutable via this route.

- **GET** → `{ items: StaffItem[] }`. Each `StaffItem`:
  `{ id, name (string|null), phone, role, is_active, restaurant_id (string|null),
  permissions }` where `permissions` is exactly the 9 `can*` booleans (owner/manager
  → all `true`; `staff` → its `StaffPermission` record or the safe defaults).
- **POST** — add a member. Body `{ phone, name?, role?('staff'|'manager', default 'staff'), permissions? }`.
  - `phone` is normalized to `+98…`; invalid → `422 VALIDATION`.
  - Only `owner` may create a `manager` → otherwise `403`.
  - Duplicate phone in the tenant → `409 STAFF_PHONE_TAKEN`.
  - `permissions` apply only when `role='staff'`.
  - Returns `{ item: StaffItem }`, `201`.
- **PATCH** — body `{ staff_id, name?, is_active?, permissions?, restaurant_id? }`.
  `name: null` clears it; absent = unchanged. Guards: cannot modify an `owner`;
  cannot deactivate yourself; a `manager` cannot deactivate another `manager`
  (owner-only). Returns `{ ok: true }`.

```bash
curl -X POST "$API/api/v1/restaurant/staff" \
  -H "Authorization: Bearer $OWNER_ACCESS" -H "Content-Type: application/json" \
  -d '{"phone":"09123456789","name":"رضا محمدی","role":"staff"}'
```

Example (list reservations):
```bash
curl "$API/api/v1/restaurant/reservations?date=2026-07-10" \
  -H "Authorization: Bearer $STAFF_ACCESS"
```

---

## Platform admin — `/v1/admin/*` (auth: `platform-admin`)

| Route | Method(s) | Purpose |
|---|---|---|
| `/overview` | GET | Platform KPIs. |
| `/restaurants` | GET | All restaurants across tenants. |
| `/restaurants/[id]/control` | PATCH | Enable/disable a restaurant (plan/features). |
| `/restaurants/[id]/sms` | GET, POST | View / top-up SMS balance. |
| `/business-intelligence` | GET | Cross-tenant BI. |
| `/security` | GET | Security/audit view. |
| `/system-health` | GET | System health. |
| `/settings` | GET, PATCH | Platform settings (e.g. Zarinpal merchant id). |
| `/photos` | GET | Gallery moderation queue (`?status=pending\|approved\|rejected\|all`). Oldest-first for `pending` so the queue is FIFO. |
| `/photos/[id]` | PATCH, DELETE | `{ action: 'approve' \| 'reject', reason? }`. DELETE removes the row **and the file**. Both audited. |

Access is **fail-closed**: if `PLATFORM_ADMIN_TENANT_ID` is unset, all admin
routes return `FORBIDDEN_TENANT`.

---

## Restaurant photo gallery — upload & moderation

Photos are uploaded as files and are **not public until approved**.

**Upload** — `POST /v1/restaurant/photos`, `multipart/form-data`:

| Field | Required | Notes |
|---|---|---|
| `file` | yes | JPEG, PNG or WebP only. Max 8 MB, 200–8000 px per side. |
| `category` | no | `food` (default), `interior`, `drink`, `event`, `other`. |
| `caption` | no | ≤ 300 chars. |

Returns `201 { id, status: 'pending', url, width, height, message }`.

The format is decided by the file's **magic bytes**, never by the browser's
`Content-Type` or the filename. SVG is rejected on purpose: it is an XML
document that can carry `<script>`, and serving it from the API origin would
be stored XSS. Invalid input returns `422` with a Persian message.

**Serving** — `GET /v1/media/<yyyy>/<mm>/<uuid>.<ext>`, public, no auth.
Approved photos must load on the public restaurant page, so the route cannot
require a token; unapproved ones are simply never linked anywhere public and
their names are random UUIDs. Responses carry `nosniff`,
`Content-Security-Policy: default-src 'none'; sandbox` and a one-year
immutable cache (the key never changes).

**Moderation** — the company panel approves or rejects. Approving or rejecting
invalidates the `restaurant-detail` cache immediately, so a takedown is live in
milliseconds rather than up to 60 s later.

**Storage** — bytes live on the `uploads` volume (`UPLOAD_DIR`, default
`/data/uploads`), not in Postgres, so `pg_dump` stays usable. The backup
service tars that volume alongside the SQL dump — restoring only the database
would give you intact rows pointing at missing files.

Rows that predate this feature (added by URL) are treated as already approved;
the migration backfills them so no live gallery went dark on deploy.

---

## Payments

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/reservations/[code]/pay` | POST | customer | Create a Zarinpal payment; returns gateway URL. |
| `/v1/payments/callback` | GET | public | Zarinpal return URL. Validates `authority` + `code` + amount, verifies with Zarinpal, updates `payment` + `reservation.depositStatus`, redirects to `${appBase()}/reservations/{code}?payment=paid|failed` (`NEXT_PUBLIC_APP_URL`, same variable the check-in QR uses). |

The callback is intentionally **unauthenticated** (the browser returns from the
gateway without the API token); security comes from matching
`authority + reservation code + amount`, not a token.

---

## Maintenance / cron — `/v1/maintenance/*` (auth: `cron`)

All accept `GET`/`POST` and are guarded by `guardMaintenance`
(`x-maintenance-key` or `Authorization: Bearer <CRON_SECRET>`).

| Route | Purpose | Typical schedule |
|---|---|---|
| `/expire` | Expire pending holds. | every 5 min |
| `/waitlist` | Expire offers + promote next in queue. | every 2 min |
| `/jobs-drain` | Drain the Postgres job queue. | every 1 min |
| `/lifecycle` | Advance reservation lifecycle (preparing/no-show/…). | daily 03:00 |
| `/customer-insights` | Recompute CLV/RFM/segments. | daily 03:30 |
| `/retention` | Data retention cleanup. | daily 04:00 |
| `/rewards` | Birthday/anniversary rewards. | daily 06:00 |
| `/ensure-partitions` | Create upcoming `reservations` partitions. | monthly |

(Schedules mirror `api/vercel.json` `crons`.)

---

## Ops

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | public | Liveness. |
| `/api/metrics` | GET | public/`METRICS_TOKEN` | Prometheus metrics (Bearer token if `METRICS_TOKEN` set). |

> **How to regenerate this reference accurately:** for any endpoint, open its
> `route.ts` — the request schema (`z.object({...})`), the auth wrapper, and the
> thrown `Err.*` codes are the ground truth. This document summarizes 80+
> handlers; the per-route Zod schemas are the authoritative request contracts.
