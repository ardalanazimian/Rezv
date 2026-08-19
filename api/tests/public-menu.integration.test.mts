import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { publicMenuUrl, restaurantUrl, siteBase } from '../src/lib/public-urls.ts';

// ═══════════════════════════════════════════════════════════════════════
//  منویِ عمومی — تستِ integration رویِ Postgresِ واقعی.
//
//  چرا واقعی و نه mock: قیدهایی که این فیچر به آن‌ها تکیه می‌کند (فیلترِ
//  isActive، ترتیبِ sortOrder، جداییِ رستوران‌ها) در خودِ دیتابیس‌اند. یک
//  mock هر رفتاری را که بخواهیم تأیید می‌کند، از جمله رفتاری که وجود ندارد.
//
//  هر تست دادهٔ خودش را می‌سازد و در پایان پاک می‌کند (بدونِ تکیه بر seed).
// ═══════════════════════════════════════════════════════════════════════

const TAG = `pmtest-${randomUUID().slice(0, 8)}`;
let tenantId = '';
let rA = '';   // رستورانِ اول
let rB = '';   // رستورانِ دوم — برایِ اثباتِ ایزولاسیون

before(async () => {
  const tenant = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = tenant.id;

  const mk = async (slug: string, name: string) =>
    (await db.restaurant.create({
      data: {
        tenantId, slug: `${TAG}-${slug}`, name: `[DEMO] ${name}`, timezone: 'Asia/Tehran',
        // اجباری در اسکیما (پیشوندِ کدِ باشگاهِ مشتریان) — بدونِ آن create رد می‌شود.
        clubPrefix: `T${slug.toUpperCase()}`,
      },
      select: { id: true },
    })).id;

  rA = await mk('a', 'الف');
  rB = await mk('b', 'ب');

  await db.menuItem.createMany({
    data: [
      // عمداً به ترتیبی درج می‌شوند که با ترتیبِ خواسته‌شده یکی نیست، تا
      // تستِ ترتیب واقعاً چیزی را بسنجد و تصادفاً پاس نشود.
      { restaurantId: rA, name: 'دسر', priceToman: 60_000, category: 'دسر', sortOrder: 30, isActive: true },
      { restaurantId: rA, name: 'پیش‌غذا', priceToman: 80_000, category: 'پیش‌غذا', sortOrder: 10, isActive: true },
      { restaurantId: rA, name: 'اصلی', priceToman: 180_000, category: 'اصلی', sortOrder: 20, isActive: true },
      { restaurantId: rA, name: 'آیتمِ غیرفعال', priceToman: 1_000, sortOrder: 5, isActive: false },
      { restaurantId: rB, name: 'آیتمِ رستورانِ دوم', priceToman: 1_000, sortOrder: 1, isActive: true },
    ],
  });
});

after(async () => {
  await db.menuItem.deleteMany({ where: { restaurantId: { in: [rA, rB] } } });
  await db.restaurant.deleteMany({ where: { id: { in: [rA, rB] } } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

/** همان کوئریِ خواندنِ منویِ عمومی که route اجرا می‌کند. */
function publicMenuQuery(restaurantId: string) {
  return db.menuItem.findMany({
    where: { restaurantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { name: true, category: true, sortOrder: true, description: true, imageUrl: true },
  });
}

describe('منویِ عمومی — قیدهایِ دیتابیس', () => {
  test('فقط آیتم‌هایِ فعال بیرون می‌روند', async () => {
    const items = await publicMenuQuery(rA);
    assert.equal(items.length, 3);
    assert.ok(!items.some((i) => i.name === 'آیتمِ غیرفعال'), 'آیتمِ غیرفعال نباید عمومی شود');
  });

  test('ترتیب از sortOrder می‌آید، نه از ترتیبِ درج', async () => {
    const items = await publicMenuQuery(rA);
    assert.deepEqual(items.map((i) => i.name), ['پیش‌غذا', 'اصلی', 'دسر']);
  });

  test('ایزولاسیونِ رستوران: منویِ A هیچ آیتمی از B ندارد', async () => {
    const a = await publicMenuQuery(rA);
    const b = await publicMenuQuery(rB);
    assert.ok(!a.some((i) => i.name === 'آیتمِ رستورانِ دوم'));
    assert.equal(b.length, 1);
    assert.equal(b[0].name, 'آیتمِ رستورانِ دوم');
  });

  test('رستورانِ بدونِ آیتمِ فعال → آرایه‌ی خالی، نه خطا', async () => {
    await db.menuItem.updateMany({ where: { restaurantId: rB }, data: { isActive: false } });
    const items = await publicMenuQuery(rB);
    assert.deepEqual(items, [], 'خالی یک حالتِ معتبر است، نه شکست');
    await db.menuItem.updateMany({ where: { restaurantId: rB }, data: { isActive: true } });
  });

  test('slugِ ناموجود → رستورانی پیدا نمی‌شود (مسیرِ ۴۰۴)', async () => {
    const r = await db.restaurant.findUnique({ where: { slug: `${TAG}-does-not-exist` } });
    assert.equal(r, null);
  });

  test('فیلدهایِ مهاجرتِ ۰۵۲ واقعاً خوانده می‌شوند', async () => {
    // اگر ستون‌ها نبودند، خودِ کوئری خطا می‌داد — پس این تست وجودشان را هم می‌سنجد.
    const items = await publicMenuQuery(rA);
    for (const i of items) {
      assert.ok('description' in i && 'imageUrl' in i && 'sortOrder' in i);
    }
    assert.equal(typeof items[0].sortOrder, 'number');
  });
});

describe('آدرس‌هایِ عمومی', () => {
  test('آدرسِ منو دقیقاً «/r/{slug}/menu» است', () => {
    assert.equal(publicMenuUrl('vista'), `${siteBase()}/r/vista/menu`);
    assert.equal(restaurantUrl('vista'), `${siteBase()}/r/vista`);
  });

  test('slug با کاراکترِ خاص encode می‌شود (QR نباید آدرسِ شکسته بگیرد)', () => {
    assert.equal(publicMenuUrl('کافه من'), `${siteBase()}/r/${encodeURIComponent('کافه من')}/menu`);
    assert.ok(!publicMenuUrl('a b').includes(' '), 'فاصله نباید خام بماند');
  });

  test('آدرسِ منو زیرمجموعه‌ی آدرسِ رستوران است (قفلِ هم‌خوانی با apps/seo)', () => {
    // اگر روزی یکی از این دو عوض شود و دیگری نه، QRِ چاپ‌شده و لینکِ
    // صفحه از هم می‌افتند. این تست همان لحظه را می‌گیرد.
    assert.equal(publicMenuUrl('x'), `${restaurantUrl('x')}/menu`);
  });
});
