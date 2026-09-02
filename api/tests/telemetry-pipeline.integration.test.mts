import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  خطِ لوله‌ی تله‌متری — از بن‌بست به مسیرِ زنده (۲۰۲۶-۰۸-۲۶)
//
//  ── یافته‌ی اندازه‌گیری‌شده، نه ادعا ──
//  allowlistِ سرور (`ALLOWED_TYPE_PREFIXES`) سیزده پیشوند داشت و **هیچ‌کدام**
//  با نام‌هایی که کلاینت‌ها واقعاً می‌فرستند جور نبود. کلِ نام‌های ارسالیِ
//  کلاینت دقیقاً دو تاست — `app.opened` و `page.viewed` — و هر دو بیرونِ
//  allowlist بودند. یعنی **۱۰۰٪** تله‌متریِ کلاینت بی‌صدا دور ریخته می‌شد،
//  در حالی که پاسخ `202 {"ok":true,"accepted":0}` بود و کلاینت
//  (`analytics.js:52`) `r.ok` را موفقیت می‌فهمید و صف را هرس می‌کرد.
//
//  اثباتِ پیش از رفع (اجرای واقعی روی روتِ واقعی + Postgresِ واقعی):
//    STATUS = 202 · BODY = {"ok":true,"accepted":0}
//    ROWS IN DB for app.opened|page.viewed = 0
//
//  ── سه چیزی که این فایل قفل می‌کند ──
//   ۱. شکافِ allowlist بسته است (هر دو نامِ واقعی درج می‌شوند).
//   ۲. ردشدن دیگر بی‌صدا نیست: متریکِ قابلِ‌آلارم + لاگ + عددِ صریح در پاسخ.
//   ۳. شکستِ درج دیگر «موفقیت» گزارش نمی‌شود (۵۰۳، نه ۲۰۲).
//  و ۴. جدول دیگر بن‌بستِ خواندن نیست — یک مصرف‌کننده‌ی ادمینی دارد.
//
//  ⚠️ چرا کدِ وضعیتِ ردِ allowlist عمداً ۲۰۲ مانده: ردشدن **دائمی** است و
//  کلاینت صف را فقط داخلِ `if (r.ok)` هرس می‌کند؛ ۴xx یعنی همان دسته تا ابد
//  دوباره فرستاده شود. صداقت در **بدنه** خریده شد، نه در کدِ وضعیت. تستِ
//  «۲۰۲ می‌ماند» عمدی است: اگر کسی بعداً بی‌خبر ۴۰۰ کند، اینجا قرمز می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { renderMetrics, capTelemetryTypeLabel, telemetryTypeLabelCount } = await import('../src/lib/metrics.ts');
const { recordEventsDetailed, recordEvents } = await import('../src/lib/platform-events.ts');
const { POST } = await import('../src/app/api/v1/telemetry/route.ts');
const { GET: ADMIN_GET } = await import('../src/app/api/v1/admin/telemetry/route.ts');

const { testIp } = await import('./helpers/test-ip.mts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = `tp${Date.now().toString(36)}`;
const SID = `s_${SFX}`;                       // نشانگرِ پاک‌سازی برایِ ردیف‌هایِ این فایل
const PROBE_TYPE = `ui.telemetry_probe_${SFX.replace(/[^a-z0-9_]/g, '')}`;

const ORIG_TENANT = process.env.PLATFORM_ADMIN_TENANT_ID;
let platformTenantId: string;
let otherTenantId: string;
let adminToken: string;
let outsiderToken: string;

/** مقدارِ فعلیِ یک شمارنده. رجیستری بینِ تست‌ها ریست نمی‌شود ⇒ همیشه **دلتا**. */
function counterValue(name: string, labelSubstr?: string): number {
  let total = 0;
  for (const line of renderMetrics().split('\n')) {
    if (!line.startsWith(name)) continue;
    const m = line.match(new RegExp(`^${name}(?:\\{([^}]*)\\})?\\s+(-?[\\d.]+)$`));
    if (!m) continue;
    if (labelSubstr && !(m[1] ?? '').includes(labelSubstr)) continue;
    total += Number(m[2]);
  }
  return total;
}

type Ev = Record<string, unknown>;

async function ingest(events: Ev[]): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await POST(new Request('http://x/api/v1/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': testIp(), 'user-agent': 'test/1.0' },
    body: JSON.stringify({ events }),
  }) as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** شناسه‌ی یکتا با حداقلِ ۸ کاراکترِ لازمِ schema. */
const evId = (tag: string) => `${SFX}-${tag}`.padEnd(12, 'x');

before(async () => {
  const pt = await db.tenant.create({ data: { name: `[DEMO] telemetry-platform-${SFX}` }, select: { id: true } });
  const ot = await db.tenant.create({ data: { name: `[DEMO] telemetry-other-${SFX}` }, select: { id: true } });
  platformTenantId = pt.id;
  otherTenantId = ot.id;

  const admin = await db.staff.create({
    data: { tenantId: platformTenantId, role: 'owner', isActive: true, phone: fixturePhone('0927') },
    select: { id: true },
  });
  const outsider = await db.staff.create({
    data: { tenantId: otherTenantId, role: 'owner', isActive: true, phone: fixturePhone('0927') },
    select: { id: true },
  });
  adminToken = signAccess({ sub: admin.id, kind: 'staff', tenantId: platformTenantId, role: 'owner' });
  outsiderToken = signAccess({ sub: outsider.id, kind: 'staff', tenantId: otherTenantId, role: 'owner' });

  await db.platformEvent.deleteMany({ where: { OR: [{ sessionId: SID }, { type: PROBE_TYPE }] } }).catch(() => {});
});

after(async () => {
  await db.platformEvent.deleteMany({ where: { OR: [{ sessionId: SID }, { type: PROBE_TYPE }] } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId: { in: [platformTenantId, otherTenantId] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [platformTenantId, otherTenantId] } } }).catch(() => {});
});

// ─────────────────────────────────────────────────────────────────────
//  ۱) شکافِ allowlist — قلبِ یافته
// ─────────────────────────────────────────────────────────────────────
describe('شکافِ allowlist — نامِ رویدادهایی که کلاینت واقعاً می‌فرستد', () => {
  test('🔴 app.opened درج می‌شود (پیش از رفع: صفر ردیف)', async () => {
    // فرستنده‌های واقعی: apps/customer/js/analytics.js:88 ·
    // apps/business|company/js/analytics.js:82 · shared/js/analytics.panel.js:82
    const { status, body } = await ingest([
      { type: 'app.opened', source: 'customer', sessionId: SID, eventId: evId('open'), payload: {} },
    ]);
    assert.equal(status, 202);
    assert.equal(body.accepted, 1, `پذیرفته نشد: ${JSON.stringify(body)}`);
    assert.equal(body.rejected, 0);
    assert.equal(
      await db.platformEvent.count({ where: { type: 'app.opened', sessionId: SID } }), 1,
      'ردیف واقعاً در platform_events ننشست',
    );
  });

  test('🔴 page.viewed درج می‌شود (پیش از رفع: صفر ردیف)', async () => {
    // فرستنده‌های واقعی: apps/customer/js/data/discover.js:16 ·
    // apps/business/js/routing.js:64 · apps/company/js/data.js:31
    const { status, body } = await ingest([
      { type: 'page.viewed', source: 'business', sessionId: SID, eventId: evId('page'), payload: { page: 'home' } },
    ]);
    assert.equal(status, 202);
    assert.equal(body.accepted, 1, `پذیرفته نشد: ${JSON.stringify(body)}`);
    assert.equal(
      await db.platformEvent.count({ where: { type: 'page.viewed', sessionId: SID } }), 1,
      'ردیف واقعاً در platform_events ننشست',
    );
  });

  test('کنترلِ منفی: نامِ بی‌فرستنده همچنان رد می‌شود (allowlist باز نشد)', async () => {
    // اگر این سبز نماند یعنی allowlist عملاً حذف شده و هر رشته‌ای می‌نشیند.
    const { status, body } = await ingest([
      { type: 'evil.exfiltrate', source: 'customer', sessionId: SID, eventId: evId('evil'), payload: {} },
    ]);
    assert.equal(status, 202);
    assert.equal(body.accepted, 0);
    assert.equal(body.rejected, 1);
    assert.equal(await db.platformEvent.count({ where: { type: 'evil.exfiltrate' } }), 0);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۲) شکستنِ سکوت — متریک + بدنه‌ی صادق
// ─────────────────────────────────────────────────────────────────────
describe('ردشدنِ رویداد دیگر بی‌صدا نیست', () => {
  test('🔴 متریکِ telemetryEventRejected با برچسبِ reason=prefix بالا می‌رود', async () => {
    const before = counterValue('rezervno_telemetry_event_rejected_total', 'reason="prefix"');
    await ingest([
      { type: 'nowhere.thing', source: 'customer', sessionId: SID, eventId: evId('m1'), payload: {} },
      { type: 'alsonowhere.thing', source: 'customer', sessionId: SID, eventId: evId('m2'), payload: {} },
    ]);
    const after = counterValue('rezervno_telemetry_event_rejected_total', 'reason="prefix"');
    assert.equal(after - before, 2, 'متریکِ ردشدن حرکت نکرد — یعنی هنوز سکوتِ کامل است');
  });

  test('🔴 نامِ بدشکل با reason=shape شمرده می‌شود', async () => {
    const before = counterValue('rezervno_telemetry_event_rejected_total', 'reason="shape"');
    await ingest([{ type: 'NOT A VALID TYPE', source: 'customer', sessionId: SID, payload: {} }]);
    const after = counterValue('rezervno_telemetry_event_rejected_total', 'reason="shape"');
    assert.equal(after - before, 1);
  });

  test('🔴 برچسبِ متریک هرگز کاراکترِ خطرناک نمی‌گیرد (ضدِ تزریق در خروجیِ Prometheus)', async () => {
    // `labelKey` مقدار را بدونِ escape داخلِ k="v" می‌گذارد؛ `type` هم ورودیِ
    // خامِ کلاینت است. یک `"` یا newline می‌توانست خطِ متریکِ جعلی بسازد.
    await ingest([
      { type: 'x"} 1\nrezervno_fake_metric_total 99999\n#', source: 'customer', sessionId: SID, payload: {} },
    ]);
    const out = renderMetrics();
    assert.ok(!out.includes('rezervno_fake_metric_total'), 'متنِ متریک تزریق‌پذیر است');
    for (const line of out.split('\n')) {
      if (!line.startsWith('rezervno_telemetry_event_rejected_total{')) continue;
      const labels = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
      assert.match(labels, /^[a-z_]+="[a-z0-9_.]+"(,[a-z_]+="[a-z0-9_.]+")*$/,
        `برچسبِ ناامن در خروجی: ${line}`);
    }
  });

  test('🔴 بدنه‌ی پاسخ اعدادِ صادق می‌دهد (received/accepted/rejected)', async () => {
    const { status, body } = await ingest([
      { type: PROBE_TYPE, source: 'customer', sessionId: SID, eventId: evId('mix1'), payload: {} },
      { type: 'nope.one', source: 'customer', sessionId: SID, eventId: evId('mix2'), payload: {} },
      { type: 'nope.two', source: 'customer', sessionId: SID, eventId: evId('mix3'), payload: {} },
    ]);
    assert.equal(status, 202);
    assert.equal(body.received, 3);
    assert.equal(body.accepted, 1);
    assert.equal(body.rejected, 2);
    assert.equal(body.duplicates, 0);
    assert.deepEqual([...(body.rejected_types as string[])].sort(), ['nope.one', 'nope.two']);
  });

  test('🔴 دسته‌ای که کاملاً رد شد هم عددِ صریح می‌دهد (نه فقط accepted:0)', async () => {
    // پیش از رفع، این پاسخ دقیقاً `{"ok":true,"accepted":0}` بود — از پاسخِ یک
    // دسته‌ی کاملاً تکراری قابلِ تشخیص نبود.
    const { status, body } = await ingest([
      { type: 'ghost.a', source: 'customer', sessionId: SID, payload: {} },
      { type: 'ghost.b', source: 'customer', sessionId: SID, payload: {} },
    ]);
    assert.equal(status, 202, 'کدِ وضعیتِ ردِ دائمی عمداً ۲۰۲ است — رجوع کن به بالای فایل');
    assert.equal(body.received, 2);
    assert.equal(body.rejected, 2);
    assert.equal(body.accepted, 0);
  });

  test('تکراری از ردشده تفکیک می‌شود (duplicates ≠ rejected)', async () => {
    const ev = { type: PROBE_TYPE, source: 'customer', sessionId: SID, eventId: evId('dup'), payload: {} };
    const first = await ingest([ev]);
    assert.equal(first.body.accepted, 1);
    const second = await ingest([ev]);
    assert.equal(second.body.accepted, 0);
    assert.equal(second.body.duplicates, 1, 'تکراری باید duplicates باشد، نه rejected');
    assert.equal(second.body.rejected, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۳) شکستِ درج ≠ موفقیت (§۳)
// ─────────────────────────────────────────────────────────────────────
describe('شکستِ درج صادقانه گزارش می‌شود', () => {
  test('🔴 recordEventsDetailed «شکست» را از «تکراری» تفکیک می‌کند', async () => {
    const ev = { type: PROBE_TYPE, source: 'backend' as const, eventId: evId('det'), sessionId: SID, payload: {} };
    const ok = await recordEventsDetailed([ev]);
    assert.deepEqual(ok, { inserted: 1, failed: false });

    const dupe = await recordEventsDetailed([ev]);
    assert.deepEqual(dupe, { inserted: 0, failed: false }, 'تکراری نباید failed شود');

    // uuidِ نامعتبر → Prisma پرتاب می‌کند ⇒ رویداد **گم** شده، نه تکراری.
    const bad = await recordEventsDetailed([
      { type: PROBE_TYPE, source: 'backend', tenantId: 'not-a-uuid', payload: {} },
    ]);
    assert.deepEqual(bad, { inserted: 0, failed: true });

    // امضایِ قدیمی دست‌نخورده مانده (تست‌های موجود رویش قفل‌اند).
    assert.equal(await recordEvents([ev]), 0);
  });

  test('🔴 وقتی درج throw کند، route پاسخِ ۵۰۳ می‌دهد نه ۲۰۲', async () => {
    // پیش از رفع: ۲۰۲ با accepted:0 ⇒ کلاینت صف را هرس می‌کرد و رویداد برای
    // همیشه گم می‌شد. حالا صف می‌ماند و دفعه‌ی بعد دوباره تلاش می‌شود.
    const delegate = db.platformEvent as unknown as Record<string, unknown>;
    const orig = delegate.createMany;
    delegate.createMany = async () => { throw new Error('DB down (تستِ عمدی)'); };
    try {
      const { status, body } = await ingest([
        { type: PROBE_TYPE, source: 'customer', sessionId: SID, eventId: evId('503'), payload: {} },
      ]);
      assert.equal(status, 503, 'شکستِ زیرساخت نباید موفقیت گزارش شود');
      assert.notEqual(body.ok, true);
    } finally {
      delegate.createMany = orig;
    }

    // اثباتِ اینکه stub برداشته شد و مسیر واقعاً سالم است (کنترلِ مثبت).
    const back = await ingest([
      { type: PROBE_TYPE, source: 'customer', sessionId: SID, eventId: evId('503b'), payload: {} },
    ]);
    assert.equal(back.status, 202);
    assert.equal(back.body.accepted, 1);
  });

  test('🔴 بایتِ NUL دیگر دسته را مسموم نمی‌کند (قرصِ سمیِ ۵۰۳)', async () => {
    // Postgres با 22021 کلِ createMany را می‌شکست. با ۵۰۳ِ تازه، همان یک بایت
    // یعنی صفِ کلاینت تا ابد گیر می‌کرد.
    const NUL = String.fromCharCode(0);
    const { status, body } = await ingest([
      {
        type: PROBE_TYPE, source: 'customer',
        sessionId: `${SID}${NUL}x`,
        correlationId: `c${NUL}1`,
        eventId: evId('nul'),
        payload: { [`k${NUL}1`]: `v${NUL}2`, nested: { deep: `a${NUL}b` } },
      },
    ]);
    assert.equal(status, 202, `درج شکست خورد: ${JSON.stringify(body)}`);
    assert.equal(body.accepted, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۴) بن‌بستِ خواندن — حالا یک مصرف‌کننده هست
// ─────────────────────────────────────────────────────────────────────
describe('GET /admin/telemetry — تنها مصرف‌کننده‌ی platform_events', () => {
  // ⚠️ این بازیابی تا ۲۰۲۶-۰۸-۲۶ در `after`ِ **ریشه‌ای** بود و کامنتش می‌گفت
  // «فایل‌های بعدیِ رانر به آن وابسته‌اند» — قصد درست بود ولی جایش قصد را
  // خنثی می‌کرد: هوکِ ریشه فقط در پایانِ **کلِ ران** اجرا می‌شود، پس env از
  // اولین تستِ همین describe تا انتهای ران آلوده می‌ماند. تنها همین describe
  // آن را می‌نویسد، پس بازیابی به اینجا آمد.
  afterEach(() => {
    if (ORIG_TENANT === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
    else process.env.PLATFORM_ADMIN_TENANT_ID = ORIG_TENANT;
  });

  const adminReq = (headers: Record<string, string>, qs = '') =>
    ADMIN_GET(new Request(`http://x/api/v1/admin/telemetry${qs}`, {
      headers: { 'x-real-ip': testIp(), ...headers },
    }) as never);

  test('🔴 بدونِ توکن → ۴۰۱ (تستِ authorizationِ منفی)', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const res = await adminReq({});
    assert.equal(res.status, 401);
  });

  test('🔴 ownerِ تنانتِ دیگر → ۴۰۳ (نشتِ tenant بسته است)', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const res = await adminReq({ authorization: `Bearer ${outsiderToken}` });
    assert.equal(res.status, 403);
  });

  test('🔴 PLATFORM_ADMIN_TENANT_ID ست نشده → fail-closed', async () => {
    delete process.env.PLATFORM_ADMIN_TENANT_ID;
    const res = await adminReq({ authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 403);
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
  });

  test('🔴 ادمین شمارشِ واقعی بر حسب نام می‌گیرد', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const mine = await db.platformEvent.count({ where: { type: PROBE_TYPE } });
    assert.ok(mine > 0, 'پیش‌شرطِ تست: باید رویدادی از تست‌های بالا مانده باشد');

    const res = await adminReq({ authorization: `Bearer ${adminToken}` }, '?days=1');
    assert.equal(res.status, 200);
    const body = await res.json() as {
      window_days: number; total: number; last_event_at: string | null;
      by_type: Array<{ type: string; count: number }>;
      by_source: Record<string, number>; by_trust_level: Record<string, number>;
    };
    assert.equal(body.window_days, 1);
    const row = body.by_type.find((r) => r.type === PROBE_TYPE);
    assert.ok(row, `نوعِ آزمایشی در by_type نبود: ${JSON.stringify(body.by_type.slice(0, 5))}`);
    assert.equal(row.count, mine, 'شمارشِ endpoint با شمارشِ مستقیمِ DB نمی‌خواند');
    assert.equal(typeof row.count, 'number', 'BigInt نباید به بیرون درز کند');
    assert.ok(body.total >= mine);
    assert.ok(body.last_event_at, 'last_event_at نباید null باشد وقتی داده هست');
    assert.ok(Object.keys(body.by_trust_level).length > 0);
  });

  test('پارامترِ days اعتبارسنجی می‌شود', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const res = await adminReq({ authorization: `Bearer ${adminToken}` }, '?days=99999');
    assert.equal(res.status, 422);
  });

  test('هیچ دادهٔ شخصی برنمی‌گردد (§۸ — کمینه‌ی دسترسی)', async () => {
    process.env.PLATFORM_ADMIN_TENANT_ID = platformTenantId;
    const res = await adminReq({ authorization: `Bearer ${adminToken}` });
    const raw = await res.text();
    for (const leak of ['payload', 'session_id', 'sessionId', 'user_id', 'userId', SID]) {
      assert.ok(!raw.includes(leak), `نشتِ فیلدِ حساس در پاسخِ تجمیعی: ${leak}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۵) سقفِ کاردینالیتیِ برچسب — عمداً آخرین بلوک
//     (بعد از این، هر نامِ تازه در سطلِ __other__ جمع می‌شود.)
// ─────────────────────────────────────────────────────────────────────
describe('برچسبِ متریک نشتِ حافظه نمی‌دهد', () => {
  test('🔴 سقفِ سختِ تعدادِ برچسب وجود دارد', async () => {
    // `type` ورودیِ کلاینت است: بدونِ سقف، ۱۲۰ درخواست در دقیقه می‌توانست
    // هزاران label-setِ ماندگار بسازد (همان باگِ H12 برایِ برچسبِ route).
    let collapsed = 0;
    for (let i = 0; i < 400; i++) {
      if (capTelemetryTypeLabel(`probe.cardinality_${i}`) === '__other__') collapsed++;
    }
    assert.ok(collapsed > 0, 'هیچ نامی در سطلِ __other__ جمع نشد — سقفی وجود ندارد');
    assert.ok(telemetryTypeLabelCount() <= 200, `از سقف گذشت: ${telemetryTypeLabelCount()}`);
  });

  test('نامِ بدشکل هرگز وارد مجموعه‌ی برچسب‌ها نمی‌شود', () => {
    assert.equal(capTelemetryTypeLabel('has space'), '__malformed__');
    assert.equal(capTelemetryTypeLabel('UPPER.case'), '__malformed__');
    assert.equal(capTelemetryTypeLabel('quote".injection'), '__malformed__');
    assert.equal(capTelemetryTypeLabel('nodot'), '__malformed__');
  });
});
