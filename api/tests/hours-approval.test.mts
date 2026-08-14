import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { hasPendingHoursChange, canReviewHoursChange, HOURS_STATUS_LABEL } =
  await import('../src/lib/hours-approval.ts');

// ═══════════════════════════════════════════════════════════════════════
//  hours-approval.ts — منطقِ خالصِ صفِ تأییدِ ساعتِ کاری (Part 3، ۲۰۲۶-۰۸-۱۴)
//
//  آینه‌ی tests/photo-moderation.test.mts، فقط برایِ ساعتِ کاری به‌جایِ عکس.
//  تستِ خودِ اعمالِ approve/reject روی DB (که واقعاً «زنده‌شدنِ ساعتِ کاری» را
//  اثبات می‌کند) در hours-change-approval.integration.test.mts است — اینجا
//  فقط قواعدِ خالصِ گیت‌کیپینگ.
// ═══════════════════════════════════════════════════════════════════════

describe('hasPendingHoursChange', () => {
  test('فقط pending را true می‌دهد', () => {
    assert.equal(hasPendingHoursChange('pending'), true);
    assert.equal(hasPendingHoursChange('rejected'), false);
    assert.equal(hasPendingHoursChange(null), false);
    assert.equal(hasPendingHoursChange(undefined), false);
  });
});

describe('canReviewHoursChange — گیتِ approve/reject در روتِ company', () => {
  test('فقط از pending می‌شود بررسی کرد', () => {
    assert.equal(canReviewHoursChange('pending'), true);
  });

  // اگر یک پیشنهاد قبلاً رد شده، شرکت نباید بتواند همان تصمیمِ کهنه را دوباره
  // approve/reject کند — رستوران‌دار باید دوباره صریحاً پیشنهاد بدهد (که
  // hoursChangeStatus را به pending برمی‌گرداند). وگرنه یک پیشنهادِ کهنه که
  // رستوران‌دار دیگر نمی‌خواهدش می‌تواند تأیید شود.
  test('چیزی که از قبل رد شده دوباره قابلِ بررسی نیست', () => {
    assert.equal(canReviewHoursChange('rejected'), false);
  });

  test('رکوردی بدونِ پیشنهادِ درِ دستِ بررسی (null) قابلِ بررسی نیست', () => {
    assert.equal(canReviewHoursChange(null), false);
    assert.equal(canReviewHoursChange(undefined), false);
  });
});

describe('HOURS_STATUS_LABEL — برچسبِ یک‌جا برایِ هر دو پنل', () => {
  test('برچسب‌های فارسیِ موردِ انتظار', () => {
    assert.equal(HOURS_STATUS_LABEL.pending, 'در انتظارِ تأییدِ شرکت');
    assert.equal(HOURS_STATUS_LABEL.rejected, 'ردشده');
  });
});
