# دورِ چهاردهم — پیمایشِ پنلِ business + سه کارِ معوق

> ۲۰۲۶-۰۹-۰۲ · شاخه: `feat/admin-totp-login` · commit `076c9cd` · pushed
> ⚠️ **PR/CI:** در لحظه‌ی نوشتن، هیچ PRی برای این شاخه در GitHub نیست (تنها PR باز
> `#78` روی `claude/open-tasks-review-2evj9r` است) و هیچ runِ CI ندارد. نتیجه‌ی
> لینوکس گزارش‌شدنی نیست تا PR واقعاً باز شود.

---

## ۱. سه کارِ معوقِ دورِ دوازدهم

### الف) پینِ `/restaurant/staff` ✅ — route دست نخورد

`tests/restaurant-staff-tenant-pin.integration.test.mts` (۲ تست): توکنِ ادمینِ
پلتفرم روی این route ۲۰۰ می‌گیرد (`withStaffAuth`، رستوران نمی‌خواهد) ولی **فقط**
staffِ تنانتِ خودش را می‌بیند. کارکنِ تنانتِ دیگر اول **وجودش assert می‌شود**،
بعد غیابش — وگرنه «غایب است» بی‌معنا بود.

```
[سالم]                                   exit=0
حذفِ where: { tenantId: auth.tenantId }  → exit=1 (۴ قرمز)   ← staff/route.ts:100
[بازگردانی]                              exit=0
```

### ب) driftِ رمزِ DB ✅ — سومین ذکر، بسته شد

`docker-compose.yml` هم postgres (خطِ ۱۷) هم API (خطِ ۵۸) را از **همان**
`POSTGRES_PASSWORD` می‌سازد، پس `.env` باید منبعِ حقیقت بماند. به‌جای برگرداندنِ
`.env` به رمزِ کهنه‌ی volume، رمزِ role داخلِ cluster چرخانده شد:

```
ALTER USER rezervno PASSWORD '<.env>'          → ALTER ROLE
psql با اعتبارِ .env ریشه از بیرونِ کانتینر   → login-ok|rezervno
docker compose config → DATABASE_URL           → همان رمز رندر شد
api/.env هم‌سو شد · ری‌استارتِ API             → {"db":"ok","redis":"ok"} پس از ۶s
```

بدونِ بازسازیِ volume. حافظه‌ی پروژه اصلاح شد.

### ج) پیامِ دوبله‌ی `notFound` ✅

`staff-helpers.ts:121`: `Err.notFound('رستورانی برای این حساب یافت نشد')` →
`Err.notFound('رستورانی برای این حساب')` — چون `Err.notFound(what)` خودش «پیدا نشد»
می‌چسباند. هیچ تستی پیامِ دوبله را پین نکرده بود (grep شد).

---

## ۲. ⭐ پیمایشِ پنلِ business

### روش

- **۵۵ route** زیر `/v1/restaurant/*` inventory شد (`find … route.ts` + exportها)
- **۳۴ helper** در `apps/business/js/data.js` به route نگاشت شد
- هر فیلدِ **snake_case** که ماژول‌های صفحه از پاسخِ سرور می‌خوانند با grep استخراج شد
  (snake_case = سرور، camelCase = state محلی — همین تفکیک، جداکننده‌ی واگراییِ واقعی
  از کاذب است)
- هر خواندنِ مبهم با «نزدیک‌ترین فراخوانِ API» و سپس «تابعِ محیطی» به endpoint نسبت داده شد
- شکلِ **واقعیِ** هر route از خودِ فایلِ route/lib خوانده شد، نه از مستندات

### سه واگراییِ کاذب که تفکیک جلویشان را گرفت

| ظاهرِ اولیه | واقعیت | شاهد |
|---|---|---|
| کلاینت `res.data.cards` می‌خواند، سرورِ crm `items` می‌دهد | `const [res, crmRes] = Promise.all([ai, crm])` — `cards` مالِ `/ai` است؛ crm با `crmRes.data.items` خوانده می‌شود | [crm.js:1146,1148,1152](../../apps/business/js/crm.js#L1146) · [crm/recommendations/route.ts:93](../../api/src/app/api/v1/restaurant/crm/recommendations/route.ts#L93) |
| `r.plan / r.sms / r.status` در صفحه‌ی BI | از `RESTAURANTS`ِ محلی، نه پاسخِ BI | [intelligence.js:39-49](../../apps/company/js/intelligence.js#L39) |
| `c.urgency / c.reason / c.channel` در cards | مالِ حلقه‌ی `contacts.map` است؛ سرور `urgency`/`reason` را در `lib/crm-recommendations.ts:67-69` می‌سازد | [crm.js:1173-1180](../../apps/business/js/crm.js#L1173) |

و دو نامزدی که بررسیِ عمیق‌تر رد کرد: `notifications` (کلاینت `ic/emoji/title/text/at`
می‌خواند — `buildActivityFeed` در `lib/notifications.ts:66-100` دقیقاً همین را
می‌سازد) و `chats.last_message` (شیء است، کلاینت `t.last_message.body` می‌خواند —
[chat.js:29](../../apps/business/js/chat.js#L29)؛ جدولِ اولِ من غلط بود، نه کد).

### نتیجه: صفر واگراییِ بی‌صدا

| endpoint | http | کلاینت (فایل:خط) | سرور | حکم |
|---|---|---|---|---|
| `reservations` | 200 | `mapResRow` data.js:919 — ۹ فیلد | reservations/route.ts | ✅ |
| `tables` | 200 | items · number/capacity/state | tables/route.ts | ✅ |
| `waitlist` + `/analytics` | 200 | waitlist.js:30,42,43,58,62 | lib/waitlist.ts | ✅ |
| `members` | 200 | data.js:840-848 — ۸ فیلد | members/route.ts | ✅ |
| `coupons` | 200 | marketing.js:81-83 | coupons/route.ts | ✅ |
| `reviews` | 200 | crm.js:94,96 · avg_rating/distribution/items | reviews/route.ts | ✅ |
| `chats` | 200 | chat.js:17,28,29 | chats/route.ts:48 | ✅ |
| `automations` | 200 | marketing.js:33-34,124 (`sent_count`) | automations/route.ts | ✅ |
| `customers` | 200 | crm.js:731,740,743,746,1038 | customers/route.ts (customer_insights) | ✅ |
| `customers/[userId]` | — | crm.js:1019-1060 `d.clv/risk/timeline/user` | route: clv,risk,timeline,user | ✅ |
| `staff` | 200 | items | staff/route.ts:104 | ✅ |
| `events` / `notes` | 200 | overview.js:367 `author_name` | notes/route.ts | ✅ |
| `analytics` | 200 | marketing.js:320-326 · heatmap | analytics/route.ts | ✅ (یک شکاف، پایین) |
| `notifications` | 200 | overview.js:184 | lib/notifications.ts:66-100 | ✅ |
| `campaigns` | 200 | crm.js:1110 `recipients_count` | campaigns/route.ts | ✅ |
| `photos` | 200 | crm.js:81-82 | lib/photo-moderation.ts:72-74 | ✅ |
| `hours` | 200 | crm.js:793-796 | hours/route.ts:114-116 | ✅ |
| `cancellation-policy` · `pricing` · `cashback` | 200 | crm.js:973-993 · staff-system.js:248,296 | همان routeها | ✅ |
| `crm/recommendations` · `rfm` · `manager-insights` | 200 | crm.js:1152-1153 · rfm · answers | همان routeها | ✅ |
| `ai` | — | crm.js:1148 `cards`, :1168 `action_label` | ai/route.ts | ✅ |
| `walkin` (POST) | — | reservations.js:366,374,408 | walkin/route.ts | ✅ |

**یک شکافِ مستند و گاردشده:** `avg_interval_days` — [marketing.js:322-324](../../apps/business/js/marketing.js#L322)
خودش می‌داند سرور نمی‌فرستد (`typeof === 'number' ? … : null`). واگراییِ بی‌صدا
نیست؛ عمداً پین نشد. پین‌کردنِ آرزو، قرارداد نیست.

### گاردِ قراردادی

`tests/business-panel-contract.integration.test.mts` — **۱۹ تست**، الگویِ
`admin-panel-contract`:
- توکنِ **staffِ واقعی با نقشِ owner** از `signAccess` — نه ادمینِ پلتفرم
- **۱۳ نوع fixtureِ غیرخالی**: رزرو، میز، waitlist، کوپن، عضوِ باشگاه، نظر، thread+پیامِ
  چت، اتوماسیون، یادداشت، رویداد، کمپین، عکس، **customer_insight**
- نبودِ fixture **خطاست**: اجرای اول دقیقاً همین را گرفت — `customers.items` خالی بود
  چون فهرست از `customer_insights` می‌آید نه `users`. یک `.catch(()=>{})` هم در
  fixtureها نیست.
- nullable: نوعِ غیرِ null پین می‌شود؛ null از چکِ نوع معاف است، از چکِ وجود نه.

**اثباتِ غیرتوتولوژی — سه rename در سرور:**

```
[سالم]                                          exit=0
reservations: party_size → partySize          → exit=1 (۴ قرمز)
customers:    churn_risk_score → churnRisk    → exit=1 (۴ قرمز)
chats:        reservation_code → code         → exit=1 (۴ قرمز)
[بازگردانی]                                     exit=0   · src تمیز
```

### پاسِ HTTP زنده

با همان توکنِ owner روی API dev (نه in-process): **۲۰ endpoint × 200**، شکل‌های
بالایی همان جدول. (اجرای اول `NOT_JSON` داد — `/tmp` در Git-Bash برای Node مسیرِ
دیگری است؛ harness، نه سرور.)

---

## ۳. آیا ورودِ business و customer فقط OTP است؟

**نه برای business.** یک مسیرِ رمز وجود دارد که در فرضِ اولیه‌ی ما نبود:

| اپ | مسیر | فایل:خط |
|---|---|---|
| business | **رمز** — `POST /auth/staff/login` (username/password) | [auth/staff/login/route.ts:15,36](../../api/src/app/api/v1/auth/staff/login/route.ts#L15) · UI: [staff-system.js:453-470](../../apps/business/js/staff-system.js#L453) |
| business | OTP — `/auth/staff/request` + `/verify` | همان دایرکتوری |
| business | دموی `file:` (بدونِ بک‌اند) | staff-system.js:468, :500 |
| business | کدِ آفلاینِ `۱۲۳۴` | staff-system.js:511 |
| customer | **فقط OTP** — `/auth/otp/request` + `/verify` | [otp/verify/route.ts:42](../../api/src/app/api/v1/auth/otp/verify/route.ts#L42) |
| customer | دموی آفلاین `۱۲۳۴` / `file:` (مستند در CLAUDE.md) | auth.js:55,67,91 |
| هر دو | `devCode` فقط با `OTP_DEV_MODE` و **در production استثنا** | [otp.ts:146-149](../../api/src/lib/otp.ts#L146) |
| هر دو | `invite/[token]/claim` فقط وضعیت می‌خواند، نشست نمی‌دهد | invite/[token]/claim/route.ts:42-51 |
| هر دو | `refresh` فقط از توکنِ refreshِ معتبر | refresh/route.ts:40 |

مسیرِ رمزِ business «bypass» نیست — احرازِ واقعی با scrypt و rate limit است — ولی
**مسیرِ دومی است که ما نمی‌دانستیم**، و همان یافته است.

---

## ۴. پاک‌سازیِ `[DEMO]` — و یک یافته‌ی سیستمی

### DBِ dev ✅
```
restaurants=0  tenants=1 (Rezervno — پلتفرم)  staff=1 (ardiz)
```

### DBِ تست ⚠️ — سمِ انباشته
پیش از پاک‌سازی: **۷۶ تنانت / ۹۰ رستوران / ۲۵۲ کاربرِ `[DEMO]`** از ۰۸-۲۸ تا ۰۹-۰۲.

| نشت‌دهنده | چرا |
|---|---|
| `hours-change-approval` (۱۴) | `after` دارد ولی `.catch(()=>{})` خطای FK را می‌بلعد |
| شش فایلِ `-plat` (۱۴) | همان الگو |
| `waitlist-flow` (wl-) · `model-registry` (mr-) · `model-drift` (dr-) | همان الگو |
| `provision-slug-validation` (۲) — **خودم، دورِ ۱۱** | provision **میز** می‌سازد؛ `restaurant.deleteMany` روی `tables_restaurant_id_fkey` می‌شکست، catch می‌بلعید، تنانت می‌ماند |

ریشه‌ی مشترک: **۵۱ فایلِ تست** در `after` از `deleteMany(...).catch(()=>{})` استفاده
می‌کنند. پاک‌سازی‌ای که بی‌صدا شکست بخورد، اندازه‌گیریِ بعدی را مسموم می‌کند — همان
درسِ دورِ نهم، این بار در teardown.

**رفع در این دور:** فقط نشت‌دهنده‌ی خودم (ترتیبِ FK: tables → invites → audit → staff →
restaurant → tenant، بدونِ catch). ۵۰ فایلِ دیگر کارِ جداگانه است.
DBِ تست truncate و redis flush شد؛ سوئیتِ کامل روی DBِ تمیز در حالِ اجراست تا نشتِ
**زنده‌ی کدِ فعلی** (نه تاریخچه) اندازه گرفته شود — عدد پس از پایان به این سند
اضافه می‌شود.

---

## راستی‌آزمایی

| گیت | نتیجه |
|---|---|
| `npm test` | **۱۵۲۰ / ۱۵۲۰** (۱۴۹۹ + ۲ پین + ۱۹ گارد) |
| `tsc --noEmit` · `npm run lint` | exit 0 |
| پنج گاردِ ابزاری | همه exit 0 |
| اثباتِ جهش — پین | ۱ حذفِ فیلتر → exit=1، بازگردانی → 0 |
| اثباتِ جهش — گارد | ۳ rename → هر سه exit=1، بازگردانی → 0 |
| پاسِ HTTP زنده | ۲۰ × 200 |
| `_all.runner` | هر دو فایل ثبت، هیچ فایلِ بی‌ثبت |
| CI لینوکس | **اجرا نشده — PR وجود ندارد** |

---

## دو باگِ harnessِ خودم در این دور

۱. `/tmp/lp.json` در Git-Bash ≠ مسیری که Node می‌بیند → `NOT_JSON` کاذب برای ۲۰
   پاسخِ ۲۰۰. با مسیرِ ویندوزی درست شد.
۲. زنجیره‌ی «truncate + سوئیتِ کامل» به سقفِ ۱۰ دقیقه‌ی ابزار خورد و کشته شد؛ DB
   نیمه‌پر ماند. دوباره truncate و این بار در پس‌زمینه.

---

## آنچه باز ماند

۱. **PR** — هنوز برای این شاخه وجود ندارد؛ لینک لازم است.
۲. **۵۰ فایلِ تست با `.catch(()=>{})` در teardown** — رفعِ سیستمی.
۳. **`avg_interval_days`** — یا سرور بفرستد یا UI آن کارت را بردارد.
۴. **مسیرِ رمزِ business** — تصمیم: مستندش کنیم یا حذف؟
