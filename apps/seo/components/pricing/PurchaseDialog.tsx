'use client';

// ═══════════════════════════════════════════════════════════════════════
//  دیالوگِ ثبتِ درخواستِ خرید — مسیرِ واقعی، نه شبیه‌سازی
//
//  فرم → POST /api/v1/site/orders → ردیفِ pending در دیتابیس → اعلانِ پنلِ
//  شرکت → کدِ پیگیری به کاربر. قیمت فقط نمایشی است؛ سرور آن را از پلن
//  می‌خواند، پس دستکاریِ سمتِ کلاینت بی‌اثر است.
//
//  حالت‌های پوشش‌داده‌شده: در حالِ ارسال، خطای اعتبارسنجی، خطای سرور،
//  موفقیت، و «قبلاً ثبت شده» (کدِ همان درخواستِ باز برمی‌گردد).
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../site/Icon';
import { toman, faNum } from '@/lib/format';
import {
  apiPost, attribution, ApiError, isApiConfigured,
  validatePhone, validateRequired, validateEmail,
} from '@/lib/client-api';
import type { SitePlan } from '@/lib/content-types';

interface OrderResponse {
  order: {
    code: string; status: string; plan_name: string | null;
    months: number | null; amount_toman: number | null;
  };
  created: boolean;
  next_step?: string;
}

type Errors = Partial<Record<'business_name' | 'contact_name' | 'phone' | 'email', string>>;

export function PurchaseDialog({
  plans,
  initialPlanKey,
  onClose,
}: {
  plans: SitePlan[];
  initialPlanKey: string;
  onClose: () => void;
}) {
  const [planKey, setPlanKey] = useState(initialPlanKey);
  const [form, setForm] = useState({
    business_name: '', contact_name: '', phone: '', email: '', city: '', note: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResponse | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const plan = plans.find((p) => p.key === planKey) ?? plans[0];

  // Escape می‌بندد و فوکوس داخلِ دیالوگ می‌ماند (تله‌ی فوکوسِ ساده).
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key as keyof Errors]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    const bn = validateRequired(form.business_name, 'نامِ کسب‌وکار');
    if (bn) next.business_name = bn;
    const cn = validateRequired(form.contact_name, 'نامِ شما');
    if (cn) next.contact_name = cn;
    const ph = validatePhone(form.phone);
    if (ph) next.phone = ph;
    const em = validateEmail(form.email);
    if (em) next.email = em;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setStatus('sending');
    try {
      const data = await apiPost<OrderResponse>('/api/v1/site/orders', {
        plan_key: planKey,
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        note: form.note.trim() || undefined,
        ...attribution(),
      });
      setResult(data);
      setStatus('done');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'ثبتِ درخواست ناموفق بود.');
      setStatus('idle');
    }
  };

  return (
    <div
      className="studio-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="studio-drawer__panel" ref={dialogRef}>
        <header className="studio-drawer__head">
          <h2 id="purchase-title" className="h4" style={{ flex: 1 }}>
            {status === 'done' ? 'درخواست ثبت شد' : 'درخواستِ خریدِ اشتراک'}
          </h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} aria-label="بستن">
            <Icon name="x" size={18} />
          </button>
        </header>

        {status === 'done' && result ? (
          <div className="studio-drawer__body">
            <div className="success-panel">
              <span className="success-panel__icon"><Icon name="check" size={26} /></span>
              <div className="stack stack-3">
                <h3 className="h3">
                  {result.created ? 'درخواستِ شما ثبت شد' : 'این درخواست از قبل ثبت شده بود'}
                </h3>
                <p className="body">
                  {result.next_step ??
                    'کارشناسِ رزرونو برای هماهنگیِ پرداخت تماس می‌گیرد؛ پس از تأیید، اشتراک از پنلِ شرکت فعال می‌شود.'}
                </p>
              </div>
              <div className="stack stack-2">
                <span className="small muted">کدِ پیگیری</span>
                <span className="code-pill">{result.order.code}</span>
              </div>
              <div className="row">
                <Link href={`/order/${result.order.code}`} className="btn btn--primary">
                  پیگیریِ وضعیتِ درخواست
                  <Icon name="arrowLeft" size={16} className="btn__arrow" />
                </Link>
                <button type="button" className="btn btn--ghost" onClick={onClose}>بستن</button>
              </div>
            </div>

            <ol className="status-track" aria-label="مراحلِ فعال‌سازی">
              <li className="status-step" data-state="done">
                <span className="status-step__icon"><Icon name="check" size={16} /></span>
                <span className="stack stack-1">
                  <b className="small">ثبتِ درخواست</b>
                  <span className="tiny muted">همین حالا انجام شد</span>
                </span>
              </li>
              <li className="status-step" data-state="current">
                <span className="status-step__icon"><Icon name="phone" size={16} /></span>
                <span className="stack stack-1">
                  <b className="small">تماسِ کارشناس و هماهنگیِ پرداخت</b>
                  <span className="tiny muted">در ساعاتِ کاریِ بعدی</span>
                </span>
              </li>
              <li className="status-step">
                <span className="status-step__icon"><Icon name="rocket" size={16} /></span>
                <span className="stack stack-1">
                  <b className="small">فعال‌سازیِ اشتراک از پنلِ شرکت</b>
                  <span className="tiny muted">بعد از تأییدِ پرداخت</span>
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
            <div className="studio-drawer__body">
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 'var(--sp-3)' }}>انتخابِ پلن</legend>
                <div className="plan-picker">
                  {plans.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className="plan-option"
                      aria-pressed={p.key === planKey}
                      onClick={() => setPlanKey(p.key)}
                    >
                      <span className="plan-option__name">{p.name}</span>
                      <span className="plan-option__price">{toman(p.price_toman)}</span>
                      <span className="tiny muted">{faNum(p.months)} ماه</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {plan && (
                <div className="notice notice--info">
                  <Icon name="ticket" size={18} />
                  <span>
                    پلنِ انتخابی: <b>{plan.name}</b> — {toman(plan.price_toman)} برای {faNum(plan.months)} ماه.
                    مبلغِ نهایی و فاکتور را کارشناس تأیید می‌کند.
                  </span>
                </div>
              )}

              <div className="form-grid form-grid--2">
                <div className="field">
                  <label className="label" htmlFor="po-business">نامِ کسب‌وکار</label>
                  <input
                    id="po-business" ref={firstFieldRef} className="input" value={form.business_name}
                    onChange={set('business_name')} aria-invalid={!!errors.business_name}
                    aria-describedby={errors.business_name ? 'po-business-err' : undefined}
                    autoComplete="organization" required
                  />
                  {errors.business_name && (
                    <span className="field__error" id="po-business-err" role="alert">
                      <Icon name="x" size={13} />{errors.business_name}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="po-name">نامِ شما</label>
                  <input
                    id="po-name" className="input" value={form.contact_name} onChange={set('contact_name')}
                    aria-invalid={!!errors.contact_name}
                    aria-describedby={errors.contact_name ? 'po-name-err' : undefined}
                    autoComplete="name" required
                  />
                  {errors.contact_name && (
                    <span className="field__error" id="po-name-err" role="alert">
                      <Icon name="x" size={13} />{errors.contact_name}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="po-phone">شماره‌ی موبایل</label>
                  <input
                    id="po-phone" className="input input--ltr" value={form.phone} onChange={set('phone')}
                    inputMode="tel" placeholder="09123456789" aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'po-phone-err' : undefined}
                    autoComplete="tel" required
                  />
                  {errors.phone && (
                    <span className="field__error" id="po-phone-err" role="alert">
                      <Icon name="x" size={13} />{errors.phone}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="po-email">
                    ایمیل <span className="label__hint">(اختیاری — برای ارسالِ فاکتور)</span>
                  </label>
                  <input
                    id="po-email" className="input input--ltr" value={form.email} onChange={set('email')}
                    inputMode="email" aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'po-email-err' : undefined}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <span className="field__error" id="po-email-err" role="alert">
                      <Icon name="x" size={13} />{errors.email}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="po-city">شهر <span className="label__hint">(اختیاری)</span></label>
                  <input id="po-city" className="input" value={form.city} onChange={set('city')} autoComplete="address-level2" />
                </div>

                <div className="field form-grid__full">
                  <label className="label" htmlFor="po-note">توضیحِ کوتاه <span className="label__hint">(اختیاری)</span></label>
                  <textarea
                    id="po-note" className="textarea" value={form.note} onChange={set('note')}
                    placeholder="مثلاً تعدادِ شعبه‌ها یا زمانِ مناسب برای تماس"
                  />
                </div>
              </div>

              {serverError && (
                <div className="notice notice--error" role="alert">
                  <Icon name="x" size={18} />
                  <span>{serverError}</span>
                </div>
              )}

              {!isApiConfigured() && (
                <div className="notice notice--warning">
                  <Icon name="phone" size={18} />
                  <span>ثبتِ آنلاین موقتاً در دسترس نیست. لطفاً از صفحه‌ی تماس اقدام کنید.</span>
                </div>
              )}

              <p className="tiny muted">
                با ثبتِ درخواست، <Link href="/terms" className="prose">شرایط استفاده</Link> و{' '}
                <Link href="/privacy" className="prose">حریم خصوصی</Link> را می‌پذیرید.
              </p>
            </div>

            <footer className="studio-drawer__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose}>انصراف</button>
              <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
                {status === 'sending' ? <><span className="spinner" />در حالِ ثبت…</> : 'ثبتِ درخواستِ خرید'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
