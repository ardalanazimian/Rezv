import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  میزِ «نگه‌داشته‌شده» در availability — و مرزی که نباید از آن رد شود
//
//  ── نقصِ اصلی (اندازه‌گیریِ زنده، ۲۰۲۶-۰۹-۰۵) ──
//  `promoteNext` میزِ آفرشده را `tables.state='reserved'` می‌کند و **هیچ ردیفِ
//  رزروی نمی‌سازد** (waitlist.ts:360-362). آن هولد ۵ دقیقه زنده است
//  (`OFFER_TTL_MINUTES`). ولی `computeSlots` تنها فیلترِ وضعیتش
//  `state !== 'maintenance'` بود (availability.ts:71) و `busy` هم فقط از
//  جدولِ `reservations` می‌آید — پس تا ۵ دقیقه همان میز به **همه** «آزاد»
//  نشان داده می‌شد. اگر کسی دیگر رزروش می‌کرد، پذیرشِ مهمانِ صف روی
//  `no_table_overlap` شکست می‌خورد: وعده‌ی شکسته، نه double-booking.
//
//  ── و نقصی که «رفعِ بدیهی» می‌ساخت، بدتر از خودِ نقص ──
//  رفعِ بدیهی این بود که `getOccupiedTableNumbers` وضعیتِ میز را هم بخواند،
//  یا اینکه اینجا `state === 'free'` بنویسیم. هر دو یک خطای رده‌ای‌اند:
//  `tables.state` یک پرچمِ **نقطه‌ای** («این میز همین حالا چه می‌کند؟») است و
//  هیچ بُعدِ زمانی ندارد؛ اشغالِ رزرو یک بازه است. اگر پرچمِ نقطه‌ای را بدونِ
//  افق روی همه‌ی بازه‌ها اعمال کنیم، میزی که ۵ دقیقه هولد شده از رزروِ
//  **سه روزِ بعد** هم پنهان می‌شود: یک وعده‌ی شکسته‌ی ۵دقیقه‌ای تبدیل می‌شود
//  به ظرفیتِ فروش‌نرفته‌ی دائمی و بی‌صدا.
//
//  پس این فایل هر دو جهت را قفل می‌کند و تستِ سوم مهم‌ترینِ آن‌هاست:
//    ۱) میزِ هولدشده در سانس‌هایِ **داخلِ افق** آزاد اعلام نشود
//    ۲) پذیرشِ آفر داخلِ ۵ دقیقه همچنان موفق باشد
//    ۳) 🚨 میزی که همین حالا hold/occupied است، برایِ **تاریخِ آینده** همچنان
//       رزروپذیر بماند — گاردِ خطای رده‌ای. بدونِ این، رفعِ ساده‌لوحانه هم
//       «درست» به‌نظر می‌رسد.
//
//  ⚠️ ضدِ سبزِ توخالی: هیچ lookupی در این فایل حق ندارد وقتی موضوعش غایب است
//  بی‌صدا رد شود. هر `find` با `assert.ok` همراه است و هر ادعای منفی یک
//  کنترلِ مثبتِ کنارِ خودش دارد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const {
  computeSlots, computeAndCacheAvailability, timingOf, holdsFromTables,
} = await import('../src/lib/availability');
const {
  getHeldTableNumbers, holdHorizonMinutes, tableStateBlocksNow, OFFER_TTL_MINUTES,
} = await import('../src/lib/table-occupancy');
const { zonedTimeToUtc, dateKeyInTz } = await import('../src/lib/hours');
const { promoteNext, acceptOffer } = await import('../src/lib/waitlist');

const TAG = `avh-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';
/** تاریخِ ثابتِ آینده برایِ ریاضیِ خالص — نتیجه نباید به «امروز» وابسته باشد. */
const PURE_DATE = '2027-05-19';

/** سانسِ ۹۰ + نظافتِ ۳۰ → بلاک = ۱۲۰ دقیقه، یعنی مضربِ گامِ ۳۰دقیقه‌ایِ سانس‌ها.
 *  عمدی: مرزهایِ هولد دقیقاً رویِ یکی از SERVICE_TIMES می‌افتند، وگرنه سانسِ
 *  مرزی اصلاً در فهرست نیست و تست بی‌صدا بی‌اثر می‌شود. */
const CFG = timingOf({ slotMinutes: 90, bufferMinutes: 0, cleaningMinutes: 30, holdMinutes: 10 });

const HELD_TABLE = 1;
const FREE_TABLE = 2;

const PURE_TABLES = [
  { id: 'p1', number: HELD_TABLE, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'reserved' },
  { id: 'p2', number: FREE_TABLE, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'free' },
];

function at(time: string, date = PURE_DATE) {
  return zonedTimeToUtc(date, time, TZ);
}

/** سانسِ خواسته‌شده را برمی‌گرداند و نبودش را **خطا** می‌کند، نه عبور. */
function slotAt(slots: ReturnType<typeof computeSlots>, time: string) {
  const hit = slots.find(s => s.time === time);
  assert.ok(hit, `سانسِ ${time} باید در خروجی باشد — وگرنه این تست چیزی نمی‌سنجد`);
  return hit;
}

function slotsWithHold(hold: { tableNumber: number; from: Date; through: Date } | null, date = PURE_DATE) {
  return computeSlots({
    date, party: 2, tz: TZ, cfg: CFG,
    openingHours: null, closureSet: new Set<string>(),
    tables: PURE_TABLES as never,
    busy: [],
    holds: hold ? [hold] : [],
  } as never);
}

// ─────────────────────────────────────────────────────────────────────
describe('افقِ هولد — ریاضیِ خالصِ computeSlots', () => {
  test('کنترلِ مثبت: بدونِ هولد، هر دو میز در همه‌ی سانس‌ها آزادند', () => {
    const slots = slotsWithHold(null);
    assert.ok(slots.length > 0, 'پیش‌شرط: باید سانس تولید شده باشد');
    for (const s of slots) {
      assert.ok(s.free_tables.includes(HELD_TABLE),
        `بدونِ هولد میزِ ${HELD_TABLE} باید در ${s.time} آزاد باشد — اگر نیست، بقیه‌ی این فایل بی‌معناست`);
    }
  });

  test('میزِ هولدشده در سانسِ داخلِ افق آزاد اعلام نمی‌شود', () => {
    // هولد [۱۸:۰۰, ۲۱:۰۰). سانسِ ۲۰:۳۰ بلاکش [۲۰:۳۰, ۲۲:۳۰) است → هم‌پوشانی دارد.
    const slots = slotsWithHold({ tableNumber: HELD_TABLE, from: at('18:00'), through: at('21:00') });
    const s = slotAt(slots, '20:30');
    assert.equal(s.free_tables.includes(HELD_TABLE), false,
      'میزِ هولدشده نباید در سانسِ داخلِ افق آزاد اعلام شود');
    assert.ok(s.free_tables.includes(FREE_TABLE),
      'کنترلِ مثبت: میزِ آزاد باید همچنان آزاد بماند — وگرنه سانس به دلیلِ دیگری خالی شده');
  });

  test('مرزِ بالا سخت‌گیرانه است: سانسی که دقیقاً در لحظه‌ی پایانِ افق شروع می‌شود آزاد می‌ماند', () => {
    // جهشِ `start < through` → `start <= through` باید همین‌جا قرمز شود.
    const slots = slotsWithHold({ tableNumber: HELD_TABLE, from: at('18:00'), through: at('21:00') });
    // ⚠️ کنترلِ زنده‌بودنِ سازوکار، در همین تست: بدونِ این، وقتی قابلیت اصلاً
    // وجود ندارد هیچ‌چیز سرکوب نمی‌شود و ادعای «آزاد ماند» بی‌معنا سبز است.
    assert.equal(slotAt(slots, '20:30').free_tables.includes(HELD_TABLE), false,
      'کنترلِ زنده‌بودن: یک گام پیش از مرز باید سرکوب شده باشد');
    const s = slotAt(slots, '21:00');
    assert.ok(s.free_tables.includes(HELD_TABLE),
      'سانسِ چسبیده به پایانِ افق باید آزاد بماند — وگرنه ظرفیتِ فروختنی بی‌صدا از دست می‌رود');
  });

  test('مرزِ پایین سخت‌گیرانه است: سانسی که بلاکش دقیقاً در لحظه‌ی شروعِ هولد تمام می‌شود آزاد می‌ماند', () => {
    // جهشِ `blockEnd > from` → `blockEnd >= from` باید همین‌جا قرمز شود.
    const slots = slotsWithHold({ tableNumber: HELD_TABLE, from: at('20:00'), through: at('23:00') });
    const before = slotAt(slots, '18:00'); // بلاک [۱۸:۰۰, ۲۰:۰۰)
    assert.ok(before.free_tables.includes(HELD_TABLE),
      'سانسی که دقیقاً پیش از شروعِ هولد تمام می‌شود باید آزاد بماند');
    const overlapping = slotAt(slots, '18:30'); // بلاک [۱۸:۳۰, ۲۰:۳۰) → هم‌پوشان
    assert.equal(overlapping.free_tables.includes(HELD_TABLE), false,
      'کنترلِ منفی: یک گامِ بعدتر باید هم‌پوشانی داشته باشد — وگرنه مرز چیزی نمی‌سنجد');
  });

  test('🚨 هولدِ امروز هیچ سانسی از یک تاریخِ آینده را پنهان نمی‌کند', () => {
    // این همان گاردِ خطای رده‌ای است. یک هولدِ نقطه‌ایِ ۵دقیقه‌ای اگر بدونِ افق
    // اعمال شود، میز را از رزروِ روزهایِ بعد هم حذف می‌کند.
    const FUTURE = '2027-05-22'; // سه روز بعد
    const hold = { tableNumber: HELD_TABLE, from: at('18:00'), through: at('21:00') };

    // ⚠️ کنترلِ زنده‌بودن، اجباری: همان هولد باید رویِ **روزِ خودش** واقعاً
    // سرکوب کند. بدونِ این بند، یک نسخه‌ای که اصلاً هولد را نمی‌شناسد هم از
    // این تست سبز رد می‌شود — یعنی مهم‌ترین گاردِ فایل، توخالی.
    assert.equal(
      slotAt(slotsWithHold(hold), '20:30').free_tables.includes(HELD_TABLE), false,
      'کنترلِ زنده‌بودن: هولد باید رویِ روزِ خودش سرکوب کند، وگرنه این تست چیزی نمی‌سنجد',
    );

    const slots = slotsWithHold(hold, FUTURE);
    assert.ok(slots.length > 0, 'پیش‌شرط: تاریخِ آینده باید سانس داشته باشد');
    for (const s of slots) {
      assert.ok(s.free_tables.includes(HELD_TABLE),
        `میزِ هولدشده باید برایِ ${FUTURE} ساعتِ ${s.time} همچنان رزروپذیر بماند`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('افق — تعریف و اشتقاق', () => {
  test('افق = مهلتِ پاسخِ آفر + کلِ بلاکِ سرویس', () => {
    const cfg = { slotMinutes: 90, cleaningMinutes: 15, bufferMinutes: 0 };
    const block = cfg.slotMinutes + cfg.cleaningMinutes + cfg.bufferMinutes;
    assert.equal(typeof holdHorizonMinutes, 'function', 'holdHorizonMinutes باید وجود داشته باشد');
    assert.equal(holdHorizonMinutes(cfg), OFFER_TTL_MINUTES + block,
      'افق باید دقیقاً «مهلتِ پذیرش + مدتِ بلاکِ نشستن» باشد');
    assert.equal(holdHorizonMinutes(cfg) - block, OFFER_TTL_MINUTES,
      'جمله‌ی مهلتِ پذیرش نباید از افق حذف شود — مهمان تا آخرین ثانیه‌ی TTL حق پذیرش دارد');
  });

  test('افق با پیکربندیِ رستوران تغییر می‌کند، ثابتِ سراسری نیست', () => {
    const fast = holdHorizonMinutes({ slotMinutes: 45, cleaningMinutes: 5, bufferMinutes: 0 });
    const fine = holdHorizonMinutes({ slotMinutes: 150, cleaningMinutes: 30, bufferMinutes: 15 });
    assert.ok(fine > fast, 'رستورانِ فاین‌دایینینگ باید افقِ بلندتری از فست‌فود داشته باشد');
  });

  test('فقط وضعیت‌هایِ «همین حالا مدعی دارد» هولد می‌سازند — maintenance جدا می‌ماند', () => {
    assert.equal(tableStateBlocksNow('reserved'), true);
    assert.equal(tableStateBlocksNow('occupied'), true);
    assert.equal(tableStateBlocksNow('cleaning'), true);
    assert.equal(tableStateBlocksNow('free'), false);
    // maintenance عمداً اینجا نیست: «خارج از سرویس» بازه‌ی کوتاه نیست و در
    // tableFitsParty به‌صورتِ زمان‌ناوابسته رد می‌شود. اگر اینجا هم بیاید،
    // همان قاعده دو جا نوشته می‌شود و می‌تواند واگرا شود.
    assert.equal(tableStateBlocksNow('maintenance'), false);
  });

  test('holdsFromTables فقط میزهایِ مدعی‌دار را با پنجره‌ی درست برمی‌گرداند', () => {
    const now = at('19:00');
    const holds = holdsFromTables([
      { id: 'a', number: 10, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'free' },
      { id: 'b', number: 11, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'reserved' },
      { id: 'c', number: 12, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'occupied' },
      { id: 'd', number: 13, capacity: 4, minPartySize: 1, maxPartySize: null, isActive: true, state: 'maintenance' },
    ] as never, CFG, now);
    assert.deepEqual(holds.map(h => h.tableNumber).sort((x, y) => x - y), [11, 12],
      'فقط reserved و occupied باید هولد بسازند');
    const h = holds.find(x => x.tableNumber === 11);
    assert.ok(h, 'هولدِ میزِ ۱۱ باید ساخته شده باشد');
    assert.equal(+h.from, +now, 'هولد از «الان» شروع می‌شود');
    assert.equal(+h.through, +now + holdHorizonMinutes(CFG) * 60_000,
      'پایانِ هولد باید دقیقاً افق باشد، نه بیشتر و نه کمتر');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  یکپارچه — با دیتابیسِ واقعی و مسیرِ واقعیِ صف
// ═══════════════════════════════════════════════════════════════════════

/** ساعتِ کاریِ همه‌ی روزهایِ هفته، تمامِ شبانه‌روز — تا سانس‌ها به «امروز چه
 *  ساعتی است» وابسته نباشند و تست در هیچ ساعتی بی‌صدا بی‌اثر نشود. */
const ALL_DAY_HOURS: Record<string, [string, string][]> = {
  '0': [['00:00', '23:59']], '1': [['00:00', '23:59']], '2': [['00:00', '23:59']],
  '3': [['00:00', '23:59']], '4': [['00:00', '23:59']], '5': [['00:00', '23:59']],
  '6': [['00:00', '23:59']],
};

let tenantId = '';
let restaurantId = '';
let userId = '';
let tableNumbers: number[] = [];

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ افقِ هولد', clubPrefix: 'AVH',
      timezone: TZ, isOpen: true, onlineGating: false,
      slotMinutes: 90, cleaningMinutes: 15, bufferMinutes: 0,
      openingHours: ALL_DAY_HOURS as never,
      tables: {
        create: [
          { number: HELD_TABLE, capacity: 4, minPartySize: 1 },
          { number: FREE_TABLE, capacity: 4, minPartySize: 1 },
        ] as never,
      },
    },
    select: { id: true, tables: { select: { number: true } } },
  });
  restaurantId = r.id;
  tableNumbers = r.tables.map(x => x.number).sort((a, b) => a - b);
  const u = await db.user.create({
    data: { phone: `0912${Math.floor(1000000 + Math.random() * 8999999)}`, firstName: '[DEMO] مهمانِ صف' },
    select: { id: true },
  });
  userId = u.id;
});

after(async () => {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

async function resetQueue() {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } });
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.updateMany({ where: { restaurantId }, data: { state: 'free' } });
}

/** یک ورودیِ waiting می‌سازد و آفرِ واقعی می‌گیرد. شکستِ ارتقا **خطا** است. */
async function offerRealTable() {
  await db.waitlistEntry.create({
    data: {
      restaurantId, userId, partySize: 2, status: 'waiting', priority: 0,
      joinedAt: new Date(Date.now() - 5 * 60_000),
    },
  });
  const res = await promoteNext(restaurantId);
  assert.equal(res.promoted, true, 'پیش‌شرط: ارتقا باید انجام شود — وگرنه هیچ هولدی برایِ سنجش نیست');
  assert.ok(res.table !== undefined, 'شماره‌ی میزِ آفرشده باید برگردد');
  assert.ok(res.entryId, 'شناسه‌ی ورودی باید برگردد');
  return { entryId: res.entryId!, table: res.table! };
}

/** کلیدِ کشِ یکتا در هر فراخوانی تا کشِ Redis هرگز نتیجه را آلوده نکند. */
async function availabilityFor(date: string) {
  return computeAndCacheAvailability(restaurantId, date, 2, `test-avh:${randomUUID()}`, 5) as Promise<{
    date: string; party: number; tz: string;
    slots: { time: string; free_tables: number[]; status: string }[];
  }>;
}

describe('افقِ هولد — مسیرِ واقعیِ صف با دیتابیس', () => {
  test('پیش‌شرطِ ساختاری: آفرِ صف هیچ ردیفِ رزروی نمی‌سازد و فقط وضعیتِ میز را عوض می‌کند', async () => {
    await resetQueue();
    const { table } = await offerRealTable();
    const rows = await db.reservation.count({ where: { restaurantId } });
    assert.equal(rows, 0, 'آفر نباید رزرو بسازد — همین است که getOccupiedTableNumbers نمی‌بیندش');
    const t = await db.table.findFirst({ where: { restaurantId, number: table }, select: { state: true } });
    assert.ok(t, 'میزِ آفرشده باید وجود داشته باشد');
    assert.equal(t.state, 'reserved', 'میزِ آفرشده باید reserved باشد');
  });

  test('مهلتِ آفرِ واقعی همان OFFER_TTL_MINUTES است (پیوندِ مصرف‌کننده به تولیدکننده)', async () => {
    await resetQueue();
    const { entryId } = await offerRealTable();
    const e = await db.waitlistEntry.findUnique({
      where: { id: entryId }, select: { offeredAt: true, offerExpiresAt: true },
    });
    assert.ok(e?.offeredAt && e.offerExpiresAt, 'زمانِ آفر و انقضا باید ثبت شده باشند');
    assert.equal(+e.offerExpiresAt - +e.offeredAt, OFFER_TTL_MINUTES * 60_000,
      'اگر مهلتِ واقعیِ آفر تغییر کند، افقِ availability هم باید با آن تغییر کند');
  });

  test('getHeldTableNumbers میزِ هولدشده را می‌بیند — جایی که getOccupiedTableNumbers نمی‌بیند', async () => {
    await resetQueue();
    const before = await getHeldTableNumbers(db, restaurantId);
    assert.equal(before.size, 0, 'پیش‌شرط: قبل از آفر هیچ میزی هولد نیست');
    const { table } = await offerRealTable();
    const held = await getHeldTableNumbers(db, restaurantId);
    assert.ok(held.has(table), `میزِ ${table} باید در فهرستِ «همین حالا هولد» باشد`);
    assert.equal(held.size, 1, 'فقط همان یک میز باید هولد باشد');
  });

  test('۱) میزِ هولدشده در نزدیک‌ترین سانسِ پیشِ رو آزاد اعلام نمی‌شود', async () => {
    await resetQueue();
    const today = dateKeyInTz(new Date(), TZ);

    const beforeOffer = await availabilityFor(today);
    const now = Date.now();
    const upcoming = beforeOffer.slots.filter(s => +zonedTimeToUtc(today, s.time, TZ) >= now);
    assert.ok(upcoming.length > 0,
      'پیش‌شرط: باید دستِ‌کم یک سانسِ پیشِ رو در امروز باشد — وگرنه این تست چیزی نمی‌سنجد');
    const target = upcoming[0].time;
    assert.deepEqual(
      [...beforeOffer.slots.find(s => s.time === target)!.free_tables].sort((a, b) => a - b),
      tableNumbers,
      'کنترلِ مثبت: پیش از آفر هر دو میز باید در آن سانس آزاد باشند',
    );

    const { table } = await offerRealTable();
    const afterOffer = await availabilityFor(today);
    const slot = afterOffer.slots.find(s => s.time === target);
    assert.ok(slot, `سانسِ ${target} باید هنوز در خروجی باشد`);
    assert.equal(slot.free_tables.includes(table), false,
      `میزِ ${table} برایِ مهمانِ صف نگه داشته شده و نباید در سانسِ ${target} آزاد اعلام شود`);
    assert.equal(slot.free_tables.length, tableNumbers.length - 1,
      'دقیقاً یک میز باید کم شود — نه صفر، نه همه');
  });

  test('۲) پذیرشِ آفر داخلِ مهلت همچنان موفق است', async () => {
    await resetQueue();
    const { entryId, table } = await offerRealTable();
    const out = await acceptOffer(entryId, 'customer', { callerUserId: userId });
    assert.equal(out.status, 'accepted', 'پذیرشِ آفر باید موفق باشد');
    assert.ok(out.reservation_code, 'باید کدِ رزرو برگردد');
    assert.equal(out.table_number, table, 'رزرو باید رویِ همان میزِ آفرشده بنشیند');
    const created = await db.reservation.count({ where: { restaurantId, code: out.reservation_code } });
    assert.equal(created, 1, 'رزروِ واقعی باید در دیتابیس ساخته شده باشد');
  });

  test('۳) 🚨 میزی که همین حالا hold یا occupied است، برایِ تاریخِ آینده رزروپذیر می‌ماند', async () => {
    await resetQueue();
    const { table } = await offerRealTable();
    // میزِ دوم را هم دستی occupied می‌کنیم تا هر دو وضعیتِ نقطه‌ای پوشش داده شود.
    const other = tableNumbers.find(n => n !== table);
    assert.ok(other !== undefined, 'پیش‌شرط: باید میزِ دومی وجود داشته باشد');
    await db.table.updateMany({ where: { restaurantId, number: other }, data: { state: 'occupied' } });

    // پیش‌شرط را مستقیم از دیتابیس می‌خوانیم (نه از هِلپرِ تازه) تا این گارد
    // پیش از رفع هم قابلِ اجرا باشد و «سبزِ قبل → سبزِ بعد» را ثابت کند.
    const states = await db.table.findMany({
      where: { restaurantId }, select: { number: true, state: true },
    });
    assert.equal(states.length, tableNumbers.length, 'پیش‌شرط: هر دو میز باید موجود باشند');
    assert.equal(states.every(s => s.state !== 'free'), true,
      'پیش‌شرط: هر دو میز باید همین حالا «مدعی‌دار» باشند');

    // ⚠️ کنترلِ زنده‌بودن: همان وضعیتِ نقطه‌ای باید رویِ **امروز** واقعاً اثر
    // بگذارد، وگرنه ادعای «آینده دست‌نخورده ماند» چیزی نمی‌سنجد.
    const todayKey = dateKeyInTz(new Date(), TZ);
    const todayAvail = await availabilityFor(todayKey);
    const nowMs = Date.now();
    const nextUp = todayAvail.slots.find(s => +zonedTimeToUtc(todayKey, s.time, TZ) >= nowMs);
    assert.ok(nextUp, 'پیش‌شرط: امروز باید سانسِ پیشِ رو داشته باشد');
    assert.deepEqual(nextUp.free_tables, [],
      'کنترلِ زنده‌بودن: وقتی هر دو میز مدعی دارند، سانسِ پیشِ روی امروز باید خالی باشد');

    const future = '2027-11-17';
    const avail = await availabilityFor(future);
    assert.ok(avail.slots.length > 0, 'پیش‌شرط: تاریخِ آینده باید سانس داشته باشد');
    for (const s of avail.slots) {
      assert.deepEqual([...s.free_tables].sort((a, b) => a - b), tableNumbers,
        `وضعیتِ نقطه‌ایِ امروز نباید سانسِ ${s.time} در ${future} را پنهان کند — این ظرفیتِ فروش‌نرفته‌ی دائمی است`);
      assert.equal(s.status, 'open', `سانسِ ${future} ${s.time} باید open بماند`);
    }
  });
});
