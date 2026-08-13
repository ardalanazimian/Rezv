import { dbRead as db } from './db';
import { listBannedIps } from './ratelimit';

// ═══════════════════════════════════════════════════════════════════════
//  صفِ یکپارچه‌ی نظارت (Unified Moderation Queue، Company Control Plane
//  فازِ ۴ — عمداً «اسکلت»): این ابزارِ جدیدی نمی‌سازد، فقط شمارشِ فعلیِ
//  ابزارهایِ نظارتیِ موجود (بن سختِ کاربر، فلگِ سوءاستفاده، بنِ IP، صفِ
//  عکس) را یک‌جا نشان می‌دهد تا تیمِ پلتفرم مجبور نباشد بینِ چند تب بگردد
//  تا بفهمد الان چیزی نیاز به توجه دارد یا نه.
// ═══════════════════════════════════════════════════════════════════════
export async function getModerationQueueSummary() {
  const [bannedUsers, flaggedUsers, bannedIps, pendingPhotos] = await Promise.all([
    db.user.count({ where: { bannedAt: { not: null }, unbannedAt: null } }),
    db.customerEconomyProfile.count({ where: { hasActiveAbuseFlag: true } }),
    listBannedIps(),
    db.restaurantPhoto.count({ where: { status: 'pending' } }),
  ]);
  return {
    banned_users_count: bannedUsers,
    flagged_abuse_users_count: flaggedUsers,
    banned_ips_count: bannedIps.length,
    pending_photos_count: pendingPhotos,
  };
}
