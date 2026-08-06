'use client';

// ═══════════════════════════════════════════════════════════════════════
//  لایه‌ی حرکتِ سایت — «سینماییِ» واقعی، نه fade ساده
//
//  چهار ابزار که با هم زبانِ حرکتِ سایت را می‌سازند:
//    SplitText   عنوان کلمه‌به‌کلمه بالا می‌آید (نه یک بلوکِ محو)
//    Parallax    عنصر با سرعتِ متفاوت از اسکرول حرکت می‌کند → عمق
//    Magnetic    دکمه به اشاره‌گر جذب می‌شود (فقط دسکتاپ)
//    Ambient     میدانِ ذره‌ی پس‌زمینه که به اشاره‌گر واکنش می‌دهد
//
//  سه قاعده در همه‌شان یکسان است:
//    ۱) prefers-reduced-motion → همه‌چیز در حالتِ نهایی و ثابت
//    ۲) بدونِ کتابخانه — همان سه وابستگیِ اپ
//    ۳) transform و opacity فقط؛ هیچ چیزی که layout را دوباره حساب کند
//
//  همه‌ی حلقه‌های rAF با IntersectionObserver خاموش می‌شوند تا خارج از قاب
//  باتری مصرف نشود.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, type ReactNode } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── SplitText ───────────────────────────────────────────────────────────

/**
 * عنوان را به کلمه می‌شکند و هرکدام با تأخیرِ پلکانی از پایین می‌آید.
 *
 * کلمه و نه حرف: در فارسی حروف به‌هم می‌چسبند و شکستنِ حرفی شکلِ کلمه را
 * خراب می‌کند (چسبندگیِ عربی). کلمه امن است و همان حسِ پلکانی را می‌دهد.
 */
export function SplitText({
  text, as: Tag = 'span', className, delay = 0, stagger = 55,
}: {
  text: string;
  as?: 'span' | 'h1' | 'h2' | 'h3';
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(/(\s+)/);
  return (
    <Tag className={className}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}> </span>
        ) : (
          <span className="kx-word" key={i}>
            <span
              className="kx-word__in"
              style={{ animationDelay: `${delay + (i / 2) * stagger}ms` }}
            >
              {w}
            </span>
          </span>
        ),
      )}
    </Tag>
  );
}

// ── Parallax ────────────────────────────────────────────────────────────

/**
 * عنصر را با ضریبی از اسکرول جابه‌جا می‌کند. مثبت = کندتر از صفحه.
 * فقط transform تغییر می‌کند، پس روی نخِ compositor می‌ماند.
 */
export function Parallax({
  children, speed = 0.12, className,
}: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;

    let raf = 0;
    let visible = false;
    let current = 0;

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' });
    io.observe(el);

    const tick = () => {
      if (visible) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // ۰ در مرکزِ قاب، ±۱ در لبه‌ها
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        const target = -p * speed * 100;
        current += (target - current) * 0.12;   // میرایی، تا پرش نداشته باشد
        el.style.transform = `translate3d(0, ${current.toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [speed]);

  return <div ref={ref} className={className}>{children}</div>;
}

// ── Magnetic ────────────────────────────────────────────────────────────

/**
 * دکمه در شعاعِ مشخصی به اشاره‌گر جذب می‌شود.
 * روی دستگاهِ لمسی اصلاً فعال نمی‌شود — آنجا اشاره‌گری وجود ندارد.
 */
export function Magnetic({
  children, strength = 0.32, className,
}: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    // بیشینه‌ی جابه‌جایی. دکمه باید «کشیده شود»، نه اینکه پرواز کند: نسخه‌ی
    // قبلی شعاعِ ۱٫۱ برابرِ عرض داشت و کشش خطی بود، یعنی از فاصله‌ی ۲۰۰px هم
    // ۶۴px جابه‌جا می‌شد و روی متنِ بالای خودش می‌افتاد (در مرورگر دیده شد).
    const MAX_PULL = 16;
    const clamp = (v: number) => (v > MAX_PULL ? MAX_PULL : v < -MAX_PULL ? -MAX_PULL : v);

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const radius = Math.min(Math.max(r.width, r.height) * 0.9, 180);
      if (dist < radius) {
        // افتِ خطی تا لبه: روی مرزِ شعاع کشش صفر می‌شود، پس دکمه هنگامِ
        // ورود/خروجِ اشاره‌گر نمی‌پرد.
        const pull = strength * (1 - dist / radius);
        tx = clamp(dx * pull);
        ty = clamp(dy * pull);
      } else { tx = 0; ty = 0; }
    };
    const onLeave = () => { tx = 0; ty = 0; };

    const tick = () => {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);

  return <span ref={ref} className={`kx-mag ${className ?? ''}`}>{children}</span>;
}

// ── Ambient ─────────────────────────────────────────────────────────────

/**
 * میدانِ ذره‌ی پس‌زمینه. ذره‌ها آرام شناورند و نزدیکِ اشاره‌گر روشن‌تر
 * می‌شوند و کمی کنار می‌روند. خطوطِ بینِ ذره‌های نزدیک هم کشیده می‌شود —
 * همان حسِ «شبکه‌ی زنده» بدونِ اینکه شلوغ شود.
 *
 * تعدادِ ذره با مساحتِ صفحه تنظیم می‌شود، پس روی موبایل سبک می‌ماند.
 */
export function Ambient({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    if (reducedMotion()) return;

    let W = 0, H = 0, dpr = 1;
    let pts: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const pointer = { x: -9999, y: -9999 };

    const readColor = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        dot: s.getPropertyValue('--brand').trim() || '#e2612c',
        link: s.getPropertyValue('--accent').trim() || '#ddb457',
      };
    };
    let col = readColor();

    const size = () => {
      const r = cv.parentElement?.getBoundingClientRect();
      W = r?.width ?? window.innerWidth;
      H = r?.height ?? window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = Math.round(Math.min(72, (W * H) / 24000) * density);
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: 0.8 + Math.random() * 1.5,
      }));
    };
    size();

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (cv.parentElement) io.observe(cv.parentElement);

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const onOut = () => { pointer.x = -9999; pointer.y = -9999; };

    const tick = () => {
      if (visible) {
        ctx.clearRect(0, 0, W, H);
        for (const p of pts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;

          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
          const near = d < 130 ? 1 - d / 130 : 0;
          if (near > 0) {
            // کمی از اشاره‌گر فاصله می‌گیرد
            p.x += ((p.x - pointer.x) / (d || 1)) * near * 0.7;
            p.y += ((p.y - pointer.y) / (d || 1)) * near * 0.7;
          }

          ctx.fillStyle = col.dot;
          ctx.globalAlpha = 0.16 + near * 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + near * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // خطِ بینِ ذره‌های نزدیک
        ctx.strokeStyle = col.link;
        ctx.lineWidth = 0.7;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 15000) continue;
            ctx.globalAlpha = (1 - d2 / 15000) * 0.14;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    };

    const mo = new MutationObserver(() => { col = readColor(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onOut);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); mo.disconnect();
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onOut);
    };
  }, [density]);

  return <canvas className="kx-ambient" ref={ref} aria-hidden="true" />;
}

// ── Tilt ────────────────────────────────────────────────────────────────

/** کارت با حرکتِ اشاره‌گر کمی می‌چرخد — عمقِ سه‌بعدی بدونِ کتابخانه. */
export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform =
        `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
      el.style.setProperty('--kx-mx', `${(e.clientX - r.left).toFixed(0)}px`);
      el.style.setProperty('--kx-my', `${(e.clientY - r.top).toFixed(0)}px`);
    };
    const onLeave = () => { el.style.transform = ''; };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [max]);

  return <div ref={ref} className={`kx-tilt ${className ?? ''}`}>{children}</div>;
}
