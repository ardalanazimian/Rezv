# رزرونو — سند حسابرسی و تحویل پروژه (Project Audit & Handoff)

**تاریخ تولید:** ۲۰۲۶-۰۷-۱۹ · **مبنا:** بررسی مستقیمِ کدِ واقعی (ریپو + DB زنده‌ی Supabase)، نه مستندات قدیمی
**هدف سند:** مرجعِ یک‌جا برای تستِ یکپارچگیِ نهایی قبل از لانچ

> ⚠️ نکته‌ی حیاتی برای تیمِ تست: **DB زنده جلوتر از این ریپوـه.** جزئیات در بخش ۹/۱۰.

---

## ۱. فیچرهای پیاده‌سازی‌شده

| حوزه | وضعیت | توضیح |
|---|---|---|
| احراز هویت مشتری/staff (OTP پیامکی) | ✅ کامل | بدون پسورد/ایمیل؛ JWT access+refresh با rotation |
| موتور رزرو (ساخت/لغو/رسید/چرخه‌ی حیات) | ✅ کامل | state machine در `lib/lifecycle.ts`، تایم‌زون per-restaurant |
| چندشعبه‌ای (Multi-branch) | ✅ کامل (امروز وصل شد) | `staff.restaurant_id` + هدر `X-Restaurant-Id` + `/restaurant/branches` |
| پرداخت آنلاین (Zarinpal، بیعانه) | ⚠️ کد کامل، پیکربندی ناقص | نیاز به merchant_id واقعی از `/admin/settings` |
| لیست انتظار (Waitlist) با اولویتِ VIP | ✅ کامل | |
| باشگاه مشتریان (امتیاز/دعوت/کارت هدیه) | ✅ کامل | |
| کوپن، اتوماسیونِ مارکتینگ، کمپین SMS | ✅ کامل | |
| تشخیصِ fraud (سیگنال) | ✅ کامل (SQL-based) | منطق در raw SQL، نه JS — یونیت‌تست‌پذیر نیست |
| RFM segmentation مشتری | ✅ کامل (SQL-based) | همان محدودیت بالا |
| چک‌این با QR | ✅ کامل | |
| آنالیتیکس رستوران (درآمد، اشغال، صف) | ✅ کامل | |
| پنل ادمین پلتفرم (کنترل تنانت، SMS balance، تنظیمات) | ✅ کامل | |
| اعتبارسنجیِ ورودی (Zod-like) | ✅ کامل (امروز تمام شد) | ۴۷ روتِ دارای ورودی، ۱۰۰٪ پوشش |
| Observability (Prometheus+Grafana) | ✅ کامل | |
| تست خودکار بک‌اند | ⚠️ جزئی | ۹۷ تستِ واقعی روی توابعِ خالص؛ integration test صفر |

---

## ۲. APIها و Endpointها (`/api/v1/*`, بک‌اند Next.js)

### احراز هویت
`POST auth/otp/request` · `POST auth/otp/verify` · `POST auth/staff/request` · `POST auth/staff/verify` · `POST auth/refresh` · `POST auth/logout`

### مشتری (customer-facing)
`GET/PATCH me` · `GET me/profile` · `GET me/points` · `GET me/reservations` · `POST me/referral` · `POST me/push-subscribe`
`GET restaurants` · `GET restaurants/:slug/availability` · `GET events`
`POST reservations` · `GET reservations/:code` · `POST reservations/:code/arrive` · `POST reservations/:code/cancel` · **`POST reservations/:code/pay`** 🆕
`GET/POST waitlist` · `GET/PATCH waitlist/:id` · `POST waitlist/:id/accept` · `POST waitlist/:id/decline`
`GET/POST gift-cards` · `POST checkin`
**`GET payments/callback`** 🆕 (بازگشت از درگاه، بدون auth)

### پنل رستوران (business, نیاز به staff auth)
شعبه: **`GET/POST restaurant/branches`** 🆕
رزرو/میز: `GET restaurant/reservations` · `GET restaurant/reservations/:code/events` · `PATCH restaurant/reservations/:code/status` · `GET/POST/PATCH restaurant/tables` · `PATCH restaurant/tables/:id/state` · `POST restaurant/walkin` · `POST restaurant/checkin`
صف: `GET/POST restaurant/waitlist` · `GET restaurant/waitlist/analytics`
مشتری/CRM: `GET restaurant/customers` · `GET restaurant/customers/:userId` · `GET/POST/PATCH/DELETE restaurant/notes` · `GET restaurant/rfm` · `GET restaurant/fraud-signals`
مارکتینگ: `GET/POST restaurant/coupons` · `GET/POST restaurant/automations` · `GET/POST restaurant/campaigns` · `POST restaurant/sms`
مالی: `GET/PATCH restaurant/cashback` · `GET/PUT restaurant/pricing` · `GET restaurant/reports`
تنظیمات: `GET/PATCH restaurant/hours` · `GET/POST/DELETE restaurant/photos` · `GET/PATCH restaurant/staff` · `GET restaurant/analytics` · `GET/POST/PATCH/DELETE restaurant/events` · `GET/POST restaurant/reviews` · `GET restaurant/members` · `GET restaurant/ai` · `POST restaurant/heartbeat`

### ادمین پلتفرم (admin auth جدا)
`GET admin/overview` · `GET admin/business-intelligence` · `GET admin/system-health` · `GET admin/security`
`GET/POST admin/restaurants` · `PATCH admin/restaurants/:id/control` · `GET/POST admin/restaurants/:id/sms`
**`GET/PATCH admin/settings`** 🆕 (merchant_id زرین‌پال و ...)

### داخلی
`GET health` · `GET metrics` · `POST maintenance/{expire, lifecycle, retention, rewards, waitlist, jobs-drain, customer-insights, ensure-partitions}` (نیاز به `x-maintenance-key`)

🆕 = امروز اضافه شد (feature قبلاً روی DB بود، کد نداشت)

---

## ۳. مدل‌های دیتابیس و روابط (Prisma / Postgres، ۳۵ جدول)

**هسته:** `Tenant` 1─* `Restaurant` 1─* `Staff` (با `restaurantId` اختیاری برای قفلِ شعبه)، `Restaurant` 1─* `Table`, `MenuItem`, `Reservation`
**رزرو:** `Reservation` *─1 `Restaurant`/`User`/`Table`؛ 1─* `ReservationItem`(پیش‌سفارش)، `ReservationEvent`(audit)، `Review`، **`Payment`** 🆕 (چون یک رزرو می‌تواند چند تلاشِ پرداخت داشته باشد)
**وفاداری:** `User` 1─* `ClubMember`(per restaurant, tier)، `PointsLedger`، `Referral`، `GiftCard`
**صف:** `WaitlistEntry` *─1 `Restaurant`/`User`
**مارکتینگ:** `Coupon`، `MarketingAutomation`، `CampaignLog`
**پلتفرم:** `AuditLog`، `Job`(صفِ async)، **`PlatformSettings`** 🆕(key/value سراسری)
**enum های کلیدی:** `ReservationStatus`(۱۸ مقدار)، `StaffRole`(owner/manager/staff/admin)، **`DepositStatus`** 🆕، **`PaymentStatus`** 🆕

⚠️ فیلدهای `restaurant.paymentEnabled`، `staff.restaurantId`، `reservation.depositAmountToman/depositStatus`، و مدل‌های `Payment`/`PlatformSettings` **امروز به `schema.prisma` اضافه شدند** (از قبل روی DB بودند، در schema نبودند).

---

## ۴. صفحات و کامپوننت‌های فرانت‌اند (سه اپ vanilla JS، بدون build step)

> این چت روی بک‌اند متمرکز بوده؛ جدول زیر فقط از ساختارِ HTML/JS استخراج شده، نه بررسیِ عمیقِ کامپوننت‌به‌کامپوننت.

| اپ | صفحات (screen/view) | فایل‌های JS کلیدی |
|---|---|---|
| **customer** (`apps/customer`) | discover، rest (جزئیات رستوران)، favorites، loyalty، trips، profile | `main.js`, `reservation.js`, `store.js`, `features/{food-dna,loyalty,rewards,trips}.js` |
| **business** (`apps/business`) | overview، reservations، floor (میزها)، waitlist، customers، loyalty، cashback، pricing، analytics، staff، profile | `overview.js`, `reservations.js`, `crm.js`, `marketing.js`, `staff-system.js`, `waitlist.js`, `routing.js` |
| **company** (`apps/company`) | overview، restaurants، detail (جزئیاتِ یک رستوران)، customers، analytics، billing، security، system-health، support | `overview.js`, `restaurant.js`, `intelligence.js`, `api.js` |

⚠️ **نکته‌ی مهم:** هیچ‌کدام از سه اپ هنوز از endpointهای امروز (`/restaurant/branches`, `/reservations/:code/pay`, `/admin/settings`) استفاده نمی‌کنند — UI برای این فیچرها ساخته نشده.

⚠️ **پوشه‌ی legacy:** در ریشه‌ی ریپو (`/business`, `/company`, `/js`, `/css`, `/index.html`) یک نسخه‌ی قدیمی‌ترِ همین اپ‌ها هم وجود دارد که ظاهراً پیش از restructure به `apps/` بوده. باید مشخص شود کدام نسخه فعال است؛ اگر هردو دیپلوی شوند سردرگمی ایجاد می‌شود.

---

## ۵. جریان‌های UI (UI Flows)

1. **رزرو مشتری:** جستجو/کشف (discover) → جزئیاتِ رستوران → انتخابِ زمان/ظرفیت → ثبتِ رزرو → (اگر بیعانه لازم باشد) **ریدایرکت به زرین‌پال → بازگشت با `?payment=paid|failed`** 🆕 → صفحه‌ی وضعیتِ رزرو
2. **ورود (هر سه اپ):** شماره → OTP (۴ رقمی دمو / ۶ رقمی واقعی) → توکن
3. **پنل رستوران - شیفتِ کاری:** overview → لیستِ رزروهای امروز → رسید/نشاندن روی میز (floor) → تغییرِ وضعیت (`checked_in→seated→dining→completed`)
4. **پنل رستوران - چندشعبه‌ای** 🆕 **(بدون UI):** owner/manager باید بتواند از سوییچرِ شعبه استفاده کند (هدر `X-Restaurant-Id`)؛ فعلاً فقط API آماده است.
5. **پنل شرکت - تنظیمِ پرداخت** 🆕 **(بدون UI):** owner باید merchant_id زرین‌پال را وارد کند؛ فعلاً فقط API (`/admin/settings`) آماده است، فرم نیست.
6. **لیستِ انتظار:** مشتری وارد صف می‌شود → اولویت بر اساسِ tier باشگاه → staff دستی یا خودکار ارتقا می‌دهد → SMS اطلاع‌رسانی

---

## ۶. باگ‌های شناخته‌شده و باز (Known/Open)

| باگ | شدت | جزئیات |
|---|---|---|
| `OTP_DEV_MODE=true` در production فقط warn می‌کند، نه fail-fast | 🔴 بحرانی | برخلافِ ادعای مستنداتِ قبلی، هنوز در کدِ فعلی رفع نشده — قبل از لانچ باید چک شود |
| ریشه‌ی drift بینِ DB و گیت رفع نشده | 🟠 فرآیندی | مشخص نیست چرا migration های ۰۱۸-۰۲۲ کامیت نشدند؛ بدونِ رفعِ فرآیند، احتمالِ تکرار هست |
| Orphan authority در پرداخت | 🟡 حاشیه‌ای | اگر بعد از موفقیتِ درخواست به زرین‌پال، نوشتنِ DB fail کند، رکوردی برای تطبیق نمی‌ماند — نیاز به reconciliation job |
| عدمِ idempotency روی دابل‌کلیکِ `/reservations/:code/pay` | 🟡 حاشیه‌ای | چند authority برای یک رزرو ساخته می‌شود (بی‌ضرر ولی تمیز نیست) |
| منطقِ RFM/fraud در raw SQL | 🟡 محدودیت | یونیت‌تست‌پذیر نیست؛ فقط integration test روی DB واقعی می‌تواند پوششش دهد |
| رزروهای مهمان (بدون حساب) نمی‌توانند بیعانه پرداخت کنند | 🟡 محدودیتِ scope | `/reservations/:code/pay` فقط مشتریِ لاگین‌شده را می‌پذیرد |
| پوشه‌ی legacy فرانت در ریشه‌ی ریپو | 🟡 نامشخص | بخش ۴ را ببین |
| پوششِ تستِ integration صفر | 🟠 | فقط تستِ واحدِ توابعِ خالص؛ هیچ روتی end-to-end تست نشده |
| `btree_gist` extension در schema عمومیِ Supabase | 🟢 جزئی | توصیه‌ی امنیتی، نه آسیب‌پذیری |
| HA — تک‌instance Postgres/Redis | 🟡 عملیاتی | بدون replica |
| پن‌تستِ مستقل | 🟡 | انجام نشده |

---

## ۷. باگ‌های رفع‌شده (این نشست + تاریخچه‌ی گیت)

**امروز:**
- `zUuid`/`zPhone`/... به‌عنوانِ const مشترک، با `.optional()` globally mutate می‌شدند (bypass اعتبارسنجیِ خاموش) → کلِ لایه‌ی validate.ts به الگوی immutable (clone-on-write) بازنویسی شد
- `restaurant/automations`: `z.object({})` تمامِ کلیدهای `trigger_config` را پاک می‌کرد → `z.record()`
- **پرداختِ زرین‌پال بدونِ `currency:'IRT'`** → پیش‌فرض API ریال است، یعنی ۱/۱۰ مبلغِ واقعی دریافت می‌شد
- `payments/callback`: `.catch(()=>{})` روی rate-limit کاملاً آن را غیرفعال می‌کرد
- `resolveStaffRestaurant` کاملاً `restaurant_id` را نادیده می‌گرفت → چندشعبه‌ای عملاً کار نمی‌کرد
- ۵ فایلِ تستِ «ساختگی» (منطق را بازتولید می‌کردند، نه import) با ۹۷ تستِ واقعی جایگزین شد؛ یک رگرسیونِ واقعی همین‌جا کشف شد (`confirmed→seated` مستقیم دیگر مجاز نیست، تستِ قدیمی این را نمی‌دانست)
- ۴۷ روت از حالتِ بدونِ‌اعتبارسنجی/دستی به Zod-like schema مهاجرت کردند

**تاریخچه‌ی گیت (پیش از این نشست):**
`permissions.ts` تخصیصِ مجوزِ اشتباه به همه‌ی tenant · هاردکدِ آفستِ `+03:30` · فقدانِ `blockBufferMinutes`/`restaurant_closures` در schema · OTP maxlength ۴ vs ۶ در فرانت · `OTP_DEV_MODE` فقط warn (⚠️ رفعِ ادعاشده، امروز دوباره بررسی و **هنوز باز** پیدا شد) · Grafana پسوردِ پیش‌فرض · دکمه‌های صفِ انتظار/رسید در پنل business فیک بودند (بدونِ API واقعی)

---

## ۸. یکپارچگی‌های ناقص/گم‌شده (Missing Integrations)

| مورد | وضعیت |
|---|---|
| **Zarinpal** | کدِ کامل، نیازِ merchant_id واقعی از `/admin/settings` |
| **Kavenegar SMS** | fetch واقعی پیاده‌سازی شده، نیازِ `KAVENEGAR_API_KEY` واقعی + ثبتِ قالب‌های پیامکی در پنلِ کاوه‌نگار |
| **ایمیل** | عمداً پیاده‌سازی نشده (auth فقط پیامکی، بدونِ ایمیل) |
| **تستِ خودکار end-to-end / E2E (Playwright)** | اسکریپت `test:e2e` هست، هیچ تستی نوشته نشده |
| **مستنداتِ قانونی** (حریم خصوصی، قوانین) | صفر |
| **آیکن‌های PWA (PNG)** | فقط SVG؛ نیازِ فایلِ raster از طراح |
| **UI برای فیچرهای چندشعبه‌ای/پرداخت/تنظیماتِ پلتفرم** | فقط API؛ فرانت هنوز چیزی صدا نمی‌زند |

---

## ۹. متغیرهای محیطی (Environment Variables)

| متغیر | الزامی؟ | توضیح |
|---|---|---|
| `DATABASE_URL` | ✅ | با pooler (PgBouncer)، نه اتصالِ مستقیم |
| `DATABASE_DIRECT_URL` | فقط migrate | اتصالِ مستقیم برای `prisma migrate` |
| `DATABASE_REPLICA_URL` | اختیاری | `dbRead` — بدونش خودکار به primary برمی‌گردد |
| `REDIS_URL`, `REDIS_PASSWORD` | ✅ | الزامی در production |
| `REDIS_CLUSTER_NODES` | اختیاری | اگر ست شود، `REDIS_URL` نادیده گرفته می‌شود |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ✅ | fail-fast اگر کوتاه باشند |
| `OTP_DEV_MODE` | ✅ | **باید `false` باشد در production** — رجوع کن به بخش ۶ |
| `KAVENEGAR_API_KEY`, `KAVENEGAR_TPL_*` | برای SMS واقعی | |
| `SENTRY_DSN` | اختیاری | |
| `METRICS_TOKEN` | اختیاری | محافظتِ `/api/metrics` |
| `GRAFANA_PASSWORD` | ✅ (اگر observability) | پیش‌فرض `admin` عوض شود |
| `LOG_LEVEL` | اختیاری | |
| **`ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`** 🆕 | fallback | مقدارِ اصلی از `platform_settings` (پنل ادمین) خوانده می‌شود |
| **`CUSTOMER_APP_URL`** 🆕 | ✅ (اگر پرداخت فعال) | مقصدِ ریدایرکتِ بعدِ بازگشت از درگاه |
| `ALLOWED_ORIGINS` | ✅ در production | CORS + چکِ CSRF؛ خالی = بلاکِ کامل cross-origin |

---

## ۱۰. الزاماتِ دیپلوی

- **زیرساخت:** `docker-compose.yml` (ریشه) → سرویس‌های `postgres` (۱۶-alpine)، `redis` (۷-alpine)، `api` (Next.js/Node)، `nginx` (سرو سه فرانتِ استاتیک). `infra/` شاملِ Prometheus+Grafana+exporterها، cron، backup.
- **DB:** پروژه‌ی Supabase فعال = `zmyuvtpbchytqvtgyewt`. **قبل از هر کار جدید روی schema، `npx prisma migrate diff` بزن** تا مطمئن شوی schema.prisma با DB زنده یکی است (رجوع به بخش ۲/۳).
- **Migration های manual:** `prisma/migrations/manual/*.sql` خودکار اجرا نمی‌شوند — باید دستی یا با connector Supabase (`apply_migration`) زده شوند. **هر migration دستی باید همان لحظه commit شود** — این نشست ثابت کرد که این قانون قبلاً رعایت نشده (بخش ۹ بالا).
- **Prisma:** بعد از دریافتِ فایل‌های این نشست، حتماً `npx prisma generate` بزن (مدل‌های `Payment`/`PlatformSettings` جدیدند).
- **قبل از لانچ (بلاکرهای واقعی):**
  1. `OTP_DEV_MODE=false` در production تأیید و fail-fast شود (بخش ۶)
  2. merchant_id واقعیِ زرین‌پال از `/admin/settings` وارد شود + تستِ یک تراکنشِ واقعی (مبلغ را دوبار چک کن — بخش ۷)
  3. `KAVENEGAR_API_KEY` واقعی + ثبتِ قالب‌ها
  4. `ALLOWED_ORIGINS`، `JWT_SECRET*`، `REDIS_PASSWORD`، `GRAFANA_PASSWORD` در production ست شوند (نه مقادیرِ نمونه)
  5. تصمیم درباره‌ی پوشه‌ی legacy فرانت در ریشه (بخش ۴)
  6. حداقلِ یک دورِ E2E دستی روی مسیرِ پرداخت و چندشعبه‌ای قبل از لانچ (چون UI هنوز به این APIها وصل نیست)
