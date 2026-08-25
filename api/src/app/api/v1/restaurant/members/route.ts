import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, z } from '@/lib/schemas';

const querySchema = z.object({
  q: z.string().max(100).trim().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100_000).default(0),
});

/** GET — لیست اعضای باشگاه (?q= جستجو، ?limit=&offset= صفحه‌بندی). مهاجرت‌شده به wrapper. */
export const GET = withRestaurantAuth(
  { permission: 'canViewAnalytics', rateLimit: 'search' },
  async (req, ctx) => {
    const restaurant = ctx.restaurant;
    const { q = '', limit, offset } = parseQuery(req, querySchema);

    const where = {
      restaurantId: restaurant.id,
      ...(q ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' as const } },
          { user: { is: { firstName: { contains: q, mode: 'insensitive' as const } } } },
          { user: { is: { lastName: { contains: q, mode: 'insensitive' as const } } } },
          { user: { is: { phone: { contains: q } } } },
        ],
      } : {}),
    };

    const [members, total] = await Promise.all([
      db.clubMember.findMany({
        where, orderBy: { joinedAt: 'desc' }, take: limit, skip: offset,
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true } } },
      }),
      db.clubMember.count({ where }),
    ]);

    const tierCounts = await db.clubMember.groupBy({
      by: ['tier'], where: { restaurantId: restaurant.id }, _count: true,
    });
    const tiers: Record<string, number> = { gold: 0, silver: 0, bronze: 0 };
    tierCounts.forEach(t => { tiers[t.tier] = t._count; });

    const userIds = members.map(m => m.user.id);
    const pointsByUser = new Map<string, number>();
    if (userIds.length > 0) {
      // ⚠️ رفعِ P1-6 (فازِ ۲، §۱۳): این جمع قبلاً به رستوران اسکوپ نمی‌شد، پس
      // موجودیِ **کلِ پلتفرمِ** کاربر به‌عنوانِ «امتیازِ او در باشگاهِ این رستوران»
      // به پرسنل نشان داده می‌شد — عددی که با هیچ سطحِ دیگری نمی‌خواند. دفتر ستونِ
      // restaurant_id را دارد، پس عددِ درست همیشه قابلِ محاسبه بوده.
      const ledger = await db.pointsLedger.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, restaurantId: restaurant.id },
        _sum: { delta: true },
      });
      ledger.forEach(l => pointsByUser.set(l.userId, l._sum.delta ?? 0));
    }

    return NextResponse.json({
      total, tiers,
      members: members.map(m => ({
        code: m.code, tier: m.tier, points: pointsByUser.get(m.user.id) ?? 0, joined_at: m.joinedAt,
        first_name: m.user.firstName, last_name: m.user.lastName, phone: m.user.phone,
        birth_month: m.user.birthDate ? m.user.birthDate.getMonth() + 1 : null,
      })),
    });
  },
);
