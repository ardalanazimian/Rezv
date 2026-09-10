/** @type {import('next').NextConfig} */
// وب‌سایتِ عمومیِ رزرونو — SSR/ISR. جزئیات در docs/adr/0001-seo-rendering-architecture.md

// ═══════════════════════════════════════════════════════════════════════
//  ناحیه‌ی SEO (Next Multi-Zones) — چرا این rewrite وجود دارد
//
//  از تصمیمِ D-004 (۲۰۲۶-۰۹-۰۸) apex به همین اپ رسید. ولی صفحاتِ رستوران
//  (`/r/<slug>`, `/r/<slug>/menu`, `/city/*`, `/cuisine/*`) در `apps/seo`
//  زندگی می‌کنند، نه اینجا.
//
//  ⚠️ این یک بهبودِ SEO نیست، یک مسیرِ شکسته‌ی چاپ‌شده است:
//  `api/src/lib/public-urls.ts:27` تابعِ `publicMenuUrl()` آدرسِ
//  `${siteBase()}/r/<slug>/menu` را می‌سازد و کامنتش می‌گوید «همان آدرسی که
//  داخلِ QR می‌رود». پنلِ بیزنس (`apps/business/js/menu.js:128-168`) همان را
//  در کارتِ «منویِ عمومی و QR» به رستوران می‌دهد تا **چاپش کند**. بدونِ این
//  rewrite آن مسیر سه‌سگمنتی است و catch-allِ لندینگ یک‌سگمنتی — یعنی هر
//  QRی که تا امروز روی میزها چاپ شده به ۴۰۴ می‌خورد.
//
//  چرا زیرپوشه و نه زیردامنه: تصمیمِ ازپیش‌گرفته‌شده و مستند در
//  `apps/seo/lib/urls.ts:31` — زیردامنه DNS و گواهیِ جدا می‌خواهد و یک
//  میزبانِ دومِ ایندکس‌پذیر می‌سازد که باید با canonical مهار شود.
//
//  ⚠️ بدونِ fallbackِ بی‌صدا. اگر `SEO_ZONE_URL` در production نباشد build
//  می‌شکند. درسِ همین امروز: `NEXT_PUBLIC_CUSTOMER_APP_URL` تنظیم نشده بود و
//  کد بی‌صدا به `/contact` می‌افتاد، پس دکمه خراب به‌نظر نمی‌رسید. یک مسیرِ
//  ۴۰۴ صادق‌تر از یک تغییرِ مسیرِ اشتباه است — ولی بهترین حالت این است که
//  اصلاً منتشر نشود.
// ═══════════════════════════════════════════════════════════════════════
const SEO_ZONE_URL = (process.env.SEO_ZONE_URL || '').replace(/\/$/, '');
if (process.env.NODE_ENV === 'production' && !SEO_ZONE_URL) {
  throw new Error(
    'SEO_ZONE_URL تنظیم نشده است. صفحاتِ /r/*, /city/*, /cuisine/* از apps/seo ' +
      'سرو می‌شوند و بدونِ این متغیر آدرسِ داخلِ QRهای چاپ‌شده ۴۰۴ می‌دهد. ' +
      'مقدارش آدرسِ deploymentِ apps/seo است.',
  );
}

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,

  async rewrites() {
    // در dev بدونِ متغیر، rewrite نمی‌گذاریم تا `next dev` بدونِ ناحیه‌ی دوم
    // هم بالا بیاید. در production بالاتر throw شده، پس اینجا همیشه مقدار دارد.
    if (!SEO_ZONE_URL) return [];
    return [
      { source: '/r/:path*', destination: `${SEO_ZONE_URL}/r/:path*` },
      { source: '/city/:path*', destination: `${SEO_ZONE_URL}/city/:path*` },
      { source: '/cuisine/:path*', destination: `${SEO_ZONE_URL}/cuisine/:path*` },
      // sitemapِ رستوران‌ها باید از apex قابلِ دسترسی باشد وگرنه آدرس‌ها
      // خزیدنی‌اند ولی هرگز اعلام نمی‌شوند. robots.ts لندینگ به این اشاره می‌کند.
      { source: '/sitemap-restaurants.xml', destination: `${SEO_ZONE_URL}/sitemap.xml` },
    ];
  },

  images: {
    // AVIF اول: برای عکسِ غذا و فضا معمولاً ۲۰–۳۰٪ کوچک‌تر از WebP است و
    // مرورگرهایی که پشتیبانی نمی‌کنند خودکار به WebP می‌افتند.
    formats: ['image/avif', 'image/webp'],
    // نقاط شکست هم‌راستا با نقاط شکستِ چیدمانِ خودِ سایت. پیش‌فرضِ Next
    // مقادیری دارد که هیچ‌کدام با گریدِ ما منطبق نیست و باعث می‌شود مرورگر
    // تصویری بزرگ‌تر از لازم بگیرد.
    deviceSizes: [390, 640, 828, 1080, 1366, 1920, 2560],
    imageSizes: [96, 160, 256, 384, 512],
    // یک سال کش: نامِ فایلِ آپلودشده UUID است و هرگز عوض نمی‌شود.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      // عکس‌هایی که رستوران‌ها آپلود می‌کنند از همین مسیرِ API سرو می‌شوند.
      // بدونِ این، next/image آن‌ها را رد می‌کند.
      { protocol: 'https', hostname: 'api.rezervno.ir', pathname: '/api/v1/media/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/api/v1/media/**' },
    ],
    // SVG هرگز از مسیرِ بهینه‌سازی رد نمی‌شود (پیش‌فرضِ Next هم همین است، ولی
    // صریح نوشته می‌شود چون همان دلیلِ امنیتیِ آپلودِ گالری را دارد: SVG
    // می‌تواند اسکریپت داشته باشد).
    dangerouslyAllowSVG: false,
  },
};
