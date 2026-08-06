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
//  ── دسترس‌پذیری، که معمولاً قربانیِ همین افکت‌ها می‌شود ──
//   • هر در یک لینکِ واقعی است، نه div با onClick.
//   • با Tab بینِ درها می‌روید و همان دری که فوکوس دارد باز می‌شود — یعنی
//     کاربرِ کیبورد دقیقاً همان اطلاعاتی را می‌بیند که کاربرِ ماوس.
//   • کلیدهای جهت‌دار هم بینِ درها جابه‌جا می‌شوند (در RTL، راست و چپ
//     جابه‌جا شده‌اند).
//   • با prefers-reduced-motion هیچ دری باز و بسته نمی‌شود؛ هر سه هم‌اندازه
//     و کاملاً خوانا می‌مانند.
//   • روی تاچ هم هر سه باز می‌مانند: «باز شدن با هاور» روی موبایل معنا
//     ندارد و فقط یک لمسِ اضافه تحمیل می‌کند.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
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
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // کلیدهای جهت‌دار بینِ درها. در RTL جهتِ بصری برعکسِ ترتیبِ منطقی است، پس
  // ArrowLeft یعنی «بعدی».
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
    <div className="doors" ref={wrapRef} data-active={active}>
      {doors.map((d, i) => {
        const href = d.href ?? d.fallbackHref;
        const external = Boolean(d.href);
        return (
          <Link
            key={d.key}
            href={href}
            className={`door${i === active ? ' is-open' : ''}`}
            style={{ '--n': i } as React.CSSProperties}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
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
