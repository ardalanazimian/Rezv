import { Prisma } from '@prisma/client';
import { db } from './db';
import { withSlotLock } from './redis';
import { Err } from './errors';
import { enqueueSms } from './sms';
import { emit } from './events';
import { metrics } from './metrics';
import { validateCoupon, calcDiscount, redeemCouponAtomicTx } from './coupons';
import { redeemGiftCardTx } from './loyalty';
import { computeNoShowRisk as defaultNoShowPredictor } from './customer-insights';
import { type OpeningHours } from './hours';
import { computeRanges, genReservationCode, isConflictError, isSerializationError } from './reservation-helpers';
import { ACTIVE_RESERVATION_STATUSES } from './reservation-status';
import { invalidateAvailability } from './availability-cache';

// مجموعه‌ی وضعیت‌های فعال به‌صورت Prisma.sql — برای درج امن و پارامتری در $queryRaw.
// یک‌بار ساخته می‌شود و در همه‌ی کوئری‌های raw تداخل/اشغال استفاده می‌شود (به‌جای
// لیست رشته‌ای دستی که قبلاً ناقص بود و باعث C1 می‌شد).
//
// ⚠️ باگِ واقعیِ P0 که با تستِ زنده پیدا شد (نه فرض): بدونِ کستِ صریحِ
// `::reservation_status`، Postgres پارامترهای این fragment را از نوعِ متنِ خام
// (`text`) می‌بیند و مقایسه‌ی `status IN (...)` با خطای
// «operator does not exist: reservation_status = text» شکست می‌خورد — یعنی
// همین کوئریِ اشغال‌سنجیِ میز (که مانعِ double-booking است) در مسیرِ اصلیِ
// رزروِ آنلاین (وقتی حداقل یک میزِ کاندیدا وجود دارد) با ۵۰۰ رد می‌شد.
// روشِ کشف: curlِ مستقیم به /api/v1/reservations رویِ Postgresِ واقعی (نه
// mock) با یک رستوران/میزِ واقعی → ۵۰۰؛ ریشه‌یابی با یک اسکریپتِ Prismaِ جدا
// که دقیقاً همین الگو را با/بدونِ کست اجرا کرد. جمع‌بندی به این استریمِ
// چیدمانِ کست تأیید شد: با کست کار می‌کند، بدونِ کست هرجا کار می‌رود می‌شکند.
const ACTIVE_STATUSES_FRAGMENT = Prisma.join(
  ACTIVE_RESERVATION_STATUSES.map((s) => Prisma.sql`${s}::reservation_status`),
);

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
}) => Promise<{ score: number; tier: 'low' | 'medium' | 'high'; source: 'learned' | 'heuristic' }>;

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
  deps: { predictNoShowRisk?: NoShowPredictor } = {},
) {
  const predictNoShowRisk = deps.predictNoShowRisk ?? defaultNoShowPredictor;
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
    const { isTimeWithinHours } = await import('./hours');
    const ok = isTimeWithinHours(
      r.openingHours as OpeningHours,
      input.date, input.time, r.timezone ?? 'Asia/Tehran', closureSet,
    );
    if (!ok) throw Err.outsideHours();
  }

  // ── تعیین کاندیداهای میز (هنوز رزرو نمی‌کنیم) ──
  // حالت دستی: شماره‌ی مشخص. حالت خودکار: میزهای مناسب به ترتیب «کم‌هدر».
  let candidateTableIds: string[];
  let manualTableNumber: number | null = null;
  if (input.guest?.tableNumber != null) {
    const t = await db.table.findUnique({
      where: { restaurantId_number: { restaurantId: r.id, number: input.guest.tableNumber } },
    });
    if (!t) throw Err.tableNotFound(input.guest.tableNumber);
    if (t.capacity < input.partySize) throw Err.tableTooSmall(input.guest.tableNumber);
    candidateTableIds = [t.id];
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
    // فیلتر maxPartySize (پیش‌فرض = capacity) + رتبه‌بندی هوشمند
    const eligible = candidates.filter(t =>
      (t.maxPartySize ?? t.capacity) >= input.partySize);
    if (eligible.length === 0) throw Err.noTableForParty(input.partySize);
    // مرتب‌سازی هوشمند:
    //  1) اولویت بالاتر اول (priority دستی اپراتور)
    //  2) کم‌ترین هدر ظرفیت (best-fit: نزدیک‌ترین ظرفیت به اندازه‌ی گروه)
    //  3) شماره‌ی میز (پایداری ترتیب)
    eligible.sort((a, b) =>
      (b.priority - a.priority) ||
      ((a.capacity - input.partySize) - (b.capacity - input.partySize)) ||
      (a.number - b.number));
    candidateTableIds = eligible.map(c => c.id);
  }

  // ── فاز v2: پیش‌بینی ریسک no-show — قبل از تراکنش، فقط خوانش تاریخچه ──
  const noShowRisk = await predictNoShowRisk({
    userId: input.userId ?? null, restaurantId: r.id, partySize: input.partySize, slotStart: start,
    createdAt: new Date(), source: input.source,
  });

  // ── قفل Redis روی اسلات (فقط بهینه‌سازی؛ کلید بر اساس رستوران+شروع) ──
  // این فشار retry را کم می‌کند ولی صحت به دیتابیس وابسته است.
  const lockKey = `resv:${r.id}:${start.toISOString()}`;

  return withSlotLock(lockKey, 8000, async () => {
    // ── تلاش با retry برای serialization (ترافیک بالا) ──
    let lastErr: unknown;
    for (let attempt = 0; attempt < TX_MAX_RETRIES; attempt++) {
      try {
        return await placeReservation(
          input, r, cfg, { start, end, blockEnd, duration, blockBufferMin },
          candidateTableIds, manualTableNumber, noShowRisk,
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
}

// ── هسته‌ی ثبت: transaction سریالایزبل + بازچک داخل tx + insert ──
async function placeReservation(
  input: CreateReservationInput,
  r: { id: string; name: string; clubPrefix: string; cbBasePct: number },
  cfg: TimingConfig,
  ranges: { start: Date; end: Date; blockEnd: Date; duration: number; blockBufferMin: number },
  candidateTableIds: string[],
  manualTableNumber: number | null,
  noShowRisk: { score: number; tier: 'low' | 'medium' | 'high' },
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
        // بهینه‌سازی N+1: یک کوئری همه‌ی کاندیداهای اشغال‌شده را می‌گیرد، نه per-table.
        let chosenTableId: string | null = null;
        if (candidateTableIds.length > 0) {
          const occRows = await tx.$queryRaw<{ table_id: string }[]>`
            SELECT DISTINCT table_id FROM reservations
            WHERE status IN (${ACTIVE_STATUSES_FRAGMENT})
              AND table_id = ANY(${candidateTableIds}::uuid[])
              AND tsrange(slot_start, block_end) && tsrange(${start}::timestamp, ${blockEnd}::timestamp)
          `;
          const occupied = new Set(occRows.map(r => r.table_id));
          chosenTableId = candidateTableIds.find(tid => !occupied.has(tid)) ?? null;
        }
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
    noShowRisk: { score: number; tier: 'low' | 'medium' | 'high' };
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
    const itemIds = input.preorder.map(x => x.menuItemId);
    const items = await tx.menuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, priceToman: true } });
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
  //    تست‌شده روی Postgres: ~۰.۳ms برای ۱۰۰۰ رزرو با استفاده از ایندکس GiST. ──
  const occupiedRows = await tx.$queryRaw<{ table_id: string }[]>`
    SELECT DISTINCT table_id FROM reservations
    WHERE status IN (${ACTIVE_STATUSES_FRAGMENT})
      AND table_id IS NOT NULL
      AND tsrange(slot_start, block_end) && tsrange(${start}::timestamp, ${blockEnd}::timestamp)
  `;
  const occupied = new Set(occupiedRows.map(r => r.table_id));
  const freeFlags = new Map<number, boolean>();
  for (const t of tList) freeFlags.set(t.number, !occupied.has(t.id));

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
export { expireStaleHolds, markLateNoShows } from './reservation-lifecycle-ops';


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
  // اعتبارسنجی میز (مالکیت) — قبل از باز کردن transaction
  if (input.tableId) {
    const t = await db.table.findUnique({ where: { id: input.tableId } });
    if (!t || t.restaurantId !== input.restaurantId) throw Err.notFound('میز');
  }

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
      },
    });

    if (input.tableId) {
      await tx.table.update({ where: { id: input.tableId }, data: { state: 'occupied' } });
    }

    return { user, clubCode, enrolledNow, reservation };
  });
}

// ═══════════════════════════════════════════════════════════
//  markArrival — پرسنل «رسید» می‌زند: وضعیت→arrived، امتیازِ وفاداری، SMS خوش‌آمد.
//  منطق قبلاً در route پخش شده بود؛ حالا در لایه‌ی سرویس متمرکز است تا با
//  بقیه‌ی منطقِ رزرو هماهنگ بماند و قابلِ تست و استفاده‌ی مجدد باشد.
// ═══════════════════════════════════════════════════════════
export interface ArrivalInput {
  code: string;
  tenantId: string;   // از توکنِ پرسنل — برای بررسی مالکیت
}

const ARRIVAL_POINTS = 50;

export async function markArrival(input: ArrivalInput) {
  const resv = await db.reservation.findUnique({
    where: { code: input.code },
    include: { restaurant: { select: { tenantId: true, name: true } } },
  });
  if (!resv) throw Err.notFound('رزرو');
  if (resv.restaurant.tenantId !== input.tenantId) throw Err.forbidden();
  if (resv.status !== 'confirmed' && resv.status !== 'pending') {
    throw Err.validation(`رزرو در وضعیت ${resv.status} قابل تأیید حضور نیست`);
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.reservation.update({ where: { id: resv.id }, data: { status: 'arrived' } });
    if (resv.userId) {
      await tx.clubMember.updateMany({
        where: { restaurantId: resv.restaurantId, userId: resv.userId },
        data: { points: { increment: ARRIVAL_POINTS } },
      });
    }
    return u;
  });

  // SMS خوش‌آمد (بعد از commit — شکستش رزرو را برنمی‌گرداند)
  if (resv.guestPhone) {
    const member = resv.userId ? await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: resv.restaurantId, userId: resv.userId } },
    }) : null;
    await enqueueSms({
      to: resv.guestPhone, template: 'welcome_visit',
      tokens: [resv.guestName ?? 'مهمان', String(member?.points ?? 0), String(ARRIVAL_POINTS), member?.tier ?? 'bronze'],
      restaurantId: resv.restaurantId,
    });
  }

  return { code: updated.code, status: updated.status };
}
