// ═══════════════════════════════════════════════════════════
//  Availability Engine — موتورِ محاسبه‌ی سانس‌های خالی
//
//  مسئولیتِ واحد (Single Responsibility): «کدام سانس‌ها برای رزرو آزادند؟»
//  جدا از Reservation Engine (که رزرو را *می‌نویسد*) — این موتور فقط *می‌خواند* و محاسبه می‌کند.
//
//  شامل:
//   • getAvailability — نقطه‌ی ورودِ عمومی (با Stale-While-Revalidate)
//   • computeAndCacheAvailability — محاسبه‌ی واقعی + cache
//   • refreshAvailabilityInBackground — refresh پس‌زمینه با single-flight lock
//
//  خالص و مستقل از وب (هیچ NextResponse/Request) — قابلِ استفاده در اپ موبایل و workerها.
// ═══════════════════════════════════════════════════════════
import { db } from './db';
import { redis } from './redis';
import { Err } from './errors';
import { availabilityKey } from './availability-cache';
import { ACTIVE_RESERVATION_STATUSES } from './reservation-status';
import { filterTimesByHours, generateTimesFromHours, zonedTimeToUtc, type OpeningHours } from './hours';

/** پیکربندیِ زمان‌بندیِ رستوران — مدت سانس، بافر، نظافت، هولد. */
export interface TimingConfig {
  slotMinutes: number;
  bufferMinutes: number;
  cleaningMinutes: number;
  holdMinutes: number;
}

// سانس‌های استانداردِ سرویس (ناهار + شام). با ساعتِ کاریِ رستوران فیلتر می‌شوند.
const SERVICE_TIMES = ['12:30', '13:00', '13:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

/**
 * نقطه‌ی ورودِ عمومیِ availability با Stale-While-Revalidate (ضد thundering herd).
 * اگر cache تازه باشد مستقیم؛ اگر stale باشد فوراً stale را می‌دهد و در پس‌زمینه refresh می‌کند.
 */
export async function getAvailability(restaurantId: string, date: string, party: number) {
  const cacheKey = availabilityKey(restaurantId, date, party);
  const FRESH_SEC = 30;        // تا ۳۰s کاملاً تازه
  const STALE_SEC = 300;       // تا ۵ دقیقه به‌عنوان stale قابل‌سرو (پس‌زمینه refresh)

  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const wrapped = JSON.parse(cached) as { payload: any; computedAt: number };
      const ageSec = (Date.now() - wrapped.computedAt) / 1000;
      if (ageSec < FRESH_SEC) {
        return wrapped.payload; // تازه — مستقیم
      }
      // stale — refresh پس‌زمینه با single-flight lock، ولی stale را الان برگردان
      void refreshAvailabilityInBackground(restaurantId, date, party, cacheKey);
      return wrapped.payload;
    } catch {
      // فرمت قدیمی/خراب — از نو محاسبه کن
    }
  }

  // cache miss کامل — محاسبه و ذخیره (با قفل تا فقط یکی محاسبه کند)
  return computeAndCacheAvailability(restaurantId, date, party, cacheKey, STALE_SEC);
}

/** refresh پس‌زمینه با قفل single-flight — فقط یک request همزمان محاسبه می‌کند. */
export async function refreshAvailabilityInBackground(restaurantId: string, date: string, party: number, cacheKey: string) {
  const lockKey = `avail-lock:{${cacheKey}}`;
  // قفل کوتاه؛ اگر کسی دیگر در حال refresh است، رد شو (او انجام می‌دهد)
  const gotLock = await redis.set(lockKey, '1', 'PX', 10_000, 'NX');
  if (!gotLock) return;
  try {
    await computeAndCacheAvailability(restaurantId, date, party, cacheKey, 300);
  } catch {
    // refresh پس‌زمینه نباید چیزی را بشکند؛ stale تا انقضای کامل می‌ماند
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

/** محاسبه‌ی واقعی availability و ذخیره در cache با مهر زمان. */
export async function computeAndCacheAvailability(restaurantId: string, date: string, party: number, cacheKey: string, ttlSec: number) {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!r) throw Err.notFound('رستوران');
  const cfg: TimingConfig = {
    slotMinutes: r.slotMinutes ?? 90,
    bufferMinutes: r.bufferMinutes ?? 0,
    cleaningMinutes: r.cleaningMinutes ?? 15,
    holdMinutes: r.holdMinutes ?? 10,
  };

  // ── فیلترِ ساعتِ کاری: فقط سانس‌هایی که رستوران بازه ──
  // null openingHours یا رستوران بدون closure → رفتار قدیمی (همه‌ی سانس‌ها).
  const closures = await db.$queryRaw<Array<{ closure_date: Date }>>`
    SELECT closure_date FROM restaurant_closures
    WHERE restaurant_id = ${restaurantId}::uuid AND closure_date = ${date}::date
  `.catch(() => [] as Array<{ closure_date: Date }>);
  const closureSet = new Set(closures.map(c => (c.closure_date instanceof Date
    ? c.closure_date.toISOString().slice(0, 10)
    : String(c.closure_date).slice(0, 10))));
  // ⚠️ Part 1 (حسابرسیِ صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): اگر شیفتِ همین روز صریحاً در
  // ساعتِ کاریِ رستوران تعریف شده باشد، سانس‌ها را مستقیماً با گامِ ۳۰دقیقه‌ای
  // از خودِ شیفتِ واقعی می‌سازیم (generateTimesFromHours) — نه فقط زیرمجموعه‌ای
  // از یک لیستِ ثابتِ ۱۱تایی که تصادفاً داخلِ شیفت می‌افتد. اگر آن روز تعریف
  // نشده (رفتارِ قدیمیِ «همیشه باز»، تابع null برمی‌گرداند)، به رفتارِ قبلی
  // (SERVICE_TIMES فیلترشده) برمی‌گردیم — مستند و عمدی، نه یک miss.
  const hoursForDay = (r.openingHours as OpeningHours | null) ?? null;
  const generated = generateTimesFromHours(hoursForDay, date, r.timezone ?? 'Asia/Tehran', closureSet);
  const times = generated ?? filterTimesByHours(
    SERVICE_TIMES,
    hoursForDay,
    date,
    r.timezone ?? 'Asia/Tehran',
    closureSet,
  );
  const tables = await db.table.findMany({
    where: { restaurantId, isActive: true, state: { not: 'maintenance' }, capacity: { gte: party }, minPartySize: { lte: party } },
    select: { id: true, number: true },
  });

  const tz = r.timezone ?? 'Asia/Tehran';
  const dayStart = zonedTimeToUtc(date, '00:00', tz);
  const dayEnd = new Date(+dayStart + 24 * 3600_000);
  const busy = await db.reservation.findMany({
    where: {
      restaurantId, status: { in: ACTIVE_RESERVATION_STATUSES as any },
      slotStart: { lt: dayEnd }, slotEnd: { gt: dayStart },
    },
    select: { tableId: true, mergedTableNumbers: true, slotStart: true, slotEnd: true, blockBufferMinutes: true } as any,
  });

  const blockBuffer = cfg.cleaningMinutes + cfg.bufferMinutes;
  const slots = times.map(time => {
    const start = zonedTimeToUtc(date, time, tz);
    const end = new Date(+start + cfg.slotMinutes * 60_000);
    const blockEnd = new Date(+end + blockBuffer * 60_000);
    const freeTables = tables
      .filter(t => !busy.some((b: any) => {
        // ⚠️ رفع‌شده: قبلاً فقط b.tableId === t.id چک می‌شد — میزهایِ ثانویه‌ی
        // یک رزروِ ترکیبی (merged_table_numbers) اینجا «آزاد» نشون داده
        // می‌شدن، درحالی‌که واقعاً بخشی از یک ترکیبِ فعال بودن.
        const isThisTable = b.tableId === t.id || (b.mergedTableNumbers as number[] | undefined)?.includes(t.number);
        if (!isThisTable) return false;
        const bBlockEnd = new Date(+b.slotEnd + (b.blockBufferMinutes ?? 0) * 60_000);
        return b.slotStart < blockEnd && bBlockEnd > start; // هم‌پوشانی بازه‌ی بلاک
      }))
      .map(t => t.number);
    return { time, free_tables: freeTables, status: freeTables.length ? 'open' : 'full' };
  });

  const payload = { date, party, slots };
  // wrap با مهر زمان برای SWR
  await redis.set(cacheKey, JSON.stringify({ payload, computedAt: Date.now() }), 'EX', ttlSec);
  return payload;
}
