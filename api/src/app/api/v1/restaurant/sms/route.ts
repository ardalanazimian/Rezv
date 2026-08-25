import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueueSms } from '@/lib/sms';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { smsAllowedForCategory, findUsersByPhonesForConsent } from '@/lib/notification-prefs';
import { recordOutreach } from '@/lib/outreach-ledger';
import { getClubPointsBalance, ARRIVAL_POINTS } from '@/lib/loyalty';
import { createLogger } from '@/lib/logger';

const log = createLogger('restaurant-sms');

const smsSchema = z.object({
  // ⚠️ `welcome` اضافه شد — و این یک قابلیتِ تازه نیست، رفعِ یک نقضِ رضایت است.
  // پنلِ رستوران بعد از چک‌ین `kind:'campaign'` می‌فرستاد
  // (apps/business/js/reservations.js → markArrived)، یعنی پیامکِ **تراکنشیِ**
  // خوش‌آمد سه اشتباه با خود می‌آورد:
  //  ۱. پشتِ رضایتِ **تبلیغاتیِ** `offers` گیت می‌شد ⇒ مهمانی که فقط از
  //     تبلیغات انصراف داده بود، رسیدِ ورودش را هم از دست می‌داد.
  //  ۲. در دفترِ ارتباط‌گیری با `source:'campaign'` ثبت می‌شد و نرخِ تبدیلِ
  //     کمپین‌ها را آلوده می‌کرد.
  //  ۳. با قالبِ `campaign` و توکن‌های [نام, نامِ رستوران] می‌رفت، نه قالبِ
  //     `welcome_visit` با موجودیِ امتیاز.
  kind: z.enum(['winback', 'campaign', 'welcome']).default('campaign'),
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

type Kind = 'winback' | 'campaign' | 'welcome';

/**
 * ⚠️ سازگاریِ موقتِ کلاینتِ فعلی — قابلِ حذف با یک خط.
 *
 * پنلِ رستوران هنوز `{kind:'campaign', message:'welcome'}` می‌فرستد
 * (apps/business/js/reservations.js:190). تا وقتی آن یک خط به
 * `kind:'welcome'` مهاجرت نکند، نقضِ رضایتِ بالا **زنده** است — و فایل‌های
 * `apps/**` در این batch خارج از دامنه‌ی تغییرند. پس همان ترکیبِ دقیق
 * به‌عنوان نامِ مستعارِ `welcome` پذیرفته می‌شود:
 *  • تطبیق **دقیق** با رشته‌ی ASCIIِ `welcome` است، نه شاملِ آن — یعنی متنِ
 *    فارسیِ یک کمپینِ واقعی هرگز اشتباه گرفته نمی‌شود.
 *  • جهتِ خطا امن است: بدترین حالت یعنی یک پیامک **تراکنشی** حساب شود و
 *    ارسال گردد، نه اینکه یک تبلیغ از گاردِ رضایت فرار کند؛ چون خودِ
 *    `message` هرگز در متنِ ارسالی نمی‌نشیند (فقط در CampaignLog).
 * وقتی پنل مهاجرت کرد، این تابع و فراخوانش حذف می‌شوند.
 */
function resolveKind(kind: Kind, message: string | undefined, restaurantId: string): Kind {
  if (kind === 'campaign' && message === 'welcome') {
    log.warn('نامِ مستعارِ کهنه‌ی پیامکِ خوش‌آمد — کلاینت باید kind:"welcome" بفرستد', { restaurantId });
    return 'welcome';
  }
  return kind;
}

/**
 * POST /api/v1/restaurant/sms — پیامک کمپین/winback/خوش‌آمد.
 * مهاجرت‌شده به wrapper. نیاز به دسترسی مدیریت کمپین (canManageCampaigns).
 */
export const POST = withRestaurantAuth(
  { permission: 'canManageCampaigns', rateLimit: 'auth' },
  async (req, ctx) => {
    const restaurant = ctx.restaurant;
    const b = await parseBody(req, smsSchema);

    const kind = resolveKind(b.kind, b.message, restaurant.id);
    const isTransactional = kind === 'welcome';
    const template: 'winback_offer' | 'campaign' | 'welcome_visit' =
      kind === 'winback' ? 'winback_offer' : kind === 'welcome' ? 'welcome_visit' : 'campaign';

    if (kind === 'welcome' && !b.phones?.length) {
      throw Err.validation('پیامکِ خوش‌آمد به شماره‌ی مشخصِ مهمان نیاز دارد');
    }

    // ⚠️ رعایتِ انصراف (پروتکل §۱۳/§۱۷): winback و campaign هر دو تبلیغاتی‌اند
    // ⇒ دسته‌ی `offers`؛ فقط `false`ِ صریح مانع می‌شود (migration 063).
    // ⚠️ `welcome` **تراکنشی** است و هرگز گیت نمی‌شود (بالا).
    // ⚠️ userId عمداً بخشی از target است (دفترِ ارتباط‌گیری، migration 057):
    // شماره‌ی خامِ بدونِ حساب → userId=null و «قابلِ‌انتساب‌نبودن» شمرده می‌شود.
    // [merge ۰۸-۲۴] دو خطِ توسعه این مسیر را مستقل ساخته بودند — consent از خطِ
    // ممیزی + انتسابِ ledger از main؛ اینجا هر دو با هم اعمال می‌شوند.
    let targets: { phone: string; name: string; userId: string | null }[] = [];
    let optedOut = 0;
    if (b.phones && b.phones.length) {
      // فهرستِ صریحِ شماره‌ها (خوش‌آمدِ چک‌ین، تبریکِ تولد): انصرافِ کاربرانِ
      // شناخته‌شده رعایت می‌شود و شماره‌ی متصل به حساب، userId هم می‌گیرد.
      // ⚠️ جست‌وجو با `findUsersByPhonesForConsent` (یک کوئری برای کلِ فهرست)
      // انجام می‌شود، نه `phone: { in: b.phones }`ِ قبلی: پنل شماره را همان‌طور
      // که در رزرو ذخیره شده پس می‌دهد (`09…` خام) در حالی که `users.phone`
      // همیشه نرمال است (`+989…`) — تطبیقِ دقیقِ قبلی برایِ همان کاربران هیچ
      // ردیفی برنمی‌گرداند و انصرافشان بی‌صدا نادیده گرفته می‌شد.
      const byPhone = await findUsersByPhonesForConsent(b.phones);
      targets = b.phones
        .filter((p) => {
          if (isTransactional) return true;
          const u = byPhone.get(p);
          const keep = !u || smsAllowedForCategory(u.notificationPrefs, 'offers', {
            site: 'restaurant_sms.phones', template, restaurantId: restaurant.id, userId: u.id,
          });
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
          const keep = smsAllowedForCategory(m.user.notificationPrefs, 'offers', {
            site: 'restaurant_sms.segment', template, restaurantId: restaurant.id, userId: m.user.id,
          });
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
      let tokens: string[];
      if (kind === 'welcome') {
        // توکن‌های قالبِ `welcome_visit` عیناً همان‌هایی‌اند که مسیرِ دیگرِ
        // خوش‌آمد (`markArrival` در lib/reservations.ts) می‌فرستد — تا مهمان
        // بسته به اینکه پرسنل از کدام دکمه استفاده کرده، دو متنِ متفاوت نبیند.
        const [member, balance] = await Promise.all([
          t.userId
            ? db.clubMember.findUnique({
                where: { restaurantId_userId: { restaurantId: restaurant.id, userId: t.userId } },
                select: { tier: true },
              })
            : Promise.resolve(null),
          t.userId ? getClubPointsBalance(t.userId, restaurant.id) : Promise.resolve(0),
        ]);
        tokens = [t.name || 'مهمان', String(balance), String(ARRIVAL_POINTS), member?.tier ?? 'bronze'];
      } else if (kind === 'winback') {
        tokens = [t.name || 'مهمان', discount || 'WELCOME', restaurant.name];
      } else {
        tokens = [t.name || 'مهمان', restaurant.name];
      }
      await enqueueSms({ to: t.phone, template, tokens, restaurantId: restaurant.id });
      queued++;
      delivered.push(t);
    }

    // دفترِ ارتباط‌گیری (migration 057): یک ردیف به‌ازای *گیرنده*. CampaignLog
    // پایین‌تر یک ردیف به‌ازای *کمپین* نگه می‌دارد — دو دانه‌بندیِ متفاوت، نه
    // تکرار. fail-open: recordOutreach هرگز throw نمی‌کند.
    //
    // ⚠️ `welcome` وارد هیچ‌کدام نمی‌شود: یک رسیدِ تراکنشی «ارتباط‌گیریِ
    // بازاریابی» نیست. ثبتش هم دفترِ انتساب را باد می‌کرد (هر چک‌ین یک
    // «تماسِ کمپین» می‌شد که رزروِ همان شب را به خودش نسبت می‌داد) و هم
    // تاریخچه‌ی کمپینِ پنل را با ردیف‌های یک‌نفره پر می‌کرد.
    if (!isTransactional) {
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
    }

    // `opted_out` صریح برگردانده می‌شود تا پنل بتواند تفاوتِ «کسی نبود» و
    // «بودند ولی انصراف داده‌اند» را به رستوران‌دار نشان بدهد.
    return NextResponse.json({ queued, kind, opted_out: optedOut });
  },
);
