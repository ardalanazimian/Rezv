# API پنل شرکت (Company Panel) — endpointهای جدید

پنل company حالا با همه‌ی فیچرهای جدید همخوان شد. این endpointها داده‌ی
سطح-پلتفرم (همه‌ی رستوران‌ها) را برای CEO/تیم جمع می‌کنند. همه نیاز به
احراز هویت admin دارند (`adminAuthFromRequest` + role='owner').

## ورود مدیر پلتفرم

### `POST /api/v1/auth/admin/request`
Body: `{ "phone": "09123456789" }`. فقط شماره‌ی فعالِ `owner` در
`PLATFORM_ADMIN_TENANT_ID` پذیرفته می‌شود. در حالت production کد از طریق SMS
ارسال می‌شود؛ `OTP_DEV_MODE` فقط برای development است.

### `POST /api/v1/auth/admin/verify`
Body: `{ "phone": "09123456789", "code": "123456" }`. پاسخ شامل `access` و
`refresh` است و access token برای endpointهای admin پنل شرکت معتبر است.

## دیدن (Read)

### `GET /api/v1/admin/overview` (ارتقایافته)
داشبورد اصلی. حالا علاوه بر شمارش پایه، KPIهای جدید:
- `platform_clv_toman` — CLV کل همه‌ی مهمانان (از GuestProfile سراسری)
- `total_vips`, `total_guests` — تعداد VIP و کل مهمانان پلتفرم
- `active_restaurants` — رستوران‌های فعال
- `system_health` — healthy/warning/critical (بر اساس صف Job)

### `GET /api/v1/admin/system-health` (جدید)
سلامت زیرساخت: وضعیت صف Job (pending/processing/failed/dead)، webhookهای
فعال، اقدامات ناموفق ۲۴ساعت، تشخیص گیرکردن صف، و لیست jobهای dead.

### `GET /api/v1/admin/business-intelligence` (جدید)
هوش تجاری سطح پلتفرم: CLV/VIP کل، توزیع سگمنت RFM، سگمنت‌های رفتاری،
و رستوران‌های برتر بر اساس ارزش مشتریانشان (CLV).

### `GET /api/v1/admin/security` (جدید)
سیگنال‌های امنیتی سطح پلتفرم: fraud (چند حساب از یک IP)، مشتریان پرریسک
no-show، اقدامات ناموفق اخیر، و رویدادهای حساس audit — همه بین رستوران‌ها.

## کنترل (Write)

### `PATCH /api/v1/admin/restaurants/[id]/control` (جدید)
کنترل رستوران توسط پلتفرم:
- `{ action: 'activate' }` — فعال کردن رستوران
- `{ action: 'deactivate' }` — غیرفعال کردن (is_open=false)
- `{ action: 'set_plan', plan: 'free'|'pro'|'enterprise' }` — تغییر پلن tenant

همه‌ی عملیات کنترلی در audit_logs ثبت می‌شوند (actor، target، detail، IP)
— برای انطباق و ردیابی.

---

## وضعیت اعتبارسنجی
- typecheck، lint و تست‌های واحد backend سبز هستند.
- Prisma schema با یک datasource placeholder معتبر است.
- اجرای واقعی روی PostgreSQL/Supabase و تست rollback نیازمند `DATABASE_URL` واقعی است.

## وضعیت فرانت‌اند
پنل `apps/company/index.html` به endpointهای overview، system-health، BI، security
و control متصل است. اجرای end-to-end با API واقعی هنوز نیازمند environment کامل
و اجرای Playwright است.
