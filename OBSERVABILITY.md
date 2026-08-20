# رزرونو — راهنمای Observability (مانیتورینگ سازمانی)

این سند لایه‌ی observability اضافه‌شده را توضیح می‌دهد: لاگ متمرکز، متریک،
tracing، Prometheus، Grafana، Sentry، health، audit log، و مانیتورینگ امنیتی.

---

## ۱. معماری کلی

```
  ┌─────────────┐   لاگ JSON     ┌──────────────┐
  │  API pods   │───────────────▶│ Loki/Datadog │  (لاگ متمرکز)
  │             │                └──────────────┘
  │  /api/      │   pull scrape  ┌──────────────┐   ┌──────────┐
  │  metrics    │◀───────────────│  Prometheus  │──▶│ Grafana  │
  │             │                └──────────────┘   └──────────┘
  │  errors     │   POST         ┌──────────────┐
  │             │───────────────▶│   Sentry     │  (ردیابی خطا)
  └─────────────┘                └──────────────┘
        │ trace-id در همه‌ی لاگ‌ها و پاسخ‌ها propagate می‌شود
```

---

## ۲. Centralized Logging (لاگ متمرکز)

`lib/logger.ts` در **production خروجی JSON خطی** می‌دهد (هر خط یک رکورد):
```json
{"ts":"2026-06-24T...","level":"error","scope":"reservations","msg":"...","traceId":"a1b2...","meta":{...}}
```
این فرمت توسط Loki، Datadog، CloudWatch، یا هر log aggregator دیگری
parse می‌شود. در development خروجی خوانا برای انسان است.

سطح لاگ با `LOG_LEVEL` کنترل می‌شود (debug/info/warn/error؛ پیش‌فرض info در prod).

---

## ۳. Tracing (ردیابی)

هر درخواست یک `trace-id` می‌گیرد (در middleware تولید، در هدر `x-trace-id`
برگردانده می‌شود). این شناسه با `AsyncLocalStorage` در سرتاسر پردازش درخواست
propagate می‌شود، پس **همه‌ی لاگ‌های یک درخواست با هم traceId مشترک دارند**.

برای دیباگ: وقتی کاربر خطایی گزارش می‌دهد، traceId را از پاسخ بگیر و همه‌ی
لاگ‌های آن درخواست را با همان id فیلتر کن.

> ارتقای آینده: برای tracing توزیع‌شده‌ی کامل (بین سرویس‌ها)، می‌توان
> OpenTelemetry SDK اضافه کرد و traceId را به فرمت W3C traceparent تبدیل کرد.
> ساختار فعلی (16 بایت هگز) از قبل سازگار است.

---

## ۴. Metrics + Prometheus

`lib/metrics.ts` یک رجیستری سبک سازگار با Prometheus است. endpoint:
**`GET /api/metrics`** (فرمت متنی Prometheus).

متریک‌های کلیدی:
| متریک | نوع | معنی |
|---|---|---|
| `rezervno_http_requests_total` | counter | کل درخواست‌ها (با label: method/route/status) |
| `rezervno_http_errors_total` | counter | پاسخ‌های ۴xx/۵xx |
| `rezervno_http_request_duration_seconds` | histogram | توزیع latency (برای P50/P95/P99) |
| `rezervno_reservations_created_total` | counter | رزروهای موفق |
| `rezervno_reservation_conflicts_total` | counter | تداخل‌های جلوگیری‌شده (double-booking) |
| `rezervno_sms_queue_depth` | gauge | طول صف SMS |
| `rezervno_sms_sent_total` | counter | پیامک‌های ارسال‌شده (با label: template) |
| `rezervno_auth_failures_total` | counter | شکست احراز هویت (سیگنال امنیتی) |
| `rezervno_rate_limit_hits_total` | counter | فعال‌شدن rate-limit |
| `rezervno_active_requests` | gauge | درخواست‌های در حال پردازش |

امنیت: اگر `METRICS_TOKEN` تنظیم شود، endpoint نیاز به `Authorization: Bearer`
دارد. در k8s معمولاً فقط در شبکه‌ی داخلی scrape می‌شود.

**نکته‌ی مقیاس:** رجیستری per-instance است. Prometheus هر pod را جدا scrape
می‌کند و جمع‌بندی با PromQL (`sum(rate(...))`) سمت Prometheus انجام می‌شود.

---

## ۵. Grafana

استک observability به‌صورت overlay جدا:
```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin / `GRAFANA_PASSWORD`)

داشبورد **«رزرونو — عملکرد و امنیت»** از قبل provision شده: نرخ درخواست،
نرخ خطا، latency (P50/P95/P99)، رزرو vs تداخل، سیگنال‌های امنیتی، طول صف SMS.

---

## ۶. Sentry (ردیابی خطا)

اگر `SENTRY_DSN` تنظیم شود، همه‌ی لاگ‌های `error` و `warn` به‌صورت
fire-and-forget به Sentry فرستاده می‌شوند (با traceId و scope به‌عنوان tag).
بدون SDK سنگین — ارسال مستقیم به Sentry Store API.

اگر DSN تنظیم نباشد، چیزی فرستاده نمی‌شود (degrade تمیز). sink هرگز مسیر
اصلی را نمی‌شکند.

---

## ۷. Health Endpoints

**`GET /api/health`** — سلامت واقعی (نه سطحی):
- اتصال DB و Redis را با timeout چک می‌کند.
- اگر هر کدام قطع باشند، **۵۰۳** برمی‌گرداند (نه ۲۰۰) تا load balancer/k8s
  pod ناسالم را از چرخه خارج کند.
```json
{ "status": "ok|degraded", "checks": { "db": "ok", "redis": "ok" }, "time": "..." }
```
این برای readiness/liveness probe در k8s و health-check در load balancer است.

---

## ۸. Audit Logs

دو لایه audit:
1. **`ReservationEvent`** (موجود) — audit دامنه‌ی رزرو: هر تغییر وضعیت، چه‌کسی/
   کِی/چرا/خودکار.
2. **`AuditLog`** (جدید، `lib/audit.ts`) — رویدادهای امنیتی/حاکمیتی برای
   compliance: ورود، شکست احراز هویت، تغییر دسترسی کارکنان، استفاده از کارت
   هدیه/کوپن، تلاش IDOR، و غیره.

جدول `audit_logs` با traceId، actor، target، ip، و detail (JSONB) — قابل‌جستجو
برای تحقیقات. migration: `prisma/sql/008-audit-logs.sql`
(تست‌شده روی PostgreSQL واقعی). هر رویداد هم در DB ماندگار می‌شود هم لاگ
ساختاریافته (برای alerting بلادرنگ).

استفاده:
```ts
import { audit } from '@/lib/audit';
await audit({ action: 'staff.permission_change', actorId, targetId, restaurantId, detail: {...} });
```

---

## ۹. Performance Monitoring

- **latency:** histogram `rezervno_http_request_duration_seconds` → P95/P99 در Grafana.
- **throughput:** `rate(rezervno_http_requests_total[1m])`.
- **active requests:** gauge بلادرنگ.
- این‌ها هدف‌های latency پروژه (<۱۵۰ms، P95<۲۵۰ms) را قابل‌اندازه‌گیری می‌کنند —
  بعد از deploy می‌توان واقعاً تأیید کرد (که در محیط توسعه ممکن نبود).

---

## ۱۰. Security Monitoring

سیگنال‌های امنیتی به‌صورت متریک + audit:
- `rezervno_auth_failures_total` — جهش ناگهانی = حمله‌ی brute-force احتمالی.
- `rezervno_rate_limit_hits_total` — جهش = ترافیک مخرب احتمالی.
- `AuditLog` با action `security.idor_attempt` / `auth.failure` — برای تحقیق.

**Alerting پیشنهادی** (در Prometheus Alertmanager یا Grafana):
- نرخ خطای ۵xx > ۱٪ برای ۵ دقیقه.
- شکست احراز هویت > ۱۰۰/دقیقه (brute-force).
- طول صف SMS > ۵۰۰۰ (worker از کار افتاده).
- P95 latency > ۵۰۰ms برای ۵ دقیقه.
- health endpoint = degraded.

(قوانین alert عمداً اینجا hard-code نشده‌اند چون به آستانه‌های واقعی production
بستگی دارند که باید بعد از مشاهده‌ی baseline تنظیم شوند.)

---

## ۱۱. وضعیت و محدودیت‌های صادقانه

- لایه‌ی metrics/logging/tracing/audit **type-check شده** و migration روی
  PostgreSQL واقعی تست شد.
- متریک‌های HTTP فعلاً فقط در route handlerهایی که از `withRestaurantAuth`/
  `withStaffAuth` استفاده می‌کنند ثبت می‌شوند. ۱۰ route قدیمی فاز ۱ که هنوز
  به wrapper مهاجرت نکرده‌اند، در متریک‌های HTTP شمرده نمی‌شوند (همان بدهی
  فنی شناخته‌شده — با مهاجرت آن routeها خودکار پوشش داده می‌شوند).
- رجیستری metrics in-memory است (مناسب pull-based Prometheus). برای persistence
  بین restart نیازی نیست (Prometheus خودش tsdb دارد).
- اتصال واقعی به Sentry/Grafana نیاز به اجرای استک و تنظیم env دارد که در این
  محیط (بدون شبکه/Docker) اجرا نشد — فقط پیکربندی و کد آماده است.
