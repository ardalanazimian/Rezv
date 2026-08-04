import type { Metadata } from 'next';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { OrderLookup } from '@/components/order/OrderLookup';
import { buildMetadata } from '@/lib/seo';

// صفحه‌ی ورودیِ پیگیری. عمداً noindex: محتوای ایندکس‌پذیری ندارد و فقط برای
// کسی معنا دارد که کدِ پیگیری در دست دارد.
export const metadata: Metadata = buildMetadata({
  title: 'پیگیریِ درخواست',
  description: 'وضعیتِ درخواستِ دمو یا خریدِ اشتراکِ خود را با کدِ پیگیری ببینید.',
  path: '/order',
  noindex: true,
});

const STAGES = [
  { icon: 'check', title: 'ثبتِ درخواست', body: 'درخواستِ شما در سیستم ثبت و کدِ پیگیری صادر می‌شود.' },
  { icon: 'phone', title: 'بررسی و تماس', body: 'کارشناسِ فروش برای هماهنگیِ پرداخت با شما تماس می‌گیرد.' },
  { icon: 'rocket', title: 'فعال‌سازی', body: 'پس از تأیید، اشتراک از پنلِ شرکت فعال و تاریخِ انقضا ثبت می‌شود.' },
];

export default function OrderIndexPage() {
  return (
    <section className="section">
      <div className="container-narrow stack stack-8">
        <div className="section-head">
          <span className="eyebrow"><Icon name="target" size={14} />پیگیری</span>
          <h1 className="h1">وضعیتِ درخواستتان را ببینید</h1>
          <p className="lead">
            کدِ پیگیری (مثلِ <span style={{ direction: 'ltr', display: 'inline-block' }}>RZO-XXXXXX</span>) را وارد کنید
            تا مرحله‌ی دقیقِ درخواست را ببینید.
          </p>
        </div>

        <Reveal><OrderLookup /></Reveal>

        <Reveal delay={80}>
          <div className="stack stack-4">
            <h2 className="h4">مسیرِ یک درخواست</h2>
            <ol className="status-track">
              {STAGES.map((s) => (
                <li key={s.title} className="status-step" data-state="done">
                  <span className="status-step__icon"><Icon name={s.icon} size={16} /></span>
                  <span className="stack stack-1">
                    <b className="small">{s.title}</b>
                    <span className="tiny muted">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
