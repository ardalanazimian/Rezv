'use client';

// ═══════════════════════════════════════════════════════════════════════
//  میدانِ جریان — پس‌زمینه‌ی زنده‌ی هیرو
//
//  به‌جای «لکه‌های محوِ گرادیانی» (که امضای قالب‌های آماده است) اینجا یک
//  میدانِ بردار واقعی محاسبه می‌شود: هزاران ذره در جهتی حرکت می‌کنند که از
//  یک نویزِ پیوسته می‌آید، و ردِ محوشونده‌شان تصویر را می‌سازد. هیچ دو
//  فریمی شبیهِ هم نیست.
//
//  چرا با canvas و نه CSS: مسیرِ ذره‌ها حالت دارد (موقعیتِ فریمِ قبل) و CSS
//  حالت ندارد. چرا بدونِ WebGL: این حجمِ کار روی 2d هم ۶۰fps می‌ماند و
//  shader یک لایه‌ی شکنندگی روی مرورگرهای قدیمی اضافه می‌کرد.
//
//  سه محافظِ کارایی:
//   • ذره‌ها بر اساسِ مساحتِ واقعی شمرده می‌شوند و سقف دارند (موبایل کمتر)
//   • با خروج از دید، حلقه‌ی rAF کاملاً متوقف می‌شود
//   • با prefers-reduced-motion فقط یک فریمِ ثابت کشیده می‌شود
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

/**
 * نویزِ ارزشیِ دوبعدی — نسخه‌ی سبکِ بدونِ کتابخانه.
 * hash قطعی است، پس میدان بینِ فریم‌ها پیوسته می‌ماند و ذره‌ها نمی‌پرند.
 */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number }

export function FlowField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = () => document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme
        && window.matchMedia('(prefers-color-scheme: dark)').matches);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: P[] = [];
    let raf = 0;
    let t = 0;
    let visible = true;
    // مکانِ اشاره‌گر به‌صورتِ نسبی نگه داشته می‌شود تا با تغییرِ اندازه معتبر بماند
    const pointer = { x: -9, y: -9, on: false };

    const spawn = (): P => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      life: 0,
      max: 90 + Math.random() * 190,
      hue: Math.random(),
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // چگالی ثابت بر واحدِ سطح، با سقفِ سخت‌گیرانه برای دستگاه‌های ضعیف
      const budget = window.matchMedia('(pointer: coarse)').matches ? 260 : 620;
      const count = Math.min(budget, Math.round((w * h) / 1700));
      particles = Array.from({ length: count }, spawn);
      ctx.clearRect(0, 0, w, h);
    };

    /** رنگِ رد: از اخرا تا برنجی، بر پایه‌ی «سن» و سرعتِ ذره. */
    const stroke = (p: P, speed: number) => {
      const k = p.hue * 0.55 + Math.min(1, speed / 2.4) * 0.45;
      const r = Math.round(226 + (199 - 226) * k);
      const g = Math.round(97 + (154 - 97) * k);
      const bl = Math.round(44 + (44 - 44) * k);
      // ذره در ابتدا و انتهای عمرش کم‌رنگ است → رد به‌جای خطِ بریده، محو می‌شود
      const fade = Math.sin((p.life / p.max) * Math.PI);
      // تمِ روشن به رنگِ پررنگ‌تر نیاز دارد: رد روی زمینه‌ی روشن با
      // source-over ترکیب می‌شود و همان مقدارِ تیره تقریباً ناپیدا بود.
      return `rgba(${r},${g},${bl},${(dark() ? 0.5 : 0.62) * fade})`;
    };

    const step = (advance: boolean) => {
      // به‌جای پاک‌کردن، یک لایه‌ی نیمه‌شفافِ هم‌رنگِ زمینه می‌کشیم: همین
      // چیزی است که «رد» می‌سازد. مقدارِ کم = دنباله‌ی بلندتر.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = dark() ? 'rgba(16,12,10,0.075)' : 'rgba(246,244,241,0.055)';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = dark() ? 'lighter' : 'source-over';
      ctx.lineWidth = 1.05;
      ctx.lineCap = 'round';

      for (const p of particles) {
        const px = p.x;
        const py = p.y;

        // زاویه‌ی میدان: نویز در مقیاسِ بزرگ + رانشِ آرامِ زمانی
        const a = noise(p.x * 0.0022, p.y * 0.0022 + t * 0.00035) * Math.PI * 3.2;
        p.vx += Math.cos(a) * 0.16;
        p.vy += Math.sin(a) * 0.16 - 0.035; // سوگیریِ ملایم به بالا: حسِ برخاستنِ گرما

        // چاهِ اشاره‌گر — ذره‌ها دورِ نشانگر می‌چرخند، نه اینکه فقط دور شوند
        if (pointer.on) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 32000 && d2 > 1) {
            const f = (1 - d2 / 32000) * 1.5;
            const d = Math.sqrt(d2);
            p.vx += (dx / d) * f - (dy / d) * f * 0.8;
            p.vy += (dy / d) * f + (dx / d) * f * 0.8;
          }
        }

        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        const speed = Math.hypot(p.vx, p.vy);
        ctx.strokeStyle = stroke(p, speed);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // بازتولید وقتی از قاب بیرون رفت یا عمرش تمام شد — تعدادِ ذره‌ها ثابت می‌ماند
        if (p.life > p.max || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
          Object.assign(p, spawn(), { y: Math.random() < 0.6 ? h + 10 : Math.random() * h });
        }
      }

      if (advance) t += 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = () => {
      if (visible) step(true);
      raf = requestAnimationFrame(loop);
    };

    resize();

    if (reduced) {
      // یک تصویرِ ثابتِ آبرومند: میدان را چند صد گام جلو می‌بریم و می‌ایستیم
      for (let i = 0; i < 220; i += 1) step(true);
      return;
    }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '15%' });
    io.observe(canvas);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.on = true;
    };
    const onLeave = () => { pointer.on = false; };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    // فقط روی دستگاهِ اشاره‌گردار — روی تاچ، اسکرول نباید میدان را بهم بزند
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('pointerleave', onLeave, { passive: true });
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} className="flowfield" aria-hidden="true" />;
}
