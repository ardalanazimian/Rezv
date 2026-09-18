import { randomInt } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  شماره‌ی تلفنِ یکتا برای فیکسچرهای تست
//
//  ⚠️ چرا این فایل وجود دارد (flakeِ واقعی، ۲۰۲۶-۰۸-۲۰، با قرمزشدنِ CI اثبات
//  شد نه با حدس): سه فایلِ تست هرکدام نسخه‌ی کپی‌شده‌ی خودشان از
//  `` `0938${String(Date.now()).slice(-7)}` `` را داشتند — و دوتاشان
//  (feature-parity و temporal-leakage) *بایت‌به‌بایت* یکی بودند، با پیشوندِ
//  یکسان.
//
//  رانرِ ما همه‌ی فایل‌ها را در **یک** process اجرا می‌کند
//  (به `_all.runner.mts` رجوع کنید)، پس دو hookِ `before` می‌توانند در یک
//  میلی‌ثانیه بیفتند و شماره‌ی یکسان بسازند. آن‌وقت `users_phone_key` نقض
//  می‌شود، hook می‌افتد، و `node:test` **کلِ** سوئیت را cancel می‌کند —
//  ۶۱۷ تست از یک برخوردِ تصادفی، بدونِ هیچ ربطی به کدِ تولید.
//
//  شواهد: job 96516341521 —
//  «duplicate key value violates unique constraint "users_phone_key",
//   Key (phone)=(09386548246) already exists».
//
//  چرا محلی دیده نمی‌شد: برخورد به هم‌زمانیِ میلی‌ثانیه‌ای وابسته است؛ دو
//  اجرای کاملِ محلی (۶۱۷/۶۱۷) اتفاقاً برخورد نکردند. یعنی این تستِ ضعیف
//  نبود، یک بمبِ ساعتیِ احتمالاتی بود که هر PRی را تصادفی قرمز می‌کرد.
//
//  رفع: یک تولیدکننده‌ی مشترک با آنتروپیِ رمزنگارانه به‌جای زمان، و
//  پیشوندِ اجباریِ **متفاوت** برای هر فایل. چون تولیدکننده یکی است، دیگر
//  نمی‌شود یک نسخه را عوض کرد و نسخه‌های دیگر عقب بمانند.
//
//  ⚠️ افزوده‌ی ۲۰۲۶-۰۹-۱۷ (m-21، یافته‌ی rezv-31، سنجیده‌ی CEO روی main): «یک پیشوند
//  برای هر فایل» فقط یک قرارِ نوشته بود. سرشماری روی main (8b63e61): **۲۷** پیشوند در بیش از
//  یک فایل (۰۹۲۱ در سه فایل، ۰۹۲۲ در چهار). و «تصادف لایه‌ی دوم» احتمالاتی است: dna-summary
//  یک `beforeEach`ِ سطحِ ماژول داشت که در رانرِ تک‌پروسه برای تست‌های فایل‌های دیگر هم کاربرِ
//  ۰۹۲۱ می‌ساخت (اجرای کامل ۳۶۵ تا باقی گذاشت) — هر شماره‌ی تکراری `users_phone_key` را
//  می‌شکند و تستی را قرمز می‌کند که ربطی ندارد. پس هر دو لایه حالا **اجرا** می‌شوند، نه توصیه:
//   ۱) مالکیتِ پیشوند: اولین فایلی که یک پیشوند را برمی‌دارد مالکش است؛ فایلِ دیگر همان
//      لحظه خطای PHONE_PREFIX_REUSE می‌گیرد با نامِ هر دو فایل — قرمزِ قطعی، نه ۱۶٪.
//      فایل از stackِ فراخوان خوانده می‌شود، پس پیشوندی که از ثابت یا متغیر می‌آید هم دیده می‌شود.
//   ۲) یکتاییِ درون‌پروسه: شماره‌ای که یک‌بار داده شده دوباره داده نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** دفترِ مالکیتِ پیشوند و شماره‌های داده‌شده. تابعِ سازنده صادر می‌شود تا تستِ خودِ قاعده دفترِ سراسری را آلوده نکند. */
export function createPhoneRegistry(suffix: () => number = () => randomInt(0, 10_000_000)) {
  const owners = new Map<string, string>();
  const issued = new Set<string>();
  return {
    ownerOf: (prefix: string) => owners.get(prefix),
    claim(prefix: string, file: string): void {
      const owner = owners.get(prefix);
      if (owner === undefined) { owners.set(prefix, file); return; }
      if (owner !== file) {
        throw new Error(
          `PHONE_PREFIX_REUSE: پیشوندِ «${prefix}» مالِ ${owner} است و ${file} هم برداشتش — ` +
          'برای این فایل پیشوندِ تازه‌ای انتخاب کن (tests/_phone.helper.mts).',
        );
      }
    },
    issue(prefix: string): string {
      for (;;) {
        const phone = `${prefix}${String(suffix()).padStart(7, '0')}`;
        if (!issued.has(phone)) { issued.add(phone); return phone; }
      }
    },
  };
}

const registry = createPhoneRegistry();

/**
 * نامِ فایلِ تستی که مالکِ این فراخوانی است (نسبی به tests/)، از stack.
 *
 * ⚠️ پیگیریِ Red Team (۲۰۲۶-۰۹-۱۷): نسخه‌ی قبلی اولین فریمِ غیرِ helper را برمی‌داشت. پس helperِ
 * مشترکی زیرِ tests/ (مثلاً tests/helpers/seed.mts) که دو فایلِ تست صدایش بزنند، خودش «مالک» می‌شد
 * و تکرارِ پیشوند میانِ آن دو فایل پنهان می‌ماند. حالا مالک **بیرونی‌ترین** فریمِ `tests/*.test.mts`
 * است — همان فایلی که runner واقعاً import کرده.
 */
export function callerTestFile(stack: string | undefined): string {
  let owner: string | null = null;
  for (const line of (stack ?? '').split('\n').slice(1)) {
    const m = line.match(/[\\/]tests[\\/]([^\s():]+\.test\.m?[jt]s)/);
    if (m) owner = m[1].replace(/\\/g, '/');
  }
  if (owner) return owner;
  throw new Error('PHONE_PREFIX_REUSE: هیچ فایلِ tests/*.test.mts در stackِ فراخوانِ fixturePhone نیست — قاعده‌ی مالکیت اجراشدنی نیست');
}

/** stackِ کامل: با سقفِ پیش‌فرضِ ۱۰ فریم، فریمِ فایلِ تست زیرِ چند helperِ تودرتو بریده می‌شد. */
function fullStack(): string | undefined {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 100;
  try { return new Error().stack; } finally { Error.stackTraceLimit = limit; }
}

/**
 * شماره‌ی موبایلِ ایرانیِ ۱۱رقمیِ یکتا برای فیکسچر.
 *
 * @param prefix چهار رقمِ اول (مثلِ `0938`). برای هر فایلِ تست **متفاوت**
 *   انتخابش کن — حالا اجرا می‌شود: پیشوندِ فایلِ دیگر خطای PHONE_PREFIX_REUSE می‌دهد.
 */
export function fixturePhone(prefix: string): string {
  if (!/^0\d{3}$/.test(prefix)) {
    throw new Error(`پیشوندِ نامعتبر «${prefix}» — باید ۴ رقم و با ۰ شروع شود`);
  }
  registry.claim(prefix, callerTestFile(fullStack()));
  return registry.issue(prefix);
}
