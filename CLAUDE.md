# RezervnoOSv2 (رزرونو) — قوانین و راهنمای پروژه برای Claude

> **آخرین هماهنگ‌سازی با کد: ۲۰۲۶-۰۸-۲۵** (روی `main` تا کامیتِ `e0b8157`).
> این فایل با خواندنِ خودِ کد بازبینی شد، نه از رویِ نسخه‌ی قبلی. بخش‌هایی که
> **غلط یا کهنه** بودند با ✅ **اصلاح‌شده** علامت خورده‌اند تا اگر جایی (مثلاً در
> `docs/`) هنوز ادعایِ قدیمی را دیدی، بدانی کدام درست است.

---

## ۱) معماری کلی

**پنج اپِ مستقل + یک بک‌اند.** هر اپ جدا دیپلوی می‌شود و root جدا دارد.

| اپ | مسیر | استک | نکته‌ی حیاتی |
|---|---|---|---|
| اپ مشتری | `apps/customer/` | Vanilla JS **ES Modules** + PWA | ورودی: `js/main.js` با `<script type="module">` |
| پنل رستوران | `apps/business/` | Vanilla JS، **اسکریپتِ کلاسیک** | scope مشترکِ global؛ **ترتیبِ `<script>` مهم است** |
| پنل شرکت/پلتفرم | `apps/company/` | Vanilla JS، **اسکریپتِ کلاسیک** | همان قاعده‌ی بالا |
| وب‌سایتِ عمومی/مارکتینگ | `apps/landing/` | Next.js 16 + React (پروژه‌ی مستقل) | ADR 0002 |
| صفحاتِ SEOِ رستوران‌ها | `apps/seo/` | Next.js 16 + React (پروژه‌ی مستقل) | ADR 0001 |
| بک‌اند | `api/` | Next.js 16 (App Router, Turbopack) · Prisma · PostgreSQL · Redis · JWT | ۱۴۲ فایلِ `route.ts` |

### ✅ اصلاح‌شده — مدلِ ماژولِ اپ‌های Vanilla
نسخه‌ی قبلیِ این فایل می‌گفت «همه‌ی اسکریپت‌های هر اپ یک scope مشترک دارند
(بدون import/export)». این **فقط برای `business` و `company` درست است**:

- `apps/customer/` یک اپِ **کاملاً ES-Module** است (۶۳ خط `import` در `js/`،
  ورودیِ واحد `js/main.js`، زیرپوشه‌های `js/data/` و `js/features/`).
  ⇒ برای همین **با `file://` باز نمی‌شود** و حتماً به وب‌سرور نیاز دارد.
- `apps/business/` و `apps/company/` هیچ `import`ی ندارند (۰ خط): هر فایل با
  `<script src>` در `index.html` لود می‌شود و همه در `window` مشترک‌اند.
  ⇒ افزودنِ فایلِ جدید = افزودنِ `<script>` در جای **درستِ ترتیب**، وگرنه
  تابعْ زمانِ فراخوانی هنوز تعریف نشده است.

### بک‌اند
- همه‌ی endpointها در `api/src/app/api/` هستند (`health`, `metrics`, و
  `v1/...`). اپ‌های پنل هیچ کدِ سرور-سایدی ندارند.
- **دیتابیس**: PostgreSQL + Prisma. migrationها **SQLِ خام** در
  `api/prisma/sql/NNN-*.sql`‌اند و با `api/prisma/apply-sql.sh` اعمال می‌شوند
  (`prisma db execute`، نه `psql` — ایمیجِ runtime کلاینتِ psql ندارد).
- **Redis**: کش + rate-limit + قفلِ اسلات + pub/sub. تمامِ مسیرها باید در نبودِ
  Redis **fail-fast با سقفِ زمانی** باشند، نه هنگ (رجوع به بخشِ ۹).
- **احراز هویت**: JWT (Bearer، بدونِ کوکی، بدونِ NextAuth) — `AccessPayload`
  یا `{sub, kind:'customer'}` یا `{sub, kind:'staff', tenantId, role}`.
- **جلوگیری از double-booking — دو لایه، و ترتیبشان مهم است**:
  1. **لایه‌ی حقیقت**: `EXCLUDE USING gist` روی `[slot_start, block_end)` در
     Postgres (`prisma/sql/026-consolidate-exclusion-constraint.sql` و روی هر
     پارتیشن در `011`). **هرگز حذفش نکن.**
  2. **بهینه‌سازی**: قفلِ اسلات در Redis. اگر Redis نبود، درستی از بین نمی‌رود.

### حالتِ دمو / OTP — دو مسیرِ متفاوتِ کاملاً قانونی، هیچ‌کدام را عوض نکن
1. **بک‌اند** با `OTP_DEV_MODE=true` کدِ واقعیِ *تصادفی* را در پاسخِ API
   برمی‌گرداند (تستِ محلی/CI). در production این متغیر **استثنا پرتاب می‌کند**
   (`api/src/lib/otp.ts:49`) — یعنی bypass ممکن نیست.
2. **کلاینت** وقتی بک‌اند اصلاً در دسترس نیست (`file://` یا پاسخِ آفلاین) کدِ
   ثابتِ `1234` را محلی می‌پذیرد: `apps/customer/js/auth.js`,
   `apps/business/js/staff-system.js`, `apps/company/js/intelligence.js`.
   این fallbackِ آفلاین است، نه رفتارِ سرور.

---

## ۲) 🚨 چک‌های اجباری قبل از هر پوش

**اگر هرکدام خطا داد، پوش ممنوع.** (CI دقیقاً همین‌ها را در ۷ جاب اجرا می‌کند.)

1. **همگام‌سازی دیزاین‌سیستم** — از ریشه: `sh tools/sync-design-system.sh --check`
   → باید «✓ دیزاین‌سیستم با shared/ هماهنگ است» بدهد (صفر مغایرت).
2. **بک‌اند** — داخلِ `api/` و بعد از `npx prisma generate`، به ترتیب:
   `npx tsc --noEmit` → `npm run lint` → `npm test` (هر سه پاک).
3. **اپ‌های Next** — اگر `apps/landing/` یا `apps/seo/` را دست زدی، همان سه
   دستور را **داخلِ خودِ آن اپ** جدا اجرا کن (package.json و تستِ مستقل دارند).
   برای `apps/seo` جابِ CI فقط `npm test` + `npm run build` است (خودِ build
   تایپ‌چک و لینت می‌کند).
4. **E2E Playwright** — برای بخشِ تغییرکرده، **موبایل + دسکتاپ** باید سبز باشند.
   CI روی هر سه پروژه اجرا می‌کند: `mobile-safari` (iPhone 13)،
   `mobile-chrome` (Pixel 5)، `desktop-chrome`. تستی که فقط دسکتاپ پاس شود
   قبول نیست.
5. **مسیرهای شکسته** — هر `<script>`/`<link>` در HTML و هر `import` در ES
   ماژول‌ها باید به فایلِ واقعیِ موجود اشاره کند.
6. **امنیت** — هرگز secret/key/`.env` واقعی کامیت نکن. `api/.uploads/` هم در
   `.gitignore` است و نباید برگردد.
7. **دیتای دمو** — هر داده‌ی آزمایشی باید برچسبِ `[DEMO]` بگیرد
   (مثلاً `apps/customer/js/data/seed.js`). هرگز اسمِ رستورانِ واقعی را جعل نکن.

### جاب‌های CI (`.github/workflows/ci.yml`) — هر ۷ باید سبز شود
`build` (tsc + lint + next build) · `test` (Postgres 17 + Redis 7 واقعی) ·
`security` (`npm audit`: **critical می‌شکند، high فقط هشدار**) · `e2e`
(ایمیجِ `mcr.microsoft.com/playwright:v1.62.1-noble`، API کاملاً mock — بدونِ
DB) · `design-system` · `seo` · `landing`.
⚠️ **Node در CI نسخه‌ی ۲۰ است** (محیطِ محلی ممکن است ۲۲ باشد) — به flagهای
مخصوصِ Node 22 تکیه نکن.
⚠️ نسخه‌ی تگِ ایمیجِ Playwright باید با `@playwright/test` در `e2e/package.json`
یکی بماند؛ با ارتقاء، هر دو را با هم عوض کن.

---

## ۳) 📝 قوانین کامیت و گزارش‌دهی (صداقت در کار)

- **پیامِ کامیت فارسی** و دقیقاً مشخص کند: چه کاری، چرا، و **«تست شده» یا
  «فقط تایپ‌چک»**. تایپ‌چکِ پاک به‌تنهایی دلیل نمی‌شود چیزی کار می‌کند.
- اگر باگِ واقعی پیدا کردی، **بگو با چه روشی**: `curl` روی APIِ زنده، مرورگرِ
  واقعی، اجرای migration روی Postgresِ واقعی، … . این خودش شواهدِ کیفیت است.
- **تغییراتِ پرریسک** (اسکیمای DB، احراز هویت، منطقِ رزرو، قفل‌های همزمانی):
  PR باز کن و منتظرِ CIِ سبز بمان — مستقیم به `main` پوش نکن.
- PRها کوچک و تک‌منظوره؛ merge فقط روی سبزِ کامل (merge-on-green).
- **چیزی را که اثبات نکردی ادعا نکن.** الگویِ پذیرفته‌شده‌ی این ریپو در
  کامیت‌های اخیر: عدد + روشِ اندازه‌گیری (مثلاً «۳۰ کاربرِ هم‌زمان: قبل
  {۴۰۹:۳، ۴۲۳:۲۶} → بعد {۴۰۹:۲۹}» یا «Seq Scan ۱۴٫۲۶ms → Bitmap Index Scan
  ۰٫۱۸ms روی ۱۰۰٬۰۴۵ ردیف»).

---

## ۴) دستورات پرکاربرد

⚠️ **ریشه‌ی ریپو `package.json` ندارد.** بجز شل‌اسکریپت‌های `tools/` و
`docker compose`، هر دستورِ npm باید **داخلِ `api/`، `apps/landing/`،
`apps/seo/` یا `e2e/`** اجرا شود.

| کار | دستور |
|---|---|
| همگام‌سازی دیزاین‌سیستم | `sh tools/sync-design-system.sh` (ریشه) |
| چکِ بدونِ نوشتن (CI) | `sh tools/sync-design-system.sh --check` |
| تستِ بک‌اند | `cd api && npm test` |
| تایپ‌چک / لینتِ بک‌اند | `cd api && npm run typecheck` · `npm run lint` |
| اعمالِ SQLهای دستی | `cd api && sh prisma/apply-sql.sh` |
| migrationِ Prisma (توسعه) | `cd api && npm run db:migrate` |
| seed | `cd api && npm run db:seed` · محتوای سایت: `npm run db:seed:site` |
| **E2E** | ✅ `cd e2e && npm test` |
| E2E فقط موبایل / دسکتاپ | `cd e2e && npm run test:mobile` · `npm run test:desktop` |
| اجرای محلی با داکر | `docker compose --profile http up -d --build` |
| اجرای تولید با HTTPS | `docker compose -f docker-compose.prod.yml up -d --build` (اول `DOMAIN=...` در `.env`) |
| شلِ Postgres در داکر | `docker exec -it rezervno-postgres psql -U postgres -d rezervnodb` |
| ساختِ نسخه‌ی آفلاینِ پنل‌ها | `python3 tools/build-standalone.py` |
| ساختِ پیش‌نمایشِ تک‌فایلیِ سایت | `python3 tools/build-site-preview.py` |

✅ **اصلاح‌شده:** نسخه‌ی قبلی می‌گفت E2E با `npm run test:e2e` در `e2e/` اجرا
می‌شود. چنین اسکریپتی در `e2e/package.json` **وجود ندارد** (فقط در
`api/package.json` هست و چیزِ دیگری است). دستورِ درست `npm test` است.

✅ **اصلاح‌شده:** نسخه‌ی قبلی می‌گفت «حتماً `serviceWorkers: 'block'` را تنظیم
کن». این از قبل در `e2e/playwright.config.ts` تنظیم شده — کاری لازم نیست، فقط
**برش ندار** (کشِ SW منبعِ flake بود).

---

## ۵) ساختارِ پوشه‌ها

### هسته
- `api/src/app/api/v1/` → هر `route.ts` یک endpoint (گروه‌ها: `auth`, `me`,
  `reservations`, `restaurant` (پنلِ رستوران)، `restaurants` (عمومی)، `admin`,
  `site`, `waitlist`, `maintenance`, `media`, `payments`, `seo`, `telemetry`, …)
- `api/src/lib/` → ۷۹ ماژولِ منطقِ کسب‌وکار و کمکی (auth، RBAC، rate-limit،
  reservations، ML، media، …)
- `api/src/middleware.ts` → CORS/CSRF/هدرهای امنیتی + گاردهای fail-fastِ production
- `api/prisma/sql/NNN-*.sql` → migrationهای افزایشی (**بعدی = `055-`**)
- `api/tests/` → ۴۳ فایلِ تست + `_all.runner.mts` (بخشِ ۷ را حتماً بخوان)
- `shared/` → منبعِ **یکتای** دیزاین‌سیستمِ سه پنل + چند اسکریپتِ مشترک +
  `shared/content/site-content.json`. **بدونِ کامپوننت/هوکِ React.**
- `e2e/` → Playwright (۱۳ spec، موبایل‌محور)
- `tools/` → `sync-design-system.sh`, `build-standalone.py`,
  `build-site-preview.py`, `xss-sink-audit.mjs`
- `deploy/` → Caddy و nginx برایِ استقرارِ تولید
- `docs/` → مستنداتِ فنی؛ `docs/adr/` تصمیم‌های معماری (0001 = SEO، 0002 = وب‌سایت)

### پوشه‌هایی که قبلاً اینجا مستند نبودند
- `standalone/` → **خروجیِ تولیدشده**، نه منبع. `customer/business/company.html`
  از `tools/build-standalone.py` و `website.html` از `tools/build-site-preview.py`.
  ⚠️ **دستی ویرایش نکن** — بعد از تغییر در `apps/`، دوباره بساز. (در ممیزیِ
  `47e95ce` دقیقاً همین عقب‌ماندگی پیدا شد.)
- `demo-mvp/` → نسخه‌ی نمایشیِ ثابت با دیتای نمونه (برای پرزنت). چون اپ مشتری
  ES Module است، باید با وب‌سرور باز شود، نه `file://`.
- `design-preview/` → HTMLهای اکتشافیِ طراحی. **منبعِ حقیقت نیستند** و از
  دیزاین‌سیستم عقب‌اند (تنها جایی که هنوز لینکِ Google Fonts دارند).
- `agency/`, `observability/` (Prometheus/Grafana/alerts)، `loadtest/` (k6)،
  `backup/`, `cron/` → ابزار و زیرساختِ جانبی.

---

## ۶) قراردادهای کدنویسیِ بک‌اند

**قبل از نوشتنِ route جدید، یک route موجود را بخوان** (مثلاً
`api/src/app/api/v1/restaurant/menu/route.ts`) و همان شکل را تکرار کن:

```ts
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';   // نه مستقیم از ./validate
import { Err } from '@/lib/errors';
import { db } from '@/lib/db';

export const GET = withRestaurantAuth({ permission: 'canManageSettings' },
  async (_req, ctx) => { /* فقط منطقِ خودِ route */ });
```

- **`withRestaurantAuth`** لایه‌ی مشترکِ rate-limit → auth → tenant → RBAC →
  پوششِ خطاست. این چهار خط را در route تکرار نکن.
- **خطاها**: همیشه از `Err.*` در `api/src/lib/errors.ts` استفاده کن و اجازه بده
  `errorResponse(e)` پاکتِ `{error:{code,message,details}}` را بسازد. کدهای
  موجود دامنه‌ای و معنادارند (`SLOT_FULL`, `TABLE_CONFLICT`, `SLOT_LOCK_TIMEOUT`,
  `RESTAURANT_CLOSED`, `INVALID_STATUS_TRANSITION`, `USER_BANNED`, …).
  **کدِ جدید نساز اگر کدِ موجود دقیقاً همان معنی را دارد.**
- **صداقتِ خطا**: پیامِ خطا باید علتِ واقعی را بگوید. مثالِ ممیزیِ `47e95ce`:
  ۳۰ رزروِ هم‌زمان قبلاً `423 SLOT_LOCK_TIMEOUT` می‌گرفتند (یعنی «دوباره تلاش
  کن») در حالی که واقعیت `409 SLOT_FULL` بود («این ساعت پر است»).
- **اعتبارسنجی**: Zodِ واقعی نصب **نیست**؛ یک شیمِ داخلی با APIِ شبیه‌به‌Zod در
  `api/src/lib/validate.ts` هست که از `api/src/lib/schemas.ts` بازصادر می‌شود.
  همان انضباط، ولی امضاها یکی نیست (مثلاً `.min(n)` پیامِ سفارشی نمی‌گیرد).
  پرایمیتیوهای دامنه (`zPhone`, `zUuid`, `zDateStr`, `zTimeStr`, `zPartySize`)
  را دوباره تعریف نکن. schemaها **immutable**اند (هر متد clone می‌کند) — این
  عمدی است و جلوی نشتِ `.optional()` بینِ فایل‌ها را می‌گیرد.
- **RBAC**: کلیدهای مجوز در `api/src/lib/permissions.ts`
  (`canManageReservations`, `canManageTables`, `canManageWaitlist`,
  `canManageStaff`, `canManageSettings`, `canManageCoupons`,
  `canManageCampaigns`, `canViewAnalytics`, `canViewRevenue`).
  `owner`/`manager` همیشه عبور می‌کنند.
- **Rate-limit**: قوانین در `api/src/lib/ratelimit.ts` → `RULES`
  (`otpPerPhone`, `otpPerIp`, `otpVerify`, `reservation`, `search`,
  `globalPerIp`, `auth`). GETِ سبک = `search`؛ **نوشتن‌ها باید `auth` بدهند.**
- **`bigint` از Postgres**: `SUM(...)`/`COUNT(*)` در `$queryRaw` مقدارِ `BigInt`
  برمی‌گردانند، حتی اگر جنریکِ TypeScript بگوید `number` (فقط assertion است).
  همیشه **هر دو لایه**: `::int`/`::bigint` در SQL **و** `Number(x)` در JS.
- **آپلودِ فایل**: هر تصویری باید از `api/src/lib/media.ts` رد شود —
  تشخیصِ magic-byte (`sniffFormat`)، سقفِ `MAX_BYTES` (۸MB) و
  `MAX_DIMENSION` (۸۰۰۰px). **هرگز آدرسِ آزادِ کلاینت را به‌عنوان منبعِ تصویر
  نپذیر** (مهاجرتِ ۰۵۲ این کار را کرد و ۰۵۳ برش گرداند).

### migrationها
- فایلِ جدید با **پیشوندِ عددیِ بعدی** بساز؛ فایلِ قبلی را **هرگز ادیت نکن**
  (forward-only).
- **idempotent** بنویس: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, …
  و با اجرای دوم روی Postgresِ واقعی امتحانش کن.
- فایلی که راهنما/scaffold است نه migration، خطِ `-- @manual-only` بگیرد تا
  `apply-sql.sh` ردش کند.
- `schema.prisma` را هم با همان تغییر هماهنگ کن (drift در گذشته به مهاجرتِ
  آشتی‌دهنده‌ی `022` منجر شد).

---

## ۷) تست — قواعدی که نادیده‌گرفتنشان قبلاً هزینه داده

### ⚠️ فایلِ تستِ جدید را حتماً در `api/tests/_all.runner.mts` `import` کن
`npm test` فقط همان یک رانر را اجرا می‌کند. فایلی که اینجا import نشود
**بی‌صدا اجرا نمی‌شود**. این واقعاً رخ داده: سه فایل (`ban`,
`crm-recommendations`, `customer-intelligence`) ساخته شدند ولی ثبت نشدند، و
یک PR «۳۷۵/۳۷۵ پاس» گزارش کرد در حالی که عددِ واقعی ۳۵۲ بود.
بعد از افزودن، چک کن که همه‌ی `tests/*.test.mts` واقعاً import شده‌اند.
(برای دیباگِ محلی، اجرای مستقیمِ `tsx --test tests/x.test.mts` همیشه کار می‌کند.)

### استانداردِ تستِ این ریپو (در کامیت‌های اخیر تثبیت شده)
- **کنترلِ مثبت**: تست باید ثابت کند که اگر رفتار غلط بود، fail می‌شد.
- **جهش‌آزمایی (mutation test)**: عمداً چک را خاموش کن و بنویس دقیقاً چند تست
  قرمز شد. اگر هیچ‌کدام قرمز نشد، تستِ تو چیزی را قفل نکرده است.
- **`.integration.test.mts`** برای تست‌هایی که Postgres/Redisِ واقعی می‌خواهند.
- در گزارش، **عدد و روش** بده، نه «تست‌ها سبزند».

---

## ۸) دیزاین‌سیستم، فونت و RTL

### ✅ اصلاح‌شده — حالا **سه** مجموعه‌ی استایلِ مستقل داریم، نه دو تا

| # | برای | فایل | توکن‌ها |
|---|---|---|---|
| A | سه پنل (`customer`, `business`, `company`) | `shared/css/tokens.css` + `foundation.css` + `ds-bridge.css` | `--fs-*`, `--sp-*`, `--lh-*`, … |
| B | وب‌سایت (`apps/landing`) | `app/globals.css` سپس `app/site.css` | **همان نام‌ها**، فایلِ جدا، بدونِ sync |
| C | صفحاتِ SEO (`apps/seo`) | `app/globals.css` | مجموعه‌ی **کاملاً متفاوت و مینیمال**: `--bg`, `--surface`, `--text`, `--brand` |

نسخه‌ی قبلیِ این فایل **دو بار** می‌گفت «`apps/seo` اصلاً هیچ فایلِ CSSی ندارد».
این از ۲۰۲۶-۰۸-۱۹ (کامیتِ `99655c1`) دیگر درست نیست: آن اپ حالا
`app/globals.css` و `public/fonts/vazirmatn-var.woff2` خودش را دارد.
⚠️ `docs/figma-mcp-rules.md` هنوز روی «دو دیزاین‌سیستم» است — آن سند را با این
اصلاح بخوان.

### فونتِ Vazirmatn — سه مسیرِ متفاوت، و همه عمدی
هدفِ مشترک: **هیچ درخواستِ زمانِ اجرا به `fonts.googleapis.com` نرود** (در ایران
در دسترس نیست و تا ۲۰۲۶-۰۸-۱۹ فونت بی‌صدا روی sans-serifِ سیستم می‌افتاد).

1. **پنل‌ها**: `@font-face` در `shared/css/tokens.css` + فایلِ
   `shared/fonts/vazirmatn-var.woff2` که اسکریپتِ sync به `apps/*/fonts/` کپی می‌کند.
2. **`apps/landing`**: `next/font/google` در `app/layout.tsx` — Next فونت را
   **زمانِ build** دانلود و self-host می‌کند، پس زمانِ اجرا درخواستِ بیرونی
   نمی‌رود. این **نقضِ قاعده نیست**؛ ولی یعنی build به شبکه نیاز دارد.
3. **`apps/seo`**: `@font-face` در `app/globals.css` + نسخه‌ی جدا در
   `public/fonts/`. ⚠️ این کپی **در `sync-design-system.sh` نیست** — اگر فونت را
   عوض کردی، این یکی را دستی هم به‌روز کن.

**هرگز `<link>`ِ Google Fonts را به `apps/` یا `shared/` برنگردان.**
(`design-preview/*.html` استثناست: منبعِ حقیقت نیست.)

### `sync-design-system.sh` واقعاً چه می‌کند
✅ بیشتر از چیزی که قبلاً اینجا نوشته بود. `shared/` تنها منبعِ حقیقت است و این
اسکریپت آن را کپی می‌کند (چون هر اپ پروژه‌ی استاتیکِ جدا بدونِ bundler است):

- `css/tokens.css`, `foundation.css`, `ds-bridge.css` → هر سه پنل
- `fonts/vazirmatn-var.woff2` → `apps/*/fonts/`
- `js/icons.js` → **ESM** برای `customer`، نسخه‌ی **global** (بدونِ `export`) برای پنل‌ها
- `js/api-core.js` → ESM برای `customer`، global برای پنل‌ها
- `js/format.js` → فقط پنل‌ها (customer عمداً مستثنا)
- `js/analytics.panel.js` → با جای‌گذاریِ ۵ ثابتِ per-app به
  `business/js/analytics.js` و `company/js/analytics.js`
- `content/site-content.json` → **هم** `apps/landing/content/` **و هم**
  `api/prisma/seed/`

**sync نمی‌شود (مالِ خودِ اپ):** `css/theme.css`, `css/app.css`, `css/panel.css`.
⇒ بعد از هر تغییر در `shared/`، اسکریپت را اجرا کن و **خروجی‌اش را هم کامیت کن**.

### RTL
UI فارسی و راست‌چین است. از `left:`/`right:` استفاده نکن — معادل‌های منطقی
(`inline-start`/`inline-end`) بگذار. استثنای مستند: شماره‌ی موبایل عمداً
چپ‌چین می‌ماند.

---

## ۹) امنیت، پیکربندی و عملکرد

### متغیرهای محیطیِ حیاتی (نمونه در `.env.example` ریشه و `api/.env.example`)
- **`ALLOWED_ORIGINS`** — لیستِ originهای مجاز، **دقیقاً `scheme://host[:port]`**.
  در production گاردِ `api/src/middleware.ts` روی مقدارِ خالی **و مقدارِ غلط**
  (اسلشِ پایانی، نبودِ scheme، مسیرِ اضافه، `*`) fail-fast می‌کند.
  چرا مهم است: مقدارِ *غلط* قبلاً هیچ خطایی تولید نمی‌کرد — API بالا، لاگ تمیز —
  ولی مرورگر هر fetch را بلاک می‌کرد و اپ صادقانه به دادهٔ `[DEMO]` برمی‌گشت.
  یعنی همه‌ی بازدیدکننده‌ها محتوای آزمایشی می‌دیدند. منطقِ نرمال‌سازی در
  `parseAllowedOrigins` (`api/src/lib/security.ts`) است و **هم CORS و هم CSRF**
  از همان یک تابع استفاده می‌کنند.
- **`JWT_SECRET` / `JWT_REFRESH_SECRET`** — حداقل ۳۲ کاراکتر (زمانِ اجرا اجبار می‌شود).
- **`OTP_DEV_MODE`** — در production استثنا پرتاب می‌کند. هرگز روشنش نکن.
- **`METRICS_TOKEN`**, `MAINTENANCE_KEY`, `CRON_SECRET` — محافظِ endpointهای عملیاتی.
- **`NEXT_PUBLIC_MEDIA_BASE`** — لازم وقتی مدیا روی دامنه‌ی دیگری سرو می‌شود
  (مسیرِ نسبی فقط هم‌دامنه کار می‌کند).
- سایر: `DATABASE_URL`, `DATABASE_REPLICA_URL`, `REDIS_URL`,
  `REDIS_COMMAND_TIMEOUT_MS`, `TRUST_PROXY_HEADERS`, `PLATFORM_ADMIN_TENANT_ID`,
  `ZARINPAL_*`, `KAVENEGAR_*`, `SITE_API_BASE`/`SEO_API_BASE`/`NEXT_PUBLIC_*`.

### تاب‌آوریِ Redis
هر مسیرِ Redis باید سقفِ زمانی داشته باشد و بازیابی خودکار باشد. مرجع:
`api/src/lib/redis.ts`. اندازه‌گیریِ واقعیِ ممیزی با Redisِ خاموش —
`/v1/events`: ۲۲٫۰s → ۱٫۰s، `live-stats`: تایم‌اوتِ کامل → ۰٫۸۶s.
جایی که عمداً fail-open است (مثلِ چکِ ban)، باید **لاگِ ساختاریافته + متریکِ
قابلِ‌آلارم** بدهد، نه سکوت.

### هدرهای امنیتی
CSP/HSTS/… در `api/src/middleware.ts`. قبل از تغییر مطمئن شو درخواستِ
SSE/streaming را نمی‌شکنی.

### ✅ اصلاح‌شده — کشِ داده در اپ‌های React
نسخه‌ی قبلی می‌گفت «از React Query استفاده کن». **React Query (`@tanstack/*`)
در هیچ‌کدام از پروژه‌ها نصب نیست.** الگویِ واقعی:
Server Components + `fetch(url, { next: { revalidate: N } })` (ISR).
پیش‌فرضِ رایج `300` ثانیه است — به همین دلیل ویرایشِ منو تا ۵ دقیقه طول می‌کشد
تا عمومی شود (در `docs/KNOWN_LIMITATIONS.md` ثبت شده).
پنل‌های vanilla کشِ خودشان را با متغیرهای global + fetch دستی دارند.
برای تصویر در `apps/landing` از `next/image` (پوششِ `components/site/Photo.tsx`)
استفاده کن.

### هوشیاریِ ML — نشتِ زمانی
هر ویژگیِ آموزشِ مدل باید **نقطه-در-زمان** باشد: فقط از رویدادهایی که *پیش از*
`created_at`ِ همان ردیف **برگزار شده‌اند**. ترتیبِ `created_at` کافی **نیست** —
رزروی که زودتر ثبت ولی دیرتر برگزار می‌شود، نتیجه‌ی آینده‌اش را به گذشته نشت
می‌دهد. الگویِ درست: `CROSS JOIN LATERAL` با شرطِ صریحِ
`h.slot_start < r.created_at` (`api/src/lib/no-show-model.ts`).
⚠️ این نقص روی دادهٔ معمولی دیده نمی‌شد (۰ از ۱۳۷ رزرو فاصله‌ی ثبت↔برگزاریِ
بیش از یک روز داشت) — نهفته بود، نه غایب.

---

## ۱۰) کار با Git و برنچ‌ها

- برنچِ اصلی: **`main`** (همیشه پایدار و قابلِ استقرار؛ merge-on-green).
  برنچِ `develop` **وجود ندارد** (هرچند `ci.yml` هنوز اسمش را در triggerها دارد).
- هر دسته‌کارِ جدید مستقیماً از `main` برنچ می‌گیرد
  (`claude/توضیح-کوتاه` یا `feature/توضیح-کوتاه`) و با PR به `main` برمی‌گردد.
- **PRِ یک برنچ که مرج شد، آن برنچ تمام است.** کارِ بعدی روی همان اسم از رویِ
  `main`ِ تازه دوباره ساخته می‌شود:
  `git fetch origin main && git checkout -B <branch> origin/main`
  — نه کامیتِ جدید روی تاریخچه‌ی مرج‌شده.
- قبل از هر کامیت، چک‌لیستِ بخشِ ۲ را کامل اجرا کن.

---

## ۱۱) یافته‌های باز (ثبت‌شده، هنوز رفع‌نشده)

طبقِ قاعده‌ی «هر دیتای فیک/هاردکد یا ناهماهنگی را ثبت کن حتی اگر همان لحظه
رفعش نکنی»:

- **`apps/business/src-v2/RestaurantIntelligenceDashboard.jsx` یتیم است** —
  یک فایلِ React/JSX داخلِ اپی که اصلاً React ندارد؛ هیچ HTML، اسکریپت یا
  ابزارِ buildی به آن ارجاع نمی‌دهد. یا حذف شود یا دلیلِ ماندنش مستند شود.
- **`docs/figma-mcp-rules.md` روی «دو دیزاین‌سیستم» مانده** در حالی که از
  `99655c1` سه تاست (بخشِ ۸).
- **`README.md` می‌گوید PostgreSQL 16** ولی CI روی `postgres:17` تست می‌کند
  (`docker-compose.yml` هم `postgres:16-alpine` است).
- `ci.yml` هنوز روی برنچِ ناموجودِ `develop` هم trigger دارد.

---

## ۱۲) 🎨 تبدیلِ طرحِ Figma به کد

قبل از تولیدِ کد از رویِ طرحِ Figma، `docs/figma-mcp-rules.md` را بخوان — با این
تصحیح که پروژه **سه** مجموعه‌ی استایلِ مستقل دارد (جدولِ بخشِ ۸)، نه دو تا، و
هیچ‌کدام با هم sync نمی‌شوند. A و B نامِ توکنِ یکسان ولی فایلِ جدا دارند؛
C (اپِ SEO) اصلاً نام‌های دیگری دارد.

---

## ۱۳) یادآوریِ نهایی

- **تمامِ ارتباطات با کاربر به فارسی.**
- UI فارسی و راست‌چین با فونتِ Vazirmatn.
- هیچ‌وقت مستقیم در `node_modules/`، `.next/` یا `standalone/` تغییر نده
  (سومی خروجیِ تولیدشده است — بخشِ ۵).
- **اولویتِ اول: کارکردِ درست و بدونِ باگ، نه ویژگیِ جدید.** بینِ «ساختنِ چیزِ
  تازه» و «تست/رفعِ چیزی که هست»، دومی. لانچ با باگ بدترین حالت است.
- هر دیتای فیک/هاردکد که باید واقعی باشد را به‌عنوانِ یافته ثبت کن (بخشِ ۱۱).
- اگر مطمئن نیستی: «آیا این تغییر با قوانینِ این فایل سازگار است؟»
