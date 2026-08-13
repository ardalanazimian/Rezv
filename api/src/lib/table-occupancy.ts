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
