import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  تستِ integration زنده روی Postgresِ واقعی (نه mock) — برخلافِ بقیه‌ی
//  فایل‌هایِ tests/*.test.mts که عمداً منطقِ خالص/بدونِ DB را تست می‌کنند.
//
//  چرا اینجا integration واقعی لازم است، نه unit ساده: محافظتِ میزِ ثانویه‌یِ
//  merge (table-occupancy.ts) یک کوئریِ خامِ SQL است که با tsrange overlap
//  و UNION روی دو منبعِ متفاوت (table_id اصلی + merged_table_numbers) کار
//  می‌کند — mockکردنِ نیمه‌ی Prisma برایِ شبیه‌سازیِ این رفتار همون چیزی است
//  که مأموریتِ فعلی صریحاً «mock کردنِ نیمه‌کاره برایِ وانمود به کارکردنِ
//  EXCLUDE» می‌نامد و ممنوع کرده — پس مستقیماً روی DB واقعی تست می‌کنیم.
//
//  CI: طبقِ .github/workflows/ci.yml این فایل همیشه با یک سرویسِ
//  Postgres/Redisِ واقعی اجرا می‌شود (نه skip/gate) — پس این تست همیشه
//  بخشی از `npm test` واقعاً اجرا می‌شود، نه فقط «قابلِ اجرا».
//
//  فیکسچرها با پیشوندِ [DEMO] ساخته و در after() به‌ترتیبِ FK پاک می‌شوند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');

let tenantId: string;
let restaurantId: string;
let userId: string;
// ۳۰ روزِ آینده — به‌اندازه‌ی کافی دور از «گذشته» ولی داخلِ سقفِ MAX_DAYS_AHEAD=۹۰
// (تاریخِ ثابت اینجا جواب نمی‌داد؛ محاسبه‌ی نسبی به «الان» تا این تست هیچ‌وقت
// با گذرِ زمان منقضی نشود).
const SLOT_DATE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const SLOT_TIME = '20:00';

before(async () => {
  const tenant = await db.tenant.create({ data: { name: '[DEMO] table-merge-occupancy tenant' } });
  tenantId = tenant.id;

  const restaurant = await db.restaurant.create({
    data: {
      tenantId,
      slug: `demo-merge-occ-${Date.now()}`,
      name: '[DEMO] رستورانِ تستِ merge occupancy',
      clubPrefix: 'DMO',
      isOpen: true,
      onlineGating: false, // مسیرِ manual استفاده می‌کنیم، ولی احتیاطِ اضافه ضرری ندارد
      openingHours: undefined, // null یعنی همیشه باز طبقِ isOpen
    },
  });
  restaurantId = restaurant.id;

  const user = await db.user.create({ data: { phone: `+9891${String(Date.now()).slice(-8)}`, firstName: '[DEMO]', lastName: 'کاربر' } });
  userId = user.id;

  // دو میزِ قابلِ‌ترکیبِ متقابل (ظرفیتِ هرکدام کمتر از partySize=6، جمعشان کافی)
  await db.table.create({
    data: { restaurantId, number: 901, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [902] },
  });
  await db.table.create({
    data: { restaurantId, number: 902, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [901] },
  });
  // میزِ دکوی: ظرفیتش از ۶ کمتره (نباید مسیرِ تک‌میزیِ خودکار رو راضی کنه)
  // و isMergeable نیست — تا merge واقعاً trigger بشه، نه مسیرِ ساده.
  await db.table.create({
    data: { restaurantId, number: 903, capacity: 2, isActive: true, isMergeable: false },
  });
});

after(async () => {
  // ترتیبِ FK-safe (همون ترتیبِ مستندشده‌ی cleanup در PR#13)
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('table-occupancy — محافظتِ میزِ ثانویه‌یِ merge روی Postgresِ واقعی (P0-3)', () => {
  test('گروهِ ۶نفره با هیچ میزِ تکی جا نمی‌شه → merge روی هردو میزِ ۹۰۱+۹۰۲ trigger می‌شه', async () => {
    const resv = await createReservation({
      restaurantId, date: SLOT_DATE, time: SLOT_TIME, partySize: 6,
      guest: { name: '[DEMO] گروهِ ۶نفره' }, source: 'manual', notifySms: false,
    });
    assert.deepEqual([...resv.merged_tables].sort((a, b) => a - b), [901, 902]);
    assert.equal(resv.status, 'confirmed');
  });

  test('رزروِ مستقیمِ میزِ ثانویه‌یِ همون ترکیبِ فعال (۹۰۲) رد می‌شود — نه ۵۰۰، دقیقاً TABLE_CONFLICT', async () => {
    // میزِ ۹۰۲ در ردیفِ reservations خودش هیچ رزروی ندارد (فقط در
    // merged_table_numbersِ رزروِ بالا ثبت شده) — بدونِ getOccupiedTableNumbers
    // این چک، این درخواست «آزاد» دیده می‌شد و یک double-booking واقعیِ فیزیکی
    // رخ می‌داد (دو مهمانِ متفاوت سرِ یک میز).
    await assert.rejects(
      createReservation({
        restaurantId, date: SLOT_DATE, time: SLOT_TIME, partySize: 2,
        guest: { name: '[DEMO] رزروِ متجاوز', tableNumber: 902 }, source: 'manual', notifySms: false,
      }),
      (err: any) => {
        assert.equal(err.code, 'TABLE_CONFLICT');
        return true;
      },
    );
  });

  test('همون میزِ ثانویه (۹۰۲) در بازه‌ی زمانیِ کاملاً غیرِهم‌پوشان آزاد و قابلِ‌رزرو است', async () => {
    // کنترل: چک می‌کنیم که چک بالا واقعاً به بازه‌ی زمانی حساس است (یعنی میز
    // را برایِ همیشه قفل نکرده)، نه یک false-positiveِ همیشگی روی شماره‌ی میز.
    const resv = await createReservation({
      restaurantId, date: SLOT_DATE, time: '13:00', partySize: 2, // ظهرِ همون روز، فاصله‌یِ زیاد از ۲۰:۰۰
      guest: { name: '[DEMO] بازه‌ی جدا', tableNumber: 902 }, source: 'manual', notifySms: false,
    });
    assert.equal(resv.table_number, 902);
    assert.equal(resv.merged_tables.length, 0);
  });
});
