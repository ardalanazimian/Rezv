import { db } from '@/lib/db';
import { invalidate, cacheKey } from '@/lib/cache';

// ═══════════════════════════════════════════════════════════════════════
//  باطل‌سازیِ کش‌های عمومیِ منو — تک‌منبع (SPEC-A فاز ۱).
//
//  تا مهاجرتِ ۰۷۷ این تابع private داخلِ routeِ عکس بود و در نتیجه فقط
//  تغییرِ عکس کش را باطل می‌کرد؛ ویرایشِ نام/قیمت/دسته تا سررسیدِ TTL
//  (۶۰ ثانیه) کهنه می‌ماند. حالا هر mutationِ منو (آیتم، دسته، reorder،
//  عکس) همین یک تابع را صدا می‌زند.
//
//  دو کلید، هر دو عمداً: صفحه‌ی کاملِ رستوران (اپِ مشتری از آن منو را
//  می‌خواند) و منویِ سبکِ QR (سایتِ SEO). invalidate خودش خطاپوش است
//  (lib/cache.ts) — شکستِ Redis مسیرِ اصلی را نمی‌شکند و TTL نهایتاً پاک می‌کند.
// ═══════════════════════════════════════════════════════════════════════

export async function invalidatePublicMenu(restaurantId: string): Promise<void> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  if (!r?.slug) return;
  await invalidate(cacheKey('restaurant-detail', r.slug));
  await invalidate(cacheKey('restaurant-public-menu', r.slug));
}
