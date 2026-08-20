-- 014: فیلدهای واقعی انقضای اشتراک روی tenants
-- قبلاً پنل شرکت برای وضعیت اشتراک (فعال/رو‌به‌اتمام/منقضی/آزمایشی) و روزهای باقی‌مانده
-- از داده‌ی ساختگی سمت فرانت استفاده می‌کرد چون این مفهوم اصلاً در دیتابیس نبود.
-- این migration روی دیتابیس زنده‌ی Supabase (nxtvmfoczgnjjgdgrxli) اعمال شده.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN tenants.plan_expires_at IS 'تاریخ انقضای اشتراک پولی. NULL یعنی بدون انقضا.';
COMMENT ON COLUMN tenants.trial_ends_at IS 'تاریخ پایان دوره‌ی آزمایشی.';

-- مقداردهی اولیه‌ی تنانت‌های موجود (اجرا یک‌بار، روی دیتابیس زنده انجام شده):
-- UPDATE tenants SET plan_expires_at = now() + interval '30 days' WHERE plan IN ('pro','enterprise') AND plan_expires_at IS NULL;
-- UPDATE tenants SET trial_ends_at = now() + interval '7 days' WHERE plan = 'free' AND trial_ends_at IS NULL;
