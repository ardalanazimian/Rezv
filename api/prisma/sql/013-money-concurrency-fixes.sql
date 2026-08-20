-- ═══════════════════════════════════════════════════════════════════════
--  رزرونو — Migration رفع باگ‌های همزمانی مسیر پول (ممیزی دوم)
--  تست‌شده روی PostgreSQL واقعی. idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- NEW-M1: جلوگیری از پاداش تولد/سالگرد دوگانه (حتی تحت multi-worker cron).
-- unique partial index: هر کاربر، هر reason پاداشی سالانه، فقط یک‌بار در سال.
-- اگر دو اجرای همزمان هر دو insert کنند، دومی با unique_violation رد می‌شود.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_annual_reward ON points_ledger (
  user_id, reason, (EXTRACT(YEAR FROM created_at))
) WHERE reason IN ('birthday', 'anniversary');

-- نکته: NEW-H1 (TOCTOU کوپن) با UPDATE شرطی اتمیک در کد رفع شد (نیاز به DDL ندارد).
-- نکته: NEW-C1 (مبلغ منفی کارت هدیه) و NEW-C2 (سقف کوپن درصدی) رفع‌های کد هستند.

-- checkout: مقدار enum جدید برای کش‌بک خرید (در تراکنش جدا از استفاده‌اش)
ALTER TYPE points_reason ADD VALUE IF NOT EXISTS 'cashback';
