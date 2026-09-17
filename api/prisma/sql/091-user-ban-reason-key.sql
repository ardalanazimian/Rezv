-- ═══════════════════════════════════════════════════════════════════════
--  ۰۹۱ — دلیلِ **عمومیِ** بنِ کاربر: کلیدِ بسته، جدا از یادداشتِ داخلیِ ادمین (STATE M-14 · F003)
--
--  چرا: `users.banned_reason` متنِ آزادِ ادمین است (placeholderِ مودال: «شکایتِ رسمیِ
--  رستوران») و `Err.userBanned` همان را در `details.reason` ِ پاسخِ JSON به خودِ کاربرِ
--  بن‌شده می‌فرستاد. کاربر حق دارد بداند **چرا** — ولی نه یادداشتِ داخلی را.
--  پس دو ستون، دو مخاطب:
--    banned_reason      ← یادداشتِ داخلی، فقط ادمین (بدونِ تغییر)
--    banned_reason_key  ← یکی از پنج کلیدِ بسته؛ اپ جمله‌ی فارسیِ هر کلید را نشان می‌دهد
--
--  بنِ‌های موجود: کلید NULL می‌ماند و اپ پیامِ عمومی نشان می‌دهد. هیچ دلیلی حدس زده
--  نمی‌شود — مهاجرتی که برای بنِ قدیمی دلیل بسازد، همان ادعای بی‌پشتوانه است.
--
--  idempotent: نوع با `duplicate_object`، ستون با `IF NOT EXISTS`.
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE ban_reason_key AS ENUM
    ('repeated_no_show', 'promo_abuse', 'abusive_conduct', 'user_request', 'under_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason_key ban_reason_key;
