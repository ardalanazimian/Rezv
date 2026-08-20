// ═══════════════════════════════════════════════════════════
//  Action Layer — یک نقطه‌ی مرکزی برای همه‌ی کلیک‌ها (Event Delegation)
//
//  چرا: قبلاً ۱۰۱ تا onclick="fn()" داشتیم که توابع را مجبور می‌کرد global باشند
//  (تضاد با ES Modules). با این الگو:
//    • فقط یک listener روی document (به‌جای ۱۰۱ listener) → صفر memory leak
//    • توابع دیگر لازم نیست global باشند → ES Modules ممکن می‌شود
//    • در HTML: onclick="fn(x)" → data-action="fn" data-arg="x"
//
//  این الگویی است که اپ‌های production مدرن استفاده می‌کنند (delegation).
//
//  استفاده:
//    Actions.register('go', (arg) => {...})       ثبتِ یک اکشن
//    <button data-action="go" data-arg="discover"> در HTML
//    (کلیک روی هر عنصرِ data-action خودکار تابعِ متناظر را صدا می‌زند)
// ═══════════════════════════════════════════════════════════
import { go } from './data/discover.js';
export const Actions = (() => {
  const registry = {};
  let wired = false;

  function handle(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const name = el.dataset.action;
    const fn = registry[name];
    if (!fn) return;
    // آرگومان‌ها: data-arg (تکی) یا data-args (JSON برای چندتایی)
    let args = [];
    if (el.dataset.args !== undefined) {
      try { args = JSON.parse(el.dataset.args); } catch { args = [el.dataset.args]; }
    } else if (el.dataset.arg !== undefined) {
      const a = el.dataset.arg;
      // تبدیلِ عددیِ خودکار (مثل شناسه‌ی رستوران)
      args = [/^-?\d+$/.test(a) ? Number(a) : a];
    }
    fn(...args, el, e);
  }

  return {
    /** ثبتِ یک اکشن (نام → تابع). */
    register(name, fn) { registry[name] = fn; },

    /** ثبتِ چند اکشن یکجا از یک آبجکت. */
    registerAll(obj) { Object.keys(obj).forEach(k => { registry[k] = obj[k]; }); },

    /** فعال‌سازیِ delegation (یک‌بار، روی document). */
    init() {
      if (wired) return;
      wired = true;
      document.addEventListener('click', handle);

      // ── کیبورد: Escape برای بستن، Enter/Space برای فعال‌سازیِ عناصرِ data-action ──
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // بستنِ هر overlay/sheet که باز است (استانداردِ UX)
          const dna = document.getElementById('dnaOverlay');
          const sheet = document.getElementById('sheet');
          if (dna && dna.classList.contains('show')) { window.closeFoodDNA && window.closeFoodDNA(); return; }
          if (sheet && sheet.classList.contains('show')) { window.closeSheet && window.closeSheet(); return; }
        }
        // Enter/Space روی عناصرِ تعاملیِ غیر-button (data-action یا role=button) → فعال‌سازی
        if ((e.key === 'Enter' || e.key === ' ')) {
          const el = e.target.closest('[data-action], [role="button"]');
          if (el && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
            e.preventDefault();
            el.click();
          }
        }
      });
    },
  };
})();

