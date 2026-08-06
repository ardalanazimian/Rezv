import Link from 'next/link';
import { Icon, LogoMark } from './Icon';
import { BRAND_NAME } from '@/lib/site-schema';

// فوتر: هم نقشه‌ی سایت برای کاربر است و هم شبکه‌ی لینک‌سازیِ داخلی برای خزنده.
// عمداً همه‌ی مسیرهای مهم اینجا هستند تا هیچ صفحه‌ای یتیم نماند.

const GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'محصول',
    links: [
      { label: 'معرفیِ محصول', href: '/product' },
      { label: 'اپِ مشتری', href: '/customer-app' },
      { label: 'اپِ کسب‌وکار', href: '/business-app' },
      { label: 'امکانات', href: '/features' },
      { label: 'چطور کار می‌کند', href: '/how-it-works' },
    ],
  },
  {
    title: 'شروع',
    links: [
      { label: 'قیمت‌گذاری', href: '/pricing' },
      { label: 'دموی ۳۰ روزه', href: '/demo' },
      { label: 'پیگیریِ درخواست', href: '/order' },
      { label: 'ورود به حساب', href: '/login' },
      { label: 'تماس با فروش', href: '/contact' },
    ],
  },
  {
    title: 'منابع',
    links: [
      { label: 'بلاگ', href: '/blog' },
      { label: 'پرسش‌های متداول', href: '/faq' },
      { label: 'تغییرات محصول', href: '/changelog' },
      { label: 'درباره‌ی ما', href: '/about' },
    ],
  },
  {
    title: 'قانونی',
    links: [
      { label: 'شرایط استفاده', href: '/terms' },
      { label: 'حریم خصوصی', href: '/privacy' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand stack stack-4">
            <Link href="/" className="brand" aria-label={`${BRAND_NAME} — صفحه‌ی اصلی`}>
              <LogoMark size={30} />
              <span className="brand__name">{BRAND_NAME}</span>
            </Link>
            <p className="body small" style={{ maxWidth: '30ch' }}>
              پلتفرمِ رزروِ آنلاینِ میز و مدیریتِ عملیاتِ رستوران — از کشفِ مهمان تا گزارشِ مدیریت.
            </p>
            <Link href="/demo" className="btn btn--soft btn--sm" style={{ alignSelf: 'flex-start' }}>
              شروعِ دموی رایگان
              <Icon name="arrowLeft" size={15} className="btn__arrow" />
            </Link>
          </div>

          <nav className="site-footer__links" aria-label="نقشه‌ی سایت">
            {GROUPS.map((group) => (
              <div key={group.title} className="stack stack-3">
                <h2 className="site-footer__title">{group.title}</h2>
                <ul className="stack stack-2" style={{ listStyle: 'none' }}>
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="site-footer__link">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="divider" />

        <div className="site-footer__bottom">
          <p className="tiny muted">
            © {year} {BRAND_NAME} — همه‌ی حقوق محفوظ است.
          </p>
          <p className="tiny muted row" style={{ gap: 'var(--sp-2)' }}>
            <span className="pulse-dot" />
            سرویس فعال است
          </p>
        </div>
      </div>
    </footer>
  );
}
