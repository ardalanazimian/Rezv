-- ═══════════════════════════════════════════════════════════════════════
--  رزرونو — Migration پایه (0_init)
--  ساخت کامل همه‌ی جداول، enumها، ایندکس‌ها و کلیدهای خارجی از schema.prisma.
--
--  ⚠️ این فایل تله‌ی deploy را حل می‌کند: بدون آن `prisma migrate deploy`
--     هیچ جدولی نمی‌ساخت و migrationهای بعدی fail می‌شدند.
--  ترتیب اجرا: ۱) همین فایل (prisma migrate deploy)
--             ۲) prisma/sql/*.sql از طریق prisma/apply-sql.sh
--                (شاملِ 026 = block_end + EXCLUDE، که جایگزینِ EXTRA شد)
--
--  ✅ کامل روی PostgreSQL 17 واقعی (Supabase) تست شد.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Enumها ──
CREATE TYPE "table_shape" AS ENUM ('rectangle','round','booth');
CREATE TYPE "table_zone" AS ENUM ('indoor','outdoor','window','vip','smoking');
CREATE TYPE "table_state" AS ENUM ('free','reserved','occupied','cleaning','maintenance');
CREATE TYPE "reservation_status" AS ENUM (
  'pending','waitlisted','confirmed','auto_confirmed','preparing','checked_in',
  'running_late','seated','dining','completed','no_show','rejected','expired',
  'cancelled','auto_cancelled','arrived','cancelled_by_user','cancelled_by_restaurant'
);
CREATE TYPE "waitlist_status" AS ENUM (
  'waiting','offered','accepted','declined','expired','seated','cancelled','no_response'
);
CREATE TYPE "points_reason" AS ENUM (
  'reservation','referral','birthday','anniversary','signup','cashback','redemption','adjustment'
);
CREATE TYPE "referral_status" AS ENUM ('pending','completed','rewarded');
CREATE TYPE "gift_card_status" AS ENUM ('active','redeemed','expired');
CREATE TYPE "customer_segment" AS ENUM ('new_customer','active','at_risk','churned','vip');
CREATE TYPE "coupon_kind" AS ENUM ('percent','fixed','free_item');
CREATE TYPE "automation_trigger" AS ENUM ('birthday','winback','post_visit','vip_milestone','no_show_followup');
CREATE TYPE "job_status" AS ENUM ('pending','processing','completed','failed','dead');

-- ── tenants ──
CREATE TABLE "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- ── users ──
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phone" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "birth_date" DATE,
  "anniversary_date" DATE,
  "referral_code" TEXT,
  "referred_by_id" UUID,
  "avatar_url" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- ── staff ──
CREATE TABLE "staff" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'staff',
  CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_tenant_id_phone_key" ON "staff"("tenant_id","phone");

-- ── restaurants ──
CREATE TABLE "restaurants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cuisine" TEXT,
  "vibes" TEXT[] NOT NULL DEFAULT '{}',
  "price_band" SMALLINT NOT NULL DEFAULT 2,
  "is_open" BOOLEAN NOT NULL DEFAULT true,
  "slot_minutes" SMALLINT NOT NULL DEFAULT 90,
  "buffer_minutes" SMALLINT NOT NULL DEFAULT 0,
  "cleaning_minutes" SMALLINT NOT NULL DEFAULT 15,
  "late_grace_minutes" SMALLINT NOT NULL DEFAULT 15,
  "hold_minutes" SMALLINT NOT NULL DEFAULT 10,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
  "club_prefix" TEXT NOT NULL,
  "cb_base_pct" SMALLINT NOT NULL DEFAULT 5,
  "cb_preorder_pct" SMALLINT NOT NULL DEFAULT 8,
  "cb_vip_pct" SMALLINT NOT NULL DEFAULT 12,
  "cb_winback_pct" SMALLINT NOT NULL DEFAULT 20,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");
CREATE INDEX "restaurants_tenant_id_idx" ON "restaurants"("tenant_id");

-- ── tables ──
CREATE TABLE "tables" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "number" SMALLINT NOT NULL,
  "name" TEXT,
  "capacity" SMALLINT NOT NULL,
  "min_party_size" SMALLINT NOT NULL DEFAULT 1,
  "max_party_size" SMALLINT,
  "shape" "table_shape" NOT NULL DEFAULT 'rectangle',
  "zone" "table_zone" NOT NULL DEFAULT 'indoor',
  "is_vip" BOOLEAN NOT NULL DEFAULT false,
  "is_smoking" BOOLEAN NOT NULL DEFAULT false,
  "is_accessible" BOOLEAN NOT NULL DEFAULT false,
  "is_mergeable" BOOLEAN NOT NULL DEFAULT false,
  "mergeable_with" SMALLINT[] NOT NULL DEFAULT '{}',
  "is_splittable" BOOLEAN NOT NULL DEFAULT false,
  "priority" SMALLINT NOT NULL DEFAULT 0,
  "pos_x" SMALLINT,
  "pos_y" SMALLINT,
  "rotation" SMALLINT NOT NULL DEFAULT 0,
  "max_duration_minutes" SMALLINT,
  "state" "table_state" NOT NULL DEFAULT 'free',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "qr_code" TEXT,
  "attributes" TEXT[] NOT NULL DEFAULT '{}',
  CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tables_qr_code_key" ON "tables"("qr_code");
CREATE UNIQUE INDEX "tables_restaurant_id_number_key" ON "tables"("restaurant_id","number");
CREATE INDEX "tables_restaurant_id_is_active_capacity_idx" ON "tables"("restaurant_id","is_active","capacity");
CREATE INDEX "tables_restaurant_id_state_idx" ON "tables"("restaurant_id","state");
CREATE INDEX "tables_restaurant_id_zone_idx" ON "tables"("restaurant_id","zone");

-- ── menu_items ──
CREATE TABLE "menu_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "emoji" TEXT,
  "price_toman" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sold_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "menu_items_restaurant_id_is_active_idx" ON "menu_items"("restaurant_id","is_active");

-- ── reservations ──
CREATE TABLE "reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "restaurant_id" UUID NOT NULL,
  "table_id" UUID,
  "user_id" UUID,
  "guest_name" TEXT,
  "guest_phone" TEXT,
  "party_size" SMALLINT NOT NULL,
  "slot_start" TIMESTAMP NOT NULL,
  "slot_end" TIMESTAMP NOT NULL,
  "status" "reservation_status" NOT NULL DEFAULT 'confirmed',
  "source" TEXT NOT NULL DEFAULT 'app',
  "preferences" TEXT[] NOT NULL DEFAULT '{}',
  "note" TEXT,
  "cancel_reason" TEXT,
  "hold_expires_at" TIMESTAMP,
  "merged_table_numbers" SMALLINT[] NOT NULL DEFAULT '{}',
  "duration_minutes" SMALLINT,
  "no_show_risk_score" SMALLINT,
  "no_show_risk_tier" TEXT,
  "deposit_requested" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservations_code_key" ON "reservations"("code");
CREATE INDEX "reservations_restaurant_id_status_slot_start_idx" ON "reservations"("restaurant_id","status","slot_start");
CREATE INDEX "reservations_table_id_status_slot_start_slot_end_idx" ON "reservations"("table_id","status","slot_start","slot_end");
CREATE INDEX "reservations_user_id_slot_start_idx" ON "reservations"("user_id","slot_start" DESC);
CREATE INDEX "reservations_status_hold_expires_at_idx" ON "reservations"("status","hold_expires_at");
CREATE INDEX "reservations_restaurant_id_created_at_idx" ON "reservations"("restaurant_id","created_at");
CREATE INDEX "reservations_restaurant_id_no_show_risk_tier_slot_start_idx" ON "reservations"("restaurant_id","no_show_risk_tier","slot_start");

-- ── reservation_items ──
CREATE TABLE "reservation_items" (
  "reservation_id" UUID NOT NULL,
  "menu_item_id" UUID NOT NULL,
  "qty" SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("reservation_id","menu_item_id")
);
CREATE INDEX "reservation_items_menu_item_id_idx" ON "reservation_items"("menu_item_id");

-- ── reservation_events ──
CREATE TABLE "reservation_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" UUID NOT NULL,
  "from_status" "reservation_status",
  "to_status" "reservation_status" NOT NULL,
  "actor" TEXT NOT NULL DEFAULT 'system',
  "reason" TEXT,
  "is_automatic" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "reservation_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reservation_events_reservation_id_created_at_idx" ON "reservation_events"("reservation_id","created_at");

-- ── waitlist_entries ──
CREATE TABLE "waitlist_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "user_id" UUID,
  "guest_name" TEXT,
  "guest_phone" TEXT,
  "guest_email" TEXT,
  "party_size" SMALLINT NOT NULL,
  "priority" SMALLINT NOT NULL DEFAULT 0,
  "is_vip" BOOLEAN NOT NULL DEFAULT false,
  "status" "waitlist_status" NOT NULL DEFAULT 'waiting',
  "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
  "offered_at" TIMESTAMP,
  "offer_expires_at" TIMESTAMP,
  "responded_at" TIMESTAMP,
  "seated_at" TIMESTAMP,
  "offered_table_id" UUID,
  "offered_table_number" SMALLINT,
  "estimated_wait_minutes" SMALLINT,
  "notify_sms" BOOLEAN NOT NULL DEFAULT true,
  "notify_push" BOOLEAN NOT NULL DEFAULT true,
  "notify_email" BOOLEAN NOT NULL DEFAULT false,
  "reservation_code" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "waitlist_entries_restaurant_id_status_priority_joined_at_idx" ON "waitlist_entries"("restaurant_id","status","priority" DESC,"joined_at");
CREATE INDEX "waitlist_entries_status_offer_expires_at_idx" ON "waitlist_entries"("status","offer_expires_at");
CREATE INDEX "waitlist_entries_user_id_status_idx" ON "waitlist_entries"("user_id","status");

-- ── points_ledger ──
CREATE TABLE "points_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "restaurant_id" UUID,
  "delta" INTEGER NOT NULL,
  "reason" "points_reason" NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "points_ledger_user_id_created_at_idx" ON "points_ledger"("user_id","created_at");

-- ── referrals ──
CREATE TABLE "referrals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referrer_id" UUID NOT NULL,
  "invitee_phone" TEXT NOT NULL,
  "invitee_id" UUID,
  "status" "referral_status" NOT NULL DEFAULT 'pending',
  "reward_points" INTEGER NOT NULL DEFAULT 500,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMP,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "referrals_referrer_id_status_idx" ON "referrals"("referrer_id","status");
CREATE INDEX "referrals_invitee_phone_idx" ON "referrals"("invitee_phone");

-- ── gift_cards ──
CREATE TABLE "gift_cards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "buyer_id" UUID,
  "restaurant_id" UUID,
  "amount_toman" INTEGER NOT NULL,
  "balance_toman" INTEGER NOT NULL,
  "recipient_name" TEXT,
  "recipient_phone" TEXT,
  "message" TEXT,
  "status" "gift_card_status" NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");
CREATE INDEX "gift_cards_recipient_phone_idx" ON "gift_cards"("recipient_phone");
CREATE INDEX "gift_cards_buyer_id_idx" ON "gift_cards"("buyer_id");

-- ── special_events ──
CREATE TABLE "special_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "emoji" TEXT,
  "starts_at" TIMESTAMP NOT NULL,
  "ends_at" TIMESTAMP,
  "price_toman" INTEGER,
  "capacity" INTEGER,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "special_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "special_events_restaurant_id_starts_at_idx" ON "special_events"("restaurant_id","starts_at");
CREATE INDEX "special_events_is_published_starts_at_idx" ON "special_events"("is_published","starts_at");

-- ── club_members ──
CREATE TABLE "club_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'bronze',
  "points" INTEGER NOT NULL DEFAULT 0,
  "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "club_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "club_members_restaurant_id_user_id_key" ON "club_members"("restaurant_id","user_id");
CREATE UNIQUE INDEX "club_members_restaurant_id_code_key" ON "club_members"("restaurant_id","code");
CREATE INDEX "club_members_restaurant_id_tier_idx" ON "club_members"("restaurant_id","tier");

-- ── club_code_counters ──
CREATE TABLE "club_code_counters" (
  "restaurant_id" UUID NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 1001,
  CONSTRAINT "club_code_counters_pkey" PRIMARY KEY ("restaurant_id")
);

-- ── otp_codes ──
CREATE TABLE "otp_codes" (
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("phone")
);
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- ── customer_insights ──
CREATE TABLE "customer_insights" (
  "restaurant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "total_visits" INTEGER NOT NULL DEFAULT 0,
  "total_spend_toman" INTEGER NOT NULL DEFAULT 0,
  "avg_spend_toman" INTEGER NOT NULL DEFAULT 0,
  "visit_frequency_days" DOUBLE PRECISION,
  "predicted_clv_toman" INTEGER NOT NULL DEFAULT 0,
  "first_visit_at" TIMESTAMP,
  "last_visit_at" TIMESTAMP,
  "no_show_count" INTEGER NOT NULL DEFAULT 0,
  "cancel_count" INTEGER NOT NULL DEFAULT 0,
  "completed_count" INTEGER NOT NULL DEFAULT 0,
  "no_show_rate_pct" INTEGER NOT NULL DEFAULT 0,
  "churn_risk_score" INTEGER NOT NULL DEFAULT 0,
  "r_score" SMALLINT,
  "f_score" SMALLINT,
  "m_score" SMALLINT,
  "rfm_segment" TEXT,
  "segment" "customer_segment" NOT NULL DEFAULT 'new_customer',
  "is_vip" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP NOT NULL,
  CONSTRAINT "customer_insights_pkey" PRIMARY KEY ("restaurant_id","user_id")
);
CREATE INDEX "customer_insights_restaurant_id_segment_predicted_clv_toman_idx" ON "customer_insights"("restaurant_id","segment","predicted_clv_toman" DESC);
CREATE INDEX "customer_insights_restaurant_id_churn_risk_score_idx" ON "customer_insights"("restaurant_id","churn_risk_score" DESC);

-- ── coupons ──
CREATE TABLE "coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "coupon_kind" NOT NULL,
  "value" INTEGER NOT NULL,
  "free_menu_item_id" UUID,
  "min_party_size" SMALLINT,
  "max_redemptions" INTEGER,
  "redemption_count" INTEGER NOT NULL DEFAULT 0,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "targetSegment" "customer_segment",
  "valid_from" TIMESTAMP NOT NULL DEFAULT now(),
  "valid_until" TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupons_restaurant_id_code_key" ON "coupons"("restaurant_id","code");
CREATE INDEX "coupons_restaurant_id_is_active_valid_until_idx" ON "coupons"("restaurant_id","is_active","valid_until");

-- ── coupon_redemptions ──
CREATE TABLE "coupon_redemptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "user_id" UUID,
  "reservation_code" TEXT,
  "discount_toman" INTEGER NOT NULL,
  "ip" TEXT,
  "redeemed_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "coupon_redemptions_coupon_id_user_id_idx" ON "coupon_redemptions"("coupon_id","user_id");

-- ── marketing_automations ──
CREATE TABLE "marketing_automations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" "automation_trigger" NOT NULL,
  "trigger_config" JSONB NOT NULL DEFAULT '{}',
  "message_template" TEXT NOT NULL,
  "coupon_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_run_at" TIMESTAMP,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "converted_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_automations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_automations_restaurant_id_is_active_trigger_idx" ON "marketing_automations"("restaurant_id","is_active","trigger");

-- ── staff_permissions ──
CREATE TABLE "staff_permissions" (
  "staff_id" UUID NOT NULL,
  "can_manage_reservations" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_tables" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_waitlist" BOOLEAN NOT NULL DEFAULT true,
  "can_view_analytics" BOOLEAN NOT NULL DEFAULT false,
  "can_view_revenue" BOOLEAN NOT NULL DEFAULT false,
  "can_manage_campaigns" BOOLEAN NOT NULL DEFAULT false,
  "can_manage_coupons" BOOLEAN NOT NULL DEFAULT false,
  "can_manage_staff" BOOLEAN NOT NULL DEFAULT false,
  "can_manage_settings" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP NOT NULL,
  CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("staff_id")
);

-- ── audit_logs ──
CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "actor_id" UUID,
  "actor_type" TEXT NOT NULL DEFAULT 'anonymous',
  "target_id" UUID,
  "restaurant_id" UUID,
  "ip" TEXT,
  "trace_id" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action","created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id","created_at");
CREATE INDEX "audit_logs_restaurant_id_created_at_idx" ON "audit_logs"("restaurant_id","created_at");

-- ── jobs ──
CREATE TABLE "jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "priority" SMALLINT NOT NULL DEFAULT 5,
  "status" "job_status" NOT NULL DEFAULT 'pending',
  "idempotency_key" TEXT,
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "max_attempts" SMALLINT NOT NULL DEFAULT 5,
  "run_after" TIMESTAMP NOT NULL DEFAULT now(),
  "last_error" TEXT,
  "locked_at" TIMESTAMP,
  "result" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "jobs_status_priority_run_after_idx" ON "jobs"("status","priority","run_after");

-- ── idempotency_keys ──
CREATE TABLE "idempotency_keys" (
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "response" JSONB,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- ── webhooks ──
CREATE TABLE "webhooks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT '{}',
  "secret" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhooks_restaurant_id_is_active_idx" ON "webhooks"("restaurant_id","is_active");

-- ── guest_profiles ──
CREATE TABLE "guest_profiles" (
  "user_id" UUID NOT NULL,
  "global_visits" INTEGER NOT NULL DEFAULT 0,
  "global_spend_toman" INTEGER NOT NULL DEFAULT 0,
  "global_clv_toman" INTEGER NOT NULL DEFAULT 0,
  "restaurants_visited" INTEGER NOT NULL DEFAULT 0,
  "last_visit_anywhere" TIMESTAMP,
  "is_vip_anywhere" BOOLEAN NOT NULL DEFAULT false,
  "preferred_restaurant_id" UUID,
  "dietary_tags" TEXT[] NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP NOT NULL,
  CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("user_id")
);
CREATE INDEX "guest_profiles_is_vip_anywhere_idx" ON "guest_profiles"("is_vip_anywhere");

-- ═══════════════════════════════════════════════════════════════════════
--  Foreign Keys (پس از ساخت همه‌ی جداول)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "special_events" ADD CONSTRAINT "special_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "club_code_counters" ADD CONSTRAINT "club_code_counters_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "customer_insights" ADD CONSTRAINT "customer_insights_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "customer_insights" ADD CONSTRAINT "customer_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "marketing_automations" ADD CONSTRAINT "marketing_automations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON UPDATE CASCADE ON DELETE CASCADE;
