-- ═══════════════════════════════════════════════════════════════════════
--  رزرونو — پاک‌سازی کامل داده‌ی دمو
--  همه‌ی داده‌ی نمونه (tenant با پیشوند [DEMO]) را حذف می‌کند.
--  FKها ON DELETE RESTRICT دارند، پس به‌ترتیب وارونه پاک می‌شود.
--  تست‌شده روی PostgreSQL واقعی.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;
-- ابتدا جداول وابسته (اگر رزرو/عضو دمو ساخته شده باشد)
DELETE FROM reservation_items WHERE reservation_id IN (
  SELECT id FROM reservations WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%')));
DELETE FROM reservations WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%'));
DELETE FROM club_members WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%'));
DELETE FROM menu_items WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%'));
DELETE FROM tables WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%'));
DELETE FROM restaurants WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%');
DELETE FROM staff WHERE tenant_id IN (SELECT id FROM tenants WHERE name LIKE '[DEMO]%');
DELETE FROM tenants WHERE name LIKE '[DEMO]%';
COMMIT;
-- تأیید: باید صفر باشد
SELECT count(*) AS remaining_demo FROM tenants WHERE name LIKE '[DEMO]%';
