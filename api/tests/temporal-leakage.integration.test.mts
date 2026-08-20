import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';

// ═══════════════════════════════════════════════════════════════════════
//  نشتِ زمانی در ویژگی‌هایِ مدلِ no-show — قفلِ رگرسیونِ P0
//
//  چرا این فایل ساخته شد (ممیزیِ Intelligence Engine، ۲۰۲۶-۰۸-۲۰):
//  کوئریِ آموزشِ no-show از یک window function با
//  `ORDER BY created_at ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`
//  استفاده می‌کرد و کامنتِ بالایش ادعا می‌کرد این «دقیقاً همان چیزی است که
//  در لحظه‌ی رزرو معلوم بوده». آن ادعا غلط بود.
//
//  ترتیبِ created_at می‌گوید کدام رزرو زودتر *ثبت* شده. ولی no-show در لحظه‌ی
//  *برگزاری* معلوم می‌شود. پس رزروی که زودتر ثبت شده ولی دیرتر برگزار
//  می‌شود، نتیجه‌ی آینده‌اش وارد ویژگیِ رزروهایی می‌شد که پیش از آن برگزار
//  شده بودند — یعنی مدل از آینده یاد می‌گرفت.
//
//  ⚠️ چرا این تست با دادهٔ معمولی پیدا نمی‌شد: در دیتابیسِ توسعه هیچ رزروِ
//  از-قبل-گرفته‌شده‌ای نبود (۰ از ۱۳۷ رزرو فاصله‌ی بیش از یک روز بینِ ثبت و
//  برگزاری داشت)، پس نشت اصلاً بروز نمی‌کرد. نقص نهفته بود، نه غایب. این تست
//  عمداً همان الگویِ غایب را می‌سازد.
//
//  ⚠️ کنترلِ مثبت اجباری است: تستی که فقط بگوید «prior_no_shows صفر است»
//  با یک کوئریِ همیشه-صفر هم پاس می‌شود. پس در کنارش ثابت می‌کنیم سابقه‌ای
//  که واقعاً پیش از ثبت برگزار شده، درست شمرده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `leak-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, tableId: string, userId: string;

/** دقیقاً همان کوئریِ نقطه-در-زمانِ fetchTrainingRows در lib/no-show-model.ts. */
async function priorCounts(): Promise<Record<string, { noShows: number; completions: number }>> {
  const rows = await db.$queryRawUnsafe<{ code: string; prior_no_shows: number; prior_completions: number }[]>(`
    SELECT r.code,
           p.prior_no_shows::int AS prior_no_shows,
           p.prior_completions::int AS prior_completions
    FROM reservations r
    CROSS JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE h.status = 'no_show') AS prior_no_shows,
             COUNT(*) FILTER (WHERE h.status IN ('completed','arrived','seated','dining')) AS prior_completions
      FROM reservations h
      WHERE h.restaurant_id = r.restaurant_id
        AND COALESCE(h.user_id::text, h.id::text) = COALESCE(r.user_id::text, r.id::text)
        AND h.id <> r.id
        AND h.status IN ('completed','no_show','arrived','seated','dining')
        AND h.slot_start < r.created_at
    ) p
    WHERE r.restaurant_id = '${restaurantId}'::uuid
      AND r.status IN ('completed','no_show','arrived','seated','dining')`);
  return Object.fromEntries(rows.map(r => [r.code, { noShows: r.prior_no_shows, completions: r.prior_completions }]));
}

async function mkReservation(code: string, createdAt: string, slotStart: string, status: string) {
  await db.$executeRawUnsafe(`
    INSERT INTO reservations (id,restaurant_id,table_id,user_id,code,status,slot_start,slot_end,
      duration_minutes,block_buffer_minutes,party_size,created_at,source)
    VALUES (gen_random_uuid(),'${restaurantId}','${tableId}','${userId}','${code}','${status}'::reservation_status,
      '${slotStart}'::timestamp, ('${slotStart}'::timestamp + interval '90 min'),
      90,15,2,'${createdAt}'::timestamp,'app')`);
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: `[DEMO] رستورانِ نشتِ زمانی`, timezone: 'Asia/Tehran',
            clubPrefix: 'LK', isOpen: true },
    select: { id: true },
  });
  restaurantId = r.id;
  const tb = await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true }, select: { id: true } });
  tableId = tb.id;
  const u = await db.user.create({
    data: { phone: `0938${String(Date.now()).slice(-7)}`.slice(0, 11), firstName: '[DEMO]', lastName: 'نشتِ زمانی' },
    select: { id: true },
  });
  userId = u.id;

  // A — زود ثبت شد، خیلی دیر برگزار شد، و no_show بود.
  await mkReservation('LKA', '2026-01-01 10:00', '2026-03-01 20:00', 'no_show');
  // B — بعد از ثبتِ A ثبت شد، ولی خیلی پیش از برگزاریِ A برگزار شد.
  await mkReservation('LKB', '2026-02-01 10:00', '2026-02-02 20:00', 'completed');
  // C — بعد از برگزاریِ *هردو* ثبت شد؛ سابقه‌اش واقعاً باید دیده شود.
  await mkReservation('LKC', '2026-03-10 10:00', '2026-03-11 20:00', 'completed');
});

after(async () => {
  await db.$executeRawUnsafe(`DELETE FROM reservations WHERE restaurant_id='${restaurantId}'`).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('نشتِ زمانی در ویژگی‌هایِ آموزشِ no-show', () => {
  test('رزروی که دیرتر برگزار می‌شود، نتیجه‌اش وارد ویژگیِ رزروِ قبل‌ترش نمی‌شود', async () => {
    const p = await priorCounts();
    // در ۲۰۲۶-۰۲-۰۱ که B ثبت شد، A هنوز برگزار نشده بود (۲۰۲۶-۰۳-۰۱).
    // پس no-showِ A نباید در سابقه‌ی B دیده شود.
    assert.equal(p['LKB'].noShows, 0,
      'ویژگیِ B نباید به no-showی وابسته باشد که یک ماه بعد اتفاق می‌افتد');
    assert.equal(p['LKB'].completions, 0);
  });

  test('کنترلِ مثبت: سابقه‌ای که واقعاً پیش از ثبت برگزار شده، شمرده می‌شود', async () => {
    const p = await priorCounts();
    // C در ۲۰۲۶-۰۳-۱۰ ثبت شد — بعد از برگزاریِ B (۰۲-۰۲) و A (۰۳-۰۱).
    // پس هردو باید در سابقه‌اش باشند. بدونِ این ادعا، یک کوئریِ همیشه-صفر
    // هم تستِ بالا را پاس می‌کرد.
    assert.equal(p['LKC'].noShows, 1, 'no-showِ A باید دیده شود — تا ۰۳-۱۰ قطعی شده بود');
    assert.equal(p['LKC'].completions, 1, 'تکمیلِ B باید دیده شود');
  });

  test('اولین رزرو هیچ سابقه‌ای ندارد', async () => {
    const p = await priorCounts();
    assert.equal(p['LKA'].noShows, 0);
    assert.equal(p['LKA'].completions, 0);
  });
});
