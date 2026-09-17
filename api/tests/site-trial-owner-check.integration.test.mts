import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  I-1 (حکمِ D-23): فرمِ دمو فقط با **owner**ِ همان شماره رد می‌شود — نه با هر ردیفِ staff
//
//  یافته‌ی P1-4 / R2 (بازتولیدِ زنده، docs/audit/impl/P1-4-PACKAGE.md): `createTrialAccount` هر
//  ردیفِ staff با آن شماره را «حسابِ کسب‌وکارِ موجود» می‌گرفت. ولی `POST /restaurant/staff` هیچ
//  اثباتِ مالکیتِ شماره نمی‌خواهد؛ پس مالکِ هر تنانتی می‌توانست شماره‌ی کسی را کارمندِ خودش کند و
//  ثبت‌نامِ خودِ صاحبِ شماره را با ۴۲۲ «از همان شماره وارد پنل شوید» ببندد — و او را به ورودی بفرستد
//  که در تنانتِ مهاجم می‌نشیند.
//
//  همان شکلی که `provisioning.ts` در ۲۰۲۶-۰۹-۱۱ باریک کرد («حالا فقط تعارضِ واقعی: یک ownerِ دیگر
//  با همین شماره»). ضمانتِ واقعیِ یکتاییِ owner ایندکسِ جزئیِ ۰۷۹ است؛ این چک fast-pathِ UXِ آن است.
//
//  ⚠️ آنچه این فایل **نمی‌بندد** (مالِ گزینه‌ی A ی D-23): ورودِ OTPِ کسی که فقط عضویتِ پذیرفته‌نشده
//  دارد (R1/R3)، و ردیفِ ownerی که خودِ فرمِ بی‌OTPِ دمو برای شماره‌ی دیگری می‌سازد (R4).
// ═══════════════════════════════════════════════════════════════════════

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { normalizePhone } = await import('../src/lib/otp');
const { provisionBusiness } = await import('../src/lib/provisioning');
const { POST: addStaff } = await import('../src/app/api/v1/restaurant/staff/route.ts');
const { POST: trial } = await import('../src/app/api/v1/site/trial/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

// ⚠️ پیشوندهای ۰۹۹۶ (صاحبِ شماره) و ۰۹۹۷ (مالکِ تنانتِ دیگر) مالِ همین فایل‌اند.
const SFX = Math.random().toString(36).slice(2, 8);
const uip = () => `10.96.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const admin = { adminId: '00000000-0000-4000-8000-000000000001', ip: 'i1' };

function post(url: string, body: unknown, token?: string) {
  return new Request(`https://example.invalid${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-forwarded-for': uip(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function otherOwner(label: string) {
  const r = await provisionBusiness({ businessName: `[DEMO] i1 ${label} ${SFX}`, ownerPhone: fixturePhone('0997') } as any, admin);
  const owner = await db.staff.findFirstOrThrow({ where: { tenantId: r.tenantId, role: 'owner' }, select: { id: true } });
  return { tenantId: r.tenantId, token: signAccess({ sub: owner.id, kind: 'staff', tenantId: r.tenantId, role: 'owner' }) };
}

const trialBody = (phone: string, who: string) => ({ business_name: `[DEMO] دمو ${who} ${SFX}`, contact_name: `[DEMO] ${who}`, phone });

describe('I-1 — چکِ فرمِ دمو فقط owner را تعارض می‌داند', () => {
  test('🔴 شماره‌ای که تنانتِ دیگری بی‌اثبات «کارمند» کرده، هنوز می‌تواند دمو بسازد', async () => {
    const other = await otherOwner('staff-row');
    const phone = fixturePhone('0996');
    const add = await addStaff(post('/api/v1/restaurant/staff', { phone, role: 'manager' }, other.token));
    assert.equal(add.status, 201, 'پیش‌شرط: ردیفِ staffِ بی‌اثبات در تنانتِ دیگر ساخته شد');

    const res = await trial(post('/api/v1/site/trial', trialBody(phone, 'صاحبِ شماره')));
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 201, `دمو برای صاحبِ شماره رد شد: ${res.status} ${body?.error?.message ?? ''}`);

    const owners = await db.staff.findMany({ where: { phone: normalizePhone(phone), role: 'owner' }, select: { tenantId: true } });
    assert.equal(owners.length, 1, 'دقیقاً یک ownerِ تازه برای صاحبِ شماره');
    assert.notEqual(owners[0].tenantId, other.tenantId, 'owner باید در تنانتِ تازه‌ی خودش باشد، نه تنانتِ دیگر');
    const staffRow = await db.staff.count({ where: { phone: normalizePhone(phone), tenantId: other.tenantId, role: 'manager' } });
    assert.equal(staffRow, 1, 'ردیفِ تنانتِ دیگر دست‌نخورده می‌ماند (این رفع آن را پاک یا تأیید نمی‌کند)');
  });

  test('کنترل: شماره‌ای که **owner**ِ کسب‌وکارِ دیگری است، همچنان ۴۲۲ و راهنمای ورود می‌گیرد', async () => {
    const ownerPhone = fixturePhone('0996');
    await provisionBusiness({ businessName: `[DEMO] i1 owner ${SFX}`, ownerPhone } as any, admin);

    const res = await trial(post('/api/v1/site/trial', trialBody(ownerPhone, 'مالکِ موجود')));
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 422, `برای ownerِ موجود باید مثلِ قبل رد شود، گرفت ${res.status}`);
    assert.match(String(body?.error?.message ?? ''), /از همان شماره وارد پنل شوید/);
    assert.equal(await db.staff.count({ where: { phone: normalizePhone(ownerPhone), role: 'owner' } }), 1, 'ownerِ دوم ساخته نشد');
  });

  test('کنترل: درخواستِ دوباره‌ی همان دمو هنوز idempotent است (۲۰۰، بدونِ تنانتِ دوم)', async () => {
    const phone = fixturePhone('0996');
    const first = await trial(post('/api/v1/site/trial', trialBody(phone, 'تکرار')));
    assert.equal(first.status, 201);
    const again = await trial(post('/api/v1/site/trial', trialBody(phone, 'تکرار')));
    assert.equal(again.status, 200, 'ارسالِ دوباره‌ی فرم کسب‌وکارِ دوم نمی‌سازد');
    assert.equal(await db.staff.count({ where: { phone: normalizePhone(phone), role: 'owner' } }), 1);
  });
});
