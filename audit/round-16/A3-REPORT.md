# A3 — FEATURE-CENSUS-COMPANY — Round 16 report (2026-09-03)

**Looked at:** `HEAD` = `dbec99f` on `feat/admin-totp-login` (includes flag commit `d1e7365`).
**Method (override for this run):** static trace only — source `file:line` plus read-only commands (`grep`, `ls`, `git show`, `python tools/build-standalone.py --check`). No API started, no DB touched, no `npm test`, no docker. `ADMIN_LOGIN_ENABLED` / `OTP_DEV_MODE` were **not** exercised at runtime; behaviour is stated per source branch.
**Machine-readable output:** `audit/round-16/A3.json` (81 census items, 14 findings, secret-echo map).

## 1. Coverage

| | |
|---|---|
| Elements / flows enumerated | **81** (`items_total`) |
| Verified by static trace | **81** (`items_verified`) |
| Unverified | 0 |
| Classes | REAL 70 · PARTIAL 7 (C19, C23, C24, C33, C35, C62, C70) · DEMO-ONLY 1 (C07) · FAKE 0 · DEAD 3 (C79–C81) |
| Findings | blocker 0 · major 8 · minor 6 |

Enumeration source: `apps/company/index.html` (15 nav views, logout, burger, search, banner, modal, `?api=` bootstrap) plus every `onclick=`, `addEventListener(`, `API.*` and `fetch(` in `apps/company/js/*.js` (3 280 lines, 15 files, script order `index.html:168-181`).

## 2. Both admin login paths (HEAD)

| Path | UI | API | Gate | Verdict |
|---|---|---|---|---|
| Username + password (+ TOTP when server says so) | `intelligence.js:851-924`; TOTP input only created in DOM when `GET` returns `totp_required` (`:853-860`) | `POST /api/v1/auth/admin/login` → `password-auth.ts:49-76` → tenant/role/isActive re-check `login/route.ts:66-68` → `admin-totp.ts:102-120` | rate limits `passwordLogin` (always) + `adminTotpLogin` 5/15 min per IP and per user when TOTP on (`login/route.ts:56-59`) | **REAL**. Uniform `invalidCredentials` for wrong password and wrong/missing TOTP (`:76-81`), mirrored client-side (`:919-922`). Secret never leaves env. |
| OTP (SMS) | «ورود با پیامک» button built **only** when `GET /auth/admin/login` says `otp_login_enabled` (`intelligence.js:872`, default `false` `:849`, fetch failure → `false` `:888-889`) | `POST /auth/admin/request` / `verify` | `admin_otp_login_enabled` in `DEFAULT_OFF` (`feature-flags.ts:55-58`); both routes throw `Err.notFound` **before** rate-limit/body parse (`request:52`, `verify:28`) → 404, not 403 | **REAL, gated OFF by default**. When ON it issues the platform-admin principal **without TOTP** (`verify:35-45`) — documented by design (`feature-flags.ts:48-54`). |
| Offline / `file://` demo | `intelligence.js:914,918,947-949,979-982,987-989` → `enterAdminPanel(true)` | none | — | **DEMO-ONLY**, labelled ([DEMO] names, banner, toast `:1010-1021`) — **but** the `res.offline` branch also fires on an http(s) deployment (finding A3-002). |

`GET /auth/admin/login` (`login/route.ts:124-137`) returns only two booleans; unauthenticated and unlimited (A3-014, informational).

## 3. Findings

| id | sev | claim (evidence in A3.json) |
|---|---|---|
| A3-001 | major | Feature-flag panel never renders `admin_otp_login_enabled`: client map has 6 keys (`intelligence.js:451-461`, iterated `:467`) vs 7 server keys (`feature-flags.ts:12-20`, label `:30`). The OTP kill-switch cannot be seen or toggled from the UI although `GET /admin/feature-flags` returns it (`route.ts:22-23`). Mandate §6 check **fails**. |
| A3-002 | major | http(s) login: API unreachable/timeout → operator lands in the DEMO dashboard instead of an error with retry (`intelligence.js:918`, `:952-958`, `:987-989`), contradicting `api-core.js:17-19`. Labelled, so not fake success, but it masks a production outage at the entry point. |
| A3-003 | major | After session restore `rOverview()` runs synchronously (`intelligence.js:1055`) before `/admin/restaurants` resolves (`:1057`), with `RESTAURANTS = RESTAURANTS_SAMPLE` (`data.js:17`): fabricated KPI totals (8 / 5 128 / 12 712 / 28 940) are shown **without** the offline banner (`API.online` still true, `api.js:184-187`) for up to the 8 s timeout. Only list names carry `[DEMO]`. |
| A3-004 | major | Five views derived from `RESTAURANTS` (overview `overview.js:8`, restaurants `:90`, analytics `restaurant.js:135`, billing `intelligence.js:45`, support `:203`) have **no loading and no error+retry state**; any `GET /admin/restaurants` failure (500, 401-after-refresh …) substitutes the `[DEMO]` dataset (`api.js:171-182`). Financial buttons then target demo ids 1..8 → server 422 (`zUuid`) → error toast. |
| A3-005 | major | Provisioning success modal says the invite «ارسال شد» (`overview.js:270`; resend `restaurant.js:178`) while the API only **enqueued** the job (`provisioning.ts:218-241`, `restaurants/route.ts:122` returns `invite_sent_to` unconditionally). Missing `MELIPAYAMAK_BODYID_INVITE` (`sms.ts:69,279-284`) or credentials (`:246-257`) only log/metric; no status read-back. → PARTIAL, broken link = enqueue ≠ delivery. |
| A3-006 | major | The 409 `duplicate_owner_phone` text (client `overview.js:236`, server `provisioning.ts:114,195`) tells the admin to use «افزودنِ شعبه» — no such control exists; `API.adminCreateBranch` (`api.js:68`) has zero callers while `POST /admin/restaurants/[id]/branches` is fully implemented (`branches/route.ts:25-38` → `provisioning.ts:335-385`). Dead end. |
| A3-007 | major | Standing decision "owner password system-generated + shown once + forced change" is **not implemented**: credentials optional and admin-typed (`restaurants/route.ts:71-72`, `provisioning.ts:120-132`), never sent by this UI (`overview.js:250-259`); no forced-change field in `schema.prisma` (only `passwordUpdatedAt:113`); staff-credentials form shows the typed password in a `type="text"` input (`restaurant.js:90`) and relies on out-of-band handover. |
| A3-008 | major | P0-007 still open: `platform_settings` values written/read as plaintext (`platform-settings.ts:24-28`, `:14-20`); header declares intent to store the SMS key there (`:6-8`); `GET /admin/settings` returns raw `zarinpal_merchant_id` (`settings/route.ts:33-37`). Mitigation today: Melipayamak creds are env-only (`sms.ts:244-245`) and **no company-panel screen consumes `/admin/settings`** (grep 0 hits). |
| A3-009 | minor | Dead wrappers `api.js:68,113,114` (`adminCreateBranch`, `photoQueue`, `photoDecide`); photos.js calls `API.get/patch` directly. |
| A3-010 | minor | `toggleRestOpen` (`restaurant.js:121-132`) deactivates a live restaurant with no confirm/lock; `doCancel` (`intelligence.js:186-193`), `saveEconomyRules` (`:544-550`), badge/mission create have no double-submit lock. All server-audited. |
| A3-011 | minor | Error shown but no in-place retry: customers `intelligence.js:13`, systemhealth `:231`, aihealth `:349`, security top-level `:561`, customer360 `:713`, badges `badges.js:14`, missions `missions.js:14`, credentials `restaurant.js:64-65`. |
| A3-012 | minor | Provisioning `Idempotency-Key` built from `Date.now()+Math.random()` (`overview.js:211`) instead of shared `genIdempotencyKey()` (`api-core.js:106-117`); server scopes per admin (`route.ts:89`) so collisions are negligible. |
| A3-013 | minor | Admin access/refresh JWTs in `localStorage` (`api.js:19-22`); refresh re-checks `isActive` (`refresh/route.ts:49-61`). Informational. |
| A3-014 | minor | `GET /auth/admin/login` unauthenticated, unlimited, discloses two booleans (`login/route.ts:124-137`). Informational. |

No blocker: no fake success was found (every green toast/modal follows a real 2xx; 409/422/offline paths show errors), and every admin route is guarded.

## 4. Secret-echo map (every place UI or API exposes a secret)

| where | what | API returns raw? | verdict |
|---|---|---|---|
| `apps/company/js/intelligence.js:970` (fed by `:957`) | OTP `devCode` / demo `۱۲۳۴` rendered in login card | yes when `OTP_DEV_MODE=true` (`request/route.ts:77` → `otp.ts:146-160`); production guard throws `otp.ts:151-152` | by design (CLAUDE.md); path 404-gated by default |
| `apps/company/js/restaurant.js:90` | `#credPass` is `type="text"` — admin-typed business password visible on screen | **no** — `POST` response `staff-credentials/route.ts:167-173` has no password; `GET` returns `has_password` only (`:53`); audit excludes it (`:157-165`) | UI-side exposure only; see A3-007 |
| `api/src/app/api/v1/admin/settings/route.ts:33-37` | raw `zarinpal_merchant_id` | yes (plaintext DB) | no company-panel consumer; see A3-008 |
| `api/src/app/api/v1/auth/admin/login/route.ts:124-137` | `totp_required`, `otp_login_enabled` | booleans only; `ADMIN_TOTP_SECRET` never returned (`admin-totp.ts:64-70`; no route references it) | not a secret |
| `apps/company/js/overview.js:266-273` | provisioning success: masked phone + slug | response carries `owner.username` (`restaurants/route.ts:119`), never a password (`provisioning.ts:223-231`) | no secret echoed |
| `apps/company/js/api.js:19-22` | JWTs in localStorage | expected | A3-013 |

## 5. Verified OK (positive evidence)

- **All 39 admin route files / 52 exported handlers call `await requireAdmin(req)`** inside each `*_impl` (per-file skeleton grep; e.g. `photos/[id]/route.ts:34,102`, `site/[collection]/[id]/route.ts:30,44,84`). `requireAdmin` re-reads `staff` from DB (`admin-auth.ts:59-68`). No admin route missing it.
- Provisioning honesty on 409: `duplicate_owner_phone / slug_unavailable / username_taken / branch_limit_reached` mapped to inline Persian errors, submit re-enabled, **no green toast** (`overview.js:235-240, 276-279`); `Idempotency-Key` sent and mandatory (`api.js:64-66`, `restaurants/route.ts:87-92`, replay before body parse).
- Photo and hours queues: honest four states with retry; offline sample labelled `[DEMO]` and decision buttons blocked (`photos.js:157-160, 207-211`; `hours.js:143-146, 193-197`); sidebar badges never filled from sample (`photos.js:94`, `hours.js:84`).
- Sales queue: no sample data by design (`sales.js:12-13`); independent inquiry error with retry (`:89-92, 187-193`); activation audited with optimistic lock (`site-orders.ts:527-620, 588`).
- Security page: fail-open removed — unknown state explicit for flags / moderation queue / banned IPs / economy editor (`intelligence.js:581, 661, 531-533`); catch-all prevents infinite loading (`:662-665`).
- Writes audited: feature flags, economy rules, badges, missions, ban/unban, abuse flags, photos, hours, control, SMS top-up, provisioning (`feature-flags.ts:75`, `economy-rules.ts:46`, `badges.ts:30/48/65/78`, `missions` routes `:51/:64`, `ban.ts:48/65`, `fraud.ts:273/329`, `photos/[id]:71/118`, `hours-changes/[id]:82/110`, `control:48/62/86/95`, `sms:41`, `provisioning.ts:207/316/378`).
- `python tools/build-standalone.py --check` → **exit 0** (`standalone/company.html` matches source; warning about `website.html` is out of scope).
- Injection scan (instruction-like text) over `apps/company`, `audit/round-15`, admin routes and traced libs → **0 hits**. No `console.log` in the panel (only `console.error` at `intelligence.js:663`).
- Flag commit `d1e7365` verified via `git show --stat` (touches login/request/verify routes, feature-flags.ts, intelligence.js, standalone build, integration test `api/tests/admin-otp-flag.integration.test.mts`).

## 6. API surfaces with no company-panel UI

`GET /admin/restaurants/[id]/sms` (balance history), `GET/PATCH /admin/settings`, `GET /admin/telemetry`, `/admin/site/[collection](/[id])` CMS collections, `POST /admin/restaurants/[id]/branches` (A3-006). These are backend-only from this panel's point of view and were not counted as census items.

## 7. Notes on method limits

- `apps/company` has zero automated UI tests (mandate fact); this run adds none and executes nothing.
- `ui_states.empty = true` is also used where an empty state is not applicable (buttons/modals); missing empty states on list views are set to `false` and named.
- Delivery of the invite SMS, TOTP verification and OTP flag state were verified **from source only**; A6 owns the DB/runtime for this round.
