import { db } from './db';
import { Err } from './errors';
import { grantEconomyRewardTx } from './economy';

// ═══════════════════════════════════════════════════════════════════════
//  Missions/Challenges (migration 038)
//
//  ⚠️ محدودیتِ صریحِ V1: پیشرفتِ ماموریت فقط رویِ یه سیگنالِ ساده (ولی
//  دقیق) ردیابی می‌شه — «تعدادِ نتیجه‌یِ مثبتِ پیاپیِ رزرو» (eventScore>=۸۰:
//  completed یا cancelled-in-window). این دقیقاً همون مکانیزمِ «Recovery
//  Mission با ۳ رزروِ متوالی» و «ماموریتِ هفتگیِ N رزرو» رو پوشش می‌ده —
//  مأموریت‌هایِ با معیارِ دلخواه‌تر (مثلاً «یه رستورانِ جدید امتحان کن») نیاز
//  به یه سیستمِ criteria-matchingِ عمومی‌تر دارن که خارج از دامنه‌یِ این
//  commitه (فیلدِ Mission.kind فعلاً فقط برایِ نمایش/دسته‌بندیه، نه معیارِ
//  خودکار). این محدودیت عمداً اینجا مستند شده تا بعداً کسی فکر نکنه
//  «هر ماموریتی خودکار پیشرفت می‌کنه».
// ═══════════════════════════════════════════════════════════════════════

/**
 * بعدِ هر رویدادِ اقتصادیِ رزرو (از applyReliabilityEventToUserTx) صدا زده
 * می‌شه — پیشرفتِ ماموریت‌هایِ فعالِ مرتبط رو آپدیت می‌کنه:
 *   • رویدادِ مثبت (eventScore>=۸۰): +۱ پیشرفت رویِ همه‌ی ماموریت‌هایِ فعال.
 *   • رویدادی که strike اضافه می‌کنه: ماموریت‌هایِ kind='recovery' ریست
 *     می‌شن (پیشرفتِ صفر) — چون «پیاپی» بودن شکسته شد.
 */
export async function updateMissionProgressTx(
  tx: any,
  opts: { userId: string; restaurantId: string; isPositiveEvent: boolean; isViolation: boolean },
): Promise<void> {
  const { userId, restaurantId, isPositiveEvent, isViolation } = opts;
  if (!isPositiveEvent && !isViolation) return;

  const now = new Date();
  const missions = await tx.mission.findMany({
    where: {
      status: 'active',
      OR: [{ restaurantId: null }, { restaurantId }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
  });
  if (missions.length === 0) return;

  for (const m of missions) {
    if (isViolation) {
      if (m.kind !== 'recovery') continue; // فقط ماموریتِ ریکاوری با نقض ریست می‌شه
      await tx.missionProgress.upsert({
        where: { missionId_userId: { missionId: m.id, userId } },
        create: { missionId: m.id, userId, progress: 0 },
        update: { progress: 0, completedAt: null },
      });
      continue;
    }

    // isPositiveEvent
    const existing = await tx.missionProgress.upsert({
      where: { missionId_userId: { missionId: m.id, userId } },
      create: { missionId: m.id, userId, progress: 0 },
      update: {},
    });
    if (existing.claimedAt) continue; // قبلاً claim شده، دیگه پیشرفت نمی‌کنه
    if (existing.completedAt) continue; // قبلاً کامل شده، منتظرِ claimه

    const newProgress = Math.min(m.targetCount, existing.progress + 1);
    await tx.missionProgress.update({
      where: { missionId_userId: { missionId: m.id, userId } },
      data: {
        progress: newProgress,
        completedAt: newProgress >= m.targetCount ? now : null,
      },
    });
  }
}

/** لیستِ ماموریت‌هایِ فعال (سراسری + مالِ یه رستورانِ خاص اگه داده بشه) با پیشرفتِ همین کاربر. */
export async function listMissionsForUser(userId: string, restaurantId?: string) {
  const now = new Date();
  const missions = await db.mission.findMany({
    where: {
      status: 'active',
      OR: restaurantId ? [{ restaurantId: null }, { restaurantId }] : [{ restaurantId: null }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  const progress = await db.missionProgress.findMany({
    where: { userId, missionId: { in: missions.map((m: { id: string }) => m.id) } },
  });
  const progressByMission = new Map(progress.map((p: { missionId: string }) => [p.missionId, p]));

  return missions.map((m: any) => {
    const p: any = progressByMission.get(m.id);
    return {
      id: m.id, title: m.title, description: m.description, kind: m.kind,
      target_count: m.targetCount, xp_reward: m.xpReward, wallet_reward: m.walletReward,
      strike_relief: m.strikeRelief,
      progress: p?.progress ?? 0,
      completed: !!p?.completedAt,
      claimed: !!p?.claimedAt,
    };
  });
}

/** claim کردنِ جایزه‌ی یه ماموریتِ تکمیل‌شده — atomic، idempotent (claimedAt IS NULL گاردِ اصلیه). */
export async function claimMission(userId: string, missionId: string) {
  return db.$transaction(async (tx) => {
    const mission = await tx.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw Err.notFound('ماموریت');

    // UPDATE شرطی: فقط اگه completedAt ست شده و claimedAt هنوز نه — atomic،
    // خودِ همین شرط جلویِ claimِ دوباره رو می‌گیره (نیازی به SELECT جدا نیست).
    const claimed = await tx.$queryRaw<{ id: string }[]>`
      UPDATE mission_progress SET claimed_at = now()
      WHERE mission_id = ${missionId}::uuid AND user_id = ${userId}::uuid
        AND completed_at IS NOT NULL AND claimed_at IS NULL
      RETURNING id
    `;
    if (claimed.length === 0) {
      throw Err.validation('این ماموریت هنوز کامل نشده یا قبلاً جایزه‌اش گرفته شده');
    }

    const { xpApplied, coinsApplied } = await grantEconomyRewardTx(tx, {
      userId, restaurantId: mission.restaurantId, xp: mission.xpReward, coins: mission.walletReward,
      source: `mission:${missionId}`,
    });

    if (mission.strikeRelief > 0) {
      await tx.customerEconomyProfile.upsert({ where: { userId }, create: { userId }, update: {} });
      await tx.$executeRaw`
        UPDATE customer_economy_profiles
        SET strike_count = GREATEST(0, strike_count - ${mission.strikeRelief})
        WHERE user_id = ${userId}::uuid
      `;
    }

    return { xp_applied: xpApplied, coins_applied: coinsApplied, strike_relief: mission.strikeRelief };
  });
}
