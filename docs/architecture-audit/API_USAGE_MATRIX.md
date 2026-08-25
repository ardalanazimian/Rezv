<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۸۳ endpoint» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# API_USAGE_MATRIX — رزرونو

> نگاشتِ هر endpoint ← مصرف‌کننده. مبتنی بر جاروبِ path-literal در هر سه اپ. تاریخ: ۲۰۲۶-۰۷-۳۰.
> ستونِ «تأیید»: ✅ literal مستقیم · 🔶 داینامیک (needs verification) · ⛔ مصرف‌کننده یافت نشد.

## مشترک (لایه‌ی api.js هر اپ)
| Endpoint | Method | Auth | مصرف | تأیید |
|----------|--------|------|------|-------|
| /auth/otp/request·verify | POST | عمومی | ورودِ مشتری | ✅ |
| /auth/refresh, /auth/logout | POST | توکن | نشست (هر ۳ اپ) | ✅ |
| /auth/staff/request·verify | POST | عمومی | ورودِ پرسنل (business) | ✅ |
| /telemetry | POST | عمومی | analytics.js (هر ۳) | ✅ |

## اپ مشتری
| Endpoint | Method | Auth | اکشن/صفحه | تأیید |
|----------|--------|------|-----------|-------|
| /restaurants(+?cursor) | GET | عمومی | فیدِ کشف | ✅ |
| /restaurants/[slug]/availability | GET | عمومی | شیتِ رزرو | ✅ |
| /restaurants/[slug]/chat | POST | عمومی | چتِ رستوران | ✅ |
| /restaurants/live-stats | GET | عمومی | نوارِ زنده | ✅ |
| /events | GET | عمومی | رویدادها | ✅ |
| /reservations | POST | مشتری/مهمان | ثبتِ رزرو | ✅ |
| /reservations/[code](+/cancel) | GET/POST | مشتری | جزئیات/لغو | 🔶 |
| /me, /me/profile, /me/points, /me/reservations, /me/referral | GET/PATCH | مشتری | پروفایل/سفرها/باشگاه | ✅ |
| /me/push-subscribe | POST | مشتری | اعلان | ✅ |
| /me/chats(+[id]) | GET/POST | مشتری | پیام‌ها | ✅ |
| /gift-cards(+?code) | GET/POST | مشتری | گیفت‌کارت | ✅ |
| /waitlist(+[id],accept,decline) | GET/POST/DELETE | مشتری | لیستِ انتظار | ✅ |

## پنل کسب‌وکار (`/restaurant/*`)
تأییدشده (literal): analytics, ai, automations, branches, campaigns, cashback, chats(+[id]), coupons, customers(+[userId]), events, heartbeat, hours, members, notes, photos, pricing, reservations(+[code]/events·status 🔶), reviews, rfm, sms, staff, tables(+[id]·state 🔶), waitlist(+analytics), walkin — همه ✅/🔶. + `POST /reservations`.

## پنل شرکت (`/admin/*`)
| Endpoint | Method | مصرف | تأیید |
|----------|--------|------|-------|
| /admin/overview | GET | داشبورد | ✅ |
| /admin/business-intelligence | GET | آنالیز | ✅ |
| /admin/restaurants(+[id]) | GET | لیست/جزئیات | ✅ |
| /admin/restaurants/[id]/sms | GET/POST | شارژِ پیامک | ✅ |
| /admin/restaurants/[id]/control | PATCH | فعال/غیرفعال | 🔶 |
| /admin/security | GET | امنیت | ✅ |
| /admin/system-health | GET | سلامت | ✅ |
| /admin/settings | GET/PATCH | — | ⛔ |

## Cron/Webhook/Ops (مصرف‌کننده‌ی غیرِفرانت)
maintenance/* (۸) ← Vercel Cron ✅ · /payments/callback ← Zarinpal ✅ · /checkin ← QRِ میز ✅ · health/metrics ← ops ✅.

## جمع‌بندی
- **مصرف‌شده:** اکثریتِ ۸۳ endpoint.
- **⛔ بدونِ مصرف‌کننده‌ی تأییدشده:** `/admin/settings`، و (از restaurant panel) `fraud-signals`، `reports` → به UNUSED_BACKEND_REPORT.
- **🔶 needs verification:** `/admin/restaurants/[id]/control`، `reservations/[code]/{events,status}`، `tables/[id]/state` — call-siteِ داینامیک؛ به‌احتمالِ زیاد مصرف‌شده.
- **بدونِ mismatchِ متد/مسیر** بین فراخوان و تعریف.
