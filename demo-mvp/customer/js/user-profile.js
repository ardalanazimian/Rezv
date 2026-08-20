// ═══════════════════════════════════════════════════════════
//  رزرونو — پروفایل + DNA غذایی (Spotify-Wrapped)
//  بخشی از اپ کاستومر (Vanilla JS، بدون build). scope سراسری مشترک.
//  ترتیبِ لود در index.html مهم است (این فایل به توابع/state قبلی وابسته است).
// ═══════════════════════════════════════════════════════════
//  مرکز تنظیمات اعلان — طراحی هوشمند برای نسل‌Z
//  اصل: کاربر خودش انتخاب می‌کنه چی بگیره. کنترل = opt-out کمتر.
//  اعلان‌ها فقط وقتی «ارزش واقعی» دارن فرستاده می‌شن، نه اسپم.
// ═══════════════════════════════════════════════════════════
import { API, isLoggedIn } from './api.js';
import { openSheet, toast } from './auth.js';
export const NOTIF_KEY = 'rz_notif_prefs';
export const NOTIF_CATS = [
  {id:'availability', icon:'🪑', title:'میز خالی شد', desc:'وقتی میز رستوران مورد علاقه‌ات آزاد شد', hi:true},
  {id:'offers',       icon:'💰', title:'تخفیف و کش‌بک ویژه', desc:'وقتی جایی که دنبال می‌کنی پیشنهاد ویژه داره'},
  {id:'reminder',     icon:'⏰', title:'یادآوری رزرو', desc:'قبل از رزروت یادت می‌ندازیم (تا فراموش نکنی)', hi:true},
  {id:'loyalty',      icon:'🎁', title:'امتیاز و پاداش', desc:'وقتی امتیازت به یه پاداش جدید رسید'},
  {id:'dna',          icon:'🧬', title:'DNA غذایی', desc:'وقتی خلاصه‌ی ماهانه‌ات آماده شد'},
];
export function getNotifPrefs(){
  try{ return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {availability:true,offers:true,reminder:true,loyalty:true,dna:true}; }
  catch{ return {availability:true,offers:true,reminder:true,loyalty:true,dna:true}; }
}
export function setNotifPref(id,on){
  const p=getNotifPrefs(); p[id]=on;
  try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(p)); }catch{}
}
export function openNotifPrefs(){
  const p=getNotifPrefs();
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permBanner = perm==='granted'
    ? `<div class="np-perm ok">✓ اعلان‌ها روی این دستگاه فعاله</div>`
    : perm==='denied'
    ? `<div class="np-perm no">اعلان‌ها در مرورگر مسدود شده — از تنظیمات مرورگر فعالش کن</div>`
    : `<div class="np-perm ask"><div>برای دریافت اعلان‌ها، اجازه‌ی مرورگر لازمه</div><button class="np-perm-btn" onclick="requestNotifPerm()">فعال‌سازی</button></div>`;
  openSheet(`
    <div class="sheet-title">اعلان‌ها</div>
    <div class="sheet-sub">فقط چیزایی که برات مهمه — بدون اسپم</div>
    ${permBanner}
    <div class="np-list">
      ${NOTIF_CATS.map(c=>`
        <div class="np-item">
          <div class="np-ic">${c.icon}</div>
          <div class="np-txt"><div class="np-title">${c.title}${c.hi?'<span class="np-hi">پیشنهادی</span>':''}</div><div class="np-desc">${c.desc}</div></div>
          <label class="np-toggle"><input type="checkbox" ${p[c.id]?'checked':''} onchange="setNotifPref('${c.id}',this.checked)"><span class="np-slider"></span></label>
        </div>`).join('')}
    </div>
    <div class="np-foot">🔒 ما هیچ‌وقت اعلان تبلیغاتی اسپم نمی‌فرستیم. کنترل کاملش دست توئه.</div>`);
}
export async function requestNotifPerm(){
  if(!('Notification' in window)){ toast('⚠️','مرورگرت اعلان رو پشتیبانی نمی‌کنه'); return; }
  try{
    const res = await Notification.requestPermission();
    if(res==='granted'){
      toast('🔔','عالی! اعلان‌ها فعال شد');
      // ثبت توکن در بک‌اند (وقتی سرویس push آماده شد) — الان بی‌صدا
      if(isLoggedIn()) API.post('/me/push-subscribe',{enabled:true}).catch(()=>{});
      openNotifPrefs(); // رفرش بنر
    } else {
      toast('','بدون اجازه، فعلاً اعلان نمی‌فرستیم');
    }
  }catch{ toast('⚠️','مشکلی پیش اومد'); }
}
// ═══════════ ورود با کد یکبارمصرف (فاز ۳) ═══════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openNotifPrefs = openNotifPrefs;
window.requestNotifPerm = requestNotifPerm;
