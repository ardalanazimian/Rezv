import { test, describe, before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
// ⚠️ لازم است: بدونِ این، `requestOtp` مسیرِ واقعیِ `sendSmsNow` را می‌گیرد و
// بدونِ کلیدِ کاوه‌نگار **هنگ می‌کند** (تأییدشده با اجرای واقعی: probe بعد از
// ۱۲۰ ثانیه timeout شد). حالتِ dev در production استثنا پرتاب می‌کند
// (`api/src/lib/otp.ts`)، پس این فقط برایِ محیطِ تست است.
process.env.OTP_DEV_MODE = 'true';

// ═══════════════════════════════════════════════════════════════════════
//  شمارش‌پذیریِ شماره در مسیرِ درخواستِ OTPِ ادمین/کارکنان
//  (فازِ ۲، یافته‌ی ۱۸ در docs/recovery/OPEN-FINDINGS.md)
//
//  ⚠️ حفره‌ای که این فایل قفل می‌کند: هر دو روتِ درخواستِ کد، **وضعیتِ
//  داخلیِ حساب را در پاسخِ HTTP لو می‌دادند**:
//
//    auth/admin/request →  ۴۰۳ «این شماره مدیر پلتفرم نیست»   در برابر ۲۰۴
//    auth/staff/request →  ۴۰۳ «این شماره دسترسی پنل رستوران ندارد»
//                       →  ۴۰۳ «این حساب غیرفعال شده است»
//                       →  ۲۰۴
//
//  یعنی سه حالتِ متمایز با سه پیامِ متمایز. با `RULES.otpVerify` (۸ درخواست
//  در ۱۰ دقیقه به‌ازای هر IP) مهاجم می‌تواند شماره‌های کاندید را پروب کند تا:
//   • **تنها ابَرادمینِ پلتفرم** را پیدا کند — پرامتیازترین حسابِ کلِ سامانه
//     و در نتیجه هدفِ ایده‌آلِ SIM-swap یا مهندسیِ اجتماعی؛
//   • و بفهمد کدام شماره‌ها کارمندند و کدام‌شان هنوز فعال‌اند.
//
//  رفع: پاسخِ **یکسان** برای هر سه حالت. پیامک همچنان فقط برایِ شماره‌ی
//  معتبر می‌رود — پس هزینه‌ای اضافه نمی‌شود، فقط *پاسخ* یکدست می‌شود.
//  و چون سیگنال از پاسخِ HTTP حذف شد، `auth.failure` در audit اضافه شد تا
//  رصدپذیری از بین نرود (متریکِ `rezervno_auth_failures_total` و آلارمِ
//  `AuthFailureSpike` از همان تغذیه می‌شوند).
//
//  ── چه چیزی این فایل **نمی‌سنجد** (صداقت) ──
//  یکدستیِ «معتبر در برابر نامعتبر» فقط در production کامل است، چون آنجا
//  `requestOtp` هیچ `devCode`ی برنمی‌گرداند و همان `? :`ِ موجود به ۲۰۴
//  می‌رسد. در این تست `OTP_DEV_MODE` روشن است (اجبارِ محیطی — بالا)، پس
//  حالتِ معتبر ۲۰۰+JSON می‌دهد. چیزی که این‌جا **واقعاً** سنجیده می‌شود و
//  دقیقاً همان اوراکلِ حمله است: سه حالتِ نامعتبر باید از هم غیرقابلِ
//  تفکیک باشند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { redis } = await import('../src/lib/redis.ts');
const adminReq = await import('../src/app/api/v1/auth/admin/request/route.ts');
const staffReq = await import('../src/app/api/v1/auth/staff/request/route.ts');

let platformTenant: string;
let normalTenant: string;
let prevPlatformEnv: string | undefined;

// شماره‌های مجزا: `RULES.otpPerPhone` سقفِ ۳ در ۱۰ دقیقه به‌ازای هر شماره دارد.
const PHONE_SUPER_ADMIN = '09121000001';
const PHONE_ACTIVE_STAFF = '09121000002';
const PHONE_DEACTIVATED = '09121000003';
const PHONE_UNKNOWN = '09121000004';
const PHONE_NON_ADMIN_STAFF = '09121000005';

const post = (body: unknown) => new Request('http://x/api/v1/auth/x/request', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** امضای قابل‌مقایسه‌ی پاسخ — دقیقاً همان چیزی که مهاجم می‌بیند. */
async function fingerprint(res: Response) {
  return { status: res.status, body: await res.text() };
}

async function clearLimits() {
  for (const pat of ['*otpv*', '*otp:phone*', '*otp:ip*']) {
    const keys = await redis.keys(pat).catch(() => [] as string[]);
    if (keys.length) await redis.del(...keys).catch(() => 0);
  }
}

before(async () => {
  await clearLimits();
  const [tp, tn] = await Promise.all([
    db.tenant.create({ data: { name: '[DEMO] platform tenant (otp-enumeration)' }, select: { id: true } }),
    db.tenant.create({ data: { name: '[DEMO] normal tenant (otp-enumeration)' }, select: { id: true } }),
  ]);
  platformTenant = tp.id; normalTenant = tn.id;
  prevPlatformEnv = process.env.PLATFORM_ADMIN_TENANT_ID;
  process.env.PLATFORM_ADMIN_TENANT_ID = platformTenant;

  await db.staff.createMany({
    data: [
      { tenantId: platformTenant, phone: '+989121000001', role: 'owner', isActive: true },   // ابَرادمین
      { tenantId: normalTenant, phone: '+989121000002', role: 'staff', isActive: true },     // کارمندِ فعال
      { tenantId: normalTenant, phone: '+989121000003', role: 'staff', isActive: false },    // اخراج‌شده
      { tenantId: normalTenant, phone: '+989121000005', role: 'owner', isActive: true },     // کارمند، ولی ادمینِ پلتفرم نیست
    ],
  });
});

after(async () => {
  if (prevPlatformEnv === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
  else process.env.PLATFORM_ADMIN_TENANT_ID = prevPlatformEnv;
  await db.otpCode.deleteMany({ where: { phone: { in: ['+989121000001', '+989121000002', '+989121000003', '+989121000004', '+989121000005'] } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId: { in: [platformTenant, normalTenant] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [platformTenant, normalTenant] } } }).catch(() => {});
});

describe('POST /auth/admin/request — شمارش‌ناپذیریِ ابَرادمین', () => {
  // رجوع کن به توضیحِ همین الگو در `hours-change-approval`: hookهای سطحِ فایل
  // به سوئیتِ ROOT می‌چسبند، پس دو فایل که یک متغیرِ سراسری را ست می‌کنند
  // همدیگر را خراب می‌کنند. هر سوئیت مقدارِ خودش را دوباره تثبیت می‌کند.
  beforeEach(() => { process.env.PLATFORM_ADMIN_TENANT_ID = platformTenant; });

  test('شماره‌ی غیرادمین و شماره‌ی ناموجود پاسخِ کاملاً یکسان می‌گیرند', async () => {
    await clearLimits();
    const nonAdmin = await fingerprint(await adminReq.POST(post({ phone: PHONE_NON_ADMIN_STAFF })));
    const unknown = await fingerprint(await adminReq.POST(post({ phone: PHONE_UNKNOWN })));

    assert.deepEqual(nonAdmin, unknown, 'دو حالتِ نامعتبر نباید از هم قابلِ تفکیک باشند');
    assert.equal(nonAdmin.status, 204, 'پاسخِ نامعتبر باید ۲۰۴ باشد، نه ۴۰۳');
    assert.equal(nonAdmin.body, '', 'بدنه باید خالی باشد — هیچ پیامِ تشخیص‌دهنده‌ای');
  });

  test('برایِ شماره‌ی نامعتبر هیچ کدِ OTPی ساخته نمی‌شود (هزینه‌ی پیامک اضافه نمی‌شود)', async () => {
    await clearLimits();
    await adminReq.POST(post({ phone: PHONE_UNKNOWN }));
    const row = await db.otpCode.findUnique({ where: { phone: '+989121000004' } });
    assert.equal(row, null, 'برایِ شماره‌ی غیرادمین نباید کدی ساخته/ارسال شود');
  });

  test('کنترلِ مثبت: ابَرادمینِ واقعی همچنان کد می‌گیرد', async () => {
    await clearLimits();
    const res = await adminReq.POST(post({ phone: PHONE_SUPER_ADMIN }));
    assert.notEqual(res.status, 403, 'ادمینِ واقعی نباید رد شود');
    const row = await db.otpCode.findUnique({ where: { phone: '+989121000001' } });
    assert.ok(row, 'برایِ ادمینِ واقعی باید کد ساخته شود — وگرنه رفعِ ما مسیرِ ورود را کشته است');
  });
});

describe('POST /auth/staff/request — شمارش‌ناپذیریِ کارکنان', () => {
  // رجوع کن به توضیحِ همین الگو در `hours-change-approval`: hookهای سطحِ فایل
  // به سوئیتِ ROOT می‌چسبند، پس دو فایل که یک متغیرِ سراسری را ست می‌کنند
  // همدیگر را خراب می‌کنند. هر سوئیت مقدارِ خودش را دوباره تثبیت می‌کند.
  beforeEach(() => { process.env.PLATFORM_ADMIN_TENANT_ID = platformTenant; });

  test('هر سه حالتِ نامعتبر/غیرفعال پاسخِ یکسان می‌گیرند', async () => {
    await clearLimits();
    const unknown = await fingerprint(await staffReq.POST(post({ phone: PHONE_UNKNOWN })));
    const deactivated = await fingerprint(await staffReq.POST(post({ phone: PHONE_DEACTIVATED })));

    assert.deepEqual(unknown, deactivated,
      '«این شماره کارمند نیست» و «این حساب غیرفعال شده» نباید از هم قابلِ تفکیک باشند');
    assert.equal(unknown.status, 204);
    assert.equal(unknown.body, '');
  });

  test('برایِ کارمندِ غیرفعال هیچ کدِ OTPی ساخته نمی‌شود', async () => {
    await clearLimits();
    await staffReq.POST(post({ phone: PHONE_DEACTIVATED }));
    const row = await db.otpCode.findUnique({ where: { phone: '+989121000003' } });
    assert.equal(row, null, 'کارمندِ اخراج‌شده نباید کد بگیرد — فقط پاسخ یکدست می‌شود، نه دسترسی');
  });

  test('کنترلِ مثبت: کارمندِ فعال همچنان کد می‌گیرد', async () => {
    await clearLimits();
    const res = await staffReq.POST(post({ phone: PHONE_ACTIVE_STAFF }));
    assert.notEqual(res.status, 403, 'کارمندِ فعال نباید رد شود');
    const row = await db.otpCode.findUnique({ where: { phone: '+989121000002' } });
    assert.ok(row, 'کارمندِ فعال باید کد بگیرد');
  });

  test('ردِ audit حفظ می‌شود: تلاشِ ناموفق در audit_logs ثبت می‌شود، حتی وقتی پاسخ ۲۰۴ است', async () => {
    await clearLimits();
    const since = new Date(Date.now() - 1000);
    await staffReq.POST(post({ phone: PHONE_UNKNOWN }));
    const rows = await db.auditLog.findMany({
      where: { action: 'auth.failure', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }, take: 5,
    });
    assert.ok(rows.length > 0,
      'با یکدست‌شدنِ پاسخ، audit تنها سیگنالِ باقی‌مانده است — نبودش یعنی رصدپذیری را کشته‌ایم');
  });
});
