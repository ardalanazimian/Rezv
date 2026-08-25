import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ باگِ «حذفِ میزِ دارایِ رزروِ فعال» (فازِ ۲، پروتکل §۶)
//
//  باگِ واقعیِ کشف‌شده (توسطِ گاردِ ایستایِ lifecycle-exclusivity.test.mts):
//  گاردِ DELETE در app/api/v1/restaurant/tables/[id]/route.ts لیستِ وضعیت‌هایِ
//  «فعال» را دستی نوشته بود و سه وضعیت را جا انداخته بود:
//      preparing · running_late · arrived
//  یعنی میزی که رزروش در حالِ آماده‌سازی بود، یا مهمانش دیر کرده بود، یا
//  رسیده بود، **قابلِ حذف** بود و رزرو یتیم می‌شد — دقیقاً همان چیزی که
//  کامنتِ خودِ آن تابع ادعا می‌کند جلویش را می‌گیرد.
//
//  این همان کلاسِ باگِ C1 است که lib/reservation-status.ts برایِ ریشه‌کن‌کردنش
//  ساخته شد. هدرِ آن فایل «گاردِ حذف میز» را جزوِ جاهایِ اصلاح‌شده نام می‌برد،
//  ولی در عمل این یکی اصلاح نشده بود — یعنی خودِ سندِ درون‌کد هم گمراه‌کننده بود.
//
//  این تست رفتار را می‌سنجد (نه شکلِ کد را) و برایِ **هر ۹ وضعیتِ فعال**
//  جداگانه چک می‌کند، تا افتادنِ دوباره‌ی هر کدام فوراً دیده شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { ACTIVE_RESERVATION_STATUSES } = await import('../src/lib/reservation-status.ts');
const { DELETE } = await import('../src/app/api/v1/restaurant/tables/[id]/route.ts');
const { signAccess } = await import('../src/lib/jwt.ts');

let tenantId: string;
let restaurantId: string;
let staffId: string;
let token: string;

before(async () => {
  const suffix = Date.now();
  const tenant = await db.tenant.create({ data: { name: '[DEMO] tenant (table-delete-guard test)' } });
  tenantId = tenant.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `tdg-${suffix}`, name: '[DEMO] رستورانِ تستِ حذفِ میز', clubPrefix: 'TDG' },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: { tenantId, phone: `0919${String(suffix).slice(-7)}`, role: 'owner', restaurantId: null },
  });
  staffId = staff.id;
  token = signAccess({ sub: staffId, kind: 'staff', role: 'owner', tenantId });
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

/** یک میز + یک رزرو در وضعیتِ دلخواه می‌سازد و تلاشِ حذفِ میز را برمی‌گرداند. */
async function attemptDeleteWithReservationInStatus(status: string, seq: number) {
  const table = await db.table.create({
    data: { restaurantId, number: 900 + seq, capacity: 4, qrCode: `tdg-qr-${seq}-${Date.now()}` },
  });
  const start = new Date(Date.now() + 3600_000);
  const end = new Date(+start + 90 * 60_000);
  await db.reservation.create({
    data: {
      restaurantId, tableId: table.id,
      code: `RZTDG${String(seq).padStart(2, '0')}`,
      guestName: '[DEMO] مهمانِ تست', guestPhone: '+989120000000',
      partySize: 2, slotStart: start, slotEnd: end,
      status: status as never,
    },
  });
  // ⚠️ هر درخواست IPِ مجزا می‌گیرد. بدونِ این، همه‌ی ۱۱ فراخوانیِ این فایل
  // (به‌علاوه‌ی بقیه‌ی تست‌هایِ سوئیت) در یک سطلِ ریت‌لیمیتِ مشترک می‌افتند و
  // آخری‌ها ۴۲۹ می‌گیرند — که به‌اشتباه شبیهِ رگرسیونِ منطقِ گارد به‌نظر می‌رسد.
  // این یک واقعیتِ محیطِ تست است، نه تخفیفِ ادعا: خودِ assertion دست‌نخورده.
  const res = await DELETE(
    new Request(`https://example.test/api/v1/restaurant/tables/${table.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'x-real-ip': `10.90.0.${seq % 250}` },
    }),
    { params: Promise.resolve({ id: table.id }) },
  );
  const stillThere = await db.table.findUnique({ where: { id: table.id } });
  return { status: res.status, tableSurvived: !!stillThere };
}

describe('گاردِ حذفِ میز — همه‌ی وضعیت‌هایِ فعال (§۶)', () => {
  // هر ۹ وضعیتِ فعال باید حذف را رد کنند. سه‌تایشان (preparing، running_late،
  // arrived) پیش از رفع واقعاً از گارد رد می‌شدند.
  ACTIVE_RESERVATION_STATUSES.forEach((st, i) => {
    test(`میز با رزروِ «${st}» نباید حذف شود`, async () => {
      const r = await attemptDeleteWithReservationInStatus(st, i + 1);
      assert.notEqual(r.status, 200, `حذفِ میز با رزروِ ${st} باید رد شود`);
      assert.ok(r.tableSurvived, `میز با رزروِ ${st} نباید از دیتابیس حذف شده باشد`);
    });
  });

  test('میزِ بدونِ رزروِ فعال قابلِ حذف است (گارد نباید بیش از حد سخت‌گیر باشد)', async () => {
    // رگرسیونِ معکوس: رفعِ باگ نباید قابلیتِ حذفِ میز را از کار بیندازد.
    const r = await attemptDeleteWithReservationInStatus('completed', 90);
    assert.equal(r.status, 200, 'رزروِ تکمیل‌شده نباید مانعِ حذفِ میز شود');
    assert.equal(r.tableSurvived, false, 'میز باید واقعاً حذف شده باشد');
  });

  test('میزِ رزروِ لغوشده هم قابلِ حذف است', async () => {
    const r = await attemptDeleteWithReservationInStatus('cancelled', 91);
    assert.equal(r.status, 200);
    assert.equal(r.tableSurvived, false);
  });
});
