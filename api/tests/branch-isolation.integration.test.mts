import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تستِ منفیِ مجوز — جداسازیِ شعبه (فازِ ۲ · P0-1، پروتکل §۷)
//
//  «Add negative authorization tests» — الزامِ صریحِ بخشِ ۷ پروتکل.
//
//  چرا integration واقعی و نه mock: ادعایی که این تست اثبات می‌کند
//  («هدرِ شعبه‌ی نامعتبر به شعبه‌ی دیگری نشت نمی‌کند») یک ادعا درباره‌ی
//  تعاملِ واقعیِ کوئریِ Prisma با ستونِ tenant_id است. اگر Prisma را mock
//  کنیم، دقیقاً همان چیزی را فرض کرده‌ایم که می‌خواهیم بسنجیم.
//
//  باگی که این تست پین می‌کند (رفع‌شده در staff-helpers.ts):
//  resolveStaffRestaurant وقتی هدرِ X-Restaurant-Id قابلِ resolve نبود،
//  بی‌صدا به «قدیمی‌ترین شعبه‌ی تنانت» برمی‌گشت. چون خروجیِ این تابع همان
//  ctx.restaurant.id در withRestaurantAuth است، این یعنی **نوشتن‌ها**
//  (واک‌این، رزروِ دستی، تغییرِ وضعیتِ میز، کمپین) می‌توانستند بی‌صدا رویِ
//  شعبه‌ی اشتباه بنشینند.
//
//  چهار حالت پوشش داده می‌شود:
//   ۱. هدرِ شعبه‌ی متعلق به تنانتِ **دیگر**  → باید خطا بدهد (نه نشت، نه fallback)
//   ۲. هدرِ UUIDِ ناموجود (شعبه‌ی حذف‌شده)    → باید خطا بدهد
//   ۳. **بدونِ** هدر                          → رفتارِ قدیمی حفظ شود (شعبه‌ی پیش‌فرض)
//   ۴. staffِ قفل‌شده به یک شعبه              → هدر نادیده گرفته شود (نه خطا)
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { resolveStaffRestaurant } = await import('../src/lib/staff-helpers.ts');
const { ApiError } = await import('../src/lib/errors.ts');

type Auth = { sub: string; kind: 'staff'; role: string; tenantId: string };

const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';

let tenantA: string;
let tenantB: string;
let restA1: string;   // قدیمی‌ترین شعبه‌ی تنانتِ A → «پیش‌فرض» (طعمه‌ی نشت)
let restA2: string;   // شعبه‌ی دومِ تنانتِ A
let restB1: string;   // شعبه‌ی تنانتِ B (بیگانه)
let ownerA: Auth;     // owner بدونِ قفلِ شعبه (restaurantId = null)
let lockedA: Auth;    // کارمندِ قفل‌شده به restA2

/** درخواستِ ساختگی فقط با هدرِ شعبه — همان چیزی که resolveStaffRestaurant می‌خواند. */
function reqWithBranch(id: string | null): Request {
  const headers = new Headers({ 'x-real-ip': testIp() });
  if (id) headers.set('x-restaurant-id', id);
  return new Request('https://example.test/api/v1/restaurant/reservations', { headers });
}

before(async () => {
  const suffix = Date.now();

  const [tA, tB] = await Promise.all([
    db.tenant.create({ data: { name: '[DEMO] tenant A (branch-isolation test)' } }),
    db.tenant.create({ data: { name: '[DEMO] tenant B (branch-isolation test)' } }),
  ]);
  tenantA = tA.id;
  tenantB = tB.id;

  // ترتیبِ createdAt مهم است: defaultRestaurantForTenant قدیمی‌ترین را برمی‌گرداند،
  // پس restA1 باید اولین ساخته شود تا «طعمه‌ی نشت» دقیقاً همان باشد.
  const a1 = await db.restaurant.create({
    data: {
      tenantId: tenantA, slug: `bi-a1-${suffix}`,
      name: '[DEMO] شعبه‌ی یکِ تنانتِ A', clubPrefix: 'BA1',
    },
  });
  restA1 = a1.id;

  const [a2, b1] = await Promise.all([
    db.restaurant.create({
      data: {
        tenantId: tenantA, slug: `bi-a2-${suffix}`,
        name: '[DEMO] شعبه‌ی دوِ تنانتِ A', clubPrefix: 'BA2',
      },
    }),
    db.restaurant.create({
      data: {
        tenantId: tenantB, slug: `bi-b1-${suffix}`,
        name: '[DEMO] شعبه‌ی تنانتِ B', clubPrefix: 'BB1',
      },
    }),
  ]);
  restA2 = a2.id;
  restB1 = b1.id;

  // owner بدونِ قفلِ شعبه — می‌تواند با هدر بینِ شعبه‌ها سوییچ کند.
  const owner = await db.staff.create({
    data: { tenantId: tenantA, phone: `0912${String(suffix).slice(-7)}`, role: 'owner', restaurantId: null },
  });
  ownerA = { sub: owner.id, kind: 'staff', role: 'owner', tenantId: tenantA };

  // کارمندِ قفل‌شده به شعبه‌ی دوم — نباید بتواند با هدر شعبه عوض کند.
  const locked = await db.staff.create({
    data: { tenantId: tenantA, phone: `0913${String(suffix).slice(-7)}`, role: 'staff', restaurantId: restA2 },
  });
  lockedA = { sub: locked.id, kind: 'staff', role: 'staff', tenantId: tenantA };
});

after(async () => {
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } }).catch(() => {});
});

describe('جداسازیِ شعبه — resolveStaffRestaurant (P0-1، پروتکل §۷)', () => {
  test('هدرِ شعبه‌ی متعلق به تنانتِ دیگر → خطایِ صریح، نه نشت به شعبه‌ی خودی', async () => {
    // این مهم‌ترین ادعایِ این فایل است: قبل از رفع، این فراخوانی با موفقیت
    // restA1 را برمی‌گرداند — یعنی مهاجم/کلاینتِ خراب با فرستادنِ idِ یک تنانتِ
    // دیگر نه‌تنها خطا نمی‌گرفت، بلکه یک زمینه‌ی معتبرِ نوشتن دریافت می‌کرد.
    await assert.rejects(
      () => resolveStaffRestaurant(ownerA as never, reqWithBranch(restB1)),
      (e: unknown) => {
        assert.ok(e instanceof ApiError, 'باید ApiError ساختاریافته باشد');
        assert.equal(e.code, 'BRANCH_NOT_ACCESSIBLE');
        assert.equal(e.status, 404);
        return true;
      },
    );
  });

  test('هدرِ شعبه‌ی ناموجود (حذف‌شده) → خطایِ صریح، نه بازگشتِ خاموش به پیش‌فرض', async () => {
    await assert.rejects(
      () => resolveStaffRestaurant(ownerA as never, reqWithBranch(UNKNOWN_UUID)),
      (e: unknown) => {
        assert.ok(e instanceof ApiError);
        assert.equal(e.code, 'BRANCH_NOT_ACCESSIBLE');
        return true;
      },
    );
  });

  test('هدرِ معتبرِ شعبه‌ی خودی → همان شعبه (سوییچِ شعبه نباید بشکند)', async () => {
    // رگرسیونِ معکوس: رفعِ امنیتی نباید قابلیتِ چندشعبه‌ای را از کار بیندازد.
    const r = await resolveStaffRestaurant(ownerA as never, reqWithBranch(restA2));
    assert.equal(r.id, restA2);
  });

  test('بدونِ هدر → شعبه‌ی پیش‌فرضِ تنانت (رفتارِ قبلی حفظ می‌شود)', async () => {
    // تنانتِ تک‌شعبه‌ای هیچ‌وقت هدر نمی‌فرستد؛ این مسیر عمداً دست‌نخورده ماند.
    const r = await resolveStaffRestaurant(ownerA as never, reqWithBranch(null));
    assert.equal(r.id, restA1, 'باید قدیمی‌ترین شعبه (پیش‌فرض) باشد');
  });

  test('resolveStaffRestaurant بدونِ آبجکتِ Request (مسیرِ ورود) → پیش‌فرض، بدونِ خطا', async () => {
    // auth/staff/verify این تابع را بدونِ req صدا می‌زند؛ رفعِ P0-1 نباید
    // ورودِ کارکنان را بشکند.
    const r = await resolveStaffRestaurant(ownerA as never);
    assert.equal(r.id, restA1);
  });

  test('کارمندِ قفل‌شده به شعبه → هدر نادیده گرفته می‌شود (نه خطا، نه سوییچ)', async () => {
    // قفلِ شعبه باید بر هدر مقدم باشد: کارمندِ محدود نه می‌تواند سوییچ کند و
    // نه باید به‌خاطر هدرِ کهنه‌ی کلاینت خطا بگیرد.
    const r = await resolveStaffRestaurant(lockedA as never, reqWithBranch(restA1));
    assert.equal(r.id, restA2, 'شعبه‌ی قفل‌شده باید برنده باشد');
  });

  test('کارمندِ قفل‌شده با هدرِ تنانتِ بیگانه → همچنان شعبه‌ی قفل‌شده‌ی خودش', async () => {
    const r = await resolveStaffRestaurant(lockedA as never, reqWithBranch(restB1));
    assert.equal(r.id, restA2);
  });
});
