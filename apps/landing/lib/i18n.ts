// دامنه و پیکربندیِ چندزبانه‌ی وب‌سایتِ لندینگ.
//
// چرا از env می‌آید و ثابت نیست: این اپ روی دامنه‌ی خودش دیپلوی می‌شود، جدا از
// apps/seo که صفحاتِ رستوران را سرو می‌کند. هر دو canonical و sitemap مستقل
// دارند؛ اگر آدرس اینجا hardcode بود، دو اپ روی یک دامنه ادعای مالکیت می‌کردند
// و سیگنالِ متناقض به موتورِ جست‌وجو می‌رفت.
//
// در Vercel تنظیم کن: NEXT_PUBLIC_SITE_URL=https://rezervno.ir
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://rezervno.ir').replace(/\/$/, '');

/**
 * دامنه‌ی **اپِ مشتری** — همتایِ `appBase()` در `api/src/lib/public-urls.ts`.
 *
 * چرا همان نامِ متغیر (`NEXT_PUBLIC_APP_URL`) و نه یکی تازه: تا ۲۰۲۶-۰۸-۲۲
 * دقیقاً همین اشتباه در `api/` بود — کد یک متغیر می‌خواند
 * (`CUSTOMER_APP_URL`) و `.env.example` یکیِ دیگر را مستند می‌کرد
 * (`NEXT_PUBLIC_CUSTOMER_APP_URL`)، پس متغیرِ مستندشده هیچ‌وقت خوانده
 * نمی‌شد (`docs/KNOWN_LIMITATIONS.md:1878-1884`). حلِ آنجا تکیه بر یک
 * منبعِ کانونیک بود؛ اینجا همان یکی است، نه یک نامِ موازیِ تازه.
 *
 * بدونِ override همیشه از رویِ SITE ساخته می‌شود (`app.<دامنه>`) — پس دیگر
 * حالتِ «پیکربندی‌نشده» وجود ندارد و دکمه‌ی ورودِ اپِ مشتری هرگز به فرمِ
 * تماس نمی‌افتد.
 */
export function appBase(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  return SITE.replace(/^(https?:\/\/)/, '$1app.');
}

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
