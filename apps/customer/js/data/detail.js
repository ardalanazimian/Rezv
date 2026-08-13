// ═══ رزرونو — جزئیاتِ رستوران (صفحه‌ی rest) · بخشی از اپ کاستومر ═══
//  توجه: جریانِ رزرو به data/booking.js منتقل شد (جداسازیِ مسئولیت).
import { esc, toast } from '../auth.js';
import { detailSocialProof, fmtFa, go, toggleRestFav } from './discover.js';
import { GRAD, favs, setCurRest } from './seed.js';
import { R } from '../init.js';
import { armReveals, buzz } from '../theme-pwa.js';
import { icon } from '../icons.js';
export function openRest(id){
  setCurRest(id);const r=R.find(x=>x.id===id);
  const stars=n=>Array.from({length:5},(_,i)=>icon('star',{size:13,fill:i<Math.round(n)})).join('');
  document.getElementById('page-rest').innerHTML=`
    <div class="rp-hero" style="background:${GRAD[id]}">
      <div class="rp-hero-mesh"></div>
      <button class="rp-hero-back glass" onclick="go('discover')" aria-label="بازگشت به کشف">→</button>
      <div class="rp-hero-actions">
        <button class="rp-hero-icon glass" onclick="buzz&&buzz();toast('','لینک کپی شد')" aria-label="اشتراک‌گذاری رستوران">${icon('share',{size:20})}</button>
        <button class="rp-hero-icon glass" id="rpFav" onclick="buzz&&buzz();toggleRestFav(${id})" aria-pressed="${favs.has(id)}" aria-label="${favs.has(id)?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}">${icon('heart',{size:22,fill:favs.has(id)})}</button>
      </div>
      <div class="rp-hero-emoji">${r.e}</div>
      <div class="rp-hero-overlay">
        <div class="rp-hero-badges">
          ${r.now?`<span class="rp-hero-badge live"><span class="live-dot" aria-hidden="true"></span> الان باز</span>`:''}
          <span class="rp-hero-badge">${icon('wallet',{size:14})} ${fmtFa(r.cb)}٪ کش‌بک</span>
          ${r.slug?'':'<span class="rp-hero-badge demo">نمونه — دادهٔ آزمایشی</span>'}
        </div>
        <div class="rp-hero-name">${esc(r.n)}</div>
        <div class="rp-hero-meta">
          <span class="rp-hero-rate"><span style="color:#FBBF24;display:inline-flex">${icon('star',{size:14,fill:true})}</span> ${fmtFa(r.rt)}</span>
          <span class="rp-hero-dot">·</span>
          <span>${fmtFa(r.reviews)} نظر</span>
          <span class="rp-hero-dot">·</span>
          <span>${esc(r.cuisine)}</span>
          <span class="rp-hero-dot">·</span>
          <span>${esc(r.price)}</span>
        </div>
      </div>
    </div>
    <div class="wrap rp-body">
      ${detailSocialProof(r)}

      <div class="rp-section reveal"><h3>درباره</h3><p class="rp-about">${esc(r.about)}</p><div class="feat-row">${r.feats.map(f=>`<span class="feat">${icon('check',{size:13})} ${esc(f)}</span>`).join('')}</div></div>

      <div class="rp-section reveal"><h3>منو</h3><div class="menu-list">${r.menu.map(m=>`<div class="menu-item glass"><div class="menu-emoji">${m[0]}</div><div class="menu-info"><div class="menu-name">${esc(m[1])}</div><div class="menu-price">${m[2]} تومان</div></div></div>`).join('')}</div></div>

      <div class="rp-section reveal">
        <h3>امتیازها و نظرها</h3>
        <div class="rb-grid glass">
          <div class="rb-overall"><div class="rb-big">${fmtFa(r.rt)}</div><div class="rb-stars">${stars(r.rt)}</div><div class="rb-count">${fmtFa(r.reviews)} نظر</div></div>
          <div class="rb-bars">${[['غذا',r.rb.food],['سرویس',r.rb.service],['فضا',r.rb.atmo],['ارزش',r.rb.value]].map(([l,v])=>`<div class="rb-bar-row"><span class="rl">${l}</span><div class="rb-track"><div class="rb-fill" style="width:0" data-w="${v/5*100}"></div></div><span class="rv">${fmtFa(v)}</span></div>`).join('')}</div>
        </div>
        <div class="ai-review glass">
          <div class="ai-review-head"><div class="icn">${icon('sparkle',{size:16,fill:true})}</div><div class="ttl">خلاصه‌ی هوشمند نظرها</div><span class="tag">AI</span></div>
          <div class="ai-col"><div class="ai-col-label">${icon('thumbsUp',{size:14})} مهمان‌ها تعریف می‌کنن از:</div>${r.good.map(g=>`<div class="ai-point"><span class="ic good">${icon('check',{size:12})}</span>${esc(g)}</div>`).join('')}</div>
          <div class="ai-col"><div class="ai-col-label">${icon('thumbsDown',{size:14})} گاهی گله دارن از:</div>${r.bad.map(b=>`<div class="ai-point"><span class="ic bad">!</span>${esc(b)}</div>`).join('')}</div>
        </div>
        ${r.revs.map(rv=>`<div class="review reveal"><div class="review-ava">${rv[1]}</div><div class="review-body"><div class="review-top"><span class="review-name">${esc(rv[0])}</span><span class="review-date">${esc(rv[4])}</span></div><div class="review-stars">${Array.from({length:+rv[2]},()=>icon('star',{size:12,fill:true})).join('')}</div><div class="review-text">${esc(rv[3])}</div></div></div>`).join('')}
      </div>
    </div>
    <div class="rp-bookbar glass">
      <div class="rp-bookbar-info">
        <div class="rp-bookbar-cb">${icon('wallet',{size:13})} ${fmtFa(r.cb)}٪ کش‌بک</div>
        <div class="rp-bookbar-sub">رزرو رایگان · بدون پیش‌پرداخت</div>
      </div>
      <button class="btn btn-ghost rp-msg-btn" onclick="buzz&&buzz();openChat('${esc(r.slug||'')}')" aria-label="پیام به رستوران" ${r.slug?'':'disabled'}>${icon('message',{size:20})}</button>
      <button class="btn btn-primary rp-bookbar-btn" onclick="buzz&&buzz();openBookSheet(${id})">رزرو میز</button>
    </div>`;
  go('rest');
  setTimeout(()=>document.querySelectorAll('.rb-fill').forEach(f=>f.style.width=f.dataset.w+'%'),300);
  armReveals&&armReveals();
}

// ── نمایشِ تابعِ onclick روی window ──
window.openRest = openRest;
