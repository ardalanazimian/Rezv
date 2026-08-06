'use client';

// ═══════════════════════════════════════════════════════════════════════
//  «شبِ سرویس» — شبیه‌سازیِ زنده‌ی یک شبِ کاریِ رستوران روی Canvas
//
//  چرا Canvas و نه SVGِ ثابت: این صحنه ۲۰ میز و ده‌ها رزرو دارد که هر فریم
//  تغییر می‌کنند. با DOM یعنی صدها گره و layout thrash؛ با Canvas یک عنصر.
//
//  چرا بدونِ کتابخانه‌ی انیمیشن: کلِ اپ سه وابستگی دارد (next/react/react-dom)
//  و افزودنِ کتابخانه برای یک صحنه توجیه ندارد. رفتار در همین فایل است.
//
//  زمان به اسکرول گره خورده: هرچه پایین‌تر بروی، شب جلوتر می‌رود — میزها پر
//  می‌شوند، لیستِ انتظار شکل می‌گیرد، و عددها بالا می‌روند. یعنی حرکت
//  تزئین نیست؛ همان چیزی را می‌گوید که محصول انجام می‌دهد.
//
//  دسترسی‌پذیری: با prefers-reduced-motion صحنه در وضعیتِ «اوجِ شب» ثابت
//  می‌ماند (نه خالی) و هیچ حرکتی اجرا نمی‌شود. متنِ کنارش همیشه کاملِ ماجرا
//  را می‌گوید، پس این صحنه هرگز تنها حاملِ اطلاعات نیست.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

interface Table {
  x: number; y: number; w: number; h: number;
  seats: number;
  /** لحظه‌ای از شب (۰..۱) که این میز پر می‌شود */
  fillsAt: number;
  round: boolean;
}

// چیدمانِ ثابت — نه تصادفی. یک سالنِ باورپذیر: پنجره‌ها بالا، بار سمتِ چپ،
// میزهای دونفره‌ی جمع‌وجور جلو، میزهای بزرگ ته سالن.
const TABLES: Table[] = [
  { x: 0.08, y: 0.12, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.10, round: true },
  { x: 0.24, y: 0.12, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.18, round: true },
  { x: 0.40, y: 0.10, w: 0.16, h: 0.13, seats: 4, fillsAt: 0.26, round: false },
  { x: 0.62, y: 0.10, w: 0.16, h: 0.13, seats: 4, fillsAt: 0.34, round: false },
  { x: 0.84, y: 0.12, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.55, round: true },

  { x: 0.08, y: 0.34, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.22, round: true },
  { x: 0.26, y: 0.33, w: 0.18, h: 0.14, seats: 6, fillsAt: 0.30, round: false },
  { x: 0.50, y: 0.33, w: 0.18, h: 0.14, seats: 6, fillsAt: 0.42, round: false },
  { x: 0.74, y: 0.32, w: 0.21, h: 0.16, seats: 8, fillsAt: 0.50, round: false },

  { x: 0.08, y: 0.56, w: 0.13, h: 0.12, seats: 4, fillsAt: 0.38, round: false },
  { x: 0.26, y: 0.57, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.46, round: true },
  { x: 0.42, y: 0.56, w: 0.13, h: 0.12, seats: 4, fillsAt: 0.62, round: false },
  { x: 0.60, y: 0.57, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.70, round: true },
  { x: 0.76, y: 0.56, w: 0.19, h: 0.13, seats: 6, fillsAt: 0.58, round: false },

  { x: 0.08, y: 0.76, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.66, round: true },
  { x: 0.24, y: 0.76, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.78, round: true },
  { x: 0.40, y: 0.75, w: 0.16, h: 0.13, seats: 4, fillsAt: 0.74, round: false },
  { x: 0.62, y: 0.75, w: 0.16, h: 0.13, seats: 4, fillsAt: 0.86, round: false },
  { x: 0.84, y: 0.76, w: 0.11, h: 0.11, seats: 2, fillsAt: 0.92, round: true },
];

const TOTAL_SEATS = TABLES.reduce((s, t) => s + t.seats, 0);

/** میان‌یابیِ نرم — بدونِ آن، میزها ناگهانی روشن می‌شوند. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function ServiceNight() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statSeats = useRef<HTMLSpanElement>(null);
  const statTables = useRef<HTMLSpanElement>(null);
  const statClock = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // رنگ‌ها از همان توکن‌های سایت خوانده می‌شوند تا صحنه با تم عوض شود.
    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        line: s.getPropertyValue('--border-strong').trim() || 'rgba(255,255,255,.2)',
        idle: s.getPropertyValue('--surface-3').trim() || '#2c231f',
        ember: s.getPropertyValue('--brand').trim() || '#e2612c',
        brass: s.getPropertyValue('--accent').trim() || '#ddb457',
        live: s.getPropertyValue('--success').trim() || '#45c99a',
        text: s.getPropertyValue('--text-3').trim() || '#8a7a6e',
      };
    };
    let tokens = readTokens();

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // پیشرفتِ شب: ۰ = درهای باز، ۱ = اوجِ شب.
    let night = reduced ? 1 : 0;
    let target = reduced ? 1 : 0;

    // صحنه باید از سالنِ خالی شروع شود، وگرنه نیمی از داستان دیده نمی‌شود.
    // نسخه‌ی اول از موقعیتِ عنصر در قاب حساب می‌کرد و چون هیرو همان اول کاملاً
    // دیده می‌شود، لحظه‌ی بارگذاری روی ۲۱:۴۷ می‌افتاد.
    //
    // حالا دو محرک دارید:
    //   ۱) ورودِ سینمایی: چند ثانیه‌ی اول خودش تا اوایلِ شب جلو می‌رود، تا
    //      صفحه در لحظه‌ی اول مرده نباشد.
    //   ۲) بعد از نخستین اسکرول، کنترل کاملاً دستِ کاربر است.
    let userScrolled = false;
    const introStart = performance.now();
    const INTRO_MS = 4200;
    const INTRO_TO = 0.42;

    const onScroll = () => {
      if (reduced) return;
      const y = window.scrollY || 0;
      if (y > 4) userScrolled = true;
      if (!userScrolled) return;
      const span = wrap.getBoundingClientRect().height + (window.innerHeight || 1) * 0.6;
      target = clamp01(y / span);
    };
    onScroll();

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    let raf = 0;
    let t0 = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - t0) / 1000, 0.05);
      t0 = now;

      // ورودِ سینمایی تا وقتی کاربر اسکرول نکرده
      if (!reduced && !userScrolled) {
        target = INTRO_TO * easeOut(clamp01((now - introStart) / INTRO_MS));
      }
      night += (target - night) * Math.min(dt * 3.2, 1);

      ctx.clearRect(0, 0, W, H);
      const pad = Math.min(W, H) * 0.04;
      const iw = W - pad * 2;
      const ih = H - pad * 2;

      // شبکه‌ی کفِ سالن — ظریف، فقط برای حسِ فضا
      ctx.strokeStyle = tokens.line;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      const step = Math.max(28, Math.min(W, H) / 14);
      for (let x = pad; x <= W - pad; x += step) {
        ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
      }
      for (let y = pad; y <= H - pad; y += step) {
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      let seated = 0;
      let busy = 0;

      for (const t of TABLES) {
        const x = pad + t.x * iw;
        const y = pad + t.y * ih;
        const w = t.w * iw;
        const h = t.h * ih;

        // چقدر از «پرشدنِ» این میز گذشته
        const local = clamp01((night - t.fillsAt) / 0.12);
        const k = easeOut(local);
        if (local > 0.55) { seated += t.seats; busy++; }

        // میزِ خالی
        ctx.fillStyle = tokens.idle;
        ctx.globalAlpha = 0.55;
        roundRect(x, y, w, h, t.round ? Math.min(w, h) / 2 : 10);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (k > 0) {
          // هاله‌ی گرمِ میزِ پر — نورِ روی میز
          const cx = x + w / 2, cy = y + h / 2;
          const rad = Math.max(w, h) * (0.75 + k * 0.5);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          g.addColorStop(0, tokens.ember);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.28 * k;
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;

          // خودِ میز
          ctx.fillStyle = tokens.ember;
          ctx.globalAlpha = 0.30 + 0.55 * k;
          roundRect(x, y, w, h, t.round ? Math.min(w, h) / 2 : 10);
          ctx.fill();
          ctx.globalAlpha = 1;

          // خطِ دورِ برنجی وقتی کاملاً نشسته‌اند
          if (k > 0.9) {
            ctx.strokeStyle = tokens.brass;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.5;
            roundRect(x, y, w, h, t.round ? Math.min(w, h) / 2 : 10);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.strokeStyle = tokens.line;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1;
          roundRect(x, y, w, h, t.round ? Math.min(w, h) / 2 : 10);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // تعدادِ نفرات روی میزهای بزرگ‌تر
        if (w > 44) {
          ctx.fillStyle = k > 0.6 ? '#fff' : tokens.text;
          ctx.globalAlpha = k > 0.6 ? 0.92 : 0.5;
          ctx.font = `600 ${Math.max(10, Math.min(13, w / 5))}px Vazirmatn, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(t.seats), x + w / 2, y + h / 2);
          ctx.globalAlpha = 1;
        }
      }

      // نبضِ «زنده» گوشه‌ی صحنه
      if (!reduced) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 520);
        ctx.fillStyle = tokens.live;
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        ctx.beginPath();
        ctx.arc(W - pad - 6, pad + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // عددها — از همان شبیه‌سازی، نه ثابت
      if (statSeats.current) statSeats.current.textContent = toFa(seated);
      if (statTables.current) statTables.current.textContent = toFa(busy) + '⁄' + toFa(TABLES.length);
      if (statClock.current) statClock.current.textContent = clockOf(night);

      raf = requestAnimationFrame(draw);
    };

    const onTheme = () => { tokens = readTokens(); };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onTheme);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      mq.removeEventListener('change', onTheme);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="night">
      <div className="night__canvas" ref={wrapRef}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="night__hud">
        <span className="night__stat">
          <span className="night__num" ref={statClock}>۱۸:۰۰</span>
          <span className="night__lbl">ساعتِ سرویس</span>
        </span>
        <span className="night__stat">
          <span className="night__num" ref={statTables}>۰⁄۱۹</span>
          <span className="night__lbl">میزِ نشسته</span>
        </span>
        <span className="night__stat">
          <span className="night__num" ref={statSeats}>۰</span>
          <span className="night__lbl">مهمان از {toFa(TOTAL_SEATS)} صندلی</span>
        </span>
      </div>
      {/* متنِ جایگزین برای صفحه‌خوان — صحنه هرگز تنها حاملِ اطلاعات نیست */}
      <p className="sr-only">
        شبیه‌سازیِ یک شبِ کاری: {toFa(TABLES.length)} میز با مجموعِ {toFa(TOTAL_SEATS)} صندلی
        که با پیشرفتِ شب پر می‌شوند.
      </p>
    </div>
  );
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** پیشرفتِ ۰..۱ را به ساعتِ سرویس (۱۸:۰۰ تا ۲۳:۳۰) تبدیل می‌کند. */
function clockOf(p: number): string {
  const mins = 18 * 60 + Math.round(clamp01(p) * 330);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${toFa(h)}:${toFa(m).padStart(2, '۰')}`;
}
