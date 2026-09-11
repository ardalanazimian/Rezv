import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  `POST /api/v1/checkin` — قراردادِ «اعتبارنامه‌ی QR» (بدونِ احراز هویتِ کاربر)
//
//  ── باگی که این فایل از آن زاده شد (اجرای زنده روی همین درخت) ──
//  سخت‌سازیِ ۲۰۲۶-۰۸-۲۴ کلِ route را زیرِ گاردِ کارمند برد. با یک کدِ واقعیِ
//  میز (خروجیِ `assignQrCode`، نه دادهٔ seed):
//      بدونِ توکن  → 401 UNAUTHORIZED
//      توکنِ مشتری → 403 FORBIDDEN_TENANT
//  یعنی مسیر برای **هر** مصرف‌کننده‌ی واقعی مرده بود:
//    • تنها فراخوانش در کلِ سه اپ `apps/customer/js/features/checkin.js:79`
//      است — یعنی اپِ مشتری، که هیچ‌وقت توکنِ کارمند ندارد.
//    • پنلِ رستوران این endpoint را صدا نمی‌زند (ثبتِ ورودش از
//      `PATCH /restaurant/reservations/{code}/status` می‌رود) و **اسکنرِ QR
//      هم ندارد** — فقط QR را تولید و چاپ می‌کند.
//
//  ── مدلِ امنیتی که اینجا قفل می‌شود ──
//  خودِ کدِ QR اعتبارنامه است: `genQrToken()` = `randomBytes(10)` نگاشته به
//  الفبایِ ۳۲تاییِ خوانا. `256 % 32 === 0` پس modulo bias صفر است ⇒ دقیقاً
//  ۵۰ بیت (اندازه‌گیریِ تجربی رویِ ۲M نویسه: ۴٫۹۹۹۹۸۵ بیت به‌ازای نویسه).
//  سه لایه‌ی جبرانی که هر سه اینجا تست می‌شوند:
//    ۱. ریت‌لیمیتِ اختصاصیِ per-IP (`RULES.qrCheckin`, ۳۰/دقیقه).
//    ۲. `reservation_code` فقط به صاحبِ همان رزرو (ضدِ نشت).
//    ۳. کدِ ناموجود و کدِ میزِ رستورانِ دیگر پاسخِ **بایت‌به‌بایت یکسان**.
//
//  ⚠️ به‌روزشده ۲۰۲۶-۰۹-۱۱ — عاملِ دومِ هویت (describeِ ۶): آن سه لایه
//  «جبرانی» بودند، نه کافی. استیکرِ QR **رویِ میز چسبیده** است، پس ۵۰ بیتِ
//  آنتروپی فقط حدس‌زدن را می‌بندد و هر رهگذری می‌توانست رزروِ فردِ دیگری را
//  بنشاند. حالا برای نشاندنِ یک رزروِ فعال یکی از این دو لازم است: توکنِ
//  مشتریِ صاحبِ رزرو، یا `reservation_code` در بدنه. اسکنِ میزِ **بی‌رزرو**
//  عمداً دست‌نخورده مانده (walk-in).
//
//  مکمل‌ها (تکرارشان نکن):
//    • `table-qr-checkin.integration.test.mts` → کلِ زنجیره: ساخت میز → کد →
//      SVG → اسکن → نشستن.
//    • `checkin-auth.integration.test.mts`     → گاردِ تنانتِ لایه‌ی سرویس.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { signAccess } = await import('../src/lib/jwt');
const { assignQrCode, qrCheckIn } = await import('../src/lib/tables');
const { errorResponse } = await import('../src/lib/errors');
const { RULES } = await import('../src/lib/ratelimit');
const checkinRoute = await import('../src/app/api/v1/checkin/route');
const { fixturePhone } = await import('./_phone.helper.mts');

type Ctx = { tenantId: string; restaurantId: string };

const TAG = `qrci-${Date.now().toString(36)}`;
let A: Ctx, B: Ctx;
let seq = 0;

/** ownerِ رزرو (کاربرِ واقعی) و یک کاربرِ بی‌ربط، برای تستِ نشتِ کد. */
let ownerId: string, ownerToken: string;
let strangerId: string, strangerToken: string;

/**
 * IPِ اختصاصیِ **تستِ ریت‌لیمیت** — تنها جایی که چند درخواست باید عمداً یک
 * سطل را پر کنند. بقیه‌ی تست‌های این فایل هرکدام IPِ یکتای خودشان را
 * می‌گیرند، پس این سطل را نمی‌سوزانند و هیچ فایلِ دیگری هم به آن نمی‌خورد.
 */
const RL_IP = testIp();

/**
 * فقط سطلِ `RULES.qrCheckin`ِ همان `RL_IP` را صفر می‌کند.
 *
 * ⚠️ قبلاً اینجا `clearRateLimit()` بود که `rl:chkin:*`, `rl:auth:*` و
 * `rl:srch:*` را با `redis.keys()` **سراسری** پاک می‌کرد. لازم شده بود چون
 * `new Request()`ِ بدونِ هدر همیشه IPِ `unknown` می‌دهد و سطل بینِ همه‌ی
 * فایل‌های رانر مشترک بود؛ ولی همان پاک‌سازی سطلِ فایل‌های دیگر را هم خالی
 * می‌کرد و ریت‌لیمیتشان را از سنجش خارج. حالا کلیدِ دقیق پاک می‌شود، نه الگو.
 */
async function clearOwnCheckinBucket() {
  await redis.del(`rl:${RULES.qrCheckin.prefix}:${RL_IP}`);
}

/**
 * فراخوانِ واقعیِ route. `token` اختیاری است — نبودنش یعنی مهمانِ ناشناس.
 * `ip` پیش‌فرض یکتاست تا هر تست سطلِ ریت‌لیمیتِ خودش را داشته باشد؛ فقط تستِ
 * خودِ ریت‌لیمیت عمداً یک IPِ ثابت می‌دهد.
 *
 * ⚠️ `resvCode` (۲۰۲۶-۰۹-۱۱): عاملِ دومِ هویت. از وقتی کدِ QR به‌تنهایی کافی
 * نیست، هر اسکنی که واقعاً باید بنشاند یا باید توکنِ صاحبِ رزرو بدهد یا این
 * را. اسکنِ بدونِ هیچ‌کدام عمداً در چند تستِ زیر نگه داشته شده تا ۴۰۳ را پین کند.
 */
function scan(qrCode: string, token?: string, ip: string = testIp(), resvCode?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': ip };
  if (token) headers.authorization = `Bearer ${token}`;
  return checkinRoute.POST(new Request('http://x/api/v1/checkin', {
    method: 'POST',
    headers,
    body: JSON.stringify(resvCode ? { qr_code: qrCode, reservation_code: resvCode } : { qr_code: qrCode }),
  }));
}

async function makeTenant(label: string): Promise<Ctx> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'QCI' },
    select: { id: true },
  });
  return { tenantId: t.id, restaurantId: r.id };
}

/** میز + کدِ QRِ واقعی (از `genQrToken`، نه دادهٔ `[DEMO]`ِ seed). */
async function makeTable(ctx: Ctx) {
  const t = await db.table.create({
    data: { restaurantId: ctx.restaurantId, number: ++seq + 700, capacity: 4 },
    select: { id: true, number: true },
  });
  const qr = await assignQrCode(t.id, ctx.restaurantId);
  return { ...t, qr };
}

/** رزروی که همین حالا در پنجره‌ی فعال است. */
async function makeLiveReservation(ctx: Ctx, tableId: string, userId: string | null = null, status = 'confirmed') {
  const now = new Date();
  return db.reservation.create({
    data: {
      code: `QCI${++seq}${Date.now().toString(36).slice(-5)}`.toUpperCase(),
      restaurantId: ctx.restaurantId, tableId, userId, partySize: 2,
      slotStart: new Date(+now - 10 * 60_000), slotEnd: new Date(+now + 80 * 60_000),
      status: status as never, blockBufferMinutes: 15,
    },
    select: { id: true, code: true },
  });
}

before(async () => {
  A = await makeTenant(`${TAG}-a`);
  B = await makeTenant(`${TAG}-b`);

  const owner = await db.user.create({
    // ⚠️ پیشوندِ ۰۹۲۰ مالِ همین فایل است — عوضش نکن و در فایلِ دیگری تکرارش
    // نکن. برخوردِ شماره در یک رانرِ تک‌پروسه‌ای کلِ سوئیت را cancel می‌کند
    // (شرح کامل در tests/_phone.helper.mts).
    data: { phone: fixturePhone('0920'), firstName: '[DEMO]', lastName: 'صاحبِ رزرو' },
    select: { id: true },
  });
  ownerId = owner.id;
  ownerToken = signAccess({ sub: ownerId, kind: 'customer' });

  const stranger = await db.user.create({
    data: { phone: fixturePhone('0920'), firstName: '[DEMO]', lastName: 'کاربرِ بی‌ربط' },
    select: { id: true },
  });
  strangerId = stranger.id;
  strangerToken = signAccess({ sub: strangerId, kind: 'customer' });
});

after(async () => {
  const rests = [A.restaurantId, B.restaurantId];
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: { in: rests } } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId: { in: rests } } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId: { in: rests } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: rests } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } }).catch(() => {});
});

// ─────────────────────────────────────────────────────────────────────
describe('۱) مهمانِ بدونِ هیچ توکنی — قابلیت واقعاً زنده است', () => {
  test('🔴 اسکنِ ناشناسِ دارایِ کدِ رزرو ۲۰۰ می‌دهد و رزرو در DB واقعاً seated می‌شود', async () => {
    // 🔴 قفلِ اصلیِ این فایل. پیش از رفع، همین درخواست ۴۰۱ می‌گرفت و هیچ
    //    وضعیتی جهش نمی‌کرد — قابلیت شیپ‌شده ولی غیرقابلِ‌دسترس.
    //
    // ⚠️ به‌روزشده ۲۰۲۶-۰۹-۱۱: «بدونِ توکن» هنوز کار می‌کند (همان چیزی که
    // این فایل از آن زاده شد)، ولی دیگر «بدونِ هیچ اعتبارنامه‌ی هویتی» نه —
    // کدِ رزرو عاملِ دوم است. ادعا عمداً هر دو نیمه را دارد تا نه رگرسیونِ
    // «دوباره ۴۰۱/۴۰۳ برای مهمانِ واقعی» از دستش برود و نه حذفِ عاملِ دوم.
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id);

    // کنترلِ مثبت: وضعیتِ قبل واقعاً `confirmed` است، نه از قبل seated.
    const pre = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(pre?.status, 'confirmed', 'کنترلِ مثبت: باید از confirmed شروع کند');

    const res = await scan(t.qr, undefined, undefined, resv.code);
    assert.equal(res.status, 200, 'مهمانِ ناشناسِ دارایِ کدِ رزرو باید بتواند ثبتِ ورود کند');

    const out = await res.json() as { table_number: number; status: string; checked_in: boolean };
    assert.equal(out.checked_in, true);
    assert.equal(out.status, 'seated');
    assert.equal(out.table_number, t.number);

    // ⚠️ کنترلِ روی خودِ DB، نه فقط بدنه‌ی پاسخ: بدونِ این، یک هندلرِ
    //    همیشه-۲۰۰ هم تست را پاس می‌کرد.
    const post = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(post?.status, 'seated', 'رزرو باید واقعاً در دیتابیس seated شده باشد');

    const tbl = await db.table.findUnique({ where: { id: t.id }, select: { state: true } });
    assert.equal(tbl?.state, 'occupied', 'میز باید occupied شده باشد');
  });

  test('چرخه‌ی حیات دور زده نمی‌شود — رویدادهای checked_in و seated ثبت شده‌اند', async () => {
    // اگر کسی روزی برای «ساده‌کردن» مستقیم `db.reservation.update` بنویسد،
    // پاسخ همچنان seated می‌شود ولی این تست قرمز می‌شود (پروتکل §۴).
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id);
    await scan(t.qr, undefined, undefined, resv.code);

    const events = await db.reservationEvent.findMany({
      where: { reservationId: resv.id },
      select: { toStatus: true },
    });
    const to = events.map(e => e.toStatus);
    assert.ok(to.includes('checked_in' as never), `باید انتقالِ checked_in ثبت شده باشد — دیده شد: ${to.join(',')}`);
    assert.ok(to.includes('seated' as never), `باید انتقالِ seated ثبت شده باشد — دیده شد: ${to.join(',')}`);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('۲) نشتِ `reservation_code` بسته است', () => {
  test('🔴 بدونِ توکنِ مشتری → null، با توکنِ صاحبِ همان رزرو → کدِ واقعی', async () => {
    // 🔴 هر دو نیمه در یک تست، چون جدا از هم هرکدام با یک پیاده‌سازیِ
    //    تقلبی پاس می‌شوند (همیشه-null یا همیشه-کد).

    const t1 = await makeTable(A);
    const r1 = await makeLiveReservation(A, t1.id, ownerId);
    // ⚠️ کد اینجا فقط **عاملِ دومِ هویت** است، نه مجوزِ دیدن: حتی وقتی
    // فراخوان خودش کد را فرستاده، پاسخ آن را پس نمی‌دهد مگر با توکنِ مالک.
    const anon = await (await scan(t1.qr, undefined, undefined, r1.code)).json() as
      { reservation_code: string | null; checked_in: boolean };
    assert.equal(anon.checked_in, true, 'ثبتِ ورود باید انجام شده باشد');
    assert.equal(anon.reservation_code, null, 'فراخوانِ ناشناس نباید کدِ رزرو ببیند');

    const t2 = await makeTable(A);
    const r2 = await makeLiveReservation(A, t2.id, ownerId);
    const owned = await (await scan(t2.qr, ownerToken)).json() as { reservation_code: string | null };
    assert.equal(owned.reservation_code, r2.code, 'صاحبِ رزرو باید کدِ خودش را ببیند');

    // کنترلِ مثبت که کدها واقعاً متفاوت‌اند (وگرنه مقایسه بی‌معنا بود).
    assert.notEqual(r1.code, r2.code);
  });

  test('کاربرِ لاگین‌کرده‌ی بی‌ربط کدِ رزروِ دیگری را نمی‌بیند', async () => {
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, ownerId);
    // ⚠️ به‌روزشده ۲۰۲۶-۰۹-۱۱: توکنِ بی‌ربط دیگر به‌تنهایی اجازه‌ی ثبتِ ورود
    // هم نمی‌دهد (تستِ ۶ آن را پین می‌کند). ادعای **این** تست جداست و باید
    // جدا بماند: حتی وقتی فراخوان از عاملِ دوم رد شده، پاسخ کد را پس نمی‌دهد
    // مگر با توکنِ خودِ مالک.
    const out = await (await scan(t.qr, strangerToken, undefined, resv.code)).json() as
      { reservation_code: string | null; checked_in: boolean };
    assert.equal(out.checked_in, true);
    assert.equal(out.reservation_code, null, 'توکنِ کاربرِ دیگر نباید کد بدهد');
  });

  test('رزروِ مهمانِ بدونِ حساب (userId=null) به هیچ‌کس کد نمی‌دهد', async () => {
    // گاردِ ضدِ `null === undefined`: اگر شرط فقط برابریِ ساده بود، یک
    // فراخوانِ ناشناس (userId=undefined) روی رزروِ مهمان (userId=null)
    // می‌توانست کد بگیرد.
    const t = await makeTable(A);
    const g1 = await makeLiveReservation(A, t.id, null);
    const anon = await (await scan(t.qr, undefined, undefined, g1.code)).json() as { reservation_code: string | null };
    assert.equal(anon.reservation_code, null);

    const t2 = await makeTable(A);
    const g2 = await makeLiveReservation(A, t2.id, null);
    const withToken = await (await scan(t2.qr, ownerToken, undefined, g2.code)).json() as { reservation_code: string | null };
    assert.equal(withToken.reservation_code, null, 'رزروِ مهمان مالکِ احرازپذیر ندارد');
  });

  test('توکنِ خراب درخواست را نمی‌شکند، فقط کد را نمی‌دهد', async () => {
    // مسیر عمداً برای فراخوانِ بدونِ توکن باز است؛ توکنِ نامعتبر نباید
    // ۴۰۱ بدهد، چون اصلاً شرطِ ورود نیست.
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, ownerId);
    const res = await scan(t.qr, 'this.is.not.a.jwt', undefined, resv.code);
    assert.equal(res.status, 200);
    const out = await res.json() as { reservation_code: string | null; checked_in: boolean };
    assert.equal(out.checked_in, true);
    assert.equal(out.reservation_code, null);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('۳) کدِ ناموجود و کدِ رستورانِ دیگر تفکیک‌ناپذیرند', () => {
  test('🔴 دو کدِ ناشناخته‌ی متفاوت → پاسخِ بایت‌به‌بایت یکسان', async () => {
    const a = await scan('T-ZZZZZZZZZZ');
    const b = await scan('T-QQQQQQQQQQ');
    assert.equal(a.status, b.status);
    assert.equal(a.status, 404);
    assert.equal(await a.text(), await b.text(), 'بدنه‌ها باید دقیقاً یکی باشند');
  });

  test('🔴 لایه‌ی سرویس: میزِ رستورانِ دیگر همان بایت‌های «ناموجود» را می‌دهد', async () => {
    // اینجا جایی است که خاصیت واقعاً زندگی می‌کند: `qrCheckIn` هنوز
    // tenant-scoped است. اگر کسی پیامِ متفاوتی برای «مالِ رستورانِ دیگر»
    // بگذارد، یک اوراکلِ وجود/عدمِ وجودِ کد ساخته می‌شود.
    const tA = await makeTable(A);

    const cross = await qrCheckIn(tA.qr, B.restaurantId).then(
      () => { throw new Error('نباید موفق شود — میزِ A متعلق به B نیست'); },
      (e: unknown) => errorResponse(e),
    );
    const missing = await qrCheckIn('qr-that-does-not-exist', A.restaurantId).then(
      () => { throw new Error('نباید موفق شود'); },
      (e: unknown) => errorResponse(e),
    );

    assert.equal(cross.status, missing.status, 'کدِ وضعیت باید یکی باشد');
    assert.equal(await cross.text(), await missing.text(), 'بدنه باید بایت‌به‌بایت یکی باشد');
    assert.equal(cross.status, 404);
  });

  test('کدِ میزِ رستورانِ B با اعتبارنامه‌ی خودش کار می‌کند (طراحی، نه باگ)', async () => {
    // مکملِ صادقانه‌ی تستِ بالا: چون رستوران از خودِ کد مشتق می‌شود، «کدِ
    // رستورانِ دیگر» در سطحِ HTTP اصلاً وجود ندارد — هر کدِ معتبر مالِ
    // رستورانِ خودش است. این عمدی است و ثبتش می‌کنیم تا با «شکافِ تنانت»
    // اشتباه گرفته نشود؛ فراخوان هیچ‌جا شعبه‌ای انتخاب نمی‌کند.
    const tB = await makeTable(B);
    const resv = await makeLiveReservation(B, tB.id);
    const res = await scan(tB.qr, undefined, undefined, resv.code);
    assert.equal(res.status, 200);
    const row = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(row?.status, 'seated');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('۴) میزِ بدونِ رزروِ فعال و idempotency', () => {
  test('میزِ بدونِ رزرو → ۲۰۰ بدونِ هیچ جهشِ وضعیتی', async () => {
    const t = await makeTable(A);
    const before = await db.table.findUnique({ where: { id: t.id }, select: { state: true } });

    const res = await scan(t.qr);
    assert.equal(res.status, 200);
    const out = await res.json() as { checked_in: boolean; reservation_code: string | null; status: string };
    assert.equal(out.checked_in, false, 'نباید ادعای ثبتِ ورود کند (جعلِ موفقیت)');
    assert.equal(out.reservation_code, null);
    assert.equal(out.status, before?.state, 'وضعیتِ میز باید همان قبلی گزارش شود');

    const after = await db.table.findUnique({ where: { id: t.id }, select: { state: true } });
    assert.equal(after?.state, before?.state, 'میز نباید occupied شده باشد');
  });

  test('🔴 اسکنِ دوباره وضعیتِ رزرو را خراب نمی‌کند (idempotent در دیتابیس)', async () => {
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, ownerId);

    const first = await (await scan(t.qr, ownerToken)).json() as { status: string; checked_in: boolean };
    assert.equal(first.status, 'seated');
    assert.equal(first.checked_in, true);

    const second = await scan(t.qr, ownerToken);
    assert.equal(second.status, 200, 'اسکنِ دوم نباید خطا بدهد');

    // ── ادعاهای واقعیِ یکپارچگی (اینها چیزی‌اند که باید قفل شوند) ──
    const row = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(row?.status, 'seated', 'دیتابیس نباید به وضعیتِ دیگری رفته باشد');

    const tbl = await db.table.findUnique({ where: { id: t.id }, select: { state: true } });
    assert.equal(tbl?.state, 'occupied', 'میز باید occupied بماند');

    // انتقالِ تکراری ثبت نشده باشد — یعنی هیچ audit/اعلان/رویدادِ اقتصادیِ
    // دوباره‌ای هم شلیک نشده. کنترلِ مثبت: عددِ انتظار ۱ است نه ۰، پس یک
    // پیاده‌سازیِ «هیچ‌وقت هیچ رویدادی ننویس» هم این تست را پاس نمی‌کند.
    const seatedEvents = await db.reservationEvent.count({
      where: { reservationId: resv.id, toStatus: 'seated' as never },
    });
    assert.equal(seatedEvents, 1, 'انتقالِ seated نباید دوبار ثبت شود');
  });

  test('🔴 اسکنِ دومِ همان مهمان دیگر «رزروی نیست» نمی‌گوید (جعلِ شکست بسته شد)', async () => {
    // ⚠️ این تست قبلاً رفتارِ **باگ‌دار** را پین می‌کرد، عمداً، تا رفعش
    // آگاهانه باشد. حالا رفع شده و ادعا برعکس شد.
    //
    // باگ: فیلترِ جست‌وجویِ رزروِ فعال در `qrCheckIn` فقط
    // ['confirmed','auto_confirmed','checked_in','running_late','arrived']
    // را می‌دید. بعد از اسکنِ اول رزرو `seated` می‌شد، از فیلتر می‌افتاد، و
    // شاخه‌ی «میز بدونِ رزرو» برمی‌گشت — یعنی به مهمانی که همان لحظه نشسته
    // بود گفته می‌شد «رزروی رویِ این میز پیدا نشد». **جعلِ شکست.**
    //
    // رفع: `seated` و `dining` به فیلتر اضافه شدند. انتقالِ چرخه‌ی حیات
    // بی‌اثر می‌ماند (تلاشِ seated→seated نامعتبر است و همان catch می‌گیردش)
    // ولی پاسخ صادق است.
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, ownerId);

    const first = await (await scan(t.qr, ownerToken)).json() as
      { status: string; checked_in: boolean; reservation_code: string | null };
    assert.equal(first.checked_in, true, 'اسکنِ اول باید بنشاند');
    assert.equal(first.status, 'seated');

    const out = await (await scan(t.qr, ownerToken)).json() as
      { status: string; checked_in: boolean; reservation_code: string | null };

    assert.equal(out.checked_in, true, 'اسکنِ دوم باید همان رزرو را ببیند، نه «رزروی نیست»');
    assert.equal(out.status, 'seated', 'وضعیتِ رزرو باید برگردد، نه وضعیتِ میز (occupied)');
    assert.equal(out.reservation_code, resv.code, 'صاحبِ رزرو باید کدش را در اسکنِ دوم هم ببیند');

    // کنترلِ مثبت: وضعیتِ DB نباید با اسکنِ دوم خراب شده باشد.
    const row = await db.reservation.findUniqueOrThrow({
      where: { id: resv.id }, select: { status: true },
    });
    assert.equal(row.status, 'seated', 'اسکنِ دوم نباید وضعیتِ رزرو را جهش بدهد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('۶) عاملِ دومِ هویت — استیکرِ QR به‌تنهایی کافی نیست', () => {
  test('🔴 غریبه‌ای که فقط کدِ QR دارد ۴۰۳ می‌گیرد؛ صاحبِ رزرو موفق می‌شود', async () => {
    // 🔴 باگی که پین می‌شود: کدِ QR **رویِ میز چسبیده** است. ۵۰ بیت آنتروپی
    //    فقط حدس‌زدن را می‌بندد، نه دیدن. تا پیش از این، هر رهگذری که استیکر
    //    را می‌دید می‌توانست رزروِ فردِ دیگری را بنشاند — انتقالِ واقعیِ چرخه‌ی
    //    حیات، اعلان، و میزِ occupied، به‌نامِ کسی که هنوز نرسیده بود.
    //
    // هر دو نیمه در یک تست، چون جدا از هم هرکدام با یک پیاده‌سازیِ تقلبی پاس
    // می‌شوند (همیشه-۴۰۳ یا همیشه-۲۰۰).
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, ownerId);

    // ── نیمه‌ی اول: غریبه، فقط با کدِ QR ──
    const denied = await scan(t.qr, strangerToken);
    assert.equal(denied.status, 403, 'دارنده‌ی استیکر بدونِ عاملِ دوم نباید بنشاند');
    const body = await denied.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'CHECKIN_IDENTITY_REQUIRED',
      'کد باید متمایز باشد تا اپ بتواند فرمِ کدِ رزرو را باز کند، نه فقط خطا نشان دهد');

    // ⚠️ کنترلِ روی خودِ DB: بدونِ این، یک هندلر که ۴۰۳ برگرداند **ولی
    //    وضعیت را هم جهش بدهد** از تست رد می‌شد.
    const mid = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(mid?.status, 'confirmed', 'ردِ درخواست نباید هیچ وضعیتی را جهش داده باشد');
    const midTbl = await db.table.findUnique({ where: { id: t.id }, select: { state: true } });
    assert.notEqual(midTbl?.state, 'occupied', 'میز نباید با یک اسکنِ ردشده اشغال شود');

    // ── نیمه‌ی دوم: همان میز، همان لحظه، با توکنِ صاحبِ رزرو ──
    const ok = await scan(t.qr, ownerToken);
    assert.equal(ok.status, 200, 'صاحبِ رزرو باید بدونِ واردکردنِ کد هم موفق شود');
    const out = await ok.json() as { checked_in: boolean; reservation_code: string | null };
    assert.equal(out.checked_in, true);
    assert.equal(out.reservation_code, resv.code);

    const post = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(post?.status, 'seated', 'رزرو واقعاً باید seated شده باشد');
  });

  test('مهمانِ بدونِ حساب با کدِ رزرو موفق می‌شود (نرمال‌سازیِ حروفِ کوچک/فاصله)', async () => {
    // کد از پیامک کپی یا با صفحه‌کلیدِ موبایل تایپ می‌شود؛ همان قاعده‌ی
    // `normalizeGiftCode` در lib/loyalty.ts (trim + uppercase) اعمال می‌شود.
    const t = await makeTable(A);
    const resv = await makeLiveReservation(A, t.id, null);
    const res = await scan(t.qr, undefined, undefined, `  ${resv.code.toLowerCase()} `);
    assert.equal(res.status, 200, 'کدِ درست با حروفِ کوچک/فاصله باید پذیرفته شود');
    const out = await res.json() as { checked_in: boolean };
    assert.equal(out.checked_in, true);
  });

  test('کدِ رزروِ غلط همان ۴۰۳ را می‌دهد، نه ۴۲۲ یا پیامِ متفاوت', async () => {
    // اگر کدِ بدشکل ۴۲۲ بگیرد و کدِ خوش‌شکلِ اشتباه ۴۰۳، خودِ پاسخ می‌گوید
    // «شکلت درست بود» — یک اوراکلِ کوچک ولی واقعی.
    const t = await makeTable(A);
    await makeLiveReservation(A, t.id, ownerId);
    const wrongShape = await scan(t.qr, undefined, undefined, 'not-a-code');
    const wrongValue = await scan(t.qr, undefined, undefined, 'RZAAAAAAA');
    assert.equal(wrongShape.status, 403);
    assert.equal(wrongValue.status, 403);
    assert.equal(await wrongShape.text(), await wrongValue.text(), 'بدنه باید بایت‌به‌بایت یکی باشد');
  });

  test('میزِ بدونِ رزروِ فعال هنوز بدونِ هیچ عاملِ دومی ۲۰۰ می‌دهد', async () => {
    // ⚠️ مرزِ عمدیِ این تغییر: چیزی که برای مهمانِ walk-in کار می‌کرد نباید
    //    بشکند. ضمناً همین است که تفاوتِ ۲۰۰/۴۰۳ را به یک نشتِ کوچک تبدیل
    //    می‌کند (وجودِ رزروِ فعال روی این میز) — معامله‌ی آگاهانه‌ای که در
    //    docblockِ route ثبت شده است.
    const t = await makeTable(A);
    const res = await scan(t.qr);
    assert.equal(res.status, 200);
    const out = await res.json() as { checked_in: boolean };
    assert.equal(out.checked_in, false);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('۵) ریت‌لیمیتِ اختصاصیِ per-IP واقعاً اعمال می‌شود', () => {
  test('🔴 بعد از سقفِ RULES.qrCheckin پاسخ ۴۲۹ می‌شود', async () => {
    // ⚠️ این تنها مسیرِ جهش‌دهنده‌ی وضعیتِ رزرو است که بدونِ توکنِ کاربر سرو
    //    می‌شود؛ بدونِ سقفِ اختصاصی فقط globalPerIp (۱۲۰/دقیقه) جلویش بود.
    await clearOwnCheckinBucket();
    const max = RULES.qrCheckin.max;
    assert.ok(max > 0 && max <= 60, `سقف باید محافظه‌کارانه بماند، دیده شد ${max}`);

    // کدِ ناموجود عمداً: ریت‌لیمیت **قبل از** هر کارِ دیتابیسی اعمال می‌شود،
    // پس این حلقه هیچ رزروی را جهش نمی‌دهد.
    const codes: number[] = [];
    for (let i = 0; i < max + 3; i++) {
      const r = await scan(`T-RATELIMIT${String(i).padStart(2, '0')}`, undefined, RL_IP);
      codes.push(r.status);
    }

    // ۱) هیچ ۴۲۹ِ زودرسی: تا سقف باید همه ۴۰۴ باشند. اگر کسی این مسیر را به
    //    سطلِ تنگ‌ترِ دیگری (مثلاً RULES.auth با ۲۰) وصل کند، همین‌جا می‌شکند.
    assert.ok(codes.slice(0, max).every(s => s === 404),
      `تا سقف نباید ۴۲۹ ببینیم — دیده شد: ${codes.join(',')}`);

    // ۲) سقف واقعاً می‌گیرد. عمداً «دقیقاً در اندیسِ max» ادعا نمی‌شود:
    //    `rateLimitWithFallback` در صورتِ یک خطای گذرایِ Redis به شمارنده‌ی
    //    in-memory سوییچ می‌کند و یک شمارش جابه‌جا می‌شود — یک بار در همین
    //    اجرا دیده شد. پنجره‌ی ۳تایی آن نویز را جذب می‌کند بدونِ اینکه هیچ
    //    جهشِ واقعی‌ای (حذفِ ریت‌لیمیت یا بازکردنِ سقف) از دستش برود.
    assert.ok(codes.slice(max).includes(429),
      `بعد از سقف باید ۴۲۹ بیاید — دیده شد: ${codes.join(',')}`);

    // ۳) کنترلِ مثبت: بعد از پاک‌شدنِ پنجره دوباره ۴۰۴ می‌شود — یعنی آنچه
    //    دیدیم واقعاً ریت‌لیمیت بود، نه یک حالتِ خرابِ ماندگار.
    await clearOwnCheckinBucket();
    const afterReset = await scan('T-RATELIMITZZ', undefined, RL_IP);
    assert.equal(afterReset.status, 404, 'با پاک‌شدنِ پنجره مسیر باید دوباره باز شود');

    await clearOwnCheckinBucket();
  });

  test('سقف مستقل از سطلِ auth است (سوزاندنِ یکی دیگری را نمی‌بندد)', async () => {
    // سطلِ جدا یعنی سیلِ check-in بقیه‌ی APIِ همان IP را نمی‌خواباند.
    assert.notEqual(RULES.qrCheckin.prefix, RULES.auth.prefix);
    assert.notEqual(RULES.qrCheckin.prefix, RULES.globalPerIp.prefix);
  });
});
