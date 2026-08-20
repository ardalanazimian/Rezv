import { Prisma } from '@prisma/client';
import { db } from './db';
import { isTimeWithinHours } from './hours';
import { withSlotLock } from './redis';
import { ApiError, Err } from './errors';
import { enqueueSms } from './sms';
import { emit } from './events';
import { metrics } from './metrics';
import { validateCoupon, calcDiscount, redeemCouponAtomicTx } from './coupons';
import { redeemGiftCardTx } from './loyalty';
import { computeNoShowRisk as defaultNoShowPredictor, type NoShowResult } from './customer-insights';
import { recordPrediction, confidenceFor, NO_SHOW_FEATURE_VERSION } from './prediction-ledger';
import { type OpeningHours } from './hours';
import { computeRanges, genReservationCode, isConflictError, isSerializationError } from './reservation-helpers';
import { invalidateAvailability } from './availability-cache';
import { transitionReservation } from './lifecycle';
import { getOccupiedTableNumbers } from './table-occupancy';

// ⚠️ درسِ تاریخی (باگِ واقعیِ P0 که با تستِ زنده پیدا شد، نه فرض): مقایسه‌ی
// خامِ `status IN (...)` در $queryRaw بدونِ کستِ صریح با enumِ Postgres شکست
// می‌خورد («operator does not exist: reservation_status = text»). راهِ حلِ
// اینجا دیگه لازم نیست (کوئریِ اشغال‌سنجی به table-occupancy.ts منتقل شد که
// با کستِ ستون به‌جایِ کستِ مقادیر همین مشکل رو دور می‌زنه)، ولی درس رو برایِ
// هر $queryRaw جدیدی که با ستونِ enum کار می‌کنه نگه می‌داریم.

/**
 * فاز v2 — Dependency Inversion: موتور رزرو (core domain) به یک «port» انتزاعی
 * بستگی دارد، نه به ماژول concrete هوش مشتری. پیاده‌سازی واقعی (customer-insights.ts)
 * به‌صورت پیش‌فرض در composition root (همین فایل) سیم‌کشی می‌شود، ولی createReservation
 * آن را به‌عنوان پارامتر می‌پذیرد — یعنی هسته‌ی رزرو دیگر از وجود ماژول analytics
 * «آگاه» نیست؛ فقط یک تابع با امضای مشخص می‌خواهد. این هم تست‌پذیری را بهتر می‌کند
 * (می‌توان در تست واحد یک stub تزریق کرد) و هم جلوی coupling مستقیم core→analytics را می‌گیرد.
 * (در مقیاس بزرگ‌تر، گام بعدی منطقی جای‌گزینی این تزریق پارامتری با event/outbox است؛
 * در این مقیاس، over-engineering محسوب می‌شود.)
 */
export type NoShowPredictor = (input: {
  userId: string | null; restaurantId: string; partySize: number; slotStart: Date; createdAt: Date; source: string;
}) => Promise<NoShowResult>;

// ═══════════════════════════════════════════════════════════
//  موتور رزرو رزرونو — نسخه‌ی production
//
//  اصول معماری (دفاع چندلایه در برابر double-booking):
//   1. لایه‌ی حقیقت = دیتابیس: EXCLUDE constraint روی بازه‌ی [slot_start, block_end)
//      که شامل زمان نظافت/بافر است. هیچ تداخلی از این رد نمی‌شود.
//   2. transaction با isolation = Serializable + بازچک availability داخل tx
//      قبل از insert (نیاز ۴ و ۵).
//   3. retry خودکار روی خطاهای serialization/تداخل برای ترافیک بالا (نیاز ۶).
//   4. قفل Redis فقط «بهینه‌سازی» است تا از تلاش‌های هم‌زمان روی یک اسلات
//      جلوگیری کند و فشار retry را کم کند — هرگز منبع حقیقت نیست (نیاز ۳).
//
//  پیکربندی زمان از روی رستوران خوانده می‌شود:
//   slotMinutes (مدت), bufferMinutes + cleaningMinutes (فاصله‌ی بلاک),
//   holdMinutes (انقضای هولد), lateGraceMinutes (تأخیر مهمان).
// ═══════════════════════════════════════════════════════════

const MAX_PARTY_ONLINE = 12;   // سقف رزرو آنلاین (گروه بزرگ‌تر → merge یا تماس)
const MAX_DAYS_AHEAD = 90;     // حداکثر افق رزرو
const TX_MAX_RETRIES = 5;      // تلاش مجدد روی تداخل serialization

export type CreateReservationInput = {
  restaurantId: string;
  date: string;            // '2026-06-12'
  time: string;            // '19:00'
  partySize: number;
  preferences?: string[];
  preorder?: { menuItemId: string; qty: number }[];
  durationMinutes?: number; // override مدت (در غیر این صورت از رستوران)
  userId?: string;          // مشتری لاگین‌شده
  guest?: { name: string; phone?: string; tableNumber?: number; note?: string }; // رزرو دستی staff
  source: 'app' | 'manual';
  notifySms?: boolean;
  hold?: boolean;           // اگر true: رزرو pending با انقضا (هولد موقت)
  // checkout: فقط یکی از این دو (کوپن یا کارت هدیه، نه هردو)
  couponCode?: string;
  giftCardCode?: string;
  giftCardAmount?: number;  // مبلغ دلخواه استفاده از کارت هدیه
  ip?: string | null;       // IP درخواست‌کننده (برای تشخیص سوءاستفاده‌ی کوپن — M1)
};

type TimingConfig = {
  slotMinutes: number;
  bufferMinutes: number;
  cleaningMinutes: number;
  holdMinutes: number;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── بررسی اینکه یک میز در بازه‌ی [start, blockEnd) آزاد است (داخل tx) ──
export async function createReservation(
  input: CreateReservationInput,
  // ⚠️ acquireSlotLock هم به همون الگویِ NoShowPredictor تزریق می‌شود: پیش‌فرضِ
  // production همان withSlotLockِ واقعی (که خودش حالا داخلی fail-open دارد،
  // رجوع کن به redis.ts)؛ تست می‌تواند یک تابعِ جایگزین تزریق کند که «بدونِ
  // قفل» مستقیم fn() را اجرا می‌کند — شبیه‌سازیِ قطعیِ Redis برایِ اثباتِ
  // زنده‌یِ C2 (رزروِ موازی بدونِ قفل هم باید دقیقاً یک برنده داشته باشد،
  // چون DB منبعِ حقیقت است) بدونِ نیاز به یک Redisِ واقعیِ خاموش.
  deps: { predictNoShowRisk?: NoShowPredictor; acquireSlotLock?: typeof withSlotLock } = {},
) {
  const predictNoShowRisk = deps.predictNoShowRisk ?? defaultNoShowPredictor;
  const acquireSlotLock = deps.acquireSlotLock ?? withSlotLock;
  const r = await db.restaurant.findUnique({ where: { id: input.restaurantId } });
  if (!r) throw Err.notFound('رستوران');
  if (!r.isOpen) throw Err.restaurantClosed();

  // ── گارد اتصال: رزرو آنلاین (از اپ مشتری) وقتی رستوران آفلاین است رد می‌شود ──
  // این شبکه‌ی ایمنی نهایی است: حتی اگر اپ مشتری به‌خاطر cache قدیمی رستوران را نشان
  // دهد، ثبت رزرو آنلاین رد می‌شود تا با ثبت حضوریِ آفلاینِ پرسنل تضاد پیدا نکند.
  // رزرو دستی پرسنل (source='manual') همیشه مجاز است — پنل باید آفلاین کار کند.
  if (input.source === 'app' && r.onlineGating) {
    const online = r.lastSeenAt && (Date.now() - new Date(r.lastSeenAt).getTime() < 90_000);
    if (!online) throw Err.restaurantOffline();
  }

  // ── اعتبارسنجی ورودی با خطاهای مشخص ──
  if (!Number.isInteger(input.partySize) || input.partySize < 1) throw Err.validation('تعداد نفر نامعتبر است');
  if (input.partySize > MAX_PARTY_ONLINE) throw Err.partyTooLarge(MAX_PARTY_ONLINE);

  const cfg: TimingConfig = {
    slotMinutes: r.slotMinutes ?? 90,
    bufferMinutes: r.bufferMinutes ?? 0,
    cleaningMinutes: r.cleaningMinutes ?? 15,
    holdMinutes: r.holdMinutes ?? 10,
  };
  const { start, end, blockEnd, duration, blockBufferMin } =
    computeRanges(input.date, input.time, cfg, input.durationMinutes, r.timezone ?? 'Asia/Tehran');

  // ── زمان نباید در گذشته یا خیلی دور باشد ──
  const now = Date.now();
  if (+start < now - 60_000) throw Err.pastTime();
  if (+start > now + MAX_DAYS_AHEAD * 86_400_000) throw Err.tooFarAhead(MAX_DAYS_AHEAD);

  // ── گاردِ ساعتِ کاری (سناریو ۴): رزروِ آنلاین فقط در ساعتِ باز ──
  // رزروِ دستیِ پرسنل (source='manual') مجاز است حتی خارج ساعت (مثلاً رویدادِ خصوصی).
  if (input.source === 'app' && r.openingHours) {
    const closureRows = await db.$queryRaw<Array<{ closure_date: Date }>>`
      SELECT closure_date FROM restaurant_closures
      WHERE restaurant_id = ${input.restaurantId}::uuid AND closure_date = ${input.date}::date
    `.catch(() => [] as Array<{ closure_date: Date }>);
    const closureSet = new Set(closureRows.map(c => (c.closure_date instanceof Date
      ? c.closure_date.toISOString().slice(0, 10)
      : String(c.closure_date).slice(0, 10))));
    const ok = isTimeWithinHours(
      r.openingHours as OpeningHours,
      input.date, input.time, r.timezone ?? 'Asia/Tehran', closureSet,
    );
    if (!ok) throw Err.outsideHours();
  }

  // ── تعیین کاندیداهای میز (هنوز رزرو نمی‌کنیم) ──
  // حالت دستی: شماره‌ی مشخص. حالت خودکار: میزهای مناسب به ترتیب «کم‌هدر».
  //
  // ⚠️ رفع‌شده (بازبینیِ یکپارچگیِ merge، ۲۰۲۶-۰۸-۱۳): میزهایِ ثانویه‌ی یک
  // رزروِ ترکیبیِ فعال (merged_table_numbers) هیچ ردیفِ رزروِ جداگانه‌ای
  // ندارن که EXCLUDE constraint بشناسدش — یعنی بدونِ این پیش‌چک، هم مسیرِ
  // دستی هم مسیرِ خودکار می‌تونستن یک میزِ ثانویه‌ی یک ترکیبِ فعال رو
  // «آزاد» ببینن و همون میز رو به رزروِ کاملاً جدیدی بدن (double-booking
  // واقعیِ فیزیکی، نه فقط یک خطایِ نمایشی). این چک لایه‌ی اپلیکیشنیه (یک
  // TOCTOU raceِ باریک تا commitِ نهایی هنوز ممکنه)؛ محافظِ نهاییِ میزِ
  // *اصلی* همچنان EXCLUDE constraint است — ریسکِ باقی‌مانده‌یِ مستندشده.
  const occupiedNumbers = await getOccupiedTableNumbers(db, r.id, start, blockEnd);

  let candidateTables: { id: string; number: number }[];
  let manualTableNumber: number | null = null;
  if (input.guest?.tableNumber != null) {
    const t = await db.table.findUnique({
      where: { restaurantId_number: { restaurantId: r.id, number: input.guest.tableNumber } },
    });
    if (!t) throw Err.tableNotFound(input.guest.tableNumber);
    // ⚠️ رفع‌شده: مسیرِ دستی (شماره‌ی میزِ مشخص) این چک رو نداشت — مسیرِ
    // خودکار isActive/maintenance رو فیلتر می‌کرد (پایین‌تر) ولی اینجا هرکسی
    // می‌تونست یک میزِ غیرفعال/در-تعمیر رو صریحاً درخواست کنه و رزرو بشه.
    if (!t.isActive || t.state === 'maintenance') throw Err.tableUnavailable(input.guest.tableNumber);
    if (occupiedNumbers.has(t.number)) throw Err.tableConflict();
    if (t.capacity < input.partySize) throw Err.tableTooSmall(input.guest.tableNumber);
    candidateTables = [{ id: t.id, number: t.number }];
    manualTableNumber = t.number;
  } else {
    // ── تخصیص هوشمند میز (Smart Table Assignment) ──
    // میزهای واجد شرایط: فعال، نه در تعمیر، ظرفیت کافی، و محدوده‌ی party مناسب.
    // maxPartySize (یا capacity اگر تعریف نشده) سقف را تعیین می‌کند تا میز خیلی
    // بزرگ به گروه کوچک داده نشود و برعکس.
    const candidates = await db.table.findMany({
      where: {
        restaurantId: r.id,
        isActive: true,
        state: { not: 'maintenance' },          // میز در تعمیر کاندید نیست
        capacity: { gte: input.partySize },
        minPartySize: { lte: input.partySize },
      },
      select: { id: true, capacity: true, maxPartySize: true, priority: true, number: true },
    });
    // فیلتر maxPartySize (پیش‌فرض = capacity) + رتبه‌بندی هوشمند + نه اشغالِ ثانویه
    const eligible = candidates.filter(t =>
      (t.maxPartySize ?? t.capacity) >= input.partySize && !occupiedNumbers.has(t.number));
    // ⚠️ رفع‌شده (باگِ واقعیِ P0 که با تستِ زنده پیدا شد، نه فرض): این کوئری از
    // همون اول capacity >= partySize فیلتر می‌کرد — یعنی برایِ گروهی که از
    // ظرفیتِ *هر* میزِ تکی بزرگ‌تره (دقیقاً موردی که tryMergeTables برایِ
    // حلش ساخته شده)، candidates همیشه خالی بود و اینجا فوراً با
    // noTableForParty رد می‌شد، بدونِ اینکه merge اصلاً امتحان بشه —
    // یعنی merge برایِ تنها سناریویِ اصلیِ خودش (گروهِ بزرگ‌تر از هر میزِ
    // تکی) عملاً غیرقابل‌دسترسی بود. حالا فقط وقتی واقعاً هیچ میزِ تکیِ
    // مناسب *و* هیچ میزِ مرج‌پذیری هم در رستوران نیست، همینجا رد می‌شه؛
    // وگرنه با candidateTables خالی وارد تراکنش می‌شه و منطقِ موجودِ
    // merge-fallback (پایین‌تر در placeReservation) امتحانش می‌کنه.
    if (eligible.length === 0) {
      const hasMergeableTables = await db.table.count({
        where: { restaurantId: r.id, isActive: true, state: { not: 'maintenance' }, isMergeable: true },
      });
      if (hasMergeableTables === 0) throw Err.noTableForParty(input.partySize);
    }
    // مرتب‌سازی هوشمند:
    //  1) اولویت بالاتر اول (priority دستی اپراتور)
    //  2) کم‌ترین هدر ظرفیت (best-fit: نزدیک‌ترین ظرفیت به اندازه‌ی گروه)
    //  3) شماره‌ی میز (پایداری ترتیب)
    eligible.sort((a, b) =>
      (b.priority - a.priority) ||
      ((a.capacity - input.partySize) - (b.capacity - input.partySize)) ||
      (a.number - b.number));
    candidateTables = eligible.map(c => ({ id: c.id, number: c.number }));
  }

  // ── فاز v2: پیش‌بینی ریسک no-show — قبل از تراکنش، فقط خوانش تاریخچه ──
  const noShowRisk = await predictNoShowRisk({
    userId: input.userId ?? null, restaurantId: r.id, partySize: input.partySize, slotStart: start,
    createdAt: new Date(), source: input.source,
  });

  // ── قفل Redis روی اسلات (فقط بهینه‌سازی؛ کلید بر اساس رستوران+شروع) ──
  // این فشار retry را کم می‌کند ولی صحت به دیتابیس وابسته است.
  const lockKey = `resv:${r.id}:${start.toISOString()}`;

  try {
    return await acquireSlotLock(lockKey, 8000, async () => {
      // ── تلاش با retry برای serialization (ترافیک بالا) ──
      let lastErr: unknown;
      for (let attempt = 0; attempt < TX_MAX_RETRIES; attempt++) {
        try {
          return await placeReservation(
            input, r, cfg, { start, end, blockEnd, duration, blockBufferMin },
            candidateTables, manualTableNumber, noShowRisk,
          );
        } catch (e) {
          lastErr = e;
          if (isSerializationError(e) && attempt < TX_MAX_RETRIES - 1) {
            await sleep(20 * (attempt + 1) + Math.random() * 30); // backoff تصادفی
            continue;
          }
          throw e;
        }
      }
      throw lastErr ?? Err.concurrencyRetry();
    });
  } catch (e) {
    // ⚠️ یافته‌ی واقعیِ ممیزی (۲۰۲۶-۰۸-۱۹) — با تستِ زنده‌ی ۳۰ کاربرِ هم‌زمان
    // روی *یک* میز پیدا شد، نه با خواندنِ کد: از ۲۹ درخواستِ ردشده، ۲۶ تا
    // SLOT_LOCK_TIMEOUT (۴۲۳ «این بازه در حال رزرو توسط کاربر دیگری است؛
    // دوباره تلاش کنید») گرفتند و فقط ۳ تا SLOT_FULL. صحت مشکلی نداشت —
    // دقیقاً یک ردیف در DB ثبت شد — ولی *پیام* دروغ بود: به ۲۶ کاربر گفته
    // می‌شد «دوباره تلاش کن» برایِ اسلاتی که دیگر هرگز آزاد نمی‌شود. نتیجه‌اش
    // هم UXِ بد است هم موجِ retryِ بی‌فایده روی همان اسلاتِ پر.
    //
    // رفع: قفل همان‌طور که بود می‌ماند (منبعِ حقیقت هنوز DB است)، فقط پیش از
    // برگرداندنِ ۴۲۳ یک‌بار وضعیتِ واقعیِ اشغال دوباره خوانده می‌شود. اگر
    // ثابت شود همه‌ی کاندیداها پر شده‌اند، خطایِ صادق برگردانده می‌شود.
    // محافظه‌کارانه: فقط وقتی به SLOT_FULL/TABLE_CONFLICT تبدیل می‌شود که
    // بتوان *اثبات* کرد پر است؛ در حالتِ merge (که کاندیدایِ تکی ندارد) یا
    // اگر خودِ این بازخوانی شکست بخورد، همان ۴۲۳ی قبلی برمی‌گردد.
    if (e instanceof ApiError && e.code === 'SLOT_LOCK_TIMEOUT') {
      const occupiedNow = await getOccupiedTableNumbers(db, r.id, start, blockEnd).catch(() => null);
      if (occupiedNow) {
        if (manualTableNumber != null) {
          if (occupiedNow.has(manualTableNumber)) throw Err.tableConflict();
        } else if (candidateTables.length > 0 && candidateTables.every(t => occupiedNow.has(t.number))) {
          throw Err.slotFull(input.time);
        }
      }
    }
    throw e;
  }
}

// ── هسته‌ی ثبت: transaction سریالایزبل + بازچک داخل tx + insert ──
async function placeReservation(
  input: CreateReservationInput,
  r: { id: string; name: string; clubPrefix: string; cbBasePct: number },
  cfg: TimingConfig,
  ranges: { start: Date; end: Date; blockEnd: Date; duration: number; blockBufferMin: number },
  candidateTables: { id: string; number: number }[],
  manualTableNumber: number | null,
  // NoShowResult کامل (نه فقط score/tier): فازِ ۵ به lineage و source نیاز
  // دارد تا پیش‌بینی با ردِ ورودی‌اش در دفتر ثبت شود.
  noShowRisk: NoShowResult,
) {
  const { start, end, blockEnd, duration, blockBufferMin } = ranges;
  const isHold = input.hold === true;
  const status: 'pending' | 'confirmed' = isHold ? 'pending' : 'confirmed';
  const holdExpiresAt = isHold ? new Date(Date.now() + cfg.holdMinutes * 60_000) : null;

  let result: { resv: any; club: { enrolledNow: boolean; code: string } | null; tableNumber: number; checkout?: any };

  try {
    result = await db.$transaction(
      async (tx) => {
        // ── بازچک availability داخل tx و انتخاب اولین میز واقعاً آزاد (نیاز ۴) ──
        // این تنها گیت واقعیِ نهایی قبل از insert است (بیرونِ tx فقط بهینه‌سازیه؛
        // بینِ خواندنِ بیرونی و اینجا race ممکنه). ⚠️ رفع‌شده: قبلاً فقط
        // table_idِ اصلی چک می‌شد؛ حالا getOccupiedTableNumbers میزهایِ
        // ثانویه‌یِ merge رو هم می‌بینه (رجوع کن به table-occupancy.ts) —
        // بدونِ این، این گیتِ «نهایی» برایِ میزهایِ ثانویه اصلاً محافظتی نداشت.
        const occupiedNow = await getOccupiedTableNumbers(tx, r.id, start, blockEnd);
        const chosen = candidateTables.find(t => !occupiedNow.has(t.number)) ?? null;
        const chosenTableId = chosen?.id ?? null;
        if (!chosenTableId) {
          // هیچ میز تکی آزاد نیست → تلاش برای ترکیب میز (merge) در حالت خودکار
          if (manualTableNumber == null) {
            const merged = await tryMergeTables(tx, r.id, input.partySize, start, blockEnd);
            if (merged) {
              return await insertReservation(tx, {
                input, r, status, holdExpiresAt, start, end, duration, blockBufferMin, noShowRisk,
                tableId: merged.primaryId, mergedNumbers: merged.numbers, tableNumber: merged.numbers[0],
              });
            }
            throw Err.slotFull(input.time);
          }
          throw Err.tableConflict();
        }
        // میز شماره برای پاسخ
        const t = await tx.table.findUnique({ where: { id: chosenTableId }, select: { number: true } });
        return await insertReservation(tx, {
          input, r, status, holdExpiresAt, start, end, duration, blockBufferMin, noShowRisk,
          tableId: chosenTableId, mergedNumbers: [], tableNumber: t!.number,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    );
  } catch (e) {
    // ── لایه‌ی حقیقت: اگر EXCLUDE constraint شلیک کرد، تداخل واقعی بوده ──
    if (isConflictError(e)) {
      if (isSerializationError(e)) throw e; // به retry بسپار
      metrics.reservationConflicts.inc();   // تداخل واقعی (double-booking جلوگیری‌شده)
      throw manualTableNumber != null ? Err.tableConflict() : Err.slotFull(input.time);
    }
    throw e;
  }

  // ── بعد از commit: کش availability را باطل کن + SMS ──
  await invalidateAvailability(r.id, input.date);
  if (!isHold && input.notifySms !== false && result.resv.guestPhone) {
    await enqueueSms({
      to: result.resv.guestPhone, template: 'booking_confirm',
      tokens: [result.resv.guestName ?? 'مهمان', r.name, input.time, result.resv.code],
      restaurantId: r.id,  // C6: تا از موجودی SMS رستوران کسر شود
    });
  }

  // ── متریک + انتشار رویداد دامنه (برای webhookها) ──
  metrics.reservationsCreated.inc();
  void emit({
    event: 'reservation.created',
    restaurantId: r.id,
    payload: { code: result.resv.code, party_size: input.partySize, slot_start: result.resv.slotStart, status: result.resv.status },
  });

  // ── فازِ ۵: ثبتِ پیش‌بینیِ no-show در دفترِ پیش‌بینی ──
  // اینجا و نه زودتر: شناسه‌ی رزرو تازه بعد از commit وجود دارد، و پیش‌بینی
  // باید به همان موجودیتی بسته شود که بعداً نتیجه‌اش مشاهده می‌شود.
  //
  // ⚠️ void و بدونِ await عمدی است (بندِ ۴۶): رزرو از قبل commit شده و پاسخ
  // آماده است؛ نوشتنِ دفتر نباید یک میلی‌ثانیه به مسیرِ بحرانی اضافه کند یا
  // با خطایش آن را بشکند. خودِ recordPrediction هم fail-open است.
  //
  // ⚠️ importِ static (نه `await import()`) — یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۰ که فقط
  // روی Node 20 (نسخه‌ی CI) بروز می‌کرد: زیرِ tsx این ماژول به data: URL تبدیل
  // می‌شود و Node 20 نمی‌تواند specifierِ نسبی را از آن حل کند
  // (ERR_UNSUPPORTED_RESOLVE_REQUEST). چون این‌جا یک voidِ بی‌catch بود، شکست
  // کاملاً بی‌صدا بود: هیچ پیش‌بینی‌ای در دفتر ثبت نمی‌شد و هیچ‌کس نمی‌فهمید.
  // یعنی کلِ فازِ ۵ روی Node 20 در عمل مرده بود. catchِ صریح هم اضافه شد تا
  // خطا هرگز به unhandled rejection تبدیل نشود.
  if (noShowRisk.lineage) {
    const lin = noShowRisk.lineage;
    void recordPrediction({
      restaurantId: r.id,
      predictionType: 'no_show',
      entityType: 'reservation',
      entityId: result.resv.id,
      modelSource: noShowRisk.source,
      modelRunId: lin.modelRunId,   // فازِ ۶ — نسبت‌دادن به نسخه‌ی مدل
      featureVersion: NO_SHOW_FEATURE_VERSION,
      predictedValue: lin.probability,
      confidence: confidenceFor({ modelSource: noShowRisk.source, priorTotal: lin.features.priorTotal }),
      features: lin.features,
      horizonAt: result.resv.slotStart,   // نتیجه در لحظه‌ی برگزاری معلوم می‌شود
    }).catch(() => { /* recordPrediction خودش fail-open است؛ این فقط تورِ ایمنی */ });
  }

  return {
    code: result.resv.code,
    status: result.resv.status,
    table_number: result.tableNumber,
    merged_tables: result.resv.mergedTableNumbers ?? [],
    slot_start: result.resv.slotStart,
    slot_end: result.resv.slotEnd,
    hold_expires_at: result.resv.holdExpiresAt,
    club: result.club,
    checkout: result.checkout,  // مبلغ، تخفیف، نهایی، کش‌بک (اگر pre-order داشت)
  };
}

// ── insert رزرو + پیش‌سفارش + باشگاه (همه داخل tx، اتمیک) ──
async function insertReservation(
  tx: Prisma.TransactionClient,
  p: {
    input: CreateReservationInput;
    r: { id: string; clubPrefix: string; cbBasePct: number };
    status: 'pending' | 'confirmed';
    holdExpiresAt: Date | null;
    start: Date; end: Date; duration: number; blockBufferMin: number;
    tableId: string; mergedNumbers: number[]; tableNumber: number;
    noShowRisk: NoShowResult;
  },
) {
  const { input, r } = p;
  // autofill نام/تلفن از پروفایل کاربر
  let guestName = input.guest?.name ?? null;
  let guestPhone = input.guest?.phone ?? null;
  if (input.userId && !guestName) {
    const u = await tx.user.findUnique({ where: { id: input.userId } });
    guestName = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || null;
    guestPhone = u?.phone ?? null;
  }

  // ساخت رزرو با تلاش روی کد یکتا (احتمال تصادم تقریباً صفر، ولی محکم‌کاری)
  let resv;
  for (let i = 0; i < 3; i++) {
    try {
      resv = await tx.reservation.create({
        data: {
          code: genReservationCode(),
          restaurantId: r.id,
          tableId: p.tableId,
          userId: input.userId ?? null,
          guestName, guestPhone,
          partySize: input.partySize,
          slotStart: p.start, slotEnd: p.end,
          durationMinutes: p.duration,
          status: p.status,
          holdExpiresAt: p.holdExpiresAt,
          mergedTableNumbers: p.mergedNumbers,
          source: input.source,
          preferences: input.preferences ?? [],
          note: input.guest?.note ?? null,
          // ستون کمکی constraint: بافر بلاک این رزرو (نظافت + بافر)
          blockBufferMinutes: p.blockBufferMin,
          // فاز v2: ریسک no-show محاسبه‌شده پیش از تراکنش
          noShowRiskScore: p.noShowRisk.score,
          noShowRiskTier: p.noShowRisk.tier,
        } as any,
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && i < 2) continue; // تصادم کد
      throw e;
    }
  }

  if (input.preorder?.length) {
    await tx.reservationItem.createMany({
      data: input.preorder.map(x => ({ reservationId: resv!.id, menuItemId: x.menuItemId, qty: x.qty })),
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Checkout: تخفیف (کوپن یا کارت هدیه — فقط یکی) + کش‌بک
  //  ترتیب: مبلغ پایه (جمع pre-order) → تخفیف → مبلغ نهایی → کش‌بک روی نهایی.
  //  همه داخل همان تراکنش رزرو (اتمیک، با رفع‌های همزمانی ممیزی دوم).
  // ═══════════════════════════════════════════════════════════
  let checkout: { subtotal: number; discount: number; final: number; cashback: number; method: string | null } | null = null;
  if (input.preorder?.length) {
    if (input.couponCode && input.giftCardCode) {
      throw Err.validation('فقط یکی از کوپن یا کارت هدیه قابل استفاده است');
    }

    // مبلغ پایه = جمع قیمت آیتم‌های pre-order
    // ⚠️ رفع‌شده (بازبینیِ امنیتی، ۲۰۲۶-۰۸-۱۳): قبلاً این کوئری restaurantId
    // نداشت — یعنی یک menuItemId از رستورانِ دیگه هم پیدا می‌شد و قیمتِ واقعیِ
    // *همون رستورانِ دیگه* رو برمی‌گردوند (نه فقط قیمتِ اشتباه؛ نشتِ داده‌ی
    // بین‌رستورانی). بدتر از اون، اگر id اصلاً وجود نداشت، priceMap.get()
    // مقدارِ undefined می‌داد و `?? 0` بی‌صدا قیمت رو صفر می‌کرد — یعنی هر
    // UUIDِ دلخواه (حتی جعلی) یک آیتمِ «رایگان» به سبد اضافه می‌کرد. حالا
    // restaurantId فیلتر می‌شه و اگر تعدادِ برگشتی با تعدادِ درخواستی یکی
    // نباشه (یعنی حداقل یک id گم/غلط/متعلق‌به‌رستورانِ‌دیگه بوده)، خطای
    // اعتبارسنجی پرتاب می‌شه — هرگز price??0 خاموش.
    const itemIds = [...new Set(input.preorder.map(x => x.menuItemId))];
    const items = await tx.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId: r.id },
      select: { id: true, priceToman: true },
    });
    if (items.length !== itemIds.length) {
      throw Err.validation('یک یا چند آیتمِ منو نامعتبر است یا متعلق به این رستوران نیست');
    }
    const priceMap = new Map(items.map(i => [i.id, i.priceToman]));
    const subtotal = input.preorder.reduce((sum, x) => sum + (priceMap.get(x.menuItemId) ?? 0) * x.qty, 0);

    let discount = 0;
    let method: string | null = null;

    // ── تخفیف کوپن (اتمیک، با رفع TOCTOU از ممیزی دوم) ──
    if (input.couponCode) {
      const coupon = await validateCoupon(r.id, input.couponCode, input.userId ?? null); // throw می‌کند اگر نامعتبر
      discount = calcDiscount(coupon, subtotal);
      const ok = await redeemCouponAtomicTx(tx, coupon.id, input.userId ?? null, resv!.code, discount, input.ip ?? null);
      if (!ok) throw Err.validation('ظرفیت کوپن پر شده یا سقف استفاده‌ی شما به پایان رسیده است');
      method = 'coupon';
    }
    // ── کارت هدیه (مبلغ دلخواه، با رفع مبلغ منفی از ممیزی دوم) ──
    else if (input.giftCardCode && input.giftCardAmount) {
      const applied = Math.min(input.giftCardAmount, subtotal); // بیش از صورت‌حساب اعمال نشود
      await redeemGiftCardTx(tx, input.giftCardCode, applied);
      discount = applied;
      method = 'gift_card';
    }

    const final = Math.max(0, subtotal - discount);

    // ── کش‌بک روی مبلغ بعد از تخفیف (آنچه واقعاً پرداخت شد) ──
    let cashback = 0;
    if (input.userId && final > 0) {
      const cbPct = r.cbBasePct ?? 0;
      cashback = Math.round((final * cbPct) / 100);
      if (cashback > 0) {
        await tx.pointsLedger.create({
          data: { userId: input.userId, restaurantId: r.id, delta: cashback, reason: 'cashback', note: `کش‌بک رزرو ${resv!.code}` },
        });
      }
    }
    checkout = { subtotal, discount, final, cashback, method };
  }

  // عضویت خودکار باشگاه — اتمیک، بدون تکرار
  let club: { enrolledNow: boolean; code: string } | null = null;
  if (input.userId) {
    const existing = await tx.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: r.id, userId: input.userId } },
    });
    if (existing) club = { enrolledNow: false, code: existing.code };
    else {
      const counter = await tx.clubCodeCounter.upsert({
        where: { restaurantId: r.id },
        create: { restaurantId: r.id, nextValue: 1002 },
        update: { nextValue: { increment: 1 } },
      });
      const code = `${r.clubPrefix}-${counter.nextValue - 1}`;
      await tx.clubMember.create({ data: { restaurantId: r.id, userId: input.userId, code } });
      club = { enrolledNow: true, code };
    }
  }

  return { resv: resv!, club, tableNumber: p.tableNumber, checkout };
}

// ── ترکیب میز (merge): پیدا کردن کوچک‌ترین مجموعه‌ی میزهای آزادِ قابل‌ترکیب ──
// که مجموع ظرفیتشان ≥ گروه باشد. (نیاز ۱۳)
async function tryMergeTables(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  party: number,
  start: Date,
  blockEnd: Date,
): Promise<{ primaryId: string; numbers: number[] } | null> {
  const tables = await tx.table.findMany({
    where: { restaurantId, isActive: true, state: { not: 'maintenance' }, isMergeable: true },
    select: { id: true, number: true, capacity: true, mergeableWith: true },
    orderBy: { number: 'asc' },
  });
  type Tbl = { id: string; number: number; capacity: number; mergeableWith: number[] };
  const tList = tables as Tbl[];
  const byNumber = new Map<number, Tbl>(tList.map(t => [t.number, t]));

  // ── بهینه‌سازی N+1: به‌جای یک کوئری tableIsFree per میز (که در رستوران با
  //    ۲۰ میز قابل‌ترکیب = ۲۰ round-trip داخل تراکنش بود)، یک کوئری همه‌ی
  //    میزهای اشغال‌شده در این بازه را برمی‌گرداند و عضویت را در حافظه چک می‌کنیم.
  //    تست‌شده روی Postgres: ~۰.۳ms برای ۱۰۰۰ رزرو با استفاده از ایندکس GiST.
  //
  //  ⚠️ رفع‌شده: قبلاً فقط table_idِ اصلیِ هر رزرو چک می‌شد — یعنی میزهایِ
  //  ثانویه‌یِ یک ترکیبِ فعال (merged_table_numbers) اینجا «آزاد» دیده
  //  می‌شدن و می‌شد دوباره به‌عنوانِ اصلی یا ثانویه‌یِ یک ترکیبِ دیگه انتخاب
  //  بشن (double-booking واقعی). حالا getOccupiedTableNumbers هر دو رو
  //  پوشش می‌ده (رجوع کن به table-occupancy.ts). ──
  const occupied = await getOccupiedTableNumbers(tx, restaurantId, start, blockEnd);
  const freeFlags = new Map<number, boolean>();
  for (const t of tList) freeFlags.set(t.number, !occupied.has(t.number));

  // برای هر میز آزاد، گروه قابل‌ترکیب آزاد را بساز و ظرفیت جمع کن
  for (const t of tList) {
    if (!freeFlags.get(t.number)) continue;
    if (t.mergeableWith.length === 0) continue;
    const group = [t];
    let cap = t.capacity;
    for (const nb of t.mergeableWith) {
      const neighbor = byNumber.get(nb); // فقط میزهای isMergeable در tList هستند
      if (neighbor && freeFlags.get(nb)) { group.push(neighbor); cap += neighbor.capacity; }
      if (cap >= party) break;
    }
    if (cap >= party && group.length > 1) {
      // میز اصلی = اولی؛ بقیه به‌صورت شماره‌های merged ثبت می‌شوند.
      // نکته: رزرو روی میز اصلی نوشته می‌شود؛ میزهای دیگر از طریق availability/UI بلاک‌شده نمایش داده می‌شوند.
      return { primaryId: group[0].id, numbers: group.map(g => g.number) };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
//  انقضای هولدها (نیاز ۱۱) — توسط cron/کارگر پس‌زمینه صدا زده می‌شود
//  هولدهای منقضی یک‌جا expired می‌شوند. چون expired وضعیت پایانی است و
//  میز را آزاد می‌کند، کش availability آن روزها هم باطل می‌شود.
// ═══════════════════════════════════════════════════════════
// ── عملیاتِ cronِ چرخه‌ی حیات به ماژول جدا منتقل شد (reservation-lifecycle-ops.ts) ──
// re-export برای سازگاری با گذشته.
// ⚠️ markLateNoShows از این خط حذف شد (۲۰۲۶-۰۸-۲۰) — صفر صداکننده داشت و
// رفتارش با مسیرِ واقعیِ تولید (autoMarkNoShow) فرق داشت. دلیلِ کامل در
// reservation-lifecycle-ops.ts.
export { expireStaleHolds } from './reservation-lifecycle-ops';


// ═══════════════════════════════════════════════════════════
//  availability — با درنظرگرفتن مدت/بافر/نظافت از پیکربندی رستوران
// ═══════════════════════════════════════════════════════════
// ── Availability Engine به ماژول جدا منتقل شد (availability.ts) ──
// re-export برای سازگاری با گذشته: importهای موجود از reservations همچنان کار می‌کنند.
export { getAvailability, computeAndCacheAvailability, refreshAvailabilityInBackground } from './availability';

// ═══════════════════════════════════════════════════════════
//  createWalkin — ثبت ورودِ مهمانِ بدون رزرو (walk-in) توسط پرسنل.
//  منطق قبلاً در route پخش شده بود؛ حالا در لایه‌ی سرویس متمرکز است تا
//  با منطق رزروِ عادی هماهنگ بماند (اگر قانون رزرو عوض شود، یک‌جا عوض می‌شود).
// ═══════════════════════════════════════════════════════════

export interface WalkinInput {
  restaurantId: string;
  clubPrefix: string;
  phone: string;
  partySize: number;
  firstName: string | null;
  lastName: string | null;
  tableId: string | null;
  birthDay: number | null;
  birthMonth: number | null;
  durationMinutes?: number;
}

export async function createWalkin(input: WalkinInput) {
  // اعتبارسنجی میز (مالکیت + فعال‌بودن) — قبل از باز کردن transaction.
  // ⚠️ رفع‌شده: قبلاً isActive/maintenance اینجا چک نمی‌شد (فقط مسیرِ خودکارِ
  // createReservation این فیلتر رو داشت) — یعنی می‌شد یک میزِ در-تعمیر رو
  // صریحاً به‌عنوانِ walk-in انتخاب کرد.
  if (input.tableId) {
    const t = await db.table.findUnique({ where: { id: input.tableId } });
    if (!t || t.restaurantId !== input.restaurantId) throw Err.notFound('میز');
    if (!t.isActive || t.state === 'maintenance') throw Err.tableUnavailable(t.number);
  }

  // ⚠️ رفع‌شده (حسابرسیِ قراردادِ زمانی، ۲۰۲۶-۰۸-۱۴): این مسیر قبلاً block_buffer_minutes
  // رو اصلاً ست نمی‌کرد (پیش‌فرضِ ستون = 0)، یعنی block_end این رزرو دقیقاً برابرِ
  // slot_end بود — بدونِ زمانِ نظافت/بافرِ رستوران. برخلافِ مسیرِ آنلاین/دستی
  // (computeRanges، همین فرمول: cleaningMinutes + bufferMinutes)، بلافاصله بعدِ
  // slotEnd یک walk-in، همون میز بدونِ هیچ فاصله‌ای قابلِ رزروِ مجدد بود —
  // انحرافِ واقعیِ بافر، نه فرضی (getOccupiedTableNumbers/EXCLUDE هردو رویِ
  // block_end تکیه می‌کنن). همون فرمولِ computeRanges رو اینجا هم اعمال می‌کنیم.
  const cfgRow = await db.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { cleaningMinutes: true, bufferMinutes: true },
  });
  if (!cfgRow) throw Err.notFound('رستوران');
  const blockBufferMin = (cfgRow.cleaningMinutes ?? 15) + (cfgRow.bufferMinutes ?? 0);

  try {
    return await createWalkinTx(input, blockBufferMin);
  } catch (e) {
    // ── لایه‌ی حقیقت: اگر EXCLUDE constraint شلیک کرد، تداخل واقعی بوده ──
    // ⚠️ رفع‌شده: قبلاً هیچ catchی اینجا نبود — یک ریسِ همزمانیِ واقعی (دو
    // پرسنل هم‌زمان همون میز رو walk-in می‌کنن) خطایِ خامِ Postgres رو تا
    // بیرون leak می‌کرد و errorResponse چون ApiError نبود، ۵۰۰ی مبهم می‌داد
    // («خطای داخلی»)، نه یک ۴۰۹ی قابلِ‌فهم برایِ پرسنل.
    if (isConflictError(e)) {
      metrics.reservationConflicts.inc();
      throw Err.tableConflict();
    }
    throw e;
  }
}

async function createWalkinTx(input: WalkinInput, blockBufferMin: number) {
  return db.$transaction(async (tx) => {
    // کاربر را پیدا یا بساز (همان الگوی ورود با OTP)
    const user = await tx.user.upsert({
      where: { phone: input.phone },
      create: {
        phone: input.phone, firstName: input.firstName, lastName: input.lastName,
        birthDate: (input.birthDay && input.birthMonth) ? new Date(Date.UTC(1990, input.birthMonth - 1, input.birthDay)) : null,
      },
      update: {},
    });
    // تکمیلِ اطلاعاتِ ناقص (بدون overwrite)
    const patch: Record<string, unknown> = {};
    if ((input.firstName || input.lastName) && (!user.firstName || !user.lastName)) {
      patch.firstName = user.firstName || input.firstName;
      patch.lastName = user.lastName || input.lastName;
    }
    if (input.birthDay && input.birthMonth && !user.birthDate) {
      patch.birthDate = new Date(Date.UTC(1990, input.birthMonth - 1, input.birthDay));
    }
    if (Object.keys(patch).length) {
      await tx.user.update({ where: { id: user.id }, data: patch });
    }

    // عضویت خودکار باشگاه — اتمیک، بدون تکرار (همان الگوی createReservation)
    let clubCode: string;
    let enrolledNow: boolean;
    const existingMember = await tx.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: input.restaurantId, userId: user.id } },
    });
    if (existingMember) {
      clubCode = existingMember.code; enrolledNow = false;
    } else {
      const counter = await tx.clubCodeCounter.upsert({
        where: { restaurantId: input.restaurantId },
        create: { restaurantId: input.restaurantId, nextValue: 1002 },
        update: { nextValue: { increment: 1 } },
      });
      clubCode = `${input.clubPrefix}-${counter.nextValue - 1}`;
      await tx.clubMember.create({ data: { restaurantId: input.restaurantId, userId: user.id, code: clubCode } });
      enrolledNow = true;
    }

    // رزرو walk-in: شروع همین الان، وضعیت seated
    const now = new Date();
    const slotEnd = new Date(now.getTime() + (input.durationMinutes || 90) * 60_000);
    const reservation = await tx.reservation.create({
      data: {
        code: genReservationCode(), restaurantId: input.restaurantId, tableId: input.tableId, userId: user.id,
        partySize: input.partySize, slotStart: now, slotEnd, status: 'seated', source: 'walkin',
        // همان فرمولِ computeRanges (cleaningMinutes + bufferMinutes) — قراردادِ
        // زمانی باید بینِ همه‌ی مسیرهایِ نویسنده یکی باشد وگرنه block_end
        // (ستونِ generated که EXCLUDE/getOccupiedTableNumbers به آن تکیه می‌کنن)
        // بینِ walk-in و رزروِ آنلاین/دستی ناهم‌سو می‌شود.
        blockBufferMinutes: blockBufferMin,
      } as any,
    });

    if (input.tableId) {
      await tx.table.update({ where: { id: input.tableId }, data: { state: 'occupied' } });
    }

    return { user, clubCode, enrolledNow, reservation };
  });
}

// ═══════════════════════════════════════════════════════════
//  markArrival — پرسنل «رسید» می‌زند: وضعیت→checked_in، امتیازِ وفاداری، SMS خوش‌آمد.
//  منطق قبلاً در route پخش شده بود؛ حالا در لایه‌ی سرویس متمرکز است تا با
//  بقیه‌ی منطقِ رزرو هماهنگ بماند و قابلِ تست و استفاده‌ی مجدد باشد.
//
//  ⚠️ رفع‌شده (بازبینیِ چرخه‌یِ حیات، ۲۰۲۶-۰۸-۱۳): قبلاً این تابع مستقیم
//  `tx.reservation.update({ data: { status: 'arrived' } })` می‌زد — یعنی
//  state machineِ lifecycle.ts (TRANSITIONS) رو کاملاً دور می‌زد: نه
//  reservation_event (audit) ثبت می‌شد، نه اقتصادِ پلتفرم/اعلانِ استانداردِ
//  چرخه‌ی حیات اجرا می‌شد، و از وضعیت‌هایِ مدرن (auto_confirmed، preparing،
//  running_late) پشتیبانی نمی‌کرد (فقط confirmed/pending). حالا از طریقِ
//  transitionReservation (تنها نویسنده‌ی مجاز) به وضعیتِ استانداردِ جدید
//  checked_in منتقل می‌شه؛ هر انتقالی که TRANSITIONS اجازه نده (auto_confirmed،
//  preparing، running_late، confirmed → checked_in مجازند؛ pending نه) با
//  ۴۲۲ ساختاریافته (INVALID_STATUS_TRANSITION) رد می‌شه.
// ═══════════════════════════════════════════════════════════
export interface ArrivalInput {
  code: string;
  restaurantId: string;  // از withRestaurantAuth — رزرو باید متعلق به همین شعبه باشد
  actorStaffId: string;
}

const ARRIVAL_POINTS = 50;

export async function markArrival(input: ArrivalInput) {
  const resv = await db.reservation.findUnique({ where: { code: input.code } });
  if (!resv || resv.restaurantId !== input.restaurantId) throw Err.notFound('رزرو');

  // idempotency: اگر از قبل checked_in بود، این یک تکرار (retry) است — دوباره
  // امتیاز/SMS نده. transitionReservation خودش یک no-op امن برمی‌گردونه
  // (from===to)، ولی تصمیمِ «آیا این بارِ اوله» باید قبل از فراخوانی گرفته بشه.
  const wasAlreadyCheckedIn = resv.status === 'checked_in';

  const updated = await transitionReservation({
    reservationId: resv.id,
    to: 'checked_in',
    actor: `staff:${input.actorStaffId}`,
  });

  // امتیازِ باشگاهِ وفاداریِ رستوران — سیستمِ کاملاً جدا از اقتصادِ یکپارچه‌ی
  // پلتفرم (customer_economy_profiles)؛ اینجا عمداً دست‌نخورده نگه داشته شد.
  if (!wasAlreadyCheckedIn && resv.userId) {
    await db.clubMember.updateMany({
      where: { restaurantId: resv.restaurantId, userId: resv.userId },
      data: { points: { increment: ARRIVAL_POINTS } },
    });
  }

  // SMS خوش‌آمد — فقط بارِ اول (نه در تکرار/retry)
  if (!wasAlreadyCheckedIn && resv.guestPhone) {
    const member = resv.userId ? await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: resv.restaurantId, userId: resv.userId } },
    }) : null;
    await enqueueSms({
      to: resv.guestPhone, template: 'welcome_visit',
      tokens: [resv.guestName ?? 'مهمان', String(member?.points ?? 0), String(ARRIVAL_POINTS), member?.tier ?? 'bronze'],
      restaurantId: resv.restaurantId,
    });
  }

  return { code: resv.code, status: updated.status };
}
