// ═══════════════════════════════════════════════════════════
//  رزرونو — مرورِ تمام‌صفحه (immersive): «اسکرولِ زنده‌ی تیک‌تاک» برایِ کشف
//
//  حکمِ مالک (DS-011، ۲۰۲۶-۰۹-۱۲): لمسِ یک تایلِ Explore باید به نمایی برسد که
//  هر رستوران **کلِ صفحه** را دارد و هر فلیک یک رستوران جلو می‌رود.
//
//  قراردادها:
//   • فهرست همان فهرستِ فیلترشده‌ی فید است (feedList) — چیپ/مناسبت/جست‌وجو
//     از فید به این نما منتقل می‌شوند؛ نمای تازه‌ای با فهرستِ خودش نیست.
//   • هر آیتم با DOM API ساخته می‌شود و تنها sinkِ HTMLش قالبی است که همه‌ی
//     درج‌هایش از esc/jsq/icon/fmtFa/gradFor می‌گذرند (گیتِ xss-sink-audit
//     آن را «escaped» می‌شمارد). چیپ‌های ساعت را همان `paintSlots`ِ فید
//     می‌کشد — یک منبع، نه یک کپی.
//   • عکس فقط بعد از load رویِ گرادیان می‌نشیند (mountPhoto)؛ شکست بی‌صداست.
//   • پیش‌واکشیِ جزئیات برایِ آیتمِ فعلی ±۲ تا عکس پیش از رسیدن آماده باشد.
//   • RTL: فقط خواصِ منطقی (inset-inline-*) — در CSS.
//   • بستن: دکمه، Escape؛ حرکت: فلیک/اسکرول، ↑/↓. اسکرولِ صفحه‌ی کشف بعد از
//     بستن به همان جایی برمی‌گردد که کاربر بود (go() خودش به بالا می‌رود).
// ═══════════════════════════════════════════════════════════
import { esc, jsq, toast } from '../auth.js';
import { favHas, gradFor } from '../data/seed.js';
import { findR } from '../init.js';
import { feedList, fmtFa, go, isHot, mountPhoto, paintSlots, photoUrl, requestDetail } from '../data/discover.js';
import { icon } from '../icons.js';

let imList = [];
let imCur = -1;
let imIO = null;
let imReturn = { y: 0, focus: null };

const imFeedEl = () => document.getElementById('imFeed');
const imActive = () => !!document.getElementById('page-immersive')?.classList.contains('active');
const imReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** اورلی‌هایی که رویِ این نما باز می‌شوند و Escape را خودشان صاحب‌اند. */
const imOverlayOpen = () => !!document.querySelector('#sheet.show, #dnaOverlay.open, #cmdk.show, #notif.show');

function imItemEl(r, i, n){
  const el = document.createElement('article');
  el.className = 'im-item';
  el.dataset.rid = String(r.id);
  el.tabIndex = -1;
  el.setAttribute('aria-label', `${r.n}، ${fmtFa(i + 1)} از ${fmtFa(n)}`);
  const hasRt = Number.isFinite(r.rt) && r.rt > 0;
  const on = favHas(r.id);
  const meta = [r.cuisine, r.price].filter(Boolean).join(' · ');
  const cb = Number.isFinite(r.cb) && r.cb > 0 ? `${fmtFa(r.cb)}٪ کش‌بک` : '';
  const social = Number.isFinite(r.visits7d) && r.visits7d > 0 ? `${fmtFa(r.visits7d)} رزرو در هفته‌ی گذشته` : '';
  // ⚠️ هیچ شرطی داخلِ قالب نیست — عمداً. هر ${…} یا esc/jsq است یا icon/fmtFa/gradFor؛
  // حالت‌های شرطی (نمونه، داغ، کش‌بک) با کلاس رویِ آیتم روشن/خاموش می‌شوند.
  el.innerHTML = `
    <div class="im-bg" style="background:${gradFor(r.id)}"></div>
    <span class="im-emoji" aria-hidden="true">${esc(r.e)}</span>
    <div class="im-scrim"></div>
    <div class="im-rail">
      <button type="button" class="rc-fav" aria-pressed="false" aria-label="افزودن به علاقه‌مندی‌ها" onclick="event.stopPropagation();toggleFav(${jsq(String(r.id))},this);haptic('like')">${icon('heart',{size:22,fill:on})}</button>
      <button type="button" class="im-rail-btn" aria-label="صفحه‌ی ${esc(r.n)}" onclick="openRest(${jsq(String(r.id))})">${icon('info',{size:22})}</button>
    </div>
    <div class="im-info">
      <span class="xt-badge im-hotbadge">${icon('flame',{size:12,fill:true})} داغ</span>
      <h2 class="im-name">${esc(r.n)} <span class="demo-chip">نمونه</span></h2>
      <div class="im-line">
        <span class="rc-rating">${icon(hasRt ? 'star' : 'sparkle',{size:14,fill:true,class:'star'})}${esc(hasRt ? fmtFa(r.rt) : 'تازه‌وارد')}</span>
        <span class="im-meta">${esc(meta)}</span>
        <span class="rc-cb im-cb">${icon('wallet',{size:12})} ${esc(cb)}</span>
      </div>
      <div class="im-social">${esc(social)}</div>
      <div class="rc-slots"></div>
      <button type="button" class="im-open" onclick="openRest(${jsq(String(r.id))})">صفحه‌ی رستوران ${icon('arrowL',{size:16})}</button>
    </div>`;
  el.classList.toggle('im-demo', !r.slug);
  el.classList.toggle('im-hot', isHot(r));
  el.classList.toggle('im-no-cb', !cb);
  const fav = el.querySelector('.rc-fav');
  fav.setAttribute('aria-pressed', String(on));
  fav.setAttribute('aria-label', on ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها');
  const url = photoUrl(r);
  if (url) mountPhoto(el.querySelector('.im-bg'), url, 'im-photo');
  return el;
}

function imBuild(list){
  const feed = imFeedEl(); if (!feed) return;
  feed.textContent = '';
  const frag = document.createDocumentFragment();
  list.forEach((r, i) => frag.appendChild(imItemEl(r, i, list.length)));
  feed.appendChild(frag);
  imList = list;
  imCur = -1;
  paintSlots(list);          // چیپ‌های ساعتِ واقعی — همان تابعی که فید را می‌کشد
  imArm();
}

function imArm(){
  if (imIO) imIO.disconnect();
  const feed = imFeedEl(); if (!feed) return;
  imIO = new IntersectionObserver(es => {
    for (const e of es) { if (e.isIntersecting) imEnter([...feed.children].indexOf(e.target)); }
  }, { root: feed, threshold: .6 });
  [...feed.children].forEach(it => imIO.observe(it));
}

function imEnter(idx){
  if (idx < 0 || idx === imCur) return;
  imCur = idx;
  const c = document.getElementById('imCount');
  if (c) c.textContent = `${fmtFa(idx + 1)} / ${fmtFa(imList.length)}`;
  for (let k = idx - 2; k <= idx + 2; k++) { const r = imList[k]; if (r) imPrefetch(r, k); }
}

function imPrefetch(r, k){
  const item = imFeedEl()?.children[k]; if (!item) return;
  const known = photoUrl(r);
  if (known) { mountPhoto(item.querySelector('.im-bg'), known, 'im-photo'); return; }
  if (r.detailLoaded) return;
  requestDetail(r).then(ok => {
    const url = ok ? photoUrl(r) : null;
    if (url && item.isConnected) mountPhoto(item.querySelector('.im-bg'), url, 'im-photo');
  });
}

function imJump(rid){
  const feed = imFeedEl(); if (!feed) return;
  const items = [...feed.children];
  const idx = Math.max(0, items.findIndex(it => it.dataset.rid === String(rid)));
  const el = items[idx]; if (!el) return;
  feed.scrollTop = el.offsetTop;   // بدونِ انیمیشن — کاربر از تایل «به داخل» می‌آید، نه به آنجا اسکرول می‌کند
  imEnter(idx);
  el.focus({ preventScroll: true });
}

function imStep(d){
  const feed = imFeedEl(); if (!feed) return;
  const next = Math.min(imList.length - 1, Math.max(0, (imCur < 0 ? 0 : imCur) + d));
  const el = feed.children[next]; if (!el) return;
  feed.scrollTo({ top: el.offsetTop, behavior: imReduced() ? 'instant' : 'smooth' });
}

export function openImmersive(id){
  const key = String(id);
  const src = feedList();
  const hit = findR(id);
  const list = src.some(r => String(r.id) === key) ? src : (hit ? [hit] : []);
  if (!list.length) { toast('', 'این رستوران فعلاً در دسترس نیست'); return; }
  imReturn = { y: window.scrollY, focus: document.activeElement };
  imBuild(list);
  go('immersive');
  imJump(key);
}

export function closeImmersive(){
  if (!imActive()) return;
  go('discover');
  window.scrollTo({ top: imReturn.y, behavior: 'instant' });
  imSyncTileFavs();
  const f = imReturn.focus;
  if (f && f.isConnected && typeof f.focus === 'function') f.focus({ preventScroll: true });
}

/** قلبِ تایل‌های هیرو را با favs همگام می‌کند — تغییری که در نمای تمام‌صفحه رخ داد
 *  نباید پشتِ سرِ کاربر گم شود. (فید و این نما هر کدام دکمه‌ی خودشان را دارند.) */
function imSyncTileFavs(){
  document.querySelectorAll('#feed .xt .rc-fav').forEach(b => {
    const on = favHas(b.closest('[data-rid]')?.dataset.rid);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها');
    b.innerHTML = icon('heart', { size: 20, fill: on });
  });
}

// فازِ capture: پیش از Actions/پالت/اعلان‌ها اجرا می‌شود، پس تا وقتی اورلی‌ای رویِ
// این نما باز است (imOverlayOpen) دست به Escape نمی‌زنیم — آن اورلی خودش می‌بندد.
document.addEventListener('keydown', e => {
  if (!imActive() || imOverlayOpen()) return;
  if (e.key === 'Escape') { e.preventDefault(); closeImmersive(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); imStep(e.key === 'ArrowDown' ? 1 : -1); }
}, { capture: true });

// فید دوباره رندر شد (دادهٔ سرور رسید، صفحه‌ی بعدی، pull-to-refresh) در حالی که این
// نما باز است: آیتم‌ها از فهرستِ تازه ساخته می‌شوند تا «صفحه‌ی رستوران» به رکوردی
// اشاره نکند که دیگر در R نیست. جای فعلی با id حفظ می‌شود.
document.addEventListener('rz:feed', e => {
  if (!imActive()) return;
  const list = e.detail?.list;
  if (!Array.isArray(list) || !list.length) return;
  const cur = imList[imCur]?.id;
  imBuild(list);
  imJump(cur ?? list[0].id);
});

window.openImmersive = openImmersive;
window.closeImmersive = closeImmersive;
