import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { computeAndCacheAvailability } from '../src/lib/availability.ts';
import { generateTimesFromHours, zonedTimeToUtc } from '../src/lib/hours.ts';

// ═══════════════════════════════════════════════════════════════════════
//  موتورِ availability — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/availability.ts` تا امروز **هیچ پوششی
//  نداشت** — نه مستقیم، نه غیرمستقیم (هیچ تستی نه خودش را import می‌کرد نه
//  getAvailability را صدا می‌زد). و این تنها چیزی است که تصمیم می‌گیرد مشتری
//  چه سانسی می‌تواند رزرو کند: اگر غلط باشد، بقیه‌ی سیستم بی‌معنا است.
//
//  همان ممیزی یک باگِ واقعیِ کاربر-رو پیدا کرد (شرحش در تستِ «شیفتِ شبانه»).
// ═══════════════════════════════════════════════════════════════════════

const TAG = `av-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';
/** تاریخِ ثابتِ آینده — تستِ availability نباید به «امروز» وابسته باشد. */
const DATE = '2027-03-10';
const NEXT = '2027-03-11';

let tenantId: string;
let codeSeq = 0;

interface Rest { id: string; tables: { id: string; number: number }[] }

async function makeRestaurant(suffix: string, opts: {
  tables?: { number: number; capacity: number; minPartySize?: number; isActive?: boolean; state?: string }[];
  openingHours?: unknown;
  slotMinutes?: number; cleaningMinutes?: number; bufferMinutes?: number;
} = {}): Promise<Rest> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ تستِ سانس ${suffix}`,
      clubPrefix: 'AV', timezone: TZ,
      slotMinutes: opts.slotMinutes ?? 90,
      cleaningMinutes: opts.cleaningMinutes ?? 15,
      bufferMinutes: opts.bufferMinutes ?? 0,
      ...(opts.openingHours !== undefined ? { openingHours: opts.openingHours as never } : {}),
      tables: { create: (opts.tables ?? [{ number: 1, capacity: 4 }]) as never },
    },
    select: { id: true, tables: { select: { id: true, number: true } } },
  });
  return r as Rest;
}

async function book(params: {
  restaurantId: string; tableId: string; date: string; time: string;
  minutes?: number; blockBuffer?: number; status?: string; mergedNumbers?: number[];
}) {
  const start = zonedTimeToUtc(params.date, params.time, TZ);
  const end = new Date(+start + (params.minutes ?? 90) * 60_000);
  return db.reservation.create({
    data: {
      code: `${TAG.toUpperCase().replace(/-/g, '')}${++codeSeq}`,
      restaurantId: params.restaurantId, tableId: params.tableId, partySize: 2,
      slotStart: start, slotEnd: end,
      status: (params.status ?? 'confirmed') as never,
      blockBufferMinutes: params.blockBuffer ?? 15,
      ...(params.mergedNumbers ? { mergedTableNumbers: params.mergedNumbers } : {}),
    },
    select: { id: true },
  });
}

/** کلیدِ یکتا در هر فراخوانی تا کشِ Redis نتیجه‌ی تست را مخفی نکند. */
async function avail(restaurantId: string, date: string, party: number) {
  return computeAndCacheAvailability(
    restaurantId, date, party, `test-avail:${randomUUID()}`, 5,
  ) as Promise<{ date: string; party: number; slots: { time: string; free_tables: number[]; status: string }[] }>;
}

const slotAt = (res: Awaited<ReturnType<typeof avail>>, time: string) =>
  res.slots.find(s => s.time === time);

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ سانس ${TAG}` }, select: { id: true } });
  tenantId = t.id;
});

after(async () => {
  const rs = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  const ids = rs.map(r => r.id);
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('availability — شیفتِ شبانه (باگِ رفع‌شده‌ی ۲۰۲۶-۰۸-۲۰)', () => {
  test('سانسِ پس از نیمه‌شب به همان روز نسبت داده نمی‌شود', () => {
    // ⚠️ خودِ باگ، در ساده‌ترین شکلش: رستورانی که ۲۰:۰۰ تا ۰۱:۰۰ باز است.
    // generateTimesFromHours حلقه را تا t=1470 (۲۴:۳۰) می‌برد، و fromMin با
    // `% 24` آن را به «۰۰:۳۰» تا می‌کرد. چون کلِ API date-keyed است،
    // مصرف‌کننده `zonedTimeToUtc(همان‌روز, '00:30')` می‌زد و به نیمه‌شبِ
    // *ابتدای* آن روز می‌رسید — حدودِ ۲۰ ساعت پیش از بازشدنِ رستوران.
    // و چون مرتب‌سازی رشته‌ای است، «۰۰:۰۰» *اولین* گزینه‌ی مشتری بود.
    const wd = String(new Date(`${DATE}T12:00:00Z`).getUTCDay());
    const times = generateTimesFromHours({ [wd]: [['20:00', '01:00']] } as never, DATE, TZ, new Set());
    assert.ok(times, 'شیفتِ تعریف‌شده باید سانس تولید کند');

    assert.ok(!times.includes('00:00'), '«۰۰:۰۰» نباید پیشنهاد شود — به روزِ بعد تعلق دارد');
    assert.ok(!times.includes('00:30'), '«۰۰:۳۰» نباید پیشنهاد شود — به روزِ بعد تعلق دارد');

    // کنترلِ مثبت: خودِ شیفت باید کامل تولید شود، وگرنه تستِ بالا با
    // «هیچ سانسی تولید نشد» هم سبز می‌شد.
    assert.deepEqual(times, ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'],
      'سانس‌های داخلِ همان روزِ تقویمی باید دست‌نخورده بمانند');
  });

  test('هیچ سانسی به زمانی پیش از بازشدنِ رستوران ترجمه نمی‌شود', async () => {
    // ادعای واقعیِ کاربر-رو: هر سانسی که پیشنهاد می‌شود باید *داخلِ* شیفت باشد.
    const wd = String(new Date(`${DATE}T12:00:00Z`).getUTCDay());
    const r = await makeRestaurant('night', {
      openingHours: { [wd]: [['20:00', '01:00']] },
      slotMinutes: 60,
    });
    const res = await avail(r.id, DATE, 2);
    assert.ok(res.slots.length > 0, 'پیش‌شرط: باید سانس داشته باشد');

    const opensAt = zonedTimeToUtc(DATE, '20:00', TZ);
    for (const s of res.slots) {
      const at = zonedTimeToUtc(DATE, s.time, TZ);
      assert.ok(+at >= +opensAt,
        `سانسِ ${s.time} به ${at.toISOString()} ترجمه می‌شود که پیش از بازشدنِ رستوران (${opensAt.toISOString()}) است`);
    }
  });
});

describe('availability — اشغالِ میز', () => {
  test('میزِ رزروشده در سانسِ هم‌پوشان آزاد نشان داده نمی‌شود', async () => {
    const r = await makeRestaurant('busy', { tables: [{ number: 1, capacity: 4 }, { number: 2, capacity: 4 }] });
    await book({ restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '19:00' });

    const res = await avail(r.id, DATE, 2);
    const s = slotAt(res, '19:00');
    assert.ok(s, 'سانسِ ۱۹:۰۰ باید وجود داشته باشد');
    assert.ok(!s.free_tables.includes(1), 'میزِ ۱ رزرو شده — نباید آزاد باشد');
    assert.ok(s.free_tables.includes(2), 'کنترلِ مثبت: میزِ ۲ آزاد است');
  });

  test('فاصله‌ی نظافت/بافر رعایت می‌شود — سانسِ بلافاصله بعد بلاک است', async () => {
    // رزروِ ۱۸:۰۰ با مدتِ ۹۰ دقیقه تا ۱۹:۳۰، به‌علاوه ۱۵ دقیقه نظافت → تا ۱۹:۴۵.
    // پس سانسِ ۱۹:۳۰ نباید آزاد باشد حتی با اینکه رزروِ قبلی «تمام شده».
    const r = await makeRestaurant('buffer', { cleaningMinutes: 15, bufferMinutes: 0 });
    await book({ restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '18:00', minutes: 90, blockBuffer: 15 });

    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:30')?.free_tables, [],
      'سانسِ ۱۹:۳۰ داخلِ پنجره‌ی نظافتِ رزروِ قبلی است');
    assert.deepEqual(slotAt(res, '21:00')?.free_tables, [1],
      'کنترلِ مثبت: سانسِ دور از رزرو باید آزاد باشد');
  });

  test('سانسی که دقیقاً وقتِ شروعِ رزروِ بعدی تمام می‌شود بلاک است (بافرِ سمتِ کاندید)', async () => {
    // ⚠️ این تست از یک ضعفِ کشف‌شده در جهش‌آزمایی زاده شد: تستِ بالا با
    // `blockBuffer = 0` هم سبز می‌ماند، چون بلاکش از `blockBufferMinutes`ِ
    // خودِ رزروِ موجود می‌آید نه از بافرِ سمتِ *کاندید*. یعنی نیمی از منطق
    // اصلاً پوشش نداشت.
    //
    // سناریوی درست: رزروِ موجود ساعتِ ۲۱:۰۰ شروع می‌شود. سانسِ کاندیدِ ۱۹:۳۰
    // با مدتِ ۹۰ دقیقه دقیقاً ۲۱:۰۰ تمام می‌شود — بدونِ نظافت «جا می‌شود»،
    // ولی در واقعیت هیچ فاصله‌ای برای آماده‌سازیِ میز نمی‌ماند.
    const r = await makeRestaurant('cand-buffer', { slotMinutes: 90, cleaningMinutes: 15, bufferMinutes: 0 });
    await book({ restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '21:00', minutes: 90, blockBuffer: 15 });

    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:30')?.free_tables, [],
      'سانسِ ۱۹:۳۰ تا ۲۱:۰۰ طول می‌کشد و نظافتش تا ۲۱:۱۵ — با رزروِ ۲۱:۰۰ تداخل دارد');

    // کنترلِ مثبت: نیم‌ساعت زودتر، نظافت تا ۲۰:۴۵ تمام می‌شود → آزاد.
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [1],
      'سانسِ ۱۹:۰۰ نظافتش تا ۲۰:۴۵ تمام می‌شود و جا می‌شود');
  });

  test('میزِ ثانویه‌ی یک رزروِ ترکیبی آزاد نشان داده نمی‌شود', async () => {
    // ⚠️ قفلِ یک باگِ رفع‌شده‌ی تاریخی (توضیحش در خودِ availability.ts): قبلاً
    // فقط `b.tableId === t.id` چک می‌شد، پس میزهایِ ثانویه‌ی یک ترکیبِ فعال
    // «آزاد» نشان داده می‌شدند.
    const r = await makeRestaurant('merged', { tables: [{ number: 1, capacity: 4 }, { number: 2, capacity: 4 }] });
    await book({
      restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '19:00',
      mergedNumbers: [1, 2],
    });

    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [],
      'هر دو میزِ ترکیب باید اشغال باشند، نه فقط میزِ اصلی');
  });

  test('رزروِ کنسل‌شده میز را آزاد می‌کند', async () => {
    const r = await makeRestaurant('cancelled');
    await book({ restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '19:00', status: 'cancelled' });

    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [1],
      'وضعیتِ غیرفعال نباید میز را اشغال نگه دارد');
  });

  test('رزروِ رستورانِ دیگر روی این رستوران اثر ندارد', async () => {
    const a = await makeRestaurant('iso-a');
    const b = await makeRestaurant('iso-b');
    await book({ restaurantId: b.id, tableId: b.tables[0].id, date: DATE, time: '19:00' });

    const res = await avail(a.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [1],
      'ایزولاسیونِ تنانت: رزروِ رستورانِ B نباید میزِ رستورانِ A را اشغال کند');
  });
});

describe('availability — فیلترِ میز و ساعت', () => {
  test('میزِ کوچک‌تر از تعدادِ نفرات پیشنهاد نمی‌شود', async () => {
    const r = await makeRestaurant('cap', { tables: [{ number: 1, capacity: 2 }, { number: 2, capacity: 8 }] });
    const res = await avail(r.id, DATE, 6);
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [2],
      'فقط میزی که ظرفیتش کافی است');
  });

  test('میزِ غیرفعال و در حالِ تعمیر پیشنهاد نمی‌شود', async () => {
    const r = await makeRestaurant('state', {
      tables: [
        { number: 1, capacity: 4, isActive: false },
        { number: 2, capacity: 4, state: 'maintenance' },
        { number: 3, capacity: 4 },
      ],
    });
    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(slotAt(res, '19:00')?.free_tables, [3],
      'فقط میزِ فعالِ سالم');
  });

  test('تعطیلیِ ثبت‌شده همه‌ی سانس‌های آن روز را حذف می‌کند', async () => {
    const wd = String(new Date(`${DATE}T12:00:00Z`).getUTCDay());
    const r = await makeRestaurant('closed', { openingHours: { [wd]: [['18:00', '23:00']] } });
    await db.$executeRaw`
      INSERT INTO restaurant_closures (restaurant_id, closure_date, reason)
      VALUES (${r.id}::uuid, ${DATE}::date, '[DEMO] تعطیلیِ تست')`;

    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(res.slots, [], 'روزِ تعطیل هیچ سانسی ندارد');

    // کنترلِ مثبت: روزِ بعد که تعطیل نیست باید سانس داشته باشد.
    const wdNext = String(new Date(`${NEXT}T12:00:00Z`).getUTCDay());
    await db.restaurant.update({
      where: { id: r.id },
      data: { openingHours: { [wd]: [['18:00', '23:00']], [wdNext]: [['18:00', '23:00']] } as never },
    });
    const res2 = await avail(r.id, NEXT, 2);
    assert.ok(res2.slots.length > 0, 'کنترلِ مثبت: روزِ غیرتعطیل باید سانس داشته باشد');
  });

  test('سانس‌ها از خودِ شیفتِ واقعی ساخته می‌شوند، نه لیستِ ثابت', async () => {
    // شیفتِ ۱۷:۱۵–۱۹:۱۵ هیچ هم‌پوشانی با SERVICE_TIMESِ ثابت ندارد جز ۱۸:۰۰/۱۸:۳۰.
    const wd = String(new Date(`${DATE}T12:00:00Z`).getUTCDay());
    const r = await makeRestaurant('shift', { openingHours: { [wd]: [['17:15', '19:15']] } });
    const res = await avail(r.id, DATE, 2);
    assert.deepEqual(res.slots.map(s => s.time), ['17:15', '17:45', '18:15', '18:45'],
      'سانس‌ها باید با گامِ ۳۰ دقیقه از شروعِ شیفتِ واقعی باشند');
  });
});
