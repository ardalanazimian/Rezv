import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { redis } from '../src/lib/redis.ts';
import { autoMarkRunningLate, autoMarkNoShow, autoComplete } from '../src/lib/lifecycle.ts';
import { expireStaleHolds } from '../src/lib/reservation-lifecycle-ops.ts';
import { availabilityKey } from '../src/lib/availability-cache.ts';
import { dateKeyInTz } from '../src/lib/hours.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  چرخه‌ی حیاتِ خودکار (cron) — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `tests/lifecycle.test.mts` فقط جدولِ *خالصِ*
//  `canTransition` را می‌سنجید. چهار تابعی که واقعاً رزروها را به وضعیتِ
//  پایانی می‌برند — و همگی از `/maintenance/lifecycle` هر چند دقیقه اجرا
//  می‌شوند — **هیچ پوششی نداشتند**:
//
//    expireStaleHolds  → هولدِ منقضی، میز را آزاد می‌کند
//    autoMarkRunningLate → confirmed/auto_confirmed/preparing → running_late
//    autoMarkNoShow      → running_late → no_show (بعد از lateGraceMinutes)
//    autoComplete        → seated/dining → completed
//
//  اگر هرکدام بی‌صدا بشکند، هیچ تستی نمی‌گیردش ولی اثرش مستقیم است:
//   • هولدی که منقضی نشود، میز را برای همیشه در آن سانس نگه می‌دارد.
//   • no_showی که ثبت نشود یعنی مدلِ no-show و آمارِ CRM روی دادهٔ ناقص
//     کار می‌کنند — دقیقاً همان «گزارشِ عملکردِ اندازه‌نگرفته» که
//     docs/ML_CONTRACT.md منع می‌کند.
//   • completedی که ثبت نشود یعنی اقتصاد/وفاداریِ مشتری هرگز شلیک نمی‌شود.
//
//  این تست‌ها عمداً از *خودِ* توابعِ تولید عبور می‌کنند و وضعیت را دستی
//  UPDATE نمی‌کنند؛ وگرنه فقط خودشان را می‌سنجیدند.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `lc-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';
let tenantId: string, restaurantId: string, otherRestaurantId: string;
let tableId: string, otherTableId: string, userId: string;
let codeSeq = 0;

const nextCode = () => `LC${String(++codeSeq).padStart(3, '0')}${randomUUID().slice(0, 3).toUpperCase()}`;

/**
 * رزروِ خام با وضعیت و زمانِ دلخواه.
 *
 * ⚠️ عمداً با SQL خام و نه از راهِ createReservation: می‌خواهیم *دقیقاً* یک
 * وضعیتِ اولیه‌ی مشخص بسازیم (مثلاً running_late در گذشته) تا رفتارِ cron را
 * جدا بسنجیم. ساختِ رزرو مسیرِ خودش را دارد و اینجا موضوعِ تست نیست.
 */
async function mkReservation(opts: {
  status: string; minutesAgo: number; durationMin?: number;
  restaurant?: string; table?: string; holdExpiresAt?: Date | null;
}): Promise<{ id: string; slotStart: Date }> {
  const dur = opts.durationMin ?? 90;
  const slotStart = new Date(Date.now() - opts.minutesAgo * 60_000);
  const slotEnd = new Date(slotStart.getTime() + dur * 60_000);
  const id = randomUUID();
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, table_id, user_id, party_size, slot_start, slot_end,
       duration_minutes, block_buffer_minutes, status, source, hold_expires_at, created_at)
    VALUES
      (${id}::uuid, ${nextCode()}, ${opts.restaurant ?? restaurantId}::uuid,
       ${opts.table ?? tableId}::uuid, ${userId}::uuid, 2,
       ${slotStart}, ${slotEnd}, ${dur}, 15,
       CAST(${opts.status}::text AS "public"."reservation_status"), 'app',
       ${opts.holdExpiresAt ?? null}, ${new Date(slotStart.getTime() - 86_400_000)})
  `;
  return { id, slotStart };
}

const statusOf = async (id: string) =>
  (await db.reservation.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

const eventsOf = (id: string) =>
  db.reservationEvent.findMany({ where: { reservationId: id }, orderBy: { createdAt: 'asc' } });

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-main`, name: '[DEMO] رستورانِ چرخه‌ی حیات',
      clubPrefix: 'LC', timezone: TZ, isOpen: true, lateGraceMinutes: 15,
    },
    select: { id: true },
  });
  restaurantId = r.id;
  const r2 = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-other`, name: '[DEMO] رستورانِ همسایه',
      clubPrefix: 'LD', timezone: TZ, isOpen: true, lateGraceMinutes: 15,
    },
    select: { id: true },
  });
  otherRestaurantId = r2.id;

  const tb = await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true }, select: { id: true } });
  tableId = tb.id;
  const tb2 = await db.table.create({
    data: { restaurantId: otherRestaurantId, number: 1, capacity: 4, isActive: true }, select: { id: true },
  });
  otherTableId = tb2.id;

  const u = await db.user.create({
    // ⚠️ پیشوندِ ۰۹۳۵ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
    data: { phone: fixturePhone('0935'), firstName: '[DEMO]', lastName: 'چرخه' },
    select: { id: true },
  });
  userId = u.id;
});

beforeEach(async () => {
  // هر تست از صفر شروع می‌شود؛ وگرنه رزروی که تستِ قبلی ساخته در شمارشِ
  // بازگشتیِ تستِ بعدی می‌آید و ادعاهای عددی بی‌معنا می‌شوند.
  const ids = [restaurantId, otherRestaurantId];
  await db.$executeRaw`
    DELETE FROM reservation_events WHERE reservation_id IN
      (SELECT id FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[]))`;
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[])`;
});

after(async () => {
  const ids = [restaurantId, otherRestaurantId];
  await db.$executeRaw`
    DELETE FROM reservation_events WHERE reservation_id IN
      (SELECT id FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[]))`.catch(() => 0);
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[])`.catch(() => 0);
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('چرخه‌ی حیاتِ خودکار — انقضای هولد (آزادسازیِ میز)', () => {
  test('هولدِ منقضی expired می‌شود و رویدادِ audit می‌گیرد', async () => {
    const { id } = await mkReservation({
      status: 'pending', minutesAgo: -120,             // سانس در *آینده*
      holdExpiresAt: new Date(Date.now() - 60_000),    // ولی مهلتِ هولد گذشته
    });

    assert.equal(await expireStaleHolds(), 1, 'باید دقیقاً یک هولد منقضی شود');
    assert.equal(await statusOf(id), 'expired');

    // ⚠️ ادعای audit مهم است: کلِ دلیلِ وجودِ این تابع (به‌جای updateMany)
    // این بود که از state machine عبور کند تا رویداد ثبت شود.
    const ev = await eventsOf(id);
    assert.equal(ev.length, 1, 'باید دقیقاً یک رویداد ثبت شود');
    assert.equal(ev[0].fromStatus, 'pending');
    assert.equal(ev[0].toStatus, 'expired');
    assert.equal(ev[0].isAutomatic, true, 'باید به‌عنوانِ اقدامِ خودکار ثبت شود، نه دستی');
    assert.equal(ev[0].actor, 'cron');
  });

  test('هولدی که هنوز مهلت دارد دست نمی‌خورد', async () => {
    // کنترلِ منفی: بدونِ این، تابعی که *همه* را expired کند هم سبز می‌شد.
    const { id } = await mkReservation({
      status: 'pending', minutesAgo: -120,
      holdExpiresAt: new Date(Date.now() + 10 * 60_000),
    });
    assert.equal(await expireStaleHolds(), 0);
    assert.equal(await statusOf(id), 'pending');
    assert.equal((await eventsOf(id)).length, 0, 'رزروِ دست‌نخورده نباید رویداد بگیرد');
  });

  test('کشِ availability پس از آزادسازیِ میز باطل می‌شود', async () => {
    // ⚠️ چرا این ادعا: میز *در دیتابیس* آزاد می‌شود ولی اگر کش باطل نشود،
    // مشتری همچنان «تکمیل» می‌بیند تا انقضای TTL — یعنی درآمدِ ازدست‌رفته
    // با وجودِ میزِ خالی.
    //
    // ⚠️ نکته‌ی جهش‌آزمایی (جهش‌آزمایی ادعای اولِ من را اصلاح کرد): این
    // تضمین را **دو لایه‌ی افزونه** می‌دهند — یکی در `transitionReservation`
    // (lifecycle.ts) و یکی در خودِ `expireStaleHolds`. پس حذفِ *هرکدام
    // به‌تنهایی* این تست را نمی‌اندازد و نباید بیندازد؛ افزونگی عمدی است و
    // در کامنتِ خودِ expireStaleHolds هم توضیح داده شده. حذفِ **هم‌زمانِ هر
    // دو** تست را می‌اندازد (تأیید شد). یعنی این تست عمداً *نتیجه* را قفل
    // می‌کند نه یک خطِ خاص — و این درست‌ترین چیزی است که می‌شود قفل کرد.
    const { id, slotStart } = await mkReservation({
      status: 'pending', minutesAgo: -180,
      holdExpiresAt: new Date(Date.now() - 60_000),
    });
    const dateKey = dateKeyInTz(slotStart, TZ);
    const key = availabilityKey(restaurantId, dateKey, 2);
    await redis.set(key, JSON.stringify({ stale: true }), 'EX', 300);
    assert.equal(await redis.exists(key), 1, 'پیش‌شرط: کلید باید ست شده باشد');

    await expireStaleHolds();
    assert.equal(await statusOf(id), 'expired', 'پیش‌شرط: انتقال باید انجام شده باشد');
    assert.equal(await redis.exists(key), 0, 'کشِ همان (رستوران، تاریخ) باید پاک شود');
  });

  test('رزروی که بینِ خواندن و اجرا کنسل شده، کلِ اجرا را نمی‌شکند', async () => {
    // ⚠️ این دقیقاً همان چیزی است که کامنتِ خودِ تابع ادعا می‌کند («انتقالِ
    // نامعتبر امن رد می‌شود، نه کرش»). ادعای رفتاری بدونِ تست بود.
    // cancelled یک وضعیتِ پایانی است، پس cancelled→expired نامعتبر است.
    const bad = await mkReservation({
      status: 'cancelled', minutesAgo: -120, holdExpiresAt: new Date(Date.now() - 60_000),
    });
    const good = await mkReservation({
      status: 'pending', minutesAgo: -120, holdExpiresAt: new Date(Date.now() - 60_000),
      table: otherTableId, restaurant: otherRestaurantId,
    });

    // cancelled اصلاً در کوئری نمی‌آید (status='pending')؛ این تست تضمین
    // می‌کند وجودش در دیتابیس مسیر را خراب نمی‌کند و ردیفِ سالم پردازش می‌شود.
    assert.equal(await expireStaleHolds(), 1);
    assert.equal(await statusOf(good.id), 'expired');
    assert.equal(await statusOf(bad.id), 'cancelled', 'رزروِ کنسل‌شده نباید دست بخورد');
  });

  test('expireStaleHolds سراسری است و همه‌ی رستوران‌ها را پوشش می‌دهد', async () => {
    // این تابع عمداً restaurantId نمی‌گیرد (یک cronِ سراسری). اگر روزی
    // کسی محدودش کند به یک رستوران، این تست می‌افتد.
    const a = await mkReservation({ status: 'pending', minutesAgo: -120, holdExpiresAt: new Date(Date.now() - 60_000) });
    const b = await mkReservation({
      status: 'pending', minutesAgo: -120, holdExpiresAt: new Date(Date.now() - 60_000),
      restaurant: otherRestaurantId, table: otherTableId,
    });
    assert.equal(await expireStaleHolds(), 2);
    assert.equal(await statusOf(a.id), 'expired');
    assert.equal(await statusOf(b.id), 'expired');
  });
});

describe('چرخه‌ی حیاتِ خودکار — مسیرِ دو مرحله‌ایِ عدمِ حضور', () => {
  test('confirmed → running_late → no_show، و نه میان‌بر', async () => {
    // ⚠️ چرا دو مرحله‌ای بودنش مهم است: مرحله‌ی running_late همان جایی است
    // که به مهمان اطلاع داده می‌شود دیر کرده. اگر cron مستقیم no_show کند،
    // مهمان بدونِ هیچ هشداری «غایب» ثبت می‌شود.
    const { id } = await mkReservation({ status: 'confirmed', minutesAgo: 60 });

    assert.equal(await autoMarkNoShow(restaurantId), 0,
      'رزروِ confirmed نباید مستقیم no_show شود — اول باید running_late شود');
    assert.equal(await statusOf(id), 'confirmed');

    assert.equal(await autoMarkRunningLate(restaurantId), 1);
    assert.equal(await statusOf(id), 'running_late');

    assert.equal(await autoMarkNoShow(restaurantId), 1);
    assert.equal(await statusOf(id), 'no_show');

    const ev = await eventsOf(id);
    assert.deepEqual(ev.map(e => `${e.fromStatus}→${e.toStatus}`),
      ['confirmed→running_late', 'running_late→no_show'],
      'هر دو مرحله باید در audit دیده شوند');
  });

  test('auto_confirmed و preparing هم وارد running_late می‌شوند', async () => {
    // preparing در ACTIVE_RESERVATION_STATUSES است (میز را اشغال می‌کند)،
    // پس اگر از این مسیر جا بماند هرگز به وضعیتِ پایانی نمی‌رسد.
    const a = await mkReservation({ status: 'auto_confirmed', minutesAgo: 60 });
    const b = await mkReservation({ status: 'preparing', minutesAgo: 60, table: otherTableId, restaurant: otherRestaurantId });

    assert.equal(await autoMarkRunningLate(restaurantId), 1);
    assert.equal(await statusOf(a.id), 'running_late');
    assert.equal(await autoMarkRunningLate(otherRestaurantId), 1);
    assert.equal(await statusOf(b.id), 'running_late');
  });

  test('مهلتِ تأخیر رعایت می‌شود: زیرِ grace هنوز no_show نیست', async () => {
    // lateGraceMinutes = ۱۵. رزروی که ۵ دقیقه پیش شروع شده هنوز مهلت دارد.
    const { id } = await mkReservation({ status: 'running_late', minutesAgo: 5 });
    assert.equal(await autoMarkNoShow(restaurantId), 0, 'زیرِ مهلت نباید no_show شود');
    assert.equal(await statusOf(id), 'running_late');

    // و رزروی که ۲۰ دقیقه پیش شروع شده، شده.
    const late = await mkReservation({ status: 'running_late', minutesAgo: 20, table: otherTableId, restaurant: otherRestaurantId });
    assert.equal(await autoMarkNoShow(otherRestaurantId), 1);
    assert.equal(await statusOf(late.id), 'no_show');
  });

  test('مهلتِ سفارشیِ رستوران واقعاً خوانده می‌شود (نه ثابتِ ۱۵)', async () => {
    // ⚠️ اگر کسی grace را هاردکد کند، همه‌ی تست‌های بالا همچنان سبز می‌مانند.
    await db.restaurant.update({ where: { id: otherRestaurantId }, data: { lateGraceMinutes: 120 } });
    try {
      const { id } = await mkReservation({
        status: 'running_late', minutesAgo: 60, table: otherTableId, restaurant: otherRestaurantId,
      });
      assert.equal(await autoMarkNoShow(otherRestaurantId), 0,
        'با مهلتِ ۱۲۰ دقیقه، تأخیرِ ۶۰ دقیقه‌ای نباید no_show شود');
      assert.equal(await statusOf(id), 'running_late');
    } finally {
      await db.restaurant.update({ where: { id: otherRestaurantId }, data: { lateGraceMinutes: 15 } });
    }
  });

  test('رزروِ آینده دست نمی‌خورد', async () => {
    const { id } = await mkReservation({ status: 'confirmed', minutesAgo: -60 });
    assert.equal(await autoMarkRunningLate(restaurantId), 0);
    assert.equal(await statusOf(id), 'confirmed');
  });

  test('مهمانی که رسیده (checked_in) هرگز no_show نمی‌شود', async () => {
    // ⚠️ ادعای مهم: checked_in یعنی مهمان *واقعاً آمده*. no_show کردنش هم
    // به آمارِ رستوران دروغ می‌گوید هم به اعتبارِ مشتری آسیب می‌زند.
    const { id } = await mkReservation({ status: 'checked_in', minutesAgo: 120 });
    assert.equal(await autoMarkRunningLate(restaurantId), 0);
    assert.equal(await autoMarkNoShow(restaurantId), 0);
    assert.equal(await statusOf(id), 'checked_in');
  });

  test('جداسازیِ رستوران: cronِ رستورانِ A رزروِ B را دست نمی‌زند', async () => {
    const mine = await mkReservation({ status: 'running_late', minutesAgo: 60 });
    const theirs = await mkReservation({
      status: 'running_late', minutesAgo: 60, table: otherTableId, restaurant: otherRestaurantId,
    });
    assert.equal(await autoMarkNoShow(restaurantId), 1, 'فقط رزروِ خودش');
    assert.equal(await statusOf(mine.id), 'no_show');
    assert.equal(await statusOf(theirs.id), 'running_late', 'رزروِ رستورانِ دیگر نباید عوض شود');
  });
});

describe('چرخه‌ی حیاتِ خودکار — تکمیلِ خودکار', () => {
  test('seated و dining پس از پایانِ سانس completed می‌شوند', async () => {
    const a = await mkReservation({ status: 'seated', minutesAgo: 200, durationMin: 90 });
    const b = await mkReservation({
      status: 'dining', minutesAgo: 200, durationMin: 90, table: otherTableId, restaurant: otherRestaurantId,
    });

    assert.equal(await autoComplete(restaurantId), 1);
    assert.equal(await statusOf(a.id), 'completed');
    assert.equal(await autoComplete(otherRestaurantId), 1);
    assert.equal(await statusOf(b.id), 'completed');
  });

  test('مهمانی که هنوز سرِ میز است completed نمی‌شود', async () => {
    // slotEnd هنوز نگذشته: شروع ۳۰ دقیقه پیش، مدت ۹۰ دقیقه.
    const { id } = await mkReservation({ status: 'seated', minutesAgo: 30, durationMin: 90 });
    assert.equal(await autoComplete(restaurantId), 0,
      'معیار باید slotEnd باشد نه slotStart — وگرنه مهمانِ سرِ میز completed می‌شود');
    assert.equal(await statusOf(id), 'seated');
  });

  test('تکمیل idempotent است: اجرای دوباره چیزی را دوباره نمی‌شمارد', async () => {
    // ⚠️ cron هر چند دقیقه اجرا می‌شود. اگر اجرای دوم هم بشمارد، هم آمار
    // دروغ می‌گوید هم رویدادِ تکراری در audit ثبت می‌شود.
    await mkReservation({ status: 'seated', minutesAgo: 200, durationMin: 90 });
    assert.equal(await autoComplete(restaurantId), 1);
    assert.equal(await autoComplete(restaurantId), 0, 'اجرای دوم باید صفر باشد');
  });
});
