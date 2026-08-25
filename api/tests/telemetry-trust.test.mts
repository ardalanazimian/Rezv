import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  مرزِ اعتمادِ تله‌متری — تست‌هایِ خالص (فازِ ۲، پروتکل §۱۴ و §۱۵)
//
//  زمینه‌ی صادقانه: امروز **هیچ کدی platform_events را نمی‌خواند** (تأییدشده
//  با grep در بازبینیِ مستقل؛ مدل‌ها از `reservations` و `customer_insights`
//  آموزش می‌بینند). پس این کار **پیشگیرانه** است، نه رفعِ نشتِ فعال — ولی
//  §۱۵ می‌گوید تفکیکِ سطحِ اعتماد باید از لحظه‌ی درج ثبت شود، چون بعداً
//  قابلِ بازسازی نیست.
//
//  پیش از این هیچ تستی تله‌متری را لمس نمی‌کرد (صفر).
// ═══════════════════════════════════════════════════════════════════════

const { clampOccurredAt } = await import('../src/lib/platform-events.ts');

describe('clampOccurredAt — اعتبارسنجیِ زمان (§۱۴)', () => {
  const now = new Date('2026-08-23T12:00:00.000Z');

  test('زمانِ معقولِ گذشته دست‌نخورده می‌ماند', () => {
    const t = new Date('2026-08-23T11:30:00.000Z');
    const r = clampOccurredAt(t, now);
    assert.equal(+r.value, +t);
    assert.equal(r.clamped, false);
  });

  test('آینده‌ی دور کلمپ می‌شود (کلاینت نمی‌تواند رویدادِ ۲۰۹۹ بسازد)', () => {
    const r = clampOccurredAt(new Date('2099-01-01T00:00:00.000Z'), now);
    assert.equal(r.clamped, true);
    assert.equal(+r.value, +now, 'باید به «اکنون» بیاید');
  });

  test('گذشته‌ی دور کلمپ می‌شود (کلاینت نمی‌تواند رویداد را به ۲۰۱۰ ببرد)', () => {
    const r = clampOccurredAt(new Date('2010-01-01T00:00:00.000Z'), now);
    assert.equal(r.clamped, true);
    // به لبه‌ی پنجره (۳۰ روز قبل) می‌آید، نه به «اکنون» — تا رویدادِ واقعاً
    // قدیمیِ صفِ آفلاین با رویدادِ تازه اشتباه گرفته نشود.
    const thirtyDaysAgo = new Date(+now - 30 * 24 * 3600_000);
    assert.equal(+r.value, +thirtyDaysAgo);
  });

  test('اختلافِ ساعتِ کوچکِ دستگاه (چند دقیقه جلو) پذیرفته می‌شود', () => {
    // پنجره‌ی آینده عمداً کوچک ولی غیرِصفر است: ساعتِ موبایل واقعاً کمی جلو/عقب است.
    const t = new Date(+now + 2 * 60_000);
    const r = clampOccurredAt(t, now);
    assert.equal(r.clamped, false, 'دو دقیقه جلو نباید کلمپ شود');
  });

  test('صفِ آفلاینِ چندروزه معتبر می‌ماند (نه کلمپ)', () => {
    // analytics.js صف را در localStorage نگه می‌دارد؛ رویدادِ سه‌روزه واقعی است.
    const t = new Date(+now - 3 * 24 * 3600_000);
    const r = clampOccurredAt(t, now);
    assert.equal(r.clamped, false);
    assert.equal(+r.value, +t);
  });

  test('ورودیِ نامعتبر → «اکنون» و علامتِ کلمپ', () => {
    const r = clampOccurredAt('not-a-date', now);
    assert.equal(r.clamped, true);
    assert.equal(+r.value, +now);
  });

  test('نبودِ مقدار → «اکنون»، بدونِ علامتِ کلمپ', () => {
    const r = clampOccurredAt(undefined, now);
    assert.equal(r.clamped, false);
    assert.equal(+r.value, +now);
  });

  test('هرگز NaN برنمی‌گرداند (نمونه‌برداریِ ورودی‌هایِ بد)', () => {
    for (const bad of ['', 'abc', '0000-00-00', 'Invalid Date', '9999-99-99']) {
      const r = clampOccurredAt(bad, now);
      assert.ok(!isNaN(r.value.getTime()), `ورودیِ «${bad}» نباید NaN بدهد`);
    }
  });
});
