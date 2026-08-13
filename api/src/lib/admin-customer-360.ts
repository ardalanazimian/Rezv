import { dbRead as db } from './db';
import { getCustomerEconomyProfile } from './economy';
import { listMissionsForUser } from './missions';
import { isCurrentlyBanned } from './ban';
import { Err } from './errors';

// ═══════════════════════════════════════════════════════════════════════
//  «Customer 360» — نمایِ تک‌جای هویت + وضعیتِ نظارتی + اقتصاد + تاریخچه
//  برایِ پنلِ شرکت (Company Control Plane، فازِ ۲ — B2).
//
//  دو مسیرِ ورودی به همین ساختار می‌رسند: جست‌وجو با شناسه
//  (admin/users/[userId]) و جست‌وجو با شماره (admin/users?phone=...) —
//  منطق یک‌بار اینجا نوشته می‌شود تا از drift جلوگیری شود.
// ═══════════════════════════════════════════════════════════════════════
export async function buildCustomer360(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, phone: true, firstName: true, lastName: true, email: true, avatarUrl: true, createdAt: true,
      bannedAt: true, bannedReason: true, bannedByAdminId: true, unbannedAt: true, unbanReason: true,
    },
  });
  if (!user) throw Err.notFound('کاربر');

  const [economyProfile, ledger, missions, reservations] = await Promise.all([
    getCustomerEconomyProfile(db as any, userId),
    db.economyLedgerEntry.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, kind: true, amount: true, source: true, restaurantId: true, reservationId: true, createdAt: true },
    }),
    listMissionsForUser(userId),
    db.reservation.findMany({
      where: { userId }, orderBy: { slotStart: 'desc' }, take: 20,
      select: {
        id: true, code: true, status: true, partySize: true, slotStart: true, source: true,
        restaurant: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  return {
    user: {
      id: user.id, phone: user.phone, first_name: user.firstName, last_name: user.lastName,
      email: user.email, avatar_url: user.avatarUrl, created_at: user.createdAt,
    },
    moderation: {
      is_banned: isCurrentlyBanned(user),
      banned_at: user.bannedAt, banned_reason: user.bannedReason, banned_by_admin_id: user.bannedByAdminId,
      unbanned_at: user.unbannedAt, unban_reason: user.unbanReason,
      has_active_abuse_flag: !!(economyProfile as any).hasActiveAbuseFlag,
    },
    economy: {
      reliability_score: (economyProfile as any).reliabilityScore,
      reputation_tier: (economyProfile as any).reputationTier,
      xp_total: (economyProfile as any).xpTotal,
      wallet_balance: (economyProfile as any).walletBalance,
      strike_count: (economyProfile as any).strikeCount,
    },
    recent_ledger: ledger.map(l => ({
      id: l.id, kind: l.kind, amount: l.amount, source: l.source,
      restaurant_id: l.restaurantId, reservation_id: l.reservationId, at: l.createdAt,
    })),
    missions,
    recent_reservations: reservations.map(r => ({
      id: r.id, code: r.code, status: r.status, party_size: r.partySize, slot_start: r.slotStart,
      source: r.source, restaurant_id: r.restaurant.id, restaurant_name: r.restaurant.name, restaurant_slug: r.restaurant.slug,
    })),
  };
}
