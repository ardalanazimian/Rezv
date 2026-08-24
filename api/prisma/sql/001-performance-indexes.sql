-- ═══════════════════════════════════════════════════════════════════════
--  رزرونو — Migration 001: ایندکس‌های عملکرد
--
--  ⚠️ به‌روزرسانی مهم: از زمانی که 0_init/migration.sql (migration پایه) ساخته
--     شد، اکثر ایندکس‌های این فایل **به base منتقل شدند** (چون از schema.prisma
--     تولید می‌شوند). اجرای دوباره‌شان اینجا فقط ایندکس تکراری می‌ساخت
--     (اتلاف فضا + کندی نوشتن). پس آن‌ها حذف شدند.
--
--  این فایل حالا فقط شامل مواردی است که در base نیستند:
--   • یک partial index بهینه‌تر برای پاک‌سازی هولدهای منقضی
--   • ANALYZE برای به‌روزرسانی آمار planner پس از بارگذاری اولیه
--
--  امن برای اجرای مجدد (IF NOT EXISTS). تست‌شده روی PostgreSQL 17 واقعی.
-- ═══════════════════════════════════════════════════════════════════════

-- ── partial index بهینه برای پاک‌سازی هولد ──
-- base یک ایندکس کامل (status, hold_expires_at) دارد، ولی این نسخه‌ی partial
-- برای کوئری دقیقِ «هولدهای pending منقضی» کوچک‌تر و سریع‌تر است (فقط ردیف‌های
-- pending با hold_expires_at غیر null را ایندکس می‌کند، نه کل جدول).
-- نکته: CONCURRENTLY حذف شد چون داخل transaction (مثل migrate) کار نمی‌کند؛
-- روی جدول خالیِ راه‌اندازی اولیه قفل بی‌اهمیت است. برای افزودن روی جدول پر
-- در production، آن را جدا با CREATE INDEX CONCURRENTLY اجرا کن.
CREATE INDEX IF NOT EXISTS idx_resv_hold_pending
  ON reservations (hold_expires_at)
  WHERE status = 'pending' AND hold_expires_at IS NOT NULL;

-- ── به‌روزرسانی آمار planner پس از بارگذاری اولیه ──
ANALYZE reservations;
ANALYZE tables;
ANALYZE menu_items;
ANALYZE club_members;
