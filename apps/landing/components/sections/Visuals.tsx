// ═══════════════════════════════════════════════════════════════════════
//  تصویرسازی‌های محصولی — همه با SVG/CSS، بدونِ فایلِ تصویر
//
//  چرا نه اسکرین‌شات: اسکرین‌شاتِ واقعی سریع کهنه می‌شود، در حالتِ تاریک
//  بد به‌نظر می‌رسد و کیلوبایت اضافه می‌کند. این پنل‌ها همان ساختارِ واقعیِ
//  محصول را نشان می‌دهند، در هر دو تم درست‌اند و وزنشان تقریباً صفر است.
//
//  همه aria-hidden هستند: معنا در متنِ کنارشان است، نه در تصویر.
// ═══════════════════════════════════════════════════════════════════════
import { Icon } from '../site/Icon';

const initials = (name: string) => name.trim().slice(0, 1);

/** پنلِ رزروهای امشب — پنلِ پیش‌فرضِ هیروی صفحه‌ی اصلی. */
function ReservationPanel() {
  const rows = [
    { name: 'سارا محمدی', sub: '۴ نفر · میز ۷ · کنارِ پنجره', time: '۲۰:۰۰', accent: true, tag: 'نشسته' },
    { name: 'امیر رضایی', sub: '۲ نفر · میز ۳', time: '۲۰:۳۰', tag: 'تأییدشده' },
    { name: 'نگار کریمی', sub: '۶ نفر · میز ۱۱+۱۲', time: '۲۱:۰۰', tag: 'تأییدشده' },
    { name: 'حسین اکبری', sub: '۳ نفر · لیستِ انتظار', time: '۲۱:۱۵', tag: 'در صف' },
  ];
  return (
    <div className="viz float float--slow" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">رزروهای امشب</span>
        <span className="row" style={{ gap: 6 }}>
          <span className="pulse-dot" />
          <span className="tiny muted">زنده</span>
        </span>
      </div>

      {rows.map((r) => (
        <div key={r.name} className={`viz__row${r.accent ? ' viz__row--accent' : ''}`}>
          <span className="viz__avatar">{initials(r.name)}</span>
          <span className="viz__meta">
            <span className="viz__name">{r.name}</span>
            <span className="viz__sub">{r.sub}</span>
          </span>
          <span className="viz__time">{r.time}</span>
        </div>
      ))}

      <div className="viz__kpis">
        <div className="viz__kpi"><b>۸۶٪</b><span>اشغالِ ظرفیت</span></div>
        <div className="viz__kpi"><b>۴۲</b><span>مهمانِ امشب</span></div>
        <div className="viz__kpi"><b>۳</b><span>در لیستِ انتظار</span></div>
      </div>
    </div>
  );
}

/** نقشه‌ی سالن — وضعیتِ میزها. */
function FloorPanel() {
  const states = [
    'seated', 'free', 'booked', 'free',
    'booked', 'seated', 'free', 'seated',
    'free', 'booked', 'seated', 'free',
  ] as const;
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">نقشه‌ی سالن</span>
        <span className="tiny muted">۱۲ میز</span>
      </div>
      <div className="viz__floor">
        {states.map((state, i) => (
          <div key={i} className="viz__table" data-state={state}>
            {'۱۲۳۴۵۶۷۸۹'.charAt(i) || `۱${'۰۱۲'.charAt(i - 9)}`}
          </div>
        ))}
      </div>
      <div className="viz__legend">
        <span><i style={{ background: 'var(--success)' }} />آزاد</span>
        <span><i style={{ background: 'var(--warning)' }} />رزروشده</span>
        <span><i style={{ background: 'var(--brand)' }} />نشسته</span>
      </div>
    </div>
  );
}

/** داشبوردِ تحلیل — اشغال به تفکیکِ ساعت. */
function DashboardPanel() {
  const bars = [34, 48, 40, 62, 78, 92, 86, 70, 52];
  const hours = ['۱۷', '۱۸', '۱۹', '۲۰', '۲۱', '۲۲', '۲۳'];
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">اشغالِ ظرفیت — این هفته</span>
        <span className="badge badge--success">+۱۸٪</span>
      </div>
      <div className="viz__chart">
        {bars.map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 55}ms` }} />
        ))}
      </div>
      <div className="viz__legend" style={{ justifyContent: 'space-between' }}>
        {hours.map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="viz__kpis">
        <div className="viz__kpi"><b>۴٫۸</b><span>امتیازِ مهمان</span></div>
        <div className="viz__kpi"><b>۳۱٪</b><span>بازگشتِ مهمان</span></div>
        <div className="viz__kpi"><b>۲٫۱٪</b><span>نیامدن</span></div>
      </div>
    </div>
  );
}

/** قابِ گوشی — تجربه‌ی اپِ مشتری. */
function PhonePanel() {
  const slots = [
    { t: '۱۸:۰۰', s: 'free' }, { t: '۱۸:۳۰', s: 'free' }, { t: '۱۹:۰۰', s: 'full' },
    { t: '۱۹:۳۰', s: 'picked' }, { t: '۲۰:۰۰', s: 'free' }, { t: '۲۰:۳۰', s: 'full' },
  ] as const;
  return (
    <div className="phone-frame float" aria-hidden="true">
      <span className="phone-frame__notch" />
      <div className="phone-frame__screen">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small" style={{ fontWeight: 800 }}>انتخابِ زمان</span>
          <span className="badge badge--brand">۴ نفر</span>
        </div>
        <div className="viz__row" style={{ padding: 'var(--sp-2) var(--sp-3)' }}>
          <span className="viz__avatar" style={{ width: 28, height: 28 }}>و</span>
          <span className="viz__meta">
            <span className="viz__name">کافه‌رستوران نمونه</span>
            <span className="viz__sub">ایتالیایی · ۴٫۷ ★</span>
          </span>
        </div>
        <div className="slotgrid">
          {slots.map((s) => (
            <span key={s.t} className="slot" data-state={s.s}>{s.t}</span>
          ))}
        </div>
        <button type="button" className="btn btn--primary btn--sm btn--block" tabIndex={-1}>
          تأییدِ رزرو
        </button>
        <p className="tiny muted" style={{ textAlign: 'center' }}>لغو تا ۲ ساعت قبل، رایگان</p>
      </div>
    </div>
  );
}

/** جست‌وجوی مهمان. */
function SearchPanel() {
  const results = [
    { name: 'رستورانِ نمونه‌ی اول', sub: 'تهران · ایتالیایی · ۴٫۸ ★', badge: 'ظرفیت دارد' },
    { name: 'رستورانِ نمونه‌ی دوم', sub: 'تهران · ایرانی · ۴٫۶ ★', badge: '۲ میز' },
    { name: 'رستورانِ نمونه‌ی سوم', sub: 'تهران · فیوژن · ۴٫۵ ★', badge: 'لیستِ انتظار' },
  ];
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">جست‌وجوی مهمان</span>
        <Icon name="search" size={16} />
      </div>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        <span className="chip" data-active="true">تهران</span>
        <span className="chip">امشب</span>
        <span className="chip">۴ نفر</span>
      </div>
      {results.map((r, i) => (
        <div key={r.name} className={`viz__row${i === 0 ? ' viz__row--accent' : ''}`}>
          <span className="viz__avatar">{initials(r.name.replace('رستورانِ ', ''))}</span>
          <span className="viz__meta">
            <span className="viz__name">{r.name}</span>
            <span className="viz__sub">{r.sub}</span>
          </span>
          <span className="badge badge--success">{r.badge}</span>
        </div>
      ))}
    </div>
  );
}

/** رشد — بخش‌بندیِ مشتری. */
function GrowthPanel() {
  const segments = [
    { label: 'مهمانِ وفادار', value: 38, tone: 'var(--brand)' },
    { label: 'مهمانِ تازه', value: 44, tone: 'var(--brass-500)' },
    { label: 'در حالِ از دست رفتن', value: 18, tone: 'var(--brass-500)' },
  ];
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">بخش‌بندیِ مشتریان</span>
        <span className="tiny muted">۳۰ روزِ اخیر</span>
      </div>
      {segments.map((s) => (
        <div key={s.label} className="stack stack-2">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small" style={{ fontWeight: 600 }}>{s.label}</span>
            <span className="small muted">{`${s.value}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}٪</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ width: `${s.value}%`, height: '100%', background: s.tone, borderRadius: 99 }} />
          </div>
        </div>
      ))}
      <div className="viz__row viz__row--accent">
        <Icon name="megaphone" size={17} />
        <span className="viz__meta">
          <span className="viz__name">کمپینِ بازگشتِ مهمان</span>
          <span className="viz__sub">۱۸۲ گیرنده · ۲۹٪ بازگشت</span>
        </span>
      </div>
    </div>
  );
}

/** اتوماسیونِ پس از حضور. */
function AutomationPanel() {
  const flow = [
    { icon: 'checkCircle', title: 'مهمان حاضر شد', sub: 'وضعیتِ رزرو: نشسته' },
    { icon: 'gift', title: 'امتیاز ثبت شد', sub: 'خودکار — بدونِ دخالتِ تیم' },
    { icon: 'chat', title: 'پیامِ تشکر', sub: '۲ ساعت بعد از حضور' },
    { icon: 'star', title: 'دعوت به ثبتِ نظر', sub: 'روزِ بعد' },
  ];
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">اتوماسیونِ پس از حضور</span>
        <span className="badge badge--brand">فعال</span>
      </div>
      {flow.map((f, i) => (
        <div key={f.title} className="viz__row" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="icon-tile" style={{ width: 32, height: 32 }}>
            <Icon name={f.icon} size={16} />
          </span>
          <span className="viz__meta">
            <span className="viz__name">{f.title}</span>
            <span className="viz__sub">{f.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** لایه‌های پلتفرم. */
function LayersPanel() {
  const layers = [
    { icon: 'search', title: 'کشف و رزرو', sub: 'اپِ مشتری + صفحه‌ی سئو' },
    { icon: 'layout', title: 'عملیاتِ سالن', sub: 'پنلِ کسب‌وکار' },
    { icon: 'users', title: 'رابطه و رشد', sub: 'CRM، کمپین، وفاداری' },
    { icon: 'chart', title: 'تحلیل و مدیریت', sub: 'گزارش، شعبه، دسترسی' },
  ];
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">لایه‌های پلتفرم</span>
        <span className="tiny muted">یک دادهٔ مشترک</span>
      </div>
      {layers.map((l, i) => (
        <div key={l.title} className={`viz__row${i === 1 ? ' viz__row--accent' : ''}`}>
          <span className="icon-tile" style={{ width: 34, height: 34 }}>
            <Icon name={l.icon} size={17} />
          </span>
          <span className="viz__meta">
            <span className="viz__name">{l.title}</span>
            <span className="viz__sub">{l.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** جریانِ دوطرفه — همان رویداد، دو نما. */
function FlowPanel() {
  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__bar">
        <span className="viz__title">یک رویداد، دو نما</span>
      </div>
      <div className="viz__row">
        <span className="icon-tile" style={{ width: 32, height: 32 }}><Icon name="phone" size={16} /></span>
        <span className="viz__meta">
          <span className="viz__name">مهمان رزرو کرد</span>
          <span className="viz__sub">اپِ مشتری · ۱۹:۴۲</span>
        </span>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <Icon name="chevronDown" size={18} />
      </div>
      <div className="viz__row viz__row--accent">
        <span className="icon-tile" style={{ width: 32, height: 32 }}><Icon name="layout" size={16} /></span>
        <span className="viz__meta">
          <span className="viz__name">میز ۷ رزرو شد</span>
          <span className="viz__sub">پنلِ کسب‌وکار · همان لحظه</span>
        </span>
      </div>
      <div className="viz__kpis">
        <div className="viz__kpi"><b>۰</b><span>ورودِ دستی</span></div>
        <div className="viz__kpi"><b>۰</b><span>همگام‌سازی</span></div>
        <div className="viz__kpi"><b>۱</b><span>منبعِ حقیقت</span></div>
      </div>
    </div>
  );
}

import { ServiceNight } from './ServiceNight';

const PANELS: Record<string, () => JSX.Element> = {
  reservation: ReservationPanel,
  floor: FloorPanel,
  dashboard: DashboardPanel,
  phone: PhonePanel,
  search: SearchPanel,
  growth: GrowthPanel,
  automation: AutomationPanel,
  layers: LayersPanel,
  flow: FlowPanel,
};

/** انتخابِ پنل بر اساسِ نامِ آمده از CMS؛ نامِ ناشناخته → پنلِ پیش‌فرض. */
export function Visual({ kind }: { kind?: string }) {
  // پنلِ رزرو دیگر تصویرِ ثابت نیست: صحنه‌ی زنده‌ی «شبِ سرویس» جایش را گرفته
  // که با اسکرول پیش می‌رود. بقیه‌ی پنل‌ها همان تصویرسازی‌های SVG می‌مانند.
  if (!kind || kind === 'reservation') return <ServiceNight />;
  const Panel = PANELS[kind] || ReservationPanel;
  return <Panel />;
}
