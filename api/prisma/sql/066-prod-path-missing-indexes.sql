-- ═══════════════════════════════════════════════════════════════════════
--  066 — ۱۷ ایندکسی که فقط در مسیرِ CI ساخته می‌شدند و در تولید غایب بودند
--
--  ⚠️ کلاسِ باگ: «CI سبز، تولید کند».
--  CI اسکیما را با `prisma db push` می‌سازد، پس هر `@@index` در schema.prisma
--  را خودکار می‌سازد. تولید با `migrate deploy (0_init) + apply-sql.sh` ساخته
--  می‌شود، که فقط چیزی را دارد که یا در 0_init آمده یا در prisma/sql/ نوشته
--  شده. این ۱۷ ایندکس در schema.prisma اعلام شده بودند ولی **هیچ migrationِ
--  SQLی** نداشتند ⇒ روی هر دیتابیسِ تولیدی وجود نداشتند و کوئری‌هایشان
--  Seq Scan می‌زدند. هیچ‌کدام از ۹ جابِ CI این را نمی‌دید.
--
--  اندازه‌گیری (۲۰۲۶-۰۸-۲۵، دو Postgresِ واقعی از رویِ همین HEAD):
--    v_ci   = db push + apply-sql + test-schema-fixups → ۱۹۸ ایندکس
--    v_prod = migrate deploy + apply-sql.sh            → ۱۷۸ ایندکس
--    اختلاف = ۲۱ تعریف؛ از این ۲۱:
--      • ۱ مورد در تولید کاملاً معادل بود و ساخته نمی‌شود:
--        jobs.idempotency_key → idx_jobs_idem که partial-unique روی
--        `WHERE idempotency_key IS NOT NULL` است. چون btree در Postgres
--        NULLها را به‌هرحال یکتا نمی‌شمارد، برای dedupِ queue.ts:63 دقیقاً
--        همان کار را می‌کند. با INSERTِ تکراریِ واقعی روی هر دو DB تأیید شد:
--        هر دو خطای unique دادند و ۱ ردیف ماند ⇒ dedupِ تولید سالم است.
--      • ۳ مورد ستونِ پیشروِ مشترک داشتند ولی ستونِ دومِ مرتب‌سازی را نه
--        (مثلاً customer_insights_pkey(restaurant_id,user_id) در برابرِ
--        (restaurant_id, intelligence_score DESC)) ⇒ فیلتر پوشش داشت،
--        مرتب‌سازی نه. این‌ها هم ساخته می‌شوند.
--      • ۱۷ مورد هیچ ایندکسی با همان ستونِ پیشرو نداشتند.
--    مجموعاً ۲۰ ایندکس در این فایل. هیچ‌کدام UNIQUE نیستند ⇒ اثرِ درستی
--    ندارد، فقط کارایی.
--
--  نامِ ایندکس‌ها **دقیقاً** همان چیزی است که Prisma تولید می‌کند، تا
--  `db push` نسخه‌ی دومی با نامِ دیگر نسازد و drift تازه درست نشود.
--
--  CONCURRENTLY عمداً نیست: `prisma db execute` فایل را در یک تراکنشِ ضمنی
--  اجرا می‌کند و CONCURRENTLY داخلِ تراکنش کار نمی‌کند (همان دلیلِ ثبت‌شده در
--  001-performance-indexes.sql:20). روی دیتابیسِ بزرگِ زنده، این‌ها را جدا با
--  CREATE INDEX CONCURRENTLY بساز.
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "campaign_logs_restaurant_id_created_at_idx"
  ON "campaign_logs" ("restaurant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_messages_thread_id_created_at_idx"
  ON "chat_messages" ("thread_id", "created_at");

CREATE INDEX IF NOT EXISTS "chat_threads_user_id_last_message_at_idx"
  ON "chat_threads" ("user_id", "last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "economy_ledger_entries_restaurant_id_created_at_idx"
  ON "economy_ledger_entries" ("restaurant_id", "created_at");

CREATE INDEX IF NOT EXISTS "economy_ledger_entries_user_id_created_at_idx"
  ON "economy_ledger_entries" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "missions_restaurant_id_status_idx"
  ON "missions" ("restaurant_id", "status");

CREATE INDEX IF NOT EXISTS "platform_events_correlation_id_idx"
  ON "platform_events" ("correlation_id");

CREATE INDEX IF NOT EXISTS "platform_events_restaurant_id_occurred_at_idx"
  ON "platform_events" ("restaurant_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "platform_events_type_occurred_at_idx"
  ON "platform_events" ("type", "occurred_at");

CREATE INDEX IF NOT EXISTS "platform_events_user_id_occurred_at_idx"
  ON "platform_events" ("user_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "restaurant_photos_restaurant_id_sort_order_idx"
  ON "restaurant_photos" ("restaurant_id", "sort_order");

-- ⚠️ این یکی فقط کارایی نیست: reviews.restaurant_id یک FK با ON DELETE CASCADE
--  است و بدونِ ایندکس، حذفِ هر رستوران کلِ جدولِ نظرات را Seq Scan می‌کند.
CREATE INDEX IF NOT EXISTS "reviews_restaurant_id_created_at_idx"
  ON "reviews" ("restaurant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reward_marketplace_items_restaurant_id_is_active_idx"
  ON "reward_marketplace_items" ("restaurant_id", "is_active");

CREATE INDEX IF NOT EXISTS "reward_redemptions_user_id_created_at_idx"
  ON "reward_redemptions" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "sms_transactions_restaurant_id_created_at_idx"
  ON "sms_transactions" ("restaurant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "staff_notes_restaurant_id_pinned_created_at_idx"
  ON "staff_notes" ("restaurant_id", "pinned" DESC, "created_at" DESC);

CREATE INDEX IF NOT EXISTS "user_badges_user_id_idx"
  ON "user_badges" ("user_id");

-- ── سه موردِ «ستونِ پیشرو پوشش داشت، مرتب‌سازی نه» ──────────────────────
CREATE INDEX IF NOT EXISTS "chat_threads_restaurant_id_last_message_at_idx"
  ON "chat_threads" ("restaurant_id", "last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "customer_insights_restaurant_id_intelligence_score_idx"
  ON "customer_insights" ("restaurant_id", "intelligence_score" DESC);

CREATE INDEX IF NOT EXISTS "user_badges_badge_id_idx"
  ON "user_badges" ("badge_id");
