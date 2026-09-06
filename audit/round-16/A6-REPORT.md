# A6 — TEST-INTEGRITY — Round 16

**Agent:** A6 (Tier 1) · **Model:** `claude-opus-5`
**Branch:** `audit/launch-hardening` @ `59d1921` · **Date:** 2026-09-03
**Mandate:** `audit/round-15/agents/A6-MANDATE.md`

Everything below is backed by a recorded **exit code**, never by the last line of a log
(CLAUDE.md rule ۱). Raw evidence lives in `audit/round-16/A6-logs/`; proposed (uncommitted)
fixes live in `audit/round-16/A6-proposals/`.

---

## 0. Baseline and worktree discipline

`git status --short` at start (written to `audit/round-16/A6-baseline.txt`):

```
?? audit/round-16/A6-baseline.txt
?? audit/round-16/A6-proposals/
?? audit/round-16/A6.json
?? docs/ml/
```

Every temporary mutation in this report was applied to a **byte copy** taken first, and
restored by copying that byte copy back — never `git checkout --`. Each restore is
sha1-verified in the corresponding log.

---

## 1. Task #1 — the hang (P0-005, blocker) — A6-001

### (a) Local RED reproduction — **EXIT = 124**

Reproduced first-hand this round on a from-scratch DB (`db push` + `apply-sql.sh` +
`test-schema-fixups.sql`, verified `tenants=0, tables=72`), with the P0-002 bug
byte-identically re-introduced into the root-level `after()` of
`api/tests/provision-slug-validation.integration.test.mts`:

```diff
-    const rids = (await db.restaurant.findMany({ where: { tenantId: t }, select: { id: true } })).map(r => r.id);
-    await db.auditLog.deleteMany({ where: { restaurantId: { in: rids } } });
+    await db.auditLog.deleteMany({ where: { restaurant: { tenantId: t } } });
```

| step | command | exit | elapsed |
|---|---|---|---|
| reset | drop/create + db push + apply-sql + fixups | 0 | 4 m 44 s |
| inject | sha1 `2737584d…` → `8b1bf347…` (same sha1 as the earlier run — identical mutation) | — | — |
| **repro** | `timeout 600 npm test` | **124** | **600 s** |
| kill + conns | `pg_stat_activity` for `rezervno_test` | 0 | — |
| restore | byte copy back → sha1 `2737584d35a69851a64d43be3f5ceafb560b547a` (identical) | — | — |

**Stall point** (`A6-logs/task1a-r16-hang.log`, 3980 lines):

```
3926  ✖ .../api/tests/provision-slug-validation.integration.test.mts (44.2214ms)
3936  ✖ failing tests:
3970  Unknown argument `restaurant`. Did you mean `restaurantId`?
      at async TestContext.<anonymous> (.../provision-slug-validation.integration.test.mts:97:5)
      at async TestHook.run   (node:internal/test_runner/test:1404:7)
      at async Test.runHook   (node:internal/test_runner/test:1284:9)
      at async after          (node:internal/test_runner/test:1337:9)
```

…and then **nothing for the remaining ~590 s** until `timeout` killed it.

**Why this is a hang and not a slow test.** node:test had already printed the
`✖ failing tests:` summary — the *test run finished*. What never finished is process exit.
The `after()` threw inside `TestHook.run`, so node:test stopped executing root-level `after`
hooks — and the **only** code that closes Prisma and Redis is itself a root-level `after`, at
the tail of the runner:

```js
// api/tests/_all.runner.mts:227-234
import { after } from 'node:test';
after(async () => {
  const { db } = await import('../src/lib/db.ts');
  const { redis } = await import('../src/lib/redis.ts');
  await db.$disconnect().catch(() => {});
  await redis.quit().catch(() => { try { redis.disconnect(); } catch { /* */ } });
});
```

One thrown hook therefore skips the only teardown, the open Prisma/Redis handles keep the
event loop non-empty, and `npm test` — which has **no** `--test-force-exit` — never exits.
In CI that meant 360.5 min of runner time (run `33706516188`, job `test`, 02:09:08Z →
08:09:42Z, `conclusion=cancelled`) before GitHub's own default cap.

### (b) Runner-level watchdog — red→green, proven

The guard is 21 lines appended to `api/tests/helpers/test-env.mts` — the file the runner
already imports first (`_all.runner.mts:55`) — kept as an uncommitted proposal at
`audit/round-16/A6-proposals/test-env-watchdog.patch`:

```ts
const WATCHDOG_MS = Number(process.env.TEST_WATCHDOG_MS ?? 10 * 60_000);
if (WATCHDOG_MS > 0) {
  setTimeout(() => {
    const open = process.getActiveResourcesInfo?.() ?? [];
    process.stderr.write(`\n✖ TEST WATCHDOG: the suite is still alive after ${WATCHDOG_MS} ms ` +
      `— treating as a hang (P0-005). Open handles: ${JSON.stringify(open)}\n`);
    process.exit(1);
  }, WATCHDOG_MS).unref();   // ← unref'd: cannot keep a healthy run alive, never fires on green
}
```

| run | setup | expected | **exit** | elapsed |
|---|---|---|---|---|
| **R2 (red)** | watchdog applied + scratch `tests/zz-a6-scratch-hang.test.mts` doing `await new Promise(() => {})`, imported immediately after `test-env.mts`; `TEST_WATCHDOG_MS=60000` | 1 | **1** | **63 s** |
| **R3 (green)** | watchdog applied, scratch removed, default 10-min budget, unmodified suite | 0 | **0** | 161 s |

R2's stderr line — note it *names the leaked handle*, which is what makes it debuggable rather
than merely fatal:

```
✖ TEST WATCHDOG: the suite is still alive after 60000 ms — treating as a hang (P0-005).
  Open handles: ["PipeWrap","PipeWrap","TCPSocketWrap"]
✖ tests\_all.runner.mts (61020.1218ms)
```

R3: `tests 1528 · suites 359 · pass 1528 · fail 0 · cancelled 0 · skipped 0 · todo 0`,
`watchdog_fired=0`. `test-env.mts` restored to sha1 `fb2a1ec74e07155d977fa0bf26dd24fa4b057387`
(identical).

**Chain summary:** `R1(hang, no guard)=124 · R2(watchdog + hang)=1 · R3(watchdog + clean)=0`.
Full transcript: `audit/round-16/A6-logs/task1-r16-chain.log`.

### What is already fixed, and what still is not (A6-002 / A6-015)

The CEO's commit `b28271e` is verified present in the worktree:

```yaml
# .github/workflows/ci.yml:13-15
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
# .github/workflows/ci.yml:64  (job `test`)
    timeout-minutes: 15
```

That caps the *cost* of a hang. It does not make a hang *diagnosable*: a cancelled CI job
gives no open-handle list and no local signal at all. The watchdog is the complement — it
turns the same hang into a red exit with the leaked handle named, in 63 s, on a developer's
machine before it ever reaches CI. **A6-015** remains open: 10 of the 12 jobs still have no
`timeout-minutes`, and the runner-imports CI step from `ci-hang-guard.patch` was not applied.

---

## 2. Task #2 — ambient-env dependency (A6-016, A6-017)

### The mechanism nobody pinned: Prisma loads `api/.env` for you

`node_modules/.prisma/client/index.js:1523` calls `warnEnvConflicts(...)` → `tryLoadEnvs`,
which runs **dotenv** over `api/.env`. So the moment any test imports the generated client,
these appear in `process.env` — non-overriding, therefore invisible to `??=` pins that ran
earlier. Measured (`A6-logs/task2-ambient-env.log`, values redacted):

| var | before client import | after client import |
|---|---|---|
| `PLATFORM_ADMIN_TENANT_ID` | unset | **SET** |
| `OTP_DEV_MODE` | unset | **true** |
| `ADMIN_TOTP_USERNAME` / `ADMIN_TOTP_SECRET` | unset | **SET** |
| `ALLOWED_ORIGINS` | unset | **SET** |
| `ADMIN_LOGIN_ENABLED` | false (pinned) | false (pin holds) |

`api/.env` is uncommitted and **does not exist in CI**. Any test that *reads* one of these
without pinning it asserts against a different value locally than in CI.

**Unpinned readers (offenders):**

| file:line | var read ambiently |
|---|---|
| `api/tests/auth-guards.integration.test.mts:42` | `PLATFORM_ADMIN_TENANT_ID` |
| `api/tests/sms-unparsable-response.test.mts:35-37` | `MELIPAYAMAK_USERNAME` / `_PASSWORD` / `_BODYID_OTP` |

`ADMIN_LOGIN_ENABLED` is already correctly pinned twice — `tests/helpers/test-env.mts:21`
(hard `=`, deliberately, imported at runner line 55) and `tests/password-login.integration.test.mts:11`.

### The bigger structural problem: `=` vs `??=` in a single-process runner

ESM hoists **all 153 imports before any test runs**, so every module-scope assignment lands
first and the *last* hard `=` wins for the whole suite. Counts across `api/tests`:

- **134** hard `process.env.X = …` lines in **63** files
- **30** `process.env.X ??= …` pins in **17** files

The `??=` files believe they are respecting an ambient value that a hard `=` already clobbered.
120 of the hard lines are the harmless `JWT_SECRET`/`JWT_REFRESH_SECRET` boilerplate. The
**14 that actually leak across files** and are never restored:

```
tests/auth-otp-enumeration.integration.test.mts:14   OTP_DEV_MODE = 'true'
tests/otp-ratelimit-and-deadlock.integration.test.mts:7  OTP_DEV_MODE = 'true'
tests/staff-invite-flow.integration.test.mts:13      OTP_DEV_MODE = 'true'
tests/payments.integration.test.mts:9                ZARINPAL_MERCHANT_ID = 'test-merchant-id'   ← money
tests/zarinpal.test.mts:8                            ZARINPAL_MERCHANT_ID = 'test-merchant-id'   ← money
tests/payments.integration.test.mts:8                NEXT_PUBLIC_APP_URL
tests/table-qr-checkin.integration.test.mts:7        NEXT_PUBLIC_APP_URL
tests/table-qr-regenerate.integration.test.mts:7     NEXT_PUBLIC_APP_URL
tests/photo-moderation.test.mts:8                    UPLOAD_DIR = '/data/uploads'
tests/telemetry-retention.integration.test.mts:9-11  TELEMETRY_RETENTION_{ANON,AUTH,VERIFIED}_DAYS
tests/password-login.integration.test.mts:11         ADMIN_LOGIN_ENABLED = 'false'   (intentional)
tests/helpers/test-env.mts:21                        ADMIN_LOGIN_ENABLED = 'false'   (intentional)
```

The sharpest one: **`OTP_DEV_MODE='true'` is globally on for the entire run.** Any test that
believes it is exercising the *production* OTP path (where the code is not returned) is
actually running in dev mode. `sms-transport-failclosed.integration.test.mts:73,101` is the
only file that saves and restores it.

**Proposal.** Extend `tests/helpers/test-env.mts` (already imported first by the runner) into
the single pin point: hard-set `OTP_DEV_MODE`, `PLATFORM_ADMIN_TENANT_ID`, `MELIPAYAMAK_*`,
`ZARINPAL_MERCHANT_ID` and `ADMIN_TOTP_*` there, then add a lint rule / CI grep forbidding
`^process\.env\.` writes outside `tests/helpers/`. Files that need a different value must
save-and-restore inside their own hook, the way `sms-transport-failclosed` already does.

---

## 3. Task #3 — shared-state sweep (§8.7)

86 files declare root-level `before`/`after`/`beforeEach` outside any `describe`. In a
single-process runner these interleave across files. What they mutate that another file can
observe:

| global | files | observable by others? |
|---|---|---|
| `process.env` (module scope, never restored) | 63 — see §2 | **yes**, for the whole run |
| `platform_settings` rows + their 30 s Redis cache | `feature-flags` (`clearFlags` at root `before`+`beforeEach`), `admin-otp-flag`, `auth-otp-enumeration` | **yes** — this is the P0-004 sibling: `feature-flags`' root-level `clearFlags()` wiped the flag `auth-otp-enumeration`'s root `before()` had just set |
| `globalThis.fetch` | 7 files | **no** — all 7 capture and restore; `email-transport-honesty.test.mts:59-69` even re-reads it at install time rather than import time, exactly to survive interleaving |
| Redis, wiped by **wildcard** | 5 live sites | **yes** |
| fixed phone numbers | 3 files | **yes**, and across runs |

**Wildcard Redis wipes still live (A6-019):**

```
tests/admin-otp-flag.integration.test.mts:46   redis.keys('*platform-settings*')
tests/admin-otp-flag.integration.test.mts:80   redis.keys('*otp*')
tests/events-restaurant-slug.integration.test.mts:49,57  redis.keys('*events*')
tests/admin-totp-login.integration.test.mts:69
tests/sms-transport-failclosed.integration.test.mts:90
```

The repo has already been burned twice by exactly this and left comments saying so
(`tables.integration.test.mts:121` — a `clearRateLimit()` that did `redis.keys('*auth*')`
globally; `qr-checkin.integration.test.mts:68` — a global `rl:srch:*` wipe). The pattern
survives in five more places.

**Fixed identifiers that are not `fixturePhone()`-unique (A6-018):**

```
tests/auth-otp-enumeration.integration.test.mts:61-65,110,113-116   09121000001 … 09121000005
tests/member-create.integration.test.mts:128,138                    09121110001, 09121110002
tests/observability-coverage.test.mts:233,249                       09121110000, 09121110001   ← collides with member-create
```

`otp_codes.phone` is UNIQUE (migration 079), so any crashed run leaves rows that make the
next run fail — this *is* P0-003. Two different files also share the `0912111000x` block.
The helper that solves it (`tests/_phone.helper.mts` `fixturePhone()`) already exists and is
used by `business-panel-contract` and `loyalty-club-points`.

---

## 4. Task #4 — anti-pattern sweep (§8)

### What came back clean — and why that is a real result, not a shrug

| §8 category | verdict |
|---|---|
| `.skip` / `.todo` / `.only` in `api/tests` | **zero**. e2e has one conditional `test.skip(!!isMobile, …)` (`e2e/tests/panels-batch14-regression.spec.ts:275`) with a stated CSS reason — legitimate. |
| Mocking the unit under test | **zero** `mock.method` / `mock.fn` / `mock.module`. Every stub is `globalThis.fetch` — the external boundary — and all 7 files that install one restore it. `email-transport-honesty.test.mts:59-69` even captures it at *install* time rather than import time, precisely so interleaving cannot poison it. |
| Silent early returns (CLAUDE.md rule ۵) | one grep hit, `dna-summary.integration.test.mts:166` `if (!out.available) return;` — but it sits **immediately after** `assert.equal(out.available, true)` on L165, so it is a TypeScript narrowing no-op, not an escape hatch. Clean. |
| Fully-mocked E2E claiming API coverage | the two new specs mock everything, but neither *claims* API coverage — see A6-022 below. |
| Runner import completeness (mandate task 5) | 153 import lines vs 152 `tests/*.test.mts`. The 153rd is `./helpers/test-env.mts`, **not a duplicate** (`sort \| uniq -d` → empty). The "153 vs 152" discrepancy is explained, not a defect. |

### A6-020 — the one trivial assertion

`api/tests/economy-ledger.integration.test.mts:338` is `assert.ok(true)`, the only one in 152
files. Its stated claim ("an invalid phone must not break the main flow") *is* carried by the
absence of a throw, so it is not fake-green. But a **partial** regression — where
`processReservationEconomyEvent` returns early and silently skips the whole economy flow —
passes it. Proposed killing assertion: assert the reservation reached `completed` **and** that
`economy_ledger_entries` has 0 rows for it, reusing the exact `$queryRaw` already at L323-325.

### A6-021 — `test:one` and `test` disagree about force-exit

```
api/package.json:14  "test":     "tsx --test --test-reporter=spec tests/_all.runner.mts"
api/package.json:22  "test:one": "tsx --test --test-force-exit"
```

A file that leaves a handle open passes green under `test:one` and hangs the full runner —
exactly the P0-005 class. The runner's own comment (`_all.runner.mts:6-8`) documents the
race; the divergence is still live.

### A6-022 — the new e2e specs mock the whole API surface

Both `e2e/tests/business-password-login.spec.ts:25` and
`e2e/tests/business-reservations-row-identity.spec.ts:40` end their route handler with
`return route.fulfill(json({ ok: true }));` — a catch-all for `**/api/v1/**`. Every endpoint
they do not name returns a shape the real API never returns. Their own assertions are honest
(each asserts the exact request that was sent, and the login spec additionally asserts
`pageErrors` contains no `ReferenceError`), so this is a **scoping** limit, not a fake green —
but it means neither spec can ever catch a real response-shape change. That is the gap task #9
below is scoped to close.

### A6-023 — a surviving mutant in the reservation path (**major**)

Proven by running the new A2-002 spec against three different mutations
(`A6-logs/task4-e2e-falsifiability.log`, all on `--project=desktop-chrome`):

| mutation | exit | result |
|---|---|---|
| baseline, unmodified | **0** | 2 passed |
| **MUT-A** delete `RES_VIEW=source;` (`reservations.js:65`) — the CEO's own mutation | **1** | `Expected "/restaurant/reservations/UPC1/status"` / `Received ".../TODAY1/status"` |
| **MUT-B** revert `markArrived`/`markNoShow`/`cancelRes` to `RES[i]`, leave `data.js` fixed | **0** | **SURVIVED** |
| **MUT-C** `data.js` `changeStatus()` `(RES_VIEW\|\|RES)[i]` → `RES[i]` | **1** | same red |
| restore both files, re-run | **0** | 2 passed; `git diff --stat apps/business/js` empty |

The spec is red-able, but only through **one** of the four handlers the fix touched. The PATCH
it asserts on is produced by `changeStatus()` in `apps/business/js/data.js`; the three readers
in `reservations.js` are unpinned. A regression confined to `markArrived` still:

- sends the **welcome SMS to the wrong guest's phone** — `reservations.js:186` `const phone=r.phone`, then `:190` `API.sendSms({kind:'campaign', phones:[phone…]})`; and
- offline, enqueues an Outbox `PATCH /restaurant/reservations/${r.code}/status` against the wrong reservation (`reservations.js:183`).

…and the spec stays green. CLAUDE.md rule ۳: the real regression is always partial.

**Proposed killing assertions:** (1) assert the welcome-SMS POST body carries the *upcoming*
guest's phone `09121111111`, not `09122222222`; (2) a second spec that goes offline and
asserts the queued Outbox path contains `UPC1`.

---

## 5. Task #6 — Prisma-client staleness guard (A6-014)

`audit/round-16/A6-proposals/check-prisma-client-fresh.mjs`, re-verified green this round
(`EXIT=0`, "Prisma client matches prisma/schema.prisma (1530 normalised lines)").

Red→green already proven (`A6-logs/task6-prisma-fresh.log`): appending a real
`model A6ScratchModel` to `prisma/schema.prisma` **without** `prisma generate` → `EXIT=1`
naming the three missing lines; byte-restore → `EXIT=0`.

**The lesson worth keeping (A6-014).** The first draft of this checker did a plain normalised
string compare and reported **STALE on a genuinely fresh client**, because Prisma *reorders*
back-relation fields inside the schema copy it embeds (first differing line #62:
schema `@@index([createdAt])` vs client `chatThreads ChatThread[]`). A gate that cries wolf
gets disabled, so it was rewritten as a **sorted multiset compare**. This is the mirror image
of the usual failure: not a gate that never goes red, but a gate that goes red for the wrong
reason.

Recommended wiring: `"pretest": "node ../tools/check-prisma-client-fresh.mjs"` — the whole
point is that a stale local client hides `PrismaClientValidationError`s that CI (where
`npm ci` regenerates) will surface, which is exactly how P0-002 reached `main`.

---

## 6. Task #8 — mutation round

Design: every mutation is **small and semantic** — the kind a real refactor produces — never
"delete the whole guard", because a regression that removes an entire escaper is not the one
that ships (CLAUDE.md rule ۳). Each target file is byte-copied first, mutated with a single
`perl -0pi`, the injection is verified by grep before the run, the designated test files are
run with a recorded exit code, and the file is restored from the byte copy and sha1-compared.

A **baseline** run of every target file set precedes the mutants, so a red can never be
mistaken for a pre-existing failure.

`EXIT != 0` = killed. `EXIT = 0` = **SURVIVED** = finding.

### Front-end (reservation path) — already run, see §4/A6-023

One survivor: **MUT-B**, the partial revert of the A2-002 fix.

### Method correction — two invalid results from the first pass are **not** reported as kills

The first mutation pass produced two kinds of bad evidence, and both are disclosed rather than
quietly dropped:

1. **Two baselines were RED before any mutation.** `B1` (feature-flags + admin-otp-flag) and
   `B2` (admin-totp-login + password-login + auth-guards) both exited 1 on the *unmutated*
   tree. Any `EXIT=1` from M1–M5 against those baselines proves nothing — the inverse of
   CLAUDE.md rule ۲.
2. **The injection checks for M3 and M6 were wrong.** Both used `grep` for a string that also
   occurs on a *different* line of the same file (`'admin_otp_login_enabled',` is also in
   `FEATURE_FLAG_KEYS`; `process.env.MELIPAYAMAK_BODYID_OTP,` is also at `sms.ts:55`), so both
   reported "INJECT FAILED" when the injection had in fact succeeded.

Everything was re-run against **per-file green baselines** with **diff-based** injection
verification (line counts printed to the log, plus the mutated function body echoed). Only the
REDO numbers appear below.

That correction produced a finding of its own — see A6-027.

### A6-027 — files that are green alone go red together (**major**)

Isolating the red baselines, one file per process, same env, nothing mutated:

```
b-feature-flags     alone  EXIT=0      pair (B1)   EXIT=1
b-admin-otp-flag    alone  EXIT=0
b-admin-totp-login  alone  EXIT=0      trio (B2)   EXIT=1
b-password-login    alone  EXIT=0
b-auth-guards       alone  EXIT=0
```

Five files, each green in isolation, red when sharing a process. Nothing was mutated. This is
A6-017 (module-scope `process.env` clobbering) and A6-019 (wildcard `platform_settings` /
Redis wipes) acting on each other — the same class as P0-004. It also means **per-file triage
gives a different verdict than the runner**, so "I ran just that file and it passes" is not
evidence about `npm test`.

### Back-end results (money / auth / provisioning)

`EXIT != 0` = killed · `EXIT = 0` = **SURVIVED** = finding. Full log:
`A6-logs/task8-mutations.log`.

| # | file:line | mutation | test(s) | exit | verdict |
|---|---|---|---|---|---|
| M1 | `lib/feature-flags.ts:64` | `return !DEFAULT_OFF.has(key)` → `return true` | feature-flags | 1 | killed — *"کلیدهای استثنا واقعاً پیش‌فرض خاموش‌اند (گاردِ پولِ رایگان)"* |
| M2 | `lib/feature-flags.ts:65` | `raw !== 'false'` → `raw === 'true'` | feature-flags | 1 | killed — *"فقط مقدارِ دقیقِ «false» خاموش است"* |
| M3 | `lib/feature-flags.ts:55-58` | drop `admin_otp_login_enabled` from `DEFAULT_OFF` | feature-flags | 1 | killed — same DEFAULT_OFF mirror test |
| **M4** | `auth/admin/login/route.ts:66` | drop `staff.role !== 'owner'` | 5 auth files | **0** | **SURVIVED** |
| M5 | `auth/admin/login/route.ts:73` | disable the TOTP third factor | admin-totp-login | 1 | killed — 3 tests |
| **M6** | `lib/sms.ts:215-221` | `smsTransportReady()` drops the `BODYID_OTP` requirement | sms-transport-failclosed | **0** | **SURVIVED** |
| M7 | `lib/sms.ts` bodyId guard | missing bodyId no longer aborts the send | 3 sms files | 1 | killed |
| M8 | `lib/provisioning.ts:137` | skip `SLUG_RE` validation | provision-slug-validation | 1 | killed |
| M9 | `lib/provisioning.ts:347` | branch limit `>=` → `>` | admin-branches | 1 | killed |
| **M10** | `lib/provisioning.ts:130` | drop the username-taken pre-check | provision-username-conflict | **0** | **SURVIVED** |
| M11 | `lib/zarinpal.ts:40` | `currency: 'IRT'` → `'IRR'` | zarinpal + payments | 1 | killed |

All five files restored and sha1-verified identical; `git diff --stat api/src` empty.

**The money path is protected.** M11 — the documented 10× bug — dies immediately.

#### A6-024 — surviving mutant in the **auth** path (major)

Deleting `staff.role !== 'owner'` from the platform-admin authorization is caught by **no
test**. Five separate files stayed green: `auth-guards` 0, `password-login` 0,
`admin-totp-login` 0, `admin-panel-contract` 0, `staff-auth-guard` 0.

With the guard gone, any *active staff row in the platform tenant* — `manager`, `staff`, any
role — holding a username and password gets a **200** with access + refresh tokens whose
principal hardcodes `role: 'owner'` (`route.ts:85`), plus an `auth.login` audit row asserting a
successful platform-admin login.

**It is not exploitable end to end** — `requireAdmin` re-reads the role from the database and
rejects:

```ts
// api/src/lib/admin-auth.ts:73
if (staff.role !== 'owner') throw Err.forbidden('دسترسی مدیر پلتفرم لازم است');
```

Defence in depth holds. What is missing is any test pinning the login route's *own* guard, and
the audit trail would record a lie. `auth-guards.integration.test.mts` even seeds a
`managerId` fixture ("same tenant, lower role") — but it exercises `requireAdmin`, never the
login route.

**Killing test proposed:** seed an active `role='manager'` staff in the platform tenant with a
password, `POST /auth/admin/login`, assert **403** *and* assert no `auth.login` audit row was
written.

#### A6-025 — surviving mutant in the **SMS/OTP** path (major)

Removing `MELIPAYAMAK_BODYID_OTP` from `smsTransportReady()` survives
`sms-transport-failclosed.integration.test.mts` — the file whose entire subject is fail-closed
SMS transport. The cause is its own helper:

```ts
// api/tests/sms-transport-failclosed.integration.test.mts:68-72
const setMeli = (on) => {
  for (const [k, v] of [['MELIPAYAMAK_USERNAME','u'],['MELIPAYAMAK_PASSWORD','p'],['MELIPAYAMAK_BODYID_OTP','12345']]) {
    if (on) process.env[k] = v; else delete process.env[k];
  }
};
```

It sets or deletes **all three together**, so `assert.equal(smsTransportReady(), false)` (L157)
only ever distinguishes *all configured* from *none configured*. The **partial** state the
function exists for — credentials present, bodyId missing — is never exercised.

That partial state is not hypothetical; it is the exact scenario the function's own doc comment
describes. In production it makes `otp.ts:142` pass, `requestOtp` return success, and
`sendSmsNow` then bail at its own `if (!bodyId)` guard. The user is told the code was sent, no
SMS ever arrives, **nobody can log in**, and every log looks clean. CLAUDE.md rule ۳ exactly:
the assertion catches total failure and misses the partial one.

**Killing test proposed:** set `MELIPAYAMAK_USERNAME` + `MELIPAYAMAK_PASSWORD`, **delete**
`MELIPAYAMAK_BODYID_OTP`, assert `smsTransportReady() === false`, and assert `requestOtp`
rejects with `SERVICE_UNAVAILABLE` in that state.

#### A6-026 — surviving mutant in provisioning (minor)

Dropping the pre-flight username-taken guard (`provisioning.ts:130`) survives, because the DB
unique constraint fires and `isUsernameUniqueViolation` (`:201`) maps it to the **identical**
`Err.conflict('username_taken')` 409. The test cannot tell the pre-check from the constraint.
Correctness is preserved by the constraint; what is lost undetected is a wasted scrypt hash and
a partially-started transaction. **Killing assertion:** assert no `Staff` row and no partial
`Tenant`/`Restaurant` were created.

---

## 7. Task #9 — contract-suite scoping (scope + falsifiability plan only)

**What exists.** `api/tests/business-panel-contract.integration.test.mts` (19 tests) and
`api/tests/admin-panel-contract.integration.test.mts` (8 tests). Both are strong where they
reach: they pin *non-null types of fields the panel actually reads*, they refuse to pass when a
fixture array is empty (CLAUDE.md rule ۵ applied on purpose), and `business-panel-contract`
documents three near-miss false divergences plus one deliberately-unpinned gap
(`avg_interval_days`, guarded client-side). This is the standard to extend, not replace.

**The gap, measured by grepping the panels' own path literals:**

| panel | distinct endpoint paths called | covered by a contract test | uncovered |
|---|---|---|---|
| `apps/business/js` | 45 | 19 (all GET shapes) | **26** |
| `apps/company/js` | 39 (`/admin/*`, `/auth/admin/*`) | 8 | **31** |

**Second gap: zero negative cases.** `business-panel-contract`'s single status assertion is
`assert.equal(res.status, 200, …)` inside its `ok()` helper (L150). Every one of the 19 tests
is a happy path. Nothing pins a 401/403/404/409 response *shape*, which is exactly what the
panels branch on (`details.reason` drives the Persian error text — see
`company-provisioning.spec.ts:101-115`).

**Third gap: no mutating endpoint is contract-tested.** Every uncovered path below changes
state, and each is reachable from a single click in the panel:

```
PATCH /restaurant/reservations/:code/status   ← the A2-002 path; only e2e-mocked today
POST  /restaurant/walkin
PUT   /restaurant/hours                        ← creates a pending approval
PATCH /restaurant/cashback
PATCH /restaurant/tables/:id/state
POST  /restaurant/chats/:id
POST  /restaurant/menu/categories | /menu | /menu/reorder | /menu/modifier-groups | /menu/modifier-options
PUT   /restaurant/profile · /restaurant/menu/branding
POST  /restaurant/staff · PUT /restaurant/staff/password
POST  /restaurant/branches
POST  /restaurant/sms                          ← spends money
GET   /restaurant/reservations/:code/events · /restaurant/assistant · /restaurant/heartbeat
```

**Proposed minimal spec — top 15 endpoints, one positive + one negative each.** Ranked by
blast radius (money / auth / reservation first), each as `status + response shape + one
negative`:

| # | endpoint | positive pins | negative case |
|---|---|---|---|
| 1 | `PATCH /restaurant/reservations/:code/status` | 200, `{status}` echoes the new status | code of another tenant → 404, not 403-leak |
| 2 | `POST /restaurant/sms` | 200, `{balance:number}` | missing bodyId env → non-2xx, never a green "sent" |
| 3 | `POST /restaurant/walkin` | 201, `{code:string}` | party_size over table capacity → 409 `reason` |
| 4 | `PUT /restaurant/hours` | 200, `hours_change_status='pending'` | overlapping ranges → 400 with field name |
| 5 | `PATCH /restaurant/cashback` | 200, echoed percent | percent > limit → 400 |
| 6 | `POST /restaurant/branches` | 201, `{slug}` | over `branchLimit` → 409 `branch_limit_reached` |
| 7 | `PUT /restaurant/staff/password` | 204 | weak password → 400 policy message |
| 8 | `POST /restaurant/staff` | 201 | duplicate username → 409 `username_taken` |
| 9 | `PATCH /restaurant/tables/:id/state` | 200 | table of another restaurant → 404 |
| 10 | `POST /restaurant/menu/categories` | 201 | duplicate name → 409 |
| 11 | `POST /restaurant/chats/:id` | 201, `{items[]}` grows | thread of another tenant → 404 |
| 12 | `GET /restaurant/reservations/:code/events` | 200, non-empty `items[]` with `at`,`actor` | unknown code → 404 |
| 13 | `GET /admin/feature-flags` | 200, all 7 `FEATURE_FLAG_KEYS` present | non-admin token → 403 |
| 14 | `POST /admin/restaurants/:id/resend-invite` | 200 | already-activated restaurant → 409 |
| 15 | `POST /admin/users/:id/ban` + `/unban` | 200, `is_banned` flips | self-ban → 403 |

**Falsifiability plan (how to prove the new suite is not decorative).** For each of the 15,
one representative mutation that must turn it red, run before the suite is trusted:

- #1 change the tenant filter in the status route from `ctx.restaurant.id` to the body value → cross-tenant PATCH succeeds → test must go red.
- #2 delete the `smsTransportReady()` guard → a 200 with no SMS → test must go red.
- #6 `>=` → `>` on `branchLimit` (mutation M9 below) → one extra branch allowed → red.
- #8 drop the `username_taken` conflict (mutation M10 below) → red.
- #13 remove `admin_otp_login_enabled` from `FEATURE_FLAG_KEYS` → red.
- For every negative case: change the thrown `Err.*` to a different code and confirm red — a
  negative test that only asserts "not 200" is not a contract.

---

## 8. Falsifiability table

Every row: a representative bug injected into the worktree, the gate's **exit code** while
broken, a byte-copy restore, and the exit code after. No bug was ever committed.

| # | gate | bug injected | red exit | reverted | green exit |
|---|---|---|---|---|---|
| 1 | **runner watchdog** *(proposed, `test-env-watchdog.patch`)* | scratch test `await new Promise(() => {})`, imported first, `TEST_WATCHDOG_MS=60000` | **1** (63 s, named the handles) | yes | **0** (1528/1528, 161 s, silent) |
| 2 | **the P0-005 hang itself, no guard** *(control)* | re-introduce `where: { restaurant: { tenantId: t } }` in `provision-slug-validation` `after()` | **124** (600 s) | yes | 0 |
| 3 | `schema-drift.integration.test.mts` | add `@@index([createdAt], map: "a6_scratch_drift_idx")` to `model Tenant` — declared in Prisma, in **no** `prisma/sql/*.sql` | 1 | yes | 0 |
| 4 | `tools/check-prisma-client-fresh.mjs` *(proposed pretest)* | append `model A6ScratchModel` to `prisma/schema.prisma` without `prisma generate` | 1 | yes | 0 |
| 5 | `tools/check-test-runner-imports.sh` *(proposed CI step)* | create `tests/zz-scratch-unimported.test.mts`, not imported by `_all.runner.mts` | 1 | yes | 0 |
| 6 | `sync-design-system.sh --check` | append a comment to `apps/company/css/tokens.css` | 1 | yes | 0 |
| 7 | `build-standalone.py --check` | append a comment to `apps/business/js/icons.js` | 1 | yes | 0 |
| 8 | `check-classic-scripts.sh` | stray `export` in `apps/company/js/hours.js` | 1 | yes | 0 |
| 9 | `xss-sink-audit.mjs --check` | new `document.body.innerHTML` sink in `apps/customer/js/main.js` | 1 | yes | 0 |
| 10 | `xss-escaping-regression.mjs` | drop `esc()` around `cuisine` in `discover.js` `cardHTML` | 1 | yes | 0 |
| 11 | `e2e business-reservations-row-identity.spec.ts` | delete `RES_VIEW=source;` (`reservations.js:65`) | 1 | yes | 0 |
| 12 | `e2e business-reservations-row-identity.spec.ts` | `data.js` `changeStatus()` → `RES[i]` | 1 | yes | 0 |
| **13** | `e2e business-reservations-row-identity.spec.ts` | **partial**: revert only the three `reservations.js` handlers | **0 — DID NOT GO RED** | yes | 0 |

Row 2 exists so that row 1 means something: without a control that reproduces the hang at
exit 124, "the watchdog turned it red" would be an untested claim about an untested guard.

Row 13 is the entry that matters most, and it is recorded rather than omitted. See A6-023.

---

## 9. Findings index

| id | sev | area | one-line |
|---|---|---|---|
| A6-001 | blocker | hang | thrown root `after()` skips the only DB/Redis teardown → runner never exits (exit 124 reproduced) |
| A6-002 | major | gate | `test` job had no timeout and no `concurrency` — **fixed & verified** in `b28271e` |
| A6-014 | minor | gate | Prisma-freshness checker v1 false-positived on a fresh client; fixed to sorted-multiset |
| A6-015 | major | gate | 10 of 12 CI jobs still have no `timeout-minutes`; runner-imports CI step not applied |
| A6-016 | major | env | Prisma client loads `api/.env`; 2 test sites read those vars unpinned |
| A6-017 | major | shared-state | 134 hard `process.env.X =` at module scope vs 30 `??=`; 14 leak across the whole run |
| A6-018 | major | shared-state | fixed phones instead of `fixturePhone()`; two files share `0912111000x` |
| A6-019 | minor | shared-state | 5 live wildcard Redis wipes inside one process |
| A6-020 | minor | anti-pattern | the single `assert.ok(true)` |
| A6-021 | minor | anti-pattern | `test:one` uses `--test-force-exit`, `test` does not |
| A6-022 | minor | anti-pattern | new e2e specs mock the entire API surface (scoping limit) |
| A6-023 | major | mutation | partial revert of the A2-002 fix survives the new regression spec |
| A6-024 | major | mutation | dropping the `role==='owner'` guard in admin login survives **all five** auth test files |
| A6-025 | major | mutation | `smsTransportReady()` losing its bodyId requirement survives the fail-closed test |
| A6-026 | minor | mutation | username pre-check survives (DB constraint returns the same 409) |
| A6-027 | major | shared-state | five files green alone, red together — empirical proof of A6-017/A6-019 |

**Totals:** 16 findings — 1 blocker, 9 major, 6 minor. 4 surviving mutants, 3 of them in
auth / SMS / reservation paths. 13 falsifiability rows, 12 proven red-able.

### The three that should gate launch

1. **A6-001** — the hang is real, reproduced at exit 124, and only its *cost* is capped today.
   Land the watchdog (proven red in 63 s, green at 1528/1528) so it is diagnosable, not just
   time-boxed.
2. **A6-025** — a partial SMS misconfiguration produces "code sent", no SMS, and nobody able to
   log in, with clean logs. No test covers it. One test closes it.
3. **A6-024** — the platform-admin role guard is pinned by nothing. The DB re-check saves it
   today; a refactor that trusts the login route would not be caught.

---

## 10. Proposals (uncommitted, in `audit/round-16/A6-proposals/`)

| file | what it does | proven? |
|---|---|---|
| `test-env-watchdog.patch` | 21 lines appended to `tests/helpers/test-env.mts`: an **unref'd** `setTimeout` (`TEST_WATCHDOG_MS`, default 10 min) that prints the open handles from `process.getActiveResourcesInfo()` and `process.exit(1)`. Unref'd means it can never keep a healthy run alive and never fires on green. | yes — §1(b) |
| `ci-hang-guard.patch` | `timeout-minutes` on the 10 uncapped jobs + the runner-imports CI step. **The `concurrency` block and the `test` timeout in this patch are already committed as `b28271e` — do not re-apply those hunks.** | partially superseded |
| `check-test-runner-imports.sh` | fails when a `tests/*.test.mts` is not imported by `_all.runner.mts` | yes — row 2 |
| `check-prisma-client-fresh.mjs` | fails when `node_modules/.prisma/client` was generated from a different `schema.prisma` | yes — row 1 |

Nothing here was committed, staged, or pushed. No branch was created or switched.

---

## 11. Prompt-injection watch

Per mandate, all repository content was treated as data. Across ~60 source, test, workflow and
spec files read this round, **no instruction-shaped content addressed to an agent was found**.
The Persian comments in `api/tests/**` and `apps/business/js/**` are engineering rationale
(they explain *why* a guard exists and cite the incident that produced it) — informative, not
directive. No finding.

---

## 12. Final worktree state

Start of round (`audit/round-16/A6-baseline.txt`) vs end of round:

```
BASELINE (15:24:35)                   FINAL
?? audit/round-16/A6-baseline.txt     ?? audit/round-16/A6-REPORT.md      ← mine
?? audit/round-16/A6-proposals/       ?? audit/round-16/A6-baseline.txt   ← mine
?? audit/round-16/A6.json             ?? audit/round-16/A6-proposals/     ← mine
?? docs/ml/                           ?? audit/round-16/A6.json           ← mine
                                      ?? docs/ml/                         ← not mine, untouched
```

`git status --short` **equals baseline plus my own `audit/round-16/A6*` outputs.**

**Disclosure — a transient entry I did not write.** At 16:05:58, while I was writing this
report, `audit/round-17/WAVE2-ENTRY-CRITERIA.md` appeared as ` M` in `git status`. It is not
mine — I never wrote anywhere under `audit/round-17/` — and its diff records the founder's
directive 3 (`ALLOWED_ORIGINS` fail-closed at boot, assigned to A5) plus the amended model
discipline. Per the rules I left it untouched; the concurrent writer resolved it themselves,
and the final status above no longer shows it. Recorded here so the sequence is not
reconstructed later as A6 collateral.

`git diff --stat` is **empty** for `api/src`, `api/tests`, `api/prisma`, `apps/`, `e2e/` and
`.github/` — every one of the 17 temporary mutations is fully reverted.
(`audit/round-16/A6-logs/` does not appear in `git status` because `*.log` is gitignored.)

Discipline actually followed, not merely intended:

- **No** `git add` / `commit` / `push` / `stash` / `checkout` / `branch`. Nothing staged.
- Every temporary mutation — 11 back-end, 3 front-end, 1 schema, 1 test file, 1 workflow-adjacent — was applied to a **byte copy taken first** and restored by copying that byte copy back, then **sha1-compared**. `git checkout --` was never used.
- `api/.env` never modified. No files created outside `audit/round-16/A6*` and the scratchpad.
- Every DB reset was preceded by `SELECT count(*) FROM pg_stat_activity WHERE datname='rezervno_test'` returning **0**. Four resets, all exit 0, each verified at `tenants=0 / tables=72`. Final state left clean.
- Every `npm test` ran under `timeout 600`; every exit code was written to the log **before** any log text was read. Exit 124 was treated as a hang, never as "the last line looked fine".
- The one leftover runner (R1's hang) was killed with the scoped PowerShell filter (`tsx|_all\.runner`); `conns after kill = 0`.

### Evidence index

| file | contents |
|---|---|
| `A6-logs/task1-r16-chain.log` | task #1 chain — R1=124, R2=1, R3=0, resets, restores |
| `A6-logs/task1a-r16-hang.log` | the 3980-line hang transcript; stall at L3926 |
| `A6-logs/task1b-r16-watchdog-red.log` / `-green.log` | watchdog red (63 s) / green (1528/1528) |
| `A6-logs/task8-mutations.log` | 11 back-end mutants + the REDO pass + the schema-drift gate |
| `A6-logs/task4-e2e-falsifiability.log` | MUT-A/B/C on the A2-002 spec |
| `A6-logs/task2-ambient-env.log` | before/after Prisma-client env measurement |
| `A6-logs/task5-runner-imports.log`, `task6-prisma-fresh.log`, `task7-file-gates.log` | proposal gates, red→green |
