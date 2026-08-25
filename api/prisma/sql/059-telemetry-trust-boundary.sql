-- ═══════════════════════════════════════════════════════════════════════
-- 046 — مرزِ اعتمادِ تله‌متری (فازِ ۲ · پروتکل §۱۴ و §۱۵)
--
-- سه ستونِ کاملاً افزایشی روی platform_events. هیچ ستونی حذف/تغییرِ نوع
-- نمی‌دهد و هیچ ردیفِ موجودی نامعتبر نمی‌شود.
--
-- زمینه‌ی مهم (اندازه‌گیری‌شده، نه فرض): امروز **هیچ کدی platform_events را
-- نمی‌خواند** — نه route، نه cron، نه SQLِ خام. مدل‌هایِ ML از `reservations`
-- و `customer_insights` آموزش می‌بینند. پس این migration **پیشگیرانه** است،
-- نه رفعِ یک نشتِ فعال: §۱۵ می‌گوید دیتاستِ آموزشیِ آینده باید بتواند
-- SERVER_VERIFIED را از ANONYMOUS_CLIENT تفکیک کند، و این تفکیک باید از
-- لحظه‌ی درج ثبت شود چون بعداً قابلِ بازسازی نیست.
--
--  ۱. event_id        — شناسه‌ی ارسالیِ کلاینت (namespace‌شده در سرور) برایِ dedup
--  ۲. trust_level     — سطحِ اعتمادِ منبع (فقط سرور می‌نویسد)
--  ۳. server_received_at — لحظه‌ی رسیدن به سرور، جدا از occurred_at و ingested_at
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE platform_events
  ADD COLUMN IF NOT EXISTS event_id text;

-- ⚠️ ایندکسِ **جزئی**: فقط ردیف‌هایی که event_id دارند یکتا می‌شوند.
-- همه‌ی ردیف‌هایِ تاریخی و همه‌ی رویدادهایِ سروری (که event_id ندارند و
-- ذاتاً یکتا هستند) با NULL معتبر می‌مانند — پس این migration روی دیتابیسِ
-- پر هم بی‌خطر است.
CREATE UNIQUE INDEX IF NOT EXISTS platform_events_event_id_uniq
  ON platform_events (event_id) WHERE event_id IS NOT NULL;

-- سطحِ اعتماد. پیش‌فرضِ عمدی 'ANONYMOUS_CLIENT' است، نه چیزی معتمدتر:
-- اگر مسیری در آینده فراموش کند مقدار بدهد، نتیجه باید **کم‌اعتمادترین**
-- حالت باشد (fail-closed)، نه اینکه دادهٔ نامعتبر به‌عنوانِ معتبر جا بیفتد.
ALTER TABLE platform_events
  ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'ANONYMOUS_CLIENT';

-- محدودسازی به همان پنج سطحی که §۱۵ نام می‌برد.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_events_trust_level_chk'
  ) THEN
    ALTER TABLE platform_events
      ADD CONSTRAINT platform_events_trust_level_chk
      CHECK (trust_level IN (
        'SERVER_VERIFIED', 'AUTHENTICATED_CLIENT', 'ANONYMOUS_CLIENT', 'IMPORTED', 'SYNTHETIC'
      ));
  END IF;
END $$;

-- زمانِ رسیدن به سرور — تنها مُهرِ زمانیِ کاملاً قابلِ اعتماد.
-- occurred_at از کلاینت می‌آید (قابلِ جعل) و ingested_at لحظه‌ی درج است؛
-- برایِ تحلیلِ آینده باید بشود این سه را از هم تفکیک کرد.
ALTER TABLE platform_events
  ADD COLUMN IF NOT EXISTS server_received_at timestamptz NOT NULL DEFAULT now();

-- ایندکس برایِ فیلترِ دیتاستِ آموزشی بر پایه‌ی سطحِ اعتماد.
CREATE INDEX IF NOT EXISTS platform_events_trust_level_idx
  ON platform_events (trust_level, occurred_at);
