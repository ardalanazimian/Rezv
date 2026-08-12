-- 037: فعال‌سازی RLS روی ۳۴ جدولِ اصلی‌ای که هیچ‌وقت واقعاً migration نگرفته بودن.
--
-- زمینه (یافته‌ی live-test ۲۰۲۶-۰۸-۱۲ — رجوع کن به PROJECT-KNOWLEDGE.md §۲ و
-- agency/knowledge/KNOWLEDGE_SYSTEM.md §SECURITY_MEMORY برایِ جزئیاتِ کامل):
-- migration 023 ادعا کرده بود «بقیه‌ی ۳۲ جدولِ اصلی همه RLS فعال دارند» — این
-- ادعا برایِ DBِ زنده‌ی *آن‌موقع* درست بود (احتمالاً از طریقِ یک دستورِ دستی/
-- کنسولِ Supabase که هیچ‌وقت commit نشد)، ولی هیچ migration‌ای برایِ این
-- جدول‌ها وجود نداشت. یعنی یک DBِ تازه‌ساز از رویِ همینِ ریپو (CI، محیطِ
-- توسعه‌ی محلی، بازیابیِ فاجعه از رویِ migrationها) این جدول‌ها رو بدونِ RLS
-- می‌ساخت. این migration دقیقاً همون کاری رو می‌کنه که 023 برایِ
-- payments/platform_settings/restaurant_closures کرد: چیزی که روی DB زنده
-- از قبل درست بود رو به‌صورتِ یک migrationِ idempotent مستند می‌کنه.
--
-- ⚠️ فقط ENABLE ROW LEVEL SECURITY — بدونِ policy (deny-by-default، هم‌راستا
-- با ۳۴+۱۵ جدولِ موجود). بک‌اند با نقشِ owner (که RLS را دور می‌زند) وصل
-- می‌شود؛ کنترلِ دسترسیِ واقعی همچنان در کدِ اپلیکیشن است — این فقط لایه‌ی
-- defense-in-depthِ سطحِ DB رو کامل می‌کنه، رفتارِ اپ رو تغییر نمی‌ده.
--
-- idempotent: ENABLE ROW LEVEL SECURITY روی جدولی که از قبل فعال است بی‌خطر
-- است؛ IF EXISTS هم محافظت می‌کند اگر یکی از این جدول‌ها در یک DBِ خاص نباشد.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'campaign_logs', 'club_code_counters', 'club_members',
    'coupon_redemptions', 'coupons', 'customer_insights', 'gift_cards',
    'guest_profiles', 'idempotency_keys', 'jobs', 'marketing_automations',
    'menu_items', 'otp_codes', 'points_ledger', 'referrals',
    'reservation_events', 'reservation_items', 'reservations',
    'restaurant_demand_forecasts', 'restaurant_no_show_models',
    'restaurant_photos', 'restaurants', 'reviews', 'sms_transactions',
    'special_events', 'staff', 'staff_notes', 'staff_permissions',
    'tables', 'tenants', 'users', 'waitlist_entries', 'webhooks'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
