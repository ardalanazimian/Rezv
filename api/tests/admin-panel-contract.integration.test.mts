import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ پنلِ شرکت: هر فیلدی که فرانت از هشت endpointِ ادمین می‌خواند
//
//  ⚠️ چرا این فایل ساخته شد (۲۰۲۶-۰۸-۲۹): کوئریِ زنده نشان داد
//  `PLATFORM_ADMIN_TENANT_ID` در `.env` خالی است و هیچ ردیفِ ادمینِ پلتفرمی
//  وجود ندارد — یعنی پنلِ شرکت **مستقل از پیامک هم هرگز قابلِ ورود نبوده**،
//  و این هشت endpoint بیرونِ تست هرگز با توکنِ واقعی اجرا نشده بودند.
//
//  در همان روز با توکنِ واقعی همه زده شدند و **هیچ واگرایی‌ای پیدا نشد**.
//  این فایل آن نتیجه را از یک عکسِ لحظه‌ای به یک خاصیت تبدیل می‌کند: همان
//  الگویِ `me-reservations-contract` — شکلِ خروجیِ **واقعیِ route** در برابرِ
//  فهرستِ فیلدهایی که کلاینت **واقعاً** می‌خواند. اگر کسی فیلدی را در سرور
//  rename کند، این‌جا قرمز می‌شود، نه در مرورگرِ مدیر.
//
//  منبعِ هر جدول grepِ همان روز است (فایل:خط در کنارِ هر جدول).
//  افزودنِ مصرف‌کننده‌ی تازه در پنل = افزودنِ ردیف به همان جدول.
//
//  ⚠️ همه‌چیز داخلِ **یک** describe — هوکِ سطحِ فایل به سوئیتِ ROOT می‌چسبد
//  (درسِ `password-login` و `_all.runner`). این فایل env را دست‌کاری می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const overview = await import('../src/app/api/v1/admin/overview/route');
const restaurants = await import('../src/app/api/v1/admin/restaurants/route');
const control = await import('../src/app/api/v1/admin/restaurants/[id]/control/route');
const sms = await import('../src/app/api/v1/admin/restaurants/[id]/sms/route');
const bi = await import('../src/app/api/v1/admin/business-intelligence/route');
const security = await import('../src/app/api/v1/admin/security/route');
const health = await import('../src/app/api/v1/admin/system-health/route');
const settings = await import('../src/app/api/v1/admin/settings/route');

type Consumed = Array<[path: string, type: string]>;

/** apps/company/js/overview.js:5,30 · restaurant.js · intelligence.js — PLATFORM_STATS.* */
const OVERVIEW: Consumed = [
  ['platform_clv_status', 'string'],
  ['subscription_breakdown', 'object'],
  ['subscription_breakdown.active', 'number'],
  ['system_health', 'string'],
  ['total_vips', 'number'],
];

/** apps/company/js/api.js:126-151 — مپِ apiR.* رویِ هر آیتمِ restaurants[] */
const RESTAURANT_ITEM: Consumed = [
  ['id', 'string'], ['tenant_id', 'string'], ['name', 'string'],
  ['plan', 'string'], ['subscription_status', 'string'], ['days_left', 'number'],
  ['is_open', 'boolean'], ['members', 'number'], ['reservations', 'number'],
  ['sms_total_sent', 'number'], ['sms_balance', 'number'],
  ['provision_status', 'string'], ['joined_at', 'string'],
];

/** apps/company/js/intelligence.js:11-40 — d.* و آیتم‌های .map() */
const BI: Consumed = [
  ['guests.total', 'number'], ['guests.total_clv_toman', 'number'],
  ['guests.measured_guests', 'number'], ['guests.vips', 'number'],
  ['rfm_distribution', 'object'], ['behavior_segments', 'object'],
  ['top_restaurants_by_value', 'object'],
];
const BI_TOP_ITEM: Consumed = [['name', 'string'], ['customers', 'number'], ['total_clv_toman', 'number']];

/** apps/company/js/intelligence.js:560-640 — d.* و آیتم‌های flagged_abuse_users */
const SECURITY: Consumed = [
  ['coupon_abuse_signals', 'object'], ['high_no_show_customers', 'object'],
  ['recent_failed_actions', 'object'], ['economy_overview', 'object'],
  ['flagged_abuse_users', 'object'],
];
const FLAGGED_ITEM: Consumed = [
  ['user_id', 'string'], ['name', 'string'], ['reason', 'string'],
  ['flagged_by', 'string'], ['reliability_score', 'number'],
  ['reputation_tier', 'string'], ['strike_count', 'number'],
];

/** apps/company/js/intelligence.js:230-260 — d.* و آیتم‌های dead_jobs */
const HEALTH: Consumed = [
  ['health', 'string'], ['jobs.pending', 'number'], ['jobs.dead', 'number'],
  ['active_webhooks', 'number'], ['failed_actions_24h', 'number'],
  ['queue_stuck', 'boolean'], ['dead_jobs', 'object'],
];
const DEAD_JOB_ITEM: Consumed = [['kind', 'string'], ['error', 'string'], ['attempts', 'number']];

/** apps/company/js/intelligence.js:118,164 — res.data.balance · res.data.plan_expires_at */
const SMS_TOPUP: Consumed = [['balance', 'number']];
const CONTROL_EXTEND: Consumed = [['plan_expires_at', 'string']];

function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

// ⚠️ `type` نوعِ **غیرِ null** است. فیلدهای nullable (total_clv_toman،
// reason) وقتی null باشند از چکِ نوع رد می‌شوند ولی وجودشان همچنان الزامی
// است. نسخه‌ی اولِ این جدول برایِ آن‌ها 'object' نوشته بود — که فقط چون
// امروز null بودند سبز می‌ماند و روزِ اندازه‌گیریِ واقعی به‌دروغ قرمز می‌شد.
function assertConsumed(body: unknown, table: Consumed, label: string) {
  assert.ok(table.length > 0, `${label}: جدولِ خالی یعنی هیچ‌چیز سنجیده نمی‌شود`);
  for (const [path, type] of table) {
    const v = at(body, path);
    assert.notEqual(v, undefined, `${label}: فیلدِ مصرف‌شده‌ی «${path}» در پاسخِ واقعی نیست`);
    if (v !== null) assert.equal(typeof v, type, `${label}: نوعِ «${path}» باید ${type} باشد، ${typeof v} است`);
  }
}

const SFX = String(Date.now()).slice(-7);
const saved: Record<string, string | undefined> = {};
let platformTenantId = '';
let bizTenantId = '';
let restaurantId = '';
let userId = '';
let token = '';

function req(method: string, body?: unknown) {
  return new Request('http://x/api', {
    method,
    headers: {
      'content-type': 'application/json', 'x-real-ip': testIp(),
      authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('قراردادِ پنلِ شرکت — هشت endpointِ ادمین در برابرِ آنچه فرانت می‌خواند', () => {
  before(async () => {
    saved.PLATFORM_ADMIN_TENANT_ID = process.env.PLATFORM_ADMIN_TENANT_ID;

    const pt = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-plat` }, select: { id: true } });
    platformTenantId = pt.id;
    process.env.PLATFORM_ADMIN_TENANT_ID = pt.id;
    const admin = await db.staff.create({
      data: { tenantId: pt.id, phone: fixturePhone('0961'), name: '[DEMO] مدیر', role: 'owner', isActive: true },
      select: { id: true },
    });
    token = signAccess({ sub: admin.id, kind: 'staff', tenantId: pt.id, role: 'owner' });

    // یک کسب‌وکارِ واقعی تا آرایه‌ها **غیرخالی** باشند — وگرنه گارد رویِ [] سبز
    // می‌ماند در حالی که هیچ آیتمی سنجیده نشده (قاعده‌ی ۵ِ CLAUDE.md).
    const bt = await db.tenant.create({
      data: { name: `[DEMO] ${SFX}-biz`, plan: 'pro', planExpiresAt: new Date(Date.now() + 30 * 86400_000) },
      select: { id: true },
    });
    bizTenantId = bt.id;
    const r = await db.restaurant.create({
      data: { tenantId: bt.id, slug: `demo-contract-${SFX}`, name: '[DEMO] رستورانِ قرارداد', clubPrefix: 'DCT', isOpen: true, smsBalance: 50 },
      select: { id: true },
    });
    restaurantId = r.id;

    // یک کاربرِ علامت‌خورده تا flagged_abuse_users غیرخالی باشد.
    const u = await db.user.create({ data: { phone: fixturePhone('0962'), firstName: '[DEMO]', lastName: 'مشتری' }, select: { id: true } });
    userId = u.id;
    // ⚠️ بدونِ .catch: اگر fixture ساخته نشود باید همین‌جا بترکد، نه اینکه
    // تستِ پایین رویِ آرایه‌ی خالی بی‌صدا سبز بماند (قاعده‌ی ۵ِ CLAUDE.md).
    // معیارِ واقعیِ listFlaggedAbuseUsers (fraud.ts): `hasActiveAbuseFlag: true`.
    await db.customerEconomyProfile.create({
      data: { userId: u.id, reliabilityScore: 40, reputationTier: 'restricted', strikeCount: 2,
              hasActiveAbuseFlag: true, lastViolationAt: new Date() },
    });
    await db.auditLog.create({
      data: { action: 'security.abuse_flag', actorType: 'admin', targetId: u.id, success: true, detail: { manual: true, reason: 'demo' } },
    });

    // یک jobِ مرده تا dead_jobs غیرخالی باشد.
    await db.job.create({
      data: { kind: 'sms.send', status: 'dead', attempts: 5, lastError: 'demo', payload: {} },
    });
  });

  after(async () => {
    if (saved.PLATFORM_ADMIN_TENANT_ID === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
    else process.env.PLATFORM_ADMIN_TENANT_ID = saved.PLATFORM_ADMIN_TENANT_ID;
    await db.job.deleteMany({ where: { lastError: 'demo' } }).catch(() => {});
    await db.auditLog.deleteMany({ where: { targetId: userId } }).catch(() => {});
    await db.customerEconomyProfile.deleteMany({ where: { userId } }).catch(() => {});
    await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
    await db.auditLog.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { tenantId: bizTenantId } });
    await db.staff.deleteMany({ where: { tenantId: { in: [platformTenantId, bizTenantId] } } });
    await db.tenant.deleteMany({ where: { id: { in: [platformTenantId, bizTenantId] } } });
    await db.$disconnect();
  });

  test('overview — PLATFORM_STATS.* موجود و درست‌نوع', async () => {
    const res = await overview.GET(req('GET'));
    assert.equal(res.status, 200);
    assertConsumed(await res.json(), OVERVIEW, 'overview');
  });

  test('restaurants — هر ۱۳ فیلدِ مپِ api.js رویِ یک آیتمِ **واقعی**', async () => {
    const res = await restaurants.GET(req('GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.restaurants), 'شکلِ بالایی {restaurants:[…]} است — همان که api.js:126 می‌خواند');
    const mine = body.restaurants.find((x: { id: string }) => x.id === restaurantId);
    assert.ok(mine, 'رستورانِ fixture باید در فهرست باشد — وگرنه هیچ آیتمی سنجیده نمی‌شود');
    assertConsumed(mine, RESTAURANT_ITEM, 'restaurants[i]');
  });

  test('restaurants/[id]/sms — GET و POST؛ res.data.balance', async () => {
    const g = await sms.GET(req('GET'), params(restaurantId));
    assert.equal(g.status, 200);
    assertConsumed(await g.json(), SMS_TOPUP, 'sms GET');
    const p = await sms.POST(req('POST', { amount: 10 }), params(restaurantId));
    assert.equal(p.status, 200);
    const pb = await p.json();
    assertConsumed(pb, SMS_TOPUP, 'sms POST');
    assert.equal(pb.balance, 60, 'کنترلِ مثبت: ۵۰ + ۱۰ — نه فقط «فیلد هست»');
  });

  test('restaurants/[id]/control — extend_plan؛ res.data.plan_expires_at', async () => {
    const res = await control.PATCH(req('PATCH', { action: 'extend_plan', plan: 'pro', months: 12 }), params(restaurantId));
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assertConsumed(body, CONTROL_EXTEND, 'control');
    assert.ok(new Date(body.plan_expires_at).getTime() > Date.now() + 300 * 86400_000,
      'کنترلِ مثبت: ۱۲ ماه جلوتر — نه یک رشته‌ی دلخواه');
  });

  test('business-intelligence — d.* و آیتمِ top_restaurants_by_value', async () => {
    const res = await bi.GET(req('GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assertConsumed(body, BI, 'bi');
    if (body.top_restaurants_by_value.length) assertConsumed(body.top_restaurants_by_value[0], BI_TOP_ITEM, 'bi.top[0]');
  });

  test('security — d.* و آیتمِ flagged_abuse_users (غیرخالی)', async () => {
    const res = await security.GET(req('GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assertConsumed(body, SECURITY, 'security');
    const mine = body.flagged_abuse_users.find((x: { user_id: string }) => x.user_id === userId);
    assert.ok(mine, 'کاربرِ علامت‌خورده‌ی fixture باید در فهرست باشد — نبودِ موضوع باید خطا باشد، نه عبور');
    assertConsumed(mine, FLAGGED_ITEM, 'security.flagged[i]');
  });

  test('system-health — d.* و آیتمِ dead_jobs (غیرخالی)', async () => {
    const res = await health.GET(req('GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assertConsumed(body, HEALTH, 'health');
    assert.ok(body.dead_jobs.length >= 1, 'jobِ مرده‌ی fixture باید در dead_jobs باشد');
    assertConsumed(body.dead_jobs[0], DEAD_JOB_ITEM, 'health.dead_jobs[0]');
  });

  test('settings — {settings:{…}} (هیچ خواننده‌ای در پنلِ شرکت نیست؛ فقط شکلِ بالایی پین می‌شود)', async () => {
    const res = await settings.GET(req('GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.settings, 'object');
    assert.notEqual(body.settings, null);
  });
});
