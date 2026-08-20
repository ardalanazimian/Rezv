-- ═══════════════════════════════════════════════════════════════════════
--  اصلاحِ اسکیمای محیطِ تست تا با تولید یکی شود
--
--  ⚠️ یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۰ (از لاگِ کانتینرِ Postgres در CI، نه از خواندنِ کد):
--
--      ERROR: null value in column "id" of relation "economy_ledger_entries"
--             violates not-null constraint
--      STATEMENT: INSERT INTO economy_ledger_entries (user_id, restaurant_id,
--                 kind, amount, reservation_id, source) VALUES (...) RETURNING id
--
--  چرا فقط در تست و نه در تولید:
--    • تولید: جدول‌ها را همین SQLهایِ prisma/sql می‌سازند و آنجا ستون
--      `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` است (۰۳۸-unified-economy).
--    • تست/CI: جدول‌ها را `prisma db push` از schema.prisma می‌سازد، و Prisma
--      برایِ `@default(uuid())` عمداً هیچ defaultِ دیتابیسی نمی‌گذارد — UUID را
--      خودِ کلاینت تولید می‌کند. پس هر INSERTِ خامِ SQL که ستونِ id را نفرستد
--      در محیطِ تست می‌افتد، در حالی که در تولید درست کار می‌کند.
--
--  اثرش چقدر جدی بود: این خطا در lifecycle.ts داخلِ یک `.catch()` بلعیده
--  می‌شد (تا اقتصادِ مشتری هرگز مسیرِ رزرو را نشکند)، پس هیچ تستی قرمز نشد —
--  ولی یعنی کلِ نوشتن‌هایِ دفترِ اقتصاد در CI بی‌صدا شکست می‌خوردند و آن
--  زیرسیستم عملاً بدونِ پوششِ واقعی بود.
--
--  چرا این راه و نه «SQLها را از صفر اجرا کن»: آزمایش شد — `apply-sql.sh`
--  رویِ دیتابیسِ خالی در همان فایلِ ۰۰۱ می‌افتد («The underlying table for
--  model reservations does not exist»)، چون مهاجرت‌ها افزایشی‌اند و فرض
--  می‌کنند اسکیمای پایه از قبل هست. پس `db push` لازم است و شکافش باید
--  اینجا بسته شود.
--
--  دامنه‌ی عمدی و باریک: فقط ستونِ تک‌نامِ `id` از نوعِ uuid که کلیدِ اصلی است
--  و default ندارد. کلیدهایِ ترکیبی (مثلِ customer_insights با
--  restaurant_id+user_id) دست‌نخورده می‌مانند — گذاشتنِ default رویِ آن‌ها
--  می‌توانست یک باگِ واقعی را بپوشاند.
--
--  idempotent است و اجرایِ دوباره‌اش بی‌اثر.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.key_column_usage k
      ON  k.table_schema = c.table_schema
      AND k.table_name   = c.table_name
      AND k.column_name  = c.column_name
    JOIN information_schema.table_constraints t
      ON  t.constraint_name = k.constraint_name
      AND t.table_schema    = k.table_schema
      AND t.constraint_type = 'PRIMARY KEY'
    WHERE c.table_schema   = 'public'
      AND c.column_name    = 'id'
      AND c.data_type      = 'uuid'
      AND c.column_default IS NULL
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT gen_random_uuid()',
      r.table_name, r.column_name);
    RAISE NOTICE 'defaultِ gen_random_uuid() برای %.% اضافه شد', r.table_name, r.column_name;
  END LOOP;
END $$;
