// ═══ رزرونو — ناوبری + رندرِ کشف: فید، وایب، مناسبت، رویداد (بخشی از اپ کاستومر) ═══
import { API } from '../api.js';
import { esc, jsq, toast, undoSnack } from '../auth.js';
import { openRest } from './detail.js';
import { labelForISO, quickBook } from './booking.js';
import { bookingCtx, favHas, favs, gradFor, saveFavs, pts } from './seed.js';
import { renderProfile } from '../features/food-dna.js';
import { renderLoyalty } from '../features/loyalty.js';
import { renderEconomy } from '../features/economy.js';
import { NEXT_CURSOR } from '../api.js';
import { R } from '../init.js';
import { renderFavs, renderTrips } from '../reservation.js';
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
  if(p==='economy')renderEconomy();
  if(p==='profile')renderProfile();
  if(p==='chats' && typeof renderChats==='function')renderChats();
}
export function fmtFa(n){return n.toLocaleString('fa-IR')}
// ⚠️ رفع‌شده (حسابرسیِ دیزاینِ Desire، ۲۰۲۶-۰۸-۱۴): قبلاً وقتی r.slots خالی
// بود اینجا هیچ چیز رندر نمی‌شد — یعنی کارت بدونِ هیچ CTAیِ اقدام می‌ماند (نه
// ساعتِ جعلی، نه راهِ جایگزین). حالا یک CTAِ آرام به شیتِ کاملِ رزرو (که خودش
// availabilityِ واقعی را از API می‌خواند) باز می‌شود — هیچ ساعتِ اختراعی
// نمایش داده نمی‌شود.
//
// از ۲۰۲۶-۰۸-۲۵ این تکه جدا شد چون دو مصرف‌کننده دارد: رندرِ اولیه‌ی کارت، و
// به‌روزرسانیِ درجایِ چیپ‌ها بعد از رسیدنِ availabilityِ گروهی. جدا نبودنش
// یعنی برایِ نشان‌دادنِ ساعت‌ها باید کلِ فید دوباره رندر می‌شد (فلشِ اسکلت).
export function slotsHTML(r){
  const slots = Array.isArray(r.slots) ? r.slots : [];
  if (slots.length) {
    return slots.slice(0,3).map((s,i)=>`<button type="button" class="rc-slot ${i===0?'go':''}" aria-label="رزرو ساعت ${s} در ${esc(r.n)}" onclick="event.stopPropagation();quickBook(${jsq(String(r.id))},${jsq(s)});haptic('select')">${s}</button>`).join('');
  }
  return `<button type="button" class="rc-slot go" aria-label="دیدنِ سانس‌هایِ ${esc(r.n)}" onclick="event.stopPropagation();openBookSheet(${jsq(String(r.id))});haptic('select')">ببین سانس‌ها</button>`;
}

/**
 * به‌روزرسانیِ درجایِ چیپ‌هایِ ساعت — بدونِ رندرِ دوباره‌ی فید.
 *
 * چرا درجا: `renderFeed` عمداً ۲۸۰ms اسکلت نشان می‌دهد. صدازدنش صرفاً برایِ
 * رسیدنِ سانس‌ها یعنی کاربر بعد از دیدنِ کارت‌هایِ واقعی، دوباره اسکلت ببیند.
 */
export function paintSlots(list){
  const byId = new Map((list||[]).map(r=>[String(r.id), r]));
  document.querySelectorAll('#feed .rc[data-rid]').forEach(card=>{
    const r = byId.get(card.dataset.rid);
    if(!r) return;
    const box = card.querySelector('.rc-slots');
    if(box) box.innerHTML = slotsHTML(r);
  });
}

export function cardHTML(r){
  const hot = isHot(r);
  // کارت خودش دکمه نمی‌شود چون داخلش دکمه دارد (تودرتوییِ نامعتبر). به‌جایش یک
  // دکمه‌ی واقعیِ کشیده روی کلِ کارت می‌نشیند و z-indexِ ۱ می‌گیرد — یعنی زیرِ
  // دکمه‌ی علاقه‌مندی (۳) و چیپ‌های ساعت (پنل، ۲). این تنها راهی است که هم با
  // کیبورد قابلِ فوکوس باشد، هم ترتیبِ فوکوس منطقی بماند.
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): idها همیشه کوتیشن‌دار تزریق می‌شوند —
  // idِ واقعی UUID است و بدونِ کوتیشن، onclick خطای syntax می‌داد و کلِ
  // CTAهای کارت برای رستورانِ واقعی مرده بودند (mockِ E2E با idِ عددی این
  // را پنهان می‌کرد). GRAD[uuid] هم undefined بود → gradFor.
  return `<article class="rc reveal" data-rid="${esc(String(r.id))}">
    <div class="rc-bg" style="background:${gradFor(r.id)}"></div>
    <button type="button" class="rc-open" aria-label="صفحه‌ی ${esc(r.n)}" onclick="openRest(${jsq(String(r.id))})"></button>
    <span class="rc-emoji">${esc(r.e)}</span>
    ${hot?`<span class="rc-hotbadge">${icon('flame',{size:13,fill:true})} داغ</span>`:r.ai?`<span class="rc-hotbadge ai">${icon('sparkle',{size:13,fill:true})} AI</span>`:''}
    <button class="rc-fav" type="button" aria-pressed="${favs.has(r.id)}" aria-label="${favs.has(r.id)?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}" onclick="event.stopPropagation();toggleFav(${jsq(String(r.id))},this);haptic('like')">${icon('heart',{size:20,fill:favs.has(r.id)})}</button>
    <div class="rc-panel">
      <div class="rc-top"><div class="rc-name" style="display:flex;align-items:center;gap:6px;min-width:0"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.n)}</span>${r.slug?'':'<span class="demo-chip">نمونه</span>'}</div>${Number.isFinite(r.rt)&&r.rt>0?`<div class="rc-rating">${icon('star',{size:14,fill:true,class:'star'})}${fmtFa(r.rt)}</div>`:'<div class="rc-rating rc-rating-new">تازه‌وارد</div>'}</div>
      <div class="rc-meta">${r.cuisine}${r.price?` · ${r.price}`:''} · <span class="rc-cb">${icon('wallet',{size:12})} ${fmtFa(r.cb)}٪ کش‌بک</span></div>
      ${Number.isFinite(r.visits7d)&&r.visits7d>0?`<div class="rc-social">${avatarStack(r.visits7d,3)}<div class="rc-social-t"><b>${fmtFa(r.visits7d)} رزرو</b> هفته‌ی گذشته</div></div>`:''}
      <div class="rc-slots">${slotsHTML(r)}</div>
    </div>
  </article>`;
}
// ═══════════════════════════════════════════════════════════
//  اثباتِ اجتماعی — فقط از دادهٔ واقعیِ بک‌اند
//
//  نسخه‌ی قبل هر دو عدد را در فرانت می‌ساخت:
//    weekly    = Math.max(3, reviews/8)        ← از کلِ نظرها، نه از این هفته
//    recommend = Math.min(98, rt/5*100 + 6)    ← از امتیاز، نه از نظرِ کسی
//  هیچ‌کدام اندازه‌گیری نبودند. روی صفحه‌ای که کارش جلبِ اعتماد است، عددِ
//  ساختگی دقیقاً همان چیزی را از بین می‌برد که می‌خواهد بسازد — و رقیبِ اصلیِ
//  این حوزه دقیقاً روی «فقط مشتریِ واقعی می‌تواند نظر بدهد» ساخته شده.
//
//  حالا visits7d و recommendPct از API می‌آیند و اگر نبودند (null) هیچ
//  ادعایی نشان داده نمی‌شود. صفر هم نشان داده نمی‌شود: «۰ نفر این هفته
//  اومدن» فنی درست ولی گمراه‌کننده است.
// ═══════════════════════════════════════════════════════════

/** آواتارهای تزئینی — تعدادشان بر پایه‌ی عددِ واقعی، خودشان aria-hidden. */
function avatarStack(n, max = 4){
  const count = Math.min(max, Math.max(1, Math.ceil(n / 4)));
  return `<div class="rc-avas" aria-hidden="true">${Array.from({length:count},()=>`<span class="avatar avatar-sm"></span>`).join('')}</div>`;
}

export function detailSocialProof(r){
  const rows = [];
  if (Number.isFinite(r.visits7d) && r.visits7d > 0){
    rows.push(`<div class="rp-social-item">
      ${avatarStack(r.visits7d)}
      <div class="rp-social-txt"><b>${fmtFa(r.visits7d)} رزرو</b> در هفته‌ی گذشته اینجا انجام شده</div>
    </div>`);
  }
  if (Number.isFinite(r.recommendPct)){
    rows.push(`<div class="rp-social-item">
      <span style="color:var(--success);display:inline-flex">${icon('heart',{size:18,fill:true})}</span>
      <div class="rp-social-txt"><b>${fmtFa(r.recommendPct)}٪</b> از نظرها ۴ ستاره یا بالاتر بوده</div>
    </div>`);
  }
  return rows.length ? `<div class="rp-social">${rows.join('')}</div>` : '';
}

export function socialProofHTML(r){
  if (!Number.isFinite(r.visits7d) || r.visits7d <= 0) return '';
  const hot = isHot(r);
  return `<div class="rc-social">
    ${avatarStack(r.visits7d, 3)}
    <div class="rc-social-txt"><b>${fmtFa(r.visits7d)} رزرو</b> هفته‌ی گذشته</div>
    ${hot?`<span class="rc-hot" style="margin-inline-start:auto">${icon('flame',{size:12,fill:true})} داغ</span>`:''}
  </div>`;
}

/** «داغ» = هم امتیازِ بالا، هم رفت‌وآمدِ واقعیِ این هفته. فقط امتیاز کافی نیست:
 *  رستورانی با ۵ نظرِ عالی از پارسال «داغ» نیست. */
export function isHot(r){
  return r.rt >= 4.7 && (r.reviews||0) >= 80 && Number.isFinite(r.visits7d) && r.visits7d >= 10;
}
// ⚠️ رفعِ قابلیتِ دست‌نیافتنی (پروتکل §۸/§۹): بک‌اند از قبل صفحه‌بندیِ cursor-based
// دارد و `loadMoreRestaurants()` در api.js هم نوشته شده بود — ولی **هیچ صداکننده‌ای
// نداشت**. نتیجه: اپِ مشتری هرگز از صفحه‌ی اولِ رستوران‌ها فراتر نمی‌رفت و بقیه‌ی
// رستوران‌های ثبت‌شده برای کاربر نامرئی بودند. دکمه فقط روی فیدِ فیلترنشده
// (`list === R`) و فقط وقتی سرور واقعاً cursorِ بعدی داده ظاهر می‌شود.
function moreBtnHTML(list){
  if(list !== R || !NEXT_CURSOR) return '';
  return `<button type="button" class="btn btn-ghost btn-block feed-more" id="feedMore" onclick="loadMoreFeed()">رستوران‌های بیشتر</button>`;
}
// ⚠️ باگِ واقعیِ رقابتِ رندر (پیدا شده با E2E در ۲۰۲۶-۰۸-۲۵، بازتولید ~۱ از ۳
// اجرا حتی با --workers=1 — پس ناپایداریِ تست نبود، باگِ واقعیِ کاربر بود):
//
// renderFeed اول اسکلت را همگام می‌کشد و کارت‌هایِ واقعی را ۲۸۰ms بعد در یک
// setTimeout می‌نویسد. تا پیش از این، هیچ‌چیز جلویِ نوشتنِ یک رندرِ **کهنه**
// روی نتیجه‌ی یک رندرِ **تازه‌تر** را نمی‌گرفت. سناریویِ واقعی:
//   ۱. boot → renderFeed(R) با دادهٔ نمونه (setTimeout در راه است)
//   ۲. کاربر سریع جست‌وجو می‌کند → doSearch حالتِ «پیدا نشد» را می‌نویسد
//   ۳. setTimeoutِ مرحله‌ی ۱ می‌رسد و #feed را با **همه‌ی** رستوران‌ها بازنویسی
//      می‌کند — کاربر نتیجه‌ی جست‌وجویش را از دست می‌دهد و فهرستِ کامل را
//      «نتیجه‌ی جست‌وجو» فرض می‌کند. دقیقاً همان رگرسیونی که تستِ
//      social-proof «جست‌وجوی بی‌نتیجه» می‌خواست بگیرد.
// همین اتفاق برای syncRestaurants (دادهٔ واقعیِ سرور که دیرتر می‌رسد) هم می‌افتاد.
//
// رفع: یک ژتونِ صعودی. هر نوشتنی روی #feed ژتون را جلو می‌برد؛ setTimeout فقط
// وقتی رنگ می‌زند که ژتونش هنوز جاری باشد. رندرِ کهنه بی‌صدا کنار می‌رود.
let FEED_TOKEN = 0;
/** ابطالِ هر رندرِ در جریانِ فید — هر کسی که مستقیم #feed را می‌نویسد باید صدایش بزند. */
export function invalidateFeed(){ return ++FEED_TOKEN; }
export function renderFeed(list){
  const f=document.getElementById('feed');
  const token=invalidateFeed();
  f.innerHTML=list.map(()=>`<div class="rc" style="opacity:1;transform:none"><div class="rc-img sk" style="border-radius:0"></div><div class="rc-body"><div class="sk" style="height:16px;width:65%;margin-bottom:9px"></div><div class="sk" style="height:12px;width:40%;margin-bottom:16px"></div><div class="sk" style="height:30px"></div></div></div>`).join('');
  setTimeout(()=>{
    if(token!==FEED_TOKEN) return;   // رندرِ تازه‌تری از راه رسیده — این یکی کهنه است
    f.innerHTML=list.map(cardHTML).join('') + moreBtnHTML(list);
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
  // امتیاز: اگر واقعاً نداریم «—» — نه ۴٫۵ِ اختراعی (ادعای ساختگی درباره‌ی یک کسب‌وکارِ واقعی بود).
  const rating=Number.isFinite(r.rt)&&r.rt>0?fmtFa(r.rt):(Number.isFinite(r.rating)&&r.rating>0?fmtFa(r.rating):'—');
  return `<div class="hcard" role="button" tabindex="0" onclick="openRest(${jsq(String(r.id))})">
    <div class="hcard-img" style="background:${gradFor(r.id)}">${r.e||icon('utensils',{size:22})}${extra?`<span class="hcard-tag">${extra}</span>`:''}</div>
    <div class="hcard-name">${esc(r.n)}</div>
    <div class="hcard-meta">${icon('star',{size:12,fill:true})} ${rating} · ${esc((r.tags&&r.tags[0])||r.cuisine||'')}${r.slug?'':' · نمونه'}</div>
  </div>`;
}
// ═══════════════════════════════════════════════════════════
//  «نزدیک تو» — فاصله‌ی واقعی یا هیچ
//
//  نسخه‌ی قبل ترتیب را با Math.random() به‌هم می‌ریخت و بعد برچسبِ
//  «۰٫۷ کیلومتر» رویش می‌گذاشت که از i حساب می‌شد، نه از موقعیتِ کسی.
//  یعنی هم «نزدیک» دروغ بود، هم عددش.
//
//  حالا: اگر کاربر اجازه‌ی موقعیت داده باشد و رستوران مختصات داشته باشد،
//  فاصله‌ی واقعی (هاورساین) حساب و مرتب می‌شود. وگرنه عنوانِ بخش به
//  «پیشنهاد برای تو» عوض می‌شود و هیچ عددِ فاصله‌ای نشان داده نمی‌شود.
//  اجازه هم خودبه‌خود پرسیده نمی‌شود — فقط اگر قبلاً داده شده باشد.
// ═══════════════════════════════════════════════════════════
let userPos=null;

/** فاصله‌ی دو نقطه روی کره، به کیلومتر. */
function haversineKm(a,b){
  const toRad=d=>d*Math.PI/180, Rk=6371;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*Rk*Math.asin(Math.sqrt(s));
}
const hasCoords=r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng);

export function renderNearby(){
  const el=document.getElementById('nearbyScroll');if(!el)return;
  const title=document.getElementById('nearbyTitle');

  if(userPos){
    const withDist=R.filter(hasCoords)
      .map(r=>({r,km:haversineKm(userPos,{lat:r.lat,lng:r.lng})}))
      .sort((a,b)=>a.km-b.km).slice(0,6);
    if(withDist.length){
      if(title)title.textContent='نزدیک تو';
      el.innerHTML=withDist.map(({r,km})=>hCardHTML(r,
        km<1?`${fmtFa(Math.round(km*1000))} متر`:`${fmtFa(Math.round(km*10)/10)} کیلومتر`)).join('');
      return;
    }
  }
  // بدونِ موقعیت، ادعای «نزدیک» بی‌پایه است — عنوان و محتوا صادقانه عوض می‌شوند.
  if(title)title.textContent='پیشنهاد برای تو';
  el.innerHTML=[...R].sort((a,b)=>(b.rt||0)-(a.rt||0)).slice(0,6).map(r=>hCardHTML(r,'')).join('');
}

/** اگر اجازه‌ی موقعیت از قبل داده شده، بگیر و «نزدیک تو» را دوباره بساز.
 *  عمداً prompt نمی‌زند: پرسیدنِ اجازه در لحظه‌ی ورود، رفتارِ مزاحمی است.
 *  ⚠️ فقط یک‌بار در هر نشست: خواندنِ موقعیت هزینه‌ی باتری/زمان دارد و
 *  renderDiscoverSections در بوت **دوبار** صدا زده می‌شود (یک‌بار با دادهٔ نمونه،
 *  یک‌بار بعد از رسیدنِ دادهٔ سرور) — قبلاً یعنی دو بار permission-query و دو بار
 *  getCurrentPosition روی هر لودِ سرد. مختصات در userPos می‌ماند و renderNearby
 *  خودش از آن استفاده می‌کند، پس بارِ دوم چیزی به دست نمی‌آورد. */
let _nearbyInit = false;
export function initNearby(){
  if(_nearbyInit) return;
  _nearbyInit = true;
  if(!navigator.geolocation||!navigator.permissions?.query)return;
  navigator.permissions.query({name:'geolocation'}).then(p=>{
    if(p.state!=='granted')return;
    navigator.geolocation.getCurrentPosition(
      pos=>{ userPos={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderNearby(); },
      ()=>{}, {maximumAge:300000,timeout:5000});
  }).catch(()=>{});
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
// صداکننده‌ها: بوت (یک‌بار) و pull-to-refresh (هر ژست). عمداً هیچ کشِ پنهانی
// ندارد — هر فراخوان یعنی «کاربر واقعاً تازه‌سازی خواست» یا «لودِ سرد».
export async function renderEvents(){
  const el=document.getElementById('eventsList');if(!el)return;
  const res=await API.get('/events');

  // سه حالتِ متفاوت، سه رفتارِ متفاوت — همان انضباطی که booking.js دارد:
  //  • سرور جواب داد و رویدادی نیست → حالتِ خالیِ صادق. رویدادِ نمونه نشان
  //    نمی‌دهیم؛ جدولِ special_events در هر استقرارِ تازه خالی است، پس در
  //    عمل *همه‌ی* کاربرانِ واقعی سه رویدادِ ساختگی می‌دیدند. همان اصلِ
  //    «بدونِ دادهٔ واقعی، هیچ ادعایی» که در social-proof هم قفل شده.
  //  • سرور در دسترس نیست (offline) → نمونه‌ها فقط برایِ نمایشِ آفلاین، با
  //    برچسبِ «نمونه» تا با واقعیت اشتباه نشود.
  //  • خطای واقعیِ سرور → صریح بگو، نه اینکه با نمونه پنهانش کنی.
  if(res.ok){
    const list=Array.isArray(res.data?.events)?res.data.events:[];
    if(!list.length){
      el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${icon('calendar',{size:40})}</div><div class="empty-state-title">فعلاً رویدادِ ویژه‌ای نیست</div><div class="empty-state-desc">به‌محضِ اعلامِ رستوران‌ها همین‌جا می‌بینی‌اش</div></div>`;
      return;
    }
    // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): rest همیشه خالی بود (نامِ میزبان نمایش
    // داده نمی‌شد) و کلیک فقط با restaurantId کار می‌کرد — اگر رستوران در
    // صفحه‌ی بارگذاری‌شده‌ی فید نبود، کارت عملاً کلیکِ مرده بود. حالا API
    // restaurant_slug/restaurant_name می‌دهد و openRestBySlug با slug حتی
    // رستورانِ خارج از فید را باز می‌کند.
    const events=list.map(e=>({rid:e.restaurantId,slug:e.restaurant_slug||'',emoji:e.emoji||'🎉',title:e.title,rest:e.restaurant_name||'',when:new Date(e.startsAt).toLocaleDateString('fa-IR'),price:e.priceToman?fmtFa(Math.round(e.priceToman/1000))+'ک':'',desc:e.description||''}));
    el.innerHTML=eventsHtml(events,false);
    return;
  }
  if(!res.offline){
    el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${icon('alert',{size:40})}</div><div class="empty-state-title">رویدادها بارگذاری نشد</div><div class="empty-state-desc">${res.status?`خطای ${res.status}`:'دوباره تلاش کن'}</div></div>`;
    return;
  }
  el.innerHTML=eventsHtml(SAMPLE_EVENTS,true);
}

/** مارکاپِ کارت‌های رویداد. isDemo=true چیپِ «نمونه» را اضافه می‌کند. */
function eventsHtml(events,isDemo){
  return events.map(e=>`
    <div class="event-card" role="button" tabindex="0" onclick="openRestBySlug(${jsq(String(e.rid))},${jsq(String(e.slug||''))})">
      <div class="event-emoji">${esc(e.emoji)}</div>
      <div class="event-body">
        <div class="event-title">${esc(e.title)}${isDemo?' <span class="demo-chip">نمونه</span>':''}</div>
        ${e.rest?`<div class="event-rest">${esc(e.rest)}</div>`:''}
        <div class="event-when">${icon('calendar',{size:13})} ${esc(e.when)}</div>
        ${e.desc?`<div class="event-desc">${esc(e.desc)}</div>`:''}
      </div>
      ${e.price?`<div class="event-price">${esc(e.price)}<span>تومان</span></div>`:''}
    </div>`).join('');
}
// بخش‌هایی که فقط به `R`ِ فعلی وابسته‌اند — هیچ درخواستِ شبکه‌ای نمی‌زنند، پس
// هر بار که لیستِ رستوران‌ها عوض شد (sync، صفحه‌ی بعدی) می‌شود ارزان صدایشان زد.
export function renderRestaurantSections(){
  renderNearby();
  renderTrending();
  // اعداد را به دادهٔ واقعی وصل کن (نه ثابتِ hard-coded) — C4
  const sub=document.querySelector('#page-discover .section-sub');
  if(sub && Array.isArray(R) && R.length) sub.textContent=`${fmtFa(R.length)} رستوران فعال · ${searchCtxLabel()}`;
  // چیپِ امتیاز عمداً اینجا نوشته نمی‌شود: منبعِ واحدش syncNavPoints در
  // api.js است که مقدار را از /me/loyalty می‌گیرد. نوشتنِ ptsِ محلی اینجا
  // باعث می‌شد مهمانِ ناشناس عددِ ساختگی ببیند (باگِ ۳۴۰).
  if (pts > 0) { const np=document.getElementById('navPts'); if(np) np.textContent=fmtFa(pts); }
}
// رندرِ کاملِ صفحه‌ی کشف — شاملِ بخش‌هایی که خودشان I/O دارند.
//
// ⚠️ فقط دو صداکننده دارد و باید همین بماند: `boot()` (لودِ سرد) و
// pull-to-refresh (خواستِ صریحِ کاربر). قبلاً `syncRestaurants` هم آن را صدا
// می‌زد، پس هر لودِ سرد **دو** `GET /events` و **دو** خواندنِ موقعیت می‌فرستاد
// (بار اول با دادهٔ نمونه، بار دوم بعد از رسیدنِ /restaurants). حالا
// syncRestaurants فقط `renderRestaurantSections()` را صدا می‌زند که هیچ I/O
// ندارد. اگر جای دیگری این تابع را صدا زدی، یعنی داری یک درخواستِ شبکه‌ی
// اضافه اضافه می‌کنی — عمدی باشد، نه اتفاقی.
export function renderDiscoverSections(){
  renderRestaurantSections();
  initNearby();     // اگر اجازه‌ی موقعیت از قبل هست، «نزدیک تو» را واقعی می‌کند (یک‌بار)
  renderEvents();
}
// ⚠️ اضافه‌شده (R4 — حسابرسیِ جست‌وجو، ۲۰۲۶-۰۸-۱۴): انتخاب‌هایِ «کِی»/«چند
// نفر» در نوارِ جست‌وجو قبلاً bookingCtx را می‌نوشتند ولی هیچ‌جای نتایج
// این را نشان نمی‌داد — کاربر «فردا شب، ۴ نفر» را انتخاب می‌کرد و نتایج
// همچنان می‌گفتند «۱۲ رستوران فعال»، بدونِ اشاره به این‌که این عدد اصلاً
// بر اساسِ آن انتخاب فیلتر نشده (doSearch فقط رویِ متن فیلتر می‌کند).
// این خط الان صریح می‌گوید نتایج برایِ چه زمان/چند‌نفری نمایش داده می‌شود.
function searchCtxLabel(){
  return `${labelForISO(bookingCtx.date)} · ${fmtFa(bookingCtx.party)} نفر`;
}
export function doSearch(){
  const q=document.getElementById('sQ').value.trim();
  const sub=document.querySelector('#page-discover .section-sub');
  if(!q){
    document.getElementById('feedTitle').innerHTML=icon('flame',{size:16,fill:true})+' محبوب امشب';
    if(sub) sub.textContent=`${fmtFa(R.length)} رستوران فعال · ${searchCtxLabel()}`;
    renderFeed(R);return;
  }
  const list=R.filter(r=>r.n.includes(q)||r.cuisine.includes(q)||r.vibes.some(v=>v.includes(q)));
  document.getElementById('feedTitle').textContent=`نتایج «${q}»`;
  if(sub) sub.textContent=(list.length?`${fmtFa(list.length)} نتیجه`:'چیزی پیدا نشد')+` · ${searchCtxLabel()}`;
  if(list.length){ renderFeed(list); return; }
  // نتیجه‌ی خالی یعنی خالی. نسخه‌ی قبل کلِ فهرست را نشان می‌داد و فقط یک toast
  // می‌داد — کاربر شش کارت می‌دید و گمان می‌کرد این‌ها نتیجه‌ی جست‌وجویش‌اند.
  invalidateFeed();   // هر renderFeedِ در جریان را باطل کن، وگرنه ۲۸۰ms بعد این حالتِ خالی را می‌پوشاند
  document.getElementById('feed').innerHTML=`
    <div class="empty" style="grid-column:1/-1">
      <div class="empty-emoji" aria-hidden="true">🔍</div>
      <div class="empty-title">چیزی برای «${esc(q)}» پیدا نشد</div>
      <div class="empty-text">اسمِ رستوران، نوعِ آشپزی یا حال‌وهوا رو امتحان کن</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="clearSearch()">دیدنِ همه‌ی رستوران‌ها</button>
    </div>`;
}
/** پاک‌کردنِ جست‌وجو و برگشت به فید — از حالتِ خالی صدا زده می‌شود. */
export function clearSearch(){
  const q=document.getElementById('sQ'); if(q) q.value='';
  doSearch();
}
export function toggleFav(id,el){
  id=String(id);   // favs همیشه کلیدِ String نگه می‌دارد (id نمونه عدد، id واقعی UUID)
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
      favs.add(String(id));
      saveFavs();
      if(el){ el.innerHTML=icon('heart',{size:20,fill:true}); el.setAttribute('aria-pressed','true'); el.setAttribute('aria-label','حذف از علاقه‌مندی‌ها'); }
      if(document.getElementById('page-favorites')?.classList.contains('active')) renderFavs();
    });
    if(document.getElementById('page-favorites')?.classList.contains('active')) renderFavs();
  }
}
// نسخه‌ی hero صفحه رستوران — با انیمیشن تپش
export function toggleRestFav(id){
  id=String(id);
  const btn=document.getElementById('rpFav');
  const key=String(id);
  const on=!favs.has(key);
  on?favs.add(key):favs.delete(key);
  saveFavs();
  if(btn){
    btn.innerHTML=icon('heart',{size:22,fill:on});
    btn.setAttribute('aria-pressed',String(on));
    btn.setAttribute('aria-label',on?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها');
  }
  if(on){ toast('','به علاقه‌مندی‌ها اضافه شد'); }
  else {
    undoSnack('از علاقه‌مندی‌ها حذف شد', ()=>{
      favs.add(String(id));
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
window.clearSearch = clearSearch;
window.toggleFav = toggleFav;
window.toggleRestFav = toggleRestFav;
