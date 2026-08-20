import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

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
  return NextResponse.json({ id: updated.id, number: updated.number });
});

/** DELETE — حذف میز. اگر رزرو فعالی به این میز وصل باشد، اجازه نمی‌دهد (برای جلوگیری از یتیم‌شدن رزرو). */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageTables' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const table = await db.table.findUnique({ where: { id } });
  if (!table || table.restaurantId !== ctx.restaurant.id) throw Err.notFound('میز');

  const activeReservation = await db.reservation.findFirst({
    where: { tableId: id, status: { in: ['pending', 'confirmed', 'auto_confirmed', 'checked_in', 'seated', 'dining'] } },
  });
  if (activeReservation) throw Err.validation('این میز رزرو فعال دارد — ابتدا رزرو را لغو یا تکمیل کن');

  await db.table.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
