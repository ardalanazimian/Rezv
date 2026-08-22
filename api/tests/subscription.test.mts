import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  computeSubscriptionStatus — تابعِ خالصی که وضعیتِ اشتراکِ هر تنانت را
//  در پنلِ شرکت تعیین می‌کند. تا امروز صفر تست داشت.
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۸-۲۲): تصمیمِ «منقضی شده یا نه»
//  رویِ عددِ گِردشده گرفته می‌شد. چون `Math.ceil(-0.5) === -0` و در
//  جاوااسکریپت `-0 < 0` **نادرست** است، اشتراکی که هر لحظه‌ای در ۲۴ ساعتِ
//  گذشته منقضی شده بود از شرطِ «منقضی» رد می‌شد و «رو به اتمام» با
//  «۰ روز باقی‌مانده» گزارش می‌شد. `-0` در JSON هم `0` می‌شود، پس هیچ
//  نشانه‌ای باقی نمی‌ماند.
//
//  مدیرِ پلتفرم که فهرستِ تمدید را از همین صفحه برمی‌دارد، هر تنانتی را که
//  در روزِ اولِ انقضا بود از قلم می‌انداخت.
// ═══════════════════════════════════════════════════════════════════════

const { computeSubscriptionStatus } = await import('../src/lib/subscription');

const HOUR = 3_600_000;
const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms);
const ahead = (ms: number) => new Date(Date.now() + ms);

// ─────────────────────────────────────────────────────────────────────
describe('پنجره‌ی ۲۴ ساعته‌ی بعد از انقضا (باگِ -۰)', () => {
  for (const h of [1, 6, 12, 23]) {
    test(`⚠️ منقضی‌شده ${h} ساعت پیش → «منقضی»، نه «رو به اتمام»`, () => {
      // ⚠️ قفلِ اصلی. پیش از رفع، هر چهار مورد `expiring` برمی‌گرداندند.
      const out = computeSubscriptionStatus(ago(h * HOUR), null);
      assert.equal(out.status, 'expired');
    });
  }

  test('⚠️ `daysLeft` هرگز -۰ نیست (در JSON از ۰ قابلِ‌تشخیص نیست)', () => {
    const out = computeSubscriptionStatus(ago(12 * HOUR), null);
    assert.ok(!Object.is(out.daysLeft, -0), 'باید ۰ باشد نه -۰');
    assert.equal(JSON.parse(JSON.stringify(out)).daysLeft, 0);
  });

  test('همان پنجره در دوره‌ی آزمایشی هم بسته است', () => {
    const out = computeSubscriptionStatus(null, ago(12 * HOUR));
    assert.equal(out.status, 'trial_expired');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('اشتراکِ پولی', () => {
  test('منقضی‌شده‌ی چندروزه → منقضی، با روزهای منفی', () => {
    const out = computeSubscriptionStatus(ago(5 * DAY), null);
    assert.equal(out.status, 'expired');
    assert.ok(out.daysLeft !== null && out.daysLeft < 0);
  });

  test('یک ساعت تا انقضا → رو به اتمام (نه منقضی)', () => {
    const out = computeSubscriptionStatus(ahead(1 * HOUR), null);
    assert.equal(out.status, 'expiring');
  });

  test('دقیقاً روی مرزِ ۱۴ روز → هنوز رو به اتمام', () => {
    const out = computeSubscriptionStatus(ahead(14 * DAY - HOUR), null);
    assert.equal(out.status, 'expiring');
    assert.equal(out.daysLeft, 14);
  });

  test('یک روز آن‌طرف‌ترِ مرز → فعال', () => {
    const out = computeSubscriptionStatus(ahead(15 * DAY), null);
    assert.equal(out.status, 'active');
    assert.equal(out.daysLeft, 15);
  });

  test('اشتراکِ پولی بر دوره‌ی آزمایشی اولویت دارد', () => {
    // تنانتی که هم trial داشته هم بعداً پلن خریده — باید پلن حرفِ آخر را بزند.
    const out = computeSubscriptionStatus(ahead(30 * DAY), ago(10 * DAY));
    assert.equal(out.status, 'active');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('دوره‌ی آزمایشی و اشتراکِ نامحدود', () => {
  test('آزمایشیِ جاری → trial با روزهای مثبت', () => {
    const out = computeSubscriptionStatus(null, ahead(3 * DAY));
    assert.equal(out.status, 'trial');
    assert.equal(out.daysLeft, 3);
  });

  test('آزمایشیِ تمام‌شده‌ی چندروزه → trial_expired', () => {
    const out = computeSubscriptionStatus(null, ago(3 * DAY));
    assert.equal(out.status, 'trial_expired');
    assert.ok(out.daysLeft !== null && out.daysLeft < 0);
  });

  test('بدونِ هیچ تاریخی → فعالِ نامحدود با daysLeft = null', () => {
    // null یعنی «انقضایی ندارد»، نه «صفر روز مانده» — این تمایز عمدی است.
    const out = computeSubscriptionStatus(null, null);
    assert.equal(out.status, 'active');
    assert.equal(out.daysLeft, null);
  });
});
