import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { hourInTz, dateInTz, dateKeyInTz, generateTimesFromHours } = await import('../src/lib/hours.ts');

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
// ═══════════════════════════════════════════════════════════════════════
//  generateTimesFromHours — تولیدِ سانس از رویِ شیفتِ واقعی (Part 1، ۲۰۲۶-۰۸-۱۴)
//
//  همه‌ی تاریخ‌ها با ظهرِ محلی محاسبه شده‌اند (weekdayInTz دقیقاً همین کار را
//  می‌کند): ۲۰۲۶-۰۸-۱۴ = جمعه (کلیدِ '5')، ۰۸-۱۵ = شنبه ('6')، ۰۸-۱۶ = یکشنبه ('0').
//
//  تستِ کلیدی برایِ ماموریت: «سانس‌هایِ بیرونِ بازه‌ی زنده کنار گذاشته می‌شوند»
//  — یعنی این تابع هرگز چیزی خارجِ [open, close) تولید نمی‌کند.
// ═══════════════════════════════════════════════════════════════════════
describe('generateTimesFromHours', () => {
  const FRIDAY = '2026-08-14';
  const NO_CLOSURES = new Set<string>();

  test('روزِ تعریف‌نشده در openingHours → null (رفتارِ قدیمی/SERVICE_TIMES)', () => {
    const oh = { '6': [['12:00', '23:00']] as [string, string][] };
    assert.equal(generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES), null);
  });

  test('openingHours=null → null', () => {
    assert.equal(generateTimesFromHours(null, FRIDAY, 'Asia/Tehran', NO_CLOSURES), null);
  });

  test('روزِ صریحاً تعطیل ([]) → آرایه‌ی خالی، نه fallback', () => {
    const oh = { '5': [] as [string, string][] };
    assert.deepEqual(generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES), []);
  });

  // ⚠️ تستِ حداقلیِ ماموریت: «availability سانس‌های بیرونِ بازه‌ی زنده را حذف می‌کند».
  test('فقط سانس‌هایِ داخلِ بازه — نه قبل، نه بعد، نه خودِ لحظه‌ی بسته‌شدن', () => {
    const oh = { '5': [['19:00', '21:00']] as [string, string][] };
    const times = generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES)!;
    assert.deepEqual(times, ['19:00', '19:30', '20:00', '20:30']);
    assert.ok(!times.includes('18:30'), 'قبل از بازشدن نباید باشد');
    assert.ok(!times.includes('21:00'), 'لحظه‌ی بسته‌شدن (نیم‌بازه) نباید باشد');
    assert.ok(!times.includes('21:30'), 'بعد از بسته‌شدن نباید باشد');
  });

  test('چند شیفت در یک روز (ناهار+شام) با هم ادغام و مرتب می‌شوند', () => {
    const oh = { '5': [['12:30', '13:30'], ['19:00', '20:00']] as [string, string][] };
    const times = generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES)!;
    assert.deepEqual(times, ['12:30', '13:00', '19:00', '19:30']);
  });

  test('شیفتِ بعد از نیمه‌شب (مثلاً کافه تا ۰۱:۰۰) به‌درستی می‌چرخد', () => {
    const oh = { '5': [['23:00', '01:00']] as [string, string][] };
    const times = generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES)!;
    // خروجی با .sort() رشته‌ای مرتب می‌شود (نه زمانی) — پس «۰۰:xx» قبل از
    // «۲۳:xx» می‌افتد؛ همان رفتارِ فعلیِ خودِ generateTimesFromHours است،
    // نه چیزی که این تست باید تغییرش بدهد.
    assert.deepEqual([...times].sort(), ['00:00', '00:30', '23:00', '23:30']);
    assert.equal(times.length, 4);
    assert.ok(times.includes('23:00') && times.includes('23:30'));
    assert.ok(times.includes('00:00') && times.includes('00:30'));
  });

  test('گامِ سفارشی (stepMinutes=60)', () => {
    const oh = { '5': [['18:00', '21:00']] as [string, string][] };
    const times = generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', NO_CLOSURES, 60)!;
    assert.deepEqual(times, ['18:00', '19:00', '20:00']);
  });

  // تعطیلیِ خاص (restaurant_closures) باید حتی روزی که شیفتِ هفتگیِ واقعی
  // دارد را کاملاً خالی کند — یک استثنایِ یک‌روزه، نه ویرایشِ ساعتِ هفتگی.
  test('تعطیلیِ خاص روی همان تاریخ، شیفتِ واقعی را هم بی‌اثر می‌کند', () => {
    const oh = { '5': [['12:00', '15:00']] as [string, string][] };
    const closures = new Set([FRIDAY]);
    assert.deepEqual(generateTimesFromHours(oh, FRIDAY, 'Asia/Tehran', closures), []);
  });
});

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
