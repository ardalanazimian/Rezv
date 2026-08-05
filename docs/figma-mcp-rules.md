# قواعدِ یکپارچه‌سازیِ Figma با کدبیسِ رزرونو

سندِ مرجع برای وقتی طرحی از Figma (از راهِ Figma MCP) به کد تبدیل می‌شود.
هدف: خروجی از روزِ اول با معماریِ موجود بخواند، نه اینکه بعداً بازنویسی شود.

> ⚠️ **مهم‌ترین نکته‌ی این سند:** رزرونو **یک** دیزاین‌سیستم ندارد، **دو** تا
> دارد که موازی‌اند و به‌هم sync نمی‌شوند. پیش از هر کاری بخشِ ۰ را بخوان.

---

## ۰) اول این را بدان: دو دنیای جدا

| | دنیای A — پنل‌ها | دنیای B — وب‌سایت |
|---|---|---|
| اپ‌ها | `apps/customer` · `apps/business` · `apps/company` | `apps/seo` |
| فناوری | HTML + CSS + JS خام | Next.js 16 + React 18 + TypeScript |
| مرحله‌ی build | **ندارد** — فایل مستقیم سرو می‌شود | دارد (Turbopack) |
| منبعِ توکن | `shared/css/tokens.css` | `apps/seo/app/globals.css` |
| توزیعِ توکن | `tools/sync-design-system.sh` کپی می‌کند | کپی نمی‌شود — مستقل است |
| آیکن | `shared/js/icons.js` (رشته‌ی SVG) | `components/site/Icon.tsx` (React) |

**هر دو نامِ توکنِ یکسان دارند** (`--sp-4`, `--radius-md`, `--brand-500`) ولی در
دو فایلِ جدا تعریف شده‌اند. تغییرِ یکی روی دیگری اثر ندارد.

پیش از تولیدِ کد از Figma، اول تعیین کن مقصد کدام دنیاست. اگر طرح برای صفحه‌ی
بازاریابی/محتوایی است → دنیای B. اگر برای پنلِ عملیاتی است → دنیای A.

---

## ۱) توکن‌های طراحی

### فرمت

CSS Custom Properties خام. **هیچ‌کدام از اینها در پروژه نیست:** فایلِ JSON توکن،
Style Dictionary، Tailwind config، Theme object در JS، یا هر خطِ لوله‌ی تبدیل.

پس **خروجیِ توکنِ Figma را به JSON ندهید** — باید به CSS custom property تبدیل شود.

### معماریِ دولایه (در هر دو دنیا یکسان)

`shared/css/tokens.css:1-8` این قرارداد را صریح گفته:

```css
/*  ۱) Primitive  — مقادیرِ خام (رنگ، اندازه). هیچ‌جا مستقیم استفاده نکن.
    ۲) Semantic   — نقش‌ها (bg, text, brand, danger...). فقط این‌ها را استفاده کن. */
```

**قاعده: در کامپوننت هرگز توکنِ Primitive ننویس.** فقط Semantic.
Primitive فقط ورودیِ لایه‌ی Semantic است.

### مقیاس‌های موجود (`shared/css/tokens.css`)

```css
/* تایپوگرافی — ۹ پله */
--fs-2xs: 11px; --fs-xs: 12px; --fs-sm: 13px; --fs-md: 14px;  /* بدنه */
--fs-lg: 16px; --fs-xl: 20px; --fs-2xl: 24px; --fs-3xl: 32px; --fs-4xl: 40px;

/* فاصله — شبکه‌ی ۴px */
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
--sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;

/* شعاع */
--radius-xs: 8px … --radius-2xl: 28px; --radius-full: 9999px;

/* حرکت — یک سیستمِ زمانیِ واحد */
--motion-fast: 130ms; --motion-base: 200ms; --motion-slow: 320ms;
--ease-out: cubic-bezier(.4,0,.2,1);
--ease-spring: cubic-bezier(.34,1.56,.64,1);

/* Elevation — ۵ سطح، دولایه‌ای */
--elevation-1 … --elevation-5;  /* نام‌های مستعار: --sh-sm/md/lg/xl */

/* z-index — نردبانِ معنایی، عدد خام ننویس */
--z-dropdown: 100; --z-sticky: 200; --z-drawer: 300;
--z-overlay: 400; --z-modal: 500; --z-toast: 600; --z-tooltip: 700;
```

**اگر Figma عددی داد که در مقیاس نیست** (مثلاً `padding: 18px`)، به نزدیک‌ترین
پله گرد کن (`--sp-4` یا `--sp-5`). توکنِ تازه فقط وقتی بساز که نقشِ واقعاً
جدیدی وجود داشته باشد — نه برای یک مقدارِ یک‌بارمصرف.

### لایه‌ی سازگاری: `shared/css/ds-bridge.css`

توکن‌های قدیمیِ هر اپ (`--r-sm`, `--t`, `--blue`) به توکن‌های DS نگاشت شده‌اند:

```css
--r-md: var(--radius-md);
--t:    var(--motion-base);
--blue: var(--brand-500);
```

**در کدِ جدید از نام‌های قدیمی استفاده نکن.** فقط برای زنده‌نگه‌داشتنِ markupِ
قدیمی هستند.

⚠️ سایه (`--sh-*`) عمداً در bridge نگاشت **نشده** — کامنتِ خودِ فایل توضیح
می‌دهد که نگاشتِ سراسری، سایه را در دارک‌مود نامرئی می‌کرد. دست نزن.

### تم در دنیای B (`apps/seo/app/globals.css:89-240`)

سه لایه، با این اولویت:

```css
:root, :root[data-theme='light'] { /* پیش‌فرض */ }
:root[data-theme='dark']         { /* انتخابِ صریحِ کاربر */ }
@media (prefers-color-scheme: dark) { /* فقط اگر data-theme ست نشده باشد */ }
```

انتخابِ کاربر همیشه بر ترجیحِ سیستم غالب است. طرحِ Figma برای هر دو تم باید
توکنِ Semantic بدهد، نه رنگِ خام.

---

## ۲) کتابخانه‌ی کامپوننت

### دنیای B — React (`apps/seo/components/`)

```
site/       Header · Footer · Icon · Motion · ThemeToggle · JsonLd
            AnnounceBanner · FaqAccordion
sections/   Blocks · Visuals · ShowcaseTabs
pricing/    PlanCards · PurchaseDialog
forms/      TrialForm · ContactForm
order/      OrderLookup
studio/     Studio · RecordEditor · fields.ts
```

الگو: کامپوننتِ تابعی، بدونِ کلاس، بدونِ HOC. `'use client'` فقط وقتی تعامل
لازم است — بقیه Server Component می‌مانند.

**موتورِ رندرِ محتوا (`components/sections/Blocks.tsx`)** — مهم‌ترین الگوی
معماری: صفحه‌ها آرایه‌ای از «بلوک» از CMS می‌گیرند:

```
hero · metrics · apps · features · split · steps · comparison
showcase · pricing · testimonials · faq · cta · prose · legal
```

بلوکِ ناشناخته **بی‌صدا رد می‌شود** تا افزودنِ نوعِ تازه صفحه‌ی زنده را نشکند.

> اگر Figma یک بخشِ صفحه‌ی جدید داد، معمولاً پاسخِ درست **نوعِ بلوکِ تازه در
> `Blocks.tsx`** است، نه صفحه‌ی جدید. صفحه‌ها ۵ خط‌اند و محتوا از دیتابیس می‌آید.

### دنیای A — بدونِ فریم‌ورک

هیچ‌کدام از `apps/customer|business|company` فایلِ `package.json` ندارند. رندر
با دستکاریِ مستقیمِ DOM و رشته‌ی HTML انجام می‌شود. کامپوننتِ قابلِ‌استفاده‌ی
مجدد = **کلاسِ CSS**، نه ماژول.

### مستندات

**Storybook وجود ندارد.** نزدیک‌ترین چیز: `design-preview/*.html` — صفحاتِ
HTMLِ مستقلِ اکتشافی. اینها **منبعِ حقیقت نیستند** و از دیزاین‌سیستم عقب‌اند؛
برای الگوبرداری به آنها استناد نکن.

---

## ۳) فریم‌ورک‌ها و کتابخانه‌ها

وابستگی‌های زمانِ اجرای `apps/seo` **دقیقاً سه تاست**:

```json
{ "next": "^16.2.12", "react": "^18.3.0", "react-dom": "^18.3.0" }
```

**هیچ‌کدام در پروژه نیست و اضافه هم نکن:** Tailwind، styled-components، Emotion،
CSS Modules، MUI/Chakra/shadcn، Framer Motion، clsx، date-fns، آیکن‌پکِ npm.

| نیاز | راهِ پروژه |
|---|---|
| انیمیشن | یک `IntersectionObserver` مشترک در `components/site/Motion.tsx` |
| آیکن | SVGِ درون‌خطی (بخشِ ۵) |
| تاریخ/عدد | `Intl` بومی در `lib/format.ts` (`fa-IR-u-ca-persian`) |
| کلاسِ شرطی | تمپلیت‌لیترالِ ساده |
| اعتبارسنجی | لایه‌ی خودیِ `api/src/lib/validate.ts` |

اگر خروجیِ Figma کتابخانه پیشنهاد داد، **نصبش نکن** — با ابزارِ موجود بساز.

---

## ۴) مدیریتِ دارایی

- کلِ `apps/seo/public/` فقط **یک فایل** دارد: `icon.svg`
- **هیچ فایلِ تصویری در مخزن نیست** — هرچه دیده می‌شود SVG/CSS تولیدشده است
- تصویرِ اشتراک‌گذاری در **زمانِ اجرا** ساخته می‌شود: `app/opengraph-image.tsx`
- **CDN تنظیم نشده**

اگر Figma تصویرِ راستر (PNG/JPG) صادر کرد، **اول بپرس**: الگوی پروژه ساختنِ
تصویرسازی با SVG/CSS است — `components/sections/Visuals.tsx` نه پنلِ محصولی را
این‌طور می‌سازد. افزودنِ باینری به مخزن یک تصمیمِ آگاهانه لازم دارد.

⚠️ فونتِ OG: `lib/og-font.ts` عمداً با `User-Agent`ِ قدیمی از گوگل TTF می‌گیرد،
چون satori نمی‌تواند woff2 بخواند و فونتِ پیش‌فرضش فارسی را shape نمی‌کند
(کلِ build را می‌شکست). دست نزن.

---

## ۵) سیستمِ آیکن

دو رجیستریِ موازی، **هر دو با یک قرارداد**: `viewBox="0 0 24 24"`،
`stroke-width: 1.5`، `stroke="currentColor"`، `fill="none"`.

### دنیای A — `shared/js/icons.js` (۵۸ آیکن)

```js
const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  menu:   '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
el.innerHTML = icon('search', { size: 20, class: 'nav-ic' });
```

مقدار = **رشته‌ی کاملِ عناصرِ داخلی** (می‌تواند چند تگ باشد).

### دنیای B — `apps/seo/components/site/Icon.tsx` (۴۴ آیکن)

```tsx
const PATHS: Record<string, string> = {
  check: 'M20 6 9 17l-5-5',
  moon:  'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
};
<Icon name="check" size={18} />
```

مقدار = **فقط دیتای `d`** برای یک `<path>`.

> ⚠️ فرمتِ مقدار بینِ دو رجیستری فرق دارد. آیکن را کپی‌پیست نکن؛ تبدیل کن.

### قواعد

- نام‌گذاری **camelCase** و معنایی: `calendarOff`, `checkCircle`, `arrowLeft`
- نامِ ناشناخته → آیکنِ خنثی، نه crash (چون نامِ آیکن از CMS می‌آید)
- بدونِ فونتِ آیکن و بدونِ درخواستِ شبکه — «مربعِ خالی» هرگز دیده نمی‌شود
- آیکنِ تازه: اول در رجیستری ثبت کن، بعد استفاده. SVGِ درون‌خطیِ یک‌بارمصرف نه

---

## ۶) روشِ استایل‌دهی

### CSS سراسریِ خام + نام‌گذاریِ BEM-گونه

بدونِ CSS Modules، بدونِ CSS-in-JS. کلاس‌ها سراسری‌اند:

```css
.btn  .btn--primary  .btn--ghost  .btn--sm  .btn--block
.site-nav__link      .mega__item        .plan--featured
```

`element__part--modifier`.

### ترتیبِ لود — اهمیت دارد

دنیای A (`apps/company/index.html`):

```html
<link rel="stylesheet" href="css/tokens.css">     <!-- ۱ توکن -->
<link rel="stylesheet" href="css/theme.css">      <!-- ۲ تمِ خاصِ اپ -->
<link rel="stylesheet" href="css/foundation.css"> <!-- ۳ کامپوننتِ پایه -->
<link rel="stylesheet" href="css/panel.css">      <!-- ۴ استایلِ اپ -->
<link rel="stylesheet" href="css/ds-bridge.css">  <!-- ۵ اصلاحِ واگرایی — آخر -->
```

دنیای B (`apps/seo/app/layout.tsx`): `globals.css` سپس `site.css`.

### واکنش‌گرایی

⚠️ **واگراییِ واقعی:** توکن‌ها `--bp-sm:640 / md:768 / lg:1024 / xl:1280` را اعلام
می‌کنند، ولی media queryهای واقعی این‌ها هستند:

| breakpoint | تعداد استفاده |
|---|---|
| 940px | ۶ |
| 640px | ۳ |
| 900px | ۲ |
| 860px | ۲ |
| 720px | ۲ |

یعنی جز `640px` بقیه‌ی توکن‌ها عملاً استفاده نمی‌شوند. **از breakpointهای واقعیِ
همان فایل پیروی کن**، نه از مقیاسِ توکن. اگر Figma فقط طرحِ دسکتاپ و موبایل داد،
`940px` مرزِ رایجِ این پروژه است.

### RTL — سخت‌گیرانه

```tsx
<html lang="fa" dir="rtl" …>
```

**دیزاین‌سیستم و وب‌سایت کاملاً پاک‌اند** — صفر موردِ `left:`/`right:`:

| فایل | موردِ فیزیکی |
|---|---|
| `shared/css/tokens.css` | ۰ |
| `shared/css/foundation.css` | ۰ |
| `shared/css/ds-bridge.css` | ۰ |
| `apps/seo/app/globals.css` | ۰ |
| `apps/seo/app/site.css` | ۰ |

ولی CSSِ قدیمیِ خودِ پنل‌ها هنوز پاک نشده — بدهیِ فنیِ موجود:

| فایل | موردِ فیزیکی |
|---|---|
| `apps/customer/css/app.css` | ۲۴ |
| `apps/business/css/panel.css` | ۱۹ |
| `apps/company/css/panel.css` | ۵ |

**در کدِ تازه از اینها الگو نگیر.** معیار، فایل‌های پاکِ جدولِ اول است:

```css
inset-inline-start   margin-inline   padding-inline-start   border-inline-start
```

> Figma چیدمان را LTR فکر می‌کند. هر `left`/`right`ی که تولید کرد **باید** به
> معادلِ `inline-start`/`inline-end` تبدیل شود. این قابلِ‌مذاکره نیست — یک
> `left: 0` کلِ چیدمانِ راست‌چین را می‌شکند.

استثنا: شماره‌ی موبایل عمداً چپ‌چین می‌ماند (`globals.css:667`).

### حرکت

- بدونِ کتابخانه؛ یک `IntersectionObserver` مشترک + کلاسِ CSS
- کلاسِ `js-reveal` روی `<html>` توسطِ اسکریپتِ پیش از رنگ‌آمیزی ست می‌شود، پس
  **بدونِ جاوااسکریپت هیچ محتوایی پنهان نمی‌ماند**
- `prefers-reduced-motion` یک‌بار به‌صورتِ سراسری در `tokens.css` احترام گذاشته
  شده — در کامپوننت تکرارش نکن

### دسترسی‌پذیری (در `foundation.css`)

`.skip-link` · `.sr-only` · focus-ring یکدست روی `:focus-visible` ·
`--touch-min: 44px`.

---

## ۷) ساختارِ پروژه

```
shared/                 منبعِ حقیقتِ دنیای A
  css/tokens.css        توکن‌های Primitive + Semantic
  css/foundation.css    کامپوننت‌های پایه و یوتیلیتی
  css/ds-bridge.css     نگاشتِ توکنِ قدیمی → DS (آخر لود می‌شود)
  js/icons.js           ۵۸ آیکن
  content/site-content.json   محتوای پیش‌فرضِ وب‌سایت

apps/
  customer|business|company/   HTML+CSS+JS خام، بدونِ build
    css/{tokens,theme,foundation,panel,ds-bridge}.css   ← کپیِ خودکار
  seo/                         Next.js — وب‌سایتِ عمومی
    app/        مسیرها (App Router) + globals.css + site.css
    components/ بخشِ ۲
    lib/        seo · site-schema · markdown · format · api

api/            بک‌اند Next.js (App Router) + Prisma
deploy/caddy/   ریورس‌پراکسی و HTTPS
docs/adr/       تصمیم‌های معماری
tools/sync-design-system.sh
```

### دستورِ اجباری پس از هر تغییر در `shared/`

```sh
sh tools/sync-design-system.sh          # کپی به سه اپ
sh tools/sync-design-system.sh --check  # CI: صفر واگرایی، وگرنه exit 1
```

**هرگز `apps/*/css/tokens.css` را مستقیم ویرایش نکن** — با اجرای بعدیِ اسکریپت
بازنویسی می‌شود. منبع `shared/` است.

---

## چک‌لیستِ پیش از تحویلِ کدِ تولیدشده از Figma

- [ ] مقصد مشخص شد: دنیای A یا B؟
- [ ] هیچ مقدارِ خامی نمانده — همه توکنِ **Semantic**
- [ ] هیچ `left:`/`right:`ی نمانده — همه `inline-start`/`inline-end`
- [ ] هیچ وابستگیِ npmِ تازه‌ای اضافه نشده
- [ ] آیکن‌ها در رجیستری ثبت شده‌اند، نه درون‌خطی
- [ ] هر دو تمِ روشن و تاریک بررسی شد
- [ ] breakpointها با فایلِ مقصد می‌خوانند (نه با توکن‌های بی‌استفاده)
- [ ] اگر `shared/` تغییر کرد: `sync-design-system.sh` اجرا شد
- [ ] `npm run typecheck` و `npm run lint` تمیزند
