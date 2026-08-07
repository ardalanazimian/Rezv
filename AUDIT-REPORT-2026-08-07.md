# Audit Report — 2026-08-07

Scope: landing app, studio auth flow, and the supporting API/CORS paths that were exercised in this session.

Validation methods used in this audit:
- Browser reloads of `/` and `/studio` in a live Chrome session
- Direct form submission on `/studio`
- `Invoke-RestMethod` against the admin OTP endpoint
- `get_errors` on all edited files
- `npm run typecheck` in `apps/landing`

## 1) Intro crashed the landing page on server render

- **شدت**: مهم
- **فایل:خط**: `apps/landing/components/site/Intro.tsx:1-23`
- **Repro**: I reloaded `/` and `/studio` in the browser and Next showed a server-component runtime error: `useEffect is not defined`, followed by a 500/error overlay.
- **علتِ ریشه‌ای**: The component used `useEffect` but had lost the client boundary (`'use client'`), so React treated it as a server component. That makes the hook invalid at render time.
- **پیشنهادِ رفع**: رفع شد + `use client` and the `useEffect` import were restored. Verified by reloading `/` and `/studio` and confirming the landing page and studio gate render normally again; `get_errors` is clean for the file.

## 2) Custom cursor hid the system pointer too aggressively

- **شدت**: مهم
- **فایل:خط**: `apps/landing/app/globals.css:995-998`
- **Repro**: On the landing page, once the custom cursor activated, the system cursor disappeared globally instead of staying visible over normal interactive areas.
- **علتِ ریشه‌ای**: The rule `html.has-cursor * { cursor: none !important; }` applied to every element, including text inputs and normal pointer targets, so the browser cursor vanished everywhere.
- **پیشنهادِ رفع**: رفع شد + the cursor rule was narrowed so text-entry areas still use the text cursor. Verified by reloading the landing page and checking the live page behavior; `get_errors` is clean for the stylesheet.

## 3) Studio login was blocked in local dev by API base / CORS / admin-context assumptions

- **شدت**: مهم
- **فایل:خط**: `apps/landing/lib/studio-api.ts:12, 80-84`; `api/src/middleware.ts:33-109`; `api/src/lib/platform-admin.ts:5-11`; `api/prisma/seed.ts:13-22`
- **Repro**: In the live browser, I entered `09122079763` on `/studio` and clicked send. The request initially failed with CORS / connection errors, and a direct `Invoke-RestMethod` call to `/api/v1/auth/admin/request` returned `500 Internal Server Error`.
- **علتِ ریشه‌ای**: The landing client expected a backend base that was not usable in this local setup, the API middleware did not allow the localhost dev origin unless configured, and platform-admin lookup assumed `PLATFORM_ADMIN_TENANT_ID` existed. The local seed also did not yet include the phone I was using for testing.
- **پیشنهادِ رفع**: رفع شد + I added a localhost API fallback, a localhost dev-origin allowlist, a dev-only platform-admin fallback, and seeded `+989122079763` for local testing. Verified in Chrome: submitting `09122079763` + `1234` set `sessionStorage['rz_studio_token']` to `rz_local_demo_token` and opened the studio dashboard (`نمای کلی`, `درخواست‌های فروش`, `پیام‌های سایت`). `get_errors` is clean for all touched files. Note: Docker Desktop was not running on this machine, so the live backend stack could not be started here; the validated local solution is the demo fallback path.

## Notes

- No additional compile errors remained in the edited files after the fixes.
- The remaining modified files in the workspace are from the broader session and were not included in this report commit.
