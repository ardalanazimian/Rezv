import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { getLedgerHealth, MIN_RESOLVED_FOR_ACCURACY } from '@/lib/prediction-ledger';
import { getPlatformPerformanceDrift, PERFORMANCE_DRIFT_THRESHOLD } from '@/lib/model-drift';

/**
 * GET /api/v1/admin/ai/model-health — داشبوردِ سلامتِ مدل‌هایِ یادگرفته (پنلِ شرکت).
 *
 * سه بخش:
 *  - summary: چند رستوران مدلِ no-show/demand-forecastِ فعال دارند (یعنی
 *    مدلِ یادگرفته واقعاً از heuristic بهتر بوده و جایگزینش شده)، از چند
 *    رستورانی که اصلاً آموزش دیده‌اند.
 *  - restaurants: وضعیتِ فعلیِ هر رستوران (تک‌ردیفِ RestaurantNoShowModel/
 *    RestaurantDemandForecast — همان چیزی که در مسیرِ داغِ رزرو استفاده می‌شود).
 *  - recent_runs: آخرین ردیف‌هایِ جدولِ append-only model_training_runs
 *    (migration 042) — تاریخچه‌ی «امتحان‌شد، نتیجه چه بود»، نه فقط آخرین وضعیت.
 *
 * نکته: این endpoint چیزی را train نمی‌کند — فقط چیزی را که cronِ شبانه‌ی
 * maintenance/customer-insights قبلاً نوشته می‌خواند.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);

    const [noShowRows, demandRows, recentRuns, noShowActiveCount, ledgerHealth, drift] = await Promise.all([
      db.restaurantNoShowModel.findMany({
        select: {
          restaurantId: true, isActive: true, sampleSize: true, positiveCount: true,
          learnedBrier: true, staticBrier: true, trainedAt: true,
          restaurant: { select: { name: true } },
        },
      }),
      db.restaurantDemandForecast.findMany({
        select: {
          restaurantId: true, historyDays: true, trainedAt: true, countModel: true, coversModel: true,
          restaurant: { select: { name: true } },
        },
      }),
      db.modelTrainingRun.findMany({
        orderBy: { trainedAt: 'desc' },
        take: 100,
        select: {
          id: true, restaurantId: true, kind: true, sampleSize: true, metrics: true,
          isActive: true, reason: true, trainedAt: true,
          restaurant: { select: { name: true } },
        },
      }),
      db.restaurantNoShowModel.count({ where: { isActive: true } }),
      // فازِ ۵ — دقتِ *تولید* از دفترِ پیش‌بینی/نتیجه. عمداً یک بخشِ جداست و
      // با اعدادِ بالا قاطی نمی‌شود: learned_brier آنجا کاراییِ لحظه‌ی آموزش
      // روی هولدآوتِ گذشته است، این یکی چیزی که واقعاً در تولید رخ داد.
      getLedgerHealth({ sinceDays: 90 }),
      // فازِ ۷ — رانشِ کارایی. یک کوئریِ گروهی برای کلِ پلتفرم، نه حلقه.
      getPlatformPerformanceDrift({ windowDays: 30 }),
    ]);

    const demandActiveCounts = demandRows.reduce(
      (acc, r) => {
        const count = r.countModel as unknown as { isActive?: boolean } | null;
        const covers = r.coversModel as unknown as { isActive?: boolean } | null;
        if (count?.isActive) acc.count += 1;
        if (covers?.isActive) acc.covers += 1;
        return acc;
      },
      { count: 0, covers: 0 },
    );

    return NextResponse.json({
      summary: {
        no_show: { restaurants_trained: noShowRows.length, restaurants_active: noShowActiveCount },
        demand_forecast: {
          restaurants_trained: demandRows.length,
          restaurants_count_active: demandActiveCounts.count,
          restaurants_covers_active: demandActiveCounts.covers,
        },
      },
      restaurants: {
        no_show: noShowRows.map((r) => ({
          restaurant_id: r.restaurantId, restaurant_name: r.restaurant.name,
          is_active: r.isActive, sample_size: r.sampleSize, positive_count: r.positiveCount,
          learned_brier: r.learnedBrier, static_brier: r.staticBrier, trained_at: r.trainedAt,
        })),
        demand_forecast: demandRows.map((r) => {
          const count = r.countModel as unknown as { isActive?: boolean; mae?: number; baselineMae?: number } | null;
          const covers = r.coversModel as unknown as { isActive?: boolean; mae?: number; baselineMae?: number } | null;
          return {
            restaurant_id: r.restaurantId, restaurant_name: r.restaurant.name,
            history_days: r.historyDays, trained_at: r.trainedAt,
            count_active: !!count?.isActive, count_mae: count?.mae ?? null, count_baseline_mae: count?.baselineMae ?? null,
            covers_active: !!covers?.isActive, covers_mae: covers?.mae ?? null, covers_baseline_mae: covers?.baselineMae ?? null,
          };
        }),
      },
      // ── دقتِ واقعیِ تولید (فازِ ۵) ──
      // window_days و min_resolved عمداً برگردانده می‌شوند تا UI قانون را
      // دوباره اختراع نکند؛ یک منبعِ حقیقت برای آستانه.
      production_accuracy: {
        window_days: 90,
        min_resolved: MIN_RESOLVED_FOR_ACCURACY,
        groups: ledgerHealth.map((g) => ({
          prediction_type: g.predictionType,
          model_source: g.modelSource,
          resolved_count: g.resolvedCount,
          pending_count: g.pendingCount,
          overdue_count: g.overdueCount,
          brier: g.brier,
          mae: g.mae,
        })),
      },
      // ── رانشِ مدل (فازِ ۷) ──
      // «مدلی که موقعِ ساخت خوب بود، الان هم خوب است؟» — سؤالی که تا پیش از
      // دفترِ فازِ ۵ اصلاً قابلِ پرسیدن نبود.
      drift: {
        window_days: 30,
        threshold: PERFORMANCE_DRIFT_THRESHOLD,
        restaurants: drift.map((d) => ({
          restaurant_id: d.restaurantId,
          restaurant_name: d.restaurantName,
          model_run_id: d.modelRunId,
          holdout_brier: d.holdoutBrier,
          production_brier: d.productionBrier,
          relative_change: d.relativeChange,
          resolved_count: d.resolvedCount,
          verdict: d.verdict,
        })),
      },
      recent_runs: recentRuns.map((r) => ({
        id: r.id, restaurant_id: r.restaurantId, restaurant_name: r.restaurant.name,
        kind: r.kind, sample_size: r.sampleSize, metrics: r.metrics,
        is_active: r.isActive, reason: r.reason, trained_at: r.trainedAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
