import { randomBytes, timingSafeEqual, createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from './db';
import { createReservation } from './reservations';
import { withSerializationRetry } from './reservation-helpers';
import { redis } from './redis';
import { metrics } from './metrics';
import { Err } from './errors';
import { enqueueSms } from './sms';
import { smsAllowedForCategory } from './notification-prefs';
import { queuePush, queueEmail } from './notify';
import { cached, cacheKey } from './cache';
import { activeStatusList } from './reservation-status';
import { holdHorizonMinutes, isTableNumberOccupied, OFFER_TTL_MINUTES } from './table-occupancy';
import { dateKeyInTz, timeKeyInTz } from './hours';
import { createLogger } from './logger';

const log = createLogger('waitlist');

/**
 * چند دقیقه یک ورودیِ `accepted` **بدونِ کدِ رزرو** اجازه دارد بنشیند پیش از
 * آنکه جارو رهایش کند.
 *
 * ⚠️ این عدد روی **مدتِ ماندگاری** است و نه روی `offerExpiresAt`، و آن
 * تفاوت یک باگِ رزروِ دوگانه را جلو گرفت (قیدِ بازبین، دستورِ ۰۴۸):
 * `accepted` + کدِ خالی حالتِ گیرکرده **نیست** — حالتِ گذرای هر پذیرشِ
 * موفق است، در پنجره‌ای که `createReservation` در آن می‌نشیند. اگر جارو
 * به انقضای آفر کلید می‌خورد، مهمانی که یک ثانیه پیش از TTL می‌پذیرد
 * میزش را زیرِ پای رزروی که همان لحظه ساخته می‌شود از دست می‌داد.
 *
 * پس عدد باید راحت بلندتر از حداکثر عمرِ آن تراکنش باشد. تایم‌اوتِ
 * `createReservation` ۱۰ ثانیه است؛ ۵ دقیقه یعنی سی برابر.
 */
const ORPHANED_ACCEPT_DWELL_MINUTES = 5;

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

// ⚠️ OFFER_TTL_MINUTES (مهلتِ پاسخِ مشتری به آفر) از ۲۰۲۶-۰۹-۰۵ در
// `table-occupancy.ts` تعریف می‌شود و از آنجا import می‌شود. اینجا نبود چون
// یک مصرف‌کننده‌ی دوم پیدا کرد: `availability` باید بداند یک میزِ
// `state='reserved'` حداکثر تا کِی می‌تواند به رزرو تبدیل شود. نگه‌داشتنِ
// عدد در این فایل یعنی کپی‌کردنش در آن یکی — دو ثابت برایِ یک مفهوم.
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
  // فقط hashِ توکن در DB می‌مونه (migration 044، همون الگویِ otp.ts) — خودِ
  // توکنِ خام فقط همینجا، در پاسخِ join، یک‌بار برمی‌گرده.
  const guestAccessTokenRaw = input.userId ? null : randomBytes(16).toString('hex');
  const guestAccessTokenHash = guestAccessTokenRaw ? hashGuestToken(guestAccessTokenRaw) : null;

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
      guestAccessTokenHash,
    },
  });

  // ⚠️ یافته‌ی اندازه‌گیری‌شده‌ی ۲۰۲۶-۰۹-۰۵ — این پنج `redis.del` (اینجا و
  // خطوطِ معادل در promoteNext/acceptOffer/declineOffer/leaveWaitlist) کلیدی
  // را پاک می‌کنند که **هیچ کدی در مخزن نمی‌نویسد**. تنها نویسنده‌هایِ Redis
  // در `api/src` اینها هستند و هیچ‌کدام پیشوندِ `waitlist:` تولید نمی‌کند:
  //   admin-totp.ts:130 (`totp-replay:`) · security.ts:13 (`revoked:`) ·
  //   ratelimit.ts:239/242 (`viol:`/`ban:`) · cache.ts:29 (همیشه `cache:`) ·
  //   availability.ts:191/248 (`avail-lock:`/`avail:`)
  // و `cached`/`cacheKey` هم در همین فایل import شده‌اند ولی **هرگز صدا زده
  // نمی‌شوند** (`getQueue` مستقیم از DB می‌خواند). یعنی این باطل‌سازی‌ها
  // no-op‌اند و شکستشان چیزی را خراب نمی‌کند.
  //
  // به همین دلیل عمداً شمارنده/آلارم نگرفتند: ابزارِ رصد روی کدِ بی‌اثر یک
  // سیگنالِ جعلی می‌سازد («صف کش دارد») که وجود ندارد. حذفشان هم در همین
  // batch انجام نشد — یک پاک‌سازیِ مستقل است و قاطی‌کردنش با پرریسک‌ترین
  // تغییرِ این دور دقیقاً همان چیزی است که بندِ ۳۲ منع می‌کند. ثبت شد تا
  // بازبینِ بعدی دوباره کشفش نکند.
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
    // (خودِ توکنِ خام هرگز در DB ذخیره نمی‌شه — فقط hashش، رجوع کن به بالا.)
    guest_token: guestAccessTokenRaw,
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
  // ═══════════════════════════════════════════════════════════════════
  //  ⚠️ چرا کارِ DB داخلِ `withSerializationRetry` است و عوارضِ جانبی بیرون
  //
  //  زیرِ Serializable، ابطال با ۴۰۰۰۱ رفتارِ **عادیِ** SSI است نه حالتِ لبه؛
  //  پس بالابردنِ isolation بدونِ retry فقط یک double-bookingِ بی‌صدا را به
  //  یک شکستِ پرصدا تبدیل می‌کرد. همان سیاستِ واحدِ createReservation و
  //  createWalkin، از همان تابعِ مشترک — عمداً حلقه‌ی دومی نوشته نشد.
  //
  //  و عوارضِ جانبی (اعلان، باطل‌سازی، متریکِ موفقیت) بیرونِ واحدِ retry
  //  می‌مانند: اگر داخل بودند، یک retry می‌توانست به یک مهمان دو بار پیامکِ
  //  «میزت آماده است» بدهد، یا `waitlistPromoted` را دوبار بشمارد.
  // ═══════════════════════════════════════════════════════════════════
  const res = await withSerializationRetry('waitlist', () => promoteNextTx(restaurantId));
  if (res.promoted && res.entryId && res.table !== undefined) {
    const dispatched = await notifyEntry(res.entryId, 'offered', { table: res.table, ttl: OFFER_TTL_MINUTES });
    // ثبتِ یک واقعیت، نه یک حدس: «دستِ‌کم یک کانال رفت». اگر صفر بود ستون
    // NULL می‌ماند و `expireOffers` این مهمان را **بی‌پاسخ نمی‌خواند**.
    if (dispatched > 0) {
      await db.waitlistEntry.updateMany({
        where: { id: res.entryId, status: 'offered' },
        data: { offerNotifiedAt: new Date() },
      }).catch((err: unknown) => {
        // ⚠️ عمداً بلعیده نمی‌شود، لاگ می‌شود. و جهتِ شکست امن است: ستون
        // NULL می‌ماند، یعنی حداکثر یک مهمانِ واقعاً خبردارشده `expired`
        // ثبت می‌شود به‌جای `no_response` — اتهامِ کمتر، نه بیشتر.
        log.warn('ثبتِ offerNotifiedAt ناموفق', { entryId: res.entryId, error: (err as Error).message });
      });
    }
    await redis.del(`waitlist:${restaurantId}`).catch(() => {});
    metrics.waitlistPromoted.inc();  // متریک: ارتقاء موفق از لیست انتظار
  }
  return res;
}

async function promoteNextTx(restaurantId: string): Promise<{ promoted: boolean; entryId?: string; table?: number }> {
  // نفر اول صف (بالاترین اولویت، زودترین)
  const next = await db.waitlistEntry.findFirst({
    where: { restaurantId, status: 'waiting' },
    orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }],
  });
  if (!next) return { promoted: false };

  // ═══════════════════════════════════════════════════════════════════
  //  افقِ چکِ تداخل — **قرارداد**، نه آمار (رفعِ ۲۰۲۶-۰۹-۰۵)
  //
  //  تا امروز این خط `AVG_DINING_MINUTES` (=۷۵) بود. آن عدد به سؤالِ «مردمِ
  //  این رستوران معمولاً چقدر می‌نشینند؟» جواب می‌دهد — یک آمار برایِ تخمینِ
  //  زمانِ انتظار. ولی رزروی که `acceptOffer` واقعاً می‌سازد به‌اندازه‌ی
  //  `slotMinutes + cleaningMinutes + bufferMinutes` میز را می‌بندد — یک
  //  قرارداد. با پیش‌فرض‌هایِ اسکیما (۹۰+۱۵+۰=۱۰۵) یعنی یک پنجره‌ی کورِ
  //  ۳۰دقیقه‌ای: رزروی که ۷۵ تا ۱۰۵ دقیقه‌ی دیگر شروع می‌شد برایِ این چک
  //  نامرئی بود و در لحظه‌ی پذیرش تداخل می‌کرد — یعنی صف میزی را آفر می‌داد
  //  که پذیرشش از پیش محکوم به شکست بود.
  //
  //  ⚠️ و جهتِ آینه، که کم‌تر دیده می‌شود ولی همان‌قدر واقعی است: برایِ یک
  //  فست‌فود با سانسِ ۳۰ دقیقه، ۷۵ **بیش‌ازحد بلند** بود و رزروِ یک‌ساعتِ
  //  دیگر یک میزِ کاملاً قابلِ‌آفر را حبس می‌کرد. هر دو جهت در
  //  `tests/waitlist-promotion-horizon.test.mts` قفل شده‌اند.
  //
  //  ⚠️ چرا هارد‌کدِ ۱۰۵ هم غلط بود: `slotMinutes` پیکربندی‌پذیر است. یک
  //  رستوران با سانسِ ۱۸۰ پنجره‌ی کورِ ۱۲۵دقیقه‌ای می‌داشت و پیش‌فرض آن را
  //  پشتِ عددِ ۳۰ پنهان می‌کرد. پس افق از `holdHorizonMinutes` می‌آید —
  //  **همان** تابعی که `availability` با آن این هولد را تفسیر می‌کند
  //  (`availability.holdsFromTables`). نویسنده و خواننده‌ی یک پرچم باید یک
  //  افق داشته باشند، وگرنه صف میزی را آفر می‌دهد که خودِ availability آن را
  //  ناتوان از میزبانی می‌داند.
  //
  //  ⚠️ چرا این خواندن **بیرونِ** تراکنشِ Serializable است و نه داخلش: یک
  //  `SELECT` رویِ ردیفِ `restaurants` داخلِ تراکنشِ Serializable یک قفلِ
  //  SIREAD رویِ همان ردیف می‌گیرد، و آن ردیف با هر heartbeatِ پنل به‌روز
  //  می‌شود (`restaurant/heartbeat/route.ts:53` هر بار `lastSeenAt` را
  //  می‌نویسد). نتیجه یک منبعِ تازه‌ی ۴۰۰۱ می‌شد که هیچ ربطی به تداخلِ میز
  //  ندارد. پیکربندیِ زمان‌بندی هم داده‌ی رقابتی نیست — `acceptOffer` خودش
  //  دوباره و تازه می‌خواندش.
  //
  //  `AVG_DINING_MINUTES` عمداً حذف نشد: در تخمینِ زمانِ انتظار
  //  (`estimateWaitMinutes` / `getAvgDiningResult`) واقعاً آمار است و آن‌جا
  //  ورودیِ درستی است.
  // ═══════════════════════════════════════════════════════════════════
  const now = new Date();
  const timing = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slotMinutes: true, cleaningMinutes: true, bufferMinutes: true },
  });
  // نبودِ رستوران «هیچ کاندیدی نبود» نیست — یک خطایِ واقعی است و باید دیده
  // شود. `tryPromoteNext` آن را می‌شمارد و لاگ می‌کند، بی‌آنکه کنشِ صداکننده
  // را بشکند.
  if (!timing) throw Err.notFound('رستوران');
  const horizon = new Date(+now + holdHorizonMinutes(timing) * 60_000);

  // پیدا کردن میزهای کاندید آزادِ اکنون برای این گروه (تخصیص خودکار)
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
      // ── ⚠️ نیمه‌ی باربَرِ ارتقا به Serializable: `upd === 0` **یک** معنا دارد،
      //    نه دو تا. این تفکیک را خودِ Postgres تضمین می‌کند، نه این کد:
      //
      //  • رقیبی که **قبلاً commit کرده** → ردیف دیگر `state='free'` نیست →
      //    شرطِ WHERE نمی‌گیرد → ۰ ردیف. میز واقعاً رفته؛ درست‌ترین کار
      //    «کاندیدِ بعدی» است. اینجا retry فقط همان صفر را دوباره می‌دید.
      //
      //  • رقیبی که **هنوز commit نکرده** → این UPDATE رویِ قفلِ ردیف
      //    **بلاک می‌شود**؛ وقتی رقیب commit کرد، Postgres زیرِ Serializable
      //    خطایِ ۴۰۰۰۱ می‌دهد. یعنی این حالت اصلاً از این خط عبور نمی‌کند و
      //    هرگز به شکلِ `upd === 0` ظاهر نمی‌شود — throw می‌شود، از حلقه
      //    بیرون می‌رود و `withSerializationRetry` کلِ تلاش را از نو
      //    (با صفِ تازه و کاندیدهایِ تازه) اجرا می‌کند.
      //
      // پس «skip» و «retry» دو مسیرِ فیزیکیِ جدا هستند و قاطی‌شدنشان ممکن
      // نیست — به شرطی که هیچ‌کس این تراکنش را در یک try/catch نپیچد و
      // خطایِ سریال‌سازی را به «کاندیدِ بعدی» ترجمه نکند. آن کار یک مهمانِ
      // واجد را بی‌صدا از صف می‌انداخت. گاردش:
      // `waitlist-merge-occupancy-concurrency.test.mts` (بخشِ تفکیکِ upd===0).
      if (upd === 0) return false; // رقیبِ commitشده میز را گرفت → کاندید بعدی

      // ۲) چک تداخل رزرو (حالا که میز قفل است، امن)
      const conflict = await tx.reservation.count({
        where: {
          tableId: t.id,
          // از منبعِ واحد می‌خواند (lib/reservation-status.ts). محتوایِ این لیست
          // پیش از این درست بود ولی یک **کپی** بود — یعنی با تغییرِ enum بی‌صدا
          // drift می‌کرد. همان باگِ C1 که در گاردِ حذفِ میز واقعاً رخ داده بود.
          status: { in: activeStatusList() as any },
          slotStart: { lt: horizon }, slotEnd: { gt: now },
        },
      });
      // ⚠️ رفع‌شده (۲۰۲۶-۰۹-۰۴): چکِ بالا فقط `table_id` را می‌شمارد — یعنی
      // میزِ **ثانویه‌یِ** یک رزروِ ترکیبیِ فعال را نمی‌بیند. میزِ ثانویه
      // ردیفِ رزروِ خودش را ندارد (فقط عددی در `merged_table_numbers`) و
      // `tables.state`ش هم هرگز به occupied تغییر نمی‌کند، پس از فیلترِ
      // `state:'free'`ِ کاندیدها هم رد می‌شود. نتیجه: صف می‌توانست میزی را
      // آفر بدهد که همین حالا نصفِ یک گروهِ ترکیبی سرش نشسته است.
      //
      // این دقیقاً همان کلاسِ باگی است که در createWalkin پیدا شد؛ هر دو از
      // یک قلم‌افتادگیِ مشترک می‌آیند (رجوع کن به table-occupancy.ts).
      // عمداً چکِ قبلی حذف **نشده**: معناهای زمانیِ دو چک یکی نیست (این یکی
      // block_end را هم حساب می‌کند، یعنی زمانِ نظافت) و حذفِ چکِ قدیمی یک
      // تغییرِ رفتاریِ جداست، نه بخشی از این رفع.
      //
      // 🚨 دامنه‌ی این گارد — **به‌روزشده ۲۰۲۶-۰۹-۰۵.** متنِ قبلی می‌گفت
      // «حالتِ هم‌زمان باز است و ارتقا به Serializable عمداً انجام نشده».
      // آن دیگر HEAD را توصیف نمی‌کند؛ ولی جمله‌ی جایگزین هم نباید بیش از
      // اندازه ادعا کند. وضعیتِ دقیق:
      //
      //   ✔ حالتِ ترتیبی (merge قبلاً commit شده) — بسته. از ۲۰۲۶-۰۹-۰۴.
      //     گارد: waitlist-merge-occupancy.test.mts
      //   ✔ حالتِ هم‌زمان (merge در حالِ commit) — **حالا بسته.** این تراکنش
      //     `isolationLevel: Serializable` دارد، پس خواندنِ
      //     `isTableNumberOccupied` قفلِ SIREAD می‌گیرد و چرخه‌ی
      //     rw-antidependency کامل می‌شود؛ یکی از دو طرف با ۴۰۰۰۱ abort
      //     می‌شود و `withSerializationRetry('waitlist', …)` دوباره تلاش
      //     می‌کند. پیش از این تغییر، همین سناریو **۱۲ از ۱۲** بازتولید
      //     می‌شد. گارد: waitlist-merge-occupancy-concurrency.test.mts
      //
      //   ✗ و آنچه این تغییر **نمی‌بندد** — جهتِ معکوس، که اصلاً مسئله‌ی
      //     ایزولاسیون نیست: `tryMergeTables` از `getOccupiedTableNumbers`
      //     استفاده می‌کند و آن تابع **فقط جدولِ `reservations` را می‌خواند**
      //     (table-occupancy.ts:38-52). یک آفرِ زنده‌ی لیستِ انتظار نه ردیفِ
      //     رزرو دارد و نه در آن کوئری دیده می‌شود، و فیلترِ merge هم فقط
      //     `state != 'maintenance'` است، پس میزی که همین حالا `reserved`
      //     شده باز هم کاندیدِ ترکیب است. نتیجه: **اگر آفرِ صف اول باشد و
      //     merge دوم، merge همان میز را می‌گیرد — کاملاً ترتیبی، بدونِ هیچ
      //     همزمانی. اندازه‌گیریِ زنده‌ی ۲۰۲۶-۰۹-۰۵: ۶ از ۶.**
      //     Serializable این را درست نمی‌کند، چون مسئله «خواندنی که دیده
      //     نمی‌شود» نیست، «خواندنی که اصلاً انجام نمی‌شود» است — چرخه‌ای
      //     وجود ندارد که SSI بخواهد ببیند.
      //     رفعش یعنی گسترشِ مرجعِ اشغال تا آفرهایِ زنده‌ی صف، که همزمان
      //     availability و walk-in و merge را تغییر می‌دهد — یک تصمیمِ
      //     دامنه‌ای، نه یک سوئیچ. ارجاع داده شد؛ عمداً اینجا رفع نشده.
      const mergedBusy = conflict === 0
        && await isTableNumberOccupied(tx, restaurantId, t.number, now, horizon);

      if (conflict > 0 || mergedBusy) {
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
    },
    // هم‌ترازِ placeReservation (`reservations.ts:396`) و createWalkinTx
    // (`:937`) — عمداً هر سه یکی است: سه نویسنده‌ای که رویِ یک میزِ فیزیکی
    // رقابت می‌کنند باید زیرِ یک قاعده‌ی همزمانی باشند. همین ناهم‌ترازی بود
    // که این باگ را ساخت؛ `isTableNumberOccupied` تنها محافظِ میزِ ثانویه
    // است و در READ COMMITTED برایِ SSI نامرئی بود.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );

    if (claimed) {
      // ⚠️ عوارضِ جانبی اینجا **نیستند** — به `promoteNext` منتقل شدند تا
      // یک retryِ سریال‌سازی نتواند دو بار پیامک بفرستد یا متریکِ موفقیت را
      // دوبار بشمارد.
      return { promoted: true, entryId: next.id, table: t.number };
    }
  }

  return { promoted: false }; // همه‌ی کاندیدها گرفته شدند یا تداخل داشتند
}

// ═══════════════════════════════════════════════════════════════════════
//  سیاستِ *واحدِ* «تلاشِ ارتقا که نباید کنشِ صداکننده را بشکند»
//
//  ── مسئله‌ای که این تابع می‌بندد ──────────────────────────────────────
//  چهار نقطه `promoteNext` را «پس از آزادشدنِ میز» صدا می‌زنند و هر چهار،
//  تا ۲۰۲۶-۰۹-۰۵، خطا را یا با `.catch(() => {})` می‌بلعیدند یا (در مسیرِ
//  sweep) اصلاً گاردی نداشتند و کلِ دسته را می‌انداختند. هر دو سرِ طیف غلط
//  بود:
//    • بلعیدن  → شکستِ سیستماتیک از نبودِ شکست قابلِ تفکیک نبود.
//    • throwِ خام در sweep → یک رستورانِ خراب کلِ جاروبِ ناوگان را می‌کشت.
//
//  ── چرا throw نمی‌کنیم (این نیمه‌ی باربَرِ تصمیم است) ─────────────────
//  در هر چهار نقطه، کنشِ اصلی (decline / cancel / expire) **قبلاً commit
//  شده**. اگر بعد از آن پاسخِ صداکننده را با خطا بشکنیم، برای یک موفقیتِ
//  واقعی یک شکستِ جعلی گزارش کرده‌ایم — همان الگویِ ممنوعِ «موفقیتِ جعلی»
//  این مخزن، فقط در جهتِ آینه. مشتری آفرش را *واقعاً* رد کرده؛ اینکه نفرِ
//  بعدیِ صف ارتقا نگرفت مشکلِ اوست نه او.
//
//  ── پس چه چیزی جایِ throw را می‌گیرد ────────────────────────────────
//  یک لاگِ ساختاریافته + یک شمارنده‌ی برچسب‌دار (`site`)، و برگرداندنِ
//  `ok:false` تا صداکننده — اگر خودش cron است — بتواند در سطحِ خودش
//  صادقانه گزارش دهد. تفکیکِ صریحِ دو واقعیتِ متفاوت: «کنشِ کاربر موفق بود»
//  و «ارتقا شکست خورد».
//
//  ⚠️ شبکه‌ی ایمنی وجود دارد ولی **در عمل تأیید نشده**: `cron/crontab:17`
//  هر ۲ دقیقه `/run.sh waitlist` را می‌زند و
//  `maintenance/waitlist/route.ts:34-37` برایِ هر رستورانِ دارایِ صف دوباره
//  `promoteNext` می‌زند. پس یک شکستِ بلعیده‌شده «برای همیشه» مهمان را در صف
//  رها نمی‌کند، حداکثر ~۲ دقیقه. این ادعا **در سورس اثبات شده و در عملیات
//  اثبات نشده** — هیچ محیطی مستقر نیست که این زنجیره در آن اجرا شده باشد و
//  کلِ آن به یکی‌بودنِ `MAINTENANCE_KEY` وابسته است. اگر آن کلید در لانچ
//  اشتباه تنظیم شود، شبکه‌ی ایمنی **غایب** است و شدت به همان «دائمی»
//  برمی‌گردد. به همین دلیل شمارنده‌ی زیر جایگزینِ آن زنجیره است، نه مکملش.
// ═══════════════════════════════════════════════════════════════════════

/** نقطه‌ی صدورِ تلاشِ ارتقا — برچسبِ متریک و لاگ. */
export type PromotionSite = 'decline' | 'cancel' | 'expire' | 'sweep';

export interface PromotionAttempt {
  /** آیا `promoteNext` بدونِ خطا برگشت؟ (نه «آیا کسی ارتقا گرفت») */
  ok: boolean;
  /** آیا واقعاً کسی ارتقا گرفت؟ `false` وقتی صف خالی است یا میزی نبود — این *شکست نیست*. */
  promoted: boolean;
}

/**
 * `promoteNext` را صدا می‌زند و شکستش را به یک سیگنالِ دیدنی تبدیل می‌کند،
 * بدونِ اینکه به صداکننده throw کند.
 *
 * ⚠️ تفکیکِ عمدی: `ok:true, promoted:false` یعنی «همه‌چیز درست کار کرد، فقط
 * کاندیدی نبود» — این حالتِ کاملاً عادی است و **شمرده نمی‌شود**. فقط
 * `ok:false` (یعنی خطایِ واقعی) شمارنده را بالا می‌برد. یکی‌گرفتنِ این دو،
 * شمارنده را با ترافیکِ عادیِ رستورانِ بی‌صف پر می‌کرد و آلارم را در یک هفته
 * بی‌اعتبار می‌کرد.
 */
export async function tryPromoteNext(restaurantId: string, site: PromotionSite): Promise<PromotionAttempt> {
  try {
    const res = await promoteNext(restaurantId);
    return { ok: true, promoted: res.promoted };
  } catch (e) {
    metrics.waitlistPromotionFailed.inc({ site });
    log.error('ارتقایِ لیستِ انتظار شکست خورد — کنشِ صداکننده موفق بود، فقط ارتقا نه', {
      event: 'waitlist.promotion_failed',
      site,
      restaurantId,
      error: (e as Error)?.message ?? String(e),
    });
    return { ok: false, promoted: false };
  }
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
// export شده تا مستقیم (بدونِ DB) تست بشه — همون الگویِ isVipTier/tierToPriority بالا.
export function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// hashِ توکنِ خامِ مهمان قبل از ذخیره/مقایسه (migration 044) — دقیقاً همون
// الگویِ `hash(code)` در otp.ts (`sha256(code + JWT_SECRET)`)، دو رازِ
// متفاوت با یک قاعده. عمداً همینجا duplicate شده (نه import از otp.ts)
// چون آنجا export نیست و منطق آن‌قدر کوچک است که یک abstraction مشترک
// برای دو فراخوان ارزشِ لایه‌ی اضافه ندارد.
export function hashGuestToken(rawToken: string): string {
  return createHash('sha256').update(rawToken + process.env.JWT_SECRET).digest('hex');
}

export function assertCanActOnEntry(
  entry: { userId: string | null; guestAccessTokenHash: string | null },
  auth: { callerUserId?: string; guestToken?: string },
) {
  if (entry.userId) {
    if (!auth.callerUserId || auth.callerUserId !== entry.userId) throw Err.notFound('ورودی لیست انتظار');
    return;
  }
  if (!entry.guestAccessTokenHash || !auth.guestToken
    || !tokensEqual(hashGuestToken(auth.guestToken), entry.guestAccessTokenHash)) {
    throw Err.notFound('ورودی لیست انتظار');
  }
}

export async function acceptOffer(entryId: string, _actor = 'customer', auth: { callerUserId?: string; guestToken?: string } = {}) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) throw Err.notFound('ورودی لیست انتظار');
  assertCanActOnEntry(e, auth);

  // ── بازپخشِ واقعی: همین ورودی قبلاً پذیرفته شده و رزروش ساخته شده ──
  //
  // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۹-۱۱): این حالت با `آفری برای پذیرش وجود ندارد`
  // (۴۲۲) رد می‌شد. ولی مسیرِ رسیدن به آن کاملاً عادی است: مهمان دکمه را
  // دوبار می‌زند، یا پاسخ در راه گم می‌شود و کلاینت retry می‌کند. آن‌وقت
  // رزرو **ساخته شده** ولی مهمان یک خطا می‌بیند — و بدنه‌ی موفقیت، که تنها
  // جایی است که `reservation_code` برمی‌گردد، برای همیشه از دست می‌رود
  // (`accept` تنها مسیری است که آن کد را به مهمان می‌دهد).
  //
  // شرط عمداً **هر دو** را می‌خواهد: `accepted` *و* کدِ ناخالی. `accepted` با
  // کدِ خالی حالتِ **گذرای** هر پذیرشِ موفق است (پنجره‌ای که createReservation
  // در آن می‌نشیند) و برگرداندنِ «موفق» در آن لحظه یعنی ادعای رزروی که هنوز
  // وجود ندارد — همان جعلِ موفقیت. رجوع کن به ORPHANED_ACCEPT_DWELL_MINUTES.
  if (e.status === 'accepted' && e.reservationCode) {
    return { status: 'accepted', reservation_code: e.reservationCode, table_number: e.offeredTableNumber };
  }

  if (e.status !== 'offered') throw Err.validation('آفری برای پذیرش وجود ندارد');
  if (e.offerExpiresAt && e.offerExpiresAt < new Date()) throw Err.reservationExpired();

  const now = new Date();

  // ⚠️ باگِ رفع‌شده #۱ (۲۰۲۶-۰۸-۲۰): ترتیب برعکس بود — اول رزرو ساخته می‌شد
  // (که کند است: تخصیصِ میز، قیدِ EXCLUDE، اعلان‌ها) و *بعد* وضعیتِ ورودی با
  // یک `update`ِ بی‌قیدوشرط نوشته می‌شد. دو نقص داشت:
  //
  //  الف) رقابت با cron: اگر آفر در همان فاصله منقضی می‌شد، `expireOffers`
  //       ورودی را `no_response` می‌کرد و میز را آزاد، و بعد این تابع رویش
  //       `accepted` می‌نوشت — با رزروی که واقعاً ساخته شده بود.
  //  ب) مسیرِ خطا میز را آزاد می‌کرد در حالی که ورودی هنوز `offered` بود —
  //     دقیقاً همان نشتی که در expireOffers بسته شد (§2l): یک آفرِ زنده با
  //     میزی که `free` علامت خورده، یعنی promoteNext می‌توانست همان میزِ
  //     فیزیکی را به نفرِ دوم هم بدهد.
  //
  // حالا **اول** ادعای اتمیک، بعد ساختِ رزرو. از لحظه‌ی ادعا ورودی دیگر
  // `offered` نیست، پس cron اصلاً نمی‌بیندش.
  //
  // ⚠️ دقتِ ادعا: چیزی که واقعاً رقابت را می‌بندد گاردِ `status` است، نه شرطِ
  // `offerExpiresAt`. جهش‌آزمایی این را نشان داد — حذفِ شرطِ انقضا هیچ تستی
  // را نینداخت، چون چکِ بیرونیِ بالا (خطِ ۴۰۴) همان لحظه را می‌سنجد. شرطِ
  // انقضا اینجا فقط هم‌راستایی با آن چک است، نه محافظِ مستقل.
  const claimed = await db.waitlistEntry.updateMany({
    where: {
      id: entryId,
      status: 'offered',
      OR: [{ offerExpiresAt: null }, { offerExpiresAt: { gt: now } }],
    },
    data: { status: 'accepted', respondedAt: now, seatedAt: now },
  });
  if (claimed.count === 0) {
    // ⚠️ افزوده‌ی ۲۰۲۶-۰۹-۱۲ (بازبینیِ همین شاخه): دو ضربه‌ی **هم‌زمان** روی
    // یک آفر هر دو پیش از commitِ برنده `offered` را می‌دیدند، پس گاردِ
    // بازپخشِ بالا هیچ‌کدام را نمی‌گرفت و بازنده دقیقاً همین‌جا می‌رسید و
    // «مهلتِ تأیید گذشته» می‌گرفت — جمله‌ای که در آن لحظه **دروغ** است: رزرو
    // همین حالا ساخته شده و مهمان میز دارد. تنها جایی که `reservation_code`
    // به مهمان می‌رسد همین بدنه است، پس آن خطا کد را برای همیشه می‌برد.
    //
    // پس دوباره می‌خوانیم. شرط عیناً همان شرطِ سخت‌گیرانه‌ی بالاست —
    // `accepted` **و** کدِ ناخالی — چون `accepted`ِ بی‌کد حالتِ گذرای
    // لحظه‌ای است که `createReservation` در آن نشسته، و «موفق» گفتن در آن
    // لحظه ادعای رزروی است که هنوز وجود ندارد.
    //
    // چرا حلقه و نه یک خواندن: در ضربه‌ی واقعاً هم‌زمان، بازنده معمولاً
    // *داخلِ* همان پنجره می‌رسد. سه تلاش × ۳۰۰ms سقفِ ۰٫۹ ثانیه است — کمتر
    // از زمانی که مهمان برای دیدنِ نتیجه صبر می‌کند، و بدونِ آن این رفع
    // فقط حالتِ retryِ شبکه را می‌گرفت نه دو ضربه‌ی پشتِ‌هم را.
    for (let attempt = 0; attempt < 3; attempt++) {
      const after = await db.waitlistEntry.findUnique({
        where: { id: entryId },
        select: { status: true, reservationCode: true, offeredTableNumber: true },
      });
      if (after?.status === 'accepted' && after.reservationCode) {
        return {
          status: 'accepted',
          reservation_code: after.reservationCode,
          table_number: after.offeredTableNumber,
        };
      }
      // اگر ورودی حتی `accepted` هم نیست (cron منقضی‌اش کرده، یا کسی
      // لغوش کرده) صبرکردن بی‌فایده است — همان خطای درست را بده.
      if (after?.status !== 'accepted') break;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw Err.reservationExpired();
  }

  // ⚠️ باگِ رفع‌شده #۲ (همان‌جا، با تستِ زنده پیدا شد — این تابع تا امروز هیچ
  // پوششی نداشت): قبلاً این دو خط بودند
  //     const dateStr = now.toISOString().slice(0, 10);   // تاریخِ UTC
  //     const timeStr = now.toTimeString().slice(0, 5);   // ساعتِ محلیِ *سرور*
  // و `createReservation` هر دو را به‌عنوانِ ساعتِ دیواریِ **تایم‌زونِ رستوران**
  // تفسیر می‌کند (`computeRanges` → `zonedTimeToUtc`). سه تایم‌زونِ متفاوت در
  // یک جفت قاطی می‌شدند.
  //
  // پیامدِ واقعی: روی سرورِ UTC با رستورانِ تهران (UTC+03:30) اسلات ۳٫۵ ساعت
  // **عقب‌تر** از «الان» ساخته می‌شد و گاردِ `+start < now - 60_000` همیشه
  // شلیک می‌کرد → هر پذیرشِ آفر با «زمان رزرو در گذشته است» شکست می‌خورد.
  // یعنی این قابلیت در تولید عملاً کار نمی‌کرد.
  const rest = await db.restaurant.findUnique({
    where: { id: e.restaurantId }, select: { timezone: true },
  });
  const timezone = rest?.timezone ?? 'Asia/Tehran';
  const dateStr = dateKeyInTz(now, timezone);
  const timeStr = timeKeyInTz(now, timezone);

  let resv: { code: string };
  try {
    resv = await createReservation({
      restaurantId: e.restaurantId,
      date: dateStr, time: timeStr,
      partySize: e.partySize,
      userId: e.userId ?? undefined,
      guest: e.userId ? undefined : { name: e.guestName ?? 'مهمان', phone: e.guestPhone ?? undefined, tableNumber: e.offeredTableNumber ?? undefined },
      source: e.userId ? 'app' : 'manual',
      notifySms: false, // اعلان waitlist جداست
    });
  } catch (err) {
    // بازگردانی به *دقیقاً* حالتِ قبل: ورودی دوباره `offered` و میز `reserved`
    // می‌ماند (چون آفر دوباره زنده است). عمداً میز آزاد نمی‌شود — آزادکردنش
    // همان نشتِ (ب) بالا را می‌ساخت. اگر ساختِ رزرو مدام شکست بخورد، آفر تا
    // پایانِ TTL می‌ماند و بعد cron خودش تمیزش می‌کند.
    await db.waitlistEntry.updateMany({
      where: { id: entryId, status: 'accepted' },
      data: { status: 'offered', respondedAt: null, seatedAt: null },
    }).catch(() => {});
    throw err;
  }

  await db.waitlistEntry.update({
    where: { id: entryId },
    data: { reservationCode: resv.code },
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

  // آفر به نفر بعدی — شکستش نباید این پاسخ را بشکند (decline قبلاً commit شده)
  // ولی دیگر بی‌صدا هم نیست. رجوع کن به `tryPromoteNext`.
  await tryPromoteNext(e.restaurantId, 'decline');
  return { status: 'declined' };
}

// ── خروج از صف ──
/**
 * لغوِ ورودیِ لیستِ انتظار.
 *
 * دو نوع صداکننده دارد و **هرگز** نباید یکی به‌جایِ دیگری اعتبارسنجی شود:
 *  • مشتری/مهمان → مالکیت با `assertCanActOnEntry` (userId یا توکنِ مهمان).
 *  • پرسنلِ رستوران → `staffRestaurantId`؛ مالکیتِ مشتری بی‌ربط است، ولی
 *    ورودی حتماً باید مالِ همان رستوران باشد، وگرنه یک شعبه می‌توانست صفِ
 *    شعبه‌ی دیگر را دست‌کاری کند.
 *
 * ⚠️ فازِ ۲: این مسیرِ پرسنلی قبلاً وجود نداشت. دکمه‌ی «حذف» در پنلِ رستوران
 * فقط آرایه‌ی محلی را فیلتر می‌کرد و «از صف حذف شد» toast می‌داد — بدونِ هیچ
 * درخواستی. ورودی روی سرور `waiting` می‌ماند، در بازخوانیِ بعدی برمی‌گشت، و
 * `promoteNext` می‌توانست برایِ مهمانی که رفته بود میز نگه دارد.
 */
export async function leaveWaitlist(
  entryId: string,
  auth: { callerUserId?: string; guestToken?: string; staffRestaurantId?: string } = {},
) {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e) throw Err.notFound('ورودی لیست انتظار');
  if (auth.staffRestaurantId) {
    if (e.restaurantId !== auth.staffRestaurantId) throw Err.notFound('ورودی لیست انتظار');
  } else {
    assertCanActOnEntry(e, auth);
  }
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
  if (e.status === 'offered') await tryPromoteNext(e.restaurantId, 'cancel');
  return { status: 'cancelled' };
}

// ═══════════════════════════════════════════════════════════
//  انقضای آفرهای بی‌پاسخ (cron) — تایمر انقضا
// ═══════════════════════════════════════════════════════════
/**
 * نتیجه‌ی یک اجرایِ انقضا. **عمداً یک عدد نیست.**
 *
 * ⚠️ چرا امضا عوض شد (این گران‌ترین بخشِ این تغییر است و دلیلش باید بماند):
 * `expireOffers` تنها مصرف‌کننده‌ی واقعی‌اش cron است، و تا امروز فقط
 * `expired` را برمی‌گرداند. ارتقاهایی که داخلِ همین حلقه شکست می‌خوردند با
 * `.catch(() => {})` بلعیده می‌شدند، تابع «عادی» برمی‌گشت، endpoint ۲xx
 * می‌داد و `cron/run.sh:10` یک `✓ waitlist` چاپ می‌کرد. یعنی این نقطه — که
 * خودش شبکه‌ی ایمنیِ دو نقطه‌ی دیگر است — **سیگنالِ مثبتِ موفقیت رویِ یک
 * شکست** تولید می‌کرد. یک عددِ تنها نمی‌تواند این را حمل کند؛ پس امضا سه
 * واقعیتِ متفاوت را جدا حمل می‌کند.
 */
export interface ExpirySweepResult {
  /** چند آفرِ منقضی پردازش شد (`no_response` یا — اگر اعلانی نرفته بود — `expired`). */
  expired: number;
  /** چند ورودیِ `accepted`ِ بدونِ رزرو رها شد. عددِ غیرِصفر یعنی جبرانِ
   *  `acceptOffer` واقعاً شکست خورده — ارزشِ نگاه‌کردن دارد، نه نویز. */
  orphansReleased: number;
  /** چند بار پس از آزادشدنِ میز، ارتقا **تلاش** شد. */
  promotionAttempts: number;
  /** از آن تلاش‌ها چند تا با خطا شکست خورد (نه «کسی نبود» — رجوع کن به `tryPromoteNext`). */
  promotionFailures: number;
  /**
   * چند مهمان واقعاً از این مسیر ارتقا گرفتند.
   *
   * ⚠️ یافته‌ی جانبیِ ۲۰۲۶-۰۹-۰۵ (با تستِ زنده پیدا شد، نه با بازخوانی):
   * فیلدِ `promoted`ِ پاسخِ endpointِ نگهداری **فقط** از حلقه‌ی sweep شمرده
   * می‌شد. ارتقاهایی که همین‌جا — پس از منقضی‌شدنِ یک آفر و آزادشدنِ میزش —
   * رخ می‌دادند هیچ‌وقت شمرده نمی‌شدند. یعنی cron می‌توانست چند مهمان را
   * واقعاً ارتقا بدهد و در پاسخ `promoted: 0` گزارش کند. کم‌گزارشی است نه
   * بیش‌گزارشی، ولی از همان خانواده‌ی «عددی که با واقعیت نمی‌خواند».
   */
  promotionsMade: number;
}

export async function expireOffers(): Promise<ExpirySweepResult> {
  const expired = await db.waitlistEntry.findMany({
    where: { status: 'offered', offerExpiresAt: { lt: new Date() } },
  });
  let n = 0;
  let promotionAttempts = 0;
  let promotionFailures = 0;
  let promotionsMade = 0;
  for (const e of expired) {
    // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰، با اجرای زنده اثبات شد نه با حدس):
    // این‌جا `update` بی‌قیدوشرط رویِ id بود، در حالی که `declineOffer` و
    // `leaveWaitlist` در همین فایل عمداً `updateMany` با گاردِ status دارند و
    // کامنتشان دقیقاً همین رقابت را نام می‌برد («اگر همزمان cron همین آفر را
    // expire کند»). خودِ cron آن گارد را نداشت — یعنی نیمه‌ی دومِ همان رقابت
    // باز مانده بود.
    //
    // بازتولیدِ واقعی: فهرست بالا خوانده می‌شود، مشتری وسطِ حلقه آفرش را رد
    // می‌کند (status=declined، میز آزاد، و promoteNext همان میز را به نفرِ
    // بعدی آفر می‌دهد)، و بعد این تراکنش بی‌قیدوشرط اجرا می‌شد:
    //   • وضعیتِ «declined»ِ مشتری با «no_response» بازنویسی می‌شد — یعنی
    //     تصمیمِ صریحِ مشتری بی‌صدا پاک می‌شد.
    //   • و بدتر: میزی که همین حالا به نفرِ بعدی آفر شده بود دوباره `free`
    //     می‌شد. مشاهده شد: یک ورودیِ با آفرِ زنده که میزش `state='free'`
    //     بود — یعنی `promoteNext` بعدی می‌توانست همان میزِ فیزیکی را به
    //     نفرِ دومی هم آفر بدهد. دقیقاً همان کلاسِ باگِ H8 که چند خط بالاتر
    //     در promoteNext با ادعای اتمیک بسته شده بود.
    //
    // چرا گاردِ status کافی است (و چکِ جداگانه‌ی مالکیتِ میز لازم نیست):
    // میز فقط وقتی `free` می‌شود که همین ورودی decline/leave/expire شود، و
    // هر سه وضعیتش را عوض می‌کنند. پس «هنوز offered است» ⟹ «میز هنوز مالِ
    // همین ورودی است».
    const applied = await db.$transaction(async (tx) => {
      const res = await tx.waitlistEntry.updateMany({
        where: { id: e.id, status: 'offered' },
        // ⚠️ جفتِ ۲ (BE-006): `no_response` یک **اتهام** است — می‌گوید مهمان
        // جواب نداد. ولی اگر هیچ کانالی برایش dispatch نشده باشد، او اصلاً
        // چیزی برای جواب‌دادن ندیده. `expired` («مهلتِ آفر گذشت») همان
        // واقعیت را بدونِ نسبت‌دادن به مهمان می‌گوید، و در هیچ‌کدام از دو
        // سطلِ `getWaitlistAnalytics` نیست — پس نه در `seated` می‌نشیند و
        // نه در `abandoned`.
        data: { status: e.offerNotifiedAt ? 'no_response' : 'expired' },
      });
      if (res.count === 1 && e.offeredTableId) {
        await tx.table.update({ where: { id: e.offeredTableId }, data: { state: 'free' } });
      }
      return res.count;
    });
    if (applied === 0) continue;   // رقیب (مشتری یا اجرای موازیِ همین cron) زودتر تغییرش داد
    await notifyEntry(e.id, 'expired', {});
    // میز آزاد شد → آفر به نفر بعدی.
    //
    // ⚠️ اینجا throw نمی‌کنیم — نه از رویِ عادت، از رویِ یک تفاوتِ معنایی:
    // انقضا برایِ **این** ورودی قبلاً commit شده و بقیه‌ی ورودی‌هایِ فهرست
    // هنوز پردازش نشده‌اند. یک throw هم آن انقضایِ موفق را «شکست» گزارش
    // می‌کرد و هم بقیه‌ی مهمان‌هایِ منقضی را بی‌پردازش رها می‌کرد. پس شکست
    // *شمرده* می‌شود و در سطحِ endpoint گزارش می‌شود، جایی که تصویرِ کاملِ
    // «چند تلاش، چند شکست» وجود دارد.
    promotionAttempts++;
    const attempt = await tryPromoteNext(e.restaurantId, 'expire');
    if (!attempt.ok) promotionFailures++;
    if (attempt.promoted) promotionsMade++;
    n++;
  }
  // ═══════════════════════════════════════════════════════════════════
  //  جفتِ ۱ (BE-005 §۴) — ورودیِ `accepted` که رزروش هرگز ساخته نشد.
  //
  //  `acceptOffer` ورودی را اتمیک `accepted` می‌کند و **بعد** رزرو می‌سازد.
  //  اگر آن شکست بخورد، یک نوشتنِ جبرانی باید به `offered` برش گرداند — و
  //  آن نوشتن بلعیده می‌شود. کامنتِ همان‌جا می‌گفت «cron خودش تمیزش می‌کند»،
  //  ولی حلقه‌ی بالا فقط `offered` را برمی‌دارد و جبران دقیقاً همان چیزی
  //  است که `accepted` را به `offered` تبدیل می‌کند. یعنی **تنها راهِ نجاتِ
  //  ورودی همان نوشتنی بود که بلعیده می‌شد.** بازتولید شد، نه استدلال.
  //
  //  آسیبِ بازیابی‌ناپذیرش میز نیست (کارمند از نقشه‌ی سالن آزادش می‌کند)،
  //  بلکه `getWaitlistAnalytics` است: `seated` وضعیتِ `accepted` را می‌شمارد،
  //  پس ردیفِ گیرکرده تا ابد در عددی که به رستوران نشان داده می‌شود
  //  «نشسته» است.
  //
  //  ⚠️ شرط روی **مدتِ ماندگاری** است نه `offerExpiresAt` — رجوع کن به
  //  `ORPHANED_ACCEPT_DWELL_MINUTES`. این تفاوت یک رزروِ دوگانه را جلو گرفت.
  // ═══════════════════════════════════════════════════════════════════
  const dwellCutoff = new Date(Date.now() - ORPHANED_ACCEPT_DWELL_MINUTES * 60_000);
  const orphans = await db.waitlistEntry.findMany({
    where: { status: 'accepted', reservationCode: null, respondedAt: { lt: dwellCutoff } },
  });
  let orphansReleased = 0;
  for (const o of orphans) {
    // همان گاردِ اتمیکِ حلقه‌ی بالا: اگر رقیبی (یک `acceptOffer`ِ کند که
    // بالاخره موفق شد، یا اجرای موازیِ همین cron) وضعیت را عوض کرده باشد،
    // این تراکنش صفر ردیف می‌زند و میز دست‌نخورده می‌ماند.
    const applied = await db.$transaction(async (tx) => {
      const res = await tx.waitlistEntry.updateMany({
        where: { id: o.id, status: 'accepted', reservationCode: null },
        data: { status: 'expired' },
      });
      if (res.count === 1 && o.offeredTableId) {
        await tx.table.update({ where: { id: o.offeredTableId }, data: { state: 'free' } });
      }
      return res.count;
    });
    if (applied === 0) continue;
    orphansReleased++;
    log.warn('ورودیِ acceptedِ بدونِ رزرو رها شد — جبرانِ acceptOffer شکست خورده بود', {
      entryId: o.id, restaurantId: o.restaurantId, respondedAt: o.respondedAt,
    });
    promotionAttempts++;
    const attempt = await tryPromoteNext(o.restaurantId, 'expire');
    if (!attempt.ok) promotionFailures++;
    if (attempt.promoted) promotionsMade++;
  }

  return { expired: n, orphansReleased, promotionAttempts, promotionFailures, promotionsMade };
}

// ═══════════════════════════════════════════════════════════
//  اعلان سه‌کاناله (SMS + Push + Email)
// ═══════════════════════════════════════════════════════════
type NotifyKind = 'joined' | 'offered' | 'accepted' | 'expired';

/**
 * @returns چند کانال **واقعاً dispatch شد**. صفر یعنی مهمان از این رویداد
 *          هیچ خبری نگرفت — و آن، برخلافِ «تحویل»، از همین لایه دانستنی است.
 */
async function notifyEntry(entryId: string, kind: NotifyKind, data: Record<string, any>): Promise<number> {
  // ⚠️ `include` به‌جایِ کوئریِ دومِ ترجیحات: خواندنِ رضایت نباید یک رفت‌وبرگشتِ
  // اضافه به حلقه‌هایِ cron (expireStaleOffers / promoteNext) اضافه کند.
  const e = await db.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { user: { select: { notificationPrefs: true } } },
  });
  if (!e) return 0;
  const name = e.guestName ?? 'مهمان';
  let dispatched = 0;

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

  // ═══════════════════════════════════════════════════════════════════
  //  ⚠️ سه `.catch(() => {})`ِ زیر — بررسیِ ۲۰۲۶-۰۹-۰۵، نتیجه: **می‌مانند**
  //
  //  فرضِ اولیه این بود که این‌ها بدتر از catchهایِ `promoteNext`اند («هیچ
  //  cronی اعلان را دوباره نمی‌فرستد؛ مهمان ارتقا می‌گیرد و خبردار نمی‌شود»).
  //  نیمه‌ی اولِ آن درست است، ولی «بی‌صدا» **غلط** است — و خودِ catch هم
  //  اصلاً جایی نیست که خطا بلعیده شود:
  //
  //   • `queuePush`  (notify.ts:132-138) و `queueEmail` (:123-129) هر دو
  //     خطایِ `enqueue` را داخلِ خودشان می‌گیرند و به ارسالِ مستقیم fallback
  //     می‌کنند که آن هم `.catch(() => {})` دارد → **هرگز reject نمی‌شوند**.
  //   • `enqueueSms` (sms.ts:179-201) برایِ هر قالبی جز `otp` همین شکل را
  //     دارد: `enqueue` در try، و `sendDirectFallback` (:146-177) هر مسیرِ
  //     خطایش را خودش می‌گیرد → **هرگز reject نمی‌شود**. این فایل هیچ‌وقت
  //     قالبِ `otp` نمی‌فرستد (فقط waitlist_joined/waitlist_offer/booking_confirm).
  //
  //  یعنی هر سه catch امروز **غیرقابلِ‌دسترس** اند؛ حذفشان رفتار را عوض
  //  نمی‌کند و نگه‌داشتنشان هم چیزی را پنهان نمی‌کند. طبقِ بندِ ۲۱ (حذفِ
  //  شهودی ممنوع) می‌مانند: اگر روزی قراردادِ آن ترنسپورت‌ها عوض شود و شروع
  //  به throw کنند، این سه خط مانعِ شکستنِ کلِ `notifyEntry` (و در نتیجه
  //  `promoteNext`) به‌خاطرِ یک اعلان می‌شوند.
  //
  //  و شکستِ واقعی از قبل شمرده می‌شود، در لایه‌ی درست (خودِ ترنسپورت):
  //    `rezervno_sms_failed_total{template,reason}`  · sms.ts:155/162/175
  //    `rezervno_push_not_sent_total{reason}`        · notify.ts:29
  //    `rezervno_email_failed_total{reason}`         · notify.ts:80/101/107
  //  گذاشتنِ شمارنده‌ی دومی این‌جا همان عددها را دوبار می‌شمرد.
  //
  //  ⚠️ شکافِ واقعیِ باقی‌مانده اینجا نیست، در آلارم است: از این سه، فقط
  //  `sms_failed` قاعده دارد (observability/alerts.yml، گروهِ
  //  rezervno_notifications). `push_not_sent` و `email_failed` هیچ قاعده‌ای
  //  ندارند — تأییدشده با `node tools/check-alert-metric-binding.mjs`. این
  //  خارج از دامنه‌ی این تغییر است و به‌عنوانِ یافته گزارش شد، نه اینجا رفع.
  // ═══════════════════════════════════════════════════════════════════

  // SMS
  if (e.notifySms && e.guestPhone && m.sms) {
    // ── رضایت (§۱۳/§۱۷) ────────────────────────────────────────────────
    // فقط `offered` گیت می‌شود، و دقیقاً با دسته‌ی `availability` — چون
    // برچسبِ همان کلید در اپِ مشتری «میز خالی شد / وقتی میز رستوران موردِ
    // علاقه‌ات آزاد شد» است و این پیام دقیقاً همان است.
    //
    // ⚠️ `joined` و `accepted` عمداً گیت **نمی‌شوند**:
    //  • `joined` رسیدِ کنشِ خودِ مهمان است («نفر ۳ صف هستی»)، نه اطلاع از
    //    آزادشدنِ میز.
    //  • `accepted` قالبِ `booking_confirm` می‌فرستد — یعنی **تأییدِ رزرو**.
    //    گیت‌کردنش یعنی مهمانی که فقط هشدارِ «میز خالی شد» را خاموش کرده،
    //    تأییدیه‌ی رزروِ واقعی‌اش را هم از دست بدهد. همان اشتباهی که این کل
    //    تغییر برای رفعش نوشته شد.
    // `expired` اصلاً پیامک ندارد.
    const gated = kind === 'offered';
    if (gated && !smsAllowedForCategory(e.user?.notificationPrefs, 'availability', {
      site: 'waitlist.offered', template: m.sms.template,
      restaurantId: e.restaurantId, userId: e.userId,
    })) {
      // انصرافِ صریح — push/email زیر همچنان می‌روند (کانالِ جدا، فلگِ جدا).
    } else {
      await enqueueSms({ to: e.guestPhone, template: m.sms.template, tokens: m.sms.tokens, restaurantId: e.restaurantId })
        .then(() => { dispatched++; }).catch(() => {});
    }
  }
  // Push
  if (e.notifyPush && e.userId) {
    await queuePush(e.userId, m.push.title, m.push.body)
      .then(() => { dispatched++; }).catch(() => {});
  }
  // Email
  if (e.notifyEmail && e.guestEmail) {
    await queueEmail(e.guestEmail, m.email.subject, m.email.body)
      .then(() => { dispatched++; }).catch(() => {});
  }

  // ⚠️ صفر یعنی **هیچ کانالی نرفت** — نه اینکه ارسال شکست خورد. سه شرطِ
  // بالا هر کدام می‌توانند رد شوند (تلفن null، حسابِ کاربری نداشتن،
  // `notifyEmail` که پیش‌فرضش false است، یا انصراف از رضایتِ availability)،
  // و مهمانِ بدونِ حساب که تلفن نداده هر سه را رد می‌کند.
  return dispatched;
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
  // ⚠️ فازِ ۲ (§۲۵ + کمینه‌سازیِ داده): این تابع قبلاً **همه‌ی ردیف‌هایِ کاملِ**
  // بازه را می‌خواند — با ?days=365 یعنی یک سال ورودی، شاملِ نام، تلفن، ایمیل و
  // هشِ توکنِ مهمان — فقط برایِ اینکه در جاوااسکریپت بشمارد. شمارش کارِ
  // دیتابیس است، و هیچ‌کدام از آن ستون‌هایِ شخصی برایِ خروجی لازم نبود.
  const [byStatus, waitAgg, vipEntries] = await Promise.all([
    db.waitlistEntry.groupBy({
      by: ['status'],
      where: { restaurantId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    // میانگینِ انتظارِ واقعی فقط برایِ کسانی که نشستند — در خودِ Postgres.
    // ⚠️ EXTRACT(EPOCH ...) عددِ double برمی‌گرداند و COUNT مقدارِ bigint —
    // طبقِ قاعده‌ی صریحِ CLAUDE.md هردو در SQL کست و در JS با Number() پوشش
    // داده می‌شوند، نه فقط یکی از دو لایه.
    db.$queryRaw<Array<{ avg_minutes: number | null; n: bigint }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (seated_at - joined_at)) / 60)::float8 AS avg_minutes,
             COUNT(*)::bigint AS n
      FROM waitlist_entries
      WHERE restaurant_id = ${restaurantId}::uuid
        AND created_at >= ${since}
        AND seated_at IS NOT NULL
    `,
    db.waitlistEntry.count({ where: { restaurantId, createdAt: { gte: since }, isVip: true } }),
  ]);

  const countOf = (...statuses: string[]) =>
    byStatus.filter(r => statuses.includes(r.status)).reduce((sum, r) => sum + Number(r._count._all), 0);

  const total = byStatus.reduce((sum, r) => sum + Number(r._count._all), 0);
  const seated = countOf('accepted', 'seated');
  const abandoned = countOf('cancelled', 'declined', 'no_response');
  const conversionRate = total ? Math.round((seated / total) * 100) : 0;

  const avgWait = Number(waitAgg[0]?.n ?? 0) > 0 ? Math.round(Number(waitAgg[0]?.avg_minutes ?? 0)) : 0;

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
    vip_entries: vipEntries,
  };
}
