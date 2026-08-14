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

// ═══════════════════════════════════════════════════════════════════════
//  C2 (حسابرسیِ Time-Range/EXCLUDE/Redis-evidence، ۲۰۲۶-۰۸-۱۴): همون اثباتِ
//  همزمانیِ بالا (C1) را این‌بار با قفلِ Redisِ کاملاً غیرفعال تکرار می‌کنیم —
//  دقیقاً همون چیزی که withSlotLock موقعِ قطعیِ واقعیِ Redis انجام می‌ده
//  (رجوع کن به redis.ts: catch روی خطایِ connection → مستقیم fn() بدونِ قفل).
//  به‌جایِ خاموش‌کردنِ Redisِ واقعی (که در sandbox/CI پایدار نیست و روی
//  تست‌هایِ دیگرِ همین رانرِ مشترک که هم‌زمان از همون Redisِ singleton
//  استفاده می‌کنن اثر می‌ذاره)، از DI همون الگویِ NoShowPredictor استفاده
//  می‌کنیم: createReservation یک acquireSlotLock جایگزین می‌گیره که دقیقاً
//  رفتارِ fail-openِ واقعی رو تقلید می‌کنه (بدونِ قفل، مستقیم fn()).
//
//  هدف: ثابت کردنِ اینکه معماریِ لایه‌ای درسته — DB (EXCLUDE + Serializable +
//  بازچکِ اپلیکیشنی) به‌تنهایی، بدونِ هیچ کمکی از Redis، هنوز دقیقاً یک
//  برنده تضمین می‌کنه، و بازنده یک خطایِ ساختاریافته‌ی ۴۰۹-خانواده می‌گیره
//  نه یک throwِ خامِ ۵۰۰.
// ═══════════════════════════════════════════════════════════════════════
const noSlotLock = async <T>(_key: string, _ttlMs: number, fn: () => Promise<T>): Promise<T> => fn();

describe('C2 — قفلِ Redis کاملاً fail-open (شبیه‌سازیِ قطعیِ Redis) — DB به‌تنهایی هنوز محافظت می‌کند', () => {
  test('دو رزروِ موازیِ مستقیم برایِ همون میزِ ۹۰۳ (بدونِ merge، پوششِ مستقیمِ EXCLUDE)، بدونِ قفلِ Redis: دقیقاً یکی موفق می‌شه', async () => {
    const attempt = (guestName: string) => createReservation(
      {
        restaurantId, date: SLOT_DATE, time: '18:00', partySize: 2,
        guest: { name: guestName, tableNumber: 903 }, source: 'manual', notifySms: false,
      },
      { acquireSlotLock: noSlotLock },
    );
    const [r1, r2] = await Promise.allSettled([attempt('[DEMO] E'), attempt('[DEMO] F')]);
    const results = [r1, r2];
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'دقیقاً یکی باید موفق بشه — حتی بدونِ قفلِ Redis');
    assert.equal(rejected.length, 1);

    // بازنده باید یک ApiErrorِ ساختاریافته باشه (کد داره)، نه یک throwِ خامِ
    // بدونِ کد که errorResponse به ۵۰۰ی عمومی ترجمه می‌کنه.
    const loser = rejected[0] as PromiseRejectedResult;
    assert.ok(loser.reason?.code, `بازنده باید کدِ ساختاریافته داشته باشه، نه خطایِ خام: ${loser.reason}`);
    assert.ok(['TABLE_CONFLICT', 'SLOT_FULL'].includes(loser.reason.code),
      `کدِ غیرمنتظره: ${loser.reason.code}`);

    const active = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid AND status IN ('pending','confirmed')
        AND slot_start = (${SLOT_DATE}::date + '18:00'::time) AT TIME ZONE 'Asia/Tehran'
    `;
    assert.equal(Number(active[0].count), 1, 'باید دقیقاً یک رزروِ فعال در بازه‌ی ۱۸:۰۰ بمونه — بدونِ double-booking حتی بدونِ قفلِ Redis');
  });

  test('merge هم بدونِ قفلِ Redis همون تضمین رو داره: دقیقاً یکی از دو merge موازی برنده می‌شه', async () => {
    // میزهایِ ۹۰۱/۹۰۲ رو دوباره استفاده می‌کنیم ولی رویِ یک بازه‌ی زمانیِ تازه.
    // ⚠️ درسِ خودِ این تست (یافته‌ی واقعی حینِ توسعه، نه فرض): ۱۹:۳۰ ابتدا
    // انتخاب شده بود ولی با بلاکِ describeِ اولِ همین فایل (رزروِ ۲۰:۰۰ روی
    // ۹۰۱+۹۰۲، با بافرِ پیش‌فرضِ ۹۰+۱۵=۱۰۵ دقیقه یعنی اشغال تا ۲۱:۴۵) هم‌پوشانی
    // داشت — یعنی هر دو تلاشِ موازی به‌درستی SLOT_FULL می‌گرفتن چون ۹۰۱/۹۰۲ از
    // قبل واقعاً اشغال بودن، نه یک باگِ اپ. ۱۶:۰۰ با فاصله‌ی امن قبل از هر بلاکِ
    // دیگرِ همین فایل (۱۸:۰۰ روی ۹۰۳، ۲۰:۰۰ و ۲۲:۰۰ روی ۹۰۱/۹۰۲) انتخاب شده.
    const attempt = (guestName: string) => createReservation(
      {
        restaurantId, date: SLOT_DATE, time: '16:00', partySize: 6,
        guest: { name: guestName }, source: 'manual', notifySms: false,
      },
      { acquireSlotLock: noSlotLock },
    );
    const [r1, r2] = await Promise.allSettled([attempt('[DEMO] G'), attempt('[DEMO] H')]);
    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0] as PromiseRejectedResult).reason?.code, 'SLOT_FULL');

    const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof attempt>>>).value;
    assert.deepEqual([...winner.merged_tables].sort((a, b) => a - b), [901, 902]);
  });
});
