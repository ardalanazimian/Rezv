# FIX-BE-04-I1 — the trial form refuses a phone only when it already owns a business

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it first
- **What it needs from its reader:** attack the narrowed check. **Status: submitted.** This closes R2 of
  P1-4 only; R1, R3 and R4 stay open for Option A (D-23).
- **Branch:** `impl/rezv-85-i1-trial-owner-check`, on `2b65897` (`ceo/main-ready-0917`)
- **Authority:** CEO ruling D-23 ("I-1 is approved now as a separate small commit").

## The claim fixed

BE-04 / P1-4 R2, reproduced live by `api/tests/staff-phone-hijack.repro.mts` (on branch
`impl/rezv-85-p1-4-package` only; it does not exist in this tree until Option A lands). The owner of tenant A adds phone P as `manager` (`POST /v1/restaurant/staff`, 201, no proof that A knows the
holder of P). The holder of P then submits the public trial form and gets
`422 «این شماره از قبل حسابِ کسب‌وکار دارد؛ از همان شماره وارد پنل شوید.»` Following that advice logs them
into tenant A.

## Root cause and class

- **Root cause:** `createTrialAccount` (`api/src/lib/site-orders.ts`) treated **any** `staff` row with the
  phone as "this phone already has a business". A staff row is written by a third party with no proof,
  so it is not evidence of that.
- **Class:** identity or authorization derived from data a third party can write (the same class as P1-4).
- **Siblings, swept with `git grep` over `api/src` for phone-keyed `staff` lookups:**

| Site | State |
|---|---|
| `api/src/lib/provisioning.ts:121` | already narrowed to `role: 'owner'` on 2026-09-11; this fix copies that shape |
| `api/src/lib/site-orders.ts:294` | **this fix** |
| `api/src/lib/staff-helpers.ts:205` (`findStaffForLogin` fallback: oldest row of any role) | open: this is R1/R3, the login side. Option A of D-23 |
| trial form writes `role: 'owner'` with no OTP (`site-orders.ts`, BE-05) | open: this is R4. Option A of D-23 |

## Diff

`api/src/lib/site-orders.ts`: `db.staff.findFirst({ where: { phone }, … })` becomes
`db.staff.findFirst({ where: { phone, role: 'owner' }, … })`. The comment above it now records why.
The error text, status and idempotent resubmit path are unchanged.

New test `api/tests/site-trial-owner-check.integration.test.mts` (phone prefixes `0996`/`0997`, owned by
this file), imported by `api/tests/_all.runner.mts`. It uses the real routes (`restaurant/staff` POST,
`site/trial` POST) and `provisionBusiness`:

1. A phone that another tenant made `manager` with no proof can still create a trial: **201**. There is
   exactly one owner for that phone and it is **not** in the other tenant. The other tenant's row is left
   untouched, because this fix neither deletes nor confirms it.
2. Control: a phone that already **owns** a business still gets **422** with «از همان شماره وارد پنل شوید»,
   and no second owner is created.
3. Control: resubmitting the same trial is still idempotent (**201**, then **200**, one owner).

## Proofs: tested

Every run used a fresh clone of the `tmpl_090` template (built from zero: `db push` + `apply-sql` +
test fixups), on Postgres 17 + Redis 7 on Windows.

| Step | Result |
|---|---|
| RED (test file on the unfixed tree) | `tests 3 · pass 2 · fail 1` · **exit 1**. Test 1: `expected: 201 · actual: 422` with the exact message above. Controls 2 and 3 pass, so the test fails for the reason under test only |
| GREEN (with the fix) | `tests 3 · pass 3 · fail 0` · **exit 0** |
| Mutation (`role: 'owner'` removed by a file-written script that exits 3 unless its anchor matches exactly once) | `tests 3 · pass 2 · fail 1` · **exit 1**, same `201 vs 422` failure |
| `check-runner-completeness` | **exit 0** (202 files) |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| Full api suite, fresh clone | `tests 1894 · pass 1894 · fail 0 · cancelled 0` · **exit 0** (the base had 1891; +3 is this file) |
| Every `node tools/*.mjs` guard in the tree's `ci.yml` (19), on a detached clean checkout of the commit | first run: **18 exit 0, 1 exit 1**. `check-doc-path-refs` caught this document linking the repro file, which is not in this tree. The sentence now says so. Rerun on the final commit: see the commit's VERIFICATION block |

## What this does NOT fix or verify

- **R1 and R3 stay open.** A holder of P who never onboards and logs in by OTP still lands in tenant A.
  After this fix, a holder who **does** onboard gets an owner row, and `findStaffForLogin` prefers owner
  rows, so their login goes to their own tenant. That is reasoned from `staff-helpers.ts:197-206`; this
  file does not drive the login route. The P1-4 repro's R1 is the test for it.
- **R4 stays open.** The trial form still writes an owner row with no OTP, so anyone can squat a phone's
  owner slot. After this narrowing, the squatted owner row is exactly what blocks the real holder's trial,
  which is the same outcome R4 already describes. It is not a new hole. Option A closes it.
- The stale staff row in tenant A is not removed or flagged. That is a consent decision (Option A).
- Linux and CI: not run. The branch is not `main`/`develop` and has no PR, so CI does not trigger.
- The landing form's own copy after a 201 for this phone: not looked at (FP-007 lane).
