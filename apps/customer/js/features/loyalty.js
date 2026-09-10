// ═══ رزرونو — وفاداری و امتیاز (بخشی از اپ کاستومر) ═══
//  سطح، پیشرفت تا سطحِ بعدی، و نشان‌ها همه از /me/loyalty می‌آیند — قبلاً
//  «سطحِ طلایی»، «۱۶۰ امتیاز تا پلاتینیوم»، نوارِ ۶۸٪، و earned/locedِ
//  نشان‌ها همیشه ثابت بودند (مستقل از امتیازِ واقعیِ کاربر). دیگر هیچ عددی
//  اینجا هاردکد نیست.
import { API, isLoggedIn } from '../api.js';
import { esc } from '../auth.js';
import { fmtFa } from '../data/discover.js';
import { PERKS, setPts } from '../data/seed.js';
import { openGiftCards, openReferral, openRewardsDates } from './rewards.js';
import { armReveals, buzz } from '../theme-pwa.js';
import { icon } from '../icons.js';

function perksBlock(){
  return `<div class="section-head reveal" style="margin-top:32px"><div class="section-title">مزایای باشگاه مشتریان</div></div>
    <div class="perks reveal">${PERKS.map(p=>`<div class="perk"><div class="perk-emoji">${p[0]}</div><div class="perk-name">${p[1]}</div><div class="perk-desc">${p[2]}</div></div>`).join('')}</div>`;
}

export async function renderLoyalty(){
  const root=document.getElementById('page-loyalty');
  if(!root)return;

  // مهمان (وارد نشده) → دعوت به ورود، بدونِ هیچ عددِ ساختگی
  if(!isLoggedIn()){
    root.innerHTML=`<div class="wrap section">
      <div style="text-align:center;padding:40px 20px">
        <div class="login-icon" style="margin-bottom:var(--sp-5)">${icon('user',{size:40})}</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">هنوز وارد نشدی</div>
        <div style="color:var(--t2);font-size:14px;margin-bottom:24px;line-height:1.6">برای دیدنِ امتیاز، سطح و نشان‌هات وارد شو</div>
        <button class="btn btn-primary btn-lg btn-block" onclick="openLogin()">ورود / ثبت‌نام</button>
      </div>
      ${perksBlock()}
    </div>`;
    armReveals&&armReveals();
    return;
  }

  // اسکلتونِ بارگذاری (به‌جایِ نمایشِ اعدادِ قبلی/ساختگی تا رسیدنِ پاسخِ واقعی)
  root.setAttribute('aria-busy','true');
  root.innerHTML=`<div class="wrap section">
    <div class="loy-card" aria-hidden="true">
      <div class="sk" style="height:16px;width:90px;border-radius:6px"></div>
      <div class="sk" style="height:34px;width:150px;margin-top:16px;border-radius:8px"></div>
      <div class="sk" style="height:13px;width:65%;margin-top:16px;border-radius:6px"></div>
    </div>
  </div>`;

  const res=await API.get('/me/loyalty');
  root.removeAttribute('aria-busy');

  if(!res.ok || !res.data){
    root.innerHTML=`<div class="wrap section"><div class="empty-state"><div class="empty-state-icon">${icon('alert',{size:44})}</div><div class="empty-state-title">وضعیتِ وفاداری بارگذاری نشد</div><div class="empty-state-desc">اتصالت رو چک کن و دوباره امتحان کن</div></div></div>`;
    armReveals&&armReveals();
    return;
  }

  const {points, tier, next_tier, points_to_next, progress_pct, badges}=res.data;
  setPts(points); // برایِ نمایشِ سازگار در بقیه‌ی صفحات (DNA غذایی و ...)

  // ⚠️ esc روی نامِ سطح (۲۰۲۶-۰۹-۰۷): این مقادیر امروز از ثابتِ سمتِ سرور
  // (LOYALTY_TIERS) می‌آیند و کاربر کنترلشان نمی‌کند، پس این رفعِ یک باگِ
  // فعلاً واقعی نیست — دفاعِ لایه‌دوم است، همان قاعده‌ای که بقیه‌ی سینک‌های
  // API-محور در این مخزن رعایت می‌کنند. امنیت **به‌واسطه‌ی منشأ** یک فرض است
  // که با تغییرِ یک endpoint بی‌صدا می‌شکند؛ esc فرض را حذف می‌کند.
  const nextLine=next_tier
    ? `${fmtFa(points_to_next)} امتیاز تا سطحِ ${esc(next_tier.name)} (${esc(next_tier.emoji)})`
    : 'به بالاترین سطح رسیدی 🎉';

  root.innerHTML=`<div class="wrap section">
    <div class="loy-card"><div class="loy-card-mesh"></div><div class="loy-tier">${esc(tier.emoji)} سطح ${esc(tier.name)}</div><div class="loy-pts"><span id="loyPts" class="loy-pts-num">${fmtFa(points)}</span> <span style="font-size:20px;font-weight:600;opacity:.9">امتیاز</span></div><div class="loy-next">${nextLine}</div><div class="loy-prog"><div class="loy-prog-fill" style="width:0" data-w="${esc(progress_pct)}"></div></div></div>

    <!-- ⚠️ این جمله یک **وعده** است، پس پیش از نوشتنش ساختارِ داده بررسی شد
         (۲۰۲۶-۰۹-۰۷): مدلِ PointsLedger هیچ ستونِ انقضا ندارد — فقط
         delta/reason/createdAt و append-only است؛ ClubMember.points هم نه؛ و
         هیچ کرونی در api/src/app/api/v1/maintenance/ امتیاز را کم نمی‌کند.
         پس «منقضی نمی‌شود» یک ادعای بازاریابی نیست، خاصیتِ ساختاری است.
         اگر روزی انقضا اضافه شد، این خط باید هم‌زمان برداشته شود. -->
    <div class="loy-noexpire reveal">${icon('check',{size:14})} امتیازهات هیچ‌وقت منقضی نمی‌شن — نه بعدِ یک سال، نه هیچ‌وقت.</div>

    <!-- ⚠️ A1-005 (۲۰۲۶-۰۹-۱۰): عددِ «۵۰۰ امتیاز» از این‌جا برداشته شد.
         «completeReferral» (api/src/lib/loyalty.ts:610) **صفر صداکننده** در
         «api/src» دارد — خودم شمردم، نه از روی گزارش. پس دعوت ثبت می‌شود
         ولی پاداش هرگز پرداخت نمی‌شود.
         این همان کلاسِ «cbVipPct=12» و «MERGE_UNAVAILABLE» است: آرتیفکت
         قابلیتی را ادعا می‌کند که مکانیزم ندارد. نرم‌کردنِ جمله رفعِ غلط
         بود؛ عدد باید می‌رفت.
         ⚠️ جریانِ دعوت **عمداً دست‌نخورده** ماند: «createReferral» ردیفِ
         «pending» می‌سازد و «completeReferral» روی همان مچ می‌کند، پس
         دعوت‌های امروز روزی که پرداخت وصل شود قابلِ پرداختِ عقب‌افتاده‌اند.
         ⚠️ این خط تا وقتی برنگردد که پرداخت **واقعاً** سیم‌کشی شده باشد. -->
    <!-- دعوت دوستان -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openReferral()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#A78BFA,#7C3AED)">${icon('gift',{size:20})}</div>
      <div class="lac-body"><div class="lac-title">دوستات رو دعوت کن</div><div class="lac-sub">دعوت‌هات ثبت می‌شن</div></div>
      <span class="lac-arrow">›</span>
    </div>
    <!-- کارت هدیه -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openGiftCards()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#FBBF24,#F59E0B)">${icon('creditCard',{size:20})}</div>
      <div class="lac-body"><div class="lac-title">کارت هدیه</div><div class="lac-sub">هدیه‌ی خاص به عزیزانت بده</div></div>
      <span class="lac-arrow">›</span>
    </div>
    <!-- پاداش تولد/سالگرد -->
    <div class="loy-action-card reveal" role="button" tabindex="0" onclick="buzz&&buzz();openRewardsDates()">
      <div class="lac-icon" style="background:linear-gradient(135deg,#F472B6,#DB2777)">${icon('calendar',{size:20})}</div>
      <div class="lac-body"><div class="lac-title">پاداش تولد و سالگرد</div><div class="lac-sub">۱۰۰۰ امتیاز هدیه در روز خاصت</div></div>
      <span class="lac-arrow">›</span>
    </div>

    <div class="section-head reveal" style="margin-top:32px"><div class="section-title">مزایای تو</div></div>
    <div class="perks reveal">${PERKS.map(p=>`<div class="perk"><div class="perk-emoji">${p[0]}</div><div class="perk-name">${p[1]}</div><div class="perk-desc">${p[2]}</div></div>`).join('')}</div>
    <div class="section-head reveal" style="margin-top:32px"><div class="section-title">نشان‌ها</div></div>
    <div class="badge-grid reveal">${badges.map(b=>`<div class="bdg ${b.earned?'earned':'locked'}"><div class="bdg-emoji">${esc(b.emoji)}</div><div class="bdg-name">${esc(b.name)}</div><div class="bdg-desc">${b.earned?`${icon('check',{size:12})} کسب شد`:'قفل'}</div></div>`).join('')}</div>
  </div>`;
  setTimeout(()=>{const f=document.querySelector('.loy-prog-fill');if(f)f.style.width=f.dataset.w+'%'},300);
  // شمارشِ متحرکِ امتیاز (حسِ دستاورد)
  const pe=document.getElementById('loyPts');
  if(pe&&points>0){const t0=performance.now(),dur=900;const tk=(nw)=>{const p=Math.min(1,(nw-t0)/dur),e=1-Math.pow(1-p,3);pe.textContent=fmtFa(Math.round(points*e));if(p<1)requestAnimationFrame(tk);};requestAnimationFrame(tk);}
  armReveals&&armReveals();
}
// ── دعوت دوستان (Referral) ──
