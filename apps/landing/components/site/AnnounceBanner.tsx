import Link from 'next/link';
import type { SiteBanner } from '@/lib/content-types';

// بنرِ اطلاعیه‌ی بالای سایت — کاملاً از استودیو کنترل می‌شود (متن، لحن، لینک و
// بازه‌ی زمانی). بک‌اند فقط بنری را برمی‌گرداند که منتشر شده و در بازه‌اش هستیم،
// پس اینجا شرطِ نمایشِ دیگری لازم نیست.
export function AnnounceBanner({ banner }: { banner: SiteBanner }) {
  const tone = ['brand', 'success', 'warning', 'info'].includes(banner.tone) ? banner.tone : 'brand';
  const internal = banner.cta_href?.startsWith('/');

  return (
    <div className={`announce announce--${tone}`} role="region" aria-label="اطلاعیه">
      <div className="container row" style={{ justifyContent: 'center', gap: 'var(--sp-3)' }}>
        <span>{banner.message}</span>
        {banner.cta_href && banner.cta_label && (
          internal ? (
            <Link href={banner.cta_href}>{banner.cta_label}</Link>
          ) : (
            <a href={banner.cta_href} target="_blank" rel="noopener noreferrer">{banner.cta_label}</a>
          )
        )}
      </div>
    </div>
  );
}
