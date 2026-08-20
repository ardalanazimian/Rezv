# ترتیب اجرای Migration — رزرونو

## ⚠️ ترتیب دقیق (تست‌شده روی PostgreSQL 17 واقعی)

برای راه‌اندازی یک دیتابیس خالی، به‌ترتیب:

### ۱. migration پایه (همه‌ی جداول)
```bash
psql "$DATABASE_URL" -f 0_init/migration.sql
```
۲۷ جدول + ۱۲ enum + ۴۹ ایندکس + ۲۵ کلید خارجی می‌سازد.
**تأییدشده:** کل این فایل روی Supabase واقعی بدون خطا اجرا شد.

### ۲. اسکریپت‌های SQL افزایشی + constraintِ EXCLUDE
```bash
sh ../apply-sql.sh   # همه‌ی prisma/sql/*.sql را به‌ترتیب اعمال می‌کند
```
`apply-sql.sh` هر فایلِ `prisma/sql/*.sql` را با `prisma db execute` (نه `psql`)
اعمال می‌کند و فایل‌های `-- @manual-only` (راهنماها) را رد می‌کند. این شامل
`026-consolidate-exclusion-constraint.sql` است که ستون محاسبه‌شده‌ی `block_end`
و EXCLUDE constraint `no_table_overlap` را می‌سازد — همان لایه‌ی «منبع حقیقت»
جلوگیری از تداخل رزرو (Redis lock فقط بهینه‌سازی).

این فایل‌ها `IF NOT EXISTS` دارند، پس امن‌اند و با جداول پایه تداخل نمی‌کنند.
شامل: lifecycle events، waitlist، loyalty، customer-intelligence، audit،
jobs queue، enterprise (idempotency/webhooks)، CRM (RFM/GuestProfile)،
و رفع‌های همزمانی پول (013).

---

## چرا این ترتیب مهم است

- **migration پایه قبلاً وجود نداشت** — این بزرگ‌ترین تله‌ی deploy بود: بدون آن
  `prisma migrate deploy` هیچ جدولی نمی‌ساخت و migrationهای دستی (که به
  `reservations`، `coupons` و... ارجاع می‌دهند) با خطا fail می‌شدند.
- **026 باید بعد از base و قبل از داده اجرا شود** — چون ستون generated و
  EXCLUDE constraint روی جدول `reservations` ساخته‌شده در base تکیه دارند.
- **CREATE EXTENSION btree_gist** در 026 است و باید پیش از EXCLUDE اجرا شود.

## جایگزین: Prisma migrate

اگر از Prisma migrate استفاده می‌کنی:
```bash
npx prisma migrate deploy   # 0_init/migration.sql را اجرا می‌کند
sh ../apply-sql.sh          # سپس prisma/sql/*.sql (شاملِ 026)
```

---

## تأیید سازگاری با base (تست‌شده روی PostgreSQL واقعی)

پس از ساخت migration پایه، همه‌ی migrationهای دستی بررسی و تست شدند:

- **001** بازنویسی شد: اکثر ایندکس‌هایش به base منتقل شده بودند (تکراری). حالا فقط
  یک partial index بهینه (برای پاک‌سازی هولد) + ANALYZE دارد.
- **003–013** همگی idempotent‌اند و با base تداخل ندارند:
  - enumها با `DO $$ ... EXCEPTION WHEN duplicate_object` (امن برای enum)
  - جداول با `CREATE TABLE IF NOT EXISTS`
  - ستون‌ها با `ADD COLUMN IF NOT EXISTS`
  - RENAMEها با گارد `IF EXISTS` (روی base که نام جدید را دارد، skip می‌شوند)
- **توالی کامل (base → manualها) روی Supabase واقعی تست شد** — همه‌ی ALTERها
  no-op شدند (چون ستون‌ها از base موجودند)، صفر خطا.

**نتیجه:** اجرای base سپس manualها امن است — هیچ تداخل یا خطای «relation exists».
