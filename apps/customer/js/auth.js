// ═══════════════════════════════════════════════════════════
//  رزرونو — ورود با کد یکبارمصرف (OTP)
//  بخشی از اپ کاستومر (Vanilla JS، بدون build). scope سراسری مشترک.
//  ترتیبِ لود در index.html مهم است (این فایل به توابع/state قبلی وابسته است).
// ═══════════════════════════════════════════════════════════
import { API, USER, refreshAuthUI, setUSER } from './api.js';
import { icon } from './icons.js';
import { faTime } from './data/booking.js';
import { renderProfile } from './features/food-dna.js';
export let _loginPhone = '';
export function openLogin(){
  _loginPhone = '';
  openSheet(`
    <div class="login-icon">${icon('lock',{size:36})}</div>
    <div style="text-align:center;margin-bottom:6px"><div class="sheet-title" style="font-size:20px;font-weight:800">ورود به رزرونو</div></div>
    <div style="text-align:center;color:var(--t2);font-size:14px;margin-bottom:22px">شماره موبایلت رو وارد کن تا کد ورود برات بفرستیم</div>
    <div class="field-label">شماره موبایل</div>
    <input class="otp-input" id="loginPhone" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" style="font-size:18px;letter-spacing:.1em">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="sendOtp()">ارسال کد ورود</button>
    <div style="text-align:center;font-size:11.5px;color:var(--t3);margin-top:14px;line-height:1.6">با ورود، <span style="color:var(--t2)">قوانین و حریم خصوصی</span> رزرونو رو می‌پذیری</div>
  `);
  setTimeout(()=>document.getElementById('loginPhone')?.focus(),200);
}
export async function sendOtp(){
  const phoneEl = document.getElementById('loginPhone');
  const phone = (phoneEl?.value||'').trim();
  // اعتبارسنجی سمت کلاینت
  const normalized = phone.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  if (!/^09\d{9}$/.test(normalized)) { toast('','شماره موبایل معتبر وارد کن (مثل ۰۹۱۲۳۴۵۶۷۸۹)'); return; }
  _loginPhone = normalized;
  const btn = phoneEl.nextElementSibling;
  if (btn) { btn.disabled = true; btn.textContent = 'در حال ارسال...'; }

  if (location.protocol === 'file:') {
    showOtpStep('۱۲۳۴', true);
    return;
  }

  const res = await API.requestOtp(normalized);
  if (!res.ok && !res.offline) {
    // خطای واقعی از سرور (مثلاً ریت‌لیمیت)
    toast('', res.error?.message || 'خطا در ارسال کد');
    if (btn) { btn.disabled = false; btn.textContent = 'ارسال کد ورود'; }
    return;
  }
  // اگر بک‌اند نبود (آفلاین) → حالت دمو با کد ثابت، تا فلوی ورود قابل‌تست باشد
  const devCode = res.data?.devCode || (res.offline ? '۱۲۳۴' : null);
  showOtpStep(devCode, res.offline);
}
export function showOtpStep(devCode, offline){
  openSheet(`
    <div class="login-icon">${icon('mail',{size:36})}</div>
    <div style="text-align:center;margin-bottom:6px"><div class="sheet-title" style="font-size:20px;font-weight:800">کد ورود رو وارد کن</div></div>
    <div style="text-align:center;color:var(--t2);font-size:14px;margin-bottom:22px">کد ورود به شماره‌ی ${faNum(_loginPhone)} ارسال شد</div>
    <div class="field-label">کد ورود</div>
    <input class="otp-input" id="otpCode" inputmode="numeric" maxlength="6" placeholder="······" onkeydown="if(event.key==='Enter')confirmOtp()">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="confirmOtp()">تأیید و ورود</button>
    <div class="resend">کد نیومد؟ <button onclick="openLogin()">تغییر شماره</button></div>
    ${devCode ? `<div class="dev-hint">${offline?'حالت دمو (بک‌اند متصل نیست):':'حالت توسعه:'} کد ورود <b>${faNum(devCode)}</b> است</div>` : ''}
  `);
  setTimeout(()=>document.getElementById('otpCode')?.focus(),200);
}
export async function confirmOtp(){
  const codeEl = document.getElementById('otpCode');
  const code = (codeEl?.value||'').trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  if (!/^\d{4,6}$/.test(code)) { toast('','کد ورود رو کامل وارد کن'); return; }
  const btn = codeEl.nextElementSibling;
  if (btn) { btn.disabled = true; btn.textContent = 'در حال بررسی...'; }

  if (location.protocol === 'file:') {
    if (code === '1234') {
      setUSER({ phone: _loginPhone });
      showRegisterStep(true);
    } else {
      toast('','در حالت دمو، کد ۱۲۳۴ است');
      if (btn) { btn.disabled = false; btn.textContent = 'تأیید و ورود'; }
    }
    return;
  }

  const res = await API.verifyOtp(_loginPhone, code);
  if (res.ok && res.data?.user) {
    // ورود واقعی موفق
    setUSER(res.data.user);
    // کاربر جدید (هنوز نام ثبت نکرده) → فرم ثبت‌نام
    if (res.data.is_new || !USER.firstName) {
      showRegisterStep();
    } else {
      finishLogin();
    }
  } else if (res.offline) {
    // حالت دمو: کد ۱۲۳۴ بپذیر تا فلو قابل‌تست باشد
    if (code === '1234') {
      // در دمو، کاربر را جدید فرض کن تا فرم ثبت‌نام هم قابل‌تست باشد
      setUSER({ phone: _loginPhone });
      showRegisterStep(true);
    } else {
      toast('','در حالت دمو، کد ۱۲۳۴ است');
      if (btn) { btn.disabled = false; btn.textContent = 'تأیید و ورود'; }
    }
  } else {
    // کد اشتباه از سرور
    toast('', res.error?.message || 'کد اشتباه است');
    if (btn) { btn.disabled = false; btn.textContent = 'تأیید و ورود'; }
  }
}
// مرحله‌ی ثبت‌نام: گرفتن نام برای کاربر جدید
export function showRegisterStep(demo){
  openSheet(`
    <div class="login-icon">${icon('checkCircle',{size:36})}</div>
    <div style="text-align:center;margin-bottom:6px"><div class="sheet-title" style="font-size:20px;font-weight:800">به رزرونو خوش اومدی!</div></div>
    <div style="text-align:center;color:var(--t2);font-size:14px;margin-bottom:22px">برای تکمیل ثبت‌نام، اسمت رو بهمون بگو</div>
    <div class="field-label">نام</div>
    <input class="otp-input" id="regFirst" style="font-size:16px;letter-spacing:0;text-align:right" placeholder="مثلاً سارا" autocomplete="given-name">
    <div class="field-label" style="margin-top:14px">نام خانوادگی <span style="color:var(--t3);font-weight:400">(اختیاری)</span></div>
    <input class="otp-input" id="regLast" style="font-size:16px;letter-spacing:0;text-align:right" placeholder="مثلاً محمدی" autocomplete="family-name" onkeydown="if(event.key==='Enter')completeRegister(${demo?'true':'false'})">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="completeRegister(${demo?'true':'false'})">تکمیل ثبت‌نام</button>
  `);
  setTimeout(()=>document.getElementById('regFirst')?.focus(),200);
}
export async function completeRegister(demo){
  const first = (document.getElementById('regFirst')?.value||'').trim();
  const last = (document.getElementById('regLast')?.value||'').trim();
  if (!first) { toast('⚠️','اسمت رو وارد کن'); return; }
  const btn = document.querySelector('#sheetBody .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'در حال ثبت...'; }

  if (!demo) {
    const res = await API.updateProfile({ first_name: first, last_name: last });
    if (res.ok && res.data?.user) {
      setUSER(res.data.user);
    } else if (!res.offline) {
      toast('⚠️', res.error?.message || 'ثبت‌نام ناموفق بود');
      if (btn) { btn.disabled = false; btn.textContent = 'تکمیل ثبت‌نام'; }
      return;
    } else {
      // آفلاین → محلی نگه دار
      setUSER({ ...USER, firstName: first, lastName: last });
    }
  } else {
    setUSER({ ...USER, firstName: first, lastName: last });
  }
  finishLogin();
}
export function finishLogin(demo){
  closeSheet();
  refreshAuthUI();
  toast('✅', `خوش اومدی ${USER.firstName||''}!`);
  // اگر در صفحه‌ی پروفایل بود، تازه‌سازی کن
  if (document.getElementById('page-profile')?.classList.contains('active')) renderProfile();
}
// تبدیل ارقام انگلیسی به فارسی برای نمایش
export function faNum(s){ return String(s).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }
// امنیت: escape کردن ورودی کاربر قبل از تزریق به HTML (جلوگیری از XSS)
export function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// تبدیل تاریخ/ساعت فارسی (امروز/فردا/...، ۱۹:۰۰) به فرمت ISO که بک‌اند می‌خواهد
// بک‌اند انتظار date='YYYY-MM-DD' و time='HH:MM' (ارقام انگلیسی) دارد.
export function toApiDateTime(faDate, faTime){
  // ساعت: ارقام فارسی → انگلیسی
  const time = String(faTime||'').replace(/[۰-۹]/g, d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim();
  // تاریخ: کلمه‌ی نسبی → تاریخ واقعی
  const now = new Date();
  let target = new Date(now);
  const d = String(faDate||'').trim();
  if (d === 'فردا') target.setDate(now.getDate()+1);
  else if (d === 'امروز') { /* همین امروز */ }
  else {
    // نام روز هفته (پنجشنبه/جمعه/...) → نزدیک‌ترین آن روز در آینده
    const weekdays = {'یکشنبه':0,'دوشنبه':1,'سه‌شنبه':2,'چهارشنبه':3,'پنجشنبه':4,'جمعه':5,'شنبه':6};
    if (d in weekdays){
      const want = weekdays[d];
      for (let i=0;i<7;i++){ const t=new Date(now); t.setDate(now.getDate()+i); if(t.getDay()===want){target=t;break;} }
    }
    // اگر هیچ‌کدام، همان امروز می‌ماند
  }
  const iso = target.getFullYear()+'-'+String(target.getMonth()+1).padStart(2,'0')+'-'+String(target.getDate()).padStart(2,'0');
  return { date: iso, time: time || '20:00' };
}

// focus-trap شیتِ رزرو (C8) — WCAG 2.4.3/2.1.2: تله‌ی فوکوس، Esc، بازگرداندنِ فوکوس
let _sheetTrap=null,_sheetLastFocus=null;
export function openSheet(html){
  const sheet=document.getElementById('sheet');
  const wasOpen=sheet.classList.contains('show');
  document.getElementById('sheetBody').innerHTML=html;
  sheet.classList.add('show');
  if(!wasOpen) _sheetLastFocus=document.activeElement;
  if(_sheetTrap) sheet.removeEventListener('keydown',_sheetTrap);
  _sheetTrap=(e)=>{
    if(e.key==='Escape'){ e.preventDefault(); closeSheet(); return; }
    if(e.key!=='Tab') return;
    const f=sheet.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if(!f.length) return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  };
  sheet.addEventListener('keydown',_sheetTrap);
  setTimeout(()=>{ const el=sheet.querySelector('input:not([type=hidden]),button,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'); if(el) try{el.focus()}catch(e){} },30);
}
export function closeSheet(){
  const sheet=document.getElementById('sheet');
  sheet.classList.remove('show');
  if(_sheetTrap){ sheet.removeEventListener('keydown',_sheetTrap); _sheetTrap=null; }
  if(_sheetLastFocus && _sheetLastFocus.focus){ try{_sheetLastFocus.focus()}catch(e){} _sheetLastFocus=null; }
}
let tt;
export function toast(icon,msg){document.getElementById('toastIcon').textContent=icon;document.getElementById('toastMsg').textContent=msg;const t=document.getElementById('toast');t.classList.add('show');t.classList.remove('toast-enter');void t.offsetWidth;t.classList.add('toast-enter');const live=document.getElementById('a11y-live');if(live)live.textContent=msg;clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400)}
let _undo=null;
export function undoSnack(msg, onUndo, onCommit, seconds){
  seconds=seconds||5;
  if(_undo){ clearTimeout(_undo.timer); const c=_undo.commit; _undo=null; if(c)c(); } // commit قبلی
  let s=document.getElementById('undoSnack');
  if(!s){ s=document.createElement('div'); s.id='undoSnack'; s.className='undo-snack'; s.setAttribute('role','status'); s.setAttribute('aria-live','polite'); document.body.appendChild(s); }
  s.innerHTML='<span class="us-msg"></span><button class="us-btn" type="button">بازگرداندن</button>';
  s.querySelector('.us-msg').textContent=msg;
  s.classList.add('show');
  const hide=()=>s.classList.remove('show');
  const commit=()=>{ _undo=null; hide(); try{onCommit&&onCommit();}catch(e){} };
  const timer=setTimeout(commit, seconds*1000);
  _undo={commit,timer};
  s.querySelector('.us-btn').onclick=()=>{ clearTimeout(timer); _undo=null; hide(); try{onUndo&&onUndo();}catch(e){} };
}

// ═══════════ شروع اپ (فاز ۳: نمایش فوری + به‌روزرسانی از API) ═══════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openLogin = openLogin;
window.sendOtp = sendOtp;
window.confirmOtp = confirmOtp;
window.completeRegister = completeRegister;
window.esc = esc;
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.toast = toast;
window.undoSnack = undoSnack;
