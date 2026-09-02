# تحقیق — باشگاهِ مشتریانِ رستوران

> ۲۰۲۶-۰۹-۰۲ · مکمّلِ `docs/audit/CLUB-PHASE0.md` (کاوشِ کد)
> این سند **بیرون** را می‌گوید: رقبا، الگوهای جاافتاده، و اشتباهاتِ شناخته‌شده.
> هر ادعای بیرونی منبع دارد؛ هر ادعای داخلی فایل:خط.

---

## ۱. رقبای ایرانی — آنچه واقعاً قابلِ تأیید بود

جست‌وجویِ وب برایِ «باشگاه مشتریان رستوران ایران» عملاً **یک** محصولِ مستقیم
برگرداند، نه یک بازارِ شلوغ:

**SmartX** ([smartx.ir/services/club](https://smartx.ir/services/club/)) — باشگاهِ
مشتریانِ رستوران و کافه. آنچه از توضیحاتِ خودش قابلِ استخراج است:

| قابلیت | ادعای SmartX |
|---|---|
| اتصال | به **صندوقِ فروش (POS)** وصل می‌شود و تراکنش و امتیاز را خودکار ثبت می‌کند |
| سنجه‌ی وفاداری | **تعدادِ دفعاتِ خرید** به‌عنوانِ معیارِ اصلی |
| تشخیصِ VIP | از **مبلغِ خرید** برایِ شناساییِ مشتریِ پردرآمد |
| پاداش | تخفیف یا اعتبارِ نقدی |

> ⚠️ **صداقتِ روش:** این تنها نتیجه‌ی مستقیمِ فارسی بود. بقیه‌ی نتایج
> (Wikipedia درباره‌ی NPS، Antavo، باشگاهِ هتل‌ها) ربطِ مستقیم نداشتند. پس
> **ادعا نمی‌کنم که تصویرِ کاملِ بازارِ ایران را دارم.** آنچه می‌شود گفت:
> در دسترس‌ترین رقیبِ مستقیم، مدلی POS-محور با دو سنجه (تعدادِ خرید، مبلغِ خرید)
> ارائه می‌کند.

### جایگاهِ ما در برابرِ این مدل

| بُعد | SmartX (POS-محور) | Rezervno (رزرو-محور) |
|---|---|---|
| منبعِ داده | تراکنشِ صندوق | **چرخه‌ی کاملِ رزرو** — از جست‌وجو تا حضور/عدمِ‌حضور |
| سیگنالِ یکتا | مبلغ و تعداد | **no-show، لغو، waitlist، پیش‌سفارش، الگویِ ساعت** |
| مدلِ موجود | — | `no-show-model.ts` با splitِ زمانی، AUC، calibration |
| نقطه‌ی ضعفِ ما | — | امتیاز فقط در **چک‌این** داده می‌شود (`lifecycle.ts:174`)، یعنی بدونِ POS مبلغ را نمی‌دانیم مگر از `preorder` |

**نتیجه‌ی راهبردی (فقط مشاهده، نه تصمیم):** برتریِ داده‌ایِ ما در *رفتارِ رزرو*
است نه *مبلغِ خرید*. مکانیک‌هایی که روی رفتارِ رزرو سوارند (حضورِ به‌موقع،
نجاتِ no-show، پرکردنِ ساعتِ خلوت) چیزی‌اند که رقیبِ POS-محور اصلاً داده‌اش را
ندارد.

---

## ۲. الگوهای جاافتاده‌ی بین‌المللی — و آنچه ما داریم/نداریم

منابع: [BonusQR 2026](https://bonusqr.com/article/restaurant-loyalty-programs-the-complete-guide-for-2026) ·
[Talon.One](https://www.talon.one/blog/restaurant-loyalty-card) ·
[LoyaltyPass](https://www.loyaltypass.co/blog/industries/restaurant-loyalty-program) ·
[Loop](https://loop.fans/blog/restaurant-loyalty-programs-complete-guide)

### ۲.۱ کارتِ مهر (stamp card)

الگویِ کلاسیک: ده بار بیا، یازدهمی مهمانِ ما. بهترین برازش برایِ رستورانی که
تراکنشش یکنواخت و تکرارش بالاست، و مکانیکش باید **در ده ثانیه سرِ صندوق قابلِ
توضیح** باشد.

**عددِ توصیه‌شده: ۶ تا ۱۰ خرید** برایِ پاداشِ معنادار، به‌علاوه‌ی یک **پاداشِ
میانی در نیمه‌ی راه** برایِ حفظِ حرکت.

> **ما:** ❌ ندارد (`grep stamp` → صفر). امتیازِ ما مبلغ‌محور نیست، بازدید‌محور
> است (`ARRIVAL_POINTS = 50` ثابت) — یعنی عملاً یک کارتِ مهرِ پنهان داریم که
> به کاربر به‌شکلِ کارتِ مهر نشان داده نمی‌شود.

### ۲.۲ سطح‌بندی (tiers)

- **Starbucks** از مارس ۲۰۲۶ سه سطح دارد؛ سطحِ بالاتر = روزهای امتیازِ مضاعفِ
  بیشتر و **مهلتِ انقضایِ طولانی‌تر**.
- **Chick-fil-A One** چهار سطح؛ رسیدن به بالاترین ≈ ۱۰۰۰ دلار خرجِ کل.

نکته‌ی مهم: در هر دو، **مزیتِ سطح چیزی است که سیستم واقعاً اجرا می‌کند** —
نه متنِ تبلیغاتی.

> **ما:** آستانه‌ها هست (`0/300/800/2000`، `loyalty.ts:42-45`) ولی
> 🔴 **مزایا اجرا نمی‌شوند** — `PERKS` در `apps/customer/js/data/seed.js` به
> کاربر «تا ۱۵٪ برگشتِ پول» و «اولویت در ساعاتِ شلوغ» وعده می‌دهد و
> `loyalty.js:9,16,87` رندرش می‌کند، در حالی که هیچ کدِ سروری‌ای آن را اعمال
> نمی‌کند. این دقیقاً «موفقیتِ جعلی»ِ ممنوع در `CLAUDE.md` است.

### ۲.۳ انقضای امتیاز

- روندِ غالب: پنجره‌ی **۱۲ ماهه‌ی غلتان**.
- ولی **۳۶٪ اعضا** انقضا را «آزاردهنده‌ترین» ویژگی می‌دانند.
- برداشتنِ انقضا «تغییری ساختاری است که برای رستوران هزینه‌ای ندارد و
  پرتکرارترین دلیلِ بی‌تفاوتی را حذف می‌کند».

> ⚠️ این ادعایِ آخر با بندِ ۳.۲ (breakage) در **تنش** است: بدونِ انقضا،
> بدهیِ باشگاه هرگز آزاد نمی‌شود. هر دو منبع درست‌اند و در دو حسابِ متفاوت
> (تجربه در برابرِ ترازنامه) حرف می‌زنند. تصمیمش با مالک است.
>
> **ما:** ❌ هیچ انقضایی — نه سخت، نه نرم، نه هشدار (`grep expire.*point` صفر).

### ۲.۴ کانالِ ارسال

اعلانِ مبتنی بر **wallet** نرخِ بازکردنِ ۹۰٪ دارد و بهترین کانال برایِ
پیشنهادِ زمان‌دار، پرکردنِ روزِ خلوت، و بازگرداندنِ مشتری است.

> **ما:** فقط پیامک. و پیامک‌های باشگاه **frequency cap ندارند**
> (`outreach-ledger.ts` فقط attribution دارد، نه سرکوبِ ارسال).

### ۲.۵ مدلِ ترکیبی

قوی‌ترین مدلِ ۲۰۲۶ ترکیبی است: امتیاز + پیشنهاد + دعوت + اتوماسیونِ CRM، چون
اپراتور می‌تواند برایِ هر segment مکانیکِ متفاوت اجرا کند.

> **ما:** همه‌ی اجزا **جدا جدا وجود دارند** (امتیاز، کوپنِ segment‌دار،
> دعوت، `automation.ts`) ولی هیچ لایه‌ای آن‌ها را به‌ازای segment هماهنگ
> نمی‌کند.

---

## ۳. اشتباهاتِ شناخته‌شده — و وضعیتِ ما

منابع: [Bubblehouse](https://www.bubblehouse.com/blog/loyalty-liability-accounting-reward-expiration-fraud-2026) ·
[Yotpo](https://www.yotpo.com/blog/how-to-prevent-reward-program-fraud/) ·
[Loyalty Juggernaut](https://lji.io/guides/loyalty-fraud-prevention) ·
[Brandmovers](https://blog.brandmovers.com/what-cfos-need-to-know-about-loyalty-program-liability-in-2026) ·
[KYROS](https://www.kyros.com/blog/loyalty-program-liability-guide/)

### ۳.۱ تقلب

کنترل‌هایِ استانداردِ صنعت: **اعتبارسنجیِ IP · تشخیصِ سوءاستفاده‌ی دعوت ·
تأخیر در تحویلِ پاداش · velocity limit روی کسب و بازخرید · کنترلِ دسترسیِ
نقش‌محور**.

ساده‌ترین شکلِ تقلبِ دعوت: **self-referral** — فرد خودش را با ایمیل/دستگاهِ
جعلی دعوت می‌کند و پاداشِ هر دو طرف را برمی‌دارد («حلقه‌ی self-referral»).

| کنترل | ما |
|---|---|
| IP در بازخریدِ کوپن | ✅ `coupons.ts:93,112` |
| velocity **بازخرید** | ⚠️ فقط **تشخیص** نه جلوگیری — `fraud.ts:90` `detectRedemptionVelocity(maxPerDay=5)` |
| velocity **کسب** | ❌ صفر |
| **self-referral** | 🔴 **صفر** — `loyalty.ts:178` فقط تکراری‌بودنِ همان جفت را چک می‌کند، نه اینکه `inviteePhone` شماره‌ی خودِ دعوت‌کننده باشد. و جایزه‌اش ۵۰۰ امتیاز است (`loyalty.ts:14`) — بزرگ‌ترین جایزه‌ی سیستم |
| تأخیر در تحویل | ❌ فوری |
| نقش‌محور | ✅ RBAC موجود |

### ۳.۲ بدهی و breakage

- «هر امتیازِ صادرشده یک **بدهی** در ترازنامه است.» و وقتی متقلب بازخریدش
  کند، هزینه بدونِ درآمدِ متناظر به P&L می‌خورد.
- **breakage** = درصدِ امتیازی که هرگز خرج نمی‌شود. تحت **ASC 606 / IFRS 15**
  باید **متناسب** با دوره‌ی بازخرید شناسایی شود.
- «نرخِ breakage مهم‌ترین برآوردِ حسابداریِ باشگاه است، چون مستقیماً اندازه‌ی
  بدهی را تعیین می‌کند.»

> **ما:** کوئریِ بدهی **کار می‌کند** (اندازه‌گیریِ زنده در `CLUB-PHASE0.md`):
> ```sql
> SELECT restaurant_id, SUM(delta) AS open_points
> FROM points_ledger WHERE restaurant_id IS NOT NULL GROUP BY restaurant_id;
> ```
> ولی: هیچ گزارشی، هیچ UI، و — چون **انقضا نداریم** — نرخِ breakage اصلاً
> قابلِ محاسبه نیست. یعنی بدهی برایِ همیشه رشد می‌کند.

---

## ۴. آنچه رقیب ندارد و ما داریم (فرصت، نه تصمیم)

بر اساسِ کدِ موجود، نه آرزو:

| دارایی | شاهد | چرا رقیبِ POS-محور ندارد |
|---|---|---|
| مدلِ no-show با ارزیابیِ واقعی | `no-show-model.ts:557-569` splitِ زمانی، `MIN_AUC=0.60` (:254)، Brier و calibration (:7-8) | POS نمی‌داند چه کسی رزرو کرد و نیامد |
| کش‌بکِ per-restaurantِ چهاربُعدی | `cbBasePct/cbPreorderPct/cbVipPct/cbWinbackPct` (`restaurant/cashback/route.ts:26-41`) | — |
| کوپنِ segment‌محورِ enforce‌شده | `coupons.ts:21-23` | نیازمندِ segmentِ محاسبه‌شده |
| زیرساختِ مأموریت و سکه | `Mission`, `MissionProgress`, `CustomerEconomyProfile` | — |
| `incentive-engine` با فیلدِ `reason` | `incentive-engine.ts:40,79,90,100` | — |
| ledgerِ سالم | اندازه‌گیریِ زنده: `mismatched=0` | — |

---

## ۵. سه شکافی که تحقیق تأیید کرد

بر اساسِ تقاطعِ «الگویِ جاافتاده» با «واقعیتِ کد»:

**۱. مزایای سطح باید اجرا شوند، نه نمایش داده شوند.** هم Starbucks هم
Chick-fil-A مزیتِ اجراشده دارند. ما متنِ `seed.js` داریم. این تنها موردی است
که کاربر **همین حالا** وعده‌ی بی‌پشتوانه می‌بیند.

**۲. self-referral استانداردترین تقلبِ باشگاه است و ما صفر گارد داریم** —
کنارِ بزرگ‌ترین جایزه‌ی سیستم و بدونِ سقفِ بودجه.

**۳. بدونِ انقضا، هیچ مدلِ حسابداریِ باشگاه ممکن نیست** — نه breakage، نه
liabilityِ واقعی. و انقضا خودش تنشِ تجربه/ترازنامه دارد که تصمیمِ مالک است.

---

## منابع

- [SmartX — باشگاه مشتریان رستوران و کافه](https://smartx.ir/services/club/)
- [BonusQR — Restaurant Loyalty Programs: The Complete Guide for 2026](https://bonusqr.com/article/restaurant-loyalty-programs-the-complete-guide-for-2026)
- [Talon.One — Restaurant loyalty cards: Types, formats & examples](https://www.talon.one/blog/restaurant-loyalty-card)
- [LoyaltyPass — Restaurant Loyalty Program: The Complete 2026 Guide](https://www.loyaltypass.co/blog/industries/restaurant-loyalty-program)
- [Loop — Restaurant Loyalty Programs: Complete Guide (2026)](https://loop.fans/blog/restaurant-loyalty-programs-complete-guide)
- [Bubblehouse — Loyalty Liability & Fraud Controls 2026](https://www.bubblehouse.com/blog/loyalty-liability-accounting-reward-expiration-fraud-2026)
- [Yotpo — Prevent Reward Program Fraud](https://www.yotpo.com/blog/how-to-prevent-reward-program-fraud/)
- [Loyalty Juggernaut — Loyalty fraud prevention](https://lji.io/guides/loyalty-fraud-prevention)
- [Brandmovers — What CFOs Need to Know About Loyalty Program Liability in 2026](https://blog.brandmovers.com/what-cfos-need-to-know-about-loyalty-program-liability-in-2026)
- [KYROS — Loyalty Program Liability: The Complete Guide (2026)](https://www.kyros.com/blog/loyalty-program-liability-guide/)
