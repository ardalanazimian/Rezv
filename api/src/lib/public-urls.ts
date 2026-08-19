// ═══════════════════════════════════════════════════════════════════════
//  آدرس‌هایِ عمومیِ سایت — منبعِ واحدِ سمتِ سرور.
//
//  همتایِ TypeScriptیِ `apps/seo/lib/urls.ts`. جدا بودنشان اجتناب‌ناپذیر است
//  (دو پکیجِ مستقل با tsconfig و build جدا)، ولی هر تغییری باید در هر دو
//  اعمال شود. یک تستِ واحد این هم‌خوانی را قفل می‌کند.
//
//  چرا سرور هم باید بلد باشد: QRی که پنلِ بیزنس چاپ می‌کند اینجا تولید
//  می‌شود. اگر سرور آدرسِ دیگری بسازد، QRِ روی میزها به ۴۰۴ می‌رود.
// ═══════════════════════════════════════════════════════════════════════

/**
 * دامنه‌ی عمومیِ سایت. در استقرارهایِ غیرِ تولید (staging، دموی مشتری) با
 * `NEXT_PUBLIC_SITE_URL` عوض می‌شود — وگرنه QRِ محیطِ تست به دامنه‌ی واقعی
 * اشاره می‌کند و تستِ اسکن بی‌معنا می‌شود.
 */
export function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://rezervno.ir').replace(/\/$/, '');
}

/** صفحه‌ی رستوران — canonicalِ اصلی. */
export function restaurantUrl(slug: string): string {
  return `${siteBase()}/r/${encodeURIComponent(slug)}`;
}

/** صفحه‌ی منویِ عمومی — همان آدرسی که داخلِ QR می‌رود. */
export function publicMenuUrl(slug: string): string {
  return `${siteBase()}/r/${encodeURIComponent(slug)}/menu`;
}
