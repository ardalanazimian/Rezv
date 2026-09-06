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
import { blockTailMinutes, holdHorizonMinutes, tableStateBlocksNow } from './table-occupancy';
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

/** میزِ موردِ نیازِ محاسبه‌ی سانس — همان فیلدهایی که قاعده‌ی «این میز به این گروه می‌خورد؟» لازم دارد. */
export interface AvailabilityTable {
  id: string;
  number: number;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  isActive: boolean;
  state: string;
}

/** رزروِ فعالِ موردِ نیازِ محاسبه‌ی هم‌پوشانی. */
export interface AvailabilityBusy {
  tableId: string | null;
  mergedTableNumbers?: number[] | null;
  slotStart: Date;
  slotEnd: Date;
  blockBufferMinutes?: number | null;
}

export interface AvailabilitySlot {
  time: string;
  free_tables: number[];
  status: 'open' | 'full';
}

/**
 * یک هولدِ نقطه‌ای که به یک **بازه‌ی صریح** لنگر انداخته است.
 *
 * ⚠️ چرا `from`/`through` و نه یک پرچمِ ساده: `tables.state` بی‌زمان است و
 * `computeSlots` بازه‌ای. تبدیلِ پرچم به بازه **باید** یک جایِ مشخص انجام شود
 * (`holdsFromTables`)، وگرنه هر مصرف‌کننده افقِ خودش را می‌سازد — همان الگویی
 * که سه تخصیص‌دهنده‌ی میز را با سه فیلترِ متفاوت به جا گذاشت.
 *
 * و چون بازه با لحظه‌هایِ **مطلق** بیان می‌شود، دقیقاً هم‌جنسِ `busy` است و
 * انضباطِ «الان داخلِ مقدارِ کش‌شده نمی‌رود» را نمی‌شکند: «میزِ ۵ تا ۲۰:۵۰
 * مدعی دارد» یک واقعیتِ زمان‌دار است، نه ساعتِ خواندنِ کش.
 */
export interface AvailabilityHold {
  tableNumber: number;
  from: Date;
  through: Date;
}

/**
 * آیا این میز برای گروهی با این اندازه قابلِ استفاده است؟
 *
 * ⚠️ منبعِ واحد: تا پیش از این، این قاعده فقط به‌صورتِ `where` در کوئریِ Prisma
 * وجود داشت. مسیرِ گروهی (چند رستوران در یک درخواست) نمی‌تواند از همان `where`
 * استفاده کند، و بازنویسیِ دستیِ آن یعنی دو نسخه‌ی قابلِ واگرایی از یک قاعده —
 * دقیقاً همان کلاسی که «چیپِ ساعت روی کارت» را به دروغ تبدیل می‌کند: کارت
 * می‌گوید ۲۰:۰۰ آزاد است و شیتِ رزرو همان لحظه می‌گوید پر. حالا هر دو مسیر
 * همین تابع را صدا می‌زنند. قاعده عیناً همان reservations است: maxPartySize
 * برابرِ null یعنی سقف = capacity.
 *
 * 🚨 **چرا اینجا فقط `maintenance` است و نه `state === 'free'`** (تصمیمِ
 * ۲۰۲۶-۰۹-۰۵، directives/020). این تابع بی‌زمان است: یک‌بار برایِ کلِ روز
 * اجرا می‌شود، پیش از حلقه‌ی سانس‌ها. پس هر شرطی که اینجا بنشیند رویِ
 * **همه‌ی** سانس‌هایِ آن تاریخ اثر می‌گذارد.
 *
 *  • `maintenance` = «خارج از سرویس تا وقتی کارکنان برش‌گردانند» — بازه‌ی
 *    کوتاه نیست و افق‌پذیر هم نیست. حذفِ بی‌زمانش درست است.
 *  • `reserved` / `occupied` / `cleaning` = پرچم‌هایِ **نقطه‌ای** با عمرِ
 *    دقیقه‌ای. اگر اینجا اضافه می‌شدند، میزی که همین حالا مهمان سرش نشسته از
 *    رزروِ **سه‌شنبه‌ی بعد** هم پنهان می‌شد — یعنی خطای رده‌ایِ «پرچمِ نقطه‌ای
 *    را بدونِ افق روی همه‌ی بازه‌ها اعمال کن»، فقط یک طبقه پایین‌تر.
 *
 * آن‌ها به‌جایش از راهِ `holds` واردِ حلقه‌ی سانس می‌شوند، جایی که بازه‌ی هر
 * سانس معلوم است و می‌توان با افق مقایسه‌شان کرد.
 */
export function tableFitsParty(t: AvailabilityTable, party: number): boolean {
  return t.isActive
    && t.state !== 'maintenance'
    && t.capacity >= party
    && t.minPartySize <= party
    && (t.maxPartySize === null || t.maxPartySize === undefined || t.maxPartySize >= party);
}

/** فیلدهایی که برای محاسبه از رکوردِ میز لازم است — برای `select`ِ Prisma. */
export const AVAILABILITY_TABLE_SELECT = {
  id: true, number: true, capacity: true,
  minPartySize: true, maxPartySize: true, isActive: true, state: true,
} as const;

/**
 * ریاضیِ خالصِ سانس‌ها — بدونِ I/O، بدونِ کش، بدونِ دیتابیس.
 *
 * چرا جدا شد: مسیرِ تکی (`computeAndCacheAvailability`) و مسیرِ گروهی
 * (`computeBulkAvailability`) باید *دقیقاً* یک نتیجه بدهند. با استخراجِ این
 * تابع، تفاوتِ آن دو فقط در «چطور داده را می‌خوانند» است، نه در «چه چیزی
 * حساب می‌کنند».
 */
export function computeSlots(input: {
  date: string;
  party: number;
  tz: string;
  cfg: TimingConfig;
  openingHours: OpeningHours | null;
  closureSet: Set<string>;
  tables: AvailabilityTable[];
  busy: AvailabilityBusy[];
  /** هولدهایِ نقطه‌ایِ لنگرانداخته — با `holdsFromTables` ساخته می‌شوند. */
  holds?: AvailabilityHold[];
}): AvailabilitySlot[] {
  const { date, party, tz, cfg, openingHours, closureSet, tables, busy } = input;
  const holds = input.holds ?? [];
  // ⚠️ Part 1 (حسابرسیِ صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): اگر شیفتِ همین روز صریحاً در
  // ساعتِ کاریِ رستوران تعریف شده باشد، سانس‌ها را مستقیماً با گامِ ۳۰دقیقه‌ای
  // از خودِ شیفتِ واقعی می‌سازیم (generateTimesFromHours) — نه فقط زیرمجموعه‌ای
  // از یک لیستِ ثابتِ ۱۱تایی که تصادفاً داخلِ شیفت می‌افتد. اگر آن روز تعریف
  // نشده (رفتارِ قدیمیِ «همیشه باز»، تابع null برمی‌گرداند)، به رفتارِ قبلی
  // (SERVICE_TIMES فیلترشده) برمی‌گردیم — مستند و عمدی، نه یک miss.
  const generated = generateTimesFromHours(openingHours, date, tz, closureSet);
  const times = generated ?? filterTimesByHours(SERVICE_TIMES, openingHours, date, tz, closureSet);

  const fitting = tables.filter(t => tableFitsParty(t, party));
  // همان تعریفِ واحدِ `computeRanges` — نه یک کپیِ قابلِ‌واگرایی (۲۰۲۶-۰۹-۰۵).
  const blockBuffer = blockTailMinutes(cfg);

  return times.map(time => {
    const start = zonedTimeToUtc(date, time, tz);
    const end = new Date(+start + cfg.slotMinutes * 60_000);
    const blockEnd = new Date(+end + blockBuffer * 60_000);
    const freeTables = fitting
      .filter(t => !busy.some(b => {
        // ⚠️ رفع‌شده: قبلاً فقط b.tableId === t.id چک می‌شد — میزهایِ ثانویه‌ی
        // یک رزروِ ترکیبی (merged_table_numbers) اینجا «آزاد» نشون داده
        // می‌شدن، درحالی‌که واقعاً بخشی از یک ترکیبِ فعال بودن.
        const isThisTable = b.tableId === t.id || (b.mergedTableNumbers ?? undefined)?.includes(t.number);
        if (!isThisTable) return false;
        const bBlockEnd = new Date(+b.slotEnd + (b.blockBufferMinutes ?? 0) * 60_000);
        return b.slotStart < blockEnd && bBlockEnd > start; // هم‌پوشانی بازه‌ی بلاک
      }))
      // ⚠️ رفعِ ۲۰۲۶-۰۹-۰۵ — هولدهایِ بدونِ ردیفِ رزرو.
      // `busy` بالا از جدولِ `reservations` می‌آید. یک آفرِ زنده‌ی لیستِ انتظار
      // ردیفِ رزرو **ندارد** (فقط `tables.state='reserved'`)، پس تا ۵ دقیقه
      // میزی که برایِ مهمانِ صف نگه داشته شده به همه «آزاد» اعلام می‌شد و
      // پذیرشش بعداً رویِ `no_table_overlap` می‌شکست.
      //
      // مقایسه **عیناً** همان حسابِ هم‌پوشانیِ بالاست (نیم‌باز، `<` و `>`).
      // عمداً کپی نشده بلکه هم‌شکل نگه داشته شده: دو مرزِ متفاوت برایِ یک
      // مفهوم دقیقاً همان چیزی بود که availability-boundary از آن زاده شد.
      .filter(t => !holds.some(h =>
        h.tableNumber === t.number && h.from < blockEnd && h.through > start,
      ))
      .map(t => t.number);
    return { time, free_tables: freeTables, status: freeTables.length ? 'open' : 'full' } as AvailabilitySlot;
  });
}

/** پیکربندیِ زمان‌بندی از رکوردِ رستوران — با همان پیش‌فرض‌هایِ موتورِ رزرو. */
export function timingOf(r: { slotMinutes?: number | null; bufferMinutes?: number | null; cleaningMinutes?: number | null; holdMinutes?: number | null }): TimingConfig {
  return {
    slotMinutes: r.slotMinutes ?? 90,
    bufferMinutes: r.bufferMinutes ?? 0,
    cleaningMinutes: r.cleaningMinutes ?? 15,
    holdMinutes: r.holdMinutes ?? 10,
  };
}

/**
 * پرچمِ نقطه‌ایِ `tables.state` → بازه‌ی صریح، در **یک** جا برایِ هر دو مسیر.
 *
 * این تنها نقطه‌ای است که «چه وضعیتی مدعی است» (از `table-occupancy`) به
 * «تا کِی» (از `holdHorizonMinutes`) وصل می‌شود. مسیرِ تکی و مسیرِ گروهی هر دو
 * همین را صدا می‌زنند — به همان دلیلی که `computeSlots` مشترک است: دو نسخه‌ی
 * قابلِ‌واگرایی از یک قاعده یعنی کارت بگوید «۲۰:۰۰ آزاد» و شیت بگوید «پر».
 *
 * ⚠️ ردیف‌هایِ میز از قبل خوانده شده‌اند (`AVAILABILITY_TABLE_SELECT` شاملِ
 * `state` است)، پس این رفع **هیچ کوئریِ اضافه‌ای** به مسیرِ داغِ availability
 * اضافه نمی‌کند.
 *
 * ⚠️ باقی‌مانده‌ی صادقانه (رفع نشده، پنهان هم نشده): خروجی داخلِ payloadِ
 * کش‌شده می‌رود و هیچ‌کدام از مسیرهایِ لیستِ انتظار
 * `invalidateAvailability` را صدا نمی‌زنند. پس یک هولدِ تازه تا سقفِ پنجره‌ی
 * تازگیِ کش (۳۰ ثانیه) دیده نمی‌شود، و یک هولدِ آزادشده تا همان اندازه بیش‌از‌حد
 * سرکوب می‌کند. بستنش یعنی افزودنِ باطل‌سازی به چرخه‌ی عمرِ لیستِ انتظار —
 * تغییری در فایلِ دیگر و خارج از دامنه‌ی این رفع.
 */
export function holdsFromTables(
  tables: AvailabilityTable[],
  cfg: TimingConfig,
  now: Date,
): AvailabilityHold[] {
  const through = new Date(+now + holdHorizonMinutes(cfg) * 60_000);
  return tables
    .filter(t => tableStateBlocksNow(t.state))
    .map(t => ({ tableNumber: t.number, from: now, through }));
}

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
        return withoutPastSlots(wrapped.payload); // تازه — مستقیم
      }
      // stale — refresh پس‌زمینه با single-flight lock، ولی stale را الان برگردان
      void refreshAvailabilityInBackground(restaurantId, date, party, cacheKey);
      return withoutPastSlots(wrapped.payload);
    } catch {
      // فرمت قدیمی/خراب — از نو محاسبه کن
    }
  }

  // cache miss کامل — محاسبه و ذخیره (با قفل تا فقط یکی محاسبه کند)
  return withoutPastSlots(await computeAndCacheAvailability(restaurantId, date, party, cacheKey, STALE_SEC));
}

// ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): موتور هیچ‌وقت «الان» را چک نمی‌کرد — سانس‌های
// گذشته‌ی امروز open برمی‌گشتند و کاربر بعد از انتخاب، در submit با
// Err.pastTime رد می‌شد. فیلتر عمداً *بیرونِ* cache انجام می‌شود (نه داخلِ
// compute) تا «الان» در payloadِ کش‌شده نخ نشود؛ tz برای همین داخلِ payload
// ذخیره می‌شود. payloadِ کهنه‌ی بدونِ tz دست‌نخورده عبور می‌کند و ظرفِ TTL
// خودش (حداکثر ۳۰۰ ثانیه) منقضی می‌شود.
function withoutPastSlots(payload: any) {
  if (!payload?.tz || !Array.isArray(payload.slots)) return payload;
  const now = Date.now();
  return {
    ...payload,
    slots: payload.slots.filter((s: any) => +zonedTimeToUtc(payload.date, s.time, payload.tz) > now),
  };
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
  const cfg = timingOf(r);
  const tz = r.timezone ?? 'Asia/Tehran';

  // ── فیلترِ ساعتِ کاری: فقط سانس‌هایی که رستوران بازه ──
  // null openingHours یا رستوران بدون closure → رفتار قدیمی (همه‌ی سانس‌ها).
  const closures = await db.$queryRaw<Array<{ closure_date: Date }>>`
    SELECT closure_date FROM restaurant_closures
    WHERE restaurant_id = ${restaurantId}::uuid AND closure_date = ${date}::date
  `.catch(() => [] as Array<{ closure_date: Date }>);
  const closureSet = new Set(closures.map(c => (c.closure_date instanceof Date
    ? c.closure_date.toISOString().slice(0, 10)
    : String(c.closure_date).slice(0, 10))));

  // ⚠️ تغییرِ عمدی (بولکِ availability): فیلترِ «این میز به این گروه می‌خورد؟»
  // از `where`ِ کوئری به `tableFitsParty` منتقل شد تا مسیرِ تکی و گروهی یک
  // قاعده داشته باشند. تعدادِ میزهایِ یک رستوران کوچک است (ده‌ها، نه هزاران)،
  // پس خواندنِ همه و فیلترِ درون‌حافظه‌ای هزینه‌ی معناداری ندارد.
  const tables = await db.table.findMany({
    where: { restaurantId },
    select: AVAILABILITY_TABLE_SELECT,
  });

  const dayStart = zonedTimeToUtc(date, '00:00', tz);
  const dayEnd = new Date(+dayStart + 24 * 3600_000);
  const busy = await db.reservation.findMany({
    where: {
      restaurantId, status: { in: ACTIVE_RESERVATION_STATUSES as any },
      slotStart: { lt: dayEnd }, slotEnd: { gt: dayStart },
    },
    select: { tableId: true, mergedTableNumbers: true, slotStart: true, slotEnd: true, blockBufferMinutes: true },
  });

  const slots = computeSlots({
    date, party, tz, cfg,
    openingHours: (r.openingHours as OpeningHours | null) ?? null,
    closureSet,
    tables: tables as AvailabilityTable[],
    busy,
    holds: holdsFromTables(tables as AvailabilityTable[], cfg, new Date()),
  });

  const payload = { date, party, slots, tz };
  // wrap با مهر زمان برای SWR
  await redis.set(cacheKey, JSON.stringify({ payload, computedAt: Date.now() }), 'EX', ttlSec);
  return payload;
}

// ═══════════════════════════════════════════════════════════
//  availabilityِ گروهی — «چیپِ ساعت» رویِ کارت‌هایِ فیدِ کشف
//
//  چرا این وجود دارد: اپِ مشتری برایِ هر کارت سه ساعتِ پیش‌نمایش نشان می‌دهد،
//  ولی `mapApiRestaurant` فیلدِ `available_slots` را می‌خواند که **هیچ روتی
//  برنمی‌گرداند** — پس برایِ هر رستورانِ واقعی همیشه `[]` بود و کارت به CTAِ
//  «ببین سانس‌ها» می‌افتاد. (پیش از رفعِ ۲۰۲۶-۰۸-۱۴ بدتر بود: ساعت‌هایِ
//  رستورانِ نمونه به‌عنوانِ سانسِ واقعی نمایش داده می‌شد.)
//
//  چرا یک روتِ جدا، نه داخلِ `GET /restaurants`: لیست ۶۰ ثانیه کش می‌شود و
//  به تاریخ/تعدادِ نفر وابسته نیست؛ availability به هر دو وابسته است و باید
//  با تغییرِ انتخابِ کاربر تازه شود. چسباندنشان یعنی یا کشِ لیست را بی‌اثر
//  کنیم یا سانسِ کهنه سرو کنیم.
//
//  چرا کوئری‌ها دسته‌ای‌اند: صدازدنِ `getAvailability` در حلقه برایِ ۲۴
//  رستوران یعنی ~۹۶ رفت‌وبرگشتِ دیتابیس در یک درخواست. اینجا چهار کوئری برایِ
//  کلِ دسته زده می‌شود و ریاضی‌اش همان `computeSlots`ِ مسیرِ تکی است — پس
//  سریع است بدونِ اینکه نتیجه‌اش با شیتِ رزرو فرق کند.
// ═══════════════════════════════════════════════════════════

/** سقفِ رستوران در یک درخواستِ گروهی — هم‌اندازه‌ی یک صفحه‌ی لیست. */
export const BULK_AVAILABILITY_MAX = 24;

/** سانس‌هایِ خامِ یک رستوران در یک روز — بدونِ فیلترِ «گذشته»، پس قابلِ کش. */
export interface BulkAvailabilityRaw {
  slots: AvailabilitySlot[];
  tz: string;
}

export interface BulkAvailabilityEntry {
  /** فقط سانس‌هایِ واقعاً آزاد و هنوز نرسیده، به ترتیبِ زمان. */
  open: string[];
  /** آیا آن روز اصلاً سانسِ باقی‌مانده‌ای داشت؟ (تعطیل/بسته/تمام‌شده → false) */
  hasSchedule: boolean;
}

/**
 * سانس‌هایِ خامِ چند رستوران در یک تاریخ/اندازه‌ی گروه.
 *
 * عمداً «الان» را نمی‌شناسد: خروجی‌اش قابلِ کش است و فیلترِ سانسِ گذشته
 * *بیرون* از کش انجام می‌شود — دقیقاً همان انضباطِ `withoutPastSlots` در مسیرِ
 * تکی. اگر «الان» داخلِ مقدارِ کش‌شده می‌رفت، تا انقضایِ TTL ساعتِ گذشته را
 * «آزاد» اعلام می‌کردیم و کاربر در submit با `Err.pastTime` رد می‌شد.
 *
 * خروجی به‌ازایِ هر شناسه‌ی *یافت‌شده* یک ورودی دارد. شناسه‌ی ناشناخته اصلاً
 * در خروجی نمی‌آید — نه با آرایه‌ی خالی. تفاوت معنادار است: «این رستوران را
 * نمی‌شناسیم» با «امروز جا ندارد» یکی نیست، و اپ نباید دومی را ادعا کند.
 */
export async function computeBulkSlots(
  restaurantIds: string[],
  date: string,
  party: number,
): Promise<Record<string, BulkAvailabilityRaw>> {
  const out: Record<string, BulkAvailabilityRaw> = {};
  const ids = [...new Set(restaurantIds)].slice(0, BULK_AVAILABILITY_MAX);
  if (!ids.length) return out;

  const restaurants = await db.restaurant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, timezone: true, openingHours: true,
      slotMinutes: true, bufferMinutes: true, cleaningMinutes: true, holdMinutes: true,
    },
  });
  if (!restaurants.length) return out;
  const foundIds = restaurants.map(r => r.id);

  // بازه‌ی زمانیِ کوئریِ رزروها باید همه‌ی تایم‌زون‌هایِ دسته را بپوشاند. با یک
  // روزِ حاشیه در هر طرف، حتی اگر رستوران‌ها تایم‌زونِ متفاوت داشته باشند
  // (تنانتِ چندمنطقه‌ای) هیچ رزروی از قلم نمی‌افتد؛ فیلترِ دقیقِ هم‌پوشانی در
  // `computeSlots` انجام می‌شود، پس حاشیه‌ی اضافه نتیجه را عوض نمی‌کند.
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const windowStart = new Date(+utcMidnight - 24 * 3600_000);
  const windowEnd = new Date(+utcMidnight + 48 * 3600_000);

  const [closures, tables, busy] = await Promise.all([
    db.$queryRaw<Array<{ restaurant_id: string; closure_date: Date }>>`
      SELECT restaurant_id, closure_date FROM restaurant_closures
      WHERE restaurant_id = ANY(${foundIds}::uuid[]) AND closure_date = ${date}::date
    `.catch(() => [] as Array<{ restaurant_id: string; closure_date: Date }>),
    db.table.findMany({
      where: { restaurantId: { in: foundIds } },
      select: { ...AVAILABILITY_TABLE_SELECT, restaurantId: true },
    }),
    db.reservation.findMany({
      where: {
        restaurantId: { in: foundIds },
        status: { in: ACTIVE_RESERVATION_STATUSES as any },
        slotStart: { lt: windowEnd }, slotEnd: { gt: windowStart },
      },
      select: { restaurantId: true, tableId: true, mergedTableNumbers: true, slotStart: true, slotEnd: true, blockBufferMinutes: true },
    }),
  ]);

  const closuresByRest = new Map<string, Set<string>>();
  for (const c of closures) {
    const day = c.closure_date instanceof Date
      ? c.closure_date.toISOString().slice(0, 10)
      : String(c.closure_date).slice(0, 10);
    const set = closuresByRest.get(c.restaurant_id) ?? new Set<string>();
    set.add(day);
    closuresByRest.set(c.restaurant_id, set);
  }
  const tablesByRest = new Map<string, AvailabilityTable[]>();
  for (const t of tables) {
    const arr = tablesByRest.get(t.restaurantId) ?? [];
    arr.push(t);
    tablesByRest.set(t.restaurantId, arr);
  }
  const busyByRest = new Map<string, AvailabilityBusy[]>();
  for (const b of busy) {
    const arr = busyByRest.get(b.restaurantId) ?? [];
    arr.push(b);
    busyByRest.set(b.restaurantId, arr);
  }

  // یک «الان» برایِ کلِ دسته: دو رستوران در یک پاسخ نباید افقشان چند
  // میلی‌ثانیه با هم فرق کند.
  const now = new Date();
  for (const r of restaurants) {
    const tz = r.timezone ?? 'Asia/Tehran';
    const cfg = timingOf(r);
    const restTables = tablesByRest.get(r.id) ?? [];
    out[r.id] = {
      tz,
      slots: computeSlots({
        date, party, tz,
        cfg,
        openingHours: (r.openingHours as OpeningHours | null) ?? null,
        closureSet: closuresByRest.get(r.id) ?? new Set<string>(),
        tables: restTables,
        busy: busyByRest.get(r.id) ?? [],
        holds: holdsFromTables(restTables, cfg, now),
      }),
    };
  }
  return out;
}

/**
 * سانس‌هایِ خام → آن‌چه اپ باید نشان دهد: فقط آزاد، فقط آینده.
 *
 * جدا از `computeBulkSlots` است تا «الان» هرگز داخلِ مقدارِ کش‌شده نرود.
 */
export function bulkEntriesFromRaw(
  raw: Record<string, BulkAvailabilityRaw>,
  date: string,
  now = Date.now(),
): Map<string, BulkAvailabilityEntry> {
  const out = new Map<string, BulkAvailabilityEntry>();
  for (const [id, { slots, tz }] of Object.entries(raw)) {
    const future = slots.filter(s => +zonedTimeToUtc(date, s.time, tz) > now);
    out.set(id, {
      open: future.filter(s => s.status === 'open').map(s => s.time),
      hasSchedule: future.length > 0,
    });
  }
  return out;
}
