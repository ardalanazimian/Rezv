'use client';

// کارت‌های قیمت + دیالوگِ خرید. قیمت‌ها همان چیزی‌اند که سرور داده (اینجا
// هیچ محاسبه‌ی قیمتی انجام نمی‌شود جز نمایش)، و دکمه‌ی خرید فرمِ واقعیِ ثبتِ
// درخواست را باز می‌کند — نه یک لینکِ تزئینی.

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../site/Icon';
import { Reveal } from '../site/Motion';
import { PurchaseDialog } from './PurchaseDialog';
import { faNum, tomanShort, toman, fa } from '@/lib/format';
import type { SitePlan } from '@/lib/content-types';

export function PlanCards({ plans, note }: { plans: SitePlan[]; note?: string | null }) {
  const [selected, setSelected] = useState<SitePlan | null>(null);

  if (!plans.length) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon"><Icon name="ticket" size={22} /></span>
        <p className="body">پلن‌ها در حالِ به‌روزرسانی‌اند. برای دریافتِ قیمت با ما تماس بگیرید.</p>
        <Link href="/contact" className="btn btn--primary btn--sm">تماس با فروش</Link>
      </div>
    );
  }

  return (
    <>
      <div className="plans">
        {plans.map((plan, i) => (
          <Reveal key={plan.key} delay={i * 90}>
            <article className={`plan${plan.highlight ? ' plan--highlight' : ''}`}>
              {plan.badge && <span className="plan__badge">{plan.badge}</span>}

              <header className="stack stack-2">
                <h3 className="plan__name">{plan.name}</h3>
                {plan.tagline && <p className="plan__tagline">{plan.tagline}</p>}
              </header>

              <div className="plan__price">
                <span className="plan__amount">{tomanShort(plan.price_toman)}</span>
                <span className="plan__period">
                  برای {faNum(plan.months)} ماه — {toman(plan.price_toman)}
                </span>
                <span className="plan__monthly">
                  معادلِ ماهانه {toman(plan.monthly_toman)}
                  {plan.saving_percent > 0 && (
                    <>
                      {' · '}
                      <span className="plan__compare">{toman(plan.compare_at_toman ?? 0)}</span>
                      {' '}
                      <span className="badge badge--success">{fa(plan.saving_percent)}٪ صرفه‌جویی</span>
                    </>
                  )}
                </span>
              </div>

              <ul className="plan__features">
                {plan.features.map((f) => (
                  <li key={f}><Icon name="check" size={17} />{f}</li>
                ))}
              </ul>

              <div className="stack stack-2">
                <button
                  type="button"
                  className={`btn ${plan.highlight ? 'btn--primary' : 'btn--ghost'} btn--block`}
                  onClick={() => setSelected(plan)}
                >
                  انتخابِ {plan.name}
                  <Icon name="arrowLeft" size={17} className="btn__arrow" />
                </button>
                <Link href="/demo" className="btn btn--quiet btn--sm btn--block">
                  اول ۳۰ روز رایگان امتحان می‌کنم
                </Link>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      {note && (
        <p className="small muted" style={{ textAlign: 'center', marginTop: 'var(--sp-6)' }}>{note}</p>
      )}

      {selected && (
        <PurchaseDialog plans={plans} initialPlanKey={selected.key} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
