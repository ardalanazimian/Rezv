// ═══════════════════════════════════════════════════════════
//  رزرونو — جریانِ رزرو (شیتِ رزرو، availability، مراحل، تأیید)
//  جدا شده از data/detail.js (ریفکتور فاز۱: جداسازیِ مسئولیت).
//  رفتار دقیقاً همان قبل است؛ فقط از یک فایلِ مجزا export می‌شود.
// ═══════════════════════════════════════════════════════════
import { API, USER, isLoggedIn, syncNavPoints, userName } from '../api.js';
import { closeSheet, esc, jsq, openLogin, openSheet, setAfterLogin, toast } from '../auth.js';
import { doSearch, fmtFa } from './discover.js';
import { TRIPS, bk, bookingCtx, setBk, setBookingCtx, todayISO } from './seed.js';
import { findR, invalidateCardSlots } from '../init.js';
import { offerWaitlist } from '../waitlist.js';
import { genIdempotencyKey } from '../api-core.js';
import { bookingErrorKind } from '../api-errors.js';
import { haptic } from '../theme-pwa.js';
import { icon } from '../icons.js';

// ═══════════════════════════════════════════════════════════
//  تاریخ‌های قابلِ رزرو
//
//  پیش از این چهار گزینه‌ی ثابت بود: امروز، فردا، پنجشنبه، جمعه. یعنی برای
//  اپی که کارش رزروِ میز است، «سالگردمون ماه بعد» اصلاً ممکن نبود.
//
//  حالا ۶۰ روزِ واقعی. برچسب‌ها با تقویمِ شمسی ساخته می‌شوند (Intl با تقویمِ
//  fa-IR این را بومی می‌دهد؛ نیازی به کتابخانه‌ی تبدیلِ تاریخ نیست) و مقدارِ
//  هر گزینه مستقیماً همان ISO است که بک‌اند می‌خواهد — پس هیچ تبدیلِ حدسی
//  بینِ «کلمه‌ی فارسی» و «تاریخِ واقعی» باقی نمی‌ماند.
// ═══════════════════════════════════════════════════════════
const HORIZON_DAYS = 60;
const faDate = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });

export function dateOptions(){
  const out = [];
  const base = new Date(); base.setHours(12, 0, 0, 0); // ظهر: از پرشِ ساعتِ تابستانی مصون است
  for (let i = 0; i < HORIZON_DAYS; i++){
    const d = new Date(base); d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const label = i === 0 ? 'امروز' : i === 1 ? 'فردا' : faDate.format(d);
    out.push({ iso, label });
  }
  return out;
}
const PARTY_MAX = 12;

// ═══════════════════════════════════════════════════════════
//  برچسبِ پیش‌پرداخت — رفعِ P1-3 (پروتکل §۲۰ و §۳)
//
//  اپ در دو جا هاردکد ادعا می‌کرد «رزرو رایگان · بدون پیش‌پرداخت» و
//  «هنوز پولی پرداخت نمی‌کنی» — در حالی که `depositRequired` یک سیاستِ
//  واقعی و قابلِ‌تنظیمِ رستوران است که پنلِ business می‌نویسدش. رستورانی
//  که بیعانه را روشن می‌کرد، همچنان به مشتری «رایگان» نشان داده می‌شد.
//
//  سه حالت، و هیچ‌کدام حدس نمی‌زند:
//    null  → سرور چیزی نگفته (رستورانِ نمونه/آفلاین) → **هیچ ادعایی نکن**
//    false → واقعاً بدونِ پیش‌پرداخت → همان متنِ قبلی
//    true  → بیعانه لازم است → صریح بگو
//
//  ⚠️ این تابع تنها منبعِ متنِ پیش‌پرداخت در کلِ اپ است (§۲۲: یک پیاده‌سازی).
// ═══════════════════════════════════════════════════════════
//  ⚠️ به‌روزرسانیِ صداقت (۲۰۲۶-۰۸-۲۴): متنِ حالتِ `true` قبلاً می‌گفت
//  «این رستوران برایِ رزرو بیعانه می‌گیرد» — که به مشتری می‌فهماند الان پولی
//  گرفته می‌شود. ولی اپِ مشتری **هیچ‌وقت** مسیرِ پرداخت را صدا نمی‌زند
//  (تأییدشده با grep: صفر فراخوان به `/reservations/:code/pay`) و درگاه هم پشتِ
//  فلگِ خاموش است. پس رزرو بدونِ هیچ پرداختی تمام می‌شد و مشتری منتظرِ
//  درخواستی می‌ماند که نمی‌آمد.
//  حالا همان اطلاعِ واقعی داده می‌شود (رستوران سیاستِ بیعانه دارد) بدونِ ادعای
//  دریافتِ آنلاین.
export function depositLabel(r){
  if(r?.depositRequired === true){
    // ⚠️ BE-004/ب (۲۰۲۶-۰۹-۱۰): بندِ «آنلاین دریافت نمی‌شود» **مشتق** می‌شود،
    // ادعا نمی‌شود. تا امروز یک جمله‌ی ثابت بود در حالی که `payment_enabled`
    // در هیچ پاسخِ روبه‌مشتری‌ای نبود — یعنی اپ داده‌ی لازم برای راست‌گفتن را
    // نداشت و با این حال یک ادعای **مثبت** درباره‌ی درگاه می‌کرد. اگر رستورانی
    // درگاه را روشن می‌کرد، اپ خلافش را می‌گفت.
    // سه حالت، همان قاعده‌ی بالا — و `null` **سکوت** است نه «خاموش»، چون
    // اندپوینتِ فهرست این کلید را نمی‌دهد و روی مسیرِ فید واقعاً نامعلوم است.
    // ⚠️ نزدیک بود همین‌جا **دقیقاً همان نقصی را بسازم که دارم رفعش می‌کنم.**
    // نسخه‌ی اولِ این خط می‌گفت «پرداختِ آنلاین فعال است». ولی اپِ مشتری
    // **هیچ‌وقت** مسیرِ پرداخت را صدا نمی‌زند (صفر فراخوان به
    // `/reservations/:code/pay` — کامنتِ بالای همین تابع از ۲۰۲۶-۰۸-۲۴ همین
    // را ثبت کرده و خودم دوباره سنجیدمش). پس «فعال است» یک ادعای مثبتِ تازه
    // درباره‌ی کاری بود که این اپ انجام نمی‌دهد.
    // `true` یعنی درگاهِ **رستوران** روشن است، نه اینکه اینجا پول گرفته شود —
    // و هر دو حقیقت گفته می‌شوند، بدونِ وعده.
    if(r?.onlinePaymentEnabled === true) return 'این رستوران سیاستِ بیعانه دارد — پرداختش از این اپ انجام نمی‌شود، هنگامِ حضور هماهنگ کن';
    if(r?.onlinePaymentEnabled === false) return 'این رستوران سیاستِ بیعانه دارد — آنلاین دریافت نمی‌شود، هنگامِ حضور هماهنگ کن';
    return 'این رستوران سیاستِ بیعانه دارد';   // نامعلوم → فقط سیاست، بدونِ ادعای درگاه
  }
  if(r?.depositRequired === false) return 'رزرو رایگان · بدون پیش‌پرداخت';
  return '';   // نامعلوم → سکوت، نه ادعا
}

// ⚠️ پنجره‌ی لغوِ رایگان — **قاعده‌ای که واقعاً اجرا می‌شود**، نه متنِ تزئینی.
//
// سرور در `lib/economy.ts:111` لغوِ دیرتر از این پنجره را با امتیازِ ۳۵ (به‌جایِ
// ۸۵) و یک strike ثبت می‌کند، و strike در `computeReputationTier` جلویِ سطحِ
// platinum را می‌گیرد — نشانی که به رستوران‌ها هم نمایش داده می‌شود. تا پیش از
// این هیچ‌جای اپ این پنجره را نمی‌گفت: یعنی جریمه اجرا می‌شد ولی اعلام نشده بود.
//
// همان قاعده‌ی `depositLabel`: مقدارِ نامعلوم → سکوت، نه حدس.
export function cancelPolicyLabel(r){
  const h = r?.freeCancelHours;
  if(typeof h !== 'number' || !(h > 0)) return '';
  return `لغوِ رایگان تا ${fmtFa(h)} ساعت پیش از زمانِ رزرو. دیرتر از آن، یک تخلف در سابقه‌ات ثبت می‌شود و نشانِ اعتبارت پایین می‌آید — این نشان به رستوران‌ها هم نشان داده می‌شود.`;
}

// شیت رزرو که با دکمه‌ی پایین باز می‌شود (تاریخ/ساعت/نفر)
export function openBookSheet(id){
  const r=findR(id);
  // پیش‌فرض‌ها از زمینه‌ی مشترک می‌آیند، نه از صفر — اگر کاربر قبلاً گفته
  // «پنجشنبه، ۴ نفر»، همان‌جا می‌ماند و لازم نیست دوباره واردش کند.
  const dates = dateOptions();
  const dateSel = dates.some(d=>d.iso===bookingCtx.date) ? bookingCtx.date : dates[0].iso;
  openSheet(`
    <div class="bs-head"><div class="bs-title">رزرو میز</div><div class="bs-rest">${esc(r.n)}</div></div>
    <div id="bwDemoBanner"></div>
    <div class="bw-field"><label>تاریخ</label><select id="bwDate" onchange="refreshSlots(${jsq(String(id))})">${
      dates.map(d=>`<option value="${esc(d.iso)}"${d.iso===dateSel?' selected':''}>${esc(d.label)}</option>`).join('')
    }</select></div>
    <div class="bw-field"><label>تعداد نفر</label><select id="bwParty" onchange="refreshSlots(${jsq(String(id))})">${
      Array.from({length:PARTY_MAX},(_,i)=>i+1).map(n=>`<option value="${n}"${n===bookingCtx.party?' selected':''}>${fmtFa(n)} نفر</option>`).join('')
    }</select></div>
    <div class="bw-field"><label>ساعت</label><select id="bwTime"><option>در حال بررسی...</option></select></div>
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" onclick="startBook(${jsq(String(id))})">بررسی میزهای موجود</button>
    <div style="text-align:center;font-size:12px;color:var(--t3);margin-top:10px">${depositLabel(r)}</div>
  `);
  refreshSlots(id);
}
// ⚠️ اضافه‌شده (Part 1 — حسابرسیِ صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): قبلاً وقتی
// availabilityِ واقعی در دسترس نبود (آفلاین، بدونِ slug، یا شکستِ درخواست)،
// این سه ساعتِ ثابت («۱۹:۰۰»، «۲۰:۰۰»، «۲۱:۰۰») بدونِ هیچ نشانه‌ای دقیقاً
// عینِ سانس‌هایِ واقعی رندر می‌شدند — یعنی «صداقتِ آفلاین/دمو» که در بقیه‌ی
// اپ رعایت می‌شه (مثلاً حالتِ صریحِ «رزرو ثبت نشد» در تأییدِ رزرو) اینجا
// نقض می‌شد. حالا هم متنِ گزینه‌ها صریحاً «(نمونه)» می‌گیرند، هم یک بنرِ
// هشدارِ قابل‌دیدن (همون زبانِ بصریِ warning-soft که بقیه‌ی اپ استفاده
// می‌کنه) بالایِ شیت ظاهر می‌شه.
function showDemoTimesBanner(){
  const b=document.getElementById('bwDemoBanner');
  if(b)b.innerHTML=`<div style="background:var(--warning-soft);color:var(--warning-ink);border-radius:var(--radius-lg);padding:var(--sp-3);font-size:12.5px;line-height:1.7;text-align:center;margin-bottom:10px">⚠️ ساعت‌هایِ زیر نمونه‌اند، نه سانسِ واقعیِ این رستوران — به availabilityِ زنده وصل نشدیم.</div>`;
}
function hideDemoTimesBanner(){
  const b=document.getElementById('bwDemoBanner');
  if(b)b.innerHTML='';
}
const FALLBACK_TIMES=['۱۹:۰۰','۲۰:۰۰','۲۱:۰۰'];
function renderDemoTimeOptions(sel,r){
  showDemoTimesBanner();
  // value همان زمانِ خام می‌ماند (رفتارِ قبلی، دست‌نخورده) — «(نمونه)» فقط در
  // متنِ نمایشی اضافه می‌شود، وگرنه اگر بعداً واقعاً submit شود، رشته‌ی
  // غیرمعتبر («۱۹:۰۰ (نمونه)») به‌جایِ زمانِ خام به بک‌اند می‌رفت.
  sel.innerHTML=(r.slots.length?r.slots:FALLBACK_TIMES).map(s=>`<option value="${s}">${s} (نمونه)</option>`).join('');
}
// بارگذاری ساعت‌های واقعاً موجود از /restaurants/{slug}/availability
export async function refreshSlots(id){
  const r=findR(id);
  const sel=document.getElementById('bwTime');
  if(!sel)return;
  // اگر slug نداریم (حالت آفلاین/نمونه)، از همون slots نمونه استفاده کن
  if(!r.slug || !API.online){
    renderDemoTimeOptions(sel,r);
    return;
  }
  // مقدارِ select حالا خودش ISO است — نه کلمه‌ای که باید حدس زده شود.
  const apiDate=document.getElementById('bwDate')?.value||todayISO();
  const partyVal=parseInt(document.getElementById('bwParty')?.value,10)||2;
  // هر تغییرِ کاربر بلافاصله در زمینه‌ی مشترک می‌نشیند تا رستورانِ بعدی هم بداند
  setBookingCtx({ date: apiDate, party: partyVal });
  hideDemoTimesBanner();
  sel.innerHTML='<option>در حال بررسی...</option>';
  const res=await API.get(`/restaurants/${r.slug}/availability?date=${apiDate}&party=${partyVal}`);
  if(res.ok && Array.isArray(res.data?.slots)){
    const open=res.data.slots.filter(s=>s.status==='open');
    if(open.length){
      sel.innerHTML=open.map(s=>`<option value="${esc(s.time)}">${faTime(s.time)}</option>`).join('');
    }else{
      // خالیِ صادقانه: هیچ ساعتِ اختراعی جایگزینش نمی‌شه.
      // ⚠️ ولی «خالی» یک علت ندارد. تا پیش از این، رستورانی که سیستمش آفلاین
      // بود همین پیامِ «ساعت خالی برای این روز نیست» را می‌گرفت — یعنی کاربر
      // فکر می‌کرد امشب پر است، در حالی که واقعیت این بود که رستوران اصلاً
      // رزروِ آنلاین نمی‌گرفت. حالا خودِ API علت را می‌گوید
      // (restaurant_status: online|offline|closed) و ما همان را نشان می‌دهیم.
      const why = res.data?.restaurant_status === 'offline' || res.data?.restaurant_status === 'closed'
        ? (res.data?.reason || 'این رستوران فعلاً رزروِ آنلاین نمی‌پذیرد')
        : 'ساعت خالی برای این روز نیست';
      sel.innerHTML=`<option value="">${esc(why)}</option>`;
    }
    // ساعت‌های پر را هم نشان بده ولی غیرفعال
    res.data.slots.filter(s=>s.status==='full').forEach(s=>{
      const o=document.createElement('option');o.value='';o.disabled=true;o.textContent=`${faTime(s.time)} (پر)`;sel.appendChild(o);
    });
  }else{
    // درخواستِ availability شکست خورد (نه اینکه واقعاً سانسِ خالی نبود) —
    // همون رفتارِ دمو/فال‌بک، تا کاربر این را با «امشب واقعاً پره» اشتباه نگیرد.
    renderDemoTimeOptions(sel,r);
  }
}
export function faTime(t){return (t||'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
/** برچسبِ فارسیِ یک تاریخِ ISO — برای نمایش در خلاصه و سفرها. */
export function labelForISO(iso){
  const hit = dateOptions().find(d=>d.iso===iso);
  if (hit) return hit.label;
  const [y,m,d] = String(iso||'').split('-').map(Number);
  return (y && m && d) ? faDate.format(new Date(y, m-1, d, 12)) : iso;
}
// رزروِ یک‌ضربی از چیپِ ساعتِ روی کارت. تاریخ و تعداد از زمینه‌ی مشترک می‌آید،
// نه «امروز / ۲ نفر»ِ ثابت — وگرنه چیپ بی‌صدا انتخابِ کاربر را دور می‌ریخت.
export function quickBook(id,slot){
  setBk({id,date:labelForISO(bookingCtx.date),dateVal:bookingCtx.date,time:slot,
         timeRaw:String(slot).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
         party:`${fmtFa(bookingCtx.party)} نفر`,partyN:bookingCtx.party});
  openBookingFlow(id);
}
export function startBook(id){
  const t=document.getElementById('bwTime').value;
  if(!t){toast('','برای این روز ساعت خالی نیست — روز دیگه‌ای انتخاب کن');return;}
  const iso=document.getElementById('bwDate').value;
  const partyN=parseInt(document.getElementById('bwParty').value,10)||2;
  setBookingCtx({ date: iso, party: partyN });
  setBk({id,date:labelForISO(iso),dateVal:iso,time:faTime(t),timeRaw:t,party:`${fmtFa(partyN)} نفر`,partyN});
  openBookingFlow(id);
}

// ═══════════════════════════════════════════════════════════
//  DS-002 §۳‑۱ — گامِ ۲ فقط وقتی رندر شود که چیزی برای تصمیم داشته باشد
//
//  ⚠️ استدلالی که این تغییر را توجیه می‌کند **عوض شده**، و اگر کسی سندِ
//  DS-002 را سرسری بخواند ممکن است این را به دلیلِ غلط پس بگیرد:
//  نسخه‌ی اولِ اسپک آن را با «فلو از ۳ ضربه به ۲ می‌رسد» توجیه کرد، ولی
//  مالک در ۲۰۲۶-۰۹-۰۹ حکم داد **«سه ضربه خوب است»**. پس آن استدلال مرده
//  است و این تغییر **کوتاه‌سازیِ فلو نیست**.
//
//  استدلالِ زنده: روی مسیرِ **اصلی** (رستورانی که منویِ id-دار دارد) تعدادِ
//  ضربه **اصلاً عوض نمی‌شود** — همان سه گام. تغییر فقط جلوی رندرِ گامی را
//  می‌گیرد که هیچ تصمیمی در آن نیست. و اگر سه عددِ درستی است، هدررفتنِ یکی
//  از آن سه **گران‌تر** است، نه ارزان‌تر.
//
//  ⚠️ و دامنه‌اش از آنچه اسپک گفت **وسیع‌تر** است. اسپک مسیرِ فید را نام برد
//  (اندپوینتِ فهرست `menu` برنمی‌گرداند — خودم تأیید کردم: `select` در
//  `api/v1/restaurants/route.ts:62-66` فیلدِ menu ندارد و `discover.js` هم
//  صفر ارجاع). ولی آیتم‌های **نمونه**ی `seed.js` هم `id` ندارند، و گاردِ
//  ۰۷۸ فقط آیتمِ id-دار را چیپ می‌کند. پس گامِ ۲ برای دادهٔ نمونه هم خالی
//  است. شرط روی «چیزی برای تصمیم هست؟» بسته شده، نه روی «از کدام مسیر
//  آمده‌ای» — وگرنه همین نقص از مسیرِ دوم برمی‌گشت.
// ═══════════════════════════════════════════════════════════

/** آیتم‌هایی که واقعاً می‌شود پیش‌سفارش داد — تنها منبعِ «گامِ ۲ محتوا دارد؟». */
export function orderableMenu(r){
  return (r?.menu || []).filter(m => !m.out && m.id);
}

/** شمارِ واقعیِ گام‌ها برای این رستوران: بی‌منو ۲، با منو ۳. */
export function bookingStepCount(r){
  return orderableMenu(r).length ? 3 : 2;
}

/** نوارِ مرحله از شمارِ **واقعی** ساخته می‌شود، نه سه‌تایِ ثابت. */
function stepBars(total, current){
  let out = '';
  for (let i = 1; i <= total; i++) {
    out += `<div class="step-bar${i < current ? ' done' : i === current ? ' now' : ''}"></div>`;
  }
  return `<div class="steps">${out}</div>`;
}

/**
 * تنها درِ ورودِ فلو پس از انتخابِ زمان — `quickBook` و `startBook` هر دو
 * از این‌جا می‌روند. پیش‌تر هر دو عیناً `openSheet(bookStep2(findR(id)))`
 * داشتند؛ یک منطق در دو جا، که همان کلاسِ «یک واقعیت، چند رونوشت» است.
 */
export function openBookingFlow(id){
  const r = findR(id);
  if (orderableMenu(r).length === 0) {
    // ⚠️ `bk.preorder` را **صریح** خالی می‌کنیم. `toBookStep3` تنها نویسنده‌اش
    // بود و با پریدن از گامِ ۲ اصلاً اجرا نمی‌شود. `setBk` شیء را کامل
    // جایگزین می‌کند پس حالتِ کهنه عملاً ممکن نیست — ولی آن ضمانت در فایلِ
    // دیگری (`seed.js`) زندگی می‌کند، و یک ثابتِ محلی بهتر از اتکا به
    // رفتارِ دور است.
    bk.preorder = [];
    openSheet(bookStep3(r));
    return;
  }
  openSheet(bookStep2(r));
}
export function bookStep2(r){
  // ⚠️ رفع‌شده (R1): وقتی رستوران منویی ثبت نکرده (r.menu=[])، قبلاً این
  // بخش با عنوانِ «پیش‌سفارش» و یک .opt-row کاملاً خالی رندر می‌شد — یعنی
  // شبیهِ یک باگِ بارگذاری، نه «این رستوران منو ندارد». حالا کلِ بخش با
  // منویِ خالی اصلاً نشان داده نمی‌شود.
  // آیتمِ «ناموجود» اصلاً پیشنهاد نمی‌شود (۰۷۷) — پیشنهاددادنِ چیزی که
  // نمی‌شود سفارش داد، همان «موفقیتِ جعلی» است. enforcementِ سروری = فاز ۲.
  // ۰۷۸ — فقط آیتم‌های id-دار (دیتای زنده) چیپ می‌شوند: انتخابِ آیتمِ نمونه
  // (بدونِ id) قابلِ ارسال نیست و نمایشش «موفقیتِ جعلی» می‌شد.
  const orderable = orderableMenu(r);
  const preorderBlock = orderable.length
    ? `<div class="field-label">پیش‌سفارش (اختیاری)</div>
    <div class="opt-row">${orderable.map(m=>`<div class="opt" role="button" tabindex="0" aria-pressed="false" data-mid="${esc(m.id)}" onclick="this.setAttribute('aria-pressed',String(this.classList.toggle('sel')))">${esc(m.e)} ${esc(m.n)}</div>`).join('')}</div>`
    : '';
  return `<div class="sheet-title">${esc(r.n)}</div><div class="sheet-sub">${esc(bk.date)} · ${esc(bk.time)} · ${bk.party}</div>
    ${stepBars(bookingStepCount(r), 2)}
    ${preorderBlock}
    <button class="btn btn-primary btn-lg btn-block" onclick="toBookStep3(${jsq(String(r.id))})">ادامه</button>`;
}
// wrapperِ سراسری: onclick در scope سراسری اجرا می‌شود و به R (ماژولی) دسترسی ندارد،
// پس lookup را اینجا (با دسترسی به R) انجام می‌دهیم.
export function toBookStep3(id){
  // ۰۷۸ — انتخابِ چیپ‌ها همین‌جا (پیش از آنکه رندرِ گامِ ۳ DOMِ گامِ ۲ را
  // جایگزین کند) در stateِ bk ذخیره می‌شود؛ در لحظه‌ی submit دیگر چیپی نیست.
  bk.preorder = Array.from(document.querySelectorAll('.opt.sel[data-mid]'))
    .map(el=>({ menu_item_id: el.getAttribute('data-mid'), qty: 1 }));
  openSheet(bookStep3(findR(id)));
}
export function bookStep3(r){
  // نام/موبایل از حسابِ کاربر (اگر وارد شده) — نه مقدارِ ساختگی
  const name = isLoggedIn() ? userName() : '';
  const phone = USER?.phone ? String(USER.phone).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]) : '';
  return `<div class="sheet-title">تأیید اطلاعات</div><div class="sheet-sub">یه قدم تا رزرو</div>
    ${stepBars(bookingStepCount(r), bookingStepCount(r))}
    <div class="field-label">نام</div><input class="inp" id="bkName" value="${esc(name)}" placeholder="نامت رو بنویس">
    <div class="field-label">موبایل</div><input class="inp" id="bkPhone" inputmode="tel" value="${esc(phone)}" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
    <!-- ⚠️ اضافه‌شده (فازِ ۲، پروتکل §۹/§۱۰ — جریانِ ایمنیِ غذایی).
         ستونِ Reservation.preferences و کلِ مسیرش از قبل کامل بود:
         اعتبارسنجی در reservations/route.ts:24، ذخیره در reservations.ts:389،
         و **نمایش به کارکنان** در restaurant/reservations/route.ts:69
         (note = r.preferences.join). تنها حلقه‌ی گمشده همین‌جا بود —
         شیتِ رزرو هیچ‌وقت این فیلد را نمی‌فرستاد، پس ستون همیشه {} می‌ماند و
         سطرِ یادداشتِ پنلِ رستوران هرگز پر نمی‌شد. یعنی قابلیت غایب نبود،
         وصل‌نشده بود (همان کلاسِ P1-3/P1-4).

         §۱۰ صریح: «Do NOT imply medical verification» — پس متن عمداً
         «به رستوران اطلاع می‌دهیم» است، نه هیچ تضمینِ ایمنی. -->
    <div class="field-label" style="margin-top:2px">
      ${icon('info',{size:13})} آلرژی یا نیازِ غذایی خاص <span style="color:var(--t3);font-weight:400">(اختیاری)</span>
    </div>
    <textarea class="inp" id="bkPrefs" rows="2" maxlength="200"
      placeholder="مثلاً: آلرژی به بادام‌زمینی · بدونِ گلوتن · صندلی چرخ‌دار"
      style="font-family:inherit;resize:vertical"></textarea>
    <div style="font-size:11.5px;color:var(--t3);margin:4px 2px 10px;line-height:1.7">
      این یادداشت به رستوران نشان داده می‌شود تا در آماده‌سازی لحاظ کند. تأییدِ پزشکی نیست —
      اگر آلرژیِ شدید داری، حتماً موقعِ حضور هم شفاهی به کارکنان بگو.
    </div>
    <div class="summary"><div class="sum-row"><span class="k">رستوران</span><span class="v">${esc(r.n)}</span></div><div class="sum-row"><span class="k">تاریخ و ساعت</span><span class="v">${esc(bk.date)} · ${esc(bk.time)}</span></div><div class="sum-row"><span class="k">تعداد</span><span class="v">${bk.party}</span></div></div>
    ${r.cb>0?`<div class="reward-row"><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>`:''}
    <div style="text-align:center;font-size:12px;color:var(--t3);margin-top:10px">امتیازِ اعتبار بعد از انجامِ رزرو به حسابت اضافه می‌شه</div>
    ${cancelPolicyLabel(r)?`<div class="cancel-policy-note" style="font-size:11.5px;color:var(--t3);margin:8px 2px 0;line-height:1.7">${icon('info',{size:13})} ${esc(cancelPolicyLabel(r))}</div>`:''}
    <button class="btn btn-primary btn-lg btn-block" onclick="confirmBook(${jsq(String(r.id))})">تأیید رزرو</button>`;
}
export async function confirmBook(id){
  const r=findR(id);
  // رزرو نیاز به ورود دارد — بعد از ورود، همین مرحله‌ی تأیید از سر گرفته می‌شود
  if(!isLoggedIn()){
    setAfterLogin(()=>{ const rr=findR(id); if(rr && String(bk.id)===String(id)) openSheet(bookStep3(rr)); });
    toast('','برای رزرو اول وارد شو — بعدش ادامه می‌دیم');
    setTimeout(()=>openLogin(),400);
    return;
  }
  // ⚠️ اضافه‌شده (R8 — حسابرسیِ صداقتِ confirmBook، ۲۰۲۶-۰۸-۱۴): این دو
  // فیلد قبلاً اصلاً خوانده نمی‌شدند — کاربر می‌توانست نامش را پاک کند یا
  // موبایلِ نامعتبر بنویسد و «تأیید رزرو» بی‌هیچ خطایی موفق می‌شد، چون این
  // مقادیر هیچ‌جا submit نمی‌شدند. برایِ رزروِ مشتریِ واردشده، بک‌اند هویت
  // را از JWT می‌گیرد (نه از این ورودی‌ها)، پس نمی‌فرستیمشان — ولی حداقل
  // نباید بگذاریم کاربر با فیلدِ خالی/نامعتبر رد شود، وگرنه صفحه‌ی «تأیید
  // اطلاعات» یک ادعای توخالی است. (محدودیتِ شناخته‌شده در KNOWN_LIMITATIONS
  // ثبت شده: ویرایشِ این دو فیلد چیزی در رزرو تغییر نمی‌دهد.)
  const nameVal=(document.getElementById('bkName')?.value||'').trim();
  const phoneRaw=(document.getElementById('bkPhone')?.value||'').trim();
  const phoneNorm=phoneRaw.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  if(!nameVal){ toast('','اسمت رو بنویس'); return; }
  // این فیلد از حسابِ کاربر پیش‌پر می‌شود و ممکن است بین‌المللی ذخیره شده
  // باشد (+۹۸...، دقیقاً شکلِ USER.phone) — نه فقط فرمِ محلیِ ۰۹...؛ رجوع
  // کن به auth.js:sendOtp که فقط ورودیِ تازه‌ی کاربر را محلی می‌خواهد.
  if(!/^(0|98)?9\d{9}$/.test(phoneNorm)){ toast('','شماره موبایلِ معتبر بنویس (مثل ۰۹۱۲۳۴۵۶۷۸۹)'); return; }
  // وضعیت در حال ارسال
  const sheetBody=document.getElementById('sheetBody');
  const confirmBtn=sheetBody.querySelector('.btn-primary');
  if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='در حال ثبت رزرو...';}

  // تاریخ دیگر حدس زده نمی‌شود: bk.dateVal همان ISO است که کاربر انتخاب کرده.
  // Idempotency-Key: یک‌بار برای همین submit ساخته می‌شود — اگر کاربر دوبار
  // دکمه را بزند یا شبکه retry کند، سرور رزروِ دوم نمی‌سازد، پاسخِ اول برمی‌گردد.
  // یادداشتِ آلرژی/نیازِ غذایی → همان ستونِ preferences که پنلِ رستوران
  // به‌عنوانِ «یادداشت» نمایش می‌دهد. بک‌اند آرایه می‌خواهد
  // (z.array(z.string().max(100)).max(20))، پس متن با «·»، ویرگولِ فارسی و
  // خطِ جدید تکه می‌شود و هر تکه به سقفِ ۱۰۰ کاراکترِ قرارداد بریده می‌شود.
  const prefsRaw=(document.getElementById('bkPrefs')?.value||'').trim();
  const PREF_SEP=/[·،\r\n]+/;
  const preferences=prefsRaw
    ? prefsRaw.split(PREF_SEP).map(x=>x.trim()).filter(Boolean).slice(0,20).map(x=>x.slice(0,100))
    : undefined;

  // ۰۷۸ — چیپ‌های انتخاب‌شده‌ی پیش‌سفارش واقعاً فرستاده می‌شوند (تا پیش از
  // این فقط class می‌گرفتند و هیچ‌چیز به سرور نمی‌رسید — وعده‌ی پوچ).
  const preorder = bk.preorder || [];

  const res=await API.post('/reservations',{
    restaurant_id:id,
    date:bk.dateVal||todayISO(),
    time:bk.timeRaw||String(bk.time||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
    party_size:bk.partyN||2,
    notify_sms:true,
    ...(preorder.length ? { preorder } : {}),
    ...(preferences?.length ? { preferences } : {}),
  },{ 'Idempotency-Key': genIdempotencyKey() });

  let code, bookedStatus=null;
  if(res.ok && res.data?.code){
    // رزرو واقعی در دیتابیس ثبت شد (بک‌اند code را در سطحِ بالا برمی‌گرداند)
    // ⚠️ هپتیکِ success فقط همین‌جا زده می‌شود — دقیقاً همون شرطی که سرور واقعاً
    // res.ok داد؛ هیچ مسیرِ دیگری (دمو/آفلاین) این الگو را نمی‌گیرد.
    code=res.data.code;
    // ⚠️ A1-006 (۲۰۲۶-۰۹-۱۰): وضعیتِ **واقعی** هم برداشته می‌شود، نه فقط کد.
    // سرور `status` را در همان پاسخ می‌دهد (`reservations.ts:481`) و این اپ
    // تا امروز فقط `code` را می‌خواند و بعد بی‌قیدوشرط «رزرو تأیید شد!»
    // می‌گفت — در حالی که رستورانی که `auto_confirm` را خاموش کرده، رزرو را
    // `pending` می‌گیرد (`reservations.ts:375`). یعنی مشتری «تأیید شد» می‌دید
    // و میزش قطعی نبود.
    bookedStatus=res.data.status||null;
    haptic('success');
  } else if(res.offline){
    // ⚠️ رفعِ P0-3 (فازِ ۲، پروتکل §۳ — «A customer must NEVER see … fake
    // reservation code»).
    //
    // این مسیر قبلاً یک کدِ `RZ...`ِ تصادفی می‌ساخت و صفحه‌ی موفقیت را با تیکِ
    // سبز و جعبه‌ی «کد رزرو» نشان می‌داد. انصافاً بهترین نسخه‌ی جعل در کلِ
    // کدبیس بود — یک هشدارِ صریح و کاملاً درست هم کنارش می‌گذاشت و هپتیکِ
    // success هم نمی‌زد. ولی طبقِ متنِ صریحِ پروتکل، «کدِ رزروِ ساختگی» حتی با
    // افشا هم مجاز نیست: کاربر کدی در دست دارد که در هیچ سیستمی وجود ندارد،
    // می‌تواند کپی/اسکرین‌شات بگیرد و بعداً آن را معتبر بداند.
    //
    // متنِ هشدارِ فارسیِ قبلی خوب بود و عمداً حفظ شده — فقط از «موفقیتِ محلی»
    // به «ثبت نشد» تبدیل شد و کد/تیکِ سبز حذف شدند (پروتکل §۲۶: بازطراحیِ
    // بی‌دلیل ممنوع؛ فقط ادعایِ نادرست برداشته می‌شود).
    haptic('light');
    sheetBody.innerHTML=`
      <div style="text-align:center;padding:24px 16px">
        <div style="font-size:34px;line-height:1;margin-bottom:12px" aria-hidden="true">⚠️</div>
        <div class="sheet-title" style="text-align:center">رزرو ثبت نشد</div>
        <div class="sheet-sub" style="text-align:center">${esc(r.n)} · ${esc(bk.date)} · ${esc(bk.time)}</div>
        <div style="background:var(--warning-soft);color:var(--warning-ink);border-radius:var(--radius-lg);padding:var(--sp-3);font-size:13px;line-height:1.7;text-align:center;margin:14px 0">اتصال به سرورِ رزرونو برقرار نشد، پس این رزرو در سیستمِ رستوران ثبت نشده و کدِ رزروی هم صادر نشده. یادآورِ پیامکی ارسال نمی‌شود. با وصل‌شدنِ اینترنت دوباره تلاش کن.</div>
        <button class="btn btn-primary btn-lg btn-block" onclick="confirmBook(${jsq(String(id))})">تلاش دوباره</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
      </div>`;
    return;
  } else {
    // خطای واقعی از سرور. تصمیم فقط رویِ **کدِ** خطاست، نه متنِ پیام.
    // ⚠️ شرطِ قبلی یک `/پر|ظرفیت/.test(res.error?.message||'')` داشت: منطقِ UI
    // سوارِ متنِ فارسیِ بک‌اند بود، پس عوض‌کردنِ یک کلمه در `errors.ts` بی‌صدا
    // این شاخه را می‌شکست بدونِ آنکه چیزی قرمز شود.
    const kind = bookingErrorKind(res.error);

    if(kind==='capacity'){
      offerWaitlist(id, r);
      return;
    }

    if(kind==='retry'){
      // ظرفیت لزوماً تمام نیست — رزروِ همزمانِ کسِ دیگری جلو افتاد. تلاشِ
      // دوباره همین حالا اغلب جواب می‌دهد، پس دکمه‌ی تلاشِ دوباره داده می‌شود
      // و **پیشنهادِ صف داده نمی‌شود** (صف برای وقتی است که جا واقعاً نیست).
      //
      // ⚠️ چرا این حالت تازه اهمیت پیدا کرد: کامیتِ `38a9570` مسیرِ رزرو را
      // صادق‌تر کرد و در شرایطِ رقابت ۴۰۹ `CONCURRENCY_RETRY` می‌دهد. اپ آن
      // کد را نمی‌شناخت، پس کاربر یک توستِ عمومی می‌دید. قراردادِ بهترشده‌ای
      // که مصرف‌کننده ندارد، هنوز برای کاربر بهتر نشده.
      //
      // ساختارِ شیت عمداً همان شیتِ «ثبت نشد»ِ آفلاین است — الگویِ درست از
      // قبل در همین فایل بود؛ مکانیزمِ تازه‌ای ساخته نشد.
      haptic('light');
      sheetBody.innerHTML=`
        <div style="text-align:center;padding:24px 16px">
          <div style="font-size:34px;line-height:1;margin-bottom:12px" aria-hidden="true">⏳</div>
          <div class="sheet-title" style="text-align:center">این لحظه شلوغ بود</div>
          <div class="sheet-sub" style="text-align:center">${esc(r.n)} · ${esc(bk.date)} · ${esc(bk.time)}</div>
          <div style="background:var(--warning-soft);color:var(--warning-ink);border-radius:var(--radius-lg);padding:var(--sp-3);font-size:13px;line-height:1.7;text-align:center;margin:14px 0">${esc(res.error?.message||'همین حالا کسِ دیگری داشت همین زمان را رزرو می‌کرد، پس رزروِ تو ثبت نشد. جا هنوز ممکن است باز باشد — دوباره بزن.')}</div>
          <button class="btn btn-primary btn-lg btn-block" onclick="confirmBook(${jsq(String(id))})">تلاش دوباره</button>
          <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
        </div>`;
      return;
    }

    toast('', res.error?.message || 'ثبت رزرو ناموفق بود، دوباره تلاش کن');
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='تأیید رزرو';}
    return;
  }

  // از اینجا به بعد فقط یک حالت ممکن است: رزروِ **واقعی** که سرور تأییدش کرده
  // و کدِ واقعی برگردانده. (مسیرهایِ آفلاین/خطا بالاتر با return بسته شده‌اند —
  // رفعِ P0-3.) پس دیگر شرطِ isOfflineDemo لازم نیست و حذف شد.
  //
  // امتیازِ محلی جعل نمی‌شود؛ عددِ واقعی از سرور می‌آید (وقتی رزرو «انجام‌شد»
  // علامت بخورد XP واقعی ثبت می‌شود؛ اینجا فقط چیپِ نوارِ بالا همگام می‌شود).
  syncNavPoints();
    // ⚠️ A1-006: ردیفِ سفرها هم وضعیتِ واقعی را می‌برد، وگرنه شیت «در انتظار»
  // می‌گفت و فهرست «پیش‌رو» — دو صفحه‌ی یک اپ، دو حرف.
  TRIPS.unshift({rid:id,date:bk.date,time:bk.time,party:bk.party,code,status:'up',awaitingApproval:bookedStatus==='pending'});
  sheetBody.innerHTML=`
    <div class="success">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>
      <!-- ⚠️ A1-006: عنوان از **وضعیتِ واقعی** مشتق می‌شود، نه ادعا.
           الگوی درست از قبل در همین اپ بود — `reservation.js:76`
           (`awaitingApproval`) همین نقص را برای فهرستِ سفرها رفع کرده و
           کامنتش هم همین را می‌گوید: «مشتری فکر می‌کرد میزش قطعی است در
           حالی که رستوران هنوز تأیید نکرده». شیتِ موفقیت آن رفع را نگرفته
           بود. مکانیزمِ تازه‌ای ساخته نشد؛ همان انضباط به این‌جا آمد. -->
      <div class="sheet-title" style="text-align:center">${bookedStatus==='pending'?'رزرو ثبت شد — در انتظارِ تأیید':'رزرو تأیید شد!'}</div>
      <div class="sheet-sub" style="text-align:center">${esc(r.n)} · ${esc(bk.date)} · ${esc(bk.time)}<br>${bookedStatus==='pending'?'این رستوران رزروها را دستی تأیید می‌کند — نتیجه را پیامک می‌کنیم':'یادآور با پیامک می‌فرستیم'}</div>
      <div class="code-box"><div class="cl">کد رزرو</div><div class="cv">${esc(code)}</div><button class="copy-btn" onclick="copyCode(${jsq(code)})" aria-label="کپی کد رزرو">⧉ کپی کد</button></div>
      ${(r.cb>0)?`<div class="reward-row"><div class="reward"><div class="rv teal">${fmtFa(r.cb)}٪</div><div class="rl">کش‌بک</div></div></div>`:''}
      <div style="text-align:center;font-size:12px;color:var(--t3);margin-top:4px">امتیازِ اعتبار بعد از انجامِ رزرو به حسابت اضافه می‌شه</div>
      <button class="btn btn-primary btn-lg btn-block" onclick="closeSheet();go('trips')">رزروهای من</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeSheet()">بستن</button>
    </div>`;
}
export function copyCode(c){haptic('light');const done=()=>toast('⧉','کد کپی شد');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(c).then(done).catch(done);else done()}

// ── نوارِ جست‌وجوی صفحه‌ی اصلی ──
// «کِی» و «چند نفر» پیش از این سه/پنج گزینه‌ی ثابت داشتند که هیچ‌کجا خوانده
// نمی‌شد؛ کاربر انتخاب می‌کرد و هیچ اتفاقی نمی‌افتاد. حالا همان زمینه‌ی رزرو را
// می‌نویسند، پس انتخابشان تا شیتِ رزرو و تا رستورانِ بعدی دنبال می‌آید.
export function initSearchCtx(){
  const when=document.getElementById('sWhen'), party=document.getElementById('sParty');
  if(!when||!party) return;
  const dates=dateOptions();
  const sel=dates.some(d=>d.iso===bookingCtx.date)?bookingCtx.date:dates[0].iso;
  when.innerHTML=dates.map(d=>`<option value="${esc(d.iso)}"${d.iso===sel?' selected':''}>${esc(d.label)}</option>`).join('');
  party.innerHTML=Array.from({length:PARTY_MAX},(_,i)=>i+1)
    .map(n=>`<option value="${n}"${n===bookingCtx.party?' selected':''}>${fmtFa(n)} نفر</option>`).join('');
}
export function syncSearchCtx(){
  const when=document.getElementById('sWhen'), party=document.getElementById('sParty');
  setBookingCtx({
    date: when?.value || bookingCtx.date,
    party: parseInt(party?.value,10) || bookingCtx.party,
  });
  // ⚠️ اضافه‌شده (R4): قبلاً تغییرِ «کِی»/«چند نفر» فقط bookingCtx را
  // می‌نوشت و کاربر باید دکمه‌ی جست‌وجو را می‌زد تا سرنخی از تأثیرش ببیند.
  // حالا هدرِ نتایج بلافاصله زمان/تعدادِ جدید را نشان می‌دهد — اگر صفحه‌ی
  // کشف روی صفحه نباشد (مثلاً کاربر در صفحه‌ی رستوران است)، doSearch به‌طورِ
  // بی‌خطر روی عنصرهایِ نامعتبر no-op می‌شود (querySelector آن‌ها را پیدا
  // نمی‌کند)، پس نیازی به چک‌کردنِ صفحه‌ی فعلی نیست.
  if(document.getElementById('sQ')) doSearch();
  // چیپ‌هایِ ساعتِ کارت‌ها برایِ تاریخ/تعدادِ نفرِ *قبلی* حساب شده‌اند — باطل
  // و دوباره واکشی می‌شوند. بدونِ این، انتخابِ «فردا، ۶ نفر» ساعت‌هایِ «امروز،
  // ۲ نفر» را زیرِ برچسبِ جدید نشان می‌داد.
  invalidateCardSlots();
}

// ── نمایشِ توابعِ onclick روی window (صدازده‌شده در رشته‌های HTML) ──
window.openBookSheet = openBookSheet;
window.quickBook = quickBook;
window.startBook = startBook;
window.bookStep3 = bookStep3;
window.toBookStep3 = toBookStep3;
window.confirmBook = confirmBook;
window.copyCode = copyCode;
window.refreshSlots = refreshSlots;
window.syncSearchCtx = syncSearchCtx;
// نوارِ جست‌وجو باید همان اول پر شود، وگرنه دو selectِ خالی دیده می‌شوند.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSearchCtx);
else initSearchCtx();
