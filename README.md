# RezervoNo (رزرونو)

**Restaurant-reservation SaaS for Iran's Gen‑Z market.** A multi-tenant platform
with three front-ends (customer, restaurant, platform admin) on top of a single
Next.js API. Persian / RTL, PWA, production-grade.

> 📚 **Full technical documentation is in [`/docs`](./docs).** Start with
> [`docs/PROJECT_KNOWLEDGE.md`](./docs/PROJECT_KNOWLEDGE.md).

---

## Overview

Three separate front-ends connected to one shared backend (an "Uber-style" split):

| Piece | Path | Stack |
|---|---|---|
| Customer app | `apps/customer` | Vanilla JS ES modules, PWA, RTL |
| Business panel (restaurant) | `apps/business` | Vanilla JS single-page panel |
| Company panel (platform admin) | `apps/company` | Vanilla JS single-page panel |
| Marketing site + SEO | `apps/landing`, `apps/seo` | Separate Next.js + React apps (own package.json/CI job) |
| API | `api` | Next.js 16 (App Router, Turbopack) · Prisma · PostgreSQL 16 · Redis · JWT |
| Design system (source) | `shared` | CSS tokens / foundation / bridge + a few shared vanilla-JS helpers (no React components) |

Auth is **Bearer JWT** (no cookies). Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Features

- ⚡ **Book in seconds** — discovery feed, availability, instant booking, optional
  deposits (Zarinpal). Double-booking prevented by a **two-layer lock** (Redis
  slot-lock + PostgreSQL exclusion constraint).
- 🪑 **Restaurant ops** — real-time table state + floor plan, smart allocation,
  priority waitlist with offers, full reservation lifecycle state machine.
- 🎯 **CRM & marketing** — RFM/CLV segments, no-show risk, coupons, trigger-based
  automations, SMS campaigns (Melipayamak).
- 🏆 **Loyalty** — points ledger, referrals, gift cards, tiered clubs, cashback.
- 💬 **Chat** — customer ↔ restaurant messaging.
- 🏢 **Platform console** — tenants, plans/billing, SMS balance, security audit,
  runtime settings (editable without redeploy).
- 🛡️ **Hardened** — OTP login, sliding-window rate limiting + auto-ban,
  CSRF/CORS, strict security headers, RBAC, idempotency, audit log, job queue.

## Installation

Requires a Linux host with **Docker** + **Docker Compose** (recommended), or
Node 20+ with your own Postgres/Redis.

```bash
git clone <repo> && cd RezervnoOS
cp .env.example .env
# In .env set at least:
#   POSTGRES_PASSWORD  — a strong password
#   REDIS_PASSWORD     — a strong password
#   JWT_SECRET / JWT_REFRESH_SECRET  — openssl rand -base64 48 (≥32 chars each)
#   RUN_SEED=true      — for the first boot (creates demo tenant/users)
```

### Option A — local (HTTP, no domain)
```bash
docker compose --profile http up -d --build
# Customer:  http://<server-ip>/
# Business:  http://<server-ip>/business/
# Company:   http://<server-ip>/company/
```

### Option B — production (auto HTTPS via Caddy, needs a domain)
```bash
# set DOMAIN=yourdomain.ir in .env, then:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
Caddy obtains and renews Let's Encrypt TLS automatically.

### Final step (both): platform admin
```bash
docker compose logs api | grep PLATFORM_ADMIN_TENANT_ID
# put the printed id into .env, set RUN_SEED=false, and `up` again.
```

### Without Docker (backend only)
```bash
cd api
cp .env.example .env          # fill DATABASE_URL, REDIS_URL, JWT secrets, ALLOWED_ORIGINS
npm install                   # runs `prisma generate`
npx prisma db push            # create schema (dev)
sh prisma/apply-sql.sh        # apply prisma/sql/*.sql via prisma db execute
npm run db:seed
```

### Seed logins (`OTP_DEV_MODE=true` returns the code in the API response)
| Panel | Login phone | Notes |
|---|---|---|
| Customer app | any number | new users see a sign-up form |
| Business panel | `09121111111` | sample restaurant manager |
| Company panel | `09120000000` | platform admin |

Set `OTP_DEV_MODE=false` and configure `MELIPAYAMAK_USERNAME`/`MELIPAYAMAK_PASSWORD` for real SMS in
production (dev mode is rejected in production).

## Development

```bash
# Backend
cd api && npm run dev                 # http://localhost:3000

# Front-ends (static; each app is its own site → root-absolute /css, /js paths)
npx serve apps/customer -l 8080
npx serve apps/business -l 8081
npx serve apps/company  -l 8082

# Design system: edit shared/, then regenerate the per-app copies (no build step)
sh tools/sync-design-system.sh          # copy shared/ → apps/*
sh tools/sync-design-system.sh --check  # CI drift-check (fails if apps/ ≠ shared/)

# E2E (customer + panels, mocked API; 3 viewports: iPhone 13 / Pixel 5 / Desktop)
cd e2e && npm install && npx playwright install --with-deps chromium webkit
npm test                 # auto-serves all 3 apps (customer:8080, business:8081, company:8082)
```

> Panel tests navigate via the app's `nav()` (not raw sidebar clicks) so they pass
> on mobile viewports where the sidebar is off-canvas.

**Conventions** (see [`docs/PROJECT_KNOWLEDGE.md`](./docs/PROJECT_KNOWLEDGE.md) §7
and [`CLAUDE.md`](./CLAUDE.md)): surgical changes; Persian commit messages stating
*what / why / tested-vs-only-type-checked*; enums over free strings; domain errors
via `Err`; **edit `shared/` (never per-app copies) and run
`tools/sync-design-system.sh`**; bump `CACHE_VERSION` in `apps/customer/sw.js` when
its `js/`/`css/` change; preserve CRLF files (some HTML/JS are CRLF — see
`CLAUDE.md`); never break demo mode (OTP `1234`); small PRs merged on green CI.

## Deployment

- **Managed (Vercel)** — used **only** for the two Next.js sites: `apps/landing`
  (root domain) and `apps/seo` (own project, see `docs/adr/0001-seo-rendering-architecture.md`).
  The `api` backend is **not** deployed to Vercel — see the self-host bullet below.
  The root `.vercelignore` must keep ignoring `api` + infra folders.
- **Self-host (Docker Compose)** — `docker-compose.yml` (local),
  `docker-compose.prod.yml` (Caddy + TLS), `docker-compose.observability.yml`
  (Prometheus + Grafana).

Full guide + rollback: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
Env vars: [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md).

## Commands

### API (`cd api`)
| Command | Description |
|---|---|
| `npm run dev` | Next dev server. |
| `npm run build` | `prisma generate && next build`. |
| `npm start` | Production server. |
| `npm test` | Unit tests (`tsx --test tests/_all.runner.mts`). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run db:migrate` / `db:seed` | Migrate (dev) / seed. |

### Docker & tooling
```bash
docker compose logs -f api            # backend logs
docker compose restart api            # restart backend
docker compose down                   # stop
docker compose down -v                # stop + wipe data (careful!)
docker compose exec api npx prisma db seed          # manual seed
docker compose exec postgres psql -U rezervno rezervno   # DB shell

# Backups (built-in `backup` service)
docker compose exec backup /scripts/backup.sh       # backup now
docker compose exec backup /scripts/list.sh         # list backups
docker compose exec backup /scripts/restore.sh      # restore latest

# Build offline single-file bundles from apps/*
python3 tools/build-standalone.py
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): **build** (type-check + next build),
**test** (unit tests vs real Postgres + Redis), **security** (`npm audit`),
**e2e** (Playwright, 3 browsers, mocked API). Push to `main` → Vercel
auto-deploy. Details: [`docs/PROJECT_KNOWLEDGE.md`](./docs/PROJECT_KNOWLEDGE.md) §11.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| First prod request errors about `ALLOWED_ORIGINS` | Set `ALLOWED_ORIGINS` (comma-separated front-end origins). |
| `JWT_SECRET باید حداقل ۳۲ کاراکتر باشد` | Secrets must be ≥ 32 chars. |
| `prisma migrate deploy` → **P3015** | Fixed — the hand-written SQL moved out of `migrations/` to `prisma/sql/`, applied by `prisma/apply-sql.sh` ([`docs/DATABASE.md`](./docs/DATABASE.md)). |
| `npm test` shows different `# tests`/`# suites` between runs (always `fail 0`) | Fixed — was `--test-force-exit` racing a per-file subprocess's stdout flush. `npm test` now runs a single wrapper file (`tests/_all.runner.mts`) that imports all `tests/*.test.mts` for their side effects, so there's only one file (no subprocess-per-file race) and no experimental CLI flag needed — works the same on any Node version. |
| E2E reload doesn't re-run app | Playwright must set `serviceWorkers: 'block'`. |
| Returning users see stale UI | Bump `CACHE_VERSION` in the app's `sw.js`. |
| Cron endpoints 401 | Expected without `CRON_SECRET`/`MAINTENANCE_KEY` — that's the protection. |
| Company/admin panel forbids everyone | Set `PLATFORM_ADMIN_TENANT_ID` (fail-closed by design). |
| `prepared statement already exists` | Behind a transaction pooler: append `?pgbouncer=true&connection_limit=1` and use a separate direct URL for migrations. |

## Documentation index

- [PROJECT_KNOWLEDGE](./docs/PROJECT_KNOWLEDGE.md) · [ARCHITECTURE](./docs/ARCHITECTURE.md) · [DATABASE](./docs/DATABASE.md) · [API_REFERENCE](./docs/API_REFERENCE.md)
- [FRONTEND](./docs/FRONTEND.md) · [BACKEND](./docs/BACKEND.md) · [DEPLOYMENT](./docs/DEPLOYMENT.md) · [ENVIRONMENT](./docs/ENVIRONMENT.md)
- [SECURITY](./docs/SECURITY.md) · [KNOWN_LIMITATIONS](./docs/KNOWN_LIMITATIONS.md)
- Operational guides (existing): `LAUNCH-GUIDE.md`, `BACKUP-GUIDE.md`, `SECURITY-GUIDE.md`, `DATABASE-OPS.md`, `SCALING.md`, `OBSERVABILITY.md`.

## License

See [LICENSE](./LICENSE).
