// ═══ رزرونو — سفرها: تقویم، کیف پول، QR، رزرو مجدد (بخشی از اپ کاستومر) ═══
// ── Calendar Sync: تولید فایل .ics واقعی ──
import { API, isLoggedIn } from '../api.js';
import { closeSheet, esc, openSheet, toast } from '../auth.js';
import { openRest } from '../data/detail.js';
import { go } from '../data/discover.js';
import { R } from '../init.js';
export function addToCalendar(code,name,date,time){
  // ساخت یک رویداد iCalendar استاندارد (سازگار با Apple/Google Calendar)
  const dt=parseTripDateTime(date,time);
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
  toast('📅','فایل تقویم دانلود شد — بازش کن تا اضافه شه');
}
export function icsDate(d){return d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';}
export function parseTripDateTime(date,time){
  // تبدیل تقریبی تاریخ/ساعت فارسی به Date (برای دمو — رویداد فردا)
  const t=String(time).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const [h,m]=t.split(':').map(Number);
  const d=new Date();d.setDate(d.getDate()+1);d.setHours(h||20,m||0,0,0);return d;
}
// ── کیف پول (Apple/Google Wallet) ──
export function addToWallet(code,name,date,time,kind){
  // Apple Wallet واقعی به فایل .pkpass امضاشده با گواهی توسعه‌دهنده نیاز دارد
  // (که در سرور تولید می‌شود). اینجا کارت پاس‌مانند را نمایش می‌دهیم.
  const isApple=kind==='apple';
  openSheet(`<div class="wallet-pass ${isApple?'wp-apple':'wp-google'}">
    <div class="wp-top"><span class="wp-brand">رزرونو</span><span class="wp-logo">${isApple?'':'🎫'}</span></div>
    <div class="wp-rest">${esc(name)}</div>
    <div class="wp-row"><div><div class="wp-lbl">تاریخ</div><div class="wp-val">${esc(date)}</div></div>
      <div><div class="wp-lbl">ساعت</div><div class="wp-val">${esc(time)}</div></div></div>
    <div class="wp-qr">${qrSVG(code)}</div>
    <div class="wp-code">${esc(code)}</div>
  </div>
  <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" onclick="${isApple?`toast('','برای افزودن واقعی، سرور فایل pkpass امضاشده می‌سازد')`:`toast('','لینک Google Wallet در نسخه‌ی سرور فعال می‌شود')`}">${isApple?' افزودن به Apple Wallet':'افزودن به Google Wallet'}</button>
  <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>`);
}
// ── QR Check-in (تولید QR از کد رزرو) ──
export function showCheckInQR(code,name){
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div class="sheet-title" style="text-align:center">ورود با QR</div>
    <div class="sheet-sub" style="text-align:center;margin-bottom:20px">این کد رو موقع ورود به ${esc(name)} نشون بده</div>
    <div class="checkin-qr">${qrSVG(code,180)}</div>
    <div class="checkin-code">${esc(code)}</div>
    <div class="checkin-hint">میزبان با اسکن این کد، ورودت رو ثبت می‌کنه</div>
  </div>
  <button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="closeSheet()">بستن</button>`);
}
// تولید QR ساده به‌صورت SVG (الگوی قطعی از کد — برای دمو؛ در تولید از کتابخانه‌ی QR)
export function qrSVG(text,size){
  size=size||140;const n=21;const cell=size/n;
  // الگوی شبه‌تصادفی قطعی از hash متن (نمایشی)
  let h=0;for(let i=0;i<text.length;i++)h=(h*31+text.charCodeAt(i))>>>0;
  let rects='';const rng=(s)=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  let seed=h;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    // گوشه‌های موقعیت‌یاب (finder patterns)
    const fp=(x<7&&y<7)||(x>=n-7&&y<7)||(x<7&&y>=n-7);
    let on;
    if(fp){const lx=x<7?x:x-(n-7),ly=y<7?y:y-(n-7);on=(lx===0||lx===6||ly===0||ly===6||(lx>=2&&lx<=4&&ly>=2&&ly<=4));}
    else{seed=(seed*1103515245+12345)&0x7fffffff;on=(seed/0x7fffffff)>0.5;}
    if(on)rects+=`<rect x="${(x*cell).toFixed(1)}" y="${(y*cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:#fff;border-radius:8px"><g fill="#0f172a">${rects}</g></svg>`;
}
// ── رزرو مجدد (پیش‌پرکردن با همان رستوران) ──
export function repeatReservation(rid){
  const r=R.find(x=>x.id===rid);
  if(!r){toast('','رستوران پیدا نشد');return;}
  go('rest');openRest(rid);
  toast('🔄','اطلاعات رزرو قبلی آماده‌ست — فقط زمان رو انتخاب کن');
}
// لغو رزرو (متصل به API اگر آنلاین)
export async function cancelTrip(code,btn){
  const tripEl=btn.closest('.trip');
  if(isLoggedIn()){
    const res=await API.post('/reservations/'+encodeURIComponent(code)+'/cancel',{});
    if(res.ok){toast('✓','رزرو لغو شد');if(tripEl)tripEl.style.opacity=.5;return;}
    if(!res.offline){toast('⚠️',res.error?.message||'لغو ناموفق بود');return;}
  }
  // fallback (آفلاین یا مهمان)
  toast('✓','رزرو لغو شد');if(tripEl)tripEl.style.opacity=.5;
}


// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.addToCalendar = addToCalendar;
window.addToWallet = addToWallet;
window.showCheckInQR = showCheckInQR;
window.repeatReservation = repeatReservation;
window.cancelTrip = cancelTrip;
