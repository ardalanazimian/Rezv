import { db } from './db';
import { normalizePhone } from './otp';
import { createLogger } from './logger';
import { updateMissionProgressTx } from './missions';
import { getEconomyRuleConfig, type EconomyRuleConfig } from './economy-rules';

const log = createLogger('economy');

// ═══════════════════════════════════════════════════════════════════════
//  اقتصادِ یکپارچه‌ی مشتری — هسته‌ی محاسباتی (migration 038)
//
//  طراحیِ کامل (فرمول‌ها، جدولِ eventScore، دلیلِ هر تصمیم) در جلسه‌ی
//  برنامه‌ریزیِ محصولِ ۲۰۲۶-۰۸-۱۲ مستند شد. این فایل همون طراحی رو پیاده
//  می‌کنه. نکاتِ کلیدی برایِ خوانده:
//
//  • reliabilityScore سراسریه (رویِ User)، نه per-restaurant.
//  • همه‌چی از طریقِ economy_ledger_entries (append-only) ردیابی می‌شه —
//    فیلدهایِ CustomerEconomyProfile فقط cache هستن، منبعِ حقیقت ledgerه.
//  • idempotency با UNIQUE(reservation_id, kind) در خودِ DB تضمین می‌شه،
//    نه با چک کردنِ دستی در کد — پس این توابع باید همیشه inline با
//    ON CONFLICT DO NOTHING بنویسن، نه SELECT-then-INSERT (که TOCTOU داره).
//  • مشتریِ بدونِ حساب (guestPhone) یه مسیرِ سبک‌ترِ موازی داره
//    (phone_reliability_shadows) — بدونِ XP/wallet، بدونِ decayِ strike
//    (چون بدونِ لاگین، داشبوردی برایِ نمایشِ «چقدر مونده تا ریکاوری» نیست).
// ═══════════════════════════════════════════════════════════════════════

export const RELIABILITY_HALF_LIFE_DAYS = 90;
export const RELIABILITY_COLD_START_SCORE = 75;
export const STRIKE_DECAY_PERIOD_DAYS = 90;

export type ReputationTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * EMA زمان‌دار — نیم‌عمرِ ۹۰ روزه. رفتارِ اخیر وزنِ بیشتری داره، بدونِ نیازِ به
 * بازمحاسبه‌یِ کاملِ تاریخچه (O(1) در هر آپدیت). تست‌شده با مقادیرِ دستی —
 * رجوع کن به economy.test.mts.
 */
export function applyTimeDecayedScore(
  oldScore: number,
  lastRecomputedAt: Date,
  eventScore: number,
  now: Date = new Date(),
): number {
  const deltaDays = Math.max(0, (now.getTime() - lastRecomputedAt.getTime()) / 86_400_000);
  const decay = Math.pow(0.5, deltaDays / RELIABILITY_HALF_LIFE_DAYS);
  const next = oldScore * decay + eventScore * (1 - decay);
  return Math.round(Math.min(100, Math.max(0, next)));
}

/**
 * decayِ زمانیِ strike — هر ۹۰ روزِ بدونِ نقضِ جدید، یک strike خودکار کم می‌شه.
 * lazy: فقط موقعِ خوندن/آپدیتِ profile محاسبه می‌شه، نه با یه cronِ جدا.
 */
export function applyStrikeDecay(
  strikeCount: number,
  lastViolationAt: Date | null,
  now: Date = new Date(),
): number {
  if (strikeCount <= 0 || !lastViolationAt) return strikeCount;
  const daysSince = (now.getTime() - lastViolationAt.getTime()) / 86_400_000;
  const periodsElapsed = Math.floor(daysSince / STRIKE_DECAY_PERIOD_DAYS);
  return Math.max(0, strikeCount - periodsElapsed);
}

/** آستانه‌هایِ reputationTier — نیازمندِ همزمانِ score و سابقه (نه فقط یکی). */
export function computeReputationTier(opts: {
  score: number;
  completedCount: number;
  strikeCount: number;
}): ReputationTier {
  const { score, completedCount, strikeCount } = opts;
  if (score >= 95 && completedCount >= 40 && strikeCount === 0) return 'platinum';
  if (score >= 85 && completedCount >= 15) return 'gold';
  if (score >= 70 && completedCount >= 5) return 'silver';
  return 'bronze';
}

export type EconomyEvent = { score: number; addsStrike: boolean; label: string };

/**
 * جدولِ eventScore — رجوع کن به طراحیِ اصلی برایِ دلیلِ هر عدد.
 *
 * قانونِ کلی: فقط انتقال‌هایی که واقعاً بازتابِ رفتارِ *مشتری*ان یه eventScore
 * دارن. رزروهایی که رستوران رد کرده (rejected)، هولدهایی که سیستم منقضی کرده
 * (expired)، یا لغوهایی که رستوران/سیستم انجام داده (نه خودِ مشتری) — هیچ‌کدوم
 * سیگنالِ اقتصادی تولید نمی‌کنن (null برمی‌گردونه).
 *
 * V1 عمداً «رزروی که با تأخیر رسید ولی completed شد» رو هم‌وزنِ رزروِ
 * به‌موقع می‌گیره (۱۰۰) — تفکیکِ دقیق‌تر نیازِ lookback به تاریخچه‌ی
 * ReservationEvent داره که در V1 صرف‌نظر شد (سادگی/عملکرد).
 */
export function computeEventScore(input: {
  fromStatus: string;
  toStatus: string;
  actor: string;
  hoursBeforeSlot: number;
  freeCancelHours: number;
}): EconomyEvent | null {
  const { fromStatus, toStatus, actor, hoursBeforeSlot, freeCancelHours } = input;
  const isCustomerActor = actor.startsWith('customer:');

  if (toStatus === 'completed') {
    return { score: 100, addsStrike: false, label: 'reservation_completed' };
  }
  if (toStatus === 'no_show') {
    return { score: 0, addsStrike: true, label: 'reservation_no_show' };
  }
  if (toStatus === 'cancelled') {
    // لغوِ رستوران/سیستم تقصیرِ مشتری نیست — فقط لغوِ خودِ مشتری امتیاز می‌سازه.
    if (!isCustomerActor) return null;
    const late = hoursBeforeSlot < freeCancelHours;
    return late
      ? { score: 35, addsStrike: true, label: 'reservation_cancelled_late' }
      : { score: 85, addsStrike: false, label: 'reservation_cancelled_in_window' };
  }
  if (toStatus === 'auto_cancelled' && fromStatus === 'waitlisted') {
    // آفرِ waitlist رو قبول نکرد — سیگنالِ ضعیف، نه شکستنِ یه قولِ تأییدشده.
    return { score: 55, addsStrike: false, label: 'waitlist_offer_expired' };
  }
  // expired / rejected / auto_cancelled از وضعیت‌هایِ دیگر / بقیه‌ی انتقال‌هایِ
  // غیرِ‌نهایی: هیچ‌کدوم رفتارِ کنترل‌شده‌یِ مشتری نیست.
  return null;
}

/**
 * ورودیِ processReservationEconomyEventTx — دقیقاً همون فیلدهایی که
 * lifecycle.ts از رویِ رزروِ لود‌شده در تراکنشِ خودش در دسترس داره.
 */
export type ReservationEconomyInput = {
  reservationId: string;
  restaurantId: string;
  userId: string | null;
  guestPhone: string | null;
  fromStatus: string;
  toStatus: string;
  actor: string;
  slotStart: Date;
};

/**
 * نقطه‌ی ورودیِ اصلی — **بعد از** commitِ transitionReservation صدا زده
 * می‌شه (lifecycle.ts)، دقیقاً مثلِ الگویِ enqueueSms در همون فایل: تغییرِ
 * وضعیتِ رزرو مسیرِ حیاتیه، هیچ‌وقت نباید به‌خاطرِ باگ/کندیِ لایه‌ی اقتصادی
 * fail بشه. خودش با db.$transaction اتمیکه (ledger+profile با هم)، ولی این
 * تراکنش از تراکنشِ رزرو کاملاً جداست — caller باید با .catch(()=>{}) صدا
 * بزنه (دقیقاً مثلِ enqueueSms). اگه این تابع fail بشه، رزرو خودش از قبل
 * commit شده؛ فقط دفترِ اقتصادی برایِ این یه رویداد جا می‌مونه (idempotency
 * key هنوز خالیه، پس در یه retry/reconciliation بعدی قابلِ‌جبرانه).
 */
export async function processReservationEconomyEvent(input: ReservationEconomyInput): Promise<void> {
  const now = new Date();
  const hoursBeforeSlot = (input.slotStart.getTime() - now.getTime()) / 3_600_000;

  let freeCancelHours = 24;
  try {
    const policy = await db.cancellationPolicy.findUnique({
      where: { restaurantId: input.restaurantId },
      select: { freeCancelHours: true },
    });
    if (policy) freeCancelHours = policy.freeCancelHours;
  } catch (e) {
    log.warn('خواندنِ CancellationPolicy ناموفق — پیش‌فرضِ ۲۴ ساعت استفاده شد', { error: (e as Error).message });
  }

  const event = computeEventScore({
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: input.actor,
    hoursBeforeSlot,
    freeCancelHours,
  });
  if (!event) return;

  // پاداشِ XP/سکه — عمداً بیرونِ تراکنش خوانده می‌شود (فقط یک SELECTِ کش‌شده
  // از platform_settings است، نیازی به قفلِ ردیفِ رزرو ندارد). ویرایشگرِ
  // قواعدِ اقتصاد (فازِ ۴) از همین‌جا اثر می‌کند؛ پیش‌فرض دقیقاً همون
  // ۱۰۰/۲۰ِ قبلاً هاردکدشده است.
  const ruleConfig = await getEconomyRuleConfig();

  await db.$transaction(async (tx) => {
    if (input.userId) {
      await applyReliabilityEventToUserTx(tx, {
        userId: input.userId,
        restaurantId: input.restaurantId,
        reservationId: input.reservationId,
        event,
        now,
        ruleConfig,
      });
    } else if (input.guestPhone) {
      await applyReliabilityEventToShadowTx(tx, { guestPhone: input.guestPhone, event, now });
    }
  });
}

async function countCompletedReservations(tx: any, userId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM economy_ledger_entries
    WHERE user_id = ${userId}::uuid AND kind = 'reliability_event' AND source = 'reservation_completed'
  `;
  return Number(rows[0]?.count ?? 0);
}

async function applyReliabilityEventToUserTx(
  tx: any,
  opts: { userId: string; restaurantId: string; reservationId: string; event: EconomyEvent; now: Date; ruleConfig: EconomyRuleConfig },
): Promise<void> {
  const { userId, restaurantId, reservationId, event, now, ruleConfig } = opts;

  // idempotency: تلاش برایِ درج؛ اگه از قبل بوده (retry)، skip بی‌صدا.
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO economy_ledger_entries (user_id, restaurant_id, kind, amount, reservation_id, source)
    VALUES (${userId}::uuid, ${restaurantId}::uuid, 'reliability_event', ${event.score}, ${reservationId}::uuid, ${event.label})
    ON CONFLICT (reservation_id, kind) DO NOTHING
    RETURNING id
  `;
  if (inserted.length === 0) return;

  // ⚠️ نکته‌یِ دقتِ حیاتی: lastRecomputedAt نباید «الان» باشه — وگرنه اولین
  // eventِ همین کاربر بلافاصله با همون «الان» EMA می‌شه (Δt≈۰ → decay≈۱ →
  // eventِ اول عملاً نادیده گرفته می‌شه، امتیاز رویِ ۷۵ می‌مونه). برایِ اینکه
  // اولین eventِ واقعی کاملاً امتیاز رو تعیین کنه (نه فقط یه نوسانِ ناچیز رویِ
  // priorِ فرضی)، لنگرِ زمانی رو خیلی عقب می‌ذاریم (decay این‌طوری عملاً صفره).
  // زنده تست شد: بدونِ این فیکس، اولین completed یه کاربرِ تازه امتیازش رو
  // عوض نمی‌کرد.
  await tx.customerEconomyProfile.upsert({
    where: { userId },
    create: { userId, lastRecomputedAt: new Date('2000-01-01T00:00:00Z') },
    update: {},
  });

  const locked = await tx.$queryRaw<
    { reliability_score: number; strike_count: number; last_violation_at: Date | null; last_recomputed_at: Date }[]
  >`
    SELECT reliability_score, strike_count, last_violation_at, last_recomputed_at
    FROM customer_economy_profiles WHERE user_id = ${userId}::uuid FOR UPDATE
  `;
  const p = locked[0];
  if (!p) return;

  const decayedStrikes = applyStrikeDecay(p.strike_count, p.last_violation_at, now);
  const newScore = applyTimeDecayedScore(p.reliability_score, p.last_recomputed_at, event.score, now);
  const newStrikes = decayedStrikes + (event.addsStrike ? 1 : 0);
  const completedCount = await countCompletedReservations(tx, userId);
  const tier = computeReputationTier({ score: newScore, completedCount, strikeCount: newStrikes });

  await tx.customerEconomyProfile.update({
    where: { userId },
    data: {
      reliabilityScore: newScore,
      strikeCount: newStrikes,
      reputationTier: tier,
      lastViolationAt: event.addsStrike ? now : p.last_violation_at,
      lastRecomputedAt: now,
    },
  });

  if (event.label === 'reservation_completed') {
    await grantEconomyRewardTx(tx, {
      userId, restaurantId, reservationId,
      xp: ruleConfig.completedXp, coins: ruleConfig.completedCoins, source: 'reservation_completed',
    });
  }

  // پیشرفتِ ماموریت‌ها — eventScore>=۸۰ یعنی «نتیجه‌ی مثبت» (completed یا
  // cancelled-in-window)، addsStrike یعنی «نقض» (ریکاوریِ در حالِ پیشرفت ریست می‌شه).
  await updateMissionProgressTx(tx, {
    userId, restaurantId, isPositiveEvent: event.score >= 80, isViolation: event.addsStrike,
  });
}

async function applyReliabilityEventToShadowTx(
  tx: any,
  opts: { guestPhone: string; event: EconomyEvent; now: Date },
): Promise<void> {
  let phone: string;
  try {
    phone = normalizePhone(opts.guestPhone);
  } catch {
    return; // شماره‌ی نامعتبر — بی‌خیالِ ردیابی، جریانِ اصلی رو مسدود نکن
  }

  // idempotency: این مسیر فقط از داخلِ همون txی صدا زده می‌شه که reservation.update
  // رویِ همون ردیف قفل گرفته (خودِ UPDATE در transitionReservation) — دو فراخوانیِ
  // هم‌زمان برایِ یه رزرو سریالایز می‌شن. وضعیت‌هایِ نهایی هم در TRANSITIONS خروجی
  // ندارن، پس دوباره‌رسیدن به همون توضیع برایِ همون رزرو رخ نمی‌ده.
  // همون فیکسِ لنگرِ زمانی که در applyReliabilityEventToUserTx هست — بدونِ این،
  // اولین eventِ این شماره هم بی‌اثر می‌مونه.
  await tx.$executeRaw`
    INSERT INTO phone_reliability_shadows (phone, reliability_score, strike_count, last_recomputed_at)
    VALUES (${phone}, 75, 0, '2000-01-01T00:00:00Z')
    ON CONFLICT (phone) DO NOTHING
  `;
  const locked = await tx.$queryRaw<{ reliability_score: number; strike_count: number; last_recomputed_at: Date }[]>`
    SELECT reliability_score, strike_count, last_recomputed_at FROM phone_reliability_shadows
    WHERE phone = ${phone} FOR UPDATE
  `;
  const s = locked[0];
  if (!s) return;
  const newScore = applyTimeDecayedScore(s.reliability_score, s.last_recomputed_at, opts.event.score, opts.now);
  const newStrikes = s.strike_count + (opts.event.addsStrike ? 1 : 0);
  await tx.$executeRaw`
    UPDATE phone_reliability_shadows
    SET reliability_score = ${newScore}, strike_count = ${newStrikes}, last_recomputed_at = now()
    WHERE phone = ${phone}
  `;
}

/**
 * اعطایِ XP/سکه — مصرف‌کننده‌هایِ آینده: referral، mission claim، و مسیرِ
 * completed در بالا.
 *
 * ⚠️ idempotency فقط وقتی تضمینه که reservationId داده بشه (محافظِ
 * UNIQUE(reservation_id, kind)). برایِ پاداش‌هایِ بدونِ‌رزرو (referral،
 * mission) — چون reservation_id همیشه NULL می‌مونه و NULLها یکتا حساب
 * نمی‌شن — idempotency به‌عهده‌یِ خودِ caller است (مثلاً MissionProgress.claimedAt
 * یا Referral.status باید با یه شرطِ اتمیک، نه این تابع، جلویِ claimِ دوباره
 * رو بگیرن).
 */
export async function grantEconomyRewardTx(
  tx: any,
  opts: {
    userId: string;
    restaurantId?: string | null;
    reservationId?: string | null;
    xp?: number;
    coins?: number;
    source: string;
  },
): Promise<{ xpApplied: number; coinsApplied: number }> {
  const { userId, restaurantId = null, reservationId = null, xp = 0, coins = 0, source } = opts;
  await tx.customerEconomyProfile.upsert({ where: { userId }, create: { userId }, update: {} });

  let xpApplied = 0;
  let coinsApplied = 0;

  if (xp > 0) {
    const r = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO economy_ledger_entries (user_id, restaurant_id, kind, amount, reservation_id, source)
      VALUES (${userId}::uuid, ${restaurantId}::uuid, 'xp_earn', ${xp}, ${reservationId}::uuid, ${source})
      ON CONFLICT (reservation_id, kind) DO NOTHING RETURNING id
    `;
    if (r.length > 0) xpApplied = xp;
  }
  if (coins > 0) {
    const r = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO economy_ledger_entries (user_id, restaurant_id, kind, amount, reservation_id, source)
      VALUES (${userId}::uuid, ${restaurantId}::uuid, 'wallet_earn', ${coins}, ${reservationId}::uuid, ${source})
      ON CONFLICT (reservation_id, kind) DO NOTHING RETURNING id
    `;
    if (r.length > 0) coinsApplied = coins;
  }

  if (xpApplied > 0 || coinsApplied > 0) {
    await tx.customerEconomyProfile.update({
      where: { userId },
      data: { xpTotal: { increment: xpApplied }, walletBalance: { increment: coinsApplied } },
    });
  }
  return { xpApplied, coinsApplied };
}

/** خواندنِ پروفایلِ اقتصادیِ یه مشتری — برایِ API route (upsert نمی‌کنه، فقط می‌خونه). */
export async function getCustomerEconomyProfile(tx: { customerEconomyProfile: any }, userId: string) {
  const p = await tx.customerEconomyProfile.findUnique({ where: { userId } });
  if (!p) {
    return {
      userId, reliabilityScore: RELIABILITY_COLD_START_SCORE, reputationTier: 'bronze' as ReputationTier,
      xpTotal: 0, walletBalance: 0, strikeCount: 0, hasActiveAbuseFlag: false,
    };
  }
  return p;
}
