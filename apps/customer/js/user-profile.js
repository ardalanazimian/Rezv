import { API, isLoggedIn } from './api.js';
import { jsq, openSheet, toast } from './auth.js';
import { icon } from './icons.js';
export const NOTIF_KEY = 'rz_notif_prefs';
export const NOTIF_CATS = [
  {id:'availability', icon:'utensils', title:'میز آماده شد', desc:'وقتی نوبت صف رسید یا میز رستوران مورد علاقه‌ات آزاد شد', hi:true},
  {id:'offers',       icon:'wallet', title:'تخفیف و کش‌بک ویژه', desc:'وقتی جایی که دنبال می‌کنی پیشنهاد ویژه داره'},
  {id:'reminder',     icon:'clock', title:'یادآوری رزرو', desc:'قبل از رزروت یادت می‌ندازیم (تا فراموش نکنی)', hi:true},
  {id:'loyalty',      icon:'gift', title:'امتیاز و پاداش', desc:'وقتی امتیازت به یه پاداش جدید رسید'},
  {id:'dna',          icon:'sparkle', title:'DNA غذایی', desc:'وقتی خلاصه‌ی ماهانه‌ات آماده شد'},
  {id:'survey',       icon:'star', title:'نظرسنجی بعد از غذا', desc:'بعد از حضور یک نظر کوتاه می‌پرسیم', hi:true},
];
export function getNotifPrefs(){
  try{ return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {availability:true,offers:true,reminder:true,loyalty:true,dna:true,survey:true}; }
  catch{ return {availability:true,offers:true,reminder:true,loyalty:true,dna:true,survey:true}; }
}
export function setNotifPref(id,on){
  const p=getNotifPrefs(); p[id]=on;
  try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(p)); }catch{}
  if(!isLoggedIn()) return;
  API.patch('/me/notification-prefs', { [id]: !!on }).then(res=>{
    if(res && res.ok) return;
    toast('⚠️','ترجیح روی سرور ذخیره نشد — دوباره تلاش کن');
  }).catch(()=>{ toast('⚠️','ترجیح روی سرور ذخیره نشد — دوباره تلاش کن'); });
}
export async function syncNotifPrefsFromServer(){
  if(!isLoggedIn()) return;
  try{
    const res = await API.get('/me/notification-prefs');
    if(!(res && res.ok && res.data && res.data.prefs)) return;
    const server = res.data.prefs;
    const merged = {};
    for(const c of NOTIF_CATS) merged[c.id] = server[c.id] !== false;
    try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(merged)); }catch{}
    for(const c of NOTIF_CATS){
      const box = document.querySelector(`.np-toggle input[data-cat="${c.id}"]`);
      if(box) box.checked = merged[c.id];
    }
  }catch{}
}
async function fetchPushReady(){
  if(!isLoggedIn()) return false;
  try{ const res = await API.get('/me/push-subscribe'); return !!(res.ok && res.data?.ready); }
  catch{ return false; }
}
async function paintPushStatus(){
  const el = document.getElementById('npPerm');
  if(!el || el.dataset.state !== 'granted') return;
  const ready = await fetchPushReady();
  const now = document.getElementById('npPerm');
  if(!now || now.dataset.state !== 'granted') return;
  now.className = ready ? 'np-perm ok' : 'np-perm warn';
  now.innerHTML = ready
    ? `${icon('check',{size:14})} اعلان‌ها روی این دستگاه فعاله`
    : `${icon('clock',{size:14})} اجازه‌ی مرورگر داده شده، ولی ارسالِ اعلان هنوز راه‌اندازی نشده — فعلاً یادآوری‌ها پیامکی می‌آید`;
}
export function openNotifPrefs(){
  const p=getNotifPrefs();
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permBanner = perm==='granted'
    ? `<div class="np-perm" id="npPerm" data-state="granted">${icon('clock',{size:14})} در حالِ بررسیِ وضعیتِ اعلان‌ها…</div>`
    : perm==='denied'
    ? `<div class="np-perm no">اعلان‌ها در مرورگر مسدود شده — از تنظیمات مرورگر فعالش کن</div>`
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
  syncNotifPrefsFromServer();
}
function urlBase64ToUint8Array(b64){
  const pad='='.repeat((4-(b64.length%4))%4);
  const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}
export async function requestNotifPerm(){
  if(!('Notification' in window)){ toast('','مرورگرت اعلان رو پشتیبانی نمی‌کنه'); return; }
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    toast('','این مرورگر Web Push ندارد — یادآوری‌ها پیامکی می‌آید');
    return;
  }
  try{
    const res = await Notification.requestPermission();
    if(res==='granted'){
      let ready = false;
      if(isLoggedIn()){
        try{
          const status = await API.get('/me/push-subscribe');
          const vapid = status.ok && status.data?.vapid_public_key;
          if(vapid && navigator.serviceWorker){
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapid),
            });
            const j = sub.toJSON();
            const r = await API.post('/me/push-subscribe', {
              enabled: true,
              endpoint: j.endpoint,
              keys: j.keys,
            });
            ready = !!(r.ok && r.data?.ready);
          } else {
            const r = await API.post('/me/push-subscribe', { enabled: true });
            ready = !!(r.ok && r.data?.ready);
          }
        }catch{}
      }
      toast('', ready ? 'عالی! اعلان‌ها فعال شد'
                      : 'اجازه ثبت شد — ارسالِ اعلان هنوز راه‌اندازی نشده و به‌محضِ آماده‌شدن فعال می‌شود');
      openNotifPrefs();
    } else {
      toast('','بدون اجازه، فعلاً اعلان نمی‌فرستیم');
    }
  }catch{ toast('','مشکلی پیش اومد'); }
}
window.openNotifPrefs = openNotifPrefs;
window.requestNotifPerm = requestNotifPerm;
window.setNotifPref = setNotifPref;
window.syncNotifPrefsFromServer = syncNotifPrefsFromServer;
