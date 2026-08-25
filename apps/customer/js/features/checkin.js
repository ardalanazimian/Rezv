// ═══════════════════════════════════════════════════════════════════════
//  ورود با QRِ میز — مهمان استیکرِ رویِ میز را اسکن می‌کند
//
//  جریانِ کامل:
//    ۱) رستوران‌دار از پنل QRِ هر میز را چاپ می‌کند و رویِ میز می‌گذارد.
//    ۲) QR به `https://app.<domain>/?checkin=<CODE>` اشاره می‌کند.
//    ۳) مهمان اسکن می‌کند → همین اپ باز می‌شود → این ماژول پارامتر را
//       می‌بیند و `POST /api/v1/checkin` می‌زند.
//    ۴) بک‌اند رزروِ فعالِ همان میز و همان بازه را پیدا می‌کند، از مسیرِ
//       چرخه‌ی حیات به `checked_in` و بعد `seated` می‌برد، و میز را
//       `occupied` می‌کند.
//
//  ⚠️ چرا این فایل تازه است (ممیزیِ ۲۰۲۶-۰۸-۲۱): قابلیت شیپ شده بود ولی
//  هیچ‌وقت کار نمی‌کرد. `POST /api/v1/checkin` عمومی سرو می‌شد، ولی
//  `assignQrCode()` در بک‌اند **صفر فراخوان** داشت و هیچ روتی `qr_code` را
//  ست نمی‌کرد — تنها میزهایِ دارایِ کد، داده‌ی `[DEMO]`ِ seed بودند. ضمناً
//  هیچ‌کدام از سه اپ اصلاً پارامترِ ورودی را نمی‌خواندند، یعنی حتی اگر QRی
//  وجود داشت، اسکن‌کردنش هیچ اتفاقی نمی‌انداخت.
//
//  ورود لازم **نیست**: مهمانِ مهمان‌گونه (بدونِ لاگین) هم باید بتواند سرِ
//  میز بنشیند. `POST /api/v1/checkin` **بدونِ احراز هویتِ کاربر** سرو می‌شود،
//  ولی نه بدونِ اعتبارنامه: اعتبارنامه خودِ کدِ QR است (۵۰ بیت آنتروپیِ
//  رمزنگارانه از `genQrToken` در `api/src/lib/tables.ts`) به‌علاوه‌ی
//  ریت‌لیمیتِ اختصاصیِ per-IP روی همان مسیر.
//
//  ⚠️ اگر لاگین باشی، توکنت هم فرستاده می‌شود — نه برای اجازه‌ی check-in،
//  بلکه فقط تا سرور بتواند `reservation_code` را نشان دهد. برای فراخوانِ
//  ناشناس آن فیلد همیشه `null` است (نشتِ کدِ رزروِ فردِ دیگر). پس **هرگز**
//  از `reservation_code` برای تشخیصِ موفقیت استفاده نکن — فیلدِ درست
//  `checked_in` است.
// ═══════════════════════════════════════════════════════════════════════

import { API } from '../api.js';
import { closeSheet, esc, openSheet } from '../auth.js';

/** پارامترِ کدِ میز در URL. اگر نبود، `null`. */
export function pendingCheckInCode() {
  try {
    const code = new URLSearchParams(location.search).get('checkin');
    return code && code.trim() ? code.trim() : null;
  } catch {
    return null;   // URL خراب/محیطِ بدونِ location — بی‌صدا رد شو
  }
}

/**
 * پارامتر را از نوارِ آدرس پاک می‌کند تا رفرش یا اشتراک‌گذاریِ لینک،
 * check-in را دوباره اجرا نکند.
 *
 * `replaceState` استفاده می‌شود نه `pushState`: نباید یک ورودیِ اضافه در
 * تاریخچه بسازیم که دکمه‌ی بازگشتِ مرورگر را به همان لینک برگرداند.
 */
function clearCheckInParam() {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('checkin');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  } catch { /* محیطِ file: یا مرورگرِ قدیمی — بی‌اهمیت */ }
}

/** شیتِ نتیجه. `title` و `body` هردو متنِ ماست، نه ورودیِ کاربر. */
function resultSheet(emoji, title, body, extra) {
  openSheet(`<div style="text-align:center;padding:8px 0">
    <div style="font-size:44px;line-height:1">${emoji}</div>
    <div class="sheet-title" style="text-align:center;margin-top:8px">${title}</div>
    <div class="sheet-sub" style="text-align:center">${body}</div>
    ${extra || ''}
  </div>
  <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="closeSheet()">باشه</button>`);
}

/**
 * اجرایِ check-in اگر لینک کدِ میز داشت. در `boot()` صدا زده می‌شود.
 *
 * هیچ‌وقت throw نمی‌کند: اگر بک‌اند در دسترس نباشد یا کد نامعتبر باشد،
 * پیامِ روشن نشان می‌دهد و بقیه‌ی اپ سرِ جایش کار می‌کند — طبقِ بندِ ۴۶،
 * این قابلیت نباید مسیرِ اصلیِ اپ را بشکند.
 */
export async function runPendingCheckIn() {
  const code = pendingCheckInCode();
  if (!code) return;

  // پارامتر همین اول پاک می‌شود، نه بعد از پاسخ: اگر مهمان وسطِ درخواست
  // صفحه را رفرش کند، نباید دوباره اجرا شود.
  clearCheckInParam();

  const res = await API.post('/checkin', { qr_code: code });

  if (res.offline) {
    resultSheet('📶', 'اتصال برقرار نشد',
      'اینترنتت رو چک کن و دوباره کد رو اسکن کن. اگر باز هم نشد، به میزبان بگو.');
    return;
  }

  if (!res.ok) {
    // ۴۰۴ = کدِ ناشناس (استیکرِ قدیمی/مالِ رستورانِ دیگر). بقیه = خطایِ واقعی.
    const notFound = res.status === 404;
    resultSheet('⚠️',
      notFound ? 'این کد شناخته نشد' : 'ثبتِ ورود انجام نشد',
      notFound
        ? 'شاید استیکرِ میز قدیمی باشه. به میزبان بگو تا دستی ثبتت کنه.'
        : esc(res.error?.message || 'یه مشکلی پیش اومد. به میزبان بگو.'));
    return;
  }

  const d = res.data || {};
  const tableNo = d.table_number;
  const tableLine = tableNo != null
    ? `<div style="margin-top:10px;font-size:13px;color:var(--t2)">میز ${esc(String(tableNo))}</div>`
    : '';

  // `checked_in === false` یعنی میز پیدا شد ولی رزروِ فعالی رویش نبود.
  // این خطا نیست — مثلاً مهمانِ بدونِ رزرو (walk-in) که کد را اسکن کرده.
  // صادقانه همین را می‌گوییم، نه «خوش آمدید» که یعنی ثبتی انجام شده.
  //
  // ⚠️ اینجا قبلاً `!d.reservation_code` بود و آن شرط از وقتی سرور کدِ رزرو
  // را فقط به صاحبِ همان رزرو می‌دهد **غلط** است: مهمانِ بدونِ لاگین
  // `reservation_code: null` می‌گیرد حتی وقتی ورودش واقعاً ثبت شده — یعنی
  // به کسی که نشسته می‌گفتیم «رزروی پیدا نشد». جعلِ شکست دقیقاً به‌اندازه‌ی
  // جعلِ موفقیت مضر است؛ پس تصمیم از یک فیلدِ صریح خوانده می‌شود.
  if (!d.checked_in) {
    resultSheet('🪑', 'رزروی رویِ این میز پیدا نشد',
      'اگر رزرو داری، شاید هنوز زمانش نرسیده باشه. برای نشستن با میزبان هماهنگ کن.',
      tableLine);
    return;
  }

  // کدِ رزرو فقط وقتی نشان داده می‌شود که سرور آن را داده باشد (یعنی با
  // حسابِ خودت وارد شده‌ای و رزرو مالِ توست). نبودنش هیچ ربطی به موفقیتِ
  // ثبتِ ورود ندارد.
  const codeLine = d.reservation_code
    ? `<div style="margin-top:6px;font-family:monospace;font-size:12px;color:var(--t3);direction:ltr">${esc(d.reservation_code)}</div>`
    : '';

  resultSheet('✅', 'ورودت ثبت شد',
    'خوش اومدی! میزت آماده‌ست.',
    `${tableLine}${codeLine}`);
}

// پنل/اکشن‌های سراسری این اپ از `window` استفاده می‌کنند (onclickهای inline).
window.closeSheet = window.closeSheet || closeSheet;
