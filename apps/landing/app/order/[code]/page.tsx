import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { OrderLookup } from '@/components/order/OrderLookup';
import { getOrderStatus, type OrderStatus } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { toman, faNum, faDate, fa } from '@/lib/format';

// وضعیتِ سفارش همیشه تازه خوانده می‌شود — کاربر باید حالِ لحظه‌ای را ببیند،
// نه نسخه‌ی کش‌شده‌ی ده دقیقه پیش.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'وضعیتِ درخواست',
  description: 'مرحله‌ی فعلیِ درخواستِ دمو یا خریدِ اشتراکِ شما.',
  path: '/order',
  noindex: true,
});

type StepState = 'done' | 'current' | 'pending' | 'failed';

interface Step { icon: string; title: string; body: string; state: StepState }

/** ماشینِ حالتِ سفارش → مراحلِ قابلِ‌فهم برای کاربر. */
function stepsFor(order: OrderStatus): Step[] {
  if (order.kind === 'trial') {
    return [
      { icon: 'check', title: 'حسابِ دمو ساخته شد', body: 'پنلِ کسب‌وکارِ شما از همان لحظه فعال است.', state: 'done' },
      {
        icon: 'clock',
        title: 'دوره‌ی آزمایشی در جریان است',
        body: order.trial_ends_at ? `تا ${faDate(order.trial_ends_at)} دسترسیِ کامل دارید.` : 'دسترسیِ کاملِ ۳۰ روزه.',
        state: 'current',
      },
      { icon: 'ticket', title: 'انتخابِ اشتراک', body: 'هر وقت خواستید، از صفحه‌ی قیمت‌گذاری اشتراک بگیرید.', state: 'pending' },
    ];
  }

  const registered: Step = { icon: 'check', title: 'درخواست ثبت شد', body: `ثبت‌شده در ${faDate(order.created_at)}`, state: 'done' };

  if (order.status === 'rejected' || order.status === 'cancelled') {
    return [
      registered,
      {
        icon: 'x',
        title: order.status === 'rejected' ? 'درخواست رد شد' : 'درخواست لغو شد',
        body: order.rejected_reason || 'برای جزئیات با پشتیبانی تماس بگیرید.',
        state: 'failed',
      },
    ];
  }

  const contacted = order.status === 'contacted' || order.status === 'activated';
  const activated = order.status === 'activated';

  return [
    registered,
    {
      icon: 'phone',
      title: 'بررسی و هماهنگیِ پرداخت',
      body: contacted ? 'کارشناسِ فروش با شما در تماس بوده است.' : 'کارشناسِ فروش در نخستین فرصتِ کاری تماس می‌گیرد.',
      state: activated ? 'done' : contacted ? 'current' : 'current',
    },
    {
      icon: 'rocket',
      title: 'فعال‌سازیِ اشتراک',
      body: activated
        ? `اشتراک فعال شد${order.plan_expires_at ? ` — اعتبار تا ${faDate(order.plan_expires_at)}` : ''}.`
        : 'پس از تأییدِ پرداخت، اشتراک از پنلِ شرکت فعال می‌شود.',
      state: activated ? 'done' : 'pending',
    },
  ];
}

const STATUS_LABEL: Record<OrderStatus['status'], { label: string; tone: string }> = {
  pending: { label: 'در انتظارِ بررسی', tone: 'badge--warning' },
  contacted: { label: 'در حالِ پیگیری', tone: 'badge--info' },
  activated: { label: 'فعال شد', tone: 'badge--success' },
  rejected: { label: 'رد شد', tone: 'badge--danger' },
  cancelled: { label: 'لغو شد', tone: 'badge' },
};

export default async function OrderStatusPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await getOrderStatus(decodeURIComponent(code));

  if (!order) {
    return (
      <section className="section">
        <div className="container-narrow stack stack-8">
          <div className="section-head">
            <h1 className="h1">درخواستی با این کد پیدا نشد</h1>
            <p className="lead">
              کد را دوباره بررسی کنید. اگر تازه ثبت کرده‌اید، چند لحظه صبر کنید و دوباره تلاش کنید.
            </p>
          </div>
          <OrderLookup initial={decodeURIComponent(code)} />
          <p className="small muted">
            همچنان مشکل دارید؟ <Link href="/contact" className="prose">با پشتیبانی تماس بگیرید</Link>.
          </p>
        </div>
      </section>
    );
  }

  const steps = stepsFor(order);
  const status = STATUS_LABEL[order.status];

  return (
    <section className="section">
      <div className="container-narrow stack stack-8">
        <Reveal>
          <div className="stack stack-4">
            <span className="eyebrow"><Icon name="target" size={14} />پیگیریِ درخواست</span>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h1 className="h1">{order.business_name}</h1>
              <span className={`badge ${status.tone}`}>{status.label}</span>
            </div>
            <span className="code-pill">{order.code}</span>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="card stack stack-4">
            <h2 className="h4">جزئیاتِ درخواست</h2>
            <dl className="form-grid form-grid--2" style={{ margin: 0 }}>
              <div className="stack stack-1">
                <dt className="tiny muted">نوعِ درخواست</dt>
                <dd className="small" style={{ margin: 0, fontWeight: 600 }}>
                  {order.kind === 'trial' ? 'دموی رایگانِ ۳۰ روزه' : 'خریدِ اشتراک'}
                </dd>
              </div>
              {order.plan_name && (
                <div className="stack stack-1">
                  <dt className="tiny muted">پلن</dt>
                  <dd className="small" style={{ margin: 0, fontWeight: 600 }}>
                    {order.plan_name}{order.months ? ` — ${faNum(order.months)} ماه` : ''}
                  </dd>
                </div>
              )}
              {order.amount_toman != null && (
                <div className="stack stack-1">
                  <dt className="tiny muted">مبلغ</dt>
                  <dd className="small" style={{ margin: 0, fontWeight: 600 }}>{toman(order.amount_toman)}</dd>
                </div>
              )}
              <div className="stack stack-1">
                <dt className="tiny muted">تاریخِ ثبت</dt>
                <dd className="small" style={{ margin: 0, fontWeight: 600 }}>{faDate(order.created_at)}</dd>
              </div>
              {order.trial_ends_at && (
                <div className="stack stack-1">
                  <dt className="tiny muted">پایانِ دوره‌ی آزمایشی</dt>
                  <dd className="small" style={{ margin: 0, fontWeight: 600 }}>{faDate(order.trial_ends_at)}</dd>
                </div>
              )}
              {order.plan_expires_at && (
                <div className="stack stack-1">
                  <dt className="tiny muted">اعتبارِ اشتراک تا</dt>
                  <dd className="small" style={{ margin: 0, fontWeight: 600 }}>{faDate(order.plan_expires_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="stack stack-4">
            <h2 className="h4">مرحله‌ی فعلی</h2>
            <ol className="status-track">
              {steps.map((step) => (
                <li key={step.title} className="status-step" data-state={step.state}>
                  <span className="status-step__icon"><Icon name={step.icon} size={16} /></span>
                  <span className="stack stack-1">
                    <b className="small">{step.title}</b>
                    <span className="tiny muted">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="row">
            {order.status === 'activated' ? (
              <Link href="/login" className="btn btn--primary">
                ورود به پنلِ کسب‌وکار
                <Icon name="arrowLeft" size={16} className="btn__arrow" />
              </Link>
            ) : order.kind === 'trial' ? (
              <Link href="/pricing" className="btn btn--primary">
                دیدنِ پلن‌های اشتراک
                <Icon name="arrowLeft" size={16} className="btn__arrow" />
              </Link>
            ) : (
              <Link href="/contact" className="btn btn--primary">
                پیگیری از کارشناس
                <Icon name="arrowLeft" size={16} className="btn__arrow" />
              </Link>
            )}
            <Link href="/order" className="btn btn--ghost">پیگیریِ کدِ دیگر</Link>
          </div>
        </Reveal>

        <p className="tiny muted">
          این صفحه وضعیتِ لحظه‌ای را نشان می‌دهد؛ برای دیدنِ تغییرات کافی است صفحه را تازه کنید.
          دوره‌ی آزمایشی {fa(30)} روزه است و به‌صورتِ خودکار به اشتراکِ پولی تبدیل نمی‌شود.
        </p>
      </div>
    </section>
  );
}
