import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
// فقط isCurrentlyBanned تست می‌شود (تابعِ خالص، بدونِ DB) — assertUserNotBanned/
// banUser/unbanUser نیازِ Postgresِ واقعی دارند و در سندباکس زنده تست شده‌اند
// (رجوع کن به بدنه‌ی PR: چک‌های ban روی مسیرهایِ waitlist/missions/rewards/reviews).
const { isCurrentlyBanned } = await import('../src/lib/ban.ts');

// ═══════════════════════════════════════════════════════════════════════
//  بن سختِ پلتفرم — «الان بن است» یعنی bannedAt ست شده و unbannedAt نال
//  است. این قاعده‌ی سادهِ خالص همه‌جا (assertUserNotBanned، banUser،
//  unbanUser، و چکِ زنده‌ی refresh token) تکیه‌گاهِ تصمیم‌گیری است — اگر این
//  تابع اشتباه کند، هم بن دورزده می‌شود هم رفعِ بن گیر می‌کند.
// ═══════════════════════════════════════════════════════════════════════

describe('isCurrentlyBanned', () => {
  test('bannedAt=null → بن نیست', () => {
    assert.equal(isCurrentlyBanned({ bannedAt: null, unbannedAt: null }), false);
  });
  test('bannedAt ست‌شده و unbannedAt=null → الان بن است', () => {
    assert.equal(isCurrentlyBanned({ bannedAt: new Date(), unbannedAt: null }), true);
  });
  test('bannedAt ست‌شده ولی بعداً unbannedAt هم ست‌شده → دیگر بن نیست (رفعِ بن)', () => {
    assert.equal(isCurrentlyBanned({ bannedAt: new Date('2026-01-01'), unbannedAt: new Date('2026-02-01') }), false);
  });
  test('یک تاریخِ بن-رفعِ‌بنِ دیگر (بنِ مجدد بعدِ رفعِ بنِ قبلی) — هردو ست‌اند ولی unbannedAt قبل از bannedAtِ جدید', () => {
    // سناریویِ واقعی: کاربر قبلاً بن و رفعِ بن شده، حالا دوباره بن شده — banUser
    // موقعِ بنِ مجدد unbannedAt را null می‌کند (رجوع کن به banUser بالا)، پس
    // این حالت (bannedAt جدید + unbannedAtِ قدیمی هنوز باقی‌مانده) نباید در
    // دیتایِ واقعی رخ دهد؛ اینجا فقط برایِ مستندسازیِ قاعده تست می‌شود: تا وقتی
    // unbannedAt هر مقداری غیرِ‌نال دارد، isCurrentlyBanned همیشه false برمی‌گرداند.
    assert.equal(isCurrentlyBanned({ bannedAt: new Date('2026-03-01'), unbannedAt: new Date('2026-01-01') }), false);
  });
});
