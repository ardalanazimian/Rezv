import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ امتیاز فقط-افزودنی است — RT-22 (رد تیم `rezv-b5`) و حکمِ Founder FP-009
//
//  مهاجرتِ ۰۸۸ شکلِ **نوشتن** را بست (delta منفی فقط با redemption/cashback).
//  ولی موجودی یک ستون نیست، `SUM(delta)` است — پس کم‌کردنش اصلاً به ردیفِ منفی
//  نیاز ندارد. رد تیم روی DBِ زنده اندازه گرفت (با کنترلِ مثبتی که نشان می‌داد
//  CHECKِ ۰۸۸ واقعاً شلیک می‌کند):
//
//    DELETE … WHERE created_at < now() - INTERVAL '1 year' AND delta > 0   → ۱۷۵ → ۲۵
//    UPDATE … SET delta = 0 WHERE created_at < now() - INTERVAL '1 year'   → ۱۷۵ → ۲۵
//
//  مهاجرتِ ۰۸۹ سه تریگر می‌گذارد: UPDATE، DELETE (بی‌استثنا — نه الگوی «والد رفته»ی
//  ۰۸۲) و TRUNCATE (سطحِ statement، چون تریگرِ سطحِ‌ردیف روی TRUNCATE شلیک نمی‌کند).
//  FK عمداً روی RESTRICT می‌ماند: مسیرِ cascade ساخته نمی‌شود، چون «حذفِ کاربر و
//  ساختنِ دوباره» همان حمله‌ی DELETE با لباسِ دیگر است (FP-009).
//
//  ⚠️ این فایل روی **رفتارِ دیتابیس** می‌ایستد، نه شکلِ کد — و عمداً هیچ‌جا
//  `session_replication_role` را دست نمی‌زند: آن تنظیم همه‌ی تریگرهای کاربر را
//  خاموش می‌کند، پس تستی که آن را ست کند چیزی درباره‌ی این گاردها ثابت نمی‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

// ⚠️ پیشوندِ ۰۹۹۰ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن (tests/_phone.helper.mts).
const PHONE_PREFIX = '0990';

let userId = '';

/** شکستی که واقعاً از تریگرهای ۰۸۹ بیاید، نه از FK یا چیزِ دیگر. */
async function rejectsAppendOnly(fn: () => Promise<unknown>, label: string) {
  let caught: unknown = null;
  try { await fn(); } catch (e) { caught = e; }
  assert.ok(caught, `${label}: باید رد می‌شد ولی انجام شد — دفتر فقط-افزودنی نیست`);
  assert.match(String((caught as Error)?.message ?? caught), /فقط-افزودنی|حذف از points_ledger|TRUNCATE روی points_ledger/,
    `${label}: رد شد ولی نه با پیامِ تریگرهای ۰۸۹ — علتِ دیگری است و ادعا سنجیده نشد`);
}

const balanceOf = async (uid: string) =>
  (await db.pointsLedger.aggregate({ where: { userId: uid }, _sum: { delta: true } }))._sum.delta ?? 0;

before(async () => {
  const u = await db.user.create({
    data: { phone: fixturePhone(PHONE_PREFIX), firstName: '[DEMO]', lastName: 'فقط-افزودنی' },
    select: { id: true },
  });
  userId = u.id;
  // ردیف‌های «کهنه» — عیناً همان چیزی که یک کرونِ انقضا هدف می‌گیرد.
  await db.pointsLedger.createMany({
    data: [
      { userId, delta: 100, reason: 'signup', note: '[DEMO] کهنه', createdAt: new Date(Date.now() - 400 * 86_400_000) },
      { userId, delta: 50, reason: 'reservation', note: '[DEMO] کهنه', createdAt: new Date(Date.now() - 400 * 86_400_000) },
      { userId, delta: 25, reason: 'reservation', note: '[DEMO] تازه' },
    ],
  });
});

// ⚠️ **هیچ پاک‌سازی‌ای نیست، و این عمدی است.** از ۰۸۹ حذفِ ردیفِ دفتر ممکن نیست و
// FK هم حذفِ کاربرِ دارای امتیاز را رد می‌کند. ردیف‌های `[DEMO]` در دیتابیسِ تست
// می‌مانند — دیتابیسِ هر اجرا تازه ساخته می‌شود. درِ فرارِ تستی ساخته نشد (FP-009 §۴).
after(async () => { /* عمداً خالی */ });

describe('points_ledger فقط-افزودنی (مهاجرتِ ۰۸۹ — RT-22 · FP-009)', () => {
  // ⚠️ قاعده‌ی پروبِ تریگری (FP-009 §۶، از خودافشاییِ Red Team): در حالتِ
  // `replica` همه‌ی تریگرهای کاربر خاموش‌اند، پس هر «سبز»ی در آن حالت **هیچ**
  // اثبات نمی‌کند. این کنترل اول می‌آید تا سبزِ بقیه معنا داشته باشد.
  test('کنترلِ روش: نشست در حالتِ replica نیست (وگرنه تریگرها خاموش‌اند)', async () => {
    const rows = await db.$queryRaw<{ role: string }[]>`SELECT current_setting('session_replication_role') AS role`;
    assert.equal(rows[0]?.role, 'origin',
      `session_replication_role = ${rows[0]?.role} — در این حالت تریگرها شلیک نمی‌کنند و ادعاهای این فایل تهی‌اند`);
  });

  test('کنترلِ موضوع: هر سه تریگر روی جدول هستند', async () => {
    const rows = await db.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'points_ledger'::regclass AND NOT tgisinternal ORDER BY tgname`;
    assert.deepEqual(rows.map((r) => r.tgname),
      ['points_ledger_no_delete', 'points_ledger_no_truncate', 'points_ledger_no_update'],
      'تریگرهای ۰۸۹ روی points_ledger نیستند — مهاجرت اعمال نشده');
  });

  test('🔴 جهشِ ۴ رد تیم: صفرکردنِ delta ردیف‌های کهنه رد می‌شود', async () => {
    const before = await balanceOf(userId);
    await rejectsAppendOnly(
      () => db.$executeRaw`UPDATE points_ledger SET delta = 0
             WHERE user_id = ${userId}::uuid AND created_at < now() - INTERVAL '1 year'`,
      'UPDATE … SET delta = 0 روی ردیف‌های کهنه',
    );
    assert.equal(await balanceOf(userId), before, 'موجودی نباید تکان خورده باشد');
  });

  test('🔴 جهشِ ۳ رد تیم: حذفِ ردیف‌های مثبتِ کهنه رد می‌شود', async () => {
    const before = await balanceOf(userId);
    await rejectsAppendOnly(
      () => db.$executeRaw`DELETE FROM points_ledger
             WHERE user_id = ${userId}::uuid AND created_at < now() - INTERVAL '1 year' AND delta > 0`,
      'DELETE ردیف‌های کهنه',
    );
    assert.equal(await balanceOf(userId), before, 'موجودی نباید تکان خورده باشد');
  });

  test('🔴 حذف از مسیرِ Prisma هم رد می‌شود — شکلِ کد بی‌اثر است', async () => {
    await rejectsAppendOnly(
      () => db.pointsLedger.deleteMany({ where: { userId } }),
      'pointsLedger.deleteMany',
    );
  });

  test('🔴 TRUNCATE هم رد می‌شود (تریگرِ سطحِ‌ردیف رویش شلیک نمی‌کند — پس statement-level لازم است)', async () => {
    await rejectsAppendOnly(
      () => db.$executeRawUnsafe('TRUNCATE TABLE points_ledger'),
      'TRUNCATE TABLE points_ledger',
    );
    assert.ok(await balanceOf(userId) > 0, 'ردیف‌ها باید سرِ جایشان باشند');
  });

  test('قاعده‌ی نگه‌داری: FK هنوز RESTRICT است — «حذفِ کاربر» راهِ پاک‌کردنِ دفتر نمی‌شود', async () => {
    // ⚠️ پیشنهادِ رد تیم (RT-24 §۳) و حکمِ FP-009: خطرناک‌ترین تغییرِ آینده یک خطِ
    // `ON DELETE CASCADE` است که کسی برای «رفعِ حذفِ کاربر» می‌نویسد و به‌عنوانِ
    // تغییرِ مالی بازبینی نمی‌شود. اگر این قرمز شد، آن تصمیم باید صریح گرفته شود.
    const rows = await db.$queryRaw<{ confdeltype: string }[]>`
      SELECT confdeltype::text FROM pg_constraint WHERE conname = 'points_ledger_user_id_fkey'`;
    assert.equal(rows[0]?.confdeltype, 'r',
      'FKِ دفتر باید RESTRICT بماند (r) — CASCADE یعنی حذفِ کاربر ردِ مالی را هم می‌برد');

    const v = await db.user.create({
      data: { phone: fixturePhone(PHONE_PREFIX), firstName: '[DEMO]', lastName: 'نگه‌داری' },
      select: { id: true },
    });
    await db.pointsLedger.create({ data: { userId: v.id, delta: 30, reason: 'signup', note: '[DEMO]' } });
    // ⚠️ M-09 (۲۰۲۶-۰۹-۱۶): آرگومانِ دوم پیش از این یک **رشته** بود — Node آن را پیامِ
    // خودِ assert می‌خواند، پس هر شکستی (مثلاً P2025ِ «ردیف پیدا نشد») تست را سبز
    // می‌کرد. هویتِ شکست حالا دقیقاً همان است که روی DBِ زنده اندازه گرفته شد:
    // P2003 روی `points_ledger_user_id_fkey`.
    await assert.rejects(() => db.user.delete({ where: { id: v.id } }),
      (e: unknown) => {
        const err = e as { code?: string; meta?: { field_name?: unknown } };
        return err.code === 'P2003' && String(err.meta?.field_name ?? '').startsWith('points_ledger_user_id_fkey');
      },
      'حذفِ کاربرِ دارای ردیفِ امتیاز باید با FKِ دفتر (P2003 روی points_ledger_user_id_fkey) رد شود — نه به هر دلیلِ دیگر');
  });

  test('کنترل: افزودنِ ردیفِ تازه همچنان کار می‌کند', async () => {
    const before = await balanceOf(userId);
    await db.pointsLedger.create({ data: { userId, delta: 7, reason: 'adjustment', note: '[DEMO] جبران' } });
    assert.equal(await balanceOf(userId), before + 7, 'دفترِ فقط-افزودنی باید افزودن را بپذیرد');
  });
});
