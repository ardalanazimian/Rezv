import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-A فاز ۱ (مهاجرتِ ۰۷۷) — دسته‌های رابطه‌ایِ منو + «ناموجود» + reorder
//
//  روت‌های واقعی با Requestِ واقعی صدا زده می‌شوند (auth/مالکیت/اعتبارسنجی
//  در مدار). قفل می‌کند:
//   • CRUD دسته + یکتاییِ نام + ضدِ IDOR (دسته‌ی A از توکنِ B → ۴۰۴)
//   • category_id رستورانِ دیگر روی آیتم → ۴۲۲
//   • میرورِ متنی: rename دسته → رشته‌ی category آیتم‌ها هم عوض می‌شود؛
//     متنِ آزادِ کلاینتِ قدیمی → find-or-create و لینکِ رابطه‌ای
//   • reorder: مالکیتِ مخلوط → ۴۰۴ و هیچ تغییری؛ happy path اعمال می‌شود
//   • invalidationِ فعال: mutation → خواندنِ بلافاصله‌ی endpointِ عمومی تازه
//   • هم‌ارزِ backfillِ ۰۷۷ روی دیتای متنیِ ازپیش‌موجود، دوباراجرایی‌پذیر
//
//  ⚠️ هوک‌ها عمداً داخلِ describe اند (دامِ مستندِ رانرِ الحاقی: هوکِ
//  top-level به suiteی ریشه می‌چسبد و فایل‌های دیگر را هم می‌گیرد).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const catsRoute = await import('../src/app/api/v1/restaurant/menu/categories/route');
const catRoute = await import('../src/app/api/v1/restaurant/menu/categories/[id]/route');
const reorderRoute = await import('../src/app/api/v1/restaurant/menu/reorder/route');
const menuRoute = await import('../src/app/api/v1/restaurant/menu/route');
const menuItemRoute = await import('../src/app/api/v1/restaurant/menu/[id]/route');
const publicMenuRoute = await import('../src/app/api/v1/restaurants/[slug]/menu/route');

const TAG = `mcat-${randomUUID().slice(0, 8)}`;

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
    data: { tenantId: t.id, slug: `${TAG}-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'MCT' },
    select: { id: true, slug: true },
  });
  const staff = await db.staff.create({
    data: { tenantId: t.id, phone: `+9893${Math.floor(Math.random() * 1e8)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  const token = signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' });
  return { tenantId: t.id, restaurantId: r.id, slug: r.slug, token };
}

describe('دسته‌های منو (SPEC-A فاز ۱ / ۰۷۷)', () => {
  let A: Awaited<ReturnType<typeof makeTenantWithOwner>>;
  let B: Awaited<ReturnType<typeof makeTenantWithOwner>>;

  before(async () => {
    A = await makeTenantWithOwner('a');
    B = await makeTenantWithOwner('b');
  });

  after(async () => {
    for (const x of [A, B]) {
      await db.menuItem.deleteMany({ where: { restaurantId: x.restaurantId } });
      await db.menuCategory.deleteMany({ where: { restaurantId: x.restaurantId } });
      await db.restaurant.deleteMany({ where: { id: x.restaurantId } });
      await db.staff.deleteMany({ where: { tenantId: x.tenantId } });
      await db.tenant.deleteMany({ where: { id: x.tenantId } });
    }
  });

  test('POST دسته → ۲۰۱؛ GET لیستش می‌کند؛ نامِ تکراری → ۴۲۲', async () => {
    const res = await catsRoute.POST(json(A.token, { name: 'پیش‌غذا', sort_order: 10 }));
    assert.equal(res.status, 201);
    const d = await res.json();
    assert.equal(d.name, 'پیش‌غذا');
    assert.equal(d.is_active, true);

    const list = await (await catsRoute.GET(json(A.token, undefined, 'GET'))).json();
    assert.ok(list.categories.some((c: { id: string }) => c.id === d.id));

    assert.equal((await catsRoute.POST(json(A.token, { name: 'پیش‌غذا' }))).status, 422);
  });

  test('ضدِ IDOR: دسته‌ی A از توکنِ B قابلِ دیدن/ویرایش/حذف نیست → ۴۰۴', async () => {
    const cat = await (await catsRoute.POST(json(A.token, { name: `ایزوله-${TAG}` }))).json();
    assert.equal((await catRoute.PATCH(json(B.token, { name: 'دزدی' }, 'PATCH'), routeArg(cat.id))).status, 404);
    assert.equal((await catRoute.DELETE(json(B.token, undefined, 'DELETE'), routeArg(cat.id))).status, 404);
  });

  test('category_id رستورانِ دیگر روی آیتم → ۴۲۲ (هیچ آیتمی ساخته نمی‌شود)', async () => {
    const catB = await (await catsRoute.POST(json(B.token, { name: `مالِ ب-${TAG}` }))).json();
    const res = await menuRoute.POST(json(A.token, {
      name: `آیتمِ بدنیت ${TAG}`, price_toman: 100_000, category_id: catB.id,
    }));
    assert.equal(res.status, 422);
    assert.equal(await db.menuItem.count({ where: { restaurantId: A.restaurantId, name: `آیتمِ بدنیت ${TAG}` } }), 0);
  });

  test('میرورِ متنی: آیتم با category_id ساخته می‌شود و rename دسته رشته‌ی آیتم را هم عوض می‌کند', async () => {
    const cat = await (await catsRoute.POST(json(A.token, { name: 'نوشیدنی' }))).json();
    const item = await (await menuRoute.POST(json(A.token, {
      name: `چای ${TAG}`, price_toman: 40_000, category_id: cat.id,
    }))).json();
    assert.equal(item.category, 'نوشیدنی', 'میرورِ متنی از نامِ دسته پر می‌شود');
    assert.equal(item.category_id, cat.id);

    const ren = await catRoute.PATCH(json(A.token, { name: 'نوشیدنی‌ها' }, 'PATCH'), routeArg(cat.id));
    assert.equal(ren.status, 200);
    const after = await db.menuItem.findFirst({ where: { id: item.id }, select: { category: true } });
    assert.equal(after!.category, 'نوشیدنی‌ها', 'rename → میرورِ همه‌ی آیتم‌های دسته');
  });

  test('کلاینتِ قدیمی (متنِ آزاد) → find-or-create و لینکِ رابطه‌ای (هم‌گراییِ زنده)', async () => {
    const item = await (await menuRoute.POST(json(A.token, {
      name: `کبابِ قدیمی ${TAG}`, price_toman: 320_000, category: 'غذای اصلی',
    }))).json();
    assert.equal(item.category, 'غذای اصلی');
    assert.ok(item.category_id, 'رشته‌ی آزاد باید به دسته‌ی واقعی لینک شود');
    const cat = await db.menuCategory.findFirst({
      where: { restaurantId: A.restaurantId, name: 'غذای اصلی' }, select: { id: true },
    });
    assert.equal(item.category_id, cat!.id);

    // بارِ دوم با همان متن → همان دسته (upsert، نه تکثیر)
    const item2 = await (await menuRoute.POST(json(A.token, {
      name: `کبابِ قدیمی۲ ${TAG}`, price_toman: 300_000, category: 'غذای اصلی',
    }))).json();
    assert.equal(item2.category_id, cat!.id);
    assert.equal(await db.menuCategory.count({ where: { restaurantId: A.restaurantId, name: 'غذای اصلی' } }), 1);
  });

  test('reorder با idِ بیگانه → ۴۰۴ و هیچ تغییری؛ happy path اعمال می‌شود', async () => {
    const c1 = await (await catsRoute.POST(json(A.token, { name: `ر۱-${TAG}`, sort_order: 1 }))).json();
    const c2 = await (await catsRoute.POST(json(A.token, { name: `ر۲-${TAG}`, sort_order: 2 }))).json();
    const foreign = await (await catsRoute.POST(json(B.token, { name: `ر-بیگانه-${TAG}` }))).json();

    const bad = await reorderRoute.PATCH(json(A.token, {
      categories: [{ id: c1.id, sort_order: 9 }, { id: foreign.id, sort_order: 8 }],
    }, 'PATCH'));
    assert.equal(bad.status, 404, 'حتی یک idِ بیگانه کلِ درخواست را رد می‌کند');
    const c1After = await db.menuCategory.findUnique({ where: { id: c1.id }, select: { sortOrder: true } });
    assert.equal(c1After!.sortOrder, 1, 'هیچ تغییری از درخواستِ ردشده نمی‌ماند');

    const ok = await reorderRoute.PATCH(json(A.token, {
      categories: [{ id: c1.id, sort_order: 20 }, { id: c2.id, sort_order: 10 }],
    }, 'PATCH'));
    assert.equal(ok.status, 200);
    const c1b = await db.menuCategory.findUnique({ where: { id: c1.id }, select: { sortOrder: true } });
    const c2b = await db.menuCategory.findUnique({ where: { id: c2.id }, select: { sortOrder: true } });
    assert.equal(c1b!.sortOrder, 20);
    assert.equal(c2b!.sortOrder, 10);
  });

  test('حذفِ نرمِ دسته: آیتم‌ها می‌مانند و پاسخ صریح است', async () => {
    const cat = await (await catsRoute.POST(json(A.token, { name: `فصلی-${TAG}` }))).json();
    const item = await (await menuRoute.POST(json(A.token, {
      name: `آشِ فصلی ${TAG}`, price_toman: 90_000, category_id: cat.id,
    }))).json();

    const del = await catRoute.DELETE(json(A.token, undefined, 'DELETE'), routeArg(cat.id));
    const dd = await del.json();
    assert.equal(dd.archived, true);
    assert.equal(dd.item_count, 1);

    const it = await db.menuItem.findUnique({ where: { id: item.id }, select: { categoryId: true, category: true } });
    assert.equal(it!.categoryId, cat.id, 'حذفِ نرم لینک را نگه می‌دارد (برگرداندنِ دسته = PATCH)');
    assert.equal(it!.category, `فصلی-${TAG}`, 'متنِ تاریخی دست نمی‌خورد');
  });

  test('invalidationِ فعال: toggleِ «ناموجود» بلافاصله در endpointِ عمومی دیده می‌شود (بدونِ صبرِ TTL)', async () => {
    const item = await (await menuRoute.POST(json(A.token, {
      name: `قرمه ${TAG}`, price_toman: 250_000, category: 'خورش',
    }))).json();

    // گرم‌کردنِ کش
    const warm = await (await publicGet(A.slug)).json();
    const before = warm.items.find((m: { id: string }) => m.id === item.id);
    assert.equal(before.is_out_of_stock, false);

    const patch = await menuItemRoute.PATCH(json(A.token, { is_out_of_stock: true }, 'PATCH'), routeArg(item.id));
    assert.equal(patch.status, 200);

    // بدونِ هیچ صبری — اگر invalidate واقعی نباشد، کشِ گرمِ ۶۰ثانیه‌ای مقدارِ کهنه می‌داد.
    const fresh = await (await publicGet(A.slug)).json();
    const after = fresh.items.find((m: { id: string }) => m.id === item.id);
    assert.equal(after.is_out_of_stock, true, 'mutation باید کش را باطل کرده باشد');
    assert.ok(fresh.categories.some((c: { name: string }) => c.name === 'خورش'), 'دسته‌های فعال در پاسخِ عمومی');
  });

  test('هم‌ارزِ backfillِ ۰۷۷: ردیفِ متنیِ ازپیش‌موجود → دسته + لینک؛ دوباراجرایی‌پذیر', async () => {
    // آیتمِ «قدیمی» که فقط متن دارد (مثل دیتای پیش از ۰۷۷)
    const legacy = await db.menuItem.create({
      data: { restaurantId: A.restaurantId, name: `ته‌چین قدیمی ${TAG}`, priceToman: 210_000, category: 'مجلسی' },
      select: { id: true },
    });

    // همان دو statementِ backfillِ فایلِ ۰۷۷ (هم‌متن نگه داشته شود)
    const backfill = async () => {
      await db.$executeRawUnsafe(`
        INSERT INTO menu_categories (restaurant_id, name)
        SELECT DISTINCT restaurant_id, btrim(category) FROM menu_items
        WHERE category IS NOT NULL AND btrim(category) <> ''
        ON CONFLICT (restaurant_id, name) DO NOTHING`);
      await db.$executeRawUnsafe(`
        UPDATE menu_items mi SET category_id = mc.id FROM menu_categories mc
        WHERE mi.category_id IS NULL AND mi.category IS NOT NULL AND btrim(mi.category) <> ''
          AND mc.restaurant_id = mi.restaurant_id AND mc.name = btrim(mi.category)`);
    };
    await backfill();
    const after1 = await db.menuItem.findUnique({ where: { id: legacy.id }, select: { categoryId: true } });
    assert.ok(after1!.categoryId, 'متنِ قدیمی به دسته‌ی واقعی لینک شد');

    await backfill();   // دوباره — نه خطا، نه دسته‌ی تکراری
    assert.equal(await db.menuCategory.count({ where: { restaurantId: A.restaurantId, name: 'مجلسی' } }), 1);
  });
});
