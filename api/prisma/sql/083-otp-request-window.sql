-- ═══════════════════════════════════════════════════════════════════════
--  083 — پنجره‌ی درخواستِ OTP در Postgres، نه Redis  (E-003، تصمیمِ مالک ۲۰۲۶-۰۹-۰۹)
--
--  چرا این جدول وجود دارد:
--  سقفِ «هر شماره چند بار می‌تواند کد بگیرد» تا امروز در Redis بود
--  (`RULES.otpPerPhone`). یک خطای **گذرای** Redis آن را از صفر شروع می‌کرد،
--  چون `rateLimitWithFallback` به `rateLimitInMemory` می‌افتد و آن نقشه‌ی
--  جداگانه‌ای دارد که کلید را ندیده. اثباتِ اجراشده (max=3):
--
--      ۱ allowed r=2 · ۲ allowed r=1 · ۳ allowed r=0 · ۴ allowed r=2 ← باید رد می‌شد
--
--  گزینه‌های روی میز، و اینکه چرا این یکی انتخاب شد: «fail-closed هنگام قطعی»
--  ورودِ همه‌ی کاربران را قطع می‌کرد و **چیزی می‌خرید که از قبل داریم** — سقفِ
--  حدسِ کد (`otp_codes.attempts >= 5`) از قبل در Postgres است و به Redis کاری
--  ندارد. پس به‌جای انتخابِ یک تبادل، خودِ وابستگی حذف شد.
--
--  ⚠️ چرا جدولِ جدا و نه ستون روی `otp_codes`:
--  `verifyOtp` در ورودِ موفق ردیفِ `otp_codes` را **حذف می‌کند**، و `requestOtp`
--  هر بار با upsert بازنویسی‌اش می‌کند. یک شمارنده‌ی ضدِ اسپم که با هر ورودِ
--  موفق صفر شود، شمارنده‌ی ضدِ اسپم نیست. عمرِ این دو داده فرق دارد: یکی یک
--  اعتبارنامه‌ی دودقیقه‌ای است، دیگری یک پنجره‌ی نرخ.
--
--  ⚠️ رشدِ ردیف‌ها: یک ردیف به‌ازای هر شماره‌ای که تا به حال کد خواسته. هرس
--  در `maintenance/retention` انجام می‌شود (همان‌جا که کلیدهای idempotency هرس
--  می‌شوند)؛ ایندکسِ زیر برای همان است. بدونِ هرس این یک نشتیِ آرام است، پس
--  اگر کسی هرس را برداشت، این کامنت را هم بردارد.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otp_request_windows (
  phone             TEXT         PRIMARY KEY,
  request_count     INTEGER      NOT NULL DEFAULT 0,
  window_started_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_request_windows_window_started_at_idx
  ON otp_request_windows (window_started_at);

COMMENT ON TABLE otp_request_windows IS
  'پنجره‌ی نرخِ درخواستِ OTP به‌ازای شماره. عمداً در Postgres و نه Redis (E-003): یک خطای گذرای Redis سقف را ریست می‌کرد.';
COMMENT ON COLUMN otp_request_windows.request_count IS
  'تعدادِ درخواست در پنجره‌ی جاری. رشدش سقفِ مجاز + ۱ متوقف می‌شود تا کوبیدنِ مداوم پنجره را برای کاربرِ واقعی طولانی نکند.';
