# apps/landing — وب‌سایتِ عمومیِ رزرونو (Next.js SSR/ISR)

معرفیِ محصول، فروشِ اشتراک، و داشبوردِ محتوا. **اپِ مستقل** با دامنه، `sitemap.xml`
و canonicalِ خودش.

جدا از: اپِ مشتری (`apps/customer`)، پنلِ کسب‌وکار (`apps/business`)، پنلِ شرکت
(`apps/company`)، و صفحاتِ ایندکس‌پذیرِ رستوران (`apps/seo`).

معماری: [`docs/adr/0002`](../../docs/adr/0002-public-website-and-cms.md).

---

## اجرا

```sh
cd apps/landing
npm install
SITE_API_BASE=http://localhost:3000 NEXT_PUBLIC_API_BASE=http://localhost:3000 npm run dev
# → http://localhost:3200
```

بدونِ `SITE_API_BASE` هم بالا می‌آید و از **حالتِ امن** (`content/site-content.json`)
رندر می‌کند — همان چیزی که CI با آن build می‌گیرد.

پورت ۳۲۰۰ است تا با `apps/seo` (۳۱۰۰) همزمان قابلِ اجرا باشد.

| اسکریپت | کار |
|---|---|
| `npm run dev` | سرورِ توسعه روی ۳۲۰۰ |
| `npm run build` | بیلدِ تولید |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | تستِ واحد: JSON-LD، Markdownِ امن، محتوای پیش‌فرض |

---

## متغیرهای محیطی

| متغیر | سمت | توضیح |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | هر دو | دامنه‌ی همین سایت — پایه‌ی canonical و sitemap |
| `SITE_API_BASE` | سرور | خواندنِ محتوا در SSR/ISR و ساختِ sitemap |
| `NEXT_PUBLIC_API_BASE` | مرورگر | فرم‌های دمو/خرید/تماس و داشبورد |
| `NEXT_PUBLIC_BUSINESS_APP_URL` | مرورگر | دکمه‌ی ورود به پنلِ کسب‌وکار |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | مرورگر | دکمه‌ی ورود به اپِ مشتری |
| `NEXT_PUBLIC_COMPANY_APP_URL` | مرورگر | دکمه‌ی ورود به پنلِ شرکت |

`SEO_API_BASE` نامِ قدیمی است و هنوز به‌عنوانِ fallback خوانده می‌شود.

⚠️ دامنه‌ی این سایت باید در `ALLOWED_ORIGINS`ِ اپِ `api/` باشد، وگرنه فرم‌ها
با خطای CORS رد می‌شوند.

---

## ساختار

```
app/
  page.tsx                 صفحه‌ی اصلی (از CMS)
  product|customer-app|business-app|features|how-it-works|about|terms|privacy
                           صفحه‌های CMS — هرکدام ۵ خط، محتوا از دیتابیس
  [slug]/                  ⭐ صفحه‌های ساخته‌شده در داشبورد — بدونِ دیپلوی زنده می‌شوند
  pricing/                 قیمت‌گذاری + مسیرِ خرید
  demo/                    فرمِ دموی ۳۰ روزه
  faq/ blog/ changelog/ contact/ login/
  order/[code]/            پیگیریِ عمومیِ وضعیتِ سفارش
  studio/                  داشبوردِ محتوا (پشتِ احرازِ هویتِ مدیر)
  api/revalidate/          تازه‌سازیِ فوریِ کش بعد از ویرایش
  sitemap.ts robots.ts opengraph-image.tsx not-found.tsx
components/
  site/                    هدر، فوتر، آیکن، حرکت، تمِ روشن/تاریک، JSON-LD
  sections/                موتورِ رندرِ بلوک‌های CMS + تصویرسازی‌های محصولی
  pricing/ forms/ order/ studio/
lib/
  site-api.ts              خواندنِ CMS (با حالتِ امن)
  i18n.ts                  دامنه و hreflang (دامنه از env)
  site-schema.ts seo.ts    JSON-LD و Metadata
  markdown.ts format.ts    Markdownِ امن، اعداد/تاریخِ فارسی
content/site-content.json  ⚠️ کپیِ خودکار از shared/content — دستی ویرایش نکن
```

---

## داشبوردِ محتوا (`/studio`)

ورود با شماره‌ی مدیرِ پلتفرم (همان OTPِ پنلِ شرکت). هفت مجموعه:

| مجموعه | چه کاری می‌کنی |
|---|---|
| صفحه‌ها | ساختِ صفحه‌ی تازه، چیدنِ بلوک‌ها، ویرایشِ متن |
| مقاله‌ها | نوشتن و انتشارِ مقاله (بلاگ) |
| پرسش‌ها | پرسش‌های متداول در پنج حوزه |
| پلن‌ها | قیمت و مشخصاتِ اشتراک |
| نظرها | نظرِ مشتریان |
| بنرها | نوارِ اعلانِ بالای سایت |
| تغییرات | یادداشتِ انتشار |

هرکدام فیلدهای سئوی مستقل دارند: عنوان، توضیحِ متا، کلیدواژه، تصویرِ
اشتراک‌گذاری، `noindex`، و JSON-LD دستی.

**صفحه‌ی تازه بدونِ دیپلوی زنده می‌شود:** مسیرِ `app/[slug]/` هر اسلاگی را که در
استودیو ساخته شده رندر می‌کند. `dynamicParams` روشن است، پس اسلاگی که موقعِ
build وجود نداشته هم کار می‌کند.

بعد از ذخیره، استودیو `POST /api/revalidate` می‌زند تا کشِ ISR فوراً تازه شود.

### بلوک‌های صفحه

`hero` · `metrics` · `apps` · `features` · `split` · `steps` · `comparison` ·
`showcase` · `pricing` · `testimonials` · `faq` · `cta` · `prose` · `legal`

بلوکِ ناشناخته بی‌صدا رد می‌شود — پس افزودنِ نوعِ تازه صفحه‌ی زنده را نمی‌شکند.

---

## فروشِ اشتراک

سه پلن: ۳ ماه ۱۸٬۰۰۰٬۰۰۰ · ۶ ماه ۳۴٬۰۰۰٬۰۰۰ · ۱۲ ماه ۶۵٬۰۰۰٬۰۰۰ تومان.

مسیر: کاربر پلن را انتخاب می‌کند → سفارش با وضعیتِ `pending` ثبت می‌شود →
پنلِ شرکت اعلان می‌گیرد → مدیر فعال‌سازی می‌کند → `tenant.plan` و
`planExpiresAt` واقعاً ست می‌شوند.

**قیمت هرگز از کلاینت گرفته نمی‌شود:** فقط `plan_key` می‌آید و سرور مبلغ را از
`site_plans` می‌خواند. کاربر وضعیت را در `/order/{code}` می‌بیند.

دموی ۳۰ روزه بلافاصله provision می‌شود: `Tenant` + `Restaurant` + `Staff(owner)`
واقعی. idempotent روی شماره.

---

## سئو

- `Metadata` یک‌جا در `lib/seo.ts`: canonical، hreflang، Open Graph، Twitter، robots
- JSON-LD در یک `@graph` به‌ازای هر صفحه
- قیمت‌های `Offer` از همان پلن‌هایی می‌آیند که کاربر می‌بیند (تومان → ریال)
- `sitemap.xml` پویا: صفحاتِ ثابت + مقاله‌ها + صفحه‌های ساخته‌شده در استودیو

⚠️ **صفحاتِ رستوران (`/r`، `/city`، `/cuisine`) در sitemap این اپ نیستند.**
آن‌ها مالِ `apps/seo` روی دامنه‌ی خودش‌اند. اعلامِ آدرسی که این اپ سرو نمی‌کند
یعنی ۴۰۴ در sitemap.

---

## دسترسی‌پذیری و حرکت

- بدونِ کتابخانه‌ی انیمیشن؛ یک `IntersectionObserver` مشترک + CSS
- `prefers-reduced-motion` همه‌ی حرکت‌ها را خاموش می‌کند
- بدونِ جاوااسکریپت هم هیچ محتوایی پنهان نمی‌ماند (کلاسِ `js-reveal`)
- تمِ روشن/تاریک با انتخابِ صریحِ کاربر و بدونِ پرشِ تم

---

## دیپلوی

پروژه‌ی Vercelِ مستقل، `Root Directory = apps/landing`، framework = Next.js.
متغیرهای بالا را تنظیم کن و مطمئن شو دامنه در `ALLOWED_ORIGINS`ِ بک‌اند هست.

`apps/seo` پروژه‌ی Vercelِ جداگانه‌ی خودش را دارد — دو دامنه، دو sitemap.
`NEXT_PUBLIC_SITE_URL` هر اپ باید دامنه‌ی خودش باشد تا canonicalها تداخل نکنند.
