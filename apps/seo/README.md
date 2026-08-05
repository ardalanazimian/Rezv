# apps/seo — لایه‌ی عمومیِ SEO رزرونو (Next.js SSR/ISR)

> اپِ **جداگانه و ایزوله** برای صفحاتِ عمومیِ ایندکس‌پذیر (رستوران/شهر/آشپزی).
> اپ‌های `customer`/`business`/`company` دست‌نخورده و static می‌مانند.
> مبنا: [`docs/adr/0001-seo-rendering-architecture.md`](../../docs/adr/0001-seo-rendering-architecture.md)
> و [`SEO_AUDIT_REPORT.md`](../../SEO_AUDIT_REPORT.md).

## چرا جدا
این تنها فرانتِ رزرونو است که **build step** دارد (Next.js). SSR/ISR + URLهای per-entity
برای رقابتِ SEO لازم‌اند و در معماریِ static/no-buildِ بقیه‌ی اپ‌ها ممکن نیستند. جداسازی
یعنی خرابیِ اینجا به اپ‌های زنده آسیب نمی‌زند.

## اجرا (محلی)
```bash
cd apps/seo
npm install
SEO_API_BASE=http://localhost:3000 npm run dev   # http://localhost:3100
npm run build && npm start                        # تولید
```

## پیکربندی
- `SEO_API_BASE` — آدرسِ پایه‌ی `api/` رزرونو (مثلِ `https://api.rezervno.ir`)، بدونِ اسلشِ انتهایی.
  اگر تنظیم نشود، صفحات به‌جای داده، حالتِ خالی/۴۰۴ می‌دهند (build همچنان سبز است).

## دیپلوی
یک **پروژه‌ی Vercelِ مستقل**، Root Directory = `apps/seo`، framework = Next.js
(`vercel.json`). صفحاتِ SEO روی دامنه‌ی اصلی از طریقِ Vercel rewrites سرو می‌شوند
(routing نهایی در فازِ P4/P5 قطعی می‌شود).

## وضعیت
- ✅ اسکلت (این PR): layout، صفحه‌ی اصلیِ استاتیک، کلاینتِ API (`lib/api.ts`)، CI (build/typecheck).
- ⏳ بعدی: `/r/{slug}` با SSR/ISR + schema (P4) → `/city/{c}`، `/cuisine/{c}` (P5) → sitemap پویا (P6).
