import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/i18n';

// robots.txt وب‌سایتِ عمومی.
//
// مسیرهای بسته عمداً کوتاه‌اند: استودیو (پشتِ احرازِ هویت، محتوای ایندکس‌پذیر
// ندارد) و صفحه‌ی پیگیریِ سفارش (خصوصیِ همان کاربر است). بقیه‌ی سایت باز است.
// همان مسیرها متاتگِ noindex هم دارند تا سیگنال یکدست باشد.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/studio', '/studio/', '/order/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
