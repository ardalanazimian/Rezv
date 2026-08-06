// ═══════════════════════════════════════════════════════════
//  رزرونو — مرکزِ اعلان (Notification Center) — C7
//  محتوا از دادهٔ واقعیِ کلاینت مشتق می‌شود (رزروهای پیش‌رو → یادآور؛
//  بالاترین امتیاز → پیشنهاد) — بدونِ جعلِ اعلانِ marketing/system.
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
import { mapApiTrip } from '../reservation.js';

const READ_KEY = 'rz_notif_read';
function readSet(){ try{ return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }catch{ return new Set(); } }
function saveRead(set){ try{ localStorage.setItem(READ_KEY, JSON.stringify([...set])); }catch{} }

const CATS = { all:'همه', reservation:'رزرو', ai:'پیشنهاد' };
let _filter = 'all';

// منبعِ رزروها: در صورتِ ورودِ کاربر، رزروهای واقعیِ سرور (کش‌شده)؛ در غیرِ این‌صورت
// دادهٔ نمونهٔ محلی (demo-safe). _live با refresh() از /me/reservations پر می‌شود.
let _live = null; // null = هنوز از سرور خوانده نشده → fallback به TRIPS
function tripsSource(){ return Array.isArray(_live) ? _live : (Array.isArray(TRIPS)?TRIPS:[]); }

// خواندنِ رزروهای واقعی از سرور (همان endpointِ صفحهٔ سفرها) و به‌روزرسانیِ badge.
// آفلاین/خطا/مهمان → _live دست‌نخورده و اعلان‌ها روی دادهٔ محلی می‌مانند (بدونِ جعل).
export async function refreshNotif(){
  try{
    if(!isLoggedIn()){ _live = null; updateNotifBadge(); return; }
    const res = await API.get('/me/reservations');
    if(res && res.ok && Array.isArray(res.data)) _live = res.data.map(mapApiTrip);
  }catch(e){}
  updateNotifBadge();
  const ov = document.getElementById('notif');
  if(ov && ov.classList.contains('show')) render();
}

// ساختِ اعلان‌ها از دادهٔ واقعیِ کلاینت
function build(){
  const out = [];
  tripsSource().filter(t=>t.status==='up').forEach(t=>{
    const r = (Array.isArray(R)?R:[]).find(x=>x.id===t.rid);
    const name = (r&&r.n) || t._name || 'رستوران';
    out.push({ id:'resv-'+t.code, cat:'reservation', pri:'high', ic:'calendar',
      title:'یادآورِ رزرو', body:`${name} — ${t.date} ساعت ${t.time}`,
      action:{ label:'مشاهده', run:()=>go('trips') } });
  });
  const top = (Array.isArray(R)?[...R]:[]).sort((a,b)=>(b.rt||0)-(a.rt||0))[0];
  if(top) out.push({ id:'ai-'+top.id, cat:'ai', pri:'low', ic:'sparkle',
    title:'پیشنهادِ هوشمند', body:`${top.n} با امتیاز ${top.rt} — شاید دوستش داشته باشی`,
    action:{ label:'ببین', run:()=>openRest(top.id) } });
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
