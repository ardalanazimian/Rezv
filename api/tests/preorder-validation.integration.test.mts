import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-A فاز ۲ (۰۷۸) — اعتبارسنجیِ pre-order در ثبتِ رزرو (B2/B4/B7)
//
//  از راهِ خودِ createReservation (همان مسیری که route صدا می‌زند) قفل می‌کند:
//   • آیتمِ «ناموجود» → ۴۲۲ با پیامِ دامنه (نه سکوت، نه FK)
//   • آیتمِ غیرفعال → ۴۲۲
//   • آیتمِ رستورانِ دیگر → ۴۲۲ (قفلِ مجددِ رفعِ امنیتیِ ۰۸-۱۳)
//   • UUIDِ کاملاً جعلی → ۴۲۲ — نه خطای خامِ FK (اثباتِ جابه‌جاییِ اعتبارسنجی
//     به قبل از درج؛ قبلاً createMany اول اجرا می‌شد)
//   • آیتمِ بیرونِ پنجره نسبت به **slotStart** (نه «اکنون») → ۴۲۲
//   • happy path: قیمت فقط از DB — checkout.subtotal = قیمتِ DB × qty
//     (در کلِ قرارداد جایی برای قیمتِ کلاینت وجود ندارد)
//
//  هوک‌ها داخلِ describe (قانونِ رانر).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { createReservation } = await import('../src/lib/reservations.ts');
const { fixturePhone } = await import('./_phone.helper.mts');
const { weekdayInTz } = await import('../src/lib/hours');

const TAG = `pov-${randomUUID().slice(0, 8)}`;
// دورِ کافی که با هیچ افقِ رزروی برخورد نکند؛ ۲۰:۰۰ به وقتِ تهران.
const SLOT_DATE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const SLOT_TIME = '20:00';

async function tryCreate(restaurantId: string, userId: string, preorder: { menuItemId: string; qty: number }[]) {
  try {
    const r = await createReservation({
      restaurantId, date: SLOT_DATE, time: SLOT_TIME, partySize: 2,
      userId, source: 'app', notifySms: false, preorder,
    });
    return { ok: true as const, r };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return { ok: false as const, status: err.status, message: err.message || String(e) };
  }
}

describe('اعتبارسنجیِ pre-order (SPEC-A فاز ۲ / ۰۷۸)', () => {
  let tenantId = '', restA = '', restB = '', userId = '';
  let okItem = '', outItem = '', inactiveItem = '', windowItem = '', foreignItem = '';

  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
    tenantId = t.id;
    const mk = (slug: string, prefix: string) => db.restaurant.create({
      data: { tenantId, slug: `${TAG}-${slug}`, name: `[DEMO] ${slug}`, timezone: 'Asia/Tehran',
              clubPrefix: prefix, isOpen: true, onlineGating: false },
      select: { id: true },
    });
    restA = (await mk('a', 'PA')).id;
    restB = (await mk('b', 'PB')).id;
    await db.table.create({ data: { restaurantId: restA, number: 1, capacity: 4, isActive: true } });

    const u = await db.user.create({
      data: { phone: fixturePhone('0944'), firstName: '[DEMO]', lastName: 'پیش‌سفارش' },
      select: { id: true },
    });
    userId = u.id;

    const item = (name: string, restaurantId: string, extra: Record<string, unknown> = {}) =>
      db.menuItem.create({
        data: { restaurantId, name: `${name} ${TAG}`, priceToman: 150_000, ...extra },
        select: { id: true },
      });
    okItem = (await item('سالم', restA)).id;
    outItem = (await item('ناموجود', restA, { isOutOfStock: true })).id;
    inactiveItem = (await item('حذف‌شده', restA, { isActive: false })).id;
    foreignItem = (await item('بیگانه', restB)).id;

    // پنجره‌ای که «روزِ اسلات» را دارد ولی بازه‌اش صبح است (۶ تا ۱۰) —
    // ردشدن باید به‌خاطرِ ساعتِ slotStart (۲۰:۰۰) باشد، نه روز.
    const slotDay = weekdayInTz(SLOT_DATE, 'Asia/Tehran');
    windowItem = (await item('صبحانه', restA, {
      availability: { days: [slotDay], start_min: 360, end_min: 600 },
    })).id;
  });

  after(async () => {
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: restA } } });
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: restA } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: restA } });
    await db.clubMember.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
    await db.clubCodeCounter.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
    await db.menuItem.deleteMany({ where: { restaurantId: { in: [restA, restB] } } });
    await db.table.deleteMany({ where: { restaurantId: restA } });
    await db.restaurant.deleteMany({ where: { id: { in: [restA, restB] } } });
    // happy path امتیاز/اقتصاد ثبت می‌کند و FKِ user را قفل می‌کند
    await db.pointsLedger.deleteMany({ where: { userId } }).catch(() => {});
    await db.economyLedgerEntry.deleteMany({ where: { userId } }).catch(() => {});
    await db.customerEconomyProfile.deleteMany({ where: { userId } }).catch(() => {});
    await db.user.deleteMany({ where: { id: userId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
  });

  test('آیتمِ ناموجود → ۴۲۲ با پیامِ دامنه؛ هیچ رزروی نمی‌ماند', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: outItem, qty: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
    assert.ok(r.message!.includes('ناموجود'), r.message);
    assert.equal(await db.reservation.count({ where: { restaurantId: restA } }), 0, 'تراکنش کامل برگشته');
  });

  test('آیتمِ غیرفعال → ۴۲۲', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: inactiveItem, qty: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
    assert.ok(r.message!.includes('برداشته شده'), r.message);
  });

  test('آیتمِ رستورانِ دیگر → ۴۲۲ (ضدِ نشتِ بین‌رستورانی — قفلِ ۰۸-۱۳)', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: foreignItem, qty: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
  });

  test('UUIDِ کاملاً جعلی → ۴۲۲، نه خطای خامِ FK (اعتبارسنجی قبل از درج)', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: randomUUID(), qty: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422, `باید ۴۲۲ی تمیز باشد، نه: ${r.message}`);
    assert.ok(!/foreign key|P2003/i.test(r.message!), 'خطای FK نباید به بیرون درز کند');
  });

  test('آیتمِ بیرونِ پنجره نسبت به slotStart (رزروِ ۲۰:۰۰، پنجره‌ی صبح) → ۴۲۲', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: windowItem, qty: 1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
    assert.ok(r.message!.includes('سرو نمی‌شود'), r.message);
  });

  test('happy path: رزرو + ReservationItem + قیمت فقط از DB (checkout.subtotal)', async () => {
    const r = await tryCreate(restA, userId, [{ menuItemId: okItem, qty: 2 }]);
    assert.equal(r.ok, true, (r as { message?: string }).message);
    const res = (r as { r: { code: string; checkout: { subtotal: number } } }).r;
    assert.equal(res.checkout.subtotal, 300_000, 'قیمتِ DB (۱۵۰هزار) × ۲ — هیچ ردی از قیمتِ کلاینت');

    const row = await db.reservationItem.findFirst({
      where: { menuItemId: okItem }, select: { qty: true },
    });
    assert.equal(row!.qty, 2);
  });
});
