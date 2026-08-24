import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { assignQrCode } from '@/lib/tables';

const SHAPES = ['rectangle', 'round', 'booth'] as const;
const ZONES = ['indoor', 'outdoor', 'window', 'vip', 'smoking'] as const;

const createSchema = z.object({
  number: z.number().int().min(1),
  capacity: z.number().int().min(1).max(50),
  name: z.string().max(50).optional(),
  shape: z.enum(SHAPES).optional(),
  zone: z.enum(ZONES).optional(),
  is_vip: z.boolean().optional(),
  is_smoking: z.boolean().optional(),
  is_accessible: z.boolean().optional(),
  min_party_size: z.number().int().min(1).optional(),
  max_party_size: z.number().int().min(1).optional(),
});

/** GET — لیست همه‌ی میزهای رستوران (برای نقشه‌ی سالن و مدیریت میز در پنل) */
export const GET = withRestaurantAuth({ permission: 'canManageTables' }, async (_req, ctx) => {
  const tables = await db.table.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: { number: 'asc' },
  });
  return NextResponse.json({
    items: tables.map(t => ({
      id: t.id, number: t.number, name: t.name, capacity: t.capacity,
      min_party_size: t.minPartySize, max_party_size: t.maxPartySize,
      shape: t.shape, zone: t.zone,
      is_vip: t.isVip, is_smoking: t.isSmoking, is_accessible: t.isAccessible,
      is_active: t.isActive, state: t.state,
      pos_x: t.posX, pos_y: t.posY, rotation: t.rotation,
      qr_code: t.qrCode,
    })),
  });
});

/** POST — افزودن میز جدید · بدنه: { number, capacity, name?, shape?, zone?, is_vip?, is_smoking?, is_accessible? } */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageTables' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);
  const { number, capacity } = b;

  const dup = await db.table.findFirst({ where: { restaurantId: ctx.restaurant.id, number } });
  if (dup) throw Err.validation(`میز شماره ${number} از قبل وجود دارد`);

  const table = await db.table.create({
    data: {
      restaurantId: ctx.restaurant.id, number, capacity,
      name: b.name || null,
      shape: b.shape || 'rectangle', zone: b.zone || 'indoor',
      isVip: !!b.is_vip, isSmoking: !!b.is_smoking, isAccessible: !!b.is_accessible,
      minPartySize: b.min_party_size || 1, maxPartySize: b.max_party_size || capacity,
    },
  });

  // هر میزِ جدید همان لحظه کدِ QR می‌گیرد.
  //
  // ⚠️ چرا اینجا و نه یک قدمِ دستیِ جدا: تا ۲۰۲۶-۰۸-۲۱ `assignQrCode` صفر
  // فراخوان داشت و هیچ روتی `qrCode` را ست نمی‌کرد، پس تنها میزهایِ دارایِ QR
  // داده‌ی `[DEMO]`ِ seed بودند. نتیجه این بود که `POST /api/v1/checkin` —
  // که عمومی سرو می‌شود — برای هر رستورانِ واقعی هیچ‌وقت موفق نمی‌شد.
  // ساختِ خودکار یعنی رستوران‌دار هیچ قدمِ اضافه‌ای لازم ندارد.
  //
  // شکستِ ساختِ QR عمداً کلِ ساختِ میز را برنمی‌گرداند: میز موجودیتِ اصلی است
  // و QR یک افزوده؛ اگر اینجا throw می‌کرد، یک خطایِ گذرا میزِ ساخته‌شده را
  // پشتِ یک ۵۰۰ پنهان می‌کرد. کدِ نداشته بعداً با روتِ `…/qr` ساخته می‌شود.
  let qrCode: string | null = null;
  try {
    qrCode = await assignQrCode(table.id, ctx.restaurant.id);
  } catch {
    qrCode = null;
  }

  return NextResponse.json({ id: table.id, number: table.number, qr_code: qrCode }, { status: 201 });
});
