// دامنه و پیکربندیِ چندزبانه‌ی وب‌سایتِ لندینگ.
//
// چرا از env می‌آید و ثابت نیست: این اپ روی دامنه‌ی خودش دیپلوی می‌شود، جدا از
// apps/seo که صفحاتِ رستوران را سرو می‌کند. هر دو canonical و sitemap مستقل
// دارند؛ اگر آدرس اینجا hardcode بود، دو اپ روی یک دامنه ادعای مالکیت می‌کردند
// و سیگنالِ متناقض به موتورِ جست‌وجو می‌رفت.
//
// در Vercel تنظیم کن: NEXT_PUBLIC_SITE_URL=https://rezervno.ir
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rezervno.ir').replace(/\/$/, '');

// برای افزودنِ زبان: یک ردیف اضافه کن، مثلاً { code: 'en', prefix: '/en' }.
// prefix خالی = زبانِ پیش‌فرض روی ریشه‌ی مسیر.
export const LOCALES: { code: string; prefix: string }[] = [
  { code: 'fa-IR', prefix: '' },
];
export const DEFAULT_LOCALE = 'fa-IR';

/**
 * alternates متادیتای Next برای یک مسیر (canonical + languages/hreflang).
 * path باید با «/» شروع شود (مثلاً '/pricing').
 */
export function alternates(path: string): { canonical: string; languages: Record<string, string> } {
  const canonical = `${SITE}${path}`;
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l.code] = `${SITE}${l.prefix}${path}`;
  languages['x-default'] = canonical;
  return { canonical, languages };
}
