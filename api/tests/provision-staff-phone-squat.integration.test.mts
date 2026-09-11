import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  squattingِ شماره نباید provisioning را برای همیشه ببندد
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۹-۱۱): چکِ تعارضِ
//  `provisionBusiness` این بود —
//      db.staff.findFirst({ where: { phone } })
//  یعنی **هر** ردیفِ staff با آن شماره، با هر نقشی و در هر تنانتی. و
//  `POST /v1/restaurant/staff` هیچ اثباتِ مالکیتِ شماره نمی‌خواهد.
//
//  نتیجه: هرکس با یک حسابِ کسب‌وکارِ معمولی می‌توانست شماره‌ی یک مالکِ آینده
//  را به‌عنوانِ «کارمند» در تنانتِ خودش ثبت کند، و از آن لحظه ثبتِ کسب‌وکارِ
//  آن شماره **برای همیشه** با `duplicate_owner_phone` بسته می‌ماند —
//  انکارِ سرویس با هزینه‌ی یک POST، و بدونِ هیچ مسیرِ خودآزادسازی‌ای.
//
//  رفع: چک به `role: 'owner'` باریک شد. یکتاییِ ownerها را ایندکسِ یکتایِ
//  جزئیِ سراسریِ ۰۷۹ (`staff (phone) WHERE role='owner'`) تضمین می‌کند، پس
//  این باریک‌کردن هیچ ضمانتی را کم نمی‌کند — فقط fast-pathِ UX را درست می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { provisionBusiness } = await import('../src/lib/provisioning');
const { normalizePhone } = await import('../src/lib/otp');

const SFX = String(Date.now()).slice(-8);
const actor = { adminId: '00000000-0000-0000-0000-000000000001', ip: '127.0.0.1' };
const madeTenants: string[] = [];
const madePhones: string[] = [];

function input(phone: string, label: string) {
  madePhones.push(normalizePhone(phone));
  return {
    businessName: `[DEMO] squatِ شماره ${SFX}-${label}`,
    ownerPhone: phone,
    ownerName: '[DEMO] مالک',
    seedTables: 0,
  };
}

/** یک تنانتِ بی‌ربط که فقط یک ردیفِ staff با شماره‌ی هدف دارد (خودِ حمله). */
async function squat(phone: string, role: 'staff' | 'owner', label: string) {
  const t = await db.tenant.create({ data: { name: `[DEMO] squatter ${SFX}-${label}` }, select: { id: true } });
  madeTenants.push(t.id);
  madePhones.push(normalizePhone(phone));
  await db.staff.create({
    data: { tenantId: t.id, phone: normalizePhone(phone), role, isActive: true, name: '[DEMO] squatter' },
  });
  return t.id;
}

describe('provisionBusiness — تعارضِ شماره فقط با ownerِ واقعی', () => {
  test('🔴 ردیفِ staffِ بی‌اثبات دیگر جلویِ ثبتِ کسب‌وکار را نمی‌گیرد', async () => {
    const phone = fixturePhone('0929');
    await squat(phone, 'staff', 'a');

    const res = await provisionBusiness(input(phone, 'a'), actor);
    madeTenants.push(res.tenantId);

    // ⚠️ ادعا روی خودِ خروجی، نه فقط «throw نکرد»: باید واقعاً یک ownerِ تازه
    //    با همان شماره ساخته شده باشد.
    assert.equal(res.owner.phone, normalizePhone(phone));
    const owners = await db.staff.count({ where: { phone: normalizePhone(phone), role: 'owner' } });
    assert.equal(owners, 1, 'دقیقاً یک ردیفِ owner باید ساخته شده باشد');
  });

  test('✓ کنترلِ منفی — ownerِ واقعیِ تکراری همچنان ۴۰۹ِ duplicate_owner_phone می‌گیرد', async () => {
    // بدونِ این، «باریک‌کردنِ چک» می‌توانست به «برداشتنِ چک» تبدیل شده باشد و
    // حسابِ مرده بسازد (ownerِ دومی که هرگز نمی‌تواند وارد شود).
    const phone = fixturePhone('0929');
    await squat(phone, 'owner', 'b');

    await assert.rejects(
      () => provisionBusiness(input(phone, 'b'), actor),
      (e: any) => {
        assert.equal(e?.status, 409, `باید ۴۰۹ باشد — گرفت: ${e?.status} / ${e?.code}`);
        assert.equal(e?.details?.reason ?? e?.code, 'duplicate_owner_phone');
        return true;
      },
    );
  });
});

after(async () => {
  for (const t of madeTenants) {
    await db.staffInvite.deleteMany({ where: { staff: { tenantId: t } } }).catch(() => {});
    await db.staff.deleteMany({ where: { tenantId: t } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurant: { tenantId: t } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { tenantId: t } }).catch(() => {});
    await db.tenant.deleteMany({ where: { id: t } }).catch(() => {});
  }
  // ⚠️ ایندکسِ یکتایِ جزئیِ ۰۷۹ سراسری است؛ هر ردیفِ ownerِ جامانده اجرای
  //    بعدیِ همین فایل (یا هر فایلِ provisioning) را می‌شکند.
  for (const p of madePhones) {
    await db.staff.deleteMany({ where: { phone: p } }).catch(() => {});
  }
});
