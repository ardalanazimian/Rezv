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
import { jsq, openSheet, toast } from './auth.js';
import { icon } from './icons.js';
export const NOTIF_KEY = 'rz_notif_prefs';
export const NOTIF_CATS = [
  {id:'availability', icon:'utensils', title:'میز خالی شد', desc:'وقتی میز رستوران مورد علاقه‌ات آزاد شد', hi:true},
  {id:'offers',       icon:'wallet', title:'تخفیف و کش‌بک ویژه', desc:'وقتی جایی که دنبال می‌کنی پیشنهاد ویژه داره'},
  {id:'reminder',     icon:'clock', title:'یادآوری رزرو', desc:'قبل از رزروت یادت می‌ندازیم (تا فراموش نکنی)', hi:true},
  {id:'loyalty',      icon:'gift', title:'امتیاز و پاداش', desc:'وقتی امتیازت به یه پاداش جدید رسید'},
  {id:'dna',          icon:'sparkle', title:'DNA غذایی', desc:'وقتی خلاصه‌ی ماهانه‌ات آماده شد'},
];
export function getNotifPrefs(){
  try{ return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {availability:true,offers:true,reminder:true,loyalty:true,dna:true}; }
  catch{ return {availability:true,offers:true,reminder:true,loyalty:true,dna:true}; }
}
// ⚠️ رفعِ ترجیحِ بی‌اثر (پروتکل §۱۳/§۱۷): این تابع قبلاً **فقط** در
// localStorage می‌نوشت. یعنی کاربری که «تخفیف و کش‌بک ویژه» را خاموش می‌کرد،
// همچنان پیامکِ کمپین می‌گرفت (سرور اصلاً خبر نداشت — نه ستونی داشت نه چکی)،
// و انتخابش با پاک‌شدنِ حافظه‌ی مرورگر برایِ همیشه از بین می‌رفت.
// حالا localStorage فقط کشِ نمایشِ فوری است و منبعِ حقیقت سرور است.
export function setNotifPref(id,on){
  const p=getNotifPrefs(); p[id]=on;
  try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(p)); }catch{}
  if(!isLoggedIn()) return;   // مهمان: چیزی برای همگام‌سازی نیست
  API.patch('/me/notification-prefs', { [id]: !!on }).then(res=>{
    if(res && res.ok) return;
    // سرور نپذیرفت → کاربر باید بداند، وگرنه دوباره همان توهمِ قبلی است.
    toast('⚠️','ترجیح روی سرور ذخیره نشد — دوباره تلاش کن');
  }).catch(()=>{ toast('⚠️','ترجیح روی سرور ذخیره نشد — دوباره تلاش کن'); });
}

/** خواندنِ ترجیحاتِ واقعی از سرور، همگام‌کردنِ کشِ محلی، و **بازنقاشیِ کلیدها**.
 *  بدونِ بازنقاشی، شیت مقدارِ کهنه‌ی localStorage را نشان می‌داد و کاربر روی
 *  دستگاهِ تازه وضعیتِ اشتباه می‌دید — همان الگویِ paintPushStatus. */
export async function syncNotifPrefsFromServer(){
  if(!isLoggedIn()) return;
  try{
    const res = await API.get('/me/notification-prefs');
    if(!(res && res.ok && res.data && res.data.prefs)) return;
    const server = res.data.prefs;
    const merged = {};
    // کلیدِ غایب در سرور یعنی «نظری نداده» → پیش‌فرضِ دریافت (true)
    for(const c of NOTIF_CATS) merged[c.id] = server[c.id] !== false;
    try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(merged)); }catch{}
    // اگر شیت همین حالا باز است، کلیدها را با حقیقتِ سرور به‌روز کن
    for(const c of NOTIF_CATS){
      const box = document.querySelector(`.np-toggle input[data-cat="${c.id}"]`);
      if(box) box.checked = merged[c.id];
    }
  }catch{}
}
// ═══════════════════════════════════════════════════════════
//  وضعیتِ واقعیِ ارسالِ push — از سرور، نه از اجازه‌ی مرورگر
//
//  ⚠️ رفعِ ادعای نادرست (پروتکل §۳/§۱۰): بنر قبلاً به‌محضِ
//  `Notification.permission === 'granted'` تیکِ سبزِ «اعلان‌ها روی این دستگاه
//  فعاله» می‌داد، و requestNotifPerm توستِ «عالی! اعلان‌ها فعال شد» می‌زد.
//  هر دو نادرست بودند: اجازه‌ی مرورگر فقط یک نیمه‌ی کار است — هیچ
//  `PushManager.subscribe()`ای صدا زده نمی‌شود و خودِ بک‌اند صریحاً
//  `{enabled:false, ready:false}` برمی‌گرداند چون زیرساختِ push (VAPID/جدولِ
//  اشتراک) هنوز ساخته نشده. یعنی کاربر تیکِ سبز می‌دید و منتظرِ اعلانی می‌ماند
//  که هرگز نمی‌آمد. حالا سرور منبعِ حقیقت است و پیش‌فرض محافظه‌کارانه است.
async function fetchPushReady(){
  if(!isLoggedIn()) return false;
  try{ const res = await API.get('/me/push-subscribe'); return !!(res.ok && res.data?.ready); }
  catch{ return false; }
}
/** بنر را پس از رسیدنِ پاسخِ سرور به‌جا به‌روز می‌کند (شیت بدونِ تأخیر باز می‌شود). */
async function paintPushStatus(){
  const el = document.getElementById('npPerm');
  if(!el || el.dataset.state !== 'granted') return;   // فقط حالتِ «اجازه داده شده»
  const ready = await fetchPushReady();
  const now = document.getElementById('npPerm');
  if(!now || now.dataset.state !== 'granted') return; // شیت بسته/عوض شده
  now.className = ready ? 'np-perm ok' : 'np-perm warn';
  now.innerHTML = ready
    ? `${icon('check',{size:14})} اعلان‌ها روی این دستگاه فعاله`
    : `${icon('clock',{size:14})} اجازه‌ی مرورگر داده شده، ولی ارسالِ اعلان هنوز راه‌اندازی نشده — فعلاً یادآوری‌ها پیامکی می‌آید`;
}
export function openNotifPrefs(){
  const p=getNotifPrefs();
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permBanner = perm==='granted'
    // حالتِ موقت تا پاسخِ سرور برسد — عمداً بدونِ ادعای «فعال است».
    ? `<div class="np-perm" id="npPerm" data-state="granted">${icon('clock',{size:14})} در حالِ بررسیِ وضعیتِ اعلان‌ها…</div>`
    : perm==='denied'
    ? `<div class="np-perm no">اعلان‌ها در مرورگر مسدود شده — از تنظیمات مرورگر فعالش کن</div>`
    // ⚠️ کنترلِ بن‌بست (پروتکل §۲۷ «هر دکمه باید نتیجه‌ی واقعی داشته باشد»):
    // این شاخه قبلاً حالتِ `unsupported` را هم می‌گرفت و دکمه‌ی «فعال‌سازی»
    // نشان می‌داد — روی Safariِ iOS، که اصلاً `Notification` ندارد و
    // **بخشِ بزرگی از مخاطبِ موبایلیِ این اپ است**، آن دکمه تنها کاری که
    // می‌توانست بکند این بود که توستِ «مرورگرت پشتیبانی نمی‌کنه» بدهد.
    // حالا در آن حالت اصلاً دکمه‌ای پیشنهاد نمی‌شود.
    : perm==='unsupported'
    ? `<div class="np-perm warn">${icon('info',{size:14})} مرورگرِ تو اعلانِ درون‌مرورگری را پشتیبانی نمی‌کند — یادآوری‌ها پیامکی می‌آید</div>`
    : `<div class="np-perm ask"><div>برای دریافت اعلان‌ها، اجازه‌ی مرورگر لازمه</div><button class="np-perm-btn" onclick="requestNotifPerm()">فعال‌سازی</button></div>`;
  openSheet(`
    <div class="sheet-title">اعلان‌ها</div>
    <div class="sheet-sub">فقط چیزایی که برات مهمه — بدون اسپم</div>
    ${permBanner}
    <div class="np-list">
      ${NOTIF_CATS.map(c=>`
        <div class="np-item">
          <div class="np-ic">${icon(c.icon,{size:20})}</div>
          <div class="np-txt"><div class="np-title">${c.title}${c.hi?'<span class="np-hi">پیشنهادی</span>':''}</div><div class="np-desc">${c.desc}</div></div>
          <label class="np-toggle"><input type="checkbox" data-cat="${c.id}" ${p[c.id]?'checked':''} onchange="setNotifPref(${jsq(c.id)},this.checked)"><span class="np-slider"></span></label>
        </div>`).join('')}
    </div>
    <div class="np-foot">${icon('shield',{size:14})} ما هیچ‌وقت اعلان تبلیغاتی اسپم نمی‌فرستیم. کنترل کاملش دست توئه.</div>`);
  paintPushStatus();
  syncNotifPrefsFromServer();   // کلیدها را با حقیقتِ سرور به‌روز می‌کند
}
export async function requestNotifPerm(){
  if(!('Notification' in window)){ toast('','مرورگرت اعلان رو پشتیبانی نمی‌کنه'); return; }
  try{
    const res = await Notification.requestPermission();
    if(res==='granted'){
      // ثبتِ درخواستِ اشتراک و خواندنِ وضعیتِ واقعی — توست بر اساسِ پاسخِ سرور،
      // نه بر اساسِ اجازه‌ی مرورگر (که به‌تنهایی هیچ اعلانی نمی‌فرستد).
      let ready = false;
      if(isLoggedIn()){
        try{ const r = await API.post('/me/push-subscribe',{enabled:true}); ready = !!(r.ok && r.data?.ready); }catch{}
      }
      toast('', ready ? 'عالی! اعلان‌ها فعال شد'
                      : 'اجازه ثبت شد — ارسالِ اعلان هنوز راه‌اندازی نشده و به‌محضِ آماده‌شدن فعال می‌شود');
      openNotifPrefs(); // رفرش بنر
    } else {
      toast('','بدون اجازه، فعلاً اعلان نمی‌فرستیم');
    }
  }catch{ toast('','مشکلی پیش اومد'); }
}
// ═══════════ ورود با کد یکبارمصرف (فاز ۳) ═══════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openNotifPrefs = openNotifPrefs;
window.requestNotifPerm = requestNotifPerm;
// ⚠️ کنترلِ مرده (فازِ ۲، Batch 17): مارک‌آپِ همین فایل
// `onchange="setNotifPref(${jsq(c.id)},this.checked)"` دارد، ولی این اپ ES module
// است — تابعِ export‌شده از دسترسِ یک هندلرِ inline خارج است مگر روی window
// بنشیند. نتیجه: **هر** کلیدِ تنظیماتِ اعلان ReferenceError می‌داد و هیچ
// ترجیحی ذخیره نمی‌شد؛ کاربر کلید را می‌زد، ظاهرش عوض می‌شد و با بازکردنِ
// دوباره‌ی شیت به حالتِ قبل برمی‌گشت.
window.setNotifPref = setNotifPref;
window.syncNotifPrefsFromServer = syncNotifPrefsFromServer;
