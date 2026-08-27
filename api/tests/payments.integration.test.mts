import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
import { randomInt, randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.invalid';
process.env.ZARINPAL_MERCHANT_ID = 'test-merchant-id';
delete process.env.ZARINPAL_SANDBOX;

// ═══════════════════════════════════════════════════════════════════════
//  POST /reservations/:code/pay + GET /payments/callback — رویِ Postgresِ
//  زنده و روت‌هایِ واقعی (نه فقط lib/zarinpal.ts ایزوله).
//
//  ⚠️ چرا این فایل «رزروِ معمولی» را جداگانه تست می‌کند (اولین describe):
//  ممیزیِ ۲۰۲۶-۰۸-۲۲ نشان داد `lib/cancellation-policy.ts`'s resolvePolicy()
//  — تنها جایی که depositRequested/depositAmountToman را محاسبه می‌کند —
//  **صفر فراخوان‌کننده** در کدِ زنده دارد. یعنی این دو فیلد برایِ **هر رزروِ
//  واقعیِ امروز** روی پیش‌فرضِ schema می‌مانند (false/null) و این endpoint
//  همیشه ۴۲۲ می‌دهد. این فایل آن رفتارِ *فعلی* را قفل می‌کند (مستند در
//  docs/KNOWN_LIMITATIONS.md) و جداگانه، با ست‌کردنِ مستقیمِ این دو فیلد در
//  دیتابیس (شبیه‌سازیِ حالتی که resolvePolicy() روزی وصل شود)، منطقِ خودِ
//  endpoint را —‌ که کاملاً درست و تست‌پذیر است — جدا از آن باگِ بالادستی
//  می‌سنجد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { fixturePhone } = await import('./_phone.helper.mts');
const payRoute = await import('../src/app/api/v1/reservations/[code]/pay/route');
const callbackRoute = await import('../src/app/api/v1/payments/callback/route');

const TAG = 'pay';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function resvCode(): string {
  let s = 'RZ';
  for (let i = 0; i < 7; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

const ORIGINAL_FETCH = globalThis.fetch;
type FetchCall = { url: string; body: Record<string, unknown> };
let fetchCalls: FetchCall[];

/**
 * موکِ fetch برایِ هر دو تماسِ HTTPِ زرین‌پال (request.json و verify.json)،
 * بر اساسِ URL از هم تشخیص داده می‌شوند. پیش‌فرض: هر دو موفق (code 100)،
 * authorityِ هر «request» یکتا (وگرنه محدودیتِ UNIQUEِ ستونِ authority در
 * Payment بینِ تست‌ها به هم می‌خورد).
 */
let authoritySeq = 0;
function stubFetch(overrides: { requestJson?: unknown; verifyJson?: unknown } = {}) {
  fetchCalls = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    fetchCalls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : {} });
    const isVerify = u.includes('/payment/verify.json');
    const json = isVerify
      ? (overrides.verifyJson ?? { data: { code: 100, ref_id: String(1000 + fetchCalls.length) } })
      : (overrides.requestJson ?? { data: { code: 100, authority: `AUTH-${TAG}-${++authoritySeq}` } });
    return { ok: true, status: 200, json: async () => json } as unknown as Response;
  }) as unknown as typeof fetch;
}

after(() => { globalThis.fetch = ORIGINAL_FETCH; });

/*
 * ⚠️ اینجا قبلاً `clearRateLimit()` بود که `rl:srch:*` را **سراسری** پاک می‌کرد.
 * لازم شده بود چون IPِ هر `new Request()`ِ بی‌هدر `unknown` است و سطل بینِ
 * فایل‌های رانر مشترک می‌شد؛ ولی خودِ آن پاک‌سازی سطلِ فایل‌های دیگر را هم خالی
 * می‌کرد. حالا هر Request با `testIp()` سطلِ خودش را دارد.
 */

const custReq = (token: string) =>
  new Request('http://x/api', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'x-real-ip': testIp() },
  });

const routeArg = (code: string) => ({ params: Promise.resolve({ code }) });

const callbackReq = (qs: string) =>
  new Request(`http://x/api/v1/payments/callback${qs}`, {
    method: 'GET',
    headers: { 'x-real-ip': testIp() },
  });

let tenantId: string;
let restPayId: string;
let restNoPayId: string;
let userAId: string; // مالکِ رزروها
let userBId: string; // مشتریِ دیگر — برایِ تستِ جداسازیِ مالکیت
let tokenA: string;
let tokenB: string;
let staffToken: string;

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  tenantId = t.id;

  const restPay = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-pay-${s}`, name: `[DEMO] رستورانِ پرداخت‌فعال`, clubPrefix: 'PAY', paymentEnabled: true },
    select: { id: true },
  });
  restPayId = restPay.id;

  const restNoPay = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-nopay-${s}`, name: `[DEMO] رستورانِ بدونِ پرداخت`, clubPrefix: 'NOP', paymentEnabled: false },
    select: { id: true },
  });
  restNoPayId = restNoPay.id;

  const userA = await db.user.create({ data: { phone: fixturePhone('0939'), firstName: '[DEMO]', lastName: 'پرداخت-الف' }, select: { id: true } });
  const userB = await db.user.create({ data: { phone: fixturePhone('0939'), firstName: '[DEMO]', lastName: 'پرداخت-ب' }, select: { id: true } });
  userAId = userA.id;
  userBId = userB.id;
  tokenA = signAccess({ sub: userAId, kind: 'customer' });
  tokenB = signAccess({ sub: userBId, kind: 'customer' });
  staffToken = signAccess({ sub: randomUUID(), kind: 'staff', tenantId, role: 'owner' });
});

after(async () => {
  await db.payment.deleteMany({ where: { reservation: { restaurantId: { in: [restPayId, restNoPayId] } } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: [restPayId, restNoPayId] } } });
  await db.restaurant.deleteMany({ where: { id: { in: [restPayId, restNoPayId] } } });
  await db.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

type ResvOverrides = {
  restaurantId?: string;
  userId?: string | null;
  depositRequested?: boolean;
  depositAmountToman?: number | null;
  depositStatus?: 'none' | 'pending' | 'paid' | 'refunded' | 'failed';
};

async function makeReservation(o: ResvOverrides = {}) {
  const now = Date.now();
  return db.reservation.create({
    data: {
      code: resvCode(),
      restaurantId: o.restaurantId ?? restPayId,
      userId: o.userId === undefined ? userAId : o.userId,
      partySize: 2,
      slotStart: new Date(now + 60 * 60_000),
      slotEnd: new Date(now + 150 * 60_000),
      depositRequested: o.depositRequested ?? false,
      depositAmountToman: o.depositAmountToman ?? null,
      depositStatus: o.depositStatus ?? 'none',
    },
    select: { id: true, code: true },
  });
}

// ─────────────────────────────────────────────────────────────────────
describe('POST /reservations/:code/pay', () => {
  test('⚠️ رزروِ معمولی (بدونِ بیعانه‌ی درخواست‌شده — وضعیتِ هر رزروِ واقعیِ امروز) رد می‌شود', async () => {
    const resv = await makeReservation(); // depositRequested پیش‌فرض false است — دقیقاً مثلِ تولید
    stubFetch();
    const res = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(res.status, 422);
    const body = await res.json() as { error: { code: string } };
    assert.equal(body.error.code, 'VALIDATION');
    assert.equal(fetchCalls.length, 0, 'نباید اصلاً به زرین‌پال درخواست بزند');
  });

  test('با بیعانه‌ی واقعاً درخواست‌شده، پرداخت شروع می‌شود و redirect_url معتبر برمی‌گردد', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 150_000 });
    stubFetch();
    const res = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(res.status, 200);
    const body = await res.json() as { redirect_url: string };
    assert.match(body.redirect_url, /^https:\/\/payment\.zarinpal\.com\/pg\/StartPay\//);

    const payment = await db.payment.findFirst({ where: { reservationId: resv.id }, orderBy: { createdAt: 'desc' } });
    assert.equal(payment?.status, 'pending');
    assert.equal(payment?.amountToman, 150_000);

    const after = await db.reservation.findUnique({ where: { id: resv.id }, select: { depositStatus: true } });
    assert.equal(after?.depositStatus, 'pending');
  });

  test('غیرِمالک نمی‌تواند برایِ رزروِ کاربرِ دیگری پرداخت کند', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 100_000, userId: userAId });
    stubFetch();
    const res = await payRoute.POST(custReq(tokenB), routeArg(resv.code));
    assert.equal(res.status, 403);
    assert.equal(fetchCalls.length, 0);
  });

  test('کارمند (staff) از این مسیر نمی‌تواند پرداخت کند — فقط مشتریِ صاحبِ رزرو', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 100_000 });
    stubFetch();
    const res = await payRoute.POST(custReq(staffToken), routeArg(resv.code));
    assert.equal(res.status, 403);
  });

  test('پرداخت آنلاین برایِ رستوران غیرفعال باشد → رد می‌شود، حتی اگر بیعانه درخواست شده باشد', async () => {
    const resv = await makeReservation({ restaurantId: restNoPayId, depositRequested: true, depositAmountToman: 100_000 });
    stubFetch();
    const res = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(res.status, 422);
    assert.equal(fetchCalls.length, 0);
  });

  test('بیعانه‌ی قبلاً پرداخت‌شده دوباره قابلِ پرداخت نیست', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 100_000, depositStatus: 'paid' });
    stubFetch();
    const res = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(res.status, 422);
    assert.equal(fetchCalls.length, 0);
  });

  test('⚠️ idempotency: تلاشِ دومِ پرداخت pendingِ قبلی را failed می‌کند، رویِ هم انباشته نمی‌شود', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 100_000 });
    stubFetch();
    const first = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(first.status, 200);
    const second = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(second.status, 200);

    const all = await db.payment.findMany({ where: { reservationId: resv.id }, orderBy: { createdAt: 'asc' } });
    assert.equal(all.length, 2, 'باید دقیقاً دو ردیفِ Payment باشد، نه بیشتر و نه یکی جایگزین‌شده');
    assert.equal(all[0].status, 'failed');
    assert.equal(all[0].failReason, 'جایگزین‌شده با تلاشِ پرداختِ جدید');
    assert.equal(all[1].status, 'pending');
    assert.notEqual(all[0].authority, all[1].authority, 'هر تلاش باید authorityِ خودش را داشته باشد');
  });

  test('رزروِ ناموجود → ۴۰۴', async () => {
    stubFetch();
    const res = await payRoute.POST(custReq(tokenA), routeArg(resvCode()));
    assert.equal(res.status, 404);
  });

  test('بدونِ ورود → ۴۰۱', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 100_000 });
    const res = await payRoute.POST(
      new Request('http://x/api', { method: 'POST', headers: { 'x-real-ip': testIp() } }),
      routeArg(resv.code),
    );
    assert.equal(res.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('GET /payments/callback', () => {
  test('⚠️ authorityِ ناموجود → ریدایرکتِ failed، نه کرش', async () => {
    // کدِ رزرو از query می‌آید و با zReservationCode اعتبارسنجی شده، پس حتی
    // وقتی هیچ Paymentی با این authority نیست، کاربر به صفحه‌ی همان رزرو با
    // payment=failed برمی‌گردد (نه صفحه‌ی خانه) — پیامِ روشن‌تر برایِ مهمان.
    const code = resvCode();
    stubFetch();
    const res = await callbackRoute.GET(callbackReq(`?code=${code}&Authority=ghost-auth&Status=OK`));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `https://app.example.invalid/reservations/${code}?payment=failed`);
    assert.equal(fetchCalls.length, 0, 'بدونِ ردیفِ Payment نباید هیچ verifyی به زرین‌پال برود');
  });

  test('⚠️ authority معتبر ولی کدِ رزروِ نامنطبق → failed (تطبیقِ authority+code امنیتِ این endpoint است)', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 80_000 });
    const authority = `AUTH-${TAG}-mismatch-${randomUUID()}`;
    await db.payment.create({ data: { reservationId: resv.id, authority, amountToman: 80_000, status: 'pending' } });
    stubFetch();
    const res = await callbackRoute.GET(callbackReq(`?code=${resvCode()}&Authority=${authority}&Status=OK`));
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /payment=failed/);
    assert.equal(fetchCalls.length, 0, 'با کدِ نامنطبق نباید حتی تلاش برایِ verify کند');
  });

  test('پارامترهایِ نامعتبر (بدونِ Authority) → ریدایرکتِ invalid', async () => {
    stubFetch();
    const res = await callbackRoute.GET(callbackReq(`?code=${resvCode()}&Status=OK`));
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /payment=invalid/);
  });

  test('⚠️ Status=NOK (انصرافِ کاربر در درگاه) → failed بدونِ صدا زدنِ verify', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 80_000 });
    const authority = `AUTH-${TAG}-nok-${randomUUID()}`;
    await db.payment.create({ data: { reservationId: resv.id, authority, amountToman: 80_000, status: 'pending' } });
    stubFetch();

    const res = await callbackRoute.GET(callbackReq(`?code=${resv.code}&Authority=${authority}&Status=NOK`));
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /payment=failed/);
    assert.equal(fetchCalls.length, 0, 'طبقِ مستنداتِ زرین‌پال، وقتی کاربر انصراف داده نباید verify صدا زد');

    const payment = await db.payment.findUnique({ where: { authority } });
    assert.equal(payment?.status, 'failed');
    assert.equal(payment?.failReason, 'کاربر در درگاه انصراف داد');
    const after = await db.reservation.findUnique({ where: { id: resv.id }, select: { depositStatus: true } });
    assert.equal(after?.depositStatus, 'failed');
  });

  test('Status=OK + verifyِ موفق (code 100) → paid، refId و verifiedAt ثبت می‌شود', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 80_000 });
    const authority = `AUTH-${TAG}-ok-${randomUUID()}`;
    await db.payment.create({ data: { reservationId: resv.id, authority, amountToman: 80_000, status: 'pending' } });
    stubFetch({ verifyJson: { data: { code: 100, ref_id: 'REF-12345' } } });

    const res = await callbackRoute.GET(callbackReq(`?code=${resv.code}&Authority=${authority}&Status=OK`));
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /payment=paid/);

    const payment = await db.payment.findUnique({ where: { authority } });
    assert.equal(payment?.status, 'success');
    assert.equal(payment?.refId, 'REF-12345');
    assert.ok(payment?.verifiedAt, 'باید زمانِ verify ثبت شود');
    const after = await db.reservation.findUnique({ where: { id: resv.id }, select: { depositStatus: true } });
    assert.equal(after?.depositStatus, 'paid');
  });

  test('Status=OK + verifyِ ناموفق (کدِ دیگر) → failed', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 80_000 });
    const authority = `AUTH-${TAG}-verifail-${randomUUID()}`;
    await db.payment.create({ data: { reservationId: resv.id, authority, amountToman: 80_000, status: 'pending' } });
    stubFetch({ verifyJson: { data: { code: -1 } } });

    const res = await callbackRoute.GET(callbackReq(`?code=${resv.code}&Authority=${authority}&Status=OK`));
    assert.match(res.headers.get('location') ?? '', /payment=failed/);
    const payment = await db.payment.findUnique({ where: { authority } });
    assert.equal(payment?.status, 'failed');
    assert.equal(payment?.failReason, 'تأیید زرین‌پال ناموفق بود');
  });

  test('⚠️ callbackِ تکراری برایِ پرداختِ already-success → idempotent، verify دوباره صدا زده نمی‌شود', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 80_000 });
    const authority = `AUTH-${TAG}-dup-${randomUUID()}`;
    await db.payment.create({
      data: { reservationId: resv.id, authority, amountToman: 80_000, status: 'success', refId: 'REF-OLD' },
    });
    stubFetch();

    const res = await callbackRoute.GET(callbackReq(`?code=${resv.code}&Authority=${authority}&Status=OK`));
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /payment=paid/);
    assert.equal(fetchCalls.length, 0, 'پرداختِ already-success نباید دوباره verify شود');

    const payment = await db.payment.findUnique({ where: { authority } });
    assert.equal(payment?.refId, 'REF-OLD', 'رکورد نباید تغییر کند');
  });

  test('⚠️ ریدایرکت‌ها رویِ appBase() (NEXT_PUBLIC_APP_URL) هستند، نه دامنه‌ی هاردکد', async () => {
    // ⚠️ قفلِ رفعِ باگِ ۲۰۲۶-۰۸-۲۲: قبلاً این فایل مستقیماً process.env.CUSTOMER_APP_URL
    //    را می‌خواند — متغیری که در .env مستند بود ولی جدا از NEXT_PUBLIC_APP_URLِ
    //    QRِ چک-این بود؛ تنظیمِ یکی و فراموش‌کردنِ دیگری باعثِ ریدایرکتِ اشتباه می‌شد.
    stubFetch();
    const res = await callbackRoute.GET(callbackReq(`?code=${resvCode()}&Authority=nope&Status=OK`));
    const loc = res.headers.get('location') ?? '';
    assert.ok(loc.startsWith(process.env.NEXT_PUBLIC_APP_URL!), `Location باید با ${process.env.NEXT_PUBLIC_APP_URL} شروع شود، بود: ${loc}`);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('اتصالِ pay → callback: مسیرِ کاملِ end-to-end', () => {
  test('شروعِ پرداخت از pay/route، سپس تأییدِ موفق از callback/route', async () => {
    const resv = await makeReservation({ depositRequested: true, depositAmountToman: 65_000 });
    stubFetch({ verifyJson: { data: { code: 100, ref_id: 'REF-E2E' } } });

    const payRes = await payRoute.POST(custReq(tokenA), routeArg(resv.code));
    assert.equal(payRes.status, 200);

    const payment = await db.payment.findFirst({ where: { reservationId: resv.id }, orderBy: { createdAt: 'desc' } });
    assert.ok(payment?.authority);

    const cbRes = await callbackRoute.GET(callbackReq(`?code=${resv.code}&Authority=${payment!.authority}&Status=OK`));
    assert.equal(cbRes.status, 302);
    assert.match(cbRes.headers.get('location') ?? '', /payment=paid/);

    const finalResv = await db.reservation.findUnique({ where: { id: resv.id }, select: { depositStatus: true } });
    assert.equal(finalResv?.depositStatus, 'paid');
    const finalPayment = await db.payment.findUnique({ where: { id: payment!.id } });
    assert.equal(finalPayment?.status, 'success');
    assert.equal(finalPayment?.refId, 'REF-E2E');
  });
});
