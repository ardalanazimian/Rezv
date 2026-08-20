import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import {
  joinWaitlist, promoteNext, declineOffer, leaveWaitlist, expireOffers, getPosition,
} from '../src/lib/waitlist.ts';
import { fixturePhone } from './_phone.helper.mts';

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

async function mkTable(number: number, state = 'free', capacity = 4) {
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
  await db.waitlistEntry.deleteMany({ where: { restaurantId } });
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`;
  await db.table.deleteMany({ where: { restaurantId } });
});

after(async () => {
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

    const results = await Promise.all(Array.from({ length: 4 }, () => promoteNext(restaurantId)));
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

    assert.equal(await expireOffers(), 1);
    assert.equal((await entryOf(id)).status, 'no_response');
    assert.equal(await tableState(t1.id), 'free');
  });

  test('آفری که هنوز مهلت دارد دست نمی‌خورد', async () => {
    const t1 = await mkTable(1);
    const id = await seedOffer(t1, new Date(Date.now() + 10 * 60_000));
    assert.equal(await expireOffers(), 0);
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
    const total = counts.reduce((a, b) => a + b, 0);
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
