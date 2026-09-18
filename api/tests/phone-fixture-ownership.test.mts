import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  m-21 — قاعده‌ی «یک پیشوند برای هر فایل» اجراشدنی است، نه توصیه
//
//  یافته (rezv-31، سنجیده‌ی CEO روی main ۲۰۲۶-۰۹-۱۷): پیشوندِ ۰۹۲۱ در سه فایل تکرار شده بود
//  (سرشماریِ کامل: ۲۷ پیشوند در بیش از یک فایل) و یک beforeEachِ سطحِ ماژول در dna-summary
//  کاربرِ ۰۹۲۱ برای تست‌های فایل‌های دیگر هم می‌ساخت (اجرای کاملِ main ۳۶۵ تا باقی گذاشت).
//  این فایل خودِ قاعده را می‌سنجد؛ اجرای کاملِ سوئیت با آن، هر تکرارِ واقعی را قرمزِ قطعی می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { createPhoneRegistry, callerTestFile, fixturePhone } = await import('./_phone.helper.mts');

describe('مالکیتِ پیشوندِ شماره‌ی فیکسچر', () => {
  test('🔴 فایلِ دوم با پیشوندِ فایلِ اول خطای PHONE_PREFIX_REUSE می‌گیرد، با نامِ هر دو', () => {
    const r = createPhoneRegistry();
    r.claim('0921', 'dna-summary.integration.test.mts');
    assert.throws(
      () => r.claim('0921', 'admin-create-business.integration.test.mts'),
      (e: unknown) => {
        const m = (e as Error).message;
        return m.startsWith('PHONE_PREFIX_REUSE')
          && m.includes('dna-summary.integration.test.mts')
          && m.includes('admin-create-business.integration.test.mts');
      },
    );
  });

  test('کنترلِ منفی: همان فایل هر چند بار بخواهد برمی‌دارد، و پیشوندهای متفاوت آزادند', () => {
    const r = createPhoneRegistry();
    r.claim('0921', 'a.test.mts');
    r.claim('0921', 'a.test.mts');
    r.claim('0922', 'b.test.mts');
    assert.equal(r.ownerOf('0921'), 'a.test.mts');
    assert.equal(r.ownerOf('0922'), 'b.test.mts');
  });

  test('🔴 یکتاییِ درون‌پروسه: پسوندِ تکراریِ منبعِ تصادف، شماره‌ی تکراری نمی‌سازد', () => {
    // منبعِ تصادفِ تزریق‌شده عمداً تکرار می‌کند (۵، ۵، ۵، ۷، ۵، ۹) — برخوردی که با
    // randomInt فقط گاهی رخ می‌دهد این‌جا قطعی است، پس حذفِ دفترِ یکتایی حتماً قرمز می‌شود.
    const draws = [5, 5, 5, 7, 5, 9];
    const r = createPhoneRegistry(() => draws.shift() as number);
    assert.deepEqual([r.issue('0921'), r.issue('0921'), r.issue('0921')], ['09210000005', '09210000007', '09210000009']);
    assert.equal(draws.length, 0, 'هر تکرار دوباره قرعه کشید');
  });

  test('فایلِ فراخوان از stack خوانده می‌شود — مسیرِ ویندوز، POSIX و file:// ؛ خودِ helper نادیده', () => {
    const stack = (...frames: string[]) => [
      'Error',
      '    at fixturePhone (C:\\r\\api\\tests\\_phone.helper.mts:70:31)',
      ...frames,
    ].join('\n');
    assert.equal(callerTestFile(stack('    at <anonymous> (C:\\r\\api\\tests\\dna-summary.integration.test.mts:81:25)')), 'dna-summary.integration.test.mts');
    assert.equal(callerTestFile(stack('    at makeUser (/home/runner/work/Rezv/Rezv/api/tests/fraud.integration.test.mts:40:7)')), 'fraud.integration.test.mts');
    assert.equal(callerTestFile(stack('    at file:///C:/r/api/tests/helpers/seed-user.mts:12:3', '    at file:///C:/r/api/tests/a.integration.test.mts:30:9')), 'a.integration.test.mts');
  });

  test('🔴 helperِ مشترک مالک نمی‌شود: مالک بیرونی‌ترین فریمِ tests/*.test.mts است (پیگیریِ Red Team)', () => {
    const viaHelper = (testFile: string) => [
      'Error',
      '    at fixturePhone (/r/api/tests/_phone.helper.mts:90:3)',
      '    at seedUser (/r/api/tests/helpers/seed-user.mts:12:3)',
      `    at <anonymous> (/r/api/tests/${testFile}:40:7)`,
      '    at TestContext.<anonymous> (node:internal/test_runner/test:797:9)',
    ].join('\n');
    const r = createPhoneRegistry();
    r.claim('0921', callerTestFile(viaHelper('a.integration.test.mts')));
    assert.throws(() => r.claim('0921', callerTestFile(viaHelper('b.integration.test.mts'))), /PHONE_PREFIX_REUSE/,
      'دو فایلِ تست از راهِ یک helperِ مشترک همان پیشوند را برداشتند و باید قرمز شود');
    // تستی که تابعِ فایلِ تستِ دیگری را صدا بزند: بیرونی‌ترین فایل (که runner اجرایش کرده) مالک است.
    const nested = ['Error', '    at fixturePhone (/r/api/tests/_phone.helper.mts:90:3)',
      '    at makeOwner (/r/api/tests/a.integration.test.mts:10:3)', '    at <anonymous> (/r/api/tests/b.integration.test.mts:20:3)'].join('\n');
    assert.equal(callerTestFile(nested), 'b.integration.test.mts');
  });

  test('🔴 مالکیت به سقفِ stackِ محیط وابسته نیست: با Error.stackTraceLimit = 1 هم فایلِ تست پیدا می‌شود', () => {
    // با سقفِ ۱، stackِ معمولی فقط فریمِ خودِ helper را دارد؛ پشتِ چند helperِ تودرتو (سقفِ پیش‌فرضِ ۱۰)
    // همین بریدگی رخ می‌دهد. fixturePhone باید stackِ کامل را خودش بگیرد و سقف را برگرداند.
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 1;
    try {
      assert.match(fixturePhone('0998'), /^0998\d{7}$/);
      assert.equal(Error.stackTraceLimit, 1, 'سقفِ محیط دست‌نخورده برمی‌گردد');
    } finally { Error.stackTraceLimit = limit; }
  });

  test('🔴 stackِ بی‌فایلِ تست خطاست، نه «مالکِ ناشناس» که همه را قبول کند', () => {
    assert.throws(() => callerTestFile('Error\n    at node:internal/process/task_queues:95:5'), /PHONE_PREFIX_REUSE/);
    assert.throws(() => callerTestFile('Error\n    at x (/r/api/tests/helpers/seed-user.mts:1:1)'), /PHONE_PREFIX_REUSE/, 'فقط helper، بی فایلِ تست');
    assert.throws(() => callerTestFile(undefined), /PHONE_PREFIX_REUSE/);
  });

  test('مسیرِ واقعی: fixturePhone همین فایل را مالکِ پیشوندش ثبت می‌کند', () => {
    // ⚠️ پیشوندِ ۰۹۹۸ مالِ همین فایل است.
    const p = fixturePhone('0998');
    assert.match(p, /^0998\d{7}$/);
  });
});
