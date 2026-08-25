import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authFromRequest } from '@/lib/jwt';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseQuery, zUuid, z } from '@/lib/schemas';

const createSchema = z.object({ body: z.string().min(1).max(2000).trim(), pinned: z.boolean().optional() });
const patchSchema = z.object({ id: zUuid, pinned: z.boolean() });
const deleteQuerySchema = z.object({ id: zUuid });

// ⚠️ رفعِ ممیزیِ RBAC: هر چهار متدِ این فایل بدونِ `permission:` بودند — یعنی
// کارمندی که هر ۹ مجوزش `false` بود هم یادداشت‌های داخلیِ تیم را می‌خواند و هم
// می‌توانست یادداشتِ تازه بسازد/سنجاق کند/حذف کند (تأییدشده با درخواستِ زنده:
// `POST` یک یادداشتِ واقعی ساخت). این یادداشتِ سرویسِ شب است و دقیقاً کنارِ
// همان داده‌ای می‌نشیند که تبِ رزروها نشان می‌دهد، پس `canManageReservations`
// کلیدِ درست است — نه `canManageSettings` (این تنظیماتِ رستوران نیست) و نه یک
// کلیدِ تازه (§۲۲). خواندن و نوشتن عمداً یک کلید دارند: کسی که حق دیدنِ
// یادداشتِ سرویس را ندارد، حقِ نوشتن در همان دفتر را هم ندارد.

/** GET — یادداشت‌های داخلی تیم (سنجاق‌شده‌ها اول) */
export const GET = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'search' }, async (_req, ctx) => {
  const notes = await db.staffNote.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return NextResponse.json({
    items: notes.map(n => ({
      id: n.id, body: n.body, pinned: n.pinned,
      author_name: n.authorName, created_at: n.createdAt,
    })),
  });
});

/** POST — افزودن یادداشت. بدنه: { body, pinned? } */
export const POST = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);

  // نام نویسنده از روی staff (اگر در دسترس باشد)
  let authorName: string | null = null;
  const auth = authFromRequest(req);
  if (auth.kind === 'staff') {
    const staff = await db.staff.findUnique({ where: { id: auth.sub }, select: { role: true } });
    authorName = staff?.role === 'owner' ? 'مالک' : staff?.role === 'manager' ? 'مدیر' : 'پرسنل';
  }

  const note = await db.staffNote.create({
    data: { restaurantId: ctx.restaurant.id, body: b.body, pinned: !!b.pinned, authorStaffId: auth.kind === 'staff' ? auth.sub : null, authorName },
  });
  return NextResponse.json({ id: note.id }, { status: 201 });
});

/** PATCH — سنجاق/برداشتن سنجاق. بدنه: { id, pinned } */
export const PATCH = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, patchSchema);
  const note = await db.staffNote.findUnique({ where: { id: b.id }, select: { restaurantId: true } });
  if (!note || note.restaurantId !== ctx.restaurant.id) throw Err.notFound('یادداشت');
  await db.staffNote.update({ where: { id: b.id }, data: { pinned: b.pinned } });
  return NextResponse.json({ ok: true });
});

/** DELETE ?id= — حذف یادداشت */
export const DELETE = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'auth' }, async (req, ctx) => {
  const { id } = parseQuery(req, deleteQuerySchema);
  const note = await db.staffNote.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!note || note.restaurantId !== ctx.restaurant.id) throw Err.notFound('یادداشت');
  await db.staffNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
