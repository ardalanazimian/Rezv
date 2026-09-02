import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  نامِ کاربریِ تکراری = ۴۰۹ِ تمیز، در هر دو مسیر
//
//  ⚠️ چرا این فایل ساخته شد (نمونه‌گیریِ جهش V1، ۲۰۲۶-۰۸-۲۹): جهشِ
//      if (taken) throw Err.conflict('username_taken', …)  →  if (false) …
//  از همه‌ی تست‌های provisioning سالم رد شد.
//
//  بررسی نشان داد این **حفره‌ی امنیتی نبود**: ایندکسِ یکتای سطحِ دیتابیس
//  (`staff_username_key` — مهاجرتِ ۰۷۴) جلویِ رکوردِ تکراری را می‌گیرد. یعنی
//  افزونگی بود، مثلِ R4.
//
//  ولی یک **شکافِ قرارداد** بود: پیش‌بررسیِ اپلیکیشنی تنها چیزی است که
//  ۴۰۹ِ `username_taken` را می‌سازد. بدونش کاربر خطای خامِ P2002 می‌گیرد.
//  و هیچ تستی این قرارداد را پین نمی‌کرد.
//
//  این فایل هر دو مسیر را می‌بندد:
//    ۱. مسیرِ ترتیبی — پیش‌بررسی (V1 را می‌گیرد)
//    ۲. مسیرِ مسابقه‌ی همزمان — که تا امروز **واقعاً** خطای خام می‌داد و در
//       همین دور با `isUsernameUniqueViolation` رفع شد.
//
//  ── نتیجه‌ی جهش‌آزماییِ پس از رفع (ثبت شود، چون ظریف است) ──
//  پس از افزودنِ ترجمه، جهشِ V1 (برداشتنِ پیش‌بررسی) **همچنان زنده می‌ماند** —
//  و این‌بار درست است: هر دو مسیر حالا دقیقاً همان ۴۰۹ را می‌دهند، پس
//  پیش‌بررسی واقعاً یک بهینه‌سازیِ افزونه است، نه نگهدارنده‌ی قرارداد.
//  در عوض، جهشِ روی خودِ ترجمه (`if (isUsernameUniqueViolation(e))` →
//  `if (false)`) **گرفته می‌شود** (exit=1، ۴ تستِ قرمز). یعنی گارد حالا روی
//  لایه‌ای نشسته که همیشه اجرا می‌شود، و تست همان لایه را می‌سنجد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { provisionBusiness } = await import('../src/lib/provisioning');

const SFX = String(Date.now()).slice(-8);
const madeTenants: string[] = [];
const actor = { adminId: '00000000-0000-0000-0000-000000000001', ip: '127.0.0.1' };

function input(username: string, phoneSuffix: string) {
  return {
    businessName: `[DEMO] یکتاییِ نامِ کاربری ${SFX}-${phoneSuffix}`,
    ownerPhone: fixturePhone(phoneSuffix),
    ownerName: '[DEMO] مالک',
    username,
    password: 'Str0ng-Passw0rd!x',
    seedTables: 0,
  };
}

async function trackTenant(res: { tenantId: string }) {
  madeTenants.push(res.tenantId);
  return res;
}

describe('نامِ کاربریِ تکراری در provisionBusiness', () => {
  test('مسیرِ ترتیبی: دومین ثبت‌نام ۴۰۹ِ username_taken می‌گیرد، نه خطای خام', async () => {
    const uname = `demo_owner_${SFX}`;
    await trackTenant(await provisionBusiness(input(uname, '0971'), actor));

    await assert.rejects(
      () => provisionBusiness(input(uname, '0972'), actor),
      (e: any) => {
        assert.equal(e?.status, 409, `باید ۴۰۹ باشد — گرفت: ${e?.status} / ${e?.code}`);
        assert.equal((e?.details?.reason ?? e?.code), 'username_taken',
          `قراردادِ بیرونی: reason باید username_taken باشد — گرفت: ${e?.details?.reason ?? e?.code}`);
        assert.ok(!/P2002|Unique constraint/i.test(String(e?.message ?? '')),
          'خطای خامِ Prisma نباید به کاربر برسد');
        return true;
      },
    );
  });

  test('مسابقه‌ی همزمان: بازنده هم همان ۴۰۹ را می‌گیرد، نه P2002ِ خام', async () => {
    // هر دو درخواست پیش‌بررسی را هم‌زمان رد می‌کنند (هنوز رکوردی نیست)، پس
    // بازنده به ایندکسِ دیتابیس می‌خورد. این دقیقاً همان مسیری است که تا
    // امروز خطای خام می‌داد.
    const uname = `demo_race_${SFX}`;
    const settled = await Promise.allSettled([
      provisionBusiness(input(uname, '0973'), actor),
      provisionBusiness(input(uname, '0974'), actor),
    ]);

    const ok = settled.filter(s => s.status === 'fulfilled');
    const bad = settled.filter(s => s.status === 'rejected');

    assert.equal(ok.length, 1, 'دقیقاً یکی باید برنده شود');
    assert.equal(bad.length, 1, 'و دقیقاً یکی بازنده');
    for (const s of ok) await trackTenant((s as PromiseFulfilledResult<any>).value);

    const e: any = (bad[0] as PromiseRejectedResult).reason;
    assert.equal(e?.status, 409,
      `بازنده‌ی مسابقه باید ۴۰۹ بگیرد، نه ۵۰۰ — گرفت: ${e?.status} / ${e?.message}`);
    assert.equal((e?.details?.reason ?? e?.code), 'username_taken');
    assert.ok(!/P2002|Unique constraint/i.test(String(e?.message ?? '')),
      'خطای خامِ Prisma نباید به کاربر برسد');
  });

  test('کنترلِ مثبت: نامِ کاربریِ متفاوت پذیرفته می‌شود', async () => {
    // بدونِ این، گاردی که **هر** ثبت‌نامِ دومی را رد کند هم بالا را پاس می‌کرد.
    await trackTenant(await provisionBusiness(input(`demo_uniq_a_${SFX}`, '0975'), actor));
    await trackTenant(await provisionBusiness(input(`demo_uniq_b_${SFX}`, '0976'), actor));
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
  await db.$disconnect();
});
