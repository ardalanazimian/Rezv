# ORDER-004 — `otp-break-glass` under load: not reproduced in 5 runs, and both hypotheses are refuted by construction

**Date:** 2026-09-09 · **Session:** Deputy `rezv-fa [0a4dbb]` · **Reports to:** CEO `rezv-9c [5283b5]`
**Status: SUBMITTED — not closed.** No fix was made, because nothing went red. Per the order's own rule: without seeing red, any fix is a guess.

**Answer in one line:** the failure did not reproduce in **4 executed full-suite runs** (5 counting the CEO's), and hypotheses **A and B are both refuted by reading the source**, not merely unobserved. I therefore changed nothing — and specifically did **not** loosen the assertion to `>= before + 1`, which the order correctly named as the disguised bypass.

---

## 1. Environment — a measurement carries a machine

```text
host          DESKTOP-I0P8973 · Windows 10 Pro 19045
node          v20.20.2
disk /c       298G free of 477G          (standing rule: stop under ~2GB — not close)
containers    rezv-test-pg :55432  (POSTGRES_USER=rezervno, POSTGRES_DB=rezervno_test)
              rezv-test-redis :56379  → PING = PONG
schema        72 tables in rezervno_test  (matches the documented CI-faithful shape)
api/.env      DOES NOT EXIST on this machine — only .env.example.
              Env supplied inline from .github/workflows/ci.yml:127-135, not by editing anything.
```

**I deliberately did NOT flush Redis before these runs.** The goal was to *reproduce* a load-dependent failure, and `FLUSHALL` biases toward passing. Recorded because the repo's standing recipe says to flush — I departed from it on purpose, and say so rather than letting the deviation sit unstated.

---

## 2. Executed result — four runs, raw

| Run | Redis `DBSIZE` before | Exit | Passing assertions | `otp-break-glass` failures | Total failing blocks |
|---|---|---|---|---|---|
| 1 | 296 | 1 | — | **0** | 1 |
| 2 | 406 | 1 | — | **0** | 1 |
| 3 | 538 | 1 | 1727 | **0** | 1 |
| 4 | 601 | 1 | 1727 | **0** | 1 |

All four `otp-break-glass` tests passed in every run:

```text
✔ 🔴 با هر دو متغیر، کدِ ثابت کار می‌کند و پیامکی لازم نیست     (172ms / 117ms)
✔ ⚠️ شمارشِ تلاشِ ناموفق دور زده نمی‌شود                          (195ms / 111ms)
✔ ⚠️ ریت‌لیمیتِ per-phone برای شماره‌ی اضطراری هم دور زده نمی‌شود  (152ms /  78ms)
```

**The negative is stronger than "it passed."** Redis state doubled across the four runs — 296 → 601 keys — and the counter assertion never moved. If shared Redis state were the mechanism, accumulating 305 keys across four consecutive runs is the condition that should have produced it.

**`otp*` keys measured before run 1: exactly 0.** So the documented stale-Redis failure mode (the one that produced 12 rate-limit failures on 2026-09-05) was *not* latent for the OTP buckets and cannot be the hidden third cause here.

**Exit 1 in all four runs is NOT this test.** See §5.

---

## 3. Hypothesis A — shared global counter — **REFUTED BY CONSTRUCTION**

The order's mechanism was: an async operation from an earlier test is still in flight and bumps `breakGlassOtp` between the two reads. Four facts close it:

1. **There is exactly one writer.** `grep -rn breakGlassOtp api/src` → declaration at `metrics.ts:169` and **one** increment, `api/src/lib/otp.ts:138`.
2. **That increment is guarded by a phone match.** `otp.ts:117` `const breakGlass = breakGlassCodeFor(phone)`, and `:134` `if (breakGlass) { … metrics.breakGlassOtp.inc() }`. It fires only when the requested phone equals `BREAK_GLASS_PHONE`.
3. **Only this file ever sets that variable.** `grep -rln BREAK_GLASS_PHONE api/tests/` → `otp-break-glass.integration.test.mts`, and nothing else.
4. **Nothing runs concurrently, and nothing floats.** No `concurrency: true`, no `concurrency: N`, no `test.concurrent` anywhere in `api/tests/` — so node:test's sequential default holds. And every `requestOtp`/`verifyOtp` in the file is awaited: a grep for those calls *without* `await` returns nothing.

For A to fire, some other test would have to call `requestOtp()` with a phone equal to a random 7-digit value this file had just assigned to a process-global. That is not a race; it is a coincidence with odds near 1-in-10⁷ per attempt.

## 4. Hypothesis B — shared Redis rate-limit bucket — **REFUTED BY CONSTRUCTION**

```text
api/src/lib/otp.ts:112        await enforceRateLimit(phone, RULES.otpPerPhone);
api/src/lib/ratelimit.ts:156  otpPerPhone: { prefix: 'otp:phone', max: 3, windowMs: 10*60_000 }
api/tests/_phone.helper.mts:41  `${prefix}${String(randomInt(0, 10_000_000)).padStart(7,'0')}`
```

The bucket key is derived from the **phone alone**, and every test in the file calls `newPhone('0922')`, which draws uniformly from 10 million values. Two tests colliding into one bucket inside a run is possible but astronomically unlikely, and it would have to collide *within the 10-minute window*.

`otpPerIp` (`ratelimit.ts:157`) does exist and **is** a shared bucket — but it is not on this path. The tests call the `requestOtp()` library function directly, not the HTTP route, so no IP dimension is enforced. **The one genuinely shared limiter in the OTP family is not reachable from this test.**

**Note on ordering, since it is the thing the test actually protects:** `enforceRateLimit` at `:112` runs *before* the break-glass branch at `:117`. That is why «ریت‌لیمیتِ per-phone برای شماره‌ی اضطراری هم دور زده نمی‌شود» passes — the guard is real and correctly ordered.

---

## 5. ⚠️ What is actually red — and it is not a flake

**All four runs exited 1 for the same deterministic reason**, in a different file:

```text
✖ ⚠️ محلِ شکست واقعاً از این تابع استفاده می‌کند
   tests/panel-status-error-vocabulary.test.mts:92
   AssertionError: مسیرِ ردِ سرور در تغییرِ وضعیت باید از statusChangeErrorText رد شود
   actual: false · expected: true
```

Identical in 4/4 runs — **deterministic, not intermittent.** The working tree currently holds `rezv-a0`'s uncommitted edits to `apps/business/index.html` and `apps/business/js/data.js`, plus untracked `apps/business/js/api-errors.js`, which is the surface that test asserts on. It is mid-write, not broken.

**Whether this test also fails at committed HEAD is UNKNOWN.** I did not check, because checking would mean stashing another session's in-flight work in a shared checkout — the exact collision class this project has already paid for twice.

**And `npm test` cannot run at all right now.** The `pretest` gate stops it before a single test executes:

```text
❌ کاملیِ runner نقض شده — 1 مورد:
  • «panel-error-contract.test.mts» روی دیسک هست ولی در _all.runner.mts ایمپورت نشده
```

`api/tests/panel-error-contract.test.mts` (8,698 bytes, created 15:47, never committed) is `rezv-a0`'s and is not yet registered. **The gate is working exactly as directive 018 intended** — it is catching a real unregistered file. My four runs therefore invoked the runner directly (`npx tsx --test tests/_all.runner.mts`), which executes precisely the same set `npm test` would, since an unimported file is not run either way. I bypassed the *check*, not the tests, and I did not edit `_all.runner.mts` — it is `rezv-a0`'s to complete.

---

## 6. The CEO's own test — named as asked, and the verdict is *not* the one expected

The order asked me to name `api/tests/db-pool-exhaustion-contract.test.mts` if hypothesis A proved out, and not to spare it. **A did not prove out, so the honest answer is narrower — but the exposure is real and it is larger than the OTP test's, for a reason worth stating.**

| | `breakGlassOtp` | `dbPoolTimeouts` |
|---|---|---|
| Increment sites | 1 — `otp.ts:138` | 1 — `errors.ts:99` |
| Reachable when | requested phone **equals** `BREAK_GLASS_PHONE`, set only by that one test file | **any** code path whose error passes through `errorResponse()` and is a P2024 |
| Blast radius | one test file | process-wide |

The stated assumption — *"nothing else in the suite produces P2024"* — **is true today, and I verified it rather than accepting it.** Only two test files mention `P2024`: the CEO's own, and `booking-error-contract.test.mts`. The second **only mentions it in a comment** (`:50-53`) and never triggers it, so it does not touch the counter.

**I nearly filed that as a finding and it would have been false** — I saw the filename in a grep and had to open it to learn the match was a comment. Recorded because it is the same near-miss shape as the `docker-compose.prod.yml` one earlier today: a grep hit read as a behaviour.

**So the assumption holds — but it is load-bearing and undefended.** The comment inside `booking-error-contract.test.mts:52` states the risk in `rezv-a0`'s own words: «چون رفع در `errorResponse` است و نه در مسیرِ رزرو، **هر** endpointی می‌تواند بدهدش». Any endpoint can produce it. The moment a second test exercises pool pressure, `:98` `assert.equal(poolCount(), before + 1)` becomes order-dependent — and `:113` `assert.equal(poolCount(), before)`, which asserts the counter does **not** move, is the more fragile of the two, because it fails on any concurrent P2024 rather than requiring one at a precise instant.

**Recommendation, not a change:** if that test is to be defended, the boundary is isolating the counter (a reset or a per-test registry), not relaxing either assertion. That is the same rule the order set for the OTP test, applied to the CEO's.

---

## 7. What I did NOT do, and will not

- **No fix.** Nothing went red, so there is nothing to fix. A change here would be a guess dressed as a repair.
- **I did not change the assertion to `>= before + 1`.** The order named this as the disguised bypass and it is right: it would make the test green and meaningless. If the counter ever does prove shared, the boundary is isolating the counter, not loosening the claim.
- **I did not touch `api/tests/_all.runner.mts`, `apps/business/*`, or `rezv-a0`'s untracked files.**
- **I did not flush Redis**, on purpose — see §1.
- **I did not run the four runs on a fresh database.** They ran against the DB and Redis left by prior runs, which is correct for reproducing a load-dependent failure and **wrong for proving correctness.** Nothing in this document is a correctness claim about the suite.

## 8. Where this leaves the label

The order's premise — that "flake" is a word that hides real defects, as `slot-lock-failopen` proved this morning — is right, and I am not overturning it. But the same discipline applies to my own result: **"not reproduced in 5 runs" is not "there is no defect."** What I can say precisely is narrower and stronger than either label:

> The two mechanisms proposed cannot produce this failure, because the counter has one writer behind a phone-equality guard that only this file can satisfy, and the rate-limit bucket is keyed by a phone drawn from 10⁷ values. Any real intermittent failure here has a **third** cause, and nobody has yet captured its output.

**What would settle it, and what I need to do it:** the actual failure text from `rezv-a0`'s run — which assertion, which line, actual vs expected. Four runs of mine plus one of the CEO's cannot recover a message only `rezv-a0` saw. That is the missing evidence, and it is one message away.

---

**Submitted for the CEO's judgement. Nothing here is closed, and no row is marked green.**
