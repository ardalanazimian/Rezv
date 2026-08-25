-- ═══════════════════════════════════════════════════════════════════════
--  049 — دو ایندکسِ مسیرِ داغ (فازِ ۲، پروتکل §۲۵)
--
--  هر دو از رویِ **ساختارِ واقعیِ ایندکس‌هایِ DB** اثبات شدند، نه حدس.
--
--  ۱) customer_insights بر اساسِ user_id تنها
--     getGuestProfile (lib/guest-profile.ts) این را اجرا می‌کند:
--         findMany({ where: { userId }, orderBy: { totalVisits: 'desc' } })
--     همه‌ی ایندکس‌هایِ این جدول با restaurant_id شروع می‌شوند (کلیدِ اصلی هم
--     (restaurant_id, user_id) است). یک btree که ستونِ دومش فیلترِ ماست بدونِ
--     ستونِ اول قابلِ استفاده نیست → sequential scan. این مسیر رویِ
--     GET /me/profile است، یعنی هر بار که اپِ مشتری باز می‌شود.
--
--  ۲) reservations بر اساسِ (restaurant_id, بازه‌ی slot_start)
--     مسیرِ فهرستِ رزروِ پنلِ رستوران (داغ‌ترین خواندنِ محصول):
--         where: { restaurantId, slotStart: { gte, lt } }
--         orderBy: [{ slotStart }, { code }]
--     ایندکس‌هایِ موجود:
--         (restaurant_id, status, slot_start)
--         (restaurant_id, no_show_risk_tier, slot_start)
--     در هر دو، یک ستونِ **غیرِ بازه‌ای** بینِ restaurant_id و slot_start است؛
--     btree نمی‌تواند از آن‌ها نه برایِ بازه و نه برایِ ترتیب استفاده کند وقتی
--     ستونِ میانی در WHERE نیست. این ایندکس دقیقاً همان شکلِ کوئری است.
--
--  ⚠️ reservations پارتیشن‌بندی‌شده است؛ CREATE INDEX رویِ جدولِ والد به همه‌ی
--     پارتیشن‌ها تکثیر می‌شود.
--  ⚠️ هر دو در schema.prisma هم اعلام شده‌اند (با map: تا نامشان یکی بماند) —
--     وگرنه `prisma db push` آن‌ها را DROP می‌کرد. گاردِ این موضوع:
--     tests/schema-drift.integration.test.mts
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS customer_insights_user_id_idx
  ON customer_insights (user_id);

CREATE INDEX IF NOT EXISTS reservations_restaurant_slot_idx
  ON reservations (restaurant_id, slot_start);
