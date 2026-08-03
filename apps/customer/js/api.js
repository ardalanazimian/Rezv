// ═══════════════════════════════════════════════════════════
//  رزرونو — لایه‌ی API + وضعیتِ کاربر و احراز هویت
//  بخشی از اپ کاستومر (Vanilla JS، بدون build). scope سراسری مشترک.
//  ترتیبِ لود در index.html مهم است (این فایل به توابع/state قبلی وابسته است).
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  لایه‌ی اتصال API (فاز ۳) — پل بین فرانت‌اند و بک‌اند
//
//  این لایه پایه‌ی اتصال است. رفتارش:
//   • اگر بک‌اند در دسترس باشد → داده‌ی واقعی از API
//   • اگر نباشد (یا خطا) → برمی‌گردد به داده‌ی نمونه (اپ هیچ‌وقت نمی‌شکند)
//
//  تنظیم آدرس API: اگر فرانت و بک روی یک دامنه‌اند، همین '' کافی است
//  (nginx مسیر /api را پراکسی می‌کند). برای دامنه‌ی جدا، URL کامل بگذار.
// ═══════════════════════════════════════════════════════════
import { toast } from './auth.js';
import { go } from './data/discover.js';
import { R_SAMPLE } from './data/seed.js';
import { R } from './init.js';
import { httpJson, resolveApiBase } from './api-core.js';
// آدرسِ پایه‌ی API — قابلِ تنظیم بدونِ build:
//   ۱) window.RZ_API_BASE (اگر پیش از main.js ست شود)، یا
//   ۲) <meta name="rz-api-base" content="https://..."> در index.html
// پیش‌فرض '' یعنی same-origin (همان رفتارِ فعلی/دمو — بدونِ تغییر).
export const API = {
  base: resolveApiBase(),             // '' = same-origin؛ قابلِ override با window.RZ_API_BASE یا <meta rz-api-base>
  timeout: 8000,                     // سقف انتظار هر درخواست (ms)
  _token: null,                      // توکن دسترسی (بعد از ورود)
  _refresh: null,                    // توکن تمدید (۳۰ روزه)
  _refreshing: null,                 // Promise تمدید در جریان (تا چند ۴۰۱ همزمان یک بار refresh کنند)

  // ── نگه‌داری توکن: حافظه + localStorage (تا رفرش صفحه، کاربر را بیرون نیندازد) ──
  // نکته: در artifactها localStorage در دسترس نیست؛ با try/catch امن می‌شود و
  // فقط به حافظه برمی‌گردد. روی دامنه‌ی واقعی، این نشست را پایدار می‌کند.
  setToken(t){
    this._token = t;
    try { if (t) localStorage.setItem('rz_access', t); else localStorage.removeItem('rz_access'); } catch {}
  },
  getToken(){ return this._token; },
  setRefresh(t){
    this._refresh = t;
    try { if (t) localStorage.setItem('rz_refresh', t); else localStorage.removeItem('rz_refresh'); } catch {}
  },
  // بازیابی نشست از localStorage هنگام لود صفحه
  restoreSession(){
    try {
      this._token = localStorage.getItem('rz_access') || null;
      this._refresh = localStorage.getItem('rz_refresh') || null;
    } catch {}
    return !!this._token;
  },

  // درخواست پایه — fetchِ خام به httpJsonِ مشترک واگذار می‌شود؛ منطقِ auth/refresh
  // (Authorization، ۴۰۱→refresh→retry، session-expired) اینجا و بدونِ تغییر می‌ماند.
  async request(path, opts = {}, _retried = false){
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    const r = await httpJson(this.base + '/api/v1' + path, { ...opts, headers }, this.timeout);
    if (!r.ok && !r.offline && r.status === 401 && this._refresh && !_retried && !path.startsWith('/auth/')) {
      // ۴۰۱ روی توکن منقضی → یک‌بار refresh کن و درخواست را تکرار کن
      const refreshed = await this._doRefresh();
      if (refreshed) return this.request(path, opts, true);
      this._onSessionExpired(); // refresh هم شکست خورد → نشست تمام است
    }
    if (r.ok) return { ok: true, status: r.status, data: r.data };
    if (r.offline) return { ok: false, offline: true, error: r.error };
    const msg = r.error?.message || `خطای ${r.status}`;
    return { ok: false, status: r.status, error: r.error || { message: msg } };
  },

  // تمدید توکن — چند فراخوان همزمان یک Promise مشترک می‌گیرند (بدون رقابت)
  async _doRefresh(){
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      try {
        const res = await fetch(this.base + '/api/v1/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: this._refresh }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.access) {
          this.setToken(data.access);
          this.setRefresh(data.refresh);   // rotation: refresh هم نو می‌شود
          return true;
        }
        return false;
      } catch { return false; }
      finally { this._refreshing = null; }
    })();
    return this._refreshing;
  },

  // نشست منقضی شد (refresh هم جواب نداد) → پاکسازی + اعلام
  _onSessionExpired(){
    this.setToken(null); this.setRefresh(null);
    if (typeof onSessionExpired === 'function') onSessionExpired();
  },

  get(path){ return this.request(path); },
  post(path, body){ return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) }); },

  // ── احراز هویت (فاز ۳) ──
  async requestOtp(phone){
    return this.post('/auth/otp/request', { phone });
  },
  async verifyOtp(phone, code){
    const res = await this.post('/auth/otp/verify', { phone, code });
    if (res.ok && res.data?.access) {
      this.setToken(res.data.access);
      this.setRefresh(res.data.refresh);
    }
    return res;
  },
  async updateProfile(profile){
    return this.request('/me', { method: 'PATCH', body: JSON.stringify(profile) });
  },
  // خروج: توکن refresh را سمت سرور هم باطل می‌کند (نه فقط پاک‌کردن محلی)
  async doLogout(){
    if (this._refresh) {
      // بهترین تلاش: باطل‌سازی سمت سرور (اگر شبکه نبود، محلی پاک می‌شود)
      await fetch(this.base + '/api/v1/auth/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this._refresh }),
      }).catch(() => {});
    }
    this.setToken(null); this.setRefresh(null);
  },

  online: true,
};

// ═══════════ حالت کاربر (فاز ۳: ورود واقعی) ═══════════
// null = مهمان (وارد نشده) · object = کاربر وارد شده
export let USER = null;
export function setUSER(u){ USER = u; }
export function isLoggedIn(){ return USER !== null; }
export function userInitial(){ return USER?.firstName?.[0] || USER?.phone?.slice(-2,-1) || 'و'; }
export function userName(){ return USER ? ((USER.firstName||'') + ' ' + (USER.lastName||'')).trim() || 'کاربر رزرونو' : 'مهمان'; }
export async function logout(){
  await API.doLogout();          // باطل‌سازی سمت سرور + پاکسازی محلی
  USER = null;
  refreshAuthUI();
  go('discover');
  toast('👋','از حساب خارج شدی');
}
// وقتی نشست منقضی شد و تمدید هم جواب نداد (توکن باطل/سرقت) — کاربر را نرم بیرون ببر
export function onSessionExpired(){
  USER = null;
  refreshAuthUI();
  toast('🔒','نشست منقضی شد، دوباره وارد شو');
  go('discover');
}
// به‌روزرسانی نمایش‌های وابسته به کاربر (آواتار و...)
export function refreshAuthUI(){
  const av = document.querySelector('.nav-avatar');
  if (av) av.textContent = userInitial();
}

// نگاشت داده‌ی API به ساختار فرانت‌اند (R)
// بک‌اند فاز ۱ این فیلدها را می‌دهد: id, slug, name, cuisine, ...
// فیلدهای غنی (منو، نظرات، تفکیک امتیاز) که هنوز در API نیستند از نمونه پر می‌شوند.
export function mapApiRestaurant(apiR, sampleFallback){
  return {
    id: apiR.id,
    slug: apiR.slug || sampleFallback?.slug || null,
    e: apiR.emoji || sampleFallback?.e || '🍽️',
    n: apiR.name,
    cuisine: apiR.cuisine || sampleFallback?.cuisine || '',
    price: apiR.price_range || sampleFallback?.price || '$$',
    rt: apiR.rating ?? sampleFallback?.rt ?? 0,
    reviews: apiR.reviews_count ?? apiR.review_count ?? sampleFallback?.reviews ?? 0,
    vibes: apiR.vibes || sampleFallback?.vibes || [],
    cb: (apiR.cbBasePct ?? apiR.cashback_percent) ?? sampleFallback?.cb ?? 0,
    slots: apiR.available_slots || sampleFallback?.slots || [],
    badge: apiR.badge ?? sampleFallback?.badge ?? null,
    ai: sampleFallback?.ai ?? false,
    about: apiR.description || sampleFallback?.about || '',
    feats: apiR.features || sampleFallback?.feats || [],
    rb: apiR.rating_breakdown || sampleFallback?.rb || {food:0,service:0,atmo:0,value:0},
    menu: apiR.menu || sampleFallback?.menu || [],
    good: sampleFallback?.good || [],
    bad: sampleFallback?.bad || [],
    revs: apiR.reviews || sampleFallback?.revs || [],
  };
}

// بارگذاری رستوران‌ها: تلاش برای API، در صورت شکست → نمونه
export async function loadRestaurants(){
  const res = await API.get('/restaurants');
  // پاسخ جدید: { items, next_cursor, has_more } — با pagination
  // سازگاری عقب‌رو: اگر آرایه‌ی خام یا کلید restaurants بود هم کار کند
  const list = res.ok ? (res.data?.items || res.data?.restaurants || (Array.isArray(res.data) ? res.data : null)) : null;
  if (list && list.length) {
    API.online = true;
    NEXT_CURSOR = res.data?.next_cursor || null;  // برای بارگذاری صفحه‌ی بعد
    return list.map(apiR => {
      const fb = R_SAMPLE.find(s => s.id === apiR.id) || R_SAMPLE[0];
      return mapApiRestaurant(apiR, fb);
    });
  }
  // fallback
  API.online = false;
  if (res.offline) console.info('[رزرونو] بک‌اند در دسترس نیست — نمایش داده‌ی نمونه');
  return R_SAMPLE;
}
export let NEXT_CURSOR = null; // cursor صفحه‌ی بعد (lazy loading)
// بارگذاری صفحه‌ی بعد رستوران‌ها (هنگام اسکرول یا دکمه‌ی بیشتر)
export async function loadMoreRestaurants(){
  if (!NEXT_CURSOR) return [];
  const res = await API.get(`/restaurants?cursor=${encodeURIComponent(NEXT_CURSOR)}`);
  const list = res.ok ? (res.data?.items || []) : [];
  NEXT_CURSOR = res.data?.next_cursor || null;
  return list.map(apiR => mapApiRestaurant(apiR, R_SAMPLE.find(s => s.id === apiR.id) || R_SAMPLE[0]));
}

// ═══════════ DATA ═══════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.isLoggedIn = isLoggedIn;
window.logout = logout;
