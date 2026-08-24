// ═══════════════════════════════════════════════════════════
//  رزرونو — رندرِ سفرها/رزروها (trips) و علاقه‌مندی‌ها (favs)
//  بخشی از اپ کاستومر (Vanilla JS، بدون build)؛ جزئی از گرافِ ماژولِ main.js.
//  توجه: منطقِ «لیستِ انتظار» به waitlist.js منتقل شد (جداسازیِ مسئولیت).
//  رفتار دقیقاً همان قبل است.
// ═══════════════════════════════════════════════════════════
import { API, isLoggedIn } from './api.js';
import { isOfflineDemo } from './api-core.js';
import { esc, faNum } from './auth.js';
import { openRest } from './data/detail.js';
import { cardHTML, fmtFa, go } from './data/discover.js';
import { GRAD, TRIPS, favs, setMyTrips } from './data/seed.js';
import { addToCalendar, addToWallet, cancelTrip, openReviewSheet, repeatReservation, showCheckInQR } from './features/trips.js';
import { R } from './init.js';
import { armReveals, buzz } from './theme-pwa.js';
import { icon } from './icons.js';

export function renderFavs(){
  const list=R.filter(r=>favs.has(String(r.id)));const grid=document.getElementById('favGrid'),empty=document.getElementById('favEmpty');
  document.getElementById('favSub').textContent=list.length?`${fmtFa(list.length)} رستوران ذخیره‌شده`:'';
  if(!list.length){grid.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';grid.innerHTML=list.map(cardHTML).join('');grid.querySelectorAll('.rc').forEach(c=>c.classList.add('in'));
}
// ⚠️ رفع‌شده (R3 — حسابرسیِ صداقتِ سفرها، ۲۰۲۶-۰۸-۱۴): enumِ واقعیِ بک‌اند
// (api/src/lib/lifecycle.ts) بسیار بزرگ‌تر از چهار وضعیتی است که این تابع
// می‌شناخت — از جمله دقیقاً همان چیزی که اکثرِ رزروهای واقعی به آن می‌رسند:
// 'completed' و 'cancelled' (ساده، بدونِ پسوندِ by_user/by_restaurant —
// آن دو پسونددار طبقِ خودِ lifecycle.ts «قدیمی»اند). چون این تابع آن‌ها را
// نمی‌شناخت، همه‌شان به‌طورِ پیش‌فرض 'up' (پیش‌رو) می‌گرفتند — یعنی یک رزروِ
// کاملاً تمام‌شده یا واقعاً لغوشده تا ابد در تبِ «پیش‌رو»یِ کاربر می‌ماند.
// حالا نگاشت صریح است؛ فقط وضعیتِ واقعاً ناشناخته (که یعنی enum بعداً عوض
// شده) به‌صورتِ امن 'up' می‌ماند، نه چون فراموش شده، چون مستند است.
const TRIP_STATUS_MAP = {
  // پیش‌رو یا هم‌اکنون در جریان — هنوز به نتیجه‌ی نهایی نرسیده
  pending:'up', waitlisted:'up', confirmed:'up', auto_confirmed:'up',
  preparing:'up', checked_in:'up', running_late:'up', seated:'up', dining:'up',
  // تجربه‌شده — arrived (قدیمی) از قبل همین‌جا بود، دست‌نخورده ماند
  completed:'done', arrived:'done',
  // لغوشده/بی‌نتیجه — 'cancelled' وضعیتِ فعلیِ واقعیِ لغو است (نه _by_user/_by_restaurant)
  cancelled:'cancelled', auto_cancelled:'cancelled', rejected:'cancelled', expired:'cancelled',
  no_show:'cancelled', noshow:'cancelled',
  cancelled_by_user:'cancelled', cancelled_by_restaurant:'cancelled', // قدیمی
};
export function mapTripStatus(apiStatus){
  return TRIP_STATUS_MAP[apiStatus] || 'up'; // وضعیتِ ناشناخته → پیش‌فرضِ امن، نه حدسِ لغو/تمام‌شده
}
// نگاشت رزرو API به ساختار trip فرانت‌اند
export function mapApiTrip(apiR){
  // ⚠️ رفع‌شده (R3): قبلاً رستورانِ متناظر فقط با تطبیقِ *اسم* پیدا می‌شد —
  // اگر دو رستوران اسمِ یکسان داشتند (یا حتی یک فاصله‌ی اضافه)، به رستورانِ
  // اشتباه وصل می‌شد (ایموجی/گرادیانِ غلط، و بدتر: repeatReservation روی
  // رستورانِ اشتباه). GET /me/reservations در include خودش restaurantId
  // (کلیدِ اصلی) را همیشه برمی‌گرداند (Prisma بدونِ select صریح همه‌ی
  // اسکالرها را می‌دهد) — همان را اول امتحان می‌کنیم؛ فقط اگر R هنوز از
  // نمونه پر بود (id عددی، UUID مچ نمی‌شود) به slug برمی‌گردیم.
  const rest=R.find(x=>String(x.id)===String(apiR.restaurantId)) || (apiR.restaurant?.slug ? R.find(x=>x.slug===apiR.restaurant.slug) : null);
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
    // ⚠️ اضافه‌شده (R2): زمانِ خامِ ISO برایِ تقویم — parseTripDateTime قبلاً
    // همیشه «فردا» حدس می‌زد چون هیچ‌جا زمانِ واقعی ذخیره نمی‌شد. رجوع کن به
    // features/trips.js برایِ استفاده.
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

// تایم‌لاینِ روندِ رزرو (C5) — از وضعیتِ موجود مشتق می‌شود (بدونِ رویدادِ جعلی)
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

  // اگر کاربر وارد شده، از API بخوان
  if(isLoggedIn()){
    // اسکلتونِ بارگذاری (به‌جای متنِ خالی) — کاهشِ پرش/CLS، بازاستفاده از .sk (C2)
    listEl.setAttribute('aria-busy','true');
    const skTrip=`<div class="sk-trip" aria-hidden="true"><div class="sk sk-hero"></div><div class="sk-body"><div class="sk sk-line w80"></div><div class="sk sk-line w55"></div><div class="sk sk-line w40"></div></div></div>`;
    listEl.innerHTML=skTrip.repeat(3);
    const res=await API.get('/me/reservations');
    listEl.removeAttribute('aria-busy');
    if(res.ok && Array.isArray(res.data)){
      // داده‌ی واقعی از سرور
      trips=res.data.map(mapApiTrip);
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
  // شمارشِ خلاصه (حسِ دستاورد نسل‌Z)
  const done=trips.filter(t=>t.status==='done').length;
  const up=trips.filter(t=>t.status==='up').length;
  const summary=`<div class="trips-summary reveal"><div class="ts-stat"><div class="ts-v">${fmtFa(trips.length)}</div><div class="ts-l">کل رزرو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(up)}</div><div class="ts-l">پیش‌رو</div></div><div class="ts-div"></div><div class="ts-stat"><div class="ts-v">${fmtFa(done)}</div><div class="ts-l">تجربه‌شده</div></div></div>`;

  listEl.innerHTML=summary+trips.map(t=>{
    const r=t.rid?R.find(x=>String(x.id)===String(t.rid)):null;
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
      ? `<button class="btn btn-sm btn-primary" onclick="buzz&&buzz();showCheckInQR('${esc(t.code)}','${esc(name)}')">QR ورود</button><button class="btn btn-sm btn-ghost" onclick="addToCalendar('${esc(t.code)}','${esc(name)}','${esc(t.date)}','${esc(t.time)}','${esc(t.slotStartIso||'')}')">تقویم</button><button class="btn btn-sm btn-ghost" onclick="addToWallet('${esc(t.code)}','${esc(name)}','${esc(t.date)}','${esc(t.time)}','apple')">کیف پول</button><button class="btn btn-sm btn-ghost" data-swipe-action onclick="cancelTrip('${esc(t.code)}',this)">لغو</button>`
      : t.status==='cancelled' ? ''
      : `${t.rid?`<button class="btn btn-sm btn-primary" data-swipe-action onclick="buzz&&buzz();repeatReservation('${esc(String(t.rid))}')">رزرو مجدد</button>${(t.serverRestaurantId&&t.serverReservationId)?`<button class="btn btn-sm btn-ghost" onclick="buzz&&buzz();openReviewSheet('${esc(t.serverRestaurantId)}','${esc(t.serverReservationId)}','${esc(name)}')">ثبت نظر</button>`:''}`:''}`;
    return `<div class="trip-card reveal ${t.status}${swipe?' has-swipe':''}">
      ${swipe?`<div class="trip-swipe-pad ${swipe.cls}" aria-hidden="true">${icon(swipe.ic,{size:18})}<span>${swipe.label}</span></div>`:''}
      <div class="trip-card-inner">
        <div class="trip-card-hero" style="background:${GRAD[gradId]||GRAD[1]}">
          <div class="trip-card-mesh"></div>
          <span class="trip-card-emoji">${emoji}</span>
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
