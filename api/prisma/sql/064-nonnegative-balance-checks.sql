-- ═══════════════════════════════════════════════════════════════════════
--  051 — گاردِ دیتابیسی برایِ موجودی‌هایِ پولی (پروتکل §۲۴ «missing constraints»)
--
--  وضعیتِ فعلی **درست است** — هر سه مسیرِ کاهش، شرطِ کفایت را داخلِ خودِ
--  `UPDATE ... WHERE balance >= amount` دارند (TOCTOU-safe، نه SELECT-then-check):
--    • lib/rewards.ts:56       wallet_balance >= costCoins
--    • lib/sms-balance.ts:60   sms_balance   >= count
--    • lib/loyalty.ts          redeemGiftCardTx (کاهشِ شرطیِ کارتِ هدیه)
--
--  پس چرا این migration؟ چون آن گاردها در **کد** زندگی می‌کنند. §۲۴ صریحاً
--  دنبالِ «کانستریتِ گمشده» می‌گردد: اگر فردا یک مسیرِ تازه (یا یک اصلاحِ
--  عجولانه‌ی دستی رویِ DB) شرط را جا بیندازد، امروز هیچ‌چیز جلویش را نمی‌گیرد
--  و نتیجه‌اش **موجودیِ منفی**ِ بی‌صداست — یعنی پولِ ساختگی. این کانستریت‌ها
--  همان دفاعِ آخرند: تراکنش fail می‌شود به‌جایِ اینکه داده خراب شود.
--
--  ⚠️ پیش از نوشتن با اجرایِ واقعی تأیید شد (۲۰۲۶-۰۸-۲۴):
--    • هیچ ردیفِ منفی‌ای وجود ندارد (هر چهار جدول: ۰ ردیف)
--    • هیچ مسیرِ کدی عمداً منفی نمی‌کند
--  پس افزودنشان هیچ رفتارِ موجودی را نمی‌شکند.
--
--  عمداً `NOT VALID` **نیست**: جدول‌ها کوچک‌اند و داده‌ی موجود از قبل پاک است،
--  پس اعتبارسنجیِ کامل ارزان است و از همان لحظه واقعاً محافظت می‌کند.
--
--  idempotent: اگر کانستریت از قبل باشد، دوباره ساخته نمی‌شود.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_economy_profiles_wallet_nonneg') THEN
    ALTER TABLE customer_economy_profiles
      ADD CONSTRAINT customer_economy_profiles_wallet_nonneg CHECK (wallet_balance >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_balance_nonneg') THEN
    ALTER TABLE gift_cards
      ADD CONSTRAINT gift_cards_balance_nonneg CHECK (balance_toman >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_sms_balance_nonneg') THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_sms_balance_nonneg CHECK (sms_balance >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'club_members_points_nonneg') THEN
    ALTER TABLE club_members
      ADD CONSTRAINT club_members_points_nonneg CHECK (points >= 0);
  END IF;
END $$;
