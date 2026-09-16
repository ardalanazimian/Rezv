-- ═══════════════════════════════════════════════════════════════════════
--  ۰۸۹ — `points_ledger` فقط-افزودنی می‌شود: UPDATE، DELETE و TRUNCATE ممنوع
--
--  چرا: مهاجرتِ ۰۸۸ **شکلِ ردیفِ نوشته‌شده** را بست (`delta >= 0 OR reason IN
--  ('redemption','cashback')`). ولی موجودیِ امتیاز یک ستون نیست — `loyalty.ts` آن را
--  `SUM(delta)` می‌گیرد. رد تیم (`rezv-b5`، RT-22) روی DBِ زنده اندازه گرفت، با کنترلِ
--  مثبتی که نشان می‌داد CHECKِ ۰۸۸ واقعاً شلیک می‌کند:
--
--      DELETE FROM points_ledger WHERE created_at < now() - INTERVAL '1 year' AND delta > 0;   → موجودی ۱۷۵ → ۲۵
--      UPDATE points_ledger SET delta = 0 WHERE created_at < now() - INTERVAL '1 year';        → موجودی ۱۷۵ → ۲۵
--
--  هر دو «انقضای سن‌محور»اند، هیچ‌کدام ردیفِ منفی نمی‌نویسند، پس نه اسکنِ متنیِ گارد
--  می‌بیندشان نه CHECKِ ۰۸۸. یعنی ۰۸۸ راهِ **جمعی** را بست و راهِ **تفریقی** باز ماند.
--
--  ── حکمِ Founder (FP-009) — و چرا این شکل، نه شکلِ ۰۸۲ ────────────────────
--  ۱. **FK روی `RESTRICT` می‌ماند و هیچ مسیرِ cascadeی ساخته نمی‌شود.** برگشت‌پذیری
--     نامتقارن است: افزودنِ cascade بعداً یک خط است، ولی ردیفی که cascade برده برنمی‌گردد.
--     و «حذفِ کاربر + ساختنِ دوباره» خودش همان حمله‌ی DELETE با لباسِ دیگر است.
--  ۲. **DELETE بی‌قید و شرط رد می‌شود.** الگوی ۰۸۲ (`reservation_events`) یک استثنا دارد:
--     «اگر والد رفته، اجازه بده». آن‌جا درست است، این‌جا وارونه می‌شود — رد تیم دقیق گفت:
--     پاسخِ گارد به «این ردیف را پاک کنم؟» می‌شود «بله، اگر کاربرش قبلاً رفته باشد»، و
--     آن‌وقت یک خط `ON DELETE CASCADE` به‌اضافه‌ی یک `DELETE FROM users` کلِ ردِ مالی را
--     می‌برد در حالی که گارد **تأییدش** می‌کند. ردِ مالی نباید اثرِ جانبیِ حذفِ سوژه‌اش باشد.
--  ۳. **TRUNCATE جدا لازم است:** تریگرِ سطحِ‌ردیف روی `TRUNCATE` **اصلاً شلیک نمی‌کند**؛
--     حذفِ انبوه بدونِ نوشتنِ هیچ ردیفِ منفی دقیقاً همان کلاسِ RT-18 است.
--  ۴. **هیچ درِ فرارِ تستی.** پاک‌سازیِ تست‌ها بازنویسی می‌شود (کاربرِ تازه به‌ازای هر تست)،
--     نه اینکه قاعده‌ی دادهٔ تولید برای راحتیِ تست شل شود.
--
--  ── مرزِ صادقانه‌ی این گارد (اندازه‌گیری‌شده، نه حدس) ─────────────────────
--  `SET LOCAL session_replication_role = replica` **همه‌ی تریگرهای کاربر را خاموش می‌کند**
--  و نقشِ اتصالِ اپ مالکِ دیتابیس است. اندازه‌گیریِ همین نشست روی DBِ تست:
--      A) نشستِ عادی، `UPDATE … SET delta = 0` → ERROR (همین تریگر)
--      B) همان UPDATE پس از `session_replication_role = replica` → `UPDATE 1`
--  پس این تریگرها **کدِ اپ و مهاجرت‌های عادی** را می‌بندند، نه کسی را که عمداً نقشِ
--  replication را عوض کند یا تریگر را DROP کند. آن کار دیگر «نوشتنِ طبیعیِ کد» نیست.
--  (پروبِ RT-22ِ رد تیم همین خط را داشت — برای ردکردنِ FK — پس روی ۰۸۹ چیزی ثابت نمی‌کند؛
--  پروبِ درست `probe-rt24-089-triggers.sql` است که بدونِ آن خط اجرا می‌شود.)
--
--  ⚠️ آنچه این مهاجرت **نمی‌بندد**: برچسبِ دروغ — ردیفِ منفیِ تازه با
--  `reason = 'redemption'` از CHECKِ ۰۸۸ و از این تریگرها هر دو رد می‌شود.
--
--  ⚠️ اندازه‌گیریِ پیش از نوشتن: در `api/src` هیچ کدی ردیفِ دفتر را update/delete نمی‌کند
--  (کنترلِ مثبت: `pointsLedger.create` سه بار در loyalty.ts پیدا می‌شود). تنها FKِ این
--  جدول `user_id` است (`confdeltype='r'`) — هیچ FKی از رستوران به دفتر نیست، پس حذفِ
--  رستوران در تست‌ها به این تریگرها نمی‌خورد.
--
--  idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION points_ledger_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'points_ledger فقط-افزودنی است: بازنویسیِ ردیفِ امتیاز (مثلاً صفرکردنِ delta) موجودی را بی‌ردِ حسابرسی کم می‌کند'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION points_ledger_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- بی‌قید و شرط، و عمداً بدونِ استثنای «والد رفته» (FP-009 §۲).
  RAISE EXCEPTION
    'حذف از points_ledger مجاز نیست: ردِ مالی فقط افزوده می‌شود — برای پاک‌کردنِ هویت، کاربر را ناشناس کن نه دفتر را'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION points_ledger_no_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'TRUNCATE روی points_ledger مجاز نیست: حذفِ انبوهِ دفتر همان انقضای سن‌محور است بدونِ نوشتنِ هیچ ردیفی'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS points_ledger_no_update ON points_ledger;
CREATE TRIGGER points_ledger_no_update
  BEFORE UPDATE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION points_ledger_no_update();

DROP TRIGGER IF EXISTS points_ledger_no_delete ON points_ledger;
CREATE TRIGGER points_ledger_no_delete
  BEFORE DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION points_ledger_no_delete();

-- ⚠️ statement-level و نه FOR EACH ROW: تریگرِ سطحِ‌ردیف روی TRUNCATE شلیک نمی‌کند.
DROP TRIGGER IF EXISTS points_ledger_no_truncate ON points_ledger;
CREATE TRIGGER points_ledger_no_truncate
  BEFORE TRUNCATE ON points_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION points_ledger_no_truncate();
