# apps/seo — وب‌سایتِ عمومیِ رزرونو (Next.js SSR/ISR)

دامنه‌ی عمومی (`rezervno.ir`): هم صفحاتِ بازاریابی/محصول/قیمت و هم صفحاتِ
ایندکس‌پذیرِ رستوران. جدا از اپِ مشتری، پنلِ کسب‌وکار و پنلِ شرکت.

معماری: [`docs/adr/0001`](../../docs/adr/0001-seo-rendering-architecture.md) (رندر)
و [`docs/adr/0002`](../../docs/adr/0002-public-website-and-cms.md) (وب‌سایت، CMS، قیفِ فروش).

---

## اجرا

```sh
cd apps/seo
npm install
SEO_API_BASE=http://localhost:3000 NEXT_PUBLIC_API_BASE=http://localhost:3000 npm run dev
# → http://localhost:3100
```

بدونِ `SEO_API_BASE` هم بالا می‌آید و از **حالتِ امن** (`content/site-content.json`)
رندر می‌کند — همان چیزی که CI با آن build می‌گیرد.

| اسکریپت | کار |
|---|---|
| `npm run dev` | سرورِ توسعه روی ۳۱۰۰ |
| `npm run build` | بیلدِ تولید |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | تستِ واحد: JSON-LD، Markdownِ امن، محتوای پیش‌فرض |

---

## متغیرهای محیطی

| متغیر | سمت | توضیح |
|---|---|---|
| `SEO_API_BASE` | سرور | خواندنِ محتوا در SSR/ISR و ساختِ sitemap |
| `NEXT_PUBLIC_API_BASE` | مرورگر | فرم‌های دمو/خرید/تماس و استودیو |
| `NEXT_PUBLIC_BUSINESS_APP_URL` | مرورگر | دکمه‌ی ورود به پنلِ کسب‌وکار |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | مرورگر | دکمه‌ی ورود به اپِ مشتری |
| `NEXT_PUBLIC_COMPANY_APP_URL` | مرورگر | دکمه‌ی ورود به پنلِ شرکت |

⚠️ دامنه‌ی این سایت باید در `ALLOWED_ORIGINS`ِ اپِ `api/` باشد، وگرنه فرم‌ها
با خطای CORS رد می‌شوند. لینک‌های ورودی که آدرسشان تنظیم نشده باشد، به‌جای
دکمه‌ی مرده، مسیرِ جایگزینِ واقعی (تماس با پشتیبانی) نشان می‌دهند.

---

## ساختار

```
app/
  page.tsx                 صفحه‌ی اصلی (از CMS)
  product|customer-app|business-app|features|how-it-works|about|terms|privacy
                           صفحه‌های CMS — هرکدام ۵ خط، محتوا از دیتابیس
  pricing/                 قیمت‌گذاری + مسیرِ خرید (اختصاصی)
  demo/                    فرمِ دموی ۳۰ روزه (اختصاصی)
  faq/ blog/ changelog/ contact/ login/
  order/[code]/            پیگیریِ عمومیِ وضعیتِ سفارش
  studio/                  استودیوی محتوا (پشتِ احرازِ هویتِ مدیر)
  r|city|cuisine/          صفحاتِ رستوران (ADR 0001)
  api/revalidate/          تازه‌سازیِ فوریِ کش بعد از ویرایشِ استودیو
  sitemap.ts robots.ts opengraph-image.tsx not-found.tsx
components/
  site/                    هدر، فوتر، آیکن، حرکت، تمِ روشن/تاریک، JSON-LD
  sections/                موتورِ رندرِ بلوک‌های CMS + تصویرسازی‌های محصولی
  pricing/ forms/ order/ studio/
lib/
  site-api.ts              خواندنِ CMS (با حالتِ امن)
  content-types.ts         انواع + پلِ حالتِ امن
  site-schema.ts seo.ts    JSON-LD و Metadata
  markdown.ts format.ts    Markdownِ امن، اعداد/تاریخِ فارسی
  client-api.ts studio-api.ts
content/site-content.json  ⚠️ کپیِ خودکار از shared/content — دستی ویرایش نکن
```

---

## محتوا و CMS

منبعِ حقیقت **دیتابیس** است؛ ویرایش از `/studio` (ورود با شماره‌ی مدیرِ پلتفرم).
هفت مجموعه: صفحه‌ها، مقاله‌ها، پرسش‌ها، پلن‌ها، نظرها، بنرها، تغییرات — هرکدام
با فیلدهای سئوی مستقل (عنوان، توضیحِ متا، کلیدواژه، تصویرِ اشتراک‌گذاری، noindex).

`content/site-content.json` فقط **حالتِ امن** است: وقتی API در دسترس نیست
(بیلدِ CI یا قطعیِ موقت) سایت با همان متن رندر می‌شود. ویرایشش را در
`shared/content/site-content.json` انجام بده و بعد:

```sh
sh tools/sync-design-system.sh          # کپی به apps/seo و api/prisma/seed
cd api && npm run db:seed:site          # کاشتن در دیتابیس
```

CI با `sync-design-system.sh --check` واگراییِ کپی‌ها را می‌گیرد.

### بلوک‌های صفحه

`hero` · `metrics` · `apps` · `features` · `split` · `steps` · `comparison` ·
`showcase` · `pricing` · `testimonials` · `faq` · `cta` · `prose` · `legal`

بلوکِ ناشناخته بی‌صدا رد می‌شود — پس افزودنِ نوعِ تازه از استودیو صفحه‌ی زنده را
نمی‌شکند.

---

## سئو

- `Metadata` یک‌جا در `lib/seo.ts`: canonical، hreflang، Open Graph، Twitter، robots
- JSON-LD در یک `@graph` به‌ازای هر صفحه: `Organization` + `WebSite` در ریشه،
  و `WebPage`/`BreadcrumbList`/`FAQPage`/`SoftwareApplication`+`Offer`/`BlogPosting`
  به‌تناسبِ صفحه
- قیمت‌های `Offer` از همان پلن‌هایی می‌آیند که کاربر می‌بیند (تومان → ریال)
- `sitemap.xml` پویا: صفحاتِ ثابت + مقاله‌ها + صفحه‌های CMS + رستوران/شهر/آشپزی؛
  ردیف‌های `noindex` وارد نمی‌شوند تا سیگنالِ متناقض نرود
- تصویرِ اشتراک‌گذاری در زمانِ اجرا ساخته می‌شود (`opengraph-image`)

---

## دسترسی‌پذیری و حرکت

- بدونِ کتابخانه‌ی انیمیشن؛ یک `IntersectionObserver` مشترک + CSS
- `prefers-reduced-motion` همه‌ی حرکت‌ها را خاموش می‌کند و محتوا کاملاً دیده می‌ماند
- بدونِ جاوااسکریپت هم هیچ محتوایی پنهان نمی‌ماند (کلاسِ `js-reveal`)
- آکاردئونِ پرسش‌ها با `<details>` — خزنده و اسکرین‌ریدر متن را می‌بینند
- تمِ روشن/تاریک با انتخابِ صریحِ کاربر (غالب بر ترجیحِ سیستم) و بدونِ پرشِ تم

---

## دیپلوی

پروژه‌ی Vercelِ مستقل، `Root Directory = apps/seo`، framework = Next.js.
متغیرهای بالا را در Environment Variables بگذار و مطمئن شو دامنه در
`ALLOWED_ORIGINS`ِ بک‌اند هست.

### چیدمانِ دامنه

این اپ مالکِ **ریشه‌ی دامنه** است — چون `sitemap.xml`، `robots.txt` و
canonicalها از اینجا می‌آیند. بقیه روی زیردامنه‌اند و با Caddy از سرورِ خودت
سرو می‌شوند (`deploy/caddy/Caddyfile`):

| دامنه | چه چیزی | میزبان |
|---|---|---|
| `rezervno.ir` | همین اپ | Vercel |
| `api.rezervno.ir` | بک‌اند | سرورِ خودت |
| `app.rezervno.ir` | اپِ مشتری | سرورِ خودت |
| `business.rezervno.ir` | پنلِ کسب‌وکار | سرورِ خودت |
| `admin.rezervno.ir` | پنلِ شرکت | سرورِ خودت |

DNS: ریشه و `www` به Vercel، چهار زیردامنه‌ی دیگر با رکوردِ A به آی‌پیِ سرور.
