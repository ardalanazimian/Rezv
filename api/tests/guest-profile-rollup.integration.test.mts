import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  rollupِ سراسریِ مهمانان (rebuildGuestProfiles) — تستِ integration زنده
//
//  باگِ واقعی که این تست قفلش می‌کند (ممیزیِ زنده‌ی پنلِ کمپانی، ۲۰۲۶-۰۸-۱۹):
//  migrationِ ۰۴۶ ستون‌هایِ مبلغیِ customer_insights را nullable کرد، ولی
//  مقصدِ rollup (guest_profiles) هنوز NOT NULL DEFAULT 0 بود. در SQL اگر
//  همه‌ی ردیف‌هایِ یک گروه NULL باشند، sum() هم NULL می‌دهد — پس **یک**
//  مهمان با مبلغِ اندازه‌گیری‌ناپذیر کافی بود تا کلِ `INSERT ... SELECT`
//  با خطایِ not-null بشکند و *هیچ‌کدام* از پروفایل‌ها نوشته نشود.
//
//  اثرش در تولید: پنلِ کمپانی همه‌ی معیارهایِ سراسری‌اش را از این جدول
//  می‌خواند، پس «۰ مهمان / ۰ VIP / ۰ CLV» نشان می‌داد — نه چون داده صفر بود،
//  بلکه چون جدول خالی مانده بود. شکستِ کامل، به‌شکلِ دادهٔ صفر.
//
//  چرا integration و نه mock: ادعا دقیقاً درباره‌ی رفتارِ NOT NULL و
//  sum()/NULL در خودِ Postgres است. با mock همان چیزی که باید اثبات شود
//  فرض گرفته می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { rebuildGuestProfiles } = await import('../src/lib/guest-profile');

let tenantId: string;
let restNoMenu: string;    // منویِ قیمت‌دار ندارد → مبلغ اندازه‌گیری‌ناپذیر
let restWithMenu: string;  // منویِ قیمت‌دار دارد → مبلغ اندازه‌گیری‌پذیر
let userUnmeasurable: string;
let userMeasurable: string;

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] gp-${s}` }, select: { id: true } });
  tenantId = t.id;

  const a = await db.restaurant.create({
    data: { tenantId, slug: `zz-gp-nomenu-${s}`, name: `[DEMO] بدونِ منو ${s}`, clubPrefix: 'GPA' },
    select: { id: true },
  });
  restNoMenu = a.id;

  const b = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-gp-menu-${s}`, name: `[DEMO] با منو ${s}`, clubPrefix: 'GPB',
      menuItems: { create: [{ name: '[DEMO] آیتم', priceToman: 100_000 }] },
    },
    select: { id: true },
  });
  restWithMenu = b.id;

  const u1 = await db.user.create({ data: { phone: `+98916${s.slice(-7)}`.slice(0, 13) }, select: { id: true } });
  const u2 = await db.user.create({ data: { phone: `+98917${s.slice(-7)}`.slice(0, 13) }, select: { id: true } });
  userUnmeasurable = u1.id; userMeasurable = u2.id;

  // مهمانِ ۱: تنها رستورانش منویِ قیمت‌دار ندارد → مبلغ NULL (نامعلوم)
  await db.customerInsight.create({
    data: {
      restaurantId: restNoMenu, userId: userUnmeasurable, totalVisits: 1,
      totalSpendToman: null, avgSpendToman: null, predictedClvToman: null,
      lastVisitAt: new Date(Date.now() - 86_400_000),
    },
  });
  // مهمانِ ۲: مبلغِ واقعی دارد
  await db.customerInsight.create({
    data: {
      restaurantId: restWithMenu, userId: userMeasurable, totalVisits: 3,
      totalSpendToman: 300_000, avgSpendToman: 100_000, predictedClvToman: 450_000,
      lastVisitAt: new Date(Date.now() - 86_400_000),
    },
  });
});

after(async () => {
  await db.guestProfile.deleteMany({ where: { userId: { in: [userUnmeasurable, userMeasurable] } } });
  await db.customerInsight.deleteMany({ where: { restaurantId: { in: [restNoMenu, restWithMenu] } } });
  await db.menuItem.deleteMany({ where: { restaurantId: { in: [restNoMenu, restWithMenu] } } });
  await db.restaurant.deleteMany({ where: { id: { in: [restNoMenu, restWithMenu] } } });
  await db.user.deleteMany({ where: { id: { in: [userUnmeasurable, userMeasurable] } } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

describe('rollupِ پروفایلِ سراسریِ مهمانان', () => {
  test('یک مهمانِ نامعلوم کلِ rollup را نمی‌شکند (قفلِ رگرسیونِ اصلی)', async () => {
    // پیش از اصلاح، همین فراخوانی با
    // «null value in column "global_spend_toman" violates not-null constraint»
    // پرتاب می‌کرد و هیچ پروفایلی نوشته نمی‌شد.
    await rebuildGuestProfiles();

    const measurable = await db.guestProfile.findUnique({ where: { userId: userMeasurable } });
    assert.ok(measurable, 'مهمانِ دارایِ مبلغ باید پروفایل بگیرد — نه اینکه قربانیِ شکستِ مهمانِ دیگر شود');
    assert.equal(measurable.globalClvToman, 450_000);
    assert.equal(measurable.globalSpendToman, 300_000);
  });

  test('مبلغِ نامعلوم NULL می‌ماند، به ۰ تبدیل نمی‌شود', async () => {
    const row = await db.guestProfile.findUnique({ where: { userId: userUnmeasurable } });
    assert.ok(row, 'مهمانِ اندازه‌گیری‌ناپذیر هم باید پروفایل داشته باشد');
    assert.equal(row.globalSpendToman, null, 'NULL یعنی «نمی‌دانیم»؛ ۰ یعنی ادعای «خرجی نکرد»');
    assert.equal(row.globalClvToman, null);
    assert.equal(row.globalVisits, 1, 'تعدادِ بازدید مشاهده‌شده است و باید عددِ واقعی بماند');
  });

  test('اجرایِ دوباره idempotent است (ON CONFLICT DO UPDATE)', async () => {
    await rebuildGuestProfiles();
    const rows = await db.guestProfile.findMany({ where: { userId: { in: [userUnmeasurable, userMeasurable] } } });
    assert.equal(rows.length, 2, 'نباید ردیفِ تکراری بسازد');
    assert.equal(rows.find(r => r.userId === userUnmeasurable)!.globalClvToman, null);
  });
});
