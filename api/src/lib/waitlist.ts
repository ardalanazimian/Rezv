import { randomBytes, timingSafeEqual } from 'crypto';
import { db } from './db';
import { redis } from './redis';
import { metrics } from './metrics';
import { Err } from './errors';
import { enqueueSms } from './sms';
import { queuePush, queueEmail } from './notify';
import { cached, cacheKey } from './cache';

// ═══════════════════════════════════════════════════════════
//  سیستم لیست انتظار رزرونو (مدل OpenTable)
//
//  جریان کامل:
//   join → waiting → (میز آزاد شد) → offered (تایمر انقضا) →
//     accepted (رزرو ساخته می‌شود) | declined | no_response (منقضی)
//
//  صف اولویت: VIP و باشگاه طلایی جلوتر، سپس FIFO بر اساس زمان پیوستن.
//  ارتقای خودکار: وقتی میز آزاد می‌شود، به نفر اول صف آفر داده می‌شود.
//  اعلان سه‌کاناله: SMS + Push + Email.
// ═══════════════════════════════════════════════════════════

const OFFER_TTL_MINUTES = 5;          // مهلت پاسخ مشتری به آفر (تایمر انقضا)
const AVG_DINING_MINUTES = 75;        // پیش‌فرضِ سراسری — فقط وقتی تاریخچه‌ی خودِ رستوران کافی نیست
const VIP_PRIORITY = 100;             // امتیاز اولویت VIP
const CLUB_GOLD_PRIORITY = 50;        // امتیاز باشگاه طلایی/پلاتینیوم

// ═══════════════════════════════════════════════════════════════════════
//  مدتِ واقعیِ نشستنِ مهمان — به‌جایِ فرضِ سراسریِ ثابتِ ۷۵ دقیقه برایِ
//  همه‌ی رستوران‌ها (فست‌فود و فاین‌دایینینگ الگویِ کاملاً متفاوتی دارند).
//
//  از reservation_events می‌خوانیم: فاصله‌ی اولین رویدادِ seated/dining تا
//  رویدادِ completed. اگر تاریخچه‌ی رستوران کم باشد (تازه‌کار)، بی‌صدا به
//  همان پیش‌فرضِ سراسری برمی‌گردیم — همان انضباطِ no-show model/demand
//  forecast: هیچ‌وقت عددِ نویزی را جایِ heuristic نمی‌گذاریم.
// ═══════════════════════════════════════════════════════════════════════

const MIN_SAMPLES_FOR_REAL_AVG = 15;
const PLAUSIBLE_MIN_MINUTES = 15;  // کمتر از این یعنی احتمالاً دادهٔ خراب (رویدادِ ازقلم‌افتاده)
const PLAUSIBLE_MAX_MINUTES = 240; // بیشتر از این هم همین‌طور

/** میانه‌ی یک آرایه‌ی عددی — نسبت به میانگین در برابرِ outlier مقاوم‌تر است. */
export function medianMinutes(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * تصمیمِ خالص: از نمونه‌های واقعی استفاده کن یا به پیش‌فرض برگرد؟ منطقِ
 * جدا از DB تا مستقیم تست شود.
 */
export function resolveAvgDiningMinutes(sampleMinutes: readonly number[], fallback = AVG_DINING_MINUTES): number {
  if (sampleMinutes.length < MIN_SAMPLES_FOR_REAL_AVG) return fallback;
  const med = medianMinutes(sampleMinutes);
  if (med === null || med < PLAUSIBLE_MIN_MINUTES || med > PLAUSIBLE_MAX_MINUTES) return fallback;
  return Math.round(med);
}

/** میانگینِ واقعیِ مدتِ نشستن برایِ این رستوران (کش‌شده — در مسیرِ داغِ
 *  پیوستن به لیست انتظار صدا زده می‌شود). شفاف: منبع و تعدادِ نمونه هم
 *  برمی‌گردد تا پنلِ آنالیتیکس بتواند نشان دهد این عدد از تاریخچه‌ی خودِ
 *  رستوران است یا پیش‌فرضِ سراسری. */
export interface AvgDiningResult {
  minutes: number;
  source: 'restaurant_history' | 'default';
  sample_size: number;
}

async function computeAvgDiningResult(restaurantId: string): Promise<AvgDiningResult> {
  const rows = await db.$queryRaw<{ minutes: number }[]>`
    SELECT EXTRACT(EPOCH FROM (c.created_at - s.created_at)) / 60.0 AS minutes
    FROM (
      SELECT reservation_id, MIN(created_at) AS created_at
      FROM reservation_events WHERE to_status IN ('seated', 'dining')
      GROUP BY reservation_id
    ) s
    JOIN (
      SELECT reservation_id, MAX(created_at) AS created_at
      FROM reservation_events WHERE to_status = 'completed'
      GROUP BY reservation_id
    ) c ON c.reservation_id = s.reservation_id
    JOIN reservations r ON r.id = s.reservation_id
    WHERE r.restaurant_id = ${restaurantId}::uuid AND c.created_at > s.created_at
    ORDER BY c.created_at DESC
    LIMIT 300
  `;
  const sample = rows.map((r) => Number(r.minutes));
  const med = medianMinutes(sample);
  const usable = sample.length >= MIN_SAMPLES_FOR_REAL_AVG
    && med !== null && med >= PLAUSIBLE_MIN_MINUTES && med <= PLAUSIBLE_MAX_MINUTES;
  return {
    minutes: resolveAvgDiningMinutes(sample),
    sample_size: sample.length,
    source: usable ? 'restaurant_history' : 'default',
  };
}

async function getAvgDiningResult(restaurantId: string): Promise<AvgDiningResult> {
  return cached(cacheKey('avg-dining-minutes', restaurantId), 3600, () => computeAvgDiningResult(restaurantId));
}

async function getAvgDiningMinutes(restaurantId: string): Promise<number> {
  return (await getAvgDiningResult(restaurantId)).minutes;
}

export type JoinWaitlistInput = {
  restaurantId: string;
  partySize: number;
  userId?: string;
  guest?: { name: string; phone?: string; email?: string };
  notifySms?: boolean;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  note?: string;
};

/** آیا این tier عضویت، VIP محسوب می‌شود؟ (تابع خالص — قابل‌تست بدون DB) */
export function isVipTier(tier: string): boolean {
  return tier === 'gold' || tier === 'platinum' || tier === 'vip';
}

/** امتیاز اولویتِ صف بر اساس tier عضویت. (تابع خالص — قابل‌تست بدون DB) */
export function tierToPriority(tier: string): number {
  if (tier === 'platinum' || tier === 'vip') return VIP_PRIORITY;
  if (tier === 'gold') return CLUB_GOLD_PRIORITY;
  if (tier === 'silver') return 20;
  return 0;
}

// ── محاسبه‌ی اولویت ورودی (VIP + باشگاه) ──
async function computePriority(restaurantId: string, userId?: string): Promise<{ priority: number; isVip: boolean }> {
  if (!userId) return { priority: 0, isVip: false };
  const member = await db.clubMember.findUnique({
    where: { restaurantId_userId: { restaurantId, userId } },
    select: { tier: true },
  });
  const tier = member?.tier ?? 'bronze';
  return { priority: tierToPriority(tier), isVip: isVipTier(tier) };
}

// ── تخمین زمان انتظار (دقیقه) بر اساس موقعیت در صف و ظرفیت ──
async function estimateWait(restaurantId: string, partySize: number, aheadInQueue: number): Promise<number> {
  const [avgDiningMinutes, suitableTables] = await Promise.all([
    getAvgDiningMinutes(restaurantId),
    // تعداد میزهای مناسب این گروه
    db.table.count({
      where: { restaurantId, isActive: true, state: { not: 'maintenance' }, capacity: { gte: partySize } },
    }),
  ]);
  if (suitableTables === 0) return aheadInQueue * avgDiningMinutes;
  // تخمین: هر «دور» میز ≈ میانگین مدت نشستن. نفرات جلوی صف ÷ میزهای موازی.
  const rounds = Math.ceil((aheadInQueue + 1) / suitableTables);
  return Math.max(5, rounds * avgDiningMinutes - avgDiningMinutes + 15);
}

// ── پیوستن به لیست انتظار ──
export async function joinWaitlist(input: JoinWaitlistInput) {
  const r = await db.restaurant.findUnique({ where: { id: input.restaurantId } });
  if (!r) throw Err.notFound('رستوران');
  if (!r.isOpen) throw Err.restaurantClosed();
  if (!Number.isInteger(input.partySize) || input.partySize < 1) throw Err.validation('تعداد نفر نامعتبر است');

  // جلوگیری از ورودی تکراری فعال برای همان کاربر
  if (input.userId) {
    const existing = await db.waitlistEntry.findFirst({
      where: { restaurantId: r.id, userId: input.userId, status: { in: ['waiting', 'offered'] } },
    });
    if (existing) throw Err.validation('شما از قبل در لیست انتظار این رستوران هستید');
  }

  const { priority, isVip } = await computePriority(r.id, input.userId);

  // تعداد نفرات جلوتر در صف (با اولویت بالاتر یا مساوی و زودتر)
  const ahead = await db.waitlistEntry.count({
    where: { restaurantId: r.id, status: 'waiting', priority: { gte: priority } },
  });
  const estimatedWaitMinutes = await estimateWait(r.id, input.partySize, ahead);

  // autofill نام/تلفن از پروفایل
  let guestName = input.guest?.name ?? null;
  let guestPhone = input.guest?.phone ?? null;
  const guestEmail = input.guest?.email ?? null;
  if (input.userId && !guestName) {
    const u = await db.user.findUnique({ where: { id: input.userId } });
    guestName = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || null;
    guestPhone = u?.phone ?? null;
  }

  // توکنِ دسترسیِ مهمان (رفعِ IDOR، migration 041) — فقط برایِ ورودی‌هایِ
  // بدونِ حساب. ورودیِ متعلق‌به‌کاربر با JWT خودش احراز می‌شه، نیازی به این نداره.
  const guestAccessToken = input.userId ? null : randomBytes(16).toString('hex');

  const entry = await db.waitlistEntry.create({
    data: {
      restaurantId: r.id,
      userId: input.userId ?? null,
      guestName, guestPhone, guestEmail,
      partySize: input.partySize,
      priority, isVip,
      estimatedWaitMinutes,
      notifySms: input.notifySms ?? true,
      notifyPush: input.notifyPush ?? true,
      notifyEmail: input.notifyEmail ?? false,
      note: input.note ?? null,
      guestAccessToken,
    },
  });

  await redis.del(`waitlist:${r.id}`).catch(() => {});

  // اعلان پیوستن
  await notifyEntry(entry.id, 'joined', { wait: estimatedWaitMinutes, position: ahead + 1 });

  return {
    id: entry.id,
    position: ahead + 1,
    estimated_wait_minutes: estimatedWaitMinutes,
    is_vip: isVip,
    status: entry.status,
    // فقط همینجا (لحظه‌ی join) برمی‌گرده — کلاینت باید کنارِ id ذخیره‌اش کنه؛
    // accept/decline/leave روی ورودیِ مهمان از این پس این توکن رو می‌خوان.
    guest_token: guestAccessToken,
  };
}

// ── محاسبه‌ی موقعیت فعلی یک ورودی در صف ──
export async function getPosition(entryId: string): Promise<number> {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e || e.status !== 'waiting') return 0;
  const ahead = await db.waitlistEntry.count({
    where: {
      restaurantId: e.restaurantId,
      status: 'waiting',
      OR: [
        { priority: { gt: e.priority } },
        { priority: e.priority, joinedAt: { lt: e.joinedAt } },
      ],
    },
  });
  return ahead + 1;
}

// ── صف مرتب‌شده (برای داشبورد رستوران) ──
export async function getQueue(restaurantId: string) {
  const entries = await db.waitlistEntry.findMany({
    where: { restaurantId, status: { in: ['waiting', 'offered'] } },
    orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }],
  });
  return entries.map((e, i) => ({
    id: e.id,
    position: e.status === 'waiting' ? i + 1 : null,
    name: e.guestName ?? 'مهمان',
    phone: e.guestPhone,
    party_size: e.partySize,
    is_vip: e.isVip,
    priority: e.priority,
    status: e.status,
    waited_minutes: Math.round((Date.now() - +e.joinedAt) / 60_000),
    estimated_wait_minutes: e.estimatedWaitMinutes,
    offer_expires_at: e.offerExpiresAt,
    offered_table: e.offeredTableNumber,
  }));
}

// ═══════════════════════════════════════════════════════════
//  ارتقای خودکار: وقتی میز آزاد می‌شود، به نفر اول صف آفر بده
// ═══════════════════════════════════════════════════════════

/**
 * بررسی صف و آفر میز آزاد به واجدترین فرد.
 * توسط cron یا پس از آزادشدن میز (completed/cancelled) صدا زده می‌شود.
 * فقط یک نفر در هر فراخوانی آفر می‌گیرد (تا میز دوبار آفر نشود).
 */
export async function promoteNext(restaurantId: string): Promise<{ promoted: boolean; entryId?: string; table?: number }> {
  // نفر اول صف (بالاترین اولویت، زودترین)
  const next = await db.waitlistEntry.findFirst({
    where: { restaurantId, status: 'waiting' },
    orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }],
  });
  if (!next) return { promoted: false };

  // پیدا کردن میزهای کاندید آزادِ اکنون برای این گروه (تخصیص خودکار)
  const now = new Date();
  const horizon = new Date(+now + AVG_DINING_MINUTES * 60_000);
  const candidates = await db.table.findMany({
    where: {
      restaurantId, isActive: true, state: 'free',
      capacity: { gte: next.partySize }, minPartySize: { lte: next.partySize },
    },
    orderBy: [{ priority: 'desc' }, { capacity: 'asc' }],
    select: { id: true, number: true },
  });
  if (candidates.length === 0) return { promoted: false };

  const offerExpiresAt = new Date(+now + OFFER_TTL_MINUTES * 60_000);

  // ⚠️ باگ H8: قبلاً میز کاندید با خواندنِ بدون قفل انتخاب می‌شد و سپس در یک
  // تراکنش جدا reserved می‌شد؛ بین این دو، فراخوانی هم‌زمان دیگری (cron + یک
  // decline) می‌توانست همان میز را به مهمان دیگری هم آفر بدهد → یک میز فیزیکی
  // به دو نفر. حالا ادعای میز اتمیک است: داخل تراکنش، میز فقط اگر «هنوز free
  // است» به reserved تغییر می‌کند (UPDATE شرطی). اگر رقیب زودتر گرفت (۰ ردیف)،
  // سراغ کاندید بعدی می‌رویم. علاوه بر آن، خود چک تداخل رزرو هم داخل همان تراکنش
  // بعد از قفل‌شدن میز انجام می‌شود تا از رزروِ هم‌پوشان جا نماند.
  for (const t of candidates) {
    const claimed = await db.$transaction(async (tx) => {
      // ۱) ادعای اتمیک میز: فقط اگر هنوز free است
      const upd = await tx.$executeRaw`
        UPDATE tables SET state = 'reserved'
        WHERE id = ${t.id}::uuid AND state = 'free'
      `;
      if (upd === 0) return false; // رقیب زودتر گرفت → کاندید بعدی

      // ۲) چک تداخل رزرو (حالا که میز قفل است، امن)
      const conflict = await tx.reservation.count({
        where: {
          tableId: t.id,
          status: { in: ['pending', 'confirmed', 'auto_confirmed', 'preparing', 'checked_in', 'running_late', 'arrived', 'seated', 'dining'] },
          slotStart: { lt: horizon }, slotEnd: { gt: now },
        },
      });
      if (conflict > 0) {
        // این میز رزرو هم‌پوشان دارد → آزادش کن و کاندید بعدی
        await tx.table.update({ where: { id: t.id }, data: { state: 'free' } });
        return false;
      }

      // ۳) آفر به نفر اول صف
      await tx.waitlistEntry.update({
        where: { id: next.id },
        data: {
          status: 'offered', offeredAt: now, offerExpiresAt,
          offeredTableId: t.id, offeredTableNumber: t.number,
        },
      });
      return true;
    });

    if (claimed) {
      await notifyEntry(next.id, 'offered', { table: t.number, ttl: OFFER_TTL_MINUTES });
      await redis.del(`waitlist:${restaurantId}`).catch(() => {});
      metrics.waitlistPromoted.inc();  // متریک: ارتقاء موفق از لیست انتظار
      return { promoted: true, entryId: next.id, table: t.number };
    }
  }

  return { promoted: false }; // همه‌ی کاندیدها گرفته شدند یا تداخل داشتند
}

// ── مالکیتِ عملیاتِ نویسنده روی یک ورودیِ صف (accept/decline/leave) ──
// ⚠️ رفع IDOR (۲۰۲۶-۰۸-۱۳): قبلاً این چک فقط وقتی callerUserId داده می‌شد
// اجرا می‌شد — یعنی یک درخواستِ کاملاً بدونِ توکن (نه فقط توکنِ اشتباه) بی‌صدا
// از کنارِ چک رد می‌شد، چون هیچ callerِ واقعیِ staff/system‌ای اصلاً وجود
// نداشت که به این bypass نیاز داشته باشه (هر سه routeِ عمومی از همون
// callerId(req)ِ سطحِ مشتری استفاده می‌کنن) — یعنی این «استثنا برایِ staff»
// فقط سوراخِ امنیتی بود، نه قابلیتِ واقعی.
//
// حالا:
//  • ورودیِ متعلق‌به‌کاربر (userId ست‌شده): احرازِ هویتِ مشتری الزامیه و باید
//    دقیقاً با entry.userId یکی باشه.
//  • ورودیِ مهمان (userId=null): guestAccessTokenِ صادرشده هنگامِ join
//    (migration 041) باید دقیقاً مطابقت کنه — مقایسه constant-time (تایمینگ-سیف).
function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
function assertCanActOnEntry(
  entry: { userId: string | null; guestAccessToken: string | null },
  auth: { callerUserId?: string; guestToken?: string },
) {
  if (entry.userId) {
    if (!auth.callerUserId || auth.callerUserId !== entry.userId) throw Err.notFound('ورودی لیست انتظار');
    return;
  }
  if (!entry.guestAccessToken || !auth.guestToken || !tokensEqual(auth.guestToken, entry.guestAccessToken)) {
    throw Err.notFound('ورودی لیست انتظار');
  }
}

export async function acceptOffer(entryId: string, _actor = 'customer', auth: { callerUserId?: string; guestToken?: string } = {}) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) throw Err.notFound('ورودی لیست انتظار');
  assertCanActOnEntry(e, auth);
  if (e.status !== 'offered') throw Err.validation('آفری برای پذیرش وجود ندارد');
  if (e.offerExpiresAt && e.offerExpiresAt < new Date()) throw Err.reservationExpired();

  // ساخت رزرو از آفر (تخصیص خودکار میز)
  const { createReservation } = await import('./reservations');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const resv = await createReservation({
    restaurantId: e.restaurantId,
    date: dateStr, time: timeStr,
    partySize: e.partySize,
    userId: e.userId ?? undefined,
    guest: e.userId ? undefined : { name: e.guestName ?? 'مهمان', phone: e.guestPhone ?? undefined, tableNumber: e.offeredTableNumber ?? undefined },
    source: e.userId ? 'app' : 'manual',
    notifySms: false, // اعلان waitlist جداست
  }).catch(async (err) => {
    // اگر رزرو نشد، میز را آزاد کن
    if (e.offeredTableId) await db.table.update({ where: { id: e.offeredTableId }, data: { state: 'free' } }).catch(() => {});
    throw err;
  });

  await db.waitlistEntry.update({
    where: { id: entryId },
    data: { status: 'accepted', respondedAt: now, seatedAt: now, reservationCode: resv.code },
  });
  await redis.del(`waitlist:${e.restaurantId}`).catch(() => {});

  await notifyEntry(entryId, 'accepted', { table: e.offeredTableNumber, code: resv.code });
  return { status: 'accepted', reservation_code: resv.code, table_number: e.offeredTableNumber };
}

// ── رد آفر توسط مشتری → آفر به نفر بعدی ──
export async function declineOffer(entryId: string, _actor = 'customer', auth: { callerUserId?: string; guestToken?: string } = {}) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) throw Err.notFound('ورودی لیست انتظار');
  assertCanActOnEntry(e, auth);
  if (e.status !== 'offered') throw Err.validation('آفری برای رد وجود ندارد');

  // ⚠️ همزمانی: گارد status را داخل updateMany می‌گذاریم (نه فقط چک بیرونی)
  // تا اگر همزمان cron همین آفر را expire کند یا مشتری دوبار بزند، فقط یکی
  // واقعاً اعمال شود (count=1) و میز دوبار آزاد/promote نشود.
  const updated = await db.$transaction(async (tx) => {
    const res = await tx.waitlistEntry.updateMany({
      where: { id: entryId, status: 'offered' },
      data: { status: 'declined', respondedAt: new Date() },
    });
    if (res.count === 1 && e.offeredTableId) {
      await tx.table.update({ where: { id: e.offeredTableId }, data: { state: 'free' } });
    }
    return res.count;
  });
  if (updated === 0) throw Err.validation('این آفر دیگر قابل رد نیست'); // رقیب زودتر تغییرش داد
  await redis.del(`waitlist:${e.restaurantId}`).catch(() => {});

  // آفر به نفر بعدی
  await promoteNext(e.restaurantId).catch(() => {});
  return { status: 'declined' };
}

// ── خروج از صف ──
export async function leaveWaitlist(entryId: string, auth: { callerUserId?: string; guestToken?: string } = {}) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) throw Err.notFound('ورودی لیست انتظار');
  assertCanActOnEntry(e, auth);
  if (!['waiting', 'offered'].includes(e.status)) throw Err.validation('این ورودی قابل لغو نیست');
  const updated = await db.$transaction(async (tx) => {
    const res = await tx.waitlistEntry.updateMany({
      where: { id: entryId, status: { in: ['waiting', 'offered'] } },
      data: { status: 'cancelled', respondedAt: new Date() },
    });
    if (res.count === 1 && e.offeredTableId) {
      await tx.table.update({ where: { id: e.offeredTableId }, data: { state: 'free' } });
    }
    return res.count;
  });
  if (updated === 0) throw Err.validation('این ورودی دیگر قابل لغو نیست');
  await redis.del(`waitlist:${e.restaurantId}`).catch(() => {});
  if (e.status === 'offered') await promoteNext(e.restaurantId).catch(() => {});
  return { status: 'cancelled' };
}

// ═══════════════════════════════════════════════════════════
//  انقضای آفرهای بی‌پاسخ (cron) — تایمر انقضا
// ═══════════════════════════════════════════════════════════
export async function expireOffers(): Promise<number> {
  const expired = await db.waitlistEntry.findMany({
    where: { status: 'offered', offerExpiresAt: { lt: new Date() } },
  });
  let n = 0;
  for (const e of expired) {
    await db.$transaction(async (tx) => {
      await tx.waitlistEntry.update({ where: { id: e.id }, data: { status: 'no_response' } });
      if (e.offeredTableId) await tx.table.update({ where: { id: e.offeredTableId }, data: { state: 'free' } });
    });
    await notifyEntry(e.id, 'expired', {});
    // میز آزاد شد → آفر به نفر بعدی
    await promoteNext(e.restaurantId).catch(() => {});
    n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════
//  اعلان سه‌کاناله (SMS + Push + Email)
// ═══════════════════════════════════════════════════════════
type NotifyKind = 'joined' | 'offered' | 'accepted' | 'expired';

async function notifyEntry(entryId: string, kind: NotifyKind, data: Record<string, any>) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) return;
  const name = e.guestName ?? 'مهمان';

  const messages: Record<NotifyKind, { sms?: { template: SmsTpl; tokens: string[] }; push: { title: string; body: string }; email: { subject: string; body: string } }> = {
    joined: {
      sms: { template: 'waitlist_joined', tokens: [name, String(data.position ?? ''), String(data.wait ?? '')] },
      push: { title: 'در لیست انتظار قرار گرفتید', body: `${name} عزیز، نفر ${data.position} صف هستید. تخمین انتظار: ${data.wait} دقیقه.` },
      email: { subject: 'لیست انتظار رزرونو', body: `شما در لیست انتظار قرار گرفتید. موقعیت: ${data.position}، تخمین انتظار: ${data.wait} دقیقه.` },
    },
    offered: {
      sms: { template: 'waitlist_offer', tokens: [name, String(data.table ?? ''), String(data.ttl ?? '')] },
      push: { title: '🎉 میز شما آماده است!', body: `${name} عزیز، میز ${data.table} برای شما آماده شد. ظرف ${data.ttl} دقیقه تأیید کنید.` },
      email: { subject: '🎉 میز شما آماده است', body: `میز ${data.table} برای شما رزرو شد. لطفاً ظرف ${data.ttl} دقیقه در اپ تأیید کنید.` },
    },
    accepted: {
      sms: { template: 'booking_confirm', tokens: [name, String(data.code ?? ''), 'میز شما آماده است'] },
      push: { title: 'رزرو شما ثبت شد', body: `میز ${data.table} - کد ${data.code}. خوش آمدید!` },
      email: { subject: 'رزرو شما تأیید شد', body: `رزرو شما با کد ${data.code} روی میز ${data.table} ثبت شد.` },
    },
    expired: {
      push: { title: 'مهلت آفر گذشت', body: `${name} عزیز، مهلت تأیید میز گذشت. می‌توانید دوباره به صف بپیوندید.` },
      email: { subject: 'مهلت آفر لیست انتظار', body: 'مهلت تأیید میز شما به پایان رسید.' },
    },
  };

  const m = messages[kind];
  // SMS
  if (e.notifySms && e.guestPhone && m.sms) {
    await enqueueSms({ to: e.guestPhone, template: m.sms.template, tokens: m.sms.tokens, restaurantId: e.restaurantId }).catch(() => {});
  }
  // Push
  if (e.notifyPush && e.userId) {
    await queuePush(e.userId, m.push.title, m.push.body).catch(() => {});
  }
  // Email
  if (e.notifyEmail && e.guestEmail) {
    await queueEmail(e.guestEmail, m.email.subject, m.email.body).catch(() => {});
  }
}

// نوع قالب SMS (هماهنگ با sms.ts)
type SmsTpl = 'otp' | 'booking_confirm' | 'reminder' | 'welcome_visit' | 'campaign' | 'winback_offer'
  | 'booking_waitlist' | 'booking_preparing' | 'booking_rejected' | 'booking_cancelled' | 'booking_noshow' | 'booking_thanks'
  | 'waitlist_joined' | 'waitlist_offer';

// ═══════════════════════════════════════════════════════════
//  آنالیتیکس لیست انتظار
// ═══════════════════════════════════════════════════════════
export async function getWaitlistAnalytics(restaurantId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const all = await db.waitlistEntry.findMany({
    where: { restaurantId, createdAt: { gte: since } },
  });
  const total = all.length;
  const seated = all.filter(e => e.status === 'accepted' || e.status === 'seated').length;
  const abandoned = all.filter(e => ['cancelled', 'declined', 'no_response'].includes(e.status)).length;
  const conversionRate = total ? Math.round((seated / total) * 100) : 0;

  // میانگین زمان انتظار واقعی (برای آن‌هایی که نشستند)
  const seatedEntries = all.filter(e => e.seatedAt);
  const avgWait = seatedEntries.length
    ? Math.round(seatedEntries.reduce((s, e) => s + (+e.seatedAt! - +e.joinedAt) / 60_000, 0) / seatedEntries.length)
    : 0;

  const currentQueue = await db.waitlistEntry.count({ where: { restaurantId, status: 'waiting' } });

  // شفافیت: عددی که در تخمینِ ETA استفاده می‌شود از تاریخچه‌ی خودِ رستوران
  // آمده یا هنوز پیش‌فرضِ سراسری است (رستورانِ تازه‌کار) — نه ادعایِ کاذبِ دقت.
  const avgDining = await getAvgDiningResult(restaurantId).catch(
    () => ({ minutes: AVG_DINING_MINUTES, source: 'default' as const, sample_size: 0 }),
  );

  return {
    period_days: days,
    total_entries: total,
    seated, abandoned,
    conversion_rate: conversionRate,
    avg_wait_minutes: avgWait,
    avg_dining_minutes: avgDining.minutes,
    avg_dining_minutes_source: avgDining.source,
    current_queue_size: currentQueue,
    vip_entries: all.filter(e => e.isVip).length,
  };
}
