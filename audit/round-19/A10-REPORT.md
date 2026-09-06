# A10 (LAUNCH-OPS) — Round 19 — Vercel/Sentry/SMS/Backups/Monitoring/Load/Rollback plan

**Agent:** A10 · **Model:** claude-sonnet-5 · **Round:** 19 · **Mode:** PLAN + VERIFY only, read-only on repo and on Vercel/Sentry (list/find tools only). No resource was created, deployed, bought, or modified. No repo file was edited.

Full machine-readable plan: [`A10-PLAN.json`](./A10-PLAN.json). This report is the narrative walk-through with the same evidence.

---

## 0. The one thing that changes everything else: architecture conflict

The mission asks for a 4th Vercel project (the API). Repo docs disagree on whether the API is *supposed* to run on Vercel at all:

- `docs/DEPLOY_API_VERCEL.md` is explicitly marked `ARCHIVED-SNAPSHOT` at the top and defers to newer docs on conflict.
- `docs/DEPLOYMENT.md:96-113` (last touched 2026-09-02, more recent) states plainly: **"the API is not deployed to Vercel"** — production is a long-lived Docker container behind Caddy (`deploy/caddy/Caddyfile`), and `cron/crontab` is "the single source of truth for scheduling."
- `cron/crontab:1-13` itself carries a header explaining `api/vercel.json` was deliberately deleted 2026-08-28 for exactly this reason (git commit `3422936`).

Vercel is still documented as one of "two supported deployment models" (`docs/DEPLOYMENT.md:4`), so this isn't a dead option — it's just not what's currently live. **This must be resolved by the founder before project #1 is created** (founder_actions #1), because it determines whether cron needs to move to Vercel Cron or stay on the self-hosted container.

---

## 1. Vercel — 4 projects, env vars, cron

**Live MCP reads (read-only):**
- `list_teams` → `team_gLTPq1IJB0ayoC3NsDE4yoXg` ("ardalanaz2-4503's projects", hobby plan)
- `list_projects` for that team → **0 projects**, confirming the mission's stated baseline

**4 projects to create:**
1. **API** — Root Directory `api`, Framework Next.js (must be picked manually — no `api/vercel.json` exists to auto-detect), Node 20.x (from `api/Dockerfile:2,17` and CI's `node-version: '20'`, 8 occurrences in `.github/workflows/ci.yml`). `api/package.json` has **no `engines` field** — recommend adding one so the version is pinned rather than relying on Vercel's default.
2-4. **rezervno-customer / -business / -company** — Root Directory `apps/customer|business|company`, no build (static, per CLAUDE.md's "no bundler" rule).

**"Second frontend tree" landmine — checked, RESOLVED:** the root `.vercelignore`'s own comment confirms it stopped excluding `apps/` after the frontend move ("پس از انتقال فرانت‌اند به apps/، دیگر apps را ignore نمی‌کنیم"). It still (correctly) excludes `api`, `deploy`, `backup`, `observability`, `cron`, `loadtest`, `e2e`, `docs`, `shared`, `tools`, `standalone`, `demo-mvp`, `.github`, `docker-compose*.yml`, `*.md`. No stray `vercel.json` exists except `apps/landing/vercel.json` and `apps/seo/vercel.json` (Glob-confirmed). The old duplicate `apps/business/src-v2` tree the landmine language evokes was already deleted at commit `95e95f1`. One residual unverified risk: since `.vercelignore` is always root-relative regardless of a project's Root Directory, whether Root Directory=`api` interacts oddly with the root file's own `api` exclusion can only be confirmed by an actual first build log.

**Env vars — 54 found via `grep -rhoE "process\.env\.[A-Z_0-9]+" api/src | sort -u`, cross-checked against `docs/ENVIRONMENT.md`:**

| Class | Count | Vars | Evidence |
|---|---|---|---|
| **required-at-boot** | 5 | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS` | `jwt.ts:29-30,34-35` throw if unset/short; `middleware.ts:45-61` throws in prod; `db.ts:73` and `redis.ts:89` have no fallback |
| **infra-only** | 6 | `DB_CONNECTION_LIMIT`, `DB_POOL_TIMEOUT`, `DATABASE_REPLICA_URL`, `REDIS_CLUSTER_NODES`, `REDIS_COMMAND_TIMEOUT_MS`, `REDIS_CONNECT_TIMEOUT_MS` | pool/cluster tuning, safe defaults |
| **optional** | 43 | everything else (15 `MELIPAYAMAK_BODYID_*`/creds, Zarinpal, email, Sentry, metrics, cron/maintenance keys, etc.) | graceful degradation confirmed per-var in code |

**Docs vs. code gaps found:**
- **11 vars used in code but undocumented** in `docs/ENVIRONMENT.md`: `ADMIN_LOGIN_ENABLED`, `ADMIN_TOTP_SECRET`, `ADMIN_TOTP_USERNAME`, `BREAK_GLASS_CODE`, `BREAK_GLASS_PHONE`, `INVITE_BASE_URL`, `MELIPAYAMAK_BODYID_INVITE`, `REDIS_COMMAND_TIMEOUT_MS`, `REDIS_CONNECT_TIMEOUT_MS`, `SALES_NOTIFY_EMAIL`, `UPLOAD_DIR`.
- **`FCM_SERVER_KEY` is documented but dead** — `docs/ENVIRONMENT.md` implies push is toggle-disabled without it, but `grep -rn FCM_SERVER_KEY api/src` returns **zero matches**. Push isn't gated on this var, it simply isn't wired to anything.
- `DATABASE_DIRECT_URL` is documented as inert and independently confirmed inert (absent from the code grep too).

**Cron:** No Vercel cron config exists today. The 9 maintenance jobs (`waitlist`, `jobs-drain`, `lifecycle`, `reminders`, `expire`, `rewards`, `customer-insights`, `retention`, `ensure-partitions` — all 9 routes confirmed to exist under `api/src/app/api/v1/maintenance/`) are scheduled by `cron/crontab` calling them with header `x-maintenance-key`. The auth check is `guardMaintenance()` at **`api/src/lib/maintenance-auth.ts:27-53`**: accepts either `x-maintenance-key: <MAINTENANCE_KEY>` (constant-time compare, lines 29-32) or `Authorization: Bearer <CRON_SECRET>` (the header Vercel Cron auto-injects, constant-time since a 2026-08-21 fix, lines 45-48); anything else → 401. If the API moves to Vercel, `api/vercel.json`'s `crons` array would need to be recreated (9 entries) and the self-hosted cron container disabled to avoid double-firing.

**Verification steps written** (curl-based, 4 checks: no header → 401, right `x-maintenance-key` → 200, right `Authorization: Bearer $CRON_SECRET` → 200, wrong key → 401) — see `A10-PLAN.json.vercel.cron.verification_steps_401_without_secret_200_with_secret`.

---

## 2. Sentry — integration EXISTS, hand-rolled, no SDK

**Live MCP reads:** `find_organizations` → org `rezvno` (region `https://de.sentry.io`); `find_projects` for that org → **0 projects**, confirming the mission baseline.

**Yes, Sentry code integration exists** — this is not a "no integration" case. `api/src/lib/logger.ts:35-53` implements a direct-`fetch()` sink against Sentry's legacy Store API (no `@sentry/node` SDK): parses `SENTRY_DSN` (line 37) with a regex, builds `https://<host>/api/<project>/store/?sentry_key=<key>&sentry_version=7`, and POSTs a JSON envelope for every `warn`/`error`-level log (gated at line 38), fire-and-forget from `emit()` (line 109). Sensitive fields (passwords, tokens, phone, allergy/dietary data, etc.) are redacted via the same `safeMeta()` used for normal logs (lines 63-73) before being sent to Sentry, so the redaction discipline already covers this sink.

**Plan:** create exactly one Sentry project (platform: node) — no frontend code references Sentry anywhere (`grep -rln Sentry api apps` confirms only `logger.ts` hits) — set `SENTRY_DSN` on the API host, verify by triggering a warn/error path and confirming the event lands. One caveat flagged as unverified: whether the legacy `/store/` endpoint still accepts events for a brand-new 2026 Sentry project (vs. requiring the newer envelope API) can't be confirmed without actually creating the project.

---

## 3. SMS (Melipayamak)

Pattern-send path (`api/src/lib/sms.ts`): `bodyIdFor()` (lines 47-69) maps each of 15 templates to its own `MELIPAYAMAK_BODYID_*` env var; the request goes to `BaseServiceNumber` (lines 74, 285) with `{username, password, to, bodyId, text: tokens.join(tokenSep())}`. Fail-closed acceptance is `meliAccepted()` (lines 101-106): only `RetStatus === 1`, or (legacy fallback) `Value > 1000` as a real recId, counts as success — everything else, including a bare 2xx with an ambiguous body, is treated as failure.

Full proof procedure written (no send performed): trigger a real OTP send (synchronous path, `sms.ts:227`) or a queued template (via the `jobs` table, `schema.prisma:1235-1256`, checking `status`/`result`/`last_error`), then confirm via server logs (`RetStatus`/`Value`, `sms.ts:288-297`) and the `rezervno_sms_sent_total` metric — **an HTTP 2xx alone is explicitly not proof**, since `meliAccepted()` can reject a 2xx body.

**Key rotation status: NOT DONE / unconfirmable from the repo** — recorded as blocker B1, matching a prior round's independent finding ("چرخشِ کلیدِ ملی‌پیامک … فقط شما" — only the founder knows). Also flagged: `MELIPAYAMAK_TOKEN_SEPARATOR` (default `;`) is explicitly marked unverified in the code's own comments — Melipayamak doesn't publicly document multi-token separator behavior (blocker B3).

---

## 4. Backups / restore drill

A real backup pipeline already exists: `docker-compose.yml`'s `backup` service runs `backup/scripts/backup.sh` (pg_dump + gzip, size-sanity check, rotation via `BACKUP_KEEP`, separate media tar for the uploads volume, optional S3 upload) on `BACKUP_CRON` (default daily 3am). `backup/scripts/restore.sh` replays the dump via `psql`. **Gap found:** no automated restore drill exists anywhere in the repo — the restore path has never been proven to work end-to-end. A full drill procedure against a scratch DB (fingerprint before backup → backup → destroy volume → restore → re-fingerprint, must match exactly) is written out in the plan. No production DB is reachable from this machine, so this can only be rehearsed, not validated against a real production backup (blocker B4).

---

## 5. Monitoring

`/api/metrics` protection (`api/src/app/api/metrics/route.ts:33-50`): unset `METRICS_TOKEN` → 503 in production (fixed from a prior fail-open bug, documented in the file's own comment), constant-time Bearer compare when set. Rate-limit fail-open (`ratelimit.ts:49-53`, plus an in-memory second fallback layer) and auto-ban (`ratelimit.ts:215-246`, threshold 10 violations/5min → 1h ban, with its own fail-open path for the ban-check itself) are both real and both instrumented with counters.

**Gap found:** `observability/alerts.yml` already has 11 solid Prometheus rules (availability, security, queue, notifications, payments, business) — but **none of them cover the 3 metrics that exist specifically for these fail-open/auto-ban paths**: `rezervno_rate_limit_fallback_total`, `rezervno_ban_check_fail_open_total`, `rezervno_rate_limit_auto_ban_total` (all defined `metrics.ts:144-146`, all actively incremented in code). An active DDoS being auto-banned, or a Redis outage silently degrading both rate-limiting and the ban check, currently raises no alert.

---

## 6. Load test

A k6 suite already exists (`loadtest/k6-load-test.js`, `k6-scale-400k.js`, `k6-security-probe.js`, `README.md`) — both load scripts explicitly and deliberately skip the reservation **write** path ("مسیرهای نوشتنی … عمداً اینجا نیستند"). The plan adds that missing scenario: `POST /api/v1/reservations` (schema at `route.ts:22-42`), needs a real customer JWT + unique `Idempotency-Key` per iteration, must respect `RULES.reservation` (10/min per IP, enforced before body parsing), and — for the deliberately-contested single-slot case — success criteria are "exactly one 201, everyone else a clean 409, zero 500s" rather than a flat p95, mirroring `TX_MAX_RETRIES = 5` (`reservations.ts:60`) and the documented real incident behind `Err.concurrencyRetry()` (`errors.ts:46`, thrown at `reservations.ts:261,313`).

---

## 7. Rollback runbook

Vercel: Instant Rollback to the previous immutable deployment (`docs/DEPLOYMENT.md:172-174`); self-host: redeploy the prior image tag. DB migrations are forward-only by policy; reviewed `075-079` individually — none contain destructive DDL (`grep` confirmed, only a non-destructive DROP+ADD CONSTRAINT in `065`). **`079` carries a mandatory pre-deploy precondition** (a duplicate-owner-phone check query) that has only ever been run against dev DBs, never production — flagged as blocker B5, must be re-run and recorded clean before `079` ever touches a real environment.

---

## Coverage

34 evidence items identified, 31 independently verified against source or live MCP reads, 3 explicitly unverifiable from this machine (Sentry legacy endpoint acceptance, Vercel .vercelignore/Root-Directory interaction, Melipayamak token separator) — all three carried into `unverified` in the JSON rather than asserted.
