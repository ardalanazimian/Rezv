---
name: runtime-smoke-live-api-gotchas
description: Concrete runtime gotchas hit while running a full live-API smoke pass against Rezervno's real Postgres+Redis+Next.js stack (A11, round 16, 2026-09-04) — read before writing another live runtime-verification harness against this repo.
metadata:
  type: feedback
---

Six specific, non-obvious things that cost real debugging cycles when running the 55-row
runtime-smoke plan (`audit/round-16/runtime-smoke-plan.json`) against a live stack. All
confirmed by actually hitting them, not by reading source.

1. **`psql -tAc` still appends a command-tag line ("INSERT 0 1") after `RETURNING` output**,
   even in tuples-only mode, on the psql build in `rezv-test-pg`. Capturing an `INSERT ...
   RETURNING id` via `execFileSync` and using the raw stdout as a UUID fails downstream with a
   generic "invalid UUID" error from the API (the newline + tag text got embedded in the id
   string) — the failure surfaces far from the actual cause. Always strip lines matching
   `/^(INSERT|UPDATE|DELETE)\s+\d+\s+\d*$/` before trusting single-value `psql -tAc` output.

2. **`POST /auth/refresh` revokes the OLD refresh token's jti on every rotation**
   (`api/src/app/api/v1/auth/refresh/route.ts`: "rotation: توکن قدیمی را باطل کن"). If a test
   flow does login → refresh → logout(using the pre-refresh token), the logout's revoke is a
   no-op on an already-revoked key, and a naive "did the revoked-key count increase" check
   reports a false FAIL. Test logout with a refresh token that has never been used for a
   refresh call, or count Redis `revoked:*` keys immediately after login before any refresh.

3. **`admin-totp.ts` has anti-replay per 30s step**, backed by Redis `SET NX`. Re-running a
   login script within the same 30-second TOTP window (e.g. iterating quickly while debugging)
   consumes the SAME code twice and the second attempt gets `invalid_credentials` — looks like
   a login regression but is actually the anti-replay guard working correctly. Compute the TOTP
   fresh per attempt or add a deliberate delay between reruns.

4. **Rate-limit buckets in `lib/ratelimit.ts` are keyed per-IP (`rl:<prefix>:<ip>`), not per
   logical actor.** A single-machine test harness that plays platform-admin + restaurant-owner
   + two customers all from `127.0.0.1` shares one 20/min "auth" bucket and one 8/10min "otpv"
   bucket across ALL of them combined — a full 55-row run easily exhausts these mid-script,
   producing 429s that look like product bugs. Clearing `rl:*` in the test Redis at phase
   boundaries (`docker exec rezv-test-redis redis-cli KEYS "rl:*" | xargs redis-cli DEL`, or
   `FLUSHDB` between full reruns) is legitimate test hygiene here — production has thousands of
   distinct IPs and would never hit this collision.

5. **`OTP_DEV_MODE=true` skips `enqueueSms` entirely for the `otp` template** — the code is
   returned directly in the response and no SMS job is ever created (`lib/otp.ts` `requestOtp`).
   Any smoke-plan row whose `side_effects` field says `"sms otp (enqueueSms otp.ts:158)"` will
   NOT show that job in the `jobs` table when dev mode is on — this is correct, documented
   behavior (see [[otp-dev-mode-and-demo-fallback]]), not a missed side effect.

6. **Newly provisioned tables have an empty `qr_code`** — it's lazily assigned the first time
   staff calls `GET /restaurant/tables/{id}/qr` (`tables/[id]/qr/route.ts:38`,
   `table.qrCode ?? await assignQrCode(...)`). A customer QR check-in test needs that GET called
   as staff first; reading straight from `tables.qr_code` right after provisioning gets an empty
   string. Also: **`POST /waitlist/:id/accept` requires `?token=<guest_token>`** for
   non-authenticated (guest) waitlist entries — the token is returned at join time; omitting it
   gives a vague 404 "entry not found" (deliberately vague, to avoid ID-enumeration), not an
   auth error.

Separately: **QR check-in has a real timing constraint that a synchronous smoke test cannot
satisfy from a cold start.** `qrCheckIn`'s valid window is `[slotStart-30min, slotEnd]`, but any
freshly-booked same-day slot is necessarily in the future (you can't book the past) — so
"book the nearest slot, then immediately check in" structurally lands before the window opens.
The happy path (`checked_in:true`) could not be proven this way; only the correct-rejection path
was. This is a real reservation-system property, not a bug — don't spend time trying to "fix" it
by picking a different slot from the same availability response; the gap is inherent unless the
reservation's `slot_start` is fabricated (which stops being a proof of the booking→checkin chain).
