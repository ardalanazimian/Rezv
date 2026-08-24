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

/**
 * دامنه‌ی **اپِ مشتری** — جدا از `siteBase()`.
 *
 * چرا جدا: طبقِ `deploy/caddy/Caddyfile` دامنه‌ی اصلی (`{$DOMAIN}`) وب‌سایتِ
 * عمومیِ روی Vercel است و اپِ مشتری روی زیردامنه‌ی `app.` سرو می‌شود. QRِ
 * check-inِ میز باید در **اپ** باز شود، نه در سایتِ مارکتینگ — وگرنه مهمان
 * صفحه‌ای می‌بیند که اصلاً کدِ ورود را نمی‌شناسد.
 */
export function appBase(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  // پیش‌فرض از روی siteBase ساخته می‌شود تا در staging هم خودبه‌خود درست
  // بیفتد؛ اگر ساختارِ دامنه فرق داشت، متغیرِ صریح بالا حرفِ آخر را می‌زند.
  return siteBase().replace(/^(https?:\/\/)/, '$1app.');
}

/**
 * آدرسی که داخلِ QRِ روی میز می‌رود.
 *
 * ⚠️ کدِ میز در **query string** است نه در مسیر: اپِ مشتری یک صفحه‌ی HTMLِ
 * تک‌فایلی بدونِ routingِ سمتِ سرور است (رجوع به `docs/FRONTEND.md` §۲)، پس
 * مسیرِ `/checkin/CODE` روی سرورِ استاتیک ۴۰۴ می‌دهد. با query، همان
 * `index.html` بالا می‌آید و اپ خودش پارامتر را می‌خواند.
 */
export function tableCheckInUrl(qrCode: string): string {
  return `${appBase()}/?checkin=${encodeURIComponent(qrCode)}`;
}
