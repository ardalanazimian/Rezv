import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  مسیرِ OTPِ پنلِ شرکت پشتِ فلگ — و پیش‌فرضش **خاموش**
//
//  ⚠️ چرا (یافته‌ی فازِ ۰، `docs/audit/AUTH-SMS-PHASE0.md`): مسیرِ
//  `auth/admin/request|verify` همان principalِ platform-admin را صادر
//  می‌کند **بدونِ اینکه TOTP بخواهد**. یعنی عاملِ سومی که در
//  `auth/admin/login` ساخته شد، یک درِ باز پشتِ سرش داشت: هر کسی که به
//  شماره‌ی مدیر دسترسی داشت، بدونِ کدِ اپلیکیشن وارد می‌شد.
//
//  رفتارِ خاموش عمداً **۴۰۴** است نه ۴۰۳: تفاوتشان به مهاجم می‌گوید مسیری
//  هست که فقط بسته است. ۴۰۴ یعنی «چنین چیزی وجود ندارد».
//
//  ⚠️ همه‌چیز داخلِ **یک** describe — هوکِ سطحِ فایل به سوئیتِ ROOT می‌چسبد
//  و این فایل هم env هم `platform_settings` را دست‌کاری می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { setPlatformSetting } = await import('../src/lib/platform-settings');
const { redis } = await import('../src/lib/redis');
const adminRequest = await import('../src/app/api/v1/auth/admin/request/route');
const adminVerify = await import('../src/app/api/v1/auth/admin/verify/route');
const adminLogin = await import('../src/app/api/v1/auth/admin/login/route');

const FLAG = 'feature_flag:admin_otp_login_enabled';
const SFX = String(Date.now()).slice(-7);
const saved: Record<string, string | undefined> = {};
let platformTenantId = '';
let adminPhone = '';

/** کشِ `platform_settings` سی ثانیه است — بینِ دو حالتِ فلگ باید پاک شود. */
async function setFlag(on: boolean | null) {
  if (on === null) {
    await db.platformSettings.deleteMany({ where: { key: FLAG } });
  } else {
    await setPlatformSetting(FLAG, on ? 'true' : 'false');
  }
  const keys = await redis.keys('*platform-settings*');
  if (keys.length) await redis.del(...keys);
}

/** GET هم از `withApiMetrics` رد می‌شود و به `req.headers` دست می‌زند —
 *  پس حتی برایِ GET باید یک Requestِ واقعی داد، نه هیچ. */
function get() {
  return new Request('http://x/api/v1/auth/admin/login', {
    headers: { 'x-real-ip': testIp() },
  });
}

function post(body: unknown) {
  return new Request('http://x/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': testIp() },
    body: JSON.stringify(body),
  });
}

describe('فلگِ admin_otp_login_enabled — پیش‌فرض خاموش، مسیر ۴۰۴', () => {
  before(async () => {
    saved.PLATFORM_ADMIN_TENANT_ID = process.env.PLATFORM_ADMIN_TENANT_ID;
    const pt = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-otpflag` }, select: { id: true } });
    platformTenantId = pt.id;
    process.env.PLATFORM_ADMIN_TENANT_ID = pt.id;
    adminPhone = fixturePhone('0991');
    await db.staff.create({ data: {
      tenantId: pt.id, phone: adminPhone, name: '[DEMO] مدیرِ پلتفرم',
      role: 'owner', isActive: true,
    } });
  });

  beforeEach(async () => {
    const k = await redis.keys('*otp*');
    if (k.length) await redis.del(...k);
  });

  after(async () => {
    if (saved.PLATFORM_ADMIN_TENANT_ID === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
    else process.env.PLATFORM_ADMIN_TENANT_ID = saved.PLATFORM_ADMIN_TENANT_ID;
    await setFlag(null);
    await db.otpCode.deleteMany({ where: { phone: { contains: adminPhone.slice(-8) } } }).catch(() => {});
    await db.staff.deleteMany({ where: { tenantId: platformTenantId } });
    await db.tenant.deleteMany({ where: { id: platformTenantId } });
    await db.$disconnect();
  });

  // ── پیش‌فرض: کلید در DB نیست ──
  test('پیش‌فرضِ نبودِ کلید = خاموش (استثنایِ fail-open این ماژول)', async () => {
    await setFlag(null);
    const { isFeatureEnabled } = await import('../src/lib/feature-flags');
    assert.equal(await isFeatureEnabled('admin_otp_login_enabled'), false,
      'این فلگ باید در DEFAULT_OFF باشد — وگرنه عاملِ سوم از روزِ نصب دور زده می‌شود');
  });

  test('خاموش → /auth/admin/request چهارصدوچهار می‌دهد، نه ۴۰۳', async () => {
    await setFlag(null);
    const res = await adminRequest.POST(post({ phone: adminPhone }));
    assert.equal(res.status, 404,
      '۴۰۳ به مهاجم می‌گوید مسیری هست که فقط بسته است؛ ۴۰۴ یعنی وجود ندارد');
  });

  test('خاموش → /auth/admin/verify هم ۴۰۴', async () => {
    await setFlag(null);
    const res = await adminVerify.POST(post({ phone: adminPhone, code: '123456' }));
    assert.equal(res.status, 404);
  });

  test('خاموش → GET /auth/admin/login پرچمِ otp_login_enabled=false می‌دهد', async () => {
    await setFlag(null);
    const res = await adminLogin.GET(get());
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.otp_login_enabled, false,
      'پنلِ استاتیک از همین پرچم می‌فهمد دکمه را نسازد');
  });

  // ── کنترلِ مثبت: روشن ──
  test('روشن → /auth/admin/request دیگر ۴۰۴ نیست (رفتارِ قبلی برقرار)', async () => {
    await setFlag(true);
    const res = await adminRequest.POST(post({ phone: adminPhone }));
    assert.notEqual(res.status, 404,
      'بدونِ این کنترل، گاردی که **همیشه** ۴۰۴ بدهد هم تست‌های بالا را پاس می‌کرد');
  });

  test('روشن → پرچم true می‌شود', async () => {
    await setFlag(true);
    const body = await (await adminLogin.GET(get())).json();
    assert.equal(body.otp_login_enabled, true);
  });

  test('صریحاً false → باز هم ۴۰۴', async () => {
    await setFlag(false);
    const res = await adminRequest.POST(post({ phone: adminPhone }));
    assert.equal(res.status, 404);
  });

  // ── UI: دکمه باید **شرطی ساخته شود**، نه با CSS پنهان ──
  test('UIِ پنلِ شرکت دکمه را شرطی می‌سازد، نه display:none', () => {
    const src = readFileSync(
      new URL('../../apps/company/js/intelligence.js', import.meta.url), 'utf8');
    const idx = src.indexOf('showAdminLoginPhone()">ورود با پیامک');
    assert.ok(idx > 0, 'دکمه‌ی «ورود با پیامک» باید در سورس باشد');

    // خطِ حاوی دکمه باید داخلِ یک شرطِ رشته‌ای باشد.
    const lineStart = src.lastIndexOf('\n', idx) + 1;
    const line = src.slice(lineStart, src.indexOf('\n', idx));
    assert.match(line, /\$\{\s*_otpLoginEnabled\s*\?/,
      'دکمه باید فقط وقتی فلگ روشن است رشته‌اش ساخته شود — '
      + 'چیزی که رندر نشود قابلِ دور زدن نیست');
    assert.doesNotMatch(line, /display\s*:\s*none/,
      'پنهان‌کردن با CSS قبلاً در همین مخزن با display:flex دور زده شد');
  });
});
