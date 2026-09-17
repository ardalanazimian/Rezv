# P1-4 Option A (migration 095) + m-19 — design read and the points that need a ruling

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`
- **What it needs from its reader:** rule on **R-1** (it contradicts D-23's text) and confirm or change
  R-2…R-7. No product code has been written. Everything below is measured on main `d9a7232` unless stated.
- **Basis:** D-23 (Option A, consent at login); STATE M-01 and m-19; the repro
  `api/tests/staff-phone-hijack.repro.mts` (on branch `impl/rezv-85-p1-4-package` only; it does not exist on
  main). The file map was produced by a read-only agent and spot-checked.

## What the map changed

1. **The OTP request would block consent.** `auth/staff/request/route.ts:47-58` sends a code only when
   `findStaffForLogin` finds a row. If login selects accepted rows only, a phone whose memberships are all
   unaccepted never gets a code, so it can never consent. The request must still accept "any active
   membership, accepted or not". The enumeration test (`auth-otp-enumeration:175-199`: uniform 204, active
   fixture gets an OTP) stays green that way.
2. **Invite acceptance today is by phone, across all tenants, and also on password login.**
   `acceptPendingInvites(phone)` (`provisioning.ts:265-283`) accepts every PENDING invite for the phone and
   activates those restaurants. It runs from OTP verify (`verify/route.ts:49`) **and** from password login
   (`login/route.ts:40`), where a password proves a username, not the phone.
3. **No UI creates staff rows.** The business panel never calls `POST /restaurant/staff`: `data.js:453-455`
   has only GET and PATCH. Rows come from provisioning, the public trial form, the company panel's
   `admin/staff-credentials` upsert, seeds and the CLI. So consent-at-login costs real staff almost nothing
   today.
4. **Refresh tokens are JWTs with a Redis `jti` blacklist** (`lib/jwt.ts:20-63`), not DB rows. A migration
   cannot revoke existing sessions.
5. **m-19 reaches the landing app.** `TrialForm.tsx:99-138` renders `restaurant.name`, `trial_ends_at`,
   `order.code`, `login.phone` and a `/order/{code}` link on a resubmit (`created:false`), and
   `PurchaseDialog.tsx:148-160` does the same for an open purchase order.

## Points to rule on

### R-1 — backfill evidence (contradicts D-23's text; needs re-ruling)

D-23: "the backfill counts as accepted only with evidence", with "an accepted StaffInvite or a recorded OTP
login" as the evidence.

- **A recorded OTP login into a non-owner row is exactly the artifact R1/R3 produce.** The victim's
  hijacked login writes `staff.login` for the attacker's row. Counting it as consent would retroactively
  accept every past hijack.
- **Recommendation:** only an owner row whose own StaffInvite (`staff_invites.staff_id` = that row) is
  `ACCEPTED` counts. That invite went to the same phone, and only a login of that phone accepted it. Every
  other row starts unaccepted, and its holder confirms once at the next OTP login.
- Impact is nil pre-launch (no deployed environment). Test fixtures that sign tokens directly are
  unaffected, because acceptance is checked at login only (R-4).

### R-2 — password login never accepts anything

- Password login keeps working for its own row: the credentials were issued by that tenant or by our
  admin, so the session stays in that tenant.
- It **no longer** calls `acceptPendingInvites` and never sets `accepted_at`. If it did, whoever set the
  password could "accept" a row carrying someone else's phone.
- This flips `staff-invite-flow:148-157` ("password login also accepts the invite"), listed as part of the
  D-23 contract change.

### R-3 — the OTP verify response (keeping D-23's "single accepted membership keeps today's shape")

| Memberships for the phone (active rows) | Response to `POST /auth/staff/verify` |
|---|---|
| exactly 1 accepted, 0 pending | **today's shape, byte-identical**: `{access, refresh, staff:{…}}` |
| ≥2 accepted, or ≥1 pending | `200 {choose:{selection_token, memberships:[{staff_id, tenant_id, restaurant_name, role, state:'accepted'\|'pending'}]}}`; no tokens |
| 0 | `403` as today |

Then `POST /auth/staff/select {selection_token, staff_id}`:
- An accepted row → tokens in today's shape.
- A pending row → sets `accepted_at`, marks **that row's** invites ACCEPTED, activates **its** restaurant,
  then issues tokens.
- `POST /auth/staff/decline {selection_token, staff_id}` → sets `declined_at`. A declined row is hidden
  from future choosers.

Details:
- `selection_token`: a JWT with its own audience, 5-minute TTL, bound to the normalized phone, single-use
  through the existing Redis `jti` blacklist.
- **Question:** is "1 accepted + pending → chooser" acceptable? The alternative, direct login with the
  pending rows ignored, leaves them unacceptable forever, because no in-session "memberships" screen exists.

### R-4 — where acceptance is enforced

- Enforced at login only: the verify selection, `select`, and the OTP request as in finding 1.
- Per-request gates (`verifiedStaffAuth`, `resolveStaffRestaurant`, `requireAdmin`) and `auth/refresh`
  unchanged.
- Existing sessions cannot be revoked by a migration (finding 4). Pre-launch that is moot. For a real
  deploy the documented step is rotating `JWT_REFRESH_SECRET` once, and I will add that line to the 095
  runbook.

### R-5 — owner uniqueness and R4

- Index 079 becomes `staff (phone) WHERE role = 'owner' AND accepted_at IS NOT NULL`, via a new index
  name in 095 and a drop of the old one. The schema-drift baseline and `schema-drift.integration.test.mts:90`
  are updated.
- The app checks in `provisioning.ts:122`, `site-orders.ts:294` (I-1) and `staff-credentials:119` count
  accepted owners only.
- The trial form's owner row starts unaccepted, so a squatted trial no longer blocks real provisioning (R4).
- Accepting a second owner row for the same phone hits the index → `409 duplicate_owner_phone`, with the
  existing message.

### R-6 — the business panel UI

- `staff-system.js`: a chooser/consent card with 4 states (single → enter; choose; consent with
  accept/decline; none → error), RTL, rendered like the existing cards. It branches before the success
  checks at `:506` and `:607`, and before the token writes in `data.js:276-278` and `:286-290`.
- The `file:` demo branch keeps today's direct entry.
- The regenerated `standalone/business.html` and a new mocked e2e spec (chooser, consent, decline, none).
- `invite.html:69` copy «با ورودِ موفق، حسابت خودکار فعال می‌شود» becomes "after you log in, confirm the
  membership". **Question:** is that copy line in my lane or the Designer's (FP-007)?

### R-7 — m-19

- Server: a resubmit (`created:false`) of the trial or the purchase form returns **no** order, restaurant or
  login fields, only `{created:false, next_step}`. `GET /site/orders/[code]` stays: a code is a
  ~1.07e9-space bearer shown only to its creator, and the route is rate-limited to 30/min.
- Landing: `TrialForm.tsx` and `PurchaseDialog.tsx` render a "this phone is already registered — log in with
  it" state for `created:false`, with no code and no `/order` link.
- **Question:** `apps/landing` is FP-007's Designer lane. May I make this two-component change inside P1-4,
  or does it go to the Designer with the server change landing first? If the server lands first, the
  landing's `created:false` view breaks, because it reads `result.order.code`.

## Plan once ruled

1. Red first: the repro moves into the runner as `.test.mts` (R1, R3, R4 red; R2 already green by I-1),
   plus new tests for R-2/R-3/R-5/R-7.
2. Migration 095, whose header states its independence from 096 and the lexical-order safety.
3. API, then panel, then e2e, then standalone. A mutation per R.
4. Full suite on a fresh clone, drift, guards.
5. Red Team and `rezv-75` before merge, per D-23.

## Not verified by this read

- The panel copy and the design of the chooser card (no prototype).
- Whether anything outside `api/`, `apps/` and `e2e/` reads the verify response shape (not searched).
- Linux CI.
