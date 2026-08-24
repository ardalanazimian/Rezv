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

## Database pool tuning

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `DB_CONNECTION_LIMIT` | ➖ | `10` | api | Prisma connection pool cap. |
| `DB_POOL_TIMEOUT` | ➖ | `10` | api | Seconds to wait for a pool connection. |

---

## SMS (Kavenegar)

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `KAVENEGAR_API_KEY` | ➖ | — | api | Without it, real SMS is disabled (logs only → needs `OTP_DEV_MODE` for login). |
| `KAVENEGAR_TPL_OTP` | ➖ | `rezervno-otp` | api | OTP template name. |
| `KAVENEGAR_TPL_BOOKING` / `_REMINDER` / `_WELCOME` / `_CAMPAIGN` / `_WINBACK` | ➖ | template defaults | api | Lifecycle/marketing templates. |
| `KAVENEGAR_TPL_REJECTED` / `_PREPARING` / `_CANCELLED` / `_NOSHOW` / `_THANKS` / `_WAITLIST` / `_WL_JOIN` / `_WL_OFFER` | ➖ | defaults | api | Reservation-lifecycle + waitlist templates. |

---

## Payments (Zarinpal)

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `ZARINPAL_MERCHANT_ID` | ➖ (fallback) | from `platform_settings` | api | Merchant id; the DB `platform_settings` value takes precedence. |
| `ZARINPAL_SANDBOX` | ➖ | `true` (fallback) | api | Sandbox toggle (DB setting wins). |
| `CUSTOMER_APP_URL` | ➖ | `https://app.rezervno.ir` | api | Redirect target after payment: `${CUSTOMER_APP_URL}/reservations/{code}?payment=paid\|failed`. |

---

## Push / email

| Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `FCM_SERVER_KEY` | ➖ | — | api | Firebase key for web push; unset → push disabled. |
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
