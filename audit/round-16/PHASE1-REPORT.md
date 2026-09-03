# Round 16 — Phase 1 Feature Reality Census — REPORT (2026-09-03)

**GATE STATUS: CONDITIONAL** (founder directive 2026-09-03) - the CEO's 5-per-agent spot-check (~2%) did not meet the >=20% rule; the CEO is now personally verifying 100% of FAKE+blockers+majors plus a random >=15% of the remaining rows, and REAL rows on money/auth/reservation flows are relabelled REAL-STATIC until a runtime smoke pass. Agents A1-A3 ran on claude-fable-5-1 (inherited default; 0.2 violation, corrected for re-runs).

Gate definition: every visible interactive element/flow classified REAL / PARTIAL / DEMO-ONLY / FAKE / DEAD with `file:line` evidence. Method this round: static trace at `dbec99f` (no live API — A6 owned the DB). Machine output: `feature-census.json`.

| App | Agent | Coverage | REAL | PARTIAL | DEMO-ONLY | FAKE | DEAD | blocker | major | minor | CEO spot-check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| customer | A1 | 101/101 | 72 | 19 | 1 | 4 | 5 | 0 | 11 | 17 | 5 sampled / 4 confirmed / 0 rejected |
| business | A2 | 245/245 | 103 | 30 | 0 | 5 | 5 | 2 | 16 | 17 | 5 sampled / 5 confirmed / 0 rejected |
| company | A3 | 81/81 | 70 | 7 | 1 | 0 | 3 | 0 | 8 | 6 | 5 sampled / 5 confirmed / 0 rejected |

Totals: 325 census rows — {'REAL': 245, 'PARTIAL': 56, 'FAKE': 9, 'DEAD': 13, 'DEMO-ONLY': 2}; findings {'major': 35, 'minor': 40, 'blocker': 2}.

## Blockers

- **A2-001** (business) — The primary username/password login crashes after a successful 2xx: staffPasswordLogin() awaits enterStaffPanel(), which is not defined anywhere in the reposito — `apps/business/js/staff-system.js:L468,L471,L472 (calls) vs L556 (function enterPanel); grep -rn enterStaffPanel -> only ` — **fixed — 580cf7f (+ e2e business-password-login.spec.ts, mutation-proven)**
- **A2-002** (business) — On the reservations tab every row action (رسید/نشاند/نیومد/وضعیت/لغو/تاریخچه) passes the row index of the freshly fetched `source` array, but the handlers read  — `apps/business/js/reservations.js:L54-58,L65,L162-168,L179,L200,L205; apps/business/js/data.js:L42,L56,L661 (only RES ass` — **open**

## Fixed by the CEO in this round (with falsifiable tests)
- A3-001 → `37b2a82` — company flag switch now renders (label map); XSS overrides re-pinned; gates 0.
- A2-001 → `580cf7f` — business password login no longer throws; new e2e `business-password-login.spec.ts`; mutation → red, restore → green.

## Top majors per app (full lists in each A*-REPORT.md)

### customer
- A1-001 — Service worker caches authenticated API GET responses (/api/v1/me, /me/reservations, /me/chats, /me/loyalty …) in RUNTIM
- A1-002 — Both cancel paths leave the reservation card stale after a successful POST …/cancel: the late-cancel dialog calls window
- A1-003 — The «پیشنهاد هوشمند برای تو» strip is hard-coded marketing shown to every visitor (including anonymous): «بر اساس رزروها
- A1-004 — Search, vibe chips and occasion picker filter only the client-loaded page (PAGE_SIZE=24) and report «چیزی برای «q» پیدا 
- A1-005 — The referral promise «۵۰۰ امتیاز برای هر دعوت موفق» can never be fulfilled: POST /me/referral creates the Referral row a

### business
- A2-003 — 'رزرو جدید' sends restaurant_id = STAFF_INFO?.restaurant_id. STAFF_INFO is only set by the OTP path and is null after an
- A2-004 — The offline Outbox entry for a manual reservation uses restaurant_id:'self', date:'today|tomorrow|upcoming' and a Persia
- A2-005 — changeStatus() calls renderResList() (which re-fetches from the server) before the PATCH is sent and does not re-render 
- A2-006 — loadWaitlist sets _wlLoaded=true regardless of fetch result; after a 403/500/timeout the 'نمونه' note is hidden and WL_D
- A2-007 — loadStaff sets _staffLoaded=true even on failure, so STAFF_DEMO (ids demo1/demo2, ۰۹۱۲۰۰۰۰۰۰۱) renders as the real team 

### company
- A3-001 — The company panel does not render the admin_otp_login_enabled switch, so the only kill-switch for the TOTP-bypassing OTP
- A3-002 — On an http(s) deployment, a network failure/timeout during login drops the operator into the DEMO dashboard (labelled ba
- A3-003 — After session restore the dashboard is painted synchronously from RESTAURANTS_SAMPLE before /admin/restaurants and /admi
- A3-004 — Five views derived from the RESTAURANTS array (overview, restaurants, analytics, billing, support) have no loading state
- A3-005 — The provisioning success modal states the first-login invite 'ارسال شد' (was sent) although the API only ENQUEUED the SM

## Notes
- `apps/business/src-v2` was already deleted in `95e95f1`; the mandate text was stale (A2-034).
- Phase-2 (A6 test integrity) did not run: the agent died twice on the session rate limit; rerun scheduled after 14:40 Asia/Tehran. Its task #1 hypothesis was meanwhile confirmed by CI (test job 2.6–2.8 min after the P0-002 fix vs 361-min cancelled hang before).
- No prompt-injection hits reported by any agent.
