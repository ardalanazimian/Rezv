-- 017: افزودن is_active به staff (CWE-613 — Insufficient Session Expiration).
-- بدون این، توکن refresh یک کارمند اخراج‌شده تا ۳۰ روز معتبر می‌ماند.
-- مسیر refresh و ورود، is_active را چک می‌کنند و حساب غیرفعال را رد می‌کنند.
-- روی دیتابیس زنده اعمال شده (apply_migration: add_staff_is_active).
-- پیش‌فرض true تا رفتار کارمندان موجود تغییر نکند.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
