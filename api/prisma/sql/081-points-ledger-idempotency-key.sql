-- ═══════════════════════════════════════════════════════════════════════
-- ۰۸۱ — کلیدِ صریحِ idempotency روی دفترِ امتیاز (points_ledger)
--
-- زمینه: فازِ ۱ (پروتکل §۱۳) — «PHASE1-LEDGER-EVIDENCE» — نشان داد ledger
-- هیچ‌وقت `@@unique` نداشته و idempotencyِ اعطای امتیاز فقط از یک
-- compare-and-setِ اپلیکیشنی در lifecycle.ts می‌آید (تنها نویسنده). آن
-- CAS با تستِ واقعی اثبات شد که درست کار می‌کند — این migration ضامنِ
-- ساختاری/دومِ سطحِ DB را اضافه می‌کند تا هر نویسنده‌ی آینده هم (نه فقط
-- مسیرِ امروزِ چک‌این) از دوباره‌نویسی محافظت شود.
--
-- تصمیمِ مالک (۲۰۲۶-۰۹-۰۹): کلیدِ صریح، نه کلیدِ طبیعیِ
-- (user_id, restaurant_id, reason, note). دلیل: `note` متنِ آزادِ فارسی
-- است (مثلاً `کش‌بک رزرو ${code}` — reservations.ts:616)؛ یکتاییِ متکی به
-- متنی که هرکسی می‌تواند بی‌خبر ویرایش کند، همان کلاسِ نقصِ کلیدهایِ
-- override XSS است که به متنِ expression گره خورده بودند.
--
-- چرا nullable: هر نویسنده‌ای که رویدادش می‌تواند تکرار شود (retry، race،
-- cron دوباره) کلیدِ پایدار می‌سازد. نوشتنِ دستیِ/ادمینِ یک‌بارمصرف
-- (مثلاً `reason='adjustment'`) می‌تواند null بگذارد — هر فراخوانیِ آن
-- عمداً مستقل است، نه تکرارِ یک رویدادِ قبلی. ایندکسِ یکتا partial است
-- (`WHERE idempotency_key IS NOT NULL`) پس NULLهایِ متعدد تداخل نمی‌سازند.
--
-- چرا نیازی به backfill نیست: ستون تازه است و همه‌ی ردیف‌هایِ موجود پیش از
-- این migration به‌طورِ طبیعی NULL می‌گیرند؛ چون قید فقط رویِ NOT NULL اعمال
-- می‌شود، هیچ ردیفِ تاریخی با قید تداخل نمی‌کند و migration رویِ دیتایِ
-- واقعی/کثیف هم بدونِ dedup/reconciliationِ اضافه امن است.
--
-- ⚠️ Prisma ایندکسِ جزئی (WHERE) را در schema نمی‌تواند بیان کند؛ طبقِ
-- الگوی مصوبِ گاردِ drift (schema-drift.integration.test.mts، همان الگویِ
-- 079/staff_owner_phone_unique_idx) این ایندکس در فهرستِ required و
-- DROPش در ACCEPTED_DRIFT ثبت شده. در schema.prisma فقط با کامنت روی مدلِ
-- PointsLedger مستند است.
--
-- اثباتِ falsifiability (ثبت‌شده در docs/audit/reports/PHASE1-LEDGER-EVIDENCE.md):
-- حذفِ موقتِ همین ایندکس → insertِ دوم با همان کلید موفق می‌شود (قرمز) →
-- بازگردانی → insertِ دوم P2002 می‌گیرد (سبز).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_idempotency_key_uidx
  ON points_ledger (idempotency_key) WHERE idempotency_key IS NOT NULL;
