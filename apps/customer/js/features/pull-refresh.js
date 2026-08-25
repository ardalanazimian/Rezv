// ═══════════════════════════════════════════════════════════
//  رزرونو — Pull-to-Refresh روی فیدِ کشف (C15)
//  ژستِ لمسیِ «کشیدن رو-به-پایین برای تازه‌سازی»، فقط وقتی:
//    • صفحه‌ی «کشف» فعال است، و
//    • اسکرولِ صفحه در بالاست (window.scrollY <= 0).
//
//  ایمنی (تا اسکرولِ عمودی و تستِ e2e نشکند):
//   • listenerِ touchmove فقط «حین» یک کشیدنِ فعال اضافه و در پایان حذف می‌شود
//     (هیچ non-passive touchmoveِ سراسری روی کلِ اسکرول نمی‌ماند).
//   • preventDefault فقط وقتی واقعاً در حالِ کشیدنِ رو-به-پایین در بالای صفحه‌ایم.
//   • تازه‌سازی = واقعاً از سرور می‌خواند (syncRestaurants). آفلاین/خطا → همان
//     fallbackِ همیشگیِ loadRestaurants (بدونِ دادهٔ جعلی).
//   • احترام به prefers-reduced-motion (بدونِ انیمیشنِ ترنسفورم).
//
//  ⚠️ رفع‌شده (پروتکل §۱۰/§۲۷): doRefresh قبلاً فقط `renderDiscoverSections()` و
//  `renderFeed(R)` را با **همان دادهٔ درون‌حافظه‌ای** صدا می‌زد. یعنی ژستِ
//  «بکش تا تازه شود» ۵۲۰ms اسپینر نشان می‌داد و هیچ درخواستی نمی‌رفت — کاربر
//  مطمئن می‌شد داده نو شده در حالی که دقیقاً همان بایت‌های قبلی بود.
// ═══════════════════════════════════════════════════════════
import { syncRestaurants } from '../init.js';
import { renderEvents } from '../data/discover.js';

const THRESHOLD = 64;   // px کشیدن برای فعال‌شدنِ تازه‌سازی
const MAX_PULL  = 96;   // سقفِ جابه‌جاییِ اندیکاتور
const RESIST    = 0.45; // مقاومت (کشش نرم‌تر از حرکتِ انگشت)

let _startY = 0, _pulling = false, _armed = false, _busy = false;

function reduced(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{ return false; } }
function discoverActive(){ const p = document.getElementById('page-discover'); return !!(p && p.classList.contains('active')); }
function atTop(){ return (window.scrollY || document.documentElement.scrollTop || 0) <= 0; }

function el(){
  let e = document.getElementById('ptr');
  if(e) return e;
  e = document.createElement('div');
  e.id = 'ptr'; e.className = 'ptr'; e.setAttribute('aria-hidden','true');
  e.innerHTML = '<div class="ptr-spin"></div>';
  document.body.appendChild(e);
  return e;
}

function setPull(px){
  const e = el();
  const clamped = Math.min(px, MAX_PULL);
  if(reduced()){ e.style.transform = ''; e.classList.toggle('show', clamped > 8); }
  else { e.style.transform = `translateX(-50%) translateY(${clamped}px)`; e.classList.toggle('show', clamped > 4); }
  e.classList.toggle('ready', px >= THRESHOLD);
}

async function doRefresh(){
  if(_busy) return;
  _busy = true;
  const e = el();
  e.classList.add('spinning', 'show');
  if(!reduced()) e.style.transform = `translateX(-50%) translateY(${THRESHOLD}px)`;
  // خواندنِ واقعیِ رستوران‌ها + بخش‌هایی که خودشان I/O دارند (رویداد/موقعیت).
  // اسپینر تا پایانِ درخواستِ واقعی می‌چرخد، نه یک مدتِ ثابت.
  try{
    await syncRestaurants();      // renderFeed + بخش‌هایِ وابسته به R
    await renderEvents();         // «تازه‌سازی» یعنی رویدادها هم واقعاً دوباره خوانده شوند
  }catch(err){}
  const hide = ()=>{
    e.classList.remove('spinning', 'ready', 'show');
    e.style.transform = '';
    _busy = false;
  };
  // حداقلِ ۳۰۰ms دیده‌شدن تا اسپینر روی پاسخِ خیلی سریع «پرش» نکند.
  setTimeout(hide, 300);
}

function onMove(e){
  if(!_pulling){ return; }
  const y = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
  const dy = y - _startY;
  if(dy <= 0 || !atTop()){ // کاربر بالا می‌رود یا دیگر در بالا نیست → لغو
    _armed = false; setPull(0); return;
  }
  _armed = true;
  // فقط وقتی واقعاً می‌کشیم، از bounce/اسکرولِ منفی جلوگیری کن
  if(e.cancelable) e.preventDefault();
  setPull(dy * RESIST);
}

function endPull(){
  document.removeEventListener('touchmove', onMove, { passive: false });
  const wasArmed = _armed;
  const pulled = wasArmed && parseFloat((el().style.transform.match(/translateY\(([-\d.]+)px\)/)||[])[1] || '0');
  _pulling = false; _armed = false;
  if(wasArmed && pulled >= THRESHOLD){ doRefresh(); }
  else { const e = el(); e.classList.remove('ready','show'); e.style.transform = ''; }
}

function onStart(e){
  if(_busy || _pulling) return;
  if(!discoverActive() || !atTop()) return;
  if(!(e.touches && e.touches.length === 1)) return;
  _startY = e.touches[0].clientY;
  _pulling = true; _armed = false;
  // touchmove را فقط حالا (حینِ کشیدنِ کاندید) اضافه کن؛ در پایان حذف می‌شود.
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', endPull, { once: true });
  document.addEventListener('touchcancel', endPull, { once: true });
}

try{
  document.addEventListener('touchstart', onStart, { passive: true });
}catch(e){}
