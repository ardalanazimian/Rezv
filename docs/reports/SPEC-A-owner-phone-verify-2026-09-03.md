# راستی‌آزماییِ راهِ شماره‌ی owner + ثبتِ modifiersJson (۲۰۲۶-۰۹-۰۳)

> زمینه: درخواست برایِ افزودنِ «بستنِ raceِ شماره‌ی owner» به PR-A، به‌همراهِ
> یک پیش‌شرطِ صریح: «اول تأیید کن، فرض نکن — آیا شاخه‌ی
> `reconcile/audit-plus-features` (کامیت `d525e48`) در main هست؟»
>
> **حکمِ کوتاه:** پیش‌شرط برقرار است، ولی خودِ کار **از قبل انجام و مرج شده**
> (مهاجرتِ ۰۷۹). به‌جایِ ساختنِ دوباره، گیتِ موجود جهش‌آزمایی شد و **واقعی**
> بودنش اثبات شد. موردِ `modifiersJson` ثبت شد.

---

## ۰. پیش‌شرط — `d525e48` در main هست ✅

هر دو روشِ خواسته‌شده اجرا شد:

```text
$ git cat-file -t d525e48
commit

$ git merge-base --is-ancestor d525e48 origin/main && echo YES
YES: d525e48 IS ancestor of main

$ git ls-tree --name-only origin/main api/prisma/sql/ | grep -E "07[5-9]"
api/prisma/sql/075-economy-ledger-id-default.sql
api/prisma/sql/076-restaurant-provisioning.sql
api/prisma/sql/077-menu-categories.sql
api/prisma/sql/078-menu-modifiers-tags-availability.sql
api/prisma/sql/079-staff-owner-phone-unique.sql   ← این‌جا بود که ترتیب عوض شد
```

مهاجرتِ ۰۷۸ (شاخصِ اعلام‌شده‌ی همان شاخه) موجود است. **ترتیبِ کار عوض نشد.**

---

## ۱. یافته‌ی اصلی — هر چهار بندِ درخواست از قبل بسته شده‌اند

مهاجرتِ `079-staff-owner-phone-unique.sql` روی main دقیقاً همین راه را می‌بندد.
چهار بندِ درخواست، در برابرِ آن‌چه واقعاً در کد هست:

| بند | خواسته | وضعیتِ واقعی روی `origin/main` |
|---|---|---|
| الف | تصمیم درباره‌ی یکتاییِ سراسریِ `staff.phone` + بررسیِ دادهٔ زنده | **انجام‌شده** — یکتاییِ سراسری عمداً **رد** شده |
| ب | مهاجرتِ idempotent + هم‌سوییِ schema + drift سبز | **انجام‌شده** — ۰۷۹ |
| ج | حفظِ چکِ appسطح + نگاشتِ نقضِ قید به `duplicate_owner_phone` | **انجام‌شده** — `provisioning.ts:113,194` |
| د | تستِ fault-injection واقعی با هم‌زمانی | **انجام‌شده** — `admin-create-business.integration.test.mts:231` |

### الف) چرا یکتاییِ سراسری رد شد — استدلالِ ثبت‌شده در خودِ مهاجرت

قید انتخاب‌شده **ایندکسِ جزئی** است، نه یکتاییِ کاملِ ستون:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS staff_owner_phone_unique_idx
  ON staff (phone) WHERE role = 'owner';
```

دو دلیلِ ساختاری که در سربرگِ مهاجرت آمده:

1. **تکرارِ شماره‌ی یک «کارمند» بینِ تنانت‌ها امروز قانونی است.**
   `@@unique([tenantId, phone])` فقط درون‌تنانتی است و ورودِ کارکنان با
   قاعده‌ی «قدیمی‌ترین ثبت برنده» (مهاجرتِ ۰۷۲) resolve می‌شود. یکتاییِ
   سراسری این قابلیت را می‌شکست.
2. **ownerِ دومِ هم‌شماره همیشه حسابِ مرده می‌سازد** — هرگز نمی‌تواند با OTP
   وارد شود. پس همان چیزی که چکِ appسطح از اول رد می‌کرد، حالا در برابرِ
   هم‌زمانی هم قطعی شده.

**دادهٔ زنده:** مهاجرت کوئریِ پیش‌نیازِ deploy را صریح آورده و نتیجه‌اش را در
`docs/reports/PRE-MERGE-VERIFY-2026-08-27.md` ثبت کرده: هر دو DBِ قابل‌دسترسِ
توسعه **صفر ردیفِ تکراری**؛ محیطِ production/staging از آن ماشین در دسترس نبود.

> ⚠️ حدِ این گزارش: من هم آن کوئری را رویِ production اجرا **نکردم** — از این
> محیط هیچ DBِ تولیدی در دسترس نیست. پیش‌نیازِ deploy همچنان برقرار است.

### ج) نگاشتِ P2002 — تأییدِ مستقیم در کد

```text
$ git grep -n "duplicate_owner_phone\|P2002" origin/main -- \
    api/src/lib/provisioning.ts api/src/lib/site-orders.ts
provisioning.ts:113:      'duplicate_owner_phone',
provisioning.ts:153:  // …catch پایین هر دو P2002 (شماره‌ی مالک و …
provisioning.ts:194:      'duplicate_owner_phone',
provisioning.ts:200:    // P2002 به کاربر می‌رسید — همان ۴۰۹ِ مسیرِ ترتیبی را می‌دهیم.
```

هر دو مسیرِ سازنده‌ی owner (`provisionBusiness` و `createTrialAccount`) پوشش
دارند — یعنی ۵۰۰ِ خام برنمی‌گردد.

---

## ۲. کارِ واقعیِ این نشست — اثباتِ توخالی‌نبودنِ گیت

نامِ تست («fault-injection … رول‌بکِ کامل») ادعا می‌کند کار می‌کند. طبقِ قاعده‌ی
۲ در `CLAUDE.md` («سبز بی‌معناست تا وقتی ثابت نکرده‌ای گیت قرمز هم می‌شود»)،
به آن اعتماد نشد و جهش تزریق شد.

```text
# ۱) پایه — ایندکس سرِ جایش
$ psql -d rezervno_test -tAc "SELECT indexdef FROM pg_indexes
    WHERE indexname='staff_owner_phone_unique_idx';"
CREATE UNIQUE INDEX staff_owner_phone_unique_idx ON public.staff
  USING btree (phone) WHERE (role = 'owner'::staff_role)

$ npx tsx --test tests/admin-create-business.integration.test.mts
ok 8 - fault-injection داخلِ تراکنش: بازنده‌ی raceِ شماره‌ی owner رول‌بکِ کامل
       می‌شود — هیچ Tenant/Restaurantِ یتیمی

# ۲) جهش — قید برداشته شد
$ psql -d rezervno_test -c "DROP INDEX staff_owner_phone_unique_idx;"
DROP INDEX

$ npx tsx --test tests/admin-create-business.integration.test.mts
not ok 8 - fault-injection داخلِ تراکنش: بازنده‌ی raceِ شماره‌ی owner …
  error: 'INSERTِ provisioning هرگز پشتِ قفلِ ایندکسِ ۰۷۹ دیده نشد —
          سناریوی race اجرا نشده است'
  code: 'ERR_ASSERTION'

# ۳) بازگردانی
$ psql -d rezervno_test -c "CREATE UNIQUE INDEX IF NOT EXISTS … ;"
CREATE INDEX
```

### حکم: گیت واقعی است — و بهتر از چیزی که خواسته شده بود

جهش قرمز داد، پس تست چیزی را واقعاً می‌سنجد. ولی نکته‌ی مهم‌تر **متنِ خطاست**:

تست ادعا نمی‌کند «ردیفِ تکراری وجود ندارد» — چون آن ادعا وقتی race اصلاً رخ
نداده باشد هم **بی‌صدا سبز** می‌ماند (همان درِ فرارِ خاموشِ قاعده‌ی ۵). به‌جایش
اثبات می‌کند که **INSERTِ دوم واقعاً پشتِ قفلِ ایندکس بلاک شد**. یعنی کنترلِ
مثبت دارد: اگر سناریو اجرا نشود، تست می‌شکند نه اینکه پاس شود.

---

## ۳. ثبتِ `modifiersJson`

ثبت شد در `docs/recovery/OPEN-FINDINGS.md` §۶ با برچسبِ `modifiersJson`.

**راستی‌آزمایی پیش از ثبت** (رویِ `origin/main`):

```text
$ git grep -n "modifiersJson\|modifiers_json" origin/main -- \
    api/prisma/schema.prisma api/src apps
(صفر خروجی)

$ git grep -ni "modifier" origin/main -- docs/recovery/OPEN-FINDINGS.md
(صفر خروجی — یعنی قبلاً ثبت نشده بود)
```

مهاجرتِ ۰۷۸ افزودنی‌ها را فقط به‌عنوانِ **ساختارِ منو** ساخت
(`MenuModifierGroup`/`MenuModifierOption`). کامنتِ خودِ `schema.prisma` این را
صریح گفته: «انتخاب/ذخیره‌اش در سفارش … جداگانه است و ReservationItem دست
نمی‌خورد.»

### مانعِ ساختاری که در بررسی پیدا شد

`ReservationItem` کلیدِ اصلیِ **مرکب** دارد:

```prisma
@@id([reservationId, menuItemId])
```

یعنی هر آیتمِ منو در هر رزرو فقط **یک‌بار** می‌آید. پس حتی با افزودنِ ستونِ
`modifiersJson`، «دو برگر، یکی با پنیر یکی بدون» جا نمی‌شود — هر دو یک ردیف‌اند.

رفعِ درست تغییرِ خودِ PK است، که این‌ها را لمس می‌کند:
- `@@index([menuItemId])` — آمارِ «پرفروش‌ترین آیتم‌ها»
- `onDelete: Restrict` رویِ `menuItem` — یکپارچگیِ تاریخچه‌ی سفارش
- هر کوئریِ موجودی که رویِ یکتاییِ `(reservationId, menuItemId)` حساب کرده

**پس این یک تصمیمِ محصولی + مهاجرتِ اسکیماست، نه یک ستونِ ساده.**

---

## ۴. آن‌چه این گزارش اثبات **نمی‌کند**

صریح، تا با ادعایِ بیشتر اشتباه گرفته نشود:

- **کوئریِ تکراریِ owner رویِ production اجرا نشد** — از این محیط DBِ تولیدی
  در دسترس نیست. پیش‌نیازِ deployِ مهاجرتِ ۰۷۹ همچنان برقرار و لازم است.
- **راهِ باقی‌مانده‌ی «owner + کارمند با یک شماره، هم‌زمان، در دو تنانت»** عمداً
  پوشش داده نشده (خودِ مهاجرت اعلامش کرده) — بستنش یکتاییِ سراسری می‌خواهد که
  قابلیتِ قانونیِ بندِ الف را می‌شکند. من هم بازش نکردم.
- **بندِ الف را من دوباره تصمیم نگرفتم** — تصمیمِ ثبت‌شده‌ی ۰۷۹ را خواندم،
  استدلالش را در برابرِ کد سنجیدم، و تأیید کردم. اگر مالک بخواهد قید عوض شود،
  آن یک تصمیمِ تازه است نه یک راستی‌آزمایی.

---

## ۵. تغییرِ کد در این نشست

روی راهِ owner phone: **هیچ**. کار از قبل انجام شده بود و ساختنِ دوباره‌اش
دقیقاً همان تکرارِ کاری‌ست که در همین مخزن یک‌بار به بسته‌شدنِ PR #38 انجامید.

تغییرِ ثبت‌شده فقط:
- `docs/recovery/OPEN-FINDINGS.md` — بخشِ ۶ (`modifiersJson`)
- همین گزارش
