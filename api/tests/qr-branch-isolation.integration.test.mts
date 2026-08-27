import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تستِ منفیِ مجوز — GET /v1/reservations/[code]/qr (فازِ ۲، پروتکل §۷)
//
//  ⚠️ حفره‌ای که این فایل قفل می‌کند: این روت مجوز را فقط در سطحِ **تنانت**
//  چک می‌کرد (`r.restaurant.tenantId !== auth.tenantId`) و `auth` را خام از
//  توکن می‌گرفت — یعنی هرگز `resolveStaffRestaurant` را صدا نمی‌زد.
//
//  هر دو روتِ خواهرش دقیقاً همین را رفع کرده‌اند و مستندش هم کرده‌اند:
//    • reservations/[code]/route.ts:۳۹-۴۵   («رفعِ نشتِ شعبه، فازِ ۲ §۷»)
//    • reservations/[code]/cancel/route.ts:۴۳-۵۶ («رفعِ P1»)
//  این یکی جا مانده بود.
//
//  اثر: کارمندِ **قفل‌شده به شعبه‌ی A** (یا کارمندِ تازه‌اخراج‌شده، تا سقفِ
//  ۱۵ دقیقه‌ی اعتبارِ access token) با کدِ رزروِ شعبه‌ی B پاسخِ ۲۰۰ می‌گرفت
//  و با کدِ ناموجود ۴۰۴ — یعنی یک **oracleِ وجود/عدمِ وجود** رویِ همه‌ی
//  شعبه‌های تنانت. خودِ payload حساس نیست (SVG فقط همان کدی را رمز می‌کند
//  که خودش فرستاده)، ولی تفاوتِ ۲۰۰/۴۰۴ خودش نشتِ اطلاعات است — و
//  `resolveStaffRestaurant` علاوه بر شعبه، `isActive` و عضویتِ واقعیِ تنانت
//  را هم از DB می‌خواند، که این مسیر هیچ‌کدام را نداشت.
//
//  چرا integration واقعی و نه mock: ادعا («کارمندِ شعبه‌ی A نباید رزروِ
//  شعبه‌ی B را ببیند») ادعایی درباره‌ی تعاملِ واقعیِ کوئریِ Prisma با
//  staff.restaurant_id است؛ mock کردنش یعنی فرضِ همان چیزی که می‌سنجیم.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { genReservationCode } = await import('../src/lib/reservation-helpers.ts');
const qrRoute = await import('../src/app/api/v1/reservations/[code]/qr/route.ts');

let tenantA: string, tenantB: string;
let restA1: string, restA2: string, restB1: string;
let codeInA2: string;
let userOwner: string, userOther: string;

let tokenLockedToA1: string;   // کارمندِ قفل‌شده به شعبه‌ی A1 — نباید رزروِ A2 را ببیند
let tokenLockedToA2: string;   // کارمندِ قفل‌شده به شعبه‌ی A2 — باید ببیند (کنترلِ مثبت)
let tokenOwnerA: string;       // owner بدونِ قفلِ شعبه — دیدش شعبه‌ی پیش‌فرض/هدر است
let tokenDeactivatedA2: string;// کارمندِ اخراج‌شده‌ی همان شعبه — نباید ببیند
let tokenTenantB: string;      // کارمندِ تنانتِ دیگر — نباید ببیند (رفتارِ قبلی)
let tokenOwnerCustomer: string;
let tokenOtherCustomer: string;

const qrReq = (token: string, code: string, branchHeader?: string) => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    'x-real-ip': testIp(),
  };
  if (branchHeader) headers['x-restaurant-id'] = branchHeader;
  return new Request(`http://x/api/v1/reservations/${code}/qr`, { headers });
};
const routeArg = (code: string) => ({ params: Promise.resolve({ code }) });

async function mkStaff(tenantId: string, restaurantId: string | null, role: 'owner' | 'staff', isActive = true) {
  const s = await db.staff.create({
    data: {
      tenantId, restaurantId, role, isActive,
      phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
    },
    select: { id: true },
  });
  return signAccess({ sub: s.id, kind: 'staff', tenantId, role });
}

before(async () => {
  const suffix = Date.now();
  const [tA, tB] = await Promise.all([
    db.tenant.create({ data: { name: '[DEMO] tenant A (qr-branch-isolation)' }, select: { id: true } }),
    db.tenant.create({ data: { name: '[DEMO] tenant B (qr-branch-isolation)' }, select: { id: true } }),
  ]);
  tenantA = tA.id; tenantB = tB.id;

  // A1 اول ساخته می‌شود تا «شعبه‌ی پیش‌فرضِ تنانت» باشد — یعنی اگر گارد نشت
  // کند، همان شعبه‌ای است که کارمندِ قفل‌شده به آن دسترسیِ مشروع دارد.
  const a1 = await db.restaurant.create({ data: { tenantId: tenantA, slug: `zz-qr-a1-${suffix}`, name: '[DEMO] شعبه‌ی A1', clubPrefix: 'QA1' }, select: { id: true } });
  restA1 = a1.id;
  const [a2, b1] = await Promise.all([
    db.restaurant.create({ data: { tenantId: tenantA, slug: `zz-qr-a2-${suffix}`, name: '[DEMO] شعبه‌ی A2', clubPrefix: 'QA2' }, select: { id: true } }),
    db.restaurant.create({ data: { tenantId: tenantB, slug: `zz-qr-b1-${suffix}`, name: '[DEMO] شعبه‌ی B1', clubPrefix: 'QB1' }, select: { id: true } }),
  ]);
  restA2 = a2.id; restB1 = b1.id;

  const [uOwner, uOther] = await Promise.all([
    db.user.create({ data: { phone: `+9892${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13) }, select: { id: true } }),
    db.user.create({ data: { phone: `+9893${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13) }, select: { id: true } }),
  ]);
  userOwner = uOwner.id; userOther = uOther.id;

  const start = new Date(Date.now() + 86_400_000);
  const r = await db.reservation.create({
    data: {
      code: genReservationCode(),
      restaurantId: restA2,          // ← رزرو در شعبه‌ی A2
      userId: userOwner,
      partySize: 2,
      slotStart: start,
      slotEnd: new Date(+start + 90 * 60_000),
      guestName: '[DEMO] مهمانِ تستِ QR',
    },
    select: { code: true },
  });
  codeInA2 = r.code;

  [tokenLockedToA1, tokenLockedToA2, tokenOwnerA, tokenDeactivatedA2, tokenTenantB] = await Promise.all([
    mkStaff(tenantA, restA1, 'staff'),
    mkStaff(tenantA, restA2, 'staff'),
    mkStaff(tenantA, null, 'owner'),
    mkStaff(tenantA, restA2, 'staff', false),
    mkStaff(tenantB, restB1, 'owner'),
  ]);
  tokenOwnerCustomer = signAccess({ sub: userOwner, kind: 'customer' });
  tokenOtherCustomer = signAccess({ sub: userOther, kind: 'customer' });
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId: { in: [restA1, restA2, restB1] } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: [restA1, restA2, restB1] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [userOwner, userOther] } } }).catch(() => {});
});

describe('GET /reservations/[code]/qr — قفلِ شعبه', () => {
  test('کنترلِ مثبت: کارمندِ همان شعبه SVGِ واقعی می‌گیرد', async () => {
    const res = await qrRoute.GET(qrReq(tokenLockedToA2, codeInA2), routeArg(codeInA2));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
    const body = await res.text();
    assert.ok(body.startsWith('<?xml') || body.includes('<svg'), 'باید SVGِ واقعی باشد');
  });

  test('کنترلِ مثبت: owner با انتخابِ صریحِ شعبه (هدرِ X-Restaurant-Id) می‌بیند', async () => {
    const res = await qrRoute.GET(qrReq(tokenOwnerA, codeInA2, restA2), routeArg(codeInA2));
    assert.equal(res.status, 200, await res.text());
  });

  // ⚠️ این تست یک **انتظارِ اشتباهِ من** را تصحیح می‌کند. اولین نسخه‌اش فرض
  // کرده بود «owner همه‌ی شعبه‌ها را می‌بیند» و بعد از رفع قرمز شد. قراردادِ
  // واقعیِ این ریپو چیزِ دیگری است و در روتِ خواهر از قبل تثبیت شده:
  // resolveStaffRestaurant برایِ ownerِ بدونِ هدر «شعبه‌ی پیش‌فرض
  // (قدیمی‌ترین)» را برمی‌گرداند، پس دیدِ او هم شعبه‌محور است نه تنانت‌محور.
  //
  // این تست همان ادعا را **در برابرِ روتِ خواهر** می‌سنجد، نه در برابرِ
  // سلیقه‌ی من: هر دو باید یک وضعیت بدهند. اگر روزی قرارداد عوض شود، این
  // تست هر دو روت را با هم مجبور به تغییر می‌کند — که دقیقاً هدف است.
  test('ownerِ بدونِ هدر: QR دقیقاً همان وضعیتی را می‌دهد که روتِ خواهر می‌دهد', async () => {
    const detailRoute = await import('../src/app/api/v1/reservations/[code]/route.ts');
    const qrRes = await qrRoute.GET(qrReq(tokenOwnerA, codeInA2), routeArg(codeInA2));
    const detailRes = await detailRoute.GET(qrReq(tokenOwnerA, codeInA2), routeArg(codeInA2));
    assert.equal(qrRes.status, detailRes.status,
      `QR=${qrRes.status} ولی reservations/[code]=${detailRes.status} — دو روتِ خواهر نباید مجوزِ متفاوت بدهند`);
    // و برایِ ثبتِ صریحِ قرارداد (شعبه‌ی پیش‌فرض A1 است، رزرو در A2):
    assert.equal(qrRes.status, 404);
  });

  // ═══ ادعایِ اصلیِ این فایل ═══
  test('کارمندِ قفل‌شده به شعبه‌ی A1 برایِ رزروِ شعبه‌ی A2 ۴۰۴ می‌گیرد (نه ۲۰۰)', async () => {
    const res = await qrRoute.GET(qrReq(tokenLockedToA1, codeInA2), routeArg(codeInA2));
    assert.equal(res.status, 404, `نشتِ شعبه: بدنه = ${await res.text()}`);
    // و پاسخ نباید SVG باشد — یعنی حتی محتوایِ تصویری هم تولید نشده.
    assert.notEqual(res.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  });

  test('کدِ ناموجود هم برایِ همان کارمند ۴۰۴ می‌دهد — یعنی تفاوتی برای oracle نمی‌ماند', async () => {
    const ghost = 'RZ' + 'ZZZZZZZ';
    const res = await qrRoute.GET(qrReq(tokenLockedToA1, ghost), routeArg(ghost));
    assert.equal(res.status, 404);
    const leaked = await qrRoute.GET(qrReq(tokenLockedToA1, codeInA2), routeArg(codeInA2));
    assert.equal(leaked.status, res.status, 'کدِ موجودِ شعبه‌ی دیگر و کدِ ناموجود باید یکسان پاسخ دهند');
  });

  test('کارمندِ غیرفعال (اخراج‌شده) با توکنِ هنوز معتبر ۴۰۳/۴۰۴ می‌گیرد، نه ۲۰۰', async () => {
    const res = await qrRoute.GET(qrReq(tokenDeactivatedA2, codeInA2), routeArg(codeInA2));
    assert.notEqual(res.status, 200, 'کارمندِ اخراج‌شده نباید تا انقضای توکن دسترسی داشته باشد');
    assert.ok(res.status === 403 || res.status === 404, `وضعیت: ${res.status}`);
  });

  test('رفتارِ قبلی حفظ شده: کارمندِ تنانتِ دیگر ۴۰۴ می‌گیرد', async () => {
    const res = await qrRoute.GET(qrReq(tokenTenantB, codeInA2), routeArg(codeInA2));
    assert.equal(res.status, 404);
  });

  test('رفتارِ قبلی حفظ شده: مشتریِ صاحبِ رزرو ۲۰۰ و مشتریِ دیگر ۴۰۴', async () => {
    const ok = await qrRoute.GET(qrReq(tokenOwnerCustomer, codeInA2), routeArg(codeInA2));
    assert.equal(ok.status, 200);
    const denied = await qrRoute.GET(qrReq(tokenOtherCustomer, codeInA2), routeArg(codeInA2));
    assert.equal(denied.status, 404);
  });
});
