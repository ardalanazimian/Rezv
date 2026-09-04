import type { PrismaClient } from '@prisma/client';
import { activeStatusList } from './reservation-status';

// ═══════════════════════════════════════════════════════════════════════
//  اشغالِ میز — شاملِ میزهایِ ثانویه‌ی merge (رفعِ باگِ واقعی، ۲۰۲۶-۰۸-۱۳)
//
//  چرا این فایل: EXCLUDE constraintِ دیتابیس (no_table_overlap) فقط رویِ
//  reservations.table_id (میزِ اصلیِ هر رزرو) اعمال می‌شود. رزروهایِ ترکیبی
//  (tryMergeTables) میزهایِ ثانویه رو فقط در آرایه‌ی merged_table_numbers
//  ثبت می‌کنن — بدونِ هیچ ردیفِ رزروِ جداگانه‌ای که EXCLUDE بشناسدش. یعنی
//  بدونِ این کوئریِ اضافه، هم availability.ts (نمایشِ سانسِ آزاد به مشتری)
//  و هم tryMergeTables (انتخابِ میزِ ترکیبِ بعدی) می‌تونستن یک میزِ ثانویه‌یِ
//  یک ترکیبِ فعال رو «آزاد» نشون بدن — double-booking واقعیِ فیزیکی.
//
//  ⚠️ این چک لایه‌ی اپلیکیشنیه (نه DB-level مثلِ EXCLUDE) — یک TOCTOU raceِ
//  باریک بینِ خواندنِ این تابع و commitِ رزروِ جدید هنوز ممکنه (محافظِ نهاییِ
//  میزِ *اصلی* همچنان EXCLUDE constraint است). رفعِ کاملاً ریشه‌ای (ردیفِ
//  blocker برایِ میزهایِ ثانویه هم در DB، یا EXCLUDE رویِ یک ستونِ
//  denormalize‌شده) نیازِ تغییرِ مدلِ داده‌ست و خارج از دامنه‌ی این رفعِ
//  سرراست است — ریسکِ باقی‌مانده‌یِ مستندشده.
// ═══════════════════════════════════════════════════════════════════════

/**
 * مجموعه‌ی شماره‌ی میزهایی که در بازه‌ی [start, blockEnd) اشغالند —
 * هم میزِ اصلیِ هر رزروِ فعال (table_id → tables.number)، هم میزهایِ
 * ثانویه‌ی هر رزروِ ترکیبیِ فعال (merged_table_numbers).
 */
export async function getOccupiedTableNumbers(
  tx: Pick<PrismaClient, '$queryRaw'>,
  restaurantId: string,
  start: Date,
  blockEnd: Date,
): Promise<Set<number>> {
  const statuses = activeStatusList();
  const rows = await tx.$queryRaw<{ num: number }[]>`
    SELECT t.number AS num
    FROM reservations r
    JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status::text = ANY(${statuses})
      AND r.table_id IS NOT NULL
      AND tsrange(r.slot_start, r.block_end) && tsrange(${start}::timestamp, ${blockEnd}::timestamp)
    UNION
    SELECT unnest(r.merged_table_numbers) AS num
    FROM reservations r
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status::text = ANY(${statuses})
      AND cardinality(r.merged_table_numbers) > 0
      AND tsrange(r.slot_start, r.block_end) && tsrange(${start}::timestamp, ${blockEnd}::timestamp)
  `;
  return new Set(rows.map((r) => r.num));
}

/**
 * آیا میزِ فیزیکیِ شماره‌ی `tableNumber` در بازه‌ی [start, blockEnd) اشغال است؟
 *
 * ── چرا این تابع وجود دارد (نه فقط getOccupiedTableNumbers) ──
 * این کلاسِ باگ دوبار در همین مخزن رخ داد و هر دوبار ریشه‌اش یکی بود:
 * **هر مسیری که یک میزِ فیزیکی را تخصیص می‌دهد باید همین سؤال را بپرسد**،
 * ولی هیچ نامِ مشترکی برایِ پرسیدنش نبود. در commit 0113717 (۲۰۲۶-۰۸-۱۳)
 * فهرستِ مصرف‌کننده‌ها از سمتِ *ساختِ merge* شمرده شد (availability.ts،
 * tryMergeTables، createReservation) و دو نویسنده‌ی دیگرِ تخصیصِ میز —
 * createWalkin و promoteNextِ waitlist — از قلم افتادند، هرچند همان commit
 * خودِ createWalkin را برایِ چکِ maintenance باز کرده بود.
 *
 * پس این تابع عمداً یک نامِ صریح و یک نقطه‌ی تکی است: هر نویسنده‌ی جدیدی که
 * میز تخصیص می‌دهد باید این را صدا بزند. `boolean` برمی‌گرداند (نه throw)
 * چون دو مصرف‌کننده دو رفتارِ متفاوت لازم دارند — walk-in باید ۴۰۹ بدهد،
 * ولی ارتقایِ لیستِ انتظار باید بی‌صدا سراغِ کاندیدِ بعدی برود.
 *
 * ⚠️ محدوده‌ی ضمانت: این چکِ لایه‌ی اپلیکیشن است. برایِ میزِ **اصلی** محافظِ
 * نهایی همچنان کانسترینتِ `no_table_overlap` است؛ برایِ میزِ **ثانویه‌یِ
 * merge** هیچ محافظِ DB-levelی وجود ندارد (کانسترینت رویِ یک ستون
 * `table_id` کلید خورده و میزِ ثانویه ردیفِ خودش را ندارد)، پس این تابع
 * تنها محافظِ آن است و باید **داخلِ همان تراکنشِ درج** صدا زده شود.
 *
 * ⚠️ و پیش‌شرطِ آن ضمانت — بندی که نبودش یک P0 ساخت (۲۰۲۶-۰۹-۰۴):
 * «داخلِ همان تراکنش» لازم است ولی **کافی نیست**. آن تراکنش باید
 * `isolationLevel: Serializable` باشد. دلیلش رفتارِ خودِ Postgres است: SSI
 * فقط خواندنِ تراکنش‌هایِ Serializable را ردیابی می‌کند (رویِ خواندنِ یک
 * تراکنشِ READ COMMITTED هیچ SIREAD/predicate lockی گرفته نمی‌شود). پس این
 * کوئری اگر در READ COMMITTED اجرا شود، برایِ تشخیصِ تداخل **نامرئی** است:
 * چرخه‌ی rw-antidependency کامل نمی‌شود، هیچ‌کس abort نمی‌شود، و هر دو
 * نویسنده commit می‌کنند.
 *
 * این فرضی نیست. متنِ قبلیِ همین کامنت هر بندش درست بود و باز هم دو بازبینی
 * را که فعالانه دنبالِ همین کلاسِ باگ بودند گمراه کرد، چون **دامنه**ی ضمانت
 * را نام می‌برد و **پیش‌شرط**ش را نمی‌گفت. createWalkin دقیقاً همین تابع را
 * درست صدا می‌زد، داخلِ تراکنشِ درج، ولی در READ COMMITTED — و نتیجه یک
 * double-bookingِ فیزیکیِ بازتولیدشده در ۴ از ۶ تکرار بود
 * (tests/walkin-merge-occupancy-concurrency.test.mts).
 *
 * قاعده برایِ نویسنده‌ی بعدی: **یک محافظِ یکتا فقط در سطحی محافظ است که
 * خواندنش قابلِ‌اتکا باشد.** اگر مسیرِ تازه‌ای این تابع را صدا می‌زند،
 * تراکنشش باید Serializable باشد و آن مسیر باید retry داشته باشد
 * (`withSerializationRetry` در reservation-helpers.ts) — وگرنه گاردِ درست
 * را در سطحِ اشتباه گذاشته‌ای، که با بی‌گارد بودن یکی است.
 *
 * وضعیتِ فعلیِ فراخوان‌ها (۲۰۲۶-۰۹-۰۴):
 *   • placeReservation  (reservations.ts) — Serializable + retry ✔
 *   • createWalkinTx    (reservations.ts) — Serializable + retry ✔
 *   • promoteNext       (waitlist.ts)     — هنوز READ COMMITTED ✗ (ثبت‌شده،
 *     رفعش نیازِ تصمیمِ جدا دارد چون معناهایِ `upd === 0` را عوض می‌کند)
 */
export async function isTableNumberOccupied(
  tx: Pick<PrismaClient, '$queryRaw'>,
  restaurantId: string,
  tableNumber: number,
  start: Date,
  blockEnd: Date,
): Promise<boolean> {
  const occupied = await getOccupiedTableNumbers(tx, restaurantId, start, blockEnd);
  return occupied.has(tableNumber);
}
