// ═══════════════════════════════════════════════════════════
//  رزرونو — جریانِ رزرو (شیتِ رزرو، availability، مراحل، تأیید)
//  جدا شده از data/detail.js (ریفکتور فاز۱: جداسازیِ مسئولیت).
//  رفتار دقیقاً همان قبل است؛ فقط از یک فایلِ مجزا export می‌شود.
// ═══════════════════════════════════════════════════════════
import { API, USER, isLoggedIn, syncNavPoints, userName } from '../api.js';
import { closeSheet, esc, openLogin, openSheet, setAfterLogin, toast } from '../auth.js';
import { fmtFa } from './discover.js';
import { TRIPS, bk, bookingCtx, setBk, setBookingCtx, todayISO } from './seed.js';
import { R } from '../init.js';
import { offerWaitlist } from '../waitlist.js';
import { genIdempotencyKey } from '../api-core.js';
import { haptic } from '../theme-pwa.js';

// ═══════════════════════════════════════════════════════════
//  تاریخ‌های قابلِ رزرو
//
//  پیش از این چهار گزینه‌ی ثابت بود: امروز، فردا، پنجشنبه، جمعه. یعنی برای
//  اپی که کارش رزروِ میز است، «سالگردمون ماه بعد» اصلاً ممکن نبود.
//
//  حالا ۶۰ روزِ واقعی. برچسب‌ها با تقویمِ شمسی ساخته می‌شوند (Intl با تقویمِ
//  fa-IR این را بومی می‌دهد؛ نیازی به کتابخانه‌ی تبدیلِ تاریخ نیست) و مقدارِ
//  هر گزینه مستقیماً همان ISO است که بک‌اند می‌خواهد — پس هیچ تبدیلِ حدسی
//  بینِ «کلمه‌ی فارسی» و «تاریخِ واقعی» باقی نمی‌ماند.
// ═══════════════════════════════════════════════════════════
const HORIZON_DAYS = 60;
const faDate = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });

export function dateOptions(){
  const out = [];
  const base = new Date(); base.setHours(12, 0, 0, 0); // ظهر: از پرشِ ساعتِ تابستانی مصون است
  for (let i = 0; i < HORIZON_DAYS; i++){
    const d = new Date(base); d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label = i === 0 ? 'امروز' : i === 1 ? 'فردا' : faDate.format(d);
    out.push({ iso, label });
  }
  return out;
}
const PARTY_MAX = 12;

// شیت رزرو که با دکمه‌ی پایین باز می‌شود (تاریخ/ساعت/نفر)
export function openBookSheet(id){
  const r=R.find(x=>x.id===id);
  // پیش‌فرض‌ها از زمینه‌ی مشترک می‌آیند، نه از صفر — اگر کاربر قبلاً گفته
  // «پنجشنبه، ۴ نفر»، همان‌جا می‌ماند و لازم نیست دوباره واردش کند.
  const dates = dateOptions();
  const dateSel = dates.some(d=>d.iso===bookingCtx.date) ? bookingCtx.date : dates[0].iso;
  openSheet(`
    <div class="bs-head"><div class="bs-title">رزرو میز</div><div class="bs-rest">${esc(r.n)}</div></div>
    <div class="bw-field"><label>تاریخ</label><select id="bwDate" onchange="refreshSlots(${id})">${
      dates.map(d=>`<option value="${d.iso}"${d.iso===dateSel?' selected':''}>${esc(d.label)}</option>`).join('')
    }</select></div>
    <div class="bw-field"><label>تعداد نفر</label><select id="bwParty" onchange="refreshSlots(${id})">${
      Array.from({length:PARTY_MAX},(_,i)=>i+1).map(n=>`<option value="${n}"${n===bookingCtx.party?' selected':''}>${fmtFa(n)} نفر</option>`).join('')
    }</select></div>
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
  // مقدارِ select حالا خودش ISO است — نه کلمه‌ای که باید حدس زده شود.
  const apiDate=document.getElementById('bwDate')?.value||todayISO();
  const partyVal=parseInt(document.getElementById('bwParty')?.value,10)||2;
  // هر تغییرِ کاربر بلافاصله در زمینه‌ی مشترک می‌نشیند تا رستورانِ بعدی هم بداند
  setBookingCtx({ date: apiDate, party: partyVal });
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
export function faTime(t){return (t||'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
/** برچسبِ فارسیِ یک تاریخِ ISO — برای نمایش در خلاصه و سفرها. */
export function labelForISO(iso){
  const hit = dateOptions().find(d=>d.iso===iso);
  if (hit) return hit.label;
  const [y,m,d] = String(iso||'').split('-').map(Number);
  return (y && m && d) ? faDate.format(new Date(y, m-1, d, 12)) : iso;
}
// رزروِ یک‌ضربی از چیپِ ساعتِ روی کارت. تاریخ و تعداد از زمینه‌ی مشترک می‌آید،
// نه «امروز / ۲ نفر»ِ ثابت — وگرنه چیپ بی‌صدا انتخابِ کاربر را دور می‌ریخت.
export function quickBook(id,slot){
  setBk({id,date:labelForISO(bookingCtx.date),dateVal:bookingCtx.date,time:slot,
         timeRaw:String(slot).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
         party:`${fmtFa(bookingCtx.party)} نفر`,partyN:bookingCtx.party});
  openSheet(bookStep2(R.find(x=>x.id===id)));
}
export function startBook(id){
  const t=document.getElementById('bwTime').value;
  if(!t){toast('','برای این روز ساعت خالی نیست — روز دیگه‌ای انتخاب کن');return;}
  const iso=document.getElementById('bwDate').value;
  const partyN=parseInt(document.getElementById('bwParty').value,10)||2;
  setBookingCtx({ date: iso, party: partyN });
  setBk({id,date:labelForISO(iso),dateVal:iso,time:faTime(t),timeRaw:t,party:`${fmtFa(partyN)} نفر`,partyN});
  openSheet(bookStep2(R.find(x=>x.id===id)));
}
export function bookStep2(r){
  return `<div class="sheet-title">${esc(r.n)}</div><div class="sheet-sub">${bk.date} · ${bk.time} · ${bk.party}</div>
    <div class="steps"><div class="step-bar done"></div><div class="step-bar now"></div><div class="step-bar"></div></div>
    <div class="field-label">پیش‌سفارش (اختیاری) — <span style="color:var(--teal-600)">+۲۰ امتیاز</span></div>
    <div class="opt-row">${r.menu.map(m=>`<div class="opt" onclick="this.classList.toggle('sel')">${m[0]} ${m[1]}</div>`).join('')}</div>
    <button class="btn btn-primary btn-lg btn-block" onclick="toBookStep3(${r.id})">ادامه</button>`;
}
// wrapperِ سراسری: onclick در scope سراسری اجرا می‌شود و به R (ماژولی) دسترسی ندارد،
// پس lookup را اینجا (با دسترسی به R) انجام می‌دهیم.
export function toBookStep3(id){ openSheet(bookStep3(R.find(x=>x.id===id))); }
export function bookStep3(r){
  // نام/موبایل از حسابِ کاربر (اگر وارد شده) — نه مقدارِ ساختگی
  const name = isLoggedIn() ? userName() : '';
  const phone = USER?.phone ? String(USER.phone).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]) : '';
  return `<div class="sheet-title">تأیید اطلاعات</div><div class="sheet-sub">یه قدم تا رزرو</div>
    <div class="steps"><div class="step-bar done"></div><div class="step-bar done"></div><div class="step-bar now"></div></div>
    <div class="field-label">نام</div><input class="inp" id="bkName" value="${esc(name)}" placeholder="نامت رو بنویس">
    <div class="field-label">موبایل</div><input class="inp" id="bkPhone" inputmode="tel" value="${esc(phone)}" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
    <div class="summary"><div class="sum-row"><span class="k">رستوران</span><span class="v">${esc(r.n)}</span></div><div class="sum-row"><span class="k">تاریخ و ساعت</span><span class="v">${bk.date} · ${bk.time}</span></div><div class="sum-row"><span class="k">تعداد</span><span class="v">${bk.party}</span></div></div>
    ${r.cb>0?`<div class="reward-row"><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>`:''}
    <div style="text-align:center;font-size:12px;color:var(--t3);margin-top:10px">امتیازِ اعتبار بعد از انجامِ رزرو به حسابت اضافه می‌شه</div>
    <button class="btn btn-primary btn-lg btn-block" onclick="confirmBook(${r.id})">تأیید رزرو</button>`;
}
export async function confirmBook(id){
  const r=R.find(x=>x.id===id);
  // رزرو نیاز به ورود دارد — بعد از ورود، همین مرحله‌ی تأیید از سر گرفته می‌شود
  if(!isLoggedIn()){
    setAfterLogin(()=>{ const rr=R.find(x=>x.id===id); if(rr && bk.id===id) openSheet(bookStep3(rr)); });
    toast('','برای رزرو اول وارد شو — بعدش ادامه می‌دیم');
    setTimeout(()=>openLogin(),400);
    return;
  }
  // وضعیت در حال ارسال
  const sheetBody=document.getElementById('sheetBody');
  const confirmBtn=sheetBody.querySelector('.btn-primary');
  if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='در حال ثبت رزرو...';}

  // تاریخ دیگر حدس زده نمی‌شود: bk.dateVal همان ISO است که کاربر انتخاب کرده.
  // Idempotency-Key: یک‌بار برای همین submit ساخته می‌شود — اگر کاربر دوبار
  // دکمه را بزند یا شبکه retry کند، سرور رزروِ دوم نمی‌سازد، پاسخِ اول برمی‌گردد.
  const res=await API.post('/reservations',{
    restaurant_id:id,
    date:bk.dateVal||todayISO(),
    time:bk.timeRaw||String(bk.time||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
    party_size:bk.partyN||2,
    notify_sms:true,
  },{ 'Idempotency-Key': genIdempotencyKey() });

  let code, isOfflineDemo=false;
  if(res.ok && res.data?.code){
    // رزرو واقعی در دیتابیس ثبت شد (بک‌اند code را در سطحِ بالا برمی‌گرداند)
    // ⚠️ هپتیکِ success فقط همین‌جا زده می‌شود — دقیقاً همون شرطی که سرور واقعاً
    // res.ok داد؛ هیچ مسیرِ دیگری (دمو/آفلاین) این الگو را نمی‌گیرد.
    code=res.data.code;
    haptic('success');
  } else if(res.offline){
    // بک‌اند نیست → کد محلی (حالت دمو) — این رزرو هیچ‌جا روی سرور ثبت نشده،
    // پس باید همین‌جا صریح به کاربر گفته شود (نه شبیه‌سازیِ خاموشِ موفقیت).
    // هپتیک هم عمداً ضعیف‌تر است (light، نه success) — لمس هم نباید ادعای
    // موفقیتِ واقعی کند.
    isOfflineDemo=true;
    code='RZ'+Math.random().toString(36).slice(2,7).toUpperCase();
    haptic('light');
  } else {
    // خطای واقعی از سرور (مثلاً میز پر شد) → پیشنهاد لیست انتظار
    const isFull = res.error?.code==='SLOT_FULL' || res.error?.code==='NO_TABLE_FOR_PARTY' || /پر|ظرفیت/.test(res.error?.message||'');
    if(isFull){
      offerWaitlist(id, r);
      return;
    }
    toast('', res.error?.message || 'ثبت رزرو ناموفق بود، دوباره تلاش کن');
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='تأیید رزرو';}
    return;
  }

  // موفقیت (واقعی یا دمو) — دیگر امتیازِ محلی جعل نمی‌شود؛ عددِ واقعی از سرور
  // می‌آید (اگر رزروِ واقعی بود، بعداً که «انجام‌شد» علامت بخورد XP واقعی
  // ثبت می‌شود؛ اینجا فقط چیپِ نوارِ بالا را با مقدارِ به‌روزِ سرور همگام می‌کنیم).
  if (res.ok) syncNavPoints();
  TRIPS.unshift({rid:id,date:bk.date,time:bk.time,party:bk.party,code,status:'up'});
  sheetBody.innerHTML=`
    <div class="success">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>
      <div class="sheet-title" style="text-align:center">${isOfflineDemo?'رزرو محلی ثبت شد':'رزرو تأیید شد!'}</div>
      <div class="sheet-sub" style="text-align:center">${esc(r.n)} · ${bk.date} · ${bk.time}${isOfflineDemo?'':'<br>یادآور با پیامک می‌فرستیم'}</div>
      ${isOfflineDemo?`<div style="background:var(--warning-soft);color:var(--warning-ink);border-radius:var(--radius-lg);padding:var(--sp-3);font-size:13px;line-height:1.7;text-align:center;margin:10px 0">⚠️ اتصال به سرورِ رزرونو برقرار نشد؛ این رزرو فقط روی همین دستگاه (به‌صورتِ آزمایشی) ذخیره شد و در سیستمِ رستوران ثبت نشده. یادآورِ پیامکی هم ارسال نمی‌شود. با وصل‌شدنِ اینترنت، دوباره از اول رزرو کن.</div>`:''}
      <div class="code-box"><div class="cl">کد رزرو</div><div class="cv">${esc(code)}</div><button class="copy-btn" onclick="copyCode('${esc(code)}')" aria-label="کپی کد رزرو">⧉ کپی کد</button></div>
      ${(!isOfflineDemo && r.cb>0)?`<div class="reward-row"><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>`:''}
      ${isOfflineDemo?'':'<div style="text-align:center;font-size:12px;color:var(--t3);margin-top:4px">امتیازِ اعتبار بعد از انجامِ رزرو به حسابت اضافه می‌شه</div>'}
      <button class="btn btn-primary btn-lg btn-block" onclick="closeSheet();go('trips')">رزروهای من</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
    </div>`;
}
export function copyCode(c){haptic('light');const done=()=>toast('⧉','کد کپی شد');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(c).then(done).catch(done);else done()}

// ── نوارِ جست‌وجوی صفحه‌ی اصلی ──
// «کِی» و «چند نفر» پیش از این سه/پنج گزینه‌ی ثابت داشتند که هیچ‌کجا خوانده
// نمی‌شد؛ کاربر انتخاب می‌کرد و هیچ اتفاقی نمی‌افتاد. حالا همان زمینه‌ی رزرو را
// می‌نویسند، پس انتخابشان تا شیتِ رزرو و تا رستورانِ بعدی دنبال می‌آید.
export function initSearchCtx(){
  const when=document.getElementById('sWhen'), party=document.getElementById('sParty');
  if(!when||!party) return;
  const dates=dateOptions();
  const sel=dates.some(d=>d.iso===bookingCtx.date)?bookingCtx.date:dates[0].iso;
  when.innerHTML=dates.map(d=>`<option value="${d.iso}"${d.iso===sel?' selected':''}>${esc(d.label)}</option>`).join('');
  party.innerHTML=Array.from({length:PARTY_MAX},(_,i)=>i+1)
    .map(n=>`<option value="${n}"${n===bookingCtx.party?' selected':''}>${fmtFa(n)} نفر</option>`).join('');
}
export function syncSearchCtx(){
  const when=document.getElementById('sWhen'), party=document.getElementById('sParty');
  setBookingCtx({
    date: when?.value || bookingCtx.date,
    party: parseInt(party?.value,10) || bookingCtx.party,
  });
}

// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openBookSheet = openBookSheet;
window.quickBook = quickBook;
window.startBook = startBook;
window.bookStep3 = bookStep3;
window.toBookStep3 = toBookStep3;
window.confirmBook = confirmBook;
window.copyCode = copyCode;
window.refreshSlots = refreshSlots;
window.syncSearchCtx = syncSearchCtx;
// نوارِ جست‌وجو باید همان اول پر شود، وگرنه دو selectِ خالی دیده می‌شوند.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSearchCtx);
else initSearchCtx();
