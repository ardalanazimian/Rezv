# ENVIRONMENT.md — RezervoNo

> Every environment variable used by the platform, compiled from
> `api/.env.example`, root `.env.example`, `docker-compose*.yml`, and code
> references. **Required** = the app/stack won't work correctly without it in
> production. Defaults are what the code/compose falls back to.

Legend: **Scope** = `api` (backend runtime), `compose` (self-host stack /
infra), `both`.

---

## Core (required in production)

| Name | Required | Default | Scope | Description | Example |
|---|---|---|---|---|---|
| `DATABASE_URL` | ✅ | — | api | Postgres connection (use a **pooled** URL in prod). | `postgresql://u:p@host:6543/db?pgbouncer=true&connection_limit=10` |
| `DATABASE_DIRECT_URL` | ⚠️ **inert — see note** | — | api | Intended as a **direct** (non-pooled) URL for migrate/db push, but **nothing reads it today**. | `postgresql://u:p@host:5432/db` |
| `DATABASE_REPLICA_URL` | ➖ | falls back to primary | api | Read-replica for heavy reads (`dbRead`). | `postgresql://u:p@replica:6543/db?pgbouncer=true` |
| `REDIS_URL` | ✅ | — | api | Redis connection (rate-limit, locks, cache, OTP). | `redis://:pass@redis:6379` |
| `REDIS_PASSWORD` | ✅ (self-host) | — | compose | Redis auth (compose `--requirepass`). | random |
| `REDIS_CLUSTER_NODES` | ➖ | — | api | If set, Redis **cluster** mode (overrides `REDIS_URL`). | `10.0.0.1:6379,10.0.0.2:6379` |
| `JWT_SECRET` | ✅ | — | api | Access-token secret, **≥ 32 chars** (fail-fast). | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | ✅ | — | api | Refresh-token secret, **≥ 32**, different from above. | `openssl rand -base64 48` |
| `ALLOWED_ORIGINS` | ✅ (prod) | — | api | Comma-separated front-end origins; used by **CORS + CSRF**. Empty → cross-origin fetch blocked; unset in prod → first request errors. | `https://rezervno.ir,https://www.rezervno.ir` |
| `NODE_ENV` | ➖ | `production` (compose) | api | Standard Node env. | `production` |

---

## Security / operations

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `CRON_SECRET` | ✅ (prod) | — | api | Auth for cron endpoints (`Authorization: Bearer`). Timing-safe compared. Without it, cron endpoints are uncallable. |
| `MAINTENANCE_KEY` | ➖ | — | api | Manual maintenance auth via `x-maintenance-key` header. |
| `OTP_DEV_MODE` | ➖ | `false` (prod) | api | `true` returns the OTP in the response (no SMS). **Rejected in production** (auth-bypass guard). Dev only. |
| `TRUST_PROXY_HEADERS` | ➖ | `true` | api | Trust `X-Real-IP`/`CF-Connecting-IP`/`XFF` for client IP. Set `false` if not behind a trusted proxy. |
| `ALLOW_PRIVATE_WEBHOOKS` | ➖ | `false` | api | Allow webhooks to private/internal addresses (SSRF guard). Dev only. |
| `PLATFORM_ADMIN_TENANT_ID` | ✅ (company panel) | — | api | UUID of the platform-admin tenant. Unset → company/admin panel **fail-closed**. |
| `METRICS_TOKEN` | ➖ | — | api | If set, `/api/metrics` requires `Authorization: Bearer`. |
| `LOG_LEVEL` | ➖ | `info` | api | `debug\|info\|warn\|error`. |
| `SENTRY_DSN` | ➖ | — | api | If set, errors/warnings go to Sentry. |

---

## Public URLs

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ➖ | `https://rezervno.ir` | api | Base for the public marketing/menu domain (`lib/public-urls.ts` `siteBase()`); also what gets printed inside menu QR codes. Set in staging or the QR points at production. |
| `NEXT_PUBLIC_APP_URL` | ➖ | derived from `NEXT_PUBLIC_SITE_URL` with an `app.` prefix | api | Base for the **customer app** (`lib/public-urls.ts` `appBase()`). Used server-side for two redirect targets that must agree with wherever the customer app is actually deployed: the table check-in QR (`?checkin=CODE`) and the Zarinpal payment-callback redirect (`/reservations/{code}?payment=paid\|failed`). If your app subdomain doesn't follow the `app.` convention, set this explicitly. |

---

## Database pool tuning

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `DB_CONNECTION_LIMIT` | ➖ | `10` | api | Prisma connection pool cap. |
| `DB_POOL_TIMEOUT` | ➖ | `10` | api | Seconds to wait for a pool connection. |

---

## SMS (Melipayamak)

> **Migrated from Kavenegar on 2026-08-26.** The two providers are not
> interchangeable: Kavenegar addressed a pattern by **name**
> (`rezervno-otp`), Melipayamak by a **numeric `bodyId`** issued after the
> pattern text is approved in the panel. There are therefore no meaningful
> defaults — an unset `bodyId` means that message type is **not sent**, and
> it is logged explicitly rather than silently falling back.
>
> REST base: `https://rest.payamak-panel.com/api/SendSMS/…`

| Variable | Req | Default | Used by | Notes |
|---|---|---|---|---|
| `MELIPAYAMAK_USERNAME` / `MELIPAYAMAK_PASSWORD` | ➖ | — | api | Without them, real SMS is disabled (logs only → needs `OTP_DEV_MODE` for login). |
| `MELIPAYAMAK_FROM` | ➖ | — | api | Dedicated line. **Only** needed for free-text (campaign) SMS. Without it, free-text send fails explicitly — it does not silently fall back to a template. |
| `MELIPAYAMAK_BODYID_OTP` | ➖ | — | api | Pattern id for the login code. |
| `MELIPAYAMAK_BODYID_BOOKING` / `_REMINDER` / `_WELCOME` / `_CAMPAIGN` / `_WINBACK` | ➖ | — | api | Lifecycle/marketing patterns. |
| `MELIPAYAMAK_BODYID_REJECTED` / `_PREPARING` / `_CANCELLED` / `_NOSHOW` / `_THANKS` / `_WAITLIST` / `_WL_JOIN` / `_WL_OFFER` | ➖ | — | api | Reservation-lifecycle + waitlist patterns. |
| `MELIPAYAMAK_TOKEN_SEPARATOR` | ➖ | `;` | api | Separator between pattern token values. ⚠️ **Unverified** — Melipayamak does not publish this; confirm against your panel before production. |

### Two send paths
- **Pattern** (`BaseServiceNumber` + `bodyId`) — required for OTP and all
  transactional messages; a service line will not accept free text.
- **Free text** (`SendSMS` + `MELIPAYAMAK_FROM`) — used when a campaign
  carries an author-written message. Kavenegar had no equivalent, which is
  why campaign text was previously accepted by the API and then dropped.

## Payments (Zarinpal)

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `ZARINPAL_MERCHANT_ID` | ➖ (fallback) | from `platform_settings` | api | Merchant id; the DB `platform_settings` value takes precedence. |
| `ZARINPAL_SANDBOX` | ➖ | `true` (fallback) | api | Sandbox toggle (DB setting wins). |

> Payment-callback redirect target is `NEXT_PUBLIC_APP_URL`, documented under
> [Public URLs](#public-urls) — it shares that variable with the check-in QR
> instead of its own (`CUSTOMER_APP_URL` was removed 2026-08-22: same purpose,
> different name, easy to set one and forget the other).

---

## Push / email

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `FCM_SERVER_KEY` | ➖ | — | api | Firebase key for web push; unset → push disabled. ⚠️ **Not implemented** — zero references in `api/src` (A10, 2026-09-03); ticketed as P0-018, founder decides: build the feature or remove this row. |
| `EMAIL_API_KEY` | ➖ | — | api | Email provider key; unset → email disabled. |
| `EMAIL_FROM` | ➖ | `noreply@rezervno.ir` | api | From address. |

---

## Self-host / compose only

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `POSTGRES_USER` | ➖ | `rezervno` | compose | Postgres user. |
| `POSTGRES_PASSWORD` | ✅ (self-host) | — | compose | Postgres password (compose fails without it). |
| `POSTGRES_DB` | ➖ | `rezervno` | compose | DB name. |
| `RUN_SEED` | ➖ | `false` | both | Run seed on first boot (prints platform tenant id). |
| `DOMAIN` | ➖ | — | compose | Domain for Caddy auto-TLS (prod compose). |
| `BACKUP_CRON` | ➖ | `0 3 * * *` | compose | Backup schedule. |
| `BACKUP_KEEP` | ➖ | `14` | compose | Backups to retain. |
| `BACKUP_ON_START` | ➖ | `true` | compose | Backup immediately on boot. |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | ➖ | — | compose | Off-site backup target (S3-compatible). Unset → local-only backups. |
| `GRAFANA_PASSWORD` | ➖ | `admin` | compose | Grafana admin password (change it). |

> **Notes**
> - `api/.env.example` is the authoritative list for the backend runtime; the
>   root `.env.example` covers the compose stack (DB/Redis/backup) and a few app
>   vars. Some names differ slightly between the two files (e.g. the direct URL
>   is `DATABASE_DIRECT_URL`).
> - ⚠️ **`DATABASE_DIRECT_URL` is currently inert** (verified 2026-08-24 by
>   grep over the whole repo). `prisma/schema.prisma` declares only
>   `url = env("DATABASE_URL")` — there is no `directUrl`, so Prisma never
>   uses it. Setting it changes nothing; **migrations run over whatever
>   `DATABASE_URL` points at**, pooler included.
>
>   This matters: with PgBouncer *transaction* pooling, `prisma migrate` /
>   `db execute` can misbehave — the exact hazard `api/src/lib/db.ts` warns
>   about. Today the project applies schema changes with
>   `prisma/apply-sql.sh`, which is normally run against a direct connection
>   by the operator, so this has not bitten anyone.
>
>   To actually wire it, add `directUrl = env("DATABASE_DIRECT_URL")` to the
>   datasource — but note Prisma then **requires** the variable in every
>   environment (local, CI, test) and fails validation when it is missing.
>   That is why it was left unwired rather than switched on blindly.
> - Anything not marked required has a safe default or degrades gracefully
>   (feature disabled) when absent.
