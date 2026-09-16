import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  وعده‌ی «امتیازهات هیچ‌وقت منقضی نمی‌شن» — قفلِ دیتابیسی، نه فقط regex
//
//  RT-18 (Red Team `rezv-25`، RETEST-2026-09-13): گاردِ `tools/check-loyalty-promise.mjs`
//  متن را می‌خواند. `const adjustment = 0 - row.points; … delta: adjustment` همان
//  کرونِ انقضا است و از `/delta\s*:\s*-/` رد می‌شد (خروجِ ۰، «۲۷۰ فایل اسکن شد»). هر
//  فهرستِ الگو یک rename عقب است. پس تضمین به دیتابیس رفت (مهاجرتِ ۰۸۸):
//
//      CHECK (delta >= 0 OR reason IN ('redemption', 'cashback'))
//
//  یعنی تنها نویسنده‌های منفیِ مشروعِ امروز — بازخریدِ کاربر (`redeemPointsTx`) و
//  برگشتِ کش‌بک (`reverseReservationCashback`) — می‌توانند امتیاز کم کنند. کسرِ
//  «تنظیمِ دستی» یا هر reasonِ دیگر، به هر شکلی که نوشته شود، روی DB رد می‌شود.
//
//  ⚠️ این تست رفتارِ **دیتابیس** را می‌سنجد، پس شکلِ کد (inline، hoisted، SQLِ خام)
//  بی‌اثر است — دقیقاً همان چیزی که regex نمی‌توانست.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { fixturePhone } = await import('./_phone.helper.mts');
const { addPoints } = await import('../src/lib/loyalty.ts');

// ⚠️ پیشوندِ ۰۹۲۹ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن (tests/_phone.helper.mts).
const PHONE_PREFIX = '0929';
const CONSTRAINT = 'points_ledger_negative_delta_reason';

let userId = '';

/** شکستی که **همین** قید بسازد — نه FK، نه enum، نه اتصال. */
async function rejectsByConstraint(fn: () => Promise<unknown>, label: string) {
  let caught: unknown = null;
  try { await fn(); } catch (e) { caught = e; }
  assert.ok(caught, `${label}: باید رد می‌شد ولی نوشته شد — وعده‌ی «منقضی نمی‌شن» روی DB محافظ ندارد`);
  assert.match(String((caught as Error)?.message ?? caught), new RegExp(CONSTRAINT),
    `${label}: رد شد، ولی نه به‌خاطرِ ${CONSTRAINT} — علتِ دیگری است و ادعا سنجیده نشده`);
}

before(async () => {
  const u = await db.user.create({
    data: { phone: fixturePhone(PHONE_PREFIX), firstName: '[DEMO]', lastName: 'قیدِ امتیاز' },
    select: { id: true },
  });
  userId = u.id;
});

after(async () => {
  // ⚠️ ۰۸۹/FP-009: دفترِ امتیاز فقط-افزودنی است — پاک‌سازیِ ردیف‌هایش ممکن نیست و تلاش برایش رد می‌شود. ردیف‌های [DEMO] در دیتابیسِ هر اجرا (که تازه ساخته می‌شود) می‌مانند.
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('points_ledger — کسرِ امتیاز فقط با reasonِ مجاز (RT-18، مهاجرتِ ۰۸۸)', () => {
  test('کنترلِ موضوع: قید روی جدول وجود دارد', async () => {
    const rows = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_constraint
      WHERE conname = ${CONSTRAINT} AND conrelid = 'points_ledger'::regclass`;
    assert.equal(rows[0].n, 1, `${CONSTRAINT} روی points_ledger نیست — مهاجرتِ ۰۸۸ اعمال نشده`);
  });

  test('🔴 کسرِ «تنظیمِ دستی» (شکلِ واقعیِ یک کرونِ انقضا) رد می‌شود', async () => {
    await rejectsByConstraint(
      () => db.pointsLedger.create({ data: { userId, delta: -10, reason: 'adjustment', note: '[DEMO] انقضا' } }),
      'pointsLedger.create با delta منفی و reason=adjustment',
    );
  });

  test('🔴 همان کسر از مسیرِ کتابخانه (addPoints) هم رد می‌شود — شکلِ کد بی‌اثر است', async () => {
    const points = 7;
    const adjustment = 0 - points; // همان شکلِ hoistedِ RT-18
    await rejectsByConstraint(
      () => addPoints({ userId, delta: adjustment, reason: 'adjustment', note: '[DEMO] جاروی امتیاز' }),
      'addPoints با delta منفی و reason=adjustment',
    );
  });

  test('🔴 SQLِ خام هم از قید رد نمی‌شود', async () => {
    await rejectsByConstraint(
      () => db.$executeRaw`INSERT INTO points_ledger (user_id, delta, reason, note)
             VALUES (${userId}::uuid, ${-3}::int, 'reservation'::points_reason, '[DEMO] خام')`,
      'INSERT خام با delta منفی و reason=reservation',
    );
  });

  test('کنترل: دو نویسنده‌ی منفیِ مشروع — بازخرید و برگشتِ کش‌بک — نوشته می‌شوند', async () => {
    // فقط ردیف‌های همین تست شمرده می‌شوند: اگر تست‌های بالا (بی‌قید) ردیفِ منفی نوشته باشند،
    // جمعِ کلِ دفتر این کنترل را به‌خاطرِ وضعیتِ دیگران قرمز می‌کرد — نه به‌خاطرِ خودش.
    const created = [
      await db.pointsLedger.create({ data: { userId, delta: 50, reason: 'signup', note: '[DEMO] پایه' } }),
      await db.pointsLedger.create({ data: { userId, delta: -20, reason: 'redemption', note: '[DEMO] بازخرید' } }),
      await db.pointsLedger.create({ data: { userId, delta: -5, reason: 'cashback', note: '[DEMO] برگشتِ کش‌بک' } }),
    ];
    const sum = await db.pointsLedger.aggregate({ where: { id: { in: created.map((r) => r.id) } }, _sum: { delta: true } });
    assert.equal(sum._sum.delta, 25, 'هر سه ردیف باید نشسته باشند');
  });

  test('کنترل: تنظیمِ دستیِ **مثبت** همچنان مجاز است', async () => {
    const row = await db.pointsLedger.create({ data: { userId, delta: 3, reason: 'adjustment', note: '[DEMO] جبران' } });
    assert.equal(row.delta, 3);
  });
});
