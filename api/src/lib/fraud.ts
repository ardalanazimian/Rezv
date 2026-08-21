import { db } from './db';
import { audit } from './audit';
import { createLogger } from './logger';

const log = createLogger('fraud');

// ═══════════════════════════════════════════════════════════════════════
//  تشخیص تقلب/سوءاستفاده (Fraud Detection)
//
//  rate-limit از حملات حجمی جلوگیری می‌کند، ولی الگوهای سوءاستفاده‌ی
//  هوشمندانه‌تر را نمی‌گیرد. این ماژول سیگنال‌های تقلب را روی داده‌ی
//  واقعی تشخیص می‌دهد. همه‌ی کوئری‌ها روی PostgreSQL واقعی تست شده‌اند.
//
//  رویکرد: تشخیص (detection) + ثبت در audit، نه مسدودسازی خودکار خشن.
//  صاحب کسب‌وکار سیگنال را می‌بیند و تصمیم می‌گیرد (کاهش false-positive).
// ═══════════════════════════════════════════════════════════════════════

export type FraudSignal = {
  kind: 'coupon_multi_account' | 'high_no_show' | 'redemption_velocity' | 'rapid_book_cancel' | 'referral_farming';
  severity: 'high' | 'medium';
  // ⚠️ subject: برای coupon_multi_account یک IP است (قابلِ‌تبدیل به userId نیست
  // چون چند حساب پشتِ یک IP‌اند)؛ برای بقیه‌ی انواع همیشه یک userId است —
  // applyAbuseFlags زیر دقیقاً به همین تمایز تکیه می‌کند.
  subject: string;          // IP یا userId
  detail: string;
  metrics: Record<string, number>;
};

/**
 * سوءاستفاده‌ی چند‌حسابی از کوپن: یک IP که با چند حساب مختلف
 * یک کوپن را استفاده کرده (الگوی کلاسیک فارم‌کردن تخفیف).
 * نیازمند ستون ip در coupon_redemptions (افزوده‌شده، nullable).
 */
export async function detectCouponMultiAccount(restaurantId: string, minAccounts = 3): Promise<FraudSignal[]> {
  const rows = await db.$queryRaw<{ ip: string; coupon_id: string; distinct_accounts: bigint; total: bigint }[]>`
    SELECT cr.ip, cr.coupon_id,
           count(DISTINCT cr.user_id) AS distinct_accounts,
           count(*) AS total
    FROM coupon_redemptions cr
    JOIN coupons c ON c.id = cr.coupon_id
    WHERE c.restaurant_id = ${restaurantId}::uuid
      AND cr.ip IS NOT NULL
      AND cr.redeemed_at > now() - interval '30 days'
    GROUP BY cr.ip, cr.coupon_id
    HAVING count(DISTINCT cr.user_id) >= ${minAccounts}
    ORDER BY distinct_accounts DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    kind: 'coupon_multi_account' as const,
    severity: Number(r.distinct_accounts) >= minAccounts * 2 ? 'high' : 'medium',
    subject: r.ip,
    detail: `IP ${r.ip} با ${r.distinct_accounts} حساب مختلف یک کوپن را استفاده کرده`,
    metrics: { distinctAccounts: Number(r.distinct_accounts), total: Number(r.total) },
  }));
}

/**
 * الگوی no-show مشکوک: کاربری با نرخ no-show بالا و حداقل چند رزرو.
 * (سیگنال برای deposit-required کردن رزروهای بعدی این کاربر.)
 */
export async function detectHighNoShow(restaurantId: string, minReservations = 4, threshold = 0.6): Promise<FraudSignal[]> {
  const rows = await db.$queryRaw<{ user_id: string; total: bigint; no_shows: bigint; pct: number }[]>`
    SELECT user_id,
           count(*) AS total,
           count(*) FILTER (WHERE status = 'no_show') AS no_shows,
           round(100.0 * count(*) FILTER (WHERE status = 'no_show') / count(*)) AS pct
    FROM reservations
    WHERE restaurant_id = ${restaurantId}::uuid
      AND user_id IS NOT NULL
      AND created_at > now() - interval '90 days'
    GROUP BY user_id
    HAVING count(*) >= ${minReservations}
      AND count(*) FILTER (WHERE status = 'no_show')::float / count(*) >= ${threshold}
    ORDER BY pct DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    kind: 'high_no_show' as const,
    severity: Number(r.pct) >= 80 ? 'high' : 'medium',
    subject: r.user_id,
    detail: `کاربر با نرخ no-show ${r.pct}٪ (${r.no_shows} از ${r.total} رزرو)`,
    metrics: { total: Number(r.total), noShows: Number(r.no_shows), pct: Number(r.pct) },
  }));
}

/**
 * سرعت redemption غیرعادی: یک کاربر که در بازه‌ی کوتاه چند کوپن استفاده کرده.
 */
export async function detectRedemptionVelocity(restaurantId: string, maxPerDay = 5): Promise<FraudSignal[]> {
  const rows = await db.$queryRaw<{ user_id: string; cnt: bigint }[]>`
    SELECT cr.user_id, count(*) AS cnt
    FROM coupon_redemptions cr
    JOIN coupons c ON c.id = cr.coupon_id
    WHERE c.restaurant_id = ${restaurantId}::uuid
      AND cr.user_id IS NOT NULL
      AND cr.redeemed_at > now() - interval '1 day'
    GROUP BY cr.user_id
    HAVING count(*) > ${maxPerDay}
    ORDER BY cnt DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    kind: 'redemption_velocity' as const,
    severity: 'medium' as const,
    subject: r.user_id,
    detail: `کاربر ${r.cnt} کوپن در ۲۴ ساعت استفاده کرده`,
    metrics: { redemptions: Number(r.cnt) },
  }));
}

/**
 * الگویِ رزرو-کنسلِ فوری: کاربری که چند بار پشتِ سرِ هم رزرو می‌کند و خیلی زود
 * (داخلِ چند دقیقه) خودش لغو می‌کند — نه لغوِ عادیِ برنامه‌ریزی‌شده. الگویِ
 * کلاسیکِ نگه‌داشتنِ میز برایِ اسکلپینگ یا آزمایشِ سیستمِ waitlist/آفر.
 * از reservation_events (منبعِ صحتِ چرخه‌ی رزرو) استفاده می‌کند، نه فرض.
 */
export async function detectRapidBookCancel(restaurantId: string, minRapidCancels = 3, rapidWindowMinutes = 30): Promise<FraudSignal[]> {
  const rows = await db.$queryRaw<{ user_id: string; cnt: bigint }[]>`
    SELECT r.user_id, count(*) AS cnt
    FROM reservation_events re
    JOIN reservations r ON r.id = re.reservation_id
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND re.to_status = 'cancelled'
      AND re.actor = 'customer'
      AND r.user_id IS NOT NULL
      AND re.created_at > now() - interval '30 days'
      AND re.created_at - r.created_at <= (${rapidWindowMinutes}::float * interval '1 minute')
    GROUP BY r.user_id
    HAVING count(*) >= ${minRapidCancels}
    ORDER BY cnt DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    kind: 'rapid_book_cancel' as const,
    severity: Number(r.cnt) >= minRapidCancels * 2 ? 'high' : 'medium',
    subject: r.user_id,
    detail: `کاربر ${r.cnt} بار رزرو کرده و ظرفِ کمتر از ${rapidWindowMinutes} دقیقه خودش لغو کرده`,
    metrics: { rapidCancels: Number(r.cnt), windowMinutes: rapidWindowMinutes },
  }));
}

/**
 * فارمینگِ رفرال: یک معرف (referrer) که تعدادِ زیادی رفرالِ completed را در
 * یک بازه‌ی زمانیِ کوتاه ثبت کرده — الگویِ نشانه‌یِ حساب‌سازیِ جعلی برایِ
 * فارم‌کردنِ پاداشِ رفرال (نه رشدِ طبیعیِ آلی که در طولِ زمان پخش می‌شود).
 * Referral مدلِ restaurant-scoped نیست (رفرال سراسریِ پلتفرم است)، پس این
 * سیگنال بر خلافِ بقیه، restaurantId نمی‌گیرد — یک‌بار در cronِ سراسری
 * اجرا می‌شود، نه در حلقه‌ی per-restaurant.
 */
export async function detectReferralFarming(minCompleted = 5, windowHours = 48): Promise<FraudSignal[]> {
  const rows = await db.$queryRaw<{ referrer_id: string; completed: bigint; span_hours: number }[]>`
    SELECT referrer_id,
           count(*) AS completed,
           extract(epoch FROM (max(completed_at) - min(completed_at))) / 3600.0 AS span_hours
    FROM referrals
    WHERE status IN ('completed', 'rewarded')
      AND completed_at IS NOT NULL
      AND completed_at > now() - interval '30 days'
    GROUP BY referrer_id
    HAVING count(*) >= ${minCompleted}
       AND (max(completed_at) - min(completed_at)) <= (${windowHours}::float * interval '1 hour')
    ORDER BY completed DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    kind: 'referral_farming' as const,
    severity: Number(r.completed) >= minCompleted * 2 ? 'high' : 'medium',
    subject: r.referrer_id,
    detail: `کاربر ${r.completed} رفرالِ تکمیل‌شده را ظرفِ ${Math.round(r.span_hours)} ساعت ثبت کرده`,
    metrics: { completed: Number(r.completed), spanHours: Math.round(r.span_hours) },
  }));
}

/** اجرای همه‌ی بررسی‌هایِ restaurant-scoped برای یک رستوران و ثبت سیگنال‌ها در audit. */
export async function runFraudScan(restaurantId: string): Promise<FraudSignal[]> {
  const [multiAccount, noShow, velocity, rapidCancel] = await Promise.all([
    detectCouponMultiAccount(restaurantId).catch(() => []),
    detectHighNoShow(restaurantId).catch(() => []),
    detectRedemptionVelocity(restaurantId).catch(() => []),
    detectRapidBookCancel(restaurantId).catch(() => []),
  ]);
  const all = [...multiAccount, ...noShow, ...velocity, ...rapidCancel];
  // ثبت سیگنال‌های high در audit برای بررسی
  for (const sig of all.filter((s) => s.severity === 'high')) {
    await audit({
      action: 'security.idor_attempt', // نزدیک‌ترین action موجود؛ یا 'admin.action'
      actorType: 'anonymous',
      restaurantId,
      detail: { fraud: sig.kind, subject: sig.subject, ...sig.metrics },
      success: false,
    }).catch(() => {});
  }
  if (all.length > 0) log.warn('سیگنال تقلب', { restaurantId, count: all.length });
  return all;
}

// ═══════════════════════════════════════════════════════════════════════
//  اتصال به CustomerEconomyProfile.hasActiveAbuseFlag
//
//  فلسفه: همان «تشخیص + ثبت، نه مسدودسازیِ خشن» بالا — این فلگ کاربر را
//  بلاک نمی‌کند، فقط لایه‌ی ۴ (آخر) resolvePolicy را در cancellation-policy.ts
//  فعال می‌کند (سخت‌گیرترشدنِ قوانینِ کنسلی برایِ همان کاربر، در همه‌ی
//  رستوران‌ها — چون CustomerEconomyProfile سراسری/per-User است، نه
//  per-restaurant؛ عمداً همین‌طور طراحی شده: کاربری که در یک رستوران سوءاستفاده
//  کرده، سیگنالِ ریسکش باید در کلِ پلتفرم دیده شود، دقیقاً مثلِ reliabilityScore).
//
//  فقط سیگنال‌هایِ severity=high با subject=userId واقعی اِعمال می‌شوند —
//  coupon_multi_account (subject=IP) هرگز به‌صورتِ خودکار فلگ نمی‌شود؛
//  IP نمی‌تواند بدونِ ابهام به یک کاربر نگاشت شود، پس فقط در audit می‌ماند
//  و صاحبِ رستوران دستی بررسی می‌کند.
//
//  هرگز خودکار پاک نمی‌شود — پاک‌کردن فقط از طریقِ clearAbuseFlag (اقدامِ
//  آگاهانه‌ی کارمند/appeal)، تا false-positive با یک چرخه‌ی cron دیگر
//  خودبه‌خود ناپدید نشود و کسی متوجهِ آن نشود.
// ═══════════════════════════════════════════════════════════════════════

const USER_SCOPED_KINDS: FraudSignal['kind'][] = ['high_no_show', 'redemption_velocity', 'rapid_book_cancel', 'referral_farming'];

async function flagUserForAbuse(userId: string, sig: FraudSignal, restaurantId: string | null): Promise<void> {
  // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰، با اجرای زنده اثبات شد): اینجا
  // `lastViolationAt: new Date()` هم نوشته می‌شد. آن فیلد مالِ این ماژول
  // نیست — `economy.ts` با آن **decayِ strike** را حساب می‌کند
  // (`applyStrikeDecay`)، و معنایِ مستندش این است: «هر ۹۰ روزِ *بدونِ نقضِ
  // جدید*، یک strike کم می‌شود».
  //
  // ولی این اسکن نقضِ جدیدی نمی‌بیند — همان رزروهای قدیمی را دوباره
  // می‌بیند (پنجره‌ی تشخیصِ high_no_show ۹۰ روزه است). پس هر بار که cron
  // اجرا می‌شد، مهرِ زمانی به «الان» می‌رفت و ساعتِ ریکاوریِ کاربر ریست
  // می‌شد، بدونِ اینکه کارِ بدِ تازه‌ای کرده باشد.
  //
  // بازتولیدِ واقعی: کاربری با ۲ strike و آخرین نقض ۱۰۰ روز پیش → decay
  // باید ۱ بدهد. یک اجرای اسکن → مهر به امروز رفت و strike دوباره ۲ شد.
  // چون رزروهای قدیمی تا ۹۰ روز در پنجره می‌مانند، عملاً دوره‌ی ریکاوری تا
  // دو برابر (۱۸۰ روز) کش می‌آمد — و چون `computeReputationTier` برایِ
  // platinum شرطِ `strikeCount === 0` دارد، کاربر بی‌صدا از بالاترین سطح
  // محروم می‌ماند.
  //
  // فلگِ سوءاستفاده مکانیزمِ ماندگاریِ خودش را دارد (`hasActiveAbuseFlag`،
  // که عمداً هرگز خودکار پاک نمی‌شود — فقط با `clearAbuseFlag`). پس این
  // ماژول نباید به ساعتِ strike دست بزند.
  await db.customerEconomyProfile.upsert({
    where: { userId },
    create: { userId, hasActiveAbuseFlag: true },
    update: { hasActiveAbuseFlag: true },
  });
  await audit({
    action: 'security.abuse_flag',
    actorType: 'anonymous',
    actorId: null,
    targetId: userId,
    restaurantId,
    detail: { fraud: sig.kind, ...sig.metrics },
    success: true,
  }).catch(() => {});
}

/** اجرایِ اسکنِ restaurant-scoped و اِعمالِ فلگِ سوءاستفاده رویِ کاربرانِ سیگنال‌دارِ high. */
export async function applyAbuseFlags(restaurantId: string): Promise<{ signals: FraudSignal[]; flaggedUserIds: string[] }> {
  const signals = await runFraudScan(restaurantId);
  const toFlag = signals.filter((s) => s.severity === 'high' && USER_SCOPED_KINDS.includes(s.kind));
  const flaggedUserIds: string[] = [];
  for (const sig of toFlag) {
    try {
      await flagUserForAbuse(sig.subject, sig, restaurantId);
      flaggedUserIds.push(sig.subject);
    } catch (e) {
      log.warn('اِعمالِ فلگِ سوءاستفاده ناموفق', { userId: sig.subject, kind: sig.kind, error: (e as Error).message });
    }
  }
  return { signals, flaggedUserIds };
}

/** نسخه‌ی سراسریِ پلتفرم (نه per-restaurant) — فقط referral_farming (رفرال restaurant-scoped نیست). */
export async function applyPlatformAbuseFlags(): Promise<{ signals: FraudSignal[]; flaggedUserIds: string[] }> {
  const signals = await detectReferralFarming().catch(() => []);
  const toFlag = signals.filter((s) => s.severity === 'high');
  const flaggedUserIds: string[] = [];
  for (const sig of toFlag) {
    try {
      await flagUserForAbuse(sig.subject, sig, null);
      flaggedUserIds.push(sig.subject);
    } catch (e) {
      log.warn('اِعمالِ فلگِ سوءاستفاده‌ی سراسری ناموفق', { userId: sig.subject, kind: sig.kind, error: (e as Error).message });
    }
  }
  if (signals.length > 0) log.warn('سیگنالِ فارمینگِ رفرال', { count: signals.length, flagged: flaggedUserIds.length });
  return { signals, flaggedUserIds };
}

/**
 * پاک‌کردنِ آگاهانه‌ی فلگِ سوءاستفاده (مسیرِ appeal) — فقط با اقدامِ صریحِ
 * کارمند، هرگز خودکار. staffId برایِ ردِ audit ثبت می‌شود.
 */
export async function clearAbuseFlag(
  userId: string, actorId: string, restaurantId: string | null, actorType: 'staff' | 'admin' = 'staff',
): Promise<void> {
  const result = await db.customerEconomyProfile.updateMany({
    where: { userId },
    data: { hasActiveAbuseFlag: false },
  });
  if (result.count === 0) throw new Error('پروفایلِ اقتصادیِ این کاربر یافت نشد');
  await audit({
    action: 'security.abuse_flag',
    actorType,
    actorId,
    targetId: userId,
    restaurantId,
    detail: { cleared: true },
    success: true,
  }).catch(() => {});
}

/**
 * فلگ‌کردنِ دستیِ ادمینِ پلتفرم (پنلِ شرکت) — وقتی یه الگویِ سوءاستفاده رو
 * تیمِ پلتفرم مستقیم می‌بینه، نه اینکه منتظرِ اسکنِ خودکارِ شبانه بمونه.
 * دقیقاً همون فلگِ خودکار رو ست می‌کنه (hasActiveAbuseFlag)، فقط با
 * actorType='admin' و دلیلِ دستی در audit — تا شفاف بمونه که این تصمیمِ
 * انسانی بوده، نه یه سیگنالِ الگوریتمی.
 */
export async function setAbuseFlagManually(userId: string, adminId: string, reason: string): Promise<void> {
  await db.customerEconomyProfile.upsert({
    where: { userId },
    create: { userId, hasActiveAbuseFlag: true, lastViolationAt: new Date() },
    update: { hasActiveAbuseFlag: true, lastViolationAt: new Date() },
  });
  await audit({
    action: 'security.abuse_flag',
    actorType: 'admin',
    actorId: adminId,
    targetId: userId,
    restaurantId: null,
    detail: { manual: true, reason },
    success: true,
  }).catch(() => {});
}

/**
 * لیستِ کاربرانِ فلگ‌دارِ سراسریِ پلتفرم (پنلِ شرکت) — با آخرین دلیلِ فلگ‌شدن
 * (از audit_logs) تا ادمین بدونه چرا فلگ خورده، نه فقط اینکه فلگ خورده.
 */
export async function listFlaggedAbuseUsers(limit = 100) {
  const profiles = await db.customerEconomyProfile.findMany({
    where: { hasActiveAbuseFlag: true },
    orderBy: { lastViolationAt: 'desc' },
    take: limit,
    select: {
      userId: true, reliabilityScore: true, reputationTier: true, strikeCount: true, lastViolationAt: true,
      user: { select: { firstName: true, lastName: true, phone: true } },
    },
  });
  if (profiles.length === 0) return [];

  const latestAudits = await db.auditLog.findMany({
    where: { action: 'security.abuse_flag', targetId: { in: profiles.map((p) => p.userId) }, success: true },
    orderBy: { createdAt: 'desc' },
    select: { targetId: true, detail: true, restaurantId: true, createdAt: true },
  });
  const reasonByUser = new Map<string, { detail: unknown; restaurantId: string | null }>();
  for (const a of latestAudits) {
    if (!a.targetId || reasonByUser.has(a.targetId)) continue; // اولین (جدیدترینِ) هر کاربر کافیه
    reasonByUser.set(a.targetId, { detail: a.detail, restaurantId: a.restaurantId });
  }

  return profiles.map((p) => {
    const r = reasonByUser.get(p.userId);
    const detail = (r?.detail ?? {}) as Record<string, unknown>;
    return {
      user_id: p.userId,
      name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || 'مشتری',
      phone: p.user.phone,
      reliability_score: p.reliabilityScore,
      reputation_tier: p.reputationTier,
      strike_count: p.strikeCount,
      last_violation_at: p.lastViolationAt,
      flagged_by: detail.manual ? 'admin' : 'auto',
      reason: (detail.manual ? detail.reason as string : detail.fraud as string) ?? null,
      restaurant_id: r?.restaurantId ?? null,
    };
  });
}
