import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ پنلِ business: هر فیلدی که apps/business/js از /restaurant/* می‌خواند
//
//  ⚠️ چرا (۲۰۲۶-۰۹-۰۲): پنلِ company صفر واگرایی داشت؛ این سطحِ بزرگ‌تر است
//  (۵۵ route). پیمایشِ استاتیک با grepِ فایل:خط **صفر واگراییِ بی‌صدا** یافت —
//  ولی سه بار نزدیک بود واگراییِ کاذب گزارش شود، هر بار به یک دلیل:
//    • `res.data.cards` مالِ /ai بود نه /crm/recommendations (Promise.all)
//    • `r.plan/r.sms/r.status` از RESTAURANTSِ محلی می‌آمد نه از پاسخِ BI
//    • `c.urgency/c.reason` مالِ حلقه‌ی contacts بود نه cards
//  این فایل همان تفکیک را قفل می‌کند: فقط فیلدهایی که **از پاسخِ سرور** خوانده
//  می‌شوند، در برابرِ خروجیِ **واقعیِ** route — نه state، نه mapperِ محلی.
//
//  یک شکافِ **مستند و گاردشده** عمداً پین نشده: `avg_interval_days` را
//  marketing.js:322-324 می‌خواهد ولی خودش می‌داند سرور نمی‌فرستد و با
//  `typeof==='number'` گارد می‌کند. پین‌کردنِ آرزو، قرارداد نیست.
//
//  قواعد: نوعِ **غیرِ null** پین می‌شود؛ null از چکِ نوع معاف است، از چکِ
//  وجود نه. آرایه‌ای که کلاینت map می‌کند باید **غیرخالی** باشد — نبودِ fixture
//  خطاست، نه عبور (قاعده‌ی ۵ِ CLAUDE.md). همه‌چیز داخلِ یک describe.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');

const R = {
  reservations: await import('../src/app/api/v1/restaurant/reservations/route'),
  tables: await import('../src/app/api/v1/restaurant/tables/route'),
  waitlist: await import('../src/app/api/v1/restaurant/waitlist/route'),
  waitlistAnalytics: await import('../src/app/api/v1/restaurant/waitlist/analytics/route'),
  members: await import('../src/app/api/v1/restaurant/members/route'),
  coupons: await import('../src/app/api/v1/restaurant/coupons/route'),
  reviews: await import('../src/app/api/v1/restaurant/reviews/route'),
  chats: await import('../src/app/api/v1/restaurant/chats/route'),
  automations: await import('../src/app/api/v1/restaurant/automations/route'),
  customers: await import('../src/app/api/v1/restaurant/customers/route'),
  staff: await import('../src/app/api/v1/restaurant/staff/route'),
  events: await import('../src/app/api/v1/restaurant/events/route'),
  notes: await import('../src/app/api/v1/restaurant/notes/route'),
  analytics: await import('../src/app/api/v1/restaurant/analytics/route'),
  notifications: await import('../src/app/api/v1/restaurant/notifications/route'),
  campaigns: await import('../src/app/api/v1/restaurant/campaigns/route'),
  photos: await import('../src/app/api/v1/restaurant/photos/route'),
  hours: await import('../src/app/api/v1/restaurant/hours/route'),
  cancellationPolicy: await import('../src/app/api/v1/restaurant/cancellation-policy/route'),
  pricing: await import('../src/app/api/v1/restaurant/pricing/route'),
  cashback: await import('../src/app/api/v1/restaurant/cashback/route'),
  crm: await import('../src/app/api/v1/restaurant/crm/recommendations/route'),
  rfm: await import('../src/app/api/v1/restaurant/rfm/route'),
  managerInsights: await import('../src/app/api/v1/restaurant/manager-insights/route'),
};

type Consumed = Array<[path: string, type: string]>;

// ── جدول‌ها؛ منبعِ هر ردیف grepِ ۲۰۲۶-۰۹-۰۲ است ──
/** data.js:919 mapResRow — r.* */
const RESERVATION_ITEM: Consumed = [
  ['code', 'string'], ['name', 'string'], ['note', 'string'], ['party_size', 'number'],
  ['phone', 'string'], ['reputation_tier', 'string'], ['slot_start', 'string'],
  ['status', 'string'], ['table_number', 'number'],
];
/** waitlist.js:58,62 — is_vip, party_size, estimated_wait_minutes · :30,42,43 analytics */
const WAITLIST_ITEM: Consumed = [['is_vip', 'boolean'], ['party_size', 'number'], ['estimated_wait_minutes', 'number']];
const WAITLIST_ANALYTICS: Consumed = [['current_queue_size', 'number'], ['conversion_rate', 'number'], ['avg_wait_minutes', 'number']];
/** data.js:840-848 — m.* */
const MEMBER_ITEM: Consumed = [
  ['first_name', 'string'], ['last_name', 'string'], ['phone', 'string'], ['code', 'string'],
  ['points', 'number'], ['tier', 'string'], ['birth_month', 'number'], ['joined_at', 'string'],
];
/** marketing.js:81-83 — max_redemptions, redemption_count, target_segment, is_active */
const COUPON_ITEM: Consumed = [['max_redemptions', 'number'], ['redemption_count', 'number'], ['target_segment', 'string'], ['is_active', 'boolean']];
/** crm.js:94,96 — avg_rating, created_at · reviews.items */
const REVIEWS_TOP: Consumed = [['avg_rating', 'number'], ['items', 'object'], ['distribution', 'object']];
const REVIEW_ITEM: Consumed = [['rating', 'number'], ['created_at', 'string']];
/** chat.js:28-29 — reservation_code, last_message · :17 items, unread_threads */
const CHATS_TOP: Consumed = [['items', 'object'], ['unread_threads', 'number']];
// chat.js:29 هم `t.last_message` (وجود) هم `t.last_message.body` را می‌خواند — شیء است، نه رشته.
const CHAT_ITEM: Consumed = [['reservation_code', 'string'], ['last_message', 'object'], ['last_message.body', 'string']];
/** marketing.js:33-34 — items, attribution · :124 sent_count */
const AUTOMATIONS_TOP: Consumed = [['items', 'object'], ['attribution', 'object']];
/** crm.js:731,740,743,746,1038 — churn_risk_score, predicted_clv_toman, intelligence_tier, no_show_rate_pct, last_visit_at */
const CUSTOMER_ITEM: Consumed = [
  ['churn_risk_score', 'number'], ['predicted_clv_toman', 'number'], ['intelligence_score', 'number'],
  ['intelligence_tier', 'string'], ['no_show_rate_pct', 'number'], ['last_visit_at', 'string'],
];
/** staff-system.js — items; tables: reservations.js floor plan reads number/capacity/state از items */
const TABLE_ITEM: Consumed = [['id', 'string'], ['number', 'number'], ['capacity', 'number'], ['state', 'string'], ['is_active', 'boolean']];
/** overview.js:367 — n.author_name (notes) */
const NOTE_ITEM: Consumed = [['author_name', 'string'], ['body', 'string'], ['created_at', 'string']];
/** marketing.js:320-326 — return_rate_pct, total_customers, new_customers · analytics.heatmap */
const ANALYTICS: Consumed = [['return_rate_pct', 'number'], ['total_customers', 'number'], ['new_customers', 'number'], ['heatmap', 'object']];
/** overview.js:184 — n.ic, n.emoji, n.title, n.text, n.at */
const NOTIFICATION_ITEM: Consumed = [['ic', 'string'], ['emoji', 'string'], ['title', 'string'], ['text', 'string'], ['at', 'string']];
/** crm.js:1110 — recipients_count */
const CAMPAIGN_ITEM: Consumed = [['recipients_count', 'number'], ['segment', 'string'], ['message', 'string']];
/** crm.js:81-82 — is_public, status_label, rejection_reason */
const PHOTO_ITEM: Consumed = [['is_public', 'boolean'], ['status_label', 'string'], ['rejection_reason', 'string']];
/** crm.js:793-796 — opening_hours, pending_opening_hours, hours_change_status, hours_change_reason */
const HOURS: Consumed = [['opening_hours', 'object'], ['pending_opening_hours', 'object'], ['hours_change_status', 'string'], ['hours_change_reason', 'string']];
/** crm.js:973-993 */
const CANCELLATION: Consumed = [['free_cancel_hours', 'number'], ['auto_confirm', 'boolean'], ['deposit_required', 'boolean'], ['partial_penalty_hours', 'number'], ['partial_penalty_pct', 'number'], ['is_customized', 'boolean']];
/** staff-system.js:296-297 */
const PRICING: Consumed = [['base_min_spend_toman', 'number'], ['current_rules', 'object'], ['has_data', 'boolean']];
/** staff-system.js:248 */
const CASHBACK: Consumed = [['base_pct', 'number'], ['preorder_pct', 'number']];
/** crm.js:1152-1153, 1173-1180 — items, effectiveness; c.user_id, c.name, c.phone, c.channel, c.urgency, c.reason */
const CRM_TOP: Consumed = [['items', 'object'], ['effectiveness', 'object']];
/** crm.js rfm — total, segments */
const RFM: Consumed = [['total', 'number'], ['segments', 'object']];
/** manager-insights — answers */
const INSIGHTS: Consumed = [['answers', 'object']];

function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}
function assertConsumed(body: unknown, table: Consumed, label: string) {
  assert.ok(table.length > 0, `${label}: جدولِ خالی یعنی هیچ‌چیز سنجیده نمی‌شود`);
  for (const [path, type] of table) {
    const v = at(body, path);
    assert.notEqual(v, undefined, `${label}: فیلدِ مصرف‌شده‌ی «${path}» در پاسخِ واقعی نیست`);
    if (v !== null) assert.equal(typeof v, type, `${label}: نوعِ «${path}» باید ${type} باشد، ${typeof v} است`);
  }
}
function firstItem(body: unknown, key: string, label: string): unknown {
  const arr = at(body, key);
  assert.ok(Array.isArray(arr), `${label}: «${key}» باید آرایه باشد — همان که کلاینت map می‌کند`);
  assert.ok(arr.length >= 1, `${label}: «${key}» خالی است — fixture غایب؛ نبودِ موضوع باید خطا باشد نه عبور`);
  return arr[0];
}

const SFX = String(Date.now()).slice(-7);
let tenantId = '', restaurantId = '', userId = '', token = '';

function req(method = 'GET', body?: unknown, qs = '') {
  return new Request(`http://x/api/v1/restaurant/x${qs}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': testIp(), authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function ok(res: Response, label: string) {
  const raw = await res.text();
  assert.equal(res.status, 200, `${label}: ${raw.slice(0, 200)}`);
  return JSON.parse(raw);
}

describe('قراردادِ پنلِ business — /restaurant/* در برابرِ آنچه apps/business/js می‌خواند', () => {
  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-biz`, plan: 'pro' }, select: { id: true } });
    tenantId = t.id;
    const r = await db.restaurant.create({
      data: { tenantId, slug: `demo-bizc-${SFX}`, name: '[DEMO] رستورانِ قراردادِ business', clubPrefix: 'DBC', isOpen: true, smsBalance: 50 },
      select: { id: true },
    });
    restaurantId = r.id;
    const owner = await db.staff.create({
      data: { tenantId, phone: fixturePhone('0981'), name: '[DEMO] مالک', role: 'owner', isActive: true },
      select: { id: true },
    });
    // توکنِ staffِ واقعی با نقشِ owner — نه ادمینِ پلتفرم (همان الگویِ دورِ ۵).
    token = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });

    const u = await db.user.create({ data: { phone: fixturePhone('0982'), firstName: '[DEMO]', lastName: 'مشتری' }, select: { id: true } });
    userId = u.id;

    const table = await db.table.create({ data: { restaurantId, number: 7, capacity: 4, isActive: true }, select: { id: true } });
    const start = new Date(Date.now() + 3 * 3600_000);
    await db.reservation.create({ data: {
      restaurantId, code: `DBC-${SFX}`, partySize: 2, slotStart: start, slotEnd: new Date(+start + 90 * 60_000),
      status: 'confirmed', userId, tableId: table.id, guestName: '[DEMO] مهمان', guestPhone: fixturePhone('0983'),
    } });
    await db.waitlistEntry.create({ data: { restaurantId, partySize: 3, userId, status: 'waiting' } });
    await db.coupon.create({ data: { restaurantId, code: `DBC${SFX}`, kind: 'percent', value: 10, isActive: true } });
    await db.clubMember.create({ data: { restaurantId, userId, code: `M${SFX}` } });
    await db.review.create({ data: { restaurantId, userId, rating: 5, body: '[DEMO] عالی' } });
    const th = await db.chatThread.create({ data: { restaurantId, userId }, select: { id: true } });
    await db.chatMessage.create({ data: { threadId: th.id, sender: 'user', body: '[DEMO] سلام' } });
    await db.marketingAutomation.create({ data: { restaurantId, name: '[DEMO] تولد', trigger: 'birthday', messageTemplate: '[DEMO] تولدت مبارک' } });
    await db.staffNote.create({ data: { restaurantId, body: '[DEMO] یادداشت', authorStaffId: owner.id, authorName: '[DEMO] مالک' } });
    await db.specialEvent.create({ data: { restaurantId, title: '[DEMO] شبِ موسیقی', startsAt: start } });
    await db.campaignLog.create({ data: { restaurantId, segment: 'all', message: '[DEMO] کمپین' } });
    await db.restaurantPhoto.create({ data: { restaurantId, url: 'https://example.invalid/demo.jpg' } });
    // فهرستِ مشتریان از جدولِ **مشتق‌شده‌ی** customer_insights می‌آید، نه از users —
    // بدونِ این ردیف، items خالی است و گارد به‌درستی خطا می‌دهد (اجرای اول همین را گرفت).
    await db.customerInsight.create({ data: {
      restaurantId, userId, totalVisits: 3, predictedClvToman: 1_500_000, lastVisitAt: new Date(),
      churnRiskScore: 20, noShowRatePct: 0, intelligenceScore: 72, intelligenceTier: 'gold', updatedAt: new Date(),
    } });
  });

  after(async () => {
    await db.customerInsight.deleteMany({ where: { restaurantId } });
    await db.restaurantPhoto.deleteMany({ where: { restaurantId } });
    await db.campaignLog.deleteMany({ where: { restaurantId } });
    await db.specialEvent.deleteMany({ where: { restaurantId } });
    await db.staffNote.deleteMany({ where: { restaurantId } });
    await db.marketingAutomation.deleteMany({ where: { restaurantId } });
    await db.chatMessage.deleteMany({ where: { thread: { restaurantId } } });
    await db.chatThread.deleteMany({ where: { restaurantId } });
    await db.review.deleteMany({ where: { restaurantId } });
    await db.clubMember.deleteMany({ where: { restaurantId } });
    await db.coupon.deleteMany({ where: { restaurantId } });
    await db.waitlistEntry.deleteMany({ where: { restaurantId } });
    await db.reservation.deleteMany({ where: { restaurantId } });
    await db.table.deleteMany({ where: { restaurantId } });
    await db.auditLog.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.user.deleteMany({ where: { id: userId } });
    await db.restaurant.deleteMany({ where: { tenantId } });
    await db.staff.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  test('reservations — {reservations:[…]} و ۹ فیلدِ mapResRow', async () => {
    const b = await ok(await R.reservations.GET(req()), 'reservations');
    assertConsumed(firstItem(b, 'reservations', 'reservations'), RESERVATION_ITEM, 'reservations[i]');
  });
  test('tables — {items:[…]}', async () => {
    const b = await ok(await R.tables.GET(req()), 'tables');
    assertConsumed(firstItem(b, 'items', 'tables'), TABLE_ITEM, 'tables[i]');
  });
  test('waitlist — {queue:[…]} و analytics', async () => {
    const q = await ok(await R.waitlist.GET(req()), 'waitlist');
    assertConsumed(firstItem(q, 'queue', 'waitlist'), WAITLIST_ITEM, 'waitlist.queue[i]');
    const a = await ok(await R.waitlistAnalytics.GET(req()), 'waitlist/analytics');
    assertConsumed(a, WAITLIST_ANALYTICS, 'waitlist/analytics');
  });
  test('members — {members:[…]} و ۸ فیلدِ مپر', async () => {
    const b = await ok(await R.members.GET(req()), 'members');
    assertConsumed(firstItem(b, 'members', 'members'), MEMBER_ITEM, 'members[i]');
  });
  test('coupons — {items:[…]}', async () => {
    const b = await ok(await R.coupons.GET(req()), 'coupons');
    assertConsumed(firstItem(b, 'items', 'coupons'), COUPON_ITEM, 'coupons[i]');
  });
  test('reviews — avg_rating, distribution, items[]', async () => {
    const b = await ok(await R.reviews.GET(req()), 'reviews');
    assertConsumed(b, REVIEWS_TOP, 'reviews');
    assertConsumed(firstItem(b, 'items', 'reviews'), REVIEW_ITEM, 'reviews[i]');
  });
  test('chats — items[], unread_threads', async () => {
    const b = await ok(await R.chats.GET(req()), 'chats');
    assertConsumed(b, CHATS_TOP, 'chats');
    assertConsumed(firstItem(b, 'items', 'chats'), CHAT_ITEM, 'chats[i]');
  });
  test('automations — items[], attribution', async () => {
    const b = await ok(await R.automations.GET(req()), 'automations');
    assertConsumed(b, AUTOMATIONS_TOP, 'automations');
    firstItem(b, 'items', 'automations');
  });
  test('customers — {items:[…]} و فیلدهای هوشمندی', async () => {
    const b = await ok(await R.customers.GET(req()), 'customers');
    assertConsumed(firstItem(b, 'items', 'customers'), CUSTOMER_ITEM, 'customers[i]');
  });
  test('staff — {items:[…]}', async () => {
    const b = await ok(await R.staff.GET(req()), 'staff');
    firstItem(b, 'items', 'staff');
  });
  test('events — {items:[…]}', async () => {
    const b = await ok(await R.events.GET(req()), 'events');
    assertConsumed(firstItem(b, 'items', 'events'), [['title', 'string'], ['starts_at', 'string'], ['capacity', 'number']], 'events[i]');
  });
  test('notes — items[] با author_name', async () => {
    const b = await ok(await R.notes.GET(req()), 'notes');
    assertConsumed(firstItem(b, 'items', 'notes'), NOTE_ITEM, 'notes[i]');
  });
  test('analytics — return_rate_pct, total_customers, new_customers, heatmap', async () => {
    assertConsumed(await ok(await R.analytics.GET(req()), 'analytics'), ANALYTICS, 'analytics');
  });
  test('notifications — items[] با ic/emoji/title/text/at', async () => {
    const b = await ok(await R.notifications.GET(req()), 'notifications');
    assertConsumed(firstItem(b, 'items', 'notifications'), NOTIFICATION_ITEM, 'notifications[i]');
  });
  test('campaigns — items[] با recipients_count', async () => {
    const b = await ok(await R.campaigns.GET(req()), 'campaigns');
    assertConsumed(firstItem(b, 'items', 'campaigns'), CAMPAIGN_ITEM, 'campaigns[i]');
  });
  test('photos — items[] با is_public/status_label', async () => {
    const b = await ok(await R.photos.GET(req()), 'photos');
    assertConsumed(firstItem(b, 'items', 'photos'), PHOTO_ITEM, 'photos[i]');
  });
  test('hours / cancellation-policy / pricing / cashback', async () => {
    assertConsumed(await ok(await R.hours.GET(req()), 'hours'), HOURS, 'hours');
    assertConsumed(await ok(await R.cancellationPolicy.GET(req()), 'cancellation-policy'), CANCELLATION, 'cancellation-policy');
    assertConsumed(await ok(await R.pricing.GET(req()), 'pricing'), PRICING, 'pricing');
    assertConsumed(await ok(await R.cashback.GET(req()), 'cashback'), CASHBACK, 'cashback');
  });
  test('crm/recommendations — items, effectiveness (نه cards — آن مالِ /ai است)', async () => {
    assertConsumed(await ok(await R.crm.GET(req()), 'crm'), CRM_TOP, 'crm');
  });
  test('rfm / manager-insights', async () => {
    assertConsumed(await ok(await R.rfm.GET(req()), 'rfm'), RFM, 'rfm');
    assertConsumed(await ok(await R.managerInsights.GET(req()), 'manager-insights'), INSIGHTS, 'manager-insights');
  });
});
