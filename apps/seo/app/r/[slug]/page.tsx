import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRestaurant, fetchRestaurantList } from '@/lib/api';
import { restaurantJsonLd, faqJsonLd, type FaqItem } from '@/lib/schema';
import { alternates } from '@/lib/i18n';
import { isDemoRestaurant, menuUrl, restaurantPath, restaurantUrl, SITE } from '@/lib/urls';
import MenuBoard, { groupByCategory } from '@/components/MenuBoard';
import { formatOpeningHours } from '@/lib/hours';

// ISR: صفحه هر ۵ دقیقه در پس‌زمینه تازه می‌شود (کاتالوگِ بزرگ بدونِ rebuildِ کامل).
export const revalidate = 300;

const BAND = ['', 'اقتصادی', 'متوسط', 'گران', 'لوکس'];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await fetchRestaurant(slug);
  if (!r) return { title: 'رستوران یافت نشد' };
  const parts = [r.cuisine, r.location.city].filter(Boolean).join('، ');
  // عنوان و توضیح از دادهٔ واقعی ساخته می‌شوند — از جمله اینکه منو واقعاً
  // چند آیتم دارد. عبارتِ «منو» فقط وقتی می‌آید که منویی هست.
  const menuBit = r.menu.length ? ` منو (${r.menu.length.toLocaleString('fa-IR')} آیتم)،` : '';
  const description = `رزرو آنلاین میز در ${r.name}${parts ? ` — ${parts}` : ''}.${menuBit} عکس‌ها، ساعتِ کاری و نشانی.`;
  return {
    title: r.menu.length ? `${r.name} — منو و رزرو آنلاین` : `${r.name} — رزرو آنلاین`,
    description,
    alternates: alternates(restaurantPath(slug)),
    // رستورانِ دمو/آزمایشی نباید ایندکس شود. sitemap هم بیرونش می‌گذارد، ولی
    // sitemap تنها راهِ کشف نیست — یک لینکِ لو‌رفته کافی است.
    ...(isDemoRestaurant(r.name) ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'website', title: r.name, description, url: restaurantUrl(slug),
      images: r.photos[0]?.url ? [r.photos[0].url] : undefined,
    },
  };
}

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await fetchRestaurant(slug);
  if (!r) notFound();

  const url = restaurantUrl(slug);
  const jsonLd = restaurantJsonLd(r, url);
  const locLine = [r.location.district, r.location.city].filter(Boolean).join('، ');
  const band = BAND[Math.min(4, Math.max(1, r.price_band))];
  const hours = formatOpeningHours(r.opening_hours);

  // در صفحه‌ی رستوران منو خلاصه می‌شود؛ نسخه‌ی کامل صفحه‌ی /menu است.
  // چرا سقف: صفحه‌ی رستوران باید *همه‌ی* واقعیت‌ها (نشانی، ساعت، عکس، مشابه‌ها)
  // را بدهد؛ منویِ ۸۰ آیتمی بقیه را از دسترسِ اسکرول بیرون می‌کند.
  const MENU_PREVIEW = 12;
  const previewItems = r.menu.slice(0, MENU_PREVIEW);
  const sections = groupByCategory(previewItems);

  // لینک‌سازیِ داخلی: رستوران‌های هم‌شهری (یا اگر شهر نبود، هم‌آشپزی)، بدونِ خودِ این رستوران.
  const relatedRaw = r.location.city
    ? await fetchRestaurantList({ city: r.location.city })
    : r.cuisine
      ? await fetchRestaurantList({ cuisine: r.cuisine })
      : [];
  const related = relatedRaw.filter((x) => x.slug !== r.slug).slice(0, 4);

  // FAQ (AI-search/GEO): پاسخ‌های factual مشتق از دادهٔ واقعی — بدونِ جعل.
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
  // فقط وقتی منویِ واقعی هست — وگرنه ادعایِ بی‌پشتوانه می‌شود.
  if (r.menu.length) {
    faq.push({
      q: `آیا منویِ ${r.name} آنلاین است؟`,
      a: `بله، منویِ ${r.name} با ${r.menu.length.toLocaleString('fa-IR')} آیتم و قیمت در ${menuUrl(slug)} در دسترس است.`,
    });
  }

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="مسیر" className="crumb">
        <a href={`${SITE}/`}>رزرونو</a>
        {r.location.city ? <> · <a href={`${SITE}/city/${encodeURIComponent(r.location.city)}`}>{r.location.city}</a></> : null}
        {' · '}<span>{r.name}</span>
      </nav>

      <h1 style={{ marginBottom: 4 }}>{r.name}</h1>
      <p className="lede">
        {[r.cuisine, locLine, band].filter(Boolean).join(' · ')}
        {r.rating != null && r.reviews_count > 0 ? ` · ★ ${r.rating} (${r.reviews_count} نظر)` : ''}
      </p>

      {r.location.address ? <p><strong>نشانی:</strong> {r.location.address}</p> : null}

      <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0 20px' }}>
        <a className="cta" href={`${SITE}/`}>رزرو میز در اپ رزرونو</a>
        {r.menu.length ? (
          <a className="cta" href={menuUrl(slug)} style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            دیدنِ منویِ کامل
          </a>
        ) : null}
      </p>

      {hours.length ? (
        <section aria-label="ساعتِ کاری">
          <h2>ساعتِ کاری</h2>
          <ul className="hours">
            {hours.map((h) => (
              <li key={h.day}><span className="d">{h.day}</span><span>{h.text}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.photos.length ? (
        <ul className="gal" aria-label="گالری">
          {r.photos.slice(0, 6).map((p, i) => (
            <li key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || r.name} loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      ) : null}

      {r.menu.length ? (
        <section aria-label="منو" id="menu">
          <h2>منو</h2>
          <MenuBoard sections={sections} />
          {r.menu.length > MENU_PREVIEW ? (
            <p style={{ marginTop: 16 }}>
              <a href={menuUrl(slug)}>
                دیدنِ همه‌ی {r.menu.length.toLocaleString('fa-IR')} آیتمِ منو ←
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {faq.length ? (
        <section aria-label="پرسش‌های متداول">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />
          <h2>پرسش‌های متداول</h2>
          {faq.map((f, i) => (
            <details key={i} className="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
      ) : null}

      {related.length ? (
        <section aria-label="رستوران‌های مشابه">
          <h2>{r.location.city ? `رستوران‌های دیگر در ${r.location.city}` : 'رستوران‌های مشابه'}</h2>
          <ul className="rel">
            {related.map((x) => (
              <li key={x.id}>
                <a href={restaurantUrl(x.slug)}>{x.name}</a>
                {[x.cuisine, x.city].filter(Boolean).length ? (
                  <span> — {[x.cuisine, x.city].filter(Boolean).join(' · ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
