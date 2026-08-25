import { db } from './db';
import { enqueueSms } from './sms';
import { recordOutreach } from './outreach-ledger';

// ═══════════════════════════════════════════════════════════
//  Marketing Automation — اجراکننده‌ی trigger ها (توسط cron صدا زده می‌شود)
//
//  ⚠️ نکته‌ی مهم سازگاری: enqueueSms از قالب‌های از-پیش‌تأییدشده‌ی
//  Kavenegar با توکن (نه متن آزاد) استفاده می‌کند. بنابراین این فایل
//  متن دلخواه نمی‌سازد؛ به‌جای آن از قالب‌های موجود campaign/winback_offer
//  با توکن [نام, کد تخفیف/نام رستوران, نام رستوران] استفاده می‌کند.
//  اگر قالب اختصاصی برای birthday/no_show_followup لازم شد، باید:
//   ۱) در پنل Kavenegar قالب جدید تعریف شود
//   ۲) به SmsJob['template'] در lib/sms.ts و TEMPLATE_MAP اضافه شود
//   فعلاً برای جلوگیری از خطای ارسال، روی قالب‌های موجود map شده‌اند.
// ═══════════════════════════════════════════════════════════

function templateFor(trigger: string): 'campaign' | 'winback_offer' {
  return trigger === 'winback' || trigger === 'no_show_followup' ? 'winback_offer' : 'campaign';
}

async function targetsForBirthday(restaurantId: string, daysBefore: number) {
  const target = new Date();
  target.setDate(target.getDate() + daysBefore);
  // مقایسه‌ی ماه/روز تولد (سال نامربوط است)
  return db.user.findMany({
    where: {
      birthDate: { not: null },
      memberships: { some: { restaurantId } },
    },
    select: { id: true, phone: true, firstName: true, birthDate: true },
  }).then(rows => rows.filter(u => u.birthDate && u.birthDate.getMonth() === target.getMonth() && u.birthDate.getDate() === target.getDate()));
}

async function targetsForSegment(restaurantId: string, segment: 'at_risk' | 'churned' | 'vip') {
  // M11: VIP یک flag بولی است، نه مقدار segment. برای vip از isVip فیلتر کن؛
  // برای بقیه از segment. این با مدل «VIP = flag» سازگار است و drift ندارد.
  const where = segment === 'vip'
    ? { restaurantId, isVip: true }
    : { restaurantId, segment };
  const rows = await db.customerInsight.findMany({
    where,
    select: { userId: true, user: { select: { phone: true, firstName: true } } },
  });
  return rows.map(r => ({ id: r.userId, phone: r.user.phone, firstName: r.user.firstName }));
}

/**
 * سقفِ عقب‌گردِ پنجره‌ی هدف‌گیری وقتی `lastRunAt` نداریم (اولین اجرا) یا آن‌قدر
 * قدیمی است که پنجره غیرمنطقی بزرگ می‌شود (automation ای که مدت‌ها خاموش بوده
 * و تازه فعال شده).
 *
 * ⚠️ چرا سقف لازم است: بدونِ آن، فعال‌کردنِ دوباره‌ی یک automationِ قدیمی به
 * *همه‌ی* مهمان‌های ماه‌های گذشته پیامک می‌فرستد. جهتِ خطایِ امن اینجا
 * «نفرستادن» است، نه «فرستادنِ انبوه».
 */
const MAX_LOOKBACK_MS = 25 * 3600_000;

/**
 * ابتدایِ پنجره‌ی این اجرا: از آخرین اجرا تا الان — ولی هرگز عقب‌تر از سقف.
 *
 * ⚠️ چرا از `lastRunAt` مشتق می‌شود و نه از یک ثابت: این توابع قبلاً پنجره‌ی
 * ثابتِ «۱ ساعت» و «۶ ساعت» داشتند که فرض می‌کرد cron هر چند دقیقه اجرا
 * می‌شود. واقعیت (api/vercel.json + cron/crontab): تنها فراخوانِ
 * runAllDueAutomations یعنی /v1/maintenance/customer-insights **روزی یک‌بار**
 * (۰۳:۰۰) اجرا می‌شود — پس آن پنجره‌ها تقریباً همیشه خالی بودند. مشتق‌کردن
 * از lastRunAt پنجره را مستقل از آهنگِ cron درست می‌کند: نه شکاف، نه تکرار.
 */
function windowStart(lastRunAt: Date | null | undefined, now: number): Date {
  const floor = now - MAX_LOOKBACK_MS;
  return new Date(lastRunAt ? Math.max(lastRunAt.getTime(), floor) : floor);
}

async function targetsForPostVisit(restaurantId: string, hoursAfter: number, lastRunAt: Date | null | undefined) {
  const now = Date.now();
  const offset = hoursAfter * 3600_000;
  // مهمانی واجدِ پیگیری است که دستِ‌کم `hoursAfter` از پایانِ حضورش گذشته
  // باشد؛ و در اجرای قبلی هنوز واجد نبوده (تا دوبار پیام نگیرد).
  const since = new Date(windowStart(lastRunAt, now).getTime() - offset);
  const until = new Date(now - offset);
  const rows = await db.reservation.findMany({
    where: { restaurantId, status: 'completed', slotEnd: { gt: since, lte: until }, userId: { not: null } },
    select: { userId: true, user: { select: { phone: true, firstName: true } }, code: true },
  });
  return rows.filter(r => r.user).map(r => ({ id: r.userId as string, phone: r.user!.phone, firstName: r.user!.firstName, reservationCode: r.code }));
}

async function targetsForNoShow(restaurantId: string, lastRunAt: Date | null | undefined) {
  const since = windowStart(lastRunAt, Date.now());
  // ⚠️ مبنا زمانِ *ثبتِ عدم‌حضور* است (reservation_events.created_at با
  // to_status='no_show')، نه reservations.created_at. رزرو معمولاً روزها
  // پیش از سانس ثبت می‌شود، پس فیلترِ قبلی روی created_at عملاً هیچ عدمِ
  // حضورِ واقعی‌ای را نمی‌گرفت. lifecycle.transitionReservation تضمین
  // می‌کند هر انتقالِ وضعیت یک ردیفِ event دارد.
  const rows = await db.reservation.findMany({
    where: {
      restaurantId, status: 'no_show', userId: { not: null },
      events: { some: { toStatus: 'no_show', createdAt: { gt: since } } },
    },
    select: { userId: true, user: { select: { phone: true, firstName: true } } },
  });
  return rows.filter(r => r.user).map(r => ({ id: r.userId as string, phone: r.user!.phone, firstName: r.user!.firstName }));
}

/** یک automation را اجرا می‌کند: گیرنده‌ها را پیدا، پیام می‌سازد، صف SMS می‌کند. */
export async function runAutomation(automation: {
  id: string; restaurantId: string; trigger: string; triggerConfig: any;
  messageTemplate: string; couponId: string | null;
  /** آخرین اجرا — مبنایِ پنجره‌ی هدف‌گیریِ post_visit/no_show_followup. */
  lastRunAt?: Date | null;
}) {
  let targets: { id: string; phone: string; firstName: string | null; reservationCode?: string }[] = [];

  switch (automation.trigger) {
    case 'birthday':
      targets = await targetsForBirthday(automation.restaurantId, automation.triggerConfig?.daysBefore ?? 3);
      break;
    case 'winback':
      targets = await targetsForSegment(automation.restaurantId, 'at_risk');
      break;
    case 'vip_milestone':
      targets = await targetsForSegment(automation.restaurantId, 'vip');
      break;
    case 'post_visit':
      targets = await targetsForPostVisit(
        automation.restaurantId, automation.triggerConfig?.hoursAfter ?? 2, automation.lastRunAt,
      );
      break;
    case 'no_show_followup':
      targets = await targetsForNoShow(automation.restaurantId, automation.lastRunAt);
      break;
  }
  if (targets.length === 0) return { sent: 0 };

  let coupon: { code: string } | null = null;
  if (automation.couponId) {
    coupon = await db.coupon.findUnique({ where: { id: automation.couponId }, select: { code: true } });
  }
  const restaurant = await db.restaurant.findUnique({ where: { id: automation.restaurantId }, select: { name: true } });
  const template = templateFor(automation.trigger);

  let sent = 0;
  const delivered: typeof targets = [];
  for (const t of targets) {
    // قالب campaign: [نام, نام رستوران] · قالب winback_offer: [نام, کد تخفیف, نام رستوران]
    const tokens = template === 'winback_offer'
      ? [t.firstName || 'مهمان', coupon?.code || 'WELCOME', restaurant?.name || '']
      : [t.firstName || 'مهمان', restaurant?.name || ''];
    await enqueueSms({ to: t.phone, template, tokens, restaurantId: automation.restaurantId });
    sent++;
    delivered.push(t);
  }
  await db.marketingAutomation.update({
    where: { id: automation.id },
    data: { lastRunAt: new Date(), sentCount: { increment: sent } },
  });

  // ثبتِ گیرنده‌ها در دفترِ ارتباط‌گیری (migration 057) — بدونِ این، نرخِ
  // تبدیل نه محاسبه‌شدنی است و نه بازسازی‌شدنی: تا پیش از این، همین حلقه
  // لیستِ گیرنده‌ها را دور می‌ریخت و فقط یک عددِ sentCount می‌ماند.
  //
  // ⚠️ عمداً *پس از* ارسال است و fail-open: recordOutreach هرگز throw
  // نمی‌کند. شکستِ ثبتِ آمار نباید ارسالی را که واقعاً انجام شده وارونه کند.
  await recordOutreach(delivered.map((t) => ({
    restaurantId: automation.restaurantId,
    userId: t.id,
    channel: 'sms' as const,
    source: 'automation' as const,
    sourceId: automation.id,
    reason: automation.trigger,
  })));

  return { sent };
}

/** برای maintenance/automations: همه‌ی automation های فعال هر رستوران را اجرا می‌کند. */
export async function runAllDueAutomations() {
  const automations = await db.marketingAutomation.findMany({ where: { isActive: true } });
  let totalSent = 0;
  for (const a of automations) {
    // ⚠️ اصلاحِ کامنتِ کهنه: اینجا قبلاً نوشته بود «post_visit/no_show_followup
    // هر اجرا (هر چند دقیقه) چک می‌شوند». تنها فراخوانِ این تابع
    // /v1/maintenance/customer-insights است که طبقِ api/vercel.json و
    // cron/crontab **روزی یک‌بار** اجرا می‌شود. این دو trigger هر اجرا چک
    // می‌شوند، ولی «هر چند دقیقه» نیست — و پنجره‌ی هدف‌گیری‌شان از همین‌جا
    // (lastRunAt) مشتق می‌شود تا به آهنگِ cron وابسته نباشد.
    // birthday/winback/vip_milestone روزی یک‌بار کافی‌ست.
    const dailyOnly = a.trigger === 'birthday' || a.trigger === 'winback' || a.trigger === 'vip_milestone';
    if (dailyOnly && a.lastRunAt && Date.now() - a.lastRunAt.getTime() < 20 * 3600_000) continue;
    const r = await runAutomation(a);
    totalSent += r.sent;
  }
  return { totalSent, ranAt: new Date().toISOString() };
}
