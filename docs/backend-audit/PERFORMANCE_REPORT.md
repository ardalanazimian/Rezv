# PERFORMANCE_REPORT — رزرونو

> ممیزیِ کاراییِ بک‌اند (استاتیک، مبتنی بر کد). تاریخ: ۲۰۲۶-۰۷-۲۹.
> ⚠️ این ممیزی **runtime/load-test اجرا نکرده**؛ ادعاهای عددی (latency واقعی) نیازمندِ اجرای
> تست‌های k6 روی محیطِ شبیهِ production‌اند. یافته‌ها ساختاری‌اند.
>
> ⚠️ **اصلاح‌شده (۲۰۲۶-۰۸-۲۰):** اینجا قبلاً `tests/load/reservation.js` نوشته بود که
> **وجود ندارد** — هر کسی می‌خواست این ممیزی را با عدد پشتیبانی کند به بن‌بست می‌خورد.
> فایل‌های واقعیِ k6 اینجا هستند: `loadtest/k6-load-test.js`،
> `loadtest/k6-scale-400k.js`، `loadtest/k6-security-probe.js` (رجوع کن به `loadtest/README.md`).

---

## ۰) خلاصه

زیرساختِ کارایی **بالغ** است: connection-pooling، read-replica routing، کشِ Redis، متریکِ latency
روی هر کوئری، و صفِ async برای کارهای سنگین. گلوگاه‌های بالقوه در مقیاسِ خیلی بالا مشخص و مستندند.

**نمره‌ی کارایی (ساختاری): ۸.۳ / ۱۰**

## ۱) دیتابیس
- **Pooling**: `connection_limit`/`pool_timeout` قابلِ‌تنظیم؛ راهنمای pgbouncer transaction-mode در `.env.example`.
- **Read/Write splitting**: `dbRead` برای خواندنِ سنگین (داشبورد/گزارش/لیست)، `db` برای نوشتن؛ هشدارِ
  replication-lag مستند (read-after-write از primary). ✅
- **Index**: ۵۳ `@@index` + مهاجرتِ `001-performance-indexes`. **پیشنهاد:** `EXPLAIN ANALYZE` تجربی.
- **partitioning** رزرو → کاراییِ درج/کوئریِ جدولِ پرترافیک.

## ۲) کش
- `lib/cache.ts` (`cached(key, ttl, fn)`) روی داده‌ی عمومی (نمونه: `events` با TTL=120s).
- `availability-cache` + invalidate پس از رزرو → کاهشِ بارِ محاسبه‌ی availability.
- **پیشنهاد (متوسط):** پوششِ کش روی مسیرهای پرخوانشِ کشف (لیست رستوران‌ها/آنالیتیکس) بازبینی و
  نرخِ hit با متریک پایش شود.

## ۳) Async / صف
- `lib/queue.ts` (Postgres + FOR UPDATE SKIP LOCKED) برای SMS/notify/کارهای سنگین → مسیرِ درخواست سبک می‌ماند.
- **گلوگاهِ مقیاس (متوسط→بالا):** صفِ مبتنی بر Postgres polling در نرخِ خیلی بالا (ده‌ها-هزار job/دقیقه)
  فشارِ DB می‌آورد. برای مقیاسِ >۱۰۰k کاربرِ همزمان، مهاجرت به broker اختصاصی (BullMQ/Redis Streams یا
  Kafka) توصیه می‌شود. (اکنون over-engineering نیست چون مقیاس فعلی کوچک‌تر است.)

## ۴) مسیرِ رزرو (حساس‌ترین)
- قفلِ Redis (بهینه‌سازی) + Serializable + retry (۵ بار) + EXCLUDE constraint.
- **ترید-آف:** isolation=Serializable در ترافیکِ خیلی بالا روی یک اسلات → نرخِ retry بالا. قفلِ Redis این
  را کاهش می‌دهد. برای «فروشِ لحظه‌ایِ» یک اسلاتِ داغ (مثلِ رویدادِ ویژه)، صف‌بندیِ درخواست توصیه می‌شود.

## ۵) Observability کارایی
- `metrics.dbDuration` روی هر کوئری، `recordHttp` (متد/route/status/مدت)، `activeRequests`. ✅
- endpointِ `/api/metrics` (Prometheus-style) با token اختیاری. ✅

## ۶) یافته‌های اولویت‌دار
| # | یافته | شدت | پیشنهاد |
|---|-------|-----|---------|
| P1 | صفِ Postgres در مقیاسِ خیلی بالا گلوگاه | متوسط→بالا (فقط >۱۰۰k) | broker اختصاصی |
| P2 | نبودِ load-test اجراشده در این ممیزی | متوسط | اجرای k6 (`tests/load`) |
| P3 | نرخِ retry رزرو روی اسلاتِ داغ | متوسط | صف‌بندیِ اسلاتِ داغ |
| P4 | پایشِ نرخِ hit کش | پایین | متریکِ cache-hit |
