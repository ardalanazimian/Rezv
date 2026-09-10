import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ E-003 — «یک بلیپِ گذرای Redis نباید سقفِ ریت‌لیمیت را ریست کند»
//
//  چطور پیدا شد، چون مسیرش به‌اندازه‌ی یافته آموزنده است:
//  `otp-break-glass.integration.test.mts` گاهی می‌افتاد و **«flake» برچسب
//  خورد**. معاون در ۴ اجرا بازتولیدش نکرد و دو فرضیه‌ی CEO (تداخلِ شمارنده‌ی
//  سراسری، ریت‌لیمیتِ مشترکِ Redis) را **با خواندنِ کد** رد کرد — هر دو
//  درباره‌ی *تداخل* بودند و این مکانیزم به تداخل نیاز ندارد. مهندسِ لانچ
//  خروجیِ خام را داد: `actual: undefined` با `operator: 'rejects'`، یعنی
//  درخواستِ چهارم **اصلاً رد نشد**. و همان الگو بارِ دوم در تستِ *دیگری* از
//  همان خانواده دیده شد. دو ادعای مستقل که یکسان می‌افتند، به محدودکننده
//  اشاره می‌کنند نه به تست‌ها.
//
//  سه نشستِ مستقل لازم شد. «در N اجرا بازتولید نشد» هرگز به «نقصی نیست»
//  تبدیل نشد — و این سومین بار در یک روز بود که «flake» روی یک نقصِ واقعی
//  نشسته بود.
//
//  مکانیزم: `rateLimitWithFallback` هر خطا را می‌گیرد و به
//  `rateLimitInMemory` می‌افتد، که نقشه‌ی **جداگانه** دارد. پس برای کلیدی که
//  هرگز ندیده `{count: 1}` می‌سازد و `allowed: true` می‌دهد — در حالی که
//  Redis از قبل سقف را پر کرده بود. طراحی فرض کرده بود «Redis قطع است ⇒ از
//  حافظه استفاده کن»؛ حالتِ واقعی «Redis بلیپ می‌زند ⇒ شمارش از نو» است.
//
//  ⚠️ این تست **بستنِ کاملِ E-003 را ادعا نمی‌کند.** قطعیِ واقعیِ Redis
//  همچنان سقفِ ریست‌شونده می‌دهد؛ بستنِ آن یک تبادلِ محصولی است (امنیت در
//  برابر در دسترس‌بودن) که به مالک ارجاع شده و تصمیمش گرفته نشده. آنچه
//  این‌جا گارد می‌شود فقط حالتِ **گذرا** است — که سطحِ محتمل‌ترِ خطر است.
// ═══════════════════════════════════════════════════════════════════════

const { rateLimitWithFallback, RULES } = await import('../src/lib/ratelimit.ts');
// ⚠️ import **نسبی**، عمداً — نه `@/lib/metrics`. یافته‌ی معاون در همین
// تحقیق: زیرِ `tsx` یک مسیرِ نسبی و یک aliasِ tsconfig **دو نمونه‌ی جدا** از
// ماژول می‌سازند، هرکدام با Counter و Mapِ خودش. یک probe که با alias بخواند
// همیشه صفر می‌بیند — یعنی یک چکِ «که نمی‌تواند شکست بخورد». آن نزدیک بود
// به‌عنوان «شمارنده‌های برچسب‌دار ثبت نمی‌شوند» گزارش شود: یک ادعای جدی و
// غلط علیه کدِ سالم.
const { metrics } = await import('../src/lib/metrics.ts');

type RL = { allowed: boolean; remaining: number; resetAt: number; retryAfterSec: number };

/** یک `attempt` که مثلِ Redisِ سالم می‌شمارد، ولی در تلاش‌های نام‌برده throw می‌کند. */
function countingAttempt(failOn: number[]) {
  let n = 0;
  const seen: number[] = [];
  return {
    get calls() { return n; },
    get failed() { return seen; },
    fn: async (_id: string, r: { max: number; windowMs: number }): Promise<RL> => {
      n++;
      if (failOn.includes(n)) { seen.push(n); throw new Error(`ECONNRESET (بلیپِ شبیه‌سازی‌شده، تلاشِ ${n})`); }
      return {
        allowed: n <= r.max,
        remaining: Math.max(0, r.max - n),
        resetAt: Date.now() + r.windowMs,
        retryAfterSec: n <= r.max ? 0 : 60,
      };
    },
  };
}

function recoveredCount(): number {
  const line = metrics.rateLimitRetryRecovered.render()
    .split('\n').find((l) => l.startsWith('rezervno_rate_limit_retry_recovered_total{'));
  return line ? Number(line.trim().split(' ').pop()) : 0;
}

describe('E-003 — بلیپِ گذرای Redis', () => {
  test('درخواستِ بعد از سقف، وقتی Redis یک لحظه خطا می‌دهد، همچنان رد می‌شود', async () => {
    const rule = { ...RULES.otpPerPhone };
    assert.ok(rule.max >= 2, 'قاعده باید سقفِ معناداری داشته باشد');

    // خطا دقیقاً در تلاشی که باید **رد** می‌شد: اولین درخواستِ فراتر از سقف.
    const overflow = rule.max + 1;
    const a = countingAttempt([overflow]);
    const id = `e003-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const results: RL[] = [];
    for (let i = 0; i < overflow; i++) {
      results.push(await rateLimitWithFallback(id, rule, 'route', a.fn));
    }

    // نبودِ موضوع = خطا: اگر بلیپ اصلاً شلیک نشده، این تست هیچ‌چیز نسنجیده.
    assert.deepEqual(a.failed, [overflow],
      `بلیپ باید دقیقاً در تلاشِ ${overflow} رخ می‌داد؛ رخ‌دادها: ${JSON.stringify(a.failed)}`);

    for (let i = 0; i < rule.max; i++) {
      assert.equal(results[i].allowed, true, `درخواستِ ${i + 1} باید مجاز می‌بود`);
    }

    // ادعایِ اصلی. پیش از رفع: `allowed=true` با `remaining` که **بالا رفته**
    // بود (سطلِ تازه‌ی in-memory)، که امضای دقیقِ نقص است.
    const last = results[overflow - 1];
    assert.equal(last.allowed, false,
      'درخواستِ فراتر از سقف نباید فقط به‌خاطرِ یک بلیپِ گذرای Redis مجاز شود — '
      + `این پنجره‌ی brute-force روی مسیرِ auth است. گرفت: allowed=${last.allowed} remaining=${last.remaining}`);
    assert.equal(last.remaining, 0,
      'بالا رفتنِ remaining بعد از پر شدنِ سقف یعنی شمارنده از نو شروع کرده');
  });

  test('تلاشِ مجدد شمرده می‌شود — وگرنه رفع نامرئی است', async () => {
    const before = recoveredCount();
    const rule = { ...RULES.otpPerPhone };
    const a = countingAttempt([1]);           // بلیپ در همان اولین تلاش
    await rateLimitWithFallback(`e003-m-${Date.now()}`, rule, 'route', a.fn);
    assert.ok(recoveredCount() > before,
      'بدونِ این شمارنده، تنها اثرِ رفع افتِ rateLimitFallback است و هیچ عددی '
      + 'نمی‌گوید چرا — نسبتِ recovered به fallback تفاوتِ «بلیپ» و «قطعی» را می‌گوید');
  });

  test('قطعیِ پایدار همچنان به fallback می‌رود — رفع، سیاستِ در دسترس‌بودن را نشکسته', async () => {
    // ⚠️ این ردیف مرزِ تغییر است. اگر روزی کسی retry را به «تا موفق شدن» تبدیل
    // کند، قطعیِ Redis به تعلیقِ هر درخواست بدل می‌شود — یعنی سیاستِ صریحِ
    // fail-openِ `ratelimit.ts:70-86` را با یک قفل عوض کرده‌ایم.
    const rule = { ...RULES.otpPerPhone };
    const a = countingAttempt([1, 2, 3, 4, 5]);  // همیشه خطا
    const res = await rateLimitWithFallback(`e003-d-${Date.now()}`, rule, 'route', a.fn);
    assert.equal(a.calls, 2, 'باید دقیقاً دو بار تلاش کند: اصلی + یک retry، نه بیشتر');
    assert.equal(res.allowed, true, 'در قطعیِ واقعی، سرویس باید باز بماند (سیاستِ مستندشده)');
  });
});
