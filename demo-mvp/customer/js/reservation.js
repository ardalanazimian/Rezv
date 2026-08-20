// ═══════════════════════════════════════════════════════════
//  رزرونو — صفحه‌ی جزئیات رستوران + جریانِ رزرو
//  بخشی از اپ کاستومر (Vanilla JS، بدون build). scope سراسری مشترک.
//  ترتیبِ لود در index.html مهم است (این فایل به توابع/state قبلی وابسته است).
// ═══════════════════════════════════════════════════════════
//  لیست انتظار (مدل OpenTable)
// ═══════════════════════════════════════════════════════════
import { API, isLoggedIn } from './api.js';
import { closeSheet, esc, faNum, toast } from './auth.js';
import { openRest } from './data/detail.js';
import { cardHTML, fmtFa, go } from './data/discover.js';
import { GRAD, TRIPS, bk, favs } from './data/seed.js';
import { addToCalendar, addToWallet, cancelTrip, repeatReservation, showCheckInQR } from './features/trips.js';
import { R } from './init.js';
import { armReveals, buzz } from './theme-pwa.js';
export let WL=null; // ورودی فعلی لیست انتظار کاربر { id, position, ... }
export let wlTimer=null;
// پیشنهاد پیوستن به صف وقتی ظرفیت پر است
export function offerWaitlist(id, r){
  const sheetBody=document.getElementById('sheetBody');
  sheetBody.innerHTML=`
    <div class="wl-join">
      <div class="wl-join-hero">
        <div class="wl-join-mesh"></div>
        <span class="wl-join-emoji">📋</span>
      </div>
      <div class="sheet-title" style="text-align:center">ظرفیت این ساعت پره</div>
      <div class="sheet-sub" style="text-align:center;margin-bottom:18px">${esc(r.n)} · ${bk.date} · ${bk.time}<br>به صف بپیوند — اگه میزی آزاد شه، <b>اول به تو</b> خبر می‌دیم</div>
      <div class="wl-benefits">
        <div class="wl-benefit"><span class="wl-bene-ic">🔔</span><div><b>اطلاع فوری</b><small>پیامک + نوتیفیکیشن لحظه‌ای</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">⏱️</span><div><b>تخمین زمان</b><small>می‌دونی چقدر باید صبر کنی</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">✓</span><div><b>کنترلِ کامل</b><small>آفر رو راحت قبول یا رد کن</small></div></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="buzz&&buzz();joinWaitlist(${id})">پیوستن به لیست انتظار</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بی‌خیال</button>
    </div>`;
}
export async function joinWaitlist(id){
  const r=R.find(x=>x.id===id);
  const sheetBody=document.getElementById('sheetBody');
  sheetBody.innerHTML=`<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto 16px"></div>در حال پیوستن به صف...</div>`;
  const party=parseInt(String(bk.party).replace(/[^\d۰-۹]/g,'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||2;
  const res=await API.post('/waitlist',{restaurant_id:id,party_size:party,notify_sms:true,notify_push:true});
  let entry;
  if(res.ok&&res.data?.id){ entry=res.data; }
  else if(res.offline){ entry={id:'wl_demo',position:Math.floor(Math.random()*3)+2,estimated_wait_minutes:25,is_vip:false,status:'waiting'}; }
  else { toast('⚠️',res.error?.message||'پیوستن ناموفق بود'); closeSheet(); return; }
  WL={...entry,rid:id,rname:r.n};
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
          <span class="wl-offer-emoji">🎉</span>
          <div class="sheet-title" style="text-align:center;color:#fff;position:relative">میزت آماده‌ست!</div>
          <div style="text-align:center;color:rgba(255,255,255,.92);font-size:14px;position:relative">میز ${faNum(WL.offered_table||'—')} · ${esc(WL.rname||'')}</div>
          <div class="wl-timer" id="wlTimer">۰۵:۰۰</div>
          <div style="text-align:center;color:rgba(255,255,255,.85);font-size:12px;position:relative">برای تأیید فرصت داری</div>
        </div>
        <button class="btn btn-lg btn-block" style="background:#fff;color:#16A34A;margin-top:16px;font-weight:800" onclick="buzz&&buzz();acceptWL()">✓ قبول می‌کنم</button>
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
          ${WL.is_vip?'<div class="wl-vip-badge">⭐ اولویت VIP</div>':''}
          <div class="wl-hint">🔔 به‌محضِ آزادشدنِ میز، با پیامک و نوتیفیکیشن خبرت می‌کنیم</div>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="buzz&&buzz();refreshWL()">🔄 به‌روزرسانی وضعیت</button>
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
export function startWlTimer(){
  clearInterval(wlTimer);
  let sec=300; // ۵ دقیقه
  const el=document.getElementById('wlTimer');
  wlTimer=setInterval(()=>{
    sec--;
    if(sec<=0){clearInterval(wlTimer);toast('⌛','مهلت آفر تمام شد');WL.status='waiting';showWaitlistStatus();return;}
    if(el){const m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');el.textContent=faNum(`${m}:${s}`);}
  },1000);
}
export async function refreshWL(){
  if(!WL)return;
  const res=await API.get(`/waitlist/${WL.id}`);
  if(res.ok&&res.data){WL={...WL,...res.data};showWaitlistStatus();toast('🔄','به‌روز شد');}
  else if(res.offline){ // دمو: شبیه‌سازی آفر
    if(WL.position>1){WL.position--;toast('🔄',`نفر ${faNum(WL.position)} شدی`);}
    else{WL.status='offered';WL.offered_table=7;toast('🎉','میزت آماده شد!');}
    showWaitlistStatus();
  }
}
export async function acceptWL(){
  clearInterval(wlTimer);
  const res=await API.post(`/waitlist/${WL.id}/accept`);
  if(res.ok&&res.data){
    const code=res.data.reservation_code||'RZWL'+Math.random().toString(36).slice(2,6).toUpperCase();
    TRIPS.unshift({rid:WL.rid,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
    toast('✅','رزروت ثبت شد!');WL=null;closeSheet();go('trips');
  }else if(res.offline){
    const code='RZWL'+Math.random().toString(36).slice(2,6).toUpperCase();
    TRIPS.unshift({rid:WL.rid,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
    toast('✅','رزروت ثبت شد!');WL=null;closeSheet();go('trips');
  }else{toast('⚠️',res.error?.message||'خطا');}
}
export async function declineWL(){
  clearInterval(wlTimer);
  await API.post(`/waitlist/${WL.id}/decline`).catch(()=>{});
  toast('','آفر رد شد');WL=null;closeSheet();
}
export async function leaveWL(){
  await API.request(`/waitlist/${WL.id}`,{method:'DELETE'}).catch(()=>{});
  toast('','از صف خارج شدی');WL=null;closeSheet();
}
export function renderFavs(){
  const list=R.filter(r=>favs.has(r.id));const grid=document.getElementById('favGrid'),empty=document.getElementById('favEmpty');
  document.getElementById('favSub').textContent=list.length?`${fmtFa(list.length)} رستوران ذخیره‌شده`:'';
  if(!list.length){grid.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';grid.innerHTML=list.map(cardHTML).join('');grid.querySelectorAll('.rc').forEach(c=>c.classList.add('in'));
}
// تبدیل وضعیت رزرو API به وضعیت فرانت‌اند
// enum واقعی بک‌اند: pending/confirmed/arrived/no_show/cancelled_by_user/cancelled_by_restaurant
export function mapTripStatus(apiStatus){
  if(apiStatus==='arrived')return'done';
  if(apiStatus==='no_show'||apiStatus==='cancelled_by_user'||apiStatus==='cancelled_by_restaurant')return'cancelled';
  return'up'; // pending/confirmed → پیش‌رو
}
// نگاشت رزرو API به ساختار trip فرانت‌اند
export function mapApiTrip(apiR){
  // پیدا کردن رستوران متناظر در R (با اسم) برای اموجی/گرادیان
  const rest=R.find(x=>x.n===apiR.restaurant?.name);
  // تبدیل تاریخ ISO به نمایش فارسی ساده
  let dateStr='',timeStr='';
  if(apiR.slotStart){
    const d=new Date(apiR.slotStart);
    timeStr=faNum(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));
    dateStr=faNum(d.toLocaleDateString('fa-IR'));
  }
  return {
    rid:rest?.id||null,
    _name:apiR.restaurant?.name||'رستوران',
    _emoji:rest?.e||'🍽️',
    _grad:rest?rest.id:null,
    date:dateStr||'—',
    time:timeStr||'—',
    party:faNum((apiR.partySize||2))+' نفر',
    code:apiR.code||'—',
    status:mapTripStatus(apiR.status),
  };
}

export async function renderTrips(){
  const listEl=document.getElementById('tripsList');
  let trips=TRIPS; // پیش‌فرض: داده‌ی محلی

  // اگر کاربر وارد شده، از API بخوان
  if(isLoggedIn()){
    listEl.innerHTML=`<div style="text-align:center;padding:40px;color:var(--t2)">در حال بارگذاری رزروها...</div>`;
    const res=await API.get('/me/reservations');
    if(res.ok && Array.isArray(res.data)){
      // داده‌ی واقعی از سرور
      trips=res.data.map(mapApiTrip);
    }
    // اگر آفلاین یا خطا → همان TRIPS محلی (fallback)
  }

  if(!trips.length){
    listEl.innerHTML=`<div class="trips-empty"><div class="trips-empty-emoji">🗓️</div><div class="trips-empty-title">هنوز رزروی نداری</div><div class="trips-empty-sub">اولین تجربه‌ت رو رزرو کن</div><button class="btn btn-primary" style="margin-top:16px" onclick="go('discover')">کشف رستوران‌ها</button></div>`;
    return;
  }
  // شمارشِ خلاصه (حسِ دستاورد نسل‌Z)
  const done=trips.filter(t=>t.status==='done').length;
  const up=trips.filter(t=>t.status==='up').length;
  const summary=`<div class="trips-summary reveal"><div class="ts-stat"><div class="ts-v">${fmtFa(trips.length)}</div><div class="ts-l">کل رزرو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(up)}</div><div class="ts-l">پیش‌رو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(done)}</div><div class="ts-l">تجربه‌شده</div></div></div>`;

  listEl.innerHTML=summary+trips.map(t=>{
    const r=t.rid?R.find(x=>x.id===t.rid):null;
    const emoji=t._emoji||r?.e||'🍽️';
    const name=t._name||r?.n||'رستوران';
    const gradId=t._grad||t.rid||1;
    const statusLabel=t.status==='up'?'🟢 پیش‌رو':t.status==='cancelled'?'✕ لغوشده':'✓ تجربه‌شده';
    const acts=t.status==='up'
      ? `<button class="btn btn-sm btn-primary" onclick="buzz&&buzz();showCheckInQR('${esc(t.code)}','${esc(name)}')">QR ورود</button><button class="btn btn-sm btn-ghost" onclick="addToCalendar('${esc(t.code)}','${esc(name)}','${esc(t.date)}','${esc(t.time)}')">تقویم</button><button class="btn btn-sm btn-ghost" onclick="addToWallet('${esc(t.code)}','${esc(name)}','${esc(t.date)}','${esc(t.time)}','apple')">کیف پول</button><button class="btn btn-sm btn-ghost" onclick="cancelTrip('${esc(t.code)}',this)">لغو</button>`
      : t.status==='cancelled' ? ''
      : `${t.rid?`<button class="btn btn-sm btn-primary" onclick="buzz&&buzz();repeatReservation(${t.rid})">رزرو مجدد</button><button class="btn btn-sm btn-ghost" onclick="openRest(${t.rid})">ثبت نظر</button>`:''}`;
    return `<div class="trip-card reveal ${t.status}">
      <div class="trip-card-hero" style="background:${GRAD[gradId]||GRAD[1]}">
        <div class="trip-card-mesh"></div>
        <span class="trip-card-emoji">${emoji}</span>
        <span class="trip-card-status ${t.status}">${statusLabel}</span>
      </div>
      <div class="trip-card-body">
        <div class="trip-card-name">${esc(name)}</div>
        <div class="trip-card-meta"><span>📅 ${t.date}</span><span class="tcm-dot">·</span><span>🕐 ${t.time}</span><span class="tcm-dot">·</span><span>👥 ${t.party}</span></div>
        <div class="trip-card-code">کد رزرو: <b>${esc(t.code)}</b></div>
        ${acts?`<div class="trip-card-actions">${acts}</div>`:''}
      </div>
    </div>`;
  }).join('');
  armReveals&&armReveals();
}


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.joinWaitlist = joinWaitlist;
window.refreshWL = refreshWL;
window.acceptWL = acceptWL;
window.declineWL = declineWL;
window.leaveWL = leaveWL;
