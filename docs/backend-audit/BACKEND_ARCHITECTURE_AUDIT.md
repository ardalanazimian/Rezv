<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۸۴ endpoint» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# BACKEND_ARCHITECTURE_AUDIT — رزرونو

> ممیزیِ ساختاریِ بک‌اند (`api/`). مبتنی بر **خواندنِ واقعیِ کد**، نه فرض.
> روش: خواندنِ کاملِ لایه‌ی زیرساخت/امنیت (middleware، jwt، permissions،
> with-restaurant-auth، db، idempotency، maintenance-auth، health، reservations core)
> + جاروبِ الگویی روی هر ۸۴ endpoint و ۴۸ ماژولِ lib. تاریخ: ۲۰۲۶-۰۷-۲۹.
>
> ⚠️ حوزه‌ی این پرامپت **فقط ممیزی و مستندسازی** است — هیچ کدِ بک‌اند تغییر داده نشد.

---

## ۰) خلاصه‌ی مدیریتی

بک‌اند رزرونو یک **Next.js 14 (App Router) + Prisma + PostgreSQL(Supabase) + Redis(ioredis) + JWT** است
که به‌صورت self-host با `next start` (Node runtime) اجرا می‌شود و به‌عنوان یک پروژه‌ی Vercel جدا
(Root Directory=api) هم دیپلوی می‌شود.

- **۸۴** فایلِ `route.ts` (endpoint)، **۴۸** ماژولِ `lib`، **۳۸** مدلِ Prisma، **۲۹** مهاجرتِ SQL دستی، **۹** فایلِ تست.
- کیفیتِ مهندسی **بالا و production-گرا** است: guard/wrapper مشترک برای auth/RBAC/observability، دفاعِ
  چندلایه در برابر double-booking، connection-pooling با read-replica، idempotency، rate-limit چندلایه،
  هدرهای امنیتی کامل، health-check واقعی، و متریک/tracing.
- بدهیِ فنیِ ساختاری **کم** است؛ کامنت‌های کد نشان می‌دهند باگ‌های قبلی (C1/C3/C7/H4/H11/M1) شناسایی و رفع شده‌اند.

**نمره‌ی معماریِ کلی: ۸.۷ / ۱۰** (جزئیاتِ نمره‌ی ماژول‌ها در بخش ۴).

---

## ۱) نقشه‌ی ساختار (Inventory)

### لایه‌بندی
```
middleware.ts            ← لبه: CORS، CSRF(Origin)، هدرهای امنیتی، rate-limit سراسری، ban، trace-id
src/app/api/**/route.ts  ← کنترلرها (۸۴ endpoint، نسخه‌بندی /api/v1)
src/lib/*.ts             ← دامنه/سرویس/زیرساخت (۴۸ ماژول)
prisma/schema.prisma     ← ۳۸ مدل داده
prisma/sql/*.sql         ← ۲۹ مهاجرتِ دستی (index، partition، RLS، constraint)
tests/*.test.mts         ← تست واحد (jwt، permissions، validate، reservation، waitlist، loyalty، otp، queue، lifecycle)
```

### گروه‌بندیِ endpointها (۸۴)
- **auth** (۷): otp/request, otp/verify, refresh, logout, staff/request, staff/verify
- **customer/me** (۹): me, me/reservations, me/profile, me/points, me/referral, me/chats(+[id]), me/push-subscribe
- **reservations (public+customer)** (۵): reservations, reservations/[code](+arrive/cancel/pay)
- **restaurants (public)** (۴): restaurants, restaurants/[slug](+availability/chat)
- **restaurant panel (staff)** (~۳۵): tables، waitlist، customers، campaigns، coupons، analytics، reports،
  reviews، photos، notes، pricing، hours، members، staff، rfm، fraud-signals، automations، ai، sms، heartbeat، walkin، events، chats، branches، cashback …
- **admin/company** (۸): overview, restaurants(+[id]/control,sms), business-intelligence, security, settings, system-health
- **maintenance/cron** (۸): expire, lifecycle, retention, rewards, waitlist, jobs-drain, ensure-partitions, customer-insights
- **waitlist/checkin/events/payments/telemetry/gift-cards** (public/mixed)
- **ops**: health, metrics

### ماژول‌های سرویس/زیرساخت (نمونه)
- **Auth/Security**: `jwt`, `permissions`, `admin-auth`, `maintenance-auth`, `with-restaurant-auth`, `security`, `ratelimit`, `otp`, `audit`
- **Domain**: `reservations` (۶۵۳ خط), `waitlist`, `availability`(+cache), `loyalty`, `coupons`, `pricing`, `tables`, `hours`, `lifecycle`, `rfm`, `customer-insights`, `fraud`, `automation`, `subscription`, `guest-profile`
- **Infra**: `db` (pool+replica), `redis`, `cache`, `queue` (Postgres FOR UPDATE SKIP LOCKED), `worker`, `idempotency`, `events`, `metrics`, `logger`, `notify`, `sms`(+balance), `zarinpal`, `platform-settings`, `platform-events`, `validate`/`schemas`, `errors`

---

## ۲) جریانِ احراز هویت/مجوز

- **Access/Refresh JWT** (`lib/jwt.ts`): HS256 صریح (ضدِ `alg:none`/algorithm-confusion)، `iss/aud` الزامی،
  secretهای **جدا** برای access و refresh، `jti` برای امکانِ revocation، عمرِ access=۱۵m و refresh=۳۰d.
  رفعِ باگ C3 مستند است: refresh هویتِ staff (tenant/role) را حمل می‌کند تا کارمند بعد از refresh به customer تنزل نیابد.
- **RBAC** (`lib/permissions.ts`): owner/manager دسترسیِ کامل؛ staff با `StaffPermission` یا **SAFE_DEFAULTS**
  (فقط عملیاتِ روزمره، نه مالی/تنظیمات). رفعِ باگِ privilege-escalation مستند است (findFirst فقط با tenantId → حالا با `id`+`tenantId`).
- **Guard مشترک** (`lib/with-restaurant-auth.ts`): `withRestaurantAuth`/`withStaffAuth`، تجمیعِ
  rate-limit → auth → resolveStaffRestaurant → requirePermission → error-envelope + trace + متریک HTTP.
- **maintenance/cron** (`lib/maintenance-auth.ts`): `x-maintenance-key` با **مقایسه‌ی constant-time (`timingSafeEqual`)**
  یا `Authorization: Bearer $CRON_SECRET` برای Vercel Cron.

## ۳) داده، کش، صف، پیکربندی

- **db** (`lib/db.ts`): pooling با پارامترهای `connection_limit`/`pool_timeout`، **read-replica routing** (`dbRead`)،
  singletonِ globalThis (رفعِ H4: نشتِ اتصال در production)، هوکِ متریکِ latency روی هر کوئری، graceful shutdown روی SIGTERM/SIGINT.
- **کش**: Redis (`lib/cache.ts`, `redis.ts`) + `availability-cache`؛ حالتِ Cluster از env.
- **صف**: `lib/queue.ts` مبتنی بر Postgres با `FOR UPDATE SKIP LOCKED` (بدونِ رقابتِ workerهای موازی)، `worker.ts`.
- **پیکربندی**: `.env.example` (۶.۷KB) هر ۳۹ متغیرِ ارجاع‌شده در کد را با کامنتِ فارسی مستند می‌کند
  (DATABASE_URL/REPLICA/DIRECT، REDIS(+CLUSTER)، JWT×۲، ALLOWED_ORIGINS، MAINTENANCE_KEY/CRON_SECRET،
  ZARINPAL_*، KAVENEGAR_* (۱۴ قالب SMS)، METRICS_TOKEN، SENTRY_DSN، LOG_LEVEL …). **تأییدشده: بدونِ شکافِ مستندسازیِ env.**

---

## ۴) نمره‌دهیِ ماژول‌ها

| ماژول | جداسازی | مقیاس‌پذیری | نگه‌داری | نمره |
|-------|---------|-------------|----------|------|
| reservations (double-booking core) | عالی (DIP، لایه‌ی حقیقت=DB) | عالی | خوب (۶۵۳ خط، پیچیده اما مستند) | ۹.۵ |
| jwt / auth | عالی | عالی | عالی | ۹.۵ |
| permissions (RBAC) | عالی | خوب | عالی | ۹.۰ |
| db (pool/replica) | عالی | عالی | عالی | ۹.۵ |
| with-restaurant-auth (guard) | عالی | عالی | عالی | ۹.۵ |
| ratelimit / middleware | عالی (fail-open مستند) | خوب (Redis+in-memory) | عالی | ۹.۰ |
| queue/worker | خوب (Postgres-based) | متوسط→خوب (نه Kafka/BullMQ) | خوب | ۷.۵ |
| availability(+cache) | خوب | خوب | خوب | ۸.۵ |
| loyalty/coupons/gift-card | عالی (FOR UPDATE، serializable) | خوب | خوب | ۹.۰ |
| ai / customer-insights / rfm | خوب (heuristic، نه ML واقعی) | متوسط | خوب | ۷.۰ |

**اصولِ معماری:** لایه‌بندیِ Controller→Service→Data روشن است؛ جهتِ وابستگی درست (route→lib، نه برعکس)؛
Dependency-Inversion در هسته‌ی رزرو (NoShowPredictor به‌عنوان port)؛ DRY از طریق wrapperها؛ بدونِ چرخه‌ی
وابستگیِ آشکار (importهای تنبل در db→metrics عمداً برای پرهیز از چرخه).

## ۵) نقاطِ قوت و ضعفِ ساختاری

**قوت:** دفاعِ چندلایه‌ی double-booking؛ guard مشترک؛ read/write splitting؛ idempotency؛ observability
(metrics/trace/health)؛ کامنت‌های «چرا»محورِ باکیفیت؛ تستِ واحدِ منطقِ حساس.

**ضعف/ریسک (جزئیات در گزارش‌های تخصصی):**
1. صف مبتنی بر Postgres (نه broker اختصاصی) — در مقیاسِ خیلی بالا گلوگاه می‌شود (→ PERFORMANCE/PRODUCTION_READINESS).
2. لایه‌ی «AI» heuristic است نه مدلِ آموزش‌دیده (→ BACKEND_FINAL).
3. ~۳۲ مورد `any`-cast (→ TECHNICAL_DEBT).
4. وابستگیِ middleware به Node runtime (ioredis) — روی Edge کار نمی‌کند (مستند در کد).
