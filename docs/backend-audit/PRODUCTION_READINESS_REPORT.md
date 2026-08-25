# PRODUCTION_READINESS_REPORT — رزرونو

> آمادگیِ تولید و مقیاس‌پذیری. مبتنی بر کد/پیکربندیِ واقعی. تاریخ: ۲۰۲۶-۰۷-۲۹.

---

## ۰) خلاصه

بک‌اند **از نظرِ ساختاری آماده‌ی تولید** است: health-check واقعی، graceful shutdown، Docker/entrypoint،
CI با typecheck/test/audit، متریک/tracing/logger، و رفعِ باگ‌های مقیاسِ مستند (H4 نشتِ اتصال، H11 idempotency).

**نمره‌ی آمادگیِ تولید: ۸.۴ / ۱۰**

## ۱) سلامت و چرخه‌ی حیات
- `GET /api/health`: پینگِ واقعیِ DB+Redis با timeout، `503` روی degraded (ارکستریتور pod را خارج می‌کند)؛ `HEAD` برای liveness. ✅
- graceful shutdown: بستنِ اتصال‌های DB روی SIGTERM/SIGINT/beforeExit. ✅
- `docker-entrypoint.sh` + `Dockerfile` + `vercel.json` + `next.config.js`. ✅

## ۲) پیکربندی و رازها
- `.env.example` کامل (۳۹ متغیر، مستند). fail-fast روی env حیاتیِ غایب (JWT secret، ALLOWED_ORIGINS). ✅
- **پیش از go-live (چک‌لیست):** تنظیمِ ALLOWED_ORIGINS، JWT_SECRET/REFRESH (≥۳۲)، REDIS_PASSWORD،
  MAINTENANCE_KEY/CRON_SECRET، DB pooler URL، METRICS_TOKEN، GRAFANA_PASSWORD، SENTRY_DSN.

## ۳) مقیاس‌پذیری (تخمینِ ساختاری)
| مقیاس همزمان | وضعیت | گلوگاهِ محتمل |
|--------------|-------|---------------|
| ۱۰۰ | آماده | — |
| ۱٬۰۰۰ | آماده | — |
| ۱۰٬۰۰۰ | آماده با pooler صحیح | سقفِ اتصالِ Postgres (نیازِ pgbouncer + connection_limit درست) |
| ۱۰۰٬۰۰۰ | نیازمندِ scale افقی + replica | صفِ Postgres، isolation رزرو، کشِ availability |
| ۱٬۰۰۰٬۰۰۰ | نیازمندِ بازطراحیِ بخش‌ها | broker اختصاصی، sharding/partition بیشتر، CDN/edge cache |

- **کلیدِ ۱۰k+**: singletonِ Prisma (رفعِ H4) + pooler الزامی است؛ بدونِ آن «too many connections».

## ۴) پایداری و بازیابی
- fail-open/fallback مستند در middleware/ratelimit؛ health واقعی؛ retry تراکنش.
- **یافته (متوسط):** استراتژیِ backup/restore و DR در کد نیست (وظیفه‌ی سطحِ زیرساخت/Supabase)؛ باید
  به‌صورت runbook مستند و آزمایش (restore-drill) شود.
- صف: dead-letter/retention از طریقِ `maintenance/retention` + `JobStatus`؛ drain با `jobs-drain`.

## ۵) CI/CD و کیفیت
- اسکریپت‌ها: `typecheck` (tsc)، `test` (tsx node:test)، `test:integration`، `test:e2e` (playwright)،
  `test:load` (k6)، `lint` (eslint)، `audit` (npm audit high). ✅
  ⚠️ تصحیحِ ۲۰۲۶-۰۸-۲۴: تیکِ `test:load` نادرست بود — مسیرش
  (`tests/load/reservation.js`) وجود نداشت و دستور اجرا نمی‌شد. اصلاح شد.
- **پیشنهاد:** اطمینان از اجرای `typecheck+test+audit` روی هر PRِ بک‌اند در CI (اگر هنوز نیست).

## ۶) Observability عملیاتی
- logger ساخت‌یافته با trace، متریکِ Prometheus، خطاها به Sentry (اختیاری).
- **یافته (متوسط):** alerting/on-call rules صریح نیست؛ باید قواعدِ هشدار (۵xx rate، DB down، صفِ عقب‌افتاده) تعریف شود.

## ۷) یافته‌های اولویت‌دار
| # | یافته | شدت | اقدام |
|---|-------|-----|-------|
| PR1 | DR/backup runbook + restore-drill | بالا (عملیاتی) | مستند + آزمایش |
| PR2 | alerting rules (SLO/SLA) | متوسط | Grafana/Sentry alerts |
| PR3 | تأییدِ اجرای گیت‌های بک‌اند در CI برای هر PR | متوسط | بازبینیِ workflow |
| PR4 | load-test پیش از go-live | متوسط | k6 روی staging |
