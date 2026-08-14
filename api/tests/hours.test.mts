import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { hourInTz, dateInTz, dateKeyInTz } = await import('../src/lib/hours.ts');

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

// ═══════════════════════════════════════════════════════════════════════
//  dateKeyInTz — کلیدِ کشِ availability (رفعِ باگِ واقعی، ۲۰۲۶-۰۸-۱۳)
//
//  قبلاً چند جا (lifecycle.ts، reservation-lifecycle-ops.ts) به‌جایِ این
//  تابع مستقیم `slotStart.toISOString().slice(0,10)` می‌زدند — تاریخِ UTC،
//  نه تاریخِ محلیِ رستوران. نزدیکِ نیمه‌شبِ تهران (UTC+۰۳:۳۰) این باعث
//  می‌شد باطل‌سازیِ کش رویِ کلیدِ اشتباه بزنه و کشِ واقعی دست‌نخورده بمونه —
//  این تست دقیقاً همون مرزِ نیمه‌شب رو پوشش می‌ده.
// ═══════════════════════════════════════════════════════════════════════
describe('dateKeyInTz — کلیدِ تاریخِ محلی برایِ کشِ availability', () => {
  test('نزدیکِ نیمه‌شبِ تهران: کلیدِ محلی با کلیدِ UTC فرق می‌کند (خودِ باگِ رفع‌شده)', () => {
    // UTC 21:00 (۱ ژانویه) = تهران ۰۰:۳۰ روزِ ۲ ژانویه
    const t = new Date('2026-01-01T21:00:00Z');
    assert.equal(dateKeyInTz(t, 'Asia/Tehran'), '2026-01-02');
    // اگر کدِ قدیمی (UTCِ خام) استفاده می‌شد، این می‌شد '2026-01-01' — یعنی
    // باطل‌سازیِ کش رویِ کلیدِ اشتباه می‌زد.
    assert.notEqual(dateKeyInTz(t, 'Asia/Tehran'), t.toISOString().slice(0, 10));
  });
  test('دور از مرزِ نیمه‌شب: کلیدِ محلی و UTC یکی‌اند', () => {
    const t = new Date('2026-06-15T12:00:00Z');
    assert.equal(dateKeyInTz(t, 'Asia/Tehran'), '2026-06-15');
  });
  test('صفرپَدینگِ ماه/روزِ تک‌رقمی', () => {
    const t = new Date('2026-03-05T12:00:00Z');
    assert.equal(dateKeyInTz(t, 'Asia/Tehran'), '2026-03-05');
  });
});
