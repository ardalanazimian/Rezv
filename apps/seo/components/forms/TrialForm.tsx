'use client';

// ═══════════════════════════════════════════════════════════════════════
//  فرمِ دموی ۳۰ روزه — نقطه‌ی ورودِ واقعیِ محصول
//
//  ارسال → POST /api/v1/site/trial → بک‌اند همان‌جا Tenant + Restaurant +
//  Staff(owner) واقعی می‌سازد و trialEndsAt را روی +۳۰ روز می‌گذارد.
//  یعنی بعد از دیدنِ پیامِ موفقیت، کاربر واقعاً می‌تواند با همان شماره وارد
//  پنلِ کسب‌وکار شود. اگر همان شماره قبلاً دمو گرفته باشد، سرور همان حساب را
//  برمی‌گرداند (created=false) و ما پیامِ درست را نشان می‌دهیم.
// ═══════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../site/Icon';
import { faDate, fa } from '@/lib/format';
import {
  apiPost, attribution, ApiError, isApiConfigured,
  validatePhone, validateRequired, validateEmail,
} from '@/lib/client-api';

interface TrialResponse {
  order: { code: string; trial_ends_at: string | null; business_name: string };
  created: boolean;
  restaurant: { id: string; slug: string; name: string };
  login: { phone: string; app: string };
  trial_days: number;
  next_step?: string;
}

type Errors = Partial<Record<'business_name' | 'contact_name' | 'phone' | 'email', string>>;

const BUSINESS_APP_URL = process.env.NEXT_PUBLIC_BUSINESS_APP_URL || '';

export function TrialForm({ trialDays = 30 }: { trialDays?: number }) {
  const [form, setForm] = useState({
    business_name: '', contact_name: '', phone: '', email: '', city: '', branch_count: '', note: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<TrialResponse | null>(null);

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
      const branchCount = Number(form.branch_count.replace(/\D/g, ''));
      const data = await apiPost<TrialResponse>('/api/v1/site/trial', {
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        branch_count: Number.isFinite(branchCount) && branchCount > 0 ? branchCount : undefined,
        note: form.note.trim() || undefined,
        ...attribution(),
      });
      setResult(data);
      setStatus('done');
      // کاربر باید نتیجه را ببیند، حتی اگر فرم پایین صفحه بوده باشد.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'ساختِ حسابِ دمو ناموفق بود.');
      setStatus('idle');
    }
  };

  if (status === 'done' && result) {
    const days = result.trial_days ?? trialDays;
    return (
      <div className="success-panel" role="status">
        <span className="success-panel__icon"><Icon name="check" size={26} /></span>

        <div className="stack stack-3">
          <h2 className="h2">
            {result.created ? 'حسابِ دموی شما ساخته شد' : 'حسابِ دموی شما از قبل فعال است'}
          </h2>
          <p className="body">
            «{result.restaurant.name}» برای {fa(days)} روز دسترسیِ کاملِ پنلِ کسب‌وکار دارد
            {result.order.trial_ends_at && <> — تا {faDate(result.order.trial_ends_at)}</>}.
          </p>
        </div>

        <div className="form-grid form-grid--2">
          <div className="stack stack-2">
            <span className="small muted">کدِ پیگیری</span>
            <span className="code-pill">{result.order.code}</span>
          </div>
          <div className="stack stack-2">
            <span className="small muted">شماره‌ی ورود</span>
            <span className="code-pill">{result.login.phone}</span>
          </div>
        </div>

        <div className="notice notice--info">
          <Icon name="phone" size={18} />
          <span>
            برای ورود کافی است همین شماره را در پنلِ کسب‌وکار وارد کنید و کدِ پیامک‌شده را بزنید.
            یک چیدمانِ اولیه‌ی میز هم برایتان آماده شده تا پنل از همان ابتدا کار کند.
          </span>
        </div>

        <div className="row">
          {BUSINESS_APP_URL ? (
            <a href={BUSINESS_APP_URL} className="btn btn--primary btn--lg" target="_blank" rel="noopener noreferrer">
              ورود به پنلِ کسب‌وکار
              <Icon name="external" size={17} />
            </a>
          ) : (
            <Link href="/login" className="btn btn--primary btn--lg">
              ورود به پنلِ کسب‌وکار
              <Icon name="arrowLeft" size={17} className="btn__arrow" />
            </Link>
          )}
          <Link href={`/order/${result.order.code}`} className="btn btn--ghost btn--lg">
            پیگیریِ وضعیت
          </Link>
        </div>

        <p className="tiny muted">
          بعد از {fa(days)} روز چیزی به‌صورتِ خودکار از شما کسر نمی‌شود؛ داده‌هایتان هم باقی می‌ماند.
          هر وقت خواستید، از <Link href="/pricing" className="prose">صفحه‌ی قیمت‌گذاری</Link> اشتراک بگیرید.
        </p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="stack stack-2">
        <h2 className="h3">ساختِ حسابِ دمو</h2>
        <p className="small muted">
          بدونِ کارتِ بانکی. حساب همان لحظه ساخته می‌شود و {fa(trialDays)} روز کامل در اختیارِ شماست.
        </p>
      </div>

      <div className="form-grid form-grid--2">
        <div className="field">
          <label className="label" htmlFor="tr-business">نامِ کسب‌وکار</label>
          <input
            id="tr-business" className="input" value={form.business_name} onChange={set('business_name')}
            placeholder="مثلاً کافه‌رستوران باغ" aria-invalid={!!errors.business_name}
            aria-describedby={errors.business_name ? 'tr-business-err' : undefined}
            autoComplete="organization" required
          />
          {errors.business_name && (
            <span className="field__error" id="tr-business-err" role="alert">
              <Icon name="x" size={13} />{errors.business_name}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="tr-name">نامِ شما</label>
          <input
            id="tr-name" className="input" value={form.contact_name} onChange={set('contact_name')}
            aria-invalid={!!errors.contact_name}
            aria-describedby={errors.contact_name ? 'tr-name-err' : undefined}
            autoComplete="name" required
          />
          {errors.contact_name && (
            <span className="field__error" id="tr-name-err" role="alert">
              <Icon name="x" size={13} />{errors.contact_name}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="tr-phone">
            شماره‌ی موبایل <span className="label__hint">(همین شماره، شناسه‌ی ورودِ شماست)</span>
          </label>
          <input
            id="tr-phone" className="input input--ltr" value={form.phone} onChange={set('phone')}
            inputMode="tel" placeholder="09123456789" aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'tr-phone-err' : undefined}
            autoComplete="tel" required
          />
          {errors.phone && (
            <span className="field__error" id="tr-phone-err" role="alert">
              <Icon name="x" size={13} />{errors.phone}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="tr-email">ایمیل <span className="label__hint">(اختیاری)</span></label>
          <input
            id="tr-email" className="input input--ltr" value={form.email} onChange={set('email')}
            inputMode="email" aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'tr-email-err' : undefined}
            autoComplete="email"
          />
          {errors.email && (
            <span className="field__error" id="tr-email-err" role="alert">
              <Icon name="x" size={13} />{errors.email}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="tr-city">شهر <span className="label__hint">(اختیاری)</span></label>
          <input id="tr-city" className="input" value={form.city} onChange={set('city')} autoComplete="address-level2" />
        </div>

        <div className="field">
          <label className="label" htmlFor="tr-branches">تعدادِ شعبه <span className="label__hint">(اختیاری)</span></label>
          <input
            id="tr-branches" className="input input--ltr" value={form.branch_count}
            onChange={set('branch_count')} inputMode="numeric" placeholder="1"
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
          <span>
            ثبتِ آنلاین موقتاً در دسترس نیست. لطفاً از <Link href="/contact" className="prose">صفحه‌ی تماس</Link> اقدام کنید.
          </span>
        </div>
      )}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={status === 'sending'}>
        {status === 'sending'
          ? <><span className="spinner" />در حالِ ساختِ حساب…</>
          : <>شروعِ دموی {fa(trialDays)} روزه<Icon name="arrowLeft" size={18} className="btn__arrow" /></>}
      </button>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        با ادامه، <Link href="/terms" className="prose">شرایط استفاده</Link> و{' '}
        <Link href="/privacy" className="prose">حریم خصوصی</Link> را می‌پذیرید.
      </p>
    </form>
  );
}
