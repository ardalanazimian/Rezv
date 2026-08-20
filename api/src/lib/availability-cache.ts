import { redis } from './redis';
import { createLogger } from './logger';

const log = createLogger('availability-cache');

// ═══════════════════════════════════════════════════════════
//  کش availability — کلید و باطل‌سازی در یک جا (باگ H3)
//
//  قبلاً کلید کش `avail:{id}:{date}:{party}` بود ولی باطل‌سازی فقط
//  `avail:{id}:{date}` را حذف می‌کرد (بدون party) → کش هیچ‌وقت باطل
//  نمی‌شد و داده‌ی کهنه سرو می‌شد.
//
//  حالا هر دو از همین ماژول می‌آیند: کلید با party ساخته می‌شود و
//  باطل‌سازی همه‌ی partyها برای آن (رستوران، تاریخ) را با SCAN پاک می‌کند.
//  SCAN (نه KEYS) تا Redis در ترافیک بالا بلاک نشود؛ DEL تک‌کلیدی تا با
//  Redis Cluster هم سازگار باشد (CROSSSLOT نمی‌دهد).
// ═══════════════════════════════════════════════════════════

/** کلید کش برای یک ترکیب مشخص. */
export function availabilityKey(restaurantId: string, date: string, party: number): string {
  return `avail:${restaurantId}:${date}:${party}`;
}

/** الگوی همه‌ی کلیدهای یک (رستوران، تاریخ) صرف‌نظر از party. */
function availabilityPattern(restaurantId: string, date: string): string {
  return `avail:${restaurantId}:${date}:*`;
}

/** الگوی همه‌ی کلیدهای یک رستوران، صرف‌نظر از تاریخ و party. */
function allDatesPattern(restaurantId: string): string {
  return `avail:${restaurantId}:*`;
}

/**
 * باطل‌سازی کش availability برای یک (رستوران، تاریخ) — همه‌ی اندازه‌های گروه.
 * بعد از هر تغییری که در دسترس‌بودن میز اثر دارد (رزرو، لغو، تغییر وضعیت میز) صدا زده می‌شود.
 */
export async function invalidateAvailability(restaurantId: string, date: string): Promise<void> {
  const pattern = availabilityPattern(restaurantId, date);
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      // حذف تک‌به‌تک: سازگار با Cluster (DEL چندکلیدی بین slotها CROSSSLOT می‌دهد).
      for (const k of keys) {
        await redis.del(k).catch(() => {});
      }
    } while (cursor !== '0');
  } catch (e) {
    // باطل‌سازی نباید مسیر اصلی را بشکند؛ کش با TTL خودش هم در نهایت منقضی می‌شود.
    log.warn('باطل‌سازی کش availability ناموفق', { restaurantId, date, error: (e as Error).message });
  }
}

/**
 * باطل‌سازی کش availability برایِ *همه‌ی* تاریخ‌هایِ یک رستوران.
 *
 * ⚠️ Part 3 (تأییدِ ساعتِ کاری، ۲۰۲۶-۰۸-۱۴): invalidateAvailability بالا فقط
 * یک تاریخِ مشخص را پاک می‌کند — برایِ رویدادهایی مثلِ رزرو/لغوِ یک رزرو کافی
 * است. اما تأییدِ یک پیشنهادِ ساعتِ کاری، ساعتِ کاریِ *هفتگیِ* رستوران را عوض
 * می‌کند (مثلاً همه‌ی «سه‌شنبه»های آینده) — پاک‌کردنِ فقط یک تاریخ باعث می‌شد
 * بقیه‌ی تاریخ‌ها تا انقضایِ TTL همچنان با ساعتِ کاریِ قدیمی محاسبه شوند.
 */
export async function invalidateAllAvailability(restaurantId: string): Promise<void> {
  const pattern = allDatesPattern(restaurantId);
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      for (const k of keys) {
        await redis.del(k).catch(() => {});
      }
    } while (cursor !== '0');
  } catch (e) {
    log.warn('باطل‌سازیِ کاملِ کش availability ناموفق', { restaurantId, error: (e as Error).message });
  }
}
