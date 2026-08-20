-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۷ — دفترِ ارتباط‌گیری (Outreach Ledger)
--
--  ⚠️ باگی که این مهاجرت از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۰):
--
--  ستونِ marketing_automations.converted_count در *کلِ ریپو* هیچ‌جا افزایش
--  نمی‌یابد. تنها دو ارجاعِ موجود هر دو خواندن‌اند، در
--  api/src/app/api/v1/restaurant/automations/route.ts:
--
--      conversion_rate_pct: a.sentCount ? round(a.convertedCount / a.sentCount * 100) : 0
--
--  یعنی این عبارت *ساختاراً* همیشه صفر برمی‌گرداند، و پنلِ بیزنس
--  (apps/business/js/marketing.js) آن را به رستوران‌دار این‌طور نشان می‌دهد:
--
--      «۱۲۰ ارسال · ۰٪ تبدیل»
--
--  رستوران‌دار از این عدد نتیجه می‌گیرد کمپین‌هایش بی‌اثرند. این از «هیچ
--  نشان‌ندادن» بدتر است — یک معیارِ عملکرد است که هیچ کدی نمی‌تواند پرش کند.
--  بندِ ۲۰ دستورالعمل: هرگز عملکردی را که اندازه نگرفته‌ای گزارش نکن.
--
--  چرا محاسبه‌ی بازگشتی ممکن نبود (بررسی‌شده، نه فرض): هیچ‌کدام از سه مسیرِ
--  ارتباط‌گیری گیرنده را ثبت نمی‌کنند —
--    • runAutomation (lib/automation.ts) روی targets حلقه می‌زند و لیست را دور می‌ریزد
--    • کمپینِ دستی (restaurant/sms/route.ts) فقط recipients_count عددی ثبت می‌کند
--    • sms_transactions دفترِ *اعتبار* است (delta/balance) و اصلاً user_id ندارد
--  پس تبدیل نه محاسبه‌شدنی بود و نه بازسازی‌شدنی. باید ثبت شود.
--
--  ── تصمیم‌های طراحی ──
--
--  • انتساب «آخرین تماس» (last-touch) با پنجره‌ی زمانی. اگر سه کمپین برای یک
--    مشتری رفته و او یک‌بار رزرو کرده، اگر هر سه ادعای تبدیل کنند نرخ سه‌برابر
--    باد می‌کند. قیدِ UNIQUE روی converted_reservation_id این را در سطحِ
--    دیتابیس غیرممکن می‌کند، نه فقط در سطحِ کد: هر رزرو حداکثر یک تماس را
--    تبدیل می‌کند. (چند NULL در Postgres با UNIQUE تداخل ندارند.)
--
--  • resolved_at جداست از converted_at. یک تماسِ دیروز هنوز فرصتِ تبدیل دارد؛
--    شمردنش به‌عنوانِ «تبدیل‌نشده» نرخ را مصنوعی پایین می‌آورد. مخرجِ نرخ فقط
--    ردیف‌های *حل‌شده* است — همان انضباطِ MIN_RESOLVED_FOR_ACCURACY در
--    دفترِ پیش‌بینی (مهاجرتِ ۰۵۵).
--
--  • user_id عمداً nullable است: کمپینِ دستی می‌تواند شماره‌ی خام بگیرد که به
--    هیچ کاربری وصل نیست. چنین ردیفی «تبدیل‌نشده» نیست، «قابلِ‌انتساب نیست» —
--    و باید از *هر دو* سویِ کسر بیرون بماند، نه اینکه مخرج را باد کند.
--
--  • converted_at از reservations.created_at می‌آید نه slot_start: رویدادی که
--    تماس باعثش شده «رزرو کردن» است، نه «آمدن». (حضورنداشتن مسئله‌ی جداست و
--    مدلِ no-show سراغش می‌رود.)
--
--  ⚠️ ON DELETE CASCADE روی restaurant_id: با حذفِ رستوران دفترش هم می‌رود.
--  ⚠️ ON DELETE SET NULL روی user_id و converted_reservation_id: حذفِ کاربر یا
--     رزرو نباید سندِ «این تماس گرفته شد» را نابود کند.
--
--  idempotent: همه‌ی دستورها IF NOT EXISTS دارند.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS outreach_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- NULL = شماره‌ی خام بدونِ حسابِ کاربری → قابلِ انتساب نیست (نه «تبدیل‌نشده»)
  user_id                  UUID REFERENCES users(id) ON DELETE SET NULL,
  channel                  TEXT NOT NULL,   -- 'sms' | 'call'
  source                   TEXT NOT NULL,   -- 'automation' | 'campaign' | 'crm_recommendation'
  -- شناسه‌ی منبع در جدولِ خودش (marketing_automations.id برای automation).
  -- عمداً FK ندارد: حذفِ یک automation نباید تاریخِ ارسالش را پاک کند.
  source_id                UUID,
  reason                   TEXT,            -- چرا این مشتری انتخاب شد (شفافیت)
  sent_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── نتیجه ──
  converted_reservation_id UUID UNIQUE REFERENCES reservations(id) ON DELETE SET NULL,
  converted_at             TIMESTAMPTZ,
  -- کی نتیجه قطعی شد: یا تبدیل رخ داد، یا پنجره‌ی انتساب بسته شد.
  -- NULL = هنوز در پنجره، هنوز فرصت دارد → از مخرجِ نرخ بیرون است.
  resolved_at              TIMESTAMPTZ
);

-- انتخابِ ردیف‌های حل‌نشده برای resolver (پرتکرارترین کوئری).
CREATE INDEX IF NOT EXISTS outreach_log_unresolved_idx
  ON outreach_log (sent_at) WHERE resolved_at IS NULL;

-- پیوندِ resolver: (restaurant_id, user_id) → رزروهای بعد از sent_at
CREATE INDEX IF NOT EXISTS outreach_log_attribution_idx
  ON outreach_log (restaurant_id, user_id, sent_at);

-- تجمیعِ نرخِ تبدیل برای یک automation در پنلِ بیزنس
CREATE INDEX IF NOT EXISTS outreach_log_source_idx
  ON outreach_log (source, source_id, sent_at DESC);

-- ⚠️ marketing_automations.converted_count عمداً حذف *نشد* و پر هم نمی‌شود.
-- حذفِ ستون یعنی شکستنِ 0_init و هر DBِ زنده‌ای که رویش نشسته. به‌جایش
-- مصرف‌کننده (automations/route.ts) دیگر نمی‌خواندش و نرخ از همین دفتر
-- محاسبه می‌شود. ستون به‌عنوانِ بازمانده‌ی مرده باقی می‌ماند تا مهاجرتِ
-- پاک‌سازیِ جداگانه‌ای سراغش برود.
