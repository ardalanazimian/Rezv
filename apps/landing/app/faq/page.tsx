import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { FaqAccordion } from '@/components/site/FaqAccordion';
import { getFaqs } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd, siteFaqJsonLd } from '@/lib/site-schema';

// همه‌ی پرسش‌ها در یک صفحه، گروه‌بندی‌شده — هم برای کاربر و هم به‌عنوانِ صفحه‌ی
// مرجعِ FAQPage که پرسش‌های همه‌ی دامنه‌ها را پوشش می‌دهد.

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: 'پرسش‌های متداول رزرونو',
  description:
    'پاسخِ پرسش‌های رایج درباره‌ی رزرونو: نحوه‌ی کار، راه‌اندازی، قیمت و پرداخت، دوره‌ی آزمایشی، چندشعبه‌ای و امنیتِ داده.',
  path: '/faq',
  keywords: ['سوالات متداول رزرونو', 'راهنمای نرم افزار رستوران'],
});

const GROUPS: { scope: string; title: string; icon: string; description: string }[] = [
  { scope: 'general', title: 'عمومی', icon: 'sparkle', description: 'شناختِ کلیِ محصول و راه‌اندازی' },
  { scope: 'pricing', title: 'قیمت و پرداخت', icon: 'ticket', description: 'پلن‌ها، فاکتور و تمدید' },
  { scope: 'demo', title: 'دوره‌ی آزمایشی', icon: 'rocket', description: 'دموی ۳۰ روزه و بعد از آن' },
  { scope: 'business', title: 'پنلِ کسب‌وکار', icon: 'layout', description: 'عملیاتِ سالن و مدیریتِ تیم' },
  { scope: 'customer', title: 'مهمان‌ها', icon: 'phone', description: 'رزرو از سمتِ مشتری' },
];

export default async function FaqPage() {
  const groups = await Promise.all(
    GROUPS.map(async (g) => ({ ...g, items: await getFaqs(g.scope) })),
  );
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  const all = nonEmpty.flatMap((g) => g.items);
  const pageUrl = `${SITE}/faq`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({ name: 'پرسش‌های متداول رزرونو', description: metadata.description as string, pageUrl }),
          breadcrumbJsonLd([{ name: 'پرسش‌های متداول', path: '/faq' }]),
          siteFaqJsonLd(all),
        ])}
        id="page-faq"
      />

      <section className="hero hero--compact hero--center">
        <div className="grid-bg" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__content">
            <Reveal><span className="eyebrow"><Icon name="chat" size={14} />پرسش‌های متداول</span></Reveal>
            <Reveal delay={60}>
              <h1 className="display">هرچه <span className="text-gradient">می‌پرسند.</span></h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '42ch' }}>
                اگر پاسخِ سؤالتان اینجا نبود، یک پیام بفرستید — معمولاً در همان روزِ کاری جواب می‌دهیم.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* پیمایشِ سریع بینِ گروه‌ها */}
      {nonEmpty.length > 1 && (
        <section className="section section--tight">
          <div className="container">
            {/* تراشه‌های پیمایش عمداً cta-row نمی‌گیرند — باید کنارِ هم بمانند. */}
            <div className="row" style={{ justifyContent: 'center' }}>
              {nonEmpty.map((g) => (
                <a key={g.scope} href={`#faq-${g.scope}`} className="chip">
                  <Icon name={g.icon} size={15} />
                  {g.title}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {nonEmpty.map((group, gi) => (
        <section key={group.scope} id={`faq-${group.scope}`} className={`section${gi % 2 ? ' section--subtle section--edge' : ''}`}>
          <div className="container-narrow">
            <div className="section-head">
              <span className="eyebrow"><Icon name={group.icon} size={14} />{group.title}</span>
              <h2 className="h3">{group.description}</h2>
            </div>
            <FaqAccordion items={group.items} />
          </div>
        </section>
      ))}

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2 className="h2" style={{ marginBottom: 'var(--sp-4)' }}>پاسخِ سؤالتان را پیدا نکردید؟</h2>
              <p className="lead" style={{ maxWidth: '42ch', marginInline: 'auto', marginBottom: 'var(--sp-8)' }}>
                یک پیامِ کوتاه بفرستید یا مستقیم دموی رایگان را شروع کنید — بیشترِ سؤال‌ها با ده دقیقه کارِ عملی جواب می‌گیرند.
              </p>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/contact" className="btn btn--primary btn--lg">
                  پرسش از کارشناس
                  <Icon name="arrowLeft" size={18} className="btn__arrow" />
                </Link>
                <Link href="/demo" className="btn btn--ghost btn--lg">شروعِ دموی رایگان</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
