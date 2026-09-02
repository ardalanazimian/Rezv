import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
import { readFileSync } from 'node:fs';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردهایِ امنیتی — `maintenance-auth.ts` و `admin-auth.ts`
//
//  هر دو تا امروز **صفر تست** داشتند، با اینکه رویِ حساس‌ترین مرزهایِ
//  سامانه نشسته‌اند: یکی درِ cronهایی که داده پاک می‌کنند، دیگری درِ
//  پنلِ شرکت با ۴۶ نقطه‌ی فراخوانی.
//
//  ⚠️ باگِ ۱ — `guardMaintenance` شاخه‌ی `CRON_SECRET` را با `===` مقایسه
//     می‌کرد، نه constant-time، در حالی که شاخه‌ی خواهرش `timingSafeEqual`
//     دارد و کامنتِ بالای فایل مدعیِ حفاظتِ constant-time برایِ کلِ تابع
//     است. از دو درِ یک اتاق، یکی سفت شده بود و دیگری نه.
//
//  ⚠️ باگِ ۲ — `adminAuthFromRequest` **هیچ کوئریِ دیتابیسی نداشت**؛ فقط
//     JWT را باور می‌کرد. مدیرِ پلتفرمی که غیرفعال یا حذف می‌شد، تا انقضایِ
//     توکنِ فعلی‌اش (۱۵ دقیقه) کلِ دسترسیِ پنلِ شرکت را نگه می‌داشت.
//     همین شکاف یک طبقه پایین‌تر در PR #57 بسته شده بود
//     (`staff-helpers.ts` → عضویتِ تنانت + `isActive`)، ولی در سطحِ
//     *بالاتر* اضافه نشده بود.
// ═══════════════════════════════════════════════════════════════════════

/** خواندنِ سورس برایِ تست‌هایی که ریشه‌ی باگ را قفل می‌کنند، نه یک نمونه را. */
function readSource(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { guardMaintenance } = await import('../src/lib/maintenance-auth');
const { requireAdmin } = await import('../src/lib/admin-auth');

const ORIG = {
  maint: process.env.MAINTENANCE_KEY,
  cron: process.env.CRON_SECRET,
  tenant: process.env.PLATFORM_ADMIN_TENANT_ID,
};

let platformTenantId: string;
let otherTenantId: string;
let ownerId: string;          // مدیرِ پلتفرمِ سالم
let inactiveOwnerId: string;  // همان تنانت، ولی غیرفعال
let managerId: string;        // همان تنانت، ولی نقشِ پایین‌تر
let outsiderOwnerId: string;  // ownerِ یک تنانتِ دیگر

const phone = () => `+9894${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13);

const req = (headers: Record<string, string> = {}) =>
  new Request('http://x/api/admin', { headers: { 'x-real-ip': testIp(), ...headers } });

/** توکنِ staff با ادعایِ دلخواه — تا بتوانیم «توکنِ معتبر ولی کهنه» بسازیم. */
const staffToken = (sub: string, tenantId: string, role: 'owner' | 'manager' | 'staff' = 'owner') =>
  signAccess({ sub, kind: 'staff', tenantId, role });

before(async () => {
  const s = Date.now().toString(36);
  const pt = await db.tenant.create({ data: { name: `[DEMO] guards-platform-${s}` }, select: { id: true } });
  const ot = await db.tenant.create({ data: { name: `[DEMO] guards-other-${s}` }, select: { id: true } });
  platformTenantId = pt.id;
  otherTenantId = ot.id;

  const mk = async (tenantId: string, role: 'owner' | 'manager', isActive: boolean) =>
    (await db.staff.create({
      data: { tenantId, role, isActive, phone: phone() },
      select: { id: true },
    })).id;

  ownerId = await mk(platformTenantId, 'owner', true);
  inactiveOwnerId = await mk(platformTenantId, 'owner', false);
  managerId = await mk(platformTenantId, 'manager', true);
  outsiderOwnerId = await mk(otherTenantId, 'owner', true);
});

// ⚠️ بازیابیِ محیط از هوکِ **ریشه‌ای** بیرون آمد (۲۰۲۶-۰۸-۲۷). تک‌تکِ
// تست‌های این فایل عمداً `MAINTENANCE_KEY`/`CRON_SECRET`/
// `PLATFORM_ADMIN_TENANT_ID` را ست یا حذف می‌کنند؛ تا دیروز بازگرداندنشان در
// `after`ِ ریشه بود که در رانرِ تک-process فقط در **پایانِ کلِ ران** اجرا
// می‌شود — یعنی بعد از این فایل، همه‌ی فایل‌های بعدی محیطِ آلوده را می‌دیدند.
// حالا `afterEach` در هر دو describe، پنجره را به یک تست محدود می‌کند.
function restoreAuthEnv() {
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  };
  set('MAINTENANCE_KEY', ORIG.maint);
  set('CRON_SECRET', ORIG.cron);
  set('PLATFORM_ADMIN_TENANT_ID', ORIG.tenant);
}

after(async () => {
  await db.staff.deleteMany({ where: { tenantId: { in: [platformTenantId, otherTenantId] } } });
  await db.tenant.deleteMany({ where: { id: { in: [platformTenantId, otherTenantId] } } });
});

// ─────────────────────────────────────────────────────────────────────
describe('guardMaintenance — درِ cronها', () => {
  afterEach(restoreAuthEnv);

  test('کلیدِ درست از هدرِ x-maintenance-key رد می‌شود', () => {
    process.env.MAINTENANCE_KEY = 'maint-secret-abc';
    delete process.env.CRON_SECRET;
    assert.equal(guardMaintenance(req({ 'x-maintenance-key': 'maint-secret-abc' })), null);
  });

  test('کلیدِ غلط → ۴۰۱', () => {
    process.env.MAINTENANCE_KEY = 'maint-secret-abc';
    delete process.env.CRON_SECRET;
    assert.equal(guardMaintenance(req({ 'x-maintenance-key': 'wrong' }))?.status, 401);
  });

  test('بدونِ هیچ هدری → ۴۰۱', () => {
    process.env.MAINTENANCE_KEY = 'maint-secret-abc';
    assert.equal(guardMaintenance(req())?.status, 401);
  });

  test('⚠️ هیچ‌کدام از دو متغیر ست نشده → ۴۰۱ (fail-closed، نه fail-open)', () => {
    // ⚠️ اگر روزی کسی این را به «بدونِ پیکربندی، همه رد شوند» عوض کند،
    //    cronهایِ پاک‌کننده‌ی داده عمومی می‌شوند.
    delete process.env.MAINTENANCE_KEY;
    delete process.env.CRON_SECRET;
    assert.equal(guardMaintenance(req({ 'x-maintenance-key': 'anything' }))?.status, 401);
  });

  test('مسیرِ CRON_SECRET با Bearerِ درست رد می‌شود', () => {
    delete process.env.MAINTENANCE_KEY;
    process.env.CRON_SECRET = 'cron-secret-xyz';
    assert.equal(guardMaintenance(req({ authorization: 'Bearer cron-secret-xyz' })), null);
  });

  test('⚠️ مسیرِ CRON_SECRET پیشوندِ ناقص را رد می‌کند (مقایسه‌ی جزئی نه)', () => {
    // ⚠️ قفلِ باگِ ۱. با `===`ِ قبلی هم این تست سبز بود، ولی همراهِ تستِ
    //    بعدی ثابت می‌کند مقایسه واقعاً کاملِ رشته است.
    delete process.env.MAINTENANCE_KEY;
    process.env.CRON_SECRET = 'cron-secret-xyz';
    assert.equal(guardMaintenance(req({ authorization: 'Bearer cron-secret-xy' }))?.status, 401);
    assert.equal(guardMaintenance(req({ authorization: 'Bearer cron-secret-xyz1' }))?.status, 401);
  });

  test('⚠️ هر دو مسیر constant-time مقایسه می‌کنند (نه `===`)', () => {
    // ⚠️ این تست کد را می‌خواند، نه رفتار را: تفاوتِ زمانیِ `===` با
    //    `timingSafeEqual` در یک تستِ واحد قابلِ اندازه‌گیریِ پایدار نیست،
    //    ولی ریشه‌ی باگ «یک شاخه سفت، شاخه‌ی خواهر نه» بود — پس همان را
    //    مستقیم قفل می‌کنیم.
    const src = readSource('../src/lib/maintenance-auth.ts');
    const bearerCompare = /authz\s*===\s*`Bearer/.test(src);
    assert.equal(bearerCompare, false, 'مسیرِ CRON_SECRET نباید با === مقایسه کند');
    assert.match(src, /safeEqual\(authz, `Bearer \$\{cronSecret\}`\)/);
  });

  test('کلیدِ درست ولی در هدرِ اشتباه کار نمی‌کند', () => {
    process.env.MAINTENANCE_KEY = 'maint-secret-abc';
    delete process.env.CRON_SECRET;
    assert.equal(guardMaintenance(req({ authorization: 'Bearer maint-secret-abc' }))?.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('requireAdmin — درِ پنلِ شرکت', () => {
  afterEach(restoreAuthEnv);

  test('مدیرِ پلتفرمِ سالم عبور می‌کند (کنترلِ مثبت)', async () => {
    // بدونِ این، گاردی که *همیشه* رد کند هم بقیه‌ی تست‌ها را پاس می‌کرد.
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const out = await requireAdmin(req({ authorization: `Bearer ${staffToken(ownerId, platformTenantId)}` }));
    assert.equal(out.sub, ownerId);
    assert.equal(out.tenantId, platformTenantId);
  });

  test('⚠️ مدیرِ غیرفعال‌شده رد می‌شود، حتی با توکنِ هنوز-معتبر', async () => {
    // ⚠️ قفلِ باگِ ۲. پیش از رفع، این توکن تا ۱۵ دقیقه کارِ خودش را می‌کرد
    //    چون گارد اصلاً به دیتابیس نگاه نمی‌کرد.
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const token = staffToken(inactiveOwnerId, platformTenantId);
    await assert.rejects(() => requireAdmin(req({ authorization: `Bearer ${token}` })));
  });

  test('⚠️ حسابِ حذف‌شده رد می‌شود', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const ghost = await db.staff.create({
      data: { tenantId: platformTenantId, role: 'owner', isActive: true, phone: phone() },
      select: { id: true },
    });
    const token = staffToken(ghost.id, platformTenantId);
    await db.staff.delete({ where: { id: ghost.id } });
    await assert.rejects(() => requireAdmin(req({ authorization: `Bearer ${token}` })));
  });

  test('⚠️ توکنی که نقشش owner می‌گوید ولی DB می‌گوید manager، رد می‌شود', async () => {
    // ⚠️ توکن عکسِ لحظه‌ی صدور است. اگر نقشِ کسی پایین آورده شود، توکنِ
    //    قدیمی‌اش نباید همچنان درِ پنلِ شرکت را باز کند.
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const staleToken = staffToken(managerId, platformTenantId, 'owner');
    await assert.rejects(() => requireAdmin(req({ authorization: `Bearer ${staleToken}` })));
  });

  test('⚠️ PLATFORM_ADMIN_TENANT_ID ست نشده → هیچ‌کس (fail-closed)', async () => {
    // ⚠️ باگِ تاریخیِ C2: قبلاً نبودِ این متغیر یعنی چکِ تنانت کلاً نادیده
    //    گرفته شود و «هر» صاحبِ رستورانی به پنلِ شرکت برسد.
    delete process.env.PLATFORM_ADMIN_TENANT_ID;
    await assert.rejects(() =>
      requireAdmin(req({ authorization: `Bearer ${staffToken(ownerId, platformTenantId)}` })));
  });

  test('ownerِ تنانتِ دیگر رد می‌شود (جداسازیِ پلتفرم)', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    await assert.rejects(() =>
      requireAdmin(req({ authorization: `Bearer ${staffToken(outsiderOwnerId, otherTenantId)}` })));
  });

  test('بدونِ هدرِ Authorization رد می‌شود', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    await assert.rejects(() => requireAdmin(req()));
  });

  test('توکنِ دست‌کاری‌شده رد می‌شود (امضا واقعاً بررسی می‌شود)', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const good = staffToken(ownerId, platformTenantId);
    const tampered = good.slice(0, -3) + 'AAA';
    await assert.rejects(() => requireAdmin(req({ authorization: `Bearer ${tampered}` })));
  });

  test('⚠️ گارد واقعاً از دیتابیس می‌خواند (نه فقط از توکن)', async () => {
    // ⚠️ ریشه‌ی باگ «هیچ کوئریِ دیتابیسی نداشت» بود، نه یک شرطِ خاص. پس
    //    خودِ کد را قفل می‌کنیم تا اگر کسی کوئری را بردارد همین‌جا بشکند.
    const src = readSource('../src/lib/admin-auth.ts');
    assert.match(src, /db\.staff\.findUnique/, 'باید وضعیتِ فعلیِ کارمند را از DB بپرسد');
    assert.match(src, /isActive/, 'باید فعال‌بودن را چک کند');
  });
});

