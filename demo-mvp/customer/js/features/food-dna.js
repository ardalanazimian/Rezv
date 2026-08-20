// ═══ رزرونو — DNA غذایی (Spotify Wrapped) (بخشی از اپ کاستومر) ═══
//  DNA غذایی — تجربه‌ی Wrapped برای نسل‌Z (قلاب ویروسی رزرونو)
//  از me/profile داده‌ی واقعی می‌گیرد؛ اگر نبود، دموی جذاب نشان می‌دهد.
// ═══════════════════════════════════════════════════════════
import { API, USER, isLoggedIn, logout, userInitial, userName } from '../api.js';
import { esc, faNum, openLogin, toast } from '../auth.js';
import { fmtFa } from '../data/discover.js';
import { TRIPS, favs, pts } from '../data/seed.js';
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

// درصد بهتر از بقیه (برای حس رقابت نسل‌Z)
export function dnaPercentile(visits){
  if(visits >= 30) return 95; if(visits >= 20) return 88;
  if(visits >= 12) return 76; if(visits >= 6) return 60; return 42;
}

export async function openFoodDNA(){
  // بارگذاری داده‌ی واقعی، یا دمو
  let p = null;
  if(isLoggedIn()){
    const res = await API.get('/me/profile').catch(()=>null);
    if(res?.ok && res.data?.profile) p = res.data.profile;
  }
  if(!p){
    // دموی جذاب — واضح که نمونه‌ست ولی تجربه‌ی کامل رو نشون می‌ده
    p = { globalVisits:47, restaurantsVisited:9, globalSpendToman:8600000, isVipAnywhere:true, _demo:true,
      restaurants:[{rfmSegment:'champions',totalVisits:18},{rfmSegment:'loyal',totalVisits:12}] };
  }
  _dnaData = p;
  _dnaSlide = 0;
  buildDNASlides(p);
  document.getElementById('dnaOverlay').classList.add('open');
  // ساخت نوارهای پیشرفت (یکی برای هر اسلاید + اسلاید اشتراک)
  const nSlides = document.querySelectorAll('#dnaSlides .dna-slide').length;
  document.getElementById('dnaProgress').innerHTML = Array.from({length:nSlides},()=>'<div class="dna-progress-bar"><i></i></div>').join('');
  showDNASlide(0);
}

export function buildDNASlides(p){
  const persona = computeFoodPersona(p);
  const pct = dnaPercentile(p.globalVisits||0);
  const spendM = Math.round((p.globalSpendToman||0)/1000000);
  const topSeg = p.restaurants?.[0]?.rfmSegment;
  const segFa = {champions:'قهرمان',loyal:'وفادار',promising:'امیدبخش',at_risk:'دلتنگ',new_customer:'تازه‌وارد'}[topSeg]||'ویژه';
  const slides = [
    {kicker:'DNA غذایی تو آماده‌ست', emoji:'🧬', label:'بریم ببینیم امسال چطور گذشت', desc:'چند ثانیه وقت بذار — نتیجه‌اش ارزش داره'},
    {kicker:'امسال رفتی بیرون', big:faNum(p.globalVisits||0), label:'بار غذا خوردی', desc:`این یعنی بیشتر از ${faNum(pct)}٪ آدمای دور و برت!`},
    {kicker:'کاوش کردی', big:faNum(p.restaurantsVisited||0), label:'رستوران مختلف', desc:'هر کدوم یه تجربه‌ی جدید بود'},
    ...(spendM>0?[{kicker:'روی خاطره‌ها سرمایه‌گذاری کردی', big:faNum(spendM)+'م', label:'تومان', desc:'ارزشش رو داشت، مگه نه؟'}]:[]),
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
      ${s.persona?`<div class="dna-badge-persona">${p._demo?'✦ نمونه':'✦ منحصر به تو'}</div>`:''}
    </div>`).join('') + `
    <div class="dna-slide" data-i="${slides.length}">
      <div class="dna-share-card">
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px">DNA غذایی من ${p._demo?'(نمونه)':''}</div>
        <div style="font-size:26px;font-weight:900;color:#fff;margin-bottom:16px;letter-spacing:-.03em">${_dnaPersona.emoji} ${esc(_dnaPersona.name)}</div>
        <div class="dna-share-row"><span class="dna-share-k">بار بیرون غذا خوردم</span><span class="dna-share-v">${faNum(p.globalVisits||0)}</span></div>
        <div class="dna-share-row"><span class="dna-share-k">رستوران کشف کردم</span><span class="dna-share-v">${faNum(p.restaurantsVisited||0)}</span></div>
        <div class="dna-share-row"><span class="dna-share-k">بهتر از</span><span class="dna-share-v">${faNum(_dnaPct)}٪ مردم</span></div>
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
export function closeFoodDNA(){ clearTimeout(_dnaTimer); document.getElementById('dnaOverlay').classList.remove('open'); }

export async function shareFoodDNA(){
  const p = _dnaData || {};
  const persona = window._dnaPersona || {name:'Foodie'};
  const text = `DNA غذایی من تو رزرونو: ${persona.emoji} ${persona.name}\n${faNum(p.globalVisits||0)} بار بیرون غذا خوردم، بهتر از ${faNum(window._dnaPct||0)}٪ مردم! 🍽️`;
  // Web Share API (موبایل) — اگر نبود، کپی در کلیپ‌بورد
  if(navigator.share){
    try{ await navigator.share({title:'DNA غذایی من', text}); return; }catch{}
  }
  try{ await navigator.clipboard.writeText(text); toast('📋','متن کپی شد — تو استوری پیستش کن!'); }
  catch{ toast('✨','اسکرین‌شات بگیر و استوری بذار!'); }
}

export function renderProfile(){
  // مهمان (وارد نشده) → دعوت به ورود
  if (!isLoggedIn()) {
    document.getElementById('page-profile').innerHTML=`<div class="wrap section">
      <div style="text-align:center;padding:40px 20px">
        <div class="login-icon" style="margin-bottom:20px">👤</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">هنوز وارد نشدی</div>
        <div style="color:var(--t2);font-size:14px;margin-bottom:24px;line-height:1.6">برای رزرو، دیدن تاریخچه و استفاده از باشگاه مشتریان وارد شو</div>
        <button class="btn btn-primary btn-lg btn-block" onclick="openLogin()">ورود / ثبت‌نام</button>
      </div>
      <div class="dna-entry" role="button" tabindex="0" onclick="openFoodDNA()">
        <span class="dna-entry-badge">🧬 امتحان کن</span>
        <div class="dna-entry-title">DNA غذایی چیه؟</div>
        <div class="dna-entry-sub">یه نگاه به تجربه‌ای که منتظرته بنداز — بعد از چند رزرو، DNA غذایی خودت رو می‌سازی</div>
        <div class="dna-entry-cta">نمونه رو ببین ✦</div>
      </div>
    </div>`;
    return;
  }
  // کاربر وارد شده → اطلاعات واقعی
  const tier = pts>=1000?'طلایی':pts>=300?'نقره‌ای':'برنزی';
  const tierEmoji = pts>=1000?'🏆':pts>=300?'🥈':'🥉';
  document.getElementById('page-profile').innerHTML=`<div class="wrap section">
    <div class="prof-card">
      <div class="prof-card-mesh"></div>
      <div class="prof-card-top">
        <div class="prof-ava-xl">${userInitial()}</div>
        <div class="prof-card-id">
          <div class="prof-card-name">${esc(userName())}</div>
          <div class="prof-card-phone">${faNum(USER.phone||'')}</div>
          <span class="prof-tier">${tierEmoji} عضو ${tier}</span>
        </div>
      </div>
      <div class="prof-card-stats">
        <div class="pcstat"><div class="pcstat-v">${fmtFa(TRIPS.length)}</div><div class="pcstat-l">رزرو</div></div>
        <div class="pcstat-div"></div>
        <div class="pcstat"><div class="pcstat-v">${fmtFa(pts)}</div><div class="pcstat-l">امتیاز</div></div>
        <div class="pcstat-div"></div>
        <div class="pcstat"><div class="pcstat-v">${fmtFa(favs.size)}</div><div class="pcstat-l">علاقه‌مندی</div></div>
      </div>
    </div>
    <div class="dna-entry reveal" role="button" tabindex="0" onclick="buzz&&buzz();openFoodDNA()">
      <span class="dna-entry-badge">🧬 جدید</span>
      <div class="dna-entry-title">DNA غذایی تو آماده‌ست</div>
      <div class="dna-entry-sub">ببین امسال چطور غذا خوردی، شخصیت غذاییت چیه، و با دوستات به اشتراک بذار</div>
      <div class="dna-entry-cta">کشفش کن ✦</div>
    </div>
    <div class="settings-list reveal">
      <div class="set-item" role="button" tabindex="0" onclick="toast('✏️','ویرایش پروفایل')"><div class="set-icon">👤</div><div class="set-label">ویرایش پروفایل</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="toast('💳','کیف پول کش‌بک')"><div class="set-icon">💳</div><div class="set-label">کیف پول کش‌بک</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="openNotifPrefs()"><div class="set-icon">🔔</div><div class="set-label">اعلان‌ها</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="toast('💬','پشتیبانی')"><div class="set-icon">💬</div><div class="set-label">پشتیبانی</div><span class="set-arrow">‹</span></div>
      <div class="set-item" role="button" tabindex="0" onclick="logout()"><div class="set-icon">🚪</div><div class="set-label" style="color:var(--red)">خروج از حساب</div><span class="set-arrow">‹</span></div>
    </div>
  </div>`;
  armReveals&&armReveals();
}
// ═══════════════════════════════════════════════════════════



// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openFoodDNA = openFoodDNA;
window.dnaNext = dnaNext;
window.dnaPrev = dnaPrev;
window.closeFoodDNA = closeFoodDNA;
window.shareFoodDNA = shareFoodDNA;
