import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { fetchTrainingRows } from '../src/lib/no-show-model.ts';
import { loadPriorHistory } from '../src/lib/no-show-features.ts';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۴ — برابریِ ویژگی بینِ آموزش و سرو
//
//  این تست از یک باگِ واقعی زاده شد: «سابقه‌ی مشتری» دو پیاده‌سازیِ مستقل
//  داشت که با هم فرق داشتند —
//    • آموزش: فقط همین رستوران، و `dining` را جزءِ حضور می‌شمرد
//    • سرو:   کلِ پلتفرم، و `dining` را نمی‌شمرد
//  یعنی مدل ورودی‌ای می‌دید که هرگز رویش آموزش ندیده بود.
//
//  ⚠️ چرا این تست کوئریِ *واقعیِ* آموزش را صدا می‌زند و بازنویسی‌اش نمی‌کند:
//  اگر منطقِ آموزش را در تست دوباره می‌نوشتیم، تست فقط خودش را می‌سنجید و
//  دقیقاً همین اختلاف باز هم نامرئی می‌ماند. پس fetchTrainingRows عمداً
//  export شده و همان اجرا می‌شود.
//
//  سناریو طوری چیده شده که *هر دو نیمه‌ی* باگ را جدا‌گانه لو بدهد:
//    • یک رزروِ `dining` در همین رستوران  → نیمه‌ی «وضعیتِ جاافتاده»
//    • دو رزروِ حل‌شده در رستورانِ دیگر    → نیمه‌ی «دامنه‌ی رستوران»
//  با کدِ قدیمیِ سرو، priorTotal برابرِ ۴ می‌شد به‌جای ۳ و ۲ به‌جای ۱.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `fp-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantA: string, restaurantB: string, userId: string;

/** رزروِ حل‌شده‌ی گذشته با وضعیت و رستورانِ دلخواه. */
async function pastReservation(opts: {
  restaurantId: string; status: string; daysAgo: number;
}): Promise<void> {
  const slot = new Date(Date.now() - opts.daysAgo * 86_400_000);
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, user_id, party_size, slot_start, slot_end,
       status, source, created_at)
    VALUES
      (${randomUUID()}::uuid, ${'RZ' + randomUUID().slice(0, 7).toUpperCase()},
       ${opts.restaurantId}::uuid, ${userId}::uuid, 2,
       ${slot}, ${new Date(slot.getTime() + 90 * 60_000)},
       CAST(${opts.status}::text AS "public"."reservation_status"), 'app',
       ${new Date(slot.getTime() - 86_400_000)})
  `;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const a = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-a`, name: '[DEMO] رستورانِ الف', timezone: 'Asia/Tehran',
            clubPrefix: 'FA', isOpen: true },
    select: { id: true },
  });
  const b = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-b`, name: '[DEMO] رستورانِ ب', timezone: 'Asia/Tehran',
            clubPrefix: 'FB', isOpen: true },
    select: { id: true },
  });
  restaurantA = a.id; restaurantB = b.id;
  const u = await db.user.create({
    data: { phone: `0938${String(Date.now()).slice(-7)}`.slice(0, 11), firstName: '[DEMO]', lastName: 'برابری' },
    select: { id: true },
  });
  userId = u.id;

  // سابقه در رستورانِ الف: ۱ عدمِ حضور + ۲ حضور (یکی‌شان dining)
  await pastReservation({ restaurantId: restaurantA, status: 'no_show',   daysAgo: 30 });
  await pastReservation({ restaurantId: restaurantA, status: 'completed', daysAgo: 25 });
  await pastReservation({ restaurantId: restaurantA, status: 'dining',    daysAgo: 20 });
  // سابقه در رستورانِ ب — نباید در محاسبه‌ی الف دیده شود
  await pastReservation({ restaurantId: restaurantB, status: 'no_show',   daysAgo: 15 });
  await pastReservation({ restaurantId: restaurantB, status: 'completed', daysAgo: 10 });
});

after(async () => {
  const ids = [restaurantA, restaurantB];
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[])`.catch(() => 0);
  await db.restaurant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('فازِ ۴ — آموزش و سرو یک ویژگی می‌سازند', () => {
  test('مسیرِ سرو: فقط سابقه‌ی همین رستوران، و dining حضور حساب می‌شود', async () => {
    const h = await loadPriorHistory({ restaurantId: restaurantA, userId, asOf: new Date() });
    assert.equal(h.priorNoShows, 1, 'فقط عدمِ حضورِ رستورانِ الف');
    assert.equal(h.priorCompletions, 2, 'completed + dining — اگر dining شمرده نشود ۱ می‌شود');
    assert.equal(h.priorTotal, 3);
  });

  test('کنترلِ منفی: سابقه‌ی رستورانِ ب نشت نمی‌کند', async () => {
    // اگر فیلترِ رستوران کار نکند، این ۵ می‌شود نه ۳ — یعنی همان باگِ اصلی.
    const a = await loadPriorHistory({ restaurantId: restaurantA, userId, asOf: new Date() });
    const b = await loadPriorHistory({ restaurantId: restaurantB, userId, asOf: new Date() });
    assert.equal(a.priorTotal, 3);
    assert.equal(b.priorTotal, 2, 'رستورانِ ب سابقه‌ی خودش را دارد، نه سابقه‌ی الف');
  });

  test('مهمانِ بدونِ حساب سابقه ندارد (معادلِ COALESCE در آموزش)', async () => {
    const h = await loadPriorHistory({ restaurantId: restaurantA, userId: null, asOf: new Date() });
    assert.deepEqual(h, { priorNoShows: 0, priorCompletions: 0, priorTotal: 0 });
  });

  test('برابری: آموزش و سرو در یک لحظه‌ی زمانی عددِ یکسان می‌دهند', async () => {
    // ⚠️ مقایسه باید در *یک* لحظه باشد. آموزش سابقه را در لحظه‌ی
    // `created_at`ِ همان رزرو می‌شمارد، پس سرو هم باید با همان asOf سنجیده
    // شود — وگرنه دو عددِ متفاوت طبیعی است و «برابری» بی‌معنا می‌شود.
    // (اولین نسخه‌ی همین تست دقیقاً همین را اشتباه کرد و خودش گیرش انداخت.)
    const probeCreatedAt = new Date(Date.now() - 2 * 86_400_000);
    // party_size = ۷ فقط برای این است که بتوان این ردیف را در خروجیِ آموزش
    // بی‌ابهام پیدا کرد؛ هیچ نقشی در محاسبه‌ی سابقه ندارد.
    await db.$executeRaw`
      INSERT INTO reservations
        (id, code, restaurant_id, user_id, party_size, slot_start, slot_end,
         status, source, created_at)
      VALUES
        (${randomUUID()}::uuid, ${'RZ' + randomUUID().slice(0, 7).toUpperCase()},
         ${restaurantA}::uuid, ${userId}::uuid, 7,
         ${new Date(Date.now() - 86_400_000)}, ${new Date(Date.now() - 86_400_000 + 90 * 60_000)},
         CAST('completed'::text AS "public"."reservation_status"), 'app',
         ${probeCreatedAt})
    `;

    const rows = await fetchTrainingRows(restaurantA);
    const probe = rows.find(r => Number(r.party_size) === 7);
    assert.ok(probe, 'ردیفِ آزمون باید در خروجیِ آموزش باشد');

    const serving = await loadPriorHistory({
      restaurantId: restaurantA, userId, asOf: probeCreatedAt,
    });

    // ── ادعایِ مرکزیِ فازِ ۴ ──
    assert.equal(Number(probe.prior_no_shows), serving.priorNoShows,
      'شمارشِ عدمِ حضور باید در آموزش و سرو یکی باشد');
    assert.equal(Number(probe.prior_completions), serving.priorCompletions,
      'شمارشِ حضور باید در آموزش و سرو یکی باشد');

    // و مقدارهایِ مطلق هم درست‌اند (نه اینکه هر دو به یک اندازه غلط باشند):
    assert.equal(serving.priorNoShows, 1);
    assert.equal(serving.priorCompletions, 2, 'completed(۲۵روز) + dining(۲۰روز)');
    assert.equal(serving.priorTotal, 3,
      'اگر سابقه‌ی رستورانِ ب نشت کند ۵ می‌شود، اگر dining شمرده نشود ۲');
  });
});
