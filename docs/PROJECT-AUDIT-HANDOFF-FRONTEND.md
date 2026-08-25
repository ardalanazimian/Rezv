# Rezervno — Frontend Zero-Trust Audit Handoff

**Method:** Direct source inspection of `rezervno-full-app.zip`. No claim below is based on
prior documentation, memory, or assumption — every finding cites the exact file/line checked.
Where a prior claim (from `PROJECT-KNOWLEDGE.md`) turned out **not** to match the served code,
that is called out explicitly, because that gap is the most important output of a zero-trust audit.

Date: 2026-07-19

---

## 0. CRITICAL — Two Frontend Trees Exist, One Is Dead Code

The zip contains **two full copies** of each frontend app:

- `apps/customer/`, `apps/business/`, `apps/company/` — **served** (confirmed via `docker-compose.yml`,
  which bind-mounts exactly these three paths into nginx).
- `customer` doesn't exist at root, but `business/`, `company/`, and bare `js/`, `css/` at repo root
  are the customer app's files living outside `apps/` — **not mounted anywhere, not served.**

Diffed both trees. They have **diverged** (not identical copies):

| App | Files that differ between root copy and `apps/*` copy |
|---|---|
| customer | `js/api.js`, `js/auth.js`, `js/reservation.js`, `index.html` |
| business | `js/data.js`, `js/staff-system.js`, `index.html` |
| company | `js/api.js`, `js/intelligence.js`, `index.html` |

**Risk:** Any developer (or Claude, in a future session) who edits the root copy is silently
editing dead code — changes never reach production and never reach the running app for QA either.
Given the divergence already found, this has clearly happened before.

**Recommendation:** Delete the root-level `business/`, `company/`, `js/`, `css/` directories entirely
(git history preserves them if ever needed), leaving `apps/*` as the single source of truth. This is
a 10-minute fix that removes an entire class of future confusion.

Also found: `apps/business/src-v2/RestaurantIntelligenceDashboard.jsx` — a React component,
**not referenced by any HTML, import, or build config anywhere in the repo** (grep across all
`.html`/`.js`/`.json` returns zero hits). The project has no build step for React at all. This file
is unreachable dead code sitting inside the "live" app directory, which is misleading — it looks
like an implemented feature to anyone browsing the tree. Either wire it up or delete it.

---

## 1. Reality Check: Claimed "Completed" Features vs. Actual Served Code

`PROJECT-KNOWLEDGE.md` states 8+ backend features were "wired to real frontend UI": coupons,
automations, fraud signals, staff permissions, waitlist analytics, hours editor, customer detail
drilldown, QR table check-in. Checked every one against the **served** `apps/*` source. Result:

| Claimed feature | Backend route exists? | Frontend actually calls it? | Verdict |
|---|---|---|---|
| Coupons | `restaurant/coupons` ✅ | No call anywhere in `apps/business` or `apps/company` | ❌ **Not wired** |
| Automations | `restaurant/automations` ✅ | No call anywhere | ❌ **Not wired** |
| Fraud signals | `restaurant/fraud-signals` ✅ | No call in business; company only *displays* a `coupon_abuse_signals` array that comes from `admin/business-intelligence`, a different endpoint | ❌ **Not wired** (a related but different signal is shown) |
| Staff permissions | `restaurant/staff` ✅ | `rStaff()` in `apps/business/js/staff-system.js` renders **3 hardcoded fake employees** ("سارا محمدی" etc.) with a static fake shift table; the "دسترسی" (permissions) button does `onclick="toast('⚙️','تنظیم دسترسی ...')"` — a toast, not a real editor | ❌ **Fully fake UI, zero API wiring** |
| Waitlist analytics | `restaurant/waitlist/analytics` ✅ | `apps/business/js/waitlist.js:7` — `WL_ANALYTICS` is a **hardcoded literal** (`{total_entries:142, seated:98, ...}`), never fetched | ❌ **Fully fake, hardcoded numbers** |
| Hours editor | `restaurant/hours` ✅ | Business "Profile" page (`rProfile` in `crm.js`) only has Gallery + Reviews tabs — no hours UI at all | ❌ **Not present in UI, not just unwired** |
| Customer detail drilldown | `restaurant/customers/[userId]` ✅ | `apps/business/js/crm.js` calls `API.customers(qs)` (list only, with `segment=`/`sort=` query params) — no template literal or code path ever calls the per-user route | ❌ **List exists, single-record drilldown does not** |
| QR table check-in | `POST /api/v1/checkin` ✅ | See §2 below — not connected on either end | ❌ **Not wired; the customer-side QR is also fake** |

**Every single one of the 8 claimed features is not actually connected in the code that is
served to production.** This is the single most important finding in this audit: there is a
systemic gap between "feature marked done" and "feature actually reachable by a user." Before
launch, each of these needs to be either genuinely implemented or removed from the launch-readiness
claims.

Two claims from `PROJECT-KNOWLEDGE.md` that were **not** in the "8 features" list were also spot-checked
and also failed to hold up:

- **"Discovery feed: real restaurant photos now displayed"** — `apps/customer/js/data/discover.js`
  `cardHTML()` still renders `<span class="rc-emoji">${r.e}</span>` over a CSS gradient (`GRAD[r.id]`).
  No `<img>` tag, no `photoUrl`/`coverUrl` field read anywhere in `discover.js`, `detail.js`, or
  `seed.js`. The restaurant card and detail hero are still 100% emoji/gradient placeholders.
- **Multi-branch UI** — backend `GET/POST /restaurant/branches` exists; no frontend call to it
  found in `apps/business` or `apps/company`. No branch-switcher component in either app's JS.

---

## 2. QR Table Check-in — Detailed Trace (worth calling out separately)

- Customer side: `apps/customer/js/features/trips.js` → `showCheckInQR(code, name)` calls
  `qrSVG(code, 180)`. The function `qrSVG` is explicitly commented in the source as
  *"الگوی شبه‌تصادفی قطعی از hash متن (نمایشی)"* — i.e. it draws a **deterministic-looking but
  fake pattern derived from a string hash, explicitly labeled as a demo visual**. It does not
  encode the reservation code as a scannable QR standard (no QR library, no real encoding).
- Business side: grepped all of `apps/business/js` and `apps/business/index.html` for
  `jsqr|qrcode|scanner|getUserMedia|camera` — **zero matches**. There is no scanner, no camera
  access, nothing that could read a QR code even if one were real.
- Backend: `POST /api/v1/checkin` (`{ qr_code }` → `qrCheckIn()`) exists and looks complete.
- **Conclusion:** this is a fully backend-only feature today. The customer sees a nice-looking
  but non-functional "QR ورود" sheet; staff have no way to act on it; the real endpoint is
  unreachable from any UI. This should not be described as launch-ready in any form.

---

## 3. What *Is* Verified Real (don't re-litigate these)

To keep this useful rather than only critical, the following were checked and **do** work end-to-end
(frontend calls real endpoint, response is rendered, not fallback demo data):

- Customer OTP login (`/auth/otp/request`, `/auth/otp/verify`) — real, with local `1234` demo
  fallback only when backend unreachable, matching documented behavior.
- Staff OTP login (business + company) — same pattern, real.
- Business gallery upload/list/delete (`/restaurant/photos`) — real, in `crm.js`.
- Business reviews list + reply (`/restaurant/reviews`) — real.
- Business RFM segment view + AI recommendations + customers list w/ segment filters — real
  (`API.rfm()`, `API.aiRecommendations()`, `API.customers(...)`).
- Reservation status change / check-in via `/restaurant/reservations/{code}/status` (PATCH) — real,
  called from `reservations.js`'s check-in action.
- Table state changes (`/restaurant/tables/{id}/state`) and floor plan CRUD — real.
- Walk-in creation, SMS send, cashback config, pricing config — all call their matching
  `/restaurant/*` endpoints, not stubs.
- Company admin: overview, restaurants list, business-intelligence, security, system-health — all
  call real `/admin/*` endpoints.
- Offline-first `Outbox` queue in business app (`data.js`) — retries writes (check-in, table state)
  when connectivity returns; genuinely well-built resilience pattern, not a placeholder.

---

## 4. Page/Feature Map (served apps only)

**Business app pages** (from `TITLES` object + `nav()` dispatcher in `routing.js`/`data.js`):
`overview, reservations, waitlist, floor, profile, customers, loyalty, analytics, cashback, staff, pricing`.

- Minor bug: `TITLES` map in `data.js:513` has **no `pricing` key**, but `routing.js` dispatches to
  `rPricing` for the `pricing` view and the sidebar has a `data-v="pricing"` button
  (`index.html:68`). Navigating to Pricing will render `tbTitle.textContent = undefined`. Low
  severity, one-line fix (`data.js:513` — add `pricing:'قیمت‌گذاری'` to the object).

**Company app:** login → overview, restaurants list, business-intelligence, security, system-health.
No page for editing `platform_settings` (Zarinpal merchant ID, Kavenegar keys) was found in
`apps/company/js` despite `PROJECT-KNOWLEDGE.md` describing this as accessible from "تنظیمات پلتفرم" —
grep for `platform_settings|merchant_id|zarinpal|kavenegar` across `apps/company/js` returned
nothing use of admin/settings route either. **This blocks the documented Zarinpal onboarding flow**
(owner is supposed to enter merchant ID from the company panel) — worth flagging to whoever owns
payments launch-readiness, since it's listed as a pre-launch blocker already.

**Customer app:** discover/feed, restaurant detail, reservation flow, trips, favorites, loyalty,
profile ("food DNA"), rewards. Auth-gated actions correctly fall back to demo/guest rendering when
no token is present (`if(!API.getToken())` guards throughout `crm.js`, `discover.js`, etc.) — this
pattern is consistent and good practice, not a bug.

---

## 5. Bugs Found, By Severity

**Critical**
- None found that are exploitable security holes in the *served* frontend itself (auth, XSS
  sanitization via `esc()` helper is used consistently in template interpolation across all three
  apps — spot-checked `crm.js`, `discover.js`, `intelligence.js`).
- The gap in §1/§2 is critical from a *launch-readiness accuracy* standpoint, not a security one:
  shipping with staff believing 8 features are live when none are connected is a critical process risk.

**High**
- Staff permissions page is fully fake (see §1) — if RBAC UI is expected before launch, this needs
  real implementation, not just wiring.
- Zarinpal merchant ID / platform settings has no company-panel UI despite being required for the
  payments blocker already tracked in `PROJECT-KNOWLEDGE.md` §9.
- Duplicate/diverged frontend trees (§0) — active risk of future wasted work or shipping stale fixes.

**Medium**
- QR check-in is cosmetic only on both ends (§2).
- Waitlist analytics numbers shown to restaurant owners are fabricated/static, not their real data —
  this is a trust issue if an owner notices "142 total entries" never changes.
- `pricing` nav title bug (§4).

**Low**
- Orphaned `RestaurantIntelligenceDashboard.jsx` (§0) — dead code, no functional impact but a
  maintenance/confusion cost.

---

## 6. Production Blockers (frontend-relevant, additive to existing backend blocker list)

1. Company panel has no UI for Zarinpal/Kavenegar platform settings — blocks the documented
   "owner edits from company panel without redeploy" workflow for the payments launch blocker.
2. Staff permission management, hours editor, and coupon/automation management have **no UI at
   all** — these are not "almost done," they don't exist as screens. Decide before launch whether
   they're in scope; if not, remove them from any "completed" tracking.
3. Root-level duplicate frontend trees should be deleted before anyone continues frontend work, to
   prevent further silent divergence.

---

## 7. Verified Fixes (2026-07-19, second pass — re-audited against updated code)

The frontend team shipped 4 fixes to `apps/business/` plus removed the duplicate root frontend
tree. Each claim was independently re-checked against the actual source (not taken on faith),
per the same zero-trust method as §1. All four hold up:

| Fix | Verified against | Result |
|---|---|---|
| `pricing` title bug | `data.js:516` `TITLES` object | ✅ `pricing:'قیمت‌گذاری'` present. `refreshActiveView()` (`data.js:335`) dispatcher also now includes `profile` and `staff`, which were previously missing from the same object. |
| Waitlist analytics — real data | `apps/business/js/waitlist.js` `loadWaitlist()` vs backend `GET /restaurant/waitlist` and `GET /restaurant/waitlist/analytics` (`lib/waitlist.ts:getWaitlistAnalytics`) | ✅ Field names match exactly (`total_entries, seated, abandoned, conversion_rate, avg_wait_minutes, current_queue_size, vip_entries`). `POST /restaurant/waitlist` is confirmed to be a "promote next" action server-side (not create) — frontend calls it correctly with no body. Hardcoded numbers demoted to `WL_DEMO_*` and only used as offline fallback. |
| Customer drilldown | `apps/business/js/crm.js` `openCustomerDetail()` vs backend `GET /restaurant/customers/[userId]/route.ts` | ✅ Backend returns `{user, clv, risk, segment, is_vip, timeline}` — frontend reads exactly `d.user`, `d.clv`, `d.risk`, `d.timeline`. The mismatch reported as fixed (`d.name`/`d.metrics.*` → `d.user.*`/`d.clv.*`/`d.risk.*`) is real and correctly resolved. |
| Staff / permissions | `apps/business/js/staff-system.js` (`PERM_DEFS`, `rStaff`, `openPermEditor`, `savePermEditor`) vs backend `restaurant/staff/route.ts` | ✅ All 9 permission keys (`canManageReservations` … `canManageSettings`) match the backend `permissionsSchema` exactly. Hardcoded 3-employee list and fake shift table are gone. `owner` role correctly rendered as non-editable (backend also rejects owner permission changes). PATCH body shape `{staff_id, permissions}` matches. |
| Root duplicate frontend tree | filesystem | ✅ Root-level `business/`, `company/`, `js/`, `css/`, and root `.vercelignore` are all gone from the zip. `apps/*` is now the only frontend tree present. |

**One backend gap surfaced during verification (not a frontend bug):** `GET /restaurant/staff`
never returns a `name` field for staff members (only `id, phone, role, restaurant_id, permissions`).
The frontend's `s.name || phone` fallback is correct defensive coding, but it means the staff list
will **always** show phone numbers, never names, until the backend is extended to return one (e.g.
from a linked `User` record or a `Staff.displayName` field, if one exists). Worth a backend ticket
if product expects names to show.

All 4 modified files (`data.js`, `waitlist.js`, `crm.js`, `staff-system.js`) pass `node --check`
with no syntax errors.

`RestaurantIntelligenceDashboard.jsx` (orphaned React component, §0) remains undecided — left
in place as reported, not yet wired or removed.

---

## 8. Recommendation Summary

1. Delete root-level `business/`, `company/`, `js/`, `css/` duplicate trees; keep `apps/*` as the
   only frontend source. (Fast, zero risk.)
2. Re-scope the launch checklist: move coupons, automations, fraud-signals UI, staff permissions,
   waitlist analytics, hours editor, branch switcher, customer drilldown, and QR check-in from
   "done" to "not started (backend only)" until frontend work is actually done and verified — this
   audit found them unwired, not merely partially wired.
3. Fix the one-line `pricing` title bug in `data.js`.
4. ~~Decide the fate of `RestaurantIntelligenceDashboard.jsx`~~ — **deleted 2026-08-21.**
5. Prioritize the company-panel Zarinpal settings screen, since it directly blocks the already-known
   payments launch blocker.

This document should be treated as the current source of truth for frontend state — it supersedes
the feature-completion claims in `PROJECT-KNOWLEDGE.md` §"Feature completion" until those items are
re-verified against updated code.
