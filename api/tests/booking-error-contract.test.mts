// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Err } from '../src/lib/errors.ts';

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ خطا بینِ API و اپِ کاستومر
//
//  ⚠️ یافته‌ی CEO (۲۰۲۶-۰۹-۰۹) که این فایل از آن زاده شد:
//      grep -rnE "CONCURRENCY_RETRY|SLOT_LOCK_TIMEOUT|TABLE_CONFLICT" apps/  →  ۰
//  API کدهای دامنه‌ایِ دقیق برمی‌گرداند و اپ هیچ‌کدام را نمی‌خواند. بدتر:
//  تنها شاخه‌ی موجود، بخشی از تصمیمش را روی `/پر|ظرفیت/.test(message)` سوار
//  کرده بود — یعنی **عوض‌کردنِ یک کلمه در `errors.ts` بی‌صدا منطقِ UI را
//  می‌شکست** و هیچ تستی قرمز نمی‌شد.
//
//  و این امروز واقعی‌تر شد: کامیتِ `38a9570` مسیرِ رزرو را صادق‌تر کرد و در
//  رقابت ۴۰۹ `CONCURRENCY_RETRY` می‌دهد. **قراردادِ بهترشده‌ای که مصرف‌کننده
//  ندارد، هنوز برای کاربر بهتر نشده.**
//
//  چرا تستِ ساختاری: اپ جاوااسکریپتِ مرورگر است و هیچ تستِ بک‌اندی این
//  شکاف را نمی‌بیند — همان دلیلِ loyalty-tier-panel-parity.test.mts.
//
//  ⚠️ آنچه این فایل **ادعا نمی‌کند**: که UI درست رندر می‌شود. هیچ مرورگری
//  اجرا نشد. این تست فقط قرارداد را می‌سنجد: «کدی که سرور می‌دهد، در اپ
//  مصرف‌کننده دارد» و «منطق روی متنِ فارسی سوار نیست».
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const F = {
  apiErrors: fileURLToPath(new URL('apps/customer/js/api-errors.js', ROOT)),
  booking:   fileURLToPath(new URL('apps/customer/js/data/booking.js', ROOT)),
  standalone: fileURLToPath(new URL('standalone/customer.html', ROOT)),
};
const read = (p: string) => readFileSync(p, 'utf8');

/** حذفِ کامنت‌های تک‌خطی — کامنت‌ها عمداً الگوی قدیمی را نقل می‌کنند. */
function codeOnly(src: string): string {
  return src.split('\n').map((l) => {
    const i = l.indexOf('//');
    return i === -1 ? l : l.slice(0, i);
  }).join('\n');
}

/** کدهایی که مسیرِ رزرو می‌تواند برگرداند و اپ باید رفتارِ خاص بدهد. */
const MUST_HANDLE = {
  capacity: ['SLOT_FULL', 'NO_TABLE_FOR_PARTY', 'MERGE_UNAVAILABLE'],
  retry:    ['CONCURRENCY_RETRY', 'SLOT_LOCK_TIMEOUT', 'TABLE_CONFLICT'],
  // ⚠️ افزوده ۲۰۲۶-۰۹-۰۹: `errorResponse` حالا P2024 (ته‌کشیدنِ استخرِ اتصال) را
  // به ۵۰۳/`SERVICE_UNAVAILABLE` ترجمه می‌کند به‌جای ۵۰۰/`INTERNAL`. چون رفع در
  // `errorResponse` است و نه در مسیرِ رزرو، **هر** endpointی می‌تواند بدهدش.
  transient: ['SERVICE_UNAVAILABLE'],
};

describe('قراردادِ خطا — کدهای سرور مصرف‌کننده دارند', () => {

  test('⚠️ هر کدی که اپ ادعا می‌کند می‌شناسد، واقعاً در errors.ts وجود دارد', () => {
    // جهتِ اول: اپ نباید کدی را نام ببرد که سرور هرگز نمی‌دهد — آن هم یک
    // قراردادِ شکسته است، فقط در جهتِ مخالف.
    const real = new Set<string>();
    for (const factory of Object.values(Err as Record<string, unknown>)) {
      if (typeof factory !== 'function') continue;
      try {
        // سازنده‌ها آرگومان‌های متفاوت دارند؛ مقدارِ بی‌ضرر کافی است چون فقط
        // `code` را می‌خواهیم.
        const e: any = (factory as (...a: unknown[]) => unknown)(1, 1);
        if (e?.code) real.add(e.code);
      } catch { /* سازنده‌ای که با این ورودی نمی‌سازد — نادیده */ }
    }
    assert.ok(real.size > 10, `فقط ${real.size} کد از errors.ts استخراج شد — روشِ استخراج شکسته است`);

    const claimed = [...MUST_HANDLE.capacity, ...MUST_HANDLE.retry, ...MUST_HANDLE.transient];
    const ghosts = claimed.filter((c) => !real.has(c));
    assert.deepEqual(ghosts, [], `اپ کدهایی را مدیریت می‌کند که سرور نمی‌دهد: ${ghosts.join(', ')}`);
  });

  test('⚠️ کدهای رقابت و ظرفیت در اپِ کاستومر مصرف‌کننده دارند', () => {
    // این دقیقاً گرپِ CEO است، برعکس‌شده: قبلاً صفر بود.
    const src = codeOnly(read(F.apiErrors));
    const missing = [...MUST_HANDLE.capacity, ...MUST_HANDLE.retry, ...MUST_HANDLE.transient].filter((c) => !src.includes(c));
    assert.deepEqual(missing, [], `این کدها در اپ مصرف‌کننده ندارند: ${missing.join(', ')}`);
  });

  test('⚠️ منطقِ رزرو روی متنِ فارسیِ خطا شاخه نمی‌زند', () => {
    // نقصِ اصلی. `/پر|ظرفیت/.test(error.message)` یعنی قرارداد، متنِ UI است.
    for (const [label, path] of Object.entries({ booking: F.booking, standalone: F.standalone })) {
      const code = codeOnly(read(path));
      const idx = code.indexOf('bookingErrorKind');
      assert.notEqual(idx, -1, `${label}: طبقه‌بندیِ کدمحور استفاده نشده`);
      // هیچ regexی روی message در همان ناحیه‌ی تصمیم نباشد.
      assert.ok(
        !/test\(\s*res\.error\?\.message/.test(code),
        `${label}: هنوز روی متنِ پیامِ خطا regex می‌زند`,
      );
    }
  });

  test('⚠️ رفتارِ retry با capacity یکی نیست — صف برای رقابت پیشنهاد نمی‌شود', () => {
    // اگر هر دو به offerWaitlist می‌رفتند، کاربر در یک رقابتِ گذرا به صف
    // فرستاده می‌شد در حالی که جا هنوز هست. تفکیک باید در کد دیده شود.
    const code = codeOnly(read(F.booking));
    const cap = code.indexOf("kind==='capacity'");
    const rty = code.indexOf("kind==='retry'");
    assert.ok(cap !== -1 && rty !== -1, 'هر دو شاخه باید صریح باشند');
    const capBlock = code.slice(cap, rty);
    assert.ok(capBlock.includes('offerWaitlist'), 'شاخه‌ی ظرفیت باید صف پیشنهاد دهد');
    const rtyBlock = code.slice(rty, rty + 1400);
    assert.ok(!rtyBlock.includes('offerWaitlist'), 'شاخه‌ی رقابت **نباید** صف پیشنهاد دهد');
    assert.ok(rtyBlock.includes('confirmBook'), 'شاخه‌ی رقابت باید راهِ تلاشِ دوباره بدهد');
  });

  test('⚠️ دو رونوشتِ اپ از هم واگرا نشده‌اند', () => {
    // ⚠️ تصحیح: `standalone/customer.html` **تولیدشده** است
    // (`tools/build-standalone.py`)، نه رونوشتِ دستی — ادعای قبلیِ من غلط بود.
    // پس این تست دیگر «واگراییِ دستی» را نمی‌سنجد، بلکه چیزِ مفیدترِ دیگری را:
    // اینکه بازتولید واقعاً کد را به باندل رسانده. اگر ماژولِ تازه به
    // `CUSTOMER_ORDER` اضافه نشود، همین‌جا قرمز می‌شود — همان‌طور که ۲۰۲۶-۰۹-۰۹ شد.
    const a = codeOnly(read(F.booking));
    const b = codeOnly(read(F.standalone));
    for (const c of [...MUST_HANDLE.capacity, ...MUST_HANDLE.retry, ...MUST_HANDLE.transient]) {
      const inA = a.includes(c) || codeOnly(read(F.apiErrors)).includes(c);
      const inB = b.includes(c);
      assert.equal(inA, inB, `کدِ ${c} فقط در یکی از دو رونوشت مدیریت می‌شود`);
    }
  });
});
