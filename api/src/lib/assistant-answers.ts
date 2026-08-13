import { db } from './db';
import { ACTIVE_RESERVATION_STATUSES } from './reservation-status';
import { getManagerInsights, getWeekdayRanking } from './restaurant-manager';
import { getDemandForecast } from './demand-forecast';
import type { AssistantIntent } from './assistant-nlu';

// ═══════════════════════════════════════════════════════════════════════
//  تولیدِ پاسخِ فارسی برای هر نیتِ دستیار — از داده‌ی واقعیِ همین رستوران،
//  نه یک متنِ ثابت یا عددِ حدسی. هرجا داده کافی نبود، همین صادقانه گفته
//  می‌شود («هنوز داده‌ی کافی نداریم») نه یک عددِ ساختگی.
//
//  جایی که منطقِ محاسبه از قبل وجود داشت (رتبه‌بندیِ روزها، مشتریانِ
//  at_risk، مدلِ no-show، پیش‌بینیِ تقاضا) از همان lib موجود استفاده
//  می‌شود — دوباره‌کاری نشده.
// ═══════════════════════════════════════════════════════════════════════

const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
function fmt(n: number): string { return n.toLocaleString('fa-IR'); }

function dayRange(offsetDays: number): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function answerReservationsForDay(restaurantId: string, offsetDays: number, label: string): Promise<string> {
  const { start, end } = dayRange(offsetDays);
  const count = await db.reservation.count({
    where: { restaurantId, status: { in: ACTIVE_RESERVATION_STATUSES as any }, slotStart: { gte: start, lt: end } },
  });
  if (count === 0) return `برای ${label} فعلاً هیچ رزروِ فعالی ثبت نشده.`;
  return `${label} ${fmt(count)} رزروِ فعال دارید.`;
}

async function answerBusiestDay(restaurantId: string): Promise<string> {
  const ranking = await getWeekdayRanking(restaurantId);
  if (!ranking) return 'هنوز به‌اندازه‌ی کافی تاریخچه‌ی رزرو نداریم تا روزهای هفته را رتبه‌بندی کنیم.';
  const top = ranking[0];
  return `${DAY_NAMES_FA[top.dow]} پرترددترین روزِ شماست — ${fmt(top.count)} رزرو در ۶۰ روزِ اخیر.`;
}

async function answerSlowDay(restaurantId: string): Promise<string> {
  const ranking = await getWeekdayRanking(restaurantId);
  if (!ranking) return 'هنوز به‌اندازه‌ی کافی تاریخچه‌ی رزرو نداریم تا روزهای هفته را رتبه‌بندی کنیم.';
  const bottom = ranking[ranking.length - 1];
  return `${DAY_NAMES_FA[bottom.dow]} کم‌ترددترین روزِ شماست — ${fmt(bottom.count)} رزرو در ۶۰ روزِ اخیر. یک کوپنِ اختصاصیِ همین روز می‌تواند ترافیک را جابه‌جا کند.`;
}

async function answerAtRiskCustomers(restaurantId: string): Promise<string> {
  const insights = await getManagerInsights(restaurantId);
  const found = insights.find((a) => a.id === 'at_risk_customers');
  if (!found) return 'الان مشتریِ خاصی در آستانه‌ی ریزش نیست، یا هنوز داده‌ی کافی برای این تحلیل نداریم.';
  return `${found.finding} ${found.recommended_action ?? ''}`.trim();
}

async function answerVipCustomers(restaurantId: string): Promise<string> {
  const vipCount = await db.customerInsight.count({ where: { restaurantId, isVip: true } });
  if (vipCount === 0) return 'فعلاً هیچ مشتری‌ای به سطحِ VIP نرسیده.';
  return `${fmt(vipCount)} مشتریِ VIP دارید. از تبِ «مشتریان» می‌توانید لیستِ کاملشان را ببینید.`;
}

async function answerUnderusedTables(restaurantId: string): Promise<string> {
  const insights = await getManagerInsights(restaurantId);
  const found = insights.find((a) => a.id === 'underutilized_tables');
  if (!found) return 'همه‌ی میزهایتان تقریباً به‌یک‌اندازه استفاده می‌شوند — چیزِ خاصی برای گزارش نیست.';
  return `${found.finding} ${found.recommended_action ?? ''}`.trim();
}

async function answerWaitlistNow(restaurantId: string): Promise<string> {
  const count = await db.waitlistEntry.count({ where: { restaurantId, status: 'waiting' } });
  if (count === 0) return 'الان کسی در لیستِ انتظار نیست.';
  return `الان ${fmt(count)} نفر در لیستِ انتظار هستند.`;
}

async function answerTablesNow(restaurantId: string): Promise<string> {
  const rows = await db.table.groupBy({
    by: ['state'],
    where: { restaurantId, isActive: true },
    _count: { _all: true },
  });
  const total = rows.reduce((s, r) => s + r._count._all, 0);
  if (total === 0) return 'هنوز میزی برای این رستوران ثبت نشده.';
  const byState = Object.fromEntries(rows.map((r) => [r.state, r._count._all]));
  const free = byState.free ?? 0;
  const occupied = byState.occupied ?? 0;
  return `از ${fmt(total)} میزِ فعال، الان ${fmt(free)} میز آزاد و ${fmt(occupied)} میز اشغال است.`;
}

async function answerUpcomingHighRisk(restaurantId: string): Promise<string> {
  const count = await db.reservation.count({
    where: {
      restaurantId,
      status: { in: ['confirmed', 'auto_confirmed', 'pending'] },
      slotStart: { gte: new Date(), lte: new Date(Date.now() + 48 * 3600_000) },
      noShowRiskTier: 'high',
    },
  });
  if (count === 0) return 'در ۴۸ ساعتِ آینده رزروِ پرریسکی (احتمالِ بالای no-show) نداریم.';
  return `${fmt(count)} رزرو در ۴۸ ساعتِ آینده ریسکِ نیامدنِ بالایی دارند. یادآوریِ SMS اضافه یا درخواستِ بیعانه می‌تواند کمک کند.`;
}

async function answerDemandTomorrow(restaurantId: string): Promise<string> {
  const forecast = await getDemandForecast(restaurantId, 1);
  const tomorrow = forecast?.reservations.points[0]; // h=0 در attachDates یعنی «فردا»، نه امروز
  if (!tomorrow) {
    return 'هنوز تاریخچه‌ی کافی برای پیش‌بینیِ تقاضا نداریم — این بخش خودش را با گذشتِ زمان کالیبره می‌کند.';
  }
  const src = forecast!.reservations.source === 'learned' ? 'از رویِ الگویِ یادگرفته‌شده‌ی خودتان' : 'با پیش‌بینیِ فصلیِ ساده';
  return `پیش‌بینی برای فردا: حدودِ ${fmt(Math.round(tomorrow.predicted))} رزرو (${src}).`;
}

async function answerNoShowModelStatus(restaurantId: string): Promise<string> {
  const model = await db.restaurantNoShowModel.findUnique({ where: { restaurantId } });
  if (!model) return 'هنوز مدلِ یادگرفته‌ی no-show برایِ رستورانِ شما آموزش داده نشده — با جمع‌شدنِ تاریخچه‌ی رزرو، خودکار فعال می‌شود.';
  if (!model.isActive) return `مدلِ یادگرفته هنوز از heuristicِ پیش‌فرض بهتر نبوده (روی ${fmt(model.sampleSize)} نمونه سنجیده شده)، پس فعلاً از فرمولِ عمومی استفاده می‌کنیم.`;
  const improvementPct = model.staticBrier > 0
    ? Math.round(((model.staticBrier - model.learnedBrier) / model.staticBrier) * 1000) / 10
    : 0;
  return `مدلِ یادگرفته‌ی no-show فعال است — روی ${fmt(model.sampleSize)} رزروِ گذشته آموزش دیده و حدودِ ${improvementPct}٪ از فرمولِ عمومی دقیق‌تر است.`;
}

function answerGreeting(): string {
  return 'سلام! من دستیارِ هوشمندِ رستورانتون هستم — کاملاً آفلاین کار می‌کنم و از داده‌ی واقعیِ خودِ رستوران جواب می‌دم. یه سؤال درباره‌ی رزروها، مشتری‌ها، میزها یا لیستِ انتظار بپرس.';
}

function answerHelp(exampleQuestions: string[]): string {
  return `می‌تونم به این‌جور سؤال‌ها جواب بدم:\n${exampleQuestions.map((q) => `• ${q}`).join('\n')}\nهرچی بیشتر ازم بپرسی و جوابِ اشتباه رو اصلاح کنی، بهتر یاد می‌گیرم.`;
}

/** تولیدِ متنِ پاسخِ فارسی برای یک نیتِ مشخص. exampleQuestions فقط برایِ help لازم است. */
export async function generateAnswer(
  intent: AssistantIntent,
  restaurantId: string,
  exampleQuestions: string[] = [],
): Promise<string> {
  switch (intent) {
    case 'greeting': return answerGreeting();
    case 'help': return answerHelp(exampleQuestions);
    case 'reservations_today': return answerReservationsForDay(restaurantId, 0, 'امروز');
    case 'reservations_tomorrow': return answerReservationsForDay(restaurantId, 1, 'فردا');
    case 'busiest_day': return answerBusiestDay(restaurantId);
    case 'slow_day': return answerSlowDay(restaurantId);
    case 'at_risk_customers': return answerAtRiskCustomers(restaurantId);
    case 'vip_customers': return answerVipCustomers(restaurantId);
    case 'underused_tables': return answerUnderusedTables(restaurantId);
    case 'waitlist_now': return answerWaitlistNow(restaurantId);
    case 'tables_now': return answerTablesNow(restaurantId);
    case 'upcoming_high_risk': return answerUpcomingHighRisk(restaurantId);
    case 'demand_tomorrow': return answerDemandTomorrow(restaurantId);
    case 'no_show_model_status': return answerNoShowModelStatus(restaurantId);
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
