# راستی‌آزماییِ پیش از merge — چهار دستورِ مالک (۲۰۲۶-۰۸-۲۷)

> شاخه: `reconcile/audit-plus-features` · پایه‌ی آزمایش: `78a3fdf` (درختِ تمیز)
> چهار دستور: ۱) اجرای مجددِ E2E سه‌موتوره و مقایسه ۲) بستنِ موردِ بازِ SPEC-B
> ۳) سه سؤالِ verify ۴) جداسازیِ کارِ ممیزی از شاخه‌ی فیچر.

---

## ۱. آزمایشِ E2E — سه اجرای کامل، کنارِ هم

هر سه اجرا با **همان دستور** (`npm test` در `e2e/`، هر ۵۱۰ تست × ۳ موتور،
workers=2). اجرای ۲ روی درختِ کاملاً تمیزِ `78a3fdf` (خطِ `git status --porcelain`
در headerِ لاگ خالی است)؛ اجرای ۳ همان درخت + فقط یک فایلِ اصلاح‌شده‌ی تست.

```text
اجرای ۱ (گزارشِ قبلی، 78a3fdf):   503 passed · 5 failed        (37.4m)
    ↳ هر ۵ شکست فقط mobile-safari: ۴ اسپکِ شیتِ رزرو + ۱ اسپکِ منو —
      همه تایم‌اوتِ goto (امضای مستندِ اشباعِ npx serve)؛ ایزوله ۱۴/۱۴ سبز.

اجرای ۲ (این نشست، بدونِ تغییرِ کد): 506 passed · 2 failed · 2 skipped (15.8m)
    ↳ EXITCODE=1 · هر دو شکست «یک» تست: business-menu.spec.ts:166
      «فرم: برچسب + پنجره‌ی سرو → PATCH و PUTِ درست (۰۷۸)»
      [mobile-chrome] و [desktop-chrome] — mobile-safari پاس!
      خطا: expect(calls.tagsPut.length).toBe(1) → Received: 0 (assertion،
      نه تایم‌اوتِ ناوبری). ۵ تستِ قرمزِ اجرای ۱ همه سبز.

اجرای ۳ (فقط اصلاحِ گیتِ تست):      508 passed · 0 failed · 2 skipped (14.5m)
    ↳ EXITCODE=0 · header لاگ: « M e2e/tests/business-menu.spec.ts» (تنها دیف).
```

(۲ skipped در هر دو اجرای ثبت‌شده همان تستِ desktop-onlyِ
`panels-batch14-regression.spec.ts:270` روی دو پروفایلِ موبایل است — عمدی.)

### حکم — نه «همان ۵ تا»، نه اشباعِ خالص: کلاسِ سومِ شکست پیدا شد

- **۵ تای قبلی تکرار نشدند** → آن‌ها الگوی ثابت نیستند؛ کلاسشان (تایم‌اوتِ
  goto فقط زیرِ بار، ایزوله سبز، بدونِ شکستِ assertion) با تشخیصِ مستندِ
  اشباعِ `npx serve` سازگار می‌ماند (`playwright.config.ts:28-42`).
- **اما اجرای ۲ چیزی را رو کرد که «اشباع» پنهانش می‌کرد:** یک **شکستِ
  assertion** (کلاسی که در سابقه‌ی این سوئیت «هرگز» دیده نشده بود) روی تستِ
  تازه‌ی فازِ ۲، هم‌زمان روی دو موتورِ chromium. ریشه‌یابیِ کامل:
  - گیتِ همگام‌سازیِ تست **پوچ بود**: `toContainText('سالاد سزار')` بعد از
    کلیکِ «ذخیره» بلافاصله پاس می‌شود چون فهرستِ زیرِ مودال از همان اول
    همین متن را دارد — هیچ انتظاری برای پایانِ ذخیره نمی‌سازد.
  - جریانِ اپ ترتیبی و درست است (`menu.js:521-536`): PATCHِ آیتم → await →
    PUTِ برچسب‌ها → await → closeModal → toast. تست بینِ این دو درخواست
    می‌پرید و شمارنده‌ی PUT را صفر می‌دید؛ snapshotِ لحظه‌ی شکست toastِ
    موفقیت را نشان می‌دهد یعنی PUT چند میلی‌ثانیه **بعد از** assertion رسید.
  - رفع (هیچ assertionی ضعیف نشد؛ یکی اضافه شد): گیتِ واقعیِ
    `expect(#modalBg).toBeHidden()` (closeModal فقط بعد از هر دو await اجرا
    می‌شود) + `expect.poll` روی شمارنده — همان الگوی تستِ reorder همان فایل.
  - چرا اجرای ۱ نگرفتش: مسابقه‌ی زمانی است؛ در اجرای ۱ chromiumها برنده‌ی
    پنجره شدند و به‌جایش mobile-safari به اشباع خورد. تشخیصِ «اشباع» برای آن
    ۵ شکست غلط نبود؛ ناکامل بود — این باگِ تست مستقل از آن وجود داشت.

---

## ۲. موردِ بازِ SPEC-B بسته شد — ایندکسِ یکتایِ جزئی، نه چکِ داخلِ تراکنش

**تصمیم: گزینه‌ی دوم (ایندکس) درست است؛ گزینه‌ی اول placebo است.**
جابه‌جاییِ `SELECT`ِ چکِ تکراری به داخلِ تراکنش زیرِ READ COMMITTED (پیش‌فرضِ
Prisma/Postgres) هیچ مسابقه‌ای را نمی‌بندد — دو تراکنشِ هم‌زمان هیچ‌کدام درجِ
commit‌نشده‌ی دیگری را نمی‌بینند و هر دو عبور می‌کنند. جایگزین‌هایش
(SERIALIZABLE، advisory lock) یا به هر provisioning هزینه/retry تحمیل می‌کنند یا
invariant را در لایه‌ی app نامرئی نگه می‌دارند. ایندکسِ یکتا تنها لایه‌ای است که
نویسنده‌های هم‌زمان را واقعاً سریالیزه می‌کند و **هر دو** مسیرِ سازنده‌ی owner
(provisioning پنلِ شرکت + trialِ سایت — دومی هم دقیقاً همین TOCTOU را داشت،
`site-orders.ts:285→326`) و هر مسیرِ آینده را یک‌جا می‌پوشاند.

**تحویل‌ها:**
- `api/prisma/sql/079-staff-owner-phone-unique.sql` — idempotent:
  `CREATE UNIQUE INDEX IF NOT EXISTS staff_owner_phone_unique_idx ON staff (phone) WHERE role='owner'`
  دامنه عمداً فقط owner (تکرارِ شماره‌ی کارمند بینِ تنانت‌ها قانونی است —
  `@@unique([tenantId,phone])` + دکترینِ ۰۷۲)؛ راشنال و مرزها در خودِ فایل.
- چکِ appسطح در هر دو مسیر ماند (fast-pathِ UX با پیامِ راهنما) + نگاشتِ
  P2002ِ بازنده‌ی race به همان پاسخِ مسیرِ ترتیبی
  (`isOwnerPhoneUniqueViolation` در `lib/staff-helpers.ts` — ۴۰۹ِ
  `duplicate_owner_phone` در provisioning، پیامِ validationِ موجود در trial).
- پوششِ گاردِ drift (Prisma ایندکسِ جزئی را نمی‌تواند اعلام کند): افزودن به
  فهرستِ `required` + `ACCEPTED_DRIFT` + کامنتِ مستند روی مدلِ Staff.
- **تستِ اتمیک‌بودنِ واقعی** (`admin-create-business.integration.test.mts`):
  تستِ قبلی صادقانه retitle شد (فقط گاردِ پیش‌ازتراکنشِ slug را می‌سنجید و
  تراکنش اصلاً شروع نمی‌شد). تستِ جدید fault-injection را واقعاً **داخلِ**
  تراکنش تزریق می‌کند، بدونِ mock و روی Postgresِ واقعی:
  درجِ ownerِ رقیب در تراکنشِ باز و commit‌نشده → provisioning از چکِ اولیه
  رد می‌شود (READ COMMITTED) → Tenant و Restaurant ساخته می‌شوند → INSERTِ
  staff پشتِ ایندکسِ ۰۷۹ **بلاک** می‌شود (اثباتِ الزامی از `pg_stat_activity`؛
  اگر انتظارِ قفل دیده نشود خودِ تست شکست می‌خورد) → commitِ رقیب →
  unique_violation وسطِ تراکنش → رول‌بکِ کامل. assertها: ۴۰۹ِ
  `duplicate_owner_phone` + صفر Tenant/Restaurant/StaffInvite یتیم + فقط
  ownerِ برنده باقی.

**خروجی‌های خامِ verify:**

```text
tsc --noEmit: صفر خطا · eslint: پاک
apply-sql روی DBِ کثیف:  RUN1=1 — Error P2002 روی 079 (fail-loudِ طراحی‌شده؛
   دیتای واقعیِ کثیف: دو ownerِ فیکسچری هم‌شماره +989120000000 در DBِ تستِ
   محلی. جوان‌تر پاک شد — دکترینِ «قدیمی‌ترین برنده».)
apply-sql پس از پاک‌سازی: CLEAN_RUN1=0 · CLEAN_RUN2=0  (idempotent)
pg_indexes: CREATE UNIQUE INDEX staff_owner_phone_unique_idx
            ON public.staff USING btree (phone) WHERE (role='owner'::staff_role)
admin-create-business: tests 9 · pass 9 · fail 0  (شاملِ fault-injection، ۱۳۴ms)
schema-drift:          tests 3 · pass 3 · fail 0
سوئیتِ کاملِ بک‌اند:   tests 1435 · pass 1435 · fail 0  (پایه ۱۴۳۴ + ۱ race)
```

نکته‌ی ثبت‌شده در ۰۷۹ و DATABASE.md: raceِ نادرِ «owner+کارمند هم‌زمان با یک
شماره در دو تنانت» آگاهانه بیرونِ دامنه است — بستنش یکتاییِ سراسریِ phone
می‌خواست که featureِ قانونیِ «یک نفر کارمندِ دو رستوران» را می‌شکست.

---

## ۳. سه سؤالِ verify

### ۳-الف · sw.js در پنل‌ها

**ندارند — و بامپِ لازم فقط در اپِ مشتری بود که در هر دو کامیت انجام شده.**

```text
$ Glob apps/*/sw.js                    → فقط apps/customer/sw.js
$ grep -rn CACHE_VERSION apps/business/ apps/company/   → (هیچ)
$ grep -rn serviceWorker apps/         → فقط apps/customer/js/theme-pwa.js:54
git show 5903345 (فاز ۱):  -'rezervno-v34'  +'rezervno-v35'   (sw.js مشتری)
git show d525e48 (فاز ۲):  -'rezervno-v35'  +'rezervno-v36'   (sw.js مشتری)
```

`data.js`/`menu.js`ِ ویرایش‌شده مالِ `apps/business/`اند که SW ندارد؛ تازگیِ
پنل‌ها با گیتِ standalone (خروجیِ commitشده، در CI چک می‌شود) تضمین می‌شود —
همان قاعده‌ی CLAUDE.md §فرانت. بامپی از قلم نیفتاده.

### ۳-ب · PKهای ۰۷۸ بدونِ DEFAULT ولی ۰۷۷ با DEFAULT — عمدی

عمدی است و از قبل در headerِ خودِ ۰۷۸ (خطوط ۱۰-۱۲) اعلام شده بود؛ حالا
به‌عنوانِ **قاعده‌ی سراسری** در `docs/DATABASE.md` (بخشِ ۰۷۸) ثبت شد:
- PK فقط وقتی DEFAULTِ DB می‌گیرد که خودِ migration بدونِ ستونِ id ردیفِ خام
  INSERT کند — ۰۷۷ backfill دارد (`INSERT INTO menu_categories … SELECT`) و
  بدونِ `gen_random_uuid()` می‌شکست؛ schema هم همان را با
  `@default(dbgenerated(…))` آینه کرده (drift صفر).
- ۰۷۸ هیچ INSERT خامی ندارد؛ schemaاش `@default(uuid())` کلاینتی است، Prisma
  در emit DEFAULT نمی‌سازد، و DEFAULTِ دستی دقیقاً همان driftی می‌شد که گاردِ
  §۲۴ می‌گیرد. دو الگوی متفاوت، هر دو درون‌سازگار، انتخاب بر اساسِ نیاز.

### ۳-ج · pre-order همیشه qty=1

**مرزِ scope بود، نه تصمیمِ صریحِ محصولی — و در `docs/KNOWN_LIMITATIONS.md`
(بخشِ انتهایی، ۲۰۲۶-۰۸-۲۷) ثبت شد.** شواهد: سرور از قبل ۱..۵۰ می‌پذیرد
(`reservations/route.ts:31`) و subtotal همان را ضرب می‌کند؛ UI چیپِ toggle
است و `qty:1` هاردکد (`booking.js:212`)؛ در کلِ SPEC-A کلمه‌ی qty حتی یک بار
نیامده — فازِ ۲ فقط «سیم‌کشیِ چیپ‌های موجود» را در scope داشت. مسیرِ بازشدن
فقط UI است (stepper)؛ هیچ تغییرِ سرور/DB لازم نیست.

---

## ۴. جداسازیِ کارِ ممیزی از شاخه‌ی فیچر

**سنجشِ اول (مهم):** دیفِ این شاخه نسبت به `origin/main` **هیچ فایلِ
حذف‌شده‌ای ندارد** (۱۰۰ افزوده، ۲۵۴ ویرایش، ۰ حذف) — فازِ برگشت‌ناپذیرِ حذفِ
DOC-AUDIT هنوز روی هیچ شاخه‌ای اجرا نشده. آن‌چه قاطی شده بود، رکوردهای
**افزودنیِ** کارِ ممیزی بود که داخلِ ۶ کامیتِ مخلوط به ۴ سندِ پروتکلِ ممیزی
نشت کرده بود (+۳۷۸/−۳):
`docs/audit/DEAD-CODE.md` · `docs/recovery/OPEN-FINDINGS.md` ·
`docs/recovery/BASELINE-TEST-STATUS.md` · `docs/recovery/PHASE-2-PLAN.md`

**جراحیِ انجام‌شده (بدونِ بازنویسیِ تاریخچه‌ی pushشده):**
- شاخه‌ی جدیدِ `audit/doc-audit` از `origin/main` + یک کامیت با کلِ دلتای آن
  ۴ سند → خانه‌ی کارِ ممیزی، از جمله فازِ آینده‌ی حذف.
- روی شاخه‌ی فیچر یک کامیتِ روبه‌جلو آن ۴ سند را به وضعیتِ `origin/main`
  برگرداند — merge شدنِ فیچر دیگر هیچ سندِ ممیزی را لمس نمی‌کند؛ رکوردها با
  mergeِ شاخه‌ی ممیزی برمی‌گردند (هیچ محتوایی گم نمی‌شود، فقط مسیرِ ورودش
  جدا شد).
- ابزارِ XSS-sink-audit (`docs/XSS_SINK_AUDIT.md`، `tools/xss-sink-audit*`)
  **نقل نشد**: به گیتِ CI سیم‌کشی شده (کامیت‌های 051157a/39721a7) و جزوِ
  زیرساختِ عملیاتیِ شاخه‌ی فیچر است، نه رکوردِ workstreamِ ممیزی.

**دو یافته‌ی جانبیِ همین بررسی (تصمیمش با مالک):**
- `main`ِ **محلی** از `origin/main` جدا افتاده و یک کامیتِ snapshotِ ممیزیِ
  یتیم دارد (`8b5f475`، ۲۰۲۶-۰۸-۲۴) که معادلِ تاریخ‌دارش از قبل در شاخه‌ی
  `claude/full-audit-2026-08-24` (`0e76e98`) هست — پیشنهاد: `main`ِ محلی را
  روی `origin/main` برگردانید تا merge‌های آینده گمراه نشوند.
- هیچ‌کدام از آن دو snapshot در تاریخچه‌ی شاخه‌ی فعلی نیستند (تأییدشده با
  `merge-base --is-ancestor`).

---

## الحاقیه — بازبینیِ دوم (پیش از merge، همان روز)

### ۱′ · ریسکِ ۰۷۹ روی داده‌ی واقعی

کوئریِ مالک روی **هر DB قابل‌دسترس از این ماشین** اجرا شد:

```text
تستِ (55432):                      0 rows  ← امن
استکِ محلیِ compose (rezv_pgdata):  0 rows  ← امن (۲ ownerِ seed، شماره‌ها متمایز؛
                                            dupِ manager بینِ تنانت‌ها قانونی و خارج از predicate)
production / staging:  از این ماشین connection stringی وجود ندارد —
   .env فقط استکِ محلی است (۰۸-۲۶)، DEPLOYMENT.md §۶ می‌گوید DBِ تولید
   همان استکِ self-hostedِ compose است و env-varهای Vercel فقط در
   داشبورد؛ هیچ سندی staging تعریف نکرده. هیچ محیطِ مستقر شناسایی نشد.
```

پیش‌نیازِ اجباری (کوئری + قاعده‌ی «حذفِ خودکار ممنوع، لیست برای مالک») در
headerِ خودِ ۰۷۹ و در DATABASE.md ثبت شد — برای هر deployِ آینده برقرار است.
یادداشت: seed غیرidempotent است؛ اجرای دوباره‌اش پس از ۰۷۹ زودتر (روی همین
ایندکس به‌جای slug) می‌میرد — همان کلاسِ tolerated در docker-entrypoint؛ نصبِ
تازه امن است.

### ۲′ · مسیرِ سوم — حق با بازبین بود

sweepِ کاملِ نوشتن‌های staff (شش سایتِ Prisma + seedها + راه‌های SQL خام):
`POST /admin/staff-credentials` دقیقاً همان مسیرِ سوم بود — هم createِ
پیش‌فرضش owner است هم با `role` در بدنه یک staff/manager موجود را **ارتقا**
می‌دهد (و ایندکسِ جزئی UPDATE را هم می‌گیرد). تا این اصلاح، برخورد ⇒ ۵۰۰ِ
خامِ P2002. حالا: پیش‌چکِ خوانا + نگاشتِ P2002 → ۴۰۹ِ `duplicate_owner_phone`
(همان الگوی provisioning). سه تستِ تازه در password-login: create-تداخل ⇒
۴۰۹ بدونِ ردیفِ تازه؛ ارتقا-تداخل ⇒ ۴۰۹ و نقش/اعتبارنامه دست‌نخورده؛ ارتقای
بی‌تداخل ⇒ همچنان ۲۰۰ (گارد بیش‌ازحد نمی‌بندد).
بقیه‌ی مسیرها ساختاراً بسته‌اند: `POST /restaurant/staff` enumِ بدونِ owner؛
`PATCH /restaurant/staff` اصلاً فیلدِ role/phone ندارد و ownerها را دست‌نزدنی
می‌داند (خطِ ۱۵۱)؛ password/route فقط hash/username.

### ۳′ · ownerِ غیرفعال/OFFBOARDED — عمدی، با دلیلِ ساختاری

resolutionِ ورود («قدیمی‌ترین برنده»، `findStaffForLogin`) **بدونِ** فیلترِ
isActive اجرا می‌شود و بعد ردیفِ غیرفعال رد می‌شود (`auth/staff/verify:42-44`)
⇒ ownerِ جدیدِ هم‌شماره با ردیفِ غیرفعالِ قدیمی‌تر = حسابِ مرده. به‌علاوه
predicateِ «AND is_active» خودِ reactivation را مسیرِ نقضِ تازه می‌کرد. پس
شرطِ is_active عمداً نیست؛ پیامد (قفلِ شماره پس از offboard تا آزادسازیِ
دستی) و مسیرِ آزادسازی (تغییر/آزادکردنِ phone یا حذفِ ردیف — demote کافی
نیست چون چک‌های appسطح هر ردیفِ staff را می‌بینند) در headerِ ۰۷۹ و
DATABASE.md ثبت شد.

### ۴′ · mainِ محلی

`git tag backup/local-main-8b5f475` (محلی) → `git branch -f main origin/main`
— main محلی حالا `6df7ac0` است؛ کامیتِ یتیم پشتِ tag محفوظ.

### verify بازبینیِ دوم

```text
tsc --noEmit: صفر خطا · eslint: پاک
password-login (شاملِ ۳ تستِ تازه): tests 18 · pass 18 · fail 0
سوئیتِ کاملِ بک‌اند: tests 1438 · pass 1438 · fail 0  (۱۴۳۵ + ۳ تستِ مسیرِ سوم)
```
