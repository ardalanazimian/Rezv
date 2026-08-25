import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «میزی که هرگز آزاد نمی‌شود» (فازِ ۲، پروتکل §۶)
//
//  باگ: Table.state مجموعه‌ی نویسنده‌ی جدا و بسیار کوچک‌تری از
//  reservation.status داشت. واک‌ین و QR check-in آن را 'occupied' می‌کردند،
//  ولی **هیچ مسیری** آن را هنگامِ پایانِ رزرو به 'free' برنمی‌گرداند و هیچ
//  jobِ آشتی‌دهنده‌ای هم وجود نداشت. یک درِ یک‌طرفه.
//
//  چرا فقط نمایشی نبود: promoteNext در waitlist.ts میزهایِ کاندید را با
//  `state: 'free'` فیلتر می‌کند — پس هر میزی که یک‌بار مهمان گرفته بود،
//  برایِ همیشه از ترفیعِ لیستِ انتظار کنار می‌رفت و قابلیتِ صف بی‌صدا
//  می‌پوسید.
//
//  مسیرِ availabilityِ مشتری عمداً تست نمی‌شود چون متأثر نبود
//  (availability.ts فقط 'maintenance' را فیلتر می‌کند).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { transitionReservation } = await import('../src/lib/lifecycle.ts');

let tenantId: string;
let restaurantId: string;

before(async () => {
  const sfx = Date.now();
  const t = await db.tenant.create({ data: { name: '[DEMO] tenant (table-release test)' } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `trel-${sfx}`, name: '[DEMO] رستورانِ تستِ آزادسازیِ میز', clubPrefix: 'TRL' },
  });
  restaurantId = r.id;
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

let seq = 0;
/** میزِ 'occupied' + رزروِ فعالِ همین حالا روی آن. */
async function seedOccupied(status = 'seated') {
  seq += 1;
  const table = await db.table.create({
    data: { restaurantId, number: 700 + seq, capacity: 4, state: 'occupied' },
  });
  const now = new Date();
  const resv = await db.reservation.create({
    data: {
      restaurantId, tableId: table.id,
      code: `RZTRL${String(seq).padStart(2, '0')}`,
      guestName: '[DEMO] مهمان', guestPhone: '+989120000002',
      partySize: 2,
      slotStart: new Date(+now - 30 * 60_000),
      slotEnd: new Date(+now + 60 * 60_000),
      status: status as never,
    },
  });
  return { table, resv };
}

async function tableState(id: string) {
  return (await db.table.findUnique({ where: { id }, select: { state: true } }))?.state;
}

describe('آزادسازیِ میز پس از وضعیتِ پایانی (§۶)', () => {
  test('completed → میز از occupied به free برمی‌گردد', async () => {
    const { table, resv } = await seedOccupied('seated');
    assert.equal(await tableState(table.id), 'occupied', 'پیش‌شرط');
    await transitionReservation({ reservationId: resv.id, to: 'completed', actor: 'system', notify: false });
    assert.equal(await tableState(table.id), 'free', 'میز باید آزاد شده باشد');
  });

  test('cancelled → میز آزاد می‌شود', async () => {
    const { table, resv } = await seedOccupied('seated');
    await transitionReservation({ reservationId: resv.id, to: 'cancelled', actor: 'staff:x', notify: false });
    assert.equal(await tableState(table.id), 'free');
  });

  test('no_show → میز آزاد می‌شود', async () => {
    const { table, resv } = await seedOccupied('running_late');
    await transitionReservation({ reservationId: resv.id, to: 'no_show', actor: 'cron', notify: false });
    assert.equal(await tableState(table.id), 'free');
  });

  test('انتقالِ **غیرِ** پایانی میز را آزاد نمی‌کند', async () => {
    // seated → dining هنوز یعنی مهمان سرِ میز است.
    const { table, resv } = await seedOccupied('seated');
    await transitionReservation({ reservationId: resv.id, to: 'dining', actor: 'staff:x', notify: false });
    assert.equal(await tableState(table.id), 'occupied', 'میز نباید زودتر آزاد شود');
  });

  test('دیتابیس اجازه نمی‌دهد دو رزروِ فعالِ هم‌پوشان روی یک میز باشند', async () => {
    // ⚠️ این تست عمداً بازنویسی شد و داستانش ارزشِ ثبت دارد.
    //
    // نسخه‌ی اولش می‌خواست گاردِ ایمنیِ آزادسازی را بسنجد: «اگر رزروِ فعالِ
    // دیگری روی میز هست، لغوِ این یکی نباید میز را آزاد کند». برایِ ساختنِ آن
    // وضعیت، دو رزروِ فعالِ هم‌پوشان روی یک میز لازم بود — و
    // `db.reservation.create` با خطایِ دیتابیس رد شد.
    //
    // یعنی سناریو **از اساس دست‌نیافتنی** است: کانسترینتِ
    // `EXCLUDE USING gist` (prisma/sql/026) اجازه‌اش را نمی‌دهد. پس به‌جایِ
    // ادعایِ چیزی که هرگز رخ نمی‌دهد، همان چیزی سنجیده می‌شود که واقعاً
    // تضمین شده — و این دقیقاً ادعایِ ADR-P2-002 است: **مرجعِ جلوگیری از
    // تداخل، دیتابیس است، نه کدِ اپلیکیشن.**
    //
    // گاردِ `stillBusy` در lifecycle.ts عمداً باقی می‌ماند: defense-in-depth
    // بی‌هزینه، برایِ حالتی که داده‌ی قدیمی/مهاجرت‌شده این ثابت را نقض کند.
    const { table } = await seedOccupied('seated');
    const now = new Date();
    seq += 1;
    await assert.rejects(
      () => db.reservation.create({
        data: {
          restaurantId, tableId: table.id,
          code: `RZTRLX${String(seq).padStart(2, '0')}`,
          guestName: '[DEMO] مهمانِ دوم', guestPhone: '+989120000003',
          partySize: 2,
          slotStart: new Date(+now - 10 * 60_000),
          slotEnd: new Date(+now + 90 * 60_000),
          status: 'dining' as never,
        },
      }),
      'درجِ رزروِ دومِ هم‌پوشان روی همان میز باید توسطِ کانسترینتِ EXCLUDE رد شود',
    );

    // و میز هنوز دست‌نخورده است (تلاشِ ناموفق نباید چیزی را عوض کند).
    assert.equal(await tableState(table.id), 'occupied');
  });

  test('میزِ maintenance با پایانِ رزرو به free تبدیل نمی‌شود', async () => {
    // آزادسازی فقط از occupied/reserved است — تعمیرات یک تصمیمِ عملیاتیِ
    // انسانی است و نباید با پایانِ یک رزرو بی‌صدا لغو شود.
    seq += 1;
    const table = await db.table.create({
      data: { restaurantId, number: 800 + seq, capacity: 4, state: 'maintenance' },
    });
    const now = new Date();
    const resv = await db.reservation.create({
      data: {
        restaurantId, tableId: table.id,
        code: `RZTRLM${String(seq).padStart(2, '0')}`,
        guestName: '[DEMO] مهمان', guestPhone: '+989120000004',
        partySize: 2,
        slotStart: new Date(+now - 30 * 60_000),
        slotEnd: new Date(+now + 60 * 60_000),
        status: 'seated' as never,
      },
    });
    await transitionReservation({ reservationId: resv.id, to: 'completed', actor: 'system', notify: false });
    assert.equal(await tableState(table.id), 'maintenance', 'تعمیرات نباید بی‌صدا لغو شود');
  });
});
