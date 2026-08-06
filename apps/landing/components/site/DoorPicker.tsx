'use client';

// ═══════════════════════════════════════════════════════════════════════
//  انتخابِ در — سه ورودیِ رزرونو
//
//  صفحه‌ی ورود پیش از این سه کارتِ یک‌اندازه در یک شبکه بود؛ همان چیزی که
//  هر قالبِ آماده‌ای دارد. اینجا انتخاب خودش تبدیل به تجربه می‌شود: درها
//  کنارِ هم‌اند، آنکه زیرِ اشاره‌گر است باز می‌شود و بقیه عقب می‌روند.
//
//  ── چرا این کار می‌کند ──
//  «فوکوس» یک تکنیکِ قدیمیِ طراحی است: به‌جای برجسته‌کردنِ یکی، بقیه کم‌رنگ
//  می‌شوند. چشم بدونِ هیچ راهنمایی می‌فهمد کجاست. حرکت اینجا تزئین نیست —
//  خودِ بازخوردِ انتخاب است.
//
//  ── چرا حالتِ باز در CSS است، نه در state ──
//  با useState، افکت تا پیش از hydration مرده بود و در هر رندرِ ایستا
//  (مثلِ نسخه‌ی آفلاینِ سایت) اصلاً کار نمی‌کرد. :hover و :focus-within
//  همان کار را بدونِ هیچ جاوااسکریپتی انجام می‌دهند. این کامپوننت فقط برای
//  یک چیز کلاینتی مانده: جابه‌جایی با کلیدهای جهت‌دار.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';

export interface Door {
  key: string;
  icon: string;
  title: string;
  body: string;
  hint: string;
  href: string | null;
  /** وقتی آدرس پیکربندی نشده، به‌جای دکمه‌ی مرده به تماس می‌رود. */
  fallbackHref: string;
  fallbackLabel: string;
}

const FA = ['۰۱', '۰۲', '۰۳', '۰۴'];

export function DoorPicker({ doors }: { doors: Door[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // کلیدهای جهت‌دار بینِ درها. در RTL جهتِ بصری برعکسِ ترتیبِ منطقی است، پس
  // ArrowLeft یعنی «بعدی». (Tab هم مثلِ همیشه کار می‌کند؛ این فقط میان‌بر است.)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a.door'));
      const at = links.findIndex((l) => l === document.activeElement);
      if (at < 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowLeft' ? at + 1 : at - 1;
      links[Math.max(0, Math.min(links.length - 1, next))]?.focus();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="doors" ref={wrapRef}>
      {doors.map((d, i) => {
        const href = d.href ?? d.fallbackHref;
        const external = Boolean(d.href);
        return (
          <Link
            key={d.key}
            href={href}
            className="door"
            style={{ '--n': i } as React.CSSProperties}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {/* حاشیه‌ی متحرک فقط روی درِ باز — یک لایه‌ی جدا تا انیمیشنش
                رویِ خودِ کارت رندرِ دوباره تحمیل نکند. */}
            <span className="door__edge" aria-hidden="true" />

            <span className="door__num" aria-hidden="true">{FA[i] ?? String(i + 1)}</span>

            <span className="door__ic"><Icon name={d.icon} size={22} /></span>

            <span className="door__title">{d.title}</span>
            <span className="door__body">{d.body}</span>

            <span className="door__foot">
              <span className="door__hint">{d.hint}</span>
              <span className="door__go">
                {external ? 'ورود' : d.fallbackLabel}
                <Icon name={external ? 'external' : 'arrowLeft'} size={15} />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
