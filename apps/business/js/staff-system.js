// ═══ رزرونو — پنل business: کارکنان + مودال + اعلان + کش‌بک + init (Vanilla JS، بدون build، scope مشترک) ═══
// داده‌ی دمو فقط fallbackِ آفلاین است (وقتی توکن نیست یا سرور در دسترس نیست).
const STAFF_DEMO=[
  {id:'demo1',phone:'۰۹۱۲۰۰۰۰۰۰۱',role:'owner',permissions:{}},
  {id:'demo2',phone:'۰۹۱۲۰۰۰۰۰۰۲',role:'staff',permissions:{canManageReservations:true,canManageTables:true}},
];
let STAFF_LIST=STAFF_DEMO.slice();
let _staffLoaded=false;

const ROLE_FA={owner:'مالک',manager:'مدیر',staff:'کارمند',admin:'ادمین'};
// کلیدهای دسترسی — دقیقاً هم‌راستا با schema بک‌اند (/restaurant/staff PATCH)
const PERM_DEFS=[
  ['canManageReservations','مدیریت رزروها'],
  ['canManageTables','مدیریت میزها'],
  ['canManageWaitlist','مدیریت لیست انتظار'],
  ['canViewAnalytics','مشاهده آنالیتیکس'],
  ['canViewRevenue','مشاهده درآمد'],
  ['canManageCampaigns','مدیریت کمپین‌ها'],
  ['canManageCoupons','مدیریت کوپن‌ها'],
  ['canManageStaff','مدیریت کارکنان'],
  ['canManageSettings','مدیریت تنظیمات'],
];

async function loadStaff(){
  if(!API.getToken()) return; // آفلاین/دمو
  const res=await API.staffList();
  if(res.ok && Array.isArray(res.data?.items)) STAFF_LIST=res.data.items;
  _staffLoaded=true;
}

// ═══════════ تغییرِ رمزِ خود (مهاجرتِ ۰۷۴) ═══════════
// ⚠️ چرا اینجا و نه در پنلِ شرکت: رمزِ اولیه را شرکت می‌سازد، ولی از آن
// لحظه به بعد فقط خودِ کاربر باید بتواند عوضش کند. سرور هم همین را اعمال
// می‌کند (دامنه با `id: auth.sub` قفل است).
async function submitPasswordChange(){
  const cur = document.getElementById('pwCur')?.value||'';
  const nw  = document.getElementById('pwNew')?.value||'';
  const rep = document.getElementById('pwNew2')?.value||'';
  if (nw.length < 8) { toast('','رمز تازه باید حداقل ۸ کاراکتر باشد'); return; }
  if (nw !== rep) { toast('','دو رمز یکسان نیستند'); return; }
  const btn = document.getElementById('pwSaveBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال ذخیره…'; }
  const res = await API.changeStaffPassword({
    new_password: nw, ...(cur ? { current_password: cur } : {}),
  });
  if (btn){ btn.disabled = false; btn.textContent = 'تغییر رمز'; }
  if (!res.ok) { toast('', res.error?.message || 'رمز عوض نشد'); return; }
  ['pwCur','pwNew','pwNew2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  toast('','رمز عوض شد');
}

function rStaff(){
  if(!_staffLoaded && API.getToken()){ loadStaff().then(()=>rStaff()); }
  const avatar=s=>(s.name||s.phone||'?').toString().trim().charAt(0);
  const isDemo=!API.getToken()||!_staffLoaded;
  document.getElementById('v-staff').innerHTML=(isDemo?`<div class="cash-note">${icon('info',{size:13})} فهرستِ زیر نمونه است، کارکنانِ واقعیِ تو نیست.</div>`:'')+`
    <div class="panel">
      <div class="panel-head"><div>
        <div class="panel-title">${icon('lock',{size:16})} رمز عبور من</div>
        <div class="panel-sub">رمزِ ورودِ خودت به این پنل</div>
      </div></div>
      <div style="display:grid;gap:10px">
        <label class="login-field-label" for="pwCur">رمز فعلی</label>
        <input class="login-inp" id="pwCur" type="password" autocomplete="current-password" placeholder="اگر هنوز رمز نداری، خالی بگذار">
        <label class="login-field-label" for="pwNew">رمز تازه</label>
        <input class="login-inp" id="pwNew" type="password" autocomplete="new-password" placeholder="حداقل ۸ کاراکتر">
        <label class="login-field-label" for="pwNew2">تکرار رمز تازه</label>
        <input class="login-inp" id="pwNew2" type="password" autocomplete="new-password" placeholder="دوباره وارد کن">
        <button class="btn btn-primary btn-block" id="pwSaveBtn" onclick="submitPasswordChange()">تغییر رمز</button>
      </div>
    </div>`+`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">کارکنان</div><div class="panel-sub">${fa(STAFF_LIST.length)} نفر · مدیریت دسترسی</div></div></div>
      ${STAFF_LIST.map(s=>`<div class="staff-row">
        <div class="staff-ava">${esc(avatar(s))}</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(s.name||toFaDigits(s.phone||''))}</div><div style="font-size:12px;color:var(--t2)">${esc(toFaDigits(s.phone||''))}</div></div>
        <span class="role-tag ${esc(s.role)}">${esc(ROLE_FA[s.role]||s.role)}</span>
        ${s.role==='owner'?'<span style="font-size:11px;color:var(--t3);padding:6px 10px">دسترسی کامل</span>':`<button class="btn btn-ghost btn-sm" onclick="openPermEditor(${jsq(s.id)})">دسترسی</button>`}
      </div>`).join('')}
    </div>
    <div class="panel" style="font-size:12px;color:var(--t2);line-height:1.7">
      ${icon('info',{size:13})} مالک به‌صورت خودکار همه‌ی دسترسی‌ها را دارد. برای بقیه‌ی کارکنان، با دکمه‌ی «دسترسی» می‌توانید دقیقاً مشخص کنید هر نفر به کدام بخش‌ها دسترسی داشته باشد.
    </div>`;
}

// ── ویرایشگر واقعی دسترسی (وصل به PATCH /restaurant/staff) ──
function openPermEditor(staffId){
  const s=STAFF_LIST.find(x=>x.id===staffId); if(!s) return;
  const p=s.permissions||{};
  openModal(`
    <div class="modal-title">دسترسی‌های ${esc(s.name||toFaDigits(s.phone||''))}</div>
    <div class="modal-sub">مشخص کن به کدام بخش‌ها دسترسی داشته باشد</div>
    <div style="margin-top:14px;max-height:340px;overflow-y:auto">
      ${PERM_DEFS.map(([k,label])=>`
        <label style="display:flex;align-items:center;justify-content:space-between;padding:11px 4px;border-bottom:1px solid var(--border);cursor:pointer">
          <span style="font-size:13px">${label}</span>
          <input type="checkbox" data-perm="${k}" ${p[k]?'checked':''} style="width:18px;height:18px;accent-color:var(--blue)">
        </label>`).join('')}
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="savePermEditor(${jsq(staffId)})">ذخیره</button>
      <button class="btn btn-ghost" onclick="closeModal()">انصراف</button>
    </div>`);
}
async function savePermEditor(staffId){
  const perms={};
  document.querySelectorAll('#modalBody input[data-perm]').forEach(c=>{ perms[c.dataset.perm]=c.checked; });
  if(!API.getToken()){ // دمو
    const s=STAFF_LIST.find(x=>x.id===staffId); if(s) s.permissions=perms;
    closeModal(); toast('','دسترسی‌ها ذخیره شد (دمو)'); rStaff(); return;
  }
  const res=await API.staffUpdate({ staff_id:staffId, permissions:perms });
  if(res.ok){
    const s=STAFF_LIST.find(x=>x.id===staffId); if(s) s.permissions=perms;
    closeModal(); toast('','دسترسی‌ها در سرور ذخیره شد'); rStaff();
  }else{
    toast('', res.error?.message||'خطا در ذخیره‌ی دسترسی');
  }
}
// ═══════════ MODAL + TOAST + INIT ═══════════
// ── مودالِ قابلِ‌دسترس (WCAG 2.1.2 و 4.1.2) ──
// پیش‌تر مودال فقط با کلیک بسته می‌شد: کاربرِ کیبورد گیر می‌کرد، focus پشتِ
// overlay می‌ماند، و screen-reader نمی‌فهمید دیالوگی باز شده است.
let _modalLastFocus = null;
function openModal(html){
  _modalLastFocus = document.activeElement;
  document.getElementById('modalBody').innerHTML = html;
  const bg = document.getElementById('modalBg');
  bg.classList.add('show');
  bg.setAttribute('aria-hidden','false');
  // focus را به اولین عنصرِ تعاملیِ داخلِ مودال ببر (یا خودِ مودال).
  const body = document.getElementById('modalBody');
  const first = body.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (first || body).focus?.();
  // صفحه‌ی پشتی نباید زیرِ مودال اسکرول بخورد (رویِ موبایل کاربر با یک
  // کشیدنِ انگشت، زمینه را جابه‌جا می‌کرد و بعد از بستن گم می‌شد).
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  const bg = document.getElementById('modalBg');
  bg.classList.remove('show');
  bg.setAttribute('aria-hidden','true');
  // focus را به عنصری که مودال را باز کرده بود برگردان.
  document.body.style.overflow = '';
  if (_modalLastFocus && document.contains(_modalLastFocus)) _modalLastFocus.focus?.();
  _modalLastFocus = null;
}
// Esc مودالِ باز را می‌بندد + focus-trap با Tab داخلِ مودال می‌ماند.
document.addEventListener('keydown', e => {
  const bg = document.getElementById('modalBg');
  if (!bg || !bg.classList.contains('show')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
  if (e.key !== 'Tab') return;
  const items = [...document.getElementById('modalBody')
    .querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
let tt;
function toast(icon,msg){document.getElementById('toastIcon').textContent=icon;document.getElementById('toastMsg').textContent=msg;const t=document.getElementById('toast');t.classList.add('show');t.classList.remove('toast-enter');void t.offsetWidth;t.classList.add('toast-enter');const live=document.getElementById('a11y-live');if(live)live.textContent=msg;clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400)}

// ═══════════ NOTIFICATIONS ═══════════
// ⚠️ رفعِ باگ (همان الگویِ RES/GUESTS): این ۴ آیتم قبلاً هاردکد بودند —
// «پارسا تهرانی رزرو کرد»، «نیلوفر رضایی ۵ ستاره داد»، … — برایِ هر
// رستورانِ واقعی، همیشه همین‌ها. NOTIFS_DEMO فقط fallbackِ آفلاین است
// (هم‌الگو با WL_DEMO_QUEUE/RES_DEMO/GUESTS_DEMO)؛ NOTIFS با
// loadNotifications از /restaurant/notifications واقعی پر می‌شود.
const NOTIFS_DEMO=[
  {ic:'green',emoji:'checkCircle',title:'رزرو جدید',text:'پارسا تهرانی برای امشب ساعت ۲۱:۳۰ میز رزرو کرد',time:'۲ دقیقه پیش',unread:true},
  {ic:'amber',emoji:'alert',title:'هشدار ریزش',text:'مریم احمدی ۳۵ روزه نیومده — ریسک ریزش ۸۲٪',time:'۱ ساعت پیش',unread:true},
  {ic:'blue',emoji:'star',title:'نظر جدید',text:'نیلوفر رضایی ۵ ستاره داد: «عالی بود، حتماً برمی‌گردم»',time:'۳ ساعت پیش',unread:true},
  {ic:'green',emoji:'refresh',title:'مشتری بازگشتی',text:'نیلوفر رضایی بعد از ۲ هفته دوباره رزرو کرد',time:'دیروز',unread:false},
];
let NOTIFS=NOTIFS_DEMO.slice();
let _notifsLoaded=false;
/** فعالیتِ اخیرِ واقعی را می‌گیرد و NOTIFS را جایگزین می‌کند (خالی اگر فعالیتی نبود). */
async function loadNotifications(){
  if(!API.getToken()) return false;
  const res=await API.recentActivity();
  if(res.ok && Array.isArray(res.data?.items)){
    NOTIFS=res.data.items.map(n=>({ic:n.ic, emoji:n.emoji, title:n.title, text:n.text, time:faRelative(n.at), unread:false}));
    _notifsLoaded=true;
    return true;
  }
  // ⚠️ رفعِ باگ (یافته‌ی ریویوی Copilot): این endpoint حالا پشتِ
  // canViewAnalytics است؛ کارمندی که این مجوز را ندارد همیشه ۴۰۳ می‌گیرد.
  // اگر همینجا false برگردانیم و NOTIFS دست‌نخورده بماند، همان باگِ اصلیِ
  // این PR برایِ همین زیرمجموعه از کاربران دوباره زنده می‌شود: NOTIFS_DEMو
  // برای همیشه به‌جایِ دیتایِ واقعی نشان داده می‌شود. ۴۰۳ یعنی «قطعاً و
  // برایِ همیشه صلاحیت نداری»، نه یک خطایِ موقت — پس فوراً خالی کن و
  // دیگر تلاش نکن (نه دیتایِ ساختگی، نه تلاشِ بی‌فایده‌ی هر رفرش).
  if(res.status===403){
    NOTIFS=[];
    _notifsLoaded=true;
    return true;
  }
  return false;
}
function renderNotifList(){
  const el=document.getElementById('notifList');
  const unread=NOTIFS.filter(n=>n.unread).length;
  document.getElementById('notifPing').style.display=unread?'block':'none';
  if(!NOTIFS.length){el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${icon('bell',{size:32})}</div><div class="empty-state-desc">اعلانی نیست</div></div>`;return}
  // ⚠️ رفعِ باگ امنیتی (یافته‌ی ریویوی Copilot روی PR): title/text حالا از
  // نامِ مهمان/متنِ نظر (ورودیِ قابل‌کنترلِ کاربر) می‌آیند، نه رشته‌ی هاردکد
  // مثلِ قبل — بدونِ esc اینجا یک stored XSS واقعی در پنلِ کارکنان بود.
  el.innerHTML=NOTIFS.map((n,i)=>`<div class="notif-item ${n.unread?'unread':''}" onclick="readNotif(${i})">
    ${n.unread?'<span class="notif-dot"></span>':''}
    <div class="notif-ic ${esc(n.ic)}">${icon(n.emoji,{size:16})}</div>
    <div class="notif-body"><div class="notif-title">${esc(n.title)}</div><div class="notif-text">${esc(n.text)}</div><div class="notif-time">${esc(n.time)}</div></div>
  </div>`).join('');
}
function toggleNotif(e){
  e&&e.stopPropagation();
  const pop=document.getElementById('notifPop');
  const open=pop.classList.toggle('show');
  document.querySelector('.tb-icon')?.setAttribute('aria-expanded', String(open));
}
function readNotif(i){NOTIFS[i].unread=false;renderNotifList()}
function clearNotif(){NOTIFS.forEach(n=>n.unread=false);renderNotifList();toast('','همه خوانده شد')}
document.addEventListener('click',e=>{
  const pop=document.getElementById('notifPop');
  if(pop&&!pop.contains(e.target)&&!e.target.closest('.tb-icon')){
    pop.classList.remove('show');
    document.querySelector('.tb-icon')?.setAttribute('aria-expanded','false');
  }
});
function popup(iconName,title,text){
  document.getElementById('popupIc').innerHTML=iconName?icon(iconName,{size:18}):'';
  document.getElementById('popupTitle').textContent=title;
  document.getElementById('popupText').textContent=text;
  const p=document.getElementById('popup');p.classList.add('show');
  clearTimeout(p._t);p._t=setTimeout(()=>p.classList.remove('show'),4200);
}
function pushNotif(n){NOTIFS.unshift(n);renderNotifList();popup(n.emoji,n.title,n.text)}


// ═══════════ CASHBACK ═══════════
let CB={base:8,pre:12,vip:18,wb:20};
let CB_DRAFT={...CB};
let _cbLoaded=false;
async function rCashback(){
  if(!_cbLoaded && API.getToken()){
    const res=await API.get('/restaurant/cashback');
    if(res.ok){ CB={base:res.data.base_pct,pre:res.data.preorder_pct,vip:res.data.vip_pct,wb:res.data.winback_pct}; _cbLoaded=true; }
    else {
      // مهم: در حالتِ آنلاین هرگز مقادیرِ پیش‌فرض را به‌جای تنظیماتِ واقعی نشان نده.
      // پیش‌تر خطا (از جمله ۴۰۳ مجوز) بی‌صدا بلعیده می‌شد و پنل درصدهای ساختگی
      // را به‌عنوان تنظیماتِ رستوران نمایش می‌داد — مبنای تصمیمِ مالیِ غلط.
      document.getElementById('v-cashback').innerHTML=`
        <div class="error-state">
          <div class="error-state-icon">${icon('alert',{size:40})}</div>
          <div class="empty-state-title">تنظیمات کش‌بک بارگذاری نشد</div>
          <div class="empty-state-desc">${esc(res.error?.message||'ارتباط با سرور برقرار نشد')}</div>
          <button class="btn btn-primary" onclick="_cbLoaded=false;rCashback()">${icon('refresh',{size:16})} تلاش دوباره</button>
        </div>`;
      return;
    }
  }
  CB_DRAFT={...CB};
  const cards=[['base','کش‌بک پایه','برای تمام رزروها',20],['pre','پیش‌سفارش','رزرو همراه با منو',25],['vip','مشتری VIP','اعضای سطح طلایی و بالاتر',30],['wb','بازگشت (Winback)','مشتری ناراضی یا در خطر ریزش',40]];
  document.getElementById('v-cashback').innerHTML=`
    <div class="section-head"><div><div class="section-title">تنظیم درصد کش‌بک</div><div class="section-sub">درصدها بعد از تأیید برای همه‌ی مشتریان اعمال می‌شن</div></div></div>
    <div class="cb-dirty" id="cbDirty">${icon('alert',{size:13})} تغییرات هنوز ذخیره نشده — برای اعمال، تأیید کن</div>
    <div class="cb-sliders">
      ${cards.map(([k,n,d,mx])=>`<div class="cb-slider-card"><div class="cb-slider-top"><div class="cb-slider-name">${n}</div><div class="cb-slider-pct" id="cbVal-${k}">${fa(CB[k])}٪</div></div><div class="cb-slider-desc">${d}</div><input type="range" class="cb-range" min="0" max="${mx}" value="${CB[k]}" oninput="cbChange(${jsq(k)},this.value)"></div>`).join('')}
    </div>
    <div class="cb-preview">
      <div class="cb-prev-label">پیش‌نمایش از دید مشتری</div>
      <div class="cb-prev-row"><span>رزرو معمولی</span><b id="pv-base">${fa(CB.base)}٪</b></div>
      <div class="cb-prev-row"><span>با پیش‌سفارش</span><b id="pv-pre">${fa(CB.pre)}٪</b></div>
      <div class="cb-prev-row"><span>مشتری VIP</span><b id="pv-vip">${fa(CB.vip)}٪</b></div>
      <div class="cb-prev-row"><span>بازگشت</span><b id="pv-wb">${fa(CB.wb)}٪</b></div>
    </div>
    <button class="btn btn-primary btn-block" id="cbSave" style="margin-top:16px;opacity:.5;pointer-events:none" onclick="cbConfirm()">تأیید و اعمال تغییرات</button>`;
}
// ═══ قیمت‌گذاری هوشمند (AI Pricing) ═══
let PRICE_STATE={rules:[],base:0,suggestions:[],hasData:false};
async function rPricing(){
  // پیش‌فرض نمونه (وقتی API نیست) — تا پنل بدون بک‌اند هم دمو داشته باشد
  let P={base:0,rules:[],suggestions:[
    {label:'شب‌های آخر هفته',dows:[4,5],from:'19:00',to:'23:00',min_toman:650000,occupancy_pct:88,
     reason:'پنجشنبه و جمعه شب‌ها شلوغ‌ترین زمانِ شماست؛ حداقل مبلغِ بالاتر، تقاضای بالا را متعادل می‌کند و درآمد هر میز را افزایش می‌دهد.'},
    {label:'شب‌های وسطِ هفته',dows:[0,1,2,3,6],from:'19:00',to:'22:30',min_toman:400000,occupancy_pct:55,
     reason:'شب‌های وسطِ هفته تقاضای متوسطی دارند؛ حداقل مبلغِ پایه تعادلِ خوبی بین پر شدنِ میزها و درآمد ایجاد می‌کند.'},
    {label:'ناهارِ وسطِ هفته (خلوت)',dows:[0,1,2,3,6],from:'12:00',to:'15:00',min_toman:200000,occupancy_pct:22,
     reason:'این بازه خلوت است؛ حداقل مبلغِ پایین‌تر مشتری‌های حساس به قیمت را جذب می‌کند و میزهای خالی را پر می‌کند — درآمدِ اضافه از ظرفیتِ بلااستفاده.'}
  ],hasData:false};
  if(API.getToken()){
    const res=await API.get('/restaurant/pricing');
    if(res.ok && res.data){
      API.online=true;
      P={base:res.data.base_min_spend_toman||0,rules:res.data.current_rules||[],
         suggestions:res.data.suggestions||[],hasData:!!res.data.has_data};
    } else { API.online=false; }
  }
  PRICE_STATE=P;
  const toman=n=>fa(Math.round(n/1000).toLocaleString('en-US'))+'هزار';
  const occColor=p=>p>=70?'linear-gradient(90deg,#F97316,#EF4444)':p>=45?'linear-gradient(90deg,#6A4BFF,#B23BFF)':'linear-gradient(90deg,#60A5FA,#3B82F6)';
  const dowLbl=['ی','د','س','چ','پ','ج','ش'];
  const sugCard=(s,i)=>{
    const hot=s.occupancy_pct>=70, cold=s.occupancy_pct<40;
    const tag=hot?`<span class="pr-tag hot">${icon('flame',{size:11,fill:true})} شلوغ‌ترین</span>`:cold?`<span class="pr-tag cold">${icon('chevronD',{size:11})} خلوت</span>`:'';
    const dir=cold?`<span class="pr-down">${icon('chevronD',{size:12})}</span>`:`<span class="pr-up">${icon('trending',{size:12})}</span>`;
    // ⚠️ رفعِ ایمنی (بازبینیِ XSS، ۲۰۲۶-۰۸-۱۴): label/reason/from/to از API میان
    // (P.suggestions=res.data.suggestions) — امروز بک‌اند فقط رشته‌هایِ ثابتِ
    // فارسی می‌سازه (هیچ‌جا ورودیِ کاربر نیست)، ولی چون از سرور می‌آد و این
    // مستقیم innerHTML می‌شه، طبقِ همون قاعده‌ی esc() که بقیه‌ی sinkهایِ API
    // رعایت می‌کنن این‌جا هم اعمال شد — دفاعِ لایه‌دوم، نه رفعِ یک باگِ فعلاً واقعی.
    const daysTxt=(s.dows||[]).map(d=>dowLbl[d]).join('،')+` · ${esc(s.from)}–${esc(s.to)}`;
    return `<div class="pr-sug">${tag}
      <div class="pr-sug-top"><div><div class="pr-sug-label">${esc(s.label)}</div><div class="pr-sug-days">${daysTxt}</div></div>
        <div class="pr-sug-amt"><div class="pr-sug-amt-v">${toman(s.min_toman)}</div><div class="pr-sug-amt-l">حداقل مبلغ ${dir}</div></div></div>
      <div class="pr-occ"><span style="font-size:11px;color:var(--t3);font-weight:700;white-space:nowrap" title="میانگینِ رزروِ این بازه نسبت به شلوغ‌ترین ساعتِ رستوران — نه درصدِ اشغالِ ظرفیت">شلوغیِ نسبی</span><div class="pr-occ-track"><div class="pr-occ-fill" style="width:${s.occupancy_pct}%;background:${occColor(s.occupancy_pct)}"></div></div><span class="pr-occ-pct">${fa(s.occupancy_pct)}٪</span></div>
      <div class="pr-reason">${icon('message',{size:13})} ${esc(s.reason)}</div>
      <div class="pr-actions"><button class="btn btn-primary" style="flex:1" id="prAcc-${i}" onclick="pricingAccept(${i})">${icon('check',{size:14})} قبول این پیشنهاد</button></div>
    </div>`;
  };
  document.getElementById('v-pricing').innerHTML=`
    <div class="section-head"><div><div class="section-title">قیمت‌گذاری هوشمند</div><div class="section-sub">پیشنهادِ حداقل مبلغِ رزرو بر اساس شلوغیِ واقعیِ رستورانت</div></div></div>
    ${dataSourceNote()}
    <div class="pr-banner"><h3>${icon('sparkle',{size:16,fill:true})} پیشنهاد بر اساس داده‌ی شما</h3><p>${
      // ⚠️ سه حالتِ جدا (۲۰۲۶-۰۸-۲۰): قبلاً فقط دو حالت بود و شرطش `P.hasData`
      // بود، یعنی رستورانی با چند رزروِ معدود جمله‌ی «این پیشنهادها از الگویِ
      // خودت ساخته شدن» را می‌دید در حالی که بک‌اند (زیرِ MIN_OBSERVATIONS)
      // اصلاً پیشنهادی نساخته بود — و دنباله‌ی «هر کدوم رو می‌تونی قبول کنی»
      // به چیزی اشاره می‌کرد که وجود نداشت.
      !P.suggestions.length
        ? 'هنوز داده‌ی کافی برای الگوگیری نیست. با ثبتِ رزروِ بیشتر، پیشنهادها از شلوغیِ واقعیِ خودت ساخته می‌شن.'
        : (P.hasData
            ? 'این پیشنهادها از الگوی شلوغیِ ۹۰ روز اخیرِ خودت ساخته شدن — نه حدس. هر کدوم رو می‌تونی قبول کنی. کنترل کاملش دستِ توئه.'
            : 'این‌ها پیشنهادِ نمونه‌ست (بک‌اند متصل نیست). هر کدوم رو می‌تونی قبول کنی. کنترل کاملش دستِ توئه.')
    }</p></div>
    <div id="prSugs">${(P.suggestions.length?P.suggestions:[]).map(sugCard).join('')||'<div class="pr-empty">فعلاً پیشنهادی نیست. با ثبت رزروِ بیشتر، سیستم الگوها رو پیدا می‌کنه.</div>'}</div>
    ${P.rules.length?`<div class="pr-active"><div class="pr-active-h">${icon('check',{size:13})} قواعدِ فعالِ فعلی</div>${P.rules.map(r=>`<div class="pr-active-row"><span>${esc(r.label||((r.dows||[]).map(d=>dowLbl[d]).join('،')))}</span><b>${toman(r.min_toman)} تومان</b></div>`).join('')}</div>`:''}
    <div class="pr-note">${icon('info',{size:13})} رقبا مثل SevenRooms این رو «قیمت‌گذاری پویا» می‌گن و بابتش پول می‌گیرن. با یه نگاه می‌بینی کجا پول از دست می‌دی (میز خالی) و کجا می‌تونی بیشتر دربیاری (شب شلوغ).</div>`;
}
function pricingAccept(i){
  const s=PRICE_STATE.suggestions[i]; if(!s) return;
  // به قواعدِ فعال اضافه کن (بدونِ تکرارِ همان بازه)
  const exists=PRICE_STATE.rules.some(r=>r.from===s.from&&r.to===s.to&&JSON.stringify(r.dows)===JSON.stringify(s.dows));
  if(!exists) PRICE_STATE.rules.push({dows:s.dows,from:s.from,to:s.to,min_toman:s.min_toman,label:s.label});
  const btn=document.getElementById('prAcc-'+i); if(btn){btn.textContent='اعمال شد';btn.classList.add('pr-done');}
  if(navigator.vibrate)navigator.vibrate(12);
  pricingSave();
}
async function pricingSave(){
  if(!API.getToken()){ toast&&toast('','پیش‌نمایش: در حالت واقعی ذخیره می‌شود'); return; }
  const res=await API.request('/restaurant/pricing',{method:'PUT',body:JSON.stringify({rules:PRICE_STATE.rules,base_min_spend_toman:PRICE_STATE.base})});
  if(res.ok){ toast&&toast('','قواعد قیمت ذخیره شد'); }
  else { toast&&toast('', res.error?.message||'ذخیره‌ی قواعد قیمت ناموفق بود'); }
}
function cbChange(k,v){
  CB_DRAFT[k]=+v;
  document.getElementById('cbVal-'+k).textContent=fa(+v)+'٪';
  document.getElementById('pv-'+k).textContent=fa(+v)+'٪';
  const dirty=JSON.stringify(CB)!==JSON.stringify(CB_DRAFT);
  document.getElementById('cbDirty').classList.toggle('show',dirty);
  const btn=document.getElementById('cbSave');
  btn.style.opacity=dirty?'1':'.5';btn.style.pointerEvents=dirty?'auto':'none';
}
function cbConfirm(){
  openModal(`<div style="text-align:center">
      <div style="width:64px;height:64px;border-radius:16px;background:var(--blue-50);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--success)">${icon('wallet',{size:30})}</div>
      <div class="modal-title" style="text-align:center">از تغییر کش‌بک مطمئنی؟</div>
      <div class="modal-sub" style="text-align:center">این درصدها بلافاصله برای همه‌ی مشتریان اعمال و در اپ مشتری نمایش داده می‌شه.</div>
      <div class="cb-preview" style="text-align:right;margin-bottom:18px">
        <div class="cb-prev-row"><span>کش‌بک پایه</span><b>${fa(CB_DRAFT.base)}٪</b></div>
        <div class="cb-prev-row"><span>پیش‌سفارش</span><b>${fa(CB_DRAFT.pre)}٪</b></div>
        <div class="cb-prev-row"><span>VIP</span><b>${fa(CB_DRAFT.vip)}٪</b></div>
        <div class="cb-prev-row"><span>بازگشت</span><b>${fa(CB_DRAFT.wb)}٪</b></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="cbApply()">بله، اعمال کن</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
    </div>`);
}
// ⚠️ رفعِ جعلِ موفقیت (فازِ ۲، پروتکل §۳).
//
// باگ: CB **قبل از** درخواست بازنویسی می‌شد، بنرِ dirty پاک و دکمه‌ی ذخیره
// قفل می‌شد، و pushNotif «کش‌بک به‌روز شد» بدونِ قید اجرا می‌شد — حتی وقتی
// سرور PATCH را رد کرده بود. چون _cbLoaded هم ریست نمی‌شد، rCashback دیگر از
// سرور نمی‌خواند و اسلایدرها تا پایانِ نشست همان عددِ ردشده را نشان می‌دادند.
// نتیجه: مالک باور می‌کرد کش‌بکِ جدید فعال است در حالی که سرور مقدارِ قبلی را
// داشت — دقیقاً همان «مبنایِ تصمیمِ مالیِ غلط» که خودِ این فایل چند خط بالاتر
// درباره‌اش هشدار می‌دهد.
//
// حالا: تعهد فقط پس از تأییدِ سرور. در شکست هیچ چیزی commit نمی‌شود، بنرِ
// dirty می‌ماند، و _cbLoaded ریست می‌شود تا رندرِ بعدی حتماً حقیقتِ سرور را
// دوباره بخواند.
async function cbApply(){
  closeModal();
  const btn=document.getElementById('cbSave');
  const lock=()=>{ if(btn){btn.style.opacity='.5';btn.style.pointerEvents='none';} };
  const unlock=()=>{ if(btn){btn.style.opacity='';btn.style.pointerEvents='';} };
  const commit=()=>{
    CB={...CB_DRAFT};
    document.getElementById('cbDirty')?.classList.remove('show');
    lock();
    pushNotif({ic:'blue',emoji:'wallet',title:'کش‌بک به‌روز شد',text:`کش‌بک پایه به ${fa(CB.base)}٪ تغییر کرد`,time:'همین الان',unread:true});
  };
  if(API.getToken()){
    lock();
    const res=await API.patch('/restaurant/cashback',{
      base_pct:CB_DRAFT.base, preorder_pct:CB_DRAFT.pre, vip_pct:CB_DRAFT.vip, winback_pct:CB_DRAFT.wb,
    });
    if(res.ok){
      commit();
      toast('','کش‌بک در سرور ذخیره شد');
    } else if(res.offline){
      // آفلاین: تغییر محلی می‌ماند ولی صریحاً «هنوز ذخیره نشده» اعلام می‌شود.
      commit();
      toast('','آفلاین — کش‌بک هنوز در سرور ذخیره نشده');
    } else {
      // شکستِ واقعیِ سرور: نه commit، نه اعلانِ موفقیت.
      _cbLoaded=false;
      unlock();
      toast('',res.error?.message||'ذخیره‌ی کش‌بک ناموفق بود — تغییری اعمال نشد');
      rCashback();
    }
  } else {
    commit();
    toast('','درصدهای کش‌بک اعمال شد');
  }
}

// ═══════════ ورود کارمند (فاز ۳ تکه ۷) ═══════════
let _staffPhone = '';
let STAFF_INFO = null;
function setStaffGateLocked(locked){
  const app = document.querySelector('.shell') || document.querySelector('.app');
  const overlay = document.getElementById('loginOverlay');
  if (app) {
    app.setAttribute('aria-hidden', locked ? 'true' : 'false');
    if ('inert' in app) app.inert = locked;
  }
  if (overlay) overlay.setAttribute('aria-hidden', locked ? 'false' : 'true');
}
// ⚠️ مسیرِ اصلیِ ورود از ۲۰۲۶-۰۸-۲۶ نام کاربری و رمز است، نه OTP.
// دلیل: بدونِ KAVENEGAR_API_KEY هیچ پیامکی نمی‌رفت و هیچ‌کس نمی‌توانست
// وارد پنل شود. OTP حذف نشد و به‌عنوانِ مسیرِ پشتیبان می‌ماند.
function showStaffLogin(){
  setStaffGateLocked(true);
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">${icon('utensils',{size:34})}</div>
    <div class="login-title">پنل رستوران رزرونو</div>
    <div class="login-sub">با نام کاربری و رمزی که از رزرونو گرفتی وارد شو</div>
    <label class="login-field-label" for="staffUser">نام کاربری</label>
    <input class="login-inp" id="staffUser" autocomplete="username" spellcheck="false" placeholder="نام کاربری" onkeydown="if(event.key==='Enter')document.getElementById('staffPass')?.focus()">
    <label class="login-field-label" for="staffPass">رمز عبور</label>
    <input class="login-inp" id="staffPass" type="password" autocomplete="current-password" placeholder="رمز عبور" onkeydown="if(event.key==='Enter')staffPasswordLogin()">
    <button class="login-btn" id="staffLoginBtn" onclick="staffPasswordLogin()">ورود به پنل</button>
    <button class="login-back" id="staffSmsLoginBtn" onclick="showStaffLoginPhone()">ورود با پیامک</button>
    <div class="login-foot">اگر نام کاربری نداری، با پشتیبانی رزرونو تماس بگیر</div>`;
  setTimeout(()=>document.getElementById('staffUser')?.focus(),200);
}

/** اطلاعاتِ کارمند در حالتِ دمو/آفلاین — همان شکلی که مسیرِ OTP می‌سازد. */
const DEMO_STAFF_INFO = { role:'owner', restaurant_name:'کافه‌رستوران ویستا' };

async function staffPasswordLogin(){
  const u = (document.getElementById('staffUser')?.value||'').trim();
  const p = document.getElementById('staffPass')?.value||'';
  if (!u || !p) { toast('','نام کاربری و رمز را وارد کن'); return; }
  const btn = document.getElementById('staffLoginBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال بررسی...'; }
  const reset = () => { if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; } };

  // ⚠️ باگِ P0 که با اسپکِ e2eِ تازه گرفته شد (۲۰۲۶-۰۸-۲۶): این سه خط
  // `enterStaffPanel()` را صدا می‌زدند — تابعی که **در این اپ وجود ندارد**.
  // نامِ واقعی `enterPanel` است (پایینِ همین فایل). یعنی ورودِ رمز — که از
  // مهاجرتِ ۰۷۴ فرمِ *پیش‌فرضِ* این پنل است — با ReferenceError می‌مرد: توکن
  // ذخیره می‌شد ولی overlay هرگز بسته نمی‌شد و کاربر گیر می‌کرد.
  // هر ۹ جابِ CI سبز بود چون هیچ اسپکی این مسیر را درایو نمی‌کرد.
  if (location.protocol === 'file:') { STAFF_INFO = DEMO_STAFF_INFO; enterPanel(true); return; }

  const res = await API.staffLogin(u, p);
  if (res.ok && res.data?.access){
    // STAFF_INFO دقیقاً مثلِ مسیرِ OTP ست می‌شود. بدونش منو و تاپ‌بار بدونِ
    // نقش و نامِ رستوران رندر می‌شدند — همان واگرایی‌ای که کامنتِ
    // `API.staffLogin` در data.js صریحاً منع می‌کند.
    STAFF_INFO = res.data.staff || STAFF_INFO;
    enterPanel();
    return;
  }
  if (res.offline){ STAFF_INFO = DEMO_STAFF_INFO; enterPanel(true); return; }
  // پیامِ سرور برای «کاربر نیست» و «رمز غلط» عمداً یکسان است؛ اینجا هم
  // نباید دقیق‌تر شود، وگرنه نشتی که سرور بست از سمتِ کلاینت باز می‌شود.
  toast('', res.error?.message || 'نام کاربری یا رمز عبور اشتباه است');
  reset();
}

function showStaffLoginPhone(){
  setStaffGateLocked(true);
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">${icon('utensils',{size:34})}</div>
    <div class="login-title">ورود با پیامک</div>
    <div class="login-sub">شماره موبایل ثبت‌شده‌ی رستورانت رو وارد کن</div>
    <label class="login-field-label" for="staffPhone">شماره موبایل</label>
    <input class="login-inp" id="staffPhone" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" onkeydown="if(event.key==='Enter')staffSendOtp()">
    <button class="login-btn" id="staffSendBtn" onclick="staffSendOtp()">ارسال کد ورود</button>
    <button class="login-back" onclick="showStaffLogin()">ورود با نام کاربری و رمز</button>
    <div class="login-foot">فقط شماره‌هایی که به‌عنوان مدیر یا کارمند ثبت شده‌اند دسترسی دارند</div>`;
  setTimeout(()=>document.getElementById('staffPhone')?.focus(),200);
}
async function staffSendOtp(){
  const el = document.getElementById('staffPhone');
  const phone = (el?.value||'').trim();
  const normalized = phone.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  if (!/^09\d{9}$/.test(normalized)) { toast('','شماره موبایل معتبر وارد کن'); return; }
  _staffPhone = normalized;
  const btn = document.getElementById('staffSendBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال ارسال...'; }
  if (location.protocol === 'file:') {
    showStaffLoginCode('۱۲۳۴', true);
    return;
  }
  const res = await API.requestStaffOtp(normalized);
  if (!res.ok && !res.offline){
    // خطای واقعی (مثلاً شماره staff نیست)
    toast('', res.error?.message || 'این شماره دسترسی ندارد');
    if (btn){ btn.disabled = false; btn.textContent = 'ارسال کد ورود'; }
    return;
  }
  const devCode = res.data?.devCode || (res.offline ? '۱۲۳۴' : null);
  showStaffLoginCode(devCode, res.offline);
}
function showStaffLoginCode(devCode, offline){
  setStaffGateLocked(true);
  // ⚠️ escapeِ صریح (۲۰۲۶-۰۸-۲۷): `toFaDigits` فقط ارقامِ ASCII را نگاشت می‌کند و
  // هر چیزِ دیگری را دست‌نخورده رد می‌کند، پس به‌تنهایی محافظ نیست. `devCode`
  // از **پاسخِ سرور** می‌آید و تنها sinkِ `unsafe`ِ این فایل بود که واقعاً دادهٔ
  // غیرثابت داشت (tools/xss-sink-audit.mjs).
  // ترتیب عمدی است: اول toFaDigits بعد esc — برعکسش `&#39;`ِ خروجیِ esc را هم
  // فارسی می‌کرد و خودِ entity را خراب می‌کرد.
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">${icon('mail',{size:34})}</div>
    <div class="login-title">کد ورود رو وارد کن</div>
    <div class="login-sub">کد ورود به شماره‌ی ${esc(toFaDigits(String(_staffPhone ?? '')))} ارسال شد</div>
    <label class="login-field-label" for="staffCode">کد ورود</label>
    <input class="login-inp code" id="staffCode" inputmode="numeric" maxlength="6" placeholder="······" onkeydown="if(event.key==='Enter')staffConfirmOtp()">
    <button class="login-btn" id="staffVerifyBtn" onclick="staffConfirmOtp()">ورود به پنل</button>
    <button class="login-back" onclick="showStaffLoginPhone()">تغییر شماره</button>
    ${devCode ? `<div class="login-hint">${offline?'حالت دمو (بک‌اند متصل نیست):':'حالت توسعه:'} کد ورود <b>${esc(toFaDigits(String(devCode)))}</b> است</div>` : ''}`;
  setTimeout(()=>document.getElementById('staffCode')?.focus(),200);
}
async function staffConfirmOtp(){
  const el = document.getElementById('staffCode');
  const code = (el?.value||'').trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (!/^\d{4,6}$/.test(code)) { toast('','کد ورود رو کامل وارد کن'); return; }
  const btn = document.getElementById('staffVerifyBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال بررسی...'; }
  if (location.protocol === 'file:') {
    if (code === '1234'){ STAFF_INFO = { role:'owner', restaurant_name:'کافه‌رستوران ویستا' }; enterPanel(true); }
    else { toast('','در حالت دمو، کد ۱۲۳۴ است'); if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; } }
    return;
  }
  const res = await API.verifyStaffOtp(_staffPhone, code);
  if (res.ok && res.data?.staff){
    STAFF_INFO = res.data.staff;
    enterPanel();
  } else if (res.offline){
    // حالت دمو: کد ۱۲۳۴
    if (code === '1234'){ STAFF_INFO = { role:'owner', restaurant_name:'کافه‌رستوران ویستا' }; enterPanel(true); }
    else { toast('','در حالت دمو، کد ۱۲۳۴ است'); if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; } }
  } else {
    toast('', res.error?.message || 'کد اشتباه است');
    if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; }
  }
}
/** تاریخِ تاپ‌بار — یک منبعِ واحد، از ساعتِ خودِ دستگاه. */
function setTopbarDate(){
  const el = document.getElementById('tbDate');
  if (el) el.textContent = new Date().toLocaleDateString('fa-IR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function enterPanel(demo){
  document.getElementById('loginOverlay').classList.add('hidden');
  setTopbarDate();
  setStaffGateLocked(false);
  // منو را با مجوزهای واقعیِ کاربر هم‌راستا کن — قبل از رندرِ هر صفحه.
  if (typeof applyPermissionsToNav === 'function') applyPermissionsToNav();
  renderNotifList();
  if(!_notifsLoaded && API.getToken() && !demo){ loadNotifications().then(ok=>{ if(ok) renderNotifList(); }); }
  rOverview();
  initLiveUpdates();
  if(API.getToken() && !demo){
    // ⚠️ رفعِ باگ: قبلاً فقط تبِ پلانِ سالن با اتمامِ loadTables دوباره رندر
    // می‌شد. یعنی اگر کاربر در داشبورد می‌ماند (رایج‌ترین حالت بعد از لاگین)
    // و loadTables دیرتر از renderEnterpriseDashboardِ اولیه تمام می‌شد،
    // KPIِ «اشغال فعلی» تا رفرشِ زنده‌ی بعدی (تا ۱۵ ثانیه) روی «۰/۰» می‌ماند
    // — نه به‌خاطرِ نبودِ میز، بلکه چون هنوز TABLES خالی بود.
    loadTables().then(()=>{
      if(document.getElementById('v-floor')?.classList.contains('active')) rFloor();
      if(document.getElementById('v-overview')?.classList.contains('active')) renderEnterpriseDashboard();
    });
    loadBranches();               // سوییچر شعبه را با داده‌ی واقعی پر کن
    Heartbeat.start();           // رستوران را در اپ مشتری آنلاین نگه می‌دارد
    Outbox.sync();               // اگر عملیات آفلاینِ در انتظار هست، همگام کن
  } else if(!TABLES.length){
    // حالت دمو — میزهای نمونه تا پلان سالن و KPI اشغال خالی نمانند
    TABLES = DEMO_TABLES.map(t=>({...t}));
    _tablesLoaded = true;
    rOverview();
  }
  toast('', `خوش اومدی${STAFF_INFO?.restaurant_name?' · '+STAFF_INFO.restaurant_name:''}`);
}
async function staffLogout(){
  Heartbeat.stop();                   // توقف heartbeat هنگام خروج
  await API.doLogout();               // باطل‌سازی سمت سرور + پاکسازی محلی
  STAFF_INFO = null;
  if (typeof applyPermissionsToNav === 'function') applyPermissionsToNav();  // بازگرداندنِ منو برای کاربرِ بعدی
  document.getElementById('loginOverlay').classList.remove('hidden');
  setStaffGateLocked(true);
  showStaffLogin();
  toast('','از پنل خارج شدی');
}
// نشست منقضی و تمدید هم جواب نداد → برگشت به صفحه‌ی ورود
function onStaffSessionExpired(){
  STAFF_INFO = null;
  document.getElementById('loginOverlay').classList.remove('hidden');
  setStaffGateLocked(true);
  showStaffLogin();
  toast('','نشست منقضی شد، دوباره وارد شو');
}

// init — نشست را از localStorage بازیابی کن، بعد ورود را چک کن
API.restoreSession();
Net.init();                    // فعال‌سازی تشخیص آنلاین/آفلاین + همگام‌سازی صف
Outbox._updateBadge();         // نمایش تعداد عملیات در انتظار (اگر از قبل هست)
if (API.getToken()) {
  // توکن ذخیره‌شده هست → مستقیم پنل (اگر منقضی باشد، اولین درخواست refresh می‌کند)
  document.getElementById('loginOverlay').classList.add('hidden');
  setStaffGateLocked(false);
  renderNotifList();
  // ⚠️ رفعِ باگ (ریویوی Copilot روی PR): این مسیرِ بازیابیِ نشست (رفرشِ
  // صفحه وقتی از قبل لاگین بودی) قبلاً loadNotifications را صدا نمی‌زد —
  // فقط enterPanel این کار را می‌کرد. یعنی با هر رفرشِ صفحه، اعلان‌های
  // دموی اولیه (NOTIFS_DEMO) برایِ همیشه به‌جایِ فعالیتِ واقعی می‌ماندند.
  if(!_notifsLoaded){ loadNotifications().then(ok=>{ if(ok) renderNotifList(); }); }
  rOverview();
  loadTables();
  loadBranches();               // سوییچر شعبه را با داده‌ی واقعی پر کن
  Heartbeat.start();           // شروع ارسال heartbeat (رستوران را در اپ مشتری آنلاین نگه می‌دارد)
} else {
  // نیاز به ورود
  setStaffGateLocked(true);
  showStaffLogin();
}
