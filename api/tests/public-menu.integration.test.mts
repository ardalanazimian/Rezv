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

// ═══════════════════════════════════════════════════════════════════════
//  مهاجرتِ ۰۵۳ — عکسِ آیتم و شخصی‌سازیِ منو.
//  قیدهایِ CHECK در سطحِ دیتابیس سنجیده می‌شوند، نه فقط اعتبارسنجیِ API:
//  یک اسکریپتِ دستی یا بازگردانیِ بکاپ هم نباید بتواند مقدارِ بی‌معنا بنشاند.
// ═══════════════════════════════════════════════════════════════════════
describe('شخصی‌سازیِ منو — قیدهای دیتابیس', () => {
  test('مقادیرِ معتبر پذیرفته می‌شوند', async () => {
    const r = await db.restaurant.update({
      where: { id: rA },
      data: { menuAccent: '#E11D48', menuTheme: 'dark', menuLayout: 'grid', menuTagline: 'یک خط معرفی' },
      select: { menuAccent: true, menuTheme: true, menuLayout: true, menuTagline: true },
    });
    assert.equal(r.menuAccent, '#E11D48');
    assert.equal(r.menuTheme, 'dark');
    assert.equal(r.menuLayout, 'grid');
  });

  test('NULL مجاز است — یعنی «انتخاب‌نشده»، نه یک پیش‌فرضِ جعلی', async () => {
    const r = await db.restaurant.update({
      where: { id: rA },
      data: { menuAccent: null, menuTheme: null, menuLayout: null },
      select: { menuAccent: true, menuTheme: true, menuLayout: true },
    });
    assert.deepEqual(r, { menuAccent: null, menuTheme: null, menuLayout: null });
  });

  test('تمِ نامعتبر را خودِ دیتابیس رد می‌کند', async () => {
    await assert.rejects(
      () => db.restaurant.update({ where: { id: rA }, data: { menuTheme: 'رنگین‌کمان' } }),
      /menu_theme_chk/,
    );
  });

  test('چیدمانِ نامعتبر را خودِ دیتابیس رد می‌کند', async () => {
    await assert.rejects(
      () => db.restaurant.update({ where: { id: rA }, data: { menuLayout: 'carousel' } }),
      /menu_layout_chk/,
    );
  });

  test('رنگِ غیرِ‌هگز را خودِ دیتابیس رد می‌کند (سینکِ CSS)', async () => {
    // این مقدار در صفحه‌ی عمومی داخلِ `style` می‌نشیند؛ اگر از اینجا رد شود
    // فقط گاردِ فرانت مانده است.
    for (const bad of ['red', '#FFF', 'blue;}body{display:none']) {
      await assert.rejects(
        () => db.restaurant.update({ where: { id: rA }, data: { menuAccent: bad } }),
        /menu_accent_chk/,
        `باید رد شود: ${bad}`,
      );
    }
  });
});

describe('عکسِ آیتمِ منو', () => {
  test('ستون‌هایِ متادیتایِ عکس وجود دارند و nullable هستند', async () => {
    const item = await db.menuItem.findFirst({
      where: { restaurantId: rA },
      select: {
        id: true, imageUrl: true, imageStorageKey: true,
        imageMime: true, imageWidth: true, imageHeight: true, imageByteSize: true,
      },
    });
    assert.ok(item);
    // آیتمی که عکس آپلود نشده، همه‌ی این‌ها NULL دارد — نه رشته‌ی خالی.
    assert.equal(item.imageUrl, null);
    assert.equal(item.imageStorageKey, null);
  });

  test('متادیتایِ عکس با هم نوشته و با هم پاک می‌شود', async () => {
    const item = await db.menuItem.findFirst({ where: { restaurantId: rA }, select: { id: true } });
    const KEY = '2026/08/test-key.png';
    await db.menuItem.update({
      where: { id: item!.id },
      data: {
        imageUrl: `/api/v1/media/${KEY}`, imageStorageKey: KEY,
        imageMime: 'image/png', imageWidth: 240, imageHeight: 240, imageByteSize: 1234,
      },
    });
    const withImg = await db.menuItem.findUnique({
      where: { id: item!.id },
      select: { imageUrl: true, imageStorageKey: true, imageWidth: true },
    });
    assert.equal(withImg!.imageStorageKey, KEY);
    assert.equal(withImg!.imageWidth, 240);
    // آدرس همیشه از کلیدِ ذخیره‌سازی ساخته می‌شود، نه از ورودیِ کلاینت.
    assert.ok(withImg!.imageUrl!.endsWith(KEY));

    await db.menuItem.update({
      where: { id: item!.id },
      data: { imageUrl: null, imageStorageKey: null, imageMime: null, imageWidth: null, imageHeight: null, imageByteSize: null },
    });
    const cleared = await db.menuItem.findUnique({ where: { id: item!.id }, select: { imageUrl: true, imageStorageKey: true } });
    assert.deepEqual(cleared, { imageUrl: null, imageStorageKey: null });
  });
});

describe('سکشن‌بندی و «ناموجود» (SPEC-A فاز ۱ / ۰۷۷)', () => {
  test('endpointِ عمومی: فقط دسته‌های فعال در categories؛ آیتمِ ناموجود با فلگ برمی‌گردد', async () => {
    const { GET } = await import('../src/app/api/v1/restaurants/[slug]/menu/route.ts');
    const active = await db.menuCategory.create({
      data: { restaurantId: rA, name: `فعال-${TAG}`, sortOrder: 1 }, select: { id: true },
    });
    const hidden = await db.menuCategory.create({
      data: { restaurantId: rA, name: `مخفی-${TAG}`, isActive: false }, select: { id: true },
    });
    await db.menuItem.create({
      data: { restaurantId: rA, name: `سوپِ ناموجود ${TAG}`, priceToman: 70_000,
              categoryId: active.id, category: `فعال-${TAG}`, isOutOfStock: true, isActive: true },
    });

    const res = await GET(
      new Request('http://x/api', { headers: { 'x-real-ip': `10.91.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` } }),
      { params: Promise.resolve({ slug: `${TAG}-a` }) },
    );
    assert.equal(res.status, 200);
    const d = await res.json();

    const names = d.categories.map((c: { name: string }) => c.name);
    assert.ok(names.includes(`فعال-${TAG}`), 'دسته‌ی فعال هست');
    assert.equal(names.includes(`مخفی-${TAG}`), false, 'دسته‌ی غیرفعال در پاسخِ عمومی نیست');

    const soup = d.items.find((m: { name: string }) => m.name === `سوپِ ناموجود ${TAG}`);
    assert.ok(soup, 'آیتمِ ناموجود حذف نمی‌شود — با برچسب می‌آید');
    assert.equal(soup.is_out_of_stock, true);
    assert.equal(soup.category_id, active.id);

    // پاک‌سازیِ محلی (الگوی فایل: هر تست دیتای خودش)
    await db.menuItem.deleteMany({ where: { restaurantId: rA, name: `سوپِ ناموجود ${TAG}` } });
    await db.menuCategory.deleteMany({ where: { id: { in: [active.id, hidden.id] } } });
  });
});
