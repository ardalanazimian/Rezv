# VERCEL-DEPLOYMENT-CHECKLIST — RezervnoOS

> **چرا این سند وجود دارد.** یک بررسیِ زنده (۲۰۲۶-۰۷-۲۹) نشان داد که پروژه‌های
> فرانت‌اندِ Vercel محتوای اپ را سرو نمی‌کنند: `GET /js/icons.js` (فایلی که در هر
> سه اپ هست) روی هر سه پروژه‌ی فرانت‌اند **۴۰۴** برمی‌گرداند. علت: **Root Directory**
> آن‌ها روی `apps/...` تنظیم نشده (روی ریشه‌ی ریپو مانده و ریشه `index.html` ندارد).
> این همان قدمِ ناتمامی است که `KNOWN_LIMITATIONS.md` هشدار داده بود. چون هر سه
> پروژه یک ریپوی واحد را دیپلوی می‌کنند، **هیچ تغییرِ کدی این را حل نمی‌کند** —
> فقط تنظیمِ داشبوردِ هر پروژه. این سند آن تنظیم را قطعی و قابل‌تکرار می‌کند.

وضعیت: راهنمای پیکربندی · آخرین تأیید زنده: ۲۰۲۶-۰۷-۲۹

---

## ۰) خلاصه‌ی تشخیص (Ground Truth زنده)

| پروژه‌ی Vercel | Root Directory فعلی | وضعیتِ زنده | باید باشد |
|---|---|---|---|
| `rezervno-os` | `api` ✅ | `/api/v1/*` پاسخ می‌دهد (READY) | `api` |
| `rezervno-deploy` | ❌ نادرست | `/js/icons.js` → ۴۰۴ | یکی از `apps/*` |
| `rezervno-os-h245` | ❌ نادرست | `/js/icons.js` → ۴۰۴ | یکی از `apps/*` |
| `rezervno-os-23pl` | ❌ نادرست | `/js/icons.js` → ۴۰۴ | یکی از `apps/*` |

> نکته: چون هیچ‌کدام از سه فرانت‌اند سرو نمی‌کنند، از بیرون نمی‌شد گفت کدام قرار
> است customer/business/company باشد. هنگام تنظیم، هر پروژه را به یکی از سه
> Root Directory زیر اختصاص بده (بدون تکرار). اگر پروژه‌ی چهارمِ فرانت‌اند لازم
> نیست، یکی را حذف کن تا سردرگمی نماند (۳ اپ = ۳ پروژه + ۱ API).

نگاشتِ کانونیِ Root Directory (از `CLAUDE.md` / `DEPLOYMENT.md`):

| Root Directory | اپ | نوع | نکته |
|---|---|---|---|
| `api` | بک‌اند | Next.js 14 | تنها پروژه‌ای که env و cron لازم دارد |
| `apps/customer` | اپ مشتری | استاتیک (PWA) | تنها اپِ دارای `manifest.webmanifest` + `sw.js` |
| `apps/business` | پنل کسب‌وکار | استاتیک | بدون sw/manifest |
| `apps/company` | پنل کمپانی | استاتیک | بدون sw/manifest |

---

## ۱) اصلاحِ هر پروژه‌ی فرانت‌اند (داشبورد Vercel)

برای **هر کدام** از `rezervno-deploy` / `rezervno-os-h245` / `rezervno-os-23pl`:

1. **Settings → Build & Deployment → Root Directory → Edit**
2. مقدار را روی یکی از این‌ها بگذار (هر پروژه یک مقدار، بدون تکرار):
   `apps/customer` · `apps/business` · `apps/company`
3. Framework Preset = **Other** (استاتیک، بدون build). Build Command خالی؛
   Output Directory خالی (خودِ Root Directory سرو می‌شود).
4. **Save** → سپس **Deployments → آخرین deploy → ⋯ → Redeploy**.

### تأییدِ بعد از اصلاح
پس از Redeploy، این‌ها باید **۲۰۰** بدهند (نه ۴۰۴):
```
GET /                     → index.html اپ
GET /js/icons.js          → ۲۰۰
GET /css/tokens.css       → ۲۰۰
# فقط برای customer:
GET /manifest.webmanifest → ۲۰۰
GET /sw.js                → ۲۰۰
```

---

## ۲) پروژه‌ی API (`rezervno-os`) — از قبل درست است

- **Root Directory = `api`** ✅ · Framework = Next.js (auto) · Region `fra1`.
- ⚠️ **کهنه (۲۰۲۶-۰۸-۲۸):** cron دیگر در Vercel تعریف نمی‌شود. `api/vercel.json`
  حذف شد چون بک‌اند روی Vercel مستقر نیست. **منبعِ حقیقتِ زمان‌بندی
  `cron/crontab` است** (سرویسِ `cron` در `docker-compose.yml`).
- **Env varها** باید در Production + Preview ست باشند. فهرستِ کامل و معتبر:
  [`ENVIRONMENT.md`](./ENVIRONMENT.md). حداقل‌های حیاتی:
  `DATABASE_URL`, `DATABASE_DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, `CRON_SECRET`, `MAINTENANCE_KEY`,
  `METRICS_TOKEN`, `KAVENEGAR_API_KEY`, `ZARINPAL_MERCHANT_ID`,
  `PLATFORM_ADMIN_TENANT_ID`, و ۱۳ تمپلیتِ `KAVENEGAR_TPL_*`.

---

## ۳) اتصالِ فرانت‌اند به API

فرانت‌اندها API را از `apps/*/js/api.js` (و `apps/business/js/data.js`) با
`API.base` صدا می‌زنند؛ پیش‌فرض `''` = same-origin (`/api/v1/...`).

- اگر فرانت‌اند و API روی **دامنه‌های جدا** باشند: یا `API.base` را به دامنه‌ی API
  ست کن، یا در پروژه‌ی فرانت‌اند یک `rewrites` بگذار که `/api/*` را به دامنه‌ی API
  پراکسی کند (تا same-origin بماند و CORS/CSRF ساده شود).
- `ALLOWED_ORIGINS` روی API باید شاملِ originِ هر سه فرانت‌اند باشد (CORS+CSRF).

> امیترِ رویدادِ رفتاری (فاز۲) به `${API.base}/api/v1/telemetry` می‌فرستد؛ پس همین
> اتصال برای تلمتری هم لازم است.

---

## ۴) دسترسیِ عمومی (دو مانعِ فعلی)

1. **Deployment Protection روشن است** → `*.vercel.app` برای بازدیدکننده‌ی ناشناس
   **۴۰۳** می‌دهد. برای تستِ عمومی: **Settings → Deployment Protection → Vercel
   Authentication → Disabled** (یا فقط روی Preview نگه‌دار و Production را باز کن).
2. **دامنه‌های سفارشی resolve نمی‌شوند** (`rezervno.ir` / `app.rezervno.ir` →
   DNS `NOT_FOUND`). در **Settings → Domains** هر دامنه را به پروژه‌ی درست وصل و
   رکوردهای DNS را ست کن (Vercel مقادیر A/CNAME را نشان می‌دهد).

پیشنهادِ نگاشتِ دامنه (نمونه):
| دامنه | پروژه |
|---|---|
| `app.rezervno.ir` | `apps/customer` |
| `biz.rezervno.ir` | `apps/business` |
| `admin.rezervno.ir` | `apps/company` |
| `api.rezervno.ir` | `api` |

---

## ۵) چک‌لیستِ نهاییِ «آیا کار می‌کند؟»

- [ ] هر ۳ پروژه‌ی فرانت‌اند: Root Directory روی `apps/*` درست ست شد.
- [ ] بعد از Redeploy: `/`, `/js/icons.js`, `/css/tokens.css` → ۲۰۰.
- [ ] customer: `/manifest.webmanifest` + `/sw.js` → ۲۰۰.
- [ ] API: `/api/health` → ۲۰۰ (یا ساختارِ سلامتِ تعریف‌شده).
- [ ] `ALLOWED_ORIGINS` شاملِ هر سه originِ فرانت‌اند.
- [ ] Deployment Protection برای مسیرِ عمومی تنظیم شد.
- [ ] دامنه‌ها وصل و DNS پاسخ می‌دهد.
- [ ] یک رزرو تستی end-to-end + بازشدنِ هر پنل (QAی دستی؛ از این محیط قابلِ اجرا نبود).

---

## ۶) چرا این دوباره پیش نیاید

- این drift یک **تنظیمِ داشبورد** بود، نه کد؛ در ریپو ردیابی نمی‌شد. این سند آن را
  مکتوب می‌کند. هنگامِ ساختِ پروژه‌ی جدید یا وارد کردنِ دوباره‌ی ریپو، **همیشه**
  Root Directory را طبق جدولِ §۰ ست کن.
- پروژه‌های تکراری/بلااستفاده (نام‌های هش‌دار مثل `-23pl`/`-h245`) را حذف کن تا
  فقط ۴ پروژه‌ی معتبر بماند (۳ فرانت‌اند + ۱ API).
