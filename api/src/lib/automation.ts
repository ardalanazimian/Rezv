import { db } from './db';
import { enqueueSms } from './sms';

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

async function targetsForPostVisit(restaurantId: string, hoursAfter: number) {
  const since = new Date(Date.now() - (hoursAfter + 1) * 3600_000);
  const until = new Date(Date.now() - hoursAfter * 3600_000);
  const rows = await db.reservation.findMany({
    where: { restaurantId, status: 'completed', slotEnd: { gte: since, lt: until }, userId: { not: null } },
    select: { userId: true, user: { select: { phone: true, firstName: true } }, code: true },
  });
  return rows.filter(r => r.user).map(r => ({ id: r.userId as string, phone: r.user!.phone, firstName: r.user!.firstName, reservationCode: r.code }));
}

async function targetsForNoShow(restaurantId: string) {
  const since = new Date(Date.now() - 6 * 3600_000);
  const rows = await db.reservation.findMany({
    where: { restaurantId, status: 'no_show', createdAt: { gte: since }, userId: { not: null } },
    select: { userId: true, user: { select: { phone: true, firstName: true } } },
  });
  return rows.filter(r => r.user).map(r => ({ id: r.userId as string, phone: r.user!.phone, firstName: r.user!.firstName }));
}

/** یک automation را اجرا می‌کند: گیرنده‌ها را پیدا، پیام می‌سازد، صف SMS می‌کند. */
export async function runAutomation(automation: {
  id: string; restaurantId: string; trigger: string; triggerConfig: any;
  messageTemplate: string; couponId: string | null;
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
      targets = await targetsForPostVisit(automation.restaurantId, automation.triggerConfig?.hoursAfter ?? 2);
      break;
    case 'no_show_followup':
      targets = await targetsForNoShow(automation.restaurantId);
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
  for (const t of targets) {
    // قالب campaign: [نام, نام رستوران] · قالب winback_offer: [نام, کد تخفیف, نام رستوران]
    const tokens = template === 'winback_offer'
      ? [t.firstName || 'مهمان', coupon?.code || 'WELCOME', restaurant?.name || '']
      : [t.firstName || 'مهمان', restaurant?.name || ''];
    await enqueueSms({ to: t.phone, template, tokens, restaurantId: automation.restaurantId });
    sent++;
  }
  await db.marketingAutomation.update({
    where: { id: automation.id },
    data: { lastRunAt: new Date(), sentCount: { increment: sent } },
  });
  return { sent };
}

/** برای maintenance/automations: همه‌ی automation های فعال هر رستوران را اجرا می‌کند. */
export async function runAllDueAutomations() {
  const automations = await db.marketingAutomation.findMany({ where: { isActive: true } });
  let totalSent = 0;
  for (const a of automations) {
    // post_visit/no_show_followup هر اجرا (هر چند دقیقه) چک می‌شوند؛ birthday/winback روزی یک‌بار کافی‌ست
    const dailyOnly = a.trigger === 'birthday' || a.trigger === 'winback' || a.trigger === 'vip_milestone';
    if (dailyOnly && a.lastRunAt && Date.now() - a.lastRunAt.getTime() < 20 * 3600_000) continue;
    const r = await runAutomation(a);
    totalSent += r.sent;
  }
  return { totalSent, ranAt: new Date().toISOString() };
}
