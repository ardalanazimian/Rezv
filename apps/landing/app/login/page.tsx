import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { SplitText } from '@/components/site/Kinetic';
import { DoorPicker, type Door } from '@/components/site/DoorPicker';
import { HeroLight } from '@/components/sections/Caustics';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd } from '@/lib/site-schema';

// نقطه‌ی ورود. خودِ ورود در اپ‌های مربوطه انجام می‌شود (یک هویت، یک صفحه‌ی
// ورود به‌ازای هر اپ)؛ این صفحه فقط کاربر را به درِ درست هدایت می‌کند تا کسی
// شماره‌اش را در جای اشتباه وارد نکند.
//
// چیدمان عمداً تمام‌قد است: انتخابِ حساب تنها کاری است که در این صفحه انجام
// می‌شود، پس نباید بینِ بخش‌های دیگر گم شود.

export const metadata: Metadata = buildMetadata({
  title: 'ورود به حساب رزرونو',
  description: 'ورود به اپِ مشتری، پنلِ کسب‌وکار یا پنلِ شرکتِ رزرونو. ورود با شماره‌ی موبایل و کدِ پیامکی.',
  path: '/login',
});

const DOORS: Door[] = [
  {
    key: 'customer',
    icon: 'phone',
    title: 'اپِ مشتری',
    body: 'کشفِ رستوران، رزروِ میز، و تاریخچه‌ی رزروها.',
    hint: 'ورود با شماره‌ی موبایل',
    href: process.env.NEXT_PUBLIC_CUSTOMER_APP_URL ?? null,
    fallbackHref: '/contact',
    fallbackLabel: 'دریافتِ نشانی',
  },
  {
    key: 'business',
    icon: 'layout',
    title: 'پنلِ کسب‌وکار',
    body: 'رزرو، میز، لیستِ انتظار، مشتریان و گزارش‌های رستوران.',
    hint: 'ورود با شماره‌ی مالک یا کارمند',
    href: process.env.NEXT_PUBLIC_BUSINESS_APP_URL ?? null,
    fallbackHref: '/contact',
    fallbackLabel: 'دریافتِ نشانی',
  },
  {
    key: 'company',
    icon: 'building',
    title: 'پنلِ شرکت',
    body: 'مدیریتِ پلتفرم، فعال‌سازیِ اشتراک و محتوای سایت.',
    hint: 'مخصوصِ مدیرانِ پلتفرم',
    href: process.env.NEXT_PUBLIC_COMPANY_APP_URL ?? null,
    fallbackHref: '/contact',
    fallbackLabel: 'دریافتِ نشانی',
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

      <section className="gate">
        <HeroLight />

        <div className="container gate__inner">
          <Reveal>
            <span className="eyebrow"><Icon name="lock" size={14} />ورود</span>
          </Reveal>

          <h1 className="gate__title">
            <SplitText text="کدام" delay={100} />{' '}
            <SplitText className="text-gradient" text="حساب؟" delay={220} />
          </h1>

          <Reveal delay={140}>
            <p className="gate__lead">
              سه ورودیِ جدا. هر سه با شماره‌ی موبایل و کدِ پیامکی کار می‌کنند.
            </p>
          </Reveal>

          <DoorPicker doors={DOORS} />

          <Reveal delay={260}>
            <p className="gate__foot">
              هنوز حساب ندارید؟{' '}
              <Link href="/demo" className="gate__link">
                دموی ۳۰ روزه را شروع کنید
                <Icon name="arrowLeft" size={14} />
              </Link>{' '}
              — حسابِ پنلِ کسب‌وکار همان لحظه ساخته می‌شود، بدونِ کارتِ بانکی.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
