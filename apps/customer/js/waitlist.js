// ═══════════════════════════════════════════════════════════
//  رزرونو — لیستِ انتظار (مدل OpenTable)
//  جدا شده از reservation.js (ریفکتور فاز۱: جداسازیِ مسئولیت‌ها).
//  رفتار دقیقاً همان قبل است؛ فقط از یک فایلِ مجزا export می‌شود.
//  همان مدلِ ماژول (بخشی از گرافِ ماژولِ main.js) + bindingهای window
//  برای onclickهای درونِ رشته‌های HTML.
// ═══════════════════════════════════════════════════════════
import { API } from './api.js';
import { closeSheet, esc, faNum, toast } from './auth.js';
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
      <div class="sheet-sub" style="text-align:center;margin-bottom:18px">${esc(r.n)} · ${bk.date} · ${bk.time}<br>به صف بپیوند — اگه میزی آزاد شه، <b>اول به تو</b> خبر می‌دیم</div>
      <div class="wl-benefits">
        <div class="wl-benefit"><span class="wl-bene-ic">${icon('bell',{size:18})}</span><div><b>اطلاع فوری</b><small>پیامک + نوتیفیکیشن لحظه‌ای</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">⏱️</span><div><b>تخمین زمان</b><small>می‌دونی چقدر باید صبر کنی</small></div></div>
        <div class="wl-benefit"><span class="wl-bene-ic">${icon('check',{size:18})}</span><div><b>کنترلِ کامل</b><small>آفر رو راحت قبول یا رد کن</small></div></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="buzz&&buzz();joinWaitlist('${id}')">پیوستن به لیست انتظار</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بی‌خیال</button>
    </div>`;
}
export async function joinWaitlist(id){
  const r=findR(id);
  const sheetBody=document.getElementById('sheetBody');
  sheetBody.innerHTML=`<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto 16px"></div>در حال پیوستن به صف...</div>`;
  const party=parseInt(String(bk.party).replace(/[^\d۰-۹]/g,'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||2;
  const res=await API.post('/waitlist',{restaurant_id:id,party_size:party,notify_sms:true,notify_push:true});
  let entry;
  if(res.ok&&res.data?.id){ entry=res.data; }
  else if(res.offline){ entry={id:'wl_demo',position:Math.floor(Math.random()*3)+2,estimated_wait_minutes:25,is_vip:false,status:'waiting'}; }
  else { toast('',res.error?.message||'پیوستن ناموفق بود'); closeSheet(); return; }
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
  if(res.ok&&res.data){WL={...WL,...res.data};showWaitlistStatus();toast('','به‌روز شد');}
  else if(res.offline){ // دمو: شبیه‌سازی آفر
    if(WL.position>1){WL.position--;toast('',`نفر ${faNum(WL.position)} شدی`);}
    else{WL.status='offered';WL.offered_table=7;toast('','میزت آماده شد!');}
    showWaitlistStatus();
  }
}
// توکنِ دسترسیِ مهمان (رفعِ IDOR، migration 041) — فقط برایِ ورودی‌هایِ بدونِ
// حساب صادر می‌شه (WL.guest_token خودش هنگامِ join از سرور می‌آد و در WL
// ذخیره می‌مونه)؛ مشتریِ واردشده نیازی نداره چون Authorization خودکار می‌ره.
function wlAuthQS(){ return WL?.guest_token ? `?token=${encodeURIComponent(WL.guest_token)}` : ''; }
export async function acceptWL(){
  clearInterval(wlTimer);
  const res=await API.post(`/waitlist/${WL.id}/accept${wlAuthQS()}`);
  if(res.ok&&res.data){
    const code=res.data.reservation_code||'RZWL'+Math.random().toString(36).slice(2,6).toUpperCase();
    TRIPS.unshift({rid:WL.rid,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
    toast('','رزروت ثبت شد!');WL=null;closeSheet();go('trips');
  }else if(res.offline){
    const code='RZWL'+Math.random().toString(36).slice(2,6).toUpperCase();
    TRIPS.unshift({rid:WL.rid,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
    toast('','رزروت ثبت شد!');WL=null;closeSheet();go('trips');
  }else{toast('',res.error?.message||'خطا');}
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
