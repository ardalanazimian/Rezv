import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recomputeAllForRestaurant } from '@/lib/customer-insights';
import { recomputeRfmForRestaurant } from '@/lib/rfm';
import { rebuildGuestProfiles } from '@/lib/guest-profile';
import { runAllDueAutomations } from '@/lib/automation';
import { resolveOutreachConversions } from '@/lib/outreach-ledger';
import { applyAbuseFlags, applyPlatformAbuseFlags } from '@/lib/fraud';
import { trainAndCalibrateNoShowModel, trainAndCalibratePlatformNoShowModel } from '@/lib/no-show-model';
import { rollbackDriftedModel, rollbackDriftedPlatformModel } from '@/lib/model-drift';
import { trainAndCalibrateDemandForecast } from '@/lib/demand-forecast';
import { recomputeRestaurantPopularity } from '@/lib/restaurant-popularity';
import { invalidatePattern } from '@/lib/cache';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

import { withApiMetrics } from '@/lib/api-metrics';

const log = createLogger('maintenance:customer-insights');

/**
 * POST /api/v1/maintenance/customer-insights — cron شبانه (هر روز یک‌بار کافی است).
 * ۱) CLV/سگمنت/ریسک هر مشتری را برای همه‌ی رستوران‌ها بازمحاسبه می‌کند
 * ۲) RFM (Recency/Frequency/Monetary) را برای کل کوهورت هر رستوران محاسبه می‌کند
 * ۳) automation های due (birthday/winback/...) را اجرا می‌کند
 * ۴) مدلِ یادگرفته‌ی no-show هر رستوران را از تاریخچه‌ی خودش بازآموزی می‌کند
 *    (lib/no-show-model.ts) — فقط اگر روی هولدآوت واقعاً از heuristic بهتر
 *    باشد فعال می‌ماند؛ وگرنه بی‌صدا به heuristic برمی‌گردد.
 * ۵) پیش‌بینیِ تقاضای هر رستوران را بازآموزی می‌کند (lib/demand-forecast.ts —
 *    Holt-Winters هفتگی برایِ تعدادِ رزرو و کاورها) — همان انضباطِ ایمنی:
 *    فقط با بهبودِ واقعی روی هولدآوت فعال می‌شود.
 * ۶) اسکنِ سوءاستفاده (lib/fraud.ts) را برایِ هر رستوران اجرا می‌کند و
 *    سیگنال‌هایِ high را به CustomerEconomyProfile.hasActiveAbuseFlag وصل
 *    می‌کند؛ در پایان یک اسکنِ سراسریِ پلتفرم (فارمینگِ رفرال) هم اجرا می‌شود.
 * در crontab با فاصله‌ی روزانه (نه هر ۲-۵ دقیقه مثل بقیه‌ی maintenance) ثبت شود.
 */
async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const restaurants = await db.restaurant.findMany({ select: { id: true } });

    // ⚠️ M5: پردازش موازی محدود (concurrency=4). این job سنگین‌تر است (هر رستوران
    // خودش روی کاربران حلقه می‌زند)، پس concurrency پایین‌تر تا pool اتصال اشباع نشود.
    // چون nightly است، هدف کاهش دیوار زمانی و جلوگیری از timeout است.
    let i = 0, totalUsers = 0, noShowModelsTrained = 0, noShowModelsActive = 0, modelsRolledBack = 0;
    let demandForecastsTrained = 0, demandForecastsCountActive = 0, demandForecastsCoversActive = 0;
    let abuseSignals = 0, abuseFlagged = 0;
    async function worker() {
      while (i < restaurants.length) {
        const r = restaurants[i++];
        totalUsers += await recomputeAllForRestaurant(r.id);
        await recomputeRfmForRestaurant(r.id).catch(() => {});
        // شکستِ آموزشِ مدل‌های یادگرفته نباید بازمحاسبه‌ی CLV/RFM بقیه‌ی
        // رستوران‌ها را متوقف کند — این‌ها بهبودِ اختیاری‌اند، نه مسیرِ حیاتی.
        // ⚠️ **پیش از** بازآموزی: اگر مدلِ فعالِ فعلی در تولید خراب شده،
        // همین‌جا پس گرفته می‌شود. ترتیب مهم است — اگر بعد از آموزش می‌آمد،
        // مدلِ تازه‌ی همین شب را بر اساسِ کاراییِ مدلِ **قبلی** قضاوت می‌کرد.
        // بازآموزیِ همین حلقه می‌تواند دوباره فعالش کند، اگر از گیت‌های
        // Brier/AUC/بایاس رد شود. یعنی عقب‌نشینیِ موقت، نه بن‌بست.
        const rollback = await rollbackDriftedModel({ restaurantId: r.id }).catch(() => null);
        if (rollback?.rolledBack) modelsRolledBack++;

        const trainResult = await trainAndCalibrateNoShowModel(r.id).catch(() => null);
        if (trainResult?.trained) {
          noShowModelsTrained++;
          if (trainResult.isActive) noShowModelsActive++;
        }
        const forecastResult = await trainAndCalibrateDemandForecast(r.id).catch(() => null);
        if (forecastResult?.trained) {
          demandForecastsTrained++;
          if (forecastResult.countActive) demandForecastsCountActive++;
          if (forecastResult.coversActive) demandForecastsCoversActive++;
        }
        // اسکنِ سوءاستفاده هم مسیرِ حیاتی نیست — شکستش نباید بقیه‌ی رستوران‌ها را متوقف کند.
        const abuseResult = await applyAbuseFlags(r.id).catch(() => null);
        if (abuseResult) {
          abuseSignals += abuseResult.signals.length;
          abuseFlagged += abuseResult.flaggedUserIds.length;
        }
        await invalidatePattern(`customers:${r.id}:*`);
        await invalidatePattern(`ai-recs:${r.id}`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, restaurants.length) }, worker));

    const automationResult = await runAllDueAutomations();

    // ۷) حلقه‌ی بازخوردِ ارتباط‌گیری را ببند: رزروهای پس از هر تماس/پیامک را
    //    نسبت بده و پنجره‌های تمام‌شده را حل‌شده علامت بزن (migration 057).
    //    ⚠️ *پس از* اجرای automationها می‌آید تا ارسال‌های همین اجرا هم دیده
    //    شوند. شکستش نباید بقیه‌ی جاب را باطل کند — آمار است، نه مسیرِ حیاتی.
    const outreachResult = await resolveOutreachConversions().catch((err) => {
      log.error('حلِ تبدیل‌های دفترِ ارتباط‌گیری شکست خورد', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    // پروفایل سراسری مهمانان را از insightهای به‌روز بازسازی کن (cross-restaurant)
    //
    // ⚠️ شکست را دیگر به «۰ پروفایل» ترجمه نمی‌کنیم. نسخه‌ی قبلی
    // `.catch(() => ({ profiles: 0 }))` داشت و همان یک خط باعث شد یک باگِ
    // واقعی ماه‌ها نامرئی بماند: بعد از migration ۰۴۶ کلِ INSERT با خطای
    // not-null می‌شکست، ولی این جاب `ok:true` و `guest_profiles: 0`
    // برمی‌گرداند — یعنی «موفق بودم و صفر پروفایل ساختم»، درحالی‌که واقعیت
    // «کاملاً شکست خوردم» بود. خطا باید دیده شود، نه به دادهٔ خالی تبدیل.
    let guestProfilesCount: number | null = null;
    let guestProfilesError: string | null = null;
    try {
      guestProfilesCount = (await rebuildGuestProfiles()).profiles;
    } catch (err) {
      guestProfilesError = err instanceof Error ? err.message : String(err);
      log.error('بازسازیِ پروفایلِ سراسریِ مهمانان شکست خورد', { error: guestProfilesError });
    }

    // اسکنِ سراسریِ فارمینگِ رفرال (restaurant-scoped نیست، یک‌بار کافی است)
    const platformAbuse = await applyPlatformAbuseFlags().catch(() => ({ signals: [], flaggedUserIds: [] }));

    // ── مدلِ سراسری: **یک بار** برای کلِ پلتفرم، نه به‌ازای هر رستوران ──
    // بعد از حلقه اجرا می‌شود تا از تازه‌ترین دادهٔ همین شب استفاده کند.
    // شکستش نباید بقیه‌ی نتایج را باطل کند — مثلِ بقیه‌ی کارهای اختیاری.
    // ⚠️ ترتیب عمدی: **اول** بازگردانی، بعد بازآموزی.
    // اگر نسخه‌ی فعالِ فعلی در تولید رانش کرده، باید همین حالا از سرو خارج
    // شود — حتی اگر بازآموزیِ امشب به هر دلیلی جایگزینی نسازد (دادهٔ کم،
    // ردِ گیتِ AUC، بایاس). عکسش یعنی یک شب دیگر سرو شدنِ مدلِ خراب به
    // **همه‌ی** رستوران‌های بدونِ مدلِ اختصاصی.
    const platformRollback = await rollbackDriftedPlatformModel().catch(() => null);
    const platform = await trainAndCalibratePlatformNoShowModel().catch(() => null);

    // ⚠️ رتبه‌بندیِ فیدِ عمومی (مهاجرتِ ۰۷۳): `restaurants.visits_7d` مبنایِ
    // ترتیبِ `GET /v1/restaurants` است — همان فیدی که اپِ مشتری «محبوب
    // امشب» صدایش می‌زند. پیش از این ترتیب `id DESC` (یک UUID) بود، یعنی
    // عملاً تصادفی در حالی که عنوان ادعایِ محبوبیت داشت.
    //
    // جدا catch می‌شود، مثلِ بقیه‌ی گام‌های این job: شکستِ رتبه‌بندی نباید
    // بازآموزیِ مدل‌ها را که تازه تمام شده بی‌اثر کند. شکست یعنی ترتیب یک
    // شب کهنه می‌ماند، نه اینکه غلط شود.
    const popularityUpdated = await recomputeRestaurantPopularity().catch((e) => {
      log.error('بازمحاسبه‌ی محبوبیت شکست خورد — ترتیبِ فید یک شب کهنه می‌ماند', {
        error: (e as Error).message,
      });
      return -1;
    });

    return NextResponse.json({
      popularity_rows_updated: popularityUpdated,
      // ok فقط وقتی true است که واقعاً همه‌چیز انجام شده باشد.
      ok: guestProfilesError === null,
      restaurants: restaurants.length, users_recomputed: totalUsers,
      // null = اجرا شکست خورد (دلیلش در guest_profiles_error)، نه «صفر پروفایل».
      guest_profiles: guestProfilesCount,
      ...(guestProfilesError ? { guest_profiles_error: guestProfilesError } : {}),
      no_show_models_trained: noShowModelsTrained, no_show_models_active: noShowModelsActive,
      // تعدادِ مدل‌هایی که به‌خاطرِ افتِ کارایی در تولید **پس گرفته** شدند.
      // عددِ غیرصفر یعنی سیستم برای آن رستوران‌ها به heuristic برگشته.
      models_rolled_back: modelsRolledBack,
      // مدلِ سراسری — رفعِ سرمای شروع. `trained:false` با دلیلِ صریح
      // برمی‌گردد (مثلاً تنوعِ رستورانِ ناکافی)، نه سکوت.
      platform_model: platform === null ? { trained: false, reason: 'اجرا نشد' } : platform,
      // بازگردانیِ مدلِ سراسری — تا امروز **هیچ مسیری** نداشت، یعنی یک مدلِ
      // سراسریِ خراب تا ابد به همه‌ی رستوران‌های تازه سرو می‌شد (مهاجرتِ ۰۷۱).
      platform_model_rollback: platformRollback === null
        ? { rolledBack: false, reason: 'اجرا نشد' }
        : platformRollback,
      demand_forecasts_trained: demandForecastsTrained,
      demand_forecasts_count_active: demandForecastsCountActive,
      demand_forecasts_covers_active: demandForecastsCoversActive,
      abuse_signals: abuseSignals + platformAbuse.signals.length,
      abuse_flagged_users: abuseFlagged + platformAbuse.flaggedUserIds.length,
      ...automationResult,
      // null = اجرا شکست خورد، نه «صفر تبدیل».
      outreach_converted: outreachResult ? outreachResult.converted : null,
      outreach_expired: outreachResult ? outreachResult.expired : null,
    });
  } catch (e) { return errorResponse(e); }
}


// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/maintenance/customer-insights', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
