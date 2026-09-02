// ═══════════════════════════════════════════════════════════
//  رزرونو — لیستِ انتظار (مدل OpenTable)
//  جدا شده از reservation.js (ریفکتور فاز۱: جداسازیِ مسئولیت‌ها).
//  رفتار دقیقاً همان قبل است؛ فقط از یک فایلِ مجزا export می‌شود.
//  همان مدلِ ماژول (بخشی از گرافِ ماژولِ main.js) + bindingهای window
//  برای onclickهای درونِ رشته‌های HTML.
// ═══════════════════════════════════════════════════════════
import { API } from './api.js';
import { genIdempotencyKey } from './api-core.js';
import { closeSheet, esc, faNum, jsq, toast } from './auth.js';
import { go } from './data/discover.js';
import { TRIPS, bk } from './data/seed.js';
import { findR } from './init.js';
import { icon } from './icons.js';

export let WL=null; // ورودی فعلی لیست انتظار کاربر { id, position, ... }
export let wlTimer=null;
// پیشنهاد پیوستن به صف وقتی ظرفیت پر است
export function offerWaitlist(id, r){
  const sheetBody=document.getElementById('sheetBody');
  sheetBody.innerHTML=`
    <div class="wl-join">
      <div class="wl-join-hero">
        <div class="wl-join-mesh"></div>
        <span class="wl-join-emoji">${icon('inbox',{size:28})}</span>
      </div>
      <div class="sheet-title" style="text-align:center">ظرفیت این ساعت پره</div>
      <div class="sheet-sub" style="text-align:center;margin-bottom:18px">${esc(r.n)} · ${esc(bk.date)} · ${esc(bk.time)}<br>به صف بپیوند — اگه میزی آزاد شه، <b>اول به تو</b> خبر می‌دیم</div>
      <div class="wl-benefits">
        <div class="wl-benefit"><span class="wl-bene-ic">${icon('bell',{size:18})}</span><div><b>اطلاع فوری</b><small>پیامک + نوتیفیکیشن لحظه‌ای</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">⏱️</span><div><b>تخمین زمان</b><small>می‌دونی چقدر باید صبر کنی</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">${icon('check',{size:18})}</span><div><b>کنترلِ کامل</b><small>آفر رو راحت قبول یا رد کن</small></div></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="buzz&&buzz();joinWaitlist(${jsq(String(id))})">پیوستن به لیست انتظار</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بی‌خیال</button>
    </div>`;
}
// ═══════════════════════════════════════════════════════════
//  ⚠️ رفعِ P0-3 (فازِ ۲، پروتکل §۳ — «NETWORK FAILURE ≠ SUCCESS»)
//
//  این فایل چهار مسیر داشت که وقتی بک‌اند در دسترس نبود، حقیقتِ کسب‌وکار را
//  **جعل** می‌کرد — بدونِ هیچ افشایی:
//    • joinWaitlist  → جایگاهِ تصادفیِ صف (Math.random) و «۲۵ دقیقه انتظار»
//    • refreshWL     → صف را جلو می‌برد و در نهایت «میزت آماده شد!» می‌گفت
//    • acceptWL      → کدِ رزروِ ساختگی + «رزروت ثبت شد!» + ورودی در TRIPS
//    • acceptWL (مسیرِ موفق) → اگر سرور کد نمی‌داد، کدِ جعلی می‌ساخت
//
//  مشتری با این باور که میز دارد سرِ قرار می‌رفت. حالا هر چهار مسیر خطایِ
//  صریح با امکانِ تلاشِ مجدد نشان می‌دهند.
//
//  چرا الگویِ «پیش‌نویسِ آفلاین» (Outbox) که پروتکل §۳ مجاز می‌داند اینجا
//  عمداً استفاده **نشد**: جایگاهِ صف ذاتاً زمان‌مند است — «پیوستنِ تأخیری»
//  خودش یک ادعایِ نادرست است، چون تا وقتی درخواست به سرور نرسیده، کاربر در
//  هیچ صفی نیست و هر عددی که نشان دهیم ساختگی است.
// ═══════════════════════════════════════════════════════════

/** حالتِ خطایِ صادقانه با دکمه‌ی تلاشِ مجدد — جایگزینِ همه‌ی مسیرهایِ جعلیِ قبلی. */
function wlError(msg, retryCall){
  const sheetBody=document.getElementById('sheetBody');
  if(!sheetBody) return;
  sheetBody.innerHTML=`
    <div style="text-align:center;padding:28px 16px">
      <div style="font-size:34px;line-height:1;margin-bottom:12px" aria-hidden="true">⚠️</div>
      <div class="sheet-title" style="text-align:center">${esc(msg)}</div>
      <div class="sheet-sub" style="text-align:center;margin-top:8px">هیچ چیزی ثبت نشد — وقتی اینترنت وصل شد دوباره تلاش کن.</div>
      ${retryCall?`<button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="${retryCall}">تلاش دوباره</button>`:''}
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
    </div>`;
}

export async function joinWaitlist(id){
  const r=findR(id);
  const sheetBody=document.getElementById('sheetBody');
  sheetBody.innerHTML=`<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto 16px"></div>در حال پیوستن به صف...</div>`;
  const party=parseInt(String(bk.party).replace(/[^\d۰-۹]/g,'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||2;
  // Idempotency-Key (رفعِ P1-5): پیوستن یک نوشتنِ حساس است — دابل‌تپ یا retryِ
  // شبکه نباید دو ورودیِ صف بسازد. همان کلیدی که booking.js استفاده می‌کند.
  const res=await API.post('/waitlist',{restaurant_id:id,party_size:party,notify_sms:true,notify_push:true},{ 'Idempotency-Key': genIdempotencyKey() });
  if(!(res.ok&&res.data?.id)){
    // آفلاین و خطایِ سرور یکسان رفتار می‌کنند: هیچ‌کدام «پیوستن» نیستند.
    wlError(res.offline?'اتصال به سرور برقرار نشد':(res.error?.message||'پیوستن به صف ناموفق بود'), `joinWaitlist('${esc(String(id))}')`);
    return;
  }
  WL={...res.data,rid:id,rname:r.n};
  showWaitlistStatus();
}
// داشبورد مشتری: وضعیت در صف
export function showWaitlistStatus(){
  if(!WL)return;
  const sheetBody=document.getElementById('sheetBody');
  const isOffered=WL.status==='offered';
  sheetBody.innerHTML=`
    <div class="wl-status">
      ${isOffered?`
        <div class="wl-offer-banner">
          <div class="wl-offer-mesh"></div>
          <span class="wl-offer-emoji">${icon('checkCircle',{size:32})}</span>
          <div class="sheet-title" style="text-align:center;color:#fff;position:relative">میزت آماده‌ست!</div>
          <div style="text-align:center;color:rgba(255,255,255,.92);font-size:14px;position:relative">میز ${faNum(WL.offered_table||'—')} · ${esc(WL.rname||'')}</div>
          <div class="wl-timer" id="wlTimer">۰۵:۰۰</div>
          <div style="text-align:center;color:rgba(255,255,255,.85);font-size:12px;position:relative">برای تأیید فرصت داری</div>
        </div>
        <button class="btn btn-lg btn-block" style="background:#fff;color:#16A34A;margin-top:16px;font-weight:800" onclick="buzz&&buzz();acceptWL()">${icon('check',{size:18})} قبول می‌کنم</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="declineWL()">رد کردن</button>
      `:`
        <div style="text-align:center;padding:8px 0">
          <div class="wl-position-ring">
            <div class="wl-ring-pulse"></div>
            <div class="wl-pos-num" id="wlPosNum">${faNum(WL.position||'—')}</div>
            <div class="wl-pos-label">نفر در صف</div>
          </div>
          <div class="sheet-title" style="text-align:center;margin-top:18px">در صفِ ${esc(WL.rname||'')}</div>
          <div class="wl-eta"><span>⏱️</span> حدود <b>${faNum(WL.estimated_wait_minutes||'؟')}</b> دقیقه تا نوبتت</div>
          ${WL.is_vip?`<div class="wl-vip-badge">${icon('star',{size:13,fill:true})} اولویت VIP</div>`:''}
          <div class="wl-hint">${icon('bell',{size:13})} به‌محضِ آزادشدنِ میز، با پیامک و نوتیفیکیشن خبرت می‌کنیم</div>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="buzz&&buzz();refreshWL()">${icon('refresh',{size:16})} به‌روزرسانی وضعیت</button>
        <button class="btn btn-danger-ghost btn-block" style="margin-top:8px" onclick="leaveWL()">خروج از صف</button>
      `}
    </div>`;
  if(isOffered){startWlTimer();}
  else{
    // شمارشِ متحرکِ موقعیت در صف (حسِ زنده‌بودن)
    const pn=document.getElementById('wlPosNum'),target=parseInt(WL.position)||0;
    if(pn&&target>0){let c=Math.min(target+3,target*2||3);const iv=setInterval(()=>{c--;pn.textContent=faNum(c);if(c<=target)clearInterval(iv);},80);}
  }
}
// ═══════════════════════════════════════════════════════════
//  شمارشِ معکوسِ آفر — از `offer_expires_at`ِ **سرور**، نه ۵ دقیقه‌ی ثابت
//
//  ⚠️ باگِ واقعی (پروتکل §۱۰): این تایمر همیشه از ۰۵:۰۰ شروع می‌کرد، از لحظه‌ای
//  که کلاینت رندر شد. ولی مهلت را **سرور** تعیین می‌کند
//  (`offerExpiresAt`, lib/waitlist.ts) و از لحظه‌ی *ارسالِ آفر* می‌گذرد.
//  یعنی اگر کاربر سه دقیقه بعد اپ را باز می‌کرد، ۰۵:۰۰ می‌دید در حالی که فقط
//  ۰۲:۰۰ مانده بود؛ خیالش راحت می‌شد، بعد `acceptWL` با
//  `Err.reservationExpired()` رد می‌شد و **میزش را از دست می‌داد** در حالی که
//  UI تا لحظه‌ی آخر گفته بود وقت داری. حالا مهلت از سرور می‌آید و اگر سرور
//  چیزی نگفت (سازگاری با گذشته) همان ۵ دقیقه fallback است.
function wlSecondsLeft(){
  const iso = WL && (WL.offer_expires_at || WL.offerExpiresAt);
  if(iso){
    const ms = new Date(iso).getTime() - Date.now();
    if(Number.isFinite(ms)) return Math.max(0, Math.round(ms/1000));
  }
  return 300;   // سرور مهلت نداد → پیش‌فرضِ قبلی
}
export function startWlTimer(){
  clearInterval(wlTimer);
  let sec=wlSecondsLeft();
  const el=document.getElementById('wlTimer');
  const paint=()=>{ if(el){const m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');el.textContent=faNum(`${m}:${s}`);} };
  paint();   // بلافاصله مقدارِ درست را نشان بده، نه ۰۵:۰۰ی که در HTML است
  if(sec<=0){ toast('⌛','مهلت آفر تمام شد'); WL.status='waiting'; showWaitlistStatus(); return; }
  wlTimer=setInterval(()=>{
    sec--;
    if(sec<=0){clearInterval(wlTimer);toast('⌛','مهلت آفر تمام شد');WL.status='waiting';showWaitlistStatus();return;}
    paint();
  },1000);
}
export async function refreshWL(){
  if(!WL)return;
  const res=await API.get(`/waitlist/${WL.id}`);
  if(res.ok&&res.data){WL={...WL,...res.data};showWaitlistStatus();toast('','به‌روز شد');}
  else if(res.offline){
    // ⚠️ رفعِ P0-3: اینجا قبلاً صف را «شبیه‌سازی» می‌کرد — جایگاه را یکی کم
    // می‌کرد و در نهایت «میزت آماده شد!» می‌گفت. یعنی یک آفرِ کاملاً ساختگی از
    // رستورانی که اصلاً خبر نداشت. حالا فقط می‌گوییم به‌روز نشد؛ جایگاهِ
    // نمایش‌داده‌شده همان آخرین مقدارِ **واقعیِ** سرور می‌ماند و دست نمی‌خورد.
    toast('','اتصال برقرار نشد — وضعیت به‌روز نشد');
  }
  else toast('',res.error?.message||'به‌روزرسانی ناموفق بود');
}
// توکنِ دسترسیِ مهمان (رفعِ IDOR، migration 041) — فقط برایِ ورودی‌هایِ بدونِ
// حساب صادر می‌شه (WL.guest_token خودش هنگامِ join از سرور می‌آد و در WL
// ذخیره می‌مونه)؛ مشتریِ واردشده نیازی نداره چون Authorization خودکار می‌ره.
function wlAuthQS(){ return WL?.guest_token ? `?token=${encodeURIComponent(WL.guest_token)}` : ''; }
export async function acceptWL(){
  clearInterval(wlTimer);
  // Idempotency-Key (رفعِ P1-5): این فراخوانی یک **رزروِ واقعی** می‌سازد؛
  // دابل‌تپ روی «قبول می‌کنم» نباید دو رزرو بسازد.
  const res=await API.post(`/waitlist/${WL.id}/accept${wlAuthQS()}`,{},{ 'Idempotency-Key': genIdempotencyKey() });
  if(res.ok&&res.data?.reservation_code){
    // ⚠️ رفعِ P0-3: شرط قبلاً فقط `res.ok&&res.data` بود و کد را با
    // `res.data.reservation_code || 'RZWL'+Math.random()` می‌ساخت — یعنی حتی در
    // مسیرِ **موفق**، اگر سرور کد نمی‌داد، کدِ جعلی به مشتری نشان داده می‌شد.
    // نبودِ reservation_code در پاسخِ ۲۰۰ یک نقضِ قراردادِ API است و باید مثلِ
    // خطا رفتار شود، نه اینکه با یک کدِ ساختگی پوشانده شود.
    // ⚠️ اصلاح‌شده: قبلاً رزروِ تازه در `TRIPS` (آرایه‌ی دادهٔ **seed**) درج
    // می‌شد. آن آرایه منبعِ رزروهای کاربر نیست — تبِ سفرها رزروها را از
    // `/me/reservations` می‌خواند. پس این درج یا اثری نداشت، یا بدتر: دادهٔ
    // نمونه را با یک رزروِ واقعی مخلوط می‌کرد. `go('trips')` خودش
    // renderTrips را صدا می‌زند که دادهٔ تازه را از سرور می‌گیرد.
    toast('','رزروت ثبت شد!');WL=null;closeSheet();go('trips');
  }else if(res.offline){
    // ⚠️ رفعِ P0-3 (بدترین موردِ کلِ فایل): اینجا قبلاً یک کدِ رزروِ ساختگی
    // می‌ساخت، در TRIPS با وضعیتِ «پیشِ‌رو» می‌گذاشت و «رزروت ثبت شد!» می‌گفت —
    // بدونِ هیچ افشایی. مشتری با این باور که میز دارد سرِ قرار می‌رفت، در حالی
    // که رستوران هیچ رزروی نداشت.
    wlError('اتصال به سرور برقرار نشد','acceptWL()');
  }else{
    toast('',res.error?.message||'ثبتِ رزرو ناموفق بود');
  }
}
export async function declineWL(){
  clearInterval(wlTimer);
  await API.post(`/waitlist/${WL.id}/decline${wlAuthQS()}`).catch(()=>{});
  toast('','آفر رد شد');WL=null;closeSheet();
}
export async function leaveWL(){
  await API.request(`/waitlist/${WL.id}${wlAuthQS()}`,{method:'DELETE'}).catch(()=>{});
  toast('','از صف خارج شدی');WL=null;closeSheet();
}

// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.joinWaitlist = joinWaitlist;
window.refreshWL = refreshWL;
window.acceptWL = acceptWL;
window.declineWL = declineWL;
window.leaveWL = leaveWL;
