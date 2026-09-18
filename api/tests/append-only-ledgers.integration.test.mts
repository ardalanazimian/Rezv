import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  هشت دفتر/لاگِ فقط-افزودنی — مهاجرتِ ۰۹۰ (RT-25 · AO-1..3ِ Red Team · FP-009 · D-16)
//
//  Red Team (`rezv-31`) روی DBِ زنده نشان داد از این هشت جدول فقط `reservation_events`
//  تریگر داشت و آن هم با `TRUNCATE` خالی می‌شد. این فایل رفتارِ **دیتابیس** را می‌سنجد،
//  نه شکلِ کد: هر عمل از مسیرِ SQLِ خام و (برای یک نمونه) Prisma امتحان می‌شود.
//
//  ⚠️ هر پروبِ مخرب داخلِ تراکنشی است که **همیشه** برمی‌گردد. اگر گاردی نباشد، پروب
//  به‌جای پاک‌کردنِ جدول برای بقیه‌ی سوئیت، فقط همین تست را قرمز می‌کند. (۰۸۹ این را
//  نداشت: TRUNCATEِ بی‌گارد کلِ points_ledgerِ سوئیت را می‌برد.)
//
//  ⚠️ هیچ پاک‌سازی‌ای نیست (FP-009 §۴): ردیف‌های `[DEMO]` می‌مانند؛ DBِ هر اجرا تازه است.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { fixturePhone } = await import('./_phone.helper.mts');
const { prunePlatformEvents } = await import('../src/lib/platform-events.ts');

// ⚠️ پیشوندِ ۰۹۹۳ مالِ همین فایل است (tests/_phone.helper.mts).
const PHONE_PREFIX = '0993';
const TAG = `ao090-${Date.now().toString(36)}`;
const DAY = 86_400_000;

const ALL_TABLES = [
  'reservation_events', 'audit_logs', 'platform_events', 'economy_ledger_entries',
  'sms_transactions', 'campaign_logs', 'coupon_redemptions', 'reward_redemptions',
] as const;
/** جدول‌هایی که UPDATEشان رد می‌شود با پیامِ مشترکِ ۰۹۰ (reservation_events پیامِ ۰۸۲ را دارد). */
const UPDATE_090 = ALL_TABLES.filter((t) => t !== 'reservation_events');
/** DELETEِ بی‌قید و شرط. */
const DELETE_UNCONDITIONAL = ['economy_ledger_entries', 'sms_transactions', 'campaign_logs', 'coupon_redemptions', 'reward_redemptions'] as const;

const ids = {
  tenant: '', restaurant: '', user: '', coupon: '', item: '', reservation: '',
  auditRecent: '', auditOld: '', eventRecent: '', eventOld: '', eventMid: '',
  lonelyRestaurant: '', smsOnlyRestaurant: '',
};

class ProbeWentThrough extends Error {}

/**
 * عملِ مخرب را داخلِ یک تراکنشِ همیشه-برگشتی اجرا می‌کند و **خطای دیتابیس** را برمی‌گرداند.
 * اگر عمل موفق شد، تست قرمز می‌شود — و به‌خاطرِ rollback هیچ ردیفی واقعاً نمی‌رود.
 */
async function rejectionOf(label: string, sql: string): Promise<string> {
  let caught: unknown = null;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(sql);
      throw new ProbeWentThrough(label);
    });
  } catch (e) { caught = e; }
  assert.ok(caught, `${label}: هیچ خطایی نیامد`);
  assert.ok(!(caught instanceof ProbeWentThrough),
    `${label}: انجام شد (و فقط به‌خاطرِ rollbackِ پروب برگشت) — جدول فقط-افزودنی نیست`);
  return String((caught as Error)?.message ?? caught);
}

const countWhere = async (table: string, where: string) =>
  Number((await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM ${table} WHERE ${where}`))[0].n);

before(async () => {
  const tenant = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  ids.tenant = tenant.id;
  const mkRest = async (suffix: string) => (await db.restaurant.create({
    data: { tenantId: tenant.id, slug: `${TAG}-${suffix}`, name: `[DEMO] ${TAG} ${suffix}`, clubPrefix: 'AO', timezone: 'Asia/Tehran', isOpen: true },
    select: { id: true },
  })).id;
  ids.restaurant = await mkRest('main');
  ids.lonelyRestaurant = await mkRest('lonely');
  ids.smsOnlyRestaurant = await mkRest('sms');

  ids.user = (await db.user.create({
    data: { phone: fixturePhone(PHONE_PREFIX), firstName: '[DEMO]', lastName: 'فقط-افزودنی' }, select: { id: true },
  })).id;
  ids.coupon = (await db.coupon.create({
    data: { restaurantId: ids.restaurant, code: `AO${Date.now().toString(36).toUpperCase()}`, kind: 'percent', value: 10 }, select: { id: true },
  })).id;
  ids.item = (await db.rewardMarketplaceItem.create({
    data: { title: `[DEMO] ${TAG}`, kind: 'coupon_grant', costCoins: 10, restaurantId: ids.restaurant }, select: { id: true },
  })).id;
  const slotStart = new Date(Date.now() + 3 * 3600_000);
  ids.reservation = (await db.reservation.create({
    data: {
      restaurantId: ids.restaurant, code: `${TAG}-${randomUUID().slice(0, 6)}`.toUpperCase(), partySize: 2,
      slotStart, slotEnd: new Date(slotStart.getTime() + 90 * 60_000), status: 'confirmed', source: 'app',
      userId: ids.user, guestName: '[DEMO] مهمان',
    },
    select: { id: true },
  })).id;

  // یک ردیف در هر جدول — تریگرِ سطحِ‌ردیف روی جدولِ خالی شلیک نمی‌کند، پس بدونِ ردیف ادعا توخالی است.
  await db.reservationEvent.create({ data: { reservationId: ids.reservation, toStatus: 'confirmed', actor: 'system', reason: `[DEMO] ${TAG}` } });
  ids.auditRecent = (await db.auditLog.create({ data: { action: `${TAG}.recent`, detail: { demo: true } }, select: { id: true } })).id;
  ids.auditOld = (await db.auditLog.create({
    data: { action: `${TAG}.old`, detail: { demo: true }, createdAt: new Date(Date.now() - 400 * DAY) }, select: { id: true },
  })).id;
  const ev = (ingestedAt: Date, label: string) => db.platformEvent.create({
    data: { type: `test.${TAG}.${label}`, occurredAt: ingestedAt, ingestedAt, source: 'backend', payload: { demo: true }, trustLevel: 'ANONYMOUS_CLIENT' },
    select: { id: true },
  });
  ids.eventRecent = (await ev(new Date(), 'recent')).id;
  ids.eventOld = (await ev(new Date(Date.now() - 100 * DAY), 'old')).id;
  ids.eventMid = (await ev(new Date(Date.now() - 60 * DAY), 'mid')).id;
  await db.economyLedgerEntry.create({ data: { userId: ids.user, kind: 'xp_earn', amount: 5, source: `[DEMO] ${TAG}` } });
  await db.smsTransaction.create({ data: { restaurantId: ids.restaurant, delta: 10, reason: 'admin_topup', balanceAfter: 10, note: '[DEMO]' } });
  await db.smsTransaction.create({ data: { restaurantId: ids.smsOnlyRestaurant, delta: 10, reason: 'admin_topup', balanceAfter: 10, note: '[DEMO]' } });
  await db.campaignLog.create({ data: { restaurantId: ids.restaurant, segment: 'all', message: `[DEMO] ${TAG}` } });
  await db.couponRedemption.create({ data: { couponId: ids.coupon, userId: ids.user, discountToman: 1000 } });
  await db.rewardRedemption.create({ data: { itemId: ids.item, userId: ids.user, coinsSpent: 10 } });
});

describe('دفترهای فقط-افزودنی (مهاجرتِ ۰۹۰)', () => {
  test('کنترلِ روش: نشست در حالتِ replica نیست (وگرنه تریگرها خاموش‌اند)', async () => {
    const rows = await db.$queryRaw<{ role: string }[]>`SELECT current_setting('session_replication_role') AS role`;
    assert.equal(rows[0]?.role, 'origin');
  });

  test('کنترلِ موضوع: هر جدول دقیقاً کلاس‌های رفتاریِ مورد انتظار را دارد (فعال)', async () => {
    // tgtype: 1=ROW · 2=BEFORE · 8=DELETE · 16=UPDATE · 32=TRUNCATE — سنجش با کلاس، نه نام.
    for (const t of ALL_TABLES) {
      const [row] = await db.$queryRawUnsafe<{ upd: number; del: number; trunc: number }[]>(`
        SELECT count(*) FILTER (WHERE (tgtype & 2) > 0 AND (tgtype & 1) > 0 AND (tgtype & 16) > 0)::int AS upd,
               count(*) FILTER (WHERE (tgtype & 2) > 0 AND (tgtype & 1) > 0 AND (tgtype & 8) > 0)::int AS del,
               count(*) FILTER (WHERE (tgtype & 2) > 0 AND (tgtype & 1) = 0 AND (tgtype & 32) > 0)::int AS trunc
        FROM pg_trigger WHERE tgrelid = '${t}'::regclass AND NOT tgisinternal AND tgenabled = 'O'`);
      assert.ok(row.upd >= 1, `${t}: تریگرِ فعالِ BEFORE UPDATE (ردیفی) نیست`);
      assert.ok(row.del >= 1, `${t}: تریگرِ فعالِ BEFORE DELETE (ردیفی) نیست`);
      assert.ok(row.trunc >= 1, `${t}: تریگرِ فعالِ BEFORE TRUNCATE (statement) نیست`);
    }
  });

  for (const t of UPDATE_090) {
    test(`🔴 UPDATE روی ${t} رد می‌شود`, async () => {
      assert.ok(await countWhere(t, 'true') > 0, `${t}: ردیفی برای شلیکِ تریگر نیست — پروب توخالی می‌شد`);
      // ستونِ id در همه‌ی هفت جدول هست؛ مقدارِ تازه همان است — یعنی حتی UPDATEِ «بی‌اثر» هم رد می‌شود.
      const msg = await rejectionOf(`UPDATE ${t}`, `UPDATE ${t} SET id = id`);
      assert.match(msg, new RegExp(`${t} فقط-افزودنی است: UPDATE مجاز نیست`), `${t}: رد شد ولی نه با پیامِ ۰۹۰`);
    });
  }

  test('🔴 UPDATE روی reservation_events همچنان با گاردِ ۰۸۲ رد می‌شود', async () => {
    const msg = await rejectionOf('UPDATE reservation_events', `UPDATE reservation_events SET reason = 'tampered' WHERE reservation_id = '${ids.reservation}'::uuid`);
    assert.match(msg, /reservation_events فقط-افزودنی است/);
  });

  for (const t of DELETE_UNCONDITIONAL) {
    test(`🔴 DELETE روی ${t} بی‌قید و شرط رد می‌شود`, async () => {
      const msg = await rejectionOf(`DELETE ${t}`, `DELETE FROM ${t}`);
      assert.match(msg, new RegExp(`${t} فقط-افزودنی است: DELETE مجاز نیست`));
    });
  }

  test('🔴 حذف از مسیرِ Prisma هم رد می‌شود — شکلِ کد بی‌اثر است', async () => {
    let caught: unknown = null;
    try {
      await db.$transaction(async (tx) => {
        await tx.smsTransaction.deleteMany({ where: { restaurantId: ids.restaurant } });
        throw new ProbeWentThrough('smsTransaction.deleteMany');
      });
    } catch (e) { caught = e; }
    assert.ok(caught && !(caught instanceof ProbeWentThrough), 'smsTransaction.deleteMany انجام شد');
    assert.match(String((caught as Error).message), /sms_transactions فقط-افزودنی است: DELETE مجاز نیست/);
  });

  for (const t of ALL_TABLES) {
    test(`🔴 TRUNCATE روی ${t} رد می‌شود (تریگرِ ردیفی رویش شلیک نمی‌کند)`, async () => {
      const msg = await rejectionOf(`TRUNCATE ${t}`, `TRUNCATE TABLE ${t}`);
      assert.match(msg, new RegExp(`${t} فقط-افزودنی است: TRUNCATE مجاز نیست`), `${t}: رد شد ولی نه با تریگرِ ۰۹۰`);
    });
  }

  test('🔴 audit_logs: ردیفِ جوان‌تر از ۱ سال حذف‌نشدنی است (ردِ بدهیِ RT-13)', async () => {
    const msg = await rejectionOf('DELETE audit_logs recent', `DELETE FROM audit_logs WHERE id = '${ids.auditRecent}'::uuid`);
    assert.match(msg, /audit_logs فقط-افزودنی است: حذفِ ردیفِ جوان‌تر از ۱ سال/);
  });

  test('کنترل: همان SQLِ retention (maintenance/retention/route.ts) ردیفِ قدیمی‌تر از ۱ سال را هنوز حذف می‌کند', async () => {
    assert.equal(await countWhere('audit_logs', `id = '${ids.auditOld}'::uuid`), 1, 'ردیفِ قدیمی باید پیش از retention باشد');
    await db.$executeRaw`DELETE FROM audit_logs WHERE created_at < now() - interval '1 year'`;
    assert.equal(await countWhere('audit_logs', `id = '${ids.auditOld}'::uuid`), 0, 'retention باید ردیفِ ۴۰۰روزه را حذف کند');
    assert.equal(await countWhere('audit_logs', `id = '${ids.auditRecent}'::uuid`), 1, 'ردیفِ تازه باید بماند');
  });

  test('🔴 platform_events: حذفِ ردیفِ جوان‌تر از ۹۰ روز (کفِ ingested_at) رد می‌شود', async () => {
    const msg = await rejectionOf('DELETE platform_events recent', `DELETE FROM platform_events WHERE id = '${ids.eventRecent}'::uuid`);
    assert.match(msg, /platform_events فقط-افزودنی است: حذفِ ردیفِ جوان‌تر از ۹۰ روز/);
  });

  test('🔴 platform_events: envِ retention کمتر از کف بلند شکست می‌خورد، نه زیرلایه را بخورد', async () => {
    const prev = process.env.TELEMETRY_RETENTION_ANON_DAYS;
    process.env.TELEMETRY_RETENTION_ANON_DAYS = '30';
    try {
      await assert.rejects(() => prunePlatformEvents(),
        (e: unknown) => /platform_events فقط-افزودنی است: حذفِ ردیفِ جوان‌تر از ۹۰ روز/.test(String((e as Error)?.message)),
        'هرس با کفِ ۳۰ روز باید روی ردیفِ ۶۰روزه با پیامِ ۰۹۰ بشکند');
    } finally {
      if (prev === undefined) delete process.env.TELEMETRY_RETENTION_ANON_DAYS; else process.env.TELEMETRY_RETENTION_ANON_DAYS = prev;
    }
    assert.equal(await countWhere('platform_events', `id = '${ids.eventMid}'::uuid`), 1, 'ردیفِ ۶۰روزه باید بماند');
  });

  test('کنترل: prunePlatformEvents با کوچک‌ترین ردیفِ شیپ‌شده (۹۰) ردیفِ ۱۰۰روزه را حذف می‌کند و ۶۰روزه را نه', async () => {
    const prev = process.env.TELEMETRY_RETENTION_ANON_DAYS;
    process.env.TELEMETRY_RETENTION_ANON_DAYS = '90';
    try {
      await prunePlatformEvents();
    } finally {
      if (prev === undefined) delete process.env.TELEMETRY_RETENTION_ANON_DAYS; else process.env.TELEMETRY_RETENTION_ANON_DAYS = prev;
    }
    assert.equal(await countWhere('platform_events', `id = '${ids.eventOld}'::uuid`), 0, 'ردیفِ ۱۰۰روزه باید هرس شود');
    assert.equal(await countWhere('platform_events', `id = '${ids.eventMid}'::uuid`), 1, 'ردیفِ ۶۰روزه نباید هرس شود');
  });

  test('D-16: FKِ sms_transactions روی RESTRICT است و حذفِ رستورانِ دارای دفترِ پیامک رد می‌شود', async () => {
    const [fk] = await db.$queryRaw<{ del: string; upd: string }[]>`
      SELECT confdeltype::text AS del, confupdtype::text AS upd FROM pg_constraint
      WHERE conname = 'sms_transactions_restaurant_id_fkey'`;
    assert.equal(fk?.del, 'r', 'ON DELETE باید RESTRICT باشد — CASCADE یعنی حذفِ رستوران دفترِ اعتبار را هم می‌برد');
    assert.equal(fk?.upd, 'c', 'ON UPDATE باید CASCADE باشد تا دو مسیرِ ساختِ اسکیما یکسان بمانند');
    await assert.rejects(() => db.restaurant.delete({ where: { id: ids.smsOnlyRestaurant } }),
      (e: unknown) => {
        const err = e as { code?: string; meta?: { field_name?: unknown } };
        return err.code === 'P2003' && String(err.meta?.field_name ?? '').startsWith('sms_transactions_restaurant_id_fkey');
      },
      'حذفِ رستورانِ دارای ردیفِ sms_transactions باید با FKِ همان جدول (P2003) رد شود');
  });

  test('کنترل: رستورانِ بدونِ ردیفِ دفتر هنوز حذف می‌شود (گارد همه‌چیز را قفل نکرده)', async () => {
    await db.restaurant.delete({ where: { id: ids.lonelyRestaurant } });
    assert.equal(await countWhere('restaurants', `id = '${ids.lonelyRestaurant}'::uuid`), 0);
  });

  test('کنترل: افزودنِ ردیفِ تازه در هر هشت جدول همچنان کار می‌کند', async () => {
    await db.reservationEvent.create({ data: { reservationId: ids.reservation, toStatus: 'seated', actor: 'system' } });
    await db.auditLog.create({ data: { action: `${TAG}.again`, detail: {} } });
    await db.platformEvent.create({ data: { type: `test.${TAG}.again`, occurredAt: new Date(), source: 'backend', payload: {} } });
    await db.economyLedgerEntry.create({ data: { userId: ids.user, kind: 'wallet_earn', amount: 1, source: `[DEMO] ${TAG}` } });
    await db.smsTransaction.create({ data: { restaurantId: ids.restaurant, delta: -1, reason: 'reservation_notify', balanceAfter: 9 } });
    await db.campaignLog.create({ data: { restaurantId: ids.restaurant, segment: 'vip', message: '[DEMO]' } });
    await db.couponRedemption.create({ data: { couponId: ids.coupon, discountToman: 500 } });
    await db.rewardRedemption.create({ data: { itemId: ids.item, userId: ids.user, coinsSpent: 1 } });
    assert.equal(await countWhere('sms_transactions', `restaurant_id = '${ids.restaurant}'::uuid`), 2);
  });
});
