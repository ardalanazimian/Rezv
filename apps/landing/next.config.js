/** @type {import('next').NextConfig} */
// وب‌سایتِ عمومیِ رزرونو — SSR/ISR. جزئیات در docs/adr/0001-seo-rendering-architecture.md
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // نصبِ زیرپوشه (مثلِ rezervno.local/landing) — از env می‌آید؛ خالی = ریشه.
  basePath: process.env.BASE_PATH || '',
  // دسترسی به dev server از طریقِ دامنه‌ی محلی (برعکسِ localhost).
  allowedDevOrigins: ['rezervno.local'],

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
