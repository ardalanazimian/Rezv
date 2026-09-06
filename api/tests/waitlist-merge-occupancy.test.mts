import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  ارتقاءِ لیستِ انتظار رویِ میزِ *ثانویه*ی یک merge — گاردِ گمشده‌ی promoteNext
//
//  چرا این فایل: رفعِ P0ِ سوم (کامیتِ 3401859) چکِ isTableNumberOccupied را به
//  promoteNext اضافه کرد، ولی هیچ تستی نداشت. سه فایلِ موجود promoteNext را
//  صدا می‌زنند (waitlist-flow.integration، notification-consent-enforcement،
//  table-release.integration) و هیچ‌کدام سناریوی میزِ ثانویه‌ی merge را
//  نمی‌سازند — یعنی برگرداندنِ آن رفع، همه‌شان را سبز نگه می‌داشت.
//
//  ── ساختاری که باگ را ممکن می‌کرد ──
//  رزروِ ترکیبی رویِ میزِ *اصلی* نوشته می‌شود و میزِ ثانویه فقط یک عدد در
//  `merged_table_numbers` است (reservations.ts:tryMergeTables). آن میز:
//    • ردیفِ رزروِ خودش را ندارد  → `reservation.count({tableId})` نمی‌بیندش
//    • `tables.state`ش عوض نمی‌شود → از فیلترِ `state:'free'`ِ کاندیدها رد می‌شود
//  پس صف می‌توانست میزی را آفر بدهد که همین حالا نصفِ یک گروهِ ترکیبی سرش
//  نشسته است — double-bookingِ فیزیکیِ واقعی.
//
//  ⚠️ دامنه‌ی این فایل — عمداً فقط حالتِ **ترتیبی** ──
//  اینجا merge **پیش از** فراخوانیِ promoteNext کاملاً commit شده است. این
//  همان نیمه‌ای است که رفعِ فعلی واقعاً می‌بندد. حالتِ **هم‌زمان** (merge در
//  حالِ commit، هم‌زمان با promoteNext) هنوز باز است و اینجا آزموده **نمی‌شود**:
//  تراکنشِ promoteNext (waitlist.ts:315) بدونِ isolationLevel باز می‌شود یعنی
//  READ COMMITTED، و طبقِ بندِ صریحِ table-occupancy.ts خواندنِ یک تراکنشِ
//  READ COMMITTED هرگز SIREAD نمی‌گیرد، پس چرخه‌ی rw-antidependency کامل
//  نمی‌شود. ادعا کردنِ پوششِ هم‌زمانی در این فایل، همان over-claimی می‌شد که
//  دو بازبینی را قبلاً گمراه کرد. الگویِ آماده‌ی آن تست وقتی تصمیمِ
//  Serializable گرفته شد: walkin-merge-occupancy-concurrency.test.mts.
//
//  ⚠️ ضدِ سبزِ توخالی (قاعده‌ی ۵ مخزن): اگر merge اصلاً رخ ندهد، یا میزِ
//  ثانویه به‌دلیلِ دیگری کاندید نباشد، این تست باید **بشکند** نه اینکه بی‌صدا
//  رد شود. به همین دلیل تستِ اولْ یک کنترلِ مثبت است: ثابت می‌کند بدونِ merge
//  همان میز واقعاً آفر می‌شود. بدونِ آن، تستِ دوم می‌توانست به هزار دلیلِ
//  بی‌ربط سبز بماند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { promoteNext } = await import('../src/lib/waitlist.ts');

const PRIMARY = 911;
const SECONDARY = 912;
/** میزِ کنترل: ظرفیتش برای گروهِ ۶نفره کافی نیست و ترکیب‌پذیر نیست، پس هرگز
 *  واردِ merge نمی‌شود و هرگز کاندیدِ صفِ ۴نفره هم نیست. */
const TOO_SMALL = 913;
const PARTY_MERGE = 6;   // از ظرفیتِ هر میزِ تکی بیشتر → tryMergeTables اجباری
const PARTY_WAIT = 4;    // در یک میزِ ۴نفره جا می‌شود → SECONDARY کاندید است

const TAG = `wlm-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, userId: string;
let primaryTableId: string, secondaryTableId: string;

function tehranDateTime(at: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** یک ورودیِ صفِ waiting می‌سازد و idش را می‌دهد. */
async function seedWaiting(): Promise<string> {
  const e = await db.waitlistEntry.create({
    data: {
      restaurantId, userId, partySize: PARTY_WAIT, status: 'waiting', priority: 0,
      joinedAt: new Date(Date.now() - 5 * 60_000),
    },
    select: { id: true },
  });
  return e.id;
}

async function clearQueueAndTables() {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } });
  await db.table.updateMany({ where: { restaurantId }, data: { state: 'free' } });
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ صف رویِ میزِ ترکیبی', clubPrefix: 'WLM',
      timezone: 'Asia/Tehran', isOpen: true, onlineGating: false,
      openingHours: undefined, lastSeenAt: new Date(),
    },
    select: { id: true },
  });
  restaurantId = r.id;
  const u = await db.user.create({
    data: { phone: `+98936${String(Date.now()).slice(-7)}`, firstName: '[DEMO]', lastName: 'صفِ ترکیبی' },
    select: { id: true },
  });
  userId = u.id;

  const p = await db.table.create({
    data: {
      restaurantId, number: PRIMARY, capacity: 4, isActive: true, state: 'free',
      minPartySize: 1, isMergeable: true, mergeableWith: [SECONDARY],
    },
    select: { id: true },
  });
  primaryTableId = p.id;
  const s = await db.table.create({
    data: {
      restaurantId, number: SECONDARY, capacity: 4, isActive: true, state: 'free',
      minPartySize: 1, isMergeable: true, mergeableWith: [PRIMARY],
    },
    select: { id: true },
  });
  secondaryTableId = s.id;
  await db.table.create({
    data: {
      restaurantId, number: TOO_SMALL, capacity: 2, isActive: true, state: 'free',
      minPartySize: 1, isMergeable: false,
    },
  });
});

after(async () => {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
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

describe('promoteNext رویِ میزِ ثانویه‌یِ merge — حالتِ ترتیبی', () => {
  test('کنترلِ مثبت: بدونِ هیچ رزروی، صف واقعاً یکی از دو میزِ ۴نفره را آفر می‌دهد', async () => {
    await clearQueueAndTables();
    const entryId = await seedWaiting();

    const res = await promoteNext(restaurantId);

    assert.equal(
      res.promoted, true,
      'صف هیچ میزی آفر نداد در حالی که دو میزِ ۴نفره‌ی آزاد هست — ' +
      'یعنی هارنسِ این فایل خراب است و تستِ بعدی هرچه بگوید بی‌اعتبار است',
    );
    assert.ok(
      res.table === PRIMARY || res.table === SECONDARY,
      `میزِ آفرشده باید ۹۱۱ یا ۹۱۲ باشد، نه ${res.table}`,
    );
    assert.equal(res.entryId, entryId, 'آفر باید به همین ورودیِ صف رفته باشد');
  });

  test('پیش‌شرط: رزروِ ۶نفره واقعاً merge می‌شود و میزِ ثانویه ردیفِ رزروِ خودش را ندارد', async () => {
    await clearQueueAndTables();
    const { date, time } = tehranDateTime(new Date(Date.now() + 5 * 60_000));

    const resv = await createReservation({
      restaurantId, date, time, partySize: PARTY_MERGE,
      guest: { name: '[DEMO] گروهِ ۶نفره‌ی ترکیبی' }, source: 'manual', notifySms: false,
    });

    // نبودِ موضوع = خطا، نه عبور.
    assert.deepEqual(
      [...(resv.merged_tables ?? [])].sort((a: number, b: number) => a - b), [PRIMARY, SECONDARY],
      'merge رخ نداد — موضوعِ این فایل غایب است، پس سبزیِ تستِ بعدی چیزی ثابت نمی‌کند',
    );

    const own = await db.reservation.count({ where: { restaurantId, tableId: secondaryTableId } });
    assert.equal(own, 0, 'میزِ ثانویه نباید ردیفِ رزروِ مستقل داشته باشد — پیش‌شرطِ کوریِ چکِ table_id');

    const st = await db.table.findUniqueOrThrow({
      where: { id: secondaryTableId }, select: { state: true },
    });
    assert.equal(
      st.state, 'free',
      'میزِ ثانویه باید همچنان free باشد — دقیقاً همین است که از فیلترِ کاندیدها ردش می‌کند',
    );
  });

  test('گارد: صف نباید میزِ ثانویه‌یِ یک ترکیبِ فعال را آفر بدهد', async () => {
    // میزِ اصلی را از دور خارج می‌کنیم تا تنها کاندیدِ ۴نفره‌ی باقی‌مانده
    // میزِ ثانویه باشد؛ وگرنه انتخابِ میزِ اصلی می‌توانست باگ را بپوشاند.
    await db.waitlistEntry.deleteMany({ where: { restaurantId } });
    await db.table.update({ where: { id: primaryTableId }, data: { state: 'occupied' } });
    await db.table.update({ where: { id: secondaryTableId }, data: { state: 'free' } });

    const entryId = await seedWaiting();
    const res = await promoteNext(restaurantId);

    // ادعای اصلی: میزِ ۹۱۲ نصفِ یک گروهِ ۶نفره‌ی نشسته است. آفرش double-booking است.
    assert.notEqual(
      res.table, SECONDARY,
      'صف میزِ ثانویه‌یِ یک ترکیبِ فعال را آفر داد — double-bookingِ فیزیکی: ' +
      'دو گروهِ متفاوت سرِ یک میز. این همان P0ی است که چکِ isTableNumberOccupied ' +
      'در promoteNext باید ببندد (waitlist.ts:347).',
    );
    assert.equal(
      res.promoted, false,
      `هیچ میزِ آزادِ دیگری نبود، پس ارتقا باید ناموفق باشد — ولی میزِ ${res.table} آفر شد`,
    );

    // ادعای دوم: میز نباید در گذر reserved رها شده باشد.
    const st = await db.table.findUniqueOrThrow({
      where: { id: secondaryTableId }, select: { state: true },
    });
    assert.equal(st.state, 'free', 'میزِ ثانویه بعد از ردشدن باید دوباره free شده باشد، نه reserved');

    const e = await db.waitlistEntry.findUniqueOrThrow({
      where: { id: entryId }, select: { status: true, offeredTableNumber: true },
    });
    assert.equal(e.status, 'waiting', 'ورودیِ صف باید waiting بماند، نه offered');
    assert.equal(e.offeredTableNumber, null, 'هیچ شماره‌ی میزی نباید رویِ ورودی ثبت شده باشد');
  });
});
