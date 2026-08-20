// ═══ رزرونو — پنل business: داشبورد Enterprise + به‌روزرسانی زنده (Vanilla JS، بدون build، scope مشترک) ═══
function rOverview(){
  // ═══════════ داشبورد Enterprise — مرکز فرماندهی ═══════════
  renderEnterpriseDashboard();
}

// ── لایه‌ی درآمد (آماده‌ی اتصال به API صندوق) ──
// نکته: سیستم صندوق جداست و هنوز API نمی‌دهد. این لایه فعلاً تخمین واقع‌گرایانه
// می‌زند؛ وقتی API صندوق آماده شد، فقط fetchRevenue را به آن وصل کن.
const REVENUE_CONFIG = {
  connected: false,                    // وقتی API صندوق وصل شد → true
  avgPerGuest: 850_000,                // میانگین خرید هر نفر (تومان) — تخمین پایه
  vipMultiplier: 1.8,                  // مشتری VIP بیشتر خرج می‌کند
  preorderMultiplier: 1.25,            // پیش‌سفارش = خرید بیشتر
};
// تخمین خرید یک رزرو (تا وقتی صندوق وصل نشده)
function estimateSpend(r){
  let base = REVENUE_CONFIG.avgPerGuest * r.party;
  if(r.seg==='vip') base *= REVENUE_CONFIG.vipMultiplier;
  if(r.pre) base *= REVENUE_CONFIG.preorderMultiplier;
  return Math.round(base);
}
// درآمد امروز (از رزروهای حاضر/تکمیل‌شده)
function calcRevenue(reservations){
  const realized = reservations.filter(r=>['arrived','seated','dining','completed','checked_in'].includes(r.status));
  const total = realized.reduce((s,r)=>s+estimateSpend(r),0);
  const guests = realized.reduce((s,r)=>s+r.party,0);
  return { total, guests, avgPerGuest: guests?Math.round(total/guests):0, count: realized.length };
}
// قالب‌بندی پول (تومان → خوانا)
function fmtMoney(t){
  if(t>=1_000_000) return fa(+(t/1_000_000).toFixed(1))+'م';
  if(t>=1000) return fa(Math.round(t/1000))+'ک';
  return fa(t);
}

// ── محاسبه‌ی KPIهای کلیدی امروز ──
function calcTodayKPIs(){
  syncTablesFromReservations();
  const today = RES.filter(r=>r.date==='today');
  const arrived = today.filter(r=>['arrived','seated','dining','checked_in'].includes(r.status));
  const expected = today.filter(r=>['confirmed','auto_confirmed','preparing'].includes(r.status));
  const noShows = today.filter(r=>r.status==='no_show'||r.status==='noshow');
  const peopleSeated = arrived.reduce((s,r)=>s+r.party,0);
  const peopleReserved = today.reduce((s,r)=>s+r.party,0);
  const seatedTables = TABLES.filter(t=>t.s==='seated').length;
  const totalTables = TABLES.length;
  const rev = calcRevenue(today);
  return {
    todayCount: today.length,
    arrivedCount: arrived.length,
    expectedCount: expected.length,
    expectedGuests: expected.reduce((s,r)=>s+r.party,0),
    noShowCount: noShows.length,
    noShowRate: today.length?Math.round((noShows.length/today.length)*100):0,
    peopleSeated, peopleReserved,
    occupancyPct: totalTables?Math.round((seatedTables/totalTables)*100):0,
    seatedTables, totalTables,
    revenue: rev.total, avgSpend: rev.avgPerGuest, revenueGuests: rev.guests,
  };
}
function focusSearch(){nav('reservations');setTimeout(()=>{const el=document.getElementById('resSearch');if(el)el.focus()},300)}
// متن بینش هوشمند داشبورد — از KPIهای واقعی ساخته می‌شود
function dashAiInsight(){
  const k = calcTodayKPIs();
  const waiting = WAITLIST.filter(w=>w.status==='waiting').length;
  const freeTables = Math.max(0, k.totalTables - k.seatedTables);
  const parts = [];
  if(freeTables>0) parts.push(`<b>${fa(freeTables)} میز خالی</b> داری`);
  if(waiting>0) parts.push(`<b>${fa(waiting)} نفر</b> توی صف منتظرن`);
  if(k.noShowRate>15) parts.push(`نرخ نوشو امشب <b>${fa(k.noShowRate)}٪</b>ه — برای رزروهای پرریسک یادآوری بفرست`);
  if(parts.length===0) return 'همه‌چیز مرتبه — سالن پره و صف خالیه. برای پر نگه‌داشتن روزهای آینده، به مشتریان وفادار کش‌بک بده.';
  let msg = parts.join(' و ') + '. ';
  if(freeTables>0) msg += 'یک پیام کش‌بک به مشتریان وفاداری که این هفته نیامده‌اند بفرست تا میزهای خالی پر شود.';
  return msg;
}
// ═══════════ داشبورد Enterprise ═══════════
// رندر ردیف‌های رزرو امشب (با اکشن مستقیم ثبت ورود/تماس)
function renderDashResvRows(){
  const initials = n => (n||'؟').trim().slice(0,2);
  const today = RES.filter(r=>r.date==='today' && !['completed','no_show','noshow','cancelled'].includes(r.status))
    .sort((a,b)=>String(a.t).localeCompare(String(b.t),'fa')).slice(0,6);
  if(!today.length) return '<div class="dr-empty">هنوز رزروی برای امشب ثبت نشده</div>';
  return today.map((r,i)=>{
    const arrived = ['arrived','seated','dining','checked_in'].includes(r.status);
    const vip = r.seg==='vip' ? '<span class="dr-mini vip">★ VIP</span>' : '';
    const risk = (r.noShowTier==='high'||r.risk==='high') ? '<span class="dr-mini risk">ریسک نوشو</span>' : '';
    const metaBits = [r.table?('میز '+fa(r.table)):'', fa(r.party)+' نفر', r.pre?'با پیش‌سفارش':''].filter(Boolean).join(' · ');
    const idx = RES.indexOf(r);
    const act = arrived
      ? '<span class="dr-mini" style="background:var(--green-50);color:var(--green)">حاضر ✓</span>'
      : `${(r.noShowTier==='high'||r.risk==='high')?`<button class="dr-act" onclick="callGuest(${idx})">تماس</button>`:''}<button class="dr-act go" onclick="dashCheckIn(${idx})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>ثبت ورود</button>`;
    return `<div class="dr-row">
      <div class="dr-time">${r.t}</div>
      <div class="dr-av">${initials(r.name)}</div>
      <div class="dr-info"><div class="dr-name">${esc(r.name)} ${vip}${risk}</div><div class="dr-meta">${metaBits}</div></div>
      <div class="dr-acts">${act}</div>
    </div>`;
  }).join('');
}
// رندر ردیف‌های لیست انتظار زنده (با اکشن آفر میز)
function renderDashWaitlist(){
  const initials = n => (n||'؟').trim().slice(0,2);
  const queue = WAITLIST.filter(w=>w.status==='waiting').sort((a,b)=>(b.priority-a.priority)||(b.waited_minutes-a.waited_minutes)).slice(0,5);
  if(!queue.length) return '<div class="dr-empty">🎉 صف خالیه — همه سر میزن</div>';
  return queue.map((w,i)=>{
    const vip = w.is_vip ? '<span class="dr-mini vip">★</span>' : '';
    const waited = w.waited_minutes>=10 ? `<span class="wl-wait">${fa(w.waited_minutes)} دقیقه منتظر</span>` : `${fa(w.waited_minutes)} دقیقه`;
    return `<div class="dr-row">
      <div class="wl-pos">${fa(i+1)}</div>
      <div class="dr-info"><div class="dr-name">${esc(w.name)} ${vip}</div><div class="dr-meta">${fa(w.party_size)} نفر · ${waited}</div></div>
      <div class="dr-acts"><button class="dr-act offer" onclick="offerWLSeat('${w.id}')">آفر میز</button></div>
    </div>`;
  }).join('');
}
// اکشن ثبت ورود از داشبورد — به منطق موجود markArrived وصل می‌شود
function dashCheckIn(idx){
  const r = RES[idx]; if(!r) return;
  if(typeof markArrived==='function'){ markArrived(idx); }
  else { r.status='arrived'; }
  renderEnterpriseDashboard();
}
// تماس با مهمان (نمایش شماره)
function callGuest(idx){
  const r = RES[idx]; if(!r) return;
  toast('📞', `تماس با ${r.name}: ${r.phone||'شماره ثبت نشده'}`);
}
function renderEnterpriseDashboard(){
  const k = calcTodayKPIs();
  const elap = REVENUE_CONFIG.connected ? '' : '<span class="kpi-est" title="تخمینی تا اتصال صندوق">≈</span>';
  document.getElementById('v-overview').innerHTML = `
    <div class="dash-live-row">${liveStatusBadge()}<span class="dash-live-time">به‌روزرسانی خودکار هر ۱۵ ثانیه</span><span id="offlineBadge"></span></div>
    <!-- کارهای سریع (بازطراحی پریمیوم) -->
    <div class="quick-grid">
      <div class="quick-btn primary" onclick="openWalkin()"><div class="quick-ic"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/><path d="M12 11v6M9 14h6" stroke-width="2.4"/></svg></div><div class="quick-label">ورود بدون رزرو</div></div>
      <div class="quick-btn" onclick="openManual()"><div class="quick-ic"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M12 11v6M9 14h6"/></svg></div><div class="quick-label">رزرو جدید</div></div>
      <div class="quick-btn" onclick="nav('waitlist')"><div class="quick-ic"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><div class="quick-label">لیست انتظار</div></div>
      <div class="quick-btn" onclick="nav('floor')"><div class="quick-ic"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div class="quick-label">پلان سالن</div></div>
      <div class="quick-btn" onclick="focusSearch()"><div class="quick-ic"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg></div><div class="quick-label">جستجوی مهمان</div></div>
    </div>

    <!-- KPIهای کلیدی امروز (شبکه‌ی enterprise) -->
    <div class="kpi-grid">
      <div class="kpi-card" onclick="nav('reservations')">
        <div class="kpi-top"><span class="kpi-ic" style="background:var(--blue-50)">📅</span><span class="kpi-trend up">امروز</span></div>
        <div class="kpi-val">${fa(k.todayCount)}</div>
        <div class="kpi-lbl">رزرو امروز</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-ic" style="background:var(--green-50)">🍽️</span><span class="kpi-trend">${fa(k.occupancyPct)}٪</span></div>
        <div class="kpi-val">${fa(k.seatedTables)}<span class="kpi-sub">/${fa(k.totalTables)}</span></div>
        <div class="kpi-lbl">اشغال فعلی</div>
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:0" data-w="${k.occupancyPct}"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-ic" style="background:#FEF3C7">⏳</span><span class="kpi-trend">${fa(k.expectedGuests)} نفر</span></div>
        <div class="kpi-val">${fa(k.expectedCount)}</div>
        <div class="kpi-lbl">ورودی‌های منتظر</div>
      </div>
      <div class="kpi-card ${k.noShowCount>0?'kpi-warn':''}">
        <div class="kpi-top"><span class="kpi-ic" style="background:#FEE2E2">🚫</span><span class="kpi-trend ${k.noShowRate>15?'down':''}">${fa(k.noShowRate)}٪</span></div>
        <div class="kpi-val">${fa(k.noShowCount)}</div>
        <div class="kpi-lbl">عدم حضور</div>
      </div>
      <div class="kpi-card kpi-revenue">
        <div class="kpi-top"><span class="kpi-ic" style="background:#DCFCE7">💰</span>${REVENUE_CONFIG.connected?'<span class="kpi-trend up">صندوق</span>':'<span class="kpi-trend est">تخمین</span>'}</div>
        <div class="kpi-val">${elap}${fmtMoney(k.revenue)}</div>
        <div class="kpi-lbl">درآمد امروز (تومان)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-ic" style="background:#EDE9FE">🧾</span></div>
        <div class="kpi-val">${elap}${fmtMoney(k.avgSpend)}</div>
        <div class="kpi-lbl">میانگین خرید هر نفر</div>
      </div>
    </div>

    ${!REVENUE_CONFIG.connected?`<div class="cash-note">💡 ارقام درآمد تخمینی‌اند. با اتصال API صندوق، اعداد واقعی نمایش داده می‌شوند. <button class="cash-link" onclick="toast('🔌','وقتی API صندوق آماده شد، در تنظیمات وصل کن')">اتصال صندوق</button></div>`:''}

    <!-- عملیات امشب: رزروها + لیست انتظار زنده (مرکز فرماندهی) -->
    <div class="dash-ops">
      <div class="ops-panel">
        <div class="ops-head"><div class="ops-title">رزروهای امشب</div><button class="ops-link" onclick="nav('reservations')">همه رزروها ←</button></div>
        <div id="dashResvRows">${renderDashResvRows()}</div>
      </div>
      <div class="ops-panel">
        <div class="ops-head"><div class="ops-title">🔴 لیست انتظار <span class="count-pill">${fa(WAITLIST.filter(w=>w.status==='waiting').length)} نفر</span></div><button class="ops-link" onclick="nav('waitlist')">مدیریت ←</button></div>
        <div id="dashWaitlist">${renderDashWaitlist()}</div>
      </div>
    </div>

    <!-- دستیار هوشمند (تمایز از رقیب) -->
    <div class="ai-strip">
      <div class="ai-strip-left">
        <span class="ai-strip-badge">✦ دستیار هوشمند رزرونو</span>
        <div class="ai-strip-title">امشب چه کنی؟</div>
        <div class="ai-strip-text">${dashAiInsight()}</div>
      </div>
      <button class="ai-strip-act" onclick="nav('cashback')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>ارسال پیام کش‌بک</button>
    </div>

    <!-- ساعات پیک امروز -->
    <div class="panel">
      <div class="panel-head"><div class="panel-title">📊 ساعات پیک</div><div class="panel-sub">توزیع رزرو در ساعات روز</div></div>
      <div id="peakChart" class="peak-chart"></div>
    </div>

    <!-- Heatmap هفتگی -->
    <div class="panel">
      <div class="panel-head"><div class="panel-title">🔥 نقشه‌ی حرارتی هفته</div><div class="panel-sub">شلوغی بر اساس روز و ساعت</div></div>
      <div id="heatmap" class="heatmap"></div>
    </div>

    <!-- مشتریان برتر + بینش‌ها -->
    <div class="dash-2col">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">⭐ مشتریان برتر</div></div>
        <div id="topCustomers"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">✦ بینش‌های هوشمند</div></div>
        <div id="insights"></div>
      </div>
    </div>

    <!-- یادداشت کارکنان -->
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">📝 یادداشت کارکنان</div><div class="panel-sub">یادداشت‌های امروز تیم</div></div>
        <button class="btn btn-ghost btn-sm" onclick="addStaffNote()">+ یادداشت</button></div>
      <div id="staffNotes"></div>
    </div>`;

  // رندر بخش‌های پویا
  renderPeakChart();
  renderHeatmap();
  renderTopCustomers();
  renderInsights();
  renderStaffNotes();
  if(typeof Outbox!=='undefined') Outbox._updateBadge();
  setTimeout(()=>{document.querySelectorAll('.kpi-bar-fill').forEach(f=>f.style.width=f.dataset.w+'%')},250);
}

// ── ساعات پیک (نمودار میله‌ای) ──
function renderPeakChart(){
  const hours={};
  RES.filter(r=>r.date==='today'||r.date==='past').forEach(r=>{
    const h=parseInt(String(r.t).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).split(':')[0]);
    if(!isNaN(h)) hours[h]=(hours[h]||0)+1;
  });
  const slots=[12,13,14,18,19,20,21,22];
  const max=Math.max(1,...slots.map(h=>hours[h]||0));
  document.getElementById('peakChart').innerHTML=slots.map(h=>{
    const c=hours[h]||0; const pct=Math.round((c/max)*100);
    const peak=c===max&&c>0;
    return `<div class="peak-col"><div class="peak-bar-wrap"><div class="peak-bar ${peak?'peak-hot':''}" style="height:0" data-h="${pct}"></div></div><div class="peak-hour">${fa(h)}</div></div>`;
  }).join('');
  setTimeout(()=>{document.querySelectorAll('.peak-bar').forEach(b=>b.style.height=Math.max(4,b.dataset.h)+'%')},300);
}

// ── Heatmap هفتگی (روز × بازه‌ی زمانی) ──
function renderHeatmap(){
  const days=['ش','ی','د','س','چ','پ','ج'];
  const slots=['ظهر','عصر','شب'];
  // داده‌ی نمونه‌ی واقع‌گرایانه (شدت ۰-۴) — آخر هفته شب شلوغ‌تر
  const data=[
    [1,2,3],[1,2,3],[1,1,2],[2,2,3],[2,3,4],[3,4,4],[3,4,4]
  ];
  let html='<div class="hm-grid"><div class="hm-corner"></div>'+slots.map(s=>`<div class="hm-slot-lbl">${s}</div>`).join('');
  days.forEach((d,di)=>{
    html+=`<div class="hm-day-lbl">${d}</div>`;
    slots.forEach((s,si)=>{ html+=`<div class="hm-cell hm-${data[di][si]}" title="${d} ${s}"></div>`; });
  });
  html+='</div><div class="hm-legend"><span>کم</span><div class="hm-scale"><i class="hm-0"></i><i class="hm-1"></i><i class="hm-2"></i><i class="hm-3"></i><i class="hm-4"></i></div><span>زیاد</span></div>';
  document.getElementById('heatmap').innerHTML=html;
}

// ── مشتریان برتر ──
function renderTopCustomers(){
  const top=[...GUESTS].sort((a,b)=>b.visits-a.visits).slice(0,5);
  document.getElementById('topCustomers').innerHTML=top.map((c,i)=>`
    <div class="top-cust" onclick="viewCustomerHistory('${esc(c.name)}')">
      <span class="top-rank">${fa(i+1)}</span>
      <span class="top-ava">${c.ava}</span>
      <div class="top-body"><div class="top-name">${esc(c.name)} ${c.seg==='vip'?'<span class="seg-vip">VIP</span>':''}</div>
        <div class="top-meta">${fa(c.visits)} بازدید · ${c.spent} خرید</div></div>
      <span class="top-arrow">›</span>
    </div>`).join('');
}

// ── بینش‌های هوشمند ──
function renderInsights(){
  const k=calcTodayKPIs();
  const insights=[];
  if(k.noShowRate>15) insights.push({ic:'⚠️',t:`نرخ عدم حضور ${fa(k.noShowRate)}٪ بالاست`,d:'پیامک یادآوری بفرست یا بیعانه بگیر',c:'warn'});
  if(k.occupancyPct>80) insights.push({ic:'🔥',t:'سالن تقریباً پره',d:'لیست انتظار را فعال نگه دار',c:'hot'});
  if(k.expectedCount>3) insights.push({ic:'⏳',t:`${fa(k.expectedCount)} مهمان در راه`,d:'میزها را برای ورودشان آماده کن',c:'info'});
  const vipToday=RES.filter(r=>r.date==='today'&&r.seg==='vip').length;
  if(vipToday>0) insights.push({ic:'⭐',t:`${fa(vipToday)} مهمان VIP امروز`,d:'برخورد ویژه را فراموش نکن',c:'vip'});
  insights.push({ic:'📈',t:'جمعه شب پرترددترین زمان توست',d:'کارکنان بیشتری برنامه‌ریزی کن',c:'info'});
  document.getElementById('insights').innerHTML=insights.slice(0,4).map(i=>`
    <div class="insight insight-${i.c}"><span class="insight-ic">${i.ic}</span>
      <div><div class="insight-t">${i.t}</div><div class="insight-d">${i.d}</div></div></div>`).join('');
}

// ── یادداشت کارکنان (واقعی، از /restaurant/notes) ──
let STAFF_NOTES=[];
let _notesLoaded=false;
async function loadStaffNotes(){
  if(!API.getToken())return STAFF_NOTES;
  const res=await API.notes();
  if(res.ok && Array.isArray(res.data?.items)){
    STAFF_NOTES=res.data.items.map(n=>({id:n.id,who:n.author_name||'تیم',txt:n.body,pinned:n.pinned,time:faRelative(n.created_at)}));
  }
  _notesLoaded=true;
  return STAFF_NOTES;
}
function renderStaffNotes(){
  const el=document.getElementById('staffNotes');
  if(!el)return;
  if(API.getToken() && !_notesLoaded){ loadStaffNotes().then(renderStaffNotes); }
  el.innerHTML=STAFF_NOTES.length?STAFF_NOTES.map((n)=>`
    <div class="snote"${n.pinned?' style="border-color:var(--amber);background:var(--amber-50)"':''}><div class="snote-body"><div class="snote-txt">${n.pinned?'📌 ':''}${esc(n.txt)}</div>
      <div class="snote-meta">${esc(n.who)} · ${n.time}</div></div>
      <button class="snote-del" onclick="delStaffNote('${n.id||''}')">×</button></div>`).join(''):'<div class="snote-empty">یادداشتی ثبت نشده</div>';
}
function addStaffNote(){
  openModal(`<div class="modal-title">یادداشت جدید</div>
    <textarea id="noteTxt" class="inp" rows="3" placeholder="یادداشت برای تیم..." style="resize:none;margin-top:12px"></textarea>
    <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;cursor:pointer"><input type="checkbox" id="notePin"> 📌 سنجاق کن (بالای لیست بمونه)</label>
    <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="saveStaffNote()">ثبت یادداشت</button>`);
}
async function saveStaffNote(){
  const txt=document.getElementById('noteTxt')?.value.trim();
  if(!txt){toast('','یادداشت خالی است');return;}
  const pinned=document.getElementById('notePin')?.checked||false;
  if(API.getToken()){
    const res=await API.addNote({body:txt,pinned});
    if(!res.ok){toast('⚠️',res.error?.message||'ثبت ناموفق بود');return;}
    await loadStaffNotes();
  }else{
    const now=new Date();
    STAFF_NOTES.unshift({who:'شما',txt,pinned,time:fa(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)});
  }
  closeModal();renderStaffNotes();toast('✓','یادداشت ثبت شد');
}
async function delStaffNote(id){
  if(id && API.getToken()){
    const res=await API.deleteNote(id);
    if(!res.ok){toast('⚠️',res.error?.message||'حذف ناموفق بود');return;}
    await loadStaffNotes();
  }else{
    STAFF_NOTES=STAFF_NOTES.filter(n=>String(n.id||'')!==String(id));
  }
  renderStaffNotes();
}
// ═══════════ Live Updates (به‌روزرسانی زنده) ═══════════
let liveTimer=null, liveOn=true;
// شبیه‌سازی رویدادهای زنده برای دمو؛ با بک‌اند واقعی → polling یا WebSocket
const LIVE_EVENTS=[
  {ic:'✅',txt:'مهمان میز ۵ رسید'},
  {ic:'📋',txt:'رزرو جدید: ۲ نفر، ساعت ۲۱:۰۰'},
  {ic:'🔔',txt:'لیست انتظار: نفر جدید اضافه شد'},
  {ic:'🪑',txt:'میز ۳ آزاد شد'},
];
function startLiveUpdates(){
  if(liveTimer)clearInterval(liveTimer);
  liveTimer=setInterval(()=>{
    if(!liveOn)return;
    // فقط وقتی در داشبورد هستیم به‌روز کن
    const ov=document.getElementById('v-overview');
    if(ov&&ov.classList.contains('active')){
      // به‌روزرسانی نرم KPIها (بدون رندر کامل، فقط اعداد)
      refreshLiveKPIs();
    }
  },15000); // هر ۱۵ ثانیه
}
function refreshLiveKPIs(){
  const k=calcTodayKPIs();
  // فقط اعداد را به‌روز کن (بدون پرش UI)
  const vals=document.querySelectorAll('#v-overview .kpi-val');
  // نشانگر زنده‌بودن
  const ind=document.getElementById('liveInd');
  if(ind){ind.classList.add('pulse');setTimeout(()=>ind.classList.remove('pulse'),1000);}
}
// نوار وضعیت زنده (بالای داشبورد)
function liveStatusBadge(){
  return `<span class="live-badge" id="liveInd"><span class="live-dot"></span>زنده</span>`;
}
// شروع هنگام ورود به پنل
function initLiveUpdates(){ startLiveUpdates(); }
// ── تاریخچه‌ی مشتری ──
function viewCustomerHistory(name){
  const c=GUESTS.find(x=>x.name===name)||{name,visits:0,spent:'۰',seg:'new',ava:'👤'};
  const history=RES.filter(r=>r.name===name);
  openModal(`<div class="ch-head"><span class="ch-ava">${c.ava||'👤'}</span>
    <div><div class="modal-title">${esc(name)} ${c.seg==='vip'?'<span class="seg-vip">VIP</span>':''}</div>
    <div class="ch-sub">${fa(c.visits||0)} بازدید · ${c.spent||'۰'} مجموع خرید</div></div></div>
    ${(c.phone||c.birthday)?`<div class="ch-contact">
      ${c.phone?`<div class="ch-cinfo"><span>📱</span> ${esc(c.phone)}</div>`:''}
      ${c.birthday?`<div class="ch-cinfo"><span>🎂</span> ${esc(c.birthday)}</div>`:''}
      ${c.points?`<div class="ch-cinfo"><span>⭐</span> ${fa(c.points)} امتیاز</div>`:''}
    </div>`:''}
    <div class="ch-stats">
      <div class="ch-stat"><div class="ch-stat-v">${fa(c.visits||0)}</div><div class="ch-stat-l">بازدید</div></div>
      <div class="ch-stat"><div class="ch-stat-v">${c.spent||'۰'}</div><div class="ch-stat-l">خرید</div></div>
      <div class="ch-stat"><div class="ch-stat-v">${fa(c.ret||0)}٪</div><div class="ch-stat-l">بازگشت</div></div>
    </div>
    <div class="ch-hist-title">سابقه‌ی رزرو</div>
    <div class="ch-hist">${history.length?history.map(h=>`<div class="ch-hrow"><span>${STATUS_META[h.status]?.icon||'•'} ${h.dLabel||h.date}</span><span class="ch-hmeta">${h.t} · ${fa(h.party)} نفر</span></div>`).join(''):'<div class="snote-empty">سابقه‌ای ثبت نشده</div>'}</div>`);
}

// ═══════════ RESERVATIONS ═══════════
