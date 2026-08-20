import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۸ — حلقه‌ی بازخوردِ توصیه‌های CRM، رویِ Postgresِ واقعی
//
//  نقصی که این تست‌ها قفلش می‌کنند (ممیزیِ ۲۰۲۶-۰۸-۲۰): موتورِ توصیه‌ی CRM
//  به رستوران‌دار می‌گفت «با کی، چرا، از چه کانالی تماس بگیر» ولی هیچ‌جا ثبت
//  نمی‌شد که تماسی گرفته شد یا نه. یعنی توصیه‌ها برای همیشه ناسنجیده می‌ماندند
//  و همان اسم فردا دوباره بالای فهرست می‌آمد.
//
//  دو نیمه‌ی حلقه جدا آزموده می‌شوند:
//    ۱) ثبت  — تماس واقعاً در دفتر می‌نشیند (و رستورانِ دیگر نمی‌تواند بنشاند)
//    ۲) عمل  — ثبت، *رفتار* توصیه‌گر را عوض می‌کند (cooldown)، نه فقط گزارش را
//  نیمه‌ی دوم مهم‌تر است: بدونِ آن، بازخورد فقط یک آمارِ تماشایی می‌شد.
//
//  روت‌هایِ واقعی با Requestِ واقعی صدا زده می‌شوند تا سیمِ auth/RBAC/
//  اعتبارسنجی هم آزموده شود، نه فقط منطقِ داخلی.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { signAccess } = await import('../src/lib/jwt');
const { invalidatePattern } = await import('../src/lib/cache');
const recsRoute = await import('../src/app/api/v1/restaurant/crm/recommendations/route');
const contactedRoute = await import('../src/app/api/v1/restaurant/crm/recommendations/contacted/route');

const TAG = Date.now().toString(36);
let restA: string, restB: string, tokenA: string, tokenB: string;
let tenantA: string, tenantB: string;
const createdUserIds: string[] = [];
let userSeq = 0;
const PHONE_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);

const req = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const ctxArg = () => ({ params: Promise.resolve({}) });

async function makeTenantWithOwner(label: string) {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-crmfb-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'CFB' },
    select: { id: true },
  });
  const staff = await db.staff.create({
    data: {
      tenantId: t.id, phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
      role: 'owner', isActive: true,
    },
    select: { id: true },
  });
  return {
    tenantId: t.id, restaurantId: r.id,
    token: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
  };
}

/**
 * مشتریِ «در خطرِ ریزش» — تا موتورِ توصیه حتماً پیشنهادش بدهد.
 * قانونِ فعال: segment === 'at_risk' → پیامک/متوسط (رجوع کن به
 * lib/crm-recommendations.ts). عمداً مشتریِ قطعیِ فهرست ساخته می‌شود تا اگر
 * روزی از فهرست بیفتد، دلیلش cooldown باشد نه ضعفِ ساختِ داده.
 */
async function makeAtRiskCustomer(restaurantId: string): Promise<string> {
  const u = await db.user.create({
    data: {
      phone: `09${PHONE_PREFIX}${String(++userSeq).padStart(5, '0')}`,
      firstName: '[DEMO] مهمان',
    },
    select: { id: true },
  });
  createdUserIds.push(u.id);
  await db.customerInsight.create({
    data: {
      restaurantId, userId: u.id, segment: 'at_risk',
      totalVisits: 4, churnRiskScore: 65, predictedClvToman: 900_000,
    },
  });
  return u.id;
}

async function fetchRecommendations(token: string) {
  await invalidatePattern('crm-recs:*'); // کشِ ۵ دقیقه‌ای نباید نتیجه‌ی تست را مخفی کند
  const res = await recsRoute.GET(req(token, undefined, 'GET'), ctxArg() as never);
  assert.equal(res.status, 200);
  return res.json();
}

before(async () => {
  // شمارنده‌ی rate-limit بینِ اجراها نشت می‌کند و از اجرای دوم ۴۲۹ می‌دهد.
  // خودِ سقفِ روت دست‌نخورده می‌ماند — فقط حالتِ نشتی صفر می‌شود.
  const stale = await redis.keys('*auth*');
  if (stale.length) await redis.del(...stale);

  const a = await makeTenantWithOwner(`a-${TAG}`);
  const b = await makeTenantWithOwner(`b-${TAG}`);
  tenantA = a.tenantId; restA = a.restaurantId; tokenA = a.token;
  tenantB = b.tenantId; restB = b.restaurantId; tokenB = b.token;
});

after(async () => {
  await db.outreachLog.deleteMany({ where: { restaurantId: { in: [restA, restB] } } });
  await db.customerInsight.deleteMany({ where: { restaurantId: { in: [restA, restB] } } });
  await db.restaurant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('فازِ ۸ — ثبتِ تماسِ توصیه‌شده', () => {
  test('POST تماس را در دفتر با منبعِ crm_recommendation ثبت می‌کند', async () => {
    const userId = await makeAtRiskCustomer(restA);

    const res = await contactedRoute.POST(req(tokenA, { user_id: userId }), ctxArg() as never);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { recorded: true });

    const rows = await db.outreachLog.findMany({ where: { restaurantId: restA, userId } });
    assert.equal(rows.length, 1, 'تماس باید دقیقاً یک ردیف بسازد');
    assert.equal(rows[0].source, 'crm_recommendation');
    assert.equal(rows[0].channel, 'call');
    assert.equal(rows[0].resolvedAt, null, 'تازه ثبت‌شده، هنوز حل نشده');
    assert.ok(rows[0].reason, 'دلیلِ انتخاب باید ثبت شود (شفافیت برای رستوران‌دار)');
  });

  test('رستورانِ B نمی‌تواند برای مشتریِ رستورانِ A تماس ثبت کند', async () => {
    // ⚠️ بدونِ این بررسی، هر رستوران می‌توانست برای هر userId دلخواهی ردیف
    // بسازد — هم آلوده‌کردنِ دفتر، هم probeای برای فهمیدنِ اینکه کدام شناسه‌ها
    // در پلتفرم وجود دارند.
    const userOfA = await makeAtRiskCustomer(restA);

    const res = await contactedRoute.POST(req(tokenB, { user_id: userOfA }), ctxArg() as never);
    assert.equal(res.status, 404, 'باید رد شود، و بدونِ فاش‌کردنِ وجود/عدمِ وجودِ کاربر');

    const leaked = await db.outreachLog.count({ where: { restaurantId: restB } });
    assert.equal(leaked, 0, 'هیچ ردیفی نباید برای رستورانِ B ساخته شده باشد');

    // کنترلِ مثبت: همان مشتری از سمتِ رستورانِ خودش پذیرفته می‌شود — یعنی
    // ۴۰۴ی بالا از ایزولاسیون است، نه از خرابیِ کلیِ endpoint.
    const ok = await contactedRoute.POST(req(tokenA, { user_id: userOfA }), ctxArg() as never);
    assert.equal(ok.status, 201);
  });

  test('شناسه‌ی نامعتبر رد می‌شود و ردیفی نمی‌سازد', async () => {
    const before = await db.outreachLog.count({ where: { restaurantId: restA } });
    const res = await contactedRoute.POST(req(tokenA, { user_id: 'not-a-uuid' }), ctxArg() as never);
    assert.ok(res.status >= 400 && res.status < 500, `انتظار ۴xx، دریافت ${res.status}`);
    assert.equal(await db.outreachLog.count({ where: { restaurantId: restA } }), before);
  });
});

describe('فازِ ۸ — بازخورد رفتارِ توصیه‌گر را عوض می‌کند', () => {
  test('مشتریِ تازه‌تماس‌گرفته‌شده از فهرستِ توصیه‌ها حذف می‌شود', async () => {
    const userId = await makeAtRiskCustomer(restA);

    // کنترلِ مثبت *قبل* از تماس: باید در فهرست باشد. بدونِ این، تستِ حذف
    // می‌توانست به‌دلیلِ اینکه اصلاً هرگز توصیه نشده سبز شود.
    const before = await fetchRecommendations(tokenA);
    assert.ok(before.items.some((i: { user_id: string }) => i.user_id === userId),
      'پیش‌شرط: مشتریِ at_risk باید توصیه شود');

    await contactedRoute.POST(req(tokenA, { user_id: userId }), ctxArg() as never);

    const after = await fetchRecommendations(tokenA);
    assert.ok(!after.items.some((i: { user_id: string }) => i.user_id === userId),
      'پس از ثبتِ تماس نباید دوباره توصیه شود — وگرنه حلقه بسته نیست، فقط مشاهده شده');
    assert.ok(after.suppressed_count >= 1);
  });

  test('پس از پایانِ cooldown دوباره توصیه می‌شود', async () => {
    // ⚠️ این تست نیمه‌ی دیگرِ ادعا است: cooldown باید *موقت* باشد. بدونِ آن،
    // یک تماس مشتری را برای همیشه از فهرست حذف می‌کرد — که خودش یک باگ است،
    // نه یک قابلیت.
    const userId = await makeAtRiskCustomer(restA);
    await contactedRoute.POST(req(tokenA, { user_id: userId }), ctxArg() as never);

    const during = await fetchRecommendations(tokenA);
    assert.ok(!during.items.some((i: { user_id: string }) => i.user_id === userId));

    const past = new Date(Date.now() - (during.cooldown_days + 1) * 86_400_000);
    await db.outreachLog.updateMany({
      where: { restaurantId: restA, userId, source: 'crm_recommendation' },
      data: { sentAt: past },
    });

    const later = await fetchRecommendations(tokenA);
    assert.ok(later.items.some((i: { user_id: string }) => i.user_id === userId),
      'cooldown باید منقضی شود — حذفِ دائمی باگ است، نه قابلیت');
  });

  test('اثربخشی زیرِ کفِ نمونه null است، نه صفر', async () => {
    // همان قاعده‌ی بندِ ۲۰ که کلِ این مجموعه تغییرات از آن آمد: «نمی‌دانیم»
    // هرگز نباید به عددی که ادعای اندازه‌گیری دارد ترجمه شود.
    const data = await fetchRecommendations(tokenA);
    const e = data.effectiveness;
    assert.ok(e, 'پاسخ باید بخشِ اثربخشی داشته باشد');
    assert.ok(e.contacted_count > 0, 'پیش‌شرط: در تست‌های بالا تماس ثبت شده');
    assert.ok(e.resolved_count < e.min_resolved, 'پیش‌شرط: هنوز زیرِ کف');
    assert.equal(e.conversion_rate_pct, null, 'زیرِ کف باید null باشد، نه صفر');
    assert.equal(e.conversion_status, 'insufficient_data');
  });

  test('cooldownِ رستورانِ A روی توصیه‌های رستورانِ B اثر ندارد', async () => {
    // دفتر per-restaurant خوانده می‌شود؛ تماسِ یک رستوران نباید مشتری را از
    // فهرستِ رستورانِ دیگر حذف کند.
    const shared = await makeAtRiskCustomer(restA);
    await db.customerInsight.create({
      data: {
        restaurantId: restB, userId: shared, segment: 'at_risk',
        totalVisits: 4, churnRiskScore: 65, predictedClvToman: 900_000,
      },
    });
    await contactedRoute.POST(req(tokenA, { user_id: shared }), ctxArg() as never);

    const bList = await fetchRecommendations(tokenB);
    assert.ok(bList.items.some((i: { user_id: string }) => i.user_id === shared),
      'تماسِ رستورانِ A نباید مشتری را از فهرستِ رستورانِ B حذف کند');
  });
});
