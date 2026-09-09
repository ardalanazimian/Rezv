/* ═══════════════════════════════════════════════════════════
   رزرونو — قراردادِ خطای پنلِ رستوران (کد → متنِ پرسنل + کار)

   اسپک: docs/audit/design/DS-003-panel-error-vocabulary.md §۴‑۳
   (نشستِ Designer `rezv-f3 [54834f]`). یافته مالِ اوست؛ اجرا مالِ من.

   ⚠️ تصحیحِ جمله‌ای که هر سه‌مان تکرار می‌کردیم: «پرسنل خطای **عمومی**
   می‌بینند» دقیق نبود. پنل پیامِ فارسیِ سرور را در ۵۳ جا و ۹ فایل نشان
   می‌دهد؛ متن هست. مشکل این است:

       پنل روی `code` شاخه نمی‌زند، پس هیچ خطایی به یک **کارِ قابلِ انجام**
       ختم نمی‌شود. هر خطا یک toast است و بن‌بست.

   پس کارِ این فایل «نوشتنِ متن» نیست، «وصل‌کردنِ کد به کار» است.

   ── دو تفاوتِ عمدی با نسخه‌ی اپِ کاستومر ──
   ۱. **مخاطب پرسنل است، نه مهمان.** متنِ کاتالوگِ سرور برای مشتری نوشته
      شده. جایی که پیامِ سرور به مهمان می‌گوید چه کند، پنل باید بگوید
      **پرسنل** چه کند — و آن دو یکی نیستند.
   ۲. **هر ردیف یک `action` دارد، نه فقط یک جمله.** الگویش از قبل در همین
      پنل کار می‌کند و فقط گسترش نیافته بود: `۴۰۱ → refresh → retry` و
      `BRANCH_NOT_ACCESSIBLE → پاک‌کردنِ شعبه + یک retry` (`data.js:168-176`).

   ⚠️ آنچه این فایل **نمی‌کند**: پیامِ سرور را دور نمی‌ریزد. هر جا متنِ
   اختصاصیِ پرسنل نداریم، `null` برمی‌گرداند و صداکننده همان پیامِ سرور را
   نشان می‌دهد. سرور دقیق‌ترین متن را دارد؛ چیزی که ندارد، **کار** است.
   ═══════════════════════════════════════════════════════════ */

// عمداً کلاسیک (نه ماژول): پنلِ business با <script> ساده بار می‌شود و یک
// `export`ِ سرگردان کلِ فایل را با SyntaxError می‌کشد — رخدادِ واقعیِ PR #77.

/**
 * کارهایی که پنل واقعاً می‌تواند انجام دهد. هر کدِ خطا به یکی از این‌ها
 * نگاشت می‌شود؛ اگر کاری وجود نداشته باشد `'none'` است و **این را صادقانه
 * می‌گوییم** به‌جای اینکه دکمه‌ی بی‌اثر بگذاریم.
 */
const PANEL_ERROR_ACTIONS = Object.freeze({
  RETRY: 'retry',           // همین حالا دوباره بزن — وضعیتِ کاربر عوض نشده
  RELOGIN: 'relogin',       // نشست تمام است
  CLEAR_BRANCH: 'clear_branch', // انتخابِ شعبه کهنه است
  REFRESH: 'refresh',       // دادهٔ روی صفحه از سرور عقب افتاده
  WAIT: 'wait',             // ۴۲۹ — صبر کن، بعد دوباره. هرگز retryِ خودکار
  NONE: 'none',             // کارِ نرم‌افزاری‌ای نیست؛ تصمیم با آدم است
});

/**
 * کد → { staff، action }.
 * `staff === null` یعنی «پیامِ سرور بهتر است» — بازنویسی نمی‌کنیم.
 */
const PANEL_ERROR_MAP = Object.freeze({
  // ── گذرا: وضعیت عوض نشده، تلاشِ دوباره منطقی است ──
  CONCURRENCY_RETRY:  { staff: 'همین لحظه یک تغییرِ همزمانِ دیگر ثبت شد؛ دوباره بزن.', action: 'retry' },
  SLOT_LOCK_TIMEOUT:  { staff: 'این بازه همین حالا دستِ کسِ دیگری است؛ چند لحظه بعد دوباره بزن.', action: 'retry' },
  // ⚠️ P2024 (ته‌کشیدنِ استخرِ اتصالِ DB) از ۲۰۲۶-۰۹-۰۹ به‌جای ۵۰۰/INTERNAL
  // این را می‌دهد (کامیتِ b0bdfa6، یافته‌ی RT-05 رد تیم). چون رفع در
  // `errorResponse` نشست و نه در یک مسیرِ خاص، **هر** درخواستِ پنل می‌تواند
  // بگیردش — پس از روزِ اول این‌جاست، نه به‌عنوانِ وصله‌ی بعدی.
  SERVICE_UNAVAILABLE:{ staff: 'سرور موقتاً شلوغ است — این خطای تو نیست. چند لحظه بعد دوباره بزن.', action: 'retry' },

  // ── تعارضِ میز: پرسنل باید میزِ دیگری بردارد، نه اینکه دوباره همان را بزند ──
  TABLE_CONFLICT:     { staff: 'این میز در این بازه رزرو شده؛ میزِ دیگری انتخاب کن.', action: 'refresh' },
  TABLE_UNAVAILABLE:  { staff: 'این میز غیرفعال یا در حالِ تعمیر است.', action: 'none' },
  TABLE_TOO_SMALL:    { staff: 'ظرفیتِ این میز برای این تعداد کافی نیست.', action: 'none' },
  TABLE_NOT_FOUND:    { staff: 'این شماره‌ی میز وجود ندارد — فهرستِ میزها را تازه کن.', action: 'refresh' },

  // ── نشست و دسترسی ──
  UNAUTHORIZED:       { staff: 'نشستت تمام شده؛ دوباره وارد شو.', action: 'relogin' },
  FORBIDDEN_TENANT:   { staff: 'به این بخش دسترسی نداری. اگر لازمش داری از مدیر بخواه.', action: 'none' },
  BRANCH_NOT_ACCESSIBLE: { staff: 'شعبه‌ی انتخاب‌شده دیگر در دسترس نیست؛ شعبه را دوباره انتخاب کن.', action: 'clear_branch' },

  // ── دادهٔ کهنه روی صفحه ──
  RESERVATION_EXPIRED:{ staff: 'مهلتِ این مورد گذشته — فهرست را تازه کن.', action: 'refresh' },

  // ═══ ردیفِ بازِ DS-003 §۵ — **تأیید شد، رد نشد** ═══
  // فرضیه این بود: سه پیامِ کاتالوگ خواننده را به «تماس با رستوران» هدایت
  // می‌کنند؛ اگر به پنل برسند، به کارکنانِ رستوران گفته می‌شود با رستوران
  // تماس بگیرند. `rezv-f3` دو مسیرِ پرسنلی را ترِیس کرد و نرسید — ولی
  // مسیرِ **رزروِ دستی** را ندیده بود:
  //     apps/business/js/reservations.js:512  API.post('/reservations', …)
  //     → api/src/app/api/v1/reservations/route.ts (شاخه‌ی پرسنلی)
  //     → createReservation()  ← هر سه پیام از همین‌جا می‌آیند
  //
  // اندازه‌گیریِ خطِ به خط، چون «قابلِ دسترسی» با «واقعاً می‌رسد» فرق دارد:
  //   RESTAURANT_OFFLINE (reservations.ts:121) → پشتِ `source === 'app'`
  //       است، پس رزروِ دستیِ پرسنل **مستثنا**. `rezv-f3` درباره‌ی این یکی
  //       درست گفته بود و ردیفش این‌جا نیست.
  //   PARTY_TOO_LARGE (:128)  → **هیچ گاردی ندارد.** پرسنلی که گروهِ ۱۳
  //       نفره را دستی ثبت کند می‌بیند: «حداکثر ظرفیت رزرو آنلاین ۱۲ نفر
  //       است؛ برای گروه بزرگ‌تر با رستوران تماس بگیرید» — یعنی به کارکنانِ
  //       رستوران گفته می‌شود با رستوران تماس بگیرند، درباره‌ی سقفِ «رزروِ
  //       آنلاین» که اصلاً به رزروِ دستی‌شان ربط ندارد.
  //   SLOT_FULL (:277 و بعدی‌ها) → گاردِ منبع ندارد؛ ظرفیت ظرفیت است.
  //       «زمان دیگری انتخاب کنید» توصیه‌ی مهمان است. کارِ پرسنل فرق دارد.
  PARTY_TOO_LARGE:    { staff: 'گروهِ بزرگ‌تر از سقفِ رزروِ آنلاین است — میزها را ترکیب کن یا رزرو را دستی روی چند میز ببند.', action: 'none' },
  SLOT_FULL:          { staff: 'این ساعت پر است — لیستِ انتظار یا ساعتِ دیگر.', action: 'refresh' },

  // ⚠️ عمداً **بدونِ متنِ اختصاصی**: پیامِ سرور برای این‌ها دقیق‌تر از هر
  // چیزی است که این‌جا بنویسیم (کدام فیلد، کدام منبع، چه محدودیتی).
  // فقط `action` اضافه می‌شود.
  VALIDATION:         { staff: null, action: 'none' },
  NOT_FOUND:          { staff: null, action: 'refresh' },
  FEATURE_DISABLED:   { staff: null, action: 'none' },
  INVALID_STATUS_TRANSITION: { staff: null, action: 'refresh' },

  // ⚠️ `RATE_LIMITED` تنها ردیفی است که یک **حالت** لازم دارد، نه یک جمله —
  // پس متن و کارش از `PANEL_ERROR_MAP` نمی‌آید بلکه از `panelRateLimitPlan`
  // پایین. دیروز عمداً بیرون ماند تا کسی بی‌سروصدا به `retry` نگاشتش نکند؛
  // امروز اسپکش رسید (DS-003 §۴‑۵) و پیاده شد.
  RATE_LIMITED:       { staff: null, action: 'wait' },
});

// ═══════════ RATE_LIMITED — سه سطح، طبقِ DS-003 §۴‑۵ ═══════════
//
// ⚠️ **قاعده‌ی صفر: هرگز retryِ خودکار.** ۴۲۹ یعنی «زیادی زدی»؛ زدنِ خودکار
// بار را بیشتر می‌کند و علت را از چشمِ کاربر پنهان.
//
// ⚠️ چرا حالت روی **دکمه** می‌نشیند و نه در توست: توستِ این پنل ۲۴۰۰ms است
// (`staff-system.js:163`). برای انتظارِ ۴۵ثانیه‌ای به‌تنهایی بی‌فایده است —
// پیام می‌رود، پرسنل دوباره می‌زند، دوباره می‌خورد.
//
// ⚠️ و چرا عددِ ثابتی درست نیست: بازه‌ی واقعیِ قاعده‌ها ۱ ثانیه تا ۱۵ دقیقه
// است (`ratelimit.ts`: `qrCheckin` ۳۰/دقیقه ولی `adminTotpLogin` ۵ در **۱۵**
// دقیقه). مقدار باید از `details.retryAfterSec` بیاید که سرور در
// `errors.ts:27` می‌فرستد.

const RATE_LIMIT_BRIEF_SEC = 10;    // ≤ این → «چند لحظه صبر کن»
const RATE_LIMIT_LOCK_SEC = 120;    // > این → قفلِ امنیتی، نه ترافیک

/** ثانیه‌ی انتظار از پاسخِ سرور — یا `null` اگر نداده. */
function panelRetryAfterSec(err) {
  const v = err && err.details && err.details.retryAfterSec;
  return typeof v === 'number' && v > 0 ? Math.ceil(v) : null;
}

/**
 * نقشه‌ی نمایش برای یک ۴۲۹. **داده برمی‌گرداند، نه متن** — قالب‌بندیِ ارقام
 * فارسی با `fa()` در محلِ مصرف می‌ماند تا این ماژول نسخه‌ی دومِ `format.js`
 * نشود (همان کلاسِ «یک واقعیت، چند رونوشت»).
 *
 * `tier`:
 *   `brief`     — کوتاه یا نامعلوم: دکمه غیرفعال، بدونِ عدد
 *   `countdown` — ۱۱..۱۲۰ ثانیه: عددِ **زنده**ی کم‌شونده روی دکمه
 *   `locked`    — >۱۲۰: **قفلِ امنیتی است نه ترافیک.** عددِ ثابتِ دقیقه‌ای،
 *                 شمارشِ زنده **نه** — شمارنده‌ی ۱۵دقیقه‌ای فقط کاربر را به
 *                 تماشا وامی‌دارد. و متنش نباید «شلوغه» باشد: `passwordLogin`
 *                 و `adminTotpLogin` وقتی می‌خورند یعنی رمز اشتباه بوده، و
 *                 «دوباره بزن» او را به تکرارِ همان کار می‌فرستد.
 */
function panelRateLimitPlan(err) {
  const sec = panelRetryAfterSec(err);
  // ⚠️ نبودِ عدد → عدد **اختراع نکن**. «چند لحظه» صادق است؛ عددِ حدسیِ غلط نه.
  if (sec === null || sec <= RATE_LIMIT_BRIEF_SEC) {
    return { tier: 'brief', sec: sec, countdown: false, holdSec: sec || RATE_LIMIT_BRIEF_SEC };
  }
  if (sec <= RATE_LIMIT_LOCK_SEC) {
    return { tier: 'countdown', sec: sec, countdown: true, holdSec: sec };
  }
  return { tier: 'locked', sec: sec, minutes: Math.ceil(sec / 60), countdown: false, holdSec: sec };
}

/**
 * متنِ فارسیِ حالت. `faFn` تزریق می‌شود (پیش‌فرض: بدونِ تبدیل) تا تست بتواند
 * بدونِ `format.js` اجرایش کند و ماژول به ترتیبِ بارگذاری گره نخورد.
 */
function panelRateLimitText(err, faFn) {
  const f = typeof faFn === 'function' ? faFn : function (n) { return String(n); };
  const p = panelRateLimitPlan(err);
  if (p.tier === 'brief') return 'چند لحظه صبر کن، بعد دوباره بزن.';
  if (p.tier === 'countdown') return `${f(p.sec)} ثانیه دیگر دوباره بزن.`;
  return `به‌خاطرِ تلاش‌های زیاد، ${f(p.minutes)} دقیقه قفل شد. اگر رمز را فراموش کرده‌ای از مدیر بخواه بازنشانی کند.`;
}

/**
 * متنی که باید به پرسنل نشان داده شود.
 * اگر ردیفِ اختصاصی نداشته باشیم یا `staff === null` باشد، **پیامِ سرور**
 * برمی‌گردد؛ و اگر آن هم نبود، `fallback`.
 */
function panelErrorText(err, fallback, faFn) {
  // ⚠️ RATE_LIMITED متنش به **مقدار** وابسته است، نه فقط به کد — پس از
  // نقشه‌ی سه‌سطحی می‌آید. این‌جا delegate می‌شود تا هر صداکننده‌ی موجود
  // خودکار متنِ درست را بگیرد، نه فقط محلی که خبر دارد.
  if (err && err.code === 'RATE_LIMITED') return panelRateLimitText(err, faFn);
  const row = err && err.code ? PANEL_ERROR_MAP[err.code] : null;
  if (row && row.staff) return row.staff;
  return (err && err.message) || fallback || 'یک مشکلِ غیرمنتظره پیش آمد';
}

/** کارِ پیشنهادی برای این خطا — همیشه یکی از `PANEL_ERROR_ACTIONS`. */
function panelErrorAction(err) {
  const row = err && err.code ? PANEL_ERROR_MAP[err.code] : null;
  return (row && row.action) || 'none';
}

/**
 * آیکونِ toast بر اساسِ **کار**، نه بر اساسِ کد.
 *
 * ⚠️ چرا این تابع وجود دارد و چرا کوچک است: `action` باید **امروز** یک
 * مصرف‌کننده‌ی واقعی داشته باشد، وگرنه یک فیلدِ مرده است که ادعای قابلیت
 * می‌کند — همان کلاسی که کلِ این قرارداد درباره‌اش است. `toast(icon, msg)`
 * از قبل آرگومانِ آیکون دارد، پس این کوچک‌ترین مصرفِ صادقانه است:
 * «دوباره بزن» از «کاری از دستت برنمی‌آید» با یک نگاه فرق می‌کند.
 *
 * این **جایگزینِ** کارِ واقعی نیست. دکمه‌ی «تلاشِ دوباره» داخلِ toast نیاز به
 * UIِ تازه دارد و آن یک تصمیمِ طراحی است، نه چیزی که این‌جا اختراعش کنم.
 */
function panelErrorIcon(err) {
  switch (panelErrorAction(err)) {
    case 'retry':        return '⏳';
    case 'wait':         return '⏱';
    case 'relogin':      return '🔑';
    case 'clear_branch': return '🏠';
    case 'refresh':      return '↻';
    default:             return '';
  }
}

/**
 * دکمه را تا پایانِ انتظار نگه می‌دارد.
 *
 * ⚠️ الگویش تازه نیست: `crm.js:258,268` از قبل `btn.disabled=true` +
 * `btn.textContent` متغیر را دارد و کار می‌کند. این فقط همان را با زمان‌بندی
 * می‌بندد — و **هرگز خودش درخواست نمی‌زند** (قاعده‌ی صفرِ §۴‑۵).
 *
 * ⚠️ شمارنده از عددِ **لحظه‌ی دریافت** می‌شمارد، نه با پرسیدن از سرور.
 * پرسیدنِ «چقدر مانده؟» خودش یک درخواست است — یعنی گاردِ نرخ را با ابزارِ
 * نمایشِ گاردِ نرخ می‌شکستیم.
 *
 * سطحِ `locked` عمداً شمارنده‌ی زنده ندارد: یک شمارنده‌ی ۱۵دقیقه‌ای فقط کاربر
 * را به تماشا وامی‌دارد. ولی دکمه در پایانِ مدت آزاد می‌شود — قفلِ همیشگی
 * یعنی کاربر مجبور به رفرش است، که خودش یک درخواستِ دیگر است.
 */
function holdButtonForRetry(btn, err, restoreText, faFn) {
  if (!btn) return null;
  const plan = panelRateLimitPlan(err);
  const f = typeof faFn === 'function' ? faFn : function (n) { return String(n); };
  btn.disabled = true;

  let timer = null;
  if (plan.countdown) {
    let left = plan.sec;
    btn.textContent = `${f(left)} ثانیه…`;
    timer = setInterval(function () {
      left -= 1;
      if (left > 0) { btn.textContent = `${f(left)} ثانیه…`; return; }
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = restoreText;
    }, 1000);
  } else {
    btn.textContent = restoreText;
    timer = setTimeout(function () {
      btn.disabled = false;
      btn.textContent = restoreText;
    }, plan.holdSec * 1000);
  }
  // برگرداندنِ handle تا تست/فراخوان بتواند پاکش کند و تایمر نشت نکند.
  return timer;
}
