import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicMenu } from '@/lib/api';
import { menuJsonLd } from '@/lib/schema';
import { alternates } from '@/lib/i18n';
import { isDemoRestaurant, menuPath, menuUrl, restaurantUrl, SITE } from '@/lib/urls';
import MenuBoard, { groupByCategory, sectionId } from '@/components/MenuBoard';

// ═══════════════════════════════════════════════════════════════════════
//  /r/{slug}/menu — منویِ عمومی. مقصدِ QRی که رویِ میزها چاپ می‌شود.
//
//  مخاطب دو نفرِ کاملاً متفاوت است و صفحه باید هر دو را راضی کند:
//    • مهمانِ سرِ میز — موبایل، شاید دادهٔ ضعیف، بی‌حوصله. باید فوراً منو را
//      ببیند: بدونِ ورود، بدونِ اسپینر، بدونِ اسکرول تا وسطِ صفحه.
//    • خزنده‌ی گوگل — باید متنِ کاملِ منو را در خودِ HTML ببیند.
//  هر دو با یک چیز راضی می‌شوند: HTMLِ سرورساید. پس این صفحه هیچ
//  جاوااسکریپتِ کلاینتی ندارد؛ حتی چیپ‌هایِ دسته لینکِ لنگرِ ساده‌اند.
//
//  canonical = خودِ همین صفحه (نه /r/{slug}). چرا: محتوایش — منویِ کاملِ
//  دسته‌بندی‌شده با توضیح و عکس — در صفحه‌ی رستوران تکرار نمی‌شود، پس
//  صفحه‌ی نازکِ تکراری نیست و ایندکس‌شدنش ارزشِ مستقل دارد.
// ═══════════════════════════════════════════════════════════════════════

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await fetchPublicMenu(slug);
  if (!m) return { title: 'منو یافت نشد', robots: { index: false, follow: false } };

  const r = m.restaurant;
  const where = [r.cuisine, r.city].filter(Boolean).join('، ');
  const description = m.items.length
    ? `منویِ ${r.name}${where ? ` (${where})` : ''} با ${m.items.length.toLocaleString('fa-IR')} آیتم و قیمتِ روز.`
    : `صفحه‌ی منویِ ${r.name}${where ? ` — ${where}` : ''}.`;

  return {
    title: `منوی ${r.name}`,
    description,
    alternates: alternates(menuPath(slug)),
    // سه حالت:
    //   • رستورانِ دمو → هرگز ایندکس نشود (نه index نه follow)
    //   • منویِ خالی   → صفحه‌ی نازک است، ولی follow می‌ماند تا لینکِ صفحه‌ی
    //     رستوران دنبال شود. با ثبتِ اولین آیتم، ISR خودش ایندکس‌پذیرش می‌کند.
    //   • بقیه        → ایندکس‌پذیر
    robots: isDemoRestaurant(r.name)
      ? { index: false, follow: false }
      : m.items.length ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: 'website', title: `منوی ${r.name}`, description, url: menuUrl(slug) },
  };
}

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await fetchPublicMenu(slug);
  // null یعنی رستوران نیست یا API در دسترس نیست — هیچ‌کدام «منوی نمونه» نمی‌شود.
  if (!m) notFound();

  const r = m.restaurant;
  const sections = groupByCategory(m.items);
  const named = sections.filter((s) => s.name);
  const sub = [r.cuisine, r.city].filter(Boolean).join(' · ');

  return (
    <>
      <a className="skip" href="#menu">پرش به منو</a>

      <header className="mhead">
        <div className="mhead-row">
          <div className="mhead-t">
            <h1>{r.name}</h1>
            {sub ? <p>{sub}</p> : null}
          </div>
          {/* CTA به صفحه‌ی خودِ رستوران — همان‌جا مسیرِ رزرو هست. عمداً
              «رزرو» را اینجا تحمیل نمی‌کنیم: مهمان همین حالا سرِ میز است. */}
          <a className="cta" href={restaurantUrl(slug)}>اطلاعات و رزرو</a>
        </div>
      </header>

      {/* چیپ‌ها فقط وقتی دسته‌بندیِ واقعی هست — نوارِ تک‌چیپه بی‌معناست. */}
      {named.length > 1 ? (
        <nav className="chips" aria-label="دسته‌های منو">
          {sections.map((s, i) =>
            s.name ? <a className="chip" key={i} href={`#${sectionId(s.name, i)}`}>{s.name}</a> : null,
          )}
        </nav>
      ) : null}

      <main className="wrap" id="menu">
        {m.items.length ? (
          <>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': [
                  { ...menuJsonLd(m.items, `${menuUrl(slug)}#menu`), name: `منوی ${r.name}` },
                  {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                      { '@type': 'ListItem', position: 1, name: 'رزرونو', item: `${SITE}/` },
                      { '@type': 'ListItem', position: 2, name: r.name, item: restaurantUrl(slug) },
                      { '@type': 'ListItem', position: 3, name: 'منو', item: menuUrl(slug) },
                    ],
                  },
                ],
              }) }}
            />
            <MenuBoard sections={sections} />
          </>
        ) : (
          // رستوران هست ولی منو ثبت نکرده. این یک واقعیت است، نه خطا —
          // و قطعاً جایِ منویِ نمونه نیست.
          <div className="empty">
            <div className="empty-t">منویِ این رستوران هنوز ثبت نشده</div>
            <div>به‌محضِ اینکه {r.name} منویش را وارد کند، همین‌جا نمایش داده می‌شود.</div>
          </div>
        )}
      </main>
    </>
  );
}
