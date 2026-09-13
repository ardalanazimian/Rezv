import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  `POST /api/v1/waitlist` — محدوده‌ی تنانت برایِ مسیرِ کارمند
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۹-۱۱): تشخیصِ کارمند این بود —
//      if (a.kind === 'customer') userId = a.sub; else isStaff = true;
//  یعنی هر توکنی که «مشتری» نبود **کارمند** شمرده می‌شد، و از آن دو چیز
//  می‌گرفت که هیچ‌کدام بررسی نمی‌شد:
//
//   ۱. `restaurant_id` از **بدنه** خوانده می‌شد و هیچ‌جا با تنانتِ فراخوان
//      تطبیق داده نمی‌شد ⇒ کارمندِ تنانتِ A می‌توانست صفِ رستورانِ تنانتِ B
//      را با ورودی‌های ساختگی پر کند. (نقضِ صریحِ قاعده‌ی مخزن:
//      «restaurantId/tenantId فقط از contextِ احراز، هرگز از body».)
//   ۲. kill-switchِ `waitlist_enabled` عمداً برای staff رد می‌شود ⇒ همان
//      مهاجم در قطعیِ اضطراری هم می‌نوشت.
//
//  چرا این باگ فقط با روتِ واقعی دیده می‌شود: `joinWaitlist` (لایه‌ی lib)
//  هیچ مفهومی از فراخوان ندارد و درست کار می‌کند. نقص تماماً در تصمیمِ
//  route است، پس تست هم باید خودِ `POST_impl` را صدا بزند.
//
//  الگویِ رفع از `reservations/route.ts` گرفته شده (همان شکلِ مسیر: مشتری و
//  کارمند با هم): `resolveStaffRestaurant` شعبه را از contextِ احراز درمی‌آورد
//  و idِ بدنه باید با آن **یکی** باشد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { fixturePhone } = await import('./_phone.helper.mts');
const waitlistRoute = await import('../src/app/api/v1/waitlist/route');

type Ctx = { tenantId: string; restaurantId: string; staffToken: string };

const TAG = `wlrt-${Date.now().toString(36)}`;
let A: Ctx, B: Ctx;

/** درخواستِ واقعیِ روت. `token` نبود ⇒ مهمانِ ناشناس. */
function join(restaurantId: string, token?: string, partySize = 2) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': testIp() };
  if (token) headers.authorization = `Bearer ${token}`;
  return waitlistRoute.POST(new Request('http://x/api/v1/waitlist', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      restaurant_id: restaurantId,
      party_size: partySize,
      guest: { name: '[DEMO] مهمانِ تزریقی' },
    }),
  }));
}

async function makeTenant(label: string): Promise<Ctx> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'WLT', isOpen: true },
    select: { id: true },
  });
  // ⚠️ `restaurantId: null` عمداً: owner/managerِ بدونِ قفلِ شعبه، یعنی
  // مسیرِ resolveStaffRestaurant به شاخه‌ی «شعبه‌ی پیش‌فرضِ تنانت» می‌رود —
  // بازترین حالتِ ممکن برای فراخوان، پس اگر باز هم ۴۰۳ بگیرد، گارد واقعاً
  // به تنانت بسته است و نه به قفلِ شعبه.
  const staff = await db.staff.create({
    data: { tenantId: t.id, role: 'owner', isActive: true, phone: fixturePhone('0928'), restaurantId: null },
    select: { id: true },
  });
  return {
    tenantId: t.id,
    restaurantId: r.id,
    staffToken: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
  };
}

before(async () => {
  A = await makeTenant(`${TAG}-a`);
  B = await makeTenant(`${TAG}-b`);
});

after(async () => {
  const rests = [A.restaurantId, B.restaurantId];
  await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: rests } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: rests } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } }).catch(() => {});
});

describe('POST /waitlist — تزریقِ متقاطعِ تنانت بسته است', () => {
  test('🔴 کارمندِ تنانتِ A نمی‌تواند در صفِ رستورانِ تنانتِ B بنویسد', async () => {
    const res = await join(B.restaurantId, A.staffToken);
    assert.equal(res.status, 403, 'باید ۴۰۳ بدهد، نه اینکه ورودی بسازد');
    const body = await res.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'FORBIDDEN_TENANT');

    // ⚠️ کنترلِ روی خودِ DB، نه فقط کدِ وضعیت: بدونِ این، هندلری که ۴۰۳
    //    برگرداند **ولی ردیف را هم بنویسد** از تست رد می‌شد.
    const injected = await db.waitlistEntry.count({ where: { restaurantId: B.restaurantId } });
    assert.equal(injected, 0, 'هیچ ردیفی نباید در صفِ تنانتِ دیگر ساخته شده باشد');
  });

  test('✓ کنترلِ مثبت — همان کارمند روی شعبه‌ی خودش موفق می‌شود', async () => {
    // بدونِ این نیمه، یک گاردِ «همیشه ۴۰۳» هم تستِ بالا را پاس می‌کرد و
    // قابلیتِ واقعی (ثبتِ دستیِ مهمانِ حاضر توسطِ پرسنل) بی‌صدا می‌مرد.
    const res = await join(A.restaurantId, A.staffToken);
    assert.equal(res.status, 200, `کارمند باید در صفِ خودش بنویسد — دیده شد ${res.status}`);

    const rows = await db.waitlistEntry.count({ where: { restaurantId: A.restaurantId } });
    assert.equal(rows, 1, 'دقیقاً یک ورودی باید ساخته شده باشد');
  });

  test('✓ مسیرِ مهمانِ ناشناس دست‌نخورده مانده (این گارد فقط کارمند را می‌بندد)', async () => {
    // مرزِ عمدیِ تغییر: پیوستنِ خودِ مهمان به صف هیچ توکنی نمی‌خواهد و
    // نباید با سخت‌کردنِ مسیرِ کارمند بشکند.
    const res = await join(B.restaurantId);
    assert.equal(res.status, 200, 'مهمانِ ناشناس باید بتواند به صفِ B بپیوندد');

    const rows = await db.waitlistEntry.count({ where: { restaurantId: B.restaurantId } });
    assert.equal(rows, 1, 'ورودیِ مهمان باید واقعاً ثبت شده باشد');
  });
});
