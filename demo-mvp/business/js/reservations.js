// ═══ رزرونو — پنل business: رزروها + پلان طبقه (Vanilla JS، بدون build، scope مشترک) ═══
let resDate='today', resQuery='';
function rReservations(){
  document.getElementById('v-reservations').innerHTML=`
    <div class="pg-head"><div class="pg-title">رزروها</div><div class="pg-sub">مدیریت و جستجوی همه‌ی رزروهای امروز و آینده</div></div>
    <!-- جستجو -->
    <div class="search-res">
      <div class="search-box">
        <span class="s-ic">🔍</span>
        <input id="resSearch" placeholder="جستجو با نام، فامیل یا شماره تلفن..." value="${esc(resQuery)}" oninput="searchRes(this.value)">
        <button class="s-clear ${resQuery?'show':''}" onclick="clearResSearch()">×</button>
      </div>
      <button class="btn btn-primary" onclick="openManual()">➕ رزرو جدید</button>
    </div>
    <!-- تاریخ -->
    <div class="date-tabs">
      <button class="date-tab ${resDate==='today'?'active':''}" onclick="setResDate('today')">📅 امروز</button>
      <button class="date-tab ${resDate==='tomorrow'?'active':''}" onclick="setResDate('tomorrow')">فردا</button>
      <button class="date-tab ${resDate==='upcoming'?'active':''}" onclick="setResDate('upcoming')">روزهای آینده</button>
      <button class="date-tab ${resDate==='past'?'active':''}" onclick="setResDate('past')">📋 گزارش گذشته</button>
      <button class="date-tab ${resDate==='all'?'active':''}" onclick="setResDate('all')">همه</button>
    </div>
    <div class="panel">
      <div id="resTL"></div>
    </div>`;
  renderResList();
}
async function renderResList(){
  const el=document.getElementById('resTL');
  if(!el)return;
  // اگر توکن staff داریم، رزروها را از API بگیر (بر اساس تاریخ انتخاب‌شده)
  let source=RES;
  if(API.getToken()){
    el.innerHTML=`<div style="text-align:center;padding:30px;color:var(--t2)">در حال بارگذاری رزروها...</div>`;
    const fresh=await loadReservations(resDate);
    if(fresh!==null)source=fresh; // داده‌ی واقعی؛ در غیر این صورت نمونه
  }
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
  const dateLabel={today:'امروز',tomorrow:'فردا',upcoming:'روزهای آینده',past:'گذشته',all:'همه روزها'}[resDate];
  if(!list.length){
    el.innerHTML=`<div class="no-results"><div class="nr-emoji">${resDate==='past'?'📋':'🔍'}</div><div style="font-weight:700;margin-bottom:4px">رزروی پیدا نشد</div><div style="font-size:13px">${resQuery?'با این جستجو نتیجه‌ای نبود':'برای '+dateLabel+' رزروی نیست'}</div></div>`;
    return;
  }
  // گزارش گذشته: خلاصه‌ی آماری بالا
  if(resDate==='past'){
    const done=list.filter(x=>x.r.status==='completed'||x.r.status==='arrived').length;
    const noshow=list.filter(x=>x.r.status==='noshow').length;
    const cancelled=list.filter(x=>x.r.status==='cancelled').length;
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        <div style="background:var(--green-50);border:1px solid #BBF7D0;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#15803D">${fa(done)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">✅ انجام‌شده</div></div>
        <div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#D97706">${fa(noshow)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">⚠️ نیومدن (no-show)</div></div>
        <div style="background:var(--red-50);border:1px solid #FECACA;border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#B91C1C">${fa(cancelled)}</div><div style="font-size:11px;color:var(--t2);font-weight:600">🚫 لغوشده</div></div>
      </div>`+
      list.map(x=>resItemHTML(x.r,x.i)).join('');
    return;
  }
  const seated=list.filter(x=>x.r.status==='arrived').length;
  el.innerHTML=`<div style="font-size:13px;color:var(--t2);margin-bottom:14px;font-weight:600">${fa(list.length)} رزرو · ${fa(seated)} مهمان رسیده${resQuery?` · نتایج «${esc(resQuery)}»`:''}</div>`+
    list.map(x=>resItemHTML(x.r,x.i)).join('');
}
// تبدیل ارقام انگلیسی به فارسی برای جستجوی تلفن
function toFaDigits(s){return s.replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
function searchRes(v){resQuery=v;document.querySelector('.s-clear')?.classList.toggle('show',!!v);renderResList()}
function clearResSearch(){resQuery='';const i=document.getElementById('resSearch');if(i)i.value='';document.querySelector('.s-clear')?.classList.remove('show');renderResList()}
function setResDate(d){resDate=d;rReservations()}
function resItemHTML(r,i){
  const isPast=['completed','noshow','no_show','cancelled','auto_cancelled','rejected','expired'].includes(r.status);
  const statusChip=(STATUS_META[r.status]?`<span class="chip-status" style="background:${STATUS_META[r.status].bg};color:${STATUS_META[r.status].fg}">${STATUS_META[r.status].icon} ${STATUS_META[r.status].label}</span>`:'');
  // برچسب تاریخ (وقتی تب «همه» یا گذشته‌ست مفیده)
  const dateBadge=(resDate==='all'||resDate==='past'||resDate==='upcoming')&&r.dLabel?`<span style="font-size:11px;color:var(--t3);font-weight:600">${r.dLabel} · </span>`:'';
  return `<div class="tl-item"><div class="tl-time"><div class="tl-time-v">${r.t}</div></div>
    <div class="tl-card ${r.status}${r.seg==='vip'?' vip':''}"${isPast?' style="opacity:.92"':''}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="tl-name">${esc(r.name)} ${r.seg==='vip'?'<span class="tl-tag vip">VIP</span>':r.seg==='new'?'<span class="tl-tag new">جدید</span>':''}</div>
        ${statusChip}
      </div>
      <div class="tl-meta">${dateBadge}👥 ${fa(r.party)} نفر · میز ${fa(r.table)} · 📞 ${esc(r.phone)} ${r.pre?'· 🍽 پیش‌سفارش':''}</div>
      ${r.note?`<div class="tl-meta" style="color:#D97706">📝 ${esc(r.note)}</div>`:''}
      ${r.cancelReason?`<div class="tl-meta" style="color:#B91C1C">🚫 دلیل لغو: ${r.cancelReason}</div>`:''}
      ${!isPast?`<div class="tl-actions">
        ${r.status!=='arrived'?`<button class="btn btn-teal btn-sm" onclick="markArrived(${i})">✓ رسید</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="openStatusMenu(${i})">⇄ وضعیت</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('📞','تماس با '+${JSON.stringify(esc(r.name))})">تماس</button>
        <button class="btn btn-danger btn-sm" onclick="cancelRes(${i})">لغو</button>
      </div>`:`<div class="tl-actions"><button class="btn btn-ghost btn-sm" onclick="viewHistory(${i})">📜 تاریخچه</button><button class="btn btn-ghost btn-sm" onclick="toast('📞','تماس با '+${JSON.stringify(esc(r.name))})">تماس</button>${r.status==='completed'?`<button class="btn btn-ghost btn-sm" onclick="openManual()">رزرو مجدد</button>`:''}</div>`}
    </div></div>`;
}
async function markArrived(i){
  RES[i].status='arrived';rReservations();
  // ارسال واقعی پیامک خوش‌آمد (اگر شماره و توکن داریم)
  const phone=RES[i].phone;
  // اگر آفلاین: تغییر وضعیت را برای همگام‌سازی صف کن (روی داده‌ی محلی از قبل اعمال شد)
  if(isOffline() && API.getToken()){
    Outbox.enqueue({ type:'checkin', path:`/restaurant/reservations/${RES[i].code||RES[i].id||''}/status`, method:'PATCH', body:{ status:'checked_in' }, label:`ثبت ورود ${RES[i].name}` });
    toast('📴',`${RES[i].name} رسید — با برگشت اینترنت همگام می‌شود`);
    return;
  }
  if(API.getToken() && phone){
    const res=await API.sendSms({kind:'campaign',phones:[phone.replace(/\s/g,'')],message:'welcome'});
    if(res.ok){toast('🟢',`${RES[i].name} رسید — پیامک خوش‌آمد ارسال شد`);return;}
  }
  // fallback
  toast('🟢',`${RES[i].name} رسید${phone?' — پیامک خوش‌آمد ارسال شد':''}`);
}
function cancelRes(i){
  openModal(`<div class="modal-title">لغو رزرو</div><div class="modal-sub">${RES[i].name} — ساعت ${RES[i].t}</div>
    <div class="field-label">دلیل لغو (الزامی)</div>
    <input class="inp" id="cancelReason" placeholder="مثلاً تماس مشتری، تداخل میز...">
    <div style="display:flex;gap:8px"><button class="btn btn-danger btn-lg" style="flex:1" onclick="doCancelRes(${i})">تأیید لغو</button><button class="btn btn-ghost btn-lg" onclick="closeModal()">انصراف</button></div>`);
}
function doCancelRes(i){
  const reason=document.getElementById('cancelReason').value.trim();
  if(!reason){toast('⚠️','دلیل لغو الزامیه');return}
  RES.splice(i,1);closeModal();rReservations();toast('✓','رزرو لغو شد — دلیل ثبت شد');
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
    <div class="modal-title">🚶 ورود بدون رزرو</div>
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
  if(!ph||ph.length<11){toast('⚠️','شماره موبایل کامل وارد کن');return}
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
    const tierName={gold:'🥇 طلایی',silver:'🥈 نقره‌ای',bronze:'🥉 برنزی'}[member.tier]||member.tier;
    openModal(`
      <div style="text-align:center;margin-bottom:6px"><div style="width:56px;height:56px;border-radius:50%;background:var(--teal-50);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 12px">👋</div></div>
      <div class="modal-title" style="text-align:center">${esc(member.fn)} ${esc(member.ln)} خوش اومدی!</div>
      <div class="modal-sub" style="text-align:center">مشتری قدیمی — قبلاً ثبت‌شده</div>
      <div class="summary" style="margin-bottom:18px">
        <div class="sum-row"><span class="k">کد عضویت</span><span class="v">${member.code}</span></div>
        <div class="sum-row"><span class="k">سطح</span><span class="v">${tierName}</span></div>
        <div class="sum-row"><span class="k">امتیاز</span><span class="v">${fa(member.points)}</span></div>
        <div class="sum-row"><span class="k">موبایل</span><span class="v">${member.phone}</span></div>
      </div>
      <div class="field-label">تعداد نفرات</div>
      <div class="opt-row wparty-group">
        ${[1,2,3,4,6].map((c,idx)=>`<div class="opt ${idx===1?'sel':''}" onclick="document.querySelectorAll('.wparty-group .opt').forEach(o=>o.classList.remove('sel'));this.classList.add('sel')" data-p="${c}">${fa(c)} نفر</div>`).join('')}
      </div>
      <div class="field-label">میز (اختیاری)</div>
      ${tableSelectHtml}
      <button class="btn btn-teal btn-lg btn-block" id="wConfirmBtn" style="margin-top:14px" onclick="walkinCheckinMember()">✓ ثبت ورود</button>
    `);
    window._walkinMember={phone:member.phone,name:(member.fn+' '+member.ln).trim()};
  }else{
    openModal(`
      <div class="modal-title">مهمان جدید 👋</div>
      <div class="modal-sub">این شماره تازه‌ست — یه ثبت سریع کنیم تا دفعه‌ی بعد بشناسیمش</div>
      <div style="background:var(--teal-50);border:1px solid #99F6E4;border-radius:var(--r);padding:11px 14px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--teal-600);text-align:center">📞 ${ph}</div>
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
      <button class="btn btn-primary btn-lg btn-block" id="wConfirmBtn" style="margin-top:16px" onclick="walkinNewSave('${esc(raw)}')">✓ ثبت ورود + عضویت باشگاه</button>
    `);
  }
}
function walkinCheckinMember(){if(window._walkinMember){walkinCheckinReal(window._walkinMember.phone,null,null,null)}}
// ثبت واقعی ورود — وصل به POST /restaurant/walkin (پیدا/ساخت کاربر + عضویت باشگاه + رزرو seated + اشغال میز)
async function walkinCheckinReal(phone,firstName,lastName,birthDayMonth){
  const party=+(document.querySelector('.wparty-group .opt.sel')?.dataset.p||2);
  const tableId=document.getElementById('wTable')?.value||null;
  const btn=document.getElementById('wConfirmBtn');
  if(btn){btn.disabled=true;btn.textContent='در حال ثبت...';}
  const body={phone,party_size:party,table_id:tableId||undefined};
  if(firstName){body.first_name=firstName;body.last_name=lastName||'';}
  if(birthDayMonth){body.birth_day=birthDayMonth[0];body.birth_month=birthDayMonth[1];}
  const res=await API.walkin(body);
  if(!res.ok){
    // آفلاین → محلی ثبت کن و برای همگام‌سازی صف کن (واک‌این نباید در قطعی اینترنت بخوابد)
    if(res.offline){
      const nm=(firstName?firstName+(lastName?' '+lastName:''):'مهمان واک‌این');
      const localRec={t:new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}),name:nm,party,table:tableId||null,status:'arrived',seg:'new',pre:false,note:'واک‌این (آفلاین)',phone,date:'today',dLabel:'امروز'};
      RES.push(localRec);
      if(API.getToken()){
        Outbox.enqueue({ type:'walkin', path:'/restaurant/walkin', method:'POST', body, label:`واک‌این ${nm}${tableId?' · میز':''}`, localRef:localRec });
      }
      closeModal();
      if(document.getElementById('v-overview').classList.contains('active'))rOverview();
      else if(document.getElementById('v-floor').classList.contains('active'))rFloor();
      toast('📴',`${nm} محلی ثبت شد — با برگشت اینترنت همگام می‌شود`);
      return;
    }
    toast('⚠️',res.error?.message||'ثبت ورود ناموفق بود');
    if(btn){btn.disabled=false;btn.textContent='✓ ثبت ورود';}
    return;
  }
  closeModal();
  // داده‌های واقعی رو دوباره بکش (باشگاه، میزها، رزروهای امروز)
  await Promise.all([loadTables(), loadClubMembers().then(c=>CLUB=c)]);
  if(document.getElementById('v-overview').classList.contains('active'))rOverview();
  else if(document.getElementById('v-reservations').classList.contains('active')){resDate='today';rReservations()}
  else if(document.getElementById('v-floor').classList.contains('active'))rFloor();
  toast('✅',`${res.data.name} ثبت ورود شد${tableId?' · میز اختصاص یافت':''}`);
  if(res.data.enrolled_now) setTimeout(()=>toast('🎫',`عضو باشگاه شد (${res.data.club_code})`),900);
}
async function walkinNewSave(rawPhone){
  const fn=document.getElementById('wFn').value.trim();
  const ln=document.getElementById('wLn').value.trim();
  if(!fn){toast('⚠️','حداقل نام رو وارد کن');return}
  const bd=document.getElementById('wBd').value;
  const bm=document.getElementById('wBm').value;
  await walkinCheckinReal(rawPhone,fn,ln,(bd&&bm)?[bd,bm]:null);
}

async function saveManual(){
  const n=document.getElementById('mName').value.trim();
  if(!n){toast('⚠️','نام مهمان رو وارد کن');return}
  const phone=document.getElementById('mPhone').value;
  const dateSel=document.getElementById('mDate');
  const dateVal=dateSel.value;
  const opt=dateSel.options[dateSel.selectedIndex];
  const dLabel=opt.dataset.label||opt.text.replace(/^(امروز|فردا)\s*—\s*/,'').trim();
  const dateKey=(dateVal==='today'||dateVal==='tomorrow')?dateVal:'upcoming';
  const timeVal=document.getElementById('mTime').value;
  const partyVal=+document.getElementById('mParty').value.replace(/[^\d]/g,'')||2;
  const tableVal=+document.getElementById('mTable').value.replace(/[^\d]/g,'')||1;

  // اگر توکن staff داریم، رزرو واقعی در دیتابیس ثبت کن
  if(API.getToken()){
    const dt=manualDateToISO(dateVal,timeVal);
    const res=await API.post('/reservations',{
      restaurant_id:STAFF_INFO?.restaurant_id||undefined,
      date:dt.date,time:dt.time,party_size:partyVal,notify_sms:!!phone,
      guest:{name:n,phone:phone,table_number:tableVal,note:'رزرو دستی'},
    });
    if(res.ok){
      // موفق در سرور — به‌علاوه‌ی نمایش محلی
      RES.push({t:timeVal,name:n,party:partyVal,table:tableVal,status:'confirmed',seg:'new',pre:false,note:'رزرو دستی',phone,date:dateKey,dLabel,code:res.data?.reservation?.code});
      const clubBefore=CLUB.length;
      CLUB=await loadClubMembers(); // وضعیت واقعی باشگاه رو از سرور بگیر، حدس نزن
      const newlyEnrolled=CLUB.length>clubBefore;
      closeModal();resDate=dateKey;
      if(document.getElementById('v-reservations').classList.contains('active'))rReservations();
      else if(document.getElementById('v-overview').classList.contains('active'))rOverview();
      toast('🎫',`رزرو ${dLabel} در سیستم ثبت شد${newlyEnrolled?` + ${n} به باشگاه اضافه شد`:''}`);
      return;
    }
    if(!res.offline){toast('⚠️',res.error?.message||'ثبت رزرو ناموفق بود');return;}
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
      label:`رزرو ${n} · ${dLabel} ${timeVal}`, localRef:localRec,
    });
  }
  const res=enrollClub(n,phone);
  closeModal();
  resDate=dateKey;
  if(document.getElementById('v-reservations').classList.contains('active'))rReservations();
  else if(document.getElementById('v-overview').classList.contains('active'))rOverview();
  if(res.enrolled){
    toast('🎫',`رزرو ${dLabel} ثبت شد + ${n} به باشگاه اضافه شد (${res.member.code})`);
  }else if(res.reason==='exists'){
    toast('✓',`رزرو ${dLabel} ثبت شد · ${n} قبلاً عضو باشگاهه`);
  }else{
    toast('✓',`رزرو ${dLabel} ثبت شد`);
  }
}

// ═══════════ FLOOR PLAN ═══════════
// هماهنگ‌سازی وضعیت میزها با رزروهای فعال امروز
// میزی که رزرو «تأییدشده»ی امروز داره → reserved (اگه دستی seated نشده باشه)
// میزی که مهمانش «رسیده» → seated
function syncTablesFromReservations(){
  const todayRes=RES.filter(r=>r.date==='today'&&r.table>0&&(r.status==='confirmed'||r.status==='arrived'));
  TABLES.forEach(t=>{
    // اگه دستی روی این میز وضعیت seated گذاشته شده و رزروی نیست، دست نزن
    const res=todayRes.find(r=>r.table===t.n);
    if(res){
      // رزرو فعال داره
      if(res.status==='arrived')t.s='seated';
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
