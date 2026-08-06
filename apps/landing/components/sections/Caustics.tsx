'use client';

// ═══════════════════════════════════════════════════════════════════════
//  کاستیک — نورِ زنده‌ی پس‌زمینه‌ی هیرو
//
//  ریاضیِ این افکت از کتابخانه‌ی شیدرهای Figma گرفته شده («Water caustic»:
//  الگوی تداخلِ تکرارشونده) و از WGSL به GLSL ES منتقل شده است. رنگ‌ها
//  عمداً عوض شده‌اند: به‌جای آبیِ آب، اخرا و برنجیِ برند — یعنی همان چیزی که
//  نورِ شمع روی لیوان و بشقاب می‌سازد. برای یک برندِ رستوران این تصویر
//  معنا دارد، برخلافِ گرادیانِ بنفشِ عمومی که امضای قالب‌های آماده است.
//
//  چرا WebGL و نه canvas 2d: این الگو باید در هر پیکسل حساب شود. روی CPU
//  حتی با نصفِ رزولوشن هم چند صد میلی‌ثانیه در هر فریم می‌گیرد. روی GPU
//  رایگان است.
//
//  چهار محافظِ کارایی:
//   • بوم با ضریبِ کمتر از ۱ رندر می‌شود و CSS بزرگش می‌کند. کاستیک نرم است
//     و بزرگ‌نمایی دیده نمی‌شود، ولی بارِ پیکسل نصف می‌شود.
//   • خارج از دید، حلقه‌ی rAF کاملاً می‌ایستد.
//   • با prefers-reduced-motion فقط یک فریمِ ثابت کشیده می‌شود.
//   • اگر WebGL نبود، کامپوننت چیزی رندر نمی‌کند و والد به میدانِ جریان
//     برمی‌گردد (بدونِ خطا، بدونِ قابِ خالی).
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { FlowField } from './FlowField';

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uCenter;     // مبدأ در بازه‌ی ۰..۱
uniform float uScale;
uniform float uIntensity;
uniform vec3  uDeep;       // رنگِ زمینه‌ی الگو
uniform vec3  uGlow;       // رنگِ تیغه‌های نور
uniform float uAlpha;      // بیشینه‌ی نمایانی

const float TAU = 6.28318530718;
const int   ITER = 5;

void main() {
  vec2 uvRaw = gl_FragCoord.xy / uRes;
  uvRaw.y = 1.0 - uvRaw.y;

  vec2 uv = (uvRaw - uCenter) / uScale + vec2(1.0 - uCenter.x, 1.0 - uCenter.y);

  float t = uTime * TAU / 100.0 + 23.0;
  float minDim = min(uRes.x, uRes.y);
  vec2  uvPx = uv * uRes / minDim;

  // هسته‌ی الگو: تداخلِ تکراری. هر گام، مختصات را با سینوس/کسینوسِ گامِ قبل
  // جابه‌جا می‌کند و فاصله‌ی معکوس را جمع می‌زند — همین «تیغه‌های نور» را
  // می‌سازد.
  vec2  p = fract(uvPx) * TAU - 250.0;
  vec2  i = p;
  float c = 1.0;
  float inten = mix(0.002519, 0.01178, uIntensity);

  for (int n = 0; n < ITER; n++) {
    float nt = t * float(n + 1);
    i = p + vec2(cos(nt - i.x) + sin(nt + i.y), sin(nt - i.y) + cos(nt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + nt) / inten), p.y / (cos(i.y + nt) / inten)));
  }
  c /= float(ITER);
  c = 1.17 - pow(c, 1.4);

  float mask = clamp(pow(abs(c), 8.0), 0.0, 1.0);

  // محوشدنِ لبه‌ها: نور باید از یک کانون بتابد، نه اینکه قاب را یکنواخت پر
  // کند. بدونِ این، متنِ روی تصویر خوانا نمی‌ماند.
  vec2  d = uvRaw - vec2(0.5, 0.10);
  d.x *= (uRes.x / max(uRes.y, 1.0)) * 0.55;   // پخشِ افقی‌تر: شبیهِ نورِ سقفی
  float falloff = smoothstep(0.95, 0.10, length(d));
  // پنجره‌ی متن: درست پشتِ تیتر و لید، نور عمداً کم می‌شود تا کنتراستِ
  // خواندن حفظ شود. بدونِ این، تیترِ درشت روی تیغه‌های روشن گم می‌شد.
  float textBand = smoothstep(0.10, 0.26, uvRaw.y) * (1.0 - smoothstep(0.42, 0.62, uvRaw.y));
  falloff *= 1.0 - 0.55 * textBand;

  float a = mask * uAlpha * falloff;
  vec3  col = mix(uDeep, uGlow, mask);
  fragColor = vec4(col * a, a);   // آلفای پیش‌ضرب‌شده
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function Caustics({ onUnavailable }: { onUnavailable?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: true,   // روی رندرِ نرم‌افزاری اجرا نشود
    });
    if (!gl) { setDead(true); onUnavailable?.(); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !prog) { setDead(true); onUnavailable?.(); return; }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setDead(true); onUnavailable?.(); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      center: gl.getUniformLocation(prog, 'uCenter'),
      scale: gl.getUniformLocation(prog, 'uScale'),
      intensity: gl.getUniformLocation(prog, 'uIntensity'),
      deep: gl.getUniformLocation(prog, 'uDeep'),
      glow: gl.getUniformLocation(prog, 'uGlow'),
      alpha: gl.getUniformLocation(prog, 'uAlpha'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // متناسب با آلفای پیش‌ضرب‌شده

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // بارِ پیکسل مهم‌ترین متغیرِ کارایی است. کاستیک نرم است، پس رندر با
    // ضریبِ کمتر و بزرگ‌نماییِ CSS عملاً دیده نمی‌شود.
    const renderScale = coarse ? 0.5 : 0.68;

    const isDark = () => document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme
        && window.matchMedia('(prefers-color-scheme: dark)').matches);

    let raf = 0;
    let visible = true;
    let t0 = performance.now();
    const pointer = { x: 0.5, y: 0.34, tx: 0.5, ty: 0.34 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (now: number) => {
      // کانونِ نور نرم دنبالِ اشاره‌گر می‌آید — حرکتی که کاربر خودش می‌سازد
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      const dark = isDark();
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, reduced ? 12 : (now - t0) / 1000 * 1.35);
      gl.uniform2f(u.center, pointer.x, pointer.y);
      gl.uniform1f(u.scale, 1.6);
      gl.uniform1f(u.intensity, 0.62);
      // عمق نزدیک به سیاه است، نه قهوه‌ای: با قهوه‌ای، میان‌تُن‌ها گِلی
      // می‌شدند و کلِ تصویر مثلِ یک لکه‌ی کدر دیده می‌شد (در مرورگر دیده شد).
      // در تمِ روشن برعکس، شدتِ اخرا بالا می‌رود وگرنه روی کاغذِ روشن فقط
      // یک مِهِ سفید بود.
      gl.uniform3f(u.deep, dark ? 0.06 : 0.72, dark ? 0.02 : 0.34, dark ? 0.01 : 0.12);
      gl.uniform3f(u.glow, dark ? 1.0 : 0.92, dark ? 0.66 : 0.45, dark ? 0.30 : 0.16);
      gl.uniform1f(u.alpha, dark ? 0.62 : 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    if (reduced) { draw(performance.now()); return; }

    const loop = (now: number) => {
      if (visible) draw(now);
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '10%' });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(r.width, 1)));
      pointer.ty = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(r.height, 1)));
    };
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', onMove, { passive: true });
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [onUnavailable]);

  if (dead) return null;
  return <canvas ref={ref} className="caustics" aria-hidden="true" />;
}

/**
 * نورِ هیرو با پشتیبان.
 *
 * روی دستگاهی که WebGL2 ندارد (یا فقط رندرِ نرم‌افزاری دارد) کاستیک اجرا
 * نمی‌شود؛ به‌جای قابِ خالی، همان میدانِ جریانِ canvas 2d می‌آید. یعنی هیرو
 * روی هیچ دستگاهی بی‌جان نمی‌ماند.
 */
export function HeroLight() {
  const [fallback, setFallback] = useState(false);
  const onUnavailable = useCallback(() => setFallback(true), []);
  return (
    <>
      <span className="hero__wash" aria-hidden="true" />
      {fallback ? <FlowField /> : <Caustics onUnavailable={onUnavailable} />}
    </>
  );
}
