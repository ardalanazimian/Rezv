import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import {
  processReservationEconomyEvent,
  grantEconomyRewardTx,
  getCustomerEconomyProfile,
  RELIABILITY_COLD_START_SCORE,
} from '../src/lib/economy.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  اقتصادِ مشتری — نیمه‌ی دیتابیسی، تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `tests/economy.test.mts` چهار تابعِ **خالص** را
//  (decay, strike, tier, eventScore) کامل می‌سنجد — ولی نیمه‌ای که واقعاً
//  می‌نویسد هیچ پوششی نداشت:
//
//    processReservationEconomyEvent  ← از *هر* تغییرِ وضعیتِ رزرو شلیک می‌شود
//    applyReliabilityEventToUserTx   ← دفتر + قفلِ ردیف + پروفایل + پاداش
//    applyReliabilityEventToShadowTx ← مسیرِ مهمانِ بدونِ حساب
//    grantEconomyRewardTx            ← XP و سکه‌ی کیفِ پول
//    getCustomerEconomyProfile       ← پیش‌فرضِ cold-start
//
//  اینجا پایِ ارزِ داخلیِ مشتری وسط است: اگر idempotency بشکند، یک retry
//  ساده XP و سکه را دوباره واریز می‌کند.
//
//  سه ادعای صریحِ خودِ فایل که تا امروز هیچ تستی قفلشان نکرده بود:
//   ۱) «idempotency با UNIQUE(reservation_id, kind) در خودِ DB تضمین می‌شه»
//   ۲) «منبعِ حقیقت ledgerه، فیلدهایِ پروفایل فقط cacheاند»
//   ۳) لنگرِ زمانیِ 2000-01-01 — بدونش «اولین completed یه کاربرِ تازه
//      امتیازش رو عوض نمی‌کرد» (ادعایی که در کامنت «زنده تست شد» نوشته شده
//      ولی هیچ‌جا قفل نشده بود).
// ═══════════════════════════════════════════════════════════════════════

const TAG = `ec-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;
let codeSeq = 0;

const nextCode = () => `EC${String(++codeSeq).padStart(3, '0')}${randomUUID().slice(0, 3).toUpperCase()}`;

/** کاربرِ تازه — هر تست کاربرِ خودش را می‌سازد تا حالت نشت نکند. */
async function mkUser(): Promise<string> {
  // ⚠️ پیشوندِ ۰۹۳۴ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({
    data: { phone: fixturePhone('0934'), firstName: '[DEMO]', lastName: 'اقتصاد' },
    select: { id: true },
  });
  return u.id;
}

/** رزروِ خام؛ فقط برای اینکه reservation_id معتبر و یکتا داشته باشیم. */
async function mkReservation(userId: string | null, hoursFromNow = 48): Promise<string> {
  const id = randomUUID();
  const slotStart = new Date(Date.now() + hoursFromNow * 3_600_000);
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, user_id, party_size, slot_start, slot_end,
       duration_minutes, block_buffer_minutes, status, source, created_at)
    VALUES
      (${id}::uuid, ${nextCode()}, ${restaurantId}::uuid,
       ${userId}::uuid, 2, ${slotStart}, ${new Date(slotStart.getTime() + 90 * 60_000)},
       90, 15, CAST('confirmed'::text AS "public"."reservation_status"), 'app', now())
  `;
  return id;
}

const ledgerOf = (userId: string) =>
  db.$queryRaw<{ kind: string; amount: number; source: string }[]>`
    SELECT kind, amount::int AS amount, source FROM economy_ledger_entries
    WHERE user_id = ${userId}::uuid ORDER BY kind, source
  `;

const profileOf = (userId: string) =>
  db.customerEconomyProfile.findUnique({ where: { userId } });

const shadowOf = (phone: string) =>
  db.$queryRaw<{ reliability_score: number; strike_count: number }[]>`
    SELECT reliability_score, strike_count FROM phone_reliability_shadows WHERE phone = ${phone}
  `;

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ اقتصاد',
      clubPrefix: 'EC', timezone: 'Asia/Tehran', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(async () => {
  // سیاستِ لغو بینِ تست‌ها عوض می‌شود؛ هر تست از حالتِ «بدونِ سیاست» شروع کند.
  await db.cancellationPolicy.deleteMany({ where: { restaurantId } }).catch(() => {});
});

after(async () => {
  const users = await db.user.findMany({
    where: { lastName: 'اقتصاد', firstName: '[DEMO]' }, select: { id: true },
  });
  const ids = users.map(u => u.id);
  await db.$executeRaw`DELETE FROM economy_ledger_entries WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.cancellationPolicy.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.customerEconomyProfile.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await db.$executeRaw`DELETE FROM phone_reliability_shadows WHERE phone LIKE '+98934%'`.catch(() => 0);
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
});

describe('اقتصاد — رزروِ تکمیل‌شده: دفتر، پروفایل، پاداش', () => {
  test('یک completed دفتر و پروفایل و XP را با هم می‌سازد', async () => {
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    });

    const ledger = await ledgerOf(userId);
    const kinds = ledger.map(e => e.kind).sort();
    assert.deepEqual(kinds, ['reliability_event', 'wallet_earn', 'xp_earn'],
      'باید هر سه ردیف ساخته شوند: سیگنالِ اعتبار + XP + سکه');

    const rel = ledger.find(e => e.kind === 'reliability_event')!;
    assert.equal(rel.amount, 100);
    assert.equal(rel.source, 'reservation_completed');

    const p = await profileOf(userId);
    assert.ok(p, 'پروفایل باید ساخته شده باشد');
    assert.ok(p.xpTotal > 0, 'XP باید واریز شده باشد');
    assert.ok(p.walletBalance > 0, 'سکه باید واریز شده باشد');
    assert.equal(p.strikeCount, 0, 'رزروِ موفق strike نمی‌سازد');
  });

  test('⚠️ لنگرِ زمانی: اولین رویداد واقعاً امتیاز را عوض می‌کند', async () => {
    // ⚠️ این دقیقاً همان ادعایی است که در کامنتِ economy.ts نوشته شده
    // («زنده تست شد») ولی هیچ تستی قفلش نکرده بود. اگر lastRecomputedAt
    // موقعِ ساختِ پروفایل «الان» باشد، Δt≈۰ → decay≈۱ → اولین رویداد عملاً
    // نادیده گرفته می‌شود و امتیاز رویِ ۷۵ می‌ماند.
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    });

    const p = await profileOf(userId);
    assert.equal(p!.reliabilityScore, 100,
      `اولین completed باید امتیاز را به ۱۰۰ ببرد، نه اینکه روی ${RELIABILITY_COLD_START_SCORE} بماند`);
  });

  test('no_show امتیاز را صفر و یک strike ثبت می‌کند', async () => {
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'running_late', toStatus: 'no_show', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    });

    const p = await profileOf(userId);
    assert.equal(p!.reliabilityScore, 0);
    assert.equal(p!.strikeCount, 1);
    assert.ok(p!.lastViolationAt, 'زمانِ نقض باید ثبت شود — decayِ بعدی به آن تکیه می‌کند');

    const ledger = await ledgerOf(userId);
    assert.deepEqual(ledger.map(e => e.kind), ['reliability_event'],
      'عدمِ حضور نباید XP یا سکه بدهد');
  });
});

describe('اقتصاد — idempotency (قفلِ ادعایِ UNIQUE(reservation_id, kind))', () => {
  test('پردازشِ دوباره‌ی همان رزرو XP را دوباره واریز نمی‌کند', async () => {
    // ⚠️ اگر این بشکند، یک retry ساده به مشتری ارزِ رایگان می‌دهد.
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);
    const input = {
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    };

    await processReservationEconomyEvent(input);
    const first = await profileOf(userId);

    await processReservationEconomyEvent(input);
    await processReservationEconomyEvent(input);
    const after = await profileOf(userId);

    assert.equal(after!.xpTotal, first!.xpTotal, 'XP نباید با اجرای دوباره زیاد شود');
    assert.equal(after!.walletBalance, first!.walletBalance, 'سکه نباید دوباره واریز شود');
    assert.equal((await ledgerOf(userId)).length, 3, 'دفتر باید دقیقاً همان ۳ ردیف بماند');
  });

  test('اجرای *همزمانِ* واقعی هم فقط یک‌بار واریز می‌کند', async () => {
    // ⚠️ تستِ بالا سریالی است و یک SELECT-then-INSERTِ معیوب هم از آن رد
    // می‌شد. این یکی همان TOCTOU را می‌سنجد: پنج فراخوانیِ موازی.
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);
    const input = {
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    };

    await Promise.all(Array.from({ length: 5 }, () =>
      processReservationEconomyEvent(input).catch(() => {})));

    const ledger = await ledgerOf(userId);
    assert.equal(ledger.length, 3, `دفتر باید ۳ ردیف داشته باشد، نه ${ledger.length}`);
    const p = await profileOf(userId);
    const xpRow = ledger.find(e => e.kind === 'xp_earn')!;
    assert.equal(p!.xpTotal, xpRow.amount, 'کشِ پروفایل باید دقیقاً با دفتر بخواند');
  });

  test('رزروِ متفاوت رویدادِ جدا می‌سازد (کنترلِ مثبت)', async () => {
    // بدونِ این، تابعی که *همیشه* skip کند هم تست‌های بالا را پاس می‌کرد.
    const userId = await mkUser();
    const base = {
      restaurantId, userId, guestPhone: null,
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    };
    await processReservationEconomyEvent({ ...base, reservationId: await mkReservation(userId) });
    await processReservationEconomyEvent({ ...base, reservationId: await mkReservation(userId) });

    assert.equal((await ledgerOf(userId)).length, 6, 'دو رزرو = دو مجموعه‌ی سه‌تایی');
  });
});

describe('اقتصاد — لغو و سیاستِ لغوِ رستوران', () => {
  test('لغوِ دیرهنگامِ مشتری جریمه و strike می‌گیرد', async () => {
    await db.cancellationPolicy.create({ data: { restaurantId, freeCancelHours: 24 } });
    const userId = await mkUser();
    const reservationId = await mkReservation(userId, 2);   // فقط ۲ ساعت مانده

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: `customer:${userId}`,
      slotStart: new Date(Date.now() + 2 * 3_600_000),
    });

    const ledger = await ledgerOf(userId);
    assert.equal(ledger[0].source, 'reservation_cancelled_late');
    assert.equal((await profileOf(userId))!.strikeCount, 1);
  });

  test('لغو داخلِ پنجره‌ی آزاد جریمه ندارد', async () => {
    await db.cancellationPolicy.create({ data: { restaurantId, freeCancelHours: 24 } });
    const userId = await mkUser();
    const reservationId = await mkReservation(userId, 72);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: `customer:${userId}`,
      slotStart: new Date(Date.now() + 72 * 3_600_000),
    });

    assert.equal((await ledgerOf(userId))[0].source, 'reservation_cancelled_in_window');
    assert.equal((await profileOf(userId))!.strikeCount, 0);
  });

  test('⚠️ سیاستِ سفارشیِ رستوران واقعاً از دیتابیس خوانده می‌شود', async () => {
    // پیش‌فرضِ کد ۲۴ ساعت است. با سیاستِ ۴۸ ساعته، لغوِ ۳۶ ساعت مانده باید
    // *دیرهنگام* حساب شود — با پیش‌فرضِ ۲۴ به‌غلط «داخلِ پنجره» می‌شد.
    await db.cancellationPolicy.create({ data: { restaurantId, freeCancelHours: 48 } });
    const userId = await mkUser();
    const reservationId = await mkReservation(userId, 36);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: `customer:${userId}`,
      slotStart: new Date(Date.now() + 36 * 3_600_000),
    });

    assert.equal((await ledgerOf(userId))[0].source, 'reservation_cancelled_late',
      'با سیاستِ ۴۸ ساعته، ۳۶ ساعت مانده دیرهنگام است');
  });

  test('لغوِ رستوران هیچ ردی در اقتصادِ مشتری نمی‌گذارد', async () => {
    const userId = await mkUser();
    const reservationId = await mkReservation(userId, 2);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId, guestPhone: null,
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'staff:someone',
      slotStart: new Date(Date.now() + 2 * 3_600_000),
    });

    assert.equal((await ledgerOf(userId)).length, 0, 'تقصیرِ مشتری نبوده');
    assert.equal(await profileOf(userId), null, 'حتی پروفایل هم نباید ساخته شود');
  });
});

describe('اقتصاد — مهمانِ بدونِ حساب (سایه‌ی شماره)', () => {
  test('no_showِ مهمان در سایه ثبت می‌شود، بدونِ ساختِ پروفایل/XP', async () => {
    const phone = fixturePhone('0934');
    const reservationId = await mkReservation(null);

    await processReservationEconomyEvent({
      reservationId, restaurantId, userId: null, guestPhone: phone,
      fromStatus: 'running_late', toStatus: 'no_show', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    });

    const normalized = '+98' + phone.slice(1);
    const s = await shadowOf(normalized);
    assert.equal(s.length, 1, 'ردیفِ سایه باید ساخته شود');
    assert.equal(s[0].reliability_score, 0);
    assert.equal(s[0].strike_count, 1);

    const led = await db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM economy_ledger_entries WHERE reservation_id = ${reservationId}::uuid`;
    assert.equal(Number(led[0].n), 0, 'مهمانِ بدونِ حساب نباید ردیفِ دفتر/XP بگیرد');
  });

  test('شماره‌ی نامعتبر جریانِ اصلی را نمی‌شکند', async () => {
    // ⚠️ ادعای صریحِ کد: «شماره‌ی نامعتبر — بی‌خیالِ ردیابی، جریانِ اصلی رو
    // مسدود نکن». اگر throw کند، اقتصاد کلِ تغییرِ وضعیت را قرمز می‌کند.
    const reservationId = await mkReservation(null);
    await processReservationEconomyEvent({
      reservationId, restaurantId, userId: null, guestPhone: 'نه-یک-شماره',
      fromStatus: 'seated', toStatus: 'completed', actor: 'cron',
      slotStart: new Date(Date.now() - 3_600_000),
    });
    // رسیدن به اینجا یعنی throw نکرده.
    assert.ok(true);
  });
});

describe('اقتصاد — پاداشِ مستقیم و خواندنِ پروفایل', () => {
  test('grantEconomyRewardTx هر kind را جدا idempotent می‌کند', async () => {
    // ⚠️ نکته‌ی ظریف: xp_earn و wallet_earn *دو ردیفِ جدا* با همان
    // reservation_id اند. قید روی (reservation_id, kind) است، پس هر دو جا
    // می‌شوند — ولی هرکدام فقط یک‌بار.
    const userId = await mkUser();
    const reservationId = await mkReservation(userId);

    const first = await db.$transaction(tx =>
      grantEconomyRewardTx(tx, { userId, restaurantId, reservationId, xp: 30, coins: 7, source: 'test_grant' }));
    assert.deepEqual(first, { xpApplied: 30, coinsApplied: 7 });

    const second = await db.$transaction(tx =>
      grantEconomyRewardTx(tx, { userId, restaurantId, reservationId, xp: 30, coins: 7, source: 'test_grant' }));
    assert.deepEqual(second, { xpApplied: 0, coinsApplied: 0 }, 'بارِ دوم نباید چیزی واریز شود');

    const p = await profileOf(userId);
    assert.equal(p!.xpTotal, 30);
    assert.equal(p!.walletBalance, 7);
  });

  test('پاداشِ بدونِ رزرو idempotent نیست — و این مستند است، نه تصادفی', async () => {
    // ⚠️ کامنتِ خودِ تابع می‌گوید با reservationId=NULL محافظِ یکتایی کار
    // نمی‌کند (NULLها در Postgres یکتا حساب نمی‌شوند) و idempotency به‌عهده‌ی
    // caller است. این تست همان رفتار را *ثبت* می‌کند تا اگر روزی عوض شد،
    // عمدی باشد نه تصادفی — و تا صداکننده‌ی بعدی بداند خودش باید گارد بگذارد.
    const userId = await mkUser();
    await db.$transaction(tx =>
      grantEconomyRewardTx(tx, { userId, xp: 5, coins: 0, source: 'referral_bonus' }));
    await db.$transaction(tx =>
      grantEconomyRewardTx(tx, { userId, xp: 5, coins: 0, source: 'referral_bonus' }));

    assert.equal((await profileOf(userId))!.xpTotal, 10,
      'دو بار واریز می‌شود — گاردش وظیفه‌ی caller است');
  });

  test('پروفایلِ نساخته پیش‌فرضِ cold-start می‌دهد، نه صفرِ گمراه‌کننده', async () => {
    const userId = await mkUser();
    const p = await getCustomerEconomyProfile(db, userId);
    assert.equal(p.reliabilityScore, RELIABILITY_COLD_START_SCORE,
      'کاربرِ بدونِ سابقه نباید امتیازِ صفر بگیرد — صفر یعنی «سنجیدیم و بد بود»');
    assert.equal(p.reputationTier, 'bronze');
    assert.equal(p.xpTotal, 0);
    assert.equal(await profileOf(userId), null, 'خواندن نباید ردیف بسازد');
  });
});
