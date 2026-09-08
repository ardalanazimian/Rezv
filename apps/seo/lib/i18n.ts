// پیکربندیِ چندزبانه/چندکشوری + hreflang (آمادگیِ international SEO).
// فعلاً تک‌زبانه (fa-IR)؛ ساختار طوری است که افزودنِ زبان‌های بعدی فقط یک ردیف است.
// SITE از منبعِ واحد می‌آید (lib/urls.ts) — پیش از ۲۰۲۶-۰۹-۰۸ اینجا hardcode بود.
import { SITE } from './urls';
export { SITE };

// برای افزودنِ زبان: یک ردیف اضافه کن، مثلاً { code: 'en', prefix: '/en' }.
// prefix خالی = زبانِ پیش‌فرض روی ریشه‌ی مسیر.
export const LOCALES: { code: string; prefix: string }[] = [
  { code: 'fa-IR', prefix: '' },
];
export const DEFAULT_LOCALE = 'fa-IR';

/**
 * alternates متادیتای Next برای یک مسیر (canonical + languages/hreflang).
 * هر locale به نسخه‌ی محلیِ خودش لینک می‌شود؛ x-default به پیش‌فرض.
 * path باید با «/» شروع شود (مثلاً '/r/vista').
 */
export function alternates(path: string): { canonical: string; languages: Record<string, string> } {
  const canonical = `${SITE}${path}`;
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l.code] = `${SITE}${l.prefix}${path}`;
  languages['x-default'] = canonical;
  return { canonical, languages };
}
