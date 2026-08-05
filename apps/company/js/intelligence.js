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
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('wallet',{size:17})}</div></div><div class="kpi-val">${fnl(d.guests.total_clv_toman)}</div><div class="kpi-label">ارزش طول عمر کل (تومان)</div></div>
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
      ${d.top_restaurants_by_value.length?d.top_restaurants_by_value.map((r,i)=>`<div class="list-stat"><div class="ls-rank">${fa(i+1)}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.customers)} مشتری تحلیل‌شده</div></div><div class="ls-val">${fnl(r.total_clv_toman)}</div></div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">داده‌ای نیست</div>'}
    </div>`;
}

// ════════ اشتراک و پیامک ════════
function rBilling(){
  const totalSms=RESTAURANTS.reduce((s,r)=>s+r.sms,0);
  const activeSubsc=RESTAURANTS.filter(r=>r.status==='active').length;
  const PRICE={free:0,pro:890,enterprise:2400};
  const mrr=RESTAURANTS.filter(r=>r.status==='active'||r.status==='expiring').reduce((s,r)=>s+(PRICE[r.plan]||0),0);
  document.getElementById('v-billing').innerHTML=`
    <div class="bill-summary">
      <div class="bill-stat"><div class="bs-val" style="color:var(--ink)">${fa(activeSubsc)}</div><div class="bs-label">اشتراک فعال</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--green-600)">${fa(mrr)}<span style="font-size:14px"> هزارتومان</span></div><div class="bs-label">درآمد ماهانه (تخمینی از پلن‌ها)</div></div>
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
            <div class="rest-logo" style="background:${r.grad};width:38px;height:38px;font-size:16px">${r.logo}</div>
            <div class="mini-info" style="min-width:140px"><div class="mini-name">${esc(r.name)}</div><div class="mini-sub"><span class="plan-badge ${r.plan}">${PLAN_LABEL[r.plan]}</span> · موجودی: ${fa(r.smsBalance||0)} پیامک</div>
            </div>
            <span class="badge ${badgeCls}" style="align-self:flex-start"><span class="bdot"></span>${st}</span>
            <div style="display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" onclick="openSmsTopup('${r.id}')">${icon('phone',{size:13})} شارژ پیامک</button>
              <button class="btn btn-ghost btn-sm" onclick="openRenew('${r.id}')">مدیریت</button>
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
      ${[[1000,'۱۰۰۰'],[5000,'۵۰۰۰'],[10000,'۱۰٬۰۰۰'],[50000,'۵۰٬۰۰۰']].map(([v,l],i)=>`<div class="opt ${i===0?'sel':''}" data-amt="${v}" onclick="pickSmsAmount(${v},this)">${l}</div>`).join('')}
    </div>
    <div class="field-label">یا مقدار دلخواه</div>
    <input class="inp" id="smsCustomAmount" type="number" min="1" placeholder="مثلاً ۲۵۰۰" oninput="document.querySelectorAll('#smsAmountOpts .opt').forEach(o=>o.classList.remove('sel'))">
    <div style="font-size:12px;color:var(--t2);margin:14px 0;line-height:1.6;background:var(--ink-50);padding:12px 14px;border-radius:var(--r)">${icon('info',{size:13})} رستوران پس از پرداخت به شما، موجودی‌اش را اینجا شارژ کنید. هر شارژ ثبت و قابل‌پیگیری است.</div>
    <button class="btn btn-primary btn-block btn-lg" onclick="submitSmsTopup()">تأیید و شارژ</button>
  `);
}
let _topupAmount=1000;
function pickSmsAmount(v,el){_topupAmount=v;document.querySelectorAll('#smsAmountOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('smsCustomAmount').value='';}
async function submitSmsTopup(){
  const custom=parseInt(document.getElementById('smsCustomAmount')?.value||'');
  const amount=Number.isInteger(custom)&&custom>0?custom:_topupAmount;
  if(!amount||amount<=0){toast('','تعداد نامعتبر');return;}
  const res=await API.post(`/admin/restaurants/${_topupRestId}/sms`,{amount});
  if(res.ok){
    closeModal();
    toast('',`${fa(amount)} پیامک شارژ شد · موجودی جدید: ${fa(res.data.balance)}`);
    const r=RESTAURANTS.find(x=>String(x.id)===String(_topupRestId));
    if(r)r.smsBalance=res.data.balance;
    if(typeof rBilling==='function'&&document.getElementById('v-billing'))rBilling();
  } else {
    toast('',res.error?.message||'شارژ ناموفق بود');
  }
}

// ════════ مدیریت اشتراک (تمدید واقعی / لغو واقعی) — وصل به PATCH /admin/restaurants/:id/control ════════
function openRenew(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  renewPlan=(r.plan==='free'?'pro':r.plan);renewMonths=12;
  openModal(`
    <div class="modal-title">مدیریت اشتراک</div>
    <div class="modal-sub">${esc(r.name)} · وضعیت فعلی: ${STATUS_LABEL[r.status]}</div>
    <div class="field-label">پلن</div>
    <div class="opt-row" id="planOpts">
      ${[['pro','حرفه‌ای'],['enterprise','سازمانی']].map(([v,l])=>`<div class="opt ${v===renewPlan?'sel':''}" data-plan="${v}" onclick="pickPlan('${v}',this)">${l}</div>`).join('')}
    </div>
    <div class="field-label">مدت تمدید</div>
    <div class="opt-row" id="monthOpts">
      ${[[1,'۱ ماه'],[3,'۳ ماه'],[6,'۶ ماه'],[12,'۱ سال']].map(([v,l])=>`<div class="opt ${v===12?'sel':''}" data-m="${v}" onclick="pickMonths(${v},this)">${l}</div>`).join('')}
    </div>
    <div class="summary-box">
      <div class="sum-row"><span class="k">رستوران</span><span class="v">${esc(r.name)}</span></div>
      <div class="sum-row"><span class="k">پلن جدید</span><span class="v" id="sumPlan">${PLAN_LABEL[renewPlan]}</span></div>
      <div class="sum-row"><span class="k">مدت</span><span class="v" id="sumMonths">۱ سال</span></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="doRenew('${id}')">${icon('check',{size:15})} تمدید اشتراک</button>
    <button class="btn btn-danger btn-block" style="margin-top:8px" onclick="confirmCancel('${id}')">لغو اشتراک</button>
  `);
}
let renewPlan='pro',renewMonths=12;
function pickPlan(v,el){renewPlan=v;document.querySelectorAll('#planOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('sumPlan').textContent=PLAN_LABEL[v]}
function pickMonths(v,el){renewMonths=v;document.querySelectorAll('#monthOpts .opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');document.getElementById('sumMonths').textContent={1:'۱ ماه',3:'۳ ماه',6:'۶ ماه',12:'۱ سال'}[v]}
async function doRenew(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  const res=await API.control(id,{action:'extend_plan',plan:renewPlan,months:renewMonths});
  if(!res.ok){toast('',res.error?.message||'تمدید ناموفق بود');return;}
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
      <button class="btn btn-danger btn-block btn-lg" onclick="doCancel('${id}')">بله، لغو کن</button>
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
  ({overview:rOverview,restaurants:rRestaurants,detail:rDetail,analytics:rAnalytics,customers:rCustomers,billing:rBilling,systemhealth:rSystemHealth,security:rSecurity,support:rSupport})[id]?.();
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
          <div class="rest-logo" style="background:${r.grad};width:36px;height:36px;font-size:15px">${r.logo}</div>
          <div class="mini-info"><div class="mini-name">${esc(r.name)}</div><div class="mini-sub">${!r.isOpen?`<span class="dot-closed" aria-hidden="true"></span> غیرفعال · `:''}${STATUS_LABEL[r.status]||''}</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="toggleRestOpen('${r.id}')">${r.isOpen?'غیرفعال کن':'فعال کن'}</button>
            <button class="btn btn-primary btn-sm" onclick="openRenew('${r.id}')">مدیریت اشتراک</button>
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

// ═══════════ امنیت پلتفرم — واقعی، از /admin/security ═══════════
function rSecurity(){
  document.getElementById('v-security').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  (async()=>{
    const res=await API.security();
    if(!res.ok){document.getElementById('v-security').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد.</div>`;return;}
    const d=res.data;
    document.getElementById('v-security').innerHTML=`
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.coupon_abuse_signals.length?'red':'green'}">${icon('ticket',{size:17})}</div></div><div class="kpi-val">${fa(d.coupon_abuse_signals.length)}</div><div class="kpi-label">الگوی سوءاستفاده از کوپن</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.high_no_show_customers.length?'amber':'green'}">${icon('close',{size:17})}</div></div><div class="kpi-val">${fa(d.high_no_show_customers.length)}</div><div class="kpi-label">مشتری با عدم‌حضور بالا</div></div>
        <div class="kpi"><div class="kpi-top"><div class="kpi-ic ${d.recent_failed_actions.length>20?'red':'amber'}">${icon('alert',{size:17})}</div></div><div class="kpi-val">${fa(d.recent_failed_actions.length)}</div><div class="kpi-label">اقدام ناموفق (۷ روز)</div></div>
      </div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">الگوی سوءاستفاده از کوپن (یک IP، چند حساب)</div></div></div>
        ${d.coupon_abuse_signals.length?d.coupon_abuse_signals.map(c=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="font-family:monospace">${esc(c.ip)}</span><span>${fa(c.distinct_accounts)} حساب · ${fa(c.total_redemptions)} استفاده</span></div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">${icon('shield',{size:32})}</div><div class="empty-state-desc">چیز مشکوکی نیست</div></div>`}
      </div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-head"><div><div class="panel-title">مشتریان با نرخ عدم‌حضور بالا</div></div></div>
        ${d.high_no_show_customers.length?d.high_no_show_customers.map(h=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="font-family:monospace;font-size:11px">${esc(h.user_id).slice(0,12)}…</span><span style="color:var(--red-600);font-weight:700">${fa(Math.round(h.no_show_rate_pct))}٪</span></div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">موردی نیست</div>'}
      </div>
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">آخرین اقدامات حساس ادمین</div><div class="panel-sub">۷ روز اخیر</div></div></div>
        ${d.sensitive_actions.length?d.sensitive_actions.map(a=>`<div style="padding:9px 0;border-bottom:1px solid var(--border);font-size:12.5px"><b>${esc(a.action)}</b><div style="color:var(--t2);margin-top:2px">${new Date(a.at).toLocaleString('fa-IR')}</div></div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">موردی نیست</div>'}
      </div>`;
  })();
}

// ═══════════ ورود مدیر پلتفرم (فاز ۳ تکه ۷) ═══════════
let _adminPhone = '';
function faD(s){ return String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }
function showAdminLoginPhone(){
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">R</div>
    <div class="login-title">پنل شرکت رزرونو</div>
    <div class="login-sub">ورود مدیر پلتفرم — شماره موبایل خود را وارد کنید</div>
    <label class="login-field-label">شماره موبایل</label>
    <input class="login-inp" id="adminPhone" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" onkeydown="if(event.key==='Enter')adminSendOtp()">
    <button class="login-btn" id="adminSendBtn" onclick="adminSendOtp()">ارسال کد ورود</button>
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
  document.getElementById('loginCard').innerHTML = `
    <div class="login-logo">${icon('mail',{size:34})}</div>
    <div class="login-title">کد ورود را وارد کنید</div>
    <div class="login-sub">کد ورود به شماره‌ی ${faD(_adminPhone)} ارسال شد</div>
    <label class="login-field-label">کد ورود</label>
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
  // اگر توکن واقعی داریم، داده‌ی واقعی بارگذاری کن
  if (API.getToken() && !demo){
    const [fresh] = await Promise.all([loadAdminRestaurants(), loadPlatformStats()]);
    RESTAURANTS = fresh;
    // نشان‌ها باید از همان ابتدا عددِ واقعی را نشان دهند، وگرنه کارِ منتظر
    // فقط وقتی دیده می‌شود که کاربر اتفاقی وارد آن صفحه شود.
    refreshSalesBadge();
    refreshPhotoBadge();
  }
  rOverview();
  toast('','خوش آمدید · پنل شرکت');
}
async function adminLogout(){
  await API.doLogout();
  document.getElementById('loginOverlay').classList.remove('hidden');
  showAdminLoginPhone();
  toast('','از پنل خارج شدید');
}
function onAdminSessionExpired(){
  document.getElementById('loginOverlay').classList.remove('hidden');
  showAdminLoginPhone();
  toast('','نشست منقضی شد، دوباره وارد شوید');
}

// شروع — نشست را بازیابی و ورود را چک کن
API.restoreSession();
if (API.getToken()) {
  document.getElementById('loginOverlay').classList.add('hidden');
  rOverview();
  (async () => {
    const [fresh] = await Promise.all([loadAdminRestaurants(), loadPlatformStats()]);
    RESTAURANTS = fresh;
    const active = document.querySelector('.view.active');
    if (active) {
      const id = active.id.replace('v-', '');
      ({overview:rOverview, restaurants:rRestaurants, detail:rDetail, analytics:rAnalytics, customers:rCustomers, billing:rBilling, sales:loadSales, photos:loadPhotos, systemhealth:rSystemHealth, security:rSecurity, support:rSupport})[id]?.();
    }
    refreshSalesBadge();
    refreshPhotoBadge();
  })();
} else {
  showAdminLoginPhone();
}
