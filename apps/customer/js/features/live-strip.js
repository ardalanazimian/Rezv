// ═══════════════════════════════════════════════════════════
//  رزرونو — نوارِ زنده‌ی فیدِ کشف (live-strip) — با دادهٔ واقعی
//  منبع: GET /api/v1/restaurants/live-stats (شمارشِ واقعی از دیتابیس).
//  اصلِ «بدونِ دادهٔ جعلی»: پیش از این نوار اعداد hard-codedِ ساختگی داشت
//  («۱۲ رستوران در حال پر شدن»، «کش‌بک ۷٪»...). حالا:
//    • اگر endpoint پاسخِ سالم بدهد → pillها از اعدادِ واقعیِ سرور ساخته
//      می‌شوند (فقط مقادیرِ غیرِصفر نمایش داده می‌شوند؛ همه‌صفر = خالیِ صادق).
//    • اگر پاسخ ناموفق باشد یا fetch اصلاً بترکد → نوار **کاملاً خالی**
//      می‌ماند، نه یک عددِ جایگزین. علتش: `if(!out)` نمی‌توانست «سرور صفر
//      برگرداند» را از «سرور اصلاً جواب نداد» تشخیص دهد، و نسخه‌ی قبلی در
//      حالتِ دوم به‌جایِ خالی‌ماندن، تعدادِ رستوران‌های بارگذاری‌شده‌ی
//      کلاینت (که می‌توانست دادهٔ نمونه/آفلاین یا دادهٔ کهنه باشد) را به‌عنوانِ
//      «N رستوران فعال» نشان می‌داد — یعنی دقیقاً عددی که هیچ endpointی
//      تولیدش نکرده بود (بندِ ۳: شکستِ شبکه هرگز موفقیت/دادهٔ جعلی نیست).
//      الگو از js/api.js (loadRestaurants) گرفته شده: res.ok تعیین می‌کند
//      خالی صادقانه است یا نه، نه وجودِ خروجیِ نهایی.
// ═══════════════════════════════════════════════════════════
import { API } from '../api.js';
import { fmtFa } from '../data/discover.js';

function pill(inner){ return `<div class="live-pill">${inner}</div>`; }

export async function refreshLiveStrip(){
  const el = document.getElementById('liveStrip');
  if(!el) return;
  let out = '';
  try{
    const res = await API.get('/restaurants/live-stats');
    if(res && res.ok){
      // پاسخِ سالم رسید — حتی اگر هر سه عدد صفر باشند این «خالیِ صادق»ه،
      // نه «نامعلوم». فقط همین شاخه اجازه دارد pill بسازد.
      if(res.data){
        const d = res.data;
        if(Number(d.fillingUp) > 0)
          out += pill(`<span class="live-dot-sm"></span><b>${fmtFa(d.fillingUp)} رستوران</b> الان در حال پر شدن`);
        if(Number(d.openRestaurants) > 0)
          out += pill(`<b>${fmtFa(d.openRestaurants)} رستوران</b> باز و آنلاین`);
        if(Number(d.activeReservations) > 0)
          out += pill(`🔥 <b>${fmtFa(d.activeReservations)} رزرو</b> فعالِ امروز`);
      }
    } else {
      // ناموفق (۴xx/۵xx یا پاسخِ ناسالم) — بی‌صدا نه: لاگ کن، ولی چیزی جعل نکن.
      console.warn('[رزرونو] live-stats: پاسخِ ناموفق — نوارِ زنده خالی می‌ماند', res && res.status, res && res.error);
    }
  }catch(e){
    // شبکه/timeout قطع شد — بی‌صدا نه: لاگ کن، ولی چیزی جعل نکن (بندِ ۳).
    console.warn('[رزرونو] live-stats: خطای شبکه — نوارِ زنده خالی می‌ماند', e);
  }
  el.innerHTML = out; // موفق+صفر → خالیِ صادق. ناموفق/شبکه → همان خالی، هرگز عددِ جعلی.
}

// بعد از رندرِ اولیه‌ی اپ یک بار به‌روزرسانی کن
try{
  const boot = ()=> setTimeout(refreshLiveStrip, 400);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}catch(e){}

try{ window.refreshLiveStrip = refreshLiveStrip; }catch(e){}
