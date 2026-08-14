import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — به دلیل باگ محیطیِ import استاتیک چندنامی در ترکیب
// tsx+node:test در این sandbox (شرح کامل در tests/validate.test.mts).
const { computeRanges, genReservationCode, isConflictError, isSerializationError } =
  await import('../src/lib/reservation-helpers.ts');
const { Prisma } = await import('@prisma/client');

const CFG = { slotMinutes: 90, bufferMinutes: 15, cleaningMinutes: 20, holdMinutes: 10 };

describe('computeRanges', () => {
  test('بازه‌ی رزرو را با تایم‌زون تهران (+03:30) درست محاسبه می‌کند', () => {
    const r = computeRanges('2026-08-01', '20:00', CFG);
    // 20:00 +03:30 == 16:30 UTC
    assert.equal(r.start.toISOString(), '2026-08-01T16:30:00.000Z');
    assert.equal(r.duration, 90);
  });
  test('end = start + duration', () => {
    const r = computeRanges('2026-08-01', '20:00', CFG);
    assert.equal(+r.end - +r.start, 90 * 60_000);
  });
  test('blockEnd = end + (cleaning + buffer)', () => {
    const r = computeRanges('2026-08-01', '20:00', CFG);
    assert.equal(r.blockBufferMin, 35); // 20 + 15
    assert.equal(+r.blockEnd - +r.end, 35 * 60_000);
  });
  test('durationOverride جایگزین slotMinutes پیش‌فرض می‌شود', () => {
    const r = computeRanges('2026-08-01', '20:00', CFG, 120);
    assert.equal(r.duration, 120);
  });
  test('تاریخ/ساعت نامعتبر خطا می‌دهد', () => {
    assert.throws(() => computeRanges('not-a-date', '20:00', CFG));
  });

  // ⚠️ اضافه‌شده (حسابرسیِ قراردادِ زمانی، ۲۰۲۶-۰۸-۱۴): تثبیتِ صریحِ
  // قراردادِ slot_start/slot_end/block_buffer_minutes/block_end که در
  // reservation-helpers.ts و reservations.ts مستند شده — رجوع کن به
  // docs/SECURITY.md §11. این تست‌ها عمداً تکراری با موارد بالا نیستند:
  // مرزِ نیمه‌شب، تایم‌زونِ غیرِپیش‌فرض، و purity/determinism را می‌سنجند.

  test('مرزِ نیمه‌شب تهران: رزروِ دیرهنگام با مدت/بافرِ بلند، به روزِ بعد در UTC سرریز می‌کند ولی محاسبه درست می‌ماند', () => {
    // نکته: چون آفستِ تهران +۳:۳۰ است، رزروی که در UTC واقعاً به روزِ بعد
    // برسد به مدت/بافرِ کافی نیاز دارد (محلی باید از ۰۳:۳۰ بامدادِ روزِ بعد
    // هم بگذرد، نه فقط از نیمه‌شبِ محلی). این CFGِ محلی (نه CFGِ سراسریِ بالا)
    // عمداً مدت/بافرِ بزرگ‌تر دارد تا این مرز را واقعاً لمس کند — تأییدشده با
    // محاسبه‌ی مستقیم، نه حدس: ۲۳:۰۰ + ۲۴۰ (مدت) + ۶۰ (بافر) = ۰۴:۰۰ بامدادِ
    // روزِ بعدِ تهران که از ۰۳:۳۰ گذشته، پس UTCِ آن هم واقعاً روزِ بعد است.
    const LONG_CFG = { slotMinutes: 240, bufferMinutes: 40, cleaningMinutes: 20, holdMinutes: 10 };
    const r = computeRanges('2026-08-01', '23:00', LONG_CFG);
    assert.equal(+r.end - +r.start, 240 * 60_000);
    assert.equal(r.blockBufferMin, 60); // 20 + 40
    assert.equal(+r.blockEnd - +r.end, 60 * 60_000);
    // start در UTC هنوز همان روزِ ۲۰۲۶-۰۸-۰۱ است (۲۳:۰۰ - ۳:۳۰ = ۱۹:۳۰ UTC)
    assert.equal(r.start.toISOString(), '2026-08-01T19:30:00.000Z');
    // ولی blockEnd (۲۳:۰۰ + ۴ساعت + ۶۰د = ۰۴:۰۰ بامدادِ تهرانِ روزِ بعد) واقعاً به روزِ بعد در UTC سرریز می‌شود
    assert.equal(r.blockEnd.toISOString(), '2026-08-02T00:30:00.000Z');
    assert.equal(r.blockEnd.toISOString().slice(0, 10), '2026-08-02');
  });

  test('تایم‌زونِ غیرِپیش‌فرض (UTC صریح) واقعاً اعمال می‌شود، نه Asia/Tehran هاردکد', () => {
    const rTehran = computeRanges('2026-08-01', '20:00', CFG, undefined, 'Asia/Tehran');
    const rUtc = computeRanges('2026-08-01', '20:00', CFG, undefined, 'UTC');
    // همان تاریخ/ساعتِ محلی، تایم‌زونِ متفاوت → لحظه‌ی UTC متفاوت (اختلافِ ۳:۳۰ ساعت)
    assert.notEqual(rTehran.start.toISOString(), rUtc.start.toISOString());
    assert.equal(+rUtc.start - +rTehran.start, 3.5 * 60 * 60_000);
  });

  test('خالص/deterministic است: دو فراخوانیِ یکسان دقیقاً همان خروجی را می‌دهند (بدونِ state سراسری)', () => {
    const a = computeRanges('2026-08-01', '20:00', CFG, 120);
    const b = computeRanges('2026-08-01', '20:00', CFG, 120);
    assert.equal(a.start.toISOString(), b.start.toISOString());
    assert.equal(a.end.toISOString(), b.end.toISOString());
    assert.equal(a.blockEnd.toISOString(), b.blockEnd.toISOString());
    assert.equal(a.duration, b.duration);
    assert.equal(a.blockBufferMin, b.blockBufferMin);
  });
});

describe('genReservationCode', () => {
  test('همیشه با RZ شروع می‌شود و طول ۹ کاراکتر دارد', () => {
    for (let i = 0; i < 50; i++) {
      const code = genReservationCode();
      assert.equal(code.length, 9);
      assert.equal(code.slice(0, 2), 'RZ');
    }
  });
  test('فقط از الفبای Base32 امن استفاده می‌کند (بدون 0/O/1/I)', () => {
    const safeAlphabet = /^RZ[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
    for (let i = 0; i < 50; i++) {
      assert.match(genReservationCode(), safeAlphabet);
    }
  });
  test('عملاً یکتا تولید می‌شود (بدون تصادف روی یک sample بزرگ)', () => {
    const codes = new Set(Array.from({ length: 500 }, () => genReservationCode()));
    assert.equal(codes.size, 500);
  });
});

describe('isConflictError / isSerializationError', () => {
  test('کد postgres exclusion_violation (23P01) تداخل شناخته می‌شود', () => {
    assert.equal(isConflictError({ code: '23P01' }), true);
  });
  test('کد serialization_failure (40001) هم تداخل و هم serialization است', () => {
    assert.equal(isConflictError({ code: '40001' }), true);
    assert.equal(isSerializationError({ code: '40001' }), true);
  });
  test('deadlock (40P01) تداخل و serialization است', () => {
    assert.equal(isConflictError({ code: '40P01' }), true);
    assert.equal(isSerializationError({ code: '40P01' }), true);
  });
  test('exclusion_violation صرفاً conflict است نه serialization', () => {
    assert.equal(isSerializationError({ code: '23P01' }), false);
  });
  test('خطای بی‌ربط تداخل شناخته نمی‌شود', () => {
    assert.equal(isConflictError({ code: 'P2025' }), false);
    assert.equal(isConflictError(new Error('random')), false);
    assert.equal(isConflictError(null), false);
  });

  // ⚠️ اضافه‌شده (یافته‌یِ واقعیِ C2، ۲۰۲۶-۰۸-۱۴): بازتولیدِ دقیقِ شکلِ خطایی
  // که هم‌زمانیِ واقعیِ بدونِ قفلِ Redis (تستِ زنده در
  // table-merge-occupancy-concurrency.test.mts) عملاً تولید کرد — Prisma
  // همیشه PrismaClientKnownRequestError با meta.code نمی‌ده؛ گاهی
  // PrismaClientUnknownRequestError با کدِ SQLSTATE فقط داخلِ متنِ message.
  describe('PrismaClientUnknownRequestError (شکلِ واقعیِ خطایی که با تستِ زنده‌ی C2 پیدا شد)', () => {
    const mkUnknown = (msg: string) =>
      new Prisma.PrismaClientUnknownRequestError(msg, { clientVersion: '5.22.0' });

    test('23P01 داخلِ متنِ خامِ پیام (نه یک فیلدِ ساختاریافته) هم conflict شناخته می‌شود', () => {
      const e = mkUnknown('...PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint" }...');
      assert.equal(isConflictError(e), true);
      assert.equal(isSerializationError(e), false); // exclusion صرفاً conflict است
    });
    test('40001 داخلِ متنِ خام هم conflict و هم serialization شناخته می‌شود', () => {
      const e = mkUnknown('...PostgresError { code: "40001", message: "could not serialize access" }...');
      assert.equal(isConflictError(e), true);
      assert.equal(isSerializationError(e), true);
    });
    test('پیامی که هیچ کدِ شناخته‌شده‌ای در آن نیست، false می‌ماند', () => {
      const e = mkUnknown('یک خطایِ کاملاً بی‌ربط، بدونِ هیچ SQLSTATEِ شناخته‌شده');
      assert.equal(isConflictError(e), false);
      assert.equal(isSerializationError(e), false);
    });
  });
});
