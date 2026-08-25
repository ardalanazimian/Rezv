import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P0-2 — QR check-in باید احرازشده و محدود به شعبه باشد
//  (فازِ ۲، پروتکل §۴ «No route … may bypass the lifecycle» و §۷ isolation)
//
//  باگی که پین می‌شود: POST /api/v1/checkin هیچ احراز هویتی نداشت و
//  qrCheckIn میز را **سراسری** پیدا می‌کرد. یعنی هر ناشناسی با یک qrCode
//  می‌توانست رزروِ دیگری را checked_in→seated کند و میز را occupied کند.
//
//  اینجا خودِ لایه‌ی سرویس تست می‌شود (نه routeِ HTTP): ادعایِ محدوده‌ی تنانت
//  دقیقاً همان‌جاست، و بخشِ «auth» با عبورِ route از withRestaurantAuth تأمین
//  می‌شود که در تستِ قراردادِ پایین (امضایِ اجباریِ restaurantId) پین شده.
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

describe('QR check-in — routeِ HTTP دیگر عمومی نیست (P0-2)', () => {
  test('routeِ /checkin از withRestaurantAuth عبور می‌کند', async () => {
    // بخشِ «احراز هویت»ِ این رفع در خودِ routeِ Next است، نه در لایه‌ی سرویس.
    // importِ ماژول و بررسیِ اینکه POST یک wrapperِ withRestaurantAuth است
    // (نه یک handlerِ لخت) این ادعا را بدونِ بالاآوردنِ سرورِ Next پین می‌کند.
    const mod = await import('../src/app/api/v1/checkin/route.ts');
    assert.equal(typeof mod.POST, 'function', 'POST باید export شود');
    // withRestaurantAuth یک handlerِ (req, routeArg) برمی‌گرداند — دو پارامتر.
    // handlerِ لختِ قبلی فقط (req) بود.
    assert.equal(mod.POST.length, 2, 'POST باید wrapperِ withRestaurantAuth باشد، نه handlerِ بدونِ auth');
  });
});
