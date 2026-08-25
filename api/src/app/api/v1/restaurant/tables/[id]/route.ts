import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { activeStatusList } from '@/lib/reservation-status';
import { invalidateAllAvailability } from '@/lib/availability-cache';

// فیلدهایی که در محاسبه‌ی availability اثر دارند — تغییرشان کش را باطل می‌کند.
// (پیش از این هیچ ویرایشِ میزی کش را پاک نمی‌کرد: میزِ غیرفعال‌شده تا ۳۰۰
// ثانیه برای مشتری «آزاد» می‌ماند — ممیزیِ ۲۰۲۶-۰۸-۲۴.)
const AVAILABILITY_FIELDS = ['capacity', 'is_active', 'min_party_size', 'max_party_size'] as const;

const SHAPES = ['rectangle', 'round', 'booth'] as const;
const ZONES = ['indoor', 'outdoor', 'window', 'vip', 'smoking'] as const;

const idParamSchema = z.object({ id: zUuid });
const patchSchema = z.object({
  capacity: z.number().int().min(1).max(50).optional(),
  name: z.string().max(50).nullable().optional(),
  shape: z.enum(SHAPES).optional(),
  zone: z.enum(ZONES).optional(),
  is_vip: z.boolean().optional(),
  is_smoking: z.boolean().optional(),
  is_accessible: z.boolean().optional(),
  is_active: z.boolean().optional(),
  min_party_size: z.number().int().min(1).optional(),
  max_party_size: z.number().int().min(1).nullable().optional(),
  pos_x: z.number().optional(),
  pos_y: z.number().optional(),
  rotation: z.number().optional(),
});

/** PATCH — ویرایش جزئیات میز (ظرفیت، نام، شکل، ناحیه، فعال/غیرفعال). تغییر state از endpoint جدا (/tables/:id/state) انجام می‌شود. */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageTables' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const table = await db.table.findUnique({ where: { id } });
  if (!table || table.restaurantId !== ctx.restaurant.id) throw Err.notFound('میز');

  const b = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (b.capacity !== undefined) data.capacity = b.capacity;
  if (b.name !== undefined) data.name = b.name;
  if (b.shape !== undefined) data.shape = b.shape;
  if (b.zone !== undefined) data.zone = b.zone;
  if (b.is_vip !== undefined) data.isVip = b.is_vip;
  if (b.is_smoking !== undefined) data.isSmoking = b.is_smoking;
  if (b.is_accessible !== undefined) data.isAccessible = b.is_accessible;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  if (b.min_party_size !== undefined) data.minPartySize = b.min_party_size;
  if (b.max_party_size !== undefined) data.maxPartySize = b.max_party_size;
  if (b.pos_x !== undefined) data.posX = b.pos_x;
  if (b.pos_y !== undefined) data.posY = b.pos_y;
  if (b.rotation !== undefined) data.rotation = b.rotation;

  const updated = await db.table.update({ where: { id }, data });
  if (AVAILABILITY_FIELDS.some(f => b[f] !== undefined)) {
    await invalidateAllAvailability(ctx.restaurant.id);
  }
  return NextResponse.json({ id: updated.id, number: updated.number });
});

/**
 * DELETE — حذف میز. اگر رزرو فعالی به این میز وصل باشد، اجازه نمی‌دهد
 * (برای جلوگیری از یتیم‌شدن رزرو).
 *
 * ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۱، ممیزیِ ماژولِ میز): این گارد لیستِ وضعیت‌ها را
 * دستی هاردکد کرده بود و سه وضعیتِ فعال از قلم افتاده بود — `preparing`،
 * `running_late` و `arrived`. چون FKِ `reservations.table_id` روی
 * `ON DELETE SET NULL` است، حذف حتی خطا هم نمی‌داد: رزروِ زنده **بی‌صدا
 * یتیم** می‌شد. یعنی مهمانی که همین حالا دمِ در ایستاده (`arrived`) یا
 * غذایش در حالِ آماده‌سازی است (`preparing`) میزش را از دست می‌داد و
 * هیچ‌کس خبردار نمی‌شد. بدتر: EXCLUDE constraintِ ضدِ double-booking روی
 * `table_id` است، پس رزروِ یتیم‌شده از حفاظتِ تداخل هم بیرون می‌افتاد.
 *
 * حالا از همان منبعِ یگانه‌ای می‌خواند که EXCLUDE constraint و availability
 * و موتورِ رزرو می‌خوانند. توضیحِ خودِ `reservation-status.ts` «گاردِ حذفِ
 * میز» را صریحاً یکی از جاهایی نام برده بود که لیستِ تکراری داشت — یعنی
 * رفع اعلام شده بود ولی همین یک مصرف‌کننده هرگز وصل نشد. درسش: کپیِ دستیِ
 * یک لیستِ مشترک همیشه همان‌جایی می‌ماند که یادت می‌رود.
 */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageTables' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const table = await db.table.findUnique({ where: { id } });
  if (!table || table.restaurantId !== ctx.restaurant.id) throw Err.notFound('میز');

  // ⚠️ رفعِ باگِ واقعی (فازِ ۲ — پیداشده توسطِ گاردِ ایستایِ
  // tests/lifecycle-exclusivity.test.mts، پروتکل §۶).
  //
  // این لیست دستی بود و سه وضعیتِ فعال را **جا انداخته بود**: preparing،
  // running_late و arrived. یعنی میزی که رزروش در حالِ آماده‌سازی بود، یا
  // مهمانش دیر کرده بود، یا رسیده بود، **قابلِ حذف** بود — و رزرو یتیم می‌شد
  // (دقیقاً همان چیزی که کامنتِ خودِ این تابع می‌گوید می‌خواهد جلویش را بگیرد).
  //
  // این دقیقاً همان کلاسِ باگِ C1 است که lib/reservation-status.ts برایِ
  // ریشه‌کن‌کردنش ساخته شد؛ هدرِ همان فایل «گاردِ حذف میز» را در فهرستِ
  // جاهایی که اصلاح شده نام می‌برد — ولی این یکی در عمل اصلاح نشده بود.
  // حالا از منبعِ واحد می‌خواند، پس دیگر نمی‌تواند drift کند.
  const activeReservation = await db.reservation.findFirst({
    where: { tableId: id, status: { in: activeStatusList() as never } },
  });
  if (activeReservation) throw Err.validation('این میز رزرو فعال دارد — ابتدا رزرو را لغو یا تکمیل کن');

  await db.table.delete({ where: { id } });
  await invalidateAllAvailability(ctx.restaurant.id);
  return NextResponse.json({ ok: true });
});
