import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { FaqAccordion } from '@/components/site/FaqAccordion';
import { TrialForm } from '@/components/forms/TrialForm';
import { getFaqs } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd, siteFaqJsonLd } from '@/lib/site-schema';

// صفحه‌ی دمو — نقطه‌ی اصلیِ تبدیل. فرم بالا و سمتِ چپِ چشم است و بقیه‌ی صفحه
// فقط دلیلِ اعتماد اضافه می‌کند، نه اصطکاک.

export const revalidate = 300;
const TRIAL_DAYS = 30;

export const metadata: Metadata = buildMetadata({
  title: 'دموی رایگان ۳۰ روزه رزرونو | بدون کارت بانکی',
  description:
    'حسابِ دموی پنلِ کسب‌وکارِ رزرونو را در چند ثانیه بسازید: ۳۰ روز دسترسیِ کامل، بدونِ کارتِ بانکی و بدونِ تمدیدِ خودکار. همان محصولِ واقعی، با دادهٔ رستورانِ خودتان.',
  path: '/demo',
  keywords: ['دمو رایگان نرم افزار رستوران', 'تست سیستم رزرو', 'نسخه آزمایشی رزرونو'],
});

const PROMISES = [
  { icon: 'bolt', title: 'همان لحظه فعال', body: 'حساب و یک چیدمانِ اولیه‌ی میز بلافاصله ساخته می‌شود؛ منتظرِ تأیید نمی‌مانید.' },
  { icon: 'shield', title: 'بدونِ کارتِ بانکی', body: 'هیچ اطلاعاتِ پرداختی نمی‌گیریم و چیزی به‌صورتِ خودکار تمدید نمی‌شود.' },
  { icon: 'sparkle', title: 'محصولِ کامل', body: 'نسخه‌ی نمایشیِ محدود نیست؛ همان پنلی است که رستوران‌ها هر شب با آن کار می‌کنند.' },
  { icon: 'history', title: 'داده‌ها می‌مانند', body: 'اگر بعداً مشترک شوید، از همان‌جا که بودید ادامه می‌دهید.' },
];

const AFTER = [
  'با شماره‌ی خودتان وارد پنلِ کسب‌وکار می‌شوید (ورود با کدِ پیامکی).',
  'میزها، ساعتِ کاری و منو را مطابقِ رستورانتان تنظیم می‌کنید.',
  'رزروِ آنلاین را روشن می‌کنید و صفحه‌ی رستورانتان فعال می‌شود.',
  'از هفته‌ی اول، گزارشِ اشغال و رفتارِ مهمان‌ها را می‌بینید.',
];

export default async function DemoPage() {
  const faqs = await getFaqs('demo');
  const pageUrl = `${SITE}/demo`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({
            name: 'دموی رایگان ۳۰ روزه رزرونو',
            description: 'ساختِ حسابِ دموی پنلِ کسب‌وکار — ۳۰ روز رایگان، بدونِ کارتِ بانکی.',
            pageUrl,
          }),
          breadcrumbJsonLd([{ name: 'دموی رایگان', path: '/demo' }]),
          siteFaqJsonLd(faqs),
        ])}
        id="page-demo"
      />

      <section className="hero hero--compact">
        <div className="aurora" aria-hidden="true">
          <span className="aurora__blob" /><span className="aurora__blob" /><span className="aurora__blob" />
        </div>
        <div className="grid-bg" aria-hidden="true" />

        <div className="container hero__inner hero__inner--split">
          <div className="hero__content">
            <Reveal>
              <span className="eyebrow"><Icon name="rocket" size={14} />دموی رایگان</span>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="display">
                ۳۰ روز،{' '}
                <span className="text-gradient">محصولِ کامل.</span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '40ch' }}>
                فرم را پر کنید و حسابِ پنلِ کسب‌وکارتان همین حالا ساخته می‌شود.
                نه نسخه‌ی نمایشی، نه محیطِ ساختگی — همان سیستمِ واقعی با دادهٔ رستورانِ خودتان.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <ul className="hero__bullets">
                <li><Icon name="check" size={16} />بدونِ کارتِ بانکی</li>
                <li><Icon name="check" size={16} />بدونِ تمدیدِ خودکار</li>
                <li><Icon name="check" size={16} />فعال‌سازیِ فوری</li>
              </ul>
            </Reveal>
            <Reveal delay={240}>
              <div className="grid grid-2" style={{ width: '100%' }}>
                {PROMISES.map((p) => (
                  <div key={p.title} className="card card--flat stack stack-2">
                    <span className="row" style={{ gap: 'var(--sp-2)' }}>
                      <Icon name={p.icon} size={18} />
                      <b className="small">{p.title}</b>
                    </span>
                    <p className="tiny muted">{p.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={100}>
            <div id="form">
              <TrialForm trialDays={TRIAL_DAYS} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section--subtle section--edge">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">بعد از ثبت</span>
            <h2 className="h2">چهار قدم تا اولین رزروِ آنلاین</h2>
          </div>
          <div className="steps">
            {AFTER.map((body, i) => (
              <Reveal key={body} delay={i * 90}>
                <article className="step">
                  <p className="step__body">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="section">
          <div className="container-narrow">
            <div className="section-head section-head--center">
              <span className="eyebrow">پرسش‌های متداول</span>
              <h2 className="h2">درباره‌ی دوره‌ی آزمایشی</h2>
            </div>
            <FaqAccordion items={faqs} />
            <p className="small muted" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
              سؤالِ دیگری دارید؟{' '}
              <Link href="/contact" className="prose">با کارشناسِ ما حرف بزنید</Link>{' '}
              یا <Link href="/pricing" className="prose">پلن‌ها را ببینید</Link>.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
