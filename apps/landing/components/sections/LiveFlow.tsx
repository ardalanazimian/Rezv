'use client';

// ═══════════════════════════════════════════════════════════════════════
//  «جریانِ زنده» — سفرِ یک رزرو از گوشیِ مهمان تا پنلِ رستوران
//
//  ادعای اصلیِ محصول این است که دو اپ روی یک دادهٔ واحد کار می‌کنند. آن را
//  نوشتن ساده است؛ نشان‌دادنش کار می‌کند. اینجا رزروها به‌صورتِ ذره از سمتِ
//  گوشی حرکت می‌کنند، از خطِ میانی رد می‌شوند و در پنل می‌نشینند.
//
//  Canvas چون ده‌ها ذره‌ی هم‌زمان داریم؛ با DOM هر فریم layout دوباره حساب
//  می‌شد. بدونِ کتابخانه، مثلِ بقیه‌ی اپ.
//
//  حرکت وقتی شروع می‌شود که بخش وارد قاب شود (IntersectionObserver) و وقتی
//  بیرون می‌رود متوقف می‌شود — روی موبایل باتری بیهوده مصرف نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

interface Particle {
  t: number;        // ۰..۱ روی مسیر
  speed: number;
  lane: number;     // انحرافِ عمودی
  seats: number;
  settled: boolean;
}

const LANES = 5;

export function LiveFlow() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        ember: s.getPropertyValue('--brand').trim() || '#e2612c',
        brass: s.getPropertyValue('--accent').trim() || '#ddb457',
        live: s.getPropertyValue('--success').trim() || '#45c99a',
        line: s.getPropertyValue('--border-strong').trim() || 'rgba(255,255,255,.2)',
        surf: s.getPropertyValue('--surface-3').trim() || '#2c231f',
        text: s.getPropertyValue('--text-2').trim() || '#b7a89c',
      };
    };
    let tk = readTokens();

    let W = 0, H = 0, dpr = 1;
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

    const parts: Particle[] = [];
    let landed = 0;
    let spawnAcc = 0;

    // در حالتِ کاهشِ حرکت، صحنه یک‌بار پر می‌شود و ثابت می‌ماند.
    if (reduced) {
      for (let i = 0; i < 9; i++) {
        parts.push({ t: 0.62 + (i % 3) * 0.12, speed: 0, lane: i % LANES, seats: 2 + (i % 4), settled: true });
      }
      landed = 12;
    }

    let running = false;
    const io = new IntersectionObserver(
      ([e]) => { running = e.isIntersecting; },
      { threshold: 0.15 },
    );
    io.observe(wrap);

    // RTL: مهمان سمتِ راست، رستوران سمتِ چپ — هم‌جهت با خودِ سایت.
    const pathAt = (t: number, lane: number) => {
      const x = W * (0.86 - t * 0.72);
      const midBend = Math.sin(t * Math.PI) * (H * 0.11);
      const laneY = H * (0.28 + (lane / (LANES - 1)) * 0.44);
      const y = laneY - midBend * (lane % 2 === 0 ? 1 : -1);
      return { x, y };
    };

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, W, H);

      // دو ستون: گوشیِ مهمان (راست) و پنلِ رستوران (چپ)
      const colW = Math.max(64, W * 0.13);
      const colH = H * 0.62;
      const colY = (H - colH) / 2;

      const drawCol = (x: number, label: string, accent: string) => {
        ctx.strokeStyle = tk.line;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        roundRect(ctx, x, colY, colW, colH, 14);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.1;
        roundRect(ctx, x, colY, colW, colH, 14);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = tk.text;
        ctx.font = `600 ${Math.max(10, Math.min(12, colW / 6))}px Vazirmatn, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + colW / 2, colY - 14);
      };
      drawCol(W - colW - 8, 'اپِ مشتری', tk.ember);
      drawCol(8, 'پنلِ کسب‌وکار', tk.live);

      // خطوطِ راهنمای مسیر
      ctx.strokeStyle = tk.line;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      for (let l = 0; l < LANES; l++) {
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += 0.05) {
          const p = pathAt(t, l);
          t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (running && !reduced) {
        spawnAcc += dt;
        if (spawnAcc > 0.62 && parts.length < 26) {
          spawnAcc = 0;
          parts.push({
            t: 0,
            speed: 0.16 + Math.random() * 0.1,
            lane: Math.floor(Math.random() * LANES),
            seats: [2, 2, 4, 4, 6][Math.floor(Math.random() * 5)],
            settled: false,
          });
        }
      }

      for (const p of parts) {
        if (running && !reduced && !p.settled) {
          p.t += p.speed * dt;
          if (p.t >= 1) { p.t = 1; p.settled = true; landed += p.seats; }
        }
        const { x, y } = pathAt(p.t, p.lane);
        const r = 7 + p.seats * 0.7;

        // دنباله‌ی نور
        if (!p.settled && p.t > 0.02) {
          const back = pathAt(Math.max(0, p.t - 0.09), p.lane);
          const g = ctx.createLinearGradient(back.x, back.y, x, y);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, tk.ember);
          ctx.strokeStyle = g;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = r * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = p.settled ? tk.live : tk.ember;
        ctx.globalAlpha = p.settled ? 0.9 : 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.max(9, r * 0.9)}px Vazirmatn, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(p.seats), x, y);
      }

      // ذره‌های نشسته را بعد از مدتی پاک می‌کنیم تا صحنه شلوغ نشود
      if (parts.length > 22) parts.splice(0, parts.length - 22);

      if (countRef.current) countRef.current.textContent = toFa(landed);
      raf = requestAnimationFrame(draw);
    };

    const onTheme = () => { tk = readTokens(); };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onTheme);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', onTheme);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="flow">
      <div className="flow__canvas" ref={wrapRef}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <p className="flow__cap">
        <span className="flow__num" ref={countRef}>۰</span>
        <span> مهمان از اپِ مشتری مستقیم روی میزهای شما نشست — بدونِ تماسِ تلفنی.</span>
      </p>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
