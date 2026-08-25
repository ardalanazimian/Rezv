import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ صداقتِ CLV/VIP (فازِ ۲، `docs/ML_CONTRACT.md`)
//
//  ── باگِ ۳: تساویِ CLV همه را VIP می‌کرد ──
//  `refreshVipFlags` مقدارِ مرزِ دهکِ برتر را می‌گرفت و بعد `gte: cutoff`
//  می‌زد. وقتی همه‌ی CLVها برابرند — که در عملِ عادی یعنی همه صفر، چون هیچ
//  رستورانی منویِ قیمت‌دار ندارد — خودِ cutoff همان مقدار می‌شد و کلِ جمعیت
//  انتخاب می‌شد. اندازه‌گیریِ زنده بعد از اجرایِ واقعیِ cron:
//    select is_vip, count(*), max(predicted_clv_toman) … group by is_vip
//    → t|30|0   و   f|8|0
//  یعنی ۳۰ نفر با ارزشِ پیش‌بینی‌شده‌ی **صفر** «VIP» اعلام شدند.
//
//  ── باگِ ۴: دو صفحه‌ی یک پنل، دو جوابِ متناقض ──
//  روی همان DB و همان ستون (`guest_profiles.global_clv_toman`):
//    /admin/overview              → platform_clv_toman = 0
//    /admin/business-intelligence → total_clv_toman = null, measured_guests = 0
//  علت: `COALESCE(sum(...),0)` فقط در اولی. طبقِ `ML_CONTRACT.md` کمبودِ
//  شواهد یعنی `null`/`insufficient_data`، نه صفر — صفر یعنی «اندازه گرفتیم
//  و هیچ بود»، ادعایی که نداریم.
// ═══════════════════════════════════════════════════════════════════════

import { fixturePhone } from './_phone.helper.mts';

// ⚠️ پیشوندِ ۰۹۲۲ مالِ همین فایل است — رجوع کن به tests/_phone.helper.mts.
const PHONE_PREFIX_FILE = '0922';

const { db } = await import('../src/lib/db.ts');
const { redis } = await import('../src/lib/redis.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { refreshVipFlags, MIN_MEASURED_FOR_VIP } = await import('../src/lib/customer-insights.ts');
const overviewRoute = await import('../src/app/api/v1/admin/overview/route.ts');
const biRoute = await import('../src/app/api/v1/admin/business-intelligence/route.ts');

const SFX = Date.now().toString(36).slice(-6);
let tenantId = '';
let restaurantId = '';
let adminToken = '';
const createdUserIds: string[] = [];

/**
 * ⚠️ `PLATFORM_ADMIN_TENANT_ID` یک متغیرِ محیطیِ **سراسری** است و `npm test`
 * همه‌ی فایل‌ها را در یک پروسه اجرا می‌کند. ست‌کردنش در `before` (که در این
 * رانر یک هوکِ ریشه‌ای است و برایِ کلِ اجرا اثر می‌گذارد) دو تستِ
 * `hours-change-approval` را با ۴۰۳ می‌شکست — دقیقاً همان نشتِ حالتِ سراسری
 * که تستِ سبزِ تک‌فایلی پنهانش می‌کرد. پس فقط دورِ همان فراخوانیِ روت ست و
 * بلافاصله به مقدارِ قبلی برگردانده می‌شود.
 */
async function asPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.PLATFORM_ADMIN_TENANT_ID;
  process.env.PLATFORM_ADMIN_TENANT_ID = tenantId;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
    else process.env.PLATFORM_ADMIN_TENANT_ID = prev;
  }
}

async function makeInsight(clv: number | null) {
  const u = await db.user.create({
    data: { phone: fixturePhone(PHONE_PREFIX_FILE), firstName: '[DEMO] مهمان' },
    select: { id: true },
  });
  createdUserIds.push(u.id);
  await db.customerInsight.create({
    data: { restaurantId, userId: u.id, totalVisits: 3, predictedClvToman: clv },
  });
  return u.id;
}

async function vipCount() {
  return db.customerInsight.count({ where: { restaurantId, isVip: true } });
}

async function clearInsights() {
  await db.customerInsight.deleteMany({ where: { restaurantId } });
}

/** فقط سطلِ خودِ این فایل (`RULES.search`) — رجوع کن به توضیحِ هم‌نام در
 *  tests/checkin-points-panel-path.integration.test.mts. */
async function clearOwnRateLimits() {
  const keys = await redis.keys('rl:srch:*');
  if (keys.length) await redis.del(...keys);
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant vip-clv ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `zz-vipclv-${SFX}`, name: '[DEMO] رستورانِ VIP', clubPrefix: 'VCL' },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: {
      tenantId, phone: fixturePhone(PHONE_PREFIX_FILE),
      role: 'owner', isActive: true,
    },
  });
  adminToken = signAccess({ sub: staff.id, kind: 'staff', tenantId, role: 'owner' });
});

after(async () => {
  await db.customerInsight.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.guestProfile.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
});

// ─────────────────────────────────────────────────────────────────────
describe('VIP — تساوی نباید همه را VIP کند (§۲۰)', () => {
  test('🔴 ۳۰ مشتری با CLVِ صفر → صفر نفر VIP (بازتولیدِ دقیقِ اندازه‌گیریِ زنده)', async () => {
    await clearInsights();
    for (let i = 0; i < 30; i++) await makeInsight(0);

    const status = await refreshVipFlags(restaurantId);

    assert.equal(await vipCount(), 0, 'CLVِ صفر هرگز «برترین» نیست');
    assert.equal(status, 'insufficient_data', 'حکم باید صریح باشد، نه اتفاقی');
  });

  test('🔴 CLVهای برابرِ غیرصفر هم VIP نمی‌سازند (گاردِ تساوی)', async () => {
    await clearInsights();
    for (let i = 0; i < 30; i++) await makeInsight(500_000);

    const status = await refreshVipFlags(restaurantId);

    assert.equal(await vipCount(), 0, 'وقتی هیچ‌کس از بقیه بالاتر نیست، «دهکِ برتر» بی‌معناست');
    assert.equal(status, 'no_discrimination');
  });

  test('🔴 CLVهای متفاوت → فقط بالایی‌ها VIP می‌شوند', async () => {
    await clearInsights();
    // ۲۰ مقدارِ کاملاً متمایز؛ دهکِ برتر = ۲ نفرِ بالا (index 0 و 1).
    for (let i = 1; i <= 20; i++) await makeInsight(i * 100_000);

    const status = await refreshVipFlags(restaurantId);
    assert.equal(status, 'ok');

    const vips = await db.customerInsight.findMany({
      where: { restaurantId, isVip: true }, select: { predictedClvToman: true },
    });
    assert.equal(vips.length, 2, `دهکِ برترِ ۲۰ نفر = ۲ نفر، دیده شد: ${vips.length}`);
    assert.deepEqual(
      vips.map(v => v.predictedClvToman).sort((a, b) => (b ?? 0) - (a ?? 0)),
      [2_000_000, 1_900_000],
      'فقط دو مقدارِ بالا',
    );
  });

  test('🔴 مشتریِ CLV-نامعلوم (null) هرگز VIP نمی‌شود', async () => {
    await clearInsights();
    for (let i = 1; i <= 20; i++) await makeInsight(i * 100_000);
    const nullUser = await makeInsight(null);

    await refreshVipFlags(restaurantId);

    const row = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId, userId: nullUser } }, select: { isVip: true },
    });
    assert.equal(row?.isVip, false, 'null یعنی «اندازه نگرفتیم»، نه «بالاترین»');
  });

  test('🔴 VIPِ کهنه در حالتِ «نمی‌دانیم» پاک می‌شود، نه اینکه بماند', async () => {
    // ⚠️ بدونِ این، تنزلِ داده (مثلاً پاک‌شدنِ مبالغ) یک VIPِ جعلی را برای
    // همیشه روشن نگه می‌داشت — سکوت بدتر از خطاست.
    await clearInsights();
    for (let i = 1; i <= 20; i++) await makeInsight(i * 100_000);
    await refreshVipFlags(restaurantId);
    assert.ok(await vipCount() > 0, 'پیش‌شرط: باید VIP وجود داشته باشد');

    await db.customerInsight.updateMany({ where: { restaurantId }, data: { predictedClvToman: null } });
    const status = await refreshVipFlags(restaurantId);

    assert.equal(await vipCount(), 0, 'پرچمِ کهنه باید صریحاً پاک شود');
    assert.equal(status, 'insufficient_data');
  });

  test('کنترلِ مثبتِ آستانه: درست زیرِ کف هیچ‌کس VIP نیست، درست بالایش می‌شود', async () => {
    await clearInsights();
    for (let i = 1; i <= MIN_MEASURED_FOR_VIP - 1; i++) await makeInsight(i * 100_000);
    assert.equal(await refreshVipFlags(restaurantId), 'insufficient_data');
    assert.equal(await vipCount(), 0);

    await makeInsight(MIN_MEASURED_FOR_VIP * 100_000);
    assert.equal(await refreshVipFlags(restaurantId), 'ok');
    assert.equal(await vipCount(), 1, `کفِ ${MIN_MEASURED_FOR_VIP} تایی: دقیقاً یک VIP`);
  });

  test('segment دست‌نخورده می‌ماند (قفلِ باگِ M11)', async () => {
    await clearInsights();
    for (let i = 1; i <= 20; i++) await makeInsight(i * 100_000);
    await db.customerInsight.updateMany({ where: { restaurantId }, data: { segment: 'at_risk' as never } });

    await refreshVipFlags(restaurantId);

    const drifted = await db.customerInsight.count({
      where: { restaurantId, segment: { not: 'at_risk' as never } },
    });
    assert.equal(drifted, 0, 'VIP فقط یک flag است، نه یک segment');
  });
});

// ─────────────────────────────────────────────────────────────────────
const adminReq = () =>
  new Request('http://x/api', { headers: { authorization: `Bearer ${adminToken}` } });
const noParams = () => ({ params: Promise.resolve({}) });

async function callOverview() {
  return asPlatformAdmin(async () => {
    const res = await overviewRoute.GET(adminReq(), noParams() as never);
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    return body;
  });
}
async function callBi() {
  return asPlatformAdmin(async () => {
    const res = await biRoute.GET(adminReq(), noParams() as never);
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    return body;
  });
}

describe('CLVِ پلتفرم — دو صفحه باید یک جواب بدهند (ML_CONTRACT)', () => {
  beforeEach(clearOwnRateLimits);

  test('کنترلِ مثبت: هر دو روت با همین توکن واقعاً ۲۰۰ می‌دهند', async () => {
    await callOverview();
    await callBi();
  });

  test('🔴 بدونِ هیچ مبلغِ اندازه‌گیری‌شده: overview هم null می‌دهد، نه ۰', async () => {
    // مبالغِ موجود موقتاً کنار گذاشته می‌شوند تا حالتِ «هیچ اندازه‌گیری» قطعی
    // بازتولید شود (هر دو کوئری سراسری‌اند و فیلترِ تنانت ندارند)، بعد دقیقاً
    // برگردانده می‌شوند.
    const snapshot = await db.guestProfile.findMany({
      where: { globalClvToman: { not: null } }, select: { userId: true, globalClvToman: true },
    });
    try {
      await db.guestProfile.updateMany({ data: { globalClvToman: null } });

      const ov = await callOverview();
      const bi = await callBi();

      assert.equal(ov.measured_guests, 0, 'پیش‌شرطِ سناریو');
      assert.equal(ov.platform_clv_toman, null, 'قبلاً COALESCE این را ۰ می‌کرد');
      assert.equal(ov.platform_clv_status, 'insufficient_data');
      assert.equal(bi.guests.total_clv_toman, null);
      assert.equal(bi.guests.measured_guests, 0);
    } finally {
      for (const s of snapshot) {
        await db.guestProfile.update({
          where: { userId: s.userId }, data: { globalClvToman: s.globalClvToman },
        });
      }
    }
  });

  test('🔴 با مبلغِ واقعی: عدد برمی‌گردد و هر دو صفحه دقیقاً یکی می‌گویند', async () => {
    const uid = await makeInsight(0);
    await db.guestProfile.upsert({
      where: { userId: uid },
      create: { userId: uid, globalVisits: 2, globalClvToman: 1_234_000 },
      update: { globalClvToman: 1_234_000 },
    });
    try {
      const ov = await callOverview();
      const bi = await callBi();

      assert.notEqual(ov.platform_clv_toman, null, 'وقتی داده هست باید عدد بدهد (نه همیشه null)');
      assert.equal(ov.platform_clv_status, 'measured');
      assert.ok(ov.platform_clv_toman >= 1_234_000);
      assert.equal(ov.platform_clv_toman, bi.guests.total_clv_toman, 'دو صفحه، یک عدد');
      assert.equal(ov.measured_guests, bi.guests.measured_guests, 'دو صفحه، یک مخرج');
      assert.equal(ov.total_guests, bi.guests.total, 'دو صفحه، یک جمعیت');
    } finally {
      await db.guestProfile.deleteMany({ where: { userId: uid } });
    }
  });

  test('🔴 نگهبانِ ثابت: هرگاه measured_guests صفر باشد، CLV هم باید null باشد', async () => {
    // ثابتِ قراردادی، مستقل از اینکه در لحظه‌ی اجرا چه داده‌ای در DB هست.
    const ov = await callOverview();
    const bi = await callBi();
    if (ov.measured_guests === 0) {
      assert.equal(ov.platform_clv_toman, null);
      assert.equal(ov.platform_clv_status, 'insufficient_data');
    } else {
      assert.notEqual(ov.platform_clv_toman, null);
      assert.equal(ov.platform_clv_status, 'measured');
    }
    assert.equal(ov.platform_clv_toman, bi.guests.total_clv_toman);
  });
});
