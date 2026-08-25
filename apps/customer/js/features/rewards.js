// ═══ رزرونو — دعوت دوستان، کارت هدیه، پاداش تولد (بخشی از اپ کاستومر) ═══
import { API, USER, isLoggedIn, setUSER } from '../api.js';
import { closeSheet, esc, jsq, openSheet, toast } from '../auth.js';
import { copyCode } from '../data/booking.js';
import { icon } from '../icons.js';
import { fmtFa } from '../data/discover.js';
export async function openReferral(){
  let stats={code:'REF••••',total_invited:0,completed:0,points_earned:0};
  if(isLoggedIn()){const res=await API.get('/me/referral');if(res.ok&&res.data?.code)stats=res.data;}
  openSheet(`<div style="text-align:center;padding:4px 0">
    <div style="margin-bottom:var(--sp-2);color:var(--brand-500)">${icon('gift',{size:40})}</div>
    <div class="sheet-title" style="text-align:center">دوستات رو دعوت کن</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:18px">برای هر دوستی که با کد تو ثبت‌نام کنه و اولین رزروش رو انجام بده، ۵۰۰ امتیاز بگیر</div>
    <div class="ref-code-box"><div class="ref-code-label">کد دعوت تو</div><div class="ref-code">${esc(stats.code)}</div>
      <button class="ref-copy" onclick="copyCode(${jsq(stats.code)})">کپی</button></div>
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
  // ⚠️ نقضِ §۳: هر دو مسیرِ «شکست» به همان خطِ پایانی می‌ریختند که
  // «دعوت ارسال شد» می‌گفت و شیت را می‌بست — یعنی هم وقتی شبکه قطع بود و هم
  // وقتی کاربر اصلاً لاگین نبود (که هیچ درخواستی هم نمی‌رفت). هیچ پیامکی
  // ارسال نشده بود و هیچ دعوتی ثبت نشده بود.
  if(!isLoggedIn()){
    toast('⚠️','برای دعوتِ دوستان اول باید وارد حساب بشی');
    return;
  }
  const res=await API.post('/me/referral',{phone});
  if(res.ok){toast('','دعوت با پیامک ارسال شد');closeSheet();return;}
  toast('⚠️', res.offline ? 'اتصال برقرار نیست — دعوت ارسال نشد' : (res.error?.message||'ارسالِ دعوت ناموفق بود'));
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
  // ⚠️ نقضِ §۳ که تا Batch 17 زنده مانده بود: در حالتِ آفلاین یک کدِ کاملاً
  // ساختگی با Math.random ساخته می‌شد و شیتِ «کارت هدیه ساخته شد!» با همان کد
  // و جمله‌ی «کد برای گیرنده پیامک شد» باز می‌شد. هیچ کارتی وجود نداشت، هیچ
  // پیامکی نرفته بود، و کاربر می‌توانست همان کدِ اختراعی را برایِ گیرنده بفرستد
  // که موقعِ استفاده نامعتبر از آب درمی‌آمد. قطعیِ شبکه هرگز حقیقتِ کسب‌وکار
  // نمی‌سازد — به‌خصوص وقتی پایِ پول در میان است.
  if(res.ok&&res.data?.code){
    showGiftSuccess(res.data.code,giftAmt,!!recipient_phone);
  }else if(res.offline){
    toast('⚠️','اتصال برقرار نیست — کارت هدیه ساخته نشد. بعداً دوباره تلاش کن');
  }else{toast('',res.error?.message||'خطا در خرید');}
}
// smsSent: ادعایِ پیامک باید با کارِ واقعیِ سرور بخواند. بک‌اند فقط وقتی
// پیامک می‌فرستد که گیرنده شماره داشته باشد (lib/loyalty.ts — `if (opts.recipientPhone)`)،
// ولی این شیت آن را **بی‌قید** ادعا می‌کرد.
export function showGiftSuccess(code,amt,smsSent){
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div style="margin-bottom:var(--sp-2);color:var(--success)">${icon('checkCircle',{size:48})}</div>
    <div class="sheet-title" style="text-align:center">کارت هدیه ساخته شد!</div>
    <div class="gift-success-card"><div class="gsc-amt">${fmtFa(Math.round(amt/1000))} هزار تومان</div><div class="gsc-code">${esc(code)}</div></div>
    <div class="sheet-sub" style="text-align:center;margin-top:12px">${smsSent?'کد برای گیرنده پیامک شد':'کد را خودت به گیرنده برسان'}</div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="copyCode(${jsq(code)})">کپی کد</button>
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
      <div class="gc-status">${d.valid?`${icon('check',{size:13})} فعال و قابل‌استفاده`:`${icon('close',{size:13})} غیرفعال یا منقضی`}</div></div>`;
  }else if(res.offline){
    // ⚠️ رفعِ جعلِ موجودی (فازِ ۲، §۳ — «fake payment confirmation» صریحاً ممنوع):
    // این شاخه قبلاً یک موجودیِ ساختگیِ «۵۰۰ هزار تومان · فعال» نشان می‌داد.
    // برچسبِ «(دمو)» کافی نیست: عدد کنارِ تیکِ سبز، ادعایِ ارزشِ مالیِ واقعی است.
    el.innerHTML=`<div class="gift-check invalid"><div class="gc-status">اتصال به سرور برقرار نشد — موجودی خوانده نشد</div></div>`;
  }else{el.innerHTML=`<div class="gift-check invalid"><div class="gc-status">کارت پیدا نشد</div></div>`;}
}
// ═══════════════════════════════════════════════════════════════════════
//  پاداشِ تولد — رفعِ جعلِ موفقیت (فازِ ۲، پروتکل §۳ و §۱۱)
//
//  نسخه‌ی قبلی فقط خالی‌نبودنِ ورودی را چک می‌کرد و مستقیم
//  `toast('✅','تاریخ‌ها ذخیره شد …')` می‌زد — **بدونِ هیچ درخواستی به سرور**.
//  کامنتِ خودِ کد هم اعتراف می‌کرد («در نسخه‌ی واقعی: PATCH /me …»). کاربر
//  باور می‌کرد تولدش ثبت شده و منتظرِ ۱۰۰۰ امتیازِ هدیه‌ای می‌ماند که هرگز
//  نمی‌آمد — دقیقاً همان الگویی که در waitlist.js/booking.js حذف شد.
//
//  دو تغییرِ عمدیِ دیگر:
//
//  ۱. **ورودیِ متنیِ آزادِ فارسی («مثلاً ۱۵ خرداد») حذف شد.** بک‌اند
//     `birth_date` را به‌صورتِ تاریخِ میلادی ذخیره می‌کند و cronِ هدیه با
//     EXTRACT(month/day) کار می‌کند؛ هیچ مسیرِ قابلِ‌اتکایی برایِ تبدیلِ
//     «۱۵ خرداد» به تاریخِ واقعی وجود ندارد. `<input type="date">` بومی
//     همیشه ISO می‌دهد و روی موبایل انتخابگرِ درست را باز می‌کند.
//
//  ۲. **فیلدِ «سالگرد» حذف شد.** `PATCH /me` فقط
//     first_name/last_name/birth_date را می‌پذیرد؛ `anniversary_date` در کلِ
//     ریپو **هیچ مسیرِ نوشتنی ندارد**. نگه‌داشتنِ ورودی‌ای که بی‌صدا دور
//     ریخته می‌شود، همان دروغِ قبلی است با ظاهرِ دیگر.
// ═══════════════════════════════════════════════════════════════════════
export function openRewardsDates(){
  if(!isLoggedIn()){ toast('','برای ثبتِ تاریخ تولد اول وارد شو'); return; }
  const current = USER?.birthDate ? String(USER.birthDate).slice(0,10) : '';
  openSheet(`<div style="padding:4px 0">
    <div style="text-align:center;margin-bottom:var(--sp-2);color:var(--brand-500)">${icon('calendar',{size:40})}</div>
    <div class="sheet-title" style="text-align:center">پاداش تولد</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:18px">تاریخ تولدت رو ثبت کن تا در اون روز ۱۰۰۰ امتیاز هدیه بگیری</div>
    <label class="rd-label" for="bdayDate">${icon('calendar',{size:14})} تاریخ تولد</label>
    <input id="bdayDate" class="inp" type="date" value="${esc(current)}" max="${new Date().toISOString().slice(0,10)}">
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" onclick="saveRewardDates()">ذخیره</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
  </div>`);
}
export async function saveRewardDates(){
  const bday=document.getElementById('bdayDate')?.value.trim();
  if(!bday){toast('','تاریخ تولدت رو انتخاب کن');return;}

  // patchSchema در بک‌اند first_name را **اجباری** می‌خواهد؛ اگر نداریم،
  // درخواست با ۴۲۲ رد می‌شود. صریح بگو، نه اینکه بی‌صدا شکست بخورد.
  const firstName = USER?.firstName?.trim();
  if(!firstName){ toast('','اول اسمت رو در پروفایل کامل کن'); return; }

  const btn=document.querySelector('#sheetBody .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='در حال ذخیره...';}

  const res=await API.updateProfile({
    first_name: firstName,
    ...(USER?.lastName ? { last_name: USER.lastName } : {}),
    birth_date: bday,
  });

  if(res.ok){
    // مقدارِ برگشتیِ سرور مرجع است، نه ورودیِ محلی.
    if(res.data?.user) setUSER({ ...USER, ...res.data.user, birthDate: res.data.user.birth_date ?? res.data.user.birthDate ?? bday });
    toast('✅','تاریخ تولدت ثبت شد');
    closeSheet();
    return;
  }
  // هیچ مسیرِ جعلی‌ای اینجا نیست (§۳): آفلاین و خطایِ سرور هر دو صریح‌اند.
  toast('', res.offline ? 'اتصال به سرور برقرار نشد — ثبت نشد' : (res.error?.message || 'ثبتِ تاریخ ناموفق بود'));
  if(btn){btn.disabled=false;btn.textContent='ذخیره';}
}
// ═══════════════════════════════════════════════════════════


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openReferral = openReferral;
window.sendInvite = sendInvite;
window.openGiftCards = openGiftCards;
window.selectGiftAmt = selectGiftAmt;
// ⚠️ کنترلِ مرده (همان کلاس): `#giftCustom` با
// `oninput="selectCustomAmt(this.value)"` رندر می‌شود ولی تابع روی window نبود
// — یعنی واردکردنِ مبلغِ دلخواه هیچ‌وقت مبلغ را ست نمی‌کرد و «خرید» با پیامِ
// «مبلغ رو انتخاب کن» رد می‌شد، حتی وقتی کاربر عدد وارد کرده بود.
window.selectCustomAmt = selectCustomAmt;
window.buyGiftCard = buyGiftCard;
window.checkGiftCardUI = checkGiftCardUI;
window.doCheckGift = doCheckGift;
window.openRewardsDates = openRewardsDates;
window.saveRewardDates = saveRewardDates;
