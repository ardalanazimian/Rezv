import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRestaurant, fetchRestaurantList } from '@/lib/api';
import { restaurantJsonLd, faqJsonLd, type FaqItem } from '@/lib/schema';
import { alternates } from '@/lib/i18n';

// ISR: صفحه هر ۵ دقیقه در پس‌زمینه تازه می‌شود (کاتالوگِ بزرگ بدونِ rebuildِ کامل).
export const revalidate = 300;

const SITE = 'https://rezervno.ir';
const pageUrl = (slug: string) => `${SITE}/r/${encodeURIComponent(slug)}`;

const BAND = ['', 'اقتصادی', 'متوسط', 'گران', 'لوکس'];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await fetchRestaurant(slug);
  if (!r) return { title: 'رستوران یافت نشد' };
  const parts = [r.cuisine, r.location.city].filter(Boolean).join('، ');
  const description = `رزرو آنلاین میز در ${r.name}${parts ? ` — ${parts}` : ''}. مشاهده‌ی منو، عکس‌ها، ساعتِ کاری و امتیاز.`;
  const url = pageUrl(slug);
  return {
    title: `${r.name} — رزرو آنلاین`,
    description,
    alternates: alternates(`/r/${encodeURIComponent(slug)}`),
    openGraph: {
      type: 'website', title: r.name, description, url,
      images: r.photos[0]?.url ? [r.photos[0].url] : undefined,
    },
  };
}

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await fetchRestaurant(slug);
  if (!r) notFound();

  const url = pageUrl(slug);
  const jsonLd = restaurantJsonLd(r, url);
  const locLine = [r.location.district, r.location.city].filter(Boolean).join('، ');

  // لینک‌سازیِ داخلی: رستوران‌های هم‌شهری (یا اگر شهر نبود، هم‌آشپزی)، بدونِ خودِ این رستوران.
  const relatedRaw = r.location.city
    ? await fetchRestaurantList({ city: r.location.city })
    : r.cuisine
      ? await fetchRestaurantList({ cuisine: r.cuisine })
      : [];
  const related = relatedRaw.filter((x) => x.slug !== r.slug).slice(0, 4);

  // FAQ (AI-search/GEO): پاسخ‌های factual مشتق از دادهٔ واقعی — بدونِ جعل.
  const band = BAND[Math.min(4, Math.max(1, r.price_band))];
  const faq: FaqItem[] = [
    { q: `آیا ${r.name} رزرو آنلاین دارد؟`, a: `بله، از طریقِ رزرونو می‌توانید در ${r.name} به‌صورتِ آنلاین میز رزرو کنید.` },
  ];
  if (r.cuisine) faq.push({ q: `نوعِ آشپزیِ ${r.name} چیست؟`, a: `${r.name} در سبکِ ${r.cuisine} غذا سرو می‌کند.` });
  if (r.location.address || r.location.city) {
    const where = [r.location.address, r.location.district, r.location.city].filter(Boolean).join('، ');
    faq.push({ q: `${r.name} کجاست؟`, a: `${r.name} در ${where} قرار دارد.` });
  }
  if (band) faq.push({ q: `بازه‌ی قیمتِ ${r.name} چطور است؟`, a: `بازه‌ی قیمتِ ${r.name} «${band}» است.` });
  if (r.rating != null && r.reviews_count > 0) {
    faq.push({ q: `امتیازِ ${r.name} چند است؟`, a: `${r.name} امتیازِ ${r.rating} از ۵ را بر اساسِ ${r.reviews_count} نظر دارد.` });
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px', lineHeight: 1.9 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="مسیر" style={{ fontSize: 13, color: '#666' }}>
        <a href={`${SITE}/`}>رزرونو</a>
        {r.location.city ? <> · <a href={`${SITE}/city/${encodeURIComponent(r.location.city)}`}>{r.location.city}</a></> : null}
        {' · '}<span>{r.name}</span>
      </nav>

      <h1 style={{ marginBottom: 4 }}>{r.name}</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        {[r.cuisine, locLine, BAND[Math.min(4, Math.max(1, r.price_band))]].filter(Boolean).join(' · ')}
        {r.rating != null && r.reviews_count > 0 ? ` · ★ ${r.rating} (${r.reviews_count} نظر)` : ''}
      </p>

      {r.location.address ? <p><strong>نشانی:</strong> {r.location.address}</p> : null}

      <a
        href={`${SITE}/`}
        style={{ display: 'inline-block', background: '#2563EB', color: '#fff', padding: '12px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, margin: '8px 0 20px' }}
      >
        رزرو میز در اپ رزرونو
      </a>

      {r.photos.length ? (
        <section aria-label="گالری" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.photos.slice(0, 6).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p.url} alt={p.caption || r.name} loading="lazy" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 10 }} />
          ))}
        </section>
      ) : null}

      {r.menu.length ? (
        <section aria-label="منو">
          <h2>منو</h2>
          <ul>
            {r.menu.map((m, i) => (
              <li key={i}>{m.emoji ? `${m.emoji} ` : ''}{m.name} — {m.price_toman.toLocaleString('fa-IR')} تومان</li>
            ))}
          </ul>
        </section>
      ) : null}

      {faq.length ? (
        <section aria-label="پرسش‌های متداول">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />
          <h2>پرسش‌های متداول</h2>
          {faq.map((f, i) => (
            <details key={i} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
              <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
              <p style={{ margin: '6px 0 0', color: '#444' }}>{f.a}</p>
            </details>
          ))}
        </section>
      ) : null}

      {related.length ? (
        <section aria-label="رستوران‌های مشابه">
          <h2>{r.location.city ? `رستوران‌های دیگر در ${r.location.city}` : 'رستوران‌های مشابه'}</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {related.map((x) => (
              <li key={x.id}>
                <a href={`${SITE}/r/${encodeURIComponent(x.slug)}`} style={{ fontWeight: 600, textDecoration: 'none', color: '#111' }}>
                  {x.name}
                </a>
                {[x.cuisine, x.city].filter(Boolean).length ? (
                  <span style={{ color: '#666', fontSize: 13 }}> — {[x.cuisine, x.city].filter(Boolean).join(' · ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
