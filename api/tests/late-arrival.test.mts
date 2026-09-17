// ═══════════════════════════════════════════════════════════════════════
//  مهلت‌های دیرکرد — منطقِ خالص (STATE M-13/M-17 · F001 · D-18/D-20)
//
//  این فایل سه چیز را پین می‌کند که هر کدام جداگانه قبلاً شکسته بود یا می‌توانست بی‌صدا بشکند:
//   ۱) کفِ پس از هشدار یک **ثابتِ نام‌دار** است و مقدارش ۱۰ است (شرطِ CEO: «ثابتِ نام‌دار با تستِ خودش»).
//   ۲) cron هرگز زودتر از ساعتی که به مهمان گفته شده جریمه نمی‌کند (ناوردا، روی شبکه‌ای از حالت‌ها).
//   ۳) cronِ دیر/خاموش هشدار و جریمه را در یک تیک نمی‌اندازد — همان «فروپاشیِ یک‌تیکی» که اندازه گرفته شد.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  LATE_WARNING_MIN_WINDOW_MINUTES, LATE_GRACE_MINUTES_MIN, LATE_GRACE_MINUTES_MAX, LATE_EXTENSION_MINUTES_MAX,
  guestDeadline, autoNoShowDueAt, grantedExtension, isCatchUpTransition,
} = await import('../src/lib/late-arrival');

const T0 = new Date('2026-09-17T16:30:00.000Z');          // ساعتِ رزرو
const min = (m: number) => new Date(T0.getTime() + m * 60_000);

describe('کفِ پنجره‌ی پس از هشدار', () => {
  test('ثابتِ نام‌دار است و دقیقاً ۱۰ دقیقه', () => {
    assert.equal(LATE_WARNING_MIN_WINDOW_MINUTES, 10,
      'تغییرِ این عدد تغییرِ حکمِ D-20 است، نه یک تنظیم — باید از CEO بگذرد');
  });

  test('کف از کمینه‌ی مجازِ مهلتِ رستوران کوتاه‌تر نیست', () => {
    assert.ok(LATE_WARNING_MIN_WINDOW_MINUTES >= LATE_GRACE_MINUTES_MIN);
  });

  test('بازه‌های D-18 با CHECKهای ۰۹۲ یکی‌اند', () => {
    assert.deepEqual([LATE_GRACE_MINUTES_MIN, LATE_GRACE_MINUTES_MAX, LATE_EXTENSION_MINUTES_MAX], [10, 60, 30]);
  });
});

describe('autoNoShowDueAt', () => {
  test('بدونِ هشدارِ پذیرفته‌شده: null — cron هرگز جریمه نمی‌کند', () => {
    assert.equal(autoNoShowDueAt({ slotStart: T0, lateWarnedAt: null, lateExtensionMinutes: 0 }, 15), null);
    assert.equal(autoNoShowDueAt({ slotStart: T0, lateWarnedAt: undefined, lateExtensionMinutes: 0 }, 15), null);
  });

  test('cronِ به‌موقع: مهلتِ رستوران تعیین‌کننده است (slot + grace)', () => {
    // هشدار ۲ دقیقه بعد از ساعت → کف = +۱۲، مهلت = +۱۵ → +۱۵
    const due = autoNoShowDueAt({ slotStart: T0, lateWarnedAt: min(2), lateExtensionMinutes: 0 }, 15);
    assert.equal(due?.toISOString(), min(15).toISOString());
  });

  test('فروپاشیِ یک‌تیکی بسته است: هشدارِ دیر (cron خاموش بوده) → کف از لحظه‌ی هشدار', () => {
    // هشدار ۶۰ دقیقه بعد از ساعت پذیرفته شد؛ مهلتِ ۱۵ دقیقه‌ای مدت‌ها گذشته. بدونِ کف، due = +۱۵ < now.
    const due = autoNoShowDueAt({ slotStart: T0, lateWarnedAt: min(60), lateExtensionMinutes: 0 }, 15);
    assert.equal(due?.toISOString(), min(70).toISOString());
  });

  test('تمدیدِ مهمان روی هر دو شاخه اضافه می‌شود', () => {
    assert.equal(autoNoShowDueAt({ slotStart: T0, lateWarnedAt: min(1), lateExtensionMinutes: 20 }, 15)?.toISOString(), min(35).toISOString());
    assert.equal(autoNoShowDueAt({ slotStart: T0, lateWarnedAt: min(60), lateExtensionMinutes: 20 }, 15)?.toISOString(), min(90).toISOString());
  });
});

describe('guestDeadline و ناوردای «هرگز زودتر از آنچه به مهمان گفته شد»', () => {
  test('slot + grace + تمدید', () => {
    assert.equal(guestDeadline({ slotStart: T0, lateExtensionMinutes: 0 }, 15).toISOString(), min(15).toISOString());
    assert.equal(guestDeadline({ slotStart: T0, lateExtensionMinutes: 10 }, 15).toISOString(), min(25).toISOString());
    assert.equal(guestDeadline({ slotStart: T0, lateExtensionMinutes: null }, 15).toISOString(), min(15).toISOString());
  });

  test('روی شبکه‌ی حالت‌ها: autoNoShowDueAt ≥ guestDeadline', () => {
    let checked = 0;
    for (const grace of [10, 15, 30, 60]) {
      for (const ext of [0, 5, 15, 30]) {
        for (const warnedAfter of [-40, -5, 0, 3, 14, 30, 120]) {
          const r = { slotStart: T0, lateExtensionMinutes: ext, lateWarnedAt: min(warnedAfter) };
          const due = autoNoShowDueAt(r, grace)!;
          const told = guestDeadline(r, grace);
          assert.ok(due.getTime() >= told.getTime(),
            `grace=${grace} ext=${ext} warned=${warnedAfter}: cron (${due.toISOString()}) زودتر از ساعتِ گفته‌شده (${told.toISOString()})`);
          checked++;
        }
      }
    }
    assert.equal(checked, 112, 'شبکه باید واقعاً پیمایش شود — حلقه‌ی خالی سبزِ دروغ است');
  });
});

describe('grantedExtension', () => {
  test('به سقفِ رستوران محدود می‌شود', () => {
    assert.equal(grantedExtension(20, 15), 15);
    assert.equal(grantedExtension(10, 15), 10);
  });
  test('سقفِ صفر مجاز است و تمدید صفر می‌شود (D-18)', () => {
    assert.equal(grantedExtension(20, 0), 0);
  });
  test('سقفِ ناهمخوان هم از ۳۰ بالاتر نمی‌رود و منفی نمی‌شود', () => {
    assert.equal(grantedExtension(45, 99), 30);
    assert.equal(grantedExtension(-5, 15), 0);
    assert.equal(grantedExtension(12.9, 15), 12);
  });
});

// D-26: انتقالی که پس از مهلتِ مهمان رخ می‌دهد (cron خاموش بوده) «جبرانی» است — نه پیامک، نه no_showِ خودکار.
describe('isCatchUpTransition (D-26)', () => {
  test('دقیقاً در لحظه‌ی مهلت یا پس از آن جبرانی است؛ یک میلی‌ثانیه پیش از آن نه', () => {
    const r = { slotStart: T0, lateExtensionMinutes: 0 };
    const dl = guestDeadline(r, 15);
    // مرز «≥» است: در همان لحظه پرسنل مجازِ «نیومد» است و ساعتِ پیامک «همین حالا» می‌شد — هیچ فرصتی نمی‌ماند.
    assert.equal(isCatchUpTransition(r, 15, dl), true);
    assert.equal(isCatchUpTransition(r, 15, new Date(dl.getTime() - 1)), false);
    assert.equal(isCatchUpTransition(r, 15, min(40)), true);
    assert.equal(isCatchUpTransition(r, 15, min(3)), false);
  });
  test('تمدیدِ مهمان مرز را جابه‌جا می‌کند', () => {
    const r = { slotStart: T0, lateExtensionMinutes: 10 };
    assert.equal(isCatchUpTransition(r, 15, min(20)), false);
    assert.equal(isCatchUpTransition(r, 15, min(25)), true);
  });
});
