import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';
import { clearAbuseFlag } from '@/lib/fraud';

const paramsSchema = z.object({ userId: zUuid });

export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (_req, ctx, rawParams: { userId: string }) => {
  const { userId } = parseParams(rawParams, paramsSchema);
  const insight = await db.customerInsight.findUnique({
    where: { restaurantId_userId: { restaurantId: ctx.restaurant.id, userId } },
    include: { user: { select: { firstName: true, lastName: true, phone: true, birthDate: true, avatarUrl: true } } },
  });
  if (!insight) throw Err.notFound('سابقه‌ی این مشتری برای این رستوران یافت نشد');

  const timeline = await db.reservation.findMany({
    where: { restaurantId: ctx.restaurant.id, userId },
    orderBy: { slotStart: 'desc' },
    take: 20,
    select: { code: true, status: true, slotStart: true, partySize: true, items: { select: { qty: true, menuItem: { select: { name: true, priceToman: true } } } } },
  });

  // اقتصادِ مشتری (اعتبار/سوءاستفاده) سراسری/per-User است، نه per-restaurant —
  // پس یک کوئریِ جداست، نه join با customer_insights (که restaurant-scoped است).
  const economy = await db.customerEconomyProfile.findUnique({
    where: { userId },
    select: { reliabilityScore: true, reputationTier: true, strikeCount: true, hasActiveAbuseFlag: true, lastViolationAt: true },
  });

  return NextResponse.json({
    user: {
      name: [insight.user.firstName, insight.user.lastName].filter(Boolean).join(' ') || 'مشتری',
      phone: insight.user.phone,
      birth_date: insight.user.birthDate,
      avatar_url: insight.user.avatarUrl,
    },
    clv: {
      total_visits: insight.totalVisits,
      total_spend_toman: insight.totalSpendToman,
      avg_spend_toman: insight.avgSpendToman,
      visit_frequency_days: insight.visitFrequencyDays,
      predicted_clv_toman: insight.predictedClvToman,
      first_visit_at: insight.firstVisitAt,
      last_visit_at: insight.lastVisitAt,
    },
    risk: {
      no_show_count: insight.noShowCount,
      cancel_count: insight.cancelCount,
      no_show_rate_pct: insight.noShowRatePct,
      churn_risk_score: insight.churnRiskScore,
    },
    economy: {
      reliability_score: economy?.reliabilityScore ?? null,
      reputation_tier: economy?.reputationTier ?? null,
      strike_count: economy?.strikeCount ?? 0,
      has_active_abuse_flag: economy?.hasActiveAbuseFlag ?? false,
      last_violation_at: economy?.lastViolationAt ?? null,
    },
    segment: insight.segment,
    is_vip: insight.isVip,
    timeline: timeline.map(r => ({
      code: r.code, status: r.status, slot_start: r.slotStart, party_size: r.partySize,
      spend_toman: r.items.reduce((s, it) => s + it.qty * it.menuItem.priceToman, 0),
      items: r.items.map(it => `${it.menuItem.name} ×${it.qty}`),
    })),
  });
});

/**
 * پاک‌کردنِ فلگِ سوءاستفاده (appeal path) — فقط staffیِ دارایِ canManageSettings
 * (همان سطحِ حساسیتِ تنظیماتِ رستوران/سیاستِ کنسلی). هرگز خودکار نیست.
 */
export const PATCH = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (_req, ctx, rawParams: { userId: string }) => {
  const { userId } = parseParams(rawParams, paramsSchema);

  // ⚠️ تصحیحِ کامنتِ نادرست (۲۰۲۶-۰۹-۰۶). اینجا قبلاً نوشته بود «رفعِ نشتِ
  // دامنه» و ادعا می‌کرد رستورانِ A دیگر نمی‌تواند فلگِ اسکنِ رستورانِ B را
  // پاک کند. **آن ادعا غلط بود و هست.** آنچه واقعاً رفع شد فقط شمارشِ
  // کاربرانِ پلتفرم از تفاوتِ ۲۰۰/۴۰۴ بود.
  //
  // چیزی که گاردِ زیر **اثبات می‌کند**:
  //   این کاربر دستِ‌کم یک‌بار مشتریِ همین رستوران بوده (ردیفِ customerInsight
  //   با restaurantId ما دارد) — یعنی یک شناسه‌ی تصادفی/بیگانه رد نمی‌شود.
  //
  // چیزی که **اثبات نمی‌کند**:
  //   اینکه نوشتنِ بعدی به این رستوران محدود می‌ماند. نمی‌ماند.
  //   `clearAbuseFlag` رویِ `customer_economy_profiles` با کلیدِ `userId`
  //   می‌نویسد و **هیچ قیدِ رستورانی ندارد** (lib/fraud.ts) — فلگ عمداً
  //   پلتفرم‌محور است. پس هر رستورانی که این کاربر یک‌بار مهمانش بوده،
  //   می‌تواند فلگی را که اسکنِ رستورانِ **دیگری** زده بردارد و لایه‌ی ۴ی
  //   `resolvePolicy` (سپرده/تأییدِ خودکار) را در کلِ پلتفرم خاموش کند.
  //
  // «چه کسی حق دارد پاک کند» یک تصمیمِ محصولی است (ادمینِ پلتفرم؟ فقط
  // رستورانی که فلگ را زده؟) و در بسته‌ی تصمیمِ ۲۰۲۶-۰۹-۰۶ به مالک ارجاع
  // شده. تا آن تعیینِ تکلیف، رفتار عمداً دست‌نخورده مانده و فقط صادقانه
  // مستند و قابلِ‌ردیابی شده. یک کامنتی که رفعِ ناموجود را ادعا کند از
  // نبودِ کامنت بدتر است — همان کلاسی که این مخزن برایش پرونده دارد.
  const rel = await db.customerInsight.findUnique({
    where: { restaurantId_userId: { restaurantId: ctx.restaurant.id, userId } },
    select: { userId: true },
  });
  if (!rel) throw Err.notFound('سابقه‌ی این مشتری برای این رستوران');

  let audited = false;
  try {
    ({ audited } = await clearAbuseFlag(userId, ctx.auth.sub, ctx.restaurant.id));
  } catch (e) {
    throw Err.notFound((e as Error).message || 'پروفایلِ اقتصادیِ این کاربر یافت نشد');
  }
  // ⚠️ `audited` صریح در پاسخ می‌آید: این یک نوشتنِ **برگشت‌ناپذیر و
  // پلتفرم‌محور** است، و `ok: true`ِ تنها ادعا می‌کرد ردِ حسابرسی هم نشسته
  // — چیزی که تضمین‌شده نبود (`audit()` best-effort است). شکست از قبل در
  // `rezervno_audit_write_failed_total` شمرده شده؛ این فیلد همان حقیقت را
  // به صداکننده هم می‌گوید، بدونِ اینکه کنشِ انجام‌شده را وارونه کند.
  return NextResponse.json({ ok: true, audited });
});
