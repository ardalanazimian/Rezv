# فاز ۰ — باشگاه مشتریان: کاوش

> ۲۰۲۶-۰۹-۰۲ · شاخه `feat/admin-totp-login` · **هیچ کدی نوشته نشده، هیچ تصمیمی گرفته نشده**
> هر ادعا با فایل:خط یا خروجی خام. جهش‌ها تزریق و **بازگردانده** شدند (درخت تمیز).

---

## ⚠️ سه تصحیحِ فرضِ ورودی

قبل از هر چیز، سه فرضِ صورت‌مسئله با کد نمی‌خواند:

| فرض | واقعیت |
|---|---|
| «`docs/research/` و `docs/prompts/` را commit کن» | **هیچ‌کدام وجود ندارند** و محتوایشان هم نوشته نشده. این فاز ۰ است و کدی/سندی تولید نکردم. آن دو سند هنوز باید نوشته شوند. |
| «holdout تقریباً قطعاً نیست» | **هست** — `lib/no-show-model.ts:557-569` splitِ **زمانی** ۸۰/۲۰ با holdout، `MIN_AUC = 0.60` (:254)، Brier و calibration (:7-8). بحثِ نشتِ زمانی هم صریح در کامنتِ :557-558 آمده. |
| «هیچ هوشمندی با `reason` نداریم» | `lib/incentive-engine.ts` از قبل فیلدِ `reason` دارد (:40, :79, :90, :100) — قاعده‌ی ۱ شما در یک ماژول از قبل رعایت شده. |

**و دامنه بزرگ‌تر از فهرستِ شماست.** هشت ماژولِ باشگاهی در بریف نبودند:
`economy.ts` (۳۷۳ خط) · `loyalty-status.ts` (۱۸۰، شاملِ **streak** و نشان‌ها) ·
`missions.ts` (۱۴۳) · `rewards.ts` (۱۳۷) · `crm-recommendations.ts` (۱۱۹) ·
`incentive-engine.ts` · `club-enroll.ts` (۸۷) · `customer-intelligence.ts` (۶۹) ·
`economy-rules.ts` (۴۷). و هفت مدلِ دیگر: `Mission`، `MissionProgress`،
`RewardMarketplaceItem`، `RewardRedemption`، `BadgeDefinition`، `UserBadge`،
`CustomerEconomyProfile`.

---

## ۰.۱ موجودی کد

| ماژول | خط | routeهای صداکننده | فایل‌های تست | آخرین تغییر |
|---|---|---|---|---|
| `lib/loyalty.ts` | ۴۴۹ | `gift-cards`, `maintenance/rewards`, `me/points`, `me/referral`, `restaurant/sms` | ۸ | `0ba54b6` ۲۰۲۶-۰۸-۲۵ |
| `lib/fraud.ts` | ۴۲۱ | `admin/abuse-flags/[userId]`, `admin/security`, `maintenance/customer-insights`, `restaurant/customers/[userId]`, `restaurant/fraud-signals` | ۱ | `969e4a6` ۲۰۲۶-۰۸-۲۴ |
| `lib/customer-insights.ts` | ۳۶۴ | `maintenance/customer-insights` | ۴ | `675bf0a` ۲۰۲۶-۰۸-۲۵ |
| `lib/automation.ts` | ۲۲۶ | `maintenance/customer-insights` | ۳ | `3422936` ۲۰۲۶-۰۸-۲۸ |
| `lib/coupons.ts` | ۱۲۵ | `restaurant/coupons` | **۱** | `6413742` ۲۰۲۶-۰۸-۲۰ |
| `lib/rfm.ts` | ۱۱۳ | `maintenance/customer-insights`, `restaurant/rfm` | ۲ | `9633614` ۲۰۲۶-۰۸-۲۰ |
| `lib/guest-profile.ts` | ۱۰۴ | `maintenance/customer-insights`, `me/profile` | ۲ | `9633614` ۲۰۲۶-۰۸-۲۰ |

**cron** (`cron/crontab`): `rewards` ساعت ۹ (:28) · `customer-insights` ساعت ۳ (:30).

**مدل‌ها** — فیلدهای واقعی:

- `ClubMember`: `restaurantId, userId, code, tier, points, joinedAt`
- `PointsLedger`: `userId, restaurantId(nullable), delta, reason, note, createdAt` — **فقط `@@index([userId, createdAt])`، هیچ `@@unique`**
- `GiftCard`: `code, buyerId, restaurantId, amountToman, balanceToman, status, expiresAt`
- `Referral`: `referrerId, inviteePhone, inviteeId, status, rewardPoints, completedAt`
- `Coupon`: `code, kind, value, minPartySize, maxRedemptions, redemptionCount, perUserLimit, targetSegment, validFrom, validUntil, isActive`
- `CouponRedemption`: `couponId, userId, reservationCode, discountToman, **ip**, redeemedAt`
- `MarketingAutomation`: `trigger, triggerConfig, messageTemplate, couponId, isActive, lastRunAt, sentCount, convertedCount`
- `CustomerInsight`: ۲۲ فیلد (`churnRiskScore, rfmSegment, predictedClvToman, intelligenceScore/Tier, …`)
- `GuestProfile`: `globalVisits, globalSpendToman, globalClvToman, restaurantsVisited, isVipAnywhere`
- **کش‌بک روی Restaurant**: `cbBasePct, cbPreorderPct, cbVipPct, cbWinbackPct` — per-restaurant واقعی (`restaurant/cashback/route.ts:26-27`)

---

## ۰.۲ جدول شکاف

| مکانیک | حکم | شاهد |
|---|---|---|
| پاداش خوش‌آمد | **ناقص** — `POINTS.signup = 200` هست ولی «اولین پاداش در بازدید ۲–۳» نیست | `loyalty.ts:12` |
| پیشنهاد بازدید دوم ظرف ۷ روز | **نیست** | grep صفر |
| تیرها: آستانه | **هست** ولی hardcode: `0/300/800/2000` | `loyalty.ts:42-45` |
| تیرها: **مزایای واقعی** | **نیست** — متنِ ثابت در اپ مشتری، هیچ اجرایی | `apps/customer/js/data/seed.js` → `PERKS` |
| تیرها: تنزل | **نیست** — `tierFromPoints(balance)` فقط از موجودی، بدون زمان | `loyalty.ts:48` |
| کش‌بک per-restaurant | **هست** — چهار درصدِ واقعی روی Restaurant | `restaurant/cashback/route.ts:26-41` |
| کوپن با segment | **هست** و enforce می‌شود | `coupons.ts:21-23` |
| کارت مهر (visit-based) | **نیست** | grep صفر |
| مأموریت‌ها | **هست** — `Mission`, `MissionProgress`, `me/missions`, `me/missions/[id]/claim` | `lib/missions.ts` |
| غافلگیری داده‌محور | **نیست** | grep صفر |
| streak | **ناقص** — فقط نشانِ `streak5` (۵ هفته پیاپی)، نه مکانیکِ زنده | `loyalty-status.ts:56,80,167` |
| **انقضای امتیاز** | **نیست** — نه سخت، نه نرم، نه هشدار | grep `expire.*point` صفر |
| تولد/سالگرد | **هست** — `grantBirthdayRewards()` از cron | `loyalty.ts:376,413,440` |
| دعوت دوست | **هست** | `loyalty.ts:176-226` |
| ضد self-referral | 🔴 **نیست** — هیچ چکی که `inviteePhone` ≠ شماره‌ی خودِ `referrerId` باشد | `loyalty.ts:176-182` |
| کارت هدیه | **هست** با قفلِ `FOR UPDATE` و partial redemption | `loyalty.ts:324-346` |
| کیف/اعتبار/سطح در اپ customer | **هست** — `/me/loyalty` واقعی | `apps/customer/js/features/loyalty.js:48,57` |
| کارت سطح قابل اشتراک | **نیست** | grep صفر |
| پاداش تجربه‌ای (اولویت waitlist) | **نیست** | grep `waitlist_priority|early_access` صفر |
| تنظیمات مالک: قاعده‌ی کسب | **نیست** — همه hardcode | `loyalty.ts:11-20` |
| تنظیمات مالک: **سقف بودجه** | 🔴 **نیست** | grep `budget` صفر |
| گزارش عضو در برابر غیرعضو | **نیست** | — |
| liability + breakage | **ناقص** — کوئری بدهی ممکن است، ولی هیچ گزارش/UI نیست | پایین |
| ارز پلتفرمی (سکه) | **هست** — `CustomerEconomyProfile.walletBalance/xpTotal` | schema:1907 |
| event log رویدادهای باشگاه | 🔴 **نیست** — `events.ts` هشت رویداد دارد ولی **هیچ‌کدام باشگاهی نیست** | `events.ts:20-34`؛ grep `emit(` در loyalty/missions/rewards/economy → **صفر** |
| holdout برای اقدامِ باشگاه | 🔴 **نیست** (ولی برای no-show **هست**) | `automation.ts`/`loyalty.ts` grep صفر · `no-show-model.ts:569` |

---

## ۰.۳ یکپارچگی ledger — حکم: **دوگانه، امروز سازگار**

**موجودی در دو جا نگه داشته می‌شود:**
- مشتق از ledger: `getClubPointsBalance()` → `aggregate(_sum: delta)` (`loyalty.ts:152-157`)
- ستونِ جدا: `club_members.points` با `increment` (`loyalty.ts:143`)

هر دو **داخل یک `$transaction`** نوشته می‌شوند (`loyalty.ts:110-148`).

**اندازه‌گیریِ زنده (هر دو DB):**
```
rezv-test-pg      members=5  ledger_rows=20  mismatched=0
rezervno-postgres members=0  ledger_rows=0   mismatched=0
```

**هیچ مسیری خارج از `loyalty.ts` ستونِ points را دست نمی‌زند** —
`grep "points: { increment|decrement|set }"` در کلِ `app/` و `lib/` فقط `loyalty.ts:143`.

**کوئریِ بدهیِ اعتبارِ باز per restaurant** — کار می‌کند:
```sql
SELECT restaurant_id, SUM(delta) AS open_points
FROM points_ledger WHERE restaurant_id IS NOT NULL
GROUP BY restaurant_id ORDER BY 2 DESC;
```
خروجیِ واقعی: `e123d0d4…|300`، `adff273b…|150`، `752de807…|10`.
⚠️ `restaurant_id` **nullable** است (`is_nullable=YES`) — امتیازِ پلتفرمی (`addPoints` بدونِ رستوران) در همین جدول با `NULL` می‌نشیند، پس تفکیکِ «اعتبارِ رستوران» از «سکه‌ی پلتفرم» فقط با همین شرط ممکن است.

**idempotency اعطا:** از قید یکتاییِ DB نمی‌آید (ledger هیچ `@@unique` ندارد)؛ از
`result.changed`ِ یک compare-and-setِ اتمیک در `lifecycle.ts:174` می‌آید. کامنتِ خودِ
کد (`:165-172`) ادعا می‌کند چک‌این تکراری، `arrive`+`status` هم‌زمان، و دو درخواستِ
موازی مجموعاً یک‌بار امتیاز می‌دهند. **این ادعا با تستِ موقت اثبات نشد** — به‌جایش
جهشِ L4 نشان داد لایه‌ی ستون/ledger پوشش دارد. اثباتِ idempotency کارِ فاز ۱ است.

**اتمیک بودن اعطا + تیر:** بله، یک تراکنش (`loyalty.ts:110`). **کش‌بک جداست** —
درصدها روی Restaurant، مسیرِ محاسبه‌اش در `economy.ts`، هیچ ارتباطِ تراکنشی با
`addClubPoints` ندارد.

**کارت هدیه و ledger:** partial redemption در `redeemGiftCardTx` (`loyalty.ts:324-346`)
با `SELECT … FOR UPDATE` (:329) و `balanceToman` به‌روزرسانی می‌شود — **هیچ ردیفی در
`points_ledger` نمی‌نویسد.** کارت هدیه ارزِ جداست، نه امتیاز. پشتوانه‌ی دوم:
`CHECK (balance_toman >= 0)` (constraint `gift_cards_balance_nonneg`).

---

## ۰.۴ هوشمندی — از داده تا اقدام

| سیگنال | مصرف | اقدامِ خودکار؟ |
|---|---|---|
| `churnRiskScore` | ۱۳ محل: `crm-recommendations`, `customer-intelligence`, **`incentive-engine`**, `notifications`, `me/incentives`, `restaurant/ai`, … | **بله** — `incentive-engine.ts:95` آستانه‌ی ۶۰ |
| `rfmSegment` | فقط `guest-profile` | نمایشی |
| `predictedClvToman` | ۵ محل، همه نمایش/رتبه‌بندی | نمایشی |
| `segment` | `automation.ts` هدف‌گیریِ `at_risk`/`vip` | **بله** |
| `noShowRiskTier` | `assistant-answers`, `reservations`, `restaurant/ai` | **بله** (مدلِ واقعی) |
| `intelligenceTier` | `crm-recommendations`, `restaurant/customers` | نمایشی |

**`AutomationTrigger`**: `birthday · winback · post_visit · vip_milestone · no_show_followup`.
«churn بالا» غیرمستقیم از `winback → targetsForSegment('at_risk')` (`automation.ts:139`).
**«نزدیک تیر بعدی» و «X روز بدون بازدید» وجود ندارند.**

**اجرای automation:** از cron (`maintenance/customer-insights`). پنجره از `lastRunAt`
مشتق می‌شود نه ثابت (`automation.ts:75-77`) — کامنت می‌گوید این رفعِ یک باگِ واقعی بود.
**سقفِ بودجه: ندارد.** **frequency cap: ندارد** — `outreach-ledger.ts` فقط
attribution دارد (`ATTRIBUTION_WINDOW_DAYS = 14`, `MIN_RESOLVED_FOR_RATE = 20`)، نه
سرکوبِ ارسال.

**زمانِ ارسال بر اساس رفتار: نیست.**

**`events.ts`**: هشت رویداد — `reservation.created/cancelled/completed/no_show`,
`waitlist.joined/seated`, `customer.vip_reached`, `coupon.redeemed`. در DB **ثبت
می‌شوند** (`emit()` :35 → webhook). ولی **هیچ رویدادِ باشگاهی emit نمی‌شود**:
grep `emit(` در `loyalty.ts`, `missions.ts`, `rewards.ts`, `economy.ts` → **صفر**.

**جدولِ append-only رفتار مشتری:** `PlatformEvent` (schema:1600) وجود دارد ولی
رویدادهای باشگاه واردش نمی‌شوند.

**نشتِ زمانی در RFM/CLV — حکم: نشتِ مقطعی، نه نشتِ آموزشی.**
`rfm.ts` با `ntile(5) OVER (ORDER BY …)` روی **کلِ کوهورتِ فعلی** امتیاز می‌دهد
(:40-51) و نتیجه را روی همان ردیف می‌نویسد (:86). یعنی هر بازمحاسبه، برچسبِ
**امروز** را جایگزین می‌کند و **تاریخچه‌ای نگه نمی‌دارد**. برای توصیفِ امروز درست
است؛ برای آموزشِ مدل روی «برچسبِ آن روز» غیرقابل‌استفاده است، چون snapshot وجود ندارد.
`predictedClv = visitsPerYear × avgSpend` (`customer-insights.ts:219`) — یک ضربِ ساده،
نه مدل. `churnRisk = (daysSince / (expectedGap × 2)) × 100` (:235) — قاعده‌ی نسبت.

**no-show prediction — تنها بخشِ واقعاً ارزیابی‌شده:** `no-show-model.ts` با
`trainLogisticRegression`, `predictProba`, `brierScore`, `rocAuc`, `calibrationCurve`
(:7-8)؛ splitِ **زمانی** ۸۰/۲۰ (:557-569، با کامنتِ صریح که split تصادفی برای دادهٔ
زمانی نشت می‌سازد)؛ گاردِ فعال‌سازی `MIN_AUC = 0.60` (:254) از طریقِ
`decideModelActivation` (:270).

### فهرستِ «هوشمندیِ» نمایشی/hardcode

| مورد | منبع | حکم |
|---|---|---|
| `PERKS` — «تا ۱۵٪ برگشت پول»، «اولویت در ساعات شلوغ» | `apps/customer/js/data/seed.js` | 🔴 **متنِ ثابت، هیچ اجرایی** — اپ مشتری از `seed.js` import می‌کند (`loyalty.js:9,16,87`) |
| `POINTS = {signup:200, perReservation:100, referralReward:500, birthday:1000, anniversary:1000}` | `loyalty.ts:11-16` | hardcode |
| `ARRIVAL_POINTS = 50` | `loyalty.ts:20` | hardcode |
| آستانه‌ی تیرها `0/300/800/2000` | `loyalty.ts:42-45` | hardcode |
| `churnRisk` آستانه‌های `75`/`40` | `customer-insights.ts:240-241` | hardcode |
| `intelligence_tier` آستانه‌های `70`/`40` | `rfm.ts:92-93` | hardcode |
| `incentive-engine` آستانه‌ی `churnRiskScore >= 60` | `incentive-engine.ts:95` | hardcode — **ولی `reason` دارد** |
| `predictedClvToman` | `visitsPerYear × avgSpend` | فرمولِ ساده، نه مدل — **منبع دارد** |

---

## ۰.۵ ضد تقلب

| کنترل | حکم | شاهد |
|---|---|---|
| velocity limitِ **کسب** per user/day | **نیست** | grep صفر در `loyalty.ts`/`economy.ts` |
| velocity limitِ **بازخرید** | **هست** (تشخیص، نه جلوگیری) | `fraud.ts:90` `detectRedemptionVelocity(maxPerDay=5)` |
| **self-referral** | 🔴 **نیست** | `loyalty.ts:176-182` — فقط تکراری‌بودنِ همان جفت چک می‌شود، نه اینکه `inviteePhone` شماره‌ی خودِ referrer باشد |
| اعطای دستیِ staff | **نیست** — هیچ routeِ `restaurant/*` امتیاز اعطا نمی‌کند | grep `addClubPoints` در `app/api/v1/restaurant` → فقط یک کامنت |
| `ip` در `coupon_redemptions` | **هست** | `coupons.ts:93,112` (کامنتِ :59 می‌گوید باگِ M1 بود) |
| بازخرید بیش از موجودیِ کارت | **هست، دو لایه** | `loyalty.ts:340` + `CHECK (balance_toman >= 0)` |
| کوپن بیش از سقفِ کل | **هست، دو لایه** | `coupons.ts:16` (validate) + `UPDATE … WHERE redemption_count < max_redemptions` اتمیک (:106-111) |
| کوپن بیش از سقفِ per-user | **هست** | `coupons.ts:99-101` داخلِ تراکنش |
| انتقالِ کارتِ هدیه | **نیست** (مکانیکش وجود ندارد) | — |

---

## ۰.۶ پیامک و باشگاه

| اقدام | template | از موجودیِ که؟ |
|---|---|---|
| automation (birthday/winback/post_visit/vip/no_show) | متغیر | **رستوران** — `enqueueSms({…, restaurantId})` (`automation.ts:176`) |
| دعوتِ دوست | `campaign` | `loyalty.ts:197-198` — **بدونِ `restaurantId`** ⇒ رایگان |
| تولد/سالگرد | `campaign` | `loyalty.ts:424` — **بدونِ `restaurantId`** ⇒ رایگان |
| OTP مشتری | `otp` | **هیچ‌کس** (یافته‌ی فازِ ۰ قبلی) |

**frequency cap: ندارد** — `outreach-ledger` فقط ثبت و attribution می‌کند.
**تفکیکِ خطِ خدماتی/تبلیغاتی: ندارد** — همه از همان `bodyId`های الگو می‌روند؛
تنها تمایز `MELIPAYAMAK_FROM` برای متنِ آزاد است.

⚠️ **ناسازگاری**: پاداش‌های پلتفرمی (تولد، دعوت) پیامکشان از موجودیِ **هیچ‌کس** کم
نمی‌شود، در حالی که automationِ رستوران از موجودیِ رستوران کم می‌شود. قاعده‌ی ۵ شما
(«پاداشِ پلتفرمی را پلتفرم می‌پردازد») امروز به‌معنای «کسی نمی‌پردازد» اجرا شده.

---

## ۰.۷ اپ customer

| فایل | خط | داده |
|---|---|---|
| `features/loyalty.js` | ۹۷ | `/me/loyalty` **واقعی** → `points, tier, next_tier, points_to_next, progress_pct, badges` (:48,57) |
| | | 🔴 ولی `PERKS` از `data/seed.js` import می‌شود (:9) و در دو جا رندر (:16, :87) |
| `features/rewards.js` | ۲۱۳ | `/me/referral` واقعی + `API.updateProfile` |
| `features/economy.js` | — | مسیرِ سکه/کیف |

**نتیجه:** موجودی و سطح واقعی‌اند؛ **مزایای هر سطح ساختگی‌اند** — «تا ۱۵٪ برگشت پول»
و «اولویت در ساعات شلوغ» هیچ پیاده‌سازیِ سروری ندارند.

---

## ۰.۸ نمونه‌گیری جهش — ۱۰ جهش، **۷ گرفته، ۳ زنده**

```
  loyalty    8 فایلِ تست        [baseline] exit=0
  coupons    1 فایلِ تست        [baseline] exit=0

L1  CAUGHT    ✖12   ارتقایِ تیر با مقدارِ پایین‌تر (min 300→30)
L2  CAUGHT    ✖18   امتیازِ حضور ده برابر (50→500)
L3  SURVIVED  ✖0    بازخریدِ کارتِ هدیه بیش از موجودی
L4  CAUGHT    ✖7    ستونِ points به‌روز نمی‌شود
L5  SURVIVED  ✖0    دعوتِ تکراری برایِ همان شماره
C1  SURVIVED  ✖0    سقفِ کوپن off-by-one (>= → >)
C2  CAUGHT    ✖4    انقضا برعکس
C3  CAUGHT    ✖4    کدِ آینده از حالا معتبر
C4  CAUGHT    ✖4    گاردِ segment برداشته شد
C5  CAUGHT    ✖4    سقفِ per-user در تراکنش off-by-one
```

### احکامِ سه زنده‌مانده (طبق قاعده: اول دنبالِ دلیل)

**C1 — افزونگی، نه سوراخ.** چکِ `validateCoupon` (`coupons.ts:16`) یک پیش‌بررسی است؛
لایه‌ی واقعی `UPDATE coupons SET redemption_count = redemption_count + 1 WHERE …
AND (max_redemptions IS NULL OR redemption_count < max_redemptions) RETURNING id`
(:106-111) که اتمیک است و `claimed.length === 0 → return false`. همان الگویِ R4/V1.

**L3 — افزونگی + پشتوانه‌ی DB.** خطِ ۳۴۰ پیش‌بررسی است؛ ردیف با `FOR UPDATE` قفل شده
(:329) و `CHECK (balance_toman >= 0)` در DB وجود دارد. جهش باعثِ موجودیِ منفی نمی‌شود،
فقط خطای Postgres به‌جای پیامِ فارسی می‌دهد.

**L5 — 🔴 سوراخِ واقعی.** `createReferral` فقط جفتِ `(referrerId, inviteePhone)` را در
وضعیتِ `pending|completed` چک می‌کند (`loyalty.ts:178`). حذفِ `'pending'` هیچ تستی را
قرمز نکرد ⇒ **هیچ تستی دعوتِ تکراری را پوشش نمی‌دهد.** و مستقل از آن، **هیچ گاردِ
self-referral وجود ندارد**.

---

## سه یافته‌ی پرریسک، به ترتیب

**۱. هیچ گاردِ self-referral + هیچ سقفِ بودجه + هیچ velocity limitِ کسب.**
`POINTS.referralReward = 500` بزرگ‌ترین جایزه‌ی سیستم است. کاربر می‌تواند شماره‌ی خودش
را دعوت کند؛ هیچ چکی نیست (`loyalty.ts:176-182`). با نبودِ سقفِ بودجه، ضربدرِ نامحدود.

**۲. مزایای سطح ساختگی‌اند.** `PERKS` در `seed.js` به کاربر «تا ۱۵٪ برگشت پول» و
«اولویت در ساعات شلوغ» وعده می‌دهد که **هیچ کدِ سروری‌ای اجرا نمی‌کند**. این دقیقاً
همان «موفقیتِ جعلی»ای است که `CLAUDE.md` ممنوع کرده، ولی به کاربر نمایش داده می‌شود.

**۳. هیچ رویدادِ باشگاهی ثبت نمی‌شود.** `emit()` در هیچ‌یک از `loyalty/missions/
rewards/economy` صدا زده نمی‌شود. بدونِ event log، نه holdout ممکن است، نه attribution،
نه آموزشِ مدل — یعنی قواعدِ ۲ و ۳ شما امروز **غیرقابلِ اجرا** هستند.

---

## برآوردِ اندازه‌ی فازهای ۱–۸ (بر اساس واقعیتِ کد)

| فاز | کار | اندازه | چرا |
|---|---|---|---|
| ۱ | یکپارچگی ledger: قیدِ یکتایی، اثباتِ idempotency، تفکیکِ اعتبار/سکه | **کوچک** | ledger سالم است؛ فقط قید و تست |
| ۲ | ضدتقلب: self-referral، velocity، سقفِ بودجه | **متوسط** | سه گاردِ مستقل، الگو از `fraud.ts` موجود |
| ۳ | event log باشگاه (append-only) | **متوسط** | `events.ts` و `PlatformEvent` هستند؛ فقط emit و schema |
| ۴ | مزایای واقعیِ سطح (جایگزینیِ PERKS) | **بزرگ** | نیازمندِ اجرا در کش‌بک، اولویتِ waitlist، دسترسی زودهنگام — سه سیستمِ متفاوت |
| ۵ | تنظیماتِ مالک (قاعده‌ی کسب، انقضا، بودجه) | **بزرگ** | همه‌ی ثابت‌ها باید به DB بروند + UI پنل business |
| ۶ | مکانیک‌های تازه (کارتِ مهر، بازدید دوم، غافلگیری، streakِ زنده) | **بزرگ** | چهار مکانیکِ صفر |
| ۷ | holdout + attribution برای اقدامِ باشگاه | **متوسط** | `outreach-ledger` و `no-show-model` الگو دارند |
| ۸ | مدلِ self-host روی رویداد | **بزرگ** | وابسته به فاز ۳؛ `ml-core.ts` زیرساخت دارد |

---

## وضعیت

- **هیچ کدی نوشته نشد.** جهش‌ها تزریق و بازگردانده شدند؛ `git status` تمیز است
  (یک بازگردانیِ دستیِ `coupons.ts` لازم شد و انجام شد).
- `docs/research/RESEARCH-customer-club-fa.md` و
  `docs/prompts/PROMPT-customer-club-ml-fa.md` **هنوز نوشته نشده‌اند** — منتظرِ دستور.
- سه سؤالِ باز که تصمیمشان با شماست: تکلیفِ `PERKS`ِ ساختگی · اینکه «پلتفرم می‌پردازد»
  یعنی دفترِ پلتفرمی بسازیم یا رایگان بماند · و اینکه دامنه شاملِ آن هشت ماژولِ
  کشف‌شده هم هست یا نه.
