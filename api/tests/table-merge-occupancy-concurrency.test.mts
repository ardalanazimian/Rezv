import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  شاهدِ زنده‌یِ همزمانی برایِ P0-3 / A1 (سختگیریِ acquisition-grade، ۲۰۲۶-۰۸-۱۴)
//
//  چرا این فایل جداست از table-merge-occupancy.test.mts: آن فایل سناریوهای
//  *پی‌درپی* را تست می‌کند (یک درخواست، بعد درخواستِ دوم بعد از commitِ
//  اولی) — که همیشه هم درست بوده، ولی هرگز اثبات نمی‌کرد که دو درخواستِ
//  *واقعاً هم‌زمان* (نه پی‌درپی) هم امن‌اند. اینجا با `Promise.all` دو
//  فراخوانیِ createReservation را واقعاً هم‌زمان (نه sequential، نه mocked)
//  روی همون Postgresِ واقعی اجرا می‌کنیم — دقیقاً مسئله‌ای که مأموریتِ A1
//  به‌صراحت خواسته: «true simultaneous dual-request race was not proven live».
//
//  نتیجه‌یِ این probe (تکرارشده ۴ بار حینِ توسعه، هر ۴ بار درست): موتورِ
//  فعلی (Serializableِ Postgres + بازچکِ getOccupiedTableNumbers داخلِ خودِ
//  تراکنش، رجوع کن به reservations.ts placeReservation) از قبل این race را
//  درست مدیریت می‌کند — هیچ کدِ جدیدی برای A1 لازم نبود، فقط شاهدِ زنده.
//  دقیقاً یکی موفق می‌شه، دیگری با یک خطایِ ساختاریافته (نه ۵۰۰، نه
//  double-booking) رد می‌شه.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');

let tenantId: string;
let restaurantId: string;
const SLOT_DATE = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);

before(async () => {
  const tenant = await db.tenant.create({ data: { name: '[DEMO] concurrency tenant' } });
  tenantId = tenant.id;
  const restaurant = await db.restaurant.create({
    data: {
      tenantId, slug: `demo-concurrency-${Date.now()}`, name: '[DEMO] رستورانِ تستِ همزمانی',
      clubPrefix: 'CNC', isOpen: true, onlineGating: false,
    },
  });
  restaurantId = restaurant.id;
  await db.table.create({ data: { restaurantId, number: 901, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [902] } });
  await db.table.create({ data: { restaurantId, number: 902, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [901] } });
  await db.table.create({ data: { restaurantId, number: 903, capacity: 2, isActive: true, isMergeable: false } });
});

after(async () => {
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('همزمانیِ واقعی — دو درخواستِ موازیِ merge برایِ همون میزهایِ ۹۰۱+۹۰۲', () => {
  test('دقیقاً یکی موفق می‌شه، دیگری با خطایِ ساختاریافته رد می‌شه (نه double-booking، نه ۵۰۰)', async () => {
    const attempt = (guestName: string) => createReservation({
      restaurantId, date: SLOT_DATE, time: '20:00', partySize: 6,
      guest: { name: guestName }, source: 'manual', notifySms: false,
    });
    const [r1, r2] = await Promise.allSettled([attempt('[DEMO] A'), attempt('[DEMO] B')]);

    const results = [r1, r2];
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'دقیقاً یکی باید موفق بشه');
    assert.equal(rejected.length, 1, 'دقیقاً یکی باید رد بشه');

    // خطایِ برنده‌نشده باید ساختاریافته باشه (SLOT_FULL) نه یک throw خامِ ۵۰۰.
    const loser = rejected[0] as PromiseRejectedResult;
    assert.equal(loser.reason?.code, 'SLOT_FULL');

    // برنده باید واقعاً روی هردو میزِ ۹۰۱+۹۰۲ merge شده باشه.
    const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof attempt>>>).value;
    assert.deepEqual([...winner.merged_tables].sort((a, b) => a - b), [901, 902]);

    // شاهدِ نهایی مستقیم از DB: فقط یک رزروِ فعال در همین بازه‌ی ۲۰:۰۰، نه دوتا
    // (double-booking واقعاً رخ نداده) — محدود به بازه‌یِ خودِ این تست، نه کلِ
    // رستوران (describeِ دومِ همین فایل رویِ ۲۲:۰۰ کار می‌کنه، جداست).
    const activeCount = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid AND status IN ('pending','confirmed')
        AND slot_start = (${SLOT_DATE}::date + '20:00'::time) AT TIME ZONE 'Asia/Tehran'
    `;
    assert.equal(Number(activeCount[0].count), 1);
  });
});

describe('همزمانیِ واقعی — رزروِ مستقیمِ میزِ ثانویه هم‌زمان با merge (سناریویِ اصلیِ P0-3)', () => {
  test('یکی مستقیم میزِ ۹۰۲ رو تنها می‌خواد، دیگری هم‌زمان merge با ۹۰۲ به‌عنوانِ ثانویه — بدونِ تداخلِ فیزیکی', async () => {
    // این دقیقاً سناریوییه که EXCLUDE constraint (فقط رویِ table_idِ اصلی)
    // به‌تنهایی محافظت نمی‌کنه: یک تلاش table_id=902 (مستقیم) می‌نویسه، اونِ
    // دیگه table_id=901 (merge) می‌نویسه و فقط merged_table_numbers=[901,902]
    // داره — یعنی هیچ تداخلِ EXCLUDE-سطحی بینِ این دو نیست؛ محافظت فقط از
    // بازچکِ اپلیکیشنیِ getOccupiedTableNumbers داخلِ تراکنش میاد.
    const directAttempt = createReservation({
      restaurantId, date: SLOT_DATE, time: '22:00', partySize: 4,
      guest: { name: '[DEMO] C', tableNumber: 902 }, source: 'manual', notifySms: false,
    });
    const mergeAttempt = createReservation({
      restaurantId, date: SLOT_DATE, time: '22:00', partySize: 6,
      guest: { name: '[DEMO] D' }, source: 'manual', notifySms: false,
    });
    const [r1, r2] = await Promise.allSettled([directAttempt, mergeAttempt]);
    const results = [r1, r2];
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'دقیقاً یکی باید موفق بشه — یا رزروِ مستقیم یا merge، نه هردو');
    assert.equal(rejected.length, 1);

    const loser = rejected[0] as PromiseRejectedResult;
    // بسته به اینکه کدوم اول commit بشه، بازنده یا TABLE_CONFLICT (مسیرِ
    // دستی) یا SLOT_FULL (مسیرِ merge) می‌گیره — هردو کدِ ساختاریافته‌ی ۴۰۹
    // خانواده‌اند، نه ۵۰۰ی مبهم.
    assert.ok(['TABLE_CONFLICT', 'SLOT_FULL'].includes(loser.reason?.code),
      `کدِ غیرمنتظره: ${loser.reason?.code}`);

    // شاهدِ نهاییِ مستقیم از DB: هیچ رزروِ فعالی نباید میزِ ۹۰۲ رو دوبار
    // (هم به‌عنوانِ اصلی هم ثانویه) اشغال کرده باشه — محدود به بازه‌یِ ۲۲:۰۰
    // همین تست (نه کلِ رستوران؛ describeِ اولِ همین فایل هم رویِ ۲۰:۰۰ یک
    // رزروِ فعالِ دیگه گذاشته که نباید اینجا شمرده بشه).
    const active = await db.$queryRaw<{ table_id: string; merged_table_numbers: number[] }[]>`
      SELECT table_id, merged_table_numbers FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid AND status IN ('pending','confirmed')
        AND slot_start = (${SLOT_DATE}::date + '22:00'::time) AT TIME ZONE 'Asia/Tehran'
    `;
    assert.equal(active.length, 1, 'باید دقیقاً یک رزروِ فعال در بازه‌ی ۲۲:۰۰ بمونه');
  });
});
