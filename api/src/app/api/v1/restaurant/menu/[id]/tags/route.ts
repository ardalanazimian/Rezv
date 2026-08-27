import { NextResponse } from 'next/server';
import { MenuTag } from '@prisma/client';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

// ═══════════════════════════════════════════════════════════════════════
//  برچسب‌های آیتمِ منو (SPEC-A فاز ۲ / ۰۷۸) — گیاهی/تند/بدونِ گلوتن/…
//
//  PUT جایگزینیِ کامل است (نه add/remove تکی): پنل کلِ ستِ انتخاب‌شده را
//  می‌فرستد؛ ساده، idempotent و بدونِ حالتِ نیمه.
//
//  شیمِ schemas.ts z.enum ندارد (B10) — whitelist دستی علیه enumِ Prisma.
// ═══════════════════════════════════════════════════════════════════════

const idParamSchema = z.object({ id: zUuid });
const VALID_TAGS = new Set<string>(Object.values(MenuTag));

const putSchema = z.object({
  tags: z.array(z.string().max(20)).max(9),
});

async function findOwnedItem(id: string, restaurantId: string) {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, restaurantId: true },
  });
  if (!item || item.restaurantId !== restaurantId) throw Err.notFound('آیتمِ منو');
  return item;
}

/** GET — برچسب‌های فعلیِ آیتم. */
export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  await findOwnedItem(id, ctx.restaurant.id);
  const rows = await db.menuItemTag.findMany({ where: { menuItemId: id }, select: { tag: true } });
  return NextResponse.json({ tags: rows.map(r => r.tag) });
});

/** PUT — جایگزینیِ کاملِ ستِ برچسب‌ها. */
export const PUT = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  await findOwnedItem(id, ctx.restaurant.id);

  const b = await parseBody(req, putSchema);
  const uniq = [...new Set(b.tags)];
  for (const t of uniq) {
    if (!VALID_TAGS.has(t)) throw Err.validation(`برچسبِ ناشناخته: ${t}`);
  }

  await db.$transaction([
    db.menuItemTag.deleteMany({ where: { menuItemId: id } }),
    ...(uniq.length
      ? [db.menuItemTag.createMany({ data: uniq.map(t => ({ menuItemId: id, tag: t as MenuTag })) })]
      : []),
  ]);

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({ tags: uniq });
});
