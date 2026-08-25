import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  PUT /v1/restaurant/hours — اعتبارسنجیِ بدنه (فازِ ۲، یافته‌ی ۱۸ در
//  docs/recovery/OPEN-FINDINGS.md)
//
//  ⚠️ باگی که این فایل قفل می‌کند: این روت تنها جایی در کلِ درختِ routeها
//  بود که `safeJson(req)` را **بدونِ `.parse()`** مصرف می‌کرد. یعنی بدنه
//  هیچ شِیمایی نداشت و سه پیامد داشت:
//
//   ۱. **DoSِ داخلی.** `b.closures` هیچ سقفِ طولی نداشت و مستقیم یک حلقه‌ی
//      **ترتیبیِ** `$executeRaw` را می‌راند (یک رفت‌وبرگشتِ DB به‌ازای هر
//      عضو). تنها مرزِ موجود `MAX_BODY_BYTES` = ۱۰۰KB در lib/security.ts
//      بود؛ با کوچک‌ترین عضوِ ممکن (`{"date":"2026-01-01"}` = ۲۲ بایت +
//      کاما) یعنی **۴۶۵۴** رفت‌وبرگشتِ ترتیبی در **یک** درخواست
//      (اندازه‌گیریِ واقعی: floor(102400/22)).
//
//   ۲. **۵۰۰ + از دست رفتنِ داده** (این مورد در گزارشِ اولیه نبود و با
//      اجرای واقعی پیدا شد). رجکسِ گاردِ روت `^\d{4}-\d{2}-\d{2}$` بود که
//      تاریخِ **تقویمیِ ناموجود** را می‌پذیرد. اجرای واقعیِ probe نشان داد
//      `2026-02-30`، `9999-99-99`، `2026-13-01` و `0000-00-00` هر چهار از
//      رجکس رد می‌شوند و بعد روی `::date` با
//      `PrismaClientKnownRequestError P2010` می‌شکنند — خطایی که
//      `instanceof ApiError` نیست ⇒ `errorResponse` ۵۰۰ می‌دهد.
//      و چون `DELETE FROM restaurant_closures` **قبلِ** حلقه اجرا می‌شود و
//      هیچ transactionی دورشان نیست، همه‌ی تعطیلاتِ قبلی پاک می‌شدند و
//      چیزی جایشان نمی‌نشست: از دست رفتنِ داده با یک غلطِ تایپی.
//
//   ۳. **دیتای بدنوعِ خاموش.** `c.reason` هیچ چکِ نوعی نداشت.
//      ⚠️ **تصحیحِ گزارشِ اولیه:** این ۵۰۰ نمی‌داد. probeِ واقعی نشان داد
//      Prisma بی‌صدا سریالایز می‌کند و Postgres به `text` می‌ریزد:
//      `{evil:true}` → `{"evil": true}`، `['a','b']` → `{a,b}`،
//      `12345` → `"12345"`، `true` → `"true"`. یعنی ۲۰۰ با دیتای مچاله‌شده،
//      که از ۵۰۰ بی‌سروصداتر و بدتر است. ستونِ DB هم `text`ِ بی‌سقف است.
//
//  توجه: این SQL injection **نبود** — تگ‌تمپلیت‌های Prisma پارامتری‌اند.
//
//  چرا integration واقعی و نه mock: ادعایِ «۴۲۲ نه ۵۰۰» یک ادعا درباره‌ی
//  رفتارِ لایه‌ی Prisma با پارامترِ بدنوع است. با mock کردنِ Prisma دقیقاً
//  همان چیزی را فرض کرده‌ایم که می‌خواهیم بسنجیم.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { redis } = await import('../src/lib/redis.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const hoursRoute = await import('../src/app/api/v1/restaurant/hours/route.ts');

let tenantId: string;
let restaurantId: string;
let token: string;

const VALID_HOURS = { '0': [['12:00', '23:00']] };

function putReq(body: unknown) {
  return new Request('http://x/api/v1/restaurant/hours', {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** شمارشِ واقعیِ ردیف‌های closure روی DB — نه از پاسخِ روت، بلکه از خودِ جدول. */
async function closureCount(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM restaurant_closures WHERE restaurant_id = ${restaurantId}::uuid
  `;
  return Number(rows[0]?.n ?? 0);   // ⚠️ COUNT(*) از Postgres BigInt است — هر دو لایه (::int + Number)
}

before(async () => {
  // شمارنده‌ی rate-limit را پاک کن: این روت `rateLimit:'auth'` (۲۰ در دقیقه) دارد
  // و این فایل چند PUT پشت‌سرِ هم می‌زند. خودِ سقف عمداً دست‌نخورده می‌ماند.
  const stale = await redis.keys('*auth*').catch(() => [] as string[]);
  if (stale.length) await redis.del(...stale).catch(() => 0);

  const t = await db.tenant.create({ data: { name: '[DEMO] tenant (hours-put-validation)' }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-hours-put-${Date.now()}`,
      name: '[DEMO] رستورانِ تستِ اعتبارسنجیِ ساعتِ کاری', clubPrefix: 'HPV',
      openingHours: VALID_HOURS,
    },
    select: { id: true },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: { tenantId, phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  token = signAccess({ sub: staff.id, kind: 'staff', tenantId, role: 'owner' });
});

after(async () => {
  await db.$executeRaw`DELETE FROM restaurant_closures WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('PUT /restaurant/hours — شِیمای بدنه', () => {
  test('کنترلِ مثبت: بدنه‌ی معتبر ۲۰۰ می‌دهد و closures واقعاً نوشته می‌شوند', async () => {
    const res = await hoursRoute.PUT(putReq({
      opening_hours: VALID_HOURS,
      closures: [
        { date: '2026-03-20', reason: '[DEMO] تعطیلیِ نوروز' },
        { date: '2026-03-21', reason: null },
        { date: '2026-03-22' },
      ],
    }));
    assert.equal(res.status, 200, await res.text());
    assert.equal(await closureCount(), 3);
  });

  test('reasonِ غیررشته‌ای ۴۲۲ می‌دهد و هیچ‌چیز مچاله‌شده ذخیره نمی‌شود', async () => {
    const before = await closureCount();
    const res = await hoursRoute.PUT(putReq({
      opening_hours: VALID_HOURS,
      closures: [{ date: '2026-03-20', reason: { evil: true } }],
    }));
    assert.equal(res.status, 422, await res.text());
    // و هیچ نوشتنِ نیمه‌کاره‌ای رخ نداده باشد (DELETE قبل از INSERT اجرا نشود).
    assert.equal(await closureCount(), before, 'بدنه‌ی نامعتبر نباید closureهای موجود را پاک کند');
    const rows = await db.$queryRaw<Array<{ reason: string | null }>>`
      SELECT reason FROM restaurant_closures WHERE restaurant_id = ${restaurantId}::uuid AND closure_date = '2026-03-20'::date
    `;
    assert.notEqual(rows[0]?.reason, '{"evil": true}', 'آبجکت نباید سریالایز و ذخیره شود');
  });

  test('آرایه به‌عنوان reason ۴۲۲ می‌دهد (قبلاً به سینتکسِ آرایه‌ی Postgres «{a,b}» تبدیل می‌شد)', async () => {
    const res = await hoursRoute.PUT(putReq({
      opening_hours: VALID_HOURS,
      closures: [{ date: '2026-03-20', reason: ['a', 'b'] }],
    }));
    assert.equal(res.status, 422, await res.text());
  });

  // ═══ گران‌بهاترین تستِ این فایل: مسیرِ ۵۰۰ + از دست رفتنِ داده ═══
  test('تاریخِ تقویمیِ ناموجود ۴۲۲ می‌دهد، نه ۵۰۰ — و تعطیلاتِ موجود را پاک نمی‌کند', async () => {
    const before = await closureCount();
    assert.ok(before > 0, 'کنترلِ مثبت: باید چیزی برای از دست رفتن وجود داشته باشد');

    for (const date of ['2026-02-30', '9999-99-99', '2026-13-01', '0000-00-00']) {
      // کنترلِ مثبت: این تاریخ‌ها واقعاً از رجکسِ گاردِ قبلی رد می‌شدند.
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date), `${date} باید از رجکسِ قالب رد شود`);
      const res = await hoursRoute.PUT(putReq({
        opening_hours: VALID_HOURS,
        closures: [{ date: '2026-03-20', reason: '[DEMO] معتبر' }, { date }],
      }));
      assert.notEqual(res.status, 500, `${date}: باید ۴۲۲ باشد نه خطای خامِ سرور`);
      assert.equal(res.status, 422, `${date}: ${await res.text()}`);
      assert.equal(await closureCount(), before, `${date}: DELETE نباید قبل از اعتبارسنجی شلیک شود`);
    }
  });

  test('reasonِ بیش‌ازحد بلند ۴۲۲ می‌دهد (ستونِ reason در DB نوعِ text و بی‌سقف است)', async () => {
    const res = await hoursRoute.PUT(putReq({
      opening_hours: VALID_HOURS,
      closures: [{ date: '2026-03-20', reason: 'x'.repeat(5_000) }],
    }));
    assert.equal(res.status, 422, await res.text());
  });

  test('closures بیش از سقف ۴۲۲ می‌دهد — حلقه‌ی ترتیبیِ DB اصلاً اجرا نمی‌شود', async () => {
    const before = await closureCount();
    // ۱۰۰۰ عضو: کاملاً زیرِ سقفِ ۱۰۰KBِ safeJson جا می‌شود، پس قبلاً به حلقه می‌رسید.
    const many = Array.from({ length: 1_000 }, (_, i) => ({
      date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }));
    const body = JSON.stringify({ opening_hours: VALID_HOURS, closures: many });
    assert.ok(body.length < 100 * 1024, `کنترلِ مثبت: بدنه (${body.length}B) باید زیرِ MAX_BODY_BYTES باشد وگرنه این تست چیزِ دیگری را می‌سنجد`);

    const res = await hoursRoute.PUT(putReq({ opening_hours: VALID_HOURS, closures: many }));
    assert.equal(res.status, 422, await res.text());
    assert.equal(await closureCount(), before, 'بدنه‌ی ردشده نباید وضعیتِ DB را عوض کند');
  });

  test('dateِ بدشکل ۴۲۲ می‌دهد (قبلاً بی‌صدا با continue رد می‌شد)', async () => {
    const res = await hoursRoute.PUT(putReq({
      opening_hours: VALID_HOURS,
      closures: [{ date: 'not-a-date' }],
    }));
    assert.equal(res.status, 422, await res.text());
  });

  test('رفتارِ قبلی حفظ شده: ساختارِ opening_hoursِ نامعتبر همچنان ۴۲۲ می‌دهد', async () => {
    const res = await hoursRoute.PUT(putReq({ opening_hours: { '9': [['12:00', '23:00']] } }));
    assert.equal(res.status, 422, await res.text());
  });

  test('رفتارِ قبلی حفظ شده: بدونِ closures فقط پیشنهادِ ساعت ثبت می‌شود و closures دست‌نخورده می‌ماند', async () => {
    const before = await closureCount();
    const res = await hoursRoute.PUT(putReq({ opening_hours: null }));
    assert.equal(res.status, 200, await res.text());
    assert.equal(await closureCount(), before);
    const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { hoursChangeStatus: true, openingHours: true } });
    assert.equal(r?.hoursChangeStatus, 'pending');
    assert.deepEqual(r?.openingHours, VALID_HOURS, 'ساعتِ زنده نباید بدونِ تأییدِ شرکت عوض شود');
  });
});
