<!-- ARCHIVED-SNAPSHOT -->
> ## ⚠️ عکسِ لحظه‌ایِ بایگانی‌شده — عدد‌هایش دیگر درست نیستند
>
> این سند گزارشِ یک ممیزیِ **نقطه‌ای** است، نه مرجعِ زنده. با اندازه‌گیریِ
> واقعیِ ۲۰۲۶-۰۸-۲۴ ادعایِ «۸۳ endpoint/route» با شمارشِ واقعیِ **۱۳۵ route** نمی‌خواند.
>
> **برایِ وضعیتِ فعلی این‌ها را بخوان:**
> `docs/audit/CLEANUP-REPORT-2026-08-23.md` · `docs/audit/DEAD-CODE.md` ·
> `docs/audit/CUSTOMER-PROFILE.md` · `docs/recovery/OPEN-FINDINGS.md`
>
> نگه داشته شد چون **دلیلِ** تصمیم‌هایِ آن زمان را ثبت می‌کند (پروتکل §۲: حذف
> بدونِ شواهد ممنوع). هرجا با اسنادِ بالا تعارض داشت، آن‌ها برنده‌اند.

# FULLSTACK_INTEGRATION_AUDIT — رزرونو

> ممیزیِ اتصالِ end-to-end: هر endpointِ بک‌اند ↔ مصرفِ فرانت. مبتنی بر جاروبِ واقعیِ کد.
> تاریخ: ۲۰۲۶-۰۷-۳۰. این سند BACKEND_INVENTORY + FRONTEND_INVENTORY + API_USAGE_MATRIX +
> UNUSED_* + BROKEN_CONNECTIONS + FEATURE_COVERAGE را در خود جمع می‌کند.
>
> روش: استخراجِ ۸۳ endpointِ `route.ts` + استخراجِ همه‌ی path-literalهای فراخوانی‌شده در هر سه اپ.
> محدودیت: چند call-site داینامیک (template literal) با اطمینانِ کمتری تطبیق داده شده — این موارد
> «needs verification» علامت خورده‌اند، نه «dead».

---

## ۱) خلاصه‌ی اتصال
- **۸۳ endpoint** در بک‌اند. اکثریتِ قاطع **مصرف‌شده**اند.
- **۳ endpoint** بدونِ مصرف‌کننده‌ی فرانتِ تأییدشده (کاندیدِ orphan — نیازِ بررسی، نه حذفِ قطعی).
- **هیچ فراخوانیِ فرانت به endpointِ ناموجود** یافت نشد (بدونِ broken call).
- حالتِ خطا/بارگذاری: لایه‌ی `API.request` مرکزی (timeout، refreshِ ۴۰۱، `offline`) → همه‌ی
  فراخوان‌ها حالتِ خطا/آفلاین دارند.

## ۲) موجودیِ بک‌اند (خلاصه)
۸۳ route در گروه‌های: auth(۶)، me/customer(۹)، reservations(۵)، restaurants(۴+live-stats)،
restaurant-panel(~۳۳)، admin(۸)، maintenance/cron(۸)، waitlist/checkin/events/payments/telemetry/
gift-cards، ops(health/metrics). جزئیاتِ لایه‌ی سرویس/دامنه در `docs/backend-audit/BACKEND_ARCHITECTURE_AUDIT.md`.

## ۳) موجودیِ فرانت (خلاصه)
- **customer** (۲۸ ماژولِ ES): main(entry)، api، auth، init، store، actions، reservation، waitlist،
  user-profile، theme-pwa، icons، analytics، data/{seed,discover,detail,booking}، features/{trips,
  loyalty,rewards,food-dna,chat,palette,notifications,a11y,onboarding,pull-refresh,swipe-actions,live-strip}.
- **business** (۱۲): data(+API client)، routing، overview، reservations، waitlist، crm، loyalty،
  marketing، staff-system، chat، analytics، icons.
- **company** (۷): api، data، overview، restaurant، intelligence، analytics، icons.

## ۴) ماتریسِ مصرفِ API (خلاصه‌ی تأییدشده)
### اپ مشتری → بک‌اند
| Endpoint | اکشن/صفحه |
|----------|-----------|
| `POST /auth/otp/*`, `/auth/refresh`, `/auth/logout` | ورود/نشست (auth.js) |
| `GET/PATCH /me`, `GET /me/profile`, `/me/points`, `/me/reservations`, `/me/referral`, `POST /me/push-subscribe`, `/me/chats(+[id])` | پروفایل/سفرها/باشگاه/چت |
| `GET /restaurants(+?cursor)`, `/restaurants/[slug]/availability`, `POST /restaurants/[slug]/chat`, `GET /restaurants/live-stats` | کشف/رزرو/نوارِ زنده |
| `POST /reservations`, `GET /reservations/[code]`, `/reservations/[code]/cancel` | رزرو/لغو |
| `GET/POST /waitlist(+[id]/accept,decline)` | لیستِ انتظار |
| `GET /events`, `GET/POST /gift-cards`, `POST /telemetry` | رویداد/گیفت‌کارت/تله‌متری |

### پنل کسب‌وکار → بک‌اند (`/restaurant/*`)
مصرف‌شده: analytics, ai, automations, branches, campaigns, cashback, chats(+[id]), coupons,
customers(+[userId]), events, heartbeat, hours, members, notes, photos, pricing, reservations(+[code]/
events,status), reviews, rfm, sms, staff, tables(+[id],state), waitlist(+analytics), walkin. + `POST /reservations` + auth + telemetry.

### پنل شرکت → بک‌اند (`/admin/*`)
مصرف‌شده: business-intelligence, overview, restaurants(+[id] dynamic), security, system-health. + auth + telemetry.

## ۵) کاندیدهای Orphan/Unused بک‌اند (نیازِ بررسی — نه حذفِ قطعی)
| Endpoint | مصرف‌کننده‌ی یافت‌شده | طبقه‌بندی |
|----------|----------------------|-----------|
| `GET /api/v1/restaurant/fraud-signals` | — (در business یافت نشد) | **Needs Investigation** (احتمالاً Future Feature / پنلِ آینده) |
| `GET /api/v1/restaurant/reports` | — (در business یافت نشد) | **Needs Investigation** (گزارش‌گیری هنوز UI ندارد) |
| `GET/PATCH /api/v1/admin/settings` | — (در company یافت نشد) | **Needs Investigation** (تنظیماتِ پلتفرم بدونِ UI؟) |
| `PATCH /api/v1/admin/restaurants/[id]/control` | company به `/admin/restaurants/` داینامیک اشاره دارد | **Likely used (verify)** |

> **هشدارِ صداقت:** این‌ها بر اساسِ نبودِ path-literal در جاروب‌اند. چون بعضی فراخوان‌ها داینامیک‌اند،
> پیش از هر حذفی باید با خواندنِ دستیِ فایلِ مربوط (مثلِ company `restaurant.js`, business `crm.js`)
> تأیید شوند. **هیچ‌کدام در این ممیزی حذف نشد.**

## ۶) اتصال‌های شکسته (Broken Connections)
- **فراخوانِ فرانت به endpointِ ناموجود:** یافت نشد.
- **importهای شکسته (فرانتِ customer):** صفر — auditِ resolveِ importها سبز.
- **نکته‌ی معماری (نه باگ):** هر سه فرانت `API base=''` (same-origin) دارند و بک‌اند deploy جداست؛
  پس در production بدونِ تنظیمِ `base`، فرانت‌ها در **حالتِ دمو** کار می‌کنند (fallbackِ عمدی، نه اتصالِ شکسته).
  نقطه‌ی تنظیمِ `rz-api-base` اضافه شده تا اتصالِ واقعی ساده شود.

## ۷) اکشن‌های UI → منطقِ واقعی (Traceability)
- در اپ مشتری، الگوی placeholder (`onclick="toast('…')"`) بررسی شد؛ تنها موردِ باقی‌مانده
  («ویرایش پروفایل») در فاز C17 به `PATCH /me` وصل شد. «کیف پول کش‌بک»/«پشتیبانی» هنوز toastِ
  placeholder‌اند (**فلگِ orphan-UI** — نیازِ backend/flow؛ در بخشِ ۸).
- ژست‌ها (pull-to-refresh, swipe) به منطقِ واقعی (رندر/کلیکِ دکمه‌ی موجود) وصل‌اند، نه fake.

## ۸) Orphan-UI (UI بدونِ منطقِ واقعی — فلگ‌شده)
| UI | فایل | وضعیت |
|----|------|-------|
| «کیف پول کش‌بک» | customer profile | placeholder `toast` — بدونِ endpoint/flow |
| «پشتیبانی» | customer profile | placeholder `toast` — بدونِ صفحه‌ی پشتیبانی |
| AI-strip متنِ پیشنهاد | customer index | متنِ نمونه (hard-coded)؛ endpointِ توصیه‌ی شخصی نیست → کاندیدِ اتصال یا حالتِ خالی |

> این‌ها **فلگ** شده‌اند (طبقِ خواسته)، اجرا نشدند. رفعِ هرکدام یک فازِ جدا با تأییدِ توست.

## ۹) پوششِ ویژگی (خلاصه)
| ویژگی | زنجیره‌ی UI→API→DB | وضعیت |
|-------|--------------------|-------|
| رزرو (customer) | کامل (booking→/reservations→engine→DB) | ✅ Complete |
| لیستِ انتظار | کامل | ✅ Complete |
| پروفایل/ویرایش | کامل (C17→/me) | ✅ Complete |
| کشف/جست‌وجو | کامل (کلاینت + /restaurants) | ✅ Complete |
| نوارِ زنده | کامل (live-stats) | ✅ Complete |
| باشگاه/امتیاز | کامل (/me/points, loyalty) | ✅ Complete |
| کش‌بک-wallet (customer) | فقط UIِ placeholder | ⚠️ Partial/Orphan-UI |
| پشتیبانی (customer) | فقط UIِ placeholder | ⚠️ Missing flow |
| گزارش‌گیریِ رستوران | backend (`/restaurant/reports`) بدونِ UIِ تأییدشده | ⚠️ Orphan-backend |
| fraud-signals | backend بدونِ UIِ تأییدشده | ⚠️ Orphan-backend |
