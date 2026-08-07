import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recomputeAllForRestaurant } from '@/lib/customer-insights';
import { recomputeRfmForRestaurant } from '@/lib/rfm';
import { rebuildGuestProfiles } from '@/lib/guest-profile';
import { runAllDueAutomations } from '@/lib/automation';
import { trainAndCalibrateNoShowModel } from '@/lib/no-show-model';
import { invalidatePattern } from '@/lib/cache';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

/**
 * POST /api/v1/maintenance/customer-insights — cron شبانه (هر روز یک‌بار کافی است).
 * ۱) CLV/سگمنت/ریسک هر مشتری را برای همه‌ی رستوران‌ها بازمحاسبه می‌کند
 * ۲) RFM (Recency/Frequency/Monetary) را برای کل کوهورت هر رستوران محاسبه می‌کند
 * ۳) automation های due (birthday/winback/...) را اجرا می‌کند
 * ۴) مدلِ یادگرفته‌ی no-show هر رستوران را از تاریخچه‌ی خودش بازآموزی می‌کند
 *    (lib/no-show-model.ts) — فقط اگر روی هولدآوت واقعاً از heuristic بهتر
 *    باشد فعال می‌ماند؛ وگرنه بی‌صدا به heuristic برمی‌گردد.
 * در crontab با فاصله‌ی روزانه (نه هر ۲-۵ دقیقه مثل بقیه‌ی maintenance) ثبت شود.
 */
export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const restaurants = await db.restaurant.findMany({ select: { id: true } });

    // ⚠️ M5: پردازش موازی محدود (concurrency=4). این job سنگین‌تر است (هر رستوران
    // خودش روی کاربران حلقه می‌زند)، پس concurrency پایین‌تر تا pool اتصال اشباع نشود.
    // چون nightly است، هدف کاهش دیوار زمانی و جلوگیری از timeout است.
    let i = 0, totalUsers = 0, noShowModelsTrained = 0, noShowModelsActive = 0;
    async function worker() {
      while (i < restaurants.length) {
        const r = restaurants[i++];
        totalUsers += await recomputeAllForRestaurant(r.id);
        await recomputeRfmForRestaurant(r.id).catch(() => {});
        // شکستِ آموزشِ مدلِ no-show نباید بازمحاسبه‌ی CLV/RFM بقیه‌ی رستوران‌ها
        // را متوقف کند — این یک بهبودِ اختیاری است، نه مسیرِ حیاتی.
        const trainResult = await trainAndCalibrateNoShowModel(r.id).catch(() => null);
        if (trainResult?.trained) {
          noShowModelsTrained++;
          if (trainResult.isActive) noShowModelsActive++;
        }
        await invalidatePattern(`customers:${r.id}:*`);
        await invalidatePattern(`ai-recs:${r.id}`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, restaurants.length) }, worker));

    const automationResult = await runAllDueAutomations();

    // پروفایل سراسری مهمانان را از insightهای به‌روز بازسازی کن (cross-restaurant)
    const guestProfiles = await rebuildGuestProfiles().catch(() => ({ profiles: 0 }));

    return NextResponse.json({
      ok: true, restaurants: restaurants.length, users_recomputed: totalUsers, guest_profiles: guestProfiles.profiles,
      no_show_models_trained: noShowModelsTrained, no_show_models_active: noShowModelsActive,
      ...automationResult,
    });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
