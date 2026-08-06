'use client';

// ═══════════════════════════════════════════════════════════════════════
//  نشانگرِ سفارشی — فقط روی دستگاهِ اشاره‌گردار
//
//  یک نقطه که دقیقاً روی مکانِ ماوس است و یک حلقه که با تأخیر دنبالش
//  می‌آید. همین اختلافِ کوچک همان چیزی است که حرکت را «گران» نشان می‌دهد.
//
//  چهار تصمیمِ محافظه‌کارانه:
//   • cursor:none از داخلِ JS روی <html> می‌نشیند. اگر JS اجرا نشود،
//     نشانگرِ سیستم سرِ جایش می‌ماند و کاربر گم نمی‌شود.
//   • فقط (pointer: fine) — روی موبایل هیچ چیزی ساخته نمی‌شود.
//   • با prefers-reduced-motion هیچ‌وقت فعال نمی‌شود.
//   • mix-blend-mode: difference یعنی روی تمِ روشن و تاریک هر دو دیده
//     می‌شود، بدونِ اینکه دو نسخه‌ی رنگی نگه داریم.
//
//  حالت‌ها با یک شنودِ pointerover روی document تشخیص داده می‌شوند
//  (نه listener روی تک‌تکِ لینک‌ها) تا محتوای داینامیک هم پوشش پیدا کند.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

const INTERACTIVE = 'a,button,[role="button"],input,select,textarea,summary,label,.card,[data-cursor]';

export function Cursor() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    const ring = document.createElement('div');
    const dot = document.createElement('div');
    ring.className = 'cur cur--ring';
    dot.className = 'cur cur--dot';
    ring.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    root.classList.add('has-cursor');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let scale = 1;
    let target = 1;
    let shown = false;
    let raf = 0;

    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; root.classList.add('cur-on'); }
    };

    const over = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.(INTERACTIVE);
      target = hit ? 2.5 : 1;
      ring.classList.toggle('is-hot', Boolean(hit));
    };

    const down = () => { ring.classList.add('is-down'); };
    const up = () => { ring.classList.remove('is-down'); };
    const leave = () => { root.classList.remove('cur-on'); shown = false; };

    const tick = () => {
      // میان‌یابیِ نمایی: حلقه هر فریم ۱۸٪ فاصله‌ی باقی‌مانده را طی می‌کند
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      scale += (target - scale) * 0.14;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
      dot.style.transform = `translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', over, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointerleave', leave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.removeEventListener('pointerleave', leave);
      root.classList.remove('has-cursor', 'cur-on');
      ring.remove();
      dot.remove();
    };
  }, []);

  return null;
}
