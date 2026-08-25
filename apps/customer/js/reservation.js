// ═══════════════════════════════════════════════════════════
//  رزرونو — رندرِ سفرها/رزروها (trips) و علاقه‌مندی‌ها (favs)
//  بخشی از اپ کاستومر (Vanilla JS، بدون build)؛ جزئی از گرافِ ماژولِ main.js.
//  توجه: منطقِ «لیستِ انتظار» به waitlist.js منتقل شد (جداسازیِ مسئولیت).
//  رفتار دقیقاً همان قبل است.
// ═══════════════════════════════════════════════════════════
import { API, isLoggedIn } from './api.js';
import { isOfflineDemo } from './api-core.js';
import { esc, faNum, jsq } from './auth.js';
import { openRest } from './data/detail.js';
import { cardHTML, fmtFa, go } from './data/discover.js';
import { TRIPS, favHas, gradFor, setMyTrips } from './data/seed.js';
import { addToCalendar, addToWallet, cancelTrip, openReviewSheet, repeatReservation, showCheckInQR } from './features/trips.js';
import { R, findR } from './init.js';
import { armReveals, buzz } from './theme-pwa.js';
import { icon } from './icons.js';

export function renderFavs(){
  const list=R.filter(r=>favHas(r.id));const grid=document.getElementById('favGrid'),empty=document.getElementById('favEmpty');
  document.getElementById('favSub').textContent=list.length?`${fmtFa(list.length)} رستوران ذخیره‌شده`:'';
  if(!list.length){grid.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';grid.innerHTML=list.map(cardHTML).join('');grid.querySelectorAll('.rc').forEach(c=>c.classList.add('in'));
}
const TRIP_STATUS_MAP = {
  pending:'up', waitlisted:'up', confirmed:'up', auto_confirmed:'up',
  preparing:'up', checked_in:'up', running_late:'up', seated:'up', dining:'up',
  completed:'done', arrived:'done',
  cancelled:'cancelled', auto_cancelled:'cancelled', rejected:'cancelled', expired:'cancelled',
  no_show:'cancelled', noshow:'cancelled',
  cancelled_by_user:'cancelled', cancelled_by_restaurant:'cancelled',
};
export function mapTripStatus(apiStatus){
  return TRIP_STATUS_MAP[apiStatus] || 'up';
}
export function mapApiTrip(apiR){
  // ⚠️ رفع‌شده (R3): قبلاً رستورانِ متناظر فقط با تطبیقِ *اسم* پیدا می‌شد —
  // اگر دو رستوران اسمِ یکسان داشتند (یا حتی یک فاصله‌ی اضافه)، به رستورانِ
  // اشتباه وصل می‌شد (ایموجی/گرادیانِ غلط، و بدتر: repeatReservation روی
  // رستورانِ اشتباه). GET /me/reservations در include خودش restaurantId
  // (کلیدِ اصلی) را همیشه برمی‌گرداند (Prisma بدونِ select صریح همه‌ی
  // اسکالرها را می‌دهد) — همان را اول امتحان می‌کنیم؛ فقط اگر R هنوز از
  // نمونه پر بود (id عددی، UUID مچ نمی‌شود) به slug برمی‌گردیم.
  const rest=findR(apiR.restaurantId) || (apiR.restaurant?.slug ? R.find(x=>x.slug===apiR.restaurant.slug) : null);
  // تبدیل تاریخ ISO به نمایش فارسی ساده
  let dateStr='',timeStr='';
  if(apiR.slotStart){
    const d=new Date(apiR.slotStart);
    timeStr=faNum(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));
    dateStr=faNum(d.toLocaleDateString('fa-IR'));
  }
  return {
    rid:rest?.id||null,
    restaurantId: apiR.restaurantId || rest?.id || null,
    reservationId: apiR.id || null,
    _name:apiR.restaurant?.name||'رستوران',
    _emoji:rest?.e||'🍽️',
    _grad:rest?rest.id:null,
    date:dateStr||'—',
    time:timeStr||'—',
    slotStartIso: apiR.slotStart || null,
    party:faNum((apiR.partySize||2))+' نفر',
    code:apiR.code||'—',
    status:mapTripStatus(apiR.status),
    // ── شناسه‌هایِ واقعیِ سرور (رفعِ P1-4) ──
    // `rid` بالا شناسه‌ی محلیِ R است و ممکن است از دادهٔ نمونه بیاید؛ برایِ
    // ثبتِ نظر باید UUIDِ واقعیِ سرور برود، نه شناسه‌ی محلی. این دو فیلد
    // تنها منبعِ مجازِ آن‌اند و اگر سرور ندهد null می‌مانند (دکمه غیرفعال).
    serverRestaurantId: apiR.restaurantId || null,
    serverReservationId: apiR.id || null,
    // ⚠️ رزروی که منتظرِ تأییدِ رستوران است (رستوران `auto_confirm` را خاموش
    // کرده). قبلاً `pending` هم مثلِ `confirmed` فقط «پیش‌رو» نشان داده می‌شد،
    // یعنی مشتری فکر می‌کرد میزش قطعی است در حالی که رستوران هنوز تأیید نکرده.
    awaitingApproval: apiR.status === 'pending',
  };
}

function tripTimeline(status){
  const steps = status==='cancelled'
    ? [['ثبت','done'],['لغو','cancel']]
    : [['ثبت','done'],['تأیید',status==='up'?'active':'done'],['حضور',status==='done'?'done':'future'],['تکمیل',status==='done'?'active':'future']];
  return `<ol class="tl" aria-label="روند رزرو">${steps.map(([l,st])=>`<li class="tl-step ${st}"><span class="tl-dot" aria-hidden="true"></span><span class="tl-lbl">${l}</span></li>`).join('')}</ol>`;
}
export async function renderTrips(){
  const listEl=document.getElementById('tripsList');
  // ⚠️ رفعِ جعلِ رزرو (پروتکل §۱۰) — همان کلاسِ IS-1 در مرکزِ اعلان، ولی
  // به‌مراتب آشکارتر: پیش‌فرض `TRIPS` (دادهٔ seed) بود، پس یک بازدیدکننده‌ی
  // **واردنشده** روی سایتِ واقعی سه رزروِ ساختگی می‌دید (RZ8K2M پیش‌رو،
  // RZ4A1C و RZ9X3F تجربه‌شده) با خلاصه‌ی «۳ کل رزرو · ۱ پیش‌رو» و دکمه‌هایِ
  // فعالِ «QR ورود»، «تقویم»، «کیف پول» و «لغو» — یعنی می‌شد رزروی را که
  // هرگز وجود نداشت «لغو» کرد. همین برایِ کاربرِ واردشده‌ای که fetchش شکست
  // می‌خورد هم رخ می‌داد.
  // حالا: نمی‌دانیم ⇒ حالتِ خالیِ صادق («هنوز رزروی نداری») که از قبل ساخته
  // شده بود. تنها استثنا بسته‌ی آفلاینِ تک‌فایلی که خودش دموست.
  let trips = isOfflineDemo() ? TRIPS : [];
  // بنرِ «این‌ها نمونه‌اند» (#67): فقط وقتی واقعاً داده‌ی نمونه نشان می‌دهیم.
  let isDemo = isOfflineDemo();

  if(isLoggedIn()){
    listEl.setAttribute('aria-busy','true');
    const skTrip=`<div class="sk-trip" aria-hidden="true"><div class="sk sk-hero"></div><div class="sk-body"><div class="sk sk-line w80"></div><div class="sk sk-line w55"></div><div class="sk sk-line w40"></div></div></div>`;
    listEl.innerHTML=skTrip.repeat(3);
    const res=await API.get('/me/reservations');
    listEl.removeAttribute('aria-busy');
    if(res.ok && Array.isArray(res.data)){
      trips=res.data.map(mapApiTrip);
      window.__lastTrips=trips;
      isDemo=false;
    }
    // اگر آفلاین یا خطا → trips دست‌نخورده می‌ماند (خالی روی استقرارِ
    // واقعی، دادهٔ دمو فقط در بسته‌ی تک‌فایلی) — بدونِ جعلِ رزرو.
    if(res.ok && Array.isArray(res.data)) setMyTrips(trips);
  } else if(isOfflineDemo()){
    setMyTrips(trips);   // بسته‌ی دمو: همان چیزی که نشان داده می‌شود
  }

  if(!trips.length){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${icon('calendar',{size:44})}</div><div class="empty-state-title">هنوز رزروی نداری</div><div class="empty-state-desc">اولین تجربه‌ت رو رزرو کن</div><button class="btn btn-primary" style="margin-top:16px" onclick="go('discover')">کشف رستوران‌ها</button></div>`;
    return;
  }
  const done=trips.filter(t=>t.status==='done').length;
  const up=trips.filter(t=>t.status==='up').length;
  const demoNote=isDemo?`<div style="background:var(--warning-soft);color:var(--warning-ink);border-radius:var(--radius-lg);padding:var(--sp-3);font-size:12.5px;line-height:1.7;text-align:center;margin-bottom:10px">⚠️ این‌ها رزروِ نمونه‌اند — رزروِ واقعیِ تو نیستند (اتصال به سرور برقرار نیست).</div>`:'';
  const summary=`${demoNote}<div class="trips-summary reveal"><div class="ts-stat"><div class="ts-v">${fmtFa(trips.length)}</div><div class="ts-l">کل رزرو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(up)}</div><div class="ts-l">پیش‌رو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(done)}</div><div class="ts-l">تجربه‌شده</div></div></div>`;

  listEl.innerHTML=summary+trips.map(t=>{
    const r=t.rid?findR(t.rid):null;
    const emoji=t._emoji||r?.e||'🍽️';
    const name=t._name||r?.n||'رستوران';
    const gradId=t._grad||t.rid||1;
    const statusLabel=t.awaitingApproval?`${icon('clock',{size:12})} در انتظارِ تأییدِ رستوران`
      :t.status==='up'?`<span class="live-dot" aria-hidden="true"></span> پیش‌رو`
      :t.status==='cancelled'?`${icon('close',{size:12})} لغوشده`
      :`${icon('check',{size:12})} تجربه‌شده`;
    // اکشنِ swipe (C16): کارتِ «پیش‌رو» → لغو، کارتِ «تجربه‌شده» با rid → رزرو مجدد.
    // دکمه‌ی متناظر با data-swipe-action علامت می‌خورد تا ژستِ swipe همان هندلرِ سیم‌کشی‌شده را کلیک کند.
    const swipe=t.status==='up'?{cls:'cancel',ic:'close',label:'لغو رزرو'}
      :(t.status!=='cancelled'&&t.rid)?{cls:'repeat',ic:'calendar',label:'رزرو مجدد'}:null;
    const acts=t.status==='up'
      ? `<button class="btn btn-sm btn-primary" onclick="buzz&&buzz();showCheckInQR(${jsq(t.code)},${jsq(name)})">QR ورود</button><button class="btn btn-sm btn-ghost" onclick="addToCalendar(${jsq(t.code)},${jsq(name)},${jsq(t.date)},${jsq(t.time)},${jsq(t.slotStartIso||'')})">تقویم</button><button class="btn btn-sm btn-ghost" onclick="addToWallet(${jsq(t.code)},${jsq(name)},${jsq(t.date)},${jsq(t.time)},'apple')">کیف پول</button><button class="btn btn-sm btn-ghost" data-swipe-action onclick="cancelTrip(${jsq(t.code)},this)">لغو</button>`
      : t.status==='cancelled' ? ''
      : `${t.rid?`<button class="btn btn-sm btn-primary" data-swipe-action onclick="buzz&&buzz();repeatReservation(${jsq(String(t.rid))})">رزرو مجدد</button>${(t.serverRestaurantId&&t.serverReservationId)?`<button class="btn btn-sm btn-ghost" onclick="buzz&&buzz();openReviewSheet(${jsq(t.serverRestaurantId)},${jsq(t.serverReservationId)},${jsq(name)})">ثبت نظر</button>`:''}`:''}`;
    return `<div class="trip-card reveal ${t.status}${swipe?' has-swipe':''}">
      ${swipe?`<div class="trip-swipe-pad ${swipe.cls}" aria-hidden="true">${icon(swipe.ic,{size:18})}<span>${swipe.label}</span></div>`:''}
      <div class="trip-card-inner">
        <div class="trip-card-hero" style="background:${gradFor(gradId)}">
          <div class="trip-card-mesh"></div>
          <span class="trip-card-emoji">${esc(emoji)}</span>
          <span class="trip-card-status ${t.status}">${statusLabel}</span>
        </div>
        <div class="trip-card-body">
          <div class="trip-card-name">${esc(name)}</div>
          <div class="trip-card-meta"><span>${icon('calendar',{size:13})} ${t.date}</span><span class="tcm-dot">·</span><span>${icon('clock',{size:13})} ${t.time}</span><span class="tcm-dot">·</span><span>${icon('users',{size:13})} ${t.party}</span></div>
          <div class="trip-card-code">کد رزرو: <b>${esc(t.code)}</b></div>
          ${tripTimeline(t.status)}
          ${acts?`<div class="trip-card-actions">${acts}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
  armReveals&&armReveals();
}

/** POST /me/reviews for completed trips (honest; requires UUID restaurantId). */
export async function openReviewSheetFromTrip(code){
  const trip = window.__lastTrips?.find(x=>x.code===code);
  const restaurantId = trip?.restaurantId || trip?.rid;
  if(!restaurantId || typeof restaurantId!=='string' || restaurantId.length<30){
    if(trip?.rid!=null){ openRest(trip.rid); return; }
    window.toast&&window.toast('','برای ثبت نظر باید با حساب واقعی و رزرو تکمیل‌شده وارد شده باشی');
    return;
  }
  if(!isLoggedIn()){ window.toast&&window.toast('','اول وارد شو'); return; }
  const ratingStr = prompt('امتیاز از ۱ تا ۵؟');
  if(ratingStr==null) return;
  const rating = parseInt(ratingStr, 10);
  if(!(rating>=1 && rating<=5)){ window.toast&&window.toast('','امتیاز باید بین ۱ و ۵ باشد'); return; }
  const body = prompt('نظر کوتاه (اختیاری):') || undefined;
  const res = await API.post('/me/reviews', {
    restaurant_id: restaurantId,
    reservation_id: trip.reservationId || undefined,
    rating,
    body: body || undefined,
  });
  if(res.ok) window.toast&&window.toast('','نظرت ثبت شد');
  else window.toast&&window.toast('', res.error?.message || res.error || 'ثبت نظر ممکن نشد');
}
if(typeof window!=='undefined'){ window.openReviewSheetFromTrip = openReviewSheetFromTrip; }
