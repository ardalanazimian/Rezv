'use client';

// ═══════════════════════════════════════════════════════════════════════
//  حرکتِ اسکرول‌محور — بدونِ کتابخانه‌ی انیمیشن
//
//  چرا بدونِ کتابخانه: هر کتابخانه‌ی حرکت ده‌ها کیلوبایتِ جاوااسکریپت به
//  مسیرِ بحرانی اضافه می‌کند. اینجا کارِ اصلی را CSS انجام می‌دهد و JS فقط
//  یک IntersectionObserverِ مشترک دارد که یک ویژگیِ data را ست می‌کند.
//
//  دو تضمین:
//   • بدونِ JS: کلاسِ js-reveal روی <html> نمی‌نشیند → حالتِ اولیه‌ی مخفی
//     اصلاً اعمال نمی‌شود و همه‌چیز دیده می‌شود.
//   • prefers-reduced-motion: در CSS خنثی می‌شود (و observer هم بلافاصله
//     همه را visible می‌کند).
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';

let observer: IntersectionObserver | null = null;
const seen = new WeakSet<Element>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  if (observer) return observer;
  // یک observer برای کلِ صفحه — به‌جای یکی به‌ازای هر عنصر.
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.visible = 'true';
        seen.add(entry.target);
        observer?.unobserve(entry.target); // یک‌بار آشکار می‌شود، نه هر بار اسکرول
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  return observer;
}

/** عنصری که با ورود به دید، نرم بالا می‌آید. delay برای اثرِ پلکانیِ فهرست‌ها. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.visible = 'true';
      return;
    }
    const obs = ensureObserver();
    if (!obs) { el.dataset.visible = 'true'; return; }
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={className ? `reveal ${className}` : 'reveal'}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * نوارِ باریکِ پیشرفتِ اسکرول در بالای صفحه.
 *
 * همین حلقه «سرعتِ اسکرول» را هم به‌صورتِ متغیرِ --vel روی <html> می‌گذارد
 * (بازه‌ی ۱- تا ۱). یک شنودِ اسکرول برای هر دو کار، نه دو تا. CSS از آن
 * برای کِششِ ملایمِ عناصر در حینِ اسکرولِ سریع استفاده می‌کند — همان حسی
 * که اسکرولِ اینرسیایی می‌دهد، بدونِ ربودنِ اسکرولِ مرورگر.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0;
    let last = window.scrollY;
    let vel = 0;
    let decay = 0;

    // پس از توقفِ اسکرول، سرعت باید نرم به صفر برگردد وگرنه کشیدگی «گیر»
    // می‌کند. این حلقه فقط تا وقتی زنده است که مقدارِ قابلِ‌توجهی مانده باشد.
    const relax = () => {
      vel *= 0.86;
      if (Math.abs(vel) < 0.004) {
        vel = 0;
        decay = 0;
        root.style.setProperty('--vel', '0');
        return;
      }
      root.style.setProperty('--vel', vel.toFixed(3));
      decay = requestAnimationFrame(relax);
    };

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      el.style.setProperty('--progress', String(ratio));

      if (still) return;
      const dy = window.scrollY - last;
      last = window.scrollY;
      // ۱۵۰px جابه‌جایی در یک فریم = بیشینه‌ی اثر. با ۹۰ حتی یک نُچِ چرخِ
      // ماوس هم اشباع می‌شد و اثر به‌جای «سرعت» یک آفستِ ثابت به‌نظر می‌رسید.
      vel = Math.max(-1, Math.min(1, dy / 150));
      root.style.setProperty('--vel', vel.toFixed(3));
      if (!decay) decay = requestAnimationFrame(relax);
    };
    const onScroll = () => {
      // یک به‌روزرسانی در هر فریم — نه در هر رویدادِ اسکرول.
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (decay) cancelAnimationFrame(decay);
      root.style.removeProperty('--vel');
    };
  }, []);

  return <div ref={ref} className="scroll-progress" aria-hidden="true" />;
}

/**
 * شمارنده‌ای که با دیده‌شدن تا مقدارِ نهایی بالا می‌رود.
 * اگر مقدار عددی نباشد (مثلِ «∞» یا «۱۰۰٪») همان متن نمایش داده می‌شود —
 * محتوای CMS نباید مجبور به عددی‌بودن باشد.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const digits = value.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
    const target = Number(digits.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(target) || target <= 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const suffix = value.replace(/[۰-۹\d.,]/g, '');
    let raf = 0;
    let start = 0;
    const duration = 900;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const step = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min(1, (ts - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const current = Math.round(target * eased);
          setText(String(current).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) + suffix);
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value]);

  return <span ref={ref} className={className}>{text}</span>;
}

/** هاله‌ای که اشاره‌گر را داخلِ کارت دنبال می‌کند (فقط دستگاهِ اشاره‌گردار). */
export function SpotlightCard({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <Tag ref={ref as never} className={`card--spot ${className}`}>
      {children}
    </Tag>
  );
}
