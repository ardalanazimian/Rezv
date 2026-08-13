// ═══ رزرونو — پنل business: مارکتینگ + آنالیتیکس + هوش رستوران (Vanilla JS، بدون build، scope مشترک) ═══
let selSeg=null;
// ═══════════ صفحه‌ی «بازاریابی»: کوپن‌ها + اتوماسیون (وصل به بک‌اند واقعی) ═══════════
let mktTab='coupons';
let COUPONS=[], AUTOMATIONS=[], _mktLoaded=false;
const COUPON_KIND_FA={percent:'درصدی',fixed:'مبلغ ثابت',free_item:'آیتم رایگان'};
const COUPON_SEG_FA={new_customer:'مشتری جدید',active:'فعال',at_risk:'در خطر ریزش',churned:'ازدست‌رفته',vip:'VIP'};
const AUTOMATION_TRIGGER_FA={birthday:'تولد مشتری',winback:'بازگرداندنِ مشتریِ غایب',post_visit:'بعد از بازدید',vip_milestone:'رسیدن به سطح VIP',no_show_followup:'پیگیریِ عدم‌حضور'};

async function loadMarketing(){
  if(!API.getToken()) return;
  const [c,a]=await Promise.all([API.couponsList(),API.automationsList()]);
  if(c.ok) COUPONS=c.data?.items||[];
  if(a.ok) AUTOMATIONS=a.data?.items||[];
  _mktLoaded=true;
}
function rMarketing(){
  if(!_mktLoaded && API.getToken()){ loadMarketing().then(()=>rMarketing()); }
  document.getElementById('v-marketing').innerHTML=`
    <div class="itabs">
      <button class="itab ${mktTab==='coupons'?'active':''}" onclick="setMktTab('coupons')">${icon('ticket',{size:14})} کوپن‌ها</button>
      <button class="itab ${mktTab==='automations'?'active':''}" onclick="setMktTab('automations')">${icon('trending',{size:14})} اتوماسیون</button>
    </div>
    <div id="mkt-coupons" class="isub ${mktTab==='coupons'?'active':''}"></div>
    <div id="mkt-automations" class="isub ${mktTab==='automations'?'active':''}"></div>`;
  renderCoupons(); renderAutomations();
}
function setMktTab(t){
  mktTab=t;
  document.querySelectorAll('#v-marketing .itab').forEach((b,i)=>b.classList.toggle('active',['coupons','automations'][i]===t));
  document.querySelectorAll('#v-marketing .isub').forEach(s=>s.classList.toggle('active',s.id==='mkt-'+t));
}
function renderCoupons(){
  const el=document.getElementById('mkt-coupons'); if(!el) return;
  if(!API.getToken()){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">مدیریت کوپن‌ها به اتصال بک‌اند نیاز دارد — در حالت دمو در دسترس نیست.</div>`; return; }
  el.innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">کوپن جدید</div><div class="panel-sub">تخفیف درصدی یا مبلغ ثابت برای مشتریان</div></div></div>
      <div class="field-label">نوع تخفیف</div>
      <select class="inp" id="cpKind" onchange="document.getElementById('cpValueWrap').style.display=this.value==='free_item'?'none':'block'">
        <option value="percent">درصدی</option><option value="fixed">مبلغ ثابت (تومان)</option>
      </select>
      <div id="cpValueWrap" style="margin-top:12px"><div class="field-label">مقدار</div><input class="inp" id="cpValue" type="number" min="1" placeholder="مثلاً ۲۰ (برای ٪) یا ۵۰۰۰۰ (تومان)"></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <div style="flex:1"><div class="field-label">کد (اختیاری)</div><input class="inp" id="cpCode" placeholder="خودکار ساخته می‌شود" dir="ltr"></div>
        <div style="flex:1"><div class="field-label">سگمنت هدف (اختیاری)</div>
          <select class="inp" id="cpSeg"><option value="">همه</option>${Object.entries(COUPON_SEG_FA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <div style="flex:1"><div class="field-label">حداکثر تعداد استفاده (اختیاری)</div><input class="inp" id="cpMax" type="number" min="1" placeholder="نامحدود"></div>
        <div style="flex:1"><div class="field-label">تاریخ انقضا (اختیاری)</div><input class="inp" id="cpUntil" type="date"></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="createCoupon()">ساخت کوپن</button>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">کوپن‌های فعال</div><div class="panel-sub">${fa(COUPONS.length)} کوپن</div></div>
      ${COUPONS.length?COUPONS.map(c=>`
        <div class="staff-row">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;direction:ltr;text-align:right">${esc(c.code)}</div>
            <div style="font-size:12px;color:var(--t2)">${COUPON_KIND_FA[c.kind]||c.kind}${c.kind!=='free_item'?' · '+fa(c.value)+(c.kind==='percent'?'٪':' ت'):''} · ${fa(c.redemption_count||0)}${c.max_redemptions?'/'+fa(c.max_redemptions):''} استفاده${c.target_segment?' · '+(COUPON_SEG_FA[c.target_segment]||c.target_segment):''}</div>
          </div>
          <span class="chip-status ${c.is_active?'arrived':''}" style="${c.is_active?'':'background:var(--s-100);color:var(--t3)'}">${c.is_active?'فعال':'غیرفعال'}</span>
        </div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:30px">هنوز کوپنی ساخته نشده</div>'}
    </div>`;
}
async function createCoupon(){
  const kind=document.getElementById('cpKind').value;
  const value=+document.getElementById('cpValue').value||0;
  if(kind!=='free_item' && value<=0){ toast('','مقدار تخفیف رو درست وارد کن'); return; }
  if(kind==='percent' && value>100){ toast('','درصد نمی‌تواند بیش از ۱۰۰ باشد'); return; }
  const body={
    kind, value: kind==='free_item'?undefined:value,
    code: document.getElementById('cpCode').value.trim()||undefined,
    target_segment: document.getElementById('cpSeg').value||undefined,
    max_redemptions: +document.getElementById('cpMax').value||undefined,
    valid_until: document.getElementById('cpUntil').value||undefined,
  };
  const res=await API.couponCreate(body);
  if(res.ok){ toast('',`کوپن ${res.data?.code||''} ساخته شد`); await loadMarketing(); rMarketing(); }
  else toast('', res.error?.message||'ساخت کوپن ناموفق بود');
}
function renderAutomations(){
  const el=document.getElementById('mkt-automations'); if(!el) return;
  if(!API.getToken()){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">اتوماسیون به اتصال بک‌اند نیاز دارد — در حالت دمو در دسترس نیست.</div>`; return; }
  el.innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">قانونِ خودکار جدید</div><div class="panel-sub">پیامک خودکار وقتی یه رویداد خاص افتاد</div></div></div>
      <div class="field-label">نام قانون</div><input class="inp" id="atName" placeholder="مثلاً پیامک تولد مشتری‌ها">
      <div style="margin-top:12px"><div class="field-label">رویدادِ محرک</div>
        <select class="inp" id="atTrigger">${Object.entries(AUTOMATION_TRIGGER_FA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div style="margin-top:12px"><div class="field-label">کوپنِ همراه (اختیاری)</div>
        <select class="inp" id="atCoupon"><option value="">بدون کوپن</option>${COUPONS.map(c=>`<option value="${c.id}">${esc(c.code)}</option>`).join('')}</select></div>
      <div style="margin-top:12px"><div class="field-label">متن پیامک</div>
        <textarea class="inp txta" id="atMsg" placeholder="سلام {نام}! ..."></textarea></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="createAutomation()">فعال‌سازی قانون</button>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">قوانینِ فعال</div><div class="panel-sub">${fa(AUTOMATIONS.length)} قانون</div></div>
      ${AUTOMATIONS.length?AUTOMATIONS.map(a=>`
        <div class="staff-row">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${esc(a.name)}</div>
            <div style="font-size:12px;color:var(--t2)">${AUTOMATION_TRIGGER_FA[a.trigger]||a.trigger} · ${fa(a.sent_count||0)} ارسال · ${fa(a.conversion_rate_pct||0)}٪ تبدیل</div>
          </div>
          <span class="chip-status ${a.is_active?'arrived':''}" style="${a.is_active?'':'background:var(--s-100);color:var(--t3)'}">${a.is_active?'فعال':'غیرفعال'}</span>
        </div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:30px">هنوز قانونی ساخته نشده</div>'}
    </div>`;
}
async function createAutomation(){
  const name=document.getElementById('atName').value.trim();
  const message_template=document.getElementById('atMsg').value.trim();
  if(!name){ toast('','یه اسم برای قانون بنویس'); return; }
  if(!message_template){ toast('','متن پیامک رو بنویس'); return; }
  const body={
    name, trigger: document.getElementById('atTrigger').value, message_template,
    coupon_id: document.getElementById('atCoupon').value||undefined,
  };
  const res=await API.automationCreate(body);
  if(res.ok){ toast('','قانون فعال شد'); await loadMarketing(); rMarketing(); }
  else toast('', res.error?.message||'ساخت قانون ناموفق بود');
}
function pickSeg(i,el){document.querySelectorAll('.seg-card').forEach(s=>s.classList.remove('sel'));el.classList.add('sel');selSeg=i;
  const codes=['SPECIAL','VIP','WELCOME','BDAY'];document.getElementById('campText').value=`سلام {نام} عزیز! 🌿\nیه پیشنهاد ویژه از کافه ویستا داریم.\nکد اختصاصیت: ${codes[i]}${fa(Math.floor(Math.random()*900+100))}\nمنتظرتیم ❤️`;
  document.getElementById('charCount').textContent=fa(document.getElementById('campText').value.length);
}
function previewCamp(){
  const txt=document.getElementById('campText').value.trim();
  if(!txt){toast('','اول متن پیام رو بنویس');return}
  if(selSeg===null){toast('','سگمنت رو انتخاب کن');return}
  // ذخیره برای ارسال واقعی (نگاشت index سگمنت به segment بک‌اند)
  window._campMessage=txt;
  window._campSegment=({0:'at_risk',1:'gold',2:'all',3:'all'})[selSeg]||'all';
  const rendered=txt.replace(/\{نام\}/g,'کیان');
  openModal(`<div class="modal-title">پیش‌نمایش پیام</div><div class="modal-sub">دقیقاً همینطوری برای مشتری ارسال می‌شه</div>
    <div style="background:#0c0c14;border-radius:var(--r-lg);padding:16px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08)">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">R</div>
        <div><div style="font-size:13px;font-weight:700;color:#fff">کافه‌رستوران ویستا</div><div style="font-size:10px;color:#666">فرستنده تأییدشده</div></div>
      </div>
      <div style="background:#1c1c28;border-radius:4px 16px 16px 16px;padding:12px 14px;font-size:13px;color:#ddd;line-height:1.8;white-space:pre-wrap">${rendered}</div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" onclick="confirmCamp()">تأیید و ارسال</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">برگشت و ویرایش</button>`);
}
function confirmCamp(){
  openModal(`<div style="text-align:center;padding:6px 0">
    <div style="margin-bottom:14px;color:var(--warning)">${icon('alert',{size:40})}</div>
    <div class="modal-title" style="text-align:center">تأیید نهایی ارسال</div>
    <div class="modal-sub" style="text-align:center;direction:ltr;font-family:sans-serif">By confirming, your SMS campaign will be executed. Are you sure?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:20px">با تأیید، کمپین اجرا و ارسال می‌شه.</div>
    <button class="btn btn-primary btn-lg btn-block" id="campSendBtn" onclick="doSendCampaign()">بله، ارسال کن</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  </div>`);
}
async function doSendCampaign(){
  const btn=document.getElementById('campSendBtn');
  if(btn){btn.disabled=true;btn.textContent='در حال ارسال...';}
  // segment انتخاب‌شده (اگر در فرم کمپین بود) — پیش‌فرض همه
  const seg=window._campSegment||'all';
  if(API.getToken()){
    const res=await API.sendSms({kind:'campaign',segment:seg,message:window._campMessage||''});
    if(res.ok){
      closeModal();
      toast('',`کمپین به ${fa(res.data?.queued||0)} نفر ارسال شد`);
      pushNotif({ic:'blue',emoji:'message',title:'کمپین ارسال شد',text:`${fa(res.data?.queued||0)} پیامک در صف ارسال`,time:'همین الان',unread:true});
      return;
    }
    if(!res.offline){closeModal();toast('',res.error?.message||'ارسال ناموفق بود');return;}
  }  // fallback (آفلاین یا بدون توکن)
  closeModal();
  toast('','کمپین ارسال شد');
}
// ═══════════ ANALYTICS + RESTAURANT AI ═══════════
// نقشه‌ی حرارتیِ اشغال: روز هفته × ساعت. ورودی: [{dow,hour,count}] (dow 0=یکشنبه)
function buildHeatmap(rows){
  // اگر داده‌ی واقعی نبود، نمونه‌ی واقع‌گرایانه بساز (شب‌ها و آخر هفته شلوغ‌تر)
  const hours=[12,13,14,18,19,20,21,22];
  const dowFa=['ی','د','س','چ','پ','ج','ش']; // نمایش: یکشنبه..شنبه؟ در ایران هفته از شنبه
  // بازچینش به ترتیب هفته‌ی ایرانی: شنبه(6)..جمعه(5)
  const order=[6,0,1,2,3,4,5]; const orderLbl=['ش','ی','د','س','چ','پ','ج'];
  const grid={}; let mx=0;
  if(rows&&rows.length){
    rows.forEach(r=>{ grid[`${r.dow}-${r.hour}`]=r.count; if(r.count>mx)mx=r.count; });
  } else {
    order.forEach((d,di)=>hours.forEach(h=>{
      const wknd=(d===4||d===5)?1.8:1; const night=(h>=19&&h<=21)?2.2:(h>=18?1.4:0.6);
      const v=Math.round(Math.random()*4*wknd*night); grid[`${d}-${h}`]=v; if(v>mx)mx=v;
    }));
  }
  mx=mx||1;
  const cell=(d,h)=>{
    const v=grid[`${d}-${h}`]||0; const t=v/mx;
    // رنگ: از خنثی تا گرادیانِ برند (شلوغی = گرم‌تر)
    const bg=t===0?'var(--s-100)':`rgba(${Math.round(106+t*149)},${Math.round(75-t*20)},${Math.round(255-t*130)},${0.15+t*0.85})`;
    return `<div class="hm-cell" style="background:${bg}" title="${orderLbl[order.indexOf(d)]} ساعت ${fa(h)}: ${fa(v)} رزرو"></div>`;
  };
  return `
    <div class="hm-grid">
      <div class="hm-corner"></div>
      ${hours.map(h=>`<div class="hm-hlabel">${fa(h)}</div>`).join('')}
      ${order.map((d,di)=>`
        <div class="hm-dlabel">${orderLbl[di]}</div>
        ${hours.map(h=>cell(d,h)).join('')}
      `).join('')}
    </div>
    <div class="hm-legend"><span>کم</span><div class="hm-scale"></div><span>شلوغ</span></div>`;
}
async function rAnalytics(){
  // مقادیر پیش‌فرض (نمونه) — اگر API در دسترس بود، جایگزین می‌شوند
  let A={
    weekThisWeek:136, returnRate:66, avgVisits:'۲.۸', avgInterval:16,
    totalCustomers:248, newPct:34,
    visitDist:[['۱ بار (تازه‌وارد)',38],['۲ تا ۴ بار',42],['۵ بار به بالا (وفادار)',20]],
    weekly:[14,18,24,31],
  };
  // بارگذاری از API اگر توکن staff داریم
  if(API.getToken()){
    const res=await API.get('/restaurant/analytics');
    if(res.ok && res.data){
      API.online=true;
      const d=res.data;
      const totalVisits=(d.visit_distribution?.once||0)+(d.visit_distribution?.few||0)*3+(d.visit_distribution?.loyal||0)*6;
      A={
        weekThisWeek:(d.weekly_reservations||[]).reduce((s,x)=>s+x,0),
        returnRate:d.return_rate_pct||0,
        avgVisits:d.total_customers?fa(Math.round(totalVisits/d.total_customers*10)/10):'۰',
        avgInterval:d.avg_interval_days||0,
        totalCustomers:d.total_customers||0,
        newPct:d.total_customers?Math.round(d.new_customers/d.total_customers*100):0,
        visitDist:[
          ['۱ بار (تازه‌وارد)',d.total_customers?Math.round((d.visit_distribution?.once||0)/d.total_customers*100):0],
          ['۲ تا ۴ بار',d.total_customers?Math.round((d.visit_distribution?.few||0)/d.total_customers*100):0],
          ['۵ بار به بالا (وفادار)',d.total_customers?Math.round((d.visit_distribution?.loyal||0)/d.total_customers*100):0],
        ],
        weekly:d.weekly_reservations||[0,0,0,0],
      };
      A.heatmap=d.heatmap||[];
      window.__A_HEATMAP=A.heatmap;
    } else { API.online=false; }
  }
  window.__A_HEATMAP=window.__A_HEATMAP||[];
  // ⚠️ رفعِ باگِ واقعی (۲۰۲۶-۰۸-۱۳): این نمودارِ ۷روزه قبلاً اعدادِ ثابتِ
  // هاردکد را نشان می‌داد و حتی وقتی API آنلاین بود هم عوض نمی‌شد — یعنی
  // صاحبِ رستوران نمودارِ ساختگی می‌دید و فکر می‌کرد دادهٔ خودش است.
  // حالا از heatmapِ واقعی (dow/hour/count) روی روز جمع زده می‌شود.
  // نگاشتِ dowِ Postgres (۰=یکشنبه) به هفتهٔ فارسی (شنبه اولِ هفته).
  const DOW_FA=[['ش',6],['ی',0],['د',1],['س',2],['چ',3],['پ',4],['ج',5]];
  const heat=window.__A_HEATMAP;
  let days, isSampleChart=false;
  if(Array.isArray(heat) && heat.length){
    const byDow={};
    for(const c of heat){ byDow[c.dow]=(byDow[c.dow]||0)+(c.count||0); }
    days=DOW_FA.map(([label,dow])=>[label, byDow[dow]||0]);
  } else {
    // حالتِ آفلاین/نمونه — همان قاعدهٔ بقیهٔ صفحه، و dataSourceNote بالای
    // صفحه صراحتاً می‌گوید دادهٔ واقعی نیست.
    days=[['ش',14],['ی',11],['د',13],['س',17],['چ',22],['پ',28],['ج',31]];
    isSampleChart=true;
  }
  const mx=Math.max(1,...days.map(([,v])=>v));
  const totalGuests=A.totalCustomers;
  const returnRate=A.returnRate;
  const avgVisits=A.avgVisits;
  document.getElementById('v-analytics').innerHTML=`
    <div class="pg-head"><div class="pg-title">تحلیل‌ها</div><div class="pg-sub">روند رزرو، نرخ بازگشت و رفتار مشتری‌ها</div></div>
    ${dataSourceNote()}
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon blue">${icon('calendar',{size:16})}</div><span class="kpi-delta up">${icon('trending',{size:11})} ۱۸٪</span></div><div class="kpi-val">${fa(A.weekThisWeek)}</div><div class="kpi-label">رزرو این هفته</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon teal">${icon('refresh',{size:16})}</div><span class="kpi-delta up">${icon('trending',{size:11})} ۵٪</span></div><div class="kpi-val">${fa(returnRate)}٪</div><div class="kpi-label">نرخ بازگشت مشتری</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon amber">${icon('users',{size:16})}</div></div><div class="kpi-val">${avgVisits}</div><div class="kpi-label">میانگین دفعات مراجعه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon green">${icon('calendar',{size:16})}</div></div><div class="kpi-val">${fa(A.avgInterval)}</div><div class="kpi-label">میانگین فاصله (روز)</div></div>
    </div>

    <div class="row-2-1">
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">رزروهای هفتگی</div><div class="panel-sub">تعداد رزرو در هر روز</div></div></div>
        <div class="chart">${days.map(([d,v])=>`<div class="bar-col"><div class="bar ${d==='ج'?'teal':''}" style="height:${v/mx*100}%"><span class="bar-val">${fa(v)}</span></div><div class="bar-label">${d}</div></div>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">مشتری جدید و قدیمی</div></div>
        <div class="donut-wrap">
          <div class="donut" style="background:conic-gradient(var(--blue) 0 ${A.newPct}%,var(--teal) ${A.newPct}% 100%)"><div class="donut-hole"><div class="dv">${fa(totalGuests)}</div><div class="dl">مشتری</div></div></div>
          <div class="legend">
            <div class="legend-item"><span class="legend-dot" style="background:var(--blue)"></span>جدید<span class="legend-val">${fa(A.newPct)}٪</span></div>
            <div class="legend-item"><span class="legend-dot" style="background:var(--teal)"></span>قدیمی (بازگشتی)<span class="legend-val">${fa(returnRate)}٪</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- الگوی مراجعه -->
    <div class="row2" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">دفعات مراجعه‌ی مشتریان</div><div class="panel-sub">چند بار اومدن</div></div></div>
        ${A.visitDist.map(([l,p],i)=>`
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:13px">`+
          `<span style="width:150px;font-size:13px;font-weight:600">${l}</span><div style="flex:1;height:8px;background:var(--s-100);border-radius:4px;overflow:hidden"><div style="height:100%;width:${p}%;background:${['var(--blue)','var(--teal)','var(--green)'][i]};border-radius:4px;transition:width .8s"></div></div><span style="font-weight:700;font-size:13px;width:36px;text-align:left">${fa(p)}٪</span></div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-head"><div><div class="panel-title">روند ۴ هفته</div><div class="panel-sub">رزرو هفتگی</div></div></div>
        <div class="chart">${A.weekly.map((v,i)=>{const wmx=Math.max(...A.weekly,1);return `<div class="bar-col"><div class="bar" style="height:${v/wmx*100}%"><span class="bar-val">${fa(v)}</span></div><div class="bar-label">هفته ${fa(i+1)}</div></div>`}).join('')}</div>
      </div>
    </div>
    ${rAnalyticsTail()}`;
}
// بخش پایانی آنالیز: نقشه‌ی حرارتیِ اشغال (روز × ساعت)
function rAnalyticsTail(){
  return `
    <div class="panel" style="margin-top:20px">
      <div class="panel-head">
        <div><div class="panel-title">${icon('flame',{size:16,fill:true})} نقشه‌ی حرارتیِ شلوغی</div><div class="panel-sub">کدوم روزها و ساعت‌ها شلوغ‌ترین؟ (۹۰ روز اخیر)</div></div>
      </div>
      ${buildHeatmap(window.__A_HEATMAP||[])}
      <div class="hm-insight">${icon('info',{size:13})} با این نقشه می‌تونی تصمیم بگیری کِی پرسنل بیشتر بذاری، کِی تخفیف بدی تا ساعت‌های خلوت پر شن، و کِی حداقل مبلغ رزرو رو بالا ببری.</div>
    </div>`;
}
// ═══════════ STAFF ═══════════
