// ═══ رزرونو — وفاداری و امتیاز (بخشی از اپ کاستومر) ═══
import { API, isLoggedIn } from '../api.js';
import { fmtFa } from '../data/discover.js';
import { BADGES, PERKS, pts, setPts } from '../data/seed.js';
import { openGiftCards, openReferral, openRewardsDates } from './rewards.js';
import { armReveals, buzz } from '../theme-pwa.js';
export function renderLoyalty(){
  // بارگذاری امتیاز واقعی از سرور (اگر وارد شده)
  loadRealPoints();
  document.getElementById('page-loyalty').innerHTML=`<div class="wrap section">
    <div class="loy-card"><div class="loy-card-mesh"></div><div class="loy-tier">🏆 سطح طلایی</div><div class="loy-pts"><span id="loyPts" class="loy-pts-num">${fmtFa(pts)}</span> <span style="font-size:20px;font-weight:600;opacity:.9">امتیاز</span></div><div class="loy-next">۱۶۰ امتیاز تا سطح بعدی (پلاتینیوم)</div><div class="loy-prog"><div class="loy-prog-fill" style="width:0" data-w="68"></div></div></div>

    <!-- دعوت دوستان -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openReferral()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#A78BFA,#7C3AED)">🎁</div>
      <div class="lac-body"><div class="lac-title">دوستات رو دعوت کن</div><div class="lac-sub">۵۰۰ امتیاز برای هر دعوت موفق</div></div>
      <span class="lac-arrow">›</span>
    </div>
    <!-- کارت هدیه -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openGiftCards()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#FBBF24,#F59E0B)">💳</div>
      <div class="lac-body"><div class="lac-title">کارت هدیه</div><div class="lac-sub">هدیه‌ی خاص به عزیزانت بده</div></div>
      <span class="lac-arrow">›</span>
    </div>
    <!-- پاداش تولد/سالگرد -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openRewardsDates()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#F472B6,#DB2777)">🎂</div>
      <div class="lac-body"><div class="lac-title">پاداش تولد و سالگرد</div><div class="lac-sub">۱۰۰۰ امتیاز هدیه در روز خاصت</div></div>
      <span class="lac-arrow">›</span>
    </div>

    <div class="section-head reveal" style="margin-top:32px"><div class="section-title">مزایای تو</div></div>
    <div class="perks reveal">${PERKS.map(p=>`<div class="perk"><div class="perk-emoji">${p[0]}</div><div class="perk-name">${p[1]}</div><div class="perk-desc">${p[2]}</div></div>`).join('')}</div>
    <div class="section-head reveal" style="margin-top:32px"><div class="section-title">نشان‌ها</div></div>
    <div class="badge-grid reveal">${BADGES.map(b=>`<div class="bdg ${b[2]?'earned':'locked'}"><div class="bdg-emoji">${b[0]}</div><div class="bdg-name">${b[1]}</div><div class="bdg-desc">${b[2]?'✓ کسب شد':'قفل'}</div></div>`).join('')}</div>
  </div>`;
  setTimeout(()=>{const f=document.querySelector('.loy-prog-fill');if(f)f.style.width=f.dataset.w+'%'},300);
  // شمارشِ متحرکِ امتیاز (حسِ دستاورد)
  const pe=document.getElementById('loyPts');
  if(pe&&pts>0){const t0=performance.now(),dur=900;const tk=(nw)=>{const p=Math.min(1,(nw-t0)/dur),e=1-Math.pow(1-p,3);pe.textContent=fmtFa(Math.round(pts*e));if(p<1)requestAnimationFrame(tk);};requestAnimationFrame(tk);}
  armReveals&&armReveals();
}
// بارگذاری امتیاز واقعی از API
export async function loadRealPoints(){
  if(!isLoggedIn())return;
  const res=await API.get('/me/points');
  if(res.ok&&typeof res.data?.balance==='number'){
    setPts(res.data.balance);
    const el=document.getElementById('loyPts');if(el)el.textContent=fmtFa(pts);
  }
}
// ── دعوت دوستان (Referral) ──

