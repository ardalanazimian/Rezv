import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { FaqAccordion } from '@/components/site/FaqAccordion';
import { PlanCards } from '@/components/pricing/PlanCards';
import { getPlans, getFaqs } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import {
  graph, webPageJsonLd, breadcrumbJsonLd, siteFaqJsonLd, softwareApplicationJsonLd,
} from '@/lib/site-schema';
import { toman, faNum } from '@/lib/format';

// صفحه‌ی قیمت — عمداً صفحه‌ی اختصاصی و نه بلوکِ CMS: اینجا هم کارتِ قیمت،
// هم مقایسه‌ی پلن‌ها، هم مسیرِ شفافِ خرید و هم پرسش‌های مالی کنارِ هم‌اند.

export const revalidate = 120;

export const metadata: Metadata = buildMetadata({
  title: 'قیمت‌گذاری رزرونو | پلن‌های ۳، ۶ و ۱۲ ماهه',
  description:
    'پلن‌های اشتراکِ رزرونو: سه‌ماهه ۱۸ میلیون، شش‌ماهه ۳۴ میلیون و یک‌ساله ۶۵ میلیون تومان. همه‌ی امکانات در همه‌ی پلن‌ها، بدونِ محدودیتِ کاربر و رزرو. دموی ۳۰ روزه‌ی رایگان.',
  path: '/pricing',
  keywords: ['قیمت نرم افزار رستوران', 'اشتراک رزرونو', 'هزینه سیستم رزرو رستوران'],
});

const INCLUDED = [
  'کاربر، میز و رزروِ نامحدود',
  'اپِ مشتری و صفحه‌ی اختصاصیِ رستوران',
  'لیستِ انتظار و ورودِ بدونِ رزرو',
  'باشگاهِ مشتریان و پروفایلِ مهمان',
  'کمپین، امتیاز و کش‌بک',
  'گزارش و تحلیلِ عملکرد',
  'چندشعبه‌ای و سطحِ دسترسیِ کارکنان',
  'پشتیبانی و راه‌اندازی',
];

const BUY_STEPS = [
  { icon: 'check', title: 'انتخابِ پلن و ثبتِ درخواست', body: 'فرمِ کوتاه را پر می‌کنید و بلافاصله کدِ پیگیری می‌گیرید.' },
  { icon: 'phone', title: 'تماسِ کارشناس', body: 'برای هماهنگیِ پرداخت و صدورِ فاکتور با شما تماس گرفته می‌شود.' },
  { icon: 'rocket', title: 'فعال‌سازی از پنلِ شرکت', body: 'پس از تأییدِ پرداخت، اشتراک فعال و تاریخِ انقضا روی حسابتان ثبت می‌شود.' },
  { icon: 'target', title: 'پیگیریِ شفاف', body: 'در هر مرحله می‌توانید وضعیتِ درخواست را با کدِ پیگیری ببینید.' },
];

export default async function PricingPage() {
  const [plans, faqs] = await Promise.all([getPlans(), getFaqs('pricing')]);
  const pageUrl = `${SITE}/pricing`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({
            name: 'قیمت‌گذاری رزرونو',
            description: 'پلن‌های اشتراکِ رزرونو و مسیرِ خرید.',
            pageUrl,
          }),
          breadcrumbJsonLd([{ name: 'قیمت‌گذاری', path: '/pricing' }]),
          softwareApplicationJsonLd(plans),
          siteFaqJsonLd(faqs),
        ])}
        id="page-pricing"
      />

      <section className="hero hero--compact hero--center">
        <div className="aurora" aria-hidden="true">
          <span className="aurora__blob" /><span className="aurora__blob" /><span className="aurora__blob" />
        </div>
        <div className="grid-bg" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__content">
            <Reveal><span className="eyebrow"><Icon name="ticket" size={14} />قیمت‌گذاری</span></Reveal>
            <Reveal delay={60}>
              <h1 className="display">
                یک اشتراک،{' '}
                <span className="text-gradient">همه‌ی امکانات.</span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '44ch' }}>
                تفاوتِ پلن‌ها در مدت و سطحِ پشتیبانی است، نه در قفل‌بودنِ قابلیت‌ها.
                هر پلنی که بگیرید، محصولِ کامل را دارید.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary btn--lg">
                  اول ۳۰ روز رایگان امتحان کنید
                  <Icon name="arrowLeft" size={18} className="btn__arrow" />
                </Link>
                <Link href="/contact" className="btn btn--ghost btn--lg">گفت‌وگو با کارشناس</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section--tight" id="plans">
        <div className="container">
          <PlanCards plans={plans} note="قیمت‌ها به تومان و برای کلِ دوره است. مالیات طبقِ قوانینِ جاری محاسبه می‌شود." />
        </div>
      </section>

      {/* آنچه در همه‌ی پلن‌ها هست */}
      <section className="section section--subtle section--edge">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">در همه‌ی پلن‌ها</span>
            <h2 className="h2">چیزی پشتِ قفل نیست</h2>
            <p className="lead">هر رستورانی که مشترکِ رزرونو می‌شود، به کلِ محصول دسترسی دارد.</p>
          </div>
          <div className="grid grid-4">
            {INCLUDED.map((item, i) => (
              <Reveal key={item} delay={(i % 4) * 60}>
                <div className="card card--flat row" style={{ gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                  <Icon name="checkCircle" size={20} />
                  <span className="small" style={{ fontWeight: 600 }}>{item}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* مقایسه‌ی عددیِ پلن‌ها */}
      {plans.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head section-head--center">
              <span className="eyebrow">مقایسه</span>
              <h2 className="h2">کدام پلن به‌صرفه‌تر است؟</h2>
              <p className="lead">هرچه دوره بلندتر، هزینه‌ی ماهانه کمتر.</p>
            </div>
            <Reveal>
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">مقایسه‌ی عددیِ پلن‌های اشتراک</caption>
                  <thead>
                    <tr>
                      <th scope="col">پلن</th>
                      <th scope="col">مدت</th>
                      <th scope="col">هزینه‌ی کلِ دوره</th>
                      <th scope="col">معادلِ ماهانه</th>
                      <th scope="col">صرفه‌جویی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.key}>
                        <th scope="row" style={{ background: 'transparent', position: 'static' }}>
                          <span className="row" style={{ gap: 'var(--sp-2)' }}>
                            {p.name}
                            {p.badge && <span className="badge badge--brand">{p.badge}</span>}
                          </span>
                        </th>
                        <td className="is-num">{faNum(p.months)} ماه</td>
                        <td className="is-num">{toman(p.price_toman)}</td>
                        <td className="is-num">{toman(p.monthly_toman)}</td>
                        <td className="is-num">
                          {p.saving_toman > 0
                            ? <span className="badge badge--success">{toman(p.saving_toman)}</span>
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* مسیرِ خرید — شفافیتِ فرآیندِ فعال‌سازی */}
      <section className="section section--subtle section--edge">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">مسیرِ خرید</span>
            <h2 className="h2">از درخواست تا فعال‌سازی</h2>
            <p className="lead">
              پرداختِ آنلاینِ خودکار نداریم؛ هر اشتراک بعد از هماهنگی و تأیید، توسطِ تیمِ رزرونو فعال می‌شود.
              در هر مرحله می‌دانید کجای کار هستید.
            </p>
          </div>
          <div className="steps">
            {BUY_STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 90}>
                <article className="step">
                  <h3 className="step__title">{step.title}</h3>
                  <p className="step__body">{step.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={300}>
            <p className="small muted" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
              کدِ پیگیری دارید؟{' '}
              <Link href="/order" className="prose">وضعیتِ درخواستتان را ببینید</Link>.
            </p>
          </Reveal>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="section">
          <div className="container-narrow">
            <div className="section-head section-head--center">
              <span className="eyebrow">پرسش‌های مالی</span>
              <h2 className="h2">قبل از تصمیم، این‌ها را بدانید</h2>
            </div>
            <FaqAccordion items={faqs} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2 className="h1" style={{ marginBottom: 'var(--sp-4)' }}>هنوز مطمئن نیستید؟</h2>
              <p className="lead" style={{ maxWidth: '44ch', marginInline: 'auto', marginBottom: 'var(--sp-8)' }}>
                ۳۰ روز با محصولِ کامل کار کنید، بعد تصمیم بگیرید. بدونِ کارتِ بانکی و بدونِ تمدیدِ خودکار.
              </p>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary btn--lg">
                  شروعِ دموی رایگان
                  <Icon name="arrowLeft" size={18} className="btn__arrow" />
                </Link>
                <Link href="/contact" className="btn btn--ghost btn--lg">پرسش از کارشناس</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
