'use client';

// هدرِ چسبانِ سایت. روی اسکرول شیشه‌ای/فشرده می‌شود، منوی موبایل دارد و
// مسیرِ فعال را با aria-current علامت می‌زند.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, LogoMark } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { BRAND_NAME } from '@/lib/site-schema';

interface NavItem { label: string; href: string; children?: { label: string; href: string; desc: string; icon: string }[] }

const NAV: NavItem[] = [
  {
    label: 'محصول',
    href: '/product',
    children: [
      { label: 'معرفیِ محصول', href: '/product', desc: 'نمای کاملِ پلتفرم', icon: 'sparkle' },
      { label: 'اپِ مشتری', href: '/customer-app', desc: 'کشف و رزروِ مهمان', icon: 'phone' },
      { label: 'اپِ کسب‌وکار', href: '/business-app', desc: 'پنلِ عملیاتیِ رستوران', icon: 'layout' },
      { label: 'امکانات', href: '/features', desc: 'فهرستِ کاملِ قابلیت‌ها', icon: 'list' },
      { label: 'چطور کار می‌کند', href: '/how-it-works', desc: 'مسیر از دو طرف', icon: 'target' },
    ],
  },
  { label: 'قیمت‌گذاری', href: '/pricing' },
  { label: 'بلاگ', href: '/blog' },
  {
    label: 'منابع',
    href: '/faq',
    children: [
      { label: 'پرسش‌های متداول', href: '/faq', desc: 'پاسخِ سؤال‌های رایج', icon: 'chat' },
      { label: 'تغییرات محصول', href: '/changelog', desc: 'چه چیزی تازه است', icon: 'rocket' },
      { label: 'درباره‌ی ما', href: '/about', desc: 'تیم و مأموریت', icon: 'building' },
      { label: 'تماس با فروش', href: '/contact', desc: 'گفت‌وگو با کارشناس', icon: 'mail' },
    ],
  },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    // مقدارِ اولیه در فریمِ بعد خوانده می‌شود (نه همزمان با افکت): مرورگر ممکن
    // است اسکرولِ قبلی را بازیابی کرده باشد، ولی این نباید رندرِ آبشاری بسازد.
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // تغییرِ مسیر باید منو را ببندد، وگرنه روی موبایل روی صفحه‌ی بعد باز می‌ماند.
  // این «تنظیمِ state هنگامِ تغییرِ ورودی» است، نه یک اثرِ جانبی — پس در بدنه‌ی
  // رندر انجام می‌شود (الگوی مستندِ React) و یک رندرِ اضافه‌ی افکت نمی‌سازد.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setOpenGroup(null);
  }

  // وقتی منوی تمام‌صفحه باز است، پس‌زمینه نباید اسکرول شود.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <Link href="/" className="brand" aria-label={`${BRAND_NAME} — صفحه‌ی اصلی`}>
          <LogoMark size={30} />
          <span className="brand__name">{BRAND_NAME}</span>
        </Link>

        <nav className="site-nav" aria-label="ناوبریِ اصلی">
          {NAV.map((item) =>
            item.children ? (
              <div
                key={item.label}
                className="site-nav__group"
                onMouseEnter={() => setOpenGroup(item.label)}
                onMouseLeave={() => setOpenGroup(null)}
              >
                <button
                  type="button"
                  className="site-nav__link"
                  aria-expanded={openGroup === item.label}
                  aria-current={item.children.some((c) => isActive(c.href)) ? 'page' : undefined}
                  onClick={() => setOpenGroup(openGroup === item.label ? null : item.label)}
                >
                  {item.label}
                  <Icon name="chevronDown" size={15} />
                </button>
                <div className="mega glass" data-open={openGroup === item.label}>
                  {item.children.map((child) => (
                    <Link key={child.href} href={child.href} className="mega__item">
                      <span className="icon-tile" style={{ width: 36, height: 36 }}>
                        <Icon name={child.icon} size={17} />
                      </span>
                      <span className="stack stack-1">
                        <span className="mega__label">{child.label}</span>
                        <span className="mega__desc">{child.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="site-nav__link"
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="site-header__actions">
          <ThemeToggle compact />
          <Link href="/login" className="btn btn--ghost btn--sm site-header__login">ورود</Link>
          <Link href="/demo" className="btn btn--primary btn--sm">
            دموی رایگان
            <Icon name="arrowLeft" size={16} className="btn__arrow" />
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--sm site-header__burger"
            aria-label={menuOpen ? 'بستنِ منو' : 'بازکردنِ منو'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      {/* منوی موبایل — تمام‌صفحه، مات (نه شیشه‌ای) تا خوانایی کامل بماند */}
      <div className="mobile-menu" data-open={menuOpen} hidden={!menuOpen}>
        <nav className="container stack stack-2" aria-label="ناوبریِ موبایل">
          {NAV.flatMap((item) => (item.children ? item.children : [{ ...item, desc: '', icon: 'dot' }])).map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mobile-menu__link"
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
                <Icon name="arrowLeft" size={17} />
              </Link>
            ),
          )}
          <div className="divider" style={{ margin: 'var(--sp-3) 0' }} />
          <Link href="/login" className="btn btn--ghost btn--block">ورود به حساب</Link>
          <Link href="/demo" className="btn btn--primary btn--block">شروعِ دموی ۳۰ روزه</Link>
        </nav>
      </div>
    </header>
  );
}
