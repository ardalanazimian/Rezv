# رزرونو — Project Knowledge (خلاصه‌ی وضعیت برای آپلود به Project Knowledge)

> این فایل را به‌همراه **آخرین zip کامل پروژه** آپلود کن. این سند «چرا»هاست؛ zip منبع واقعیِ کد است.
> با این دو، هر مکالمه‌ی جدید بدون کاوشِ دوباره‌ی کل کدبیس شروع می‌شود.
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۷-۳۰ (پس از ادغامِ تک‌منبعِ فرانت + پوششِ e2e پنل‌ها +
> پاک‌سازیِ lint بک‌اند؛ تاریخچه‌ی قبلی: ۲۰۲۶-۰۷-۱۹ حسابرسی + رفعِ ۴ رگرسیون).

---

## ۱. معماری

```
api/          ← بک‌اند Next.js 14 (App Router) + Prisma + PostgreSQL(Supabase) + Redis
apps/
  customer/   ← اپ مشتری — vanilla JS، ES modules، SPA تک‌URL (بدون router واقعی)
  business/   ← پنل رستوران‌دار — vanilla JS کلاسیک (global scope)
  company/    ← پنل ادمین پلتفرم — همان الگوی business
shared/       ← منبعِ واحدِ دارایی‌های مشترکِ فرانت (css توکن‌ها + js: icons/api-core/format/analytics.panel)
tools/        ← sync-design-system.sh (کپیِ shared→apps + drift-check) و build-standalone.py
deploy/       ← nginx, caddy
observability/← Prometheus + Grafana + exporterها
cron/ backup/ ← job پس‌زمینه + بک‌آپ خودکار DB
docs/         ← مستندات (شامل ۵ سند حسابرسیِ HANDOFF)
e2e/ loadtest/← Playwright + k6
```

- سه اپ فرانت هیچ build step ندارند — مستقیم static سرو می‌شوند. هر اپ یک سایتِ جداست
  (روی Vercel هرکدام یک پروژه با Root Directory خودش)، پس مسیرهای asset **root-absolute**‌اند (`/css`,`/js`).
- درختِ فرانتِ تکراری در ریشه (business/, company/, js/, css/) **حذف شده** — فقط `apps/*` سرو می‌شود.
- **تک‌منبعِ حقیقت (`shared/` → `apps/`):** دارایی‌های مشترک فقط در `shared/` ویرایش می‌شوند؛
  `tools/sync-design-system.sh` آن‌ها را به هر اپ می‌سازد (customer نسخه‌ی ESM؛ business/company
  نسخه‌ی global با `export` حذف‌شده). CI با `--check` روی هر drift می‌شکند. شاملِ:
  css توکن‌ها/foundation/bridge، `icons.js`، `api-core.js` (transportِ `httpJson` + `resolveApiBase`)،
  `format.js` (`fa`/`esc`)، `analytics.panel.js`. **منطقِ auth/refresh در `shared/` نیست — per-app می‌ماند.**
- توجه: یک نسخه‌ی مونوریپو (`apps/api` + `infra/`) هم از این پروژه وجود دارد؛ این نسخه‌ی pre-monorepo است.

## ۲. Supabase — پروژه‌ی فعال واقعی

**`zmyuvtpbchytqvtgyewt`** (نام: «rezervno»). یک پروژه‌ی قدیمیِ INACTIVE هم هست
(`nxtvmfoczgnjjgdgrxli`) — اگر جایی به آن اشاره شده، اشتباه است.
Supabase فقط **host مدیریت‌شده‌ی Postgres** است — نه client SDK، نه anon key، نه Supabase Auth.
اتصال فقط از طریق `DATABASE_URL` با Prisma (نقش owner که RLS را دور می‌زند).

**وضعیت تأییدشده روی DB زنده (۲۰۲۶-۰۷-۱۹):** ۳۵ جدول، **هر ۳۵ با RLS فعال، صفر policy**
(deny-by-default واقعی). `block_buffer_minutes` و `restaurant_closures` روی DB موجودند.

**⚠️ یافته‌ی جدیدِ live-test (۲۰۲۶-۰۸-۱۲) — این خط بالا دیگه امروز درست نیست:**
schema.prisma الان **۴۹ مدل** داره (نه ۳۵). مهم‌تر: یک دیتابیسِ **تازه‌ساز**
از رویِ همینِ ریپو (چه با `prisma db push` چه با `migrate deploy` — هر دو
تست شد، `0_init/migration.sql` هم چک شد) فقط **۱۵ جدول** با RLS فعال داره
(`payments`, `platform_settings`, `restaurant_closures`, `chat_threads`,
`chat_messages`, `platform_events`, و هشت جدولِ `site_*`ِ CMS — دقیقاً
همون‌هایی که migrationهای ۰۲۳/۰۲۴/۰۲۹/۰۳۱ صریحاً RLS رو براشون فعال
می‌کنن). بقیه‌یِ ~۳۴ جدولِ اصلی (`restaurants`, `reservations`, `users`,
`staff`, `tenants`, `tables`, …) در **هیچ فایلِ migrationِ کامیت‌شده‌ای**
RLS فعال نمی‌شن. یعنی جمله‌ی «۳۵ از ۳۵» فقط برایِ DBِ زنده‌ی *همون‌موقع*
صادق بوده (احتمالاً از طریقِ یک دستورِ دستی/کنسولِ Supabase که هیچ‌وقت به
migration تبدیل نشده — دقیقاً همون الگویی که خودِ این سند برایِ
`payments`/`platform_settings`/`restaurant_closures` در ردیفِ migration
۰۲۳ توضیح داده). **پیامد:** یک محیطِ تازه (CI، DR، محیطِ توسعه‌ی محلی) از
رویِ migrationهایِ فعلی، جدول‌هایِ اصلی رو بدونِ RLS می‌سازه — لایه‌ی
امنیتیِ اپلیکیشن (tenant scoping در کد) هنوز سرِجاشه، ولی defense-in-depthِ
سطحِ DB برایِ این جدول‌ها روی محیطِ تازه فعال نیست.

**✅ رفع شد (۲۰۲۶-۰۸-۱۲، با تأییدِ صریحِ کاربر):** `api/prisma/sql/037-rls-core-tables.sql`
اضافه شد — دقیقاً همون الگویِ idempotent (loop + `EXECUTE format('ALTER
TABLE %I ENABLE ROW LEVEL SECURITY', t)`، بدونِ policy) که 031 برایِ
جدول‌هایِ `site_*` استفاده کرده بود، این‌بار برایِ هر ۳۴ جدولِ اصلی.
تست شد: ریستِ کاملِ DB (`DROP SCHEMA` + `prisma db push` + `apply-sql.sh`)
→ حالا **۴۹ از ۴۹ جدول** RLS فعال دارن (نه ۱۵ تا)؛ اجرایِ دوباره‌ی همون
migration بدونِ خطا (idempotency تأییدشده)؛ `npm test` کاملِ بک‌اند
(۲۶۶ تست) بعد از این تغییر همچنان **۰ شکست**؛ `tsc --noEmit`/`lint` پاک.
هیچ policyای اضافه نشد — همون deny-by-default؛ رفتارِ اپ (که با نقشِ owner
وصل می‌شه) عوض نشده، فقط لایه‌ی defense-in-depthِ DB کامل شد.

## ۳. احراز هویت

- **بدون پسورد، بدون ایمیل.** فقط OTP پیامکی. بک‌اند کدِ **۶ رقمی** می‌سازد (`randomInt(100000,1000000)`).
- کد دمو/آفلاینِ هر سه اپ: `1234` — وقتی بک‌اند در دسترس نیست.
- **⚠️ رگرسیونِ رفع‌شده:** ورودیِ OTP هر سه اپ `maxlength="4"` و regex `/^\d{4}$/` بود → ورودِ واقعی (کد ۶رقمی) غیرممکن. حالا `maxlength="6"` و `/^\d{4,6}$/`. **مواظبِ رگرسیون باش.**
- JWT: access+refresh جدا، rotation + revocation (Redis blacklist)، fail-fast اگر `JWT_SECRET`/`JWT_REFRESH_SECRET` کوتاه باشند.
- `OTP_DEV_MODE=true` در production ممنوع (fail-fast throw) — وگرنه کد OTP در پاسخ برمی‌گردد = bypass کامل.
- `ALLOWED_ORIGINS` در production **اجباری** (fail-fast در `middleware.ts`) — وگرنه چک CSRF/Origin خاموش می‌شود.

## ۴. تایم‌زون (⚠️ باگِ حساس — رفع‌شده، مواظبِ رگرسیون باش)

- `Restaurant.timezone` یک فیلدِ واقعیِ per-restaurant است (پیش‌فرض `Asia/Tehran`).
- **منطقِ درست:** `lib/hours.ts` → `zonedTimeToUtc(dateISO, timeHHMM, timeZone)` با `Intl.DateTimeFormat`
  (tzdata واقعی + DST). تست‌شده روی Tehran/Dubai/New York (تابستان و زمستان).
- **باگی که برگشته بود:** در ۳ جا (`availability.ts` ×۲، `reservation-helpers.ts`) آفستِ ثابتِ
  `+03:30` هاردکد شده بود — یعنی برای هر رستوران با timezone غیرتهران، لحظه‌ی رزرو اشتباه ذخیره می‌شد.
  حالا هر سه از `zonedTimeToUtc` با `r.timezone` استفاده می‌کنند. **هیچ‌وقت `+03:30` هاردکد نکن.**

## ۵. چندشعبه‌ای (Multi-branch)

- `Staff.restaurant_id` (nullable): `NULL` = دسترسی همه‌ی شعبه‌های تنانت (owner/manager)، ست‌شده = قفل به یک شعبه.
- شعبه‌ی فعال از سمت کلاینت با هدر `X-Restaurant-Id` (نه JWT → بدون لاگین دوباره قابل‌سوییچ).
- choke-point مرکزی: `lib/staff-helpers.ts` → `resolveStaffRestaurant(auth, req)` — هر تغییری اینجا خودکار روی همه‌ی ۳۰+ روتِ business اثر می‌کند.
- روت‌ها: `GET/POST /restaurant/branches`.

## ۶. پرداخت آنلاین (Zarinpal)

- درگاهِ **زرین‌پال** (نه Stripe — در ایران کار نمی‌کند). `lib/zarinpal.ts` (REST، بدون SDK).
- تبدیل تومان↔ریال فقط در مرزِ zarinpal.ts انجام می‌شود؛ بقیه‌ی کد همیشه تومان است.
- تنظیمات (`merchant_id`, `sandbox`, کلید کاوه‌نگار) از جدولِ `platform_settings` خوانده می‌شوند
  (قابل‌ویرایش از پنلِ شرکت بدون ری‌دیپلوی، کش ۳۰ ثانیه‌ای)، با fallback به env.
- فعال/غیرفعال per-restaurant: `Restaurant.payment_enabled` (پنل شرکت → جزئیات رستوران).
- جدولِ `payments` جداست (نه فقط فیلد روی Reservation) چون یک رزرو می‌تواند چند تلاشِ پرداخت داشته باشد.
- روت‌ها: `POST /reservations/:code/pay`، `GET /payments/callback` (verify سمت سرور، idempotent، هیچ‌وقت به Status در URL اعتماد نمی‌کند)، `GET/PATCH /admin/settings`.
  **⚠️ اصلاح‌شده (۲۰۲۶-۰۸-۱۲):** این خط قبلاً یک روتِ `PATCH /restaurant/reservations/:code/deposit` را هم اینجا فهرست کرده بود — چنین روتی در کدِ فعلی وجود ندارد (چک‌شده: `api/src/app/api/v1/restaurant/reservations/[code]/` فقط `events` و `status` دارد؛ `status` فقط انتقالِ وضعیت را می‌پذیرد، نه مبلغِ پیش‌پرداخت). یا این قابلیت هیچ‌وقت واقعاً ساخته نشده، یا بعداً حذف شده — سندسازی نشده بود.
- **⚠️ یافته‌ی تأییدشده (۲۰۲۶-۰۸-۱۲):** با وجودِ اینکه `POST /reservations/:code/pay` در بک‌اند پیاده‌سازی شده، **هیچ‌کدام از سه پنل (customer/business/company) این روت را صدا نمی‌زنند** — جست‌وجوی کامل برایِ `pay`/`zarinpal`/`deposit` در `apps/customer/js`, `apps/business/js`, `apps/company/js` صفر نتیجه داد. یعنی جریانِ پرداختِ آنلاین از سمتِ UI قابلِ‌دسترسی نیست، برخلافِ ادعایِ «Complete» در `docs/architecture-audit/FEATURE_COVERAGE_MATRIX.md`. قبل از اتکا به این قابلیت، یا UI را بسازید یا آن سند را اصلاح کنید.
- **هنوز نیاز به:** merchant ID واقعیِ زرین‌پال (owner از پنل شرکت وارد کند) + تعریفِ قالبِ پیامکِ `rezervno-deposit` در پنلِ کاوه‌نگار.

## ۶.۵ چت مشتری ↔ رستوران (Polling-based)

- **معماری:** Polling (نه WebSocket) — چون routeها روی Vercel serverless‌اند و اتصال دائمی نگه نمی‌دارند. هر ۴ ثانیه، فقط وقتی صفحه‌ی چت باز است.
- **مدل:** `ChatThread` (بین یک user و یک restaurant، اختیاری لینک به reservation) + `ChatMessage`. دو حالت: عمومی (reservationId=null) یا per-reservation.
- **یکتایی:** با **partial unique index** در migration 024 (نه `@@unique` — چون Postgres هر NULL را یکتا می‌بیند و thread عمومی تکراری می‌شد). یک index برای `reservation_id IS NOT NULL` و یکی برای `IS NULL`.
- **شمارنده‌ی unread:** `unreadForUser`/`unreadForStaff` روی thread — به‌صورت اتمیک در `$transaction` با ارسال پیام آپدیت می‌شوند (بدون کوئری سنگین برای badge).
- **منطق مشترک:** `lib/chat.ts` (`getOrCreateThread`, `postMessage`, `markRead`, `serializeMessage`) — هر دو سمت ازش استفاده می‌کنند.
- **روت‌ها:**
  - مشتری: `GET /me/chats` (لیست)، `GET/POST /me/chats/:id` (پیام‌ها + ارسال، با `?after=<iso>` برای polling)، `POST /restaurants/:slug/chat` (شروع/بازگرداندن thread).
  - بیزنس: `GET /restaurant/chats` (اینباکس)، `GET/POST /restaurant/chats/:id` (پاسخ، با permission `canManageReservations`).
- **امنیت:** هر روت مالکیت thread را چک می‌کند (مشتری فقط thread خودش، رستوران فقط thread رستوران خودش). RLS روی هر دو جدول فعال (deny-by-default).
- **فرانت:** مشتری `js/features/chat.js` (صفحه‌ی «پیام‌ها» + دکمه‌ی 💬 در صفحه‌ی رستوران). بیزنس `js/chat.js` (view «پیام‌ها» در sidebar + مودال گفتگو). هر دو با optimistic UI.
- **تست‌شده روی DB زنده:** flow پیام دوطرفه + شمارنده‌ها + read + cascade delete + بلاک‌شدن thread تکراری — همه PASS.

## ۷. اعتبارسنجی (Zod)

- `lib/schemas.ts`: `parseBody`/`parseQuery`/`parseParam` + پرایمیتیوها (`zPhone`, `zUuid`, `zDateStr`, `zTimeStr`, `zPartySize`).
- **~۵۱ روت** به Zod migrate شده‌اند (این نسخه پوشش خوبی دارد). بقیه هنوز `validate.ts` قدیمی.
- `zPhone` خروجی‌اش دقیقاً `+98XXXXXXXXXX` است (نه رقمِ خام) — چون مستقیم برای DB lookup استفاده می‌شود.
- `parseBody` از `safeJson` (محدودیتِ حجم ۱۰۰KB) استفاده می‌کند، نه `req.json()` خام.

## ۸. باگ‌های بحرانیِ کشف‌شده (این‌ها را دوباره کشف نکن)

| باگ | فایل | وضعیت |
|---|---|---|
| هاردکدِ `+03:30` به‌جای `restaurant.timezone` (۳ جا) | `availability.ts`, `reservation-helpers.ts` | ✅ رفع (`zonedTimeToUtc`) — این نشست |
| OTP input هر ۳ اپ `maxlength="4"` بود، بک‌اند ۶رقمی می‌سازد → ورودِ واقعی ناممکن | ۳ اپ frontend | ✅ رفع — این نشست |
| `ALLOWED_ORIGINS` بدونِ fail-fast در production → چک CSRF خاموش | `middleware.ts` | ✅ رفع — این نشست |
| `payments`/`platform_settings`/`restaurant_closures` بدون RLS در migrationها | migration 023 | ✅ رفع (DB زنده از قبل داشت) — این نشست |
| `permissions.ts`: `findFirst` فقط با tenantId، نه staff.id → مجوزِ اشتباه | `lib/permissions.ts` | ✅ رفع (تاریخچه) |
| `blockBufferMinutes` نوشته/خوانده می‌شد ولی در schema نبود → هر رزرو می‌ترکید | `schema.prisma` | ✅ رفع |
| `restaurant_closures` هیچ‌وقت ساخته نشده بود ولی raw-SQL ازش SELECT می‌زد | `schema.prisma` + migration 021 | ✅ رفع |
| `Coupon.targetSegment` بدونِ `@map` (تنها mixed-case کلِ schema) | `schema.prisma` | ✅ رفع (migration 022) |
| ۴ مدل بدونِ FK واقعی (Webhook, SmsTransaction, GuestProfile, RestaurantClosure) | `schema.prisma` | ✅ رفع (migration 022) |
| ایندکس‌های تکراری (`idx_resv_table_active_range`, `payments_authority_idx`) | — | ✅ حذف (migration 022) |
| OTP_DEV_MODE در production فقط warn بود | `lib/otp.ts` | ✅ رفع (fail-fast) |
| CORS اصلاً نبود در middleware | `middleware.ts` | ✅ رفع |

## ۹. Migrationها

`prisma/sql/*.sql` — از طریق `prisma/apply-sql.sh` (با `prisma db execute`) در entrypoint و CI
**خودکار اجرا می‌شوند**؛ فایل‌های `-- @manual-only` (راهنماهای پارتیشنینگ ۰۰۲/۰۱۱) رد می‌شوند. آخرین شماره: **۰۲۶**.
قبل از هر کارِ جدید روی schema، با connector Supabase (`list_tables`/`execute_sql`) چک کن آخرین migration
واقعاً روی DB زنده اعمال شده. همه idempotent‌اند (`IF NOT EXISTS` / `DO $$ ... EXCEPTION`).

## ۱۰. چک‌لیستِ لانچ (باقی‌مانده)

- ✅ تستِ خودکار — **دیگر صفر نیست**: بک‌اند ۱۰۲ تستِ واحد (`npm test`) + `tsc --noEmit` + `eslint`
  همه پاک؛ e2e (Playwright) برای customer و پنل‌ها روی ۳ viewport (iPhone 13 / Pixel 5 / Desktop)،
  همه در CI (`.github/workflows/ci.yml`: build/design-system/test/e2e/security). load-test (k6) هنوز فقط اسکریپت است.
- ⚠️ **API روی Vercel هنوز ۴۰۴ می‌دهد** — باگِ کد نیست (بک‌اند سالم)، تنظیمِ داشبورد است:
  Root Directory=`api` + متغیرهای env + خاموش‌بودنِ Deployment Protection. راهنمای گام‌به‌گام: `docs/DEPLOY_API_VERCEL.md`.
- ❌ merchant ID واقعیِ زرین‌پال + قالبِ پیامکِ کاوه‌نگار
- ❌ کلیدِ واقعیِ `KAVENEGAR_API_KEY` (بدونش SMS واقعی ارسال نمی‌شود، فقط لاگ)
- ⚠️ HA — تک‌instance Postgres/Redis، بدون replica
- ⚠️ پن‌تستِ مستقل انجام نشده
- ⚠️ مستنداتِ قانونی (حریم خصوصی، قوانین) صفر
- ⚠️ `og-image.png` / `icon-192.png` / `icon-512.png` — فایلِ raster واقعی لازم دارند (طراح). favicon.svg هر ۳ اپ ساخته شد.
- ⚠️ per-restaurant URL برای SEO (فعلاً SPA تک‌URL؛ نیاز به router واقعی + SPA fallback در nginx)

## ۱۱. کانکتورهای در دسترس (تأییدشده)

- **Supabase**: پروژه‌ی `zmyuvtpbchytqvtgyewt` — `list_tables`/`execute_sql`/`apply_migration` تست‌شده.
- **Vercel**: تیمِ `ardalanaz2-4503s-projects` (`team_gLTPq1IJB0ayoC3NsDE4yoXg`). یک دیپلوی تستیِ موفق انجام شده؛ خودِ `api` هنوز دیپلوی نشده (نیاز به دیپلوی گیت-بیس، نه آپلودِ مستقیمِ ۱۳۰+ فایل).

## ۱۲. کنوانسیون‌ها (حفظ کن)

- کامنت‌های فارسی که باگ‌ها را با «باگ (رفع‌شده)» علامت می‌زنند.
- Migrationها idempotent.
- فرانت: business/company اسکریپتِ کلاسیک با singletonِ `API` و helperهای `openModal`/`toast`/`esc`/`fa`؛ customer از ES modules با exportهای `window.X`.
- **دارایی‌های مشترک را فقط در `shared/` ویرایش کن، بعد `sh tools/sync-design-system.sh` را اجرا کن** و هر دو را با هم commit کن (وگرنه CI drift می‌شکند).
- چک سینتکس: `node --check` (کلاسیک) / `node --input-type=module --check` (ESM) / شمارشِ brace برای `.ts`.
- خطوطِ بعضی فایل‌ها **CRLF** است (`apps/customer/{index.html,api.js,sw.js}`، `apps/business/index.html`، `apps/company/{index.html,js/api.js}`) — موقعِ ویرایش با byte-level حفظ کن؛ بقیه LF.
- تست‌های پنل با `nav()` مستقیم ناوبری می‌کنند (نه کلیکِ نوارِ کناری) تا روی موبایل هم پایدار باشند.
