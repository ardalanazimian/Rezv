import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueueSms, toLocalNumber } from '@/lib/sms';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { smsAllowedForCategory, findUsersByPhonesForConsent, phoneLookupVariants } from '@/lib/notification-prefs';
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

// ═══════════════════════════════════════════════════════════════════════
//  «تراکنشی» یک واقعیتِ سمتِ سرور است، نه ادعای کلاینت
//
//  ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ (دور زدنِ کاملِ گاردِ رضایت با یک فیلدِ بدنه):
//  `kind` مستقیم از بدنه‌ی درخواست می‌آمد و `kind === 'welcome'` یعنی
//  `isTransactional = true` ⇒ فیلترِ رضایت عملاً `return true` می‌شد. چون
//  `phones` هم هیچ‌وقت با این رستوران تطبیق داده نمی‌شد، یک کارمندِ دارای
//  `canManageCampaigns` با
//     {kind:'welcome', phones:[۵۰۰ شماره‌ی دلخواه]}
//  انصرافِ **همه‌ی** گیرنده‌ها را نادیده می‌گرفت — و چون مسیرِ تراکنشی عمداً
//  در دفترِ ارتباط‌گیری/تاریخچه‌ی کمپین ثبت نمی‌شود، هیچ ردی هم نمی‌ماند.
//
//  رفع (کمینه و قابلِ‌اثبات): معافیتِ تراکنشی فقط به شماره‌ای می‌رسد که
//  **سرور** می‌تواند بگوید به‌تازگی در همین رستوران رسیده است. رسیدِ ورود
//  برای کسی که نیامده اصلاً «رسید» نیست؛ پس شماره‌های تأییدنشده حذف
//  می‌شوند و در پاسخ صریحاً شمرده می‌شوند (`unverified`) — نه سکوت، نه
//  موفقیتِ جعلی. کسی که واقعاً می‌خواهد به فهرستِ دلخواه پیام بدهد همان
//  مسیرِ `campaign` را دارد که رضایت را رعایت و در دفتر ثبت می‌کند.
// ═══════════════════════════════════════════════════════════════════════

/** وضعیت‌هایی که یعنی «مهمان واقعاً رسید». */
const ARRIVED_STATUSES = ['checked_in', 'seated', 'dining', 'completed'] as const;

/**
 * پنجره‌ی «به‌تازگی». پنل بلافاصله بعد از چک‌ین پیامک می‌فرستد
 * (`apps/business/js/reservations.js` → markArrived)، پس ۲۴ ساعت بسیار
 * سخاوتمندانه است و در عین حال یک رزروِ ماه‌ها پیش را مجوزِ دائمیِ ارسال
 * نمی‌کند.
 */
const ARRIVAL_WINDOW_MS = 24 * 3600_000;

/**
 * از میانِ شماره‌های درخواست‌شده، کدام‌ها به یک ورودِ واقعیِ اخیر در **همین**
 * رستوران وصل‌اند؟
 *
 * ⚠️ تطبیق در هر دو جهت نرمال‌سازی می‌شود: پنل شماره را از
 * `user.phone` (`+989…`) یا `guest_phone` (خام، `09…`) پس می‌دهد و این دو
 * برای یک نفر متفاوت‌اند (شرحِ کامل در lib/notification-prefs.ts). تطبیقِ
 * دقیقِ تک‌فرمتی یعنی مهمانِ واقعی «تأییدنشده» شود و رسیدش نرود.
 */
async function recentArrivalPhones(restaurantId: string, phones: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!phones.length) return out;

  const variantsOf = new Map<string, string[]>();
  const all = new Set<string>();
  for (const p of phones) {
    const v = [...new Set([...phoneLookupVariants(p), toLocalNumber(p)])];
    variantsOf.set(p, v);
    for (const x of v) all.add(x);
  }

  const now = Date.now();
  const rows = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { in: [...ARRIVED_STATUSES] },
      slotStart: { gte: new Date(now - ARRIVAL_WINDOW_MS), lte: new Date(now + ARRIVAL_WINDOW_MS) },
      OR: [{ guestPhone: { in: [...all] } }, { user: { phone: { in: [...all] } } }],
    },
    select: { guestPhone: true, user: { select: { phone: true } } },
    take: 2000,
  });

  const arrived = new Set<string>();
  for (const r of rows) {
    if (r.guestPhone) arrived.add(r.guestPhone);
    if (r.user?.phone) arrived.add(r.user.phone);
  }
  for (const p of phones) {
    if ((variantsOf.get(p) ?? []).some((v) => arrived.has(v))) out.add(p);
  }
  return out;
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
    // ⚠️ این پرچم به‌تنهایی دیگر «ادعای کلاینت» نیست: پایین‌تر، فهرستِ
    // گیرنده‌های `welcome` به شماره‌هایی محدود می‌شود که سرور ورودِ اخیرشان
    // را در همین رستوران تأیید کرده. یعنی وقتی به فیلترِ رضایت می‌رسیم، هر
    // شماره‌ی باقی‌مانده واقعاً تراکنشی است.
    const isTransactional = kind === 'welcome';
    const template: 'winback_offer' | 'campaign' | 'welcome_visit' =
      kind === 'winback' ? 'winback_offer' : kind === 'welcome' ? 'welcome_visit' : 'campaign';

    if (kind === 'welcome' && !b.phones?.length) {
      throw Err.validation('پیامکِ خوش‌آمد به شماره‌ی مشخصِ مهمان نیاز دارد');
    }

    // ── معافیتِ تراکنشی فقط برای ورودِ تأییدشده‌ی سمتِ سرور (بالا) ──
    let phones = b.phones;
    let unverified = 0;
    if (kind === 'welcome') {
      const arrived = await recentArrivalPhones(restaurant.id, b.phones!);
      phones = b.phones!.filter((p) => arrived.has(p));
      unverified = b.phones!.length - phones.length;
      if (unverified > 0) {
        log.warn('پیامکِ خوش‌آمد برای شماره‌های بدونِ ورودِ اخیر رد شد', {
          restaurantId: restaurant.id, requested: b.phones!.length, unverified,
        });
      }
      if (!phones.length) {
        throw Err.validation(
          'پیامکِ خوش‌آمد فقط برای مهمانی که در ۲۴ ساعتِ گذشته در همین رستوران چک‌این شده ارسال می‌شود؛ برای پیامِ گروهی از کمپین استفاده کن',
          { unverified },
        );
      }
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
    if (phones && phones.length) {
      // فهرستِ صریحِ شماره‌ها (خوش‌آمدِ چک‌ین، تبریکِ تولد): انصرافِ کاربرانِ
      // شناخته‌شده رعایت می‌شود و شماره‌ی متصل به حساب، userId هم می‌گیرد.
      // ⚠️ جست‌وجو با `findUsersByPhonesForConsent` (یک کوئری برای کلِ فهرست)
      // انجام می‌شود، نه `phone: { in: b.phones }`ِ قبلی: پنل شماره را همان‌طور
      // که در رزرو ذخیره شده پس می‌دهد (`09…` خام) در حالی که `users.phone`
      // همیشه نرمال است (`+989…`) — تطبیقِ دقیقِ قبلی برایِ همان کاربران هیچ
      // ردیفی برنمی‌گرداند و انصرافشان بی‌صدا نادیده گرفته می‌شد.
      const byPhone = await findUsersByPhonesForConsent(phones);
      targets = phones
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

    // ═══════════════════════════════════════════════════════════════════
    //  رفعِ P0 (۲۰۲۶-۰۸-۲۶): متنِ کمپین حالا واقعاً ارسال می‌شود.
    //
    //  ⚠️ باگی که رفع شد: `b.message` پذیرفته می‌شد (پس API با ۲۰۰ برمی‌گشت)
    //  ولی **هیچ‌وقت** به `enqueueSms` نمی‌رسید — تنها مصرفش ذخیره در
    //  `campaignLog.message` بود. یعنی رستوران‌دار متن را در پیش‌نمایشی که
    //  می‌گفت «دقیقاً همینطوری ارسال می‌شه» تأیید می‌کرد، پولِ واقعیِ پیامک
    //  خرج می‌شد، و مشتری یک قالبِ ثابتِ کاملاً متفاوت می‌گرفت.
    //
    //  چرا تا امروز رفع نشده بود: کاوه‌نگار فقط `verify/lookup`ِ الگومحور
    //  داشت و ارسالِ متنِ آزاد اصلاً ممکن نبود. با مهاجرت به ملی‌پیامک
    //  (`SendSMS`) این مسیر باز شد.
    //
    //  ⚠️ متنِ آزاد خطِ اختصاصی می‌خواهد (`MELIPAYAMAK_FROM`). اگر تنظیم
    //  نباشد، لایه‌ی sms **صریح شکست می‌خورد و لاگ می‌کند** — بی‌صدا به قالب
    //  برنمی‌گردد، چون آن دقیقاً همان باگِ بالا را برمی‌گرداند.
    // ═══════════════════════════════════════════════════════════════════
    const customText = kind === 'campaign' ? (b.message || '').trim() : '';

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
      await enqueueSms({
        to: t.phone, template, tokens, restaurantId: restaurant.id,
        // متنِ آزادِ کمپین (ادغامِ ۲۰۲۶-۰۸-۲۶ از خطِ ملی‌پیامک): «دقیقاً
        // همینطوری ارسال می‌شه» فقط با همین واقعاً درست است. `{نام}` تنها
        // جای‌گذاریِ پشتیبانی‌شده است.
        ...(customText ? { text: customText.replace(/\{نام\}/g, t.name || 'مهمان') } : {}),
      });
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
    // `unverified` همان صداقت را برای حالتِ سوم می‌دهد: «این شماره‌ها اینجا
    // ورودِ اخیری نداشتند، پس رسیدِ خوش‌آمد برایشان معنا ندارد» — بی‌صدا
    // حذف‌شدن بدترین حالت بود.
    return NextResponse.json({ queued, kind, opted_out: optedOut, unverified });
  },
);
