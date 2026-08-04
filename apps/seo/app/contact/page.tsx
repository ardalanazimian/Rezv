import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { ContactForm } from '@/components/forms/ContactForm';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd, ORG_ID } from '@/lib/site-schema';

export const metadata: Metadata = buildMetadata({
  title: 'تماس با فروش رزرونو',
  description:
    'با کارشناسِ رزرونو درباره‌ی رستورانِ خود صحبت کنید: قیمت‌گذاری، راه‌اندازی، چندشعبه‌ای و انتقالِ دادهٔ فعلی.',
  path: '/contact',
  keywords: ['تماس با رزرونو', 'مشاوره نرم افزار رستوران'],
});

const CHANNELS = [
  { icon: 'rocket', title: 'می‌خواهم محصول را ببینم', body: 'دموی ۳۰ روزه سریع‌ترین راه است — همین حالا فعال می‌شود.', cta: { label: 'شروعِ دموی رایگان', href: '/demo' } },
  { icon: 'ticket', title: 'درباره‌ی قیمت سؤال دارم', body: 'پلن‌ها و مسیرِ خرید کاملاً شفاف روی سایت آمده‌اند.', cta: { label: 'دیدنِ قیمت‌ها', href: '/pricing' } },
  { icon: 'target', title: 'درخواستی ثبت کرده‌ام', body: 'با کدِ پیگیری، وضعیتِ درخواستتان را لحظه‌ای ببینید.', cta: { label: 'پیگیریِ درخواست', href: '/order' } },
];

export default function ContactPage() {
  const pageUrl = `${SITE}/contact`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({ name: 'تماس با فروش رزرونو', description: metadata.description as string, pageUrl }),
          breadcrumbJsonLd([{ name: 'تماس با ما', path: '/contact' }]),
          {
            '@type': 'ContactPage',
            '@id': `${pageUrl}#contact`,
            url: pageUrl,
            inLanguage: 'fa-IR',
            about: { '@id': ORG_ID },
          },
        ])}
        id="page-contact"
      />

      <section className="hero hero--compact">
        <div className="aurora" aria-hidden="true">
          <span className="aurora__blob" /><span className="aurora__blob" /><span className="aurora__blob" />
        </div>
        <div className="container hero__inner hero__inner--split">
          <div className="hero__content">
            <Reveal><span className="eyebrow"><Icon name="mail" size={14} />تماس با فروش</span></Reveal>
            <Reveal delay={60}>
              <h1 className="display">
                درباره‌ی رستورانِ شما{' '}
                <span className="text-gradient">حرف بزنیم.</span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '40ch' }}>
                چه در حالِ ارزیابی باشید و چه آماده‌ی شروع — بنویسید کجای کار هستید تا دقیق راهنمایی کنیم.
              </p>
            </Reveal>

            <Reveal delay={180}>
              <div className="stack stack-3" style={{ width: '100%' }}>
                {CHANNELS.map((c) => (
                  <div key={c.title} className="card card--flat row" style={{ gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
                    <span className="icon-tile" style={{ width: 38, height: 38 }}>
                      <Icon name={c.icon} size={18} />
                    </span>
                    <span className="stack stack-2" style={{ flex: 1 }}>
                      <b className="small">{c.title}</b>
                      <span className="tiny muted">{c.body}</span>
                      <Link href={c.cta.href} className="btn btn--quiet btn--sm" style={{ alignSelf: 'flex-start' }}>
                        {c.cta.label}
                        <Icon name="arrowLeft" size={14} className="btn__arrow" />
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={100}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
