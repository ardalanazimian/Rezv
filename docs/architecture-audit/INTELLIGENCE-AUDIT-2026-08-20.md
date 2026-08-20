# ممیزیِ معماریِ هوش رزرونو — ۲۰۲۶-۰۸-۲۰

> **روشِ کار:** این گزارش از رویِ خواندنِ کدِ واقعی و اجرایِ زنده نوشته شده، نه از رویِ
> مستندات. هرجا مستندات با کد اختلاف داشت، **کد منبعِ حقیقت گرفته شد**.
> تست‌ها روی Postgres 16 + Redis 7 واقعی اجرا شدند: **۵۳۶/۵۳۶ سبز، ۰ شکست**.
>
> این گزارش جایگزینِ `AI_PLATFORM_AUDIT.md` (۲۰۲۶-۰۷-۳۰) است — آن سند دیگر کهنه است
> (بخشِ «درستی‌سازیِ مستندات» پایین).

---

## A. خلاصه‌ی مدیریتی

رزرونو **بنیانِ واقعیِ ML دارد** — نه heuristicِ صرف، برخلافِ چیزی که مستنداتِ قبلی می‌گفتند:
رگرسیونِ لجستیکِ per-restaurant برایِ no-show، Holt-Winters برایِ تقاضا، هولدآوتِ زمانی،
مقایسه با baseline، و گیتِ فعال‌سازی که مدلِ بدتر را هرگز جایگزین نمی‌کند.

ولی این بنیان یک **حلقه‌ی باز** داشت. مهم‌ترین یافته‌ی این ممیزی:

> **همه‌ی اعدادِ کیفیتِ مدل مربوط به «لحظه‌ی آموزش» بودند. هیچ عددی از «تولید» وجود نداشت.**

`learned_brier`/`static_brier` و `model_training_runs.metrics` همگی روی هولدآوتِ همان شبِ
آموزش حساب می‌شوند. یعنی داشبوردِ سلامتِ مدل به این سؤال جواب می‌داد: «دیشب روی دادهٔ
کنارگذاشته‌شده‌ی خودش چقدر خوب بود؟» — و به این سؤال **هیچ جوابی نداشت**: «پیش‌بینی‌هایی
که واقعاً تحویلِ رستوران شد، چقدر درست درآمد؟»

بدتر، یک نشتِ داده‌ایِ ساکت: `computeNoShowRisk` فیلدِ `source` (`learned` یا `heuristic`)
را برمی‌گرداند، ولی `createReservation` آن را به `{score, tier}` تنگ می‌کرد و منبع **دور
ریخته می‌شد**. نتیجه: حتی با تاریخچه‌ی کاملِ رزروها هم نمی‌شد فهمید کدام امتیاز را مدل
داده و کدام را heuristic — پس مقایسه‌ی تولیدیِ این دو **ساختاراً غیرممکن** بود.

**کاری که در این PR انجام شد:** همان حلقه بسته شد — دفترِ پیش‌بینی، دفترِ نتیجه، و سنجشِ
تولیدی (Brier + کالیبراسیون + طبقه‌بندیِ سلامت)، وصل‌شده از مسیرِ واقعیِ رزرو تا داشبوردِ
پنلِ شرکت، با تستِ end-to-end.

**کاری که انجام *نشد*** (و عمداً): فازهای ۸ تا ۱۴ نقشه‌راه (یادگیریِ توصیه، هوشِ بازاریابی،
شبیه‌سازی، حافظه/RAG/embedding، عامل‌های پیشرفته). دلیل در بخشِ AA.

---

## B. معماریِ فعلی

- **پنج اپ:** `apps/customer`, `apps/business`, `apps/company` (وانیلا JS، بدونِ build)،
  `apps/landing`, `apps/seo` (Next.js+React مستقل).
- **بک‌اند:** `api/` روی Next.js 16 (App Router). همه‌ی مسیرهایِ API این‌جاست.
- **داده:** PostgreSQL + Prisma (migrationهایِ SQLِ خام در `api/prisma/sql/`، اعمال با
  `apply-sql.sh`). Redis برایِ کش/rate-limit/قفل.
- **هوش:** کاملاً داخلِ `api/src/lib/` — بدونِ سرویسِ ML جدا، بدونِ وابستگیِ LLMِ بیرونی.

## C. معماریِ داده

| جدول | نقش | وضعیت |
|---|---|---|
| `reservations` | منبعِ حقیقتِ رفتار | IMPLEMENTED |
| `customer_insights` | CLV/RFM/churn/no-show per (رستوران×کاربر) | IMPLEMENTED |
| `guest_profiles` | rollupِ سراسریِ مهمان | IMPLEMENTED |
| `restaurant_no_show_models` | وزن‌هایِ مدلِ فعال (تک‌ردیفی، شبانه overwrite) | IMPLEMENTED |
| `restaurant_demand_forecasts` | حالتِ Holt-Winters (تک‌ردیفی) | IMPLEMENTED |
| `model_training_runs` | تاریخچه‌ی append-only آموزش | IMPLEMENTED |
| `platform_events` | رویدادِ رفتاریِ کانونی | ⚠️ **فقط نوشتنی** (بخشِ D) |
| `model_predictions` | دفترِ پیش‌بینی | **NEW — این PR** |
| `model_outcomes` | دفترِ نتیجه | **NEW — این PR** |

## D. معماریِ رویداد

دو سیستمِ رویدادِ **عمداً جدا** وجود دارد و هیچ‌کدام تکراری نیست:

- `lib/events.ts` — رویدادِ دامنه → تحویلِ webhook (صف + retry + HMAC + گاردِ SSRF).
  **IMPLEMENTED.**
- `lib/platform-events.ts` → جدولِ `platform_events` — رویدادِ رفتاری برایِ تحلیل.
  **⚠️ DISCONNECTED.**

### یافته‌ی D-1 (رفع‌نشده — ثبت‌شده)
`platform_events` یک **جدولِ فقط-نوشتنی** است. تولیدکننده‌هایش فقط `/v1/telemetry` و چهار
نقطه در `lib/site-orders.ts` هستند؛ **هیچ کوئریِ خواننده‌ای در کلِ `api/src` وجود ندارد**
(با grep روی `platformEvent.`/`platform_events` تأیید شد). یعنی «بنیانِ کانونیِ دادهٔ
رفتاری» امروز هیچ هوشی را تغذیه نمی‌کند. طبقِ §۵۲ ثبت می‌شود، حذف نمی‌شود — مصرف‌کننده‌اش
کارِ فازِ بعد است، نه جدولش اشتباه.

> ⚠️ `/api/v1/events` **این** نیست — آن مسیر رویدادهایِ ویژه‌ی رستوران (`special_events`)
> را برمی‌گرداند. نامِ مشابه، دامنه‌ی کاملاً متفاوت.

## E. قابلیت‌های ML فعلی

| قابلیت | فایل | طبقه‌بندی |
|---|---|---|
| ریاضیاتِ مشترک (sigmoid/GD/Brier/MAE/گیتِ فعال‌سازی) | `ml-core.ts` | **IMPLEMENTED** |
| no-show — رگرسیونِ لجستیکِ per-restaurant | `no-show-model.ts` | **IMPLEMENTED** |
| پیش‌بینیِ تقاضا — Holt-Winters | `demand-forecast.ts` | **IMPLEMENTED** |
| گیتِ بایاسِ کانالی | `no-show-model.ts` | **IMPLEMENTED** |
| سنجشِ تولیدی | `model-evaluation.ts` | **NEW — این PR** |

**نشتِ زمانی:** بررسی شد و **سالم است**. `fetchTrainingRows` از
`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING` استفاده می‌کند (فقط رزروهایِ قبل از
همین ردیف) و `PARTITION BY COALESCE(user_id::text, id::text)` مانعِ قاطی‌شدنِ سابقه‌ی
مهمان‌های بی‌حساب می‌شود. split هم زمانی است نه تصادفی.

## F. قابلیت‌های AI

**هیچ LLMِ بیرونی‌ای در مسیرِ تولید نیست.** `lib/assistant*.ts` یک NLUِ قاعده‌محورِ فارسیِ
آفلاین است (نه مدلِ زبانی). این برایِ بازارِ هدف (تحریم/دسترسی) تصمیمِ درستی است و
به‌عنوانِ AI جا زده نشده.

## G/H. هوشِ مشتری و رستوران

`CustomerInsight` (CLV/RFM/churn/segment) و `GuestProfile` واقعی و متصل‌اند. تفکیکِ
«صفرِ تأییدشده» از «نامعلوم» (NULL) قبلاً در PR #26/#33 درست شده و رعایت می‌شود — نکته‌ی
مهمی که §۴۰ (POS/درآمد) می‌خواهد: مبلغ فقط از پیش‌سفارشِ منو می‌آید و اگر منویِ قیمت‌دار
نباشد NULL می‌ماند، نه ۰.

## I. پیش‌بینی

Holt-Winters با فصلیِ هفتگی، baselineِ فصلیِ ساده، MAE، هولدآوتِ زمانی، فعال‌سازیِ
مشروط. مصرف‌کننده‌ها: `/v1/restaurant/ai`, `assistant-answers.ts`,
`cancellation-policy.ts`, `incentive-engine.ts`. **IMPLEMENTED.**

## J. سیستمِ توصیه

`lib/crm-recommendations.ts` — **قاعده‌محورِ خالص** (`recommendContact`/
`rankCrmRecommendations`؛ هیچ ارجاعی به مدل/وزن/احتمال ندارد). این **بد نیست**، ولی نباید
«AI» نامیده شود. **IMPLEMENTED (rule-based)** — یادگیرنده نیست.

## K. هوشِ بازاریابی

`lib/automation.ts` + `campaign_logs`: تریگرِ قاعده‌محور (تولد/winback). سنجشِ نتیجه‌ی
کمپین بر اساسِ رزروِ افزایشی وجود ندارد. **PARTIAL.**

## L. چرخه‌ی حیاتِ مدل

قبل از این PR: `TRAIN → VALIDATE → ACTIVATE`.
بعد از این PR: `… → PREDICT → RECORD → OBSERVE OUTCOME → MEASURE`.
هنوز خودکار نیست: `DETECT DRIFT → GENERATE CANDIDATE → APPROVE` (بخشِ AA).

## M. نسبِ داده/ویژگی

هر ردیفِ `model_predictions` با خودش `model_source`, `model_version`, `feature_version` و
خودِ بردارِ `features` را نگه می‌دارد. یعنی هر عددِ تولیدی تا مدل و ورودی‌اش قابلِ‌ردیابی
است. **NEW.**

## N. معماریِ پیش‌بینی/نتیجه

دو جدولِ append-only (migration 055). یکتاییِ پیش‌بینی روی
`(type, subject_type, subject_id, model_version)` — یعنی retry ردیفِ تکراری نمی‌سازد ولی
مدلِ **بازآموزی‌شده** می‌تواند نسخه‌ی جدیدی از پیش‌بینی ثبت کند بدونِ بازنویسیِ تاریخچه.
نتیجه یکتا روی `(type, subject_type, subject_id)` — هر رزرو دقیقاً یک واقعیت دارد؛ اولین
ثبت برنده است.

## O. حلقه‌ی یادگیری

```
رزرو → predictNoShowRisk (learned یا heuristic)
     → model_predictions (نسخه + ویژگی + احتمال + افق)
     → … مهمان آمد/نیامد …
     → transitionReservation → model_outcomes (برچسبِ واقعی)
     → fetchNoShowPairs (INNER JOIN)
     → evaluatePairs (Brier تولیدی + کالیبراسیون + سلامت)
     → /v1/admin/ai/model-health → پنلِ شرکت
```

## P. عامل‌های AI

`agency/registry/agents.yaml` صریحاً `AGENCY_STATUS=DISABLED` و
`autonomous_execution: false` است و خودش می‌گوید «رجیستریِ نقش است، نه runtime». هیچ کدِ
اجرایی‌ای در `api/src` به آن ارجاع ندارد. **DOCUMENTED ONLY — و درست هم همین است.**
این ممیزی عمداً هیچ چیزی را در آن فعال نکرد (§۳۹).

## Q. امنیت

- دو جدولِ جدید RLS فعال دارند (deny-by-default، هم‌راستا با migration 037) — روی DBِ
  زنده تأیید شد.
- کوئریِ سنجش با `Prisma.sql`/`Prisma.empty` ساخته می‌شود و `restaurantId` **bind**
  می‌شود، نه الحاقِ رشته‌ای → جایی برای SQL injection نمی‌ماند.
- ایزولاسیونِ تنانت با تستِ زنده اثبات شد: `fetchNoShowPairs({restaurantId: other})`
  هیچ‌کدام از جفت‌هایِ رستورانِ دیگر را نمی‌بیند.
- **ریسکِ باقی‌مانده:** کنترلِ دسترسیِ واقعی همچنان در لایه‌ی اپلیکیشن است (بک‌اند با نقشِ
  owner وصل می‌شود و RLS را دور می‌زند). این طراحیِ از-قبلِ پروژه است، نه رگرسیونِ این PR.

## R. حریمِ خصوصی

ستونِ `features` عمداً **بدونِ PII** است: فقط `hasUserId`, `priorTotal`,
`priorNoShowRate`, `leadMinutes`, `partySize`, `source`. نه نام، نه شماره‌ی تماس.
نگه‌داری: هر دو دفتر بعد از **۲ سال** در `maintenance/retention` پاک می‌شوند (پنجره‌ی
سنجشِ واقعی ۹۰ روز است).

## S. رصدپذیری

سنجشِ تولیدی در `/v1/admin/ai/model-health` بخشِ `production` و در پنلِ شرکت به‌صورتِ
پنلِ «کیفیت در تولید» دیده می‌شود، با تفکیکِ learned/heuristic.

## T. کارایی و تاب‌آوری

هر دو نوشتنِ دفتر **بدونِ `await`** روی مسیرِ پاسخ و **بدونِ throw** انجام می‌شوند (همان
الگویِ `platform-events.ts` و `emit`). اگر دفتر بشکند، رزرو و تغییرِ وضعیت سالم ادامه
می‌دهند — §۴۶ رعایت شد.

## U. تست

| فایل | نوع | تعداد |
|---|---|---|
| `model-evaluation.test.mts` | واحد (ریاضیات + صداقتِ گزارش) | ۲۴ |
| `prediction-ledger.integration.test.mts` | integration زنده (DB) | ۱۰ |
| `intelligence-loop.integration.test.mts` | end-to-end (رزروِ واقعی → دفتر) | ۵ |

مجموع: **۵۳۶/۵۳۶ سبز** روی Postgres+Redis واقعی.

`intelligence-loop` عمداً هیچ تابعِ ثبتی را مستقیم صدا نمی‌زند — فقط `createReservation` و
`transitionReservation`. اگر سیم‌کشی قطع شود، می‌شکند حتی اگر تست‌های واحد سبز بمانند.

## V. شکاف‌های موجود (رفع‌نشده، ثبت‌شده)

1. **D-1:** `platform_events` فقط-نوشتنی — هیچ مصرف‌کننده‌ای ندارد.
2. **V-2:** `apps/business/src-v2/RestaurantIntelligenceDashboard.jsx` **کدِ مرده** است:
   تنها فایلِ آن پوشه، `export default` یک کامپوننتِ React، در اپی که `package.json`
   ندارد، build ندارد و وانیلا JS است. هیچ‌جا ارجاع داده نشده → **هرگز اجرا نمی‌شود**.
   طبقِ §۵۲ حذف نشد (ردیابیِ وابستگی لازم دارد)، فقط ثبت شد.
3. **V-3:** توصیه‌ها (`crm-recommendations.ts`) یادگیرنده نیستند و حلقه‌ی بازخورد ندارند.
4. **V-4:** پیش‌بینیِ تقاضا دفترِ نتیجه ندارد (فقط no-show وصل شد).
5. **V-5:** تشخیصِ drift خودکار نیست — وضعیت محاسبه و نمایش داده می‌شود، ولی هیچ هشدار/
   اقدامِ خودکاری ندارد.

## W. پیاده‌سازی‌های جدید (این PR)

- `api/prisma/sql/055-prediction-outcome-ledger.sql`
- مدل‌های Prisma: `ModelPrediction`, `ModelOutcome`
- `api/src/lib/prediction-ledger.ts`
- `api/src/lib/model-evaluation.ts`
- بخشِ `production` در `/v1/admin/ai/model-health`
- پنلِ «کیفیت در تولید» در `apps/company/js/intelligence.js`
- سه فایلِ تست (۳۹ تست)

## X. اجزایِ گسترش‌یافته

- `no-show-model.ts`: `getActiveNoShowModel()` (وزن + نسخه). `getLearnedNoShowModel` حفظ
  شد تا مصرف‌کننده‌های موجود نشکنند. **کلیدِ کش هم‌راستا شد** (`noshow-model-v2`) تا
  مدلِ تازه پشتِ کشِ کهنه نماند.
- `customer-insights.ts`: `NoShowResult` حالا `probability`/`modelVersion`/`features` دارد.
- `reservations.ts`: `source` دیگر دور ریخته نمی‌شود.
- `lifecycle.ts`: قلابِ نتیجه روی تنها نقطه‌ی مجازِ تغییرِ وضعیت.
- `maintenance/retention`: نگه‌داریِ ۲ ساله‌ی دفترها.

## Y. موردِ تکراریِ حذف‌شده

**هیچ.** هیچ سیستمِ تکراری‌ای ساخته نشد و هیچ کدی حذف نشد. مدلِ no-show و پیش‌بینیِ تقاضا
دست‌نخورده ماندند (§۴/§۵). `platform_events` هم — با اینکه بی‌مصرف است — حذف نشد (§۵۲).

## Z. بدهیِ فنیِ باقی‌مانده

- `restaurant_no_show_models` تک‌ردیفی است و شبانه overwrite می‌شود؛ نسخه‌بندیِ واقعیِ
  مدل (رجیستریِ کامل با rollback) هنوز نیست. `trainedAt` به‌عنوانِ نسخه کار می‌کند ولی
  وزن‌هایِ نسخه‌ی قبلی بازیابی‌پذیر نیستند.
- درجِ دفتر تک‌ردیفی است (بدونِ batch) — در مقیاسِ فعلی مسئله نیست.

---

## درستی‌سازیِ مستندات (§۵۱)

`docs/architecture-audit/AI_PLATFORM_AUDIT.md` (۲۰۲۶-۰۷-۳۰) می‌گوید «آن‌چه AI نامیده
می‌شود در واقع heuristic است — نه مدلِ یادگیریِ ماشینِ آموزش‌دیده» و نمره‌ی ۵.۵/۱۰ می‌دهد.
**این ادعا امروز نادرست است**: `ml-core.ts`, `no-show-model.ts`, `demand-forecast.ts` و
migrationهایِ ۰۳۳/۰۳۴/۰۴۲ بعد از آن تاریخ اضافه شده‌اند. سربرگِ آن فایل به این گزارش
ارجاع داده شد.

---

## AA. نقشه‌راهِ P0–P3

### P0 — انجام شد (این PR)
- دفترِ پیش‌بینی + دفترِ نتیجه
- سنجشِ تولیدی (Brier + کالیبراسیون + طبقه‌بندیِ سلامت)
- رفعِ دورریختنِ `source`
- نمایش در پنلِ شرکت + تستِ end-to-end

### P1 — گامِ منطقیِ بعد
1. **مصرف‌کننده برایِ `platform_events`** (یافته‌ی D-1) — بدونِ آن، فازهایِ ۸+ نقشه‌راه
   دادهٔ ورودی ندارند.
2. **دفترِ نتیجه برایِ پیش‌بینیِ تقاضا** (V-4) — همان الگو، `outcome_label` عددی.
3. **هشدارِ drift** روی وضعیتِ `degraded`/`critical` (V-5) — بدونِ بازآموزیِ خودکار (§۱۹).
4. **تصمیمِ صریح درباره‌ی `RestaurantIntelligenceDashboard.jsx`** (V-2): حذف یا وصل.

### P2
5. رجیستریِ کاملِ مدل با نسخه‌هایِ بازیابی‌پذیر و rollback.
6. حلقه‌ی بازخوردِ توصیه (impression → click → رزرو → حضور).
7. سنجشِ کمپین بر اساسِ رزروِ افزایشی، نه باز-شدنِ پیام.

### P3
8. لایه‌ی ویژگیِ متمرکز.
9. حافظه/دانش/embedding/RAG — **فقط** با یک موردِ استفاده‌ی سنجش‌پذیر (§۲۸).
10. عامل‌ها — فقط با تصمیمِ مکتوبِ انسانی (§۳۹ و `agency/AGENCY_STATUS`).

> **قاعده‌ی ترتیب:** هیچ‌کدام از P2/P3 نباید قبل از P1 شروع شوند. نقشه‌راه خودش می‌گوید
> «قبل از قابلِ‌اتکا شدنِ زیرساختِ داده و یادگیری، به عامل‌های پیشرفته نپرید» — و امروز
> بزرگ‌ترین حفره دقیقاً همان است: جدولی که می‌نویسیم و نمی‌خوانیم.
