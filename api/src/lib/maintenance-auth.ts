import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// ═══════════════════════════════════════════════════════════
//  احراز هویت endpointهای نگهداری (cron)
//  قبلاً این چک در ۴ route کپی شده بود (نقض DRY) — حالا یک منبع.
// ═══════════════════════════════════════════════════════════

/** مقایسه‌ی امن در برابر timing attack (طول‌ها هم چک می‌شوند). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * بررسی هدر x-maintenance-key. اگر نامعتبر بود، NextResponse خطا برمی‌گرداند؛
 * اگر معتبر بود، null برمی‌گرداند (یعنی ادامه بده).
 *
 * L3: مقایسه‌ی constant-time تا نتوان با اندازه‌گیری زمان، کلید را حرف‌به‌حرف حدس زد.
 *
 * استفاده:
 *   const denied = guardMaintenance(req);
 *   if (denied) return denied;
 */
export function guardMaintenance(req: Request): NextResponse | null {
  const key = req.headers.get('x-maintenance-key');
  const expected = process.env.MAINTENANCE_KEY;
  // روش ۱: هدر x-maintenance-key (فراخوانی دستی/کران خارجی)
  if (expected && key && safeEqual(key, expected)) return null;
  // روش ۲: Vercel Cron — هدر Authorization: Bearer ${CRON_SECRET}
  // Vercel این هدر را خودکار به درخواست‌های cron اضافه می‌کند.
  const cronSecret = process.env.CRON_SECRET;
  const authz = req.headers.get('authorization');
  if (cronSecret && authz === `Bearer ${cronSecret}`) return null;
  // هیچ‌کدام معتبر نبود
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'دسترسی غیرمجاز' } },
    { status: 401 },
  );
}
