# DS-008 — اپِ مشتری: مینیمال‌تر، اسکرولِ زنده، حرکتِ اسکرول‌محور

| | |
|---|---|
| **تاریخ** | ۲۰۲۶-۰۹-۱۰ |
| **نویسنده** | `rezv-e6 [a3c0f0]` — Designer، لایه‌ی بصری |
| **دستور** | مالک، مستقیم: «fix customer app more minimal but with tik tok and instagram scrolling feel, live scroll, some motion» |
| **وضعیت** | **submitted** — پیاده‌شده و اندازه‌گیری‌شده، بسته‌نشده |
| **فایل‌ها** | `shared/css/foundation.css` (لِینِ من) · `apps/customer/css/app.css` (⚠️ §۵) · `standalone/customer.html` بازتولید |

---

## ۰. یک‌خط

**سه تغییرِ CSS، صفر تغییرِ JS/HTML.** p95 ِ فریم‌تایمِ اسکرولِ فید از **۳۳ به ۱۷ms** (هر پنج اجرا)،
حرکت حالا تابعِ اسکرول است نه تایمر، و در `prefers-reduced-motion` **اندازه‌گیری‌شده** خاموش می‌شود.

---

## ۱. «مثلِ تیک‌تاک و اینستاگرام» یعنی چه — مکانیزم، نه سلیقه

مالک مرجعِ **حس** داد. مکانیزمی که آن حس را می‌سازد، سه چیز است و هر کدام یک تصمیمِ CSS شد:

| مکانیزمِ مرجع | چه بود | چه شد |
|---|---|---|
| **محتوا رنگ است، صفحه نه** | `body{background:var(--mesh),var(--bg);background-attachment:fixed}` — مشِ ۵توقفیِ radial زیرِ همه‌چیز، با کارت‌ها رقابت می‌کرد | `body{background:var(--bg)}` — صفحه‌ی خنثی، کارت خودش رنگ |
| **حرکت تابعِ اسکرول است، نه تایمر** | `.reveal`: ۵۵۰ms، spring با overshoot، `scale(.97)` — کارت «می‌پرید» | scroll-driven: `animation-timeline: view()` — کارت با ورود «می‌نشیند» (opacity .72→1، 10px)، پس‌زمینه‌اش پارالاکسِ ملایم (scale 1.06→1، −3%→0). روی مرورگرِ بی‌پشتیبان: `.reveal` ِ کوتاه‌شده (۳۲۰ms ease-out، بی‌فنر) |
| **اسکرول روی کارت می‌نشیند** | هیچ | `html:has(#page-discover.active){scroll-snap-type:y proximity;scroll-padding-top:74px}` + `#feed>.rc{scroll-snap-align:start}`. **proximity نه mandatory** — اینستاگرام اسکرول را نمی‌دزدد؛ تیک‌تاک mandatory است ولی برای کارتِ ۲۷۰px (نه تمام‌صفحه) mandatory هر فلیک را یک کارت می‌کند و کلافه‌کننده می‌شود |

و «مینیمال»: `.section{padding:40px→28px}` — هوای بینِ بخش‌ها کمتر، فید پیوسته‌تر.

**چه چیزی عمداً برداشته نشد:** گرادیانِ کارت‌ها و کارت‌های مناسبت (آن‌ها *محتوا*یند)، شیشه‌ی nav
(رنگِ کارتِ زیرش را می‌گیرد — این خودش «زنده» است)، چیپ‌ها. «مینیمال» یعنی حذفِ چیزی که با
محتوا رقابت می‌کند، نه حذفِ رنگ.

---

## ۲. اندازه‌گیری — قبل/بعد، همان پروتکل، همان ماشین، N=5

`tools/measure-scroll-frametime.mjs 5` (headless Chromium، ۳۹۰×۸۴۴، ۱۲ فلیکِ ۲۵۰px):

| | p95 (median) | >33ms (median) | worst max |
|---|---|---|---|
| `199c47d` (پیش از A) | ۵۰ | ۲۹ (~۳۵٪) | ۸۳ |
| `b3e22da` (بعد از A، پیش از این) | ۳۳٫۳ | ۸ (~۹٪) | ۵۰ |
| **این تغییر** | **۱۶٫۸** | **۲ (~۲٪)** | **۳۳٫۴** |

هر پنج اجرا p95 = ۱۶٫۸ — یعنی ۹۵٪ فریم‌ها **در بودجه‌ی ۶۰fps**. هر پنج اجرا از هر پنج اجرای قبل
بهتر. **علت را ادعا نمی‌کنم**؛ با «حذفِ `background-attachment:fixed` روی گرادیانِ چندتوقفی» *سازگار*
است (repaintِ کلِ viewport در هر فریم)، ولی برای اثبات باید آن یک تغییر را جدا می‌سنجیدم و نسنجیدم.

**قیدِ ثابت:** headless روی PC، `wheel` نه انگشت. **این مقایسه است، نه داوریِ «حسِ خوب» روی گوشی.**
با این حال: فریم‌تایمی که روی PC از بودجه بیرون بود، روی گوشیِ میان‌رده بدتر می‌شد، نه بهتر — پس
جهتِ بهبود روی گوشی هم همین است، اندازه‌اش نامعلوم.

### اعمال‌شدن، از `getComputedStyle` نه از ترتیبِ فایل (درسِ دیروز)

```
html.scrollSnapType  y          html.scrollPaddingTop  74px   (nav = 62 + 12)
body.backgroundImage none       body.backgroundAttachment scroll
#feed>.rc  animationName ds-settle-in   animationTimeline view()   scrollSnapAlign start
.rc-bg     animationName ds-bg-drift    animationTimeline view()
```

### reduced-motion — خاموش، اندازه‌گیری‌شده نه ادعاشده

`reducedMotion:'reduce'` در همان پروب: `.rc` و `.rc-bg` → `animationName: none`, `animationTimeline: auto`;
`.reveal` transition → `1e-05s`. **چرا صریح لازم بود:** سیاستِ سراسریِ `tokens.css` فقط *duration* را
صفر می‌کند و انیمیشنِ timeline‌محور duration ندارد — بدونِ `animation:none` ِ صریح، پارالاکس در
reduced-motion **می‌ماند**. snap (proximity) عمداً می‌ماند؛ حرکت نیست.

### گیت‌ها

`sync --check` 0 · `build-standalone --check` 0 · `check-fonts` 0 · `check-app-js-syntax` 0 ·
`measure-home-s1` **0** (اولین کارت ۳۹۲، حاشیه ۳۰ — تغییرِ padding آن را جابه‌جا نکرد چون LE با
`:has(#feed)` پدینگِ آن بخش را جدا ۱۴px کرده).

---

## ۳. پیش‌روندهٔ تدریجی — چه کسی چه می‌بیند

| مرورگر | می‌بیند |
|---|---|
| Chrome/Edge ۱۱۵+، Android WebView تازه | همه: snap + settle + پارالاکس |
| Safari/iOS (تا `animation-timeline`) | snap + `.reveal` ِ کوتاه‌شده؛ بی‌پارالاکس، بی‌شکست |
| Firefox | همان — پشتِ `@supports`، هیچ‌چیز نمی‌شکند |
| هر مرورگر با reduced-motion | فقط snap ِ نرم؛ صفر انیمیشن |

**بازارِ ایران غالباً اندروید/Chrome است** — یعنی مسیرِ کاملِ حرکت را می‌بیند. ولی این یک فرض
درباره‌ی توزیعِ مرورگر است، نه اندازه‌گیری.

---

## ۴. اولیه‌ی قابلِ استفاده‌ی مجدد (`foundation.css`)

`@keyframes ds-settle-in`, `@keyframes ds-bg-drift`, و کلاس‌های `.ds-scroll-live` / `.ds-scroll-live-bg`
پشتِ `@supports` با reduced-motion ِ صریح. اپِ مشتری آن‌ها را روی `#feed` **بدونِ کلاس** اعمال
می‌کند (کلاس در مارک‌آپ = لِینِ LE)؛ keyframes یک تعریف دارد. پنل‌های business/company اگر خواستند
همان دو کلاس را روی فهرست‌هایشان بگذارند.

---

## ۵. مرزِ مالکیت — صادقانه

`apps/customer/css/app.css` در جدولِ CEO **نام برده نشده** (JS/HTML → LE؛ `shared/css` → من). منشورِ
قدیمی آن را به ساب‌ایجنتِ `panels-ui-engineer` می‌داد. مالک مستقیم گفت «fix customer app» و این کار
**بدونِ** `app.css` ناممکن است (cascade را دیروز اندازه گرفتم: `app.css` روی `foundation` می‌نشیند).
پس نوشتمش — **فقط CSS، در worktreeِ خودم، اعلام‌شده** — و اگر CEO می‌خواهد آن را از مسیرِ LE ببرد،
یک فایل است و یک revert. کلاسِ خرابی‌ای که مرز برایش کشیده شد (بک‌تیک در template literal) در CSS
ممکن نیست.

---

## ۶. آنچه این سند نمی‌گوید

- **«حسِ خوب» روی گوشی داوری نشده.** فریم‌تایم روی PC بهتر شد؛ روی یک اندرویدِ میان‌رده در تهران
  اندازه گرفته نشده. آن هنوز تنها خواسته‌ی مالک است که بی‌عدد مانده.
- علتِ بهبودِ فریم جدا نشد (چهار تغییر هم‌زمان). اگر روزی مهم شد، bisect.
- تیک‌تاک/اینستاگرام از **حافظه‌ی الگو** آمده، نه مقایسه‌ی کنارِ هم. Mobbin امروز قطع است.
- پارالاکسِ `.rc-bg` با `.rc:hover .rc-bg{scale(1.06)}` ِ قدیمی هم‌پوشانی دارد؛ روی لمس hover بی‌معناست،
  روی دسکتاپ ممکن است دو transform با هم بجنگند. **نسنجیدم**؛ دسکتاپ هدفِ این اپ نیست.
