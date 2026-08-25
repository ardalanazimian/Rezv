<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۴۶ و ۷۹ route» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# رزرونو — حسابرسی اتصال فرانت↔بک‌اند + امنیت (۲۰۲۶-۰۷-۲۱)

## بخش ۱ — اتصال فرانت به بک‌اند (✅ تأییدشده)

**روش:** استخراج همه‌ی endpoint هایی که فرانت صدا می‌زند + تطبیق با route های واقعی بک‌اند.

- **۴۶ endpoint** در فرانت صدا زده می‌شود؛ **هر ۴۶ تا route واقعی در بک‌اند دارند** (صفر endpoint شبح).
- بک‌اند ۷۹ route دارد (بیشتر از مصرفِ فعلیِ فرانت — طبیعی).

**الگوی اتصال (درست و یکدست):** هر صفحه اگر توکن (لاگین) داشته باشد داده‌ی واقعی از API می‌گیرد،
وگرنه روی دیتای نمونه می‌افتد (`if(API.getToken())`). این progressive enhancement است، نه فیک.

**فیچرهایی که قبلاً فیک بودند و حالا واقعی‌اند (تأییدشده):**
- staff → `loadStaff()` از `/restaurant/staff`
- waitlist analytics → عدد ۱۴۲ فقط fallback آفلاین؛ آنلاین از `/restaurant/waitlist/analytics`
- coupons/automations → `API.couponsList()` / `API.automationsList()`
- customer drilldown، hours editor، branch switcher → همه به API واقعی وصل
- company: overview/BI/security/system-health → `/admin/*` واقعی

**نتیجه:** هیچ فیچری صرفاً فیک نیست؛ همه در حالتِ لاگین‌شده به بک‌اند و دیتابیس واقعی وصل‌اند.

## بخش ۲ — بازبینی امنیتی کد (✅ دفاع‌ها پیاده شده‌اند)

> ⚠️ این **بازبینی کد** است، نه اجرای حمله. تستِ واقعیِ بار/حمله نیاز به بک‌اندِ
> دیپلوی‌شده دارد و باید با k6 (اسکریپت‌های `loadtest/`) روی محیطِ خودت اجرا شود.

| تهدید | دفاعِ پیاده‌شده | محل |
|---|---|---|
| **DDoS / flood** | Rate limit لایه‌بندی‌شده (sliding window روی Redis): global ۱۲۰/min per IP، auth ۲۰، reservation ۱۰ | `lib/ratelimit.ts` |
| **DDoS (لایه ۲)** | IP ban خودکار بعد از تخلفِ مکرر (`isBanned`/`recordViolation`) | `middleware.ts` |
| **Redis down** | fallback به rate-limit in-memory (نه fail-open کامل) | `middleware.ts` |
| **Bot / OTP abuse** | OTP: ۳ بار per phone + ۱۵ per IP در ۱۰ دقیقه؛ مقایسه‌ی timing-safe | `lib/otp.ts` |
| **SQL injection** | صفر `queryRawUnsafe`؛ فقط `$queryRaw` پارامتری (Prisma escape می‌کند) | کل `src/lib` |
| **XSS** | `esc()`/`chatEsc()` روی همه‌ی داده‌ی کاربر قبل از innerHTML (۲۹ بار در crm.js و...) | همه‌ی اپ‌ها |
| **CSRF** | JWT در header (نه کوکی) + چک Origin روی درخواست‌های mutating + fail-fast اگر ALLOWED_ORIGINS نباشد | `middleware.ts` |
| **payload DoS** | سقفِ حجمِ body (۱۰۰KB) در `safeJson` | `lib/security.ts` |
| **JWT** | fail-fast اگر secret <۳۲ کاراکتر؛ access ۱۵m + refresh ۳۰d با rotation/blacklist | `lib/jwt.ts` |
| **security headers** | HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | `middleware.ts` |

## بخش ۳ — تستِ بار ۴۰۰هزار کاربر (اسکریپت آماده، اجرا با تو)

**چرا نمی‌توانم خودم اجرا کنم:** (۱) بک‌اند هنوز دیپلوی نشده؛ (۲) این محیط شبکه‌ی خروجی
ندارد؛ (۳) ۴۰۰هزار درخواست به یک سرویس بدون هماهنگی خودش DDoS است.

**اسکریپت‌های آماده در `loadtest/`:**
- `k6-scale-400k.js` — بار مقیاس‌بالا با think-time واقعی (راهنمای k6 Cloud داخلش)
- `k6-security-probe.js` — تستِ کنترل‌شده‌ی rate-limit/injection/auth/XSS
- `README.md` — نحوه‌ی اجرا + چک‌لیستِ زیرساختِ لازم برای مقیاس

**واقعیتِ مقیاس:** «۴۰۰هزار کاربر همزمان» را نمی‌توان از یک ماشین تولید کرد — نیاز به
k6 Cloud یا چند instance موازی دارد. و پیش‌نیازش این است که زیرساخت مقیاس‌پذیر باشد
(چند instance API، Postgres replica، Redis cluster — کدش آماده است، فقط env می‌خواهد).
