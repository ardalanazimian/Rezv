import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — به دلیل باگ محیطیِ import استاتیک چندنامی در ترکیب
// tsx+node:test در این sandbox (شرح کامل در tests/validate.test.mts).
//
// ⚠️ این فایل جایگزینِ نسخه‌ی قبلیِ lifecycle.test.mjs شد. نسخه‌ی قبلی جدولِ
// TRANSITIONS را به‌صورت دستی داخل فایل تست بازتولید کرده بود و آن کپی با
// کدِ واقعیِ lib/lifecycle.ts دیگر هماهنگ نبود (مثلاً ادعا می‌کرد
// confirmed→seated مستقیم مجاز است، در حالی که کدِ واقعی برای این گذر
// عبور از checked_in را الزامی می‌کند) — یعنی رگرسیون واقعی را هرگز نمی‌گرفت.
const { canTransition } = await import('../src/lib/lifecycle.ts');

describe('canTransition — انتقال‌های مجاز', () => {
  test('pending → confirmed مجاز است', () => {
    assert.equal(canTransition('pending', 'confirmed'), true);
  });
  test('confirmed → checked_in → seated (نه مستقیم confirmed→seated)', () => {
    assert.equal(canTransition('confirmed', 'checked_in'), true);
    assert.equal(canTransition('checked_in', 'seated'), true);
    // این دقیقاً همان چیزی است که تستِ قبلیِ (بازتولیدشده) اشتباه فرض می‌کرد:
    assert.equal(canTransition('confirmed', 'seated'), false, 'confirmed نباید مستقیم به seated برود');
  });
  test('seated → dining → completed مسیر کامل', () => {
    assert.equal(canTransition('seated', 'dining'), true);
    assert.equal(canTransition('dining', 'completed'), true);
  });
  test('seated می‌تواند مستقیم هم completed شود (مسیر کوتاه)', () => {
    assert.equal(canTransition('seated', 'completed'), true);
  });
});

describe('canTransition — انتقال‌های ممنوع', () => {
  test('وضعیت‌های پایانی هیچ انتقالی ندارند', () => {
    for (const final of ['completed', 'no_show', 'rejected', 'expired', 'cancelled', 'auto_cancelled']) {
      assert.equal(canTransition(final, 'confirmed'), false, `${final} باید پایانی باشد`);
    }
  });
  test('pending نمی‌تواند مستقیم به seated برود', () => {
    assert.equal(canTransition('pending', 'seated'), false);
  });
  test('completed نمی‌تواند به هیچ‌کدام برگردد (بدون گذر معکوس)', () => {
    assert.equal(canTransition('completed', 'seated'), false);
    assert.equal(canTransition('completed', 'cancelled'), false);
  });
  test('cancelled یک وضعیت پایانی است و از آن نمی‌توان خارج شد', () => {
    assert.equal(canTransition('cancelled', 'confirmed'), false);
  });
});

describe('canTransition — وضعیت‌های قدیمی (سازگاری)', () => {
  test('arrived (قدیمی) هنوز به seated/cancelled راه دارد', () => {
    assert.equal(canTransition('arrived', 'seated'), true);
    assert.equal(canTransition('arrived', 'cancelled'), true);
  });
  test('cancelled_by_user/cancelled_by_restaurant پایانی‌اند', () => {
    assert.equal(canTransition('cancelled_by_user', 'cancelled'), false);
    assert.equal(canTransition('cancelled_by_restaurant', 'cancelled'), false);
  });
});

describe('canTransition — markArrival (رزروِ چرخه‌ی حیات، ۲۰۲۶-۰۸-۱۳)', () => {
  // markArrival حالا از طریقِ transitionReservation به checked_in منتقل می‌شه
  // (نه تنظیمِ مستقیمِ status='arrived'ِ قدیمی). این تست‌ها دقیقاً همون
  // مجموعه‌ی مبداءهایی رو قفل می‌کنن که کامنتِ markArrival در reservations.ts
  // ادعا می‌کنه («auto_confirmed، preparing، running_late، confirmed →
  // checked_in مجازند؛ pending نه») — تا رگرسیونِ سکوت‌آمیز در TRANSITIONS
  // بلافاصله در این تست دیده بشه، نه فقط در رفتارِ زنده‌ی route.
  test('confirmed/auto_confirmed → checked_in مجازند', () => {
    assert.equal(canTransition('confirmed', 'checked_in'), true);
    assert.equal(canTransition('auto_confirmed', 'checked_in'), true);
  });
  test('pending نمی‌تواند مستقیم checked_in شود — باید اول confirm شود', () => {
    assert.equal(canTransition('pending', 'checked_in'), false);
  });
});

describe('canTransition — waitlist', () => {
  test('waitlisted → confirmed مجاز است (ارتقا از صف)', () => {
    assert.equal(canTransition('waitlisted', 'confirmed'), true);
  });
  test('waitlisted → seated مستقیم مجاز نیست', () => {
    assert.equal(canTransition('waitlisted', 'seated'), false);
  });
});
