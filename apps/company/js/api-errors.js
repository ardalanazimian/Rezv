/* ═══════════════════════════════════════════════════════════
   رزرونو — قراردادِ خطای پنلِ شرکت (کد → متنِ مدیرِ پلتفرم + کار)

   اسپک: docs/audit/design/DS-003-panel-error-vocabulary.md §۴‑۳
   (نشستِ Designer). اجرا: مهندسِ لانچ.

   ⚠️ اندازه‌گیریِ پیش از ساختن: `apps/company` از ۲۸ کدِ `errors.ts`
   **صفر** تا را مصرف می‌کرد — بدتر از پنلِ کسب‌وکار که دو تا داشت. ۲۵ جا
   پیامِ سرور را **نمایش** می‌دادند (که درست است) ولی هیچ‌جا روی `code`
   شاخه نمی‌زد، پس هیچ خطایی به یک **کارِ قابلِ انجام** ختم نمی‌شد.

   ⚠️ تنها مصرفِ کدمحورِ موجود `details.reason` در `overview.js` بود — که
   نگاشتش هم ناقص بود (۴ از ۵) و در `ee070f4` رفع شد.

   ── مخاطب: **مدیرِ پلتفرم**، نه پرسنلِ رستوران، نه مهمان ──
   همان کد، در سه پنل، سه متنِ متفاوت می‌خواهد. پس مکانیزمِ ۴۲۹ مشترک است
   (`rate-limit-ui.js` از `shared/js/`) ولی این نگاشت مالِ همین پنل است.
   ═══════════════════════════════════════════════════════════ */

// عمداً کلاسیک (نه ماژول): پنلِ شرکت با <script> ساده بار می‌شود و یک
// `export`ِ سرگردان کلِ فایل را با SyntaxError می‌کشد — رخدادِ واقعیِ PR #77.

const CO_ERROR_ACTIONS = Object.freeze({
  RETRY: 'retry',       // وضعیت عوض نشده؛ همین حالا دوباره
  WAIT: 'wait',         // ۴۲۹ — صبر کن. هرگز retryِ خودکار
  RELOGIN: 'relogin',   // نشست تمام است
  REFRESH: 'refresh',   // دادهٔ روی صفحه از سرور عقب افتاده
  NONE: 'none',         // کارِ نرم‌افزاری‌ای نیست
});

/**
 * کد → { admin، action }. `admin === null` یعنی «پیامِ سرور بهتر است».
 *
 * ⚠️ `VALIDATION` و `CONFLICT` عمداً متنِ اختصاصی ندارند: پیامِ سرور
 * **مشخص‌تر** است (کدام فیلد، کدام slug، کدام نامِ کاربری). بازنویسی‌اش
 * اطلاعات را نابود می‌کند، نه بهترش.
 */
const CO_ERROR_MAP = Object.freeze({
  // ⚠️ P2024 → ۵۰۳. چون رفع در `errorResponse` نشست، **هر** درخواستِ پنل
  // می‌تواند بگیردش (کامیتِ b0bdfa6، یافته‌ی RT-05).
  SERVICE_UNAVAILABLE: { admin: 'سرور موقتاً شلوغ است — این خطای تو نیست. چند لحظه بعد دوباره بزن.', action: 'retry' },
  CONCURRENCY_RETRY:   { admin: 'یک تغییرِ همزمانِ دیگر ثبت شد؛ دوباره بزن.', action: 'retry' },

  UNAUTHORIZED:        { admin: 'نشستت تمام شده؛ دوباره وارد شو.', action: 'relogin' },
  FORBIDDEN_TENANT:    { admin: 'این حساب دسترسیِ پلتفرمی ندارد.', action: 'none' },

  NOT_FOUND:           { admin: null, action: 'refresh' },
  VALIDATION:          { admin: null, action: 'none' },
  CONFLICT:            { admin: null, action: 'none' },

  // ⚠️ حساس‌ترین ردیفِ این پنل. `adminTotpLogin` سقفِ **۵ در ۱۵ دقیقه**
  // است (`ratelimit.ts:237`) — بلندترین پنجره‌ی کلِ سیستم — و روی مسیرِ
  // ورودِ مدیرِ پلتفرم نشسته. متن از `rate-limit-ui.js` می‌آید چون به
  // **مقدار** وابسته است، نه فقط به کد.
  RATE_LIMITED:        { admin: null, action: 'wait' },
});

/** متنی که باید به مدیرِ پلتفرم نشان داده شود. */
function coErrorText(err, fallback, faFn) {
  // ۴۲۹ متنش از مقدار می‌آید، پس به مکانیزمِ مشترک سپرده می‌شود.
  if (err && err.code === 'RATE_LIMITED') return coRateLimitText(err, faFn);
  const row = err && err.code ? CO_ERROR_MAP[err.code] : null;
  if (row && row.admin) return row.admin;
  return (err && err.message) || fallback || 'یک مشکلِ غیرمنتظره پیش آمد';
}

/** کارِ پیشنهادی — همیشه یکی از `CO_ERROR_ACTIONS`. */
function coErrorAction(err) {
  const row = err && err.code ? CO_ERROR_MAP[err.code] : null;
  return (row && row.action) || 'none';
}

/**
 * متنِ سه‌سطحیِ ۴۲۹ برای **مدیرِ پلتفرم**.
 *
 * ⚠️ سطحِ `locked` عمداً «شلوغه دوباره بزن» نمی‌گوید: روی این مسیر یعنی
 * رمز یا کدِ TOTP اشتباه بوده، و «دوباره بزن» مدیر را به تکرارِ همان کار
 * می‌فرستد — که پنجره را تمدید می‌کند. مرزها و نقشه از `rate-limit-ui.js`
 * می‌آیند تا عدد در دو جا زندگی نکند.
 */
function coRateLimitText(err, faFn) {
  const f = typeof faFn === 'function' ? faFn : function (n) { return String(n); };
  const p = rateLimitPlan(err);
  if (p.tier === 'brief') return 'چند لحظه صبر کن، بعد دوباره بزن.';
  if (p.tier === 'countdown') return `${f(p.sec)} ثانیه دیگر دوباره بزن.`;
  return `به‌خاطرِ تلاش‌های ناموفق، ورود ${f(p.minutes)} دقیقه قفل شد. کدِ TOTP و رمز را کنترل کن — تلاشِ دوباره پنجره را تمدید می‌کند.`;
}

/** آیکونِ toast بر اساسِ **کار** — کوچک‌ترین مصرفِ صادقانه‌ی `action`. */
function coErrorIcon(err) {
  switch (coErrorAction(err)) {
    case 'retry':   return '⏳';
    case 'wait':    return '⏱';
    case 'relogin': return '🔑';
    case 'refresh': return '↻';
    default:        return '';
  }
}
