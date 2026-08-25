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
// ── بسته‌ی آفلاینِ تک‌فایلی یا نه؟ ──
// `location.protocol === 'file:'` تنها نشانه‌ی قابلِ‌اعتمادِ «این نسخه عمداً
// بدونِ بک‌اند اجرا می‌شود» است (standalone/*.html). این تمایز حیاتی است و
// نباید با «سرور موقتاً در دسترس نیست» یکی گرفته شود:
//   • file://  → دمویِ آفلاینِ اعلام‌شده؛ دادهٔ نمونه و کدِ ثابتِ OTP مجازند.
//   • http(s) → استقرارِ واقعی؛ شکستِ شبکه باید **خطا** نشان دهد، نه موفقیتِ
//     جعلی یا دادهٔ نمونه‌ای که کاربر آن را واقعی می‌پندارد (پروتکل §۱۰).
// منبعِ واحد برای هر سه اپ — قبلاً همین شرط در ۵ جا کپی شده بود.
export function isOfflineDemo() {
  try { return typeof location !== 'undefined' && location.protocol === 'file:'; }
  catch { return false; }
}

// آدرسِ پایه‌ی API — قابلِ تنظیم بدونِ build: window.RZ_API_BASE یا
// <meta name="rz-api-base" content="https://...">. پیش‌فرض '' = same-origin
// (رفتارِ فعلی/دمو بدونِ تغییر). منبعِ واحد برای هر سه اپ.
export function resolveApiBase() {
  try {
    if (typeof window !== 'undefined' && window.RZ_API_BASE) return String(window.RZ_API_BASE).replace(/\/$/, '');
    const m = (typeof document !== 'undefined') && document.querySelector('meta[name="rz-api-base"]');
    if (m && m.content) return String(m.content).trim().replace(/\/$/, '');
  } catch { /* noop */ }
  return '';
}

export async function httpJson(url, opts = {}, timeoutMs = 8000) {
  // روی پروتکل file: (باز کردن مستقیم HTML) درخواستِ نسبی به file:///api/… می‌رود
  // و همیشه شکست می‌خورد + خطای کنسول می‌سازد؛ مستقیم حالتِ offline برگردان.
  if (isOfflineDemo() && !/^https?:/i.test(url)) {
    return { ok: false, offline: true, error: { message: 'اتصال به سرور برقرار نشد' } };
  }
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

// ═══════════════════════════════════════════════════════════
//  تمدیدِ توکن — منبعِ واحد برایِ هر سه اپ
//
//  ⚠️ چرا اضافه شد (پروتکل §۶ «duplicated authentication logic»):
//  همین منطق **سه بار** کپی شده بود — `apps/customer/js/api.js`،
//  `apps/business/js/data.js`، `apps/company/js/api.js` — با تنها تفاوتِ
//  پیشوندِ کلیدِ localStorage و نامِ callbackِ انقضا. یعنی هر رفعِ امنیتی رویِ
//  مسیرِ refresh باید سه بار اعمال می‌شد و **جاافتادنِ یکی یک آسیب‌پذیریِ
//  واقعی** بود (نشستی که باید باطل می‌شد، باطل نمی‌شد).
//
//  عمداً فقط همین هسته مشترک شد، نه کلِ `request`: پنلِ کسب‌وکار داخلِ
//  `request` منطقِ اضافیِ چندشعبه‌ای دارد (هدرِ X-Restaurant-Id و بازیابیِ
//  شعبه‌ی کهنه، با تاریخچه‌ی P0). ادغامِ آن یعنی یا از دست دادنِ آن رفتار یا
//  ساختنِ یک انتزاعِ پرشاخه — دقیقاً چیزی که §۷ منع می‌کند.
//
//  رفتار عیناً همان قبل است: چند ۴۰۱ِ هم‌زمان یک Promiseِ مشترک می‌گیرند
//  (بدونِ رقابت)، و refresh هم rotate می‌شود.
// ═══════════════════════════════════════════════════════════
export function refreshAccessToken(api) {
  if (api._refreshing) return api._refreshing;
  api._refreshing = (async () => {
    try {
      const res = await fetch(api.base + '/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: api._refresh }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.access) {
        api.setToken(data.access);
        api.setRefresh(data.refresh);   // rotation: refresh هم نو می‌شود
        return true;
      }
      return false;
    } catch { return false; }
    finally { api._refreshing = null; }
  })();
  return api._refreshing;
}

// ── تولیدِ کلیدِ Idempotency برای عملیاتِ نوشتنیِ حساس (مثلاً ثبتِ رزرو) ──
// یک UUID per «قصدِ کاربر» (نه per تلاشِ HTTP): سرِ فراخوان (مثلاً confirmBook)
// یک‌بار ساخته می‌شود و برای همه‌ی تلاش‌های داخلیِ همان submit (شاملِ retryِ
// خودکارِ ۴۰۱→refresh) همان می‌ماند؛ submitِ بعدیِ کاربر کلیدِ تازه می‌گیرد —
// این‌طور دوبار زدنِ دکمه/ریترایِ شبکه رزروِ دوم نمی‌سازد، ولی submitِ جدید هم
// بی‌جهت به کلیدِ کهنه گیر نمی‌کند.
export function genIdempotencyKey() {
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
