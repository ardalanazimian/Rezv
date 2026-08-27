import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  ورود با نامِ کاربری و رمز (مهاجرتِ ۰۷۴)
//
//  ⚠️ چرا این مسیر ساخته شد: تنها راهِ ورود به هر سه اپ OTPِ پیامکی بود و
//  `OTP_DEV_MODE` در production استثنا پرتاب می‌کند. یعنی بدونِ
//  اعتبارنامه‌ی پیامک (حالا ملی‌پیامک) هیچ‌کس — حتی مالکِ محصول — نمی‌توانست وارد پنل شود.
//
//  ⚠️ بیشترِ تست‌های این فایل **منفی**اند، و عمداً: یک فرمِ نام‌کاربری/رمز
//  اگر بی‌دقت ساخته شود سه چیز را ارزان لو می‌دهد — وجودِ حساب، مرزِ
//  تنانت، و در نهایت خودِ رمز از راهِ brute-force. ارزشِ این فایل در
//  اثباتِ چیزهایی است که **نباید** کار کنند.
//
//  همه‌ی درخواست‌ها `x-real-ip` یکتا می‌گیرند: مسیرِ ورود ریت‌لیمیتِ
//  دوبُعدی دارد (هم IP و هم نام کاربری) و بدونِ IPِ یکتا خودِ فایل به سقف
//  می‌خورد — همان دامی که یک‌بار در `member-create` افتاد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { normalizePhone } = await import('../src/lib/otp');
const { hashPassword, verifyPassword, normalizeUsername } = await import('../src/lib/password');
const adminLogin = await import('../src/app/api/v1/auth/admin/login/route');
const staffLogin = await import('../src/app/api/v1/auth/staff/login/route');
const creds = await import('../src/app/api/v1/admin/staff-credentials/route');

const TAG = `pw${Date.now().toString(36)}`;
const ADMIN_USER = `adm_${TAG}`;
const ADMIN_PASS = 'AdminPass!2026';
const BIZ_USER = `biz_${TAG}`;
const BIZ_PASS = 'BizPass!2026';

let platformTenantId: string, bizTenantId: string, restaurantId: string;
let savedPlatformEnv: string | undefined;

function post(body: unknown, token?: string) {
  return new Request('http://x/api', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-real-ip': testIp(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ⚠️ همه‌چیز عمداً داخلِ **یک** describeِ بیرونی است.
//
// در `node:test` هوکی که بیرونِ هر describe نوشته شود به سوئیتِ **ROOT**
// می‌چسبد — یعنی در رانرِ مشترک یک‌بار در ابتدای **کلِ** اجرا و یک‌بار در
// انتهایش اجرا می‌شود، نه دورِ تست‌های همین فایل. نسخه‌ی اولِ همین فایل
// دقیقاً همین اشتباه را داشت و `process.env.PLATFORM_ADMIN_TENANT_ID` را
// برای کلِ اجرا ست می‌کرد؛ **پنج** فایلِ دیگر به آن متغیر وابسته‌اند و در
// CI قرمز شدند (محلی چون فایل تنها اجرا می‌شد، سبز بود).
//
// این دومین بارِ همین اشتباه در این مخزن است (بارِ اول:
// `email-transport-honesty` که `globalThis.fetch` را برای ۲۹ تستِ بی‌ربط
// خراب کرد). قاعده: **هیچ هوکی در سطحِ فایل ننویس.**
describe('ورود با نام کاربری و رمز (مهاجرتِ ۰۷۴)', () => {

before(async () => {
  savedPlatformEnv = process.env.PLATFORM_ADMIN_TENANT_ID;
  const pt = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-plat` }, select: { id: true } });
  platformTenantId = pt.id;
  process.env.PLATFORM_ADMIN_TENANT_ID = pt.id;
  await db.staff.create({ data: {
    tenantId: pt.id, phone: fixturePhone('0925'), name: '[DEMO] ادمین',
    role: 'owner', isActive: true, username: ADMIN_USER,
    passwordHash: await hashPassword(ADMIN_PASS), passwordUpdatedAt: new Date(),
  } });

  const bt = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-biz` }, select: { id: true } });
  bizTenantId = bt.id;
  const r = await db.restaurant.create({
    data: { tenantId: bt.id, slug: `zz-${TAG}`, name: `[DEMO] ${TAG}`, clubPrefix: 'PWT' },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  if (savedPlatformEnv === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
  else process.env.PLATFORM_ADMIN_TENANT_ID = savedPlatformEnv;
  const ids = [platformTenantId, bizTenantId].filter(Boolean);
  await db.staff.deleteMany({ where: { tenantId: { in: ids } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId: bizTenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
});

describe('هشِ رمز — واحد', () => {
  test('🔴 رمزِ درست تأیید و رمزِ غلط رد می‌شود', async () => {
    const h = await hashPassword('CorrectHorse!9');
    assert.equal(await verifyPassword('CorrectHorse!9', h), true);
    assert.equal(await verifyPassword('CorrectHorse!8', h), false);
  });

  test('🔴 دو بار هش‌کردنِ یک رمز، دو رشته‌ی متفاوت می‌دهد (نمکِ تصادفی)', async () => {
    // بدونِ نمکِ یکتا، دو کاربر با رمزِ یکسان هشِ یکسان می‌گرفتند و یک
    // جدولِ رنگین‌کمانی هر دو را با هم می‌شکست.
    const [a, b] = [await hashPassword('SamePass!123'), await hashPassword('SamePass!123')];
    assert.notEqual(a, b, 'نمک باید تصادفی باشد');
    assert.equal(await verifyPassword('SamePass!123', a), true);
    assert.equal(await verifyPassword('SamePass!123', b), true);
  });

  test('🔴 رشته‌ی خراب/خالی همیشه false می‌دهد و پرتاب نمی‌کند', async () => {
    // پرتاب‌کردن یعنی ۵۰۰ به‌جای ۴۰۱ — که خودش می‌گوید این حساب چیزِ
    // غیرعادی دارد.
    for (const bad of ['', 'garbage', 'scrypt$x$y$z$q$w', 'a$b$c$d$e$f']) {
      assert.equal(await verifyPassword('anything', bad), false, `ورودی: ${bad}`);
    }
    assert.equal(await verifyPassword('anything', null), false);
  });

  test('🔴 هشِ otp.ts برای رمز استفاده نمی‌شود (sha256 نیست)', async () => {
    // کنترلِ ساختاری: اگر روزی کسی به الگویِ ارزانِ otp.ts برگردد، این
    // می‌گیردش. هشِ scrypt باید پیشوندِ خودش را داشته باشد.
    const h = await hashPassword('Whatever!123');
    assert.ok(h.startsWith('scrypt$'), `قالبِ غیرمنتظره: ${h.slice(0, 20)}`);
    assert.notEqual(h.length, 64, 'طولِ ۶۴ یعنی sha256 hex — رمز هرگز نباید این‌طور ذخیره شود');
  });

  test('نامِ کاربری همیشه lowercase می‌شود', async () => {
    // ستونِ DB یکتاست ولی حساس به حروف؛ اگر یک مسیر نرمال نکند، `Ardalan`
    // و `ardalan` دو حساب می‌شوند و قیدِ یکتایی هیچ‌کدام را نمی‌گیرد.
    assert.equal(normalizeUsername('  ArDaLaN '), 'ardalan');
  });
});

describe('ورودِ پنلِ شرکت با رمز', () => {
  test('🔴 مدیرِ پلتفرم با نام کاربری و رمز وارد می‌شود', async () => {
    const res = await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.access && body.refresh, 'باید توکن بدهد');
    assert.equal(body.admin.tenant_id, platformTenantId);
  });

  test('🔴 نام کاربری بدونِ حساسیت به حروفِ بزرگ کار می‌کند', async () => {
    const res = await adminLogin.POST(post({ username: ADMIN_USER.toUpperCase(), password: ADMIN_PASS }));
    assert.equal(res.status, 200, 'ADMIN_USER با حروفِ بزرگ باید همان حساب باشد');
  });

  test('🔴 رمزِ اشتباه ۴۰۱ می‌گیرد', async () => {
    const res = await adminLogin.POST(post({ username: ADMIN_USER, password: 'DefinitelyWrong!1' }));
    assert.equal(res.status, 401);
  });

  test('🔴 کاربرِ ناموجود از رمزِ غلط **تفکیک‌پذیر نیست**', async () => {
    // مهم‌ترین گاردِ ضدِ شمارشِ حساب: اگر این دو فرق کنند، مهاجم اول فهرستِ
    // حساب‌های واقعی را می‌سازد و بعد فقط روی آن‌ها رمز حدس می‌زند.
    const a = await adminLogin.POST(post({ username: ADMIN_USER, password: 'DefinitelyWrong!1' }));
    const b = await adminLogin.POST(post({ username: `ghost_${TAG}`, password: 'DefinitelyWrong!1' }));
    assert.equal(a.status, b.status, 'کدِ وضعیت باید یکی باشد');
    const [ja, jb] = [await a.json(), await b.json()];
    assert.equal(ja.error.code, jb.error.code, 'کدِ خطا باید یکی باشد');
    assert.equal(ja.error.message, jb.error.message, 'پیام باید یکی باشد');
  });
});

describe('🔴 مرزها — چیزهایی که نباید کار کنند', () => {
  test('ساختِ اعتبارنامه بدونِ توکنِ ادمین بسته است', async () => {
    const res = await creds.POST(post({
      restaurant_id: restaurantId, phone: fixturePhone('0925'),
      username: `nope_${TAG}`, password: 'Whatever!2026',
    }));
    assert.ok(res.status === 401 || res.status === 403, `انتظار ۴۰۱/۴۰۳، دریافت ${res.status}`);
  });

  test('🔴 اعتبارنامه‌ی بیزنس به پنلِ شرکت راه نمی‌دهد', async () => {
    // احراز موفق است ولی **مجوز** نه — دو مرحله‌ی جدا.
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    const made = await creds.POST(post({
      restaurant_id: restaurantId, phone: fixturePhone('0925'),
      username: BIZ_USER, password: BIZ_PASS, name: '[DEMO] صاحبِ رستوران',
    }, admin.access));
    assert.equal(made.status, 201);

    const ok = await staffLogin.POST(post({ username: BIZ_USER, password: BIZ_PASS }));
    assert.equal(ok.status, 200, 'بیزنس باید وارد پنلِ خودش شود');
    const bizBody = await ok.json();
    assert.equal(bizBody.staff.tenant_id, bizTenantId, 'توکن باید تنانتِ خودش را بدهد');

    const denied = await adminLogin.POST(post({ username: BIZ_USER, password: BIZ_PASS }));
    assert.equal(denied.status, 403, 'همان اعتبارنامه نباید پنلِ شرکت را باز کند');
  });

  test('🔴 نامِ کاربریِ تکراری رد می‌شود', async () => {
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    const res = await creds.POST(post({
      restaurant_id: restaurantId, phone: fixturePhone('0925'),
      username: BIZ_USER, password: 'Another!2026',
    }, admin.access));
    assert.equal(res.status, 422);
  });

  test('🔴 رمزِ کوتاه‌تر از حداقل پذیرفته نمی‌شود', async () => {
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    const res = await creds.POST(post({
      restaurant_id: restaurantId, phone: fixturePhone('0925'),
      username: `weak_${TAG}`, password: 'abc',
    }, admin.access));
    assert.equal(res.status, 422);
  });

  test('🔴 کارمندِ غیرفعال با رمزِ درست هم وارد نمی‌شود', async () => {
    const staff = await db.staff.findUnique({ where: { username: BIZ_USER }, select: { id: true } });
    assert.ok(staff, 'کارمندِ آزمون باید وجود داشته باشد');
    await db.staff.update({ where: { id: staff.id }, data: { isActive: false } });
    const res = await staffLogin.POST(post({ username: BIZ_USER, password: BIZ_PASS }));
    assert.equal(res.status, 403);
    await db.staff.update({ where: { id: staff.id }, data: { isActive: true } });
  });

  test('🔴 حسابی که رمز ندارد، با رمزِ خالی یا هر رمزی وارد نمی‌شود', async () => {
    // مسیرِ فقط-OTP نباید سهواً یک درِ باز شود.
    const phone = fixturePhone('0925');
    const s = await db.staff.create({
      data: { tenantId: bizTenantId, phone, name: '[DEMO] بدونِ رمز', role: 'staff', isActive: true,
              username: `nopass_${TAG}` },
      select: { id: true },
    });
    for (const p of ['', 'anything', 'x'.repeat(8)]) {
      const res = await staffLogin.POST(post({ username: `nopass_${TAG}`, password: p }));
      assert.ok(res.status === 401 || res.status === 422, `رمزِ «${p}» نباید کار کند (${res.status})`);
    }
    await db.staff.delete({ where: { id: s.id } });
  });

  // ═══ مسیرِ سومِ ایندکسِ ۰۷۹ (بازبینیِ مالک، ۰۸-۲۷): این upsert هم owner می‌سازد ═══

  test('🔴 ساختِ اعتبارنامه با شماره‌ای که در تنانتِ دیگری owner است → ۴۰۹ خوانا، نه ۵۰۰', async () => {
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    // staff.phone همیشه نرمال‌شده (+98…) ذخیره می‌شود؛ درجِ خام تداخل را جور نمی‌کند.
    const phone = normalizePhone(fixturePhone('0925'));
    const other = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-other1` }, select: { id: true } });
    try {
      await db.staff.create({ data: { tenantId: other.id, phone, role: 'owner', isActive: true } });
      // بدونِ role در بدنه → پیش‌فرضِ create برابرِ owner است (خطِ ۱۰۹ route).
      const res = await creds.POST(post({
        restaurant_id: restaurantId, phone,
        username: `dup1_${TAG}`, password: 'Whatever!2026',
      }, admin.access));
      assert.equal(res.status, 409, await res.clone().text());
      assert.equal((await res.json()).error?.details?.reason, 'duplicate_owner_phone');
      // هیچ ردیفی در تنانتِ مقصد ساخته نشده
      assert.equal(await db.staff.count({ where: { tenantId: bizTenantId, phone } }), 0);
    } finally {
      await db.staff.deleteMany({ where: { tenantId: other.id } }).catch(() => {});
      await db.tenant.delete({ where: { id: other.id } }).catch(() => {});
    }
  });

  test('🔴 ارتقایِ staff موجود به owner وقتی شماره‌اش جای دیگری owner است → ۴۰۹ و نقش دست‌نخورده', async () => {
    // ایندکسِ جزئی UPDATE را هم می‌گیرد (predicate روی role است) — این تست
    // دقیقاً همان مسیرِ ارتقاست، نه create.
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    const phone = normalizePhone(fixturePhone('0925'));
    const other = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-other2` }, select: { id: true } });
    const local = await db.staff.create({
      data: { tenantId: bizTenantId, phone, role: 'staff', isActive: true },
      select: { id: true },
    });
    try {
      await db.staff.create({ data: { tenantId: other.id, phone, role: 'owner', isActive: true } });
      const res = await creds.POST(post({
        restaurant_id: restaurantId, phone, role: 'owner',
        username: `dup2_${TAG}`, password: 'Whatever!2026',
      }, admin.access));
      assert.equal(res.status, 409, await res.clone().text());
      assert.equal((await res.json()).error?.details?.reason, 'duplicate_owner_phone');
      const after = await db.staff.findUnique({ where: { id: local.id }, select: { role: true, username: true } });
      assert.equal(after?.role, 'staff', 'ارتقا نباید نصفه اعمال شده باشد');
      assert.equal(after?.username, null, 'اعتبارنامه هم نباید نصفه ست شده باشد');
    } finally {
      await db.staff.deleteMany({ where: { tenantId: other.id } }).catch(() => {});
      await db.staff.delete({ where: { id: local.id } }).catch(() => {});
      await db.tenant.delete({ where: { id: other.id } }).catch(() => {});
    }
  });

  test('ارتقایِ staff به owner با شماره‌ی بدونِ تداخل همچنان کار می‌کند (گاردِ جدید بیش‌ازحد نمی‌بندد)', async () => {
    const admin = await (await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }))).json();
    const phone = normalizePhone(fixturePhone('0925'));
    const local = await db.staff.create({
      data: { tenantId: bizTenantId, phone, role: 'staff', isActive: true },
      select: { id: true },
    });
    try {
      const res = await creds.POST(post({
        restaurant_id: restaurantId, phone, role: 'owner',
        username: `ok_${TAG}`, password: 'Whatever!2026',
      }, admin.access));
      assert.equal(res.status, 200, await res.clone().text());
      const after = await db.staff.findUnique({ where: { id: local.id }, select: { role: true } });
      assert.equal(after?.role, 'owner');
    } finally {
      await db.staff.delete({ where: { id: local.id } }).catch(() => {});
    }
  });
});

});
