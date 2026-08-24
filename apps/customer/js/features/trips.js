// ═══ رزرونو — سفرها: تقویم، کیف پول، QR، رزرو مجدد (بخشی از اپ کاستومر) ═══
// ── Calendar Sync: تولید فایل .ics واقعی ──
import { API, isLoggedIn } from '../api.js';
import { icon } from '../icons.js';
import { closeSheet, esc, openSheet, toast, undoSnack } from '../auth.js';
import { openRest } from '../data/detail.js';
import { go } from '../data/discover.js';
import { R } from '../init.js';
// ⚠️ رفع‌شده (R2 — حسابرسیِ تقویم، ۲۰۲۶-۰۸-۱۴): این تابع همیشه «فردا» فرض
// می‌کرد (setDate(+1))، بدونِ توجه به اینکه پارامترِ date واقعاً چه بود —
// یعنی رزروِ ۱۵ خرداد یا ماهِ بعد، همیشه با تاریخِ «فردا» به تقویمِ کاربر
// اضافه می‌شد. حالا slotStartIso (زمانِ خامِ سرور، در reservation.js
// اضافه شد) منبعِ حقیقت است؛ اگر نبود/نامعتبر بود، دیگر چیزی اختراع
// نمی‌کنیم — فقط صادقانه می‌گیم که نمی‌دونیم.
export function addToCalendar(code,name,date,time,slotStartIso){
  const dt = slotStartIso ? new Date(slotStartIso) : null;
  if(!dt || isNaN(dt.getTime())){
    toast('','تاریخِ دقیقِ این رزرو در دسترس نیست — نمی‌شه فایلِ تقویم ساخت');
    return;
  }
  // ساخت یک رویداد iCalendar استاندارد (سازگار با Apple/Google Calendar)
  const start=icsDate(dt);
  const end=icsDate(new Date(dt.getTime()+2*3600*1000)); // ۲ ساعت
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RezervoNo//FA','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${code}@rezervno.ir`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${start}`,`DTEND:${end}`,
    `SUMMARY:رزرو ${name}`,`DESCRIPTION:کد رزرو: ${code}`,`LOCATION:${name}`,
    'BEGIN:VALARM','TRIGGER:-PT2H','ACTION:DISPLAY','DESCRIPTION:یادآوری رزرو','END:VALARM',
    'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`rezervno-${code}.ics`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('','فایل تقویم دانلود شد — بازش کن تا اضافه شه');
}
export function icsDate(d){return d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';}
// ── کیف پول (Apple/Google Wallet) ──
export function addToWallet(code,name,date,time,kind){
  // Apple Wallet واقعی به فایل .pkpass امضاشده با گواهی توسعه‌دهنده نیاز دارد
  // (که در سرور تولید می‌شود). اینجا کارت پاس‌مانند را نمایش می‌دهیم.
  const isApple=kind==='apple';
  openSheet(`<div class="wallet-pass ${isApple?'wp-apple':'wp-google'}">
    <div class="wp-top"><span class="wp-brand">رزرونو</span><span class="wp-logo">${isApple?'':icon('ticket',{size:18})}</span></div>
    <div class="wp-rest">${esc(name)}</div>
    <div class="wp-row"><div><div class="wp-lbl">تاریخ</div><div class="wp-val">${esc(date)}</div></div>
      <div><div class="wp-lbl">ساعت</div><div class="wp-val">${esc(time)}</div></div></div>
    <div class="wp-qr" id="walletQrBox">${qrPlaceholder()}</div>
    <div class="wp-code">${esc(code)}</div>
  </div>
  <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" onclick="${isApple?`toast('','برای افزودن واقعی، سرور فایل pkpass امضاشده می‌سازد')`:`toast('','لینک Google Wallet در نسخه‌ی سرور فعال می‌شود')`}">${isApple?' افزودن به Apple Wallet':'افزودن به Google Wallet'}</button>
  <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>`);
  loadReservationQr('walletQrBox', code, 360);
}
// ── QR Check-in: کدِ رزرو را به میزبان نشان بده ──
export function showCheckInQR(code,name){
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div class="sheet-title" style="text-align:center">ورود با QR</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:20px">این کد رو موقع ورود به ${esc(name)} نشون بده</div>
    <div class="checkin-qr" id="checkinQrBox">${qrPlaceholder()}</div>
    <div class="checkin-code">${esc(code)}</div>
    <div class="checkin-hint">میزبان با اسکن این کد، ورودت رو ثبت می‌کنه</div>
  </div>
  <button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="closeSheet()">بستن</button>`);
  loadReservationQr('checkinQrBox', code, 360);
}
// ═══════════════════════════════════════════════════════════════════════
//  QRِ کدِ رزرو — از سرور، واقعی و قابلِ‌اسکن
//
//  ⚠️ اینجا قبلاً تابعی به نامِ `qrSVG` بود که **QR نبود**: یک الگویِ
//  شبه‌تصادفی از hashِ متن، با سه مربعِ گوشه که شبیهِ finder pattern دیده
//  می‌شد. کامنتِ خودش هم می‌گفت «نمایشی؛ در تولید از کتابخانه‌ی QR».
//
//  یعنی دکمه‌ی «QR ورود» و کارتِ کیفِ پول تصویری نشان می‌دادند که هیچ
//  اسکنری نمی‌خواند. مهمان آن را جلویِ میزبان می‌گرفت و هیچ اتفاقی
//  نمی‌افتاد — دقیقاً همان «دادهٔ جعلی که باید واقعی باشد».
//
//  حالا از `GET /reservations/:code/qr` می‌آید که با کتابخانه‌ی جاافتاده
//  ساخته می‌شود. اپِ مشتری build ندارد و نمی‌تواند کتابخانه را import کند،
//  پس تولید سمتِ سرور است — همان تصمیمی که برایِ QRِ منو و QRِ میز گرفته شد.
// ═══════════════════════════════════════════════════════════════════════

/** جاینگه‌دار تا وقتی SVGِ واقعی از سرور برسد. */
export function qrPlaceholder(){
  return `<div class="qr-loading" style="display:flex;align-items:center;justify-content:center;min-height:120px;color:var(--t3);font-size:12px">در حال ساختِ کد…</div>`;
}

/**
 * QRِ واقعی را می‌گیرد و در `boxId` می‌نشاند.
 *
 * شکست هیچ‌وقت شیت را نمی‌شکند: کدِ رزرو به‌صورتِ متن هم زیرِ QR هست، پس
 * مهمان همیشه چیزی برایِ نشان‌دادن دارد حتی وقتی شبکه قطع است.
 */
export async function loadReservationQr(boxId, code, size){
  const box = document.getElementById(boxId);
  if(!box) return;
  const res = await API.reservationQrSvg(code, size || 360);
  if(!res.ok){
    box.innerHTML = `<div style="color:var(--t3);font-size:12px;text-align:center;padding:16px 8px">
      ${esc(res.offline ? 'برای ساختِ کد به اینترنت نیاز است — کدِ زیر را نشان بده' : 'کد ساخته نشد — کدِ زیر را نشان بده')}
    </div>`;
    return;
  }
  // SVG از APIِ خودمان می‌آید و محتوایش کدِ رزروی است که سرور تأیید کرده
  // متعلق به همین کاربر است — ورودیِ کاربر داخلش نیست.
  box.innerHTML = `<div style="background:#fff;border-radius:8px;padding:8px;display:inline-block">
    <style>#${boxId} svg{width:100%;height:auto;max-width:200px;display:block}</style>
    ${res.data.svg}
  </div>`;
}
// ── رزرو مجدد (پیش‌پرکردن با همان رستوران) ──
export function repeatReservation(rid){
  const r=R.find(x=>String(x.id)===String(rid));
  if(!r){toast('','رستوران پیدا نشد');return;}
  go('rest');openRest(rid);
  toast('','اطلاعات رزرو قبلی آماده‌ست — فقط زمان رو انتخاب کن');
}
// لغو رزرو (متصل به API اگر آنلاین)
export async function cancelTrip(code,btn){
  const tripEl=btn.closest('.trip-card')||btn.closest('.trip');
  // Undoِ امن: کارت فوراً کم‌رنگ می‌شود، ولی لغوِ واقعی ۵ ثانیه به تعویق می‌افتد.
  if(tripEl)tripEl.style.opacity=.5;
  undoSnack('رزرو لغو شد',
    ()=>{ if(tripEl)tripEl.style.opacity=''; },   // Undo: هیچ APIای صدا زده نشده
    async ()=>{                                    // Commit: حالا واقعاً لغو کن
      // ⚠️ نقضِ §۳ (جدی‌ترین موردِ این اپ): در حالتِ آفلاین این شاخه **هیچ
      // کاری نمی‌کرد** — نه خطایی نشان می‌داد و نه محوشدگیِ ردیف را برمی‌گرداند.
      // پس اسنکِ «رزرو لغو شد» رویِ صفحه می‌ماند، رزرو محو به نظر می‌رسید، و
      // سرور هرگز خبردار نمی‌شد. مهمان باور می‌کرد لغو کرده، سرِ قرار نمی‌رفت،
      // و no-show می‌خورد. قطعیِ شبکه هرگز نباید حقیقتِ کسب‌وکار بسازد.
      if(isLoggedIn()){
        const res=await API.post('/reservations/'+encodeURIComponent(code)+'/cancel',{});
        if(res.ok)return;
        if(tripEl)tripEl.style.opacity='';
        toast('⚠️', res.offline
          ? 'اتصال برقرار نیست — رزرو لغو نشد. دوباره تلاش کن'
          : (res.error?.message||'لغو ناموفق بود'));
      }
    });
}


// ═══════════════════════════════════════════════════════════════════════
//  ثبتِ نظر — رفعِ P1-4 (پروتکل §۲۰ قراردادِ API، §۲۸ «no dead buttons»)
//
//  یافته: دکمه‌ی «ثبت نظر» رویِ رزروهایِ تجربه‌شده وجود داشت ولی
//  `openRest(rid)` صدا می‌زد — یعنی فقط صفحه‌ی رستوران را باز می‌کرد و هیچ
//  نظری ثبت نمی‌شد. هم‌زمان `POST /api/v1/me/reviews` در بک‌اند کامل و
//  کارآمد بود ولی **هیچ مصرف‌کننده‌ای نداشت** (grepِ کاملِ اپ: صفر).
//
//  یعنی این «ویژگیِ جدید» نیست؛ وصل‌کردنِ دو سرِ یک قراردادِ از‌قبل‌موجود است
//  و برداشتنِ یک دکمه‌ی دروغین.
//
//  قراردادِ بک‌اند (تأییدشده از رویِ کدِ route، نه فرض):
//    body: { restaurant_id: uuid, reservation_id?: uuid, rating: 1..5,
//            food_rating?, service_rating?, atmosphere_rating?, body?: <=1000 }
//    ۲۰۱ → { ok, review }
//    خطاها: ALREADY_REVIEWED (۴۰۹) · VALIDATION (۴۲۲، رزروِ تکمیل‌نشده)
//           NOT_FOUND (۴۰۴) · FORBIDDEN_TENANT (۴۰۳)
//  بک‌اند خودش نظرِ بدونِ بازدیدِ واقعی را رد می‌کند — اینجا آن قانون
//  بازتولید نمی‌شود (§۲۲)، فقط پیامش صادقانه نمایش داده می‌شود.
// ═══════════════════════════════════════════════════════════════════════
let _reviewStars = 0;

export function openReviewSheet(restaurantId, reservationId, name){
  if(!isLoggedIn()){ toast('','برای ثبت نظر اول وارد شو'); return; }
  _reviewStars = 0;
  openSheet(`
    <div class="bs-head"><div class="bs-title">نظرت درباره‌ی ${esc(name)}</div>
      <div class="bs-rest">تجربه‌ت چطور بود؟</div></div>
    <div id="rvStars" style="display:flex;justify-content:center;gap:8px;margin:18px 0" role="radiogroup" aria-label="امتیاز از ۵">
      ${[1,2,3,4,5].map(n=>`<button type="button" class="rv-star" data-n="${n}" role="radio" aria-checked="false" aria-label="${n} ستاره"
        onclick="setReviewStars(${n})"
        style="background:none;border:none;cursor:pointer;padding:6px;min-width:44px;min-height:44px;opacity:.35">${icon('star',{size:30,fill:true})}</button>`).join('')}
    </div>
    <div class="bw-field"><label for="rvBody">توضیح (اختیاری)</label>
      <textarea id="rvBody" maxlength="1000" rows="4" placeholder="چی خوب بود؟ چی می‌تونست بهتر باشه؟"
        style="width:100%;border-radius:var(--radius-lg);border:1px solid var(--line);padding:10px;font-family:inherit;font-size:14px"></textarea></div>
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px"
      onclick="submitReview('${esc(restaurantId)}','${esc(reservationId)}')">ثبت نظر</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بی‌خیال</button>
  `);
}

/** انتخابِ ستاره — فقط حالتِ بصری؛ هیچ چیزی هنوز ثبت نشده. */
export function setReviewStars(n){
  _reviewStars = n;
  document.querySelectorAll('#rvStars .rv-star').forEach(el=>{
    const v = +el.dataset.n;
    el.style.opacity = v <= n ? '1' : '.35';
    el.setAttribute('aria-checked', v === n ? 'true' : 'false');
  });
}

export async function submitReview(restaurantId, reservationId){
  if(!_reviewStars){ toast('','اول ستاره‌ت رو انتخاب کن'); return; }
  const btn = document.querySelector('#sheetBody .btn-primary');
  if(btn){ btn.disabled = true; btn.textContent = 'در حال ثبت...'; }
  const body = (document.getElementById('rvBody')?.value || '').trim();
  const res = await API.post('/me/reviews', {
    restaurant_id: restaurantId,
    reservation_id: reservationId,
    rating: _reviewStars,
    ...(body ? { body } : {}),
  });
  if(res.ok){
    toast('', 'نظرت ثبت شد — ممنون!');
    closeSheet();
    return;
  }
  // ⚠️ هیچ مسیرِ جعلی‌ای اینجا نیست (پروتکل §۳): آفلاین و خطایِ سرور هر دو
  // صریح گزارش می‌شوند و شیت باز می‌ماند تا کاربر بتواند دوباره تلاش کند.
  const msg = res.offline
    ? 'اتصال به سرور برقرار نشد — نظرت ثبت نشد'
    : (res.error?.code === 'ALREADY_REVIEWED'
        ? 'برای این رزرو قبلاً نظر ثبت کردی'
        : (res.error?.message || 'ثبتِ نظر ناموفق بود'));
  toast('', msg);
  if(btn){ btn.disabled = false; btn.textContent = 'ثبت نظر'; }
}


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.addToCalendar = addToCalendar;
window.addToWallet = addToWallet;
window.showCheckInQR = showCheckInQR;
window.repeatReservation = repeatReservation;
window.cancelTrip = cancelTrip;
window.openReviewSheet = openReviewSheet;
window.setReviewStars = setReviewStars;
window.submitReview = submitReview;
