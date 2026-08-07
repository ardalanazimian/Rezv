import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { sinceDays } from '@/lib/staff-helpers';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { NO_SHOW_FEATURE_NAMES } from '@/lib/no-show-model';
import { getDemandForecast } from '@/lib/demand-forecast';

// ═══════════════════════════════════════════════════════════
//  GET /restaurant/ai/recommendations
//  «AI» اینجا یعنی موتور قانون‌محور شفاف که سیگنال‌های مختلف
//  (CLV، churn، no-show، عملکرد کمپین) را ترکیب و به پیشنهاد
//  عملیاتی رتبه‌بندی‌شده تبدیل می‌کند — نه یک مدل black-box.
//  هر کارت دلیل و عدد پشتش را نشان می‌دهد (قابل‌اعتماد برای صاحب کسب‌وکار).
// ═══════════════════════════════════════════════════════════

type Card = { id: string; severity: 'high' | 'medium' | 'low'; title: string; detail: string; action_label: string; action: Record<string, unknown> };

export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (_req, ctx) => {
  const restaurant = ctx.restaurant;
  const cards = await cached(cacheKey('ai-recs', restaurant.id), 600, async () => {
    const out: Card[] = [];

      // ── ۱) ریسک ریزش: تعداد مشتری at_risk بزرگ‌تر از حد آستانه ──
      const atRisk = await db.customerInsight.count({ where: { restaurantId: restaurant.id, segment: 'at_risk' } });
      const totalCustomers = await db.customerInsight.count({ where: { restaurantId: restaurant.id } });
      if (atRisk > 0 && totalCustomers > 0) {
        const pct = Math.round((atRisk / totalCustomers) * 100);
        out.push({
          id: 'winback', severity: pct > 25 ? 'high' : 'medium',
          title: `${atRisk} مشتری در آستانه‌ی ریزش هستند`,
          detail: `${pct}٪ از مشتریان فعال شما بیش از حد معمول غیبت کرده‌اند. یک کمپین Win-back با کد تخفیف می‌تواند بخشی از آن‌ها را برگرداند.`,
          action_label: 'ساخت کمپین Win-back',
          action: { type: 'create_automation', trigger: 'winback' },
        });
      }

      // ── ۲) no-show بالا در رزروهای آینده‌ی نزدیک ──
      const highRiskUpcoming = await db.reservation.count({
        where: { restaurantId: restaurant.id, status: { in: ['confirmed', 'auto_confirmed', 'pending'] }, slotStart: { gte: new Date(), lte: new Date(Date.now() + 48 * 3600_000) }, noShowRiskTier: 'high' as any },
      });
      if (highRiskUpcoming > 0) {
        out.push({
          id: 'noshow_upcoming', severity: highRiskUpcoming >= 5 ? 'high' : 'medium',
          title: `${highRiskUpcoming} رزرو پرریسک در ۴۸ ساعت آینده`,
          detail: 'این مهمان‌ها سابقه‌ی no-show یا الگوی رزرو پرریسک دارند. یادآوری SMS اضافه یا درخواست بیعانه می‌تواند نرخ no-show را کم کند.',
          action_label: 'ارسال یادآوری گروهی',
          action: { type: 'send_reminder', risk_tier: 'high' },
        });
      }

      // ── ۳) VIPهایی که مدتی نیامده‌اند ──
      const vipAtRisk = await db.customerInsight.count({ where: { restaurantId: restaurant.id, isVip: true, churnRiskScore: { gte: 40 } } });
      if (vipAtRisk > 0) {
        out.push({
          id: 'vip_retention', severity: 'high',
          title: `${vipAtRisk} مشتری VIP کم‌تردد شده‌اند`,
          detail: 'این مشتریان بیشترین ارزش طول عمر را دارند. یک پیام شخصی یا دعوت ویژه از مدیر می‌تواند اثر بیشتری از کمپین عمومی داشته باشد.',
          action_label: 'مشاهده‌ی لیست VIP',
          action: { type: 'view_segment', segment: 'vip' },
        });
      }

      // ── ۴) درآمد روزهای کم‌تردد هفته (برای پیشنهاد تخفیف هدفمند روز) ──
      const dowRows = await db.$queryRaw<{ dow: number; cnt: bigint }[]>`
        SELECT EXTRACT(DOW FROM slot_start)::int AS dow, COUNT(*)::bigint AS cnt
        FROM reservations WHERE restaurant_id = ${restaurant.id}::uuid
          AND status IN ('completed','confirmed','seated') AND slot_start >= ${sinceDays(60)}
        GROUP BY dow ORDER BY cnt ASC LIMIT 1
      `;
      const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
      if (dowRows[0] && Number(dowRows[0].cnt) > 0) {
        out.push({
          id: 'slow_day', severity: 'low',
          title: `${dayNames[dowRows[0].dow]}‌ها کم‌تردد‌ترین روز شماست`,
          detail: 'یک کوپن تخفیف مخصوص همین روز می‌تواند ترافیک را از روزهای پرتقاضا به این روز منتقل کند و ظرفیت خالی را پر کند.',
          action_label: 'ساخت کوپن روز کم‌تردد',
          action: { type: 'create_coupon', suggested_day: dowRows[0].dow },
        });
      }

      // ── ۵) کمپین‌های خودکار بدون فعالیت ──
      const automations = await db.marketingAutomation.findMany({ where: { restaurantId: restaurant.id } });
      if (automations.length === 0) {
        out.push({
          id: 'no_automation', severity: 'medium',
          title: 'هنوز هیچ کمپین خودکاری فعال نیست',
          detail: 'رستوران‌های مشابه با فعال‌کردن یادآوری تولد و win-back خودکار، بازگشت مشتری را به‌طور قابل‌توجهی افزایش داده‌اند.',
          action_label: 'راه‌اندازی اولین کمپین',
          action: { type: 'create_automation', trigger: 'birthday' },
        });
      }

    // اولویت‌بندی: high اول
    out.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));
    return out;
  });

  // ── وضعیتِ مدلِ یادگرفته‌ی no-show — شفاف، نه silent ──
  // این یک «کارت» نیست (کاری برای انجام‌دادن پیشنهاد نمی‌دهد)، بلکه توضیح
  // می‌دهد که آیا پیش‌بینیِ no-showِ همین رستوران از تاریخچه‌ی خودش کالیبره
  // شده یا هنوز از فرمولِ عمومی استفاده می‌شود — تا صاحبِ کسب‌وکار بداند
  // پشتِ عددهایی که می‌بیند چیست.
  const noShowModel = await db.restaurantNoShowModel.findUnique({ where: { restaurantId: restaurant.id } });
  const noShowModelStatus = noShowModel
    ? {
        active: noShowModel.isActive,
        sample_size: noShowModel.sampleSize,
        no_show_count_in_sample: noShowModel.positiveCount,
        accuracy_vs_default_pct: noShowModel.staticBrier > 0
          ? Math.round(((noShowModel.staticBrier - noShowModel.learnedBrier) / noShowModel.staticBrier) * 1000) / 10
          : 0,
        trained_at: noShowModel.trainedAt,
        // شفافیت واقعی: خودِ ضرایب هم قابلِ‌دیدن‌اند، نه فقط نتیجه.
        weights: noShowModel.isActive
          ? Object.fromEntries(NO_SHOW_FEATURE_NAMES.map((name, i) => [name, Math.round(noShowModel.weights[i] * 1000) / 1000]))
          : null,
      }
    : { active: false, sample_size: 0, no_show_count_in_sample: 0, accuracy_vs_default_pct: 0, trained_at: null, weights: null };

  // ── پیش‌بینیِ تقاضا — «۱۴ روزِ آینده چقدر تقاضا داریم؟» ──
  // null یعنی هنوز تاریخچه‌ی کافی برایِ حتی یک تلاشِ آموزش نبوده (رستورانِ
  // تازه). وگرنه همیشه یک پیش‌بینی برمی‌گردد — یا از مدلِ یادگرفته
  // (source:'learned'، وقتی واقعاً از baseline بهتر بوده) یا از پیش‌بینیِ
  // فصلیِ ساده (source:'naive'، شفاف برچسب‌خورده، نه ادعای کاذبِ AI).
  const demandForecast = await getDemandForecast(restaurant.id, 14);

  return NextResponse.json({ cards, no_show_model: noShowModelStatus, demand_forecast: demandForecast });
});
