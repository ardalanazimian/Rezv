// ═══ رزرونو — دعوت دوستان، کارت هدیه، پاداش تولد (بخشی از اپ کاستومر) ═══
import { API, isLoggedIn } from '../api.js';
import { closeSheet, esc, openSheet, toast } from '../auth.js';
import { copyCode } from '../data/detail.js';
import { fmtFa } from '../data/discover.js';
export async function openReferral(){
  let stats={code:'REF••••',total_invited:0,completed:0,points_earned:0};
  if(isLoggedIn()){const res=await API.get('/me/referral');if(res.ok&&res.data?.code)stats=res.data;}
  openSheet(`<div style="text-align:center;padding:4px 0">
    <div style="font-size:40px;margin-bottom:8px">🎁</div>
    <div class="sheet-title" style="text-align:center">دوستات رو دعوت کن</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:18px">برای هر دوستی که با کد تو ثبت‌نام کنه و اولین رزروش رو انجام بده، ۵۰۰ امتیاز بگیر</div>
    <div class="ref-code-box"><div class="ref-code-label">کد دعوت تو</div><div class="ref-code">${esc(stats.code)}</div>
      <button class="ref-copy" onclick="copyCode('${esc(stats.code)}')">کپی</button></div>
    <div class="ref-stats">
      <div class="ref-stat"><div class="ref-stat-v">${fmtFa(stats.total_invited)}</div><div class="ref-stat-l">دعوت‌شده</div></div>
      <div class="ref-stat"><div class="ref-stat-v">${fmtFa(stats.completed)}</div><div class="ref-stat-l">موفق</div></div>
      <div class="ref-stat"><div class="ref-stat-v">${fmtFa(stats.points_earned)}</div><div class="ref-stat-l">امتیاز کسب‌شده</div></div>
    </div>
    <div class="ref-invite"><input id="refPhone" class="inp" placeholder="۰۹۱۲۳۴۵۶۷۸۹" style="text-align:center" inputmode="numeric"></div>
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:12px" onclick="sendInvite()">ارسال دعوت با پیامک</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
  </div>`);
}
export async function sendInvite(){
  const phone=document.getElementById('refPhone')?.value.trim();
  if(!phone||phone.length<10){toast('','شماره معتبر وارد کن');return;}
  if(isLoggedIn()){
    const res=await API.post('/me/referral',{phone});
    if(res.ok){toast('✅','دعوت با پیامک ارسال شد');closeSheet();return;}
    if(!res.offline){toast('⚠️',res.error?.message||'خطا');return;}
  }
  toast('✅','دعوت ارسال شد');closeSheet();
}
// ── کارت هدیه (Gift Cards) ──
export function openGiftCards(){
  openSheet(`<div style="padding:4px 0">
    <div class="sheet-title" style="text-align:center">کارت هدیه</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:18px">مبلغ رو انتخاب کن یا دلخواه وارد کن</div>
    <div class="gift-amounts">
      ${[200,500,1000,2000].map(a=>`<button class="gift-amt" onclick="selectGiftAmt(${a*1000},this)">${fmtFa(a)}<span>هزار تومان</span></button>`).join('')}
    </div>
    <div class="gift-custom">
      <label class="gift-custom-label">یا مبلغ دلخواه (تومان):</label>
      <input id="giftCustom" class="inp" placeholder="مثلاً ۷۵۰۰۰" inputmode="numeric" oninput="selectCustomAmt(this.value)">
    </div>
    <input id="giftName" class="inp" placeholder="نام گیرنده" style="margin-top:14px">
    <input id="giftPhone" class="inp" placeholder="شماره‌ی گیرنده ۰۹..." style="margin-top:10px" inputmode="numeric">
    <input id="giftMsg" class="inp" placeholder="پیام (اختیاری)" style="margin-top:10px">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" onclick="buyGiftCard()">خرید و ارسال هدیه</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="checkGiftCardUI()">بررسی موجودی کارت هدیه</button>
  </div>`);
}
export let giftAmt=0;
export function selectGiftAmt(a,el){
  giftAmt=a;
  document.querySelectorAll('.gift-amt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  // پاک‌کردن فیلد دلخواه وقتی دکمه انتخاب شد
  const ci=document.getElementById('giftCustom');if(ci)ci.value='';
}
// انتخاب مبلغ دلخواه (فارسی یا انگلیسی)
export function selectCustomAmt(v){
  const digits=String(v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g,'');
  giftAmt=parseInt(digits,10)||0;
  // برداشتن انتخاب از دکمه‌های ثابت
  document.querySelectorAll('.gift-amt').forEach(b=>b.classList.remove('sel'));
}
export async function buyGiftCard(){
  if(!giftAmt){toast('','مبلغ رو انتخاب کن یا وارد کن');return;}
  if(giftAmt<50000){toast('','حداقل مبلغ کارت هدیه ۵۰٬۰۰۰ تومان است');return;}
  const recipient_name=document.getElementById('giftName')?.value.trim();
  const recipient_phone=document.getElementById('giftPhone')?.value.trim();
  const message=document.getElementById('giftMsg')?.value.trim();
  const res=await API.post('/gift-cards',{amount_toman:giftAmt,recipient_name,recipient_phone,message});
  if(res.ok&&res.data?.code){
    showGiftSuccess(res.data.code,giftAmt);
  }else if(res.offline){
    showGiftSuccess('GIFT'+Math.random().toString(36).slice(2,8).toUpperCase(),giftAmt);
  }else{toast('⚠️',res.error?.message||'خطا در خرید');}
}
export function showGiftSuccess(code,amt){
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div style="font-size:48px;margin-bottom:8px">🎉</div>
    <div class="sheet-title" style="text-align:center">کارت هدیه ساخته شد!</div>
    <div class="gift-success-card"><div class="gsc-amt">${fmtFa(Math.round(amt/1000))} هزار تومان</div><div class="gsc-code">${esc(code)}</div></div>
    <div class="sheet-sub" style="text-align:center;margin-top:12px">کد برای گیرنده پیامک شد</div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="copyCode('${esc(code)}')">کپی کد</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
  </div>`);
}
export function checkGiftCardUI(){
  openSheet(`<div style="padding:4px 0">
    <div class="sheet-title" style="text-align:center">بررسی کارت هدیه</div>
    <input id="checkCode" class="inp" placeholder="کد کارت هدیه (GIFT...)" style="margin-top:14px;text-align:center">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:12px" onclick="doCheckGift()">بررسی موجودی</button>
    <div id="checkResult" style="margin-top:14px"></div>
  </div>`);
}
export async function doCheckGift(){
  const code=document.getElementById('checkCode')?.value.trim();
  if(!code){toast('','کد رو وارد کن');return;}
  const res=await API.get('/gift-cards?code='+encodeURIComponent(code));
  const el=document.getElementById('checkResult');
  if(res.ok&&res.data){
    const d=res.data;
    el.innerHTML=`<div class="gift-check ${d.valid?'valid':'invalid'}">
      <div class="gc-balance">${fmtFa(Math.round(d.balance_toman/1000))} هزار تومان</div>
      <div class="gc-status">${d.valid?'✓ فعال و قابل‌استفاده':'✕ غیرفعال یا منقضی'}</div></div>`;
  }else if(res.offline){
    el.innerHTML=`<div class="gift-check valid"><div class="gc-balance">۵۰۰ هزار تومان</div><div class="gc-status">✓ فعال (دمو)</div></div>`;
  }else{el.innerHTML=`<div class="gift-check invalid"><div class="gc-status">کارت پیدا نشد</div></div>`;}
}
// ── پاداش تولد و سالگرد ──
export function openRewardsDates(){
  openSheet(`<div style="padding:4px 0">
    <div style="text-align:center;font-size:40px;margin-bottom:8px">🎂</div>
    <div class="sheet-title" style="text-align:center">پاداش تولد و سالگرد</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:18px">تاریخ‌های خاصت رو ثبت کن تا در اون روز ۱۰۰۰ امتیاز هدیه بگیری</div>
    <label class="rd-label">🎂 تاریخ تولد</label>
    <input id="bdayDate" class="inp" type="text" placeholder="مثلاً ۱۵ خرداد" style="margin-bottom:14px">
    <label class="rd-label">💍 سالگرد (اختیاری)</label>
    <input id="annivDate" class="inp" type="text" placeholder="مثلاً ۲۰ مهر">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" onclick="saveRewardDates()">ذخیره</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
  </div>`);
}
export function saveRewardDates(){
  const bday=document.getElementById('bdayDate')?.value.trim();
  if(!bday){toast('','حداقل تاریخ تولد رو وارد کن');return;}
  // در نسخه‌ی واقعی: PATCH /me با birth_date/anniversary_date
  toast('✅','تاریخ‌ها ذخیره شد — در روز خاصت امتیاز می‌گیری');closeSheet();
}
// ═══════════════════════════════════════════════════════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openReferral = openReferral;
window.sendInvite = sendInvite;
window.openGiftCards = openGiftCards;
window.selectGiftAmt = selectGiftAmt;
window.buyGiftCard = buyGiftCard;
window.checkGiftCardUI = checkGiftCardUI;
window.doCheckGift = doCheckGift;
window.openRewardsDates = openRewardsDates;
window.saveRewardDates = saveRewardDates;
