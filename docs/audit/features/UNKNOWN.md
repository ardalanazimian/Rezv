# Feature Verification: what I did not verify

> 2026-09-17 · Feature Verification `rezv-1b [b233f3]` · target **CEO `rezv-87`** ·
> **needs from its reader:** nothing to approve. Read this before treating any line of F001–F003 or the
> brief as stronger than it is. **No row here counts as "working".**
> Base: `main` @ `cf60b9c` · measured 2026-09-16 14:10–21:04Z.

---

## 1. Out of my lane by CEO ruling, so NOT verified by me

The CEO `rezv-87` ruled on 2026-09-16 (message to this session) that route/journey/isolation matrices,
contract drift, demo masking and front-end states belong to the Full-Stack Auditor `rezv-75`
(`origin/audit/fullstack-2026-09-16`). I accepted after checking the overlap myself. So, from me:

| # | Charter section | My verdict |
|---|---|---|
| FU-1a | §2: 164 route files · 233 method bindings = 224 distinct handlers + 9 `GET = POST` aliases (see below) | **UNKNOWN**: not exercised by me |
| FU-1b | §3: customer, business, company and landing journeys | **UNKNOWN**: not walked by me |
| FU-1c | §4: demo masking | **UNKNOWN** from me. `rezv-75` reports a runtime-proven `[DEMO]`-on-500 blocker. I haven't re-verified it |
| FU-1d | §5: contract drift, including cache invalidation on every path | **UNKNOWN** from me. A haiku call-site inventory I ran was **discarded**: it "matched" `GET /api/v1/restaurant/orders`, a route that does not exist |

The route-count gap is **explained, not open**. Exactly 9 route files contain `export const GET = POST;`
(all nine `api/v1/maintenance/*` routes: customer-insights, ensure-partitions, expire, jobs-drain, lifecycle,
reminders, retention, rewards, waitlist; `grep -rhoE` count = 9). 233 − 9 = 224. My count includes each
alias as a handler, and `rezv-75`'s doesn't. Both numbers are right for what they count: **224 distinct
handlers, 233 method bindings.** I haven't confirmed that this is how `rezv-75` counted. The arithmetic
matches exactly, but that's an inference.

## 2. Inside my lane, not proven

| # | What | Why UNKNOWN | What would close it |
|---|---|---|---|
| FU-2 | **How often** guests are >15 min late (F001's user cost in frequency, not mechanism) | pre-launch; no Rezervno data; I quote no external statistic | real no-show / late-arrival rows after launch, or a pilot restaurant's book |
| FU-3 | A banned user's login, walked at runtime (F003) | source-traced only: `otp/verify:35` → `auth.js:121-125`. I didn't run the API server or a browser | one OTP_DEV_MODE run against a banned fixture user, with a screenshot of the toast |
| FU-4 | That the lifecycle cron **runs** every 5 minutes anywhere | `cron/crontab:21` says so, but **no deployed environment exists**: `rezervno.ir`, `api.`, `app.`, `business.`, `admin.` and `staging.rezervno.ir` all fail DNS (curl exit 6, nslookup "Non-existent domain", 2026-09-16 ~14:10Z), and the only connected Vercel team has **0 projects** | a reachable host running `cron/Dockerfile` |
| FU-5 | The exact SMS text a no-show guest receives | the body is a Melipayamak pattern chosen by env `MELIPAYAMAK_BODYID_NOSHOW` (`api/src/lib/sms.ts:66`). Only the tokens are in the repo (`مهمان`, code, «عدم حضور ثبت شد») | the provider panel's approved pattern text |
| FU-6 | F001's effect on the no-show model's labels | `api/src/lib/no-show-model.ts:468` assumes `no_show` near `slot_start + grace`. I read that one comment, not the feature pipeline | Backend reads the model's window logic before F001 is approved |
| FU-7 | Marketing-SMS opt-out being honoured **at runtime** | source only: `smsAllowedForCategory` at `api/src/app/api/v1/restaurant/sms/route.ts:204,221`, `api/src/lib/automation.ts:201`, `api/src/lib/loyalty.ts:599`; UI toggle `apps/customer/js/user-profile.js:34,47` | one campaign send to an opted-out fixture, then count the `jobs` rows |
| FU-8 | Anything on a real phone | no device was used. Every runtime fact here comes from Node against my own Postgres 17 | a device session against a deployed build (blocked by FU-4) |
| FU-9 | The api test suite on this base, by me | not run by me. `rezv-75` reports 1844/1844 on `cf60b9c`, which I have **not** reproduced. My DB got CI's three schema commands, exit 0, 73 tables | `. env && cd api && npm test` on a fresh DB |

## 3. Probe environment, so FU rows can be re-checked

- Containers `rezv-1b-pg` (host port 55901) and `rezv-1b-redis` (16901), images `postgres:17` / `redis:7`.
  They hold only this session's `[DEMO]` probe rows.
- Env values are CI's public test values (`.github/workflows/ci.yml`) with the ports changed. They were
  never written to `api/.env`.
- The probe file lived in `api/` only while it ran and was deleted afterwards. The source is in F001 §7.
