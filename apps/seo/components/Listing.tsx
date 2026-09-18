import type { RestaurantListItem } from '@/lib/api';
import { listJsonLd } from '@/lib/schema';
// ⚠️ ۲۰۲۶-۰۹-۱۸: اینجا یک SITEِ ثابت بود — یکی از دو کپی‌ای که جاروی ۰۹-۰۸
// (هفت کپی → یک منبع، lib/urls.ts) از قلم انداخت. اثرش همانی بود که خودِ
// lib/urls.ts هشدارش را نوشته: روی هر دامنه‌ی دیگری، از جمله هر preview و هر
// staging، لینکِ هر کارت و breadcrumb به دامنه‌ی تولید می‌رفت.
import { SITE } from '@/lib/urls';
const BAND = ['', 'اقتصادی', 'متوسط', 'گران', 'لوکس'];

// کامپوننتِ مشترکِ صفحاتِ لیست (شهر/آشپزی) — رندرِ کارت‌ها + تزریقِ JSON-LD.
export default function Listing({
  title, description, pageUrl, items, crumbCity,
}: {
  title: string;
  description: string;
  pageUrl: string;
  items: RestaurantListItem[];
  crumbCity?: string;
}) {
  const jsonLd = listJsonLd({ name: title, pageUrl, items, crumbCity });

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px', lineHeight: 1.9 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="مسیر" style={{ fontSize: 13, color: '#666' }}>
        <a href={`${SITE}/`}>رزرونو</a> · <span>{title}</span>
      </nav>

      <h1 style={{ marginBottom: 4 }}>{title}</h1>
      <p style={{ color: '#555', marginTop: 0 }}>{description}</p>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {items.map((r) => {
          const band = r.price_band ?? r.priceBand ?? 2;
          const meta = [r.cuisine, r.city, BAND[Math.min(4, Math.max(1, band))]].filter(Boolean).join(' · ');
          return (
            <li key={r.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
              <a href={`${SITE}/r/${encodeURIComponent(r.slug)}`} style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none', color: '#111' }}>
                {r.name}
              </a>
              <div style={{ color: '#666', fontSize: 14 }}>
                {meta}
                {r.rating != null && r.reviews_count > 0 ? ` · ★ ${r.rating} (${r.reviews_count} نظر)` : ''}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
