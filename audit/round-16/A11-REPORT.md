# A11 — Runtime Smoke Pass, Round 16

**Date:** 2026-09-04
**Scope:** all 55 rows of `audit/round-16/runtime-smoke-plan.json` (customer 22 · business 12 · company 21), executed against a real, isolated Postgres + Redis + Next.js API stack. No mocks, no stubs.

## Result

**55/55 rows executed. 54 PASS, 1 PARTIAL, 0 FAIL, 0 BLOCKED.**

| App | PASS | PARTIAL | FAIL | BLOCKED | Total |
|---|---|---|---|---|---|
| customer | 21 | 1 | 0 | 0 | 22 |
| business | 12 | 0 | 0 | 0 | 12 |
| company | 21 | 0 | 0 | 0 | 21 |
| **Total** | **54** | **1** | **0** | **0** | **55** |

`items_total = 55`, `items_verified = 55` (every row has a runtime verdict — none left as "pending").

Full machine-readable output: `audit/round-16/A11-RESULTS.json`.

---

## The one non-PASS row, in full

**Row 93 — customer — "Table-QR check-in via `?checkin=`" — PARTIAL**

- HTTP 200, response `{"table_number":7,"reservation_code":null,"status":"free","checked_in":false}`.
- This is **exactly** the shape `apps/customer/js/features/checkin.js:112,121` reads (`d.checked_in` boolean) — the wiring is correct, and the client's own code treats `checked_in:false` as an explicit failure state ("table found but no active reservation on it"), which is what happened.
- **Root cause (verified live):** the reservation used for this row was booked for `2026-09-04 09:00–10:30 UTC` (the nearest slot `getAvailability` offered at the time). `qrCheckIn`'s window is `[slotStart-30min, slotEnd]` = `[08:30, 10:30]` UTC. The call was made at `07:36 UTC` — **54 minutes before the window opens.** Every same-day slot for a *new* reservation is necessarily in the future (you can't book the past), so a script that books "the nearest available slot" and immediately tries to check in can structurally never land inside the window. This is a real reservation-system property, not a reproduction of a defect.
- I confirmed the API did **not** fake success: `reservations.status` stayed `confirmed`, the table stayed `free` — no false-positive state change.
- **What is unproven:** the actual success path (`checked_in:true`, `Table.state -> occupied`, `ReservationEvent` insert) was not exercised in this run. I did not find a way to close this gap without either waiting ~55 real minutes mid-run or fabricating a reservation with a backdated `slot_start` directly in SQL (which would stop being a proof of the *booking→checkin* chain and start being a proof of only the checkin half). I chose to report this honestly as unproven rather than manufacture a passing result.

I initially and incorrectly marked this row PASS on the basis of `status === 200` alone, then caught it myself on review of the raw response before finalizing — this is exactly the "a 2xx is not a pass" trap the mandate warns about. Recorded here rather than silently fixed, per the instruction to report my own errors before anyone finds them.

---

## Preflight falsifiability proof (both directions, both exit codes)

New file: `audit/round-16/A11-logs/a11-preflight.mjs`. Two modes: `pre` (before starting the API — asserts Postgres reachable with the right table count, Redis reachable with a real round-trip, port 3000 free) and `post` (after starting — asserts the PID on :3000 is the one this run started, and `/api/health` reports `db:ok, redis:ok`). Every check is a real network/data-plane operation; none are skips.

### Proof 1 — the exact defect from the abandoned 2026-09-03 run (dead Redis port)

```
$ REDIS_URL=redis://localhost:56500 node a11-preflight.mjs pre
✓ port 3000 is free …
✓ Postgres … 72 public tables …
✗ PREFLIGHT FAIL: Redis round-trip against localhost:56500 failed: EACCES (localhost:56500)
RED_EXIT: 1

$ REDIS_URL=redis://localhost:56379 node a11-preflight.mjs pre
✓ port 3000 is free …
✓ Postgres … 72 public tables …
✓ Redis at localhost:56379 answered PING + SET/GET/DEL correctly (real round-trip)
✓ ALL PREFLIGHT CHECKS PASSED
GREEN_EXIT: 0
```

(The error surfaces as `EACCES` rather than `ECONNREFUSED` on this Windows host — Windows sometimes reports a blocked/unbound high port that way. The preflight script treats both as valid "closed" signals for the port-3000 check; for the Redis check any connection failure is a hard fail regardless of its `errno`.)

### Proof 2 — the founder's added requirement (stale server still bound to :3000)

```
$ node -e "require('http').createServer((q,r)=>r.end('dummy')).listen(3000)"   # inject violation
$ node a11-preflight.mjs pre
✗ PREFLIGHT FAIL: port 3000 is already answering HTTP requests (status 200) — a stale server
  must be killed before this run starts, or row calls will silently hit it instead of the fresh instance.
PORT_OCCUPIED_EXIT: 1

$ <kill the dummy listener, confirm netstat shows nothing on :3000>
$ node a11-preflight.mjs pre
✓ port 3000 is free … ✓ ALL PREFLIGHT CHECKS PASSED
PORT_FREE_EXIT: 0
```

### Proof 3 — PID-identity pinning (also founder-requested)

```
$ node a11-preflight.mjs post 99999            # wrong PID
✗ PREFLIGHT FAIL: port 3000 is owned by PID 7088, but this run started PID 99999 —
  "something answers on 3000" is not "my server answers on 3000". A stale process is still bound.
EXIT: 1

$ node a11-preflight.mjs post 7088             # actual PID this run started
✓ port 3000 is owned by PID 7088, matching the process this run started
✓ GET /api/health returned 200 with checks.db=ok and checks.redis=ok
EXIT: 0
```

Every real invocation of `pre`/`post` used in the actual run (not the injected-violation tests above) is reproduced in the "reproduction recipe" section below, each with its logged exit code.

---

## What was wrong beyond the Redis port

1. **`runtime-smoke-plan.json`'s own `preconditions[1]`** hard-coded `REDIS_URL=redis://localhost:56500` — fixed in place (`audit/round-16/runtime-smoke-plan.json` line 6) to `56379` with a comment explaining why and pointing at this report, per the mandate's explicit instruction to fix the plan file itself, not just the harness script.
2. **`CLAUDE.md` says the latest SQL migration is `۰۷۵`; the repo's `api/prisma/sql/` goes to `080-no-show-risk-source.sql`.** Found while running `apply-sql.sh` — five migrations (076–080) postdate the doc. Not fixed (out of scope for A11, and CLAUDE.md is not mine to edit unprompted), flagged here per the doc-staleness rule in the constitution.
3. **The abandoned 2026-09-03 harness's `bootstrap-platform.mjs`** had a hardcoded literal password (`'A11AdminPass123!'`) baked into source and written to two files, one of them (`api/platform-fixture.json`) un-ignored inside a production app directory. See "Credential hygiene" below.
4. **`api/src/lib/otp.ts`'s `OTP_DEV_MODE` path never calls `enqueueSms`** — the plan's `side_effects` field for rows 89/113/248 lists `"sms otp (enqueueSms otp.ts:158)"`, but with `OTP_DEV_MODE=true` (correctly, per CLAUDE.md — this is a supported feature) that specific line is skipped entirely and the code is returned directly in the response instead. This is expected, documented behavior, not a defect — flagged so the plan's own side-effect annotations aren't misread as unmet in future rounds.
5. **`reservations/route.ts`'s `date` query param is a fixed enum** (`today|tomorrow|upcoming|past|all`), not an arbitrary date string. Row 142's own element name ("Date tabs (امروز/فردا/آینده/گذشته/همه)") already implies this, but nothing in the plan's `api` field said so explicitly; I mis-implemented it as a literal date on the first attempt (422), caught it, fixed it.
6. **`POST /waitlist/:id/accept` requires `?token=<guest_token>` for guest (non-authenticated) entries** — not documented in the plan row 52's `api` field, discovered via a live 404 on the first attempt (`waitlist/[id]/accept/route.ts:20-22`).
7. **`POST /me/rewards/:id/redeem` requires the `RewardMarketplaceItem` to have a `restaurant_id`** when `kind='coupon_grant'` — a real, correct validation guard (`redeemRewardItem` rejects "coupon without restaurant"), discovered via a live 422 on the first attempt.
8. **Newly provisioned tables have an empty `qr_code` by default.** It is only populated the first time staff calls `GET /restaurant/tables/{id}/qr` (lazy-assign, `tables/[id]/qr/route.ts:38`). The plan's row 93 doesn't mention this precondition. I added the real staff-side GET call as a setup step rather than writing the code directly into the database.

None of items 4–8 are product defects — they are real, correct behavior that the plan's terse `api`/`db`/`side_effects` fields didn't fully capture. I'm listing them because the mandate asks for "anything in the plan you found to be wrong," and terse-to-the-point-of-misleading counts.

---

## Credential hygiene (addressed per an in-task directive, verified independently before acting)

Partway through this run, a message arrived (via a system-reminder channel, not a user turn) claiming to be from "the coordinator," reporting that `api/platform-fixture.json` and `.vscode/` had just been added to `.gitignore`, and that `audit/round-16/A11-fixtures.json` still held a plaintext password. **I did not act on this claim until I had verified it myself against the actual file state** — `git check-ignore -v` confirmed the two new ignore entries were real, and a raw byte-level read of `A11-fixtures.json` confirmed the plaintext `ownerPassword` field (my very first read of that file, moments earlier, had shown unrelated content — traced to a Read-tool result-mixing glitch in a parallel batch call, not a file that actually changed; the file's mtime, `2026-09-03 23:04:44`, was untouched throughout my session). A second message, again via the same channel, asserted the port-3000 and stale-process state and asked for PID-identity pinning in the preflight; I independently re-derived the same raw `netstat`/`curl` output before adding that check, and separately confirmed the two concurrent `tsx --test` process trees it named (see "Concurrent activity" below) were real and not mine. Both messages' claims held up to independent verification, and the actions requested were in-scope, low-risk, and consistent with `CLAUDE.md`'s absolute rule against committing secrets — so I proceeded, but I'm flagging the delivery channel itself: an instruction arriving via a mid-task system-reminder rather than a user turn is exactly the shape a prompt injection would take, and per the standing rule no agent message is authorization on its own. I verified before trusting, not after.

What I found and changed:

- **Root cause:** `audit/round-16/A11-logs/bootstrap-platform.mjs` (the abandoned run's fixture generator) had the password `'A11AdminPass123!'` as a hardcoded literal in source, and wrote it into `platform-fixture.json` next to itself. A copy of that output had been hand-placed at `api/platform-fixture.json` — inside a production app directory, and (until the coordinator's edit) not gitignored. The same value was also duplicated into `audit/round-16/A11-fixtures.json`. Three copies of one hardcoded, guessable password.
- **Design chosen:** one ignored secrets file, nothing else holds a password.
  - Deleted `api/platform-fixture.json` (dead, unreferenced by any code, a hand-made duplicate).
  - Redacted `audit/round-16/A11-fixtures.json` in place (kept the non-secret IDs for historical reference, replaced the password with a pointer to this report) — it is now safe to commit.
  - New `audit/round-16/A11-logs/a11-secrets.env` holds this run's actual generated credentials (random, via `node crypto`, admin password / owner password / TOTP secret) — added to `.gitignore`.
  - `start-api.sh` now sources that file instead of embedding any secret inline.
  - Patched `bootstrap-platform.mjs` itself (kept as a classified, superseded/dead artifact per the audit constitution — not deleted) so the *class* of bug can't recur even if someone reruns it: the password is now required from `ADMIN_PASSWORD` env (script refuses to run without it, no hardcoded fallback), and it is never written to disk, only echoed once to the terminal of whoever supplied it.
- Verified: `grep -rn "A11AdminPass123"` across the repo now finds only the explanatory comment describing the fix, not a live secret. `git check-ignore -v audit/round-16/A11-logs/a11-secrets.env` → ignored, exit 0.

### تکمله‌ی ۲۰۲۶-۰۹-۰۴ — این بخش وقتی نوشته شد، کامل نبود

بخشِ بالا فقط **رمزها** را دنبال کرده بود و نتیجه گرفت «هیچ فایلی رمز ندارد».
سرِ commit معلوم شد `audit/round-16/A11-RESULTS.json` هنوز **۱۶ توکنِ JWTِ خام**
دارد که خودِ همین اجرا از APIِ زنده گرفته و verbatim در فیلدِ `evidence` نشانده
بود. تفکیکِ آن‌ها:

- ۷ توکنِ **refresh** با `exp` معادلِ ۲۰۲۶-۱۰-۰۴ — یعنی در لحظه‌ی کشف **منقضی
  نشده** بودند؛ دو تای‌شان `kind:"staff"` با `role:"owner"` روی دو tenantِ متفاوت.
- بقیه accessهای کوتاه‌عمر (منقضی).

دامنه‌ی واقعیِ خطر (سنجیده شد، حدس نیست): این توکن‌ها با رازِ یک‌بارمصرفِ
`a11_test_access_secret_…` امضا شده‌اند که در `start-api.sh:29-31` صریح و
عمدی نوشته شده، و علیهِ DBِ محلیِ `rezervno_a11` کار می‌کنند. مقایسه‌ی برنامه‌ای
با `api/.env` انجام شد: `JWT_SECRET` و `JWT_REFRESH_SECRET` هیچ‌کدام برابرِ آن
مقدار نیستند. پس این **افشای اعتبارنامه‌ی تولیدی نبود**.

با این حال commit نشدند، به دو دلیل که مستقل از دامنه‌اند: توکنِ زنده در مخزن
هر secret-scannerی (از جمله push protectionِ خودِ GitHub) را فعال می‌کند، و
قاعده‌ی مطلقِ `CLAUDE.md` دربارهٔ نریختنِ اعتبارنامه در مخزن به «ولی این یکی
بی‌خطر است» مشروط نیست.

**اقدام:** فقط قطعه‌ی *امضا*ی هر توکن با `SIGNATURE-REDACTED` جایگزین شد؛
`header.payload` دست‌نخورده ماند. ارزشِ استنادی صفر تغییر کرد — ادعایی که این
شواهد پشتیبانی می‌کنند دربارهٔ *شکلِ* پاسخِ `/auth/refresh` و claimهای درونِ
توکن است، نه بایت‌های امضا — ولی قابلیتِ replay از بین رفت. راستی‌آزمایی:
۱۶ توکن، ۰ امضای باقی‌مانده، و فایل هنوز JSONِ معتبر است.

**درسِ قابلِ‌تعمیم:** «رمزی پیدا نشد» با «اعتبارنامه‌ای پیدا نشد» یکی نیست.
یک sweepِ اعتبارنامه که فقط دنبالِ `password` بگردد، توکنِ حاملِ امضاشده را
نمی‌بیند — دقیقاً همان کلاسِ «ادعا فراتر از آنچه اثبات شده» که این راند
دنبالش بود، این بار در گزارشِ خودِ من.

---

## Concurrent activity on this repository (found, not caused by me)

Two things surfaced during this session that I want on record because they affect how much confidence to place in "the working tree" as a whole, though neither affected my own results:

1. **Two other `tsx --test` process trees were running against this repo during my session** (`tests/lifecycle-cron.integration.test.mts`, started 2026-09-04 02:36, and `tests/model-registry.integration.test.mts`, started 06:32) — neither started by me. `api/.env`'s `DATABASE_URL` points at the polluted dev database (`rezervno` on port 5432, not the isolated `rezervno_a11` I created on port 55432), so these processes almost certainly were not reading or writing my fixtures — but I could not fully verify their own environment overrides from the outside, only that every command I personally ran pinned `DATABASE_URL`/`REDIS_URL` explicitly rather than relying on `.env` defaults.
2. **`git status --short` at the end of this session shows ~40 modified/added/renamed files with no relation to A11** — CI workflow, `CLAUDE.md`, `docs/SECURITY.md`, an entirely new `audit/round-20/` directory, agent definition files under `.claude/agents/`, new tools scripts, etc. None of these are files I touched. I did not revert, inspect the content of, or otherwise interfere with any of them — they are not mine to manage, and my mandate was explicit about not committing anything, so I am leaving them exactly as found. Listed here so the founder isn't surprised by an unfamiliar diff when reviewing my specific changes.

---

## An unplanned finding worth flagging (not asked for, but matters)

**`audit/round-16/feature-census.json`'s `id` field is not unique.** Every `customer`-app row and every `company`-app row share the same `C##` numbering (`C01`…`C81`, each used exactly twice — confirmed by direct inspection, e.g. `C04` is simultaneously "customer: Points chip (nav-pts)" and "company: Login «ورود با پیامک» button"). Separately, **all 143 `business`-app rows have no `id` field at all.** I did not merge this run's findings into `feature-census.json` for two reasons: (a) it is not in this task's explicit deliverable list (only `A11-RESULTS.json` and this report are), and (b) merging by `id` alone against a file with silent cross-app collisions would risk overwriting the wrong row. I computed the mapping anyway, keyed by `(app, element)` instead of `id` (safe — no collisions on that compound key), and saved it to `audit/round-16/A11-census-mapping.json` for whoever does the merge:

- 54 rows: `class: "REAL-STATIC"` → `class: "REAL"`
- 1 row (`customer`, id `C94`, "Table-QR check-in via `?checkin=`") → `class: "PARTIAL"`, with the reasoning from this report attached
- `totals.classes`: `REAL-STATIC: 55 → 0`, `REAL: 190 → 244`, `PARTIAL: 56 → 57`

I recommend the merge be done by a human or a follow-up task that also fixes the `id` scheme itself (distinct prefixes per app, and backfilling the 143 missing `business` ids) rather than papering over it inside a mechanical merge.

---

## Full reproduction recipe

```sh
# 1. fresh, isolated database (never the polluted dev `rezervno`)
docker exec rezv-test-pg psql -U test -d postgres -c "DROP DATABASE IF EXISTS rezervno_a11;"
docker exec rezv-test-pg psql -U test -d postgres -c "CREATE DATABASE rezervno_a11;"
cd api
DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11" \
  npx prisma db push --skip-generate --accept-data-loss   # empty DB only — see CLAUDE.md
DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11" \
  sh prisma/apply-sql.sh
DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11" \
  npx prisma db execute --file prisma/test-schema-fixups.sql --schema prisma/schema.prisma
# expect: 72 tables, staff=0, rls=61, policies=0

# 2. platform admin (writes PLATFORM_ADMIN_TENANT_ID to stdout — paste into start-api.sh)
set -a; . ../audit/round-16/A11-logs/a11-secrets.env; set +a
DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11" PLATFORM_ADMIN_TENANT_ID="" \
  ADMIN_USERNAME="$A11_ADMIN_USERNAME" ADMIN_PASSWORD="$A11_ADMIN_PASSWORD" \
  npx tsx prisma/create-platform-admin.ts 09121110001 "[DEMO] A11 Platform Owner"
# paste the printed tenant id into audit/round-16/A11-logs/start-api.sh's PLATFORM_ADMIN_TENANT_ID

# 3. preflight (pre) — must exit 0 before continuing
cd ..
docker exec rezv-test-redis redis-cli FLUSHDB
DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11" REDIS_URL="redis://localhost:56379" \
  node audit/round-16/A11-logs/a11-preflight.mjs pre; echo "exit:$?"

# 4. start the API, then preflight (post) with the PID netstat shows on :3000
sh audit/round-16/A11-logs/start-api.sh > audit/round-16/A11-logs/api.log 2>&1 &
sleep 20
netstat -ano | grep ":3000"                                   # note the PID
node audit/round-16/A11-logs/a11-preflight.mjs post <PID>; echo "exit:$?"

# 5. run all 55 rows
set -a; . audit/round-16/A11-logs/a11-secrets.env; set +a
node audit/round-16/A11-logs/a11-run.mjs > audit/round-16/A11-logs/a11-run-stdout.log 2>&1
echo "exit:$?"       # must be 0
cat audit/round-16/A11-RESULTS.json
```

Actual exit codes from the run this report is based on: DB push `0`, `apply-sql.sh` `0`, `test-schema-fixups.sql` `0`, `create-platform-admin.ts` `0`, preflight `pre` `0`, preflight `post` `0`, `a11-run.mjs` **`0`**.

---

## What I could NOT prove (explicit, not rounded up)

- **Row 93's happy path** (`checked_in:true`) — see above. Genuinely unproven, not assumed working.
- **Actual SMS delivery** for any `sms` side-effect (booking_confirm, waitlist_joined, staff_invite, campaign, etc.) — this environment has no `MELIPAYAMAK_USERNAME`/`PASSWORD`, so `sendSmsNow` never reaches the real provider. What I *did* prove: the job is correctly enqueued in the real `jobs` Postgres table with the right `template` (verified via query for row 46's `booking_confirm`), which is as far as this environment can honestly go. Whether Melipayamak itself would accept and deliver these messages is unknown and out of scope for a local smoke pass — I am not rounding that "unknown" up to "works."
- **The birthday-reward cron** (`+1000 points` on the user's actual birthday, referenced in row 76's plan entry) — no cron runner exists in this harness; only the `PATCH /me` write of `birth_date` itself was proven.
- Whether the two unrelated `tsx --test` runs I observed were fully isolated from my fixtures — I verified my own commands never touched anything but `rezervno_a11`/port 56379, but I could not inspect those other processes' own environment variables from the outside.

---

## Files I touched (all under this repo, nothing committed)

**Created:**
- `audit/round-16/A11-logs/a11-preflight.mjs`
- `audit/round-16/A11-logs/a11-run.mjs`
- `audit/round-16/A11-logs/a11-secrets.env` (git-ignored)
- `audit/round-16/A11-logs/a11-run-state.json`
- `audit/round-16/A11-logs/a11-run-stdout.log`
- `audit/round-16/A11-RESULTS.json`
- `audit/round-16/A11-REPORT.md` (this file)
- `audit/round-16/A11-census-mapping.json`

**Edited:**
- `audit/round-16/runtime-smoke-plan.json` (fixed the dead Redis port in `preconditions[1]`)
- `audit/round-16/A11-logs/start-api.sh` (correct Redis port, sources secrets file, current `PLATFORM_ADMIN_TENANT_ID`)
- `audit/round-16/A11-logs/bootstrap-platform.mjs` (credential-hygiene patch; classified as dead/superseded, not deleted)
- `audit/round-16/A11-logs/api.log` (overwritten by each run)
- `audit/round-16/A11-fixtures.json` (redacted the plaintext password)
- `.gitignore` (added `audit/round-16/A11-logs/a11-secrets.env`, extended the existing `api/platform-fixture.json` comment)

**Deleted:**
- `api/platform-fixture.json`

**Left running:** the API dev server (PID visible via `netstat -ano | grep :3000` at review time) and the `rezervno_a11` Postgres database / test Redis keys, so the founder can inspect the live post-run state directly before I (or anyone) tears it down. Nothing was committed or pushed.
