import { createHash } from 'crypto';
import { db } from './db';
import { hourInTz, dateKeyInTz, weekdayInTz } from './hours';

// ═══════════════════════════════════════════════════════════════════════
//  M0 — زیرساختِ رویداد برای ML
//  طرح: docs/audit/fixes/M0-EVENT-SUBSTRATE-DESIGN.md (گزینه‌ی A)
//  تأیید: CEO `rezv-9c [5283b5]`، ۲۰۲۶-۰۹-۰۹
//
//  این ماژول **هیچ مدلی ندارد و هیچ چیزی پیش‌بینی نمی‌کند.** فقط زمین را
//  می‌ریزد: چه چیزی در لحظه‌ی تصمیم می‌دانستیم، با کدام نسخه‌ی قانون، و
//  این مهمان در کدام سطلِ holdout است.
//
//  ⚠️ هیچ‌کجای این فایل کلمه‌ی «هوشمند» یا AI به کار نمی‌رود، چون هیچ مدلی
//  اینجا نیست. (منشور: بدونِ AI-washing.)
// ═══════════════════════════════════════════════════════════════════════

/**
 * نسخه‌ی قانونی که ردیف را تولید کرده.
 * ⚠️ هر بار که منطقِ تولیدِ `decision_inputs` یا معنیِ یکی از کلیدها عوض شد،
 * این باید عوض شود — وگرنه ردیف‌های پیش و پس از تغییر در آموزش با هم قاطی
 * می‌شوند و هیچ‌کس نمی‌فهمد.
 */
export const RULE_VERSION = 'm0.1-2026-09-09';

/**
 * درصدِ holdout. بازه‌ی مجازِ مندیت ۵–۱۰٪؛ ۱۰ انتخاب شد چون پیش از لانچ
 * ترافیک کم است و ۵٪ نمونه‌ی بی‌معنی می‌داد.
 * ⚠️ این عدد **هرگز برای بهترکردنِ یک متریک کم نمی‌شود.** کم‌کردنش یعنی
 * پس‌گرفتنِ تنها نمونه‌ی بی‌طرفِ سیستم.
 */
export const HOLDOUT_PCT = 10;

/**
 * نمکِ تخصیصِ سطل.
 * ⚠️ **هرگز عوض نشود.** عوض‌کردنش کلِ تاریخِ تخصیص را بازنویسی می‌کند: همان
 * مهمان به سطلِ دیگری می‌افتد و مقایسه‌ی holdout با گذشته بی‌معنی می‌شود.
 * عمداً ثابتِ درون‌کد است و نه env: یک env که ست نشود بی‌صدا سطل‌ها را عوض
 * می‌کند، و آن نوع خرابی در هیچ متریکی دیده نمی‌شود.
 */
const HOLDOUT_SALT = 'rezervno-holdout-v1';

/** یک ورودیِ تصمیم: مقدار، به‌همراهِ پنجره‌ی زمانیِ **اعلام‌شده**‌اش. */
export type DecisionInput = { value: unknown; window: string };
export type DecisionInputs = Record<string, DecisionInput>;

/**
 * قیدِ الزامیِ CEO (۲۰۲۶-۰۹-۰۹): «هر ورودی پنجره‌ی زمانیِ اعلام‌شده دارد، و
 * هر ورودیِ بدونِ آن رد می‌شود.»
 *
 * چرا این‌قدر سخت‌گیرانه: featureی که از داده‌ای ساخته شود که در لحظه‌ی تصمیم
 * وجود نداشته، **نشتِ زمانی** است — مدل را در ارزیابیِ آفلاین عالی و در تولید
 * تصادفی می‌کند، و در هیچ متریکِ آفلاینی دیده نمی‌شود. افزودنِ ورودیِ تازه
 * ارزان است؛ فهمیدنِ اینکه ورودیِ شیپ‌شده نشت داشته، نه.
 */
export function assertDeclaredWindows(inputs: DecisionInputs): void {
  for (const [key, entry] of Object.entries(inputs)) {
    const w = (entry as DecisionInput | undefined)?.window;
    if (typeof w !== 'string' || w.trim() === '') {
      throw new Error(
        `ورودیِ تصمیمِ «${key}» پنجره‌ی زمانیِ اعلام‌شده ندارد — ` +
        'یا پنجره‌اش را صادقانه اعلام کن یا از v1 حذفش کن',
      );
    }
  }
}

/**
 * سطلِ holdout — **پایدار به ازای هر مهمان**، نه هر رزرو.
 *
 * چرا به ازای مهمان: اگر به ازای رزرو تصادفی شود، یک مهمان هم در holdout و هم
 * در treatment می‌افتد، و تخمینِ upliftِ بعدی آلوده می‌شود — دقیقاً همان چیزی
 * که holdout برای اندازه‌گیریش هست.
 *
 * `null` یعنی مهمانِ ناشناس (نه userId نه شماره). `null` را «خارج از holdout»
 * نخوانید؛ یعنی **تخصیص‌نیافته**.
 */
export function holdoutBucket(guestKey: string | null | undefined): number | null {
  if (!guestKey) return null;
  const digest = createHash('sha256').update(`${HOLDOUT_SALT}:${guestKey}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/** آیا این سطل داخلِ holdout است؟ `null` (تخصیص‌نیافته) **false** نیست — `null` است. */
export function isHoldout(bucket: number | null): boolean | null {
  if (bucket === null) return null;
  return bucket < HOLDOUT_PCT;
}

/** کلیدِ پایدارِ مهمان: کاربرِ ثبت‌شده، وگرنه شماره‌ی مهمان. */
export function guestKeyOf(r: { userId?: string | null; guestPhone?: string | null }): string | null {
  return r.userId ?? r.guestPhone ?? null;
}

/**
 * ورودی‌هایی که در لحظه‌ی انتقال **بدونِ هیچ کوئریِ اضافه** و صادقانه در
 * دسترس‌اند — همه از خودِ ردیفِ رزروی که تراکنش قبلاً خوانده است.
 *
 * ⚠️ آنچه عمداً **اینجا نیست** و چرا (قیدِ CEO: اگر پنجره‌اش صادقانه اعلام
 * نمی‌شود، از v1 حذفش کن و بگو):
 *   • «ظرفیتِ آزادِ آن اسلات» — یک کوئریِ جدا داخلِ تراکنشِ داغِ تغییرِ وضعیت
 *     می‌خواهد، و مهم‌تر: در لحظه‌ی **انتقال** محاسبه می‌شد نه لحظه‌ی **رزرو**،
 *     پس پنجره‌اش «as_of:decision» نبود و اعلامش دروغ می‌شد.
 *   • «تعدادِ رزرو/no-showِ قبلیِ مهمان» — همان مشکل، و بدتر: شمارشِ امروز،
 *     رفتارِ بعد از تصمیم را هم در بر می‌گیرد ⇒ نشتِ زمانیِ کلاسیک.
 *   • «سطحِ وفاداری» — روی جدولی است که **قابلِ تغییر** است؛ خواندنش در
 *     لحظه‌ی انتقال، مقدارِ آن‌موقع را نمی‌دهد.
 * هر سه در فازِ بعدی باید در **لحظه‌ی رزرو** ثبت شوند، نه اینجا بازسازی.
 */
export function transitionDecisionInputs(resv: {
  partySize: number;
  slotStart: Date;
  createdAt: Date;
  source: string;
  noShowRiskTier?: string | null;
  noShowRiskSource?: string | null;
  depositRequested?: boolean;
}, timezone: string): DecisionInputs {
  const leadMinutes = Math.round((resv.slotStart.getTime() - resv.createdAt.getTime()) / 60000);
  const inputs: DecisionInputs = {
    // ثابت‌های خودِ رزرو — از لحظه‌ی ساخت عوض نمی‌شوند.
    party_size:         { value: resv.partySize, window: 'as_of:booking' },
    lead_time_minutes:  { value: leadMinutes,    window: 'as_of:booking' },
    source:             { value: resv.source,    window: 'as_of:booking' },
    // قطعی‌اند: از slotStart مشتق می‌شوند، پس در هر زمانی همین مقدار را می‌دهند.
    slot_hour_local:    { value: hourInTz(resv.slotStart, timezone), window: 'deterministic:slot_start' },
    slot_dow_local:     {
      value: weekdayInTz(dateKeyInTz(resv.slotStart, timezone), timezone),
      window: 'deterministic:slot_start',
    },
    // ── تصمیم‌هایی که پلتفرم واقعاً گرفته و روی خودِ رزرو ثبت شده‌اند ──
    // اینها «feature» نیستند، **تصمیم‌اند** — و مندیت دقیقاً همین‌ها را
    // می‌خواهد: تصمیمِ ثبت‌شده به‌همراهِ نتیجه‌ی بعداً‌محقق‌شده.
    deposit_requested:  { value: resv.depositRequested ?? false, window: 'as_of:booking' },
    // ⚠️ `no_show_risk_source` عمداً کنارِ tier می‌آید: 'learned' | 'heuristic'
    // و NULL برای ردیف‌های پیش از مهاجرتِ ۰۸۰ که منبعشان **واقعاً نامعلوم**
    // است. مصرف‌کننده حق ندارد NULL را «مدل گفته» بخواند.
    no_show_risk_tier:  { value: resv.noShowRiskTier ?? null,   window: 'as_of:booking' },
    no_show_risk_source:{ value: resv.noShowRiskSource ?? null, window: 'as_of:booking' },
  };
  assertDeclaredWindows(inputs);
  return inputs;
}

// ═══════════════════════════════════════════════════════════════════════
//  عددی که می‌تواند بیفتد (M0 §۶.۵ — پاسخ به حمله‌ی ۲۰ Red Team)
//
//  «شمارنده‌ای که نمی‌تواند تکان بخورد، تزئین است.» یک خطِ لوله‌ی رویداد
//  بهترین مخفی‌گاه برای این نوع کوری است: جدول **رشد** می‌کند، پس «خالی
//  نیست» شبیهِ سلامت به نظر می‌رسد، در حالی که یک **کلاسِ کامل** غایب است.
//
//  ⚠️ به همین دلیل این تابع عمداً **به‌تفکیکِ نوعِ انتقال** گزارش می‌دهد و نه
//  یک عددِ کل: عددِ کل با رشدِ بقیه‌ی کلاس‌ها، غیبتِ یک کلاس را می‌پوشاند.
// ═══════════════════════════════════════════════════════════════════════

export type CoverageRow = {
  status: string;
  reservations: number;
  withEvent: number;
  ratio: number | null;
};

/**
 * برای هر وضعیتی که رزروها **الان** در آن هستند: چند تا رویدادِ متناظرِ
 * غنی‌شده (`rule_version IS NOT NULL`) دارند؟
 *
 * اگر emitter نسبت به یک کلاس کور شود، `ratio` همان کلاس پایین می‌آید در
 * حالی که بقیه ۱ می‌مانند — یعنی امضای کوری، نه یک افتِ مبهمِ کلی.
 *
 * ⚠️ `ratio = null` یعنی هیچ رزروی در آن وضعیت نیست ⇒ «نمی‌دانیم»، نه صفر.
 */
export async function substrateCoverageByStatus(restaurantId: string): Promise<CoverageRow[]> {
  const rows = await db.$queryRaw<{ status: string; reservations: bigint; with_event: bigint }[]>`
    SELECT r.status::text                                   AS status,
           count(*)                                         AS reservations,
           count(*) FILTER (WHERE e.reservation_id IS NOT NULL) AS with_event
    FROM reservations r
    LEFT JOIN LATERAL (
      SELECT 1 AS reservation_id
      FROM reservation_events ev
      WHERE ev.reservation_id = r.id
        AND ev.to_status = r.status
        AND ev.rule_version IS NOT NULL
      LIMIT 1
    ) e ON TRUE
    WHERE r.restaurant_id = ${restaurantId}::uuid
    GROUP BY r.status
    ORDER BY r.status
  `;
  return rows.map((x) => {
    const reservations = Number(x.reservations);
    const withEvent = Number(x.with_event);
    return {
      status: x.status,
      reservations,
      withEvent,
      ratio: reservations === 0 ? null : withEvent / reservations,
    };
  });
}
