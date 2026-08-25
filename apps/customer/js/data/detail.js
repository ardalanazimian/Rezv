// ═══ رزرونو — جزئیاتِ رستوران (صفحه‌ی rest) · بخشی از اپ کاستومر ═══
//  توجه: جریانِ رزرو به data/booking.js منتقل شد (جداسازیِ مسئولیت).
import { esc, toast } from '../auth.js';
import { detailSocialProof, fmtFa, go, toggleRestFav } from './discover.js';
import { curRest, favHas, gradFor, setCurRest } from './seed.js';
import { API, applyRestaurantDetail, loadRestaurantDetail, mapApiRestaurant, resolveMediaUrl } from '../api.js';
import { R, findR } from '../init.js';
import { armReveals, buzz, haptic } from '../theme-pwa.js';
import { icon } from '../icons.js';

// ⚠️ رفع‌شده (حسابرسیِ دیزاینِ Desire، ۲۰۲۶-۰۸-۱۴): دکمه‌ی اشتراک‌گذاری فقط
// toast('لینک کپی شد') می‌داد بدونِ اینکه واقعاً چیزی کپی کند — دقیقاً همون
// دسته‌بندیِ «فیدبکِ موفقیتِ ساختگی» که این ماموریت صریحاً ممنوع کرده. حالا
// یا Web Share API واقعی (شیتِ اشتراکِ بومی) یا کپیِ واقعیِ آدرسِ همین صفحه.
// توجه: این اپ deep-link به‌ازایِ هر رستوران ندارد (SPA بدونِ روتینگِ URL) —
// پس لینکِ کپی‌شده آدرسِ کلیِ اپ است، نه لینکی که مستقیم همین رستوران را باز
// کند؛ برای همین متنِ toast صریحاً «لینکِ رزرونو» می‌گوید، نه «لینکِ این رستوران».
// ساختنِ deep-link واقعی (routing بر اساسِ query/hash) خارج از دامنه‌ی این
// رفعِ نقطه‌ای است — به KNOWN_LIMITATIONS اضافه شده.
// ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): این تابع قبلاً نامِ رستوران را مستقیم از
// داخلِ onclickِ اینلاین می‌گرفت — `shareRestaurant('${esc(r.n)}')`. برای
// رستورانِ زنده، r.n نامِ owner-controlledِ سرور است و esc فقط برای متنِ HTML
// امن است، نه برای رشته‌ی JS داخلِ attribute: پارسرِ HTML مقدارِ attribute را
// *قبل* از پارسرِ JS decode می‌کند، پس `&#39;` به `'` برمی‌گردد و یک نامِ حاویِ
// آپاستروف (مثلِ کافه‌ای با نامِ انگلیسیِ دارای ') هم دکمه را می‌شکست و هم
// بردارِ تزریقِ JS باز می‌کرد. حالا فقط idِ UUID (فرمتِ امن) پاس می‌شود و نام
// این‌جا از state حل می‌شود — هیچ متنِ سرور واردِ رشته‌ی HTML/JS نمی‌شود.
export async function shareRestaurant(id){
  const name = findR(id)?.n || 'رزرونو';
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: name, url }); } catch { /* کاربر لغو کرد یا مرورگر رد کرد — چیزی نگو */ }
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('', 'لینکِ رزرونو کپی شد')).catch(() => {});
  }
}
// ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴) — دو باگِ واقعی و یک اتصالِ گم‌شده:
//  ۱. idِ رستورانِ واقعی UUID است؛ اینجا بدونِ کوتیشن داخلِ onclick تزریق
//     می‌شد (openBookSheet(${id})) که برای UUID خطای syntaxِ JS می‌دهد —
//     یعنی دکمه‌ی «رزرو میز» برای هر رستورانِ واقعی مرده بود. CIِ فعلی این
//     را نمی‌گرفت چون mockِ E2E با idِ عددی کار می‌کند. حالا همه‌ی idها
//     کوتیشن‌دار تزریق و با String مقایسه می‌شوند (findR).
//  ۲. GRAD[uuid] همیشه undefined بود → hero بدونِ پس‌زمینه. حالا gradFor.
//  ۳. اپ مشتری هرگز GET /restaurants/{slug} را صدا نمی‌زد — عکس‌هایی که
//     رستوران در پنلِ بیزنس آپلود و پلتفرم تأیید کرده بود، هیچ‌وقت به
//     مشتری نمی‌رسید. حالا صفحه اول فوری رندر می‌شود و بعد با داده‌ی
//     واقعیِ سرور (عکس، لوگو، منو، امتیازِ تجمیعی) کامل می‌شود.
export function openRest(id){
  const r=findR(id);
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): قبلاً روی نبودِ رستوران بی‌صدا return می‌کرد
  // — کارتِ رویداد/سفر که به رستورانِ خارج از فیدِ بارگذاری‌شده اشاره می‌کند،
  // کلیکِ مرده می‌شد بدونِ هیچ بازخوردی. حالا حداقل صادقانه اطلاع می‌دهد.
  if(!r){ toast('','این رستوران فعلاً در دسترس نیست'); return; }
  setCurRest(r.id);
  renderRestPage(r);
  go('rest');
  finishRestRender();
  enrichRestPage(r);
}
// ⚠️ اضافه‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): بازکردنِ رستوران از جایی که فقط slug
// می‌دانیم — مثلِ کارتِ رویداد، که به رستورانی اشاره می‌کند که ممکن است در
// صفحه‌ی بارگذاری‌شده‌ی فید نباشد (فید صفحه‌بندی‌شده است). اگر در R بود همان
// مسیرِ عادی؛ وگرنه از endpointِ جزئیات یک رکوردِ کمینه می‌سازیم، به R اضافه
// می‌کنیم و صفحه را باز می‌کنیم — به‌جای کلیکِ مرده یا توستِ «در دسترس نیست».
export async function openRestBySlug(id, slug){
  const existing = findR(id) || (slug ? R.find(x => x.slug === slug) : null);
  if (existing) { openRest(existing.id); return; }
  if (!slug || !API.online) { toast('','این رستوران فعلاً در دسترس نیست'); return; }
  const d = await loadRestaurantDetail(slug);
  if (!d) { toast('','این رستوران فعلاً در دسترس نیست'); return; }
  // رکوردِ کمینه با همان شکلی که mapApiRestaurant می‌سازد (رستورانِ زنده:
  // فیلدهای روایی خالی می‌مانند، هیچ‌چیز از نمونه قرض گرفته نمی‌شود).
  const r = mapApiRestaurant({ id: d.id, slug: d.slug, name: d.name, cuisine: d.cuisine, vibes: d.vibes, priceBand: d.price_band });
  applyRestaurantDetail(r, d);
  R.push(r);
  openRest(r.id);
}

/** بعد از رندرِ اولیه، جزئیاتِ واقعی را از سرور بگیر و صفحه را کامل کن. */
async function enrichRestPage(r){
  // حداکثر یک درخواست به‌ازای هر بازشدنِ صفحه؛ بعد از موفقیت (detailLoaded +
  // کشِ loadRestaurantDetail) دیگر درخواستی نمی‌رود. شکستِ گذرا کش نمی‌شود —
  // بازشدنِ بعدیِ همین رستوران دوباره تلاش می‌کند.
  if(!r.slug || r.detailLoaded || !API.online) return;
  const d = await loadRestaurantDetail(r.slug);
  if(!d) return;
  applyRestaurantDetail(r, d);
  // فقط اگر کاربر هنوز روی همین رستوران است، دوباره رندر کن (بدونِ go/scroll)
  if(String(curRest)===String(r.id) && document.getElementById('page-rest')?.classList.contains('active')){
    renderRestPage(r);
    finishRestRender();
  }
}
function finishRestRender(){
  setTimeout(()=>document.querySelectorAll('.rb-fill').forEach(f=>f.style.width=f.dataset.w+'%'),300);
  armReveals&&armReveals();
}
function renderRestPage(r){
  const id=r.id;
  const stars=n=>Array.from({length:5},(_,i)=>icon('star',{size:13,fill:i<Math.round(n)})).join('');
  // عکسِ واقعیِ تأییدشده اگر هست، پس‌زمینه‌ی hero می‌شود؛ وگرنه گرادیانِ تزئینی.
  const heroPhoto=r.photos?.length?resolveMediaUrl(r.photos[0].url):null;
  const heroBg=heroPhoto
    ?`background-image:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55)),url('${esc(heroPhoto)}');background-size:cover;background-position:center`
    :`background:${gradFor(id)}`;
  document.getElementById('page-rest').innerHTML=`
    <div class="rp-hero${heroPhoto?' rp-hero--photo':''}" style="${heroBg}">
      <div class="rp-hero-mesh"${heroPhoto?' style="display:none"':''}></div>
      <button class="rp-hero-back glass" onclick="go('discover')" aria-label="بازگشت به کشف">→</button>
      <div class="rp-hero-actions">
        <button class="rp-hero-icon glass" onclick="haptic('light');shareRestaurant('${r.id}')" aria-label="اشتراک‌گذاری رستوران">${icon('share',{size:20})}</button>
        <button class="rp-hero-icon glass" id="rpFav" onclick="haptic('like');toggleRestFav('${r.id}')" aria-pressed="${favHas(id)}" aria-label="${favHas(id)?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}">${icon('heart',{size:22,fill:favHas(id)})}</button>
      </div>
      ${r.logo?`<img class="rp-hero-logo" src="${esc(resolveMediaUrl(r.logo))}" alt="لوگوی ${esc(r.n)}">`:heroPhoto?'':`<div class="rp-hero-emoji">${esc(r.e)}</div>`}
      <div class="rp-hero-overlay">
        <div class="rp-hero-badges">
          ${r.now?`<span class="rp-hero-badge live"><span class="live-dot" aria-hidden="true"></span> الان باز</span>`:''}
          <span class="rp-hero-badge">${icon('wallet',{size:14})} ${fmtFa(r.cb)}٪ کش‌بک</span>
          ${r.slug?'':'<span class="rp-hero-badge demo">نمونه — دادهٔ آزمایشی</span>'}
        </div>
        <div class="rp-hero-name">${esc(r.n)}</div>
        <div class="rp-hero-meta">${(() => {
          // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): قبلاً «★ ۰» و «۰ نظر» بدونِ قید
          // نشان داده می‌شد — رستورانِ زنده‌ی بدونِ امتیاز، «امتیازِ ۰ از ۵»
          // می‌نمود، نه «هنوز امتیازی ندارد». حالا امتیاز/تعدادِ نظر فقط وقتی
          // واقعاً > ۰ باشند رندر می‌شوند و جداکننده‌ی معلق هم نمی‌ماند.
          const parts = [];
          if (Number.isFinite(r.rt) && r.rt > 0) parts.push(`<span class="rp-hero-rate"><span style="color:#FBBF24;display:inline-flex">${icon('star',{size:14,fill:true})}</span> ${fmtFa(r.rt)}</span>`);
          if (Number.isFinite(r.reviews) && r.reviews > 0) parts.push(`<span>${fmtFa(r.reviews)} نظر</span>`);
          if (r.cuisine) parts.push(`<span>${esc(r.cuisine)}</span>`);
          if (r.price) parts.push(`<span>${esc(r.price)}</span>`);
          return parts.join('<span class="rp-hero-dot">·</span>');
        })()}</div>
      </div>
    </div>
    <div class="wrap rp-body">
      ${detailSocialProof(r)}
      ${r.photos?.length?`<div class="rp-section reveal"><h3>عکس‌ها</h3>
        <div class="rp-gallery" role="list">${r.photos.map(p=>`<figure class="rp-gallery-item" role="listitem"><img src="${esc(resolveMediaUrl(p.url))}" alt="${esc(p.caption||('عکسِ '+r.n))}" loading="lazy">${p.caption?`<figcaption>${esc(p.caption)}</figcaption>`:''}</figure>`).join('')}</div>
      </div>`:''}

      <div class="rp-section reveal"><h3>درباره</h3>${r.about?`<p class="rp-about">${esc(r.about)}</p>`:`<p class="rp-empty">این رستوران هنوز توضیحی ثبت نکرده.</p>`}${r.address?`<p class="rp-address">${icon('mapPin',{size:14})} ${esc(r.address)}</p>`:''}${r.feats.length?`<div class="feat-row">${r.feats.map(f=>`<span class="feat">${icon('check',{size:13})} ${esc(f)}</span>`).join('')}</div>`:''}</div>

      <div class="rp-section reveal"><h3>منو</h3>${r.menu.length?`<div class="menu-list">${r.menu.map(m=>`<div class="menu-item glass"><div class="menu-emoji">${m[3]?`<img class="menu-thumb" src="${esc(resolveMediaUrl(m[3]))}" alt="" loading="lazy">`:esc(m[0])}</div><div class="menu-info"><div class="menu-name">${esc(m[1])}</div><div class="menu-price">${m[2]} تومان</div></div></div>`).join('')}</div>`:`<p class="rp-empty">این رستوران هنوز منویی ثبت نکرده.</p>`}</div>

      <div class="rp-section reveal">
        <h3>امتیازها و نظرها</h3>
        ${(() => {
          // ⚠️ رفع‌شده (R1): اگر rb/good/bad/revs همه خالی‌اند (رستورانِ زنده‌یِ
          // بدونِ نظرِ ثبت‌شده)، رندرِ نوارهایِ امتیازِ صفر/۵ برایِ همه‌ی
          // معیارها گمراه‌کننده است — به‌جایِ «داده‌ای نیست» می‌خواند «همه‌چیز
          // بد است». به‌جایش یک وضعیتِ خالیِ صریح نشان داده می‌شود.
          const hasRatingBars = r.rb.food || r.rb.service || r.rb.atmo || r.rb.value;
          const hasAiSummary = r.good.length || r.bad.length;
          if (!hasRatingBars && !hasAiSummary && !r.revs.length) {
            // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): endpointِ جزئیات فقط میانگین و
            // تعدادِ نظر را می‌دهد، نه متنِ تک‌تکِ نظرها — پس r.revs خالی می‌ماند
            // حتی وقتی رستوران واقعاً نظر دارد. قبلاً این‌جا «هنوز نظری ثبت نشده»
            // می‌گفت در حالی که hero «۵ نظر» نشان می‌داد؛ تناقضِ داده. حالا اگر
            // امتیازِ تجمیعیِ واقعی هست، همان را صادقانه خلاصه می‌کنیم.
            if (Number.isFinite(r.reviews) && r.reviews > 0) {
              return `<div class="rb-overall glass" style="text-align:center"><div class="rb-big">${fmtFa(r.rt)}</div><div class="rb-stars">${stars(r.rt)}</div><div class="rb-count">میانگینِ ${fmtFa(r.reviews)} نظر — متنِ نظرها به‌زودی این‌جا</div></div>`;
            }
            return `<p class="rp-empty">هنوز نظری برای این رستوران ثبت نشده.</p>`;
          }
          return `
        ${hasRatingBars?`<div class="rb-grid glass">
          <div class="rb-overall"><div class="rb-big">${fmtFa(r.rt)}</div><div class="rb-stars">${stars(r.rt)}</div><div class="rb-count">${fmtFa(r.reviews)} نظر</div></div>
          <div class="rb-bars">${[['غذا',r.rb.food],['سرویس',r.rb.service],['فضا',r.rb.atmo],['ارزش',r.rb.value]].map(([l,v])=>`<div class="rb-bar-row"><span class="rl">${l}</span><div class="rb-track"><div class="rb-fill" style="width:0" data-w="${v/5*100}"></div></div><span class="rv">${fmtFa(v)}</span></div>`).join('')}</div>
        </div>`:''}
        ${hasAiSummary?`<div class="ai-review glass">
          <div class="ai-review-head"><div class="icn">${icon('sparkle',{size:16,fill:true})}</div><div class="ttl">خلاصه‌ی هوشمند نظرها</div><span class="tag">AI</span></div>
          ${r.good.length?`<div class="ai-col"><div class="ai-col-label">${icon('thumbsUp',{size:14})} مهمان‌ها تعریف می‌کنن از:</div>${r.good.map(g=>`<div class="ai-point"><span class="ic good">${icon('check',{size:12})}</span>${esc(g)}</div>`).join('')}</div>`:''}
          ${r.bad.length?`<div class="ai-col"><div class="ai-col-label">${icon('thumbsDown',{size:14})} گاهی گله دارن از:</div>${r.bad.map(b=>`<div class="ai-point"><span class="ic bad">!</span>${esc(b)}</div>`).join('')}</div>`:''}
        </div>`:''}
        ${r.revs.map(rv=>`<div class="review reveal"><div class="review-ava">${rv[1]}</div><div class="review-body"><div class="review-top"><span class="review-name">${esc(rv[0])}</span><span class="review-date">${esc(rv[4])}</span></div><div class="review-stars">${Array.from({length:+rv[2]},()=>icon('star',{size:12,fill:true})).join('')}</div><div class="review-text">${esc(rv[3])}</div></div></div>`).join('')}`;
        })()}
      </div>
    </div>
    <div class="rp-bookbar glass">
      <div class="rp-bookbar-info">
        <div class="rp-bookbar-cb">${icon('wallet',{size:13})} ${fmtFa(r.cb)}٪ کش‌بک</div>
        <div class="rp-bookbar-sub">رزرو رایگان · بدون پیش‌پرداخت</div>
      </div>
      <button class="btn btn-ghost rp-msg-btn" onclick="buzz&&buzz();openRestChat('${r.id}')" aria-label="پیام به رستوران" ${r.slug?'':'disabled'}>${icon('message',{size:20})}</button>
      <button class="btn btn-primary rp-bookbar-btn" onclick="buzz&&buzz();openBookSheet('${r.id}')">رزرو میز</button>
    </div>`;
}

// پیامِ رستوران: id (امن) می‌گیرد و slug را از state حل می‌کند — slug هرگز
// واردِ رشته‌ی onclick نمی‌شود (هم‌الگوی رفعِ shareRestaurant).
export function openRestChat(id){
  const r = findR(id);
  if (r?.slug && typeof window.openChat === 'function') window.openChat(r.slug);
}

// ── نمایشِ تابعِ onclick روی window ──
window.openRest = openRest;
window.shareRestaurant = shareRestaurant;
window.openRestChat = openRestChat;
window.openRestBySlug = openRestBySlug;
