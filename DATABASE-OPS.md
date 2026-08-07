# رزرونو — راهنمای عملیات دیتابیس (Pooling · Replica · Backup · Failover)

این سند نتیجه‌ی ممیزی دیتابیس و تست واقعی روی PostgreSQL است (نسخه‌ی محلی/CI: ۱۶).

---

## ۱. Connection Pooling (اجباری برای production)

**مسئله‌ی واقعی (تأییدشده در تست):** Postgres مدیریت‌شده سقف اتصال پایینی دارد —
روی tier تستی Supabase دقیقاً **۶۰ اتصال**. هر instance از API چند connection باز
می‌کند؛ با ۳-۴ instance خیلی زود به سقف می‌خوریم و سرویس با
`too many connections` می‌افتد.

**راه‌حل:** API هرگز مستقیم به Postgres وصل نشود؛ از pooler عبور کند.

```
# .env — primary از طریق pooler (پورت transaction pooling)
DATABASE_URL="postgresql://user:pass@HOST:6543/db?pgbouncer=true&connection_limit=1"

# اتصال مستقیم فقط برای migrate / prisma db push (نه runtime)
DATABASE_DIRECT_URL="postgresql://user:pass@HOST:5432/db"
```

نکات کلیدی:
- `?pgbouncer=true` ⟶ Prisma در حالت transaction pooling، prepared statement
  cache را غیرفعال می‌کند (وگرنه ارور `prepared statement already exists`).
- `connection_limit=1` per instance در serverless/edge توصیه می‌شود؛ در سرور
  دائمی می‌تواند بالاتر باشد (مثلاً ۵-۱۰).
- محاسبه: `(تعداد instance × connection_limit) < max_connections مربوط به pooler`.

با pooler، ظرفیت همزمانی از «۶۰ اتصال مستقیم» به **هزاران اتصال کلاینت** روی
همان ۶۰ اتصال واقعی DB می‌رسد (multiplexing).

---

## ۲. Read Replica Routing

`lib/db.ts` دو client صادر می‌کند:
- `db` → primary (نوشتن، تراکنش، قفل ردیف، و read-after-write)
- `dbRead` → replica (خواندن سنگین: داشبورد، آنالیتیکس، گزارش، لیست)

```
# .env — اگر replica داری (در نبودش، dbRead خودکار به primary برمی‌گردد)
DATABASE_REPLICA_URL="postgresql://user:pass@REPLICA_HOST:6543/db?pgbouncer=true"
```

اندپوینت‌هایی که الان به replica مسیر داده شده‌اند (همه تأییداً write-free):
`GET /restaurants` · `restaurant/analytics` · `restaurant/reports` ·
`restaurant/ai` · `restaurant/customers` · `restaurant/customers/[userId]` ·
`admin/overview`.

⚠️ **Replication lag:** replica چند ده میلی‌ثانیه عقب است. هر جا «بعد از نوشتن
فوراً همان را بخوان» داریم، از `db` (نه `dbRead`) استفاده می‌کنیم تا داده‌ی
قدیمی برنگردد. به همین دلیل مسیر ثبت رزرو و پنل‌های تراکنشی روی primary ماندند.

---

## ۳. جلوگیری از رزرو تکراری و Race Condition (تأییدشده روی DB واقعی)

سه لایه، که **لایه‌ی سوم تضمین قطعی** است:
1. قفل Redis روی اسلات (بهینه‌سازی؛ فشار retry را کم می‌کند).
2. تراکنش `Serializable` + بازچک availability داخل tx.
3. **EXCLUDE constraint روی `tsrange(slot_start, block_end)`** — تست شد که
   حتی اگر لایه‌های ۱ و ۲ دور زده شوند، دو رزرو هم‌پوشان روی یک میز در سطح
   دیتابیس **رد می‌شوند** (شامل زمان نظافت). این منبع حقیقت است.

قفل‌های دیگری که در این ممیزی اضافه/اصلاح شدند:
- **کارت هدیه:** `SELECT ... FOR UPDATE` (قفل بدبینانه) تا double-spend همزمان
  ممکن نباشد — تست شد که استفاده‌ی دوم همزمان رد می‌شود.
- **لیست انتظار (decline/leave):** گارد status داخل `updateMany` (نه چک بیرونی)
  تا میز دوبار آزاد/promote نشود.
- **امتیاز:** الگوی append-only ledger (ذاتاً امن)، حالا insert+sum در یک تراکنش.

---

## ۴. Optimistic vs Pessimistic Locking — کجا کدام؟

| مسیر | استراتژی | چرا |
|---|---|---|
| رزرو میز | EXCLUDE constraint + Serializable | تداخل بازه‌ای؛ constraint طبیعی‌ترین ابزار است |
| کارت هدیه | Pessimistic (`FOR UPDATE`) | پول؛ باید contention را serialize کند، نه retry |
| لیست انتظار | Guarded `updateMany` (شرط در WHERE) | transition ساده‌ی status؛ سبک‌تر از قفل |
| امتیاز | Append-only ledger | بدون update روی مجموع ⟶ lost-update غیرممکن |
| CustomerInsight/StaffPermission | `@updatedAt` موجود | upsert idempotent؛ آخرین نوشته برنده |

برای جداول شمارنده‌ای که در آینده ممکن است read-modify-write شوند (مثلاً
موجودی‌های جدید)، الگوی توصیه‌شده: ستون `version Int @default(0)` و
`UPDATE ... WHERE id=? AND version=?` که در تست نشان داد نوشتن stale صفر ردیف
می‌گیرد (و باید retry شود).

---

## ۵. Backup Strategy

سرویس `backup` در docker-compose (شبانه، non-root) مسئول این است:

- **pg_dump فشرده‌ی روزانه** با نگه‌داری چرخشی (`BACKUP_KEEP` روز).
- مقصد: حجم محلی + (در صورت تنظیم) آپلود به S3 (`S3_*`).
- **زمان‌بندی:** `BACKUP_CRON` (پیش‌فرض شبانه ساعت کم‌ترافیک).

توصیه‌های production فراتر از dump روزانه:
1. **PITR (Point-in-Time Recovery):** WAL archiving را فعال کن تا بتوانی به هر
   لحظه‌ی دلخواه (نه فقط snapshot شبانه) برگردی. روی Postgres مدیریت‌شده معمولاً
   یک گزینه‌ی فعال‌کردنی است (Supabase/RDS).
2. **تست بازیابی:** ماهانه یک restore واقعی روی محیط staging انجام بده —
   backupی که restoreش تست نشده، backup نیست.
3. **جداسازی جغرافیایی:** نسخه‌ی backup در منطقه‌ای غیر از primary نگه‌داری شود.
4. **رمزنگاری:** dumpها در S3 با SSE رمز شوند؛ کلید جدا از داده.

---

## ۶. Failover Strategy

**هدف:** اگر primary بیفتد، سرویس با حداقل وقفه ادامه دهد.

لایه‌ها:
1. **Health check:** اندپوینت `/api/v1/health` وضعیت اتصال DB را برمی‌گرداند؛
   load balancer/orchestrator instanceهای ناسالم را از چرخه خارج کند.
2. **Graceful shutdown:** `lib/db.ts` روی SIGTERM هر دو client را تمیز می‌بندد،
   پس در rolling deploy/failover درخواست‌های در حال اجرا قطع نمی‌شوند.
3. **Replica promotion:** اگر primary بیفتد، replica به primary ارتقا یابد
   (روی Postgres مدیریت‌شده معمولاً خودکار است؛ روی self-hosted با
   Patroni/repmgr). پس از promotion، `DATABASE_URL` به endpoint جدید اشاره کند.
4. **Connection retry:** Prisma خطای اتصال گذرا را گزارش می‌دهد؛ لایه‌ی
   orchestration باید instance را restart یا traffic را منحرف کند.
5. **RTO/RPO هدف:** با replica + WAL، RPO نزدیک صفر (تا لحظه‌ی آخر WAL) و RTO
   چند دقیقه (زمان promotion + DNS/endpoint switch).

⚠️ نکته‌ی مهم: failover کامل خودکار نیاز به زیرساخت ارکستریشن دارد که خارج از
کد اپ است (DB managed service یا Patroni). کد اپ تا جای ممکن آماده است
(graceful shutdown، replica routing، health check)، اما promotion و
endpoint-switch را زیرساخت باید انجام دهد.

---

## ۷. تشخیصِ drift بینِ schema.prisma و SQLِ واقعاً اعمال‌شده (یافته‌ی ۲۰۲۶-۰۸-۰۷)

چون این پروژه از `prisma migrate deploy` استفاده نمی‌کند (به‌جایش `prisma/apply-sql.sh`
روی `prisma/sql/*.sql` — رجوع کن به بخشِ استقرار)، یک ریسکِ واقعی هست: فیلدی در
`schema.prisma` تعریف شود ولی هیچ فایلِ SQL آن را واقعاً نسازد — روی محیطی که فقط
از `apply-sql.sh` ساخته شده (نه از `prisma db push`)، اولین `db.model.create(...)`ِ
بدونِ `select` صریح با `P2022` («column does not exist») می‌شکند. دو نمونه‌ی واقعی
پیدا شد: `tenants.version` (035) و ۷ ستونِ `restaurants` + `users.email` (036).

**روشِ تشخیص که در تستِ end-to-end این نشست کار کرد:**
```bash
cd api
export DATABASE_URL="..."   # باید در همان فراخوانی export شود؛ .env به‌تنهایی کافی نیست
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```
⚠️ خروجیِ این دستور را کورکورانه اعمال نکن — علاوه بر `ADD COLUMN`/`CREATE TABLE`ِ
واقعی، تغییراتِ کازمتیکِ «Prisma-canonical» هم پیشنهاد می‌دهد (مثلاً تبدیلِ
`timestamptz`→`timestamp(3)`، حذفِ `DEFAULT gen_random_uuid()`) که اگر واقعاً اجرا
شوند **مخرب**اند. فقط `ADD COLUMN IF NOT EXISTS`/`CREATE ... IF NOT EXISTS`هایِ
واقعی را به یک فایلِ جدیدِ `prisma/sql/0NN-*.sql` منتقل کن.

## ۸. گوچایِ BigInt در کوئری‌هایِ خام (یافته‌ی ۲۰۲۶-۰۸-۰۷)

`SUM(...) OVER (...)`، `COUNT(*)`، و مشابه در Postgres مقدارِ `bigint` برمی‌گردانند.
Prisma این را به **`BigInt` جاوااسکریپت** نگاشت می‌کند، نه `number` — حتی اگر
جنریکِ TypeScriptِ `$queryRaw<T>()` بگوید `number` (این فقط یک type assertion است،
نه تضمینِ runtime؛ تایپ‌چک این «دروغ» را نمی‌بیند). ترکیبِ `BigInt` با `number` در
عملگرهایی مثلِ `*`/`+` با خطایِ `TypeError: Cannot mix BigInt and other types` کرش
می‌کند — دقیقاً همین در `lib/no-show-model.ts` برایِ هر رستورانی با مشتریِ تکراری
رخ می‌داد (فقط با اجرایِ واقعی روی Postgres پیدا شد، نه با فرض).

**الگویِ رفعِ دولایه (همیشه هردو، نه فقط یکی):**
1. cast صریح در SQL: `SUM(...)::int` یا `::bigint`.
2. تبدیلِ دفاعیِ جاوااسکریپت: `Number(row.some_agg_field)` قبلِ هر محاسبه‌ای.

## ۹. خلاصه‌ی ممیزی ایندکس و کوئری

- همه‌ی foreign keyها روی ستون‌های join شده ایندکس دارند.
- ایندکس‌های ترکیبی با ترتیب درست (برابری قبل از range/sort): مثل
  `(restaurant_id, status, slot_start)` و `(restaurant_id, segment, predicted_clv DESC)`.
- ایندکس‌های partial برای کوئری‌های داغ: هولدهای منقضی، رزروهای فعال، GiST آفر.
- N+1 رفع‌شده: گزارش درآمد و امتیاز اعضا با groupBy یک‌مرحله‌ای (نه حلقه).
- کوئری‌های تجمیعی سنگین با `$queryRaw` و cache (TTL ۶۰–۶۰۰ ثانیه) + replica.
