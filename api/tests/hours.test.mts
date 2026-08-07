import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { hourInTz, dateInTz } = await import('../src/lib/hours.ts');

// ═══════════════════════════════════════════════════════════════════════
//  فقط دو تابعِ تازه‌اضافه‌شده تست می‌شوند (hourInTz/dateInTz) — بقیه‌ی
//  hours.ts (zonedTimeToUtc، weekdayInTz، ...) از قبل بدونِ تستِ واحد بود؛
//  رفعِ آن شکافِ قدیمی خارج از محدوده‌ی همین تغییر است.
//
//  ایران از ۱۴۰۱ (۲۰۲۲) ساعتِ تابستانی را برداشته — یعنی Asia/Tehran همیشه
//  UTC+۳:۳۰ ثابت است، بدونِ پیچیدگیِ DST. همه‌ی تاریخ‌های تست بر همین مبنا
//  دستی محاسبه شده‌اند.
// ═══════════════════════════════════════════════════════════════════════

describe('hourInTz — ساعتِ محلیِ تهران از رویِ لحظه‌ی UTC', () => {
  test('UTC 12:00 → تهران ۱۵:۳۰ → ساعتِ ۱۵', () => {
    assert.equal(hourInTz(new Date('2026-01-01T12:00:00Z'), 'Asia/Tehran'), 15);
  });
  test('UTC 19:00 → تهران ۲۲:۳۰ → ساعتِ ۲۲ (مرزِ شب‌نشینی)', () => {
    assert.equal(hourInTz(new Date('2026-01-01T19:00:00Z'), 'Asia/Tehran'), 22);
  });
  test('UTC 20:30 → تهران نیمه‌شب → ساعتِ ۰ (نه ۲۴)', () => {
    assert.equal(hourInTz(new Date('2026-01-01T20:30:00Z'), 'Asia/Tehran'), 0);
  });
  test('UTC 00:00 → تهران ۰۳:۳۰ → ساعتِ ۳', () => {
    assert.equal(hourInTz(new Date('2026-01-01T00:00:00Z'), 'Asia/Tehran'), 3);
  });
});

describe('dateInTz — تاریخِ تقویمیِ محلی', () => {
  test('نزدیکِ نیمه‌شبِ UTC می‌تواند به روزِ بعد در تهران بیفتد', () => {
    // UTC 21:00 (۱ ژانویه) + ۳:۳۰ = تهران ۰۰:۳۰ روزِ ۲ ژانویه
    const d = dateInTz(new Date('2026-01-01T21:00:00Z'), 'Asia/Tehran');
    assert.deepEqual(d, { y: 2026, m: 1, day: 2 });
  });
  test('ظهرِ UTC همیشه همان روزِ تهران است (دور از مرزِ نیمه‌شب)', () => {
    const d = dateInTz(new Date('2026-06-15T12:00:00Z'), 'Asia/Tehran');
    assert.deepEqual(d, { y: 2026, m: 6, day: 15 });
  });
});
