// ═══════════════════════════════════════════════════════════
//  رزرونو — امیترِ رویدادِ رفتاری (Data Platform · فاز۲، اپ کاستومر)
//
//  رویدادها را دسته‌ای و بی‌صدا به POST /api/v1/telemetry می‌فرستد (فاز۱).
//  اصولِ حیاتی:
//   • هرگز چیزی را نمی‌شکند: همه‌ی مسیرها در try/catch؛ خطا → no-op.
//   • دمومود امن: اگر بک‌اند نبود/آفلاین، رویداد در localStorage صف می‌ماند و
//     در بارگذاریِ بعدی دوباره تلاش می‌شود؛ UI هرگز متأثر نمی‌شود.
//   • ناشناس بر پایه‌ی sessionId (sendBeacon نمی‌تواند هدرِ Authorization بگذارد،
//     پس userId سمتِ سرور فقط اگر توکن در fetch بود ضمیمه می‌شود — اینجا session-based).
//  معماری: docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md
// ═══════════════════════════════════════════════════════════
import { API } from './api.js';

const ENDPOINT = () => (API && API.base ? API.base : '') + '/api/v1/telemetry';
const SID_KEY = 'rz_sid';
const Q_KEY = 'rz_evq';
const MAX_BATCH = 50;
const FLUSH_AT = 10;      // وقتی صف به این حد رسید، زودتر بفرست

function sessionId() {
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) { s = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(SID_KEY, s); }
    return s;
  } catch { return 'anon'; }
}

let queue = [];
try { const raw = localStorage.getItem(Q_KEY); if (raw) queue = JSON.parse(raw) || []; } catch { queue = []; }

function persist() { try { localStorage.setItem(Q_KEY, JSON.stringify(queue.slice(-200))); } catch { /* سهمیه پر */ } }

function flush(useBeacon) {
  if (!queue.length) return;
  // روی file: (باز کردن مستقیم HTML) ارسال ممکن نیست — بی‌صدا در صف بماند
  try { if (location.protocol === 'file:' && !/^https?:/i.test(ENDPOINT())) return; } catch { /* noop */ }
  const batch = queue.slice(0, MAX_BATCH);
  const body = JSON.stringify({ events: batch });
  const url = ENDPOINT();
  // مسیرِ ۱: sendBeacon (قابل‌اعتماد هنگامِ بسته‌شدنِ صفحه)
  if (useBeacon) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) {
        queue = queue.slice(batch.length); persist(); return;
      }
    } catch { /* به fetch برگرد */ }
  }
  // مسیرِ ۲: fetch با keepalive
  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
      .then((r) => { if (r && r.ok) { queue = queue.slice(batch.length); persist(); } })
      .catch(() => { /* آفلاین — در صف می‌ماند */ });
  } catch { /* no-op */ }
}

/** ثبتِ یک رویدادِ رفتاری. هرگز پرتاب نمی‌کند. */
export function track(type, payload) {
  try {
    queue.push({ type: String(type), occurredAt: new Date().toISOString(), source: 'customer', sessionId: sessionId(), payload: payload || {} });
    persist();
    if (queue.length >= FLUSH_AT) flush(false);
  } catch { /* no-op */ }
}

// فلاش هنگامِ پنهان‌شدن/بسته‌شدنِ صفحه (بهترین لحظه برای beacon)
try {
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  addEventListener('pagehide', () => flush(true));
} catch { /* no-op */ }

// تلاش برای ارسالِ صفِ باقی‌مانده از نشستِ قبلی
try { if (queue.length) flush(false); } catch { /* no-op */ }

// رویدادِ آغازِ نشست
track('app.opened', {});

// نمایش روی window برای استفاده‌ی inline/سایر ماژول‌ها
try { window.rzTrack = track; } catch { /* no-op */ }
