# P1-4 — staff/owner phone hijack: decision package (red repro + options + recommendation)

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`. This is an auth design choice that changes a locked contract, so
  per your instruction it arrives as a package, not code.
- **What it needs from its reader:** choose A, B or C (§4). Optionally approve the decision-free interim
  I-1 now.
- **Branch:** `impl/rezv-85-p1-4-package` (on `8cdc6e9`). It contains this document and the red repro only;
  no product code changed.

## 1. The repro: live, measured, red

`api/tests/staff-phone-hijack.repro.mts`, run on a fresh clone of the candidate schema with `OTP_DEV_MODE`,
driving the **real routes** (`restaurant/staff` POST, `site/trial` POST, `auth/staff/request` + `verify`,
`provisionBusiness`). It is named `.repro.mts` on purpose: not in the runner, so CI stays green until the
design is chosen. The file becomes `.test.mts` the day the fix lands.

`tests 5 · pass 1 · fail 4 · exit 1`:

| # | Scenario | Measured today | Invariant it asserts |
|---|---|---|---|
| control | provisioned owner logs in by OTP | **ok**: lands in own tenant | — |
| R1 (BE-04/T1) | attacker owner adds victim's phone as `manager` (201, no proof); victim's first OTP login | **not ok**: `status 200, role manager` **in the attacker's tenant** | I1: an OTP login never yields a session in a tenant whose membership the phone holder has not accepted |
| R2 (BE-04) | same, then victim submits the public trial form | **not ok**: `422` «این شماره از قبل حسابِ کسب‌وکار دارد…» (expected 201) | I2: an unaccepted membership never blocks the phone holder's own onboarding |
| R3 (T3) | attacker adds the phone first, the real restaurant adds it later; victim logs in | **not ok**: the attacker's older row wins | I3: between memberships, the phone holder chooses, not row age |
| R4 (BE-05) | anyone submits the trial form with victim's phone (no OTP), then the real owner is provisioned | **not ok**: `CONFLICT` / `duplicate_owner_phone` | I4: an owner row nobody proved never blocks real provisioning |

Harm in R1: the victim works inside the attacker's tenant believing it is their panel. The attacker, as
owner, reads everything the victim enters. R2 forces the victim onto that path.

## 2. Root cause and class

- **Root cause:** a `staff` row is treated as proof of *membership* at login, but it is created without
  the phone holder's participation. OTP proves who holds the phone; nothing ever proves that holder agreed
  to belong to that tenant. `acceptPendingInvites` marks invites accepted as a *side effect* of any login,
  which is not consent.
- **Class:** *identity or authorization derived from data a third party can write.* Siblings in the same
  flow: the trial form's owner row (R4, owner created with no proof at all), and the premise at
  `api/src/lib/staff-helpers.ts:169-172` ("owner is the only role created with a real proof"), which the
  trial path makes false.

## 3. Why this is a package, not a commit

Every fix that turns R1 and R3 green must stop auto-selecting unaccepted memberships. That changes two
things the repo locks:

1. **SPEC-B C10**: "invite acceptance = side effect of the first successful login"
   (`api/tests/staff-invite-flow.integration.test.mts:111-134`).
2. **The response shape of `POST /auth/staff/verify`**: the same test pins `['access','refresh','staff']`
   exactly. A chooser or consent step needs another shape or another route.

## 4. Options

| | A. Consent at login (recommended) | B. Invite link is the only acceptance | C. Server-only narrowing (no consent) |
|---|---|---|---|
| Mechanism | `staff.accepted_at`; OTP login selects **accepted** rows only; unaccepted rows are shown as «دعوت به «X» — می‌پذیری؟» and accepted explicitly (`POST /auth/staff/accept` with a short-lived selection token); two or more accepted rows → chooser | New staff get a `StaffInvite` (SMS link); accept happens on `invite.html` after OTP; login ignores unaccepted rows | Login still auto-picks; only onboarding and provisioning checks are narrowed |
| R1 / R3 | **closed** | **closed** (victim with only an attacker's invite simply cannot log in) | open |
| R2 | closed (trial ignores unaccepted rows) | closed | closed (via I-1) |
| R4 | closed (unique owner index and dup checks apply to accepted owners only; trial owner starts unaccepted) | closed (same) | open, unless the trial form gets OTP (landing change, Designer's lane per FP-007) |
| Contract change | C10 + verify shape (a new `choose`/`consent` response or a second route) | C10 only; verify shape unchanged | none |
| Build | migration (`accepted_at`, backfill, index 079 → `WHERE accepted_at IS NOT NULL`), 2 routes, panel login screens, e2e updates | migration, invite creation on `POST /restaurant/staff`, login filter, panel copy | small |
| Risks | panel UI work (Designer / LE lane); backfill policy for existing rows | **depends on real SMS**, which is still an owner blocker; an attacker-triggered invite SMS naming their restaurant is a phishing surface sent from our number | leaves the takeover open; not a fix |

**Recommendation: A.** It is the only option that closes all four without depending on SMS delivery, and
it keeps the common path (exactly one accepted membership) byte-identical in shape. The C10 change is the
point, not a cost: "accepted because you logged in" was never consent. Backfill: pre-launch, no real
tenants (per the no-deployed-environment finding), so existing rows are backfilled as accepted
(`accepted_at = created_at`), stated in the migration.

**Decision-free interim I-1 (can ship now if you approve):** narrow `createTrialAccount`'s blocking check
(`api/src/lib/site-orders.ts:288`) from "any staff row with this phone" to "an **owner** row with this
phone". That is exactly the narrowing `provisioning.ts:121` already made ("حالا فقط تعارضِ واقعی: یک
ownerِ دیگر با همین شماره"). It turns R2 green, and because login prefers owner rows, a victim who
onboards then logs into their own tenant. It does not touch C10, and it leaves R1/R3/R4 open.

## 5. What I did not verify

- The UI cost of A. The panel login screens were not prototyped.
- Password login (`/auth/staff/login`) with username/password. Username squatting is a different surface
  (the admin creates credentials); not tested here.
- Whether any real tenants exist anywhere that a backfill would affect. U-1/U-5: no DB in reach.
- Linux. Windows only; the repro is not in CI by design.
