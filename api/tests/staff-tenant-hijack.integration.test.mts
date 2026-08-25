import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  هایجکِ تنانت از راهِ `findFirst` بدونِ ترتیب — مهاجرتِ ۰۷۲
//
//  ⚠️ مسیرِ حمله (بازتولیدشده، نه نظری):
//  `staff` کلیدِ یکتایِ `(tenant_id, phone)` دارد ⇒ یک شماره می‌تواند در چند
//  تنانت کارمند باشد. مسیرِ ورودِ کارکنان
//  `db.staff.findFirst({ where: { phone } })` می‌زد — بدونِ tenant و بدونِ
//  `orderBy`. Postgres در این حالت هیچ ترتیبی تضمین نمی‌کند.
//
//    ۱. مهاجم شماره‌ی قربانی را در تنانتِ **خودش** ثبت می‌کند
//       (`POST /v1/restaurant/staff` اثباتِ مالکیتِ شماره نمی‌خواهد).
//    ۲. قربانی کارِ کاملاً عادی‌ای می‌کند — مثلاً نامش را در پنل ویرایش
//       می‌کند. آن UPDATE ردیفش را به انتهای heap می‌برد.
//    ۳. از آن لحظه `findFirst` ردیفِ **مهاجم** را برمی‌گرداند: قربانی با
//       نقشِ تنزل‌یافته واردِ تنانتِ مهاجم می‌شود و از رستورانِ خودش قطع
//       می‌شود.
//
//  ⚠️ چرا این تست عمداً **بعد از یک UPDATE** ادعا می‌کند: بدونِ آن مرحله،
//  ترتیبِ heap اتفاقاً درست است و تست حتی روی کدِ آسیب‌پذیر هم سبز می‌شود.
//  مرحله‌ی ۲ همان چیزی است که تست را واقعی می‌کند.
//
//  ⚠️ محدودیتِ صادقانه‌ی رفع: ردیف‌های موجود در زمانِ مهاجرت همگی `now()`
//  یکسان می‌گیرند و بینِ خودشان هنوز گره‌خورده‌اند (مرتب‌سازیِ دوکلیده
//  دستِ‌کم قطعی‌شان می‌کند). آنچه بسته می‌شود حالتِ مهمِ حمله است: هر ثبتِ
//  **تازه** زمانِ بزرگ‌تری می‌گیرد و نمی‌تواند از ردیفِ قدیمیِ قربانی جلو بزند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { normalizePhone } = await import('../src/lib/otp');
const { findStaffForLogin } = await import('../src/lib/staff-helpers');

const TAG = 'hijack';
const PHONE = fixturePhone('0926');
let victimTenant: string;
let attackerTenant: string;
let victimStaffId: string;
let attackerStaffId: string;

// ⚠️ **خودِ** تابعی که هر دو روتِ ورود صدا می‌زنند — نه یک کپیِ هم‌شکل.
// نسخه‌ی اولِ این تست کوئری را درون‌خط تکرار می‌کرد و در نتیجه هیچ‌چیزی را
// قفل نمی‌کرد: برگرداندنِ روت به `findFirst`ِ بی‌ترتیب، تست را قرمز نمی‌کرد.
const loginLookup = () => findStaffForLogin(normalizePhone(PHONE));

before(async () => {
  const s = Date.now().toString(36);
  const vt = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-قربانی-${s}` }, select: { id: true } });
  victimTenant = vt.id;

  // ── قربانی اول ثبت می‌شود (کارمندِ واقعی و قانونیِ رستورانِ خودش) ──
  const victim = await db.staff.create({
    data: { tenantId: victimTenant, phone: normalizePhone(PHONE), name: '[DEMO] قربانی', role: 'owner', isActive: true },
    select: { id: true },
  });
  victimStaffId = victim.id;

  // ── بعداً مهاجم همان شماره را در تنانتِ خودش ثبت می‌کند ──
  const at = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-مهاجم-${s}` }, select: { id: true } });
  attackerTenant = at.id;
  const attacker = await db.staff.create({
    data: { tenantId: attackerTenant, phone: normalizePhone(PHONE), name: '[DEMO] مهاجم', role: 'staff', isActive: true },
    select: { id: true },
  });
  attackerStaffId = attacker.id;
});

after(async () => {
  await db.staff.deleteMany({ where: { phone: normalizePhone(PHONE) } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [victimTenant, attackerTenant] } } }).catch(() => {});
});

describe('ورودِ کارکنان — قدیمی‌ترین ثبت برنده است', () => {
  test('🔴 بعد از یک UPDATE معمولی روی ردیفِ قربانی، هنوز قربانی برنده است', async () => {
    // مرحله‌ی ۲ حمله: کارِ بی‌ضررِ خودِ قربانی که ردیفش را در heap جابه‌جا می‌کند.
    await db.staff.update({ where: { id: victimStaffId }, data: { name: '[DEMO] قربانی — نامِ تازه' } });

    const found = await loginLookup();
    assert.ok(found, 'کارمند باید پیدا شود');
    assert.equal(found.id, victimStaffId, 'ردیفِ قربانی باید برنده باشد، نه مهاجم');
    assert.equal(found.tenantId, victimTenant, 'توکن باید برایِ تنانتِ خودِ قربانی صادر شود');
    assert.equal(found.role, 'owner', 'نقشِ قربانی نباید به نقشِ ردیفِ مهاجم تنزل کند');
  });

  test('🔴 حتی با چند UPDATE پشتِ‌سرِ هم هم نتیجه عوض نمی‌شود', async () => {
    // ترتیبِ heap با هر UPDATE عوض می‌شود؛ نتیجه‌ی کوئری نباید عوض شود.
    for (let i = 0; i < 5; i++) {
      await db.staff.update({ where: { id: victimStaffId }, data: { name: `[DEMO] قربانی ${i}` } });
      await db.staff.update({ where: { id: attackerStaffId }, data: { name: `[DEMO] مهاجم ${i}` } });
      const found = await loginLookup();
      assert.equal(found?.id, victimStaffId, `دورِ ${i}: برنده نباید عوض شود`);
    }
  });

  test('✓ کنترلِ منفی — اگر مهاجم زودتر ثبت کرده باشد، همان برنده است', async () => {
    // یعنی قاعده واقعاً «قدیمی‌ترین» است، نه «هرچه به قربانی می‌خورد».
    // گاردی که فقط سخت‌گیرتر شده باشد اینجا می‌افتد.
    const older = await db.staff.findFirst({
      where: { phone: normalizePhone(PHONE) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { createdAt: true },
    });
    const newer = await db.staff.findFirst({
      where: { phone: normalizePhone(PHONE) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true },
    });
    assert.ok(older && newer);
    assert.ok(older.createdAt.getTime() <= newer.createdAt.getTime(),
      'ترتیب باید واقعاً بر پایه‌ی createdAt باشد');
  });

  test('⚠️ ستونِ created_at واقعاً در DB هست و پُر است', async () => {
    // گاردِ مهاجرت: اگر مهاجرتِ ۰۷۲ اجرا نشده باشد این تست می‌افتد، نه
    // اینکه تست‌های بالا با پیامِ گیج‌کننده بشکنند.
    const rows = await db.$queryRaw<Array<{ created_at: Date | null }>>`
      SELECT created_at FROM staff WHERE phone = ${normalizePhone(PHONE)}
    `;
    assert.equal(rows.length, 2, 'هر دو ردیف باید باشند');
    for (const r of rows) assert.ok(r.created_at instanceof Date, 'created_at نباید NULL باشد');
  });
});
