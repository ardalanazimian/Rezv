/* ═══════════════════════════════════════════════════════════
   رزرونو — مکانیزمِ مشترکِ نمایشِ ۴۲۹ (RATE_LIMITED)
   این فایل منبعِ حقیقت است؛ tools/sync-design-system.sh آن را به اپ‌ها می‌سازد.

   اسپک: docs/audit/design/DS-003-panel-error-vocabulary.md §۴‑۵
   (نشستِ Designer). اجرا: مهندسِ لانچ.

   ⚠️ **چرا مشترک و نه یک رونوشت در هر پنل:** مرزهای سه سطح (۱۰ و ۱۲۰ ثانیه)
   و قاعده‌ی «هرگز retryِ خودکار» یک **واقعیتِ واحد**اند. دو رونوشت از یک
   عدد، همان کلاسی است که این مخزن پنج بار در یک روز پرداختش: نگاشتِ سطحِ
   وفاداری، `STATUS_META`، `ST_FA`، نگاشتِ مرده‌ی `company`، و پوششِ
   `details.reason`. عددی که در دو جا زندگی کند، بالاخره واگرا می‌شود.

   ⚠️ **و چرا فقط مکانیزم مشترک است، نه متن:** مخاطبِ هر پنل فرق دارد —
   پرسنلِ رستوران، مدیرِ پلتفرم، مهمان. پس نگاشتِ `code → متن` مالِ خودِ
   پنل می‌ماند و این فایل هیچ جمله‌ای درباره‌ی «تو کی هستی» نمی‌گوید.
   یک مکانیزم، چند واژگان.

   ── قاعده‌ی صفر ──
   **هرگز retryِ خودکار.** ۴۲۹ یعنی «زیادی زدی»؛ زدنِ خودکار بار را بیشتر
   می‌کند، پنجره را تمدید می‌کند، و علت را از چشمِ کاربر پنهان.
   ═══════════════════════════════════════════════════════════ */

// ⚠️ چرا عددِ ثابت درست نیست: بازه‌ی واقعیِ قاعده‌ها ۱ ثانیه تا ۱۵ دقیقه است
// (`api/src/lib/ratelimit.ts`: `qrCheckin` ۳۰ در دقیقه، ولی `adminTotpLogin`
// ۵ در **۱۵** دقیقه). مقدار باید از `details.retryAfterSec` بیاید که سرور در
// `errors.ts:27` می‌فرستد.
export const RATE_LIMIT_BRIEF_SEC = 10;   // ≤ این → «چند لحظه صبر کن»
export const RATE_LIMIT_LOCK_SEC = 120;   // > این → قفلِ امنیتی، نه ترافیک

/** ثانیه‌ی انتظار از پاسخِ سرور — یا `null` اگر نداده. */
export function retryAfterSec(err) {
  const v = err && err.details && err.details.retryAfterSec;
  return typeof v === 'number' && v > 0 ? Math.ceil(v) : null;
}

/**
 * نقشه‌ی نمایش برای یک ۴۲۹. **داده برمی‌گرداند، نه متن** — قالب‌بندیِ ارقامِ
 * فارسی با `fa()` در محلِ مصرف می‌ماند تا این فایل نسخه‌ی دومِ `format.js`
 * نشود.
 *
 *   `brief`     — کوتاه یا نامعلوم: دکمه قفل، بدونِ عدد
 *   `countdown` — ۱۱..۱۲۰ ثانیه: عددِ **زنده**ی کم‌شونده روی دکمه
 *   `locked`    — >۱۲۰: عددِ ثابتِ دقیقه‌ای، شمارشِ زنده **نه**. شمارنده‌ی
 *                 ۱۵دقیقه‌ای فقط کاربر را به تماشا وامی‌دارد.
 */
export function rateLimitPlan(err) {
  const sec = retryAfterSec(err);
  // ⚠️ نبودِ عدد → عدد **اختراع نکن**. «چند لحظه» صادق است؛ عددِ حدسی نه.
  if (sec === null || sec <= RATE_LIMIT_BRIEF_SEC) {
    return { tier: 'brief', sec: sec, countdown: false, holdSec: sec || RATE_LIMIT_BRIEF_SEC };
  }
  if (sec <= RATE_LIMIT_LOCK_SEC) {
    return { tier: 'countdown', sec: sec, countdown: true, holdSec: sec };
  }
  return { tier: 'locked', sec: sec, minutes: Math.ceil(sec / 60), countdown: false, holdSec: sec };
}

/**
 * دکمه را تا پایانِ انتظار نگه می‌دارد — و **هرگز خودش درخواست نمی‌زند**.
 *
 * ⚠️ شمارنده از عددِ **لحظه‌ی دریافت** می‌شمارد، نه با پرسیدن از سرور.
 * پرسیدنِ «چقدر مانده؟» خودش یک درخواست است — یعنی گاردِ نرخ را با ابزارِ
 * نمایشِ گاردِ نرخ می‌شکستیم.
 *
 * سطحِ `locked` شمارنده‌ی زنده ندارد، ولی دکمه در پایانِ مدت آزاد می‌شود:
 * قفلِ همیشگی کاربر را مجبور به رفرش می‌کند، که خودش یک درخواستِ دیگر است.
 *
 * خروجی: handleِ تایمر، تا صداکننده/تست بتواند پاکش کند و نشت نکند.
 */
export function holdButtonForRetry(btn, err, restoreText, faFn) {
  if (!btn) return null;
  const plan = rateLimitPlan(err);
  const f = typeof faFn === 'function' ? faFn : function (n) { return String(n); };
  btn.disabled = true;

  if (plan.countdown) {
    let left = plan.sec;
    btn.textContent = `${f(left)} ثانیه…`;
    const iv = setInterval(function () {
      left -= 1;
      if (left > 0) { btn.textContent = `${f(left)} ثانیه…`; return; }
      clearInterval(iv);
      btn.disabled = false;
      btn.textContent = restoreText;
    }, 1000);
    return iv;
  }
  btn.textContent = restoreText;
  return setTimeout(function () {
    btn.disabled = false;
    btn.textContent = restoreText;
  }, plan.holdSec * 1000);
}
