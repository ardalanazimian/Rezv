// ═══ رزرونو — پنل business: رزروها + پلان طبقه (Vanilla JS، بدون build، scope مشترک) ═══
let resDate='today', resQuery='';
// ⚠️ اضافه‌شده (Part 2 — Tonight Board، ۲۰۲۶-۰۸-۱۴): فیلترِ عملیاتیِ «امشب»،
// جدا از resDate (که فقط بازه‌ی روز را انتخاب می‌کند). فقط وقتی resDate==='today'
// نمایش داده می‌شود — دقیقاً همان طراحیِ ماموریت («تخته‌ی امشب» = تبِ امروز،
// نه یک صفحه‌ی جدا).
let tonightFilter='all'; // all | soon30 | notArrived | arrived
const TONIGHT_FILTERS=[
  {v:'all',l:'همه'},
  {v:'soon30',l:'بعدی ۳۰ دقیقه'},
  {v:'notArrived',l:'نرسیده'},
  {v:'arrived',l:'رسیده'},
];
const TONIGHT_NOT_ARRIVED=['pending','confirmed','auto_confirmed','preparing','running_late'];
const TONIGHT_ARRIVED=['checked_in','arrived','seated','dining'];
function tonightFilterSet(f){tonightFilter=f;renderResList();}
/** «HH:MM» فارسی/انگلیسی → دقیقه از نیمه‌شب، برای مرتب‌سازیِ زمانی. نامعتبر → Infinity (آخرِ لیست). */
function timeToMinutes(t){
  const s=String(t||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const m=s.match(/^(\d{1,2}):(\d{2})/);
  if(!m)return Infinity;
  return (+m[1])*60+(+m[2]);
}
function rReservations(){
  document.getElementById('v-reservations').innerHTML=`
    <div class="pg-head"><div class="pg-title">رزروها</div><div class="pg-sub">مدیریت و جستجوی همه‌ی رزروهای امروز و آینده</div></div>
    <!-- جستجو -->
    <div class="search-res">
      <div class="search-box">
        <span class="s-ic">${icon('search',{size:16})}</span>
        <input id="resSearch" placeholder="جستجو با نام، فامیل یا شماره تلفن..." value="${esc(resQuery)}" oninput="searchRes(this.value)">
        <button class="s-clear ${resQuery?'show':''}" onclick="clearResSearch()">×</button>
      </div>
      <button class="btn btn-primary" onclick="openManual()">${icon('plus',{size:16})} رزرو جدید</button>
    </div>
    <!-- تاریخ -->
    <div class="date-tabs">
      <button class="date-tab ${resDate==='today'?'active':''}" onclick="setResDate('today')">${icon('calendar',{size:14})} امروز</button>
      <button class="date-tab ${resDate==='tomorrow'?'active':''}" onclick="setResDate('tomorrow')">فردا</button>
      <button class="date-tab ${resDate==='upcoming'?'active':''}" onclick="setResDate('upcoming')">روزهای آینده</button>
      <button class="date-tab ${resDate==='past'?'active':''}" onclick="setResDate('past')">${icon('inbox',{size:14})} گزارش گذشته</button>
      <button class="date-tab ${resDate==='all'?'active':''}" onclick="setResDate('all')">همه</button>
    </div>
    ${resDate==='today'?`<div class="tonight-filters">${TONIGHT_FILTERS.map(f=>`<button class="chip ${tonightFilter===f.v?'is-active':''}" aria-pressed="${tonightFilter===f.v}" onclick="tonightFilterSet(${jsq(f.v)})">${f.l}</button>`).join('')}</div>`:''}
    <div class="panel">
      <div id="resTL"></div>
    </div>`;
  renderResList();
}
async function renderResList(){
  const el=document.getElementById('resTL');
  if(!el)return;
  // اگر توکن staff داریم، رزروها را از API بگیر (بر اساس تاریخ انتخاب‌شده)
  let source=RES, isDemo=true;
  if(API.getToken()){
    el.innerHTML=`<div style="text-align:center;padding:30px;color:var(--t2)">در حال بارگذاری رزروها...</div>`;
    const fresh=await loadReservations(resDate);
    if(fresh!==null){ source=fresh; isDemo=false; } // داده‌ی واقعی؛ در غیر این صورت نمونه
  }
  // ⚠️ رفعِ باگِ صداقتِ داده (یافته‌ی زنده): تا اینجا این تب هیچ‌وقت نمی‌گفت
  // که فهرست الان نمونه است — یعنی رستوران‌دار (بدونِ توکن، یا وقتی API
  // موقتاً جواب نمی‌داد) اسم/شماره‌ی مهمانانِ ساختگی را عینِ رزروهایِ واقعیِ
  // خودش می‌دید.
  const demoNote=isDemo?`<div class="cash-note" style="margin-bottom:14px">${icon('info',{size:13})} این فهرست نمونه است، رزروهایِ واقعیِ تو نیست.</div>`:'';
  let list=source.map((r,i)=>({r,i}));
  // API از قبل بر اساس تاریخ فیلتر کرده؛ نمونه باید محلی فیلتر شود
  if(resDate!=='all' && !API.online)list=list.filter(x=>x.r.date===resDate);
  if(resQuery.trim()){
    const q=resQuery.trim().replace(/\s/g,'');
    const qFa=toFaDigits(q);
    list=list.filter(x=>{
      const name=x.r.name.replace(/\s/g,'');
      const phone=(x.r.phone||'').replace(/\s/g,'');
      return name.includes(resQuery.trim())||phone.includes(q)||phone.includes(qFa);
    });
  }
  // ⚠️ اضافه‌شده (Part 2 — Tonight Board، ۲۰۲۶-۰۸-۱۴): تبِ «امروز» = تخته‌ی
  // امشب — همیشه بر اساسِ ساعت مرتب و طبقِ فیلترِ فعال محدود می‌شود. تبِ‌های
  // دیگر (فردا/آینده/گذشته/همه) دست‌نخورده می‌مانند — این‌ها «امشب» نیستند.
  if(resDate==='today'){
    list.sort((a,b)=>timeToMinutes(a.r.t)-timeToMinutes(b.r.t));
    if(tonightFilter==='notArrived')list=list.filter(x=>TONIGHT_NOT_ARRIVED.includes(x.r.status));
    else if(tonightFilter==='arrived')list=list.filter(x=>TONIGHT_ARRIVED.includes(x.r.status));
    else if(tonightFilter==='soon30'){
      const now=new Date(); const nowMin=now.getHours()*60+now.getMinutes();
      list=list.filter(x=>{const t=timeToMinutes(x.r.t); return t>=nowMin && t<=nowMin+30;});
    }
  }
  const dateLabel={today:'امروز',tomorrow:'فردا',upcoming:'روزهای آینده',past:'گذشته',all:'همه روزها'}[resDate];
  if(!list.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${resDate==='past'?icon('inbox',{size:40}):icon('search',{size:40})}</div><div style="font-weight:700;margin-bottom:4px">رزروی پیدا نشد</div><div style="font-size:13px">${resQuery?'با این جستجو نتیجه‌ای نبود':'برای '+dateLabel+' رزروی نیست'}</div></div>`;
    return;
  }
  // گزارش گذشته: خلاصه‌ی آماری بالا
  if(resDate==='past'){
    // [merge ۰۸-۲۵] این سه شمارنده هم باید با عبورِ کاملِ وضعیت (mapResStatus)
    // هماهنگ شوند، وگرنه رزروِ `rejected`/`auto_cancelled` در هیچ ستونی شمرده
    // نمی‌شد (#68 آن‌ها را به 'cancelled' نگاشت می‌کرد و در ستونِ لغوشده می‌آمد)
    // و مهمانِ `checked_in`/`seated`/`dining` از «انجام‌شده» جا می‌ماند.
    // مجموعِ سه ستون دیگر از تعدادِ کلِ ردیف‌ها کمتر نمی‌شود.
    const DONE_SET=['completed',...TONIGHT_ARRIVED];
    const CANCELLED_SET=['cancelled','auto_cancelled','rejected'];
    const done=list.filter(x=>DONE_SET.includes(x.r.status)).length;
    const noshow=list.filter(x=>x.r.status==='noshow'||x.r.status==='no_show').length;
    const cancelled=list.filter(x=>CANCELLED_SET.includes(x.r.status)).length;
    el.innerHTML=demoNote+`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        <div style="background:var(--green-50);border:1px solid #BBF7D0;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#15803D">${fa(done)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">${icon('check',{size:12})} انجام‌شده</div></div>
        <div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--amber)">${fa(noshow)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">${icon('alert',{size:12})} نیومدن (no-show)</div></div>
        <div style="background:var(--red-50);border:1px solid #FECACA;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#B91C1C">${fa(cancelled)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">${icon('close',{size:12})} لغوشده</div></div>
      </div>`+
      list.map(x=>resItemHTML(x.r,x.i)).join('');
    return;
  }
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): قبلاً فقط 'arrived' شمرده می‌شد؛ حالا که
  // mapResStatus وضعیتِ واقعی را عبور می‌دهد، مهمانِ حاضر می‌تواند
  // checked_in/arrived/seated/dining باشد — همه «رسیده» حساب می‌شوند.
  const ARRIVED_SET=['arrived','checked_in','seated','dining'];
  const seated=list.filter(x=>ARRIVED_SET.includes(x.r.status)).length;
  el.innerHTML=demoNote+`<div style="font-size:13px;color:var(--t2);margin-bottom:14px;font-weight:600">${fa(list.length)} رزرو · ${fa(seated)} مهمان رسیده${resQuery?` · نتایج «${esc(resQuery)}»`:''}</div>`+
    list.map(x=>resItemHTML(x.r,x.i)).join('');
}
// تبدیل ارقام انگلیسی به فارسی برای جستجوی تلفن
function toFaDigits(s){return s.replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
function searchRes(v){resQuery=v;document.querySelector('.s-clear')?.classList.toggle('show',!!v);renderResList()}
function clearResSearch(){resQuery='';const i=document.getElementById('resSearch');if(i)i.value='';document.querySelector('.s-clear')?.classList.remove('show');renderResList()}
function setResDate(d){resDate=d;rReservations()}
// نشانِ اعتبارِ رزرو — عمداً از تگِ seg (vip/new — سیستمِ CRM/RFM قدیمی) جداست.
// همون اسم‌ها/آیکون‌هایی که در اپِ کاستومر (features/economy.js) نشون داده
// می‌شه، تا رستوران‌دار بدونه این همون چیزیه که مشتری هم می‌بینه.
const REPUTATION_BADGE_BIZ={
  silver:{name:'مهمانِ معتبر',ic:'star',fg:'#0D9488'},
  gold:{name:'مهمانِ ممتاز',ic:'shield',fg:'#4F46E5'},
  platinum:{name:'مهمانِ نمونه',ic:'crown',fg:'#7C3AED'},
};
function reputationBadgeHTML(tier){
  const b=REPUTATION_BADGE_BIZ[tier]; if(!b)return'';
  return `<span class="tl-tag" style="color:${b.fg};background:${b.fg}1a" title="اعتبارِ رزروِ این مشتری بر اساسِ سابقه‌ی به‌موقع‌بودنش">${icon(b.ic,{size:11})} ${b.name}</span>`;
}
function resItemHTML(r,i){
  const isPast=['completed','noshow','no_show','cancelled','auto_cancelled','rejected','expired'].includes(r.status);
  const statusChip=(STATUS_META[r.status]?`<span class="chip-status" style="background:${STATUS_META[r.status].bg};color:${STATUS_META[r.status].fg}">${icon(STATUS_META[r.status].icon,{size:12})} ${STATUS_META[r.status].label}</span>`:'');
  // ⚠️ اضافه‌شده (Part 2 — Tonight Board، ۲۰۲۶-۰۸-۱۴): دکمه‌های عملیاتی دیگر
  // بر اساسِ حدسِ ثابت («اگه arrived نیست دکمه‌ی رسید رو نشون بده») نیستند —
  // مستقیماً از STATUS_TRANSITIONS (آینه‌ی lifecycle.ts بک‌اند) می‌آیند، یعنی
  // هیچ‌وقت دکمه‌ای که سرور رد می‌کند نشان داده نمی‌شود (MUST #7 ماموریت).
  const allowed=STATUS_TRANSITIONS[r.status]||[];
  const isTonight=resDate==='today'; // دکمه‌های فربه فقط روی تخته‌ی امشب
  const actBtn='btn-sm'+(isTonight?' btn-tonight':'');
  // برچسب تاریخ (وقتی تب «همه» یا گذشته‌ست مفیده)
  const dateBadge=(resDate==='all'||resDate==='past'||resDate==='upcoming')&&r.dLabel?`<span style="font-size:11px;color:var(--t3);font-weight:600">${r.dLabel} · </span>`:'';
  return `<div class="tl-item"><div class="tl-time"><div class="tl-time-v">${r.t}</div></div>
    <div class="tl-card ${r.status}${r.seg==='vip'?' vip':''}"${isPast?' style="opacity:.92"':''}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="tl-name">${esc(r.name)} ${r.seg==='vip'?'<span class="tl-tag vip">VIP</span>':r.seg==='new'?'<span class="tl-tag new">جدید</span>':''} ${reputationBadgeHTML(r.reputationTier)}</div>
        ${statusChip}
      </div>
      <div class="tl-meta">${dateBadge}${icon('users',{size:13})} ${fa(r.party)} نفر · میز ${fa(r.table)} · ${icon('phone',{size:13})} ${esc(r.phone)} ${r.pre?`· ${icon('utensils',{size:12})} پیش‌سفارش`:''}</div>
      ${r.note?`<div class="tl-meta" style="color:var(--amber)">${icon('inbox',{size:13})} ${esc(r.note)}</div>`:''}
      ${r.cancelReason?`<div class="tl-meta" style="color:#B91C1C">${icon('alert',{size:13})} دلیل لغو: ${esc(r.cancelReason)}</div>`:''}
      ${!isPast?`<div class="tl-actions">
        ${allowed.includes('checked_in')?`<button class="btn btn-teal ${actBtn}" onclick="markArrived(${i})">${icon('check',{size:14})} رسید</button>`:''}
        ${allowed.includes('seated')?`<button class="btn btn-primary ${actBtn}" onclick="markSeated(${i})">${icon('utensils',{size:14})} نشاند</button>`:''}
        ${allowed.includes('no_show')?`<button class="btn btn-ghost ${actBtn}" onclick="markNoShow(${i})">${icon('alert',{size:14})} نیومد</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="openStatusMenu(${i})">${icon('refresh',{size:14})} وضعیت</button>
        <button class="btn btn-ghost btn-sm" ${r.phone?`onclick="callCustomer(${jsq(r.phone)})"`:'disabled title="شماره‌ای ثبت نشده"'}>تماس</button>
        ${allowed.includes('cancelled')?`<button class="btn btn-danger ${actBtn}" onclick="cancelRes(${i})">لغو</button>`:''}
      </div>`:`<div class="tl-actions"><button class="btn btn-ghost btn-sm" onclick="viewHistory(${i})">${icon('inbox',{size:14})} تاریخچه</button><button class="btn btn-ghost btn-sm" ${r.phone?`onclick="callCustomer(${jsq(r.phone)})"`:'disabled title="شماره‌ای ثبت نشده"'}>تماس</button>${r.status==='completed'?`<button class="btn btn-ghost btn-sm" onclick="openManual()">رزرو مجدد</button>`:''}</div>`}
    </div></div>`;
}
// ⚠️ رفعِ باگِ زنده (Tonight Board، ۲۰۲۶-۰۸-۱۴): این تابع قبلاً وقتی آنلاین
// بود هیچ‌وقت PATCHِ واقعیِ تغییرِ وضعیت رو صدا نمی‌زد — فقط وضعیت رو محلی
// عوض می‌کرد و پیامکِ خوش‌آمد می‌فرستاد؛ یعنی سرور هیچ‌وقت نمی‌فهمید مهمان
// رسیده (رزرو برای بقیه‌ی سیستم‌ها — مثلِ پلانِ سالن یا گزارش — همچنان
// «نرسیده» می‌موند). حالا از مسیرِ واحدِ changeStatus (optimistic + PATCHِ
// واقعی + rollback روی خطا) استفاده می‌شه؛ رفتارِ صف‌بندیِ آفلاینِ قبلی
// (Outbox) هم عیناً حفظ شده چون آن بخش واقعاً درست بود.
async function markArrived(i){
  const r=RES[i]; if(!r)return;
  if(isOffline() && API.getToken()){
    r.status='checked_in';rReservations();
    Outbox.enqueue({ type:'checkin', path:`/restaurant/reservations/${r.code||r.id||''}/status`, method:'PATCH', body:{ status:'checked_in' }, label:`ثبت ورود ${r.name}` });
    toast('',`${r.name} رسید — با برگشت اینترنت همگام می‌شود`);
    return;
  }
  const phone=r.phone;
  await changeStatus(i,'checked_in');
  // ارسال پیامکِ خوش‌آمد فقط بعد از تأییدِ واقعیِ تغییرِ وضعیت (نه قبلش)
  if(API.getToken() && phone){
    const res=await API.sendSms({kind:'campaign',phones:[phone.replace(/\s/g,'')],message:'welcome'});
    if(res.ok)toast('',`پیامکِ خوش‌آمد برایِ ${r.name} ارسال شد`);
  }
}
async function markSeated(i){
  await changeStatus(i,'seated');
}
// no_show وضعیتِ نهایی/برگشت‌ناپذیره (STATUS_TRANSITIONS['no_show']=[]) —
// طبقِ ماموریت با تأییدِ صریح انجام می‌شه تا لمسِ اشتباه، رزروِ واقعی رو خراب نکنه.
async function markNoShow(i){
  const r=RES[i]; if(!r)return;
  if(!window.confirm(`${r.name} به‌عنوانِ «نیومد» ثبت بشه؟ این وضعیت برگشت‌پذیر نیست.`))return;
  await changeStatus(i,'no_show');
}
function cancelRes(i){
  openModal(`<div class="modal-title">لغو رزرو</div><div class="modal-sub">${esc(RES[i].name)} — ساعت ${esc(RES[i].t)}</div>
    <div class="field-label">دلیل لغو (الزامی)</div>
    <input class="inp" id="cancelReason" placeholder="مثلاً تماس مشتری، تداخل میز...">
    <div style="display:flex;gap:8px"><button class="btn btn-danger btn-lg" style="flex:1" onclick="doCancelRes(${i})">تأیید لغو</button><button class="btn btn-ghost btn-lg" onclick="closeModal()">انصراف</button></div>`);
}
// ⚠️ رفعِ باگِ زنده: قبلاً این تابع فقط RES.splice(i,1) می‌کرد — هیچ درخواستِ
// واقعی به بک‌اند نمی‌رفت، یعنی رزرو از پنل محو می‌شد ولی روی سرور همچنان
// فعال می‌موند (میزِ رزروشده هیچ‌وقت واقعاً آزاد نمی‌شد). حالا از مسیرِ
// واحدِ changeStatus استفاده می‌کنیم — هم دلیل رو می‌فرسته، هم واقعاً PATCH
// می‌زنه، هم روی خطای واقعی rollback می‌کنه (RES.splice هم دیگه حذف نمی‌کنه؛
// رزروِ لغوشده در تاریخچه/تبِ گذشته باقی می‌مونه — درست‌تر از پاک‌کردنِ کامل).
async function doCancelRes(i){
  const reason=document.getElementById('cancelReason').value.trim();
  if(!reason){toast('','دلیل لغو الزامیه');return}
  await changeStatus(i,'cancelled',reason);
}
// تولید تاریخ‌های شمسی تا ۱ ماه آینده (نمونه: از پنجشنبه ۱۵ خرداد)
function buildDateOptions(){
  const weekdays=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const monthLen=[31,31,31,31,31,31,30,30,30,30,30,29];
  // شروع: پنجشنبه ۱۵ خرداد (ماه index 2)، پنجشنبه = index 5 در weekdays
  let day=15, mon=2, wd=5;
  let opts='';
  for(let i=0;i<=30;i++){
    const label=`${weekdays[wd]} ${fa(day)} ${months[mon]}`;
    const val=i===0?'today':i===1?'tomorrow':'d'+i;
    const prefix=i===0?'امروز — ':i===1?'فردا — ':'';
    opts+=`<option value="${val}" data-label="${label}">${prefix}${label}</option>`;
    // پیش‌رفتن یک روز
    wd=(wd+1)%7;
    day++;
    if(day>monthLen[mon]){day=1;mon=(mon+1)%12}
  }
  return opts;
}
// تبدیل مقدار تاریخ پنل (today/tomorrow/dN) و ساعت فارسی به فرمت ISO که بک‌اند می‌خواهد
function manualDateToISO(dateVal, faTime){
  const now=new Date();
  let offset=0;
  if(dateVal==='tomorrow')offset=1;
  else if(/^d\d+$/.test(dateVal))offset=parseInt(dateVal.slice(1))||0;
  const t=new Date(now); t.setDate(now.getDate()+offset);
  const iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  const time=String(faTime||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim()||'20:00';
  return {date:iso,time};
}
function openManual(){
  openModal(`<div class="modal-title">رزرو دستی</div><div class="modal-sub">برای مشتری تلفنی یا حضوری — تا ۱ ماه آینده</div>
    <div class="field-label">نام مهمان</div><input class="inp" id="mName" placeholder="نام و نام خانوادگی">
    <div class="field-label">موبایل</div><input class="inp" id="mPhone" placeholder="۰۹...">
    <div class="field-label">تاریخ رزرو</div>
    <select class="inp" id="mDate">${buildDateOptions()}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div><div class="field-label">ساعت</div><select class="inp" id="mTime"><option>۱۲:۳۰</option><option>۱۳:۰۰</option><option>۱۸:۰۰</option><option>۱۹:۰۰</option><option>۲۰:۰۰</option><option>۲۱:۰۰</option></select></div>
      <div><div class="field-label">میز</div><select class="inp" id="mTable">${TABLES.filter(t=>t.s==='free').map(t=>`<option value="${t.n}">${esc(tableLabel(t))}</option>`).join('')}</select></div>
      <div><div class="field-label">نفر</div><select class="inp" id="mParty"><option>۲</option><option>۳</option><option>۴</option><option>۵</option><option>۶</option><option>۸</option></select></div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" onclick="saveManual()">ثبت رزرو</button>`);
}
// ═══ WALK-IN (ورود بدون رزرو) ═══
async function openWalkin(){
  openModal(`
    <div class="modal-title">${icon('users',{size:18})} ورود بدون رزرو</div>
    <div class="modal-sub">شماره موبایل مهمان رو وارد کن — بقیه‌اش خودکاره</div>
    <div class="field-label">شماره موبایل</div>
    <input class="inp" id="wPhone" placeholder="۰۹..." inputmode="tel" style="font-size:17px;letter-spacing:.05em;text-align:center">
    <button class="btn btn-primary btn-lg btn-block" onclick="walkinLookup()">بررسی شماره</button>
    <div style="font-size:12px;color:var(--t2);text-align:center;margin-top:12px;line-height:1.6">اگه قبلاً اومده باشه، اطلاعاتش رو می‌شناسیم.<br>اگه تازه‌وارد باشه، چند تا سوال کوتاه می‌پرسیم.</div>
  `);
  setTimeout(()=>document.getElementById('wPhone')?.focus(),200);
  // میزها را در پس‌زمینه لود کن تا وقتی به مرحله‌ی انتخاب میز رسیدیم، گزینه‌ها آماده باشن
  if(API.getToken() && !_tablesLoaded){ loadTables(); }
}
async function walkinLookup(){
  const raw=document.getElementById('wPhone').value;
  const ph=normalizePhone(raw);
  if(!ph||ph.length<11){toast('','شماره موبایل کامل وارد کن');return}
  // مطمئن شو میزها لود شدن (اگه هنوز نشدن، الان لود کن و منتظر بمون)
  if(API.getToken() && !_tablesLoaded){
    const btn=event?.target;
    if(btn){btn.disabled=true;btn.textContent='در حال بارگذاری میزها...';}
    await loadTables();
    if(btn){btn.disabled=false;btn.textContent='بررسی شماره';}
  }
  const member=CLUB.find(m=>normalizePhone(m.phone)===ph);
  const freeTables=TABLES.filter(t=>t.s==='free');
  const tableOptions=freeTables.length
    ? freeTables.map(t=>`<option value="${t.id}">${esc(tableLabel(t))} (${fa(t.c)} نفره)</option>`).join('')
    : '';
  const tableSelectHtml=freeTables.length
    ? `<select class="inp" id="wTable"><option value="">— بعداً تخصیص می‌دم —</option>${tableOptions}</select>`
    : `<select class="inp" id="wTable" disabled><option value="">میز خالی موجود نیست</option></select><div style="font-size:11px;color:var(--t3);margin-top:4px">همه‌ی میزها پرن — می‌تونی بعداً از پلان سالن تخصیص بدی</div>`;
  if(member){
    const tierName={gold:'طلایی',silver:'نقره‌ای',bronze:'برنزی'}[member.tier]||member.tier;
    openModal(`
      <div style="text-align:center;margin-bottom:6px"><div style="width:56px;height:56px;border-radius:50%;background:var(--teal-50);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${icon('user',{size:28})}</div></div>
      <div class="modal-title" style="text-align:center">${esc(member.fn)} ${esc(member.ln)} خوش اومدی!</div>
      <div class="modal-sub" style="text-align:center">مشتری قدیمی — قبلاً ثبت‌شده</div>
      <div class="summary" style="margin-bottom:18px">
        <div class="sum-row"><span class="k">کد عضویت</span><span class="v">${esc(member.code)}</span></div>
        <div class="sum-row"><span class="k">سطح</span><span class="v">${tierName}</span></div>
        <div class="sum-row"><span class="k">امتیاز</span><span class="v">${fa(member.points)}</span></div>
        <div class="sum-row"><span class="k">موبایل</span><span class="v">${esc(member.phone)}</span></div>
      </div>
      <div class="field-label">تعداد نفرات</div>
      <div class="opt-row wparty-group">
        ${[1,2,3,4,6].map((c,idx)=>`<div class="opt ${idx===1?'sel':''}" onclick="document.querySelectorAll('.wparty-group .opt').forEach(o=>o.classList.remove('sel'));this.classList.add('sel')" data-p="${c}">${fa(c)} نفر</div>`).join('')}
      </div>
      <div class="field-label">میز (اختیاری)</div>
      ${tableSelectHtml}
      <button class="btn btn-teal btn-lg btn-block" id="wConfirmBtn" style="margin-top:14px" onclick="walkinCheckinMember()">${icon('check',{size:16})} ثبت ورود</button>
    `);
    window._walkinMember={phone:member.phone,name:(member.fn+' '+member.ln).trim()};
  }else{
    openModal(`
      <div class="modal-title">مهمان جدید</div>
      <div class="modal-sub">این شماره تازه‌ست — یه ثبت سریع کنیم تا دفعه‌ی بعد بشناسیمش</div>
      <div style="background:var(--teal-50);border:1px solid #99F6E4;border-radius:var(--r);padding:11px 14px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--teal-600);text-align:center">${icon('phone',{size:13})} ${ph}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div class="field-label">نام</div><input class="inp" id="wFn" placeholder="نام"></div>
        <div><div class="field-label">نام خانوادگی</div><input class="inp" id="wLn" placeholder="فامیل"></div>
      </div>
      <div class="field-label">تاریخ تولد (اختیاری — برای هدیه‌ی تولد)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <select class="inp" id="wBd"><option value="">روز</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}">${fa(i+1)}</option>`).join('')}</select>
        <select class="inp" id="wBm"><option value="">ماه تولد</option>${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select>
      </div>
      <div class="field-label">تعداد نفرات</div>
      <div class="opt-row wparty-group">
        ${[1,2,3,4,6].map((c,idx)=>`<div class="opt ${idx===1?'sel':''}" onclick="document.querySelectorAll('.wparty-group .opt').forEach(o=>o.classList.remove('sel'));this.classList.add('sel')" data-p="${c}">${fa(c)} نفر</div>`).join('')}
      </div>
      <div class="field-label">میز (اختیاری)</div>
      ${tableSelectHtml}
      <button class="btn btn-primary btn-lg btn-block" id="wConfirmBtn" style="margin-top:16px" onclick="walkinNewSave(${jsq(raw)})">${icon('check',{size:16})} ثبت ورود + عضویت باشگاه</button>
    `);
  }
}
function walkinCheckinMember(){if(window._walkinMember){walkinCheckinReal(window._walkinMember.phone,null,null,null)}}
// ثبت واقعی ورود — وصل به POST /restaurant/walkin (پیدا/ساخت کاربر + عضویت باشگاه + رزرو seated + اشغال میز)
// تبدیلِ (ماه، روزِ) شمسی به (ماه، روزِ) میلادی — بدونِ کتابخانه، با Intlِ
// تقویمِ persian. رخدادِ بعدیِ همان روزِ شمسی را پیدا می‌کند (دقتِ ±۱ روز بینِ
// سال‌ها به‌خاطرِ کبیسه، در برابرِ ۲-۳ ماه خطای قبلی ناچیز است).
function jalaliMdToGregMd(jm, jd){
  if(!(jm>=1&&jm<=12&&jd>=1&&jd<=31)) return null;
  const fmt=new Intl.DateTimeFormat('en-US-u-ca-persian',{month:'numeric',day:'numeric'});
  const start=new Date(); start.setHours(12,0,0,0); start.setDate(start.getDate()-1);
  for(let i=0;i<400;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const p=fmt.formatToParts(d);
    const m=+p.find(x=>x.type==='month').value, day=+p.find(x=>x.type==='day').value;
    if(m===jm&&day===jd) return {gMonth:d.getMonth()+1, gDay:d.getDate()};
  }
  return null;
}
async function walkinCheckinReal(phone,firstName,lastName,birthDayMonth){
  const party=+(document.querySelector('.wparty-group .opt.sel')?.dataset.p||2);
  const tableId=document.getElementById('wTable')?.value||null;
  const btn=document.getElementById('wConfirmBtn');
  if(btn){btn.disabled=true;btn.textContent='در حال ثبت...';}
  const body={phone,party_size:party,table_id:tableId||undefined};
  if(firstName){body.first_name=firstName;body.last_name=lastName||'';}
  if(birthDayMonth){
    // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): سلکتِ ماهِ تولد عددِ ماهِ *شمسی* می‌دهد
    // (فروردین=۱)، ولی بک‌اند (createWalkin) آن را new Date(Date.UTC(1990,
    // m-1, d)) — یعنی *میلادی* — می‌سازد و grantBirthdayRewards با ماهِ میلادیِ
    // امروز مقایسه می‌کند. نتیجه: پیامکِ تولد ۲ تا ۳ ماه جابه‌جا. این‌جا در مرزِ
    // تقویم به میلادی تبدیل می‌کنیم تا ذخیره و مقایسه‌ی بک‌اند هم‌راستا شوند.
    const g=jalaliMdToGregMd(+birthDayMonth[1],+birthDayMonth[0]);
    if(g){body.birth_day=g.gDay;body.birth_month=g.gMonth;}
  }
  // ⚠️ اضافه‌شده (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۵): قبلاً این مسیر هیچ Idempotency-Key
  // نمی‌فرستاد — دابل‌تپِ «ثبت ورود» (یا حتی retryِ خودکارِ شبکه) می‌توانست دو
  // رزروِ seated + دو عضویتِ باشگاه برایِ همون مهمان بسازد. یک کلید برایِ کلِ
  // تلاش (آنلاین یا صف‌شده‌ی آفلاین) ساخته می‌شود تا sync بعدی هم همون کلید را بفرسته.
  const idemHeaders={ 'Idempotency-Key': genIdempotencyKey() };
  const res=await API.walkin(body, idemHeaders);
  if(!res.ok){
    // آفلاین → محلی ثبت کن و برای همگام‌سازی صف کن (واک‌این نباید در قطعی اینترنت بخوابد)
    if(res.offline){
      const nm=(firstName?firstName+(lastName?' '+lastName:''):'مهمان واک‌این');
      const localRec={t:new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}),name:nm,party,table:tableId||null,status:'arrived',seg:'new',pre:false,note:'واک‌این (آفلاین)',phone,date:'today',dLabel:'امروز'};
      RES.push(localRec);
      if(API.getToken()){
        Outbox.enqueue({ type:'walkin', path:'/restaurant/walkin', method:'POST', body, headers:idemHeaders, label:`واک‌این ${nm}${tableId?' · میز':''}`, localRef:localRec });
      }
      closeModal();
      if(document.getElementById('v-overview').classList.contains('active'))rOverview();
      else if(document.getElementById('v-floor').classList.contains('active'))rFloor();
      toast('',`${nm} محلی ثبت شد — با برگشت اینترنت همگام می‌شود`);
      return;
    }
    toast('',res.error?.message||'ثبت ورود ناموفق بود');
    if(btn){btn.disabled=false;btn.textContent='ثبت ورود';}
    return;
  }
  closeModal();
  // داده‌های واقعی رو دوباره بکش (باشگاه، میزها، رزروهای امروز)
  await Promise.all([loadTables(), loadClubMembers().then(c=>CLUB=c)]);
  if(document.getElementById('v-overview').classList.contains('active'))rOverview();
  else if(document.getElementById('v-reservations').classList.contains('active')){resDate='today';rReservations()}
  else if(document.getElementById('v-floor').classList.contains('active'))rFloor();
  toast('',`${res.data.name} ثبت ورود شد${tableId?' · میز اختصاص یافت':''}`);
  if(res.data.enrolled_now) setTimeout(()=>toast('',`عضو باشگاه شد (${res.data.club_code})`),900);
}
async function walkinNewSave(rawPhone){
  const fn=document.getElementById('wFn').value.trim();
  const ln=document.getElementById('wLn').value.trim();
  if(!fn){toast('','حداقل نام رو وارد کن');return}
  const bd=document.getElementById('wBd').value;
  const bm=document.getElementById('wBm').value;
  await walkinCheckinReal(rawPhone,fn,ln,(bd&&bm)?[bd,bm]:null);
}

async function saveManual(){
  const n=document.getElementById('mName').value.trim();
  if(!n){toast('','نام مهمان رو وارد کن');return}
  const phone=document.getElementById('mPhone').value;
  const dateSel=document.getElementById('mDate');
  const dateVal=dateSel.value;
  const opt=dateSel.options[dateSel.selectedIndex];
  const dLabel=opt.dataset.label||opt.text.replace(/^(امروز|فردا)\s*—\s*/,'').trim();
  const dateKey=(dateVal==='today'||dateVal==='tomorrow')?dateVal:'upcoming';
  const timeVal=document.getElementById('mTime').value;
  const partyVal=+document.getElementById('mParty').value.replace(/[^\d]/g,'')||2;
  const tableVal=+document.getElementById('mTable').value.replace(/[^\d]/g,'')||1;
  // ⚠️ اضافه‌شده (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۵): یک کلید برایِ کلِ تلاش (چه
  // درخواستِ آنلاینِ زیر موفق شود چه به مسیرِ آفلاینِ Outbox بیفتد) — تا اگر
  // درخواستِ اول واقعاً به سرور رسیده باشد ولی پاسخش گم شده، retry/صف‌شدنِ
  // بعدی با همون کلید replay شود، نه رزروِ دومی بسازد.
  const manualIdemKey=genIdempotencyKey();

  // اگر توکن staff داریم، رزرو واقعی در دیتابیس ثبت کن
  if(API.getToken()){
    const dt=manualDateToISO(dateVal,timeVal);
    const res=await API.post('/reservations',{
      restaurant_id:STAFF_INFO?.restaurant_id||undefined,
      date:dt.date,time:dt.time,party_size:partyVal,notify_sms:!!phone,
      guest:{name:n,phone:phone,table_number:tableVal,note:'رزرو دستی'},
    },{ 'Idempotency-Key': manualIdemKey });
    if(res.ok){
      // موفق در سرور — به‌علاوه‌ی نمایش محلی
      RES.push({t:timeVal,name:n,party:partyVal,table:tableVal,status:'confirmed',seg:'new',pre:false,note:'رزرو دستی',phone,date:dateKey,dLabel,code:res.data?.reservation?.code});
      const clubBefore=CLUB.length;
      CLUB=await loadClubMembers(); // وضعیت واقعی باشگاه رو از سرور بگیر، حدس نزن
      const newlyEnrolled=CLUB.length>clubBefore;
      closeModal();resDate=dateKey;
      if(document.getElementById('v-reservations').classList.contains('active'))rReservations();
      else if(document.getElementById('v-overview').classList.contains('active'))rOverview();
      toast('',`رزرو ${dLabel} در سیستم ثبت شد${newlyEnrolled?` + ${n} به باشگاه اضافه شد`:''}`);
      return;
    }
    if(!res.offline){toast('',res.error?.message||'ثبت رزرو ناموفق بود');return;}
    // اگر offline، می‌افتد به مسیر محلی پایین
  }

  // مسیر محلی (آفلاین یا بدون توکن) — fallback
  const localRec={t:timeVal,name:n,party:partyVal,table:tableVal,status:'confirmed',seg:'new',pre:false,note:'رزرو دستی',phone,date:dateKey,dLabel};
  RES.push(localRec);
  // اگر آفلاین بودیم (نه فقط بدون توکن)، عملیات را برای همگام‌سازی بعدی صف کن
  if(isOffline() && API.getToken()){
    Outbox.enqueue({
      type:'reservation', path:'/reservations', method:'POST',
      body:{ restaurant_id:'self', date:dateKey, time:timeVal, party_size:partyVal, guest:{name:n,phone:phone.replace(/\s/g,'')} },
      headers:{ 'Idempotency-Key': manualIdemKey },
      label:`رزرو ${n} · ${dLabel} ${timeVal}`, localRef:localRec,
    });
  }
  // ⚠️ رفعِ جعلِ کدِ عضویت (فازِ ۲، §۳): اینجا قبلاً enrollClub محلی صدا زده
  // می‌شد و توست یک کدِ عضویتِ ساختگی (VIS-xxx) اعلام می‌کرد — کدی که در
  // دیتابیس وجود نداشت. عضویتِ واقعی را سرور هنگامِ همگام‌سازیِ همین رزرو
  // به‌صورت اتمیک می‌سازد (createWalkinTx/createReservation)، با کدِ واقعی.
  // خودِ صف‌کردنِ رزرو در Outbox (بالا) درست است و دست‌نخورده مانده.
  closeModal();
  resDate=dateKey;
  if(document.getElementById('v-reservations').classList.contains('active'))rReservations();
  else if(document.getElementById('v-overview').classList.contains('active'))rOverview();
  toast('', isOffline()
    ? `رزرو ${dLabel} محلی ثبت شد — با برگشت اینترنت همگام می‌شود`
    : `رزرو ${dLabel} ثبت شد`);
}

// ═══════════ FLOOR PLAN ═══════════
// هماهنگ‌سازی وضعیت میزها با رزروهای فعال امروز
// میزی که رزرو «تأییدشده»ی امروز داره → reserved (اگه دستی seated نشده باشه)
// میزی که مهمانش «رسیده» → seated
// [merge ۰۸-۲۵] از وقتی mapResStatus وضعیتِ واقعی را عبور می‌دهد (به‌جایِ فروکاستنِ
// همه‌چیز به 'confirmed')، این فیلتر دیگر نمی‌تواند فقط دو رشته را چک کند:
// رزروِ `auto_confirmed` (که #68 به 'confirmed' نگاشت می‌کرد) و مهمانِ
// `checked_in`/`seated`/`dining` وگرنه از نقشه‌ی سالن غیب می‌شدند و میز
// «خالی» نشان داده می‌شد در حالی که مهمان سرِ آن نشسته بود.
function syncTablesFromReservations(){
  const HOLDS_TABLE=[...TONIGHT_NOT_ARRIVED.filter(s=>s!=='pending'),...TONIGHT_ARRIVED];
  const todayRes=RES.filter(r=>r.date==='today'&&r.table>0&&HOLDS_TABLE.includes(r.status));
  TABLES.forEach(t=>{
    // ⚠️ فازِ ۲ (§۶): وضعیت‌هایِ عملیاتیِ صریح («تعمیرات» و «در حالِ نظافت»)
    // نباید با وضعیتِ مشتق‌شده از رزرو بازنویسی شوند. این‌ها را انسان یا
    // بک‌اند عمداً ست کرده و بر حدسِ این تابع اولویت دارند.
    //
    // چرا مهم است: میزی که در تعمیرات است ولی یک رزروِ امروز به شماره‌اش
    // اشاره دارد، پیش از این «رزروشده» نمایش داده می‌شد — یعنی همان
    // پنهان‌شدنِ وضعیتِ تعمیرات که این batch می‌خواست رفعش کند.
    // (با تستِ e2e پیدا شد: میزِ maintenance در DOM با کلاسِ reserved می‌آمد.)
    if(t.s==='maintenance'||t.s==='cleaning'){ delete t._guest; delete t._time; return; }
    // اگه دستی روی این میز وضعیت seated گذاشته شده و رزروی نیست، دست نزن
    const res=todayRes.find(r=>r.table===t.n);
    if(res){
      // رزرو فعال داره
      if(TONIGHT_ARRIVED.includes(res.status))t.s='seated';
      else if(t.s!=='seated')t.s='reserved'; // اگه قبلاً نشسته نشده، رزرو
      t._guest=res.name; // نام مهمان برای نمایش
      t._time=res.t;
    }else{
      // رزرو فعالی روی این میز نیست — اطلاعات مهمان رو پاک کن
      delete t._guest;delete t._time;
      // اگه قبلاً reserved بوده ولی دیگه رزرو نداره، آزادش کن (مگه دستی seated شده)
      if(t.s==='reserved')t.s='free';
    }
  });
}
// ═══════════ WAITLIST (داشبورد لیست انتظار) ═══════════
