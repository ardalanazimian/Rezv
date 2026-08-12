# رزرونو — رفعِ باگ‌های حسابرسی (نشستِ ۲، ۲۰۲۶-۰۷-۱۹)

مبنا: حسابرسیِ zero-trust روی نسخه‌ی آپلودشده (`rezervno-full-app-updated.zip`)، مقایسه با
وضعیت مطلوب. این نسخه اکثرِ فیکس‌ها را داشت ولی ۴ مورد کم/برگشته بود که اینجا رفع شد.

## رفع‌شده

### ۱. تایم‌زون — هاردکدِ `+03:30` (بحرانی)
- `api/src/lib/hours.ts`: تابعِ `zonedTimeToUtc()` اضافه شد (Intl.DateTimeFormat، DST-safe).
- `api/src/lib/reservation-helpers.ts`: `computeRanges` حالا پارامترِ `timezone` می‌گیرد و از `zonedTimeToUtc` استفاده می‌کند.
- `api/src/lib/reservations.ts`: caller حالا `r.timezone` را پاس می‌دهد.
- `api/src/lib/availability.ts`: هر دو جایِ محاسبه‌ی instant (dayStart + هر اسلات) به `zonedTimeToUtc` منتقل شد.
- تست‌شده: Tehran 19:00→15:30Z, Dubai 19:00→15:00Z, NY-summer 19:00→23:00Z ✅

### ۲. OTP frontend — `maxlength="4"` در حالی که بک‌اند ۶رقمی می‌سازد (بحرانی — ورودِ واقعی ناممکن)
- `apps/customer/js/auth.js`, `apps/business/js/staff-system.js`, `apps/company/js/intelligence.js`:
  `maxlength="4"`→`"6"`، regex `/^\d{4}$/`→`/^\d{4,6}$/`، متنِ «کد ۴ رقمی»→«کد ورود».

### ۳. `ALLOWED_ORIGINS` بدونِ fail-fast در production (امنیتی)
- `api/middleware.ts` (مسیرِ فعلی: `api/src/middleware.ts`): اگر `NODE_ENV=production` و `ALLOWED_ORIGINS` خالی باشد، اپ بالا نمی‌آید
  (هم‌راستا با fail-fastِ `JWT_SECRET`). وگرنه چکِ CSRF/Origin بی‌صدا خاموش می‌شد.

### ۴. RLS روی جدول‌های جدید در migrationها (امنیتی/DR)
- `api/prisma/migrations/manual/023-rls-new-tables.sql` اضافه شد (مسیرِ فعلی: `api/prisma/sql/023-rls-new-tables.sql` — همان فایل، فقط پوشه‌ی `manual/` بعداً به `prisma/sql/` منتقل شد، رجوع کن به `docs/KNOWN_LIMITATIONS.md`): RLS روی
  `payments`, `platform_settings`, `restaurant_closures`. (DB زنده از قبل داشت — تأییدشده ۳۵/۳۵ جدول با RLS؛
  این فایل فقط مسیرِ بازسازیِ DB از migration را درست می‌کند.)

### ۵. favicon و sitemap (نمایش/برندینگ)
- `apps/{customer,business,company}/favicon.svg` ساخته و در `index.html` لینک شد (هر کدام با گرادیانِ برندِ خودش).
- `apps/customer/sitemap.xml` (صادقانه: تک‌URL، چون SPA است) + ارجاع در `robots.txt`.

## تأییدِ نهایی
- سینتکسِ همه‌ی JS (۳ اپ) ✅ · توازنِ brace همه‌ی TS + schema ✅ · JSON/YAML همه معتبر ✅
- بدونِ فایلِ رفرنس‌شده‌ی گمشده در HTML ✅ · migrationها ۰۰۱–۰۲۳ متوالی ✅
- DB زنده: ۳۵ جدول، ۳۵ RLS، ۰ policy، `block_buffer_minutes` و `restaurant_closures` موجود ✅
