import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';

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
    adminAuthFromRequest(req);

    const [noShowRows, demandRows, recentRuns, noShowActiveCount] = await Promise.all([
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
      recent_runs: recentRuns.map((r) => ({
        id: r.id, restaurant_id: r.restaurantId, restaurant_name: r.restaurant.name,
        kind: r.kind, sample_size: r.sampleSize, metrics: r.metrics,
        is_active: r.isActive, reason: r.reason, trained_at: r.trainedAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
