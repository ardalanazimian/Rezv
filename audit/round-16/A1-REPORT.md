# A1 — FEATURE-CENSUS-CUSTOMER — Round 16 report

**Date:** 2026-09-03 · **Branch:** `feat/admin-totp-login` @ `dbec99f` · **Mode:** static trace only (no API, no DB, no `npm test`, no docker; read-only on the repo). Companion data: `audit/round-16/A1.json`.

## 1. Gates (read-only commands, real output)

| Gate | Command | Result |
|---|---|---|
| sw.js drift | `git log -1 --format=%h -- apps/customer/js apps/customer/css` vs `-- apps/customer/sw.js` | both `6e953c2` (2026-08-29) → **no drift**. `CACHE_VERSION = 'rezervno-v40'` (`apps/customer/sw.js:14`). `git status --porcelain -- apps/customer` is empty. |
| standalone build | `python tools/build-standalone.py --check` | `✓ بسته‌ی standalone با منبع هم‌خوان است` · **EXIT=0** (pre-existing warning about orphan `standalone/website.html`, out of scope) |
| prompt injection | all files read (index.html, 30 js modules, sw.js, ~45 api route/lib files, `cron/crontab`) | none found — comments are engineering notes only |
| e2e as map | `grep -L "route(\|page.route" e2e/tests/*.spec.ts` | 33/34 spec files mock the API; only `panels-smoke.spec.ts` does not → e2e is a map, not proof |

## 2. Method

1. Enumerated every interactive element/flow from `apps/customer/index.html` and all `js/**/*.js` (`onclick=`, `addEventListener`, `window.*` bindings, `API.get/post/patch/request`, direct `fetch`). Result: **101 items** (`C01`–`C101`), each with handler → route → `lib/` service → Prisma model → side effects.
2. For each API call, read the route file and the service it delegates to (`api/src/app/api/v1/**/route.ts`, `api/src/lib/*.ts`), confirmed response shape against what the client reads, and traced side effects (`enqueueSms`, `audit(`, points/wallet ledgers, `reservationEvent`, cron wiring in `cron/crontab`).
3. Checked the four UI states per view and whether demo data is labelled.

## 3. Coverage and classification

- `items_total = 101`, `items_verified = 101`, `unverified = []`.
- **REAL 73 · PARTIAL 18 · FAKE 4 · DEAD 5 · DEMO-ONLY 1.**
- Findings: **0 blocker · 11 major · 17 minor.**

The core money-path chain is real and honest: OTP login (`otp.ts:103-160`, SMS via `enqueueSms`, `devCode` only outside production) → availability (`restaurants/[slug]/availability`, online/closed reasons) → `POST /reservations` with `Idempotency-Key` (`reservations/route.ts:73-80`, `withIdempotency`) → `createReservation` (autoConfirm→`pending`, table/slot conflicts, `booking_confirm` SMS at `reservations.ts:410-416`, `reservationEvent`, cashback ledger) → trips list → QR (`reservations/[code]/qr`, server-side SVG, ownership check) → cancel through `transitionReservation` with the economy strike rule (`economy.ts:111-113`) → review gated on a completed visit (`me/reviews/route.ts:41-72`). Waitlist join/accept, chat, missions, reward shop, notification prefs (server-persisted and enforced at every SMS emission site), profile edit, birthday reward (cron `0 9 * * * rewards`, `cron/crontab:28`) and table-QR check-in are all REAL.

## 4. Top findings (full list with evidence in `A1.json`)

**Major**

1. **A1-001 · SW caches authenticated API JSON by URL; logout never purges.** `sw.js:52-56,68-80` puts any 200 `/api/*` GET into `RUNTIME_CACHE` (Cache API ignores `Cache-Control: no-store` from `middleware.ts:104`; `Vary` is only `Origin`, `middleware.ts:83`). `doLogout()` (`api.js:124-133`) clears tokens only. On a network failure `caches.match` returns the previous session's `/me`, `/me/reservations`, `/me/chats`, `/me/loyalty` with `res.ok:true`, so the app renders it as live data — to a different user on a shared device, and including already-cancelled reservations. Escalate to the security lens.
2. **A1-002 · Cancel leaves a stale «پیش‌رو» card.** `trips.js:202` calls `window.renderTrips`, which is never bound (only `openReviewSheetFromTrip` is exported at `reservation.js:215`); in-window cancel returns at `trips.js:227-228` without re-rendering. After a successful `POST …/cancel` the card keeps active «QR ورود»/«لغو» buttons until navigation.
3. **A1-003 · AI strip is hard-coded.** `index.html:166` shows «بر اساس رزروهای قبلی‌ات، احتمالاً آوا روف‌تاپ رو دوست داری…» to every visitor; nothing updates `#aiStripText`; the CTA `openRest(6)` (`index.html:168`) targets a seed id and only toasts «این رستوران فعلاً در دسترس نیست» on live data. FAKE.
4. **A1-004 · Search/filters are page-local.** `discover.js:429-443` filters the loaded page (`PAGE_SIZE = 24`, `restaurants/route.ts:18`) and prints «چیزی برای «q» پیدا نشد» for restaurants that exist on later pages; server `?vibe/?city/?cuisine` never sent; placeholder promises «محله» which is not matched.
5. **A1-005 · Referral reward can never be paid.** UI promises «۵۰۰ امتیاز برای هر دعوت موفق» (`loyalty.js:70`); `createReferral` sends the invitee an SMS (`loyalty.ts:197`) but `completeReferral` (`loyalty.ts:206`) has zero callers.
6. **A1-006 · Discover feed has no error state.** `api.js:349-358` treats a 5xx like offline and returns `R_SAMPLE` (labelled `[DEMO]`/«نمونه») with no message or retry — demo masks a broken production path.
7. **A1-007 · Gift-card purchase exposed while the flag defaults OFF.** Full form on the loyalty page (`rewards.js:42-58`) → `FEATURE_DISABLED` toast (`gift-cards/route.ts:57-59`, `feature-flags.ts:55-56`); the route mints spendable balance with no payment (`feature-flags.ts:38-46`) and the client has no flags endpoint to hide it.
8. **A1-008 · «کیف پول» is a mock.** `trips.js:38-53`: the «افزودن به Apple Wallet» button only toasts «برای افزودن واقعی، سرور فایل pkpass امضاشده می‌سازد»; no wallet route exists. FAKE.
9. **A1-009 · Waitlist decline/leave show fake success.** `waitlist.js:204-212` toasts «آفر رد شد» / «از صف خارج شدی» without checking `res.ok` (`API.post` never rejects, `api.js:56-69`) — offline or 4xx, the sheet closes and the server still holds the entry.
10. **A1-010 · Fetch failure rendered as "nothing exists".** Trips: `reservation.js:122-146` shows «هنوز رزروی نداری» when `GET /me/reservations` fails; economy: `economy.js:92-93` silently drops missions/reward sections. No error state, no retry.
11. **A1-011 · Chat thread has no loading/error state.** `chat.js:88-104` (blank until first poll), `chat.js:124-125` (`if (!res.ok) return;`).

**Minor (17):** trending rail sorts by rating and tags «داغ» unconditionally (`discover.js:326-327`); occasion picker silently falls back to all restaurants (`discover.js:238`); PERKS claim VIP tables / peak priority with no backing logic and the birthday card also promises «سالگرد» which has no write path (`seed.js:62`, `rewards.js:149-152`); dead code — `openReviewSheetFromTrip`, `Store`, seed `BADGES`, `rz_haptics` switch, `showOnboarding`; guest chat button → raw 401 toast (`detail.js:239`, `errors.ts:12`); «DNA غذایی تو آماده‌ست» shown to no-history users who then get the labelled demo (`food-dna.js:210-215`); push never `ready` while waitlist copy promises push (`push-subscribe/route.ts:49,60`, `waitlist.js:30,115`); restaurant-page enrichment failure reads «هنوز منویی ثبت نکرده» (`detail.js:94-107,139`); confirm-step name/phone validated but never sent (`booking.js:281-288,311-319`); «رزرو مجدد» claims a prefill that does not happen (`trips.js:116`); favourites are localStorage-only (`seed.js:65-71`); loyalty/economy error states lack a retry control (`loyalty.js:52`, `economy.js:86`); client `Idempotency-Key` on waitlist routes ignored server-side (0 hits in `waitlist/route.ts`, `waitlist/[id]/accept/route.ts`); offline OTP `1234` on http(s) creates a token-less pseudo-session (`auth.js:66-68,111-120` — permitted by CLAUDE.md, recorded as policy conflict); reservation libs write `reservationEvent` but never `audit()` (`grep -c 'audit(' lib/reservations.ts lib/lifecycle.ts` → 0, 0); `TRIPS.unshift` after a real booking (`booking.js:372`); events section has no loading state (`discover.js:337-369`).

## 5. Deferred items check (mandate §3)

- **QR scanner:** the app offers no scan button; check-in is URL-driven (`?checkin=`, `checkin.js:37-44`) and the server derives the restaurant from the QR credential. Honestly absent, not fake.
- **Discovery-feed photos:** cards render gradient + emoji only (`discover.js:91-104`); real approved photos appear only on the detail page from `GET /restaurants/{slug}` (`detail.js:154-157,192-194`). No placeholder photos.
- **Demo labelling:** `R_SAMPLE` names carry `[DEMO]`, cards/hCards show «نمونه», hero shows «نمونه — دادهٔ آزمایشی», demo slot options carry «(نمونه)» plus a warning banner, trips demo shows a warning banner, DNA demo tags every numeric slide «(نمونه)». The one leak is A1-006 (demo served on http(s) server error) and A1-003 (the AI strip names a demo restaurant without its prefix).

## 6. Working-tree notes

`audit/round-15/ground-truth.json` was already modified and `docs/ml/` untracked when this run started (other agents); nothing under `apps/customer/` or `api/` was touched by A1. Outputs: `audit/round-16/A1.json`, `audit/round-16/A1-REPORT.md`.
