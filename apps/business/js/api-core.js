/* ═══════════════════════════════════════════════════════════
   رزرونو — هسته‌ی مشترکِ HTTP (transport) — منبعِ واحد
   این فایل منبعِ حقیقت است؛ tools/sync-design-system.sh آن را به اپ‌ها می‌سازد
   (customer نسخه‌ی ESM عیناً؛ در آینده پنل‌ها نسخه‌ی global).

   httpJson: یک fetchِ کم‌سطحِ بدونِ حالت — timeout، پارس JSON، envelope یکدست،
   و حالتِ offline. هیچ منطقِ auth/token/refresh اینجا نیست (آن سطح در هر اپ می‌ماند).
   خروجی:
     موفق   → { ok:true,  status, data }
     ناموفق → { ok:false, status, data, error }
     خطا/timeout → { ok:false, offline:true, error }
   ═══════════════════════════════════════════════════════════ */
// آدرسِ پایه‌ی API — قابلِ تنظیم بدونِ build: window.RZ_API_BASE یا
// <meta name="rz-api-base" content="https://...">. پیش‌فرض '' = same-origin
// (رفتارِ فعلی/دمو بدونِ تغییر). منبعِ واحد برای هر سه اپ.
function resolveApiBase() {
  try {
    if (typeof window !== 'undefined' && window.RZ_API_BASE) return String(window.RZ_API_BASE).replace(/\/$/, '');
    const m = (typeof document !== 'undefined') && document.querySelector('meta[name="rz-api-base"]');
    if (m && m.content) return String(m.content).trim().replace(/\/$/, '');
  } catch { /* noop */ }
  return '';
}

async function httpJson(url, opts = {}, timeoutMs = 8000) {
  // روی پروتکل file: (باز کردن مستقیم HTML) درخواستِ نسبی به file:///api/… می‌رود
  // و همیشه شکست می‌خورد + خطای کنسول می‌سازد؛ مستقیم حالتِ offline برگردان.
  try {
    if (typeof location !== 'undefined' && location.protocol === 'file:' && !/^https?:/i.test(url)) {
      return { ok: false, offline: true, error: { message: 'اتصال به سرور برقرار نشد' } };
    }
  } catch { /* noop */ }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error || { message: `خطای ${res.status}` } };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, offline: true, error: { message: e.name === 'AbortError' ? 'زمان درخواست تمام شد' : 'اتصال به سرور برقرار نشد' } };
  }
}

// ── تولیدِ کلیدِ Idempotency برای عملیاتِ نوشتنیِ حساس (مثلاً ثبتِ رزرو) ──
// یک UUID per «قصدِ کاربر» (نه per تلاشِ HTTP): سرِ فراخوان (مثلاً confirmBook)
// یک‌بار ساخته می‌شود و برای همه‌ی تلاش‌های داخلیِ همان submit (شاملِ retryِ
// خودکارِ ۴۰۱→refresh) همان می‌ماند؛ submitِ بعدیِ کاربر کلیدِ تازه می‌گیرد —
// این‌طور دوبار زدنِ دکمه/ریترایِ شبکه رزروِ دوم نمی‌سازد، ولی submitِ جدید هم
// بی‌جهت به کلیدِ کهنه گیر نمی‌کند.
function genIdempotencyKey() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  // fallback برای مرورگر/محیطِ بدونِ crypto.randomUUID (نسخه‌ی v4-like غیررمزنگارانه؛
  // اینجا فقط برای یکتاییِ محلیِ کلیدِ idempotency لازم است، نه امنیت).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

if (typeof window !== "undefined") { window.httpJson = httpJson; window.resolveApiBase = resolveApiBase; window.genIdempotencyKey = genIdempotencyKey; }
