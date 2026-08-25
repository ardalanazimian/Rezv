# رزرونو — معماری مقیاس‌پذیری برای ۲۰۰٬۰۰۰ کاربر همزمان

این سند بر پایه‌ی بازبینی کد واقعی و تست دیتابیس نوشته شده، نه دیاگرام انتزاعی.

---

## ۱. وضعیت فعلی — چه چیزی از قبل آماده‌ی مقیاس بود

بررسی کد نشان داد پایه‌ی خوبی وجود دارد:

- **APIها واقعاً stateless هستند:** هیچ state درون‌حافظه‌ای (session map، شمارنده‌ی محلی) وجود ندارد. تنها state سطح‌ماژول، singletonهای client دیتابیس/Redis است که درست است (هر instance نسخه‌ی خودش را دارد).
- **Rate limit، ban، و قفل رزرو همگی Redis-backed هستند** — یعنی بین چند instance مشترک‌اند. بدون sticky session.
- **بدون کار پس‌زمینه‌ی درون‌پروسه‌ای:** هیچ setInterval/timer که در یک instance کار انجام دهد و با scale خراب شود.
- **قفل رزرو با token + Lua release** درست پیاده شده (idempotent، بدون آزادسازی قفل دیگران).
- **EXCLUDE constraint** تضمین قطعی ضد double-booking در سطح DB (تست‌شده) — این یعنی حتی با صدها instance همزمان، رزرو تکراری ممکن نیست.

---

## ۲. گلوگاه‌هایی که پیدا و رفع شدند (refactor واقعی)

### ۲.۱ صف SMS — مهم‌ترین رفع

> ⚠️ **اصلاح‌شده (۲۰۲۶-۰۸-۱۲):** این بخش قبلاً یک صفِ Redis-list-based
> (`queue:sms` + `lpop` + cron جداگانه‌یِ `maintenance/sms-drain`) توصیف
> می‌کرد. با خواندنِ مستقیمِ `api/src/lib/sms.ts` (کدِ فعلی) تأیید شد که
> این توصیف دیگه درست نیست — مکانیزم از اون زمان به صفِ یکپارچه‌یِ
> **Postgres**ِ (`api/src/lib/queue.ts`, جدولِ `jobs`، claim با
> `FOR UPDATE SKIP LOCKED`) مهاجرت کرده که در `QUEUE.md` مستندشده؛
> `sms` فقط یکی از شش `JobKind` (`sms`/`email`/`push`/`report`/`image`/`webhook`)
> است، نه یک صفِ اختصاصیِ جدا. جستجو در کدِ فعلی هیچ اثری از `queue:sms`
> یا `sms-drain` پیدا نکرد (مسیرهایِ واقعیِ `maintenance/` عبارتند از
> `jobs-drain`, `retention`, `rewards`, `ensure-partitions`, `waitlist`,
> `expire`, `lifecycle`, `customer-insights`).

**مشکل (تاریخی):** `enqueueSms` با وجود نامش، **همزمان** یک `fetch` به کاوه‌نگار می‌زد، آن هم داخل مسیر request (مثلاً بعد از ثبت رزرو). در ۲۰۰هزار کاربر، latency رزرو به سرعت ارائه‌دهنده‌ی SMS گره می‌خورد و connectionها بلاک می‌شدند.

**رفع (وضعیتِ فعلی):** صفِ یکپارچه‌یِ Postgres-based (نه Redis list):
- `enqueueSms` حالا (به‌جز OTP) یک job با `kind: 'sms'` به تابعِ `enqueue()`ِ صفِ عمومی در `api/src/lib/queue.ts` می‌فرستد و **فوراً** برمی‌گردد (غیرمسدود) — جزئیاتِ کاملِ صف (اولویت، retry، `jobs-drain`) در `QUEUE.md`.
- worker (هندلرِ `sms` در `api/src/lib/worker.ts`، صدا‌زده‌شده از cronِ `maintenance/jobs-drain`) صف را مصرف می‌کند.
- claim با `FOR UPDATE SKIP LOCKED` اتمیک است → می‌توان چند worker موازی داشت بدون پردازش تکراری.
- اگر خودِ صف در دسترس نبود (مثلاً خطایِ اتصالِ DB)، `enqueueSms` به ارسالِ مستقیم (`sendSmsNow`) fallback می‌کند — بهتر از گم‌شدنِ پیام.
- **استثنا:** OTP همزمان و مستقیم می‌رود (کاربر منتظر کد است) — هیچ‌وقت وارد صف نمی‌شود.

### ۲.۲ Redis آماده‌ی Cluster
**مشکل:** client تک‌نود بود؛ یک نود Redis در ۲۰۰هزار کاربر گلوگاه است.

**رفع:** `redis.ts` حالا هم single-node و هم Cluster را پشتیبانی می‌کند (با `REDIS_CLUSTER_NODES`). قفل رزرو با hash-tag `{key}` بازنویسی شد تا در Cluster روی یک نود پایدار بماند. `scaleReads: 'slave'` خواندن را روی replicaهای Redis توزیع می‌کند.

### ۲.۳ N+1 در مسیر رزرو (از پاس عملکرد)
حلقه‌های per-table `tableIsFree` با یک کوئری `table_id = ANY(...)` جایگزین شدند (تست‌شده ~۱ms).

---

## ۳. معماری هدف برای ۲۰۰هزار کاربر همزمان

```
                         ┌─────────────────┐
                         │   CDN / WAF      │  (استاتیک + محافظت DDoS)
                         │  (Cloudflare)    │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Load Balancer   │  (L7، health-check محور،
                         │  (ALB / Nginx)   │   TLS termination)
                         └────────┬────────┘
                    ┌─────────────┼─────────────┐
              ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
              │ API pod 1│  │ API pod 2│  │ API pod N│  (stateless، auto-scale)
              └─────┬────┘  └─────┬────┘  └─────┬────┘
                    └─────────────┼─────────────┘
              ┌───────────────────┼───────────────────┐
        ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
        │ Redis     │      │ PgBouncer   │      │ Job workers │
        │ Cluster   │      │ (pooler)    │      │ (cron pods) │
        │ (shard)   │      └──────┬──────┘      └─────────────┘
        └───────────┘      ┌──────▼──────┐
                           │ Postgres    │
                           │ primary     │──┐
                           └─────────────┘  │ streaming replication
                           ┌─────────────┐  │
                           │ read replica│◄─┘ (dbRead routing)
                           └─────────────┘
```

### اجزا و نگاشت به کد موجود

| لایه | ابزار پیشنهادی | وضعیت در کد |
|---|---|---|
| Horizontal scaling | چند pod از همان image | ✅ APIها stateless‌اند |
| Stateless APIs | — | ✅ تأییدشده (state در Redis/DB) |
| Load balancer | ALB / Nginx / Caddy | 🔧 infra (health-check به `/api/v1/health` وصل شود) |
| Redis Cluster | Redis Cluster ۳+ نود | ✅ کد آماده (`REDIS_CLUSTER_NODES`) |
| DB replicas | Postgres streaming replication | ✅ کد آماده (`dbRead` + `DATABASE_REPLICA_URL`) |
| Queue system | صفِ یکپارچه‌یِ Postgres (جدولِ `jobs`، شاملِ کارِ `sms`) | ✅ پیاده شد + worker (رجوع کن به `QUEUE.md`) |
| Connection pooling | PgBouncer / Supabase Pooler | ✅ کد آماده (`?pgbouncer=true`) |
| Auto scaling | HPA (k8s) یا ASG | 🔧 infra (متریک: CPU + p95 latency) |

---

## ۴. Zero-Downtime / Blue-Green / Rolling

### پیش‌نیازهای کد (همه موجود):
- **Graceful shutdown:** `db.ts` روی SIGTERM هر دو client را تمیز می‌بندد → در rolling update، podهای در حال خاموش‌شدن requestهای در جریان را قطع نمی‌کنند.
- **Health check:** `/api/v1/health` اتصال DB را چک می‌کند → LB فقط podهای سالم را در چرخه نگه می‌دارد.
- **Stateless:** هیچ pod حالتی ندارد که با کشتنش گم شود.

### Rolling Update (پیش‌فرض k8s):
podها یکی‌یکی با نسخه‌ی جدید جایگزین می‌شوند؛ LB ترافیک را فقط به podهای ready (health-check سبز) می‌فرستد. چون migrationها additive‌اند (از پاس DB)، نسخه‌ی قدیم و جدید هم‌زمان با یک schema کار می‌کنند.

### Blue-Green:
دو محیط کامل (blue فعال، green جدید). بعد از تست green، LB یک‌باره سوییچ می‌کند. rollback = سوییچ برعکس. نیازمندی: migration باید backward-compatible باشد (هست — additive).

### قانون طلایی migration برای zero-downtime:
هرگز در یک deploy هم schema را تغییر بده هم کدی که به آن وابسته است. الگوی دو-فازی:
۱) ابتدا ستون/جدول جدید را additive اضافه کن (کد قدیم هنوز کار می‌کند).
۲) کد جدید را deploy کن که از آن استفاده می‌کند.
۳) (بعداً) ستون قدیمی را در یک deploy جدا حذف کن.

---

## ۵. تخمین ظرفیت — واقع‌بینانه

«۲۰۰هزار کاربر همزمان» باید دقیق تعریف شود. تخمین بر اساس معماری بالا:

**فرض‌ها:** کاربر همزمان ≠ request همزمان. یک کاربر فعال معمولاً هر ۵–۱۵ ثانیه یک request می‌زند. پس ۲۰۰هزار کاربر همزمان ≈ **۱۳٬۰۰۰–۴۰٬۰۰۰ req/s**.

| منبع | ظرفیت تخمینی | محدودیت |
|---|---|---|
| API pods (stateless) | خطی با تعداد pod | فقط هزینه؛ گلوگاه نیست |
| Redis Cluster (۳ shard) | ~۳۰۰هزار+ op/s | بالاتر از نیاز |
| Postgres + PgBouncer + replica | **اینجا گلوگاه واقعی است** | write throughput روی primary |
| صفِ jobها (شاملِ SMS) | نامحدود (async، محدود به throughputِ نوشتنِ Postgres) | دیگر در مسیر request نیست |

**گلوگاه نهایی = نوشتن روی Postgres primary.** خواندن‌ها با replica + cache مقیاس می‌شوند، اما هر رزرو/تغییر وضعیت یک write است. یک Postgres منفرد روی سخت‌افزار خوب ~۵٬۰۰۰–۱۵٬۰۰۰ write/s را می‌کشد.

**نتیجه‌ی صادقانه:**
- **خواندن‌محور (مرور رستوران، availability با cache):** ۲۰۰هزار کاربر همزمان **قابل‌دستیابی است** با این معماری (cache ردیس اکثر خواندن‌ها را جذب می‌کند، replicaها بقیه را).
- **نوشتن‌محور (peak رزرو، مثلاً شب ولنتاین):** گلوگاه primary است. برای عبور از ~۱۵هزار write/s نیاز به **sharding دیتابیس بر اساس `restaurant_id`** است که الان پیاده نشده (و در این مقیاس کسب‌وکار over-engineering است).
- **تخمین عملی برای این کد بعد از بهینه‌سازی:** **~۵۰هزار–۱۰۰هزار کاربر همزمان** با راحتی روی یک primary + چند replica + Redis Cluster + auto-scaled pods. رسیدن به ۲۰۰هزار **در حالت نوشتن‌سنگین** نیاز به sharding دارد؛ در حالت خواندن‌سنگین همین حالا شدنی است.

---

## ۶. گام بعدی برای عبور از ۱۰۰هزار (اگر واقعاً لازم شد)

1. **Sharding دیتابیس** بر اساس `restaurant_id` (داده‌ها به‌طور طبیعی per-restaurant جدا هستند → shard-friendly). Citus یا تقسیم منطقی.
2. ~~صف عمومی‌تر (BullMQ روی همان Redis) برای انواع دیگر کار async (نه فقط SMS)~~ — **انجام شد**: صفِ یکپارچه‌یِ Postgres در `api/src/lib/queue.ts` از قبل شش نوع کار (`sms`/`email`/`push`/`report`/`image`/`webhook`) را پشتیبانی می‌کند (رجوع کن به `QUEUE.md`)؛ اگر throughputِ همین صف (نوشتن روی Postgres) خودش گلوگاه شد، آن زمان مهاجرت به BullMQ/Redis قابلِ بازبینی است، نه به‌عنوانِ کارِ باقی‌مانده‌یِ فعلی.
3. **CQRS برای آنالیتیکس:** خواندن‌های سنگین گزارش به یک read-store جدا (مثلاً ClickHouse) منتقل شود.
4. **لود تست واقعی** با k6/Gatling روی staging — تنها راه تأیید قطعی اعداد بالا.

این موارد عمداً الان پیاده نشدند چون برای مقیاس فعلی کسب‌وکار، پیچیدگی‌شان توجیه ندارد.

---

## پیاده‌سازی‌های data-layer (تست‌شده روی PostgreSQL واقعی)

این دو مورد از ممیزی مقیاس، که از لایه‌ی کد/دیتابیس قابل انجام بودند، پیاده و تست شدند:

### ۱. Partitioning جدول reservations (بزرگ‌ترین گلوگاه data-layer)
- جدول `reservations` بر اساس `slot_start` به پارتیشن ماهانه تقسیم می‌شود.
- **تست‌شده روی PG واقعی:**
  - partition pruning تأیید شد — کوئری بازه‌ای فقط پارتیشن مرتبط را اسکن می‌کند (نه کل ۶۰M ردیف).
  - EXCLUDE constraint ضد double-booking روی هر پارتیشن کار می‌کند (رزروهای هم‌پوشان همیشه در یک ماه‌اند → منطقاً درست).
  - تابع `ensure_reservation_partition()` برای ساخت خودکار پارتیشن ماه آینده.
- migration: `011-reservations-partitioning.sql` (راهنمای مهاجرت امن جدول پر از داده).
- cron ماهانه: `ensure-partitions` (حیاتی — پارتیشن نبودن = fail شدن insert آن ماه).
- **مزیت عملیاتی:** حذف داده‌ی قدیمی با `DROP TABLE partition` فوری (بدون VACUUM سنگین).

### ۲. Stale-While-Revalidate برای availability (ضد thundering herd)
- مشکل قبلی: cache ساده‌ی ۳۰s — وقتی منقضی می‌شد، همه‌ی requestهای همزمان یک رستوران داغ همزمان به DB می‌زدند.
- راه‌حل: داده تا ۳۰s کاملاً تازه، تا ۵ دقیقه به‌عنوان stale قابل‌سرو. وقتی stale شد، **فوراً stale برمی‌گردد** ولی یک refresh پس‌زمینه با **قفل single-flight** اجرا می‌شود — فقط یک request محاسبه می‌کند، بقیه stale می‌گیرند.
- نتیجه: برای یک رستوران داغ با ۱۰۰۰ بازدید همزمان، DB **یک‌بار** کوئری می‌خورد، نه ۱۰۰۰ بار.

**باقی موارد ممیزی (multi-AZ، CDN، چند replica، Patroni failover) از لایه‌ی زیرساخت‌اند و از کد قابل پیاده‌سازی نیستند.**
