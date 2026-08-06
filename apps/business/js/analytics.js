// ═══════════════════════════════════════════════════════════
//  رزرونو (پنل کسب‌وکار) — امیترِ رویدادِ رفتاری (Data Platform · فاز۲)
//
//  اسکریپتِ کلاسیک (global، بدونِ import/export). رویدادها را دسته‌ای و بی‌صدا
//  به POST /api/v1/telemetry می‌فرستد. هرگز چیزی نمی‌شکند (همه‌ی مسیرها try/catch)؛
//  دمومود امن. ناشناس بر پایه‌ی sessionId. بعد از data.js (کلاینتِ API) بارگذاری شود.
//  window.rzTrack(type, payload) را در دسترس می‌گذارد.
//  معماری: docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var SOURCE = 'business';
  var SID_KEY = 'rz_sid_biz';
  var Q_KEY = 'rz_evq_biz';
  var MAX_BATCH = 50;
  var FLUSH_AT = 10;

  function endpoint() {
    var base = (typeof API !== 'undefined' && API && API.base) ? API.base : '';
    return base + '/api/v1/telemetry';
  }
  function sessionId() {
    try {
      var s = localStorage.getItem(SID_KEY);
      if (!s) { s = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(SID_KEY, s); }
      return s;
    } catch (e) { return 'anon'; }
  }

  var queue = [];
  try { var raw = localStorage.getItem(Q_KEY); if (raw) queue = JSON.parse(raw) || []; } catch (e) { queue = []; }
  function persist() { try { localStorage.setItem(Q_KEY, JSON.stringify(queue.slice(-200))); } catch (e) { /* سهمیه پر */ } }

  function flush(useBeacon) {
    if (!queue.length) return;
    // روی file: (باز کردن مستقیم HTML) ارسال ممکن نیست — بی‌صدا در صف بماند
    try { if (location.protocol === 'file:' && !/^https?:/i.test(endpoint())) return; } catch (e) { /* noop */ }
    var batch = queue.slice(0, MAX_BATCH);
    var body = JSON.stringify({ events: batch });
    var url = endpoint();
    if (useBeacon) {
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) {
          queue = queue.slice(batch.length); persist(); return;
        }
      } catch (e) { /* به fetch برگرد */ }
    }
    try {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .then(function (r) { if (r && r.ok) { queue = queue.slice(batch.length); persist(); } })
        .catch(function () { /* آفلاین — در صف می‌ماند */ });
    } catch (e) { /* no-op */ }
  }

  function track(type, payload) {
    try {
      queue.push({ type: String(type), occurredAt: new Date().toISOString(), source: SOURCE, sessionId: sessionId(), payload: payload || {} });
      persist();
      if (queue.length >= FLUSH_AT) flush(false);
    } catch (e) { /* no-op */ }
  }

  try {
    addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
    addEventListener('pagehide', function () { flush(true); });
  } catch (e) { /* no-op */ }

  try { if (queue.length) flush(false); } catch (e) { /* no-op */ }

  track('app.opened', {});
  try { window.rzTrack = track; } catch (e) { /* no-op */ }
})();
