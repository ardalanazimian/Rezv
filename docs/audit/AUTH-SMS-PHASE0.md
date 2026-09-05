# فازِ ۰ — ورودِ رمزی برای پنل‌ها، OTP فقط برای مشتری، اعتبارنامه‌ی سرویس‌ها از پنلِ شرکت

> ۲۰۲۶-۰۹-۰۲ · شاخه: `feat/admin-totp-login` (`076c9cd`) · **هیچ کدی نوشته نشده**
> این سند فقط واقعیتِ امروزِ کد را با فایل:خط گزارش می‌کند. هیچ تصمیمی نمی‌گیرد.

---

## الف) ورود و provisioning

### الف-۱ — provisioning امروز مالک را چطور می‌سازد

`lib/provisioning.ts` → `provisionBusiness()`:

| مرحله | خط | واقعیت |
|---|---|---|
| یکتاییِ شماره‌ی مالک | [110–113](../../api/src/lib/provisioning.ts#L110) | `staff.findFirst({phone})` → `duplicate_owner_phone` |
| اعتبارنامه | [119–131](../../api/src/lib/provisioning.ts#L119) | **اختیاری**: فقط اگر `username` **و** `password` هر دو در ورودی باشند، `username + passwordHash + passwordUpdatedAt` ساخته می‌شود؛ وگرنه `credentials = null` |
| ساختِ staff | [176–179](../../api/src/lib/provisioning.ts#L176) | `role:'owner', isActive:true, ...(credentials ?? {})` — یعنی مالک **بدونِ اعتبارنامه هم ساخته می‌شود** |
| رستوران | [168](../../api/src/lib/provisioning.ts#L168) | `provisionStatus: 'PENDING_ACTIVATION'`، `smsBalance: 50` (:169) |
| دعوت | [148, 183–186, 218](../../api/src/lib/provisioning.ts#L183) | `staffInvite` با token ۳۲ بایتی، TTL؛ `sendInviteSms` → لینکِ `invite.html#token=…` (:50–60) |

**OTP کجای مسیر است:** در خودِ provisioning **نیست**. فعال‌سازی (`PENDING_ACTIVATION → ACTIVE`) در `acceptPendingInvites()` ([251–266](../../api/src/lib/provisioning.ts#L251)) رخ می‌دهد که فقط از **دو** جا صدا زده می‌شود:

- [`auth/staff/verify/route.ts:49`](../../api/src/app/api/v1/auth/staff/verify/route.ts#L49) — پس از OTPِ موفق
- [`auth/staff/login/route.ts:40`](../../api/src/app/api/v1/auth/staff/login/route.ts#L40) — پس از ورودِ **رمزی**ِ موفق

یعنی مسیرِ رمز **همین حالا** رستوران را فعال می‌کند؛ OTP تنها راه نیست. ولی صفحه‌ی دعوت ([`apps/business/invite.html`](../../apps/business/invite.html) بلوکِ `st-valid`) فقط یک CTA دارد: «ورود با کدِ پیامکی» → `href="./"`. **UIِ دعوت فقط OTP را پیشنهاد می‌کند.**

مسیرِ دومِ ساختِ مالک — ثبت‌نامِ self-serve از سایت: [`lib/site-orders.ts:329–330`](../../api/src/lib/site-orders.ts#L329) `staff.create({phone, name, role:'owner', isActive:true})` — **هیچ username/password**؛ `smsBalance: 50` (:314). این مسیر فقط با OTP قابلِ ورود است.

### الف-۲ — `passwordUpdatedAt`

| کجا | چه |
|---|---|
| نوشتن | `provisioning.ts:131` · `admin/staff-credentials/route.ts:137,140` · `restaurant/staff/password/route.ts:56` |
| خواندن | **فقط** `admin/staff-credentials/route.ts:53–54` → `has_password: !!s.passwordUpdatedAt` و `password_updated_at` در پاسخِ GET |

**«باید رمز عوض شود»**: **وجود ندارد.** grep برای `mustChange|forceReset|passwordExpired|requirePasswordChange` در `src/` و `schema.prisma` صفر نتیجه. `passwordUpdatedAt` جایی برای اجبار یا انقضا خوانده نمی‌شود.

### الف-۳ — مالک از پنلِ business چه می‌تواند

[`restaurant/staff/route.ts`](../../api/src/app/api/v1/restaurant/staff/route.ts):

| متد | ورودی (خط) | می‌تواند رمز ست کند؟ |
|---|---|---|
| GET | فهرستِ staffِ تنانت (:95–105) — `id,name,phone,role,is_active,restaurant_id,permissions` (:89–90) | — |
| POST | `phone, name, role∈{staff,manager}, permissions` (:26–31) | **نه** — username/password در schema نیست |
| PATCH | `name, is_active, permissions, restaurant_id` (:33–40) | **نه** |

[`restaurant/staff/password/route.ts`](../../api/src/app/api/v1/restaurant/staff/password/route.ts) POST — **فقط خودِ کاربر** (`where: { id: auth.sub }` :42):

- `current_password?` · `new_password` · `username?` (:12–15)
- اگر از قبل `passwordHash` دارد، `current_password` **الزامی** است (:47–52)؛ اگر ندارد (اولین بار)، بدونِ رمزِ فعلی ست می‌شود
- می‌تواند `username` هم ست/عوض کند (:15, :60)

پس: مالک رمزِ **خودش** را می‌تواند ست/عوض کند؛ برای **کارکنانش نمی‌تواند** رمز بسازد — تنها جای ساختِ اعتبارنامه برای دیگران، پنلِ **شرکت** است (بندِ بعد).

### الف-۱ ادامه — پنلِ شرکت همین حالا اعتبارنامه‌ی مالک را می‌سازد

[`admin/staff-credentials/route.ts`](../../api/src/app/api/v1/admin/staff-credentials/route.ts):

- GET `?restaurant_id` (:23–55): staffِ رستوران با `username`, `has_password`, `password_updated_at`
- POST (:15–20 schema · :90–140): `restaurant_id, phone, username, password, role?` → find-or-create با `tenantId_phone` (:101–103)، `role ?? 'owner'` (:110)، هش و `passwordUpdatedAt` (:137,140)، گاردِ owner-تکراری (:120–128)

UI: [`apps/company/js/restaurant.js:62`](../../apps/company/js/restaurant.js#L62) (GET) و [`:112–114`](../../apps/company/js/restaurant.js#L112) (POST با `restaurant_id, phone, username, password`)؛ جدول `username`/`has_password` را نشان می‌دهد (:71–73).

**⇒ «رمزِ اولیه‌ی مالک از پنلِ شرکت» همین حالا وجود دارد** — هم API هم UI.

### الف-۴ — نقاطِ OTP در پنلِ business

سرور:
- `POST /auth/staff/request` → [`auth/staff/request/route.ts:62`](../../api/src/app/api/v1/auth/staff/request/route.ts#L62)
- `POST /auth/staff/verify` → [`auth/staff/verify/route.ts`](../../api/src/app/api/v1/auth/staff/verify/route.ts) (:49 فعال‌سازی)

کلاینت — helperها در [`apps/business/js/data.js`](../../apps/business/js/data.js): `requestStaffOtp` (:247) · `verifyStaffOtp` (:249) · `staffLogin` رمزی (:239).

UI — [`apps/business/js/staff-system.js`](../../apps/business/js/staff-system.js):

| تابع | خط | نقش |
|---|---|---|
| `showStaffLogin` | 444 | فرمِ **رمز** (پیش‌فرض) با دکمه‌ی «ورود با پیامک» → `showStaffLoginPhone()` (:455) |
| `staffPasswordLogin` | 460 | ورودِ رمزی؛ `file:` → دمو (:468) |
| `showStaffLoginPhone` | 479 | فرمِ شماره؛ دکمه‌ی بازگشت به رمز (:488) |
| `staffSendOtp` | 492 | `requestStaffOtp`؛ `file:` → دمو (:500)؛ آفلاین → `۱۲۳۴` (:511) |
| `showStaffLoginCode` | 514 | فرمِ کد؛ «تغییر شماره» (:523) |

نقاطِ ورود به فرم: خروج (:594)، انقضای نشست (:602)، بوتِ بدونِ توکن (:627) — **هر سه `showStaffLogin()` یعنی فرمِ رمز**. OTP فقط از دکمه‌ی :455 قابلِ دسترسی است.

**برای خاموش‌کردن با فلگ، نقاطی که باید فلگ بخورند:**
1. سرور: `auth/staff/request` و `auth/staff/verify` (رد با ۴۰۴/۴۰۳ وقتی فلگ off)
2. کلاینت: رندرِ دکمه‌ی :455 (نه `display:none` — همان درسِ فیلدِ TOTP)، و توابعِ :479/:492/:514
3. [`invite.html`](../../apps/business/invite.html) بلوکِ `st-valid`: CTAی «ورود با کدِ پیامکی»
4. **یک سیگنالِ عمومی برای پنلِ استاتیک** — امروز هیچ endpointِ غیرِادمینی فلگ را برنمی‌گرداند (بندِ ب)

### الف-۵ — پنلِ شرکت هنوز OTP دارد؟ **بله**

سرور: [`auth/admin/request/route.ts:51,64`](../../api/src/app/api/v1/auth/admin/request/route.ts#L51) (`findPlatformAdmin` + `requestOtp`) و [`auth/admin/verify/route.ts:21–30`](../../api/src/app/api/v1/auth/admin/verify/route.ts#L21) (صدورِ همان principalِ platform-admin). `findPlatformAdmin` ([`lib/platform-admin.ts:11`](../../api/src/lib/platform-admin.ts#L11)): `phone + PLATFORM_ADMIN_TENANT_ID + owner + isActive`.

کلاینت: helperها [`apps/company/js/api.js:69,71`](../../apps/company/js/api.js#L69)؛ UI [`intelligence.js`](../../apps/company/js/intelligence.js) `showAdminLoginPhone` (:920) · `adminSendOtp` (:933) · `showAdminLoginCode` (:954)؛ نقاطِ ورود: دکمه‌ی «ورود با پیامک» در فرمِ رمز (:870) و «تغییر شماره» (:963).

**نکته‌ی امنیتی برای تصمیم:** مسیرِ OTPِ admin **TOTP نمی‌خواهد** — دور می‌زند عاملِ سومی که در `auth/admin/login` ساخته شد. (واقعیتِ امروز؛ تصمیمش با شماست.)

---

## ب) `platform_settings`

### schema
[`schema.prisma`](../../api/prisma/schema.prisma) `model PlatformSettings` → جدولِ `platform_settings`:
`key String @id` · `value String` · `updatedAt` · `updatedBy String?` — **مقدار متنِ خام است.**

### خواندن / کش / env fallback
[`lib/platform-settings.ts`](../../api/src/lib/platform-settings.ts):
- `getPlatformSetting(key, envFallback?)` (:14–19): `cached('platform-settings:'+key, TTL_SEC=30)` (:11,15) → اگر DB نداشت `envFallback` (:19)
- `setPlatformSetting(key, value, updatedBy?)` (:23)
- `getZarinpalConfig()` (:33–36): fallback به `ZARINPAL_MERCHANT_ID` / `ZARINPAL_SANDBOX`

مصرف‌کننده‌های دیگر: `economy-rules.ts:35–36` (`economy_rule:*`)، `feature-flags.ts:53` (`feature_flag:*`)، `site-orders.ts:218` (`sales_notify_email`).

### رمزنگاری: **هیچ**
grep `crypto|cipher|encrypt|decrypt` در `platform-settings.ts` → صفر. مقدار همان‌طور که وارد شده در DB می‌نشیند.

### `GET /admin/settings` مقدارِ خام را به UI می‌فرستد
[`admin/settings/route.ts`](../../api/src/app/api/v1/admin/settings/route.ts): `ALLOWED_KEYS = ['zarinpal_merchant_id','zarinpal_sandbox','sales_notify_email']` (:19)؛ GET (:33–36) همه را **بدونِ mask** برمی‌گرداند؛ PATCH `{settings:[{key,value≤500}]}` فقط برای همان سه کلید (:23–24, :41–49) + audit (:54).

⇒ برای ملی‌پیامک: **کلیدی در ALLOWED_KEYS نیست**، و اعتبارنامه‌ی ملی‌پیامک امروز **فقط از env** خوانده می‌شود: [`lib/sms.ts:55–62`](../../api/src/lib/sms.ts#L55) (`MELIPAYAMAK_BODYID_*` در زمانِ لودِ ماژول) و [`:217–218`](../../api/src/lib/sms.ts#L217) (`MELIPAYAMAK_USERNAME/PASSWORD`). `sms.ts` هیچ `getPlatformSetting`ی ندارد.

### UI تنظیمات در `apps/company`: **وجود ندارد**
grep `admin/settings|zarinpal_merchant_id|sales_notify_email|melipayamak` در `apps/company/js/*` → صفر (تأییدِ دورِ دوازدهم). endpoint هست، صفحه نیست.

### فلگ‌ها (برای «OTP خاموش با فلگ»)
[`lib/feature-flags.ts`](../../api/src/lib/feature-flags.ts): کلیدها allowlist (`FEATURE_FLAG_KEYS` :13–18، شش کلید)؛ ذخیره در `platform_settings` با پیشوندِ `feature_flag:`؛ **پیش‌فرضِ نبودِ کلید = فعال** (:52–56) مگر در `DEFAULT_OFF` (:46–48، فقط `gift_card_purchase_enabled`). پس مکانیزمِ «پیش‌فرض off» وجود دارد (افزودن به `DEFAULT_OFF`). خواندن فقط از **`admin/feature-flags`** و داخلِ routeهای سرور — **هیچ endpointِ عمومی برای پنل‌های استاتیک نیست.**

---

## ج) اقتصادِ پیامک

### آیا هر ارسال واقعاً `smsBalance` را کم می‌کند؟ — **فقط وقتی `restaurantId` داشته باشد**

[`lib/sms-balance.ts`](../../api/src/lib/sms-balance.ts) `consumeSms(restaurantId, count, reason)` (:56–92): یک `UPDATE … SET sms_balance = sms_balance - n, sms_total_sent = sms_total_sent + n WHERE … sms_balance >= n` اتمیک (:77) → اگر ردیفی نخورد `return false` (:83) و **ارسال نمی‌شود**؛ اگر خورد، `smsTransaction.create` (:85).

دو نقطه‌ی مصرف:
- مسیرِ صف (عادی): [`lib/worker.ts:12–19`](../../api/src/lib/worker.ts#L12) — `if (p.restaurantId) { consumeSms(...,'campaign'); if(!ok) throw }` سپس `sendSmsNow`
- مسیرِ fallback (صف خاموش): [`lib/sms.ts:147–163`](../../api/src/lib/sms.ts#L147) — همان شرط؛ `insufficient_balance` → metric + `return` (**fail-closed**)

**موجودیِ صفر ⇒ fail-closed، در هر دو مسیر.** ولی: `reason` در مسیرِ worker همیشه `'campaign'` است حتی برای یادآوری/تأیید (:13) — برچسبِ دفتر دقیق نیست.

**بدونِ `restaurantId` ⇒ هیچ چک، هیچ کسر، هیچ دفتر** — worker.ts:11 صریحاً: «OTP و پیامک‌های سطحِ پلتفرم restaurantId ندارند → بدونِ چک ارسال».

### `sms_transactions` چه ثبت می‌کند
`model SmsTransaction`: `restaurantId, delta:Int, reason:String, balanceAfter:Int, actorId?, note?, createdAt` — دفترِ **per-restaurant**. برای پلتفرم (بدونِ رستوران) هیچ ردیفی وجود ندارد.

### شارژ فقط از یک جا
`topupSms()` (:26–45، `increment` + ledger با `actorId`) تنها یک صداکننده دارد: [`admin/restaurants/[id]/sms/route.ts:38`](../../api/src/app/api/v1/admin/restaurants/[id]/sms/route.ts#L38). موجودیِ اولیه: `STARTER_SMS_BALANCE = 50` (:8) در provisioning (:169, :372)، site-orders (:314)، branches (:99).

**مسیرِ پرداخت برای خریدِ شارژ: وجود ندارد.** grep `sms` در `app/api/v1/payments/*` و `lib/zarinpal.ts` → صفر. `site-orders.ts` بسته‌ی پیامکی ندارد.

### قیمتِ هر پیامک: **تعریف نشده**
grep `SMS_PRICE|PRICE_PER_SMS|sms…price|price…sms` در `src/`, `schema.prisma`, `docs/` → صفر. واحدِ حساب «تعدادِ پیامک» است، نه تومان؛ per-operator هم نیست.

---

## د) پیامکِ OTPِ مشتری از حسابِ کیست؟

[`lib/otp.ts:158`](../../api/src/lib/otp.ts#L158): `enqueueSms({ to, template:'otp', tokens:[code] })` — **بدونِ `restaurantId`**. و `enqueueSms` برای `otp` مستقیم `sendSmsNow` می‌زند ([`sms.ts:185`](../../api/src/lib/sms.ts#L185))، نه صف.

⇒ OTP از موجودیِ **هیچ‌کس** کم نمی‌شود: نه رستوران (درست — مشتری به رستورانی وصل نیست)، نه پلتفرم — چون **دفترِ سطحِ پلتفرم اصلاً وجود ندارد**. تنها ردِ آن `metrics.smsSent{template:otp}` است ([`sms.ts:310`](../../api/src/lib/sms.ts#L310)). همین برای `staff_invite` و پیامک‌های ادمین هم صادق است.

---

## جدولِ «هست / نیست / ناقص»

| بند | موضوع | وضعیت | شاهد |
|---|---|---|---|
| الف | ورودِ رمزی برای business | **هست** | `auth/staff/login`، `staff-system.js:444–470` (پیش‌فرضِ UI) |
| الف | ورودِ رمزی برای company | **هست** (+TOTP) | `auth/admin/login` |
| الف | رمزِ اولیه‌ی مالک از پنلِ شرکت | **هست** — API و UI | `admin/staff-credentials`، `restaurant.js:112` |
| الف | provisioning با اعتبارنامه | **ناقص** — اختیاری؛ self-serve هرگز اعتبارنامه نمی‌سازد | `provisioning.ts:119–131`، `site-orders.ts:329` |
| الف | فعال‌سازیِ رستوران با ورودِ رمزی | **هست** | `staff/login/route.ts:40` |
| الف | صفحه‌ی دعوت با مسیرِ رمز | **نیست** — فقط CTAی OTP | `invite.html` `st-valid` |
| الف | «باید رمز عوض شود» / انقضا | **نیست** | grep صفر |
| الف | مالک برای کارکنانش رمز بسازد | **نیست** | `restaurant/staff` POST/PATCH بدونِ password |
| الف | فلگِ خاموش‌کردنِ OTPِ staff | **نیست** — کد و UI هر دو زنده | `auth/staff/request|verify`، `staff-system.js:455,479–523` |
| الف | OTPِ company | **هست** و TOTP را دور می‌زند | `auth/admin/request|verify`، `intelligence.js:870,920–963` |
| ب | جدولِ `platform_settings` + کش + env fallback | **هست** | `platform-settings.ts:11–19` |
| ب | رمزنگاریِ مقادیر | **نیست** | grep صفر |
| ب | `GET /admin/settings` بدونِ mask | **هست** (خام) | `admin/settings/route.ts:33–36` |
| ب | کلیدِ ملی‌پیامک در settings | **نیست** — فقط env | `ALLOWED_KEYS` :19؛ `sms.ts:55–62,217` |
| ب | UI تنظیمات در company | **نیست** | grep صفر |
| ب | مکانیزمِ فلگ با پیش‌فرضِ off | **هست** (`DEFAULT_OFF`) | `feature-flags.ts:46–56` |
| ب | endpointِ عمومیِ فلگ برای پنل‌های استاتیک | **نیست** | فقط `admin/feature-flags` |
| ج | کسرِ اتمیک + fail-closed رویِ صفر | **هست** | `sms-balance.ts:77–83`، `worker.ts:12–16`، `sms.ts:158–163` |
| ج | دفترِ `sms_transactions` | **هست** (per-restaurant) | model + `:85` |
| ج | برچسبِ `reason` دقیق | **ناقص** — همیشه `'campaign'` در worker | `worker.ts:13` |
| ج | شارژ از پنلِ شرکت | **هست** | `admin/restaurants/[id]/sms` |
| ج | خریدِ شارژ با زرین‌پال | **نیست** | grep صفر |
| ج | قیمتِ هر پیامک | **نیست** | grep صفر |
| د | حسابِ OTPِ مشتری | **نیست** — نه رستوران، نه پلتفرم؛ فقط metric | `otp.ts:158`، `worker.ts:11`، `sms.ts:310` |

---

## پیشنهادِ ترتیبِ اجرا (ترتیب، نه تصمیم)

بر اساسِ وابستگی‌ها، نه اولویتِ محصول:

1. **سیگنالِ عمومیِ فلگ** — تا پنل‌های استاتیک بدانند OTP خاموش است (الگویِ `GET /auth/admin/login` → `totp_required`). بدونِ این، هیچ خاموش‌کردنی در UI بدونِ `display:none` ممکن نیست.
2. **فلگِ `staff_otp_login_enabled`** در `DEFAULT_OFF` + گارد در `auth/staff/request|verify` + رندرِ شرطیِ دکمه‌ی :455 و CTAی `invite.html`. همان برای `admin_otp_login_enabled` روی `auth/admin/request|verify` و دکمه‌ی :870.
3. **provisioning با اعتبارنامه‌ی اجباری** (یا تولیدِ رمز) — چون با OTP خاموش، مالکی که از `site-orders` یا provisioningِ بی‌اعتبارنامه ساخته شده **هیچ راهِ ورودی** ندارد. `admin/staff-credentials` از قبل ابزارش را دارد.
4. **کلیدهای ملی‌پیامک در `platform_settings`** — نیازمندِ: افزودن به `ALLOWED_KEYS`، خواندن در `sms.ts` (که الان در **لودِ ماژول** env می‌خواند، :50)، mask در GET، و تصمیمِ رمزنگاری (امروز هیچ). UI تنظیمات باید از صفر ساخته شود.
5. **دفترِ سطحِ پلتفرم برای OTP/دعوت** — اگر «شارژِ واقعی» قرار است حساب داشته باشد، امروز هیچ جایی برای ثبتش نیست.
6. قیمت و مسیرِ پرداخت — مستقل از بقیه، بزرگ‌ترین بخشِ تازه.

**هیچ کدی نوشته نشده.**
