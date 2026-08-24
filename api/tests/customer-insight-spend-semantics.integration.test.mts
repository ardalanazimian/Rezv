import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تستِ integration زنده — تفکیکِ «صفرِ تأییدشده» از «نامعلوم» در مبلغ/CLV
//
//  چرا integration واقعی و نه mock: کلِ ادعایِ این اصلاح یک گزاره درباره‌ی
//  state رویِ دیتابیس است — «وقتی رستوران منویِ قیمت‌دار ندارد، ستون‌هایِ
//  مبلغی باید NULL بمانند، نه ۰». mock کردنِ Prisma یعنی همان چیزی را که
//  می‌خواهیم اثبات کنیم فرض گرفته‌ایم. ضمناً nullability فقط بعد از اعمالِ
//  migration ۰۴۶ رویِ DBِ واقعی معنا دارد.
//
//  ریشه‌ی باگ (ممیزیِ ۲۰۲۶-۰۸-۱۹): رزرونو POS-agnostic است و مبلغِ فاکتور را
//  نمی‌بیند؛ تنها منبعِ مبلغ پیش‌سفارش از منوست. چون هیچ روتی برایِ ساختِ
//  آیتمِ منو وجود ندارد، رستورانِ واقعی منوی خالی دارد → پیش‌سفارش ناممکن →
//  مبلغ همیشه ۰ محاسبه و به‌عنوانِ عددِ اندازه‌گیری‌شده ذخیره می‌شد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { recomputeCustomerInsight } = await import('../src/lib/customer-insights');

let tenantId: string;
let restNoMenu: string;   // رستورانِ بدونِ منو → مبلغ اندازه‌گیری‌ناپذیر
let restWithMenu: string; // رستورانِ دارایِ منو → مبلغ اندازه‌گیری‌پذیر
let menuItemId: string;
let userNoMenu: string;
let userNoPreorder: string;
let userWithPreorder: string;

/** یک رزروِ تکمیل‌شده می‌سازد (وضعیتِ `completed` در isVisit حساب می‌شود). */
async function makeVisit(restaurantId: string, userId: string, tableId: string, daysAgo: number) {
  const start = new Date(Date.now() - daysAgo * 86_400_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return db.reservation.create({
    data: {
      code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      restaurantId, tableId, userId, partySize: 2,
      slotStart: start, slotEnd: end, status: 'completed', source: 'app',
    },
    select: { id: true },
  });
}

async function makeRestaurant(slug: string) {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug, name: `[DEMO] ${slug}`, clubPrefix: slug.slice(0, 3).toUpperCase(),
      tables: { create: [{ number: 1, capacity: 4 }] },
    },
    select: { id: true, tables: { select: { id: true } } },
  });
  return { id: r.id, tableId: r.tables[0].id };
}

before(async () => {
  const suffix = Date.now().toString(36);
  const tenant = await db.tenant.create({ data: { name: `[DEMO] spend-semantics ${suffix}` } });
  tenantId = tenant.id;

  const a = await makeRestaurant(`zz-nomenu-${suffix}`);
  const b = await makeRestaurant(`zz-withmenu-${suffix}`);
  restNoMenu = a.id;
  restWithMenu = b.id;

  const mi = await db.menuItem.create({
    data: { restaurantId: restWithMenu, name: '[DEMO] پاستا', priceToman: 200_000 },
    select: { id: true },
  });
  menuItemId = mi.id;

  const mkUser = async (n: string) =>
    (await db.user.create({ data: { phone: `+9891${suffix.slice(-6)}${n}`.slice(0, 13) }, select: { id: true } })).id;
  userNoMenu = await mkUser('1');
  userNoPreorder = await mkUser('2');
  userWithPreorder = await mkUser('3');

  // رستورانِ بدونِ منو: یک بازدید، بدونِ هیچ آیتمی (ناممکن است اصلاً)
  await makeVisit(restNoMenu, userNoMenu, a.tableId, 10);

  // رستورانِ دارایِ منو: یکی بدونِ پیش‌سفارش، یکی با پیش‌سفارش
  await makeVisit(restWithMenu, userNoPreorder, b.tableId, 12);
  const withPre = await makeVisit(restWithMenu, userWithPreorder, b.tableId, 20);
  await db.reservationItem.create({
    data: { reservationId: withPre.id, menuItemId, qty: 2 },
  });
});

after(async () => {
  await db.reservationItem.deleteMany({ where: { menuItem: { restaurantId: restWithMenu } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: [restNoMenu, restWithMenu] } } });
  await db.customerInsight.deleteMany({ where: { restaurantId: { in: [restNoMenu, restWithMenu] } } });
  await db.menuItem.deleteMany({ where: { restaurantId: restWithMenu } });
  await db.table.deleteMany({ where: { restaurantId: { in: [restNoMenu, restWithMenu] } } });
  await db.restaurant.deleteMany({ where: { id: { in: [restNoMenu, restWithMenu] } } });
  await db.user.deleteMany({ where: { id: { in: [userNoMenu, userNoPreorder, userWithPreorder] } } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

describe('معناشناسیِ مبلغ در customer_insights — نامعلوم در برابرِ صفرِ تأییدشده', () => {
  test('مبلغ نامعلوم: رستورانِ بدونِ منویِ قیمت‌دار → NULL، نه ۰', async () => {
    await recomputeCustomerInsight(restNoMenu, userNoMenu);
    const row = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: restNoMenu, userId: userNoMenu } },
      select: { totalSpendToman: true, avgSpendToman: true, predictedClvToman: true, totalVisits: true },
    });
    assert.ok(row, 'رکوردِ بینش باید ساخته شود');
    assert.equal(row.totalSpendToman, null, 'مبلغِ کل باید NULL باشد (اندازه‌گیری‌ناپذیر)');
    assert.equal(row.avgSpendToman, null, 'میانگینِ مبلغ باید NULL باشد');
    assert.equal(row.predictedClvToman, null, 'CLV بدونِ ورودیِ مبلغی نباید ساخته شود');
    // بازدید دادهٔ مشاهده‌شده‌ی واقعی است و باید ثبت شود — «نامعلوم بودنِ مبلغ»
    // نباید بقیه‌ی سیگنال‌هایِ واقعی را هم از بین ببرد.
    assert.equal(row.totalVisits, 1, 'بازدیدِ واقعی باید همچنان شمرده شود');
  });

  test('صفرِ تأییدشده: منو هست ولی مهمان پیش‌سفارش نداده → ۰، نه NULL', async () => {
    await recomputeCustomerInsight(restWithMenu, userNoPreorder);
    const row = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: restWithMenu, userId: userNoPreorder } },
      select: { totalSpendToman: true, avgSpendToman: true, predictedClvToman: true },
    });
    assert.ok(row);
    assert.equal(row.totalSpendToman, 0, 'وقتی پیش‌سفارش ممکن بوده و نداده، ۰ یک واقعیتِ تأییدشده است');
    assert.equal(row.avgSpendToman, 0);
    assert.equal(row.predictedClvToman, 0, 'CLVِ صفر اینجا مشتق از دادهٔ واقعی است، نه آرتیفکت');
  });

  test('مبلغِ واقعی: پیش‌سفارشِ ثبت‌شده → مقدارِ ناصفرِ درست', async () => {
    await recomputeCustomerInsight(restWithMenu, userWithPreorder);
    const row = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: restWithMenu, userId: userWithPreorder } },
      select: { totalSpendToman: true, avgSpendToman: true, predictedClvToman: true },
    });
    assert.ok(row);
    assert.equal(row.totalSpendToman, 400_000, '۲ عدد × ۲۰۰٬۰۰۰ تومان');
    assert.equal(row.avgSpendToman, 400_000, 'یک بازدید → میانگین برابرِ کل');
    assert.ok(row.predictedClvToman! > 0, 'با ورودیِ مبلغیِ واقعی، CLV باید ساخته شود');
  });

  test('دو حالت واقعاً در DB از هم تفکیک‌پذیرند (نه فقط در UI)', async () => {
    const unknown = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: restNoMenu, userId: userNoMenu } },
      select: { totalSpendToman: true },
    });
    const verifiedZero = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: restWithMenu, userId: userNoPreorder } },
      select: { totalSpendToman: true },
    });
    assert.equal(unknown!.totalSpendToman, null);
    assert.equal(verifiedZero!.totalSpendToman, 0);
    assert.notEqual(
      unknown!.totalSpendToman, verifiedZero!.totalSpendToman,
      'اگر این دو برابر شوند یعنی همان باگی که اصلاح شد برگشته',
    );
  });
});
