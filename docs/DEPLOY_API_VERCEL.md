<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۸۳ route» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# دیپلویِ بک‌اندِ API روی Vercel — و اتصالِ فرانت‌ها

> چرا این سند: در حالِ حاضر `/api/v1/*` روی دامنه‌های فرانت **۴۰۴** می‌دهد.
> این یک باگِ کد **نیست** — بک‌اند در سطحِ کد سالم است (پایینِ همین سند).
> مشکل، **پیکربندیِ دیپلوی** است. این سند دقیقاً می‌گوید چه باید تنظیم شود.

## معماری (یادآوری)
- ریشه‌ی ریپو = فرانتِ استاتیک؛ `apps/{customer,business,company}` هرکدام یک پروژه‌ی
  استاتیکِ Vercel. `.vercelignore` پوشه‌ی `api` و زیرساخت را از دیپلویِ ریشه کنار می‌گذارد.
- `api/` = یک Next.js 14 (App Router) با ۸۳ route زیرِ `src/app/api/v1/**` — یک
  **پروژه‌ی Vercel جداگانه** با **Root Directory = `api`**.

## ریشه‌ی ۴۰۴ (دو مورد، هر دو باید رفع شوند)

### ۱) Root Directory پروژه‌ی API
اگر Root Directory روی `api` تنظیم **نشده** باشد، Vercel ریشه‌ی استاتیک را بیلد می‌کند،
هیچ serverless functionای ساخته نمی‌شود و `/api/v1/*` ⟶ ۴۰۴.
- Vercel → پروژه‌ی API → **Settings → Build & Deployment → Root Directory = `api`**.
- Framework Preset: **Next.js** (باید دستی انتخاب شود — `api/vercel.json` دیگر وجود ندارد).
- Deployment Protection (Vercel Authentication/SSO): برای هاستی که فرانت به آن می‌زند
  باید **Off/Standard** باشد، وگرنه درخواست‌های API با ۴۰۱/redirect برمی‌گردند.

### ۲) اتصالِ دامنه‌ی فرانت به API
فرانت‌ها با پیش‌فرض `base = ''` به **same-origin** `/api/v1` می‌زنند. چون API روی
دامنه/پروژه‌ی جداست، مرورگر روی دامنه‌ی استاتیک `/api/v1` را می‌زند که چیزی آنجا نیست ⟶ ۴۰۴.
یکی از این دو را انتخاب کن:

- **الف) same-origin با rewrite (توصیه‌شده برای production):** روی هر پروژه‌ی فرانت،
  یک `vercel.json` با rewrite که `/api/:path*` را به دامنه‌ی API پروکسی کند. مزیت:
  بدونِ CORS، کوکی/هدر same-origin.
- **ب) دامنه‌ی جدا با override:** آدرسِ کاملِ API را بدونِ build تنظیم کن (این PR این را
  برای **هر سه اپ** یکسان کرد — منبعِ واحد `resolveApiBase()` در `shared/js/api-core.js`):
  - `<meta name="rz-api-base" content="https://api.example.com">` در `index.html` هر اپ، یا
  - `window.RZ_API_BASE = 'https://api.example.com'` پیش از لودِ کلاینت.
  - در این حالت API باید هدرهای **CORS** را برای دامنه‌های فرانت بفرستد.

> پیش‌فرضِ `''` (same-origin) دست‌نخورده است؛ حالتِ دمو/آفلاین و e2e مثلِ قبل کار می‌کنند.

## متغیرهای محیطی لازم (Vercel → Settings → Environment Variables)
از `api/.env.example`:
- `DATABASE_URL` — از **pooler** استفاده کن (Supabase Pooler/PgBouncer، پورت ۶۵۴۳،
  `?pgbouncer=true&connection_limit=...`) نه اتصالِ مستقیم.
- `JWT_SECRET`، `JWT_REFRESH_SECRET`
- `REDIS_URL`، `REDIS_PASSWORD`
- `OTP_DEV_MODE` — در production حتماً **خاموش** (تا کدِ ۱۲۳۴ دمو در prod نپذیرد).

## Cronها
⚠️ **منسوخ (۲۰۲۶-۰۸-۲۸):** `api/vercel.json` حذف شد. بک‌اند روی Vercel مستقر نیست —
یک کانتینرِ بلندمدت پشتِ Caddy است (`deploy/caddy/Caddyfile`)، و
`api/docker-entrypoint.sh` با مدلِ serverless سازگار نیست.
**منبعِ حقیقتِ زمان‌بندی `cron/crontab` است** (سرویسِ `cron` در `docker-compose.yml`)،
که ۹ job دارد — همان ۸ تای قبلی به‌علاوه‌ی `reminders` که در نسخه‌ی Vercel نبود.

## سلامتِ بک‌اند (تأییدشده در همین کار — سطحِ کد)
- `npx prisma generate && npx tsc --noEmit` ⟶ **صفر خطا**.
- `npm test` (تست‌های واحد) ⟶ **۱۰۱ passed / ۰ failed**.
- endpointِ سلامت: `GET /api/health` واقعاً DB و Redis را پینگ می‌کند (۲۰۰ سالم / ۵۰۳ قطع).

⟶ نتیجه: کدِ بک‌اند آماده است؛ برای رفعِ ۴۰۴ فقط تنظیماتِ بالا در داشبوردِ Vercel لازم است.
