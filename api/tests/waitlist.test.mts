import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — به دلیل باگ محیطیِ import استاتیک چندنامی در ترکیب
// tsx+node:test در این sandbox (شرح کامل در tests/validate.test.mts).
//
// نکته: isVipTier/tierToPriority به‌عنوان توابعِ خالصِ قابل‌تست از computePriority
// جدا شدند (همان الگوی reservation-helpers.ts) تا این تست واقعاً کدِ اصلی را
// اجرا کند، نه یک کپیِ دستی از آن.
const { isVipTier, tierToPriority, medianMinutes, resolveAvgDiningMinutes, tokensEqual, assertCanActOnEntry } = await import('../src/lib/waitlist.ts');

describe('isVipTier', () => {
  test('platinum و vip و gold همگی VIP محسوب می‌شوند', () => {
    assert.equal(isVipTier('platinum'), true);
    assert.equal(isVipTier('vip'), true);
    assert.equal(isVipTier('gold'), true);
  });
  test('silver و bronze و نامعتبر VIP نیستند', () => {
    assert.equal(isVipTier('silver'), false);
    assert.equal(isVipTier('bronze'), false);
    assert.equal(isVipTier('unknown'), false);
  });
});

describe('tierToPriority', () => {
  test('platinum/vip بالاترین اولویت (۱۰۰) را دارند', () => {
    assert.equal(tierToPriority('platinum'), 100);
    assert.equal(tierToPriority('vip'), 100);
  });
  test('gold اولویت ۵۰ دارد (کمتر از platinum با اینکه هردو VIP‌اند)', () => {
    assert.equal(tierToPriority('gold'), 50);
    assert.ok(tierToPriority('gold') < tierToPriority('platinum'));
  });
  test('silver اولویت ۲۰ دارد', () => {
    assert.equal(tierToPriority('silver'), 20);
  });
  test('bronze/نامعتبر اولویت صفر (عادی) دارند', () => {
    assert.equal(tierToPriority('bronze'), 0);
    assert.equal(tierToPriority('unknown'), 0);
  });
});

describe('ترتیب صف بر اساس اولویت + FIFO (شبیه‌سازی مرتب‌سازی واقعی Prisma orderBy)', () => {
  // خودِ مرتب‌سازی توسط Prisma (`orderBy: [{priority:'desc'},{joinedAt:'asc'}]`)
  // انجام می‌شود، نه کدِ JS؛ اینجا فقط تضمین می‌کنیم ورودیِ اولویت (خروجیِ
  // tierToPriority) با ترتیبِ مورد انتظار سازگار است.
  test('VIP باید عدد اولویتِ بالاتری از مشتریِ عادی داشته باشد', () => {
    assert.ok(tierToPriority('vip') > tierToPriority('bronze'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  تخمینِ زمانِ انتظار قبلاً همیشه از یک ثابتِ سراسری (۷۵ دقیقه) برایِ همه‌ی
//  رستوران‌ها استفاده می‌کرد. resolveAvgDiningMinutes همان قاعده‌ی ایمنیِ
//  no-show model/demand forecast را برایِ این پارامترِ ساده‌تر پیاده می‌کند:
//  فقط با نمونه‌ی کافی از میانگینِ واقعیِ خودِ رستوران استفاده کن.
// ═══════════════════════════════════════════════════════════════════════

describe('medianMinutes', () => {
  test('آرایه‌ی خالی → null', () => {
    assert.equal(medianMinutes([]), null);
  });
  test('طولِ فرد → عنصرِ وسط', () => {
    assert.equal(medianMinutes([10, 30, 20]), 20);
  });
  test('طولِ زوج → میانگینِ دو عنصرِ وسط', () => {
    assert.equal(medianMinutes([10, 20, 30, 40]), 25);
  });
  test('نسبت به یک outlierِ بزرگ مقاوم است (برخلافِ میانگین)', () => {
    // میانگین اینجا (60+65+70+600)/4=198.75 می‌شد؛ میانه واقع‌گراتر است
    assert.equal(medianMinutes([60, 65, 70, 600]), 67.5);
  });
});

describe('resolveAvgDiningMinutes — قاعده‌ی ایمنی', () => {
  test('نمونه‌ی کم (رستورانِ تازه‌کار) → بی‌صدا به پیش‌فرض برمی‌گردد', () => {
    const samples = Array(10).fill(50); // کمتر از حداقلِ ۱۵
    assert.equal(resolveAvgDiningMinutes(samples, 75), 75);
  });
  test('نمونه‌ی کافی و معقول → میانه‌ی واقعی استفاده می‌شود', () => {
    const samples = Array(20).fill(50);
    assert.equal(resolveAvgDiningMinutes(samples, 75), 50);
  });
  test('میانه‌ی خارج از بازه‌ی معقول (دادهٔ خراب) → به پیش‌فرض برمی‌گردد', () => {
    const tooShort = Array(20).fill(5);   // کمتر از ۱۵ دقیقه — احتمالاً رویدادِ ازقلم‌افتاده
    const tooLong = Array(20).fill(500);  // بیشتر از ۴ ساعت
    assert.equal(resolveAvgDiningMinutes(tooShort, 75), 75);
    assert.equal(resolveAvgDiningMinutes(tooLong, 75), 75);
  });
  test('دقیقاً روی آستانه‌ی حداقلِ نمونه کار می‌کند', () => {
    const samples = Array(15).fill(90);
    assert.equal(resolveAvgDiningMinutes(samples, 75), 90);
  });
});

describe('tokensEqual — مقایسه‌ی constant-time', () => {
  test('توکن‌هایِ برابر → true', () => {
    assert.equal(tokensEqual('a1b2c3', 'a1b2c3'), true);
  });
  test('توکن‌هایِ نابرابر (طولِ یکسان) → false', () => {
    assert.equal(tokensEqual('a1b2c3', 'a1b2c4'), false);
  });
  test('طولِ متفاوت → false (بدونِ کرش)', () => {
    assert.equal(tokensEqual('short', 'a-much-longer-token-string'), false);
  });
});

describe('assertCanActOnEntry — رفعِ IDOR در waitlist (۲۰۲۶-۰۸-۱۳)', () => {
  test('ورودیِ متعلق‌به‌کاربر: با callerUserIdِ درست عبور می‌کند', () => {
    assert.doesNotThrow(() =>
      assertCanActOnEntry({ userId: 'u1', guestAccessToken: null }, { callerUserId: 'u1' }));
  });
  test('ورودیِ متعلق‌به‌کاربر: بدونِ توکن (کاملاً غیرِ‌احرازشده) رد می‌شود', () => {
    // این دقیقاً همون سوراخِ IDORِ رفع‌شده است — قبلاً callerUserIdِ نامعین
    // (نه فقط اشتباه) بی‌صدا از کنارِ چک رد می‌شد.
    assert.throws(() => assertCanActOnEntry({ userId: 'u1', guestAccessToken: null }, {}));
  });
  test('ورودیِ متعلق‌به‌کاربر: با callerUserIdِ کاربرِ دیگر رد می‌شود', () => {
    assert.throws(() =>
      assertCanActOnEntry({ userId: 'u1', guestAccessToken: null }, { callerUserId: 'u2' }));
  });
  test('ورودیِ مهمان: با guestTokenِ درست عبور می‌کند', () => {
    assert.doesNotThrow(() =>
      assertCanActOnEntry({ userId: null, guestAccessToken: 'tok123' }, { guestToken: 'tok123' }));
  });
  test('ورودیِ مهمان: بدونِ توکن رد می‌شود', () => {
    assert.throws(() => assertCanActOnEntry({ userId: null, guestAccessToken: 'tok123' }, {}));
  });
  test('ورودیِ مهمان: با guestTokenِ اشتباه رد می‌شود', () => {
    assert.throws(() =>
      assertCanActOnEntry({ userId: null, guestAccessToken: 'tok123' }, { guestToken: 'wrong' }));
  });
  test('ورودیِ مهمانی که (به‌هردلیل) guestAccessToken ندارد — همیشه رد می‌شود، حتی با توکنِ کلاینت', () => {
    // دفاعِ لایه‌دوم: اگه یه ردیفِ قدیمی/خراب guestAccessToken=null داشته باشه،
    // نباید با هیچ توکنی قابلِ‌بایپس باشه.
    assert.throws(() =>
      assertCanActOnEntry({ userId: null, guestAccessToken: null }, { guestToken: 'anything' }));
  });
});
