# دورِ سیزدهم — اجرای کامل تا اولین ورودِ واقعیِ مالک

> ۲۰۲۶-۰۹-۰۲ · شاخه: `feat/admin-totp-login` (`011a0ed`) · **هیچ کدی این دور تغییر نکرد**
> فقط وضعیتِ DB و فایل‌های gitignoredِ `.env` · PR همچنان باز نشده (طبقِ دستور)
> ⚠️ این گزارش عمداً **هیچ رمز یا رازی** ندارد.

---

## ۱. دیتابیسِ dev — از صفر، همان مسیرِ روزِ استقرار

```
0a  DROP DATABASE IF EXISTS rezervno WITH (FORCE)     exit=0
0b  CREATE DATABASE rezervno                          exit=0
1   npx prisma migrate deploy                         exit=0
2   sh prisma/apply-sql.sh                            exit=0
3   npx prisma migrate status                         exit=0
```

| تأیید | نتیجه |
|---|---|
| `_prisma_migrations` | `0_init finished=true ok=true` |
| `apply-sql` | **۷۹ اعمال، ۲ رد** (`@manual-only`) |
| `migrate status` | `Database schema is up to date!` |
| ستون‌های `staff` | `… created_at · username · password_hash · password_updated_at` |
| `restaurants` | ۰ ردیف — واقعاً از صفر |

**کجا خطا داد:** هیچ‌جا. برخلافِ دورِ دوازدهم، رمزِ DB مستقیم از خودِ کانتینر
خوانده شد (`docker exec … $POSTGRES_PASSWORD`)، پس P1000 تکرار نشد. baseline
لازم نبود — رویِ DBِ خالی `migrate deploy` مستقیم کار می‌کند.

**سند:** بخشِ محلیِ `DEPLOYMENT.md` (۱۸–۳۰) دقیقاً همین سه دستور را می‌گوید —
**با واقعیت می‌خواند** (در دورِ دوازدهم از `db push` به این هماهنگ شده بود).

---

## ۲. سه اسکریپت — با کمترین لمسِ راز

| اسکریپت | چطور | نتیجه |
|---|---|---|
| `admin-hash-password.mjs` | رمز با `openssl rand -base64 24`، از stdin لوله شد — **هرگز به دیسک نرسید**، یک بار در ترمینال چاپ شد | هشِ ۱۳۰ کاراکتری `scrypt$32768$8$1$…` |
| `admin-provision.mjs ardiz '<hash>'` | | تنانتِ پلتفرم `bfe4cada-6dee-4e06-a33a-41074d81c4b7` · staff `8ffcaa0d-…` |
| `admin-totp-secret.mjs ardiz` | QR در ترمینال، راز یک بار چاپ شد | چهار کلید در **هر دو** `.env` نوشته شد |

پیش‌شرطِ نوشتنِ راز در `.env`: هر دو فایل `git check-ignore` را پاس کردند
(وگرنه اسکریپت fail-closed متوقف می‌شد).

تأییدِ زنده در DB:
```
 username | role  | is_active | has_pw | tenant_id
 ardiz    | owner | t         | t      | bfe4cada-6dee-4e06-a33a-41074d81c4b7
```

---

## ۳. ورودِ زنده — خروجیِ خام

```
GET  /api/v1/auth/admin/login              {"totp_required":true}   200
POST /api/v1/auth/admin/login  (ardiz + رمز + TOTP)                  200
  keys: access,refresh,admin  ·  access 345B  ·  refresh 436B
  admin: {id:"8ffcaa0d-…", tenant_id:"bfe4cada-…", tenant_name:"Rezervno — پلتفرم"}
  claims: kind=staff · role=owner · tenantId=bfe4cada-… · exp 15min
توکن → /admin/overview                                               200
توکن → /restaurant/reservations  (withRestaurantAuth)               404
توکن → /restaurant/staff         (withStaffAuth)                    200  ← همان استثنای دورِ ۱۲
```

کدِ TOTPِ این تست از همان رازِ `.env` ساخته شد — مسیرِ سرور را end-to-end
ثابت می‌کند. هم‌زمانیِ **دستگاهِ مالک** فقط با ورودِ واقعیِ خودش ثابت می‌شد (§۵).

---

## ۴. هشت endpointِ ادمین با توکنِ واقعی

رستورانِ `[DEMO]` از خودِ `POST /admin/restaurants` ساخته شد (**۲۰۱**) —
با بدنه‌ی فایلِ UTF-8، و نام این بار سالم: `5b44454d4f5d20 d8b1 d8b3 d8aa …`.

| endpoint | http | شکلِ واقعی | مقایسه با `apps/company/js` |
|---|---|---|---|
| `overview` | 200 | ۱۴ کلید + `subscription_breakdown{5}` + `top_restaurants[{id,name,reservations,members}]` | `overview.js:5,30` — ۵ فیلدِ `PLATFORM_STATS.*` ✅ |
| `restaurants` | 200 | `{restaurants:[{۱۷ کلید}]}` | `api.js:126-151` — هر ۱۶ `apiR.*` ✅ |
| `restaurants/[id]/sms` GET | 200 | `{balance,total_sent,recent_transactions}` | `intelligence.js:118` — `balance` ✅ |
| `restaurants/[id]/control` PATCH | 200 | `{ok,tenant_id,plan,plan_expires_at}` | `intelligence.js:164` — `plan_expires_at` ✅ |
| `business-intelligence` | 200 | `{guests{4}, rfm_distribution[], behavior_segments[], top_restaurants_by_value[{id,name,total_clv_toman,measured_customers,customers}]}` | `intelligence.js:11-40` ✅ |
| `security` | 200 | ۶ کلید، `economy_overview{5}` | `intelligence.js:560-640` ✅ |
| `system-health` | 200 | `{health, jobs{5}, active_webhooks, failed_actions_24h, queue_stuck, oldest_pending_job{kind,since}, dead_jobs[]}` | `intelligence.js:230-260` ✅ |
| `settings` | 200 | `{settings:{3}}` | هیچ خواننده‌ای در پنل نیست — نمی‌تواند واگرا شود |

**هیچ واگرایی.** شکل‌ها بیت‌به‌بیت همان دورِ دوازدهم‌اند و گاردِ قراردادیِ
`admin-panel-contract` (۸ تست، اثباتِ سه rename) همان را قفل کرده.

---

## ۵. ⭐ اولین ورودِ واقعیِ مالک — شاهد از DB، نه از گفته

مالک QR را اسکن کرد و از UI (`http://localhost:8082/?api=http://localhost:3000`)
با `ardiz` + رمز + کدِ اپِ خودش وارد شد:

```sql
select action, ip, detail->>'channel', detail->>'totp', detail->>'username', created_at
from audit_logs where detail->>'username'='ardiz' order by created_at desc;

 auth.login | ::ffff:127.0.0.1 | platform-admin-password | ok | ardiz | 09:02:29   ← UI، دستگاهِ مالک
 auth.login | ::ffff:127.0.0.1 | platform-admin-password | ok | ardiz | 09:00:12   ← curl، تستِ من
```

دو ورودِ موفق، دو دقیقه فاصله، هر دو `totp=ok`. یعنی:
- رازِ اسکن‌شده با رازِ سرور یکی است و ساعتِ دستگاه در پنجره‌ی ±۳۰s است
- ضدِ replay درست عمل کرد: کدِ مصرف‌شده‌ی تستِ من رد می‌شد، کدِ چرخشِ بعدی پذیرفته شد (مالک همین را تأیید کرد: «رمز یک‌بارمصرف کار کرد»)

این تنها بخشی بود که هیچ تستِ خودکاری نمی‌توانست جایگزینش شود.

---

## بهداشتِ راز در این دور

| چیز | کجا هست | کجا **نیست** |
|---|---|---|
| رمزِ خام | حافظه/password managerِ مالک | هیچ فایل، هیچ گزارش، هیچ scratch |
| هشِ رمز | `staff.password_hash` | — |
| رازِ TOTP | `.env` و `api/.env` (هر دو ignored؛ طراحی همین است) + اپِ مالک | گزارش/اسناد/commit |
| توکن‌های تست | حذف شدند (`rm` پس از استفاده) | scratchpad |

---

## سرویس‌های زنده در پایانِ دور

- API: `http://localhost:3000` — `checks: db ok, redis ok`
- پنلِ شرکت: `http://localhost:8082` — با `?api=http://localhost:3000` یک بار

---

## دو تصمیم که همچنان با مالک است

۱. **PR** — شاخه `feat/admin-totp-login` رویِ `011a0ed` push شده؛ باز نشده تا
   دستور برسد. CI فقط با PR اجرا می‌شود.
۲. **`/restaurant/staff` برایِ ادمینِ پلتفرم ۲۰۰ می‌دهد** (`withStaffAuth`،
   فقط تنانتِ خودش) — بسته شود یا نه.

و یک یادآوری: `.env` ریشه هنوز `POSTGRES_PASSWORD` کهنه دارد که با volume
نمی‌خواند؛ `api/.env` فایلِ کاری است. یا `.env` را با volume هماهنگ کنید یا
volume را از نو بسازید — تا آن روز، هر ابزاری که `.env` ریشه را بخواند P1000 می‌گیرد.
