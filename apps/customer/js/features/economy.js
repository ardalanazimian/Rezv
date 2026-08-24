// ═══ رزرونو — اقتصادِ مشتری: اعتبارِ رزرو + ماموریت‌ها + فروشگاهِ جایزه ═══
//  ⚠️ عمداً از سیستمِ «باشگاه/سطحِ وفاداری» (loyalty.js) جداست — دو محورِ
//  کاملاً متفاوت: وفاداری = چقدر خرج/بازدید کردی (از PointsLedger)، این‌جا =
//  چقدر قابلِ‌اعتمادی (کم‌کنسلی/no-show، از CustomerEconomyProfile). عمداً
//  نه اسم مشترک («سطح») نه ایموجیِ مشترک (🥉🥈🥇💎) با وفاداری استفاده نمی‌شه
//  تا کاربر این دو رو یکی فرض نکنه.
import { API, isLoggedIn } from '../api.js';
import { fmtFa } from '../data/discover.js';
import { armReveals, buzz } from '../theme-pwa.js';
import { esc, openSheet, toast } from '../auth.js';
import { icon } from '../icons.js';

// نمادِ اعتبار — عمداً آیکونِ SVG (نه ایموجی) و اسمِ متفاوت از tierهایِ وفاداری.
const REPUTATION_BADGE = {
  bronze:   null, // مهمانِ تازه — هنوز نشانی نداره، چیزی نمایش داده نمی‌شه
  silver:   { name:'مهمانِ معتبر',  ic:'star',   grad:'linear-gradient(135deg,#2DD4BF,#0D9488)' },
  gold:     { name:'مهمانِ ممتاز',  ic:'shield', grad:'linear-gradient(135deg,#818CF8,#4F46E5)' },
  platinum: { name:'مهمانِ نمونه',  ic:'crown',  grad:'linear-gradient(135deg,#C084FC,#7C3AED)' },
};

function missionCard(m){
  const pct = Math.round((m.progress / Math.max(1,m.target_count)) * 100);
  const rewardBits = [];
  if (m.xp_reward > 0) rewardBits.push(`${fmtFa(m.xp_reward)} تجربه`);
  if (m.wallet_reward > 0) rewardBits.push(`${fmtFa(m.wallet_reward)} سکه`);
  if (m.strike_relief > 0) rewardBits.push('ترمیمِ اعتبار');
  const btn = m.claimed
    ? `<span class="mission-claimed">${icon('checkCircle',{size:14})} دریافت شد</span>`
    : m.completed
      ? `<button class="btn btn-primary btn-sm" onclick="claimMission('${m.id}')">دریافتِ جایزه</button>`
      : `<span class="mission-progress-label">${fmtFa(m.progress)}/${fmtFa(m.target_count)}</span>`;
  return `<div class="loy-action-card reveal" style="align-items:flex-start;cursor:default">
    <div class="lac-icon" style="background:linear-gradient(135deg,#FBBF24,#F59E0B)">${icon('sparkle',{size:20})}</div>
    <div class="lac-body" style="flex:1">
      <div class="lac-title">${esc(m.title)}</div>
      ${m.description ? `<div class="lac-sub">${esc(m.description)}</div>` : ''}
      <div class="loy-prog" style="margin-top:8px"><div class="loy-prog-fill" style="width:${pct}%;background:${m.completed?'var(--success,#16A34A)':undefined}"></div></div>
      <div class="lac-sub" style="margin-top:6px">${rewardBits.join(' + ')}</div>
    </div>
    <div style="align-self:center">${btn}</div>
  </div>`;
}

function rewardCard(it){
  const locked = !it.unlocked;
  const disabled = locked || !it.in_stock;
  return `<div class="bdg ${locked?'locked':'earned'}" style="text-align:${locked?'center':'right'}">
    <div class="bdg-emoji">${icon(it.kind==='gift_card_credit'?'creditCard':it.kind==='priority_boost'?'trending':'gift',{size:26})}</div>
    <div class="bdg-name">${it.title}</div>
    <div class="bdg-desc">${fmtFa(it.cost_coins)} سکه${!it.in_stock?' — موجودی تمام شد':locked?` — نیازِ ${REPUTATION_BADGE[it.min_tier]?.name || 'سطحِ بالاتر'}`:''}</div>
    <button class="btn btn-secondary btn-sm" style="margin-top:10px;width:100%" ${disabled?'disabled':''} onclick="redeemReward('${it.id}')">خرج کن</button>
  </div>`;
}

export async function renderEconomy(){
  const root=document.getElementById('page-economy');
  if(!root)return;

  if(!isLoggedIn()){
    root.innerHTML=`<div class="wrap section">
      <div style="text-align:center;padding:40px 20px">
        <div class="login-icon" style="margin-bottom:var(--sp-5)">${icon('shield',{size:40})}</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px">هنوز وارد نشدی</div>
        <div style="color:var(--t2);font-size:14px;margin-bottom:24px;line-height:1.6">برایِ دیدنِ اعتبار، ماموریت‌ها و فروشگاهِ جایزه وارد شو</div>
        <button class="btn btn-primary btn-lg btn-block" onclick="openLogin()">ورود / ثبت‌نام</button>
      </div>
    </div>`;
    armReveals&&armReveals();
    return;
  }

  root.setAttribute('aria-busy','true');
  root.innerHTML=`<div class="wrap section">
    <div class="loy-card" aria-hidden="true">
      <div class="sk" style="height:16px;width:120px;border-radius:6px"></div>
      <div class="sk" style="height:34px;width:150px;margin-top:16px;border-radius:8px"></div>
    </div>
  </div>`;

  const [econRes, missionsRes, rewardsRes] = await Promise.all([
    API.get('/me/economy'), API.get('/me/missions'), API.get('/me/rewards'),
  ]);
  root.removeAttribute('aria-busy');

  if(!econRes.ok || !econRes.data){
    root.innerHTML=`<div class="wrap section"><div class="empty-state"><div class="empty-state-icon">${icon('alert',{size:44})}</div><div class="empty-state-title">اطلاعاتِ اقتصاد بارگذاری نشد</div><div class="empty-state-desc">اتصالت رو چک کن و دوباره امتحان کن</div></div></div>`;
    armReveals&&armReveals();
    return;
  }

  const econ = econRes.data;
  const missions = (missionsRes.ok && missionsRes.data?.missions) || [];
  const rewards = (rewardsRes.ok && rewardsRes.data?.items) || [];
  const badge = REPUTATION_BADGE[econ.reputation_tier];

  const repBlock = badge
    ? `<div class="loy-card" style="background:${badge.grad}"><div class="loy-card-mesh"></div>
        <div class="loy-tier">${icon(badge.ic,{size:18})} ${badge.name}</div>
        <div class="loy-next" style="margin-top:8px">این نشان بر اساسِ سابقه‌ی رزرو‌هایِ به‌موقعِ توئه — به رستوران‌ها هم نشون داده می‌شه</div>
      </div>`
    : `<div class="loy-card"><div class="loy-card-mesh"></div>
        <div class="loy-tier">${icon('sparkle',{size:18})} مهمانِ تازه</div>
        <div class="loy-next" style="margin-top:8px">با تکمیلِ رزروهات (بدونِ کنسلیِ دیروقت/عدمِ حضور) اعتبار می‌سازی</div>
      </div>`;

  root.innerHTML=`<div class="wrap section">
    ${repBlock}

    <div class="econ-balances">
      <div class="loy-action-card reveal" style="cursor:default">
        <div class="lac-icon" style="background:linear-gradient(135deg,#FBBF24,#F59E0B)">${icon('wallet',{size:20})}</div>
        <div class="lac-body"><div class="lac-title">${fmtFa(econ.wallet_balance)} سکه</div><div class="lac-sub">خرجش کن در فروشگاهِ جایزه — جدا از امتیازِ باشگاه</div></div>
      </div>

      <div class="loy-action-card reveal" style="cursor:default">
        <div class="lac-icon" style="background:linear-gradient(135deg,#6366F1,#4F46E5)">${icon('sparkle',{size:20})}</div>
        <div class="lac-body"><div class="lac-title">${fmtFa(econ.xp_total)} تجربه</div><div class="lac-sub">با هر رزروِ سرِوقت و هر ماموریت بالا می‌ره</div></div>
      </div>
    </div>

    ${missions.length ? `<div class="section-head reveal" style="margin-top:32px"><div class="section-title">ماموریت‌ها</div></div>
    ${missions.map(missionCard).join('')}` : ''}

    ${rewards.length ? `<div class="section-head reveal" style="margin-top:32px"><div class="section-title">فروشگاهِ جایزه</div></div>
    <div class="badge-grid reveal">${rewards.map(rewardCard).join('')}</div>` : ''}
  </div>`;
  armReveals&&armReveals();
}

window.claimMission = async function(id){
  buzz&&buzz();
  const res = await API.post(`/me/missions/${id}/claim`, {});
  if(res.ok){ toast('🎉','جایزه دریافت شد'); renderEconomy(); }
  else toast('', res.error?.message || 'دریافتِ جایزه ناموفق بود');
};

// ⚠️ رفعِ ارزشِ گم‌شده (پروتکل §۱۰/§۱۶): قبلاً پاسخِ سرور کاملاً دور ریخته
// می‌شد و فقط «✅ خریداری شد» نشان داده می‌شد. برایِ جوایزی که کوپن یا کارتِ
// هدیه تولید می‌کنند، **کد** تنها راهِ خرج‌کردن است و هیچ فهرستِ «کارت‌های من»
// در اپ وجود ندارد؛ یعنی سکه‌ی واقعی خرج می‌شد و دارایی عملاً دست‌نیافتنی
// می‌ماند. حالا کد بلافاصله نمایش داده و در کلیپ‌بورد کپی می‌شود.
window.redeemReward = async function(id){
  buzz&&buzz();
  const res = await API.post(`/me/rewards/${id}/redeem`, {});
  if(!res.ok){ toast('', res.error?.message || 'خرید ناموفق بود'); return; }
  const d = res.data || {};
  const code = d.result_gift_card_code || d.result_coupon_code || null;
  if(code) showRedeemedCode(code, d.result_gift_card_code ? 'کارتِ هدیه' : 'کدِ تخفیف');
  else toast('✅','خریداری شد');
  renderEconomy();
};

/** نمایشِ کدِ به‌دست‌آمده — همان کارتِ کد و همان `copyCode` که شیتِ کارتِ هدیه
 *  از قبل استفاده می‌کند (بدونِ کامپوننتِ تازه — §۲۲ «اول استفاده‌ی دوباره»). */
function showRedeemedCode(code, label){
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div style="margin-bottom:var(--sp-2);color:var(--success)">${icon('check',{size:40})}</div>
    <div class="sheet-title" style="text-align:center">${esc(label)} آماده‌ست</div>
    <div class="gift-success-card"><div class="gsc-code">${esc(code)}</div></div>
    <div class="sheet-sub" style="text-align:center;margin-top:12px">این کد را نگه دار — هنگامِ پرداخت واردش کن</div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="copyCode('${esc(code)}')">کپی کد</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
  </div>`);
}
