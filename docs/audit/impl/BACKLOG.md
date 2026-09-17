# Implementation Team — BACKLOG

- **Date:** 2026-09-16 · measured 14:00–14:20 UTC
- **Session:** Implementation Team `rezv-85 [27467f]` · sessionId `61edcb5d-36ac-4cd3-8f63-15278ad9007f`
- **Target:** CEO `rezv-87 [09dbab]`
- **What it needs from its reader:** check the order of the queue against your P0–P3 message, and
  flag any row whose source line you know to be stale. Nothing here is closed. A row is only a claim
  until its FIX file says "submitted", and it stays open until you close it after the Red Team.

**Bases (pinned, not moving refs):** `main = cf60b9c` (`git ls-remote`, 14:02 UTC) · merge candidate
`ceo/merge-candidate-0916 = 99065a7` (main + 25 commits; main is its ancestor). Every source line
below was read on **99065a7** unless it says otherwise.

**Status vocabulary:** `measured` = I ran the command or read the line myself · `claim` = someone
else's statement I have not reproduced yet · `repro pending` = shape confirmed by reading, no red
test yet. Priority levels are the founder's §2 order: 1 journey · 2 money/auth · 3 beatable gate ·
4 regressed / reported-fixed-but-not · 5 fake feature · 6 other.

## Counts — revision 3 (2026-09-17 ~00:45 UTC; revision 2 was 29 rows)

| Lane | Rows | critical | major | minor | submitted | open | blocked |
|---|---|---|---|---|---|---|---|
| Backend | 14 | 4 | 9 | 1 | 3 (BE-01, BE-02, BE-03) | 10 (+1 owned by rezv-1b) | 0 |
| Frontend | 10 | 2 | 7 | 1 | 1 (FE-06) | 7 (+2 owned by rezv-1b) | 0 |
| Design | 1 | 0 | 1 | 0 | 0 | 1 | 0 |
| SEO | 5 | 0 | 2 | 2 | 0 | 4 | 1 (SEO-B1) |
| **Total** | **30** | **6** | **19** | **4** | **4** | **22 (+3 owned by rezv-1b)** | **1** |

Rows added in revision 2 are listed in the section of that name at the end of this file. Nothing
is closed; "submitted" means waiting for the Red Team and the CEO.

Design has one row because only one design check has been **measured** so far (DS-01), not
because the rest passed. The others are listed in `UNKNOWN.md`, and none of them counts as passing.

## Order of work (CEO's order, checked against the source; no contradiction found)

1. FE-01 + BE-01: prove the merge candidate (CEO P0-1)
2. BE-02: `TRUNCATE` on `reservation_events` (P0-2)
3. BE-03: FP-009 §5/§6 guards (P0-3)
4. BE-04 + BE-05: staff and owner phone hijack (P1-4; BE-05 is a sibling this session found)
5. BE-08 / FE-05: merge `session/rezv-36-backend` after the candidate lands (P1-5)
6. Everything else, smallest blast radius first

---

## Backend

| ID | Sev | Lvl | Finding | Source | Status |
|---|---|---|---|---|---|
| BE-01 | major | 3 | `check-rejects-matcher` **exits 1** on the candidate: `assert.rejects(fn, '<Persian text>')` passes a string as the 2nd argument, so Node reads it as the assert's own message and the FK-RESTRICT delete test accepts **any** failure | `api/tests/points-ledger-append-only.integration.test.mts:134` | measured (`node tools/check-rejects-matcher.mjs` → exit 1) |
| BE-02 | critical | 2 | RT-25: `reservation_events` has only row-level `BEFORE UPDATE` / `BEFORE DELETE` triggers. Row triggers do not fire on `TRUNCATE`, so one statement empties the append-only event log. The only statement-level trigger in the repo is 089's, on `points_ledger` | `api/prisma/sql/082-reservation-events-ml-substrate.sql:102-110`; `api/prisma/sql/089-points-ledger-append-only.sql:91-92` | measured (grep for `FOR EACH STATEMENT` / `BEFORE TRUNCATE` → one hit only); TRUNCATE not yet executed |
| BE-03 | major | 3 | FP-009 §5 (schema-drift axis: `confdeltype='r'` + three triggers) and §6 (no `session_replication_role` in `api/src`) guards are on neither main nor the candidate. The dead Backend session's work was rescued **unreviewed** to `backup/rescue-0916/fp009-guards-wt-rezv-c9 @ 5ae45a2` | `docs/DECISIONS.md` FP-009 | claim (CEO), ref measured with `ls-remote` |
| BE-04 | critical | 2 | **Staff phone hijack.** `POST /v1/restaurant/staff` takes any phone with no proof of ownership. `findStaffForLogin` is platform-wide (owner row first, then oldest row), and `createTrialAccount` turns away **any** existing staff row with «از همان شماره وارد پنل شوید». Result: attacker tenant A adds victim phone P as staff → victim's self-serve trial is refused → victim logs in by OTP and lands in **A**, whose owner sees everything the victim enters | `api/src/app/api/v1/restaurant/staff/route.ts:124`; `api/src/lib/staff-helpers.ts:192-206`; `api/src/lib/site-orders.ts:288-291` | repro pending (the CEO named the first two lines; the third is this session's sibling sweep) |
| BE-05 | critical | 2 | **Sibling of BE-04: the public trial form creates an `owner` row with no phone proof.** `POST /v1/site/trial` has no OTP field, yet it writes `role: 'owner'` for the submitted phone. `findStaffForLogin` rests on the premise that owner is «the only role created with a real proof», which this path breaks. The row squats the global unique owner-phone index (079), so the real owner's provisioning is refused with `duplicate_owner_phone` | `api/src/app/api/v1/site/trial/route.ts:19-34`; `api/src/lib/site-orders.ts:329-331`; `api/src/lib/staff-helpers.ts:169-172`; `api/src/lib/provisioning.ts:121-127` | repro pending, found by this session |
| BE-06 | major | 2 | The hard ban is not enforced on `reservations/[code]/cancel`, `/arrive`, `/pay`, although `lib/ban.ts` declares that it closes auth **and reservation** routes. ⚠️ Blocking a banned user's **cancel** would leave a phantom table for the restaurant, so a decision per route is needed before any code changes | `api/src/lib/ban.ts:9-12`; `api/src/app/api/v1/reservations/[code]/cancel/route.ts`; `api/src/app/api/v1/reservations/[code]/arrive/route.ts`; `api/src/app/api/v1/reservations/[code]/pay/route.ts` | measured (zero `ban` matches in the three routes) |
| BE-07 | major | 2 | F15: redeeming a reward debits `customer_economy_profiles.wallet_balance` with **no** `economy_ledger_entries` row. `rewards.ts` never mentions a ledger (193 lines, 0 matches), while `economy.ts` promises every movement goes through that append-only table | `api/src/lib/rewards.ts:158-162`; `api/src/lib/economy.ts:17` | measured at file level; whether a DB trigger writes the row is not yet checked |
| BE-08 | major | 4 | 9 backend fixes on `session/rezv-36-backend @ 485fda3`, each with a test, are on neither main nor the candidate. The merge has 5 textual conflicts. `BE-007` has a duplicated §9 whose second copy is corrupted | `docs/audit/backend/` on that branch | claim (CEO) + `git log main..485fda3` measured (16 commits) |
| BE-09 | major | 6 | C-3: alerts evaluate and reach **no one**. `prometheus.yml` has no `alerting:` block and no compose file runs Alertmanager. `observability/metrics-token` is gitignored while the observability compose file mounts it, so a fresh clone cannot start the scrape | `observability/prometheus.yml`; `.gitignore:88`; `docker-compose.observability.yml:41` | measured (0 `alerting` lines; mount and ignore lines read) |
| BE-10 | minor | 3 | 113 of 176 `assert.rejects` / `assert.throws` calls are weak (64%, 20 files; 28 use the string-as-2nd-arg form). By a reviewer + CEO decision the gate ratchets on the diff only, so old instances tighten when touched | `tools/check-rejects-matcher.mjs --report` | measured |
| BE-11 | major | 2 | With Redis down, `withSlotLock` fails **open**, logged and counted (`rezervno_slot_lock_fallback_total`, alert rule present). For a table's primary row the `no_table_overlap` EXCLUDE still holds. **Secondary tables of a merged booking have no DB constraint**, and their only guard is an app-level check that is sound only if every writer is Serializable. The N-parallel proof on a fresh DB for both shapes has not been run by this session | `api/src/lib/redis.ts:160-200`; `observability/alerts.yml:120` | to measure (the prompt's "silent no-op" is **not** accurate: it logs + metric + alert) |

**Checked and not a finding (measured, so nobody re-opens them from a stale prompt):**
- `/me/*`: 23 `authFromRequest(req)` calls and 23 `kind !== 'customer'` checks in `api/src/app/api/v1/me/`.
- Zarinpal: `currency: 'IRT'` at both construction sites, `api/src/lib/zarinpal.ts:40` and `:67`.
- Status sets: `ACTIVE_RESERVATION_STATUSES` contains legacy `arrived`. ⚠️ **Contradiction to the founder
  prompt:** `cancelled_by_user` / `cancelled_by_restaurant` are terminal. Adding them to the *active* set
  would make cancelled bookings block tables. The correct invariant is "every enum value is classified
  exactly once", and it is not yet checked whether `api/tests/reservation-status.test.mts` asserts it.
- Runner: 198 `*.test.mts` on disk, every one imported by `_all.runner.mts`, enforced by `pretest` →
  `tools/check-runner-completeness.mjs`. The executed test count comes from the fresh-DB runs (LANES).

## Frontend

| ID | Sev | Lvl | Finding | Source | Status |
|---|---|---|---|---|---|
| FE-01 | critical | 3 | **main CI has been red since 09-10**, and nothing downstream of e2e has had a verdict since. `b3e22da` (DS-007 §6) removed `#sWhen` / `#sParty`, but 4 specs in `booking-context`, `card-slots:41` and `social-proof:66` still drive them, in all 3 browser projects. The spec fix exists only on the candidate. The 09-16 handoff's «main سبز است» referred to the guard scripts, not to CI | run `35055753423` (cf60b9c): `e2e (desktop-chrome|mobile-safari|mobile-chrome)` = failure, 6 failed each; `e2e/tests/booking-context.spec.ts:32` | measured (public Actions API + annotations) |
| FE-02 | major | 5 | Business dashboard: while `!_wlLoaded && token`, the waitlist card shows «در حال گرفتنِ صف…». If the fetch **fails**, is loading shown forever? That would be an error state rendered as loading (directive 046 residual) | `apps/business/js/overview.js:128-131` | claim (CEO) · line measured · failure path not yet driven |
| FE-03 | major | 5 | `dashboardUsingDemoData()` is true for a **logged-in** restaurant whenever any of three loads has not completed, so a failed load leaves sample names on a live dashboard. They are disclosed by a banner, but an error still reads as data | `apps/business/js/overview.js:483-486`, `:174` | shape measured · failure path not yet driven |
| FE-04 | major | 2 | XSS baseline: 41 sinks classified `unsafe` and 18 `review` across 19 files. None is individually proven to carry user text or not, and 77 of 122 declared overrides match no sink. With tokens in `localStorage`, any one of them carrying stored text is account takeover | `tools/xss-sink-audit-report.json` (`by_classification`) | measured counts · per-sink review not done |
| FE-05 | major | 4 | About 40 frontend contract fixes (panel, customer, company) on `session/rezv-36-backend` are on neither main nor the candidate. Same merge as BE-08 | `git log 99065a7..485fda3` | measured |

**Contradictions to orders, with evidence:**
- CEO P3 «shared/js drift in business/company copies»: **not reproduced.** `sh tools/sync-design-system.sh --check`
  → exit 0 on 99065a7. The differences between copies are the script's own export stripping and
  `window.*` assignments.
- Founder prompt «business panel has ZERO automated tests»: **stale.** `e2e/tests` holds 17 business/panel
  specs. A hand walk is still owed; see `UNKNOWN.md`.

## Design

No rows yet. See `UNKNOWN.md` §Design for the measurements owed. The mechanical sweep (money words,
Persian digits, «چرا؟», dark tokens, notification caps) was delegated to a haiku agent at 14:25 UTC,
and its output is data for the next backlog revision, not findings by itself.

## SEO

| ID | Sev | Lvl | Finding | Source | Status |
|---|---|---|---|---|---|
| SEO-01 | major | 5 | The restaurant page's reserve CTA links to the app's **home**, not the restaurant. A diner who arrives from search loses restaurant, date and party on the one click that matters | `apps/seo/app/r/[slug]/page.tsx:104` | measured |
| SEO-02 | minor | 6 | The Restaurant JSON-LD has no `potentialAction` / `ReserveAction`, even though a public booking flow exists | `apps/seo/lib/schema.ts:148-190` | measured (0 matches in `apps/seo`) |
| SEO-03 | major | 3 | No freshness gate: nothing fails when a published page or its JSON-LD diverges from the DB (hours, prices, menu, closures). ISR `revalidate = 300` bounds staleness when fetches succeed, but nothing **checks** it | `apps/seo/app/r/[slug]/page.tsx` (revalidate); `.github/workflows/ci.yml` job `seo` | measured (no such tool among `tools/*.mjs`) |
| SEO-04 | minor | 6 | No `/events` page in `apps/seo` (routes present: `/`, `/r/[slug]`, `/r/[slug]/menu`, `/city/[city]`, `/cuisine/[cuisine]`, sitemap, robots) | `apps/seo/app/` | measured |
| SEO-B1 | — | — | **Blocked:** outside-network verification (crawler UA vs edge 403, OAI-SearchBot, rich-results test on a live page) needs a public domain. `E-001`: no domain, `ENOTFOUND` on 09-13 | `docs/audit/founder/STATE.md` §3 | blocked on the owner |

Measured and not a finding: `lang="fa" dir="rtl"` in both Next apps. The menu renders as HTML with
Menu / MenuSection / MenuItem JSON-LD. `AggregateRating` is emitted only when `reviews_count > 0`.
robots is `*: allow /`, so OAI-SearchBot is not blocked by our file, although the edge is unverified
(SEO-B1). The sitemap is generated from `GET /api/v1/seo/sitemap`.

## Delegation

| Work | Model | Kept by this session |
|---|---|---|
| api route / auth / Zarinpal / status / runner enumeration | haiku (Explore) | the `/me` count re-measured (23/23); status-set judgement |
| frontend demo paths, API path diff, innerHTML counts, design-system diff, CACHE_VERSION | haiku (Explore) | sync-check re-run (exit 0); XSS counts re-read from the report |
| apps/seo + landing structure, JSON-LD, robots/sitemap | haiku (Explore) | CTA line, ReserveAction absence, freshness-gate absence re-measured |
| design mechanics (money words, digits, «چرا؟», dark, notifications) | haiku (Explore) | deposit-on-confirm re-measured (DS-01); the rest is UNKNOWN until re-measured |
| demo-fallback sites across 3 apps; write paths on 8 ledger tables | haiku (Explore) | its "0 test cleanup paths" was wrong — re-measured with git grep (33 sites) |
| root cause, sibling judgement (BE-05), ordering, every verification | — | this session |

## Revision 2 — 2026-09-17

**Status changes:** BE-01 submitted on `impl/rezv-85-p0-1-candidate @ 8cdc6e9`, accepted as submitted
by the CEO. FE-01 was fixed by the merge candidate itself, and its proof is in FIX-BE-01.md. BE-02
scope widened to 8 tables by CEO rulings D-16 (`sms_transactions` FK → RESTRICT) and the
`platform_events` 90-day floor on `ingested_at`.

| ID | Sev | Lvl | Finding | Source | Status |
|---|---|---|---|---|---|
| FE-06 | critical | 5 | Full-Stack B-1: HTTP 500 from `/restaurants` rendered six `[DEMO]` restaurants as «۶ رستوران فعال»; siblings: boot painted samples before the API answered; events showed samples on network loss | `apps/customer/js/api.js`, `apps/customer/js/init.js`, `apps/customer/js/data/discover.js` | **submitted** `impl/rezv-85-p0-0-demo-trap @ b496991` (CEO D-19); merge waits on rezv-75 re-verify |
| FE-07 | major | 5 | Company panel: HTTP error → `RESTAURANTS_SAMPLE` (`[DEMO]`-labelled); `hours.js` / `photos.js` samples on `res.offline` | `apps/company/js/api.js:199`, `apps/company/js/hours.js:78`, `apps/company/js/photos.js:88` | open; rezv-75 classifies reachability first |
| FE-08 | minor | 3 | Flake with a possible real-UX cause: the «لغو» click lands mid page-transition, pointer intercepted by `#page-chat`, `nav.nav`, `nav.botnav`; candidate 1/48, FE-06 tree 8/78 (confounded) | `e2e/tests/cancel-window-disclosure.spec.ts:84` | open; rezv-75 measures de-confounded, audited as UX |
| FE-09 | major | 2 | F003: `USER_BANNED` returns the admin's internal ban note to the banned user in `details.reason`; banned-login screen shows a wrong-code toast | `api/src/lib/errors.ts:50`, `api/src/app/api/v1/auth/otp/verify/route.ts:35`, `api/src/app/api/v1/auth/refresh/route.ts:76` | **owned by rezv-1b** (CEO queue change 09-17: owner ordered rezv-1b; M-13/M-14/M-15) — not started here |
| FE-10 | major | 5 | F002: `no_show`, `rejected`, `expired` all render «لغوشده» while the SMS says no-show | `apps/customer/js/reservation.js:29`, `:159` | **owned by rezv-1b** (CEO queue change 09-17: owner ordered rezv-1b; M-13/M-14/M-15) — not started here |
| BE-12 | critical | 2 | F001: a guest 17 min late goes confirmed → running_late → no_show in **one** cron tick, with no prior signal; cashback −40, a strike, reliability 75 → 0. CEO D-18: base grace default 15 (10–60), guest extension default 15 (0–30), pre-no-show signal mandatory | `api/src/lib/lifecycle.ts:407` | **owned by rezv-1b** (CEO queue change 09-17: owner ordered rezv-1b; M-13/M-14/M-15) — not started here; runtime-proven by rezv-1b |
| BE-13 | major | 2 | m-14: 10 concurrent OTP guesses beat the attempts cap of 5 — read, compare and increment are separate statements | `api/src/lib/otp.ts:219-221` | claim (Red Team live probe); bounded by per-IP rate limit |
| DS-01 | major | 5 | The deposit policy is not on the confirm step: `depositLabel` renders on step 1 and on the restaurant page, never in `bookStep3`, whose «تأیید رزرو» button is the tap that commits. Cancellation consequence **is** on step 3. No deposit **amount** exists anywhere in the customer app (0 matches) | `apps/customer/js/data/booking.js:134`, `:412-445`; `apps/customer/js/data/detail.js:236` | measured |

## Revision 3 — 2026-09-17 ~00:45 UTC

**Status changes:** **BE-02** submitted, `impl/rezv-85-090-append-only @ 247d103` + addendum `eeff902`
(migration 090: 8 tables, D-16, platform_events 90-day floor on `ingested_at`, SET NULL decision upheld by
the CEO, partition-retention procedure measured). **BE-03** submitted, same branch `@ 553ecf4` (schema-drift
layer 5 over 9 tables + 2 FKs; §6 guard widened and wired into CI). Both wait for the Red Team.

| ID | Sev | Lvl | Finding | Source | Status |
|---|---|---|---|---|---|
| BE-14 | major | 3 | Module-level `beforeEach`/`afterEach` in api test files are registered on the **root** of the one-process runner and fire before *every* test in the suite. One throwing hook (`fraud.integration.test.mts:84` once 090 landed) failed 1829 unrelated tests. 15 files have them; the two that 090 broke are fixed in BE-02. CEO: P2, the class-closer is a static guard with a self-test | `git grep -E "^(beforeEach|afterEach)(" -- api/tests` → 15 files (on 99065a7) | open (CEO: after 090 lands) |
