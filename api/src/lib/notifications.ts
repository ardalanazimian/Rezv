import { db } from './db';

// ═══════════════════════════════════════════════════════════
//  فیدِ فعالیتِ اخیر برایِ زنگوله‌یِ اعلانِ پنلِ بیزنس
//
//  ⚠️ رفعِ باگ (یافته‌ی جانبیِ ثبت‌شده در PR #4/#5): این پنل قبلاً یک
//  NOTIFS هاردکد داشت («پارسا تهرانی رزرو کرد»، «نیلوفر رضایی ۵ ستاره
//  داد»، …) — همان الگویِ RES/GUESTS: هر رستوران‌دارِ واقعی همیشه همین
//  ۴ رویدادِ نمونه را می‌دید. به‌جایِ یک جدولِ notification جدید (migration/
//  ریسکِ اضافه)، این فعالیت از رویِ جدول‌هایِ از قبل موجود محاسبه می‌شود —
//  دقیقاً همان فلسفه‌یِ restaurant-manager.ts (بینشِ محاسبه‌شده، نه یک
//  موجودیتِ تازه‌یِ ماندگار).
// ═══════════════════════════════════════════════════════════

export interface ActivityItem {
  id: string;
  ic: 'green' | 'amber' | 'blue';
  emoji: string;
  title: string;
  text: string;
  at: string; // ISO — فرانت با faRelative فرمت می‌کند
}

const WINDOW_DAYS = 7;
const CHURN_ALERT_THRESHOLD = 60; // هم‌راستا با restaurant/ai/route.ts (vipAtRisk از ۴۰ استفاده می‌کند؛ اینجا سخت‌گیرانه‌تر چون برایِ «همه‌ی مشتری‌ها» است نه فقط VIP)

function displayName(user: { firstName: string | null; lastName: string | null } | null, guestName: string | null): string {
  if (user) {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (full) return full;
  }
  return guestName || 'مهمان';
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** فعالیتِ اخیرِ واقعیِ رستوران: رزروِ جدید، نظرِ جدید، هشدارِ ریزش. */
export async function getRecentActivity(restaurantId: string, limit = 10): Promise<ActivityItem[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [reservations, reviews, atRisk] = await Promise.all([
    db.reservation.findMany({
      where: { restaurantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, partySize: true, guestName: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.review.findMany({
      where: { restaurantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, rating: true, body: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.customerInsight.findMany({
      where: { restaurantId, churnRiskScore: { gte: CHURN_ALERT_THRESHOLD }, updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        userId: true, updatedAt: true, churnRiskScore: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const r of reservations) {
    items.push({
      id: `resv:${r.id}`, ic: 'green', emoji: 'checkCircle',
      title: 'رزرو جدید',
      text: `${displayName(r.user, r.guestName)} برایِ ${r.partySize} نفر رزرو کرد`,
      at: r.createdAt.toISOString(),
    });
  }
  for (const rv of reviews) {
    const quote = rv.body ? `: «${truncate(rv.body, 60)}»` : '';
    items.push({
      id: `rev:${rv.id}`, ic: 'blue', emoji: 'star',
      title: 'نظر جدید',
      text: `${displayName(rv.user, null)} ${rv.rating} ستاره داد${quote}`,
      at: rv.createdAt.toISOString(),
    });
  }
  for (const ci of atRisk) {
    items.push({
      id: `risk:${ci.userId}`, ic: 'amber', emoji: 'alert',
      title: 'هشدارِ ریزش',
      text: `${displayName(ci.user, null)} — ریسکِ ریزش ${ci.churnRiskScore}٪`,
      at: ci.updatedAt.toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}
