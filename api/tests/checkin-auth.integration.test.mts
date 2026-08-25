import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P0-2 — QR check-in باید **محدود به شعبه** باشد
//  (فازِ ۲، پروتکل §۴ «No route … may bypass the lifecycle» و §۷ isolation)
//
//  باگی که پین می‌شود: qrCheckIn میز را **سراسری** پیدا می‌کرد؛ هیچ چکی نبود
//  که میز به رستورانِ زمینه‌ی فراخوان تعلق دارد. این فایل همان گاردِ
//  لایه‌ی سرویس را قفل می‌کند و دست‌نخورده معتبر است.
//
//  ⚠️ بازنگری‌شده: بخشِ «routeِ HTTP باید احرازِ کارمند بخواهد» از این فایل
//  برداشته شد، چون آن قرارداد اشتباه بود و قابلیت را می‌کشت. اسکن‌کننده
//  **مهمان** است، نه پرسنل (پنل اصلاً اسکنرِ QR ندارد)، و آن گارد یعنی
//  ۴۰۱/۴۰۳ برای تنها مصرف‌کننده‌ی موجود. مدلِ درست: بدونِ احراز هویتِ کاربر،
//  **با** اعتبارنامه‌ی ۵۰ بیتیِ QR + ریت‌لیمیتِ اختصاصی + عدمِ نشتِ کدِ رزرو.
//  قراردادِ جدیدِ routeِ HTTP در `qr-checkin.integration.test.mts` قفل شده و
//  همین‌جا هم یک گاردِ ساختاری برایش هست (پایین‌ترین describe).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { qrCheckIn } = await import('../src/lib/tables.ts');
const { ApiError } = await import('../src/lib/errors.ts');

let tenantId: string;
let restA: string;
let restB: string;
let tableAQr: string;

before(async () => {
  const suffix = Date.now();
  const tenant = await db.tenant.create({ data: { name: '[DEMO] tenant (checkin-auth test)' } });
  tenantId = tenant.id;

  const [a, b] = await Promise.all([
    db.restaurant.create({
      data: { tenantId, slug: `ci-a-${suffix}`, name: '[DEMO] رستورانِ A (checkin)', clubPrefix: 'CIA' },
    }),
    db.restaurant.create({
      data: { tenantId, slug: `ci-b-${suffix}`, name: '[DEMO] رستورانِ B (checkin)', clubPrefix: 'CIB' },
    }),
  ]);
  restA = a.id;
  restB = b.id;

  tableAQr = `qr-test-${suffix}`;
  await db.table.create({
    data: { restaurantId: restA, number: 1, capacity: 4, qrCode: tableAQr },
  });
});

after(async () => {
  await db.table.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('QR check-in — احراز هویت و محدوده‌ی شعبه (P0-2)', () => {
  test('میزِ رستورانِ دیگر → notFound، نه check-inِ متقاطع', async () => {
    // مهم‌ترین ادعا: قبل از رفع، qrCheckIn(qr) میز را سراسری پیدا می‌کرد و
    // رزرو را seated می‌کرد، صرف‌نظر از اینکه فراخوان به کدام شعبه دسترسی دارد.
    await assert.rejects(
      () => qrCheckIn(tableAQr, restB),
      (e: unknown) => {
        assert.ok(e instanceof ApiError, 'باید ApiError باشد');
        assert.equal(e.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('کدِ QRِ ناموجود → notFound (پیامِ یکسان، بدونِ لوِ وجود/عدمِ وجود)', async () => {
    await assert.rejects(
      () => qrCheckIn('qr-does-not-exist-at-all', restA),
      (e: unknown) => {
        assert.ok(e instanceof ApiError);
        assert.equal(e.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('میزِ خودی بدونِ رزروِ فعال → وضعیتِ میز، بدونِ جهشِ چرخه‌ی حیات', async () => {
    const r = await qrCheckIn(tableAQr, restA);
    assert.equal(r.table_number, 1);
    assert.equal(r.reservation_code, null, 'بدونِ رزروِ فعال نباید کدی برگردد');
  });

  test('قرارداد: qrCheckIn بدونِ restaurantId قابلِ فراخوانی نیست', () => {
    // گاردِ ساختاری: اگر کسی در آینده امضا را به حالتِ تک‌آرگومانیِ قبلی
    // برگرداند، این تست می‌شکند — یعنی محدوده‌ی تنانت نمی‌تواند بی‌صدا حذف شود.
    assert.equal(qrCheckIn.length, 2, 'qrCheckIn باید دقیقاً دو پارامترِ اجباری داشته باشد');
  });
});

describe('QR check-in — قراردادِ ساختاریِ routeِ HTTP', () => {
  test('routeِ /checkin شمرده می‌شود و گاردِ کارمند ندارد', async () => {
    // دو ادعا با هم، هر دو ساختاری و بدونِ بالاآوردنِ سرورِ Next:
    //
    //  ۱. POST از withApiMetrics رد می‌شود. با حذفِ گاردِ کارمند، تنها نقطه‌ی
    //     شمارشِ HTTPِ این مسیر هم می‌رفت — و مسیر بی‌صدا از آلارم‌های
    //     نرخِ خطا/تأخیر بیرون می‌افتاد.
    //  ۲. هیچ wrapperِ احرازِ کارمندی در منبع نمانده. اگر کسی دوباره آن را
    //     برگرداند، این تست می‌شکند و مجبور است تصمیم را آگاهانه بگیرد —
    //     چون همان کار قبلاً قابلیت را برای اپِ مشتری کشت.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/app/api/v1/checkin/route.ts', import.meta.url).pathname, 'utf8');

    const mod = await import('../src/app/api/v1/checkin/route.ts');
    assert.equal(typeof mod.POST, 'function', 'POST باید export شود');
    assert.match(src, /withApiMetrics\('\/api\/v1\/checkin'/, 'باید از withApiMetrics رد شود');
    assert.ok(
      !/with(Restaurant|Staff)Auth\(/.test(src),
      'گاردِ کارمند روی /checkin یعنی ۴۰۱/۴۰۳ برای مهمان — اسکن‌کننده مهمان است، نه پرسنل',
    );
  });
});
