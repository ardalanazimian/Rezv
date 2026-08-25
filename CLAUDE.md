# RezervnoOSv2 (رزرونو) — قوانین و راهنمای پروژه برای Claude

> **آخرین هماهنگ‌سازی با کد: ۲۰۲۶-۰۸-۲۵** (روی `main` تا `a20a388`).
>
> ⚠️ **قاعده‌ی حاکم بر کلِ این فایل، از تجربه‌ی خودش:** یک ادعای «چک‌شده» فقط
> **تا تاریخِ همان چک** معتبر است. نمونه‌های واقعی: ادعایِ «`apps/seo` هیچ CSSی
> ندارد» در ۲۰۲۶-۰۸-۱۲ به‌عنوانِ «اصلاحِ چک‌شده» نوشته شد و در PR #32 باطل شد؛
> و شماره‌ی «آخرین مهاجرت» در هر بازبینی عوض شده (فقط در همین یک روز از ۰۵۴ به
> ۰۵۹ و بعد ۰۶۵ رفت).
> **قبل از تکیه به هر عدد یا فهرستِ اینجا، خودت با `ls`/`grep` تأییدش کن.**

---

## ۱) معماری کلی

**پنج اپِ مستقل + یک بک‌اند.** هر اپ جدا دیپلوی می‌شود و root جدا دارد.

| اپ | مسیر | استک | نکته‌ی حیاتی |
|---|---|---|---|
| اپ مشتری | `apps/customer/` | Vanilla JS **ES Modules** + PWA | ورودی: `js/main.js` با `<script type="module">` |
| پنل رستوران | `apps/business/` | Vanilla JS، **اسکریپتِ کلاسیک** | scope مشترکِ global؛ **ترتیبِ `<script>` مهم است** |
| پنل شرکت/پلتفرم | `apps/company/` | Vanilla JS، **اسکریپتِ کلاسیک** | همان قاعده‌ی بالا |
| وب‌سایتِ مارکتینگ | `apps/landing/` | Next.js 16 + React (پروژه‌ی مستقل) | ADR 0002 |
| صفحاتِ SEOِ رستوران‌ها | `apps/seo/` | Next.js 16 + React (پروژه‌ی مستقل) | ADR 0001 |
| بک‌اند | `api/` | Next.js 16 (App Router, Turbopack) · Prisma · PostgreSQL · Redis · JWT | ~۱۴۶ فایلِ `route.ts` |

هر سه پنل **بدونِ build و بدونِ فریم‌ورک**اند (نه React).

### ✅ اصلاح‌شده (۲۰۲۶-۰۸-۲۵) — مدلِ ماژولِ اپ‌های Vanilla
این فایل تا امروز می‌گفت «همه‌ی اسکریپت‌های هر اپ یک scope مشترک دارند (بدون
import/export ماژول، به‌جز `shared/js/icons.js`)». این **فقط برای `business` و
`company` درست است**:

- `apps/customer/` یک اپِ **کاملاً ES-Module** است — بیش از ۱۵۰ خط `import` در
  `js/` (شاملِ زیرپوشه‌های `js/data/` و `js/features/`)، با ورودیِ واحدِ
  `js/main.js` و `type="module"`.
  ⇒ **با `file://` باز نمی‌شود** و حتماً وب‌سرور می‌خواهد.
- `apps/business/` و `apps/company/` **صفر** خط `import` دارند: هر فایل با
  `<script src>` در `index.html` می‌آید و همه در `window` مشترک‌اند.
  ⇒ فایلِ جدید = یک `<script>` در جای **درستِ ترتیب**، وگرنه تابع زمانِ
  فراخوانی هنوز تعریف نشده است.

### بک‌اند
- endpointها در `api/src/app/api/` (`health`, `metrics`, و `v1/...`). پنل‌ها
  هیچ کدِ سرور-سایدی ندارند.
- **مسیرِ اسکیما در تولید دومرحله‌ای است و هر دو مرحله لازم‌اند**
  (`api/docker-entrypoint.sh`):
  1. `prisma migrate deploy` → مهاجرتِ پایه‌ی `0_init` (خطِ ۳۹؛ روی DBِ
     ازقبل‌موجود اول `migrate resolve --applied 0_init` برای baseline).
  2. `sh prisma/apply-sql.sh` → SQLِ خامِ افزایشی در `api/prisma/sql/NNN-*.sql`
     (خطِ ۵۴).

  ⚠️ نسخه‌های قدیمی‌ترِ این فایل می‌گفتند «اعمال با `apply-sql.sh` — **نه**
  `prisma migrate deploy`». غلط بود و بی‌اهمیت هم نبود: دروازه‌ی
  `tools/check-schema-drift.sh` دقیقاً روی همین مسیرِ دومرحله‌ای بنا شده، و
  `apply-sql.sh` به‌تنهایی از یک DBِ خالی اسکیما نمی‌سازد.
- **Redis**: کش + rate-limit + قفلِ اسلات + pub/sub. هر مسیرِ Redis باید سقفِ
  زمانی داشته باشد و بازیابی خودکار باشد — نه هنگ (بخشِ ۹).
- **احراز هویت**: JWT (Bearer، بدونِ کوکی، بدونِ NextAuth) — `AccessPayload`
  یا `{sub, kind:'customer'}` یا `{sub, kind:'staff', tenantId, role}`.

  ⚠️ **از PR #62:** توکن به‌تنهایی منبعِ حقیقت **نیست**. گاردهای حساس
  وجود/فعال‌بودن/تنانت و حتی نقش را از **دیتابیس** می‌خوانند:
  `verifiedStaffAuth` (`api/src/lib/with-restaurant-auth.ts`) و `requireAdmin`
  (`api/src/lib/admin-auth.ts`). دلیل: کارمندِ اخراج‌شده نباید تا انقضایِ توکن
  (۱۵ دقیقه) دسترسی نگه دارد. گاردِ جدید را با همین الگو بنویس و **خروجیِ
  `requireAdmin` را حتماً مصرف کن** — promiseِ شناور یعنی گاردِ بی‌اثر (دقیقاً
  همان باگی که ۲۳ نقطه‌ی فراخوانی داشت).
- **جلوگیری از double-booking — دو لایه، و ترتیبشان مهم است**:
  1. **لایه‌ی حقیقت**: `EXCLUDE USING gist` روی `[slot_start, block_end)`
     (`prisma/sql/026-consolidate-exclusion-constraint.sql`، و روی هر پارتیشن
     در `011`). **هرگز حذفش نکن.**
  2. **بهینه‌سازی**: قفلِ اسلات در Redis. نبودِ Redis درستی را از بین نمی‌برد.

### حالتِ دمو / OTP — دو مسیرِ متفاوتِ کاملاً قانونی، هیچ‌کدام را عوض نکن
1. **بک‌اند** با `OTP_DEV_MODE=true` کدِ واقعیِ *تصادفی* را در پاسخِ API
   برمی‌گرداند (تستِ محلی/CI، نه ثابت روی ۱۲۳۴). در production این متغیر
   **استثنا پرتاب می‌کند** (`api/src/lib/otp.ts`) — bypass ممکن نیست.
2. **کلاینت** وقتی بک‌اند اصلاً در دسترس نیست (`location.protocol==='file:'`
   یا پاسخِ آفلاین) کدِ ثابتِ `1234` را محلی می‌پذیرد:
   `apps/customer/js/auth.js`، `apps/business/js/staff-system.js`،
   `apps/company/js/intelligence.js`. fallbackِ آفلاین است، نه رفتارِ سرور.

---

## ۲) 🚨 چک‌های اجباری قبل از هر پوش

**اگر هرکدام خطا داد، پوش ممنوع.**

1. **همگام‌سازی دیزاین‌سیستم** — از ریشه: `sh tools/sync-design-system.sh --check`
   → باید «✓ دیزاین‌سیستم با shared/ هماهنگ است» بدهد (صفر مغایرت).
2. **بک‌اند** — داخلِ `api/` و بعد از `npx prisma generate`، به ترتیب:
   `npx tsc --noEmit` → `npm run lint` → `npm test` (هر سه پاک).
3. **اپ‌های Next** — اگر `apps/landing/` یا `apps/seo/` را دست زدی، همان دستورها
   را **داخلِ خودِ آن اپ** جدا اجرا کن. برای `apps/seo` جابِ CI فقط `npm test` +
   `npm run build` است (خودِ build تایپ‌چک و لینت می‌کند).
4. **E2E Playwright** — برای بخشِ تغییرکرده، **موبایل + دسکتاپ** باید سبز باشند.
   سه پروژه: `mobile-safari` (iPhone 13)، `mobile-chrome` (Pixel 5)،
   `desktop-chrome`. تستی که فقط دسکتاپ پاس شود قبول نیست.
5. **تازگیِ بسته‌ی آفلاین** — اگر چیزی در `apps/customer`, `apps/business` یا
   `apps/company` عوض کردی، از ریشه: `python tools/build-standalone.py --check`.
   ⚠️ **چرا گیتِ اجباری است** (یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۳): `standalone/*.html`
   خروجیِ **تولیدشده‌ی commit‌شده** است، نه منبع. از ۲۰۲۶-۰۸-۱۸ بازتولید نشده
   بود، پس بسته‌ی آفلاین — همان چیزی که `standalone/README-website.md` به کاربر
   می‌گوید بازش کند — هنوز **همه‌ی** باگ‌هایی را تحویل می‌داد که در منبع رفع شده
   بودند، از جمله یک P0 که کلِ مسیرِ رزرو را می‌شکست. آرتیفکتی که بی‌صدا کهنه
   شود از نبودش بدتر است. اگر check قرمز شد: `python tools/build-standalone.py`.
6. **مسیرهای شکسته** — هر `<script>`/`<link>` در HTML و هر `import` در ES
   ماژول‌ها باید به فایلِ واقعیِ موجود اشاره کند.
7. **امنیت** — هرگز secret/key/`.env` واقعی کامیت نکن. `api/.uploads/` هم در
   `.gitignore` است و نباید برگردد.
8. **دروازه‌ی انحرافِ اسکیما** (اگر `schema.prisma` یا `prisma/sql/` را دست زدی) —
   از ریشه: `ADMIN_URL=postgresql://…/postgres sh tools/check-schema-drift.sh`
   → باید «بدونِ انحراف» بدهد.
   ⚠️ چرا جدا از تایپ‌چک و تست است: `db push` (مسیرِ CI) و
   `migrate deploy + apply-sql.sh` (مسیرِ تولید) دو اسکیمای متفاوت می‌سازند.
   اگر فیلدی به `schema.prisma` اضافه کنی و مهاجرتِ SQL ننویسی، **همه‌ی تست‌ها
   سبز می‌شوند و تولید در زمانِ اجرا می‌شکند** — «CI سبز، تولید خراب» که هیچ
   تستی نمی‌گیردش.
9. **مهاجرتِ جدید** — همیشه فایلِ `api/prisma/sql/NNN-*.sql` با شماره‌ی *بعدی* و
   idempotent (`IF NOT EXISTS`). **هرگز فایلِ مهاجرتِ قبلی را ویرایش نکن** — روی
   DBهایی که اجرایش کرده‌اند دوباره اجرا نمی‌شود. (نمونه‌ی واقعی: رفعِ یک FK که
   با ویرایشِ ۰۵۹ انجام شده بود، بعداً مجبور شد به مهاجرتِ تازه‌ی ۰۶۵ منتقل شود.)
10. **دیتای دمو** — هر داده‌ی آزمایشی برچسبِ `[DEMO]` بگیرد (مثلاً
   `apps/customer/js/data/seed.js`). هرگز اسمِ رستورانِ واقعی را جعل نکن.

### جاب‌های CI (`.github/workflows/ci.yml`) — **۸ جاب**، همه باید سبز شوند
`build` (tsc + **lint** + next build) · `test` (Postgres 17 + Redis 7 واقعی) ·
`schema-drift` · `security` (`npm audit`: **critical می‌شکند، high فقط هشدار**) ·
`e2e` (ایمیجِ `mcr.microsoft.com/playwright:v…-noble`، API کاملاً mock — بدونِ DB) ·
`design-system` · `seo` · `landing`.

⚠️ **Node در CI نسخه‌ی ۲۰ است** (محیطِ محلی ممکن است ۲۲ باشد) — به flagهای
مخصوصِ Node 22 تکیه نکن.
⚠️ تگِ ایمیجِ Playwright باید با `@playwright/test` در `e2e/package.json` یکی
بماند؛ با ارتقاء هر دو را با هم عوض کن.

---

## ۳) 📝 قوانین کامیت و گزارش‌دهی (صداقت در کار)

- **پیامِ کامیت فارسی** و مشخص: چه کاری، چرا، و **«تست شده» یا «فقط تایپ‌چک»**.
  تایپ‌چکِ پاک به‌تنهایی دلیل نمی‌شود چیزی کار می‌کند.
- اگر باگِ واقعی پیدا کردی، **بگو با چه روشی**: `curl` روی APIِ زنده، مرورگرِ
  واقعی، اجرای migration روی Postgresِ واقعی، … . این خودش شواهدِ کیفیت است.
- **تغییراتِ پرریسک** (اسکیمای DB، احراز هویت، منطقِ رزرو، قفل‌های همزمانی):
  PR باز کن و منتظرِ CIِ سبز بمان — مستقیم به `main` پوش نکن.
- PRها کوچک و تک‌منظوره؛ merge فقط روی سبزِ کامل (merge-on-green).
- **چیزی را که اثبات نکردی ادعا نکن.** الگویِ پذیرفته‌شده‌ی این ریپو: عدد +
  روشِ اندازه‌گیری (مثلاً «۳۰ کاربرِ هم‌زمان: قبل {۴۰۹:۳، ۴۲۳:۲۶} → بعد
  {۴۰۹:۲۹}» یا «Seq Scan ۱۴٫۲۶ms → Bitmap Index Scan ۰٫۱۸ms روی ۱۰۰٬۰۴۵ ردیف»).

---

## ۴) دستورات پرکاربرد

⚠️ **ریشه‌ی ریپو `package.json` ندارد.** بجز شل‌اسکریپت‌های سراسری
(`tools/sync-design-system.sh`، `tools/check-schema-drift.sh`) و
`docker compose`، هر دستورِ npm باید **داخلِ `api/`، `apps/landing/`،
`apps/seo/` یا `e2e/`** اجرا شود.

### 🚨 `npm install` را با `NODE_ENV=production` اجرا نکن
یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۳ (تأییدشده با `--dry-run`): وقتی `NODE_ENV=production`
در محیط ست باشد، npm خودکار `omit=dev` می‌گیرد و یک `npm install`ِ ساده **کلِ
زنجیره‌ی ابزار را پاک می‌کند** — `typescript`، `tsx`، `eslint`،
`@typescript-eslint/*`، `esbuild`، و در `e2e/` خودِ Playwright. اندازه‌ی خسارت
در همین مخزن: `api` −۱۲۳ بسته · `apps/landing` −۳۲۷ · `apps/seo` −۳۲۷ ·
`e2e` −۸۹. نتیجه: هر چهار گیتِ اجباریِ بالا می‌شکنند و پیامِ خطا هیچ ربطی به
علت ندارد.

- برای توسعه همیشه: `NODE_ENV=development npm install --include=dev`
  (یا اول `unset NODE_ENV`). چک: `npm config get omit` باید خالی باشد، نه `dev`.
- برای ایمیجِ تولید **چیزی عوض نکن**: `api/Dockerfile` خودش در مرحله‌ی runtime
  صریحاً `npm ci --omit=dev` می‌زند و مرحله‌ی build جدا و کامل نصب می‌کند.
- ⚠️ به همین دلیل **`.npmrc`ِ پروژه با `include=dev` نساز**: در npm اگر یک نوع
  هم در `include` و هم در `omit` بیاید، `include` برنده می‌شود — یعنی همان
  `--omit=dev`ِ Dockerfile را هم بی‌اثر می‌کند و ایمیجِ تولید را باد می‌کند.

| کار | دستور |
|---|---|
| همگام‌سازی دیزاین‌سیستم | `sh tools/sync-design-system.sh` (ریشه) |
| چکِ بدونِ نوشتن (CI) | `sh tools/sync-design-system.sh --check` |
| بازتولیدِ بسته‌ی آفلاین | `python tools/build-standalone.py` (ریشه) · فقط بررسی: `--check` |
| پیش‌نمایشِ تک‌فایلیِ سایت | `python tools/build-site-preview.py` |
| چکِ انحرافِ اسکیما | `ADMIN_URL=… sh tools/check-schema-drift.sh` (ریشه) |
| تستِ بک‌اند | `cd api && npm test` |
| **یک فایلِ تست به‌تنهایی** | `cd api && npm run test:one -- tests/<file>.test.mts` |
| تایپ‌چک / لینتِ بک‌اند | `cd api && npm run typecheck` · `npm run lint` |
| اعمالِ SQLهای دستی | `cd api && sh prisma/apply-sql.sh` |
| migrationِ Prisma (توسعه) | `cd api && npm run db:migrate` |
| seed | `cd api && npm run db:seed` · محتوای سایت: `npm run db:seed:site` |
| **E2E** | `cd e2e && npm test` |
| E2E موبایل / دسکتاپ / یک فلو | `npm run test:mobile` · `test:desktop` · `test:booking` |
| E2E سایر | `test:ui` · `report` · `audit` (اجرایِ `ux-audit.mjs`) |
| اجرای محلی با داکر | `docker compose --profile http up -d --build` |
| اجرای تولید با HTTPS | `docker compose -f docker-compose.prod.yml up -d --build` (اول `DOMAIN=...` در `.env`) |
| شلِ Postgres در داکر | `docker exec -it rezervno-postgres psql -U postgres -d rezervnodb` |

⚠️ **`npx tsx --test tests/<file>` خام را اجرا نکن.** به‌خاطرِ هندلِ بازِ Redis
پروسه هرگز exit نمی‌کند و پروسه‌ی یتیم جا می‌گذارد — که بعداً باعثِ کندیِ E2E و
قفلِ `EPERM` روی DLLِ Prisma می‌شود. `npm run test:one` همان دستور با
`--test-force-exit` است.

⚠️ **`prisma/apply-sql.sh` روی DBِ خالی به‌تنهایی کار نمی‌کند** (تأییدشده با
اجرای واقعی، ۲۰۲۶-۰۸-۲۳): `prisma/sql/001-*` یک migrationِ *افزایشی* است
(ایندکس روی جدولِ موجود)، نه سازنده‌ی اسکیما؛ روی DBِ کاملاً خالی با
`P1014 The underlying table for model 'reservations' does not exist` می‌شکند.
ترتیبِ درست برای یک DBِ خالیِ توسعه: اول `npx prisma db push`، **بعد**
`prisma/apply-sql.sh`.

🚫 **`prisma db push` فقط برای همان بوت‌استرَپِ اولیه است — هرگز روی DBِ
migrate‌شده اجرایش نکن** (تأییدشده با اجرای واقعی): `block_end` یک ستونِ
`GENERATED ALWAYS … STORED` است که Prisma نمی‌تواند بیانش کند، پس `db push`
همیشه قصدِ DROPش را دارد و Postgres ردش می‌کند («constraint no_table_overlap
depends on it»). یعنی دستور شکست می‌خورد — ولی *بعد از* اینکه هر ایندکسی را که
در `schema.prisma` اعلام نشده DROP کرده.

⚠️ **هر ایندکسِ جدید باید در هر دو جا باشد** — `@@index` در `schema.prisma`
(با `map:` اگر نامِ SQL دلخواه است) **و** migrationِ SQL. فقط یکی از دو تا یعنی
یا `db push` حذفش می‌کند یا یک ایندکسِ تکراری با نامِ دیگر ساخته می‌شود.
گاردِ خودکار: `api/tests/schema-drift.integration.test.mts`.

✅ **اصلاح‌شده:** E2E در `e2e/` با **`npm test`** اجرا می‌شود، نه
`npm run test:e2e` — آن اسکریپت در `e2e/package.json` وجود ندارد (مالِ `api/`
است و چیزِ دیگری). همچنین `serviceWorkers: 'block'` از قبل در
`e2e/playwright.config.ts` تنظیم شده — **حذفش نکن** (کشِ SW منبعِ flake بود).

---

## ۵) ساختارِ پوشه‌ها

### هسته
- `api/src/app/api/v1/` → هر `route.ts` یک endpoint (گروه‌ها: `auth`, `me`,
  `reservations`, `restaurant` (پنلِ رستوران)، `restaurants` (عمومی)، `admin`,
  `site`, `waitlist`, `maintenance`, `media`, `payments`, `seo`, `telemetry`, …)
- `api/src/lib/` → ماژول‌های منطقِ کسب‌وکار و کمکی (auth، RBAC، rate-limit،
  reservations، ML، media، …)
- `api/src/middleware.ts` → CORS/CSRF/هدرهای امنیتی + گاردهای fail-fastِ production
- `api/prisma/sql/NNN-*.sql` → migrationهای افزایشی. **قبل از ساختنِ فایلِ جدید
  خودت `ls api/prisma/sql/` بزن و شماره‌ی واقعیِ بعدی را بردار** (این عدد سریع
  عوض می‌شود؛ در ۲۰۲۶-۰۸-۲۵ آخرین شماره `065-restaurant-closures-fk-onupdate.sql` بود).
- `api/tests/` → تست‌های واحد/یکپارچه + `_all.runner.mts` (بخشِ ۷ را حتماً بخوان)
- `shared/` → منبعِ **یکتای** دیزاین‌سیستمِ سه پنل: `shared/css/`،
  `shared/js/` (`api-core.js`، `format.js`، `icons.js`، `analytics.panel.js`)،
  `shared/content/site-content.json`، `shared/fonts/`.
  **shared/ کامپوننت/هوکِ React ندارد.**
- `e2e/` → Playwright، موبایل‌محور
- `tools/` → `sync-design-system.sh`, `check-schema-drift.sh`,
  `build-standalone.py`, `build-site-preview.py`, `xss-sink-audit.mjs`
- `deploy/` → Caddy و nginx برایِ استقرارِ تولید
- `docs/` → مستنداتِ فنی (مرجعِ به‌روزترِ ریپو)؛ `docs/adr/` تصمیم‌های معماری
  (0001 = SEO، 0002 = وب‌سایت)؛ `docs/KNOWN_LIMITATIONS.md` برای یافته‌های باز.
- **`docs/ML_CONTRACT.md` → قراردادِ الزام‌آورِ هر کارِ مدل/هوش/سنجش.** قبل از
  دست‌زدن به `no-show-model.ts`, `no-show-features.ts`, `demand-forecast.ts`,
  `prediction-ledger.ts`, `model-drift.ts` یا `outreach-ledger.ts` بخوانش.
  قاعده‌ی حاکم: **هرگز عملکردی را که اندازه نگرفته‌ای گزارش نکن** — کمبودِ
  شواهد یعنی `insufficient_data`/`null`، **نه صفر** (صفر یعنی «اندازه گرفتیم و
  هیچ بود»، ادعایی که اغلب نداریم).

### سه سطحِ CSS (هیچ‌کدام با هم sync نمی‌شوند)
| سطح | فایل | برای |
|---|---|---|
| ۱ | `shared/css/` (با `sync-design-system.sh` به سه پنل کپی می‌شود) | پنل‌های customer/business/company |
| ۲ | `apps/landing/app/globals.css` (سپس `app/site.css`) | وب‌سایتِ مارکتینگ (ADR 0002) |
| ۳ | `apps/seo/app/globals.css` | صفحاتِ SEOِ رستوران‌ها (ADR 0001) |

سطحِ ۱ و ۲ توکن‌های **هم‌نام** دارند (`--fs-*`, `--sp-*`, …) ولی فایل‌هایشان
کاملاً جداست. سطحِ ۳ اصلاً مجموعه‌ی دیگری دارد (`--bg`, `--surface`, `--text`,
`--brand`). تغییر در یکی هیچ اثری روی بقیه ندارد — قبل از ویرایش مطمئن شو کدام
سطح را دست می‌زنی.

### پوشه‌های جانبیِ ریشه (خارج از مسیرِ اصلیِ CI — با احتیاط)
اینها جزوِ چهار مسیرِ اصلی (`api/`, `apps/`, `shared/`, `e2e/`) نیستند؛ CI
رویشان چک ندارد و **تغییرِ اصلی نباید آنجا انجام شود**:
- `standalone/` → **خروجیِ تولیدشده**، نه منبع، و نه کدِ زنده.
  `customer/business/company.html` از `tools/build-standalone.py` و
  `website.html` از `tools/build-site-preview.py`. ⚠️ **دستی ویرایش نکن** —
  باگ‌فیکسِ واقعی در `apps/` انجام می‌شود و بعد بسته دوباره ساخته می‌شود
  (گیتِ ۵ در بخشِ ۲).
- `demo-mvp/` → نسخه‌ی نمایشیِ ثابت با دیتای نمونه. چون اپ مشتری ES Module است،
  با وب‌سرور باز می‌شود نه `file://`.
- `design-preview/` → HTMLهای اکتشافیِ طراحی. **منبعِ حقیقت نیستند** و از
  دیزاین‌سیستم عقب‌اند (تنها جایی که هنوز لینکِ Google Fonts دارند).
- `loadtest/` (k6) · `observability/` (Prometheus/Grafana/alerts) ·
  `backup/` و `cron/` (کانتینرهای جانبی، هرکدام Dockerfile خودش) ·
  `agency/` (اسنادِ داخلیِ فرایند/ممیزی).
- در ریشه چند سندِ `*-GUIDE.md`/`*-AUDIT.md` هم هست؛ مرجعِ به‌روزتر `docs/` است.

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
- **خطاها**: همیشه از `Err.*` در `api/src/lib/errors.ts` و اجازه بده
  `errorResponse(e)` پاکتِ `{error:{code,message,details}}` را بسازد. کدهای
  موجود دامنه‌ای‌اند (`SLOT_FULL`, `TABLE_CONFLICT`, `SLOT_LOCK_TIMEOUT`,
  `RESTAURANT_CLOSED`, `INVALID_STATUS_TRANSITION`, `USER_BANNED`, …).
  **کدِ جدید نساز اگر کدِ موجود همان معنی را دارد.**
- **صداقتِ خطا**: پیام باید علتِ واقعی را بگوید. مثالِ ممیزیِ PR #34: ۳۰ رزروِ
  هم‌زمان قبلاً `423 SLOT_LOCK_TIMEOUT` می‌گرفتند («دوباره تلاش کن») در حالی که
  واقعیت `409 SLOT_FULL` بود («این ساعت پر است»).
- **اعتبارسنجی**: Zodِ واقعی نصب **نیست**؛ شیمِ داخلی با APIِ شبیه‌به‌Zod در
  `api/src/lib/validate.ts` که از `api/src/lib/schemas.ts` بازصادر می‌شود.
  همان انضباط، ولی امضاها یکی نیست (`.min(n)` پیامِ سفارشی نمی‌گیرد).
  پرایمیتیوهای دامنه (`zPhone`, `zUuid`, `zDateStr`, `zTimeStr`, `zPartySize`)
  را دوباره تعریف نکن. schemaها **immutable**اند (هر متد clone می‌کند) — عمدی
  است و جلوی نشتِ `.optional()` بینِ فایل‌ها را می‌گیرد.
- **RBAC**: کلیدها در `api/src/lib/permissions.ts` (`canManageReservations`,
  `canManageTables`, `canManageWaitlist`, `canManageStaff`, `canManageSettings`,
  `canManageCoupons`, `canManageCampaigns`, `canViewAnalytics`,
  `canViewRevenue`). `owner`/`manager` همیشه عبور می‌کنند.
- **Rate-limit**: `RULES` در `api/src/lib/ratelimit.ts` (`otpPerPhone`,
  `otpPerIp`, `otpVerify`, `reservation`, `search`, `globalPerIp`, `auth`).
  GETِ سبک = `search`؛ **نوشتن‌ها باید `auth` بدهند.**
- **`bigint` از Postgres**: `SUM(...)`/`COUNT(*)` در `$queryRaw` مقدارِ `BigInt`
  برمی‌گردانند، حتی اگر جنریکِ TypeScript بگوید `number` (فقط assertion است).
  همیشه **هر دو لایه**: `::int`/`::bigint` در SQL **و** `Number(x)` در JS.
- **آپلودِ فایل**: هر تصویری باید از `api/src/lib/media.ts` رد شود — تشخیصِ
  magic-byte (`sniffFormat`)، `MAX_BYTES` (۸MB)، `MAX_DIMENSION` (۸۰۰۰px).
  **هرگز آدرسِ آزادِ کلاینت را منبعِ تصویر نکن** (مهاجرتِ ۰۵۲ این کار را کرد و
  ۰۵۳ برش گرداند).

### migrationها
- فایلِ جدید با **شماره‌ی بعدیِ واقعی** (اول `ls` بزن)؛ فایلِ قبلی را **هرگز
  ویرایش نکن** — روی DBهایی که آن را اجرا کرده‌اند دوباره اجرا نمی‌شود.
- **idempotent** بنویس (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
  و با اجرای دوم روی Postgresِ واقعی امتحانش کن.
- فایلی که راهنما/scaffold است نه migration، خطِ `-- @manual-only` بگیرد تا
  `apply-sql.sh` ردش کند.
- `schema.prisma` را هماهنگ کن **و** دروازه‌ی انحرافِ اسکیما (بندِ ۸ بخشِ ۲) را بزن.

---

## ۷) تست — قواعدی که نادیده‌گرفتنشان قبلاً هزینه داده

### ⚠️ فایلِ تستِ جدید را حتماً در `api/tests/_all.runner.mts` `import` کن
`npm test` فقط همان یک رانر را اجرا می‌کند. فایلی که آنجا import نشود
**بی‌صدا اجرا نمی‌شود**. این واقعاً رخ داده: سه فایل (`ban`,
`crm-recommendations`, `customer-intelligence`) ساخته شدند ولی ثبت نشدند و یک
PR «۳۷۵/۳۷۵ پاس» گزارش کرد در حالی که عددِ واقعی ۳۵۲ بود.
بعد از افزودن، چک کن همه‌ی `tests/*.test.mts` واقعاً import شده‌اند:

```sh
cd api && comm -23 \
  <(ls tests/*.test.mts | xargs -n1 basename | sort) \
  <(grep -oP "(?<=^import '\./)[^']+" tests/_all.runner.mts | sort)
# خروجیِ خالی = همه ثبت شده‌اند
```

(برای اجرای یک فایل به‌تنهایی از `npm run test:one -- tests/x.test.mts` استفاده
کن، نه `npx tsx --test` خام — بخشِ ۴. نامِ رانر عمداً `.runner.mts` است نه
`.test.mts` تا با glob دوبار شمرده نشود.)

### استانداردِ تستِ این ریپو
- **کنترلِ مثبت**: تست باید ثابت کند اگر رفتار غلط بود، fail می‌شد.
- **جهش‌آزمایی (mutation test)**: عمداً چک را خاموش کن و بنویس دقیقاً چند تست
  قرمز شد. اگر هیچ‌کدام قرمز نشد، تستِ تو چیزی را قفل نکرده است.
- **`.integration.test.mts`** برای تست‌هایی که Postgres/Redisِ واقعی می‌خواهند.
- در گزارش **عدد و روش** بده، نه «تست‌ها سبزند».

---

## ۸) فونت و RTL

### فونتِ Vazirmatn — سه مسیرِ متفاوت، همه عمدی
هدفِ مشترک: **هیچ درخواستِ زمانِ اجرا به `fonts.googleapis.com` نرود** (در ایران
در دسترس نیست و تا ۲۰۲۶-۰۸-۱۹ فونت بی‌صدا روی sans-serifِ سیستم می‌افتاد).

1. **پنل‌ها**: `@font-face` در `shared/css/tokens.css` + فایلِ
   `shared/fonts/vazirmatn-var.woff2` که اسکریپتِ sync به `apps/*/fonts/` کپی می‌کند.
2. **`apps/landing`**: `next/font/google` در `app/layout.tsx` — Next فونت را
   **زمانِ build** دانلود و self-host می‌کند، پس زمانِ اجرا درخواستِ بیرونی
   نمی‌رود. **نقضِ قاعده نیست**؛ ولی یعنی build به شبکه نیاز دارد.
3. **`apps/seo`**: `@font-face` در `app/globals.css` + نسخه‌ی جدا در
   `public/fonts/`. ⚠️ این کپی **در `sync-design-system.sh` نیست** — اگر فونت را
   عوض کردی، این یکی را دستی هم به‌روز کن.

**هرگز `<link>`ِ Google Fonts را به `apps/` یا `shared/` برنگردان.**
(`design-preview/*.html` استثناست: منبعِ حقیقت نیست.)

### `sync-design-system.sh` واقعاً چه می‌کند
`shared/` تنها منبعِ حقیقت است و این اسکریپت آن را کپی می‌کند (چون هر اپ
پروژه‌ی استاتیکِ جدا بدونِ bundler است). فهرستِ کامل:

- `css/tokens.css`, `foundation.css`, `ds-bridge.css` → هر سه پنل
- `fonts/vazirmatn-var.woff2` → `apps/*/fonts/`
- `js/icons.js` → **ESM** برای `customer`، نسخه‌ی **global** (بدونِ `export`) برای پنل‌ها
- `js/api-core.js` → ESM برای `customer`، global برای پنل‌ها
- `js/format.js` → فقط پنل‌ها (customer عمداً مستثنا)
- `js/analytics.panel.js` → با جای‌گذاریِ ۵ ثابتِ per-app به
  `business/js/analytics.js` و `company/js/analytics.js`
- `content/site-content.json` → **هم** `apps/landing/content/` **و هم** `api/prisma/seed/`

**sync نمی‌شود (مالِ خودِ اپ):** `css/theme.css`, `css/app.css`, `css/panel.css`.
⇒ بعد از هر تغییر در `shared/`، اسکریپت را اجرا کن و **خروجی‌اش را هم کامیت کن**.

### RTL
UI فارسی و راست‌چین است. از `left:`/`right:` استفاده نکن — معادل‌های منطقی
(`inline-start`/`inline-end`). استثنای مستند: شماره‌ی موبایل عمداً چپ‌چین می‌ماند.

---

## ۹) امنیت، پیکربندی و عملکرد

### متغیرهای محیطیِ حیاتی (نمونه در `.env.example` ریشه و `api/.env.example`)
- **`ALLOWED_ORIGINS`** — لیستِ originهای مجاز، **دقیقاً `scheme://host[:port]`**.
  در production گاردِ `api/src/middleware.ts` روی مقدارِ خالی **و مقدارِ غلط**
  (اسلشِ پایانی، نبودِ scheme، مسیرِ اضافه، `*`) fail-fast می‌کند.
  چرا مهم است: مقدارِ *غلط* قبلاً هیچ خطایی تولید نمی‌کرد — API بالا، لاگ تمیز —
  ولی مرورگر هر fetch را بلاک می‌کرد و اپ صادقانه به دادهٔ `[DEMO]` برمی‌گشت.
  یعنی همه‌ی بازدیدکننده‌ها محتوای آزمایشی می‌دیدند. نرمال‌سازی در
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

### fail-closed، نه fail-open
**`/api/metrics` دیگر fail-open نیست (PR #58):** در production بدونِ
`METRICS_TOKEN` سرو نمی‌شود. endpointِ مانیتورینگ/ادمینِ جدید هم همین الگو —
نبودِ توکنِ پیکربندی‌شده یعنی **«بسته»**، نه «باز برای همه».

### تاب‌آوریِ Redis
هر مسیرِ Redis سقفِ زمانی داشته باشد و بازیابی خودکار باشد
(`api/src/lib/redis.ts`). اندازه‌گیریِ واقعی با Redisِ خاموش — `/v1/events`:
۲۲٫۰s → ۱٫۰s، `live-stats`: تایم‌اوتِ کامل → ۰٫۸۶s. جایی که عمداً fail-open است
(مثلِ چکِ ban) باید **لاگِ ساختاریافته + متریکِ قابلِ‌آلارم** بدهد، نه سکوت.

### پرداخت
درگاهِ زرین‌پال در `api/src/lib/zarinpal.ts` (از PR #62 پوششِ تستِ کامل دارد —
تست‌هایش را نشکن). آدرسِ بازگشتِ مشتری از `appBase()` مشتق می‌شود، نه دامنه‌ی
هاردکد. **یافته‌ی بازِ ثبت‌شده:** فیچرِ بیعانه (deposit) عمداً از جریانِ زنده قطع
است — `resolvePolicy()` هیچ فراخوانی ندارد و `paymentEnabled` هیچ نویسنده‌ای؛
قبل از «وصل‌کردنش» با مالکِ محصول چک کن، خودسرانه فعالش نکن.

### هدرهای امنیتی
CSP/HSTS/… در `api/src/middleware.ts`. قبل از تغییر مطمئن شو درخواستِ
SSE/streaming را نمی‌شکنی.

### ✅ اصلاح‌شده (۲۰۲۶-۰۸-۲۵) — کشِ داده در اپ‌های React
این فایل تا امروز می‌گفت «از React Query برای کشِ داده‌های سرور استفاده کن».
**React Query (`@tanstack/*`) در هیچ‌کدام از `package.json`ها نصب نیست.**
الگویِ واقعی: Server Components + `fetch(url, { next: { revalidate: N } })` (ISR).
پیش‌فرضِ رایج `300` ثانیه — به همین دلیل ویرایشِ منو تا ۵ دقیقه طول می‌کشد تا
عمومی شود (در `docs/KNOWN_LIMITATIONS.md` ثبت شده).
پنل‌های vanilla کشِ خودشان را با متغیرهای global + fetch دستی دارند.
برای تصویر در `apps/landing` از `next/image` (پوششِ `components/site/Photo.tsx`)
و برای لودِ تنبل از `next/dynamic` استفاده کن.

### هوشیاریِ ML — نشتِ زمانی
هر ویژگیِ آموزشِ مدل باید **نقطه-در-زمان** باشد: فقط از رویدادهایی که *پیش از*
`created_at`ِ همان ردیف **برگزار شده‌اند**. ترتیبِ `created_at` کافی **نیست** —
رزروی که زودتر ثبت ولی دیرتر برگزار می‌شود، نتیجه‌ی آینده‌اش را به گذشته نشت
می‌دهد. الگویِ درست: `CROSS JOIN LATERAL` با شرطِ صریحِ
`h.slot_start < r.created_at` (`api/src/lib/no-show-model.ts`).
⚠️ این نقص روی دادهٔ معمولی دیده نمی‌شد (۰ از ۱۳۷ رزرو فاصله‌ی ثبت↔برگزاریِ
بیش از یک روز داشت) — نهفته بود، نه غایب. رجوع کن به `docs/ML_CONTRACT.md`.

---

## ۱۰) کار با Git و برنچ‌ها

- برنچِ اصلی: **`main`** (همیشه پایدار و قابلِ استقرار؛ merge-on-green).
  برنچِ `develop` **وجود ندارد** (هرچند `ci.yml` هنوز اسمش را در triggerها دارد).
- هر دسته‌کارِ جدید مستقیماً از `main` برنچ می‌گیرد
  (`claude/توضیح-کوتاه` یا `feature/توضیح-کوتاه`) و با PR به `main` برمی‌گردد.
- ⚠️ **اول `git fetch origin main` بزن، بعد برنچ بگیر — و در PRهای طولانی دوباره
  fetch کن.** این ریپو خیلی سریع حرکت می‌کند؛ کلونِ کهنه یعنی کارِ روی واقعیتِ
  منسوخ و تعارضِ merge. (در همین بازبینی، برنچی از `main`ِ ۳۵ کامیت عقب گرفته
  شده بود و در فاصله‌ی یک ساعتِ بازِ همان PR، `main` دوباره ۱۰+ کامیت جلو رفت.)
- **PRِ یک برنچ که مرج شد، آن برنچ تمام است.** کارِ بعدی روی همان اسم از رویِ
  `main`ِ تازه دوباره ساخته می‌شود:
  `git fetch origin main && git checkout -B <branch> origin/main`
  — نه کامیتِ جدید روی تاریخچه‌ی مرج‌شده.
- قبل از هر کامیت، چک‌لیستِ بخشِ ۲ را کامل اجرا کن.

---

## ۱۱) یافته‌های باز (ثبت‌شده، هنوز رفع‌نشده)

طبقِ قاعده‌ی «هر دیتای فیک/هاردکد یا ناهماهنگی را ثبت کن حتی اگر همان لحظه
رفعش نکنی». مرجعِ کامل‌تر: `docs/KNOWN_LIMITATIONS.md`.

- **فیچرِ بیعانه از جریانِ زنده قطع است** — `resolvePolicy()` بدونِ فراخوان،
  `paymentEnabled` بدونِ نویسنده (بخشِ ۹).
- **`docs/figma-mcp-rules.md` هنوز روی «دو دیزاین‌سیستم» مانده** در حالی که از
  PR #32 سه سطح داریم (جدولِ بخشِ ۵).
- **`README.md` می‌گوید PostgreSQL 16** ولی CI روی `postgres:17` تست می‌کند
  (`docker-compose.yml` هم `postgres:16-alpine` است).
- `ci.yml` هنوز روی برنچِ ناموجودِ `develop` هم trigger دارد.

---

## ۱۲) 🎨 تبدیلِ طرحِ Figma به کد

قبل از تولیدِ کد از رویِ طرحِ Figma، `docs/figma-mcp-rules.md` را بخوان — با این
تصحیح که پروژه **سه** سطحِ CSSِ مستقل دارد (جدولِ بخشِ ۵)، نه دو تا، و هیچ‌کدام
با هم sync نمی‌شوند. سطحِ ۱ و ۲ توکنِ هم‌نام دارند ولی فایلِ جدا؛ سطحِ ۳ (اپِ
SEO) اصلاً نام‌های دیگری دارد. قبل از ویرایش مطمئن شو کدام سطح را دست می‌زنی.

---

## ۱۳) یادآوریِ نهایی

- **تمامِ ارتباطات با کاربر به فارسی.**
- UI فارسی و راست‌چین با فونتِ Vazirmatn.
- هیچ‌وقت مستقیم در `node_modules/`، `.next/` یا `standalone/` تغییر نده
  (سومی خروجیِ تولیدشده است — بخشِ ۵).
- **اولویتِ اول: کارکردِ درست و بدونِ باگ، نه ویژگیِ جدید.** بینِ «ساختنِ چیزِ
  تازه» و «تست/رفعِ چیزی که هست»، دومی. لانچ با باگ بدترین حالت است.
- هر دیتای فیک/هاردکد که باید واقعی باشد را به‌عنوانِ یافته ثبت کن (بخشِ ۱۱).
- **قبل از تکیه به هر ادعای این فایل، خودت با `ls`/`grep` تأییدش کن** — تاریخِ
  بالای فایل مرزِ اعتبارِ ادعاهاست.
