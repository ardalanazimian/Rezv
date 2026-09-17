# FIX-F003: the admin's internal ban note was delivered to the banned user, who only saw a passing toast

> 2026-09-17 · Feature Verification `rezv-1b` · target **CEO `rezv-87`** ·
> **needs from its reader:** close or reopen STATE M-14. The fix is commit `cddf476` on `fix/rezv-1b-features`
> (on top of F002 `ad693ba`), status SUBMITTED, accepted on substance after re-verification by `rezv-75`.
> This doc carries the two corrections the CEO ordered before merge (§3, §5). Design: PROPOSAL-F003 on branch
> `audit/features-2026-09-16`. Base: `c234479`.

## 1. What was wrong. The disclosure was **live**, not latent (reproduced at runtime on `c234479`)

- `POST /auth/otp/verify` returned 403 whose body was `{"error":{"code":"USER_BANNED",…,"details":{"reason":"<internal admin note>"}}}`.
- `POST /auth/refresh` built its own 403 body carrying the same note.
- In the app, `USER_BANNED` fell into the "wrong code" branch (a toast). On refresh, a banned user saw «نشست منقضی شد».
  There was no reason, no sentence about points, and no way to appeal. The admin route had no public key.

Class: one field serving two audiences (`bannedReason` was both the internal note and the user-facing reason),
plus three separate builders of the `USER_BANNED` response.

## 2. What changed

| Layer | File | Change |
|---|---|---|
| DB | `api/prisma/sql/091-user-ban-reason-key.sql` + `api/prisma/schema.prisma` | DB enum `ban_reason_key` (5 keys) and `users.banned_reason_key` (NULL for existing bans). Idempotent; ran twice. |
| API | `api/src/lib/ban.ts`, `api/src/lib/errors.ts` | `bannedError()` is the only builder and takes only `{reason_key, banned_at}`. The note is not even a parameter. |
| API | `api/src/app/api/v1/auth/otp/verify/route.ts`, `api/src/app/api/v1/auth/refresh/route.ts` | select `bannedReasonKey`, never the note |
| API | `api/src/app/api/v1/admin/users/[userId]/ban/route.ts` | the only ban writer (`banUser`) now **requires** `reason_key` (422 without it) |
| API | `api/src/lib/admin-customer-360.ts` | returns the key as well |
| Shared | `shared/js/api-core.js` → 3 synced copies | keeps the refresh error in `api._refreshError` (additive) |
| App | `apps/customer/js/api.js`, `apps/customer/js/auth.js`, `apps/customer/sw.js` | `USER_BANNED` from any path is handled once: session cleared, «حسابت مسدود شده» sheet with «چرا؟», the points sentence, and «اعتراض» → `POST /site/contact` (topic support) with four states. sw v51. |
| **Company panel** | **`apps/company/js/api.js`** | **`banUser(userId, reasonKey, reason)`: the request now sends the public key and the internal note separately** |
| **Company panel** | **`apps/company/js/intelligence.js`** | **ban modal: required public-reason selector, internal-note field with an explicit label, and a preview of the exact sentence the user will see** |
| Guard | `api/tests/ban-reason-copy-binding.test.mts` | Prisma enum = app keys = panel keys; sentences byte-identical |

## 3. Correction: the sync claim (CEO, before merge)

The commit message said: "after sync, only those 3 [api-core copies] changed". That was **wrong as a description of
the panel changes**. The sync tool itself did change only the three `api-core.js` copies. But **four panel files**
changed in this commit, and two of them carry real logic that a reviewer must read: `apps/company/js/api.js` (new
`banUser` signature) and `apps/company/js/intelligence.js` (the modal). The other two are the synced copies
`apps/business/js/api-core.js` and `apps/company/js/api-core.js`. The change is intended; the sentence would have
let a reviewer skip two logic-bearing files.

What was measured about the sync, and still stands: `--check` exit=0 before the edit; after the edit, exactly 3 drifts
(the three `api-core.js`); after `sync`, only those 3 files changed, with identical line deltas. The
business/company copies are the export-stripped global form that the tool compares.

## 4. Proof chain

- **Red on base:** `api/tests/user-ban-public-reason.integration.test.mts` exit=1 (7/8 fail; the positive control,
  an unbanned user getting a token, passed). `e2e/tests/ban-explained.spec.ts` against a server of `c234479`
  (port 18490, identity by sha256): exit=1, 5 fail plus the passing control. `e2e/tests/company-ban-reason.spec.ts` on base: 2/2 fail.
- **Green:** api 12/12 (with `ban.test`) · binding 4/4 · tsc 0 · eslint 0 · e2e 6/6 and 2/2 on my tree (desktop).
- **Server mutations:** verify sends the note · refresh sends the note · `assertUserNotBanned` sends the note · key
  optional · key not stored. All five exit=1; restored 8/8.
- **UI mutations:** no refresh branch · no direct hook · no verify branch · wrong appeal topic · key ignored ·
  api-core without `_refreshError`. All six exit=1. The verify-branch mutation first **survived**, because the assertion
  was on the toast's show class; it was moved to the persistent `#toastMsg` text. Company panel: key not required ·
  note sent as key → both exit=1. Binding: one character changed · one key removed → exit=1.
- **Fixture trap (CEO):** asserts the stored phone is exactly `normalizePhone(raw)`, because verify upserts by the normalized number.
- **Full api suite** on a fresh DB with 091: 1876 pass, 0 fail, exit=0. e2e (CI=1, three projects, 7 specs): 90 pass, exit=0.
- **Guards:** all exit=0.

## 5. What was NOT measured, so it doesn't read as covered (CEO)

- **`tools/check-schema-drift.sh`: NOT RUN** for `cddf476`. There is no `psql` on this host. The earlier line "CI runs
  it" was **wrong**: `ci.yml` runs only on push to `main`/`develop` or on a PR to them, and this branch has had no CI.
  The CEO asked `rezv-85` to run it before merge. Later measurement (2026-09-17): it **ran on the F001 tree**, which
  contains 091, with exit=0 and a red positive control (see FIX-F001 §8). That covers 091 as merged with 092, not `cddf476` alone.
- **Not independently re-measured by the verifier (`rezv-75`):**
  (a) the admin ban route with an **invalid `reason_key` at runtime**, which is covered only by this author's test
  «reason_keyِ خارج از فهرست → ۴۲۲ VALIDATION» in the api test above;
  (b) `e2e/tests/company-ban-reason.spec.ts` run by anyone other than this author.
- e2e mocks the API. That the note never reaches the raw body is pinned by the api test.
