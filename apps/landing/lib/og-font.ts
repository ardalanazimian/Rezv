// ═══════════════════════════════════════════════════════════════════════
//  فونتِ فارسی برای تصویرِ اشتراک‌گذاری (next/og)
//
//  مسئله: موتورِ رندرِ next/og با فونتِ پیش‌فرضِ لاتین نمی‌تواند متنِ فارسی را
//  شکل‌دهی کند (خطای shaping) و کلِ تولیدِ تصویر شکست می‌خورد.
//
//  راه‌حل: Vazirmatn را در زمانِ اجرا از Google Fonts می‌گیریم. با User-Agentِ
//  قدیمی، گوگل نسخه‌ی TTF می‌دهد (نه woff2) که تنها قالبِ قابل‌قبولِ این موتور است.
//  نتیجه یک‌بار در حافظه‌ی پروسه کش می‌شود.
//
//  اگر شبکه در دسترس نبود، null برمی‌گردد و فراخوان به نسخه‌ی لاتینِ کارت
//  برمی‌گردد — تصویرِ اشتراک‌گذاری هرگز نباید باعثِ خطای صفحه شود.
// ═══════════════════════════════════════════════════════════════════════

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@700&display=swap';
// UAی قدیمی → گوگل به‌جای woff2، TTF می‌دهد.
const LEGACY_UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0)';

let cached: Promise<ArrayBuffer | null> | null = null;

async function download(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(CSS_URL, {
      headers: { 'User-Agent': LEGACY_UA },
      next: { revalidate: 86_400 },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = /src:\s*url\((https:[^)]+)\)/.exec(css);
    if (!match) return null;

    const fontRes = await fetch(match[1], { next: { revalidate: 86_400 } });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/** بافرِ فونتِ فارسی، یا null اگر در دسترس نبود. */
export function persianFont(): Promise<ArrayBuffer | null> {
  if (!cached) cached = download();
  return cached;
}
