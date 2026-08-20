import React, { useState, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════
//  RestaurantIntelligenceDashboard — تب جدید پنل رستوران رزرونو
//  پوشش‌دهنده: CLV، پیش‌بینی no-show، سگمنت مشتری، پیشنهاد هوشمند،
//  کمپین خودکار، دسترسی کارکنان.
//  هماهنگ با هویت بصری موجود: آبی #2563EB + سبزآبی #14B8A6، فونت Vazirmatn، RTL.
//  بدون API واقعی با داده‌ی نمونه کار می‌کند (مثل الگوی سه فرانت‌اند فعلی).
// ═══════════════════════════════════════════════════════════════════════

const COLORS = { blue: '#2563EB', teal: '#14B8A6', bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', sub: '#64748B', border: '#E2E8F0' };

const SEGMENT_META = {
  vip:           { label: 'VIP',         fg: '#92400E', bg: '#FEF3C7' },
  active:        { label: 'فعال',         fg: '#065F46', bg: '#D1FAE5' },
  at_risk:       { label: 'در خطر ریزش',  fg: '#9A3412', bg: '#FFEDD5' },
  churned:       { label: 'ازدست‌رفته',   fg: '#991B1B', bg: '#FEE2E2' },
  new_customer:  { label: 'مشتری جدید',  fg: '#1E40AF', bg: '#DBEAFE' },
};

const MOCK_CUSTOMERS = [
  { user_id: '1', name: 'نیلوفر رضایی', phone: '0912***4471', total_visits: 14, predicted_clv_toman: 5200000, no_show_rate_pct: 0, churn_risk_score: 8, segment: 'vip', is_vip: true },
  { user_id: '2', name: 'امیر کاظمی', phone: '0935***1102', total_visits: 6, predicted_clv_toman: 1100000, no_show_rate_pct: 33, churn_risk_score: 62, segment: 'at_risk', is_vip: false },
  { user_id: '3', name: 'سارا محمدی', phone: '0919***8820', total_visits: 1, predicted_clv_toman: 700000, no_show_rate_pct: 0, churn_risk_score: 20, segment: 'new_customer', is_vip: false },
  { user_id: '4', name: 'رضا عباسی', phone: '0901***3340', total_visits: 9, predicted_clv_toman: 380000, no_show_rate_pct: 55, churn_risk_score: 88, segment: 'churned', is_vip: false },
];

const MOCK_CARDS = [
  { id: 'winback', severity: 'high', title: '۱۲ مشتری در آستانه‌ی ریزش هستند', detail: '۲۸٪ از مشتریان فعال بیش از حد معمول غیبت کرده‌اند. یک کمپین Win-back می‌تواند بخشی را برگرداند.', action_label: 'ساخت کمپین Win-back' },
  { id: 'noshow_upcoming', severity: 'medium', title: '۳ رزرو پرریسک در ۴۸ ساعت آینده', detail: 'این مهمان‌ها سابقه‌ی no-show دارند. یادآوری اضافه می‌تواند نرخ غیبت را کم کند.', action_label: 'ارسال یادآوری گروهی' },
  { id: 'slow_day', severity: 'low', title: 'سه‌شنبه‌ها کم‌تردد‌ترین روز شماست', detail: 'یک کوپن مخصوص همین روز می‌تواند ظرفیت خالی را پر کند.', action_label: 'ساخت کوپن روز کم‌تردد' },
];

function fmtToman(n) { return n.toLocaleString('fa-IR') + ' تومان'; }
function fa(n) { return Number(n).toLocaleString('fa-IR'); }

function Badge({ meta }) {
  return <span style={{ background: meta.bg, color: meta.fg, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>{meta.label}</span>;
}
function RiskBar({ value, color }) {
  return (
    <div style={{ width: 60, height: 6, background: '#EEF2F7', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  );
}
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{
            flex: '0 0 auto', padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'Vazirmatn, sans-serif', fontWeight: 600, fontSize: 13.5,
            background: active === t.key ? COLORS.blue : 'transparent',
            color: active === t.key ? '#fff' : COLORS.sub,
          }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || COLORS.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CustomersTab({ customers }) {
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('clv');
  const filtered = useMemo(() => {
    const list = segment === 'all' ? customers : customers.filter(c => c.segment === segment);
    return [...list].sort((a, b) => sort === 'churn' ? b.churn_risk_score - a.churn_risk_score
      : sort === 'visits' ? b.total_visits - a.total_visits
      : b.predicted_clv_toman - a.predicted_clv_toman);
  }, [customers, segment, sort]);

  const totalClv = customers.reduce((s, c) => s + c.predicted_clv_toman, 0);
  const vipCount = customers.filter(c => c.is_vip).length;
  const atRiskCount = customers.filter(c => c.segment === 'at_risk' || c.segment === 'churned').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="ارزش طول عمر کل (پیش‌بینی ۱۲ ماه)" value={fmtToman(totalClv)} accent={COLORS.blue} />
        <StatCard label="مشتریان VIP" value={fa(vipCount)} accent="#92400E" />
        <StatCard label="در خطر ریزش" value={fa(atRiskCount)} accent="#9A3412" sub="نیاز به اقدام" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'vip', 'active', 'at_risk', 'churned', 'new_customer'].map(s => (
          <button key={s} onClick={() => setSegment(s)}
            style={{
              border: `1px solid ${segment === s ? COLORS.blue : COLORS.border}`,
              background: segment === s ? '#EFF6FF' : '#fff', color: segment === s ? COLORS.blue : COLORS.sub,
              borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn, sans-serif',
            }}>
            {s === 'all' ? 'همه' : SEGMENT_META[s].label}
          </button>
        ))}
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ marginRight: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '6px 10px', fontFamily: 'Vazirmatn, sans-serif', fontSize: 12.5 }}>
          <option value="clv">مرتب‌سازی: ارزش طول عمر</option>
          <option value="churn">مرتب‌سازی: ریسک ریزش</option>
          <option value="visits">مرتب‌سازی: تعداد بازدید</option>
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <div key={c.user_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
              {c.name[0]}
            </div>
            <div style={{ minWidth: 130 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: COLORS.sub }}>{c.phone} · {fa(c.total_visits)} بازدید</div>
            </div>
            <Badge meta={SEGMENT_META[c.segment]} />
            <div style={{ minWidth: 110 }}>
              <div style={{ fontSize: 11, color: COLORS.sub }}>CLV پیش‌بینی</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.blue }}>{fmtToman(c.predicted_clv_toman)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.sub }}>ریسک ریزش</div>
                <RiskBar value={c.churn_risk_score} color={c.churn_risk_score > 60 ? '#DC2626' : c.churn_risk_score > 30 ? '#D97706' : '#16A34A'} />
              </div>
            </div>
            {c.no_show_rate_pct > 0 && (
              <span style={{ fontSize: 11.5, color: '#9A3412', background: '#FFEDD5', padding: '4px 8px', borderRadius: 8 }}>
                {fa(c.no_show_rate_pct)}٪ no-show
              </span>
            )}
            <button style={{ marginRight: 'auto', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '6px 12px', fontSize: 12, fontFamily: 'Vazirmatn, sans-serif', cursor: 'pointer', color: COLORS.blue, fontWeight: 600 }}>
              مشاهده‌ی پروفایل
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: COLORS.sub, fontSize: 13 }}>مشتری‌ای در این سگمنت نیست</div>}
      </div>
    </div>
  );
}

function AICard({ card }) {
  const sevColor = { high: '#DC2626', medium: '#D97706', low: COLORS.teal }[card.severity];
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRight: `4px solid ${sevColor}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{card.title}</div>
      <div style={{ fontSize: 12.5, color: COLORS.sub, lineHeight: 1.7 }}>{card.detail}</div>
      <button style={{ marginTop: 12, background: COLORS.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'Vazirmatn, sans-serif', cursor: 'pointer' }}>
        {card.action_label} ←
      </button>
    </div>
  );
}

function AutomationsTab() {
  const triggers = [
    { key: 'birthday', label: '🎂 یادآوری تولد', desc: 'چند روز قبل از تولد مشتری، پیام و کد تخفیف خودکار ارسال می‌شود.' },
    { key: 'winback', label: '↩️ بازگشت مشتری در خطر', desc: 'مشتریانی که مدتی غیبت کرده‌اند، به‌صورت خودکار شناسایی و دعوت می‌شوند.' },
    { key: 'vip_milestone', label: '👑 ارتقای VIP', desc: 'وقتی مشتری به سطح VIP می‌رسد، پیام تشکر ویژه ارسال می‌شود.' },
    { key: 'no_show_followup', label: '⚠️ پیگیری no-show', desc: 'بعد از غیبت، پیشنهاد بازگشت با تخفیف ارسال می‌شود.' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
      {triggers.map(t => (
        <div key={t.key} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t.label}</div>
          <div style={{ fontSize: 12, color: COLORS.sub, lineHeight: 1.7, marginBottom: 12 }}>{t.desc}</div>
          <button style={{ width: '100%', background: '#EFF6FF', color: COLORS.blue, border: 'none', borderRadius: 10, padding: '8px', fontSize: 12.5, fontWeight: 700, fontFamily: 'Vazirmatn, sans-serif', cursor: 'pointer' }}>
            فعال‌سازی
          </button>
        </div>
      ))}
    </div>
  );
}

function StaffTab() {
  const staff = [
    { id: 1, phone: '0912***0001', role: 'owner' },
    { id: 2, phone: '0935***2210', role: 'staff' },
  ];
  const [perms, setPerms] = useState({ canViewAnalytics: false, canViewRevenue: false, canManageCampaigns: false });
  const modules = [
    { key: 'canViewAnalytics', label: 'مشاهده‌ی آنالیتیکس' },
    { key: 'canViewRevenue', label: 'مشاهده‌ی گزارش درآمد' },
    { key: 'canManageCampaigns', label: 'مدیریت کمپین‌ها' },
  ];
  return (
    <div>
      {staff.map(s => (
        <div key={s.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: s.role === 'owner' ? 0 : 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.phone}</div>
            <Badge meta={{ label: s.role === 'owner' ? 'مدیر کل' : 'کارمند', fg: COLORS.blue, bg: '#EFF6FF' }} />
          </div>
          {s.role !== 'owner' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
              {modules.map(m => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: COLORS.text, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!perms[m.key]} onChange={e => setPerms(p => ({ ...p, [m.key]: e.target.checked }))} />
                  {m.label}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RestaurantIntelligenceDashboard() {
  const [tab, setTab] = useState('customers');
  const [customers] = useState(MOCK_CUSTOMERS);
  const [cards] = useState(MOCK_CARDS);

  const tabs = [
    { key: 'customers', label: 'مشتریان', icon: '👥' },
    { key: 'ai', label: 'پیشنهاد هوشمند', icon: '✨' },
    { key: 'automations', label: 'کمپین خودکار', icon: '📣' },
    { key: 'staff', label: 'دسترسی کارکنان', icon: '🔐' },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: 'Vazirmatn, sans-serif', background: COLORS.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, margin: 0 }}>هوش مشتری و رشد رستوران</h1>
          <p style={{ fontSize: 13, color: COLORS.sub, margin: '4px 0 0' }}>CLV، پیش‌بینی no-show، سگمنت‌بندی و پیشنهادهای عملیاتی — به‌روزرسانی شبانه</p>
        </div>
        <div style={{ marginBottom: 18 }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        {tab === 'customers' && <CustomersTab customers={customers} />}
        {tab === 'ai' && <div>{cards.map(c => <AICard key={c.id} card={c} />)}</div>}
        {tab === 'automations' && <AutomationsTab />}
        {tab === 'staff' && <StaffTab />}
      </div>
    </div>
  );
}
