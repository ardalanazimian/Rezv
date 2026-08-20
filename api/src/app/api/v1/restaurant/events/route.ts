import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseQuery, zUuid, z } from '@/lib/schemas';

const dateStr = z.string().min(1).max(40); // new Date() خودش فرمت را چک می‌کند (پایین تست isNaN)
const createSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  starts_at: dateStr,
  description: z.string().max(1000).trim().optional(),
  emoji: z.string().max(10).optional(),
  ends_at: dateStr.optional(),
  price_toman: z.number().min(0).max(1_000_000_000).optional(),
  capacity: z.number().int().min(0).max(100_000).optional(),
  is_published: z.boolean().optional(),
});
const patchSchema = z.object({
  id: zUuid,
  title: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  emoji: z.string().max(10).optional(),
  starts_at: dateStr.optional(),
  ends_at: dateStr.optional(),
  price_toman: z.number().min(0).max(1_000_000_000).optional(),
  capacity: z.number().int().min(0).max(100_000).optional(),
  is_published: z.boolean().optional(),
});
const deleteQuerySchema = z.object({ id: zUuid });

/** GET — رویدادهای ویژه‌ی این رستوران (شامل گذشته و آینده، برای مدیریت در پنل) */
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (_req, ctx) => {
  const events = await db.specialEvent.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: { startsAt: 'desc' }, take: 100,
  });
  return NextResponse.json({
    items: events.map(e => ({
      id: e.id, title: e.title, description: e.description, emoji: e.emoji,
      starts_at: e.startsAt, ends_at: e.endsAt, price_toman: e.priceToman,
      capacity: e.capacity, is_published: e.isPublished,
    })),
  });
});

/** POST — ساخت رویداد. بدنه: { title, starts_at, description?, emoji?, ends_at?, price_toman?, capacity?, is_published? } */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);
  const startsAt = new Date(b.starts_at);
  if (isNaN(startsAt.getTime())) throw Err.validation('زمان شروع نامعتبر است');

  const event = await db.specialEvent.create({
    data: {
      restaurantId: ctx.restaurant.id, title: b.title,
      description: b.description || null,
      emoji: b.emoji || null,
      startsAt,
      endsAt: b.ends_at ? new Date(b.ends_at) : null,
      priceToman: b.price_toman ?? null,
      capacity: b.capacity ?? null,
      isPublished: b.is_published !== false,
    },
  });
  return NextResponse.json({ id: event.id }, { status: 201 });
});

/** PATCH — ویرایش/انتشار رویداد. بدنه: { id, ...fields } */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, patchSchema);
  const ev = await db.specialEvent.findUnique({ where: { id: b.id }, select: { restaurantId: true } });
  if (!ev || ev.restaurantId !== ctx.restaurant.id) throw Err.notFound('رویداد');

  const data: Record<string, unknown> = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.description !== undefined) data.description = b.description || null;
  if (b.emoji !== undefined) data.emoji = b.emoji || null;
  if (b.starts_at !== undefined) {
    const d = new Date(b.starts_at);
    if (isNaN(d.getTime())) throw Err.validation('زمان شروع نامعتبر است');
    data.startsAt = d;
  }
  if (b.ends_at !== undefined) data.endsAt = b.ends_at ? new Date(b.ends_at) : null;
  if (b.price_toman !== undefined) data.priceToman = b.price_toman ?? null;
  if (b.capacity !== undefined) data.capacity = b.capacity ?? null;
  if (b.is_published !== undefined) data.isPublished = b.is_published;

  await db.specialEvent.update({ where: { id: b.id }, data });
  return NextResponse.json({ ok: true });
});

/** DELETE ?id= — حذف رویداد */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const { id } = parseQuery(req, deleteQuerySchema);
  const ev = await db.specialEvent.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!ev || ev.restaurantId !== ctx.restaurant.id) throw Err.notFound('رویداد');
  await db.specialEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
