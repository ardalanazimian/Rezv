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
    // ⚠️ دو sitemap، عمدی (۲۰۲۶-۰۹-۰۸، تصمیمِ D-004):
    //   • `/sitemap.xml`             — صفحاتِ همین اپ (CMS، بلاگ، قیمت، …)
    //   • `/sitemap-restaurants.xml` — از `apps/seo` می‌آید و با rewriteِ
    //     next.config.js زیرِ همین میزبان سرو می‌شود. بدونِ اعلامش، صفحاتِ
    //     `/r/*` و `/city/*` خزیدنی‌اند ولی هیچ‌وقت به موتور معرفی نمی‌شوند.
    // هر دو باید روی **همین** میزبان باشند؛ دستورِ Sitemap که به میزبانِ
    // دیگری اشاره کند نادیده گرفته می‌شود — همان چیزی که در
    // `apps/customer/robots.txt` غلط بود و همان روز رفع شد.
    sitemap: [`${SITE}/sitemap.xml`, `${SITE}/sitemap-restaurants.xml`],
    host: SITE,
  };
}
