// ═══ رزرونو — ناوبری + رندرِ کشف: فید، وایب، مناسبت، رویداد (بخشی از اپ کاستومر) ═══
import { API } from '../api.js';
import { esc, toast, undoSnack } from '../auth.js';
import { openRest } from './detail.js';
import { quickBook } from './booking.js';
import { GRAD, favs, saveFavs, pts } from './seed.js';
import { renderProfile } from '../features/food-dna.js';
import { renderLoyalty } from '../features/loyalty.js';
import { R } from '../init.js';
import { renderFavs, renderTrips } from '../reservation.js';
import { buzz } from '../theme-pwa.js';
import { icon } from '../icons.js';
import { track } from '../analytics.js';
export function go(p){
  try{ track('page.viewed',{page:p}); }catch{}
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===p));
  // در صفحه‌ی رستوران، نوار ناوبری مخفی می‌شود تا نوار رزرو پایین بنشیند
  const botnav=document.querySelector('.botnav');
  if(botnav)botnav.style.display=(p==='rest'||p==='chat')?'none':'';
  window.scrollTo({top:0,behavior:'instant'});
  if(p==='favorites')renderFavs();
  if(p==='trips')renderTrips();
  if(p==='loyalty')renderLoyalty();
  if(p==='profile')renderProfile();
  if(p==='chats' && typeof renderChats==='function')renderChats();
}
export function fmtFa(n){return n.toLocaleString('fa-IR')}
export function cardHTML(r){
  const weekly = (r.reviews||0) >= 5 ? Math.max(3, Math.round((r.reviews||0)/8)) : 0;
  const avatars = Array.from({length: Math.min(3, Math.max(1, Math.ceil(weekly/4)))}, (_,i)=>i);
  const hot = r.rt >= 4.7 && (r.reviews||0) >= 80;
  // کارت خودش دکمه نمی‌شود چون داخلش دکمه دارد (تودرتوییِ نامعتبر). به‌جایش یک
  // دکمه‌ی واقعیِ کشیده روی کلِ کارت می‌نشیند و z-indexِ ۱ می‌گیرد — یعنی زیرِ
  // دکمه‌ی علاقه‌مندی (۳) و چیپ‌های ساعت (پنل، ۲). این تنها راهی است که هم با
  // کیبورد قابلِ فوکوس باشد، هم ترتیبِ فوکوس منطقی بماند.
  return `<article class="rc reveal">
    <div class="rc-bg" style="background:${GRAD[r.id]}"></div>
    <button type="button" class="rc-open" aria-label="صفحه‌ی ${esc(r.n)}" onclick="openRest(${r.id})"></button>
    <span class="rc-emoji">${r.e}</span>
    ${hot?`<span class="rc-hotbadge">${icon('flame',{size:13,fill:true})} داغ</span>`:r.ai?`<span class="rc-hotbadge ai">${icon('sparkle',{size:13,fill:true})} AI</span>`:''}
    <button class="rc-fav" type="button" aria-pressed="${favs.has(r.id)}" aria-label="${favs.has(r.id)?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}" onclick="event.stopPropagation();toggleFav(${r.id},this);buzz&&buzz()">${icon('heart',{size:20,fill:favs.has(r.id)})}</button>
    <div class="rc-panel">
      <div class="rc-top"><div class="rc-name">${r.n}</div><div class="rc-rating">${icon('star',{size:14,fill:true,class:'star'})}${fmtFa(r.rt)}</div></div>
      <div class="rc-meta">${r.cuisine} · ${r.price} · <span class="rc-cb">${icon('wallet',{size:12})} ${fmtFa(r.cb)}٪ کش‌بک</span></div>
      ${weekly?`<div class="rc-social"><div class="rc-avas" aria-hidden="true">${avatars.map(()=>`<span class="avatar avatar-sm"></span>`).join('')}</div><div class="rc-social-t"><b>${fmtFa(weekly)} نفر</b> این هفته اومدن</div></div>`:''}
      <div class="rc-slots">${r.slots.slice(0,3).map((s,i)=>`<button type="button" class="rc-slot ${i===0?'go':''}" aria-label="رزرو ساعت ${s} در ${esc(r.n)}" onclick="event.stopPropagation();quickBook(${r.id},'${s}');buzz&&buzz()">${s}</button>`).join('')}</div>
    </div>
  </article>`;
}
// اثبات اجتماعیِ امن: از داده‌ی تجمیعی (تعداد نظر/بازدید) — نه موقعیت زنده‌ی کسی.
// این حس «اینجا محبوبه» رو می‌ده بدون لو دادن حریم خصوصی هیچ‌کس.
// اثبات اجتماعی صفحه‌ی جزئیات — سیگنال اعتماد قوی‌تر موقع تصمیم رزرو
export function detailSocialProof(r){
  const reviews = r.reviews || 0;
  if(reviews < 5) return '';
  const weekly = Math.max(3, Math.round(reviews/8));
  const recommend = Math.min(98, Math.round(r.rt/5*100)+6);
  return `<div class="rp-social">
    <div class="rp-social-item">
      <div class="rp-social-avas" aria-hidden="true">${[0,1,2,3].map(()=>`<span class="avatar avatar-sm"></span>`).join('')}</div>
      <div class="rp-social-txt"><b>${fmtFa(weekly)} نفر</b> این هفته اینجا رزرو کردن</div>
    </div>
    <div class="rp-social-item">
      <span style="color:var(--success);display:inline-flex">${icon('heart',{size:18,fill:true})}</span>
      <div class="rp-social-txt"><b>${fmtFa(recommend)}٪</b> مهمان‌ها این‌جا رو پیشنهاد می‌کنن</div>
    </div>
  </div>`;
}
export function socialProofHTML(r){
  const reviews = r.reviews || 0;
  if(reviews < 5) return ''; // رستوران تازه — اثبات اجتماعی الکی نساز
  // تخمین بازدید این هفته از تعداد نظر (قطعی و منطقی، نه رندوم بی‌معنی)
  const weekly = Math.max(3, Math.round(reviews / 8));
  const avatars = Array.from({length: Math.min(3, Math.max(1, Math.ceil(weekly/4)))}, (_,i)=>i);
  const hot = r.rt >= 4.7 && reviews >= 80;
  return `<div class="rc-social">
    <div class="rc-social-ava" aria-hidden="true">${avatars.map(()=>`<span class="avatar avatar-sm"></span>`).join('')}</div>
    <div class="rc-social-txt"><b>${fmtFa(weekly)} نفر</b> این هفته اومدن</div>
    ${hot?`<span class="rc-hot" style="margin-inline-start:auto">${icon('flame',{size:12,fill:true})} داغ</span>`:''}
  </div>`;
}
export function renderFeed(list){
  const f=document.getElementById('feed');
  f.innerHTML=list.map(()=>`<div class="rc" style="opacity:1;transform:none"><div class="rc-img sk" style="border-radius:0"></div><div class="rc-body"><div class="sk" style="height:16px;width:65%;margin-bottom:9px"></div><div class="sk" style="height:12px;width:40%;margin-bottom:16px"></div><div class="sk" style="height:30px"></div></div></div>`).join('');
  setTimeout(()=>{
    f.innerHTML=list.map(cardHTML).join('');
    const io=new IntersectionObserver(es=>es.forEach((e,i)=>{if(e.isIntersecting){setTimeout(()=>e.target.classList.add('in'),i*50);io.unobserve(e.target)}}),{threshold:.05});
    f.querySelectorAll('.rc').forEach(c=>io.observe(c));
  },280);
}
// کشف بر اساس موقعیت — هر موقعیت به چند vibe نگاشت می‌شود (منطق واقعی روی داده)
export const OCCASION_MAP = {
  date:     {vibes:['رمانتیک','آروم','ویو','لوکس'], title:'💕 برای قرار عاشقانه', sub:'دنج، رمانتیک و خاطره‌انگیز'},
  friends:  {vibes:['دوستانه','کژوال','شلوغ','ارزون'], title:'🎊 برای دورهمی با رفقا', sub:'پرانرژی و باحال'},
  birthday: {vibes:['لوکس','تجربه','ویو','شلوغ'], title:'🎂 برای جشن تولد', sub:'خاص و به‌یادموندنی'},
  business: {vibes:['آروم','مینیمال','لوکس'], title:'💼 برای قرار کاری', sub:'آروم، حرفه‌ای و مناسب گفت‌وگو'},
  solo:     {vibes:['آروم','مینیمال','کژوال'], title:'🧘 برای وقتِ خودت', sub:'دنج و آروم'},
  family:   {vibes:['خانوادگی','سنتی','آروم'], title:'👨‍👩‍👧 برای خانواده', sub:'راحت و مناسب همه'},
};
export function pickOccasion(occ, el){
  // toggle: اگه دوباره همون رو زد، برگرد به حالت عادی
  const already = el.classList.contains('on');
  document.querySelectorAll('.occ-card').forEach(c=>c.classList.remove('on'));
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  if(already){
    document.querySelector('.chip')?.classList.add('active');
    document.getElementById('feedTitle').innerHTML=icon('flame',{size:16,fill:true})+' محبوب امشب';
    const sub=document.querySelector('.section-sub'); if(sub) sub.textContent=`${fmtFa(R.length)} رستوران فعال`;
    renderFeed(R);
    return;
  }
  el.classList.add('on');
  const m = OCCASION_MAP[occ];
  // رستوران‌هایی که حداقل یکی از vibeهای این موقعیت رو دارن، مرتب‌شده بر اساس امتیاز
  const matched = R.filter(r=>r.vibes?.some(v=>m.vibes.includes(v)))
                   .sort((a,b)=>(b.rt||0)-(a.rt||0));
  const list = matched.length ? matched : R;
  document.getElementById('feedTitle').textContent = m.title;
  const sub=document.querySelector('.section-sub'); if(sub) sub.textContent = m.sub;
  renderFeed(list);
  // اسکرول نرم به فید تا نتیجه دیده بشه
  document.getElementById('feed')?.scrollIntoView({behavior:'smooth',block:'start'});
}
export function filterVibe(v,el){
  document.querySelectorAll('.occ-card').forEach(c=>c.classList.remove('on'));
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');
  const list=v==='all'?R:R.filter(r=>r.vibes.includes(v));
  document.getElementById('feedTitle').innerHTML=v==='all'?icon('flame',{size:16,fill:true})+' محبوب امشب':esc(el.textContent.trim());
  renderFeed(list);
}
// ── نزدیک تو (کارت افقی کوچک) ──
export function hCardHTML(r,extra){
  return `<div class="hcard" role="button" tabindex="0" onclick="openRest(${r.id})">
    <div class="hcard-img" style="background:${GRAD[r.id]||GRAD[1]}">${r.e||icon('utensils',{size:22})}${extra?`<span class="hcard-tag">${extra}</span>`:''}</div>
    <div class="hcard-name">${esc(r.n)}</div>
    <div class="hcard-meta">${icon('star',{size:12,fill:true})} ${fmtFa(r.rt||r.rating||4.5)} · ${esc((r.tags&&r.tags[0])||r.cuisine||'')}</div>
  </div>`;
}
export function renderNearby(){
  const el=document.getElementById('nearbyScroll');if(!el)return;
  // مرتب بر اساس «فاصله» شبیه‌سازی‌شده (در واقعیت از موقعیت کاربر)
  const near=[...R].sort(()=>Math.random()-0.5).slice(0,6);
  el.innerHTML=near.map((r,i)=>hCardHTML(r,`${fmtFa((i+1)*0.4+0.3).slice(0,3)} کیلومتر`)).join('');
}
export function renderTrending(){
  const el=document.getElementById('trendingScroll');if(!el)return;
  // پرطرفدارترین‌ها بر اساس امتیاز
  const trend=[...R].sort((a,b)=>(b.rt||b.rating||0)-(a.rt||a.rating||0)).slice(0,6);
  el.innerHTML=trend.map((r,i)=>hCardHTML(r,i<2?`${icon('flame',{size:12,fill:true})} داغ`:'')).join('');
}
// ── رویدادهای ویژه ──
export const SAMPLE_EVENTS=[
  {rid:6,emoji:'🎷',title:'شب موسیقی جاز زنده',rest:'آوا روف‌تاپ',when:'جمعه ۲۲ خرداد · ۲۱:۰۰',price:'۴۵۰ک',desc:'اجرای زنده‌ی گروه جاز با منوی ویژه'},
  {rid:1,emoji:'🍷',title:'شب طعم و شراب‌نمایی',rest:'کافه‌رستوران ویستا',when:'پنجشنبه ۲۱ خرداد · ۲۰:۰۰',price:'۳۲۰ک',desc:'چشیدن منوی فصلی با همراهی سامان'},
  {rid:3,emoji:'👨‍🍳',title:'میز سرآشپز',rest:'بیسترو لانه',when:'شنبه ۲۳ خرداد · ۱۹:۳۰',price:'۵۸۰ک',desc:'منوی ۷ مرحله‌ای با حضور سرآشپز'},
];
export async function renderEvents(){
  const el=document.getElementById('eventsList');if(!el)return;
  let events=SAMPLE_EVENTS;
  // اگر آنلاین، از API بخوان
  const res=await API.get('/events');
  if(res.ok&&Array.isArray(res.data?.events)&&res.data.events.length){
    events=res.data.events.map(e=>({rid:e.restaurantId,emoji:e.emoji||'🎉',title:e.title,rest:'',when:new Date(e.startsAt).toLocaleDateString('fa-IR'),price:e.priceToman?fmtFa(Math.round(e.priceToman/1000))+'ک':'',desc:e.description||''}));
  }
  el.innerHTML=events.map(e=>`
    <div class="event-card" role="button" tabindex="0" onclick="openRest(${e.rid})">
      <div class="event-emoji">${e.emoji}</div>
      <div class="event-body">
        <div class="event-title">${esc(e.title)}</div>
        ${e.rest?`<div class="event-rest">${esc(e.rest)}</div>`:''}
        <div class="event-when">${icon('calendar',{size:13})} ${esc(e.when)}</div>
        ${e.desc?`<div class="event-desc">${esc(e.desc)}</div>`:''}
      </div>
      ${e.price?`<div class="event-price">${esc(e.price)}<span>تومان</span></div>`:''}
    </div>`).join('');
}
// رندر همه‌ی بخش‌های کشف
export function renderDiscoverSections(){
  renderNearby();
  renderTrending();
  renderEvents();
  // اعداد را به دادهٔ واقعی وصل کن (نه ثابتِ hard-coded) — C4
  const sub=document.querySelector('#page-discover .section-sub');
  if(sub && Array.isArray(R) && R.length) sub.textContent=`${fmtFa(R.length)} رستوران فعال`;
  const np=document.getElementById('navPts'); if(np) np.textContent=fmtFa(pts);
}
export function doSearch(){
  const q=document.getElementById('sQ').value.trim();
  const sub=document.querySelector('#page-discover .section-sub');
  if(!q){
    document.getElementById('feedTitle').innerHTML=icon('flame',{size:16,fill:true})+' محبوب امشب';
    if(sub) sub.textContent=`${fmtFa(R.length)} رستوران فعال`;
    renderFeed(R);return;
  }
  const list=R.filter(r=>r.n.includes(q)||r.cuisine.includes(q)||r.vibes.some(v=>v.includes(q)));
  document.getElementById('feedTitle').textContent=`نتایج «${q}»`;
  if(sub) sub.textContent=list.length?`${fmtFa(list.length)} نتیجه`:'چیزی پیدا نشد';
  renderFeed(list.length?list:R);
  if(!list.length)toast('','چیزی پیدا نشد — همه رو نشون می‌دیم');
}
export function toggleFav(id,el){
  const on=!favs.has(id);
  on?favs.add(id):favs.delete(id);
  saveFavs();
  if(el){
    el.innerHTML=icon('heart',{size:20,fill:on});
    el.setAttribute('aria-pressed',String(on));
    el.setAttribute('aria-label',on?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها');
  }
  if(on){ toast('','ذخیره شد'); if(el){ el.classList.add('liked-pop'); setTimeout(()=>el.classList.remove('liked-pop'),420); } }
  else {
    // Undo روی حذفِ علاقه (کاملاً client-side)
    undoSnack('از علاقه‌مندی‌ها حذف شد', ()=>{
      favs.add(id);
      saveFavs();
      if(el){ el.innerHTML=icon('heart',{size:20,fill:true}); el.setAttribute('aria-pressed','true'); el.setAttribute('aria-label','حذف از علاقه‌مندی‌ها'); }
      if(document.getElementById('page-favorites')?.classList.contains('active')) renderFavs();
    });
    if(document.getElementById('page-favorites')?.classList.contains('active')) renderFavs();
  }
}
// نسخه‌ی hero صفحه رستوران — با انیمیشن تپش
export function toggleRestFav(id){
  const btn=document.getElementById('rpFav');
  const on=!favs.has(id);
  on?favs.add(id):favs.delete(id);
  saveFavs();
  if(btn){
    btn.innerHTML=icon('heart',{size:22,fill:on});
    btn.setAttribute('aria-pressed',String(on));
    btn.setAttribute('aria-label',on?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها');
  }
  if(on){ toast('','به علاقه‌مندی‌ها اضافه شد'); }
  else {
    undoSnack('از علاقه‌مندی‌ها حذف شد', ()=>{
      favs.add(id);
      saveFavs();
      if(btn){ btn.innerHTML=icon('heart',{size:22,fill:true}); btn.setAttribute('aria-pressed','true'); btn.setAttribute('aria-label','حذف از علاقه‌مندی‌ها'); }
    });
  }
  if(btn){btn.style.transform='scale(1.3)';setTimeout(()=>btn.style.transform='',180)}
}


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.go = go;
window.pickOccasion = pickOccasion;
window.filterVibe = filterVibe;
window.doSearch = doSearch;
window.toggleFav = toggleFav;
window.toggleRestFav = toggleRestFav;
