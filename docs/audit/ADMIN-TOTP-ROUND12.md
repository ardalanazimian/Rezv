# دورِ دوازدهم — تمرینِ استقرار، اولین ورودِ واقعی، پیمایشِ پنلِ شرکت

> ۲۰۲۶-۰۹-۰۲ · شاخه: `feat/admin-totp-login` · commit `035f42f` · **PR باز نشد** (طبقِ دستور)
> پیش‌نیاز: `ADMIN-TOTP-PHASE0.md` و `ADMIN-TOTP-IMPLEMENTATION.md`

---

## ۱. دیتابیسِ dev — از صفر، با مسیرِ رسمی

### دستورها، دقیقاً به ترتیب

```
0a. docker exec rezervno-postgres psql -U rezervno -d postgres \
      -c "DROP DATABASE IF EXISTS rezervno WITH (FORCE);"        exit=0
0b. … -c "CREATE DATABASE rezervno;"                              exit=0
1.  npx prisma migrate deploy                                     exit=0
2.  sh prisma/apply-sql.sh                                        exit=0
3.  npx prisma migrate status                                     exit=0
```

**هیچ baselineی لازم نبود.** `migrate resolve --applied 0_init` که entrypoint
برایِ DBِ «پُر ولی بی‌تاریخچه» می‌زند، رویِ DBِ خالی موضوعیت ندارد و
`migrate deploy` مستقیم کار کرد.

### کجا خطا داد

| خطا | علت | حکم |
|---|---|---|
| `P1000: Authentication failed … credentials for rezervno are not valid` | رمزِ `.env` (`8bBxRK…`) با رمزِ کانتینر (`Rezerv…`) یکی نبود | **یافته‌ی واقعیِ استقرار.** Postgres رمز را فقط در **اولین init** از env می‌خواند و در volume نگه می‌دارد. چرخاندنِ `.env` رویِ سروری با volumeِ موجود دقیقاً همین را می‌دهد. |
| `DROP DATABASE cannot run inside a transaction block` | دو statement در یک `-c` — harnessِ خودم | خطای من، نه سیستم |

هر دو در گزارش ماندند؛ هیچ‌کدام دور زده نشد.

### `_prisma_migrations` درست ساخته شد

```
 migration_name | finished | ok
 0_init         | t        | t
```

`apply-sql`: **۷۹ اعمال، ۲ رد** (`002-partitioning-guide`، `011-reservations-partitioning` — هر دو `@manual-only`).
`migrate status`: `Database schema is up to date!`

ستون‌های `staff` حالا: `… created_at · username · password_hash · password_updated_at` و ایندکسِ `staff_username_key` هست — همان‌هایی که در فازِ ۱الف غایب بودند.

### سند در برابرِ واقعیت

| بخش | وضعیت |
|---|---|
| `DEPLOYMENT.md` سرور (خطوطِ ۱۵۰–۱۶۲) | **با واقعیت می‌خواند** — همان دو قدم |
| `DEPLOYMENT.md` محلی (خطوطِ ۱۸–۲۳) | **نمی‌خواند** — `db push` می‌گفت، یعنی مسیری متفاوت از روزِ استقرار |

بخشِ محلی هماهنگ شد: `db push` برداشته شد، همان دو قدمِ entrypoint + `migrate status` جایش آمد، و هشدارِ driftِ رمز با تاریخ ثبت شد. منطقش در خودِ سند: مهاجرتِ خراب باید رویِ لپ‌تاپ پیدا شود، نه سرور.

### سه اسکریپت

| اسکریپت | نتیجه‌ی زنده |
|---|---|
| `admin-hash-password.mjs` | هشِ ۱۳۰ کاراکتریِ `scrypt$32768$8$1$…` — **پس از رفعِ یک باگ** (پایین) |
| `admin-provision.mjs myadmin '<hash>'` | تنانتِ پلتفرم `9d0b5d5f-…` + staff `c339bc17-…` · اجرای دوم: «ادمینِ موجود به‌روز شد»، `count(*)=1` — idempotent |
| `admin-totp-secret.mjs myadmin` | QR در ترمینال، راز `CGBM…`، کدِ لحظه چاپ شد |

تأییدِ زنده در DB:
```
 username | role  | is_active | has_pw | algo    | tenant_id
 myadmin  | owner | t         | t      | scrypt$ | 9d0b5d5f-53d6-4a48-825f-d19ee6e85dd7
```

---

## ۲. اولین ورودِ واقعی — خروجیِ خام

```
GET /api/v1/auth/admin/login
{"totp_required":true}                                          http=200

POST /api/v1/auth/admin/login  {username, password, totp: 41****}
  keys: [access, refresh, admin]   access len=345  refresh len=436
  admin: {"id":"c339bc17-…","tenant_id":"9d0b5d5f-…","tenant_name":"Rezervno — پلتفرم"}
  claims: {kind:"staff", role:"owner", tenantId:"9d0b5d5f-…", exp_in_min:15}
                                                                http=200

GET /api/v1/admin/overview  (همان توکن)
{"total_restaurants":0,"active_restaurants":0,…,"system_health":"healthy",…}
                                                                http=200

GET /api/v1/restaurant/reservations   → NOT_FOUND               http=404
GET /api/v1/restaurant/tables         → NOT_FOUND               http=404
GET /api/v1/restaurant/waitlist       → NOT_FOUND               http=404
```

### ⚠️ موردی که «رد» نشد — صریح

`GET /api/v1/restaurant/staff` با همان توکن **۲۰۰** داد و ردیفِ خودِ مدیر را برگرداند.

دلیل: این route با `withStaffAuth` است، نه `withRestaurantAuth` ([`with-restaurant-auth.ts:107,137`](../../api/src/lib/with-restaurant-auth.ts#L107) خودش می‌گوید تنها مصرف‌کننده همین است). `withStaffAuth` رستوران نمی‌خواهد، فقط تنانت. پاسخ فقط staffِ تنانتِ پلتفرم بود — **نشتِ cross-tenant نیست**، ولی «رد» هم نیست. حکمِ اینکه ادمینِ پلتفرم باید از این route هم بیرون بماند با شماست؛ من تغییرش ندادم.

دو یافته‌ی جانبی از همین بخش:
- پیامِ `notFound`: «رستورانی برای این حساب یافت نشد **پیدا نشد**» — `Err.notFound(what)` خودش «پیدا نشد» می‌چسباند و `staff-helpers.ts:121` یک جمله‌ی کامل می‌دهد. آرایشی، ولی به کاربر می‌رسد.
- `restaurant/settings` HTMLِ ۴۰۴ داد — چون اصلاً route نیست (مسیرِ حدسیِ من؛ routeِ واقعی `restaurant/profile`/`hours` است). باگ نیست.

---

## ۳. ⭐ پیمایشِ پنلِ شرکت با توکنِ واقعی

چون DB تازه بود و همه‌ی آرایه‌ها خالی، یک رستورانِ `[DEMO]` از خودِ
`POST /admin/restaurants` ساخته شد — **provisioning هم برای اولین بار زنده اجرا شد: ۲۰۱.**

| endpoint | http | شکلِ واقعی | کلاینت می‌خواند | حکم |
|---|---|---|---|---|
| `overview` | 200 | ۱۴ کلید + `subscription_breakdown{…}` + `top_restaurants[]` | `PLATFORM_STATS.{platform_clv_status, platform_clv_toman, subscription_breakdown, system_health, total_vips}` — `overview.js:5,30` | ✅ مطابق |
| `restaurants` | 200 | `{restaurants:[{۱۷ کلید}]}` | ۱۶ فیلدِ `apiR.*` — `api.js:126-151` | ✅ هر ۱۶ موجود |
| `restaurants/[id]/control` | 200 | `{ok, tenant_id, plan, plan_expires_at}` | `res.data.plan_expires_at` — `intelligence.js:164-165` | ✅ |
| `restaurants/[id]/sms` GET/POST | 200/200 | `{balance,total_sent,recent_transactions}` / `{ok,balance,added}` | `res.data.balance` — `intelligence.js:118` | ✅ (۵۰→۱۵۰ پس از topup) |
| `business-intelligence` | 200 | `{guests{4}, rfm_distribution[], behavior_segments[], top_restaurants_by_value[]}` | `d.guests.*`, `x.count`, `r.{segment,count,name,customers,total_clv_toman}` — `intelligence.js:11-40` | ✅ |
| `security` | 200 | ۶ کلید؛ `flagged_abuse_users[]` از `fraud.ts:24-36` | ۸ فیلدِ `u.*` — `intelligence.js:560-640` | ✅ هر ۸ موجود |
| `system-health` | 200 | `{health, jobs{5}, active_webhooks, failed_actions_24h, queue_stuck, oldest_pending_job, dead_jobs[]}` | `d.*` + `j.{kind,error,attempts}` — `intelligence.js:230-260` | ✅ |
| `settings` | 200 | `{settings:{zarinpal_merchant_id, zarinpal_sandbox, sales_notify_email}}` | **هیچ خواننده‌ای در هیچ اپی نیست** | — (نمی‌تواند واگرا شود) |

> نکته‌ی روشی: `r.plan / r.sms / r.status` که در همان صفحه‌ی BI دیده می‌شوند از `RESTAURANTS`ِ محلی می‌آیند (`intelligence.js:39-49`)، نه از پاسخِ BI. بدونِ این تفکیک، سه «واگراییِ» کاذب گزارش می‌شد.

**نتیجه: هیچ واگرایی پیدا نشد.** همان کلاسِ باگِ `/me/reservations` این‌جا وجود نداشت.

### گاردِ قراردادی — از عکسِ لحظه‌ای به خاصیت

`api/tests/admin-panel-contract.integration.test.mts` — **۸ تست**، الگویِ
`me-reservations-contract`: جدولِ `CONSUMED` به‌ازای هر endpoint (با فایل:خطِ
منبعِ grep)، در برابرِ خروجیِ **واقعیِ** route، رویِ fixtureهای **غیرخالی**
(رستوران با موجودی، کاربرِ `hasActiveAbuseFlag`، jobِ `dead`). نبودِ fixture
خطاست، نه عبور — `.catch(()=>{})`های خاموش عمداً برداشته شدند.

**اثباتِ غیرتوتولوژی — سه rename در سرور:**

```
[سالم]                                          exit=0
restaurants:   sms_balance → smsBalance       → exit=1 (۴ قرمز)
system-health: failed_actions_24h → *_renamed → exit=1 (۴ قرمز)
control:       plan_expires_at → expires      → exit=1 (۴ قرمز)
[بازگردانی]                                     exit=0
```

یک اشتباهِ خودم که در مسیر گرفته شد: برایِ فیلدهای nullable (`reason`،
`total_clv_toman`) نوع را `object` نوشته بودم؛ فقط چون **امروز** null بودند
سبز می‌ماند و روزِ اندازه‌گیریِ واقعی به‌دروغ قرمز می‌شد. حالا نوعِ غیرِ null
پین شده و null از چکِ نوع معاف است، نه از چکِ وجود.

---

## ۴. PR — باز نشد

طبقِ دستور. commit `035f42f` رویِ `feat/admin-totp-login` push شده.

`_all.runner`: ثبت شد، هیچ فایلِ تستی بی‌ثبت نیست، و شمار **واقعاً** بالا رفت:

```
پیش: ℹ tests 1491    پس: ℹ tests 1499    (+۸)   fail 0
```

---

## دو باگِ خودم که این دور گرفته شدند

**۱. `admin-hash-password.mjs` با stdinِ لوله‌شده `exit 13` می‌داد.** هر پرسش
یک readline تازه می‌ساخت؛ با `printf … | node …` اولی کلِ بافر را می‌بلعید و
دومی هرگز resolve نمی‌شد («unsettled top-level await»). حالا غیرِ TTY کلِ
stdin را بافر می‌کند و از آرایه می‌خواند؛ TTY همان اکویِ خاموش را دارد.
تست: لوله‌شده هشِ ۱۳۰ کاراکتری ✓ · عدمِ تطابق `exit 1` ✓ · سیاستِ ضعیف `exit 1` ✓.
(دو تلاشِ اول با رشته‌های Python هم escape را خراب کرد — با بازنویسیِ
خط‌محور و رشته‌ی raw حل شد.)

**۲. نامِ فارسی به `?` تبدیل و در DB ذخیره شد.** `curl -d '…'` درون‌خطی
رویِ Git-Bashِ ویندوز. با `--data-binary @file` (UTF-8) بایت‌های
`d8b1 d8b3 …` سالم ماندند؛ `server_encoding=UTF8`، `client_encoding=UTF8`.
**حرفِ سرور نبود.** ردیفِ آلوده با ترتیبِ FK (tables → invites → staff →
restaurant → tenant) پاک شد.

---

## راستی‌آزمایی

| گیت | نتیجه |
|---|---|
| `npm test` | **۱۴۹۹ / ۱۴۹۹** (۱۴۹۱ + ۸) |
| `tsc --noEmit` · `npm run lint` | exit 0 |
| پنج گاردِ ابزاری | همه exit 0 |
| سه rename در سرور × گاردِ تازه | هر سه `exit=1`، بازگردانی `exit=0` |
| `git status` پس از بازگردانی | routeها تمیز |

---

## آنچه باز ماند

۱. **`/restaurant/staff` برایِ ادمینِ پلتفرم ۲۰۰ می‌دهد** — تصمیمِ محصولی
   (بسته‌شدنش یعنی تغییرِ `withStaffAuth`).
۲. **پیامِ دوبله‌ی `notFound`** در `staff-helpers.ts:121` — آرایشی.
۳. **`.env` ریشه هنوز رمزِ کهنه دارد**؛ `api/.env` (ignored) با رمزِ واقعیِ
   کانتینر ساخته شد. یا `.env` را با volume هماهنگ کنید یا volume را از نو.
۴. **CI** فقط رویِ `main`/`develop` یا PR اجرا می‌شود و توکنِ `gh` منقضی است —
   تا PR باز نشود، لینوکس این دور را ندیده.
