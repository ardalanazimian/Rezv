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

  test('✓ کنترلِ منفی — ترتیبِ پایه واقعاً بر `created_at` است', async () => {
    // یعنی قاعده‌ی پایه واقعاً «قدیمی‌ترین» است، نه «هرچه به قربانی می‌خورد».
    // گاردی که فقط سخت‌گیرتر شده باشد اینجا می‌افتد.
    //
    // ⚠️ به‌روزشده ۲۰۲۶-۰۹-۱۱: «قدیمی‌ترین» دیگر **تنها** قاعده نیست — ردیفِ
    // `owner` بر هر ردیفِ دیگری مقدم شد (describeِ پایینِ همین فایل). این
    // ادعا عمداً سرِ جایش ماند چون لایه‌ی زیرین را می‌سنجد: ترتیبِ بینِ
    // ردیف‌های هم‌رده هنوز زمانی است، نه heap.
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

// ═══════════════════════════════════════════════════════════════════════
//  squattingِ شماره — «قدیمی‌ترین» به‌تنهایی کافی نبود (۲۰۲۶-۰۹-۱۱)
//
//  ⚠️ آنچه مهاجرتِ ۰۷۲ رفع کرد **قطعیت** بود، نه **درستی**: اگر مهاجم شماره
//  را *پیش از* قربانی ثبت کند، «قدیمی‌ترین برنده است» دقیقاً همان چیزی است
//  که ردیفِ مهاجم را برنده می‌کند. و ثبتِ زودتر هیچ هزینه‌ای ندارد —
//  `POST /restaurant/staff` اثباتِ مالکیتِ شماره نمی‌خواهد.
//
//  دو آسیبِ همزمان که این بلوک هر دو را پین می‌کند:
//   ۱. مالکِ واقعیِ آینده هرگز نمی‌توانست وارد شود (OTPش به ردیفِ مهاجم
//      می‌رسید).
//   ۲. provisioningِ همان شماره هم برای همیشه با `duplicate_owner_phone`
//      بسته می‌ماند، چون چکِ تعارض **هر** ردیفِ staff را می‌دید.
//
//  قاعده‌ی تازه: ردیفِ `owner` مقدم است؛ بینِ بقیه همان «قدیمی‌ترین».
// ═══════════════════════════════════════════════════════════════════════
describe('ورودِ کارکنان — ردیفِ owner بر squatterِ قدیمی‌تر مقدم است', () => {
  const SQ_PHONE = fixturePhone('0926');
  let squatterTenant = '';
  let ownerTenant = '';
  let squatterStaffId = '';
  let ownerStaffId = '';

  before(async () => {
    const s = Date.now().toString(36);
    const st = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-squatter-${s}` }, select: { id: true } });
    squatterTenant = st.id;
    // ⚠️ ثبتِ مهاجم عمداً **قدیمی‌تر** است — دقیقاً حالتی که قاعده‌ی قبلی
    //    به او می‌باخت. بدونِ این backdate، تست روی کدِ آسیب‌پذیر هم سبز
    //    می‌ماند و هیچ‌چیزی را قفل نمی‌کند.
    const squatter = await db.staff.create({
      data: {
        tenantId: squatterTenant, phone: normalizePhone(SQ_PHONE), name: '[DEMO] squatter',
        role: 'staff', isActive: true, createdAt: new Date('2020-01-01T00:00:00Z'),
      },
      select: { id: true },
    });
    squatterStaffId = squatter.id;

    const ot = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-owner-${s}` }, select: { id: true } });
    ownerTenant = ot.id;
    const owner = await db.staff.create({
      data: {
        tenantId: ownerTenant, phone: normalizePhone(SQ_PHONE), name: '[DEMO] مالکِ واقعی',
        role: 'owner', isActive: true,
      },
      select: { id: true },
    });
    ownerStaffId = owner.id;
  });

  after(async () => {
    await db.staff.deleteMany({ where: { phone: normalizePhone(SQ_PHONE) } }).catch(() => {});
    await db.tenant.deleteMany({ where: { id: { in: [squatterTenant, ownerTenant] } } }).catch(() => {});
  });

  test('🔴 ردیفِ owner برنده است، هرچند سال‌ها دیرتر ثبت شده', async () => {
    const found = await findStaffForLogin(normalizePhone(SQ_PHONE));
    assert.ok(found, 'کارمند باید پیدا شود');
    assert.equal(found.id, ownerStaffId, 'ردیفِ owner باید برنده باشد، نه squatterِ قدیمی‌تر');
    assert.equal(found.tenantId, ownerTenant, 'توکن باید برایِ تنانتِ مالکِ واقعی صادر شود');
    assert.equal(found.role, 'owner');
  });

  test('✓ کنترلِ مثبت — squatter واقعاً قدیمی‌تر است (قاعده‌ی قبلی به او می‌باخت)', async () => {
    // بدونِ این، «owner برنده شد» می‌توانست فقط تصادفِ ترتیبِ زمانی باشد و
    // تستِ بالا هیچ‌چیزِ تازه‌ای را قفل نمی‌کرد.
    const rows = await db.staff.findMany({
      where: { phone: normalizePhone(SQ_PHONE) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, squatterStaffId, 'قدیمی‌ترین ردیف باید مالِ squatter باشد');
  });

  test('⚠️ باقی‌مانده‌ی صادقانه — بدونِ هیچ ردیفِ owner، قدیمی‌ترینِ اثبات‌نشده برنده است', async () => {
    // این حالت **رفع نشده** و عمداً هم ثبت می‌شود، نه پنهان: هیچ سیگنالِ
    // «این شماره اثبات شد» به‌ازای ردیفِ staff وجود ندارد
    // (`POST /restaurant/staff` اصلاً StaffInvite نمی‌سازد؛ تنها سازنده‌اش
    // provisioning است). محدودکردنِ جست‌وجو به «دعوتِ پذیرفته‌شده» ورودِ
    // همه‌ی کارکنانِ عادی را می‌کشت. رفعِ کامل = فلوی دعوت برای staff هم.
    //
    // اگر روزی آن فلو ساخته شد، این تست باید **بشکند** و ادعایش برعکس شود.
    const noOwnerPhone = fixturePhone('0926');
    const t1 = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-nownr-a` }, select: { id: true } });
    const t2 = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-nownr-b` }, select: { id: true } });
    try {
      const first = await db.staff.create({
        data: {
          tenantId: t1.id, phone: normalizePhone(noOwnerPhone), role: 'staff', isActive: true,
          name: '[DEMO] اثبات‌نشده‌ی قدیمی', createdAt: new Date('2021-01-01T00:00:00Z'),
        },
        select: { id: true },
      });
      await db.staff.create({
        data: {
          tenantId: t2.id, phone: normalizePhone(noOwnerPhone), role: 'staff', isActive: true,
          name: '[DEMO] اثبات‌نشده‌ی تازه',
        },
        select: { id: true },
      });

      const found = await findStaffForLogin(normalizePhone(noOwnerPhone));
      assert.equal(found?.id, first.id, 'بدونِ ردیفِ owner، قاعده همان «قدیمی‌ترین» می‌ماند');
    } finally {
      await db.staff.deleteMany({ where: { phone: normalizePhone(noOwnerPhone) } }).catch(() => {});
      await db.tenant.deleteMany({ where: { id: { in: [t1.id, t2.id] } } }).catch(() => {});
    }
  });
});
