/** @type {import('next').NextConfig} */
// اپِ SEO رزرونو — SSR/ISR. جزئیات در docs/adr/0001-seo-rendering-architecture.md
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // نصبِ زیرپوشه (مثلِ rezervno.local/seo) — از env می‌آید؛ خالی = ریشه.
  basePath: process.env.BASE_PATH || '',
  // دسترسی به dev server از طریقِ دامنه‌ی محلی (برعکسِ localhost).
  allowedDevOrigins: ['rezervno.local'],
};
