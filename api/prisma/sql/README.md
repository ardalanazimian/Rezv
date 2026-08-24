# Migrationهای دستی — رزرونو

## چه زمانی این‌ها را اجرا کنم؟

**راه‌اندازی جدید (دیتابیس خالی):** هیچ کاری لازم نیست.
`prisma db push` در entrypoint، همه‌ی ایندکس‌های schema را خودکار می‌سازد.

**دیتابیس موجود با داده‌ی زیاد (production):** این فایل‌ها برای تو هستند.

---

## `001-performance-indexes.sql`

ایندکس‌های بهینه برای مقیاس ۱۰M+ رزرو، با `CREATE INDEX CONCURRENTLY`
تا جدول قفل نشود (نوشتن/خواندن در حین ساخت ادامه دارد).

```bash
# ⚠️ CONCURRENTLY نباید داخل transaction باشد — مستقیم با psql اجرا کن:
psql "$DATABASE_URL" -f 001-performance-indexes.sql

# یا داخل کانتینر:
docker compose exec -T postgres psql -U rezervno rezervno < 001-performance-indexes.sql
```

همه‌ی ایندکس‌ها `IF NOT EXISTS` دارند (اجرای مجدد امن است) و **هیچ داده‌ای حذف نمی‌شود**.

---

## `002-partitioning-guide.sql`

راهنمای پارتیشن‌بندی جدول reservations برای وقتی که به چند میلیون ردیف رسیدی
و کوئری‌های بازه‌ای کند شدند. **اجرای فوری لازم نیست** — تا آن مقیاس، ایندکس‌های
فایل ۰۰۱ کافی‌اند. این فایل الگو و مراحل امن مهاجرت را توضیح می‌دهد.

---

## `003-table-redesign.sql`

بازطراحی کامل مدیریت میز: شکل، ناحیه، VIP، وضعیت (نظافت/اشغال/تعمیر)، QR، اولویت.
ستون `min_capacity` با **RENAME** به `min_party_size` تبدیل می‌شود (داده حفظ می‌شود).
همه‌ی ستون‌های جدید پیش‌فرض امن دارند. روی دیتابیس موجود اجرا کن:

```bash
psql "$DATABASE_URL" -f 003-table-redesign.sql
```

---

## `004-lifecycle-events.sql`

گسترش چرخه‌ی حیات رزرو: ۱۵ وضعیت کامل + جدول audit log (reservation_events).
وضعیت‌های قدیمی حفظ می‌شوند. enum با ADD VALUE IF NOT EXISTS گسترش می‌یابد.

```bash
psql "$DATABASE_URL" -f 004-lifecycle-events.sql
```

---

## `005-waitlist.sql`

سیستم لیست انتظار (Waitlist) مدل OpenTable: جدول waitlist_entries + enum waitlist_status.
صف اولویت، تخصیص خودکار میز، آفر با تایمر انقضا. هیچ داده‌ای حذف نمی‌شود.

```bash
psql "$DATABASE_URL" -f 005-waitlist.sql
```

---

## `006-loyalty.sql`

وفاداری: امتیاز (points_ledger)، دعوت (referrals)، کارت هدیه (gift_cards)، رویداد ویژه (special_events) + فیلدهای anniversary_date/referral_code در users. هیچ داده‌ای حذف نمی‌شود.

```bash
psql "$DATABASE_URL" -f 006-loyalty.sql
```

---

## `018` تا `022` — بازسازی‌شده / جدید (۲۰۲۶-۰۷-۱۹)

فایل‌های `018-staff-branch-scoping.sql` تا `021-restaurant-closures.sql` **بازسازی‌شده‌اند**:
این تغییرات از قبل روی DB زنده (`zmyuvtpbchytqvtgyewt`) اعمال شده بودند ولی فایلِ migration
برایشان هیچ‌وقت کامیت نشده بود — یک drift واقعی که در حسابرسیِ zero-trust دیتابیس
(`docs/PROJECT-AUDIT-HANDOFF-DATABASE.md` بخش ۲) کشف شد. شماره‌گذاریِ دقیقِ تاریخی
(کدام یکی واقعاً migration ۰۱۸ بوده در برابر ۰۱۹) از گیت قابلِ‌بازیابی نبود؛ این فایل‌ها بر
اساسِ دیفِ `schema.prisma` بازسازی شدند و به‌ترتیبِ منطقی شماره خوردند. همه idempotent‌اند
(`IF NOT EXISTS`/`DO $$ ... EXCEPTION`) — اجرای دوباره روی DB زنده هم بی‌خطر است.

`022-audit-fixes-2026-07-19.sql` **جدید** است (هنوز چیزی روی DB زنده اعمال نشده بود قبل از
این نشست) و شاملِ سه فیکسِ واقعی از همان حسابرسی است: rename ستونِ mixed-case
`coupons.targetSegment`، افزودنِ ۴ Foreign Key گمشده (`webhooks`, `sms_transactions`,
`guest_profiles`, `restaurant_closures`)، و حذفِ دو ایندکسِ تکراری. **این فایل روی DB زنده
اعمال و تک‌تکِ تغییراتش تأیید شد** — رجوع کن به `docs/PROJECT-AUDIT-HANDOFF-DATABASE.md`.

```bash
# روی هر DB جدید (یا برای تطبیق‌دادنِ یک DB قدیمی‌تر):
psql "$DATABASE_URL" -f 018-staff-branch-scoping.sql
psql "$DATABASE_URL" -f 019-payments-deposit.sql
psql "$DATABASE_URL" -f 020-platform-settings-payment-toggle.sql
psql "$DATABASE_URL" -f 021-restaurant-closures.sql
psql "$DATABASE_URL" -f 022-audit-fixes-2026-07-19.sql
```

---

## نکته‌ی مهم درباره‌ی constraint جلوگیری از تداخل

فایل `026-consolidate-exclusion-constraint.sql` شامل EXCLUDE constraint و
generated column (`block_end`) است که برای جلوگیری از double-booking حیاتی است.
این فایل canonical و idempotent است و توسط `../apply-sql.sh` بعد از
`prisma migrate deploy` خودکار اعمال می‌شود (در entrypoint). پیش‌تر این تعریف در
`0_init/EXTRA-after-prisma-migrate.sql` بود که حذف شده و جایش را 026 گرفته است.
