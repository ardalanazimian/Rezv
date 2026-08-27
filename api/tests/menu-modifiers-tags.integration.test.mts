import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-A فاز ۲ (۰۷۸) — افزودنی‌ها، برچسب‌ها، پنجره‌ی دسترسی
//
//  قفل می‌کند: min/maxِ نامعتبر ۴۲۲؛ قانونِ قیمتِ منفیِ نهایی از هر دو سمت
//  (دلتای گزینه و کاهشِ قیمتِ آیتم)؛ PUTِ جایگزینِ برچسب‌ها + برچسبِ ناشناخته؛
//  ضدِ IDORِ دو-hop؛ اعتبارسنجیِ پنجره؛ و فیلترِ پنجره‌ی **پس-از-کش** در
//  endpointِ عمومی (آیتمِ بیرونِ پنجره در عمومی نیست، در پنل هست؛ برداشتنِ
//  پنجره بلافاصله — بدونِ صبرِ TTLِ ۳۰۰ — برش می‌گرداند).
//
//  هوک‌ها داخلِ describe (قانونِ رانرِ الحاقی).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { weekdayInTz, dateKeyInTz } = await import('../src/lib/hours');
const modsRoute = await import('../src/app/api/v1/restaurant/menu/[id]/modifiers/route');
const groupRoute = await import('../src/app/api/v1/restaurant/menu/modifier-groups/[id]/route');
const optionRoute = await import('../src/app/api/v1/restaurant/menu/modifier-options/[id]/route');
const tagsRoute = await import('../src/app/api/v1/restaurant/menu/[id]/tags/route');
const menuItemRoute = await import('../src/app/api/v1/restaurant/menu/[id]/route');
const menuRoute = await import('../src/app/api/v1/restaurant/menu/route');
const publicMenuRoute = await import('../src/app/api/v1/restaurants/[slug]/menu/route');

const TAG = `mmt-${randomUUID().slice(0, 8)}`;

const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });
const slugArg = (slug: string) => ({ params: Promise.resolve({ slug }) });

const json = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const publicGet = (slug: string) =>
  publicMenuRoute.GET(
    new Request(`http://x/api/v1/restaurants/${slug}/menu`, { headers: { 'x-real-ip': testIp() } }),
    slugArg(slug),
  );

async function makeTenantWithOwner(label: string) {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `${TAG}-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'MMT', timezone: 'Asia/Tehran' },
    select: { id: true, slug: true },
  });
  const staff = await db.staff.create({
    data: { tenantId: t.id, phone: `+9894${Math.floor(Math.random() * 1e8)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  const token = signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' });
  return { tenantId: t.id, restaurantId: r.id, slug: r.slug, token };
}

describe('افزودنی/برچسب/پنجره (SPEC-A فاز ۲ / ۰۷۸)', () => {
  let A: Awaited<ReturnType<typeof makeTenantWithOwner>>;
  let B: Awaited<ReturnType<typeof makeTenantWithOwner>>;
  let itemId = '';

  before(async () => {
    A = await makeTenantWithOwner('a');
    B = await makeTenantWithOwner('b');
    const it = await db.menuItem.create({
      data: { restaurantId: A.restaurantId, name: `پیتزا ${TAG}`, priceToman: 200_000 },
      select: { id: true },
    });
    itemId = it.id;
  });

  after(async () => {
    for (const x of [A, B]) {
      await db.menuItem.deleteMany({ where: { restaurantId: x.restaurantId } });
      await db.restaurant.deleteMany({ where: { id: x.restaurantId } });
      await db.staff.deleteMany({ where: { tenantId: x.tenantId } });
      await db.tenant.deleteMany({ where: { id: x.tenantId } });
    }
  });

  test('گروه: min>max → ۴۲۲؛ ساختِ معتبر → ۲۰۱ و در GET دیده می‌شود', async () => {
    const bad = await modsRoute.POST(json(A.token, { name: 'سایز', min_select: 3, max_select: 1 }), routeArg(itemId));
    assert.equal(bad.status, 422);

    const ok = await modsRoute.POST(json(A.token, { name: 'سایز', min_select: 1, max_select: 1 }), routeArg(itemId));
    assert.equal(ok.status, 201);
    const g = await ok.json();

    const list = await (await modsRoute.GET(json(A.token, undefined, 'GET'), routeArg(itemId))).json();
    assert.ok(list.groups.some((x: { id: string }) => x.id === g.id));
  });

  test('قانونِ قیمتِ منفی از هر دو سمت: دلتای عمیق → ۴۲۲؛ کاهشِ قیمتِ آیتم زیرِ دلتا → ۴۲۲', async () => {
    const g = await (await modsRoute.POST(json(A.token, { name: `تخفیف ${TAG}` }), routeArg(itemId))).json();

    // دلتای منفی‌تر از قیمتِ آیتم (۲۰۰هزار) → رد
    const deep = await groupRoute.POST(json(A.token, { name: 'نابودگر', price_delta_toman: -250_000 }), routeArg(g.id));
    assert.equal(deep.status, 422);

    // دلتای منفیِ مجاز → قبول
    const ok = await groupRoute.POST(json(A.token, { name: 'اقتصادی', price_delta_toman: -150_000 }), routeArg(g.id));
    assert.equal(ok.status, 201);

    // حالا کاهشِ قیمتِ آیتم به ۱۰۰هزار → با دلتای -۱۵۰هزار منفی می‌شود → رد
    const cut = await menuItemRoute.PATCH(json(A.token, { price_toman: 100_000 }, 'PATCH'), routeArg(itemId));
    assert.equal(cut.status, 422);
    const msg = (await cut.json()).error?.message || '';
    assert.ok(msg.includes('اقتصادی'), `پیام باید نامِ گزینه را بگوید: ${msg}`);

    // کاهشِ سازگار (۱۶۰هزار ≥ ۱۵۰هزار) → قبول
    assert.equal((await menuItemRoute.PATCH(json(A.token, { price_toman: 160_000 }, 'PATCH'), routeArg(itemId))).status, 200);
  });

  test('ضدِ IDORِ دو/سه-hop: گروه و گزینه‌ی A از توکنِ B → ۴۰۴', async () => {
    const g = await (await modsRoute.POST(json(A.token, { name: `ایزوله ${TAG}` }), routeArg(itemId))).json();
    const o = await (await groupRoute.POST(json(A.token, { name: 'گ۱' }), routeArg(g.id))).json();

    assert.equal((await groupRoute.PATCH(json(B.token, { name: 'دزدی' }, 'PATCH'), routeArg(g.id))).status, 404);
    assert.equal((await optionRoute.DELETE(json(B.token, undefined, 'DELETE'), routeArg(o.id))).status, 404);
    // آیتمِ A از توکنِ B هم برای tags/modifiers چهارصدوچهار است
    assert.equal((await modsRoute.GET(json(B.token, undefined, 'GET'), routeArg(itemId))).status, 404);
  });

  test('برچسب‌ها: PUT جایگزینیِ کامل؛ ناشناخته → ۴۲۲', async () => {
    let res = await tagsRoute.PUT(json(A.token, { tags: ['VEGAN', 'SPICY'] }, 'PUT'), routeArg(itemId));
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).tags.sort(), ['SPICY', 'VEGAN']);

    res = await tagsRoute.PUT(json(A.token, { tags: ['HALAL'] }, 'PUT'), routeArg(itemId));
    assert.equal(res.status, 200);
    const now = await (await tagsRoute.GET(json(A.token, undefined, 'GET'), routeArg(itemId))).json();
    assert.deepEqual(now.tags, ['HALAL'], 'جایگزینی، نه افزودن');

    assert.equal((await tagsRoute.PUT(json(A.token, { tags: ['DELICIOUS'] }, 'PUT'), routeArg(itemId))).status, 422);
  });

  test('پنجره‌ی نامعتبر → ۴۲۲ (روزِ ۷، شروع≥پایان، روزِ تکراری)', async () => {
    const bad = async (availability: unknown) =>
      (await menuItemRoute.PATCH(json(A.token, { availability }, 'PATCH'), routeArg(itemId))).status;
    assert.equal(await bad({ days: [7], start_min: 100, end_min: 200 }), 422);
    assert.equal(await bad({ days: [1], start_min: 300, end_min: 300 }), 422);
    assert.equal(await bad({ days: [1, 1], start_min: 100, end_min: 200 }), 422);
    assert.equal(await bad({ days: [], start_min: 100, end_min: 200 }), 422);
  });

  test('فیلترِ پنجره پس-از-کش: بیرونِ پنجره در عمومی نیست، در پنل هست؛ null → بازگشتِ فوری (بدونِ TTL)', async () => {
    const it = await db.menuItem.create({
      data: { restaurantId: A.restaurantId, name: `صبحانه ${TAG}`, priceToman: 90_000 },
      select: { id: true },
    });

    // پنجره‌ای که قطعاً «الان» را نمی‌گیرد: روزِ دیگری از هفته (به وقتِ تهران)
    const today = weekdayInTz(dateKeyInTz(new Date(), 'Asia/Tehran'), 'Asia/Tehran');
    const otherDay = (today + 3) % 7;
    const set = await menuItemRoute.PATCH(
      json(A.token, { availability: { days: [otherDay], start_min: 60, end_min: 120 } }, 'PATCH'),
      routeArg(it.id),
    );
    assert.equal(set.status, 200);

    const pub = await (await publicGet(A.slug)).json();
    assert.equal(pub.items.some((m: { id: string }) => m.id === it.id), false, 'بیرونِ پنجره در عمومی نمی‌آید');

    const panel = await (await menuRoute.GET(json(A.token, undefined, 'GET'))).json();
    assert.equal(panel.items.some((m: { id: string }) => m.id === it.id), true, 'پنل همیشه همه را می‌بیند');

    // برداشتنِ پنجره → با invalidationِ فعال، بلافاصله برمی‌گردد (TTL=۳۰۰ منتظر نمی‌مانیم)
    assert.equal((await menuItemRoute.PATCH(json(A.token, { availability: null }, 'PATCH'), routeArg(it.id))).status, 200);
    const pub2 = await (await publicGet(A.slug)).json();
    assert.equal(pub2.items.some((m: { id: string }) => m.id === it.id), true, 'invalidation فعال — نه صبرِ TTL');
  });

  test('پاسخِ عمومی: tags و modifiers روی آیتم (شکلِ افزودنی)', async () => {
    await tagsRoute.PUT(json(A.token, { tags: ['POPULAR'] }, 'PUT'), routeArg(itemId));
    const pub = await (await publicGet(A.slug)).json();
    const item = pub.items.find((m: { id: string }) => m.id === itemId);
    assert.ok(item, 'آیتم در عمومی هست');
    assert.ok(item.tags.includes('POPULAR'));
    assert.ok(Array.isArray(item.modifiers) && item.modifiers.length >= 1, 'گروه‌های افزودنی می‌آیند');
    assert.ok(item.modifiers.every((g: { options: unknown[] }) => Array.isArray(g.options)));
  });
});
