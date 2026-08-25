-- ═══════════════════════════════════════════════════════════════════════
--  048 — حذفِ ایندکس‌هایِ کاملاً تکراری (فازِ ۲، پروتکل §۲۴/§۲۵)
--
--  یافته (اندازه‌گیری‌شده روی DBِ واقعی، نه از رویِ سورس):
--    SELECT tablename, indexname, normalized_def FROM pg_indexes ... GROUP BY def
--    HAVING count(*) > 1  →  **۴۵ جفتِ ایندکسِ با تعریفِ بایت‌به‌بایت یکسان**
--    رویِ ۲۵ جدول، شاملِ پرترافیک‌ترین‌ها (reservations, platform_events,
--    audit_logs, waitlist_entries, points_ledger).
--
--  ریشه: پروژه دو منبعِ DDL دارد که هیچ‌کدام از دیگری خبر ندارد —
--    ۱) `@@index` در schema.prisma که با `prisma db push` ساخته می‌شود
--       (نام‌گذاریِ خودکار: {table}_{col}_{col}_idx)
--    ۲) `CREATE INDEX IF NOT EXISTS` دستی در prisma/sql/*.sql
--       (نام‌گذاریِ دستی: idx_audit_action, chat_threads_user_idx, …)
--    هر دو یک ایندکسِ یکسان می‌سازند، فقط با دو نامِ متفاوت — پس `IF NOT EXISTS`
--    هیچ‌وقت جلویش را نمی‌گیرد و هر دو باقی می‌مانند.
--
--  چرا مهم است (نه صرفاً زشتی): هر INSERT/UPDATE باید **همه‌ی** ایندکس‌هایِ
--  جدول را نگه‌داری کند. رویِ این ۲۵ جدول یعنی تقریباً دو برابرِ کارِ لازم در
--  هر نوشتن، به‌علاوه‌ی حافظه‌ی shared_buffers و زمانِ VACUUM. رویِ
--  platform_events (پرحجم‌ترین مسیرِ نوشتن) چهار جفت وجود داشت.
--
--  جهتِ حذف — عمداً نسخه‌ی **SQL-نام** حذف می‌شود، نه نسخه‌ی Prisma-نام:
--    `prisma db push` همیشه نسخه‌ی خودش را دوباره می‌سازد، پس حذفِ آن پایدار
--    نیست. در مقابل، این فایل آخرین migration است و apply-sql.sh به ترتیبِ
--    عددی اجرا می‌کند — یعنی 048 همیشه *بعد* از فایلی که تکراری را می‌سازد
--    اجرا می‌شود. نتیجه در هر دو ترتیبِ ممکن پایدار است:
--      DBِ خالی:  db push (نسخه‌ی Prisma) → 001..047 (نسخه‌ی SQL) → 048 (حذف)
--      DBِ موجود: apply-sql → 001..047 (IF NOT EXISTS، دوباره‌سازی) → 048 (حذف)
--
--  ⚠️ هیچ ایندکسی که «تنها نسخه» باشد این‌جا حذف نمی‌شود. هر نامِ زیر یک
--     دوقلویِ با تعریفِ یکسان دارد که دست‌نخورده باقی می‌ماند.
--  ⚠️ idempotent: DROP INDEX IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

-- audit_logs               دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 008-audit-logs.sql)
DROP INDEX IF EXISTS idx_audit_action;

-- audit_logs               دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 008-audit-logs.sql)
DROP INDEX IF EXISTS idx_audit_actor;

-- audit_logs               دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 008-audit-logs.sql)
DROP INDEX IF EXISTS idx_audit_rest;

-- campaign_logs            دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 015-reviews-photos-notes-campaigns.sql)
DROP INDEX IF EXISTS campaign_logs_idx;

-- chat_messages            دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 024-chat.sql)
DROP INDEX IF EXISTS chat_messages_thread_idx;

-- chat_threads             دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 024-chat.sql)
DROP INDEX IF EXISTS chat_threads_restaurant_idx;

-- chat_threads             دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 024-chat.sql)
DROP INDEX IF EXISTS chat_threads_user_idx;

-- coupon_redemptions       دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 007-customer-intelligence.sql)
DROP INDEX IF EXISTS idx_redemptions_coupon_user;

-- coupons                  دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 007-customer-intelligence.sql)
DROP INDEX IF EXISTS idx_coupons_active;

-- customer_insights        دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 007-customer-intelligence.sql)
DROP INDEX IF EXISTS idx_insight_churn;

-- customer_insights        دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 043-customer-intelligence-score.sql)
DROP INDEX IF EXISTS customer_insights_restaurant_intelligence_idx;

-- customer_insights        دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 007-customer-intelligence.sql)
DROP INDEX IF EXISTS idx_insight_segment_clv;

-- economy_ledger_entries   دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 038-unified-economy.sql)
DROP INDEX IF EXISTS economy_ledger_entries_restaurant_created_idx;

-- economy_ledger_entries   دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 038-unified-economy.sql)
DROP INDEX IF EXISTS economy_ledger_entries_user_created_idx;

-- gift_cards               دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_gift_buyer;

-- gift_cards               دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_gift_recipient;

-- guest_profiles           دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 012-crm-rfm-guest-profile.sql)
DROP INDEX IF EXISTS idx_guest_vip;

-- idempotency_keys         دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 010-enterprise.sql)
DROP INDEX IF EXISTS idx_idem_expiry;

-- marketing_automations    دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 007-customer-intelligence.sql)
DROP INDEX IF EXISTS idx_automations_active;

-- missions                 دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 038-unified-economy.sql)
DROP INDEX IF EXISTS missions_restaurant_status_idx;

-- platform_events          دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 029-platform-events.sql)
DROP INDEX IF EXISTS platform_events_correlation_idx;

-- platform_events          دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 029-platform-events.sql)
DROP INDEX IF EXISTS platform_events_restaurant_occurred_idx;

-- platform_events          دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 029-platform-events.sql)
DROP INDEX IF EXISTS platform_events_type_occurred_idx;

-- platform_events          دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 029-platform-events.sql)
DROP INDEX IF EXISTS platform_events_user_occurred_idx;

-- points_ledger            دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_points_user;

-- referrals                دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_referral_phone;

-- referrals                دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_referral_referrer;

-- reservation_events       دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 004-lifecycle-events.sql)
DROP INDEX IF EXISTS idx_resv_events_resv_created;

-- restaurant_photos        دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 015-reviews-photos-notes-campaigns.sql)
DROP INDEX IF EXISTS restaurant_photos_idx;

-- reviews                  دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 015-reviews-photos-notes-campaigns.sql)
DROP INDEX IF EXISTS reviews_restaurant_idx;

-- reward_marketplace_items دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 038-unified-economy.sql)
DROP INDEX IF EXISTS reward_marketplace_items_restaurant_active_idx;

-- reward_redemptions       دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 038-unified-economy.sql)
DROP INDEX IF EXISTS reward_redemptions_user_created_idx;

-- sms_transactions         دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 021b-sms-transactions-table.sql)
DROP INDEX IF EXISTS idx_sms_tx_restaurant_created;

-- special_events           دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_event_published;

-- special_events           دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 006-loyalty.sql)
DROP INDEX IF EXISTS idx_event_restaurant;

-- staff_notes              دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 015-reviews-photos-notes-campaigns.sql)
DROP INDEX IF EXISTS staff_notes_idx;

-- tables                   دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 003-table-redesign.sql)
DROP INDEX IF EXISTS idx_tables_restaurant_state;

-- tables                   دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 003-table-redesign.sql)
DROP INDEX IF EXISTS idx_tables_restaurant_zone;

-- user_badges              دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 040-user-badges.sql)
DROP INDEX IF EXISTS user_badges_badge_idx;

-- user_badges              دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 040-user-badges.sql)
DROP INDEX IF EXISTS user_badges_user_idx;

-- waitlist_entries         دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 005-waitlist.sql)
DROP INDEX IF EXISTS idx_waitlist_queue;

-- waitlist_entries         دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 005-waitlist.sql)
DROP INDEX IF EXISTS idx_waitlist_offer_expiry;

-- waitlist_entries         دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 005-waitlist.sql)
DROP INDEX IF EXISTS idx_waitlist_user;

-- webhooks                 دوقلویِ Prisma باقی می‌ماند (منبعِ تکرار: 010-enterprise.sql)
DROP INDEX IF EXISTS idx_webhooks_rest;

-- ── دو موردِ خاص که الگویِ بالا را ندارند ──

-- reservations: این تنها جفتی است که **هر دو نسخه‌اش SQL** است — 026 همان
-- ایندکسِ جزئیِ 001 را با نامِ دیگری دوباره ساخت. چون هیچ‌کدام در schema.prisma
-- بیان‌شدنی نیست (ایندکسِ جزئی)، نسخه‌ی قدیمی‌تر حذف و نسخه‌ی 026 (فایلِ
-- «تثبیت»، که کانستریتِ EXCLUDE هم آن‌جاست) نگه داشته می‌شود.
DROP INDEX IF EXISTS idx_resv_hold_pending;

-- model_training_runs: schema.prisma قبلاً `@@index([restaurantId, kind, trainedAt])`
-- را بدونِ ترتیب اعلام کرده بود، در حالی که SQL نسخه‌ی `trained_at DESC` را
-- می‌سازد — از نظرِ Postgres دو ایندکسِ متفاوت، پس هر دو ساخته می‌شدند.
-- schema حالا `sort: Desc` + `map:` دارد، پس نسخه‌ی ASC یتیم شده است.
DROP INDEX IF EXISTS model_training_runs_restaurant_id_kind_trained_at_idx;
