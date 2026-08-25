import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.OTP_DEV_MODE = 'true';

// ═══════════════════════════════════════════════════════════════════════
//  دو شکافِ باز که هیچ‌کدام «باگ در کد» نبودند — «قاعده‌ای که اعمال نمی‌شد»
//
//  ۱. `RULES.otpPerIp` از روزِ اول تعریف شده بود و **صفر مصرف‌کننده** داشت.
//     سقفِ per-phone فقط از یک شماره محافظت می‌کند؛ مهاجمی که هزار شماره‌ی
//     متفاوت را از یک IP صدا بزند هیچ سدی نداشت جز globalPerIp (۱۲۰/دقیقه)
//     که برای این کار بسیار گشاد است — و **هر درخواست یک پیامکِ پولیِ واقعی**
//     می‌فرستد.
//
//  ۲. `40P01` (deadlock) که هر ۵ تلاشِ TX_MAX_RETRIES را مصرف کند، خام از
//     createReservation بالا می‌رفت و کاربر یک ۵۰۰ی عمومی می‌گرفت — برای یک
//     تداخلِ کاملاً عادیِ DB. deadlock در این مسیر **واقعاً رخ می‌دهد**:
//     در آزمایشِ ۲۰ درجِ هم‌زمان روی یک میز، حالتِ N=2 به‌جای ۲۳P01 یک
//     deadlock داد.
// ═══════════════════════════════════════════════════════════════════════

const { redis } = await import('../src/lib/redis');
const { RULES } = await import('../src/lib/ratelimit');
const otpRoute = await import('../src/app/api/v1/auth/otp/request/route');
const { isSerializationError } = await import('../src/lib/reservation-helpers');

const TAG = randomUUID().slice(0, 8);

/** تاریخِ ۵ روزِ آینده — مطمئناً داخلِ افقِ مجازِ رزرو. */
function soonISO(): string {
  const d = new Date(Date.now() + 5 * 24 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
let ipSeq = 0;

/** IPِ یکتا برای هر تست تا سطل‌ها به هم نریزند. */
const freshIp = () => `10.${(++ipSeq) % 250}.${(ipSeq * 7) % 250}.${(ipSeq * 13) % 250}`;

function otpReq(phone: string, ip: string) {
  return otpRoute.POST(new Request('http://x/api/v1/auth/otp/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ phone }),
  }));
}

/** شماره‌ی یکتا — هر بار متفاوت تا سقفِ per-phone دخالت نکند. */
let phoneSeq = 0;
const freshPhone = () => `0912${String(4000000 + (++phoneSeq)).slice(0, 7)}`;

async function clearBuckets() {
  for (const p of ['*otp:ip*', '*otp:phone*', '*rl:*']) {
    const k = await redis.keys(p);
    if (k.length) await redis.del(...k);
  }
}

before(clearBuckets);
beforeEach(clearBuckets);
after(async () => { await clearBuckets(); });

describe('سقفِ per-IP روی درخواستِ OTP', () => {

  test('⚠️ درخواست از یک IP با شماره‌های متفاوت هم سقف دارد', async () => {
    // این دقیقاً همان حمله‌ای است که پیش از این هیچ سدی نداشت: هر بار شماره‌ی
    // تازه، پس سقفِ per-phone هرگز فعال نمی‌شد.
    const ip = freshIp();
    const max = RULES.otpPerIp.max;
    let blockedAt = -1;
    for (let i = 0; i < max + 3; i++) {
      const res = await otpReq(freshPhone(), ip);
      if (res.status === 429) { blockedAt = i; break; }
    }
    assert.notEqual(blockedAt, -1,
      `پس از ${max + 3} درخواست از یک IP با شماره‌های متفاوت هیچ ۴۲۹ی نیامد`);
    assert.ok(blockedAt >= max,
      `سقف زودتر از موعد فعال شد (در ${blockedAt}، انتظار >= ${max}) — کاربرِ واقعی رد می‌شود`);
  });

  test('کنترلِ منفی: IPِ دیگر سهمیه‌ی خودش را دارد', async () => {
    // بدونِ این، «همیشه ۴۲۹ بده» هم سبز می‌شد و ورود برای همه می‌مرد.
    const ipA = freshIp();
    for (let i = 0; i < RULES.otpPerIp.max + 2; i++) await otpReq(freshPhone(), ipA);
    const res = await otpReq(freshPhone(), freshIp());
    assert.notEqual(res.status, 429, 'سطلِ per-IP نباید بینِ IPها مشترک باشد');
  });

  test('سقفِ per-phone هم از همان RULES مشترک می‌آید (نه پیاده‌سازیِ دوم)', async () => {
    const phone = freshPhone();
    let blockedAt = -1;
    for (let i = 0; i < RULES.otpPerPhone.max + 2; i++) {
      const res = await otpReq(phone, freshIp());   // IPِ متفاوت هر بار
      if (res.status === 429) { blockedAt = i; break; }
    }
    assert.notEqual(blockedAt, -1, 'سقفِ per-phone با IPهای متفاوت هم باید فعال شود');
    assert.ok(blockedAt >= RULES.otpPerPhone.max,
      `سقفِ per-phone زودتر از ${RULES.otpPerPhone.max} فعال شد`);
  });
});

describe('deadlock دیگر به‌شکلِ ۵۰۰ بیرون نمی‌رود', () => {

  test('⚠️ isSerializationError هر دو کدِ ۴۰۰۰۱ و ۴۰P۰۱ را می‌شناسد', () => {
    // پایه‌ی رفع: اگر این تشخیص بشکند، ترجمه هم بی‌اثر می‌شود.
    for (const code of ['40001', '40P01']) {
      const e = Object.assign(new Error('x'), { code });
      assert.equal(isSerializationError(e), true, `کدِ ${code} باید serialization شناخته شود`);
    }
    assert.equal(isSerializationError(Object.assign(new Error('x'), { code: '23505' })), false,
      'نقضِ یکتایی serialization نیست — وگرنه هر خطایی ۴۰۹ می‌شد');
  });

  test('⚠️ deadlockِ واقعی به ۴۰۹ِ دامنه‌ای ترجمه می‌شود، نه ۵۰۰ِ خام', async () => {
    // ⚠️ نسخه‌ی اولِ این تست **ساختاری** بود (grep روی متنِ فایل) و در
    // جهش‌آزمایی **قرمز نشد** — چون رشته‌ی `isSerializationError(e)` جای
    // دیگری هم در همان فایل بود و اسلایسِ متن آن را می‌گرفت. یعنی تست
    // چیزی را قفل نکرده بود. اینجا رفتار واقعاً اجرا می‌شود.
    //
    // تزریق از راهِ `acquireSlotLock` انجام می‌شود — همان درِ تزریقی که
    // خودِ createReservation برای شبیه‌سازیِ قطعیِ Redis دارد. خطا با شکلِ
    // دقیقِ یک deadlockِ Postgres پرتاب می‌شود (`code: '40P01'`).
    const { createReservation } = await import('../src/lib/reservations');
    const { db } = await import('../src/lib/db');

    const t = await db.tenant.create({
      data: { name: `[DEMO] تنانتِ تستِ deadlock ${TAG}` }, select: { id: true },
    });
    const r = await db.restaurant.create({
      data: {
        tenantId: t.id, slug: `dl-${TAG}`, name: `[DEMO] رستورانِ تستِ deadlock`,
        clubPrefix: 'DL', timezone: 'Asia/Tehran',
        tables: { create: [{ number: 1, capacity: 4 }] as never },
      },
      select: { id: true },
    });

    try {
      const deadlock = Object.assign(new Error('deadlock detected'), { code: '40P01' });
      await assert.rejects(
        () => createReservation(
          {
            // ⚠️ تاریخ باید داخلِ افقِ رزرو باشد، وگرنه اعتبارسنجی زودتر از
            // مسیرِ قفل رد می‌کند (TOO_FAR_AHEAD) و تست چیزِ اشتباهی را می‌سنجد.
            restaurantId: r.id, date: soonISO(), time: '20:00', partySize: 2,
            guest: { name: '[DEMO] قربانیِ deadlock' }, source: 'manual', notifySms: false,
          } as never,
          { acquireSlotLock: (async () => { throw deadlock; }) as never },
        ),
        (e: any) => {
          // ادعا: خطای **دامنه‌ای** با کدِ شناخته‌شده، نه خطای خامِ Postgres.
          assert.ok(e?.code, `خطای خام بیرون آمد (بدونِ code) ⇒ errorResponse یک ۵۰۰ می‌دهد: ${e?.message}`);
          assert.equal(e.code, 'CONCURRENCY_RETRY',
            `deadlock باید CONCURRENCY_RETRY بدهد، نه «${e.code}»`);
          assert.equal(e.status, 409, 'و کدِ HTTPش باید ۴۰۹ باشد، نه ۵۰۰');
          return true;
        },
      );
    } finally {
      await db.table.deleteMany({ where: { restaurantId: r.id } });
      await db.restaurant.delete({ where: { id: r.id } });
      await db.tenant.delete({ where: { id: t.id } });
    }
  });
});
