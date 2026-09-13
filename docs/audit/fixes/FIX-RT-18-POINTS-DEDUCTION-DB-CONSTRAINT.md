# FIX-RT-18 — وعده‌ی «امتیاز منقضی نمی‌شود» حالا روی دیتابیس قفل است، نه روی regex

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]`
- **مقصد:** Red Team `rezv-25 [2f4e5c]` (نویسنده‌ی RT-18) · CEO · بازبین · مالک (§۴)
- **وضعیت:** **fix submitted** — بسته نشده.
- **آنچه از خواننده می‌خواهد:** مالک: §۴ یک تصمیمِ محصولیِ ضمنی است — «کسرِ دستیِ ادمین» روی DB ممکن نیست. Red Team: §۵ دو باقی‌مانده.

---

## ۱. ادعا

`docs/audit/redteam/RETEST-2026-09-13.md` (شاخه‌ی `redteam/retest-2026-09-13` @ `5786413`)، **RT-18 — FAKEABLE**: رفعِ RT-14 **جا**یی را
که گارد می‌خواند درست کرد، نه **چیزی** را که می‌شناسد. `DEDUCTION_SHAPES` تطبیقِ متنی است (`/delta\s*:\s*-/`):

```ts
const adjustment = 0 - row.points;
await db.pointsLedger.create({ data: { userId: row.user_id, delta: adjustment, reason: … } });
```

با همان کوئریِ `INTERVAL '1 year'` در `api/src/app/api/v1/admin/points-sweep/route.ts` → گارد **خروجِ ۰**. کنترلِ مثبتِ Red Team:
همان فایل با `delta: -row.points` → خروجِ ۱. پیشنهادِ Red Team: «گشادکردنِ regex می‌بازد؛ … (b) یک CHECKِ DB که delta منفی با
reasonِ غیرِ مجاز را رد کند».

## ۲. بازتولید — خودم، نه از روی گزارش

روی `42ba301`، reason = `adjustment` (شکلِ طبیعیِ یک جارو؛ `'cleanup'`ِ payload اصلاً در enum نیست):

```text
RT18 hoisted              EXIT=0   «… api/src نیست (270 فایل اسکن شد)»
RT18 control inline-minus EXIT=1
```

و قرمزِ تستِ رفتاری پیش از مهاجرت:

```text
tests/points-ledger-negative-reason.integration.test.mts   RT18_TEST_EXIT_BEFORE=1   tests 6 · pass 1 · fail 5
  «points_ledger_negative_delta_reason روی points_ledger نیست — مهاجرتِ ۰۸۸ اعمال نشده»
```

⚠️ یک کنترلِ همین فایل در اجرای قرمز **به‌دلیلِ غلط** قرمز شد: جمعِ کلِ دفترِ کاربر را می‌گرفت، و تست‌های بالا (بی‌قید) ردیفِ منفی
نوشته بودند. حالا فقط ردیف‌های خودش را می‌شمارد.

## ۳. تغییر

| فایل | چه |
|---|---|
| `api/prisma/sql/088-points-ledger-negative-delta-reasons.sql` | `CHECK (delta >= 0 OR reason IN ('redemption', 'cashback')) NOT VALID` — idempotent، با `ALTER TABLE` (قیدِ inline در مسیرِ CI گم می‌شد — لایه‌ی ۴ی `check-schema-drift.sh`) |
| `tools/check-loyalty-promise.mjs` | **ضامن را می‌سنجد، نه فقط کد را:** قید در مهاجرت‌ها هست · هیچ مهاجرتی `DROP`ش نمی‌کند · فهرستِ مجاز دقیقاً `[cashback, redemption]` است · `PointsReason` مقدارِ انقضایی (`expir|stale|decay|sweep|ttl|forfeit`) ندارد. اسکنِ متنی می‌ماند و خروجی صریح می‌گوید «فقط هشدارِ زودتر است؛ منفیِ hoisted را نمی‌بیند» |
| `api/tests/points-ledger-negative-reason.integration.test.mts` | **تازه** — قید روی خودِ DB: `pointsLedger.create`، `addPoints` با منفیِ hoisted، و INSERTِ خام، هر سه باید **با نامِ همین قید** رد شوند؛ دو نویسنده‌ی مشروع و `adjustment`ِ مثبت کنترل |
| `api/tests/checkin-points-panel-path.integration.test.mts:295` | fixture: کسرِ `adjustment` → `redemption`. ادعای تست («کسر سطح را پایین می‌آورد») دست نخورد |

**چرا (b) و نه (a)ی Red Team** (wrapperِ تایپ‌شده): «هیچ کدِ دیگری مستقیم منفی ننویسد» را هم باید با تحلیلِ متن ثابت کرد — همان
مسئله‌ی تصمیم‌ناپذیر. قیدِ DB برای Prisma، SQLِ خام، و اصلاحِ دستی روی جدول یکسان است.

**چرا این دو reason:** اندازه‌گیری روی `api/src` (git grep، همه‌ی نویسنده‌های `points_ledger`): منفیِ مشروعِ امروز فقط
`redeemPointsTx` (`'redemption'`) و `reverseReservationCashback` (`'cashback'` با کلیدِ `cashback-reversal:`). صداکننده‌های `addPoints`/`addClubPoints`
همه مثبت‌اند. DBِ ایزوله پیش از قید: `0` ردیفِ ناسازگار.

## ۴. تصمیمِ محصولیِ ضمنی — گفته‌شده، نه پنهان

**از این مهاجرت، «کسرِ دستیِ امتیاز» (مثلاً پس‌گرفتنِ امتیازِ تقلبی توسطِ ادمین) روی DB ممکن نیست.** امروز هیچ مسیرِ کدی برایش نیست.
اگر ساخته شود باید reasonِ صریحِ خودش را بگیرد، قید آگاهانه گشاد شود، و گارد همان لحظه قرمز شود تا کسی تصمیم بگیرد که آیا آن کسر با
وعده‌ی «منقضی نمی‌شن» سازگار است. `ESCALATIONS.md` §E-002 (اقتصادِ امتیاز) پارکِ مالک است؛ این رفع آن را باز نمی‌کند.

## ۵. اثبات

```text
node tools/check-loyalty-promise.mjs                           GUARD_EXIT=0
  «ضامن: قیدِ points_ledger_negative_delta_reason در …/088-… — کسر فقط با [cashback, redemption]»
مهاجرتِ ۰۸۸                                                    MIG088_EXIT=0 · اجرای دوم MIG088_RERUN_EXIT=0
pg_get_constraintdef: CHECK (((delta >= 0) OR (reason = ANY (ARRAY['redemption'::points_reason, 'cashback'::points_reason])))) NOT VALID
points-ledger-negative-reason   6/6 · checkin-points-panel-path 15/15 · points-redemption 20/20
points-ledger-idempotency-key   6/6 · dna-summary 18/18 · schema-drift 3/3                  همه EXIT=0
check-runner-completeness       199 فایل، همه ایمپورت‌شده
```

**جهش** (بازگردانیِ بایت‌به‌بایت + قید دوباره روی DB):

```text
MG1 فهرستِ مجاز + 'adjustment'            گارد exit=1
MG2 مهاجرتِ ۰۸۸ غایب                       گارد exit=1
MG3 مهاجرتِ بعدی DROP CONSTRAINT            گارد exit=1
MG4 PointsReason.expired                   گارد exit=1
MD1 قید روی DB حذف (4 تست قرمز)             تست exit=1
DB constraint restored: exit=0 · restored files byte-identical: true · DB test after restore exit=0     RT18_MUTATION_EXIT=0
```

سوئیتِ کاملِ api روی DBِ تازه: در پیامِ کامیت.

## ۶. آنچه **نبستم**

- **برچسبِ دروغ:** کرونِ انقضایی که عمداً `reason: 'redemption'` بنویسد از قید رد می‌شود. این دیگر «نوشتنِ طبیعی» نیست، جعلِ عمدی است؛
  اسکنِ متنی شاید بگیردش (نشانه‌ی `INTERVAL` پیش از هر معافیتی) و شاید نه. Red Team اگر بخواهد بزند، همین‌جاست.
- **ردیف‌های قدیمی** — `NOT VALID`، بازسنجی نمی‌شوند.
- **`api/prisma/sql`** بیرون از اسکنِ کد است (Red Team گفت). حالا خودِ قید در آنجا پاسداری می‌شود، ولی تریگر/تابعِ دیگری که امتیاز کم کند نه — که باز به همان قید می‌خورد.

## ۷. سپاس — و دو تصحیح که Red Team روی خودش زد

- RT-18 حفره‌ای بود که در رفعِ RT-14 خودم نمی‌دیدم: دامنه را درست کردم و فکر کردم کلاس بسته شد.
- Red Team اعلام کرد ۷ شکستِ `points-redemption` که دیده بود از DBِ آلوده بود، نه نقصِ کد (پس از rebuild: ۲۰/۲۰). و رفع‌های موازیِ خودش
  برای RT-13/RT-14 را **push نکرد** تا دو پیاده‌سازی از یک رفع نسازد. هر دو این‌جا ثبت شد چون همان رفتاری است که این مخزن کم دارد.
