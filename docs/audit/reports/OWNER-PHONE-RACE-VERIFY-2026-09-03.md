# راستی‌آزماییِ raceِ شماره‌ی owner + ثبتِ `modifiersJson`

**تاریخ:** ۲۰۲۶-۰۹-۰۳ · **شاخه:** `feat/admin-totp-login` · **دامنه:** بندهای الف–د دستورِ PR-A + ثبتِ یافته‌ی باز

> **خلاصه در یک خط:** بندهای الف تا د **از قبل ساخته شده و در main بودند**؛ من به پیامِ
> کامیت اعتماد نکردم و هر چهار بند را زنده اجرا و falsifiability‌شان را اثبات کردم.
> تنها کارِ تازه‌ی این دور، ثبتِ `modifiersJson` است.

---

## ۰. تأییدِ ترتیب — «اول تأیید کن، فرض نکن»

```
$ git merge-base --is-ancestor d525e48 main
exit=0

$ git ls-tree main --name-only api/prisma/sql/ | tail -4
api/prisma/sql/076-restaurant-provisioning.sql
api/prisma/sql/077-menu-categories.sql
api/prisma/sql/078-menu-modifiers-tags-availability.sql   ← موجود
api/prisma/sql/079-staff-owner-phone-unique.sql

$ git log -1 --format='%h %ad %s' --date=short d525e48
d525e48 2026-08-27 SPEC-A فاز ۲: افزودنی‌ها، برچسب‌ها، پنجره‌ی سرو، و سیم‌کشیِ واقعیِ pre-order
```

**نتیجه:** `reconcile/audit-plus-features` در main هست — با **هر دو** روشِ خواسته‌شده
(ancestor و وجودِ مهاجرتِ ۰۷۸). **ترتیب عوض نمی‌شود.**

---

## ۱. یافته‌ی غیرمنتظره: بندهای الف–د از قبل بسته بودند

`ls api/prisma/sql/` نشان داد مهاجرتِ **۰۷۹** از قبل وجود دارد:

```
$ git log --oneline -2 -- api/prisma/sql/079-staff-owner-phone-unique.sql
b5553a3 بازبینیِ دوم پیش از merge: مسیرِ سومِ ایندکسِ ۰۷۹ + پیش‌نیازِ deploy + تصمیمِ is_active
f0aba2d SPEC-B: بستنِ raceِ شماره‌ی owner — ایندکسِ یکتایِ جزئیِ ۰۷۹ + fault-injectionِ واقعی

$ git merge-base --is-ancestor f0aba2d HEAD  → exit=0
$ git merge-base --is-ancestor b5553a3 HEAD  → exit=0
```

طبقِ قانونِ راستی‌آزماییِ `CLAUDE.md`، پیامِ کامیت **شاهد نیست**. هر چهار بند را
مستقلاً اجرا کردم. نتیجه در بخش‌های ۲ تا ۵.

---

## ۲. بندِ الف — تصمیمِ قید، با کوئریِ زنده

### پرسش: یکتاییِ **سراسری** روی `staff.phone` درست است؟

**تصمیم: نه. قید باید مشروط باشد — `WHERE role = 'owner'`.**

### شاهدِ زنده‌ای که تصمیم را قطعی کرد

خودِ دستور گفته بود «اگر موردِ مشروعی هست که یک نفر در دو تنانت staff باشد، قید باید
مشروط باشد». چنین موردی **امروز در DB وجود دارد**:

```
$ SELECT phone, count(DISTINCT tenant_id) AS tenants, array_agg(DISTINCT role::text) AS roles
  FROM staff GROUP BY phone HAVING count(DISTINCT tenant_id) > 1;

     phone     | tenants |     roles
---------------+---------+---------------
 +989265500665 |       2 | {owner,staff}
(1 row)

$ SELECT id, tenant_id, role, is_active, created_at FROM staff WHERE phone='+989265500665';
 49d8458e-…-a3aeaf | 2a85fb06-…-a55301 | owner | t | 2026-09-02 14:36:04.566+00
 cb61231c-…-81445c | e2aebd2d-…-e293fde | staff | t | 2026-09-02 14:36:04.679+00
```

یکتاییِ سراسری این ردیفِ **قانونی** را می‌شکست. قیدِ جزئی نگهش می‌دارد.

### استدلالِ دامنه‌ای (مستقل از دیتا)

| گزینه | چرا رد/قبول |
|---|---|
| یکتاییِ سراسریِ `phone` | ❌ «یک نفر، کارمندِ دو رستوران» را غیرممکن می‌کند — featureِ قانونی. `@@unique([tenantId, phone])` عمداً درون‌تنانتی است. |
| بدونِ قید (فقط چکِ اپ) | ❌ TOCTOU — بخشِ ۵. |
| **جزئی: `WHERE role='owner'`** | ✅ ownerِ دومِ هم‌شماره **همیشه حسابِ مرده** است: قاعده‌ی «قدیمی‌ترین ثبت برنده» (مهاجرتِ ۰۷۲) یعنی هرگز نمی‌تواند با OTP وارد شود. پس ساختش هیچ‌وقت مشروع نیست. |

### نقضِ فعلیِ قید — کوئریِ اجباریِ pre-deploy

```
$ SELECT phone, count(*) FROM staff WHERE role='owner' GROUP BY phone HAVING count(*)>1;
(0 rows)   ← DBِ تست (localhost:55432)
(0 rows)   ← استکِ compose محلی (rezervno-postgres)
```

**صفر ردیف در هر دو DBِ قابل‌دسترس.** ⚠️ محیطِ production/staging از این ماشین وجود
ندارد؛ اجرای همین کوئری پیش از deploy روی هر محیطِ واقعی در هدرِ خودِ مهاجرتِ ۰۷۹
به‌عنوان پیش‌نیازِ اجباری ثبت است.

### یک تصمیمِ ظریف که مستند است، نه سهو

predicate عمداً `AND is_active` **ندارد**. دلیل: `findStaffForLogin` قاعده‌ی «قدیمی‌ترین
ثبت برنده» را بدونِ فیلترِ `isActive` اجرا می‌کند، پس ownerِ جدیدی که شماره‌اش با ردیفِ
غیرفعالِ قدیمی‌تر مشترک باشد باز هم نمی‌تواند وارد شود. هزینه‌اش: شماره‌ی ownerِ
رستورانِ offboard تا آزادسازیِ دستی قفل می‌ماند.

---

## ۳. بندِ ب — مهاجرت، schema، و گاردِ drift

**قیدِ اعمال‌شده** (`api/prisma/sql/079-staff-owner-phone-unique.sql`):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS staff_owner_phone_unique_idx
  ON staff (phone) WHERE role = 'owner';
```

idempotency را **در عمل** آزمودم (بخشِ ۵-۳): بعد از `DROP INDEX`، همین دستور با
`CREATE INDEX` موفق شد؛ روی ایندکسِ موجود بی‌صدا رد می‌شود.

**هم‌سوییِ schema.prisma:** Prisma ایندکسِ جزئی (`WHERE`) را نمی‌تواند اعلام کند. طبقِ
الگوی مصوب: در `schema.prisma:118-123` روی مدلِ `Staff` کامنت‌گذاری شده، و در گاردِ
drift هم به `required` اضافه شده هم `DROP`ش در `ACCEPTED_DRIFT` پذیرفته شده
(`tests/schema-drift.integration.test.mts:45,49,88`).

**اجرای گیت — خروجیِ خام:**

```
$ npx tsx --test tests/schema-drift.integration.test.mts
  ✔ هیچ دو ایندکسی با تعریفِ یکسان وجود ندارد (80.97ms)
  ✔ ایندکس‌هایِ حیاتیِ SQL در schema.prisma هم اعلام شده‌اند (6.69ms)
  ✔ `prisma db push` هیچ چیزی جز انحرافِ پذیرفته‌شده را تغییر نمی‌دهد (3917.61ms)
ℹ tests 3 · pass 3 · fail 0
EXIT=0
```

---

## ۴. بندِ ج — نگاشتِ نقضِ قید به خطای تمیز

چکِ اپلیکیشنی سرِ جایش ماند (fast-pathِ UX با پیامِ راهنما)، و نقضِ قید به **همان**
`duplicate_owner_phone` ترجمه می‌شود — همان الگوی P2002ِ `username` از دورِ یازدهم.

**نکته‌ای که فراتر از دستور رفته:** نگاشت در **سه** مسیر هست، نه یکی —
هر سه مسیرِ سازنده/تغییردهنده‌ی owner پوشش دارند:

| مسیر | خط |
|---|---|
| `provisionBusiness` | `api/src/lib/provisioning.ts:192` |
| `createTrialAccount` (سفارشِ سایت) | `api/src/lib/site-orders.ts:352` |
| تغییرِ اعتبارنامه‌ی staff (ادمین) | `api/src/app/api/v1/admin/staff-credentials/route.ts:148` |

نگاشت در `isOwnerPhoneUniqueViolation` (`api/src/lib/staff-helpers.ts:205`) و **دورِ
خودِ تراکنش** است — یعنی رول‌بکِ کامل، بدونِ Tenant/Restaurantِ یتیم.

---

## ۵. بندِ د ⭐ — تستِ fault-injection و اثباتِ قرمزشدن

### ۵-۱. سبز با قیدِ سرِ جا

```
$ npx tsx --test tests/admin-create-business.integration.test.mts
  ✔ fault-injection داخلِ تراکنش: بازنده‌ی raceِ شماره‌ی owner رول‌بکِ کامل می‌شود (131.02ms)
ℹ tests 9 · pass 9 · fail 0
EXIT=0
```

### ۵-۲. اثباتِ falsifiability — «قید را بردار، تست قرمز شود»

```
$ DROP INDEX staff_owner_phone_unique_idx;
DROP INDEX
$ SELECT count(*) FROM pg_indexes WHERE indexname='staff_owner_phone_unique_idx';
0

$ npx tsx --test tests/admin-create-business.integration.test.mts
  ✖ fault-injection داخلِ تراکنش: … (6492.01ms)
    AssertionError [ERR_ASSERTION]:
      INSERTِ provisioning هرگز پشتِ قفلِ ایندکسِ ۰۷۹ دیده نشد — سناریوی race اجرا نشده است
ℹ tests 9 · pass 8 · fail 1
EXIT=1
```

**فقط همان یک تست قرمز شد و ۸ تای دیگر سبز ماندند** — یعنی تست دقیقاً همان قید را
می‌سنجد و شکستش وابسته به چیزِ دیگری نیست.

### ۵-۳. بازگردانی و سبزشدنِ دوباره

```
$ CREATE UNIQUE INDEX IF NOT EXISTS staff_owner_phone_unique_idx ON staff (phone) WHERE role='owner';
CREATE INDEX
$ npx tsx --test tests/admin-create-business.integration.test.mts
ℹ tests 9 · pass 9 · fail 0
EXIT=0
```

### ۵-۴. ⚠️ واگرایی از متنِ دستور — عمدی و به نفعِ قوت

دستور گفته بود «دو provisioning هم‌زمان با `Promise.all`». تستِ موجود **`Promise.all`
نمی‌زند** و به‌جایش این کار را می‌کند:

1. تراکنشِ «نگه‌دارنده» ownerِ رقیب را درج می‌کند و **commit را نگه می‌دارد** → چکِ
   اپلیکیشنیِ provisioning زیرِ READ COMMITTED آن را نمی‌بیند (بازتولیدِ **قطعیِ** TOCTOU).
2. provisioning واردِ تراکنش می‌شود و INSERTِ staff پشتِ ایندکس **بلاک** می‌شود.
3. از `pg_stat_activity` **اثبات می‌شود** که واقعاً یک INSERT روی `staff` در
   `wait_event_type='Lock'` منتظر است — وگرنه تست حق ندارد سبز شود.
4. نگه‌دارنده commit می‌کند → بازنده `unique_violation` می‌گیرد.

**چرا این قوی‌تر از `Promise.all` است:** `Promise.all` برخوردِ واقعی را **تضمین
نمی‌کند** — اگر دو درخواست از هم فاصله بگیرند، تست بدونِ اجرای سناریو سبز می‌شود و
دقیقاً همان «تستِ توخالی»ِ قاعده‌ی ۵ می‌شود. این نسخه سناریو را قطعی می‌کند و
**نبودِ سناریو را خطا می‌داند نه عبور** — همان چیزی که در ۵-۲ دیدیم: با حذفِ قید،
تست روی همین ادعا مُرد، نه روی status code.

### ۵-۵. سه معیارِ خواسته‌شده، هر سه پوشش‌داده

| خواسته‌ی دستور | ادعای تست |
|---|---|
| دقیقاً یکی موفق | `staff.count({where:{phone}}) === 1` — «فقط ownerِ برنده باید بماند» |
| یکی خطای تمیز | `status === 409` و `reason === 'duplicate_owner_phone'` (نه ۵۰۰ خام) |
| در DB دقیقاً یک ردیف | + `tenant/restaurant/staffInvite.count === 0` — هیچ یتیمی |

---

## ۶. ثبتِ `modifiersJson` — تنها کارِ تازه‌ی این دور

بخشِ ۶ به `docs/recovery/OPEN-FINDINGS.md` اضافه شد (۴۰ خط) با برچسبِ `modifiersJson`.

**ادعاهای سند راستی‌آزمایی شدند:**

```
$ grep -n "modifier\|Modifier" api/src/lib/reservations.ts
(هیچ خروجی — صفر ارجاع در مسیرِ pre-order)
```

| لایه | وضعیت |
|---|---|
| تعریفِ افزودنی: `MenuModifierGroup`/`MenuModifierOption` | ✅ مهاجرتِ ۰۷۸ |
| انتخابِ افزودنی در سفارش: `ReservationItem.modifiersJson` | ❌ ساخته نشد |

یعنی رستوران «سایز: کوچک/بزرگ» را تعریف می‌کند ولی مشتری نمی‌تواند انتخاب کند؛
`minSelect`/`maxSelect` امروز هیچ مصرف‌کننده‌ای در مسیرِ سفارش ندارند.

**قیدِ ساختاری که هنگامِ ساخت باید دیده شود:** PKِ مرکبِ
`(reservationId, menuItemId)` (`schema.prisma:569`) + منعِ صریحِ §۲-۴ از تغییرِ PK
یعنی «۱ پیتزا کوچک + ۱ پیتزا بزرگ» در یک رزرو دو ردیف نمی‌شود. انتخاب بینِ
«`modifiersJson` آرایه‌ای» و «تغییرِ PK» **هنوز گرفته نشده** و تصمیمِ مالک است.

---

## ۷. یادداشتِ محیطی

Redisِ تست بالا نیامد — پورتِ ۵۶۳۷۹ داخلِ بازه‌ی رزروشده‌ی Hyper-V افتاده بود:

```
$ netsh interface ipv4 show excludedportrange protocol=tcp
     56339       56438       ← 56379 داخلِ این بازه
```

دور زدن: `docker run -d --name rezv-test-redis-alt -p 127.0.0.1:56500:6379 redis:7-alpine`
با `REDIS_URL="redis://localhost:56500"`. بازه‌ها با هر بوت عوض می‌شوند.

---

## ۸. جمع‌بندی

| بند | وضعیت | کدِ خروجِ شاهد |
|---|---|---|
| تأییدِ ترتیب (d525e48 در main) | ✅ تأیید شد | `exit=0` |
| الف — قیدِ مشروط با کوئریِ زنده | ✅ از قبل درست بود؛ شاهدِ زنده‌اش را یافتم | ۰ نقض |
| ب — مهاجرت + schema + drift | ✅ سبز | `EXIT=0` |
| ج — نگاشتِ P2002 در سه مسیر | ✅ | — |
| د — fault-injection + اثباتِ قرمزی | ✅ | `EXIT=0` / `EXIT=1` / `EXIT=0` |
| ثبتِ `modifiersJson` | ✅ کارِ تازه | — |

**PR-A از بابتِ الف–د چیزی برای اضافه‌کردن ندارد** — از قبل در main بسته‌اند.
تغییرِ working tree فقط: `M docs/recovery/OPEN-FINDINGS.md` و همین گزارش. کامیت نشده.
