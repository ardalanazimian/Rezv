// ═══ رزرونو — جزئیات رستوران + شیت رزرو (بخشی از اپ کاستومر) ═══
import { API, isLoggedIn } from '../api.js';
import { closeSheet, esc, openLogin, openSheet, toApiDateTime, toast } from '../auth.js';
import { detailSocialProof, fmtFa, go, toggleRestFav } from './discover.js';
import { GRAD, TRIPS, bk, curRest, favs, pts, setCurRest, setBk, setPts } from './seed.js';
import { R } from '../init.js';
import { offerWaitlist } from '../reservation.js';
import { armReveals, buzz } from '../theme-pwa.js';
export function openRest(id){
  setCurRest(id);const r=R.find(x=>x.id===id);
  const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
  document.getElementById('page-rest').innerHTML=`
    <div class="rp-hero" style="background:${GRAD[id]}">
      <div class="rp-hero-mesh"></div>
      <button class="rp-hero-back glass" onclick="go('discover')" aria-label="بازگشت به کشف">→</button>
      <div class="rp-hero-actions">
        <button class="rp-hero-icon glass" onclick="buzz&&buzz();toast('🔗','لینک کپی شد')" aria-label="اشتراک‌گذاری رستوران">🔗</button>
        <button class="rp-hero-icon glass" id="rpFav" onclick="buzz&&buzz();toggleRestFav(${id})" aria-label="افزودن به علاقه‌مندی‌ها">${favs.has(id)?'❤️':'🤍'}</button>
      </div>
      <div class="rp-hero-emoji">${r.e}</div>
      <div class="rp-hero-overlay">
        <div class="rp-hero-badges">
          ${r.now?`<span class="rp-hero-badge live">🟢 الان باز</span>`:''}
          <span class="rp-hero-badge">💰 ${fmtFa(r.cb)}٪ کش‌بک</span>
        </div>
        <div class="rp-hero-name">${esc(r.n)}</div>
        <div class="rp-hero-meta">
          <span class="rp-hero-rate"><span style="color:#FBBF24">★</span> ${fmtFa(r.rt)}</span>
          <span class="rp-hero-dot">·</span>
          <span>${fmtFa(r.reviews)} نظر</span>
          <span class="rp-hero-dot">·</span>
          <span>${esc(r.cuisine)}</span>
          <span class="rp-hero-dot">·</span>
          <span>${esc(r.price)}</span>
        </div>
      </div>
    </div>
    <div class="wrap rp-body">
      ${detailSocialProof(r)}

      <div class="rp-section reveal"><h3>درباره</h3><p class="rp-about">${esc(r.about)}</p><div class="feat-row">${r.feats.map(f=>`<span class="feat">✓ ${esc(f)}</span>`).join('')}</div></div>

      <div class="rp-section reveal"><h3>منو</h3><div class="menu-list">${r.menu.map(m=>`<div class="menu-item glass"><div class="menu-emoji">${m[0]}</div><div class="menu-info"><div class="menu-name">${esc(m[1])}</div><div class="menu-price">${m[2]} تومان</div></div></div>`).join('')}</div></div>

      <div class="rp-section reveal">
        <h3>امتیازها و نظرها</h3>
        <div class="rb-grid glass">
          <div class="rb-overall"><div class="rb-big">${fmtFa(r.rt)}</div><div class="rb-stars">${stars(r.rt)}</div><div class="rb-count">${fmtFa(r.reviews)} نظر</div></div>
          <div class="rb-bars">${[['غذا',r.rb.food],['سرویس',r.rb.service],['فضا',r.rb.atmo],['ارزش',r.rb.value]].map(([l,v])=>`<div class="rb-bar-row"><span class="rl">${l}</span><div class="rb-track"><div class="rb-fill" style="width:0" data-w="${v/5*100}"></div></div><span class="rv">${fmtFa(v)}</span></div>`).join('')}</div>
        </div>
        <div class="ai-review glass">
          <div class="ai-review-head"><div class="icn">✦</div><div class="ttl">خلاصه‌ی هوشمند نظرها</div><span class="tag">AI</span></div>
          <div class="ai-col"><div class="ai-col-label">👍 مهمان‌ها تعریف می‌کنن از:</div>${r.good.map(g=>`<div class="ai-point"><span class="ic good">✓</span>${esc(g)}</div>`).join('')}</div>
          <div class="ai-col"><div class="ai-col-label">👎 گاهی گله دارن از:</div>${r.bad.map(b=>`<div class="ai-point"><span class="ic bad">!</span>${esc(b)}</div>`).join('')}</div>
        </div>
        ${r.revs.map(rv=>`<div class="review reveal"><div class="review-ava">${rv[1]}</div><div class="review-body"><div class="review-top"><span class="review-name">${esc(rv[0])}</span><span class="review-date">${esc(rv[4])}</span></div><div class="review-stars">${'★'.repeat(+rv[2])}</div><div class="review-text">${esc(rv[3])}</div></div></div>`).join('')}
      </div>
    </div>
    <div class="rp-bookbar glass">
      <div class="rp-bookbar-info">
        <div class="rp-bookbar-cb">💰 ${fmtFa(r.cb)}٪ کش‌بک</div>
        <div class="rp-bookbar-sub">رزرو رایگان · بدون پیش‌پرداخت</div>
      </div>
      <button class="btn btn-ghost rp-msg-btn" onclick="buzz&&buzz();openChat('${esc(r.slug||'')}')" aria-label="پیام به رستوران" ${r.slug?'':'disabled'}>💬</button>
      <button class="btn btn-primary rp-bookbar-btn" onclick="buzz&&buzz();openBookSheet(${id})">رزرو میز</button>
    </div>`;
  go('rest');
  setTimeout(()=>document.querySelectorAll('.rb-fill').forEach(f=>f.style.width=f.dataset.w+'%'),300);
  armReveals&&armReveals();
}
// شیت رزرو که با دکمه‌ی پایین باز می‌شود (تاریخ/ساعت/نفر)
export function openBookSheet(id){
  const r=R.find(x=>x.id===id);
  openSheet(`
    <div class="bs-head"><div class="bs-title">رزرو میز</div><div class="bs-rest">${esc(r.n)}</div></div>
    <div class="bw-field"><label>تاریخ</label><select id="bwDate" onchange="refreshSlots(${id})"><option value="today">امروز</option><option value="tomorrow">فردا</option><option value="thu">پنجشنبه</option><option value="fri">جمعه</option></select></div>
    <div class="bw-field"><label>تعداد نفر</label><select id="bwParty" onchange="refreshSlots(${id})"><option>۲ نفر</option><option>۱ نفر</option><option>۳ نفر</option><option>۴ نفر</option><option>۵ نفر</option><option>۶ نفر</option></select></div>
    <div class="bw-field"><label>ساعت</label><select id="bwTime"><option>در حال بررسی...</option></select></div>
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" onclick="startBook(${id})">بررسی میزهای موجود</button>
    <div style="text-align:center;font-size:12px;color:var(--t3);margin-top:10px">هنوز پولی پرداخت نمی‌کنی</div>
  `);
  refreshSlots(id);
}
// بارگذاری ساعت‌های واقعاً موجود از /restaurants/{slug}/availability
export async function refreshSlots(id){
  const r=R.find(x=>x.id===id);
  const sel=document.getElementById('bwTime');
  if(!sel)return;
  // اگر slug نداریم (حالت آفلاین/نمونه)، از همون slots نمونه استفاده کن
  if(!r.slug || !API.online){
    sel.innerHTML=(r.slots.length?r.slots:['۱۹:۰۰','۲۰:۰۰','۲۱:۰۰']).map(s=>`<option>${s}</option>`).join('');
    return;
  }
  const dateVal=document.getElementById('bwDate')?.value||'today';
  const partyVal=parseInt(String(document.getElementById('bwParty')?.value||'۲').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||2;
  const apiDate=dateValToISO(dateVal);
  sel.innerHTML='<option>در حال بررسی...</option>';
  const res=await API.get(`/restaurants/${r.slug}/availability?date=${apiDate}&party=${partyVal}`);
  if(res.ok && Array.isArray(res.data?.slots)){
    const open=res.data.slots.filter(s=>s.status==='open');
    if(open.length){
      sel.innerHTML=open.map(s=>`<option value="${s.time}">${faTime(s.time)}</option>`).join('');
    }else{
      sel.innerHTML='<option value="">ساعت خالی برای این روز نیست</option>';
    }
    // ساعت‌های پر را هم نشان بده ولی غیرفعال
    res.data.slots.filter(s=>s.status==='full').forEach(s=>{
      const o=document.createElement('option');o.value='';o.disabled=true;o.textContent=`${faTime(s.time)} (پر)`;sel.appendChild(o);
    });
  }else{
    // اگر availability در دسترس نبود، از نمونه fallback
    sel.innerHTML=(r.slots.length?r.slots:['۱۹:۰۰','۲۰:۰۰','۲۱:۰۰']).map(s=>`<option>${s}</option>`).join('');
  }
}
export function dateValToISO(v){
  const d=new Date();
  if(v==='tomorrow')d.setDate(d.getDate()+1);
  else if(v==='thu'){const dow=d.getDay();d.setDate(d.getDate()+((4-dow+7)%7||7));}
  else if(v==='fri'){const dow=d.getDay();d.setDate(d.getDate()+((5-dow+7)%7||7));}
  return d.toISOString().slice(0,10);
}
export function faTime(t){return (t||'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
export function quickBook(id,slot){setBk({id,date:'امروز',time:slot,party:'۲ نفر'});openSheet(bookStep2(R.find(x=>x.id===id)))}
export function startBook(id){
  const t=document.getElementById('bwTime').value;
  if(!t){toast('⚠️','برای این روز ساعت خالی نیست — روز دیگه‌ای انتخاب کن');return;}
  const dateSel=document.getElementById('bwDate');
  const dateLabel=dateSel.options[dateSel.selectedIndex].text;
  setBk({id,date:dateLabel,dateVal:dateSel.value,time:faTime(t),timeRaw:t,party:document.getElementById('bwParty').value});
  openSheet(bookStep2(R.find(x=>x.id===id)));
}
export function bookStep2(r){
  return `<div class="sheet-title">${r.n}</div><div class="sheet-sub">${bk.date} · ${bk.time} · ${bk.party}</div>
    <div class="steps"><div class="step-bar done"></div><div class="step-bar now"></div><div class="step-bar"></div></div>
    <div class="field-label">پیش‌سفارش (اختیاری) — <span style="color:var(--teal-600)">+۲۰ امتیاز</span></div>
    <div class="opt-row">${r.menu.map(m=>`<div class="opt" onclick="this.classList.toggle('sel')">${m[0]} ${m[1]}</div>`).join('')}</div>
    <button class="btn btn-primary btn-lg btn-block" onclick="toBookStep3(${r.id})">ادامه</button>`;
}
// wrapperِ سراسری: onclick در scope سراسری اجرا می‌شود و به R (ماژولی) دسترسی ندارد،
// پس lookup را اینجا (با دسترسی به R) انجام می‌دهیم.
export function toBookStep3(id){ openSheet(bookStep3(R.find(x=>x.id===id))); }
export function bookStep3(r){
  return `<div class="sheet-title">تأیید اطلاعات</div><div class="sheet-sub">یه قدم تا رزرو</div>
    <div class="steps"><div class="step-bar done"></div><div class="step-bar done"></div><div class="step-bar now"></div></div>
    <div class="field-label">نام</div><input class="inp" id="bkName" value="علی رضایی">
    <div class="field-label">موبایل</div><input class="inp" id="bkPhone" value="۰۹۱۲۳۴۵۶۷۸۹">
    <div class="summary"><div class="sum-row"><span class="k">رستوران</span><span class="v">${r.n}</span></div><div class="sum-row"><span class="k">تاریخ و ساعت</span><span class="v">${bk.date} · ${bk.time}</span></div><div class="sum-row"><span class="k">تعداد</span><span class="v">${bk.party}</span></div></div>
    <div class="reward-row"><div class="reward"><div class="rv blue">+۵۰</div><div class="rl">امتیاز</div></div><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>
    <button class="btn btn-primary btn-lg btn-block" onclick="confirmBook(${r.id})">تأیید رزرو</button>`;
}
export async function confirmBook(id){
  const r=R.find(x=>x.id===id);
  // رزرو نیاز به ورود دارد
  if(!isLoggedIn()){
    closeSheet();
    toast('🔐','برای رزرو اول وارد شو');
    setTimeout(()=>openLogin(),400);
    return;
  }
  // وضعیت در حال ارسال
  const sheetBody=document.getElementById('sheetBody');
  const confirmBtn=sheetBody.querySelector('.btn-primary');
  if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='در حال ثبت رزرو...';}

  // تلاش برای ثبت در بک‌اند — اگر مقدار خام از availability داریم، دقیق‌تره
  const apiDT = (bk.timeRaw && bk.dateVal) ? { date: dateValToISO(bk.dateVal), time: bk.timeRaw } : toApiDateTime(bk.date, bk.time);
  const res=await API.post('/reservations',{
    restaurant_id:id,
    date:apiDT.date,
    time:apiDT.time,
    party_size:parseInt(String(bk.party).replace(/[^\d۰-۹]/g,'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||2,
    notify_sms:true,
  });

  let code;
  if(res.ok && res.data?.code){
    // رزرو واقعی در دیتابیس ثبت شد (بک‌اند code را در سطحِ بالا برمی‌گرداند)
    code=res.data.code;
  } else if(res.offline){
    // بک‌اند نیست → کد محلی (حالت دمو)
    code='RZ'+Math.random().toString(36).slice(2,7).toUpperCase();
  } else {
    // خطای واقعی از سرور (مثلاً میز پر شد) → پیشنهاد لیست انتظار
    const isFull = res.error?.code==='SLOT_FULL' || res.error?.code==='NO_TABLE_FOR_PARTY' || /پر|ظرفیت/.test(res.error?.message||'');
    if(isFull){
      offerWaitlist(id, r);
      return;
    }
    toast('⚠️', res.error?.message || 'ثبت رزرو ناموفق بود، دوباره تلاش کن');
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='تأیید رزرو';}
    return;
  }

  // موفقیت (واقعی یا دمو)
  setPts(pts+50);document.getElementById('navPts').textContent=fmtFa(pts);
  TRIPS.unshift({rid:id,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
  sheetBody.innerHTML=`
    <div class="success">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>
      <div class="sheet-title" style="text-align:center">رزرو تأیید شد!</div>
      <div class="sheet-sub" style="text-align:center">${esc(r.n)} · ${bk.date} · ${bk.time}<br>یادآور با پیامک می‌فرستیم</div>
      <div class="code-box"><div class="cl">کد رزرو</div><div class="cv">${esc(code)}</div><button class="copy-btn" onclick="copyCode('${esc(code)}')" aria-label="کپی کد رزرو">⧉ کپی کد</button></div>
      <div class="reward-row"><div class="reward"><div class="rv blue">+۵۰</div><div class="rl">امتیاز گرفتی</div></div><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>
      <button class="btn btn-primary btn-lg btn-block" onclick="closeSheet();go('trips')">رزروهای من</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
    </div>`;
}
export function copyCode(c){const done=()=>toast('⧉','کد کپی شد');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(c).then(done).catch(done);else done()}
// ═══════════════════════════════════════════════════════════



// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openRest = openRest;
window.openBookSheet = openBookSheet;
window.quickBook = quickBook;
window.startBook = startBook;
window.bookStep3 = bookStep3;
window.toBookStep3 = toBookStep3;
window.confirmBook = confirmBook;
window.copyCode = copyCode;
