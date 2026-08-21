-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۸ — پرکردنِ کدِ QR برایِ میزهایِ موجود
--
--  ⚠️ باگی که این مهاجرت از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۱):
--
--  قابلیتِ check-inِ QR کاملاً شیپ شده بود ولی برایِ هیچ رستورانِ واقعی کار
--  نمی‌کرد. `assignQrCode()` در `lib/tables.ts` وجود داشت ولی **صفر فراخوان**
--  داشت؛ نه `POST /restaurant/tables` کد را ست می‌کرد نه `PATCH`. تنها جایی
--  که در کلِ پروژه `qr_code` نوشته می‌شد `prisma/seed.ts` بود — داده‌ی
--  `[DEMO]` با الگویِ `T-DEMO…`.
--
--  نتیجه: `POST /api/v1/checkin` که عمومی و بدونِ احراز هویت سرو می‌شود،
--  برایِ هر میزی جز میزهایِ دمو «میز پیدا نشد» می‌داد.
--
--  کدِ اپلیکیشن حالا هنگامِ ساختِ میز کد می‌سازد، ولی آن فقط میزهایِ **جدید**
--  را می‌گیرد. این مهاجرت میزهایی را که از قبل ساخته شده‌اند پر می‌کند تا
--  رستوران‌های موجود مجبور نباشند میزهاشان را دوباره بسازند.
--
--  چرا در SQL و نه یک اسکریپتِ Node: مسیرِ استقرارِ تولید
--  (`docker-entrypoint.sh`) خودش `apply-sql.sh` را اجرا می‌کند، پس این
--  backfill بدونِ هیچ قدمِ دستی روی هر محیطی اعمال می‌شود.
--
--  ── تولیدِ کد ──
--  همان الفبایِ `genQrToken` در `lib/tables.ts`:
--  پیشوندِ `T-` + ۱۰ نویسه از الفبایِ Base32ِ خوانا (بدونِ I/O/0/1 که در چاپ
--  با هم اشتباه می‌شوند). ۱۰ نویسه از ۳۲ = ۵۰ بیت آنتروپی.
--
--  `gen_random_bytes` نیاز به pgcrypto دارد که ممکن است نصب نباشد، پس از
--  `gen_random_uuid()` (درون‌ساختِ Postgres ۱۳+، همان چیزی که کلِ اسکیما
--  برایِ PKها استفاده می‌کند) به‌عنوانِ منبعِ تصادف استفاده می‌شود.
--
--  idempotent است: فقط ردیف‌هایِ `qr_code IS NULL` را دست می‌زند، پس اجرایِ
--  دوباره هیچ کدِ موجودی را عوض نمی‌کند (که یعنی باطل‌کردنِ استیکرِ چاپ‌شده).
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  rec      RECORD;
  candidate text;
  attempt  int;
BEGIN
  -- اگر ستون هنوز نیست (دیتابیسِ بسیار قدیمی)، بی‌صدا رد شو.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tables' AND column_name = 'qr_code'
  ) THEN
    RAISE NOTICE 'ستونِ tables.qr_code وجود ندارد — backfill رد شد';
    RETURN;
  END IF;

  FOR rec IN SELECT id FROM tables WHERE qr_code IS NULL LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;

      -- ۱۰ نویسه‌ی تصادفی از الفبا. هر بار uuid تازه = ۳۲ نویسه‌ی hex،
      -- که برایِ ۱۰ انتخاب بیش از کافی است.
      candidate := 'T-';
      FOR i IN 1..10 LOOP
        candidate := candidate || substr(
          alphabet,
          1 + floor(random() * length(alphabet))::int,
          1
        );
      END LOOP;

      BEGIN
        UPDATE tables SET qr_code = candidate WHERE id = rec.id;
        EXIT;                              -- موفق → برو سراغِ میزِ بعدی
      EXCEPTION WHEN unique_violation THEN
        IF attempt >= 5 THEN
          -- عملاً محال (۵۰ بیت آنتروپی)، ولی حلقه‌ی بی‌پایان بدتر از
          -- یک میزِ بدونِ کد است — روتِ `…/qr` بعداً خودش می‌سازدش.
          RAISE NOTICE 'تولیدِ کدِ یکتا برایِ میز % ناموفق ماند', rec.id;
          EXIT;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;
