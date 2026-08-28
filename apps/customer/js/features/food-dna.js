// ═══ رزرونو — DNA غذایی (Spotify Wrapped) (بخشی از اپ کاستومر) ═══
//  DNA غذایی — تجربه‌ی Wrapped برای نسل‌Z (قلاب ویروسی رزرونو)
//  از me/profile داده‌ی واقعی می‌گیرد؛ اگر نبود، دموی جذاب نشان می‌دهد.
// ═══════════════════════════════════════════════════════════
import { API, USER, isLoggedIn, logout, userInitial, userName, setUSER, refreshAuthUI } from '../api.js';
import { esc, faNum, openLogin, toast } from '../auth.js';
import { fmtFa } from '../data/discover.js';
import { favs, pts, tripCount, setTripCount } from '../data/seed.js';
import { icon } from '../icons.js';
import { armReveals, buzz } from '../theme-pwa.js';
import { openNotifPrefs } from '../user-profile.js';
export let _dnaData = null, _dnaSlide = 0, _dnaTimer = null;

// محاسبه‌ی «شخصیت غذایی» از داده — این چیزیه که نسل‌Z share می‌کنه
export function computeFoodPersona(p){
  const visits = p.globalVisits || 0;
  const restos = p.restaurantsVisited || 0;
  const vip = p.isVipAnywhere;
  // منطق شخصیت: بر اساس تنوع و تعداد
  if(vip && restos >= 5) return {emoji:'👑', name:'سلطانِ رستوران‌ها', desc:'تو همه‌جا VIP هستی و سلیقه‌ات بی‌نظیره'};
  if(restos >= 8) return {emoji:'🧭', name:'کاشفِ طعم', desc:'هر هفته یه جای جدید — تو دنبال ماجراجویی'};
  if(visits >= 20) return {emoji:'🔥', name:'مشتری پروپاقرص', desc:'وقتی جایی رو دوست داری، وفادار می‌مونی'};
  if(visits >= 8) return {emoji:'✨', name:'خوش‌سلیقه', desc:'می‌دونی کجا خوبه و چطور لذت ببری'};
  return {emoji:'🌱', name:'تازه‌کارِ مشتاق', desc:'سفر طعم تو تازه شروع شده — ادامه بده!'};
}

// نسخه‌ی نمایشیِ ثابت — فقط برایِ حالتِ دمو (وقتی داده‌ی واقعی نیست) استفاده
// می‌شود، همیشه همراه با برچسبِ «نمونه». برایِ کاربرِ واقعی این تابع صدا زده
// نمی‌شود — عددِ واقعی از GET /me/profile (visit_percentile) می‌آید که با
// رتبه‌بندیِ واقعی در بینِ همه‌ی کاربران محاسبه شده (lib/guest-profile.ts).
export function dnaPercentile(visits){
  if(visits >= 30) return 95; if(visits >= 20) return 88;
  if(visits >= 12) return 76; if(visits >= 6) return 60; return 42;
}

export async function openFoodDNA(){
  // بارگذاری داده‌ی واقعی، یا دمو
  let p = null, visitPercentile = null;
  if(isLoggedIn()){
    const res = await API.get('/me/profile').catch(()=>null);
    if(res?.ok && res.data?.profile){
      p = res.data.profile;
      // null یعنی جمعیتِ مقایسه هنوز کوچک است — عمداً نمایش داده نمی‌شود
      visitPercentile = typeof res.data.visit_percentile==='number' ? res.data.visit_percentile : null;
    }
  }
  if(!p){
    // دموی جذاب — واضح که نمونه‌ست (هر اسلاید برچسبِ «نمونه» دارد) ولی تجربه‌ی کامل رو نشون می‌ده
    p = { globalVisits:47, restaurantsVisited:9, globalSpendToman:8600000, isVipAnywhere:true, _demo:true,
      restaurants:[{rfmSegment:'champions',totalVisits:18},{rfmSegment:'loyal',totalVisits:12}] };
    visitPercentile = dnaPercentile(p.globalVisits);
  }
  _dnaData = p;
  _dnaSlide = 0;
  buildDNASlides(p, visitPercentile);
  // دیالوگِ تمام‌صفحه باید فوکوس را داخلِ خودش بیاورد وگرنه کاربرِ کیبورد/
  // صفحه‌خوان همچنان رویِ صفحه‌ی پشتی می‌ماند و اصلاً نمی‌فهمد چیزی باز شده.
  _dnaLastFocus = document.activeElement;
  document.getElementById('dnaOverlay').classList.add('open');
  document.querySelector('#dnaOverlay .dna-close')?.focus();
  // ساخت نوارهای پیشرفت (یکی برای هر اسلاید + اسلاید اشتراک)
  const nSlides = document.querySelectorAll('#dnaSlides .dna-slide').length;
  document.getElementById('dnaProgress').innerHTML = Array.from({length:nSlides},()=>'<div class="dna-progress-bar"><i></i></div>').join('');
  showDNASlide(0);
}

export function buildDNASlides(p, visitPercentile){
  const persona = computeFoodPersona(p);
  const pct = visitPercentile; // ممکن است null باشد (کاربرِ واقعی با جمعیتِ مقایسه‌ی هنوز کوچک)
  const spendM = Math.round((p.globalSpendToman||0)/1000000);
  const topSeg = p.restaurants?.[0]?.rfmSegment;
  const segFa = {champions:'قهرمان',loyal:'وفادار',promising:'امیدبخش',at_risk:'دلتنگ',new_customer:'تازه‌وارد'}[topSeg]||'ویژه';
  // در حالتِ دمو، هر اسلایدِ حاویِ عددِ شخصی برچسبِ «نمونه» می‌گیرد — قبلاً
  // فقط اسلایدِ شخصیت و کارتِ اشتراک‌گذاری این برچسب رو داشتن، بقیه‌ی
  // اعدادِ ساختگی (بازدید/رستوران/هزینه) بی‌هیچ نشانه‌ای نشون داده می‌شدن.
  const demoTag = p._demo ? ' (نمونه)' : '';
  const slides = [
    {kicker:'DNA غذایی تو آماده‌ست', emoji:'🧬', label:'بریم ببینیم امسال چطور گذشت', desc:'چند ثانیه وقت بذار — نتیجه‌اش ارزش داره'},
    {kicker:'امسال رفتی بیرون'+demoTag, big:faNum(p.globalVisits||0), label:'بار غذا خوردی', desc: pct!=null ? `این یعنی بیشتر از ${faNum(pct)}٪ آدمای دور و برت!` : 'به‌زودی با بقیه مقایسه‌ات می‌کنیم'},
    {kicker:'کاوش کردی'+demoTag, big:faNum(p.restaurantsVisited||0), label:'رستوران مختلف', desc:'هر کدوم یه تجربه‌ی جدید بود'},
    ...(spendM>0?[{kicker:'روی خاطره‌ها سرمایه‌گذاری کردی'+demoTag, big:faNum(spendM)+'م', label:'تومان', desc:'ارزشش رو داشت، مگه نه؟'}]:[]),
    {kicker:'و اما شخصیت غذایی تو', emoji:persona.emoji, label:persona.name, desc:persona.desc, persona:true},
  ];
  window._dnaSlides = slides;
  window._dnaPersona = persona;
  window._dnaPct = pct;
  const wrap = document.getElementById('dnaSlides');
  wrap.innerHTML = slides.map((s,i)=>`
    <div class="dna-slide" data-i="${i}">
      ${s.emoji?`<div class="dna-slide-emoji">${s.emoji}</div>`:''}
      <div class="dna-slide-kicker">${esc(s.kicker)}</div>
      ${s.big?`<div class="dna-slide-big">${s.big}</div>`:''}
      <div class="dna-slide-label">${esc(s.label)}</div>
      <div class="dna-slide-desc">${esc(s.desc)}</div>
      ${s.persona?`<div class="dna-badge-persona">${icon('sparkle',{size:12,fill:true})} ${p._demo?'نمونه':'منحصر به تو'}</div>`:''}
    </div>`).join('') + `
    <div class="dna-slide" data-i="${slides.length}">
      <div class="dna-share-card">
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px">DNA غذایی من ${p._demo?'(نمونه)':''}</div>
        <div style="font-size:26px;font-weight:900;color:#fff;margin-bottom:16px;letter-spacing:-.03em">${_dnaPersona.emoji} ${esc(_dnaPersona.name)}</div>
        <div class="dna-share-row"><span class="dna-share-k">بار بیرون غذا خوردم</span><span class="dna-share-v">${faNum(p.globalVisits||0)}</span></div>
        <div class="dna-share-row"><span class="dna-share-k">رستوران کشف کردم</span><span class="dna-share-v">${faNum(p.restaurantsVisited||0)}</span></div>
        ${_dnaPct!=null?`<div class="dna-share-row"><span class="dna-share-k">بهتر از</span><span class="dna-share-v">${faNum(_dnaPct)}٪ مردم</span></div>`:''}
        <button class="dna-share-btn" onclick="shareFoodDNA()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          اشتراک‌گذاری در استوری
        </button>
      </div>
      <div style="color:rgba(255,255,255,.5);font-size:13px;margin-top:20px">رزرونو · DNA غذایی</div>
    </div>`;
}

export function showDNASlide(i){
  const slides = document.querySelectorAll('#dnaSlides .dna-slide');
  const bars = document.querySelectorAll('#dnaProgress .dna-progress-bar');
  if(i >= slides.length){ closeFoodDNA(); return; }
  _dnaSlide = i;
  slides.forEach((s,idx)=>s.classList.toggle('show', idx===i));
  bars.forEach((b,idx)=>{ b.classList.toggle('done',idx<i); b.classList.toggle('active',idx===i); });
  buzz&&buzz();
  // شمارشِ عددیِ متحرک روی اسلاید فعال (حسِ رضایت‌بخشِ نسل‌Z)
  const active = slides[i];
  const bigEl = active&&active.querySelector('.dna-slide-big');
  if(bigEl && !bigEl.dataset.counted){ dnaCountUp(bigEl); bigEl.dataset.counted='1'; }
  clearTimeout(_dnaTimer);
  // اسلاید آخر (اشتراک) خودکار جلو نمی‌ره
  if(i < slides.length-1){ _dnaTimer = setTimeout(()=>showDNASlide(i+1), 5000); }
}
// انیمیشنِ شمارشِ عدد از ۰ تا مقدار (با تبدیل به فارسی + پسوندِ «م»)
export function dnaCountUp(el){
  const raw = el.textContent.trim();
  const suffix = raw.includes('م') ? 'م' : '';
  const target = parseInt(raw.replace(/[^۰-۹0-9]/g,'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) || 0;
  if(target<=0) return;
  const dur=900, t0=performance.now();
  const tick=(now)=>{
    const p=Math.min(1,(now-t0)/dur);
    const eased=1-Math.pow(1-p,3); // ease-out cubic
    el.textContent = faNum(Math.round(target*eased)) + suffix;
    if(p<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
export function dnaNext(){ showDNASlide(_dnaSlide+1); }
export function dnaPrev(){ showDNASlide(Math.max(0,_dnaSlide-1)); }
let _dnaLastFocus = null;
export function closeFoodDNA(){ clearTimeout(_dnaTimer); document.getElementById('dnaOverlay').classList.remove('open');
  // فوکوس به عنصری که دیالوگ را باز کرده بود برمی‌گردد (قرینه‌ی openModal پنل‌ها).
  if (_dnaLastFocus && document.contains(_dnaLastFocus)) _dnaLastFocus.focus?.(); _dnaLastFocus = null; }

export async function shareFoodDNA(){
  const p = _dnaData || {};
  const persona = window._dnaPersona || {name:'Foodie'};
  // اگر جمعیتِ مقایسه هنوز کوچک است (_dnaPct=null)، ادعای درصد کاملاً حذف
  // می‌شود — نه یک ۰٪ گمراه‌کننده (یعنی «بدترینِ ممکن»، نه «هنوز نامعلوم»).
  const pctPart = window._dnaPct!=null ? `، بهتر از ${faNum(window._dnaPct)}٪ مردم` : '';
  const text = `DNA غذایی من تو رزرونو: ${persona.emoji} ${persona.name}\n${faNum(p.globalVisits||0)} بار بیرون غذا خوردم${pctPart}! 🍽️`;
  // Web Share API (موبایل) — اگر نبود، کپی در کلیپ‌بورد
  if(navigator.share){
    try{ await navigator.share({title:'DNA غذایی من', text}); return; }catch{}
  }
  try{ await navigator.clipboard.writeText(text); toast('','متن کپی شد — تو استوری پیستش کن!'); }
  catch{ toast('','اسکرین‌شات بگیر و استوری بذار!'); }
}

export function renderProfile(){
  // مهمان (وارد نشده) → دعوت به ورود
  if (!isLoggedIn()) {
    document.getElementById('page-profile').innerHTML=`<div class="wrap section">
      <div style="text-align:center;padding:40px 20px">
        <div class="login-icon" style="margin-bottom:var(--sp-5)">${icon('user',{size:40})}</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">هنوز وارد نشدی</div>
        <div style="color:var(--t2);font-size:14px;margin-bottom:24px;line-height:1.6">برای رزرو، دیدن تاریخچه و استفاده از باشگاه مشتریان وارد شو</div>
        <button class="btn btn-primary btn-lg btn-block" onclick="openLogin()">ورود / ثبت‌نام</button>
      </div>
      <div class="dna-entry" role="button" tabindex="0" onclick="openFoodDNA()">
        <span class="dna-entry-badge">${icon('sparkle',{size:13,fill:true})} امتحان کن</span>
        <div class="dna-entry-title">DNA غذایی چیه؟</div>
        <div class="dna-entry-sub">یه نگاه به تجربه‌ای که منتظرته بنداز — بعد از چند رزرو، DNA غذایی خودت رو می‌سازی</div>
        <div class="dna-entry-cta">نمونه رو ببین ${icon('arrowL',{size:14})}</div>
      </div>
    </div>`;
    return;
  }
  // کاربر وارد شده → اطلاعات واقعی
  // نکته: همین آستانه‌ها باید با LOYALTY_TIERS در api/src/lib/loyalty-status.ts
  // هم‌تراز بمانند — قبلاً اینجا یک مقیاسِ ۳سطحیِ جداگانه (۳۰۰/۱۰۰۰) بود که
  // با مقیاسِ ۴سطحیِ صفحه‌ی loyalty (۳۰۰/۸۰۰/۲۰۰۰) ناسازگار بود؛ یعنی یک
  // کاربر با ۹۰۰ امتیاز اینجا «نقره‌ای» و در صفحه‌ی loyalty «طلایی» می‌دید.
  const tier = pts>=2000?{name:'پلاتینیوم',emoji:'💎'}:pts>=800?{name:'طلایی',emoji:'🥇'}:pts>=300?{name:'نقره‌ای',emoji:'🥈'}:{name:'برنزی',emoji:'🥉'};
  document.getElementById('page-profile').innerHTML=`<div class="wrap section">
    <div class="prof-card">
      <div class="prof-card-mesh"></div>
      <div class="prof-card-top">
        <div class="prof-ava-xl">${userInitial()}</div>
        <div class="prof-card-id">
          <div class="prof-card-name">${esc(userName())}</div>
          <div class="prof-card-phone">${faNum(USER.phone||'')}</div>
          <span class="prof-tier">${tier.emoji} عضو ${tier.name}</span>
        </div>
      </div>
      <div class="prof-card-stats">
        <div class="pcstat"><div class="pcstat-v" id="pcTrips">${tripCount==null?'—':fmtFa(tripCount)}</div><div class="pcstat-l">رزرو</div></div>
        <div class="pcstat-div"></div>
        <div class="pcstat"><div class="pcstat-v">${fmtFa(pts)}</div><div class="pcstat-l">امتیاز</div></div>
        <div class="pcstat-div"></div>
        <div class="pcstat"><div class="pcstat-v">${fmtFa(favs.size)}</div><div class="pcstat-l">علاقه‌مندی</div></div>
      </div>
    </div>
    <div class="dna-entry reveal" role="button" tabindex="0" onclick="buzz&&buzz();openFoodDNA()">
      <span class="dna-entry-badge">${icon('sparkle',{size:13,fill:true})} جدید</span>
      <div class="dna-entry-title">DNA غذایی تو آماده‌ست</div>
      <div class="dna-entry-sub">ببین امسال چطور غذا خوردی، شخصیت غذاییت چیه، و با دوستات به اشتراک بذار</div>
      <div class="dna-entry-cta">کشفش کن ${icon('arrowL',{size:14})}</div>
    </div>
    <div class="settings-list reveal">
      <div class="set-item" id="profEditItem" role="button" tabindex="0" onclick="editProfileInline()"><div class="set-icon">${icon('user',{size:20})}</div><div class="set-label">ویرایش پروفایل</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="openNotifPrefs()"><div class="set-icon">${icon('bell',{size:20})}</div><div class="set-label">اعلان‌ها</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="logout()"><div class="set-icon">${icon('logout',{size:20})}</div><div class="set-label" style="color:var(--red)">خروج از حساب</div><span class="set-arrow">‹</span></div>
    </div>
  </div>`;
  armReveals&&armReveals();
  syncProfileTripCount();
}
// ═══════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════
//  شمارشِ واقعیِ رزرو برایِ کارتِ پروفایل — دقیقاً همان الگویِ syncNavPoints:
//  یک درخواستِ کوچک، محافظت‌شده با فلگِ in-flight، و اگر سرور نگفت «—».
//  عمداً هیچ عددی حدس زده نمی‌شود (قبلاً TRIPS.length ثابتِ ۳ بود).
// ═══════════════════════════════════════════════════════════
let _tripCountInFlight = null;
function syncProfileTripCount(){
  const el = document.getElementById('pcTrips');
  if(!el) return;
  if(!isLoggedIn()){ el.textContent = '—'; return; }
  if(tripCount != null){ el.textContent = fmtFa(tripCount); return; }
  if(_tripCountInFlight) return;
  _tripCountInFlight = API.get('/me/reservations').then(res => {
    if(res.ok && Array.isArray(res.data)){
      setTripCount(res.data.length);
      const now = document.getElementById('pcTrips');
      if(now) now.textContent = fmtFa(res.data.length);
    }
    // سرور نگفت → «—»ی که از قبل رندر شده دست نمی‌خورد
  }).catch(()=>{}).finally(()=>{ _tripCountInFlight = null; });
}

// ═══════════════════════════════════════════════════════════
//  ویرایشِ inline پروفایل (C17) — بدونِ modal، درجا در همان لیستِ تنظیمات.
//  به endpointِ موجودِ PATCH /api/v1/me وصل است (بدونِ تغییرِ بک‌اند).
//  demo-safe: آفلاین/دمو → به‌روزرسانیِ محلیِ USER (نامِ خودِ کاربر، نه داده‌ی جعلی).
// ═══════════════════════════════════════════════════════════
export function editProfileInline(){
  const host = document.getElementById('profEditItem');
  if(!host) return;
  const f = esc(USER?.firstName || '');
  const l = esc(USER?.lastName || '');
  host.outerHTML =
    `<div class="set-edit" id="profEditItem">
       <div class="set-edit-row">
         <input id="peFirst" class="set-input" type="text" maxlength="50" placeholder="نام" value="${f}" autocomplete="given-name" aria-label="نام" onkeydown="if(event.key==='Enter')saveProfileInline(this)">
         <input id="peLast" class="set-input" type="text" maxlength="50" placeholder="نام خانوادگی" value="${l}" autocomplete="family-name" aria-label="نام خانوادگی" onkeydown="if(event.key==='Enter')saveProfileInline(this)">
       </div>
       <div class="set-edit-acts">
         <button class="btn btn-sm btn-primary" onclick="saveProfileInline(this)">ذخیره</button>
         <button class="btn btn-sm btn-ghost" onclick="cancelProfileEdit()">انصراف</button>
       </div>
     </div>`;
  setTimeout(()=>{ const el=document.getElementById('peFirst'); if(el){ try{ el.focus(); el.select(); }catch(e){} } }, 30);
}
export async function saveProfileInline(btn){
  const first = (document.getElementById('peFirst')?.value || '').trim();
  const last  = (document.getElementById('peLast')?.value || '').trim();
  if(!first){ toast('⚠️','اسمت رو وارد کن'); const el=document.getElementById('peFirst'); if(el) try{el.focus()}catch(e){} return; }
  const b = (btn && btn.tagName==='BUTTON') ? btn : document.querySelector('#profEditItem .btn-primary');
  if(b){ b.disabled = true; b.textContent = 'در حال ذخیره...'; }
  let synced = true;   // فقط وقتی سرور واقعاً تأیید کرده باشد true می‌ماند
  if(isLoggedIn()){
    const res = await API.updateProfile({ first_name: first, last_name: last });
    if(res.ok && res.data?.user){ setUSER(res.data.user); }
    else if(!res.offline){
      toast('⚠️', res.error?.message || 'ذخیره ناموفق بود');
      if(b){ b.disabled = false; b.textContent = 'ذخیره'; }
      return;
    } else {
      // ⚠️ فازِ ۲ (§۳): تغییر محلی می‌ماند ولی سرور هرگز خبردار نشد — پس نباید
      // تیکِ سبزِ «به‌روزرسانی شد» بگیرد. کاربر باور می‌کرد نامش رویِ حسابش
      // ذخیره شده، در حالی که با پاک‌شدنِ حافظه‌ی مرورگر از بین می‌رفت.
      setUSER({ ...USER, firstName: first, lastName: last });
      synced = false;
    }
  } else {
    // مهمانِ بدونِ حساب: اصلاً حسابی نیست که رویش ذخیره شود.
    setUSER({ ...USER, firstName: first, lastName: last });
    synced = false;
  }
  toast(synced ? '✅' : '⚠️', synced ? 'پروفایل به‌روزرسانی شد' : 'محلی ذخیره شد — روی حسابت هنوز ثبت نشده');
  try{ refreshAuthUI && refreshAuthUI(); }catch(e){}
  renderProfile();
}
export function cancelProfileEdit(){ renderProfile(); }

// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openFoodDNA = openFoodDNA;
window.dnaNext = dnaNext;
window.dnaPrev = dnaPrev;
window.closeFoodDNA = closeFoodDNA;
window.shareFoodDNA = shareFoodDNA;
window.editProfileInline = editProfileInline;
window.saveProfileInline = saveProfileInline;
window.cancelProfileEdit = cancelProfileEdit;
