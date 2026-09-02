import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TOTP, Secret } from 'otpauth';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  عاملِ سومِ ورودِ مدیرِ پلتفرم — TOTP (RFC 6238)
//
//  ⚠️ چرا این قابلیت ساخته شد: ترانسپورتِ پیامک قفل است («مستلزم تنظیم و
//  تأیید مدیر») و `OTP_DEV_MODE` در production استثنا می‌دهد — یعنی هیچ‌کس
//  نمی‌تواند وارد هیچ پنلی شود. TOTP کاملاً **آفلاین** است و این وابستگی را
//  قطع می‌کند. (این «ورود با گوگل» نیست؛ هیچ ارتباطی با accounts.google.com
//  ندارد و اگر گوگل قطع شود هم کار می‌کند.)
//
//  ⚠️ همه‌چیز عمداً داخلِ **یک** describeِ بیرونی است — همان درسی که
//  `password-login` و `email-transport-honesty` با شکستِ واقعیِ CI دادند:
//  هوکِ سطحِ فایل به سوئیتِ ROOT می‌چسبد و کلِ اجرا را آلوده می‌کند.
//  این فایل env و Redis را دست‌کاری می‌کند، پس نشتش فاجعه‌بار می‌بود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { hashPassword } = await import('../src/lib/password');
const adminLogin = await import('../src/app/api/v1/auth/admin/login/route');
const overview = await import('../src/app/api/v1/admin/overview/route');

const TAG = `totp-${String(Date.now()).slice(-7)}`;
const ADMIN_USER = `admin_${TAG}`;
const ADMIN_PASS = 'Str0ng-Admin-Pass!';
const STAFF_USER = `staff_${TAG}`;
const STAFF_PASS = 'Str0ng-Staff-Pass!';
const SECRET = new Secret({ size: 20 }).base32;

let platformTenantId = '';
let bizTenantId = '';
const saved: Record<string, string | undefined> = {};

function totpNow(offsetSteps = 0): string {
  const t = new TOTP({
    issuer: 'Rezervno', label: ADMIN_USER,
    algorithm: 'SHA1', digits: 6, period: 30,
    secret: Secret.fromBase32(SECRET),
  });
  return t.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

function post(body: unknown, ip = testIp()) {
  return new Request('http://x/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify(body),
  });
}

/**
 * سطل‌های ریت‌لیمیت **و** کلیدهای ضدِ replay را پاک کن.
 *
 * ⚠️ کلیدِ replay لازم است: چند تست در یک پنجره‌ی ۳۰ ثانیه‌ای اجرا می‌شوند و
 * همگی `totpNow()` یکسانی می‌گیرند. بدونِ پاک‌کردن، تستِ دوم به بعد ۴۰۱
 * می‌گیرند — نه به‌خاطرِ باگ، بلکه چون ضدِ replay **درست کار می‌کند**.
 * فقط در `beforeEach` صدا زده می‌شود، هرگز وسطِ تستِ replay.
 */
async function clearBuckets() {
  for (const pat of ['*admtotp*', '*pwlogin*', 'admin:totp:used:*']) {
    const keys = await redis.keys(pat);
    if (keys.length) await redis.del(...keys);
  }
}

describe('ورودِ سه‌عاملیِ مدیرِ پلتفرم (رمز + TOTP)', () => {
  before(async () => {
    for (const k of ['PLATFORM_ADMIN_TENANT_ID', 'ADMIN_LOGIN_ENABLED',
                     'ADMIN_TOTP_USERNAME', 'ADMIN_TOTP_SECRET']) {
      saved[k] = process.env[k];
    }

    const pt = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-plat` }, select: { id: true } });
    platformTenantId = pt.id;
    process.env.PLATFORM_ADMIN_TENANT_ID = pt.id;
    await db.staff.create({ data: {
      tenantId: pt.id, phone: fixturePhone('0951'), name: '[DEMO] مدیرِ پلتفرم',
      role: 'owner', isActive: true, username: ADMIN_USER,
      passwordHash: await hashPassword(ADMIN_PASS), passwordUpdatedAt: new Date(),
    } });

    // کارمندِ عادیِ یک کسب‌وکارِ دیگر — برای اثباتِ «مجوز جدا از احراز».
    const bt = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-biz` }, select: { id: true } });
    bizTenantId = bt.id;
    await db.staff.create({ data: {
      tenantId: bt.id, phone: fixturePhone('0952'), name: '[DEMO] کارمند',
      role: 'owner', isActive: true, username: STAFF_USER,
      passwordHash: await hashPassword(STAFF_PASS), passwordUpdatedAt: new Date(),
    } });
  });

  beforeEach(async () => {
    process.env.ADMIN_LOGIN_ENABLED = 'true';
    process.env.ADMIN_TOTP_USERNAME = ADMIN_USER;
    process.env.ADMIN_TOTP_SECRET = SECRET;
    await clearBuckets();
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await clearBuckets();
    await db.auditLog.deleteMany({ where: { tenantId: { in: [platformTenantId, bizTenantId] } } }).catch(() => {});
    await db.staff.deleteMany({ where: { tenantId: { in: [platformTenantId, bizTenantId] } } });
    await db.tenant.deleteMany({ where: { id: { in: [platformTenantId, bizTenantId] } } });
    await db.$disconnect();
  });

  // ── کنترلِ مثبت، اول: اگر این سبز نباشد بقیه‌ی ادعاها بی‌معنا هستند ──
  test('کنترلِ مثبت — هر سه عامل درست → ورودِ موفق', async () => {
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow(),
    }));
    // ⚠️ بدنه فقط **یک بار** خوانده می‌شود: پیامِ assert پیش از خودِ assert
    // ارزیابی می‌شود، پس `await res.text()` داخلِ آن بدنه را مصرف می‌کرد و
    // خطای واقعی زیرِ «Body is unusable» پنهان می‌شد.
    const raw = await res.text();
    assert.equal(res.status, 200, raw);
    const body = JSON.parse(raw);
    assert.ok(body.access, 'توکنِ access باید صادر شود');
    assert.equal(body.admin.tenant_id, platformTenantId);
  });

  test('⭐ توکنِ صادرشده همان platform-admin است و روی /v1/admin/* کار می‌کند', async () => {
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow(),
    }));
    const { access } = await res.json();

    // شکلِ principal — نه یک نوعِ تازه.
    const claims = JSON.parse(Buffer.from(access.split('.')[1], 'base64url').toString());
    assert.equal(claims.kind, 'staff', 'باید همان principalِ معمول باشد، نه نوعِ تازه');
    assert.equal(claims.role, 'owner');
    assert.equal(claims.tenantId, platformTenantId);

    // و واقعاً روی یک روتِ ادمین کار کند — نه فقط شکلش درست باشد.
    const probe = await overview.GET(new Request('http://x/api/v1/admin/overview', {
      headers: { authorization: `Bearer ${access}`, 'x-real-ip': testIp() },
    }));
    assert.notEqual(probe.status, 401, 'توکن باید روی روتِ ادمین پذیرفته شود');
    assert.notEqual(probe.status, 403, 'و مجوزش هم باید کافی باشد');
  });

  // ── سه شکستِ متفاوت، یک پیامِ یکسان ──
  test('رمزِ درست + TOTPِ غلط → ۴۰۱', async () => {
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: '000000',
    }));
    assert.equal(res.status, 401);
  });

  test('رمزِ غلط + TOTPِ درست → ۴۰۱ با **همان** پیام', async () => {
    const a = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: '000000',
    }));
    await clearBuckets();
    const b = await adminLogin.POST(post({
      username: ADMIN_USER, password: 'Wr0ng-Password!x', totp: totpNow(),
    }));
    assert.equal(b.status, 401);
    const [ja, jb] = [await a.json(), await b.json()];
    assert.equal(jb.error.message, ja.error.message,
      'تفاوتِ پیام یعنی مهاجم می‌فهمد کدام نیمه را درست حدس زده');
    assert.equal(jb.error.code, ja.error.code, 'کدِ خطا هم باید یکسان باشد');
  });

  test('usernameِ غیر از ADMIN_TOTP_USERNAME → ۴۰۱ با همان پیام', async () => {
    // رازِ env مالِ ADMIN_USER است. کارمندِ دیگر با اعتبارنامه‌ی **درستِ خودش**
    // هم نباید از این مسیر رد شود.
    process.env.ADMIN_TOTP_USERNAME = 'someone_else';
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow(),
    }));
    assert.equal(res.status, 401);
    const j = await res.json();
    assert.equal(j.error.code, 'INVALID_CREDENTIALS', 'نباید دلیلِ واقعی افشا شود');
  });

  // ── ضدِ replay ──
  test('همان کدِ TOTP دو بار → بارِ دوم رد می‌شود', async () => {
    const code = totpNow();
    const first = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: code,
    }));
    assert.equal(first.status, 200, 'بارِ اول باید موفق باشد — وگرنه ادعای زیر بی‌معناست');

    const second = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: code,
    }));
    assert.equal(second.status, 401,
      'کدِ مصرف‌شده باید تا پایانِ پنجره‌اش رد شود — وگرنه شنودِ یک کد کافی است');
  });

  test('کدِ خارج از پنجره‌ی زمانی رد می‌شود', async () => {
    // ±۱ گام پذیرفته است، پس گامِ +۵ (۱۵۰ ثانیه بعد) باید رد شود.
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow(5),
    }));
    assert.equal(res.status, 401, 'پنجره باید حداکثر ±۱ گام باشد');
  });

  test('کنترلِ مثبتِ پنجره — گامِ ±۱ پذیرفته می‌شود', async () => {
    // بدونِ این، پنجره‌ای که **همه چیز** را رد کند هم تستِ بالا را پاس می‌کرد.
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow(-1),
    }));
    assert.equal(res.status, 200, 'یک گام عقب باید پذیرفته شود (اختلافِ ساعت)');
  });

  // ── گاردِ فعال‌سازی ──
  test('ADMIN_LOGIN_ENABLED=false → totp لازم نیست و رفتارِ قبلی برقرار است', async () => {
    process.env.ADMIN_LOGIN_ENABLED = 'false';
    const res = await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS }));
    assert.equal(res.status, 200, 'با قابلیتِ خاموش، ورودِ دوعاملیِ قبلی باید دست‌نخورده کار کند');
  });

  test('ADMIN_LOGIN_ENABLED=true ولی راز ست‌نشده → ورود ممنوع (fail-closed)', async () => {
    delete process.env.ADMIN_TOTP_SECRET;
    const res = await adminLogin.POST(post({
      username: ADMIN_USER, password: ADMIN_PASS, totp: '123456',
    }));
    assert.equal(res.status, 401,
      'نبودِ پیکربندی نباید بی‌صدا به دو عاملی برگردد — این خطرناک‌ترین حالتِ سکوت است');
  });

  // ── مجوز جدا از احراز ──
  test('کارمندِ عادی با رمزِ درستِ خودش همچنان رد می‌شود', async () => {
    process.env.ADMIN_TOTP_USERNAME = STAFF_USER;
    const res = await adminLogin.POST(post({
      username: STAFF_USER, password: STAFF_PASS,
      totp: new TOTP({ issuer: 'Rezervno', label: STAFF_USER, algorithm: 'SHA1',
                       digits: 6, period: 30, secret: Secret.fromBase32(SECRET) }).generate(),
    }));
    assert.equal(res.status, 403, 'تنانتش پلتفرم نیست — احراز موفق، مجوز ناموفق');
  });

  // ── سقفِ تلاش ──
  test('بیش از حدِ تلاش → ۴۲۹', async () => {
    const ip = testIp();
    let saw429 = false;
    for (let i = 0; i < 8; i++) {
      const r = await adminLogin.POST(post({
        username: ADMIN_USER, password: 'Wr0ng-Password!x', totp: '000000',
      }, ip));
      if (r.status === 429) { saw429 = true; break; }
    }
    assert.ok(saw429, 'سقفِ ۵ در ۱۵ دقیقه باید پیش از تلاشِ هشتم فعال شود');
  });

  // ── ردِ ممیزی ──
  test('هر تلاش — موفق و ناموفق — در AuditLog ثبت می‌شود', async () => {
    const before = await db.auditLog.count({ where: { action: { in: ['auth.login', 'auth.failure'] } } });

    await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS, totp: totpNow() }));
    await clearBuckets();
    await adminLogin.POST(post({ username: ADMIN_USER, password: ADMIN_PASS, totp: '000000' }));

    const after = await db.auditLog.count({ where: { action: { in: ['auth.login', 'auth.failure'] } } });
    assert.equal(after, before + 2, 'هر دو تلاش باید ردِ ممیزی داشته باشند');

    const fail = await db.auditLog.findFirst({
      where: { action: 'auth.failure' }, orderBy: { createdAt: 'desc' },
      select: { detail: true, ip: true },
    });
    assert.ok(fail?.ip, 'IP باید ثبت شود');
    assert.equal((fail?.detail as Record<string, unknown>)?.channel, 'platform-admin-password');
  });
});
