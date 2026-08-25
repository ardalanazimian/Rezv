import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidatePattern } from '@/lib/cache';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { recordOutreach } from '@/lib/outreach-ledger';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۸ — بستنِ حلقه‌ی بازخوردِ توصیه‌های CRM
//
//  ⚠️ نقصی که این endpoint از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۰):
//  `lib/crm-recommendations.ts` یک لایه‌ی تصمیمِ قانون‌محورِ خالص است — به
//  رستوران‌دار می‌گوید «با کی، چرا، از چه کانالی تماس بگیر». ولی هیچ‌جا ثبت
//  نمی‌شد که آیا تماسی گرفته شد و آیا اثری داشت. یعنی دقیقاً همان وضعیتی که
//  فازِ ۵ برای پیش‌بینیِ no-show رفع کرد: توصیه تولید می‌شد، نمایش داده
//  می‌شد، و برای همیشه ناسنجیده می‌ماند.
//
//  دکمه‌ی «تماس» در پنل تا امروز فقط `tel:` را باز می‌کرد و هیچ ردی نمی‌گذاشت.
//  حالا همان دکمه اینجا را هم صدا می‌زند.
//
//  ⚠️ چرا فقط کانالِ 'call' اینجا ثبت می‌شود و 'sms' نه: دکمه‌ی پیامک در پنل
//  فقط تبِ کمپین را باز می‌کند و هیچ پیامی نمی‌فرستد. ثبتِ «ارتباط‌گیری» در آن
//  لحظه یعنی ادعای کاری که انجام نشده — همان جعلی که این فیچر برای رفعش
//  ساخته شد. پیامکِ واقعی وقتی از تبِ کمپین برود، مسیرِ `restaurant/sms`
//  خودش ثبتش می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const schema = z.object({
  user_id: z.string().uuid(),
});

/**
 * POST /restaurant/crm/recommendations/contacted — «با این مشتری تماس گرفتم».
 *
 * ⚠️ ایزولاسیونِ تنانت: وجودِ `customerInsight` برای همین رستوران بررسی
 * می‌شود، نه فقط وجودِ کاربر. بدونِ این، هر رستوران می‌توانست برای هر
 * userId دلخواهی ردیف بسازد — هم آلوده‌کردنِ دفتر، هم یک probe برای
 * فهمیدنِ اینکه کدام شناسه‌ها در پلتفرم وجود دارند.
 */
export const POST = withRestaurantAuth(
  { permission: 'canViewAnalytics', rateLimit: 'auth' },
  async (req, ctx) => {
    const b = await parseBody(req, schema);
    const restaurantId = ctx.restaurant.id;

    const insight = await db.customerInsight.findUnique({
      where: { restaurantId_userId: { restaurantId, userId: b.user_id } },
      select: { segment: true, churnRiskScore: true },
    });
    // پیامِ خطا عمداً بینِ «کاربر وجود ندارد» و «مشتریِ این رستوران نیست»
    // تفاوت نمی‌گذارد — همان تفاوت خودش نشتِ اطلاعات است.
    if (!insight) throw Err.notFound('این مشتری در پایگاهِ مشتریانِ شما نیست');

    // ⚠️ recordOutreach عمداً fail-open است و throw نمی‌کند؛ پس تعدادِ ثبت‌شده
    // را برمی‌گردانیم تا کلاینت بتواند بینِ «ثبت شد» و «ثبت نشد» فرق بگذارد،
    // به‌جای اینکه ۲۰۰ی همیشه-موفق ببیند.
    const recorded = await recordOutreach([{
      restaurantId,
      userId: b.user_id,
      channel: 'call',
      source: 'crm_recommendation',
      reason: `${insight.segment} · ریسکِ ریزش ${insight.churnRiskScore}`,
    }]);

    // کارتِ توصیه‌ها ۵ دقیقه کش می‌شود؛ بعد از ثبتِ تماس باید تازه شود.
    await invalidatePattern(`crm-recs:${restaurantId}`);

    return NextResponse.json({ recorded: recorded === 1 }, { status: recorded === 1 ? 201 : 202 });
  },
);
