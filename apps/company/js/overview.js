// ═══ رزرونو — پنل company: داشبورد + لیست رستوران‌ها + مودال (Vanilla JS، scope مشترک) ═══
let PLATFORM_STATS = null; // از /admin/overview — اگر null یعنی هنوز لود نشده
async function loadPlatformStats(){
  const res = await API.overview();
  if (res.ok) PLATFORM_STATS = res.data;
  return PLATFORM_STATS;
}
function rOverview(){
  const total=RESTAURANTS.length;
  const totalMembers=RESTAURANTS.reduce((s,r)=>s+r.members,0);
  const totalRes=RESTAURANTS.reduce((s,r)=>s+r.reservations,0);
  const totalSms=RESTAURANTS.reduce((s,r)=>s+r.sms,0);
  const totalSmsBalance=RESTAURANTS.reduce((s,r)=>s+(r.smsBalance||0),0);
  const lowBalanceCount=RESTAURANTS.filter(r=>(r.smsBalance||0)<100).length;
  // برترین رستوران‌ها بر اساس رزرو (واقعی)
  const top=[...RESTAURANTS].sort((a,b)=>b.reservations-a.reservations).slice(0,5);
  // هشدارهای واقعی اشتراک (از tenant.plan_expires_at)
  const alerts=RESTAURANTS.filter(r=>r.status==='expiring'||r.status==='expired'||r.status==='trial'||r.status==='trial_expired');
  // اگر آمار پلتفرم از API نیامده (حالت دمو/آفلاین)، از داده‌ی محلی رستوران‌ها بشمار
  const sub = PLATFORM_STATS?.subscription_breakdown || RESTAURANTS.reduce((a,r)=>{ a[r.status]=(a[r.status]||0)+1; return a; },{active:0,expiring:0,expired:0,trial:0,trial_expired:0});
  const health = PLATFORM_STATS?.system_health || (API.online ? '—' : null);
  const healthMeta = {healthy:['checkCircle','سالم','green'],warning:['alert','نیاز به بررسی','amber'],critical:['alert','بحرانی','red']}[health] || ['info','نامشخص','s-400'];
  // ⚠️ صداقتِ CLV (فازِ ۲، docs/ML_CONTRACT.md): `platform_clv_toman` حالا وقتی
  // هیچ مهمانی مبلغِ اندازه‌گیری‌شده ندارد `null` است (قبلاً سرور COALESCE به ۰
  // می‌کرد و این‌جا «ارزش مهمانان پلتفرم: ۰ تومان» نوشته می‌شد — یعنی ادعایِ
  // «اندازه گرفتیم و هیچ بود»). `platform_clv_status==='insufficient_data'`
  // صریحاً یعنی «هنوز اندازه‌گیری‌ناپذیر»، نه صفر. صفحه‌ی «هوش تجاری» همین
  // پنل از قبل همین رفتار را داشت؛ حالا هر دو یک چیز می‌گویند.
  const clv = PLATFORM_STATS?.platform_clv_toman;
  const clvUnmeasured = PLATFORM_STATS && (clv==null || PLATFORM_STATS.platform_clv_status==='insufficient_data');
  const vipCount = PLATFORM_STATS?.total_vips||0;
  const fnl=n=>n==null?'—':n>=1000000?fa(+(n/1000000).toFixed(1))+'م':n>=1000?fa(Math.round(n/1000))+'ک':fa(n);
  const clvLine = clvUnmeasured
    ? `ارزش مهمانان پلتفرم (CLV): اندازه‌گیری‌ناپذیر · ${fa(vipCount)} مهمان VIP`
    : (clv!=null ? `ارزش مهمانان پلتفرم (CLV): ${fnl(clv)} تومان · ${fa(vipCount)} مهمان VIP` : 'برای جزئیات کلیک کن');

  document.getElementById('v-overview').innerHTML=`
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon('store',{size:17})}</div></div><div class="kpi-val">${fa(total)}</div><div class="kpi-label">رستوران در پلتفرم</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('users',{size:17})}</div></div><div class="kpi-val">${fa(totalMembers)}</div><div class="kpi-label">کل اعضای باشگاه (همه)</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">${icon('calendar',{size:17})}</div></div><div class="kpi-val">${fa(totalRes)}</div><div class="kpi-label">کل رزروها (تجمعی)</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('mail',{size:17})}</div></div><div class="kpi-val">${fa(totalSms)}</div><div class="kpi-label">کل پیامک ارسالی</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${lowBalanceCount>0?'red':'green'}">${icon('phone',{size:17})}</div>${lowBalanceCount>0?`<span class="kpi-delta" style="background:var(--red-50);color:var(--red-600)">${fa(lowBalanceCount)} کم‌موجودی</span>`:''}</div><div class="kpi-val">${fa(totalSmsBalance)}</div><div class="kpi-label">موجودی پیامک (باقی‌مانده)</div></div>
    </div>

    <div class="row-2">
      <div class="panel" style="cursor:pointer" onclick="nav('systemhealth')">
        <div class="panel-head"><div><div class="panel-title">سلامت سیستم</div><div class="panel-sub">صف پردازش، webhook، خطاهای ۲۴ ساعت اخیر</div></div></div>
        <div style="display:flex;align-items:center;gap:14px;padding:8px 0">
          <div style="color:var(--${healthMeta[2]}-600,var(--t1))">${icon(healthMeta[0],{size:38})}</div>
          <div><div style="font-size:18px;font-weight:800;color:var(--${healthMeta[2]}-600,var(--t1))">${healthMeta[1]}</div>
          <div style="font-size:12.5px;color:var(--t2);margin-top:2px">${clvLine}</div></div>
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:8px">جزئیات سلامت سیستم ${icon('arrowL',{size:13})}</button>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">وضعیت اشتراک‌ها</div></div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${[['فعال',sub.active,'var(--green)'],['رو به اتمام',sub.expiring,'var(--amber)'],['آزمایشی',(sub.trial||0)+(sub.trial_expired||0),'var(--ink)'],['منقضی',sub.expired,'var(--red)']].map(([l,c,col])=>`
            <div style="display:flex;align-items:center;gap:12px"><span style="width:100px;font-size:13px;font-weight:600">${l}</span><div style="flex:1;height:10px;background:var(--s-100);border-radius:5px;overflow:hidden"><div style="height:100%;width:${total?c/total*100:0}%;background:${col};border-radius:5px;transition:width .8s"></div></div><span style="font-weight:800;font-size:14px;width:24px;text-align:left">${fa(c)}</span></div>`).join('')}
        </div>
        <button class="btn btn-ghost btn-block" style="margin-top:20px" onclick="nav('restaurants')">دیدن همه‌ی رستوران‌ها ${icon('arrowL',{size:13})}</button>
      </div>
    </div>

    <div class="row-2">
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">پرکارترین رستوران‌ها</div><div class="panel-sub">بر اساس تعداد رزرو</div></div></div>
        ${top.map((r,i)=>`<div class="list-stat">
          <div class="ls-rank">${fa(i+1)}</div>
          <div class="rest-logo" style="background:${r.grad};width:36px;height:36px;font-size:16px">${r.logo}</div>
          <div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.members)} عضو</div></div>
          <div class="ls-val">${fa(r.reservations)}</div>
        </div>`).join('')}
      </div>
      <div class="alert-box">
        <div class="panel-head"><div><div class="panel-title">نیازمند توجه</div><div class="panel-sub">${fa(alerts.length)} رستوران</div></div></div>
        ${alerts.length?alerts.map(r=>{
          const isExpired=r.status==='expired'||r.status==='trial_expired';const isTrial=r.status==='trial';
          return `<div class="alert-item">
            <div class="alert-ic ${isExpired?'danger':isTrial?'info':'warn'}">${isExpired?icon('close',{size:15}):isTrial?icon('gift',{size:15}):icon('clock',{size:15})}</div>
            <div><b>${esc(r.name)}</b> ${isExpired?(r.daysLeft!=null?`اشتراکش ${fa(Math.abs(r.daysLeft))} روزه منقضی شده`:'اشتراکش منقضی شده'):isTrial?`${fa(r.daysLeft)} روز تا پایان دوره آزمایشی`:`${fa(r.daysLeft)} روز تا انقضای اشتراک`}<div style="margin-top:6px"><button class="btn btn-sm ${isExpired?'btn-primary':'btn-ghost'}" onclick="event.stopPropagation();openRenew(${jsq(r.id)})">${isExpired?'تمدید فوری':isTrial?'تبدیل به اشتراک':'تمدید'}</button></div></div>
          </div>`;
        }).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:34})}</div><div class="empty-state-desc">همه‌ی اشتراک‌ها فعالن</div></div>`}
      </div>
    </div>`;
}

// ════════ لیست رستوران‌ها ════════
function rRestaurants(){
  document.getElementById('v-restaurants').innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">همه‌ی رستوران‌ها</div><div class="panel-sub">${fa(RESTAURANTS.length)} رستوران در پلتفرم</div></div></div>
      <div class="rest-controls">
        <button class="filter-chip ${restFilter==='all'?'active':''}" onclick="setRestFilter('all')">همه (${fa(RESTAURANTS.length)})</button>
        <button class="filter-chip ${restFilter==='active'?'active':''}" onclick="setRestFilter('active')">${icon('check',{size:13})} فعال (${fa(RESTAURANTS.filter(r=>r.status==='active').length)})</button>
        <button class="filter-chip ${restFilter==='expiring'?'active':''}" onclick="setRestFilter('expiring')">${icon('clock',{size:13})} رو به اتمام (${fa(RESTAURANTS.filter(r=>r.status==='expiring').length)})</button>
        <button class="filter-chip ${restFilter==='expired'?'active':''}" onclick="setRestFilter('expired')">${icon('close',{size:13})} منقضی (${fa(RESTAURANTS.filter(r=>r.status==='expired').length)})</button>
        <button class="filter-chip ${restFilter==='trial'?'active':''}" onclick="setRestFilter('trial')">${icon('gift',{size:13})} آزمایشی (${fa(RESTAURANTS.filter(r=>r.status==='trial').length)})</button>
      </div>
      <div class="rest-head">
        <div>رستوران</div>
        <div class="rest-col-hide">اعضای باشگاه</div>
        <div class="rest-col-hide">رزروها</div>
        <div>وضعیت اشتراک</div>
        <div></div>
      </div>
      <div class="rest-list" id="restList"></div>
    </div>`;
  renderRestList();
}
function setRestFilter(f){restFilter=f;rRestaurants()}
// ⚠️ رفعِ کنترلِ مرده (فازِ ۲، §۲۶–۲۹): #globalSearch در index.html فقط
// onfocus="nav('restaurants')" داشت؛ تایپ‌کردن در آن هیچ اثری نداشت چون هیچ
// هندلرِ input‌ای در کلِ ریپو وجود نداشت. مسیرِ رندر از قبل آماده بود.
let restQuery='';
function restSearch(q){ restQuery=(q||'').trim(); renderRestList(); }
function renderRestList(){
  const el=document.getElementById('restList');if(!el)return;
  let list=RESTAURANTS;
  if(restFilter!=='all')list=RESTAURANTS.filter(r=>r.status===restFilter);
  if(restQuery)list=list.filter(r=>(r.name||'').includes(restQuery)||(r.city||'').includes(restQuery));
  if(!list.length){el.innerHTML=`<div style="text-align:center;color:var(--t2);padding:40px">${restQuery?'رستورانی با این نام پیدا نشد':'رستورانی در این دسته نیست'}</div>`;return}
  el.innerHTML=list.map(r=>{
    const statusCls=r.status;
    const planBadge=PLAN_LABEL[r.plan];
    let statusText=STATUS_LABEL[r.status];
    if(r.status==='active')statusText=r.daysLeft!=null?`فعال · ${fa(r.daysLeft)} روز`:'فعال · نامحدود';
    else if(r.status==='expiring')statusText=`${fa(r.daysLeft)} روز مونده`;
    else if(r.status==='expired'||r.status==='trial_expired')statusText=r.daysLeft!=null?`${fa(Math.abs(r.daysLeft))} روز منقضی`:'منقضی';
    else if(r.status==='trial')statusText=`آزمایشی · ${fa(r.daysLeft)} روز`;
    return `<div class="rest-row" role="button" tabindex="0" onclick="openRest(${jsq(r.id)})">
      <div class="rest-name-cell">
        <div class="rest-logo" style="background:${r.grad}">${r.logo}</div>
        <div style="min-width:0"><div class="rest-name">${esc(r.name)}</div><div class="rest-loc">پلن ${planBadge}</div></div>
      </div>
      <div class="rest-metric rest-col-hide">${fa(r.members)}<small>عضو</small></div>
      <div class="rest-metric rest-col-hide">${fa(r.reservations)}<small>رزرو</small></div>
      <div><span class="badge ${statusCls==='trial_expired'?'expired':statusCls}"><span class="bdot"></span>${statusText}</span></div>
      <div class="rest-arrow">${icon('arrowL',{size:15})}</div>
    </div>`;
  }).join('');
}

// ════════ مودال ════════
// ⚠️ برابریِ دسترس‌پذیری با پنلِ رستوران (فازِ ۲، §۲۶–۲۹).
//
// این مودال فقط یک کلاس toggle می‌کرد: نه focus داخلش می‌رفت، نه Esc می‌بستش،
// نه Tab داخلش می‌ماند، نه focus بعد از بستن برمی‌گشت. پنلِ رستوران دقیقاً
// همین ویجت را کامل پیاده کرده بود (staff-system.js) — این‌جا همان پیاده‌سازی
// تکرار می‌شود، نه یک طراحیِ تازه.
let _modalLastFocus = null;
function openModal(html){
  _modalLastFocus = document.activeElement;
  document.getElementById('modalBody').innerHTML = html;
  const bg = document.getElementById('modalBg');
  bg.classList.add('show');
  bg.setAttribute('aria-hidden','false');
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
  document.body.style.overflow = '';
  if (_modalLastFocus && document.contains(_modalLastFocus)) _modalLastFocus.focus?.();
  _modalLastFocus = null;
}
// Esc می‌بندد + focus-trap با Tab داخلِ مودال می‌ماند.
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

// ════════ باز کردن جزئیات رستوران ════════
function openRest(id){currentRest=RESTAURANTS.find(r=>String(r.id)===String(id));if(!currentRest)return;nav('detail')}

// ════════ صفحه‌ی جزئیات رستوران ════════
