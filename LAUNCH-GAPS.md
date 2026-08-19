# شکاف‌سنجی لانچ — RezervoNo

> فرض: فرانتِ production زنده است، بک‌اند هنوز دیپلوی نشده، صفر کاربر واقعی.
> فقط شکاف‌های **در کد** — زیرساخت (دیپلوی بک‌اند، Redis، دامنه، کاوه‌نگار) اینجا نیست.
> اندازه: S (< ۱ ساعت) · M (چند ساعت) · L (روز+).

---

## 🔴 بلاکر لانچ — **۰ موردِ باز** (۱ اصلاح‌شده، ۱ رد شد)

| # | شکاف | وضعیت | فایل |
|---|------|-------|------|
| 1 | **طول OTP ناسازگار:** هر سه فرانت کدِ ۴ رقمی می‌خواستند (`/^\d{4}$/`) ولی بک‌اند کدِ ۶ رقمی می‌سازد → ورودِ واقعی غیرممکن بود (دموِ `1234` این را پنهان کرده بود). | ✅ **اصلاح شد** (`/^\d{4,6}$/`، کامیت `3bcea94`) | `js/auth.js` · `business/js/staff-system.js` · `company/js/intelligence.js` |
| 2 | ~~refreshِ staff توکنِ customer می‌دهد~~ | ⛔️ **رد شد (اشتباهِ گزارش):** کدِ فعلیِ v2129 درست است — refresh token حالا `kind/tenantId/role` را حمل می‌کند (برچسبِ «باگ C3»)، و روتِ refresh نقشِ به‌روزِ staff را از DB با چکِ `isActive` بازصادر می‌کند. من از روی کدِ **قدیمی** حدس زده بودم. | `api/src/app/api/v1/auth/refresh/route.ts` · `api/src/lib/jwt.ts` · `auth/staff/verify/route.ts:25` |

---

## 🟡 هفته‌ی اول — لانچ می‌شود ولی سریع درد می‌گیرد

> وضعیت (به‌روزرسانیِ PR #24): از ۶ مورد، **۳ مورد اصلاح شد** (۴ برچسبِ [DEMO]، ۶ ثبتِ نظرِ مشتری، ۸ اعتبارِ اولیه‌ی پیامک).
> **۳ موردِ باز باقی مانده:** ۳ (Idempotency-Key در فرانت)، ۵ (اسکلت‌بودنِ push/email)، ۷ (نبودِ `error.tsx`/`not-found.tsx`) — هیچ‌کدام در دامنه‌ی PR #24 نبودند و عمداً دست‌نخورده مانده‌اند.

| # | شکاف | فایل | اندازه |
|---|------|------|--------|
| 3 | ✅ **اصلاح شد** — **Idempotency-Key ارسال نمی‌شود:** بک‌اند از هدر `Idempotency-Key` برای جلوگیری از double-submit پشتیبانی می‌کرد ولی هیچ فرانتی آن را نمی‌فرستاد. حالا مسیرِ walk-in هم در بک‌اند با `withIdempotency` محافظت شده (قبلاً اصلاً چک نمی‌کرد) و هم فرانتِ بیزنس UUID می‌فرستد. صفِ آفلاینِ `Outbox` هم هدرها را در retry منتقل می‌کند — وگرنه عملیاتِ صف‌شده با کلیدِ تازه دوباره اجرا می‌شد و رزروِ دوم می‌ساخت. | `api/src/app/api/v1/restaurant/walkin/route.ts` · `business/js/data.js` · `business/js/reservations.js` | S |
| 4 | ✅ **اصلاح شد** — **نام‌های نمونه بدون برچسب [DEMO]:** دادهٔ آفلاین/دموِ فرانت رستوران‌هایی مثل «کافه‌رستوران ویستا / گرام برگر / آوا روف‌تاپ» را بدونِ برچسب نشان می‌داد و بازدیدکننده آن‌ها را رستورانِ واقعیِ قابل‌رزرو می‌دید. حالا هر ۶ نامِ نمونه در `seed.js` با پیشوندِ `[DEMO]` ذخیره می‌شوند (تأییدشده: هیچ نامِ نمونه‌ای بدونِ برچسب باقی نمانده). | `js/data/seed.js` | S |
| 5 | ✅ **push ذخیره‌سازیِ واقعی گرفت** — قبلاً `me/push-subscribe` یک no-op بود. حالا جدولِ `push_subscriptions` (migration ۰۴۹) وجود دارد و روت واقعاً upsert/read می‌کند. **صداقت:** `enabled` یعنی «ذخیره شده»، و فیلدِ جداگانه‌ی `ready` همیشه `false` می‌ماند چون ارسالِ واقعیِ push (FCM/APNs) هنوز ساخته نشده — این یک محدودیتِ مستند است، نه ادعای دروغ. **email بدونِ تغییر ماند:** `sendEmail`/`sendPush` از قبل صادقانه لاگ می‌کردند وقتی کلیدِ ارائه‌دهنده نبود. | `api/src/app/api/v1/me/push-subscribe/route.ts` · `api/prisma/sql/049-push-subscriptions.sql` | M |
| 6 | ✅ **اصلاح شد** — **مشتری نمی‌تواند نظر ثبت کند:** قبلاً فقط `restaurant/reviews` با GET/PATCH بود و هیچ روتِ POST برای ساختِ نظر وجود نداشت. حالا `POST /api/v1/me/reviews` در بک‌اند هست و فرانتِ مشتری هم واقعاً صدایش می‌زند: دکمه‌ی «ثبت نظر» رویِ سفرِ تکمیل‌شده → `openReviewSheetFromTrip(code)` که `restaurant_id` (+ `reservation_id` در صورت وجود) را POST می‌کند. **صداقت:** اگر `restaurantId` یک UUIDِ واقعی نباشد (سفرِ دمو با idِ عددی)، هرگز موفقیتِ ساختگی نشان نمی‌دهد — یا صفحه‌ی رستوران باز می‌شود یا پیامِ صریح؛ توستِ موفقیت فقط رویِ `res.ok` واقعی. | `api/src/app/api/v1/me/reviews/route.ts` · `apps/customer/js/reservation.js` | M |
| 7 | ✅ **اصلاح شد** — `app/error.tsx` و `app/not-found.tsx` اضافه شدند (برندِ رزرونو، RTL). روت‌هایِ API دست‌نخورده ماندند: خطایشان همچنان از `route.ts` به envelope JSON تبدیل می‌شود، نه از این صفحات. | `api/src/app/error.tsx` · `api/src/app/not-found.tsx` | S |
| 8 | ✅ **اصلاح شد** — **موجودیِ SMSِ پیش‌فرض صفر:** چون همه‌ی پیامک‌ها از `sms_balance` کم می‌کنند، رستورانِ تازه با پیش‌فرضِ `0` هیچ پیامکی نمی‌فرستاد (job با «موجودی کافی نیست» به DLQ می‌رفت). حالا در هر دو لایه: `smsBalance @default(50)` در schema + `ALTER COLUMN ... SET DEFAULT 50` در migration `048`، و مقدارِ صریحِ `smsBalance: 50` در **هر سه** مسیرِ ساختِ رستوران (دموی رایگانِ `site-orders.ts`، شعبه‌ی تازه‌ی `branches/route.ts`، و `seed.ts`). عددِ مرجع: `STARTER_SMS_BALANCE` در `lib/sms-balance.ts`. **موجودیِ رستوران‌های موجود عمداً دست‌نخورده ماند** — شارژ از مسیرِ topupِ پنلِ شرکت انجام می‌شود، نه با آپدیتِ دسته‌جمعی. (تأییدِ زنده رویِ Postgres: درجِ رستوران بدونِ ذکرِ `sms_balance` → مقدار ۵۰.) | `api/prisma/schema.prisma` · `api/prisma/sql/048-sms-starter-balance-default.sql` · `api/src/lib/site-orders.ts` · `api/src/app/api/v1/restaurant/branches/route.ts` · `api/prisma/seed.ts` | S |

---

## 🟢 بعداً — مهم ولی نه الان

| # | شکاف | فایل | اندازه |
|---|------|------|--------|
| 8 | **پارتیشن‌بندیِ reservations اجرا نشده:** تابع `ensure_reservation_partition` ساخته نشده؛ فقط در مقیاسِ میلیون‌ها ردیف لازم است و روت `ensure-partitions` الان تمیز skip می‌کند. | `api/prisma/sql/011-reservations-partitioning.sql` | L |
| 9 | **Read replica بدون replica:** `dbRead` پیکربندی شده ولی بدون `DATABASE_REPLICA_URL` به primary برمی‌گردد (degrade تمیز). برای بار خواندنیِ بالا بعداً. | `api/src/lib/db.ts` | L |
| 10 | **CRUD عمیق‌ترِ پنل‌ها:** بخش‌های reviews/photos/notes/campaigns پایه‌اند و جای پولیش دارند (فیلتر، صفحه‌بندی، حالتِ خالی). | `business/js/*` | M |

> **تصحیح (double-check):** موردِ قبلیِ «بیلینگِ پیامکِ تراکنشی عمداً متر نمی‌شود» **غلط بود** — کدِ v2129 با اصلاحِ «C6» روی **همه‌ی** SMS (تأیید رزرو، lifecycle، markArrival، کمپین، اتوماسیون) `restaurantId` می‌فرستد، پس همه از موجودی کسر می‌شوند. پیامدِ واقعی به 🟡 منتقل شد (مورد ۷ پایین).

---

## ✅ چیزهایی که بررسی شد و **سالم** بود (بلاکر نیست)
- **rate-limit روی OTP:** در بک‌اند هست (`RULES.otpPerPhone`/`otpPerIp` + شمارنده‌ی redis در `otp.ts`).
- **فلوی لغو رزرو:** درست به `/reservations/{code}/cancel` وصل است با هندلینگِ کامل (`js/features/trips.js:86`).
- **double-booking:** با constraintِ `no_table_overlap` + بافرِ نظافت در سطحِ DB تضمین شده (تستِ عملی شد).
- **قراردادِ API:** همه‌ی مسیرها/متدهای سه فرانت به روت‌های واقعی نگاشت می‌شوند (بدون ۴۰۴).
- **هماهنگیِ auth/برند:** الگوی توکن، هدر Authorization، هندلینگِ ۴۰۱، کلیدهای storageِ namespaced، فرمتِ تاریخِ `fa-IR`، نرمال‌سازیِ شماره، envelope خطا، و حالتِ دمو در هر سه اپ یکدست‌اند.
- **payloadِ ساختِ رزرو:** `{restaurant_id, date, time, party_size}` با انتظارِ بک‌اند می‌خواند.

## اصلاح‌شده در همین جلسه
- نگاشتِ وضعیتِ رزرو در اپ مشتری (`mapTripStatus`) کامل شد — قبلاً `completed/cancelled/expired/…` اشتباهاً «پیش‌رو» نمایش داده می‌شدند. (کامیت `d10875d`)

## اصلاح‌شده در نشستِ ۲۰۲۶-۰۸-۰۷ (تستِ end-to-end واقعی روی Postgres/Redis + مرورگرِ واقعی)

برایِ اولین‌بار Postgres+Redisِ واقعی (نه فرض) روی سندباکس بالا آمد و کلِ زنجیره
(migration + seed + کدِ جدید) با HTTP و مرورگرِ واقعی تست شد. این ۷ باگِ واقعی را
آشکار کرد — هیچ‌کدام با تایپ‌چک/فرض قابلِ کشف نبودند (PR #4 و #5):

| # | باگ | شدت | فایل |
|---|---|---|---|
| 1 | ستونِ `tenants.version` هیچ migrationی نداشت → مسیرِ زنده‌یِ ثبت‌نامِ رایگان (trial) با P2022 می‌شکست | 🔴 بلاکر | `prisma/sql/035` |
| 2 | ۷ ستونِ `restaurants` + `users.email` همین مشکل | 🔴 بلاکر | `prisma/sql/036` |
| 3 | ✅ **اصلاح شد** — **Idempotency-Key ارسال نمی‌شود:** بک‌اند از هدر `Idempotency-Key` برای جلوگیری از double-submit پشتیبانی می‌کرد ولی هیچ فرانتی آن را نمی‌فرستاد. حالا مسیرِ walk-in هم در بک‌اند با `withIdempotency` محافظت شده (قبلاً اصلاً چک نمی‌کرد) و هم فرانتِ بیزنس UUID می‌فرستد. صفِ آفلاینِ `Outbox` هم هدرها را در retry منتقل می‌کند — وگرنه عملیاتِ صف‌شده با کلیدِ تازه دوباره اجرا می‌شد و رزروِ دوم می‌ساخت. | `api/src/app/api/v1/restaurant/walkin/route.ts` · `business/js/data.js` · `business/js/reservations.js` | S |
| 4 | انتخابِ «شعبه‌ی پیش‌فرض» بینِ لاگینِ staff و بقیه‌ی APIها برایِ تنانتِ چندشعبه‌ای ناسازگار بود (دو کوئریِ جدا، بدونِ orderBy) — صاحبِ چندشعبه‌ای دیتایِ شعبه‌ی اشتباه می‌دید | 🔴 بلاکر (چندشعبه‌ای) | `lib/staff-helpers.ts` |
| 5 | ✅ **push ذخیره‌سازیِ واقعی گرفت** — قبلاً `me/push-subscribe` یک no-op بود. حالا جدولِ `push_subscriptions` (migration ۰۴۹) وجود دارد و روت واقعاً upsert/read می‌کند. **صداقت:** `enabled` یعنی «ذخیره شده»، و فیلدِ جداگانه‌ی `ready` همیشه `false` می‌ماند چون ارسالِ واقعیِ push (FCM/APNs) هنوز ساخته نشده — این یک محدودیتِ مستند است، نه ادعای دروغ. **email بدونِ تغییر ماند:** `sendEmail`/`sendPush` از قبل صادقانه لاگ می‌کردند وقتی کلیدِ ارائه‌دهنده نبود. | `api/src/app/api/v1/me/push-subscribe/route.ts` · `api/prisma/sql/049-push-subscriptions.sql` | M |
| 6 | ویجتِ «مشتریانِ برتر» + مودالِ تاریخچه‌ی مشتری همین باگ را داشتند (`GUESTS`) | 🟡 | `apps/business/js/overview.js` |
| 7 | ✅ **اصلاح شد** — `app/error.tsx` و `app/not-found.tsx` اضافه شدند (برندِ رزرونو، RTL). روت‌هایِ API دست‌نخورده ماندند: خطایشان همچنان از `route.ts` به envelope JSON تبدیل می‌شود، نه از این صفحات. | `api/src/app/error.tsx` · `api/src/app/not-found.tsx` | S |

**تأییدِ زنده:** seed کاملِ موفق روی DBِ خالی · `POST /maintenance/customer-insights` بدونِ کرش · لاگینِ staff + `manager-insights` رویِ همان رستوران · اسکرین‌شاتِ Playwright از داشبوردِ اصلاح‌شده با نام‌هایِ واقعیِ مشتری.

**یافته‌ی جدید ثبت‌شده (رفع‌نشده):** آیتم‌هایِ اعلانِ نمونه در `staff-system.js` و یک بینشِ هاردکد («جمعه شب پرترددترین زمانته») در `renderInsights` — هردو در پنلِ بیزنس، خارج از محدوده‌یِ همین نشست.
