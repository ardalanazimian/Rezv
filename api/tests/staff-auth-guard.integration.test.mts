import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
import { readFileSync } from 'node:fs';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ `withStaffAuth` — مرزِ مدیریتِ کارکنان
//
//  ⚠️ باگی که این فایل از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۲): `withStaffAuth`
//  **هیچ کوئریِ دیتابیسی نداشت** — فقط امضایِ JWT را بررسی می‌کرد. تنها
//  مصرف‌کننده‌اش `restaurant/staff/route.ts` است، یعنی دقیقاً همان جایی که
//  کارکنان اضافه و غیرفعال می‌شوند.
//
//  نتیجه: مدیری که همین حالا اخراج (`is_active=false`) شده بود، تا ۱۵ دقیقه
//  — عمرِ accessِ بدونِ لیستِ ابطال — هنوز کاملاً کار می‌کرد و می‌توانست:
//    ۱) `PATCH` بزند با شناسه‌ی خودش و `is_active: true` و **خودش را دوباره
//       فعال کند** (گاردهایِ آن روت فقط جهتِ `false` را می‌گرفتند) — یعنی
//       پنجره‌ی ۱۵ دقیقه‌ای به دسترسیِ **دائمی** تبدیل می‌شد؛
//    ۲) کارمندِ جدیدی با شماره‌ی خودش بسازد (درِ پشتیِ ماندگار)؛
//    ۳) کلِ فهرستِ کارکنان و شماره‌هایشان را بخواند.
//
//  یعنی «اخراجِ کارمند» به‌عنوانِ یک کنترلِ امنیتی عملاً کار نمی‌کرد.
//
//  خواهرش `withRestaurantAuth` این شکاف را نداشت (چون `resolveStaffRestaurant`
//  را صدا می‌زند که از ۲۰۲۶-۰۸-۲۰ `isActive` و عضویتِ تنانت را چک می‌کند) —
//  دو درِ یک اتاق، یکی سفت و دیگری نه. همان الگویِ §۲u و گاردِ ادمین.
// ═══════════════════════════════════════════════════════════════════════

function readSource(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const staffRoute = await import('../src/app/api/v1/restaurant/staff/route');

const TAG = 'sag';

let tenantId: string;
let otherTenantId: string;
let ownerId: string;
let managerId: string;
let firedManagerId: string;   // مدیرِ اخراج‌شده — قهرمانِ داستان
let plainStaffId: string;
let outsiderOwnerId: string;

const phone = () => `+9892${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13);

const token = (sub: string, tid: string, role: 'owner' | 'manager' | 'staff') =>
  signAccess({ sub, kind: 'staff', tenantId: tid, role });

const req = (tok: string, body?: unknown, method = 'GET') =>
  new Request('http://x/api/v1/restaurant/staff', {
    method,
    headers: {
      authorization: `Bearer ${tok}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/*
 * ⚠️ اینجا قبلاً `clearRateLimit()` بود که سطل‌های `rl:auth:*` و `rl:srch:*` را
 * **سراسری** پاک می‌کرد — چون `new Request()`ِ بدونِ هدر همیشه IPِ `unknown`
 * می‌داد و سهمیه بینِ همه‌ی فایل‌های رانر مشترک بود. آن پاک‌سازی سطلِ فایل‌های
 * دیگر را هم خالی می‌کرد و ریت‌لیمیت را از تستِ آن‌ها پنهان می‌کرد.
 * حالا `req()` با `testIp()` IPِ یکتا می‌گیرد، پس سطل‌ها از اول جدا هستند.
 */

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  const o = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-other-${s}` }, select: { id: true } });
  tenantId = t.id;
  otherTenantId = o.id;

  const mk = async (tid: string, role: 'owner' | 'manager' | 'staff', isActive: boolean) =>
    (await db.staff.create({ data: { tenantId: tid, role, isActive, phone: phone() }, select: { id: true } })).id;

  ownerId = await mk(tenantId, 'owner', true);
  managerId = await mk(tenantId, 'manager', true);
  firedManagerId = await mk(tenantId, 'manager', false); // اخراج‌شده
  plainStaffId = await mk(tenantId, 'staff', true);
  outsiderOwnerId = await mk(otherTenantId, 'owner', true);
});

after(async () => {
  await db.staffPermission.deleteMany({ where: { staff: { tenantId: { in: [tenantId, otherTenantId] } } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
});

// ─────────────────────────────────────────────────────────────────────
describe('withStaffAuth — کارمندِ غیرفعال‌شده', () => {
  test('کنترلِ مثبت: مدیرِ سالم فهرستِ کارکنان را می‌بیند', async () => {
    // بدونِ این، گاردی که *همیشه* رد کند هم بقیه‌ی تست‌ها را پاس می‌کرد.
    const res = await staffRoute.GET(req(token(managerId, tenantId, 'manager')));
    assert.equal(res.status, 200);
    const body = await res.json() as { items: unknown[] };
    assert.ok(body.items.length >= 4);
  });

  test('⚠️ مدیرِ اخراج‌شده دیگر فهرستِ کارکنان را نمی‌بیند (نشتِ شماره‌ی موبایل)', async () => {
    const res = await staffRoute.GET(req(token(firedManagerId, tenantId, 'manager')));
    assert.equal(res.status, 403, 'توکنِ هنوز-معتبر نباید بعد از اخراج کار کند');
  });

  test('⚠️ مدیرِ اخراج‌شده نمی‌تواند کارمندِ جدید بسازد (درِ پشتیِ ماندگار)', async () => {
    const res = await staffRoute.POST(
      req(token(firedManagerId, tenantId, 'manager'), { phone: '09121234567', role: 'staff' }, 'POST'),
    );
    assert.equal(res.status, 403);
    const created = await db.staff.findFirst({ where: { tenantId, phone: '+989121234567' } });
    assert.equal(created, null, 'هیچ کارمندی نباید ساخته شده باشد');
  });

  test('🔴 مدیرِ اخراج‌شده نمی‌تواند خودش را دوباره فعال کند (تبدیلِ پنجره‌ی موقت به دسترسیِ دائمی)', async () => {
    // 🔴 هسته‌ی باگ. پیش از رفع، این درخواست ۲۰۰ می‌داد و
    //    `is_active` در دیتابیس دوباره true می‌شد — یعنی اخراج بی‌اثر می‌شد.
    const res = await staffRoute.PATCH(
      req(token(firedManagerId, tenantId, 'manager'), { staff_id: firedManagerId, is_active: true }, 'PATCH'),
    );
    assert.equal(res.status, 403);

    const after = await db.staff.findUnique({ where: { id: firedManagerId }, select: { isActive: true } });
    assert.equal(after?.isActive, false, 'حساب باید غیرفعال مانده باشد');
  });

  test('⚠️ مدیرِ اخراج‌شده نمی‌تواند مدیرِ سالم را غیرفعال کند (انتقام‌گیری)', async () => {
    const res = await staffRoute.PATCH(
      req(token(firedManagerId, tenantId, 'manager'), { staff_id: managerId, is_active: false }, 'PATCH'),
    );
    assert.equal(res.status, 403);
    const after = await db.staff.findUnique({ where: { id: managerId }, select: { isActive: true } });
    assert.equal(after?.isActive, true);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('withStaffAuth — سایرِ چک‌هایِ دیتابیسی', () => {
  test('⚠️ حسابِ حذف‌شده رد می‌شود، حتی با توکنِ معتبر', async () => {
    const ghost = await db.staff.create({
      data: { tenantId, role: 'manager', isActive: true, phone: phone() },
      select: { id: true },
    });
    const tok = token(ghost.id, tenantId, 'manager');
    await db.staff.delete({ where: { id: ghost.id } });
    const res = await staffRoute.GET(req(tok));
    assert.equal(res.status, 403);
  });

  test('⚠️ توکنی که tenantIdش با DB نمی‌خواند رد می‌شود (جعلِ عضویتِ تنانت)', async () => {
    // ownerِ تنانتِ دیگر، با توکنی که ادعا می‌کند عضوِ تنانتِ ماست.
    const res = await staffRoute.GET(req(token(outsiderOwnerId, tenantId, 'owner')));
    assert.equal(res.status, 403, 'عضویتِ تنانت باید با ردیفِ واقعی تطبیق داده شود، نه با ادعایِ توکن');
  });

  test('⚠️ نقش از DB خوانده می‌شود، نه از توکن', async () => {
    // ⚠️ امروز مسیرِ APIی برایِ تغییرِ نقش وجود ندارد، پس این قابلِ سوءاستفاده
    //    نبود — ولی گارد باید از قبل درست باشد، نه بعد از اینکه چنین مسیری
    //    اضافه شد. کارمندِ عادی با توکنی که ادعایِ owner دارد نباید رد شود.
    const res = await staffRoute.GET(req(token(plainStaffId, tenantId, 'owner')));
    assert.equal(res.status, 403, 'نقشِ واقعیِ DB (staff) باید برنده باشد، نه ادعایِ توکن (owner)');
  });

  test('بدونِ هدرِ Authorization رد می‌شود', async () => {
    const res = await staffRoute.GET(
      new Request('http://x/api/v1/restaurant/staff', { headers: { 'x-real-ip': testIp() } }),
    );
    assert.equal(res.status, 401);
  });

  test('توکنِ دست‌کاری‌شده رد می‌شود', async () => {
    const good = token(ownerId, tenantId, 'owner');
    const res = await staffRoute.GET(req(good.slice(0, -3) + 'AAA'));
    assert.equal(res.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('PATCH /restaurant/staff — گاردِ تغییرِ وضعیتِ خود', () => {
  test('⚠️ مدیرِ سالم هم نمی‌تواند وضعیتِ فعال‌بودنِ خودش را عوض کند (هیچ جهتی)', async () => {
    // ⚠️ لایه‌ی دومِ همان رفع: قبلاً فقط جهتِ `false` گارد داشت.
    const res = await staffRoute.PATCH(
      req(token(managerId, tenantId, 'manager'), { staff_id: managerId, is_active: true }, 'PATCH'),
    );
    assert.equal(res.status, 403);
  });

  test('مدیرِ سالم می‌تواند کارمندِ عادی را غیرفعال کند (قابلیت نشکسته)', async () => {
    const victim = await db.staff.create({
      data: { tenantId, role: 'staff', isActive: true, phone: phone() },
      select: { id: true },
    });
    const res = await staffRoute.PATCH(
      req(token(managerId, tenantId, 'manager'), { staff_id: victim.id, is_active: false }, 'PATCH'),
    );
    assert.equal(res.status, 200);
    const after = await db.staff.findUnique({ where: { id: victim.id }, select: { isActive: true } });
    assert.equal(after?.isActive, false);
  });

  test('مدیر نمی‌تواند مدیرِ دیگر را غیرفعال کند — فقط مالک', async () => {
    const otherManager = await db.staff.create({
      data: { tenantId, role: 'manager', isActive: true, phone: phone() },
      select: { id: true },
    });
    const res = await staffRoute.PATCH(
      req(token(managerId, tenantId, 'manager'), { staff_id: otherManager.id, is_active: false }, 'PATCH'),
    );
    assert.equal(res.status, 403);
  });

  test('مالک می‌تواند مدیر را غیرفعال کند', async () => {
    const victimManager = await db.staff.create({
      data: { tenantId, role: 'manager', isActive: true, phone: phone() },
      select: { id: true },
    });
    const res = await staffRoute.PATCH(
      req(token(ownerId, tenantId, 'owner'), { staff_id: victimManager.id, is_active: false }, 'PATCH'),
    );
    assert.equal(res.status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('قفلِ ریشه‌ی باگ در سطحِ کد', () => {
  test('⚠️ `withStaffAuth` واقعاً از دیتابیس می‌خواند', async () => {
    // ⚠️ ریشه‌ی باگ «هیچ کوئریِ دیتابیسی نداشت» بود، نه یک شرطِ خاص — پس
    //    خودِ کد را قفل می‌کنیم تا اگر کسی کوئری را بردارد همین‌جا بشکند.
    const src = readSource('../src/lib/with-restaurant-auth.ts');
    assert.match(src, /db\.staff\.findUnique/, 'باید وضعیتِ فعلیِ کارمند را از DB بپرسد');
    assert.match(src, /isActive/, 'باید فعال‌بودن را چک کند');
    assert.match(src, /staff\.tenantId !== auth\.tenantId/, 'باید عضویتِ تنانت را با DB تطبیق دهد');
  });
});
