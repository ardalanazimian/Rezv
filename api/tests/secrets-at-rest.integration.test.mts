import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';

// ═══════════════════════════════════════════════════════════════════════
//  S-05 — رازها در حالتِ سکون (حکمِ D-24 ی CEO، ۲۰۲۶-۰۹-۱۷)
//
//  یافته (باز از ۲۰۲۶-۰۹-۰۳، BLOCKER طبقِ D-12): `platform_settings.zarinpal_merchant_id`،
//  `webhooks.secret` و `staff_invites.token` متنِ ساده در DB بودند، و secretِ وب‌هوک در هر
//  emit به `jobs.payload` هم کپی می‌شد. D-24:
//   • رازی که سرور دوباره می‌خواند → AES-256-GCM با کلیدِ env و شناسه‌ی کلید در هر متنِ رمز
//   • توکنِ حاملی که فقط مقایسه می‌شود → هشِ یک‌طرفه + جست‌وجو با هش + مقایسه‌ی زمان-ثابت
//   • مهاجرتِ داده‌ی idempotent؛ لینکِ دعوتِ پیش از مهاجرت پس از آن هم کار می‌کند
//   • fail-closed: نبودِ کلید/رمزگشاییِ ناموفق خطاست، هرگز متنِ ساده؛ خطاها بی‌متنِ ساده و بی‌کلید
//   • چرخش با دو بار چرخاندن اثبات می‌شود
//
//  ⚠️ پیشوندهای ۰۹۷۸ (ادمین) و ۰۹۷۹ (مالکِ دعوت) مالِ همین فایل‌اند.
// ═══════════════════════════════════════════════════════════════════════

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const box = await import('../src/lib/secret-box');
const { getZarinpalConfig, SEALED_SETTING_MASK } = await import('../src/lib/platform-settings');
const settingsRoute = await import('../src/app/api/v1/admin/settings/route.ts');
const { emit, deliverWebhook, WEBHOOK_SECRET_CONTEXT } = await import('../src/lib/events');
const { resealSecrets } = await import('../src/lib/secret-reseal');
const resealRoute = await import('../src/app/api/v1/maintenance/secrets-reseal/route.ts');
const { provisionBusiness } = await import('../src/lib/provisioning');
const { completeJob, failJob } = await import('../src/lib/queue');
const { POST: claim } = await import('../src/app/api/v1/auth/invite/[token]/claim/route.ts');
const { signAccess } = await import('../src/lib/jwt');
const { testIp } = await import('./helpers/test-ip.mts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = Math.random().toString(36).slice(2, 8);
const MERCHANT = `mrc-${randomBytes(12).toString('hex')}`;
const HOOK_SECRET = `whsec-${randomBytes(16).toString('hex')}`;
const SETTING_KEY = 'zarinpal_merchant_id';

const saved = {
  ring: process.env.SECRETS_KEYRING, active: process.env.SECRETS_ACTIVE_KEY_ID,
  tenant: process.env.PLATFORM_ADMIN_TENANT_ID, maint: process.env.MAINTENANCE_KEY,
};
const made = { tenantIds: [] as string[], restaurantId: '', hookIds: [] as string[], platformTenantId: '' };
let adminToken = '';

const keyB64 = () => randomBytes(32).toString('base64');
function useRing(entries: Array<[string, string]>, active: string) {
  process.env.SECRETS_KEYRING = entries.map(([id, k]) => `${id}:${k}`).join(',');
  process.env.SECRETS_ACTIVE_KEY_ID = active;
}
function restoreRing() {
  process.env.SECRETS_KEYRING = saved.ring;
  process.env.SECRETS_ACTIVE_KEY_ID = saved.active;
}
const reasonOf = (e: unknown) => (e as { reason?: string }).reason;

/**
 * تحویلِ وب‌هوک از M-18 با `https.request` و DNSِ pin‌شده می‌رود، نه `fetch`. این stub همان
 * فراخوان را بی‌شبکه جواب می‌دهد (قاعده‌ی ۶ِ CLAUDE.md) و هدر/بدنه‌ی ارسالی را ثبت می‌کند.
 */
async function withStubbedHttps<T>(fn: (calls: Array<{ headers: Record<string, string>; body: string }>) => Promise<T>): Promise<T> {
  const real = https.request;
  const calls: Array<{ headers: Record<string, string>; body: string }> = [];
  const fake = ((_url: unknown, opts: { headers: Record<string, string> }, cb: (res: { statusCode: number; resume(): void }) => void) => {
    const req = Object.assign(new EventEmitter(), {
      end(body: string) {
        calls.push({ headers: opts.headers, body });
        setImmediate(() => cb({ statusCode: 200, resume() {} }));
      },
    });
    return req;
  }) as unknown as typeof https.request;
  https.request = fake;
  syncBuiltinESMExports();
  try {
    return await fn(calls);
  } finally {
    https.request = real;
    syncBuiltinESMExports();
  }
}

async function writeSettingRaw(value: string) {
  await db.platformSettings.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
  await redis.del(`cache:platform-settings:${SETTING_KEY}`);
}
const readSettingRaw = async () => (await db.platformSettings.findUnique({ where: { key: SETTING_KEY } }))?.value;
async function makeHook(secret: string | null) {
  const h = await db.webhook.create({
    data: { restaurantId: made.restaurantId, url: 'https://93.184.216.34/hook', events: ['reservation.created'], secret },
    select: { id: true },
  });
  made.hookIds.push(h.id);
  return h.id;
}
const readHookRaw = async (id: string) => (await db.webhook.findUniqueOrThrow({ where: { id } })).secret;

function adminReq(method: string, body?: unknown) {
  // ⚠️ رانرِ تک‌پروسه: همه‌ی beforeهای سطحِ ماژول پیش از اولین تست اجرا می‌شوند، و beforeِ فایلِ دیگری
  // (مثلِ admin-panel-contract) این env را بعد از ما بازنویسی می‌کند. پس درست پیش از هر درخواست.
  process.env.PLATFORM_ADMIN_TENANT_ID = made.platformTenantId;
  return new Request('http://x/api/v1/admin/settings', {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': testIp(), authorization: `Bearer ${adminToken}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  const pt = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-s05-plat` }, select: { id: true } });
  made.tenantIds.push(pt.id);
  made.platformTenantId = pt.id;
  const admin = await db.staff.create({
    data: { tenantId: pt.id, phone: fixturePhone('0978'), name: '[DEMO] مدیر', role: 'owner', isActive: true },
    select: { id: true },
  });
  adminToken = signAccess({ sub: admin.id, kind: 'staff', tenantId: pt.id, role: 'owner' });
  const bt = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-s05-biz` }, select: { id: true } });
  made.tenantIds.push(bt.id);
  const r = await db.restaurant.create({
    data: { tenantId: bt.id, slug: `demo-s05-${SFX}`, name: '[DEMO] رستورانِ رازها', clubPrefix: 'DSR' },
    select: { id: true },
  });
  made.restaurantId = r.id;
});

after(async () => {
  restoreRing();
  for (const [k, v] of [['PLATFORM_ADMIN_TENANT_ID', saved.tenant], ['MAINTENANCE_KEY', saved.maint]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  // ردیفِ رمزشده با کلیدی که بعد از این فایل وجود ندارد، نباید برای فایل‌های بعدی بماند.
  await db.platformSettings.deleteMany({ where: { key: SETTING_KEY } });
  await redis.del(`cache:platform-settings:${SETTING_KEY}`);
  await db.job.deleteMany({ where: { kind: 'webhook', payload: { path: ['restaurantId'], equals: made.restaurantId } } });
  await db.webhook.deleteMany({ where: { id: { in: made.hookIds } } });
  for (const tid of made.tenantIds) {
    await db.staffInvite.deleteMany({ where: { tenantId: tid } });
    const rests = await db.restaurant.findMany({ where: { tenantId: tid }, select: { id: true } });
    for (const r of rests) {
      await db.table.deleteMany({ where: { restaurantId: r.id } });
      await db.restaurant.delete({ where: { id: r.id } }).catch(() => {});
    }
    await db.staff.deleteMany({ where: { tenantId: tid } });
    await db.tenant.delete({ where: { id: tid } }).catch(() => {});
  }
});

// ───────────────────────────────────────────────────────────────────────
describe('secret-box — AES-256-GCM با کلیدِ env', () => {
  test('رمز و بازگشت؛ متنِ رمز نه متنِ ساده را دارد نه با دو بار رمزکردن یکی است', () => {
    const a = box.sealSecret(MERCHANT, 'platform_settings:zarinpal_merchant_id');
    const b = box.sealSecret(MERCHANT, 'platform_settings:zarinpal_merchant_id');
    assert.match(a, /^enc:v1:test:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/);
    assert.equal(a.includes(MERCHANT), false);
    assert.notEqual(a, b, 'IVِ تصادفی');
    assert.equal(box.openSecret(a, 'platform_settings:zarinpal_merchant_id'), MERCHANT);
    assert.equal(box.sealedKeyId(a), 'test');
  });

  test('🔴 هر شکست خطای نام‌دار است و پیامش نه متنِ ساده دارد نه کلید', () => {
    const ctx = WEBHOOK_SECRET_CONTEXT;
    const sealed = box.sealSecret(HOOK_SECRET, ctx);
    const [, , kid, iv, tag, ct] = sealed.split(':');
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    const cases: Array<[string, () => string, string]> = [
      ['متنِ ساده', () => box.openSecret(HOOK_SECRET, ctx), 'not_sealed'],
      ['contextِ دیگر (جابه‌جاییِ ستون)', () => box.openSecret(sealed, 'platform_settings:zarinpal_merchant_id'), 'auth_failed'],
      ['tagِ دست‌کاری‌شده', () => box.openSecret(['enc', 'v1', kid, iv, flip(tag), ct].join(':'), ctx), 'auth_failed'],
      ['متنِ رمزِ دست‌کاری‌شده', () => box.openSecret(['enc', 'v1', kid, iv, tag, flip(ct)].join(':'), ctx), 'auth_failed'],
      ['کلیدِ ناشناخته', () => box.openSecret(['enc', 'v1', 'gone', iv, tag, ct].join(':'), ctx), 'unknown_key'],
      ['قالبِ ناقص', () => box.openSecret(`enc:v1:${kid}:${iv}`, ctx), 'malformed'],
    ];
    const keyMaterial = String(process.env.SECRETS_KEYRING).split(':')[1];
    for (const [label, fn, reason] of cases) {
      assert.throws(fn, (e: unknown) => {
        const m = (e as Error).message;
        return reasonOf(e) === reason && !m.includes(HOOK_SECRET) && !m.includes(keyMaterial);
      }, label);
    }
  });

  test('🔴 بدونِ حلقه‌ی کلید، نوشتن و خواندن هر دو خطا می‌دهند — نه عبورِ متنِ ساده', () => {
    const sealed = box.sealSecret(MERCHANT, 'x');
    try {
      delete process.env.SECRETS_KEYRING;
      delete process.env.SECRETS_ACTIVE_KEY_ID;
      assert.throws(() => box.sealSecret(MERCHANT, 'x'), (e: unknown) => reasonOf(e) === 'keyring');
      assert.throws(() => box.openSecret(sealed, 'x'), (e: unknown) => reasonOf(e) === 'keyring');
    } finally { restoreRing(); }
  });

  test('هشِ توکنِ حامل: قالب، مقایسه‌ی درست/غلط، و برابریِ بایت‌به‌بایت با SQLِ مهاجرتِ ۰۹۴', async () => {
    const token = randomBytes(32).toString('hex');
    const h = box.hashBearerToken(token);
    assert.match(h, /^sha256:[0-9a-f]{64}$/);
    assert.equal(box.bearerTokenMatches(token, h), true);
    assert.equal(box.bearerTokenMatches(token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'), h), false);
    assert.equal(box.bearerTokenMatches(h, h), false, 'خودِ هش توکن نیست');
    const [row] = await db.$queryRaw<Array<{ h: string }>>`
      SELECT 'sha256:' || encode(sha256(convert_to(${token}, 'UTF8')), 'hex') AS h`;
    assert.equal(row.h, h);
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('platform_settings.zarinpal_merchant_id', () => {
  test('🔴 PATCHِ پنل رمزشده ذخیره می‌شود؛ پرداخت متنِ ساده را می‌گیرد؛ GET و کش متنِ ساده ندارند', async () => {
    const res = await settingsRoute.PATCH(adminReq('PATCH', { settings: [{ key: SETTING_KEY, value: MERCHANT }] }));
    assert.equal(res.status, 200, await res.clone().text());

    const raw = await readSettingRaw();
    assert.ok(raw && box.isSealed(raw), `DB باید متنِ رمز داشته باشد، دارد: ${raw?.slice(0, 12)}…`);
    assert.equal(raw.includes(MERCHANT), false);

    assert.equal((await getZarinpalConfig()).merchantId, MERCHANT);
    const cachedValue = await redis.get(`cache:platform-settings:${SETTING_KEY}`);
    assert.ok(cachedValue, 'کش پس از خواندن پر است (وگرنه این ادعا چیزی نسنجیده)');
    assert.equal(cachedValue.includes(MERCHANT), false, 'Redis هم «در سکون» است');

    const body = await (await settingsRoute.GET(adminReq('GET'))).text();
    assert.equal(JSON.parse(body).settings[SETTING_KEY], SEALED_SETTING_MASK);
    assert.equal(body.includes(MERCHANT), false, 'پاسخِ پنل متنِ ساده ندارد');
    assert.equal(body.includes(raw), false, 'پاسخِ پنل متنِ رمز را هم ندارد');
  });

  test('🔴 فرمی که مقدارِ پوشیده را برگرداند، رازِ واقعی را بازنویسی نمی‌کند', async () => {
    const prior = await readSettingRaw();
    const res = await settingsRoute.PATCH(adminReq('PATCH', { settings: [{ key: SETTING_KEY, value: SEALED_SETTING_MASK }] }));
    assert.equal(res.status, 422);
    assert.equal(await readSettingRaw(), prior);
  });

  test('🔴 ردیفِ متنِ ساده (پیش از مهاجرت یا کاشته‌شده) خوانده نمی‌شود — not_sealed، نه fallback', async () => {
    await writeSettingRaw(MERCHANT);
    await assert.rejects(() => getZarinpalConfig(), (e: unknown) => reasonOf(e) === 'not_sealed');
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('webhooks.secret', () => {
  test('🔴 emit رازی در payloadِ job نمی‌گذارد؛ تحویل با secretِ رمزگشایی‌شده امضا می‌کند', async () => {
    const hookId = await makeHook(box.sealSecret(HOOK_SECRET, WEBHOOK_SECRET_CONTEXT));
    await emit({ event: 'reservation.created', restaurantId: made.restaurantId, payload: { s05: SFX } });
    const job = await db.job.findFirst({ where: { kind: 'webhook', payload: { path: ['webhookId'], equals: hookId } } });
    assert.ok(job, 'emit باید job ساخته باشد');
    const payloadText = JSON.stringify(job.payload);
    assert.equal('secret' in (job.payload as object), false);
    assert.equal(payloadText.includes(HOOK_SECRET), false);
    assert.equal(payloadText.includes('enc:v1:'), false, 'متنِ رمز هم در صف نمی‌ماند');

    // ⚠️ afterِ این فایل در رانرِ تک‌پروسه آخرِ کلِ سوئیت اجرا می‌شود؛ jobِ مانده را drainِ فایلِ دیگری با تحویلِ واقعی برمی‌داشت.
    await db.job.delete({ where: { id: job.id } });
    const calls = await withStubbedHttps(async (c) => {
      await deliverWebhook(job.payload as Parameters<typeof deliverWebhook>[0]);
      return c;
    });
    assert.equal(calls.length, 1, 'دقیقاً یک تحویل');
    assert.equal(calls[0].headers['X-Rezervno-Signature'], `sha256=${createHmac('sha256', HOOK_SECRET).update(calls[0].body).digest('hex')}`);
  });

  test('🔴 secretِ متنِ ساده در ردیف → تحویل رد می‌شود و هیچ درخواستی بی‌امضا نمی‌رود', async () => {
    const hookId = await makeHook(HOOK_SECRET);
    const calls = await withStubbedHttps(async (c) => {
      await assert.rejects(
        () => deliverWebhook({ webhookId: hookId, url: 'https://93.184.216.34/hook', event: 'reservation.created', data: {}, restaurantId: made.restaurantId }),
        (e: unknown) => reasonOf(e) === 'not_sealed' && !(e as Error).message.includes(HOOK_SECRET),
      );
      return c;
    });
    assert.equal(calls.length, 0, 'هیچ درخواستی بی‌امضا نرفت');
    await db.webhook.delete({ where: { id: hookId } });
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('بازرمزنگاری — مهاجرتِ داده و چرخشِ کلید', () => {
  test('🔴 مهاجرتِ متنِ ساده صریح است، و اجرای دوم دقیقاً no-op', async () => {
    await db.webhook.deleteMany({ where: { id: { in: made.hookIds } } });
    await writeSettingRaw(MERCHANT);
    const hookId = await makeHook(HOOK_SECRET);

    const dry = await resealSecrets({ sealPlaintext: false });
    assert.equal(dry.plaintext_skipped, 2);
    assert.equal(dry.sealed_plaintext, 0);
    assert.equal(await readSettingRaw(), MERCHANT, 'بدونِ seal_plaintext دست نمی‌خورد');

    const first = await resealSecrets({ sealPlaintext: true });
    assert.deepEqual([first.sealed_plaintext, first.failed.length], [2, 0]);
    const settingAfter = await readSettingRaw();
    const hookAfter = await readHookRaw(hookId);
    assert.equal(box.openSecret(settingAfter!, 'platform_settings:zarinpal_merchant_id'), MERCHANT);
    assert.equal(box.openSecret(hookAfter!, WEBHOOK_SECRET_CONTEXT), HOOK_SECRET);
    assert.equal((await getZarinpalConfig()).merchantId, MERCHANT);

    const second = await resealSecrets({ sealPlaintext: true });
    assert.deepEqual(
      [second.sealed_plaintext, second.rekeyed, second.unchanged, second.plaintext_skipped, second.raced, second.failed.length],
      [0, 0, 2, 0, 0, 0],
    );
    assert.equal(await readSettingRaw(), settingAfter, 'اجرای دوم بایت‌به‌بایت دست نمی‌زند');
    assert.equal(await readHookRaw(hookId), hookAfter);
  });

  test('🔴 دو بار چرخش: k1 → k2 → k3؛ بعد از آن k1 به‌تنها هیچ‌چیز را باز نمی‌کند', async () => {
    const K1 = keyB64(), K2 = keyB64(), K3 = keyB64();
    try {
      await db.webhook.deleteMany({ where: { id: { in: made.hookIds } } });
      useRing([['k1', K1]], 'k1');
      await settingsRoute.PATCH(adminReq('PATCH', { settings: [{ key: SETTING_KEY, value: MERCHANT }] }));
      const hookId = await makeHook(box.sealSecret(HOOK_SECRET, WEBHOOK_SECRET_CONTEXT));
      assert.equal(box.sealedKeyId((await readSettingRaw())!), 'k1');

      const steps: Array<[Array<[string, string]>, string]> = [[[['k1', K1], ['k2', K2]], 'k2'], [[['k2', K2], ['k3', K3]], 'k3']];
      for (const [ring, active] of steps) {
        useRing(ring, active);
        const rep = await resealSecrets({ sealPlaintext: false });
        assert.deepEqual([rep.active_key_id, rep.rekeyed, rep.failed.length], [active, 2, 0], `چرخش به ${active}`);
        assert.equal(box.sealedKeyId((await readSettingRaw())!), active);
        assert.equal(box.sealedKeyId((await readHookRaw(hookId))!), active);
      }

      useRing([['k3', K3]], 'k3');
      assert.equal((await getZarinpalConfig()).merchantId, MERCHANT, 'فقط با کلیدِ آخر خوانده می‌شود');
      assert.equal(box.openSecret((await readHookRaw(hookId))!, WEBHOOK_SECRET_CONTEXT), HOOK_SECRET);
      assert.equal((await resealSecrets({ sealPlaintext: false })).unchanged, 2, 'پس از چرخش، اجرای بعدی no-op');

      useRing([['k1', K1]], 'k1');
      await redis.del(`cache:platform-settings:${SETTING_KEY}`);
      await assert.rejects(() => getZarinpalConfig(), (e: unknown) => reasonOf(e) === 'unknown_key');
    } finally {
      restoreRing();
      await db.platformSettings.deleteMany({ where: { key: SETTING_KEY } });
      await redis.del(`cache:platform-settings:${SETTING_KEY}`);
    }
  });

  test('مسیرِ نگه‌داری: بی‌کلید ۴۰۱؛ با کلید فقط شمارش؛ متنِ رمزِ خراب ⇒ ۵۰۰ با شناسه، بی‌مقدار', async () => {
    await db.webhook.deleteMany({ where: { id: { in: made.hookIds } } });
    process.env.MAINTENANCE_KEY = `maint-s05-${SFX}-${randomBytes(8).toString('hex')}`;
    const call = (key?: string, qs = '') => resealRoute.POST(new Request(`http://x/api/v1/maintenance/secrets-reseal${qs}`, {
      method: 'POST', headers: { 'x-real-ip': testIp(), ...(key ? { 'x-maintenance-key': key } : {}) },
    }));
    assert.equal((await call()).status, 401);

    const hookId = await makeHook(HOOK_SECRET);
    const ok = await call(process.env.MAINTENANCE_KEY, '?seal_plaintext=1');
    const okText = await ok.text();
    assert.equal(ok.status, 200, okText);
    assert.equal(JSON.parse(okText).sealed_plaintext, 1);
    assert.equal(okText.includes(HOOK_SECRET), false);
    assert.equal(okText.includes('enc:v1:'), false);

    const good = (await readHookRaw(hookId))!;
    const parts = good.split(':');
    parts[5] = (parts[5][0] === 'A' ? 'B' : 'A') + parts[5].slice(1);
    await db.webhook.update({ where: { id: hookId }, data: { secret: parts.join(':') } });
    const bad = await call(process.env.MAINTENANCE_KEY);
    const badBody = await bad.json();
    assert.equal(bad.status, 500);
    assert.deepEqual(badBody.failed, [{ target: 'webhooks', id: hookId, reason: 'auth_failed' }]);
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('staff_invites.token — فقط هش', () => {
  async function provisionWithSmsToken() {
    const r = await provisionBusiness({ businessName: `[DEMO] s05 invite ${SFX}`, ownerPhone: fixturePhone('0979') } as never,
      { adminId: '00000000-0000-4000-8000-000000000005', ip: 's05' });
    made.tenantIds.push(r.tenantId);
    const job = await db.job.findUniqueOrThrow({ where: { idempotencyKey: `staff-invite:${r.inviteId}` }, select: { payload: true } });
    const m = String((job.payload as { tokens?: string[] }).tokens?.[2] ?? '').match(/#token=([0-9a-f]{64})$/);
    assert.ok(m, 'لینکِ دعوت در پیامکِ صف');
    return { inviteId: r.inviteId, token: m[1] };
  }
  const claimReq = (token: string) => claim(
    new Request(`https://example.invalid/api/v1/auth/invite/${token}/claim`, { method: 'POST', headers: { 'x-forwarded-for': testIp() } }),
    { params: Promise.resolve({ token }) },
  );

  test('🔴 DB فقط هش دارد؛ توکنِ پیامک معتبر است؛ خودِ هشِ ذخیره‌شده به‌عنوانِ توکن ۴۰۴ می‌گیرد', async () => {
    const { inviteId, token } = await provisionWithSmsToken();
    const row = await db.staffInvite.findUniqueOrThrow({ where: { id: inviteId }, select: { token: true } });
    assert.match(row.token, /^sha256:[0-9a-f]{64}$/);
    assert.equal(row.token.includes(token), false);
    assert.equal((await (await claimReq(token)).json()).state, 'valid');
    assert.equal((await claimReq(row.token)).status, 404, 'کسی که DB را خوانده با هش وارد نمی‌شود');
  });

  const PRISMA_CLI = 'node_modules/prisma/build/index.js';
  const applySql = (file: string) => {
    assert.ok(existsSync(PRISMA_CLI), 'CLIِ prisma لازم است — این تست باید واقعاً مهاجرت را اجرا کند');
    return execFileSync(process.execPath,
      [PRISMA_CLI, 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', `prisma/sql/${file}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };
  const apply094 = () => applySql('094-secrets-at-rest.sql');
  const apply096 = () => applySql('096-jobs-redact-invite-link.sql');
  const inviteJob = (inviteId: string) =>
    db.job.findUniqueOrThrow({ where: { idempotencyKey: `staff-invite:${inviteId}` }, select: { id: true, kind: true, status: true, attempts: true, maxAttempts: true, payload: true } });
  const linkOf = (payload: unknown) => String((payload as { tokens?: string[] }).tokens?.[2] ?? '');

  test('🔴 دعوتِ پیش از مهاجرتِ ۰۹۴ پس از آن کار می‌کند؛ اجرای دوم no-op؛ CHECK متنِ ساده را می‌بندد', async () => {

    const { inviteId } = await provisionWithSmsToken();
    const legacy = randomBytes(32).toString('hex');
    const hookId = await makeHook(null);
    const legacyJob = await db.job.create({
      data: { kind: 'webhook', payload: { webhookId: hookId, url: 'https://93.184.216.34/hook', secret: HOOK_SECRET, event: 'reservation.created', data: {}, restaurantId: made.restaurantId } },
      select: { id: true },
    });
    try {
      // وضعیتِ «پیش از ۰۹۴»: بدونِ CHECK، توکنِ خام در ستون (همان چیزی که کدِ قبلی می‌نوشت).
      await db.$executeRawUnsafe('ALTER TABLE staff_invites DROP CONSTRAINT IF EXISTS staff_invites_token_hashed');
      await db.staffInvite.update({ where: { id: inviteId }, data: { token: legacy } });
      assert.equal((await claimReq(legacy)).status, 404, 'بدونِ مهاجرت، کدِ تازه توکنِ خام را نمی‌یابد — مهاجرت لازم است');

      apply094();
      const once = (await db.staffInvite.findUniqueOrThrow({ where: { id: inviteId } })).token;
      assert.equal(once, box.hashBearerToken(legacy));
      assert.equal((await (await claimReq(legacy)).json()).state, 'valid', 'لینکِ قدیمی پس از مهاجرت معتبر است');
      const jobAfter = await db.job.findUniqueOrThrow({ where: { id: legacyJob.id } });
      assert.equal('secret' in (jobAfter.payload as object), false, 'secretِ خام از payloadِ قدیمی پاک شد');

      apply094();
      assert.equal((await db.staffInvite.findUniqueOrThrow({ where: { id: inviteId } })).token, once, 'اجرای دوم هشِ هش نمی‌سازد');
      assert.equal((await (await claimReq(legacy)).json()).state, 'valid');

      await assert.rejects(
        () => db.$executeRaw`UPDATE staff_invites SET token = ${legacy} WHERE id = ${inviteId}::uuid`,
        (e: unknown) => /staff_invites_token_hashed|23514/.test(String((e as Error).message) + String((e as { code?: string }).code)),
        'CHECKِ ۰۹۴ نوشتنِ متنِ ساده را از هر مسیری رد می‌کند',
      );
    } finally {
      const [c] = await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'staff_invites_token_hashed'`;
      if (c.n === 0) apply094();
      await db.job.delete({ where: { id: legacyJob.id } }).catch(() => {});
    }
  });

  // ─── مهاجرتِ ۰۹۶، حکمِ CEO (۲۰۲۶-۰۹-۱۷): لینکِ دعوت (توکنِ حامل) پس از پایانِ jobِ پیامک در جدولِ jobs نمی‌ماند ───
  // jobِ در انتظار/تلاشِ دوباره باید لینک را داشته باشد (هنوز باید فرستاده شود)؛ به محضِ حالتِ پایانی
  // (completed یا dead) — از هر مسیری: completeJob، failJob، بازپس‌گیریِ SQL یا UPDATEِ دستی — حذف می‌شود.
  test('🔴 لینکِ دعوت با تکمیلِ jobِ پیامک پاک می‌شود؛ jobِ تلاشِ دوباره هنوز آن را دارد', async () => {
    const { inviteId, token } = await provisionWithSmsToken();
    const job = await inviteJob(inviteId);
    assert.equal(job.kind, 'sms');
    assert.ok(linkOf(job.payload).endsWith(`#token=${token}`), 'پیش‌شرط: jobِ در انتظار لینک را دارد');

    await failJob({ id: job.id, kind: job.kind, payload: job.payload, attempts: 1, maxAttempts: job.maxAttempts }, 's05 retry');
    const retrying = await inviteJob(inviteId);
    assert.equal(retrying.status, 'pending');
    assert.ok(linkOf(retrying.payload).endsWith(`#token=${token}`), 'تلاشِ دوباره هنوز باید بتواند بفرستد');

    await completeJob(job.id, { status: 'sent' });
    const done = await inviteJob(inviteId);
    assert.equal(done.status, 'completed');
    assert.equal(JSON.stringify(done.payload).includes(token), false, 'توکن در payloadِ jobِ تکمیل‌شده نیست');
    assert.match(linkOf(done.payload), /invite\.html#token=\[redacted\]$/, 'پایه‌ی لینک برای رد می‌ماند، فقط توکن پاک می‌شود');
  });

  test('🔴 همین برای DLQ (failJobِ پایانی) و برای تغییرِ وضعیت از مسیرِ SQL (مثلِ بازپس‌گیری)', async () => {
    const a = await provisionWithSmsToken();
    const ja = await inviteJob(a.inviteId);
    assert.equal(await failJob({ id: ja.id, kind: ja.kind, payload: ja.payload, attempts: ja.maxAttempts, maxAttempts: ja.maxAttempts }, 's05 dead'), 'dead');
    const deadJob = await inviteJob(a.inviteId);
    assert.equal(deadJob.status, 'dead');
    assert.equal(JSON.stringify(deadJob.payload).includes(a.token), false, 'jobِ مرده توکن ندارد');

    const b = await provisionWithSmsToken();
    const jb = await inviteJob(b.inviteId);
    await db.$executeRaw`UPDATE jobs SET status = 'dead'::job_status WHERE id = ${jb.id}::uuid`;
    assert.equal(JSON.stringify((await inviteJob(b.inviteId)).payload).includes(b.token), false, 'هر مسیرِ نوشتن، نه فقط کدِ queue');
  });

  test('🔴 ۰۹۶ jobهای پایانیِ قدیمی را هم پاک می‌کند، تریگر را برمی‌گرداند، و اجرای دومش no-op است', async () => {
    const { inviteId, token } = await provisionWithSmsToken();
    const job = await inviteJob(inviteId);
    try {
      // وضعیتِ «پیش از ۰۹۶»: بدونِ تریگر، jobِ تکمیل‌شده‌ای که هنوز توکن دارد.
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS jobs_redact_invite_link ON jobs');
      await db.$executeRaw`UPDATE jobs SET status = 'completed'::job_status WHERE id = ${job.id}::uuid`;
      assert.ok(JSON.stringify((await inviteJob(inviteId)).payload).includes(token), 'پیش‌شرط: بی تریگر توکن می‌ماند');
      apply096();
      const once = (await inviteJob(inviteId)).payload;
      assert.equal(JSON.stringify(once).includes(token), false, '۰۹۶ ردیفِ قدیمی را پاک کرد');
      apply096();
      assert.deepEqual((await inviteJob(inviteId)).payload, once, 'اجرای دومِ ۰۹۶ ردیف را عوض نمی‌کند');
    } finally {
      const [t] = await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'jobs_redact_invite_link' AND NOT tgisinternal`;
      if (t.n === 0) apply096();
    }
    const [t2] = await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'jobs_redact_invite_link' AND NOT tgisinternal`;
    assert.equal(t2.n, 1, 'تریگر پس از ۰۹۶ برقرار است');
  });
});
