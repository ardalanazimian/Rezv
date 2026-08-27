import { db } from '@/lib/db';
import { Err } from '@/lib/errors';

/**
 * دسته‌ی آیتم را از ورودی به (categoryId, میرورِ متنی) ترجمه می‌کند — ۰۷۷.
 *
 * سه مسیر، هر سه عمدی:
 *   • category_id → باید متعلق به همین رستوران باشد (۴۲۲)؛ میرور = نامِ دسته.
 *   • فقط رشته‌ی category (کلاینتِ قدیمی) → find-or-createِ دسته‌ی هم‌نام و
 *     لینک. یعنی پنلِ قدیمی بدونِ هیچ تغییری داده‌ی رابطه‌ایِ درست تولید
 *     می‌کند — همان معناشناسیِ backfillِ ۰۷۷، فقط زنده.
 *   • هیچ‌کدام/null → دسته‌نشده (هر دو فیلد null).
 */
export async function resolveCategory(
  restaurantId: string,
  b: { category_id?: string | null; category?: string | null },
): Promise<{ categoryId: string | null; category: string | null }> {
  if (b.category_id) {
    const cat = await db.menuCategory.findUnique({
      where: { id: b.category_id },
      select: { id: true, restaurantId: true, name: true },
    });
    if (!cat || cat.restaurantId !== restaurantId) {
      // پیام عمداً وجودِ id را لو نمی‌دهد (ضدِ IDOR، مثل findOwnedItem).
      throw Err.validation('دسته‌ی انتخاب‌شده معتبر نیست');
    }
    return { categoryId: cat.id, category: cat.name };
  }
  if (b.category) {
    const cat = await db.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId, name: b.category } },
      create: { restaurantId, name: b.category },
      update: {},
      select: { id: true, name: true },
    });
    return { categoryId: cat.id, category: cat.name };
  }
  return { categoryId: null, category: null };
}
