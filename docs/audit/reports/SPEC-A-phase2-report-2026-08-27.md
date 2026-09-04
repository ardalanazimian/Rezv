# گزارشِ تحویلِ SPEC-A فاز ۲ — افزودنی‌ها، برچسب‌ها، پنجره‌ی سرو، اتصالِ pre-order

> تاریخ: ۲۰۲۶-۰۸-۲۷ · شاخه: `reconcile/audit-plus-features` · کامیت: `d525e48` (پوش‌شده)
> پیش‌نیاز: فاز ۱ (`5903345`) و SPEC-B (`f4c27e4`) — هر دو merge‌شده.
> روش: reconcileِ سورس‌محور (جدولِ B1..B10 در planِ مصوب) — هیچ ادعایی بدونِ خروجیِ اجراشده.

---

## ۱. خروجی‌های خامِ verify (همه واقعاً اجرا شدند)

```text
TypeScript: No errors found                  ← tsc پس از هر گامِ بک‌اند + apps/seo
RUN1=0 · RUN2=0                              ← apply-sql دو بارِ پشت‌سرهم با مهاجرتِ ۰۷۸
ℹ tests 3    pass 3    fail 0                ← گاردِ schema-drift (اولین تلاش — بدونِ قرمزی)
ℹ tests 7    pass 7    fail 0                ← menu-modifiers-tags.integration (جدید)
ℹ tests 6    pass 6    fail 0                ← preorder-validation.integration (جدید)
ℹ tests 1434 pass 1434 fail 0                ← سوئیتِ کاملِ بک‌اند (پایه ۱۴۲۱ + ۱۳ جدید) + lint پاک
36 passed                                    ← دو اسپکِ منو (business + customer) × ۳ پروفایل
503 passed · 5 failed (37.4m)                ← سوئیتِ کاملِ E2E زیرِ بارِ سه‌موتوره
14 passed (2.0m)                             ← همان ۵ شکست، ایزوله روی mobile-safari → همه سبز
✓ بسته‌ی standalone با منبع هم‌خوان است
✓ دیزاین‌سیستم با shared/ هماهنگ است
```

```text
To https://github.com/ardalanazimian/Rezv.git
   5903345..d525e48  reconcile/audit-plus-features -> reconcile/audit-plus-features
۳۲ فایل تغییر · working tree clean
```

### درباره‌ی آن ۵ شکست — صادقانه

هر پنج شکست فقط روی `mobile-safari` و فقط زیرِ بارِ هم‌زمانِ سه موتورِ مرورگر بودند
(چهار اسپکِ قدیمیِ شیتِ رزرو + یک اسپکِ جدیدِ منو). در اجرای **ایزوله** روی همان
پروفایل هر ۱۴ تستِ آن فایل‌ها سبز شدند. این همان کلاسِ مستندِ «اشباعِ `npx serve`
زیرِ بارِ سه موتور» است (کامنت‌های `e2e/playwright.config.ts:28-42` — هر flakeِ
بررسی‌شده‌ی تاریخی هم بدونِ استثنا تایم‌اوتِ goto بود، نه شکستِ assertion).
چون `booking.js` در همین فاز ویرایش شده بود، تا پیش از اجرای ایزوله رگرسیونِ کد
رد نشد — بعد از ۱۴/۱۴، تشخیص قطعی شد: اشباعِ محیط، نه رگرسیون.

---

## ۲. چه ساخته شد

| لایه | تحویل |
|---|---|
| **DB** | `api/prisma/sql/078-menu-modifiers-tags-availability.sql`: جداولِ `menu_modifier_groups` / `menu_modifier_options` (min/max انتخاب + دلتای قیمت)، `menu_item_tags` + enumِ ۹تاییِ `menu_tag`، و `menu_items.availability jsonb`. کاملاً idempotent؛ PKها **بدونِ DEFAULTِ DB** (کلاینتی — هیچ backfillی نیست، برخلافِ ۰۷۷)؛ FKها با نامِ emitِ Prisma و `ON UPDATE CASCADE`. |
| **API پنل** | چهار routeِ جدید: `menu/[id]/modifiers` (GET/POST گروه)، `menu/modifier-groups/[id]` (PATCH/DELETE + POST=گزینه)، `menu/modifier-options/[id]`، `menu/[id]/tags` (PUT جایگزینِ کامل). همه با ضدِ IDORِ دو/سه-hop و invalidate. گاردِ **دوطرفه‌ی** «قیمتِ نهایی هرگز منفی نشود»: هم دلتای گزینه، هم کاهشِ قیمتِ آیتم (۴۲۲ با نامِ گزینه‌ی مقصر). |
| **API عمومی** | `tags[]` + `modifiers[]` (فقط نمایش) + `availability` روی آیتم‌ها در هر دو endpoint (فقط افزودنی)؛ TTLِ منویِ عمومی ‏۶۰→**۳۰۰**؛ فیلترِ پنجره‌ی سرو **پس از خواندنِ کش** (`lib/menu-availability.ts`) — کش کامل می‌ماند، سرو فیلترشده. |
| **pre-order** | `lib/reservations.ts`: اعتبارسنجی به **قبل از** درجِ `ReservationItem` منتقل شد + سه شرطِ جدید — `isActive`، `!isOutOfStock`، و پنجره نسبت به **`slotStart`** (نه «اکنون»). همه‌ی ردها ۴۲۲ی تمیزِ فارسی؛ قیمت همچنان فقط از DB (`checkout.subtotal`). |
| **پنلِ بیزنس** | فرمِ آیتم: chipهای برچسب (`MENU_TAG_LABEL`) + پنجره‌ی سرو (چک‌باکسِ روزها — قراردادِ سرور ۰=یکشنبه…۶=شنبه — و دو ورودیِ ساعت) + جعبه‌ی lazyِ «افزودنی‌ها» (CRUD گروه/گزینه)؛ badgeِ «⏱ محدود» روی ردیف. چهار حالتِ صفحه دست‌نخورده. |
| **اپِ مشتری** | chipهای برچسبِ فارسی روی کارتِ آیتم؛ **سیم‌کشیِ واقعیِ pre-order**: انتخابِ چیپ‌ها در گذارِ گام۲→۳ در `bk.preorder` ذخیره و به‌شکلِ `preorder:[{menu_item_id,qty:1}]` ارسال می‌شود؛ آیتمِ ناموجود/بدونِ id چیپ نمی‌گیرد؛ `sw.js` → **v36**. |
| **SEO / صفحه‌ی QR** | `MenuBoard`: برچسب‌های فارسی + badgeِ «ناموجود» + خطوطِ افزودنی — همچنان صفر جاوااسکریپتِ کلاینت (SSR خالص). |
| **تست** | +۱۳ تستِ backend (۷ منو، ۶ pre-order) و +۴ تستِ E2E؛ `mock-api` صاحبِ `captured.reservation` برای قفلِ payloadِ واقعی. |
| **اسناد** | `docs/DATABASE.md` (بخشِ ۰۷۸)، `docs/API_REFERENCE.md` (endpointها + قراردادِ ردهای pre-order)، `docs/FRONTEND.md`، و یادداشتِ reconcileِ فاز ۲ در `docs/specs/SPEC-A-menu.md`. |

### فایل‌های تغییرکرده (۳۲ فایل — ۵ جدید)

- **جدید**: `api/prisma/sql/078-…`، `api/src/lib/menu-availability.ts`، سه routeِ modifier/tags، دو فایلِ تستِ backend
- **ویرایش**: `schema.prisma`، `menu/route.ts`، `menu/[id]/route.ts`، دو routeِ عمومی، `reservations.ts`، `_all.runner.mts`، `data.js`، `menu.js`، `api.js`، `detail.js`، `booking.js`، `sw.js`، `MenuBoard.tsx`، `seo/lib/api.ts`، `mock-api.ts`، دو اسپکِ E2E، چهار سند، دو standalone

---

## ۳. سه یافته‌ی تعیین‌کننده‌ی کاوش (که شکلِ برنامه را عوض کردند)

۱. **چیپ‌های پیش‌سفارشِ اپِ مشتری کاملاً تزئینی بودند** — انتخاب فقط class می‌گرفت
   و payloadِ `POST /reservations` (booking.js:284-291ی قبلی) هیچ `preorder`ی
   نداشت؛ یعنی وعده‌ی «+۲۰ امتیاز» پوچ بود. حالا E2E قفل کرده که سرور دقیقاً
   `menu_item_id` انتخابی را می‌بیند.
۲. **باگِ ترتیبِ درج/اعتبارسنجی در رزرو** — چکِ cross-restaurant از رفعِ امنیتیِ
   ۰۸-۱۳ موجود بود ولی *بعد از* `reservationItem.createMany` اجرا می‌شد؛ UUIDِ
   جعلی به‌جای ۴۲۲ی تمیز به خطای خامِ FK می‌خورد. تستِ اختصاصی: «۴۲۲، نه P2003».
۳. **invalidationِ فعالِ کش از فاز ۱ کامل بود** — پس TTL طبق دستور ۳۰۰ شد ولی
   نامِ کلیدِ موجود (`restaurant-public-menu`) ماند (تصمیمِ مصوبِ A7؛ بیرون
   قابل‌مشاهده نیست، rename فقط churn بود).

### باگ‌هایی که خودِ E2E این فاز شکار کرد

- **جمع‌آوری از DOMِ جایگزین‌شده**: در لحظه‌ی submit، رندرِ گامِ ۳ چیپ‌های گامِ ۲
  را از DOM برده بود → payload خالی می‌رفت. راه‌حل: snapshot در `bk.preorder`
  هنگامِ گذارِ گام۲→۳.
- **hit-testِ چک‌باکس در WebKitِ موبایل** داخلِ مودال → `check({force})` +
  assertِ صریحِ `toBeChecked` (حالتِ واقعی همچنان قفل است).

### اصلاحِ یک حدسِ غلطِ خودم

B10ِ plan گفته بود شیمِ اعتبارسنجی `z.enum` ندارد — غلط بود (`validate.ts:232`).
در یادداشتِ reconcileِ spec ثبت شد؛ برچسب‌ها با whitelistِ صریحِ enumِ Prisma
رد/قبول می‌شوند (پیامِ خطا نامِ برچسبِ بد را می‌گوید).

---

## ۴. طبقِ تصمیم‌های مصوب ساخته نشد (صریح)

| مورد | چرا |
|---|---|
| انتخاب/ذخیره‌ی modifier در سفارش (`modifiersJson`) | §۲-۴ خودِ spec: «اگر لازم شد، migrationِ جداگانه» — B5؛ `ReservationItem` و PK مرکبش دست‌نخورده |
| تغییرِ نامِ کلیدِ کش به `menu:public:{slug}` | B1 — کلیدِ داخلی است؛ فقط TTL طبق دستور ۳۰۰ شد |
| i18n برچسب‌ها | خارج از spec؛ label mapِ فارسیِ کوچک per-app (الگوی موجودِ `BRAND_*_LABEL`) |

---

## ۵. وضعِ کلیِ SPEC-A و SPEC-B

| قطعه | وضعیت | کامیت |
|---|---|---|
| SPEC-B (provisioning از پنلِ کمپانی + دعوتِ owner) | ✅ کامل + بازبینیِ adversarial (SHIP-WITH-NOTES) | `f4c27e4` |
| صفحه‌ی دعوتِ OTP-only + لینکِ ضدِ-redirect | ✅ کامل | `585a8a1` |
| SPEC-A فاز ۱ (دسته‌ها، ناموجود، reorder، invalidation) | ✅ کامل | `5903345` |
| SPEC-A فاز ۲ (این گزارش) | ✅ کامل | `d525e48` |

یادآوریِ بازِ قبلی (از reviewerِ SPEC-B، هنوز باز): پنجره‌ی raceِ شماره‌ی تکراریِ
owner در provisioning (چکِ dup بیرونِ تراکنش + نبودِ یکتاییِ سراسریِ phone) و
تستِ اتمیک‌بودنی که واقعاً fault-injection داخلِ تراکنش ندارد.
