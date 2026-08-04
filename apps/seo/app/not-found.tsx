import Link from 'next/link';
import { Icon } from '@/components/site/Icon';

// صفحه‌ی ۴۰۴ — به‌جای بن‌بست، مسیرهای واقعیِ ادامه‌ی کار را نشان می‌دهد.
const LINKS = [
  { href: '/product', label: 'معرفیِ محصول', icon: 'sparkle' },
  { href: '/pricing', label: 'قیمت‌گذاری', icon: 'ticket' },
  { href: '/demo', label: 'دموی رایگان', icon: 'rocket' },
  { href: '/blog', label: 'بلاگ', icon: 'list' },
];

export default function NotFound() {
  return (
    <section className="section notfound">
      <div className="container-narrow stack stack-6" style={{ alignItems: 'center' }}>
        <span className="notfound__code text-gradient">۴۰۴</span>
        <h1 className="h2">این صفحه پیدا نشد</h1>
        <p className="lead" style={{ maxWidth: '38ch' }}>
          ممکن است آدرس تغییر کرده باشد. از این‌جا می‌توانید ادامه دهید:
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="chip">
              <Icon name={l.icon} size={15} />
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/" className="btn btn--primary btn--lg">
          بازگشت به صفحه‌ی اصلی
          <Icon name="arrowLeft" size={18} className="btn__arrow" />
        </Link>
      </div>
    </section>
  );
}
