import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd } from '@/lib/site-schema';

// نقطه‌ی ورود. خودِ ورود در اپ‌های مربوطه انجام می‌شود (یک هویت، یک صفحه‌ی
// ورود به‌ازای هر اپ)؛ این صفحه فقط کاربر را به درِ درست هدایت می‌کند تا کسی
// شماره‌اش را در جای اشتباه وارد نکند.

export const metadata: Metadata = buildMetadata({
  title: 'ورود به حساب رزرونو',
  description: 'ورود به اپِ مشتری، پنلِ کسب‌وکار یا پنلِ شرکتِ رزرونو. ورود با شماره‌ی موبایل و کدِ پیامکی.',
  path: '/login',
});

const APPS: { icon: string; title: string; body: string; env: string | undefined; hint: string }[] = [
  {
    icon: 'phone',
    title: 'اپِ مشتری',
    body: 'برای کشفِ رستوران، رزروِ میز و دیدنِ تاریخچه‌ی رزروها.',
    env: process.env.NEXT_PUBLIC_CUSTOMER_APP_URL,
    hint: 'ورود با شماره‌ی موبایل',
  },
  {
    icon: 'layout',
    title: 'پنلِ کسب‌وکار',
    body: 'برای مدیریتِ رزرو، میز، لیستِ انتظار، مشتریان و گزارش‌های رستوران.',
    env: process.env.NEXT_PUBLIC_BUSINESS_APP_URL,
    hint: 'ورود با شماره‌ی مالک یا کارمند',
  },
  {
    icon: 'building',
    title: 'پنلِ شرکت',
    body: 'برای تیمِ رزرونو: مدیریتِ پلتفرم، فعال‌سازیِ اشتراک و محتوای سایت.',
    env: process.env.NEXT_PUBLIC_COMPANY_APP_URL,
    hint: 'مخصوصِ مدیرانِ پلتفرم',
  },
];

export default function LoginPage() {
  const pageUrl = `${SITE}/login`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({ name: 'ورود به حساب رزرونو', description: metadata.description as string, pageUrl }),
          breadcrumbJsonLd([{ name: 'ورود', path: '/login' }]),
        ])}
        id="page-login"
      />

      <section className="section">
        <div className="container-narrow stack stack-8">
          <div className="section-head section-head--center">
            <span className="eyebrow"><Icon name="lock" size={14} />ورود</span>
            <h1 className="h1">کدام حساب؟</h1>
            <p className="lead">
              رزرونو سه ورودیِ جدا دارد. هر سه با شماره‌ی موبایل و کدِ پیامکی کار می‌کنند.
            </p>
          </div>

          <div className="grid grid-3">
            {APPS.map((app, i) => (
              <Reveal key={app.title} delay={i * 80}>
                <div className="entry-card">
                  <span className="icon-tile"><Icon name={app.icon} /></span>
                  <h2 className="h4">{app.title}</h2>
                  <p className="body small" style={{ flex: 1 }}>{app.body}</p>
                  <span className="tiny muted">{app.hint}</span>
                  {app.env ? (
                    <a href={app.env} className="btn btn--ghost btn--block" target="_blank" rel="noopener noreferrer">
                      ورود
                      <Icon name="external" size={15} />
                    </a>
                  ) : (
                    // بدونِ آدرسِ پیکربندی‌شده، دکمه‌ی مرده نمی‌سازیم: مسیرِ جایگزینِ
                    // واقعی (تماس با پشتیبانی) نشان داده می‌شود.
                    <Link href="/contact" className="btn btn--quiet btn--block">
                      دریافتِ نشانیِ ورود
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="card card--flat stack stack-3" style={{ textAlign: 'center' }}>
              <h2 className="h4">هنوز حساب ندارید؟</h2>
              <p className="body small">
                حسابِ پنلِ کسب‌وکار با شروعِ دموی ۳۰ روزه همان لحظه ساخته می‌شود — بدونِ کارتِ بانکی.
              </p>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary">
                  ساختِ حسابِ دمو
                  <Icon name="arrowLeft" size={16} className="btn__arrow" />
                </Link>
                <Link href="/pricing" className="btn btn--ghost">دیدنِ پلن‌ها</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
