// ═══════════════════════════════════════════════════════════
//  رزرونو — مرکزِ اعلان (Notification Center) — C7
//  محتوا فقط از دادهٔ **واقعیِ سرور** مشتق می‌شود (رزروهای پیش‌روِ /me/reservations
//  → یادآور؛ بالاترین امتیازِ رستورانِ سرور → پیشنهاد). هیچ اعلانی از دادهٔ
//  نمونه ساخته نمی‌شود مگر در بسته‌ی آفلاینِ تک‌فایلی که خودش دموست.
//  ویژگی‌ها: دسته‌بندی/فیلتر، خوانده‌نشده/خوانده (localStorage)، اکشن،
//  خواندن‌همه، badge شمارنده، حالتِ خالی. a11y: dialog/list، کیبورد، Esc.
// ═══════════════════════════════════════════════════════════
import { TRIPS } from '../data/seed.js';
import { R } from '../init.js';
import { go } from '../data/discover.js';
import { openRest } from '../data/detail.js';
import { icon } from '../icons.js';
import { esc, faNum, lockAppSurfaces, unlockAppSurfaces } from '../auth.js';
import { API, isLoggedIn } from '../api.js';
import { isOfflineDemo } from '../api-core.js';
import { mapApiTrip } from '../reservation.js';
import { openFoodDNA } from './food-dna.js';

const READ_KEY = 'rz_notif_read';
function readSet(){ try{ return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }catch{ return new Set(); } }
function saveRead(set){ try{ localStorage.setItem(READ_KEY, JSON.stringify([...set])); }catch{} }

const CATS = { all:'همه', reservation:'رزرو', dna:'خلاصه‌ی ماه', ai:'پیشنهاد' };
let _filter = 'all';

// منبعِ رزروها: فقط رزروهای واقعیِ سرور. _live با refreshNotif() از
// /me/reservations پر می‌شود؛ null یعنی «هنوز چیزی نمی‌دانیم».
//
// ⚠️ رفعِ جعلِ رزرو (پروتکل §۱۰ — «هرگز رزروِ موفق را جعل نکن»): قبلاً هر وقت
// _live خالی بود به TRIPS (دادهٔ نمونهٔ seed) fallback می‌شد. یعنی یک بازدیدکننده‌ی
// **واردنشده** روی سایتِ واقعی، ۶۰۰ms بعد از لود، بِج قرمزِ اعلان و یک
// «یادآورِ رزرو» برای رزروِ RZ8K2M می‌دید — رزروی که هیچ‌وقت وجود نداشته.
// همان اتفاق وقتی کاربرِ واردشده fetchش شکست می‌خورد هم می‌افتاد.
// حالا: نمی‌دانیم ⇒ چیزی نمی‌سازیم. تنها استثنا بسته‌ی آفلاینِ تک‌فایلی است که
// خودش را صریحاً دمو معرفی می‌کند و اصلاً بک‌اند ندارد.
let _live = null;
function tripsSource(){
  if (Array.isArray(_live)) return _live;
  return (isOfflineDemo() && Array.isArray(TRIPS)) ? TRIPS : [];
}

// خواندنِ رزروهای واقعی از سرور (همان endpointِ صفحهٔ سفرها) و به‌روزرسانیِ badge.
// آفلاین/خطا/مهمان → _live همچنان null می‌ماند و tripsSource هیچ رزروی نمی‌سازد.
// خلاصه‌ی ماهانه‌ی DNA — از سرور، هرگز محلی ساخته نمی‌شود.
// null یعنی «هنوز نپرسیده‌ایم یا نشد»؛ {available:false} یعنی سرور صریحاً
// گفته خلاصه‌ای نیست (ماهِ بدونِ بازدید، یا انصرافِ خودِ کاربر از دسته‌ی dna).
// هیچ‌کدام از این دو حالت نباید به ساختنِ یک خلاصه‌ی محلی منجر شود — اعدادِ
// این کارت فقط با مقایسه‌ی ماه‌به‌ماهِ سمتِ سرور معنا دارند.
let _dna = null;

export async function refreshNotif(){
  try{
    if(!isLoggedIn()){ _live = null; _dna = null; updateNotifBadge(); return; }
    const res = await API.get('/me/reservations');
    if(res && res.ok && Array.isArray(res.data)) _live = res.data.map(mapApiTrip);
  }catch(e){}
  try{
    if(isLoggedIn()){
      const d = await API.get('/me/dna-summary');
      if(d && d.ok && d.data && typeof d.data.available === 'boolean') _dna = d.data;
    }
  }catch(e){}
  updateNotifBadge();
  const ov = document.getElementById('notif');
  if(ov && ov.classList.contains('show')) render();
}

// ساختِ اعلان‌ها از دادهٔ واقعیِ کلاینت
function build(){
  const out = [];
  tripsSource().filter(t=>t.status==='up').forEach(t=>{
    const r = (Array.isArray(R)?R:[]).find(x=>String(x.id)===String(t.rid));
    const name = (r&&r.n) || t._name || 'رستوران';
    out.push({ id:'resv-'+t.code, cat:'reservation', pri:'high', ic:'calendar',
      title:'یادآورِ رزرو', body:`${name} — ${t.date} ساعت ${t.time}`,
      action:{ label:'مشاهده', run:()=>go('trips') } });
  });
  // پیشنهاد فقط از رستورانِ **واقعیِ سرور** ساخته می‌شود. `slug` همان نشانه‌ای
  // است که کارتِ فید هم با آن چیپِ «نمونه» می‌زند (data/discover.js) — بدونِ آن،
  // اعلان یک رستورانِ seed را با امتیازِ seed پیشنهاد می‌داد و برخلافِ کارت‌ها
  // هیچ برچسبِ «نمونه»ای هم نداشت.
  // (در بسته‌ی آفلاینِ تک‌فایلی که کلاً دموست، دادهٔ نمونه مجاز می‌ماند.)
  const pool = Array.isArray(R) ? (isOfflineDemo() ? R : R.filter(x=>x&&x.slug)) : [];
  const top = [...pool].sort((a,b)=>(b.rt||0)-(a.rt||0))[0];
  if(top && top.rt!=null) out.push({ id:'ai-'+top.id, cat:'ai', pri:'low', ic:'sparkle',
    title:'پیشنهادِ هوشمند', body:`${top.n} با امتیاز ${top.rt} — شاید دوستش داشته باشی`,
    action:{ label:'ببین', run:()=>openRest(top.id) } });
  // ── خلاصه‌ی ماهانه‌ی DNA ────────────────────────────────────────────
  // فقط وقتی سرور صریحاً available:true داده. برچسبِ ماه و همه‌ی اعداد از
  // خودِ پاسخ می‌آیند — اینجا هیچ عددی محاسبه یا حدس زده نمی‌شود.
  if(_dna && _dna.available){
    const d = _dna;
    const bits = [`${faNum(d.visits)} بار بیرون رفتی`];
    if(d.restaurants_visited) bits.push(`${faNum(d.restaurants_visited)} رستوران`);
    if(d.new_restaurants > 0) bits.push(`${faNum(d.new_restaurants)} تای جدید`);
    // مقایسه فقط وقتی ماهِ قبل واقعاً داده داشته (null = کاربرِ تازه، نه صفر)
    if(typeof d.previous_visits === 'number'){
      const diff = d.visits - d.previous_visits;
      if(diff > 0) bits.push(`${faNum(diff)} بار بیشتر از ماه قبل`);
      else if(diff < 0) bits.push(`${faNum(-diff)} بار کمتر از ماه قبل`);
      else bits.push('مثل ماه قبل');
    }
    out.push({
      // کلیدِ ماه در id است تا خلاصه‌ی ماهِ بعد دوباره خوانده‌نشده شود و
      // خلاصه‌ی همین ماه بعد از خواندن دوباره برنگردد.
      id:'dna-'+d.period_key, cat:'dna', pri:'high', ic:'chart',
      title:`خلاصه‌ی ${faNum(d.period_label)}`,
      body: bits.join(' · '),
      action:{ label:'ببین', run:()=>openFoodDNA() },
    });
  }
  return out;
}

export function notifUnreadCount(){ const read=readSet(); return build().filter(n=>!read.has(n.id)).length; }

export function updateNotifBadge(){
  const b = document.getElementById('notifBadge'); if(!b) return;
  const n = notifUnreadCount();
  b.textContent = n>9 ? '۹+' : (n?faNum(n):'');
  b.style.display = n ? '' : 'none';
}
// faNum از auth.js (منبعِ واحد) import می‌شود — نسخه‌ی محلیِ تکراری حذف شد.

function ensureEl(){
  let ov = document.getElementById('notif'); if(ov) return ov;
  ov = document.createElement('div');
  ov.id='notif'; ov.className='notif-overlay'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','اعلان‌ها');
  ov.innerHTML =
    '<div class="notif-panel" role="document">' +
      '<div class="notif-head"><b>اعلان‌ها</b>' +
        '<button class="notif-readall" type="button" id="notifReadAll">خواندنِ همه</button>' +
        '<button class="notif-close" type="button" id="notifClose" aria-label="بستن">×</button></div>' +
      '<div class="notif-tabs" id="notifTabs" role="tablist"></div>' +
      '<div class="notif-list" id="notifList"></div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) closeNotif(); });
  ov.querySelector('#notifClose').addEventListener('click', closeNotif);
  ov.querySelector('#notifReadAll').addEventListener('click', ()=>{
    const set=readSet(); build().forEach(n=>set.add(n.id)); saveRead(set); render(); updateNotifBadge();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && ov.classList.contains('show')) closeNotif(); });
  return ov;
}

function render(){
  const tabs = document.getElementById('notifTabs');
  tabs.innerHTML = Object.entries(CATS).map(([k,v])=>`<button class="notif-tab ${k===_filter?'on':''}" role="tab" aria-selected="${k===_filter}" data-k="${k}">${v}</button>`).join('');
  tabs.querySelectorAll('.notif-tab').forEach(b=>b.addEventListener('click', ()=>{ _filter=b.dataset.k; render(); }));

  const read = readSet();
  const items = build().filter(n=>_filter==='all' || n.cat===_filter);
  const list = document.getElementById('notifList');
  if(!items.length){
    list.innerHTML = `<div class="notif-empty"><div class="notif-empty-ic">${icon('bell',{size:36})}</div><div>اعلانی نداری</div></div>`;
    return;
  }
  list.innerHTML = items.map(n=>{
    const unread = !read.has(n.id);
    return `<div class="notif-item ${unread?'unread':''} pri-${n.pri}" data-id="${esc(n.id)}">`+
      `<span class="notif-ic">${icon(n.ic,{size:18})}</span>`+
      `<div class="notif-body"><div class="notif-title">${esc(n.title)}${unread?'<span class="notif-dot" aria-label="خوانده‌نشده"></span>':''}</div>`+
      `<div class="notif-text">${esc(n.body)}</div></div>`+
      `<button class="notif-act" type="button" data-act="${esc(n.id)}">${esc(n.action.label)}</button>`+
    `</div>`;
  }).join('');
  list.querySelectorAll('.notif-act').forEach(btn=>btn.addEventListener('click', ()=>{
    const id=btn.dataset.act; const n=build().find(x=>x.id===id);
    const set=readSet(); set.add(id); saveRead(set); updateNotifBadge();
    closeNotif(); try{ n&&n.action.run(); }catch(e){}
  }));
}

export function openNotif(){
  const ov=ensureEl();
  const wasOpen = ov.classList.contains('show');
  render();
  ov.classList.add('show');
  if(!wasOpen) lockAppSurfaces();
  refreshNotif();
}
export function closeNotif(){
  const ov=document.getElementById('notif');
  const wasOpen = !!ov && ov.classList.contains('show');
  if(ov) ov.classList.remove('show');
  if(wasOpen) unlockAppSurfaces();
}

// badge اولیه بعد از آماده‌شدنِ DOM؛ سپس تلاش برای خواندنِ رزروهای واقعی (اگر کاربر وارد شده)
try{
  const boot = ()=>{ setTimeout(updateNotifBadge,0); setTimeout(refreshNotif,600); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}catch{}

try{ window.openNotif = openNotif; window.closeNotif = closeNotif; window.refreshNotif = refreshNotif; }catch{}
