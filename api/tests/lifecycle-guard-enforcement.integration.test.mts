import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  اجرایِ ماشینِ حالت — نه فقط جدولش  (نمونه‌گیریِ جهش، ۲۰۲۶-۰۸-۲۸)
//
//  ⚠️ چرا این فایل ساخته شد: تست‌های موجود `canTransition` را **مستقیم** صدا
//  می‌زنند و جدولِ `TRANSITIONS` را می‌سنجند (`lifecycle.test.mts:43` مثلاً
//  `canTransition('completed','seated') === false`). هیچ‌کدام نمی‌سنجند که
//  `transitionReservation` واقعاً آن جدول را **اجرا** می‌کند.
//
//  نتیجه‌اش در نمونه‌گیریِ جهش دیده شد: جایگزینیِ
//      if (!canTransition(from, to)) throw Err.invalidTransition(from, to);
//  با
//      if (from === to) throw Err.invalidTransition(from, to);
//  از هر ۱۰ فایلِ تستی که این ماژول را لمس می‌کنند **سالم رد شد** — یعنی
//  می‌شد کلِ گاردِ انتقال را برداشت و سوئیت سبز می‌ماند.
//
//  دو جهشِ دیگر هم زنده مانده بودند و این فایل هر دو را می‌بندد:
//    L3  `?? false` → `?? true`  (وضعیتِ ناشناخته fail-open می‌شود)
//    L5  افزودنِ `completed` به خروجی‌های `checked_in` (پرشِ چرخه)
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { transitionReservation, canTransition } = await import('../src/lib/lifecycle.ts');

const SFX = String(Date.now()).slice(-8);
let tenantId = '';
let restaurantId = '';

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] lifecycle-guard ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `demo-lc-guard-${SFX}`, name: '[DEMO] رستورانِ گاردِ چرخه',
      clubPrefix: 'DLG', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

/** رزروی در وضعیتِ دلخواه. */
async function makeReservation(status: string, code: string) {
  const start = new Date(Date.now() + 3 * 3600_000);
  return db.reservation.create({
    data: {
      restaurantId, code, status: status as never, partySize: 2,
      slotStart: start, slotEnd: new Date(+start + 90 * 60_000),
      guestName: '[DEMO] مهمان', guestPhone: '09370000002',
    },
    select: { id: true, code: true, status: true },
  });
}

describe('گاردِ انتقال واقعاً اجرا می‌شود، نه فقط اعلام', () => {
  test('انتقالِ نامعتبر از یک حالتِ پایانی رد می‌شود (completed → seated)', async () => {
    const r = await makeReservation('completed', `LG${SFX}A`.slice(0, 12));
    await assert.rejects(
      () => transitionReservation({
        reservationId: r.id, to: 'seated', actor: 'staff', notify: false,
      } as never),
      /مجاز نیست|INVALID_STATUS_TRANSITION/i,
      'جدول این را ممنوع می‌داند؛ این تست می‌سنجد که transitionReservation هم '
      + 'واقعاً اجرایش می‌کند — نه اینکه فقط جدول درست باشد',
    );
    const after = await db.reservation.findUnique({
      where: { id: r.id }, select: { status: true },
    });
    assert.equal(after?.status, 'completed', 'وضعیت نباید عوض شده باشد');
  });

  test('پرشِ چرخه رد می‌شود (checked_in → completed)', async () => {
    const r = await makeReservation('checked_in', `LG${SFX}B`.slice(0, 12));
    await assert.rejects(
      () => transitionReservation({
        reservationId: r.id, to: 'completed', actor: 'staff', notify: false,
      } as never),
      /مجاز نیست|INVALID_STATUS_TRANSITION/i,
      'مسیرِ درست checked_in → seated → dining/completed است',
    );
  });

  test('کنترلِ مثبت: انتقالِ معتبر عبور می‌کند (checked_in → seated)', async () => {
    const r = await makeReservation('checked_in', `LG${SFX}C`.slice(0, 12));
    await transitionReservation({
      reservationId: r.id, to: 'seated', actor: 'staff', notify: false,
    } as never);
    const after = await db.reservation.findUnique({
      where: { id: r.id }, select: { status: true },
    });
    assert.equal(after?.status, 'seated',
      'بدونِ این کنترل، گاردی که **همه‌ی** انتقال‌ها را رد کند هم دو تستِ بالا را پاس می‌کرد');
  });
});

describe('حالتِ ناشناخته باید بسته باشد، نه باز', () => {
  test('canTransition برای مبدأی که در جدول نیست false می‌دهد', () => {
    assert.equal(canTransition('not_a_real_status' as never, 'confirmed' as never), false,
      '`?? true` این را به fail-open تبدیل می‌کند: هر وضعیتِ ناشناخته‌ای — '
      + 'مثلاً پس از افزودنِ یک مقدارِ تازه به enum و فراموش‌کردنِ جدول — '
      + 'همه‌ی انتقال‌ها را مجاز می‌کرد',
    );
  });

  test('کنترلِ مثبت: مبدأِ شناخته با مقصدِ مجاز true می‌دهد', () => {
    assert.equal(canTransition('checked_in' as never, 'seated' as never), true);
  });
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});
