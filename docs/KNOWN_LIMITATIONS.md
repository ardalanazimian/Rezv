# KNOWN_LIMITATIONS.md — RezervoNo

> Honest inventory of technical debt, known issues, and scalability concerns
> derived from the code and merge history. Items marked **(uncertain)** need
> confirmation against the running environment.

---

## 1. Deployment / Build

- **Front-end Vercel wiring is not in the repo.** After the design-system
  refactor, `apps/*` use absolute asset paths and there is no root `vercel.json`
  wiring the three front-ends. Each app must be configured as its own Vercel
  project with its own **Root Directory** (`apps/customer`, `apps/business`,
  `apps/company`). This is a dashboard task, not code. **(follow-up)**
- **`prisma migrate deploy` P3015 — resolved.** The hand-written SQL scripts used
  to live under `prisma/migrations/manual/`, a folder inside `migrations/` with
  no `migration.sql`, so `migrate deploy` failed with **P3015** — which also
  meant `docker-entrypoint.sh` (it runs `migrate deploy` with `exit 1` on
  failure) never booted the container. They were moved to `prisma/sql/` (outside
  `migrations/`) and are now applied by `prisma/apply-sql.sh` (`prisma db
  execute`, no `psql`). The entrypoint runs `migrate deploy` (baselining a
  pre-existing DB via `migrate resolve --applied 0_init`) then `apply-sql.sh`;
  CI uses the same script.
- **Manual migrations are forward-only** and must be committed the instant they
  are applied (past DB↔schema drift required the `022` reconciliation).

## 2. Frontend

- **Design system: single-source with a sync script (drift eliminated for `apps/*`).**
  `shared/` is the canonical source; `tools/sync-design-system.sh` copies the shared
  base (`tokens.css`, `foundation.css`, `ds-bridge.css`, `icons.js`) into each app,
  and a CI job (`design-system`) fails on any drift. No bundler/build step is
  introduced (each app is still a standalone static site). Per-app **intentional**
  deltas stay app-owned: `apps/*/css/theme.css` (the app's theme, loaded right after
  `tokens.css`) and the ESM-vs-global form of `icons.js` (customer imports it as a
  module; the panels load it via a classic `<script>`, so the sync strips `export`).
  **(still open)** `demo-mvp/*` and `standalone/*` are not yet covered by the sync.
- **`standalone/` and `demo-mvp/` are generated/duplicate frontends.** They can
  fall out of sync with `apps/*`. `standalone/` should be regenerated via
  `tools/build-standalone.py` after front-end changes. **(the standalone bundle
  works because module state is merged into one scope; the ES-module apps use
  setter functions instead — keep both patterns consistent.)**
- **No client-side test coverage beyond E2E.** Only Playwright E2E covers the
  customer app; business/company panels have **no automated tests**. **(uncertain)**
- **`apps/business/src-v2/*.jsx`** (a React dashboard) appears to be a
  preview/experiment not wired into the shipping vanilla-JS panel. Clarify its
  status or remove to avoid confusion. **(uncertain)**
- **Service-worker cache discipline is manual.** Forgetting to bump
  `CACHE_VERSION` ships stale assets to returning users.

## 3. Backend / Domain

- **No repository layer.** Services call Prisma (and raw SQL) directly. This is
  pragmatic but couples domain logic to the ORM and complicates unit testing
  (mitigated in the reservation engine via a DI port).
- **Reservation status enum carries legacy values** (`arrived`,
  `cancelled_by_user`, `cancelled_by_restaurant`) kept for backward compat with
  existing rows — a source of subtle bugs if new code forgets them. The
  "active-status set" (`reservation-status.ts`) must stay complete.
- **Queue is Postgres-based.** Great for consistency/idempotency, but every
  drain is a DB write burst; at very high job volume a dedicated broker
  (Redis/SQS) may be warranted.
- **Cron fan-out endpoints do bounded-concurrency loops** over all restaurants
  (e.g. waitlist maintenance). At large tenant counts these need pagination /
  work-sharding to stay within request timeouts. **(scalability)**

## 4. Security (open recommendations)

- **Token revocation — verified, ۲۰۲۶-۰۸-۱۴.** `POST /auth/logout` revokes the
  refresh token's `jti` (`revokeRefreshToken`); `POST /auth/refresh` checks
  `isRefreshRevoked` on every call and re-reads `Staff.isActive`/user ban
  status live from the DB (not from the stale refresh payload), revoking and
  rejecting immediately if the account is now disabled or banned. **Residual
  risk (accepted, not a bug):** an already-issued **access** token stays valid
  for its own TTL (`signAccess` → `expiresIn: '15m'`) — a deactivated
  staff/banned user can still use a *not-yet-expired* access token for up to
  15 minutes after logout/ban. No access-token denylist exists (would need a
  cache lookup on every request); the 15-minute window was judged an
  acceptable trade-off. Revisit only if a specific incident needs a shorter
  window.
- **`localStorage` tokens** are XSS-exposed; every front-end `innerHTML` sink
  must escape user data (`esc()`).
- **RLS is partial** (started in `manual/023`); not all tenant tables have it.
- **Rate-limit fail-open** (when Redis is down) reduces to a per-process
  in-memory floor — multi-instance deployments then allow `max × instances`.

See [SECURITY.md](./SECURITY.md) §11 for the full list.

## 5. Data / Migrations

- **`schema.prisma` had real drift from the live DB** (fields/FKs that existed
  only in Postgres) — reconciled in `022`, but the pattern (raw-SQL tables added
  without Prisma models) can recur. Keep every table represented in the schema.
- **Partitioning is not enabled** (`reservations`, guide `011`). `011` is a
  `-- @manual-only` scaffold — its data-copy and table-rename steps are commented
  out and it guards itself with a `RAISE EXCEPTION` unless
  `rezervno.allow_partitioning` is set. It has never been applied: on production
  `reservations` is a plain table (`relkind='r'`), and `POST /v1/maintenance/
  ensure-partitions` is a no-op that returns `{ok:false, reason:'partitioning not
  enabled'}` because the `ensure_reservation_partition` function does not exist.
  A missed cron run therefore **cannot** break inserts. If partitioning is ever
  adopted, note that `011`'s partition constraint was aligned to the canonical
  `no_table_overlap` (`tsrange(slot_start, block_end)` + active-status filter).
  **(future)**

## 6. Observability

- **Some fail-open paths are log-only** (rate-limit degradation, auto-bans).
  Add alerting so silent Redis outages are noticed.
- Metrics endpoint is public unless `METRICS_TOKEN` is set — set it in prod.

## 7. Testing / CI

- **`test` job depends on `--test-force-exit`** because a module opens a Redis
  client that keeps the process alive; ideally the queue/redis client should be
  closable in tests (explicit teardown) rather than force-exiting.
- **E2E fully mocks the API** — it validates the customer UI/flows but not the
  real API contract end-to-end. Consider a small contract/integration suite
  against a real backend.
- No `e2e/package-lock.json` committed yet (CI note) — E2E installs are
  unpinned.

## 8. Scalability Concerns (summary)

| Area | Concern | Mitigation present | Further work |
|---|---|---|---|
| DB connections | Pool exhaustion under load | Pooled URL + `DB_CONNECTION_LIMIT`; optional read replica | Tune per traffic; add PgBouncer if not on Supabase pooler |
| Reservations | Double-booking under concurrency | Redis slot lock + exclusion constraint + serialization retry | Load-test hot restaurants; watch `CONCURRENCY_RETRY` rate |
| Job queue | DB write pressure | SKIP LOCKED, priority, backoff, DLQ | Broker if volume grows |
| Cron fan-out | Per-tenant loops | Bounded concurrency | Shard by tenant / paginate |
| Redis outage | Rate-limit weakens | In-memory floor | Alert + HA Redis / cluster |
| Front-end DS | Copy drift | — | Package/sync the design system |

## 9. Product / Feature Gaps (as observed)

- Chat is **polling-based** (no websockets) — fine for MVP, higher latency/load
  at scale.
- Payments are Zarinpal-only; refund flow exists as a `DepositStatus.refunded`
  state but the automated refund path is **(uncertain)**.
- Several restaurant-panel RBAC permission mappings are inferred; confirm the
  exact `permission` key per route against the handlers.
