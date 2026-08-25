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
      ${!isOffered?`<button class="btn btn-teal btn-sm" onclick="offerWLSeat('${w.id}')">آفر میز</button>`:''}
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
async function offerWLSeat(id){
  const w=WAITLIST.find(x=>x.id===id);if(!w)return;
  w.status='offered';
  rWaitlist();
  // اگر داشبورد فعال است، ستون لیست انتظار زنده را هم تازه کن
  if(document.getElementById('v-overview')?.classList.contains('active')) renderEnterpriseDashboard();
  toast('',`میز به ${w.name} آفر شد`);
  // آفلاین → صف کن؛ آنلاین → مستقیم به بک‌اند و بازخوانی صف واقعی
  if(isOffline() && API.getToken()){
    Outbox.enqueue({ type:'waitlist_offer', path:'/restaurant/waitlist', method:'POST', body:{ action:'offer', entry_id:id }, label:`آفر میز به ${w.name}` });
    return;
  }
  if(API.getToken()){ await API.waitlistPromoteNext().catch(()=>{}); await loadWaitlist(); rWaitlist(); }
}
async function removeWL(id){
  WAITLIST=WAITLIST.filter(w=>w.id!==id);
  rWaitlist();
  toast('','از صف حذف شد');
}
let _tablesLoaded=false;
async function rFloor(){
  if(!_tablesLoaded && API.getToken()){ await loadTables(); _tablesLoaded=true; }
  syncTablesFromReservations();
  const occ={free:0,reserved:0,seated:0};
  TABLES.forEach(t=>occ[t.s]++);
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
          ${TABLES.map((t,i)=>`<div class="table-el ${t.s}" onclick="${floorEdit?'':`openTableSheet(${i})`}">
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
  const opts=[
    ['free','var(--green)','آزاد','میز خالی و آماده‌ی پذیرش'],
    ['reserved','var(--blue)','رزروشده','میز رزرو شده، مهمان نیومده'],
    ['seated','var(--amber)','نشسته','مهمان سر میز نشسته']
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
    ${t.id ? `<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="openTableQr(${i})">${icon('qr',{size:14})} QRِ ورودِ مهمان</button>` : ''}
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}

// ═══════════════════════════════════════════════════════════════════════
//  QRِ check-inِ میز — استیکری که رویِ میز چسبانده می‌شود
//
//  مهمان سرِ میز اسکن می‌کند → اپِ مشتری باز می‌شود → رزروِ همان بازه‌ی
//  زمانی به `seated` می‌رود و میز `occupied` می‌شود، بدونِ اینکه کارکنان
//  کاری کنند.
//
//  ⚠️ تا ۲۰۲۶-۰۸-۲۱ این قابلیت شیپ شده بود ولی برایِ هیچ رستورانِ واقعی کار
//  نمی‌کرد: هیچ روتی `qr_code` را ست نمی‌کرد و تنها میزهایِ دارایِ کد،
//  داده‌ی `[DEMO]`ِ seed بودند. حالا هر میز کد دارد و این دکمه نشانش می‌دهد.
//
//  خودِ SVG از APIِ خودمان می‌آید (نه ورودیِ کاربر) و متنِ داخلش را هم سرور
//  از دیتابیس می‌سازد — پنل فقط شناسه‌ی میز را می‌فرستد.
// ═══════════════════════════════════════════════════════════════════════
let _tableQrSvg = null;
let _tableQrLabel = '';

function openTableQr(i){
  const t = TABLES[i];
  if(!t || !t.id){ toast('','این میز هنوز روی سرور ساخته نشده'); return; }
  _tableQrLabel = tableLabel(t);
  openModal(`
    <div class="modal-title">QRِ ورودِ مهمان · ${esc(_tableQrLabel)}</div>
    <div class="modal-sub">این کد را چاپ کن و رویِ میز بگذار. مهمان با اسکنش، ورودش خودکار ثبت می‌شود.</div>
    <div id="tableQrBox" style="text-align:center;padding:12px 0"></div>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">بستن</button>
  `);
  tableLoadQr(t.id);
}

/** SVGِ QR را از سرور می‌گیرد و همراهِ دکمه‌های دانلود/چاپ نشان می‌دهد. */
async function tableLoadQr(id){
  const box = document.getElementById('tableQrBox');
  if(!box) return;
  box.innerHTML = `<div style="color:var(--t2);font-size:13px">در حال ساختِ QR…</div>`;

  const res = await API.tableQrSvg(id, 512);
  if(!res.ok){
    box.innerHTML = `<div style="color:var(--t2);font-size:13px;margin-bottom:8px">
        ${esc(res.offline ? 'اتصال به سرور برقرار نیست.' : (res.error?.message || 'ساختِ QR ناموفق بود.'))}
      </div>
      <button class="btn btn-sm btn-ghost" onclick="tableLoadQr('${esc(id)}')">تلاش دوباره</button>`;
    return;
  }

  _tableQrSvg = res.data.svg;
  // SVG با عرضِ ثابتِ ۵۱۲ می‌آید (اندازه‌ای که برایِ دانلود می‌خواهیم) ولی در
  // پنلِ موبایل باید کوچک شود، وگرنه از کارت بیرون می‌زند و صفحه را افقی
  // اسکرول می‌کند — همان چیزی که در QRِ منو هم رخ داده بود.
  box.innerHTML = `
    <div style="background:#fff;display:inline-block;padding:12px;border-radius:12px;max-width:100%">
      <div style="max-width:240px;margin:0 auto">
        <style>#tableQrBox svg{width:100%;height:auto;display:block}</style>
        ${_tableQrSvg}
      </div>
    </div>
    <div style="font-family:monospace;font-size:12px;color:var(--t2);margin-top:8px;direction:ltr">${esc(res.data.code)}</div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-sm btn-ghost" onclick="tableDownloadQr('svg')">دانلودِ SVG</button>
      <button class="btn btn-sm btn-ghost" onclick="tableDownloadQr('png')">دانلودِ PNG</button>
      <button class="btn btn-sm btn-ghost" onclick="tablePrintQr()">چاپ</button>
    </div>
    <div style="color:var(--t2);font-size:12px;margin-top:8px">
      SVG برایِ چاپ (هر اندازه، بدونِ افتِ کیفیت) · PNG برایِ اشتراک‌گذاری
    </div>
    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:10px">
      <button class="btn btn-sm btn-ghost" style="color:var(--danger,#e5484d)"
              onclick="tableRegenerateQr('${esc(id)}')">بازتولیدِ کد</button>
      <div style="color:var(--t2);font-size:12px;margin-top:6px">
        اگر استیکر گم یا کپی شده: کدِ تازه بساز. استیکرِ فعلی از همان لحظه
        <b>باطل</b> می‌شود و باید دوباره چاپ شود.
      </div>
    </div>`;
}

/**
 * بازتولیدِ کدِ QRِ میز.
 *
 * ⚠️ برگشت‌ناپذیر است: کدِ قبلی برنمی‌گردد و هر استیکری که با آن چاپ شده از
 * همان لحظه مرده است (مهمان با اسکنش «میز پیدا نشد» می‌گیرد). پس متنِ تأیید
 * دقیقاً همین اثر را می‌گوید، نه یک «مطمئنی؟»ِ مبهم — رستوران‌دار باید بداند
 * دارد چه چیزی را از بین می‌برد. سرور هم این کار را در audit ثبت می‌کند.
 */
async function tableRegenerateQr(id){
  if(!window.confirm(
    'کدِ تازه ساخته شود؟\n\n' +
    'استیکرِ فعلیِ رویِ این میز از همین لحظه باطل می‌شود و مهمان با اسکنش به جایی نمی‌رسد. ' +
    'باید کدِ جدید را چاپ کنی و جایگزین کنی.\n\nاین کار برگشت‌پذیر نیست.'
  )) return;

  const box = document.getElementById('tableQrBox');
  if(box) box.innerHTML = `<div style="color:var(--t2);font-size:13px">در حال ساختِ کدِ تازه…</div>`;

  const res = await API.regenerateTableQr(id);
  if(!res.ok){
    if(box){
      box.innerHTML = `<div style="color:var(--t2);font-size:13px;margin-bottom:8px">
          ${esc(res.offline ? 'اتصال به سرور برقرار نیست — کد عوض نشد.' : (res.error?.message || 'بازتولیدِ کد ناموفق بود.'))}
        </div>
        <button class="btn btn-sm btn-ghost" onclick="tableLoadQr('${esc(id)}')">نمایشِ کدِ فعلی</button>`;
    }
    return;
  }

  toast('', 'کدِ تازه ساخته شد — استیکرِ قبلی دیگر کار نمی‌کند');
  // QR را از نو می‌گیریم تا کدِ جدید و تصویرش هر دو به‌روز شوند.
  tableLoadQr(id);
}

/** دانلودِ QR. PNG در خودِ مرورگر از SVG رندر می‌شود — بدونِ رفت‌وبرگشتِ اضافه. */
function tableDownloadQr(fmt){
  if(!_tableQrSvg) return;
  const name = 'rezervno-table-qr';
  if(fmt === 'svg'){
    tableTriggerDownload(new Blob([_tableQrSvg], { type:'image/svg+xml' }), name + '.svg');
    return;
  }
  // SVG → canvas → PNG. اندازه‌ی ۱۰۲۴ عمدی است: QR در چاپ اغلب بزرگ‌تر از
  // نمایشِ صفحه لازم می‌شود و بزرگ‌کردنِ PNGِ کوچک ناخوانایش می‌کند.
  const SIZE = 1024;
  const img = new Image();
  const svgUrl = URL.createObjectURL(new Blob([_tableQrSvg], { type:'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    // پس‌زمینه‌ی سفیدِ صریح: PNGِ شفاف رویِ تمِ تیره سیاه‌روی‌سیاه می‌شود و
    // اسکنر نمی‌خواندش.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    URL.revokeObjectURL(svgUrl);
    c.toBlob(b => { if(b) tableTriggerDownload(b, name + '.png'); });
  };
  img.onerror = () => { URL.revokeObjectURL(svgUrl); toast('','ساختِ PNG ناموفق بود — SVG را دانلود کن'); };
  img.src = svgUrl;
}

/** چاپِ مستقیم: یک پنجره‌ی کوچک با همان SVG و نامِ میز بالایش. */
function tablePrintQr(){
  if(!_tableQrSvg) return;
  const w = window.open('', '_blank', 'width=420,height=560');
  if(!w){ toast('','مرورگر پنجره‌ی چاپ را بست — دانلودِ SVG را امتحان کن'); return; }
  // `esc` رویِ برچسب اعمال می‌شود چون اسمِ میز را رستوران‌دار تایپ کرده.
  // SVG از APIِ خودمان می‌آید و ورودیِ کاربر داخلش نیست.
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8">
    <title>QR ${esc(_tableQrLabel)}</title>
    <style>
      body{font-family:system-ui,sans-serif;text-align:center;padding:24px;margin:0}
      h1{font-size:20px;margin:0 0 16px}
      svg{width:280px;height:280px}
      p{color:#555;font-size:13px;margin-top:12px}
      @media print{ body{padding:0} }
    </style></head><body>
    <h1>${esc(_tableQrLabel)}</h1>
    ${_tableQrSvg}
    <p>برای ثبتِ ورود، این کد را اسکن کنید</p>
    </body></html>`);
  w.document.close();
  // چاپ بعد از لودِ کاملِ سند؛ بدونِ این، بعضی مرورگرها صفحه‌ی خالی چاپ می‌کنند.
  w.onload = () => { w.focus(); w.print(); };
}

function tableTriggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const names={free:'آزاد',reserved:'رزروشده',seated:'نشسته'};
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
