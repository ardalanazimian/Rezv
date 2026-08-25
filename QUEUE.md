# رزرونو — سیستم صف Job (Background Processing)

انتقال پردازش‌های سنگین/کند به پس‌زمینه با صف مبتنی بر Postgres.
الگوی `FOR UPDATE SKIP LOCKED` — **تست‌شده روی PostgreSQL 17 واقعی**.

---

## چرا Postgres، نه Redis/SQS/RabbitMQ؟

دیتابیس از قبل هست. این الگو همه‌ی نیازها را بدون سرویس سوم می‌دهد، و
مهم‌تر: **idempotency و claim اتمیک در همان تراکنش دیتابیس** تضمین می‌شوند.
برای مقیاس فعلی، افزودن یک سرویس صف جدا (و بار عملیاتی‌اش) توجیه ندارد.

> اگر بعداً به throughput خیلی بالا رسیدی (ده‌ها هزار job در ثانیه)، می‌توان
> به BullMQ (روی Redis) یا یک صف اختصاصی مهاجرت کرد. رابط `enqueue()` ثابت
> می‌ماند و فقط پیاده‌سازی عوض می‌شود.

---

## معماری

```
  کد برنامه                صف (جدول jobs)              Worker (cron هر دقیقه)
  ──────────               ──────────────              ────────────────────
  enqueue({kind,           [pending jobs                claimJobs(50)
    payload,                 sorted by                   ↓ FOR UPDATE SKIP LOCKED
    priority,                priority]                   handler[kind](payload)
    idempotencyKey})  ────▶                       ◀──── ↓
                                                         موفق → completeJob
                                                         شکست → failJob
                                                           ├ attempt<max → pending + backoff
                                                           └ attempt≥max → dead (DLQ)
```

---

## انواع Job و اولویت پیش‌فرض

| kind | priority | توضیح |
|---|---|---|
| `sms` | 2 | اعلان حساس به زمان (یادآوری، آفر لیست انتظار) |
| `push` | 3 | اعلان Push |
| `webhook` | 4 | تحویلِ webhookِ ادغامِ شخصِ‌ثالث (POS/حسابداری) — ⚠️ این ردیف قبلاً از این جدول جا افتاده بود؛ `handler`ش واقعی و فعاله (`deliverWebhook`، از `events.ts` صدا زده می‌شه)، اضافه‌شده در live-checkِ ۲۰۲۶-۰۸-۱۲ |
| `email` | 5 | ایمیل |
| `image` | 6 | پردازش تصویر (اسکلت — handler آماده‌ی پرکردن؛ تأییدشده هنوز در `worker.ts` handler نداره) |
| `report` | 8 | گزارش سنگین (اسکلت — handler آماده‌ی پرکردن؛ تأییدشده هنوز در `worker.ts` handler نداره) |

(۱=بالاترین اولویت ... ۹=پایین‌ترین. هنگام enqueue قابل override.)

**استثنا — OTP:** کد ورود همزمان فرستاده می‌شود (کاربر منتظر است)، نه از صف.

---

## قابلیت‌ها (همه تست‌شده روی PG واقعی)

### ۱. Priority
claim به ترتیب `priority ASC, run_after ASC`. تست شد: با کارهای مختلط،
SMS (p2) قبل از email (p5) قبل از report (p8) claim شد.

### ۲. Idempotency
`idempotencyKey` با ایندکس یکتا. اگر کاری با همان کلید enqueue شود،
کار جدید ساخته نمی‌شود (`deduped: true` برمی‌گردد). تست شد: دو insert با
یک کلید → فقط یک ردیف.

مثال کاربرد: «ایمیل تأیید رزرو X» با کلید `reservation-X-confirm` — حتی اگر
کد دوبار صدا شود، فقط یک ایمیل.

### ۳. Retry + Exponential Backoff
شکست → `pending` با `run_after = now() + 2^attempts ثانیه` (سقف ۱ ساعت).
تست شد: کار شکست‌خورده با backoff ۲ ثانیه‌ای به pending برگشت.

### ۴. Dead Letter Queue (DLQ)
بعد از `max_attempts` (پیش‌فرض ۵)، کار → `status='dead'`. دیگر claim نمی‌شود،
برای تحقیق می‌ماند. تست شد: کار در max attempts → dead.

### ۵. SKIP LOCKED — موازی‌سازی امن
`FOR UPDATE SKIP LOCKED` تضمین می‌کند چند worker موازی هیچ‌وقت یک کار را
دوبار پردازش نکنند. پس می‌توان چند pod/worker همزمان اجرا کرد.

### ۶. Worker Monitoring
- `getQueueStats()` — شمارش بر اساس kind/status.
- متریک‌های Prometheus: `rezervno_jobs_pending`، `rezervno_jobs_dead`،
  `rezervno_jobs_processed_total{kind,outcome}`.
- در داشبورد Grafana قابل‌مشاهده.

---

## استفاده

```ts
import { enqueue } from '@/lib/queue';

// SMS (از طریق enqueueSms موجود — خودکار به صف می‌رود)
// Email غیرفوری:
import { queueEmail } from '@/lib/notify';
await queueEmail('user@x.com', 'تأیید رزرو', body, 'reservation-123-confirm');

// مستقیم با کنترل کامل:
await enqueue({
  kind: 'report',
  payload: { restaurantId, month: '2026-06' },
  priority: 8,
  idempotencyKey: 'monthly-report-123-2026-06',  // فقط یک‌بار
  maxAttempts: 3,
  runAfter: new Date(Date.now() + 3600_000),       // یک ساعت دیگر
});
```

---

## Worker

- endpoint: `POST /api/v1/maintenance/jobs-drain` (با `x-maintenance-key`)
- cron: هر دقیقه (`* * * * * /run.sh jobs-drain`)
- هر اجرا تا ۵۰ job را پردازش می‌کند.
- stateless و موازی‌پذیر.

برای throughput بالاتر: یا cron را مکررتر کن، یا چند worker pod جدا اجرا کن
(SKIP LOCKED امن نگه‌شان می‌دارد)، یا `runWorker(max)` را با عدد بزرگ‌تر صدا بزن.

---

## وضعیت handlerها

- **sms, email, push:** کامل وصل‌اند (sms از طریق کاوه‌نگار؛ email/push اسکلت
  ارسال واقعی دارند که با تنظیم کلید provider فعال می‌شوند).
- **report, image:** **handler اسکلت است** — ساختار صف کامل و تست‌شده آماده
  است؛ فقط منطق واقعی تولید گزارش/پردازش تصویر را در `lib/worker.ts` (در
  `handlers.report` / `handlers.image`) پر کن. هیچ تغییر دیگری لازم نیست.

این صادقانه‌ترین حالت است: زیرساخت صف کامل و production-grade است، ولی منطق
report/image هنوز نوشته نشده چون به تصمیم‌های محصول (فرمت گزارش، ابعاد تصویر)
بستگی دارد.

---

## migration

`prisma/sql/009-jobs-queue.sql` — idempotent، تست‌شده روی
PostgreSQL واقعی. راه‌اندازی جدید با `prisma db push` خودکار است.

## نگه‌داری (retention)
برای جلوگیری از رشد بی‌نهایت جدول، توصیه: یک job دوره‌ای که `completed`های
قدیمی‌تر از چند روز را حذف و `dead`ها را آرشیو کند (مشابه الگوی فایل 002).
