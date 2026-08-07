# SEO_AUDIT_REPORT — رزرونو

> ⚠️ **به‌روزرسانیِ ۲۰۲۶-۰۸-۰۷: پیش‌فرض‌هایِ اصلیِ این سند دیگر درست نیستند.**
> این ممیزی می‌گفت مشکلِ ریشه‌ای «SPA تکURL بدونِ SSR» و «نبودِ فیلدهایِ مکانی»
> است. بعد از این تاریخ، هردو رفع شدند: (۱) `apps/seo/` و `apps/landing/`
> اپ‌هایِ Next.js/React مجزا با SSRِ واقعی، sitemap، JSON-LD، و صفحاتِ
> per-restaurant ساخته شدند (کارهایِ مربوط به CMS/محتوای عمومی — تسکِ ۱ تا ۱۰
> در تاریخچه‌یِ پروژه)؛ (۲) migration `030` فیلدهایِ `city`/`district`/`address`/
> `latitude`/`longitude` را به `Restaurant` اضافه کرد و `prisma/seed.ts` این‌ها
> را برایِ رستوران‌هایِ نمونه پر می‌کند. **این سند بازنویسی نشده** — یک ممیزیِ
> تازه بر رویِ `apps/seo`/`apps/landing`ِ فعلی باید جدا انجام شود؛ آنچه پایین
> می‌آید را به‌عنوانِ تاریخِ گذشته بخوان، نه وضعیتِ فعلی.
>
> ممیزیِ فنیِ SEO از روی **کدِ واقعیِ** ریپو (نه فرض) — در تاریخِ زیر.
> تاریخ: ۲۰۲۶-۰۷-۳۰ · دامنه‌ی هدف: `rezervno.ir` · وضعیت (در آن تاریخ): **قبل از لانچ** (API هنوز روی Vercel سرو نمی‌شد).
>
> این سند **گامِ ۱** از پروژه‌ی SEO است. صادقانه: گام‌های ۲ تا ۱۶ (SSR/programmatic/local/AI-search)
> یک برنامه‌ی چندماهه‌اند و **مشروط به دو تصمیمِ معماری/دادهٔ زیر**اند؛ بدونِ آن‌ها بخشِ اصلیِ
> هدف (رقابت با OpenTable/Resy/TheFork) از نظرِ فنی ممکن نیست. این ممیزی چیزی را «تمام‌شده»
> اعلام نمی‌کند که نیست.

---

## ۰. خلاصه‌ی مدیریتی

رزرونو پایه‌ی متادیتای خوبی دارد (title/description/OG/Twitter/canonical/robots/manifest،
`lang=fa dir=rtl`)، ولی به‌عنوان یک **marketplaceِ کشف و رزرو** عملاً **غیرقابلِ‌ایندکس** است،
به دو دلیلِ ریشه‌ای که همه‌چیزِ دیگر را قفل می‌کنند:

1. **SPA تک‌URL + رندرِ سمتِ کلاینت.** کلِ اپ پشتِ `/` است؛ رستوران‌ها/شهرها/آشپزی‌ها
   **هیچ URLِ جداگانه‌ای ندارند** و محتوا با JS از API رندر می‌شود. `sitemap.xml` خودش این را
   تأیید می‌کند («فقط همین یک URL crawlable است»). گوگل/AI-search فقط یک صفحه‌ی تقریباً خالی می‌بینند.
2. **مدلِ دادهٔ رستوران فاقدِ فیلدهای مکانی است.** `Restaurant` فیلدهای `slug`✅، `cuisine`،
   `openingHours`، `timezone` را دارد ولی **`address`، `lat/lng`، `city/district`، `priceRange`،
   amenities را ندارد.** یعنی حتی اگر صفحه‌ی per-restaurant بسازیم، schemaهای
   LocalBusiness/Place/GeoCoordinates دادهٔ واقعی برای پرشدن ندارند.

بدونِ رفعِ (۱) و (۲)، گام‌های Local SEO / Programmatic / Restaurant Profile / AI-search
صرفاً حرف‌اند. هر دو رفع **خلافِ قانونِ فعلیِ معماری**اند (CLAUDE.md: «static، no-build،
SPA تک‌URL — تغییر نده» + تغییرِ schemaِ DB = high-risk). پس **تصمیمِ تیم لازم است** (بخشِ ۸).

---

## ۱. آنچه از قبل خوب است (پایه‌ی سالم)
- `apps/customer/index.html`: `<title>`، `meta description`، `keywords`، `robots: index,follow`،
  `theme-color`، `canonical`، Open Graph (type/title/description/locale/site_name)، Twitter card،
  `manifest.webmanifest`، apple-PWA meta. `<html lang="fa" dir="rtl">`.
- `robots.txt`: `Allow: /`، `Disallow: /api/`، اشاره به `sitemap.xml`.
- یک بلوکِ JSON-LD (`WebApplication`) در صفحه‌ی اصلی.
- PWA + سرویس‌ورکر (سرعتِ بازدیدِ مجدد) و RTL/فارسیِ درست.
- زیرساختِ عملکرد: بدونِ bundler سنگین، CSS توکنیزه، فونتِ Vazirmatn.

## ۲. بلوکرهای بحرانی (به‌ترتیبِ اهمیت)
| # | مشکل | اثر بر SEO | راه‌حل | ریسک |
|---|------|-----------|--------|------|
| C1 | SPA تک‌URL، بدونِ router و بدونِ per-entity URL | فقط ۱ صفحه ایندکس می‌شود؛ کلِ کاتالوگ نامرئی | router واقعی + URLهای `/r/{slug}`، `/city/{city}`، `/cuisine/{c}` | **بالا (معماری)** |
| C2 | رندرِ سمتِ کلاینت (HTML خالی) | خزنده/AI محتوا نمی‌بیند | SSR/SSG/prerender برای صفحاتِ محتوایی | **بالا (معماری)** |
| C3 | نبودِ address/geo/city/priceRange در DB | LocalBusiness/Place schema بی‌داده | افزودنِ فیلدها + migration + backfill | **بالا (schema DB)** |
| C4 | JSON-LD حداقلی (فقط WebApplication) | knowledge-graph/rich-result ضعیف | Organization + WebSite + (بعداً) Restaurant/Breadcrumb/FAQ | کم |
| C5 | sitemap ایستا با ۱ URL | کشفِ صفحات صفر | sitemap پویا از DB (بعد از C1) | متوسط |
| C6 | API روی Vercel ۴۰۴ | دادهٔ صفحات سرو نمی‌شود | تنظیمِ داشبورد (docs/DEPLOY_API_VERCEL.md) | — (انسانی) |
| C7 | بدونِ hreflang / i18n مسیر | آماده‌ی چندکشوری/چندزبانه نیست | ساختارِ locale پس از C1 | متوسط |

## ۳. یافته‌ها بر اساسِ ناحیه (خلاصه)
- **Rendering/URL:** مهم‌ترین ضعف؛ بخشِ ۲ (C1/C2).
- **Metadata:** پایه خوب؛ ولی همه ثابت و فقط برای صفحه‌ی اصلی — per-page title/description لازم است (بعد از C1).
- **Schema:** فقط WebApplication؛ Organization/WebSite را می‌شود **همین حالا بی‌ریسک** افزود؛ Restaurant/LocalBusiness/Review/Menu/Breadcrumb/FAQ **مشروط به C1+C3**.
- **Local SEO:** غیرممکن تا C3 (بدونِ آدرس/مختصات) و C1 (بدونِ صفحه‌ی مکان).
- **Programmatic:** غیرممکن تا C1+C2؛ و باید با گاردِ کیفیت (حداقل تعدادِ رستوران/شهر، محتوای یکتا) ساخته شود تا thin/spam نشود.
- **AI-search (GEO):** نیازمندِ HTMLِ سمنتیک + محتوای factual قابل‌خزش (C2) + schema (C4). فعلاً چیزی برای استخراج نیست.
- **Performance:** بدونِ داده‌ی field (سایت زنده نیست) نمی‌توان CWV واقعی سنجید؛ باید پس از لانچ با Lighthouse/CrUX پایش شود.
- **International:** فیلدهای locale/currency و hreflang وجود ندارد؛ پس از C1.
- **Security↔SEO:** `robots.txt` درست؛ فقط باید مطمئن شویم rate-limit/WAF خزنده‌های Googlebot/Bingbot را بلاک نکند (بررسیِ `middleware.ts` — گامِ بعدی).

## ۴. تحلیلِ شکافِ رقبا (خلاصه‌ی صادقانه)
OpenTable/Resy/TheFork/Tripadvisor/Yelp همه بر پایه‌ی **URLهای per-restaurant و per-city سمت‌سرور**
با Restaurant/LocalBusiness/AggregateRating schema و لینک‌سازیِ داخلیِ داده‌محور بنا شده‌اند —
دقیقاً همان چیزی که رزرونو (C1/C2/C3) ندارد. مزیتِ بالقوه‌ی رزرونو: RTL/فارسی، تمرکزِ محلیِ ایران،
UXِ موبایلِ سریع. ولی تا پایه‌ی URL/rendering/data ساخته نشود، رقابت ممکن نیست.

## ۵. آنچه بی‌ریسک و بی‌تغییرِ معماری همین حالا می‌شود انجام داد (Phase 0)
- **C4 (بخشی):** افزودنِ JSON-LD `Organization` + `WebSite` به صفحه‌ی اصلی (معتبر حتی برای تک‌صفحه).
  `SearchAction` عمداً **افزوده نمی‌شود** چون URLِ نتایجِ جست‌وجو وجود ندارد (schemaِ اشاره‌به‌ناکجا = گمراه‌کننده).
- بازبینیِ `middleware.ts` تا خزنده‌ها بلاک نشوند؛ افزودنِ per-app `robots.txt`/sitemap صحیح.
- تیدی‌کردنِ metadata (og:image واقعی وقتی asset آماده شد).
> این‌ها SEO را «رقابتی» نمی‌کنند — فقط بهداشت‌اند. بردِ واقعی پشتِ C1/C2/C3 است.

## ۶. نقشه‌ی راهِ پیشنهادی (تدریجی، تست‌محور — سبکِ همین پروژه)
- **Phase 0 (بی‌ریسک، الان):** schema پایه (Organization/WebSite) + بهداشتِ crawl. ← همین PR شروع می‌کند.
- **Phase 1 (تصمیمِ معماری):** انتخابِ مدلِ رندر برای صفحاتِ محتوایی (پایینِ بخش ۸).
- **Phase 2 (دادهٔ مکانی):** افزودنِ `address/lat/lng/city/district/priceRange/amenities` به `Restaurant` (migration + backfill + پنل شرکت). **high-risk → PR جدا + تأیید.**
- **Phase 3 (صفحاتِ per-restaurant):** `/r/{slug}` رندرشده‌ی سرور + Restaurant/LocalBusiness/AggregateRating/Menu/Breadcrumb schema از دادهٔ واقعی.
- **Phase 4 (صفحاتِ مکان/آشپزی):** `/city/{city}`، `/cuisine/{c}`، ترکیبی — با گاردِ کیفیت.
- **Phase 5 (sitemap پویا + internal linking + AI-search):** sitemap از DB، لینک‌سازیِ «مشابه/نزدیک»، محتوای factual.
- **Phase 6 (i18n/international + پایشِ خودکار).**

## ۷. آماده‌سازیِ داده (پیش‌نیازِ همه‌چیز)
`Restaurant` باید حداقل این‌ها را داشته باشد تا schema/Local SEO واقعی شود:
`address`, `latitude`, `longitude`, `city`, `district`/`neighborhood`, `priceRange`,
`amenities[]`, `photos[]` (اگر نیست), `description` (یکتا و انسانی‌کیفیت). `slug` از قبل هست ✅.

## ۸. تصمیم‌هایی که باید تیم بگیرد (قبل از گام‌های سنگین)
1. **مدلِ رندرِ صفحاتِ محتوایی** — کدام؟ گزینه‌ها:
   - (الف) **پیش‌رندرِ استاتیک (SSG) در همان معماریِ no-build** با یک generatorِ سبک که از API صفحاتِ `/r/{slug}` را HTML می‌سازد (کمترین انحراف از معماریِ فعلی، ولی نیاز به build step دارد).
   - (ب) **یک اپِ Next.js جدا برای صفحاتِ عمومی/SEO** (SSR/ISR) در کنارِ SPA فعلی (قوی‌ترین از نظرِ SEO، ولی معماریِ deployِ Vercel را تغییر می‌دهد).
   - (ج) **prerender/dynamic-rendering برای بات‌ها** روی همان SPA (کم‌ترین کار، ولی شکننده و ضعیف‌تر).
2. **تغییرِ schemaِ DB** برای فیلدهای مکانی (Phase 2) — تأیید برای high-risk migration.

هر کدام از (الف)/(ب)/(ج) خلافِ «معماری را تغییر نده»ی فعلی است؛ برای همین **بدونِ تأییدِ صریح شروع نمی‌شود**.

---

## وضعیتِ صادقانه
- **انجام‌شده (این PR):** گامِ ۱ (این ممیزی) + شروعِ Phase 0.
- **انجام‌نشده و مشروط به تصمیم:** گام‌های ۲–۱۶ (SSR/programmatic/local/AI-search/international/monitoring).
- به همین دلیل توکنِ «تمام‌شد» در این مرحله چاپ **نمی‌شود** — کارِ واقعی تازه شروع شده و به تصمیم‌های بخشِ ۸ گره خورده است.
