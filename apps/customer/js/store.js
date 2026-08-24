// ═══════════════════════════════════════════════════════════
//  Store مرکزی — تنها منبعِ حقیقتِ state اپ (بدون فریم‌ورک)
//
//  چرا: قبلاً state (USER, R, favs, ...) در ۵ فایلِ مختلف پخش بود. با یک Store
//  مرکزی: پیدا کردنِ state آسان، تغییرات قابلِ ردیابی، و اشتراکِ تمیز بین ماژول‌ها.
//
//  الگو: یک آبجکتِ ساده‌ی reactive. با store.set() تغییر بده، با store.on() به
//  تغییرات گوش بده (برای رندرِ خودکار). سبک، ~۴۰ خط، مناسبِ Vanilla JS.
//
//  استفاده:
//    Store.user            → خواندن
//    Store.set('user', u)  → نوشتن + اطلاع به شنونده‌ها
//    Store.on('user', fn)  → گوش‌دادن به تغییر
// ═══════════════════════════════════════════════════════════
import { API, USER } from './api.js';
import { favs } from './data/seed.js';
import { R } from './init.js';
export const Store = (() => {
  const state = {
    user: null,            // کاربرِ واردشده (یا null)
    restaurants: [],       // لیستِ رستوران‌ها (از API یا نمونه)
    favorites: new Set(),  // شناسه‌های علاقه‌مندی
    trips: [],             // رزروهای کاربر
    nextCursor: null,      // صفحه‌بندیِ lazy loading
    currentRest: null,     // رستورانِ در حالِ نمایش
    waitlist: null,        // ورودیِ فعلیِ لیست انتظار
    theme: 'dark',         // تمِ فعلی
    points: 0,             // امتیازِ وفاداری
  };
  const listeners = {};    // key → [callbacks]

  return {
    // خواندنِ مستقیم (getter برای هر کلید)
    get user() { return state.user; },
    get restaurants() { return state.restaurants; },
    get favorites() { return state.favorites; },
    get trips() { return state.trips; },
    get nextCursor() { return state.nextCursor; },
    get currentRest() { return state.currentRest; },
    get waitlist() { return state.waitlist; },
    get theme() { return state.theme; },
    get points() { return state.points; },

    /** نوشتنِ یک کلید + اطلاع به شنونده‌ها. */
    set(key, value) {
      state[key] = value;
      (listeners[key] || []).forEach(fn => { try { fn(value); } catch {} });
      return value;
    },

    /** گوش‌دادن به تغییرِ یک کلید (برای رندرِ واکنشی). */
    on(key, fn) {
      (listeners[key] = listeners[key] || []).push(fn);
    },

    /** خواندنِ کلِ snapshot (برای دیباگ). */
    snapshot() { return { ...state, favorites: [...state.favorites] }; },
  };
})();

