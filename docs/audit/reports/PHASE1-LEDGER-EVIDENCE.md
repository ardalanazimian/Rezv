# PHASE1-LEDGER-EVIDENCE — یکپارچگیِ دفترِ امتیاز (فازِ ۱، پروتکل §۱۳)

**تاریخ:** ۲۰۲۶-۰۹-۰۹ · **نقش:** data-trust-engineer · **دامنه:** فقط اندازه‌گیری +
اجرایِ تصمیمِ مالک دربابِ شکلِ کلیدِ idempotency (بند «توضیحاتِ اضافه‌شده» پایین).
**بدونِ push.**

## گیتِ فعال‌سازی (بندِ اول)

`.claude/agents/data-trust-engineer.md` یک دروازه دارد: «تا وقتی معمار صریحاً اعلام
نکرده که حلقه‌های ۱–۷ زنجیره‌ی بندِ ۱ پایدارند، spawn نمی‌شوی.» هیچ اعلامی از این
دست در `docs/` پیدا نشد (`grep "حلقه‌های ۱"` فقط در همین فایلِ agent و در
`DECISIONS.md`/`PHASE-2-PLAN.md`/`BASELINE-TEST-STATUS.md` با معنایِ متفاوت
برخورد کرد — هیچ‌کدام اعلامِ صریحِ موردنظر نیستند). **این را همان‌جا گزارش کردم و
متوقف نشدم**، چون: (۱) CEO مستقیماً و با جزئیاتِ فنیِ دقیق (baseline، env،
flake شناخته‌شده) این batch را سفارش داد؛ (۲) کارِ سفارش‌شده خودِ «یکپارچگیِ
بنیادی» است (§۱۳)، نه «ویژگیِ AI» که آن دروازه برایِ جلوگیری از آن ساخته شده
(بندِ ۱ پروتکل: «Do NOT jump to AI features while foundational integrity is
broken»)؛ (۳) بدونِ schema/AI اضافه‌ای که آن گیت را نگران کند. با این حال طبقِ
قانونِ ۲ (شک=ارجاع)، این را صریح در بلوکِ عدمِ‌قطعیت زیر پرچم‌گذاری می‌کنم.

---

## ۱. حقایقِ ساختاری — schema.prisma + DB زنده

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F1 | major | schema | `PointsLedger` پیش از این کار هیچ `@@unique`ای نداشت — تنها ایندکسِ یکتا `uniq_annual_reward` بود که فقط `reason IN (birthday, anniversary)` را می‌پوشاند | `api/prisma/schema.prisma:672-686` (پیش از تغییرِ من) + `docker exec rezv-test-pg psql -U rezervno -d rezervno_test -c "\d points_ledger"` → خروجیِ خام: `"points_ledger_pkey" PRIMARY KEY`, `"points_ledger_user_id_created_at_idx"`, `"uniq_annual_reward" UNIQUE ... WHERE reason = ANY (ARRAY['birthday','anniversary'])` — **بدونِ** ایندکسِ عمومی | من، این اجرا |
| F2 | info | schema/db | schema.prisma و DBِ زنده دربابِ `uniq_annual_reward` سازگارند (بدونِ drift) — قاعده‌ی «هر دو جا یا هیچ‌جا» رعایت شده بود | مقایسه‌ی مستقیمِ فایل با `\d points_ledger` بالا؛ کامنتِ `schema.prisma:682-684` دقیقاً همان محدودیتِ Prisma (نمی‌تواند expression-based بیان کند) را مستند می‌کند | من |
| F3 | major | schema | `restaurant_id` روی `points_ledger` واقعاً nullable است | `\d points_ledger` → ستونِ `restaurant_id`، `Nullable` خالی (نه `not null`) | من |
| F4 | info | design | nullableبودنِ `restaurant_id` دقیقاً همان مکانیزمِ تفکیکِ «اعتبار» (رستوران‌دار) از «سکه» (پلتفرم) است که `CLUB-PHASE0.md:108` هم به آن اشاره کرده: ردیف‌های `addPoints` بدونِ `restaurantId` (signup که استفاده نمی‌شود، referral، birthday/anniversary) با `NULL` می‌نشینند؛ ردیف‌های `addClubPoints` (چک‌این) و کش‌بکِ رزرو با `restaurantId` واقعی | `api/src/lib/loyalty.ts:63-78` (addPoints, `restaurantId: opts.restaurantId ?? null`) در برابرِ `api/src/lib/loyalty.ts:114-146` (addClubPoints, restaurantId اجباری در امضا) | من |

---

## ۲. موجودیِ دوگانه — ادعایِ پلن vs وضعیتِ واقعیِ کد

**یافته‌ی مهم:** پلنِ فازِ ۱ (`docs/prompts/PROMPT-customer-club-ml-fa.md`) ادعا
می‌کند «امروز دوگانه است: `points_ledger` و `club_members.points`
(`loyalty.ts:143` در برابرِ `:152`)». **این ادعا برایِ کدِ زنده‌ی امروز نادرست
است** — طبقِ zero-trust (قانون ۱ قانون‌اساسی)، اینجا با سند مخالفت می‌کنم:

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F5 | **contradiction** | loyalty | مسئله‌ی «دوگانگیِ موجودی» از قبل، در `ADR-P2-011` (۲۰۲۶-۰۸-۲۳ — **۱۰ روز پیش از تاریخِ خودِ پلن، ۰۹-۰۲**) رفع شده: `club_members.points` یک **کشِ مشتق‌شده** است که *در همان تراکنشِ* insertِ ledger به‌روز می‌شود؛ هیچ مسیرِ خواندنی دیگری به آن ستون تکیه نمی‌کند. `getPointsBalance`/`getClubPointsBalance` هردو مستقیماً از `pointsLedger.aggregate` می‌خوانند | `docs/architecture/DECISIONS.md:432-472` (متنِ کاملِ ADR) + `api/src/lib/loyalty.ts:83-92` (`getPointsBalance`) + `:148-166` (`getClubPointsBalance`) — هیچ‌کدام از ستونِ کش نمی‌خوانند؛ تستِ زنده: `tests/loyalty-club-points.integration.test.mts` («کشِ ستونی با دفتر واگرا نمی‌شود») | من، اجرا شد (پایین) |
| F6 | major | loyalty | با این حال یک نویسنده‌ی **واقعی و باقی‌مانده** برایِ واگراییِ `club_members.points` وجود داشت: نوشتنِ مستقیمِ `pointsLedger.create` برایِ کش‌بکِ رزرو (`reservations.ts:615`، پیش از تغییرِ من) هیچ‌وقت از `addClubPoints` عبور نمی‌کرد، پس `club_members.points` را به‌روز نمی‌کرد — درحالی‌که همان مبلغ در `points_ledger` می‌نشست. یعنی برایِ هر کاربرِ گیرنده‌ی کش‌بک، ستونِ کش **کم‌شمار** می‌ماند (نه برابرِ جمعِ دفتر) | `api/src/lib/reservations.ts:609-618` (پیش از تغییرِ من — `git diff` نشان می‌دهد تنها تغییرم افزودنِ `idempotencyKey` بود، نه منطقِ نوشتن)؛ تأییدشده با grep: `pointsLedger.create` سه محلِ نوشتن دارد (`loyalty.ts:71`، `loyalty.ts:118`، `reservations.ts:615`) و فقط دومی `clubMember.points` را همراه می‌نویسد | من |
| F7 | minor | loyalty | `club_members.points` امروز **هیچ‌جا خوانده نمی‌شود** به‌جز خودش نوشته‌شدن — یعنی واگراییِ F6 امروز بی‌ضرر است، ولی ستون یک «مینِ خاموش» است: اولین کدِ آینده‌ای که آن را به‌عنوانِ منبعِ سریع بخواند (وسوسه‌ی طبیعی برایِ یک ستونِ از قبل موجود) عددِ غلط می‌گیرد | grep کاملِ `.points\b` روی `src/lib/*.ts` و `src/app/api/**` — تنها خواننده‌ها `tier`اند، نه `points`؛ تأییدشده در `ADR-P2-011` بخشِ «چرا ستون حذف نشد» | من |

---

## ۳. اثباتِ idempotency — دستیابیِ چک‌ینِ دوبار

**نتیجه: مثبت. کامنتِ `lifecycle.ts:165-172` امروز واقعاً درست است — و حالا با
تستِ واقعی، نه فقط با خواندنِ کد.**

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F8 | **blocker→resolved** | lifecycle | ادعایِ Phase-0 («این ادعا با تستِ موقت اثبات نشد» — `CLUB-PHASE0.md:118-120`) درست بود: در لحظه‌ی آن ممیزی چنین تستی وجود نداشت. **ولی امروز وجود دارد** — دو فایلِ از قبل موجود (`tests/checkin-points-panel-path.integration.test.mts`، `tests/loyalty-club-points.integration.test.mts`) دقیقاً retry، race و دو-endpoint-روی-یک-رزرو را با تستِ واقعی پوشش می‌دهند، و در `ADR-P2-012` (۲۰۲۶-۰۸-۲۳) با تزریقِ جهش (برگرداندنِ کدِ قدیم) واقعاً به قرمز رفته‌اند («اختلاف ۱۰۰ می‌داد به‌جای ۵۰») | من مستقیماً اجرا کردم: `npx tsx --test --test-force-exit tests/checkin-points-panel-path.integration.test.mts tests/loyalty-club-points.integration.test.mts` → **exit 0، ۱۸ تست، ۱۸ pass، ۰ fail** (قبل از هر تغییرِ من در کد) | من، این اجرا — لاگِ کامل در scratchpad |
| F9 | major | lifecycle | مکانیزمِ واقعی: `transitionReservation` یک **compare-and-set** است (`updateMany({where:{id, status: from}})`) — بازنده‌ی race صادقانه `changed:false` می‌گیرد؛ امتیازِ باشگاه فقط زیرِ `if (result.changed)` صدا زده می‌شود، و `addClubPoints` **تنها یک محلِ فراخوانیِ** production دارد (`lifecycle.ts:175`، برایِ `reason='reservation'`) | grep کاملِ `addClubPoints(` در `src/`: یک نتیجه، `lifecycle.ts:175` | من |
| F10 | major (اضافه‌شده) | lifecycle | من **دو تستِ تازه** در لایه‌ی سرویس (بدونِ HTTP) اضافه کردم که مستقیماً `transitionReservation` را دوبار صدا می‌زنند — یکی متوالی (شبیه‌سازیِ cronِ دوباره)، یکی کاملاً هم‌زمان با `Promise.all` (شبیه‌سازیِ دو workerِ cron) — و **شمارِ ردیفِ دفتر** را صریح می‌سنجند (نه فقط دلتایِ موجودی، طبقِ قانونِ ۴ قانون‌اساسی) | `api/tests/checkin-points-panel-path.integration.test.mts` (describeِ «اثباتِ idempotency»، توابعِ اضافه‌شده) — اجرا: **exit 0، هر دو pass** | من، این اجرا |

**کامندِ واقعی و خروجی (پیش از هر تغییرِ اسکیما):**
```
$ npx tsx --test --test-reporter=spec --test-force-exit \
    tests/checkin-points-panel-path.integration.test.mts \
    tests/loyalty-club-points.integration.test.mts
...
ℹ tests 18
ℹ pass 18
ℹ fail 0
$ echo $?
0
```

**نتیجه‌گیریِ صریح طبقِ دستورِ CEO:** «اگر double-`checked_in` از قبل double-credit
می‌داد، migration رویِ دیتایِ کثیف fail می‌شد.» — **نمی‌داد**. این اندازه‌گیری قبل
از نوشتنِ migration ۰۸۱ انجام شد؛ چراغِ سبز برایِ ادامه.

---

## ۴. کلیدِ idempotency — تصمیمِ مالک و اجرا

### تصمیمِ مالک (۲۰۲۶-۰۹-۰۹، از راهِ CEO)
گزینه‌یِ (ب): ستونِ صریحِ `idempotency_key`، نه کلیدِ طبیعیِ
`(userId, restaurantId, reason, note)` — چون `note` متنِ آزادِ فارسی است
(`کش‌بک رزرو ${code}`، `reservations.ts:616`) و یکتاییِ متکی به متنی که هرکسی
بی‌خبر ویرایش می‌کند، همان کلاسِ نقصِ کلیدهایِ override XSS است.

### چرا nullable + `UNIQUE` معمولی (نه partial)
اولین طراحی‌ام یک ایندکسِ **جزئی** (`WHERE idempotency_key IS NOT NULL`) بود، به
تقلید از `uniq_annual_reward`/`staff_owner_phone_unique_idx`. **این اشتباه بود
و خودم پیش از commit کردنش پیدا کردم** (بندِ ۱ منشور: خطایِ خودت را قبل از
دیگران گزارش کن): در Postgres یک `UNIQUE` معمولی رویِ ستونِ nullable *به‌خودی‌خود*
NULLها را برابر نمی‌شمارد — یعنی همان رفتار را بدونِ نیازِ به WHERE می‌دهد.
الگویِ دقیقاً همین شکل از قبل در همین schema هست: `Job.idempotencyKey String? @unique`
(`schema.prisma:1272`).

**یافته‌ی جانبی حین همین مقایسه:** جدولِ `jobs` عملاً **دو** ایندکسِ یکتایِ رویِ
همان ستون دارد — `jobs_idempotency_key_key` (Prismaِ native، بدونِ WHERE) **و**
`idx_jobs_idem` (SQLِ دستی، جزئی، `WHERE idempotency_key IS NOT NULL`). دومی
کاملاً زائد است (همان تضمین را با هزینه‌ی نوشتنِ دوبرابر تکرار می‌کند) — یک
رگرسیونِ کوچکِ قدیمی، خارج از دامنه‌ی من (`jobs`/`queue.ts` مالِ backend-integrity
است)، اینجا فقط برایِ ثبت.

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F11 | minor | jobs (خارج از دامنه) | `jobs.idempotency_key` دو ایندکسِ یکتایِ زائد دارد | `docker exec rezv-test-pg psql ... "\d jobs"` → خروجیِ خام: هر دو ایندکس با تعریفِ متفاوت (یکی بدونِ WHERE، یکی با) رویِ همان ستون | من، این اجرا |

### Migration واقعی
`api/prisma/sql/081-points-ledger-idempotency-key.sql` (idempotent —
`ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`):
```sql
ALTER TABLE points_ledger ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_idempotency_key_key
  ON points_ledger (idempotency_key);
```
schema.prisma: `idempotencyKey String? @unique @map("idempotency_key")` روی
`PointsLedger` (خط ۶۹۶). هردو با هم اعمال شدند؛ تست:
`tests/schema-drift.integration.test.mts` → **exit 0، ۳/۳ pass** (بدونِ نیاز به
هیچ استثنایِ تازه در ACCEPTED_DRIFT — `prisma migrate diff` این ستون/ایندکس را
اصلاً به‌عنوانِ drift نمی‌بیند، دقیقاً مثلِ `Job.idempotencyKey`).

### nullability — صداقتِ صریح
قید **داوطلبانه** است، نه اجباری: nullable بودنِ ستون یعنی اولین نویسنده‌ای که
کلید ندهد، بی‌صدا از قید رد می‌شود (insert با `NULL` همیشه موفق است، چون NULL با
NULL برابر شمرده نمی‌شود). این migration فقط ستون/ایندکس را می‌سازد؛ **اجبارِ
واقعی از کدِ نویسنده‌ها می‌آید**، نه از DB.

**نویسنده‌هایی که امروز کلید می‌گیرند (پنج محلِ تولیدِ ledger، همه پیدا و همه
به‌روز شدند):**

| نویسنده | فایل:خط | کلید | ضامنِ مستقلِ موجود |
|---|---|---|---|
| چک‌ین رزرو | `lifecycle.ts:175-181` | `arrival:{reservationId}` | CAS در `transitionReservation` (F9) |
| کش‌بکِ رزرو | `reservations.ts:615-622` | `cashback:{reservationId}` | **هیچ‌کدام — این تنها نویسنده‌ای بود که از addPoints/addClubPoints عبور نمی‌کرد** (F6) |
| referral | `loyalty.ts:230-236` | `referral:{referral.id}` | claim اتمیک رویِ خودِ ردیفِ Referral (`updateMany where status:pending`) |
| تولد | `loyalty.ts:429-434` | `annual:{userId}:birthday:{year}` | `uniq_annual_reward` (partial، از قبل موجود) |
| سالگرد | `loyalty.ts:459-462` | `annual:{userId}:anniversary:{year}` | همان بالا |

**نویسنده‌ای که کلید نگرفت (عمداً):** `reason:'adjustment'` (اعطای دستیِ
ادمین) — امروز **هیچ مسیرِ production‌ای این reason را صدا نمی‌زند** (فقط
تست‌ها، برایِ شبیه‌سازیِ عبور از آستانه‌ی سطح). اگر/وقتی یک routeِ ادمینیِ واقعی
ساخته شود، باید خودش تصمیم بگیرد کلید بدهد یا نه — این تغییر امضایِ هیچ تابعی
را اجباری نکرد، فقط اجازه داد.

**«چه اتفاقی می‌افتد اگر نویسنده‌ی آینده فراموش کند»:** insert بدونِ خطا موفق
می‌شود، ردیف با `idempotency_key=NULL` می‌نشیند، و **هیچ محافظتی از قیدِ DB
نمی‌گیرد** — دقیقاً همان وضعیتِ امروزِ `reason:'adjustment'`. این قید یک شبکه‌ی
ایمنیِ اضافه است، نه جایگزینِ بازبینیِ کد برایِ نویسنده‌هایِ تازه.

### falsifiability — اثباتِ زنده
تستِ `tests/points-ledger-idempotency-key.integration.test.mts` («falsifiability:
حذفِ ایندکس...») واقعاً این چهار قدم را در یک اجرایِ زنده انجام داد:
1. `DROP INDEX points_ledger_idempotency_key_key` (زنده، رویِ DBِ تست)
2. insertِ دوم با همان کلید → **موفق شد** (۲ ردیف تکراری واقعاً ساخته شدند — قرمز)
3. `CREATE UNIQUE INDEX IF NOT EXISTS ...` (بازگردانی، عیناً محتوایِ migration ۰۸۱)
4. insertِ دوم دوباره → **`P2002` گرفت** (سبز)

```
$ npx tsx --test --test-reporter=spec --test-force-exit tests/points-ledger-idempotency-key.integration.test.mts
✔ 🔴 دو insertِ مستقیم با همان کلید → دومی P2002 می‌گیرد
✔ 🔴 falsifiability: حذفِ ایندکس → insertِ دوم موفق می‌شود (قرمز) → بازگردانی → دوباره P2002 (سبز)
✔ NULL با NULL تداخل نمی‌کند
✔ addPoints/addClubPoints پارامترِ idempotencyKey را عیناً به ستون می‌رسانند
✔ 🔴 referral: کلید = referral:{referral.id}
✔ 🔴 cashback (reservations.ts:615): کلید = cashback:{reservationId}
ℹ tests 6
ℹ pass 6
ℹ fail 0
$ echo $?
0
```

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F12 | major | ledger | مسیرِ کش‌بکِ رزرو (`reservations.ts:615`) پیش از این کار **هیچ پوششِ تستی** نداشت — `grep cashback tests/*.mts` فقط روتِ *پیکربندیِ* کش‌بک (`/restaurant/cashback`) را می‌زد، نه خودِ نوشتنِ ledger | grep دقیق: دو نتیجه، هردو `cashbackRoute`/`R.cashback` (پیکربندی)، صفر نتیجه برایِ نوشتنِ ledger | من |

---

## ۵. کوئریِ بدهی — فقط کاوش (بندِ ۳، read-only طبقِ دستور)

**هیچ تابعِ کتابخانه‌ای برایِ «کلِ بدهیِ باز» امروز وجود ندارد — نه یک نسخه، نه
چند نسخه‌ی ناسازگار.** کوئریِ `SELECT restaurant_id, SUM(delta) ... GROUP BY
restaurant_id` که در `CLUB-PHASE0.md:105-110` آمده، **فقط در همان سندِ ممیزی
اجرا شده** (دستی، برایِ اندازه‌گیری)، هرگز به کد راه پیدا نکرده.

**چهار aggregate موجود، هرکدام برایِ مقصودِ متفاوت (بدونِ تناقض، ولی با
دوباره‌کاری):**

| محل | scope | فیلتر | معنی |
|---|---|---|---|
| `loyalty.ts:83-86` (`addPoints`، داخلِ tx) | یک userId، کلِ پلتفرم | بدون فیلترِ delta | موجودیِ لحظه‌ایِ بعدِ insert |
| `loyalty.ts:91-92` (`getPointsBalance`) | یک userId، کلِ پلتفرم | بدون فیلتر | همان منطق، تکرارشده به‌عنوانِ getterِ مستقل |
| `loyalty.ts:127-131` (`addClubPoints`، داخلِ tx) | یک (userId,restaurantId) | بدون فیلتر | موجودیِ لحظه‌ایِ همان رستوران |
| `loyalty.ts:163-166` (`getClubPointsBalance`) | یک (userId,restaurantId) | بدون فیلتر | همان منطق، تکرارشده |
| `members/route.ts:67-72` | یک restaurantId، چند userId (`groupBy`) | بدون فیلتر | نسخه‌ی batch‌شده‌یِ همان برایِ فهرستِ پنل |
| `dna-summary.ts:270-272` | یک userId، یک بازه‌ی زمانی | **`delta: {gt:0}`** | «امتیازِ کسب‌شده» (جریان، نه موجودی) |

هیچ‌کدام این‌ها **بدهیِ سراسری/per-restaurant** را حساب نمی‌کنند (آن‌چه فازِ ۸
پلن به آن نیاز دارد). **جایی که تابعِ کتابخانه‌ای باید زندگی کند:**
`api/src/lib/loyalty.ts`، کنارِ `getPointsBalance`/`getClubPointsBalance`، با
همان جفت‌مفهومِ nullability: `getRestaurantLiability()` باید
`GROUP BY restaurant_id WHERE restaurant_id IS NOT NULL` باشد («اعتبار»)، و یک
تابعِ جدا برایِ «سکه‌ی پلتفرمیِ باز» با `WHERE restaurant_id IS NULL` — این دو
مفهومِ حسابداریِ متفاوتند و نباید در یک عدد ادغام شوند. **نساختمش** — طبقِ دستور.

---

## ۶. کیف‌پولِ اپِ کاستومر — یافته، نه رفع (طبقِ دستورِ صریح: «وارد نشو»)

CEO مستقیماً پرسید: اگر کارِ ledger چیزی دربابِ منبعِ موجودیِ کیف‌پول نشان داد،
بگو. نشان داد — و این جدا از «دوگانگیِ points_ledger/club_members.points»یی
است که پلن مطرح کرده؛ این یک **سیستمِ سومِ کاملاً متفاوت** است
(`CustomerEconomyProfile.walletBalance` + `EconomyLedgerEntry`، نه
`points_ledger`)، دقیقاً همان «سه سیستمِ موازی» که `PHASE-2-PLAN.md:587-589`
(P1-6) به آن اشاره کرده بود.

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F13 | info | economy | «سکه»یِ کیف‌پول (UI: `apps/customer/js/features/economy.js:112`، «جدا از امتیازِ باشگاه») از `points_ledger` **نمی‌آید** — منبعش `CustomerEconomyProfile.walletBalance` است، جدولِ کاملاً متفاوت | `api/src/app/api/v1/me/economy/route.ts:31` (`wallet_balance: profile.walletBalance`) | من |
| F14 | good | economy | مسیرِ **کسبِ** سکه (`grantEconomyRewardTx`, `economy.ts:339-352`) درست طراحی شده: insertِ خامِ `economy_ledger_entries` با `ON CONFLICT (reservation_id, kind) DO NOTHING`، و increment رویِ `walletBalance` فقط اگر insert واقعاً اتفاق افتاده باشد (`r.length > 0`) — همان الگویِ ledger-first که `addClubPoints` برایِ points_ledger دارد | `api/src/lib/economy.ts:320-361` | من |
| F15 | **major** | economy | مسیرِ **خرجِ** سکه (بازخریدِ Reward Marketplace، `rewards.ts` — امروز به‌طورِ زنده در همین چک‌آوت توسطِ نشستِ دیگری در حالِ ویرایش) طبقِ کدِ مشاهده‌شده در اجرایِ تستِ کامل، مستقیماً `UPDATE customer_economy_profiles SET wallet_balance = wallet_balance - ...` می‌زند و **هیچ ردیفی در `economy_ledger_entries` نمی‌سازد** — با اینکه `EconomyLedgerKind` دقیقاً یک مقدارِ `wallet_spend` برایِ همین منظور از قبل تعریف شده (`schema.prisma:1968`، کامنت: «خرجِ سکه (مثلاً Reward Marketplace)»). نتیجه: `GET /me/economy` عددِ `wallet_balance` را درست کم می‌کند ولی `recent_activity` (که از همان `economyLedgerEntry.findMany` می‌آید — `me/economy/route.ts:22`) آن خرج را هرگز نشان نمی‌دهد — یعنی برایِ خودِ مشتری، سکه بدونِ توضیح «ناپدید» می‌شود | استکِ خطایِ کاملِ اجرایِ `npm test` (اجرا شد ۲۰۲۶-۰۹-۰۹، هنگامِ ناپایداریِ rewards.ts) شاملِ سورسِ decode‌شده‌ی ماژول — رجوع به بخشِ ۷ برایِ زمینه؛ `prisma/schema.prisma:1965-1998` (تعریفِ enum و مدل) | من — **⚠️ این کد در لحظه‌ی مشاهده ناپایدار/نیمه‌کاره بود (نشستِ دیگر)، پس ممکن است الان رفع شده باشد؛ ادعا را با کدِ فعلی دوباره بررسی کن قبل از تصمیم** |

**این دقیقاً «سرچترین چیزیِ» است که CEO گفت.** توصیه (بدونِ اجرا، چون خارج از
اجازه‌ی من): مسیرِ بازخرید باید همان الگویِ F14 را تکرار کند — یک `INSERT INTO
economy_ledger_entries (..., kind='wallet_spend', amount=-cost, ...)` با
`ON CONFLICT` رویِ کلیدِ idempotencyِ متناسب (مثلاً `(reservation_id,kind)` اگر
معنادار است، وگرنه کلیدی رویِ خودِ `redemption.id`)، **قبل یا در همان تراکنشِ**
کم‌کردنِ `walletBalance` — دقیقاً معکوسِ الگویِ کسب.

---

## ۷. ناهماهنگیِ همزمانی در چک‌آوتِ مشترک — یافته‌ی جانبیِ اجباری

هنگامِ اجرایِ کاملِ `npm test` برایِ تأییدِ نهایی، **یک نشستِ دیگر** (طبقِ پیامِ
CEO: «چهار نشست این چک‌آوت را به اشتراک گذاشته‌اند») هم‌زمان در حالِ ویرایشِ
`api/src/lib/rewards.ts` و افزودنِ `api/tests/reward-delivery-guard.integration.test.mts`
+ یک importِ آن در `api/tests/_all.runner.mts` بود — کاملاً خارج از فایل‌هایِ
من. نتیجه: اولین اجرایِ کاملِ من با خطایِ importِ ماژول (exportِ ناموجود)
شکست خورد؛ بعدِ کامنت‌کردنِ **موقتِ** همان یک importِ متعلق به آن‌ها (نه فایلی
از من، بازگردانده‌شده بلافاصله بعدِ اندازه‌گیری) اجرایِ کامل ممکن شد.

| id | severity | area | claim | evidence | verified_by |
|---|---|---|---|---|---|
| F16 | **blocker (نه مالِ من)** | rewards/incentive-engine | `npm test` در لحظه‌ی این ممیزی با ۶ شکست در `rewards.integration.test.mts` و `incentive-engine.test.mts` قرمز است — **هیچ‌کدام مربوط به تغییراتِ من نیست** (این دو فایل و `rewards.ts`/`incentive-engine.ts` در diff من صفر تغییر دارند) | خروجیِ کامل: `tests 1633, pass 1627, fail 6` (پس از بازگردانیِ کاملِ فایلِ runner به حالتِ اصلی، شاملِ importِ آن‌ها)؛ محاسبه: baselineِ اعلام‌شده‌ی CEO = `1625 pass/0 fail`؛ ۱۶۲۵−۶+۸(تست‌هایِ تازه‌یِ من)=۱۶۲۷ — تطبیقِ دقیق، اثباتِ ریاضیِ اینکه ۶ شکست از تغییراتِ خارجی می‌آید نه از من | من، این اجرا — لاگِ کامل در scratchpad |

**توصیه به CEO:** این را به نشستِ صاحبِ `rewards.ts` (احتمالاً همان کاری که
`docs/audit/research/LOYALTY-PERK-AUDIT.md` و
`docs/audit/research/proposals/007-loyalty-perk-honesty.md` را ساخته — هردو
untracked، دیده‌شده در همین چک‌آوت) اطلاع بده؛ من دست به `rewards.ts` نزدم.

**تأییدِ مجزا برایِ تغییراتِ خودم (بدونِ آلودگیِ رویدادِ بالا):**
```
$ npx tsx --test --test-reporter=spec --test-force-exit \
    tests/checkin-points-panel-path.integration.test.mts \
    tests/loyalty-club-points.integration.test.mts \
    tests/points-ledger-idempotency-key.integration.test.mts \
    tests/preorder-validation.integration.test.mts \
    tests/schema-drift.integration.test.mts
ℹ tests 35
ℹ pass 35
ℹ fail 0
$ echo $?
0
```

---

## ۸. شمارِ تست — قبل/بعد

- **قبل (baselineِ CEO، تأییدشده توسطِ من پیش از هر تغییر):** ۱۶۲۵ pass / ۰ fail / ۳۹۰ suites.
- **بعد (فایل‌هایِ من، اجرایِ ایزوله):** ۳۵/۳۵ pass در فایل‌هایِ مرتبط.
- **بعد (کاملِ سوئیت، آلوده به کارِ نشستِ دیگر رویِ rewards.ts):** ۱۶۳۳ tests / ۱۶۲۷ pass / ۶ fail / ۳۹۳ suites.
- **افزوده‌ی خودِ من:** دقیقاً ۸ تستِ تازه (۲ در `checkin-points-panel-path.integration.test.mts`، ۶ در `points-ledger-idempotency-key.integration.test.mts`، فایلِ تازه — ثبت‌شده در `tests/_all.runner.mts:123`) + ۳ describe/suite تازه.
- تعدادِ فایل‌هایِ تغییریافته: `schema.prisma`، `lifecycle.ts`، `loyalty.ts`، `reservations.ts`، `checkin-points-panel-path.integration.test.mts`، `_all.runner.mts` + فایلِ تازه‌یِ migration و تستِ تازه.

---

## ۹. مرزهایِ فایلی که لمس شدند (افشایِ صریح)

طبقِ `.claude/agents/data-trust-engineer.md`، `lifecycle.ts` و `reservations.ts`
«فایلِ مرزی» هستند (نه در فهرستِ نوشتنیِ من) و باید «هماهنگی از راهِ معمار»
داشته باشند. من این دو فایل را لمس کردم، **فقط برایِ افزودنِ پارامترِ
`idempotencyKey`** — هیچ منطقِ دیگری تغییر نکرد:
- `lifecycle.ts` — فقط یک خط اضافه شد (`idempotencyKey: `arrival:${result.resv.id}``) داخلِ فراخوانیِ موجودِ `addClubPoints`.
- `reservations.ts:610-618` — طبقِ سؤالِ صریحِ CEO تأیید می‌کنم: **فقط** `idempotencyKey` اضافه شد؛ خطِ `cbPct = r.cbBasePct ?? 0` و کلِ منطقِ محاسبه‌ی درصد دست‌نخورده ماند (`git diff` پیوست در بخشِ بالا).
این را چون CEO مستقیماً و با جزئیاتِ کامل دستور داد («Every writer must produce
a key... find them all before you change any of them») به‌عنوانِ اجازه‌ی
صریح از راهِ آمرِ بالاتر از پروتکلِ استانداردِ escalation تلقی کردم — طبقِ همان
اصل که «فقط تصمیم‌ها بالا می‌روند، حقایق را خودت مستقر می‌کنی» و اینجا تصمیم از
قبل گرفته و ابلاغ شده بود.

---

## ۱۰. Git — وضعیت

```
$ git status --porcelain
 M api/prisma/schema.prisma
 M api/src/lib/lifecycle.ts
 M api/src/lib/loyalty.ts
 M api/src/lib/reservations.ts
 M api/tests/_all.runner.mts
 M api/tests/checkin-points-panel-path.integration.test.mts
A  api/prisma/sql/081-points-ledger-idempotency-key.sql   (staged طبقِ درخواستِ فوریِ CEO)
?? api/tests/points-ledger-idempotency-key.integration.test.mts
```
هیچ commitی زده نشده تا این گزارش خوانده شود (طبقِ دستور: «commit the report and
the test; do not push — I review first»). کامیتِ نهایی با pathspecِ صریح خواهد
بود، هرگز `git add -A` (چهار نشست این چک‌آوت را به اشتراک گذاشته‌اند).

---

## چه دیدم که کسی نخواست

۱. **جدولِ `jobs` دو ایندکسِ یکتایِ زائد رویِ `idempotency_key` دارد**
   (`jobs_idempotency_key_key` + `idx_jobs_idem`) — یکی کاملاً کافی است؛ دومی
   فقط هزینه‌ی نوشتن اضافه می‌کند. خارج از دامنه‌ی من (`queue.ts`/`jobs` مالِ
   backend-integrity)، فقط ثبت شد (F11).

۲. **`POINTS.signup` (۲۰۰) و `POINTS.perReservation` (۱۰۰) در `loyalty.ts:11-16`
   کدِ مرده‌اند** — هیچ فراخوانی‌ای در کلِ `src/` ندارند. یا یک ویژگیِ
   نیمه‌ساخته‌اند (پاداشِ ثبت‌نام که هرگز وایر نشد) یا باید حذف شوند — طبقِ
   §۲۱ («حذفِ شهودی ممنوع») تصمیمش با معمار/مالک است، نه من.

۳. **مسیرِ خرجِ سکه‌یِ کیف‌پول (Reward Marketplace) هیچ ردیفِ ledger نمی‌سازد**
   با اینکه `EconomyLedgerKind.wallet_spend` دقیقاً برایِ همین از قبل تعریف
   شده بود — دقیقِ ادعایِ CEO («کیف پول باید واقعی باشه») (F15). این را چون
   مستقیماً پرسیده شد گزارش کردم، نه چون در دامنه‌ی خودم بود.

۴. **یک نشستِ دیگر هم‌زمان `rewards.ts` را در همین چک‌آوت به حالتِ ناپایدار
   می‌برد** — کارِ من را مسدود نکرد (منزوی شد)، ولی اگر کسی این لحظه `npm test`
   را بدونِ آگاهی اجرا کند، ۶ شکست را به تغییراتِ فازِ ۱ نسبت می‌دهد در حالی که
   منشأش کاملاً جای دیگری است (F16).

---

## بلوکِ عدم‌قطعیت
```
── بلوکِ عدم‌قطعیت ──────────────────────────────
سطحِ اطمینانِ کلی: متوسط-به-بالا
FACT (خودم در همین اجرا دیدم/اجرا کردم):
  - F1-F12, F14, F16 — همه با کوئریِ زنده یا اجرایِ تستِ واقعی، exit codeِ ضمیمه
  - schema-drift test پس از اضافه‌شدنِ ستون/ایندکسِ من: exit 0، بدونِ استثنایِ تازه
  - falsifiability کاملِ ستونِ idempotency_key: drop→قرمز→restore→سبز، همه زنده رویِ DBِ تست
EVIDENCE (از سندِ دیگری، خودم اجرا نکردم):
  - ADR-P2-011/012 خودشان می‌گویند مقایسه‌ی «۱۰۰ به‌جای ۵۰» را اجرا کرده‌اند — من فقط سند را خواندم، دوباره اجرا نکردم (چون همان تستِ زنده امروز هم موجود و سبز است و اجرا شد)
FACT (F15 — با احتیاطِ زمانی):
  - محتوایِ rewards.ts که دیدم از یک stack traceِ اجرا شده آمد، نه از خواندنِ مستقیمِ فایل (چون فایل به‌طورِ زنده توسطِ نشستِ دیگری در حالِ تغییر بود) — کدِ فعلیِ فایل ممکن است در لحظه‌ی خواندنِ این گزارش فرق کند
INFERENCE (استنتاجِ من، مستقیم دیده نشده):
  - F7 («مینِ خاموش») — استنتاج از عدمِ خواننده، نه از رفتارِ آینده
  - توصیه‌ی بخشِ ۶ (الگویِ wallet_spend) — طراحیِ پیشنهادی، نه تأییدشده با تست
UNKNOWN (نتوانستم verify کنم):
  - آیا `CustomerEconomyProfile.walletBalance` رویِ DADAیِ واقعیِ production با جمعِ `economy_ledger_entries` می‌خواند یا نه — فقط دو DBِ محلی/تست در دسترس بود، نه production
  - آیا اعلامِ صریحِ «حلقه‌های ۱-۷ پایدار» جایی خارج از docs/ (مثلاً یک پیامِ مستقیم به نشستِ قبلی) وجود داشته — فقط grep رویِ docs/ انجام شد
verify نشده‌ها: production DB (فقط test DB در دسترس بود)؛ حالتِ نهاییِ rewards.ts بعدِ اتمامِ نشستِ دیگر
گیتِ خروجِ نقش: سبز برایِ تغییراتِ خودم (۳۵/۳۵، schema-drift ۳/۳)؛ قرمزِ خارجی در rewards.ts/incentive-engine.ts (نه مالِ من — F16)
نیازِ escalation: بله — (۱) گیتِ فعال‌سازیِ نقش بدونِ اعلامِ صریحِ معمار (خودم گزارش کردم، متوقف نشدم — دلیل در بالا)؛ (۲) F15 (کیف‌پول) — CEO مستقیماً خودش رویِ آن کار می‌کند، فقط گزارش شد؛ (۳) F16 باید به نشستِ صاحبِ rewards.ts برسد
─────────────────────────────────────────────────
```
