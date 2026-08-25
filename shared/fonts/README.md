# فونت‌های رزرونو

منبعِ واحد. `tools/sync-design-system.sh` این پوشه را به
`apps/{customer,business,company}/fonts/` کپی می‌کند، و
`tools/build-standalone.py` فایل را برایِ بسته‌ی آفلاین **base64** می‌کند.

---

## وضعیتِ فعلی

| فونت | وضعیت | مجوز |
|---|---|---|
| **Vazirmatn** | ✅ در مخزن — `vazirmatn-variable.woff2` (۱۰۸KB، وزنِ ۱۰۰..۹۰۰) | SIL OFL 1.1 (`Vazirmatn-OFL.txt`) |
| **Piyade / پیاده** | ❌ **در مخزن نیست** | تجاری — نیازِ خرید |

## چرا Piyade این‌جا نیست

Piyade یک فونتِ **تجاری** است. فایل‌هایش نه در npm هست، نه در هیچ منبعِ آزادِ
قابلِ توزیع. بدونِ فایلِ دارایِ مجوز، قرار دادنش در مخزن هم غیرقانونی است و هم
غیرممکن.

**کاری که به‌جایش شد:** نامِ `'Piyade'` در ابتدایِ `--font-ui` قرار دارد
(`shared/css/fonts.css`) ولی برایش `@font-face` اعلام **نشده**. یعنی:

- **امروز:** مرورگر Piyade را پیدا نمی‌کند و بی‌صدا به Vazirmatn می‌افتد.
  هیچ ۴۰۴ی، هیچ پرشِ چیدمانی، هیچ ادعایِ نادرستی.
- **بعد از خرید:** فایل‌ها را این‌جا بگذارید و بلوکِ زیر را به
  `shared/css/fonts.css` اضافه کنید. Piyade **بدونِ هیچ تغییرِ دیگری** فعال
  می‌شود، چون پشته از قبل آماده است.

عمداً یک `@font-face`ِ اشاره‌کننده به فایلِ ناموجود اعلام نشد: در هر بارگذاری
۴۰۴ می‌داد و بدتر، در کد این‌طور به‌نظر می‌رسید که «فونت وصل است».

---

## فعال‌سازیِ Piyade (وقتی فایل‌ها را داشتید)

### ۱. فایل‌ها را این‌جا بگذارید

اگر **variable** است (یک فایل، همه‌ی وزن‌ها) — ترجیح داده می‌شود:

```
shared/fonts/piyade-variable.woff2
```

```css
@font-face {
  font-family: 'Piyade';
  src: url('../fonts/piyade-variable.woff2') format('woff2-variations'),
       url('../fonts/piyade-variable.woff2') format('woff2');
  font-weight: 100 900;      /* ← با بازه‌ی واقعیِ فونتِ خودتان تنظیم کنید */
  font-style: normal;
  font-display: swap;
}
```

اگر **استاتیک** است، فقط وزن‌هایی را اعلام کنید که **واقعاً فایل دارند**:

```
shared/fonts/piyade-regular.woff2      → 400
shared/fonts/piyade-medium.woff2       → 500
shared/fonts/piyade-semibold.woff2     → 600
shared/fonts/piyade-bold.woff2         → 700
```

```css
@font-face { font-family:'Piyade'; src:url('../fonts/piyade-regular.woff2')  format('woff2'); font-weight:400; font-style:normal; font-display:swap; }
@font-face { font-family:'Piyade'; src:url('../fonts/piyade-medium.woff2')   format('woff2'); font-weight:500; font-style:normal; font-display:swap; }
@font-face { font-family:'Piyade'; src:url('../fonts/piyade-semibold.woff2') format('woff2'); font-weight:600; font-style:normal; font-display:swap; }
@font-face { font-family:'Piyade'; src:url('../fonts/piyade-bold.woff2')     format('woff2'); font-weight:700; font-style:normal; font-display:swap; }
```

> ⚠️ **وزنی را اعلام نکنید که فایل ندارد.** مرورگر آن وزن را با کشیدنِ مصنوعیِ
> گلیف (synthetic bold) جعل می‌کند و نتیجه در فارسی زشت و ناخوانا می‌شود.
> اگر فونت فقط Regular و Bold دارد، فقط ۴۰۰ و ۷۰۰ را اعلام کنید؛ توکن‌های
> ۵۰۰/۶۰۰ خودشان به نزدیک‌ترین وزنِ موجود می‌افتند.

### ۲. دو دستور را اجرا کنید

```sh
sh tools/sync-design-system.sh     # کپی به هر سه اپ
python tools/build-standalone.py   # base64 برایِ بسته‌ی آفلاین
```

### ۳. راستی‌آزمایی

```sh
python tools/check-fonts.py
```

باید بگوید فایل در هر سه اپ هست و در هر سه `standalone/*.html` جاسازی شده.

---

## `apps/landing` و `apps/seo` جدا هستند

آن دو Next.js‌اند و از `next/font/google` استفاده می‌کنند که در **زمانِ build**
فونت را دانلود و self-host می‌کند (خروجی در `.next/static/media/*.woff2`).
پس آن‌ها از قبل به CDNِ زمانِ اجرا وابسته نبودند و این پوشه را لازم ندارند.

برایِ Piyade در آن دو اپ، `next/font/local` مسیرِ درست است:

```ts
import localFont from 'next/font/local';
const piyade = localFont({
  src: '../public/fonts/piyade-variable.woff2',
  variable: '--font-piyade',
  display: 'swap',
});
```
