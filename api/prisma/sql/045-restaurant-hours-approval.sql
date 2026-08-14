-- Part 3 (تأییدِ ساعتِ کاری، ۲۰۲۶-۰۸-۱۴): تا اینجا PUT /restaurant/hours مستقیماً
-- opening_hours را زنده می‌نوشت — بدونِ هیچ تأییدِ شرکت. طبقِ مدلِ اقتدارِ پروژه
-- (Company = مرجعِ پلتفرم؛ Restaurant = عملگرِ محلی که فقط پیشنهاد می‌دهد)، این
-- اشتباه است: یک اپراتور می‌توانست بی‌آنکه کسی ببیند، سانس‌هایی باز کند که
-- ظرفیتِ واقعی/کیفیتِ سرویس را ندارد.
--
-- الگو دقیقاً مثلِ RestaurantPhoto.status/rejectionReason/reviewedAt (بازبینیِ
-- گالری) است — یک صفِ pending/approved/rejected با دلیلِ ردِ اختیاری. اینجا
-- به‌جایِ جدولِ جدا (چون هر رستوران در هر لحظه حداکثر یک پیشنهادِ درِ دستِ
-- بررسی دارد، نه چندتا هم‌زمان)، مستقیم روی خودِ restaurants ستون اضافه شده
-- (Option A از پیشنهادِ ماموریت) — ساده‌تر برای یک رابطه‌یِ ۱-به-حداکثرِ۱.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pending_opening_hours jsonb;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hours_change_status text; -- 'pending' | 'rejected' | NULL (چیزی برایِ بررسی نیست)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hours_change_reason text; -- دلیلِ رد (فقط وقتی status='rejected')
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hours_change_requested_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hours_change_reviewed_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hours_change_reviewed_by uuid;

-- ایندکس برایِ صفِ بازبینیِ پنلِ شرکت (GET .../admin/hours-changes?status=pending)
-- — بدونِ این، هر بار کلِ جدولِ restaurants سیک می‌شود.
CREATE INDEX IF NOT EXISTS idx_restaurants_hours_change_status
  ON restaurants (hours_change_status)
  WHERE hours_change_status IS NOT NULL;
