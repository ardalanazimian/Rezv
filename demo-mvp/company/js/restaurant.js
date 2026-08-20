// ═══ رزرونو — پنل company: جزئیات رستوران + آنالیز پلتفرم (Vanilla JS، scope مشترک) ═══
function rDetail(){
  const r=currentRest;
  if(!r){nav('restaurants');return}
  let statusText=STATUS_LABEL[r.status];
  if(r.status==='active')statusText=r.daysLeft!=null?`فعال · ${fa(r.daysLeft)} روز مونده`:'فعال · نامحدود';
  else if(r.status==='expired'||r.status==='trial_expired')statusText=r.daysLeft!=null?`${fa(Math.abs(r.daysLeft))} روز منقضی`:'منقضی';
  else if(r.status==='expiring')statusText=`${fa(r.daysLeft)} روز تا انقضا`;
  else statusText=`آزمایشی · ${fa(r.daysLeft)} روز`;
  const badgeCls = r.status==='trial_expired' ? 'expired' : r.status;
  document.getElementById('v-detail').innerHTML=`
    <button class="back-btn" onclick="nav('restaurants')">→ بازگشت به لیست</button>
    <div class="detail-hero">
      <div class="detail-logo" style="background:${r.grad}">${r.logo}</div>
      <div class="detail-info">
        <div class="detail-name">${esc(r.name)}</div>
        <div class="detail-meta">عضو از ${r.joined} · <span class="plan-badge ${r.plan}">${PLAN_LABEL[r.plan]}</span> · ${r.isOpen?'🟢 باز':'🔴 بسته'}</div>
      </div>
      <div class="detail-actions">
        <span class="badge ${badgeCls}" style="align-self:center"><span class="bdot"></span>${statusText}</span>
        <button class="btn btn-ghost btn-sm" onclick="toggleRestOpen('${r.id}')">${r.isOpen?'🔒 غیرفعال کردن':'✅ فعال کردن'}</button>
        <button class="btn btn-primary btn-sm" onclick="openRenew('${r.id}')">🔄 مدیریت اشتراک</button>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">👥</div></div><div class="kpi-val">${fa(r.members)}</div><div class="kpi-label">عضو باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">📅</div></div><div class="kpi-val">${fa(r.reservations)}</div><div class="kpi-label">کل رزروها</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">✉️</div></div><div class="kpi-val">${fa(r.sms)}</div><div class="kpi-label">پیامک ارسالی</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">📲</div></div><div class="kpi-val">${fa(r.smsBalance)}</div><div class="kpi-label">موجودی پیامک</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">جزئیات بیشتر</div></div></div>
      <div style="font-size:13px;color:var(--t2);line-height:2">
        برای دیدن لیست تک‌تک اعضای باشگاه، رفتار خرید و RFM این رستوران به‌صورت جداگانه، باید وارد
        <b style="color:var(--t1)">پنل خودِ همان رستوران</b> شوی — این داده‌ها برای حفظ حریم خصوصی مشتری‌ها در پنل شرکت به‌صورت جزء‌به‌جزء نمایش داده نمی‌شن.
        خلاصه‌ی تجمیعی (RFM/CLV) همه‌ی رستوران‌ها رو می‌تونی توی صفحه‌ی «هوش تجاری مشتریان» ببینی.
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:14px" onclick="nav('customers')">رفتن به هوش تجاری مشتریان ←</button>
    </div>`;
}
async function toggleRestOpen(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  const action = r.isOpen ? 'deactivate' : 'activate';
  const res = await API.control(id, { action });
  if(res.ok){
    r.isOpen = res.data.is_open;
    toast('✅', r.isOpen?'رستوران فعال شد':'رستوران غیرفعال شد');
    rDetail();
  } else {
    toast('⚠️', res.error?.message || 'عملیات ناموفق بود');
  }
}

// ════════ آنالیز سراسری (همه‌ی رستوران‌ها) ════════
function rAnalytics(){
  const totalMembers=RESTAURANTS.reduce((s,r)=>s+r.members,0);
  const totalRes=RESTAURANTS.reduce((s,r)=>s+r.reservations,0);
  const totalSmsBalance=RESTAURANTS.reduce((s,r)=>s+(r.smsBalance||0),0);
  const topByMembers=[...RESTAURANTS].sort((a,b)=>b.members-a.members).slice(0,5);
  const topByRes=[...RESTAURANTS].sort((a,b)=>b.reservations-a.reservations).slice(0,5);
  const planDist={};RESTAURANTS.forEach(r=>{planDist[r.plan]=(planDist[r.plan]||0)+1});
  document.getElementById('v-analytics').innerHTML=`
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">👥</div></div><div class="kpi-val">${fa(totalMembers)}</div><div class="kpi-label">کل اعضای باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">📅</div></div><div class="kpi-val">${fa(totalRes)}</div><div class="kpi-label">کل رزروها</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">📲</div></div><div class="kpi-val">${fa(totalSmsBalance)}</div><div class="kpi-label">موجودی پیامک کل</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">🏪</div></div><div class="kpi-val">${fa(RESTAURANTS.length)}</div><div class="kpi-label">رستوران فعال در پلتفرم</div></div>
    </div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-head"><div><div class="panel-title">توزیع پلن‌ها</div><div class="panel-sub">چند رستوران روی هر پلن هستن</div></div></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${Object.entries(planDist).map(([p,c])=>`<div style="display:flex;align-items:center;gap:12px"><span style="width:100px;font-size:13px;font-weight:600">${PLAN_LABEL[p]||p}</span><div style="flex:1;height:10px;background:var(--s-100);border-radius:5px;overflow:hidden"><div style="height:100%;width:${RESTAURANTS.length?c/RESTAURANTS.length*100:0}%;background:var(--ink);border-radius:5px"></div></div><span style="font-weight:800;font-size:14px;width:24px;text-align:left">${fa(c)}</span></div>`).join('')}
      </div>
    </div>
    <div class="row-2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">برترین بر اساس باشگاه</div></div>
        ${topByMembers.map((r,i)=>`<div class="list-stat" style="cursor:pointer" onclick="openRest('${r.id}')"><div class="ls-rank">${fa(i+1)}</div><div class="rest-logo" style="background:${r.grad};width:34px;height:34px;font-size:15px">${r.logo}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.reservations)} رزرو</div></div><div class="ls-val">${fa(r.members)}</div></div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">برترین بر اساس رزرو</div></div>
        ${topByRes.map((r,i)=>`<div class="list-stat" style="cursor:pointer" onclick="openRest('${r.id}')"><div class="ls-rank">${fa(i+1)}</div><div class="rest-logo" style="background:${r.grad};width:34px;height:34px;font-size:15px">${r.logo}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.members)} عضو</div></div><div class="ls-val">${fa(r.reservations)}</div></div>`).join('')}
      </div>
    </div>`;
}

// ════════ هوش تجاری مشتریان — تجمیعی و واقعی، از /admin/business-intelligence ════════
