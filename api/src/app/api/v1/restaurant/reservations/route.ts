import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, zReservationCode, z } from '@/lib/schemas';

const querySchema = z.object({
  date: z.enum(['today', 'tomorrow', 'upcoming', 'past', 'all']).default('today'),
  limit: z.number().int().min(1).max(200).default(100),
  cursor: zReservationCode.optional(),
});

/**
 * GET ?date=today|tomorrow|upcoming|past|all — رزروهای رستوران. مهاجرت‌شده به wrapper.
 *
 * ⚠️ رفعِ نشتِ داده‌ی شخصی (ممیزیِ RBAC): این GET هیچ `permission:` نداشت، پس
 * **هر** کارمندِ لاگین‌کرده — حتی کسی که هر ۹ مجوزش صریحاً `false` بود — کلِ
 * فهرستِ رزروهای امروز را با `user.phone` و نام و نامِ‌خانوادگیِ هر مهمان
 * می‌گرفت (تأییدشده با درخواستِ زنده: ۲۰۰ به‌همراهِ `"phone":"+98…"`). یعنی
 * «کارمندِ بدونِ دسترسی» عملاً خواندنِ کاملِ دفترچه‌ی تلفنِ مهمان‌ها را داشت.
 * حالا هم‌سطحِ خواهرش `.../[code]/status` است و با همان کلیدی محافظت می‌شود
 * که پنل هم برایِ همین صفحه انتظارش را دارد (`VIEW_PERMISSION.reservations`
 * در `apps/business/js/routing.js`).
 *
 * توجه: `SAFE_DEFAULTS` در `lib/permissions.ts` مقدارِ `canManageReservations`
 * را `true` می‌گذارد، پس کارمندی که هیچ رکوردِ `StaffPermission` ندارد
 * دست‌نخورده کار می‌کند؛ فقط کارمندی که **صریحاً محدود شده** رد می‌شود.
 */
export const GET = withRestaurantAuth(
  { permission: 'canManageReservations', rateLimit: 'search' },
  async (req, ctx) => {
    const restaurant = ctx.restaurant;
    const { date: filter, limit, cursor } = parseQuery(req, querySchema);

    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
    const endTomorrow = new Date(endToday); endTomorrow.setDate(endTomorrow.getDate() + 1);

    let slotWhere: Record<string, unknown> = {};
    if (filter === 'today') slotWhere = { slotStart: { gte: startToday, lt: endToday } };
    else if (filter === 'tomorrow') slotWhere = { slotStart: { gte: endToday, lt: endTomorrow } };
    else if (filter === 'upcoming') slotWhere = { slotStart: { gte: endTomorrow } };
    else if (filter === 'past') slotWhere = { slotStart: { lt: startToday } };

    // ── صفحه‌بندیِ Cursor (نه Offset) — برای مقیاسِ ۱۰k+ رزرو ──
    // cursor = code آخرین رزروِ صفحه‌ی قبل. limit+1 می‌گیریم تا بفهمیم صفحه‌ی بعدی هست.

    const rows = await db.reservation.findMany({
      where: { restaurantId: restaurant.id, ...slotWhere },
      orderBy: [{ slotStart: filter === 'past' ? 'desc' : 'asc' }, { code: 'asc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { code: cursor } } : {}),
      include: {
        table: { select: { number: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });

    const hasMore = rows.length > limit;
    const list = hasMore ? rows.slice(0, limit) : rows;

    // ── نشانِ اعتبارِ مشتری (reputationTier) — یه کوئریِ batch، نه N+1 ──
    // فقط برایِ کاربرانِ لاگین‌کرده (userId موجود)؛ مهمانانِ بدونِ حساب فعلاً
    // بدونِ نشان می‌مونن (PhoneReliabilityShadow برایِ نمایشِ عمومی طراحی نشده).
    const userIds = [...new Set(list.map(r => r.userId).filter((id): id is string => !!id))];
    const tierByUserId = userIds.length
      ? new Map(
          (await db.customerEconomyProfile.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, reputationTier: true },
          })).map(p => [p.userId, p.reputationTier]),
        )
      : new Map<string, string>();

    return NextResponse.json({
      reservations: list.map(r => ({
        code: r.code, status: r.status, party_size: r.partySize, slot_start: r.slotStart,
        table_number: r.table?.number ?? null,
        name: r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() : (r.guestName || 'مهمان'),
        phone: r.user?.phone || r.guestPhone || null,
        source: r.source,
        preorder: r.items.map(i => i.menuItem.name),
        note: r.preferences.join('، '),
        reputation_tier: r.userId ? (tierByUserId.get(r.userId) ?? 'bronze') : null,
      })),
      next_cursor: hasMore ? list[list.length - 1].code : null,
    });
  },
);
