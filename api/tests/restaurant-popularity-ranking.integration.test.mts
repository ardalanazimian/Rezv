import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رتبه‌بندیِ فیدِ عمومی — «محبوب امشب» واقعاً بر اساسِ محبوبیت
//
//  ⚠️ باگی که این فایل از آن زاده شد: اپِ مشتری فیدِ پیش‌فرضش را
//  «🔥 محبوب امشب» صدا می‌زند، ولی ترتیب از `GET /v1/restaurants` می‌آمد
//  که `orderBy: { id: 'desc' }` بود — و `id` یک UUID است. یعنی ترتیب
//  **پایدار** بود (که برایِ cursor لازم است) ولی عملاً تصادفی؛ یک ادعایِ
//  اثبات‌نشده روی صفحه‌ی اولِ محصول.
//
//  نکته‌ی تلخ‌تر: سیگنالِ واقعی از قبل در همان route حساب می‌شد و روی هر
//  کارت هم نمایش داده می‌شد (`visits7d`) — فقط **بعد از** صفحه‌بندی، پس
//  نمی‌توانست مبنایِ مرتب‌سازی باشد. عدد درست بود، ادعا هم بود، ولی به هم
//  وصل نبودند.
//
//  ⚠️ چرا این تست به **خودِ route** می‌زند و نه فقط به تابعِ بازمحاسبه:
//  همان درسی که امروز دو بار گرفتم (هایجکِ تنانت و تاریخِ روزِ خلوت) —
//  تستی که منطق را برایِ خودش تکرار کند، بازگشتِ کد را نمی‌گیرد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { recomputeRestaurantPopularity } = await import('../src/lib/restaurant-popularity');
const listRoute = await import('../src/app/api/v1/restaurants/route');
const { invalidatePattern } = await import('../src/lib/cache');

const TAG = 'pop';
let tenantId: string;
const ids: Record<string, string> = {};   // label → id

/** رستوران با تعدادِ مشخصی «حضورِ واقعی» در ۷ روزِ گذشته. */
async function makeRestaurant(label: string, visitedCount: number, extraNoise = 0) {
  const s = `${Date.now().toString(36)}-${label}`;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-${TAG}-${s}`, name: `[DEMO] ${TAG}-${label}`,
      clubPrefix: 'POP', isOpen: true, city: `[DEMO]شهر-${TAG}`,
      // ⚠️ لازم است: فهرستِ عمومی رستورانی را که `onlineGating` دارد و
      // heartbeatِ ۹۰ ثانیه‌ی اخیر ندارد پنهان می‌کند (تا رزروِ آنلاین با
      // ثبتِ حضوریِ آفلاین تناقض پیدا نکند). فیکسچرِ ما پنل ندارد.
      onlineGating: false,
      tables: { create: [{ number: 1, capacity: 4 }] },
    },
    select: { id: true, tables: { select: { id: true } } },
  });
  ids[label] = r.id;

  // ⚠️ ستون‌های الزامی از الگویِ کارگرِ `temporal-leakage` برداشته شد، نه از
  // حدس: `code`/`slot_end`/`duration_minutes`/`block_buffer_minutes` هیچ‌کدام
  // nullable نیستند. (`code` یکتایِ **سراسری** است، پس پیشوندِ یکتا می‌گیرد.)
  let seq = 0;
  const mk = async (status: string, n: number, dayOffset: number) => {
    for (let i = 0; i < n; i++) {
      seq += 1;
      const slot = new Date(Date.now() - dayOffset * 86_400_000 - i * 60_000);
      const code = `POP-${s}-${seq}`.slice(0, 30);
      await db.$executeRaw`
        INSERT INTO reservations
          (id, restaurant_id, table_id, code, status, slot_start, slot_end,
           duration_minutes, block_buffer_minutes, party_size, created_at, source)
        VALUES (gen_random_uuid(), ${r.id}::uuid, ${r.tables[0].id}::uuid, ${code},
                ${status}::text::"public"."reservation_status",
                ${slot}, ${new Date(slot.getTime() + 90 * 60_000)},
                90, 15, 2, ${slot}, 'app')
      `;
    }
  };
  await mk('completed', visitedCount, 2);          // داخلِ پنجره‌ی ۷ روزه
  // نویزی که **نباید** شمرده شود: لغوشده در پنجره + حضورِ واقعی خارج از پنجره
  if (extraNoise > 0) {
    await mk('cancelled_by_user', extraNoise, 2);
    await mk('completed', extraNoise, 30);
  }
}

function listReq(qs = '') {
  return new Request(`http://x/api/v1/restaurants${qs}`, {
    headers: { 'x-real-ip': testIp() },
  });
}

async function fetchOrder(qs = '') {
  await invalidatePattern('restaurants*').catch(() => {});
  const res = await listRoute.GET(listReq(qs));
  assert.equal(res.status, 200, 'فهرست باید ۲۰۰ بدهد');
  const body = await res.json();
  return (body.items as Array<{ id: string; name: string }>);
}

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  tenantId = t.id;
  // عمداً به ترتیبی می‌سازیم که با ترتیبِ محبوبیت یکی **نباشد**.
  await makeRestaurant('کم', 1, 3);
  await makeRestaurant('زیاد', 9);
  await makeRestaurant('متوسط', 4);
});

after(async () => {
  const all = Object.values(ids);
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ANY(${all}::uuid[])`.catch(() => {});
  await db.table.deleteMany({ where: { restaurantId: { in: all } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await invalidatePattern('restaurants*').catch(() => {});
});

describe('رتبه‌بندیِ فیدِ عمومی بر اساسِ حضورِ واقعیِ ۷ روزِ گذشته', () => {
  test('🔴 بازمحاسبه عددِ درست را می‌نویسد — و نویز را نمی‌شمارد', async () => {
    await recomputeRestaurantPopularity();
    const rows = await db.restaurant.findMany({
      where: { id: { in: Object.values(ids) } },
      select: { id: true, visits7d: true },
    });
    const by = new Map(rows.map(r => [r.id, r.visits7d]));
    assert.equal(by.get(ids['زیاد']), 9);
    assert.equal(by.get(ids['متوسط']), 4);
    // «کم» یک حضورِ واقعی دارد + ۳ لغوشده + ۳ حضورِ ۳۰ روز پیش ⇒ فقط ۱
    assert.equal(by.get(ids['کم']), 1,
      'لغوشده و خارج از پنجره‌ی ۷ روزه نباید شمرده شوند');
  });

  test('🔴 فهرستِ عمومی واقعاً به همان ترتیب برمی‌گردد', async () => {
    // ادعایِ مرکزی — روی خودِ route، نه روی تکرارِ منطق.
    await recomputeRestaurantPopularity();
    const items = await fetchOrder(`?city=${encodeURIComponent(`[DEMO]شهر-${TAG}`)}`);
    const mine = items.filter(i => Object.values(ids).includes(i.id)).map(i => i.id);
    assert.deepEqual(mine, [ids['زیاد'], ids['متوسط'], ids['کم']],
      'ترتیب باید نزولی بر اساسِ حضورِ ۷ روزه باشد');
  });

  test('✓ کنترلِ منفی — با عوض‌شدنِ داده، ترتیب هم عوض می‌شود', async () => {
    // یعنی ترتیب واقعاً تابعِ داده است، نه یک ترتیبِ ثابتِ خوش‌شانس.
    // «کم» را با ۲۰ حضورِ واقعی به صدر می‌بریم.
    const r = await db.table.findFirst({ where: { restaurantId: ids['کم'] }, select: { id: true } });
    for (let i = 0; i < 20; i++) {
      const slot = new Date(Date.now() - 86_400_000 - i * 60_000);
      const code = `POPX-${Date.now().toString(36)}-${i}`.slice(0, 30);
      await db.$executeRaw`
        INSERT INTO reservations
          (id, restaurant_id, table_id, code, status, slot_start, slot_end,
           duration_minutes, block_buffer_minutes, party_size, created_at, source)
        VALUES (gen_random_uuid(), ${ids['کم']}::uuid, ${r!.id}::uuid, ${code},
                'completed'::text::"public"."reservation_status",
                ${slot}, ${new Date(slot.getTime() + 90 * 60_000)},
                90, 15, 2, ${slot}, 'app')
      `;
    }
    await recomputeRestaurantPopularity();
    const items = await fetchOrder(`?city=${encodeURIComponent(`[DEMO]شهر-${TAG}`)}`);
    const mine = items.filter(i => Object.values(ids).includes(i.id)).map(i => i.id);
    assert.equal(mine[0], ids['کم'], 'رستورانی که محبوب شد باید اول بیاید');
  });

  test('⚠️ ترتیب قطعی است — دو فراخوانیِ پیاپی یکی می‌دهند', async () => {
    // `id` شکنندهٔ تساوی است؛ بدونِ آن، رستوران‌های هم‌امتیاز هر بار ترتیبِ
    // دیگری می‌گرفتند و صفحه‌بندیِ cursor رکورد جا می‌انداخت یا تکرار می‌کرد.
    const a = (await fetchOrder()).map(i => i.id);
    const b = (await fetchOrder()).map(i => i.id);
    assert.deepEqual(a, b, 'ترتیب باید بینِ دو فراخوانی پایدار بماند');
  });
});
