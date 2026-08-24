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
import { httpJson, refreshAccessToken, resolveApiBase } from './api-core.js';
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

  // منطقِ تمدید حالا در shared/js/api-core.js است (§۶ — سه کپیِ یکسان یکی شد).
  async _doRefresh(){ return refreshAccessToken(this); },

  // نشست منقضی شد (refresh هم جواب نداد) → پاکسازی + اعلام
  _onSessionExpired(){
    this.setToken(null); this.setRefresh(null);
    if (typeof onSessionExpired === 'function') onSessionExpired();
  },

  get(path){ return this.request(path); },
  // headers اختیاری: برای عملیاتِ حساس (مثلاً رزرو) که به Idempotency-Key نیاز دارند.
  post(path, body, headers){ return this.request(path, { method: 'POST', body: JSON.stringify(body || {}), headers }); },
  // PATCH — برایِ به‌روزرسانیِ جزئی (مثلاً ترجیحاتِ اعلان). قبلاً فقط
  // updateProfile به‌صورتِ دستی PATCH می‌زد؛ حالا فعلِ عمومی هم هست.
  patch(path, body, headers){ return this.request(path, { method: 'PATCH', body: JSON.stringify(body || {}), headers }); },

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
  syncNavPoints();
}

// ⚠️ رفعِ باگِ واقعی (۲۰۲۶-۰۸-۱۳): چیپِ امتیازِ نوارِ بالا عددِ ثابتِ ۳۴۰ را
// مستقیم در markup داشت و فقط وقتی کاربر تبِ «باشگاه» را باز می‌کرد با
// مقدارِ واقعی جایگزین می‌شد. یعنی هر کاربری در نگاهِ اول امتیازِ کسِ دیگری
// را می‌دید. حالا:
//   • مهمانِ ناشناس → چیپ اصلاً نمایش داده نمی‌شود (امتیازی ندارد که نشان بدهیم)
//   • کاربرِ واردشده → تا رسیدنِ پاسخِ سرور «—» و بعد عددِ واقعی
// عمداً هیچ عددی حدس زده نمی‌شود؛ نبودِ داده یعنی نبودِ ادعا.
let _ptsInFlight = null;
export function syncNavPoints(){
  const wrap = document.querySelector('.nav-pts');
  const el = document.getElementById('navPts');
  if (!wrap || !el) return;
  if (!USER) { wrap.style.display = 'none'; el.textContent = '—'; return; }
  wrap.style.display = '';
  if (_ptsInFlight) return;
  _ptsInFlight = API.get('/me/loyalty').then(res => {
    if (res.ok && typeof res.data?.points === 'number') {
      el.textContent = res.data.points.toLocaleString('fa-IR');
      import('./data/seed.js').then(m => m.setPts(res.data.points)).catch(() => {});
    } else {
      el.textContent = '—';   // سرور نگفت → چیزی ادعا نمی‌کنیم
    }
  }).catch(() => { el.textContent = '—'; })
    .finally(() => { _ptsInFlight = null; });
}

// ⚠️ رفع‌شده (R1 — حسابرسیِ صداقتِ دادهٔ غنی، ۲۰۲۶-۰۸-۱۴): تا امروز فقط
// slots از این باگ رفع شده بود. فیلدهایِ روایی/محتواییِ دیگر (menu, rb,
// revs, about, feats, good, bad, ai) همچنان بدونِ قیدِ apiR.slug از
// sampleFallback پر می‌شدند — یعنی هر رستورانِ واقعی که این فیلدها را از
// بک‌اند نمی‌گرفت (که فعلاً همیشه همین‌طور است)، منو/نظر/توضیحاتِ یک
// رستورانِ کاملاً نامرتبط را به‌عنوانِ محتوایِ خودش نشان می‌داد — دقیقاً
// همان الگویِ ممنوع‌شده که برایِ slots رفع شده بود. حالا همان قاعده:
// اگر apiR.slug هست (یعنی رستورانِ واقعی/زنده)، این فیلدها فقط از خودِ
// API می‌آیند؛ نبودشان یعنی خالی/null، نه قرض‌گرفتن از نمونه. sampleFallback
// فقط در مسیرِ کاملاً آفلاین/بدونِ‌slug استفاده می‌شود.
const EMPTY_RB = { food: 0, service: 0, atmo: 0, value: 0 };

// نگاشت داده‌ی API به ساختار فرانت‌اند (R)
// بک‌اند فاز ۱ این فیلدها را می‌دهد: id, slug, name, cuisine, ...
// فیلدهای غنی (منو، نظرات، تفکیک امتیاز) که هنوز در API نیستند، برایِ
// رستورانِ واقعی خالی می‌مانند (نه از نمونه) — رجوع به توضیحِ بالا.
/** priceBand عددیِ بک‌اند (۱..۴) → همان شکلِ $ که UI انتظار دارد. */
function bandToPrice(band){
  const n = Number(band);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? '$'.repeat(n) : '';
}

export function mapApiRestaurant(apiR, sampleFallback){
  const isLive = !!apiR.slug; // رستورانِ واقعی/زنده — نه مسیرِ کاملاً آفلاین
  return {
    id: apiR.id,
    slug: apiR.slug || sampleFallback?.slug || null,
    e: apiR.emoji || sampleFallback?.e || '🍽️',
    n: apiR.name,
    cuisine: apiR.cuisine || sampleFallback?.cuisine || '',
    // ⚠️ قراردادِ شکسته (F1): کلاینت `price_range` می‌خواند ولی بک‌اند
    // `priceBand` (یک عددِ ۱..۴ — schema.prisma:105) می‌فرستد. یعنی مقدار
    // همیشه undefined می‌شد و به بازه‌ی قیمتِ یک رستورانِ **نمونه‌ی بی‌ربط**
    // می‌افتاد. حالا عددِ واقعیِ سرور به همان شکلِ $ نگاشت می‌شود.
    price: bandToPrice(apiR.priceBand) || apiR.price_range || (isLive ? '' : sampleFallback?.price || '$$'),

    // ⚠️ جعلِ اعتبارِ اجتماعی (F2): بک‌اند عمداً `rating: null` می‌فرستد وقتی
    // هیچ نظری ثبت نشده — کامنتِ خودِ route می‌گوید «null یعنی هنوز نمی‌دانیم،
    // نه صفر و نه عددِ ساختگی». ولی `?? sampleFallback?.rt` دقیقاً همان عددِ
    // ساختگی را می‌گذاشت: یک رستورانِ بدونِ نظر با ۴.۸ ستاره نمایش داده می‌شد.
    // برایِ رستورانِ زنده هرگز از نمونه پر نمی‌شود؛ null می‌ماند و UI ادعایی
    // نمی‌کند (همان قاعده‌ای که چند خط پایین‌تر برایِ سیگنال‌هایِ اجتماعی نوشته شده).
    rt: isLive ? (typeof apiR.rating === 'number' ? apiR.rating : null) : (sampleFallback?.rt ?? 0),
    reviews: isLive ? (apiR.reviews_count ?? apiR.review_count ?? 0) : (sampleFallback?.reviews ?? 0),
    // ── سیگنال‌های اجتماعی: فقط از API، بدونِ fallbackِ نمونه ──
    // اگر بک‌اند نگفته، null می‌ماند و UI هیچ ادعایی نشان نمی‌دهد. عمداً از
    // sampleFallback پر نمی‌شوند: دادهٔ نمونه برای «شکلِ صفحه» است، نه برای
    // ادعای آماری درباره‌ی یک کسب‌وکارِ واقعی.
    visits7d: apiR.visits_7d ?? null,
    recommendPct: apiR.recommend_pct ?? null,
    // ── سیاستِ رزرو (رفعِ P1-3، پروتکل §۲۰) ──
    // دقیقاً همان قاعده‌ی بالا: فقط از API، بدونِ fallbackِ نمونه.
    // null = «سرور نگفته» → UI هیچ ادعایی درباره‌ی پیش‌پرداخت نمی‌کند.
    // true/false = حقیقتِ واقعیِ همان رستوران.
    //
    // چرا لازم شد: اپ در دو جا هاردکد می‌گفت «بدون پیش‌پرداخت»، در حالی که
    // depositRequired یک سیاستِ واقعیِ قابلِ‌تنظیمِ رستوران است. رستورانی که
    // بیعانه را روشن می‌کرد، همچنان به مشتری «رایگان» نشان داده می‌شد.
    depositRequired: apiR.booking_policy?.deposit_required ?? null,
    freeCancelHours: apiR.booking_policy?.free_cancel_hours ?? null,
    lat: apiR.latitude ?? null,
    lng: apiR.longitude ?? null,
    vibes: apiR.vibes || sampleFallback?.vibes || [],
    cb: (apiR.cbBasePct ?? apiR.cashback_percent) ?? sampleFallback?.cb ?? 0,
    // ⚠️ رفع‌شده (Part 1 — حسابرسیِ صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): sampleFallback
    // اینجا عمداً حذف شد، هم‌ردیفِ visits7d/recommendPct بالا — به همون دلیل:
    // این «شکلِ صفحه» نیست، ادعایِ ساعتِ رزروِ واقعی است. backend فعلاً
    // اصلاً available_slots برنمی‌گردونه (چک‌شده — هیچ routeای این فیلد رو
    // نمی‌ده)، پس این خط همیشه به sampleFallback?.slots می‌افتاد. مشکلِ
    // دوم (جدی‌تر): loadRestaurants پایین‌تر sampleFallback رو با
    // `R_SAMPLE.find(s => s.id === apiR.id) || R_SAMPLE[0]` پیدا می‌کنه —
    // apiR.id همیشه UUIDِ واقعیه، R_SAMPLE.id عددِ کوچیکه، پس find همیشه
    // هیچ‌چی پیدا نمی‌کنه و به‌طورِ سراسری R_SAMPLE[0] فال‌بک می‌شه. یعنی
    // تا امروز، کارتِ *هر* رستورانِ واقعی (آنلاین) دقیقاً همون سه ساعتِ
    // R_SAMPLE[0] رو به‌عنوانِ پیش‌نمایشِ سانس نشون می‌داد — دقیقاً همون
    // «۱۹:۰۰/۲۰:۰۰/۲۱:۰۰ به‌عنوانِ live» که قانونِ صداقتِ این ماموریت صریحاً
    // ممنوع کرده. حالا رستورانِ واقعی (apiR.slug موجوده) بدونِ available_slots
    // یعنی [] خالی — کارت به CTAِ «ببین سانس‌ها»یِ آرام می‌افته، نه سانسِ جعلی.
    // توجه: همین باگِ id-mismatch رویِ فیلدهایِ دیگه (menu/rb/feats/about/...)
    // هم هست — خارج از دامنه‌ی این ماموریت (فقط سانس)؛ در KNOWN_LIMITATIONS ثبت شد.
    slots: apiR.available_slots || (isLive ? [] : sampleFallback?.slots) || [],
    badge: apiR.badge ?? sampleFallback?.badge ?? null,
    // ai/good/bad قبلاً بدونِ هیچ‌شرطی از sampleFallback می‌آمدند — یعنی حتی
    // برایِ رستورانِ واقعی هم «مهمان‌ها تعریف می‌کنن از...» با جمله‌هایِ
    // رستورانِ نمونه پر می‌شد. حالا برایِ رستورانِ زنده همیشه خالی/false‌اند.
    ai: isLive ? false : (sampleFallback?.ai ?? false),
    about: apiR.description || (isLive ? '' : sampleFallback?.about) || '',
    feats: apiR.features || (isLive ? [] : sampleFallback?.feats) || [],
    rb: apiR.rating_breakdown || (isLive ? EMPTY_RB : sampleFallback?.rb) || EMPTY_RB,
    menu: apiR.menu || (isLive ? [] : sampleFallback?.menu) || [],
    good: isLive ? [] : (sampleFallback?.good || []),
    bad: isLive ? [] : (sampleFallback?.bad || []),
    revs: apiR.reviews || (isLive ? [] : sampleFallback?.revs) || [],
  };
}

// ⚠️ رفع‌شده (R1): این تابع قبلاً همیشه یک نمونه‌ی *ثابت* انتخاب می‌کرد —
// apiR.id همیشه UUID واقعی است و هیچ‌وقت با idِ عددیِ R_SAMPLE برابر
// نمی‌شود، پس R_SAMPLE.find(...) همیشه شکست می‌خورد و `|| R_SAMPLE[0]`
// برایِ *همه‌ی* رستوران‌های واقعی یک sampleFallbackِ یکسان می‌ساخت — حتی
// فیلدهایِ صرفاً تزئینی (ایموجی/رنگ/vibes) هم همیشه از رستورانِ نمونه‌ی
// شماره‌ی ۱ می‌آمدند. حالا: اگر R_SAMPLE بعداً slug گرفت، اول با slug مچ
// می‌شود؛ وگرنه یک نمونه‌ی متنوع (نه همیشه [0]) بر اساسِ هشِ id انتخاب
// می‌شود — فیلدهایِ روایی/محتوایی که در mapApiRestaurant پشتِ isLive
// قفل شده‌اند اصلاً به این تابع کاری ندارند.
function pickSampleFallback(apiR){
  if(!R_SAMPLE.length) return undefined;
  const bySlug = apiR.slug && R_SAMPLE.find(s=>s.slug===apiR.slug);
  if(bySlug) return bySlug;
  const key=String(apiR.id||'');
  let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0;
  return R_SAMPLE[h % R_SAMPLE.length];
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
    return list.map(apiR => mapApiRestaurant(apiR, pickSampleFallback(apiR)));
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
  return list.map(apiR => mapApiRestaurant(apiR, pickSampleFallback(apiR)));
}

// ═══════════ DATA ═══════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.isLoggedIn = isLoggedIn;
window.logout = logout;
