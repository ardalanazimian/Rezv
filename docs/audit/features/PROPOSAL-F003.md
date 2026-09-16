# PROPOSAL-F003: a banned person is told why, what happens to their value, and where to object

> 2026-09-17 · Feature Verification `rezv-1b [b233f3]` · target **CEO `rezv-87`** ·
> **needs from its reader:** approve / reject, and sign off the fixed list of user-facing reasons (§2).
> Base: `main` @ `cf60b9c`. Status: **PROPOSED, awaiting CEO approval. No product file changed.**
> Evidence level: **source-traced with positive controls, not run.** I didn't drive a banned login at
> runtime (see `UNKNOWN.md` FU-3). The claims below are about code paths, and each is cited.

---

## 0. The gap

An admin bans a user in the company panel. The next time that person opens Rezervno:

1. They enter their phone. `/auth/otp/request` does **not** check the ban (the file has 0 matches for
   `ban`), so an OTP SMS is sent.
2. They enter the code. `/auth/otp/verify` throws `USER_BANNED`
   (`api/src/app/api/v1/auth/otp/verify/route.ts:35`).
3. The app treats it as a wrong code: the branch commented «کد اشتباه از سرور» shows
   `toast(res.error.message)` (`apps/customer/js/auth.js:121-125`). The toast reads «دسترسیِ این حساب
   توسطِ رزرونو مسدود شده است» (`api/src/lib/errors.ts:50`) and then disappears.

They're given no reason, no word about their points and history, and nowhere to object.
`git grep -iE "USER_BANNED|banned"` over `apps/customer/js` → 0 handling. Positive control: «مسدود»
does hit `apps/customer/js/user-profile.js:96`, so the search works.

**This is anti-pattern #1 in our own research file.** `docs/audit/research/ANTI-PATTERNS.md` §1: "account
suspended … earned value cannot be used", 19% of recent TheFork 1-star reviews. TheFork's clean expiry
policy didn't save it, because "the loss vector was a platform decision". Rezervno repeats the silent half
of that pattern exactly.

## 1. Evidence

| Fact | Where |
|---|---|
| The ban blocks login and token refresh | `otp/verify/route.ts:35`; `api/src/app/api/v1/auth/refresh/route.ts:73-76` |
| The ban blocks booking, waitlist, reviews, missions, rewards | the `assertUserNotBanned(` callers: `reservations/route.ts`, `waitlist/route.ts`, `me/reviews/route.ts`, `me/missions/[id]/claim/route.ts`, `me/rewards/[id]/redeem/route.ts` |
| The ban does **not** touch points or history | `banUser` writes only `db.user.update` plus `audit` (`api/src/lib/ban.ts:36-51`). The points ledger is immutable by decision `FP-009` |
| Gift-card *money* is not at stake today | purchase sits behind a `DEFAULT_OFF` flag until real payment exists (`api/src/app/api/v1/gift-cards/route.ts:47,56`) |
| The admin's free-text reason **leaves the server** | `Err.userBanned(user.bannedReason)` puts it in `details.reason` (`errors.ts:50`; `refresh/route.ts:76`) |
| …and that text was written as an internal note | the admin modal's placeholder is «تخلفِ تکراری، شکایتِ رسمیِ رستوران، ...» (`apps/company/js/intelligence.js:781`). Nothing tells the admin the user can read it |
| Unban is silent | `unbanUser` writes the user row plus audit and notifies nobody (`ban.ts`; `enqueueSms\|push\|notify` → 0) |
| An objection channel already exists | `POST /api/v1/site/contact` takes `name`, `phone` and `topic: 'support'` (`api/src/app/api/v1/site/contact/route.ts:17-26`) |

Rows 5 and 6 together are a **latent disclosure**. Today the customer app doesn't render
`details.reason`, so nothing leaks on screen. But the text is already in the response body, and the obvious
"quick fix" (render `details.reason`) would show a banned user an admin's internal note naming a restaurant
complaint. **That's why the fix must not be the one-liner.**

## 2. Mechanism

**Admin (company panel ban modal).**
- Add a **required** «دلیلی که کاربر می‌بیند», chosen from a fixed list.
- The existing free-text field is renamed «یادداشتِ داخلی (کاربر نمی‌بیند)».

Proposed list, which the CEO signs off:

| key | What the user reads |
|---|---|
| `repeated_no_show` | «چند بار رزرو کردی و حاضر نشدی، بدونِ لغو.» |
| `promo_abuse` | «استفاده‌ی غیرعادی از کد تخفیف، دعوت یا امتیاز دیده شد.» |
| `abusive_conduct` | «گزارشِ رفتارِ نامناسب با رستوران یا کاربرانِ دیگر.» |
| `user_request` | «به درخواستِ خودت.» |
| `under_review` | «حسابت در حالِ بررسی است.» (no promise of a follow-up message: nothing in this proposal guarantees one) |

**API.**
- `USER_BANNED` details become `{ reason_key, banned_at }` only.
- The internal note never leaves the server: the `bannedReason` column stays and keeps being audited.
- `reason_key` is a DB enum (per `CLAUDE.md`: closed sets are DB-level enums).

**Customer app.** On `USER_BANNED`, from verify, refresh or any `assertUserNotBanned` route, show a sheet
instead of a toast:

> **حسابت مسدود شده** — از {banned_at}
> **چرا؟** {the sentence for reason_key}
> **امتیازها و سابقه‌ات چه می‌شوند؟** پاک نشده‌اند؛ تا رفعِ مسدودیت قابلِ استفاده نیستند.
> [اعتراض] → POST /site/contact with topic `support`, phone prefilled, message prefilled «اعتراض به مسدودیِ حساب»

- The value sentence is **true today** (§1, rows 3–4). If a ban ever starts to confiscate anything, this
  sentence must be removed in the same change. That's a guard candidate in the style of
  `tools/check-loyalty-promise.mjs`.

**Why the check doesn't move to `/otp/request`.** Answering "banned" before the OTP would let anyone who
types a phone number learn that its owner is banned. Behind the verify step, only the phone's holder learns
it. The one wasted OTP SMS per banned attempt is the price of not leaking that.

**Unban.** One transactional SMS, «دسترسیِ حسابت برگشت», through an existing template. At most one per
unban. This is a request the user made via «اعتراض», not marketing.

## 3. Change set and blast radius

| File | Change |
|---|---|
| `api/prisma/schema.prisma` + new idempotent SQL migration (proposed, next `NNN`) | `users.banned_reason_key` enum column, nullable for existing bans |
| `api/src/app/api/v1/admin/users/[userId]/ban/route.ts` | `reason_key` required in the body schema |
| `api/src/lib/ban.ts` | persist `reason_key` |
| `api/src/lib/errors.ts` | `userBanned(reasonKey, bannedAt)`, internal note removed from `details` |
| `api/src/app/api/v1/auth/otp/verify/route.ts`, `api/src/app/api/v1/auth/refresh/route.ts` | pass the key, not the note |
| `apps/company/js/intelligence.js` | modal fields; then `python tools/build-standalone.py` |
| `apps/customer/js/auth.js` (+ the shared error path in `apps/customer/js/api.js`) | `USER_BANNED` → sheet; `sw.js` `CACHE_VERSION` bump |

**Blast radius:**
- `Err.userBanned` has callers at `ban.ts:29` and `otp/verify:35`, and refresh builds the body by hand at
  `:76`. All three change together. A test must fail if any of them still emits `details.reason`.
- Existing bans have a null key. The sheet then says «دلیلی برایِ نمایش ثبت نشده — از «اعتراض» بپرس». It does
  **not** reuse `under_review`, which would be a false statement about an old ban. No migration guesses a
  reason.

## 4. Tests that must go RED without it

1. **api integration:** ban with `reason_key: 'promo_abuse'` and internal note `"شکایت رستوران X"` →
   `otp/verify` returns 403 `USER_BANNED` with `details.reason_key === 'promo_abuse'`, and the **raw
   response body does not contain the note text**. The same assertion runs on `/auth/refresh`.
   **Mutation:** put `bannedReason` back in `details` → red.
2. **api:** ban without `reason_key` → `VALIDATION`, not 500.
3. **e2e, customer** (API mocked, **UI only**): `USER_BANNED` on verify → the sheet with «چرا؟» is visible
   and no toast-only path remains. Control: `OTP_INVALID` still shows the wrong-code toast.

## 5. Size · reversibility · product bar

- **Size: T1–T2.** Four API files, two panels, one enum migration (generic scale, see F001 §6).
- **Reversible:** yes. The column is nullable, and the sheet falls back to today's message.
- Money honesty ✅ (value fate stated, and true) · no dark pattern ✅ (objection is one tap from the screen
  that tells them) · restraint ✅ (one SMS on unban only) · honest labels ✅ · explainability «چرا؟» ✅.
