-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۹ — بن سختِ کاربر (Company Control Plane، فازِ ۲ — B1)
--
--  کاملاً جدا از customer_economy_profiles.has_active_abuse_flag (نرم،
--  محاسبه‌شده/خودکار، fraud.ts): این ستون‌ها یک تصمیمِ *دستیِ* ادمینِ پلتفرم
--  را ثبت می‌کنند و مسیرهای احراز/رزرو را مسدود می‌کنند، نه فقط فلگ می‌زنند.
--
--  «الان بن است» = banned_at ست شده و unbanned_at نال است. بن‌شدنِ دوباره
--  بعد از رفعِ بن، banned_at/banned_reason را بازنویسی می‌کند (unbanned_at
--  به null ریست می‌شود). این ستون‌ها فقط وضعیتِ *فعلی* را نشان می‌دهند؛
--  تاریخچه‌ی کامل در audit_logs (user.ban/user.unban) است.
--
--  banned_by_admin_id عمداً بدونِ FK constraint/Prisma relation است — هم‌راستا
--  با الگویِ از‌قبل‌موجودِ users.referred_by_id (اسکالرِ خام، بدونِ relation).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_at          timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason      text,
  ADD COLUMN IF NOT EXISTS banned_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS unbanned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS unban_reason       text;

-- برایِ چکِ سریعِ «آیا این کاربر بن است» در مسیرهای پرترافیکِ احراز (OTP
-- verify، refresh) — جستجویِ نقطه‌ای رویِ id است، ولی این ایندکسِ جزئی به
-- لیستِ آینده‌یِ «همه‌ی کاربرانِ بن‌شده» در پنلِ شرکت هم کمک می‌کند.
CREATE INDEX IF NOT EXISTS idx_users_currently_banned ON users(banned_at)
  WHERE banned_at IS NOT NULL AND unbanned_at IS NULL;

-- RLS از قبل با migration 037 روی users فعال است؛ ستونِ جدید نیازی به
-- policy جدا ندارد (همان قاعده‌ی deny-by-default + دسترسیِ بک‌اند با نقشِ owner).
