import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  availabilityِ گروهی — «چیپِ ساعت» رویِ کارت‌هایِ فیدِ کشف
//
//  ⚠️ شکافی که این فایل از آن زاده شد (موردِ ۱ از کارهای باقی‌مانده‌ی ممیزیِ
//  ۲۰۲۶-۰۸-۲۴): اپِ مشتری از روزِ اول `apiR.available_slots` را می‌خواند
//  (`apps/customer/js/api.js:mapApiRestaurant`) ولی **هیچ روتی این فیلد را
//  برنمی‌گرداند** — پس کارتِ هر رستورانِ واقعی همیشه بدونِ ساعت می‌ماند.
//
//  خطرِ اصلیِ این قابلیت واگرایی است: اگر مسیرِ گروهی حسابِ خودش را بکند،
//  کارت می‌تواند «۲۰:۰۰ آزاد» بگوید و شیتِ رزرو همان لحظه «پر». برایِ همین
//  مهم‌ترین تستِ این فایل، تطبیقِ بیت‌به‌بیتِ گروهی با موتورِ تکی است.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const {
  computeBulkSlots, bulkEntriesFromRaw, computeAndCacheAvailability, tableFitsParty,
} = await import('../src/lib/availability');
const { zonedTimeToUtc } = await import('../src/lib/hours');
const bulkRoute = await import('../src/app/api/v1/restaurants/availability/route');

const TAG = `avb-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';
/** تاریخِ ثابتِ آینده — نتیجه نباید به «امروز» وابسته باشد. */
const DATE = '2027-04-14';

let tenantId: string;
let codeSeq = 0;

interface Rest { id: string; tables: { id: string; number: number }[] }

async function makeRestaurant(suffix: string, opts: {
  tables?: { number: number; capacity: number; minPartySize?: number; maxPartySize?: number; isActive?: boolean; state?: string }[];
  openingHours?: unknown;
  slotMinutes?: number; cleaningMinutes?: number; bufferMinutes?: number;
  timezone?: string;
} = {}): Promise<Rest> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ تستِ سانسِ گروهی ${suffix}`,
      clubPrefix: 'AB', timezone: opts.timezone ?? TZ,
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
  restaurantId: string; tableId: string; date: string; time: string; minutes?: number;
}) {
  const start = zonedTimeToUtc(params.date, params.time, TZ);
  const end = new Date(+start + (params.minutes ?? 90) * 60_000);
  return db.reservation.create({
    data: {
      code: `${TAG.toUpperCase().replace(/-/g, '')}${++codeSeq}`,
      restaurantId: params.restaurantId, tableId: params.tableId, partySize: 2,
      slotStart: start, slotEnd: end,
      status: 'confirmed' as never,
      blockBufferMinutes: 15,
    },
    select: { id: true },
  });
}

/** موتورِ تکی — همانی که شیتِ رزروِ اپ مصرف می‌کند. کلیدِ یکتا تا کش دخالت نکند. */
async function single(restaurantId: string, date: string, party: number) {
  return computeAndCacheAvailability(
    restaurantId, date, party, `test-avail-bulk:${randomUUID()}`, 5,
  ) as Promise<{ slots: { time: string; free_tables: number[]; status: string }[] }>;
}

const bulkEntries = async (ids: string[], date: string, party: number) =>
  bulkEntriesFromRaw(await computeBulkSlots(ids, date, party), date);

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ سانسِ گروهی ${TAG}` }, select: { id: true } });
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

// ─────────────────────────────────────────────────────────────────────
describe('گروهی با موتورِ تکی واگرا نمی‌شود', () => {
  test('⚠️ برایِ چند رستورانِ متفاوت، سانس‌هایِ آزاد عیناً همان‌اند', async () => {
    // این تستِ مرکزیِ فایل است: اگر بشکند یعنی کارت می‌تواند ساعتی را «آزاد»
    // نشان دهد که شیتِ رزرو پر می‌داند — همان کلاسِ «ادعایِ بی‌پشتوانه» که
    // قوانینِ این ریپو ممنوع کرده.
    const empty = await makeRestaurant('same-empty', {
      tables: [{ number: 1, capacity: 2 }, { number: 2, capacity: 6 }],
    });
    const partly = await makeRestaurant('same-partly', {
      tables: [{ number: 1, capacity: 4 }],
    });
    await book({ restaurantId: partly.id, tableId: partly.tables[0].id, date: DATE, time: '19:00' });

    const shifted = await makeRestaurant('same-shift', {
      openingHours: { [String(new Date(`${DATE}T12:00:00Z`).getUTCDay())]: [['18:00', '22:00']] },
      slotMinutes: 60,
    });

    for (const party of [2, 4]) {
      const bulk = await bulkEntries([empty.id, partly.id, shifted.id], DATE, party);
      for (const r of [empty, partly, shifted]) {
        const expected = (await single(r.id, DATE, party))
          .slots.filter(s => s.status === 'open').map(s => s.time);
        assert.deepEqual(bulk.get(r.id)?.open, expected,
          `رستورانِ ${r.id} با ${party} نفر: خروجیِ گروهی با موتورِ تکی فرق دارد`);
      }
    }
  });

  test('کنترلِ مثبت: این تطبیق روی لیستِ خالی سبز نمی‌شود', async () => {
    // بدونِ این، تستِ بالا وقتی *هیچ* سانسی تولید نشود هم پاس می‌شد.
    const r = await makeRestaurant('positive-control');
    const bulk = await bulkEntries([r.id], DATE, 2);
    assert.ok((bulk.get(r.id)?.open.length ?? 0) > 0,
      'پیش‌شرط: رستورانِ بدونِ رزرو باید سانسِ آزاد داشته باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('صداقتِ خروجی', () => {
  test('⚠️ شناسه‌ی ناشناخته اصلاً در خروجی نمی‌آید (نه آرایه‌ی خالی)', async () => {
    // «نمی‌شناسیم» با «جا ندارد» یکی نیست. اگر آرایه‌ی خالی برمی‌گرداندیم،
    // اپ برایِ رستورانی که اصلاً پیدا نشده «امشب پره» را ادعا می‌کرد.
    const r = await makeRestaurant('known');
    const ghost = randomUUID();
    const bulk = await bulkEntries([r.id, ghost], DATE, 2);
    assert.ok(bulk.has(r.id), 'رستورانِ موجود باید باشد');
    assert.equal(bulk.has(ghost), false, 'شناسه‌ی ناشناخته نباید ورودی بگیرد');
  });

  test('میزِ اشغال‌شده سانس را از فهرستِ آزاد حذف می‌کند', async () => {
    const r = await makeRestaurant('occupied', { tables: [{ number: 1, capacity: 4 }] });
    const before = await bulkEntries([r.id], DATE, 2);
    assert.ok(before.get(r.id)!.open.includes('19:00'), 'پیش‌شرط: ۱۹:۰۰ باید آزاد باشد');

    await book({ restaurantId: r.id, tableId: r.tables[0].id, date: DATE, time: '19:00' });
    const after = await bulkEntries([r.id], DATE, 2);
    assert.equal(after.get(r.id)!.open.includes('19:00'), false,
      'تنها میزِ رستوران در ۱۹:۰۰ رزرو است — نباید آزاد اعلام شود');
  });

  test('سانسِ گذشته‌ی امروز آزاد اعلام نمی‌شود', async () => {
    // همان قاعده‌ی withoutPastSlots در مسیرِ تکی: ساعتی که گذشته، در submit
    // با Err.pastTime رد می‌شود — پس نشان‌دادنش روی کارت یک وعده‌ی باطل است.
    const r = await makeRestaurant('past', { tables: [{ number: 1, capacity: 4 }] });
    const raw = await computeBulkSlots([r.id], DATE, 2);
    assert.ok(raw[r.id].slots.length > 0, 'پیش‌شرط: سانسِ خام باید وجود داشته باشد');

    // «الان» را بعد از آخرین سانسِ آن روز می‌گذاریم: همه باید گذشته شوند.
    const last = raw[r.id].slots[raw[r.id].slots.length - 1].time;
    const afterAll = +zonedTimeToUtc(DATE, last, TZ) + 60_000;
    const entries = bulkEntriesFromRaw(raw, DATE, afterAll);
    assert.deepEqual(entries.get(r.id)!.open, [], 'هیچ سانسی نباید آزاد بماند');
    assert.equal(entries.get(r.id)!.hasSchedule, false,
      'وقتی همه‌ی سانس‌ها گذشته‌اند، hasSchedule باید false باشد');

    // کنترلِ مثبت: با «الان»ِ پیش از اولین سانس، همان‌ها آزادند.
    const beforeAll = +zonedTimeToUtc(DATE, raw[r.id].slots[0].time, TZ) - 60_000;
    assert.ok(bulkEntriesFromRaw(raw, DATE, beforeAll).get(r.id)!.open.length > 0,
      'کنترلِ مثبت: پیش از شروعِ سانس‌ها باید آزاد باشند');
  });

  test('⚠️ «الان» داخلِ مقدارِ قابلِ‌کش نمی‌رود', async () => {
    // computeBulkSlots عمداً از زمانِ جاری بی‌خبر است؛ فیلترِ گذشته بیرونِ کش
    // انجام می‌شود. اگر این بشکند، تا انقضایِ TTL ساعتِ ردشده «آزاد» می‌ماند.
    const r = await makeRestaurant('cacheable');
    const a = await computeBulkSlots([r.id], DATE, 2);
    const b = await computeBulkSlots([r.id], DATE, 2);
    assert.deepEqual(a, b, 'خروجیِ خام باید بینِ دو فراخوانی یکسان (و پس قابلِ کش) باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('قاعده‌ی «این میز به این گروه می‌خورد؟» — منبعِ واحد', () => {
  const base = {
    id: 'x', number: 1, capacity: 4, minPartySize: 1,
    maxPartySize: null as number | null, isActive: true, state: 'free',
  };

  test('ظرفیت، حداقل و حداکثرِ گروه هر سه اعمال می‌شوند', () => {
    assert.equal(tableFitsParty(base, 4), true);
    assert.equal(tableFitsParty(base, 5), false, 'بیش از ظرفیت');
    assert.equal(tableFitsParty({ ...base, minPartySize: 3 }, 2), false, 'کمتر از حداقل');
    assert.equal(tableFitsParty({ ...base, maxPartySize: 2 }, 3), false, 'بیش از سقفِ گروه');
    assert.equal(tableFitsParty({ ...base, maxPartySize: null }, 4), true,
      'maxPartySize برابرِ null یعنی سقف = capacity، نه «هیچ میزی نمی‌خورد»');
  });

  test('میزِ غیرفعال یا در تعمیر شمرده نمی‌شود', () => {
    assert.equal(tableFitsParty({ ...base, isActive: false }, 2), false);
    assert.equal(tableFitsParty({ ...base, state: 'maintenance' }, 2), false);
  });

  test('همین قاعده در مسیرِ گروهی هم واقعاً اجرا می‌شود', async () => {
    // تستِ خالصِ بالا اثبات نمی‌کند که مسیرِ گروهی از آن استفاده می‌کند.
    const r = await makeRestaurant('fits', {
      tables: [
        { number: 1, capacity: 8, maxPartySize: 2 },   // سقفِ گروه پایین
        { number: 2, capacity: 8, state: 'maintenance' },
        { number: 3, capacity: 8, isActive: false },
      ],
    });
    const bulk = await bulkEntries([r.id], DATE, 6);
    assert.deepEqual(bulk.get(r.id)!.open, [],
      'هر سه میز باید ردِ صلاحیت شوند — هیچ سانسی نباید آزاد باشد');

    // کنترلِ مثبت: همان رستوران برای گروهِ ۲نفره میزِ ۱ را دارد.
    const two = await bulkEntries([r.id], DATE, 2);
    assert.ok(two.get(r.id)!.open.length > 0, 'کنترلِ مثبت: گروهِ ۲نفره باید میز داشته باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('روتِ HTTP', () => {
  const call = (qs: string) =>
    bulkRoute.GET(new Request(`http://x/api/v1/restaurants/availability?${qs}`));

  test('پاسخ نگاشتِ id→سانس است و رستورانِ واقعی ساعت می‌گیرد', async () => {
    const r = await makeRestaurant('http-ok');
    const res = await call(`ids=${r.id}&date=${DATE}&party=2`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.date, DATE);
    assert.equal(body.party, 2);
    assert.ok(Array.isArray(body.restaurants[r.id]?.available_slots));
    assert.ok(body.restaurants[r.id].available_slots.length > 0,
      'رستورانِ آزاد باید ساعت بگیرد — این همان چیزی است که کارت نمایش می‌دهد');
    assert.equal(body.restaurants[r.id].has_schedule, true);
  });

  test('شناسه‌ی بدشکل بی‌صدا حذف می‌شود و بقیه را از بین نمی‌برد', async () => {
    const r = await makeRestaurant('http-mixed');
    const res = await call(`ids=not-a-uuid,${r.id},,123&date=${DATE}&party=2`);
    assert.equal(res.status, 200, 'یک idِ خراب نباید کلِ درخواست را ۴۲۲ کند');
    const body = await res.json();
    assert.equal(body.requested, 1, 'فقط یک شناسه‌ی معتبر بود');
    assert.ok(body.restaurants[r.id], 'رستورانِ معتبر باید پاسخ بگیرد');
  });

  test('تاریخِ نامعتبر رد می‌شود', async () => {
    const r = await makeRestaurant('http-baddate');
    const res = await call(`ids=${r.id}&date=1404/01/01&party=2`);
    assert.equal(res.status, 422);
  });

  test('⚠️ سقفِ دسته اعمال و صریحاً اعلام می‌شود', async () => {
    // بی‌صدا بریدن یعنی اپ «این رستوران ساعت ندارد» را از «اصلاً نپرسیدیم»
    // تشخیص نمی‌دهد. پاسخ باید سقف را بگوید.
    const ids = Array.from({ length: 30 }, () => randomUUID()).join(',');
    const res = await call(`ids=${ids}&date=${DATE}&party=2`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.max_per_request, 24);
    assert.equal(body.requested, 24, 'بیش از سقف باید بریده شود');
  });
});
