import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  ایزولاسیونِ تنانت — در سطحِ **هندلرِ واقعی**، نه در سطحِ کوئریِ Prisma.
//
//  ⚠️ چرا این فایل بازنویسی شد (۲۰۲۶-۰۹-۰۶): نسخه‌ی قبلی سه ادعا داشت که
//  **نمی‌توانستند شکست بخورند**. نمونه‌ی دقیقش:
//
//      db.reservation.findMany({ where: { restaurantId: A.restaurantId } })
//      assert.equal(rows.length, 0)   // ← هیچ ردیفی از B
//
//  خودِ `WHERE` این را تضمین می‌کند. این تست فقط ثابت می‌کرد Prisma خراب
//  نیست. روتی که فراموش کند با `ctx.restaurant.id` مقید شود، از این سوئیت
//  **دست‌نخورده** رد می‌شد — یعنی فایلی که جامع به‌نظر می‌رسید و نبود.
//
//  و این در محصولی که RLS در آن **بی‌اثر** است (P0-021/P0-022: فعال روی ۶۱
//  جدول با صفر policy، و اپ با نقشِ owner + BYPASSRLS وصل می‌شود) یعنی
//  لایه‌ی اپلیکیشن **تنها** مرزِ تنانت است. تستی که آن مرز را نمی‌سنجد،
//  هیچ مرزی را نمی‌سنجد.
//
//  ═══ آنچه این فایل **واقعاً** می‌سنجد ═══
//  هر ادعا یک درخواستِ واقعی با توکنِ امضاشده‌ی تنانتِ A به یک **هندلرِ
//  واقعی** می‌فرستد و ثابت می‌کند نه می‌خوانَد نه می‌نویسد رویِ دادهٔ B:
//    ۱) GET  /restaurant/customers/[userId]   → خواندنِ متقاطع
//    ۲) POST /restaurant/automations          → **نوشتنِ ارجاعِ** متقاطع (coupon_id)
//    ۳) lib/automation.runAutomation          → **تحویلِ** کوپنِ B به مهمانِ A
//
//  ═══ آنچه این فایل نمی‌سنجد (صادقانه، نه با سکوت) ═══
//  این ماتریسِ کاملِ مرزِ تنانت **نیست**. پوشش‌نداده:
//    • بقیه‌ی روت‌هایِ `/restaurant/*` (چند ده روت) — هیچ‌کدام اینجا اجرا نمی‌شوند.
//    • همه‌ی روت‌هایِ `/admin/*`.
//    • مسیرِ هدرِ `X-Restaurant-Id` بینِ شعبه‌هایِ یک تنانت — آن در
//      `branch-isolation.integration.test.mts` و `qr-branch-isolation…` است.
//    • مرزِ سطحِ DB (RLS) — عمداً، چون وجود ندارد.
//  ماتریسِ کامل کارِ باز است. تا آن روز، این فایل ادعای «جامع» ندارد.
//
//  ⚠️ کنترلِ مثبت حیاتی است: تستی که فقط «A دادهٔ B را نمی‌بیند» را بسنجد،
//  وقتی B اصلاً داده‌ای ندارد هم پاس می‌شود — یعنی هیچ چیزی ثابت نمی‌کند.
//  پس هر ادعایِ منفی اینجا با یک ادعایِ مثبت جفت شده است، و **نبودِ موضوع
//  خطاست، نه عبور**.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const customerRoute = await import('../src/app/api/v1/restaurant/customers/[userId]/route.ts');
const automationsRoute = await import('../src/app/api/v1/restaurant/automations/route.ts');
const { runAutomation } = await import('../src/lib/automation.ts');

const TAG = `iso-${randomUUID().slice(0, 8)}`;
const PHONE_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);

type Side = {
  label: string;
  tenantId: string;
  restaurantId: string;
  tableId: string;
  itemId: string;
  staffId: string;
  token: string;
  couponId: string;
  couponCode: string;
  /** مشتریِ این رستوران — ردیفِ customerInsight دارد. */
  userId: string;
  userPhone: string;
};

let A: Side, B: Side;
let phoneSeq = 0;

/** دومین آرگومانِ روت در این نسخه‌ی Next.js `{ params: Promise<...> }` است. */
const routeArg = (userId: string) => ({ params: Promise.resolve({ userId }) });

function req(token: string, method: string, body?: unknown): Request {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    'x-real-ip': testIp(),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('http://x/api/v1/restaurant/x', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function makeSide(label: string): Promise<Side> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: {
      tenantId: t.id, slug: `${TAG}-${label}`, name: `[DEMO] رستوران ${label}`,
      timezone: 'Asia/Tehran', clubPrefix: label.toUpperCase(), isOpen: true,
    },
    select: { id: true },
  });
  const tb = await db.table.create({
    data: { restaurantId: r.id, number: 1, capacity: 4, isActive: true },
    select: { id: true },
  });
  const item = await db.menuItem.create({
    data: { restaurantId: r.id, name: `[DEMO] محرمانه‌ی ${label}`, priceToman: 111_000, isActive: true },
    select: { id: true },
  });
  const staff = await db.staff.create({
    data: {
      tenantId: t.id, role: 'owner', isActive: true,
      phone: `+9891${PHONE_PREFIX}${String(++phoneSeq).padStart(4, '0')}`,
    },
    select: { id: true },
  });
  // کوپنِ اختصاصیِ همین تنانت — «رازِ» قابلِ‌نشتِ سناریوی automation.
  const couponCode = `${TAG}-${label}`.toUpperCase().slice(0, 24);
  const coupon = await db.coupon.create({
    data: { restaurantId: r.id, code: couponCode, kind: 'percent', value: 20, isActive: true },
    select: { id: true, code: true },
  });
  // مشتریِ همین رستوران: کاربر + ردیفِ بینشِ رستوران‌محور.
  const userPhone = `+9890${PHONE_PREFIX}${String(++phoneSeq).padStart(4, '0')}`;
  const user = await db.user.create({
    data: { phone: userPhone, firstName: `[DEMO] مهمانِ ${label}` },
    select: { id: true },
  });
  await db.customerInsight.create({
    data: { restaurantId: r.id, userId: user.id, segment: 'at_risk', totalVisits: 3 },
  });

  return {
    label,
    tenantId: t.id,
    restaurantId: r.id,
    tableId: tb.id,
    itemId: item.id,
    staffId: staff.id,
    token: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
    couponId: coupon.id,
    couponCode: coupon.code,
    userId: user.id,
    userPhone,
  };
}

/**
 * پیامک‌هایِ صف‌شده برایِ یک شماره — `enqueueSms` ردیفِ `jobs` می‌سازد،
 * پس مشاهده روی دادهٔ واقعی است، نه stub. (هیچ شبکه‌ی بیرونی درگیر نیست:
 * job فقط در صف می‌نشیند و worker در تست اجرا نمی‌شود.)
 */
async function smsJobsFor(phone: string): Promise<{ template: string; tokens: string[] }[]> {
  const rows = await db.job.findMany({ where: { kind: 'sms' }, select: { payload: true } });
  return rows
    .map(r => r.payload as unknown as { to?: string; template?: string; tokens?: string[] })
    .filter(p => p?.to === phone)
    .map(p => ({ template: String(p.template), tokens: (p.tokens ?? []).map(String) }));
}

before(async () => {
  A = await makeSide('a');
  B = await makeSide('b');
  // دادهٔ واقعی برایِ B — بدونِ این، «ندیدن» بی‌معناست.
  await db.reservation.create({
    data: {
      restaurantId: B.restaurantId, tableId: B.tableId, code: `${TAG}-SECRET`,
      status: 'confirmed', slotStart: new Date(Date.now() + 2 * 3600_000),
      slotEnd: new Date(Date.now() + 3.5 * 3600_000),
      durationMinutes: 90, blockBufferMinutes: 15, partySize: 2,
      guestName: '[DEMO] مهمانِ محرمانه‌ی B',
    },
  });
});

after(async () => {
  const ids = [A.restaurantId, B.restaurantId];
  const userIds = [A.userId, B.userId];
  const phones = [A.userPhone, B.userPhone];
  // jobهایِ پیامکِ ساخته‌شده‌ی همین فایل (فیلترِ payload سمتِ JS تا به
  // ردیف‌هایِ فایل‌هایِ دیگرِ همین رانر دست نزنیم).
  const smsJobs = await db.job.findMany({ where: { kind: 'sms' }, select: { id: true, payload: true } });
  const mine = smsJobs
    .filter(j => phones.includes((j.payload as unknown as { to?: string })?.to ?? ''))
    .map(j => j.id);
  if (mine.length) await db.job.deleteMany({ where: { id: { in: mine } } });

  await db.outreachLog.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.marketingAutomation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.coupon.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.customerInsight.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.clubMember.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.menuItem.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.staff.deleteMany({ where: { id: { in: [A.staffId, B.staffId] } } });
  await db.restaurant.deleteMany({ where: { id: { in: ids } } });
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('ایزولاسیونِ تنانت — کنترل‌هایِ پایه', () => {
  test('کنترلِ مثبت: رزروِ B واقعاً وجود دارد', async () => {
    // اگر این بیفتد، همه‌ی ادعاهایِ منفیِ زیر بی‌اعتبارند.
    const own = await db.reservation.findMany({ where: { restaurantId: B.restaurantId } });
    assert.equal(own.length, 1);
    assert.match(own[0].guestName ?? '', /محرمانه‌ی B/);
  });

  test('کنترلِ مثبت: کوپنِ B و مشتریِ A واقعاً وجود دارند', async () => {
    const couponB = await db.coupon.findUnique({ where: { id: B.couponId }, select: { code: true, restaurantId: true } });
    assert.ok(couponB, 'کوپنِ B ساخته نشد — سناریوهایِ نشتِ کوپن بی‌موضوع می‌شوند');
    assert.equal(couponB.restaurantId, B.restaurantId);
    const insightA = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId: A.restaurantId, userId: A.userId } },
      select: { segment: true },
    });
    assert.ok(insightA, 'مشتریِ A ساخته نشد — سناریوی winback بی‌موضوع می‌شود');
    assert.equal(insightA.segment, 'at_risk');
  });

  test('قفلِ الگو (نه اثباتِ مرز): findFirst مقید به restaurantId چیزی از B نمی‌دهد', async () => {
    // ⚠️ صادقانه: این ادعا در سطحِ Prisma است و **مرزِ اپلیکیشن را ثابت
    // نمی‌کند** — فقط الگویی را که روت‌ها باید به کار ببرند پین می‌کند.
    // اثباتِ واقعیِ مرز در بلوک‌هایِ هندلرِ پایین است.
    const asA = await db.menuItem.findFirst({ where: { id: B.itemId, restaurantId: A.restaurantId } });
    assert.equal(asA, null, 'قیدِ restaurantId تنها چیزی است که بینِ مهاجم و دادهٔ B ایستاده');
    const asB = await db.menuItem.findFirst({ where: { id: B.itemId, restaurantId: B.restaurantId } });
    assert.ok(asB, 'کنترلِ مثبت: مالکِ واقعی می‌بیندش');
  });
});

describe('مرزِ تنانت در هندلرِ واقعی — خواندن', () => {
  test('GET /restaurant/customers/[userId] با توکنِ A، مشتریِ B را نمی‌دهد', async () => {
    const res = await customerRoute.GET(req(A.token, 'GET'), routeArg(B.userId));
    const body = await res.json();
    assert.equal(res.status, 404, `انتظار ۴۰۴، دیده شد ${res.status} — بدنه: ${JSON.stringify(body)}`);
    assert.equal(body?.error?.code, 'NOT_FOUND');
    // نشتِ محتوا هم بررسی می‌شود، نه فقط کدِ وضعیت.
    assert.ok(!JSON.stringify(body).includes('مهمانِ b'), 'نامِ مشتریِ B در پاسخ نشت کرد');
  });

  test('کنترلِ مثبت: همان درخواست با توکنِ B، ۲۰۰ و دادهٔ واقعی می‌دهد', async () => {
    const res = await customerRoute.GET(req(B.token, 'GET'), routeArg(B.userId));
    const body = await res.json();
    assert.equal(res.status, 200, `مالکِ واقعی باید ببیند — دیده شد ${res.status}: ${JSON.stringify(body)}`);
    assert.match(String(body?.user?.name ?? ''), /مهمانِ b/,
      'کنترلِ مثبت پوچ شد: مالک ۲۰۰ گرفت ولی دادهٔ مشتری در بدنه نیست');
  });
});

describe('مرزِ تنانت در هندلرِ واقعی — نوشتنِ ارجاعِ متقاطع (coupon_id)', () => {
  test('POST /restaurant/automations با coupon_id متعلق به B رد می‌شود', async () => {
    const res = await automationsRoute.POST(req(A.token, 'POST', {
      name: `[DEMO] ${TAG} نشتِ کوپن`,
      trigger: 'winback',
      message_template: 'سلام',
      coupon_id: B.couponId,
    }));
    const body = await res.json();
    assert.ok(res.status >= 400,
      `کوپنِ تنانتِ دیگر پذیرفته شد (${res.status}) — ارجاعِ متقاطع ذخیره شد: ${JSON.stringify(body)}`);
    assert.equal(body?.error?.code, 'NOT_FOUND',
      `انتظار NOT_FOUND (وجودِ id لو نرود)، دیده شد ${JSON.stringify(body?.error)}`);
    // و مهم‌تر از کدِ وضعیت: هیچ ردیفی با اشاره‌گر به کوپنِ B نمانده باشد.
    const stored = await db.marketingAutomation.findMany({
      where: { restaurantId: A.restaurantId, couponId: B.couponId }, select: { id: true },
    });
    assert.equal(stored.length, 0, 'ردیفِ automation با اشاره‌گر به کوپنِ تنانتِ B ذخیره شد');
  });

  test('کنترلِ مثبت: coupon_id خودِ A پذیرفته و واقعاً ذخیره می‌شود', async () => {
    const res = await automationsRoute.POST(req(A.token, 'POST', {
      name: `[DEMO] ${TAG} کوپنِ خودی`,
      trigger: 'winback',
      message_template: 'سلام',
      coupon_id: A.couponId,
    }));
    const body = await res.json();
    assert.equal(res.status, 201, `کوپنِ خودی باید بپذیرد — دیده شد ${res.status}: ${JSON.stringify(body)}`);
    const row = await db.marketingAutomation.findUnique({
      where: { id: String(body.id) }, select: { couponId: true, restaurantId: true },
    });
    assert.ok(row, 'کنترلِ مثبت پوچ شد: ۲۰۱ برگشت ولی ردیفی ساخته نشد');
    assert.equal(row.couponId, A.couponId);
    assert.equal(row.restaurantId, A.restaurantId);
  });
});

describe('مرزِ تنانت در تحویل — کوپنِ B نباید به مهمانِ A پیامک شود', () => {
  test('runAutomation رویِ ردیفِ موجودِ آلوده، کدِ کوپنِ B را نمی‌فرستد', async () => {
    // ردیفِ «از قبل موجود»: مستقیم در DB درج می‌شود، چون دقیقاً همان چیزی
    // است که پس از بستنِ مسیرِ نوشتن هم روی دیتابیسِ تولید باقی می‌ماند.
    const poisoned = await db.marketingAutomation.create({
      data: {
        restaurantId: A.restaurantId, name: `[DEMO] ${TAG} آلوده`, trigger: 'winback',
        messageTemplate: 'سلام', couponId: B.couponId, isActive: true,
      },
      select: { id: true, restaurantId: true, trigger: true, triggerConfig: true, messageTemplate: true, couponId: true, lastRunAt: true },
    });

    const result = await runAutomation(poisoned);
    assert.equal(result.sent, 1,
      `نبودِ موضوع = خطا: انتظار یک ارسال به مهمانِ at_riskِ A، دیده شد sent=${result.sent}`);

    const jobs = await smsJobsFor(A.userPhone);
    assert.equal(jobs.length, 1, `انتظار دقیقاً یک jobِ پیامک برایِ مهمانِ A، دیده شد ${jobs.length}`);
    assert.equal(jobs[0].template, 'winback_offer', 'قالبِ winback باید توکنِ کدِ تخفیف داشته باشد');
    assert.ok(
      !jobs[0].tokens.includes(B.couponCode),
      `کدِ کوپنِ تنانتِ B به مهمانِ تنانتِ A تحویل شد — توکن‌ها: ${JSON.stringify(jobs[0].tokens)}`,
    );
  });

  test('کنترلِ مثبت: کوپنِ خودِ A واقعاً در توکن‌هایِ پیامک می‌نشیند', async () => {
    // بدونِ این، ادعایِ منفیِ بالا با «هیچ کوپنی هرگز فرستاده نمی‌شود» هم سبز می‌ماند.
    const clean = await db.marketingAutomation.create({
      data: {
        restaurantId: B.restaurantId, name: `[DEMO] ${TAG} سالم`, trigger: 'winback',
        messageTemplate: 'سلام', couponId: B.couponId, isActive: true,
      },
      select: { id: true, restaurantId: true, trigger: true, triggerConfig: true, messageTemplate: true, couponId: true, lastRunAt: true },
    });
    const result = await runAutomation(clean);
    assert.equal(result.sent, 1, `نبودِ موضوع = خطا: انتظار یک ارسال، دیده شد sent=${result.sent}`);

    const jobs = await smsJobsFor(B.userPhone);
    assert.equal(jobs.length, 1, `انتظار دقیقاً یک jobِ پیامک برایِ مهمانِ B، دیده شد ${jobs.length}`);
    assert.ok(
      jobs[0].tokens.includes(B.couponCode),
      `کنترلِ مثبت پوچ شد: کوپنِ خودیِ B در توکن‌ها نیست — ${JSON.stringify(jobs[0].tokens)}`,
    );
  });
});
