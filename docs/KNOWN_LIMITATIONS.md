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
- **Waitlist guest tokens are hashed at rest — fixed, PR #16 (۲۰۲۶-۰۸-۱۴).**
  The guest-access token issued at `joinWaitlist` (migration `041`) used to be
  stored as plaintext in `waitlist_entries.guest_access_token`. It's now
  stored only as `guest_access_token_hash` (`sha256(token + JWT_SECRET)`, the
  same pattern as `otp_codes.code_hash`) via migration `044`, which also
  drops the old plaintext column. A DB leak (backup, SQLi, insider access)
  can no longer be used to directly extract and replay an active guest's
  token. The client-facing shape is unchanged — `guest_token` is still
  returned once, raw, at join time.
- **Booking-domain P0s (lifecycle bypass, merge double-booking, cross-tenant
  preorder, waitlist IDOR, ban coverage gaps, walk-in/maintenance guards) —
  closed, PR #13.** See [SECURITY.md](./SECURITY.md) §11 for what's
  implemented and how it's verified.
- **`localStorage` tokens** are XSS-exposed; every front-end `innerHTML` sink
  must escape user data (`esc()` — unit-tested, `api/tests/esc.test.mts`,
  PR #16).
- **RLS is partial** (started in `manual/023`); not all tenant tables have it.
- **Rate-limit fail-open — now observable, residual-hardening PR
  (۲۰۲۶-۰۸-۱۴).** When Redis is down, the fallback to a per-process
  in-memory floor (`max × instances` under multi-instance deployment) is
  **unchanged as policy** — that trade-off is still accepted — but it now
  emits `rezervno_rate_limit_fallback_total` (labels: `prefix`, `scope`) and
  a structured `rate_limit: Redis در دسترس نیست...` warn log on every
  fallback, plus `rezervno_rate_limit_auto_ban_total` /
  `rezervno_ban_check_fail_open_total` for the auto-ban and ban-check
  fail-open paths. **A real bug was fixed alongside this**: route-level
  `enforceRateLimit` (used by ~59 route handlers via
  `withRestaurantAuth`/`withStaffAuth`) had **no fallback at all** — a Redis
  outage turned into an uncaught throw → a generic error response, not the
  documented fail-open floor. Only the global `middleware.ts` path had the
  in-memory fallback. Both paths now share one implementation
  (`rateLimitWithFallback` in `ratelimit.ts`). Operators must still wire an
  alert on these metrics themselves — none exists yet.
- **Full `innerHTML`/`insertAdjacentHTML`/`document.write`/`eval` sink audit
  — done, residual-hardening PR (۲۰۲۶-۰۸-۱۴).** `tools/xss-sink-audit.mjs`
  automatically scans `apps/customer|business|company` + `shared/js`,
  classifies every sink, and fails (non-zero exit) on any `unsafe` one. As
  of this pass: **zero unsafe sinks** — 8 real gaps were found and fixed
  (unescaped restaurant name in 3 places, an AI-generated dashboard insight,
  a mission title/description, a badge name, 3 photo-URL `src=` attributes,
  a pricing-rule label), the rest were either already safe or reclassified
  with a written justification (`MANUAL_REVIEW_OVERRIDES` in the script; see
  `docs/XSS_SINK_AUDIT.md`). The scanner is heuristic (regex, not real
  dataflow) and is **not wired into CI** — it must be re-run by hand;
  wiring it into the `security` CI job is a natural follow-up.
- **Merge-occupancy concurrency race (P0-3) — proven live, residual-hardening
  PR (۲۰۲۶-۰۸-۱۴).** Two genuinely simultaneous
  (`Promise.all`, real Postgres, not sequential/mocked) `createReservation`
  calls contending for the same secondary merge table were run repeatedly;
  Postgres's existing `Serializable` isolation + the in-transaction
  `getOccupiedTableNumbers` re-check (already present before this PR)
  correctly allow exactly one to succeed every time, with the loser getting
  a structured `409`-family error, never a double-booking. This is now a
  permanent test (`api/tests/table-merge-occupancy-concurrency.test.mts`),
  not a one-off script. **No production code changed for this** — the
  existing design was already correct; only the live proof was missing.
  A narrow TOCTOU window remains *theoretically* possible outside what was
  tested (documented in `table-occupancy.ts`) but is no longer an untested
  claim for the scenario that matters most.
- **Payment idempotency (P0-9) is still code-reviewed/unit-tested only, not
  exercised live** — needs a real Zarinpal `merchant_id`, not available in
  this environment.

See [SECURITY.md](./SECURITY.md) §12 for the full recommendations list.

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

- ~~`test` job depends on `--test-force-exit`~~ **Fixed (2026-08-13).** That flag
  was itself the cause of flaky `# tests`/`# suites` counts between identical
  runs (fail always 0, but totals varied — e.g. 314 vs 332): `tsx --test`
  isolates each of the 23 `tests/*.test.mts` files (at the time) in its own
  child process, and force-exit killed each child right as its own tests
  finished, racing its stdout pipe still flushing TAP output to the parent.
  First attempt used `--experimental-test-isolation=none` (Node 22+) — worked
  locally but broke CI outright (`bad option`, CI pins Node 20). Final fix is
  version-agnostic: `npm test` now runs a single wrapper file
  (`tests/_all.runner.mts`) that imports every test file for its side
  effects, so `tsx --test` only ever sees one file — no subprocess-per-file,
  no race, no experimental flag, no Node-version dependency. `redis.ts` also
  gained `lazyConnect: true` so importing it no longer opens a live socket
  for typing-only imports.
- **3 test files existed but were silently never run — fixed, PR #16
  (۲۰۲۶-۰۸-۱۴).** `ban.test.mts`, `crm-recommendations.test.mts`, and
  `customer-intelligence.test.mts` were never `import`ed into
  `tests/_all.runner.mts` — the single wrapper file above only runs what it
  explicitly imports. `npm test` had silently never executed them; a PR body
  had claimed "375/375 passing" when the real count (without those 3 files)
  was 352. All `tests/*.test.mts` files (28 as of PR #16) are now imported;
  `npm test` reports 392/392, stable across consecutive runs.
- **`npm test` could hang indefinitely after a test opened a real DB/Redis
  connection — fixed, PR #16 (۲۰۲۶-۰۸-۱۴).** `db.ts`/`redis.ts` close their
  connections on `process.once('beforeExit', ...)`, but an open Redis socket
  is itself a pending handle that keeps Node's event loop from ever reaching
  the empty state `beforeExit` requires — a deadlock no test file had
  triggered until the first real-Postgres integration test
  (`table-merge-occupancy.test.mts`) was added; all prior test files were
  pure-logic and never opened a live connection. Fixed with an explicit,
  unconditional `db.$disconnect()`/`redis.quit()` in `_all.runner.mts`'s
  top-level `after()` hook. The underlying `beforeExit` reliance inside
  `db.ts`/`redis.ts` themselves is **unchanged** — the same deadlock remains
  a latent risk for any other standalone script/worker that opens a live
  Redis connection and doesn't call `process.exit()` itself. **(follow-up)**
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
