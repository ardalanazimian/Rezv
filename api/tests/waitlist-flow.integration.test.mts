import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { TableState } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import {
  joinWaitlist, promoteNext, acceptOffer, declineOffer, leaveWaitlist, expireOffers, getPosition,
} from '../src/lib/waitlist.ts';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';
import * as acceptRoute from '../src/app/api/v1/waitlist/[id]/accept/route.ts';

// ═══════════════════════════════════════════════════════════════════════
//  لیستِ انتظار — هسته‌ی نویسنده، تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `tests/waitlist.test.mts` فقط کمکی‌هایِ **خالص**
//  را می‌سنجید (isVipTier، tierToPriority، medianMinutes، tokensEqual،
//  assertCanActOnEntry). هسته‌ای که واقعاً می‌نویسد — و مستقیم روی «کدام
//  مهمان کدام میزِ فیزیکی را می‌گیرد» اثر دارد — پوششی نداشت:
//  joinWaitlist، promoteNext، declineOffer، leaveWaitlist، expireOffers.
//
//  ⚠️ باگی که همین‌جا پیدا و رفع شد (۲۰۲۶-۰۸-۲۰، با اجرای زنده اثبات شد):
//  `expireOffers` وضعیت را با `update`ِ بی‌قیدوشرط رویِ id می‌نوشت، در حالی
//  که `declineOffer`/`leaveWaitlist` در همان فایل عمداً `updateMany` با گاردِ
//  status دارند و کامنتشان دقیقاً همین رقابت را نام می‌برد. دو پیامدِ
//  *مشاهده‌شده*، نه فرضی:
//    ۱) وضعیتِ «declined»ِ مشتری با «no_response» بازنویسی می‌شد.
//    ۲) میزی که همین حالا به نفرِ بعدی آفر شده بود دوباره `free` می‌شد —
//       یک ورودیِ با آفرِ زنده و میزِ `state='free'` دیده شد، یعنی همان
//       میزِ فیزیکی می‌توانست به نفرِ دوم هم آفر شود.
//  شرحِ کامل در KNOWN_LIMITATIONS §2l.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `wl-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, userId: string;

async function mkTable(number: number, state: TableState = 'free', capacity = 4) {
  return db.table.create({
    data: { restaurantId, number, capacity, isActive: true, state },
    select: { id: true, number: true },
  });
}

const entryOf = (id: string) =>
  db.waitlistEntry.findUniqueOrThrow({
    where: { id }, select: { status: true, offeredTableId: true, offeredTableNumber: true, priority: true },
  });

const tableState = async (id: string) =>
  (await db.table.findUniqueOrThrow({ where: { id }, select: { state: true } })).state;

/** ورودیِ صف با وضعیتِ دلخواه — مستقیم، چون joinWaitlist همیشه `waiting` می‌سازد. */
async function seedOffer(table: { id: string; number: number }, expiresAt: Date, joinedMinutesAgo = 5) {
  const e = await db.waitlistEntry.create({
    data: {
      restaurantId, userId, partySize: 2, status: 'offered', priority: 0,
      joinedAt: new Date(Date.now() - joinedMinutesAgo * 60_000),
      offeredAt: new Date(Date.now() - 60_000), offerExpiresAt: expiresAt,
      offeredTableId: table.id, offeredTableNumber: table.number,
      // ⚠️ BE-006: در تولید `promoteNext` این را وقتی می‌نویسد که دستِ‌کم یک
      // کانالِ اعلان واقعاً dispatch شده باشد. این fixture مسیرِ `promoteNext`
      // را دور می‌زند، پس باید صریح بنویسدش — وگرنه مهمانی می‌سازد که هرگز
      // خبردار نشده، و آن‌وقت `expireOffers` به‌درستی `expired` می‌گذارد نه
      // `no_response`، و ادعای این تست دیگر آن چیزی نیست که قصدش بود.
      offerNotifiedAt: new Date(Date.now() - 60_000),
    },
    select: { id: true },
  });
  await db.table.update({ where: { id: table.id }, data: { state: 'reserved' } });
  return e.id;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ صف', clubPrefix: 'WL',
      timezone: 'Asia/Tehran', isOpen: true,
      // پذیرشِ آفر برایِ کاربرِ لاگین‌شده مسیرِ source='app' را می‌رود و به
      // گاردِ onlineGating می‌خورد؛ پنلِ زنده heartbeat تازه دارد.
      lastSeenAt: new Date(),
    },
    select: { id: true },
  });
  restaurantId = r.id;
  const u = await db.user.create({
    // ⚠️ پیشوندِ ۰۹۳۳ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
    data: { phone: fixturePhone('0933'), firstName: '[DEMO]', lastName: 'صف' },
    select: { id: true },
  });
  userId = u.id;
});

beforeEach(async () => {
  // heartbeat را تازه نگه دار (گاردِ onlineGating پنجره‌ی ۹۰ ثانیه‌ای دارد)
  await db.restaurant.update({ where: { id: restaurantId }, data: { lastSeenAt: new Date() } });
  await db.waitlistEntry.deleteMany({ where: { restaurantId } });
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`;
  await db.table.deleteMany({ where: { restaurantId } });
});

after(async () => {
  // کلیدهایِ idempotencyِ ساخته‌شده‌ی همین فایل (بلوکِ «بازپخش») — بدونِ این،
  // ردیف‌ها تا انقضایِ ۲۴ساعته در DBِ تست می‌مانند.
  await db.idempotencyKey.deleteMany({ where: { scope: 'waitlist-accept' } }).catch(() => {});
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('صف — پیوستن و ترتیب', () => {
  test('مهمانِ بدونِ حساب توکنِ دسترسی می‌گیرد و فقط hashش ذخیره می‌شود', async () => {
    await mkTable(1);
    const res = await joinWaitlist({
      restaurantId, partySize: 2, guest: { name: '[DEMO] مهمان', phone: fixturePhone('0933') },
    });
    assert.ok(res.guest_token, 'توکنِ خام باید یک‌بار برگردد');
    const row = await db.waitlistEntry.findUniqueOrThrow({
      where: { id: res.id }, select: { guestAccessTokenHash: true },
    });
    assert.ok(row.guestAccessTokenHash, 'hash باید ذخیره شود');
    assert.notEqual(row.guestAccessTokenHash, res.guest_token,
      'توکنِ خام هرگز نباید در دیتابیس بنشیند');
  });

  test('کاربرِ دارایِ حساب توکن نمی‌گیرد و دوبار نمی‌تواند بپیوندد', async () => {
    await mkTable(1);
    const first = await joinWaitlist({ restaurantId, partySize: 2, userId });
    assert.equal(first.guest_token, null, 'کاربرِ لاگین‌شده با JWT خودش احراز می‌شود');
    await assert.rejects(() => joinWaitlist({ restaurantId, partySize: 2, userId }),
      'ورودیِ فعالِ تکراری باید رد شود');
  });

  test('رستورانِ بسته پذیرش نمی‌کند', async () => {
    await db.restaurant.update({ where: { id: restaurantId }, data: { isOpen: false } });
    try {
      await assert.rejects(() => joinWaitlist({ restaurantId, partySize: 2, guest: { name: 'x' } }));
    } finally {
      await db.restaurant.update({ where: { id: restaurantId }, data: { isOpen: true } });
    }
  });

  test('موقعیتِ صف با اولویت مرتب می‌شود، نه فقط با زمانِ ورود', async () => {
    await mkTable(1, 'reserved');
    const early = await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 0, guestName: '[DEMO] زودتر',
              joinedAt: new Date(Date.now() - 30 * 60_000) },
      select: { id: true },
    });
    const vip = await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 5, guestName: '[DEMO] VIP',
              joinedAt: new Date() },
      select: { id: true },
    });
    assert.equal(await getPosition(vip.id), 1, 'VIP باید جلو بیفتد');
    assert.equal(await getPosition(early.id), 2);
  });
});

describe('صف — ارتقا و ادعایِ اتمیکِ میز', () => {
  test('نفرِ اول آفر می‌گیرد و میز reserved می‌شود', async () => {
    const t1 = await mkTable(1);
    const j = await joinWaitlist({ restaurantId, partySize: 2, userId });

    const r = await promoteNext(restaurantId);
    assert.equal(r.promoted, true);
    assert.equal(r.entryId, j.id);
    assert.equal(r.table, t1.number);
    assert.equal((await entryOf(j.id)).status, 'offered');
    assert.equal(await tableState(t1.id), 'reserved', 'میز باید قفل شود تا کسی دیگر نگیرد');
  });

  test('⚠️ آفر به VIP می‌رسد، نه به کسی که زودتر آمده', async () => {
    // ⚠️ این تست را جهش‌آزمایی لازم کرد، نه طراحیِ اولیه: جهشِ «حذفِ priority
    // از orderByِ promoteNext» اول **زنده ماند**، چون تستِ اولویتِ من فقط
    // getPosition را می‌سنجید و نه خودِ انتخابِ نفرِ بعدی. یعنی promoteNext
    // می‌توانست VIP را نادیده بگیرد و هیچ تستی نمی‌گرفتش — در حالی که کلِ
    // ارزشِ tierToPriority همین‌جاست.
    const t1 = await mkTable(1);
    const early = await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 0, guestName: '[DEMO] زودتر',
              joinedAt: new Date(Date.now() - 30 * 60_000) },
      select: { id: true },
    });
    const vip = await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 5, isVip: true,
              guestName: '[DEMO] VIP', joinedAt: new Date() },
      select: { id: true },
    });

    const r = await promoteNext(restaurantId);
    assert.equal(r.entryId, vip.id, 'میز باید به VIP برسد');
    assert.equal((await entryOf(early.id)).status, 'waiting', 'نفرِ زودتر باید در صف بماند');
    assert.equal(await tableState(t1.id), 'reserved');
  });

  test('بدونِ میزِ آزاد هیچ آفری داده نمی‌شود', async () => {
    await mkTable(1, 'occupied');
    await joinWaitlist({ restaurantId, partySize: 2, userId });
    assert.deepEqual(await promoteNext(restaurantId), { promoted: false });
  });

  test('میزِ کوچک‌تر از گروه انتخاب نمی‌شود', async () => {
    await mkTable(1, 'free', 2);            // ظرفیتِ ۲ برای گروهِ ۴ نفره
    await joinWaitlist({ restaurantId, partySize: 4, userId });
    assert.deepEqual(await promoteNext(restaurantId), { promoted: false });
  });

  test('⚠️ ارتقایِ همزمان یک میز را به دو نفر نمی‌دهد', async () => {
    // ⚠️ قفلِ ادعایِ باگِ H8 که در کامنتِ promoteNext مستند شده ولی تست نداشت:
    // «میز فقط اگر هنوز free است به reserved تغییر می‌کند (UPDATE شرطی)».
    const t1 = await mkTable(1);
    for (let i = 0; i < 4; i++) {
      await db.waitlistEntry.create({
        data: { restaurantId, partySize: 2, status: 'waiting', priority: 0,
                guestName: `[DEMO] نفرِ ${i}`, joinedAt: new Date(Date.now() - (10 - i) * 60_000) },
      });
    }

    // ⚠️ به‌روزشده ۲۰۲۶-۰۹-۰۵ — `allSettled` به‌جایِ `all`، و دلیلش یک
    // تغییرِ رفتاریِ **واقعی** است که باید صریح بماند، نه یک نرم‌کردنِ تست:
    //
    // از وقتی تراکنشِ `promoteNext` به Serializable ارتقا یافت (رفعِ
    // double-bookingِ میزِ ثانویه)، ابطالِ SSI با ۴۰۰۰۱ روی این مسیر یک
    // رفتارِ **عادی** است، نه خطا. `withSerializationRetry('waitlist', …)`
    // تا TX_MAX_RETRIES تلاش می‌کند، ولی ۴ فراخوانیِ کاملاً هم‌زمان رویِ
    // **یک** ردیفِ میز می‌تواند بودجه‌ی retry را تمام کند و آن‌وقت خطا به
    // فراخواننده می‌رسد. این در تولید مهار شده است: هر چهار فراخوانِ واقعی
    // از `tryPromoteNext` رد می‌شوند که خطا را می‌شمارد و لاگ می‌کند بی‌آنکه
    // کنشِ کاربر را بشکند، و جاروبِ هر ۲ دقیقه دوباره تلاش می‌کند. ضمناً
    // خودِ این بار در تولید ساختنی نیست: جاروبِ cron هر رستوران را با
    // `distinct` فقط **یک بار** صدا می‌زند.
    //
    // پس ادعایِ اصلیِ این تست (باگِ H8) دست‌نخورده می‌ماند — «یک میز به دو
    // نفر آفر نمی‌شود» — و فقط این اضافه می‌شود که یک ردشدنِ ناشی از
    // سریال‌سازی **مجاز** است. عمداً *هر* خطایی مجاز نیست: هر ردشدنی که
    // ۴۰۰۰۱/۴۰P۰۱/P۲۰۳۴ نباشد این تست را می‌شکند، وگرنه این تغییر می‌توانست
    // یک باگِ واقعیِ دیگر را هم بی‌صدا قورت بدهد.
    const settled = await Promise.allSettled(Array.from({ length: 4 }, () => promoteNext(restaurantId)));
    const rejected = settled.filter(s => s.status === 'rejected') as PromiseRejectedResult[];
    for (const r of rejected) {
      const msg = String((r.reason as Error)?.message ?? r.reason);
      const code = (r.reason as { code?: string })?.code;
      assert.ok(
        code === '40001' || code === '40P01' || code === 'P2034'
        || code === 'CONCURRENCY_RETRY' || /40001|40P01/.test(msg),
        `تنها ردشدنِ مجاز، تداخلِ سریال‌سازی است. این خطا چیزِ دیگری است: ${code ?? msg}`,
      );
    }
    assert.ok(
      rejected.length < 4,
      'هر چهار فراخوان با تداخل رد شدند — یعنی هیچ‌کس ارتقا نگرفت و مسیر عملاً ' +
      'زیرِ همزمانی مرده است، نه فقط شلوغ',
    );

    const results = settled
      .filter(s => s.status === 'fulfilled')
      .map(s => (s as PromiseFulfilledResult<Awaited<ReturnType<typeof promoteNext>>>).value);
    const ok = results.filter(x => x.promoted);
    assert.equal(ok.length, 1, `فقط یک نفر باید آفر بگیرد، نه ${ok.length}`);

    const offered = await db.waitlistEntry.count({ where: { restaurantId, status: 'offered' } });
    assert.equal(offered, 1, 'دقیقاً یک آفرِ زنده');
    assert.equal(await tableState(t1.id), 'reserved');
  });
});

describe('صف — رد کردن و خروج، میز را آزاد می‌کنند', () => {
  test('رد کردنِ آفر میز را آزاد و به نفرِ بعدی آفر می‌دهد', async () => {
    const t1 = await mkTable(1);
    const a = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);
    const next = await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 0,
              guestName: '[DEMO] نفرِ بعدی', joinedAt: new Date() },
      select: { id: true },
    });

    await declineOffer(a.id, 'customer', { callerUserId: userId });
    assert.equal((await entryOf(a.id)).status, 'declined');
    assert.equal((await entryOf(next.id)).status, 'offered', 'میز باید به نفرِ بعدی برسد');
    assert.equal(await tableState(t1.id), 'reserved', 'حالا مالِ نفرِ بعدی است');
  });

  test('رد کردنِ دوباره‌ی همان آفر رد می‌شود', async () => {
    await mkTable(1);
    const a = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);
    await declineOffer(a.id, 'customer', { callerUserId: userId });
    await assert.rejects(() => declineOffer(a.id, 'customer', { callerUserId: userId }));
  });

  test('خروج از صف در حالتِ آفر، میز را آزاد می‌کند', async () => {
    const t1 = await mkTable(1);
    const a = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);
    await leaveWaitlist(a.id, { callerUserId: userId });
    assert.equal((await entryOf(a.id)).status, 'cancelled');
    assert.equal(await tableState(t1.id), 'free', 'کسی در صف نیست، پس میز آزاد می‌ماند');
  });

  test('کاربرِ دیگر نمی‌تواند آفرِ من را رد کند (IDOR)', async () => {
    await mkTable(1);
    const a = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);
    const other = await db.user.create({
      data: { phone: fixturePhone('0933'), firstName: '[DEMO]', lastName: 'صف' }, select: { id: true },
    });
    try {
      await assert.rejects(() => declineOffer(a.id, 'customer', { callerUserId: other.id }));
      await assert.rejects(() => declineOffer(a.id, 'customer', {}), 'بدونِ احراز هم باید رد شود');
      assert.equal((await entryOf(a.id)).status, 'offered', 'آفر باید دست‌نخورده بماند');
    } finally {
      await db.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });
});

describe('صف — انقضایِ آفر (قفلِ باگِ رقابتِ رفع‌شده)', () => {
  test('آفرِ منقضی no_response می‌شود و میز آزاد می‌شود', async () => {
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() - 60_000));

    assert.equal((await expireOffers()).expired, 1);
    assert.equal((await entryOf(id)).status, 'no_response');
    assert.equal(await tableState(t1.id), 'free');
  });

  test('آفری که هنوز مهلت دارد دست نمی‌خورد', async () => {
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() + 10 * 60_000));
    assert.equal((await expireOffers()).expired, 0);
    assert.equal((await entryOf(id)).status, 'offered');
    assert.equal(await tableState(t1.id), 'reserved');
  });

  test('⚠️ اجرایِ همزمانِ cron یک آفر را دوبار منقضی نمی‌کند', async () => {
    // ⚠️ قفلِ اصلیِ باگِ رفع‌شده. پیش از رفع، `update`ِ بی‌قیدوشرط بود، پس هر
    // اجرای موازی «موفق» حساب می‌شد: هم شمارش دوباره می‌شد، هم میز دوباره
    // آزاد می‌شد (حتی اگر بینِ دو اجرا به نفرِ بعدی آفر شده باشد).
    //
    // این ادعا به زمان‌بندی وابسته نیست: هر ترتیبی که رخ دهد، مجموعِ
    // شمارش‌ها باید دقیقاً ۱ باشد — یا هر دو فهرست را می‌بینند و فقط یکی
    // گارد را رد می‌کند، یا دومی اصلاً چیزی در فهرست نمی‌بیند.
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() - 60_000));

    const counts = await Promise.all([expireOffers(), expireOffers(), expireOffers()]);
    const total = counts.reduce((a, b) => a + b.expired, 0);
    assert.equal(total, 1, `مجموعِ انقضاها باید ۱ باشد، نه ${total}`);
    assert.equal((await entryOf(id)).status, 'no_response');
  });

  test('⚠️ تصمیمِ صریحِ مشتری با cron بازنویسی نمی‌شود', async () => {
    // ⚠️ همان باگ از زاویه‌ی دوم: مشتری آفرِ منقضی‌شده را رد می‌کند در حالی که
    // cron همان را در فهرستِ خودش دارد. پیش از رفع، وضعیت از «declined» به
    // «no_response» بازنویسی می‌شد — یعنی داده‌ی رفتاریِ مشتری بی‌صدا گم می‌شد.
    //
    // ادعا به زمان‌بندی وابسته نیست: اگر decline موفق شود وضعیتِ نهایی باید
    // declined بماند؛ اگر cron زودتر برسد، خودِ decline رد می‌شود.
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() - 60_000));

    const cron = expireOffers();
    let declined = false;
    try { await declineOffer(id, 'customer', { callerUserId: userId }); declined = true; }
    catch { /* cron زودتر رسید — همان‌قدر درست */ }
    await cron;

    const final = (await entryOf(id)).status;
    assert.equal(final, declined ? 'declined' : 'no_response',
      declined ? 'رد کردنِ موفق نباید با no_response بازنویسی شود' : 'cron زودتر رسیده');
  });

  test('⚠️ پذیرشِ آفر با تایم‌زونِ رستوران کار می‌کند، نه تایم‌زونِ سرور', async () => {
    // ⚠️ باگِ رفع‌شده (§2p): تاریخ از `toISOString()` (UTC) و ساعت از
    // `toTimeString()` (محلیِ *سرور*) گرفته می‌شد، و createReservation هر دو را
    // ساعتِ دیواریِ **تایم‌زونِ رستوران** تفسیر می‌کند. روی سرورِ UTC با
    // رستورانِ تهران (UTC+03:30) اسلات ۳٫۵ ساعت عقب‌تر ساخته می‌شد و گاردِ
    // «زمان در گذشته است» همیشه شلیک می‌کرد — یعنی این قابلیت در تولید اصلاً
    // کار نمی‌کرد. این تست همان مسیر را کامل می‌رود.
    await mkTable(1);
    const j = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);

    const res = await acceptOffer(j.id, 'customer', { callerUserId: userId });
    assert.ok(res.reservation_code, 'کدِ رزرو باید برگردد');
    const row = await db.waitlistEntry.findUniqueOrThrow({
      where: { id: j.id }, select: { status: true, reservationCode: true, seatedAt: true },
    });
    assert.equal(row.status, 'accepted');
    assert.equal(row.reservationCode, res.reservation_code, 'کد باید روی ورودی ثبت شود');
    assert.ok(row.seatedAt);
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 1);
  });

  test('⚠️ آفرِ منقضی پذیرفته نمی‌شود و ورودی دست‌نخورده می‌ماند', async () => {
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() - 60_000));

    await assert.rejects(() => acceptOffer(id, 'customer', { callerUserId: userId }),
      'آفرِ منقضی نباید پذیرفته شود');
    assert.equal((await entryOf(id)).status, 'offered', 'ورودی نباید accepted شود');
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 0,
      'هیچ رزروی نباید ساخته شود');
  });

  test('⚠️ پذیرشِ همزمان فقط یک رزرو می‌سازد — و هر دو تماس همان کد را می‌گیرند', async () => {
    // ⚠️ چون ادعا حالا *پیش از* ساختِ رزرو و اتمیک است، دو درخواستِ همزمان
    // نمی‌توانند هر دو رزرو بسازند.
    //
    // ⚠️ قراردادِ این تست ۲۰۲۶-۰۹-۱۲ عوض شد، و دلیلش مهم است. نسخه‌ی قبلی
    // `ok === 1` را می‌سنجید — یعنی صریحاً **پین می‌کرد** که بازنده خطا
    // بگیرد. آن خطا `reservationExpired` بود («مهلتِ تأیید این رزرو گذشته
    // است») و در این لحظه **دروغ** است: رزرو همین حالا ساخته شده و مهمان
    // میز دارد. بدتر، `accept` تنها مسیری است که `reservation_code` را به
    // مهمان می‌دهد، پس آن خطا کد را برای همیشه می‌برد — کافی بود مهمان دوبار
    // روی «قبول» بزند.
    //
    // ناوریانتِ واقعی «یک نفر خطا بگیرد» نبود، «یک رزرو ساخته شود» بود. آن
    // را سخت‌تر از قبل می‌سنجیم، و علاوه‌اش قراردادِ تازه: هر دو تماس همان
    // یک کد را می‌گیرند.
    await mkTable(1);
    const j = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);

    const out = await Promise.allSettled([
      acceptOffer(j.id, 'customer', { callerUserId: userId }),
      acceptOffer(j.id, 'customer', { callerUserId: userId }),
    ]);
    assert.equal((await entryOf(j.id)).status, 'accepted');
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 1,
      'دقیقاً یک رزرو باید ساخته شود');

    const fulfilled = out.filter((o) => o.status === 'fulfilled');
    assert.equal(fulfilled.length, 2, 'هیچ‌کدام از دو تماس نباید خطای «مهلت گذشته» بگیرد');
    const codes = new Set(fulfilled.map((o) => (o as PromiseFulfilledResult<{ reservation_code?: string }>).value.reservation_code));
    assert.equal(codes.size, 1, 'هر دو باید همان یک کدِ رزرو را برگردانند');
    const [only] = [...codes];
    assert.ok(only, 'کدِ رزرو نباید خالی باشد — تنها جایی که مهمان آن را می‌گیرد همین بدنه است');
    const resv = await db.reservation.findFirst({ where: { restaurantId }, select: { code: true } });
    assert.equal(only, resv?.code, 'کدِ برگشتی باید کدِ همان رزروِ واقعی باشد');
  });

  test('⚠️ شکستِ ساختِ رزرو، ورودی و میز را دقیقاً به حالتِ قبل برمی‌گرداند', async () => {
    // ⚠️ این تست را جهش‌آزمایی لازم کرد: جهشِ «حذفِ مسیرِ بازگردانی» اول زنده
    // ماند، چون هیچ تستی createReservation را *پس از* ادعای موفق به شکست
    // نمی‌کشاند. اهرمِ قطعی: گروهِ بزرگ‌تر از MAX_PARTY_ONLINE (=۱۲) — ادعا
    // موفق می‌شود، بعد createReservation با partyTooLarge می‌افتد.
    //
    // بدونِ بازگردانی، ورودی روی `accepted` گیر می‌کرد بدونِ هیچ رزروی —
    // یعنی مهمان نه در صف بود نه رزرو داشت، و میزش هم برای همیشه قفل می‌ماند.
    const t1 = await db.table.create({
      data: { restaurantId, number: 1, capacity: 20, isActive: true, state: 'free' },
      select: { id: true, number: true },
    });
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId, userId, partySize: 13, status: 'offered', priority: 0,
        joinedAt: new Date(Date.now() - 5 * 60_000),
        offeredAt: new Date(), offerExpiresAt: new Date(Date.now() + 5 * 60_000),
        offeredTableId: t1.id, offeredTableNumber: t1.number,
      },
      select: { id: true },
    });
    await db.table.update({ where: { id: t1.id }, data: { state: 'reserved' } });

    await assert.rejects(() => acceptOffer(e.id, 'customer', { callerUserId: userId }));

    assert.equal((await entryOf(e.id)).status, 'offered',
      'ورودی باید به offered برگردد، نه روی accepted گیر کند');
    assert.equal(await tableState(t1.id), 'reserved',
      'میز باید همچنان مالِ همین آفر بماند — آزادکردنش همان نشتِ §2l را می‌سازد');
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 0);
  });

  test('میزی که آفرِ زنده دارد هرگز free نمی‌ماند', async () => {
    // ⚠️ پیامدِ جدی‌ترِ همان باگ (زنده مشاهده شد): میزی که تازه به نفرِ بعدی
    // آفر شده بود دوباره free می‌شد → همان میزِ فیزیکی می‌توانست به نفرِ دوم
    // هم آفر شود. این تست همان ناوردا را مستقیم می‌سنجد.
    const t1 = await mkTable(1);
    const first = await seedOffer(t1, new Date(Date.now() - 60_000));
    await db.waitlistEntry.create({
      data: { restaurantId, partySize: 2, status: 'waiting', priority: 0,
              guestName: '[DEMO] نفرِ بعدی', joinedAt: new Date() },
    });

    await expireOffers();

    const live = await db.waitlistEntry.findMany({
      where: { restaurantId, status: 'offered' }, select: { offeredTableId: true },
    });
    for (const l of live) {
      if (!l.offeredTableId) continue;
      assert.notEqual(await tableState(l.offeredTableId), 'free',
        'ورودیِ با آفرِ زنده نباید میزی داشته باشد که free علامت خورده');
    }
    assert.equal((await entryOf(first)).status, 'no_response');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  پذیرشِ آفر — بازپخش (replay) و idempotency
//
//  ⚠️ باگی که این بلوک از آن زاده شد (۲۰۲۶-۰۹-۱۱): `accept` یک **رزروِ واقعی**
//  می‌سازد و تنها جایی است که `reservation_code` را به مهمان می‌دهد — ولی نه
//  `Idempotency-Key` می‌گرفت و نه `acceptOffer` بازپخش را می‌شناخت. پس یک
//  retryِ شبکه‌ای یا دوبار زدنِ دکمه این را می‌داد:
//    رزرو **ساخته شده** · مهمان یک ۴۲۲ می‌بیند · بدنه‌ی موفقیت (تنها حاملِ
//    کدِ رزرو) برای همیشه از دست رفته.
//
//  دو لایه‌ی مستقل رفعش می‌کنند و هر دو اینجا جدا سنجیده می‌شوند:
//   ۱. لایه‌ی lib — ورودیِ `accepted` **با** کدِ رزرو همان پاسخِ موفق را
//      برمی‌گرداند (بازپخشِ واقعی). بدونِ کد نه: آن حالتِ **گذرای** یک پذیرشِ
//      در حالِ انجام است و «موفق» گفتنش جعلِ موفقیت است.
//   ۲. لایه‌ی HTTP — `withIdempotency` با scopeِ `waitlist-accept`، همان
//      قراردادِ `POST /reservations`.
// ═══════════════════════════════════════════════════════════════════════
describe('پذیرشِ آفر — بازپخش و idempotency', () => {
  test('🔴 پذیرشِ دوباره‌ی همان ورودی، همان پاسخِ موفق را می‌دهد نه ۴۲۲', async () => {
    await mkTable(1);
    const j = await joinWaitlist({ restaurantId, partySize: 2, userId });
    await promoteNext(restaurantId);

    const first = await acceptOffer(j.id, 'customer', { callerUserId: userId });
    assert.ok(first.reservation_code, 'کنترلِ مثبت: پذیرشِ اول باید کد بدهد');

    const replay = await acceptOffer(j.id, 'customer', { callerUserId: userId });
    assert.deepEqual(replay, first, 'بازپخش باید دقیقاً همان بدنه باشد');

    // ⚠️ ادعای واقعیِ یکپارچگی: بازپخش نباید رزروِ دوم بسازد.
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 1,
      'بازپخش نباید رزروِ دوم بسازد');
  });

  test('⚠️ کنترلِ منفی — `accepted` بدونِ کدِ رزرو هنوز رد می‌شود', async () => {
    // این مرزِ دقیقِ رفع است. `accepted` + کدِ خالی حالتِ **گذرای** هر پذیرشِ
    // موفق است (پنجره‌ای که createReservation در آن می‌نشیند). اگر آن هم
    // «موفق» گزارش شود، به مهمانی که رزروش هنوز ساخته نشده کدِ خالی می‌دهیم
    // و ادعای رزروی می‌کنیم که وجود ندارد — همان جعلِ موفقیتِ ممنوع.
    const t1 = await mkTable(1);
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId, userId, partySize: 2, status: 'accepted', priority: 0,
        joinedAt: new Date(Date.now() - 5 * 60_000), respondedAt: new Date(), seatedAt: new Date(),
        offeredTableId: t1.id, offeredTableNumber: t1.number, reservationCode: null,
      },
      select: { id: true },
    });

    await assert.rejects(
      () => acceptOffer(e.id, 'customer', { callerUserId: userId }),
      // ماچرِ واقعی، نه رشته: هویتِ شکست باید سنجیده شود، وگرنه **هر** خطایی
      // (حتی یک TypeErrorِ بی‌ربط) تست را سبز نگه می‌دارد.
      (err: any) => {
        assert.equal(err?.code, 'VALIDATION',
          `باید همان ۴۲۲ِ «آفری برای پذیرش وجود ندارد» باشد — گرفت: ${err?.code}`);
        assert.equal(err?.status, 422);
        return true;
      },
      'پذیرشِ ورودیِ accepted بدونِ کد نباید «موفق» گزارش شود',
    );
    assert.equal(await db.reservation.count({ where: { restaurantId } }), 0);
  });

  test('🔴 روت: همان Idempotency-Key دوبار → همان بدنه، حتی وقتی lib دیگر موفق نمی‌شود', async () => {
    // ⚠️ چرا ادعا این شکل را دارد: بعد از پذیرشِ اول، ورودی `accepted` با کد
    // است و لایه‌ی ۱ هم همان بدنه را می‌دهد — یعنی یک تستِ ساده‌ی «دوبار
    // بفرست، بدنه یکی است» حتی با **حذفِ کاملِ** withIdempotency سبز می‌ماند.
    // پس بینِ دو فراخوان، ورودی عمداً به وضعیتی برده می‌شود که لایه‌ی ۱ در
    // آن throw می‌کند. اگر پاسخِ دوم باز هم همان بدنه باشد، تنها توضیحش کشِ
    // idempotency است.
    await mkTable(1);
    const j = await joinWaitlist({
      restaurantId, partySize: 2, guest: { name: '[DEMO] مهمانِ بازپخش' },
    });
    assert.ok(j.guest_token, 'کنترلِ مثبت: ورودیِ مهمان باید توکن بگیرد');
    await promoteNext(restaurantId);

    const key = randomUUID();
    const call = () => acceptRoute.POST(
      new Request(`http://x/api/v1/waitlist/${j.id}/accept?token=${j.guest_token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': testIp(), 'idempotency-key': key },
      }),
      { params: Promise.resolve({ id: j.id }) },
    );

    const r1 = await call();
    assert.equal(r1.status, 200, 'پذیرشِ اول باید موفق باشد');
    const b1 = await r1.text();
    assert.match(b1, /reservation_code/, 'کنترلِ مثبت: بدنه باید کدِ رزرو داشته باشد');

    // لایه‌ی ۱ را عمداً از کار بینداز: حالا هر مسیرِ غیرکش‌شده‌ای throw می‌کند.
    await db.waitlistEntry.update({ where: { id: j.id }, data: { status: 'no_response' } });

    const r2 = await call();
    assert.equal(r2.status, 200, 'بازپخشِ همان کلید باید همان ۲۰۰ را بدهد');
    // ⚠️ چرا deepEqual و نه مقایسه‌ی رشته‌ای: پاسخِ کش‌شده در ستونِ `response`
    // از نوعِ **jsonb** ذخیره می‌شود و jsonb ترتیبِ کلیدها را نگه نمی‌دارد
    // (کلیدِ کوتاه‌تر اول). پس «بایت‌به‌بایت» با این مخزن اصلاً شدنی نیست؛
    // همان قراردادی که `idempotency.integration.test.mts:109` هم دارد.
    assert.deepEqual(JSON.parse(await r2.text()), JSON.parse(b1),
      'بازپخش باید دقیقاً همان محتوا را بدهد');

    assert.equal(await db.reservation.count({ where: { restaurantId } }), 1,
      'بازپخش نباید رزروِ دوم بسازد');
  });

  test('⚠️ کنترلِ منفی — بدونِ هدرِ Idempotency-Key هیچ کشی درکار نیست', async () => {
    // بدونِ این، یک پیاده‌سازیِ «همیشه کش کن» هم تستِ بالا را پاس می‌کرد و
    // رفتارِ ثبت‌شده‌ی lib/idempotency.ts (نبودِ کلید = بدونِ محافظت) بی‌صدا
    // عوض می‌شد.
    await mkTable(1);
    const j = await joinWaitlist({
      restaurantId, partySize: 2, guest: { name: '[DEMO] مهمانِ بی‌کلید' },
    });
    await promoteNext(restaurantId);

    const res = await acceptRoute.POST(
      new Request(`http://x/api/v1/waitlist/${j.id}/accept?token=${j.guest_token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ id: j.id }) },
    );
    assert.equal(res.status, 200);

    await db.waitlistEntry.update({ where: { id: j.id }, data: { status: 'no_response' } });
    const again = await acceptRoute.POST(
      new Request(`http://x/api/v1/waitlist/${j.id}/accept?token=${j.guest_token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ id: j.id }) },
    );
    assert.notEqual(again.status, 200, 'بدونِ کلید نباید بازپخشی درکار باشد');
  });
});
