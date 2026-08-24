-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۴ — بهداشتِ ایندکس‌ها: حذفِ ۲۴ ایندکسِ دقیقاً تکراری + افزودنِ دو ایندکسِ
--        واقعاً لازم رویِ user_id
--
--  یافته‌ی ممیزیِ ۲۰۲۶-۰۸-۱۹ (با کوئریِ pg_index رویِ دیتابیسِ واقعی، نه حدس).
--
--  ── بخشِ ۱: تکراری‌ها ──
--  ۲۴ جفت ایندکس با «دقیقاً» یک تعریف وجود داشت: همان جدول، همان ستون‌ها،
--  همان opclass، همان ترتیب، همان یکتایی. ریشه‌اش الگویِ دو-منبعیِ این ریپو
--  است: مهاجرت‌های SQLِ دست‌نویس ایندکس را با نامِ `idx_*` می‌سازند و
--  `@@index` در schema.prisma همان ایندکس را با نامِ خودکارِ پریزما
--  (`<جدول>_<ستون‌ها>_idx`) دوباره می‌سازد.
--
--  چرا مهم است: ایندکسِ تکراری هیچ کوئری‌ای را سریع‌تر نمی‌کند، ولی هزینه‌ی
--  هر INSERT/UPDATE/DELETE را دوبرابر می‌کند (هر دو درخت باید نگه‌داری شوند)،
--  فضا و حافظه‌ی cache می‌گیرد، و VACUUM را کند می‌کند.
--
--  کدام‌یک حذف می‌شود: نسخه‌ی دست‌نویسِ `idx_*`. نسخه‌ی پریزما نگه داشته
--  می‌شود چون در schema.prisma اعلام شده و هر `prisma migrate`/`db push`
--  دوباره می‌سازدش — یعنی حذفِ آن فقط drift می‌سازد.
--
--  ── بخشِ ۲: ایندکس‌هایِ غایب ──
--  هردو FKِ زیر «ایندکسِ پیشرو» نداشتند؛ همه‌ی ایندکس‌هایِ این دو جدول با
--  restaurant_id شروع می‌شوند، پس کوئری‌ای که فقط با user_id فیلتر می‌کند
--  هیچ ایندکسی برایِ استفاده ندارد و کلِ جدول را می‌خواند.
--  فراخوانِ واقعی (نه فرضی): src/lib/guest-profile.ts →
--      db.customerInsight.findMany({ where: { userId } })
--  که «پروفایلِ مهمان در همه‌ی رستوران‌ها» را می‌سازد؛ اندازه‌اش با
--  (تعدادِ رستوران‌ها × تعدادِ مشتریان) خطی رشد می‌کند.
--  ضمناً نبودِ ایندکس رویِ ستونِ FK باعثِ کندیِ DELETE/UPDATE رویِ users هم
--  می‌شود، چون Postgres برای بررسیِ ارجاع باید جدولِ فرزند را seq-scan کند.
--
--  idempotent: همه‌ی دستورها IF EXISTS / IF NOT EXISTS دارند.
-- ═══════════════════════════════════════════════════════════════════════

-- ── بخشِ ۱: حذفِ ۲۴ ایندکسِ تکراریِ دست‌نویس ──
DROP INDEX IF EXISTS idx_audit_rest;
DROP INDEX IF EXISTS idx_audit_action;
DROP INDEX IF EXISTS idx_audit_actor;
DROP INDEX IF EXISTS idx_redemptions_coupon_user;
DROP INDEX IF EXISTS idx_coupons_active;
DROP INDEX IF EXISTS idx_insight_segment_clv;
DROP INDEX IF EXISTS idx_insight_churn;
DROP INDEX IF EXISTS idx_gift_recipient;
DROP INDEX IF EXISTS idx_gift_buyer;
DROP INDEX IF EXISTS idx_guest_vip;
DROP INDEX IF EXISTS idx_idem_expiry;
DROP INDEX IF EXISTS idx_automations_active;
DROP INDEX IF EXISTS idx_points_user;
DROP INDEX IF EXISTS idx_referral_phone;
DROP INDEX IF EXISTS idx_referral_referrer;
DROP INDEX IF EXISTS idx_resv_events_resv_created;
DROP INDEX IF EXISTS idx_event_restaurant;
DROP INDEX IF EXISTS idx_event_published;
DROP INDEX IF EXISTS idx_tables_restaurant_state;
DROP INDEX IF EXISTS idx_tables_restaurant_zone;
DROP INDEX IF EXISTS idx_waitlist_user;
DROP INDEX IF EXISTS idx_waitlist_queue;
DROP INDEX IF EXISTS idx_waitlist_offer_expiry;
DROP INDEX IF EXISTS idx_webhooks_rest;

-- ── بخشِ ۲: افزودنِ ایندکسِ پیشرو رویِ user_id ──
-- نام‌ها عمداً دقیقاً همان چیزی است که پریزما از `@@index([userId])` می‌سازد،
-- تا این مهاجرت و schema.prisma به drift نیفتند (درسِ بخشِ ۱).
CREATE INDEX IF NOT EXISTS club_members_user_id_idx      ON club_members (user_id);
CREATE INDEX IF NOT EXISTS customer_insights_user_id_idx ON customer_insights (user_id);
