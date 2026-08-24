// ═══ رزرونو — پنل business: داشبورد لیست انتظار (Vanilla JS، بدون build، scope مشترک) ═══
// داده‌ی دمو فقط fallbackِ آفلاین است (وقتی توکن نیست یا سرور در دسترس نیست)؛
// وقتی آنلاین باشیم، rWaitlist صف و آمار واقعی را از بک‌اند می‌گیرد.
const WL_DEMO_QUEUE=[
  {id:'w1',name:'سارا محمدی',phone:'۰۹۱۲۱۱۱۲۲۳۳',party_size:2,is_vip:true,status:'waiting',waited_minutes:8,estimated_wait_minutes:15,priority:100},
  {id:'w2',name:'علی رضایی',phone:'۰۹۱۲۲۲۲۳۳۴۴',party_size:4,is_vip:false,status:'waiting',waited_minutes:12,estimated_wait_minutes:30,priority:0},
  {id:'w3',name:'مریم کریمی',phone:'۰۹۱۲۳۳۳۴۴۵۵',party_size:3,is_vip:false,status:'waiting',waited_minutes:5,estimated_wait_minutes:35,priority:20},
];
const WL_DEMO_ANALYTICS={total_entries:142,seated:98,abandoned:31,conversion_rate:69,avg_wait_minutes:22,current_queue_size:3,vip_entries:18};
let WAITLIST=WL_DEMO_QUEUE.slice();
let WL_ANALYTICS={...WL_DEMO_ANALYTICS};
let _wlLoaded=false;

// بارگذاری صف + آمار واقعی از بک‌اند (موازی). در صورت خطا، fallback به دمو می‌ماند.
async function loadWaitlist(){
  if(!API.getToken()) return; // آفلاین/دمو → همان داده‌ی دمو
  const [q,a]=await Promise.all([API.waitlistQueue(),API.waitlistAnalytics()]);
  if(q.ok && Array.isArray(q.data?.queue)) WAITLIST=q.data.queue;
  if(a.ok && a.data) WL_ANALYTICS=a.data;
  _wlLoaded=true;
}

function rWaitlist(){
  // اولین ورود به صفحه با توکن → داده‌ی واقعی بگیر و دوباره رندر کن
  if(!_wlLoaded && API.getToken()){ loadWaitlist().then(()=>rWaitlist()); }
  const A=WL_ANALYTICS;
  const queue=WAITLIST.filter(w=>w.status==='waiting'||w.status==='offered');
  // ⚠️ رفعِ باگ: badgeِ سایدبارِ #wlBadge با اینکه id داشت هیچ‌جا آپدیت نمی‌شد —
  // همیشه مقدارِ استاتیکِ HTML («۳») می‌ماند حتی وقتی صفِ واقعی خالی بود
  // (با live-test پیدا شد). حالا با همان A.current_queue_sizeِ واقعی که
  // کارت‌های آمار هم استفاده می‌کنند پر می‌شود.
  const wlBadge = document.getElementById('wlBadge');
  if (wlBadge) wlBadge.textContent = queue.length > 0 ? fa(queue.length) : '';
  // ⚠️ رفعِ باگِ صداقتِ داده (یافته‌ی زنده، هم‌الگو با overview.js/reservations.js):
  // تا اینجا این تب هیچ‌وقت نمی‌گفت که صف/آمار الان دموست.
  const isDemo = !API.getToken() || !_wlLoaded;
  const wlDemoNote = isDemo ? `<div class="cash-note" style="margin-bottom:16px">${icon('info',{size:13})} صف و آمارِ زیر نمونه‌اند، دادهٔ واقعیِ رستورانت نیستند.</div>` : '';
  document.getElementById('v-waitlist').innerHTML=wlDemoNote+`
    <!-- آمار لیست انتظار -->
    <div class="wl-stats-grid">
      <div class="wl-stat"><div class="wl-stat-ic" style="background:var(--blue-50)">${icon('inbox',{size:16})}</div><div><div class="wl-stat-num">${fa(A.current_queue_size)}</div><div class="wl-stat-lbl">در صف الان</div></div></div>
      <div class="wl-stat"><div class="wl-stat-ic" style="background:var(--green-50)">${icon('check',{size:16})}</div><div><div class="wl-stat-num">${fa(A.conversion_rate)}٪</div><div class="wl-stat-lbl">نرخ تبدیل</div></div></div>
      <div class="wl-stat"><div class="wl-stat-ic" style="background:#FEF3C7">${icon('clock',{size:16})}</div><div><div class="wl-stat-num">${fa(A.avg_wait_minutes)}<span style="font-size:13px"> دق</span></div><div class="wl-stat-lbl">میانگین انتظار</div></div></div>
      <div class="wl-stat"><div class="wl-stat-ic" style="background:#Fce7f3">${icon('star',{size:16,fill:true})}</div><div><div class="wl-stat-num">${fa(A.vip_entries)}</div><div class="wl-stat-lbl">مهمان VIP</div></div></div>
    </div>

    <div class="wl-q-head">
      <div class="wl-q-title">صف انتظار <span class="wl-q-count">${fa(queue.length)} نفر</span></div>
      <button class="btn btn-primary btn-sm" onclick="promoteNextWL()">${icon('arrowR',{size:15})} آفر به نفر بعدی</button>
    </div>

    <div class="wl-queue">
      ${queue.length?queue.map((w,i)=>wlCard(w,i)).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:38})}</div><div class="empty-state-desc">صف خالی است</div></div>`}
    </div>`;
}
function wlCard(w,i){
  const isOffered=w.status==='offered';
  return `<div class="wl-card ${isOffered?'offered':''} ${w.is_vip?'vip':''}">
    <div class="wl-card-pos">${isOffered?icon('bell',{size:16}):fa(i+1)}</div>
    <div class="wl-card-body">
      <div class="wl-card-name">${esc(w.name)} ${w.is_vip?`<span class="wl-vip-tag">${icon('star',{size:11,fill:true})} VIP</span>`:''}</div>
      <div class="wl-card-meta">${icon('users',{size:13})} ${fa(w.party_size)} نفر · ${icon('clock',{size:13})} ${fa(w.waited_minutes)} دقیقه منتظر · تخمین ${fa(w.estimated_wait_minutes)} دقیقه</div>
      ${isOffered?'<div class="wl-card-offered">میز آفر شد — منتظر پاسخ</div>':''}
    </div>
    <div class="wl-card-actions">
      ${(!isOffered && i===0)?`<button class="btn btn-teal btn-sm" onclick="promoteNextWL()">آفر میز</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="removeWL('${w.id}')">حذف</button>
    </div>
  </div>`;
}
async function promoteNextWL(){
  const next=WAITLIST.filter(w=>w.status==='waiting').sort((a,b)=>(b.priority-a.priority)||0)[0];
  if(!next){toast('','صف خالی است');return;}
  // آنلاین → بک‌اند خودش نفر اول را انتخاب و میز تخصیص می‌دهد (منطق مرکزی promoteNext)
  if(!isOffline() && API.getToken()){
    const res=await API.waitlistPromoteNext();
    if(res.ok && res.data?.promoted){
      toast('',`میز به نفر بعدی آفر شد${res.data.table?` (میز ${fa(res.data.table)})`:''}`);
      await loadWaitlist(); rWaitlist();
      if(document.getElementById('v-overview')?.classList.contains('active')) renderEnterpriseDashboard();
    }else{
      toast('','میز آزادی برای آفر پیدا نشد');
    }
    return;
  }
  offerWLSeat(next.id);
}
// ⚠️ رفعِ «آفر به نفرِ اشتباه» (فازِ ۲، §۲۶–۲۹).
//
// باگ: این تابع `id` را فقط برایِ تغییرِ محلی و متنِ toast استفاده می‌کرد.
// درخواستِ واقعی `POST /restaurant/waitlist` **بدونِ بدنه** بود و بک‌اند
// (promoteNext) همیشه خودش سرِ صف را انتخاب می‌کند. یعنی وقتی میزبان رویِ
// نفرِ سوم کلیک می‌کرد، پیام می‌گفت «میز به {نفرِ سوم} آفر شد» ولی سرور میز
// را به نفرِ اول می‌داد — و یک رندر بعد، UI بی‌صدا جایشان را عوض می‌کرد.
//
// راهِ حل بدونِ endpointِ جدید: دکمه فقط رویِ نفرِ اولِ صف رندر می‌شود و همان
// promoteNextWL را صدا می‌زند (واژگانِ درست + بازخوانیِ حقیقتِ سرور). این تابع
// فقط برایِ مسیرِ آفلاین می‌ماند، جایی که هیچ ادعایِ سروری در کار نیست.
async function offerWLSeat(id){
  const w=WAITLIST.find(x=>x.id===id);if(!w)return;
  if(!isOffline() && API.getToken()){ return promoteNextWL(); }
  w.status='offered';
  rWaitlist();
  // اگر داشبورد فعال است، ستون لیست انتظار زنده را هم تازه کن
  if(document.getElementById('v-overview')?.classList.contains('active')) renderEnterpriseDashboard();
  if(isOffline() && API.getToken()){
    Outbox.enqueue({ type:'waitlist_offer', path:'/restaurant/waitlist', method:'POST', body:{ action:'offer', entry_id:id }, label:`آفر میز به ${w.name}` });
    toast('','آفلاین — آفر در صفِ ارسال قرار گرفت');
    return;
  }
  toast('',`میز به ${w.name} آفر شد`);
}
// ⚠️ رفعِ جعلِ موفقیت (فازِ ۲، §۳).
//
// باگ: این تابع فقط آرایه‌ی محلی را فیلتر می‌کرد و «از صف حذف شد» می‌گفت —
// هیچ درخواستی به سرور نمی‌رفت و هیچ مسیرِ سروری‌ای هم وجود نداشت. ورودی روی
// سرور waiting می‌ماند، در بازخوانیِ بعدی برمی‌گشت، و promoteNext می‌توانست
// برایِ مهمانی که رفته بود میز نگه دارد.
//
// حالا به DELETE /restaurant/waitlist وصل است — که خودش leaveWaitlistِ
// *موجود* را صدا می‌زند (آزادکردنِ میزِ آفرشده + ترفیعِ نفرِ بعدی). قابلیت
// ساخته نشد، فقط وصل شد.
async function removeWL(id){
  const w=WAITLIST.find(x=>x.id===id);
  if(!confirm(`«${w?w.name:'این مهمان'}» از صف حذف بشه؟`)) return;
  if(!API.getToken()){
    WAITLIST=WAITLIST.filter(x=>x.id!==id); rWaitlist(); toast('','از صفِ نمونه حذف شد'); return;
  }
  const res=await API.waitlistRemove(id);
  if(!res.ok){ toast('',res.error?.message||'حذف از صف انجام نشد'); return; }
  await loadWaitlist(); rWaitlist();
  if(document.getElementById('v-overview')?.classList.contains('active')) renderEnterpriseDashboard();
  toast('','از صف حذف شد');
}
let _tablesLoaded=false;
async function rFloor(){
  if(!_tablesLoaded && API.getToken()){ await loadTables(); _tablesLoaded=true; }
  syncTablesFromReservations();
  // ⚠️ فازِ ۲ (§۶): cleaning/maintenance به شمارنده اضافه شدند. پیش از این
  // `occ[t.s]++` رویِ کلیدِ ناموجود NaN تولید می‌کرد و نرخِ اشغال را خراب می‌کرد.
  const occ={free:0,reserved:0,seated:0,cleaning:0,maintenance:0};
  TABLES.forEach(t=>{ if(occ[t.s]!==undefined) occ[t.s]++; });
  const total=TABLES.length||1;
  const occRate=Math.round(((occ.reserved+occ.seated)/total)*100);
  document.getElementById('v-floor').innerHTML=`
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">پلان لحظه‌ای سالن</div><div class="panel-sub">رزروهای امروز خودکار روی میزها اعمال شدن · روی میز بزن</div></div>
      </div>
      <div class="floor-toolbar">
        <div class="occ-stats">
          <div class="occ-pill"><span class="oc-dot" style="background:var(--green)"></span>آزاد <span class="oc-n">${fa(occ.free)}</span></div>
          <div class="occ-pill"><span class="oc-dot" style="background:var(--blue)"></span>رزرو <span class="oc-n">${fa(occ.reserved)}</span></div>
          <div class="occ-pill"><span class="oc-dot" style="background:var(--amber)"></span>نشسته <span class="oc-n">${fa(occ.seated)}</span></div>
          <div class="occ-pill" style="background:var(--s-900);color:#fff;border-color:var(--s-900)">اشغال <span class="oc-n">${fa(occRate)}٪</span></div>
        </div>
        <div class="floor-actions">
          <button class="btn btn-sm ${floorEdit?'btn-primary':'btn-ghost'}" onclick="toggleFloorEdit()">${floorEdit?`${icon('check',{size:14})} تمام`:`${icon('settings',{size:14})} ویرایش میزها`}</button>
        </div>
      </div>
      <div class="floor ${floorEdit?'edit-mode':''}">
        <div class="tables-area">
          ${TABLES.map((t,i)=>`<div class="table-el ${t.s}" ${floorEdit?'':'role="button" tabindex="0"'} onclick="${floorEdit?'':`openTableSheet(${i})`}">
            <button class="t-remove" onclick="event.stopPropagation();removeTable(${i})">×</button>
            <span class="t-icon">${icon('utensils',{size:15})}</span><span class="t-num">${esc(tableLabel(t))}</span>
            ${t._guest?`<span class="t-guest">${esc(t._guest.length>10?t._guest.slice(0,9)+'…':t._guest)}</span><span class="t-time">${t._time}</span>`:`<span class="t-cap">${fa(t.c)} نفره</span>`}
          </div>`).join('')}
          ${floorEdit?`<button class="add-table-el" onclick="addTable()"><span class="plus">+</span><span class="lbl">افزودن میز</span></button>`:''}
        </div>
      </div>
      ${floorEdit?`<div style="font-size:12px;color:var(--t2);margin-top:12px;text-align:center">در حالت ویرایش: + برای افزودن میز، × برای حذف. وقتی تمام شد روی «تمام» بزن.</div>`:''}
    </div>`;
}
let floorEdit=false;
function toggleFloorEdit(){floorEdit=!floorEdit;rFloor()}
// برچسب میز: اگر اسم دلخواه داشت اسم، وگرنه «میز {شماره}»
function tableLabel(t){ return t.name && t.name.trim() ? t.name.trim() : 'میز '+fa(t.n); }

// افزودن میز — با انتخاب ظرفیت و اسم دلخواه اختیاری
function addTable(){
  const nextNum=TABLES.length?Math.max(...TABLES.map(t=>t.n))+1:1;
  openModal(`
    <div class="modal-title">افزودن میز جدید</div>
    <div class="modal-sub">ظرفیت و (در صورت تمایل) یک اسم دلخواه بذار</div>
    <div class="field-label">تعداد نفرات</div>
    <div class="opt-row" id="capPick">
      ${[2,4,6,8,10].map((c,idx)=>`<div class="opt ${idx===1?'sel':''}" onclick="document.querySelectorAll('#capPick .opt').forEach(o=>o.classList.remove('sel'));this.classList.add('sel')" data-cap="${c}">${fa(c)} نفره</div>`).join('')}
    </div>
    <div class="field-label" style="margin-top:14px">اسم دلخواه <span style="color:var(--t3);font-weight:400">(اختیاری — مثل «میز پنجره»، «تراس»)</span></div>
    <input class="inp" id="newTableName" placeholder="میز ${fa(nextNum)}" style="width:100%">
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="confirmAddTable(${nextNum})">افزودن میز</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
  setTimeout(()=>document.getElementById('newTableName')?.focus(),150);
}
async function confirmAddTable(num){
  const cap=parseInt(document.querySelector('#capPick .opt.sel')?.dataset.cap||4);
  const name=(document.getElementById('newTableName')?.value||'').trim();
  const res = await API.createTable({ number: num, capacity: cap, name: name||undefined });
  if(!res.ok){ toast('', res.error?.message||'افزودن میز ناموفق بود'); return; }
  await loadTables();
  closeModal();rFloor();
  toast('',`${name||'میز '+fa(num)} (${fa(cap)} نفره) اضافه شد`);
}

// حذف میز — با تأیید + امکان بازگردانی
let lastRemoved=null;
function removeTable(i){
  const t=TABLES[i];
  if(t.s!=='free'){
    openModal(`
      <div style="text-align:center">
        <div style="width:56px;height:56px;border-radius:14px;background:var(--amber-50);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--warning)">${icon('alert',{size:26})}</div>
        <div class="modal-title" style="text-align:center">${esc(tableLabel(t))} ${t.s==='seated'?'مهمان نشسته داره':'رزرو داره'}</div>
        <div class="modal-sub" style="text-align:center">این میز خالی نیست. مطمئنی می‌خوای حذفش کنی؟</div>
        <button class="btn btn-danger btn-block" onclick="doRemoveTable(${i})">بله، حذف کن</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
      </div>`);
    return;
  }
  doRemoveTable(i);
}
async function doRemoveTable(i){
  const t=TABLES[i];
  const res = await API.deleteTable(t.id);
  if(!res.ok){ closeModal(); toast('', res.error?.message||'حذف ناموفق بود — احتمالاً رزرو فعال داره'); return; }
  lastRemoved={table:t,idx:i};
  await loadTables();
  closeModal();rFloor();
  toastUndo(`میز ${fa(lastRemoved.table.n)} حذف شد`,'undoRemoveTable');
}
async function undoRemoveTable(){
  if(!lastRemoved)return;
  const t=lastRemoved.table;
  const res = await API.createTable({ number:t.n, capacity:t.c, name:t.name });
  if(!res.ok){ toast('','برگردوندن میز ناموفق بود — شاید شماره‌ش گرفته شده'); lastRemoved=null; return; }
  lastRemoved=null;
  await loadTables();rFloor();toast('','برگردانده شد');
}

// تغییر وضعیت میز — با انتخاب صریح و تأیید (نه چرخش تصادفی)
let pendingTable=null;
function openTableSheet(i){
  pendingTable=i;
  const t=TABLES[i];
  // ⚠️ فازِ ۲ (§۶/§۲۸): «در حالِ نظافت» و «تعمیرات» اضافه شدند. پیش از این
  // پنل این دو وضعیت را اصلاً نمی‌شناخت و هر دو را «آزاد» نشان می‌داد — یعنی
  // میزی که برایِ مشتری اصلاً قابلِ رزرو نبود (availability آن را فیلتر
  // می‌کند) برایِ کارکنان «آزاد» بود، و کلیک روی آن بی‌صدا از تعمیرات درش
  // می‌آورد. حالا هر پنج وضعیتِ بک‌اند در پنل قابلِ دیدن و انتخاب‌اند.
  const opts=[
    ['free','var(--green)','آزاد','میز خالی و آماده‌ی پذیرش'],
    ['reserved','var(--blue)','رزروشده','میز رزرو شده، مهمان نیومده'],
    ['seated','var(--amber)','نشسته','مهمان سر میز نشسته'],
    ['cleaning','var(--t3)','در حالِ نظافت','بعد از رفتنِ مهمان، تا آماده‌سازی'],
    ['maintenance','var(--red)','تعمیرات','خارج از سرویس — برایِ مشتری قابلِ رزرو نیست']
  ];
  openModal(`
    <div class="modal-title">${esc(tableLabel(t))} <span style="font-weight:400;color:var(--t2);font-size:14px">· ${fa(t.c)} نفره</span></div>
    <div class="modal-sub">وضعیت میز رو انتخاب کن، بعد تأیید بزن</div>
    <div class="tbl-actions" id="tblOpts">
      ${opts.map(([s,col,name,desc])=>`
        <div class="tbl-act ${t.s===s?'sel':''}" data-s="${s}" onclick="document.querySelectorAll('#tblOpts .tbl-act').forEach(o=>o.classList.remove('sel'));this.classList.add('sel')">
          <span class="ta-dot" style="background:${col}"></span>
          <div class="ta-txt"><div class="ta-name">${name}</div><div class="ta-desc">${desc}</div></div>
          <span class="ta-check">${icon('check',{size:13})}</span>
        </div>`).join('')}
    </div>
    <div class="field-label" style="margin-top:14px">اسم میز <span style="color:var(--t3);font-weight:400">(اختیاری)</span></div>
    <input class="inp" id="tblRename" value="${esc(t.name||'')}" placeholder="میز ${fa(t.n)}" style="width:100%">
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="confirmTableStatus()">تأیید تغییر</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function confirmTableStatus(){
  if(pendingTable===null)return;
  const sel=document.querySelector('#tblOpts .tbl-act.sel');
  if(!sel)return;
  const i=pendingTable;
  const t=TABLES[i];
  const newS=sel.dataset.s, old=t.s;
  const newName=(document.getElementById('tblRename')?.value||'').trim();
  const oldName=t.name||'';
  const nameChanged=newName!==oldName;
  if(newS===old && !nameChanged){closeModal();return}

  if(nameChanged){
    const res=await API.updateTable(t.id,{name:newName||null});
    if(!res.ok){toast('',res.error?.message||'تغییر نام ناموفق بود');return;}
  }
  if(newS!==old){
    const res=await API.setTableState(t.id, UI2BK_STATE[newS]);
    if(!res.ok){toast('',res.error?.message||'تغییر وضعیت ناموفق بود');return;}
  }
  await loadTables();
  pendingTable=null;
  closeModal();
  if(document.getElementById('v-overview').classList.contains('active'))rOverview();
  else rFloor();
  // منبعِ واحدِ برچسب‌ها در data.js (شاملِ cleaning/maintenance که قبلاً
  // اینجا نبودند و توست برایشان «undefined» نشان می‌داد).
  const names=TABLE_STATE_LABELS;
  if(newS!==old) toast('',`${tableLabel(t)} → ${names[newS]}`);
  else toast('',`اسم میز به «${esc(newName||tableLabel(t))}» تغییر کرد`);
}
function toastUndo(msg,undoFn){
  const t=document.getElementById('toast');
  document.getElementById('toastIcon').innerHTML=icon('close',{size:16});
  document.getElementById('toastMsg').innerHTML=msg+` <button class="undo-btn" onclick="${undoFn}();document.getElementById('toast').classList.remove('show')">بازگردانی</button>`;
  t.classList.add('show','with-undo');
  clearTimeout(tt);tt=setTimeout(()=>{t.classList.remove('show','with-undo')},5000);
}


// ═══════════ CRM + GUEST AI ═══════════
