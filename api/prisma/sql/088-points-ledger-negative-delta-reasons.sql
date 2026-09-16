-- ═══════════════════════════════════════════════════════════════════════
--  ۰۸۸ — `points_ledger`: کسرِ امتیاز فقط با reasonِ مجاز
--
--  چرا: اپِ مشتری به کاربر وعده می‌دهد «امتیازهات هیچ‌وقت منقضی نمی‌شن»
--  (apps/customer/js/features/loyalty.js). پاسدارِ آن وعده تا امروز فقط
--  `tools/check-loyalty-promise.mjs` بود که **متن** را می‌خواند. Red Team (RT-18،
--  RETEST-2026-09-13) نشان داد یک کرونِ انقضا با منفیِ hoisted
--  (`const adjustment = 0 - row.points; … delta: adjustment`) از آن رد می‌شود —
--  و هر فهرستِ الگو همیشه یک rename عقب است. پس تضمین این‌جاست، جایی که شکلِ کد
--  بی‌اثر است: هر مسیری — Prisma، SQLِ خام، اصلاحِ دستی روی DB — به همین قید می‌خورد.
--
--  قاعده: ردیفِ منفی فقط دو معنا دارد که امروز در کد وجود دارند و وعده را نقض نمی‌کنند:
--    • 'redemption' — بازخریدِ خودِ کاربر (lib/loyalty.ts · redeemPointsTx). خرج ≠ انقضا.
--    • 'cashback'   — برگشتِ کش‌بکِ رزروِ لغوشده/بی‌حضور (lib/loyalty.ts ·
--                     reverseReservationCashback، کلیدِ `cashback-reversal:`). reason عمداً
--                     همان 'cashback' است تا SUM(delta) WHERE reason='cashback' خالص بماند.
--  هر reasonِ دیگر با delta منفی — به‌ویژه 'adjustment'، شکلِ طبیعیِ یک «جاروی امتیازِ
--  کهنه» — رد می‌شود (SQLSTATE 23514).
--
--  ⚠️ پیش از نوشتن اندازه‌گیری شد (۲۰۲۶-۰۹-۱۳، git grep روی api/src): نویسنده‌های
--  points_ledger = loyalty.ts (addPoints، addClubPoints، redeemPointsTx،
--  reverseReservationCashback) و reservations.ts (کش‌بکِ مثبت). صداکننده‌های
--  addPoints/addClubPoints همه delta مثبت می‌دهند. تنها نویسنده‌ی منفیِ غیرمجاز یک
--  fixtureِ تست بود (checkin-points-panel-path: کسر با 'adjustment') که به 'redemption' رفت.
--
--  ⚠️ **تصمیمِ محصولیِ ضمنی، گفته‌شده:** «کسرِ دستیِ ادمین» (مثلاً پس‌گرفتنِ امتیازِ
--  تقلبی) از امروز روی DB ممکن نیست. امروز هیچ مسیرِ کدی برایش نیست. اگر ساخته شود،
--  باید reasonِ **صریحِ خودش** را بگیرد و این قید آگاهانه گشاد شود — و گاردِ
--  check-loyalty-promise آن گشادشدن را می‌بیند.
--
--  `NOT VALID`: ردیف‌های موجود بازسنجی نمی‌شوند — وعده درباره‌ی نوشتنِ آینده است، و اگر
--  دیتابیسی ردیفِ کهنه‌ی ناسازگار داشته باشد، مهاجرت نباید روی آن بشکند. هر INSERT/UPDATEِ
--  تازه از همین لحظه بررسی می‌شود.
--
--  با ALTER TABLE و نه inline در CREATE TABLE: قیدِ inline در مسیرِ CI (db push پیش از
--  apply-sql) بی‌صدا گم می‌شد — tools/check-schema-drift.sh لایه‌ی چهارم.
--
--  idempotent.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'points_ledger_negative_delta_reason') THEN
    ALTER TABLE points_ledger
      ADD CONSTRAINT points_ledger_negative_delta_reason
      CHECK (delta >= 0 OR reason IN ('redemption', 'cashback')) NOT VALID;
  END IF;
END $$;
