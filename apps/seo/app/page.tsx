import { fetchSitemapData } from '@/lib/api';
import { SITE } from '@/lib/urls';

// ═══════════════════════════════════════════════════════════════════════
//  صفحه‌ی اصلیِ اپِ SEO — hubِ لینک‌سازیِ داخلی.
//
//  تا امروز این صفحه یک اسکلتِ `force-static` بود که فقط می‌گفت «لایه‌ی SEO».
//  مشکلش فقط زشتی نبود: صفحه‌ی اصلی مقصدِ همه‌ی breadcrumbها و `sitemap`ِ
//  با اولویتِ ۱.۰ است، و هیچ لینکی به صفحاتِ رستوران نمی‌داد — یعنی گرافِ
//  داخلیِ سایت از ریشه قطع بود و خزنده فقط از راهِ sitemap به صفحات می‌رسید.
//
//  حالا شهرها و آشپزی‌هایِ واقعی را از همان endpointِ sitemap می‌گیرد.
//  بدونِ API (یا با APIِ خالی) به همان معرفیِ ساده برمی‌گردد — build سبز
//  می‌ماند و هیچ شهرِ ساختگی‌ای جعل نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

export const revalidate = 3600;

export default async function Home() {
  const data = await fetchSitemapData();
  const cities = data.cities.slice(0, 24);
  const cuisines = data.cuisines.slice(0, 24);
  const count = data.restaurants.length;

  return (
    <main className="wrap">
      <h1>رزرونو</h1>
      <p className="lede">
        کشف و رزرو آنلاین میز در رستوران‌های ایران — همراه با منو، نشانی و ساعتِ کاری.
        {count ? ` هم‌اکنون ${count.toLocaleString('fa-IR')} رستوران در رزرونو.` : ''}
      </p>

      {cities.length ? (
        <section aria-label="شهرها">
          <h2>شهرها</h2>
          <ul className="rel">
            {cities.map((c) => (
              <li key={c}><a href={`${SITE}/city/${encodeURIComponent(c)}`}>رستوران‌های {c}</a></li>
            ))}
          </ul>
        </section>
      ) : null}

      {cuisines.length ? (
        <section aria-label="سبکِ آشپزی">
          <h2>سبکِ آشپزی</h2>
          <ul className="rel">
            {cuisines.map((c) => (
              <li key={c}><a href={`${SITE}/cuisine/${encodeURIComponent(c)}`}>{c}</a></li>
            ))}
          </ul>
        </section>
      ) : null}

      {!cities.length && !cuisines.length ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          فهرستِ شهرها و سبک‌هایِ آشپزی به‌محضِ در دسترس بودنِ داده اینجا نمایش داده می‌شود.
        </p>
      ) : null}
    </main>
  );
}
