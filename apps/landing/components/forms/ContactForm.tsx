'use client';

// فرمِ تماس با فروش → POST /api/v1/site/contact → ردیفِ site_inquiries +
// رویدادِ پلتفرم + اعلانِ ایمیلِ فروش. کدِ پیگیری به کاربر داده می‌شود تا
// بداند پیامش گم نشده است.

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../site/Icon';
import {
  apiPost, attribution, ApiError, isApiConfigured,
  validatePhone, validateRequired, validateEmail,
} from '@/lib/client-api';

interface InquiryResponse { code: string; status: string; created_at: string }

const TOPICS: { value: string; label: string }[] = [
  { value: 'sales', label: 'خرید و قیمت‌گذاری' },
  { value: 'support', label: 'پشتیبانیِ فنی' },
  { value: 'partnership', label: 'همکاری' },
  { value: 'press', label: 'رسانه' },
  { value: 'other', label: 'موضوعِ دیگر' },
];

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'message', string>>;

export function ContactForm() {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', topic: 'sales', message: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<InquiryResponse | null>(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key as keyof Errors]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const validate = (): boolean => {
    const next: Errors = {};
    const n = validateRequired(form.name, 'نامِ شما');
    if (n) next.name = n;
    const p = validatePhone(form.phone);
    if (p) next.phone = p;
    const em = validateEmail(form.email);
    if (em) next.email = em;
    const m = validateRequired(form.message, 'متنِ پیام', 5);
    if (m) next.message = m;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setStatus('sending');
    try {
      const data = await apiPost<InquiryResponse>('/api/v1/site/contact', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        topic: form.topic,
        message: form.message.trim(),
        ...attribution(),
      });
      setResult(data);
      setStatus('done');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'ارسالِ پیام ناموفق بود.');
      setStatus('idle');
    }
  };

  if (status === 'done' && result) {
    return (
      <div className="success-panel" role="status">
        <span className="success-panel__icon"><Icon name="check" size={26} /></span>
        <div className="stack stack-3">
          <h2 className="h3">پیامِ شما رسید</h2>
          <p className="body">
            کارشناسِ ما در نخستین فرصتِ کاری با شما تماس می‌گیرد. کدِ پیگیریِ پیامتان را نگه دارید.
          </p>
        </div>
        <div className="stack stack-2">
          <span className="small muted">کدِ پیگیری</span>
          <span className="code-pill">{result.code}</span>
        </div>
        <div className="row">
          <Link href="/demo" className="btn btn--primary">
            تا آن موقع، دموی رایگان را شروع کنم
            <Icon name="arrowLeft" size={16} className="btn__arrow" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="form-grid form-grid--2">
        <div className="field">
          <label className="label" htmlFor="ct-name">نامِ شما</label>
          <input
            id="ct-name" className="input" value={form.name} onChange={set('name')}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'ct-name-err' : undefined}
            autoComplete="name" required
          />
          {errors.name && (
            <span className="field__error" id="ct-name-err" role="alert">
              <Icon name="x" size={13} />{errors.name}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-company">نامِ کسب‌وکار <span className="label__hint">(اختیاری)</span></label>
          <input id="ct-company" className="input" value={form.company} onChange={set('company')} autoComplete="organization" />
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-phone">شماره‌ی موبایل</label>
          <input
            id="ct-phone" className="input input--ltr" value={form.phone} onChange={set('phone')}
            inputMode="tel" placeholder="09123456789" aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'ct-phone-err' : undefined} autoComplete="tel" required
          />
          {errors.phone && (
            <span className="field__error" id="ct-phone-err" role="alert">
              <Icon name="x" size={13} />{errors.phone}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="ct-email">ایمیل <span className="label__hint">(اختیاری)</span></label>
          <input
            id="ct-email" className="input input--ltr" value={form.email} onChange={set('email')}
            inputMode="email" aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'ct-email-err' : undefined} autoComplete="email"
          />
          {errors.email && (
            <span className="field__error" id="ct-email-err" role="alert">
              <Icon name="x" size={13} />{errors.email}
            </span>
          )}
        </div>

        <div className="field form-grid__full">
          <label className="label" htmlFor="ct-topic">موضوع</label>
          <select id="ct-topic" className="select" value={form.topic} onChange={set('topic')}>
            {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="field form-grid__full">
          <label className="label" htmlFor="ct-message">پیامِ شما</label>
          <textarea
            id="ct-message" className="textarea" value={form.message} onChange={set('message')}
            placeholder="کمی درباره‌ی رستوران و نیازتان بنویسید تا دقیق‌تر راهنمایی کنیم."
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? 'ct-message-err' : undefined} required
          />
          {errors.message && (
            <span className="field__error" id="ct-message-err" role="alert">
              <Icon name="x" size={13} />{errors.message}
            </span>
          )}
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
          <span>ارسالِ آنلاین موقتاً در دسترس نیست.</span>
        </div>
      )}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={status === 'sending'}>
        {status === 'sending' ? <><span className="spinner" />در حالِ ارسال…</> : 'ارسالِ پیام'}
      </button>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        اطلاعاتِ شما فقط برای پاسخ به همین درخواست استفاده می‌شود —{' '}
        <Link href="/privacy" className="prose">حریم خصوصی</Link>.
      </p>
    </form>
  );
}
