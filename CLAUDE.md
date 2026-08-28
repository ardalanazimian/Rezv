# RezervnoOSv2 — قوانینِ اجرایی (بازنویسیِ ۲۰۲۶-۰۸-۲۶، مبتنی بر سورس نه فرض)

## ساختار (۵ اپ)
- `apps/customer` = **ES module** (ورودی `js/main.js`، تابعِ public باید روی `window` بنشیند؛ با `file://` باز نمی‌شود).
- `apps/business` و `apps/company` = **classic JS**، scopeِ مشترک، ترتیبِ `<script>` در index.html حیاتی است.
- **بدون build و بدون فریم‌ورک** — هیچ bundler/React اضافه نکن. `apps/landing` و `apps/seo` دو Next.jsِ مستقل‌اند.
- بک‌اند: `api/` (Next 16 App Router). توکن‌های دیزاین: `shared/` → توزیع با `sh tools/sync-design-system.sh`.

## 🚨 گیت‌های اجباری پیش از push (همه در CI هم هستند — merge-on-green)
1. `sh tools/sync-design-system.sh --check`
2. `python tools/build-standalone.py --check` (بعد از هر تغییرِ پنل‌ها: بدونِ `--check` بازتولید کن — خروجیِ commitشده است)
3. در `api/`: `npx tsc --noEmit` و `npm run lint` و `npm test` (نیازمند Postgres/Redisِ واقعی)
4. در `e2e/`: `npm test` — هر سه پروفایل (iPhone 13 / Pixel 5 / Desktop) باید سبز باشد
5. 🚨 قبل از هر `npm install`: `unset NODE_ENV` (اگر production ست باشد کلِ toolchain پاک می‌شود)

## دیتابیس (PostgreSQL + Prisma)
- PK = `@id @default(uuid()) @db.Uuid` · نامِ ستون snake_case با `@map` · در TS همیشه camelCase.
- مقادیرِ بسته = **enumِ سطحِ DB** (مثل `SubscriptionPlan`, `ReservationStatus`)، نه stringِ آزاد.
- **مسیرِ اسکیما دومرحله‌ای است** (`api/docker-entrypoint.sh`): ۱) `prisma migrate deploy` (فقط `0_init`) ۲) `sh prisma/apply-sql.sh` روی `api/prisma/sql/NNN-*.sql`.
  ⚠️ پوشه‌ی `prisma/migrations/manual/` **وجود ندارد** — مهاجرت‌ها فقط در `api/prisma/sql/` (آخرین: ۰۷۵).
- `prisma db push` **فقط** بوت‌استرپِ DBِ کاملاً خالی (تست/CI)؛ روی DBِ migrateشده اجرایش نکن (روی `block_end` می‌شکند و ایندکسِ اعلام‌نشده را DROP می‌کند).
- مهاجرتِ جدید = فایلِ `NNN-*.sql` با شماره‌ی بعدی، **idempotent**: `IF NOT EXISTS` یا
  `DO $$ BEGIN … EXCEPTION WHEN duplicate_object|duplicate_column THEN NULL; END $$;` — فایلِ قبلی را هرگز ویرایش نکن.
- هر ایندکس/DEFAULTِ تازه باید **هم** در `schema.prisma` باشد هم در SQL (وگرنه «CI سبز، تولید خراب» — گارد: `schema-drift.integration.test.mts`؛ نمونه‌ی درسِ واقعی: مهاجرتِ ۰۷۵).

## بک‌اند — قراردادها
- routeهای رستوران: `withRestaurantAuth({rateLimit?, permission?}, handler)` یا `withStaffAuth` (هر دو در `lib/with-restaurant-auth.ts`)؛ ادمین: `await requireAdmin(req)` (`lib/admin-auth.ts` — نامِ قدیمیِ `adminAuthFromRequest` مرده است).
- **`restaurantId`/`tenantId` فقط از contextِ احراز (`ctx.restaurant.id`, `auth.tenantId`)** — هرگز از body/query (ضدِ cross-tenant).
- خطا فقط با `Err.*` از `lib/errors.ts` (۲۹ متد). برای تداخلِ دامنه‌ای نامِ دقیق را بردار: `tableConflict` / `slotFull` / `concurrencyRetry`؛ `Err.conflict(reason, msg?)` هم وجود دارد (۴۰۹ عمومی با فیلدِ `reason` — مثالِ مصرف: `lib/provisioning.ts:139`). `throw new Error` خام در مسیرِ request ممنوع؛ wrapper خودش `errorResponse` می‌زند.
- اعتبارسنجی با شِیمِ داخلیِ `lib/schemas.ts` (**Zod واقعی نیست**): `parseBody` (async) / `parseQuery` / `parseParams` + primitiveهای `zPhone, zUuid, zPartySize, …`.
- عملیاتِ حساسِ ادمین/چرخه‌ی رزرو باید `audit(...)` بنویسد. تغییرِ auth/رزرو/اسکیما فقط با PR.

## پیامک و پول
- ارائه‌دهنده = **ملی‌پیامک** (کاوه‌نگار حذف شده). ارسال فقط از `enqueueSms(job)` در `lib/sms.ts` → صفِ Job (`worker.ts`)؛ OTP همزمان می‌رود. الگو با `bodyId`ِ env؛ متنِ آزاد فقط با `MELIPAYAMAK_FROM`. bodyIdِ خالی = ارسال نمی‌شود و صریح لاگ می‌شود — fallbackِ بی‌صدا ممنوع.
- واحدِ پول همه‌جا **تومان (IRT)**، نه ریال. در Zarinpal حتماً `currency: 'IRT'` (`lib/zarinpal.ts:40` — بدونش ریال فرض می‌شود: خطای ۱۰×).

## فرانت — قراردادها
- هر صفحه/ویو **چهار حالت** دارد: loading · empty · error(+تلاش دوباره) · success. «نمی‌دانیم» هرگز «وجود ندارد» گزارش نشود (شکستِ fetch ≠ صفر/خالی).
- UI فارسی و **RTL** با فونتِ self-hostedِ Vazirmatn (`shared/fonts/`) — **هرگز** لینکِ Google Fonts برنگردان (در ایران در دسترس نیست). a11y الزامی: هدفِ لمسی ≥۲۴px (کفِ راحت ۴۴px)، aria، فوکوسِ کیبورد.
- Service worker فقط در `apps/customer/sw.js` است؛ بعد از هر تغییرِ `js/`یا `css/`ِ اپِ مشتری، `CACHE_VERSION` (خطِ ۱۴) را bump کن. پنل‌ها sw ندارند — تازگی‌شان با گیتِ standalone تضمین می‌شود.
- آدرسِ API: پیش‌فرض same-origin؛ override فقط با `window.RZ_API_BASE`/`?api=` (بوت‌استرپِ index.html) — hardcode نکن.

## دمو / OTP (هر دو قانونی‌اند، دست نزن)
1. `OTP_DEV_MODE=true` → کدِ واقعی در پاسخِ API (در production استثنا می‌دهد).
2. کلاینتِ کاملاً آفلاین (`file://`/بی‌پاسخ) کدِ ثابتِ `1234` را محلی می‌پذیرد.
- دیتای آزمایشی همیشه با برچسبِ `[DEMO]`؛ نامِ رستورانِ واقعی جعل نشود.

## ممنوعِ مطلق در کدِ تحویلی
`TODO` · `FIXME` · `console.log` · کدِ کامنت‌شده · mock/placeholder در مسیرِ production · منطقِ تکراری (اول جست‌وجو، بعد اگر نبود بساز) · commit کردنِ `.env`/secret · «موفقیتِ جعلی» (پیامِ سبز بدونِ 2xxِ واقعی).

## قانونِ راستی‌آزمایی (مهم‌ترین)
هرگز نگو «انجام شد» مگر خروجیِ واقعیِ دستورِ verify (تست/`tsc --noEmit`/اجرای زنده) را نشان داده باشی؛ «تایپ‌چک پاس شد» ≠ «تست شده». پیامِ کامیت فارسی + صادق: چه، چرا، و با چه روشی verify شد. اولویت: رفعِ باگِ موجود بر ساختنِ چیزِ تازه.

### سه قاعده‌ی زیر از شکست‌های واقعیِ همین مخزن آمده‌اند — حدس نیستند

**۱. مبنا کدِ خروج است، نه آخرین خطِ لاگ.** هرگز موفقیت را از `tail`ِ خروجی
نتیجه نگیر. یک اجرای Playwright که واقعاً `12 failed` داشت، در `tail` فقط
`12 passed (10.3m)` نشان می‌داد و اشتباهاً «سبز» خوانده شد؛ کدِ خروجش ۱ بود.
همیشه `echo $?` را ثبت کن و در گزارش بیاور.

**۲. «سبز» بی‌معنا است تا وقتی ثابت نکرده‌ای گیت قرمز هم می‌شود.** پیش از
اعتماد به هر گیتِ تازه، یک نقضِ حداقلی تزریق کن، قرمزشدنش را با کدِ خروج ببین،
بعد بازگردان. سه بار در این مخزن گیتی سبز بود بی‌آنکه چیزی بسنجد: `--check`ِ
گاردِ XSS فقط کهنگیِ آرتیفکت را می‌سنجید نه شمارش را · jobِ `boot-path` بدونِ
`npm run build` هیچ سروری بالا نمی‌آورد · و طبقه‌بندیِ `escaped` یک تستِ
زیررشته‌ای بود. مرجع: `docs/audit/GATE-FALSIFIABILITY.md`.

**۴. هر آرتیفکتِ تحویلی — ایمیج، باندل، مهاجرت — باید یک jobِ CI داشته باشد
که واقعاً می‌سازدش.** چیزی که ساخته نمی‌شود، خراب است و کسی نمی‌فهمد. نمونه‌ی
واقعی: هوکِ `postinstall: prisma generate` در ۲۰۲۶-۰۷-۰۸ اضافه شد و از
همان روز `docker build` را می‌شکست (اسکیما هنوز در آن لایه کپی نشده
بود)، ولی چون هیچ jobی ایمیج نمی‌ساخت، **دو ماه** با ۱۱ jobِ سبز پنهان ماند.
گاردش حالا jobِ `image-build` است، که علاوه بر ساخت، non-root بودن و
PID 1 بودنِ `dumb-init` را هم **زنده** می‌سنجد.

**۳. ادعای تست باید جهشِ جزئی را هم بگیرد، نه فقط خرابیِ کامل.** ادعایی مثل
«کلِ payload خام در خروجی هست؟» با یک رگرسیونِ نیمه (مثلاً `<` آزاد ولی `>`
هنوز escape) سبز می‌ماند، در حالی که بهره‌برداری ممکن است. رگرسیونِ واقعی
همیشه جزئی است — کسی کلِ escaper را یک‌جا حذف نمی‌کند. برای هر گارد از خودت
بپرس: «کوچک‌ترین تغییری که این را بشکند ولی از تست رد شود چیست؟»
