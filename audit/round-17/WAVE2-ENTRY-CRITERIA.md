# Wave 2 — entry criteria (Phase 3: A4 backend-correctness ‖ A5 security) — **APPROVED by founder 2026-09-03 (directive 3, item 7)**

Model discipline (§0.2, amended 2026-09-03): A4 and A5 are Tier 1 → `claude-opus-5`, set explicitly on the Agent call; the CEO stays on `claude-opus-5` for all remaining rounds (Fable reserved for the final GO/NO-GO synthesis only); every report carries a `model` column. CEO spot-check ≥20% of each agent's rows before acceptance.

## Founder order 3 (2026-09-03) — added to A5 scope, mandatory
`ALLOWED_ORIGINS` missing in production currently **warns and disables the CSRF Origin check** (`api/src/middleware.ts:45-48`) — fail-open. A5 must make it **fatal at boot in production** (fail-closed): a startup assertion (e.g. Next `instrumentation.ts` `register()` or the first-loaded env module) that refuses to boot when `NODE_ENV=production` and `ALLOWED_ORIGINS` is unset/empty. Falsifiable proof required: (a) unit test importing the assertion with `NODE_ENV=production` and the var unset → throws; set → passes; (b) process-level: `NODE_ENV=production ALLOWED_ORIGINS= npm run start` (or `node` on the built server) → **EXIT≠0** with a clear message; with the var set → boots. Record both exit codes.

## Hard gates that must be TRUE before Wave 2 starts

| # | Criterion | How it is verified | Status 2026-09-03 |
|---|---|---|---|
| E1 | PR #81 merged to `main` at `580cf7f` | `git merge-base --is-ancestor 580cf7f origin/main` | pending (founder) |
| E2 | `audit/launch-hardening` rebased/merged on latest `main`, PR open, CI green (12/13 + Sourcery skipped) | check-runs on the PR head | pending (founder opens PR) |
| E3 | CI-hardening falsifiability proof recorded: hang commit → `test` red ≤15 min; next push cancels the previous run; revert → green | `audit/round-16/ci-hardening-proof.json` with run ids + conclusions | pending (needs E2) |
| E4 | A6 (opus) report accepted: hang root cause reproduced red locally (exit 124 at the same stall point), watchdog proposal proven red→green, §8 sweep complete, mutation round done | `audit/round-16/A6.json`, CEO spot-check ≥20%, 0 rejections | in progress |
| E5 | Runtime smoke pass executed for the 55 REAL-STATIC rows against real API + DB — per-row PASS/FAIL recorded; rows relabelled REAL only on PASS | `audit/round-16/runtime-smoke-plan.json` → `runtime-smoke-results.json` | pending (DB owned by A6) |
| E6 | Local test DB rebuilt CI-faithfully before Wave-2 agents touch it (`staff=0 tables=72 idx079=1`) | reset recipe in `local-test-infra` memory / A6 mandate | on demand |

## Soft gates (may run in parallel with Wave 2 but must not block its start)

| # | Item | Owner |
|---|---|---|
| S1 | **P0-014 DECIDED (2026-09-03).** Founder chose **Postgres inside the existing Docker stack** for launch (Supabase Pro kept as a later fallback). Supabase **leaves the critical path** — the restore + password reset is cancelled, and P0-014 folds into **P0-017** (no production infrastructure exists). Live drift + RLS now run against a **production-shaped** Postgres (built `db push` → `apply-sql.sh` → fixups), not against the paused project. | CEO runs the drift/RLS pass on the production-shaped DB; the three hard conditions stay open (see L1) |
| S2 | Melipayamak key rotation — written confirmation | founder |
| S3 | A10 (sonnet) wiring plan accepted → Vercel ×4 projects + Sentry project created by founder with the exact settings | founder + A10 plan |

## Hard **launch** gate added by founder directive 4 (2026-09-03) — not a Wave-2 entry gate

| # | Criterion | How it is verified |
|---|---|---|
| L1 | **Production DB tier/host is decided and provably non-pausing.** ✅ *Decided 2026-09-03: Postgres in the Docker stack (`docker-compose.yml:12-26` + backup service `:137-167`).* **Still open as a gate:** (a) an **executed** restore drill — dump → restore into an empty DB → row-count comparison → exit code recorded (B4 states this has never run against a real production backup); (b) **off-host** backup copies — the `S3_*` fields exist but are empty; (c) uptime + disk alerting before launch. | *Provable non-pausing* = the stack answers a **real query** (never `get_project`) after a documented idle window, raw result recorded. |

**RLS caveat (P0-021, verified 2026-09-03):** RLS is enabled on 34+ tables with **zero policies** and the backend connects as the **owner** role, which bypasses RLS (`grep 'CREATE POLICY' api/prisma/sql/*.sql` → 0; `FORCE ROW LEVEL SECURITY` → 0; `037-rls-core-tables.sql` says so itself). The RLS pass therefore proves *defense-in-depth is declared*, **not** that a DB-level tenant boundary works — the real boundary is application-layer and belongs to A5's isolation matrix. No report may cite "RLS enabled" as isolation evidence.

**New standing rule for every agent (landmine list):** never declare a live-infrastructure fact from control-plane metadata alone — `get_project`/`list_projects` status is cached and was **STALE** here (`ACTIVE_HEALTHY` while `execute_sql` returned `28P01` and `get_advisors` said *hibernated*). Cross-check with a data-plane query and record the raw output. Zero-trust applies to founder statements too: the founder's own correction on this item was withdrawn by the founder after re-testing.

## Wave 2 scope handed to A4 / A5 (inputs already verified — do not re-derive)

**A5 SECURITY (opus)** must take as given and close:
- P0-007 / A3-008: `platform_settings` plaintext (`api/src/lib/platform-settings.ts:23-28`) → encryption at rest, key only in env, UI never echoes raw secrets; migration in `api/prisma/sql/080-*.sql` (idempotent) + `schema.prisma` in sync + `schema-drift` green.
- A3-007: initial owner password must be system-generated, shown once, forced change on first login (`api/src/app/api/v1/admin/restaurants/route.ts:71-72`, `lib/provisioning.ts:120-132`) — schema field + flow + tests.
- A3 secret-echo map: `admin/settings/route.ts:33-37` returns raw `zarinpal_merchant_id`; OTP `devCode` only under `OTP_DEV_MODE` (keep, verify prod guard `lib/otp.ts:151-152`).
- A1-001: customer SW caches authenticated `/api/v1/me/*` GET responses (`apps/customer/sw.js:52-56, 68-80`) → exclude auth'd API from `cache.put` + `CACHE_VERSION` bump.
- 🔴 **Tenant-isolation matrix — SCOPE ELEVATED by founder directive 5, order 3 (2026-09-04).**
  Because RLS is inert (P0-021 — 61/73 tables RLS-enabled, **zero policies**, app connects as
  owner+`SUPERUSER`+`BYPASSRLS`), the application-layer matrix is now the **SOLE** tenant boundary.
  There is no second line behind it. Therefore:
  - **Exhaustive, zero sampling:** every `/restaurant/*` **and every `/admin/*`** route × cross-tenant
    token → `FORBIDDEN_TENANT`. Machine-generated from the route tree (Tier-3 haiku may generate the
    call list), run against the real API — not a representative subset.
  - **Raw output recorded per row.** A row without its actual response body/status is not evidence.
  - **Any gap is a BLOCKER, not a major** — including a route the generator could not classify. An
    unclassified route is a gap, not a pass.
  - A route that is legitimately tenant-agnostic must be named and justified individually; a silent
    skip is the escape hatch that CLAUDE.md rule 5 forbids.
- RBAC map per `route.ts` (`withRestaurantAuth({permission})`) vs `API_REFERENCE.md` "(uncertain)" rows.
- Refresh-token principal preservation (`auth/refresh`), rate limits (`RULES.*`), audit-log coverage on admin/lifecycle mutations.

**A4 BACKEND-CORRECTNESS (opus)** must take as given and close:
- Concurrency: double-booking prevention proven by a real concurrent test (parallel POSTs on one slot) — exclusion constraint + slot lock + `CONCURRENCY_RETRY` observed; reuse the fault-injection pattern of `admin-create-business` (hold a transaction open, prove the waiter in `pg_stat_activity`).
- Lifecycle: every transition vs `lib/lifecycle.ts` incl. legacy statuses (`arrived`, `cancelled_by_user`, `cancelled_by_restaurant`) in every active-status set.
- Availability boundaries (the `<` vs `<=` class — CLAUDE.md rule ۵: absence of the boundary slot must FAIL the test).
- Queue/worker: `enqueueSms` → job → transport fail-closed (`meliAccepted`), retry/DLQ; `fetch` stubbed (rule ۶).
- Idempotency: `Idempotency-Key` on provisioning and reservations (`withIdempotency`) — replay returns byte-identical body.
- Business-panel PARTIAL rows from Phase 1 that are backend-side: A2-003 (`restaurant_id` from body vs auth ctx — verify the tenant validation at `reservations/route.ts:22,100-101`), A2-014 (pagination >100/day silently truncated), A2-005 (status PATCH ordering).

## Exit criteria of Wave 2 (Phase-3 gate)
`audit/round-17/backend.json` + `security.json`: all blockers fixed via `audit/launch-hardening` PRs; isolation matrix 100% pass; concurrency proof recorded with live `pg_stat_activity` evidence; encryption-at-rest migration applied to the local DB and `schema-drift` green; CEO spot-check ≥20% per agent with 0 rejections.
