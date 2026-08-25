<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۸۴ endpoint و ۲۶ route» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# API_AUDIT_REPORT — رزرونو

> ممیزیِ ۸۴ endpoint. مبتنی بر خواندنِ واقعیِ کد + جاروبِ الگویی. تاریخ: ۲۰۲۶-۰۷-۲۹.

---

## ۰) خلاصه

API از الگوی **Next.js App-Router route handlers** با نسخه‌بندیِ صریحِ `/api/v1/...` استفاده می‌کند.
پاکیِ REST، پوششِ اعتبارسنجی، error-envelope یکدست، و rate-limit چندلایه **قوی** است. چند
ناسازگاریِ جزئیِ نام‌گذاری/متد در سطحِ «بهبود» وجود دارد، نه نقص.

**نمره‌ی API: ۸.۵ / ۱۰**

## ۱) نسخه‌بندی و ثبات
- همه‌ی endpointهای دامنه زیرِ `/api/v1/` — نسخه‌بندیِ صریح ✅
- ops خارج از نسخه: `/api/health`, `/api/metrics` (قراردادِ استاندارد) ✅

## ۲) متدهای HTTP و منابع
- منابع به‌درستی جمع/سلسله‌مراتبی‌اند: `reservations/[code]/{arrive,cancel,pay}`,
  `restaurant/tables/[id]/state`, `waitlist/[id]/{accept,decline}` — RESTful ✅
- عملیاتِ حالتی به‌صورت sub-resource/POST مدل شده (به‌جای فعل در query) ✅
- **مشاهده‌ی جزئی:** برخی «اکشن»ها (arrive/cancel/pay) POST‌اند که برای side-effect درست است؛
  یکنواختیِ کامل (PATCH وضعیت در برابر POST اکشن) در `reservations` و `restaurant/reservations/[code]/status`
  اندکی متفاوت است — **پیشنهادِ سطح-پایین**، نه باگ.

## ۳) اعتبارسنجیِ ورودی
- **۵۶ / ۸۲** فایلِ route از `parseBody`/`parseQuery` با شِمای Zod-مانند (`lib/schemas.ts`, `validate.ts`) استفاده می‌کنند.
- بقیه عمدتاً GETهای بدونِ بدنه یا با پارامترِ ساده‌اند؛ نمونه‌ها (`events`, `checkin`) ورودی را با
  `z`/`zUuid`/`min/max` اعتبارسنجی می‌کنند ✅
- `validate.ts` تستِ واحدِ اختصاصی دارد (`tests/validate.test.mts`, ۱۰KB) ✅

## ۴) کدهای وضعیت و مدیریتِ خطا
- **error-envelope یکدست**: `{ ok:false, error:{ code, message } }` از `lib/errors.ts` (`Err.*`, `errorResponse`) ✅
- نگاشتِ خطاهای دامنه به وضعیت‌های درست: 400 validation، 401 unauthorized، 403 forbidden/blocked،
  404 notFound، 409 conflict (idempotency/serialization)، 429 rate-limit، 503 degraded ✅
- trace-id روی پاسخ‌ها برای همبستگیِ لاگ ✅

## ۵) Rate-limiting (چندلایه)
`lib/ratelimit.ts` — قواعدِ granular:
| قاعده | سقف | پنجره |
|------|-----|-------|
| otpPerPhone | ۳ | ۱۰m |
| otpPerIp | ۱۵ | ۱۰m |
| otpVerify | ۸ | ۱۰m |
| reservation | ۱۰ | ۱m |
| search | ۶۰ | ۱m |
| auth | ۲۰ | ۱m |
| globalPerIp | ۱۲۰ | ۱m |

- سراسری در middleware + per-route در guardها. fallback به in-memory وقتی Redis قطع است (نه fail-open کامل) ✅

## ۶) Idempotency
- هدرِ `Idempotency-Key` (`lib/idempotency.ts`) با بازیابیِ کلیدهای in_progressِ کهنه (رفعِ H11) و replay پاسخ ✅
- روی مسیرهای حساس (رزرو/پرداخت) — جلوگیری از double-submit ✅

## ۷) Pagination / Filtering / Sorting
- لیست‌ها عمدتاً `take`/`orderBy`/`where` دارند (نمونه: `events` → `take:20`, `orderBy startsAt`).
- **پیشنهاد (سطح متوسط):** یک قراردادِ صفحه‌بندیِ یکدست (cursor یا limit/offset استاندارد) در همه‌ی
  لیست‌های staff‌/admin مستند و اعمال شود؛ اکنون بعضی لیست‌ها take ثابت دارند.

## ۸) CORS / امنیتِ لبه
- `ALLOWED_ORIGINS` (allowlist)، preflight OPTIONS، هدرهای امنیتی کامل (CSP/HSTS/nosniff/frame DENY) ✅
- fail-fast در production اگر `ALLOWED_ORIGINS` تنظیم نشده باشد ✅

## ۹) سازگاری با OpenAPI
- تعریفِ OpenAPI/Swagger صریح **یافت نشد** — **پیشنهاد**: تولیدِ اسپکِ OpenAPI از شِماها برای
  قراردادِ ماشین‌خوان و تستِ قرارداد. (سطح متوسط، غیرمسدودکننده.)

## ۱۰) یافته‌های اولویت‌دار
| # | یافته | شدت | پیشنهاد |
|---|-------|-----|---------|
| A1 | نبودِ اسپکِ OpenAPI | متوسط | تولید از schemas |
| A2 | قراردادِ صفحه‌بندیِ ناهمگون در لیست‌ها | متوسط | استانداردِ cursor/limit مشترک |
| A3 | ناهمگونیِ جزئیِ POST-action در برابر PATCH-status | پایین | یکدست‌سازیِ سند |
| A4 | ~۲۶ route بدونِ شِمای صریح (اغلب GETِ ساده) | پایین | افزودنِ parseQuery حتی برای GETهای پارامتری |
