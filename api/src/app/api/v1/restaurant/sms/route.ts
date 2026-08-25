import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueueSms } from '@/lib/sms';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { allowsCategory } from '@/lib/notification-prefs';
import { recordOutreach } from '@/lib/outreach-ledger';

const smsSchema = z.object({
  kind: z.enum(['winback', 'campaign']).default('campaign'),
  phones: z.array(zPhone).max(500).optional(),
  // ⚠️ `platinum` اضافه شد: از فازِ ۲ ستونِ `club_members.tier` واقعاً نوشته
  // می‌شود و `LOYALTY_TIERS` چهار سطح دارد. بدونِ این مقدار، وفادارترین
  // اعضا با **هیچ** سگمنتی قابلِ هدف‌گیری نبودند (و در «همه» هم که سگمنت
  // فرستاده نمی‌شود می‌افتادند، پس نشتِ آماری نبود — ولی کمپینِ سطح‌محور
  // بی‌صدا از دستشان می‌داد). افزودنی و بدونِ شکستنِ کلاینتِ فعلی.
  segment: z.enum(['gold', 'silver', 'bronze', 'platinum']).optional(),
  discount_code: z.string().max(20).optional(),
  message: z.string().max(500).optional(),
});

/**
 * POST /api/v1/restaurant/sms — پیامک کمپین/winback به اعضای باشگاه.
 * مهاجرت‌شده به wrapper. نیاز به دسترسی مدیریت کمپین (canManageCampaigns).
 */
export const POST = withRestaurantAuth(
  { permission: 'canManageCampaigns', rateLimit: 'auth' },
  async (req, ctx) => {
    const restaurant = ctx.restaurant;
    const b = await parseBody(req, smsSchema);

    const kind = b.kind;
    const template = kind === 'winback' ? 'winback_offer' : 'campaign';

    // ⚠️ رعایتِ انصراف (پروتکل §۱۳/§۱۷): winback و campaign هر دو تبلیغاتی‌اند
    // ⇒ دسته‌ی `offers`؛ فقط `false`ِ صریح مانع می‌شود (migration 063).
    // ⚠️ userId عمداً بخشی از target است (دفترِ ارتباط‌گیری، migration 057):
    // شماره‌ی خامِ بدونِ حساب → userId=null و «قابلِ‌انتساب‌نبودن» شمرده می‌شود.
    // [merge ۰۸-۲۴] دو خطِ توسعه این مسیر را مستقل ساخته بودند — consent از خطِ
    // ممیزی + انتسابِ ledger از main؛ اینجا هر دو با هم اعمال می‌شوند.
    let targets: { phone: string; name: string; userId: string | null }[] = [];
    let optedOut = 0;
    if (b.phones && b.phones.length) {
      // فهرستِ صریحِ شماره‌ها (مثلاً تبریکِ تولد): انصرافِ کاربرانِ شناخته‌شده
      // رعایت می‌شود و شماره‌ی متصل به حساب، userId هم می‌گیرد.
      const known = await db.user.findMany({
        where: { phone: { in: b.phones } },
        select: { id: true, phone: true, notificationPrefs: true },
      });
      const byPhone = new Map(known.map((u) => [u.phone, u]));
      targets = b.phones
        .filter((p) => {
          const u = byPhone.get(p);
          const keep = !u || allowsCategory(u.notificationPrefs, 'offers');
          if (!keep) optedOut++;
          return keep;
        })
        .map((p) => ({ phone: p, name: '', userId: byPhone.get(p)?.id ?? null }));
    } else {
      const tierFilter = b.segment ? { tier: b.segment } : {};
      const members = await db.clubMember.findMany({
        where: { restaurantId: restaurant.id, ...tierFilter },
        include: { user: { select: { id: true, phone: true, firstName: true, notificationPrefs: true } } },
        take: 500,
      });
      targets = members
        .filter(m => m.user?.phone)
        .filter(m => {
          const keep = allowsCategory(m.user.notificationPrefs, 'offers');
          if (!keep) optedOut++;
          return keep;
        })
        .map(m => ({ phone: m.user.phone, name: m.user.firstName || '', userId: m.user.id }));
    }

    if (!targets.length) {
      throw Err.validation(optedOut > 0
        ? `هیچ مخاطبی برای ارسال نماند — ${optedOut} نفر از پیام‌های تبلیغاتی انصراف داده‌اند`
        : 'هیچ مخاطبی برای ارسال یافت نشد');
    }

    const discount = (b.discount_code || '').slice(0, 20);
    let queued = 0;
    const delivered: typeof targets = [];
    for (const t of targets) {
      const tokens = kind === 'winback'
        ? [t.name || 'مهمان', discount || 'WELCOME', restaurant.name]
        : [t.name || 'مهمان', restaurant.name];
      await enqueueSms({ to: t.phone, template: template as 'welcome_visit', tokens, restaurantId: restaurant.id });
      queued++;
      delivered.push(t);
    }

    // دفترِ ارتباط‌گیری (migration 057): یک ردیف به‌ازای *گیرنده*. CampaignLog
    // پایین‌تر یک ردیف به‌ازای *کمپین* نگه می‌دارد — دو دانه‌بندیِ متفاوت، نه
    // تکرار. fail-open: recordOutreach هرگز throw نمی‌کند.
    await recordOutreach(delivered.map((t) => ({
      restaurantId: restaurant.id,
      userId: t.userId,
      channel: 'sms' as const,
      source: 'campaign' as const,
      reason: kind,
    })));

    // ثبت در تاریخچه‌ی کمپین (تا در پنل قابل‌مشاهده باشد) — شکست لاگ نباید ارسال را خراب کند
    try {
      await db.campaignLog.create({
        data: {
          restaurantId: restaurant.id,
          segment: (b.segment || (b.phones?.length ? 'custom' : 'all')).toString().slice(0, 40),
          message: (b.message || b.discount_code || kind).toString().slice(0, 500),
          recipientsCount: queued,
        },
      });
    } catch { /* لاگ‌نشدن تاریخچه نباید جلوی ارسال را بگیرد */ }

    // `opted_out` صریح برگردانده می‌شود تا پنل بتواند تفاوتِ «کسی نبود» و
    // «بودند ولی انصراف داده‌اند» را به رستوران‌دار نشان بدهد.
    return NextResponse.json({ queued, kind, opted_out: optedOut });
  },
);
