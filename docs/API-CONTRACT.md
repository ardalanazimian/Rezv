# رزرونو — قرارداد API (API Contract)

**نسخه:** v1 · **پایه:** `/api/v1` · **تولیدشده از کدِ واقعی**

این سند برای تیمِ آینده (اپ موبایل، اینتگریشن‌ها) ست. هدف: هر کلاینتی بتواند بدون بازنویسیِ منطق، با موتور رزرو کار کند. همه‌ی endpointها منطق‌شان در لایه‌ی سرویس (`lib/`) است و از طریق همین APIها در دسترس‌اند.

---

## احراز هویت

- **روش:** JWT. توکن در هدر `Authorization: Bearer <access_token>`.
- **دو نوع کاربر:** مشتری (customer) و پرسنل (staff/restaurant). هر کدام توکنِ خودش.
- **چرخه:** `access_token` کوتاه‌عمر + `refresh_token`. با `/auth/refresh` تمدید کن.
- **امنیت:** بک‌اند خودش permission را چک می‌کند (نه فقط دیتابیس). هر نقشِ پرسنل، مجوزهای مشخص دارد.

### Rate Limits (واقعی)
| عملیات | سقف |
|--------|-----|
| درخواست OTP (per phone) | ۳ در ۱۰ دقیقه |
| درخواست OTP (per IP) | ۱۵ در ۱۰ دقیقه |
| تأیید OTP | ۸ در ۱۰ دقیقه |
| ساخت رزرو | ۱۰ در دقیقه |
| جستجو | ۶۰ در دقیقه |
| عمومی | ۱۲۰ در دقیقه |

---

## ۱. احراز هویت (Auth)

### `POST /auth/otp/request` — درخواست کد ورود (مشتری)
- **بدنه:** `{ "phone": "09..." }`
- **پاسخ:** `204` (کد پیامک شد) یا `200 { "devCode": "1234" }` (در حالت توسعه).

### `POST /auth/otp/verify` — تأیید کد و ورود
- **بدنه:** `{ "phone": "09...", "code": "1234" }`
- **پاسخ:** `{ "access_token", "refresh_token", "user": {...} }`

### `POST /auth/staff/request` و `POST /auth/staff/verify` — ورود پرسنل
- مثل بالا، ولی برای پنل رستوران.

### `POST /auth/refresh` — تمدید توکن
- **بدنه:** `{ "refresh_token": "..." }` → `{ "access_token", "refresh_token" }`

### `POST /auth/logout` — خروج

---

## ۲. کشف رستوران (عمومی — برای اپ موبایل مشتری)

### `GET /restaurants` — لیست رستوران‌های فعال
- فقط رستوران‌های باز و آنلاین را برمی‌گرداند (رستوران‌های آفلاین خودکار پنهان می‌شوند).
- **پاسخ:** آرایه‌ای از `{ id, slug, name, cuisine, rating, price, ... }`

### `GET /restaurants/[slug]/availability` — سانس‌های خالی
- **کوئری:** `?date=YYYY-MM-DD&party=2`
- **پاسخ:** `{ date, party, slots: [{ time, free_tables, status }] }`
- ⚡ کش‌شده (SWR): تا ۳۰s تازه، تا ۵ دقیقه stale-while-revalidate.

---

## ۳. رزرو (Reservation — قلبِ سیستم)

### `POST /reservations` — ساخت رزرو ⭐
- **نیازمند:** احراز هویتِ مشتری.
- **هدرِ مهم:** `Idempotency-Key: <uuid>` — از double-submit جلوگیری می‌کند (اگر کاربر دوبار بزند، رزروِ تکراری ساخته نمی‌شود). **اپ موبایل حتماً این را بفرستد.**
- **بدنه:** `{ "restaurant_id", "date": "YYYY-MM-DD", "time": "HH:mm", "party_size": 2, "notifySms": true }`
- **پاسخ:** `201 { reservation: { code, status, slot_start, ... } }`
- 🛡️ **تضمین ضد double-booking:** سه لایه (Serializable transaction + بازچک + EXCLUDE constraint سطح DB). اگر میز همان لحظه پر شود، `409` برمی‌گرداند.

### `GET /reservations/[code]` — جزئیات یک رزرو
### `POST /reservations/[code]/cancel` — لغو رزرو
### `POST /reservations/[code]/arrive` — اعلام حضور
### `GET /me/reservations` — رزروهای من (تاریخچه)

---

## ۴. لیست انتظار (Waitlist)

### `POST /waitlist` — پیوستن به لیست انتظار
- **بدنه:** `{ "restaurant_id", "party_size", "notify_sms": true, "notify_push": true }`
### `GET /waitlist/[id]` — وضعیت من در صف
### `POST /waitlist/[id]/accept` — پذیرش میزِ پیشنهادی
### `POST /waitlist/[id]/decline` — رد میز
### `DELETE /waitlist/[id]` — خروج از صف

---

## ۵. پروفایل و وفاداری (مشتری)

### `GET /me` · `PATCH /me` — پروفایل من (خواندن/ویرایش)
### `GET /me/profile` — پروفایل کامل + آمار (برای DNA غذایی)
- برمی‌گرداند: `globalVisits, restaurantsVisited, globalSpendToman, isVipAnywhere, rfmSegment`
### `GET /me/points` — امتیازهای وفاداری
### `GET /me/referral` · `POST /me/referral` — کد دعوت
### `GET /gift-cards` · `POST /gift-cards` — کارت هدیه
### `POST /checkin` — چک‌این

---

## ۶. پنل رستوران (پرسنل — نیازمند مجوز)

مدیریت رزرو: `GET /restaurant/reservations` · `PATCH /restaurant/reservations/[code]/status` · `POST /restaurant/walkin` (ثبت مهمانِ بدون رزرو) · `POST /restaurant/heartbeat` (سیگنالِ آنلاین‌بودن، هر ۳۰s).

مدیریت میز: `GET/POST /restaurant/tables` · `PATCH/DELETE /restaurant/tables/[id]` · `PATCH /restaurant/tables/[id]/state`.

مشتریان و CRM: `GET /restaurant/customers` · `GET /restaurant/customers/[userId]` · `GET /restaurant/rfm` · `GET /restaurant/members`.

بازاریابی: `GET/POST /restaurant/coupons` · `GET /restaurant/campaigns` · `GET/POST /restaurant/automations` · `GET/PATCH /restaurant/cashback`.

تحلیل: `GET /restaurant/analytics` · `GET /restaurant/reports` · `GET /restaurant/ai` · `GET /restaurant/fraud-signals` · `GET /restaurant/waitlist/analytics`.

محتوا: `GET/POST/DELETE /restaurant/photos` · `GET/POST/PATCH/DELETE /restaurant/notes` · `GET/PATCH /restaurant/reviews`.

---

## ۷. ادمین (سطح پلتفرم)

`GET /admin/overview` · `GET /admin/business-intelligence` · `GET /admin/system-health` · `GET /admin/security` · `GET /admin/restaurants` · `PATCH /admin/restaurants/[id]/control` · `GET/POST /admin/restaurants/[id]/sms`.

---

## ۸. نگه‌داری (Cron — فقط با CRON_SECRET)

این endpointها توسط Vercel Cron صدا زده می‌شوند (نه کلاینت): `jobs-drain` (هر دقیقه، صفِ کار)، `waitlist`، `expire`، `lifecycle`، `customer-insights`، `retention`، `rewards`، `ensure-partitions`. هر دو متد GET و POST را می‌پذیرند.

---

## قراردادهای کلی

- **فرمت خطا:** `{ "ok": false, "error": { "code": "...", "message": "..." } }`
- **کدهای مهم:** `401` (احراز هویت لازم)، `403` (بدون مجوز)، `409` (تداخل — مثلاً میز پر شد)، `422` (رستوران آفلاین)، `429` (rate limit).
- **زمان‌ها:** UTC ذخیره، با timezone رستوران (`Asia/Tehran`) تفسیر می‌شوند.
- **تراکنش‌های حساس:** همیشه `Idempotency-Key` بفرست.

---

## برای تیمِ اپ موبایل — نکته‌ی معماری

منطقِ رزرو کاملاً در بک‌اند و مستقل از وب است. **اپ موبایل نباید هیچ منطقِ رزرو، محاسبه‌ی availability، یا قانونِ double-booking را دوباره پیاده کند** — همه از طریق همین APIها در دسترس است. اپ موبایل فقط UI است که این endpointها را صدا می‌زند. این تضمین می‌کند که وب و موبایل همیشه رفتارِ یکسان دارند.
