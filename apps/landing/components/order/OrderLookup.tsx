'use client';

// جست‌وجوی کدِ پیگیری. عمداً یک ناوبریِ ساده به /order/{code} است (نه fetch
// در جا) تا نتیجه یک آدرسِ قابلِ اشتراک و قابلِ بوکمارک داشته باشد.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '../site/Icon';

const CODE_RE = /^RZO-[A-Z2-9]{5,12}$/;

export function OrderLookup({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // کاربر معمولاً کد را با حروفِ کوچک یا فاصله می‌چسباند؛ خودمان تمیزش می‌کنیم.
    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!CODE_RE.test(clean)) {
      setError('کدِ پیگیری معتبر نیست. قالبِ درست مثلِ RZO-AB12CD است.');
      return;
    }
    setError(null);
    router.push(`/order/${clean}`);
  };

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="order-code">کدِ پیگیری</label>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 'var(--sp-3)' }}>
          <input
            id="order-code"
            className="input input--ltr"
            value={code}
            onChange={(e) => { setCode(e.target.value); if (error) setError(null); }}
            placeholder="RZO-XXXXXX"
            aria-invalid={!!error}
            aria-describedby={error ? 'order-code-err' : undefined}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button type="submit" className="btn btn--primary">
            پیگیری
            <Icon name="arrowLeft" size={16} className="btn__arrow" />
          </button>
        </div>
        {error && (
          <span className="field__error" id="order-code-err" role="alert">
            <Icon name="x" size={13} />{error}
          </span>
        )}
      </div>
      <p className="tiny muted">
        کد را هنگامِ ثبتِ دمو یا درخواستِ خرید دریافت کرده‌اید؛ در ایمیلِ تأیید هم هست.
      </p>
    </form>
  );
}
