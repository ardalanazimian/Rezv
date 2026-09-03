// ═══ رزرونو — پنل company: هوش تجاری + سلامت سیستم + امنیت + اشتراک + init (Vanilla JS، scope مشترک) ═══
// نکته‌ی مهم حریم خصوصی: نام/شماره‌ی تک‌تک مشتریان همه‌ی رستوران‌ها عمداً اینجا نشون داده نمی‌شه؛
// فقط داده‌ی تجمیعی (RFM/CLV/سگمنت) که برای تصمیم‌گیری کسب‌وکار لازمه.
const RFM_LABEL={champions:'قهرمانان',loyal:'وفادار',potential:'بالقوه',at_risk:'در خطر ریزش',new:'جدید',hibernating:'غیرفعال',lost:'از دست‌رفته'};
let BI_DATA=null;
function rCustomers(){
  document.getElementById('v-customers').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  loadBusinessIntelligence();
}
async function loadBusinessIntelligence(){
  const res=await API.businessIntelligence();
  if(!res.ok){
    document.getElementById('v-customers').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد — این صفحه بدون بک‌اند کار نمی‌کنه.</div>`;
    return;
  }
  BI_DATA=res.data;
  renderCustomers();
}
function renderCustomers(){
  const d=BI_DATA;if(!d)return;
  const fnl=n=>n==null?'—':n>=1000000?fa(+(n/1000000).toFixed(1))+'م':n>=1000?fa(Math.round(n/1000))+'ک':fa(n);
  document.getElementById('v-customers').innerHTML=`
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon('users',{size:17})}</div></div><div class="kpi-val">${fa(d.guests.total)}</div><div class="kpi-label">کل مهمانان شناسایی‌شده</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('star',{size:17,fill:true})}</div></div><div class="kpi-val">${fa(d.guests.vips)}</div><div class="kpi-label">مهمانان VIP</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('wallet',{size:17})}</div></div><div class="kpi-val">${fnl(d.guests.total_clv_toman)}</div><div class="kpi-label">ارزش طول عمر کل (تومان)${d.guests.total_clv_toman==null?' — اندازه‌گیری‌ناپذیر':d.guests.measured_guests!=null&&d.guests.measured_guests<d.guests.total?` (از ${fa(d.guests.measured_guests)} مهمانِ دارای مبلغ)`:''}</div></div>
    </div>
    <div class="row-2">
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">توزیع سگمنت RFM</div><div class="panel-sub">کل پلتفرم</div></div></div>
        ${d.rfm_distribution.length?d.rfm_distribution.map(r=>{const mx=Math.max(...d.rfm_distribution.map(x=>x.count))||1;return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span style="width:110px;font-size:12.5px;font-weight:600">${RFM_LABEL[r.segment]||r.segment}</span><div style="flex:1;height:8px;background:var(--s-100);border-radius:4px;overflow:hidden"><div style="height:100%;width:${r.count/mx*100}%;background:var(--ink);border-radius:4px"></div></div><span style="font-weight:700;font-size:12px;width:36px;text-align:left">${fa(r.count)}</span></div>`}).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">هنوز محاسبه نشده — کرون شبانه‌ی customer-insights باید یک‌بار اجرا شده باشه</div>'}
      </div>
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">سگمنت رفتاری</div><div class="panel-sub">کل پلتفرم</div></div></div>
        ${d.behavior_segments.length?d.behavior_segments.map(r=>{const mx=Math.max(...d.behavior_segments.map(x=>x.count))||1;return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span style="width:110px;font-size:12.5px;font-weight:600">${esc(r.segment)}</span><div style="flex:1;height:8px;background:var(--s-100);border-radius:4px;overflow:hidden"><div style="height:100%;width:${r.count/mx*100}%;background:var(--violet);border-radius:4px"></div></div><span style="font-weight:700;font-size:12px;width:36px;text-align:left">${fa(r.count)}</span></div>`}).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">داده‌ای نیست</div>'}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">رستوران‌های برتر بر اساس ارزش مشتری (CLV)</div><div class="panel-sub">ارزش واقعی هر رستوران برای پلتفرم</div></div></div>
      ${d.top_restaurants_by_value.length?d.top_restaurants_by_value.map((r,i)=>`<div class="list-stat"><div class="ls-rank">${fa(i+1)}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.customers)} مشتری تحلیل‌شده${r.total_clv_toman==null?' · مبلغ اندازه‌گیری‌ناپذیر (منویِ قیمت‌دار ندارد)':''}</div></div><div class="ls-val">${fnl(r.total_clv_toman)}</div></div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">داده‌ای نیست</div>'}
    </div>`;
}

// ════════ اشتراک و پیامک ════════
function rBilling(){
  const totalSms=RESTAURANTS.reduce((s,r)=>s+r.sms,0);
  const activeSubsc=RESTAURANTS.filter(r=>r.status==='active').length;
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): MRR قبلاً همیشه از یک ثابتِ کلاینتیِ
  // ناقص و کهنه (PRICE={free,pro,enterprise} — بدونِ basic/trial و ناسازگار
  // با قیمت‌های واقعیِ CMS) جمع زده می‌شد — حتی وقتی داده‌ی رستوران‌ها واقعی
  // بود. یک رقمِ درآمدِ اشتباه بدترین نوعِ KPI است. حالا: چون بک‌اند قیمتِ
  // پلن را برنمی‌گرداند، در حالتِ آنلاین «—» نشان می‌دهیم (اندازه‌گیری‌نشده،
  // نه صفر — همان قاعده‌ی ML_CONTRACT)؛ عددِ نمونه فقط در دموی آفلاین با
  // داده‌ی [DEMO] می‌ماند.
  const PRICE={free:0,pro:890,enterprise:2400};
  const mrr=API.online?null:RESTAURANTS.filter(r=>r.status==='active'||r.status==='expiring').reduce((s,r)=>s+(PRICE[r.plan]||0),0);
  document.getElementById('v-billing').innerHTML=`
    <div class="bill-summary">
      <div class="bill-stat"><div class="bs-val" style="color:var(--ink)">${fa(activeSubsc)}</div><div class="bs-label">اشتراک فعال</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--green-600)">${mrr==null?'—':fa(mrr)+'<span style="font-size:14px"> هزارتومان</span>'}</div><div class="bs-label">${mrr==null?'درآمد ماهانه — اندازه‌گیری‌نشده (قیمتِ پلن در API نیست)':'درآمد ماهانه (نمونه‌ی دمو)'}</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--amber-600)">${fa(totalSms)}</div><div class="bs-label">کل پیامک ارسالی</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">اشتراک و مصرف پیامک رستوران‌ها</div><div class="panel-sub">مدیریت تمدید، لغو و سهمیه‌ی پیامک</div></div></div>
      <div class="mini-list">
        ${RESTAURANTS.map(r=>{
          const badgeCls=r.status==='trial_expired'?'expired':r.status;
          let st=STATUS_LABEL[r.status];
          if(r.status==='active')st=r.daysLeft!=null?`فعال · ${fa(r.daysLeft)} روز`:'فعال · نامحدود';
          else if(r.status==='expired'||r.status==='trial_expired')st=r.daysLeft!=null?`${fa(Math.abs(r.daysLeft))} روز منقضی`:'منقضی';
          else if(r.status==='expiring')st=`${fa(r.daysLeft)} روز مونده`;
          else st=`آزمایشی · ${fa(r.daysLeft)} روز`;
          return `<div class="mini-row" style="flex-wrap:wrap">
            <div class="rest-logo" style="background:${esc(r.grad)};width:38px;height:38px;font-size:16px">${esc(r.logo)}</div>
            <div class="mini-info" style="min-width:140px"><div class="mini-name">${esc(r.name)}</div><div class="mini-sub"><span class="plan-badge ${esc(r.plan)}">${PLAN_LABEL[r.plan]}</span> · موجودی: ${fa(r.smsBalance||0)} پیامک</div>
            </div>
            <span class="badge ${badgeCls}" style="align-self:flex-start"><span class="bdot"></span>${st}</span>
            <div style="display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" onclick="openSmsTopup(${jsq(r.id)})">${icon('phone',{size:13})} شارژ پیامک</button>
              <button class="btn btn-ghost btn-sm" onclick="openRenew(${jsq(r.id)})">مدیریت</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
// ════════ شارژ موجودی پیامک (وصل به API واقعی) ════════
let _topupRestId=null;
function openSmsTopup(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  _topupRestId=id;
  openModal(`
    <div class="modal-title">${icon('phone',{size:18})} شارژ موجودی پیامک</div>
    <div class="modal-sub">${esc(r.name)} · موجودی فعلی: ${fa(r.smsBalance||0)} پیامک</div>
    <div class="field-label">تعداد پیامک برای افزودن</div>
    <div class="opt-row" id="smsAmountOpts">
      ${[[1000,'۱۰۰۰'],[5000,'۵۰۰۰'],[10000,'۱۰٬۰۰۰'],[50000,'۵۰٬۰۰۰']].map(([v,l],i)=>`<div role="button" tabindex="0" class="opt ${i===0?'sel':''}" data-amt="${v}" onclick="pickSmsAmount(${v},this)">${l}</div>`).join('')}
    </div>
    <div class="field-label">یا مقدار دلخواه</div>
    <input class="inp" id="smsCustomAmount" type="number" min="1" placeholder="مثلاً ۲۵۰۰" oninput="document.querySelectorAll('#smsAmountOpts .opt').forEach(o=>o.classList.remove('sel'))">
    <div style="font-size:12px;color:var(--t2);margin:14px 0;line-height:1.6;background:var(--ink-50);padding:12px 14px;border-radius:var(--r)">${icon('info',{size:13})} رستوران پس از پرداخت به شما، موجودی‌اش را اینجا شارژ کنید. هر شارژ ثبت و قابل‌پیگیری است.</div>
    <button class="btn btn-primary btn-block btn-lg" onclick="submitSmsTopup(this)">تأیید و شارژ</button>
  `);
}
let _topupAmount=1000;
function pickSmsAmount(v,el){_topupAmount=v;document.querySelectorAll('#smsAmountOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('smsCustomAmount').value='';}
// ⚠️ همان گاردِ ضدِ دوبارکلیک: شارژِ پیامک هم یک نوشتنِ افزایشیِ برگشت‌ناپذیر است.
async function submitSmsTopup(btn){
  const custom=parseInt(document.getElementById('smsCustomAmount')?.value||'');
  const amount=Number.isInteger(custom)&&custom>0?custom:_topupAmount;
  if(!amount||amount<=0){toast('','تعداد نامعتبر');return;}
  if(btn){ if(btn.disabled) return; btn.disabled=true; btn.textContent='در حال شارژ…'; }
  const res=await API.post(`/admin/restaurants/${_topupRestId}/sms`,{amount});
  if(res.ok){
    closeModal();
    toast('',`${fa(amount)} پیامک شارژ شد · موجودی جدید: ${fa(res.data.balance)}`);
    const r=RESTAURANTS.find(x=>String(x.id)===String(_topupRestId));
    if(r)r.smsBalance=res.data.balance;
    if(typeof rBilling==='function'&&document.getElementById('v-billing'))rBilling();
  } else {
    if(btn){ btn.disabled=false; btn.textContent='تأیید و شارژ'; }
    toast('',res.error?.message||'شارژ ناموفق بود');
  }
}

// ════════ مدیریت اشتراک (تمدید واقعی / لغو واقعی) — وصل به PATCH /admin/restaurants/:id/control ════════
function openRenew(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  // ⚠️ فازِ ۲: فهرستِ چیپ‌ها فقط pro/enterprise است، ولی renewPlan از پلنِ
  // فعلی پر می‌شد. برایِ تنانتِ `starter` (پلنی که خودِ همین پنل از صفِ فروش
  // اختصاص می‌دهد) هیچ چیپی انتخاب‌شده نبود و خلاصه «پلن جدید: شروع» می‌گفت،
  // در حالی که ارسالش را بک‌اند رد می‌کرد. فقط پلن‌هایِ تمدیدشدنی مجازند.
  renewPlan=(r.plan==='pro'||r.plan==='enterprise')?r.plan:'pro';renewMonths=12;
  openModal(`
    <div class="modal-title">مدیریت اشتراک</div>
    <div class="modal-sub">${esc(r.name)} · وضعیت فعلی: ${STATUS_LABEL[r.status]}</div>
    <div class="field-label">پلن</div>
    <div class="opt-row" id="planOpts">
      ${[['pro','حرفه‌ای'],['enterprise','سازمانی']].map(([v,l])=>`<div role="button" tabindex="0" class="opt ${v===renewPlan?'sel':''}" data-plan="${v}" onclick="pickPlan(${jsq(v)},this)">${l}</div>`).join('')}
    </div>
    <div class="field-label">مدت تمدید</div>
    <div class="opt-row" id="monthOpts">
      ${[[1,'۱ ماه'],[3,'۳ ماه'],[6,'۶ ماه'],[12,'۱ سال']].map(([v,l])=>`<div role="button" tabindex="0" class="opt ${v===12?'sel':''}" data-m="${v}" onclick="pickMonths(${v},this)">${l}</div>`).join('')}
    </div>
    <div class="summary-box">
      <div class="sum-row"><span class="k">رستوران</span><span class="v">${esc(r.name)}</span></div>
      <div class="sum-row"><span class="k">پلن جدید</span><span class="v" id="sumPlan">${PLAN_LABEL[renewPlan]}</span></div>
      <div class="sum-row"><span class="k">مدت</span><span class="v" id="sumMonths">۱ سال</span></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="doRenew(${jsq(id)},this)">${icon('check',{size:15})} تمدید اشتراک</button>
    <button class="btn btn-danger btn-block" style="margin-top:8px" onclick="confirmCancel(${jsq(id)})">لغو اشتراک</button>
  `);
}
let renewPlan='pro',renewMonths=12;
function pickPlan(v,el){renewPlan=v;document.querySelectorAll('#planOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('sumPlan').textContent=PLAN_LABEL[v]}
function pickMonths(v,el){renewMonths=v;document.querySelectorAll('#monthOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('sumMonths').textContent={1:'۱ ماه',3:'۳ ماه',6:'۶ ماه',12:'۱ سال'}[v]}
// ⚠️ رفعِ «دوبار نوشتنِ افزایشی» (فازِ ۲، §۳): دکمه حینِ درخواست زنده می‌ماند،
// پس دو کلیک اشتراکِ یک مشتریِ پولی را دو برابر تمدید می‌کرد (دو ردیفِ مجزّایِ
// `plan.changed`) — و از این پنل برگشت‌پذیر نیست. همان گاردی که abuseFlagAct
// از قبل دارد، این‌جا هم اعمال شد.
async function doRenew(id,btn){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  if(btn){ if(btn.disabled) return; btn.disabled=true; btn.textContent='در حال تمدید…'; }
  const res=await API.control(id,{action:'extend_plan',plan:renewPlan,months:renewMonths});
  if(!res.ok){
    if(btn){ btn.disabled=false; btn.textContent='تمدید اشتراک'; }
    toast('',res.error?.message||'تمدید ناموفق بود');return;
  }
  r.plan=renewPlan;r.status='active';r.planExpiresAt=res.data.plan_expires_at;
  const days=Math.ceil((new Date(res.data.plan_expires_at).getTime()-Date.now())/86400000);
  r.daysLeft=days;
  closeModal();refreshActive();
  toast('',`اشتراک ${r.name} تمدید شد (${renewMonths===12?'۱ سال':fa(renewMonths)+' ماه'})`);
}
function confirmCancel(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  openModal(`
    <div style="text-align:center">
      <div style="width:54px;height:54px;border-radius:14px;background:var(--red-50);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--warning)">${icon('alert',{size:26})}</div>
      <div class="modal-title" style="text-align:center">لغو اشتراک ${esc(r.name)}؟</div>
      <div class="modal-sub" style="text-align:center">اشتراک فوراً منقضی می‌شه. این کار قابل بازگشته (با تمدید مجدد).</div>
      <button class="btn btn-danger btn-block btn-lg" onclick="doCancel(${jsq(id)})">بله، لغو کن</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
    </div>`);
}
async function doCancel(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  const res=await API.control(id,{action:'cancel_subscription'});
  if(!res.ok){toast('',res.error?.message||'لغو ناموفق بود');return;}
  r.status='expired';r.daysLeft=0;
  closeModal();refreshActive();
  toast('',`اشتراک ${r.name} لغو شد`);
}
function refreshActive(){
  const active=document.querySelector('.view.active');if(!active)return;
  const id=active.id.replace('v-','');
  ({overview:rOverview,restaurants:rRestaurants,detail:rDetail,analytics:rAnalytics,customers:rCustomers,billing:rBilling,systemhealth:rSystemHealth,aihealth:rModelHealth,security:rSecurity,support:rSupport,badges:rBadges,missions:rMissions})[id]?.();
}

// ════════ مدیریت رستوران‌ها — اقدامات واقعی سریع (جایگزین «پشتیبانی از راه دور» ساختگی) ════════
// نکته: اتصال از راه دور به پنل رستوران و ویرایش از‌طرفش هنوز در بک‌اند پیاده نشده —
// به‌جای دکمه‌ی ساختگی، اینجا فقط اقداماتی هست که واقعاً روی دیتابیس اثر می‌ذارن.
function rSupport(){
  const needsAttention=RESTAURANTS.filter(r=>r.status==='expiring'||r.status==='expired'||r.status==='trial'||r.status==='trial_expired'||!r.isOpen);
  document.getElementById('v-support').innerHTML=`
    <div class="panel" style="margin-bottom:20px;background:var(--ink-50);border-color:var(--ink-100)">
      <div style="font-size:13px;color:var(--ink-700);line-height:1.8">
        ${icon('info',{size:13})} اتصال از راه دور به پنل رستوران و ویرایش مستقیم منو/میز هنوز در بک‌اند ساخته نشده — اینجا فقط اقداماتی هست که الان واقعاً کار می‌کنن: فعال/غیرفعال کردن رستوران و مدیریت اشتراک.
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">رستوران‌های نیازمند اقدام</div><div class="panel-sub">${fa(needsAttention.length)} مورد</div></div></div>
      <div class="mini-list">
        ${needsAttention.length?needsAttention.map(r=>`<div class="mini-row">
          <div class="rest-logo" style="background:${esc(r.grad)};width:36px;height:36px;font-size:15px">${esc(r.logo)}</div>
          <div class="mini-info"><div class="mini-name">${esc(r.name)}</div><div class="mini-sub">${!r.isOpen?`<span class="dot-closed" aria-hidden="true"></span> غیرفعال · `:''}${STATUS_LABEL[r.status]||''}</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="toggleRestOpen(${jsq(r.id)})">${r.isOpen?'غیرفعال کن':'فعال کن'}</button>
            <button class="btn btn-primary btn-sm" onclick="openRenew(${jsq(r.id)})">مدیریت اشتراک</button>
          </div>
        </div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:34})}</div><div class="empty-state-desc">همه‌چیز مرتبه</div></div>`}
      </div>
    </div>`;
}

// ═══════════ سلامت سیستم — واقعی، از /admin/system-health ═══════════
function rSystemHealth(){
  document.getElementById('v-systemhealth').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  (async()=>{
    const res=await API.systemHealth();
    if(!res.ok){document.getElementById('v-systemhealth').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد.</div>`;return;}
    const d=res.data;
    const healthMeta={healthy:['checkCircle','سالم'],warning:['alert','نیاز به بررسی'],critical:['alert','بحرانی']}[d.health]||['info','نامشخص'];
    document.getElementById('v-systemhealth').innerHTML=`
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon(healthMeta[0],{size:17})}</div></div><div class="kpi-val" style="font-size:18px">${healthMeta[1]}</div><div class="kpi-label">وضعیت کلی سیستم</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('clock',{size:17})}</div></div><div class="kpi-val">${fa(d.jobs.pending)}</div><div class="kpi-label">کار در صف انتظار</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.jobs.dead>0?'red':'green'}">${icon('alert',{size:17})}</div></div><div class="kpi-val">${fa(d.jobs.dead)}</div><div class="kpi-label">کارهای ناموفق (DLQ)</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">${icon('share',{size:17})}</div></div><div class="kpi-val">${fa(d.active_webhooks)}</div><div class="kpi-label">وبهوک فعال</div></div>
      </div>
      ${d.queue_stuck?`<div class="panel" style="background:var(--red-50);border-color:#FCA5A5;margin-bottom:20px"><div style="color:var(--red-600);font-weight:700">${icon('alert',{size:14})} صف کار گیر کرده! قدیمی‌ترین کار از نوع «${esc(d.oldest_pending_job?.kind||'')}» پردازش نشده.</div></div>`:''}
      <div class="row-2">
        <div class="panel">
          <div class="panel-head"><div class="panel-title">وضعیت صف Job</div></div>
          ${Object.entries(d.jobs).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--t2)">${k}</span><b>${fa(v)}</b></div>`).join('')}
        </div>
        <div class="panel">
          <div class="panel-head"><div><div class="panel-title">اقدامات ناموفق ۲۴ ساعت اخیر</div></div></div>
          <div class="kpi-val" style="font-size:32px">${fa(d.failed_actions_24h)}</div>
          <div style="font-size:12.5px;color:var(--t2);margin-top:6px">از audit log سراسری</div>
        </div>
      </div>
      <div class="panel" style="margin-top:20px">
        <div class="panel-head"><div><div class="panel-title">کارهای مرده (نیاز بررسی دستی)</div><div class="panel-sub">${fa(d.dead_jobs.length)} مورد</div></div></div>
        ${d.dead_jobs.length?d.dead_jobs.map(j=>`<div class="mini-row"><div class="mini-info"><div class="mini-name">${esc(j.kind)}</div><div class="mini-sub" style="color:var(--red-600)">${esc(j.error||'بدون پیام خطا')} · ${fa(j.attempts)} تلاش</div></div></div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:32})}</div><div class="empty-state-desc">چیزی نیست</div></div>`}
      </div>`;
  })();
}

// ═══════════ سلامتِ مدل‌هایِ هوشِ مصنوعی — واقعی، از /admin/ai/model-health ═══════════
// (نقشه‌راهِ AI، فازِ ۱) نشون می‌ده کدوم رستوران‌ها الان مدلِ یادگرفته‌ی فعال
// دارن (یعنی روی هولدآوت واقعاً از heuristic بهتر بوده) و تاریخچه‌ی
// append-only آموزش‌ها (model_training_runs، migration 042) — شاملِ
// آموزش‌هایی که نتیجه‌شون فعال‌سازی نبوده، نه فقط آخرین وضعیت.
const RUN_KIND_FA = { no_show: 'ریسکِ عدم‌حضور', demand_forecast: 'پیش‌بینیِ تقاضا' };
const PRED_TYPE_FA = { no_show: 'ریسکِ عدم‌حضور', demand: 'پیش‌بینیِ تقاضا' };
const MODEL_SOURCE_FA = { learned: 'مدلِ یادگرفته', heuristic: 'قانونِ دستی (heuristic)' };

// ═══════ دقتِ واقعیِ تولید (فازِ ۵) ═══════
// تفاوتِ این پنل با پنلِ بالا حیاتی است و عمداً در متنِ UI هم گفته می‌شه:
// «Brierِ یادگرفته» در جدولِ وضعیت، کاراییِ لحظه‌ی آموزش روی دادهٔ نگه‌داشته‌شده‌ی
// گذشته است. این پنل چیزی رو نشون می‌ده که واقعاً در تولید رخ داد — پیش‌بینی
// شد، بعد نتیجه‌ش مشاهده شد. تا قبل از فازِ ۵ این عدد اصلاً قابلِ محاسبه نبود.
function productionAccuracyPanelHTML(pa){
  if(!pa) return '';
  const g = pa.groups || [];
  const num=(v,d)=>v==null?null:fa(Math.round(v*Math.pow(10,d))/Math.pow(10,d));
  const totalOverdue = g.reduce((s,x)=>s+(x.overdue_count||0),0);
  return `<div class="panel" style="margin-top:20px">
    <div class="panel-head"><div>
      <div class="panel-title">دقتِ واقعی در تولید — از دفترِ پیش‌بینی و نتیجه</div>
      <div class="panel-sub">${fa(pa.window_days)} روزِ گذشته · «پیش‌بینی کردیم، بعد واقعاً چه شد» — نه کاراییِ لحظه‌ی آموزش</div>
    </div></div>
    ${totalOverdue>0?`<div class="mini-row" style="background:var(--amber-50,#FFFBEB)">
      <div class="mini-info">
        <div class="mini-name" style="color:var(--amber-700,#B45309)">${icon('alert',{size:14})} ${fa(totalOverdue)} پیش‌بینی نتیجه‌ش ثبت نشده</div>
        <div class="mini-sub">افقِ زمانی‌شون گذشته ولی رزرو به وضعیتِ نهایی نرسیده. تا وقتی این عدد بالا بمونه، دقتِ زیر روی زیرمجموعه‌ای از رزروها حساب می‌شه، نه همه‌شون.</div>
      </div>
    </div>`:''}
    ${g.length?g.map(x=>{
      const enough = x.resolved_count >= pa.min_resolved;
      return `<div class="mini-row">
        <div class="mini-info">
          <div class="mini-name">${PRED_TYPE_FA[x.prediction_type]||esc(x.prediction_type)} · ${MODEL_SOURCE_FA[x.model_source]||esc(x.model_source)}</div>
          <div class="mini-sub">${fa(x.resolved_count)} نتیجه‌ی مشاهده‌شده · ${fa(x.pending_count)} در انتظارِ وقوع${x.overdue_count?` · ${fa(x.overdue_count)} بدونِ نتیجه`:''}</div>
        </div>
        ${enough
          ? `<span class="badge active" title="میانگینِ خطایِ مربع (Brier) روی نتایجِ واقعیِ تولید">Brier ${num(x.brier,3)}</span>`
          : `<span class="badge expired" title="کف: ${pa.min_resolved} نتیجه">دادهٔ کافی نیست</span>`}
      </div>`;
    }).join(''):`<div class="empty-state"><div class="empty-state-desc">هنوز پیش‌بینی‌ای با نتیجه‌ی مشاهده‌شده ثبت نشده — دفتر از لحظه‌ی استقرارِ فازِ ۵ پر می‌شه</div></div>`}
  </div>`;
}
// ═══════ رانشِ مدل (فازِ ۷) ═══════
// این پنل تنها جایی است که می‌گوید «بازآموزی لازم است» — و عمداً فقط وقتی
// می‌گوید که شواهد کافی باشد. حکمِ insufficient_data صریحاً نمایش داده
// می‌شود، نه اینکه به‌عنوانِ «پایدار» جا بزند؛ چون «نمی‌دانیم» و «خوب است»
// دو چیزِ کاملاً متفاوت‌اند.
const DRIFT_FA = {
  drifted:            { label:'رانش کرده — بازآموزی لازم است', cls:'expired' },
  watch:              { label:'زیرِ نظر',                      cls:'expired' },
  stable:             { label:'پایدار',                        cls:'active'  },
  insufficient_data:  { label:'دادهٔ کافی نیست',                cls:'expired' },
};
function driftPanelHTML(dr){
  if(!dr) return '';
  const rows = dr.restaurants || [];
  const pct=(v)=>v==null?'—':fa((v*100).toFixed(1))+'٪';
  const br=(v)=>v==null?'—':fa(Math.round(v*1000)/1000);
  const drifted = rows.filter(r=>r.verdict==='drifted').length;
  return `<div class="panel" style="margin-top:20px">
    <div class="panel-head"><div>
      <div class="panel-title">رانشِ مدل — آیا مدل هنوز همان‌قدر خوب است؟</div>
      <div class="panel-sub">مقایسه‌ی Brierِ ${fa(dr.window_days)} روزِ اخیرِ تولید با Brierِ همان نسخه روی هولدآوتِ زمانِ آموزش · آستانه: ${fa((dr.threshold*100).toFixed(0))}٪ بدترشدن</div>
    </div></div>
    ${drifted>0?`<div class="mini-row" style="background:var(--red-50,#FEF2F2)">
      <div class="mini-info"><div class="mini-name" style="color:var(--red-600,#DC2626)">${icon('alert',{size:14})} ${fa(drifted)} مدل رانش کرده</div>
      <div class="mini-sub">این مدل‌ها هنوز فعال‌اند ولی در تولید محسوس بدتر از زمانِ آموزش عمل می‌کنند.</div></div>
    </div>`:''}
    ${rows.length?rows.map(r=>{
      const v = DRIFT_FA[r.verdict] || { label:esc(r.verdict), cls:'expired' };
      return `<div class="mini-row">
        <div class="mini-info">
          <div class="mini-name">${esc(r.restaurant_name)}</div>
          <div class="mini-sub">${r.verdict==='insufficient_data'
            ? `${fa(r.resolved_count)} نتیجه در پنجره — برای حکم‌دادن کافی نیست`
            : `تولید ${br(r.production_brier)} در برابرِ هولدآوت ${br(r.holdout_brier)} · تغییر: ${pct(r.relative_change)} · ${fa(r.resolved_count)} نتیجه`}</div>
        </div>
        <span class="badge ${v.cls}">${v.label}</span>
      </div>`;
    }).join(''):`<div class="empty-state"><div class="empty-state-desc">هیچ رستورانی مدلِ فعالِ دارایِ نسب‌نامه ندارد — پس از اولین بازآموزیِ شبانه قابلِ سنجش می‌شود</div></div>`}
  </div>`;
}

function rModelHealth(){
  document.getElementById('v-aihealth').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  (async()=>{
    const res=await API.modelHealth();
    if(!res.ok){document.getElementById('v-aihealth').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد.</div>`;return;}
    const d=res.data;
    const brierPct=(v)=>v==null?'—':fa(Math.round(v*1000)/1000);
    const maePct=(v)=>v==null?'—':fa(Math.round(v*100)/100);
    document.getElementById('v-aihealth').innerHTML=`
      <div class="panel" style="margin-bottom:20px;background:var(--ink-50);border-color:var(--ink-100)">
        <div style="font-size:13px;color:var(--ink-700);line-height:1.8">
          ${icon('info',{size:13})} هر مدل فقط وقتی «فعال» می‌شه که شبانه روی تاریخچه‌ی خودِ همون رستوران آموزش دیده باشه و روی دادهٔ نگه‌داشته‌شده (هولدآوت) واقعاً از قانونِ دستیِ فعلی (heuristic) بهتر عمل کنه — وگرنه بی‌صدا از heuristic استفاده می‌شه. جزئیاتِ کامل در docs/ML_CONTRACT.md.
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon('sparkle',{size:17})}</div></div><div class="kpi-val">${fa(d.summary.no_show.restaurants_active)}</div><div class="kpi-label">رستوران با مدلِ no-showِ فعال</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">${icon('trending',{size:17})}</div></div><div class="kpi-val">${fa(d.summary.no_show.restaurants_trained)}</div><div class="kpi-label">رستورانِ آموزش‌دیده (no-show)</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('chart',{size:17})}</div></div><div class="kpi-val">${fa(d.summary.demand_forecast.restaurants_count_active)}</div><div class="kpi-label">پیش‌بینیِ تقاضا فعال (تعداد)</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('chart',{size:17})}</div></div><div class="kpi-val">${fa(d.summary.demand_forecast.restaurants_covers_active)}</div><div class="kpi-label">پیش‌بینیِ تقاضا فعال (کاور)</div></div>
      </div>
      <div class="panel" style="margin-top:20px">
        <div class="panel-head"><div><div class="panel-title">مدلِ ریسکِ عدم‌حضور — وضعیتِ فعلی هر رستوران</div><div class="panel-sub">${fa(d.restaurants.no_show.length)} رستوران آموزش دیده‌اند</div></div></div>
        ${d.restaurants.no_show.length?d.restaurants.no_show.map(r=>`
          <div class="mini-row">
            <div class="mini-info">
              <div class="mini-name">${esc(r.restaurant_name)}</div>
              <div class="mini-sub">نمونه: ${fa(r.sample_size)} (${fa(r.positive_count)} عدم‌حضورِ واقعی) · Brierِ یادگرفته ${brierPct(r.learned_brier)} در برابرِ heuristic ${brierPct(r.static_brier)} · آخرین آموزش: ${new Date(r.trained_at).toLocaleDateString('fa-IR')}</div>
            </div>
            <span class="badge ${r.is_active?'active':'expired'}">${r.is_active?'فعال (یادگرفته)':'heuristic'}</span>
          </div>`).join(''):`<div class="empty-state"><div class="empty-state-desc">هنوز هیچ رستورانی آموزش ندیده — کرونِ شبانه‌ی customer-insights باید یک‌بار اجرا شده باشه</div></div>`}
      </div>
      <div class="panel" style="margin-top:20px">
        <div class="panel-head"><div><div class="panel-title">پیش‌بینیِ تقاضا — وضعیتِ فعلی هر رستوران</div><div class="panel-sub">${fa(d.restaurants.demand_forecast.length)} رستوران آموزش دیده‌اند</div></div></div>
        ${d.restaurants.demand_forecast.length?d.restaurants.demand_forecast.map(r=>`
          <div class="mini-row">
            <div class="mini-info">
              <div class="mini-name">${esc(r.restaurant_name)}</div>
              <div class="mini-sub">${fa(r.history_days)} روز تاریخچه · تعداد: MAEِ ${maePct(r.count_mae)} در برابرِ پایه ${maePct(r.count_baseline_mae)} · کاور: MAEِ ${maePct(r.covers_mae)} در برابرِ پایه ${maePct(r.covers_baseline_mae)} · آخرین آموزش: ${new Date(r.trained_at).toLocaleDateString('fa-IR')}</div>
            </div>
            <div style="display:flex;gap:6px">
              <span class="badge ${r.count_active?'active':'expired'}">تعداد: ${r.count_active?'فعال':'heuristic'}</span>
              <span class="badge ${r.covers_active?'active':'expired'}">کاور: ${r.covers_active?'فعال':'heuristic'}</span>
            </div>
          </div>`).join(''):`<div class="empty-state"><div class="empty-state-desc">هنوز هیچ رستورانی آموزش ندیده</div></div>`}
      </div>
      ${productionAccuracyPanelHTML(d.production_accuracy)}
      ${driftPanelHTML(d.drift)}
      <div class="panel" style="margin-top:20px">
        <div class="panel-head"><div><div class="panel-title">تاریخچه‌ی آموزش‌ها (append-only)</div><div class="panel-sub">آخرین ${fa(d.recent_runs.length)} اجرا — شاملِ آموزش‌هایی که فعال نشدن</div></div></div>
        ${d.recent_runs.length?d.recent_runs.map(r=>`
          <div class="mini-row">
            <div class="mini-info">
              <div class="mini-name">${esc(r.restaurant_name)} · ${RUN_KIND_FA[r.kind]||esc(r.kind)}</div>
              <div class="mini-sub">${esc(r.reason||'')} · نمونه: ${fa(r.sample_size)} · ${new Date(r.trained_at).toLocaleDateString('fa-IR')}</div>
            </div>
            <span class="badge ${r.is_active?'active':'expired'}">${r.is_active?'فعال شد':'فعال نشد'}</span>
          </div>`).join(''):`<div class="empty-state"><div class="empty-state-desc">هنوز تاریخچه‌ای ثبت نشده</div></div>`}
      </div>`;
  })();
}

// ═══════════ امنیت پلتفرم — واقعی، از /admin/security ═══════════

// هویتِ سطحِ اعتبار — عمداً همون نام/آیکون/رنگی که اپِ مشتری
// (js/features/economy.js) و پنلِ بیزنس (js/reservations.js) استفاده می‌کنن.
// یه محصول باید همه‌جا یه زبان حرف بزنه؛ نشون‌دادنِ bronze/gold خام به مدیر
// در حالی که مشتری «مهمانِ ممتاز» می‌بینه، دو محصولِ جدا می‌سازه نه یکی.
const REP_ID = {
  bronze:   { name:'مهمانِ تازه',  ic:'sparkle', fg:'var(--t2)' },
  silver:   { name:'مهمانِ معتبر', ic:'star',    fg:'#0D9488' },
  gold:     { name:'مهمانِ ممتاز', ic:'shield',  fg:'#4F46E5' },
  platinum: { name:'مهمانِ نمونه', ic:'crown',   fg:'#7C3AED' },
};
function repName(tier){ return REP_ID[tier]?.name || tier; }

// وضعیتِ رزرو — همون واژگانِ پنلِ بیزنس (crm.js ST_FA)، به‌علاوه‌ی چند وضعیتِ
// دیگرِ چرخه‌ی حیاتِ رزرو که در Customer 360 هم ممکنه دیده بشن.
const RESV_STATUS_FA = {
  pending:'در انتظار', waitlisted:'لیستِ انتظار', confirmed:'تأییدشده', auto_confirmed:'تأییدِ خودکار',
  preparing:'در حالِ آماده‌سازی', checked_in:'رسیده', running_late:'دیر کرده', seated:'نشسته',
  dining:'در حالِ صرفِ غذا', completed:'انجام‌شده', no_show:'عدم‌حضور', rejected:'ردشده',
  expired:'منقضی', cancelled:'لغوشده', auto_cancelled:'لغوِ خودکار',
};
// نوعِ حرکتِ دفترِ اقتصاد — رجوع کن به schema.prisma EconomyLedgerKind
const LEDGER_KIND_FA = {
  xp_earn:'کسبِ تجربه (XP)', wallet_earn:'افزایشِ سکه', wallet_spend:'خرجِ سکه',
  reliability_event:'رویدادِ اعتبار', strike_add:'ثبتِ تخلف', strike_decay:'کاهشِ تخلف (زمان)',
};

// ترجمه‌ی اقدام‌های حساسِ audit به فارسی — مدیرِ پلتفرم نباید مجبور باشه
// اسمِ فنیِ رویداد (plan.changed) رو بخونه تا بفهمه چی شده. اگر اقدامِ
// جدیدی اضافه شد و اینجا نبود، همون کلیدِ خام نشون داده می‌شه (بی‌صدا خراب
// نمی‌شه، فقط ترجمه‌نشده می‌مونه).
const ACTION_LABEL = {
  'restaurant.activated':   { fa:'رستوران فعال شد',            ic:'checkCircle' },
  'restaurant.deactivated': { fa:'رستوران غیرفعال شد',          ic:'close' },
  'staff.permission_change':{ fa:'دسترسیِ کارمند تغییر کرد',    ic:'lock' },
  'plan.changed':           { fa:'پلنِ اشتراک تغییر کرد',        ic:'creditCard' },
  'subscription.cancelled': { fa:'اشتراک لغو شد',               ic:'close' },
  'coupon.created':         { fa:'کوپنِ جدید ساخته شد',         ic:'ticket' },
  'security.abuse_flag':    { fa:'نشانِ سوءاستفاده تغییر کرد',   ic:'shield' },
};
/** حرفِ اولِ نام برایِ آواتارِ متنی (وقتی عکسی نیست) — مثلِ بقیه‌ی لیست‌های پنل. */
function initialOf(name){ return (String(name||'').trim()[0]) || '؟'; }

// سوییچ‌هایِ قابلیت — عمداً همون واژگانِ featureFlagLabel در lib/feature-flags.ts (بک‌اند)
const FEATURE_FLAG_LABEL_FA = {
  reservations_enabled: 'ثبتِ رزروِ آنلاین',
  waitlist_enabled: 'پیوستن به لیستِ انتظار',
  reward_marketplace_enabled: 'خرجِ سکه در فروشگاهِ جایزه',
  missions_claim_enabled: 'دریافتِ جایزه‌یِ ماموریت',
  ai_recommendations_enabled: 'پیشنهادهایِ هوشمند',
  // ⚠️ فازِ ۲: این کلید در بک‌اند وجود داشت ولی در پنلِ اپراتور غایب بود — یعنی
  // تنها سوییچی که جلویِ ساختِ اعتبارِ *بدونِ پرداخت* را می‌گیرد (POST /gift-cards)
  // از رابطِ اضطراری نه دیده می‌شد نه قابلِ تغییر بود. پیش‌فرضش در بک‌اند خاموش است.
  gift_card_purchase_enabled: 'خریدِ کارتِ هدیه',
};
function featureFlagsPanelHTML(flags){
  flags = flags || {};   // دفاعِ لایه‌دوم: ردیف‌ها «نامعلوم» می‌شوند، نه throw
  return `<div class="panel" style="margin-bottom:20px">
    <div class="panel-head"><div><div class="panel-title">${icon('alert',{size:16})} سوییچ‌هایِ اضطراری</div><div class="panel-sub">خاموش/روشن‌کردنِ سریعِ یک قابلیت برایِ کلِ پلتفرم — بدونِ دیپلوی</div></div></div>
    <div class="mini-list">
      ${Object.entries(FEATURE_FLAG_LABEL_FA).map(([key,label])=>{
        // وضعیتِ *غایب* دیگر «فعال» خوانده نمی‌شود. `raw !== false` برایِ کلیدی
        // که اصلاً در پاسخ نیست true می‌داد — همان fail-openی که این پنل نباید داشته باشد.
        const raw = flags[key];
        if (raw === undefined) {
          return `<div class="mini-row">
            <div class="mini-info"><div class="mini-name">${esc(label)}</div><div class="mini-sub mono-ip">${esc(key)}</div></div>
            <span class="badge">وضعیت نامعلوم</span>
          </div>`;
        }
        const on = raw !== false;
        return `<div class="mini-row">
          <div class="mini-info"><div class="mini-name">${esc(label)}</div><div class="mini-sub mono-ip">${esc(key)}</div></div>
          <span class="badge ${on?'active':'expired'}"><span class="bdot"></span>${on?'فعال':'غیرفعال'}</span>
          <button class="btn btn-sm ${on?'btn-danger':'btn-primary'}" data-key="${esc(key)}" data-next="${on?'false':'true'}" onclick="toggleFeatureFlagUi(this.dataset.key,this.dataset.next==='true')">${on?'غیرفعال‌کردن':'فعال‌کردن'}</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
async function toggleFeatureFlagUi(key,next){
  const label=FEATURE_FLAG_LABEL_FA[key]||key;
  if(!confirm(next?`«${label}» برایِ کلِ پلتفرم دوباره فعال بشه؟`:`«${label}» برایِ کلِ پلتفرم غیرفعال بشه؟ همه‌ی کاربرها فوراً اثرش رو می‌بینن.`))return;
  const res=await API.setFeatureFlags([{key,enabled:next}]);
  if(!res.ok){toast('',res.error?.message||'انجام نشد');return;}
  toast('','به‌روزرسانی شد');
  rSecurity();
}

// ═══════════ Phase 4: صفِ یکپارچه‌ی نظارت (اسکلت) + بنِ IP + ویرایشگرِ قواعدِ اقتصاد ═══════════
function moderationQueuePanelHTML(q){
  const stat=(icon_,label,count,onclick)=>`<div class="mini-row" style="cursor:pointer" onclick="${onclick}">
    <div class="mini-ava">${icon(icon_,{size:16})}</div>
    <div class="mini-info"><div class="mini-name">${esc(label)}</div></div>
    <span class="badge ${count>0?'expiring':'active'}">${fa(count)}</span>
  </div>`;
  return `<div class="panel" style="margin-bottom:20px">
    <div class="panel-head"><div><div class="panel-title">${icon('shield',{size:16})} صفِ یکپارچه‌ی نظارت</div><div class="panel-sub">نمایِ کلی از همه‌ی ابزارهایِ نظارتی — رویِ هرکدوم بزن تا بری همون‌جا</div></div></div>
    <div class="mini-list">
      ${stat('lock','کاربرِ بن‌شده',q.banned_users_count,"document.getElementById('c360Query')?.focus()")}
      ${stat('alert','مشتریِ نشان‌خورده',q.flagged_abuse_users_count,"document.getElementById('flaggedUsersPanel')?.scrollIntoView({behavior:'smooth'})")}
      ${stat('close','IPِ بن‌شده',q.banned_ips_count,"document.getElementById('bannedIpsPanel')?.scrollIntoView({behavior:'smooth'})")}
      ${stat('search','عکسِ در انتظارِ تأیید',q.pending_photos_count,"nav('photos')")}
    </div>
  </div>`;
}
function bannedIpsPanelHTML(items){
  return `<div class="panel" style="margin-bottom:20px" id="bannedIpsPanel">
    <div class="panel-head"><div><div class="panel-title">${icon('close',{size:16})} IPهایِ بن‌شده</div><div class="panel-sub">بنِ خودکارِ ریت‌لیمیت — بعد از ${fa(10)} تخلف در ۵ دقیقه، تا ۱ ساعت</div></div></div>
    ${items.length?items.map(x=>`<div class="mini-row">
      <div class="mini-ava mono-ip">${icon('close',{size:14})}</div>
      <div class="mini-info"><div class="mini-name mono-ip">${esc(x.ip)}</div><div class="mini-sub">${fa(Math.ceil(x.ttlSeconds/60))} دقیقه تا رفعِ خودکار</div></div>
      <button class="btn btn-sm" data-ip="${esc(x.ip)}" onclick="unbanIpUi(this.dataset.ip)">لغوِ بن</button>
    </div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:32})}</div><div class="empty-state-desc">هیچ IPِ بن‌شده‌ای نیست</div></div>`}
  </div>`;
}
async function unbanIpUi(ip){
  if(!confirm(`بنِ IP «${ip}» لغو بشه؟`))return;
  const res=await API.unbanIp(ip);
  if(!res.ok){toast('',res.error?.message||'انجام نشد');return;}
  toast('','بن لغو شد');
  rSecurity();
}
// پنلِ یکسانِ «وضعیت نامعلوم» — جایگزینِ صادقانه‌ی رندرِ خوش‌بینانه.
function unavailablePanelHTML(msg){
  return `<div class="panel" style="margin-bottom:20px;padding:20px;text-align:center;color:var(--t2)">${icon('alert',{size:16})} ${esc(msg)}<div style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="rSecurity()">تلاشِ دوباره</button></div></div>`;
}
function economyRulesPanelHTML(rules){
  return `<div class="panel" style="margin-bottom:20px">
    <div class="panel-head"><div><div class="panel-title">${icon('sparkle',{size:16,fill:true})} ویرایشگرِ قواعدِ اقتصاد</div><div class="panel-sub">پاداشِ XP/سکه‌ای که با انجام‌شدنِ هر رزرو به مشتری داده می‌شه</div></div></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div><div class="field-label">XPِ رزروِ انجام‌شده</div><input class="inp" id="ecoXp" type="number" min="0" value="${rules.completed_xp}" style="width:140px"></div>
      <div><div class="field-label">سکه‌یِ رزروِ انجام‌شده</div><input class="inp" id="ecoCoins" type="number" min="0" value="${rules.completed_coins}" style="width:140px"></div>
      <button class="btn btn-primary" onclick="saveEconomyRules()">ذخیره</button>
    </div>
  </div>`;
}
async function saveEconomyRules(){
  const completed_xp=+((document.getElementById('ecoXp')?.value)||0);
  const completed_coins=+((document.getElementById('ecoCoins')?.value)||0);
  const res=await API.setEconomyRules({completed_xp,completed_coins});
  if(!res.ok){toast('',res.error?.message||'ذخیره ناموفق بود');return;}
  toast('','قواعدِ اقتصاد به‌روزرسانی شد');
}

function rSecurity(){
  document.getElementById('v-security').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  // ⚠️ فازِ ۲ (§۲۶–۲۹): این IIFE هیچ catchی نداشت. هر استثنایی داخلش — مثلاً
  // یک فیلدِ غایب در پاسخِ /admin/security — بی‌صدا رد می‌شد و ویو **تا ابد**
  // رویِ «در حال بارگذاری...» می‌ماند: نه خطا، نه تلاشِ دوباره، نه هیچ نشانه‌ای
  // که چیزی شکسته. (با یک تستِ E2E پیدا شد که عمداً پاسخِ ناقص برگرداند.)
  (async()=>{
   try {
    const [res,flagsRes,mqRes,ipsRes,ecoRes]=await Promise.all([API.security(),API.getFeatureFlags(),API.getModerationQueue(),API.getBannedIps(),API.getEconomyRules()]);
    if(!res.ok){document.getElementById('v-security').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد.</div>`;return;}
    const d=res.data;
    // ⚠️ رفعِ fail-open (فازِ ۲، §۲۶–۲۹): پیش از این، شکستِ این fetch به {} تبدیل
    // می‌شد و featureFlagsPanelHTML با `flags[key] !== false` هر پنج سوییچ را «فعال»
    // با نشانِ سبز رندر می‌کرد — یعنی مدیرِ پلتفرم باور می‌کرد قابلیت‌ها روشن‌اند در
    // حالی که وضعیتِ واقعی *ناشناخته* بود. این پنلِ کلیدِ اضطراری است؛ گمراهیِ اینجا
    // پرهزینه‌ترین نوعِ گمراهی است. حالا وضعیتِ ناشناخته صریحاً اعلام می‌شود.
    // ⚠️ همان کلاسِ fail-openِ فلگ‌ها، در دو جایِ دیگر (فازِ ۲، §۳):
    //  • صفِ نظارت: شکستِ fetch به شیءِ همه‌صفر تبدیل می‌شد و پنل چهار عددِ
    //    صفر با نشانِ سبزِ «همه‌چیز مرتب» می‌ساخت — در حالی که سرور اصلاً چیزی
    //    نگفته بود. بکلاگِ واقعیِ نظارت (از جمله عکسِ منتظرِ تأیید) نامرئی می‌شد.
    //  • IPهایِ بن‌شده: آرایه‌ی خالی حالتِ «هیچ IPای بن نیست» را با تیکِ سبز
    //    نشان می‌داد — دقیقاً موقعِ یک حمله‌ی فعال که این endpoint محتمل‌ترین
    //    نقطه‌ی خرابی است، و کنترل‌هایِ «لغوِ بن» هم اصلاً رندر نمی‌شدند.
    // هر دو حالا مثلِ فلگ‌ها: وضعیتِ ناشناخته صریح اعلام می‌شود.
    // ⚠️ رفعِ «داستانِ قابلِ‌ذخیره» (فازِ ۲، §۳): این fallback اعدادِ *پیش‌فرضِ کدِ*
    // بک‌اند بود، نه مقدارِ فعلیِ پلتفرم — و مستقیم داخلِ inputهای قابلِ ویرایش
    // می‌نشست. یک «ذخیره»ی ساده همان اعدادِ ساختگی را رویِ اقتصادِ واقعی می‌نوشت.
    // حالا اگر خوانده نشد، ویرایشگر اصلاً رندر نمی‌شود.
    const eo=d.economy_overview||{tier_distribution:[],total_xp_granted:0,active_abuse_flags:0,total_economy_profiles:0};
    document.getElementById('v-security').innerHTML=(mqRes.ok&&mqRes.data?moderationQueuePanelHTML(mqRes.data):unavailablePanelHTML('خلاصه‌ی صفِ نظارت خوانده نشد — شمارش‌ها نامعلوم‌اند'))+(flagsRes.ok&&flagsRes.data&&flagsRes.data.flags?featureFlagsPanelHTML(flagsRes.data.flags):unavailablePanelHTML('وضعیتِ سوییچ‌هایِ ایمنی خوانده نشد — روشن/خاموش بودنشان نامعلوم است'))+`
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">${icon('search',{size:16})} جست‌وجویِ مشتری (Customer 360)</div><div class="panel-sub">با شماره‌موبایل یا شناسه‌ی کاربر — وضعیتِ کامل، اقتصاد، تاریخچه، و کنترلِ بن</div></div></div>
        <div style="display:flex;gap:8px">
          <input class="inp" id="c360Query" placeholder="۰۹۱۲۳۴۵۶۷۸۹ یا شناسه‌ی UUID" style="flex:1" onkeydown="if(event.key==='Enter')search360()">
          <button class="btn btn-primary" onclick="search360()">جست‌وجو</button>
        </div>
        <div id="c360Result" style="margin-top:14px"></div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.coupon_abuse_signals.length?'red':'green'}">${icon('ticket',{size:17})}</div></div><div class="kpi-val">${fa(d.coupon_abuse_signals.length)}</div><div class="kpi-label">الگوی سوءاستفاده از کوپن</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.high_no_show_customers.length?'amber':'green'}">${icon('close',{size:17})}</div></div><div class="kpi-val">${fa(d.high_no_show_customers.length)}</div><div class="kpi-label">مشتری با عدم‌حضور بالا</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${eo.active_abuse_flags?'red':'green'}">${icon('shield',{size:17})}</div></div><div class="kpi-val">${fa(eo.active_abuse_flags)}</div><div class="kpi-label">فلگِ فعالِ سوءاستفاده (اقتصادِ مشتری)</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.recent_failed_actions.length>20?'red':'amber'}">${icon('alert',{size:17})}</div></div><div class="kpi-val">${fa(d.recent_failed_actions.length)}</div><div class="kpi-label">اقدام ناموفق (۷ روز)</div></div>
      </div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">اقتصادِ یکپارچه‌ی مشتری — نمایِ سراسریِ پلتفرم</div><div class="panel-sub">${fa(eo.total_economy_profiles)} پروفایل · مجموعِ XPِ اعطاشده: ${fa(eo.total_xp_granted)}</div></div></div>
        ${eo.tier_distribution.length?`<div class="tier-grid">${eo.tier_distribution.map(t=>{
          const r=REP_ID[t.tier]||REP_ID.bronze;
          return `<div class="tier-card" style="--tier-fg:${r.fg}">
            <div class="tier-ic">${icon(r.ic,{size:18})}</div>
            <div class="tier-name">${esc(r.name)}</div>
            <div class="tier-count">${fa(t.count)}</div>
            <div class="tier-meta">اعتبارِ میانگین ${fa(t.avg_reliability)}</div>
          </div>`;
        }).join('')}</div>`:`<div class="empty-state"><div class="empty-state-icon">${icon('users',{size:32})}</div><div class="empty-state-desc">هنوز مشتری‌ای وارد این چرخه نشده</div></div>`}
      </div>
      <div class="panel" id="flaggedUsersPanel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">مشتریانِ نشان‌دارِ سوءاستفاده</div><div class="panel-sub">رزروِ این‌ها بیعانه می‌خواد و خودکار تأیید نمی‌شه — اگر اشتباه بوده، نشان رو بردار</div></div></div>
        ${d.flagged_abuse_users.length?d.flagged_abuse_users.map(u=>{
          const rep=REP_ID[u.reputation_tier]||REP_ID.bronze;
          return `<div class="mini-row">
            <div class="mini-ava">${esc(initialOf(u.name))}</div>
            <div class="mini-info">
              <div class="mini-name">${esc(u.name)}
                <span class="badge ${u.flagged_by==='admin'?'badge-warning':'badge-danger'}">${u.flagged_by==='admin'?'نشانِ دستی':'تشخیصِ خودکار'}</span>
              </div>
              <div class="mini-sub">${esc(u.phone)} · <span style="color:${rep.fg};font-weight:700">${esc(rep.name)}</span> · اعتبار ${fa(u.reliability_score)} از ۱۰۰${u.strike_count?` · ${fa(u.strike_count)} تخلف`:''}</div>
              ${u.reason?`<div class="mini-sub" style="margin-top:var(--sp-1)">دلیل: ${esc(u.reason)}</div>`:''}
            </div>
            <button class="btn btn-sm" data-uid="${esc(u.user_id)}" onclick="clearAbuseFlagUi(this.dataset.uid)">برداشتنِ نشان</button>
          </div>`;
        }).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:32})}</div><div class="empty-state-desc">هیچ مشتری‌ای نشان نخورده — همه‌چیز آرومه</div></div>`}
      </div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">الگوی سوءاستفاده از کوپن (یک IP، چند حساب)</div></div></div>
        ${d.coupon_abuse_signals.length?d.coupon_abuse_signals.map(c=>`<div class="mini-row">
          <div class="mini-ava">${icon('ticket',{size:16})}</div>
          <div class="mini-info">
            <div class="mini-name mono-ip">${esc(c.ip)}</div>
            <div class="mini-sub">${fa(c.distinct_accounts)} حسابِ مختلف · ${fa(c.total_redemptions)} بار استفاده</div>
          </div>
          <span class="badge badge-warning">نیازِ بررسیِ دستی</span>
        </div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('shield',{size:32})}</div><div class="empty-state-desc">چیز مشکوکی نیست</div></div>`}
      </div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">مشتریان با نرخ عدم‌حضور بالا</div><div class="panel-sub">اگر الگویِ سوءاستفاده دیدی، از همین‌جا نشان بزن</div></div></div>
        ${d.high_no_show_customers.length?d.high_no_show_customers.map(h=>{
          const flagged=d.flagged_abuse_users.some(u=>u.user_id===h.user_id);
          return `<div class="mini-row">
            <div class="mini-ava" style="color:var(--red-600)">${icon('close',{size:16})}</div>
            <div class="mini-info">
              <div class="mini-name">نرخِ عدم‌حضور <span style="color:var(--red-600)">${fa(Math.round(h.no_show_rate_pct))}٪</span></div>
              <div class="mini-sub">شناسه‌ی مشتری: ${esc(h.user_id).slice(0,8)}…</div>
            </div>
            ${flagged
              ? `<span class="badge badge-danger">نشان خورده</span>`
              : `<button class="btn btn-sm" data-uid="${esc(h.user_id)}" onclick="flagAbuseUi(this.dataset.uid)">نشان‌گذاری</button>`}
          </div>`;
        }).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:32})}</div><div class="empty-state-desc">هیچ‌کس الگویِ نگران‌کننده‌ای نداره</div></div>`}
      </div>
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">آخرین اقدامات حساس ادمین</div><div class="panel-sub">۷ روز اخیر</div></div></div>
        ${d.sensitive_actions.length?d.sensitive_actions.map(a=>`<div class="mini-row">
          <div class="mini-ava">${icon(ACTION_LABEL[a.action]?.ic||'info',{size:16})}</div>
          <div class="mini-info">
            <div class="mini-name">${esc(ACTION_LABEL[a.action]?.fa||a.action)}</div>
            <div class="mini-sub">${new Date(a.at).toLocaleString('fa-IR')}</div>
          </div>
        </div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('checkCircle',{size:32})}</div><div class="empty-state-desc">اقدامِ حساسی ثبت نشده</div></div>`}
      </div>`+(ipsRes.ok&&Array.isArray(ipsRes.data&&ipsRes.data.items)?bannedIpsPanelHTML(ipsRes.data.items):unavailablePanelHTML('فهرستِ IPهایِ بن‌شده خوانده نشد — نمی‌دانیم بنی فعال است یا نه'))+(ecoRes.ok&&ecoRes.data&&ecoRes.data.rules?economyRulesPanelHTML(ecoRes.data.rules):unavailablePanelHTML('قواعدِ اقتصاد خوانده نشد — ویرایشگر نمایش داده نمی‌شود تا مقدارِ ساختگی ذخیره نشود'));
   } catch (e) {
     console.error('rSecurity', e);
     document.getElementById('v-security').innerHTML=unavailablePanelHTML('صفحه‌ی امنیت بارگذاری نشد');
   }
  })();
}

// هر دو اقدام رویِ حسابِ یک آدمِ واقعی اثر می‌ذارن (بیعانه‌ی اجباری، لغوِ
// تأییدِ خودکار) — پس هیچ‌کدوم نباید با یه کلیکِ اتفاقی انجام بشه. دکمه هم
// حینِ درخواست قفل می‌شه تا دوبار ارسال نشه.
async function abuseFlagAct(btn, userId, action, confirmMsg, okMsg, onDone){
  if(!userId) return;
  if(!confirm(confirmMsg)) return;
  if(btn){ btn.disabled=true; btn.textContent='در حال انجام…'; }
  const reason = action==='flag' ? 'نشان‌گذاریِ دستی توسطِ مدیرِ پلتفرم (از فهرستِ عدم‌حضورِ بالا)' : undefined;
  const res=await API.abuseFlagAction(userId,action,reason);
  if(!res.ok){
    if(btn){ btn.disabled=false; btn.textContent = action==='flag'?'نشان‌گذاری':'برداشتنِ نشان'; }
    toast('','انجام نشد: '+(res.error?.message||'خطای نامشخص'));
    return;
  }
  toast('',okMsg);
  (onDone||rSecurity)();
}
function clearAbuseFlagUi(userId){
  return abuseFlagAct(
    event?.currentTarget, userId, 'clear',
    'نشانِ سوءاستفاده‌ی این مشتری برداشته بشه؟ بعدش رزروهاش دوباره عادی تأیید می‌شن.',
    'نشان برداشته شد',
  );
}
function flagAbuseUi(userId){
  return abuseFlagAct(
    event?.currentTarget, userId, 'flag',
    'این مشتری نشانِ سوءاستفاده بخوره؟ از این به بعد رزروش بیعانه می‌خواد و خودکار تأیید نمی‌شه.',
    'مشتری نشان خورد',
  );
}

// ═══════════ Customer 360 — جست‌وجو، نمایِ کامل، بن/رفعِ بن (Company Control Plane، فازِ ۲) ═══════════
let _c360Last=null;
function search360(presetVal){
  const input=document.getElementById('c360Query');
  const q=(presetVal!==undefined&&presetVal!==null?presetVal:(input?.value||'')).trim();
  if(!q){toast('','شماره‌موبایل یا شناسه‌ی کاربر رو وارد کن');return;}
  _c360Last=q;
  const box=document.getElementById('c360Result');
  if(!box)return;
  box.innerHTML=`<div style="text-align:center;padding:30px;color:var(--t2)">در حال جست‌وجو...</div>`;
  API.customer360(q).then(res=>{
    if(!res.ok){
      box.innerHTML=`<div class="panel" style="text-align:center;padding:24px;color:var(--t2)">${icon('alert',{size:15})} ${esc(res.error?.message||'کاربر پیدا نشد')}</div>`;
      return;
    }
    box.innerHTML=renderCustomer360(res.data);
  });
}
function renderCustomer360(d){
  const u=d.user, m=d.moderation, e=d.economy;
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'بدونِ نام';
  const rep=REP_ID[e.reputation_tier]||REP_ID.bronze;
  return `
    <div class="panel" style="background:var(--ink-50);border-color:var(--ink-100)">
      <div class="mini-row" style="background:transparent;padding:0">
        <div class="mini-ava">${esc(initialOf(name))}</div>
        <div class="mini-info">
          <div class="mini-name">${esc(name)} ${m.is_banned?'<span class="badge badge-danger">بن‌شده</span>':''}${m.has_active_abuse_flag?'<span class="badge badge-warning">نشانِ سوءاستفاده</span>':''}</div>
          <div class="mini-sub">${esc(u.phone)} · عضو از ${new Date(u.created_at).toLocaleDateString('fa-IR')} · شناسه: <span class="mono-ip">${esc(u.id)}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${m.is_banned
            ? `<button class="btn btn-primary btn-sm" onclick="openUnbanModal(${jsq(u.id)},${jsq(name)})">رفعِ بن</button>`
            : `<button class="btn btn-danger btn-sm" onclick="openBanModal(${jsq(u.id)},${jsq(name)})">بن‌کردن</button>`}
          ${m.has_active_abuse_flag
            ? `<button class="btn btn-sm" onclick="clearAbuseFlag360(${jsq(u.id)})">برداشتنِ نشان</button>`
            : `<button class="btn btn-sm" onclick="flagAbuse360(${jsq(u.id)})">نشان‌گذاری</button>`}
        </div>
      </div>
      ${m.is_banned?`<div style="margin-top:10px;font-size:12.5px;color:var(--red-600);line-height:1.7">${icon('alert',{size:13})} بن‌شده در ${new Date(m.banned_at).toLocaleString('fa-IR')}${m.banned_reason?` — دلیل: ${esc(m.banned_reason)}`:''}</div>`:''}
      ${(!m.is_banned && m.unbanned_at)?`<div style="margin-top:10px;font-size:12.5px;color:var(--t2);line-height:1.7">${icon('info',{size:13})} آخرین بن در ${new Date(m.unbanned_at).toLocaleString('fa-IR')} رفع شد${m.unban_reason?` — دلیل: ${esc(m.unban_reason)}`:''}</div>`:''}
    </div>
    <div class="kpi-grid" style="margin-top:14px">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic" style="color:${rep.fg}">${icon(rep.ic,{size:17})}</div></div><div class="kpi-val" style="font-size:16px">${esc(rep.name)}</div><div class="kpi-label">سطحِ اعتبار · ${fa(e.reliability_score)} از ۱۰۰</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('sparkle',{size:17,fill:true})}</div></div><div class="kpi-val">${fa(e.xp_total)}</div><div class="kpi-label">مجموعِ تجربه (XP)</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('wallet',{size:17})}</div></div><div class="kpi-val">${fa(e.wallet_balance)}</div><div class="kpi-label">موجودیِ سکه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${e.strike_count?'red':'green'}">${icon('close',{size:17})}</div></div><div class="kpi-val">${fa(e.strike_count)}</div><div class="kpi-label">تخلفِ فعال</div></div>
    </div>
    <div class="row-2" style="margin-top:14px">
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">آخرین حرکاتِ اقتصاد</div><div class="panel-sub">${fa(d.recent_ledger.length)} مورد</div></div></div>
        ${d.recent_ledger.length?d.recent_ledger.map(l=>`<div class="mini-row">
          <div class="mini-info"><div class="mini-name">${esc(LEDGER_KIND_FA[l.kind]||l.kind)}</div><div class="mini-sub">${new Date(l.at).toLocaleString('fa-IR')}</div></div>
          <span style="font-weight:700;color:${l.amount>=0?'var(--green-600)':'var(--red-600)'}">${l.amount>=0?'+':''}${fa(l.amount)}</span>
        </div>`).join(''):`<div class="empty-state"><div class="empty-state-desc">هنوز حرکتی ثبت نشده</div></div>`}
      </div>
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">رزروهایِ اخیر</div><div class="panel-sub">${fa(d.recent_reservations.length)} مورد</div></div></div>
        ${d.recent_reservations.length?d.recent_reservations.map(r=>`<div class="mini-row">
          <div class="mini-info"><div class="mini-name">${esc(r.restaurant_name)}</div><div class="mini-sub">${new Date(r.slot_start).toLocaleString('fa-IR')} · ${fa(r.party_size)} نفر</div></div>
          <span class="badge">${esc(RESV_STATUS_FA[r.status]||r.status)}</span>
        </div>`).join(''):`<div class="empty-state"><div class="empty-state-desc">رزروی ثبت نشده</div></div>`}
      </div>
    </div>
    ${d.missions&&d.missions.length?`<div class="panel" style="margin-top:14px">
      <div class="panel-head"><div><div class="panel-title">ماموریت‌ها</div><div class="panel-sub">${fa(d.missions.length)} مورد</div></div></div>
      ${d.missions.map(ms=>`<div class="mini-row">
        <div class="mini-info"><div class="mini-name">${esc(ms.title||ms.mission?.title||'')}</div><div class="mini-sub">${fa(ms.progress||0)} از ${fa(ms.targetCount||ms.target_count||0)}</div></div>
        ${ms.completedAt||ms.completed_at?'<span class="badge badge-warning">تکمیل</span>':''}
      </div>`).join('')}
    </div>`:''}`;
}
function openBanModal(userId,name){
  openModal(`
    <div class="modal-title">${icon('shield',{size:18})} بن‌کردنِ ${esc(name)}</div>
    <div class="modal-sub">این حساب دیگه نمی‌تونه وارد بشه یا رزروِ آنلاین ثبت کنه.</div>
    <div class="field-label">دلیل (الزامی)</div>
    <textarea class="inp" id="banReason" rows="3" placeholder="مثلاً: تخلفِ تکراری، شکایتِ رسمیِ رستوران، ..."></textarea>
    <button class="btn btn-danger btn-block btn-lg" style="margin-top:14px" onclick="submitBan(${jsq(userId)})">تأییدِ بن</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitBan(userId){
  const reason=(document.getElementById('banReason')?.value||'').trim();
  if(!reason){toast('','دلیلِ بن رو بنویس');return;}
  if(!confirm('مطمئنی؟ این حساب فوراً از دسترسی خارج می‌شه.'))return;
  const res=await API.banUser(userId,reason);
  if(!res.ok){toast('',res.error?.message||'بن ناموفق بود');return;}
  closeModal();
  toast('',res.data?.already_banned?'این کاربر از قبل بن بود':'کاربر بن شد');
  search360(userId);
}
function openUnbanModal(userId,name){
  openModal(`
    <div class="modal-title">${icon('checkCircle',{size:18})} رفعِ بنِ ${esc(name)}</div>
    <div class="field-label">دلیل (اختیاری)</div>
    <textarea class="inp" id="unbanReason" rows="3" placeholder="مثلاً: بررسی شد، تصمیمِ اشتباه بود"></textarea>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" onclick="submitUnban(${jsq(userId)})">تأییدِ رفعِ بن</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitUnban(userId){
  const reason=(document.getElementById('unbanReason')?.value||'').trim()||undefined;
  if(!confirm('بنِ این کاربر برداشته بشه؟'))return;
  const res=await API.unbanUser(userId,reason);
  if(!res.ok){toast('',res.error?.message||'رفعِ بن ناموفق بود');return;}
  closeModal();
  toast('',res.data?.already_unbanned?'این کاربر بن نبود':'بن برداشته شد');
  search360(userId);
}
function clearAbuseFlag360(userId){
  return abuseFlagAct(
    event?.currentTarget, userId, 'clear',
    'نشانِ سوءاستفاده‌ی این مشتری برداشته بشه؟ بعدش رزروهاش دوباره عادی تأیید می‌شن.',
    'نشان برداشته شد', ()=>search360(userId),
  );
}
function flagAbuse360(userId){
  return abuseFlagAct(
    event?.currentTarget, userId, 'flag',
    'این مشتری نشانِ سوءاستفاده بخوره؟ از این به بعد رزروش بیعانه می‌خواد و خودکار تأیید نمی‌شه.',
    'مشتری نشان خورد', ()=>search360(userId),
  );
}

// ═══════════ ورود مدیر پلتفرم (فاز ۳ تکه ۷) ═══════════
let _adminPhone = '';
function setAdminGateLocked(locked){
  const app = document.querySelector('.app');
  const overlay = document.getElementById('loginOverlay');
  if (app) {
    app.setAttribute('aria-hidden', locked ? 'true' : 'false');
    if ('inert' in app) app.inert = locked;
  }
  if (overlay) overlay.setAttribute('aria-hidden', locked ? 'false' : 'true');
}
function faD(s){ return String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }
// ⚠️ مسیرِ اصلیِ ورود از ۲۰۲۶-۰۸-۲۶ نام کاربری و رمز است، نه OTP.
// دلیل: تنها راهِ ورود پیامک بود و بدونِ KAVENEGAR_API_KEY هیچ‌کس —
// حتی مدیرِ پلتفرم — نمی‌توانست وارد شود. مسیرِ OTP حذف نشد و به‌عنوانِ
// پشتیبان می‌ماند (اگر رمز فراموش شد و پیامک راه افتاده باشد).
// ── عاملِ سوم (TOTP) ──
// ⚠️ فیلد فقط وقتی **در DOM ساخته می‌شود** که سرور بگوید لازم است — نه
// اینکه همیشه ساخته و با CSS پنهان شود. دلیلش یک شکستِ واقعیِ همین مخزن
// است: یک عنصرِ `display:none` با `display:flex` دور زده شد. چیزی که رندر
// نشود قابلِ دور زدن نیست.
let _totpRequired = false;
// آیا مسیرِ ورودِ پیامکیِ ادمین اصلاً فعال است؟ (فلگِ سرور، پیش‌فرض خاموش)
let _otpLoginEnabled = false;

function showAdminLogin(){
  setAdminGateLocked(true);
  const totpBlock = _totpRequired ? `
    <label class="login-field-label" for="adminTotp">کد تأیید دومرحله‌ای</label>
    <input class="login-inp" id="adminTotp" type="text" inputmode="numeric" pattern="[0-9]*"
           autocomplete="one-time-code" maxlength="6" spellcheck="false"
           placeholder="۶ رقم از اپلیکیشن"
           aria-describedby="adminTotpHint"
           onkeydown="if(event.key==='Enter')adminPasswordLogin()">
    <div class="login-hint" id="adminTotpHint">کد ۶ رقمی را از Google Authenticator یا Aegis وارد کنید</div>` : '';

  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">R</div>
    <div class="login-title">پنل شرکت رزرونو</div>
    <div class="login-sub">ورود مدیر پلتفرم</div>
    <label class="login-field-label" for="adminUser">نام کاربری</label>
    <input class="login-inp" id="adminUser" autocomplete="username" spellcheck="false" placeholder="نام کاربری" onkeydown="if(event.key==='Enter')document.getElementById('adminPass')?.focus()">
    <label class="login-field-label" for="adminPass">رمز عبور</label>
    <input class="login-inp" id="adminPass" type="password" autocomplete="current-password" placeholder="رمز عبور" onkeydown="if(event.key==='Enter')${_totpRequired ? "document.getElementById('adminTotp')?.focus()" : 'adminPasswordLogin()'}">
    ${totpBlock}
    <button class="login-btn" id="adminLoginBtn" onclick="adminPasswordLogin()">ورود به پنل</button>
    ${_otpLoginEnabled ? `<button class="login-back" onclick="showAdminLoginPhone()">ورود با پیامک</button>` : ''}
    <div class="login-foot">فقط مدیران پلتفرم به این پنل دسترسی دارند</div>`;
  setTimeout(()=>document.getElementById('adminUser')?.focus(),200);
}

// پرچم را **پیش از** رندرِ فرم می‌گیرد. شکستِ این درخواست عمداً «لازم نیست»
// تفسیر می‌شود، نه «لازم است»: اگر بک‌اند در دسترس نباشد، ورودِ آفلاین/دمو
// که پایین‌تر مدیریت می‌شود نباید پشتِ فیلدی قفل شود که هیچ‌وقت پر نمی‌شود.
// سرور در هر حال fail-closed است و بدونِ کدِ درست توکن نمی‌دهد.
async function loadAdminLoginForm(){
  try {
    const res = await API.adminTotpRequired();
    _totpRequired = !!(res.ok && res.data && res.data.totp_required);
    // ⚠️ پیش‌فرضِ **خاموش** وقتی سرور پاسخ نداد: مسیرِ OTPِ ادمین عاملِ سوم
    // را دور می‌زند، پس در ابهام نباید پیشنهادش کنیم. برعکسِ totp_required
    // که پیش‌فرضش false است چون آن‌جا ابهام یعنی «هنوز روشن نشده».
    _otpLoginEnabled = !!(res.ok && res.data && res.data.otp_login_enabled);
  } catch { _totpRequired = false; _otpLoginEnabled = false; }
  showAdminLogin();
}

async function adminPasswordLogin(){
  const u = (document.getElementById('adminUser')?.value||'').trim();
  const p = document.getElementById('adminPass')?.value||'';
  const t = (document.getElementById('adminTotp')?.value||'').trim();
  if (!u || !p) { toast('','نام کاربری و رمز را وارد کن'); return; }
  if (_totpRequired && !/^\d{6}$/.test(t)) {
    toast('','کد ۶ رقمی را وارد کن');
    document.getElementById('adminTotp')?.focus();
    return;
  }
  const btn = document.getElementById('adminLoginBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال بررسی...'; }
  const reset = () => {
    if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; }
    // کدِ مصرف‌شده دیگر معتبر نیست (ضدِ replayِ سرور) — پاکش کن و فوکوس را
    // همان‌جا بگذار تا کاربر کدِ تازه را بدونِ کلیک وارد کند.
    const ti = document.getElementById('adminTotp');
    if (ti){ ti.value=''; ti.focus(); }
  };

  // مسیرِ دمویِ آفلاین دست‌نخورده می‌ماند (بازکردنِ فایل بدونِ بک‌اند).
  if (location.protocol === 'file:') { await enterAdminPanel(true); return; }

  const res = await API.adminLogin(u, p, _totpRequired ? t : undefined);
  if (res.ok && res.data?.access){ await enterAdminPanel(); return; }
  if (res.offline){ await enterAdminPanel(true); return; }
  // ⚠️ پیامِ سرور عمداً برای «کاربر نیست» و «رمز غلط» یکسان است — اینجا
  // هم نباید چیزِ دقیق‌تری ساخته شود، وگرنه همان نشتی که سرور بست از
  // سمتِ کلاینت باز می‌شود.
  toast('', res.error?.message || 'نام کاربری یا رمز عبور اشتباه است');
  reset();
}

function showAdminLoginPhone(){
  setAdminGateLocked(true);
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">R</div>
    <div class="login-title">ورود با پیامک</div>
    <div class="login-sub">شماره موبایل خود را وارد کنید</div>
    <label class="login-field-label" for="adminPhone">شماره موبایل</label>
    <input class="login-inp" id="adminPhone" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" onkeydown="if(event.key==='Enter')adminSendOtp()">
    <button class="login-btn" id="adminSendBtn" onclick="adminSendOtp()">ارسال کد ورود</button>
    <button class="login-back" onclick="loadAdminLoginForm()">ورود با نام کاربری و رمز</button>
    <div class="login-foot">فقط مدیران پلتفرم به این پنل دسترسی دارند</div>`;
  setTimeout(()=>document.getElementById('adminPhone')?.focus(),200);
}
async function adminSendOtp(){
  const el = document.getElementById('adminPhone');
  const phone = (el?.value||'').trim();
  const normalized = phone.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  if (!/^09\d{9}$/.test(normalized)) { toast('','شماره موبایل معتبر وارد کن'); return; }
  _adminPhone = normalized;
  const btn = document.getElementById('adminSendBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال ارسال...'; }
  if (location.protocol === 'file:') {
    showAdminLoginCode('۱۲۳۴', true);
    return;
  }
  const res = await API.requestAdminOtp(normalized);
  if (!res.ok && !res.offline){
    toast('', res.error?.message || 'این شماره دسترسی ندارد');
    if (btn){ btn.disabled = false; btn.textContent = 'ارسال کد ورود'; }
    return;
  }
  const devCode = res.data?.devCode || (res.offline ? '۱۲۳۴' : null);
  showAdminLoginCode(devCode, res.offline);
}
function showAdminLoginCode(devCode, offline){
  setAdminGateLocked(true);
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">${icon('mail',{size:34})}</div>
    <div class="login-title">کد ورود را وارد کنید</div>
    <div class="login-sub">کد ورود به شماره‌ی ${faD(_adminPhone)} ارسال شد</div>
    <label class="login-field-label" for="adminCode">کد ورود</label>
    <input class="login-inp code" id="adminCode" inputmode="numeric" maxlength="6" placeholder="······" onkeydown="if(event.key==='Enter')adminConfirmOtp()">
    <button class="login-btn" id="adminVerifyBtn" onclick="adminConfirmOtp()">ورود به پنل</button>
    <button class="login-back" onclick="showAdminLoginPhone()">تغییر شماره</button>
    ${devCode ? `<div class="login-hint">${offline?'حالت دمو (بک‌اند متصل نیست):':'حالت توسعه:'} کد ورود <b>${faD(devCode)}</b> است</div>` : ''}`;
  setTimeout(()=>document.getElementById('adminCode')?.focus(),200);
}
async function adminConfirmOtp(){
  const el = document.getElementById('adminCode');
  const code = (el?.value||'').trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (!/^\d{4,6}$/.test(code)) { toast('','کد ورود را کامل وارد کن'); return; }
  const btn = document.getElementById('adminVerifyBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال بررسی...'; }
  if (location.protocol === 'file:') {
    if (code === '1234'){ await enterAdminPanel(true); }
    else { toast('','در حالت دمو، کد ۱۲۳۴ است'); if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; } }
    return;
  }
  const res = await API.verifyAdminOtp(_adminPhone, code);
  if (res.ok && res.data?.access){
    await enterAdminPanel();
  } else if (res.offline){
    if (code === '1234'){ await enterAdminPanel(true); }
    else { toast('','در حالت دمو، کد ۱۲۳۴ است'); if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; } }
  } else {
    toast('', res.error?.message || 'کد اشتباه است');
    if (btn){ btn.disabled=false; btn.textContent='ورود به پنل'; }
  }
}
async function enterAdminPanel(demo){
  document.getElementById('loginOverlay').classList.add('hidden');
  setAdminGateLocked(false);

  // ⚠️ رفعِ «دادهٔ ساختگی عینِ واقعی» (فازِ ۲، §۳ + قاعده‌ی صریحِ CLAUDE.md).
  //
  // باگ: مسیرِ دمو (کد ۱۲۳۴ وقتی بک‌اند در دسترس نیست) از این شرط رد می‌شد،
  // پس loadAdminRestaurants() اصلاً صدا زده نمی‌شد — و دقیقاً همان تابع است
  // که دو سازوکارِ صداقت را اجرا می‌کند: پیشوندِ [DEMO] رویِ نامِ رستوران‌ها و
  // updateOfflineBanner(). نتیجه: مدیرِ پلتفرم داشبوردی می‌دید با «۸ رستوران،
  // ۵٬۱۲۸ عضو، ۱۲٬۷۱۲ رزرو» و نامِ رستوران‌هایِ ساختگی، بدونِ هیچ نشانه‌ای که
  // هیچ‌کدام واقعی نیست. تذکرِ صفحه‌ی ورود هم با بسته‌شدنِ همان کارت می‌رفت.
  //
  // حالا مسیرِ دمو هم از همان تابع عبور می‌کند: بنرِ آفلاین بالا می‌ماند و
  // هر نام برچسبِ [DEMO] می‌گیرد.
  if (demo){
    API.online = false;
    updateOfflineBanner();
    RESTAURANTS = RESTAURANTS_SAMPLE.map(x => ({
      ...x,
      name: String(x.name).startsWith('[DEMO]') ? x.name : `[DEMO] ${x.name}`,
      _demo: true,
    }));
    rOverview();
    toast('','حالتِ دمو — هیچ‌کدام از اعدادِ این صفحه واقعی نیست');
    return;
  }

  // اگر توکن واقعی داریم، داده‌ی واقعی بارگذاری کن
  if (API.getToken()){
    const [fresh] = await Promise.all([loadAdminRestaurants(), loadPlatformStats()]);
    RESTAURANTS = fresh;
    // نشان‌ها باید از همان ابتدا عددِ واقعی را نشان دهند، وگرنه کارِ منتظر
    // فقط وقتی دیده می‌شود که کاربر اتفاقی وارد آن صفحه شود.
    refreshSalesBadge();
    refreshPhotoBadge();
    refreshHoursChangeBadge();
  }
  rOverview();
  toast('','خوش آمدید · پنل شرکت');
}
async function adminLogout(){
  await API.doLogout();
  document.getElementById('loginOverlay').classList.remove('hidden');
  setAdminGateLocked(true);
  loadAdminLoginForm();
  toast('','از پنل خارج شدید');
}
function onAdminSessionExpired(){
  document.getElementById('loginOverlay').classList.remove('hidden');
  setAdminGateLocked(true);
  loadAdminLoginForm();
  toast('','نشست منقضی شد، دوباره وارد شوید');
}

// شروع — نشست را بازیابی و ورود را چک کن
API.restoreSession();
if (API.getToken()) {
  document.getElementById('loginOverlay').classList.add('hidden');
  setAdminGateLocked(false);
  rOverview();
  (async () => {
    const [fresh] = await Promise.all([loadAdminRestaurants(), loadPlatformStats()]);
    RESTAURANTS = fresh;
    const active = document.querySelector('.view.active');
    if (active) {
      const id = active.id.replace('v-', '');
      ({overview:rOverview, restaurants:rRestaurants, detail:rDetail, analytics:rAnalytics, customers:rCustomers, billing:rBilling, sales:loadSales, photos:loadPhotos, hours:loadHoursChanges, systemhealth:rSystemHealth, aihealth:rModelHealth, security:rSecurity, support:rSupport, badges:rBadges, missions:rMissions})[id]?.();
    }
    refreshSalesBadge();
    refreshPhotoBadge();
    refreshHoursChangeBadge();
  })();
} else {
  setAdminGateLocked(true);
  // نقطه‌ی ورودِ اصلی — پرچمِ TOTP پیش از رندرِ فرم گرفته می‌شود.
  loadAdminLoginForm();
}
