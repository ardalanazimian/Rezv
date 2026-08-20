// ═══════════════════════════════════════════════════════════
//  رزرونو — تم دارک/لایت، حرکت، نصبِ PWA
//  بخشی از اپ کاستومر (Vanilla JS، بدون build). scope سراسری مشترک.
//  ترتیبِ لود در index.html مهم است (این فایل به توابع/state قبلی وابسته است).
// ═══════════════════════════════════════════════════════════
import { icon } from './icons.js';

export const _root=document.documentElement;
try{ const saved=localStorage.getItem('rz_theme'); if(saved) _root.setAttribute('data-theme',saved);
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches) _root.setAttribute('data-theme','light'); }catch{}
export function toggleTheme(){ const t=_root.getAttribute('data-theme')==='dark'?'light':'dark'; _root.setAttribute('data-theme',t); try{localStorage.setItem('rz_theme',t)}catch{}; updateThemeIcon(); buzz(); }
export function updateThemeIcon(){ const k=document.getElementById('themeKnob'); if(k) k.innerHTML=icon(_root.getAttribute('data-theme')==='dark'?'moon':'sun',{size:16}); }
// ═══════════════════════════════════════════════════════════
//  هپتیک — الگوهای استاندارد (اضافه‌شده ۲۰۲۶-۰۸-۱۴، حسابرسیِ دیزاینِ Desire)
//
//  قبلاً فقط buzz(ms) خام بود — همه‌جا یک لرزشِ عمومیِ ۸ms، بدونِ معنا و
//  بدونِ راهِ خاموش‌کردن. حالا:
//   • buzz(ms) کاملاً سازگارِ عقب‌رو می‌ماند (همون امضا، همون رفتار) — فقط
//     یک لایه‌ی احترام به کلیدِ خاموشیِ کاربر رویش اضافه شده.
//   • haptic(name) یکی از هشت الگویِ معنادار را می‌زند؛ منبعِ واحدِ حقیقتِ
//     «این کنش چه‌جور لمسی دارد» همینجاست، نه پراکنده در هر onclick.
//   • rz_haptics=0 در localStorage یعنی کاربر صراحتاً خاموش کرده — هم buzz
//     هم haptic آن را رعایت می‌کنند (وگرنه خاموش‌کردن بی‌معنا بود، چون اکثرِ
//     نقاطِ تماس هنوز از buzz خام صدا می‌زنند).
// ═══════════════════════════════════════════════════════════
export function hapticsEnabled(){ try{ return localStorage.getItem('rz_haptics')!=='0'; }catch{ return true; } }
export function buzz(ms){ try{ if(navigator.vibrate && hapticsEnabled()) navigator.vibrate(ms||8); }catch{} }  // پاسخِ لمسی روی موبایل
const HAPTIC_PATTERNS = {
  light:   8,             // لمسِ سبک — انتخاب/تغییرِ جزئی
  medium:  16,            // تأییدِ متوسط
  heavy:   [12, 30, 12],  // اقدامِ مهم/برگشت‌ناپذیر (مثلاً کنسل قطعی)
  success: [10, 40, 10],  // فقط بعدِ موفقیتِ واقعیِ سرور (res.ok) — هرگز روی دمو
  warning: [15, 60, 15],  // هشدار (مثلاً میز پر شد)
  error:   [20, 40, 20, 40, 20],
  select:  6,             // انتخابِ ساعت/گزینه (کوتاه‌ترین، پرتکرارترین)
  like:    [8, 20, 14],   // ضربانِ قلبِ لایک (شبیهِ اینستاگرام)
};
/** الگویِ لمسیِ نام‌دار — رجوع کن به کامنتِ بالا. نامِ ناشناس → light. */
export function haptic(name){ buzz(HAPTIC_PATTERNS[name] ?? HAPTIC_PATTERNS.light); }
// ورودِ متحرک هنگام اسکرول (کارت‌ها می‌پرن تو صفحه، مثل تیک‌تاک)
let _io;
export function armReveals(root){
  if(!_io) _io=new IntersectionObserver((es)=>{es.forEach((en,i)=>{if(en.isIntersecting){setTimeout(()=>en.target.classList.add('in'),Math.min(i,6)*60);_io.unobserve(en.target);}})},{threshold:.1});
  (root||document).querySelectorAll('.reveal:not(.in)').forEach(el=>_io.observe(el));
}
// نکته: updateThemeIcon()/armReveals() اولیه در boot() (init.js) صدا زده می‌شوند
// تا مطمئن شویم DOM آماده است (به‌جای اجرای شکننده در سطح‌بالای ماژول).

// ═══════════════════════════════════════════════════════════
//  ثبتِ Service Worker — اپِ نصب‌شدنی، آفلاین، بارگذاریِ آنی (نسل‌Z)
// ═══════════════════════════════════════════════════════════
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{ /* آفلاین یا محیطِ ناسازگار — اپ بدون SW هم کار می‌کند */ });
  });
}

// ── درخواستِ نصبِ اپ (Add to Home Screen) — هوشمند، نه مزاحم ──
export let _deferredInstall=null;
window.addEventListener('beforeinstallprompt',(e)=>{
  e.preventDefault();
  _deferredInstall=e;
  // فقط اگر کاربر فعال بوده (نه بارِ اول) — دکمه‌ی نصب را نشان بده
  setTimeout(()=>{ if(_deferredInstall && !localStorage.getItem('rz_install_dismissed')) showInstallBanner(); }, 45000);
});
export function showInstallBanner(){
  if(document.getElementById('installBanner')) return;
  const b=document.createElement('div');
  b.id='installBanner'; b.className='install-banner glass';
  b.innerHTML=`
    <div class="ib-icon">${icon('utensils',{size:24})}</div>
    <div class="ib-txt"><div class="ib-title">رزرونو رو نصب کن</div><div class="ib-sub">دسترسیِ آنی، حتی آفلاین</div></div>
    <button class="ib-btn" onclick="doInstall()">نصب</button>
    <button class="ib-close" onclick="dismissInstall()" aria-label="بستن">${icon('close',{size:18})}</button>`;
  document.body.appendChild(b);
  requestAnimationFrame(()=>b.classList.add('in'));
}
export async function doInstall(){
  if(!_deferredInstall) return;
  _deferredInstall.prompt();
  await _deferredInstall.userChoice.catch(()=>{});
  _deferredInstall=null; dismissInstall();
}
export function dismissInstall(){
  const b=document.getElementById('installBanner');
  if(b){ b.classList.remove('in'); setTimeout(()=>b.remove(),300); }
  try{ localStorage.setItem('rz_install_dismissed','1'); }catch{}
}



// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.toggleTheme = toggleTheme;
window.buzz = buzz;
window.haptic = haptic;
window.doInstall = doInstall;
window.dismissInstall = dismissInstall;
