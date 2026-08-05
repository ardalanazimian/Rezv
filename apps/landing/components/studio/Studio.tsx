'use client';

// ═══════════════════════════════════════════════════════════════════════
//  استودیوی محتوا — کنسولِ مدیریتیِ وب‌سایت
//
//  یک محیطِ کاریِ واقعی، نه صفحه‌ی نمایشی:
//    • ورود با همان OTPِ مدیرِ پلتفرم (بدونِ سیستمِ کاربریِ موازی)
//    • نمای کلی: صفِ فروش، درآمدِ فعال‌شده و وضعیتِ محتوا
//    • CRUD کاملِ هفت مجموعه‌ی محتوایی + فیلدهای سئو
//    • صفِ درخواست‌ها با فعال‌سازی/رد و صندوقِ ورودیِ تماس‌ها
//
//  همه‌ی نوشتن‌ها از API عبور می‌کنند و روی سایتِ زنده اثر می‌گذارند
//  (کشِ نمای عمومی همان لحظه باطل می‌شود).
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../site/Icon';
import { RecordEditor } from './RecordEditor';
import { COLLECTIONS, collectionByKey } from './fields';
import { toman, faNum, faDate, faRelative, fa } from '@/lib/format';
import { ApiError } from '@/lib/client-api';
import {
  studio, getToken, setToken, studioApiConfigured, revalidateSite,
  type CollectionListResponse, type OverviewResponse, type OrderRow, type InquiryRow,
} from '@/lib/studio-api';

type View = { kind: 'overview' } | { kind: 'collection'; key: string } | { kind: 'orders' } | { kind: 'inquiries' };
type Values = Record<string, unknown>;

/**
 * اجرای نخستین بارگذاری بعد از mount.
 *
 * چرا microtask و نه فراخوانِ مستقیم: خودِ loader در نخستین خط setState
 * («در حال بارگذاری») می‌کند و صدازدنش همزمان با افکت، یک رندرِ آبشاری
 * می‌سازد. تعویق به microtaskِ بعدی همان نتیجه را بدونِ آن رندر می‌دهد.
 * cancel هم می‌شود تا بعد از unmount چیزی ست نشود.
 */
function useInitialLoad(load: () => void | Promise<unknown>): void {
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);
}

// ═══════════════ ورود ═══════════════

function Login({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true); setError(null);
    try {
      const res = await studio.requestOtp(phone.trim());
      setDevCode(res?.devCode ?? null);
      setStep('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ارسالِ کد ناموفق بود.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    try {
      const res = await studio.verifyOtp(phone.trim(), code.trim());
      setToken(res.access);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'کد نامعتبر است.');
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow section">
      <form
        className="form-card"
        onSubmit={(e) => { e.preventDefault(); step === 'phone' ? sendCode() : verify(); }}
        noValidate
      >
        <div className="stack stack-2">
          <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>
            <Icon name="lock" size={14} />استودیوی محتوا
          </span>
          <h1 className="h3">ورودِ مدیرِ پلتفرم</h1>
          <p className="small muted">
            این بخش فقط برای تیمِ رزرونو است. ورود با همان شماره‌ای که در پنلِ شرکت استفاده می‌کنید.
          </p>
        </div>

        {step === 'phone' ? (
          <div className="field">
            <label className="label" htmlFor="st-phone">شماره‌ی موبایل</label>
            <input
              id="st-phone" className="input input--ltr" value={phone}
              onChange={(e) => setPhone(e.target.value)} inputMode="tel"
              placeholder="09120000000" autoComplete="tel" required
            />
          </div>
        ) : (
          <div className="field">
            <label className="label" htmlFor="st-code">کدِ پیامک‌شده</label>
            <input
              id="st-code" className="input input--ltr" value={code}
              onChange={(e) => setCode(e.target.value)} inputMode="numeric"
              placeholder="------" autoComplete="one-time-code" required autoFocus
            />
            {devCode && (
              <span className="tiny muted">کدِ حالتِ توسعه: <b style={{ direction: 'ltr' }}>{devCode}</b></span>
            )}
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setStep('phone'); setCode(''); }}>
              تغییرِ شماره
            </button>
          </div>
        )}

        {error && (
          <div className="notice notice--error" role="alert">
            <Icon name="x" size={18} /><span>{error}</span>
          </div>
        )}

        {!studioApiConfigured() && (
          <div className="notice notice--warning">
            <Icon name="x" size={18} />
            <span>آدرسِ API پیکربندی نشده است (NEXT_PUBLIC_API_BASE).</span>
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? <><span className="spinner" />لطفاً صبر کنید…</> : step === 'phone' ? 'ارسالِ کد' : 'ورود'}
        </button>
      </form>
    </div>
  );
}

// ═══════════════ نمای کلی ═══════════════

function Overview({ data, go }: { data: OverviewResponse; go: (v: View) => void }) {
  const f = data.funnel;
  return (
    <div className="stack stack-6">
      <div className="kpi-grid">
        <button type="button" className={`kpi ${f.pending_purchases ? 'kpi--alert' : ''}`} onClick={() => go({ kind: 'orders' })} style={{ textAlign: 'start', cursor: 'pointer' }}>
          <div className="kpi__value">{faNum(f.pending_purchases)}</div>
          <div className="kpi__label">درخواستِ خریدِ در انتظار</div>
        </button>
        <button type="button" className={`kpi ${f.open_inquiries ? 'kpi--alert' : ''}`} onClick={() => go({ kind: 'inquiries' })} style={{ textAlign: 'start', cursor: 'pointer' }}>
          <div className="kpi__value">{faNum(f.open_inquiries)}</div>
          <div className="kpi__label">پیامِ بازنشده</div>
        </button>
        <div className="kpi">
          <div className="kpi__value">{faNum(f.trials_30d)}</div>
          <div className="kpi__label">دموی ۳۰ روزِ اخیر</div>
        </div>
        <div className="kpi">
          <div className="kpi__value">{faNum(f.activated_purchases)}</div>
          <div className="kpi__label">اشتراکِ فعال‌شده</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack stack-3">
          <h2 className="h4">ارزشِ فعال‌شده — ۳۰ روزِ اخیر</h2>
          <div className="kpi__value">{toman(data.revenue_30d.amount_toman)}</div>
          <p className="small muted">
            از {faNum(data.revenue_30d.activated_count)} اشتراکی که در این بازه فعال شده است.
          </p>
        </div>

        <div className="card stack stack-3">
          <h2 className="h4">وضعیتِ محتوا</h2>
          <ul className="stack stack-2" style={{ listStyle: 'none' }}>
            <li className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">مقاله‌های منتشرشده</span>
              <b className="small">{faNum(data.content.published_articles)}</b>
            </li>
            <li className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">پیش‌نویسِ مقاله</span>
              <b className="small">{faNum(data.content.draft_articles)}</b>
            </li>
            <li className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">پیش‌نویسِ صفحه</span>
              <b className="small">{faNum(data.content.draft_pages)}</b>
            </li>
            <li className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">پلنِ فعال</span>
              <b className="small">{faNum(data.content.active_plans)}</b>
            </li>
          </ul>
        </div>
      </div>

      <div className="studio__panel">
        <div className="studio__toolbar">
          <b className="small" style={{ flex: 1 }}>تازه‌ترین درخواست‌ها</b>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => go({ kind: 'orders' })}>دیدنِ همه</button>
        </div>
        <div className="studio__body">
          {data.recent.length === 0 ? (
            <p className="small muted">هنوز درخواستی ثبت نشده است.</p>
          ) : data.recent.map((r) => (
            <div key={r.id} className="studio__row">
              <span className="studio__row__main">
                <span className="studio__row__title">{r.business_name}</span>
                <span className="studio__row__sub">
                  {r.code} · {r.kind === 'trial' ? 'دمو' : r.plan_name ?? 'خرید'} · {faRelative(r.created_at)}
                </span>
              </span>
              {r.amount_toman != null && <span className="small">{toman(r.amount_toman)}</span>}
              <span className={`badge ${r.status === 'activated' ? 'badge--success' : r.status === 'pending' ? 'badge--warning' : ''}`}>
                {r.status === 'activated' ? 'فعال' : r.status === 'pending' ? 'در انتظار' : r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ مجموعه‌ی محتوایی ═══════════════

function CollectionView({ collectionKey }: { collectionKey: string }) {
  const def = collectionByKey(collectionKey);
  const [rows, setRows] = useState<Values[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ record: Values | null } | null>(null);

  const load = useCallback(async () => {
    if (!def) return;
    setLoading(true); setError(null);
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
      const res = await studio.get<CollectionListResponse>(`/api/v1/admin/site/${def.key}${qs}`);
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'دریافتِ فهرست ناموفق بود.');
    } finally { setLoading(false); }
  }, [def, query]);

  useInitialLoad(load);

  if (!def) return <p className="body">این مجموعه وجود ندارد.</p>;

  return (
    <>
      <div className="studio__panel">
        <div className="studio__toolbar">
          <div className="stack stack-1" style={{ flex: 1, minWidth: '12rem' }}>
            <b className="small">{def.label}</b>
            <span className="tiny muted">{def.description} · {faNum(total)} ردیف</span>
          </div>
          <input
            className="input" style={{ maxWidth: '14rem', minHeight: 38 }}
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو…" aria-label={`جست‌وجو در ${def.label}`}
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <Icon name="history" size={16} />
            تازه‌سازی
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing({ record: null })}>
            <Icon name="sparkle" size={16} />
            افزودن
          </button>
        </div>

        <div className="studio__body">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 62 }} />)
          ) : error ? (
            <div className="notice notice--error" role="alert"><Icon name="x" size={18} /><span>{error}</span></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon"><Icon name={def.icon} size={22} /></span>
              <p className="body small">
                {query ? 'چیزی با این جست‌وجو پیدا نشد.' : `هنوز ردیفی در «${def.label}» نیست.`}
              </p>
              {!query && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing({ record: null })}>
                  افزودنِ نخستین ردیف
                </button>
              )}
            </div>
          ) : rows.map((row) => (
            <div key={String(row.id)} className="studio__row">
              <span className="studio__row__main">
                <span className="studio__row__title">{String(row[def.titleField] ?? '—')}</span>
                <span className="studio__row__sub">
                  {def.subtitleField ? String(row[def.subtitleField] ?? '') : ''}
                  {row.updatedAt ? ` · ویرایش ${faRelative(String(row.updatedAt))}` : ''}
                </span>
              </span>
              <span className={`badge ${row.status === 'published' ? 'badge--success' : ''}`}>
                {row.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ record: row })}>
                ویرایش
              </button>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <RecordEditor
          collection={def}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

// ═══════════════ صفِ درخواست‌ها ═══════════════

const ORDER_STATUS: Record<OrderRow['status'], { label: string; tone: string }> = {
  pending: { label: 'در انتظار', tone: 'badge--warning' },
  contacted: { label: 'تماس گرفته شد', tone: 'badge--info' },
  activated: { label: 'فعال شد', tone: 'badge--success' },
  rejected: { label: 'رد شد', tone: 'badge--danger' },
  cancelled: { label: 'لغو شد', tone: '' },
};

function OrdersView() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = filter === 'pending' ? '?status=pending' : '';
      const res = await studio.get<{ items: OrderRow[] }>(`/api/v1/admin/site/orders${qs}`);
      setRows(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'دریافتِ درخواست‌ها ناموفق بود.');
    } finally { setLoading(false); }
  }, [filter]);

  useInitialLoad(load);

  const act = async (order: OrderRow, action: 'activate' | 'reject' | 'contact' | 'cancel') => {
    let body: Record<string, unknown> = { action };

    if (action === 'reject') {
      const reason = window.prompt('دلیلِ رد کردن (برای متقاضی هم نمایش داده می‌شود):');
      if (!reason || reason.trim().length < 3) return;
      body.reason = reason.trim();
    }
    if (action === 'activate') {
      let tenantId = order.tenant_id ?? order.suggested_tenant?.tenantId ?? null;
      if (!tenantId) {
        const entered = window.prompt(
          'شناسه‌ی کسب‌وکارِ مقصد (tenant id) را وارد کنید.\n' +
          'اگر هنوز حسابِ کسب‌وکار ندارند، اول باید دمو بسازند یا حساب برایشان ساخته شود.',
        );
        if (!entered?.trim()) return;
        tenantId = entered.trim();
      }
      const label = order.suggested_tenant ? `«${order.suggested_tenant.tenantName}»` : `شناسه ${tenantId}`;
      if (!window.confirm(
        `اشتراکِ ${label} برای ${faNum(order.months ?? 0)} ماه فعال شود؟\n` +
        'این کار تاریخِ انقضای واقعیِ کسب‌وکار را تغییر می‌دهد.',
      )) return;
      body = { ...body, tenant_id: tenantId };
    }

    setBusyId(order.id);
    try {
      await studio.patch(`/api/v1/admin/site/orders/${order.id}`, body);
      // فعال‌سازی روی صفحه‌ی پیگیریِ عمومی هم باید فوراً دیده شود.
      await revalidateSite();
      setOpen(null);
      await load();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'انجامِ عملیات ناموفق بود.');
    } finally { setBusyId(null); }
  };

  return (
    <>
      <div className="studio__panel">
        <div className="studio__toolbar">
          <div className="stack stack-1" style={{ flex: 1 }}>
            <b className="small">درخواست‌های فروش</b>
            <span className="tiny muted">دمو و خریدِ اشتراک — فعال‌سازی از همین‌جا انجام می‌شود</span>
          </div>
          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <button type="button" className="chip" data-active={filter === 'pending'} onClick={() => setFilter('pending')}>
              در انتظار
            </button>
            <button type="button" className="chip" data-active={filter === 'all'} onClick={() => setFilter('all')}>
              همه
            </button>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <Icon name="history" size={16} />تازه‌سازی
          </button>
        </div>

        <div className="studio__body">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 62 }} />)
          ) : error ? (
            <div className="notice notice--error" role="alert"><Icon name="x" size={18} /><span>{error}</span></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon"><Icon name="checkCircle" size={22} /></span>
              <p className="body small">
                {filter === 'pending' ? 'هیچ درخواستی در انتظارِ اقدام نیست.' : 'هنوز درخواستی ثبت نشده است.'}
              </p>
            </div>
          ) : rows.map((o) => (
            <div key={o.id} className="studio__row">
              <span className="studio__row__main">
                <span className="studio__row__title">
                  {o.business_name}
                  <span className="badge" style={{ marginInlineStart: 'var(--sp-2)' }}>
                    {o.kind === 'trial' ? 'دمو' : 'خرید'}
                  </span>
                </span>
                <span className="studio__row__sub">
                  {o.code} · {o.contact_name} · {o.phone}
                  {o.plan_name ? ` · ${o.plan_name}` : ''} · {faRelative(o.created_at)}
                </span>
              </span>
              {o.amount_toman != null && <span className="small">{toman(o.amount_toman)}</span>}
              <span className={`badge ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(o)}>جزئیات</button>
              {o.kind === 'purchase' && o.status !== 'activated' && o.status !== 'rejected' && (
                <button
                  type="button" className="btn btn--primary btn--sm"
                  onClick={() => act(o, 'activate')} disabled={busyId === o.id}
                >
                  {busyId === o.id ? <span className="spinner" /> : 'فعال‌سازی'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="studio-drawer" role="dialog" aria-modal="true" aria-label="جزئیاتِ درخواست"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="studio-drawer__panel">
            <header className="studio-drawer__head">
              <h2 className="h4" style={{ flex: 1 }}>{open.business_name}</h2>
              <span className={`badge ${ORDER_STATUS[open.status].tone}`}>{ORDER_STATUS[open.status].label}</span>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(null)} aria-label="بستن">
                <Icon name="x" size={18} />
              </button>
            </header>

            <div className="studio-drawer__body">
              <div className="card stack stack-3">
                <h3 className="h4">تماس</h3>
                <dl className="form-grid form-grid--2" style={{ margin: 0 }}>
                  <div><dt className="tiny muted">کدِ پیگیری</dt><dd className="small" style={{ margin: 0, direction: 'ltr' }}>{open.code}</dd></div>
                  <div><dt className="tiny muted">مسئول</dt><dd className="small" style={{ margin: 0 }}>{open.contact_name}</dd></div>
                  <div><dt className="tiny muted">موبایل</dt><dd className="small" style={{ margin: 0, direction: 'ltr' }}>{open.phone}</dd></div>
                  {open.email && <div><dt className="tiny muted">ایمیل</dt><dd className="small" style={{ margin: 0, direction: 'ltr' }}>{open.email}</dd></div>}
                  {open.city && <div><dt className="tiny muted">شهر</dt><dd className="small" style={{ margin: 0 }}>{open.city}</dd></div>}
                  {open.branch_count != null && <div><dt className="tiny muted">تعدادِ شعبه</dt><dd className="small" style={{ margin: 0 }}>{faNum(open.branch_count)}</dd></div>}
                </dl>
                {open.note && <p className="small">یادداشتِ متقاضی: {open.note}</p>}
              </div>

              <div className="card stack stack-3">
                <h3 className="h4">اشتراک</h3>
                <dl className="form-grid form-grid--2" style={{ margin: 0 }}>
                  <div><dt className="tiny muted">نوع</dt><dd className="small" style={{ margin: 0 }}>{open.kind === 'trial' ? 'دموی ۳۰ روزه' : 'خریدِ اشتراک'}</dd></div>
                  {open.plan_name && <div><dt className="tiny muted">پلن</dt><dd className="small" style={{ margin: 0 }}>{open.plan_name} — {faNum(open.months ?? 0)} ماه</dd></div>}
                  {open.amount_toman != null && <div><dt className="tiny muted">مبلغ</dt><dd className="small" style={{ margin: 0 }}>{toman(open.amount_toman)}</dd></div>}
                  <div><dt className="tiny muted">ثبت</dt><dd className="small" style={{ margin: 0 }}>{faDate(open.created_at)}</dd></div>
                  {open.trial_ends_at && <div><dt className="tiny muted">پایانِ دمو</dt><dd className="small" style={{ margin: 0 }}>{faDate(open.trial_ends_at)}</dd></div>}
                  {open.plan_expires_at && <div><dt className="tiny muted">اعتبار تا</dt><dd className="small" style={{ margin: 0 }}>{faDate(open.plan_expires_at)}</dd></div>}
                </dl>
                <div className="notice notice--info">
                  <Icon name="building" size={18} />
                  <span>
                    {open.tenant_id
                      ? <>کسب‌وکارِ متصل: <span style={{ direction: 'ltr' }}>{open.tenant_id}</span></>
                      : open.suggested_tenant
                        ? <>کسب‌وکارِ پیشنهادی از روی شماره: <b>{open.suggested_tenant.tenantName}</b></>
                        : 'هنوز به هیچ کسب‌وکاری متصل نیست؛ هنگامِ فعال‌سازی شناسه لازم است.'}
                  </span>
                </div>
                {open.rejected_reason && (
                  <div className="notice notice--error"><Icon name="x" size={18} /><span>{open.rejected_reason}</span></div>
                )}
              </div>

              {(open.utm_source || open.landing_path) && (
                <div className="card card--flat stack stack-2">
                  <h3 className="h4">منبعِ سرنخ</h3>
                  <p className="tiny muted" style={{ direction: 'ltr', textAlign: 'left' }}>
                    {[open.utm_source, open.utm_campaign, open.landing_path].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
            </div>

            <footer className="studio-drawer__foot">
              {open.status !== 'activated' && (
                <>
                  <button type="button" className="btn btn--quiet btn--sm" style={{ marginInlineEnd: 'auto', color: 'var(--danger)' }}
                    onClick={() => act(open, 'reject')} disabled={busyId === open.id}>
                    رد کردن
                  </button>
                  {open.status === 'pending' && (
                    <button type="button" className="btn btn--ghost" onClick={() => act(open, 'contact')} disabled={busyId === open.id}>
                      تماس گرفتم
                    </button>
                  )}
                  {open.kind === 'purchase' && (
                    <button type="button" className="btn btn--primary" onClick={() => act(open, 'activate')} disabled={busyId === open.id}>
                      {busyId === open.id ? <><span className="spinner" />در حالِ فعال‌سازی…</> : 'فعال‌سازیِ اشتراک'}
                    </button>
                  )}
                </>
              )}
              {open.status === 'activated' && (
                <Link href={`/order/${open.code}`} className="btn btn--ghost" target="_blank">دیدنِ صفحه‌ی پیگیری</Link>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════ صندوقِ ورودیِ تماس ═══════════════

function InquiriesView() {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await studio.get<{ items: InquiryRow[] }>('/api/v1/admin/site/inquiries');
      setRows(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'دریافتِ پیام‌ها ناموفق بود.');
    } finally { setLoading(false); }
  }, []);

  useInitialLoad(load);

  const setStatus = async (row: InquiryRow, status: InquiryRow['status']) => {
    setBusyId(row.id);
    try {
      await studio.patch(`/api/v1/admin/site/inquiries/${row.id}`, { status });
      await load();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'به‌روزرسانی ناموفق بود.');
    } finally { setBusyId(null); }
  };

  return (
    <div className="studio__panel">
      <div className="studio__toolbar">
        <div className="stack stack-1" style={{ flex: 1 }}>
          <b className="small">پیام‌های سایت</b>
          <span className="tiny muted">تماس با فروش و پرسش‌های عمومی</span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
          <Icon name="history" size={16} />تازه‌سازی
        </button>
      </div>

      <div className="studio__body">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 76 }} />)
        ) : error ? (
          <div className="notice notice--error" role="alert"><Icon name="x" size={18} /><span>{error}</span></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon"><Icon name="mail" size={22} /></span>
            <p className="body small">صندوقِ ورودی خالی است.</p>
          </div>
        ) : rows.map((q) => (
          <div key={q.id} className="studio__row" style={{ alignItems: 'flex-start' }}>
            <span className="studio__row__main">
              <span className="studio__row__title">
                {q.name}{q.company ? ` — ${q.company}` : ''}
              </span>
              <span className="studio__row__sub" style={{ whiteSpace: 'normal' }}>
                {q.code} · {q.phone}{q.email ? ` · ${q.email}` : ''} · {faRelative(q.created_at)}
              </span>
              <p className="small" style={{ marginTop: 'var(--sp-2)' }}>{q.message}</p>
            </span>
            <span className={`badge ${q.status === 'open' ? 'badge--warning' : q.status === 'closed' ? 'badge--success' : 'badge--info'}`}>
              {q.status === 'open' ? 'باز' : q.status === 'in_progress' ? 'در حالِ پیگیری' : 'بسته'}
            </span>
            {q.status !== 'closed' && (
              <div className="row" style={{ gap: 'var(--sp-2)' }}>
                {q.status === 'open' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(q, 'in_progress')} disabled={busyId === q.id}>
                    در حالِ پیگیری
                  </button>
                )}
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setStatus(q, 'closed')} disabled={busyId === q.id}>
                  بستن
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════ پوسته ═══════════════

export function Studio() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // توکن در sessionStorage است و فقط در مرورگر خوانده می‌شود؛ همان تعویقِ
  // microtask تا رندرِ نخست (اسکلتِ بارگذاری) آبشاری نشود.
  useInitialLoad(useCallback(() => { setAuthed(Boolean(getToken())); }, []));

  const loadOverview = useCallback(async () => {
    if (!getToken()) return;
    try {
      setOverview(await studio.get<OverviewResponse>('/api/v1/admin/site/overview'));
      setOverviewError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setAuthed(false); return; }
      setOverviewError(e instanceof ApiError ? e.message : 'دریافتِ نمای کلی ناموفق بود.');
    }
  }, []);

  useInitialLoad(useCallback(() => { if (authed) void loadOverview(); }, [authed, loadOverview]));

  if (authed === null) {
    return <div className="container section"><div className="skeleton" style={{ height: 240 }} /></div>;
  }
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const badge = overview?.funnel;

  return (
    <div className="container section">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <div className="stack stack-1">
          <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>
            <Icon name="layout" size={14} />استودیوی محتوا
          </span>
          <h1 className="h3">مدیریتِ وب‌سایت</h1>
        </div>
        <div className="row" style={{ gap: 'var(--sp-2)' }}>
          <Link href="/" className="btn btn--ghost btn--sm" target="_blank">
            دیدنِ سایت<Icon name="external" size={15} />
          </Link>
          <button
            type="button" className="btn btn--quiet btn--sm"
            onClick={() => { setToken(null); setAuthed(false); }}
          >
            خروج
          </button>
        </div>
      </div>

      <div className="studio">
        <nav className="studio__nav" aria-label="بخش‌های استودیو">
          <button type="button" className="studio__navlink" aria-current={view.kind === 'overview'} onClick={() => { setView({ kind: 'overview' }); loadOverview(); }}>
            نمای کلی
          </button>
          <button type="button" className="studio__navlink" aria-current={view.kind === 'orders'} onClick={() => setView({ kind: 'orders' })}>
            درخواست‌های فروش
            {badge && badge.pending_purchases > 0 && <span className="badge badge--warning">{faNum(badge.pending_purchases)}</span>}
          </button>
          <button type="button" className="studio__navlink" aria-current={view.kind === 'inquiries'} onClick={() => setView({ kind: 'inquiries' })}>
            پیام‌های سایت
            {badge && badge.open_inquiries > 0 && <span className="badge badge--warning">{faNum(badge.open_inquiries)}</span>}
          </button>

          <span className="tiny muted" style={{ padding: 'var(--sp-3) var(--sp-4) var(--sp-1)' }}>محتوا</span>
          {COLLECTIONS.map((c) => (
            <button
              key={c.key} type="button" className="studio__navlink"
              aria-current={view.kind === 'collection' && view.key === c.key}
              onClick={() => setView({ kind: 'collection', key: c.key })}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <div>
          {overviewError && view.kind === 'overview' && (
            <div className="notice notice--error" role="alert" style={{ marginBottom: 'var(--sp-4)' }}>
              <Icon name="x" size={18} /><span>{overviewError}</span>
            </div>
          )}

          {view.kind === 'overview' && (
            overview
              ? <Overview data={overview} go={setView} />
              : <div className="kpi-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 104 }} />)}</div>
          )}
          {view.kind === 'orders' && <OrdersView />}
          {view.kind === 'inquiries' && <InquiriesView />}
          {view.kind === 'collection' && <CollectionView collectionKey={view.key} />}
        </div>
      </div>

      <p className="tiny muted" style={{ marginTop: 'var(--sp-8)' }}>
        تغییراتِ محتوا بلافاصله روی سایتِ زنده اعمال می‌شوند (کشِ نمای عمومی همان لحظه باطل می‌شود).
        فعال‌سازیِ اشتراک تاریخِ انقضای واقعیِ کسب‌وکار را تغییر می‌دهد و در گزارشِ حسابرسی ثبت می‌شود.
        نسخه‌ی محتوا: {fa(1)}
      </p>
    </div>
  );
}
