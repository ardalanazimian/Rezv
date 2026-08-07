# CHANGELOG — فاز سازمانی (Observability, Queue, CRM, Security, Checkout)

کارهای انجام‌شده پس از فاز v2. همه‌ی الگوهای دیتابیسی روی **PostgreSQL 17 واقعی
(Supabase)** تست شده؛ منطق با `tsc` type-check شده. صادقانه: «تست‌شده روی DB» با
«end-to-end HTTP تست‌شده» فرق دارد — مورد دوم نیاز به سرور بالا‌آمده دارد.

---

## ۱. Observability
- `lib/logger.ts` — JSON خطی + tracing (AsyncLocalStorage) + Sentry sink
- `lib/metrics.ts` + `app/api/metrics` — رجیستری سبک Prometheus، ۱۳ متریک
- `lib/audit.ts` + `008-audit-logs.sql` — audit عمومی (تست‌شده روی DB)
- `observability/` + `docker-compose.observability.yml` + `alerts.yml` — Grafana stack
- trace-id در middleware و wrapper. سند: `OBSERVABILITY.md`

## ۲. صف Job (Postgres FOR UPDATE SKIP LOCKED)
- `lib/queue.ts` + `lib/worker.ts` + `maintenance/jobs-drain` + `009-jobs-queue.sql`
- priority، retry+backoff نمایی، DLQ، idempotency — **همه روی DB تست‌شده**
- انواع: sms/email/push/webhook کامل؛ report/image اسکلت. سند: `QUEUE.md`

## ۳. CRM (RFM + GuestProfile سراسری)
- `lib/rfm.ts` — RFM با ntile صدکی، ۷ سگمنت (تست‌شده روی DB)
- `lib/guest-profile.ts` — نمای cross-restaurant (کلید فقط userId، تست‌شده)
- API: `restaurant/rfm` + `me/profile`. migration `012`
- فیلدهای جدید: rScore/fScore/mScore/rfmSegment + جدول guest_profiles
- باقی‌مانده: favorite categories، preferred time/party، retention، upsell

## ۴. Hardening امنیتی
- `lib/idempotency.ts` — Idempotency-Key ضد double-submit رزرو
- OTP ۶ رقمی؛ `lib/fraud.ts` (۳ الگو) + `restaurant/fraud-signals`
- `lib/events.ts` — event bus + webhook خروجی (HMAC)
- `maintenance/retention` — پاک‌سازی jobs/idempotency/audit
- **مهاجرت ۶ route به wrapper → صفر route بدون wrapper.** migration `010`

## ۵. رفع باگ‌های پول (ممیزی دوم) — همه روی DB تست‌شده
| کد | مشکل | رفع |
|---|---|---|
| NEW-C1 | کارت هدیه منفی → ساخت پول | چک amount<=0 |
| NEW-C2 | کوپن درصدی بی‌سقف → قیمت منفی | Math.min با subtotal |
| NEW-H1 | TOCTOU کوپن | UPDATE...WHERE...RETURNING اتمیک |
| NEW-H2 | پاداش معرف دوگانه | updateMany گارد‌دار |
| NEW-M1 | پاداش تولد دوگانه multi-worker | unique index (user,reason,year) |
migration `013`

## ۶. اتصال Checkout (کوپن/کارت هدیه/کش‌بک)
- فقط یکی (کوپن یا کارت)؛ کارت با مبلغ دلخواه + FOR UPDATE؛ کش‌بک روی مبلغ بعد از تخفیف
- **تست زنده:** ۱۰۰هزار → کوپن ۲۰٪ → ۸۰هزار → کش‌بک ۵٪ = ۴۰۰۰ امتیاز ✓
- ۲ باگ حین اتصال رفع: enum cashback، نام فیلدهای GiftCard
- پاسخ رزرو حالا `checkout: {subtotal, discount, final, cashback, method}` دارد

## ۷. DevOps
- `.github/workflows/ci.yml` (build/test/security) — نوشته‌شده، روی GitHub اجرا نشده
- `tests/enterprise-logic.test.mjs` (۱۶ تست، واقعاً اجرا شد). کل ۳۴ تست پاس

## مقیاس (data-layer)
- partitioning reservations `011` + `ensure-partitions` — pruning + EXCLUDE per-partition تست‌شده
- stale-while-revalidate availability (ضد thundering herd). سند: `SCALING.md`

## ⚠️ launch-blockerهای باقی‌مانده (خارج از محیط کد) — در تاریخِ این حکم
1. `0_init/migration.sql` نیست → migrate deploy جدول نمی‌سازد
2. هیچ build واقعی (فقط tsc)
3. package-lock.json نیست
4. دیتابیس production خالی
5. HA/multi-AZ/failover مستقر نیست
6. partitioning اجرا نشده (راهنما)
7. load/restore/pentest اجرا نشده

**حکم CTO (در آن تاریخ): NO GO** — نه به‌خاطر کیفیت کد (بالاست)، بلکه فاصله‌ی «کد آماده» تا
«سرویس زنده» که با زیرساخت واقعی پر می‌شود، نه از این محیط.

---

## به‌روزرسانیِ ۲۰۲۶-۰۸-۰۷ — بلاکرهایِ بالا: کدام رفع شد، کدام هنوز زیرساخت است

از موارد بالا، این‌ها دیگر صادق نیستند (تأییدشده با اجرایِ واقعی این نشست):
- **#1 و #3:** `0_init` + `apply-sql.sh` + `package-lock.json` هرسه الان وجود دارند و
  روی یک DBِ کاملاً خالی تست شدند (seed کاملِ موفق). این ادعا از یک دوره‌ی خیلی
  قدیمی‌ترِ ریپو مانده بود.
- بقیه (#2، #4-۷) هنوز واقعاً زیرساخت‌اند و از داخلِ این محیط قابلِ‌تأیید نیستند.

**علاوه‌بر این، برایِ اولین‌بار Postgres+Redisِ واقعی (نه فرض) روی سندباکس بالا
آمد** و کلِ زنجیره‌ی migration+seed+کدِ جدید با HTTP/مرورگرِ واقعی تست شد —
۷ باگِ واقعی که فقط با اجرایِ واقعی قابلِ‌کشف بودند پیدا و رفع شد (شاملِ یک
کرشِ تولیدیِ جدی در مدلِ no-show، و یک باگِ ناسازگاریِ چندشعبه‌ای). فهرستِ کامل
با فایل/شدت/کامیت در `LAUNCH-GAPS.md` بخشِ «اصلاح‌شده در نشستِ ۲۰۲۶-۰۸-۰۷».
PRهایِ مرتبط: #4، #5 (مرج‌شده روی `main`).
